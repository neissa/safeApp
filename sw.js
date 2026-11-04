/* Service worker : l'appli fonctionne hors ligne une fois chargée.
   Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours.
   Spotify, la météo et les fichiers du téléphone ne sont jamais mis en cache.
   La version et la liste des fichiers sont mises à jour par tools/update-cache.js. */
const CACHE = "mon-coin-magique-1e8dd2d7df85";

// BEGIN SHELL (généré par tools/update-cache.js)
const SHELL = [
  "./",
  "./css/fonts/PlaywriteFRTrad-Regular.ttf",
  "./css/style.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/alphabet.js",
  "./js/animaux.js",
  "./js/bruits.js",
  "./js/calc.js",
  "./js/cheval.js",
  "./js/clock.js",
  "./js/core.js",
  "./js/couleurs.js",
  "./js/draw.js",
  "./js/farts.js",
  "./js/gallery.js",
  "./js/games.js",
  "./js/home.js",
  "./js/labyrinthe.js",
  "./js/main.js",
  "./js/megaphone.js",
  "./js/memory.js",
  "./js/morpion.js",
  "./js/music.js",
  "./js/notes.js",
  "./js/ombres.js",
  "./js/pacman.js",
  "./js/parent.js",
  "./js/piano.js",
  "./js/pin.js",
  "./js/puissance4.js",
  "./js/puzzle.js",
  "./js/raptor.js",
  "./js/recorder.js",
  "./js/snake.js",
  "./js/spotify.js",
  "./js/stats.js",
  "./js/timer.js",
  "./js/ui.js",
  "./js/voice-worklet.js",
  "./manifest.json",
  "./sounds/animaux/canard.mp3",
  "./sounds/animaux/chat.ogg",
  "./sounds/animaux/cheval.ogg",
  "./sounds/animaux/chien.ogg",
  "./sounds/animaux/cochon.ogg",
  "./sounds/animaux/coq.ogg",
  "./sounds/animaux/mouton.ogg",
  "./sounds/animaux/vache.ogg",
  "./sounds/farts/apebble-fart-10-228250.mp3",
  "./sounds/farts/apebble-fart-2-228242.mp3",
  "./sounds/farts/apebble-fart-3-228243.mp3",
  "./sounds/farts/apebble-fart-4-228244.mp3",
  "./sounds/farts/apebble-fart-5-228245.mp3",
  "./sounds/farts/apebble-fart-6-228246.mp3",
  "./sounds/farts/apebble-fart-8-228248.mp3",
  "./sounds/farts/apebble-fart-9-228249.mp3",
  "./sounds/farts/freesound_community-fart-3-89567.mp3",
  "./sounds/raptor-sound.mp3",
  "./sounds/raptor-sound.ogg",
  "./index.html",
];
// END SHELL

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Seulement les fichiers de l'appli, pas les services externes
  if (url.origin !== self.location.origin) return;
  // Retour de connexion Spotify : toujours depuis le réseau
  if (url.searchParams.has("code")) return;

  event.respondWith(
    // « no-cache » : on demande toujours la version actuelle au serveur (pas l'ancienne copie du navigateur)
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        // Hors ligne : les fichiers sont en cache sans le numéro de version (?v=…)
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html"))
      )
  );
});
