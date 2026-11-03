/* Snake : guide le serpent vers les pommes avec les flèches (ou en glissant le doigt).
   Pour les petits, le serpent traverse les bords et réapparaît de l'autre côté.
   Il ne faut que se mordre la queue pour perdre. */
(function () {
  "use strict";

  const KA = window.KA;
  const N = 14; // cases par côté
  const TICK = 260; // ms entre deux déplacements (assez lent pour les petits)
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const st = {
    snake: [], // la tête est en premier
    dir: DIRS.right,
    queue: [], // changements de direction à appliquer (2 au maximum)
    food: null,
    score: 0,
    running: false,
    over: false,
    timer: null,
  };
  let root = null;
  let canvas = null;
  let ctx = null;
  let scoreEl = null;
  let bestEl = null;
  let msgEl = null;
  let startBtn = null;

  function best() {
    return KA.settings.get("snakeBest", 0);
  }

  function showBest() {
    bestEl.textContent = "Record : " + best();
  }

  function placeFood() {
    let p;
    do {
      p = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
    } while (st.snake.some((s) => s.x === p.x && s.y === p.y));
    return p;
  }

  function reset() {
    const mid = Math.floor(N / 2);
    st.snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    st.dir = DIRS.right;
    st.queue = [];
    st.score = 0;
    st.over = false;
    st.food = placeFood();
    scoreEl.textContent = "Pommes : 0";
    msgEl.textContent = "Guide le serpent vers les pommes 🍎";
    draw();
  }

  function draw() {
    const s = canvas.width / N;
    ctx.fillStyle = "#e8f5e9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Quadrillage léger
    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, canvas.height);
      ctx.moveTo(0, i * s);
      ctx.lineTo(canvas.width, i * s);
      ctx.stroke();
    }

    if (st.food) {
      ctx.font = Math.round(s * 0.8) + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🍎", (st.food.x + 0.5) * s, (st.food.y + 0.55) * s);
    }

    st.snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? "#1b5e20" : "#66bb6a";
      ctx.fillRect(p.x * s + 2, p.y * s + 2, s - 4, s - 4);
    });

    // Deux yeux sur la tête
    const head = st.snake[0];
    const hx = head.x * s;
    const hy = head.y * s;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(hx + s * 0.35, hy + s * 0.38, s * 0.09, 0, Math.PI * 2);
    ctx.arc(hx + s * 0.65, hy + s * 0.38, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  function gameOver() {
    stop();
    st.running = false;
    st.over = true;
    if (st.score > best()) KA.settings.set("snakeBest", st.score);
    showBest();
    msgEl.textContent = "Aïe ! Tu as mangé " + st.score + " pomme" + (st.score > 1 ? "s" : "") + " 🍎";
    startBtn.textContent = "🔄 Recommencer";
    KA.speak("Oups !");
    draw();
  }

  function step() {
    if (st.queue.length) st.dir = st.queue.shift();
    const head = st.snake[0];
    const nx = (head.x + st.dir.x + N) % N;
    const ny = (head.y + st.dir.y + N) % N;
    const eats = st.food && nx === st.food.x && ny === st.food.y;
    // Sans pomme, la queue se déplace : on ne compte pas la dernière case
    const body = eats ? st.snake : st.snake.slice(0, -1);
    if (body.some((p) => p.x === nx && p.y === ny)) {
      gameOver();
      return;
    }
    st.snake.unshift({ x: nx, y: ny });
    if (eats) {
      st.score += 1;
      scoreEl.textContent = "Pommes : " + st.score;
      KA.tone(660, 0.15, "triangle", 0.3);
      st.food = placeFood();
    } else {
      st.snake.pop();
    }
    draw();
  }

  function stop() {
    clearInterval(st.timer);
    st.timer = null;
  }

  function start() {
    if (st.running) return;
    if (st.over || !st.snake.length) reset();
    st.running = true;
    msgEl.textContent = "";
    startBtn.textContent = "⏸️ Pause";
    stop();
    st.timer = setInterval(step, TICK);
  }

  function pause() {
    if (!st.running) return;
    st.running = false;
    stop();
    startBtn.textContent = "▶️ Continuer";
    msgEl.textContent = "Pause";
  }

  // Une direction demandée : pas de demi-tour immédiat, et deux changements au plus
  function turn(name) {
    const d = DIRS[name];
    const last = st.queue.length ? st.queue[st.queue.length - 1] : st.dir;
    if (d.x === last.x && d.y === last.y) return;
    if (d.x === -last.x && d.y === -last.y) return;
    if (st.queue.length < 2) st.queue.push(d);
  }

  KA.panels.snake = {
    init(r) {
      root = r;
      canvas = root.querySelector("#snake-canvas");
      ctx = canvas.getContext("2d");
      scoreEl = root.querySelector("#snake-score");
      bestEl = root.querySelector("#snake-best");
      msgEl = root.querySelector("#snake-msg");
      startBtn = root.querySelector("#snake-start");
      showBest();
      reset();

      startBtn.addEventListener("click", () => {
        if (st.running) pause();
        else start();
      });
      ["up", "down", "left", "right"].forEach((name) => {
        root.querySelector("#snake-" + name).addEventListener("click", () => turn(name));
      });

      // Glisser le doigt sur le terrain
      let touch = null;
      canvas.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        touch = { x: t.clientX, y: t.clientY };
      });
      canvas.addEventListener("touchend", (e) => {
        if (!touch) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touch.x;
        const dy = t.clientY - touch.y;
        touch = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? "right" : "left");
        else turn(dy > 0 ? "down" : "up");
      });
    },
    leave() {
      pause();
    },
  };

  // Flèches du clavier (ordinateur)
  document.addEventListener("keydown", (e) => {
    const screen = document.getElementById("screen-snake");
    if (!screen || !screen.classList.contains("active")) return;
    const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    if (map[e.key]) {
      e.preventDefault();
      turn(map[e.key]);
    }
  });
})();
