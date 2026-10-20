/* The bubble mechanic: shooting a bubble from the player, its shoot/float phases,
   trapping enemies on contact, drifting up with wobble and level flow, platform
   collisions, the bounce-and-pop interaction with the player, fruit drops on a pop,
   expiry and wall bounds. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;
  const { aabb } = NS.rules;

  /* ── Bubble shooting ── */
  function shootBubble() { if (S.state !== C.STATE_PLAYING || !S.player.alive) return;
    if (S.shootCooldown > 0) return;
    S.shootCooldown = 0.15;

    const dir = S.player.facingRight ? 1 : -1;
    const range = S.powerUpRange ? 1.5 : 1.0;
    const lifespan = Math.max(3, C.BUBBLE_LIFESPAN - S.currentLevel * 0.3);
    S.bubbles.push({
      x: S.player.x + (dir > 0 ? S.player.w : -12),
      y: S.player.y + 4,
      vx: C.BUBBLE_SPEED * dir * range,
      vy: 0,
      w: 16, h: 16,
      age: 0,
      maxAge: lifespan,
      phase: 'shoot', // shoot → float → pop
      phaseTimer: 0.3,
      trappedEnemy: null
    });
    SZ.GameAudio.play('shoot', { pitch: 1.6, volume: 0.6 });
  }

  function updateBubbles(dt) {
    for (let i = S.bubbles.length - 1; i >= 0; --i) {
      const b = S.bubbles[i];
      b.age += dt;

      if (b.phase === 'shoot') {
        b.x += b.vx * dt;
        b.phaseTimer -= dt;
        // Wobble while shooting
        b.y += Math.sin(b.age * 12) * 0.5;
        if (b.phaseTimer <= 0) {
          b.phase = 'float';
          b.vx = 0;
        }

        // Check bubble-enemy collision for trapping
        for (const enemy of S.enemies) {
          if (!enemy.alive || enemy.trapped) continue;
          if (aabb(b, enemy)) {
            // Trap enemy in bubble
            enemy.trapped = true;
            enemy.trapTimer = C.TRAP_ESCAPE_TIME;
            b.trappedEnemy = enemy;
            b.phase = 'float';
            b.vx = 0;
            V.particles.burst(enemy.x + 10, enemy.y + 10, 6, { color: '#44aaff', life: 0.3, speed: 30 });
            SZ.GameAudio.play('blip', { pitch: 0.75 });
          }
        }
      } else if (b.phase === 'float') {
        // Bubbles drift upward with wobble + level flow
        b.y += C.BUBBLE_FLOAT_SPEED * S.levelFlow.floatSpeed * dt;
        b.x += Math.sin(b.age * 3) * 0.8 + S.levelFlow.windX * dt;

        // Platform collision for floating bubbles
        for (const p of S.platforms) {
          if (b.x + b.w > p.x && b.x < p.x + p.w &&
              b.y < p.y + p.h && b.y + b.h > p.y) {
            // Hit from below: stop vertical movement, slide horizontally
            if (b.y + b.h > p.y && b.y < p.y) {
              b.y = p.y - b.h;
              b.x += (S.levelFlow.windX !== 0 ? Math.sign(S.levelFlow.windX) : (Math.random() < 0.5 ? 1 : -1)) * 30 * dt;
            } else {
              // Side collision: bounce away
              if (b.x + b.w / 2 < p.x + p.w / 2)
                b.x = p.x - b.w;
              else
                b.x = p.x + p.w;
            }
          }
        }

        // Move trapped enemy with bubble
        if (b.trappedEnemy) {
          b.trappedEnemy.x = b.x - 2;
          b.trappedEnemy.y = b.y - 2;
        }

        // Bubble interaction — bounce on top or pop
        if (aabb(S.player, b)) {
          const prevBottom = S.player.y + S.player.h - S.player.vy * dt;
          const jumpHeld = S.keysDown['ArrowUp'] || S.keysDown['w'];
          const landingFromAbove = S.player.vy >= 0 && prevBottom <= b.y + 6;

          // Bounce off bubble when landing from above with jump held
          if (landingFromAbove && jumpHeld) {
            S.player.vy = C.JUMP_FORCE * 0.85;
            S.player.y = b.y - S.player.h;
            S.player.grounded = false;
            S.player.isJumping = true;
            // Wobble the bubble downward briefly
            b.y += 4;
            V.particles.burst(b.x + 8, b.y, 4, { color: '#aaddff', life: 0.2, speed: 15 });
            SZ.GameAudio.play('bounce', { pitch: 1.3 });
            continue;
          }

          // Pop trapped bubble on contact (non-bounce)
          if (b.trappedEnemy) {
            const enemy = b.trappedEnemy;
            enemy.alive = false;
            enemy.trapped = false;
            S.score += C.POP_SCORE;

            // Pop particle burst
            V.particles.burst(b.x + 8, b.y + 8, 12, { color: '#66ddff', life: 0.5, speed: 50 });
            V.floatingText.add(b.x + 8, b.y - 10, '+' + C.POP_SCORE, { color: '#66ddff' });
            const now = performance.now();
            S.popCombo = now - S.lastPopTime < 1500 ? S.popCombo + 1 : 0;
            S.lastPopTime = now;
            SZ.GameAudio.play('pickup', { pitch: 1 + Math.min(S.popCombo, 6) * 0.12 });

            // Drop fruit item
            S.items.push({
              x: b.x, y: b.y,
              w: 14, h: 14,
              vy: 0,
              score: C.FRUIT_SCORE,
              type: 'fruit',
              age: 0
            });

            S.bubbles.splice(i, 1);
            continue;
          }
        }
      }

      // Bubble expire — pop
      if (b.age >= b.maxAge) {
        // If trapped enemy, it escapes
        if (b.trappedEnemy) {
          b.trappedEnemy.trapped = false;
          b.trappedEnemy.trapTimer = 0;
        }
        V.particles.burst(b.x + 8, b.y + 8, 4, { color: '#aaddff', life: 0.2, speed: 20 });
        SZ.GameAudio.play('click', { pitch: 0.6, volume: 0.5 });
        S.bubbles.splice(i, 1);
        continue;
      }

      // Wall bounds
      if (b.x < C.WALL_THICKNESS || b.x + b.w > C.CANVAS_W - C.WALL_THICKNESS || b.y < -20) {
        if (b.trappedEnemy) {
          b.trappedEnemy.trapped = false;
          b.trappedEnemy.trapTimer = 0;
        }
        S.bubbles.splice(i, 1);
      }
    }
  }

  Object.assign(NS.bubbles, { shootBubble, updateBubbles });
})();
