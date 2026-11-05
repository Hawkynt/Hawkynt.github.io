;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * The six bosses, their projectiles and their telegraphed attacks. Every boss is painted
   * once per wing frame into a cached canvas (260 x 200 local units at 1.5x, facing left
   * toward the bird, centred on its body), every projectile into a small sprite; a frame
   * of a boss fight is a handful of drawImage calls plus a few strokes for beams and bolts.
   * No shadow blur anywhere - glows are baked radial gradients.
   */

  const RS = 1.5;
  const BW = 260, BH = 200;
  const TWO_PI = Math.PI * 2;
  const bossCache = {};
  const shotCache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; ++i)
      g.addColorStop(i / (stops.length - 1), stops[i]);
    return g;
  }

  function rad(c, x, y, r0, r1, stops) {
    const g = c.createRadialGradient(x, y, r0, x, y, r1);
    for (let i = 0; i < stops.length; ++i)
      g.addColorStop(i / (stops.length - 1), stops[i]);
    return g;
  }

  function ell(c, x, y, rx, ry, rot) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, rot || 0, 0, TWO_PI);
  }

  function stroke(c, color, w) {
    c.lineWidth = w || 3;
    c.strokeStyle = color;
    c.stroke();
  }

  function glow(c, x, y, r, color) {
    c.fillStyle = rad(c, x, y, 0, r, [color, 'rgba(0,0,0,0)']);
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* a big eye looking left: white, iris, pupil, glint */
  function eye(c, x, y, r, iris) {
    ell(c, x, y, r, r);
    c.fillStyle = '#ffffff';
    c.fill();
    stroke(c, '#1a1a1a', 2);
    ell(c, x - r * 0.25, y, r * 0.6, r * 0.6);
    c.fillStyle = iris;
    c.fill();
    ell(c, x - r * 0.35, y, r * 0.3, r * 0.3);
    c.fillStyle = '#0a0a0a';
    c.fill();
    ell(c, x - r * 0.1, y - r * 0.35, r * 0.18, r * 0.18);
    c.fillStyle = '#ffffff';
    c.fill();
  }

  /* a feathered wing from the shoulder, opened by angle */
  function featherWing(c, x, y, angle, len, colors, outline) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    for (let i = 0; i < 6; ++i) {
      c.save();
      c.rotate(-0.15 + i * 0.13);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(len * 0.5, -12, len - i * 7, 0);
      c.quadraticCurveTo(len * 0.5, 10, 0, 0);
      c.fillStyle = i % 2 ? colors[0] : colors[1];
      c.fill();
      stroke(c, outline, 1.6);
      c.restore();
    }
    c.restore();
  }

  const PAINT = {
    bee: function(c, f) {
      const flap = f ? -0.5 : 0.25;
      // wings behind
      for (let i = 0; i < 2; ++i) {
        c.save();
        c.translate(10 + i * 18, -30);
        c.rotate(-1.9 + flap + i * 0.3);
        ell(c, 0, -46, 26, 50);
        c.fillStyle = 'rgba(220,245,255,0.55)';
        c.fill();
        stroke(c, 'rgba(120,170,200,0.9)', 2);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -90);
        stroke(c, 'rgba(120,170,200,0.6)', 1.5);
        c.restore();
      }
      // abdomen with stripes and stinger
      c.save();
      ell(c, 50, 14, 62, 48, 0.25);
      c.fillStyle = lin(c, 0, -30, 0, 60, ['#ffe46a', '#f0a810']);
      c.fill();
      c.clip();
      c.fillStyle = '#2a1a0a';
      for (let i = 0; i < 4; ++i) {
        c.save();
        c.translate(20 + i * 26, 14);
        c.rotate(0.25);
        c.fillRect(-7, -60, 13, 120);
        c.restore();
      }
      c.restore();
      ell(c, 50, 14, 62, 48, 0.25);
      stroke(c, '#3a2206', 3);
      c.beginPath();
      c.moveTo(108, 34);
      c.lineTo(132, 46);
      c.lineTo(104, 46);
      c.closePath();
      c.fillStyle = '#3a2a1a';
      c.fill();
      // thorax and head
      ell(c, -18, -2, 30, 28);
      c.fillStyle = rad(c, -24, -12, 4, 34, ['#7a5a2a', '#3a2610']);
      c.fill();
      stroke(c, '#1a1006', 3);
      ell(c, -56, -10, 30, 28);
      c.fillStyle = rad(c, -62, -20, 4, 34, ['#ffe46a', '#e09a10']);
      c.fill();
      stroke(c, '#3a2206', 3);
      eye(c, -68, -16, 11, '#5a2a0a');
      // antennae and crown
      c.beginPath();
      c.moveTo(-60, -36);
      c.quadraticCurveTo(-80, -70, -96, -64);
      c.moveTo(-48, -36);
      c.quadraticCurveTo(-52, -72, -36, -78);
      stroke(c, '#2a1a0a', 3);
      ell(c, -96, -64, 5, 5);
      c.fillStyle = '#2a1a0a';
      c.fill();
      c.beginPath();
      c.moveTo(-70, -34);
      c.lineTo(-72, -52);
      c.lineTo(-62, -42);
      c.lineTo(-56, -56);
      c.lineTo(-50, -42);
      c.lineTo(-40, -50);
      c.lineTo(-44, -32);
      c.closePath();
      c.fillStyle = lin(c, 0, -56, 0, -32, ['#fff3a0', '#e0a010']);
      c.fill();
      stroke(c, '#7a5206', 2);
      // smile and legs
      c.beginPath();
      c.arc(-74, 0, 8, 0.2, 1.6);
      stroke(c, '#3a2206', 2.5);
      c.beginPath();
      for (let i = 0; i < 3; ++i) {
        c.moveTo(-30 + i * 14, 22);
        c.lineTo(-38 + i * 14, 44);
        c.lineTo(-46 + i * 14, 46);
      }
      stroke(c, '#2a1a0a', 3);
    },
    wyrm: function(c, f) {
      // segmented sand serpent curling behind its head
      const wig = f ? 6 : -6;
      for (let i = 7; i >= 1; --i) {
        const x = -10 + i * 17, y = 10 + Math.sin(i * 0.9) * 22 + (i % 2 ? wig : -wig);
        const r = 30 - i * 2.4;
        ell(c, x, y, r, r);
        c.fillStyle = rad(c, x - r * 0.3, y - r * 0.4, 2, r * 1.1, ['#f6d49a', '#c88a40', '#8a5a22']);
        c.fill();
        stroke(c, '#5a3410', 2.5);
        c.beginPath();
        c.moveTo(x - r * 0.3, y - r * 0.9);
        c.lineTo(x, y - r * 1.25);
        c.lineTo(x + r * 0.3, y - r * 0.9);
        c.fillStyle = '#e8a050';
        c.fill();
        stroke(c, '#5a3410', 1.5);
      }
      // head with an open round maw
      ell(c, -42, -4, 46, 40);
      c.fillStyle = rad(c, -50, -20, 6, 50, ['#f8dca8', '#d09450', '#8a5a22']);
      c.fill();
      stroke(c, '#5a3410', 3);
      ell(c, -70, 8, 24, f ? 22 : 18);
      c.fillStyle = '#3a1206';
      c.fill();
      stroke(c, '#5a3410', 2.5);
      c.fillStyle = '#fff6e0';
      for (let i = 0; i < 8; ++i) {
        const a = i / 8 * TWO_PI;
        const tx = -70 + Math.cos(a) * 20, ty = 8 + Math.sin(a) * (f ? 18 : 14);
        c.beginPath();
        c.moveTo(tx, ty);
        c.lineTo(tx - Math.cos(a) * 9 + Math.sin(a) * 3, ty - Math.sin(a) * 9 - Math.cos(a) * 3);
        c.lineTo(tx - Math.cos(a) * 9 - Math.sin(a) * 3, ty - Math.sin(a) * 9 + Math.cos(a) * 3);
        c.closePath();
        c.fill();
      }
      eye(c, -36, -26, 10, '#c8301a');
      c.beginPath();
      c.moveTo(-50, -40);
      c.lineTo(-24, -32);
      stroke(c, '#5a3410', 4);
    },
    owl: function(c, f) {
      const flap = f ? -0.4 : 0.2;
      featherWing(c, 20, -10, -2.4 + flap, 100, ['#bfe6f7', '#8ac8e8'], '#2a5a7a');
      ell(c, 10, 10, 62, 72);
      c.fillStyle = rad(c, -10, -20, 8, 80, ['#ffffff', '#cfeaff', '#7ab4d8']);
      c.fill();
      stroke(c, '#2a5a7a', 3);
      // chest scallops
      c.strokeStyle = 'rgba(60,110,150,0.5)';
      c.lineWidth = 2;
      for (let r = 0; r < 3; ++r)
        for (let k = 0; k < 4; ++k) {
          c.beginPath();
          c.arc(-20 + k * 16 + (r % 2) * 8, 20 + r * 16, 6, 0.2, Math.PI - 0.2);
          c.stroke();
        }
      // face disc and eyes
      ell(c, -18, -30, 42, 32);
      c.fillStyle = '#eef8ff';
      c.fill();
      stroke(c, '#5a8ab0', 2);
      for (let s = 0; s < 2; ++s) {
        const x = -38 + s * 34, y = -32;
        ell(c, x, y, 15, 15);
        c.fillStyle = rad(c, x, y, 3, 15, ['#ffffff', '#7ad8ff', '#1a7ac8']);
        c.fill();
        stroke(c, '#0a3a6a', 2);
        ell(c, x - 3, y, 6, 6);
        c.fillStyle = '#0a1a2a';
        c.fill();
        ell(c, x - 6, y - 5, 2.5, 2.5);
        c.fillStyle = '#ffffff';
        c.fill();
      }
      c.beginPath();
      c.moveTo(-28, -20);
      c.lineTo(-34, -6);
      c.lineTo(-22, -16);
      c.closePath();
      c.fillStyle = '#ffb03a';
      c.fill();
      stroke(c, '#7a4a0a', 1.5);
      // ice crown
      c.fillStyle = 'rgba(200,240,255,0.95)';
      for (let i = 0; i < 5; ++i) {
        const x = -54 + i * 18, h = 26 + (i === 2 ? 18 : (i % 2) * 8);
        c.beginPath();
        c.moveTo(x - 7, -56);
        c.lineTo(x, -56 - h);
        c.lineTo(x + 7, -56);
        c.closePath();
        c.fill();
        stroke(c, '#3a8ac0', 1.5);
      }
      featherWing(c, 50, 0, -0.7 - flap, 70, ['#d8f0ff', '#9fd0f0'], '#2a5a7a');
    },
    moth: function(c, f) {
      const open = f ? 1 : 0.8;
      for (let s = -1; s <= 1; s += 2) {
        c.save();
        c.scale(1, open);
        // forewing
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(-30, s * -10, -100, s * 60, -40, s * 92);
        c.bezierCurveTo(10, s * 100, 40, s * 50, 0, 0);
        c.fillStyle = lin(c, 0, 0, 0, s * 90, ['#6a3aa8', '#2a1a4a']);
        c.fill();
        stroke(c, '#140a24', 3);
        // hindwing
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(40, s * 10, 110, s * 50, 80, s * 84);
        c.bezierCurveTo(50, s * 100, 10, s * 60, 0, 0);
        c.fillStyle = lin(c, 0, 0, 0, s * 90, ['#9a5ad8', '#3a1a6a']);
        c.fill();
        stroke(c, '#140a24', 3);
        // eye spots
        ell(c, -36, s * 56, 16, 14);
        c.fillStyle = rad(c, -36, s * 56, 2, 16, ['#ffffff', '#ffd84a', '#ff7a2a', '#2a1a4a']);
        c.fill();
        ell(c, 60, s * 58, 10, 9);
        c.fillStyle = rad(c, 60, s * 58, 1, 10, ['#e8d0ff', '#b07aff', '#2a1a4a']);
        c.fill();
        c.restore();
      }
      // fuzzy body
      ell(c, 6, 4, 18, 46, -0.1);
      c.fillStyle = rad(c, 0, -10, 2, 46, ['#e0d0f0', '#8a7aa8', '#4a3a68']);
      c.fill();
      stroke(c, '#1a1028', 2.5);
      ell(c, -10, -38, 18, 16);
      c.fillStyle = '#c8b8e0';
      c.fill();
      stroke(c, '#1a1028', 2.5);
      eye(c, -18, -40, 7, '#3a0a5a');
      c.beginPath();
      c.moveTo(-16, -52);
      c.quadraticCurveTo(-40, -90, -64, -84);
      c.moveTo(-6, -52);
      c.quadraticCurveTo(-10, -96, 10, -96);
      stroke(c, '#1a1028', 3);
    },
    crowbot: function(c, f) {
      // thruster flame
      c.beginPath();
      c.moveTo(70, 20);
      c.lineTo(f ? 130 : 116, 26);
      c.lineTo(70, 36);
      c.closePath();
      c.fillStyle = lin(c, 70, 0, 130, 0, ['#ffffff', '#3af2ff', 'rgba(58,242,255,0)']);
      c.fill();
      // metal wing behind
      c.save();
      c.translate(20, -16);
      c.rotate(f ? -2.3 : -2.0);
      for (let i = 0; i < 4; ++i) {
        c.fillStyle = i % 2 ? '#5a6278' : '#7a849c';
        c.fillRect(i * 6, -8 + i * 2, 90 - i * 14, 14);
        c.strokeStyle = '#1a1e2a';
        c.lineWidth = 2;
        c.strokeRect(i * 6, -8 + i * 2, 90 - i * 14, 14);
      }
      c.restore();
      // body plates
      c.beginPath();
      c.moveTo(-60, -30);
      c.lineTo(40, -40);
      c.lineTo(76, 10);
      c.lineTo(50, 50);
      c.lineTo(-40, 46);
      c.lineTo(-70, 10);
      c.closePath();
      c.fillStyle = lin(c, 0, -40, 0, 50, ['#a8b0c8', '#4a5068', '#2a2e3e']);
      c.fill();
      stroke(c, '#10121a', 3);
      c.beginPath();
      c.moveTo(-40, 0);
      c.lineTo(50, -6);
      c.moveTo(-30, 24);
      c.lineTo(52, 22);
      stroke(c, 'rgba(20,24,34,0.6)', 2);
      c.fillStyle = '#ffd84a';
      for (let i = 0; i < 4; ++i) {
        ell(c, -26 + i * 22, -14, 2.5, 2.5);
        c.fill();
      }
      // head, visor and beak cannon
      c.beginPath();
      c.moveTo(-70, -54);
      c.lineTo(-20, -60);
      c.lineTo(-10, -20);
      c.lineTo(-74, -16);
      c.closePath();
      c.fillStyle = lin(c, 0, -60, 0, -16, ['#c8d0e0', '#5a6278']);
      c.fill();
      stroke(c, '#10121a', 3);
      c.fillStyle = '#1a0a10';
      c.fillRect(-66, -46, 46, 14);
      c.fillStyle = lin(c, -66, 0, -20, 0, ['#ff2a4a', '#ff8a9a', '#ff2a4a']);
      c.fillRect(-62, -43, 38, 8);
      c.beginPath();
      c.moveTo(-74, -30);
      c.lineTo(-118, -24);
      c.lineTo(-74, -16);
      c.closePath();
      c.fillStyle = '#3a3e4e';
      c.fill();
      stroke(c, '#10121a', 2.5);
      c.fillStyle = '#ff2a4a';
      c.fillRect(-122, -27, 8, 6);
      // antenna
      c.beginPath();
      c.moveTo(-40, -60);
      c.lineTo(-44, -82);
      stroke(c, '#10121a', 3);
      ell(c, -44, -84, 5, 5);
      c.fillStyle = '#ff2a4a';
      c.fill();
    },
    corvus: function(c, f) {
      // storm aura
      glow(c, 0, 0, 120, 'rgba(150,80,255,0.35)');
      const flap = f ? -0.55 : 0.3;
      featherWing(c, 10, -16, -2.5 + flap, 130, ['#3a3450', '#24203a'], '#0c0a18');
      // body
      ell(c, 10, 6, 70, 50, 0.1);
      c.fillStyle = rad(c, -10, -16, 6, 80, ['#5a5478', '#2a2440', '#14101e']);
      c.fill();
      stroke(c, '#0c0a18', 3);
      // tail
      for (let i = 0; i < 4; ++i) {
        c.save();
        c.translate(70, 16);
        c.rotate(-0.2 + i * 0.16);
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(30, -8, 58, 0);
        c.quadraticCurveTo(30, 8, 0, 0);
        c.fillStyle = i % 2 ? '#2a2440' : '#3a3450';
        c.fill();
        stroke(c, '#0c0a18', 2);
        c.restore();
      }
      // head
      ell(c, -54, -26, 36, 32);
      c.fillStyle = rad(c, -60, -40, 4, 40, ['#5a5478', '#2a2440']);
      c.fill();
      stroke(c, '#0c0a18', 3);
      // lightning crest
      c.beginPath();
      c.moveTo(-40, -54);
      c.lineTo(-28, -88);
      c.lineTo(-34, -70);
      c.lineTo(-16, -96);
      c.lineTo(-22, -66);
      c.lineTo(-10, -72);
      c.lineTo(-24, -48);
      c.closePath();
      c.fillStyle = lin(c, 0, -96, 0, -48, ['#ffffff', '#c08aff', '#7a3ae0']);
      c.fill();
      stroke(c, '#2a0a5a', 2);
      // glowing eye with a hard brow
      glow(c, -66, -32, 20, 'rgba(255,60,80,0.6)');
      ell(c, -66, -32, 8, 8);
      c.fillStyle = '#ff3a4a';
      c.fill();
      ell(c, -68, -34, 3, 3);
      c.fillStyle = '#ffffff';
      c.fill();
      c.beginPath();
      c.moveTo(-82, -46);
      c.lineTo(-50, -38);
      stroke(c, '#0c0a18', 5);
      // hooked beak
      c.beginPath();
      c.moveTo(-82, -30);
      c.quadraticCurveTo(-118, -30, -128, -10);
      c.quadraticCurveTo(-110, -16, -82, -12);
      c.closePath();
      c.fillStyle = lin(c, 0, -30, 0, -10, ['#6a6a7a', '#2a2a36']);
      c.fill();
      stroke(c, '#0c0a18', 2.5);
      featherWing(c, 40, -4, -0.6 - flap, 90, ['#4a4466', '#2a2440'], '#0c0a18');
    }
  };

  function getBoss(kind, frame) {
    const key = kind + (frame ? 1 : 0);
    if (bossCache[key])
      return bossCache[key];
    const cv = makeCanvas(BW * RS, BH * RS);
    const c = cv.getContext('2d');
    c.scale(RS, RS);
    c.translate(BW / 2, BH / 2);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    (PAINT[kind] || PAINT.bee)(c, frame ? 1 : 0);
    bossCache[key] = cv;
    return cv;
  }

  /* opts: kind, x, y, scale, t (s), flash (0..1), alpha, rot */
  function drawBoss(ctx, opts) {
    const frame = Math.floor((opts.t || 0) * (opts.kind === 'bee' || opts.kind === 'moth' ? 14 : 6)) % 2;
    const img = getBoss(opts.kind, frame);
    const s = opts.scale === undefined ? 1 : opts.scale;
    ctx.save();
    ctx.translate(opts.x, opts.y);
    if (opts.rot)
      ctx.rotate(opts.rot);
    if (opts.flip)
      ctx.scale(-1, 1);
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    ctx.drawImage(img, -BW / 2 * s, -BH / 2 * s, BW * s, BH * s);
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha *= Math.min(1, opts.flash * 3) * 0.7;
      ctx.drawImage(img, -BW / 2 * s, -BH / 2 * s, BW * s, BH * s);
    }
    ctx.restore();
  }

  /* ── projectiles: one cached sprite each, 48 x 48 px, centred ── */
  const SHOTS = {
    stinger: function(c) {
      c.beginPath();
      c.moveTo(6, 24);
      c.lineTo(36, 17);
      c.lineTo(42, 24);
      c.lineTo(36, 31);
      c.closePath();
      c.fillStyle = lin(c, 6, 0, 42, 0, ['#ffffff', '#ffd84a', '#2a1a0a']);
      c.fill();
      stroke(c, '#3a2206', 1.5);
    },
    sand: function(c) {
      glow(c, 24, 24, 22, 'rgba(255,200,120,0.5)');
      ell(c, 24, 24, 12, 12);
      c.fillStyle = rad(c, 20, 20, 1, 13, ['#fff0c8', '#e0a050', '#8a5a22']);
      c.fill();
    },
    shard: function(c) {
      c.beginPath();
      c.moveTo(4, 24);
      c.lineTo(30, 15);
      c.lineTo(44, 24);
      c.lineTo(30, 33);
      c.closePath();
      c.fillStyle = lin(c, 0, 15, 0, 33, ['#ffffff', '#8ae8ff', '#3a8ac0']);
      c.fill();
      stroke(c, '#1a5a8a', 1.5);
    },
    icicle: function(c) {
      c.beginPath();
      c.moveTo(16, 4);
      c.lineTo(32, 4);
      c.lineTo(24, 46);
      c.closePath();
      c.fillStyle = lin(c, 16, 0, 32, 0, ['#ffffff', '#bfeaff', '#5aa8d8']);
      c.fill();
      stroke(c, '#2a6a9a', 1.5);
    },
    spore: function(c) {
      glow(c, 24, 24, 23, 'rgba(200,140,255,0.55)');
      ell(c, 24, 24, 10, 10);
      c.fillStyle = rad(c, 21, 21, 1, 11, ['#ffffff', '#d0a0ff', '#6a3aa8']);
      c.fill();
    },
    bullet: function(c) {
      glow(c, 24, 24, 20, 'rgba(255,60,90,0.6)');
      ell(c, 24, 24, 9, 6);
      c.fillStyle = '#ffd0d8';
      c.fill();
    },
    missile: function(c) {
      c.fillStyle = lin(c, 0, 18, 0, 30, ['#e8ecf4', '#7a849c']);
      c.fillRect(10, 19, 26, 10);
      c.beginPath();
      c.moveTo(10, 19);
      c.lineTo(2, 24);
      c.lineTo(10, 29);
      c.closePath();
      c.fillStyle = '#ff2a4a';
      c.fill();
      c.beginPath();
      c.moveTo(36, 21);
      c.lineTo(46, 24);
      c.lineTo(36, 27);
      c.closePath();
      c.fillStyle = '#ffd84a';
      c.fill();
    },
    feather: function(c) {
      c.beginPath();
      c.moveTo(4, 24);
      c.quadraticCurveTo(24, 12, 44, 24);
      c.quadraticCurveTo(24, 36, 4, 24);
      c.fillStyle = lin(c, 4, 0, 44, 0, ['#c08aff', '#3a3450', '#14101e']);
      c.fill();
      stroke(c, '#0c0a18', 1.5);
      c.beginPath();
      c.moveTo(4, 24);
      c.lineTo(44, 24);
      stroke(c, '#e0c8ff', 1);
    },
    drone: function(c) {
      ell(c, 24, 26, 12, 9);
      c.fillStyle = lin(c, 0, 17, 0, 35, ['#ffe46a', '#e09a10']);
      c.fill();
      c.save();
      ell(c, 24, 26, 12, 9);
      c.clip();
      c.fillStyle = '#2a1a0a';
      c.fillRect(22, 14, 4, 24);
      c.fillRect(30, 14, 4, 24);
      c.restore();
      ell(c, 26, 14, 9, 6, -0.4);
      c.fillStyle = 'rgba(220,245,255,0.7)';
      c.fill();
      eye(c, 15, 24, 4, '#3a1a0a');
    },
    orb: function(c) {
      glow(c, 24, 24, 24, 'rgba(255,230,120,0.75)');
      ell(c, 24, 24, 12, 12);
      c.fillStyle = rad(c, 20, 20, 1, 13, ['#ffffff', '#fff3a0', '#ffb81a']);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 2;
      for (let i = 0; i < 8; ++i) {
        const a = i * Math.PI / 4;
        c.beginPath();
        c.moveTo(24 + Math.cos(a) * 15, 24 + Math.sin(a) * 15);
        c.lineTo(24 + Math.cos(a) * 20, 24 + Math.sin(a) * 20);
        c.stroke();
      }
    },
    bolt: function(c) {
      glow(c, 24, 24, 24, 'rgba(255,240,160,0.9)');
      ell(c, 24, 24, 7, 7);
      c.fillStyle = '#ffffff';
      c.fill();
    }
  };

  function getShot(type) {
    if (shotCache[type])
      return shotCache[type];
    const cv = makeCanvas(48, 48);
    const c = cv.getContext('2d');
    (SHOTS[type] || SHOTS.bullet)(c);
    shotCache[type] = cv;
    return cv;
  }

  /* projectiles point along their flight; crows reuse the bird sprite facing left */
  function drawShot(ctx, s, t) {
    if (s.type === 'crow') {
      SZ.FlappyBirdArt.drawBird(ctx, { x: s.x, y: s.y, birdId: 'corvus', frame: t * 12, scale: 1.1, flip: true });
      return;
    }
    const img = getShot(s.type);
    const spin = s.type === 'sand' || s.type === 'spore' || s.type === 'bullet' || s.type === 'drone';
    if (spin) {
      ctx.drawImage(img, s.x - 24, s.y - 24);
      return;
    }
    const a = s.type === 'icicle' ? Math.atan2(s.vy, s.vx) - Math.PI / 2 : Math.atan2(s.vy, s.vx) + Math.PI;
    const c = Math.cos(a), sn = Math.sin(a);
    ctx.save();
    ctx.transform(c, sn, -sn, c, s.x, s.y);
    ctx.drawImage(img, -24, -24);
    ctx.restore();
  }

  function drawOrb(ctx, o, t) {
    const s = 1 + 0.1 * Math.sin(t * 8 + o.phase);
    ctx.drawImage(getShot('orb'), o.x - 24 * s * 1.3, o.y - 24 * s * 1.3, 48 * s * 1.3, 48 * s * 1.3);
  }

  /* telegraphed zones: a pulsing outline while warning, then the attack itself */
  function drawZone(ctx, z, t, groundY, bossX) {
    const warn = z.warn > 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * 24);
    ctx.save();
    if (z.type === 'geyser') {
      const x = z.x - z.w / 2;
      if (warn) {
        ctx.globalAlpha = 0.25 + 0.35 * pulse;
        ctx.fillStyle = '#ffb03a';
        ctx.fillRect(x, z.top, z.w, groundY - z.top);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ff6a1a';
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = 3;
        ctx.strokeRect(x, z.top, z.w, groundY - z.top);
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(232,170,90,0.92)';
        ctx.fillRect(x, z.top, z.w, groundY - z.top);
        ctx.fillStyle = 'rgba(255,236,190,0.9)';
        ctx.fillRect(x + z.w * 0.3, z.top, z.w * 0.4, groundY - z.top);
        for (let i = 0; i < 5; ++i) {
          ctx.beginPath();
          ctx.arc(x + z.w * (0.1 + i * 0.2), z.top + Math.sin(t * 20 + i) * 6, 10, 0, TWO_PI);
          ctx.fill();
        }
      }
    } else if (z.type === 'beam') {
      if (warn) {
        ctx.globalAlpha = 0.4 + 0.5 * pulse;
        ctx.strokeStyle = '#ff2a4a';
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(0, z.y);
        ctx.lineTo(bossX, z.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(255,42,74,0.35)';
        ctx.fillRect(-200, z.y - 16, bossX + 200, 32);
        ctx.fillStyle = 'rgba(255,120,140,0.8)';
        ctx.fillRect(-200, z.y - 8, bossX + 200, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-200, z.y - 3, bossX + 200, 6);
      }
    } else if (z.type === 'bolt') {
      const x = z.x;
      if (warn) {
        ctx.globalAlpha = 0.3 + 0.4 * pulse;
        ctx.fillStyle = '#c08aff';
        ctx.fillRect(x - z.w / 2, -200, z.w, z.bottom + 200);
      } else {
        ctx.strokeStyle = 'rgba(200,160,255,0.5)';
        ctx.lineWidth = 16;
        boltPath(ctx, x, z.bottom, t);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function boltPath(ctx, x, bottom, t) {
    ctx.beginPath();
    ctx.moveTo(x, -200);
    const steps = 9;
    for (let i = 1; i <= steps; ++i) {
      const y = -200 + (bottom + 200) * i / steps;
      ctx.lineTo(x + (i === steps ? 0 : Math.sin(i * 12.9 + Math.floor(t * 20) * 3.1) * 16), y);
    }
  }

  SZ.FlappyBossArt = Object.freeze({ BW, BH, getBoss, drawBoss, getShot, drawShot, drawOrb, drawZone });
})();
