/* Panneau musique : chansons du téléphone, et Spotify.
   - Sans connexion : la playlist choisie dans le menu parent s'affiche avec le lecteur intégré.
   - Avec connexion Spotify : lecture complète de la playlist (Premium requis pour la lecture). */
(function () {
  "use strict";

  const KA = window.KA;
  const PLAYLIST_KEY = "mcm.spotifyPlaylist";

  const PLAYER_ERRORS = {
    account_error: "La lecture complète demande un compte Spotify Premium",
    authentication_error: "Reconnecte-toi à Spotify depuis le menu parent",
    initialization_error: "Le lecteur ne peut pas démarrer sur cet appareil",
    playback_error: "Lecture impossible pour le moment",
  };

  let root, player, list, empty, fileInput, frame;
  let spConnected, spNow, spToggle, spList, spMsg, spCover;
  let miniPlayer, miniTitle, miniToggle, miniFill, miniBar, miniCur, miniDur;
  let seeking = false;
  let miniMode = "local"; // "local" (chansons du téléphone) ou "spotify"
  let spPoll = null;
  let tracks = [];
  let index = -1;
  let currentUrl = null;
  let spTracks = [];

  // Playlist choisie dans le menu parent (ou celle de la configuration)
  function currentPlaylist() {
    return KA.ls.get(PLAYLIST_KEY, "") || KA.config.spotifyPlaylistId || "";
  }

  function setSpMsg(text) {
    spMsg.textContent = text;
  }

  function loadEmbed(id) {
    frame.src = "https://open.spotify.com/embed/playlist/" + encodeURIComponent(id) + "?utm_source=generator";
  }

  // Affiche soit le lecteur complet (connecté), soit le lecteur intégré, soit un message
  function refreshSpotifyView() {
    const id = currentPlaylist();
    const connected = KA.spotify.isConnected();
    spConnected.hidden = !connected;
    frame.hidden = connected || !id;
    if (connected) return;
    if (id) {
      if (!frame.src || frame.src === "about:blank" || frame.src.indexOf(encodeURIComponent(id)) < 0) loadEmbed(id);
      setSpMsg("");
    } else {
      frame.src = "about:blank";
      setSpMsg("Aucune playlist choisie : ouvre le menu parent 🔧 pour en choisir une");
    }
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
    setMiniMode(local ? "local" : "spotify");
  }

  // ---------- Mini-lecteur Spotify (lecteur complet, compte connecté) ----------
  let spState = null; // dernier état reçu du lecteur Spotify

  function stopSpPoll() {
    clearInterval(spPoll);
    spPoll = null;
  }

  function startSpPoll() {
    stopSpPoll();
    const tick = () => {
      KA.spotify.getState().then(updateMiniSpotify).catch(() => updateMiniSpotify(null));
    };
    tick();
    spPoll = setInterval(tick, 500);
  }

  function updateMiniSpotify(st) {
    if (miniMode !== "spotify" || !miniPlayer) return;
    spState = st;
    if (!st || !st.track_window || !st.track_window.current_track) {
      miniPlayer.hidden = true;
      return;
    }
    const t = st.track_window.current_track;
    miniPlayer.hidden = false;
    miniTitle.textContent = t.name + " — " + t.artists.map((a) => a.name).join(", ");
    miniToggle.textContent = st.paused ? "▶️" : "⏸️";
    const d = st.duration || 0;
    const ratio = d > 0 ? Math.min(1, st.position / d) : 0;
    miniFill.style.width = ratio * 100 + "%";
    miniCur.textContent = fmt(st.position / 1000);
    miniDur.textContent = fmt(d / 1000);
  }

  // Le mini-lecteur suit le lecteur du moment : chansons du téléphone, ou Spotify (connecté)
  function setMiniMode(mode) {
    miniMode = mode;
    stopSpPoll();
    if (mode === "spotify") {
      if (KA.spotify.isConnected()) startSpPoll();
      else miniPlayer.hidden = true; // le lecteur intégré ne peut pas être commandé
    } else {
      updateMini();
    }
  }

  // ---------- Spotify connecté ----------
  function showPlayerError(ev, message) {
    setSpMsg("⚠️ " + (PLAYER_ERRORS[ev] || message));
    if (ev === "authentication_error") refreshSpotifyView();
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
    const id = currentPlaylist();
    if (!id) {
      spTracks = [];
      renderSpList();
      setSpMsg("Aucune playlist choisie : ouvre le menu parent 🔧 pour en choisir une");
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
      spTracks = await KA.spotify.playlistTracks(id);
      renderSpList();
    } catch (e) {
      spTracks = [];
      renderSpList();
      if (e.message === "not-connected") refreshSpotifyView();
      else if (e.status === 403) {
        setSpMsg("La liste n'est pas disponible pour cette playlist. Tu peux quand même utiliser ⏮️ ▶️ ⏭️.");
      } else {
        setSpMsg("Impossible de charger la liste des chansons");
      }
    }
  }

  async function playSpTrack(i) {
    setSpMsg("");
    try {
      await KA.spotify.playAt(currentPlaylist(), i);
    } catch (e) {
      if (e.message === "player-not-ready") setSpMsg("Le lecteur se prépare, réessaie dans un instant");
      else if (e.status === 403) setSpMsg("La lecture complète demande un compte Spotify Premium");
      else setSpMsg("Lecture impossible : " + e.message);
    }
  }

  function renderSpList() {
    spList.innerHTML = "";
    spTracks.forEach((t, i) => {
      spList.appendChild(
        KA.listItem({
          leading: [KA.chip("▶️", "Écouter", () => playSpTrack(i)), KA.cover(t.cover)],
          label: t.name + (t.artists ? " · " + t.artists : ""),
        })
      );
    });
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
    updateMini();
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
    updateMini();
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
      const playBtn = KA.chip(i === index && !player.paused ? "⏸️" : "▶️", "Écouter", () => {
        if (i === index) {
          player.paused ? player.play() : player.pause();
        } else {
          playAt(i);
        }
      });
      const delBtn = KA.chip("🗑️", "Supprimer", () => KA.armed(delBtn, () => removeTrack(t.id)));
      list.appendChild(
        KA.listItem({
          leading: [playBtn],
          label: t.name.replace(/\.[^.]+$/, ""),
          trailing: [delBtn],
          playing: i === index,
        })
      );
    });
  }

  // ---------- Mini-lecteur (chansons du téléphone) ----------
  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const s = Math.floor(sec);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function updateMini() {
    if (!miniPlayer || miniMode !== "local") return;
    const t = index >= 0 ? tracks[index] : null;
    miniPlayer.hidden = !t || !player.src;
    if (!t || miniPlayer.hidden) return;
    miniTitle.textContent = t.name.replace(/\.[^.]+$/, "");
    miniToggle.textContent = player.paused ? "▶️" : "⏸️";
    const d = player.duration;
    const known = isFinite(d) && d > 0;
    const ratio = known ? Math.min(1, player.currentTime / d) : 0;
    miniFill.style.width = ratio * 100 + "%";
    miniCur.textContent = fmt(player.currentTime);
    miniDur.textContent = known ? fmt(d) : "0:00";
  }

  // Un appui ou un glissement sur la barre place la lecture au bon endroit
  function seekFromEvent(e) {
    const r = miniBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (miniMode === "spotify") {
      if (spState && spState.duration > 0) {
        KA.spotify.seek(ratio * spState.duration);
        updateMiniSpotify({ ...spState, position: ratio * spState.duration });
      }
      return;
    }
    const d = player.duration;
    if (!isFinite(d) || d <= 0) return;
    player.currentTime = ratio * d;
    updateMini();
  }

  KA.panels.music = {
    init(r) {
      root = r;
      player = root.querySelector("#player");
      list = root.querySelector("#music-list");
      empty = root.querySelector("#music-empty");
      fileInput = root.querySelector("#music-file");
      frame = root.querySelector("#spotify-frame");
      spConnected = root.querySelector("#sp-connected");
      spNow = root.querySelector("#sp-now");
      spToggle = root.querySelector("#sp-toggle");
      spList = root.querySelector("#sp-list");
      spMsg = root.querySelector("#sp-msg");
      spCover = root.querySelector("#sp-cover");

      root.querySelector("#tab-local").addEventListener("click", () => setTab("local"));
      root.querySelector("#tab-spotify").addEventListener("click", () => setTab("spotify"));
      root.querySelector("#sp-toggle").addEventListener("click", () => KA.spotify.toggle());
      root.querySelector("#sp-next").addEventListener("click", () => KA.spotify.next());
      root.querySelector("#sp-prev").addEventListener("click", () => KA.spotify.previous());

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

      // Mini-lecteur collé en bas
      miniPlayer = root.querySelector("#mini-player");
      miniTitle = root.querySelector("#mini-title");
      miniToggle = root.querySelector("#mini-toggle");
      miniFill = root.querySelector("#mini-fill");
      miniBar = root.querySelector("#mini-bar");
      miniCur = root.querySelector("#mini-cur");
      miniDur = root.querySelector("#mini-dur");
      miniToggle.addEventListener("click", () => {
        if (miniMode === "spotify") KA.spotify.toggle();
        else (player.paused ? player.play() : player.pause());
      });
      root.querySelector("#mini-prev").addEventListener("click", () => {
        if (miniMode === "spotify") KA.spotify.previous();
        else if (tracks.length) playAt(Math.max(0, index - 1));
      });
      root.querySelector("#mini-next").addEventListener("click", () => {
        if (miniMode === "spotify") KA.spotify.next();
        else if (tracks.length) playAt(index + 1 < tracks.length ? index + 1 : 0);
      });
      miniBar.addEventListener("pointerdown", (e) => {
        seeking = true;
        seekFromEvent(e);
        try {
          miniBar.setPointerCapture(e.pointerId);
        } catch (err) {
          /* pointeur non capturable : le glissement sera simplement moins suivi */
        }
      });
      miniBar.addEventListener("pointermove", (e) => {
        if (seeking) seekFromEvent(e);
      });
      const stopSeek = () => {
        seeking = false;
      };
      miniBar.addEventListener("pointerup", stopSeek);
      miniBar.addEventListener("pointercancel", stopSeek);
      ["timeupdate", "loadedmetadata", "play", "pause", "ended"].forEach((ev) => player.addEventListener(ev, updateMini));
    },
    enter() {
      setTab("spotify"); // Spotify par défaut ; l'onglet Téléphone reste accessible
      render();
    },
    leave() {
      player.pause();
      frame.src = "about:blank";
      KA.spotify.pause();
      stopSpPoll();
    },
  };
})();
