/* The status bar cells: score, lives (∞ in zen), and the level cell re-labelled
   Time or Wave depending on the mode. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const D = NS.dom;

  function updateDisplays() {
    D.statusScore.textContent = S.score;

    if (S.lives === Infinity)
      D.statusLives.textContent = '∞';
    else
      D.statusLives.textContent = S.lives;

    if (S.gameMode === 'zen') {
      D.statusLevelLabel.textContent = 'Time';
      const secs = Math.ceil((S.zenTimer || 0) / 1000);
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      D.statusLevel.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    } else if (S.gameMode === 'survival') {
      D.statusLevelLabel.textContent = 'Wave';
      D.statusLevel.textContent = Math.floor((S.gameTime || 0) / 10000) + 1;
    } else {
      D.statusLevelLabel.textContent = 'Level';
      D.statusLevel.textContent = S.level;
    }

    if (D.statusMode)
      D.statusMode.textContent = NS.rules.modeConfig().label;
  }

  Object.assign(NS.status, { updateDisplays });
})();
