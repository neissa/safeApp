/* Deux jeux sans lecture : « Formes » (touche la forme demandée) et « L'intrus » (trouve l'image qui n'a rien à faire là).
   Les consignes sont dites à voix haute, et chaque bonne réponse donne une étoile. */
(function () {
  "use strict";

  const KA = window.KA;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function starText(n) {
    if (!n) return "Trouve la bonne réponse pour gagner une étoile";
    const shown = Math.min(n, 20);
    return "⭐".repeat(shown) + (n > 20 ? " +" + (n - 20) : "");
  }

  // Évite de garder un timer après avoir quitté le panneau
  function makeTimer() {
    const t = { list: [] };
    t.later = (fn, ms) => t.list.push(setTimeout(fn, ms));
    t.clear = () => {
      t.list.forEach(clearTimeout);
      t.list = [];
    };
    return t;
  }

  // ---------- Formes ----------
  function starPoints() {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 44 : 20;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push((50 + r * Math.cos(a)).toFixed(1) + "," + (52 + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }

  const SHAPES = [
    { id: "cercle", name: "le cercle", color: "#e53935", svg: '<circle cx="50" cy="50" r="40"/>' },
    { id: "carre", name: "le carré", color: "#1e88e5", svg: '<rect x="12" y="12" width="76" height="76" rx="6"/>' },
    { id: "triangle", name: "le triangle", color: "#43a047", svg: '<polygon points="50,10 92,88 8,88"/>' },
    { id: "etoile", name: "l'étoile", color: "#fbc02d", svg: '<polygon points="' + starPoints() + '"/>' },
    { id: "losange", name: "le losange", color: "#8e24aa", svg: '<polygon points="50,6 94,50 50,94 6,50"/>' },
    {
      id: "coeur",
      name: "le cœur",
      color: "#ec407a",
      svg: '<path d="M50 90 C 12 64, 4 38, 20 22 C 34 9, 46 20, 50 32 C 54 20, 66 9, 80 22 C 96 38, 88 64, 50 90 Z"/>',
    },
  ];

  const shapes = { active: false, busy: false, target: null, stars: 0, timer: makeTimer() };
  let shapesRoot = null;

  function shapesSay() {
    if (shapes.target) KA.speak("Touche " + shapes.target.name, { force: false });
  }

  function newShapeRound() {
    shapes.timer.clear();
    shapes.busy = false;
    const pick = shuffle(SHAPES.slice()).slice(0, 3);
    shapes.target = pick[Math.floor(Math.random() * pick.length)];
    const box = shapesRoot.querySelector("#shapes-choices");
    box.innerHTML = "";
    pick.forEach((s) => {
      const b = document.createElement("button");
      b.className = "shape-btn";
      b.dataset.silent = "";
      b.setAttribute("aria-label", s.name);
      b.innerHTML = '<svg viewBox="0 0 100 100" class="shape-svg" aria-hidden="true" fill="' + s.color + '">' + s.svg + "</svg>";
      b.addEventListener("click", () => answerShape(s, b));
      box.appendChild(b);
    });
    shapesRoot.querySelector("#shapes-stars").textContent = starText(shapes.stars);
    shapesSay();
  }

  function answerShape(s, btn) {
    if (shapes.busy || !shapes.active) return;
    if (s.id === shapes.target.id) {
      shapes.busy = true;
      shapes.stars += 1;
      btn.classList.add("right");
      KA.tone(880, 0.2, "triangle", 0.3);
      KA.speak("Bravo !");
      shapesRoot.querySelector("#shapes-stars").textContent = starText(shapes.stars);
      shapes.timer.later(() => {
        if (shapes.active) newShapeRound();
      }, 1400);
    } else {
      btn.classList.remove("shake");
      void btn.offsetWidth;
      btn.classList.add("shake");
      KA.tone(220, 0.15, "triangle", 0.2);
      KA.speak("Essaie encore");
    }
  }

  KA.panels.shapes = {
    init(root) {
      shapesRoot = root;
      root.querySelector("#shapes-say").addEventListener("click", shapesSay);
    },
    enter() {
      shapes.active = true;
      newShapeRound();
    },
    leave() {
      shapes.active = false;
      shapes.timer.clear();
    },
  };

  // ---------- L'intrus ----------
  const CATEGORIES = [
    ["🐶", "🐱", "🐸", "🦊", "🐼", "🐵", "🦁", "🐷"],
    ["🍎", "🍌", "🍇", "🍓", "🍉", "🍒"],
    ["🚗", "🚌", "🚲", "🚂", "🚜", "🛵"],
    ["🥕", "🥦", "🌽", "🍅", "🥔", "🍆"],
  ];

  const intrus = { active: false, busy: false, items: [], stars: 0, timer: makeTimer() };
  let intrusRoot = null;

  function intrusSay() {
    KA.speak("Trouve l'intrus");
  }

  function newIntrusRound() {
    intrus.timer.clear();
    intrus.busy = false;
    const cats = shuffle(CATEGORIES.slice());
    const main = shuffle(cats[0].slice()).slice(0, 3);
    const odd = shuffle(cats[1].slice())[0];
    intrus.items = shuffle(main.map((e) => ({ emoji: e, odd: false })).concat([{ emoji: odd, odd: true }]));
    const grid = intrusRoot.querySelector("#intrus-grid");
    grid.innerHTML = "";
    intrus.items.forEach((it) => {
      const b = document.createElement("button");
      b.className = "intrus-item";
      b.dataset.silent = "";
      b.textContent = it.emoji;
      b.setAttribute("aria-label", "Image");
      b.addEventListener("click", () => answerIntrus(it, b));
      grid.appendChild(b);
    });
    intrusRoot.querySelector("#intrus-stars").textContent = starText(intrus.stars);
    intrusSay();
  }

  function answerIntrus(it, btn) {
    if (intrus.busy || !intrus.active) return;
    if (it.odd) {
      intrus.busy = true;
      intrus.stars += 1;
      btn.classList.add("right");
      KA.tone(880, 0.2, "triangle", 0.3);
      KA.speak("Bravo !");
      intrusRoot.querySelector("#intrus-stars").textContent = starText(intrus.stars);
      intrus.timer.later(() => {
        if (intrus.active) newIntrusRound();
      }, 1400);
    } else {
      btn.classList.remove("shake");
      void btn.offsetWidth;
      btn.classList.add("shake");
      KA.tone(220, 0.15, "triangle", 0.2);
      KA.speak("Essaie encore");
    }
  }

  KA.panels.intrus = {
    init(root) {
      intrusRoot = root;
      root.querySelector("#intrus-say").addEventListener("click", intrusSay);
    },
    enter() {
      intrus.active = true;
      newIntrusRound();
    },
    leave() {
      intrus.active = false;
      intrus.timer.clear();
    },
  };
})();
