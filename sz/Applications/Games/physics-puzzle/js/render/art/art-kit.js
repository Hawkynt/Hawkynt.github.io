;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});
  const A = NS.art || (NS.art = {});

  /*
   * The sprite kit under the field art: colour helpers, a seeded random for
   * stable textures, rounded rectangles, the sprite cache (every sprite is
   * painted once at the current device scale and blitted afterwards), blits
   * and additive glows. Owns the device scale and the sprite cache; the
   * other art files share these through SZ.PhysicsPuzzle.art.
   */

  const TWO_PI = Math.PI * 2;
  const DEG = Math.PI / 180;

  let scale = 1;
  let cache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function parse(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    const c = parse(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function shade(hex, f) {
    const c = parse(hex);
    const k = (v) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
    return '#' + c.map(v => k(v).toString(16).padStart(2, '0')).join('');
  }

  function mulberry(seed) {
    let s = seed >>> 0;
    return function() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashKey(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; ++i) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function roundRect(g, x, y, w, h, r) {
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

  /*
   * A sprite: canvas c painted at `scale` device px per unit, drawn w x h
   * units with its anchor (ax, ay) on the body origin.
   */
  function sprite(key, w, h, pad, paint) {
    const k = key + '@' + scale;
    let s = cache.get(k);
    if (s)
      return s;
    if (cache.size > 900)
      cache.clear();
    const W = w + pad * 2, H = h + pad * 2;
    const c = makeCanvas(W * scale, H * scale);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(pad, pad);
    paint(g, w, h, mulberry(hashKey(key)));
    s = { c: c, w: W, h: H, ax: W / 2, ay: H / 2 };
    cache.set(k, s);
    return s;
  }

  function blit(ctx, s, x, y, a) {
    if (a) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
      ctx.restore();
    } else {
      ctx.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h);
    }
  }

  /* soft round glow, additive-friendly */
  function glowSprite(color) {
    return sprite('glow' + color, 64, 64, 0, (g) => {
      const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, rgba(color, 0.85));
      rg.addColorStop(0.35, rgba(color, 0.35));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
    });
  }

  function drawGlow(ctx, x, y, size, color, alpha) {
    const s = glowSprite(color);
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * (alpha === undefined ? 1 : alpha);
    ctx.drawImage(s.c, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = pa;
    ctx.globalCompositeOperation = prev;
  }

  function setScale(s) {
    const q = Math.max(1, Math.min(3, Math.round(s * 4) / 4));
    if (q !== scale) {
      scale = q;
      cache = new Map();
    }
  }

  function getScale() {
    return scale;
  }

  function cacheSize() {
    return cache.size;
  }

  A.TWO_PI = TWO_PI; A.DEG = DEG; A.makeCanvas = makeCanvas; A.parse = parse; A.rgba = rgba; A.shade = shade;
  A.mulberry = mulberry; A.hashKey = hashKey; A.roundRect = roundRect; A.sprite = sprite; A.blit = blit; A.glowSprite = glowSprite;
  A.drawGlow = drawGlow; A.setScale = setScale; A.getScale = getScale; A.cacheSize = cacheSize;
})();
