/* Panneau « Bruits de pet » : une case par son, et un bouton pour en tirer un au hasard.
   Les sons sont dans sounds/farts/. Un appui de l'enfant joue toujours le son, même si
   « Bruitages » est coupé dans le menu parent (la tuile se cache depuis le menu parent). */
(function () {
  "use strict";

  const KA = window.KA;
  // Un emoji par son, pour que les petits puissent les reconnaître
  const FARTS = [
    { file: "apebble-fart-2-228242.mp3", ico: "💨" },
    { file: "apebble-fart-3-228243.mp3", ico: "😂" },
    { file: "apebble-fart-4-228244.mp3", ico: "🤭" },
    { file: "apebble-fart-5-228245.mp3", ico: "😜" },
    { file: "apebble-fart-6-228246.mp3", ico: "🙈" },
    { file: "apebble-fart-8-228248.mp3", ico: "😮" },
    { file: "apebble-fart-9-228249.mp3", ico: "🤪" },
    { file: "apebble-fart-10-228250.mp3", ico: "😆" },
    { file: "freesound_community-fart-3-89567.mp3", ico: "🎺" },
  ];

  let audio = null;
  let last = -1;
  let msgEl = null; // dit à l'écran si le son ne peut pas se lire

  function stop() {
    if (audio) {
      audio.pause();
      audio = null;
    }
  }

  function play(i) {
    last = i;
    stop();
    if (KA.quiet) return; // pas pendant un enregistrement
    audio = new Audio("sounds/farts/" + FARTS[i].file);
    if (msgEl) msgEl.textContent = "";
    audio.play().catch((e) => {
      if (msgEl) msgEl.textContent = "Le son ne se lit pas (" + (e && e.name ? e.name : "erreur") + ")";
    });
  }

  function playRandom() {
    let i = Math.floor(Math.random() * FARTS.length);
    // Pas deux fois de suite le même son
    if (FARTS.length > 1 && i === last) i = (i + 1) % FARTS.length;
    play(i);
  }

  KA.panels.farts = {
    init(root) {
      const grid = root.querySelector("#farts-grid");
      msgEl = root.querySelector("#farts-msg");
      FARTS.forEach((f, i) => {
        const b = document.createElement("button");
        b.className = "fart-btn";
        b.dataset.silent = "";
        b.textContent = f.ico;
        b.setAttribute("aria-label", "Pet " + (i + 1));
        b.addEventListener("click", () => play(i));
        grid.appendChild(b);
      });
      root.querySelector("#farts-random").addEventListener("click", playRandom);
    },
    leave() {
      stop();
    },
  };
})();
