/* The window status bar (score or credits, lives, level or screen) and the High Scores dialog. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { MODES, isMenuState } = NS.data;
  const { loadHighScores, saveHighScores } = NS.save;

  const statusScore = document.getElementById('statusScore');
  const statusLives = document.getElementById('statusLives');
  const statusLevel = document.getElementById('statusLevel');

  const SCREEN_NAMES = {
    title: 'Title', campaignMap: 'Campaign', hangar: 'Hangar', armory: 'Armory', help: 'Help',
  };

  function updateStatusBar() {
    if (isMenuState(G.gameState)) {
      statusScore.textContent = 'Credits: ' + G.save.credits;
      statusLives.textContent = '';
      statusLevel.textContent = SCREEN_NAMES[G.gameState];
      return;
    }
    statusScore.textContent = 'Score: ' + G.score;
    statusLives.textContent = 'Lives: ' + G.lives;
    if (G.gameMode === 'survival')
      statusLevel.textContent = 'Wave: ' + G.wave;
    else
      statusLevel.textContent = 'Level: ' + G.level;
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    tbody.innerHTML = '';
    if (scores.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;">No scores yet</td>';
      tbody.appendChild(tr);
    } else {
      for (let i = 0; i < scores.length; ++i) {
        const s = scores[i];
        const modeName = MODES[s.mode] ? MODES[s.mode].name : (s.mode || '?');
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td>' + s.score + '</td>' +
          '<td>' + (s.mode === 'survival' ? 'W' + (s.wave || s.level) : 'L' + s.level) + '</td>' +
          '<td>' + modeName + '</td>';
        tbody.appendChild(tr);
      }
    }
    SZ.Dialog.show('highScoresBackdrop').then(result => {
      if (result === 'reset') {
        saveHighScores([]);
        showHighScores();
      }
    });
  }

  Object.assign(NS.statusBar, {
    updateStatusBar, showHighScores
  });
})();
