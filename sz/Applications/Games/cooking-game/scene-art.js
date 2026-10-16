;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Five illustrated restaurant interiors for the Cooking Game career, one per
   * location. The whole room - back wall with its window and decor, dining
   * floor, service counter with stools, the pass and the tiled kitchen - is
   * painted ONCE into an opaque 1280x720 canvas with a seeded rng, so every
   * visit shows the same cozy room. A frame then costs one blit: the interior
   * scaled up to cover the canvas when the window is not 16:9. On top live the
   * ambient layers - cars and pedestrians drifting past the truck window, the
   * blinking diner neon, flickering bistro lamp glow, drifting sakura petals,
   * twinkling chandelier glints - all cached sprites or dots, plus a few steam
   * wisps rising off the kitchen line. No gradients, no blur and no
   * full-screen transparent images per frame.
   *
   * Layout the painting is built around (the play view is 1280 x 720):
   *   y   0..230  back wall with windows and decor
   *   y 230..330  dining floor where customers walk and sit
   *   y 300..350  service counter band, stools in front at y 330
   *   y 350..400  the pass / shelf
   *   y 400..720  kitchen: backsplash, floor, the five stations at 520..640
   */

  const W = 1280, H = 720;
  const TWO_PI = Math.PI * 2;
  /* what draw() covers when the caller does not say: exactly the play view */
  const FULL_VIEW = Object.freeze({ x0: 0, y0: 0, x1: W, y1: H });

  const WALL_B = 230;                 // bottom of the back wall
  const FLOOR_T = 230, FLOOR_B = 330; // dining floor
  const COUNTER_T = 300, COUNTER_B = 350;
  const PASS_T = 350, PASS_B = 400;
  const KITCHEN_T = 400;
  const SPLASH_B = 508;               // backsplash ends, kitchen floor begins

  const THEMES = {
    truck: { wall: '#dfe4e8', metal: '#b9c2c8', accent: '#ff9a3a', seat: '#ff9a3a' },
    diner: { wall: '#cfe9e0', accent: '#d8465a', seat: '#d8465a', floorA: '#f2ede2', floorB: '#d8465a' },
    bistro: { wall: '#8a4a32', accent: '#c0703a', seat: '#8a5a2a', wood: '#6a4226' },
    sushi: { wall: '#caa06a', accent: '#c0392b', seat: '#d8b078', wood: '#7a5230' },
    hotel: { wall: '#efe9dc', accent: '#d4af37', seat: '#efe6d2', marble: '#e6e0d2' }
  };
  const THEME_NAMES = ['truck', 'diner', 'bistro', 'sushi', 'hotel'];

  /* the truck's serving window, shared by the painter and the passing traffic */
  const TRUCK_WIN = { x0: 92, y0: 30, x1: 1188, y1: 202 };

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

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    const k = Math.max(0, Math.min(1, a));
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + k + ')';
  }

  /* f in [-1, 1]: negative darkens toward black, positive lightens toward white */
  function shade(hex, f) {
    const c = hexToRgb(hex);
    const target = f < 0 ? 0 : 255;
    const k = Math.min(1, Math.abs(f));
    const ch = function(v) {
      const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? '0' + s : s;
    };
    return '#' + ch(c.r + (target - c.r) * k) + ch(c.g + (target - c.g) * k) + ch(c.b + (target - c.b) * k);
  }

  function makeCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  /* mulberry32: the same seeded rng the sister modules use */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── painting helpers (build time only - gradients live in the cache) ── */

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function vgrad(c, x, y, w, h, stops) {
    const g = c.createLinearGradient(x, y, x, y + h);
    for (let i = 0; i < stops.length; ++i) g.addColorStop(stops[i][0], stops[i][1]);
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }

  function dot(c, x, y, r, color) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, TWO_PI);
    c.fill();
  }

  function chalkLine(c, x, y, w, color) {
    c.strokeStyle = color;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.stroke();
  }

  /* horizontal planks with seams and grain streaks */
  function woodPlanks(c, x, y, w, h, base, rnd, plankH) {
    vgrad(c, x, y, w, h, [[0, shade(base, 0.10)], [1, shade(base, -0.22)]]);
    for (let py = y + plankH; py < y + h; py += plankH) {
      c.fillStyle = rgba(shade(base, -0.5), 0.5);
      c.fillRect(x, py - 1, w, 2);
      c.fillStyle = rgba(shade(base, 0.35), 0.25);
      c.fillRect(x, py + 1, w, 1);
    }
    for (let i = 0; i < Math.floor(w * h / 5200); ++i) {
      const gx = x + rnd() * w;
      const gy = y + rnd() * h;
      c.strokeStyle = rgba(shade(base, rnd() < 0.5 ? -0.35 : 0.3), 0.16);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(gx, gy);
      c.quadraticCurveTo(gx + 30 + rnd() * 50, gy + rnd() * 4 - 2, gx + 60 + rnd() * 90, gy);
      c.stroke();
    }
  }

  /* running-bond brick with per-brick tone variation */
  function bricks(c, x, y, w, h, base, mortar, rnd) {
    c.fillStyle = mortar;
    c.fillRect(x, y, w, h);
    const bw = 64, bh = 22;
    for (let row = 0; y + row * bh < y + h; ++row) {
      const off = (row % 2) * bw / 2;
      for (let bx = x - bw; bx < x + w; bx += bw) {
        const px = bx + off + 2, py = y + row * bh + 2;
        const pw = bw - 4, ph = bh - 4;
        if (px > x + w || px + pw < x) continue;
        c.fillStyle = shade(base, (rnd() - 0.5) * 0.22);
        c.fillRect(Math.max(x, px), py, Math.min(pw, x + w - px), ph);
      }
    }
  }

  /* square tiles with grout, seen flat */
  function tiles(c, x, y, w, h, base, grout, size, rnd) {
    c.fillStyle = grout;
    c.fillRect(x, y, w, h);
    for (let ty = y; ty < y + h; ty += size) {
      for (let tx = x; tx < x + w; tx += size) {
        c.fillStyle = shade(base, (rnd() - 0.5) * 0.14);
        c.fillRect(tx + 2, ty + 2, size - 4, size - 4);
      }
    }
  }

  /* checkerboard in three perspective rows, squares growing toward the viewer */
  function checkerFloor(c, y0, y1, colA, colB, rnd) {
    const rows = [[y0, 30, 62], [y0 + 30, 34, 78], [y0 + 64, y1 - y0 - 64, 98]];
    for (let r = 0; r < rows.length; ++r) {
      const ry = rows[r][0], rh = rows[r][1], sq = rows[r][2];
      const shift = (r % 2) * sq / 2;
      for (let k = -1; k * sq + shift < W + sq; ++k) {
        const x = k * sq + shift;
        c.fillStyle = (k + r) % 2 === 0 ? colA : colB;
        c.fillRect(x, ry, sq, rh);
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.10)';
    c.fillRect(0, y0, W, 4);
  }

  /* marble: pale base, wandering veins, a few gold ones */
  function marble(c, x, y, w, h, base, rnd) {
    vgrad(c, x, y, w, h, [[0, shade(base, 0.14)], [0.6, base], [1, shade(base, -0.10)]]);
    for (let i = 0; i < 26; ++i) {
      const vx = x + rnd() * w, vy = y + rnd() * h;
      c.strokeStyle = rgba('#8a8578', 0.06 + rnd() * 0.10);
      c.lineWidth = 0.8 + rnd() * 2.4;
      c.beginPath();
      c.moveTo(vx, vy);
      c.bezierCurveTo(vx + (rnd() - 0.5) * 160, vy + (rnd() - 0.5) * 70,
        vx + (rnd() - 0.5) * 260, vy + (rnd() - 0.5) * 90,
        vx + (rnd() - 0.5) * 340, vy + (rnd() - 0.5) * 120);
      c.stroke();
    }
    for (let i = 0; i < 6; ++i) {
      const vx = x + rnd() * w, vy = y + rnd() * h;
      c.strokeStyle = rgba('#d4af37', 0.10 + rnd() * 0.08);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(vx, vy);
      c.quadraticCurveTo(vx + (rnd() - 0.5) * 180, vy + (rnd() - 0.5) * 60, vx + (rnd() - 0.5) * 260, vy + (rnd() - 0.5) * 80);
      c.stroke();
    }
  }

  /* a bar stool: seat, stem, foot ring */
  function stool(c, x, seatY, seatR, seatColor, stemColor, rnd) {
    c.fillStyle = rgba('#000000', 0.18);
    c.beginPath();
    c.ellipse(x, seatY + 22, seatR * 0.9, 5, 0, 0, TWO_PI);
    c.fill();
    c.fillStyle = stemColor;
    c.fillRect(x - 3, seatY, 6, 20);
    c.strokeStyle = stemColor;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(x, seatY + 18, seatR * 0.7, 5, 0, 0, TWO_PI);
    c.stroke();
    c.fillStyle = seatColor;
    c.beginPath();
    c.ellipse(x, seatY, seatR, seatR * 0.42, 0, 0, TWO_PI);
    c.fill();
    c.strokeStyle = shade(seatColor, -0.4);
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(x, seatY, seatR, seatR * 0.42, 0, 0, TWO_PI);
    c.stroke();
    c.fillStyle = rgba('#ffffff', 0.28);
    c.beginPath();
    c.ellipse(x - seatR * 0.25, seatY - seatR * 0.12, seatR * 0.45, seatR * 0.16, -0.2, 0, TWO_PI);
    c.fill();
  }

  /* a hanging pendant lamp: cord, cone shade, warm bulb */
  function pendant(c, x, shadeTop, shadeH, shadeColor) {
    c.strokeStyle = '#2a241e';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, shadeTop);
    c.stroke();
    c.fillStyle = shadeColor;
    c.beginPath();
    c.moveTo(x - 6, shadeTop);
    c.lineTo(x + 6, shadeTop);
    c.lineTo(x + 26, shadeTop + shadeH);
    c.lineTo(x - 26, shadeTop + shadeH);
    c.closePath();
    c.fill();
    c.fillStyle = rgba(shade(shadeColor, 0.5), 0.5);
    c.beginPath();
    c.moveTo(x - 4, shadeTop + 2);
    c.lineTo(x + 2, shadeTop + 2);
    c.lineTo(x + 12, shadeTop + shadeH - 2);
    c.lineTo(x - 14, shadeTop + shadeH - 2);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffe9b0';
    c.beginPath();
    c.arc(x, shadeTop + shadeH + 4, 6, 0, TWO_PI);
    c.fill();
    c.fillStyle = rgba('#ffd76a', 0.35);
    c.beginPath();
    c.arc(x, shadeTop + shadeH + 4, 12, 0, TWO_PI);
    c.fill();
  }

  /* a bottle standing on a shelf */
  function bottle(c, x, baseY, hgt, color) {
    const bw = 10, neck = hgt * 0.35;
    c.fillStyle = color;
    rr(c, x - bw / 2, baseY - hgt + neck, bw, hgt - neck, 3);
    c.fill();
    c.fillRect(x - 2.5, baseY - hgt, 5, neck + 2);
    c.fillStyle = rgba('#ffffff', 0.22);
    c.fillRect(x - bw / 2 + 2, baseY - hgt + neck + 3, 2, hgt - neck - 8);
    c.fillStyle = rgba('#f2e6c8', 0.85);
    c.fillRect(x - bw / 2 + 1, baseY - hgt * 0.52, bw - 2, 7);
  }

  /* a potted palm for the hotel corners */
  function palm(c, x, baseY, s, rnd) {
    c.fillStyle = rgba('#000000', 0.16);
    c.beginPath();
    c.ellipse(x, baseY + 2, 30 * s, 7, 0, 0, TWO_PI);
    c.fill();
    c.fillStyle = '#b8863a';
    c.beginPath();
    c.moveTo(x - 20 * s, baseY - 34 * s);
    c.lineTo(x + 20 * s, baseY - 34 * s);
    c.lineTo(x + 15 * s, baseY);
    c.lineTo(x - 15 * s, baseY);
    c.closePath();
    c.fill();
    c.fillStyle = '#d4af37';
    c.fillRect(x - 21 * s, baseY - 38 * s, 42 * s, 6);
    c.strokeStyle = '#6a4a2a';
    c.lineWidth = 4 * s;
    c.beginPath();
    c.moveTo(x, baseY - 36 * s);
    c.quadraticCurveTo(x + 3 * s, baseY - 60 * s, x, baseY - 78 * s);
    c.stroke();
    for (let i = 0; i < 9; ++i) {
      const a = -Math.PI * (0.08 + 0.84 * i / 8);
      const len = (34 + rnd() * 16) * s;
      const tx = x + Math.cos(a) * len, ty = baseY - 78 * s + Math.sin(a) * len * 0.8;
      c.strokeStyle = i % 2 ? '#3f7a3a' : '#57944a';
      c.lineWidth = 3.4 * s;
      c.beginPath();
      c.moveTo(x, baseY - 78 * s);
      c.quadraticCurveTo(x + Math.cos(a) * len * 0.6, baseY - 78 * s + Math.sin(a) * len * 0.35 - 10 * s, tx, ty);
      c.stroke();
    }
  }

  /* ── the food truck: serving window onto a street, stainless everywhere ── */

  function paintTruck(c, rnd, theme) {
    vgrad(c, 0, 0, W, WALL_B, [[0, '#e6eaee'], [1, theme.wall]]);
    for (let x = 60; x < W; x += 160) {
      c.fillStyle = rgba('#8a929a', 0.5);
      c.fillRect(x, 0, 2, WALL_B);
      c.fillStyle = rgba('#ffffff', 0.4);
      c.fillRect(x + 2, 0, 1, WALL_B);
    }
    for (let x = 20; x < W; x += 40) {
      dot(c, x, 12, 2, rgba('#7a828a', 0.6));
      dot(c, x, WALL_B - 10, 2, rgba('#7a828a', 0.6));
    }

    /* the standing strip where customers queue: dark non-slip matting */
    c.fillStyle = '#8a929a';
    c.fillRect(0, WALL_B - 6, W, 6);
    vgrad(c, 0, FLOOR_T, W, FLOOR_B - FLOOR_T, [[0, '#4a4f55'], [1, '#31363b']]);
    c.strokeStyle = rgba('#5a6168', 0.35);
    c.lineWidth = 2;
    for (let dy = FLOOR_T + 10; dy < FLOOR_B; dy += 14) {
      c.beginPath();
      for (let x = -40; x < W; x += 40) {
        c.moveTo(x, dy);
        c.lineTo(x + 20, dy - 8);
      }
      c.stroke();
    }

    /* the serving window: frame, then the street through it */
    c.fillStyle = '#6f7880';
    rr(c, TRUCK_WIN.x0 - 12, TRUCK_WIN.y0 - 12, TRUCK_WIN.x1 - TRUCK_WIN.x0 + 24, TRUCK_WIN.y1 - TRUCK_WIN.y0 + 24, 14);
    c.fill();
    c.strokeStyle = rgba('#39414a', 0.8);
    c.lineWidth = 3;
    rr(c, TRUCK_WIN.x0 - 12, TRUCK_WIN.y0 - 12, TRUCK_WIN.x1 - TRUCK_WIN.x0 + 24, TRUCK_WIN.y1 - TRUCK_WIN.y0 + 24, 14);
    c.stroke();
    c.save();
    rr(c, TRUCK_WIN.x0, TRUCK_WIN.y0, TRUCK_WIN.x1 - TRUCK_WIN.x0, TRUCK_WIN.y1 - TRUCK_WIN.y0, 8);
    c.clip();
    vgrad(c, TRUCK_WIN.x0, TRUCK_WIN.y0, TRUCK_WIN.x1 - TRUCK_WIN.x0, 130, [[0, '#9fc8e8'], [1, '#e8f0ee']]);
    for (let i = 0; i < 5; ++i) {
      const bx = TRUCK_WIN.x0 + 40 + i * 220 + rnd() * 60;
      const bw = 90 + rnd() * 70, bh = 60 + rnd() * 50;
      c.fillStyle = rgba('#9aa8b8', 0.5);
      c.fillRect(bx, 150 - bh, bw, bh);
      c.fillStyle = rgba('#f4f0d8', 0.5);
      for (let wy = 158 - bh; wy < 140; wy += 16)
        for (let wx = bx + 8; wx < bx + bw - 10; wx += 18) c.fillRect(wx, wy, 8, 9);
    }
    c.fillStyle = '#c8ccc4';
    c.fillRect(TRUCK_WIN.x0, 150, TRUCK_WIN.x1 - TRUCK_WIN.x0, 22);
    c.fillStyle = '#8a8f88';
    c.fillRect(TRUCK_WIN.x0, 170, TRUCK_WIN.x1 - TRUCK_WIN.x0, TRUCK_WIN.y1 - 170);
    c.fillStyle = rgba('#f2f2ea', 0.7);
    c.fillRect(TRUCK_WIN.x0, 170, TRUCK_WIN.x1 - TRUCK_WIN.x0, 3);
    for (let tx = 200; tx < 1150; tx += 300) {
      c.fillStyle = '#5a4630';
      c.fillRect(tx - 4, 118, 8, 36);
      dot(c, tx, 104, 26, '#4a7a3a');
      dot(c, tx - 18, 114, 18, '#57944a');
      dot(c, tx + 20, 112, 20, '#3f6a32');
    }
    const parked = [[360, '#7a3a3a'], [880, '#3a5a7a']];
    for (let i = 0; i < parked.length; ++i) {
      const px = parked[i][0], pc = parked[i][1];
      c.fillStyle = pc;
      rr(c, px, 148, 110, 22, 8);
      c.fill();
      rr(c, px + 22, 134, 60, 18, 7);
      c.fill();
      c.fillStyle = rgba('#cfe4f2', 0.85);
      c.fillRect(px + 28, 137, 22, 12);
      c.fillRect(px + 54, 137, 22, 12);
      dot(c, px + 24, 170, 8, '#22262a');
      dot(c, px + 92, 170, 8, '#22262a');
    }

    /* the hanging menu board */
    c.strokeStyle = '#5a6168';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(470, TRUCK_WIN.y0);
    c.lineTo(470, 46);
    c.moveTo(810, TRUCK_WIN.y0);
    c.lineTo(810, 46);
    c.stroke();
    c.fillStyle = '#7a5a3a';
    rr(c, 430, 44, 420, 122, 6);
    c.fill();
    c.fillStyle = '#2e3438';
    rr(c, 440, 54, 400, 102, 4);
    c.fill();
    c.fillStyle = '#f2ecd8';
    c.font = 'bold 22px sans-serif';
    c.textAlign = 'center';
    c.fillText('TODAY', 640, 78);
    chalkLine(c, 560, 86, 160, rgba('#f2ecd8', 0.7));
    for (let i = 0; i < 3; ++i) {
      chalkLine(c, 462, 102 + i * 18, 250, rgba('#d8d4c4', 0.55));
      chalkLine(c, 760, 102 + i * 18, 56, rgba('#ffd76a', 0.7));
    }

    /* string lights along the top of the window */
    c.strokeStyle = '#3a4048';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(TRUCK_WIN.x0, TRUCK_WIN.y0 + 8);
    for (let x = TRUCK_WIN.x0; x <= TRUCK_WIN.x1; x += 40)
      c.lineTo(x, TRUCK_WIN.y0 + 8 + Math.sin((x - TRUCK_WIN.x0) / (TRUCK_WIN.x1 - TRUCK_WIN.x0) * Math.PI) * 10);
    c.stroke();
    for (let x = TRUCK_WIN.x0 + 30; x < TRUCK_WIN.x1; x += 70) {
      const sy = TRUCK_WIN.y0 + 8 + Math.sin((x - TRUCK_WIN.x0) / (TRUCK_WIN.x1 - TRUCK_WIN.x0) * Math.PI) * 10;
      dot(c, x, sy + 7, 7, rgba('#ffd76a', 0.25));
      dot(c, x, sy + 7, 3.4, '#ffd76a');
    }
    c.restore();

    /* counter: brushed steel with a sneeze guard */
    c.fillStyle = rgba('#ffffff', 0.16);
    c.fillRect(150, 258, 980, 42);
    c.strokeStyle = rgba('#cfd8de', 0.7);
    c.lineWidth = 2;
    c.strokeRect(150, 258, 980, 42);
    c.beginPath();
    c.moveTo(150, 258);
    c.lineTo(170, 250);
    c.moveTo(1130, 258);
    c.lineTo(1110, 250);
    c.stroke();
    vgrad(c, 0, COUNTER_T, W, COUNTER_B - COUNTER_T, [[0, '#d4dade'], [0.2, '#b9c2c8'], [1, '#8f979d']]);
    for (let x = 0; x < W; x += 7) {
      c.fillStyle = rgba('#ffffff', 0.05 + (x % 3) * 0.02);
      c.fillRect(x, COUNTER_T + 2, 3, 8);
    }
    c.fillStyle = '#5a6168';
    c.fillRect(0, COUNTER_B - 6, W, 6);
    for (let sx = 300; sx <= 980; sx += 340) stool(c, sx, 330, 26, theme.seat, '#7a828a', rnd);

    /* the pass: steel shelf with trays and stacked boxes */
    vgrad(c, 0, PASS_T, W, PASS_B - PASS_T, [[0, '#c2c9cf'], [1, '#99a1a7']]);
    c.fillStyle = '#6a7178';
    c.fillRect(0, PASS_B - 5, W, 5);
    for (let i = 0; i < 3; ++i) {
      const tx = 180 + i * 380;
      c.fillStyle = '#c8cdd2';
      rr(c, tx, 366, 120, 22, 4);
      c.fill();
      c.fillStyle = ['#c8763a', '#7aa24a', '#b8563a'][i];
      for (let b = 0; b < 4; ++b) dot(c, tx + 18 + b * 28, 366, 9, ['#c8763a', '#7aa24a', '#b8563a'][i]);
    }
    c.fillStyle = '#c8b088';
    for (let s = 0; s < 3; ++s) c.fillRect(1040, 384 - s * 10, 90, 9);

    /* kitchen: stainless backsplash, diamond-plate floor, side cabinets */
    vgrad(c, 0, KITCHEN_T, W, SPLASH_B - KITCHEN_T, [[0, '#d0d6da'], [1, '#a8b0b6']]);
    for (let x = 213; x < W; x += 213) {
      c.fillStyle = rgba('#7a828a', 0.6);
      c.fillRect(x, KITCHEN_T, 3, SPLASH_B - KITCHEN_T);
      for (let ry = KITCHEN_T + 14; ry < SPLASH_B; ry += 26) dot(c, x + 1.5, ry, 1.6, rgba('#6a7178', 0.7));
    }
    c.strokeStyle = '#6a7178';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(60, 436);
    c.lineTo(1220, 436);
    c.stroke();
    const hang = [[140, 'spat'], [210, 'ladle'], [1040, 'spat'], [1110, 'skew']];
    for (let i = 0; i < hang.length; ++i) {
      const hx = hang[i][0];
      c.strokeStyle = '#525a62';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(hx, 438);
      c.lineTo(hx, 478);
      c.stroke();
      if (hang[i][1] === 'spat') {
        c.fillStyle = '#525a62';
        c.fillRect(hx - 7, 478, 14, 22);
      } else if (hang[i][1] === 'ladle') {
        c.strokeStyle = '#525a62';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(hx, 486, 9, 0, Math.PI);
        c.stroke();
      } else {
        c.strokeStyle = '#525a62';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(hx - 8, 478);
        c.lineTo(hx + 8, 494);
        c.moveTo(hx + 8, 478);
        c.lineTo(hx - 8, 494);
        c.stroke();
      }
    }
    vgrad(c, 0, SPLASH_B, W, H - SPLASH_B, [[0, '#a2a8ae'], [1, '#767d84']]);
    for (let dy = SPLASH_B + 10; dy < H; dy += 26) {
      for (let dx = 0; dx < W; dx += 26) {
        c.save();
        c.translate(dx + ((dy / 26) % 2) * 13, dy);
        c.rotate(Math.PI / 4);
        c.fillStyle = rgba('#c6ccd2', 0.18);
        c.fillRect(-4, -4, 8, 8);
        c.restore();
      }
    }
    c.fillStyle = rgba('#000000', 0.12);
    c.fillRect(0, SPLASH_B, W, 5);
    for (let side = 0; side < 2; ++side) {
      const cx0 = side === 0 ? 0 : 1100;
      vgrad(c, cx0, SPLASH_B, 180, 152, [[0, '#c0c7cd'], [1, '#949ca2']]);
      c.strokeStyle = '#6a7178';
      c.lineWidth = 3;
      c.strokeRect(cx0 + 8, SPLASH_B + 10, 164, 132);
      c.strokeRect(cx0 + 14, SPLASH_B + 16, 152, 120);
      c.fillStyle = '#5a6168';
      c.fillRect(cx0 + (side === 0 ? 150 : 18), SPLASH_B + 60, 12, 4);
    }
  }

  /* ── the 50s diner: mint and red, checker floor, chrome, neon ── */

  function paintDiner(c, rnd, theme) {
    vgrad(c, 0, 0, W, 146, [[0, shade(theme.wall, 0.18)], [1, theme.wall]]);
    c.fillStyle = theme.accent;
    c.fillRect(0, 140, W, 10);
    c.fillStyle = '#f4f2ec';
    c.fillRect(0, 150, W, WALL_B - 150);
    for (let x = 0; x < W; x += 48) {
      c.fillStyle = rgba('#b8b4a8', 0.5);
      c.fillRect(x, 150, 2, WALL_B - 150);
    }
    c.fillStyle = rgba('#b8b4a8', 0.5);
    c.fillRect(0, 190, W, 2);
    c.fillStyle = theme.accent;
    c.fillRect(0, WALL_B - 8, W, 8);
    checkerFloor(c, FLOOR_T, FLOOR_B, theme.floorA, theme.floorB, rnd);

    /* neon 'DINER' sign: the housing, the tube itself blinks in the ambient */
    c.fillStyle = '#2a2f36';
    rr(c, 505, 26, 270, 92, 12);
    c.fill();
    c.strokeStyle = '#c8cdd2';
    c.lineWidth = 4;
    rr(c, 505, 26, 270, 92, 12);
    c.stroke();
    c.fillStyle = '#8a9098';
    c.fillRect(630, 118, 20, 22);

    /* jukebox against the left wall */
    c.fillStyle = '#7a3a2a';
    rr(c, 70, 96, 140, 134, 14);
    c.fill();
    c.fillStyle = '#c8cdd2';
    c.beginPath();
    c.moveTo(78, 130);
    c.quadraticCurveTo(140, 78, 202, 130);
    c.lineTo(202, 142);
    c.quadraticCurveTo(140, 94, 78, 142);
    c.closePath();
    c.fill();
    c.fillStyle = '#3a6a8a';
    rr(c, 92, 132, 96, 44, 8);
    c.fill();
    for (let i = 0; i < 4; ++i) {
      c.fillStyle = ['#ffd23f', '#ff6b6b', '#6bd24a', '#4ac8ff'][i];
      c.fillRect(100, 140 + i * 9, 80, 4);
    }
    c.fillStyle = '#2a241e';
    rr(c, 96, 184, 88, 34, 6);
    c.fill();
    for (let i = 0; i < 5; ++i) {
      c.strokeStyle = rgba('#c8cdd2', 0.5);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(140, 201, 5 + i * 4, 0, TWO_PI);
      c.stroke();
    }
    c.fillStyle = '#d4af37';
    c.fillRect(70, 222, 140, 8);

    /* wall clock and a framed picture on the right */
    dot(c, 1150, 84, 26, '#f4f2ec');
    c.strokeStyle = '#3a352e';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(1150, 84, 26, 0, TWO_PI);
    c.stroke();
    c.strokeStyle = '#3a352e';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(1150, 84);
    c.lineTo(1150, 68);
    c.moveTo(1150, 84);
    c.lineTo(1162, 90);
    c.stroke();
    c.fillStyle = '#7a5a3a';
    c.fillRect(960, 60, 90, 66);
    c.fillStyle = '#8ac8e8';
    c.fillRect(968, 68, 74, 50);
    c.fillStyle = '#57944a';
    c.fillRect(968, 100, 74, 18);
    dot(c, 1024, 80, 8, '#ffd76a');

    /* chrome counter with red vinyl stools */
    vgrad(c, 0, COUNTER_T, W, COUNTER_B - COUNTER_T, [[0, '#e2e6e9'], [0.25, '#c2c9cf'], [1, '#949ca2']]);
    for (let x = 14; x < W; x += 28) {
      c.fillStyle = rgba('#6a7178', 0.35);
      c.fillRect(x, COUNTER_T + 10, 3, COUNTER_B - COUNTER_T - 16);
      c.fillStyle = rgba('#ffffff', 0.5);
      c.fillRect(x + 3, COUNTER_T + 10, 2, COUNTER_B - COUNTER_T - 16);
    }
    c.fillStyle = '#f4f2ec';
    c.fillRect(0, COUNTER_T - 6, W, 8);
    c.fillStyle = theme.accent;
    c.fillRect(0, COUNTER_T - 8, W, 2);
    for (let sx = 220; sx <= 1060; sx += 168) stool(c, sx, 330, 24, theme.seat, '#c8cdd2', rnd);

    /* the pass: chrome shelf, heat lamps, plates and a pie */
    vgrad(c, 0, PASS_T, W, PASS_B - PASS_T, [[0, '#d6dbdf'], [1, '#a6aeb4']]);
    c.fillStyle = '#6a7178';
    c.fillRect(0, PASS_B - 5, W, 5);
    for (let lx = 200; lx <= 1080; lx += 220) {
      c.fillStyle = '#8a9098';
      c.fillRect(lx - 30, PASS_T + 4, 60, 6);
      const g = c.createRadialGradient(lx, PASS_T + 14, 2, lx, PASS_T + 14, 34);
      g.addColorStop(0, rgba('#ff6a3a', 0.55));
      g.addColorStop(1, rgba('#ff6a3a', 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(lx, PASS_T + 14, 34, 0, TWO_PI);
      c.fill();
    }
    for (let i = 0; i < 3; ++i) {
      c.fillStyle = '#f4f2ec';
      c.beginPath();
      c.ellipse(320, 388 - i * 6, 34, 7, 0, 0, TWO_PI);
      c.fill();
    }
    c.fillStyle = '#e8c86a';
    c.beginPath();
    c.arc(760, 378, 20, Math.PI, TWO_PI);
    c.fill();
    c.fillStyle = '#c8cdd2';
    c.fillRect(738, 378, 44, 4);
    c.fillStyle = rgba('#cfe4f2', 0.5);
    c.beginPath();
    c.arc(760, 378, 26, Math.PI, TWO_PI);
    c.fill();

    /* kitchen: white tile with a red accent row, quarry-tile floor */
    tiles(c, 0, KITCHEN_T, W, SPLASH_B - KITCHEN_T, '#f2f0ea', '#c8c4ba', 42, rnd);
    c.fillStyle = theme.accent;
    for (let x = 0; x < W; x += 42) c.fillRect(x + 2, KITCHEN_T + 44, 38, 38);
    vgrad(c, 0, SPLASH_B, W, H - SPLASH_B, [[0, '#b8763a'], [1, '#8a5428']]);
    for (let ty = SPLASH_B; ty < H; ty += 52) {
      for (let tx = 0; tx < W; tx += 52) {
        c.fillStyle = shade('#a86a32', (rnd() - 0.5) * 0.2);
        c.fillRect(tx + 2, ty + 2, 48, 48);
      }
    }
    c.fillStyle = rgba('#000000', 0.14);
    c.fillRect(0, SPLASH_B, W, 5);
    vgrad(c, 0, H - 46, W, 46, [[0, '#c2c9cf'], [1, '#8f979d']]);
    c.fillStyle = '#6a7178';
    c.fillRect(0, H - 46, W, 4);
  }
  /* ── the French bistro: brick, chalkboard, wine shelf, Paris at dusk ── */

  function paintBistro(c, rnd, theme) {
    bricks(c, 0, 0, W, WALL_B, theme.wall, '#cfc4b4', rnd);
    c.fillStyle = rgba('#000000', 0.14);
    c.fillRect(0, WALL_B - 10, W, 10);

    /* chalkboard menu on the left */
    c.fillStyle = '#5a3a22';
    rr(c, 56, 42, 280, 158, 6);
    c.fill();
    c.fillStyle = '#2f3a33';
    rr(c, 68, 54, 256, 134, 3);
    c.fill();
    c.fillStyle = '#e8e4d4';
    c.font = 'bold 24px sans-serif';
    c.textAlign = 'center';
    c.fillText('MENU', 196, 82);
    chalkLine(c, 150, 90, 92, rgba('#e8e4d4', 0.7));
    for (let i = 0; i < 4; ++i) {
      chalkLine(c, 84, 108 + i * 17, 150 + (i % 2) * 24, rgba('#d8d4c4', 0.5));
      chalkLine(c, 268, 108 + i * 17, 40, rgba('#ffd76a', 0.65));
    }
    c.strokeStyle = rgba('#e8e4d4', 0.6);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(296, 150);
    c.lineTo(312, 150);
    c.lineTo(304, 168);
    c.lineTo(304, 180);
    c.moveTo(298, 180);
    c.lineTo(310, 180);
    c.stroke();

    /* the window onto a Paris street at dusk */
    c.fillStyle = '#3a4a3a';
    rr(c, 388, 14, 624, 204, 10);
    c.fill();
    c.save();
    rr(c, 400, 26, 600, 180, 6);
    c.clip();
    vgrad(c, 400, 26, 600, 180, [[0, '#f2c89a'], [0.55, '#e8a06a'], [1, '#c8784a']]);
    dot(c, 900, 66, 20, rgba('#fff2cc', 0.85));
    dot(c, 900, 66, 34, rgba('#ffd76a', 0.3));
    /* Haussmann facades on both sides */
    const facade = function(fx, fw, fh) {
      c.fillStyle = '#e8dcc4';
      c.fillRect(fx, 176 - fh, fw, fh);
      c.fillStyle = '#5a544a';
      c.beginPath();
      c.moveTo(fx - 4, 176 - fh);
      c.lineTo(fx + fw + 4, 176 - fh);
      c.lineTo(fx + fw, 176 - fh - 14);
      c.lineTo(fx, 176 - fh - 14);
      c.closePath();
      c.fill();
      c.fillStyle = '#4a5464';
      for (let wy = 184 - fh; wy < 168; wy += 26)
        for (let wx = fx + 10; wx < fx + fw - 16; wx += 26) c.fillRect(wx, wy, 13, 18);
    };
    facade(404, 150, 120);
    facade(900, 100, 132);
    /* the Eiffel Tower closing the vista */
    c.fillStyle = rgba('#6a5a4a', 0.85);
    c.beginPath();
    c.moveTo(660, 176);
    c.quadraticCurveTo(672, 120, 676, 60);
    c.lineTo(684, 60);
    c.quadraticCurveTo(688, 120, 700, 176);
    c.lineTo(690, 176);
    c.quadraticCurveTo(684, 140, 680, 128);
    c.lineTo(680, 128);
    c.quadraticCurveTo(676, 140, 670, 176);
    c.closePath();
    c.fill();
    c.fillRect(664, 122, 32, 5);
    c.fillRect(670, 88, 20, 4);
    c.fillRect(677, 46, 6, 14);
    /* street, lamps and plane trees */
    c.fillStyle = '#9a8a78';
    c.fillRect(400, 176, 600, 30);
    c.fillStyle = rgba('#f2ecd8', 0.4);
    c.fillRect(400, 176, 600, 3);
    for (let lx = 470; lx < 1000; lx += 190) {
      c.strokeStyle = '#3a352e';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(lx, 176);
      c.lineTo(lx, 128);
      c.quadraticCurveTo(lx + 8, 120, lx + 16, 122);
      c.stroke();
      dot(c, lx + 17, 124, 5, '#ffe9b0');
      dot(c, lx + 17, 124, 11, rgba('#ffd76a', 0.3));
    }
    for (let tx = 540; tx < 1000; tx += 240) {
      c.fillStyle = '#5a4630';
      c.fillRect(tx - 3, 132, 6, 44);
      dot(c, tx, 118, 20, '#57944a');
      dot(c, tx - 14, 128, 14, '#6aa85a');
      dot(c, tx + 16, 126, 15, '#3f7a3a');
    }
    c.restore();
    c.strokeStyle = '#2a3a2a';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(700, 26);
    c.lineTo(700, 206);
    c.moveTo(400, 116);
    c.lineTo(1000, 116);
    c.stroke();

    /* wine shelf on the right wall */
    c.fillStyle = '#5a3a22';
    c.fillRect(1036, 60, 226, 10);
    c.fillRect(1036, 130, 226, 10);
    c.fillRect(1036, 196, 226, 10);
    const wineCols = ['#2a4a2a', '#4a2a2a', '#2a3a5a', '#5a4a1a', '#3a5a3a'];
    for (let s = 0; s < 2; ++s) {
      for (let i = 0; i < 7; ++i) {
        bottle(c, 1056 + i * 30, 60 + s * 70, 40 + (i % 3) * 6, wineCols[(i + s * 2) % wineCols.length]);
      }
    }
    for (let i = 0; i < 4; ++i) {
      const gx = 1060 + i * 46;
      c.strokeStyle = rgba('#d8e4ea', 0.7);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(gx, 196);
      c.lineTo(gx, 214);
      c.moveTo(gx - 7, 222);
      c.quadraticCurveTo(gx, 210, gx + 7, 222);
      c.stroke();
    }

    /* warm pendant lamps over the counter (their glow flickers in ambient) */
    pendant(c, 320, 58, 34, '#b8622a');
    pendant(c, 640, 50, 34, '#b8622a');
    pendant(c, 960, 58, 34, '#b8622a');

    /* dining floor: warm planks; counter: dark wood with a brass rail */
    woodPlanks(c, 0, FLOOR_T, W, FLOOR_B - FLOOR_T, '#a8763e', rnd, 24);
    vgrad(c, 0, COUNTER_T, W, COUNTER_B - COUNTER_T, [[0, shade(theme.wood, 0.25)], [1, shade(theme.wood, -0.3)]]);
    c.fillStyle = '#d4af37';
    c.fillRect(0, COUNTER_T + 14, W, 4);
    c.fillStyle = rgba('#f2e6c8', 0.5);
    c.fillRect(0, COUNTER_T + 18, W, 1);
    c.fillStyle = shade(theme.wood, -0.5);
    c.fillRect(0, COUNTER_B - 6, W, 6);
    for (let sx = 260; sx <= 1020; sx += 253) stool(c, sx, 330, 24, theme.seat, shade(theme.wood, -0.4), rnd);

    /* the pass: wood shelf with hanging pans and jars */
    vgrad(c, 0, PASS_T, W, PASS_B - PASS_T, [[0, shade(theme.wood, 0.3)], [1, shade(theme.wood, -0.2)]]);
    c.fillStyle = shade(theme.wood, -0.5);
    c.fillRect(0, PASS_B - 5, W, 5);
    for (let i = 0; i < 4; ++i) {
      const px = 180 + i * 120;
      c.strokeStyle = '#3a352e';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(px, PASS_T + 2);
      c.lineTo(px, PASS_T + 16);
      c.stroke();
      c.fillStyle = ['#b8763a', '#8a8f98', '#b8763a', '#8a8f98'][i];
      c.beginPath();
      c.arc(px, PASS_T + 26, 11, 0, TWO_PI);
      c.fill();
    }
    for (let i = 0; i < 3; ++i) {
      const jx = 800 + i * 90;
      c.fillStyle = ['#7aa24a', '#c8763a', '#b8563a'][i];
      rr(c, jx, 362, 34, 28, 5);
      c.fill();
      c.fillStyle = rgba('#d8e4ea', 0.5);
      c.fillRect(jx + 4, 358, 26, 6);
    }

    /* kitchen: cream subway tiles, terracotta floor, a copper pot rail */
    c.fillStyle = '#c8c0b0';
    c.fillRect(0, KITCHEN_T, W, SPLASH_B - KITCHEN_T);
    for (let row = 0; KITCHEN_T + row * 24 < SPLASH_B; ++row) {
      const off = (row % 2) * 34;
      for (let tx = -68; tx < W; tx += 68) {
        c.fillStyle = shade('#e8e0d0', (rnd() - 0.5) * 0.08);
        c.fillRect(tx + off + 2, KITCHEN_T + row * 24 + 2, 64, 20);
      }
    }
    vgrad(c, 0, SPLASH_B, W, H - SPLASH_B, [[0, '#b06a3a'], [1, '#7e4a26']]);
    for (let ty = SPLASH_B; ty < H; ty += 56) {
      for (let tx = 0; tx < W; tx += 56) {
        c.fillStyle = shade('#a05f32', (rnd() - 0.5) * 0.18);
        c.fillRect(tx + 2, ty + 2, 52, 52);
      }
    }
    c.fillStyle = rgba('#000000', 0.14);
    c.fillRect(0, SPLASH_B, W, 5);
    c.strokeStyle = '#5a4630';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(60, 430);
    c.lineTo(1220, 430);
    c.stroke();
    for (let i = 0; i < 4; ++i) {
      const px = 150 + i * 300;
      c.strokeStyle = '#8a5a2a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(px, 432);
      c.lineTo(px, 452);
      c.stroke();
      c.fillStyle = '#b8763a';
      rr(c, px - 16, 452, 32, 22, 5);
      c.fill();
      c.fillStyle = rgba('#ffd76a', 0.3);
      c.fillRect(px - 12, 455, 8, 16);
    }
  }

  /* ── the sushi bar: hinoki slats, lanterns, noren, sakura outside ── */

  function paintSushi(c, rnd, theme) {
    vgrad(c, 0, 0, W, WALL_B, [[0, shade(theme.wall, 0.16)], [1, shade(theme.wall, -0.12)]]);
    for (let x = 0; x < W; x += 46) {
      c.fillStyle = rgba('#6a4a2a', 0.55);
      c.fillRect(x, 0, 3, WALL_B);
      c.fillStyle = rgba('#f2e0c0', 0.3);
      c.fillRect(x + 3, 0, 2, WALL_B);
      for (let i = 0; i < 3; ++i) {
        c.strokeStyle = rgba('#8a6a44', 0.25);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 10 + i * 10, 0);
        c.lineTo(x + 10 + i * 10 + (rnd() - 0.5) * 6, WALL_B);
        c.stroke();
      }
    }
    c.fillStyle = '#6a4a2a';
    c.fillRect(0, 206, W, 24);
    c.fillStyle = rgba('#f2e0c0', 0.25);
    c.fillRect(0, 206, W, 3);

    /* the window: cherry blossom view with bamboo at the edges */
    c.fillStyle = '#4a3520';
    rr(c, 138, 24, 1004, 184, 8);
    c.fill();
    c.save();
    rr(c, 150, 36, 980, 160, 5);
    c.clip();
    vgrad(c, 150, 36, 980, 160, [[0, '#f4e8ec'], [0.7, '#f8f0e8'], [1, '#e8e0d4']]);
    c.fillStyle = rgba('#b8c8d8', 0.5);
    c.beginPath();
    c.moveTo(150, 150);
    c.quadraticCurveTo(420, 108, 700, 142);
    c.quadraticCurveTo(940, 160, 1130, 138);
    c.lineTo(1130, 196);
    c.lineTo(150, 196);
    c.closePath();
    c.fill();
    /* a distant torii */
    c.fillStyle = rgba('#b8433a', 0.7);
    c.fillRect(560, 128, 120, 6);
    c.fillRect(566, 120, 108, 5);
    c.fillRect(578, 134, 7, 40);
    c.fillRect(656, 134, 7, 40);
    /* cherry trees in full bloom */
    const blossom = function(bx, by, r) {
      dot(c, bx, by, r, '#f0a8c0');
      dot(c, bx - r * 0.6, by + r * 0.3, r * 0.7, '#f7c8d8');
      dot(c, bx + r * 0.6, by + r * 0.2, r * 0.65, '#e890ac');
      dot(c, bx, by - r * 0.5, r * 0.55, '#fbdce6');
    };
    c.fillStyle = '#5a4630';
    c.fillRect(266, 110, 9, 64);
    c.fillRect(886, 104, 9, 70);
    blossom(270, 92, 34);
    blossom(238, 108, 24);
    blossom(306, 106, 26);
    blossom(890, 86, 36);
    blossom(856, 104, 25);
    blossom(926, 102, 27);
    for (let i = 0; i < 26; ++i) dot(c, 150 + rnd() * 980, 40 + rnd() * 150, 2 + rnd() * 2, rgba('#f7c8d8', 0.7));
    /* bamboo stalks framing the view */
    for (let s = 0; s < 6; ++s) {
      const bx = s < 3 ? 162 + s * 22 : 1064 + (s - 3) * 22;
      c.fillStyle = s % 2 ? '#6a8a4a' : '#7a9a5a';
      c.fillRect(bx, 36, 7, 160);
      c.fillStyle = rgba('#3a4a2a', 0.6);
      for (let ny = 56; ny < 196; ny += 30) c.fillRect(bx, ny, 7, 3);
      c.strokeStyle = '#57944a';
      c.lineWidth = 2;
      for (let lf = 0; lf < 3; ++lf) {
        const ly = 60 + lf * 44;
        c.beginPath();
        c.moveTo(bx + 3, ly);
        c.quadraticCurveTo(bx + (s < 3 ? 22 : -22), ly - 8, bx + (s < 3 ? 34 : -34), ly - 4);
        c.stroke();
      }
    }
    c.restore();
    c.strokeStyle = '#3a2814';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(476, 36);
    c.lineTo(476, 196);
    c.moveTo(804, 36);
    c.lineTo(804, 196);
    c.stroke();

    /* red paper lanterns hanging in front of the window */
    for (let i = 0; i < 3; ++i) {
      const lx = 300 + i * 340, ly = 96;
      c.strokeStyle = '#2a241e';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(lx, 24);
      c.lineTo(lx, ly - 34);
      c.stroke();
      c.fillStyle = '#3a2814';
      c.fillRect(lx - 10, ly - 40, 20, 7);
      c.fillRect(lx - 10, ly + 30, 20, 7);
      c.fillStyle = theme.accent;
      c.beginPath();
      c.ellipse(lx, ly, 26, 34, 0, 0, TWO_PI);
      c.fill();
      c.strokeStyle = rgba('#7a2018', 0.7);
      c.lineWidth = 1.5;
      for (let rb = -2; rb <= 2; ++rb) {
        c.beginPath();
        c.ellipse(lx, ly, 26 - Math.abs(rb) * 6, 34, 0, 0, TWO_PI);
        c.stroke();
      }
      c.fillStyle = rgba('#f8f0e0', 0.9);
      c.fillRect(lx - 5, ly - 14, 10, 6);
      c.fillRect(lx - 5, ly + 6, 10, 6);
      c.fillStyle = rgba('#ffd76a', 0.25);
      c.beginPath();
      c.ellipse(lx, ly, 34, 42, 0, 0, TWO_PI);
      c.fill();
      c.strokeStyle = theme.accent;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(lx, ly + 37);
      c.lineTo(lx, ly + 48);
      c.stroke();
    }

    /* dining floor: dark planks; counter: pale hinoki bar */
    woodPlanks(c, 0, FLOOR_T, W, FLOOR_B - FLOOR_T, theme.wood, rnd, 22);
    vgrad(c, 0, COUNTER_T, W, COUNTER_B - COUNTER_T, [[0, shade(theme.seat, 0.18)], [1, shade(theme.seat, -0.28)]]);
    for (let i = 0; i < 14; ++i) {
      const gy = COUNTER_T + 6 + rnd() * (COUNTER_B - COUNTER_T - 14);
      c.strokeStyle = rgba('#8a6a44', 0.3);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, gy);
      c.bezierCurveTo(420, gy + rnd() * 4 - 2, 860, gy + rnd() * 4 - 2, W, gy);
      c.stroke();
    }
    c.fillStyle = shade(theme.wood, -0.4);
    c.fillRect(0, COUNTER_B - 6, W, 6);
    for (let sx = 240; sx <= 1040; sx += 200) stool(c, sx, 330, 23, theme.seat, shade(theme.wood, -0.3), rnd);

    /* the pass, half hidden behind the indigo noren */
    vgrad(c, 0, PASS_T, W, PASS_B - PASS_T, [[0, shade(theme.wood, 0.35)], [1, shade(theme.wood, -0.15)]]);
    c.fillStyle = shade(theme.wood, -0.5);
    c.fillRect(0, PASS_B - 5, W, 5);
    for (let i = 0; i < 5; ++i) bottle(c, 180 + i * 60, 394, 34, ['#d8e4ea', '#a8c8d8', '#d8e4ea', '#88a8c8', '#d8e4ea'][i]);
    for (let i = 0; i < 4; ++i) {
      c.fillStyle = '#f4f0e4';
      c.beginPath();
      c.arc(900 + i * 52, 388, 12, Math.PI, TWO_PI);
      c.fill();
    }
    c.fillStyle = '#2a4a7a';
    for (let p = 0; p < 2; ++p) {
      const nx = p === 0 ? 420 : 660;
      c.fillStyle = '#2a4a7a';
      c.fillRect(nx, PASS_T - 6, 236, 46);
      c.fillStyle = rgba('#1a3a6a', 0.6);
      for (let f = 0; f < 4; ++f) c.fillRect(nx + 4 + f * 59, PASS_T - 6, 2, 46);
      c.fillStyle = '#f4f0e4';
      c.beginPath();
      c.arc(nx + 58, PASS_T + 16, 13, 0, TWO_PI);
      c.arc(nx + 176, PASS_T + 16, 13, 0, TWO_PI);
      c.fill();
      c.fillStyle = '#2a4a7a';
      c.beginPath();
      c.arc(nx + 58, PASS_T + 16, 8, 0, Math.PI);
      c.arc(nx + 176, PASS_T + 16, 8, 0, Math.PI);
      c.fill();
    }

    /* kitchen: bamboo-slat backsplash, dark slate floor */
    for (let x = 0; x < W; x += 26) {
      c.fillStyle = shade('#9a8a5a', (rnd() - 0.5) * 0.2);
      c.fillRect(x, KITCHEN_T, 22, SPLASH_B - KITCHEN_T);
      c.fillStyle = rgba('#5a5230', 0.5);
      c.fillRect(x + 22, KITCHEN_T, 4, SPLASH_B - KITCHEN_T);
      c.fillStyle = rgba('#5a5230', 0.4);
      for (let ny = KITCHEN_T + 24; ny < SPLASH_B; ny += 40) c.fillRect(x, ny, 22, 3);
    }
    c.fillStyle = '#6a4a2a';
    c.fillRect(0, KITCHEN_T, W, 8);
    vgrad(c, 0, SPLASH_B, W, H - SPLASH_B, [[0, '#5a5f66'], [1, '#3c4148']]);
    for (let ty = SPLASH_B; ty < H; ty += 60) {
      for (let tx = 0; tx < W; tx += 60) {
        c.fillStyle = shade('#4a4f56', (rnd() - 0.5) * 0.16);
        c.fillRect(tx + 2, ty + 2, 56, 56);
      }
    }
    c.fillStyle = rgba('#000000', 0.2);
    c.fillRect(0, SPLASH_B, W, 5);
    c.strokeStyle = '#3a2814';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(60, 428);
    c.lineTo(1220, 428);
    c.stroke();
    for (let i = 0; i < 3; ++i) {
      const kx = 200 + i * 420;
      c.strokeStyle = '#3a2814';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(kx, 430);
      c.lineTo(kx, 452);
      c.stroke();
      c.fillStyle = '#2a241e';
      rr(c, kx - 14, 452, 28, 26, 4);
      c.fill();
      c.fillStyle = rgba('#f4f0e4', 0.5);
      c.fillRect(kx - 10, 456, 6, 18);
    }
  }
  /* ── the grand hotel: marble, gold, arched night windows, chandelier ── */

  function paintHotel(c, rnd, theme) {
    marble(c, 0, 0, W, WALL_B, theme.wall, rnd);
    c.fillStyle = theme.accent;
    c.fillRect(0, 214, W, 8);
    c.fillStyle = rgba('#ffffff', 0.4);
    c.fillRect(0, 214, W, 2);
    for (let i = 0; i < 4; ++i) {
      const px = 40 + i * 400;
      vgrad(c, px, 0, 36, 214, [[0, shade(theme.marble, 0.1)], [1, shade(theme.marble, -0.12)]]);
      c.fillStyle = theme.accent;
      c.fillRect(px - 3, 0, 42, 8);
      c.fillRect(px - 3, 206, 42, 8);
    }

    /* three tall arched windows onto the night city */
    const winX = [150, 510, 870];
    for (let i = 0; i < 3; ++i) {
      const wx = winX[i], ww = 260;
      c.save();
      c.beginPath();
      c.moveTo(wx, 212);
      c.lineTo(wx, 90);
      c.arc(wx + ww / 2, 90, ww / 2, Math.PI, 0);
      c.lineTo(wx + ww, 212);
      c.closePath();
      c.clip();
      vgrad(c, wx, 16, ww, 196, [[0, '#0c1424'], [0.6, '#16233c'], [1, '#243450']]);
      for (let s = 0; s < 60; ++s) dot(c, wx + rnd() * ww, 20 + rnd() * 90, 0.8 + rnd(), rgba('#ffffff', 0.3 + rnd() * 0.5));
      if (i === 1) {
        dot(c, wx + 190, 62, 16, '#f2ecd8');
        dot(c, wx + 184, 58, 14, '#16233c');
        dot(c, wx + 190, 62, 26, rgba('#f2ecd8', 0.18));
      }
      for (let b = 0; b < 5; ++b) {
        const bx = wx + 8 + b * 52 + rnd() * 10;
        const bw = 40 + rnd() * 14, bh = 60 + rnd() * 70;
        c.fillStyle = '#0a101e';
        c.fillRect(bx, 212 - bh, bw, bh);
        for (let wy = 218 - bh; wy < 204; wy += 12) {
          for (let wxp = bx + 5; wxp < bx + bw - 7; wxp += 10) {
            if (rnd() < 0.45) c.fillStyle = rgba('#ffd76a', 0.35 + rnd() * 0.5);
            else continue;
            c.fillRect(wxp, wy, 5, 7);
          }
        }
      }
      c.restore();
      c.strokeStyle = theme.accent;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(wx, 212);
      c.lineTo(wx, 90);
      c.arc(wx + ww / 2, 90, ww / 2, Math.PI, 0);
      c.lineTo(wx + ww, 212);
      c.stroke();
      c.strokeStyle = rgba('#d4af37', 0.5);
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(wx + ww / 2, 212);
      c.lineTo(wx + ww / 2, 30);
      c.moveTo(wx, 140);
      c.lineTo(wx + ww, 140);
      c.stroke();
    }

    /* the chandelier */
    c.strokeStyle = '#8a7a4a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(640, 0);
    c.lineTo(640, 44);
    c.stroke();
    dot(c, 640, 40, 7, theme.accent);
    c.strokeStyle = theme.accent;
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(640, 96, 62, 16, 0, 0, TWO_PI);
    c.stroke();
    c.beginPath();
    c.ellipse(640, 70, 34, 9, 0, 0, TWO_PI);
    c.stroke();
    for (let i = 0; i < 8; ++i) {
      const a = i / 8 * TWO_PI;
      const ax = 640 + Math.cos(a) * 62, ay = 96 + Math.sin(a) * 16;
      c.strokeStyle = theme.accent;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(640 + Math.cos(a) * 34, 70 + Math.sin(a) * 9);
      c.lineTo(ax, ay);
      c.stroke();
      c.fillStyle = '#f4f0e4';
      c.fillRect(ax - 2.5, ay - 12, 5, 10);
      dot(c, ax, ay - 15, 3.4, '#ffe9b0');
      dot(c, ax, ay - 15, 7, rgba('#ffd76a', 0.3));
      c.fillStyle = rgba('#cfe4f2', 0.7);
      c.beginPath();
      c.moveTo(ax, ay + 4);
      c.lineTo(ax - 3, ay + 12);
      c.lineTo(ax, ay + 20);
      c.lineTo(ax + 3, ay + 12);
      c.closePath();
      c.fill();
    }
    /* wall sconces between the windows */
    for (let i = 0; i < 3; ++i) {
      const sx = 445 + i * 360;
      c.fillStyle = theme.accent;
      c.beginPath();
      c.moveTo(sx - 8, 120);
      c.lineTo(sx + 8, 120);
      c.lineTo(sx + 5, 104);
      c.lineTo(sx - 5, 104);
      c.closePath();
      c.fill();
      dot(c, sx, 98, 6, '#ffe9b0');
      dot(c, sx, 98, 14, rgba('#ffd76a', 0.28));
    }

    /* dining floor: grand marble with gold inlays; potted palms at the edges */
    marble(c, 0, FLOOR_T, W, FLOOR_B - FLOOR_T, theme.marble, rnd);
    c.strokeStyle = rgba('#d4af37', 0.5);
    c.lineWidth = 2;
    for (let x = 0; x <= W; x += 160) {
      c.beginPath();
      c.moveTo(x, FLOOR_T);
      c.lineTo(x, FLOOR_B);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0, 280);
    c.lineTo(W, 280);
    c.stroke();
    for (let x = 80; x < W; x += 160) {
      c.fillStyle = rgba('#d4af37', 0.3);
      c.beginPath();
      c.moveTo(x, 258);
      c.lineTo(x + 18, 280);
      c.lineTo(x, 302);
      c.lineTo(x - 18, 280);
      c.closePath();
      c.fill();
    }
    palm(c, 70, 322, 1, rnd);
    palm(c, 1210, 322, 1, rnd);

    /* marble counter with a gold band and cream stools */
    marble(c, 0, COUNTER_T, W, COUNTER_B - COUNTER_T, '#f2ece0', rnd);
    c.fillStyle = theme.accent;
    c.fillRect(0, COUNTER_T - 4, W, 5);
    c.fillRect(0, COUNTER_B - 10, W, 6);
    c.fillStyle = rgba('#d4af37', 0.5);
    c.fillRect(0, COUNTER_T + 22, W, 3);
    for (let sx = 250; sx <= 1030; sx += 195) stool(c, sx, 330, 24, theme.seat, theme.accent, rnd);

    /* the pass: brass shelf with cloches and stacked plates */
    vgrad(c, 0, PASS_T, W, PASS_B - PASS_T, [[0, '#c8a85a'], [1, '#96793a']]);
    c.fillStyle = '#6a5426';
    c.fillRect(0, PASS_B - 5, W, 5);
    for (let i = 0; i < 3; ++i) {
      const dx = 260 + i * 360;
      c.fillStyle = '#d8dce0';
      c.beginPath();
      c.arc(dx, 386, 24, Math.PI, TWO_PI);
      c.fill();
      c.fillStyle = theme.accent;
      c.beginPath();
      c.arc(dx, 360, 4, 0, TWO_PI);
      c.fill();
      c.fillStyle = rgba('#ffffff', 0.5);
      c.beginPath();
      c.arc(dx - 8, 378, 8, Math.PI * 1.1, Math.PI * 1.6);
      c.fill();
    }
    for (let i = 0; i < 3; ++i) {
      c.fillStyle = '#f4f0e4';
      c.beginPath();
      c.ellipse(1000, 388 - i * 6, 30, 6, 0, 0, TWO_PI);
      c.fill();
    }

    /* kitchen: marble backsplash with gold trim, grey hex-ish floor */
    marble(c, 0, KITCHEN_T, W, SPLASH_B - KITCHEN_T, '#e8e2d6', rnd);
    c.fillStyle = theme.accent;
    c.fillRect(0, KITCHEN_T + 4, W, 4);
    c.fillRect(0, SPLASH_B - 8, W, 5);
    vgrad(c, 0, SPLASH_B, W, H - SPLASH_B, [[0, '#8a8f96'], [1, '#5c6168']]);
    for (let ty = SPLASH_B; ty < H; ty += 58) {
      for (let tx = 0; tx < W; tx += 58) {
        c.fillStyle = shade('#7a7f86', (rnd() - 0.5) * 0.14);
        c.beginPath();
        c.moveTo(tx + 29, ty + 2);
        c.lineTo(tx + 56, ty + 16);
        c.lineTo(tx + 56, ty + 44);
        c.lineTo(tx + 29, ty + 56);
        c.lineTo(tx + 2, ty + 44);
        c.lineTo(tx + 2, ty + 16);
        c.closePath();
        c.fill();
      }
    }
    c.fillStyle = rgba('#000000', 0.18);
    c.fillRect(0, SPLASH_B, W, 5);
    for (let side = 0; side < 2; ++side) {
      const cx0 = side === 0 ? 0 : 1104;
      marble(c, cx0, SPLASH_B, 176, 150, '#dcd6ca', rnd);
      c.strokeStyle = theme.accent;
      c.lineWidth = 3;
      c.strokeRect(cx0 + 10, SPLASH_B + 12, 156, 126);
      c.fillStyle = theme.accent;
      c.fillRect(cx0 + (side === 0 ? 146 : 16), SPLASH_B + 62, 14, 4);
    }
  }

  /* ── ambient layers: cached sprites and dots only ── */

  /* steam wisps rising off the kitchen line, shared by every theme */
  function buildSteam(rnd) {
    const sprite = makeCanvas(72, 110);
    const sc = sprite.getContext('2d');
    const g = sc.createRadialGradient(36, 74, 4, 36, 62, 52);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sc.fillStyle = g;
    sc.beginPath();
    sc.arc(36, 62, 52, 0, TWO_PI);
    sc.fill();
    sc.fillStyle = 'rgba(255,255,255,0.25)';
    sc.beginPath();
    sc.arc(28, 40, 14, 0, TWO_PI);
    sc.fill();
    sc.beginPath();
    sc.arc(46, 26, 9, 0, TWO_PI);
    sc.fill();
    const wisps = [];
    for (let i = 0; i < 5; ++i) {
      wisps.push({
        x: 280 + i * 180 + rnd() * 60,
        speed: 0.14 + rnd() * 0.10,
        phase: rnd(),
        sway: 6 + rnd() * 8
      });
    }
    return {
      draw: function(c, t) {
        for (let i = 0; i < wisps.length; ++i) {
          const wp = wisps[i];
          const p = (t * wp.speed + wp.phase) % 1;
          const y = 600 - p * 170;
          c.globalAlpha = Math.sin(p * Math.PI) * 0.16;
          c.drawImage(sprite, wp.x + Math.sin(t * 0.9 + wp.phase * 6) * wp.sway - 36, y - 92);
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* truck: cars and pedestrians drifting past the serving window */
  function buildTruckAmbient(rnd) {
    function carSprite(color) {
      const cv = makeCanvas(124, 48);
      const cc = cv.getContext('2d');
      cc.fillStyle = color;
      rr(cc, 4, 20, 116, 20, 8);
      cc.fill();
      rr(cc, 28, 6, 62, 18, 7);
      cc.fill();
      cc.fillStyle = rgba('#cfe4f2', 0.5);
      cc.fillRect(34, 9, 22, 12);
      cc.fillRect(62, 9, 22, 12);
      dot(cc, 28, 40, 7, '#1c2126');
      dot(cc, 96, 40, 7, '#1c2126');
      return cv;
    }
    function personSprite(color) {
      const cv = makeCanvas(24, 46);
      const cc = cv.getContext('2d');
      cc.fillStyle = color;
      dot(cc, 12, 8, 6, color);
      rr(cc, 6, 15, 12, 20, 4);
      cc.fill();
      cc.fillRect(7, 34, 4, 11);
      cc.fillRect(13, 34, 4, 11);
      return cv;
    }
    const cars = [
      { img: carSprite('rgba(40,52,66,0.55)'), x0: 200, dir: 1, speed: 26 },
      { img: carSprite('rgba(52,40,44,0.5)'), x0: 900, dir: -1, speed: 20 }
    ];
    const people = [
      { img: personSprite('rgba(36,44,54,0.5)'), x0: 400, dir: 1, speed: 13 },
      { img: personSprite('rgba(54,38,42,0.45)'), x0: 1000, dir: -1, speed: 10 }
    ];
    return {
      draw: function(c, t) {
        c.save();
        c.beginPath();
        c.rect(TRUCK_WIN.x0, TRUCK_WIN.y0, TRUCK_WIN.x1 - TRUCK_WIN.x0, TRUCK_WIN.y1 - TRUCK_WIN.y0);
        c.clip();
        for (let i = 0; i < cars.length; ++i) {
          const cr = cars[i];
          const span = TRUCK_WIN.x1 - TRUCK_WIN.x0 + 130;
          let x = cr.x0 + cr.dir * cr.speed * t;
          x = ((x - TRUCK_WIN.x0 + 130) % span + span) % span + TRUCK_WIN.x0 - 130;
          c.drawImage(cr.img, x, 148);
        }
        for (let i = 0; i < people.length; ++i) {
          const pp = people[i];
          const span = TRUCK_WIN.x1 - TRUCK_WIN.x0 + 30;
          let x = pp.x0 + pp.dir * pp.speed * t;
          x = ((x - TRUCK_WIN.x0 + 30) % span + span) % span + TRUCK_WIN.x0 - 30;
          const bob = Math.sin(t * 6 + i * 2) * 1.5;
          c.drawImage(pp.img, x, 126 + bob);
        }
        c.restore();
      }
    };
  }

  /* diner: the neon tube alternates between two cached states */
  function buildDinerAmbient(rnd) {
    function signSprite(bright) {
      const cv = makeCanvas(240, 76);
      const cc = cv.getContext('2d');
      cc.font = 'bold 52px sans-serif';
      cc.textAlign = 'center';
      cc.textBaseline = 'middle';
      const tube = bright ? '#ff5a7a' : '#7a3a48';
      const core = bright ? '#ffe2ea' : '#9a5a66';
      if (bright) {
        cc.strokeStyle = rgba('#ff5a7a', 0.25);
        cc.lineWidth = 16;
        cc.strokeText('DINER', 120, 40);
        cc.strokeStyle = rgba('#ff5a7a', 0.5);
        cc.lineWidth = 9;
        cc.strokeText('DINER', 120, 40);
      }
      cc.strokeStyle = tube;
      cc.lineWidth = 4;
      cc.strokeText('DINER', 120, 40);
      cc.fillStyle = core;
      cc.fillText('DINER', 120, 40);
      if (bright) {
        cc.fillStyle = rgba('#ffd76a', 0.8);
        for (let i = 0; i < 5; ++i) dot(cc, 14 + i * 54, 66, 2.4, '#ffd76a');
      }
      return cv;
    }
    const bright = signSprite(true);
    const dim = signSprite(false);
    return {
      draw: function(c, t) {
        const step = Math.floor(t * 2.2);
        const flick = Math.floor(t * 13) % 11 === 4;
        const on = (step % 7 !== 3) && !flick;
        c.drawImage(on ? bright : dim, 520, 34);
      }
    };
  }

  /* bistro: the pendant glow breathes at three different phases */
  function buildBistroAmbient(rnd) {
    const glow = makeCanvas(120, 120);
    const gc = glow.getContext('2d');
    const g = gc.createRadialGradient(60, 60, 4, 60, 60, 58);
    g.addColorStop(0, 'rgba(255,214,120,0.5)');
    g.addColorStop(0.5, 'rgba(255,190,90,0.22)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    gc.fillStyle = g;
    gc.beginPath();
    gc.arc(60, 60, 58, 0, TWO_PI);
    gc.fill();
    const lamps = [[320, 96, 0], [640, 88, 2.1], [960, 96, 4.2]];
    return {
      draw: function(c, t) {
        for (let i = 0; i < lamps.length; ++i) {
          const lp = lamps[i];
          const a = 0.30 + 0.10 * Math.sin(t * 2.6 + lp[2]) + 0.04 * Math.sin(t * 7.1 + lp[2] * 3);
          c.globalAlpha = Math.max(0.12, a);
          c.drawImage(glow, lp[0] - 60, lp[1] - 60);
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* sushi: sakura petals drift across the dining half of the room */
  function buildSushiAmbient(rnd) {
    const petals = [];
    for (let i = 0; i < 16; ++i) {
      petals.push({
        x: rnd() * (W + 40) - 20,
        y: rnd() * 360,
        vx: 12 + rnd() * 16,
        vy: 9 + rnd() * 10,
        tilt: rnd() * Math.PI,
        color: i % 3
      });
    }
    const COLORS = ['#f7c8d8', '#f0a8c0', '#fbdce6'];
    return {
      draw: function(c, t) {
        for (let col = 0; col < COLORS.length; ++col) {
          c.fillStyle = rgba(COLORS[col], 0.8);
          for (let i = 0; i < petals.length; ++i) {
            const p = petals[i];
            if (p.color !== col) continue;
            const x = ((p.x + p.vx * t + 20) % (W + 40)) - 20;
            const y = ((p.y + p.vy * t + 20) % 380) - 20;
            c.beginPath();
            c.ellipse(x, y, 2.8, 1.9, p.tilt + Math.sin(t + i) * 0.4, 0, TWO_PI);
            c.fill();
          }
        }
      }
    };
  }

  /* hotel: glints twinkle on the chandelier crystals */
  function buildHotelAmbient(rnd) {
    const glint = makeCanvas(26, 26);
    const gc = glint.getContext('2d');
    gc.fillStyle = 'rgba(255,250,230,0.9)';
    gc.beginPath();
    gc.moveTo(13, 1);
    gc.lineTo(15.5, 10.5);
    gc.lineTo(25, 13);
    gc.lineTo(15.5, 15.5);
    gc.lineTo(13, 25);
    gc.lineTo(10.5, 15.5);
    gc.lineTo(1, 13);
    gc.lineTo(10.5, 10.5);
    gc.closePath();
    gc.fill();
    gc.fillStyle = 'rgba(255,255,255,0.6)';
    gc.beginPath();
    gc.arc(13, 13, 3, 0, TWO_PI);
    gc.fill();
    const spots = [];
    for (let i = 0; i < 8; ++i) {
      const a = i / 8 * TWO_PI;
      spots.push({ x: 640 + Math.cos(a) * 62, y: 112 + Math.sin(a) * 16, ph: rnd() * 6 });
    }
    spots.push({ x: 640, y: 78, ph: 2.4 });
    return {
      draw: function(c, t) {
        for (let i = 0; i < spots.length; ++i) {
          const sp = spots[i];
          const tw = Math.max(0, Math.sin(t * 1.3 + sp.ph));
          c.globalAlpha = 0.10 + Math.pow(tw, 6) * 0.85;
          c.drawImage(glint, sp.x - 13, sp.y - 13);
        }
        c.globalAlpha = 1;
      }
    };
  }

  /* ── build one interior ── */

  function create(themeName) {
    const name = THEMES[themeName] ? themeName : 'truck';
    const theme = THEMES[name];
    const rnd = mulberry32(THEME_NAMES.indexOf(name) * 7919 + 17);

    /* the opaque room: wall, window, floor, counter, pass, kitchen */
    const bg = makeCanvas(W, H);
    const bc = bg.getContext('2d');
    if (name === 'truck') paintTruck(bc, rnd, theme);
    else if (name === 'diner') paintDiner(bc, rnd, theme);
    else if (name === 'bistro') paintBistro(bc, rnd, theme);
    else if (name === 'sushi') paintSushi(bc, rnd, theme);
    else paintHotel(bc, rnd, theme);

    const steam = buildSteam(rnd);
    let ambient;
    if (name === 'truck') ambient = buildTruckAmbient(rnd);
    else if (name === 'diner') ambient = buildDinerAmbient(rnd);
    else if (name === 'bistro') ambient = buildBistroAmbient(rnd);
    else if (name === 'sushi') ambient = buildSushiAmbient(rnd);
    else ambient = buildHotelAmbient(rnd);

    function resolveView(view) {
      if (!view) return FULL_VIEW;
      const x0 = Number(view.x0), y0 = Number(view.y0), x1 = Number(view.x1), y1 = Number(view.y1);
      if (!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return FULL_VIEW;
      return { x0: x0, y0: y0, x1: x1, y1: y1 };
    }

    /* the cached room already fills the play view; a view reaching past it gets
       the whole room scaled up to cover it, centred, so no edge pixel is
       smeared into a long streak */
    function drawRoomInto(c, v) {
      if (v.x0 === 0 && v.y0 === 0 && v.x1 === W && v.y1 === H) {
        c.drawImage(bg, 0, 0);
        return;
      }
      const vw = v.x1 - v.x0, vh = v.y1 - v.y0;
      const s = Math.max(vw / W, vh / H);
      const dw = W * s, dh = H * s;
      c.drawImage(bg, v.x0 + (vw - dw) / 2, v.y0 + (vh - dh) / 2, dw, dh);
    }

    /* view is optional: without it only the 1280x720 play view is covered */
    function draw(c, t, view) {
      c.globalAlpha = 1;
      const v = resolveView(view);
      drawRoomInto(c, v);
      ambient.draw(c, t);
      steam.draw(c, t);
      c.globalAlpha = 1;
    }

    return Object.freeze({
      theme: theme,
      draw: draw
    });
  }

  SZ.KitchenScene = Object.freeze({ THEMES, create });
})();
