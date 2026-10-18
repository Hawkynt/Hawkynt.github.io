/* Persistence: loads the v2 save into G.save (migrating the first version's high-score list),
   writes it back, and refreshes the derived ship stats G.stats. Owns G.save and G.stats;
   the only module that touches localStorage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { migrateSave, computeStats } = NS.rules;

  const SAVE_KEY = 'sz-space-combat-save-v2';
  const OLD_SCORES_KEY = 'sz-space-combat-highscores';

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

  function loadSave() {
    const stored = readJson(SAVE_KEY);
    const old = stored && stored.migrated ? null : readJson(OLD_SCORES_KEY);
    return migrateSave(stored, Array.isArray(old) ? old : null);
  }

  function writeSave() {
    const ls = storage();
    if (!ls) return;
    try {
      ls.setItem(SAVE_KEY, JSON.stringify(G.save));
    } catch (_) {}
  }

  function refreshStats() {
    G.stats = computeStats(G.save, G.save.ship);
    return G.stats;
  }

  G.save = loadSave();
  refreshStats();

  Object.assign(NS.save, {
    SAVE_KEY, OLD_SCORES_KEY, loadSave, writeSave, refreshStats
  });
})();
