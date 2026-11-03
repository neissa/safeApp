/* Connexion Spotify sans serveur (PKCE) et lecture complète via le Web Playback SDK (compte Premium).
   Tout est mémorisé sur l'appareil. L'identifiant client est public : aucun secret n'est utilisé. */
(function () {
  "use strict";

  const KA = window.KA;
  const AUTH_URL = "https://accounts.spotify.com/authorize";
  const TOKEN_URL = "https://accounts.spotify.com/api/token";
  const API = "https://api.spotify.com/v1";
  const SDK_URL = "https://sdk.scdn.co/spotify-player.js";
  const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative",
  ];
  const TOKEN_KEY = "mcm.spotifyTokens";
  const VERIFIER_KEY = "mcm.spotifyVerifier";
  const STATE_KEY = "mcm.spotifyState";

  let player = null;
  let deviceId = null;
  let ui = {}; // callbacks vers l'écran : onReady, onState, onError

  // Adresse de retour : doit être identique à celle enregistrée dans le tableau de bord Spotify
  function redirectUri() {
    return location.origin + location.pathname;
  }

  // ---------- PKCE ----------
  function base64url(bytes) {
    let s = "";
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function randomString(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  }

  async function challengeOf(verifier) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return base64url(new Uint8Array(digest));
  }

  // ---------- Jetons ----------
  function saveTokens(data) {
    const prev = KA.ls.get(TOKEN_KEY, {}) || {};
    KA.ls.set(TOKEN_KEY, {
      access_token: data.access_token,
      refresh_token: data.refresh_token || prev.refresh_token,
      // marge de sécurité d'une minute avant l'expiration
      expires_at: Date.now() + data.expires_in * 1000 - 60000,
    });
  }

  function isConnected() {
    const t = KA.ls.get(TOKEN_KEY, null);
    return !!(t && (t.access_token || t.refresh_token));
  }

  async function accessToken() {
    const t = KA.ls.get(TOKEN_KEY, null);
    if (!t) return null;
    if (t.access_token && Date.now() < t.expires_at) return t.access_token;
    if (!t.refresh_token) return null;
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: KA.config.spotifyClientId,
        grant_type: "refresh_token",
        refresh_token: t.refresh_token,
      }),
    });
    if (!res.ok) {
      logout();
      return null;
    }
    const data = await res.json();
    saveTokens(data);
    return data.access_token;
  }

  // ---------- Connexion ----------
  async function login() {
    const verifier = randomString(64);
    const state = randomString(16);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: KA.config.spotifyClientId,
      response_type: "code",
      redirect_uri: redirectUri(),
      scope: SCOPES.join(" "),
      code_challenge_method: "S256",
      code_challenge: await challengeOf(verifier),
      state,
    });
    location.href = AUTH_URL + "?" + params.toString();
  }

  // Au retour de Spotify, échange le code contre des jetons. Renvoie true si une connexion vient d'aboutir.
  async function finishLoginIfNeeded() {
    const url = new URL(location.href);
    const code = url.searchParams.get("code");
    if (!code) return false;
    const state = url.searchParams.get("state");
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    history.replaceState(null, "", url.pathname + url.search + url.hash);

    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    const expected = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (!verifier || state !== expected) throw new Error("Connexion Spotify invalide, recommence");

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: KA.config.spotifyClientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
        code_verifier: verifier,
      }),
    });
    if (!res.ok) throw new Error("Spotify a refusé la connexion (" + res.status + ")");
    saveTokens(await res.json());
    return true;
  }

  function logout() {
    KA.ls.set(TOKEN_KEY, null);
    if (player) {
      player.disconnect();
      player = null;
      deviceId = null;
    }
  }

  // ---------- Appels à l'API ----------
  async function api(method, path, body) {
    const token = await accessToken();
    if (!token) throw new Error("not-connected");
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    if (!res.ok) {
      const err = new Error("HTTP " + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // Liste des chansons de la playlist (Spotify ne la donne que pour les playlists du compte ou en collaboration)
  async function playlistTracks(playlistId) {
    const tracks = [];
    let path = "/playlists/" + encodeURIComponent(playlistId) + "/items?limit=50";
    for (let page = 0; path && page < 4; page++) {
      const data = await api("GET", path);
      (data.items || []).forEach((it) => {
        const t = it.item || it.track;
        if (t && t.uri) {
          tracks.push({ uri: t.uri, name: t.name, artists: (t.artists || []).map((a) => a.name).join(", ") });
        }
      });
      path = data.next ? data.next.replace(API, "") : null;
    }
    return tracks;
  }

  // ---------- Lecteur (Web Playback SDK) ----------
  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.Spotify) return resolve();
      window.onSpotifyWebPlaybackSDKReady = resolve;
      const s = document.createElement("script");
      s.src = SDK_URL;
      s.onerror = () => reject(new Error("Lecteur Spotify indisponible"));
      document.head.appendChild(s);
    });
  }

  async function connectPlayer(callbacks) {
    ui = callbacks || {};
    await loadSdk();
    if (player) return;
    player = new window.Spotify.Player({
      name: "Mon coin magique",
      getOAuthToken: (cb) => accessToken().then((t) => cb(t || "")),
      volume: 0.8,
    });
    player.addListener("ready", ({ device_id }) => {
      deviceId = device_id;
      if (ui.onReady) ui.onReady();
    });
    player.addListener("not_ready", () => {
      deviceId = null;
    });
    ["initialization_error", "authentication_error", "account_error", "playback_error"].forEach((ev) => {
      player.addListener(ev, ({ message }) => {
        if (ui.onError) ui.onError(ev, message);
      });
    });
    player.addListener("player_state_changed", (state) => {
      if (ui.onState) ui.onState(state);
    });
    player.connect();
  }

  // Lance la playlist à partir de la chanson « index »
  async function playAt(playlistId, index) {
    if (!deviceId) throw new Error("player-not-ready");
    const dev = encodeURIComponent(deviceId);
    await api("PUT", "/me/player", { device_ids: [deviceId], play: false });
    await api("PUT", "/me/player/play?device_id=" + dev, {
      context_uri: "spotify:playlist:" + playlistId,
      offset: { position: index },
    });
  }

  function toggle() {
    if (player) player.togglePlay();
  }

  function next() {
    if (player) player.nextTrack();
  }

  function previous() {
    if (player) player.previousTrack();
  }

  function pause() {
    if (player) player.pause();
  }

  KA.spotify = {
    isConnected,
    login,
    logout,
    finishLoginIfNeeded,
    playlistTracks,
    connectPlayer,
    playAt,
    toggle,
    next,
    previous,
    pause,
    // pour les tests
    _challengeOf: challengeOf,
  };
})();
