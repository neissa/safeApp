/* Compteur de lancements : chaque ouverture d'une tuile est comptée.
   Les totaux sont gardés depuis toujours, par jour (60 derniers jours) ; le menu parent les affiche. */
(function () {
  "use strict";

  const KA = window.KA;
  const KEY = "mcm.stats";
  const KEEP_DAYS = 60;

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // Date locale au format AAAA-MM-JJ
  function dayKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function load() {
    const s = KA.ls.get(KEY, null);
    return s && s.total && s.days ? s : { total: {}, days: {} };
  }

  function save(s) {
    KA.ls.set(KEY, s);
  }

  KA.stats = {
    count(name) {
      const s = load();
      const today = dayKey(new Date());
      s.total[name] = (s.total[name] || 0) + 1;
      s.days[today] = s.days[today] || {};
      s.days[today][name] = (s.days[today][name] || 0) + 1;
      // On ne garde que les derniers jours
      const cut = new Date();
      cut.setDate(cut.getDate() - KEEP_DAYS);
      const limit = dayKey(cut);
      Object.keys(s.days).forEach((k) => {
        if (k < limit) delete s.days[k];
      });
      save(s);
    },
    total() {
      return load().total;
    },
    today() {
      return load().days[dayKey(new Date())] || {};
    },
    week() {
      const s = load();
      const out = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const day = s.days[dayKey(d)] || {};
        Object.keys(day).forEach((n) => (out[n] = (out[n] || 0) + day[n]));
      }
      return out;
    },
    reset() {
      save({ total: {}, days: {} });
    },
  };
})();
