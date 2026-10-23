/* The player: tile-to-tile movement with the power-up interactions on bombs,
   power-up collection and the stat changes each power-up applies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const P = NS.player = NS.player || {};

  /* ── Player Movement ── */
  P.updatePlayer = function updatePlayer(dt) {
    if (S.state !== C.STATE_PLAYING)
      return;

    // If moving between tiles, continue smooth animation with lerp/offset
    if (S.player.moveProgress > 0) {
      S.player.moveProgress = Math.min(1, S.player.moveProgress + S.playerSpeed * dt);
      S.player.walkTimer += dt;
      if (S.player.walkTimer > 0.12) {
        S.player.walkTimer = 0;
        S.player.walkFrame = (S.player.walkFrame + 1) % 2;
      }
      const fromX = S.player.col * C.TILE_SIZE + C.TILE_SIZE / 2;
      const fromY = S.player.row * C.TILE_SIZE + C.TILE_SIZE / 2;
      const toX = S.player.targetCol * C.TILE_SIZE + C.TILE_SIZE / 2;
      const toY = S.player.targetRow * C.TILE_SIZE + C.TILE_SIZE / 2;
      // Smooth interpolation
      S.player.x = fromX + (toX - fromX) * S.player.moveProgress;
      S.player.y = fromY + (toY - fromY) * S.player.moveProgress;

      if (S.player.moveProgress >= 1) {
        S.player.col = S.player.targetCol;
        S.player.row = S.player.targetRow;
        S.player.moveProgress = 0;
        S.player.x = S.player.col * C.TILE_SIZE + C.TILE_SIZE / 2;
        S.player.y = S.player.row * C.TILE_SIZE + C.TILE_SIZE / 2;
        S.player.walkFrame = 0;

        // Check power-up collection at new cell
        P.collectPowerUp();
      }
      return;
    }

    // Read directional input
    let dx = 0, dy = 0;
    if (S.keys['ArrowUp'] || S.keys['KeyW'])
      dy = -1;
    else if (S.keys['ArrowDown'] || S.keys['KeyS'])
      dy = 1;
    else if (S.keys['ArrowLeft'] || S.keys['KeyA'])
      dx = -1;
    else if (S.keys['ArrowRight'] || S.keys['KeyD'])
      dx = 1;

    if (dx === 0 && dy === 0)
      return;

    const newCol = S.player.col + dx;
    const newRow = S.player.row + dy;

    // Wall collision check — use isPlayerWalkable (enables climb)
    if (!NS.arena.isPlayerWalkable(newCol, newRow))
      return;

    // Bomb collision — priority-based interaction
    if (NS.arena.hasBombAt(newCol, newRow)) {
      // Fly: walk through bombs freely
      if (S.hasFly) {
        // Don't block — fall through to movement below
      } else if (S.hasGlove) {
        NS.bombs.throwBomb(newCol, newRow);
        return;
      } else if (S.hasPowerKick) {
        NS.bombs.slideBomb(newCol, newRow, dx, dy);
        return;
      } else if (S.hasKick) {
        const kickCol = newCol + dx;
        const kickRow = newRow + dy;
        if (NS.arena.isWalkable(kickCol, kickRow) && !NS.arena.hasBombAt(kickCol, kickRow))
          for (const b of S.bombs)
            if (b.col === newCol && b.row === newRow) {
              b.col = kickCol;
              b.row = kickRow;
              SZ.GameAudio.play('bounce');
              break;
            }
        return;
      } else {
        return;
      }
    }

    S.player.targetCol = newCol;
    S.player.targetRow = newRow;
    S.player.moveProgress = 0.01;
    const newFacing = dy < 0 ? 1 : dy > 0 ? 0 : dx < 0 ? 2 : 3;
    if (newFacing !== S.player.facing)
      S.player.walkFrame = 0;
    S.player.facing = newFacing;
    S.player.walkTimer = 0;
  };

  /* ── Collect Power-Up ── */
  P.collectPowerUp = function collectPowerUp() {
    for (let i = S.powerUps.length - 1; i >= 0; --i) {
      const pu = S.powerUps[i];
      if (pu.col === S.player.col && pu.row === S.player.row) {
        P.applyPowerUp(pu.type);

        // Sparkle/burst particles on power-up collection
        D.particles.sparkle(
          pu.col * C.TILE_SIZE + C.TILE_SIZE / 2,
          pu.row * C.TILE_SIZE + C.TILE_SIZE / 2,
          10,
          { color: '#ffd700', speed: 3, life: 0.5, size: 2, decay: 0.03 }
        );

        D.floatingText.add(
          pu.col * C.TILE_SIZE + C.TILE_SIZE / 2,
          pu.row * C.TILE_SIZE + C.TILE_SIZE / 2,
          pu.type.replace('_', ' ').toUpperCase(),
          { color: '#0ff', decay: 0.025 }
        );
        SZ.GameAudio.play('powerup');

        S.powerUps.splice(i, 1);
      }
    }
  };

  /* ── Apply Power-Up ── */
  P.applyPowerUp = function applyPowerUp(type) {
    if (type === C.POWERUP_BOMB_UP)
      ++S.maxBombs;
    else if (type === C.POWERUP_FIRE_UP)
      ++S.blastRange;
    else if (type === C.POWERUP_SPEED_UP)
      S.playerSpeed += 0.5;
    else if (type === C.POWERUP_KICK)
      S.hasKick = true;
    else if (type === C.POWERUP_REMOTE)
      S.hasRemote = true;
    else if (type === C.POWERUP_POWER_KICK)
      S.hasPowerKick = true;
    else if (type === C.POWERUP_FLY)
      S.hasFly = true;
    else if (type === C.POWERUP_GLOVE)
      S.hasGlove = true;
    else if (type === C.POWERUP_CLIMB)
      S.hasClimb = true;
  };
})();
