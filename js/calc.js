/* Panneau calculatrice : + − × ÷, chiffres énormes. Chaque touche est annoncée à voix haute. */
(function () {
  "use strict";

  const KA = window.KA;
  // Ordre des touches dans la grille (la touche "=" occupe deux lignes)
  const KEYS = ["C", "⌫", "÷", "×", "7", "8", "9", "−", "4", "5", "6", "+", "1", "2", "3", "=", "0", "."];
  const OPS = ["+", "−", "×", "÷"];
  const MAX_DIGITS = 12;
  const st = { current: "0", prev: null, op: null, fresh: true };
  let displayEl = null;

  // Nom vocal de chaque touche
  const KEY_NAMES = {
    "+": "plus",
    "−": "moins",
    "×": "fois",
    "÷": "divisé par",
    ".": "virgule",
    "=": "égal",
    C: "tout effacer",
    "⌫": "effacer",
  };
  for (let d = 0; d <= 9; d++) KEY_NAMES[String(d)] = KA.frNumber(d);

  // Lit une valeur en lettres : « 3.5 » -> « trois virgule cinq »
  function valueWords(s) {
    const neg = s.startsWith("-");
    const body = neg ? s.slice(1) : s;
    const [whole, decimals] = body.split(".");
    let out = KA.frNumber(parseInt(whole, 10));
    if (decimals) {
      out += " virgule " + decimals.split("").map((c) => KA.frNumber(Number(c))).join(" ");
    }
    return (neg ? "moins " : "") + out;
  }

  function show() {
    displayEl.textContent = st.current;
  }

  function reset() {
    st.current = "0";
    st.prev = null;
    st.op = null;
    st.fresh = true;
  }

  // Renvoie false si le calcul est impossible (division par zéro)
  function compute() {
    if (st.op === null || st.prev === null) return true;
    const a = st.prev;
    const b = parseFloat(st.current);
    let r = null;
    switch (st.op) {
      case "+":
        r = a + b;
        break;
      case "−":
        r = a - b;
        break;
      case "×":
        r = a * b;
        break;
      case "÷":
        r = b === 0 ? null : a / b;
        break;
    }
    if (r === null || !Number.isFinite(r)) {
      reset();
      KA.speak("Oh non, on ne peut pas diviser par zéro");
      return false;
    }
    st.current = String(Number(r.toPrecision(12)));
    return true;
  }

  function press(key) {
    let ok = true;

    if (/^\d$/.test(key)) {
      if (st.fresh || st.current === "0") st.current = key;
      else if (st.current.length < MAX_DIGITS) st.current += key;
      st.fresh = false;
    } else if (key === ".") {
      if (st.fresh) st.current = "0.";
      else if (!st.current.includes(".")) st.current += ".";
      st.fresh = false;
    } else if (key === "C") {
      reset();
    } else if (key === "⌫") {
      if (!st.fresh) {
        let next = st.current.slice(0, -1);
        if (next === "" || next === "-") next = "0";
        st.current = next;
      }
    } else if (key === "=") {
      if (st.op !== null) {
        ok = compute();
        st.op = null;
        st.prev = null;
        st.fresh = true;
      }
    } else if (OPS.includes(key)) {
      if (st.op !== null && !st.fresh) ok = compute();
      if (!ok) {
        show();
        return;
      }
      st.prev = parseFloat(st.current);
      st.op = key;
      st.fresh = true;
    }

    show();
    if (!ok) return; // le message d'erreur a déjà été lu

    if (key === "=") KA.speak(KEY_NAMES["="] + " " + valueWords(st.current));
    else KA.speak(KEY_NAMES[key]);
  }

  function buildKeys(root) {
    const wrap = root.querySelector("#calc-keys");
    KEYS.forEach((k) => {
      const b = document.createElement("button");
      b.className = "key";
      b.textContent = k;
      if (OPS.includes(k)) b.classList.add("op");
      if (k === "C" || k === "⌫") b.classList.add("clr");
      if (k === "=") b.classList.add("eq");
      if (k === "0") b.classList.add("zero");
      b.setAttribute("aria-label", KEY_NAMES[k]);
      b.addEventListener("click", () => press(k));
      wrap.appendChild(b);
    });
  }

  KA.panels.calc = {
    init(root) {
      displayEl = root.querySelector("#calc-display");
      buildKeys(root);
      root.querySelector("#calc-read").addEventListener("click", () => KA.speak(valueWords(st.current)));
      show();
    },
  };
})();
