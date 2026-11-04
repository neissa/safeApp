/* Panneau Couleurs : la voix demande une couleur (« Touche le rouge ! »), l'enfant touche la bonne
   parmi quatre cases. Une bonne réponse fait « Bravo » et une nouvelle question part. */
(function () {
  "use strict";

  const KA = window.KA;
  // article : « le », « la » ou « l' » devant le nom, pour la phrase lue à voix haute
  const COLORS = [
    { name: "rouge", art: "le ", bg: "#e53935" },
    { name: "bleu", art: "le ", bg: "#1e88e5" },
    { name: "jaune", art: "le ", bg: "#fdd835" },
    { name: "vert", art: "le ", bg: "#43a047" },
    { name: "orange", art: "l'", bg: "#fb8c00" },
    { name: "rose", art: "le ", bg: "#ec407a" },
  ];
  const CHOICES = 4;

  let promptEl = null;
  let msgEl = null;
  let choicesEl = null;
  let target = null;
  let busy = false;
  let nextTimer = null;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function ask() {
    promptEl.textContent = "Touche " + target.art + target.name + " !";
    KA.speak("Touche " + target.art + target.name + " !");
  }

  function newRound() {
    clearTimeout(nextTimer);
    busy = false;
    const options = shuffle(COLORS.slice()).slice(0, CHOICES);
    target = options[Math.floor(Math.random() * options.length)];
    choicesEl.innerHTML = "";
    options.forEach((c) => {
      const b = document.createElement("button");
      b.className = "color-btn";
      b.style.background = c.bg;
      b.setAttribute("aria-label", c.name);
      b.addEventListener("click", () => answer(b, c === target));
      choicesEl.appendChild(b);
    });
    msgEl.textContent = "";
    ask();
  }

  function answer(btn, ok) {
    if (busy) return;
    if (ok) {
      busy = true;
      btn.classList.add("ok");
      msgEl.textContent = "🎉 Bravo !";
      KA.speak("Bravo !");
      nextTimer = setTimeout(newRound, 1500);
    } else {
      btn.classList.add("bad");
      msgEl.textContent = "Essaie encore 🙂";
      KA.speak("Essaie encore");
      setTimeout(() => btn.classList.remove("bad"), 500);
    }
  }

  KA.panels.couleurs = {
    init(root) {
      promptEl = root.querySelector("#color-prompt");
      msgEl = root.querySelector("#color-msg");
      choicesEl = root.querySelector("#color-choices");
      root.querySelector("#color-again").addEventListener("click", () => {
        if (target) KA.speak("Touche " + target.art + target.name + " !");
      });
      root.querySelector("#color-new").addEventListener("click", newRound);
      newRound();
    },
    enter() {
      // Une nouvelle question à chaque ouverture, si la précédente est terminée
      if (busy) newRound();
    },
    leave() {
      clearTimeout(nextTimer);
      busy = true;
    },
  };
})();
