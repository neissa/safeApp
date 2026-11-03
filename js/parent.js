/* Menu parent : titre de l'accueil, bruitages et voix, sauvegarde et restauration.
   Ouvert par cinq appuis sur le titre de l'accueil, puis une question de contrôle. */
(function () {
  "use strict";

  const KA = window.KA;
  const APP_ID = "mon-coin-magique";
  const TITLE_KEY = "mcm.homeTitle";
  const MAX_TITLE = 30;

  let box, titleInput, titleSave, soundBtn, voiceBtn, storageInfo, exportBtn, importBtn, fileInput, msg;

  function refreshToggles() {
    const sounds = KA.settings.get("sounds", true);
    const voice = KA.settings.get("voice", true);
    soundBtn.textContent = sounds ? "🔊 Bruitages : oui" : "🔇 Bruitages : non";
    voiceBtn.textContent = voice ? "🗣️ Voix : oui" : "🤐 Voix : non";
  }

  async function refreshStorage() {
    let persisted = false;
    try {
      persisted = !!(navigator.storage && navigator.storage.persisted && (await navigator.storage.persisted()));
    } catch (e) {
      persisted = false;
    }
    storageInfo.textContent = persisted
      ? "💾 Stockage protégé : les créations restent sur l'appareil"
      : "⚠️ Stockage non protégé : pense à faire une sauvegarde";
  }

  function open() {
    titleInput.value = KA.ls.get(TITLE_KEY, "Mon coin magique");
    msg.textContent = "";
    refreshToggles();
    refreshStorage();
    box.hidden = false;
  }

  function close() {
    box.hidden = true;
  }

  function saveTitle() {
    const text = titleInput.value.trim().slice(0, MAX_TITLE);
    if (!text) {
      msg.textContent = "Écris un titre";
      return;
    }
    KA.ls.set(TITLE_KEY, text);
    const el = document.getElementById("home-title");
    if (el) el.textContent = text;
    msg.textContent = "Titre enregistré";
  }

  // Sauvegarde : toutes les créations (dessins, photos, enregistrements, chansons) et les réglages
  async function exportBackup() {
    msg.textContent = "Préparation de la sauvegarde…";
    try {
      const items = await KA.db.all();
      const out = { app: APP_ID, version: 1, exportedAt: new Date().toISOString(), items: [], settings: {} };
      for (const it of items) {
        const rec = Object.assign({}, it);
        if (it.blob) rec.blob = await KA.blobToDataUrl(it.blob);
        out.items.push(rec);
      }
      Object.keys(localStorage)
        .filter((k) => k.indexOf("mcm.") === 0 && k !== "mcm.spotifyTokens")
        .forEach((k) => (out.settings[k] = localStorage.getItem(k)));

      const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mon-coin-magique-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      msg.textContent = "Sauvegarde téléchargée (" + out.items.length + " éléments)";
    } catch (e) {
      msg.textContent = "Sauvegarde impossible : " + e.message;
    }
  }

  async function importBackup(file) {
    msg.textContent = "Restauration en cours…";
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== APP_ID || !Array.isArray(data.items)) throw new Error("fichier non reconnu");
      for (const it of data.items) {
        if (typeof it.blob === "string") it.blob = await (await fetch(it.blob)).blob();
        await KA.db.put(it);
      }
      Object.keys(data.settings || {}).forEach((k) => localStorage.setItem(k, data.settings[k]));
      msg.textContent = "Restauration terminée. Recharge la page pour tout voir.";
    } catch (e) {
      msg.textContent = "Restauration impossible : " + e.message;
    }
    fileInput.value = "";
  }

  KA.parent = { open, close };

  document.addEventListener("DOMContentLoaded", () => {
    box = document.getElementById("parent");
    if (!box) return;
    titleInput = document.getElementById("parent-title");
    titleSave = document.getElementById("parent-title-save");
    soundBtn = document.getElementById("parent-sound");
    voiceBtn = document.getElementById("parent-voice");
    storageInfo = document.getElementById("parent-storage");
    exportBtn = document.getElementById("parent-export");
    importBtn = document.getElementById("parent-import");
    fileInput = document.getElementById("parent-file");
    msg = document.getElementById("parent-msg");

    titleSave.addEventListener("click", saveTitle);
    titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveTitle();
    });
    soundBtn.addEventListener("click", () => {
      KA.settings.set("sounds", !KA.settings.get("sounds", true));
      refreshToggles();
    });
    voiceBtn.addEventListener("click", () => {
      KA.settings.set("voice", !KA.settings.get("voice", true));
      refreshToggles();
    });
    exportBtn.addEventListener("click", exportBackup);
    importBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) importBackup(fileInput.files[0]);
    });
    document.getElementById("parent-close").addEventListener("click", close);
  });
})();
