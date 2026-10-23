/* Enemy AI: the ghost phase cycle, tile-to-tile movement animation, the wander
   and chaser direction choices. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const E = NS.enemies = NS.enemies || {};

  /* ── Move Enemy AI ── */
  E.updateEnemy = function updateEnemy(enemy, dt) {
    if (!enemy.alive)
      return;

    // Decrement hit flash timer
    if (enemy.hitTimer > 0)
      enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);

    // Ghost phase cycle: solid 3s → phasing 2s → solid 3s → ...
    if (enemy.type === 'ghost') {
      enemy.phaseTimer += dt;
      if (!enemy.phasing) {
        if (enemy.phaseTimer >= 3) {
          enemy.phasing = true;
          enemy.phaseTimer = 0;
        }
      } else {
        if (enemy.phaseTimer >= 2) {
          enemy.phasing = false;
          enemy.phaseTimer = 0;
          // If ghost ended phase inside a wall, push to nearest open cell
          if (S.grid[enemy.row][enemy.col] !== C.EMPTY) {
            for (const d of C.DIRS) {
              const nc = enemy.col + d.dx;
              const nr = enemy.row + d.dy;
              if (nc >= 0 && nc < C.COLS && nr >= 0 && nr < C.ROWS && S.grid[nr][nc] === C.EMPTY) {
                enemy.col = nc;
                enemy.row = nr;
                enemy.x = nc * C.TILE_SIZE + C.TILE_SIZE / 2;
                enemy.y = nr * C.TILE_SIZE + C.TILE_SIZE / 2;
                break;
              }
            }
          }
        }
      }
    }

    // If moving between tiles, continue smooth animation
    if (enemy.moveProgress > 0) {
      enemy.moveProgress = Math.min(1, enemy.moveProgress + enemy.speed * dt);
      enemy.walkTimer += dt;
      if (enemy.walkTimer > 0.12) {
        enemy.walkTimer = 0;
        enemy.walkFrame = (enemy.walkFrame + 1) % 2;
      }
      const fromX = enemy.col * C.TILE_SIZE + C.TILE_SIZE / 2;
      const fromY = enemy.row * C.TILE_SIZE + C.TILE_SIZE / 2;
      const toX = enemy.targetCol * C.TILE_SIZE + C.TILE_SIZE / 2;
      const toY = enemy.targetRow * C.TILE_SIZE + C.TILE_SIZE / 2;
      // Smooth interpolation (lerp)
      enemy.x = fromX + (toX - fromX) * enemy.moveProgress;
      enemy.y = fromY + (toY - fromY) * enemy.moveProgress;

      if (enemy.moveProgress >= 1) {
        enemy.col = enemy.targetCol;
        enemy.row = enemy.targetRow;
        enemy.moveProgress = 0;
        enemy.x = enemy.col * C.TILE_SIZE + C.TILE_SIZE / 2;
        enemy.y = enemy.row * C.TILE_SIZE + C.TILE_SIZE / 2;
        enemy.walkFrame = 0;
      }
      return;
    }

    // Decide new direction — timer threshold varies by type
    enemy.moveTimer += dt;
    const threshold = enemy.type === 'chaser' ? 0.2 : 0.3;
    if (enemy.moveTimer < threshold)
      return;
    enemy.moveTimer = 0;

    // Build valid directions using per-type walkability
    const validDirs = [];
    for (const d of C.DIRS) {
      const nc = enemy.col + d.dx;
      const nr = enemy.row + d.dy;
      if (NS.arena.isEnemyWalkable(enemy, nc, nr) && !NS.arena.hasBombAt(nc, nr))
        validDirs.push(d);
    }

    if (validDirs.length === 0)
      return;

    let chosen;

    if (enemy.type === 'chaser') {
      // Chaser AI: prefer direction reducing Manhattan distance to player
      validDirs.sort((a, b) => {
        const distA = Math.abs(enemy.col + a.dx - S.player.col) + Math.abs(enemy.row + a.dy - S.player.row);
        const distB = Math.abs(enemy.col + b.dx - S.player.col) + Math.abs(enemy.row + b.dy - S.player.row);
        return distA - distB;
      });
      chosen = Math.random() < 0.7 ? validDirs[0] : validDirs[Math.floor(Math.random() * validDirs.length)];
    } else {
      // Wander AI (slow, normal, fast, tank, climber, ghost)
      chosen = validDirs[Math.floor(Math.random() * validDirs.length)];
      if (enemy.moveDir) {
        const sameDir = validDirs.find(d => d.dx === enemy.moveDir.dx && d.dy === enemy.moveDir.dy);
        if (sameDir && Math.random() < 0.6)
          chosen = sameDir;
      }
    }

    enemy.moveDir = chosen;
    enemy.targetCol = enemy.col + chosen.dx;
    enemy.targetRow = enemy.row + chosen.dy;
    enemy.moveProgress = 0.01;
    const newFacing = chosen.dy < 0 ? 1 : chosen.dy > 0 ? 0 : chosen.dx < 0 ? 2 : 3;
    if (newFacing !== enemy.facing)
      enemy.walkFrame = 0;
    enemy.facing = newFacing;
    enemy.walkTimer = 0;
  };
})();
