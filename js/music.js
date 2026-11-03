/* Panneau musique : chansons du téléphone, et Spotify.
   - Sans connexion : la playlist s'affiche avec le lecteur intégré de Spotify.
   - Avec connexion Spotify : lecture complète et boutons (Premium requis pour la lecture).
   Réglage caché : 5 appuis rapides sur l'onglet Spotify permettent de changer la playlist. */
(function () {
  "use strict";

  const KA = window.KA;
  const SECRET_TAPS = 5;
  const TAP_WINDOW_MS = 4000;
  const PLAYLIST_KEY = "mcm.spotifyPlaylist";

  let root, player, list, empty, fileInput, frame, setBox, setInput, setMsg;
  let spLogin, spConnected, spNow, spToggle, spList, spMsg, spCover;
  let tracks = [];
  let index = -1;
  let currentUrl = null;
  let playlistId = KA.config.spotifyPlaylistId;
  let tapTimes = [];
  let spTracks = [];
  let pendingSpotifyTab = false;

  // Accepte l'adresse complète (open.spotify.com/playlist/ID, avec ou sans paramètres),
  // l'URI spotify:playlist:ID, ou l'identifiant seul
  function parsePlaylistId(text) {
    const t = (text || "").trim();
    const m = t.match(/playlist[\/:]([A-Za-z0-9]{22})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9]{22}$/.test(t)) return t;
    return null;
  }

  function loadSpotify() {
    frame.src =
      "https://open.spotify.com/embed/playlist/" + encodeURIComponent(playlistId) + "?utm_source=generator";
  }

  const NO_PLAYLIST_TEXT = "Aucune playlist choisie : fais 5 appuis rapides sur Spotify pour en ajouter une";

  function setSpMsg(text) {
    spMsg.textContent = text;
  }

  // Affiche soit la connexion et le lecteur intégré, soit le lecteur complet
  function refreshSpotifyView() {
    const connected = KA.spotify.isConnected();
    spLogin.hidden = connected;
    spConnected.hidden = !connected;
    frame.hidden = connected;
    if (!playlistId) {
      frame.src = "about:blank";
      setSpMsg(NO_PLAYLIST_TEXT);
      return;
    }
    if (!connected && (!frame.src || frame.src === "about:blank")) loadSpotify();
  }

  // Après un changement de playlist : le lecteur intégré et la liste connectée suivent la nouvelle
  function applyPlaylistChange() {
    frame.src = "about:blank";
    setSpMsg("");
    refreshSpotifyView();
    if (KA.spotify.isConnected()) openConnected();
  }

  function setTab(which) {
    const local = which === "local";
    root.querySelector("#tab-local").classList.toggle("active", local);
    root.querySelector("#tab-spotify").classList.toggle("active", !local);
    root.querySelector("#music-local").hidden = !local;
    root.querySelector("#music-spotify").hidden = local;
    if (local) {
      frame.src = "about:blank"; // coupe le lecteur intégré quand on ne le regarde pas
      KA.spotify.pause();
    } else {
      refreshSpotifyView();
      if (KA.spotify.isConnected()) openConnected();
    }
  }

  // ---------- Spotify connecté ----------
  const PLAYER_ERRORS = {
    account_error: "La lecture complète demande un compte Spotify Premium",
    authentication_error: "Reconnecte-toi à Spotify",
    initialization_error: "Le lecteur ne peut pas démarrer sur cet appareil",
    playback_error: "Lecture impossible pour le moment",
  };

  function showPlayerError(ev, message) {
    setSpMsg("⚠️ " + (PLAYER_ERRORS[ev] || message));
    if (ev === "authentication_error") {
      KA.spotify.logout();
      refreshSpotifyView();
    }
  }

  function updateNow(state) {
    if (!state || !state.track_window || !state.track_window.current_track) return;
    const t = state.track_window.current_track;
    spNow.textContent = "🎵 " + t.name + " — " + t.artists.map((a) => a.name).join(", ");
    const cover = KA.spotify.pickImage(t.album && t.album.images, 300);
    spCover.hidden = !cover;
    if (cover) spCover.src = cover;
    spToggle.textContent = state.paused ? "▶️" : "⏸️";
  }

  async function openConnected() {
    setSpMsg("");
    if (!playlistId) {
      spTracks = [];
      renderSpList();
      setSpMsg(NO_PLAYLIST_TEXT);
      return;
    }
    try {
      await KA.spotify.connectPlayer({
        onReady: () => setSpMsg(""),
        onState: updateNow,
        onError: showPlayerError,
      });
    } catch (e) {
      setSpMsg("⚠️ Le lecteur Spotify ne se charge pas");
    }
    try {
      spTracks = await KA.spotify.playlistTracks(playlistId);
      renderSpList();
    } catch (e) {
      spTracks = [];
      renderSpList();
      if (e.message === "not-connected") {
        refreshSpotifyView();
      } else if (e.status === 403) {
        setSpMsg("La liste n'est pas disponible pour cette playlist. Tu peux quand même utiliser ⏮️ ▶️ ⏭️.");
      } else {
        setSpMsg("Impossible de charger la liste des chansons");
      }
    }
  }

  async function playSpTrack(i) {
    setSpMsg("");
    if (!playlistId) {
      setSpMsg(NO_PLAYLIST_TEXT);
      return;
    }
    try {
      await KA.spotify.playAt(playlistId, i);
    } catch (e) {
      if (e.message === "player-not-ready") setSpMsg("Le lecteur se prépare, réessaie dans un instant");
      else if (e.status === 403) setSpMsg("La lecture complète demande un compte Spotify Premium");
      else setSpMsg("Lecture impossible : " + e.message);
    }
  }

  function renderSpList() {
    spList.innerHTML = "";
    spTracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "row-item";
      const playBtn = document.createElement("button");
      playBtn.className = "chip";
      playBtn.textContent = "▶️";
      playBtn.setAttribute("aria-label", "Écouter");
      playBtn.addEventListener("click", () => playSpTrack(i));
      const cover = document.createElement("img");
      cover.className = "cover";
      cover.alt = "";
      cover.loading = "lazy";
      if (t.cover) cover.src = t.cover;
      else cover.hidden = true;

      const name = document.createElement("span");
      name.className = "row-name";
      name.textContent = t.name + (t.artists ? " · " + t.artists : "");
      li.append(playBtn, cover, name);
      spList.appendChild(li);
    });
  }

  // ---------- Playlist Spotify : réglage caché ----------
  // Cinq appuis rapides sur l'onglet Spotify ouvrent le champ d'adresse
  function countSpotifyTap() {
    const now = Date.now();
    tapTimes = tapTimes.filter((t) => now - t < TAP_WINDOW_MS);
    tapTimes.push(now);
    if (tapTimes.length >= SECRET_TAPS) {
      tapTimes = [];
      openSetter();
    }
  }

  function openSetter() {
    setInput.value = playlistId ? "https://open.spotify.com/playlist/" + playlistId : "";
    setMsg.textContent = "";
    root.querySelector("#spotify-logout").hidden = !KA.spotify.isConnected();
    setBox.hidden = false;
    setInput.focus();
  }

  function logoutFromSetter() {
    KA.spotify.logout();
    closeSetter();
    spTracks = [];
    renderSpList();
    spNow.textContent = "Choisis une chanson";
    spCover.hidden = true;
    refreshSpotifyView();
    setSpMsg("Tu es déconnecté de Spotify");
  }

  function closeSetter() {
    setBox.hidden = true;
    setMsg.textContent = "";
  }

  function saveSetter() {
    const id = parsePlaylistId(setInput.value);
    if (!id) {
      setMsg.textContent = "Adresse non reconnue : colle le lien de la playlist Spotify";
      return;
    }
    KA.ls.set(PLAYLIST_KEY, id);
    playlistId = id;
    closeSetter();
    applyPlaylistChange();
  }

  // ---------- Chansons du téléphone ----------
  function playAt(i) {
    const t = tracks[i];
    if (!t) return;
    index = i;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(t.blob);
    player.src = currentUrl;
    player.play().catch(() => {});
    render();
  }

  async function removeTrack(id) {
    const i = tracks.findIndex((t) => t.id === id);
    if (i === index) {
      player.pause();
      player.removeAttribute("src");
      player.load();
      index = -1;
    } else if (i > -1 && i < index) {
      index -= 1;
    }
    await KA.db.del(id);
    render();
  }

  async function addFiles(files) {
    for (const f of Array.from(files)) {
      await KA.db.put({ id: KA.db.newId("song"), kind: "song", createdAt: Date.now(), name: f.name, blob: f });
    }
    fileInput.value = "";
    render();
  }

  async function render() {
    tracks = await KA.db.list("song");
    list.innerHTML = "";
    empty.hidden = tracks.length > 0;
    tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "row-item" + (i === index ? " playing" : "");

      const playBtn = document.createElement("button");
      playBtn.className = "chip";
      playBtn.textContent = i === index && !player.paused ? "⏸️" : "▶️";
      playBtn.setAttribute("aria-label", "Écouter");
      playBtn.addEventListener("click", () => {
        if (i === index) {
          player.paused ? player.play() : player.pause();
        } else {
          playAt(i);
        }
      });

      const name = document.createElement("span");
      name.className = "row-name";
      name.textContent = t.name.replace(/\.[^.]+$/, "");

      const delBtn = document.createElement("button");
      delBtn.className = "chip";
      delBtn.textContent = "🗑️";
      delBtn.setAttribute("aria-label", "Supprimer");
      delBtn.addEventListener("click", () => KA.armed(delBtn, () => removeTrack(t.id)));

      li.append(playBtn, name, delBtn);
      list.appendChild(li);
    });
  }

  KA.panels.music = {
    init(r) {
      root = r;
      player = root.querySelector("#player");
      list = root.querySelector("#music-list");
      empty = root.querySelector("#music-empty");
      fileInput = root.querySelector("#music-file");
      frame = root.querySelector("#spotify-frame");
      setBox = root.querySelector("#spotify-set");
      setInput = root.querySelector("#spotify-url");
      setMsg = root.querySelector("#spotify-msg");
      spLogin = root.querySelector("#sp-login-box");
      spConnected = root.querySelector("#sp-connected");
      spNow = root.querySelector("#sp-now");
      spToggle = root.querySelector("#sp-toggle");
      spList = root.querySelector("#sp-list");
      spMsg = root.querySelector("#sp-msg");
      spCover = root.querySelector("#sp-cover");

      playlistId = parsePlaylistId(KA.ls.get(PLAYLIST_KEY, "")) || KA.config.spotifyPlaylistId;

      root.querySelector("#tab-local").addEventListener("click", () => setTab("local"));
      root.querySelector("#tab-spotify").addEventListener("click", () => {
        countSpotifyTap();
        setTab("spotify");
      });
      root.querySelector("#spotify-save").addEventListener("click", saveSetter);
      root.querySelector("#spotify-cancel").addEventListener("click", closeSetter);
      setInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveSetter();
      });

      root.querySelector("#sp-login").addEventListener("click", () => {
        KA.spotify.login().catch(() => setSpMsg("Connexion Spotify impossible"));
      });
      root.querySelector("#sp-toggle").addEventListener("click", () => KA.spotify.toggle());
      root.querySelector("#sp-next").addEventListener("click", () => KA.spotify.next());
      root.querySelector("#sp-prev").addEventListener("click", () => KA.spotify.previous());
      root.querySelector("#spotify-logout").addEventListener("click", logoutFromSetter);

      root.querySelector("#music-add").addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => addFiles(fileInput.files));

      root.querySelector("#music-prev").addEventListener("click", () => {
        if (tracks.length) playAt(Math.max(0, index - 1));
      });
      root.querySelector("#music-next").addEventListener("click", () => {
        if (tracks.length) playAt(index + 1 < tracks.length ? index + 1 : 0);
      });

      player.addEventListener("ended", () => {
        if (index + 1 < tracks.length) playAt(index + 1);
      });
      player.addEventListener("play", render);
      player.addEventListener("pause", render);

      // Retour de la connexion Spotify : on ouvre directement l'onglet Spotify
      KA.spotify
        .finishLoginIfNeeded()
        .then((done) => {
          if (!done) return;
          pendingSpotifyTab = true;
          KA.showPanel("music");
        })
        .catch((e) => {
          KA.showPanel("music");
          pendingSpotifyTab = true;
          setTimeout(() => setSpMsg("⚠️ " + e.message), 0);
        });
    },
    enter() {
      setTab(pendingSpotifyTab ? "spotify" : "local");
      pendingSpotifyTab = false;
      render();
    },
    leave() {
      player.pause();
      frame.src = "about:blank";
      KA.spotify.pause();
      closeSetter();
    },
  };
})();
