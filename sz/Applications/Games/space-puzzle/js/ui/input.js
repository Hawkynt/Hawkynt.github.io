/* Input: the drag-from-probe pointer gesture that aims and launches, and the
   keyboard — F2 new game, Escape pause, R retry. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { resetGame, togglePause, resetObject } = NS.game;

  /* ── Pointer input for drag & launch ── */
  D.canvas.addEventListener('pointerdown', (e) => {
    // Click to start from READY or restart from GAME_OVER
    if (S.state === C.STATE_READY || S.state === C.STATE_GAME_OVER) {
      resetGame();
      return;
    }

    if (S.state !== C.STATE_PLAYING && S.state !== C.STATE_AIMING) return;
    if (S.obj.active) return;

    const rect = D.canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (C.CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (C.CANVAS_H / rect.height);

    // Must click near the object start position to begin aiming
    const distToObj = Math.sqrt((mx - S.startPos.x) ** 2 + (my - S.startPos.y) ** 2);
    if (distToObj > 40) return;

    S.isDragging = true;
    S.dragStartX = mx;
    S.dragStartY = my;
    S.dragEndX = mx;
    S.dragEndY = my;
    S.state = C.STATE_AIMING;
    SZ.GameAudio.play('click');
    D.canvas.setPointerCapture(e.pointerId);
  });

  D.canvas.addEventListener('pointermove', (e) => {
    if (!S.isDragging) return;
    const rect = D.canvas.getBoundingClientRect();
    S.dragEndX = (e.clientX - rect.left) * (C.CANVAS_W / rect.width);
    S.dragEndY = (e.clientY - rect.top) * (C.CANVAS_H / rect.height);
  });

  D.canvas.addEventListener('pointerup', (e) => {
    if (!S.isDragging) return;
    S.isDragging = false;

    // Compute launchSpeed from drag distance and direction
    const launchDx = S.dragStartX - S.dragEndX;
    const launchDy = S.dragStartY - S.dragEndY;
    const launchDist = Math.sqrt(launchDx * launchDx + launchDy * launchDy);

    if (launchDist < 10) {
      S.state = C.STATE_PLAYING;
      return;
    }

    // Launch the object with launchForce based on drag
    const launchForce = launchDist * C.LAUNCH_SPEED_SCALE;
    const launchSpeed = Math.min(launchForce, 500);
    S.obj.x = S.startPos.x;
    S.obj.y = S.startPos.y;
    S.obj.vx = (launchDx / launchDist) * launchSpeed;
    S.obj.vy = (launchDy / launchDist) * launchSpeed;
    S.obj.active = true;
    ++S.moveCount;
    S.state = C.STATE_LAUNCHED;
    SZ.GameAudio.play('whoosh', { pitch: 0.6 + launchSpeed / 500 });

    D.particles.burst(S.startPos.x, S.startPos.y, 6, { color: '#44aaff', life: 0.3, speed: 30 });
  });

  /* ── Keyboard input ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      resetGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    // R to retry current level
    if (e.key === 'r' || e.key === 'R') {
      if (S.state === C.STATE_PLAYING || S.state === C.STATE_LAUNCHED || S.state === C.STATE_AIMING) {
        resetObject();
        SZ.GameAudio.play('click');
        S.moveCount = 0;
        S.levelStartTime = performance.now();
        S.state = C.STATE_PLAYING;
      }
    }
  });

  Object.assign(NS.input, {});
})();
