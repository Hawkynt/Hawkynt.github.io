;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Food art for the Cooking Game overhaul. Every dish (large and small, plus a
   * charred variant), every kitchen station (idle / working / ready / burning
   * as four animation frames), the small ingredient sprites and the order-ticket
   * icons are painted ONCE into cached canvases at 2x resolution, with glows,
   * flames, steam and smoke baked into the frames. The draw functions only blit
   * - no blur filters, no gradients per frame.
   */

  const TWO_PI = Math.PI * 2;
  const SCALE = 2;
  const OUTLINE = '#3a2418';

  const DISHES = ['burger', 'salad', 'tacos', 'pancakes', 'pasta', 'pizza',
    'steak', 'curry', 'sushi', 'ramen', 'cake', 'lobster'];

  /* Dishes are painted in a 96 x 96 design box centred on the origin. */
  const DISH_DESIGN = 96;

  /* Stations are painted in a 150 x 120 design box with padding for flames. */
  const ST_W = 150, ST_H = 120, ST_PAD = 12;
  const ST_SW = (ST_W + 2 * ST_PAD) * SCALE;   // 348
  const ST_SH = (ST_H + 2 * ST_PAD) * SCALE;   // 288

  /* ── colour helpers ── */

  function hexToRgb(hex) {
    let h = String(hex === undefined || hex === null ? '' : hex).trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    const n = parseInt(h, 16);
    if (isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function channel(v) {
    const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length < 2 ? '0' + s : s;
  }

  /* f in [-1, 1]: negative darkens toward black, positive lightens toward white */
  function shade(hex, f) {
    const c = hexToRgb(hex);
    const target = f < 0 ? 0 : 255;
    const k = Math.min(1, Math.abs(f));
    return '#' + channel(c.r + (target - c.r) * k) + channel(c.g + (target - c.g) * k) + channel(c.b + (target - c.b) * k);
  }

  function hexToRgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* ── shared painting helpers ── */

  function ell(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TWO_PI);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  function dot(ctx, x, y, r, fill, stroke, lw) {
    ell(ctx, x, y, r, r, fill, stroke, lw);
  }

  function line(ctx, x0, y0, x1, y1, color, lw) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }

  /* Soft baked drop shadow under a plate or bowl. */
  function dropShadow(ctx, x, y, rx, ry) {
    const g = ctx.createRadialGradient(x, y, rx * 0.25, x, y, rx);
    g.addColorStop(0, 'rgba(42,22,12,0.32)');
    g.addColorStop(1, 'rgba(42,22,12,0)');
    ctx.fillStyle = g;
    ell(ctx, x, y, rx, ry);
  }

  /* Soft baked glow: a radial gradient fading to transparent. */
  function glowDot(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexToRgba(color, alpha));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }

  /* Light from the upper-left: bright top-left, base in the middle, dark underside. */
  function bodyGradient(ctx, color, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, shade(color, 0.4));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -0.3));
    return g;
  }

  function gloss(ctx, x, y, rx, ry, alpha) {
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ell(ctx, x, y, rx, ry);
  }

  /* Round white plate with rim highlight and drop shadow. */
  function plate(ctx, cx, cy, rx, ry, color) {
    dropShadow(ctx, cx, cy + ry * 0.55, rx * 1.12, ry * 1.5);
    ell(ctx, cx, cy, rx, ry, color, OUTLINE, 2);
    ell(ctx, cx, cy - 1, rx * 0.78, ry * 0.66, shade(color, -0.06));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 3.5, ry - 2.5, 0, Math.PI * 1.02, Math.PI * 1.78);
    ctx.stroke();
  }

  /* Deep bowl: bottom half body plus a bright rim ellipse. */
  function bowl(ctx, cx, cy, rx, ry, color) {
    dropShadow(ctx, cx, cy + ry * 0.9, rx * 1.05, ry * 1.25);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry * 1.15, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, color, cx - rx, cy - ry, cx + rx, cy + ry * 1.4);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ell(ctx, cx, cy, rx, ry * 0.34, shade(color, 0.2), OUTLINE, 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 3, ry * 0.34 - 2, 0, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
  }

  /* Wooden serving board. */
  function board(ctx, cx, cy, rx, ry) {
    dropShadow(ctx, cx, cy + ry * 0.6, rx * 1.08, ry * 1.4);
    ell(ctx, cx, cy, rx, ry, bodyGradient(ctx, '#b07a3f', cx - rx, cy - ry, cx + rx, cy + ry), OUTLINE, 2);
    ctx.strokeStyle = 'rgba(90,50,20,0.4)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; ++i) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + i * ry * 0.45, rx * 0.8, ry * 0.32, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    gloss(ctx, cx - rx * 0.4, cy - ry * 0.5, rx * 0.3, ry * 0.28, 0.18);
  }

  /* ── the twelve dishes, painted in a 96 x 96 box centred on the origin ── */

  function paintBurger(ctx) {
    plate(ctx, 0, 27, 36, 11, '#f2ede2');
    ell(ctx, 0, 17, 19, 5.5, bodyGradient(ctx, '#e8a94f', -19, 12, 19, 22), OUTLINE, 2);
    ell(ctx, 0, 11.5, 20.5, 5.5, bodyGradient(ctx, '#6b3a1e', -20, 7, 20, 17), OUTLINE, 2);
    ell(ctx, 0, 6.5, 22, 4.5, '#f7b731', OUTLINE, 2);
    dot(ctx, -17, 9.5, 2.4, '#f7b731');
    dot(ctx, 16, 10, 2.2, '#f7b731');
    ell(ctx, 0, 2, 23, 4.5, '#6cc04a', OUTLINE, 2);
    for (let i = -2; i <= 2; ++i) dot(ctx, i * 9, -1, 3.4, '#6cc04a');
    dot(ctx, -13, -3, 4.5, '#e8452a', OUTLINE, 1.5);
    dot(ctx, 13, -3, 4.5, '#e8452a', OUTLINE, 1.5);
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.quadraticCurveTo(-20, -23, 0, -23);
    ctx.quadraticCurveTo(20, -23, 20, -2);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, '#e8a94f', -20, -23, 20, -2);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff3d0';
    const seeds = [[-9, -14, -0.4], [2, -18, 0.2], [11, -12, 0.5], [-3, -9, 0.1], [8, -18, -0.3]];
    for (let i = 0; i < seeds.length; ++i) {
      ctx.save();
      ctx.translate(seeds[i][0], seeds[i][1]);
      ctx.rotate(seeds[i][2]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 2.2, 1.2, 0, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
    gloss(ctx, -8, -17, 7, 3.4, 0.25);
  }

  function paintSalad(ctx) {
    bowl(ctx, 0, 18, 28, 9, '#e8e2d0');
    ell(ctx, -11, 10, 9, 6, '#4fae3a', OUTLINE, 1.5);
    ell(ctx, 1, 8, 10, 7, '#6cc04a', OUTLINE, 1.5);
    ell(ctx, 12, 11, 8, 5.5, '#3f9a30', OUTLINE, 1.5);
    dot(ctx, -5, 4, 4, '#e8452a', OUTLINE, 1.5);
    dot(ctx, 13, 4, 3.5, '#e8452a', OUTLINE, 1.5);
    dot(ctx, -14, 5, 3, '#c8e05a', OUTLINE, 1.2);
    const croutons = [[4, 1, 0.5, '#e8b04a'], [-9, 0, -0.4, '#d89a3a']];
    for (let i = 0; i < croutons.length; ++i) {
      ctx.save();
      ctx.translate(croutons[i][0], croutons[i][1]);
      ctx.rotate(croutons[i][2]);
      rrect(ctx, -2.6, -2.6, 5.2, 5.2, 1, croutons[i][3], OUTLINE, 1.2);
      ctx.restore();
    }
    gloss(ctx, -6, 5, 3, 1.6, 0.4);
  }

  function paintTacos(ctx) {
    board(ctx, 0, 26, 36, 10);
    for (let s = -1; s <= 1; s += 2) {
      const x = s * 13;
      ctx.beginPath();
      ctx.ellipse(x, 2, 13, 13, 0, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = bodyGradient(ctx, '#f2c14e', x - 13, -11, x + 13, 15);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      line(ctx, x - 12.5, 2, x - 11, -6, '#e8b04a', 3);
      line(ctx, x + 12.5, 2, x + 11, -6, '#e8b04a', 3);
      dot(ctx, x - 6, -4, 4, '#6cc04a');
      dot(ctx, x + 5, -5, 4.5, '#6cc04a');
      dot(ctx, x, -2.5, 4, '#8a4a2a');
      dot(ctx, x - 1, -7, 2.8, '#f7b731');
      dot(ctx, x + 8, -2, 2.6, '#e8452a');
      gloss(ctx, x - 6, 8, 4, 2.4, 0.25);
    }
  }

  function paintPancakes(ctx) {
    plate(ctx, 0, 26, 34, 10, '#f2ede2');
    const stack = [[17, 21], [11, 20], [5, 19]];
    for (let i = 0; i < stack.length; ++i)
      ell(ctx, 0, stack[i][0], stack[i][1], 5.5, bodyGradient(ctx, '#e8b04a', -stack[i][1], stack[i][0] - 5, stack[i][1], stack[i][0] + 5), OUTLINE, 2);
    ell(ctx, 0, 3.5, 17, 4.5, '#c8781e');
    const drips = [[-14, 8], [-6, 10], [4, 9], [12, 7]];
    for (let i = 0; i < drips.length; ++i)
      ell(ctx, drips[i][0], drips[i][1], 2.2, 3.6, '#c8781e');
    ctx.save();
    ctx.translate(-1, -2);
    ctx.rotate(0.15);
    rrect(ctx, -4, -3, 8, 5.5, 1.2, '#f7e07a', OUTLINE, 1.5);
    ctx.restore();
    gloss(ctx, -7, 1, 5, 1.8, 0.35);
  }

  function paintPasta(ctx) {
    bowl(ctx, 0, 18, 30, 10, '#f2ede2');
    ell(ctx, 0, 11, 23, 8, bodyGradient(ctx, '#f2cf5a', -23, 3, 23, 19), OUTLINE, 2);
    ctx.strokeStyle = '#d8a83a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; ++i) {
      ctx.beginPath();
      ctx.moveTo(-20 + i * 2, 9 + i * 1.4);
      ctx.quadraticCurveTo(0, 3 + i * 2.4, 20 - i * 2, 9 + i * 1.4);
      ctx.stroke();
    }
    ell(ctx, 0, 6, 13, 5.5, '#d8402a', OUTLINE, 1.5);
    dot(ctx, -9, 9, 2.5, '#d8402a');
    dot(ctx, 10, 9, 2.5, '#d8402a');
    ctx.save();
    ctx.translate(-4, 3);
    ctx.rotate(-0.4);
    ell(ctx, 0, 0, 3.6, 2.2, '#3f9a30', OUTLINE, 1);
    ctx.restore();
    ctx.save();
    ctx.translate(5, 4);
    ctx.rotate(0.5);
    ell(ctx, 0, 0, 3.2, 2, '#4fae3a', OUTLINE, 1);
    ctx.restore();
    gloss(ctx, 0, 4, 5, 1.6, 0.3);
  }

  function paintPizza(ctx) {
    dropShadow(ctx, 0, 12, 38, 16);
    ell(ctx, 0, 6, 36, 32, bodyGradient(ctx, '#b07a3f', -36, -26, 36, 38), OUTLINE, 2);
    ell(ctx, 0, 5, 31, 27, bodyGradient(ctx, '#e8a94f', -31, -22, 31, 32), OUTLINE, 2);
    ell(ctx, 0, 5, 26, 22.5, '#f7c948');
    const pep = [[-12, -6], [9, -9], [16, 5], [0, 13], [-15, 8], [-2, 0]];
    for (let i = 0; i < pep.length; ++i) {
      dot(ctx, pep[i][0], pep[i][1], 4, '#c8302a');
      dot(ctx, pep[i][0] - 1, pep[i][1] - 1, 1.4, '#e05a4a');
    }
    dot(ctx, 6, 2, 1.8, '#3f9a30');
    dot(ctx, -7, 12, 1.8, '#3f9a30');
    dot(ctx, 12, -2, 1.6, '#3f9a30');
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0 + 27 * Math.cos(-1.25), 5 + 23 * Math.sin(-1.25));
    ctx.moveTo(0, 5);
    ctx.lineTo(0 + 27 * Math.cos(-0.62), 5 + 23 * Math.sin(-0.62));
    ctx.stroke();
    gloss(ctx, -12, -10, 9, 5, 0.18);
  }

  function paintSteak(ctx) {
    plate(ctx, 0, 25, 37, 12, '#f2ede2');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-9, 10, 19, 11, -0.12, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, '#8a4a2a', -28, -1, 10, 21);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();
    ctx.strokeStyle = 'rgba(42,22,12,0.75)';
    ctx.lineWidth = 2.6;
    for (let i = -1; i <= 1; ++i) {
      ctx.beginPath();
      ctx.moveTo(-22 + i * 9, 0);
      ctx.lineTo(-12 + i * 9, 20);
      ctx.stroke();
    }
    ctx.restore();
    gloss(ctx, -15, 3, 6, 2.6, 0.22);
    line(ctx, -2, 6, 2, 12, '#3f9a30', 1.6);
    dot(ctx, -4, 5, 2, '#4fae3a');
    dot(ctx, 1, 8, 2, '#4fae3a');
    const fries = [[16, 14, -0.5], [20, 12, -0.2], [24, 13, 0.15], [27, 15, 0.45]];
    for (let i = 0; i < fries.length; ++i) {
      ctx.save();
      ctx.translate(fries[i][0], fries[i][1]);
      ctx.rotate(fries[i][2]);
      rrect(ctx, -1.8, -7, 3.6, 14, 1.4, '#f2cf5a', OUTLINE, 1.4);
      ctx.restore();
    }
  }

  function paintCurry(ctx) {
    plate(ctx, 0, 25, 37, 12, '#f2ede2');
    bowl(ctx, -14, 16, 17, 6, '#d8d2c2');
    ell(ctx, -14, 13, 13, 4.2, '#d8781e');
    dot(ctx, -18, 12, 2.6, '#8a4a2a');
    dot(ctx, -10, 13, 2.4, '#e8b04a');
    dot(ctx, -15, 15, 2.2, '#8a4a2a');
    dot(ctx, -8, 11, 1.6, '#6cc04a');
    gloss(ctx, -18, 11, 3.4, 1.2, 0.3);
    ell(ctx, 17, 12, 13, 8, bodyGradient(ctx, '#f5f2e8', 4, 4, 30, 20), OUTLINE, 2);
    ctx.strokeStyle = 'rgba(160,150,130,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; ++i) {
      ctx.beginPath();
      ctx.ellipse(12 + i * 3.4, 10 + (i % 2) * 3, 1.8, 0.9, 0.4, 0, TWO_PI);
      ctx.stroke();
    }
    gloss(ctx, 13, 7, 4, 1.8, 0.4);
  }

  function paintSushi(ctx) {
    board(ctx, 0, 22, 38, 12);
    const maki = [[-18, 6], [-6, 6], [6, 6], [-12, 16], [0, 16], [12, 16]];
    const fills = ['#f2703a', '#6cc04a', '#f2703a', '#e8452a', '#6cc04a', '#f2703a'];
    for (let i = 0; i < maki.length; ++i) {
      dot(ctx, maki[i][0], maki[i][1], 6, '#2a3a2a', OUTLINE, 1.5);
      dot(ctx, maki[i][0], maki[i][1], 4.6, '#f5f2e8');
      dot(ctx, maki[i][0], maki[i][1], 2.2, fills[i]);
    }
    ell(ctx, 24, 15, 8, 4.5, '#f5f2e8', OUTLINE, 1.5);
    ctx.save();
    ctx.translate(24, 11.5);
    ctx.rotate(-0.1);
    ell(ctx, 0, 0, 8.5, 3.6, bodyGradient(ctx, '#f2703a', -8, -3, 8, 3), OUTLINE, 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -1);
    ctx.lineTo(5, 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function paintRamen(ctx) {
    bowl(ctx, 0, 16, 30, 10, '#4a5a7a');
    ell(ctx, 0, 12, 25, 7, '#c8842a');
    ctx.strokeStyle = '#f2cf5a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.moveTo(-20, 9 + i * 2);
      ctx.quadraticCurveTo(-10, 5 + i * 2.4, -2, 9 + i * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(-13, 6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 4.4, 0, Math.PI, TWO_PI);
    ctx.closePath();
    ctx.fillStyle = '#f7f2e0';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    dot(ctx, 0, -1.6, 2.2, '#f2a03a');
    ctx.restore();
    dot(ctx, 12, 8, 6, '#e89a8a', OUTLINE, 1.5);
    dot(ctx, 11, 7, 3, '#f2b8a8');
    ctx.save();
    ctx.translate(19, 2);
    ctx.rotate(0.15);
    rrect(ctx, -4, -6, 8, 11, 1, '#2a3a2a', OUTLINE, 1.4);
    ctx.restore();
    dot(ctx, -4, 13, 1.5, '#6cc04a');
    dot(ctx, 4, 14, 1.5, '#6cc04a');
    dot(ctx, 1, 10, 1.4, '#6cc04a');
    gloss(ctx, -8, 7, 5, 1.6, 0.2);
  }

  function paintCake(ctx) {
    plate(ctx, 0, 24, 28, 9, '#f2ede2');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-16, 16);
    ctx.lineTo(16, 16);
    ctx.lineTo(16, -12);
    ctx.closePath();
    ctx.fillStyle = '#f7e6c8';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#e8b04a';
    ctx.fillRect(-16, 2, 32, 5);
    ctx.fillRect(-16, -8, 32, 5);
    ctx.fillStyle = 'rgba(216,64,42,0.8)';
    ctx.fillRect(-16, -3, 32, 2.4);
    ctx.restore();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 16);
    ctx.lineTo(16, 16);
    ctx.lineTo(16, -12);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-15, 14);
    ctx.lineTo(15, -11);
    ctx.stroke();
    dot(ctx, 16, -14, 4, '#d8302a', OUTLINE, 1.5);
    line(ctx, 16, -17, 19, -21, '#3f9a30', 1.6);
    gloss(ctx, 14.5, -15.5, 1.6, 1, 0.5);
  }

  function paintLobster(ctx) {
    plate(ctx, 0, 25, 37, 12, '#f2ede2');
    ctx.beginPath();
    ctx.ellipse(0, 6, 12, 10, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, '#d8302a', -12, -4, 12, 16);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    const tail = [[0, 15, 9, 3.4], [0, 19, 7.4, 3], [0, 22.6, 5.6, 2.4]];
    for (let i = 0; i < tail.length; ++i)
      ell(ctx, tail[i][0], tail[i][1], tail[i][2], tail[i][3], shade('#d8302a', -0.1 + i * 0.05), OUTLINE, 1.6);
    for (let s = -1; s <= 1; s += 2) {
      line(ctx, s * 9, 0, s * 15, -4, '#c02a24', 4);
      ell(ctx, s * 18, -7, 7, 5.5, bodyGradient(ctx, '#d8302a', s * 18 - 7, -12, s * 18 + 7, -2), OUTLINE, 2);
      ctx.beginPath();
      ctx.moveTo(s * 22, -10);
      ctx.lineTo(s * 26, -13);
      ctx.lineTo(s * 23, -8);
      ctx.closePath();
      ctx.fillStyle = '#d8302a';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.strokeStyle = '#c02a24';
    ctx.lineWidth = 1.6;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(s * 3, -3);
      ctx.quadraticCurveTo(s * 8, -14, s * 12, -18);
      ctx.stroke();
    }
    dot(ctx, -3, -3, 1.4, '#2a1a10');
    dot(ctx, 3, -3, 1.4, '#2a1a10');
    gloss(ctx, -4, 0, 4, 2, 0.25);
    ctx.save();
    ctx.translate(27, 14);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5, 5, 0, Math.PI, TWO_PI);
    ctx.closePath();
    ctx.fillStyle = '#f2d03a';
    ctx.fill();
    ctx.strokeStyle = '#e8b04a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; ++i) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(i * 4, -4.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  const DISH_PAINTERS = {
    burger: paintBurger, salad: paintSalad, tacos: paintTacos, pancakes: paintPancakes,
    pasta: paintPasta, pizza: paintPizza, steak: paintSteak, curry: paintCurry,
    sushi: paintSushi, ramen: paintRamen, cake: paintCake, lobster: paintLobster
  };

  function dishFor(id) {
    return DISH_PAINTERS[id] ? id : 'burger';
  }

  /* ── dish caches: paint once, blit forever ── */

  const dishCache = {};

  function getDishSprite(id, bucket, ruined) {
    const dish = dishFor(id);
    const key = dish + ':' + bucket + (ruined ? ':r' : '');
    const hit = dishCache[key];
    if (hit) return hit;

    const px = bucket === 'large' ? DISH_DESIGN * SCALE : DISH_DESIGN;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (ruined) {
      ctx.drawImage(getDishSprite(dish, bucket, false), 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(28,20,14,0.55)';
      ctx.fillRect(0, 0, px, px);
      ctx.globalCompositeOperation = 'source-over';
      const k = px / DISH_DESIGN;
      ctx.save();
      ctx.translate(px / 2, px / 2);
      ctx.scale(k, k);
      const puffs = [[-10, -30, 7, 0.5], [-2, -38, 9, 0.45], [8, -30, 6.5, 0.5], [2, -46, 7, 0.4]];
      for (let i = 0; i < puffs.length; ++i)
        dot(ctx, puffs[i][0], puffs[i][1], puffs[i][2], 'rgba(70,62,56,' + puffs[i][3] + ')');
      ctx.fillStyle = 'rgba(30,22,16,0.5)';
      for (let i = 0; i < 6; ++i) dot(ctx, -24 + i * 9, 14 + (i % 3) * 4, 2.4, 'rgba(30,22,16,0.5)');
      ctx.restore();
    } else {
      ctx.translate(px / 2, px / 2);
      ctx.scale(px / DISH_DESIGN, px / DISH_DESIGN);
      DISH_PAINTERS[dish](ctx);
    }
    dishCache[key] = canvas;
    return canvas;
  }

  /* getDish returns the cached good-quality sprite: large 192 x 192, small 96 x 96. */
  function getDish(id, size) {
    return getDishSprite(id, size === 'large' ? 'large' : 'small', false);
  }

  /* Golden sparkle ring painted behind a perfectly cooked dish. */
  const ringCache = {};

  function getRing(bucket) {
    const hit = ringCache[bucket];
    if (hit) return hit;
    const px = bucket === 'large' ? 120 * SCALE : 120;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.translate(px / 2, px / 2);
    ctx.scale(px / 120, px / 120);
    const g = ctx.createRadialGradient(0, 0, 44, 0, 0, 58);
    g.addColorStop(0, 'rgba(255,210,63,0)');
    g.addColorStop(0.55, 'rgba(255,210,63,0.5)');
    g.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, TWO_PI);
    ctx.fill();
    for (let i = 0; i < 6; ++i) {
      const a = i * TWO_PI / 6 + 0.4;
      const x = 52 * Math.cos(a);
      const y = 52 * Math.sin(a);
      sparkle(ctx, x, y, 6 + (i % 2) * 2.5, '#ffd23f');
    }
    ringCache[bucket] = canvas;
    return canvas;
  }

  function sparkle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y);
    ctx.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y);
    ctx.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    dot(ctx, x - r * 0.15, y - r * 0.15, r * 0.22, 'rgba(255,255,255,0.8)');
  }

  /* drawDish blits the cached sprite centred on (cx, cy) at the logical size. */
  function drawDish(ctx, id, cx, cy, size = 48, alpha = 1, quality = 'good') {
    const ruined = quality === 'ruined';
    const bucket = size > DISH_DESIGN / 2 ? 'large' : 'small';
    const img = getDishSprite(id, bucket, ruined);
    const base = ctx.globalAlpha === undefined ? 1 : ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = base * (alpha === undefined ? 1 : alpha);
    if (quality === 'perfect') {
      const ring = getRing(bucket);
      const rs = size * 1.25;
      ctx.drawImage(ring, cx - rs / 2, cy - rs / 2, rs, rs);
    }
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  }

  /* ── small ingredient sprites shown on the stations ── */

  const ING_DESIGN = 28;

  function paintIngPatty(ctx) {
    ell(ctx, 0, 1, 11, 4.5, bodyGradient(ctx, '#6b3a1e', -11, -3, 11, 5), OUTLINE, 2);
    ell(ctx, 0, -2, 11, 4, '#7a4526', OUTLINE, 2);
    gloss(ctx, -4, -4, 3.4, 1.4, 0.3);
  }

  function paintIngLeaf(ctx) {
    ell(ctx, -4, 2, 7, 5, '#4fae3a', OUTLINE, 1.5);
    ell(ctx, 4, -1, 7.5, 5.5, '#6cc04a', OUTLINE, 1.5);
    line(ctx, 0, 4, 3, -4, '#3f9a30', 1.4);
  }

  function paintIngShell(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 3, 11, 11, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, '#f2c14e', -11, -8, 11, 14);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    dot(ctx, -3, 0, 3, '#6cc04a');
    dot(ctx, 4, 0, 3, '#8a4a2a');
  }

  function paintIngPancake(ctx) {
    ell(ctx, 0, 0, 11, 5.5, bodyGradient(ctx, '#e8b04a', -11, -5, 11, 5), OUTLINE, 2);
    ell(ctx, 0, -1.5, 8, 3.4, '#c8781e');
    gloss(ctx, -4, -3, 3, 1.2, 0.3);
  }

  function paintIngNoodles(ctx) {
    ell(ctx, 0, 1, 10, 6, bodyGradient(ctx, '#f2cf5a', -10, -5, 10, 7), OUTLINE, 2);
    ctx.strokeStyle = '#d8a83a';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.moveTo(-8, -2 + i * 3);
      ctx.quadraticCurveTo(0, -5 + i * 3.4, 8, -2 + i * 3);
      ctx.stroke();
    }
  }

  function paintIngDough(ctx) {
    ell(ctx, 0, 0, 11, 9, bodyGradient(ctx, '#e8c88a', -11, -9, 11, 9), OUTLINE, 2);
    dot(ctx, -3, -2, 1.4, 'rgba(160,120,60,0.5)');
    dot(ctx, 4, 2, 1.4, 'rgba(160,120,60,0.5)');
    gloss(ctx, -4, -4, 3.4, 2, 0.3);
  }

  function paintIngSteak(ctx) {
    ell(ctx, 0, 0, 11, 7.5, bodyGradient(ctx, '#8a4a2a', -11, -7, 11, 7), OUTLINE, 2);
    ctx.strokeStyle = 'rgba(42,22,12,0.7)';
    ctx.lineWidth = 1.8;
    for (let i = -1; i <= 1; ++i) {
      ctx.beginPath();
      ctx.moveTo(-6 + i * 5, -6);
      ctx.lineTo(-2 + i * 5, 6);
      ctx.stroke();
    }
  }

  function paintIngCurry(ctx) {
    ell(ctx, 0, 1, 10, 6.5, '#d8781e', OUTLINE, 2);
    dot(ctx, -3, 0, 2.4, '#8a4a2a');
    dot(ctx, 4, 1, 2.2, '#e8b04a');
    dot(ctx, 0, 4, 1.6, '#6cc04a');
    gloss(ctx, -4, -2, 2.6, 1, 0.3);
  }

  function paintIngNigiri(ctx) {
    ell(ctx, 0, 3, 9, 4.5, '#f5f2e8', OUTLINE, 1.5);
    ctx.save();
    ctx.translate(0, -1);
    ctx.rotate(-0.1);
    ell(ctx, 0, 0, 9.5, 4, bodyGradient(ctx, '#f2703a', -9, -4, 9, 4), OUTLINE, 1.5);
    ctx.restore();
  }

  function paintIngRamen(ctx) {
    paintIngNoodles(ctx);
    dot(ctx, 6, -4, 2.6, '#f7f2e0', OUTLINE, 1);
    dot(ctx, 6, -4.6, 1.2, '#f2a03a');
  }

  function paintIngCake(ctx) {
    ctx.beginPath();
    ctx.moveTo(-8, 7);
    ctx.lineTo(8, 7);
    ctx.lineTo(8, -7);
    ctx.closePath();
    ctx.fillStyle = '#f7e6c8';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e8b04a';
    ctx.fillRect(-6, 1, 13, 3);
    dot(ctx, 8, -8, 2.6, '#d8302a', OUTLINE, 1.2);
  }

  function paintIngLobster(ctx) {
    ell(ctx, 0, -2, 7, 6, bodyGradient(ctx, '#d8302a', -7, -8, 7, 4), OUTLINE, 2);
    ell(ctx, 0, 5, 5.5, 2.6, shade('#d8302a', -0.1), OUTLINE, 1.5);
    ell(ctx, 0, 8.6, 4, 2.2, shade('#d8302a', -0.05), OUTLINE, 1.4);
    gloss(ctx, -2, -5, 2.4, 1.2, 0.3);
  }

  function paintIngBlob(ctx, id) {
    let h = 0;
    for (let i = 0; i < id.length; ++i) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    const hue = h % 360;
    const color = 'hsl(' + hue + ',60%,55%)';
    ell(ctx, 0, 1, 9.5, 7, color, OUTLINE, 2);
    gloss(ctx, -3, -3, 3, 1.6, 0.3);
  }

  const ING_PAINTERS = {
    burger: paintIngPatty, salad: paintIngLeaf, tacos: paintIngShell, pancakes: paintIngPancake,
    pasta: paintIngNoodles, pizza: paintIngDough, steak: paintIngSteak, curry: paintIngCurry,
    sushi: paintIngNigiri, ramen: paintIngRamen, cake: paintIngCake, lobster: paintIngLobster
  };

  const ingCache = {};

  function getIngredient(id) {
    const known = !!ING_PAINTERS[id];
    const key = known ? id : 'blob:' + id;
    const hit = ingCache[key];
    if (hit) return hit;
    const px = ING_DESIGN * SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.translate(px / 2, px / 2);
    ctx.scale(SCALE, SCALE);
    if (known) ING_PAINTERS[id](ctx);
    else paintIngBlob(ctx, String(id));
    ingCache[key] = canvas;
    return canvas;
  }

  /* ── the five kitchen stations, painted in a 150 x 120 box ── */

  function flame(ctx, x, y, h, w) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.8, y - h * 0.55, x - w * 0.2, y - h * 0.7);
    ctx.quadraticCurveTo(x, y - h, x + w * 0.15, y - h * 0.72);
    ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.5, x + w, y);
    ctx.closePath();
    const g = ctx.createLinearGradient(x, y, x, y - h);
    g.addColorStop(0, '#ff8a2a');
    g.addColorStop(0.6, '#ffb03a');
    g.addColorStop(1, '#ffe08a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, y);
    ctx.quadraticCurveTo(x - w * 0.3, y - h * 0.4, x, y - h * 0.55);
    ctx.quadraticCurveTo(x + w * 0.3, y - h * 0.38, x + w * 0.45, y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,240,160,0.85)';
    ctx.fill();
  }

  function smokePuff(ctx, x, y, r, alpha) {
    glowDot(ctx, x, y, r, '#5a524a', alpha);
    dot(ctx, x, y, r * 0.55, 'rgba(72,66,60,' + (alpha * 1.4) + ')');
  }

  function steamWisp(ctx, x, y, h, phase) {
    ctx.strokeStyle = 'rgba(240,244,248,0.4)';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 5 + phase * 3, y - h * 0.4, x + phase * 2, y - h * 0.7);
    ctx.quadraticCurveTo(x + 4 - phase * 2, y - h * 0.85, x + 1, y - h);
    ctx.stroke();
  }

  const FLAME_H = [13, 19, 15, 21];

  function paintGrill(ctx, state, frame) {
    line(ctx, 48, 92, 40, 112, '#4a4a52', 5);
    line(ctx, 102, 92, 110, 112, '#4a4a52', 5);
    line(ctx, 42, 104, 108, 104, '#4a4a52', 4);
    ctx.beginPath();
    ctx.ellipse(75, 72, 42, 26, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, '#4a4a52', 33, 46, 117, 98);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    const hot = state === 'working' || state === 'burning';
    const coal = state === 'burning' ? '#ff4a1a' : hot ? '#ff6a2a' : '#6a2a1a';
    for (let i = 0; i < 7; ++i) {
      const x = 45 + i * 10;
      if (hot) glowDot(ctx, x, 78, 8, coal, state === 'burning' ? 0.6 : 0.4);
      dot(ctx, x, 78, 3.4, hot ? coal : '#5a2416');
    }
    ell(ctx, 75, 72, 42, 7, bodyGradient(ctx, '#5a5a62', 33, 65, 117, 79), OUTLINE, 2);
    ctx.strokeStyle = '#3a3a42';
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; ++i) {
      ctx.beginPath();
      ctx.moveTo(36, 66 + i * 5);
      ctx.lineTo(114, 66 + i * 5);
      ctx.stroke();
    }
    if (state === 'working') {
      const xs = [55, 75, 95];
      for (let i = 0; i < xs.length; ++i)
        flame(ctx, xs[i], 64, FLAME_H[(frame + i) % 4], 7);
    }
    if (state === 'burning') {
      glowDot(ctx, 75, 74, 46, '#ff3a1a', 0.35);
      const puffs = [[62, 44], [78, 34], [92, 46], [70, 24]];
      for (let i = 0; i < puffs.length; ++i)
        smokePuff(ctx, puffs[i][0] + (frame % 2) * 3, puffs[i][1] - frame * 2, 8 + (i % 3) * 3, 0.4 - i * 0.06);
    }
  }

  function paintStove(ctx, state, frame) {
    rrect(ctx, 22, 62, 106, 44, 6, bodyGradient(ctx, '#c8ccd4', 22, 62, 128, 106), OUTLINE, 2);
    rrect(ctx, 22, 56, 106, 10, 4, '#d8dce4', OUTLINE, 2);
    dot(ctx, 48, 61, 10, '#3a3a42', OUTLINE, 1.5);
    dot(ctx, 104, 61, 10, '#3a3a42', OUTLINE, 1.5);
    dot(ctx, 48, 61, 5.5, '#2a2a30');
    dot(ctx, 104, 61, 5.5, '#2a2a30');
    if (state === 'working') glowDot(ctx, 48, 61, 12, '#4aa3ff', 0.5);
    dot(ctx, 34, 92, 4, '#8a909a', OUTLINE, 1.2);
    dot(ctx, 48, 92, 4, '#8a909a', OUTLINE, 1.2);
    rrect(ctx, 88, 30, 32, 28, 4, bodyGradient(ctx, '#8a909a', 88, 30, 120, 58), OUTLINE, 2);
    rrect(ctx, 82, 38, 6, 8, 2, '#6a707a', OUTLINE, 1.4);
    rrect(ctx, 120, 38, 6, 8, 2, '#6a707a', OUTLINE, 1.4);
    ell(ctx, 104, 30, 16, 4.5, '#a8aeb8', OUTLINE, 2);
    ell(ctx, 104, 30, 13, 3.2, state === 'idle' ? '#bfe0f0' : '#a8d0e8');
    if (state === 'working' || state === 'ready') {
      const bub = [[-8, 0], [-2, 1], [5, 0], [9, 1]];
      for (let i = 0; i < bub.length; ++i) {
        const on = (frame + i) % 2 === 0 || state === 'ready';
        if (on) dot(ctx, 104 + bub[i][0], 29 + bub[i][1], 1.4, 'rgba(255,255,255,0.8)');
      }
      steamWisp(ctx, 98, 24, 16 + (frame % 2) * 4, frame % 3);
      steamWisp(ctx, 110, 24, 14 + ((frame + 1) % 2) * 4, (frame + 2) % 3);
    }
    if (state === 'burning') {
      for (let i = 0; i < 3; ++i)
        smokePuff(ctx, 100 + i * 6, 22 - i * 9 - frame * 2, 7 + i * 2, 0.42 - i * 0.08);
    }
  }

  function paintOven(ctx, state, frame) {
    rrect(ctx, 28, 18, 94, 88, 8, bodyGradient(ctx, '#d8dce4', 28, 18, 122, 106), OUTLINE, 2);
    rrect(ctx, 28, 18, 94, 16, 6, '#e8ecf2', OUTLINE, 2);
    dot(ctx, 44, 26, 3.4, '#8a909a', OUTLINE, 1.2);
    dot(ctx, 56, 26, 3.4, '#8a909a', OUTLINE, 1.2);
    dot(ctx, 106, 26, 3.4, state === 'idle' ? '#8a909a' : '#ff8a2a', OUTLINE, 1.2);
    rrect(ctx, 40, 36, 70, 5, 2.5, '#c8ccd4', OUTLINE, 1.5);
    rrect(ctx, 38, 44, 74, 52, 6, bodyGradient(ctx, '#8a909a', 38, 44, 112, 96), OUTLINE, 2);
    rrect(ctx, 48, 52, 54, 30, 4, '#241c14', OUTLINE, 2);
    if (state === 'working' || state === 'ready') {
      const flick = [0.5, 0.62, 0.55, 0.68];
      const a = state === 'ready' ? 0.85 : flick[frame];
      const g = ctx.createRadialGradient(75, 70, 4, 75, 70, 30);
      g.addColorStop(0, 'rgba(255,170,58,' + a + ')');
      g.addColorStop(1, 'rgba(255,120,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(75, 70, 30, 0, TWO_PI);
      ctx.fill();
      dot(ctx, 75, 76, 7, state === 'ready' ? '#ffb03a' : '#c8781e');
    }
    if (state === 'burning') {
      rrect(ctx, 48, 52, 54, 30, 4, 'rgba(60,50,42,0.9)');
      for (let i = 0; i < 3; ++i)
        smokePuff(ctx, 58 + i * 18, 48 - i * 8 - frame * 2, 7 + (i % 2) * 3, 0.42 - i * 0.07);
    }
  }

  function paintBoard(ctx, state, frame) {
    rrect(ctx, 32, 62, 86, 40, 8, bodyGradient(ctx, '#c08a4a', 32, 62, 118, 102), OUTLINE, 2);
    ctx.strokeStyle = 'rgba(90,50,20,0.4)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; ++i) {
      ctx.beginPath();
      ctx.moveTo(38, 70 + i * 10);
      ctx.lineTo(112, 70 + i * 10);
      ctx.stroke();
    }
    if (state === 'working') {
      const pieces = [[52, 84], [64, 90], [76, 82], [88, 88], [70, 76]];
      const cols = ['#e8452a', '#6cc04a', '#f2cf5a', '#e8452a', '#6cc04a'];
      for (let i = 0; i < pieces.length; ++i) {
        ctx.save();
        ctx.translate(pieces[i][0], pieces[i][1]);
        ctx.rotate(i * 0.7);
        rrect(ctx, -3, -3, 6, 6, 1.4, cols[i], OUTLINE, 1.2);
        ctx.restore();
      }
    }
    const chop = state === 'working' ? [0, -9, -2, -11][frame] : 0;
    ctx.save();
    ctx.translate(0, chop);
    ctx.rotate(state === 'working' ? [0, -0.12, -0.02, -0.16][frame] : 0);
    ctx.beginPath();
    ctx.moveTo(62, 44);
    ctx.lineTo(112, 38);
    ctx.lineTo(114, 48);
    ctx.lineTo(64, 54);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, '#c8ccd4', 62, 38, 114, 54);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    rrect(ctx, 40, 42, 24, 9, 4, '#5a3a1e', OUTLINE, 1.6);
    ctx.restore();
  }

  function paintPlateStation(ctx, state, frame) {
    rrect(ctx, 20, 74, 110, 32, 6, bodyGradient(ctx, '#e0d8c8', 20, 74, 130, 106), OUTLINE, 2);
    rrect(ctx, 20, 68, 110, 8, 3, '#efe8da', OUTLINE, 2);
    ell(ctx, 75, 76, 34, 12, '#f2ede2', OUTLINE, 2);
    ell(ctx, 75, 75, 26, 8.5, shade('#f2ede2', -0.06));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(75, 76, 30.5, 9.5, 0, Math.PI * 1.02, Math.PI * 1.78);
    ctx.stroke();
    if (state === 'working') {
      const spots = [[48, 60], [102, 58], [60, 92], [94, 90], [75, 52]];
      for (let i = 0; i < spots.length; ++i) {
        if ((frame + i) % 2 === 0)
          sparkle(ctx, spots[i][0], spots[i][1], 4 + (i % 2) * 2, '#ffd23f');
      }
    }
    if (state === 'ready') sparkle(ctx, 75, 52, 6, '#ffd23f');
  }

  const STATION_PAINTERS = {
    grill: paintGrill, stove: paintStove, oven: paintOven, board: paintBoard, plate: paintPlateStation
  };

  /* Where the small ingredient sprite sits on each station (design coords). */
  const CONTENT_POS = {
    grill: [75, 58], stove: [104, 27], oven: [75, 66], board: [75, 82], plate: null
  };

  const stationCache = {};

  function getStation(id, state, frame) {
    const key = id + ':' + state + ':' + frame;
    const hit = stationCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = ST_SW;
    canvas.height = ST_SH;
    const ctx = canvas.getContext('2d');
    ctx.translate(ST_PAD * SCALE, ST_PAD * SCALE);
    ctx.scale(SCALE, SCALE);
    STATION_PAINTERS[id](ctx, state, frame);
    stationCache[key] = canvas;
    return canvas;
  }

  /* drawStation blits the cached frame with (x, y) as the top-left of the
   * 150 x 120 box; t only picks one of four baked animation frames. */
  function drawStation(ctx, id, x, y, state, t, contents) {
    const st = STATION_PAINTERS[id] ? id : 'grill';
    const s = state === 'working' || state === 'ready' || state === 'burning' ? state : 'idle';
    let f = Math.floor((t || 0) * 6) % 4;
    if (f < 0) f += 4;
    if (s === 'idle' || s === 'ready') f = 0;
    ctx.drawImage(getStation(st, s, f), x - ST_PAD, y - ST_PAD, ST_W + 2 * ST_PAD, ST_H + 2 * ST_PAD);
    const pos = CONTENT_POS[st];
    if (contents && pos) {
      const sz = st === 'stove' ? 20 : 26;
      ctx.drawImage(getIngredient(contents), x + pos[0] - sz / 2, y + pos[1] - sz / 2, sz, sz);
    }
  }

  /* ── order-ticket icons ── */

  const ICON_DESIGN = 48;

  function paintIconFlame(ctx) {
    flame(ctx, 24, 40, 30, 14);
    glowDot(ctx, 24, 30, 20, '#ff8a2a', 0.3);
  }

  function paintIconPot(ctx) {
    rrect(ctx, 10, 18, 28, 22, 4, bodyGradient(ctx, '#8a909a', 10, 18, 38, 40), OUTLINE, 2);
    rrect(ctx, 5, 24, 5, 7, 2, '#6a707a', OUTLINE, 1.2);
    rrect(ctx, 38, 24, 5, 7, 2, '#6a707a', OUTLINE, 1.2);
    ell(ctx, 24, 18, 14, 4, '#a8aeb8', OUTLINE, 1.6);
    steamWisp(ctx, 20, 13, 9, 1);
    steamWisp(ctx, 29, 13, 8, 2);
  }

  function paintIconOven(ctx) {
    rrect(ctx, 8, 8, 32, 34, 4, bodyGradient(ctx, '#d8dce4', 8, 8, 40, 42), OUTLINE, 2);
    rrect(ctx, 13, 16, 22, 18, 3, '#241c14', OUTLINE, 1.6);
    glowDot(ctx, 24, 26, 12, '#ffaa3a', 0.7);
    dot(ctx, 14, 11.5, 2, '#8a909a');
    dot(ctx, 21, 11.5, 2, '#8a909a');
  }

  function paintIconKnife(ctx) {
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(38, 12);
    ctx.lineTo(41, 18);
    ctx.lineTo(13, 36);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, '#c8ccd4', 10, 12, 41, 36);
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.save();
    ctx.translate(10, 34);
    ctx.rotate(-0.42);
    rrect(ctx, -9, -3.5, 12, 7, 3, '#5a3a1e', OUTLINE, 1.4);
    ctx.restore();
  }

  function paintIconPlate(ctx) {
    ell(ctx, 24, 28, 17, 9, '#f2ede2', OUTLINE, 2);
    ell(ctx, 24, 27, 12, 5.6, shade('#f2ede2', -0.06));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(24, 28, 14.5, 7, 0, Math.PI * 1.02, Math.PI * 1.78);
    ctx.stroke();
    dot(ctx, 20, 24, 2.6, '#e8452a', OUTLINE, 1);
    ell(ctx, 27, 24, 3.4, 2.2, '#6cc04a', OUTLINE, 1);
  }

  const ICON_PAINTERS = {
    grill: paintIconFlame, stove: paintIconPot, oven: paintIconOven, board: paintIconKnife, plate: paintIconPlate
  };

  const iconCache = {};

  function getIcon(station) {
    const st = ICON_PAINTERS[station] ? station : 'plate';
    const hit = iconCache[st];
    if (hit) return hit;
    const px = ICON_DESIGN * SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ICON_PAINTERS[st](ctx);
    iconCache[st] = canvas;
    return canvas;
  }

  function drawStepIcon(ctx, station, cx, cy, size) {
    const s = size === undefined ? 24 : size;
    ctx.drawImage(getIcon(station), cx - s / 2, cy - s / 2, s, s);
  }

  SZ.FoodArt = Object.freeze({
    DISHES, getDish, drawDish, drawStation, drawStepIcon
  });
})();
