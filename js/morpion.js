/* Panneau « Morpion » : contre l'ordinateur (tu joues les croix ❌, il joue les ronds ⭕),
   ou à deux sur le même appareil (chacun son tour). Trois cases alignées gagnent. */
(function () {
  "use strict";

  const KA = window.KA;
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  const SHOW = { X: "❌", O: "⭕" };
  const COMPUTER_DELAY_MS = 700;

  // mode : "computer" (contre l'ordi) ou "two" (chacun son tour)
  const game = { board: [], turn: "X", mode: "computer", over: false, busy: false, active: false, timer: null };
  let root = null;
  let boardEl = null;
  let statusEl = null;
  let modeBtn = null;

  // Renvoie les trois cases gagnantes, ou null
  function winLine(b, mark) {
    for (const line of LINES) {
      if (line.every((i) => b[i] === mark)) return line;
    }
    return null;
  }

  // Case vide qui fait gagner « mark » en un coup, ou -1
  function winningCell(b, mark) {
    for (const line of LINES) {
      const empty = line.filter((i) => b[i] === "");
      const mine = line.filter((i) => b[i] === mark);
      if (empty.length === 1 && mine.length === 2) return empty[0];
    }
    return -1;
  }

  // L'ordinateur : gagner si possible, sinon bloquer, sinon le centre, sinon au hasard
  function computerMove(b) {
    let i = winningCell(b, "O");
    if (i < 0) i = winningCell(b, "X");
    if (i < 0 && b[4] === "") i = 4;
    if (i < 0) {
      const empty = [];
      b.forEach((v, k) => {
        if (v === "") empty.push(k);
      });
      i = empty[Math.floor(Math.random() * empty.length)];
    }
    return i;
  }

  function render(line) {
    boardEl.querySelectorAll(".morpion-cell").forEach((btn, i) => {
      btn.textContent = SHOW[game.board[i]] || "";
      btn.classList.toggle("win", !!line && line.indexOf(i) >= 0);
    });
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  // Renvoie true si la partie est finie (victoire ou égalité)
  function checkEnd() {
    const xWin = winLine(game.board, "X");
    const oWin = winLine(game.board, "O");
    if (xWin || oWin) {
      game.over = true;
      const winner = xWin ? "X" : "O";
      render(xWin || oWin);
      KA.tone(880, 0.3, "triangle", 0.3);
      if (game.mode === "two") {
        setStatus("Bravo, " + SHOW[winner] + " a gagné ! 🎉");
        KA.speak("Bravo !");
      } else if (xWin) {
        setStatus("Bravo, tu as gagné ! 🎉");
        KA.speak("Bravo, tu as gagné !");
      } else {
        setStatus("L'ordinateur gagne. Rejoue pour te venger !");
        KA.speak("L'ordinateur gagne. Rejoue !");
      }
      return true;
    }
    if (game.board.every((v) => v !== "")) {
      game.over = true;
      render(null);
      setStatus("Égalité !");
      KA.speak("Égalité !");
      return true;
    }
    return false;
  }

  // Joue une case pour la marque « mark » ; renvoie true si la partie est finie
  function play(i, mark) {
    game.board[i] = mark;
    render(null);
    return checkEnd();
  }

  function onCell(i) {
    if (!game.active || game.over || game.busy || game.board[i] !== "") return;

    if (game.mode === "two") {
      if (play(i, game.turn)) return;
      game.turn = game.turn === "X" ? "O" : "X";
      setStatus("Tour de " + SHOW[game.turn]);
      return;
    }

    if (play(i, "X")) return;
    game.busy = true;
    setStatus("L'ordinateur réfléchit…");
    game.timer = setTimeout(() => {
      game.busy = false;
      if (!game.active) return;
      if (!play(computerMove(game.board), "O")) setStatus("À toi de jouer !");
    }, COMPUTER_DELAY_MS);
  }

  function newGame() {
    clearTimeout(game.timer);
    game.board = ["", "", "", "", "", "", "", "", ""];
    game.turn = "X";
    game.over = false;
    game.busy = false;
    render(null);
    if (game.mode === "two") {
      setStatus("Tour de ❌");
      KA.speak("Nouvelle partie.");
    } else {
      setStatus("À toi de jouer : clique une case ❌");
      KA.speak("Nouvelle partie. À toi de jouer !");
    }
    modeBtn.textContent = game.mode === "two" ? "🤖 Contre l'ordi" : "👫 Chacun son tour";
  }

  function toggleMode() {
    game.mode = game.mode === "two" ? "computer" : "two";
    newGame();
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    for (let i = 0; i < 9; i++) {
      const b = document.createElement("button");
      b.className = "morpion-cell";
      b.dataset.silent = "";
      b.setAttribute("aria-label", "Case " + (i + 1));
      b.addEventListener("click", () => onCell(i));
      boardEl.appendChild(b);
    }
  }

  KA.panels.morpion = {
    init(r) {
      root = r;
      boardEl = root.querySelector("#morpion-board");
      statusEl = root.querySelector("#morpion-status");
      modeBtn = root.querySelector("#morpion-mode");
      buildBoard();
      modeBtn.addEventListener("click", toggleMode);
      root.querySelector("#morpion-new").addEventListener("click", newGame);
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
