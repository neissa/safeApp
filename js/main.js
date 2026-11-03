/* Navigation entre l'accueil et les panneaux */
(function () {
  "use strict";

  const KA = window.KA;
  let current = "home";

  function show(name) {
    if (name === current) return;
    if (name !== "home" && KA.stats) KA.stats.count(name);
    const prev = current;
    current = name;
    document.querySelectorAll(".screen").forEach((s) => {
      s.classList.toggle("active", s.id === "screen-" + name);
    });
    if (prev !== "home") KA.panels[prev] && KA.panels[prev].leave && KA.panels[prev].leave();
    if (name !== "home") KA.panels[name] && KA.panels[name].enter && KA.panels[name].enter();
    window.scrollTo(0, 0);
  }

  // Ouvre un panneau depuis le code (par exemple après la connexion Spotify)
  KA.showPanel = show;

  // Pour l'intégration dans une webview : à appeler sur le bouton "retour" natif.
  // Renvoie true si l'appli a géré le retour (on était dans un panneau), false sinon.
  KA.handleBack = function () {
    if (current === "home") return false;
    show("home");
    return true;
  };

  document.addEventListener("DOMContentLoaded", () => {
    Object.entries(KA.panels).forEach(([name, panel]) => {
      const root = document.getElementById("screen-" + name);
      if (root && panel.init) panel.init(root);
    });

    document.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        KA.speak(btn.dataset.say, { lang: btn.dataset.lang });
        show(btn.dataset.open);
      });
    });

    document.querySelectorAll("[data-back]").forEach((btn) => {
      btn.addEventListener("click", () => show("home"));
    });
  });
})();
