/* Croix de direction commune aux jeux (Snake, Pac-Man, Labyrinthe…).
   HTML : une boîte vide <div class="dpad"></div> dans l'écran du jeu ; les quatre flèches sont créées ici.
   Jeu  : KA.pad(root, onDir, { swipe: élément })  —  onDir reçoit "up", "down", "left" ou "right".
   Même comportement partout :
   - une flèche réagit dès que le doigt se pose (sans attendre qu'il se lève) ;
   - les flèches du clavier envoient la même direction, seulement quand l'écran du jeu est affiché ;
   - glisser le doigt sur l'élément « swipe » (le plateau) donne aussi une direction. */
(function () {
  "use strict";

  const KA = window.KA;
  const ARROWS = [
    { dir: "up", ico: "⬆️", label: "Haut" },
    { dir: "left", ico: "⬅️", label: "Gauche" },
    { dir: "down", ico: "⬇️", label: "Bas" },
    { dir: "right", ico: "➡️", label: "Droite" },
  ];
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const SWIPE_MIN = 24; // distance minimale (px) pour qu'un glissement compte

  KA.pad = function (root, onDir, opts) {
    const box = root.querySelector(".dpad");

    // Les quatre flèches
    ARROWS.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "dpad-key dpad-" + a.dir;
      b.textContent = a.ico;
      b.setAttribute("aria-label", a.label);
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        onDir(a.dir);
      });
      // Bouton activé au clavier (Entrée ou Espace) : pas de pointerdown, seulement un click sans souris
      b.addEventListener("click", (e) => {
        if (e.detail === 0) onDir(a.dir);
      });
      box.appendChild(b);
    });

    // Flèches du clavier, uniquement quand cet écran est affiché
    document.addEventListener("keydown", (e) => {
      if (!root.classList.contains("active") || !KEYS[e.key]) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      onDir(KEYS[e.key]);
    });

    // Glisser le doigt sur le plateau
    const zone = opts && opts.swipe;
    if (zone) {
      zone.style.touchAction = "none"; // le glissement ne fait pas défiler la page
      let from = null;
      zone.addEventListener("pointerdown", (e) => {
        from = { x: e.clientX, y: e.clientY };
      });
      const end = (e) => {
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        from = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
        if (Math.abs(dx) > Math.abs(dy)) onDir(dx > 0 ? "right" : "left");
        else onDir(dy > 0 ? "down" : "up");
      };
      zone.addEventListener("pointerup", end);
      zone.addEventListener("pointercancel", () => {
        from = null;
      });
    }
  };
})();
