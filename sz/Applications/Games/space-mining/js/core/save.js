/* Persistence: loads the v2 save into G.save (migrating the first version's high-score list and
   tutorial flag), writes it back, and refreshes the derived ship stats G.stats. Owns G.save and
   G.stats; the only module that touches localStorage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { migrateSave, computeStats } = NS.rules;
  const eco = NS.economy;

  const SAVE_KEY = 'sz-space-mining-save-v2';
  const OLD_SCORES_KEY = 'sz-space-mining-highscores';
  const OLD_TUTORIAL_KEY = 'sz-space-mining-tutorial-seen';

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  function read(key) {
    const ls = storage();
    if (!ls) return null;
    try {
      return ls.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function readJson(key) {
    try {
      return JSON.parse(read(key));
    } catch (_) {
      return null;
    }
  }

  function loadSave() {
    const stored = readJson(SAVE_KEY);
    const old = stored && stored.migrated ? null : readJson(OLD_SCORES_KEY);
    const save = migrateSave(stored, Array.isArray(old) ? old : null);
    if (!stored && read(OLD_TUTORIAL_KEY) === '1') save.seenHelp = true;
    eco.initMarket(save);
    if (!save.contracts.length) eco.refillContracts(save, computeStats(save), NS.rng.makeRng(save.cycle * 7919 + 13));
    return save;
  }

  function writeSave() {
    const ls = storage();
    if (!ls) return;
    try {
      ls.setItem(SAVE_KEY, JSON.stringify(G.save));
    } catch (_) {}
  }

  function refreshStats() {
    G.stats = computeStats(G.save, G.save.hull);
    return G.stats;
  }

  G.save = loadSave();
  refreshStats();

  Object.assign(NS.save, {
    SAVE_KEY, OLD_SCORES_KEY, OLD_TUTORIAL_KEY, loadSave, writeSave, refreshStats
  });
})();
