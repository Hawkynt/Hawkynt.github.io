/* The high-score table in the dialog: one row per score, a placeholder when empty. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const S = NS.state;
  const D = NS.dom;

  function renderHighScores() {
    if (!D.highScoresBody) return;
    D.highScoresBody.innerHTML = '';
    for (let i = 0; i < S.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${S.highScores[i].level}</td><td>${S.highScores[i].moves}</td>`;
      D.highScoresBody.appendChild(tr);
    }
    if (!S.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      D.highScoresBody.appendChild(tr);
    }
  }

  Object.assign(NS.highscores, { renderHighScores });
})();
