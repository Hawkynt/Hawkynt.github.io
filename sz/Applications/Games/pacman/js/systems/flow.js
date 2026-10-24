;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.flow.startDying = function startDying() {
    S.gameState = 'dying';
    S.dyingTimer = 1500;
    E.screenShake.trigger(12, 600);
    SZ.GameAudio.play('hurt');
    E.particles.burst(S.pacman.x, S.pacman.y, 50, {
      color: '#FFD700', speed: 4, gravity: 0.05, life: 0.8
    });
  }

  NS.flow.finishDying = function finishDying() {
    --S.lives;
    NS.status.updateStatus();
    if (S.lives <= 0) {
      S.gameState = 'gameover';
      SZ.GameAudio.play('lose');
      S.bossActive = false;
      S.boss = null;
      S.bossMinions = [];
      NS.highscores.checkHighScore();
      return;
    }
    NS.flow.resetPositions();
    S.pacman.speed = 2 * S.levelConfig.pac;
    for (const g of S.ghosts)
      g.speed = 1.5 * S.levelConfig.ghost;

    /* Clear powerup effects on death */
    S.activePowerups = [];
    S.scoreMultiplier = 1;
    S.pacmanPhasing = false;
    S.ghostsFrozen = false;
    S.pacmanSlowed = false;
    S.pacmanSlowTimer = 0;
    S.fieldPowerup = null;

    NS.flow.startReady();
  }

  NS.flow.startReady = function startReady() {
    S.gameState = 'ready';
    S.readyTimer = 2000;
  }

  NS.flow.startLevelComplete = function startLevelComplete() {
    S.gameState = 'levelcomplete';
    S.levelCompleteTimer = 2000;
    S.levelFlashCount = 0;
    SZ.GameAudio.play('levelup');

    E.particles.confetti(C.CANVAS_W / 2, C.CANVAS_H / 2, 30);
    E.particles.sparkle(50, 50, 10, { color: '#FFD700', speed: 3 });
    E.particles.sparkle(C.CANVAS_W - 50, 50, 10, { color: '#FFD700', speed: 3 });
    E.particles.sparkle(50, C.CANVAS_H - 50, 10, { color: '#FFD700', speed: 3 });
    E.particles.sparkle(C.CANVAS_W - 50, C.CANVAS_H - 50, 10, { color: '#FFD700', speed: 3 });
    E.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2, 'LEVEL COMPLETE!', {
      color: '#FFD700', font: 'bold 18px sans-serif', decay: 0.008
    });
  }

  NS.flow.finishLevelComplete = function finishLevelComplete() {
    if (S.level % C.BOSS_EVERY === 0) {
      NS.boss.startBossIntro();
      return;
    }
    NS.flow.advanceLevel();
  }

  NS.flow.advanceLevel = function advanceLevel() {
    const prevLevel = S.level;
    ++S.level;
    NS.flow.initLevel();

    if (prevLevel % C.WORLD_SIZE === 0) {
      S.gameState = 'intermission';
      S.intermissionTimer = C.INTERMISSION_DURATION;
    } else {
      NS.flow.startReady();
    }
  }

  NS.flow.resetPositions = function resetPositions() {
    S.pacman = NS.entities.createPacman();
    S.ghosts = [NS.entities.createGhost(0), NS.entities.createGhost(1), NS.entities.createGhost(2), NS.entities.createGhost(3)];
    S.modeTimer = C.MODE_TIMINGS[0] * 1000;
    S.modeIndex = 0;
    S.currentMode = C.MODE_SCATTER;
    S.frightenedTimer = 0;
    S.ghostsEatenThisRound = 0;
  }

  NS.flow.initLevel = function initLevel() {
    S.maze = NS.maze.cloneMaze();
    S.totalDots = NS.maze.countDots(S.maze);
    S.dotsEaten = 0;
    S.fruitActive = false;
    S.fruitTimer = 0;
    S.fruitShown = 0;

    /* Level config */
    S.levelConfig = T.LEVEL_CONFIG[Math.min(S.level - 1, T.LEVEL_CONFIG.length - 1)];

    /* World theme */
    S.currentTheme = C.WORLD_THEMES[Math.floor((S.level - 1) / C.WORLD_SIZE) % C.WORLD_THEMES.length];

    /* Build S.maze cache */
    NS.mazecache.buildMazeCache();

    NS.flow.resetPositions();

    /* Apply S.level speeds */
    S.pacman.speed = 2 * S.levelConfig.pac;
    for (const g of S.ghosts)
      g.speed = 1.5 * S.levelConfig.ghost;

    /* Reset enhanced state */
    S.trailCounter = 0;
    S.dotChainCount = 0;
    S.dotChainTimer = 0;
    S.electricArcs = [];
    S.fieldPowerup = null;
    S.lastPowerupTime = performance.now();
    S.activePowerups = [];
    S.scoreMultiplier = 1;
    S.pacmanPhasing = false;
    S.ghostsFrozen = false;
    S.pacmanSlowed = false;
    S.pacmanSlowTimer = 0;
  }

  NS.flow.newGame = function newGame() {
    if (S.animFrameId) {
      cancelAnimationFrame(S.animFrameId);
      S.animFrameId = null;
    }
    S.score = 0;
    S.lives = 3;
    S.level = 1;
    E.particles.clear();
    E.floatingText.clear();
    S.bossActive = false;
    S.boss = null;
    S.bossMinions = [];
    NS.flow.initLevel();
    NS.status.updateStatus();
    NS.flow.startReady();
    SZ.GameAudio.play('select');
    S.lastTime = performance.now();
    S.animFrameId = requestAnimationFrame(NS.app.gameLoop);
  }

})();
