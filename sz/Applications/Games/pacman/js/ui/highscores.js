;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;

  NS.highscores.loadHighScores = function loadHighScores() {
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

  NS.highscores.saveHighScores = function saveHighScores() {
    try {
      localStorage.setItem(C.STORAGE_KEY, JSON.stringify(S.highScores));
    } catch (_) { /* storage full or unavailable */ }
  }

  NS.highscores.checkHighScore = function checkHighScore() {
    if (S.score <= 0)
      return;
    const entry = { score: S.score, level: S.level };
    if (S.highScores.length < C.MAX_HIGH_SCORES || S.score > S.highScores[S.highScores.length - 1].score) {
      S.highScores.push(entry);
      S.highScores.sort((a, b) => b.score - a.score);
      if (S.highScores.length > C.MAX_HIGH_SCORES)
        S.highScores.length = C.MAX_HIGH_SCORES;
      NS.highscores.saveHighScores();
    }
  }

  NS.highscores.resetHighScores = function resetHighScores() {
    S.highScores = [];
    NS.highscores.saveHighScores();
  }

  NS.highscores.showHighScores = function showHighScores() {
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
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.level + '</td>';
        body.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        NS.highscores.resetHighScores();
        NS.highscores.showHighScores();
      }
    });
  }

})();
