/* Panneau de dessin : plusieurs dessins, crayon, gomme, pot de peinture, tampons.
   Chaque dessin est sauvegardé automatiquement, et la liste des vignettes se met à jour tout de suite. */
(function () {
  "use strict";

  const KA = window.KA;
  const KIND = "drawing";
  const COLORS = [
    { hex: "#e53935", name: "Rouge" },
    { hex: "#fb8c00", name: "Orange" },
    { hex: "#fdd835", name: "Jaune" },
    { hex: "#43a047", name: "Vert" },
    { hex: "#1e88e5", name: "Bleu" },
    { hex: "#8e24aa", name: "Violet" },
    { hex: "#ec407a", name: "Rose" },
    { hex: "#000000", name: "Noir" },
  ];
  const SIZES = [6, 14, 28]; // diamètre du trait en pixels CSS
  const STAMPS = ["⭐", "❤️", "☀️", "🌸", "🐶", "🚗", "🌈", "🎈"];

  const state = { color: COLORS[4].hex, size: SIZES[1], stampSize: 44, tool: "pen", stamp: STAMPS[0], brush: "round" };
  // Formes du pinceau (le trait est dessiné avec cette forme au lieu d'un rond)
  const BRUSHES = [
    { id: "round", icon: "●", name: "Cercle" },
    { id: "square", icon: "■", name: "Carré" },
    { id: "triangle", icon: "▲", name: "Triangle" },
    { id: "star", icon: "★", name: "Étoile" },
    { id: "heart", icon: "♥", name: "Cœur" },
    { id: "diamond", icon: "◆", name: "Losange" },
  ];
  let canvas = null;
  let ctx = null;
  let scale = 1; // pixels du canvas par pixel CSS
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentId = null; // dessin affiché et modifié
  let currentCreated = 0;
  let saveTimer = null;
  let thumbUrls = [];
  let root = null;
  let undoBtn = null;
  let preview = null; // aperçu du pinceau (taille, forme, couleur)
  let previewCtx = null;
  let stampPreview = null; // aperçu du tampon (taille)
  let stampPreviewCtx = null;
  const history = []; // images précédentes, pour annuler
  const HISTORY_MAX = 10;

  // ---------- Annuler ----------
  function updateUndo() {
    if (undoBtn) undoBtn.disabled = history.length === 0;
  }

  // Garde l'image actuelle avant une action (trait, pot de peinture, tampon)
  function pushHistory() {
    if (!ctx || !canvas.width) return;
    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (history.length > HISTORY_MAX) history.shift();
    updateUndo();
  }

  function clearHistory() {
    history.length = 0;
    updateUndo();
  }

  function undo() {
    if (!history.length) return;
    ctx.putImageData(history.pop(), 0, 0);
    updateUndo();
    scheduleSave();
  }

  // ---------- Pinceau ----------
  function applyBrush() {
    if (!ctx) return;
    const color = state.tool === "eraser" ? "#ffffff" : state.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = state.size * scale;
  }

  function fillWhite() {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  // Adapte la résolution du canvas à sa taille affichée, en conservant le dessin
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    scale = w / rect.width;
    if (canvas.width === w && canvas.height === h) {
      applyBrush();
      return;
    }
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    if (canvas.width) snapshot.getContext("2d").drawImage(canvas, 0, 0);
    canvas.width = w;
    canvas.height = h;
    clearHistory(); // les anciennes images n'ont plus la bonne taille
    fillWhite();
    if (snapshot.width) ctx.drawImage(snapshot, 0, 0);
    applyBrush();
  }

  // ---------- Pot de peinture ----------
  function hexToRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function floodFill(x, y) {
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const start = Math.floor(y) * w + Math.floor(x);
    const t = start * 4;
    const target = [d[t], d[t + 1], d[t + 2], d[t + 3]];
    const fill = hexToRgb(state.color);
    if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2]) return;

    const matches = (p) =>
      d[p * 4] === target[0] && d[p * 4 + 1] === target[1] && d[p * 4 + 2] === target[2] && d[p * 4 + 3] === target[3];
    const stack = [start];
    while (stack.length) {
      const p = stack.pop();
      if (!matches(p)) continue;
      d[p * 4] = fill[0];
      d[p * 4 + 1] = fill[1];
      d[p * 4 + 2] = fill[2];
      d[p * 4 + 3] = 255;
      const px = p % w;
      const py = (p - px) / w;
      if (px > 0) stack.push(p - 1);
      if (px < w - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - w);
      if (py < h - 1) stack.push(p + w);
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- Coordonnées et gestes ----------
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * scale, (e.clientY - r.top) * scale];
  }

  function stamp(x, y) {
    ctx.save();
    ctx.font = Math.round(state.stampSize * scale) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.stamp, x, y);
    ctx.restore();
    scheduleSave();
  }

  // Vrai si le pinceau n'est pas un rond (crayon avec une autre forme)
  function usesShape() {
    return state.tool === "pen" && state.brush !== "round";
  }

  // Dessine la forme du pinceau centrée en (cx, cy), de rayon r
  function brushPath(kind, cx, cy, r) {
    ctx.beginPath();
    if (kind === "square") {
      ctx.rect(cx - r, cy - r, 2 * r, 2 * r);
    } else if (kind === "triangle") {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
    } else if (kind === "diamond") {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
    } else if (kind === "star") {
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + rr * Math.cos(a);
        const py = cy + rr * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (kind === "heart") {
      ctx.moveTo(cx, cy + r * 0.9);
      ctx.bezierCurveTo(cx - r * 1.3, cy + r * 0.1, cx - r * 0.6, cy - r * 1.0, cx, cy - r * 0.35);
      ctx.bezierCurveTo(cx + r * 0.6, cy - r * 1.0, cx + r * 1.3, cy + r * 0.1, cx, cy + r * 0.9);
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Le trait avec une forme : on pose la forme tout le long du mouvement
  function stampBrush(x0, y0, x1, y1) {
    const r = ctx.lineWidth / 2;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.5)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      brushPath(state.brush, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r);
    }
  }

  function down(e) {
    if (!ctx) return;
    applyBrush();
    const [x, y] = pos(e);
    pushHistory();
    if (state.tool === "bucket") {
      floodFill(x, y);
      scheduleSave();
      return;
    }
    if (state.tool === "stamp") {
      stamp(x, y);
      return;
    }
    drawing = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* pointeur non capturable : le trait suit quand même le doigt sur le canevas */
    }
    lastX = x;
    lastY = y;
    if (usesShape()) {
      brushPath(state.brush, lastX, lastY, ctx.lineWidth / 2);
    } else {
      ctx.beginPath();
      ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function move(e) {
    if (!drawing) return;
    const [x, y] = pos(e);
    if (usesShape()) {
      stampBrush(lastX, lastY, x, y);
    } else {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    lastX = x;
    lastY = y;
  }

  function up() {
    if (!drawing) return;
    drawing = false;
    scheduleSave();
  }

  // ---------- Sauvegarde ----------
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }

  // Écrit le dessin courant (identifiant et contenu figés au moment de l'appel), puis met la liste à jour
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!currentId) return Promise.resolve();
    const id = currentId;
    const created = currentCreated;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve();
        KA.db
          .put({ id, kind: KIND, createdAt: created, blob })
          .then(() => renderList())
          .then(resolve, resolve);
      }, "image/png");
    });
  }

  // ---------- Liste des dessins (vignettes) ----------
  async function renderList() {
    const items = (await KA.db.list(KIND)).slice().reverse(); // le plus récent d'abord
    const list = root.querySelector("#draw-list");
    thumbUrls.forEach((u) => URL.revokeObjectURL(u));
    thumbUrls = [];
    list.innerHTML = "";
    items.forEach((it, i) => {
      const url = URL.createObjectURL(it.blob);
      thumbUrls.push(url);
      const b = document.createElement("button");
      b.className = "thumb" + (it.id === currentId ? " selected" : "");
      b.setAttribute("aria-label", "Dessin " + (items.length - i));
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      b.appendChild(img);
      b.addEventListener("click", () => openDrawing(it));
      list.appendChild(b);
    });
  }

  function loadBlob(blob) {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      fillWhite();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // Ouvre un dessin existant. Le dessin précédent est enregistré avant, pour ne rien perdre.
  async function openDrawing(item) {
    await saveNow();
    clearHistory();
    currentId = item.id;
    currentCreated = item.createdAt;
    loadBlob(item.blob);
    renderList();
  }

  // Crée un dessin vide, enregistré tout de suite pour apparaître dans la liste
  async function newDrawing() {
    await saveNow();
    clearHistory();
    currentId = KA.db.newId(KIND);
    currentCreated = Date.now();
    fillWhite();
    applyBrush();
    await saveNow();
  }

  function deleteCurrent(btn) {
    KA.armed(btn, async () => {
      const id = currentId;
      clearTimeout(saveTimer);
      saveTimer = null;
      currentId = null; // évite d'enregistrer de nouveau le dessin supprimé
      if (id) await KA.db.del(id);
      // On ouvre le dessin le plus récent restant ; un dessin vide n'est créé que s'il n'en reste aucun
      const items = await KA.db.list(KIND);
      if (items.length) await openDrawing(items[items.length - 1]);
      else await newDrawing();
    });
  }

  // ---------- Construction des boutons ----------
  function setTool(tool) {
    state.tool = tool;
    root.querySelectorAll(".tool").forEach((b) => b.classList.toggle("selected", b.dataset.tool === tool));
    root.querySelectorAll(".stamp").forEach((b) => b.classList.toggle("selected", tool === "stamp" && b.dataset.stamp === state.stamp));
    root.querySelector("#stamp-current").textContent = state.stamp;
    applyBrush();
  }

  // Aperçu : la forme choisie, à la taille réglée, dans la couleur du pinceau
  function drawBrushPreview() {
    if (!previewCtx) return;
    const w = preview.width;
    const h = preview.height;
    previewCtx.clearRect(0, 0, w, h);
    previewCtx.fillStyle = state.tool === "eraser" ? "#90a4ae" : state.color;
    previewCtx.strokeStyle = previewCtx.fillStyle;
    // brushPath dessine sur le contexte courant : on le remplace le temps de l'aperçu
    const saved = ctx;
    ctx = previewCtx;
    try {
      brushPath(state.brush, w / 2, h / 2, state.size / 2);
    } finally {
      ctx = saved;
    }
    root.querySelector("#brush-size-label").textContent = state.size + " px";
  }

  // Aperçu du tampon : l'emoji choisi, à la taille réglée
  function drawStampPreview() {
    if (!stampPreviewCtx) return;
    const w = stampPreview.width;
    const h = stampPreview.height;
    stampPreviewCtx.clearRect(0, 0, w, h);
    stampPreviewCtx.font = Math.round(state.stampSize) + "px sans-serif";
    stampPreviewCtx.textAlign = "center";
    stampPreviewCtx.textBaseline = "middle";
    stampPreviewCtx.fillText(state.stamp, w / 2, h / 2);
    root.querySelector("#stamp-size-label").textContent = state.stampSize + " px";
  }

  // Affiche la forme choisie sur le bouton du pinceau
  function refreshBrush() {
    const b = BRUSHES.find((x) => x.id === state.brush) || BRUSHES[0];
    root.querySelector("#brush-current").textContent = b.icon;
    root.querySelectorAll(".brush-btn").forEach((btn) => btn.classList.toggle("selected", btn.dataset.brush === state.brush));
    drawBrushPreview();
  }

  function refreshColors() {
    root.querySelectorAll(".swatch").forEach((b) => {
      b.classList.toggle("selected", state.tool !== "eraser" && b.dataset.hex === state.color);
    });
    root.querySelectorAll(".size").forEach((b) => b.classList.toggle("selected", Number(b.dataset.size) === state.size));
    const range = root.querySelector("#draw-size-range");
    if (range) range.value = state.size;
    drawBrushPreview();
    const stampRange = root.querySelector("#stamp-size-range");
    if (stampRange) stampRange.value = state.stampSize;
    drawStampPreview();
    root.querySelector("#color-current").style.background = state.color;
  }

  // ---------- Menus déroulants : couleurs et outils ----------
  function closeMenus() {
    root.querySelectorAll(".dd-menu").forEach((m) => (m.hidden = true));
  }

  function toggleMenu(selector) {
    const menu = root.querySelector(selector);
    const wasOpen = !menu.hidden;
    closeMenus();
    menu.hidden = wasOpen;
  }

  function setupMenus() {
    root.querySelector("#color-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu("#color-menu");
    });
    root.querySelector("#stamp-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu("#stamp-menu");
    });
    root.querySelector("#brush-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu("#brush-menu");
    });
    root.querySelector("#drawings-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu("#drawings-menu");
    });
    // Un choix dans un menu le referme
    root.querySelectorAll(".dd-menu").forEach((m) =>
      m.addEventListener("click", (e) => {
        // Un choix referme le menu, sauf le bouton Supprimer qui doit rester visible pour la confirmation
        if (e.target.closest("button") && !e.target.closest("[data-keep]")) closeMenus();
      })
    );
    // Un appui ailleurs referme les menus
    document.addEventListener("click", (e) => {
      if (!e.target.closest || !e.target.closest(".dropdown")) closeMenus();
    });
  }

  function buildTools() {
    const palette = root.querySelector("#draw-colors");
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = c.hex;
      b.dataset.hex = c.hex;
      b.setAttribute("aria-label", c.name);
      b.addEventListener("click", () => {
        state.color = c.hex;
        if (state.tool === "eraser") setTool("pen");
        refreshColors();
        applyBrush();
        KA.speak(c.name);
      });
      palette.appendChild(b);
    });

    // Formes du pinceau : un appui choisit la forme et repasse au crayon
    const brushBox = root.querySelector("#brush-shapes");
    BRUSHES.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "brush-btn";
      btn.dataset.brush = b.id;
      btn.textContent = b.icon;
      btn.setAttribute("aria-label", b.name);
      btn.addEventListener("click", () => {
        state.brush = b.id;
        setTool("pen");
        refreshBrush();
      });
      brushBox.appendChild(btn);
    });


    root.querySelector("#tool-pen").dataset.tool = "pen";
    root.querySelector("#tool-eraser").dataset.tool = "eraser";
    root.querySelector("#tool-bucket").dataset.tool = "bucket";
    root.querySelectorAll(".tool").forEach((b) =>
      b.addEventListener("click", () => {
        setTool(b.dataset.tool);
        refreshColors();
      })
    );

    const stamps = root.querySelector("#draw-stamps");
    STAMPS.forEach((s) => {
      const b = document.createElement("button");
      b.className = "stamp";
      b.dataset.stamp = s;
      b.textContent = s;
      b.setAttribute("aria-label", "Tampon " + s);
      b.addEventListener("click", () => {
        state.stamp = s;
        setTool("stamp");
        refreshColors();
      });
      stamps.appendChild(b);
    });

    undoBtn.addEventListener("click", undo);
    // Curseur : taille libre du pinceau, pour toutes les formes
    const range = root.querySelector("#draw-size-range");
    range.addEventListener("input", () => {
      state.size = Number(range.value);
      refreshColors();
      applyBrush();
    });

    // Curseur : taille du tampon (emoji)
    const stampRange = root.querySelector("#stamp-size-range");
    stampRange.addEventListener("input", () => {
      state.stampSize = Number(stampRange.value);
      drawStampPreview();
    });

    root.querySelector("#draw-new").addEventListener("click", newDrawing);
    root.querySelector("#draw-delete").addEventListener("click", (e) => deleteCurrent(e.currentTarget));
    setTool("pen");
    refreshColors();
    setupMenus();
    refreshBrush();
  }

  KA.panels.draw = {
    init(r) {
      root = r;
      canvas = root.querySelector("#draw-canvas");
      ctx = canvas.getContext("2d");
      undoBtn = root.querySelector("#draw-undo");
      preview = root.querySelector("#brush-preview");
      previewCtx = preview.getContext("2d");
      stampPreview = root.querySelector("#stamp-preview");
      stampPreviewCtx = stampPreview.getContext("2d");
      updateUndo();
      buildTools();
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      window.addEventListener("resize", () => {
        if (root.classList.contains("active")) resize();
      });
    },
    async enter() {
      resize();
      if (!currentId) {
        const items = await KA.db.list(KIND);
        if (items.length) await openDrawing(items[items.length - 1]);
        else await newDrawing();
      }
      renderList();
    },
    leave() {
      saveNow();
    },
  };
})();
