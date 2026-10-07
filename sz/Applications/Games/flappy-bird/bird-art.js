;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Bird sprites for the flappy game. BIRDS holds the palette and build hints
   * of the six birds; getSprite paints one shaded bird per id and wing frame
   * into a cached canvas (rendered at 2x so it stays crisp when the game draws
   * it larger), and drawBird blits that cached frame rotated and scaled.
   * Every bit of shading - gradients, the 2 px outline, glints, the cast
   * shadow under the wing - is baked into the sprite once, so a game frame is
   * a single drawImage and nothing expensive runs per frame.
   *
   * Birds are drawn facing right (beak at +x) in a local box of 64 x 48 units
   * (x -32..32, y -24..24) with the body centred at (0, 0).
   */

  const TWO_PI = Math.PI * 2;
  const LOCAL_W = 64;
  const LOCAL_H = 48;
  const RS = 2;                      // render scale of the cached sprite
  const SPRITE_W = LOCAL_W * RS;     // 128 px
  const SPRITE_H = LOCAL_H * RS;     // 96 px
  const WING_ROOT_X = -4;            // the wing pivots about this point
  const WING_ROOT_Y = -1;
  // Wing rotation per frame, in canvas sign (y grows down): frame 0 lifts the
  // tip above the back, frame 2 swings it below the belly, frames 1 and 3 rest.
  const WING_ANGLES = [0.9, 0.2, -0.55, 0.2];

  const BIRDS = Object.freeze([
    Object.freeze({
      id: 'sunny', name: 'Sunny', body: '#ffd23f', belly: '#fff3b0',
      wing: '#f4a91f', wingDark: '#c97d0e', beak: '#ff8a1e', beakDark: '#d4600c',
      outline: '#7a4a08', eye: '#1b1b1b', style: 'round'
    }),
    Object.freeze({
      id: 'ruby', name: 'Ruby', body: '#8a6a5c', belly: '#ff6a3d',
      wing: '#6e5246', wingDark: '#4c372e', beak: '#f2c14e', beakDark: '#c99a2e',
      outline: '#3a2620', eye: '#141414', style: 'robin'
    }),
    Object.freeze({
      id: 'jay', name: 'Jay', body: '#3d7fe0', belly: '#eef4ff',
      wing: '#2a5fb8', wingDark: '#1c3f80', beak: '#2b2b2b', beakDark: '#111111',
      outline: '#13284f', eye: '#111111', style: 'jay'
    }),
    Object.freeze({
      id: 'pip', name: 'Pip', body: '#3fbf4f', belly: '#b9f27a',
      wing: '#2f9a3d', wingDark: '#1f6e2a', beak: '#f5e6c8', beakDark: '#b8a888',
      outline: '#174d1f', eye: '#111111', accent: '#ff3b3b', style: 'parrot'
    }),
    Object.freeze({
      id: 'snowy', name: 'Snowy', body: '#f4f6fa', belly: '#ffffff',
      wing: '#d9dee8', wingDark: '#a8b0c0', beak: '#3a3a3a', beakDark: '#1e1e1e',
      outline: '#5c6474', eye: '#ffcc1a', style: 'owl'
    }),
    Object.freeze({
      id: 'phoenix', name: 'Phoenix', body: '#ff5a1f', belly: '#ffd23f',
      wing: '#e8381a', wingDark: '#a8200e', beak: '#ffe08a', beakDark: '#d9a83a',
      outline: '#5a1206', eye: '#1b1b1b', accent: '#ffcf3a', style: 'phoenix'
    })
  ]);

  const birdsById = {};
  for (let i = 0; i < BIRDS.length; ++i)
    birdsById[BIRDS[i].id] = BIRDS[i];

  function birdFor(id) {
    return birdsById[id] || birdsById.sunny;
  }

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

  /* t in [0, 1]: how far a is pulled toward b */
  function mix(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    return '#' + channel(ca.r + (cb.r - ca.r) * t) + channel(ca.g + (cb.g - ca.g) * t) + channel(ca.b + (cb.b - ca.b) * t);
  }

  function hexToRgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* ── path helpers ── */

  function ellipsePath(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TWO_PI);
  }

  /* A single feather: rounded blade from the origin toward +x. */
  function featherShape(ctx, len, w) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -w, len, 0);
    ctx.quadraticCurveTo(len * 0.5, w, 0, 0);
    ctx.closePath();
  }

  /* A flame feather: wavy, wide at the root, tapering to a licking tip. */
  function flameShape(ctx, len, w) {
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.bezierCurveTo(len * 0.45, -w * 1.15, len * 0.7, -w * 0.35, len, 0);
    ctx.bezierCurveTo(len * 0.7, w * 0.55, len * 0.4, w * 0.95, 0, w);
    ctx.closePath();
  }

  /* The wing blade in wing-local coordinates: root at the origin, tip back at -x. */
  function wingPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(1, -5);
    ctx.bezierCurveTo(-7, -7, -14, -5, -18, 1);
    ctx.bezierCurveTo(-13, 6, -5, 6, 1, 5);
    ctx.closePath();
  }

  function seam(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 1.2, x1, y1);
    ctx.stroke();
  }

  function dot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }

  /* ── body, belly, gloss ── */

  function bodyGradient(ctx, bird, rx, ry) {
    const g = ctx.createRadialGradient(rx * 0.3, -ry * 0.55, ry * 0.25, -rx * 0.15, ry * 0.2, rx * 1.3);
    g.addColorStop(0, shade(bird.body, 0.3));
    g.addColorStop(0.5, bird.body);
    g.addColorStop(1, mix(bird.body, bird.outline, 0.6));
    return g;
  }

  function drawBody(ctx, bird, rx, ry) {
    ellipsePath(ctx, 0, 0, rx, ry);
    ctx.fillStyle = bodyGradient(ctx, bird, rx, ry);
    ctx.fill();
  }

  /* Stroked after the belly so the outline reads over the fill but under the wing. */
  function strokeBody(ctx, bird, rx, ry) {
    ellipsePath(ctx, 0, 0, rx, ry);
    ctx.lineWidth = 2;
    ctx.strokeStyle = bird.outline;
    ctx.stroke();
  }

  function drawBelly(ctx, bird, x, y, rx, ry) {
    ellipsePath(ctx, x, y, rx, ry);
    const g = ctx.createRadialGradient(x + rx * 0.25, y - ry * 0.35, 1, x, y, rx);
    g.addColorStop(0, shade(bird.belly, 0.3));
    g.addColorStop(1, bird.belly);
    ctx.fillStyle = g;
    ctx.fill();
  }

  /* Soft sheen across the upper back. */
  function drawGloss(ctx, rx, ry) {
    ellipsePath(ctx, rx * 0.12, -ry * 0.55, rx * 0.55, ry * 0.3, -0.22);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
  }

  /* ── eyes and beaks ── */

  /* A side-facing eye: dark disc, big glint, small counter-glint. */
  function drawEye(ctx, x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, shade(color, 0.35));
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.4, r * 0.3, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y + r * 0.35, r * 0.15, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  }

  /* An owl eye facing the viewer: yellow iris, black pupil, white glint. */
  function drawOwlEye(ctx, x, y, r, iris) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, shade(iris, 0.3));
    g.addColorStop(1, shade(iris, -0.25));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = mix(iris, '#000000', 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TWO_PI);
    ctx.fillStyle = '#111111';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.4, r * 0.22, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  }

  /* A short wedge beak: lighter upper mandible, darker lower one. */
  function drawWedgeBeak(ctx, bird, x, y, len, up, down) {
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = bird.outline;
    ctx.beginPath();
    ctx.moveTo(x, y - up);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x, y + 0.6);
    ctx.closePath();
    ctx.fillStyle = shade(bird.beak, 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 0.6);
    ctx.lineTo(x + len * 0.72, y + down);
    ctx.lineTo(x, y + down + 0.6);
    ctx.closePath();
    ctx.fillStyle = bird.beakDark;
    ctx.fill();
    ctx.stroke();
  }

  /* ── tail ── */

  /* A fan of count feathers pointing along base (Math.PI = straight back). */
  function tailFan(ctx, bird, x, y, count, len, w, spread, base, fill, dark) {
    for (let i = 0; i < count; ++i) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(base + (i - (count - 1) / 2) * spread);
      featherShape(ctx, len - i * 0.6, w);
      ctx.fillStyle = i === 0 ? dark : fill;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = bird.outline;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── the wing, shared by every bird ── */

  function drawWingMarkings(ctx, bird) {
    if (bird.style === 'jay') {
      const bars = [[-7, '#10141c'], [-11, '#eef4ff'], [-14.5, '#10141c']];
      ctx.lineWidth = 2.4;
      for (let i = 0; i < bars.length; ++i) {
        ctx.beginPath();
        ctx.moveTo(bars[i][0], -7);
        ctx.lineTo(bars[i][0] - 1.5, 7);
        ctx.strokeStyle = bars[i][1];
        ctx.stroke();
      }
    } else if (bird.style === 'parrot') {
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-11, -6);
      ctx.lineTo(-14, 5);
      ctx.strokeStyle = '#ffd23f';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.lineTo(-16.5, 4);
      ctx.strokeStyle = '#3b7cff';
      ctx.stroke();
    } else if (bird.style === 'phoenix') {
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = bird.accent;
      seam(ctx, -3, -2.5, -15, -0.5);
      seam(ctx, -3, 0, -12, 2.5);
      seam(ctx, -3, 2.5, -8, 4.5);
      ctx.globalAlpha = 1;
    } else if (bird.style === 'owl') {
      ctx.fillStyle = '#9aa3b4';
      const pts = [[-6, -2], [-10, 0], [-13, 1], [-8, 3], [-12, -3], [-5, 2]];
      for (let i = 0; i < pts.length; ++i)
        dot(ctx, pts[i][0], pts[i][1], 1.1);
    }
  }

  function drawWing(ctx, bird, angle) {
    ctx.save();
    ctx.translate(WING_ROOT_X, WING_ROOT_Y);
    ctx.rotate(angle);

    // Cast shadow of the wing on the body, offset down and back.
    ctx.save();
    ctx.translate(2, 3);
    wingPath(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.restore();

    wingPath(ctx);
    const g = ctx.createLinearGradient(2, -4, -18, 4);
    g.addColorStop(0, shade(bird.wing, 0.2));
    g.addColorStop(0.5, bird.wing);
    g.addColorStop(1, bird.wingDark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = bird.outline;
    ctx.stroke();

    ctx.save();
    wingPath(ctx);
    ctx.clip();
    drawWingMarkings(ctx, bird);
    ctx.restore();

    // Feather seams along the blade.
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = mix(bird.wingDark, bird.outline, 0.45);
    seam(ctx, -3, -2.5, -15, -0.5);
    seam(ctx, -3, 0, -12, 2.5);
    seam(ctx, -3, 2.5, -8, 4.5);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  /* ── the six birds ── */

  function paintSunny(ctx, bird, wingAngle) {
    tailFan(ctx, bird, -17, -1, 2, 9, 3.2, 0.55, Math.PI, bird.wing, bird.wingDark);
    drawBody(ctx, bird, 21, 16);
    drawBelly(ctx, bird, 7, 6, 12, 9);
    drawGloss(ctx, 21, 16);
    strokeBody(ctx, bird, 21, 16);
    drawWing(ctx, bird, wingAngle);
    drawEye(ctx, 8, -5, 6.5, bird.eye);
    drawWedgeBeak(ctx, bird, 19, -1, 10, 3.4, 2.8);
  }

  function paintRuby(ctx, bird, wingAngle) {
    tailFan(ctx, bird, -18, -1, 3, 12, 3, 0.3, Math.PI, bird.wing, bird.wingDark);
    drawBody(ctx, bird, 21, 15);
    // The bright breast covers the front lower half and reaches up to the throat.
    ellipsePath(ctx, 9, 3, 12.5, 10.5);
    const g = ctx.createRadialGradient(12, -1, 2, 9, 3, 13);
    g.addColorStop(0, shade(bird.belly, 0.25));
    g.addColorStop(1, mix(bird.belly, bird.outline, 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    drawGloss(ctx, 21, 15);
    strokeBody(ctx, bird, 21, 15);
    drawWing(ctx, bird, wingAngle);
    // White eye ring, then the eye itself.
    ctx.beginPath();
    ctx.arc(9, -6, 6.6, 0, TWO_PI);
    ctx.fillStyle = '#f6f2ec';
    ctx.fill();
    drawEye(ctx, 9, -6, 4.6, bird.eye);
    // Slim pointed beak.
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = bird.outline;
    ctx.beginPath();
    ctx.moveTo(19, -2.5);
    ctx.lineTo(29, -0.5);
    ctx.lineTo(19, 0.8);
    ctx.closePath();
    ctx.fillStyle = shade(bird.beak, 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, 0.8);
    ctx.lineTo(26, 1.8);
    ctx.lineTo(19, 3);
    ctx.closePath();
    ctx.fillStyle = bird.beakDark;
    ctx.fill();
    ctx.stroke();
  }

  function paintJay(ctx, bird, wingAngle) {
    tailFan(ctx, bird, -18, -1, 3, 13, 3, 0.26, Math.PI, bird.wing, bird.wingDark);
    drawBody(ctx, bird, 21, 15);
    drawBelly(ctx, bird, 7, 6, 12, 9);
    // White face patch around the eye.
    ellipsePath(ctx, 10, -4, 9, 7.5);
    ctx.fillStyle = bird.belly;
    ctx.fill();
    drawGloss(ctx, 21, 15);
    strokeBody(ctx, bird, 21, 15);
    // Black collar sweeping around the neck.
    ctx.beginPath();
    ctx.arc(4, -1, 11, -2.0, 0.7);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#141821';
    ctx.stroke();
    drawWing(ctx, bird, wingAngle);
    // Pointed crest of three feathers leaning back.
    const crest = [[3, -11, -6, -22, 8, -12], [8, -12, 3, -20, 13, -12], [13, -11, 10, -17, 17, -10]];
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = bird.outline;
    for (let i = 0; i < crest.length; ++i) {
      const c = crest[i];
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(c[2], c[3]);
      ctx.lineTo(c[4], c[5]);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? shade(bird.body, 0.2) : bird.body;
      ctx.fill();
      ctx.stroke();
    }
    drawEye(ctx, 9, -5, 4.4, bird.eye);
    drawWedgeBeak(ctx, bird, 19, -1, 8.5, 2.8, 2.4);
  }

  function paintPip(ctx, bird, wingAngle) {
    // Long tail: one red and one blue feather sweeping back and down.
    const tails = [[Math.PI + 0.22, 15, bird.accent], [Math.PI - 0.08, 13, '#3b7cff']];
    for (let i = 0; i < tails.length; ++i) {
      ctx.save();
      ctx.translate(-16, 2);
      ctx.rotate(tails[i][0]);
      featherShape(ctx, tails[i][1], 3.4);
      ctx.fillStyle = tails[i][2];
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = bird.outline;
      ctx.stroke();
      ctx.restore();
    }
    drawBody(ctx, bird, 20, 15);
    drawBelly(ctx, bird, 6, 6, 11, 8);
    // Red head over the front third, kept inside the body silhouette.
    ctx.save();
    ellipsePath(ctx, 0, 0, 20, 15);
    ctx.clip();
    ellipsePath(ctx, 11, -2, 12, 12);
    const hg = ctx.createRadialGradient(14, -6, 2, 11, -2, 13);
    hg.addColorStop(0, shade(bird.accent, 0.2));
    hg.addColorStop(1, mix(bird.accent, bird.outline, 0.3));
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.restore();
    drawGloss(ctx, 20, 15);
    strokeBody(ctx, bird, 20, 15);
    drawWing(ctx, bird, wingAngle);
    // Pale eye ring, then the eye.
    ctx.beginPath();
    ctx.arc(9, -6, 5.8, 0, TWO_PI);
    ctx.fillStyle = '#f2ead6';
    ctx.fill();
    drawEye(ctx, 9, -6, 4.2, bird.eye);
    // Big curved hooked beak.
    ctx.beginPath();
    ctx.moveTo(17, -7);
    ctx.bezierCurveTo(26, -7, 31, -2, 29, 3);
    ctx.bezierCurveTo(28, 6, 25, 7.5, 22.5, 5.5);
    ctx.bezierCurveTo(24, 2, 22, -0.5, 17, 0);
    ctx.closePath();
    const bg = ctx.createLinearGradient(17, -7, 29, 5);
    bg.addColorStop(0, shade(bird.beak, 0.25));
    bg.addColorStop(1, bird.beakDark);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = bird.outline;
    ctx.stroke();
    // Lower mandible.
    ctx.beginPath();
    ctx.moveTo(17.5, 0.5);
    ctx.bezierCurveTo(21, 1.5, 23, 3, 22.5, 5.5);
    ctx.bezierCurveTo(20, 5, 18, 4, 17.5, 3);
    ctx.closePath();
    ctx.fillStyle = bird.beakDark;
    ctx.fill();
    ctx.stroke();
  }

  function paintSnowy(ctx, bird, wingAngle) {
    tailFan(ctx, bird, -17, 1, 3, 8, 2.8, 0.3, Math.PI, bird.wing, bird.wingDark);
    // Small ear tufts.
    const tufts = [[-1, -14, -6, -21, 5, -15], [8, -15, 13, -21, 14, -13]];
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = bird.outline;
    for (let i = 0; i < tufts.length; ++i) {
      const t = tufts[i];
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(t[2], t[3]);
      ctx.lineTo(t[4], t[5]);
      ctx.closePath();
      ctx.fillStyle = shade(bird.body, -0.08);
      ctx.fill();
      ctx.stroke();
    }
    drawBody(ctx, bird, 20, 17);
    drawBelly(ctx, bird, 4, 9, 13, 7);
    // Dark speckles scattered over the back.
    ctx.fillStyle = '#9aa3b4';
    const specks = [[-14, -8], [-10, -11], [-6, -12], [-16, -2], [-12, -4], [-8, -6],
      [-14, 3], [-10, 1], [-4, -11], [-16, 7], [-12, 6], [-6, -8]];
    for (let i = 0; i < specks.length; ++i)
      dot(ctx, specks[i][0], specks[i][1], 1.2);
    strokeBody(ctx, bird, 20, 17);
    drawWing(ctx, bird, wingAngle);
    // Flat facial disc.
    ellipsePath(ctx, 8.5, -3, 12, 10.5);
    const fg = ctx.createRadialGradient(8.5, -6, 2, 8.5, -3, 12);
    fg.addColorStop(0, '#ffffff');
    fg.addColorStop(1, mix(bird.belly, bird.wingDark, 0.35));
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = mix(bird.outline, bird.wingDark, 0.5);
    ctx.stroke();
    // Tiny hooked beak between the eyes.
    ctx.beginPath();
    ctx.moveTo(8.5, -1.5);
    ctx.lineTo(11, 1.5);
    ctx.quadraticCurveTo(8.5, 6, 6, 1.5);
    ctx.closePath();
    ctx.fillStyle = bird.beak;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = bird.outline;
    ctx.stroke();
    drawOwlEye(ctx, 4, -4, 6, bird.eye);
    drawOwlEye(ctx, 13, -4, 6, bird.eye);
  }

  /* A flame feather with a gradient running from inner color to a fading tip. */
  function flameFeather(ctx, x, y, angle, len, w, inner, mid, tipAlpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    flameShape(ctx, len, w);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, hexToRgba(mid, tipAlpha));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function paintPhoenix(ctx, bird, wingAngle) {
    // Long flowing tail of three flame feathers, kept inside the sprite box.
    const tail = [[Math.PI - 0.38, 14], [Math.PI, 16], [Math.PI + 0.38, 13]];
    for (let i = 0; i < tail.length; ++i)
      flameFeather(ctx, -14, 0, tail[i][0], tail[i][1], 3.4, bird.accent, bird.body, 0.12);
    // Darker coverts under the flames.
    tailFan(ctx, bird, -16, 0, 2, 9, 2.6, 0.5, Math.PI, bird.wing, bird.wingDark);
    drawBody(ctx, bird, 21, 14);
    drawBelly(ctx, bird, 7, 5, 12, 8);
    drawGloss(ctx, 21, 14);
    strokeBody(ctx, bird, 21, 14);
    drawWing(ctx, bird, wingAngle);
    // Crest of three flame feathers leaning back from the head.
    const crest = [[-2.45, 9], [-2.75, 12], [-2.2, 7]];
    for (let i = 0; i < crest.length; ++i)
      flameFeather(ctx, 6, -11, crest[i][0], crest[i][1], 2.4, bird.accent, bird.body, 0.35);
    drawEye(ctx, 8, -5, 5, bird.eye);
    // Golden brow over the eye.
    ctx.beginPath();
    ctx.arc(8, -5, 6.4, -2.6, -1.2);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = bird.accent;
    ctx.stroke();
    drawWedgeBeak(ctx, bird, 19, -1, 9, 3, 2.4);
  }

  const PAINTERS = {
    round: paintSunny,
    robin: paintRuby,
    jay: paintJay,
    parrot: paintPip,
    owl: paintSnowy,
    phoenix: paintPhoenix
  };

  function paintBird(ctx, bird, wingAngle) {
    const paint = PAINTERS[bird.style] || paintSunny;
    paint(ctx, bird, wingAngle);
  }

  /* ── sprite cache ── */

  const spriteCache = {};

  function getSprite(birdId, frame) {
    const bird = birdFor(birdId);
    let f = Math.floor(frame);
    if (isNaN(f)) f = 0;
    f = ((f % 4) + 4) % 4;
    const key = bird.id + ':' + f;
    const hit = spriteCache[key];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const ctx = canvas.getContext('2d');
    ctx.scale(RS, RS);
    ctx.translate(LOCAL_W / 2, LOCAL_H / 2);
    paintBird(ctx, bird, WING_ANGLES[f]);

    spriteCache[key] = canvas;
    return canvas;
  }

  /* ── the bird as seen in a game frame: one blit, nothing else ── */

  function drawBird(ctx, opts) {
    const x = opts.x, y = opts.y;
    const angle = opts.angle || 0;
    const scale = opts.scale === undefined ? 1 : opts.scale;
    const alpha = opts.alpha === undefined ? 1 : opts.alpha;
    const sprite = getSprite(opts.birdId || 'sunny', opts.frame);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    ctx.drawImage(sprite, -32 * scale, -24 * scale, 64 * scale, 48 * scale);
    ctx.restore();
  }

  SZ.FlappyBirdArt = Object.freeze({ BIRDS, getSprite, drawBird });
})();
