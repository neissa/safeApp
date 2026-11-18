/* Panneau Alphabet : une case par lettre. Un appui affiche la lettre, un mot qui commence par elle,
   son image, et le dit à voix haute (« A comme avion »). */
(function () {
  "use strict";

  const KA = window.KA;
  const LETTERS = [
    ["A", "avion", "✈️"], ["B", "ballon", "🎈"], ["C", "carotte", "🥕"], ["D", "dauphin", "🐬"],
    ["E", "éléphant", "🐘"], ["F", "fraise", "🍓"], ["G", "gâteau", "🎂"], ["H", "hibou", "🦉"],
    ["I", "île", "🏝️"], ["J", "jus", "🧃"], ["K", "koala", "🐨"], ["L", "lion", "🦁"],
    ["M", "maison", "🏠"], ["N", "nez", "👃"], ["O", "orange", "🍊"], ["P", "poisson", "🐟"],
    ["Q", "quille", "🎳"], ["R", "rose", "🌹"], ["S", "soleil", "☀️"], ["T", "tortue", "🐢"],
    ["U", "usine", "🏭"], ["V", "vache", "🐮"], ["W", "wifi", "📶"], ["X", "xylophone", "🎵"],
    ["Y", "yaourt", "🥛"], ["Z", "zèbre", "🦓"],
  ];

  const GAP = 6; // même écart que dans la feuille de style (.alpha-grid)

  let card = null;
  let grid = null;
  let fitBox = null; // zone « fit » qui entoure la grille : elle donne la place disponible

  // Choisit le nombre de colonnes qui donne les plus grandes cases dans la place libre
  function fitGrid() {
    if (!fitBox || !grid) return;
    const w = fitBox.clientWidth;
    const h = fitBox.clientHeight;
    if (!w || !h) return; // écran caché : on recalculera à l'affichage
    const n = LETTERS.length;
    let best = { cols: 1, size: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const size = Math.min((w - (cols - 1) * GAP) / cols, (h - (rows - 1) * GAP) / rows);
      if (size > best.size) best = { cols, size };
    }
    grid.style.setProperty("--cols", best.cols);
    grid.style.setProperty("--cell", Math.floor(best.size) + "px");
  }

  // Majuscule en écriture bâton + minuscule en écriture cursive (deux spans côte à côte)
  function letterPair(letter) {
    const up = document.createElement("span");
    up.className = "alpha-up";
    up.textContent = letter;
    const low = document.createElement("span");
    low.className = "alpha-low";
    low.textContent = letter.toLowerCase();
    return [up, low];
  }

  function show(i) {
    const [letter, word, ico] = LETTERS[i];
    card.innerHTML = "";
    const big = document.createElement("div");
    big.className = "alpha-letter";
    big.append(...letterPair(letter));
    const pic = document.createElement("div");
    pic.className = "alpha-pic";
    pic.textContent = ico;
    const name = document.createElement("div");
    name.className = "alpha-word";
    name.textContent = word;
    card.append(big, pic, name);
    KA.speak(letter + " comme " + word);
    grid.querySelectorAll(".alpha-btn").forEach((b, j) => b.classList.toggle("active", j === i));
  }

  KA.panels.alphabet = {
    init(root) {
      card = root.querySelector("#alpha-card");
      grid = root.querySelector("#alpha-grid");
      fitBox = grid.parentElement;
      LETTERS.forEach(([letter], i) => {
        const b = document.createElement("button");
        b.className = "alpha-btn";
        b.append(...letterPair(letter));
        b.setAttribute("aria-label", "Lettre " + letter);
        b.addEventListener("click", () => show(i));
        grid.appendChild(b);
      });
      // La place change quand la fenêtre bouge ou tourne : on recalcule seulement quand l'écran est affiché
      if ("ResizeObserver" in window) {
        new ResizeObserver(() => {
          if (root.classList.contains("active")) fitGrid();
        }).observe(fitBox);
      }
      fitGrid();
    },
    enter() {
      card.innerHTML = '<div class="alpha-hint">Touche une lettre 👆</div>';
      fitGrid();
    },
    leave() {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
  };
})();
