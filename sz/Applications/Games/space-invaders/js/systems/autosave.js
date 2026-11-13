/* Autosave at every wave: when a wave of Classic, Survival, Boss Rush or Zen begins, the run so far
   (mode, score, lives, level, wave, special charge) is stored; Continue on the title starts that
   wave again with all of it. A finished run clears it. Campaign stages are short and restart from
   the map; the Daily is seeded and is not resumed. Owns localStorage sz-space-invaders-run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const KEY = 'sz-space-invaders-run';
  const MODES_SAVED = { classic: 1, survival: 1, bossRush: 1, zen: 1 };

  function snapshot() {
    if (!MODES_SAVED[G.gameMode] || G.lives <= 0) return null;
    return { v: 1, mode: G.gameMode, score: G.score, lives: G.lives, level: G.level, wave: G.wave,
      special: G.special || 0, specialCharges: G.specialCharges || 0, at: Date.now() };
  }

  function save() {
    const s = snapshot();
    if (!s) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }

  /* a stored run, checked field by field, or null */
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { s = null; }
    const ok = n => Number.isFinite(n) && n >= 0;
    if (!s || s.v !== 1 || !MODES_SAVED[s.mode] || !ok(s.score) || !(s.lives >= 1) || !(s.level >= 1) || !(s.wave >= 1)) return null;
    return s;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }

  /* start the stored wave again with the stored score and lives */
  function resume() {
    const s = load();
    if (!s) return false;
    NS.waves.newGame(s.mode, true);
    G.score = Math.floor(s.score);
    G.lives = Math.floor(s.lives);
    G.special = s.special || 0;
    G.specialCharges = Math.floor(s.specialCharges || 0);
    if (s.mode === 'survival') {
      G.wave = Math.floor(s.wave) - 1;
      NS.waves.startSurvivalNextWave();
    } else {
      G.level = Math.floor(s.level) - 1;
      G.wave = Math.floor(s.wave) - 1;
      NS.waves.startNextLevel();
    }
    return true;
  }

  Object.assign(NS, { autosave: { snapshot, save, load, clear, resume } });
})();
