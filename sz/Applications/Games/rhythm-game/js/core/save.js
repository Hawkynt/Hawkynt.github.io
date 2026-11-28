/* Persistence, the only module touching localStorage: the profile (versioned, defaults filled in
   for missing fields, the old game's high scores migrated once) and the snapshot of a song in
   progress (its recipe and engine state, the chart is rebuilt from the recipe), written every few
   seconds, on pause and when the page hides, so Continue rejoins the song at the bar it reached. A
   broken or missing store never stops the game. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const P = NS.progress;

  function store() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function fill(obj, defaults) {
    if (!obj || typeof obj !== 'object') return JSON.parse(JSON.stringify(defaults));
    for (const k in defaults) {
      const d = defaults[k];
      if (!(k in obj) || (obj[k] === null && d !== null)) obj[k] = d && typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : d;
      else if (d && typeof d === 'object' && !Array.isArray(d) && obj[k] && typeof obj[k] === 'object') fill(obj[k], d);
    }
    return obj;
  }

  function get(key) {
    const s = store();
    if (!s) return null;
    try { return s.getItem(key); } catch (_) { return null; }
  }

  function put(key, value) {
    const s = store();
    if (!s) return false;
    try {
      if (value == null) s.removeItem(key);
      else s.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  /* -> { profile, migrated } */
  function loadProfile() {
    const raw = get(C.PROFILE_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') return { profile: fill(p, P.newProfile()), migrated: 0 };
      } catch (_) {}
    }
    const p = P.newProfile();
    const old = get(C.LEGACY_SCORES_KEY);
    const n = old ? P.migrateLegacy(p, old) : 0;
    return { profile: p, migrated: n };
  }

  function saveProfile(p) {
    return put(C.PROFILE_KEY, JSON.stringify(p));
  }

  /* run: { recipe, eng, t } - the chart and the conductor are not saved */
  function saveRun(run) {
    if (!run || run.done || !run.eng || run.eng.done || run.mode === 'demo') return put(C.RUN_KEY, null);
    return put(C.RUN_KEY, JSON.stringify({ v: C.SAVE_VERSION, at: Date.now(), run: { recipe: run.recipe, eng: run.eng, t: run.eng.t, title: run.title } }));
  }

  function loadRun() {
    const raw = get(C.RUN_KEY);
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      if (d && d.run && d.run.recipe && d.run.eng && Array.isArray(d.run.eng.res)) return d.run;
    } catch (_) {}
    return null;
  }

  function clearRun() {
    return put(C.RUN_KEY, null);
  }

  function wipe() {
    put(C.PROFILE_KEY, null);
    put(C.RUN_KEY, null);
  }

  Object.assign(NS.save, { fill, loadProfile, saveProfile, saveRun, loadRun, clearRun, wipe });
})();
