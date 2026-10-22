/* High-score persistence: loading and saving the table and recording a won
   game ranked by remaining HP. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const S = NS.state;

  function loadHighScores() {
    try {
      const data = localStorage.getItem(C.STORAGE_HIGHSCORES);
      if (data)
        S.highScores = JSON.parse(data);
    } catch { /* ignore */ }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(S.highScores));
    } catch { /* ignore */ }
  }

  function saveHighScore() {
    const entry = {
      difficulty: S.difficulty,
      turns: S.turnNumber,
      hpRemaining: S.playerHP,
      date: Date.now()
    };
    S.highScores.push(entry);
    S.highScores.sort((a, b) => b.hpRemaining - a.hpRemaining);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    saveHighScores();
  }

  Object.assign(NS.storage, { loadHighScores, saveHighScores, saveHighScore });
})();
