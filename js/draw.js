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

  const state = { color: COLORS[4].hex, size: SIZES[1], tool: "pen", stamp: STAMPS[0] };
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
    ctx.font = Math.round(44 * scale) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(state.stamp, x, y);
    ctx.restore();
    scheduleSave();
  }

  function down(e) {
    if (!ctx) return;
    applyBrush();
    const [x, y] = pos(e);
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
    canvas.setPointerCapture(e.pointerId);
    lastX = x;
    lastY = y;
    ctx.beginPath();
    ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function move(e) {
    if (!drawing) return;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
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
    currentId = item.id;
    currentCreated = item.createdAt;
    loadBlob(item.blob);
    renderList();
  }

  // Crée un dessin vide, enregistré tout de suite pour apparaître dans la liste
  async function newDrawing() {
    await saveNow();
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

  function refreshColors() {
    root.querySelectorAll(".swatch").forEach((b) => {
      b.classList.toggle("selected", state.tool !== "eraser" && b.dataset.hex === state.color);
    });
    root.querySelectorAll(".size").forEach((b) => b.classList.toggle("selected", Number(b.dataset.size) === state.size));
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
    // Un choix dans un menu le referme
    root.querySelectorAll(".dd-menu").forEach((m) =>
      m.addEventListener("click", (e) => {
        if (e.target.closest("button")) closeMenus();
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

    const sizes = root.querySelector("#draw-sizes");
    SIZES.forEach((s) => {
      const b = document.createElement("button");
      b.className = "size";
      b.dataset.size = s;
      b.setAttribute("aria-label", "Épaisseur " + s);
      const dot = document.createElement("span");
      dot.style.width = dot.style.height = s + "px";
      b.appendChild(dot);
      b.addEventListener("click", () => {
        state.size = s;
        if (state.tool === "bucket" || state.tool === "stamp") setTool("pen");
        refreshColors();
        applyBrush();
      });
      sizes.appendChild(b);
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

    root.querySelector("#draw-new").addEventListener("click", newDrawing);
    root.querySelector("#draw-delete").addEventListener("click", (e) => deleteCurrent(e.currentTarget));
    setTool("pen");
    refreshColors();
    setupMenus();
  }

  KA.panels.draw = {
    init(r) {
      root = r;
      canvas = root.querySelector("#draw-canvas");
      ctx = canvas.getContext("2d");
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
