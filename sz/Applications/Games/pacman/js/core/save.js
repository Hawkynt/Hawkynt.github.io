/* Persistence, localStorage only: the profile (migrating the first version's high-score list
   once), the autosaved run that Continue restores exactly, the day roll-over for quests,
   streak and seasonal track, and refreshing the derived stats. The only module that touches
   storage. Owns G.profile, G.stats, G.season and G.savedRun. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const R = NS.rules;
  const SE = NS.seasons;

  const PROFILE_KEY = 'sz-pacman-profile-v2';
  const RUN_KEY = 'sz-pacman-run-v1';
  const OLD_SCORES_KEY = 'sz-pacman-high-scores';
  const RUN_VERSION = 1;

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

  function write(key, value) {
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

  function loadProfile() {
    const stored = readJson(PROFILE_KEY);
    const old = stored && stored.migrated ? null : readJson(OLD_SCORES_KEY);
    return R.migrateProfile(stored, Array.isArray(old) ? old : null);
  }

  function writeProfile() {
    if (G.profile) write(PROFILE_KEY, JSON.stringify(G.profile));
  }

  function refreshStats() {
    G.stats = R.computeStats(G.profile);
    return G.stats;
  }

  /* ── the run ── */
  function saveRun() {
    const run = G.run;
    if (!run || run.demo || run.over) return false;
    run.savedAt = Date.now();
    run.v = RUN_VERSION;
    const ok = write(RUN_KEY, JSON.stringify(run));
    if (ok) G.savedRun = summary(run);
    return ok;
  }

  function clearRun() {
    write(RUN_KEY, null);
    G.savedRun = null;
  }

  /* the stored run, or null when missing, broken or from another version */
  function loadRun() {
    const r = readJson(RUN_KEY);
    if (!r || r.v !== RUN_VERSION || !r.lvl || !r.lvl.maze || !Array.isArray(r.lvl.maze.walls) || typeof r.score !== 'number') return null;
    return r;
  }

  function summary(run) {
    return { mode: run.mode, score: run.score, lives: run.lives, world: run.world, stage: run.stage, n: run.n, savedAt: run.savedAt };
  }

  /* day roll-over: quests, streak and the seasonal track; returns notes for toasts */
  function rollDay(date) {
    const p = G.profile;
    const notes = [];
    R.refreshQuests(p, NS.rng.dayKey(date));
    if (SE.syncSeason(p, date)) notes.push({ kind: 'season' });
    G.season = SE.seasonFor(date);
    return notes;
  }

  function boot(date) {
    G.date = date || G.date || new Date();
    G.profile = loadProfile();
    rollDay(G.date);
    R.syncUnlocks(G.profile);
    refreshStats();
    const r = loadRun();
    G.savedRun = r ? summary(r) : null;
    writeProfile();
  }

  boot();

  Object.assign(NS.save, {
    PROFILE_KEY, RUN_KEY, OLD_SCORES_KEY, RUN_VERSION, loadProfile, writeProfile, refreshStats, saveRun, clearRun, loadRun, rollDay, boot
  });
})();
