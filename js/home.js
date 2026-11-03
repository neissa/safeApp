/* Accueil personnalisable : un appui sur l'icône change d'icône (elles défilent).
   Le titre, les tuiles affichées et le menu parent se règlent dans le menu parent,
   ouvert en bas de l'accueil après une question de contrôle. */
(function () {
  "use strict";

  const KA = window.KA;
  const TITLE_KEY = "mcm.homeTitle";
  const ICON_KEY = "mcm.homeIcon";
  const DEFAULT_TITLE = "Mon coin magique";
  const ICONS = ["🌈", "🦄", "🚀", "🐱", "🌟", "🌸", "🐠", "🚒", "🎈", "⚽"];

  // Affiche les tuiles sauf celles désactivées dans le menu parent
  KA.applyTiles = function () {
    const hidden = KA.settings.get("hiddenTiles", []);
    document.querySelectorAll(".tile[data-open]").forEach((t) => {
      t.hidden = hidden.indexOf(t.dataset.open) >= 0;
    });
  };

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
    const parentBtn = document.getElementById("open-parent");
    if (!iconEl || !titleEl) return;

    iconEl.textContent = KA.ls.get(ICON_KEY, ICONS[0]);
    titleEl.textContent = KA.ls.get(TITLE_KEY, DEFAULT_TITLE);
    KA.applyTiles();

    iconEl.addEventListener("click", () => nextIcon(iconEl));
    if (parentBtn) parentBtn.addEventListener("click", () => KA.challenge(() => KA.parent.open()));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
