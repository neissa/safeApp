# Mon coin magique

Une application pour les petits : un écran d'accueil avec de grosses tuiles colorées, des activités simples à utiliser sans savoir lire, et un menu parent protégé par un code.

L'application est une page web statique en français. Elle s'installe comme une application (PWA) ou sur Android avec l'APK (TWA générée avec PWABuilder, dans `apk/`). Elle fonctionne hors ligne grâce au service worker. Tout ce que l'enfant crée (dessins, photos, enregistrements…) reste sur l'appareil.

## Accueil

- Grandes tuiles avec une icône et un nom. Chaque tuile est annoncée à voix haute quand on la touche.
- Un appui sur l'icône du titre la change (les icônes défilent).
- Surprise : quinze appuis rapides sur cette icône font traverser l'écran à un dinosaure qui rugit.
- Bouton « 🔄 Mise à jour » quand une nouvelle version est disponible.
- Bouton 🔧 pour ouvrir le menu parent.

## Activités

| Tuile | Ce qu'on peut faire |
| --- | --- |
| 🎨 **Dessin** | Plusieurs dessins enregistrés automatiquement, avec vignettes. Crayon, gomme, pot de peinture, tampons (⭐ ❤️ ☀️ 🌸 🐶 🚗 🌈 🎈), choix de la couleur, de la forme et de la taille du pinceau, bouton pour annuler. |
| 📝 **Bloc notes** | Écriture libre sauvegardée automatiquement, lecture à voix haute, bouton **AA** pour passer de l'écriture cursive aux capitales. |
| 🧮 **Nombre** | Calculatrice avec lecture du résultat à voix haute, et un mode jeu : **compter** des objets ou **calculer** avec des objets, avec des étoiles à gagner. |
| 🖼️ **Galerie** | Prendre des photos avec la caméra ou en ajouter depuis le téléphone, les voir en grand, les supprimer. |
| 🎵 **Musique** | Écouter les chansons du téléphone (liste, chanson précédente et suivante, mini-lecteur en bas de l'écran). Onglet **Spotify** : playlist choisie par le parent, avec lecture complète si un compte Premium est connecté. |
| 🎙️ **Enregistrement** | Enregistrer sa voix en voyant le niveau du son en direct, puis réécouter avec la forme d'onde qui suit la lecture. |
| 🎹 **Piano** | Un piano libre d'une octave, et un piano de couleurs pour jouer à **Simon** : répéter la suite de notes, qui s'allonge à chaque réussite. Meilleur score gardé. |
| 🃏 **Memory** | Trouver les paires de cartes. Quatre niveaux : 3×2, 4×4, 5×4 et 6×6. Compteur de coups. |
| ⏱️ **Minuteur** | Compte à rebours avec durées rapides (1 min, 5 min, 10 min, 30 min, 1 h) et anneau qui se vide. Continue si l'on change d'activité. À la fin : alarme et annonce vocale. |
| 🔶 **Formes** | Toucher la forme demandée à voix haute. Une étoile par bonne réponse. |
| 🔍 **L'intrus** | Trouver l'image qui n'a rien à faire avec les autres. Consigne dite à voix haute, étoiles à gagner. |
| 🐍 **Snake** | Guider le serpent vers les pommes avec les flèches ou en glissant le doigt. Le serpent traverse les bords ; on ne perd qu'en se mordant la queue. Meilleur score gardé. |
| 🕐 **Date et heure** | Heure en chiffres et horloge à aiguilles, date du jour, saison et météo (Open-Meteo, selon la position ou Paris par défaut). Chaque élément est lu à voix haute quand on le touche. |
| 💨 **Bruits de pet** | Une case par bruit, et un bouton « 🎲 Au hasard ». |
| 📢 **Mégaphone** | Parler au micro et entendre sa voix changée en direct : normale, aiguë, grave, robot, écho ou mégaphone. Un casque évite les sifflements. |
| ❌ **Morpion** | Aligner trois symboles, à deux sur le même écran. |
| 🔴 **Puissance 4** | Aligner quatre jetons, à deux sur le même écran. |
| 🔤 **Alphabet** | Toucher une lettre : on entend la lettre, puis un mot qui commence par elle (« A comme avion »), et on voit son image. |
| 🧩 **Puzzle** | Remettre l'image en place : on touche deux morceaux pour les échanger. 2 × 2 ou 3 × 3. |
| 🗺️ **Labyrinthe** | Guider le poussin 🐣 jusqu'au drapeau 🏁. 5 × 5, 7 × 7 ou 9 × 9, avec les flèches à l'écran, au clavier ou en glissant le doigt. |
| 🌘 **Ombres** | Retrouver l'ombre noire qui correspond à l'image en couleur. |
| 🐶 **Animaux** | Écouter le cri de chaque animal, ou deviner l'animal au cri. Sons libres de droits (voir `sounds/animaux/LICENCES.txt`). |
| 🟡 **Pac-Man** | Manger les étoiles du labyrinthe en évitant le fantôme, avec les flèches à l'écran, au clavier ou en glissant le doigt. Trois vies, version douce pour les petits. |
| 🐴 **Cheval** | Jeu de plateforme qui défile : le cheval mange carottes et foin, et saute les obstacles de CSO. Garder le doigt sur le bouton fait sauter plus loin. |
| 🔴 **Couleurs** | La voix demande une couleur : on touche la bonne case parmi quatre. |
| 🌧️ **Bruits doux** | Bruit blanc, pluie, orage, vagues, vent ou feu de bois, fabriqués par l'appareil. Un seul son à la fois, avec un minuteur de sommeil de 15 min, 30 min ou 1 h. |

## Menu parent

Ouvert avec le bouton 🔧, protégé par un **code à 4 chiffres** (créé au premier usage, jamais gardé en clair). En cas d'oubli, une question de calcul permet de le recréer.

- **Accueil** : changer le titre de l'accueil.
- **Tuiles** : cacher ou afficher chaque tuile.
- **Statistiques** : nombre de lancements de chaque activité (depuis toujours et par jour sur 60 jours), camembert de la journée, remise à zéro.
- **Sons** : couper ou remettre les bruitages et la voix, choisir la voix des annonces.
- **Thème** : clair, sombre ou comme l'appareil.
- **Spotify** : se connecter ou se déconnecter, choisir la playlist.
- **Sauvegarde** : place utilisée, sauvegarder toutes les données dans un fichier et les restaurer.
- **Application** : version et date de construction, vérifier et installer une mise à jour.
- **Sécurité** : changer le code.

## Données et vie privée

- Les dessins, photos, chansons et enregistrements sont gardés dans le navigateur de l'appareil (IndexedDB), les réglages dans le stockage local.
- Rien n'est envoyé sur un serveur, sauf la position approximative pour la météo (Open-Meteo) et, si le parent la connecte, l'utilisation de Spotify.

## Lancer l'application

Aucune compilation : il suffit de servir le dossier avec un serveur web statique, par exemple :

```sh
bunx serve .
```

puis d'ouvrir `index.html` dans le navigateur. Pour les règles de développement (mise à jour du cache, ajout d'une tuile, etc.), voir [CLAUDE.md](CLAUDE.md).

## Projets et ressources open source

- **Raptorize** (licence MIT) : le cri du dinosaure. Voir `sounds/RAPTORIZE-LICENSE.txt`.
- **Playwrite FR Trad** (licence OFL) : la police d'écriture cursive. Voir `css/fonts/OFL.txt`.
- **Cris d'animaux** (Wikimedia Commons, licences CC BY-SA, CC BY, GFDL ou domaine public) : le chat, le chien, la vache, le canard, le cochon, le mouton, le cheval et le coq. Voir `sounds/animaux/LICENCES.txt`.
- **Bruit blanc** : aucun fichier, les bruits d'ambiance (pluie, orage, vagues, vent, feu) sont fabriqués par le navigateur.
- **Bun** : outil de développement pour le script de mise à jour du cache (`tools/update-cache.js`). Il n'est pas nécessaire pour utiliser l'application.

## Licence

GPL-3.0 (voir [LICENSE](LICENSE)).
