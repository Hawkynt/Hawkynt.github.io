/* The game run: paddle creation, level advance, the new-game reset, the status
   bar and pausing (also when the window is hidden or loses focus). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const FX = NS.effects;
  const { loadLevel } = NS.bricks;
  const { createBall } = NS.balls;

  /* ---- Paddle ---- */
  function createPaddle() {
    return {
      x: S.CANVAS_W / 2 - C.PADDLE_WIDTH_DEFAULT / 2,
      y: S.CANVAS_H - C.PADDLE_Y_OFFSET,
      width: C.PADDLE_WIDTH_DEFAULT,
      height: C.PADDLE_HEIGHT
    };
  }

  /* ---- Level Management ---- */
  function nextLevel() {
    SZ.GameAudio.play('levelup');
    ++S.level;
    S.powerUps = [];
    S.lasers = [];
    S.barrier = null;

    S.activePowerUps = {};
    S.paddle.width = C.PADDLE_WIDTH_DEFAULT;
    for (const b of S.balls)
      b.fire = false;

    S.bricks = loadLevel(S.level);
    S.balls = [createBall(true)];
    S.state = C.STATE_LEVEL_TRANSITION;
    S.levelTransitionTimer = 0;
    S.levelTransitionPhase = 0;
    updateStatus();
  }

  /* ---- New Game ---- */
  function newGame() {
    if (S.animFrameId) {
      cancelAnimationFrame(S.animFrameId);
      S.animFrameId = null;
    }

    S.score = 0;
    S.lives = 3;
    S.level = 1;
    S.keysDown = {};
    S.powerUps = [];
    S.activePowerUps = {};
    S.lasers = [];
    S.barrier = null;
    S.comboCount = 0;
    S.comboTimer = 0;
    S.gameTime = 0;
    S.arcFrame = 0;
    S.gameOverChainTimer = 0;
    S.gameOverChainIndex = 0;

    FX.particles.clear();
    FX.floatingText.clear();

    S.paddle = createPaddle();
    S.bricks = loadLevel(S.level);
    S.balls = [createBall(true)];
    S.state = C.STATE_LEVEL_TRANSITION;
    S.levelTransitionTimer = 0;
    S.levelTransitionPhase = 0;
    S.lastTime = null;
    S.simAccumulator = 0;

    updateStatus();
    S.animFrameId = requestAnimationFrame(gameLoop);
  }

  /* the loop lives in app.js; newGame starts it through the namespace */
  function gameLoop(timestamp) {
    NS.app.gameLoop(timestamp);
  }

  /* ---- Status ---- */
  function updateStatus() {
    V.statusScore.textContent = 'Score: ' + S.score;
    V.statusLives.textContent = 'Lives: ' + (S.zenMode ? '\u221E' : S.lives);
    V.statusLevel.textContent = 'Level: ' + S.level;
  }

  /* ---- Pause ---- */
  function exitPointerLock() {
    if (document.pointerLockElement === V.canvas)
      document.exitPointerLock();
  }

  function togglePause() {
    if (S.state === C.STATE_PAUSED) {
      S.state = C.STATE_PLAYING;
      S.lastTime = null;
    } else if (S.state === C.STATE_PLAYING) {
      S.state = C.STATE_PAUSED;
      exitPointerLock();
    }
  }

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => S.state === C.STATE_PLAYING,
    pause: togglePause
  });

  Object.assign(NS.game, { createPaddle, nextLevel, newGame, updateStatus, exitPointerLock, togglePause });
})();
