/* High score persistence: loading and saving the table, adding a run, rendering
   the dialog rows and the dialog's reset button wiring. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── High score persistence ── */
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

  function addHighScore(s, lvl) {
    S.highScores.push({ score: s, level: lvl, date: Date.now() });
    S.highScores.sort((a, b) => b.score - a.score);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    saveHighScores();
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

  Object.assign(NS.highscores, { loadHighScores, saveHighScores, addHighScore, renderHighScores });
})();
