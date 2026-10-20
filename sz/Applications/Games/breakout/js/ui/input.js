/* Keyboard and mouse (pointer lock) input: dialogs, restart, pause, launch,
   laser fire, the held-key map and pointer-locked paddle movement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { launchBall } = NS.balls;
  const { fireLaser } = NS.lasers;
  const { newGame, togglePause } = NS.game;

  /* ---- Input: Keyboard ---- */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      SZ.Dialog.close('highScoresBackdrop');
      SZ.Dialog.close('controlsBackdrop');
      SZ.Dialog.close('dlg-about');
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'Enter' && S.state === C.STATE_GAME_OVER) {
      e.preventDefault();
      newGame();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (S.state === C.STATE_IDLE) {
        S.state = C.STATE_PLAYING;
        for (const ball of S.balls)
          if (ball.attached)
            launchBall(ball);
        SZ.GameAudio.play('shoot', { pitch: 0.7 });
      } else if (S.state === C.STATE_PLAYING)
        fireLaser();
      return;
    }

    S.keysDown[e.key] = true;
  });

  document.addEventListener('keyup', e => {
    delete S.keysDown[e.key];
  });

  /* ---- Input: Mouse (pointer lock) ---- */
  V.canvas.addEventListener('click', () => {
    if (!S.pointerLocked)
      V.canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    S.pointerLocked = document.pointerLockElement === V.canvas;
  });

  document.addEventListener('mousemove', e => {
    if (!S.pointerLocked || S.state === C.STATE_GAME_OVER || S.state === C.STATE_PAUSED)
      return;
    const rect = V.canvas.getBoundingClientRect();
    const scaleX = S.CANVAS_W / rect.width;
    S.paddle.x += e.movementX * scaleX;
    if (S.paddle.x < 0)
      S.paddle.x = 0;
    if (S.paddle.x + S.paddle.width > S.CANVAS_W)
      S.paddle.x = S.CANVAS_W - S.paddle.width;
  });

  document.addEventListener('mousedown', e => {
    if (!S.pointerLocked)
      return;
    if (S.state === C.STATE_IDLE) {
      S.state = C.STATE_PLAYING;
      for (const ball of S.balls)
        if (ball.attached)
          launchBall(ball);
      SZ.GameAudio.play('shoot', { pitch: 0.7 });
    } else if (S.state === C.STATE_PLAYING)
      fireLaser();
  });

  Object.assign(NS.input, {});
})();
