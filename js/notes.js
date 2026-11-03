/* Panneau bloc-notes : écriture libre, sauvegarde automatique, lecture à voix haute */
(function () {
  "use strict";

  const KA = window.KA;
  const KEY = "mcm.note";

  KA.panels.notes = {
    init(root) {
      const area = root.querySelector("#note-text");
      area.value = KA.ls.get(KEY, "");
      area.addEventListener("input", () => KA.ls.set(KEY, area.value));

      root.querySelector("#note-read").addEventListener("click", () => {
        KA.speak(area.value.trim() || "La page est vide");
      });

      const clearBtn = root.querySelector("#note-clear");
      clearBtn.addEventListener("click", () =>
        KA.armed(clearBtn, () => {
          area.value = "";
          KA.ls.set(KEY, "");
        })
      );
    },
  };
})();
