/* Panneau micro : enregistrer sa voix, voir le son (niveau en direct et forme d'onde),
   écouter les enregistrements avec une lecture suivie à l'écran */
(function () {
  "use strict";

  const KA = window.KA;
  const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const LIVE_BARS = 24; // barres du niveau en direct
  const BARS = 40; // barres de la forme d'onde d'un enregistrement
  const COLOR_PLAYED = "#ef5350";
  const COLOR_REST = "#b0bec5";
  const FLAT_LIVE = new Array(LIVE_BARS).fill(0.1);
  const FLAT = new Array(BARS).fill(0.1);

  let root, btn, timeEl, stateEl, list, empty, liveCanvas;
  let recorder = null;
  let stream = null;
  let micStream = null; // micro gardé ouvert pendant la visite du panneau (pas de nouvelle demande à chaque enregistrement)
  let leaving = false;
  let chunks = [];
  let startedAt = 0;
  let timer = null;

  // Niveau en direct
  let liveCtx = null;
  let analyser = null;
  let liveRaf = null;
  let liveLoudest = 0; // le son le plus fort entendu pendant cet enregistrement
  let silenceWarned = false;

  // Lecture
  let playing = null;
  let playingUrl = null;
  let activeCtx = null;
  let activeCanvas = null;
  let activePeaks = FLAT;
  let progressRaf = null;
  const peaksCache = new Map(); // id -> formes d'onde (ou null si illisible)
  const rowCanvases = new Map(); // id -> canvas de la ligne affichée

  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    return MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m)) || "";
  }

  function fmt(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function tick() {
    timeEl.textContent = fmt(Date.now() - startedAt);
  }

  // ---------- Dessin des barres ----------
  // progress entre 0 et 1 : les barres jusqu'à ce point sont colorées (lecture en cours)
  function drawBars(canvas, peaks, progress) {
    if (!canvas) return;
    const g = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    const n = peaks.length;
    const gap = 3;
    const bw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(4, peaks[i] * h);
      g.fillStyle = (i + 0.5) / n <= progress ? COLOR_PLAYED : COLOR_REST;
      g.fillRect(i * (bw + gap), (h - bh) / 2, bw, bh);
    }
  }

  // ---------- Niveau en direct pendant l'enregistrement ----------
  function drawLive() {
    if (!analyser) {
      drawBars(liveCanvas, FLAT_LIVE, 0);
      return;
    }
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    const step = Math.floor(data.length / LIVE_BARS);
    const peaks = [];
    for (let i = 0; i < LIVE_BARS; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) {
        const v = Math.abs(data[i * step + j] - 128) / 128;
        if (v > max) max = v;
      }
      if (max > liveLoudest) liveLoudest = max;
      // racine carrée : les voix faibles se voient aussi
      peaks.push(Math.min(1, Math.sqrt(max) * 1.6));
    }
    drawBars(liveCanvas, peaks, 1);

    if (!silenceWarned && Date.now() - startedAt > 3000 && liveLoudest < 0.01) {
      silenceWarned = true;
      stateEl.textContent = "🎤 Je n'entends rien : approche-toi du micro";
    }
    liveRaf = requestAnimationFrame(drawLive);
  }

  function startLive(micStream) {
    if (!liveCtx) {
      drawLive();
      return;
    }
    try {
      analyser = liveCtx.createAnalyser();
      analyser.fftSize = 512;
      const src = liveCtx.createMediaStreamSource(micStream);
      // Sortie muette : le navigateur calcule l'analyseur seulement s'il est relié à une sortie
      const silent = liveCtx.createGain();
      silent.gain.value = 0;
      src.connect(analyser);
      analyser.connect(silent);
      silent.connect(liveCtx.destination);
    } catch (e) {
      analyser = null;
    }
    liveCtx.resume().catch(() => {});
    drawLive();
  }

  function stopLive() {
    cancelAnimationFrame(liveRaf);
    liveRaf = null;
    analyser = null;
    if (liveCtx) {
      liveCtx.close().catch(() => {});
      liveCtx = null;
    }
    drawBars(liveCanvas, FLAT_LIVE, 0);
  }

  // ---------- Forme d'onde d'un enregistrement ----------
  async function peaksOf(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    try {
      const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
      const data = buffer.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / BARS));
      const raw = [];
      for (let i = 0; i < BARS; i++) {
        let max = 0;
        const start = i * step;
        for (let j = 0; j < step && start + j < data.length; j++) {
          const v = Math.abs(data[start + j]);
          if (v > max) max = v;
        }
        raw.push(max);
      }
      const top = Math.max(...raw, 0.0001);
      return raw.map((v) => Math.max(0.06, v / top));
    } finally {
      ctx.close().catch(() => {});
    }
  }

  function getPeaks(r) {
    if (!peaksCache.has(r.id)) {
      peaksCache.set(r.id, peaksOf(r.blob).catch(() => null));
    }
    return peaksCache.get(r.id);
  }

  // ---------- Enregistrement ----------
  // Réutilise le micro déjà ouvert ; sinon demande l'accès une seule fois
  async function getMic() {
    const live = micStream && micStream.getAudioTracks().some((t) => t.readyState === "live");
    if (live) return micStream;
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return micStream;
  }

  function releaseMic() {
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  // Message clair quand le micro ne peut pas être utilisé (fenêtre intégrée, permission refusée…)
  function showMicError(err) {
    let message;
    if (window.self !== window.top) {
      message = "🚫 Le micro est bloqué dans cette fenêtre : ouvre la page dans un vrai navigateur";
    } else if (err && err.name === "NotFoundError") {
      message = "🚫 Aucun micro trouvé";
    } else {
      message = "🚫 Le micro est refusé : autorise-le dans les réglages";
    }
    stateEl.textContent = message;
    KA.speak("Le micro est bloqué");
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showMicError(null);
      return;
    }
    // Créé pendant l'appui pour que le navigateur accepte la visualisation
    const AC = window.AudioContext || window.webkitAudioContext;
    liveCtx = AC ? new AC() : null;
    if (liveCtx) liveCtx.resume().catch(() => {}); // pendant l'appui, sinon le navigateur le laisse en pause
    liveLoudest = 0;
    silenceWarned = false;
    try {
      stream = await getMic();
    } catch (err) {
      if (liveCtx) liveCtx.close().catch(() => {});
      liveCtx = null;
      showMicError(err);
      return;
    }
    // Pas de synthèse vocale pendant l'enregistrement : le micro la capterait
    chunks = [];
    const mime = pickMime();
    recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    });
    recorder.addEventListener("stop", onStop);
    recorder.start();
    startedAt = Date.now();
    clearInterval(timer);
    timer = setInterval(tick, 250);
    tick();
    btn.classList.add("recording");
    stateEl.textContent = "🔴 J'enregistre...";
    KA.quiet = true; // pas de bruitage ni de voix pendant l'enregistrement
    startLive(stream);
  }

  function stop() {
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function onStop() {
    clearInterval(timer);
    timer = null;
    stopLive();
    KA.quiet = false;
    const duration = Date.now() - startedAt;
    const type = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunks, { type });
    stream = null; // le micro reste ouvert, sauf si l'on a quitté le panneau
    if (leaving) releaseMic();
    recorder = null;
    chunks = [];
    btn.classList.remove("recording");
    timeEl.textContent = "0:00";
    stateEl.textContent = "🎧 Bien enregistré !";
    if (blob.size) {
      await KA.db.put({ id: KA.db.newId("rec"), kind: "recording", createdAt: Date.now(), duration, blob });
    } else {
      stateEl.textContent = "⚠️ Rien n'a été enregistré, réessaie";
    }
    render();
  }

  function toggle() {
    if (recorder) stop();
    else start();
  }

  // ---------- Lecture ----------
  // Fait avancer la couleur de la forme d'onde pendant la lecture
  function followProgress(getProgress, isDone) {
    cancelAnimationFrame(progressRaf);
    const tickProgress = () => {
      if (!activeCanvas) return;
      if (isDone()) {
        drawBars(activeCanvas, activePeaks, 0);
        return;
      }
      drawBars(activeCanvas, activePeaks, Math.min(1, getProgress()));
      progressRaf = requestAnimationFrame(tickProgress);
    };
    tickProgress();
  }

  function stopPlaying() {
    cancelAnimationFrame(progressRaf);
    progressRaf = null;
    if (activeCanvas) drawBars(activeCanvas, activePeaks, 0);
    activeCanvas = null;
    activePeaks = FLAT;
    if (playing) playing.pause();
    if (playingUrl) URL.revokeObjectURL(playingUrl);
    playing = null;
    playingUrl = null;
    if (activeCtx) {
      activeCtx.close().catch(() => {});
      activeCtx = null;
    }
  }

  function showError() {
    stateEl.textContent = "⚠️ Je n'arrive pas à lire cet enregistrement";
    KA.speak("Je n'arrive pas à lire cet enregistrement");
  }

  // Repli : décodage par la Web Audio API, si l'élément audio n'arrive pas à lire le fichier
  async function playWithWebAudio(blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio indisponible");
    const ctx = new AC();
    activeCtx = ctx;
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = ctx.currentTime;
    src.start();
    followProgress(
      () => (ctx.currentTime - startAt) / buffer.duration,
      () => ctx.currentTime - startAt >= buffer.duration
    );
  }

  function play(r) {
    stopPlaying();
    playingUrl = URL.createObjectURL(r.blob);
    const audio = new Audio(playingUrl);
    playing = audio;
    activeCanvas = rowCanvases.get(r.id) || null;
    activePeaks = FLAT;
    getPeaks(r).then((peaks) => {
      if (peaks && playing === audio) activePeaks = peaks;
    });

    const fallback = () => {
      if (playing !== audio) return; // un autre enregistrement a été choisi entre-temps
      playWithWebAudio(r.blob).catch(showError);
    };
    audio.addEventListener("error", fallback);
    audio.addEventListener("ended", () => followProgress(() => 0, () => true));

    // play() passe « paused » à false tout de suite : la lecture suivie doit démarrer après l'appel
    const started = audio.play();
    const duration = () => (isFinite(audio.duration) && audio.duration > 0 ? audio.duration : r.duration / 1000);
    followProgress(
      () => (duration() ? audio.currentTime / duration() : 0),
      () => audio.paused || audio.ended
    );

    started.catch((e) => {
      if (e && e.name === "AbortError") return; // arrêt volontaire : un autre enregistrement a été choisi
      fallback();
    });
  }

  async function remove(id) {
    peaksCache.delete(id);
    await KA.db.del(id);
    render();
  }

  async function render() {
    const items = await KA.db.list("recording");
    list.innerHTML = "";
    rowCanvases.clear();
    empty.hidden = items.length > 0;
    const ordered = items.slice().reverse(); // le plus récent en haut
    ordered.forEach((r, k) => {
      const n = ordered.length - k;
      const li = document.createElement("li");
      li.className = "row-item";

      const playBtn = document.createElement("button");
      playBtn.className = "chip";
      playBtn.textContent = "▶️";
      playBtn.setAttribute("aria-label", "Écouter");
      playBtn.addEventListener("click", () => play(r));

      const info = document.createElement("div");
      info.className = "rec-info";

      const name = document.createElement("span");
      name.className = "row-name";
      name.textContent = "🎙️ " + n + " · " + fmt(r.duration || 0);

      const canvas = document.createElement("canvas");
      canvas.className = "wave";
      canvas.width = 320;
      canvas.height = 60;
      drawBars(canvas, FLAT, 0);
      rowCanvases.set(r.id, canvas);
      getPeaks(r).then((peaks) => {
        if (peaks && rowCanvases.get(r.id) === canvas && activeCanvas !== canvas) drawBars(canvas, peaks, 0);
      });

      info.append(name, canvas);

      const delBtn = document.createElement("button");
      delBtn.className = "chip";
      delBtn.textContent = "🗑️";
      delBtn.setAttribute("aria-label", "Supprimer");
      delBtn.addEventListener("click", () => KA.armed(delBtn, () => remove(r.id)));

      li.append(playBtn, info, delBtn);
      list.appendChild(li);
    });
  }

  KA.panels.recorder = {
    init(r) {
      root = r;
      btn = root.querySelector("#rec-btn");
      timeEl = root.querySelector("#rec-time");
      stateEl = root.querySelector("#rec-state");
      list = root.querySelector("#rec-list");
      empty = root.querySelector("#rec-empty");
      liveCanvas = root.querySelector("#rec-live");
      drawBars(liveCanvas, FLAT_LIVE, 0);
      btn.addEventListener("click", toggle);
    },
    enter() {
      leaving = false;
      render();
    },
    leave() {
      leaving = true;
      stop(); // sauvegarde l'enregistrement en cours avant de quitter (le micro est libéré dans onStop)
      if (!recorder) releaseMic();
      stopPlaying();
    },
  };
})();
