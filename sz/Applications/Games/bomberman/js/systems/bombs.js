/* Bombs: placement, detonation with the blast arms and chain explosions, the
   glove throw, the power-kick slide and the slide stepping. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const B = NS.bombs = NS.bombs || {};

  /* ── Place Bomb ── */
  B.placeBomb = function placeBomb() {
    if (S.state !== C.STATE_PLAYING)
      return;

    // Prevent placing on non-EMPTY cells (climb lets you walk on walls, but not plant)
    if (S.grid[S.player.row][S.player.col] !== C.EMPTY)
      return;

    // Remote detonation: at max bombs or bomb already here, detonate oldest
    if (S.hasRemote && (S.bombs.length >= S.maxBombs || NS.arena.hasBombAt(S.player.col, S.player.row))) {
      if (S.bombs.length > 0)
        B.detonateBomb(S.bombs[0]);
      return;
    }

    if (S.bombs.length >= S.maxBombs)
      return;
    if (NS.arena.hasBombAt(S.player.col, S.player.row))
      return;

    S.bombs.push({
      col: S.player.col,
      row: S.player.row,
      fuse: C.BOMB_TIME,
      blastRange: S.blastRange,
      sliding: false,
      slideDx: 0,
      slideDy: 0,
      slideProgress: 0
    });
    SZ.GameAudio.play('drop', { volume: 0.7 });
  };

  /* ── Detonate Bomb ── */
  B.detonateBomb = function detonateBomb(bomb) {
    const idx = S.bombs.indexOf(bomb);
    if (idx === -1)
      return;
    S.bombs.splice(idx, 1);

    const cx = bomb.col * C.TILE_SIZE + C.TILE_SIZE / 2;
    const cy = bomb.row * C.TILE_SIZE + C.TILE_SIZE / 2;

    SZ.GameAudio.play('explode', { pitch: 1.15 - Math.min(bomb.blastRange, 6) * 0.05 });

    // Center fire cell
    S.fireCells.push({ col: bomb.col, row: bomb.row, timer: C.FIRE_DURATION, isCenter: true });

    // Primary burst: orange/red circles
    D.particles.burst(cx, cy, 15, { color: '#ff4500', speed: 5, life: 0.6, size: 3, decay: 0.02, gravity: 0.05 });
    // Secondary burst: yellow star-shaped sparks
    D.particles.sparkle(cx, cy, 10, { color: '#ffd700', speed: 4, life: 0.5 });
    // Debris: brown square confetti with gravity
    D.particles.confetti(cx, cy, 6, { colors: ['#8b4513', '#a0522d', '#cd853f'], speed: 3, gravity: 0.12 });

    // Spread in cardinal directions
    for (const dir of C.DIRS) {
      for (let i = 1; i <= bomb.blastRange; ++i) {
        const fc = bomb.col + dir.dx * i;
        const fr = bomb.row + dir.dy * i;

        if (fc < 0 || fc >= C.COLS || fr < 0 || fr >= C.ROWS)
          break;

        const cell = S.grid[fr][fc];

        // Indestructible wall: stop, blocked
        if (cell === C.WALL)
          break;

        const fx = fc * C.TILE_SIZE + C.TILE_SIZE / 2;
        const fy = fr * C.TILE_SIZE + C.TILE_SIZE / 2;

        // Destructible wall: destroy breakable wall and stop
        if (cell === C.DESTRUCTIBLE) {
          S.grid[fr][fc] = C.EMPTY;
          S.fireCells.push({ col: fc, row: fr, timer: C.FIRE_DURATION, dirX: dir.dx, dirY: dir.dy, isEnd: true });

          // Enhanced wall destruction: confetti debris with gravity + rotation
          D.particles.confetti(fx, fy, 8, { colors: ['#8b4513', '#a0522d', '#cd853f', '#d2b48c'], speed: 4, gravity: 0.15 });
          D.particles.burst(fx, fy, 6, { color: '#a0522d', speed: 3, life: 0.4, size: 2, decay: 0.03 });
          SZ.GameAudio.play('smallExplode', { volume: 0.6 });

          // Reveal hidden power-up from destroyed wall
          const key = fr + ',' + fc;
          if (S.hiddenPowerUps[key]) {
            S.powerUps.push({ col: fc, row: fr, type: S.hiddenPowerUps[key] });
            delete S.hiddenPowerUps[key];
          }
          break; // Explosion stops at destructible wall
        }

        // Empty: add fire cell
        S.fireCells.push({ col: fc, row: fr, timer: C.FIRE_DURATION, dirX: dir.dx, dirY: dir.dy, isEnd: i === bomb.blastRange });

        // Directional sparkle at each fire cell
        D.particles.sparkle(fx, fy, 3, {
          color: '#ff9f43',
          speed: 2,
          vx: dir.dx * 2,
          vy: dir.dy * 2
        });

        // Trail particle along explosion arm
        D.particles.trail(fx, fy, {
          color: '#ff6600',
          vx: dir.dx * 1.5,
          vy: dir.dy * 1.5,
          life: 0.3,
          size: 2
        });

        // Chain explosion: trigger adjacent bomb if fire hits another bomb
        for (const otherBomb of S.bombs) {
          if (otherBomb.col === fc && otherBomb.row === fr) {
            B.detonateBomb(otherBomb);
            D.screenShake.trigger(8, 300);
            break;
          }
        }
      }
    }

    // Screen shake scaled by blast range
    D.screenShake.trigger(3 + bomb.blastRange, 150 + bomb.blastRange * 30);
  };

  /* ── Throw Bomb (Glove) ── */
  B.throwBomb = function throwBomb(col, row) {
    const bomb = S.bombs.find(b => b.col === col && b.row === row);
    if (!bomb)
      return;

    // Pick random cardinal direction and range 3-5
    const dir = C.DIRS[Math.floor(Math.random() * C.DIRS.length)];
    const range = 3 + Math.floor(Math.random() * 3);

    let landCol = col;
    let landRow = row;
    // Fly over all cells (even walls)
    for (let i = 1; i <= range; ++i) {
      const nc = col + dir.dx * i;
      const nr = row + dir.dy * i;
      if (nc < 1 || nc >= C.COLS - 1 || nr < 1 || nr >= C.ROWS - 1)
        break;
      landCol = nc;
      landRow = nr;
    }

    // If landing on indestructible WALL, back up to last non-WALL cell
    while (S.grid[landRow][landCol] === C.WALL && (landCol !== col || landRow !== row)) {
      landCol -= dir.dx;
      landRow -= dir.dy;
    }

    bomb.col = landCol;
    bomb.row = landRow;

    // Particle burst at landing spot
    const lx = landCol * C.TILE_SIZE + C.TILE_SIZE / 2;
    const ly = landRow * C.TILE_SIZE + C.TILE_SIZE / 2;
    D.particles.burst(lx, ly, 10, { color: '#ff69b4', speed: 4, life: 0.5, size: 3, decay: 0.03 });
    SZ.GameAudio.play('whoosh');
  };

  /* ── Slide Bomb (Power Kick) ── */
  B.slideBomb = function slideBomb(col, row, dx, dy) {
    const bomb = S.bombs.find(b => b.col === col && b.row === row);
    if (!bomb || bomb.sliding)
      return;
    bomb.sliding = true;
    bomb.slideDx = dx;
    bomb.slideDy = dy;
    bomb.slideProgress = 0;
    SZ.GameAudio.play('whoosh', { pitch: 0.8 });
  };

  /* ── Update Sliding Bombs ── */
  B.updateSlidingBombs = function updateSlidingBombs(dt) {
    for (const bomb of S.bombs) {
      if (!bomb.sliding)
        continue;

      bomb.slideProgress += C.BOMB_SLIDE_SPEED * dt;
      if (bomb.slideProgress >= 1) {
        bomb.slideProgress = 0;
        const nextCol = bomb.col + bomb.slideDx;
        const nextRow = bomb.row + bomb.slideDy;

        // Stop if wall/bomb/bounds
        if (!NS.arena.isWalkable(nextCol, nextRow) || NS.arena.hasBombAt(nextCol, nextRow)) {
          bomb.sliding = false;
          bomb.slideDx = 0;
          bomb.slideDy = 0;
          bomb.slideProgress = 0;
          // Dust particles on stop
          const sx = bomb.col * C.TILE_SIZE + C.TILE_SIZE / 2;
          const sy = bomb.row * C.TILE_SIZE + C.TILE_SIZE / 2;
          D.particles.burst(sx, sy, 6, { color: '#aaa', speed: 2, life: 0.3, size: 2, decay: 0.04, gravity: 0.05 });
          SZ.GameAudio.play('thud', { volume: 0.6 });
          continue;
        }

        // Stop if hitting an enemy
        let hitEnemy = false;
        for (const e of S.enemies)
          if (e.alive && e.col === nextCol && e.row === nextRow) {
            hitEnemy = true;
            break;
          }

        if (hitEnemy) {
          bomb.sliding = false;
          bomb.slideDx = 0;
          bomb.slideDy = 0;
          bomb.slideProgress = 0;
          const sx = bomb.col * C.TILE_SIZE + C.TILE_SIZE / 2;
          const sy = bomb.row * C.TILE_SIZE + C.TILE_SIZE / 2;
          D.particles.burst(sx, sy, 6, { color: '#aaa', speed: 2, life: 0.3, size: 2, decay: 0.04, gravity: 0.05 });
          SZ.GameAudio.play('thud', { volume: 0.6 });
          continue;
        }

        // Move to next cell
        bomb.col = nextCol;
        bomb.row = nextRow;
      }
    }
  };
})();
