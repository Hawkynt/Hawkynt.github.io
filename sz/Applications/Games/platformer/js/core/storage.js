/*
 * Persistence: the v2 save and the high-score list in localStorage, and the High Scores dialog table.
 * Owns G.save and G.highScores.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { STORAGE_SAVE, STORAGE_HIGHSCORES, MAX_HIGH_SCORES } = NS.config;
  const Prog = SZ.PlatformerProgress;

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      G.save = Prog.migrate(raw ? JSON.parse(raw) : null);
    } catch (_) {
      G.save = Prog.defaultSave();
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(G.save));
    } catch (_) {
      /* storage full or blocked: drop the ghosts and try once more */
      try {
        for (const id of Object.keys(G.save.levels))
          G.save.levels[id].ghost = '';
        localStorage.setItem(STORAGE_SAVE, JSON.stringify(G.save));
      } catch (_) {}
    }
  }

  function loadHighScores() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_HIGHSCORES) || '[]');
      G.highScores = Array.isArray(raw) ? raw.filter(h => h && typeof h.score === 'number' && h.mode) : [];
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(score, mode, detail) {
    G.highScores.push({ score: Math.round(score), mode: mode, detail: detail, date: Date.now() });
    G.highScores.sort((a, b) => b.score - a.score);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body)
      return;
    body.innerHTML = '';
    if (!G.highScores.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No runs yet - try Endless or the Daily Run.';
      tr.appendChild(td);
      body.appendChild(tr);
      return;
    }
    G.highScores.forEach((h, i) => {
      const tr = document.createElement('tr');
      for (const v of [i + 1, h.score.toLocaleString(), h.mode + (h.detail ? ' - ' + h.detail : '')]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  }

  Object.assign(NS.module('storage'), {
    loadSave,
    writeSave,
    loadHighScores,
    saveHighScores,
    addHighScore,
    renderHighScores
  });
})();
