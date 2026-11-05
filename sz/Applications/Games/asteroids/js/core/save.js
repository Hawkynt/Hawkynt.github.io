/* Persistence, the only module that touches localStorage: loads the save into G.save (migrating
   the first version's high-score and field-size keys), writes it back, keeps the autosaved run
   snapshot under its own key, refreshes the derived stats G.stats and the calendar context G.cal
   (season, daily quests rolled over at local midnight). Owns G.save, G.stats and G.cal. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const R = NS.rules;
  const S = NS.seasons;

  const SAVE_KEY = 'sz-asteroids-save';
  const RUN_KEY = 'sz-asteroids-run';
  const OLD_SCORES_KEY = 'sz-asteroids-high-scores';
  const OLD_FIELD_KEY = 'sz-asteroids-field-size';

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function readJson(key) {
    const ls = storage();
    if (!ls) return null;
    try {
      return JSON.parse(ls.getItem(key));
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    const ls = storage();
    if (!ls) return false;
    try {
      ls.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadSave() {
    const stored = readJson(SAVE_KEY);
    const old = stored && stored.migrated ? null : readJson(OLD_SCORES_KEY);
    const s = R.migrateSave(stored, Array.isArray(old) ? old : null);
    /* the old field-size choice has no meaning in the fixed field; it is dropped once */
    const ls = storage();
    if (ls) try { ls.removeItem && ls.removeItem(OLD_FIELD_KEY); } catch (_) {}
    return s;
  }

  function writeSave() {
    writeJson(SAVE_KEY, G.save);
  }

  function refreshStats() {
    G.stats = R.computeStats(G.save);
    return G.stats;
  }

  /* the calendar context for today; rolls the daily quests over when the day changed */
  function refreshCalendar(date) {
    const d = date || new Date();
    const day = NS.rng.dayKey(d);
    const season = S.seasonOf(d);
    G.cal = {
      day: day,
      season: season,
      seasonDef: S.SEASONS[season],
      seasonKey: S.seasonKey(d),
      daily: S.dailySpec(d),
      featured: S.featured(d),
    };
    const sv = G.save;
    if (sv.daily.key !== day) {
      sv.daily = { key: day, quests: S.questsFor(day), played: false };
    }
    if (!sv.seasons[G.cal.seasonKey]) sv.seasons[G.cal.seasonKey] = { tokens: 0, claimed: 0 };
    return G.cal;
  }

  function seasonEntry() {
    return G.save.seasons[G.cal.seasonKey];
  }

  /* ── the autosaved run ── */
  function writeRun(snap) {
    return writeJson(RUN_KEY, snap);
  }

  function readRun() {
    const r = readJson(RUN_KEY);
    return r && typeof r === 'object' && r.v === R.SAVE_VERSION && r.run ? r : null;
  }

  function clearRun() {
    const ls = storage();
    if (!ls) return;
    try { ls.removeItem(RUN_KEY); } catch (_) {}
  }

  G.save = loadSave();
  refreshStats();
  refreshCalendar();

  Object.assign(NS.save, {
    SAVE_KEY, RUN_KEY, OLD_SCORES_KEY, OLD_FIELD_KEY, loadSave, writeSave, refreshStats, refreshCalendar, seasonEntry,
    writeRun, readRun, clearRun
  });
})();
