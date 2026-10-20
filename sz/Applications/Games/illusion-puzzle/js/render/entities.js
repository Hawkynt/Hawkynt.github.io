/* The moving pieces: the glowing trail of visited tiles, the bobbing gems and the
   robed figure with its terrace lift and hop. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const L = NS.levels;
  const S = NS.state;
  const I = NS.iso;
  const D = NS.dom;
  const P = NS.palette;
  const { cellElevation } = NS.tiles;

  function drawTrail() {
    if (S.trail.length < 2) return;
    D.ctx.save();
    D.ctx.strokeStyle = 'rgba(255,236,190,0.55)';
    D.ctx.lineWidth = 3;
    D.ctx.setLineDash([2, 7]);
    D.ctx.lineCap = 'round';
    D.ctx.beginPath();
    for (let i = 0; i < S.trail.length; ++i) {
      const pos = I.toScreen(S.trail[i].col, S.trail[i].row, cellElevation(S.trail[i].row, S.trail[i].col));
      if (i === 0) D.ctx.moveTo(pos.x, pos.y);
      else D.ctx.lineTo(pos.x, pos.y);
    }
    D.ctx.stroke();
    D.ctx.restore();
  }

  function drawGem(x, y, size, bob) {
    // Shadow on the tile
    D.ctx.fillStyle = 'rgba(60,30,60,0.28)';
    D.ctx.beginPath();
    D.ctx.ellipse(x, y + 2, size * 0.8, size * 0.35, 0, 0, Math.PI * 2);
    D.ctx.fill();

    const gy = y - size * 1.6 - bob;
    D.ctx.save();
    D.ctx.shadowColor = 'rgba(255,210,90,0.9)';
    D.ctx.shadowBlur = 12;
    // Crown and pavilion facets
    D.ctx.fillStyle = P.PAL.gem[1];
    D.ctx.beginPath();
    D.ctx.moveTo(x - size, gy);
    D.ctx.lineTo(x - size * 0.5, gy - size * 0.6);
    D.ctx.lineTo(x + size * 0.5, gy - size * 0.6);
    D.ctx.lineTo(x + size, gy);
    D.ctx.lineTo(x, gy + size * 1.2);
    D.ctx.closePath();
    D.ctx.fill();
    D.ctx.restore();
    D.ctx.fillStyle = P.PAL.gem[0];
    D.ctx.beginPath();
    D.ctx.moveTo(x - size * 0.5, gy - size * 0.6);
    D.ctx.lineTo(x + size * 0.1, gy - size * 0.6);
    D.ctx.lineTo(x - size * 0.2, gy);
    D.ctx.lineTo(x - size, gy);
    D.ctx.closePath();
    D.ctx.fill();
    D.ctx.fillStyle = P.PAL.gem[2];
    D.ctx.beginPath();
    D.ctx.moveTo(x + size, gy);
    D.ctx.lineTo(x, gy + size * 1.2);
    D.ctx.lineTo(x + size * 0.2, gy);
    D.ctx.closePath();
    D.ctx.fill();
  }

  function drawCollectibles() {
    const def = L.LEVELS[S.currentLevel];
    if (!def.collectibles) return;
    const t = performance.now() / 1000;
    for (let i = 0; i < def.collectibles.length; ++i) {
      if (S.collected.includes(i)) continue;
      const gem = def.collectibles[i];
      const pos = I.toScreen(gem.col, gem.row, cellElevation(gem.row, gem.col));
      drawGem(pos.x, pos.y, 10, 4 + Math.sin(t * 2.4 + i) * 3);
    }
  }

  let playerLift = 0;

  function drawPlayer() {
    // Ease the figure up and down terraces
    const targetLift = cellElevation(S.player.row, S.player.col) * C.TILE_H;
    playerLift += (targetLift - playerLift) * 0.2;
    const x = S.player.x;
    const y = S.player.y - playerLift;
    const bob = S.player.moveProgress < 1 ? Math.sin(S.player.moveProgress * Math.PI) * 5 : 0;

    drawFigure(x, y, bob);
  }

  function drawFigure(x, y, bob) {
    // Shadow
    D.ctx.fillStyle = 'rgba(50,20,60,0.35)';
    D.ctx.beginPath();
    D.ctx.ellipse(x, y + 2, 11, 5, 0, 0, Math.PI * 2);
    D.ctx.fill();

    const fy = y - bob;
    // Robe
    const robe = D.ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    robe.addColorStop(0, '#ffffff');
    robe.addColorStop(1, '#cfc8e8');
    D.ctx.fillStyle = robe;
    D.ctx.beginPath();
    D.ctx.moveTo(x - 9, fy);
    D.ctx.quadraticCurveTo(x - 7, fy - 16, x - 3, fy - 22);
    D.ctx.lineTo(x + 3, fy - 22);
    D.ctx.quadraticCurveTo(x + 7, fy - 16, x + 9, fy);
    D.ctx.quadraticCurveTo(x, fy + 4, x - 9, fy);
    D.ctx.closePath();
    D.ctx.fill();
    // Head
    D.ctx.fillStyle = '#fbe3cf';
    D.ctx.beginPath();
    D.ctx.arc(x, fy - 25, 4.5, 0, Math.PI * 2);
    D.ctx.fill();
    // Pointed hat
    D.ctx.fillStyle = P.PAL.ink;
    D.ctx.beginPath();
    D.ctx.moveTo(x - 6, fy - 26);
    D.ctx.lineTo(x + 6, fy - 26);
    D.ctx.lineTo(x + 1, fy - 40);
    D.ctx.closePath();
    D.ctx.fill();
    D.ctx.fillStyle = P.PAL.accent;
    D.ctx.beginPath();
    D.ctx.arc(x + 1, fy - 40, 1.8, 0, Math.PI * 2);
    D.ctx.fill();
  }

  Object.assign(NS.entities, { drawTrail, drawGem, drawCollectibles, drawPlayer, drawFigure });
})();
