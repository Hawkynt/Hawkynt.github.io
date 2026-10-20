/* Bootstrap: the requestAnimationFrame game loop, the OS integration hooks and the
   start-up sequence (high scores, first level, title, tutorial, mute button, loop). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const { loadHighScores } = NS.highscores;
  const { generateLevel } = NS.levelgen;
  const { updateTitle } = NS.game;
  const { User32 } = window.SZ?.Dlls ?? {};

  /* ── OS integration ── */
  function handleResize() {
    // Canvas size is fixed to grid; CSS scales it
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg, wParam, lParam) => {
      if (msg === 'WM_THEMECHANGED') {
        // Theme changed — no action needed for canvas game
      }
      if (msg === 'WM_SIZE')
        handleResize();
    });
  }

  /* ── Game loop ── */
  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - S.lastTime) / 1000, C.MAX_DT);
    S.lastTime = timestamp;

    NS.rules.update(dt);
    NS.cave.draw();
    requestAnimationFrame(gameLoop);
  }

  /* ── Init ── */
  function init() {
    loadHighScores();
    try { S.tutorialSeen = localStorage.getItem(C.STORAGE_TUTORIAL) === '1'; } catch (_) { S.tutorialSeen = false; }
    generateLevel(S.currentLevel);
    updateTitle();
    handleResize();
    if (!S.tutorialSeen) {
      S.showTutorial = true;
      S.tutorialPage = 0;
      S.tutorialSeen = true;
      try { localStorage.setItem(C.STORAGE_TUTORIAL, '1'); } catch (_) {}
    }
    SZ.GameAudio.attachMuteButton();
    requestAnimationFrame(gameLoop);
  }

  Object.assign(NS.app, { gameLoop, handleResize, init });

  init();
})();
