/* Panneau de dessin : couleurs, pinceaux, gomme, sauvegarde automatique */
(function () {
  "use strict";

  const KA = window.KA;
  const KEY = "drawing-current";
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

  const state = { color: COLORS[4].hex, size: SIZES[1], erasing: false };
  let canvas = null;
  let ctx = null;
  let scale = 1; // pixels du canvas par pixel CSS
  let loaded = false;
  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let saveTimer = null;
  let colorBtns = [];
  let sizeBtns = [];
  let eraserBtn = null;
  let clearBtn = null;

  function applyBrush() {
    if (!ctx) return;
    const color = state.erasing ? "#ffffff" : state.color;
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

  function loadSaved() {
    KA.db.get(KEY).then((item) => {
      if (!item || !item.blob) return;
      const img = new Image();
      const url = URL.createObjectURL(item.blob);
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * scale, (e.clientY - r.top) * scale];
  }

  function down(e) {
    if (!ctx) return;
    applyBrush();
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    [lastX, lastY] = pos(e);
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

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }

  function save() {
    canvas.toBlob((blob) => {
      if (blob) KA.db.put({ id: KEY, kind: "drawing", createdAt: Date.now(), blob });
    }, "image/png");
  }

  function refreshTools() {
    colorBtns.forEach(({ el, hex }) => el.classList.toggle("selected", !state.erasing && hex === state.color));
    sizeBtns.forEach(({ el, size }) => el.classList.toggle("selected", size === state.size));
    eraserBtn.classList.toggle("selected", state.erasing);
  }

  function buildTools(root) {
    const palette = root.querySelector("#draw-colors");
    COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.className = "swatch";
      b.style.background = c.hex;
      b.setAttribute("aria-label", c.name);
      b.addEventListener("click", () => {
        state.color = c.hex;
        state.erasing = false;
        refreshTools();
        applyBrush();
        KA.speak(c.name);
      });
      palette.appendChild(b);
      colorBtns.push({ el: b, hex: c.hex });
    });

    const sizes = root.querySelector("#draw-sizes");
    SIZES.forEach((s) => {
      const b = document.createElement("button");
      b.className = "size";
      b.setAttribute("aria-label", "Épaisseur " + s);
      const dot = document.createElement("span");
      dot.style.width = dot.style.height = s + "px";
      b.appendChild(dot);
      b.addEventListener("click", () => {
        state.size = s;
        state.erasing = false;
        refreshTools();
        applyBrush();
      });
      sizes.appendChild(b);
      sizeBtns.push({ el: b, size: s });
    });

    eraserBtn = root.querySelector("#draw-eraser");
    eraserBtn.addEventListener("click", () => {
      state.erasing = !state.erasing;
      refreshTools();
      applyBrush();
      KA.speak(state.erasing ? "Gomme" : "Crayon");
    });

    clearBtn = root.querySelector("#draw-clear");
    clearBtn.addEventListener("click", () =>
      KA.armed(clearBtn, () => {
        fillWhite();
        applyBrush();
        KA.db.del(KEY);
      })
    );
    refreshTools();
  }

  KA.panels.draw = {
    init(root) {
      canvas = root.querySelector("#draw-canvas");
      ctx = canvas.getContext("2d");
      buildTools(root);
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      window.addEventListener("resize", () => {
        if (root.classList.contains("active")) resize();
      });
    },
    enter() {
      resize();
      if (!loaded && canvas.width) {
        loaded = true;
        loadSaved();
      }
    },
    leave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        save();
      }
    },
  };
})();
