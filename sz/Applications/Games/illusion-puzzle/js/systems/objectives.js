/* The level objectives: gem pickups with their sparkle feedback, and the goal tile
   that completes the level. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const L = NS.levels;
  const S = NS.state;
  const I = NS.iso;
  const FX = NS.effects;

  /* ══════════════════════════════════════════════════════════════════
     COLLECTIBLES & GOAL
     ══════════════════════════════════════════════════════════════════ */

  function checkCollectibles() {
    const def = L.LEVELS[S.currentLevel];
    if (!def.collectibles || def.collectibles.length === 0) return;
    for (let i = 0; i < def.collectibles.length; ++i) {
      const gem = def.collectibles[i];
      if (gem.row === S.player.row && gem.col === S.player.col && !S.collected.includes(i)) {
        S.collected.push(i);
        const pos = I.toScreen(gem.col, gem.row);
        FX.particles.sparkle(pos.x, pos.y, 10, { color: '#ff0', speed: 3 });
        FX.particles.burst(pos.x, pos.y, 8, { color: '#fa0', speed: 2, life: 0.4 });
        FX.floatingText.add(pos.x, pos.y - 20, 'Gem!', { color: '#ff0', font: 'bold 12px sans-serif' });
        FX.screenShake.trigger(2, 60);
        SZ.GameAudio.play('pickup', { pitch: 1 + S.collected.length * 0.06 });
      }
    }
  }

  function checkGoal() {
    if (L.LEVELS[S.currentLevel].grid[S.player.row]?.[S.player.col] === 4)
      NS.level.completeLevel();
  }

  Object.assign(NS.objectives, { checkCollectibles, checkGoal });
})();
