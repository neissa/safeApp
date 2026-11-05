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
  let startBtn = null;

  // Bouton Jouer / Pause (en haut à droite) : icône et nom accessible
  function setBtn(icon, label) {
    startBtn.textContent = icon;
    startBtn.setAttribute("aria-label", label);
  }

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
    draw();
  }

  function cellCenter(p, s) {
    return [(p.x + 0.5) * s, (p.y + 0.5) * s];
  }

  // Corps de largeur constante (virages compris) ; seule la queue se termine en pointe
  function drawBody(s) {
    const body = st.snake;
    const n = body.length;
    const W = s * 0.34; // demi-largeur du corps
    const c = (i) => cellCenter(body[i], s);
    // Vrai si la case i touche la précédente (pas de passage par un bord)
    const joined = (i) =>
      i > 0 && Math.abs(body[i].x - body[i - 1].x) <= 1 && Math.abs(body[i].y - body[i - 1].y) <= 1;

    // Points de la queue : case d'avant (si elle touche), dernière case moins large, puis la pointe
    const tail = [];
    if (n >= 2 && joined(n - 1)) tail.push({ x: c(n - 2)[0], y: c(n - 2)[1], w: W });
    if (n >= 2) {
      const [tx, ty] = c(n - 1);
      tail.push({ x: tx, y: ty, w: W * 0.6 });
      const [bx, by] = c(n - 2);
      const dx = tx - bx;
      const dy = ty - by;
      const len = Math.hypot(dx, dy) || 1;
      tail.push({ x: tx + (dx / len) * s * 0.5, y: ty + (dy / len) * s * 0.5, w: 0 });
    }

    // Contour sombre, puis corps clair par-dessus
    [
      [1.14, "#2e7d32"],
      [1, "#66bb6a"],
    ].forEach(([scale, color]) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineCap = "round";
      // Chaque case relie la précédente par un trait arrondi de même largeur : pas de renflement dans les virages
      ctx.lineWidth = 2 * W * scale;
      for (let i = 1; i <= n - 2; i++) {
        if (!joined(i)) continue;
        const [x0, y0] = c(i - 1);
        const [x1, y1] = c(i);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      // Queue effilée
      if (tail.length > 1) {
        const left = [];
        const right = [];
        tail.forEach((p, k) => {
          const prev = tail[Math.max(0, k - 1)];
          const next = tail[Math.min(tail.length - 1, k + 1)];
          let tx = next.x - prev.x;
          let ty = next.y - prev.y;
          const len = Math.hypot(tx, ty) || 1;
          tx /= len;
          ty /= len;
          const w = p.w * scale;
          left.push([p.x - ty * w, p.y + tx * w]);
          right.push([p.x + ty * w, p.y - tx * w]);
        });
        ctx.beginPath();
        left.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  // Tête ronde, deux yeux et une langue fourchue dans le sens du déplacement
  function drawHead(s) {
    const [hx, hy] = cellCenter(st.snake[0], s);
    const fx = st.dir.x; // vers l'avant
    const fy = st.dir.y;
    const px = -fy; // perpendiculaire (côtés)
    const py = fx;

    // Langue : sort de la tête et se termine par deux pointes
    const bx = hx + fx * s * 0.4;
    const by = hy + fy * s * 0.4;
    const tx = hx + fx * s * 0.78;
    const ty = hy + fy * s * 0.78;
    ctx.strokeStyle = "#e53935";
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(tx + fx * s * 0.16 + px * s * 0.14, ty + fy * s * 0.16 + py * s * 0.14);
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + fx * s * 0.16 - px * s * 0.14, ty + fy * s * 0.16 - py * s * 0.14);
    ctx.stroke();

    // Tête
    ctx.fillStyle = "#43a047";
    ctx.strokeStyle = "#2e7d32";
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Deux yeux, sur l'avant de la tête
    const ex = hx + fx * s * 0.14;
    const ey = hy + fy * s * 0.14;
    [1, -1].forEach((side) => {
      const x = ex + px * s * 0.2 * side;
      const y = ey + py * s * 0.2 * side;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b1b1b";
      ctx.beginPath();
      ctx.arc(x + fx * s * 0.03, y + fy * s * 0.03, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
    });
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

    drawBody(s);
    drawHead(s);
  }

  function gameOver() {
    stop();
    st.running = false;
    st.over = true;
    if (st.score > best()) KA.settings.set("snakeBest", st.score);
    showBest();
    setBtn("🔄", "Recommencer");
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
    setBtn("⏸️", "Pause");
    stop();
    st.timer = setInterval(step, TICK);
  }

  function pause() {
    if (!st.running) return;
    st.running = false;
    stop();
    setBtn("▶️", "Continuer");
  }

  // Une direction demandée : pas de demi-tour immédiat, et deux changements au plus
  function turn(name) {
    const d = DIRS[name];
    const last = st.queue.length ? st.queue[st.queue.length - 1] : st.dir;
    if (d.x === last.x && d.y === last.y) return;
    if (d.x === -last.x && d.y === -last.y) return;
    if (st.queue.length < 2) st.queue.push(d);
  }

  // Une flèche lance la partie si elle n'est pas en cours (ou reprend après une pause)
  function steer(name) {
    if (!st.running) start();
    turn(name);
  }

  KA.panels.snake = {
    init(r) {
      root = r;
      canvas = root.querySelector("#snake-canvas");
      ctx = canvas.getContext("2d");
      scoreEl = root.querySelector("#snake-score");
      bestEl = root.querySelector("#snake-best");
      startBtn = root.querySelector("#snake-start");
      showBest();
      reset();

      startBtn.addEventListener("click", () => {
        if (st.running) pause();
        else start();
      });
      // Croix de direction, flèches du clavier et glissement du doigt sur le terrain (js/pad.js)
      KA.pad(root, steer, { swipe: canvas });
    },
    leave() {
      pause();
    },
  };

  // Barre d'espace (ordinateur) : pause ou reprise. Les flèches sont gérées par js/pad.js.
  document.addEventListener("keydown", (e) => {
    const screen = document.getElementById("screen-snake");
    if (!screen || !screen.classList.contains("active")) return;
    // Barre d'espace : pause ou reprise
    if (e.key === " ") {
      e.preventDefault();
      if (st.running) pause();
      else start();
    }
  });
})();
