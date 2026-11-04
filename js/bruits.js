/* Panneau « Bruits doux » : bruit blanc, pluie, orage, vagues, vent, feu de bois.
   Les sons sont fabriqués par le navigateur (pas de fichier, marche hors ligne).
   Un seul son à la fois : en choisir un arrête le précédent. Un minuteur coupe tout après 15, 30 ou 60 minutes.
   Le son continue si on quitte le panneau (pour la sieste) : bouton « Tout arrêter » pour couper. */
(function () {
  "use strict";

  const KA = window.KA;
  const FADE = 0.5; // secondes de fondu avant l'arrêt

  let ctx = null;
  let master = null;
  let volumeEl = null;
  let timerInfo = null;
  let grid = null;
  let sleepEnd = 0; // heure (ms) de l'arrêt programmé, 0 = pas de minuteur
  let sleepTimer = null;
  let sleepTick = null;
  const playing = new Map(); // id -> { stop() }

  // ---------- Briques sonores ----------
  // Bruit aléatoire en boucle (le « sable » de base de presque tous les sons)
  function noise(c) {
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  }

  // Répète fn() sans fin, à des intervalles donnés par nextDelay() (en ms).
  // Une seule fonction d'arrêt est rangée dans made.timers : la liste ne grossit pas.
  function loop(made, fn, nextDelay) {
    let alive = true;
    made.timers.push(() => {
      alive = false;
    });
    const tick = () => {
      if (!alive) return;
      fn();
      setTimeout(tick, nextDelay());
    };
    tick();
  }

  // Quelques gouttes de pluie différentes (bruit très court qui s'éteint vite)
  let dropBuffers = null;
  function makeDropBuffers(c) {
    const list = [];
    for (let k = 0; k < 8; k++) {
      const len = Math.floor(c.sampleRate * (0.004 + Math.random() * 0.008));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      list.push(buf);
    }
    return list;
  }

  // Petite oscillation lente (LFO) branchée sur un paramètre, par exemple le volume
  function lfo(c, freq, depth, target) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
    return o;
  }

  function filter(c, type, freq, q) {
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    if (q) f.Q.value = q;
    return f;
  }

  // Chaque son : fabrique ses nœuds et les branche sur « out ». Renvoie { nodes, timers }.
  const SOUNDS = {
    blanc: {
      ico: "📻",
      label: "Bruit blanc",
      make(c, out) {
        const src = noise(c);
        const g = c.createGain();
        g.gain.value = 0.25;
        src.connect(g);
        g.connect(out);
        return { nodes: [src], timers: [] };
      },
    },
    pluie: {
      ico: "🌧️",
      label: "Pluie",
      make(c, out) {
        const timers = [];
        const nodes = [];
        // 1. Le « grésil » continu de la pluie, qui gonfle et faiblit au hasard
        const hiss = noise(c);
        const hp = filter(c, "highpass", 1400);
        const lp = filter(c, "lowpass", 9000);
        const g = c.createGain();
        g.gain.value = 0.16;
        lfo(c, 0.23, 0.05, g.gain);
        hiss.connect(hp);
        hp.connect(lp);
        lp.connect(g);
        g.connect(out);
        nodes.push(hiss);
        // 2. Le grondement de fond (les grosses gouttes qui tombent par terre)
        const bed = noise(c);
        const bedLp = filter(c, "lowpass", 450);
        const bedG = c.createGain();
        bedG.gain.value = 0.22;
        bed.connect(bedLp);
        bedLp.connect(bedG);
        bedG.connect(out);
        nodes.push(bed);
        // 3. Les gouttes : de petits « tic » aigus, très nombreux et tous différents
        if (!dropBuffers) dropBuffers = makeDropBuffers(c);
        const dropOut = filter(c, "highpass", 2000);
        dropOut.connect(out);
        const made = { nodes, timers };
        loop(
          made,
          () => {
            const s = c.createBufferSource();
            s.buffer = dropBuffers[Math.floor(Math.random() * dropBuffers.length)];
            s.playbackRate.value = 0.6 + Math.random() * 1.2;
            const dg = c.createGain();
            dg.gain.value = 0.05 + Math.random() * 0.25;
            s.connect(dg);
            dg.connect(dropOut);
            s.start();
          },
          // Une goutte toutes les 3 à 25 ms, avec des rafales plus fréquentes
          () => 3 + Math.pow(Math.random(), 2) * 22
        );
        return made;
      },
    },
    orage: {
      ico: "⛈️",
      label: "Orage",
      make(c, out) {
        const made = SOUNDS.pluie.make(c, out);
        // Un coup de tonnerre grave, toutes les 6 à 14 secondes
        const thunder = () => {
          const src = noise(c);
          const lp = filter(c, "lowpass", 180);
          const g = c.createGain();
          const t = c.currentTime;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.9, t + 0.3);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
          src.connect(lp);
          lp.connect(g);
          g.connect(out);
          src.stop(t + 4.2);
        };
        loop(made, thunder, () => 6000 + Math.random() * 8000);
        return made;
      },
    },
    vagues: {
      ico: "🌊",
      label: "Vagues",
      make(c, out) {
        // Chaque vague : une montée (la vague arrive), un sommet, puis un retrait.
        // Durée, hauteur et son changent un peu à chaque vague, pour ne pas être régulier.
        const src = noise(c);
        const lp = filter(c, "lowpass", 400, 0.7);
        const g = c.createGain();
        g.gain.value = 0.02;
        src.connect(lp);
        lp.connect(g);
        g.connect(out);
        const made = { nodes: [src], timers: [] };
        let cursor = ctx.currentTime + 0.05; // début de la vague suivante
        const wave = () => {
          const period = 5 + Math.random() * 5; // 5 à 10 secondes entre deux vagues
          const crest = 0.6 + Math.random() * 0.4; // hauteur du sommet, entre 0,6 et 1
          const start = cursor;
          const top = start + period * (0.35 + Math.random() * 0.2); // moment du sommet
          const end = start + period;
          g.gain.setValueAtTime(0.02, start);
          g.gain.linearRampToValueAtTime(crest, top);
          g.gain.linearRampToValueAtTime(0.02, end);
          // Le son devient plus clair au sommet, comme l'écume qui éclate
          lp.frequency.setValueAtTime(300, start);
          lp.frequency.linearRampToValueAtTime(300 + 900 * crest, top);
          lp.frequency.linearRampToValueAtTime(300, end);
          cursor = end;
        };
        // On prépare les vagues une seconde à l'avance, en gardant le rythme
        const ahead = () => {
          if (cursor - ctx.currentTime < 12) wave();
        };
        loop(made, ahead, () => 2000);
        return made;
      },
    },
    vent: {
      ico: "🍃",
      label: "Vent",
      make(c, out) {
        const src = noise(c);
        const bp = filter(c, "bandpass", 500, 0.8);
        const g = c.createGain();
        g.gain.value = 0.4;
        const o = lfo(c, 0.15, 250, bp.frequency); // le ton du vent bouge doucement
        src.connect(bp);
        bp.connect(g);
        g.connect(out);
        return { nodes: [src, o], timers: [] };
      },
    },
    feu: {
      ico: "🔥",
      label: "Feu de bois",
      make(c, out) {
        const rumble = noise(c);
        const lp = filter(c, "lowpass", 300);
        const g = c.createGain();
        g.gain.value = 0.08;
        rumble.connect(lp);
        lp.connect(g);
        g.connect(out);
        const made = { nodes: [rumble], timers: [] };
        // Petits « crac » courts et aléatoires
        const crackle = () => {
          const len = Math.floor(c.sampleRate * (0.01 + Math.random() * 0.02));
          const buf = c.createBuffer(1, len, c.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
          const s = c.createBufferSource();
          s.buffer = buf;
          s.playbackRate.value = 0.7 + Math.random() * 0.8;
          const cg = c.createGain();
          cg.gain.value = 0.5 + Math.random() * 0.5;
          s.connect(cg);
          cg.connect(out);
          s.start();
        };
        loop(made, crackle, () => 40 + Math.random() * 220);
        return made;
      },
    },
  };

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = KA.settings.get("bruitsVol", 0.6);
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function start(id) {
    if (KA.quiet || !ensureAudio()) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE);
    out.connect(master);
    const made = SOUNDS[id].make(ctx, out);
    playing.set(id, {
      stop() {
        made.timers.forEach((cancel) => cancel()); // arrête les boucles (gouttes, vagues…)
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(out.gain.value, t);
        out.gain.linearRampToValueAtTime(0, t + FADE);
        setTimeout(() => {
          made.nodes.forEach((n) => {
            try {
              n.stop();
            } catch (e) {
              /* déjà arrêté */
            }
          });
          out.disconnect();
        }, (FADE + 0.1) * 1000);
      },
    });
  }

  function stop(id) {
    const p = playing.get(id);
    if (p) {
      p.stop();
      playing.delete(id);
    }
  }

  function stopAll() {
    Array.from(playing.keys()).forEach(stop);
    clearSleep();
    refresh();
  }

  // Un seul bruit à la fois : en choisir un arrête le précédent
  function toggle(id) {
    if (playing.has(id)) {
      stop(id);
    } else {
      Array.from(playing.keys()).forEach(stop);
      start(id);
    }
    refresh();
  }

  // ---------- Minuteur de sommeil ----------
  function clearSleep() {
    clearTimeout(sleepTimer);
    clearInterval(sleepTick);
    sleepTimer = null;
    sleepTick = null;
    sleepEnd = 0;
    showTimer();
  }

  function setSleep(minutes) {
    clearSleep();
    sleepEnd = Date.now() + minutes * 60000;
    sleepTimer = setTimeout(() => {
      stopAll();
      KA.speak("Bonne nuit");
    }, minutes * 60000);
    sleepTick = setInterval(showTimer, 30000);
    showTimer();
  }

  function showTimer() {
    if (!timerInfo) return;
    if (!sleepEnd) {
      timerInfo.textContent = "";
      return;
    }
    const min = Math.max(1, Math.ceil((sleepEnd - Date.now()) / 60000));
    timerInfo.textContent = "⏰ Arrêt dans " + min + " min";
  }

  // ---------- Affichage ----------
  function refresh() {
    grid.querySelectorAll(".bruit-btn").forEach((b) => {
      b.classList.toggle("active", playing.has(b.dataset.sound));
      b.setAttribute("aria-pressed", playing.has(b.dataset.sound) ? "true" : "false");
    });
  }

  KA.panels.bruits = {
    init(root) {
      grid = root.querySelector("#bruits-grid");
      timerInfo = root.querySelector("#bruits-timer");
      volumeEl = root.querySelector("#bruits-volume");
      volumeEl.value = KA.settings.get("bruitsVol", 0.6);
      volumeEl.addEventListener("input", () => {
        const v = Number(volumeEl.value);
        KA.settings.set("bruitsVol", v);
        if (master) master.gain.value = v;
      });
      Object.keys(SOUNDS).forEach((id) => {
        const b = document.createElement("button");
        b.className = "bruit-btn";
        b.dataset.sound = id;
        const ico = document.createElement("span");
        ico.className = "bruit-ico";
        ico.textContent = SOUNDS[id].ico;
        const name = document.createElement("span");
        name.textContent = SOUNDS[id].label;
        b.append(ico, name);
        b.addEventListener("click", () => toggle(id));
        grid.appendChild(b);
      });
      root.querySelectorAll("[data-sleep]").forEach((b) => {
        b.addEventListener("click", () => setSleep(Number(b.dataset.sleep)));
      });
      root.querySelector("#bruits-stop").addEventListener("click", stopAll);
      refresh();
      showTimer();
    },
    enter() {
      refresh();
      showTimer();
    },
    // Pas d'arrêt à la sortie : le son continue pour la sieste
  };
})();
