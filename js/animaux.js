/* Panneau Animaux : deux modes.
   « Écouter » : un appui sur un animal fait entendre son cri.
   « Devine » : on entend un cri, il faut toucher le bon animal parmi trois.
   Les sons sont dans sounds/animaux/ (libres de droits, voir LICENCES.txt). */
(function () {
  "use strict";

  const KA = window.KA;
  const ANIMALS = [
    { name: "chat", art: "le", ico: "🐱", cri: "miaou", file: "chat.ogg" },
    { name: "chien", art: "le", ico: "🐶", cri: "ouaf", file: "chien.ogg" },
    { name: "vache", art: "la", ico: "🐮", cri: "meuh", file: "vache.ogg" },
    { name: "canard", art: "le", ico: "🦆", cri: "coin coin", file: "canard.mp3" },
    { name: "cochon", art: "le", ico: "🐷", cri: "groin groin", file: "cochon.ogg" },
    { name: "mouton", art: "le", ico: "🐑", cri: "bêê", file: "mouton.ogg" },
    { name: "cheval", art: "le", ico: "🐴", cri: "hihan", file: "cheval.ogg" },
    { name: "coq", art: "le", ico: "🐓", cri: "cocorico", file: "coq.ogg" },
  ];
  const CHOICES = 3;

  let mode = "listen";
  let grid = null;
  let msgEl = null;
  let againBtn = null;
  let audio = null;
  let target = null;
  let busy = false;
  let quizTimer = null;

  function stopSound() {
    if (audio) {
      audio.pause();
      audio = null;
    }
  }

  function playAnimal(a) {
    stopSound();
    if (KA.quiet) return; // pas pendant un enregistrement
    audio = new Audio("sounds/animaux/" + a.file);
    audio.play().catch(() => {
      msgEl.textContent = "Le son ne se lit pas";
    });
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function makeButton(a, label) {
    const b = document.createElement("button");
    b.className = "animal-btn";
    b.setAttribute("aria-label", label || a.name);
    const ico = document.createElement("span");
    ico.className = "animal-ico";
    ico.textContent = a.ico;
    b.appendChild(ico);
    if (mode === "listen") {
      const t = document.createElement("span");
      t.className = "animal-name";
      t.textContent = a.name;
      b.appendChild(t);
    }
    return b;
  }

  function renderListen() {
    grid.innerHTML = "";
    grid.classList.remove("quiz");
    againBtn.hidden = true;
    msgEl.textContent = "Touche un animal pour entendre son cri";
    ANIMALS.forEach((a) => {
      const b = makeButton(a);
      b.addEventListener("click", () => {
        msgEl.textContent = "Le " + a.name + " fait : " + a.cri;
        playAnimal(a);
      });
      grid.appendChild(b);
    });
  }

  function newQuestion() {
    clearTimeout(quizTimer);
    busy = false;
    target = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const others = shuffle(ANIMALS.filter((a) => a !== target)).slice(0, CHOICES - 1);
    const options = shuffle(others.concat([target]));
    grid.innerHTML = "";
    grid.classList.add("quiz");
    againBtn.hidden = false;
    msgEl.textContent = "Écoute bien… quel animal est-ce ?";
    options.forEach((a) => {
      const b = makeButton(a, "Animal");
      b.addEventListener("click", () => answer(b, a));
      grid.appendChild(b);
    });
    quizTimer = setTimeout(() => playAnimal(target), 300);
  }

  function answer(btn, a) {
    if (busy) return;
    if (a === target) {
      busy = true;
      btn.classList.add("ok");
      msgEl.textContent = "🎉 Bravo, c'est " + target.art + " " + target.name + " !";
      KA.speak("Bravo, c'est " + target.art + " " + target.name + " !");
      quizTimer = setTimeout(newQuestion, 2200);
    } else {
      btn.classList.add("bad");
      msgEl.textContent = "Essaie encore 🙂";
      KA.speak("Essaie encore");
      setTimeout(() => btn.classList.remove("bad"), 600);
    }
  }

  function setMode(m) {
    mode = m;
    modeBox.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    clearTimeout(quizTimer);
    stopSound();
    if (m === "listen") renderListen();
    else newQuestion();
  }

  let modeBox = null;

  KA.panels.animaux = {
    init(root) {
      grid = root.querySelector("#animaux-grid");
      msgEl = root.querySelector("#animaux-msg");
      againBtn = root.querySelector("#animaux-again");
      modeBox = root.querySelector("#animaux-modes");
      modeBox.querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
      againBtn.addEventListener("click", () => target && playAnimal(target));
      renderListen();
    },
    enter() {
      setMode(mode);
    },
    leave() {
      clearTimeout(quizTimer);
      stopSound();
    },
  };
})();
