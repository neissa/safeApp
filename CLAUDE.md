# Mon coin magique — consignes pour Claude

Appli web statique en français pour enfants (PWA + APK TWA via PWABuilder). Pas de build : des `<script>` classiques dans `index.html`, un espace global `window.KA`, et un service worker `sw.js` qui garde l'appli hors ligne.

## Mise à jour avant chaque commit

Le téléphone (APK) et les navigateurs gardent une copie en cache. Pour que les changements arrivent, chaque commit doit contenir les fichiers générés à jour. Procédure :

1. Faire toutes les modifications de code.
2. Vérifier la syntaxe des JS modifiés : `bun build --no-bundle js/<fichier>.js >/dev/null && echo ok`.
3. Lancer `bun tools/update-cache.js` **après la dernière modification** (Node n'est pas installé, utiliser bun). Ce script :
   - calcule un numéro de version à partir du contenu de tous les fichiers ;
   - écrit `version.json` ;
   - met à jour dans `index.html` les balises `app-version` et `app-built` (date et heure locales, « AAAA-MM-JJ HH:MM ») ;
   - ajoute un `?v=<hash>` à chaque `<script src>` et `<link href>` de `js/` et `css/` ;
   - met à jour `CACHE` et la liste `SHELL` dans `sw.js` (tous les fichiers de type `.html .js .css .json .ttf .png .mp3 .ogg`).
4. Ne jamais modifier à la main `version.json`, les `?v=`, `CACHE` ou le bloc `SHELL` : le script s'en charge.
5. Commiter ensemble le code et les fichiers générés : `index.html`, `sw.js`, `version.json`.
6. Ne pas committer ni pousser sans demande explicite de l'utilisateur.

Si on modifie quelque chose après le script, relancer le script avant le commit, sinon le cache et `version.json` ne correspondent plus au code.

## Ajouter un fichier JS

- Créer `js/<nom>.js` avec un IIFE `(function () { "use strict"; const KA = window.KA; ... })();`.
- Ajouter la balise `<script src="js/<nom>.js"></script>` dans `index.html`, **avant** `js/main.js` et après les fichiers dont il dépend. Le `?v=` est ajouté par le script de mise à jour.
- Un panneau s'enregistre avec `KA.panels.<nom> = { init(root), enter?(), leave?() }`. `main.js` appelle `init` avec `#screen-<nom>`.

## Ajouter une tuile d'accueil

1. Dans `index.html`, une section `<section id="screen-<nom>" class="screen">` avec une barre `header.bar` et `data-back`.
2. Dans la `nav.tiles` : `<button class="tile t-<nom>" data-open="<nom>" data-say="..." aria-label="..."><span class="tile-ico">…</span><span class="tile-label">…</span></button>`.
3. Dans `css/style.css`, une couleur `.t-<nom> { background: #…; }`.
4. Les statistiques de lancement et la case du menu parent sont automatiques.

## Autres fichiers

- Un nouveau type de fichier (par exemple `.wav`) doit être ajouté à `EXT` dans `tools/update-cache.js`, sinon il n'est pas mis hors ligne.
- Les sons sont dans `sounds/` (`raptor-sound.*`, `farts/*.mp3`).

## Vérification

- Dans un navigateur, recharger la page et vérifier le comportement. Les tests se font avec un clic réel (événements souris), pas seulement `element.click()`.
- Sur l'APK, il faut pousser puis appuyer sur « Mettre à jour l'appli » (menu parent ou bouton « 🔄 Mise à jour » sur l'accueil).

## Langue et style

- Textes de l'appli, commentaires et messages à l'utilisateur en français.
- Les textes visibles par les enfants restent simples et courts.
- Les variables et fonctions du code sont en anglais ou en français selon le fichier existant ; suivre le fichier.
