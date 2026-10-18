/* Persistence: the v2 save (credits, stars, bests, armory, ships, stats, carry) as G.save,
   the high-score list and the local day key. Owns G.save; reads localStorage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;

  const STORAGE_KEY = 'sz-space-invaders-high-scores';
  const SAVE_KEY = 'sz-space-invaders-save-v2';
  const MAX_HIGH_SCORES = 10;

  function loadHighScores() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_) {
      return [];
    }
  }

  function saveHighScores(scores) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch (_) {}
  }

  function checkHighScore() {
    const scores = loadHighScores();
    scores.push({ score: G.score, level: G.level, wave: G.wave, mode: G.gameMode });
    scores.sort((a, b) => b.score - a.score);
    scores.length = Math.min(scores.length, MAX_HIGH_SCORES);
    saveHighScores(scores);
  }

  function loadSave() {
    const def = {
      v: 2,
      credits: 0,
      stars: {},
      best: { classic: 0, survival: 0, bossRush: 0, daily: { date: '', score: 0 } },
      tree: {},
      ships: ['interceptor'],
      ship: 'interceptor',
      stats: { runs: 0, kills: 0, bosses: 0 },
      carry: null,
    };
    try {
      const stored = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (stored && typeof stored === 'object') {
        Object.assign(def, stored);
        if (def.best && typeof def.best === 'object')
          def.best = Object.assign({ classic: 0, survival: 0, bossRush: 0, daily: { date: '', score: 0 } }, def.best);
        else
          def.best = { classic: 0, survival: 0, bossRush: 0, daily: { date: '', score: 0 } };
        if (!def.best.daily || typeof def.best.daily !== 'object')
          def.best.daily = { date: '', score: 0 };
        if (def.stats && typeof def.stats === 'object')
          def.stats = Object.assign({ runs: 0, kills: 0, bosses: 0 }, def.stats);
        else
          def.stats = { runs: 0, kills: 0, bosses: 0 };
        if (!def.stars || typeof def.stars !== 'object') def.stars = {};
        if (!def.tree || typeof def.tree !== 'object') def.tree = {};
        if (!Array.isArray(def.ships)) def.ships = ['interceptor'];
        if (!def.carry || typeof def.carry !== 'object' || typeof def.carry.stage !== 'string' || !(def.carry.charges >= 0)) def.carry = null;
      }
    } catch (_) {}
    return def;
  }

  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G.save));
    } catch (_) {}
  }

  G.save = loadSave();

  function todayKey() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  Object.assign(NS.save, {
    writeSave, checkHighScore, todayKey, loadHighScores, saveHighScores
  });
})();
