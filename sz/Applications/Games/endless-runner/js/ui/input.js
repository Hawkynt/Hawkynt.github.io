/* Input: lane switching, jump and slide, the start/restart action, the pause toggle,
   the auto-pause handler, the keyboard, the canvas tap-to-steer and the resize hook. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const sfx = V.sfx;

  /* ── Input ── */
  function switchLane(dir) {
    if (S.state !== C.STATE_RUNNING)
      return;
    const next = Math.max(0, Math.min(2, S.targetLane + dir));
    if (next === S.targetLane)
      return;
    S.transitionStartX = NS.rules.getPlayerX();
    S.previousLane = S.targetLane;
    S.targetLane = next;
    S.laneTransitionTimer = C.LANE_SWITCH_DURATION;
    sfx.play('whoosh', { pitch: 2, volume: 0.35 });
  }

  function startJump() {
    if (S.state !== C.STATE_RUNNING || S.isJumping || S.isSliding)
      return;
    S.isJumping = true;
    S.jumpTimer = 0;
    sfx.play('jump');
    V.particles.burst(NS.rules.getPlayerX(), C.LANE_Y_BOTTOM, 6, { color: '#ddd', speed: 2, life: 0.3, size: 2, decay: 0.03 });
  }

  function startSlide() {
    if (S.state !== C.STATE_RUNNING || S.isJumping || S.isSliding)
      return;
    S.isSliding = true;
    S.slideTimer = 0;
    sfx.play('whoosh', { pitch: 0.6, volume: 0.6 });
  }

  function handleAction() {
    if (S.state === C.STATE_READY) {
      S.state = C.STATE_RUNNING;
      sfx.play('select');
      NS.status.updateStatus();
    } else if (S.state === C.STATE_DEAD) {
      NS.flow.resetGame();
    } else if (S.state === C.STATE_RUNNING) {
      startJump();
    }
  }

  function togglePause() {
    if (S.state === C.STATE_RUNNING)
      S.state = C.STATE_PAUSED;
    else if (S.state === C.STATE_PAUSED)
      S.state = C.STATE_RUNNING;
    NS.status.updateStatus();
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_RUNNING,
    pause: togglePause
  });

  document.addEventListener('keydown', function(e) {
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
      if (S.state === C.STATE_RUNNING || S.state === C.STATE_PAUSED || S.state === C.STATE_READY) {
        S.showTutorial = !S.showTutorial;
        S.tutorialPage = 0;
        return;
      }
    }

    if (e.key === 'F2') {
      e.preventDefault();
      NS.flow.resetGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      handleAction();
      return;
    }

    if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      switchLane(-1);
      return;
    }

    if (e.key === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      switchLane(1);
      return;
    }

    if (e.key === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      startJump();
      return;
    }

    if (e.key === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      startSlide();
      return;
    }
  });

  V.canvas.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    if (S.showTutorial) {
      ++S.tutorialPage;
      if (S.tutorialPage >= C.TUTORIAL_PAGES.length)
        S.showTutorial = false;
      return;
    }
    if (S.state === C.STATE_READY || S.state === C.STATE_DEAD) {
      handleAction();
      return;
    }

    if (S.state !== C.STATE_RUNNING)
      return;

    // Touch controls: click target lane directly, or jump if same lane
    const rect = V.canvas.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const clickedLane = Math.min(2, Math.floor(relX * C.NUM_LANES));
    if (clickedLane !== S.targetLane) {
      const dir = clickedLane - S.targetLane;
      switchLane(dir);
    } else
      startJump();
  });

  /* ── Resize ── */
  window.addEventListener('resize', V.setupCanvas);

  NS.input.switchLane = switchLane;
  NS.input.startJump = startJump;
  NS.input.startSlide = startSlide;
  NS.input.handleAction = handleAction;
  NS.input.togglePause = togglePause;
})();
