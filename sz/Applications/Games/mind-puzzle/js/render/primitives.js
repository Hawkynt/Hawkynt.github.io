/* Reusable canvas drawing: the UI palette, color helpers (shade, withAlpha), the rounded
   rectangle path, the panel/pill/centered-text widgets and the room primitives — the
   lit floor, the beveled stone block, the glow circle, the arched portal door and the
   wisp that stands in for the player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const ctx = NS.dom.ctx;

  /* ── Drawing helpers ── */
  const UI = {
    panelTop: 'rgba(30,28,60,',
    panelBottom: 'rgba(14,12,32,',
    text: '#eef0ff',
    textDim: 'rgba(225,228,255,0.62)',
    gold: '#ffd76a',
    good: '#7dffb2',
    font: '"Segoe UI", system-ui, sans-serif'
  };

  function shade(hex, amount) {
    const n = parseInt(hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3').slice(1) : hex.slice(1, 7), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amount < 0 ? v * amount : (255 - v) * amount))));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function withAlpha(hex, a) {
    const full = shade(hex, 0);
    const n = parseInt(full.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function panel(x, y, w, h, alpha, accent) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    roundRectPath(x, y, w, h, 10);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, UI.panelTop + alpha + ')');
    g.addColorStop(1, UI.panelBottom + alpha + ')');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = accent ? withAlpha(accent, 0.55) : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function centeredText(text, y, font, color, glow) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 16;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, C.canvasW / 2, y);
    ctx.restore();
  }

  function pill(text, y, color) {
    ctx.save();
    ctx.font = 'bold 14px ' + UI.font;
    const w = ctx.measureText(text).width + 36;
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 350);
    roundRectPath(C.canvasW / 2 - w / 2, y - 16, w, 32, 16);
    ctx.fillStyle = withAlpha(color, 0.16 + 0.1 * pulse);
    ctx.fill();
    ctx.strokeStyle = withAlpha(color, 0.5 + 0.4 * pulse);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, C.canvasW / 2, y + 1);
    ctx.restore();
  }

  /* Floor: soft-lit room with tiles, seams in the room's accent and a vignette */
  function drawFloor(def) {
    const base = def.color;
    const g = ctx.createRadialGradient(C.canvasW / 2, C.canvasH / 2, 40, C.canvasW / 2, C.canvasH / 2, Math.max(C.canvasW, C.canvasH) * 0.75);
    g.addColorStop(0, shade(base, 0.16));
    g.addColorStop(1, shade(base, -0.35));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.canvasW, C.canvasH);

    // Checkered floor tiles
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < C.canvasH; y += C.TILE)
      for (let x = ((y / C.TILE) % 2) * C.TILE; x < C.canvasW; x += C.TILE * 2)
        ctx.fillRect(x, y, C.TILE, C.TILE);
    ctx.strokeStyle = withAlpha(def.accentColor, 0.09);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < C.canvasW; x += C.TILE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, C.canvasH);
    }
    for (let y = 0.5; y < C.canvasH; y += C.TILE) {
      ctx.moveTo(0, y);
      ctx.lineTo(C.canvasW, y);
    }
    ctx.stroke();

    // Room border: a recessed frame
    ctx.strokeStyle = withAlpha(def.accentColor, 0.25);
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, C.canvasW - 12, C.canvasH - 12);

    const v = ctx.createRadialGradient(C.canvasW / 2, C.canvasH / 2, Math.min(C.canvasW, C.canvasH) * 0.35, C.canvasW / 2, C.canvasH / 2, Math.max(C.canvasW, C.canvasH) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, C.canvasW, C.canvasH);
  }

  /* Beveled stone block with a cast shadow */
  function drawStone(x, y, w, h, tint) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 5, y + 6, w, h);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, shade(tint, 0.25));
    g.addColorStop(1, shade(tint, -0.2));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, w, 2);
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x, y + h - 2, w, 2);
    ctx.fillRect(x + w - 2, y, 2, h);
    // Mortar lines on long blocks
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (w >= h)
      for (let sx = x + 40; sx < x + w - 4; sx += 40) {
        ctx.moveTo(sx + 0.5, y + 2);
        ctx.lineTo(sx + 0.5, y + h - 2);
      }
    else
      for (let sy = y + 40; sy < y + h - 4; sy += 40) {
        ctx.moveTo(x + 2, sy + 0.5);
        ctx.lineTo(x + w - 2, sy + 0.5);
      }
    ctx.stroke();
  }

  function glowCircle(x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Arched doorway with a swirling portal inside */
  function drawDoor(p, accent, t) {
    const cx = p.x + p.w / 2;
    const top = p.y + p.w / 2;
    // Light spill on the floor
    glowCircle(cx, p.y + p.h, p.w * 1.3, withAlpha(accent, 0.28), withAlpha(accent, 0));
    // Frame
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12 + Math.sin(t * 2.5) * 5;
    ctx.fillStyle = shade(accent, -0.55);
    ctx.beginPath();
    ctx.moveTo(p.x - 4, p.y + p.h + 2);
    ctx.lineTo(p.x - 4, top);
    ctx.arc(cx, top, p.w / 2 + 4, Math.PI, 0);
    ctx.lineTo(p.x + p.w + 4, p.y + p.h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Portal surface
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h);
    ctx.lineTo(p.x, top);
    ctx.arc(cx, top, p.w / 2, Math.PI, 0);
    ctx.lineTo(p.x + p.w, p.y + p.h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    g.addColorStop(0, shade(accent, 0.55));
    g.addColorStop(1, shade(accent, -0.15));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    const sy = p.y + p.h * 0.55;
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, sy, 4 + i * 6, 3 + i * 5, t * (1.2 + i * 0.4), 0.4, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    // Threshold
    ctx.fillStyle = shade(accent, -0.35);
    ctx.fillRect(p.x - 6, p.y + p.h, p.w + 12, 4);
  }

  function drawWisp(x, y, color, alpha, dir) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + C.PLAYER_SIZE / 2 + 3, C.PLAYER_SIZE * 0.55, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    glowCircle(x, y, C.PLAYER_SIZE * 1.4, withAlpha(color, 0.35), withAlpha(color, 0));
    const g = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, C.PLAYER_SIZE / 2 + 1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, shade(color, 0.35));
    g.addColorStop(1, shade(color, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, C.PLAYER_SIZE / 2 + 1, 0, Math.PI * 2);
    ctx.fill();
    // Eyes look where the wisp is heading
    ctx.fillStyle = '#1b1b3a';
    const ex = dir.x * 2.5, ey = dir.y * 2;
    ctx.beginPath();
    ctx.arc(x - 3 + ex, y - 1 + ey, 1.7, 0, Math.PI * 2);
    ctx.arc(x + 3 + ex, y - 1 + ey, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  Object.assign(NS.primitives, { UI, shade, withAlpha, roundRectPath, panel, centeredText, pill,
    drawFloor, drawStone, glowCircle, drawDoor, drawWisp });
})();
