;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Cached procedural sprites for the Platformer: the hero in every pose and
   * skin, seven enemy kinds reskinned for each of the five worlds, the five
   * bosses, every pickup, block and prop, and the UI icons.
   *
   * A sprite is { c, w, h, ax, ay } in logical units; the canvas is painted
   * once at SCALE times the logical size. Draw it with
   *   ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h)
   * Characters, enemies, bosses, the checkpoint and the goal are anchored at
   * the bottom centre (their feet); pickups, flyers, blocks, projectiles and
   * icons at their centre; the moving platform at its top-left corner.
   * Everything faces right; mirror with ctx.scale(-1, 1) for left.
   */

  const SCALE = 2;
  const TAU = Math.PI * 2;
  const OUT = '#1a1226';

  const HERO_FRAMES = Object.freeze({ idle: 4, run: 8, jump: 2, fall: 2, wall: 1, dash: 2, hurt: 1, land: 1, win: 4 });
  const ENEMY_FRAMES = Object.freeze({ walker: 4, charger: 4, hopper: 4, spiky: 4, flyer: 4, diver: 4, turret: 2 });
  const BOSS_FRAMES = Object.freeze({ idle: 4, attack: 2, hurt: 1, special: 2 });
  const ITEM_FRAMES = Object.freeze({ coin: 8, gem: 6, heart: 4, fire: 4, star: 4, checkpoint: 4, goal: 6, qblock: 4, fireball: 4, shot: 4 });
  const BOSS_KINDS = ['slime', 'golem', 'yeti', 'drake', 'sorcerer'];

  /* ══════════════════════════════════════════════════════════════════
     CANVAS + COLOUR HELPERS
     ══════════════════════════════════════════════════════════════════ */

  let built = 0;
  const cache = new Map();

  function makeCanvas(w, h) {
    ++built;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * SCALE));
    c.height = Math.max(1, Math.ceil(h * SCALE));
    return c;
  }

  /* paint once: paint(g) draws in logical units with the origin at the anchor */
  function make(key, w, h, ax, ay, paint) {
    let s = cache.get(key);
    if (s)
      return s;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    g.scale(SCALE, SCALE);
    g.translate(ax, ay);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    paint(g);
    s = Object.freeze({ c: c, w: w, h: h, ax: ax, ay: ay });
    cache.set(key, s);
    return s;
  }

  function parseHex(hex) {
    let h = String(hex || '#888888').replace('#', '');
    if (h.length === 3)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function shade(hex, f) {
    const c = parseHex(hex);
    const k = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
    return '#' + c.map(v => k(v).toString(16).padStart(2, '0')).join('');
  }

  function rgba(hex, a) {
    const c = parseHex(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function vgrad(g, y0, y1, top, bottom, mid) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, top);
    if (mid)
      gr.addColorStop(0.5, mid);
    gr.addColorStop(1, bottom);
    return gr;
  }

  /* a lit ball: highlight up-left, shadow down-right */
  function ballGrad(g, x, y, r, base) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    gr.addColorStop(0, shade(base, 0.45));
    gr.addColorStop(0.55, base);
    gr.addColorStop(1, shade(base, -0.45));
    return gr;
  }

  function ellipse(g, x, y, rx, ry, rot) {
    g.beginPath();
    g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
  }

  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, TAU);
  }

  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  function fillOut(g, fill, lw) {
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = lw || 1.6;
    g.strokeStyle = OUT;
    g.stroke();
  }

  /* lit ellipse body with outline and a gloss spot */
  function body(g, x, y, rx, ry, base, opts) {
    opts = opts || {};
    ellipse(g, x, y, rx, ry, opts.rot);
    const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.45, Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.05);
    gr.addColorStop(0, shade(base, 0.4));
    gr.addColorStop(0.55, base);
    gr.addColorStop(1, shade(base, -0.5));
    fillOut(g, gr, opts.lw);
    if (!opts.noGloss)
      gloss(g, x - rx * 0.35, y - ry * 0.45, rx * 0.32, ry * 0.2, opts.glossA);
  }

  function gloss(g, x, y, rx, ry, a) {
    ellipse(g, x, y, rx, ry, -0.5);
    g.fillStyle = 'rgba(255,255,255,' + (a || 0.45) + ')';
    g.fill();
  }

  /* a thick limb with an outline: dark wide stroke then the colour */
  function limb(g, x0, y0, x1, y1, w, color) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineWidth = w + 3;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = w;
    g.strokeStyle = color;
    g.stroke();
  }

  function glow(g, x, y, r, color, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(color, a === undefined ? 0.7 : a));
    gr.addColorStop(0.45, rgba(color, (a === undefined ? 0.7 : a) * 0.35));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function star(g, x, y, r, inner, n) {
    g.beginPath();
    const k = n || 5;
    for (let i = 0; i < k * 2; ++i) {
      const rad = i % 2 === 0 ? r : r * (inner || 0.45);
      const a = -Math.PI / 2 + i * Math.PI / k;
      if (i === 0) g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      else g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
  }

  function sparkle(g, x, y, r, a) {
    g.save();
    g.globalAlpha *= a === undefined ? 1 : a;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(x, y - r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y);
    g.quadraticCurveTo(x, y, x, y - r);
    g.fill();
    g.restore();
  }

  /* expressive eyes; state: normal | windup | stunned | squash | hurt | happy */
  function eye(g, x, y, r, state, look) {
    look = look === undefined ? 0.35 : look;
    if (state === 'squash' || state === 'blink') {
      g.beginPath();
      g.moveTo(x - r, y);
      g.lineTo(x + r, y);
      g.lineWidth = Math.max(1.2, r * 0.45);
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    if (state === 'stunned') {
      ellipse(g, x, y, r, r);
      fillOut(g, '#ffffff', 1.1);
      g.beginPath();
      for (let i = 0; i <= 16; ++i) {
        const a = i * 0.75, rad = r * 0.8 * i / 16;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
      }
      g.lineWidth = 0.9;
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    if (state === 'hurt') {
      g.beginPath();
      g.moveTo(x - r * 0.8, y - r * 0.8);
      g.lineTo(x + r * 0.8, y + r * 0.8);
      g.moveTo(x + r * 0.8, y - r * 0.8);
      g.lineTo(x - r * 0.8, y + r * 0.8);
      g.lineWidth = Math.max(1.3, r * 0.5);
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    if (state === 'happy') {
      g.beginPath();
      g.arc(x, y + r * 0.35, r * 0.85, Math.PI * 1.1, Math.PI * 1.9);
      g.lineWidth = Math.max(1.3, r * 0.5);
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    ellipse(g, x, y, r * 0.86, r);
    fillOut(g, '#ffffff', 1.1);
    const angry = state === 'windup';
    const pr = r * (state === 'wide' ? 0.42 : 0.55);
    circle(g, x + r * look, y + r * 0.08, pr);
    g.fillStyle = angry ? '#d01818' : '#1a1426';
    g.fill();
    if (angry) {
      circle(g, x + r * look, y + r * 0.08, pr * 0.45);
      g.fillStyle = '#ffd040';
      g.fill();
    }
    circle(g, x + r * look - pr * 0.35, y - pr * 0.35, pr * 0.38);
    g.fillStyle = '#ffffff';
    g.fill();
    if (angry) {
      /* a fierce brow */
      g.beginPath();
      g.moveTo(x - r * 1.0, y - r * 1.25);
      g.lineTo(x + r * 1.0, y - r * 0.7);
      g.lineWidth = Math.max(1.3, r * 0.45);
      g.strokeStyle = OUT;
      g.stroke();
    }
  }

  /* little dizzy stars circling above a stunned foe */
  function dizzy(g, x, y, w) {
    for (let i = 0; i < 3; ++i) {
      const a = i * TAU / 3;
      const sx = x + Math.cos(a) * w * 0.45, sy = y + Math.sin(a) * 3;
      star(g, sx, sy, 4, 0.45);
      fillOut(g, '#ffe24a', 0.9);
    }
  }

  /* white tint over everything painted so far (hurt flashes) */
  function tint(g, color, a, w, h) {
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = rgba(color, a);
    g.fillRect(-w, -h, w * 3, h * 3);
    g.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     HERO
     ══════════════════════════════════════════════════════════════════ */

  function heroPose(pose, f) {
    const P = {
      bob: 0, sx: 1, sy: 1, lean: 0, legF: 0.08, legB: -0.08, kneeF: 0, kneeB: 0,
      armF: 0.25, armB: -0.25, scarf: -0.35, wave: 0, eyes: 'normal', mouth: 'smile', look: 0.35, lines: 0, sparkle: 0
    };
    switch (pose) {
      case 'idle': {
        const b = [0, -0.6, -1.1, -0.6][f];
        P.bob = b;
        P.sy = 1 - b * 0.012;
        P.armF = 0.2 - b * 0.06;
        P.armB = -0.2 + b * 0.06;
        P.scarf = -0.55 + Math.sin(f * 1.6) * 0.08;
        P.wave = f * 1.6;
        if (f === 3)
          P.eyes = 'blink';
        break;
      }
      case 'run': {
        const ph = f / 8 * TAU;
        P.legF = Math.sin(ph) * 0.95;
        P.legB = -P.legF;
        P.kneeF = Math.max(0, -Math.sin(ph)) * 0.6;
        P.kneeB = Math.max(0, Math.sin(ph)) * 0.6;
        P.armF = -Math.sin(ph) * 1.05;
        P.armB = Math.sin(ph) * 1.05;
        P.bob = -Math.abs(Math.cos(ph)) * 2.4;
        P.lean = 0.16;
        P.sy = 1 + Math.abs(Math.cos(ph)) * 0.03;
        P.scarf = 0.12 + Math.sin(ph * 2) * 0.14;
        P.wave = ph * 2;
        P.mouth = 'open';
        break;
      }
      case 'jump':
        P.legF = 0.85; P.kneeF = 0.7; P.legB = -0.35; P.kneeB = 0.2;
        P.armF = 2.7 - f * 0.2; P.armB = -0.9;
        P.sy = 1.07; P.sx = 0.94;
        P.scarf = -0.85 + f * 0.1; P.wave = 1 + f;
        P.mouth = 'open'; P.look = 0.5;
        break;
      case 'fall':
        P.legF = 0.35; P.legB = -0.3; P.kneeB = 0.2;
        P.armF = 2.5 + f * 0.15; P.armB = -2.4 - f * 0.15;
        P.scarf = 1.05 + f * 0.12; P.wave = 2 + f * 1.3;
        P.eyes = 'wide'; P.mouth = 'o'; P.look = 0.3;
        break;
      case 'wall':
        P.lean = -0.08;
        P.armF = 2.2; P.armB = 0.9;
        P.legF = 0.75; P.kneeF = 0.6; P.legB = -0.1;
        P.scarf = -1.25; P.wave = 0.6;
        P.look = -0.45; P.mouth = 'flat';
        break;
      case 'dash':
        P.lean = 0.55; P.sx = 1.08; P.sy = 0.94;
        P.legF = -0.6; P.legB = -1.35; P.kneeF = 0.3;
        P.armF = -1.3; P.armB = -1.7;
        P.scarf = 0.02 + f * 0.05; P.wave = f * 2;
        P.lines = 1; P.mouth = 'grit'; P.look = 0.55;
        break;
      case 'hurt':
        P.lean = -0.35;
        P.armF = 2.1; P.armB = -2.5;
        P.legF = 0.55; P.legB = -0.45; P.kneeF = 0.3;
        P.eyes = 'hurt'; P.mouth = 'o'; P.scarf = 0.7; P.wave = 1;
        break;
      case 'land':
        P.sy = 0.8; P.sx = 1.16;
        P.legF = 0.55; P.legB = -0.55; P.kneeF = 0.5; P.kneeB = 0.5;
        P.armF = 0.95; P.armB = -0.95;
        P.scarf = -0.95; P.wave = 0.4;
        break;
      case 'win': {
        const b = [0, -4, -6, -3][f];
        P.bob = b;
        P.armF = 2.9 + Math.sin(f * 1.6) * 0.2;
        P.armB = -2.75 - Math.cos(f * 1.6) * 0.2;
        P.legF = f === 1 || f === 2 ? 0.6 : 0.1;
        P.kneeF = f === 1 || f === 2 ? 0.7 : 0;
        P.legB = -0.15;
        P.eyes = 'happy'; P.mouth = 'grin';
        P.scarf = 0.3 + f * 0.2; P.wave = f * 1.8;
        P.sparkle = 1;
        break;
      }
      default:
        break;
    }
    return P;
  }

  function heroLeg(g, k, hipX, hipY, a, knee, front) {
    const len = 11 * (1 - 0.28 * knee);
    const fx = hipX + Math.sin(a) * len, fy = hipY + Math.cos(a) * len;
    const pants = front ? shade(k.tunic, -0.35) : shade(k.tunic, -0.5);
    limb(g, hipX, hipY, fx, fy, 5.2, pants);
    /* the boot: a rounded toe pointing forward */
    g.save();
    g.translate(fx, fy);
    g.rotate(a * 0.35);
    ellipse(g, 1.6, 0.6, 4.6, 3.2);
    const boot = front ? k.boots : shade(k.boots, -0.25);
    fillOut(g, vgrad(g, -3, 4, shade(boot, 0.3), shade(boot, -0.35)), 1.4);
    g.fillStyle = rgba('#ffffff', 0.3);
    g.fillRect(-0.5, -2.2, 3.5, 1);
    g.restore();
  }

  function heroArm(g, k, sx, sy, a, front) {
    const hx = sx + Math.sin(a) * 9, hy = sy + Math.cos(a) * 9;
    limb(g, sx, sy, hx, hy, 4.4, front ? k.tunic : shade(k.tunic, -0.3));
    circle(g, hx, hy, 2.7);
    fillOut(g, front ? k.skin : shade(k.skin, -0.15), 1.2);
  }

  /* the scarf tail: a tapered ribbon that ripples along its length */
  function heroScarfTail(g, k, P) {
    const ax = -5, ay = -28.5;
    const len = 19;
    const dx = -Math.cos(P.scarf), dy = -Math.sin(P.scarf);
    const nx = -dy, ny = dx;
    const left = [], right = [], mid = [];
    const N = 9;
    for (let i = 0; i <= N; ++i) {
      const t = i / N;
      const off = Math.sin(P.wave + t * 4.2) * 3.4 * t;
      const cx = ax + dx * len * t + nx * off, cy = ay + dy * len * t + ny * off;
      const half = 2.6 + 1.6 * t;
      left.push([cx + nx * half, cy + ny * half]);
      right.push([cx - nx * half, cy - ny * half]);
      mid.push([cx, cy]);
    }
    g.beginPath();
    g.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i <= N; ++i)
      g.lineTo(left[i][0], left[i][1]);
    /* a forked, fringed tip */
    const tip = mid[N];
    g.lineTo(tip[0] + dx * 3 + nx * 2.5, tip[1] + dy * 3 + ny * 2.5);
    g.lineTo(tip[0] + dx * 0.5, tip[1] + dy * 0.5);
    g.lineTo(tip[0] + dx * 3 - nx * 2.5, tip[1] + dy * 3 - ny * 2.5);
    for (let i = N; i >= 0; --i)
      g.lineTo(right[i][0], right[i][1]);
    g.closePath();
    const gr = g.createLinearGradient(ax, ay, ax + dx * len, ay + dy * len);
    gr.addColorStop(0, shade(k.scarf, 0.15));
    gr.addColorStop(1, shade(k.scarf, -0.3));
    fillOut(g, gr, 1.5);
    /* a highlight along one edge and a darker fold line */
    g.beginPath();
    for (let i = 1; i < N; ++i) {
      const p = left[i], q = mid[i];
      const x = (p[0] * 2 + q[0]) / 3, y = (p[1] * 2 + q[1]) / 3;
      if (i === 1) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 1.1;
    g.strokeStyle = rgba(shade(k.scarf, 0.55), 0.8);
    g.stroke();
    g.beginPath();
    for (let i = 2; i < N; ++i) {
      const p = right[i], q = mid[i];
      const x = (p[0] + q[0] * 2) / 3, y = (p[1] + q[1] * 2) / 3;
      if (i === 2) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 0.9;
    g.strokeStyle = rgba(shade(k.scarf, -0.6), 0.5);
    g.stroke();
  }

  function heroFace(g, k, P) {
    /* face opening inside the hood */
    ellipse(g, 4.2, -37, 8.4, 8.2);
    const fg = g.createRadialGradient(6, -40, 1, 4, -37, 9);
    fg.addColorStop(0, shade(k.skin, 0.25));
    fg.addColorStop(0.7, k.skin);
    fg.addColorStop(1, shade(k.skin, -0.25));
    g.fillStyle = fg;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = shade(k.hood, -0.55);
    g.stroke();
    /* blush */
    ellipse(g, 0.5, -33.8, 1.8, 1.1);
    g.fillStyle = 'rgba(255,110,120,0.45)';
    g.fill();
    ellipse(g, 10.2, -33.8, 1.6, 1.0);
    g.fill();
    eye(g, 2.4, -38.2, 2.6, P.eyes, P.look);
    eye(g, 8.2, -38.2, 2.5, P.eyes, P.look);
    g.beginPath();
    g.lineWidth = 1.1;
    g.strokeStyle = OUT;
    g.fillStyle = '#8a2a3a';
    if (P.mouth === 'open' || P.mouth === 'grin') {
      g.moveTo(3.4, -33.6);
      g.quadraticCurveTo(5.6, -30.2 - (P.mouth === 'grin' ? 0.8 : 0), 7.8, -33.6);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (P.mouth === 'o') {
      ellipse(g, 5.6, -32.8, 1.3, 1.6);
      g.fill();
      g.stroke();
    } else if (P.mouth === 'grit') {
      g.moveTo(3.6, -33);
      g.lineTo(7.8, -33.4);
      g.stroke();
    } else if (P.mouth === 'flat') {
      g.moveTo(4, -33);
      g.lineTo(7, -33);
      g.stroke();
    } else {
      g.moveTo(3.8, -33.8);
      g.quadraticCurveTo(5.6, -32, 7.4, -33.8);
      g.stroke();
    }
  }

  function heroHood(g, k, P) {
    /* the two hood points, bending back with the motion */
    const back = Math.max(-0.4, Math.min(0.6, P.scarf * 0.25 + P.lean * 0.6));
    g.beginPath();
    g.moveTo(-5, -47);
    g.quadraticCurveTo(-9 - back * 5, -54, -12 - back * 8, -53 + back * 3);
    g.quadraticCurveTo(-11, -48, -10.5, -43);
    g.closePath();
    fillOut(g, shade(k.hood, -0.2), 1.4);
    g.beginPath();
    g.moveTo(3, -49.5);
    g.quadraticCurveTo(1 - back * 4, -57, -2.5 - back * 8, -57.5 + back * 3);
    g.quadraticCurveTo(-3, -53, -5, -49);
    g.closePath();
    fillOut(g, k.hood, 1.4);
    /* the hood dome */
    circle(g, 1, -38.5, 13);
    const hg = g.createRadialGradient(-3, -45, 2, 1, -38, 14);
    hg.addColorStop(0, shade(k.hood, 0.35));
    hg.addColorStop(0.6, k.hood);
    hg.addColorStop(1, shade(k.hood, -0.45));
    fillOut(g, hg, 1.7);
    /* trim seam and a soft rim light on the lit side */
    ellipse(g, 4.2, -37, 9.6, 9.4);
    g.lineWidth = 1.5;
    g.strokeStyle = shade(k.trim, -0.15);
    g.stroke();
    ellipse(g, 4.2, -37, 9.6, 9.4);
    g.lineWidth = 0.6;
    g.strokeStyle = rgba(shade(k.trim, 0.6), 0.9);
    g.stroke();
    g.beginPath();
    g.arc(1, -38.5, 11.6, -2.6, -1.6);
    g.lineWidth = 1.6;
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.stroke();
  }

  function heroTorso(g, k) {
    g.beginPath();
    g.moveTo(-8, -28);
    g.quadraticCurveTo(0, -30.5, 8, -28);
    g.lineTo(10.5, -13);
    g.quadraticCurveTo(0, -10.5, -10.5, -13);
    g.closePath();
    const tg = g.createLinearGradient(-10, -28, 10, -12);
    tg.addColorStop(0, shade(k.tunic, 0.25));
    tg.addColorStop(0.6, k.tunic);
    tg.addColorStop(1, shade(k.tunic, -0.35));
    fillOut(g, tg, 1.6);
    /* hem trim */
    g.beginPath();
    g.moveTo(-10.2, -14.2);
    g.quadraticCurveTo(0, -11.8, 10.2, -14.2);
    g.lineWidth = 1.6;
    g.strokeStyle = k.trim;
    g.stroke();
    /* belt and buckle */
    rr(g, -9.4, -20, 18.8, 3.4, 1.2);
    fillOut(g, shade(k.boots, -0.1), 1);
    rr(g, 1.8, -20.6, 4.4, 4.6, 1);
    fillOut(g, k.trim, 1);
    g.fillStyle = shade(k.trim, -0.5);
    g.fillRect(3.2, -19.2, 1.6, 1.8);
    /* a stitched tunic seam */
    g.beginPath();
    g.moveTo(-1, -27);
    g.lineTo(-1.5, -21);
    g.lineWidth = 0.8;
    g.strokeStyle = rgba(shade(k.tunic, -0.6), 0.6);
    g.stroke();
  }

  function heroScarfWrap(g, k) {
    rr(g, -8.5, -30.6, 17, 5.4, 2.6);
    fillOut(g, vgrad(g, -30.6, -25.2, shade(k.scarf, 0.3), shade(k.scarf, -0.3)), 1.4);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fillRect(-6, -29.8, 11, 1);
  }

  function paintHero(g, k, pose, f) {
    const P = heroPose(pose, f);
    if (P.lines) {
      /* speed streaks trailing the dash */
      for (let i = 0; i < 4; ++i) {
        const y = -36 + i * 8 + (f ? 2 : 0);
        g.beginPath();
        g.moveTo(-28 + i * 2, y);
        g.lineTo(-14 - (i % 2) * 4, y);
        g.lineWidth = 1.6;
        g.strokeStyle = rgba(k.trim, 0.55 - i * 0.08);
        g.stroke();
      }
    }
    /* a soft contact shadow */
    ellipse(g, 0, 0.5, 10 * P.sx, 2.2);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fill();
    g.save();
    g.translate(0, P.bob);
    g.scale(P.sx, P.sy);
    g.translate(0, -13);
    g.rotate(P.lean);
    g.translate(0, 13);
    heroScarfTail(g, k, P);
    heroArm(g, k, -4.5, -25.5, P.armB, false);
    heroLeg(g, k, -3.4, -13.4, P.legB, P.kneeB, false);
    heroTorso(g, k);
    heroLeg(g, k, 3.4, -13.4, P.legF, P.kneeF, true);
    heroScarfWrap(g, k);
    /* a raised front arm passes behind the big head instead of over the face */
    const raised = P.armF > 1.9;
    if (raised)
      heroArm(g, k, 4.6, -25.5, P.armF, true);
    heroHood(g, k, P);
    heroFace(g, k, P);
    if (!raised)
      heroArm(g, k, 4.6, -25.5, P.armF, true);
    g.restore();
    if (P.sparkle) {
      sparkle(g, -16, -52 + (f % 2) * 4, 3.6, 0.9);
      sparkle(g, 17, -44 - (f % 2) * 4, 2.8, 0.8);
    }
  }

  function skinKey(k) {
    return k.id || [k.tunic, k.trim, k.scarf, k.hood, k.skin, k.boots].join('');
  }

  function hero(skin, pose, frame) {
    const n = HERO_FRAMES[pose] ? pose : 'idle';
    const f = ((frame | 0) % HERO_FRAMES[n] + HERO_FRAMES[n]) % HERO_FRAMES[n];
    return make('hero|' + skinKey(skin) + '|' + n + '|' + f, 72, 74, 36, 70, (g) => paintHero(g, skin, n, f));
  }

  /* ══════════════════════════════════════════════════════════════════
     ENEMIES
     ══════════════════════════════════════════════════════════════════ */

  function legSet(g, xs, y, len, f, color, w) {
    for (let i = 0; i < xs.length; ++i) {
      const sw = Math.sin(f * Math.PI / 2 + i * 1.7) * 2.2;
      limb(g, xs[i], y, xs[i] + sw, y + len, w || 2.4, color);
    }
  }

  /* ── walker ── */
  function paintWalker(g, w, f, st) {
    const bob = [0, -1, 0, 1][f];
    if (w === 0) {
      /* slime: a wobbling jelly drop with a leaf on top */
      const sq = [1, 0.94, 1, 1.06][f];
      g.save();
      g.scale(1 / sq, sq);
      g.beginPath();
      g.moveTo(-19, 0);
      g.bezierCurveTo(-21, -18, -10, -30, 2, -30);
      g.bezierCurveTo(14, -30, 21, -16, 19, 0);
      g.closePath();
      const gr = g.createRadialGradient(-5, -22, 2, 0, -12, 24);
      gr.addColorStop(0, '#d8ff9a');
      gr.addColorStop(0.5, '#5ad04a');
      gr.addColorStop(1, '#2a7a2a');
      fillOut(g, gr, 1.8);
      gloss(g, -8, -22, 5, 3, 0.6);
      ellipse(g, 9, -6, 6, 3, 0);
      g.fillStyle = 'rgba(20,80,20,0.35)';
      g.fill();
      g.beginPath();
      g.moveTo(2, -29);
      g.quadraticCurveTo(8, -38, 14, -34);
      g.quadraticCurveTo(8, -30, 2, -29);
      fillOut(g, '#3a9a2a', 1.2);
      g.restore();
      eye(g, 3, -16, 4.2, st, 0.4);
      eye(g, 12, -16, 3.8, st, 0.4);
      g.beginPath();
      g.arc(8, -9, 3, 0.2, Math.PI - 0.2);
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      return;
    }
    if (w === 1) {
      /* cave beetle: glossy shell with glowing spots */
      legSet(g, [-12, -4, 4, 12], -6 + bob, 6, f, '#1a1830', 2.4);
      ellipse(g, -2, -14 + bob, 18, 13);
      const gr = g.createRadialGradient(-8, -22 + bob, 2, -2, -14 + bob, 20);
      gr.addColorStop(0, '#8ab0ff');
      gr.addColorStop(0.5, '#3a4ab0');
      gr.addColorStop(1, '#1a1a50');
      fillOut(g, gr, 1.8);
      g.beginPath();
      g.moveTo(-2, -27 + bob);
      g.lineTo(-2, -2 + bob);
      g.lineWidth = 1.2;
      g.strokeStyle = OUT;
      g.stroke();
      for (const s of [[-9, -17], [-6, -9], [4, -18], [7, -10]]) {
        glow(g, s[0], s[1] + bob, 5, '#7ae8ff', 0.7);
        circle(g, s[0], s[1] + bob, 1.6);
        g.fillStyle = '#c8faff';
        g.fill();
      }
      gloss(g, -9, -22 + bob, 6, 2.5, 0.5);
      body(g, 15, -10 + bob, 7, 6, '#2a2a5a', { noGloss: true });
      g.beginPath();
      g.moveTo(20, -8 + bob);
      g.quadraticCurveTo(26, -6 + bob, 24, -1 + bob);
      g.lineWidth = 1.6;
      g.strokeStyle = OUT;
      g.stroke();
      eye(g, 16.5, -12 + bob, 2.4, st, 0.5);
      return;
    }
    if (w === 2) {
      /* penguin: waddling, scarf of frost */
      const tilt = [-0.08, 0, 0.08, 0][f];
      g.save();
      g.rotate(tilt);
      ellipse(g, -6, -2, 5, 2.4);
      fillOut(g, '#ff9a2a', 1.2);
      ellipse(g, 6, -2, 5, 2.4);
      fillOut(g, '#ff9a2a', 1.2);
      ellipse(g, 0, -16, 14, 16);
      fillOut(g, vgrad(g, -32, 0, '#3a4a6a', '#141a2a'), 1.8);
      ellipse(g, 3, -13, 9, 11.5);
      g.fillStyle = vgrad(g, -25, -2, '#ffffff', '#c8d8f0');
      g.fill();
      ellipse(g, -12, -15, 4, 9, 0.3);
      fillOut(g, '#1e2638', 1.4);
      gloss(g, -5, -27, 4, 2, 0.4);
      g.beginPath();
      g.moveTo(9, -21);
      g.lineTo(17, -19);
      g.lineTo(9, -16.5);
      g.closePath();
      fillOut(g, '#ffa02a', 1.2);
      g.restore();
      eye(g, 3, -23, 2.6, st, 0.5);
      eye(g, 9, -23, 2.4, st, 0.5);
      return;
    }
    if (w === 3) {
      /* magma crab: cracked shell glowing from within, claws raised */
      legSet(g, [-12, -6, 6, 12], -7 + bob, 7, f, '#3a1a10', 2.4);
      const clawY = -18 + bob - (f % 2) * 2;
      limb(g, -12, -12 + bob, -20, clawY, 3, '#b8381a');
      limb(g, 12, -12 + bob, 21, clawY, 3, '#b8381a');
      body(g, -21, clawY - 3, 5, 4.5, '#d84a1a', { noGloss: true });
      body(g, 22, clawY - 3, 5.5, 5, '#d84a1a', { noGloss: true });
      ellipse(g, 0, -13 + bob, 17, 10);
      fillOut(g, ballGrad(g, 0, -13 + bob, 17, '#c03a18'), 1.8);
      g.beginPath();
      g.moveTo(-10, -14 + bob); g.lineTo(-4, -18 + bob); g.lineTo(2, -12 + bob); g.lineTo(8, -17 + bob);
      g.lineWidth = 1.8;
      g.strokeStyle = '#ffd040';
      g.stroke();
      glow(g, 0, -15 + bob, 10, '#ffa020', 0.35);
      limb(g, -4, -21 + bob, -6, -26 + bob, 1.4, '#3a1a10');
      limb(g, 4, -21 + bob, 6, -26 + bob, 1.4, '#3a1a10');
      eye(g, -6, -27 + bob, 2.6, st, 0.3);
      eye(g, 6, -27 + bob, 2.6, st, 0.3);
      return;
    }
    /* clockwork knight: round armour, glowing visor, wind-up key */
    legSet(g, [-6, 6], -8 + bob, 8, f, '#4a4a6a', 4);
    ellipse(g, -6, -1, 4.5, 2.4);
    fillOut(g, '#5a5a7a', 1.2);
    ellipse(g, 6, -1, 4.5, 2.4);
    fillOut(g, '#5a5a7a', 1.2);
    const kr = (f * Math.PI / 2);
    g.save();
    g.translate(-16, -18 + bob);
    g.rotate(kr);
    limb(g, -5, 0, 5, 0, 2.6, '#ffe08a');
    circle(g, -5, 0, 2.6); fillOut(g, '#ffe08a', 1);
    circle(g, 5, 0, 2.6); fillOut(g, '#ffe08a', 1);
    g.restore();
    body(g, 0, -18 + bob, 15, 14, '#b8c0d8');
    rr(g, -2, -24 + bob, 16, 6, 3);
    fillOut(g, '#1a1a2a', 1.2);
    glow(g, 7, -21 + bob, 9, st === 'windup' ? '#ff4a4a' : '#5ad1ff', 0.8);
    rr(g, 0, -22.5 + bob, 12, 3, 1.5);
    g.fillStyle = st === 'windup' ? '#ff8a8a' : '#c8f4ff';
    g.fill();
    g.beginPath();
    g.moveTo(-1, -32 + bob);
    g.quadraticCurveTo(-4, -40 + bob, 3, -40 + bob);
    g.lineWidth = 3;
    g.strokeStyle = '#d04a8a';
    g.stroke();
    circle(g, 4, -8 + bob, 1.5); g.fillStyle = '#7a7a9a'; g.fill();
    circle(g, -4, -8 + bob, 1.5); g.fill();
  }

  /* ── charger ── */
  function paintCharger(g, w, f, st) {
    const bob = [0, -1.5, 0, -1][f];
    const furs = ['#8a5a32', '#7a7a88', '#f0ece4', '#3a2420', '#5a3aa8'];
    const fur = furs[w];
    const legC = shade(fur, -0.45);
    const step = (i) => Math.sin(f * Math.PI / 2 + i * Math.PI) * 3;
    for (let i = 0; i < 4; ++i)
      limb(g, -14 + i * 9, -10 + bob, -14 + i * 9 + step(i), -1, 4, i % 2 ? legC : shade(legC, -0.2));
    for (let i = 0; i < 4; ++i) {
      ellipse(g, -14 + i * 9 + step(i) + 1, -1.2, 3, 1.8);
      fillOut(g, '#2a1a14', 1);
    }
    /* body */
    ellipse(g, -2, -18 + bob, 21, 13);
    fillOut(g, ballGrad(g, -2, -18 + bob, 21, fur), 1.8);
    if (w === 2) {
      /* ram wool puffs */
      for (let i = 0; i < 7; ++i) {
        circle(g, -18 + i * 5.5, -28 + bob + (i % 2) * 2, 4.5);
        fillOut(g, ballGrad(g, -18 + i * 5.5, -28 + bob, 4.5, '#ffffff'), 1.1);
      }
    } else if (w === 3) {
      g.beginPath();
      g.moveTo(-16, -20 + bob); g.lineTo(-8, -24 + bob); g.lineTo(-2, -17 + bob); g.lineTo(6, -23 + bob); g.lineTo(12, -18 + bob);
      g.lineWidth = 2;
      g.strokeStyle = '#ff9a2a';
      g.stroke();
      glow(g, -2, -20 + bob, 12, '#ff6a1a', 0.3);
    } else if (w === 1) {
      for (const p of [[-12, -26], [-4, -29], [5, -27]]) {
        g.beginPath();
        g.moveTo(p[0] - 3, p[1] + 3 + bob); g.lineTo(p[0], p[1] - 4 + bob); g.lineTo(p[0] + 3, p[1] + 3 + bob);
        g.closePath();
        fillOut(g, '#7ae8ff', 1);
      }
    } else if (w === 4) {
      rr(g, -18, -26 + bob, 30, 8, 3);
      fillOut(g, vgrad(g, -26, -18, '#ffe08a', '#b88a2a'), 1.2);
    } else {
      g.beginPath();
      for (let i = 0; i < 6; ++i) {
        g.moveTo(-16 + i * 4, -28 + bob);
        g.lineTo(-14 + i * 4, -33 + bob);
      }
      g.lineWidth = 1.6;
      g.strokeStyle = OUT;
      g.stroke();
    }
    gloss(g, -10, -25 + bob, 6, 2.5, 0.3);
    /* head */
    const hx = 19, hy = -16 + bob + (st === 'windup' ? 3 : 0);
    ellipse(g, hx, hy, 11, 9.5);
    fillOut(g, ballGrad(g, hx, hy, 11, shade(fur, w === 2 ? -0.1 : 0.05)), 1.8);
    ellipse(g, hx + 9, hy + 3, 4.5, 4);
    fillOut(g, w === 2 ? '#e8c0b0' : shade(fur, 0.25), 1.2);
    circle(g, hx + 10.5, hy + 2.5, 0.9); g.fillStyle = OUT; g.fill();
    if (w === 0 || w === 3) {
      /* tusks / bull horns */
      g.beginPath();
      g.moveTo(hx + 7, hy + 5); g.quadraticCurveTo(hx + 13, hy + 2, hx + 12, hy - 4);
      g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 1.6; g.strokeStyle = '#fff4dc'; g.stroke();
      if (w === 3) {
        g.beginPath();
        g.moveTo(hx - 3, hy - 8); g.quadraticCurveTo(hx + 4, hy - 18, hx + 10, hy - 15);
        g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
        g.lineWidth = 2.4; g.strokeStyle = '#e8dcc0'; g.stroke();
      }
    } else if (w === 1) {
      g.beginPath();
      g.moveTo(hx + 6, hy - 4); g.lineTo(hx + 14, hy - 14); g.lineTo(hx + 10, hy - 2);
      g.closePath();
      fillOut(g, '#9af0ff', 1.2);
      glow(g, hx + 11, hy - 9, 7, '#7ae8ff', 0.6);
    } else if (w === 2) {
      g.beginPath();
      g.arc(hx - 2, hy - 2, 7, -2.6, 1.2);
      g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 3.4; g.strokeStyle = '#c8a878'; g.stroke();
    } else {
      g.beginPath();
      g.moveTo(hx + 8, hy - 2); g.lineTo(hx + 22, hy - 4); g.lineTo(hx + 8, hy + 2);
      g.closePath();
      fillOut(g, '#ffe08a', 1.2);
    }
    eye(g, hx + 2, hy - 3, 2.8, st, 0.5);
    if (st === 'windup') {
      /* dust kicked by a pawing hoof */
      for (let i = 0; i < 3; ++i) {
        circle(g, -24 - i * 5, -3 - i * 2, 3 - i * 0.6);
        g.fillStyle = 'rgba(200,180,150,0.6)';
        g.fill();
      }
    }
  }

  /* ── hopper ── */
  function paintHopper(g, w, f, st) {
    /* 0 crouch, 1 push, 2 air, 3 land */
    const crouch = [1, 0.3, 0, 0.6][f];
    const lift = [0, -2, -5, -1][f];
    const cols = ['#5ac84a', '#c8a060', '#ffffff', '#a82a1a', '#c0c8e0'];
    const base = cols[w];
    g.save();
    g.translate(0, lift);
    if (w === 4) {
      /* spring automaton: a coil under a brass dome */
      for (let i = 0; i < 4; ++i) {
        ellipse(g, 0, -2 - i * (3 - crouch * 1.4), 8, 2.4);
        g.lineWidth = 3;
        g.strokeStyle = OUT;
        g.stroke();
        g.lineWidth = 1.8;
        g.strokeStyle = '#d8dce8';
        g.stroke();
      }
      const top = -14 + crouch * 5;
      body(g, 0, top - 8, 13, 10, '#c89a3a');
      rr(g, -9, top - 10, 18, 5, 2.5);
      fillOut(g, '#2a2440', 1);
      eye(g, -3, top - 7.5, 2, st, 0.4);
      eye(g, 4, top - 7.5, 2, st, 0.4);
      circle(g, 0, top - 19, 2.4); fillOut(g, '#ff5a5a', 1);
      g.restore();
      return;
    }
    const by = -12 + crouch * 3;
    /* back legs folding */
    const kneeX = -12 - crouch * 3, kneeY = by + 2 - (1 - crouch) * 4;
    limb(g, -8, by, kneeX, kneeY, 5, shade(base, -0.2));
    limb(g, kneeX, kneeY, -4 + (1 - crouch) * -8, -1 + (f === 2 ? -2 : 0), 3.4, shade(base, -0.3));
    ellipse(g, -2 + (1 - crouch) * -8, -1, 5, 2); fillOut(g, shade(base, -0.3), 1);
    ellipse(g, 0, by, 15, 10 - crouch * 1.5);
    fillOut(g, ballGrad(g, 0, by, 15, base), 1.8);
    ellipse(g, 4, by + 4, 9, 4);
    g.fillStyle = w === 0 ? '#e8f8a0' : w === 3 ? '#ffb040' : 'rgba(255,255,255,0.55)';
    g.fill();
    limb(g, 9, by + 4, 11, -1, 2.6, shade(base, -0.25));
    if (w === 0 || w === 3) {
      body(g, 3, by - 10, 4.5, 4.5, base, { noGloss: true });
      body(g, 11, by - 9, 4.5, 4.5, base, { noGloss: true });
      eye(g, 3, by - 10.5, 3, st, 0.5);
      eye(g, 11, by - 9.5, 3, st, 0.5);
      g.beginPath();
      g.moveTo(5, by - 2);
      g.quadraticCurveTo(10, by + 1, 15, by - 3);
      g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke();
      if (w === 3)
        for (const s of [[-6, -16], [-1, -19], [-9, -11]]) {
          glow(g, s[0], s[1] + crouch * 3, 4, '#ffa020', 0.8);
        }
    } else if (w === 1) {
      for (let i = 0; i < 3; ++i) {
        g.beginPath();
        g.arc(-8 + i * 5, by, 9, -1.2, -0.3);
        g.lineWidth = 1.2;
        g.strokeStyle = 'rgba(70,40,10,0.55)';
        g.stroke();
      }
      ellipse(g, -2, by - 6, 11, 4, -0.15);
      fillOut(g, 'rgba(240,220,170,0.75)', 1.1);
      g.beginPath();
      g.moveTo(10, by - 6); g.quadraticCurveTo(22, by - 26, 30, by - 18);
      g.moveTo(8, by - 7); g.quadraticCurveTo(14, by - 30, 24, by - 28);
      g.lineWidth = 1.2; g.strokeStyle = '#5a4020'; g.stroke();
      glow(g, 10, by - 4, 6, '#7ae8ff', 0.4);
      eye(g, 9, by - 4, 3, st, 0.5);
    } else {
      /* snow hare ears */
      for (const ex of [2, 8]) {
        ellipse(g, ex - 3, by - 16, 3, 9, -0.4 - crouch * 0.4);
        fillOut(g, '#ffffff', 1.4);
        ellipse(g, ex - 3, by - 16, 1.4, 6, -0.4 - crouch * 0.4);
        g.fillStyle = '#ffb8c8';
        g.fill();
      }
      eye(g, 9, by - 3, 2.8, st, 0.5);
      circle(g, 15, by, 1.4); g.fillStyle = '#ff8aa8'; g.fill();
    }
    g.restore();
  }

  /* ── spiky ── */
  function paintSpiky(g, w, f, st) {
    const spikeC = ['#6a4a2a', '#7ae8ff', '#dff4ff', '#2a2028', '#ffe08a'][w];
    const bodyC = ['#c89060', '#3a4a8a', '#7ab0d8', '#5a2a2a', '#7a4aa8'][w];
    const bob = [0, -1, 0, -1][f];
    legSet(g, [-7, 7], -5, 5, f, shade(bodyC, -0.4), 3.4);
    /* spikes along the back */
    for (let i = 0; i < 7; ++i) {
      const a = Math.PI + 0.25 + i * (Math.PI - 0.5) / 6;
      const bx = Math.cos(a) * 14, byy = -12 + bob + Math.sin(a) * 12;
      const tx = Math.cos(a) * 24, ty = -12 + bob + Math.sin(a) * 22;
      g.beginPath();
      g.moveTo(bx + Math.sin(a) * 4, byy - Math.cos(a) * 4);
      g.lineTo(tx, ty);
      g.lineTo(bx - Math.sin(a) * 4, byy + Math.cos(a) * 4);
      g.closePath();
      fillOut(g, vgrad(g, ty, byy, shade(spikeC, 0.5), shade(spikeC, -0.3)), 1.3);
    }
    if (w === 3)
      glow(g, 0, -20 + bob, 16, '#ff3a1a', 0.35);
    if (w === 1)
      glow(g, 0, -20 + bob, 16, '#7ae8ff', 0.3);
    ellipse(g, 0, -11 + bob, 15, 11);
    fillOut(g, ballGrad(g, 0, -11 + bob, 15, bodyC), 1.8);
    ellipse(g, 8, -8 + bob, 7, 6);
    g.fillStyle = rgba(shade(bodyC, 0.5), 0.8);
    g.fill();
    eye(g, 6, -12 + bob, 2.8, st, 0.5);
    eye(g, 12, -12 + bob, 2.5, st, 0.5);
    circle(g, 15, -7 + bob, 1.6); g.fillStyle = OUT; g.fill();
  }

  /* ── flyer (centre anchor) ── */
  function paintFlyer(g, w, f, st) {
    const flap = [-1, -0.2, 0.7, -0.2][f];
    const bob = [0, -1.5, 0, 1.5][f];
    const wingC = ['rgba(220,240,255,0.75)', '#3a2a4a', '#f0f0f8', 'rgba(255,170,60,0.7)', 'rgba(255,255,255,0.85)'][w];
    function wing(side) {
      g.save();
      g.translate(-2, -6 + bob);
      g.rotate(-side * (0.3 + flap * 0.6));
      if (w === 1) {
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(-side * 10, -14, -side * 20, -6);
        g.quadraticCurveTo(-side * 16, -2, -side * 15, 2);
        g.quadraticCurveTo(-side * 10, -2, -side * 8, 3);
        g.closePath();
      } else {
        ellipse(g, -side * 10, -6, 11, 6, side * 0.4);
      }
      fillOut(g, wingC, 1.3);
      g.restore();
    }
    if (w === 4) {
      /* cloud sprite: fluffy puffs with a cheeky face */
      for (const p of [[-10, 2, 7], [10, 2, 7], [0, -4, 10], [-6, -8, 6], [7, -9, 6]]) {
        circle(g, p[0], p[1] + bob, p[2]);
        fillOut(g, ballGrad(g, p[0], p[1] + bob, p[2], '#f4f6ff'), 1.4);
      }
      eye(g, -2, -3 + bob, 2.6, st, 0.4);
      eye(g, 6, -3 + bob, 2.6, st, 0.4);
      circle(g, -6, 2 + bob, 2); g.fillStyle = 'rgba(255,140,180,0.5)'; g.fill();
      sparkle(g, 14, -12 + bob, 3, 0.6 + 0.4 * (f % 2));
      return;
    }
    wing(1);
    if (w === 3)
      glow(g, 0, bob, 20, '#ff8a20', 0.45);
    const bodyC = ['#ffc83a', '#5a3a6a', '#f4f4fa', '#ff6a1a'][w];
    ellipse(g, 0, bob, 13, 11);
    fillOut(g, ballGrad(g, 0, bob, 13, bodyC), 1.8);
    if (w === 0) {
      for (const sx of [-6, 0]) {
        g.beginPath();
        g.ellipse(sx, bob, 2, 10.5, 0, 0, TAU);
        g.fillStyle = '#2a1a10';
        g.fill();
      }
      g.beginPath();
      g.moveTo(-13, bob); g.lineTo(-19, bob + 2); g.lineTo(-12, bob + 4);
      fillOut(g, '#2a1a10', 1);
    } else if (w === 1) {
      g.beginPath();
      g.moveTo(2, -8 + bob); g.lineTo(5, -16 + bob); g.lineTo(8, -8 + bob);
      g.moveTo(-4, -9 + bob); g.lineTo(-2, -16 + bob); g.lineTo(1, -9 + bob);
      fillOut(g, '#5a3a6a', 1.2);
      g.beginPath();
      g.moveTo(4, 5 + bob); g.lineTo(5, 9 + bob); g.lineTo(7, 5 + bob);
      g.fillStyle = '#ffffff';
      g.fill();
    } else if (w === 2) {
      ellipse(g, 3, 2 + bob, 7, 6);
      g.fillStyle = '#dde6f0';
      g.fill();
      for (let i = 0; i < 3; ++i) {
        g.beginPath();
        g.arc(-2 + i * 4, 3 + bob, 2, 0, Math.PI);
        g.lineWidth = 0.8;
        g.strokeStyle = '#9aa8c0';
        g.stroke();
      }
      g.beginPath();
      g.moveTo(6, -1 + bob); g.lineTo(9, 2 + bob); g.lineTo(5, 2 + bob);
      fillOut(g, '#ffb03a', 1);
    } else {
      g.beginPath();
      g.moveTo(-12, bob); g.quadraticCurveTo(-20, bob - 10, -16, bob - 18); g.quadraticCurveTo(-12, bob - 8, -6, bob - 9);
      fillOut(g, '#ffd040', 1.2);
    }
    gloss(g, -4, -5 + bob, 4, 2, 0.5);
    eye(g, 3, -3 + bob, w === 2 ? 3.6 : 2.8, st, 0.5);
    eye(g, 9, -3 + bob, w === 2 ? 3.4 : 2.6, st, 0.5);
    wing(-1);
  }

  /* ── diver (centre anchor) ── */
  function paintDiver(g, w, f, st) {
    const dive = st === 'windup';
    const flap = dive ? 0.9 : [-1, -0.3, 0.7, -0.3][f];
    const bodyC = ['#b07a3a', '#4a2a4a', '#d8e8f8', '#ff6a1a', '#2a2a40'][w];
    const wingC = ['#8a5a2a', '#3a1a3a', '#a8c8e8', '#ffb03a', '#3a3a58'][w];
    const bellyC = ['#f4e4c8', '#8a5a7a', '#ffffff', '#ffe08a', '#5a5a80'][w];
    g.save();
    if (dive)
      g.rotate(0.5);
    /* tail feathers */
    g.beginPath();
    g.moveTo(-12, 0); g.lineTo(-24, -4); g.lineTo(-22, 2); g.lineTo(-25, 6); g.lineTo(-12, 4);
    g.closePath();
    fillOut(g, shade(wingC, -0.15), 1.3);
    function wing(side, front) {
      g.save();
      g.translate(-2, -4);
      g.rotate(side * 0.1 - flap * 0.7 * side);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(-8, -18 * side, -22, -14 * side);
      g.lineTo(-17, -10 * side);
      g.lineTo(-20, -6 * side);
      g.lineTo(-13, -4 * side);
      g.quadraticCurveTo(-8, 2, 0, 3);
      g.closePath();
      fillOut(g, front ? wingC : shade(wingC, -0.3), 1.4);
      g.restore();
    }
    wing(1, false);
    if (w === 3)
      glow(g, 0, 0, 22, '#ff7a1a', 0.45);
    if (w === 4)
      glow(g, 0, 0, 20, '#5ad1ff', 0.25);
    ellipse(g, 0, 0, 14, 9);
    fillOut(g, ballGrad(g, 0, 0, 14, bodyC), 1.8);
    ellipse(g, 2, 3, 8, 4.5);
    g.fillStyle = bellyC;
    g.fill();
    body(g, 13, -4, 7, 6.5, bodyC, { noGloss: true });
    g.beginPath();
    g.moveTo(18, -6); g.quadraticCurveTo(26, -4, 23, 1); g.lineTo(18, -1);
    g.closePath();
    fillOut(g, w === 1 ? '#e8e0f0' : '#ffc03a', 1.2);
    eye(g, 14.5, -6, 2.6, st, 0.6);
    if (w === 4) {
      g.beginPath();
      g.moveTo(-4, -8); g.lineTo(0, -14); g.lineTo(1, -9); g.lineTo(5, -15);
      g.lineWidth = 1.4; g.strokeStyle = '#7ae8ff'; g.stroke();
    }
    wing(-1, true);
    g.restore();
  }

  /* ── turret (bottom anchor) ── */
  function paintTurret(g, w, f, st) {
    const open = f === 1;
    const charge = st === 'windup';
    if (w === 0) {
      /* cannon-flower in a terracotta pot */
      g.beginPath();
      g.moveTo(-13, -16); g.lineTo(13, -16); g.lineTo(10, 0); g.lineTo(-10, 0);
      g.closePath();
      fillOut(g, vgrad(g, -16, 0, '#e8865a', '#9a4a2a'), 1.6);
      rr(g, -15, -19, 30, 5, 2);
      fillOut(g, '#d8764a', 1.4);
      limb(g, 0, -19, 2, -30, 3.6, '#3a9a2a');
      ellipse(g, -7, -24, 6, 2.6, -0.5); fillOut(g, '#4ab83a', 1.1);
      const hy = -38;
      for (let i = 0; i < 6; ++i) {
        const a = i * TAU / 6 + 0.3;
        ellipse(g, 2 + Math.cos(a) * 10, hy + Math.sin(a) * 10, 6, 4, a);
        fillOut(g, charge ? '#ff6a5a' : '#ff8ab8', 1.2);
      }
      circle(g, 2, hy, 9);
      fillOut(g, ballGrad(g, 2, hy, 9, '#ffd040'), 1.6);
      circle(g, 6, hy, open ? 5 : 3.4);
      g.fillStyle = '#3a1a10';
      g.fill();
      if (charge)
        glow(g, 6, hy, 9, '#ff4a2a', 0.8);
      eye(g, -2, hy - 3, 2, st === 'stunned' ? 'stunned' : 'normal', 0.3);
      return;
    }
    const bases = ['', '#3a4a8a', '#d8e4f0', '#3a2a24', '#5a4a8a'];
    const bc = bases[w];
    /* a sturdy pedestal */
    g.beginPath();
    g.moveTo(-16, 0); g.lineTo(-12, -16); g.lineTo(12, -16); g.lineTo(16, 0);
    g.closePath();
    fillOut(g, vgrad(g, -16, 0, shade(bc, 0.25), shade(bc, -0.4)), 1.6);
    rr(g, -14, -20, 28, 5, 2);
    fillOut(g, shade(bc, 0.1), 1.3);
    if (w === 4) {
      /* arcane orb floating over the pedestal */
      const y = -34 + (open ? -2 : 0);
      glow(g, 0, y, 18, charge ? '#ff5aa8' : '#c88aff', 0.7);
      circle(g, 0, y, 10);
      fillOut(g, ballGrad(g, 0, y, 10, charge ? '#ff7ac8' : '#a87aff'), 1.6);
      ellipse(g, 0, y, 14, 4, 0.3);
      g.lineWidth = 1.4;
      g.strokeStyle = '#ffe08a';
      g.stroke();
      eye(g, 2, y, 3, st, 0.4);
      return;
    }
    /* a barrel facing right with a muzzle glow */
    const by = -30;
    rr(g, -2, by - 6, 22, 12, 4);
    const barrelC = w === 1 ? '#5a6ab8' : w === 2 ? '#8aa0c0' : '#4a3028';
    fillOut(g, vgrad(g, by - 6, by + 6, shade(barrelC, 0.35), shade(barrelC, -0.4)), 1.5);
    rr(g, 17, by - 7.5, 6, 15, 2);
    fillOut(g, shade(barrelC, -0.2), 1.3);
    if (charge || open)
      glow(g, 23, by, 10, w === 3 ? '#ff7a1a' : w === 2 ? '#bff0ff' : '#7ae8ff', charge ? 0.95 : 0.5);
    circle(g, -2, by, 11);
    fillOut(g, ballGrad(g, -2, by, 11, w === 1 ? '#5a7ae0' : w === 2 ? '#f0f6ff' : '#6a4a3a'), 1.7);
    if (w === 1) {
      g.beginPath();
      g.moveTo(-6, by - 9); g.lineTo(-2, by - 20); g.lineTo(2, by - 9);
      g.closePath();
      fillOut(g, '#9af0ff', 1.2);
      glow(g, -2, by - 14, 8, '#7ae8ff', 0.5);
    } else if (w === 2) {
      rr(g, -12, by - 13, 20, 4, 2);
      fillOut(g, '#ffffff', 1);
    } else {
      g.beginPath();
      g.moveTo(-8, by - 4); g.lineTo(-3, by + 2); g.lineTo(2, by - 5);
      g.lineWidth = 1.6; g.strokeStyle = '#ffa020'; g.stroke();
    }
    eye(g, -1, by - 1, 3, st, 0.5);
  }

  const ENEMY_BOX = {
    walker: [64, 52, 32, 46], charger: [80, 52, 36, 46], hopper: [56, 56, 28, 50], spiky: [64, 50, 32, 44],
    flyer: [60, 50, 30, 25], diver: [64, 50, 30, 25], turret: [60, 64, 28, 58]
  };
  const PAINT = { walker: paintWalker, charger: paintCharger, hopper: paintHopper, spiky: paintSpiky, flyer: paintFlyer, diver: paintDiver, turret: paintTurret };
  const STATES = { normal: 1, windup: 1, stunned: 1, squash: 1 };

  function enemy(type, world, frame, state) {
    const t = PAINT[type] ? type : 'walker';
    const w = ((world | 0) % 5 + 5) % 5;
    const n = ENEMY_FRAMES[t];
    const f = ((frame | 0) % n + n) % n;
    const st = STATES[state] ? state : 'normal';
    const box = ENEMY_BOX[t];
    return make('enemy|' + t + '|' + w + '|' + f + '|' + st, box[0], box[1], box[2], box[3], (g) => {
      const air = t === 'flyer' || t === 'diver';
      if (!air) {
        ellipse(g, 0, 0.5, box[0] * 0.3, 2.2);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fill();
      }
      g.save();
      if (st === 'squash') {
        if (air)
          g.scale(1.15, 0.6);
        else
          g.scale(1.3, 0.42);
      }
      PAINT[t](g, w, f, st);
      g.restore();
      if (st === 'stunned')
        dizzy(g, 0, air ? -18 : -box[3] + 8, 22);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     BOSSES
     ══════════════════════════════════════════════════════════════════ */

  function crown(g, x, y, w, color) {
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.lineTo(x - w / 2, y - w * 0.4);
    g.lineTo(x - w / 4, y - w * 0.18);
    g.lineTo(x, y - w * 0.55);
    g.lineTo(x + w / 4, y - w * 0.18);
    g.lineTo(x + w / 2, y - w * 0.4);
    g.lineTo(x + w / 2, y);
    g.closePath();
    fillOut(g, vgrad(g, y - w * 0.55, y, '#fff2b0', color || '#e8a820'), 1.6);
    for (const gx of [-w / 4, 0, w / 4]) {
      circle(g, x + gx, y - w * 0.08, w * 0.06);
      fillOut(g, '#e83a5a', 0.9);
    }
  }

  function paintSlime(g, pose, f) {
    const jig = [0, 0.04, 0, -0.04][f % 4];
    let sx = 1 + jig, sy = 1 - jig;
    if (pose === 'attack') { sx = f ? 1.25 : 0.82; sy = f ? 0.78 : 1.22; }
    if (pose === 'special') { sx = 1.08; sy = 0.95; }
    if (pose === 'special')
      glow(g, 0, -60, 100, '#a8ff6a', 0.45);
    g.save();
    g.scale(sx, sy);
    g.beginPath();
    g.moveTo(-76, 0);
    g.bezierCurveTo(-82, -70, -40, -112, 0, -112);
    g.bezierCurveTo(40, -112, 82, -70, 76, 0);
    g.quadraticCurveTo(0, 8, -76, 0);
    g.closePath();
    const gr = g.createRadialGradient(-22, -80, 6, 0, -50, 100);
    gr.addColorStop(0, '#e8ffb0');
    gr.addColorStop(0.45, '#6ad84a');
    gr.addColorStop(1, '#1e6a2a');
    fillOut(g, gr, 3);
    /* swallowed treasures floating inside */
    circle(g, -30, -30, 7); g.fillStyle = 'rgba(255,215,90,0.75)'; g.fill();
    circle(g, 34, -22, 5); g.fill();
    ellipse(g, 10, -40, 9, 5, 0.4); g.fillStyle = 'rgba(30,90,40,0.35)'; g.fill();
    gloss(g, -38, -84, 18, 9, 0.55);
    gloss(g, -52, -60, 5, 4, 0.4);
    g.restore();
    crown(g, 0, -108 * sy + 6, 70);
    const st = pose === 'hurt' ? 'hurt' : pose === 'attack' || pose === 'special' ? 'windup' : 'normal';
    eye(g, -18, -62 * sy, 13, st, 0.25);
    eye(g, 22, -62 * sy, 12, st, 0.25);
    g.beginPath();
    if (pose === 'attack' || pose === 'hurt') {
      ellipse(g, 4, -30 * sy, 18, 12);
      fillOut(g, '#3a0a18', 2);
      g.fillStyle = '#ffffff';
      g.fillRect(-8, -40 * sy, 6, 6);
      g.fillRect(10, -40 * sy, 6, 6);
    } else {
      g.arc(4, -40 * sy, 18, 0.25, Math.PI - 0.25);
      g.lineWidth = 3;
      g.strokeStyle = OUT;
      g.stroke();
    }
  }

  function paintGolem(g, pose, f) {
    const bob = [0, -2, 0, 2][f % 4];
    const raise = pose === 'attack' ? (f ? 20 : -16) : pose === 'special' ? -10 : 0;
    const crys = pose === 'special' ? '#ffffff' : '#7ae8ff';
    if (pose === 'special')
      glow(g, 0, -80, 110, '#7ae8ff', 0.5);
    /* legs */
    rr(g, -42, -40, 30, 40, 8);
    fillOut(g, vgrad(g, -40, 0, '#8a8aa0', '#3a3a50'), 2.4);
    rr(g, 12, -40, 30, 40, 8);
    fillOut(g, vgrad(g, -40, 0, '#8a8aa0', '#3a3a50'), 2.4);
    /* torso of stacked boulders */
    g.save();
    g.translate(0, bob);
    ellipse(g, 0, -80, 58, 46);
    fillOut(g, ballGrad(g, 0, -80, 58, '#6a6a88'), 3);
    for (const r of [[-24, -96, 14, 10], [20, -66, 16, 11], [-18, -58, 10, 7], [30, -100, 9, 7]]) {
      ellipse(g, r[0], r[1], r[2], r[3], 0.3);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = 'rgba(20,16,40,0.5)';
      g.stroke();
    }
    /* crystal spikes out of the shoulders */
    for (const c of [[-46, -112, -0.5, 30], [-30, -124, -0.2, 36], [36, -118, 0.35, 32], [52, -104, 0.7, 24]]) {
      g.save();
      g.translate(c[0], c[1] + 18);
      g.rotate(c[2]);
      g.beginPath();
      g.moveTo(-7, 0); g.lineTo(0, -c[3]); g.lineTo(7, 0);
      g.closePath();
      fillOut(g, vgrad(g, -c[3], 0, '#e8ffff', crys === '#ffffff' ? '#bff8ff' : '#3aa8e0'), 1.6);
      g.restore();
      glow(g, c[0], c[1], 20, '#7ae8ff', 0.35);
    }
    /* a crystal heart pulsing in the chest */
    glow(g, 0, -64, 30, '#7ae8ff', pose === 'special' ? 0.9 : 0.55);
    g.beginPath();
    g.moveTo(0, -80); g.lineTo(11, -64); g.lineTo(0, -48); g.lineTo(-11, -64);
    g.closePath();
    fillOut(g, vgrad(g, -80, -48, '#ffffff', '#3ab8f0', '#9af4ff'), 2);
    /* head on the shoulders */
    rr(g, -26, -110, 52, 34, 12);
    fillOut(g, vgrad(g, -110, -76, '#7a7a9a', '#4a4a64'), 2.4);
    const st = pose === 'hurt' ? 'hurt' : 'windup';
    glow(g, -10, -94, 14, pose === 'hurt' ? '#ffffff' : '#7ae8ff', 0.8);
    glow(g, 12, -94, 14, pose === 'hurt' ? '#ffffff' : '#7ae8ff', 0.8);
    if (st === 'hurt') {
      eye(g, -10, -94, 6, 'hurt');
      eye(g, 12, -94, 6, 'hurt');
    } else {
      rr(g, -18, -98, 15, 7, 3); g.fillStyle = '#d8ffff'; g.fill();
      rr(g, 5, -98, 15, 7, 3); g.fill();
    }
    g.restore();
    /* fists */
    for (const side of [-1, 1]) {
      const fx = side * 70, fy = -48 + bob + (side > 0 ? raise * 2.2 : raise * 0.6);
      limb(g, side * 44, -96 + bob, fx, fy, 18, '#5a5a74');
      circle(g, side * 48, -96 + bob, 15);
      fillOut(g, ballGrad(g, side * 48, -96 + bob, 15, '#6a6a88'), 2.2);
      circle(g, fx, fy, 20);
      fillOut(g, ballGrad(g, fx, fy, 20, '#7a7a98'), 2.4);
      g.beginPath();
      g.moveTo(fx - 8, fy - 14); g.lineTo(fx - 3, fy - 24); g.lineTo(fx + 2, fy - 13);
      g.closePath();
      fillOut(g, '#9af0ff', 1.2);
      g.beginPath();
      g.moveTo(fx - 6, fy - 4); g.lineTo(fx + 6, fy - 2);
      g.lineWidth = 1.6; g.strokeStyle = OUT; g.stroke();
    }
  }

  function paintYeti(g, pose, f) {
    const bob = [0, -2, 0, -1][f % 4];
    const arm = pose === 'attack' ? (f ? 1.2 : -2.4) : pose === 'special' ? -2.8 : 0.3 + bob * 0.05;
    if (pose === 'special')
      glow(g, 0, -90, 100, '#bff0ff', 0.45);
    /* legs */
    for (const side of [-1, 1]) {
      ellipse(g, side * 26, -16, 20, 20);
      fillOut(g, ballGrad(g, side * 26, -16, 20, '#e8f0fa'), 2.4);
      ellipse(g, side * 26 + 6, -2, 18, 6);
      fillOut(g, '#6a7a9a', 2);
    }
    g.save();
    g.translate(0, bob);
    /* shaggy body: a big ball wreathed with fur tufts */
    ellipse(g, 0, -78, 58, 56);
    fillOut(g, ballGrad(g, 0, -78, 58, '#eef4fc'), 3);
    for (let i = 0; i < 14; ++i) {
      const a = Math.PI * 0.95 + i * Math.PI * 1.1 / 13;
      const x = Math.cos(a) * 56, y = -78 + Math.sin(a) * 54;
      g.beginPath();
      g.moveTo(x - 6, y);
      g.quadraticCurveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12, x + 6, y);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(80,100,140,0.6)';
      g.stroke();
    }
    for (let i = 0; i < 9; ++i) {
      g.beginPath();
      g.arc(-30 + (i % 3) * 30, -60 + Math.floor(i / 3) * 16, 8, 0.3, Math.PI - 0.3);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(120,140,180,0.45)';
      g.stroke();
    }
    /* blue face with horns */
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(side * 26, -118);
      g.quadraticCurveTo(side * 54, -138, side * 44, -158);
      g.quadraticCurveTo(side * 40, -134, side * 16, -126);
      g.closePath();
      fillOut(g, vgrad(g, -158, -118, '#fff4dc', '#b8a070'), 2);
    }
    ellipse(g, 4, -98, 30, 24);
    fillOut(g, ballGrad(g, 4, -98, 30, '#5a8ad8'), 2.4);
    const st = pose === 'hurt' ? 'hurt' : pose === 'attack' || pose === 'special' ? 'windup' : 'normal';
    eye(g, -6, -104, 7, st, 0.3);
    eye(g, 16, -104, 6.5, st, 0.3);
    g.beginPath();
    g.moveTo(-8, -86);
    g.quadraticCurveTo(6, -76 - (pose === 'attack' ? 6 : 0), 20, -86);
    g.closePath();
    fillOut(g, '#2a1430', 1.8);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(-4, -86); g.lineTo(-1, -80); g.lineTo(2, -86); g.fill();
    g.beginPath(); g.moveTo(12, -86); g.lineTo(15, -80); g.lineTo(18, -86); g.fill();
    g.restore();
    /* arms with fists */
    for (const side of [-1, 1]) {
      const a = side > 0 ? arm : -0.25;
      const sx = side * 52, sy = -92 + bob;
      const hx = sx + Math.sin(a) * 44 * side, hy = sy + Math.cos(a) * 44;
      limb(g, sx, sy, hx, hy, 22, '#e8f0fa');
      circle(g, hx, hy, 15);
      fillOut(g, ballGrad(g, hx, hy, 15, '#5a8ad8'), 2.2);
      if (side > 0 && pose === 'attack' && !f) {
        circle(g, hx, hy - 20, 14);
        fillOut(g, ballGrad(g, hx, hy - 20, 14, '#ffffff'), 2);
      }
    }
  }

  function paintDrake(g, pose, f) {
    const flap = pose === 'attack' ? 0.6 : [-1, -0.2, 0.8, -0.2][f % 4];
    const hover = [0, -4, -6, -3][f % 4];
    if (pose === 'special')
      glow(g, 40, -70, 90, '#ff7a1a', 0.55);
    g.save();
    g.translate(0, hover - 10);
    function wing(side) {
      g.save();
      g.translate(-6, -84);
      g.rotate(-flap * 0.6 * side + (side > 0 ? 0 : 0.2));
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-30, -60 * side);
      g.lineTo(-96, -54 * side);
      g.quadraticCurveTo(-80, -30 * side, -84, -14 * side);
      g.quadraticCurveTo(-62, -18 * side, -56, -2 * side);
      g.quadraticCurveTo(-36, -8 * side, -26, 8 * side);
      g.closePath();
      const gr = g.createLinearGradient(0, 0, -90, -50 * side);
      gr.addColorStop(0, side > 0 ? '#ff8a3a' : '#c84a1a');
      gr.addColorStop(1, side > 0 ? '#7a1a0a' : '#4a0a04');
      fillOut(g, gr, 2.4);
      g.beginPath();
      g.moveTo(-30, -60 * side); g.lineTo(-56, -2 * side);
      g.moveTo(-30, -60 * side); g.lineTo(-84, -14 * side);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(40,6,4,0.6)';
      g.stroke();
      g.restore();
    }
    wing(1);
    /* tail */
    g.beginPath();
    g.moveTo(-40, -60);
    g.quadraticCurveTo(-90, -40, -96, -8);
    g.quadraticCurveTo(-84, -30, -36, -44);
    g.closePath();
    fillOut(g, vgrad(g, -60, -8, '#c84a1a', '#6a1a0a'), 2.4);
    g.beginPath();
    g.moveTo(-96, -8); g.lineTo(-108, -2); g.lineTo(-94, 4); g.closePath();
    fillOut(g, '#ffc040', 1.6);
    /* body */
    ellipse(g, 0, -60, 46, 30, -0.15);
    fillOut(g, ballGrad(g, 0, -60, 46, '#d8501a'), 3);
    ellipse(g, 8, -50, 30, 14, -0.15);
    g.fillStyle = vgrad(g, -60, -36, '#ffd070', '#e88a2a');
    g.fill();
    for (let i = 0; i < 4; ++i) {
      g.beginPath();
      g.moveTo(-10 + i * 10, -41 + i * -1);
      g.lineTo(-6 + i * 10, -58);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(120,40,10,0.5)';
      g.stroke();
    }
    /* legs tucked */
    for (const lx of [-18, 16]) {
      limb(g, lx, -40, lx + 4, -18, 10, '#b8401a');
      for (let k = 0; k < 3; ++k)
        limb(g, lx + 4, -18, lx + 2 + k * 4, -10, 2.4, '#fff4dc');
    }
    /* neck and head */
    const hx = 56, hy = -100 + (pose === 'attack' ? 12 : 0);
    limb(g, 26, -72, hx - 10, hy + 8, 18, '#d8501a');
    for (const h of [[-6, -18], [4, -20]]) {
      g.beginPath();
      g.moveTo(hx + h[0] - 4, hy - 8); g.quadraticCurveTo(hx + h[0] - 16, hy + h[1] - 6, hx + h[0] - 22, hy + h[1]);
      g.quadraticCurveTo(hx + h[0] - 10, hy - 12, hx + h[0] + 2, hy - 8);
      fillOut(g, '#fff0c8', 1.6);
    }
    ellipse(g, hx, hy, 22, 16, 0.1);
    fillOut(g, ballGrad(g, hx, hy, 22, '#e8601a'), 2.6);
    ellipse(g, hx + 20, hy + 5, 12, 9, 0.1);
    fillOut(g, ballGrad(g, hx + 20, hy + 5, 12, '#e86a2a'), 2.2);
    circle(g, hx + 28, hy + 1, 1.8); g.fillStyle = OUT; g.fill();
    if (pose === 'attack' || pose === 'special') {
      g.beginPath();
      g.moveTo(hx + 12, hy + 10); g.lineTo(hx + 34, hy + 18); g.lineTo(hx + 12, hy + 16);
      fillOut(g, '#3a0a08', 1.6);
      glow(g, hx + 36, hy + 14, 22, '#ffb040', 0.9);
    }
    const st = pose === 'hurt' ? 'hurt' : 'windup';
    eye(g, hx + 4, hy - 4, 5.5, st, 0.4);
    wing(-1);
    g.restore();
  }

  function paintSorcerer(g, pose, f) {
    const hover = [0, -3, -5, -3][f % 4];
    const staffUp = pose === 'attack' || pose === 'special';
    glow(g, 0, -8, 60, '#c88aff', 0.35);
    g.save();
    g.translate(0, hover - 12);
    /* robe */
    g.beginPath();
    g.moveTo(-14, -112);
    g.quadraticCurveTo(-46, -50, -54, 0);
    g.quadraticCurveTo(-36, -10, -24, 2);
    g.quadraticCurveTo(-10, -8, 0, 4);
    g.quadraticCurveTo(12, -8, 24, 2);
    g.quadraticCurveTo(38, -10, 52, 0);
    g.quadraticCurveTo(42, -50, 14, -112);
    g.closePath();
    const rg = g.createLinearGradient(-50, -110, 50, 0);
    rg.addColorStop(0, '#8a5ad8');
    rg.addColorStop(0.6, '#4a2a98');
    rg.addColorStop(1, '#1e1048');
    fillOut(g, rg, 3);
    /* gold trim and runes */
    g.beginPath();
    g.moveTo(0, -100); g.lineTo(0, 2);
    g.lineWidth = 5;
    g.strokeStyle = '#ffe08a';
    g.stroke();
    for (let i = 0; i < 4; ++i) {
      star(g, -24 + (i % 2) * 48, -70 + i * 14, 4, 0.4, 4);
      g.fillStyle = 'rgba(255,224,138,0.8)';
      g.fill();
    }
    /* sleeves */
    ellipse(g, -30, -78, 12, 20, 0.5);
    fillOut(g, '#5a3aa8', 2);
    /* head: pale face, long beard, crown */
    circle(g, 2, -124, 18);
    fillOut(g, ballGrad(g, 2, -124, 18, '#e8d8f0'), 2.4);
    g.beginPath();
    g.moveTo(-14, -120);
    g.quadraticCurveTo(-8, -76, 6, -70);
    g.quadraticCurveTo(18, -84, 20, -120);
    g.quadraticCurveTo(4, -108, -14, -120);
    g.closePath();
    fillOut(g, vgrad(g, -120, -70, '#ffffff', '#b8c0e0'), 2);
    crown(g, 2, -138, 34, '#d8a020');
    const st = pose === 'hurt' ? 'hurt' : staffUp ? 'windup' : 'normal';
    eye(g, -4, -128, 4, st, 0.4);
    eye(g, 10, -128, 3.8, st, 0.4);
    /* the staff with a storm orb */
    const sx = 38, sTop = staffUp ? -170 : -150;
    limb(g, sx - 6, 0 - 6, sx, sTop + 10, 4, '#7a5a3a');
    ellipse(g, 24, -84 + (staffUp ? -16 : 0), 9, 8);
    fillOut(g, '#e8d8f0', 1.8);
    glow(g, sx, sTop, staffUp ? 40 : 26, '#5ad1ff', 0.8);
    circle(g, sx, sTop, 10);
    fillOut(g, ballGrad(g, sx, sTop, 10, '#7ae8ff'), 2);
    if (staffUp) {
      g.beginPath();
      g.moveTo(sx - 4, sTop - 10); g.lineTo(sx + 6, sTop - 26); g.lineTo(sx + 2, sTop - 18); g.lineTo(sx + 12, sTop - 34);
      g.lineWidth = 2.4;
      g.strokeStyle = '#ffffff';
      g.stroke();
    }
    g.restore();
  }

  const BOSS_PAINT = { slime: paintSlime, golem: paintGolem, yeti: paintYeti, drake: paintDrake, sorcerer: paintSorcerer };
  const BOSS_BOX = {
    slime: [200, 180, 100, 166], golem: [230, 220, 115, 206], yeti: [230, 210, 115, 196],
    drake: [250, 240, 125, 226], sorcerer: [170, 230, 85, 216]
  };

  function boss(kind, pose, frame) {
    const k = BOSS_PAINT[kind] ? kind : 'slime';
    const p = BOSS_FRAMES[pose] ? pose : 'idle';
    const n = BOSS_FRAMES[p];
    const f = ((frame | 0) % n + n) % n;
    const box = BOSS_BOX[k];
    return make('boss|' + k + '|' + p + '|' + f, box[0], box[1], box[2], box[3], (g) => {
      ellipse(g, 0, 0, box[0] * 0.34, 6);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fill();
      BOSS_PAINT[k](g, p, p === 'idle' ? f : f);
      if (p === 'hurt')
        tint(g, '#ffffff', 0.35, box[0], box[1]);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     ITEMS, BLOCKS AND PROPS
     ══════════════════════════════════════════════════════════════════ */

  function paintCoin(g, f) {
    const sw = Math.max(0.14, Math.abs(Math.cos(f * Math.PI / 8)));
    const r = 13;
    if (sw < 0.95) {
      /* the coin's rim seen edge-on */
      ellipse(g, 1.2 * (1 - sw), 0, r * sw + 2.2, r);
      g.fillStyle = '#9a6a10';
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = OUT;
      g.stroke();
    }
    ellipse(g, 0, 0, r * sw, r);
    const gr = g.createLinearGradient(-r, -r, r, r);
    gr.addColorStop(0, '#fff6b0');
    gr.addColorStop(0.4, '#ffd23a');
    gr.addColorStop(1, '#c08a10');
    fillOut(g, gr, 1.6);
    ellipse(g, 0, 0, r * sw * 0.68, r * 0.68);
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(150,100,10,0.8)';
    g.stroke();
    if (sw > 0.4) {
      g.save();
      g.scale(sw, 1);
      star(g, 0, 0, 6, 0.45);
      g.fillStyle = '#fff2a0';
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(150,100,10,0.7)';
      g.stroke();
      g.restore();
    }
    ellipse(g, -r * sw * 0.35, -r * 0.45, r * sw * 0.25, r * 0.16, -0.5);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fill();
    if (f === 1 || f === 5)
      sparkle(g, r * 0.5, -r * 0.6, 4.5, 0.95);
  }

  const GEM_COLORS = [['#ff6a8a', '#d8103a', '#600818'], ['#7affa0', '#18b84a', '#085020'], ['#8ad8ff', '#1a6ae0', '#081a60']];

  function paintGem(g, f, v) {
    const c = GEM_COLORS[((v | 0) % 3 + 3) % 3];
    const bob = Math.sin(f * TAU / 6) * 1.5;
    g.translate(0, bob);
    glow(g, 0, 0, 22, c[1], 0.35);
    /* a brilliant cut: crown and pavilion */
    g.beginPath();
    g.moveTo(-14, -5); g.lineTo(-8, -13); g.lineTo(8, -13); g.lineTo(14, -5); g.lineTo(0, 15);
    g.closePath();
    fillOut(g, vgrad(g, -13, 15, c[0], c[2], c[1]), 1.7);
    g.beginPath();
    g.moveTo(-14, -5); g.lineTo(14, -5);
    g.moveTo(-8, -13); g.lineTo(-4, -5); g.lineTo(0, 15);
    g.moveTo(8, -13); g.lineTo(4, -5); g.lineTo(0, 15);
    g.moveTo(-4, -5); g.lineTo(0, -13); g.lineTo(4, -5);
    g.lineWidth = 0.9;
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.stroke();
    g.beginPath();
    g.moveTo(-8, -13); g.lineTo(-4, -5); g.lineTo(-14, -5);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fill();
    g.beginPath();
    g.moveTo(4, -5); g.lineTo(14, -5); g.lineTo(0, 15);
    g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fill();
    /* the shimmer sweeps across the facets */
    const sx = -12 + f * 5;
    sparkle(g, sx, -9 + (f % 2) * 4, 3.5 + (f === 2 ? 2 : 0), 0.9);
  }

  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.85);
    g.bezierCurveTo(x - s * 1.2, y, x - s * 1.0, y - s * 0.9, x - s * 0.5, y - s * 0.9);
    g.bezierCurveTo(x - s * 0.15, y - s * 0.9, x, y - s * 0.6, x, y - s * 0.4);
    g.bezierCurveTo(x, y - s * 0.6, x + s * 0.15, y - s * 0.9, x + s * 0.5, y - s * 0.9);
    g.bezierCurveTo(x + s * 1.0, y - s * 0.9, x + s * 1.2, y, x, y + s * 0.85);
    g.closePath();
  }

  function paintHeart(g, f, empty) {
    const pulse = 1 + [0, 0.06, 0.1, 0.04][f % 4];
    if (!empty)
      glow(g, 0, 0, 20 * pulse, '#ff5a7a', 0.4);
    heartPath(g, 0, 1, 12 * pulse);
    if (empty) {
      fillOut(g, 'rgba(40,20,40,0.6)', 1.8);
      return;
    }
    fillOut(g, vgrad(g, -12, 12, '#ff9ab0', '#c0102e', '#ff3a5a'), 1.8);
    gloss(g, -5, -5, 3.6, 2.4, 0.7);
  }

  function paintFireFlower(g, f) {
    const sway = Math.sin(f * TAU / 4) * 0.12;
    limb(g, 0, 14, 0, 0, 3, '#3a9a2a');
    ellipse(g, -5, 9, 5, 2.2, -0.4); fillOut(g, '#4ab83a', 1);
    ellipse(g, 5, 7, 5, 2.2, 0.4); fillOut(g, '#4ab83a', 1);
    g.save();
    g.rotate(sway);
    glow(g, 0, -4, 20, '#ff7a1a', 0.5);
    for (let i = 0; i < 5; ++i) {
      const a = i * TAU / 5 - Math.PI / 2;
      ellipse(g, Math.cos(a) * 7, -4 + Math.sin(a) * 7, 5.5, 4, a);
      fillOut(g, i % 2 ? '#ff4a1a' : '#ff8a2a', 1.2);
    }
    circle(g, 0, -4, 5);
    fillOut(g, ballGrad(g, 0, -4, 5, '#ffe040'), 1.2);
    eye(g, -1.6, -5, 1.3, 'normal', 0.2);
    eye(g, 1.8, -5, 1.3, 'normal', 0.2);
    g.restore();
  }

  function paintStar(g, f) {
    const s = 1 + [0, 0.05, 0.08, 0.04][f % 4];
    glow(g, 0, 0, 26, '#ffe24a', 0.55);
    g.save();
    g.rotate(f * 0.12);
    star(g, 0, 0, 15 * s, 0.5);
    fillOut(g, vgrad(g, -15, 15, '#fffbd0', '#f0a010', '#ffd83a'), 1.8);
    g.restore();
    eye(g, -3.5, -1, 1.8, 'normal', 0.1);
    eye(g, 3.5, -1, 1.8, 'normal', 0.1);
    g.beginPath();
    g.arc(0, 2.5, 2.4, 0.2, Math.PI - 0.2);
    g.lineWidth = 1;
    g.strokeStyle = OUT;
    g.stroke();
    sparkle(g, 10, -11, 3.4, f % 2 ? 1 : 0.5);
  }

  function paintCheckpoint(g, f, raised) {
    /* stone base, carved pole, banner waving */
    rr(g, -12, -8, 24, 8, 3);
    fillOut(g, vgrad(g, -8, 0, '#a8a0b0', '#5a5468'), 1.6);
    limb(g, 0, -8, 0, -96, 3.4, '#c8a878');
    circle(g, 0, -98, 4.2);
    fillOut(g, raised ? '#ffe24a' : '#9a96a8', 1.4);
    if (raised)
      glow(g, 0, -98, 14, '#ffe24a', 0.8);
    const top = raised ? -94 : -40;
    const color = raised ? '#ff4a5a' : '#7a7488';
    g.beginPath();
    g.moveTo(2, top);
    for (let i = 0; i <= 6; ++i) {
      const x = 2 + i * 6;
      g.lineTo(x, top + Math.sin(f * TAU / 4 + i * 0.9) * 2.2 * (i / 6));
    }
    const endX = 38;
    g.lineTo(endX - 6, top + 13 + Math.sin(f * TAU / 4 + 5) * 2);
    g.lineTo(endX, top + 26 + Math.sin(f * TAU / 4 + 6) * 2.2);
    for (let i = 6; i >= 0; --i)
      g.lineTo(2 + i * 6, top + 26 + Math.sin(f * TAU / 4 + i * 0.9) * 2.2 * (i / 6));
    g.closePath();
    fillOut(g, vgrad(g, top, top + 26, shade(color, 0.3), shade(color, -0.35)), 1.6);
    star(g, 16, top + 13, 6, 0.45);
    g.fillStyle = raised ? '#fff2a0' : 'rgba(255,255,255,0.35)';
    g.fill();
  }

  const GOAL_TONE = [
    { stone: '#c8b898', glow: '#ffe24a', flag: '#e83a3a' },
    { stone: '#6a6a88', glow: '#7ae8ff', flag: '#5a8aff' },
    { stone: '#d8e4f0', glow: '#bff0ff', flag: '#4aa8ff' },
    { stone: '#4a3a34', glow: '#ff9a2a', flag: '#ffcf4a' },
    { stone: '#e8e0f8', glow: '#c88aff', flag: '#ffe08a' }
  ];

  function paintGoal(g, f, v) {
    const T = GOAL_TONE[((v | 0) % 5 + 5) % 5];
    /* an arched gate with a swirling portal and a pennant on top */
    glow(g, 0, -56, 70, T.glow, 0.45);
    g.beginPath();
    g.moveTo(-42, 0); g.lineTo(-42, -70);
    g.arc(0, -70, 42, Math.PI, 0);
    g.lineTo(42, 0); g.lineTo(28, 0); g.lineTo(28, -70);
    g.arc(0, -70, 28, 0, Math.PI, true);
    g.lineTo(-28, 0);
    g.closePath();
    fillOut(g, vgrad(g, -112, 0, shade(T.stone, 0.3), shade(T.stone, -0.4)), 2.4);
    for (let i = 0; i < 5; ++i) {
      g.beginPath();
      g.moveTo(-42, -12 - i * 14); g.lineTo(-28, -12 - i * 14);
      g.moveTo(28, -12 - i * 14); g.lineTo(42, -12 - i * 14);
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
    }
    /* portal */
    g.save();
    g.beginPath();
    g.moveTo(-28, 0); g.lineTo(-28, -70); g.arc(0, -70, 28, Math.PI, 0); g.lineTo(28, 0);
    g.closePath();
    const pg = g.createRadialGradient(0, -50, 2, 0, -50, 50);
    pg.addColorStop(0, '#ffffff');
    pg.addColorStop(0.3, T.glow);
    pg.addColorStop(1, shade(T.glow, -0.6));
    g.fillStyle = pg;
    g.fill();
    g.clip();
    for (let i = 0; i < 4; ++i) {
      g.beginPath();
      g.arc(0, -50, 8 + i * 9, f * 0.5 + i, f * 0.5 + i + 2.2);
      g.lineWidth = 2.6;
      g.strokeStyle = 'rgba(255,255,255,' + (0.5 - i * 0.08) + ')';
      g.stroke();
    }
    g.restore();
    /* keystone gem */
    g.beginPath();
    g.moveTo(0, -122); g.lineTo(8, -112); g.lineTo(0, -102); g.lineTo(-8, -112);
    g.closePath();
    fillOut(g, vgrad(g, -122, -102, '#ffffff', T.glow), 1.6);
    /* pennant */
    limb(g, 0, -122, 0, -140, 2, '#8a6a4a');
    g.beginPath();
    g.moveTo(1, -140);
    g.quadraticCurveTo(10, -138 + Math.sin(f * TAU / 6) * 3, 20, -135);
    g.quadraticCurveTo(10, -132 + Math.sin(f * TAU / 6 + 1) * 3, 1, -130);
    g.closePath();
    fillOut(g, T.flag, 1.2);
    sparkle(g, -18 + (f * 7) % 36, -40 - (f * 11) % 50, 3, 0.9);
  }

  const BLOCK_TONE = [
    { q: '#ffc83a', qd: '#b8780a', wood: '#b8783a', stone: '#8a7a6a' },
    { q: '#7ab0ff', qd: '#2a4ab0', wood: '#6a5a7a', stone: '#4a4a64' },
    { q: '#bff0ff', qd: '#4a8ac0', wood: '#8a7a6a', stone: '#9aaac0' },
    { q: '#ff9a3a', qd: '#a83a10', wood: '#4a3a34', stone: '#4a3430' },
    { q: '#e8c8ff', qd: '#7a4ac8', wood: '#c8c0e0', stone: '#a8a0c8' }
  ];

  function rivets(g, s, color) {
    for (const p of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
      circle(g, p[0], p[1], 2);
      fillOut(g, color, 0.8);
    }
  }

  function paintQBlock(g, f, v) {
    const T = BLOCK_TONE[v];
    rr(g, -23, -23, 46, 46, 6);
    fillOut(g, vgrad(g, -23, 23, shade(T.q, 0.35), T.qd, T.q), 2);
    rr(g, -19, -19, 38, 38, 4);
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.stroke();
    rivets(g, 16, shade(T.qd, -0.2));
    g.font = 'bold 30px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 4;
    g.strokeStyle = shade(T.qd, -0.5);
    g.strokeText('?', 0, 2);
    g.fillStyle = '#fff8e0';
    g.fillText('?', 0, 2);
    /* the shimmer band */
    g.save();
    rr(g, -23, -23, 46, 46, 6);
    g.clip();
    const x = -40 + f * 22;
    g.beginPath();
    g.moveTo(x, -26); g.lineTo(x + 10, -26); g.lineTo(x - 6, 26); g.lineTo(x - 16, 26);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fill();
    g.restore();
  }

  function paintUsed(g, v) {
    const T = BLOCK_TONE[v];
    rr(g, -23, -23, 46, 46, 6);
    fillOut(g, vgrad(g, -23, 23, shade(T.stone, 0.15), shade(T.stone, -0.45)), 2);
    rr(g, -18, -18, 36, 36, 4);
    g.lineWidth = 1.2;
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.stroke();
    rivets(g, 16, shade(T.stone, -0.3));
  }

  function paintCrate(g, v) {
    const T = BLOCK_TONE[v];
    const iron = v === 3 || v === 4;
    const base = T.wood;
    rr(g, -23, -23, 46, 46, 3);
    fillOut(g, vgrad(g, -23, 23, shade(base, 0.25), shade(base, -0.35)), 2);
    for (let i = -1; i <= 1; ++i) {
      g.beginPath();
      g.moveTo(-21, i * 13);
      g.lineTo(21, i * 13);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-18, -18); g.lineTo(18, 18);
    g.moveTo(18, -18); g.lineTo(-18, 18);
    g.lineWidth = 6;
    g.strokeStyle = OUT;
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = iron ? '#9aa0b8' : shade(base, 0.15);
    g.stroke();
    rr(g, -23, -23, 46, 46, 3);
    g.lineWidth = 5;
    g.strokeStyle = iron ? '#6a6a80' : shade(base, -0.25);
    g.stroke();
    rivets(g, 19, iron ? '#c8cce0' : '#d8b878');
  }

  function paintCrumble(g, f, v) {
    const T = BLOCK_TONE[v];
    rr(g, -23, -23, 46, 46, 4);
    fillOut(g, vgrad(g, -23, 23, shade(T.stone, 0.3), shade(T.stone, -0.3)), 2);
    g.beginPath();
    g.moveTo(-23, -4); g.lineTo(23, -2);
    g.moveTo(-6, -23); g.lineTo(-8, -4);
    g.moveTo(8, -2); g.lineTo(10, 23);
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.stroke();
    if (f >= 1) {
      g.beginPath();
      g.moveTo(-14, -20); g.lineTo(-4, -8); g.lineTo(-10, 4); g.lineTo(2, 14);
      g.moveTo(12, -18); g.lineTo(4, -6);
      g.lineWidth = 1.8;
      g.strokeStyle = OUT;
      g.stroke();
    }
    if (f >= 2) {
      g.beginPath();
      g.moveTo(-20, 10); g.lineTo(-8, 16); g.lineTo(-2, 22);
      g.moveTo(18, 4); g.lineTo(8, 10); g.lineTo(14, 20);
      g.moveTo(-2, -20); g.lineTo(6, -12); g.lineTo(18, -14);
      g.lineWidth = 2;
      g.strokeStyle = OUT;
      g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(-4, -8, 8, 6);
    }
    gloss(g, -12, -14, 7, 3, 0.25);
  }

  function paintGate(g, v) {
    const T = BLOCK_TONE[v];
    rr(g, -24, -24, 48, 48, 2);
    g.fillStyle = 'rgba(10,8,20,0.55)';
    g.fill();
    for (let i = 0; i < 4; ++i) {
      const x = -18 + i * 12;
      rr(g, x - 2.5, -24, 5, 46, 2);
      fillOut(g, vgrad(g, -24, 24, '#c8cce0', '#4a4a60'), 1.2);
      g.beginPath();
      g.moveTo(x - 3, 22); g.lineTo(x, 27); g.lineTo(x + 3, 22);
      fillOut(g, '#8a8aa0', 1);
    }
    for (const y of [-14, 8]) {
      rr(g, -24, y - 2.5, 48, 5, 2);
      fillOut(g, vgrad(g, y - 3, y + 3, '#a8acc0', '#3a3a50'), 1.2);
    }
    rivets(g, 18, T.q);
  }

  function paintSpring(g, v) {
    const comp = v === 1;
    const h = comp ? 8 : 20;
    rr(g, -20, 16, 40, 8, 3);
    fillOut(g, vgrad(g, 16, 24, '#8a8aa0', '#3a3a50'), 1.6);
    const n = 4;
    for (let i = 0; i < n; ++i) {
      const y = 16 - (i + 0.5) * h / n;
      ellipse(g, 0, y, 13, comp ? 1.4 : 2.6);
      g.lineWidth = 3.4;
      g.strokeStyle = OUT;
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = '#e0e4f0';
      g.stroke();
    }
    const pad = 16 - h - 6;
    rr(g, -22, pad, 44, 8, 4);
    fillOut(g, vgrad(g, pad, pad + 8, '#ff7a7a', '#b81a2a'), 1.6);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(-16, pad + 1.5, 26, 2);
  }

  function paintPlatform(g, v) {
    const T = BLOCK_TONE[v];
    const base = [T.wood, '#5a5a78', '#c8d8e8', '#4a3a34', '#e8e0f8'][v];
    rr(g, 2, 4, 140, 20, 6);
    fillOut(g, vgrad(g, 4, 24, shade(base, 0.25), shade(base, -0.4)), 2);
    rr(g, 2, 4, 140, 6, 3);
    g.fillStyle = v === 0 ? '#6ad04a' : v === 2 ? '#ffffff' : v === 3 ? '#ff8a2a' : v === 4 ? '#ffe08a' : '#7ae8ff';
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = OUT;
    g.stroke();
    for (let i = 1; i < 6; ++i) {
      g.beginPath();
      g.moveTo(2 + i * 23.3, 11);
      g.lineTo(2 + i * 23.3, 22);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.stroke();
    }
    for (const x of [14, 130]) {
      circle(g, x, 16, 3.4);
      fillOut(g, '#d8dce8', 1);
    }
    if (v === 3)
      glow(g, 72, 26, 30, '#ff7a1a', 0.35);
    if (v === 4)
      glow(g, 72, 26, 30, '#c88aff', 0.35);
  }

  function paintFireball(g, f) {
    g.rotate(f * Math.PI / 2);
    glow(g, 0, 0, 15, '#ff9a2a', 0.85);
    circle(g, 0, 0, 8.5);
    const gr = g.createRadialGradient(-2, -2, 0, 0, 0, 8.5);
    gr.addColorStop(0, '#ffffe0');
    gr.addColorStop(0.4, '#ffd040');
    gr.addColorStop(1, '#ff5a1a');
    g.fillStyle = gr;
    g.fill();
    for (let i = 0; i < 3; ++i) {
      const a = i * TAU / 3;
      g.beginPath();
      g.moveTo(Math.cos(a) * 7.5, Math.sin(a) * 7.5);
      g.quadraticCurveTo(Math.cos(a + 0.5) * 14, Math.sin(a + 0.5) * 14, Math.cos(a + 0.9) * 8.5, Math.sin(a + 0.9) * 8.5);
      g.fillStyle = 'rgba(255,140,40,0.85)';
      g.fill();
    }
  }

  const SHOT_TONE = ['#ff5a8a', '#7ae8ff', '#bff0ff', '#ff8a2a', '#c88aff'];

  function paintShot(g, f, v) {
    const c = SHOT_TONE[v];
    glow(g, 0, 0, 10, c, 0.8);
    circle(g, 0, 0, 5 + (f % 2) * 0.6);
    fillOut(g, ballGrad(g, 0, 0, 5, c), 1.3);
    circle(g, -1.5, -1.5, 1.6);
    g.fillStyle = '#ffffff';
    g.fill();
  }

  function paintBossShot(g, f, v) {
    if (v === 0) {
      ellipse(g, 0, 2, 13, 11 - (f % 2) * 2);
      fillOut(g, ballGrad(g, 0, 2, 13, '#6ad84a'), 1.8);
      gloss(g, -4, -3, 4, 2.4, 0.6);
      eye(g, 3, 0, 2.4, 'windup', 0.3);
    } else if (v === 1) {
      g.rotate(f * 0.8);
      glow(g, 0, 0, 16, '#7ae8ff', 0.6);
      g.beginPath();
      g.moveTo(0, -14); g.lineTo(7, 0); g.lineTo(0, 14); g.lineTo(-7, 0);
      g.closePath();
      fillOut(g, vgrad(g, -14, 14, '#ffffff', '#3aa8e0'), 1.6);
    } else if (v === 2) {
      circle(g, 0, 0, 12);
      fillOut(g, ballGrad(g, 0, 0, 12, '#ffffff'), 1.8);
      for (let i = 0; i < 4; ++i) {
        circle(g, Math.cos(i * 1.7 + f) * 6, Math.sin(i * 1.7 + f) * 6, 1.6);
        g.fillStyle = '#c8d8f0';
        g.fill();
      }
    } else if (v === 3) {
      glow(g, 0, 0, 18, '#ff7a1a', 0.85);
      g.beginPath();
      g.moveTo(14, 0);
      g.quadraticCurveTo(0, -10, -16, -4 + (f % 2) * 3);
      g.quadraticCurveTo(-8, 0, -16, 5 - (f % 2) * 3);
      g.quadraticCurveTo(0, 10, 14, 0);
      fillOut(g, vgrad(g, -10, 10, '#ffe080', '#e83a10'), 1.6);
      circle(g, 6, 0, 4); g.fillStyle = '#ffffe8'; g.fill();
    } else {
      glow(g, 0, 0, 18, '#5ad1ff', 0.8);
      circle(g, 0, 0, 9);
      fillOut(g, ballGrad(g, 0, 0, 9, '#a87aff'), 1.6);
      g.beginPath();
      g.moveTo(-6, -8 + f); g.lineTo(-1, -1); g.lineTo(-4, 1); g.lineTo(3, 9 - f);
      g.lineWidth = 1.6;
      g.strokeStyle = '#ffffff';
      g.stroke();
    }
  }

  function paintShield(g) {
    circle(g, 0, 0, 33);
    const gr = g.createRadialGradient(-10, -12, 4, 0, 0, 34);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.7, 'rgba(120,220,255,0.12)');
    gr.addColorStop(1, 'rgba(120,220,255,0.5)');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(190,240,255,0.85)';
    g.stroke();
    ellipse(g, -12, -16, 9, 4.5, -0.6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fill();
    g.beginPath();
    g.arc(0, 0, 28, 0.4, 1.4);
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.stroke();
  }

  function paintArrow(g) {
    glow(g, 0, 0, 16, '#7affc8', 0.5);
    g.beginPath();
    g.moveTo(13, 0); g.lineTo(-3, -10); g.lineTo(-1, -4); g.lineTo(-12, -4);
    g.lineTo(-12, 4); g.lineTo(-1, 4); g.lineTo(-3, 10);
    g.closePath();
    fillOut(g, vgrad(g, -10, 10, '#c8ffe8', '#18b86a'), 1.6);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillRect(-10, -3, 12, 1.4);
  }

  const ITEM_DEF = {
    coin: [34, 34, 17, 17, 8, 1],
    gem: [48, 48, 24, 24, 6, 3],
    heart: [44, 44, 22, 22, 4, 1],
    fire: [44, 44, 22, 22, 4, 1],
    star: [56, 56, 28, 28, 4, 1],
    checkpoint: [64, 112, 20, 106, 4, 2],
    goal: [150, 160, 75, 154, 6, 5],
    qblock: [52, 52, 26, 26, 4, 5],
    used: [52, 52, 26, 26, 1, 5],
    crate: [52, 52, 26, 26, 1, 5],
    crumble: [52, 52, 26, 26, 3, 5],
    gate: [52, 56, 26, 26, 1, 5],
    spring: [52, 52, 26, 26, 1, 2],
    platform: [146, 30, 0, 4, 1, 5],
    fireball: [32, 32, 16, 16, 4, 1],
    shot: [24, 24, 12, 12, 4, 5],
    bossShot: [40, 40, 20, 20, 4, 5],
    shield: [72, 72, 36, 36, 1, 1],
    arrow: [36, 36, 18, 18, 1, 1]
  };

  function item(kind, frame, variant) {
    const k = ITEM_DEF[kind] ? kind : 'coin';
    const d = ITEM_DEF[k];
    const f = ((frame | 0) % d[4] + d[4]) % d[4];
    const v = ((variant | 0) % d[5] + d[5]) % d[5];
    return make('item|' + k + '|' + f + '|' + v, d[0], d[1], d[2], d[3], (g) => {
      switch (k) {
        case 'coin': paintCoin(g, f); break;
        case 'gem': paintGem(g, f, v); break;
        case 'heart': paintHeart(g, f, false); break;
        case 'fire': paintFireFlower(g, f); break;
        case 'star': paintStar(g, f); break;
        case 'checkpoint': paintCheckpoint(g, f, v === 1); break;
        case 'goal': paintGoal(g, f, v); break;
        case 'qblock': paintQBlock(g, f, v); break;
        case 'used': paintUsed(g, v); break;
        case 'crate': paintCrate(g, v); break;
        case 'crumble': paintCrumble(g, f, v); break;
        case 'gate': paintGate(g, v); break;
        case 'spring': paintSpring(g, v); break;
        case 'platform': paintPlatform(g, v); break;
        case 'fireball': paintFireball(g, f); break;
        case 'shot': paintShot(g, f, v); break;
        case 'bossShot': paintBossShot(g, f, v); break;
        case 'shield': paintShield(g); break;
        case 'arrow': paintArrow(g); break;
        default: break;
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     UI ICONS (painted in a 32-unit box, scaled to the requested size)
     ══════════════════════════════════════════════════════════════════ */

  const ICONS = {
    boot(g, c) {
      g.beginPath();
      g.moveTo(-6, -13); g.lineTo(5, -13); g.lineTo(5, 2); g.lineTo(13, 5); g.quadraticCurveTo(15, 12, 9, 12);
      g.lineTo(-8, 12); g.lineTo(-8, -2);
      g.closePath();
      fillOut(g, vgrad(g, -13, 12, shade(c, 0.35), shade(c, -0.35)), 1.8);
      rr(g, -8, -15, 15, 4, 2); fillOut(g, shade(c, 0.5), 1.2);
      g.beginPath();
      g.moveTo(-13, -4); g.lineTo(-9, -6); g.moveTo(-14, 2); g.lineTo(-9, 1); g.moveTo(-13, 8); g.lineTo(-9, 7);
      g.lineWidth = 1.6; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke();
    },
    heart(g, c) {
      heartPath(g, 0, 1, 13);
      fillOut(g, vgrad(g, -13, 13, shade(c, 0.45), shade(c, -0.4), c), 1.8);
      gloss(g, -5, -5, 4, 2.6, 0.7);
    },
    heartEmpty(g) {
      heartPath(g, 0, 1, 13);
      fillOut(g, 'rgba(30,20,40,0.65)', 1.8);
      heartPath(g, 0, 1, 9.5);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.stroke();
    },
    coin(g) { paintCoin(g, 0); },
    gem(g, c) {
      const idx = c === '#7affa0' || c === 'emerald' ? 1 : c === '#8ad8ff' || c === 'sapphire' ? 2 : 0;
      g.save();
      g.scale(0.95, 0.95);
      paintGem(g, 2, idx);
      g.restore();
    },
    flame(g, c) {
      g.beginPath();
      g.moveTo(0, -15);
      g.bezierCurveTo(8, -6, 13, 0, 11, 6);
      g.bezierCurveTo(9, 13, -9, 13, -11, 6);
      g.bezierCurveTo(-12, 0, -6, -3, -4, -9);
      g.bezierCurveTo(-2, -4, 0, -4, 0, -15);
      g.closePath();
      fillOut(g, vgrad(g, -15, 13, '#ffe080', shade(c, -0.3), c), 1.8);
      g.beginPath();
      g.moveTo(0, -2);
      g.bezierCurveTo(5, 3, 6, 6, 4, 9);
      g.bezierCurveTo(1, 11, -4, 10, -5, 7);
      g.bezierCurveTo(-5, 3, -1, 2, 0, -2);
      g.fillStyle = '#fff6c8';
      g.fill();
    },
    star(g, c) {
      star(g, 0, 1, 14.5, 0.48);
      fillOut(g, vgrad(g, -14, 14, shade(c, 0.6), shade(c, -0.35), c), 1.8);
      gloss(g, -4, -4, 3.5, 2, 0.6);
    },
    clock(g, c) {
      circle(g, 0, 1, 13);
      fillOut(g, ballGrad(g, 0, 1, 13, c), 1.8);
      circle(g, 0, 1, 9.5);
      g.fillStyle = '#fbf6e8';
      g.fill();
      g.beginPath();
      g.moveTo(0, 1); g.lineTo(0, -6); g.moveTo(0, 1); g.lineTo(5, 3);
      g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke();
      rr(g, -3, -15, 6, 4, 1.5); fillOut(g, c, 1.2);
    },
    skull(g, c) {
      g.beginPath();
      g.arc(0, -2, 12, Math.PI * 0.9, Math.PI * 2.1);
      g.lineTo(7, 9); g.lineTo(-7, 9);
      g.closePath();
      fillOut(g, vgrad(g, -14, 10, '#ffffff', shade(c, -0.2)), 1.8);
      ellipse(g, -4.5, -1, 3.2, 3.6); g.fillStyle = OUT; g.fill();
      ellipse(g, 4.5, -1, 3.2, 3.6); g.fill();
      g.beginPath(); g.moveTo(0, 3); g.lineTo(-1.6, 6); g.lineTo(1.6, 6); g.fill();
      g.beginPath();
      g.moveTo(-3, 9); g.lineTo(-3, 13); g.moveTo(0, 9); g.lineTo(0, 13); g.moveTo(3, 9); g.lineTo(3, 13);
      g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke();
    },
    lock(g, c) {
      g.beginPath();
      g.arc(0, -4, 7, Math.PI, 0);
      g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
      g.lineWidth = 3.5; g.strokeStyle = '#c8cce0'; g.stroke();
      rr(g, -11, -4, 22, 17, 4);
      fillOut(g, vgrad(g, -4, 13, shade(c, 0.4), shade(c, -0.35)), 1.8);
      circle(g, 0, 3, 2.6); g.fillStyle = OUT; g.fill();
      g.fillRect(-1, 3, 2, 6);
    },
    shield(g, c) {
      g.beginPath();
      g.moveTo(0, -14); g.lineTo(12, -9); g.quadraticCurveTo(12, 8, 0, 15); g.quadraticCurveTo(-12, 8, -12, -9);
      g.closePath();
      fillOut(g, vgrad(g, -14, 15, shade(c, 0.45), shade(c, -0.4), c), 1.8);
      g.beginPath();
      g.moveTo(0, -10); g.lineTo(0, 11);
      g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.stroke();
    },
    magnet(g, c) {
      g.beginPath();
      g.arc(0, -1, 10, Math.PI, 0);
      g.lineTo(10, 10); g.lineTo(4, 10); g.lineTo(4, -1);
      g.arc(0, -1, 4, 0, Math.PI, true);
      g.lineTo(-4, 10); g.lineTo(-10, 10);
      g.closePath();
      fillOut(g, vgrad(g, -11, 10, shade(c, 0.4), shade(c, -0.35)), 1.8);
      g.fillStyle = '#e8ecf4';
      g.fillRect(-10, 6, 6, 4);
      g.fillRect(4, 6, 6, 4);
    },
    trophy(g, c) {
      g.beginPath();
      g.moveTo(-10, -13); g.lineTo(10, -13); g.quadraticCurveTo(10, 4, 0, 5); g.quadraticCurveTo(-10, 4, -10, -13);
      g.closePath();
      fillOut(g, vgrad(g, -13, 5, shade(c, 0.55), shade(c, -0.35), c), 1.8);
      g.beginPath();
      g.arc(-11, -6, 5, Math.PI * 0.5, Math.PI * 1.5);
      g.moveTo(11, -11);
      g.arc(11, -6, 5, -Math.PI * 0.5, Math.PI * 0.5);
      g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
      rr(g, -2.5, 5, 5, 5, 1); fillOut(g, shade(c, -0.2), 1.2);
      rr(g, -8, 10, 16, 5, 2); fillOut(g, shade(c, -0.1), 1.4);
      gloss(g, -5, -8, 2.6, 4, 0.6);
    },
    flag(g, c) {
      limb(g, -9, 14, -9, -14, 2.4, '#c8a878');
      g.beginPath();
      g.moveTo(-8, -13); g.quadraticCurveTo(0, -16, 12, -10); g.quadraticCurveTo(4, -5, 12, 1); g.quadraticCurveTo(0, -3, -8, 0);
      g.closePath();
      fillOut(g, vgrad(g, -14, 1, shade(c, 0.35), shade(c, -0.3)), 1.6);
    },
    bolt(g, c) {
      g.beginPath();
      g.moveTo(6, -15); g.lineTo(-11, 3); g.lineTo(-1, 3); g.lineTo(-6, 15); g.lineTo(11, -4); g.lineTo(2, -4);
      g.closePath();
      fillOut(g, vgrad(g, -15, 15, shade(c, 0.6), shade(c, -0.3)), 1.8);
    },
    map(g, c) {
      g.beginPath();
      g.moveTo(-13, -10); g.lineTo(-5, -13); g.lineTo(5, -10); g.lineTo(13, -13); g.lineTo(13, 10); g.lineTo(5, 13); g.lineTo(-5, 10); g.lineTo(-13, 13);
      g.closePath();
      fillOut(g, vgrad(g, -13, 13, '#fbf0d0', '#d8c090'), 1.6);
      g.beginPath();
      g.moveTo(-5, -13); g.lineTo(-5, 10); g.moveTo(5, -10); g.lineTo(5, 13);
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke();
      g.beginPath();
      g.moveTo(-10, 6); g.quadraticCurveTo(-4, -4, 2, 2); g.quadraticCurveTo(6, 6, 8, -4);
      g.setLineDash([2, 2]);
      g.lineWidth = 1.4; g.strokeStyle = c; g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.moveTo(6, -7); g.lineTo(10, -3); g.moveTo(10, -7); g.lineTo(6, -3);
      g.lineWidth = 1.8; g.strokeStyle = '#e83a3a'; g.stroke();
    }
  };

  function icon(name, color, size) {
    const n = ICONS[name] ? name : 'star';
    const c = color || '#ffd75a';
    const s = Math.max(4, size || 24);
    return make('icon|' + n + '|' + c + '|' + s, s, s, s / 2, s / 2, (g) => {
      g.scale(s / 34, s / 34);
      ICONS[n](g, c);
    });
  }

  function cacheSize() {
    return built;
  }

  SZ.PlatformerSprites = Object.freeze({
    SCALE, HERO_FRAMES, ENEMY_FRAMES, BOSS_FRAMES, ITEM_FRAMES, BOSS_KINDS,
    ICON_NAMES: Object.freeze(Object.keys(ICONS)),
    ITEM_KINDS: Object.freeze(Object.keys(ITEM_DEF)),
    hero, enemy, boss, item, icon, cacheSize
  });
})();
