/* The main loop and the init sequence: load scores, set up level 1, drop back to
   the ready overlay and start rendering. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const { update } = NS.physics;
  const { draw } = NS.board;
  const { loadLevel, updateTitle } = NS.game;
  const { loadHighScores } = NS.highscores;
  const { handleResize } = NS.menu;

  /* ── Game loop ── */
  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, C.MAX_DT);
    lastTime = timestamp;

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ── Init ── */
  SZ.GameAudio.attachMuteButton();
  loadHighScores();
  loadLevel(0);
  S.state = C.STATE_READY;
  updateTitle();
  handleResize();
  requestAnimationFrame(gameLoop);

  Object.assign(NS.app, { gameLoop });
})();
