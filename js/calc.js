/* Panneau « Nombre » : calculatrice classique, et jeu avec des objets à l'écran.
   Le jeu propose de compter les objets, ou de calculer avec des objets. */
(function () {
  "use strict";

  const KA = window.KA;
  // Ordre des touches dans la grille (la touche "=" occupe deux lignes)
  const KEYS = ["C", "⌫", "÷", "×", "7", "8", "9", "−", "4", "5", "6", "+", "1", "2", "3", "=", "0", "."];
  const OPS = ["+", "−", "×", "÷"];
  const MAX_DIGITS = 12;
  const OBJECTS = ["🍎", "⭐", "🐟", "🎈", "🚗", "🌸"];
  const st = { current: "0", prev: null, op: null, fresh: true };
  const game = { kind: "count", stars: 0, answer: 0, busy: false, locked: false, playing: false };
  let displayEl = null;
  let keysEl = null;
  let modeBtn = null;
  let gameBox = null;
  let lockEl = null;
  let lockTimer = null;
  // Après une mauvaise réponse, on ne peut plus appuyer pendant un court moment
  const WRONG_WAIT_MS = 2000;

  // Nom vocal de chaque touche
  const KEY_NAMES = {
    "+": "plus",
    "−": "moins",
    "×": "fois",
    "÷": "divisé par",
    ".": "virgule",
    "=": "égal",
    C: "tout effacer",
    "⌫": "effacer",
  };
  for (let d = 0; d <= 9; d++) KEY_NAMES[String(d)] = KA.frNumber(d);

  // Lit une valeur en lettres : « 3.5 » -> « trois virgule cinq »
  function valueWords(s) {
    const neg = s.startsWith("-");
    const body = neg ? s.slice(1) : s;
    const parts = body.split(".");
    let out = KA.frNumber(parseInt(parts[0], 10));
    if (parts[1]) {
      out += " virgule " + parts[1].split("").map((c) => KA.frNumber(Number(c))).join(" ");
    }
    return (neg ? "moins " : "") + out;
  }

  // ---------- Calculatrice ----------
  function show() {
    displayEl.textContent = st.current;
  }

  function reset() {
    st.current = "0";
    st.prev = null;
    st.op = null;
    st.fresh = true;
  }

  // Renvoie false si le calcul est impossible (division par zéro)
  function compute() {
    if (st.op === null || st.prev === null) return true;
    const a = st.prev;
    const b = parseFloat(st.current);
    let r = null;
    switch (st.op) {
      case "+":
        r = a + b;
        break;
      case "−":
        r = a - b;
        break;
      case "×":
        r = a * b;
        break;
      case "÷":
        r = b === 0 ? null : a / b;
        break;
    }
    if (r === null || !Number.isFinite(r)) {
      reset();
      KA.speak("Oh non, on ne peut pas diviser par zéro");
      return false;
    }
    st.current = String(Number(r.toPrecision(12)));
    return true;
  }

  function press(key) {
    let ok = true;

    if (/^\d$/.test(key)) {
      if (st.fresh || st.current === "0") st.current = key;
      else if (st.current.length < MAX_DIGITS) st.current += key;
      st.fresh = false;
    } else if (key === ".") {
      if (st.fresh) st.current = "0.";
      else if (!st.current.includes(".")) st.current += ".";
      st.fresh = false;
    } else if (key === "C") {
      reset();
    } else if (key === "⌫") {
      if (!st.fresh) {
        let next = st.current.slice(0, -1);
        if (next === "" || next === "-") next = "0";
        st.current = next;
      }
    } else if (key === "=") {
      if (st.op !== null) {
        ok = compute();
        st.op = null;
        st.prev = null;
        st.fresh = true;
      }
    } else if (OPS.includes(key)) {
      if (st.op !== null && !st.fresh) ok = compute();
      if (!ok) {
        show();
        return;
      }
      st.prev = parseFloat(st.current);
      st.op = key;
      st.fresh = true;
    }

    show();
    if (!ok) return; // le message d'erreur a déjà été lu

    if (key === "=") KA.speak(KEY_NAMES["="] + " " + valueWords(st.current));
    else KA.speak(KEY_NAMES[key]);
  }

  function buildKeys() {
    KEYS.forEach((k) => {
      const b = document.createElement("button");
      b.className = "key";
      b.textContent = k;
      if (OPS.includes(k)) b.classList.add("op");
      if (k === "C" || k === "⌫") b.classList.add("clr");
      if (k === "=") b.classList.add("eq");
      if (k === "0") b.classList.add("zero");
      b.setAttribute("aria-label", KEY_NAMES[k]);
      b.addEventListener("click", () => press(k));
      keysEl.appendChild(b);
    });
  }

  // ---------- Jeu : objets à l'écran ----------
  function rnd(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Un groupe d'objets
  function group(count, icon) {
    const g = document.createElement("span");
    g.className = "game-group";
    for (let i = 0; i < count; i++) {
      const o = document.createElement("span");
      o.className = "game-obj";
      o.textContent = icon;
      g.appendChild(o);
    }
    return g;
  }

  function sign(text) {
    const s = document.createElement("span");
    s.className = "game-sign";
    s.textContent = text;
    return s;
  }

  // Trois réponses proposées, dont la bonne, sans doublon
  function showChoices(min, max) {
    const choices = new Set([game.answer]);
    while (choices.size < 3) {
      const wrong = game.answer + rnd(-3, 3);
      if (wrong >= min && wrong <= max && wrong !== game.answer) choices.add(wrong);
    }
    const box = document.getElementById("game-choices");
    box.innerHTML = "";
    shuffle(Array.from(choices)).forEach((n) => {
      const b2 = document.createElement("button");
      b2.className = "game-choice";
      b2.textContent = String(n);
      b2.setAttribute("aria-label", KA.frNumber(n));
      b2.addEventListener("click", () => answer(n, b2));
      box.appendChild(b2);
    });
  }

  // Compter : on voit des objets, on dit combien il y en a
  function countQuestion() {
    const n = rnd(1, 10);
    game.answer = n;
    const icon = OBJECTS[rnd(0, OBJECTS.length - 1)];
    const scene = document.getElementById("game-scene");
    scene.innerHTML = "";
    scene.appendChild(group(n, icon));
    showChoices(1, 10);
    KA.speak("Combien y a-t-il d'objets ?");
  }

  // Calculer : deux groupes d'objets, plus ou moins
  function addQuestion() {
    const plus = Math.random() < 0.5;
    let a;
    let b;
    // Pas de calcul avec 0 : chaque groupe a au moins un objet, et le résultat est toujours d'au moins 1
    if (plus) {
      a = rnd(1, 9);
      b = rnd(1, 10 - a);
    } else {
      a = rnd(2, 10);
      b = rnd(1, a - 1);
    }
    game.answer = plus ? a + b : a - b;
    const icon = OBJECTS[rnd(0, OBJECTS.length - 1)];

    const scene = document.getElementById("game-scene");
    scene.innerHTML = "";
    scene.append(group(a, icon), sign(plus ? "+" : "−"), group(b, icon));
    showChoices(1, 10);

    KA.speak("Combien font " + KA.frNumber(a) + (plus ? " plus " : " moins ") + KA.frNumber(b) + " ?");
  }

  function newQuestion() {
    game.busy = false;
    if (game.kind === "count") countQuestion();
    else addQuestion();
  }

  function lockFor(ms) {
    game.locked = true;
    lockEl.hidden = false;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(unlock, ms);
  }

  function unlock() {
    game.locked = false;
    lockEl.hidden = true;
  }

  function answer(n, btn) {
    if (game.busy || game.locked) return;
    if (n === game.answer) {
      game.busy = true;
      game.stars += 1;
      btn.classList.add("right");
      KA.speak("Bravo !");
      updateStars();
      setTimeout(() => {
        if (game.playing) newQuestion();
      }, 1600);
    } else {
      btn.classList.remove("shake");
      void btn.offsetWidth; // relance l'animation
      btn.classList.add("shake");
      KA.speak("Essaie encore");
      lockFor(WRONG_WAIT_MS);
    }
  }

  function updateStars() {
    const shown = Math.min(game.stars, 20);
    document.getElementById("game-stars").textContent =
      shown ? "⭐".repeat(shown) + (game.stars > 20 ? " +" + (game.stars - 20) : "") : "Trouve la réponse pour gagner une étoile";
  }

  function setKind(kind) {
    game.kind = kind;
    document.getElementById("game-count").classList.toggle("on", kind === "count");
    document.getElementById("game-add").classList.toggle("on", kind === "add");
    if (game.playing) newQuestion();
  }

  function setGame(on) {
    game.playing = on;
    keysEl.hidden = on;
    displayEl.hidden = on;
    gameBox.hidden = !on;
    modeBtn.textContent = on ? "🧮 Calculer" : "🎮 Jouer";
    if (!on) {
      clearTimeout(lockTimer);
      unlock();
    }
    if (on) {
      updateStars();
      newQuestion();
    }
  }

  KA.panels.calc = {
    init(root) {
      displayEl = root.querySelector("#calc-display");
      keysEl = root.querySelector("#calc-keys");
      modeBtn = root.querySelector("#calc-mode");
      gameBox = root.querySelector("#calc-game");
      lockEl = root.querySelector("#game-lock");
      buildKeys();
      root.querySelector("#calc-read").addEventListener("click", () => KA.speak(valueWords(st.current)));
      modeBtn.addEventListener("click", () => setGame(!game.playing));
      root.querySelector("#game-count").addEventListener("click", () => setKind("count"));
      root.querySelector("#game-add").addEventListener("click", () => setKind("add"));
      setKind(game.kind);
      show();
    },
    leave() {
      if (game.playing) setGame(false);
    },
  };
})();
