/* High-score and coin persistence in localStorage and the best-distance lookup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;

  /* ── Persistence ── */
  function loadData() {
    try {
      const raw = localStorage.getItem(C.STORAGE_HIGHSCORES);
      if (raw)
        S.highScores = JSON.parse(raw);
      const c = localStorage.getItem(C.STORAGE_COINS);
      if (c)
        S.totalCoins = parseInt(c, 10) || 0;
    } catch (_) {
      S.highScores = [];
      S.totalCoins = 0;
    }
  }

  function saveData() {
    try {
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(S.highScores));
      localStorage.setItem(C.STORAGE_COINS, String(S.totalCoins));
    } catch (_) {}
  }

  function addHighScore(dist, collected) {
    S.highScores.push({ distance: dist, coins: collected });
    S.highScores.sort((a, b) => b.distance - a.distance);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    saveData();
  }

  function getBestDistance() {
    return S.highScores.length > 0 ? S.highScores[0].distance : 0;
  }

  NS.highscores.loadData = loadData;
  NS.highscores.saveData = saveData;
  NS.highscores.addHighScore = addHighScore;
  NS.highscores.getBestDistance = getBestDistance;
})();
