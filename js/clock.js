/* Panneau horloge : heure en chiffres, horloge à aiguilles, date, saison et météo du jour.
   Un appui sur chacun de ces éléments l'annonce à voix haute. */
(function () {
  "use strict";

  const KA = window.KA;
  const NS = "http://www.w3.org/2000/svg";
  const SEASONS = [
    { name: "Printemps", icon: "🌷", say: "Nous sommes au printemps" },
    { name: "Été", icon: "☀️", say: "Nous sommes en été" },
    { name: "Automne", icon: "🍂", say: "Nous sommes en automne" },
    { name: "Hiver", icon: "⛄", say: "Nous sommes en hiver" },
  ];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const MONTHS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const WEATHER_CACHE_MS = 60 * 60 * 1000;

  const els = {};
  const hands = {};
  let timer = null;
  let where = null; // { lat, lon }
  let currentWeather = null;

  const pad = (n) => String(n).padStart(2, "0");

  // Conversion des nombres en lettres : partagée (voir core.js)
  const frNumber = KA.frNumber;

  // « un » devient « une » pour les heures et les minutes (féminin)
  function feminine(word) {
    return word.replace(/un$/, "une");
  }

  // 10 h 15 -> « dix heures quinze » ; 0 h 00 -> « minuit » ; 12 h 00 -> « midi »
  function timeWords(h, m) {
    if (h === 0 && m === 0) return "minuit";
    if (h === 12 && m === 0) return "midi";
    let hour;
    if (h === 0) hour = "zéro heure";
    else if (h === 1) hour = "une heure";
    else hour = feminine(frNumber(h)) + " heures";
    if (!m) return hour;
    return hour + " " + (m === 1 ? "une" : feminine(frNumber(m)));
  }

  // « Nous sommes le lundi premier novembre deux mille vingt-six. »
  function dateWords(d) {
    const day = DAYS[d.getDay()];
    const dayNum = d.getDate() === 1 ? "premier" : frNumber(d.getDate());
    const year = d.getFullYear();
    let yearText = String(year);
    if (year >= 2000 && year < 2100) {
      yearText = year === 2000 ? "deux mille" : "deux mille " + frNumber(year - 2000);
    }
    return "Nous sommes le " + day + " " + dayNum + " " + MONTHS[d.getMonth()] + " " + yearText + ".";
  }

  // Écrit comme l'annonce : « mardi 3 novembre 2026 » (« 1er » pour le premier)
  function writtenDate(d) {
    const dayNum = d.getDate() === 1 ? "1er" : String(d.getDate());
    return DAYS[d.getDay()] + " " + dayNum + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  // ---------- Dessin de l'horloge à aiguilles ----------
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (parent) parent.appendChild(el);
    return el;
  }

  function polar(r, minute) {
    const a = (minute * 6 * Math.PI) / 180;
    return { x: 100 + r * Math.sin(a), y: 100 - r * Math.cos(a) };
  }

  function buildFace(svg) {
    svgEl("circle", { cx: 100, cy: 100, r: 96, fill: "#ffffff", stroke: "#ff7043", "stroke-width": 6 }, svg);

    // Traits : un par minute, plus gros toutes les 5 minutes
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      const p1 = polar(big ? 84 : 88, i);
      const p2 = polar(92, i);
      svgEl(
        "line",
        {
          x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
          stroke: big ? "#333" : "#bbb",
          "stroke-width": big ? 4 : 1.5,
          "stroke-linecap": "round",
        },
        svg
      );
    }

    // Chiffres des heures (1 à 12), petits et rapprochés du centre pour ne pas toucher les minutes
    for (let n = 1; n <= 12; n++) {
      // Rayon 49,5 : environ 4 px plus près du centre qu'avant (52) sur le grand cadran
      const p = polar(49.5, n * 5);
      const t = svgEl(
        "text",
        {
          x: p.x,
          y: p.y + 4,
          "text-anchor": "middle",
          "font-size": 11,
          "font-weight": "bold",
          fill: "#333",
        },
        svg
      );
      t.textContent = n;
    }

    // Chiffres des minutes toutes les 5 minutes, sur le bord extérieur.
    // Les quarts (15, 30, 45, 60) sont plus gros et en orange ; les autres sont petits.
    for (let minute = 5; minute <= 60; minute += 5) {
      const quarter = minute % 15 === 0;
      // Les quarts sont rentrés vers le centre (rayon 66, puis 68,5 : 4 px de plus vers le centre)
      const p = polar(quarter ? 68.5 : 74, minute);
      const t = svgEl(
        "text",
        {
          x: p.x,
          y: p.y + (quarter ? 4 : 3.5),
          "text-anchor": "middle",
          // Les minutes simples sont 15 % plus petites (6,5 -> 5,5)
          "font-size": quarter ? 11 : 5.5,
          "font-weight": quarter ? "bold" : "normal",
          fill: quarter ? "#e65100" : "#777",
        },
        svg
      );
      t.textContent = minute;
    }

    // Aiguilles des heures et des minutes : pointues au bout, plus larges au centre
    const hand = (parent, tipY, halfWidth, tailY) =>
      svgEl(
        "polygon",
        { points: `100,${tipY} ${100 + halfWidth},100 100,${tailY} ${100 - halfWidth},100`, fill: "#333" },
        parent
      );
    hands.hour = svgEl("g", {}, svg);
    // La queue reste sous le rond central (rayon 7) : rien ne dépasse de l'autre côté
    hand(hands.hour, 58, 6, 104);
    hands.min = svgEl("g", {}, svg);
    hand(hands.min, 34, 4.5, 104);
    hands.sec = svgEl("g", {}, svg);
    svgEl("line", { x1: 100, y1: 122, x2: 100, y2: 28, stroke: "#e53935", "stroke-width": 3, "stroke-linecap": "round" }, hands.sec);
    svgEl("circle", { cx: 100, cy: 100, r: 7, fill: "#ff7043" }, svg);
  }

  // ---------- Saison ----------
  // Hémisphère nord : printemps à partir du 20 mars, etc. (approximation suffisante pour un enfant)
  function seasonIndex(date, lat) {
    const md = (date.getMonth() + 1) * 100 + date.getDate();
    let s;
    if (md >= 321 && md < 621) s = 0;
    else if (md >= 621 && md < 923) s = 1;
    else if (md >= 923 && md < 1221) s = 2;
    else s = 3;
    return lat < 0 ? (s + 2) % 4 : s;
  }

  function currentSeason(date) {
    return SEASONS[seasonIndex(date, where ? where.lat : KA.config.fallbackLocation.lat)];
  }

  // ---------- Météo ----------
  function weatherInfo(code) {
    if (code === 0) return ["☀️", "Soleil"];
    if (code <= 2) return ["🌤️", "Un peu de soleil"];
    if (code === 3) return ["☁️", "Nuageux"];
    if (code === 45 || code === 48) return ["🌫️", "Brouillard"];
    if (code >= 51 && code <= 57) return ["🌦️", "Bruine"];
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ["🌧️", "Pluie"];
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return ["❄️", "Neige"];
    if (code >= 95) return ["⛈️", "Orage"];
    return ["🌡️", "Temps variable"];
  }

  function getLocation() {
    const fallback = KA.config.fallbackLocation;
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(fallback);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(fallback),
        { timeout: 8000, maximumAge: WEATHER_CACHE_MS }
      );
    });
  }

  function showWeather(w) {
    currentWeather = w;
    const [icon, text] = weatherInfo(w.code);
    els.weatherIco.textContent = icon;
    els.weatherTemp.textContent = "🔺" + Math.round(w.max) + "° 🔻" + Math.round(w.min) + "°";
    els.weatherText.textContent = text;
  }

  // Open-Meteo : sans clé d'API, accessible depuis le navigateur
  async function refreshWeather() {
    try {
      if (!where) where = await getLocation();
      const key = where.lat.toFixed(2) + "," + where.lon.toFixed(2);
      const cached = KA.ls.get("mcm.weather", null);
      let w;
      if (cached && cached.key === key && Date.now() - cached.at < WEATHER_CACHE_MS) {
        w = cached;
      } else {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=" + where.lat.toFixed(3) +
          "&longitude=" + where.lon.toFixed(3) +
          "&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1";
        const res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        w = {
          key,
          at: Date.now(),
          code: data.daily.weather_code[0],
          max: data.daily.temperature_2m_max[0],
          min: data.daily.temperature_2m_min[0],
        };
        KA.ls.set("mcm.weather", w);
      }
      showWeather(w);
    } catch (err) {
      currentWeather = null;
      els.weatherIco.textContent = "❔";
      els.weatherTemp.textContent = "--°";
      els.weatherText.textContent = "Météo indisponible";
    }
  }

  // ---------- Annonces vocales ----------
  function sayDigital() {
    const now = new Date();
    KA.speak(timeWords(now.getHours(), now.getMinutes()));
  }

  function sayAnalog() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const minuteMark = m || 60; // position exacte de la grande aiguille ; 60 = en haut
    const hourMark = h % 12 || 12;
    KA.speak(
      "La petite aiguille indique " + frNumber(hourMark) +
      ", la grande aiguille est sur le " + frNumber(minuteMark) +
      ", il est donc " + timeWords(h, m) + "."
    );
  }

  function sayDate() {
    KA.speak(dateWords(new Date()));
  }

  function saySeason() {
    KA.speak(currentSeason(new Date()).say + ".");
  }

  function sayWeather() {
    if (!currentWeather) {
      KA.speak("Je n'ai pas encore la météo");
      return;
    }
    const w = currentWeather;
    const [, text] = weatherInfo(w.code);
    const min = Math.round(w.min);
    const max = Math.round(w.max);
    const unit = Math.abs(min) <= 1 && Math.abs(max) <= 1 ? "degré" : "degrés";
    KA.speak(
      "Aujourd'hui, " + text.toLowerCase() + ". Il fait entre " +
      frNumber(min) + " et " + frNumber(max) + " " + unit + "."
    );
  }

  // ---------- Mise à jour de l'affichage ----------
  function tick() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const sec = s + now.getMilliseconds() / 1000;

    els.hm.textContent = pad(h) + ":" + pad(m);
    els.s.textContent = ":" + pad(s);
    els.dateText.textContent = writtenDate(now);

    hands.hour.setAttribute("transform", "rotate(" + ((h % 12) + m / 60) * 30 + " 100 100)");
    hands.min.setAttribute("transform", "rotate(" + (m + sec / 60) * 6 + " 100 100)");
    hands.sec.setAttribute("transform", "rotate(" + sec * 6 + " 100 100)");

    const season = currentSeason(now);
    els.seasonIco.textContent = season.icon;
    els.seasonName.textContent = season.name;
  }

  KA.panels.clock = {
    init(root) {
      els.hm = root.querySelector("#clock-hm");
      els.s = root.querySelector("#clock-s");
      els.dateText = root.querySelector("#date-text");
      els.seasonIco = root.querySelector("#season-ico");
      els.seasonName = root.querySelector("#season-name");
      els.weatherIco = root.querySelector("#weather-ico");
      els.weatherTemp = root.querySelector("#weather-temp");
      els.weatherText = root.querySelector("#weather-text");
      buildFace(root.querySelector("#analog"));

      root.querySelector(".digital").addEventListener("click", sayDigital);
      root.querySelector("#analog").addEventListener("click", sayAnalog);
      root.querySelector(".date-row").addEventListener("click", sayDate);
      els.seasonName.closest(".info").addEventListener("click", saySeason);
      els.weatherTemp.closest(".info").addEventListener("click", sayWeather);
    },
    enter() {
      tick();
      refreshWeather();
      clearInterval(timer);
      timer = setInterval(tick, 250);
    },
    leave() {
      clearInterval(timer);
      timer = null;
    },
  };
})();
