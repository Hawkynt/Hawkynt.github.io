/* Input: the auto-pause handler, the keyboard (held-key movement, F2, tutorial
   navigation, help, pause toggle), the click/tap-to-start and click-to-move mouse
   navigation and the canvas coordinate mapping. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { tryMovePlayer } = NS.rules;
  const { resetGame } = NS.game;

  /* ── Input ── */
  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_PLAYING,
    pause: () => {
      S.state = C.STATE_PAUSED;
    }
  });

  document.addEventListener('keydown', (e) => {
    S.keysDown[e.key] = true;

    if (e.key === 'F2') {
      e.preventDefault();
      resetGame();
      return;
    }

    /* Tutorial navigation */
    if (S.showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++S.tutorialPage;
        if (S.tutorialPage >= C.TUTORIAL_PAGES.length)
          S.showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && S.tutorialPage > 0) {
        e.preventDefault();
        --S.tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        S.showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (S.state === C.STATE_PLAYING || S.state === C.STATE_PAUSED || S.state === C.STATE_READY) {
        S.showTutorial = !S.showTutorial;
        S.tutorialPage = 0;
        return;
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (S.state === C.STATE_PLAYING)
        S.state = C.STATE_PAUSED;
      else if (S.state === C.STATE_PAUSED)
        S.state = C.STATE_PLAYING;
      return;
    }

    if (C.DIRS[e.key]) {
      e.preventDefault();
      if (S.state === C.STATE_PLAYING && S.player.alive) {
        if (S.player.moveProgress >= 1)
          tryMovePlayer(C.DIRS[e.key].dx, C.DIRS[e.key].dy);
        else
          S.moveQueue = C.DIRS[e.key];
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    S.keysDown[e.key] = false;
  });

  function canvasCoords(e) {
    const rect = V.canvas.getBoundingClientRect();
    const scaleX = (C.COLS * C.TILE_SIZE) / rect.width;
    const scaleY = (C.ROWS * C.TILE_SIZE) / rect.height;
    return {
      col: Math.floor((e.clientX - rect.left) * scaleX / C.TILE_SIZE),
      row: Math.floor((e.clientY - rect.top) * scaleY / C.TILE_SIZE)
    };
  }

  function mouseMoveToward() {
    if (!S.mouseHeld || S.state !== C.STATE_PLAYING || !S.player.alive) return;
    if (S.player.moveProgress < 1) return;

    const dx = S.mouseCol - S.player.col;
    const dy = S.mouseRow - S.player.row;
    if (dx === 0 && dy === 0) return;

    /* Prefer the axis with the larger distance; break ties toward horizontal */
    let mx = 0, my = 0;
    if (Math.abs(dx) >= Math.abs(dy))
      mx = dx > 0 ? 1 : -1;
    else
      my = dy > 0 ? 1 : -1;

    tryMovePlayer(mx, my);
  }

  /* ── Click/Tap to start + mouse navigation ── */
  V.canvas.addEventListener('pointerdown', (e) => {
    if (S.showTutorial) {
      ++S.tutorialPage;
      if (S.tutorialPage >= C.TUTORIAL_PAGES.length)
        S.showTutorial = false;
      return;
    }
    if (S.state === C.STATE_READY || S.state === C.STATE_DEAD) {
      resetGame();
      return;
    }

    /* In-game: click-to-move */
    if (S.state === C.STATE_PLAYING && S.player.alive) {
      const pos = canvasCoords(e);
      S.mouseCol = pos.col;
      S.mouseRow = pos.row;
      S.mouseHeld = true;
      mouseMoveToward();
    }
  });

  V.canvas.addEventListener('pointermove', (e) => {
    if (!S.mouseHeld) return;
    const pos = canvasCoords(e);
    S.mouseCol = pos.col;
    S.mouseRow = pos.row;
  });

  V.canvas.addEventListener('pointerup', () => {
    S.mouseHeld = false;
  });

  Object.assign(NS.input, { canvasCoords, mouseMoveToward });
})();
