;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const PARTS = SZ.FlappySceneParts || (SZ.FlappySceneParts = {});

  /* Course-object sprites: per-biome gate body and cap, and the shared icicle, bat,
     laser emitter, fireball, coin frames and power-up bubbles (built on first use). */

  const {
    TWO_PI, GATE_W, GATE_TILE, CAP_W, CAP_H, ICICLE_W, ICICLE_H, BAT_W, BAT_H, FIRE_W, FIRE_H, FIRE_BALL,
    COIN_SIZE, BUBBLE_SIZE, BUBBLE_TINTS, rgba, shade, shadeRgba, makeCanvas
  } = PARTS.kit;

  /* ── Gates: a body tile that repeats vertically + one overhanging cap ── */

  /* the lava vein starts and ends at the same x so it continues across tiles */
  function veinPath(c) {
    c.beginPath();
    c.moveTo(40, 0);
    c.lineTo(30, 26);
    c.lineTo(44, 58);
    c.lineTo(32, 92);
    c.lineTo(40, GATE_TILE);
  }

  function capCrackPath(c) {
    c.beginPath();
    c.moveTo(10, 24);
    c.lineTo(26, 16);
    c.lineTo(44, 22);
    c.lineTo(62, 14);
    c.lineTo(78, 20);
  }

  function buildGateBody(style, rng) {
    const cv = makeCanvas(GATE_W, GATE_TILE);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, GATE_W, 0);
    g.addColorStop(0, style.dark);
    g.addColorStop(0.35, style.light);
    g.addColorStop(0.6, style.body);
    g.addColorStop(1, style.dark);
    c.fillStyle = g;
    c.fillRect(0, 0, GATE_W, GATE_TILE);

    const kind = style.kind;
    if (kind === 'pipe') {
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.fillRect(16, 0, 4, GATE_TILE);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(22, 0, 2, GATE_TILE);
    } else if (kind === 'pillar') {
      /* bands sit at 16 + 32k so the spacing stays even across the tile seam */
      for (let y = 16; y < GATE_TILE; y += 32) {
        c.fillStyle = shadeRgba(style.dark, -0.2, 0.8);
        c.fillRect(2, y, GATE_W - 4, 2);
        c.fillStyle = shadeRgba(style.light, 0.2, 0.5);
        c.fillRect(2, y + 2, GATE_W - 4, 1);
      }
    } else if (kind === 'ice') {
      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.lineWidth = 6;
      for (let i = 0; i < 3; ++i) {
        const x = 8 + i * 22;
        c.beginPath();
        c.moveTo(x, 10 + i * 14);
        c.lineTo(x + 26, 70 + i * 18);
        c.stroke();
      }
      c.strokeStyle = shadeRgba(style.dark, -0.1, 0.6);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(50, 12);
      c.lineTo(42, 44);
      c.lineTo(54, 78);
      c.lineTo(46, 110);
      c.stroke();
    } else if (kind === 'log') {
      c.strokeStyle = shadeRgba(style.dark, -0.15, 0.7);
      c.lineWidth = 1.5;
      for (let i = 0; i < 4; ++i) {
        const x = 12 + i * 15;
        c.beginPath();
        c.moveTo(x, 0);
        c.bezierCurveTo(x + 3, 40, x - 3, 88, x, GATE_TILE);
        c.stroke();
      }
      for (let i = 0; i < 2; ++i) {
        const kx = 20 + i * 30;
        const ky = 34 + i * 56;
        c.fillStyle = shadeRgba(style.dark, -0.1, 0.8);
        c.beginPath();
        c.ellipse(kx, ky, 5, 7, 0, 0, TWO_PI);
        c.fill();
        c.strokeStyle = shadeRgba(style.light, 0.1, 0.5);
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(kx, ky, 2.5, 4, 0, 0, TWO_PI);
        c.stroke();
      }
    } else if (kind === 'neon') {
      c.fillStyle = shadeRgba(style.dark, -0.3, 0.9);
      c.fillRect(2, 62, GATE_W - 4, 2);
      c.fillStyle = shadeRgba(style.light, 0.25, 0.5);
      c.fillRect(2, 64, GATE_W - 4, 1);
      c.fillStyle = style.neon[0];
      c.fillRect(3, 0, 3, GATE_TILE);
      c.fillStyle = style.neon[1];
      c.fillRect(GATE_W - 6, 0, 3, GATE_TILE);
    } else { /* basalt */
      c.strokeStyle = shadeRgba(style.dark, -0.25, 0.8);
      c.lineWidth = 1.5;
      for (let row = 0; row < 4; ++row) {
        const y = 16 + row * 32;
        for (let col = 0; col < 3; ++col) {
          const x = 10 + col * 20 + (row % 2 ? 10 : 0);
          c.beginPath();
          for (let k = 0; k < 6; ++k) {
            const a = TWO_PI * (k + 0.5) / 6;
            const px = x + Math.cos(a) * 11;
            const py = y + Math.sin(a) * 11;
            if (k === 0) c.moveTo(px, py);
            else c.lineTo(px, py);
          }
          c.closePath();
          c.stroke();
        }
      }
      c.strokeStyle = rgba(style.glow, 0.35);
      c.lineWidth = 7;
      veinPath(c);
      c.stroke();
      c.strokeStyle = style.glow;
      c.lineWidth = 2.5;
      veinPath(c);
      c.stroke();
      c.strokeStyle = '#ffd2a0';
      c.lineWidth = 1;
      veinPath(c);
      c.stroke();
    }

    /* only vertical edge outlines - horizontal ones would seam every tile */
    c.fillStyle = shade(style.dark, -0.35);
    c.fillRect(0, 0, 2, GATE_TILE);
    c.fillRect(GATE_W - 2, 0, 2, GATE_TILE);
    return cv;
  }

  function buildGateCap(style, rng) {
    const cv = makeCanvas(CAP_W, CAP_H);
    const c = cv.getContext('2d');
    const kind = style.kind;
    const g = c.createLinearGradient(0, 0, CAP_W, 0);
    g.addColorStop(0, shade(style.cap, -0.4));
    g.addColorStop(0.35, shade(style.cap, 0.3));
    g.addColorStop(0.62, style.cap);
    g.addColorStop(1, shade(style.cap, -0.4));
    c.fillStyle = g;
    c.fillRect(0, 0, CAP_W, CAP_H);
    c.strokeStyle = shade(style.cap, -0.5);
    c.lineWidth = 2;
    c.strokeRect(1, 1, CAP_W - 2, CAP_H - 2);
    c.fillStyle = shadeRgba(style.cap, 0.55, 0.75);
    c.fillRect(4, 3, CAP_W - 8, 2);

    if (kind === 'log') {
      /* moss rim with grass tips poking over the top edge */
      c.strokeStyle = shade('#5aa832', 0.15);
      c.lineWidth = 2;
      for (let i = 0; i < 10; ++i) {
        const x = 6 + i * 8;
        c.beginPath();
        c.moveTo(x, 4);
        c.lineTo(x + (i % 2 ? 2 : -2), 0);
        c.stroke();
      }
    } else if (kind === 'neon') {
      c.fillStyle = rgba(style.neon[0], 0.3);
      c.fillRect(4, 22, CAP_W - 8, 6);
      c.fillStyle = style.neon[0];
      c.fillRect(4, 24, CAP_W - 8, 2);
    } else if (kind === 'ice') {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(2, CAP_H - 9, CAP_W - 4, 2);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.fillRect(2, CAP_H - 7, CAP_W - 4, 5);
    } else if (kind === 'basalt') {
      c.strokeStyle = rgba(style.glow, 0.4);
      c.lineWidth = 5;
      capCrackPath(c);
      c.stroke();
      c.strokeStyle = style.glow;
      c.lineWidth = 2;
      capCrackPath(c);
      c.stroke();
    } else if (kind === 'pillar') {
      c.fillStyle = shadeRgba(style.cap, -0.35, 0.8);
      c.fillRect(4, CAP_H - 8, CAP_W - 8, 2);
    }
    return cv;
  }

  /* ── Shared hazard sprites (built once, used by every biome) ── */

  function buildIcicle() {
    const cv = makeCanvas(ICICLE_W, ICICLE_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, ICICLE_W, 0);
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(0.45, '#9fd8f0');
    g.addColorStop(1, '#4f9ac0');
    c.beginPath();
    c.moveTo(ICICLE_W / 2, ICICLE_H);
    c.lineTo(3, 6);
    c.lineTo(ICICLE_W - 3, 6);
    c.closePath();
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = 'rgba(79,154,192,0.9)';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(7, 12);
    c.lineTo(ICICLE_W / 2 - 1, ICICLE_H - 12);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(ICICLE_W, 0);
    c.lineTo(ICICLE_W, 6);
    c.lineTo(ICICLE_W * 0.75, 10);
    c.lineTo(ICICLE_W * 0.5, 5);
    c.lineTo(ICICLE_W * 0.25, 11);
    c.lineTo(0, 6);
    c.closePath();
    c.fill();
    return cv;
  }

  function buildBat(frame) {
    const cv = makeCanvas(BAT_W, BAT_H);
    const c = cv.getContext('2d');
    const up = frame === 0;
    const cx = BAT_W / 2;
    const cy = 15;
    c.fillStyle = '#241a32';
    for (let s = -1; s <= 1; s += 2) {
      c.beginPath();
      c.moveTo(cx + s * 5, cy - 2);
      c.quadraticCurveTo(cx + s * 14, cy + (up ? -12 : 10), cx + s * 21, cy + (up ? -10 : 8));
      c.quadraticCurveTo(cx + s * 16, cy + 2, cx + s * 18, cy + 6);
      c.quadraticCurveTo(cx + s * 10, cy + 4, cx + s * 5, cy + 4);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(150,130,190,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx + s * 6, cy);
      c.lineTo(cx + s * 19, cy + (up ? -8 : 6));
      c.moveTo(cx + s * 6, cy + 2);
      c.lineTo(cx + s * 16, cy + 4);
      c.stroke();
    }
    c.fillStyle = '#2a1e3a';
    c.beginPath();
    c.ellipse(cx, cy + 2, 6, 7, 0, 0, TWO_PI);
    c.fill();
    c.beginPath();
    c.arc(cx, cy - 5, 5.5, 0, TWO_PI);
    c.fill();
    c.beginPath();
    c.moveTo(cx - 5, cy - 8);
    c.lineTo(cx - 3, cy - 13);
    c.lineTo(cx - 1, cy - 8);
    c.moveTo(cx + 5, cy - 8);
    c.lineTo(cx + 3, cy - 13);
    c.lineTo(cx + 1, cy - 8);
    c.fill();
    for (let s = -1; s <= 1; s += 2) {
      const ex = cx + s * 2.5;
      const ey = cy - 5;
      const halo = c.createRadialGradient(ex, ey, 0.5, ex, ey, 4);
      halo.addColorStop(0, 'rgba(255,58,58,0.8)');
      halo.addColorStop(1, 'rgba(255,58,58,0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(ex, ey, 4, 0, TWO_PI);
      c.fill();
      c.fillStyle = '#ff3a3a';
      c.beginPath();
      c.arc(ex, ey, 1.3, 0, TWO_PI);
      c.fill();
    }
    return cv;
  }

  function buildEmitter(lens) {
    const cv = makeCanvas(24, 16);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 16);
    g.addColorStop(0, '#8a90a0');
    g.addColorStop(0.5, '#5a6070');
    g.addColorStop(1, '#33384a');
    c.fillStyle = g;
    c.fillRect(0, 0, 24, 16);
    c.strokeStyle = '#20242e';
    c.lineWidth = 2;
    c.strokeRect(1, 1, 22, 14);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(3, 2, 18, 2);
    const halo = c.createRadialGradient(12, 8, 1, 12, 8, 7);
    halo.addColorStop(0, lens);
    halo.addColorStop(1, rgba(lens, 0));
    c.fillStyle = halo;
    c.beginPath();
    c.arc(12, 8, 7, 0, TWO_PI);
    c.fill();
    c.fillStyle = lens;
    c.beginPath();
    c.arc(12, 8, 3, 0, TWO_PI);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(11, 7, 1, 0, TWO_PI);
    c.fill();
    return cv;
  }

  /* a ball of fire with a tail: the ball sits at (FIRE_BALL, FIRE_BALL) inside the
   * sprite and the flame tail points DOWN, so the sprite reads for a rising fireball */
  function buildFireball() {
    const cv = makeCanvas(FIRE_W, FIRE_H);
    const c = cv.getContext('2d');
    const bx = FIRE_BALL, by = FIRE_BALL;
    const glow = c.createRadialGradient(bx, by, 4, bx, by, 30);
    glow.addColorStop(0, rgba('#ff7a1a', 0.45));
    glow.addColorStop(1, rgba('#ff7a1a', 0));
    c.fillStyle = glow;
    c.beginPath();
    c.arc(bx, by, 30, 0, TWO_PI);
    c.fill();
    // three overlapping teardrops hanging below the ball, the middle one longest
    const flames = [
      { dx: -8, w: 6, len: 26 },
      { dx: 0, w: 9, len: 40 },
      { dx: 8, w: 6, len: 26 }
    ];
    for (let i = 0; i < flames.length; ++i) {
      const f = flames[i];
      const y0 = by + 8;
      const y1 = y0 + f.len;
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(255,170,60,0.85)');
      g.addColorStop(0.5, 'rgba(255,74,16,0.5)');
      g.addColorStop(1, 'rgba(255,40,10,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(bx + f.dx - f.w, y0);
      c.quadraticCurveTo(bx + f.dx - f.w * 0.45, y0 + f.len * 0.62, bx + f.dx, y1);
      c.quadraticCurveTo(bx + f.dx + f.w * 0.45, y0 + f.len * 0.62, bx + f.dx + f.w, y0);
      c.closePath();
      c.fill();
    }
    const body = c.createRadialGradient(bx, by, 2, bx, by, 17);
    body.addColorStop(0, '#fff6c0');
    body.addColorStop(0.55, '#ffb020');
    body.addColorStop(1, '#ff4a10');
    c.fillStyle = body;
    c.beginPath();
    c.arc(bx, by, 17, 0, TWO_PI);
    c.fill();
    return cv;
  }

  /* ── Coins: eight spin frames, squashed by |cos| ── */

  function starPath(c, cx, cy, ro, ri, points) {
    c.beginPath();
    for (let k = 0; k < points * 2; ++k) {
      const r = (k & 1) ? ri : ro;
      const a = -Math.PI / 2 + k * Math.PI / points;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  }

  function buildCoinFrame(k) {
    const cv = makeCanvas(COIN_SIZE, COIN_SIZE);
    const c = cv.getContext('2d');
    const sx = Math.max(0.15, Math.abs(Math.cos(k * Math.PI / 8)));
    const cx = COIN_SIZE / 2;
    const cy = COIN_SIZE / 2;
    const r = 16;
    const g = c.createRadialGradient(cx - r * 0.3 * sx, cy - r * 0.35, r * 0.15, cx, cy, r);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(0.55, '#ffc21a');
    g.addColorStop(1, '#d48a00');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, cy, r * sx, r, 0, 0, TWO_PI);
    c.fill();
    c.strokeStyle = '#a86800';
    c.lineWidth = 2;
    c.stroke();
    if (sx > 0.45) {
      starPath(c, cx, cy, 8 * sx, 3.4 * sx, 5);
      c.fillStyle = '#e8a800';
      c.fill();
      starPath(c, cx - 0.8, cy - 0.8, 8 * sx, 3.4 * sx, 5);
      c.strokeStyle = 'rgba(255,240,170,0.9)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath();
    c.arc(cx - r * 0.45 * sx, cy - r * 0.5, 2.2, 0, TWO_PI);
    c.fill();
    return cv;
  }

  /* ── Power-up bubbles: translucent sphere + icon ── */

  function drawBubbleIcon(c, kind, tint) {
    const cx = BUBBLE_SIZE / 2;
    const cy = BUBBLE_SIZE / 2;
    if (kind === 'shield') {
      c.fillStyle = tint;
      c.beginPath();
      c.moveTo(cx - 12, cy - 14);
      c.lineTo(cx + 12, cy - 14);
      c.lineTo(cx + 12, cy + 2);
      c.quadraticCurveTo(cx + 12, cy + 12, cx, cy + 16);
      c.quadraticCurveTo(cx - 12, cy + 12, cx - 12, cy + 2);
      c.closePath();
      c.fill();
      c.strokeStyle = shade(tint, -0.4);
      c.lineWidth = 2;
      c.stroke();
      starPath(c, cx, cy - 1, 7, 3, 5);
      c.fillStyle = '#ffffff';
      c.fill();
    } else if (kind === 'magnet') {
      c.strokeStyle = tint;
      c.lineWidth = 7;
      c.beginPath();
      c.arc(cx, cy - 2, 10, Math.PI, TWO_PI);
      c.stroke();
      c.beginPath();
      c.moveTo(cx - 10, cy - 2);
      c.lineTo(cx - 10, cy + 10);
      c.moveTo(cx + 10, cy - 2);
      c.lineTo(cx + 10, cy + 10);
      c.stroke();
      c.strokeStyle = '#c8ccd8';
      c.beginPath();
      c.moveTo(cx - 10, cy + 10);
      c.lineTo(cx - 10, cy + 14);
      c.moveTo(cx + 10, cy + 10);
      c.lineTo(cx + 10, cy + 14);
      c.stroke();
    } else if (kind === 'slow') {
      c.fillStyle = '#f4f8ff';
      c.beginPath();
      c.arc(cx, cy, 13, 0, TWO_PI);
      c.fill();
      c.strokeStyle = tint;
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = '#3a2a5a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx, cy - 8);
      c.moveTo(cx, cy);
      c.lineTo(cx + 6, cy + 3);
      c.stroke();
    } else if (kind === 'ghost') {
      c.fillStyle = tint;
      c.beginPath();
      c.arc(cx, cy - 2, 11, Math.PI, TWO_PI);
      c.lineTo(cx + 11, cy + 10);
      c.lineTo(cx + 6, cy + 5);
      c.lineTo(cx + 2, cy + 10);
      c.lineTo(cx - 2, cy + 5);
      c.lineTo(cx - 6, cy + 10);
      c.lineTo(cx - 11, cy + 5);
      c.closePath();
      c.fill();
      c.fillStyle = '#2a3a4a';
      c.beginPath();
      c.arc(cx - 4, cy - 3, 2, 0, TWO_PI);
      c.arc(cx + 4, cy - 3, 2, 0, TWO_PI);
      c.fill();
    } else if (kind === 'double') {
      c.font = 'bold 24px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 4;
      c.strokeStyle = '#5a3a00';
      c.strokeText('x2', cx, cy + 1);
      c.fillStyle = tint;
      c.fillText('x2', cx, cy + 1);
    } else { /* tiny */
      c.fillStyle = tint;
      c.beginPath();
      c.ellipse(cx, cy, 9, 7, 0, 0, TWO_PI);
      c.fill();
      c.beginPath();
      c.moveTo(cx + 6, cy - 2);
      c.lineTo(cx + 14, cy - 6);
      c.lineTo(cx + 8, cy + 2);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(cx - 9, cy - 1);
      c.lineTo(cx - 15, cy - 4);
      c.lineTo(cx - 15, cy + 2);
      c.closePath();
      c.fill();
      c.strokeStyle = '#1e5a2a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - 14, cy + 10);
      c.lineTo(cx - 8, cy + 6);
      c.lineTo(cx - 11, cy + 5);
      c.moveTo(cx - 8, cy + 6);
      c.lineTo(cx - 9, cy + 9);
      c.moveTo(cx + 14, cy + 10);
      c.lineTo(cx + 8, cy + 6);
      c.lineTo(cx + 11, cy + 5);
      c.moveTo(cx + 8, cy + 6);
      c.lineTo(cx + 9, cy + 9);
      c.stroke();
    }
  }

  function buildBubble(kind) {
    const cv = makeCanvas(BUBBLE_SIZE, BUBBLE_SIZE);
    const c = cv.getContext('2d');
    const tint = BUBBLE_TINTS[kind];
    const cx = BUBBLE_SIZE / 2;
    const cy = BUBBLE_SIZE / 2;
    const r = 28;
    const g = c.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, rgba(tint, 0.25));
    g.addColorStop(1, rgba(tint, 0.6));
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, TWO_PI);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(cx, cy, r - 6, Math.PI * 1.05, Math.PI * 1.45);
    c.stroke();
    drawBubbleIcon(c, kind, tint);
    return cv;
  }

  /* built on first use, then shared by every biome's draw functions */
  let shared = null;

  function getShared() {
    if (shared) return shared;
    const coins = [];
    for (let k = 0; k < 8; ++k) coins.push(buildCoinFrame(k));
    const bubbles = {};
    for (const kind in BUBBLE_TINTS) bubbles[kind] = buildBubble(kind);
    shared = {
      icicle: buildIcicle(),
      bats: [buildBat(0), buildBat(1)],
      emitters: [buildEmitter('#ff3a3a'), buildEmitter('#3af2ff')],
      fireball: buildFireball(),
      coins: coins,
      bubbles: bubbles
    };
    return shared;
  }

  PARTS.sprites = { buildGateBody, buildGateCap, getShared };
})();
