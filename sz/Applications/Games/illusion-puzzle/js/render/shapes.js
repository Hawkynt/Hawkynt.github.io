/* The shared drawing primitives: rounded rectangles, the frosted panel, the color
   shader, centered text and the pulsing hint pill. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const D = NS.dom;
  const P = NS.palette;

  function roundRectPath(x, y, w, h, r) {
    D.ctx.beginPath();
    D.ctx.moveTo(x + r, y);
    D.ctx.lineTo(x + w - r, y);
    D.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    D.ctx.lineTo(x + w, y + h - r);
    D.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    D.ctx.lineTo(x + r, y + h);
    D.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    D.ctx.lineTo(x, y + r);
    D.ctx.quadraticCurveTo(x, y, x + r, y);
    D.ctx.closePath();
  }

  function panel(x, y, w, h, alpha) {
    D.ctx.save();
    D.ctx.shadowColor = 'rgba(0,0,0,0.45)';
    D.ctx.shadowBlur = 14;
    D.ctx.shadowOffsetY = 4;
    roundRectPath(x, y, w, h, 10);
    const g = D.ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, `rgba(58,40,98,${alpha})`);
    g.addColorStop(1, `rgba(30,22,60,${alpha})`);
    D.ctx.fillStyle = g;
    D.ctx.fill();
    D.ctx.shadowColor = 'transparent';
    D.ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    D.ctx.lineWidth = 1;
    D.ctx.stroke();
    D.ctx.restore();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amount < 0 ? v * amount : (255 - v) * amount))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function centeredText(text, y, font, color, glow) {
    D.ctx.save();
    D.ctx.font = font;
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';
    if (glow) {
      D.ctx.shadowColor = glow;
      D.ctx.shadowBlur = 16;
    }
    D.ctx.fillStyle = color;
    D.ctx.fillText(text, C.CANVAS_W / 2, y);
    D.ctx.restore();
  }

  function pill(text, y) {
    D.ctx.save();
    D.ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    const w = D.ctx.measureText(text).width + 36;
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 350);
    roundRectPath(C.CANVAS_W / 2 - w / 2, y - 16, w, 32, 16);
    D.ctx.fillStyle = `rgba(255,207,107,${0.18 + 0.12 * pulse})`;
    D.ctx.fill();
    D.ctx.strokeStyle = `rgba(255,207,107,${0.55 + 0.35 * pulse})`;
    D.ctx.lineWidth = 1.5;
    D.ctx.stroke();
    D.ctx.fillStyle = P.PAL.accent;
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';
    D.ctx.fillText(text, C.CANVAS_W / 2, y + 1);
    D.ctx.restore();
  }

  Object.assign(NS.shapes, { roundRectPath, panel, shade, centeredText, pill });
})();
