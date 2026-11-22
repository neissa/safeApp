/* Coloriage à partir d'une photo : KA.lineArt(source, opts) → canvas blanc avec des traits noirs.
   1. Les contours sont tracés par photo-to-coloring-page (js/vendor, licence MIT) :
      lissage qui garde les bords, différence de gaussiennes, seuil par hystérésis, suppression des miettes.
   2. Cette bibliothèque ne garantit pas des formes fermées. Ici on prépare l'image pour le pot de peinture :
      cadre noir sur le bord, fermeture des traits (dilatation puis érosion) pour boucher les petits trous,
      et les minuscules zones blanches deviennent noires.
   source : HTMLImageElement, HTMLCanvasElement, ImageBitmap ou HTMLVideoElement.
   opts (facultatifs) :
   - detail     : "low" (défaut), "medium" ou "high" (préréglages de la bibliothèque)
   - smoothing  : passes de lissage qui gardent les bords (défaut 8 : poils, herbe, feuilles s'effacent)
   - threshold  : seuil des contours forts (défaut 9 : seuls les contours nets restent)
   - lineWeight : épaisseur des traits (défaut 1.2)
   - close      : rayon de fermeture des trous, en px sur l’image de 1024 px (défaut 4)
   - minArea    : plus petite zone blanche gardée, en fraction de l’image (défaut 0.0003) */
(function () {
  "use strict";
  const KA = window.KA;

  const OUT = 1024; // plus grand côté du coloriage
  const SRC = 1280; // plus grand côté de la photo envoyée à la bibliothèque
  const BORDER = 3; // cadre noir (ferme les zones qui touchent le bord)

  function sourceSize(s) {
    return {
      w: s.videoWidth || s.naturalWidth || s.width || 0,
      h: s.videoHeight || s.naturalHeight || s.height || 0,
    };
  }

  // Dilatation (isMax) ou érosion d'un masque 0/1, fenêtre carrée de rayon r, en deux passes (lignes puis colonnes).
  // Hors de l'image : vide pour la dilatation, plein pour l'érosion (le cadre reste fermé).
  function morph(a, W, H, r, isMax) {
    const out = isMax ? 0 : 1;
    const t = new Uint8Array(W * H);
    const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        let v = isMax ? 0 : 1;
        for (let k = -r; k <= r; k++) {
          const xx = x + k;
          const s = xx < 0 || xx >= W ? out : a[row + xx];
          if (isMax ? s : !s) { v = s; break; }
        }
        t[row + x] = v;
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = isMax ? 0 : 1;
        for (let k = -r; k <= r; k++) {
          const yy = y + k;
          const s = yy < 0 || yy >= H ? out : t[yy * W + x];
          if (isMax ? s : !s) { v = s; break; }
        }
        o[y * W + x] = v;
      }
    }
    return o;
  }

  // Les zones blanches plus petites que minPx deviennent des traits (4-connexité, pile itérative).
  function fillTinyZones(ink, W, H, minPx) {
    const n = W * H;
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    const comp = new Int32Array(n);
    for (let s = 0; s < n; s++) {
      if (ink[s] || seen[s]) continue;
      let sp = 0;
      let cn = 0;
      stack[sp++] = s;
      seen[s] = 1;
      while (sp) {
        const p = stack[--sp];
        comp[cn++] = p;
        const x = p % W;
        if (x > 0 && !ink[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[sp++] = p - 1; }
        if (x < W - 1 && !ink[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[sp++] = p + 1; }
        if (p >= W && !ink[p - W] && !seen[p - W]) { seen[p - W] = 1; stack[sp++] = p - W; }
        if (p < n - W && !ink[p + W] && !seen[p + W]) { seen[p + W] = 1; stack[sp++] = p + W; }
      }
      if (cn < minPx) for (let k = 0; k < cn; k++) ink[comp[k]] = 1;
    }
  }

  KA.lineArt = function (source, opts) {
    const o = opts || {};
    if (typeof KA.photoToColoringPage !== "function") throw new Error("photo-to-coloring-page n'est pas chargé");
    const size = sourceSize(source);
    if (!size.w || !size.h) throw new Error("Image pas encore chargée");

    // 1. Pixels de la photo (réduite si besoin)
    const s = Math.min(1, SRC / Math.max(size.w, size.h));
    const cw = Math.max(1, Math.round(size.w * s));
    const ch = Math.max(1, Math.round(size.h * s));
    const src = document.createElement("canvas");
    src.width = cw;
    src.height = ch;
    const sctx = src.getContext("2d", { willReadFrequently: true });
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, cw, ch);
    sctx.drawImage(source, 0, 0, cw, ch);

    // 2. Contours par la bibliothèque
    const res = KA.photoToColoringPage(sctx.getImageData(0, 0, cw, ch), {
      detail: o.detail || "low",
      smoothing: o.smoothing != null ? o.smoothing : 8,
      threshold: o.threshold != null ? o.threshold : 9,
      outputSize: OUT,
      lineWeight: o.lineWeight || 1.2,
    });
    const W = res.width;
    const H = res.height;
    const n = W * H;
    let ink = new Uint8Array(n);
    for (let p = 0; p < n; p++) if (res.data[p * 4] < 128) ink[p] = 1;

    // 3. Cadre, fermeture des trous, petites zones bouchées
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x < BORDER || y < BORDER || x >= W - BORDER || y >= H - BORDER) ink[y * W + x] = 1;
      }
    }
    const r = o.close != null ? o.close : 4;
    if (r > 0) ink = morph(morph(ink, W, H, r, true), W, H, r, false);
    fillTinyZones(ink, W, H, Math.round((o.minArea != null ? o.minArea : 0.0003) * n));

    // 4. Canvas final, noir sur blanc
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(W, H);
    const d = img.data;
    for (let p = 0; p < n; p++) {
      const v = ink[p] ? 0 : 255;
      d[p * 4] = v;
      d[p * 4 + 1] = v;
      d[p * 4 + 2] = v;
      d[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };
})();
