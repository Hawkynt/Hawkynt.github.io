;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Small reusable canvas shapes: hearts, stars, locks, the coin chip and the dim backdrop.
     Reads G.globalTime only. */

  const { ctx, ui } = NS.services;
  const G = NS.state;
  const View = NS.view;

  /* A heart `w` px wide: two round lobes and a point; a lost heart is only an outline */
  function drawHeart(cx, cy, w, filled) {
    const r = w / 4;
    const lobeY = cy - r * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 1.4);
    ctx.lineTo(cx - 2 * r, lobeY);
    ctx.arc(cx - r, lobeY, r, Math.PI, Math.PI * 2);
    ctx.arc(cx + r, lobeY, r, Math.PI, Math.PI * 2);
    ctx.lineTo(cx, cy + r * 1.4);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#ff4a5a';
      ctx.fill();
      ctx.strokeStyle = '#8c1220';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // the glint rides on the left lobe
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx - r * 0.6, lobeY - r * 0.45, r * 0.34, r * 0.22, -0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStarShape(x, y, r, filled) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = ui.UI.gold;
      ctx.fill();
      ctx.strokeStyle = ui.UI.goldDeep;
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    }
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function dimBackdrop() {
    const v = View.visibleRect();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function drawLock(cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = size * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8d0e0';
    ui.roundRectPath(cx - size * 0.4, cy - size * 0.12, size * 0.8, size * 0.6, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  /* Gold coin chip: the amount right-aligned at x, a spinning coin to its left */
  function drawCoinChip(amount, x, y) {
    const w = ui.drawChip(String(amount), x, y, 30, {
      align: 'right',
      color: ui.UI.gold,
      bg: 'rgba(0,0,0,0.45)',
      border: ui.hexToRgba(ui.UI.gold, 0.4)
    });
    View.sceneFor('meadow').drawCoin(ctx, x - w - 22, y + 15, G.globalTime);
    return w;
  }

  Object.assign(NS.shapes, { drawHeart, drawStarShape, dimBackdrop, drawLock, drawCoinChip });
})();
