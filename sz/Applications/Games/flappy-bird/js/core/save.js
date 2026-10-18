;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Persistence: the Classic high-score table and the v2 save in localStorage.
     Owns G.highScores and G.save (load, migrate, write). */

  const { STORAGE_KEY, SAVE_KEY, MAX_HIGH_SCORES } = NS.C;
  const G = NS.state;

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        G.highScores = JSON.parse(raw);
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(s) {
    G.highScores.push(s);
    G.highScores.sort((a, b) => b - a);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function getBestScore() {
    return G.highScores.length > 0 ? G.highScores[0] : 0;
  }

  function defaultSave() {
    return {
      v: 2,
      coins: 0,
      stars: {},
      best: { classic: 0, time: 0, daily: { date: '', score: 0 } },
      stats: { runs: 0, gates: 0, coins: 0 },
      tree: {},
      birds: ['sunny'],
      bird: 'sunny'
    };
  }

  function loadSave() {
    const d = defaultSave();
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          if (typeof s.coins === 'number')
            d.coins = s.coins;
          if (s.stars && typeof s.stars === 'object')
            d.stars = s.stars;
          if (s.best && typeof s.best === 'object') {
            if (typeof s.best.classic === 'number')
              d.best.classic = s.best.classic;
            if (typeof s.best.time === 'number')
              d.best.time = s.best.time;
            if (s.best.daily && typeof s.best.daily === 'object') {
              if (typeof s.best.daily.date === 'string')
                d.best.daily.date = s.best.daily.date;
              if (typeof s.best.daily.score === 'number')
                d.best.daily.score = s.best.daily.score;
            }
          }
          if (s.stats && typeof s.stats === 'object') {
            if (typeof s.stats.runs === 'number')
              d.stats.runs = s.stats.runs;
            if (typeof s.stats.gates === 'number')
              d.stats.gates = s.stats.gates;
            if (typeof s.stats.coins === 'number')
              d.stats.coins = s.stats.coins;
          }
          if (s.tree && typeof s.tree === 'object')
            d.tree = s.tree;
          if (Array.isArray(s.birds))
            d.birds = s.birds;
          if (typeof s.bird === 'string')
            d.bird = s.bird;
        }
      }
    } catch (_) {}
    if (d.birds.indexOf('sunny') < 0)
      d.birds.push('sunny');
    G.save = d;
    // Migration: carry the best score of the old high-score table into the save
    if (G.highScores.length > 0 && G.highScores[0] > G.save.best.classic)
      G.save.best.classic = G.highScores[0];
  }

  function writeSave() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(G.save));
    } catch (_) {}
  }

  G.save = defaultSave();

  Object.assign(NS.save, {
    loadHighScores, saveHighScores, addHighScore, getBestScore, defaultSave, loadSave, writeSave
  });
})();
