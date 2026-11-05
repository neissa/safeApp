/* Panneau Pac-Man, version douce pour les petits : on mange toutes les étoiles ⭐ du labyrinthe.
   Le fantôme 👻 bouge lentement. Trois vies ❤️ : un contact avec le fantôme fait perdre une vie,
   et on repart de la case de départ. Les flèches à l'écran (ou du clavier) dirigent Pac-Man. */
(function () {
  "use strict";

  const KA = window.KA;
  // # mur, . étoile. Le labyrinthe est carré en colonnes (13) × lignes (11)
  const MAP = [
    "#############",
    "#...........#",
    "#.##.###.##.#",
    "#...........#",
    "#.##.#.#.##.#",
    "#....#.#....#",
    "###.##.##.###",
    "#...........#",
    "#.##.###.##.#",
    "#...........#",
    "#############",
  ];
  const H = MAP.length;
  const W = MAP[0].length;
  const PLAYER_START = { x: 1, y: 1 };
  const GHOST_STARTS = [
    { x: 6, y: 5 },
    { x: 11, y: 9 },
  ];
  const LIVES_START = 3;
  const TICK_MS = 220; // le joueur bouge à chaque tic, le fantôme un tic sur deux
  const DIRS = {
    N: { dx: 0, dy: -1 },
    S: { dx: 0, dy: 1 },
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
  };
  const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
  const PAD_DIRS = { up: "N", down: "S", left: "W", right: "E" }; // directions de js/pad.js

  let board = null;
  let livesEl = null;
  let starsEl = null;

  let stars = new Set(); // cases contenant encore une étoile, clé "x,y"
  let eaten = 0;
  let player = { x: 0, y: 0 };
  let dir = null; // direction actuelle du joueur (nom N/S/E/W) ou null
  let want = null; // direction demandée par l'enfant, appliquée dès que possible
  let facing = "E"; // côté vers lequel Pac-Man ouvre la bouche
  let ghosts = [];
  let lives = LIVES_START;
  let timer = null;
  let tickN = 0;
  let started = false;
  let active = false;
  let resetTimer = null;

  const key = (x, y) => x + "," + y;
  const isWall = (x, y) => MAP[y][x] === "#";
  const canGo = (x, y, d) => {
    const nx = x + DIRS[d].dx;
    const ny = y + DIRS[d].dy;
    return nx >= 0 && ny >= 0 && nx < W && ny < H && !isWall(nx, ny);
  };

  function resetPositions() {
    player = { x: PLAYER_START.x, y: PLAYER_START.y };
    dir = null;
    want = null;
    facing = "E";
    ghosts = GHOST_STARTS.map((g) => ({ x: g.x, y: g.y, dir: "W" }));
  }

  function newGame() {
    stars = new Set();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (MAP[y][x] === ".") stars.add(key(x, y));
      }
    }
    eaten = 0;
    lives = LIVES_START;
    started = false;
    resetPositions();
    stars.delete(key(player.x, player.y));
    render();
  }

  function render() {
    board.innerHTML = "";
    board.style.setProperty("--cols", W);
    board.style.setProperty("--rows", H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const div = document.createElement("div");
        let cls = "pm-cell";
        if (isWall(x, y)) cls += " pm-wall";
        else if (stars.has(key(x, y))) cls += " pm-star";
        div.className = cls;
        if (x === player.x && y === player.y) {
          // Pac-Man : la bouche s'ouvre et se ferme à chaque pas (ouverte à l'arrêt)
          const pac = document.createElement("span");
          const open = !started || tickN % 2 === 0;
          pac.className = "pm-pac pm-face-" + facing + (open ? " open" : "");
          div.appendChild(pac);
        }
        else if (ghosts.some((g) => g.x === x && g.y === y)) div.textContent = "👻";
        board.appendChild(div);
      }
    }
    livesEl.textContent = "❤️".repeat(lives) || "💔";
    starsEl.textContent = "⭐ " + eaten;
  }

  // Une case de plus dans une direction, sans faire demi-tour si on peut éviter
  function pickGhostDir(g) {
    const options = Object.keys(DIRS).filter((d) => canGo(g.x, g.y, d));
    const forward = options.filter((d) => d !== OPPOSITE[g.dir]);
    const pool = forward.length ? forward : options;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function moveGhosts() {
    ghosts.forEach((g) => {
      if (!canGo(g.x, g.y, g.dir)) g.dir = pickGhostDir(g);
      if (canGo(g.x, g.y, g.dir)) {
        g.x += DIRS[g.dir].dx;
        g.y += DIRS[g.dir].dy;
      }
    });
  }

  function touched() {
    return ghosts.some((g) => g.x === player.x && g.y === player.y);
  }

  function loseLife() {
    lives -= 1;
    if (lives <= 0) {
      KA.speak("Oh non ! On recommence");
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetTimer = null;
        if (active) newGame();
      }, 1500);
      stop();
      render();
      return;
    }
    KA.speak("Aïe !");
    resetPositions();
    render();
  }

  function win() {
    stop();
    KA.speak("Bravo, tu as tout mangé !");
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      resetTimer = null;
      if (active) newGame();
    }, 3000);
  }

  function tick() {
    tickN += 1;
    // Le joueur : prend la direction demandée si c'est possible, sinon continue
    if (want && canGo(player.x, player.y, want)) dir = want;
    if (dir) facing = dir;
    if (dir && canGo(player.x, player.y, dir)) {
      player.x += DIRS[dir].dx;
      player.y += DIRS[dir].dy;
    }
    if (stars.delete(key(player.x, player.y))) eaten += 1;
    if (touched()) {
      loseLife();
      return;
    }
    if (tickN % 2 === 0) {
      moveGhosts();
      if (touched()) {
        loseLife();
        return;
      }
    }
    if (stars.size === 0) {
      render();
      win();
      return;
    }
    render();
  }

  function start() {
    if (timer) return;
    timer = setInterval(tick, TICK_MS);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  function press(d) {
    if (!active) return;
    want = d;
    if (!started) {
      started = true;
      start();
    }
  }

  KA.panels.pacman = {
    init(root) {
      board = root.querySelector("#pm-board");
      livesEl = root.querySelector("#pm-lives");
      starsEl = root.querySelector("#pm-stars");
      // Croix de direction, flèches du clavier et glissement du doigt sur le plateau (js/pad.js)
      KA.pad(root, (d) => press(PAD_DIRS[d]), { swipe: board });
      root.querySelector("#pm-new").addEventListener("click", () => {
        stop();
        clearTimeout(resetTimer);
        resetTimer = null;
        newGame();
      });
      newGame();
    },
    enter() {
      active = true;
    },
    leave() {
      active = false;
      stop();
      clearTimeout(resetTimer);
      resetTimer = null;
      newGame();
    },
  };
})();
