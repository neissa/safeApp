/* Outils communs à tous les panneaux :
   - appuis secrets (5 appuis rapides),
   - question de contrôle pour les adultes,
   - éléments de liste et boutons standard. */
(function () {
  "use strict";

  const KA = window.KA;

  // Exécute « cb » après « count » appuis rapides sur l'élément
  KA.tap = function (el, count, cb, windowMs) {
    const win = windowMs || 4000;
    let times = [];
    el.addEventListener("click", () => {
      const now = Date.now();
      times = times.filter((t) => now - t < win);
      times.push(now);
      if (times.length >= count) {
        times = [];
        cb();
      }
    });
  };

  // Petite addition que seul un adulte doit résoudre avant d'ouvrir un réglage
  KA.challenge = function (onOk) {
    const box = document.getElementById("challenge");
    const q = document.getElementById("challenge-q");
    const input = document.getElementById("challenge-a");
    const msg = document.getElementById("challenge-msg");
    const okBtn = document.getElementById("challenge-ok");
    const noBtn = document.getElementById("challenge-no");

    const a = 12 + Math.floor(Math.random() * 28);
    const b = 12 + Math.floor(Math.random() * 28);
    const answer = a + b;
    q.textContent = "Réservé aux adultes : combien font " + a + " + " + b + " ?";
    input.value = "";
    msg.textContent = "";
    box.hidden = false;
    input.focus();

    function close() {
      box.hidden = true;
      okBtn.removeEventListener("click", check);
      noBtn.removeEventListener("click", close);
      input.removeEventListener("keydown", onKey);
    }
    function check() {
      if (Number(input.value) === answer) {
        close();
        onOk();
      } else {
        msg.textContent = "Ce n'est pas la bonne réponse";
        input.value = "";
        input.focus();
      }
    }
    function onKey(e) {
      if (e.key === "Enter") check();
    }

    okBtn.addEventListener("click", check);
    noBtn.addEventListener("click", close);
    input.addEventListener("keydown", onKey);
  };

  // Bouton rond à icône (utilisé dans les listes)
  KA.chip = function (icon, label, onClick) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = icon;
    b.setAttribute("aria-label", label);
    if (onClick) b.addEventListener("click", onClick);
    return b;
  };

  // Vignette (pochette, photo…) ; masquée si pas d'image
  KA.cover = function (src) {
    const img = document.createElement("img");
    img.className = "cover";
    img.alt = "";
    img.loading = "lazy";
    if (src) img.src = src;
    else img.hidden = true;
    return img;
  };

  // Ligne de liste : [éléments de gauche] [libellé] [éléments de droite]
  KA.listItem = function (opts) {
    const li = document.createElement("li");
    li.className = "row-item" + (opts.playing ? " playing" : "");
    const name = document.createElement("span");
    name.className = "row-name";
    name.textContent = opts.label || "";
    li.append(...(opts.leading || []), name, ...(opts.trailing || []));
    return li;
  };

  // Une note synthétisée (piano, memory…). Respecte le réglage des bruitages et l'arrêt pendant un enregistrement.
  let toneCtx = null;
  KA.tone = function (freq, dur, type, vol) {
    try {
      if (KA.quiet || !KA.settings.get("sounds", true)) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      toneCtx = toneCtx || new AC();
      const t = toneCtx.currentTime;
      const o = toneCtx.createOscillator();
      const g = toneCtx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(toneCtx.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {
      /* audio indisponible */
    }
  };

  // Blob -> texte base64 (pour la sauvegarde en fichier)
  KA.blobToDataUrl = function (blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };
})();
