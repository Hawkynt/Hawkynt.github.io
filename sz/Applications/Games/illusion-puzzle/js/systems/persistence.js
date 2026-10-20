/* The localStorage persistence: level progress and the top-ten high scores. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const S = NS.state;

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadProgress() {
    try {
      const raw = localStorage.getItem(C.STORAGE_PROGRESS);
      if (raw) {
        const data = JSON.parse(raw);
        S.levelProgress = data.levels || {};
        S.currentLevel = data.currentLevel || 0;
      }
    } catch (_) {
      S.levelProgress = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(C.STORAGE_PROGRESS, JSON.stringify({
        levels: S.levelProgress,
        currentLevel: S.currentLevel
      }));
    } catch (_) {}
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(C.STORAGE_HIGHSCORES);
      if (raw) S.highScores = JSON.parse(raw);
    } catch (_) {
      S.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(S.highScores));
    } catch (_) {}
  }

  function addHighScore(level, moveCount) {
    S.highScores.push({ level: level + 1, moves: moveCount });
    S.highScores.sort((a, b) => a.moves - b.moves || a.level - b.level);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    saveHighScores();
  }

  Object.assign(NS.persistence, { loadProgress, saveProgress, loadHighScores, saveHighScores, addHighScore });
})();
