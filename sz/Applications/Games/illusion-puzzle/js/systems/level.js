/* The level lifecycle: loading a level's layout and start position, completing it
   with its score bookkeeping, and advancing to the next one or the all-complete end. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const L = NS.levels;
  const S = NS.state;
  const I = NS.iso;
  const FX = NS.effects;
  const { saveProgress, addHighScore } = NS.persistence;

  /* ══════════════════════════════════════════════════════════════════
     LEVEL LOADING
     ══════════════════════════════════════════════════════════════════ */

  function loadLevel(index) {
    if (index < 0 || index >= L.LEVELS.length) return;

    S.currentLevel = index;
    const def = L.LEVELS[S.currentLevel];

    S.player.row = def.playerStart.row;
    S.player.col = def.playerStart.col;
    const startPos = I.toScreen(S.player.col, S.player.row);
    S.player.x = startPos.x;
    S.player.y = startPos.y;
    S.player.targetX = startPos.x;
    S.player.targetY = startPos.y;
    S.player.moveProgress = 1;

    S.collected = [];
    S.moves = 0;
    S.trail = [{ row: S.player.row, col: S.player.col }];

    S.perspective = def.perspective || 0;
    S.rotationProgress = 1;
    S.rotationFrom = S.perspective;
    S.rotationTo = S.perspective;

    S.state = C.STATE_PLAYING;
    SZ.GameAudio.play('select');
    NS.os.updateWindowTitle();
    saveProgress();
  }

  function nextLevel() {
    if (S.currentLevel + 1 < L.LEVELS.length)
      loadLevel(S.currentLevel + 1);
    else {
      S.state = C.STATE_GAME_OVER;
      FX.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2 - 40, 'ALL LEVELS COMPLETE!', { color: '#ffd700', font: 'bold 20px sans-serif' });
      FX.particles.confetti(C.CANVAS_W / 2, C.CANVAS_H / 2, 40, { speed: 6, gravity: 0.08 });
      FX.screenShake.trigger(6, 300);
      SZ.GameAudio.play('win');
      NS.os.updateWindowTitle();
    }
  }

  function completeLevel() {
    S.state = C.STATE_LEVEL_COMPLETE;
    S.levelProgress[S.currentLevel] = { moves: S.moves, gems: S.collected.length };
    addHighScore(S.currentLevel, S.moves);
    saveProgress();

    const goalPos = I.toScreen(L.LEVELS[S.currentLevel].grid[0].length - 1, L.LEVELS[S.currentLevel].grid.length - 1);
    FX.particles.burst(goalPos.x, goalPos.y, 20, { color: '#0f0', speed: 4, life: 0.8 });
    FX.particles.sparkle(goalPos.x, goalPos.y, 15, { color: '#ff0', speed: 3 });
    FX.screenShake.trigger(4, 200);
    SZ.GameAudio.play('levelup');
    NS.os.updateWindowTitle();
  }

  Object.assign(NS.level, { loadLevel, nextLevel, completeLevel });
})();
