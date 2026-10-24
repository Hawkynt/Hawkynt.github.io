;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.app.gameLoop = function gameLoop(timestamp) {
    S.animFrameId = requestAnimationFrame(NS.app.gameLoop);

    const dt = Math.min((timestamp - S.lastTime) / 1000, 0.05);
    S.lastTime = timestamp;

    switch (S.gameState) {
      case 'ready':
        S.readyTimer -= dt * 1000;
        if (S.readyTimer <= 0)
          S.gameState = 'playing';
        break;

      case 'playing':
        NS.modes.updateModeTimer(dt);
        NS.modes.updateFrightenedTimer(dt);

        /* Boss slow effect */
        if (S.pacmanSlowed) {
          S.pacmanSlowTimer -= dt * 1000;
          if (S.pacmanSlowTimer <= 0)
            S.pacmanSlowed = false;
        }

        NS.pacman.movePacman(dt);
        if (NS.movement.isActivePowerup('magnet'))
          NS.pacman.magnetPull();

        for (const g of S.ghosts)
          NS.ghosts.moveGhost(g, dt);

        NS.collisions.checkDotEating();
        NS.collisions.checkGhostCollisions();
        if (S.bossActive) {
          NS.boss.updateBoss(dt);
          NS.boss.checkBossCollision();
        }
        NS.collisions.checkFruitCollision();
        NS.collisions.updateFruit(dt);
        NS.powerups.updatePowerups(dt, timestamp);
        NS.powerups.collectPowerup(timestamp);

        /* Dot chain timer */
        if (S.dotChainTimer > 0) {
          S.dotChainTimer -= dt * 1000;
          if (S.dotChainTimer <= 0)
            S.dotChainCount = 0;
        }

        break;

      case 'dying':
        S.dyingTimer -= dt * 1000;
        if (S.dyingTimer <= 0)
          NS.flow.finishDying();
        break;

      case 'levelcomplete':
        S.levelCompleteTimer -= dt * 1000;
        if (S.levelCompleteTimer <= 0)
          NS.flow.finishLevelComplete();
        break;

      case 'intermission':
        S.intermissionTimer -= dt * 1000;
        if (S.intermissionTimer <= 0)
          NS.flow.startReady();
        break;

      case 'bossIntro':
        S.bossWarningTimer -= dt * 1000;
        if (S.bossWarningTimer <= 0)
          S.gameState = 'playing';
        break;

      case 'bossVictory':
        S.bossVictoryTimer -= dt * 1000;
        if (S.bossVictoryTimer <= 0)
          NS.flow.advanceLevel();
        break;

      case 'paused':
      case 'gameover':
      case 'idle':
        break;
    }

    E.screenShake.update(dt * 1000);
    E.particles.update();
    E.floatingText.update();

    /* Update electric arcs */
    for (let i = S.electricArcs.length - 1; i >= 0; --i) {
      S.electricArcs[i].life -= dt * 1000;
      if (S.electricArcs[i].life <= 0)
        S.electricArcs.splice(i, 1);
    }

    NS.scene.draw(timestamp);
  }

  NS.app.init = function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    SZ.GameAudio.attachMuteButton();
    D.setupCanvas();
    NS.highscores.loadHighScores();

    S.gameState = 'idle';
    S.score = 0;
    S.lives = 3;
    S.level = 1;
    S.bossActive = false;
    S.boss = null;
    S.bossMinions = [];
    NS.flow.initLevel();
    NS.status.updateStatus();

    S.lastTime = performance.now();
    S.animFrameId = requestAnimationFrame(NS.app.gameLoop);
  }

  NS.app.init();

})();
