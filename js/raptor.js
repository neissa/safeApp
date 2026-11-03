/* Effet « Raptorize » en JavaScript pur (sans jQuery) : quinze appuis rapides sur l'icône de l'accueil
   font traverser l'écran à un dinosaure avec un rugissement. */
(function () {
  "use strict";

  const KA = window.KA;
  const TRIGGER_TAPS = 15;
  const TRIGGER_WINDOW_MS = 3000;
  let busy = false;

  // Le cri d'origine de Raptorize (sounds/raptor-sound.mp3, licence MIT : voir sounds/RAPTORIZE-LICENSE.txt)
  function roar() {
    if (KA.quiet || !KA.settings.get("sounds", true)) return;
    const audio = new Audio("sounds/raptor-sound.mp3");
    audio.play().catch(() => synthRoar());
  }

  // Rugissement de secours, synthétisé : une voix grave qui descend, mêlée d'un souffle rauque
  function synthRoar() {
    try {
      if (KA.quiet || !KA.settings.get("sounds", true)) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const t = ctx.currentTime;
      const dur = 1.4;

      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 1.2);

      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 400;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.35;

      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
      out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(out);
      noise.connect(band);
      band.connect(noiseGain);
      noiseGain.connect(out);
      out.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + dur);
      noise.start(t);
      noise.stop(t + dur);
      setTimeout(() => ctx.close().catch(() => {}), (dur + 0.3) * 1000);
    } catch (e) {
      /* audio indisponible */
    }
  }

  // Le dinosaure traverse l'écran (l'animation est dans css/style.css)
  function raptorize() {
    if (busy) return;
    const app = document.getElementById("app");
    if (!app) return;
    busy = true;
    const dino = document.createElement("div");
    dino.className = "raptor";
    dino.setAttribute("aria-hidden", "true");
    dino.textContent = "🦖";
    app.appendChild(dino);
    roar();
    dino.addEventListener(
      "animationend",
      () => {
        dino.remove();
        busy = false;
      },
      { once: true }
    );
  }

  KA.raptorize = raptorize;

  document.addEventListener("DOMContentLoaded", () => {
    const icon = document.getElementById("home-icon");
    if (icon) KA.tap(icon, TRIGGER_TAPS, raptorize, TRIGGER_WINDOW_MS);
  });
})();
