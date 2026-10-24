;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.pacman.movePacman = function movePacman(dt) {
    if (!S.pacman.moving && S.pacman.nextDir !== C.DIR_NONE)
      S.pacman.dir = S.pacman.nextDir;

    /* Check if queued direction is now possible */
    if (S.pacman.nextDir !== S.pacman.dir && NS.movement.isCentered(S.pacman)) {
      if (NS.movement.canMove(S.pacman.tileX, S.pacman.tileY, S.pacman.nextDir, false) || S.pacmanPhasing) {
        S.pacman.dir = S.pacman.nextDir;
        NS.movement.snapToCenter(S.pacman);
      }
    }

    /* Check if current direction is possible */
    if (NS.movement.isCentered(S.pacman) && !NS.movement.canMove(S.pacman.tileX, S.pacman.tileY, S.pacman.dir, false)) {
      if (!S.pacmanPhasing) {
        NS.movement.snapToCenter(S.pacman);
        S.pacman.moving = false;
        return;
      }
    }

    S.pacman.moving = true;

    let spdMult = 1;
    if (S.pacmanSlowed)
      spdMult *= 0.5;
    const spd = S.pacman.speed * spdMult * (60 * dt);
    S.pacman.x += C.DX[S.pacman.dir] * spd;
    S.pacman.y += C.DY[S.pacman.dir] * spd;

    /* Tunnel wrap */
    if (S.pacman.x < -C.TILE / 2)
      S.pacman.x += C.COLS * C.TILE;
    else if (S.pacman.x >= C.COLS * C.TILE + C.TILE / 2)
      S.pacman.x -= C.COLS * C.TILE;

    /* Update tile position */
    const tile = NS.movement.getTile(S.pacman.x, S.pacman.y);
    S.pacman.tileX = NS.maze.wrapX(tile.x);
    S.pacman.tileY = Math.max(0, Math.min(C.ROWS - 1, tile.y));

    /* Snap at center of next tile */
    const cx = S.pacman.tileX * C.TILE + C.TILE / 2;
    const cy = S.pacman.tileY * C.TILE + C.TILE / 2;
    const prevX = S.pacman.x - C.DX[S.pacman.dir] * spd;
    const prevY = S.pacman.y - C.DY[S.pacman.dir] * spd;

    if (C.DX[S.pacman.dir] !== 0) {
      if ((prevX - cx) * (S.pacman.x - cx) <= 0)
        S.pacman.y = cy;
    }
    if (C.DY[S.pacman.dir] !== 0) {
      if ((prevY - cy) * (S.pacman.y - cy) <= 0)
        S.pacman.x = cx;
    }

    /* Animate mouth */
    if (S.pacman.mouthOpening)
      S.pacman.mouthAngle += 5 * (60 * dt);
    else
      S.pacman.mouthAngle -= 5 * (60 * dt);

    if (S.pacman.mouthAngle >= 45)
      S.pacman.mouthOpening = false;
    if (S.pacman.mouthAngle <= 2)
      S.pacman.mouthOpening = true;

    S.pacman.mouthAngle = Math.max(0, Math.min(45, S.pacman.mouthAngle));

    /* Trail E.particles */
    if (S.pacman.moving) {
      ++S.trailCounter;
      if (S.trailCounter % C.TRAIL_INTERVAL === 0)
        E.particles.trail(S.pacman.x, S.pacman.y, { color: '#FFD700', size: 1.5, life: 0.3, decay: 0.04, shrink: 0.93 });
    }
  }

  /* ================================================================
   *  MAGNET PULL
   * ================================================================ */

  NS.pacman.magnetPull = function magnetPull() {
    let ate = false;
    for (let dy = -3; dy <= 3; ++dy)
      for (let dx = -3; dx <= 3; ++dx) {
        if (Math.abs(dx) + Math.abs(dy) > 3)
          continue;
        const tx = S.pacman.tileX + dx;
        const ty = S.pacman.tileY + dy;
        if (ty >= 0 && ty < C.ROWS && tx >= 0 && tx < C.COLS) {
          if (S.maze[ty][tx] === C.T_DOT) {
            S.maze[ty][tx] = C.T_EMPTY;
            S.score += 10 * S.scoreMultiplier;
            ++S.dotsEaten;
            ate = true;
            const cx = tx * C.TILE + C.TILE / 2;
            const cy = ty * C.TILE + C.TILE / 2;
            E.particles.trail(cx, cy, { color: S.currentTheme.dotColor, vx: (S.pacman.x - cx) * 0.1, vy: (S.pacman.y - cy) * 0.1 });
          }
        }
      }
    if (ate) {
      NS.collisions.checkFruitAppearance();
      if (S.dotsEaten >= S.totalDots) {
        if (S.bossActive) {
          S.maze = NS.maze.cloneMaze();
          S.totalDots = NS.maze.countDots(S.maze);
          S.dotsEaten = 0;
          S.fruitShown = 0;
        } else {
          NS.flow.startLevelComplete();
        }
      }
      NS.status.updateStatus();
    }
  }

})();
