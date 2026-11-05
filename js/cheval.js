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
  let overAt = 0; // heure de la fin de partie (ms)
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
    // Pas de bouton « Jouer » : le premier saut lance la partie, et un saut après la fin la relance
    if (state === "ready") {
      reset();
      return;
    }
    if (state === "over") {
      // Petite pause après la fin, pour ne pas relancer par accident
      if (Date.now() - overAt > 1200) reset();
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
      const y = high ? GROUND - 170 : GROUND - 35;
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

    // Galop : les pattes avancent tant que le cheval touche le sol. Une foulée = STRIDE pixels de course,
    // donc un sabot posé recule exactement à la vitesse du sol (il ne glisse pas)
    if (horse.y >= GROUND) runPhase += (speed * Math.PI * 2) / STRIDE;

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
    overAt = Date.now();
    overlayText.textContent = "Oups ! Tu as mangé " + carrotCount + " 🥕 et " + hayCount + " 🌾. Touche l'écran pour rejouer";
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

  // ---------- Cheval : dessin de profil, style dessin animé ----------
  // Repère : (0, 0) = le sol sous le milieu du corps ; le cheval regarde vers la droite.
  // Chaque forme est dessinée en deux temps : d'abord un contour foncé pour tout le cheval,
  // puis la couleur par-dessus. Ainsi les jointures (corps, encolure, tête) ne laissent pas de trait.
  const OUT = "#2e1a0e"; // contour
  const BODY = "#a86a36"; // robe baie
  const BODY_DARK = "#7c4a24"; // membres du côté éloigné
  const SOCK = "#f7f1e3"; // balzane blanche
  const HOOF = "#2b1d16";
  const MANE = "#2f1b0f";
  // ---------- Galop ----------
  // runPhase avance de speed × 2π / STRIDE par image : une foulée complète = STRIDE pixels de course.
  // Pendant l'appui, le sabot recule exactement de STRIDE × STANCE : il reste fixe sur le sol qui défile.
  const STRIDE = 200; // longueur d'une foulée (px)
  const STANCE = 0.32; // part de la foulée où le sabot touche le sol
  const REACH = (STRIDE * STANCE) / 2; // demi-course du sabot posé
  // Galop à gauche : postérieur droit, postérieur gauche, antérieur droit, antérieur gauche, puis suspension
  // (pattes rassemblées sous le ventre). Le cheval regarde à droite : on voit son côté gauche (pattes « proches »).
  const LEGS = {
    rh: { hip: { x: -30, y: -58 }, front: false, phase: 0 },
    lh: { hip: { x: -37, y: -58 }, front: false, phase: 0.12 },
    rf: { hip: { x: 30, y: -54 }, front: true, phase: 0.38 },
    lf: { hip: { x: 24, y: -54 }, front: true, phase: 0.5 },
  };
  const BODY_LIFT = 8; // le corps est porté au-dessus des hanches de base : pattes plus longues
  // Les antérieurs se posent loin devant, les postérieurs poussent loin derrière
  const LEG_CENTER = { front: 14, hind: -16 };
  const LEG_LIFT = { front: 26, hind: 20 };
  // Le haut de la patte (avant-bras, jambe) s'allonge quand la patte s'étend, comme l'épaule d'un cheval :
  // longueur haute entre min et max, longueur basse (canon + paturon) fixe
  const LEG_LEN = { front: { min: 28, max: 50, lower: 30 }, hind: { min: 32, max: 52, lower: 32 } };
  const LEG_W = { front: [11, 7.5, 6], hind: [13, 8, 6] }; // largeur en haut, à l'articulation, au sabot

  // « flow » : 1 au repos, plus grand quand le cheval saute (la queue s'envole)
  function flowAmount() {
    const air = horse.y < GROUND ? Math.min(1, Math.abs(horse.vy) / 12) : 0;
    return 1 + air * 1.8;
  }

  // Mèche (queue) : une suite de segments qui ondulent, de plus en plus loin de la racine
  function strand(points, flow, phase, w0, w1, color) {
    const pts = points.map((p, i) => {
      const wind = Math.sin(animT * 0.11 - phase - i * 0.6) * (1.5 + i * 2.0) * flow;
      const lift = Math.cos(animT * 0.07 - phase - i * 0.45) * (1 + i * 1.0) * flow;
      return { x: p.x + wind, y: p.y + lift - (flow - 1) * i * 2.5 };
    });
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    for (let i = 0; i < pts.length - 1; i++) {
      const t = i / (pts.length - 2 || 1);
      ctx.lineWidth = w0 + (w1 - w0) * t;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
  }

  // Queue : deux mèches, une sombre derrière et une plus claire devant, pour du volume.
  // droop : pente de la queue (grande au repos, faible au galop : la queue file vers l'arrière)
  function drawTail(flow, droop) {
    const back = [];
    const front = [];
    for (let i = 0; i <= 8; i++) {
      back.push({ x: -56 - i * 4.6, y: -78 + i * (droop + 0.4) });
      front.push({ x: -58 - i * 4.8, y: -82 + i * droop });
    }
    strand(back, flow, 0.9, 13, 4, "#4a2a16");
    strand(front, flow, 0, 17, 5, MANE);
  }

  // Où est le sabot pendant la foulée (p de 0 à 1), par rapport à la hanche
  function hoofOffset(leg, p) {
    const center = leg.front ? LEG_CENTER.front : LEG_CENTER.hind;
    if (p < STANCE) return { dx: center + REACH - (2 * REACH * p) / STANCE, lift: 0 }; // posé : recule avec le sol
    const q = (p - STANCE) / (1 - STANCE); // levé : revient vers l'avant en se repliant
    const ease = q * q * (3 - 2 * q);
    const lift = (leg.front ? LEG_LIFT.front : LEG_LIFT.hind) * Math.sin(Math.PI * q);
    return { dx: center - REACH + 2 * REACH * ease, lift };
  }

  // Cinématique inverse à deux segments : où se trouve le genou (ou le jarret) pour que le sabot soit en (bx, by).
  // Devant, le genou pointe vers l'avant ; derrière, le jarret pointe vers l'arrière.
  function solveLeg(ax, ay, bx, by, l1, l2, front) {
    let dx = bx - ax;
    let dy = by - ay;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) {
      // Trop loin : la patte est tendue, le sabot s'arrête au bout
      bx = ax + (dx / d) * max;
      by = ay + (dy / d) * max;
      d = max;
    }
    d = Math.max(d, Math.abs(l1 - l2) + 0.01);
    const base = Math.atan2(by - ay, bx - ax);
    const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const a = Math.acos(Math.max(-1, Math.min(1, cos)));
    const ang = front ? base - a : base + a;
    return { kx: ax + Math.cos(ang) * l1, ky: ay + Math.sin(ang) * l1, fx: bx, fy: by };
  }

  // Segment effilé (largeur w1 au début, w2 à la fin)
  function taper(x1, y1, w1, x2, y2, w2) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    ctx.beginPath();
    ctx.moveTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
    ctx.lineTo(x2 + (nx * w2) / 2, y2 + (ny * w2) / 2);
    ctx.lineTo(x2 - (nx * w2) / 2, y2 - (ny * w2) / 2);
    ctx.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
    ctx.closePath();
  }

  function disc(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }

  // Une patte complète : hanche (hx, hy), sabot visé (tx, ty). Contour foncé, puis couleur.
  function drawLeg(leg, hx, hy, tx, ty, color, sock) {
    const len = leg.front ? LEG_LEN.front : LEG_LEN.hind;
    const w = leg.front ? LEG_W.front : LEG_W.hind;
    // Patte presque tendue quand le sabot est loin, repliée quand il est près (sabot levé)
    const d = Math.hypot(tx - hx, ty - hy);
    const upper = Math.max(len.min, Math.min(len.max, d / 0.97 - len.lower));
    const j = solveLeg(hx, hy, tx, ty, upper, len.lower, leg.front);
    const shapes = [
      [() => taper(hx, hy, w[0], j.kx, j.ky, w[1]), color],
      [() => disc(j.kx, j.ky, w[1] / 2 + 0.5), color],
      [() => taper(j.kx, j.ky, w[1] - 1, j.fx, j.fy - 4, w[2]), sock ? SOCK : color],
    ];
    ctx.lineJoin = "round";
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.5;
    shapes.forEach(([build]) => {
      build();
      ctx.stroke();
    });
    shapes.forEach(([build, col]) => {
      build();
      ctx.fillStyle = col;
      ctx.fill();
    });
    // Sabot, posé à plat
    ctx.fillStyle = HOOF;
    ctx.beginPath();
    ctx.moveTo(j.fx - 5.5, j.fy);
    ctx.lineTo(j.fx + 6.5, j.fy);
    ctx.lineTo(j.fx + 4.5, j.fy - 7);
    ctx.lineTo(j.fx - 4.5, j.fy - 7);
    ctx.closePath();
    ctx.fill();
  }

  // Formes du corps (chacune est un chemin, réutilisé pour le contour puis pour la couleur)
  function pathTorso() {
    ctx.beginPath();
    ctx.moveTo(44, -66); // poitrail
    ctx.bezierCurveTo(46, -86, 30, -100, 12, -100); // épaule jusqu'au garrot
    ctx.bezierCurveTo(-8, -100, -30, -96, -46, -90); // dos jusqu'à la croupe
    ctx.bezierCurveTo(-60, -84, -62, -66, -52, -58); // croupe arrondie
    ctx.bezierCurveTo(-44, -50, -30, -50, -14, -50); // dessous de la cuisse
    ctx.bezierCurveTo(6, -48, 26, -50, 36, -56); // ventre
    ctx.bezierCurveTo(42, -60, 44, -62, 44, -66);
    ctx.closePath();
  }

  function pathNeck() {
    ctx.save();
    neckSpace();
    ctx.beginPath();
    ctx.moveTo(6, -94);
    ctx.bezierCurveTo(24, -120, 44, -140, 60, -148); // dessus de l'encolure, jusqu'à la nuque
    const throat = headPoint(66, -122); // gorge : sous la joue, suit la taille de la tête
    ctx.lineTo(throat.x, throat.y);
    ctx.bezierCurveTo(50, -120, 40, -100, 34, -80); // dessous de l'encolure : cou fin, base plus large
    ctx.lineTo(24, -74);
    ctx.closePath();
    ctx.restore();
  }

  // Tête : dessinée dans son propre repère (nuque en 56, -142), puis réduite et placée au bout de l'encolure.
  // Une tête de cheval est longue et fine, nettement plus petite que le corps.
  const HEAD_POLL = { x: 60, y: -148 }; // nuque, au bout de l'encolure
  const HEAD_SCALE = 0.64;
  // Un point du repère de la tête, ramené sur le cheval
  function headPoint(x, y) {
    return { x: HEAD_POLL.x + (x - 56) * HEAD_SCALE, y: HEAD_POLL.y + (y + 142) * HEAD_SCALE };
  }
  // Encolure : elle pivote autour de sa base (vers l'avant pendant la course, comme un cheval qui s'étire)
  const NECK_BASE = { x: 22, y: -84 };
  let neckTilt = 0; // angle en radians, réglé à chaque image par drawHorse
  function neckSpace() {
    ctx.translate(NECK_BASE.x, NECK_BASE.y);
    ctx.rotate(neckTilt);
    ctx.translate(-NECK_BASE.x, -NECK_BASE.y);
  }

  function headSpace() {
    ctx.translate(HEAD_POLL.x, HEAD_POLL.y);
    ctx.rotate(-neckTilt * 0.75); // la tête se redresse : le nez reste dirigé vers l'avant
    ctx.scale(HEAD_SCALE, HEAD_SCALE);
    ctx.translate(-56, 142);
  }

  // Contour de la tête, dans le repère de la tête
  function headOutline() {
    ctx.beginPath();
    ctx.moveTo(56, -142); // front, à la nuque
    ctx.bezierCurveTo(72, -146, 92, -126, 104, -108); // chanfrein, long
    ctx.bezierCurveTo(110, -100, 108, -92, 101, -90); // bout du nez
    ctx.bezierCurveTo(94, -90, 86, -94, 80, -100); // mâchoire
    ctx.bezierCurveTo(72, -108, 66, -116, 64, -126); // joue, fine
    ctx.bezierCurveTo(62, -134, 60, -139, 56, -142);
    ctx.closePath();
  }

  // Chemins placés sur le cheval (repères appliqués seulement pendant la construction :
  // le contour garde la même épaisseur que le reste du corps)
  function pathHead() {
    ctx.save();
    neckSpace();
    headSpace();
    headOutline();
    ctx.restore();
  }

  function pathEar() {
    ctx.save();
    neckSpace();
    headSpace();
    ctx.beginPath();
    ctx.moveTo(54, -140);
    ctx.lineTo(51, -158);
    ctx.lineTo(62, -145);
    ctx.closePath();
    ctx.restore();
  }

  // Dessine plusieurs formes comme une seule silhouette : contours d'abord, couleur ensuite
  function paintShapes(shapes, color) {
    ctx.lineJoin = "round";
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 7;
    shapes.forEach((s) => {
      s();
      ctx.stroke();
    });
    ctx.fillStyle = color;
    shapes.forEach((s) => {
      s();
      ctx.fill();
    });
  }

  // Ombres et reflets pour le volume (par-dessus le corps)
  function shadeBody() {
    ctx.save();
    pathTorso();
    ctx.clip();
    ctx.fillStyle = "rgba(70, 32, 10, 0.28)"; // ventre plus sombre
    ctx.beginPath();
    ctx.ellipse(-4, -40, 62, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 226, 180, 0.28)"; // reflet sur l'épaule
    ctx.beginPath();
    ctx.ellipse(14, -82, 16, 9, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Grosse cuisse à l'arrière, avec un trait qui la dessine
    ctx.fillStyle = "rgba(70, 32, 10, 0.14)";
    ctx.beginPath();
    ctx.ellipse(-30, -72, 19, 22, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(50, 24, 8, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-30, -72, 19, 0.5, 2.6);
    ctx.stroke();
  }

  // Crinière : trois mèches fixes qui suivent l'encolure
  const MANE_STRANDS = [
    [[60, -152], [48, -150], [34, -138], [20, -122], [10, -106], [5, -95]],
    [[56, -145], [44, -143], [31, -131], [19, -115], [11, -100]],
    [[50, -139], [38, -136], [26, -124], [16, -108]],
  ];

  // Ligne courbe qui passe par plusieurs points
  function curveThrough(pts, w, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }

  function drawMane() {
    ctx.save();
    neckSpace();
    MANE_STRANDS.forEach((pts) => curveThrough(pts, 9, OUT));
    MANE_STRANDS.forEach((pts) => curveThrough(pts, 6, MANE));
    ctx.restore();
  }

  // Visage : balzane blanche sur le front, museau clair, naseau, œil avec reflet
  function drawFace() {
    ctx.save();
    neckSpace();
    headSpace(); // tout le visage est dans le repère de la tête
    ctx.save();
    headOutline();
    ctx.clip();
    ctx.strokeStyle = "#fbf7ee";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(70, -143);
    ctx.quadraticCurveTo(86, -128, 101, -104);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(240, 200, 150, 0.6)";
    ctx.beginPath();
    ctx.ellipse(98, -98, 8, 6, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#4a2c1a";
    ctx.beginPath();
    ctx.ellipse(103, -99, 2.2, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = BODY_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(72, -132, 5, 3.6, 5.6);
    ctx.stroke();
    ctx.fillStyle = "#1d120b";
    ctx.beginPath();
    ctx.ellipse(72, -128, 3.4, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(73, -129.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Cheval complet. (ox, oy) = point entre les sabots, au niveau du sol
  function drawHorse(ox, oy) {
    const onGround = oy >= GROUND;
    const running = onGround && state === "play";
    const p = (((runPhase / (Math.PI * 2)) % 1) + 1) % 1; // position dans la foulée, de 0 à 1
    // Le corps monte pendant la suspension (vers p = 0,92) et bascule : avant relevé quand les postérieurs poussent
    const bob = running ? -3 * Math.cos(Math.PI * 2 * (p - 0.92)) - 0.5 : 0;
    const rot = running ? -0.05 * Math.sin(Math.PI * 2 * p) : onGround ? 0 : -0.06;
    // Encolure tendue vers l'avant au galop (elle descend un peu quand les antérieurs se posent)
    neckTilt = running ? 0.34 + 0.07 * Math.sin(Math.PI * 2 * (p - 0.3)) : onGround ? 0 : 0.2;
    const flow = flowAmount();
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);

    ctx.save();
    ctx.translate(ox, oy);

    // Position de chaque hanche (le corps a bougé) et du sabot visé
    const place = (key) => {
      const leg = LEGS[key];
      const hx = leg.hip.x * cr - leg.hip.y * sr;
      const hy = leg.hip.x * sr + leg.hip.y * cr + bob - BODY_LIFT;
      let tx;
      let ty;
      if (running) {
        const o = hoofOffset(leg, (p - leg.phase + 1) % 1);
        tx = hx + o.dx;
        ty = -o.lift;
      } else if (onGround) {
        tx = hx + (leg.front ? 2 : 4); // debout : sabots sous les hanches, jarret un peu plié
        ty = 0;
      } else if (leg.front) {
        tx = hx + 18; // en l'air : antérieurs repliés vers l'avant
        ty = hy + 32;
      } else {
        tx = hx - 30; // postérieurs tendus vers l'arrière
        ty = hy + 42;
      }
      return { leg, hx, hy, tx, ty };
    };
    const body = (fn) => {
      ctx.save();
      ctx.translate(0, bob - BODY_LIFT);
      ctx.rotate(rot);
      fn();
      ctx.restore();
    };
    const leg = (key, color, sock) => {
      const l = place(key);
      drawLeg(l.leg, l.hx, l.hy, l.tx, l.ty, color, sock);
    };

    body(() => drawTail(flow, running ? 1.6 : onGround ? 4.2 : 2.4));
    // Membres du côté éloigné : derrière le corps
    leg("rh", BODY_DARK, false);
    leg("rf", BODY_DARK, false);
    body(() => {
      paintShapes([pathTorso, pathNeck, pathHead, pathEar], BODY);
      shadeBody();
      drawMane();
      drawFace();
    });
    // Membres du côté proche : devant le corps
    leg("lh", BODY, false);
    leg("lf", BODY, true);
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
      jumpBtn = root.querySelector("#cheval-jump");
      canvas.width = W;
      canvas.height = H;
      canvas.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pressJump();
      });
      jumpBtn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        pressJump();
      });
      overlayText.textContent = "Touche l'écran pour faire sauter le cheval !";
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
