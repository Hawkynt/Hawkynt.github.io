/* The heads-up display: the title screen with its floating island, the level card,
   the gem and move counters, the view indicator and the pause, completion and
   all-complete overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const L = NS.levels;
  const S = NS.state;
  const D = NS.dom;
  const P = NS.palette;
  const { panel, centeredText, pill, shade } = NS.shapes;
  const { drawBlock, drawArch } = NS.tiles;
  const { drawGem, drawFigure } = NS.entities;

  /* Title art: a small floating island built from the game's own pieces */
  function drawTitleIsland(cx, cy) {
    const hw = 34, hh = 17;
    const cells = [[1, 1, 2], [3, 1, 1], [2, 1, 4]];
    const at = (r, c, lift) => ({ x: cx + (c - r) * hw, y: cy + (c + r) * hh - lift });
    for (let r = 0; r < 3; ++r)
      for (let c = 0; c < 3; ++c) {
        const cell = cells[r][c];
        const lift = cell === 2 ? hh : 0;
        const p = at(r, c, lift);
        const yBase = cy + (c + r) * hh + 26;
        if (cell === 1)
          drawBlock(p.x, p.y, yBase, hw, hh, P.PAL.floorTop, P.PAL.floorLeft, P.PAL.floorRight);
        else if (cell === 2)
          drawBlock(p.x, p.y, yBase, hw, hh, P.PAL.raisedTop, shade(P.PAL.floorLeft, 0.08), shade(P.PAL.floorRight, 0.08));
        else if (cell === 3)
          drawBlock(p.x, p.y, yBase, hw, hh, P.PAL.stairTop, P.PAL.stairLeft, P.PAL.stairRight);
        else {
          drawBlock(p.x, p.y, yBase, hw, hh, P.PAL.goalTop, P.PAL.goalLeft, P.PAL.goalRight);
          drawArch(p.x, p.y);
        }
      }
    const t = performance.now() / 1000;
    const gem = at(1, 2, 0);
    drawGem(gem.x, gem.y, 9, 4 + Math.sin(t * 2.4) * 3);
    const hero = at(0, 0, 0);
    drawFigure(hero.x, hero.y, 0);
  }

  function drawHUD() {
    if (S.state === C.STATE_READY) {
      drawTitleIsland(C.CANVAS_W / 2, 105);
      centeredText('OPTICAL ILLUSION PUZZLE', 270, 'bold 30px "Segoe UI", system-ui, sans-serif', P.PAL.text, 'rgba(200,170,255,0.9)');
      centeredText('Navigate impossible architecture', 306, 'italic 15px "Segoe UI", system-ui, sans-serif', P.PAL.textDim);
      pill('Tap or press F2 to start', 360);
      centeredText('Arrows / WASD move   ·   Q / E rotate the view   ·   Esc pause', 420, '12px "Segoe UI", system-ui, sans-serif', P.PAL.textDim);
    }

    if (S.state === C.STATE_PLAYING || S.state === C.STATE_PAUSED) {
      const def = L.LEVELS[S.currentLevel];
      // Level card
      panel(10, 10, 230, 46, 0.78);
      D.ctx.save();
      D.ctx.textBaseline = 'middle';
      D.ctx.fillStyle = P.PAL.accent;
      D.ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
      D.ctx.fillText(`LEVEL ${S.currentLevel + 1} / ${L.LEVELS.length}`, 22, 25);
      D.ctx.fillStyle = P.PAL.text;
      D.ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      D.ctx.fillText(def.name, 22, 42);
      D.ctx.restore();

      // Gems and moves
      const total = def.collectibles.length;
      const w = 34 + total * 22 + 70;
      panel(C.CANVAS_W - w - 10, 10, w, 46, 0.78);
      for (let i = 0; i < total; ++i) {
        const gx = C.CANVAS_W - w + 12 + i * 22;
        if (i < S.collected.length)
          drawGem(gx, 44, 6, 0);
        else {
          D.ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          D.ctx.lineWidth = 1.2;
          D.ctx.beginPath();
          D.ctx.moveTo(gx - 6, 34);
          D.ctx.lineTo(gx, 27);
          D.ctx.lineTo(gx + 6, 34);
          D.ctx.lineTo(gx, 41);
          D.ctx.closePath();
          D.ctx.stroke();
        }
      }
      D.ctx.save();
      D.ctx.textAlign = 'right';
      D.ctx.textBaseline = 'middle';
      D.ctx.fillStyle = P.PAL.textDim;
      D.ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      D.ctx.fillText('MOVES', C.CANVAS_W - 22, 24);
      D.ctx.fillStyle = P.PAL.text;
      D.ctx.font = 'bold 17px "Segoe UI", system-ui, sans-serif';
      D.ctx.fillText(String(S.moves), C.CANVAS_W - 22, 42);
      D.ctx.restore();

      // View indicator: which of the four perspectives is active
      const cx = C.CANVAS_W / 2;
      panel(cx - 64, C.CANVAS_H - 40, 128, 30, 0.7);
      D.ctx.save();
      D.ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
      D.ctx.textBaseline = 'middle';
      D.ctx.fillStyle = P.PAL.textDim;
      D.ctx.fillText('VIEW', cx - 52, C.CANVAS_H - 25);
      for (let i = 0; i < 4; ++i) {
        const dx = cx - 8 + i * 17;
        const active = i === (S.rotationProgress < 1 ? S.rotationTo : S.perspective);
        D.ctx.fillStyle = active ? P.PAL.stairTop[0] : 'rgba(255,255,255,0.18)';
        if (active) {
          D.ctx.shadowColor = '#b9a6ff';
          D.ctx.shadowBlur = 8;
        }
        D.ctx.beginPath();
        D.ctx.moveTo(dx, C.CANVAS_H - 32);
        D.ctx.lineTo(dx + 6, C.CANVAS_H - 25);
        D.ctx.lineTo(dx, C.CANVAS_H - 18);
        D.ctx.lineTo(dx - 6, C.CANVAS_H - 25);
        D.ctx.closePath();
        D.ctx.fill();
        D.ctx.shadowBlur = 0;
      }
      D.ctx.restore();
    }

    if (S.state === C.STATE_PAUSED) {
      D.ctx.fillStyle = 'rgba(15,10,35,0.55)';
      D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      panel(C.CANVAS_W / 2 - 130, C.CANVAS_H / 2 - 55, 260, 110, 0.92);
      centeredText('PAUSED', C.CANVAS_H / 2 - 15, 'bold 28px "Segoe UI", system-ui, sans-serif', P.PAL.text, 'rgba(200,170,255,0.8)');
      centeredText('Press Esc to resume', C.CANVAS_H / 2 + 22, '13px "Segoe UI", system-ui, sans-serif', P.PAL.textDim);
    }

    if (S.state === C.STATE_LEVEL_COMPLETE) {
      D.ctx.fillStyle = 'rgba(15,10,35,0.45)';
      D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      panel(C.CANVAS_W / 2 - 160, C.CANVAS_H / 2 - 80, 320, 160, 0.92);
      centeredText('LEVEL COMPLETE', C.CANVAS_H / 2 - 45, 'bold 24px "Segoe UI", system-ui, sans-serif', P.PAL.accent, 'rgba(255,200,100,0.7)');
      const def = L.LEVELS[S.currentLevel];
      centeredText(def.name, C.CANVAS_H / 2 - 15, 'italic 14px "Segoe UI", system-ui, sans-serif', P.PAL.textDim);
      centeredText(`Moves ${S.moves}   ·   Gems ${S.collected.length} / ${def.collectibles.length}`, C.CANVAS_H / 2 + 12, 'bold 14px "Segoe UI", system-ui, sans-serif', P.PAL.text);
      pill('Tap or press any key', C.CANVAS_H / 2 + 50);
    }

    if (S.state === C.STATE_GAME_OVER) {
      D.ctx.fillStyle = 'rgba(15,10,35,0.6)';
      D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);
      panel(C.CANVAS_W / 2 - 180, C.CANVAS_H / 2 - 80, 360, 160, 0.94);
      centeredText('ALL LEVELS COMPLETE!', C.CANVAS_H / 2 - 40, 'bold 26px "Segoe UI", system-ui, sans-serif', P.PAL.accent, 'rgba(255,200,100,0.8)');
      centeredText('The impossible is now familiar ground.', C.CANVAS_H / 2 - 6, 'italic 14px "Segoe UI", system-ui, sans-serif', P.PAL.textDim);
      pill('Tap or press F2 to play again', C.CANVAS_H / 2 + 45);
    }
  }

  Object.assign(NS.hud, { drawTitleIsland, drawHUD });
})();
