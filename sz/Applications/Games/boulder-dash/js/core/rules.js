/* The grid simulation: player movement & digging, boulder physics with fall and slide
   animations, the wall-following enemy AI, the level timer and the update step that
   ties them together, plus the easing and tile-geometry helpers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Player movement & digging ── */
  function tryMovePlayer(dx, dy) {
    if (S.state !== C.STATE_PLAYING || !S.player.alive) return;
    if (S.player.moveProgress < 1) return;

    const nc = S.player.col + dx;
    const nr = S.player.row + dy;

    if (nc < 0 || nc >= C.COLS || nr < 0 || nr >= C.ROWS) return;

    const cell = S.grid[nr][nc];

    // Wall — blocked
    if (cell === C.WALL) return;

    // Boulder — push horizontally only
    if (cell === C.BOULDER) {
      if (dy !== 0) return; // cannot push boulders vertically
      const behindCol = nc + dx;
      if (behindCol < 0 || behindCol >= C.COLS) return;
      if (S.grid[nr][behindCol] !== C.EMPTY) return;
      // Push boulder sideways into empty space (with slide animation)
      S.grid[nr][behindCol] = C.BOULDER;
      S.grid[nr][nc] = C.EMPTY;
      S.slidingBoulders.set(nr * C.COLS + behindCol, { slideProgress: 0, fromCol: nc });
      V.particles.burst(tileX(behindCol), tileY(nr), 4, { color: '#a0a0a0', life: 0.3, speed: 30 });
      SZ.GameAudio.play('thud', { pitch: 1.4, volume: 0.5 });
    }

    // Dig through dirt (with fade-out animation)
    if (cell === C.DIRT) {
      S.grid[nr][nc] = C.EMPTY;
      S.fadingCells.push({ col: nc, row: nr, type: C.DIRT, alpha: 1 });
      V.particles.burst(tileX(nc), tileY(nr), 6, { color: '#8B4513', life: 0.4, speed: 40 }); // dig dirt particle
      SZ.GameAudio.play('click', { pitch: 0.35, volume: 0.5 });
    }

    // Gem collection (with pop animation)
    if (cell === C.GEM) {
      S.grid[nr][nc] = C.EMPTY;
      S.fadingCells.push({ col: nc, row: nr, type: C.GEM, alpha: 1 });
      ++S.gemsCollected;
      S.score += C.GEM_SCORE;
      // Gem sparkle particles
      V.particles.sparkle(tileX(nc), tileY(nr), 10, { color: '#00ffff', life: 0.6 });
      V.floatingText.add(tileX(nc), nr * C.TILE_SIZE, '+' + C.GEM_SCORE, { color: '#00ffff' });
      SZ.GameAudio.play('pickup', { pitch: 1 + Math.min(1, S.gemsCollected / S.gemsRequired) * 0.5 });
      // Check exit unlock
      if (S.gemsCollected >= S.gemsRequired && !S.exitOpen) {
        S.exitOpen = true;
        S.grid[S.exitRow][S.exitCol] = C.EXIT;
        V.particles.sparkle(tileX(S.exitCol), tileY(S.exitRow), 15, { color: '#ffd700', life: 1.0 });
        SZ.GameAudio.play('powerup');
      }
    }

    // Exit — level complete
    if (cell === C.EXIT && S.exitOpen) {
      NS.game.levelComplete();
      return;
    }

    // Start smooth movement
    S.player.targetCol = nc;
    S.player.targetRow = nr;
    S.player.moveProgress = 0;
  }

  /* ── Boulder physics ── */
  function updateBoulderPhysics(dt) {
    // Scan bottom-up so boulders settle properly
    for (let r = C.ROWS - 2; r >= 1; --r) {
      for (let c = 1; c < C.COLS - 1; ++c) {
        if (S.grid[r][c] !== C.BOULDER) continue;

        const below = S.grid[r + 1][c];
        const key = r * C.COLS + c;

        // Can fall straight down
        if (below === C.EMPTY) {
          S.grid[r][c] = C.EMPTY;
          S.grid[r + 1][c] = C.BOULDER;
          S.fallingBoulders.set((r + 1) * C.COLS + c, { fallProgress: 0, fromRow: r });
          S.fallingBoulders.delete(key);

          // Check if boulder crushes player
          if (S.player.col === c && S.player.row === r + 1)
            NS.game.playerDeath();

          // Check if boulder crushes enemy
          for (const enemy of S.enemies) {
            if (enemy.alive && enemy.col === c && enemy.row === r + 1) {
              enemy.alive = false;
              S.score += C.ENEMY_KILL_SCORE;
              V.particles.burst(tileX(c), tileY(r + 1), 12, { color: '#ff4444', life: 0.5, speed: 60 });
              V.floatingText.add(tileX(c), (r + 1) * C.TILE_SIZE, '+' + C.ENEMY_KILL_SCORE, { color: '#ff4444' });
              V.screenShake.trigger(3, 0.15);
              SZ.GameAudio.play('smallExplode');
            }
          }
          continue;
        }

        // Boulder sliding off rounded objects (other boulders or gems)
        if (below === C.BOULDER || below === C.GEM) {
          const sides = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (const side of sides) {
            const sc = c + side;
            if (sc < 1 || sc >= C.COLS - 1) continue;
            if (S.grid[r][sc] === C.EMPTY && S.grid[r + 1][sc] === C.EMPTY) {
              S.grid[r][c] = C.EMPTY;
              S.grid[r][sc] = C.BOULDER;
              S.fallingBoulders.delete(key);
              S.slidingBoulders.set(r * C.COLS + sc, { slideProgress: 0, fromCol: c });
              break;
            }
          }
        }

        // Landing — was falling, now settled (dt-based)
        if (S.fallingBoulders.has(key)) {
          const fb = S.fallingBoulders.get(key);
          fb.fallProgress += dt * C.FALL_ANIM_SPEED;
          if (fb.fallProgress >= 1) {
            S.fallingBoulders.delete(key);
            V.particles.burst(tileX(c), (r + 1) * C.TILE_SIZE, 5, { color: '#aa8866', life: 0.3, speed: 25 }); // boulder dust landing
            V.screenShake.trigger(2, 0.1);
            const now = performance.now();
            if (now - S.lastBoulderThud > 150) {
              S.lastBoulderThud = now;
              SZ.GameAudio.play('thud', { volume: 0.6 });
            }
          }
        }
      }
    }

    // Update sliding boulders (dt-based)
    for (const [skey, sb] of S.slidingBoulders) {
      sb.slideProgress += dt * C.SLIDE_ANIM_SPEED;
      if (sb.slideProgress >= 1)
        S.slidingBoulders.delete(skey);
    }
  }

  /* ── Enemy movement AI ── */
  function updateEnemies(dt) {
    const dirVecs = [
      { dx: 0, dy: -1 }, { dx: 1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: -1, dy: 0 }
    ];

    for (const enemy of S.enemies) {
      if (!enemy.alive) continue;

      if (enemy.moveProgress < 1) {
        enemy.moveProgress = Math.min(1, enemy.moveProgress + dt * C.MOVE_SPEED * 0.5);
        if (enemy.moveProgress >= 1) {
          enemy.col = enemy.targetCol;
          enemy.row = enemy.targetRow;
        }
        continue;
      }

      enemy.moveTimer += dt;
      if (enemy.moveTimer < 0.15) continue;
      enemy.moveTimer = 0;

      // Wall-following AI: try to turn left, else go straight, else turn right, else reverse
      const tryDirs = [
        (enemy.direction + 3) % 4,
        enemy.direction,
        (enemy.direction + 1) % 4,
        (enemy.direction + 2) % 4
      ];

      let moved = false;
      for (const d of tryDirs) {
        const dir = dirVecs[d];
        const nc = enemy.col + dir.dx;
        const nr = enemy.row + dir.dy;
        if (nc < 1 || nc >= C.COLS - 1 || nr < 1 || nr >= C.ROWS - 1) continue;
        if (S.grid[nr][nc] !== C.EMPTY && S.grid[nr][nc] !== C.EXIT) continue;
        enemy.direction = d;
        enemy.targetCol = nc;
        enemy.targetRow = nr;
        enemy.moveProgress = 0;
        moved = true;
        break;
      }
      if (!moved)
        enemy.direction = (enemy.direction + 2) % 4;

      // Check enemy-player collision
      if (enemy.col === S.player.col && enemy.row === S.player.row)
        NS.game.playerDeath();
    }
  }

  /* ── Time management ── */
  function updateTimer(dt) {
    if (S.state !== C.STATE_PLAYING) return;
    S.timeLeft -= dt;
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      // Time expired — player dies
      NS.game.playerDeath();
    }
  }

  /* ── Update loop ── */
  function update(dt) {
    if (S.state !== C.STATE_PLAYING) return;
    if (!S.player.alive) return;

    // Update player smooth movement
    if (S.player.moveProgress < 1) {
      S.player.moveProgress = Math.min(1, S.player.moveProgress + dt * C.MOVE_SPEED);
      if (S.player.moveProgress >= 1) {
        S.player.col = S.player.targetCol;
        S.player.row = S.player.targetRow;

        // Re-check enemy collision after move complete
        for (const enemy of S.enemies) {
          if (enemy.alive && enemy.col === S.player.col && enemy.row === S.player.row)
            NS.game.playerDeath();
        }
      }
    }

    // Process queued movement
    if (S.player.moveProgress >= 1 && S.moveQueue) {
      tryMovePlayer(S.moveQueue.dx, S.moveQueue.dy);
      S.moveQueue = null;
    }

    // Handle held keys
    if (S.player.moveProgress >= 1) {
      let moved = false;
      for (const key in S.keysDown) {
        if (S.keysDown[key] && C.DIRS[key]) {
          tryMovePlayer(C.DIRS[key].dx, C.DIRS[key].dy);
          moved = true;
          break;
        }
      }
      /* Mouse held: keep moving toward target tile */
      if (!moved)
        NS.input.mouseMoveToward();
    }

    updateBoulderPhysics(dt);
    updateEnemies(dt);
    updateTimer(dt);

    // Update fading cells
    for (let i = S.fadingCells.length - 1; i >= 0; --i) {
      S.fadingCells[i].alpha -= dt * C.FADE_SPEED;
      if (S.fadingCells[i].alpha <= 0)
        S.fadingCells.splice(i, 1);
    }

    V.particles.update(dt);
    V.screenShake.update(dt);
    V.floatingText.update(dt);
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  function easeOut(t) {
    const c = Math.min(1, Math.max(0, t));
    return c * (2 - c);
  }

  function tileX(c) { return c * C.TILE_SIZE + C.HALF_TILE; }
  function tileY(r) { return r * C.TILE_SIZE + C.HALF_TILE; }

  Object.assign(NS.rules, { tryMovePlayer, update, lerp, easeOut, tileX, tileY });
})();
