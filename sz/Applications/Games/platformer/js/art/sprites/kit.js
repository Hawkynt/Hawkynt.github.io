;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.spriteKit || (NS.spriteKit = {});

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
   *
   * The sprites are split by subject: kit.js (this file: frame tables, the sprite cache and the
   * paint helpers, shared through SZ.Platformer.spriteKit), hero.js, foes.js, bosses.js, items.js
   * and icons.js, which publishes SZ.PlatformerSprites.
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

  function cacheSize() {
    return built;
  }

  Object.assign(Kit, { SCALE, TAU, OUT, HERO_FRAMES, ENEMY_FRAMES, BOSS_FRAMES, ITEM_FRAMES, BOSS_KINDS, make, shade, rgba, vgrad, ballGrad, ellipse, circle, rr, fillOut, body, gloss, limb, glow, star, sparkle, eye, dizzy, tint, cacheSize });
})();
