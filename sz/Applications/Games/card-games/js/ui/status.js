/* Status bar text and high-score persistence. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state;
  const ST = NS.status = NS.status || {};

  /* ══════════════════════════════════════════════════════════════════
     STATUS & PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  ST.updateStatus = function() {
    const variantEl = document.getElementById('statusVariant');
    const scoreEl = document.getElementById('statusScore');
    const roundEl = document.getElementById('statusRound');
    if (variantEl) variantEl.textContent = 'Game: ' + (S.currentVariant?.name || '--');
    if (scoreEl) scoreEl.textContent = 'Score: ' + S.score;
    if (roundEl) roundEl.textContent = 'Round: ' + (S.roundNumber || '--');
  };

  ST.loadHighScores = function() {
    try {
      const raw = localStorage.getItem(K.STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  ST.saveHighScores = function() {
    try {
      const scores = ST.loadHighScores();
      scores.push({
        variant: S.currentVariant?.name || 'Unknown',
        score: S.score,
        date: Date.now()
      });
      scores.sort((a, b) => b.score - a.score);
      while (scores.length > K.MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(K.STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  };

  ST.showHighScores = function() {
    const scores = ST.loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        '<tr><td>' + (i + 1) + '</td><td>' + s.variant + '</td><td>' + s.score + '</td></tr>'
      ).join('');
    }
  };
})();
