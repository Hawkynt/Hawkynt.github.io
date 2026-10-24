;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.ghosts.getGhostTarget = function getGhostTarget(ghost) {
    if (ghost.mode === C.MODE_SCATTER)
      return C.SCATTER_TARGETS[ghost.index];

    if (ghost.mode === C.MODE_FRIGHTENED)
      return { x: Math.floor(Math.random() * C.COLS), y: Math.floor(Math.random() * C.ROWS) };

    if (ghost.mode === C.MODE_EATEN)
      return C.GHOST_HOUSE_DOOR;

    /* CHASE mode */
    switch (ghost.index) {
      case 0:
        return { x: S.pacman.tileX, y: S.pacman.tileY };

      case 1: {
        let tx = S.pacman.tileX + C.DX[S.pacman.dir] * 4;
        let ty = S.pacman.tileY + C.DY[S.pacman.dir] * 4;
        if (S.pacman.dir === C.DIR_UP)
          tx -= 4;
        return { x: tx, y: ty };
      }

      case 2: {
        const blinky = S.ghosts[0];
        const aheadX = S.pacman.tileX + C.DX[S.pacman.dir] * 2;
        const aheadY = S.pacman.tileY + C.DY[S.pacman.dir] * 2;
        return {
          x: aheadX + (aheadX - blinky.tileX),
          y: aheadY + (aheadY - blinky.tileY)
        };
      }

      case 3: {
        const dist = NS.movement.distance(ghost.tileX, ghost.tileY, S.pacman.tileX, S.pacman.tileY);
        if (dist > 8)
          return { x: S.pacman.tileX, y: S.pacman.tileY };
        return C.SCATTER_TARGETS[3];
      }
    }

    return { x: S.pacman.tileX, y: S.pacman.tileY };
  }

  NS.ghosts.chooseGhostDirection = function chooseGhostDirection(ghost) {
    if (ghost.inHouse)
      return ghost.dir;

    const target = NS.ghosts.getGhostTarget(ghost);
    ghost.targetX = target.x;
    ghost.targetY = target.y;

    const opposite = NS.movement.oppositeDir(ghost.dir);
    let bestDir = ghost.dir;
    let bestDist = Infinity;
    const allowGate = ghost.mode === C.MODE_EATEN;

    for (let d = 0; d < 4; ++d) {
      if (d === opposite && ghost.mode !== C.MODE_FRIGHTENED)
        continue;

      const nx = ghost.tileX + C.DX[d];
      const ny = ghost.tileY + C.DY[d];

      if (!NS.maze.isWalkable(nx, ny, allowGate))
        continue;

      if (d === C.DIR_UP && !allowGate && (
        (ghost.tileY === 11 && (ghost.tileX === 12 || ghost.tileX === 15)) ||
        (ghost.tileY === 23 && (ghost.tileX === 12 || ghost.tileX === 15))
      ))
        continue;

      const dist = NS.movement.distanceSq(nx, ny, target.x, target.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = d;
      }
    }

    return bestDir;
  }

  NS.ghosts.moveGhost = function moveGhost(ghost, dt) {
    /* Frozen by powerup */
    if (S.ghostsFrozen && ghost.mode !== C.MODE_EATEN)
      return;

    /* Handle ghost house behavior */
    if (ghost.inHouse) {
      ghost.releaseTimer -= dt * 1000;
      if (ghost.releaseTimer <= 0) {
        ghost.inHouse = false;
        ghost.x = C.GHOST_HOUSE_DOOR.x * C.TILE + C.TILE / 2;
        ghost.y = C.GHOST_HOUSE_DOOR.y * C.TILE + C.TILE / 2;
        ghost.tileX = C.GHOST_HOUSE_DOOR.x;
        ghost.tileY = C.GHOST_HOUSE_DOOR.y;
        ghost.dir = C.DIR_LEFT;
        ghost._lastDecTileX = -1;
        ghost._lastDecTileY = -1;
        return;
      }
      ghost.y += Math.sin(performance.now() * 0.005) * 0.5;
      return;
    }

    /* Base speed */
    let baseSpeed = ghost.speed;

    /* Cruise Elroy for Blinky */
    if (ghost.index === 0 && ghost.mode !== C.MODE_FRIGHTENED && ghost.mode !== C.MODE_EATEN) {
      const remaining = S.totalDots - S.dotsEaten;
      if (remaining <= S.levelConfig.elroy2Dots)
        baseSpeed = 1.5 * S.levelConfig.elroy2Spd;
      else if (remaining <= S.levelConfig.elroy1Dots)
        baseSpeed = 1.5 * S.levelConfig.elroy1Spd;
    }

    /* Mode modifiers */
    if (ghost.mode === C.MODE_FRIGHTENED)
      baseSpeed *= 0.6;
    else if (ghost.mode === C.MODE_EATEN)
      baseSpeed *= 2;

    /* Tunnel slowdown */
    if ((ghost.tileX < 6 || ghost.tileX > 21) && ghost.mode !== C.MODE_EATEN)
      baseSpeed = Math.min(baseSpeed, 1.5 * S.levelConfig.tunnel);

    const spd = baseSpeed * (60 * dt);

    /* If at center of tile and haven't decided here yet, choose new direction */
    if (NS.movement.isCentered(ghost) && (ghost.tileX !== ghost._lastDecTileX || ghost.tileY !== ghost._lastDecTileY)) {
      NS.movement.snapToCenter(ghost);
      ghost._lastDecTileX = ghost.tileX;
      ghost._lastDecTileY = ghost.tileY;

      if (ghost.mode === C.MODE_EATEN &&
          ghost.tileX === C.GHOST_HOUSE_DOOR.x && ghost.tileY === C.GHOST_HOUSE_DOOR.y) {
        ghost.mode = S.currentMode;
        ghost.x = C.GHOST_START_POS[ghost.index].x * C.TILE + C.TILE / 2;
        ghost.y = C.GHOST_START_POS[ghost.index].y * C.TILE + C.TILE / 2;
        ghost.tileX = C.GHOST_START_POS[ghost.index].x;
        ghost.tileY = C.GHOST_START_POS[ghost.index].y;
        ghost.inHouse = true;
        ghost.releaseTimer = 500;
        ghost._lastDecTileX = -1;
        ghost._lastDecTileY = -1;
        return;
      }

      ghost.dir = NS.ghosts.chooseGhostDirection(ghost);
    }

    ghost.x += C.DX[ghost.dir] * spd;
    ghost.y += C.DY[ghost.dir] * spd;

    /* Tunnel wrap */
    if (ghost.x < -C.TILE / 2)
      ghost.x += C.COLS * C.TILE;
    else if (ghost.x >= C.COLS * C.TILE + C.TILE / 2)
      ghost.x -= C.COLS * C.TILE;

    const tile = NS.movement.getTile(ghost.x, ghost.y);
    ghost.tileX = NS.maze.wrapX(tile.x);
    ghost.tileY = Math.max(0, Math.min(C.ROWS - 1, tile.y));
  }

  NS.ghosts.reverseGhosts = function reverseGhosts() {
    for (const g of S.ghosts) {
      if (!g.inHouse && g.mode !== C.MODE_EATEN) {
        g.dir = NS.movement.oppositeDir(g.dir);
        g._lastDecTileX = -1;
        g._lastDecTileY = -1;
      }
    }
  }

})();
