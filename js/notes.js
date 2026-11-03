/* Panneau bloc-notes : écriture libre, sauvegarde automatique, lecture à voix haute.
   Bouton AA : passe de l'écriture cursive à des capitales (et inversement). */
(function () {
  "use strict";

  const KA = window.KA;
  const KEY = "mcm.note";

  KA.panels.notes = {
    init(root) {
      const area = root.querySelector("#note-text");
      const capsBtn = root.querySelector("#note-caps");
      area.value = KA.ls.get(KEY, "");
      area.addEventListener("input", () => KA.ls.set(KEY, area.value));

      root.querySelector("#note-read").addEventListener("click", () => {
        // Lecture demandée explicitement : elle marche même si la voix est coupée dans le menu parent
        KA.speak(area.value.trim() || "La page est vide", { force: true });
      });

      const clearBtn = root.querySelector("#note-clear");
      clearBtn.addEventListener("click", () =>
        KA.armed(clearBtn, () => {
          area.value = "";
          KA.ls.set(KEY, "");
        })
      );

      // Écriture : cursive (par défaut) ou capitales, mémorisée sur l'appareil
      function paint() {
        const caps = KA.settings.get("noteCaps", false);
        area.classList.toggle("caps", caps);
        capsBtn.textContent = caps ? "aa" : "AA";
        capsBtn.setAttribute("aria-pressed", caps ? "true" : "false");
      }
      capsBtn.addEventListener("click", () => {
        KA.settings.set("noteCaps", !KA.settings.get("noteCaps", false));
        paint();
      });
      paint();
    },
  };
})();
