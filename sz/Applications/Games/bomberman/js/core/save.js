/* Persistence, the only module that touches localStorage: loads the v2 save into G.save
   (migrating the first version's high scores and tutorial flag), writes it back, refreshes the
   derived perks, opens a play session for a date (season, streak, quests, weekly challenge,
   event track) and keeps the autosaved run snapshot used by Continue. Owns G.save, G.perks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const rules = NS.rules;
  const R = NS.rng;

  const RUN_VERSION = 1;

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

  function readRaw(key) {
    const ls = storage();
    if (!ls) return null;
    try {
      return ls.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeRaw(key, value) {
    const ls = storage();
    if (!ls) return false;
    try {
      if (value === null) ls.removeItem(key);
      else ls.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadSave() {
    const stored = readJson(C.SAVE_KEY);
    const old = stored && stored.migrated ? null : readJson(C.OLD_SCORES_KEY);
    const tut = readRaw(C.OLD_TUTORIAL_KEY) === '1';
    return rules.migrateSave(stored, Array.isArray(old) ? old : null, tut);
  }

  function writeSave() {
    if (G.save) writeRaw(C.SAVE_KEY, JSON.stringify(G.save));
  }

  function refreshPerks() {
    G.perks = rules.computePerks(G.save);
    return G.perks;
  }

  /* Opens the play session for a date: season, daily, weekly, streak bonus, quests, event track */
  function startSession(date) {
    const d = date || new Date();
    const save = G.save;
    G.season = NS.season.current(d);
    G.daily = NS.season.daily(d);
    G.weekly = NS.season.weekly(d);
    rules.syncEvent(save, G.season.key);
    rules.syncWeekly(save, G.weekly);
    rules.rollQuests(save, R.dayKey(d));
    if (save.daily.key !== G.daily.key) save.daily = { key: G.daily.key, best: 0, done: false };
    const bonus = rules.touchStreak(save, R.dayNumber(d));
    if (bonus) save.gems += bonus;
    writeSave();
    return { streakBonus: bonus, streak: save.streak.count };
  }

  /* ── the autosaved run ── */
  function validRun(r) {
    return !!(r && r.v === RUN_VERSION && r.level && Array.isArray(r.level.grid) && r.level.grid.length === C.COLS * C.ROWS &&
      r.player && Array.isArray(r.enemies) && Array.isArray(r.bombs) && typeof r.mode === 'string');
  }

  function saveRun() {
    const r = G.run;
    if (!r || r.over) return false;
    r.v = RUN_VERSION;
    r.savedAt = Date.now();
    return writeRaw(C.RUN_KEY, JSON.stringify(r));
  }

  function loadRun() {
    const r = readJson(C.RUN_KEY);
    return validRun(r) ? r : null;
  }

  function clearRun() {
    writeRaw(C.RUN_KEY, null);
    G.hasContinue = false;
    G.continueInfo = null;
  }

  /* Checks the stored run so the title can offer Continue */
  function probeContinue() {
    const r = loadRun();
    G.hasContinue = !!r;
    G.continueInfo = r ? { mode: r.mode, world: r.world, level: r.levelIndex, stage: r.stage, score: r.score, name: r.level.name } : null;
    return r;
  }

  G.save = loadSave();
  refreshPerks();

  Object.assign(NS.save, {
    RUN_VERSION, loadSave, writeSave, refreshPerks, startSession, validRun, saveRun, loadRun, clearRun, probeContinue
  });
})();
