/* The player: movement, jumping, gravity and platform landing, screen wrap and wall
   clamp, animation, firing, enemy-contact death, power-up and fruit collection, the
   respawn-after-death timer and the death bookkeeping (lives, game over, high score). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { aabb, landOnPlatform } = NS.rules;

  function updatePlayer(dt) {
    if (!S.player.alive) {
      S.player.invincible -= dt;
      if (S.player.invincible <= 0) {
        S.player.alive = true;
        S.player.x = 32;
        S.player.y = 384;
        S.player.vx = 0;
        S.player.vy = 0;
        S.player.invincible = 2;
      }
      return;
    }

    S.player.invincible -= dt;
    const speed = S.powerUpSpeed ? C.PLAYER_SPEED * 1.5 : C.PLAYER_SPEED;

    // Horizontal movement
    S.player.vx = 0;
    if (S.keysDown['ArrowLeft'] || S.keysDown['a']) {
      S.player.vx = -speed;
      S.player.facingRight = false;
    }
    if (S.keysDown['ArrowRight'] || S.keysDown['d']) {
      S.player.vx = speed;
      S.player.facingRight = true;
    }

    // Jump
    if ((S.keysDown['ArrowUp'] || S.keysDown['w']) && S.player.grounded) {
      S.player.vy = C.JUMP_FORCE;
      S.player.isJumping = true;
      S.player.grounded = false;
      SZ.GameAudio.play('jump');
    }

    // Gravity
    S.player.vy += C.GRAVITY * dt;
    S.player.x += S.player.vx * dt;
    S.player.y += S.player.vy * dt;

    // Platform collision
    landOnPlatform(S.player, dt);

    // Screen wrap: fall through bottom → respawn at top
    if (S.player.y > C.CANVAS_H) {
      S.player.y = -S.player.h;
    }

    // Wall clamp
    if (S.player.x < C.WALL_THICKNESS) S.player.x = C.WALL_THICKNESS;
    if (S.player.x + S.player.w > C.CANVAS_W - C.WALL_THICKNESS) S.player.x = C.CANVAS_W - C.WALL_THICKNESS - S.player.w;

    // Animation
    S.player.animTimer += dt;
    if (S.player.animTimer > 0.15) {
      S.player.animTimer = 0;
      S.player.animFrame = (S.player.animFrame + 1) % 4;
    }

    // Fire key
    if (S.keysDown[' '] || S.keysDown['z'] || S.keysDown['x'])
      NS.bubbles.shootBubble();

    // Check enemy-player collision (untrapped enemies)
    for (const enemy of S.enemies) {
      if (!enemy.alive || enemy.trapped) continue;
      if (aabb(S.player, enemy) && S.player.invincible <= 0)
        playerDeath();
    }

    // Collect power-ups
    for (const pu of S.powerUps) {
      if (!pu.active) continue;
      if (aabb(S.player, pu)) {
        pu.active = false;
        // Power-up sparkle effect
        V.particles.sparkle(pu.x + 8, pu.y + 8, 10, { color: '#ffd700', life: 0.5 });
        if (pu.type === 'speed') S.powerUpSpeed = true;
        if (pu.type === 'range') S.powerUpRange = true;
        S.powerUpTimer = 10;
        V.floatingText.add(pu.x, pu.y - 10, 'POWER UP!', { color: '#ffd700' });
        SZ.GameAudio.play('powerup');
      }
    }

    // Collect fruit items for bonus score
    for (let i = S.items.length - 1; i >= 0; --i) {
      if (aabb(S.player, S.items[i])) {
        const item = S.items[i];
        S.score += item.score;
        V.floatingText.add(item.x, item.y - 10, '+' + item.score, { color: '#ff9900' });
        V.particles.sparkle(item.x + 8, item.y + 8, 6, { color: '#ff9900', life: 0.4 });
        SZ.GameAudio.play('coin');
        S.items.splice(i, 1);
      }
    }
  }

  /* ── Player death ── */
  function playerDeath() {
    if (!S.player.alive || S.player.invincible > 0) return;
    S.player.alive = false;
    --S.lives;

    V.particles.burst(S.player.x + 12, S.player.y + 12, 20, { color: '#ff2200', life: 0.8, speed: 80 });
    V.screenShake.trigger(6, 0.3);

    if (S.lives <= 0) {
      S.state = C.STATE_DEAD;
      NS.highscores.addHighScore(S.score, S.currentLevel);
      NS.app.updateTitle();
      SZ.GameAudio.play('lose');
    } else {
      S.player.invincible = 1.5;
      SZ.GameAudio.play('hurt');
    }
  }

  function resetPlayerPosition() {
    S.player.x = 32;
    S.player.y = 384;
    S.player.vx = 0;
    S.player.vy = 0;
    S.player.alive = true;
  }

  Object.assign(NS.player, { updatePlayer, playerDeath, resetPlayerPosition });
})();
