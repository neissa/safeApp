/* Dessins à colorier : images en noir et blanc dans coloriages/ (dessinées avec ChatGPT, puis nettoyées :
   noir et blanc pur, 1024 px, contours fermés). Chaque dessin : id (sert aussi de clé de sauvegarde),
   ico (emoji), name (nom affiché et lu), src (chemin de l’image). coloriage.js accepte aussi un champ svg. */
(function () {
  "use strict";
  const KA = window.KA;
  KA.coloriages = KA.coloriages || [];
  KA.coloriages.push(
    { id: "img-princesse", ico: "👸", name: "Princesse", src: "coloriages/princesse.png" },
    { id: "img-chateau", ico: "🏰", name: "Château", src: "coloriages/chateau.png" },
    { id: "img-sirene", ico: "🧜‍♀️", name: "Sirène", src: "coloriages/sirene.png" },
    { id: "img-fee", ico: "🧚", name: "Fée", src: "coloriages/fee.png" },
    { id: "img-licorne", ico: "🦄", name: "Licorne", src: "coloriages/licorne.png" },
    { id: "img-voiture", ico: "🏎️", name: "Voiture de course", src: "coloriages/voiture.png" },
    { id: "img-pompiers", ico: "🚒", name: "Camion de pompiers", src: "coloriages/pompiers.png" },
    { id: "img-police", ico: "🚓", name: "Voiture de police", src: "coloriages/police.png" },
    { id: "img-tracteur", ico: "🚜", name: "Tracteur", src: "coloriages/tracteur.png" },
    { id: "img-fusee", ico: "🚀", name: "Fusée", src: "coloriages/fusee.png" },
    { id: "img-chat", ico: "🐱", name: "Chat", src: "coloriages/chat.png" },
    { id: "img-chien", ico: "🐶", name: "Chien", src: "coloriages/chien.png" },
    { id: "img-lion", ico: "🦁", name: "Lion", src: "coloriages/lion.png" },
    { id: "img-elephant", ico: "🐘", name: "Éléphant", src: "coloriages/elephant.png" },
    { id: "img-dinosaure", ico: "🦕", name: "Dinosaure", src: "coloriages/dinosaure.png" },
    { id: "img-pompier", ico: "👩‍🚒", name: "Pompier", src: "coloriages/pompier.png" },
    { id: "img-policier", ico: "👮", name: "Policier", src: "coloriages/policier.png" },
    { id: "img-papillon", ico: "🦋", name: "Papillon", src: "coloriages/papillon.png" },
    { id: "img-poisson", ico: "🐠", name: "Poisson", src: "coloriages/poisson.png" },
    { id: "img-maison", ico: "🏡", name: "Maison", src: "coloriages/maison.png" },
  );
})();
