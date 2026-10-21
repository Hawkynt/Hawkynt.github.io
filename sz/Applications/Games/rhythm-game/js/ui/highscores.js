/* High scores: the localStorage list of song results, the best entry per song
   shown on the select screen and the table rendered into the dialog. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(C.STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHighScore(songName, finalScore, grade) {
    try {
      const scores = loadHighScores();
      scores.push({ song: songName, score: finalScore, grade, date: Date.now() });
      scores.sort((a, b) => b.score - a.score);
      while (scores.length > C.MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(C.STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  }

  function getHighScoreForSong(songName) {
    const scores = loadHighScores();
    return scores.find(s => s.song === songName) || null;
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        `<tr><td>${i + 1}</td><td>${s.song}</td><td>${s.score}</td><td>${s.grade}</td></tr>`
      ).join('');
    }
  }

  Object.assign(NS.highscores, { loadHighScores, saveHighScore, getHighScoreForSong, showHighScores });
})();
