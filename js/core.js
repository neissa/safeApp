/* Noyau commun : espace de noms, configuration, stockage local, voix, confirmation par double appui */
(function () {
  "use strict";

  const KA = (window.KA = window.KA || {});
  KA.panels = {};

  KA.config = {
    // Identifiant de la playlist Spotify affichée (dans l'URL open.spotify.com/playlist/<ID>)
    spotifyPlaylistId: "6qQlOLI05pL8Lg0VH2spLi",
    // Identifiant client de l'appli Spotify (public, pas de secret). L'adresse de retour
    // (http://127.0.0.1:5500/index.html par exemple) doit être enregistrée sur le tableau de bord Spotify.
    spotifyClientId: "c8d31a70661e4f679d9eef30b1aa91c3",
    // Position utilisée si la localisation est refusée (Paris)
    fallbackLocation: { lat: 48.8566, lon: 2.3522 },
  };

  // ---------- Stockage des fichiers (photos, sons, dessin) : IndexedDB ----------
  const DB_NAME = "mon-coin-magique";
  const DB_VERSION = 1;
  const STORE = "items";
  let dbPromise = null;

  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("kind", "kind", { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  function run(mode, makeRequest) {
    return openDb().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const req = makeRequest(tx.objectStore(STORE));
          let result;
          req.onsuccess = () => {
            result = req.result;
          };
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  KA.db = {
    newId(kind) {
      return kind + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    },
    put(item) {
      return run("readwrite", (s) => s.put(item));
    },
    get(id) {
      return run("readonly", (s) => s.get(id));
    },
    del(id) {
      return run("readwrite", (s) => s.delete(id));
    },
    async list(kind) {
      const items = await run("readonly", (s) => s.index("kind").getAll(kind));
      return (items || []).sort((a, b) => a.createdAt - b.createdAt);
    },
  };

  // ---------- Petites valeurs : localStorage (échoue en silence si bloqué) ----------
  KA.ls = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* stockage plein ou bloqué : on ignore */
      }
    },
  };

  // ---------- Voix : lit un texte à voix haute (pour les enfants qui ne lisent pas) ----------
  KA.speak = function (text) {
    try {
      if (!("speechSynthesis" in window) || !text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* synthèse vocale indisponible */
    }
  };

  // ---------- Nombres en lettres, pour les annonces vocales ----------
  const UNITS = [
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize",
  ];
  const TENS = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

  // De 0 à 99
  function under100(n) {
    if (n <= 16) return UNITS[n];
    if (n <= 19) return "dix-" + UNITS[n - 10];
    if (n < 70) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      if (u === 0) return TENS[t];
      if (u === 1) return TENS[t] + " et un";
      return TENS[t] + "-" + UNITS[u];
    }
    if (n < 80) return n === 71 ? "soixante et onze" : "soixante-" + under100(n - 60);
    return "quatre-vingt" + (n === 80 ? "s" : "-" + under100(n - 80));
  }

  // De 0 à 999. « cents » ne prend un s que s'il finit le nombre (deux cents, mais deux cent mille)
  function under1000(n, plural) {
    if (n < 100) return under100(n);
    const h = Math.floor(n / 100);
    const r = n % 100;
    const head = h === 1 ? "cent" : UNITS[h] + (r === 0 && plural ? " cents" : " cent");
    return r === 0 ? head : head + " " + under100(r);
  }

  // De 0 à 999 999
  function under1000000(n) {
    if (n < 1000) return under1000(n, true);
    const k = Math.floor(n / 1000);
    const r = n % 1000;
    const head = k === 1 ? "mille" : under1000(k, false) + " mille";
    return r === 0 ? head : head + " " + under1000(r, true);
  }

  // Nombre entier en lettres, jusqu'à 999 millions
  KA.frNumber = function frNumber(n) {
    if (n < 0) return "moins " + frNumber(-n);
    if (n >= 1e9) return String(n);
    if (n >= 1e6) {
      const m = Math.floor(n / 1e6);
      const r = n % 1e6;
      const head = m === 1 ? "un million" : under1000(m, false) + " millions";
      return r === 0 ? head : head + " " + under1000000(r);
    }
    return under1000000(n);
  };

  // ---------- Double appui de sécurité : évite d'effacer quelque chose par erreur ----------
  KA.armed = function (btn, onConfirm) {
    if (btn.classList.contains("armed")) {
      clearTimeout(btn._armTimer);
      btn.classList.remove("armed");
      onConfirm();
      return;
    }
    btn.classList.add("armed");
    KA.speak("Appuie encore pour confirmer");
    btn._armTimer = setTimeout(() => btn.classList.remove("armed"), 2500);
  };
})();
