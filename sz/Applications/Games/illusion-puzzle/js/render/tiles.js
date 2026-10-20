/* The isometric tiles: the shaded block, the floor, raised terrace, Penrose stair
   and goal renderings, the goal arch, and the tile elevation lookup. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const L = NS.levels;
  const S = NS.state;
  const I = NS.iso;
  const R = NS.rules;
  const D = NS.dom;
  const P = NS.palette;
  const { shade } = NS.shapes;

  /* An isometric block: top diamond centred at (x, yTop), sides down to yBase */
  function drawBlock(x, yTop, yBase, hw, hh, top, left, right) {
    // Left face
    let g = D.ctx.createLinearGradient(0, yTop, 0, yBase + hh * 2);
    g.addColorStop(0, left);
    g.addColorStop(1, shade(left, -0.35));
    D.ctx.fillStyle = g;
    D.ctx.beginPath();
    D.ctx.moveTo(x - hw, yTop);
    D.ctx.lineTo(x, yTop + hh);
    D.ctx.lineTo(x, yBase + hh);
    D.ctx.lineTo(x - hw, yBase);
    D.ctx.closePath();
    D.ctx.fill();

    // Right face
    g = D.ctx.createLinearGradient(0, yTop, 0, yBase + hh * 2);
    g.addColorStop(0, right);
    g.addColorStop(1, shade(right, -0.35));
    D.ctx.fillStyle = g;
    D.ctx.beginPath();
    D.ctx.moveTo(x + hw, yTop);
    D.ctx.lineTo(x, yTop + hh);
    D.ctx.lineTo(x, yBase + hh);
    D.ctx.lineTo(x + hw, yBase);
    D.ctx.closePath();
    D.ctx.fill();

    // Top face
    g = D.ctx.createLinearGradient(x - hw, yTop - hh, x + hw, yTop + hh);
    g.addColorStop(0, top[0]);
    g.addColorStop(1, top[1]);
    D.ctx.fillStyle = g;
    D.ctx.beginPath();
    D.ctx.moveTo(x, yTop - hh);
    D.ctx.lineTo(x + hw, yTop);
    D.ctx.lineTo(x, yTop + hh);
    D.ctx.lineTo(x - hw, yTop);
    D.ctx.closePath();
    D.ctx.fill();

    // Lit back edges
    D.ctx.strokeStyle = P.PAL.edge;
    D.ctx.lineWidth = 1;
    D.ctx.beginPath();
    D.ctx.moveTo(x - hw, yTop);
    D.ctx.lineTo(x, yTop - hh);
    D.ctx.lineTo(x + hw, yTop);
    D.ctx.stroke();
    // Front edge line
    D.ctx.strokeStyle = 'rgba(40,20,60,0.35)';
    D.ctx.beginPath();
    D.ctx.moveTo(x - hw, yTop);
    D.ctx.lineTo(x, yTop + hh);
    D.ctx.lineTo(x + hw, yTop);
    D.ctx.stroke();
  }

  function cellElevation(row, col) {
    const cell = L.LEVELS[S.currentLevel].grid[row]?.[col];
    return cell === 2 ? P.ELEVATION_RAISED : 0;
  }

  function drawIsometricTile(col, row, cellType, elevation) {
    const pos = I.toScreen(col, row, elevation);
    const base = I.toScreen(col, row, 0);
    const hw = C.TILE_W / 2;
    const hh = C.TILE_H / 2;
    const yBase = base.y + P.BLOCK_DEPTH;

    switch (cellType) {
      case 1:
        drawBlock(pos.x, pos.y, yBase, hw, hh, P.PAL.floorTop, P.PAL.floorLeft, P.PAL.floorRight);
        break;
      case 2:
        drawBlock(pos.x, pos.y, yBase, hw, hh, P.PAL.raisedTop, shade(P.PAL.floorLeft, 0.08), shade(P.PAL.floorRight, 0.08));
        // Small inset square marks a raised terrace
        D.ctx.strokeStyle = 'rgba(160,100,90,0.35)';
        D.ctx.beginPath();
        D.ctx.moveTo(pos.x, pos.y - hh * 0.55);
        D.ctx.lineTo(pos.x + hw * 0.55, pos.y);
        D.ctx.lineTo(pos.x, pos.y + hh * 0.55);
        D.ctx.lineTo(pos.x - hw * 0.55, pos.y);
        D.ctx.closePath();
        D.ctx.stroke();
        break;
      case 3: {
        const open = R.isWalkable(row, col);
        drawBlock(pos.x, pos.y, yBase, hw, hh, open ? P.PAL.stairTop : P.PAL.stairDim, P.PAL.stairLeft, P.PAL.stairRight);
        // Penrose steps drawn on the top face, glowing while the stair is usable
        D.ctx.save();
        if (open) {
          D.ctx.shadowColor = '#c8b6ff';
          D.ctx.shadowBlur = 10 + Math.sin(performance.now() / 300) * 4;
        }
        D.ctx.strokeStyle = open ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
        D.ctx.lineWidth = 2;
        for (let i = 0; i < 4; ++i) {
          const f = 0.75 - i * 0.18;
          const y = pos.y - i * 3;
          D.ctx.beginPath();
          D.ctx.moveTo(pos.x - hw * f, y);
          D.ctx.lineTo(pos.x, y - hh * f);
          D.ctx.lineTo(pos.x + hw * f, y);
          D.ctx.stroke();
        }
        D.ctx.restore();
        break;
      }
      case 4: {
        drawBlock(pos.x, pos.y, yBase, hw, hh, P.PAL.goalTop, P.PAL.goalLeft, P.PAL.goalRight);
        drawArch(pos.x, pos.y);
        break;
      }
    }
  }

  function drawArch(x, y) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400);
    const archW = 18, archH = 40;
    D.ctx.save();
    D.ctx.shadowColor = '#7fffe0';
    D.ctx.shadowBlur = 18 * pulse;
    const g = D.ctx.createLinearGradient(0, y - archH, 0, y);
    g.addColorStop(0, 'rgba(220,255,248,0.95)');
    g.addColorStop(1, 'rgba(90,230,200,0.55)');
    D.ctx.fillStyle = g;
    D.ctx.beginPath();
    D.ctx.moveTo(x - archW / 2, y);
    D.ctx.lineTo(x - archW / 2, y - archH + archW / 2);
    D.ctx.arc(x, y - archH + archW / 2, archW / 2, Math.PI, 0);
    D.ctx.lineTo(x + archW / 2, y);
    D.ctx.closePath();
    D.ctx.fill();
    D.ctx.restore();
    D.ctx.strokeStyle = 'rgba(30,110,95,0.8)';
    D.ctx.lineWidth = 2;
    D.ctx.stroke();
  }

  Object.assign(NS.tiles, { drawBlock, cellElevation, drawIsometricTile, drawArch });
})();
