/* Panneau Piano : un clavier avec huit touches blanches et cinq touches noires (une octave).
   Piano libre, ou jeu Simon : l'appli joue une suite de notes en éclairant les touches blanches,
   l'enfant la répète. Chaque suite réussie ajoute une note. */
(function () {
  "use strict";

  const KA = window.KA;
  // Touches blanches : do, ré, mi, fa, sol, la, si, do
  const WHITE = [
    { name: "Do", freq: 261.63 },
    { name: "Ré", freq: 293.66 },
    { name: "Mi", freq: 329.63 },
    { name: "Fa", freq: 349.23 },
    { name: "Sol", freq: 392.0 },
    { name: "La", freq: 440.0 },
    { name: "Si", freq: 493.88 },
    { name: "Do", freq: 523.25 },
  ];
  // Touches noires : placées après la touche blanche d'indice « after »
  const BLACK = [
    { after: 0, freq: 277.18 },
    { after: 1, freq: 311.13 },
    { after: 3, freq: 369.99 },
    { after: 4, freq: 415.3 },
    { after: 5, freq: 466.16 },
  ];
  const SHOW_GAP = 650; // délai entre deux notes de la suite
  const LIGHT_MS = 380; // durée d'éclairage d'une touche

  const sim = {
    on: false,
    seq: [], // indices des touches à retenir
    pos: 0, // position dans la suite pendant que l'enfant joue
    phase: "idle", // idle | show | input | wait
    timers: [],
  };
  let whiteEls = [];
  let statusEl = null;
  let bestEl = null;
  let simonBtn = null;

  function play(btn, freq) {
    KA.tone(freq, 0.9, "triangle", 0.35);
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 180);
  }

  function later(fn, ms) {
    sim.timers.push(setTimeout(fn, ms));
  }

  function clearTimers() {
    sim.timers.forEach(clearTimeout);
    sim.timers = [];
  }

  function light(i, ms) {
    const el = whiteEls[i];
    el.classList.add("lit");
    KA.tone(WHITE[i].freq, 0.45, "triangle", 0.3);
    later(() => el.classList.remove("lit"), ms || LIGHT_MS);
  }

  function showBest() {
    bestEl.textContent = "Record : " + KA.settings.get("simonBest", 0);
  }

  function recordBest(n) {
    if (n > KA.settings.get("simonBest", 0)) KA.settings.set("simonBest", n);
    showBest();
  }

  // Joue la suite entière, puis laisse l'enfant répondre
  function showSequence() {
    sim.phase = "show";
    statusEl.textContent = "Écoute bien…";
    sim.seq.forEach((k, n) => later(() => light(k), 400 + n * SHOW_GAP));
    later(() => {
      sim.phase = "input";
      sim.pos = 0;
      statusEl.textContent = "À toi de jouer !";
    }, 400 + sim.seq.length * SHOW_GAP);
  }

  function newRound() {
    sim.seq.push(Math.floor(Math.random() * WHITE.length));
    showSequence();
  }

  function startGame() {
    clearTimers();
    sim.on = true;
    sim.seq = [];
    simonBtn.textContent = "⏹️ Arrêter Simon";
    newRound();
  }

  function stopGame(msg) {
    clearTimers();
    sim.on = false;
    sim.phase = "idle";
    simonBtn.textContent = "🎲 Jouer à Simon";
    statusEl.textContent = msg || "";
  }

  // Une touche blanche pendant le jeu
  function answer(i) {
    light(i, 250);
    if (i === sim.seq[sim.pos]) {
      sim.pos += 1;
      if (sim.pos === sim.seq.length) {
        const done = sim.seq.length;
        recordBest(done);
        sim.phase = "wait";
        statusEl.textContent = "Bravo ! " + done + " note" + (done > 1 ? "s" : "") + " !";
        KA.speak("Bravo !");
        later(newRound, 1100);
      }
    } else {
      const score = sim.seq.length - 1;
      KA.speak("Oups !");
      stopGame(
        "Tu as réussi " + score + " note" + (score > 1 ? "s" : "") + ". Rejoue pour battre ton record !"
      );
    }
  }

  KA.panels.piano = {
    init(root) {
      const wrap = root.querySelector("#piano-keys");
      statusEl = root.querySelector("#simon-status");
      bestEl = root.querySelector("#simon-best");
      simonBtn = root.querySelector("#simon-btn");
      showBest();

      const board = document.createElement("div");
      board.className = "keyboard";
      const area = document.createElement("div");
      area.className = "keys-area";

      WHITE.forEach((n, i) => {
        const b = document.createElement("button");
        b.className = "white-key";
        b.textContent = n.name;
        b.dataset.silent = "";
        b.setAttribute("aria-label", n.name);
        b.addEventListener("click", () => {
          if (sim.on) {
            if (sim.phase === "input") answer(i);
            return; // pendant Simon, pas de piano libre
          }
          play(b, n.freq);
        });
        whiteEls.push(b);
        area.appendChild(b);
      });

      // Chaque touche noire est centrée sur la jointure entre deux touches blanches
      const step = 100 / WHITE.length;
      BLACK.forEach((n) => {
        const b = document.createElement("button");
        b.className = "black-key";
        b.style.left = (n.after + 1) * step - step * 0.28 + "%";
        b.dataset.silent = "";
        b.setAttribute("aria-label", "Touche noire");
        b.addEventListener("click", () => {
          if (!sim.on) play(b, n.freq);
        });
        area.appendChild(b);
      });

      board.appendChild(area);
      wrap.appendChild(board);

      simonBtn.addEventListener("click", () => (sim.on ? stopGame("") : startGame()));
    },
    leave() {
      if (sim.on) stopGame("");
    },
  };
})();
