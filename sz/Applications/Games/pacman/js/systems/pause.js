;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.pause.togglePause = function togglePause() {
    if (S.gameState === 'playing') {
      S.gameState = 'paused';
    } else if (S.gameState === 'paused') {
      S.gameState = 'playing';
      S.lastTime = performance.now();
    }
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.gameState === 'playing',
    pause: NS.pause.togglePause
  });

})();
