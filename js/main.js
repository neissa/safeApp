/* Navigation entre l'accueil et les panneaux */
(function () {
  "use strict";

  const KA = window.KA;
  let current = "home";

  // Historique du navigateur = pile des panneaux : ouvrir un panneau ajoute une entrée, « retour » la dépile.
  // Ainsi la touche Retour du téléphone (et 🏠) ramène à l'accueil sans quitter l'appli.
  history.replaceState({ ka: true, screen: "home" }, "");
  history.pushState({ ka: true, screen: "home" }, ""); // une entrée sous l'accueil : Retour ne sort jamais de l'appli

  function show(name, fromHistory) {
    if (name === current) return;
    if (name !== "home" && KA.stats) KA.stats.count(name);
    if (!fromHistory) history.pushState({ ka: true, screen: name }, "");
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

  // Retour à l'accueil comme le bouton Retour : on revient d'une entrée d'historique (popstate fait le reste)
  function goHome() {
    if (current === "home") return;
    history.back();
  }

  // Touche Retour du téléphone : d'un panneau, revient à l'accueil ; sur l'accueil, ne fait rien.
  // Renvoie true si l'appli a géré le retour (on était dans un panneau), false sinon.
  KA.handleBack = function () {
    if (current === "home") return false;
    goHome();
    return true;
  };

  window.addEventListener("popstate", (e) => {
    const name = e.state && e.state.screen ? e.state.screen : "home";
    show(name, true);
    // Sur l'accueil, on remet une entrée sous soi pour que la prochaine pression reste dans l'appli
    if (name === "home") history.pushState({ ka: true, screen: "home" }, "");
  });

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
      btn.addEventListener("click", goHome);
    });
  });
})();
