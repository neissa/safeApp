/* Panneau Alphabet : une case par lettre. Un appui affiche la lettre, un mot qui commence par elle,
   son image, et le dit à voix haute (« A comme avion »). */
(function () {
  "use strict";

  const KA = window.KA;
  const LETTERS = [
    ["A", "avion", "✈️"], ["B", "ballon", "🎈"], ["C", "chat", "🐱"], ["D", "dauphin", "🐬"],
    ["E", "éléphant", "🐘"], ["F", "fraise", "🍓"], ["G", "girafe", "🦒"], ["H", "hibou", "🦉"],
    ["I", "île", "🏝️"], ["J", "jus", "🧃"], ["K", "koala", "🐨"], ["L", "lion", "🦁"],
    ["M", "maison", "🏠"], ["N", "nez", "👃"], ["O", "oiseau", "🐦"], ["P", "poisson", "🐟"],
    ["Q", "quille", "🎳"], ["R", "rose", "🌹"], ["S", "soleil", "☀️"], ["T", "tortue", "🐢"],
    ["U", "usine", "🏭"], ["V", "vache", "🐮"], ["W", "wagon", "🚃"], ["X", "xylophone", "🎵"],
    ["Y", "yaourt", "🥛"], ["Z", "zèbre", "🦓"],
  ];

  let card = null;
  let grid = null;

  function show(i) {
    const [letter, word, ico] = LETTERS[i];
    card.innerHTML = "";
    const big = document.createElement("div");
    big.className = "alpha-letter";
    big.textContent = letter + " " + letter.toLowerCase();
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
      LETTERS.forEach(([letter], i) => {
        const b = document.createElement("button");
        b.className = "alpha-btn";
        b.textContent = letter;
        b.setAttribute("aria-label", "Lettre " + letter);
        b.addEventListener("click", () => show(i));
        grid.appendChild(b);
      });
    },
    enter() {
      card.innerHTML = '<div class="alpha-hint">Touche une lettre 👆</div>';
    },
    leave() {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
  };
})();
