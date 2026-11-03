/* Accueil personnalisable :
   - un appui sur l'icône change d'icône (elles défilent) ;
   - cinq appuis rapides sur le titre ouvrent le menu parent, après une question de contrôle.
   L'icône et le titre sont mémorisés sur l'appareil. */
(function () {
  "use strict";

  const KA = window.KA;
  const TITLE_KEY = "mcm.homeTitle";
  const ICON_KEY = "mcm.homeIcon";
  const DEFAULT_TITLE = "Mon coin magique";
  const ICONS = ["🌈", "🦄", "🚀", "🐱", "🌟", "🌸", "🐠", "🚒", "🎈", "⚽"];

  function nextIcon(iconEl) {
    const current = KA.ls.get(ICON_KEY, ICONS[0]);
    const i = ICONS.indexOf(current);
    const next = ICONS[(i + 1) % ICONS.length];
    KA.ls.set(ICON_KEY, next);
    iconEl.textContent = next;
  }

  function init() {
    const iconEl = document.getElementById("home-icon");
    const titleEl = document.getElementById("home-title");
    if (!iconEl || !titleEl) return;

    iconEl.textContent = KA.ls.get(ICON_KEY, ICONS[0]);
    titleEl.textContent = KA.ls.get(TITLE_KEY, DEFAULT_TITLE);

    iconEl.addEventListener("click", () => nextIcon(iconEl));
    KA.tap(titleEl, 5, () => KA.challenge(() => KA.parent.open()));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
