/* The heads-up display: the score/level/moves/time bar, the repair objective line,
   the HTML status bar and the paused, victory and ready overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { LEVELS } = NS.levels;

  function drawHud() {
    const ctx = D.ctx;

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, C.CANVAS_W, 22);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText(`Level: ${S.currentLevel + 1}/${LEVELS.length}  Moves: ${S.moveCount}  Time: ${S.elapsed.toFixed(1)}s  Score: ${S.totalScore}`, 6, 15);

    // Level repair objective info
    if (S.currentLevel < LEVELS.length) {
      const repairInfo = LEVELS[S.currentLevel].repair.component;
      ctx.fillStyle = '#66ffaa';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Repair: ' + repairInfo, C.CANVAS_W - 6, 15);
      ctx.textAlign = 'start';
    }

    // Status bar
    if (D.elScore) D.elScore.textContent = 'Score: ' + S.totalScore;
    if (D.elLevel) D.elLevel.textContent = 'Level: ' + (S.currentLevel + 1);
    if (D.elMoves) D.elMoves.textContent = 'Moves: ' + S.moveCount;
    if (D.elState) D.elState.textContent = S.state === C.STATE_PAUSED ? 'Paused' : S.state === C.STATE_SOLVED ? 'Solved!' : S.state === C.STATE_GAME_OVER ? 'Complete!' : 'Playing';

    // Overlays
    if (S.state === C.STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', C.CANVAS_W / 2, C.CANVAS_H / 2);
      ctx.textAlign = 'start';
    } else if (S.state === C.STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.fillStyle = '#66ffaa';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPACECRAFT FULLY REPAIRED!', C.CANVAS_W / 2, C.CANVAS_H / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Total Score: ' + S.totalScore + '  |  Tap or press F2 for New Game', C.CANVAS_W / 2, C.CANVAS_H / 2 + 15);
      ctx.textAlign = 'start';
    } else if (S.state === C.STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      ctx.fillStyle = '#66aaff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE PUZZLE', C.CANVAS_W / 2, C.CANVAS_H / 2 - 25);
      ctx.fillStyle = '#aaa';
      ctx.font = '13px sans-serif';
      ctx.fillText('Drag from the probe to launch it toward the repair goal', C.CANVAS_W / 2, C.CANVAS_H / 2 + 5);
      ctx.fillText('Press F2 or click New Game to start', C.CANVAS_W / 2, C.CANVAS_H / 2 + 25);
      ctx.textAlign = 'start';
    }
  }

  Object.assign(NS.hud, { drawHud });
})();
