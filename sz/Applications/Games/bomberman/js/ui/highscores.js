/* The high-score list: loading and saving it in local storage and inserting a
   finished run, keeping only the best entries. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const H = NS.highscores = NS.highscores || {};

  /* ── Persistence ── */
  H.loadData = function loadData() {
    try {
      const raw = localStorage.getItem(C.STORAGE_HIGHSCORES);
      if (raw)
        S.highScores = JSON.parse(raw);
    } catch (_) {
      S.highScores = [];
    }
  };

  H.saveData = function saveData() {
    try {
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(S.highScores));
    } catch (_) {}
  };

  H.addHighScore = function addHighScore(finalScore, finalLevel) {
    S.highScores.push({ score: finalScore, level: finalLevel });
    S.highScores.sort((a, b) => b.score - a.score);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    H.saveData();
  };
})();
