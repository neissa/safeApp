/* Panneau Puzzle : une grande image (un emoji sur fond coloré) coupée en morceaux, mélangés.
   On touche une case, puis une autre : les deux morceaux échangent leur place.
   Niveaux : 2 × 2 ou 3 × 3. Le puzzle est fini quand l'image est reconstituée. */
(function () {
  "use strict";

  const KA = window.KA;
  const SCENES = [
    { ico: "🦁", bg: "#ffe082" },
    { ico: "🚀", bg: "#b3e5fc" },
    { ico: "🏰", bg: "#d1c4e9" },
    { ico: "🦋", bg: "#c8e6c9" },
    { ico: "🐠", bg: "#b2ebf2" },
    { ico: "🍉", bg: "#ffcdd2" },
    { ico: "🌈", bg: "#fff9c4" },
    { ico: "🐸", bg: "#dcedc8" },
  ];
  const SIZES = [2, 3];

  let board = null;
  let msgEl = null;
  let levelBox = null;
  let sizeIndex = 0;
  let n = 2;
  let scene = null;
  let order = []; // order[slot] = numéro du morceau placé dans cette case
  let sel = null; // case choisie en premier

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function isSolved() {
    return order.every((p, i) => p === i);
  }

  function render() {
    board.innerHTML = "";
    board.style.setProperty("--n", n);
    board.style.background = scene.bg;
    order.forEach((p, slot) => {
      const b = document.createElement("button");
      b.className = "pz-slot" + (sel === slot ? " sel" : "");
      b.style.setProperty("--c", p % n);
      b.style.setProperty("--r", Math.floor(p / n));
      b.setAttribute("aria-label", "Morceau " + (slot + 1));
      const span = document.createElement("span");
      span.textContent = scene.ico;
      b.appendChild(span);
      b.addEventListener("click", () => tap(slot));
      board.appendChild(b);
    });
  }

  function tap(slot) {
    if (sel === null) {
      sel = slot;
    } else if (sel === slot) {
      sel = null;
    } else {
      const tmp = order[sel];
      order[sel] = order[slot];
      order[slot] = tmp;
      sel = null;
    }
    render();
    if (isSolved()) {
      msgEl.textContent = "🎉 Bravo, l'image est complète !";
      KA.speak("Bravo, tu as réussi le puzzle !");
    } else {
      msgEl.textContent = sel === null ? "Touche deux morceaux pour les échanger" : "Touche un autre morceau";
    }
  }

  function newGame() {
    n = SIZES[sizeIndex];
    scene = SCENES[Math.floor(Math.random() * SCENES.length)];
    order = [];
    for (let i = 0; i < n * n; i++) order.push(i);
    // Jamais déjà réussi au départ
    do {
      shuffle(order);
    } while (isSolved());
    sel = null;
    msgEl.textContent = "Touche deux morceaux pour les échanger";
    render();
  }

  function setSize(index) {
    sizeIndex = index;
    levelBox.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.level) === index));
    newGame();
  }

  KA.panels.puzzle = {
    init(root) {
      board = root.querySelector("#puzzle-board");
      msgEl = root.querySelector("#puzzle-msg");
      levelBox = root.querySelector("#puzzle-levels");
      SIZES.forEach((size, index) => {
        const b = document.createElement("button");
        b.className = "seg-btn";
        b.dataset.level = index;
        b.textContent = size + " × " + size;
        b.setAttribute("aria-label", "Puzzle " + size + " par " + size);
        b.addEventListener("click", () => setSize(index));
        levelBox.appendChild(b);
      });
      root.querySelector("#puzzle-new").addEventListener("click", newGame);
      setSize(sizeIndex);
    },
  };
})();
