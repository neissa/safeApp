/* Panneau coloriage : l'enfant choisit un dessin en noir et blanc (ou une photo transformée en dessin
   par KA.lineArt), puis touche les zones pour les remplir de couleur. Chaque coloriage est sauvegardé. */
(function () {
  "use strict";

  const KA = window.KA;
  const MAX_SIDE = 1024; // taille interne du canvas (le CSS met à l'échelle)
  const SRC_MAX = 1280; // taille maximale de la photo envoyée à KA.lineArt
  const HISTORY_MAX = 10; // nombre d’annulations possibles (chaque copie pèse 4 Mo)
  const BARRIER_LUM = 160; // un pixel plus sombre que ça est un trait qui arrête le remplissage
  const GROW = 2; // le remplissage déborde de 2 px sur les traits (évite un liseré blanc)

  // 16 couleurs : le blanc sert de gomme
  const COLORS = [
    { hex: "#e53935", name: "rouge" },
    { hex: "#fb8c00", name: "orange" },
    { hex: "#fdd835", name: "jaune" },
    { hex: "#9ccc65", name: "vert clair" },
    { hex: "#2e7d32", name: "vert foncé" },
    { hex: "#81d4fa", name: "bleu ciel" },
    { hex: "#1e88e5", name: "bleu" },
    { hex: "#8e24aa", name: "violet" },
    { hex: "#f06292", name: "rose" },
    { hex: "#6d4c41", name: "marron" },
    { hex: "#f5cba7", name: "beige" },
    { hex: "#9e9e9e", name: "gris" },
    { hex: "#000000", name: "noir" },
    { hex: "#ffffff", name: "blanc" },
    { hex: "#26c6da", name: "turquoise" },
    { hex: "#ff4081", name: "rose bonbon" },
  ];

  let root = null;
  let els = {};
  let selected = 0; // couleur choisie (index dans COLORS)
  let stream = null; // flux de la caméra
  let urls = []; // URLs d'objets à libérer au prochain affichage
  let cur = null; // dessin ouvert : { id, ico, name, createdAt }
  let W = 0; // taille interne du dessin
  let H = 0;
  let traits = null; // canvas des traits (noir sur blanc)
  let colors = null; // canvas des couleurs (même taille, fond blanc)
  let colorsCtx = null;
  let barrier = null; // Uint8Array : 1 = pixel de trait
  let history = []; // anciens états du canvas couleurs (pour annuler)
  let dirty = false; // vrai si une modification n'est pas encore sauvegardée
  let saveTimer = null;

  // ---------- Outils de canvas ----------
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // Charge une image depuis une URL, des données SVG ou un blob
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let objectUrl = null;
      img.onload = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error("image illisible"));
      };
      if (typeof src === "string") {
        img.src = src;
      } else {
        objectUrl = URL.createObjectURL(src);
        img.src = objectUrl;
      }
    });
  }

  // Copie d'une image ou d'un canvas réduit pour tenir dans « max » pixels
  function scaledCanvas(src, sw, sh, max) {
    const s = Math.min(1, max / Math.max(sw, sh));
    const c = makeCanvas(Math.max(1, Math.round(sw * s)), Math.max(1, Math.round(sh * s)));
    c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  function fitDims(w, h) {
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }

  function hasLineArt() {
    return typeof KA.lineArt === "function";
  }

  function canLive() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // ---------- Affichage : canvas couleurs, puis traits par-dessus en « multiply » ----------
  function render() {
    const ctx = els.canvas.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(colors, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(traits, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  // Les traits deviennent la barrière : un pixel sombre (trait) arrête le remplissage
  function buildTraits(img, w, h) {
    traits = makeCanvas(w, h);
    const t = traits.getContext("2d");
    t.fillStyle = "#ffffff";
    t.fillRect(0, 0, w, h);
    t.drawImage(img, 0, 0, w, h);
    const d = t.getImageData(0, 0, w, h).data;
    barrier = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < BARRIER_LUM) barrier[p] = 1;
    }
  }

  // ---------- Remplissage ----------
  // Pixels de la zone (composante connexe des pixels sans trait) qui contient « start », puis 2 px de trait en plus.
  // Pile itérative (pas de récursion) et tableau « vu » : marche même sur une très grande zone.
  function regionFrom(start) {
    const n = W * H;
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    const list = [];
    let sp = 0;
    const tryAdd = (q) => {
      if (!seen[q] && !barrier[q]) {
        seen[q] = 1;
        stack[sp++] = q;
      }
    };
    seen[start] = 1;
    stack[sp++] = start;
    while (sp > 0) {
      const p = stack[--sp];
      list.push(p);
      const x = p % W;
      if (x > 0) tryAdd(p - 1);
      if (x < W - 1) tryAdd(p + 1);
      if (p >= W) tryAdd(p - W);
      if (p < n - W) tryAdd(p + W);
    }
    // Déborde de GROW px dans les traits voisins
    const grow = (q) => {
      if (!seen[q] && barrier[q]) {
        seen[q] = 1;
        list.push(q);
      }
    };
    let from = 0;
    for (let pass = 0; pass < GROW; pass++) {
      const end = list.length;
      for (let i = from; i < end; i++) {
        const p = list[i];
        const x = p % W;
        if (x > 0) grow(p - 1);
        if (x < W - 1) grow(p + 1);
        if (p >= W) grow(p - W);
        if (p < n - W) grow(p + W);
      }
      from = end;
    }
    return list;
  }

  function fillAt(clientX, clientY) {
    if (!cur || !colorsCtx) return;
    const r = els.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - r.left) * (W / r.width));
    const y = Math.floor((clientY - r.top) * (H / r.height));
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const start = y * W + x;
    if (barrier[start]) return; // on a touché un trait noir : rien ne se passe

    const region = regionFrom(start);
    const hex = COLORS[selected].hex;
    const cr = parseInt(hex.slice(1, 3), 16);
    const cg = parseInt(hex.slice(3, 5), 16);
    const cb = parseInt(hex.slice(5, 7), 16);

    const img = colorsCtx.getImageData(0, 0, W, H);
    const d = img.data;
    pushHistory(new Uint8ClampedArray(d));
    for (let i = 0; i < region.length; i++) {
      const k = region[i] * 4;
      d[k] = cr;
      d[k + 1] = cg;
      d[k + 2] = cb;
      d[k + 3] = 255;
    }
    colorsCtx.putImageData(img, 0, 0);
    render();
    scheduleSave();
    if (typeof KA.tone === "function") KA.tone(784, 0.2, "triangle", 0.2); // petit son de réussite
  }

  // ---------- Annuler ----------
  function pushHistory(data) {
    history.push(data);
    if (history.length > HISTORY_MAX) history.shift();
    updateUndo();
  }

  function updateUndo() {
    if (els.undo) els.undo.disabled = history.length === 0;
  }

  function undo() {
    if (!cur || !history.length) return;
    colorsCtx.putImageData(new ImageData(history.pop(), W, H), 0, 0);
    render();
    updateUndo();
    scheduleSave();
  }

  // Remet tout en blanc (annulable)
  function resetColors() {
    if (!cur) return;
    pushHistory(colorsCtx.getImageData(0, 0, W, H).data);
    colorsCtx.fillStyle = "#ffffff";
    colorsCtx.fillRect(0, 0, W, H);
    render();
    scheduleSave();
  }

  // ---------- Sauvegarde (KA.db, kind « coloriage-work ») ----------
  function makeThumb() {
    const s = Math.min(1, 200 / Math.max(W, H));
    const t = makeCanvas(Math.max(1, Math.round(W * s)), Math.max(1, Math.round(H * s)));
    const x = t.getContext("2d");
    x.drawImage(colors, 0, 0, t.width, t.height);
    x.globalCompositeOperation = "multiply";
    x.drawImage(traits, 0, 0, t.width, t.height);
    return t;
  }

  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  }

  // Écrit le coloriage ouvert. Les canvas sont copiés tout de suite, donc on peut changer de dessin ensuite.
  function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!cur || !dirty) return Promise.resolve();
    dirty = false;
    const id = "coloriage-" + cur.id;
    const createdAt = cur.createdAt;
    const pending = Promise.all([toBlob(colors), toBlob(makeThumb())]);
    return pending
      .then(([blob, thumb]) => KA.db.put({ id, kind: "coloriage-work", createdAt, blob, thumb }))
      .catch(() => {
        /* stockage indisponible : le dessin reste à l'écran */
      });
  }

  function flushSave() {
    return dirty ? saveNow() : Promise.resolve();
  }

  // ---------- Ouvrir un dessin ----------
  // art : { id, ico, name, src (URL ou blob), photo (vrai pour une photo transformée) }
  async function openArt(art) {
    await flushSave();
    cur = null;
    const img = await loadImage(art.src);
    const size = art.photo ? fitDims(img.naturalWidth, img.naturalHeight) : { w: MAX_SIDE, h: MAX_SIDE };
    W = size.w;
    H = size.h;
    buildTraits(img, W, H);
    colors = makeCanvas(W, H);
    colorsCtx = colors.getContext("2d", { willReadFrequently: true });
    colorsCtx.fillStyle = "#ffffff";
    colorsCtx.fillRect(0, 0, W, H);

    // Couleurs déjà sauvegardées pour ce dessin
    let saved = null;
    try {
      saved = await KA.db.get("coloriage-" + art.id);
    } catch (e) {
      saved = null;
    }
    if (saved && saved.blob) {
      try {
        const simg = await loadImage(saved.blob);
        colorsCtx.drawImage(simg, 0, 0, W, H);
      } catch (e) {
        /* image sauvegardée illisible : on repart d'une feuille blanche */
      }
    }

    els.canvas.width = W;
    els.canvas.height = H;
    els.canvas.style.setProperty("--r", String(W / H));
    history = [];
    updateUndo();
    cur = {
      id: art.id,
      ico: art.ico,
      name: art.name,
      createdAt: saved && saved.createdAt ? saved.createdAt : Date.now(),
    };
    render();
    showView("work");
  }

  // ---------- Transformer une photo en dessin ----------
  function busy(on) {
    if (els.busy) els.busy.hidden = !on;
  }

  // source : canvas de la photo (ou de la vidéo). Renvoie le coloriage créé, puis l'ouvre.
  async function makeFromSource(source) {
    if (!hasLineArt()) return;
    busy(true);
    try {
      const out = await KA.lineArt(source);
      const blob = await toBlob(out);
      const id = KA.db.newId("coloriage-photo");
      await KA.db.put({ id, kind: "coloriage-photo", createdAt: Date.now(), blob });
      busy(false);
      await openArt({ id, ico: "📷", name: "Ma photo", src: blob, photo: true });
    } catch (e) {
      busy(false);
      KA.speak("Je n'arrive pas à faire le dessin");
      showView("choose");
    }
  }

  // Image de la galerie ou du fichier choisi : réduite, puis transformée
  async function fromBlob(blob) {
    busy(true);
    try {
      const img = await loadImage(blob);
      const c = scaledCanvas(img, img.naturalWidth, img.naturalHeight, SRC_MAX);
      busy(false);
      await makeFromSource(c);
    } catch (e) {
      busy(false);
      KA.speak("Je n'arrive pas à lire cette image");
      showView("choose");
    }
  }

  // ---------- Caméra ----------
  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    if (els.video) els.video.srcObject = null;
  }

  async function openCamera() {
    if (!canLive()) {
      els.file.click(); // repli : appareil photo natif
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      els.video.srcObject = stream;
      showView("cam");
    } catch (e) {
      KA.speak("Je ne peux pas utiliser la caméra");
      els.file.click();
    }
  }

  async function shoot() {
    if (!stream || !els.video.videoWidth) return;
    const c = scaledCanvas(els.video, els.video.videoWidth, els.video.videoHeight, SRC_MAX);
    stopCamera();
    KA.speak("Clic !");
    showView("choose");
    await makeFromSource(c);
  }

  // ---------- Vues : choix, photos de la galerie, caméra, coloriage ----------
  function showView(name) {
    els.choose.hidden = name !== "choose";
    els.pick.hidden = name !== "pick";
    els.cam.hidden = name !== "cam";
    els.work.hidden = name !== "work";
    root.classList.toggle("colo-working", name === "work");
  }

  // Une vignette : image (ou emoji), nom en petit, et éventuellement une croix 🗑️
  function makeCard(opts) {
    const card = document.createElement("div");
    card.className = "colo-card";
    const b = document.createElement("button");
    b.className = "colo-open" + (opts.big ? " colo-big" : "");
    b.setAttribute("aria-label", opts.label);
    if (opts.say) b.dataset.say = opts.say;
    if (opts.src) {
      const img = document.createElement("img");
      img.src = opts.src;
      img.alt = "";
      b.appendChild(img);
    } else {
      b.textContent = opts.ico;
    }
    if (opts.name) {
      const n = document.createElement("span");
      n.className = "colo-name";
      n.textContent = opts.ico && opts.src ? opts.ico + " " + opts.name : opts.name;
      b.appendChild(n);
    }
    b.addEventListener("click", () => {
      if (opts.say) KA.speak(opts.say);
      opts.onOpen();
    });
    card.appendChild(b);
    if (opts.onDelete) {
      const del = document.createElement("button");
      del.className = "chip colo-del";
      del.textContent = "🗑️";
      del.setAttribute("aria-label", "Supprimer ce coloriage");
      del.addEventListener("click", () => KA.armed(del, opts.onDelete));
      card.appendChild(del);
    }
    return card;
  }

  function revokeUrls() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  }

  function objectUrl(blob) {
    const u = URL.createObjectURL(blob);
    urls.push(u);
    return u;
  }

  // Grille de choix : boutons photo, puis coloriages faits avec une photo, puis dessins de la liste
  async function renderChoose() {
    revokeUrls();
    const grid = els.grid;
    grid.innerHTML = "";
    if (hasLineArt()) {
      grid.appendChild(
        makeCard({
          big: true,
          ico: "📷",
          label: "Faire un coloriage avec une photo",
          say: "Photo",
          onOpen: () => (canLive() ? openCamera() : els.file.click()),
        })
      );
      grid.appendChild(
        makeCard({
          big: true,
          ico: "🖼️",
          label: "Choisir une photo de la galerie",
          say: "Galerie",
          onOpen: openPick,
        })
      );
    }

    if (hasLineArt()) {
      const photos = (await KA.db.list("coloriage-photo")).slice().reverse(); // les plus récents d'abord
      for (const p of photos) {
        const work = await KA.db.get("coloriage-" + p.id).catch(() => null);
        const src = work && work.thumb ? objectUrl(work.thumb) : objectUrl(p.blob);
        grid.appendChild(
          makeCard({
            src,
            ico: "📷",
            name: "Ma photo",
            label: "Coloriage fait avec une photo",
            say: "Ma photo",
            onOpen: () => openArt({ id: p.id, ico: "📷", name: "Ma photo", src: p.blob, photo: true }),
            onDelete: async () => {
              await KA.db.del(p.id);
              await KA.db.del("coloriage-" + p.id);
              renderChoose();
            },
          })
        );
      }
    }

    for (const c of KA.coloriages) {
      const work = await KA.db.get("coloriage-" + c.id).catch(() => null);
      const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(c.svg);
      const src = work && work.thumb ? objectUrl(work.thumb) : svgUrl;
      grid.appendChild(
        makeCard({
          src,
          ico: c.ico,
          name: c.name,
          label: c.name,
          say: c.name,
          onOpen: () => openArt({ id: c.id, ico: c.ico, name: c.name, src: svgUrl, photo: false }),
        })
      );
    }
  }

  // Photos de la galerie à transformer
  async function openPick() {
    revokeUrls();
    const grid = els.pickGrid;
    grid.innerHTML = "";
    const photos = (await KA.db.list("photo")).slice().reverse();
    els.pickEmpty.hidden = photos.length > 0;
    photos.forEach((p) => {
      const b = document.createElement("button");
      b.className = "colo-pick-item";
      b.setAttribute("aria-label", "Choisir cette photo");
      const img = document.createElement("img");
      img.src = objectUrl(p.blob);
      img.alt = "";
      b.appendChild(img);
      b.addEventListener("click", () => fromBlob(p.blob));
      grid.appendChild(b);
    });
    showView("pick");
  }

  // ---------- Palette ----------
  function markColor() {
    els.palette.querySelectorAll(".colo-dot").forEach((b, i) => {
      b.classList.toggle("on", i === selected);
      b.setAttribute("aria-pressed", i === selected ? "true" : "false");
    });
  }

  function buildPalette() {
    els.palette.innerHTML = "";
    COLORS.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "colo-dot";
      b.style.background = c.hex;
      b.setAttribute("aria-label", c.name === "blanc" ? "Blanc, gomme" : c.name);
      b.dataset.say = c.name;
      b.addEventListener("click", () => {
        selected = i;
        markColor();
        KA.speak(c.name);
      });
      els.palette.appendChild(b);
    });
    markColor();
  }

  // ---------- Panneau ----------
  KA.panels.coloriage = {
    init(r) {
      root = r;
      els = {
        choose: root.querySelector("#colo-choose"),
        grid: root.querySelector("#colo-grid"),
        pick: root.querySelector("#colo-pick"),
        pickGrid: root.querySelector("#colo-pick-grid"),
        pickEmpty: root.querySelector("#colo-pick-empty"),
        work: root.querySelector("#colo-work"),
        canvas: root.querySelector("#colo-canvas"),
        palette: root.querySelector("#colo-palette"),
        undo: root.querySelector("#colo-undo"),
        reset: root.querySelector("#colo-reset"),
        list: root.querySelector("#colo-back-list"),
        cam: root.querySelector("#colo-cam"),
        video: root.querySelector("#colo-video"),
        shot: root.querySelector("#colo-shot"),
        camClose: root.querySelector("#colo-cam-close"),
        file: root.querySelector("#colo-file"),
        busy: root.querySelector("#colo-busy"),
      };
      buildPalette();

      els.canvas.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        fillAt(e.clientX, e.clientY);
      });
      els.list.addEventListener("click", async () => {
        await flushSave();
        cur = null;
        history = [];
        renderChoose();
        showView("choose");
      });
      els.undo.addEventListener("click", undo);
      els.reset.addEventListener("click", () => KA.armed(els.reset, resetColors));
      els.shot.addEventListener("click", shoot);
      els.camClose.addEventListener("click", () => {
        stopCamera();
        showView("choose");
      });
      root.querySelector("#colo-pick-close").addEventListener("click", () => showView("choose"));
      els.file.addEventListener("change", () => {
        const f = els.file.files && els.file.files[0];
        els.file.value = "";
        if (f) fromBlob(f);
      });
    },
    enter() {
      renderChoose();
      showView("choose");
    },
    leave() {
      stopCamera();
      flushSave();
      cur = null;
      history = [];
      revokeUrls();
      busy(false);
    },
  };
})();
