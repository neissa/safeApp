/* Code à 4 chiffres pour ouvrir le menu parent.
   Premier usage : on crée le code. Ensuite : on le saisit. Oubli : la question d'addition
   permet de le recréer. Le code est gardé sous forme d'empreinte, jamais en clair. */
(function () {
  "use strict";

  const KA = window.KA;
  const PIN_KEY = "mcm.parentPin";
  const LEN = 4;

  let box = null;
  let titleEl = null;
  let dotsEl = null;
  let msgEl = null;
  let padEl = null;
  let recoverBtn = null;
  let st = { mode: "enter", entered: "", first: "", onOk: null };

  // Empreinte du code (SHA-256 si le navigateur le permet, sinon une somme simple)
  async function hashPin(pin) {
    const text = "mcm-pin:" + pin;
    if (window.crypto && crypto.subtle) {
      const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
    return "h" + (h >>> 0).toString(16);
  }

  function storedPin() {
    return KA.ls.get(PIN_KEY, "");
  }

  function renderDots() {
    dotsEl.querySelectorAll("span").forEach((s, i) => s.classList.toggle("on", i < st.entered.length));
  }

  function setTitle(text) {
    titleEl.textContent = text;
  }

  function show(mode, onOk) {
    st = { mode, entered: "", first: "", onOk };
    msgEl.textContent = "";
    recoverBtn.hidden = mode !== "enter";
    if (mode === "enter") setTitle("Entre le code");
    else if (mode === "create1") setTitle("Choisis un code à 4 chiffres");
    else setTitle("Retape le code");
    renderDots();
    box.hidden = false;
  }

  function close() {
    box.hidden = true;
  }

  function success() {
    const cb = st.onOk;
    close();
    if (cb) cb();
  }

  async function complete() {
    const pin = st.entered;
    if (st.mode === "enter") {
      const ok = (await hashPin(pin)) === storedPin();
      if (ok) return success();
      msgEl.textContent = "Code incorrect";
      shake();
      st.entered = "";
      renderDots();
      return;
    }
    if (st.mode === "create1") {
      st.first = pin;
      st.mode = "create2";
      st.entered = "";
      setTitle("Retape le code");
      renderDots();
      return;
    }
    // create2 : on vérifie que les deux codes sont identiques
    if (pin !== st.first) {
      msgEl.textContent = "Les codes ne sont pas pareils, recommence";
      shake();
      st.mode = "create1";
      st.first = "";
      st.entered = "";
      setTitle("Choisis un code à 4 chiffres");
      renderDots();
      return;
    }
    KA.ls.set(PIN_KEY, await hashPin(pin));
    msgEl.textContent = "";
    success();
  }

  function shake() {
    dotsEl.classList.remove("shake");
    void dotsEl.offsetWidth;
    dotsEl.classList.add("shake");
  }

  function press(key) {
    if (key === "⌫") {
      st.entered = st.entered.slice(0, -1);
    } else if (/^\d$/.test(key) && st.entered.length < LEN) {
      st.entered += key;
    } else {
      return;
    }
    renderDots();
    if (st.entered.length === LEN) setTimeout(complete, 150);
  }

  function buildPad() {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
    keys.forEach((k) => {
      const b = document.createElement("button");
      b.className = "pin-key";
      if (!k) {
        b.classList.add("blank");
        b.disabled = true;
      } else {
        b.textContent = k;
        b.setAttribute("aria-label", k === "⌫" ? "Effacer" : k);
        b.addEventListener("click", () => press(k));
      }
      padEl.appendChild(b);
    });
  }

  // Oubli du code : la question d'addition permet de le recréer
  function recover() {
    close();
    KA.challenge(() => show("create1", st.onOk));
  }

  // Ouvre la saisie du code. Avec { create: true }, on crée (ou change) le code.
  KA.askPin = function (opts) {
    const onOk = opts && opts.onOk ? opts.onOk : null;
    if (opts && opts.create) show("create1", onOk);
    else if (!storedPin()) show("create1", onOk);
    else show("enter", onOk);
  };

  document.addEventListener("DOMContentLoaded", () => {
    box = document.getElementById("pin");
    if (!box) return;
    titleEl = document.getElementById("pin-title");
    dotsEl = document.getElementById("pin-dots");
    msgEl = document.getElementById("pin-msg");
    padEl = document.getElementById("pin-pad");
    recoverBtn = document.getElementById("pin-recover");
    buildPad();
    recoverBtn.addEventListener("click", recover);
    document.getElementById("pin-cancel").addEventListener("click", close);
    // Un appui sur le fond ferme aussi
    box.addEventListener("pointerdown", (e) => {
      if (e.target === box) close();
    });
    // Clavier (ordinateur)
    document.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "Escape") close();
      else if (e.key === "Backspace") press("⌫");
      else if (/^\d$/.test(e.key)) press(e.key);
    });
  });
})();
