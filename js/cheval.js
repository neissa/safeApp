/* Panneau « Cheval » : un jeu de plateforme qui défile. Le cheval 🐴 court tout seul.
   Un appui (ou la barre espace, ou la flèche du haut) fait sauter le cheval.
   Il mange les carottes 🥕 et saute par-dessus les cailloux 🪨 et les bûches 🪵.
   Trois cœurs ❤️ : un obstacle en moins, et le cheval clignote un moment. */
(function () {
  "use strict";

  const KA = window.KA;
  const W = 800; // taille interne du dessin
  const H = 360;
  const GROUND = 300; // ligne du sol (pieds du cheval)
  const GRAV = 0.8;
  const JUMP_V = -15;
  const HORSE_X = 110;
  const LIVES_START = 3;
  const INVINCIBLE_FRAMES = 90;

  let canvas = null;
  let ctx = null;
  let livesEl = null;
  let carrotsEl = null;
  let overlay = null;
  let overlayText = null;
  let overlayBtn = null;
  let jumpBtn = null;

  let state = "ready"; // ready | play | over
  let active = false;
  let raf = 0;
  let horse = { y: GROUND, vy: 0 };
  let obstacles = []; // { x, ico, hit }
  let carrots = []; // { x, y, taken }
  let dist = 0;
  let speed = 5;
  let spawnIn = 0;
  let lives = LIVES_START;
  let carrotCount = 0;
  let invincible = 0;
  let frameN = 0;

  function reset() {
    horse = { y: GROUND, vy: 0 };
    obstacles = [];
    carrots = [];
    dist = 0;
    speed = 5;
    spawnIn = 200;
    lives = LIVES_START;
    carrotCount = 0;
    invincible = 0;
    state = "play";
    overlay.hidden = true;
    updateHud();
  }

  function updateHud() {
    livesEl.textContent = "❤️".repeat(lives) || "💔";
    carrotsEl.textContent = "🥕 " + carrotCount;
  }

  function jump() {
    if (state === "ready") {
      reset();
      return;
    }
    if (state !== "play") return;
    if (horse.y >= GROUND) horse.vy = JUMP_V;
  }

  function spawn() {
    if (Math.random() < 0.6) {
      const ico = Math.random() < 0.5 ? "🪨" : "🪵";
      obstacles.push({ x: W + 40, ico, hit: false });
    } else {
      // Trois carottes : au ras du sol (on les mange en courant) ou en l'air (il faut sauter)
      const high = Math.random() < 0.5;
      const y = high ? GROUND - 130 : GROUND - 35;
      for (let i = 0; i < 3; i++) carrots.push({ x: W + 40 + i * 42, y, taken: false });
    }
  }

  function overlapBox(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // Zone du cheval (un peu plus petite que l'image, pour être juste)
  function horseBox() {
    return { x: HORSE_X + 12, y: horse.y - 72, w: 56, h: 66 };
  }

  function update() {
    frameN += 1;
    speed = Math.min(8, 5 + dist / 2500);
    dist += speed;

    horse.vy += GRAV;
    horse.y += horse.vy;
    if (horse.y >= GROUND) {
      horse.y = GROUND;
      horse.vy = 0;
    }

    spawnIn -= speed;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = 280 + Math.random() * 220;
    }

    obstacles.forEach((o) => (o.x -= speed));
    carrots.forEach((c) => (c.x -= speed));
    obstacles = obstacles.filter((o) => o.x > -80);
    carrots = carrots.filter((c) => c.x > -80 && !c.taken);

    if (invincible > 0) invincible -= 1;

    const hb = horseBox();
    carrots.forEach((c) => {
      if (!c.taken && overlapBox(hb.x, hb.y, hb.w, hb.h, c.x - 18, c.y - 18, 36, 36)) {
        c.taken = true;
        carrotCount += 1;
        KA.tone(880, 0.12, "triangle", 0.2);
        updateHud();
      }
    });

    if (invincible === 0) {
      for (const o of obstacles) {
        if (!o.hit && overlapBox(hb.x, hb.y, hb.w, hb.h, o.x + 6, GROUND - 46, 40, 44)) {
          o.hit = true;
          lives -= 1;
          invincible = INVINCIBLE_FRAMES;
          KA.speak("Aïe !");
          updateHud();
          break;
        }
      }
    }

    if (lives <= 0) gameOver();
  }

  function gameOver() {
    state = "over";
    overlayText.textContent = "Oups ! Tu as mangé " + carrotCount + " 🥕";
    overlayBtn.textContent = "🔁 Rejouer";
    overlay.hidden = false;
    KA.speak("Oups ! Tu as mangé " + KA.frNumber(carrotCount) + " carottes. Rejoue !");
  }

  // ---------- Dessin ----------
  function emoji(ch, x, y, size, flip) {
    ctx.save();
    ctx.font = size + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    if (flip) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.fillText(ch, 0, y);
    } else {
      ctx.fillText(ch, x, y);
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Ciel
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#81d4fa");
    sky.addColorStop(1, "#e1f5fe");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Nuages et collines qui défilent lentement (effet de profondeur)
    const hillOff = (dist * 0.3) % 260;
    ctx.fillStyle = "#c5e1a5";
    for (let i = -1; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 260 + 120 - hillOff, GROUND, 150, 60, 0, Math.PI, 0);
      ctx.fill();
    }
    const cloudOff = (dist * 0.15) % 330;
    for (let i = 0; i < 6; i++) {
      emoji("☁️", i * 330 - cloudOff + 50, 110 + (i % 2) * 40, 60, false);
    }

    // Sol
    ctx.fillStyle = "#8bc34a";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#558b2f";
    ctx.fillRect(0, GROUND, W, 10);
    // Traits du sol qui défilent
    ctx.fillStyle = "#7cb342";
    const dashOff = dist % 80;
    for (let x = -dashOff; x < W; x += 80) ctx.fillRect(x, GROUND + 30, 40, 6);

    // Carottes
    carrots.forEach((c) => {
      if (!c.taken) emoji("🥕", c.x, c.y + 14, 40, false);
    });

    // Obstacles
    obstacles.forEach((o) => {
      if (o.hit) return;
      emoji(o.ico, o.x + 25, GROUND, 52, false);
    });

    // Cheval (clignote après un coup)
    if (invincible === 0 || Math.floor(frameN / 5) % 2 === 0) {
      emoji("🐴", HORSE_X + 40, horse.y, 80, true);
    }
  }

  function loop() {
    if (!active) return;
    if (state === "play") update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onKey(e) {
    if (e.key === " " || e.key === "ArrowUp") {
      e.preventDefault();
      jump();
    }
  }

  KA.panels.cheval = {
    init(root) {
      canvas = root.querySelector("#cheval-canvas");
      ctx = canvas.getContext("2d");
      livesEl = root.querySelector("#cheval-lives");
      carrotsEl = root.querySelector("#cheval-carrots");
      overlay = root.querySelector("#cheval-overlay");
      overlayText = root.querySelector("#cheval-overlay-text");
      overlayBtn = root.querySelector("#cheval-play");
      jumpBtn = root.querySelector("#cheval-jump");
      canvas.width = W;
      canvas.height = H;
      canvas.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        jump();
      });
      overlayBtn.addEventListener("click", () => {
        reset();
      });
      jumpBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        jump();
      });
      overlayText.textContent = "Touche l'écran pour faire sauter le cheval !";
      overlayBtn.textContent = "▶️ Jouer";
      overlay.hidden = false;
      state = "ready";
      updateHud();
      draw();
    },
    enter() {
      active = true;
      document.addEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      loop();
    },
    leave() {
      active = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    },
  };
})();
