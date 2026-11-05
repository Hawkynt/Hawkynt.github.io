/* Persistence, the only module that touches localStorage: loads the v2 profile into G.save
   (migrating the old game's high-score list and options on first run), writes it back, keeps the
   autosaved run snapshot (written while playing, on pause and when the page hides, read back as
   Continue, cleared when the run ends), and refreshes the tech tree stats G.stats. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const C = NS.constants;
  const { migrateSave, computeStats } = NS.rules;

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
      const raw = ls.getItem(key);
      return raw ? JSON.parse(raw) : null;
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
    const stored = readJson(C.SAVE_KEY);
    if (stored && stored.v) return migrateSave(stored, null, null);
    return migrateSave(null, readJson(C.OLD_SCORES_KEY), readJson(C.OLD_CONFIG_KEY));
  }

  function writeSave() {
    if (G.save) writeJson(C.SAVE_KEY, G.save);
  }

  function refreshStats() {
    G.stats = computeStats(G.save);
    return G.stats;
  }

  /* ── the run snapshot ── */
  function writeRun() {
    const run = G.run;
    if (!run || run.mode === 'demo' || run.phase === 'over') return false;
    if (G.rng) run.rngS = G.rng.s;
    /* hit-stop and slow motion change how the next steps run, so they travel with the run */
    run.feel = [G.hitstop, G.slowmo];
    run.savedAt = Date.now();
    return writeJson(C.RUN_KEY, run);
  }

  function readRun() {
    const r = readJson(C.RUN_KEY);
    if (!r || !r.level || !r.snake || !Array.isArray(r.snake.body) || !r.snake.body.length) return null;
    return r;
  }

  function clearRun() {
    const ls = storage();
    if (!ls) return;
    try { ls.removeItem(C.RUN_KEY); } catch (_) {}
  }

  G.save = loadSave();
  refreshStats();
  writeSave();

  Object.assign(NS.save, {
    loadSave, writeSave, refreshStats, writeRun, readRun, clearRun
  });
})();
