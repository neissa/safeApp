/* Accueil personnalisable :
   - un appui sur l'icône en haut change d'icône (elles défilent) ;
   - cinq appuis rapides sur le titre ouvrent un champ pour le changer.
   Les deux réglages sont mémorisés sur l'appareil. */
(function () {
  "use strict";

  const KA = window.KA;
  const TITLE_KEY = "mcm.homeTitle";
  const ICON_KEY = "mcm.homeIcon";
  const DEFAULT_TITLE = "Mon coin magique";
  const ICONS = ["🌈", "🦄", "🚀", "🐱", "🌟", "🌸", "🐠", "🚒", "🎈", "⚽"];
  const SECRET_TAPS = 5;
  const TAP_WINDOW_MS = 4000;
  const MAX_TITLE = 30;

  let iconEl, titleEl, editBox, editInput, editMsg;
  let tapTimes = [];

  function nextIcon() {
    const current = KA.ls.get(ICON_KEY, ICONS[0]);
    const i = ICONS.indexOf(current);
    const next = ICONS[(i + 1) % ICONS.length];
    KA.ls.set(ICON_KEY, next);
    iconEl.textContent = next;
  }

  function countTitleTap() {
    const now = Date.now();
    tapTimes = tapTimes.filter((t) => now - t < TAP_WINDOW_MS);
    tapTimes.push(now);
    if (tapTimes.length >= SECRET_TAPS) {
      tapTimes = [];
      openEditor();
    }
  }

  function openEditor() {
    editInput.value = titleEl.textContent;
    editMsg.textContent = "";
    editBox.hidden = false;
    editInput.focus();
  }

  function closeEditor() {
    editBox.hidden = true;
    editMsg.textContent = "";
  }

  function saveTitle() {
    const text = editInput.value.trim().slice(0, MAX_TITLE);
    if (!text) {
      editMsg.textContent = "Écris un titre";
      return;
    }
    KA.ls.set(TITLE_KEY, text);
    titleEl.textContent = text;
    closeEditor();
  }

  function init() {
    iconEl = document.getElementById("home-icon");
    titleEl = document.getElementById("home-title");
    editBox = document.getElementById("title-set");
    editInput = document.getElementById("title-input");
    editMsg = document.getElementById("title-msg");
    if (!iconEl || !titleEl || !editBox) return;

    iconEl.textContent = KA.ls.get(ICON_KEY, ICONS[0]);
    titleEl.textContent = KA.ls.get(TITLE_KEY, DEFAULT_TITLE);

    iconEl.addEventListener("click", nextIcon);
    titleEl.addEventListener("click", countTitleTap);
    document.getElementById("title-save").addEventListener("click", saveTitle);
    document.getElementById("title-cancel").addEventListener("click", closeEditor);
    editInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveTitle();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
