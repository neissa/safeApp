/* Panneau Labyrinthe : guider le petit poussin 🐣 jusqu'au drapeau 🏁.
   On se déplace avec les quatre flèches à l'écran (ou les flèches du clavier).
   Le labyrinthe est créé au hasard, et il y a toujours une sortie. */
(function () {
  "use strict";

  const KA = window.KA;
  const SIZES = [5, 7, 9];
  const DIRS = {
    N: { dx: 0, dy: -1, opp: "S" },
    S: { dx: 0, dy: 1, opp: "N" },
    E: { dx: 1, dy: 0, opp: "W" },
    W: { dx: -1, dy: 0, opp: "E" },
  };

  let board = null;
  let msgEl = null;
  let levelBox = null;
  let sizeIndex = 0;
  let n = 5;
  let cells = []; // cells[y * n + x] = { walls: { N, S, E, W } }
  let pos = { x: 0, y: 0 };
  let winTimer = null;
  let active = false;

  function generate() {
    cells = [];
    for (let i = 0; i < n * n; i++) {
      cells.push({ walls: { N: true, S: true, E: true, W: true }, seen: false });
    }
    // Parcours en profondeur avec retour arrière : un seul chemin par case, sans zone isolée
    const stack = [{ x: 0, y: 0 }];
    cells[0].seen = true;
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const free = Object.keys(DIRS).filter((d) => {
        const nx = cur.x + DIRS[d].dx;
        const ny = cur.y + DIRS[d].dy;
        return nx >= 0 && ny >= 0 && nx < n && ny < n && !cells[ny * n + nx].seen;
      });
      if (!free.length) {
        stack.pop();
        continue;
      }
      const d = free[Math.floor(Math.random() * free.length)];
      const nx = cur.x + DIRS[d].dx;
      const ny = cur.y + DIRS[d].dy;
      cells[cur.y * n + cur.x].walls[d] = false;
      cells[ny * n + nx].walls[DIRS[d].opp] = false;
      cells[ny * n + nx].seen = true;
      stack.push({ x: nx, y: ny });
    }
    pos = { x: 0, y: 0 };
  }

  function render() {
    board.innerHTML = "";
    board.style.setProperty("--n", n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const c = cells[y * n + x];
        const div = document.createElement("div");
        // Un seul trait par mur : le haut et la gauche de chaque case, plus les bords du bas et de droite
        let cls = "lab-cell";
        if (c.walls.N) cls += " lw-t";
        if (c.walls.W) cls += " lw-l";
        if (y === n - 1 && c.walls.S) cls += " lw-b";
        if (x === n - 1 && c.walls.E) cls += " lw-r";
        div.className = cls;
        if (x === pos.x && y === pos.y) div.textContent = "🐣";
        else if (x === n - 1 && y === n - 1) div.textContent = "🏁";
        board.appendChild(div);
      }
    }
  }

  function move(dir) {
    if (!active || winTimer) return;
    const c = cells[pos.y * n + pos.x];
    if (c.walls[dir]) {
      KA.tone(180, 0.1, "triangle", 0.15);
      return;
    }
    pos = { x: pos.x + DIRS[dir].dx, y: pos.y + DIRS[dir].dy };
    render();
    if (pos.x === n - 1 && pos.y === n - 1) {
      msgEl.textContent = "🎉 Bravo, tu as trouvé la sortie !";
      KA.speak("Bravo, tu as trouvé la sortie !");
      winTimer = setTimeout(() => {
        winTimer = null;
        if (active) newGame();
      }, 2200);
    }
  }

  function newGame() {
    clearTimeout(winTimer);
    winTimer = null;
    n = SIZES[sizeIndex];
    generate();
    msgEl.textContent = "Aide le poussin à trouver le drapeau";
    render();
  }

  function setSize(index) {
    sizeIndex = index;
    levelBox.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.level) === index));
    newGame();
  }

  const PAD_DIRS = { up: "N", down: "S", left: "W", right: "E" }; // directions de js/pad.js

  KA.panels.labyrinthe = {
    init(root) {
      board = root.querySelector("#lab-board");
      msgEl = root.querySelector("#lab-msg");
      levelBox = root.querySelector("#lab-levels");
      SIZES.forEach((size, index) => {
        const b = document.createElement("button");
        b.className = "seg-btn";
        b.dataset.level = index;
        b.textContent = size + " × " + size;
        b.setAttribute("aria-label", "Labyrinthe " + size + " par " + size);
        b.addEventListener("click", () => setSize(index));
        levelBox.appendChild(b);
      });
      // Croix de direction, flèches du clavier et glissement du doigt sur le plateau (js/pad.js)
      KA.pad(root, (d) => move(PAD_DIRS[d]), { swipe: board });
      root.querySelector("#lab-new").addEventListener("click", newGame);
      setSize(sizeIndex);
    },
    enter() {
      active = true;
    },
    leave() {
      active = false;
      clearTimeout(winTimer);
      winTimer = null;
    },
  };
})();
