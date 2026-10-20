/* Bootstrap: the requestAnimationFrame game loop (fixed-step update, effect updates and
   rendering) and start-up — wiring the dialogs, the menu bar and touch controls, sizing
   the canvas, loading progress and high scores and kicking off the loop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { particles, screenShake, floatingText } = NS.effects;
  const { updateGame } = NS.rules;
  const { drawGame } = NS.hud;
  const { updateStatusBar } = NS.statusbar;
  const { loadProgress, loadHighScores } = NS.persist;
  const { updateWindowTitle } = NS.os;
  const { handleAction } = NS.menu;

  /* ── GAME LOOP ── */

  function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, C.MAX_DT);
    S.lastTimestamp = timestamp;

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    D.ctx.clearRect(0, 0, C.canvasW, C.canvasH);
    D.ctx.save();
    screenShake.apply(D.ctx);
    drawGame();
    particles.draw(D.ctx);
    floatingText.draw(D.ctx);
    screenShake.restore(D.ctx);
    D.ctx.restore();

    updateStatusBar();

    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── INIT ── */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  D.setupCanvas();
  loadProgress();
  loadHighScores();
  updateWindowTitle();
  SZ.GameAudio.attachMuteButton();
  SZ.TouchControls.attach({
    container: document.querySelector('.game-frame'),
    stick: 'eight',
    buttons: [
      { label: 'Use', code: 'KeyE' },
      { label: 'Shift', code: 'KeyQ' }
    ],
    extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
  });

  S.lastTimestamp = 0;
  S.animFrameId = requestAnimationFrame(gameLoop);

  Object.assign(NS.app, { gameLoop });
})();
