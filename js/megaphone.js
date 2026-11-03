/* Panneau Mégaphone, en direct : l'enfant parle au micro et entend sa voix changée tout de suite.
   Aiguë et Grave changent la hauteur (voice-worklet.js), Robot, Écho et Mégaphone changent le son.
   Conseil affiché : un casque évite les sifflements quand le téléphone diffuse et capte la même voix. */
(function () {
  "use strict";

  const KA = window.KA;
  const WORKLET = "js/voice-worklet.js";

  // Chaque voix : un traitement de l'entrée (src) qui renvoie le nœud de sortie
  function pitch(ctx, src, ratio) {
    const node = new AudioWorkletNode(ctx, "pitch-shifter");
    node.parameters.get("ratio").value = ratio;
    src.connect(node);
    return node;
  }

  // Courbe de saturation pour la distorsion du mégaphone
  function saturation() {
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.tanh(2.5 * x) / Math.tanh(2.5);
    }
    return curve;
  }

  const EFFECTS = [
    { name: "Normale", ico: "🙂", build: (ctx, src) => src },
    { name: "Aiguë", ico: "🐿️", pitch: true, build: (ctx, src) => pitch(ctx, src, 1.6) },
    { name: "Grave", ico: "🐻", pitch: true, build: (ctx, src) => pitch(ctx, src, 0.7) },
    {
      name: "Robot",
      ico: "🤖",
      build: (ctx, src) => {
        // Modulation en anneau : la voix est hachée par un signal de 50 Hz
        const g = ctx.createGain();
        g.gain.value = 0;
        const osc = ctx.createOscillator();
        osc.frequency.value = 50;
        osc.connect(g.gain);
        osc.start(0);
        src.connect(g);
        return g;
      },
    },
    {
      name: "Écho",
      ico: "🏔️",
      build: (ctx, src) => {
        const out = ctx.createGain();
        src.connect(out);
        const delay = ctx.createDelay(1);
        delay.delayTime.value = 0.28;
        const feedback = ctx.createGain();
        feedback.gain.value = 0.45;
        src.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(out);
        return out;
      },
    },
    {
      name: "Mégaphone",
      ico: "📢",
      build: (ctx, src) => {
        // Son de haut-parleur : médiums seulement, un peu saturé
        const band = ctx.createBiquadFilter();
        band.type = "bandpass";
        band.frequency.value = 1400;
        band.Q.value = 0.9;
        const shaper = ctx.createWaveShaper();
        shaper.curve = saturation();
        shaper.oversample = "4x";
        const g = ctx.createGain();
        g.gain.value = 1.3;
        src.connect(band);
        band.connect(shaper);
        shaper.connect(g);
        return g;
      },
    },
  ];

  let workletFailed = false; // le changement de hauteur (voice-worklet.js) ne charge pas sur cet appareil
  let workletErrName = "";
  let micStream = null; // micro gardé ouvert pendant la visite du panneau
  let ctx = null; // contexte audio ouvert pendant la conversation
  let src = null;
  let voiceGains = []; // une porte par voix : une seule ouverte à la fois
  let effectIndex = 0;
  let starting = false;
  let btn = null;
  let stateEl = null;
  let effectBtns = [];

  function setState(text) {
    stateEl.textContent = text;
  }

  function live() {
    return !!ctx;
  }

  // Réutilise le micro déjà ouvert ; sinon demande l'accès une seule fois
  async function getMic() {
    const ok = micStream && micStream.getAudioTracks().some((t) => t.readyState === "live");
    if (!ok) micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return micStream;
  }

  function releaseMic() {
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  function micError(err) {
    if (window.self !== window.top) {
      setState("🚫 Le micro est bloqué dans cette fenêtre : ouvre la page dans un vrai navigateur");
    } else if (err && err.name === "NotFoundError") {
      setState("🚫 Aucun micro trouvé");
    } else {
      setState("🚫 Le micro est refusé : autorise-le dans les réglages");
    }
  }

  function showVoice(i) {
    if (EFFECTS[i].pitch && workletFailed) {
      setState(EFFECTS[i].name + " ne marche pas sur cet appareil");
      return;
    }
    effectIndex = i;
    KA.settings.set("megaVoice", i);
    effectBtns.forEach((b, k) => {
      b.classList.toggle("selected", k === i);
      b.setAttribute("aria-pressed", k === i ? "true" : "false");
    });
    if (ctx) {
      const now = ctx.currentTime;
      voiceGains.forEach((g, k) => g.gain.setTargetAtTime(k === i ? 1 : 0, now, 0.03));
    }
  }

  function setButton(on) {
    btn.classList.toggle("recording", on);
    btn.setAttribute("aria-label", on ? "Arrêter" : "Parler");
  }

  // Ouvre le micro, construit toutes les voix, et laisse passer celle qui est choisie
  async function startLive() {
    if (starting || live()) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      micError(null);
      return;
    }
    starting = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    let stream;
    try {
      stream = await getMic();
    } catch (err) {
      starting = false;
      micError(err);
      return;
    }
    const audio = new AC();
    // Sans le changement de hauteur, les autres voix marchent quand même
    workletFailed = false;
    workletErrName = "";
    try {
      await audio.audioWorklet.addModule(WORKLET);
    } catch (e) {
      workletFailed = true;
      workletErrName = (e && e.name) || "erreur";
    }
    ctx = audio;
    audio.resume().catch(() => {});
    src = audio.createMediaStreamSource(stream);
    const master = audio.createGain();
    master.connect(audio.destination);
    voiceGains = EFFECTS.map((e) => {
      const gate = audio.createGain();
      gate.gain.value = 0;
      src.connect(gate);
      if (!(e.pitch && workletFailed)) e.build(audio, gate).connect(master);
      return gate;
    });
    // Les voix qui ne marchent pas sur cet appareil ne sont pas affichées
    effectBtns.forEach((b, k) => (b.hidden = workletFailed && EFFECTS[k].pitch));
    if (workletFailed && EFFECTS[effectIndex].pitch) effectIndex = 0;
    starting = false;
    KA.quiet = true; // pas de bruitage ni de voix pendant la conversation
    showVoice(effectIndex);
    setButton(true);
    setState("🔴 Tu es en direct : parle !");
  }

  function stopLive() {
    if (!ctx) return;
    const audio = ctx;
    ctx = null;
    voiceGains = [];
    src = null;
    audio.close().catch(() => {});
    KA.quiet = false;
    setButton(false);
  }

  function toggle() {
    if (live()) {
      stopLive();
      setState("Appuie pour parler 🎤");
    } else {
      startLive();
    }
  }

  KA.panels.megaphone = {
    init(r) {
      btn = r.querySelector("#mega-btn");
      stateEl = r.querySelector("#mega-state");
      const box = r.querySelector("#mega-effects");
      EFFECTS.forEach((e, i) => {
        const b = document.createElement("button");
        b.className = "mega-effect";
        b.dataset.silent = "";
        b.setAttribute("aria-label", "Voix " + e.name);
        b.setAttribute("aria-pressed", "false");
        b.innerHTML = '<span class="mega-ico">' + e.ico + '</span><span class="mega-name">' + e.name + "</span>";
        b.addEventListener("click", () => showVoice(i));
        box.appendChild(b);
        effectBtns.push(b);
      });
      effectIndex = Math.min(EFFECTS.length - 1, Math.max(0, KA.settings.get("megaVoice", 0)));
      showVoice(effectIndex);
      setState("Appuie pour parler 🎤");
      btn.addEventListener("click", toggle);
    },
    enter() {
      setState(live() ? "🔴 Tu es en direct : parle !" : "Appuie pour parler 🎤");
    },
    leave() {
      stopLive();
      releaseMic();
    },
  };
})();
