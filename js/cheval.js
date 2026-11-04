/* Panneau « Cheval » : un jeu de plateforme qui défile. Le cheval 🐴 court tout seul.
   Un appui (ou la barre espace, ou la flèche du haut) fait sauter le cheval ;
   garder le doigt dessus le fait sauter plus haut et plus loin.
   Il mange les carottes 🥕 et saute par-dessus les obstacles de CSO : barrières et murs.
   Trois cœurs ❤️ : un obstacle en moins, et le cheval clignote un moment. */
(function () {
  "use strict";

  const KA = window.KA;
  const W = 800; // taille interne du dessin
  const H = 360;
  const GROUND = 300; // ligne du sol (pieds du cheval)
  const GRAV = 0.8;
  const GRAV_HOLD = 0.5; // gravité plus douce tant qu'on garde le doigt sur le bouton : le saut monte plus haut et va plus loin
  const HOLD_MAX = 30; // au plus 30 images (un demi-seconde) de saut prolongé
  const JUMP_V = -13; // saut plus bas qu'avant (environ 105 px au lieu de 140)
  const BAR_COLORS = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#fb8c00", "#8e24aa", "#ec407a", "#ffffff"];
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
  let carrots = []; // carottes et foin : { x, y, kind, taken }
  let dist = 0;
  let speed = 5;
  let spawnIn = 0;
  let lives = LIVES_START;
  let carrotCount = 0;
  let hayCount = 0;
  let invincible = 0;
  let frameN = 0;
  let runPhase = 0; // avance du galop (pour les pattes)
  let animT = 0; // compteur d'images pour les mouvements d'ambiance (queue au vent)
  let holding = false; // le doigt (ou la touche) est sur le bouton de saut
  let airFrames = 0; // images depuis le début du saut

  function reset() {
    horse = { y: GROUND, vy: 0 };
    obstacles = [];
    carrots = [];
    dist = 0;
    speed = 5;
    spawnIn = 200;
    lives = LIVES_START;
    carrotCount = 0;
    hayCount = 0;
    invincible = 0;
    state = "play";
    overlay.hidden = true;
    updateHud();
  }

  function updateHud() {
    livesEl.textContent = "❤️".repeat(lives) || "💔";
    carrotsEl.textContent = "🥕 " + carrotCount + "  🌾 " + hayCount;
  }

  // Appui sur le saut : le cheval saute (ou on commence la partie)
  function pressJump() {
    holding = true;
    if (state === "ready") {
      reset();
      return;
    }
    if (state !== "play") return;
    if (horse.y >= GROUND) {
      horse.vy = JUMP_V;
      airFrames = 0;
    }
  }

  // Doigt relâché : le saut s'arrête de monter plus haut
  function releaseJump() {
    holding = false;
  }

  // Obstacles de concours de saut d'obstacles (CSO) : une barrière rouge et blanche, ou un mur de briques
  const OBSTACLES = {
    barriere: { w: 76, h: 56 },
    mur: { w: 64, h: 50 },
    croix: { w: 84, h: 62 },
    oxer: { w: 96, h: 66 },
    bois: { w: 84, h: 46 },
  };

  // Deux couleurs différentes tirées au hasard, pour les barres d'un obstacle
  function randomColors() {
    const a = Math.floor(Math.random() * BAR_COLORS.length);
    let b = Math.floor(Math.random() * BAR_COLORS.length);
    if (b === a) b = (b + 1) % BAR_COLORS.length;
    return [BAR_COLORS[a], BAR_COLORS[b]];
  }

  function pickKind() {
    const r = Math.random();
    if (r < 0.3) return "barriere";
    if (r < 0.45) return "mur";
    if (r < 0.6) return "croix";
    if (r < 0.75) return "oxer";
    return "bois";
  }

  function spawn() {
    if (Math.random() < 0.6) {
      const kind = pickKind();
      obstacles.push({
        x: W + 40,
        kind,
        w: OBSTACLES[kind].w,
        h: OBSTACLES[kind].h,
        colors: randomColors(),
        hit: false,
      });
    } else {
      // Une seule friandise à la fois : carotte (🥕) ou foin (🌾), au ras du sol ou en l'air (il faut sauter)
      const high = Math.random() < 0.5;
      const y = high ? GROUND - 130 : GROUND - 35;
      const kind = Math.random() < 0.7 ? "carrot" : "hay";
      carrots.push({ x: W + 40, y, kind, taken: false });
    }
  }

  function overlapBox(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // Zone du cheval : du poitrail à la tête, jusqu'au-dessus des sabots (le dessin est à HORSE_X + 40)
  // Zone réduite : seul le cœur du cheval compte, pas le bout de la tête ni les sabots
  function horseBox() {
    return { x: HORSE_X + 34, y: horse.y - 95, w: 66, h: 80 };
  }

  function update() {
    frameN += 1;
    speed = Math.min(8, 5 + dist / 2500);
    dist += speed;

    // Galop : les pattes avancent tant que le cheval touche le sol
    if (horse.y >= GROUND) runPhase += speed * 0.06;

    // Doigt maintenu pendant la montée : la pesanteur est plus faible, donc le saut monte plus haut et dure plus longtemps
    const soft = holding && horse.vy < 0 && airFrames < HOLD_MAX;
    horse.vy += soft ? GRAV_HOLD : GRAV;
    horse.y += horse.vy;
    if (horse.y < GROUND) airFrames += 1;
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
        if (c.kind === "hay") hayCount += 1;
        else carrotCount += 1;
        KA.tone(880, 0.12, "triangle", 0.2);
        updateHud();
      }
    });

    if (invincible === 0) {
      for (const o of obstacles) {
        // Zone de l'obstacle réduite sur les bords et en haut : on ne touche que s'il y a vraiment contact
        if (!o.hit && overlapBox(hb.x, hb.y, hb.w, hb.h, o.x + 14, GROUND - o.h + 10, o.w - 28, o.h - 10)) {
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
    overlayText.textContent = "Oups ! Tu as mangé " + carrotCount + " 🥕 et " + hayCount + " 🌾";
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

  // Barrière de CSO : deux poteaux et deux barres aux couleurs choisies (alternées)
  function drawBarrier(x, w, h, colors) {
    const top = GROUND - h;
    ctx.fillStyle = "#6d4c41";
    ctx.fillRect(x + 4, top, 5, h);
    ctx.fillRect(x + w - 9, top, 5, h);
    [top + 6, top + h * 0.55].forEach((y) => {
      for (let sx = x; sx < x + w; sx += 12) {
        const k = Math.round((sx - x) / 12);
        ctx.fillStyle = colors[k % 2];
        ctx.fillRect(sx, y, Math.min(12, x + w - sx), 12);
      }
    });
  }

  // Croix : deux barres qui se croisent en X entre les poteaux
  function drawCross(x, w, h, colors) {
    const top = GROUND - h;
    ctx.fillStyle = "#6d4c41";
    ctx.fillRect(x + 4, top, 5, h);
    ctx.fillRect(x + w - 9, top, 5, h);
    ctx.lineWidth = 11;
    ctx.lineCap = "butt";
    ctx.strokeStyle = colors[0];
    ctx.beginPath();
    ctx.moveTo(x + 6, GROUND);
    ctx.lineTo(x + w - 6, top);
    ctx.stroke();
    ctx.strokeStyle = colors[1];
    ctx.beginPath();
    ctx.moveTo(x + 6, top);
    ctx.lineTo(x + w - 6, GROUND);
    ctx.stroke();
  }

  // Oxer : deux barrières l'une derrière l'autre, la deuxième plus haute
  function drawOxer(x, w, h, colors) {
    const frontW = Math.floor(w * 0.45);
    drawBarrier(x, frontW, h * 0.7, colors);
    drawBarrier(x + w - frontW, frontW, h, colors);
  }

  // Obstacle en bois : un tronc posé sur deux souches, avec les cernes visibles au bout
  function drawWood(x, w, h) {
    const top = GROUND - h;
    const logR = h / 2;
    // Souches
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(x + 6, top + h * 0.5, 12, h * 0.5);
    ctx.fillRect(x + w - 18, top + h * 0.5, 12, h * 0.5);
    // Tronc (corps du bois)
    ctx.fillStyle = "#a1887f";
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(x + 2, top + h * 0.7, w - 4, h * 0.3);
    // Cercles des extrémités
    ctx.fillStyle = "#d7ccc8";
    ctx.beginPath();
    ctx.ellipse(x, top + logR, 6, logR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w, top + logR, 6, logR, 0, 0, Math.PI * 2);
    ctx.fill();
    // Quelques fentes du bois
    ctx.strokeStyle = "#6d4c41";
    ctx.lineWidth = 2;
    [0.3, 0.5].forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(x + 14, top + h * f);
      ctx.lineTo(x + w - 14, top + h * f + 3);
      ctx.stroke();
    });
  }

  // Mur de briques de CSO
  function drawWall(x, w, h) {
    const top = GROUND - h;
    const rows = 4;
    const rh = h / rows;
    ctx.fillStyle = "#b5462b";
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = "#e8d5b5";
    for (let r = 0; r < rows; r++) {
      const y = top + r * rh;
      ctx.fillRect(x, y, w, 2);
      const shift = r % 2 === 0 ? 0 : 11;
      for (let bx = x + shift; bx < x + w; bx += 22) ctx.fillRect(bx, y, 2, rh);
    }
  }

  // Une patte : hanche, genou et sabot. Au sol elle avance en galop ; en l'air elle se replie.
  // Galop : chaque patte a son moment (ph, en radians). Au sol, la patte pousse vers l'arrière
  // (le sabot touche le sol) puis se lève, genou plié, et revient vers l'avant.
  function drawLeg(hx, ph, onGround, color, front) {
    const hipY = -42;
    let a;
    let b;
    if (onGround) {
      const th = runPhase + ph;
      a = 0.5 * Math.cos(th); // avance (+) puis recule (−)
      const swing = Math.max(0, -Math.sin(th)); // 0 quand le sabot touche, 1 au plus haut du lever
      b = a * 0.5 - 1.0 * swing; // le genou se plie pour lever le sabot
    } else {
      // En l'air (pose de saut figée) : pattes avant tendues vers l'avant, pattes arrière vers l'arrière
      a = front ? 1.0 : -0.9;
      b = front ? 0.3 : -0.6;
    }
    const kneeX = hx + Math.sin(a) * 22;
    const kneeY = hipY + Math.cos(a) * 22;
    const footX = kneeX + Math.sin(b) * 22;
    const footY = kneeY + Math.cos(b) * 22;
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // Sabot
    ctx.fillStyle = "#3e2723";
    ctx.beginPath();
    ctx.ellipse(footX + 2, Math.min(footY, 0) - 1, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Queue qui flotte au vent : chaque segment ondule un peu après le précédent, et plus on s'éloigne du corps, plus ça bouge
  // « flow » : 1 au repos, plus grand quand le cheval saute (la queue et la crinière s'envolent)
  function flowAmount() {
    const air = horse.y < GROUND ? Math.min(1, Math.abs(horse.vy) / 12) : 0;
    return 1 + air * 1.8;
  }

  // Une mèche (queue ou crinière) : une suite de segments qui ondulent, de plus en plus loin de la racine
  function strand(points, flow, phase, widthStart, widthEnd) {
    const pts = points.map((p, i) => {
      const wind = Math.sin(animT * 0.11 - phase - i * 0.6) * (1.5 + i * 2.0) * flow;
      const lift = Math.cos(animT * 0.07 - phase - i * 0.45) * (1 + i * 1.0) * flow;
      return { x: p.x + wind, y: p.y + lift - (flow - 1) * i * 2.5 };
    });
    ctx.strokeStyle = "#3e2723";
    ctx.lineCap = "round";
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 2 || 1);
      ctx.lineWidth = widthStart + (widthEnd - widthStart) * t;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
  }

  function drawTail(flow) {
    const points = [];
    for (let i = 0; i <= 8; i++) points.push({ x: -40 - i * 4.2, y: -62 + i * 3.2 });
    strand(points, flow, 0, 8, 2.5);
  }


  // Cheval dessiné, de profil, tourné vers la droite. (ox, oy) = point entre les sabots, au niveau du sol
  function drawHorse(ox, oy) {
    const onGround = oy >= GROUND;
    const bob = onGround ? -Math.abs(Math.sin(runPhase)) * 3 : 0;
    ctx.save();
    ctx.translate(ox, oy + bob);
    // Léger tangage du corps pendant le galop
    ctx.rotate(onGround ? Math.sin(runPhase * 2) * 0.025 : -0.06);

    const flow = flowAmount();
    drawTail(flow);

    // Pattes arrière, puis le corps, puis les pattes avant (devant le corps)
    // Ordre de galop : chaque patte décalée des autres
    drawLeg(-30, 3.1, onGround, "#6d4321", false);
    drawLeg(-40, 4.4, onGround, "#6d4321", false);

    ctx.fillStyle = "#8d5a2b";
    ctx.beginPath();
    ctx.ellipse(0, -54, 44, 23, -0.05, 0, Math.PI * 2);
    ctx.fill();

    drawLeg(22, 0, onGround, "#8d5a2b", true);
    drawLeg(34, 1.3, onGround, "#8d5a2b", true);

    // Encolure et tête
    ctx.fillStyle = "#8d5a2b";
    ctx.beginPath();
    ctx.moveTo(18, -66);
    ctx.lineTo(40, -106);
    ctx.lineTo(60, -106);
    ctx.lineTo(50, -60);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(62, -104, 17, 12, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // Museau et naseau
    ctx.fillStyle = "#c58f5a";
    ctx.beginPath();
    ctx.ellipse(76, -94, 10, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3e2723";
    ctx.beginPath();
    ctx.arc(80, -96, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Oreille
    ctx.fillStyle = "#6d4321";
    ctx.beginPath();
    ctx.moveTo(54, -116);
    ctx.lineTo(58, -130);
    ctx.lineTo(64, -116);
    ctx.closePath();
    ctx.fill();
    // Crinière (fixe)
    ctx.strokeStyle = "#3e2723";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(22, -74);
    ctx.quadraticCurveTo(38, -104, 52, -118);
    ctx.stroke();
    // Œil
    ctx.fillStyle = "#1b1b1b";
    ctx.beginPath();
    ctx.arc(66, -106, 2.8, 0, Math.PI * 2);
    ctx.fill();

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
      if (!c.taken) emoji(c.kind === "hay" ? "🌾" : "🥕", c.x, c.y + 14, 40, false);
    });

    // Obstacles
    obstacles.forEach((o) => {
      if (o.hit) return;
      if (o.kind === "barriere") drawBarrier(o.x, o.w, o.h, o.colors);
      else if (o.kind === "croix") drawCross(o.x, o.w, o.h, o.colors);
      else if (o.kind === "oxer") drawOxer(o.x, o.w, o.h, o.colors);
      else if (o.kind === "bois") drawWood(o.x, o.w, o.h);
      else drawWall(o.x, o.w, o.h);
    });

    // Cheval (clignote après un coup)
    if (invincible === 0 || Math.floor(frameN / 5) % 2 === 0) {
      drawHorse(HORSE_X + 40, horse.y);
    }
  }

  function loop() {
    if (!active) return;
    animT += 1; // le vent bouge la queue même quand la partie n'a pas commencé
    if (state === "play") update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  const JUMP_KEYS = [" ", "ArrowUp"];
  function onKeyDown(e) {
    if (JUMP_KEYS.indexOf(e.key) >= 0) {
      e.preventDefault();
      pressJump();
    }
  }
  function onKeyUp(e) {
    if (JUMP_KEYS.indexOf(e.key) >= 0) releaseJump();
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
        pressJump();
      });
      overlayBtn.addEventListener("click", () => {
        reset();
      });
      jumpBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pressJump();
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
      holding = false;
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("keyup", onKeyUp);
      // Doigt levé n'importe où (même hors du canevas) : le saut s'arrête de monter
      document.addEventListener("pointerup", releaseJump);
      document.addEventListener("pointercancel", releaseJump);
      cancelAnimationFrame(raf);
      loop();
    },
    leave() {
      active = false;
      holding = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("pointerup", releaseJump);
      document.removeEventListener("pointercancel", releaseJump);
    },
  };
})();
