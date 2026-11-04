/* Panneau Ombres : une image en couleur en haut, et trois ombres noires en bas.
   Il faut toucher l'ombre qui correspond à l'image. */
(function () {
  "use strict";

  const KA = window.KA;
  // [image, nom] : le nom sert à la phrase de félicitation
  const ITEMS = [
    ["🐱", "un chat"], ["🐶", "un chien"], ["🐸", "une grenouille"], ["🐘", "un éléphant"],
    ["🦁", "un lion"], ["🐟", "un poisson"], ["🚗", "une voiture"], ["🚀", "une fusée"],
    ["🏠", "une maison"], ["🌸", "une fleur"], ["🍎", "une pomme"], ["⚽", "un ballon"],
    ["🌙", "une lune"], ["⭐", "une étoile"], ["🐢", "une tortue"], ["🦋", "un papillon"],
    ["🚲", "un vélo"], ["🎂", "un gâteau"],
  ];
  const CHOICES = 3;

  let msgEl = null;
  let targetEl = null;
  let choicesEl = null;
  let nextTimer = null;
  let busy = false;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function newRound() {
    clearTimeout(nextTimer);
    busy = false;
    const picks = shuffle(ITEMS.slice()).slice(0, CHOICES);
    const target = picks[0];
    const options = shuffle(picks.slice());

    targetEl.textContent = target[0];
    choicesEl.innerHTML = "";
    options.forEach((item) => {
      const b = document.createElement("button");
      b.className = "ombre-choice";
      b.setAttribute("aria-label", "Ombre");
      const sil = document.createElement("span");
      sil.className = "ombre-sil";
      sil.textContent = item[0];
      b.appendChild(sil);
      b.addEventListener("click", () => answer(b, item === target, target[1]));
      choicesEl.appendChild(b);
    });
    msgEl.textContent = "Trouve la bonne ombre !";
    KA.speak("Trouve la bonne ombre");
  }

  function answer(btn, ok, name) {
    if (busy) return;
    if (ok) {
      busy = true;
      btn.classList.add("ok");
      msgEl.textContent = "🎉 Bravo, c'est " + name + " !";
      KA.speak("Bravo, c'est " + name + " !");
      nextTimer = setTimeout(newRound, 2000);
    } else {
      btn.classList.add("bad");
      msgEl.textContent = "Essaie encore 🙂";
      KA.speak("Essaie encore");
      setTimeout(() => btn.classList.remove("bad"), 600);
    }
  }

  KA.panels.ombres = {
    init(root) {
      msgEl = root.querySelector("#ombres-msg");
      targetEl = root.querySelector("#ombres-target");
      choicesEl = root.querySelector("#ombres-choices");
      root.querySelector("#ombres-new").addEventListener("click", newRound);
    },
    enter() {
      newRound();
    },
    leave() {
      clearTimeout(nextTimer);
    },
  };
})();
