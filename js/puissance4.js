/* Panneau « Puissance 4 » : contre l'ordinateur (tu joues les rouges 🔴, il joue les jaunes),
   ou à deux sur le même appareil (chacun son tour). Quatre jetons alignés gagnent.
   Clique la flèche ▼ au-dessus d'une colonne pour y faire tomber un jeton. */
(function () {
  "use strict";

  const KA = window.KA;
  const ROWS = 6;
  const COLS = 7;
  const COMPUTER_DELAY_MS = 600;
  const NAME = { R: "le rouge 🔴", Y: "le jaune 🟡" };
  // Sens de recherche d'une ligne de quatre : horizontal, vertical, deux diagonales
  const DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  // board[r][c] : r = 0 en bas, "" vide, "R" rouge, "Y" jaune
  // mode : "computer" (contre l'ordi, toi = rouge) ou "two" (chacun son tour)
  const game = {
    board: [],
    turn: "R",
    mode: "computer",
    over: false,
    busy: false,
    active: false,
    timer: null,
    winKeys: null,
  };
  let root = null;
  let boardEl = null;
  let dropsEl = null;
  let statusEl = null;
  let modeBtn = null;
  const cellEls = [];

  const key = (r, c) => r * COLS + c;

  function emptyBoard() {
    const b = [];
    for (let r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(""));
    return b;
  }

  // Première case libre de la colonne (en partant du bas), ou -1 si elle est pleine
  function dropRow(b, c) {
    for (let r = 0; r < ROWS; r++) {
      if (b[r][c] === "") return r;
    }
    return -1;
  }

  // Liste des cases d'une ligne de quatre gagnante pour « mark », ou null
  function fourFrom(b, mark) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of DIRS) {
          const cells = [];
          for (let k = 0; k < 4; k++) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== mark) break;
            cells.push([rr, cc]);
          }
          if (cells.length === 4) return cells;
        }
      }
    }
    return null;
  }

  // Colonne où « mark » gagne en un coup, ou -1
  function winningColumn(b, mark) {
    for (let c = 0; c < COLS; c++) {
      const r = dropRow(b, c);
      if (r < 0) continue;
      b[r][c] = mark;
      const win = fourFrom(b, mark);
      b[r][c] = "";
      if (win) return c;
    }
    return -1;
  }

  // L'ordinateur : gagner si possible, sinon bloquer, sinon le centre (souvent), sinon au hasard
  function computerColumn(b) {
    let c = winningColumn(b, "Y");
    if (c < 0) c = winningColumn(b, "R");
    if (c < 0 && dropRow(b, 3) >= 0 && Math.random() < 0.5) c = 3;
    if (c < 0) {
      const playable = [];
      for (let k = 0; k < COLS; k++) {
        if (dropRow(b, k) >= 0) playable.push(k);
      }
      c = playable[Math.floor(Math.random() * playable.length)];
    }
    return c;
  }

  function render(winCells) {
    game.winKeys = winCells ? new Set(winCells.map(([r, c]) => key(r, c))) : null;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = game.board[r][c];
        const el = cellEls[key(r, c)];
        el.className = "p4-cell" + (v === "R" ? " red" : v === "Y" ? " yellow" : "");
        if (game.winKeys && game.winKeys.has(key(r, c))) el.classList.add("win");
      }
    }
    dropsEl.querySelectorAll(".p4-drop").forEach((btn, c) => {
      btn.disabled = dropRow(game.board, c) < 0 || game.over;
    });
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  // Renvoie true si la partie est finie (victoire ou plateau plein)
  function checkEnd() {
    const redWin = fourFrom(game.board, "R");
    const yellowWin = fourFrom(game.board, "Y");
    if (redWin || yellowWin) {
      game.over = true;
      const winCells = redWin || yellowWin;
      render(winCells);
      KA.tone(880, 0.3, "triangle", 0.3);
      if (game.mode === "two") {
        setStatus("Bravo, " + (redWin ? NAME.R : NAME.Y) + " a gagné ! 🎉");
        KA.speak("Bravo !");
      } else if (redWin) {
        setStatus("Bravo, tu as gagné ! 🎉");
        KA.speak("Bravo, tu as gagné !");
      } else {
        setStatus("L'ordinateur gagne. Rejoue pour te venger !");
        KA.speak("L'ordinateur gagne. Rejoue !");
      }
      return true;
    }
    if (game.board.every((row) => row.every((v) => v !== ""))) {
      game.over = true;
      render(null);
      setStatus("Égalité ! Plus de place.");
      KA.speak("Égalité !");
      return true;
    }
    return false;
  }

  // Pose un jeton « mark » dans la colonne c ; renvoie true si la partie est finie
  function drop(c, mark) {
    const r = dropRow(game.board, c);
    game.board[r][c] = mark;
    render(null);
    return checkEnd();
  }

  function onColumn(c) {
    if (!game.active || game.over || game.busy) return;
    if (dropRow(game.board, c) < 0) return;

    if (game.mode === "two") {
      if (drop(c, game.turn)) return;
      game.turn = game.turn === "R" ? "Y" : "R";
      setStatus("Tour de " + NAME[game.turn]);
      return;
    }

    if (drop(c, "R")) return;
    game.busy = true;
    setStatus("L'ordinateur réfléchit…");
    game.timer = setTimeout(() => {
      game.busy = false;
      if (!game.active) return;
      if (!drop(computerColumn(game.board), "Y")) setStatus("Clique ▼ au-dessus d'une colonne");
    }, COMPUTER_DELAY_MS);
  }

  function newGame() {
    clearTimeout(game.timer);
    game.board = emptyBoard();
    game.turn = "R";
    game.over = false;
    game.busy = false;
    render(null);
    if (game.mode === "two") {
      setStatus("Tour de " + NAME.R);
      KA.speak("Nouvelle partie.");
    } else {
      setStatus("Clique ▼ au-dessus d'une colonne");
      KA.speak("Nouvelle partie.");
    }
    modeBtn.textContent = game.mode === "two" ? "🤖 Contre l'ordi" : "👫 Chacun son tour";
  }

  function toggleMode() {
    game.mode = game.mode === "two" ? "computer" : "two";
    newGame();
  }

  function build() {
    boardEl.innerHTML = "";
    dropsEl.innerHTML = "";
    for (let c = 0; c < COLS; c++) {
      const d = document.createElement("button");
      d.className = "p4-drop";
      d.textContent = "▼";
      d.dataset.silent = "";
      d.setAttribute("aria-label", "Mettre un jeton dans la colonne " + (c + 1));
      d.addEventListener("click", () => onColumn(c));
      dropsEl.appendChild(d);
    }
    // Les cases sont créées de haut en bas (r = ROWS - 1 à 0) pour que le bas du jeu soit en bas
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        const el = document.createElement("div");
        el.className = "p4-cell";
        cellEls[key(r, c)] = el;
        boardEl.appendChild(el);
      }
    }
  }

  KA.panels.puissance4 = {
    init(r) {
      root = r;
      boardEl = root.querySelector("#p4-board");
      dropsEl = root.querySelector("#p4-drops");
      statusEl = root.querySelector("#p4-status");
      modeBtn = root.querySelector("#p4-mode");
      build();
      modeBtn.addEventListener("click", toggleMode);
      root.querySelector("#p4-new").addEventListener("click", newGame);
    },
    enter() {
      game.active = true;
      newGame();
    },
    leave() {
      game.active = false;
      clearTimeout(game.timer);
      game.busy = false;
    },
  };
})();
