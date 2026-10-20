/* High scores: localStorage persistence, the top-five table, the reset button on
   the score dialog and the record that a finished run leaves behind. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(C.STORAGE_HIGHSCORES);
      S.highScores = raw ? JSON.parse(raw) : [];
    } catch (e) {
      S.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(S.highScores));
    } catch (e) {
      // storage unavailable
    }
  }

  function addHighScore(s) {
    S.highScores.push({ score: s, level: S.currentLevel + 1, date: Date.now() });
    S.highScores.sort((a, b) => b.score - a.score);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body) return;
    body.innerHTML = '';
    for (let i = 0; i < C.MAX_HIGH_SCORES; ++i) {
      const hs = S.highScores[i];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${hs ? hs.score : '---'}</td><td>${hs ? hs.level : '-'}</td>`;
      body.appendChild(tr);
    }
  }

  const highScoresDialog = document.getElementById('highScoresBackdrop');
  if (highScoresDialog) {
    highScoresDialog.addEventListener('dialog:result', (e) => {
      if (e.detail === 'reset') {
        S.highScores = [];
        saveHighScores();
        renderHighScores();
      }
    });
  }

  Object.assign(NS.highscores, { loadHighScores, saveHighScores, addHighScore, renderHighScores });
})();
