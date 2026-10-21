/* The game flow: the new-game reset, death with its shake and high-score commit, and
   the per-frame update — speed ramp, distance, tier change, lane/jump/slide timers,
   power-up timers, spawning, scrolling, collisions and effects. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const sfx = V.sfx;

  /* ── Reset ── */
  function resetGame() {
    S.state = C.STATE_READY;
    S.distance = 0;
    S.score = 0;
    S.coinCount = 0;
    S.currentSpeed = C.BASE_SPEED;
    S.targetLane = 1;
    S.currentLane = 1;
    S.laneTransitionTimer = 0;
    S.previousLane = 1;
    S.transitionStartX = NS.rules.laneX(1);
    S.isJumping = false;
    S.jumpTimer = 0;
    S.isSliding = false;
    S.slideTimer = 0;
    S.obstacles = [];
    S.coins = [];
    S.powerUps = [];
    S.speedLines = [];
    S.lastSpawnZ = 0;
    S.magnetTimer = 0;
    S.shieldTimer = 0;
    S.multiplierTimer = 0;
    S.coinStreak = 0;
    S.lastTierName = '';
    S.roadOffset = 0;
    S.skylineOffset = 0;
    S.dustPuffs = [];
    V.particles.clear();
    V.floatingText.clear();
    NS.status.updateStatus();
    SZ.Dlls.User32.SetWindowText('Endless Runner');
  }

  /* ── Die ── */
  function die() {
    S.state = C.STATE_DEAD;
    // death shake
    V.screenShake.trigger(8, 400);
    sfx.play('hurt');
    sfx.play('lose', { volume: 0.8 });
    V.particles.burst(NS.rules.getPlayerX(), NS.rules.getPlayerY(), 20, { color: '#f44', speed: 5, life: 0.8, size: 3, decay: 0.02 });
    NS.highscores.addHighScore(Math.floor(S.distance), S.coinCount);
    NS.status.updateStatus();
  }

  /* ── Update ── */
  function update(dt) {
    if (S.state === C.STATE_READY || S.state === C.STATE_PAUSED || S.state === C.STATE_DEAD) {
      V.screenShake.update(dt * 1000);
      V.particles.update();
      V.floatingText.update();
      return;
    }

    if (S.state !== C.STATE_RUNNING)
      return;

    // Speed ramp
    S.currentSpeed = Math.min(C.MAX_SPEED, S.currentSpeed + C.SPEED_ACCELERATION * dt);

    // Distance
    const mult = S.multiplierTimer > 0 ? 2 : 1;
    S.distance += S.currentSpeed * dt;
    S.score += S.currentSpeed * dt * mult;

    const tierName = NS.rules.getCurrentTier().name;
    if (tierName !== S.lastTierName) {
      if (S.lastTierName)
        sfx.play('levelup');
      S.lastTierName = tierName;
    }

    // Lane transition
    if (S.laneTransitionTimer > 0) {
      S.laneTransitionTimer -= dt;
      if (S.laneTransitionTimer <= 0) {
        S.laneTransitionTimer = 0;
        S.currentLane = S.targetLane;
      }
    }

    // Jump
    if (S.isJumping) {
      S.jumpTimer += dt;
      if (S.jumpTimer >= C.JUMP_DURATION) {
        S.isJumping = false;
        S.jumpTimer = 0;
        sfx.play('thud', { volume: 0.4 });
      }
    }

    // Slide
    if (S.isSliding) {
      S.slideTimer += dt;
      if (S.slideTimer >= C.SLIDE_DURATION) {
        S.isSliding = false;
        S.slideTimer = 0;
      }
    }

    // Power-up timers
    if (S.magnetTimer > 0)
      S.magnetTimer = Math.max(0, S.magnetTimer - dt);
    if (S.shieldTimer > 0)
      S.shieldTimer = Math.max(0, S.shieldTimer - dt);
    if (S.multiplierTimer > 0)
      S.multiplierTimer = Math.max(0, S.multiplierTimer - dt);

    // Spawn obstacles/coins/power-ups
    const spawnDist = S.distance;
    while (S.lastSpawnZ < spawnDist) {
      S.lastSpawnZ += C.OBSTACLE_MIN_GAP + Math.random() * C.OBSTACLE_SPAWN_RANGE;
      NS.spawn.spawnObstacle(C.SPAWN_Y);
      NS.spawn.spawnCoin(C.SPAWN_Y + Math.random() * 80 - 40);
      NS.spawn.spawnPowerUp(C.SPAWN_Y + Math.random() * 40 - 20);
    }

    // Move entities downward
    const dy = S.currentSpeed * C.SCROLL_FACTOR * dt;
    for (const obs of S.obstacles)
      obs.y += dy;
    for (const coin of S.coins)
      coin.y += dy;
    for (const pu of S.powerUps)
      pu.y += dy;

    // Remove off-screen entities
    S.obstacles = S.obstacles.filter(o => o.y < C.CANVAS_H + 60);
    S.coins = S.coins.filter(c => c.y < C.CANVAS_H + 60 && !c.collected);
    S.powerUps = S.powerUps.filter(p => p.y < C.CANVAS_H + 60 && !p.collected);

    // Collision
    NS.collision.checkCoinCollect();
    NS.collision.checkPowerUpCollect();
    if (NS.collision.checkCollisions())
      die();

    // Speed lines
    NS.spawn.spawnSpeedLine();
    for (const sl of S.speedLines)
      sl.y += sl.speed * dt;
    S.speedLines = S.speedLines.filter(sl => sl.y < C.CANVAS_H + 50);

    // Road scroll
    S.roadOffset = (S.roadOffset + S.currentSpeed * dt * 20) % 40;

    // Skyline parallax scroll (much slower than road)
    S.skylineOffset += S.currentSpeed * dt * 2;

    // Dust puffs
    if (!S.isJumping && !S.isSliding && S.state === C.STATE_RUNNING) {
      const legAngle = Math.sin(Date.now() / 80) * 0.4;
      if (Math.abs(legAngle) > 0.2 && Math.random() > 0.5) {
        const dpx = NS.rules.getPlayerX();
        S.dustPuffs.push({ x: dpx + (Math.random() - 0.5) * 10, y: C.LANE_Y_BOTTOM + 2, alpha: 0.6, radius: 2 + Math.random() * 3 });
      }
    }
    for (let i = S.dustPuffs.length - 1; i >= 0; --i) {
      S.dustPuffs[i].alpha -= 0.03;
      S.dustPuffs[i].radius += 0.3;
      S.dustPuffs[i].y += 0.2;
      if (S.dustPuffs[i].alpha <= 0)
        S.dustPuffs.splice(i, 1);
    }

    // Effects
    V.particles.update();
    V.floatingText.update();
    V.screenShake.update(dt * 1000);
    NS.status.updateStatus();
  }

  NS.flow.resetGame = resetGame;
  NS.flow.die = die;
  NS.flow.update = update;
})();
