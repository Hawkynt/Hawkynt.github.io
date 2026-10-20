/* Bootstrap: the requestAnimationFrame game loop (move timing, interpolation, effect
   updates and rendering) and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { particles, screenShake, floatingText, sfx } = NS.effects;
  const { isOpposite, getMoveInterval, isTron } = NS.rules;
  const { updateZenLeaves } = NS.themes;
  const { updatePowerups } = NS.powerups;
  const { moveSnake } = NS.game;
  const { moveAISnakes } = NS.ai;
  const { updateDisplays, updateEffectDisplay, render } = NS.board;
  const { loadConfig, setupPresetButtons, showOptionsDialog } = NS.options;
  const { loadHighScores } = NS.highscores;
  const { mouseDirectionForSnake } = NS.input;

  /* ---- Game Loop ---- */
  function gameLoop(timestamp) {
    S.animFrameId = requestAnimationFrame(gameLoop);

    const dt = S.lastTimestamp ? timestamp - S.lastTimestamp : 16;
    S.lastTimestamp = timestamp;

    particles.update();
    floatingText.update();
    screenShake.update(dt);
    updateZenLeaves(timestamp);

    if (S.gameActive && !S.gamePaused && !S.gameOverFlag && !S.waitingToStart) {
      updatePowerups(timestamp);

      /* Mouse-only steering: auto-queue direction toward cursor each tick */
      if (S.mouseControlActive && S.inputQueue.length === 0) {
        const mDir = mouseDirectionForSnake();
        if (mDir) {
          const ref = S.inputQueue.length > 0 ? S.inputQueue[S.inputQueue.length - 1] : S.direction;
          if (!isOpposite(mDir, ref))
            S.inputQueue.push(mDir);
        }
      }

      const baseInterval = getMoveInterval();
      /* Tron mode: 60 % speed for tighter curves */
      const interval = isTron() ? Math.round(baseInterval * 0.6) : baseInterval;
      const elapsed = timestamp - S.lastMoveTime;
      if (elapsed >= interval) {
        moveSnake(timestamp);
        if (S.gameActive)
          moveAISnakes(timestamp);
        S.lastMoveTime = timestamp;
        S.lerpT = 0;
      } else
        S.lerpT = Math.min(1, elapsed / interval);

      updateEffectDisplay();
    }

    render(timestamp);
  }

  /* ---- Init ---- */
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    loadConfig();
    D.setupCanvas();
    loadHighScores();
    setupPresetButtons();
    sfx.attachMuteButton();

    S.snake = [];
    S.prevSnake = null;
    S.direction = C.DIR.RIGHT;
    S.nextDirection = C.DIR.RIGHT;
    S.inputQueue = [];
    S.food = null;
    S.score = 0;
    S.level = 1;
    S.foodsEaten = 0;
    S.gameActive = false;
    S.gamePaused = false;
    S.gameOverFlag = false;
    S.waitingToStart = true;
    S.pausedForDialog = false;
    S.lastMoveTime = 0;
    S.lastTimestamp = 0;
    S.lerpT = 1;
    S.obstacles = new Set();
    S.aiSnakes = [];
    S.activePowerups = [];
    S.fieldPowerup = null;
    S.lastPowerupTime = 0;
    S.dialogGen = 0;
    S.pendingVisualTheme = S.gameConfig.visualTheme || null;

    updateDisplays();

    if (D.statusEffects)
      D.statusEffects.style.display = 'none';

    S.animFrameId = requestAnimationFrame(gameLoop);
    showOptionsDialog();
  }

  Object.assign(NS.app, { gameLoop, init });

  init();
})();
