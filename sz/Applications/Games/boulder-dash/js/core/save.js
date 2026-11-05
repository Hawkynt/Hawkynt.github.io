/* Persistence, the only module that touches localStorage: loads the v2 save into G.save
   (migrating the first version's high-score list and tutorial flag), writes it back, and keeps
   the autosaved run snapshot that "Continue" restores. Refreshes the derived perks G.perks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const P = NS.progression;

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
    const old = stored && stored.migrated ? null : readJson(C.OLD_SCORES_KEY);
    let tut = false;
    if (!stored) {
      const ls = storage();
      try { tut = !!ls && ls.getItem(C.OLD_TUTORIAL_KEY) === '1'; } catch (_) {}
    }
    return P.migrateSave(stored, Array.isArray(old) ? old : null, tut);
  }

  function writeSave() {
    return writeJson(C.SAVE_KEY, G.save);
  }

  function refreshPerks() {
    G.perks = P.perks(G.save);
    return G.perks;
  }

  /* ── Run snapshot ── */
  function writeRun(snapshot) {
    return writeJson(C.RUN_KEY, snapshot);
  }

  function readRun() {
    const s = readJson(C.RUN_KEY);
    return s && s.v === P.SAVE_VERSION ? s : null;
  }

  function clearRun() {
    const ls = storage();
    if (!ls) return;
    try { ls.removeItem(C.RUN_KEY); } catch (_) {}
  }

  G.save = loadSave();
  refreshPerks();

  Object.assign(NS.save, { loadSave, writeSave, refreshPerks, writeRun, readRun, clearRun, readJson });
})();
