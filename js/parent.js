/* Menu parent : titre de l'accueil, bruitages et voix, Spotify (connexion et playlist),
   sauvegarde et restauration, mise à jour. Ouvert par le bouton en bas de l'accueil, après une question de contrôle. */
(function () {
  "use strict";

  const KA = window.KA;
  const APP_ID = "mon-coin-magique";
  const TITLE_KEY = "mcm.homeTitle";
  const PLAYLIST_KEY = "mcm.spotifyPlaylist";
  const PLAYLIST_NAME_KEY = "mcm.spotifyPlaylistName";
  const MAX_TITLE = 30;

  let box, titleInput, soundBtn, voiceBtn, storageInfo, fileInput, msg;
  let spStatus, spLogin, spLogout, spPick, spList;

  function refreshToggles() {
    const sounds = KA.settings.get("sounds", true);
    const voice = KA.settings.get("voice", true);
    soundBtn.textContent = sounds ? "🔊 Bruitages : oui" : "🔇 Bruitages : non";
    voiceBtn.textContent = voice ? "🗣️ Voix : oui" : "🤐 Voix : non";
  }

  // Liste des voix françaises du téléphone, avec la voix choisie
  function refreshVoices() {
    const select = document.getElementById("parent-voice-select");
    if (!select) return;
    const current = KA.settings.get("voiceName", "");
    const voices = KA.voices();
    select.innerHTML = "";
    const add = (value, text) => {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = text;
      select.appendChild(o);
    };
    add("", "Voix par défaut");
    voices.forEach((v) => add(v.name, v.name.replace(/^Microsoft /, "").replace(/ - .*$/, "")));
    select.value = voices.some((v) => v.name === current) ? current : "";
    if (!voices.length) msg.textContent = "Aucune voix française trouvée sur cet appareil";
  }

  async function refreshStorage() {
    let persisted = false;
    try {
      persisted = !!(navigator.storage && navigator.storage.persisted && (await navigator.storage.persisted()));
    } catch (e) {
      persisted = false;
    }
    storageInfo.textContent = persisted
      ? "💾 Stockage protégé : les créations restent sur l'appareil"
      : "⚠️ Stockage non protégé : pense à faire une sauvegarde";
  }

  // ---------- Statistiques ----------
  function pieSvg(slices) {
    const shown = slices.filter((s) => s.value > 0);
    const total = shown.reduce((a, s) => a + s.value, 0);
    if (!total) return null;
    const cx = 100;
    const cy = 100;
    const r = 90;
    let angle = -Math.PI / 2;
    let body = "";
    if (shown.length === 1) {
      body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + shown[0].color + '"/>';
    } else {
      shown.forEach((s) => {
        const a = (s.value / total) * 2 * Math.PI;
        const x1 = cx + r * Math.cos(angle);
        const y1 = cy + r * Math.sin(angle);
        angle += a;
        const x2 = cx + r * Math.cos(angle);
        const y2 = cy + r * Math.sin(angle);
        const large = a > Math.PI ? 1 : 0;
        body +=
          '<path d="M' + cx + " " + cy + " L" + x1.toFixed(2) + " " + y1.toFixed(2) +
          " A" + r + " " + r + " 0 " + large + " 1 " + x2.toFixed(2) + " " + y2.toFixed(2) +
          ' Z" fill="' + s.color + '"/>';
      });
    }
    return '<svg viewBox="0 0 200 200" class="pie-svg" role="img" aria-label="Répartition des lancements d\'aujourd\'hui">' + body + "</svg>";
  }

  function refreshStats() {
    const table = document.getElementById("stats-table");
    const pie = document.getElementById("stats-pie");
    if (!table || !KA.stats) return;
    const tiles = [...document.querySelectorAll(".tile[data-open]")].map((t) => ({
      name: t.dataset.open,
      label: t.querySelector(".tile-label").textContent,
      color: getComputedStyle(t).backgroundColor,
    }));
    const total = KA.stats.total();
    const today = KA.stats.today();
    const week = KA.stats.week();

    table.innerHTML = "";
    ["Tuile", "Depuis toujours", "Aujourd'hui", "7 jours"].forEach((h) => {
      const c = document.createElement("span");
      c.className = "stats-cell head";
      c.textContent = h;
      table.appendChild(c);
    });
    tiles.forEach((t) => {
      [t.label, total[t.name] || 0, today[t.name] || 0, week[t.name] || 0].forEach((v, i) => {
        const c = document.createElement("span");
        c.className = "stats-cell" + (i === 0 ? " name" : "");
        c.textContent = v;
        table.appendChild(c);
      });
    });

    pie.innerHTML = "";
    const slices = tiles.map((t) => ({ value: today[t.name] || 0, color: t.color, label: t.label }));
    const svg = pieSvg(slices);
    if (!svg) {
      pie.textContent = "Aucune ouverture aujourd'hui";
      return;
    }
    pie.innerHTML = svg;
    const totalToday = slices.reduce((a, s) => a + s.value, 0);
    const legend = document.createElement("ul");
    legend.className = "pie-legend";
    slices
      .filter((s) => s.value > 0)
      .forEach((s) => {
        const li = document.createElement("li");
        const dot = document.createElement("span");
        dot.className = "pie-dot";
        dot.style.background = s.color;
        li.append(dot, s.label + " : " + s.value + " (" + Math.round((s.value / totalToday) * 100) + " %)");
        legend.appendChild(li);
      });
    pie.appendChild(legend);
  }

  // ---------- Thème ----------
  function refreshTheme() {
    const current = KA.settings.get("theme", "auto");
    document.querySelectorAll("#parent-theme .seg-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.theme === current);
    });
  }

  // ---------- Spotify ----------
  function refreshSpotify() {
    const connected = KA.spotify.isConnected();
    const id = KA.ls.get(PLAYLIST_KEY, "") || KA.config.spotifyPlaylistId || "";
    const name = KA.ls.get(PLAYLIST_NAME_KEY, "");
    spStatus.textContent =
      (connected ? "✅ Connecté à Spotify" : "Non connecté à Spotify") +
      " · " +
      (id ? "Playlist : " + (name || "choisie") : "aucune playlist choisie");
    spLogin.hidden = connected;
    spLogout.hidden = !connected;
    spPick.hidden = !connected;
    spList.hidden = true;
    spList.innerHTML = "";
  }

  async function loginSpotify() {
    try {
      await KA.spotify.login();
    } catch (e) {
      msg.textContent = "Connexion impossible : " + e.message;
    }
  }

  function logoutSpotify() {
    KA.spotify.logout();
    refreshSpotify();
    msg.textContent = "Tu es déconnecté de Spotify";
  }

  // Liste les playlists du compte connecté ; un appui en choisit une
  async function showPlaylists() {
    spList.hidden = true;
    spList.innerHTML = "";
    msg.textContent = "Chargement de tes playlists…";
    try {
      const lists = await KA.spotify.userPlaylists();
      if (!lists.length) {
        msg.textContent = "Aucune playlist trouvée sur ce compte";
        return;
      }
      lists.forEach((p) => {
        spList.appendChild(
          KA.listItem({
            leading: [KA.cover(p.cover)],
            label: p.name,
            trailing: [KA.chip("✅", "Choisir " + p.name, () => choosePlaylist(p))],
          })
        );
      });
      spList.hidden = false;
      msg.textContent = "Touche la playlist à écouter";
    } catch (e) {
      if (e.message === "not-connected") {
        msg.textContent = "Connecte-toi d'abord à Spotify";
        refreshSpotify();
      } else {
        msg.textContent = e.status === 403 ? "Spotify refuse la liste de tes playlists" : "Impossible de charger tes playlists";
      }
    }
  }

  function choosePlaylist(p) {
    KA.ls.set(PLAYLIST_KEY, p.id);
    KA.ls.set(PLAYLIST_NAME_KEY, p.name);
    refreshSpotify();
    msg.textContent = "Playlist choisie : " + p.name;
  }

  // ---------- Version et mises à jour ----------
  let latestVersion = null; // version la plus récente en ligne, si elle est différente de celle installée

  function appVersion() {
    const m = document.querySelector('meta[name="app-version"]');
    return m && m.content ? m.content : "inconnue";
  }

  // Date et heure de fabrication, au format « JJ/MM/AAAA à HH:MM » (meta app-built : « AAAA-MM-JJ HH:MM »)
  function appBuilt() {
    const m = document.querySelector('meta[name="app-built"]');
    if (!m || !m.content) return "";
    const [day, time] = m.content.split(" ");
    return day.split("-").reverse().join("/") + (time ? " à " + time : "");
  }

  function showUpdateState() {
    const ver = document.getElementById("parent-version");
    if (ver) ver.textContent = "Version " + appVersion().slice(0, 8) + (appBuilt() ? " · " + appBuilt() : "");
    const status = document.getElementById("parent-update-status");
    if (status) status.textContent = latestVersion ? "🆕 Une nouvelle version est disponible" : "✅ L'appli est à jour";
    const btn = document.getElementById("parent-update");
    if (btn) btn.textContent = latestVersion ? "🔄 Installer la mise à jour" : "🔄 Vérifier et mettre à jour";
    const homeBtn = document.getElementById("home-update");
    if (homeBtn) homeBtn.hidden = !latestVersion;
  }

  // Le lien vers l'APK n'est utile que hors de l'APK : dans l'APK (TWA), le navigateur
  // indique « android-app:// » comme origine de la page.
  function showApkLink() {
    const link = document.getElementById("parent-apk");
    if (link) link.hidden = document.referrer.startsWith("android-app://");
  }

  // Vérifie en arrière-plan si une version plus récente est en ligne (silencieux hors ligne)
  async function checkUpdate() {
    if (!navigator.onLine) return;
    try {
      const res = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      latestVersion = data.version && data.version !== appVersion() ? data.version : null;
      showUpdateState();
    } catch (e) {
      /* hors ligne : rien à signaler */
    }
  }

  // ---------- Tuiles de l'accueil ----------
  // Classement par âge (noms des tuiles = data-open). Une tuile absente de la liste va dans « Autres ».
  const AGE_GROUPS = [
    { label: "👶 2 à 4 ans", names: ["draw", "music", "piano", "farts", "megaphone", "gallery", "recorder"] },
    { label: "🧒 4 à 6 ans", names: ["shapes", "intrus", "memory", "calc", "notes"] },
    { label: "👧 6 ans et plus", names: ["timer", "clock", "snake"] },
  ];

  // Une case par tuile : décochée = la tuile disparaît de l'accueil
  function refreshTiles() {
    const box = document.getElementById("parent-tiles");
    if (!box) return;
    const hidden = KA.settings.get("hiddenTiles", []);
    box.innerHTML = "";
    const tiles = {};
    document.querySelectorAll(".tile[data-open]").forEach((t) => {
      tiles[t.dataset.open] = t;
    });

    const tileLabel = (name) => {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = hidden.indexOf(name) < 0;
      cb.addEventListener("change", () => {
        const now = KA.settings.get("hiddenTiles", []).filter((n) => n !== name);
        if (!cb.checked) now.push(name);
        KA.settings.set("hiddenTiles", now);
        KA.applyTiles();
      });
      label.append(cb, " " + tiles[name].querySelector(".tile-label").textContent);
      return label;
    };

    const placed = new Set();
    const addGroup = (title, names) => {
      const names2 = names.filter((n) => tiles[n]);
      if (!names2.length) return;
      const head = document.createElement("p");
      head.className = "tile-age";
      head.textContent = title;
      box.appendChild(head);
      names2.forEach((n) => {
        placed.add(n);
        box.appendChild(tileLabel(n));
      });
    };

    AGE_GROUPS.forEach((g) => addGroup(g.label, g.names));
    addGroup("Autres", Object.keys(tiles).filter((n) => !placed.has(n)));
  }

  // ---------- Ouverture et titre ----------
  function open() {
    titleInput.value = KA.ls.get(TITLE_KEY, "Mon coin magique");
    msg.textContent = "";
    refreshToggles();
    refreshVoices();
    refreshTheme();
    refreshTiles();
    refreshStats();
    refreshSpotify();
    refreshStorage();
    showUpdateState();
    box.hidden = false;
  }

  function close() {
    box.hidden = true;
  }

  function saveTitle() {
    const text = titleInput.value.trim().slice(0, MAX_TITLE);
    if (!text) {
      msg.textContent = "Écris un titre";
      return;
    }
    KA.ls.set(TITLE_KEY, text);
    const el = document.getElementById("home-title");
    if (el) el.textContent = text;
    msg.textContent = "Titre enregistré";
  }

  // ---------- Sauvegarde ----------
  // Toutes les créations (dessins, photos, enregistrements, chansons) et les réglages
  async function exportBackup() {
    msg.textContent = "Préparation de la sauvegarde…";
    try {
      const items = await KA.db.all();
      const out = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), items: [], settings: {} };
      for (const it of items) {
        const rec = Object.assign({}, it);
        if (it.blob) rec.blob = await KA.blobToDataUrl(it.blob);
        out.items.push(rec);
      }
      Object.keys(localStorage)
        .filter((k) => k.indexOf("mcm.") === 0 && k !== "mcm.spotifyTokens")
        .forEach((k) => (out.settings[k] = localStorage.getItem(k)));

      const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mon-coin-magique-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      msg.textContent = "Sauvegarde téléchargée (" + out.items.length + " éléments)";
    } catch (e) {
      msg.textContent = "Sauvegarde impossible : " + e.message;
    }
  }

  async function importBackup(file) {
    msg.textContent = "Restauration en cours…";
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== APP_ID || !Array.isArray(data.items)) throw new Error("fichier non reconnu");
      for (const it of data.items) {
        if (typeof it.blob === "string") it.blob = await (await fetch(it.blob)).blob();
        await KA.db.put(it);
      }
      Object.keys(data.settings || {}).forEach((k) => localStorage.setItem(k, data.settings[k]));
      msg.textContent = "Restauration terminée. Recharge la page pour tout voir.";
    } catch (e) {
      msg.textContent = "Restauration impossible : " + e.message;
    }
    fileInput.value = "";
  }

  // Vide le cache de l'appli et recharge la page. Les créations (stockées à part) ne sont pas touchées.
  async function updateApp() {
    if (!navigator.onLine) {
      msg.textContent = "Il faut une connexion pour mettre à jour l'appli";
      return;
    }
    msg.textContent = "Mise à jour en cours…";
    try {
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
        // Laisse au nouveau service worker le temps de prendre la main
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      // Adresse unique : le navigateur ne peut pas réutiliser sa copie en cache
      location.replace(location.pathname + "?maj=" + Date.now());
    } catch (e) {
      msg.textContent = "Mise à jour impossible : " + e.message;
    }
  }

  KA.parent = { open, close };

  document.addEventListener("DOMContentLoaded", () => {
    box = document.getElementById("parent");
    if (!box) return;
    titleInput = document.getElementById("parent-title");
    soundBtn = document.getElementById("parent-sound");
    voiceBtn = document.getElementById("parent-voice");
    storageInfo = document.getElementById("parent-storage");
    fileInput = document.getElementById("parent-file");
    msg = document.getElementById("parent-msg");
    spStatus = document.getElementById("parent-sp-status");
    spLogin = document.getElementById("parent-sp-login");
    spLogout = document.getElementById("parent-sp-logout");
    spPick = document.getElementById("parent-sp-pick");
    spList = document.getElementById("parent-sp-list");

    document.getElementById("parent-title-save").addEventListener("click", saveTitle);
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveTitle();
    });
    soundBtn.addEventListener("click", () => {
      KA.settings.set("sounds", !KA.settings.get("sounds", true));
      refreshToggles();
    });
    voiceBtn.addEventListener("click", () => {
      KA.settings.set("voice", !KA.settings.get("voice", true));
      KA.applyVoiceUI();
      refreshToggles();
    });
    document.getElementById("parent-voice-select").addEventListener("change", (e) => {
      KA.settings.set("voiceName", e.target.value);
      KA.speak("Bonjour, c'est ma nouvelle voix !", { force: true });
    });
    if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", refreshVoices);

    document.querySelectorAll("#parent-theme .seg-btn").forEach((b) =>
      b.addEventListener("click", () => {
        KA.settings.set("theme", b.dataset.theme);
        KA.applyTheme();
        refreshTheme();
      })
    );

    const statsReset = document.getElementById("stats-reset");
    if (statsReset) {
      statsReset.addEventListener("click", () =>
        KA.armed(statsReset, () => {
          KA.stats.reset();
          refreshStats();
        })
      );
    }

    spLogin.addEventListener("click", loginSpotify);
    spLogout.addEventListener("click", logoutSpotify);
    spPick.addEventListener("click", showPlaylists);

    document.getElementById("parent-export").addEventListener("click", exportBackup);
    document.getElementById("parent-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) importBackup(fileInput.files[0]);
    });
    document.getElementById("parent-update").addEventListener("click", updateApp);
    document.getElementById("home-update").addEventListener("click", updateApp);
    document.getElementById("parent-pin").addEventListener("click", () => {
      KA.askPin({
        create: true,
        onOk: () => {
          document.getElementById("parent-pin-msg").textContent = "Nouveau code enregistré";
        },
      });
    });
    document.getElementById("parent-close").addEventListener("click", close);
    // Un appui (doigt ou souris) sur le fond sombre, en dehors de la fenêtre, ferme le menu.
    // Un appui qui commence dans la fenêtre ne le ferme pas.
    box.addEventListener("pointerdown", (e) => {
      if (e.target === box) close();
    });

    // Vérification en arrière-plan : au démarrage, toutes les 15 minutes, et au retour sur l'appli
    showUpdateState();
    showApkLink();
    checkUpdate();
    setInterval(checkUpdate, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkUpdate();
    });

    // Retour de la connexion Spotify : on rouvre directement le menu parent
    KA.spotify
      .finishLoginIfNeeded()
      .then((done) => {
        if (!done) return;
        open();
        msg.textContent = "Connecté à Spotify ✅";
      })
      .catch((e) => {
        open();
        msg.textContent = "Connexion impossible : " + e.message;
      });
  });
})();
