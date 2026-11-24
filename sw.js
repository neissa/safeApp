/* Service worker : l'appli fonctionne hors ligne une fois chargée.
   Réseau d'abord (les mises à jour arrivent tout de suite), cache en secours.
   Spotify, la météo, version.json et les fichiers du téléphone ne sont jamais mis en cache.
   La version et la liste des fichiers sont mises à jour par tools/update-cache.js. */
const CACHE = "mon-coin-magique-fca5ba66ef8c";

// BEGIN SHELL (généré par tools/update-cache.js)
const SHELL = [
  "./",
  "./coloriages/abeille.png",
  "./coloriages/ambulance.png",
  "./coloriages/ane.png",
  "./coloriages/astronaute.png",
  "./coloriages/automne.png",
  "./coloriages/avion.png",
  "./coloriages/balancoire.png",
  "./coloriages/baleine.png",
  "./coloriages/ballons.png",
  "./coloriages/bateau-pirate.png",
  "./coloriages/bonhomme-de-neige.png",
  "./coloriages/bus.png",
  "./coloriages/camion-poubelle.png",
  "./coloriages/canard.png",
  "./coloriages/cerf-volant.png",
  "./coloriages/champignon.png",
  "./coloriages/chat.png",
  "./coloriages/chateau-de-sable.png",
  "./coloriages/chateau.png",
  "./coloriages/chenille.png",
  "./coloriages/cheval.png",
  "./coloriages/chevalier.png",
  "./coloriages/chevre.png",
  "./coloriages/chien-astronaute.png",
  "./coloriages/chien.png",
  "./coloriages/citrouille.png",
  "./coloriages/coccinelle.png",
  "./coloriages/cochon.png",
  "./coloriages/comete.png",
  "./coloriages/coquillages.png",
  "./coloriages/crabe.png",
  "./coloriages/crocodile.png",
  "./coloriages/cubes.png",
  "./coloriages/cuisinier.png",
  "./coloriages/cupcake.png",
  "./coloriages/danseuse.png",
  "./coloriages/dauphin.png",
  "./coloriages/dinosaure.png",
  "./coloriages/docteur.png",
  "./coloriages/dragon.png",
  "./coloriages/elephant.png",
  "./coloriages/escargot.png",
  "./coloriages/extraterrestre.png",
  "./coloriages/fee.png",
  "./coloriages/ferme.png",
  "./coloriages/fermier.png",
  "./coloriages/fleurs.png",
  "./coloriages/football.png",
  "./coloriages/fourmi.png",
  "./coloriages/fruits.png",
  "./coloriages/fusee.png",
  "./coloriages/gateau.png",
  "./coloriages/girafe.png",
  "./coloriages/glace.png",
  "./coloriages/guitare.png",
  "./coloriages/helicoptere.png",
  "./coloriages/herisson.png",
  "./coloriages/hippocampe.png",
  "./coloriages/hippopotame.png",
  "./coloriages/jardinier.png",
  "./coloriages/kangourou.png",
  "./coloriages/koala.png",
  "./coloriages/lapin-de-paques.png",
  "./coloriages/lapin.png",
  "./coloriages/libellule.png",
  "./coloriages/licorne.png",
  "./coloriages/lion.png",
  "./coloriages/lune.png",
  "./coloriages/maison.png",
  "./coloriages/maitresse.png",
  "./coloriages/masque.png",
  "./coloriages/meduse.png",
  "./coloriages/moto.png",
  "./coloriages/mouton.png",
  "./coloriages/nounours.png",
  "./coloriages/oeuf-dinosaure.png",
  "./coloriages/ours.png",
  "./coloriages/panda.png",
  "./coloriages/papillon.png",
  "./coloriages/peintre.png",
  "./coloriages/pere-noel.png",
  "./coloriages/phoque.png",
  "./coloriages/pieuvre.png",
  "./coloriages/pirate.png",
  "./coloriages/pizza.png",
  "./coloriages/planetes.png",
  "./coloriages/pluie.png",
  "./coloriages/poisson.png",
  "./coloriages/police.png",
  "./coloriages/policier.png",
  "./coloriages/pompier.png",
  "./coloriages/pompiers.png",
  "./coloriages/poule.png",
  "./coloriages/poupee.png",
  "./coloriages/princesse.png",
  "./coloriages/pterodactyle.png",
  "./coloriages/requin.png",
  "./coloriages/robot.png",
  "./coloriages/rover.png",
  "./coloriages/sapin.png",
  "./coloriages/singe.png",
  "./coloriages/sirene.png",
  "./coloriages/soucoupe.png",
  "./coloriages/sous-marin.png",
  "./coloriages/station-spatiale.png",
  "./coloriages/stegosaure.png",
  "./coloriages/t-rex.png",
  "./coloriages/tigre.png",
  "./coloriages/tortue.png",
  "./coloriages/tournesol.png",
  "./coloriages/tracteur.png",
  "./coloriages/train.png",
  "./coloriages/tresor.png",
  "./coloriages/triceratops.png",
  "./coloriages/vache.png",
  "./coloriages/velo.png",
  "./coloriages/veterinaire.png",
  "./coloriages/voilier.png",
  "./coloriages/voiture.png",
  "./coloriages/zebre.png",
  "./css/fonts/Marelle-Regular.woff2",
  "./css/style.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/alphabet.js",
  "./js/animaux.js",
  "./js/bruits.js",
  "./js/calc.js",
  "./js/cheval.js",
  "./js/clock.js",
  "./js/coloriage-images.js",
  "./js/coloriage-photo.js",
  "./js/coloriage.js",
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
  "./js/pad.js",
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
  "./js/vendor/photo-to-coloring-page.js",
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
  // Vérification de mise à jour (version.json?t=…) : toujours depuis le réseau, jamais dans le cache
  if (url.pathname.endsWith("/version.json")) return;

  event.respondWith(
    // « no-cache » : on demande toujours la version actuelle au serveur (pas l'ancienne copie du navigateur)
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        // Seulement les réponses complètes (200) : une 206 (morceau d'audio) ne peut pas être mise en cache
        if (res.status === 200) {
          const copy = res.clone();
          // Page HTML (navigation) : une seule clé sans paramètres, pour ne pas remplir le cache de « ?maj=… »
          const key = req.mode === "navigate" ? "./index.html" : req;
          caches
            .open(CACHE)
            .then((cache) => cache.put(key, copy))
            .catch(() => {}); // cache plein ou refusé : l'appli continue sans le cache
        }
        return res;
      })
      .catch(() =>
        // Hors ligne : les fichiers sont en cache sans le numéro de version (?v=…)
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html"))
      )
  );
});
