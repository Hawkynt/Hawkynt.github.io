/* Persistence, the only module that touches localStorage: loads the v2 profile into G.save
   (migrating the old game's high-score list, coin total and tutorial flag on first run, which
   stay in place untouched), writes it back, keeps the autosaved run snapshot (written while
   playing, on pause and when the page hides, read back as Continue, cleared when the run ends)
   and refreshes the derived stats G.stats. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
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

  function readRaw(key) {
    const ls = storage();
    if (!ls) return null;
    try {
      return ls.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function readJson(key) {
    const raw = readRaw(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
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
    if (stored && stored.v) return migrateSave(stored, null, null, null);
    return migrateSave(null, readJson(C.OLD_SCORES_KEY), readRaw(C.OLD_COINS_KEY), readRaw(C.OLD_TUTORIAL_KEY));
  }

  function writeSave() {
    if (G.save) writeJson(C.SAVE_KEY, G.save);
  }

  function refreshStats() {
    G.stats = computeStats(G.save);
    return G.stats;
  }

  /* ── the run snapshot ── */
  let peek;

  function writeRun() {
    peek = undefined;
    const run = G.run;
    if (!run || run.demo || run.phase === 'over' || run.phase === 'done') return false;
    run.savedAt = Date.now();
    run.feel = [G.hitstop, G.slowmo];
    return writeJson(C.RUN_KEY, run);
  }

  function readRun() {
    const r = readJson(C.RUN_KEY);
    if (!r || !r.course || !r.p || !r.mode || !Array.isArray(r.course.ground)) return null;
    return r;
  }

  /* what Continue would bring back ({ mode, m }) without parsing the snapshot every frame */
  function peekRun() {
    if (peek === undefined) {
      const r = readRun();
      peek = r ? { mode: r.mode, m: Math.max(0, Math.floor((r.p.x - (r.x0 || 0)) / C.PX_PER_M)) } : null;
    }
    return peek;
  }

  function clearRun() {
    peek = undefined;
    const ls = storage();
    if (!ls) return;
    try { ls.removeItem(C.RUN_KEY); } catch (_) {}
  }

  G.save = loadSave();
  refreshStats();
  writeSave();

  Object.assign(NS.save, {
    loadSave, writeSave, refreshStats, writeRun, readRun, peekRun, clearRun
  });
})();
