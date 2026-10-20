/* Bootstrap: the requestAnimationFrame game loop (update, effect upkeep, rendering
   and the status bar) and the start-up sequence. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const D = NS.dom;
  const FX = NS.effects;
  const { updateGame } = NS.game;
  const { drawGame } = NS.board;
  const { updateStatusBar } = NS.statusbar;
  const { handleAction } = NS.menu;
  const { loadProgress, loadHighScores } = NS.persistence;
  const { updateWindowTitle } = NS.os;

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, C.MAX_DT);
    lastTimestamp = timestamp;

    updateGame(dt);

    FX.particles.update();
    FX.screenShake.update(dt * 1000);
    FX.floatingText.update();

    D.ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
    D.ctx.save();
    FX.screenShake.apply(D.ctx);
    drawGame();
    FX.particles.draw(D.ctx);
    FX.floatingText.draw(D.ctx);
    FX.screenShake.restore(D.ctx);
    D.ctx.restore();

    updateStatusBar();

    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  D.setupCanvas();
  SZ.GameAudio.attachMuteButton();
  SZ.TouchControls.attach({
    container: document.querySelector('.game-frame'),
    stick: 'four',
    repeat: 170,
    buttons: [
      { label: '\u21BB', code: 'KeyE', title: 'Rotate right' },
      { label: '\u21BA', code: 'KeyQ', title: 'Rotate left' }
    ],
    extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
  });
  loadProgress();
  loadHighScores();
  updateWindowTitle();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);
})();
