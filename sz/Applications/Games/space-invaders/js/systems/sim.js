/* The fixed-step simulation: per-state update (hit-stop, menus, boss intro and victory, dying,
   level clear) and the order of all systems in one battle step. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { GAME_W, GAME_H, PLAYER_W, ALIEN_BULLET_SPEED, BOSS_W, BOSS_H } = NS.constants;
  const { isMenuState } = NS.data;
  const { checkHighScore } = NS.save;
  const { updateStatusBar } = NS.statusBar;
  const { playSfx } = NS.audio;
  const {
    particles, shake, floatingText, addFlare, addDebris, addRing, updateFx, triggerFlash
  } = NS.fx;
  const { updateDrone, updateSpecialTimers } = NS.special;
  const { updateFallingPowerups, updateActivePowerups } = NS.powerups;
  const { updateBoss } = NS.boss;
  const { updateCombo } = NS.combat;
  const { moveAliens, updateDivers, updateFleet, moveAlienBullets, updateUfo } = NS.fleet;
  const { startNextLevel, startSurvivalNextWave } = NS.waves;
  const { finishStage, endRun } = NS.stages;
  const { updatePlayer, movePlayerBullets } = NS.player;
  const { resolveCollisions } = NS.collisions;

  function update(dt) {
    G.gameTime += dt;

    if (G.screenFlashAlpha > 0)
      G.screenFlashAlpha = Math.max(0, G.screenFlashAlpha - dt * 0.0012);

    if (G.fade > 0)
      G.fade = Math.max(0, G.fade - dt * 0.0035);
    if (G.sweep > 0)
      G.sweep = Math.max(0, G.sweep - dt / 1000);

    updateFx(dt);

    /* Hit-stop: the world keeps drawing and its effects keep moving, but the
       simulation itself holds for a beat so heavy impacts read as heavy */
    if (G.hitStop > 0) {
      G.hitStop = Math.max(0, G.hitStop - dt / 1000);
      particles.update();
      shake.update(dt);
      floatingText.update();
      return;
    }

    if (isMenuState(G.gameState) || G.gameState === 'gameover' || G.gameState === 'stageClear') {
      shake.update(dt);   // let a shake from the last fight die out on menus
      return;
    }

    if (G.gameState === 'paused')
      return;

    if (G.gameState === 'bossIntro') {
      updateBoss(dt);
      particles.update();
      return;
    }

    if (G.gameState === 'bossVictory') {
      updateBossVictory(dt);
      return;
    }

    if (G.gameState === 'dying') {
      updateDying(dt);
      return;
    }

    if (G.gameState === 'levelComplete') {
      updateLevelComplete(dt);
      return;
    }

    updatePlaying(dt);
  }

  /* Boss down: the explosion cascade plays out, then the level (or the stage) completes */
  function updateBossVictory(dt) {
    G.bossVictoryTimer -= dt;
    if (G.bossFinale > 0 && G.bossFinaleBox) {
      G.bossFinale -= dt / 1000;
      G.bossFinaleTick += dt / 1000;
      while (G.bossFinaleTick >= 0.12 && G.bossFinale > 0) {
        G.bossFinaleTick -= 0.12;
        const ox = G.bossFinaleBox.x + G.rand() * BOSS_W;
        const oy = G.bossFinaleBox.y + G.rand() * BOSS_H;
        addFlare(ox, oy, 'white', 100, 0.4);
        addDebris(ox, oy, 8, ['#f44', '#fa0', '#ff0', '#f0f']);
        addRing(ox, oy, '#ff8a3a', 6, 70, 0.3);
        particles.burst(ox, oy, 14, { speed: 4, color: '#fa0', gravity: 0.05, size: 3 });
      }
      if (G.bossFinale <= 0) {
        triggerFlash('#fff', 0.8);
        particles.confetti(G.bossFinaleBox.x + BOSS_W / 2, G.bossFinaleBox.y + BOSS_H / 2, 40);
        playSfx('explode', { pitch: 0.6 });
        G.bossFinaleBox = null;
      }
    }
    particles.update();
    floatingText.update();
    shake.update(dt);
    if (G.bossVictoryTimer <= 0) {
      const allDead = G.aliens.every(a => !a.alive);
      if (allDead) {
        if (G.gameMode === 'campaign') {
          finishStage();
        } else {
          G.gameState = 'levelComplete';
          G.levelCompleteTimer = 1500;
          G.sweep = 0.6;
          particles.confetti(GAME_W / 2, GAME_H / 2, 30);
        }
      } else
        G.gameState = 'playing';
    }
  }

  /* Ship lost: a slowed beat of the field, then respawn or game over */
  function updateDying(dt) {
    G.deathTimer -= dt;
    /* Slow motion: for the first beat after the crash the field keeps moving at 30 % */
    if (G.dyingSlow > 0) {
      G.dyingSlow = Math.max(0, G.dyingSlow - dt / 1000);
      for (let i = G.alienBullets.length - 1; i >= 0; --i) {
        const b = G.alienBullets[i];
        b.x += (b.vx || 0) * 0.3;
        b.y += (b.vy || ALIEN_BULLET_SPEED) * 0.3;
        if (b.y > GAME_H + 15 || b.x < -45 || b.x > GAME_W + 45)
          G.alienBullets.splice(i, 1);
      }
      G.alienMoveTimer += dt * 0.3;
      if (G.alienMoveTimer >= G.alienMoveInterval) {
        G.alienMoveTimer = 0;
        moveAliens();
      }
      updateDivers(dt * 0.3);
    }
    particles.update();
    shake.update(dt);
    floatingText.update();
    if (G.deathTimer <= 0) {
      if (G.lives <= 0) {
        G.gameState = 'gameover';
        G.menuCursor = 0;
        playSfx('lose');
        endRun();
        if (G.gameMode === 'classic' || G.gameMode === 'survival' || G.gameMode === 'bossRush')
          checkHighScore();
      } else {
        G.player.x = GAME_W / 2 - PLAYER_W / 2;
        G.player.alive = true;
        G.playerBullets = [];
        G.alienBullets = [];
        G.gameState = 'playing';
      }
    }
  }

  /* Level clear banner, then the next level or survival wave */
  function updateLevelComplete(dt) {
    G.levelCompleteTimer -= dt;
    particles.update();
    floatingText.update();
    if (G.levelCompleteTimer <= 0) {
      if (G.gameMode === 'survival')
        startSurvivalNextWave();
      else
        startNextLevel();
    }
  }

  /* One simulation step of the battle itself */
  function updatePlaying(dt) {
    const slowMoActive = G.activePowerups.slowMo > 0 || (G.specialActive > 0 && G.specialKind === 'phase');
    const alienDt = slowMoActive ? dt * 0.4 : dt;

    // Wave name fade
    if (G.waveNameTimer > 0)
      G.waveNameTimer -= dt;

    // Alien hit flash
    for (const a of G.aliens)
      if (a.flash > 0)
        a.flash = Math.max(0, a.flash - dt / 1000);

    updatePlayer(dt);

    movePlayerBullets();

    updateFleet(alienDt);

    moveAlienBullets(slowMoActive);

    // Divers
    updateDivers(slowMoActive ? dt * 0.4 : dt);

    updateUfo(dt);

    // Boss
    if (G.bossActive && G.gameState === 'playing')
      updateBoss(dt);

    // Drone
    updateDrone(dt);

    // Powerups
    updateFallingPowerups(dt);
    updateActivePowerups(dt);

    // Combo
    updateCombo(dt);

    updateSpecialTimers(dt);

    resolveCollisions();

    checkWaveCleared();

    // Boss level: if boss is active and all escorts dead, boss still fights alone
    // (boss defeat triggers bossVictory → levelComplete automatically)

    // Update effects
    particles.update();
    shake.update(dt);
    floatingText.update();

    updateStatusBar();
  }

  function checkWaveCleared() {
    // Level complete check
    const allAliensDead = G.aliens.every(a => !a.alive) && G.divers.length === 0;

    if (allAliensDead && G.gameState === 'playing' && !G.bossActive) {
      if (G.gameMode === 'campaign') {
        playSfx('levelup');
        finishStage();
      } else if (G.gameMode === 'survival') {
        G.gameState = 'levelComplete';
        G.levelCompleteTimer = 800;
        G.sweep = 0.6;
        particles.confetti(GAME_W / 2, GAME_H * 0.4, 20);
        playSfx('levelup');
      } else {
        G.gameState = 'levelComplete';
        G.levelCompleteTimer = 1500;
        G.sweep = 0.6;
        particles.confetti(GAME_W / 2, GAME_H * 0.4, 30);
        playSfx('levelup');
      }
    }
  }

  Object.assign(NS.sim, {
    update
  });
})();
