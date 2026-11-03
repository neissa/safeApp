/* Panneau Minuteur : compte à rebours avec des durées rapides (1 min, 5 min, 10 min, 30 min, 1 h).
   Le décompte continue même si l'on change de panneau. À la fin : alarme et annonce vocale. */
(function () {
  "use strict";

  const KA = window.KA;
  const PRESETS = [
    { label: "une minute", minutes: 1 },
    { label: "5 minutes", minutes: 5 },
    { label: "10 minutes", minutes: 10 },
    { label: "30 minutes", minutes: 30 },
    { label: "une heure", minutes: 60 },
  ];
  const ALARM_BEEPS = 6;

  const st = {
    total: 5 * 60000, // durée choisie, en millisecondes
    remaining: 5 * 60000,
    running: false,
    endAt: 0,
    timer: null,
  };
  let display = null;
  let arc = null; // anneau de progression
  const RING_LENGTH = 2 * Math.PI * 52; // circonférence du cercle (rayon 52)
  let toggleBtn = null;
  let msgEl = null;
  let presetBox = null;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function format(ms) {
    const s = Math.ceil(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? h + ":" + pad(m) + ":" + pad(sec) : pad(m) + ":" + pad(sec);
  }

  function render() {
    display.textContent = format(st.remaining);
    const frac = st.total ? Math.max(0, st.remaining / st.total) : 0;
    arc.style.strokeDashoffset = (RING_LENGTH * (1 - frac)).toFixed(2);
    arc.style.stroke = frac > 0.5 ? "#66bb6a" : frac > 0.2 ? "#ffb300" : "#ef5350";
    toggleBtn.textContent = st.running ? "⏸️ Pause" : "▶️ Démarrer";
    presetBox.querySelectorAll(".timer-preset").forEach((b) => {
      b.classList.toggle("on", Number(b.dataset.minutes) * 60000 === st.total);
    });
  }

  function stopTicking() {
    clearInterval(st.timer);
    st.timer = null;
  }

  function finish() {
    stopTicking();
    st.running = false;
    st.remaining = 0;
    render();
    msgEl.textContent = "⏰ C'est fini !";
    display.classList.add("ring");
    setTimeout(() => display.classList.remove("ring"), 2400);
    KA.speak("Le temps est écoulé !");
    // Alarme : une série de bips
    for (let i = 0; i < ALARM_BEEPS; i++) {
      setTimeout(() => KA.tone(880, 0.35, "square", 0.25), i * 450);
    }
  }

  function tick() {
    if (!st.running) return;
    st.remaining = Math.max(0, st.endAt - Date.now());
    if (st.remaining <= 0) {
      finish();
      return;
    }
    render();
  }

  function start() {
    if (st.remaining <= 0) st.remaining = st.total;
    st.endAt = Date.now() + st.remaining;
    st.running = true;
    msgEl.textContent = "";
    stopTicking();
    st.timer = setInterval(tick, 250);
    render();
  }

  function pause() {
    st.remaining = Math.max(0, st.endAt - Date.now());
    st.running = false;
    stopTicking();
    render();
  }

  function reset() {
    stopTicking();
    st.running = false;
    st.remaining = st.total;
    msgEl.textContent = "";
    render();
  }

  function setPreset(minutes) {
    stopTicking();
    st.total = minutes * 60000;
    st.remaining = st.total;
    st.running = false;
    msgEl.textContent = "";
    render();
    KA.speak(PRESETS.find((p) => p.minutes === minutes).label);
  }

  KA.panels.timer = {
    init(root) {
      display = root.querySelector("#timer-display");
      arc = root.querySelector("#timer-arc");
      toggleBtn = root.querySelector("#timer-toggle");
      msgEl = root.querySelector("#timer-msg");
      presetBox = root.querySelector("#timer-presets");

      PRESETS.forEach((p) => {
        const b = document.createElement("button");
        b.className = "timer-preset";
        b.dataset.minutes = p.minutes;
        b.textContent = p.label;
        b.setAttribute("aria-label", "Minuteur " + p.label);
        b.addEventListener("click", () => setPreset(p.minutes));
        presetBox.appendChild(b);
      });

      toggleBtn.addEventListener("click", () => (st.running ? pause() : start()));
      root.querySelector("#timer-reset").addEventListener("click", reset);
      render();
    },
    enter() {
      render();
    },
  };
})();
