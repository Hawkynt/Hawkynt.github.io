/* The player's tile-to-tile movement: illusion warps, walkability checks, the move
   counter and trail, and the eased move animation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const I = NS.iso;
  const R = NS.rules;
  const FX = NS.effects;

  /* ══════════════════════════════════════════════════════════════════
     PLAYER MOVEMENT
     ══════════════════════════════════════════════════════════════════ */

  function movePlayer(dRow, dCol) {
    if (S.state !== C.STATE_PLAYING || S.player.moveProgress < 1) return;

    const newRow = S.player.row + dRow;
    const newCol = S.player.col + dCol;

    // Check illusion teleport first
    const teleport = R.checkIllusionLink(S.player.row, S.player.col);
    if (teleport) {
      S.player.row = teleport.row;
      S.player.col = teleport.col;
      const pos = I.toScreen(S.player.col, S.player.row);
      S.player.targetX = pos.x;
      S.player.targetY = pos.y;
      S.player.moveProgress = 0;
      ++S.moves;
      S.trail.push({ row: S.player.row, col: S.player.col });

      FX.particles.burst(S.player.x, S.player.y, 12, { color: '#a0f', speed: 3, life: 0.5 });
      FX.floatingText.add(S.player.x, S.player.y - 20, 'Warp!', { color: '#a0f', font: 'bold 12px sans-serif' });
      FX.screenShake.trigger(3, 80);
      SZ.GameAudio.play('zap');
      NS.objectives.checkCollectibles();
      NS.objectives.checkGoal();
      return;
    }

    if (!R.isWalkable(newRow, newCol)) {
      SZ.GameAudio.play('click', { pitch: 0.5, volume: 0.5 });
      return;
    }

    S.player.row = newRow;
    S.player.col = newCol;
    const pos = I.toScreen(S.player.col, S.player.row);
    S.player.targetX = pos.x;
    S.player.targetY = pos.y;
    S.player.moveProgress = 0;
    ++S.moves;
    SZ.GameAudio.play('click', { pitch: 0.8 + (S.moves % 2) * 0.1, volume: 0.6 });

    S.trail.push({ row: S.player.row, col: S.player.col });
    NS.objectives.checkCollectibles();
    NS.objectives.checkGoal();
  }

  function updatePlayerAnimation(dt) {
    if (S.player.moveProgress < 1) {
      S.player.moveProgress = Math.min(1, S.player.moveProgress + dt * C.PLAYER_SPEED);
      const eased = I.smoothstep(S.player.moveProgress);
      S.player.x += (S.player.targetX - S.player.x) * eased;
      S.player.y += (S.player.targetY - S.player.y) * eased;
      if (S.player.moveProgress >= 1) {
        S.player.x = S.player.targetX;
        S.player.y = S.player.targetY;
      }
    }
  }

  Object.assign(NS.player, { movePlayer, updatePlayerAnimation });
})();
