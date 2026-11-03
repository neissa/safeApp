/* Service worker : l'appli fonctionne hors ligne une fois chargée.
   Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours.
   Spotify, la météo et les fichiers du téléphone ne sont jamais mis en cache.
   La version et la liste des fichiers sont mises à jour par tools/update-cache.js. */
const CACHE = "mon-coin-magique-99ef961b1f69";

// BEGIN SHELL (généré par tools/update-cache.js)
const SHELL = [
  "./",
  "./css/fonts/PlaywriteFRTrad-Regular.ttf",
  "./css/style.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/calc.js",
  "./js/clock.js",
  "./js/core.js",
  "./js/draw.js",
  "./js/gallery.js",
  "./js/home.js",
  "./js/main.js",
  "./js/music.js",
  "./js/notes.js",
  "./js/parent.js",
  "./js/raptor.js",
  "./js/recorder.js",
  "./js/spotify.js",
  "./js/ui.js",
  "./manifest.json",
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
    fetch(req)
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
