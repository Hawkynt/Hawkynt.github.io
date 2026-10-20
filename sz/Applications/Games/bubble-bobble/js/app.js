/* Bootstrap: the window-title update, the requestAnimationFrame game loop (clamped
   delta time, update then draw) and start-up — load scores, build the first level,
   show the first-run tutorial, attach the mute button and touch controls, and kick the
   loop. Loaded last. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Title ── */
  function updateTitle() {
    const title = S.state === C.STATE_DEAD
      ? `Bubble Bobble - Game Over (Score: ${S.score})`
      : `Bubble Bobble - Level ${S.currentLevel} - Score: ${S.score}`;
    if (V.User32?.SetWindowText) V.User32.SetWindowText(title);
  }

  /* ── Game loop ── */
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - S.lastTime) / 1000, C.MAX_DT);
    S.lastTime = timestamp;

    NS.flow.update(dt);
    NS.scene.draw();
    requestAnimationFrame(gameLoop);
  }

  /* ── Init ── */
  function init() {
    NS.highscores.loadHighScores();
    try { S.tutorialSeen = localStorage.getItem(C.STORAGE_TUTORIAL) === '1'; } catch (_) { S.tutorialSeen = false; }
    NS.level.generateLevel(S.currentLevel);
    updateTitle();
    NS.os.handleResize();
    if (!S.tutorialSeen) {
      S.showTutorial = true;
      S.tutorialPage = 0;
      S.tutorialSeen = true;
      try { localStorage.setItem(C.STORAGE_TUTORIAL, '1'); } catch (_) {}
    }
    SZ.GameAudio.attachMuteButton();
    SZ.TouchControls.attach({
      container: document.querySelector('.game-frame'),
      stick: 'horizontal',
      buttons: [
        { label: 'Bubble', code: 'Space' },
        { label: 'Jump', code: 'ArrowUp' }
      ],
      extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
    });
    requestAnimationFrame(gameLoop);
  }

  Object.assign(NS.app, { updateTitle, gameLoop, init });

  init();
})();
