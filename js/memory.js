/* Panneau Memory : retourner deux cartes à la fois et trouver les paires identiques.
   Quatre niveaux, en colonnes × lignes : 3×2, 4×4, 5×4, 6×6. Toutes les cartes vont par paire. */
(function () {
  "use strict";

  const KA = window.KA;
  const LEVELS = [
    { cols: 3, rows: 2 },
    { cols: 4, rows: 4 },
    { cols: 5, rows: 4 },
    { cols: 6, rows: 6 },
  ];
  const DEFAULT_LEVEL = 1; // 4 × 4
  const EMOJIS = [
    "🐶", "🐱", "🐸", "🦊", "🐼", "🐵", "🦁", "🐷", "🐮", "🐰",
    "🐻", "🐨", "🐯", "🐙", "🐠", "🦋", "🐝", "🐞", "🦄",
  ];

  let board = null;
  let movesEl = null;
  let msgEl = null;
  let levelBox = null;
  let levelIndex = DEFAULT_LEVEL;
  let cards = [];
  let first = null; // index de la première carte retournée
  let lock = false; // vrai pendant la vérification d'une paire
  let moves = 0;
  let matched = 0;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function render() {
    board.innerHTML = "";
    cards.forEach((c, i) => {
      const b = document.createElement("button");
      const up = c.flipped || c.matched;
      b.className = "card" + (up ? " up" : "") + (c.matched ? " matched" : "");
      b.textContent = up ? c.emoji : "❔";
      b.dataset.silent = "";
      b.setAttribute("aria-label", up ? "Carte retournée" : "Carte cachée");
      b.addEventListener("click", () => flip(i));
      board.appendChild(b);
    });
    movesEl.textContent = "Coups : " + moves;
  }

  function checkWin() {
    if (matched === cards.length) {
      msgEl.textContent = "🎉 Bravo, tu as tout trouvé en " + moves + " coups !";
      KA.speak("Bravo, tu as gagné !");
    }
  }

  function newGame() {
    const level = LEVELS[levelIndex];
    const pairs = (level.cols * level.rows) / 2;
    const deck = [];
    shuffle(EMOJIS.slice())
      .slice(0, pairs)
      .forEach((e) => {
        deck.push({ emoji: e });
        deck.push({ emoji: e });
      });
    cards = shuffle(deck).map((c) => Object.assign({ flipped: false, matched: false }, c));
    first = null;
    lock = false;
    moves = 0;
    matched = 0;
    msgEl.textContent = "";
    board.style.setProperty("--cols", level.cols);
    board.style.setProperty("--rows", level.rows);
    render();
  }

  function flip(i) {
    const c = cards[i];
    if (lock || c.flipped || c.matched) return;

    c.flipped = true;
    KA.tone(660, 0.12, "sine", 0.2);

    if (first === null) {
      first = i;
      render();
      return;
    }

    const a = cards[first];
    const second = i;
    moves += 1;
    render();
    lock = true;

    if (a.emoji === c.emoji) {
      a.matched = true;
      c.matched = true;
      matched += 2;
      first = null;
      lock = false;
      KA.tone(880, 0.25, "triangle", 0.3);
      KA.speak("Bravo !");
      render();
      checkWin();
    } else {
      KA.tone(220, 0.15, "triangle", 0.2);
      setTimeout(() => {
        a.flipped = false;
        cards[second].flipped = false;
        first = null;
        lock = false;
        render();
      }, 900);
    }
  }

  function setLevel(index) {
    levelIndex = index;
    levelBox.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.level) === index));
    newGame();
  }

  KA.panels.memory = {
    init(root) {
      board = root.querySelector("#memory-grid");
      movesEl = root.querySelector("#memory-moves");
      msgEl = root.querySelector("#memory-msg");
      levelBox = root.querySelector("#memory-levels");

      LEVELS.forEach((level, index) => {
        const b = document.createElement("button");
        b.className = "seg-btn";
        b.dataset.level = index;
        b.textContent = level.cols + " × " + level.rows;
        b.setAttribute("aria-label", "Niveau " + level.cols + " colonnes par " + level.rows + " lignes");
        b.addEventListener("click", () => setLevel(index));
        levelBox.appendChild(b);
      });
      root.querySelector("#memory-new").addEventListener("click", newGame);
      setLevel(levelIndex);
    },
  };
})();
