/* Persistence: loading and saving the discovered/visited progress and the high scores
   to localStorage, recording a completion time and rendering the high-scores table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function loadProgress() {
    try {
      const raw = localStorage.getItem(C.STORAGE_PROGRESS);
      if (raw) {
        const data = JSON.parse(raw);
        S.discoveredRules = data.discovered || {};
        S.roomsVisited = data.visited || {};
        S.currentRoom = data.currentRoom || 0;
      }
    } catch (_) {
      S.discoveredRules = {};
      S.roomsVisited = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(C.STORAGE_PROGRESS, JSON.stringify({
        discovered: S.discoveredRules,
        visited: S.roomsVisited,
        currentRoom: S.currentRoom
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

  function addHighScore(room, time) {
    S.highScores.push({ room: room + 1, time: Math.round(time) });
    S.highScores.sort((a, b) => a.time - b.time || a.room - b.room);
    if (S.highScores.length > C.MAX_HIGH_SCORES)
      S.highScores.length = C.MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!D.highScoresBody) return;
    D.highScoresBody.innerHTML = '';
    for (let i = 0; i < S.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${S.highScores[i].room}</td><td>${S.highScores[i].time}s</td>`;
      D.highScoresBody.appendChild(tr);
    }
    if (!S.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      D.highScoresBody.appendChild(tr);
    }
  }

  Object.assign(NS.persist, { loadProgress, saveProgress, loadHighScores, saveHighScores, addHighScore, renderHighScores });
})();
