/* The high-score table: persistence in localStorage, recording a run, resetting and
   the dialog that shows the list. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;

  /* ---- High Scores ---- */
  function loadHighScores() {
    try {
      const raw = localStorage.getItem(C.STORAGE_KEY);
      if (raw)
        S.highScores = JSON.parse(raw);
      if (!Array.isArray(S.highScores))
        S.highScores = [];
    } catch (_) {
      S.highScores = [];
    }
  }

  function saveHighScores() {
    try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(S.highScores)); } catch (_) {}
  }

  function checkHighScore() {
    if (S.score <= 0)
      return;
    const entry = { score: S.score, length: S.snake.length };
    if (S.highScores.length < C.MAX_HIGH_SCORES || S.score > S.highScores[S.highScores.length - 1].score) {
      S.highScores.push(entry);
      S.highScores.sort((a, b) => b.score - a.score);
      if (S.highScores.length > C.MAX_HIGH_SCORES)
        S.highScores.length = C.MAX_HIGH_SCORES;
      saveHighScores();
    }
  }

  function resetHighScores() {
    S.highScores = [];
    saveHighScores();
  }

  function showHighScores() {
    const body = document.getElementById('highScoresBody');
    body.innerHTML = '';
    if (S.highScores.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.textContent = 'No scores yet.';
      td.style.textAlign = 'center';
      td.style.padding = '8px';
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      for (let i = 0; i < S.highScores.length; ++i) {
        const e = S.highScores[i];
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.length + '</td>';
        body.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        resetHighScores();
        showHighScores();
      }
    });
  }

  Object.assign(NS.highscores, { loadHighScores, saveHighScores, checkHighScore, resetHighScores, showHighScores });
})();
