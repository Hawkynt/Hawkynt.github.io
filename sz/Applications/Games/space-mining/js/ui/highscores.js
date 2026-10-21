/* High-score persistence in localStorage, the tutorial-seen flag and the
   high-scores dialog table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const HS = NS.highscores;

  /* ── Persistence ── */
  HS.loadHighScores = function loadHighScores() {
    try {
      const raw = localStorage.getItem(C.STORAGE_HIGHSCORES);
      if (raw)
        S.highScores = JSON.parse(raw);
    } catch (_) {
      S.highScores = [];
    }
  };

  HS.saveHighScores = function saveHighScores() {
    try {
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(S.highScores));
    } catch (_) {}
  };

  HS.loadTutorialSeen = function loadTutorialSeen() {
    try {
      S.tutorialSeen = localStorage.getItem(C.STORAGE_TUTORIAL) === '1';
    } catch (_) {
      S.tutorialSeen = false;
    }
  };

  HS.saveTutorialSeen = function saveTutorialSeen() {
    try {
      localStorage.setItem(C.STORAGE_TUTORIAL, '1');
    } catch (_) {}
  };

  HS.addHighScore = function addHighScore(finalCredits, oreMined) {
    S.highScores.push({ score: finalCredits, oreMined: oreMined });
    S.highScores.sort((a, b) => b.score - a.score);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    HS.saveHighScores();
  };

  HS.renderHighScores = function renderHighScores() {
    if (!D.highScoresBody) return;
    D.highScoresBody.innerHTML = '';
    for (let i = 0; i < S.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + S.highScores[i].score + '</td><td>' + S.highScores[i].oreMined + '</td>';
      D.highScoresBody.appendChild(tr);
    }
    if (!S.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      D.highScoresBody.appendChild(tr);
    }
  };
})();
