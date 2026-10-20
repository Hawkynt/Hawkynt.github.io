/* Bootstrap: the requestAnimationFrame game loop (fixed-step simulation), the
   display and window resize handling and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ---- Game Loop ---- */
  function gameLoop(timestamp) {
    S.animFrameId = requestAnimationFrame(gameLoop);

    if (!S.lastTime)
      S.lastTime = timestamp;
    let elapsed = timestamp - S.lastTime;
    S.lastTime = timestamp;

    /* Snap refresh jitter around 60 Hz to exactly one step; cap catch-up after stalls */
    if (Math.abs(elapsed - C.SIM_STEP) < C.SIM_SNAP)
      elapsed = C.SIM_STEP;
    S.simAccumulator = Math.min(S.simAccumulator + elapsed, C.SIM_STEP * C.SIM_MAX_STEPS);
    while (S.simAccumulator >= C.SIM_STEP) {
      S.simAccumulator -= C.SIM_STEP;
      NS.sim.update(C.SIM_STEP);
    }
    NS.scene.draw();
  }

  /* ---- Display Resize Handling ---- */
  const resizeObserver = new ResizeObserver(() => V.fitCanvasToFrame());
  resizeObserver.observe(V.gameFrame);

  /* ---- Window Resize ---- */
  function requestWindowResize() {
    requestAnimationFrame(() => {
      const w = S.CANVAS_W + 28;
      const h = S.CANVAS_H + 80;
      SZ.Dlls.User32.MoveWindow(w, h);
    });
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    SZ.GameAudio.attachMuteButton();
    NS.highscores.loadHighScores();
    NS.field.recalcFieldDerived();
    NS.game.newGame();
    requestWindowResize();
  }

  Object.assign(NS.app, { gameLoop, requestWindowResize, init });

  init();
})();
