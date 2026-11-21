/* Coloriage à partir d'une photo : KA.lineArt(source, opts).
   Renvoie un canvas blanc avec des traits noirs qui FERMENT des zones, pour le pot de peinture.
   Méthode : flou, regroupement des couleurs (k-means), lissage des étiquettes,
   fusion des petites zones, puis tracé des frontières entre zones et agrandissement.
   source : HTMLImageElement, HTMLCanvasElement, ImageBitmap ou HTMLVideoElement.
   opts (facultatifs) :
   - levels   : nombre de couleurs de départ (défaut 6)
   - minArea  : taille minimale d'une zone, en fraction de l'image (défaut 0.004)
   - maxZones : nombre maximal de zones (défaut 40)
   - work     : plus grand côté de la version de travail, en px (défaut 360) */
(function () {
  "use strict";

  const KA = window.KA;
  const OUT = 1024;        // plus grand côté du résultat
  const BLUR_R = 2;        // rayon du flou boîte (3 passes ≈ flou gaussien)
  const KMEANS_ITER = 8;
  const MODE_PASSES = 2;   // lissage des étiquettes (filtre de mode 3×3)
  const MERGE_ROUNDS = 12; // nombre maximal de tours de fusion des petites zones
  const FRAME = 3;         // épaisseur du cadre noir (px, avant épaississement)

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function sourceSize(src) {
    if (typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement) {
      return { w: src.videoWidth, h: src.videoHeight };
    }
    if (typeof HTMLImageElement !== "undefined" && src instanceof HTMLImageElement) {
      return { w: src.naturalWidth, h: src.naturalHeight };
    }
    return { w: src.width, h: src.height };
  }

  // Pixels RGBA de la source à la taille tw×th.
  // Réduction par moitiés successives pour éviter l'aliasing sur les grosses photos.
  function readPixels(src, sw, sh, tw, th) {
    let cur = src;
    let cw = sw;
    let ch = sh;
    while (cw > tw * 2) {
      const nw = Math.max(tw, Math.floor(cw / 2));
      const nh = Math.max(th, Math.floor(ch / 2));
      const step = makeCanvas(nw, nh);
      step.getContext("2d").drawImage(cur, 0, 0, nw, nh);
      cur = step;
      cw = nw;
      ch = nh;
    }
    const c = makeCanvas(tw, th);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(cur, 0, 0, tw, th);
    return ctx.getImageData(0, 0, tw, th).data;
  }

  // Flou boîte de rayon r sur un canal (bords répétés). Somme glissante : coût constant par pixel.
  function boxBlur(src, dst, w, h, r) {
    const inv = 1 / (2 * r + 1);
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[row + clamp(k, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc * inv;
        acc += src[row + clamp(x + r + 1, 0, w - 1)] - src[row + clamp(x - r, 0, w - 1)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[clamp(k, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = acc * inv;
        acc += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
      }
    }
  }

  // Trois passes de flou boîte ≈ flou gaussien (sigma ≈ 2,5 px).
  function blurChannel(src, w, h) {
    let a = src;
    for (let p = 0; p < 3; p++) {
      const b = new Float32Array(src.length);
      boxBlur(a, b, w, h, BLUR_R);
      a = b;
    }
    return a;
  }

  // Regroupement des couleurs (k-means en RGB).
  // Départ déterministe : pixels classés par luminance en K groupes d'effectifs égaux.
  // Renvoie une étiquette (0..K-1) par pixel.
  function quantize(rr, gg, bb, N, K) {
    const lum = new Uint8Array(N);
    const hist = new Int32Array(256);
    for (let i = 0; i < N; i++) {
      const l = clamp(Math.round(0.299 * rr[i] + 0.587 * gg[i] + 0.114 * bb[i]), 0, 255);
      lum[i] = l;
      hist[l]++;
    }
    const groupOfLevel = new Uint8Array(256);
    let before = 0;
    for (let v = 0; v < 256; v++) {
      if (hist[v]) {
        const mid = (before + hist[v] / 2) / N;
        groupOfLevel[v] = Math.min(K - 1, Math.floor(mid * K));
      }
      before += hist[v];
    }

    const lab = new Uint8Array(N);
    const cr = new Float64Array(K);
    const cg = new Float64Array(K);
    const cb = new Float64Array(K);
    const cnt = new Float64Array(K);
    for (let i = 0; i < N; i++) {
      const g = groupOfLevel[lum[i]];
      lab[i] = g;
      cr[g] += rr[i];
      cg[g] += gg[i];
      cb[g] += bb[i];
      cnt[g]++;
    }
    for (let k = 0; k < K; k++) {
      if (cnt[k] > 0) {
        cr[k] /= cnt[k];
        cg[k] /= cnt[k];
        cb[k] /= cnt[k];
      } else {
        // Groupe vide : gris réparti, pour ne pas attirer les pixels noirs par défaut
        const v = (255 * (k + 0.5)) / K;
        cr[k] = v;
        cg[k] = v;
        cb[k] = v;
      }
    }

    for (let it = 0; it < KMEANS_ITER; it++) {
      const sr = new Float64Array(K);
      const sg = new Float64Array(K);
      const sb = new Float64Array(K);
      cnt.fill(0);
      for (let i = 0; i < N; i++) {
        const r = rr[i];
        const g = gg[i];
        const b = bb[i];
        let best = 0;
        let bd = Infinity;
        for (let k = 0; k < K; k++) {
          const dr = r - cr[k];
          const dg = g - cg[k];
          const db = b - cb[k];
          const d = dr * dr + dg * dg + db * db;
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        lab[i] = best;
        sr[best] += r;
        sg[best] += g;
        sb[best] += b;
        cnt[best]++;
      }
      for (let k = 0; k < K; k++) {
        if (cnt[k] > 0) {
          cr[k] = sr[k] / cnt[k];
          cg[k] = sg[k] / cnt[k];
          cb[k] = sb[k] / cnt[k];
        }
      }
    }
    return lab;
  }

  // Filtre de mode 3×3 : chaque pixel prend l'étiquette la plus fréquente autour de lui.
  // En cas d'égalité, on garde l'étiquette du pixel.
  function modeFilter(lab, w, h, K) {
    const out = new Uint8Array(lab.length);
    const cnt = new Int32Array(K);
    const nb = new Uint8Array(9);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = clamp(y + dy, 0, h - 1) * w;
          for (let dx = -1; dx <= 1; dx++) {
            const v = lab[yy + clamp(x + dx, 0, w - 1)];
            nb[n++] = v;
            cnt[v]++;
          }
        }
        const c = lab[y * w + x];
        let best = c;
        let bc = cnt[c];
        for (let j = 0; j < 9; j++) {
          const v = nb[j];
          if (cnt[v] > bc) {
            bc = cnt[v];
            best = v;
          }
        }
        for (let j = 0; j < 9; j++) cnt[nb[j]] = 0;
        out[y * w + x] = best;
      }
    }
    return out;
  }

  // Composantes connexes (4-connexité, pile itérative) d'une même étiquette.
  // Renvoie { reg : numéro de zone par pixel, R : nombre de zones }.
  function labelRegions(lab, w, h) {
    const N = w * h;
    const reg = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    let R = 0;
    for (let s = 0; s < N; s++) {
      if (reg[s] >= 0) continue;
      const L = lab[s];
      let sp = 0;
      stack[sp++] = s;
      reg[s] = R;
      while (sp > 0) {
        const i = stack[--sp];
        const x = i % w;
        const y = (i - x) / w;
        if (x > 0 && reg[i - 1] < 0 && lab[i - 1] === L) {
          reg[i - 1] = R;
          stack[sp++] = i - 1;
        }
        if (x < w - 1 && reg[i + 1] < 0 && lab[i + 1] === L) {
          reg[i + 1] = R;
          stack[sp++] = i + 1;
        }
        if (y > 0 && reg[i - w] < 0 && lab[i - w] === L) {
          reg[i - w] = R;
          stack[sp++] = i - w;
        }
        if (y < h - 1 && reg[i + w] < 0 && lab[i + w] === L) {
          reg[i + w] = R;
          stack[sp++] = i + w;
        }
      }
      R++;
    }
    return { reg, R };
  }

  // Fusion des zones : chaque zone trop petite (< minPix) est absorbée par le voisin
  // avec lequel elle partage la plus longue frontière. Si il reste plus de maxZones zones,
  // les plus petites sont aussi fusionnées. Modifie reg et renvoie le nouveau nombre de zones.
  function mergeRegions(reg, R, w, h, minPix, maxZones) {
    const N = w * h;
    for (let round = 0; round < MERGE_ROUNDS && R > 1; round++) {
      const size = new Int32Array(R);
      for (let i = 0; i < N; i++) size[reg[i]]++;

      // Longueur de frontière partagée entre paires de zones (clé = a*R+b, a<b)
      const adj = new Map();
      const note = (a, b) => {
        if (a === b) return;
        const key = a < b ? a * R + b : b * R + a;
        adj.set(key, (adj.get(key) || 0) + 1);
      };
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (x + 1 < w) note(reg[i], reg[i + 1]);
          if (y + 1 < h) note(reg[i], reg[i + w]);
        }
      }
      const bestN = new Int32Array(R).fill(-1);
      const bestLen = new Int32Array(R);
      for (const [key, len] of adj) {
        const a = Math.floor(key / R);
        const b = key - a * R;
        if (len > bestLen[a]) {
          bestLen[a] = len;
          bestN[a] = b;
        }
        if (len > bestLen[b]) {
          bestLen[b] = len;
          bestN[b] = a;
        }
      }

      // Zone trop fine (bande de 6 px ou moins, ex. anneau autour d'un soleil) : aucun pixel
      // dont les 7×7 voisins soient tous dans la même zone. Elle ne se remplit pas au doigt.
      const interior = new Uint8Array(R);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const r = reg[i];
          if (interior[r]) continue;
          let ok = true;
          for (let dy = -3; dy <= 3 && ok; dy++) {
            const yy = clamp(y + dy, 0, h - 1) * w;
            for (let dx = -3; dx <= 3; dx++) {
              if (reg[yy + clamp(x + dx, 0, w - 1)] !== r) {
                ok = false;
                break;
              }
            }
          }
          if (ok) interior[r] = 1;
        }
      }

      const pick = [];
      for (let r = 0; r < R; r++) {
        if (bestN[r] < 0) continue;
        if (size[r] < minPix || !interior[r]) pick.push(r);
      }
      if (pick.length === 0 && R > maxZones) {
        const order = [];
        for (let r = 0; r < R; r++) if (bestN[r] >= 0) order.push(r);
        order.sort((p, q) => size[p] - size[q]);
        for (let j = 0; j < R - maxZones && j < order.length; j++) pick.push(order[j]);
      }
      if (pick.length === 0) break;

      // Union-find pour enchaîner les fusions, puis renumérotation
      const parent = new Int32Array(R);
      for (let r = 0; r < R; r++) parent[r] = r;
      const find = (r) => {
        while (parent[r] !== r) {
          parent[r] = parent[parent[r]];
          r = parent[r];
        }
        return r;
      };
      for (const r of pick) {
        const a = find(r);
        const b = find(bestN[r]);
        if (a !== b) parent[a] = b;
      }
      const newId = new Int32Array(R).fill(-1);
      let R2 = 0;
      for (let r = 0; r < R; r++) {
        const root = find(r);
        if (newId[root] < 0) newId[root] = R2++;
      }
      const map = new Int32Array(R);
      for (let r = 0; r < R; r++) map[r] = newId[find(r)];
      for (let i = 0; i < N; i++) reg[i] = map[reg[i]];
      R = R2;
    }
    return R;
  }

  // Frontières de zones : un pixel est frontière si l'un de ses 4 voisins est dans une autre zone.
  // Les deux côtés de chaque bord sont marqués (bande de 2 px) : un chemin en 4-connexion
  // ne peut donc pas traverser la ligne, les zones restent fermées.
  function borders(reg, w, h) {
    const b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const r = reg[i];
        if ((x > 0 && reg[i - 1] !== r) || (x < w - 1 && reg[i + 1] !== r) ||
            (y > 0 && reg[i - w] !== r) || (y < h - 1 && reg[i + w] !== r)) b[i] = 1;
      }
    }
    return b;
  }

  // Poches blanches (zones vues au niveau des frontières) plus petites que minPix : rendues noires.
  // Leurs voisins sont tous des frontières, donc les autres zones ne changent pas.
  function dropSmallCells(bnd, w, h, minPix) {
    const cells = labelRegions(bnd, w, h);
    const reg = cells.reg;
    const size = new Int32Array(cells.R);
    const isLine = new Uint8Array(cells.R);
    for (let i = 0; i < reg.length; i++) {
      size[reg[i]]++;
      isLine[reg[i]] = bnd[i];
    }
    for (let i = 0; i < reg.length; i++) {
      const c = reg[i];
      if (!isLine[c] && size[c] < minPix) bnd[i] = 1;
    }
  }

  // Agrandit le masque des frontières (sans lissage), ajoute le cadre et dessine en noir
  // sur blanc pur. La bande de 2 px de travail donne des traits d'environ 5 à 6 px.
  function drawLines(bnd, w, h, ow, oh) {
    const mask = new Uint8Array(ow * oh);
    for (let Y = 0; Y < oh; Y++) {
      const wy = Math.min(h - 1, Math.floor((Y * h) / oh));
      for (let X = 0; X < ow; X++) {
        const wx = Math.min(w - 1, Math.floor((X * w) / ow));
        if (bnd[wy * w + wx]) mask[Y * ow + X] = 1;
      }
    }
    for (let Y = 0; Y < oh; Y++) {
      for (let X = 0; X < ow; X++) {
        if (X < FRAME || Y < FRAME || X >= ow - FRAME || Y >= oh - FRAME) mask[Y * ow + X] = 1;
      }
    }

    const c = makeCanvas(ow, oh);
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(ow, oh);
    const d = img.data;
    for (let p = 0; p < ow * oh; p++) {
      const v = mask[p] ? 0 : 255;
      d[p * 4] = v;
      d[p * 4 + 1] = v;
      d[p * 4 + 2] = v;
      d[p * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  KA.lineArt = function (source, opts) {
    const o = opts || {};
    const K = clamp(Math.round(o.levels || 6), 2, 12);
    const minFrac = o.minArea != null ? o.minArea : 0.004;
    const maxZones = o.maxZones || 40;
    const WORK = o.work || 360;

    const size = sourceSize(source);
    if (!size.w || !size.h) throw new Error("Image pas encore chargée");

    const m = Math.max(size.w, size.h);
    const ww = Math.max(1, Math.round((size.w * WORK) / m));
    const wh = Math.max(1, Math.round((size.h * WORK) / m));
    const ow = Math.max(1, Math.round((size.w * OUT) / m));
    const oh = Math.max(1, Math.round((size.h * OUT) / m));
    const N = ww * wh;

    // 1. Version réduite et séparation des canaux
    const px = readPixels(source, size.w, size.h, ww, wh);
    let rr = new Float32Array(N);
    let gg = new Float32Array(N);
    let bb = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      rr[i] = px[i * 4];
      gg[i] = px[i * 4 + 1];
      bb[i] = px[i * 4 + 2];
    }

    // 2. Flou fort : on enlève les détails
    rr = blurChannel(rr, ww, wh);
    gg = blurChannel(gg, ww, wh);
    bb = blurChannel(bb, ww, wh);

    // 3. Couleurs regroupées, puis étiquettes lissées
    let lab = quantize(rr, gg, bb, N, K);
    for (let p = 0; p < MODE_PASSES; p++) lab = modeFilter(lab, ww, wh, K);

    // 4. Zones fermées : composantes connexes, puis fusion des petites
    const labelled = labelRegions(lab, ww, wh);
    const reg = labelled.reg;
    const minPix = Math.max(4, Math.round(N * minFrac));
    mergeRegions(reg, labelled.R, ww, wh, minPix, maxZones);

    // 5. Frontières, puis petites poches blanches enfermées (une zone trop petite
    //    pour un doigt devient un trait noir), agrandissement à 1024 px, noir sur blanc
    const bnd = borders(reg, ww, wh);
    dropSmallCells(bnd, ww, wh, minPix);
    return drawLines(bnd, ww, wh, ow, oh);
  };
})();
