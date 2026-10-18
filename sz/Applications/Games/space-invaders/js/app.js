/* Bootstrap: the fixed 60 Hz game loop, the menu bar actions and start-up.
   Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { THEME_ORDER, SIM_STEP, SIM_MAX_STEPS, SIM_SNAP } = NS.constants;
  const { updateStatusBar, showHighScores } = NS.statusBar;
  const { sfx } = NS.audio;
  const { resizeCanvas } = NS.view;
  const { setBackdrop } = NS.backdrop;
  const { update } = NS.sim;
  const { setScreen } = NS.screens;
  const { draw } = NS.frame;

  const { User32 } = SZ.Dlls || {};
  let lastTime = 0;
  let simAccumulator = 0;

  /* One display frame: as many fixed simulation steps as are due, then one draw */
  function gameLoop(timestamp) {
    if (!lastTime)
      lastTime = timestamp;
    let elapsed = timestamp - lastTime;
    lastTime = timestamp;

    /* Snap refresh jitter around 60 Hz to exactly one step; cap catch-up after stalls */
    if (Math.abs(elapsed - SIM_STEP) < SIM_SNAP)
      elapsed = SIM_STEP;
    simAccumulator = Math.min(simAccumulator + elapsed, SIM_STEP * SIM_MAX_STEPS);
    while (simAccumulator >= SIM_STEP) {
      simAccumulator -= SIM_STEP;
      update(SIM_STEP);
    }
    draw();
    requestAnimationFrame(gameLoop);
  }

  /* Window menu bar */
  new SZ.MenuBar({
    onAction(action) {
      switch (action) {
        case 'new':
          setScreen('title');
          break;
        case 'pause':
          if (G.gameState === 'playing') {
            G.gameState = 'paused';
            G.menuCursor = 0;
          } else if (G.gameState === 'paused')
            G.gameState = 'playing';
          break;
        case 'high-scores':
          showHighScores();
          break;
        case 'exit':
          User32.DestroyWindow();
          break;
        case 'controls':
          SZ.Dialog.show('controlsBackdrop');
          break;
        case 'about':
          SZ.Dialog.show('dlg-about');
          break;
      }
    },
  });

  /* Start-up */
  User32.EnableVisualStyles();
  sfx.attachMuteButton();

  /* let the page accept keyboard focus on the body so clicks keep the keys alive */
  document.body.tabIndex = -1;

  resizeCanvas();
  setBackdrop(THEME_ORDER[0]);
  updateStatusBar();
  requestAnimationFrame(gameLoop);
})();
