;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Sprite art for the Space Invaders overhaul. Every alien species (two
   * animation frames plus a white hit-flash), every player ship (four engine
   * thrust steps), the escort drone, the bonus saucer, the six bosses (normal
   * and battle-damaged), the four bullet kinds, the nine power-up capsules and
   * the four explosion flares are painted ONCE into a cached canvas at 2x
   * resolution, with glows baked in as soft radial gradients inside the
   * transparent padding. The draw functions only translate/rotate and blit -
   * no blur filters, no gradients per frame.
   */

  const TWO_PI = Math.PI * 2;
  const SCALE = 2;

  const ALIEN_W = 36, ALIEN_H = 27, ALIEN_PAD = 8;
  const ALIEN_SW = (ALIEN_W + 2 * ALIEN_PAD) * SCALE;   // 104
  const ALIEN_SH = (ALIEN_H + 2 * ALIEN_PAD) * SCALE;   // 86

  const SHIP_W = 45, SHIP_H = 24;
  const SHIP_PAD_X = 10, SHIP_PAD_TOP = 10, SHIP_PAD_BOTTOM = 20;
  const SHIP_SW = (SHIP_W + 2 * SHIP_PAD_X) * SCALE;    // 130
  const SHIP_SH = (SHIP_H + SHIP_PAD_TOP + SHIP_PAD_BOTTOM) * SCALE; // 108
  const SHIP_LW = SHIP_SW / SCALE, SHIP_LH = SHIP_SH / SCALE;
  const SHIP_CY = SHIP_LH / 2 - SHIP_PAD_TOP;           // sprite centre below the box top

  const DRONE_W = 24, DRONE_H = 15, DRONE_PAD = 8;
  const DRONE_SW = (DRONE_W + 2 * DRONE_PAD) * SCALE;   // 80
  const DRONE_SH = (DRONE_H + 2 * DRONE_PAD) * SCALE;   // 62

  const UFO_W = 48, UFO_H = 21, UFO_PAD = 8;
  const UFO_SW = (UFO_W + 2 * UFO_PAD) * SCALE;         // 128
  const UFO_SH = (UFO_H + 2 * UFO_PAD) * SCALE;         // 74

  const ALIENS = {
    1: { name: 'Squid', color: '#ff4a5a', dark: '#8a1424', glow: '#ff9aa6' },
    2: { name: 'Crab', color: '#ffd23f', dark: '#8a6a0c', glow: '#fff0a0' },
    3: { name: 'Octopus', color: '#5ae06a', dark: '#1a6e2a', glow: '#b8ffb0' },
    4: { name: 'Diver', color: '#ff8a2a', dark: '#8a3a0a', glow: '#ffd0a0' },
    5: { name: 'Warden', color: '#3af2ff', dark: '#0a6a80', glow: '#b0faff' },
    6: { name: 'Armored', color: '#9aa6c0', dark: '#3a4258', glow: '#ff5a3a' }
  };

  const SHIPS = [
    { id: 'interceptor', name: 'Interceptor', color: '#4aa3ff', accent: '#e8f4ff' },
    { id: 'striker', name: 'Striker', color: '#ff4a5a', accent: '#ffd23f' },
    { id: 'guardian', name: 'Guardian', color: '#5ae06a', accent: '#e8ffe8' },
    { id: 'phantom', name: 'Phantom', color: '#b06aff', accent: '#3af2ff' },
    { id: 'titan', name: 'Titan', color: '#ffb03a', accent: '#5a3a1a' }
  ];

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

  function luminance(hex) {
    const c = hexToRgb(hex);
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
  }

  /* ── shared painting helpers ── */

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

  /* Glowing eye: halo, iris, white core. */
  function eye(ctx, x, y, r, spec) {
    glowDot(ctx, x, y, r * 2.6, spec.glow, 0.55);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fillStyle = spec.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /* Light from the upper-left: bright top-left, base in the middle, dark underside. */
  function bodyGradient(ctx, color, dark, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, shade(color, 0.45));
    g.addColorStop(0.5, color);
    g.addColorStop(1, dark);
    return g;
  }

  function tracePoly(ctx, pts, mirror) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; ++i) {
      const p = pts[i];
      const x = mirror ? -p[0] : p[0];
      if (i === 0) ctx.moveTo(x, p[1]);
      else ctx.lineTo(x, p[1]);
    }
    ctx.closePath();
  }

  function fillPoly(ctx, pts, fill, line, mirror) {
    const copies = mirror ? 2 : 1;
    for (let m = 0; m < copies; ++m) {
      tracePoly(ctx, pts, m === 1);
      ctx.fillStyle = fill;
      ctx.fill();
      if (line) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = line;
        ctx.stroke();
      }
    }
  }

  /* A jointed limb (tentacle, leg): dark under-stroke, colored over-stroke. */
  function limb(ctx, x0, y0, cx, cy, x1, y1, color, dark) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  /* ── the six aliens, drawn in a 36 x 27 box centred on the origin ── */

  /* Squid: dome head, two glowing eyes, four tentacles that switch pose. */
  function paintSquid(ctx, spec, frame) {
    const spread = frame === 0;
    const tent = spread
      ? [[-10, 1, -12, 7, -14, 12], [-5, 1, -6, 8, -7, 13], [5, 1, 6, 8, 7, 13], [10, 1, 12, 7, 14, 12]]
      : [[-10, 1, -9, 6, -6, 10], [-5, 1, -5, 7, -3, 11], [5, 1, 5, 7, 3, 11], [10, 1, 9, 6, 6, 10]];
    for (let i = 0; i < tent.length; ++i) {
      const t = tent[i];
      limb(ctx, t[0], t[1], t[2], t[3], t[4], t[5], spec.color, spec.dark);
    }
    ctx.beginPath();
    ctx.moveTo(-13, 2);
    ctx.arc(0, 2, 13, Math.PI, TWO_PI);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, -9, -11, 9, 4);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 2, 10, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
    eye(ctx, -5, -3, 2.6, spec);
    eye(ctx, 5, -3, 2.6, spec);
  }

  /* Crab: wide armored shell, one big visor eye, four legs, pincers up or down. */
  function paintCrab(ctx, spec, frame) {
    const up = frame === 0;
    const legs = [[-12, 3, -14, 8, -16, 11], [-7, 4, -8, 9, -10, 12], [7, 4, 8, 9, 10, 12], [12, 3, 14, 8, 16, 11]];
    for (let i = 0; i < legs.length; ++i) {
      const l = legs[i];
      limb(ctx, l[0], l[1], l[2], l[3], l[4], l[5], spec.color, spec.dark);
    }
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      const cy = up ? -10 : 1;
      ctx.beginPath();
      ctx.moveTo(sx * 13, cy + 5);
      ctx.lineTo(sx * 10, cy - 3);
      ctx.lineTo(sx * 13, cy - 1);
      ctx.lineTo(sx * 16, cy - 3);
      ctx.closePath();
      ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, sx * 10, cy - 3, sx * 16, cy + 5);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
      limb(ctx, sx * 12, 2, sx * 14, cy + 3, sx * 13, cy + 4, spec.color, spec.dark);
    }
    ctx.beginPath();
    ctx.moveTo(-14, -6);
    ctx.lineTo(-10, -9);
    ctx.lineTo(10, -9);
    ctx.lineTo(14, -6);
    ctx.lineTo(15, 2);
    ctx.lineTo(10, 5);
    ctx.lineTo(-10, 5);
    ctx.lineTo(-15, 2);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, -10, -9, 10, 5);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.strokeStyle = spec.dark;
    ctx.beginPath();
    ctx.moveTo(-12, 1);
    ctx.lineTo(12, 1);
    ctx.stroke();
    ctx.globalAlpha = 1;
    glowDot(ctx, 0, -4, 12, spec.glow, 0.5);
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(8, -6);
    ctx.arc(8, -4, 2, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-8, -2);
    ctx.arc(-8, -4, 2, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = spec.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-6, -5, 12, 1.4);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /* Octopus: round blob, six short legs that pull in, eyes and a mouth line. */
  function paintOctopus(ctx, spec, frame) {
    const out = frame === 0;
    const xs = [-11, -6.5, -2, 2, 6.5, 11];
    for (let i = 0; i < xs.length; ++i) {
      const x = xs[i];
      const tip = out ? x * 1.35 : x * 0.55;
      limb(ctx, x, 4, x + (tip - x) * 0.4, 8, tip, out ? 12 : 11, spec.color, spec.dark);
    }
    ctx.beginPath();
    ctx.ellipse(0, -2, 12, 10, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, -8, -10, 8, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-3, -6, 5, 3, -0.4, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    eye(ctx, -4, -4, 2.4, spec);
    eye(ctx, 4, -4, 2.4, spec);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spec.dark;
    ctx.beginPath();
    ctx.arc(0, 1, 3.5, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();
  }

  /* Diver: dart aimed down, swept wings that fold in, engine glow at the top. */
  function paintDiver(ctx, spec, frame) {
    const folded = frame === 1;
    const wx = folded ? 12 : 17;
    const wy = folded ? -3 : -7;
    glowDot(ctx, 0, -10, 9, spec.glow, 0.55);
    const wing = [[5, -1], [wx, wy], [wx - 3, wy + 4], [6, 4]];
    fillPoly(ctx, wing, bodyGradient(ctx, shade(spec.color, -0.2), spec.dark, 5, wy, wx, 4), spec.dark, true);
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(5, 1);
    ctx.lineTo(5, -8);
    ctx.lineTo(0, -11);
    ctx.lineTo(-5, -8);
    ctx.lineTo(-5, 1);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, -5, -11, 5, 13);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-3, -12, 6, 2.5);
    ctx.fillStyle = '#2a2f3a';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    glowDot(ctx, 0, 10, 4, spec.glow, 0.7);
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.lineTo(2, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-2, 6);
    ctx.closePath();
    ctx.fillStyle = spec.glow;
    ctx.fill();
  }

  /* Warden: hexagonal body, faceted crystal core that pulses brighter. */
  function paintWarden(ctx, spec, frame) {
    const bright = frame === 1;
    const hex = [[0, -13], [11, -6.5], [11, 6.5], [0, 13], [-11, 6.5], [-11, -6.5]];
    fillPoly(ctx, hex, bodyGradient(ctx, spec.color, spec.dark, -8, -11, 8, 11), spec.dark, false);
    const inner = [[0, -10], [8.5, -5], [8.5, 5], [0, 10], [-8.5, 5], [-8.5, -5]];
    tracePoly(ctx, inner, false);
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(spec.dark, 0.8);
    ctx.stroke();
    glowDot(ctx, 0, 0, bright ? 12 : 9, spec.glow, bright ? 0.75 : 0.5);
    const core = [[0, -6], [5, 0], [0, 6], [-5, 0]];
    tracePoly(ctx, core, false);
    const cg = ctx.createLinearGradient(-5, -6, 5, 6);
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.5, spec.glow);
    cg.addColorStop(1, spec.color);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2.5, -3);
    ctx.lineTo(0, 0);
    ctx.lineTo(2.5, -3);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,' + (bright ? '0.95' : '0.6') + ')';
    ctx.stroke();
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(sx * 11, -2);
      ctx.lineTo(sx * 15, 0);
      ctx.lineTo(sx * 11, 2);
      ctx.closePath();
      ctx.fillStyle = spec.dark;
      ctx.fill();
    }
  }

  /* Armored: plated beetle carapace, riveted bands, one red glowing slit eye. */
  function paintArmored(ctx, spec, frame) {
    const shift = frame === 1 ? 1 : 0;
    const feet = [[-12, 6, -13, 10], [-6, 7, -6, 11], [6, 7, 6, 11], [12, 6, 13, 10]];
    for (let i = 0; i < feet.length; ++i) {
      const f = feet[i];
      limb(ctx, f[0], f[1], f[0], f[1] + 2, f[2], f[3], shade(spec.color, -0.3), spec.dark);
    }
    ctx.beginPath();
    ctx.ellipse(0, -1, 14, 10, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, -10, -9, 10, 8);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    const bands = [[-12, -6 + shift], [-11, -1 + shift], [-9, 4 + shift]];
    for (let i = 0; i < bands.length; ++i) {
      const half = bands[i][0], y = bands[i][1];
      ctx.beginPath();
      ctx.moveTo(half, y);
      ctx.quadraticCurveTo(0, y + 2.5, -half, y);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = hexToRgba(spec.dark, 0.85);
      ctx.stroke();
      for (let m = 0; m < 2; ++m) {
        const sx = m === 1 ? -1 : 1;
        ctx.beginPath();
        ctx.arc(sx * (half + 2), y + 0.6, 0.9, 0, TWO_PI);
        ctx.fillStyle = shade(spec.color, 0.5);
        ctx.fill();
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = spec.dark;
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, 9);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = hexToRgba(spec.dark, 0.7);
    ctx.stroke();
    glowDot(ctx, 0, -3, 8, spec.glow, 0.6);
    ctx.beginPath();
    ctx.rect(-7, -4, 14, 2.2);
    ctx.fillStyle = spec.glow;
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-5, -3.6, 10, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  const ALIEN_PAINTERS = { 1: paintSquid, 2: paintCrab, 3: paintOctopus, 4: paintDiver, 5: paintWarden, 6: paintArmored };

  /* ── the five ships, drawn in a 45 x 24 box centred on the origin, nose up ── */

  function cockpit(ctx, x, y, rx, ry) {
    const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    g.addColorStop(0, '#9fd8ff');
    g.addColorStop(0.45, '#1f4f8f');
    g.addColorStop(1, '#0a1a3a');
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TWO_PI);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#0a1220';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.35, y - ry * 0.4, rx * 0.32, ry * 0.22, -0.5, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
  }

  function nozzle(ctx, x, y, w, dark) {
    ctx.beginPath();
    ctx.rect(x - w / 2, y - 2, w, 3);
    ctx.fillStyle = '#2a2f3a';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark;
    ctx.stroke();
  }

  /* Engine flame: white core, accent/yellow, orange, transparent tip. */
  function flame(ctx, x, y, len, accent) {
    if (len <= 0) return;
    const mid = luminance(accent) < 120 ? '#ffd23f' : accent;
    const w = 2.2 + len * 0.18;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, mid);
    g.addColorStop(0.7, '#ff7a1a');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.6, y + len * 0.6, x, y + len);
    ctx.quadraticCurveTo(x + w * 0.6, y + len * 0.6, x + w, y);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    glowDot(ctx, x, y, w * 1.6, '#ffd23f', 0.5);
  }

  const FLAME_LEN = [0, 5, 9, 14];

  function panelLines(ctx, color, ys) {
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = shade(color, -0.55);
    for (let i = 0; i < ys.length; ++i) {
      ctx.beginPath();
      ctx.moveTo(-14, ys[i]);
      ctx.lineTo(14, ys[i]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintInterceptor(ctx, ship, thrust) {
    const dark = shade(ship.color, -0.6);
    const hull = bodyGradient(ctx, ship.color, dark, -16, -12, 16, 12);
    fillPoly(ctx, [[3, -1], [18, 8], [16, 11], [3, 6]], hull, dark, true);
    fillPoly(ctx, [[3, 1], [15, 8], [14, 9], [3, 3]], ship.accent, null, true);
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(4, -6);
    ctx.lineTo(5, 6);
    ctx.lineTo(3, 11);
    ctx.lineTo(-3, 11);
    ctx.lineTo(-5, 6);
    ctx.lineTo(-4, -6);
    ctx.closePath();
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    panelLines(ctx, ship.color, [-2, 4]);
    cockpit(ctx, 0, -5, 2.6, 3.6);
    nozzle(ctx, 0, 11, 7, dark);
    flame(ctx, 0, 12.5, FLAME_LEN[thrust], ship.accent);
  }

  function paintStriker(ctx, ship, thrust) {
    const dark = shade(ship.color, -0.6);
    const hull = bodyGradient(ctx, ship.color, dark, -16, -12, 16, 12);
    fillPoly(ctx, [[4, 7], [19, -1], [17, -4], [4, 2]], hull, dark, true);
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      ctx.beginPath();
      ctx.rect(sx === 1 ? 16.5 : -19, -9, 2.5, 8);
      ctx.fillStyle = '#3a4258';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark;
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(sx === 1 ? 16.5 : -19, -9, 2.5, 2);
      ctx.fillStyle = ship.accent;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, -5);
    ctx.lineTo(6, 6);
    ctx.lineTo(4, 11);
    ctx.lineTo(-4, 11);
    ctx.lineTo(-6, 6);
    ctx.lineTo(-4, -5);
    ctx.closePath();
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    fillPoly(ctx, [[4, 4], [14, -1], [13, -2], [4, 2]], ship.accent, null, true);
    panelLines(ctx, ship.color, [0, 5]);
    cockpit(ctx, 0, -4, 2.6, 3.4);
    nozzle(ctx, -3, 11, 4, dark);
    nozzle(ctx, 3, 11, 4, dark);
    flame(ctx, -3, 12.5, FLAME_LEN[thrust], ship.accent);
    flame(ctx, 3, 12.5, FLAME_LEN[thrust], ship.accent);
  }

  function paintGuardian(ctx, ship, thrust) {
    const dark = shade(ship.color, -0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 9, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, ship.color, dark, -16, -9, 16, 9);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 6.5, 0, 0, TWO_PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ship.accent;
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-6, -4, 8, 3, -0.25, Math.PI, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    panelLines(ctx, ship.color, [-1, 4]);
    cockpit(ctx, 0, -3, 3.4, 3);
    const xs = [-11, 0, 11];
    for (let i = 0; i < xs.length; ++i) {
      nozzle(ctx, xs[i], 9, 4, dark);
      flame(ctx, xs[i], 10.5, FLAME_LEN[thrust], ship.accent);
    }
  }

  function paintPhantom(ctx, ship, thrust) {
    const dark = shade(ship.color, -0.6);
    const delta = [[0, -12], [6, -2], [20, 10], [12, 10], [4, 6], [-4, 6], [-12, 10], [-20, 10], [-6, -2]];
    fillPoly(ctx, delta, bodyGradient(ctx, ship.color, dark, -16, -12, 16, 10), dark, false);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = ship.accent;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(20, 10);
    ctx.moveTo(0, -12);
    ctx.lineTo(-20, 10);
    ctx.stroke();
    glowDot(ctx, 0, -11, 5, ship.accent, 0.4);
    fillPoly(ctx, [[5, 0], [13, 8], [10, 8], [4, 3]], hexToRgba(ship.accent, 0.5), null, true);
    panelLines(ctx, ship.color, [2, 6]);
    cockpit(ctx, 0, -4, 2.4, 2.6);
    nozzle(ctx, -6, 10, 4, dark);
    nozzle(ctx, 6, 10, 4, dark);
    flame(ctx, -6, 11.5, FLAME_LEN[thrust], ship.accent);
    flame(ctx, 6, 11.5, FLAME_LEN[thrust], ship.accent);
  }

  function paintTitan(ctx, ship, thrust) {
    const dark = shade(ship.color, -0.6);
    const hull = bodyGradient(ctx, ship.color, dark, -18, -11, 18, 11);
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.lineTo(16, -8);
    ctx.lineTo(19, -2);
    ctx.lineTo(19, 8);
    ctx.lineTo(14, 11);
    ctx.lineTo(-14, 11);
    ctx.lineTo(-19, 8);
    ctx.lineTo(-19, -2);
    ctx.closePath();
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    fillPoly(ctx, [[-18, -1], [-8, -1], [-8, 3], [-18, 3]], shade(ship.color, -0.25), dark, true);
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      for (let i = 0; i < 2; ++i) {
        ctx.beginPath();
        ctx.arc(sx * (16 - i * 6), 1, 0.9, 0, TWO_PI);
        ctx.fillStyle = shade(ship.color, 0.5);
        ctx.fill();
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = dark;
        ctx.stroke();
      }
    }
    fillPoly(ctx, [[-14, 6], [14, 6], [14, 8], [-14, 8]], ship.accent, null, false);
    panelLines(ctx, ship.color, [-5, 0]);
    cockpit(ctx, 0, -3, 3.6, 3.2);
    nozzle(ctx, -9, 11, 7, dark);
    nozzle(ctx, 9, 11, 7, dark);
    flame(ctx, -9, 12.5, FLAME_LEN[thrust], ship.accent);
    flame(ctx, 9, 12.5, FLAME_LEN[thrust], ship.accent);
  }

  const SHIP_PAINTERS = {
    interceptor: paintInterceptor,
    striker: paintStriker,
    guardian: paintGuardian,
    phantom: paintPhantom,
    titan: paintTitan
  };

  /* ── escort drone: round pod, green eye, blinking beacon (2 frames) ── */

  function paintDrone(ctx, frame) {
    ctx.beginPath();
    ctx.rect(-9, 4, 4, 3);
    ctx.rect(5, 4, 4, 3);
    ctx.fillStyle = '#2a2f3a';
    ctx.fill();
    glowDot(ctx, -7, 8, 3, '#7db8ff', 0.5);
    glowDot(ctx, 7, 8, 3, '#7db8ff', 0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, '#8a96a8', '#3a4258', -8, -6, 8, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22283a';
    ctx.stroke();
    glowDot(ctx, 0, 0, 7, '#7dff9a', 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TWO_PI);
    ctx.fillStyle = '#7dff9a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-1, -1, 1.2, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    if (frame === 0) {
      glowDot(ctx, 0, -7, 5, '#ffd23f', 0.6);
      ctx.beginPath();
      ctx.arc(0, -7, 1.6, 0, TWO_PI);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, -7, 1.6, 0, TWO_PI);
      ctx.fillStyle = '#6a5a20';
      ctx.fill();
    }
  }

  /* ── bonus saucer: metallic disc, dome with a little pilot, 7 rim lights ── */

  function paintUfo(ctx, frame) {
    ctx.beginPath();
    ctx.ellipse(0, 3, 13, 5, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, '#6a5a8a', '#2a2440', -8, 0, 8, 8);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#241a38';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 6, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, '#9a8ac0', '#4a3a68', -18, -6, 18, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#241a38';
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e8e0ff';
    ctx.beginPath();
    ctx.ellipse(-6, -2, 10, 2.5, -0.1, Math.PI, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.arc(0, -2, 8, Math.PI, TWO_PI);
    ctx.closePath();
    const dg = ctx.createLinearGradient(-6, -9, 6, -2);
    dg.addColorStop(0, 'rgba(220,250,255,0.9)');
    dg.addColorStop(1, 'rgba(90,140,200,0.55)');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#241a38';
    ctx.stroke();
    ctx.fillStyle = '#1a4a2a';
    ctx.beginPath();
    ctx.ellipse(0, -4, 2.4, 2.8, 0, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -1, 3.2, 1.6, 0, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-3, -5, 4, Math.PI * 1.1, Math.PI * 1.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 7; ++i) {
      const a = Math.PI - (i + 0.5) * Math.PI / 7;
      const lx = 19 * Math.cos(a);
      const ly = 1.5 + 4 * Math.sin(a);
      const lit = i === frame;
      if (lit) glowDot(ctx, lx, ly, 5, '#b0faff', 0.7);
      ctx.beginPath();
      ctx.arc(lx, ly, 1.6, 0, TWO_PI);
      ctx.fillStyle = lit ? '#ffffff' : hexToRgba('#3af2ff', 0.35);
      ctx.fill();
    }
  }

  /* ── sprite caches: paint once, blit forever ── */

  const alienCache = {};

  function getAlien(species, frame, flash) {
    const sp = ALIENS[species] ? species : 3;
    const f = frame ? 1 : 0;
    const fl = !!flash;
    const key = sp + ':' + f + ':' + (fl ? 1 : 0);
    const hit = alienCache[key];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = ALIEN_SW;
    canvas.height = ALIEN_SH;
    const ctx = canvas.getContext('2d');
    if (fl) {
      ctx.drawImage(getAlien(sp, f, false), 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, ALIEN_SW, ALIEN_SH);
    } else {
      ctx.translate(ALIEN_SW / 2, ALIEN_SH / 2);
      ctx.scale(SCALE, SCALE);
      (ALIEN_PAINTERS[sp] || ALIEN_PAINTERS[3])(ctx, ALIENS[sp], f);
    }
    alienCache[key] = canvas;
    return canvas;
  }

  /* The alien's 36 x 27 box has its top-left at (x, y). */
  function drawAlien(ctx, species, x, y, frame, flash, scale = 1) {
    const img = getAlien(species, frame, flash);
    ctx.drawImage(img, x - ALIEN_PAD * scale, y - ALIEN_PAD * scale,
      (ALIEN_W + 2 * ALIEN_PAD) * scale, (ALIEN_H + 2 * ALIEN_PAD) * scale);
  }

  const shipCache = {};

  function shipFor(id) {
    for (let i = 0; i < SHIPS.length; ++i)
      if (SHIPS[i].id === id) return SHIPS[i];
    return SHIPS[0];
  }

  function getShip(id, thrust) {
    const ship = shipFor(id);
    const t = Math.max(0, Math.min(3, Math.round(thrust || 0)));
    const key = ship.id + ':' + t;
    const hit = shipCache[key];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = SHIP_SW;
    canvas.height = SHIP_SH;
    const ctx = canvas.getContext('2d');
    ctx.translate(SHIP_SW / 2, SHIP_PAD_TOP * SCALE + (SHIP_H / 2) * SCALE);
    ctx.scale(SCALE, SCALE);
    (SHIP_PAINTERS[ship.id] || paintInterceptor)(ctx, ship, t);
    shipCache[key] = canvas;
    return canvas;
  }

  /* (cx, y) is the top-centre of the 45 x 24 box; tilt in -1..1 leans the hull. */
  function drawShip(ctx, id, cx, y, thrust = 1, tilt = 0, alpha = 1) {
    const img = getShip(id, thrust);
    const base = ctx.globalAlpha === undefined ? 1 : ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = base * alpha;
    ctx.translate(cx, y + SHIP_CY);
    ctx.rotate(tilt * 0.12);
    ctx.drawImage(img, -SHIP_LW / 2, -SHIP_LH / 2, SHIP_LW, SHIP_LH);
    ctx.restore();
  }

  const droneCache = {};

  function getDrone(frame) {
    const f = frame ? 1 : 0;
    const hit = droneCache[f];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = DRONE_SW;
    canvas.height = DRONE_SH;
    const ctx = canvas.getContext('2d');
    ctx.translate(DRONE_SW / 2, DRONE_SH / 2);
    ctx.scale(SCALE, SCALE);
    paintDrone(ctx, f);
    droneCache[f] = canvas;
    return canvas;
  }

  /* (cx, cy) is the centre of the 24 x 15 pod; time only blinks the beacon. */
  function drawDrone(ctx, cx, cy, time) {
    let f = Math.floor(time * 4) % 2;
    if (f < 0) f += 2;
    const img = getDrone(f);
    ctx.drawImage(img, cx - (DRONE_W / 2 + DRONE_PAD), cy - (DRONE_H / 2 + DRONE_PAD),
      DRONE_W + 2 * DRONE_PAD, DRONE_H + 2 * DRONE_PAD);
  }

  const ufoCache = {};

  function getUfo(frame) {
    const f = ((frame % 4) + 4) % 4;
    const hit = ufoCache[f];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = UFO_SW;
    canvas.height = UFO_SH;
    const ctx = canvas.getContext('2d');
    ctx.translate(UFO_SW / 2, UFO_SH / 2);
    ctx.scale(SCALE, SCALE);
    paintUfo(ctx, f);
    ufoCache[f] = canvas;
    return canvas;
  }

  /* (x, y) is the top-left of the 48 x 21 saucer box. */
  function drawUfo(ctx, x, y, time) {
    let f = Math.floor(time * 10) % 4;
    if (f < 0) f += 4;
    const img = getUfo(f);
    ctx.drawImage(img, x - UFO_PAD, y - UFO_PAD, UFO_W + 2 * UFO_PAD, UFO_H + 2 * UFO_PAD);
  }

  /* ── the six bosses, drawn in a 120 x 60 box centred on the origin ── */

  const BOSS_W = 120, BOSS_H = 60, BOSS_PAD = 20;
  const BOSS_SW = (BOSS_W + 2 * BOSS_PAD) * SCALE;   // 320
  const BOSS_SH = (BOSS_H + 2 * BOSS_PAD) * SCALE;   // 200

  const BOSSES = [
    { name: 'Crater Warden', color: '#c8d0e0', dark: '#4a5268', glow: '#dfe8ff' },
    { name: 'Rust Colossus', color: '#ff6a3a', dark: '#7a2a10', glow: '#ffb03a' },
    { name: 'Rock Hive', color: '#c9a36a', dark: '#5a4426', glow: '#ffc46a' },
    { name: 'Storm Leviathan', color: '#ffb36a', dark: '#7a4a20', glow: '#7db8ff' },
    { name: 'Ring Sentinel', color: '#e8d48a', dark: '#6a5a26', glow: '#fff0b0' },
    { name: 'The Overmind', color: '#c04cff', dark: '#4a1a7a', glow: '#e8a0ff' }
  ];

  /* Crater Warden: lumpy moon-rock fortress, crenellated top, crater pits,
     a huge central eye and a gun turret on each shoulder. */
  function paintCraterWarden(ctx, spec) {
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(sx * 42, 4);
      ctx.lineTo(sx * 48, 20);
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = shade(spec.color, -0.25);
      ctx.stroke();
      glowDot(ctx, sx * 49, 22, 6, spec.glow, 0.6);
      ctx.beginPath();
      ctx.arc(sx * 42, 2, 10, Math.PI, TWO_PI);
      ctx.closePath();
      ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, sx * 34, -8, sx * 50, 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
    }
    const hull = [[-50, 6], [-46, -12], [-28, -18], [28, -18], [46, -12], [50, 6], [40, 22], [-40, 22]];
    fillPoly(ctx, hull, bodyGradient(ctx, spec.color, spec.dark, -40, -18, 40, 22), spec.dark, false);
    const cren = [[-26, -24], [-5, -26], [16, -24]];
    for (let i = 0; i < cren.length; ++i) {
      ctx.beginPath();
      ctx.rect(cren[i][0], cren[i][1], 10, 8);
      ctx.fillStyle = bodyGradient(ctx, shade(spec.color, 0.2), spec.dark, cren[i][0], cren[i][1], cren[i][0] + 10, cren[i][1] + 8);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
    }
    const pits = [[-32, 4, 7], [30, 8, 6], [-14, 15, 5], [22, -6, 5]];
    for (let i = 0; i < pits.length; ++i) {
      const p = pits[i];
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], p[2], p[2] * 0.7, 0, 0, TWO_PI);
      ctx.fillStyle = hexToRgba(spec.dark, 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0], p[1], p[2], Math.PI * 1.1, Math.PI * 1.7);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = shade(spec.color, 0.45);
      ctx.stroke();
    }
    glowDot(ctx, 0, -2, 20, spec.glow, 0.5);
    eye(ctx, 0, -2, 9, spec);
    ctx.beginPath();
    ctx.arc(0, -2, 11, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
  }

  /* Rust Colossus: plated rust-red torso, a furnace grille of glowing vents,
     two heavy shoulder cannons with hot muzzles, a slit-eyed head dome. */
  function paintRustColossus(ctx, spec) {
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      const x0 = sx === 1 ? 34 : -46;
      ctx.beginPath();
      ctx.rect(x0, -18, 12, 32);
      ctx.fillStyle = bodyGradient(ctx, shade(spec.color, -0.15), spec.dark, x0, -18, x0 + 12, 14);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(x0, -6, 12, 4);
      ctx.fillStyle = '#3a2a20';
      ctx.fill();
      ctx.beginPath();
      ctx.rect(sx === 1 ? 31 : -43, 12, 12, 8);
      ctx.fillStyle = bodyGradient(ctx, shade(spec.color, -0.3), spec.dark, sx * 31, 12, sx * 43, 20);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
      glowDot(ctx, sx * 37, 21, 7, spec.glow, 0.65);
    }
    const torso = [[-26, -20], [26, -20], [34, 8], [26, 24], [-26, 24], [-34, 8]];
    fillPoly(ctx, torso, bodyGradient(ctx, spec.color, spec.dark, -26, -20, 26, 24), spec.dark, false);
    ctx.globalAlpha = 0.4;
    const rust = [[-16, 14, 8, 5], [14, -12, 7, 4], [20, 16, 6, 4]];
    for (let i = 0; i < rust.length; ++i) {
      const r = rust[i];
      ctx.beginPath();
      ctx.ellipse(r[0], r[1], r[2], r[3], 0.3, 0, TWO_PI);
      ctx.fillStyle = shade(spec.color, -0.45);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const vents = [-8, 0, 8];
    for (let i = 0; i < vents.length; ++i) {
      const y = vents[i];
      glowDot(ctx, 0, y, 11, spec.glow, 0.5);
      ctx.beginPath();
      ctx.rect(-13, y - 1.5, 26, 3);
      ctx.fillStyle = spec.glow;
      ctx.fill();
      ctx.beginPath();
      ctx.rect(-11, y - 0.7, 22, 1.4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, -20, 9, Math.PI, TWO_PI);
    ctx.closePath();
    ctx.fillStyle = bodyGradient(ctx, shade(spec.color, 0.2), spec.dark, -8, -29, 8, -20);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    glowDot(ctx, 0, -24, 7, '#ffd23f', 0.55);
    ctx.beginPath();
    ctx.rect(-6, -25.5, 12, 2.4);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
  }

  /* Rock Hive: a jagged asteroid riddled with amber-glowing hive cells,
     jointed tentacles dangling from its underside. */
  function paintRockHive(ctx, spec) {
    const tent = [
      [-24, 16, -34, 26, -30, 40], [-8, 20, -6, 30, -12, 44],
      [10, 20, 14, 30, 8, 42], [26, 14, 36, 24, 32, 38]
    ];
    for (let i = 0; i < tent.length; ++i) {
      const t = tent[i];
      limb(ctx, t[0], t[1], t[2], t[3], t[4], t[5], spec.color, spec.dark);
    }
    const rock = [[-48, -4], [-38, -18], [-14, -24], [16, -22], [40, -14], [48, 2], [38, 18], [10, 22], [-24, 20], [-44, 10]];
    fillPoly(ctx, rock, bodyGradient(ctx, spec.color, spec.dark, -38, -24, 38, 22), spec.dark, false);
    ctx.globalAlpha = 0.35;
    const facets = [[[-30, -14], [-14, -18], [-18, -6]], [[24, -10], [40, -8], [30, 4]], [[-16, 12], [4, 16], [-8, 20]]];
    for (let i = 0; i < facets.length; ++i)
      fillPoly(ctx, facets[i], shade(spec.color, -0.4), null, false);
    ctx.globalAlpha = 1;
    const cells = [[-20, -6, 6], [4, -12, 5], [24, -2, 5.5], [-6, 6, 5]];
    for (let i = 0; i < cells.length; ++i) {
      const c = cells[i];
      glowDot(ctx, c[0], c[1], c[2] * 2.4, spec.glow, 0.55);
      ctx.beginPath();
      ctx.arc(c[0], c[1], c[2], 0, TWO_PI);
      ctx.fillStyle = spec.glow;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = spec.dark;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c[0] - c[2] * 0.25, c[1] - c[2] * 0.25, c[2] * 0.35, 0, TWO_PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  /* Storm Leviathan: a manta of Jupiter-banded skin gliding head-down,
     lightning-blue gill slits across its back, a whip tail above. */
  function paintStormLeviathan(ctx, spec) {
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, -36);
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = spec.color;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.quadraticCurveTo(24, 14, 56, -6);
    ctx.quadraticCurveTo(34, -16, 10, -20);
    ctx.lineTo(-10, -20);
    ctx.quadraticCurveTo(-34, -16, -56, -6);
    ctx.quadraticCurveTo(-24, 14, 0, 26);
    ctx.closePath();
    const bands = ctx.createLinearGradient(0, -20, 0, 26);
    bands.addColorStop(0, '#fff0d0');
    bands.addColorStop(0.25, spec.color);
    bands.addColorStop(0.45, '#e07a3a');
    bands.addColorStop(0.6, '#fff0d0');
    bands.addColorStop(0.8, spec.color);
    bands.addColorStop(1, '#c96a3a');
    ctx.fillStyle = bands;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    for (let i = 0; i < 3; ++i) {
      const y = -16 + i * 5;
      for (let m = 0; m < 2; ++m) {
        const sx = m === 1 ? -1 : 1;
        glowDot(ctx, sx * (10 + i * 4), y + 1, 6, spec.glow, 0.5);
        ctx.beginPath();
        ctx.moveTo(sx * (6 + i * 3), y - 1);
        ctx.lineTo(sx * (14 + i * 4), y + 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = spec.glow;
        ctx.stroke();
      }
    }
    for (let m = 0; m < 2; ++m) {
      const sx = m === 1 ? -1 : 1;
      limb(ctx, sx * 6, 24, sx * 10, 28, sx * 8, 32, spec.color, spec.dark);
      eye(ctx, sx * 9, 18, 2.6, spec);
    }
  }

  /* Ring Sentinel: a golden saucer under a tilted ring (back half behind the
     hull, front half across it), glass dome, a core that glows like a pulse. */
  function paintRingSentinel(ctx, spec) {
    const ring = shade(spec.color, 0.25);
    ctx.save();
    ctx.translate(0, 4);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 56, 15, 0, Math.PI, TWO_PI);
    ctx.lineWidth = 5;
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 16, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, spec.color, spec.dark, -26, -14, 26, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    for (let i = 0; i < 5; ++i) {
      const a = Math.PI * (0.15 + 0.7 * i / 4);
      glowDot(ctx, 30 * Math.cos(a), 13 * Math.sin(a) + 2, 4, spec.glow, 0.6);
    }
    ctx.beginPath();
    ctx.ellipse(0, -6, 15, 10, 0, Math.PI, TWO_PI);
    ctx.closePath();
    const dome = ctx.createLinearGradient(-10, -16, 10, -6);
    dome.addColorStop(0, 'rgba(255,250,220,0.9)');
    dome.addColorStop(1, hexToRgba(spec.dark, 0.6));
    ctx.fillStyle = dome;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    glowDot(ctx, 0, 2, 16, spec.glow, 0.7);
    ctx.beginPath();
    ctx.arc(0, 2, 6, 0, TWO_PI);
    ctx.fillStyle = shade(spec.color, 0.3);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-1.5, 0.5, 3, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.save();
    ctx.translate(0, 4);
    ctx.rotate(-0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 56, 15, 0, 0, Math.PI);
    ctx.lineWidth = 5;
    ctx.strokeStyle = ring;
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.restore();
  }

  /* The Overmind: a folded brain floating in a purple crystal dome on a
     mechanical base, four emitters humming on the base deck. */
  function paintOvermind(ctx, spec) {
    const base = [[-34, 6], [34, 6], [42, 26], [-42, 26]];
    fillPoly(ctx, base, bodyGradient(ctx, '#8a96a8', '#2a2f3a', -34, 6, 34, 26), '#22283a', false);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#22283a';
    ctx.beginPath();
    ctx.moveTo(-36, 16);
    ctx.lineTo(36, 16);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const ex = [-36, -14, 14, 36];
    for (let i = 0; i < ex.length; ++i) {
      ctx.beginPath();
      ctx.rect(ex[i] - 3, -2, 6, 9);
      ctx.fillStyle = '#3a4258';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#22283a';
      ctx.stroke();
      glowDot(ctx, ex[i], -4, 6, spec.glow, 0.65);
      ctx.beginPath();
      ctx.arc(ex[i], -3, 2.2, 0, TWO_PI);
      ctx.fillStyle = spec.glow;
      ctx.fill();
    }
    glowDot(ctx, 0, -8, 24, spec.glow, 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -8, 20, 14, 0, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, shade(spec.color, 0.45), spec.dark, -14, -20, 14, 4);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.dark;
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = spec.dark;
    for (let i = 0; i < 3; ++i) {
      const y = -16 + i * 6;
      ctx.beginPath();
      ctx.moveTo(-15, y);
      ctx.quadraticCurveTo(-8, y - 4, 0, y);
      ctx.quadraticCurveTo(8, y + 4, 15, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 6, 30, Math.PI, TWO_PI);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(spec.color, 0.25);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spec.glow;
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 6, 24, Math.PI * 1.15, Math.PI * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const BOSS_PAINTERS = [
    paintCraterWarden, paintRustColossus, paintRockHive,
    paintStormLeviathan, paintRingSentinel, paintOvermind
  ];

  /* Battle damage: scorches and cracked-open, molten seams that only stick to
     already-painted pixels, then a red wash over the whole silhouette. */
  function paintDamage(ctx) {
    ctx.globalCompositeOperation = 'source-atop';
    const scorches = [[-36, -6, 12], [24, 12, 10], [44, -4, 9], [-10, -16, 8], [8, 18, 9]];
    for (let i = 0; i < scorches.length; ++i) {
      const s = scorches[i];
      const g = ctx.createRadialGradient(s[0], s[1], 0, s[0], s[1], s[2]);
      g.addColorStop(0, 'rgba(24,16,10,0.7)');
      g.addColorStop(0.7, 'rgba(24,16,10,0.45)');
      g.addColorStop(1, 'rgba(24,16,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s[0], s[1], s[2], 0, TWO_PI);
      ctx.fill();
    }
    const cracks = [
      [[-34, -12], [-26, -4], [-30, 4], [-20, 10]],
      [[16, -16], [24, -8], [20, 0], [28, 6]],
      [[2, -4], [10, 2], [6, 10], [14, 16]]
    ];
    for (let i = 0; i < cracks.length; ++i) {
      const c = cracks[i];
      glowDot(ctx, c[1][0], c[1][1], 8, '#ff7a1a', 0.5);
      ctx.beginPath();
      ctx.moveTo(c[0][0], c[0][1]);
      for (let k = 1; k < c.length; ++k) ctx.lineTo(c[k][0], c[k][1]);
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ff7a1a';
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#2a1a10';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,40,40,0.25)';
    ctx.fillRect(-BOSS_W / 2 - BOSS_PAD, -BOSS_H / 2 - BOSS_PAD, BOSS_W + 2 * BOSS_PAD, BOSS_H + 2 * BOSS_PAD);
    ctx.globalCompositeOperation = 'source-over';
  }

  const bossCache = {};

  function getBoss(design, damaged) {
    const d = BOSS_PAINTERS[design] !== undefined ? design : 0;
    const dmg = !!damaged;
    const key = d + ':' + (dmg ? 1 : 0);
    const hit = bossCache[key];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = BOSS_SW;
    canvas.height = BOSS_SH;
    const ctx = canvas.getContext('2d');
    ctx.translate(BOSS_SW / 2, BOSS_SH / 2);
    ctx.scale(SCALE, SCALE);
    BOSS_PAINTERS[d](ctx, BOSSES[d]);
    if (dmg) paintDamage(ctx);
    bossCache[key] = canvas;
    return canvas;
  }

  function getBossFlash(design, damaged) {
    const d = BOSS_PAINTERS[design] !== undefined ? design : 0;
    const dmg = !!damaged;
    const key = d + ':' + (dmg ? 1 : 0) + ':f';
    const hit = bossCache[key];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = BOSS_SW;
    canvas.height = BOSS_SH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(getBoss(d, dmg), 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BOSS_SW, BOSS_SH);
    bossCache[key] = canvas;
    return canvas;
  }

  /* (x, y) is the top-left of the 120 x 60 boss box. */
  function drawBoss(ctx, design, x, y, damaged, flash) {
    const img = flash ? getBossFlash(design, damaged) : getBoss(design, damaged);
    ctx.drawImage(img, x - BOSS_PAD, y - BOSS_PAD, BOSS_W + 2 * BOSS_PAD, BOSS_H + 2 * BOSS_PAD);
  }

  /* ── bullets: cached, drawn centred; the laser tile stretches vertically ── */

  const BULLETS = {
    player: { w: 20, h: 34, paint: paintPlayerBolt },
    alien: { w: 18, h: 36, paint: paintAlienBolt },
    orb: { w: 30, h: 30, paint: paintBossOrb },
    laser: { w: 25, h: 76, paint: paintLaserTile, padY: 6 }
  };

  /* Player bolt: a 4 x 15 white-cored capsule in a blue-cyan halo. */
  function paintPlayerBolt(ctx) {
    glowDot(ctx, 0, 0, 10, '#5ac8ff', 0.55);
    ctx.beginPath();
    ctx.moveTo(-2, -5.5);
    ctx.lineTo(-2, 5.5);
    ctx.arc(0, 5.5, 2, Math.PI, 0, true);
    ctx.lineTo(2, -5.5);
    ctx.arc(0, -5.5, 2, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = '#bfe8ff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#5ac8ff';
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(-1, -6, 2, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    glowDot(ctx, 0, -6, 4, '#ffffff', 0.5);
  }

  /* Alien bolt: a 4 x 18 red-orange zig-zag with a hot core. */
  function paintAlienBolt(ctx) {
    glowDot(ctx, 0, 0, 9, '#ff5a2a', 0.55);
    ctx.beginPath();
    ctx.moveTo(1, -8);
    ctx.lineTo(-1, -3);
    ctx.lineTo(1, 2);
    ctx.lineTo(-1, 7);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ff5a2a';
    ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#ffd8a0';
    ctx.stroke();
    glowDot(ctx, -1, 7, 3, '#ffffff', 0.5);
  }

  /* Boss orb: a 14 px purple sphere with a white hot spot. */
  function paintBossOrb(ctx) {
    glowDot(ctx, 0, 0, 14, '#c04cff', 0.6);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TWO_PI);
    ctx.fillStyle = '#e08aff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#7a2ab0';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-2, -2, 2.6, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  /* Laser tile: a 9 px magenta beam whose glow runs only across the width,
     so copies stack seamlessly into a beam of any length. */
  function paintLaserTile(ctx) {
    const g = ctx.createLinearGradient(-12, 0, 12, 0);
    g.addColorStop(0, 'rgba(255,0,255,0)');
    g.addColorStop(0.35, 'rgba(255,0,255,0.45)');
    g.addColorStop(0.5, 'rgba(255,138,255,0.8)');
    g.addColorStop(0.65, 'rgba(255,0,255,0.45)');
    g.addColorStop(1, 'rgba(255,0,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-12, -38, 24, 76);
    ctx.fillStyle = '#ff2af0';
    ctx.fillRect(-3, -38, 6, 76);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-1.2, -38, 2.4, 76);
  }

  const bulletCache = {};

  function getBullet(kind) {
    const def = BULLETS[kind] ? kind : 'player';
    const hit = bulletCache[def];
    if (hit) return hit;
    const d = BULLETS[def];
    const canvas = document.createElement('canvas');
    canvas.width = d.w * SCALE;
    canvas.height = d.h * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(SCALE, SCALE);
    d.paint(ctx);
    bulletCache[def] = canvas;
    return canvas;
  }

  /* (cx, cy) is the bullet centre; for 'laser', h is the beam length rising
     from cy and the tile is stretched to fit. */
  function drawBullet(ctx, kind, cx, cy, h) {
    const d = BULLETS[kind] ? BULLETS[kind] : BULLETS.player;
    const img = getBullet(BULLETS[kind] ? kind : 'player');
    if (kind === 'laser') {
      const len = Math.max(0, h || 0);
      ctx.drawImage(img, cx - d.w / 2, cy - len - d.padY, d.w, len + 2 * d.padY);
    } else {
      ctx.drawImage(img, cx - d.w / 2, cy - d.h / 2, d.w, d.h);
    }
  }

  /* ── power-up capsules: 24 x 24 glass pills with a metallic rim ── */

  const CAPSULE_L = 36;   // 24 + 6 px glow padding per side

  const CAPSULES = {
    tripleShot: '#00ffff', rapidFire: '#ffff00', shield: '#8888ff', laser: '#ff00ff',
    slowMo: '#aaaaff', extraLife: '#ff8888', bomb: '#ffaa00', drone: '#88ff88',
    credits: '#ffd23f'
  };

  function iconTripleShot(ctx) {
    const xs = [-5, 0, 5];
    for (let i = 0; i < xs.length; ++i) {
      const x = xs[i];
      ctx.beginPath();
      ctx.moveTo(x, 4);
      ctx.lineTo(x, -2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 2, -1.5);
      ctx.lineTo(x, -5);
      ctx.lineTo(x + 2, -1.5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  function iconRapidFire(ctx) {
    fillPoly(ctx, [[1, -6], [-3, 1], [0, 1], [-1, 6], [3, -1], [0, -1]], '#ffffff', null, false);
  }

  function iconShield(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, -4);
    ctx.lineTo(5, 1);
    ctx.quadraticCurveTo(5, 4.5, 0, 6.5);
    ctx.quadraticCurveTo(-5, 4.5, -5, 1);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(40,40,80,0.6)';
    ctx.stroke();
  }

  function iconLaser(ctx) {
    ctx.beginPath();
    ctx.rect(-1.2, -6, 2.4, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -6, 2, 0, TWO_PI);
    ctx.fill();
  }

  function iconSlowMo(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, TWO_PI);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -3);
    ctx.moveTo(0, 0);
    ctx.lineTo(2.5, 1);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function iconExtraLife(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-6, 0.5, -5.5, -5, -2.6, -5);
    ctx.bezierCurveTo(-1.2, -5, 0, -3.6, 0, -2.6);
    ctx.bezierCurveTo(0, -3.6, 1.2, -5, 2.6, -5);
    ctx.bezierCurveTo(5.5, -5, 6, 0.5, 0, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  function iconBomb(ctx) {
    ctx.beginPath();
    ctx.arc(0, 1.5, 4, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.4, -1.4);
    ctx.lineTo(5, -4.5);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(5.6, -5.2, 1.4, 0, TWO_PI);
    ctx.fill();
  }

  function iconDrone(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3.5, 0, 0, TWO_PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 1.4, 0, TWO_PI);
    ctx.fillStyle = '#3a5a3a';
    ctx.fill();
  }

  function iconCredits(ctx) {
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TWO_PI);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 4, Math.PI * 0.35, Math.PI * 1.65);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  const CAPSULE_ICONS = {
    tripleShot: iconTripleShot, rapidFire: iconRapidFire, shield: iconShield,
    laser: iconLaser, slowMo: iconSlowMo, extraLife: iconExtraLife,
    bomb: iconBomb, drone: iconDrone, credits: iconCredits
  };

  function paintCapsule(ctx, color, icon) {
    glowDot(ctx, 0, 0, 17, color, 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, 11.5, 0, TWO_PI);
    ctx.fillStyle = bodyGradient(ctx, '#d8dce8', '#525c74', -8, -8, 8, 8);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2a2f3a';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TWO_PI);
    const glass = ctx.createRadialGradient(-3, -3, 1, 0, 0, 9);
    glass.addColorStop(0, shade(color, 0.6));
    glass.addColorStop(0.5, color);
    glass.addColorStop(1, shade(color, -0.5));
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#2a2f3a';
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-2, -3, 6, Math.PI * 1.1, Math.PI * 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    icon(ctx);
  }

  const capsuleCache = {};

  function getCapsule(id) {
    const cid = CAPSULES[id] ? id : 'tripleShot';
    const hit = capsuleCache[cid];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = CAPSULE_L * SCALE;
    canvas.height = CAPSULE_L * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.translate(CAPSULE_L * SCALE / 2, CAPSULE_L * SCALE / 2);
    ctx.scale(SCALE, SCALE);
    paintCapsule(ctx, CAPSULES[cid], CAPSULE_ICONS[cid]);
    capsuleCache[cid] = canvas;
    return canvas;
  }

  /* (cx, cy) is the capsule centre; time drives a gentle pulse. */
  function drawCapsule(ctx, id, cx, cy, time) {
    const img = getCapsule(CAPSULES[id] ? id : 'tripleShot');
    const s = 1 + 0.06 * Math.sin((time || 0) * 6);
    const w = CAPSULE_L * s;
    ctx.drawImage(img, cx - w / 2, cy - w / 2, w, w);
  }

  /* ── explosion flares: soft radial glow plus a four-point star ── */

  const FLARE_SIZE = 128;

  const FLARES = {
    white: '#ffffff', orange: '#ff8a2a', cyan: '#3af2ff', purple: '#c04cff'
  };

  function paintFlare(ctx, color) {
    glowDot(ctx, 0, 0, 62, color, 0.9);
    const star = [[0, -60], [3, -3], [60, 0], [3, 3], [0, 60], [-3, 3], [-60, 0], [-3, -3]];
    tracePoly(ctx, star, false);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.25, hexToRgba(color, 0.7));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fill();
  }

  const flareCache = {};

  function getFlare(color) {
    const key = FLARES[color] ? color : 'white';
    const hit = flareCache[key];
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = FLARE_SIZE;
    canvas.height = FLARE_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.translate(FLARE_SIZE / 2, FLARE_SIZE / 2);
    paintFlare(ctx, FLARES[key]);
    flareCache[key] = canvas;
    return canvas;
  }

  /* (cx, cy) is the flare centre; it covers a 2 * radius box. */
  function drawFlare(ctx, color, cx, cy, radius, alpha) {
    const img = getFlare(FLARES[color] ? color : 'white');
    const base = ctx.globalAlpha === undefined ? 1 : ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = base * (alpha === undefined ? 1 : alpha);
    ctx.drawImage(img, cx - radius, cy - radius, 2 * radius, 2 * radius);
    ctx.restore();
  }

  SZ.InvaderArt = Object.freeze({
    ALIENS, SHIPS, BOSSES,
    getAlien, drawAlien, getShip, drawShip, drawDrone, drawUfo,
    getBoss, drawBoss, drawBullet, drawCapsule, drawFlare
  });
})();
