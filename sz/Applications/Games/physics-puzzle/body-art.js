;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Procedural art for everything that lives in a Physics Puzzle field:
   * textured fixtures (wood planks, stone blocks, riveted steel, frosted
   * ice, glass, per-world ground with grass, floorboards, grating, basalt or
   * deck plates), crates, TNT, gadgets (springs, bumpers, conveyors, fans,
   * magnets, paddles, pendulums, portals, water, lava), the launcher, the
   * ball skins, targets and stars, and the inventory icons.
   *
   * Every body is painted once into a sprite at the current device scale
   * (setScale) and blitted afterwards, rotated for moving bodies. Only the
   * moving details are drawn per frame (fan blades, belt treads, portal
   * swirls, water surfaces, glows) and those are cached sprites too.
   * No shadow blur anywhere.
   *
   *   Art.setScale(2);
   *   Art.drawBody(ctx, body, world, t);
   *   Art.drawZone(ctx, zone, world, t);
   *   Art.drawLauncher(ctx, x, y, angleDeg, power, t);
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

  /* ══════════════════════════════════════════════════════════════════
     MATERIAL FILLS (painted inside a clip of the body's shape)
     ══════════════════════════════════════════════════════════════════ */

  const WOOD = [
    { base: '#b8783e', dark: '#6a3e1a', light: '#e0a868' },   // workshop oak
    { base: '#a8743a', dark: '#5a3a18', light: '#d8a060' },   // garden cedar
    { base: '#8a8a90', dark: '#3a3a44', light: '#c8c8d0' },
    { base: '#7a4a2a', dark: '#3a2010', light: '#b07040' },
    { base: '#9a9aa8', dark: '#40404c', light: '#d0d0dc' }
  ];

  const METAL = [
    { base: '#8a96a8', dark: '#3a4250', light: '#dce4f0', rivet: '#c8d0dc' },   // workshop steel
    { base: '#7a8a7a', dark: '#2e3a30', light: '#c8d8c0', rivet: '#c8d0b8' },   // garden green iron
    { base: '#8ab0cc', dark: '#2a4258', light: '#e8f6ff', rivet: '#dceeff' },   // lab blue steel
    { base: '#4a4044', dark: '#16100e', light: '#9a8a84', rivet: '#c8a888' },   // forge black iron
    { base: '#b8c0d0', dark: '#4a5266', light: '#ffffff', rivet: '#e8ecf4' }    // station white panel
  ];

  function woodFill(g, x, y, w, h, world, rand, vertical) {
    const p = WOOD[world] || WOOD[0];
    g.fillStyle = p.base;
    g.fillRect(x, y, w, h);
    /* boards */
    const along = vertical ? h : w, across = vertical ? w : h;
    const boardW = across > 40 ? 18 + Math.floor(rand() * 6) : across;
    for (let b = 0; b < across; b += boardW) {
      const tint = (rand() - 0.5) * 0.18;
      g.fillStyle = shade(p.base, tint);
      if (vertical)
        g.fillRect(x + b, y, Math.min(boardW, across - b), h);
      else
        g.fillRect(x, y + b, w, Math.min(boardW, across - b));
      /* grain */
      g.strokeStyle = rgba(p.dark, 0.28);
      g.lineWidth = 0.8;
      const lines = Math.max(2, Math.floor(Math.min(boardW, across - b) / 3));
      for (let l = 0; l < lines; ++l) {
        const off = b + (l + 0.5) * Math.min(boardW, across - b) / lines;
        const amp = 0.6 + rand() * 1.4, freq = 0.02 + rand() * 0.04, ph = rand() * 6;
        g.beginPath();
        for (let t = 0; t <= along; t += 6) {
          const d = off + Math.sin(t * freq + ph) * amp;
          if (vertical) {
            if (t === 0) g.moveTo(x + d, y + t); else g.lineTo(x + d, y + t);
          } else {
            if (t === 0) g.moveTo(x + t, y + d); else g.lineTo(x + t, y + d);
          }
        }
        g.stroke();
      }
      /* a knot now and then */
      if (along > 60 && rand() < 0.5) {
        const kt = rand() * along, kc = b + Math.min(boardW, across - b) * (0.3 + rand() * 0.4);
        const kx = vertical ? x + kc : x + kt, ky = vertical ? y + kt : y + kc;
        g.fillStyle = rgba(p.dark, 0.5);
        g.beginPath();
        g.ellipse(kx, ky, vertical ? 2.2 : 4, vertical ? 4 : 2.2, 0, 0, TWO_PI);
        g.fill();
      }
      /* the seam between boards */
      if (b > 0) {
        g.fillStyle = rgba(p.dark, 0.55);
        if (vertical)
          g.fillRect(x + b - 0.6, y, 1.2, h);
        else
          g.fillRect(x, y + b - 0.6, w, 1.2);
      }
    }
    /* end joints along long boards */
    if (along > 160) {
      g.fillStyle = rgba(p.dark, 0.5);
      for (let b = 0; b < across; b += boardW) {
        const j = 60 + rand() * (along - 120);
        if (vertical)
          g.fillRect(x + b, y + j, Math.min(boardW, across - b), 1.2);
        else
          g.fillRect(x + j, y + b, 1.2, Math.min(boardW, across - b));
      }
    }
  }

  function stoneFill(g, x, y, w, h, world, rand) {
    const base = world === 3 ? '#4a3c38' : world === 1 ? '#8a7a64' : '#7a7470';
    g.fillStyle = shade(base, -0.35);
    g.fillRect(x, y, w, h);
    const bh = 22;
    for (let row = 0, yy = y; yy < y + h; ++row, yy += bh) {
      let xx = x - (row % 2 ? 18 : 0);
      while (xx < x + w) {
        const bw = 30 + rand() * 26;
        const tint = (rand() - 0.5) * 0.2;
        g.fillStyle = shade(base, tint);
        roundRect(g, xx + 1.2, yy + 1.2, bw - 2.4, bh - 2.4, 4);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(xx + 3, yy + 2, bw - 8, 2);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(xx + 3, yy + bh - 5, bw - 6, 2.4);
        /* speckles */
        for (let k = 0; k < 4; ++k) {
          g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
          g.fillRect(xx + rand() * bw, yy + 3 + rand() * (bh - 6), 1.6, 1.6);
        }
        xx += bw;
      }
    }
    if (world === 3) {
      /* glowing cracks in the forge's basalt */
      g.strokeStyle = 'rgba(255,120,40,0.55)';
      g.lineWidth = 1.2;
      for (let k = 0; k < Math.max(1, w / 90); ++k) {
        let cx = x + rand() * w, cy = y + 6 + rand() * Math.min(h - 6, 60);
        g.beginPath();
        g.moveTo(cx, cy);
        for (let s = 0; s < 4; ++s) {
          cx += (rand() - 0.5) * 22;
          cy += 4 + rand() * 8;
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
    }
  }

  function metalFill(g, x, y, w, h, world, rand) {
    const p = METAL[world] || METAL[0];
    const lg = g.createLinearGradient(x, y, x, y + h);
    lg.addColorStop(0, p.light);
    lg.addColorStop(0.18, p.base);
    lg.addColorStop(0.75, shade(p.base, -0.2));
    lg.addColorStop(1, p.dark);
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    /* brushed streaks */
    for (let k = 0; k < Math.min(60, (w + h) / 4); ++k) {
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
      if (w >= h)
        g.fillRect(x + rand() * w, y + rand() * h, 20 + rand() * 60, 0.8);
      else
        g.fillRect(x + rand() * w, y + rand() * h, 0.8, 20 + rand() * 60);
    }
    /* panel seams on long pieces */
    const long = Math.max(w, h);
    if (long > 120) {
      const n = Math.round(long / 110);
      g.fillStyle = rgba(p.dark, 0.6);
      for (let i = 1; i < n; ++i) {
        if (w >= h)
          g.fillRect(x + i * w / n - 0.7, y, 1.4, h);
        else
          g.fillRect(x, y + i * h / n - 0.7, w, 1.4);
      }
    }
    if (world === 4 && w > 80 && h > 18) {
      /* hazard stripes along the station's panels */
      g.save();
      g.beginPath();
      g.rect(x, y + h - 7, w, 5);
      g.clip();
      g.fillStyle = '#2a2a30';
      g.fillRect(x, y + h - 7, w, 5);
      g.fillStyle = '#ffcf3a';
      for (let sx = x - 10; sx < x + w; sx += 14) {
        g.beginPath();
        g.moveTo(sx, y + h - 2);
        g.lineTo(sx + 7, y + h - 2);
        g.lineTo(sx + 12, y + h - 7);
        g.lineTo(sx + 5, y + h - 7);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
  }

  function rivets(g, x, y, w, h, world) {
    const p = METAL[world] || METAL[0];
    const pts = [];
    if (w >= 24 && h >= 24) {
      pts.push([x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]);
    } else if (w > h) {
      for (let xx = x + 8; xx < x + w - 4; xx += 40)
        pts.push([xx, y + h / 2]);
    } else {
      for (let yy = y + 8; yy < y + h - 4; yy += 40)
        pts.push([x + w / 2, yy]);
    }
    for (const q of pts) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(q[0] + 0.6, q[1] + 0.8, 2.6, 0, TWO_PI);
      g.fill();
      const rg = g.createRadialGradient(q[0] - 0.8, q[1] - 0.8, 0, q[0], q[1], 2.6);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.5, p.rivet);
      rg.addColorStop(1, p.dark);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(q[0], q[1], 2.4, 0, TWO_PI);
      g.fill();
    }
  }

  function iceFill(g, x, y, w, h, rand) {
    const lg = g.createLinearGradient(x, y, x + w * 0.3, y + h);
    lg.addColorStop(0, 'rgba(230,250,255,0.95)');
    lg.addColorStop(0.5, 'rgba(150,215,245,0.85)');
    lg.addColorStop(1, 'rgba(90,160,210,0.9)');
    g.fillStyle = lg;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 0.9;
    for (let k = 0; k < Math.max(2, w / 40); ++k) {
      let cx = x + rand() * w, cy = y + rand() * h;
      g.beginPath();
      g.moveTo(cx, cy);
      for (let s = 0; s < 3; ++s) {
        cx += (rand() - 0.5) * 26;
        cy += (rand() - 0.5) * 12;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(x + 2, y + 1.5, w - 4, 2.2);
  }

  /* bevel: light from the top left */
  function bevel(g, x, y, w, h, strength) {
    const s = strength || 1;
    g.fillStyle = 'rgba(255,255,255,' + (0.28 * s) + ')';
    g.fillRect(x, y, w, 2);
    g.fillRect(x, y, 2, h);
    g.fillStyle = 'rgba(0,0,0,' + (0.32 * s) + ')';
    g.fillRect(x, y + h - 2.5, w, 2.5);
    g.fillRect(x + w - 2.5, y, 2.5, h);
    g.lineWidth = 1.4;
    g.strokeStyle = 'rgba(10,6,4,0.85)';
    g.strokeRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
  }

  function materialBox(g, w, h, mat, world, rand) {
    if (mat === 'wood')
      woodFill(g, 0, 0, w, h, world, rand, h > w * 1.6);
    else if (mat === 'stone')
      stoneFill(g, 0, 0, w, h, world, rand);
    else if (mat === 'ice')
      iceFill(g, 0, 0, w, h, rand);
    else
      metalFill(g, 0, 0, w, h, world, rand);
    bevel(g, 0, 0, w, h, mat === 'ice' ? 0.6 : 1);
    if (mat === 'metal')
      rivets(g, 0, 0, w, h, world);
  }

  /* ══════════════════════════════════════════════════════════════════
     GROUND: per-world slabs with a decorated top
     ══════════════════════════════════════════════════════════════════ */

  function paintGround(g, w, h, world, rand) {
    if (world === 0) {
      /* floorboards over a dark joist */
      woodFill(g, 0, 0, w, 26, 0, rand, false);
      g.fillStyle = '#3a2412';
      g.fillRect(0, 26, w, h - 26);
      for (let x = 0; x < w; x += 64) {
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x, 26, 18, h - 26);
      }
      g.fillStyle = 'rgba(255,230,180,0.35)';
      g.fillRect(0, 0, w, 2);
    } else if (world === 1) {
      /* soil with a grassy top */
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, '#6a4a2a');
      lg.addColorStop(1, '#2a1a0e');
      g.fillStyle = lg;
      g.fillRect(0, 0, w, h);
      for (let k = 0; k < w / 6; ++k) {
        g.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.2)' : 'rgba(255,220,160,0.12)';
        g.beginPath();
        g.arc(rand() * w, 10 + rand() * (h - 10), 1 + rand() * 3, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = '#3a8a2a';
      g.fillRect(0, 0, w, 7);
      for (let x = 0; x < w; x += 3) {
        const bh = 4 + rand() * 9;
        g.fillStyle = rand() < 0.5 ? '#5ab83a' : '#3e9a2c';
        g.beginPath();
        g.moveTo(x, 6);
        g.lineTo(x + 1.5 + (rand() - 0.5) * 3, 6 - bh);
        g.lineTo(x + 3, 6);
        g.closePath();
        g.fill();
      }
      g.fillStyle = 'rgba(200,255,150,0.35)';
      g.fillRect(0, 0, w, 1.5);
    } else if (world === 2) {
      /* frosted grating */
      metalFill(g, 0, 0, w, h, 2, rand);
      g.fillStyle = 'rgba(10,30,50,0.55)';
      for (let x = 6; x < w; x += 12)
        g.fillRect(x, 6, 5, 14);
      g.fillStyle = 'rgba(240,252,255,0.85)';
      for (let x = 0; x < w; x += 4)
        g.fillRect(x, 0, 4, 2 + rand() * 3);
      bevel(g, 0, 0, w, h, 0.7);
    } else if (world === 3) {
      stoneFill(g, 0, 0, w, h, 3, rand);
      g.fillStyle = 'rgba(255,140,60,0.35)';
      g.fillRect(0, 0, w, 2);
    } else {
      /* deck plates with running lights */
      metalFill(g, 0, 0, w, h, 4, rand);
      for (let x = 0; x < w; x += 80) {
        g.fillStyle = 'rgba(40,50,70,0.6)';
        g.fillRect(x, 0, 1.5, h);
        g.fillStyle = '#7ad8ff';
        g.fillRect(x + 36, 10, 8, 3);
      }
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 0, w, 2);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     BODY SPRITES
     ══════════════════════════════════════════════════════════════════ */

  function boxSize(b) {
    const p = b.poly;
    if (!p)
      return [b.r * 2, b.r * 2];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.count; ++i) {
      x0 = Math.min(x0, p.verts[i * 2]); x1 = Math.max(x1, p.verts[i * 2]);
      y0 = Math.min(y0, p.verts[i * 2 + 1]); y1 = Math.max(y1, p.verts[i * 2 + 1]);
    }
    return [x1 - x0, y1 - y0, x0, y0];
  }

  function polyPath(g, b, ox, oy) {
    const v = b.poly.verts;
    g.beginPath();
    g.moveTo(v[0] + ox, v[1] + oy);
    for (let i = 1; i < b.poly.count; ++i)
      g.lineTo(v[i * 2] + ox, v[i * 2 + 1] + oy);
    g.closePath();
  }

  function bodyKey(b, world) {
    const k = b.data && b.data.kind || 'wall';
    const sz = boxSize(b);
    return k + ':' + b.mat + ':' + world + ':' + Math.round(sz[0]) + 'x' + Math.round(sz[1]) + (b.circle ? 'c' : '') + ':' + (b.data && b.data.dir || '') + ':' + b.id % 3;
  }

  function staticSprite(b, world) {
    const kind = b.data && b.data.kind || 'wall';
    const sz = boxSize(b);
    const w = sz[0], h = sz[1];
    const pad = kind === 'ground' ? 14 : 6;
    return sprite(bodyKey(b, world), w, h, pad, (g, W, H, rand) => {
      if (kind === 'ground') {
        paintGround(g, W, H, world, rand);
        return;
      }
      if (kind === 'ramp') {
        g.save();
        polyPath(g, b, -sz[2], -sz[3]);
        g.clip();
        materialBox(g, W, H, b.mat, world, rand);
        g.restore();
        polyPath(g, b, -sz[2], -sz[3]);
        g.lineWidth = 1.6;
        g.strokeStyle = 'rgba(10,6,4,0.9)';
        g.stroke();
        /* a highlight along the slope */
        g.save();
        polyPath(g, b, -sz[2], -sz[3]);
        g.clip();
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.lineWidth = 3;
        const dir = b.data.dir;
        g.beginPath();
        if (dir > 0) { g.moveTo(1, H - 1); g.lineTo(W - 1, 1); } else { g.moveTo(1, 1); g.lineTo(W - 1, H - 1); }
        g.stroke();
        g.restore();
        return;
      }
      if (kind === 'peg') {
        const r = W / 2;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath();
        g.arc(r + 1.5, r + 2, r, 0, TWO_PI);
        g.fill();
        const rg = g.createRadialGradient(r * 0.65, r * 0.6, 0, r, r, r);
        if (world === 1) {
          rg.addColorStop(0, '#e8d8a0');
          rg.addColorStop(0.6, '#a08040');
          rg.addColorStop(1, '#4a3416');
        } else {
          rg.addColorStop(0, '#ffffff');
          rg.addColorStop(0.4, METAL[world].light);
          rg.addColorStop(1, METAL[world].dark);
        }
        g.fillStyle = rg;
        g.beginPath();
        g.arc(r, r, r - 0.5, 0, TWO_PI);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 1.2;
        g.stroke();
        return;
      }
      if (kind === 'ice') {
        iceFill(g, 0, 0, W, H, rand);
        g.lineWidth = 1.2;
        g.strokeStyle = 'rgba(40,90,130,0.9)';
        g.strokeRect(0.6, 0.6, W - 1.2, H - 1.2);
        return;
      }
      materialBox(g, W, H, b.mat, world, rand);
      if (kind === 'wall' && world === 1 && b.mat === 'wood' && W > H && W > 60) {
        /* moss tufts on garden beams */
        for (let x = 4; x < W - 4; x += 7 + rand() * 10) {
          g.fillStyle = rand() < 0.5 ? '#5aa83a' : '#7ac84a';
          g.beginPath();
          g.ellipse(x, 1.5, 3 + rand() * 4, 2 + rand() * 2, 0, 0, TWO_PI);
          g.fill();
        }
      }
      if (kind === 'wall' && world === 2 && W > H) {
        g.fillStyle = 'rgba(245,252,255,0.9)';
        for (let x = 0; x < W; x += 3)
          g.fillRect(x, 0, 3, 1.5 + rand() * 2.5);
      }
    });
  }

  /* ── dynamic and gadget sprites ── */

  function crateSprite(w, h, world) {
    return sprite('crate' + w + 'x' + h + ':' + world, w, h, 4, (g, W, H, rand) => {
      woodFill(g, 0, 0, W, H, world === 3 ? 3 : 0, rand, false);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(5, 5, W - 10, H - 10);
      woodFill(g, 6, 6, W - 12, H - 12, world === 3 ? 3 : 0, rand, true);
      /* frame and cross brace */
      const p = WOOD[world === 3 ? 3 : 0];
      g.strokeStyle = p.dark;
      g.lineWidth = 6;
      g.strokeRect(3, 3, W - 6, H - 6);
      g.strokeStyle = p.light;
      g.lineWidth = 1.2;
      g.strokeRect(1.5, 1.5, W - 3, H - 3);
      g.lineWidth = 6;
      g.strokeStyle = shade(p.base, -0.15);
      g.beginPath();
      g.moveTo(6, 6);
      g.lineTo(W - 6, H - 6);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = rgba(p.dark, 0.9);
      g.stroke();
      for (const q of [[5, 5], [W - 5, 5], [5, H - 5], [W - 5, H - 5]]) {
        g.fillStyle = '#c8c0b0';
        g.beginPath();
        g.arc(q[0], q[1], 2, 0, TWO_PI);
        g.fill();
      }
      g.lineWidth = 1.4;
      g.strokeStyle = '#140a04';
      g.strokeRect(0.7, 0.7, W - 1.4, H - 1.4);
    });
  }

  function steelSprite(w, h, world) {
    return sprite('steel' + w + 'x' + h + ':' + world, w, h, 4, (g, W, H, rand) => {
      metalFill(g, 0, 0, W, H, world, rand);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.strokeRect(6, 6, W - 12, H - 12);
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      g.strokeRect(7.5, 7.5, W - 15, H - 15);
      bevel(g, 0, 0, W, H, 1);
      rivets(g, 0, 0, W, H, world);
    });
  }

  function glassSprite(w, h) {
    return sprite('glass' + w + 'x' + h, w, h, 4, (g, W, H) => {
      const lg = g.createLinearGradient(0, 0, W * 0.4, H);
      lg.addColorStop(0, 'rgba(220,250,255,0.55)');
      lg.addColorStop(0.5, 'rgba(150,220,250,0.3)');
      lg.addColorStop(1, 'rgba(110,190,240,0.45)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      g.save();
      g.beginPath();
      g.rect(0, 0, W, H);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      const long = Math.max(W, H);
      for (let k = 0; k < Math.max(1, long / 70); ++k) {
        const o = (k + 0.3) * 70;
        g.beginPath();
        if (W >= H) {
          g.moveTo(o, 0); g.lineTo(o + 10, 0); g.lineTo(o + 10 - H, H); g.lineTo(o - H, H);
        } else {
          g.moveTo(0, o); g.lineTo(0, o + 10); g.lineTo(W, o + 10 - W); g.lineTo(W, o - W);
        }
        g.closePath();
        g.fill();
      }
      g.restore();
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(230,252,255,0.95)';
      g.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
      g.lineWidth = 0.8;
      g.strokeStyle = 'rgba(40,110,160,0.8)';
      g.strokeRect(2, 2, W - 4, H - 4);
    });
  }

  function tntSprite() {
    return sprite('tnt', 44, 44, 10, (g, W, H, rand) => {
      /* sticks of dynamite in a red crate */
      g.fillStyle = '#7a1a10';
      roundRect(g, 0, 0, W, H, 4);
      g.fill();
      for (let i = 0; i < 4; ++i) {
        const x = 3 + i * 9.6;
        const lg = g.createLinearGradient(x, 0, x + 9, 0);
        lg.addColorStop(0, '#ff6a4a');
        lg.addColorStop(0.4, '#e82a1a');
        lg.addColorStop(1, '#8a120a');
        g.fillStyle = lg;
        roundRect(g, x, 3, 9, H - 6, 4);
        g.fill();
      }
      g.fillStyle = '#f0e0c0';
      g.fillRect(2, 15, W - 4, 14);
      g.strokeStyle = '#3a1a10';
      g.lineWidth = 1;
      g.strokeRect(2, 15, W - 4, 14);
      g.fillStyle = '#c81a10';
      g.font = 'bold 12px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TNT', W / 2, 22.5);
      /* fuse */
      g.strokeStyle = '#4a3a2a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(W / 2, 3);
      g.quadraticCurveTo(W / 2 + 8, -6, W / 2 + 4, -9);
      g.stroke();
      g.lineWidth = 1.4;
      g.strokeStyle = '#1a0806';
      roundRect(g, 0.7, 0.7, W - 1.4, H - 1.4, 4);
      g.stroke();
    });
  }

  function boulderSprite(r) {
    return sprite('boulder' + r, r * 2, r * 2, 3, (g, W, H, rand) => {
      g.beginPath();
      for (let k = 0; k < 14; ++k) {
        const a = k / 14 * TWO_PI, rr = r * (0.92 + rand() * 0.08);
        if (k === 0) g.moveTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
        else g.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
      }
      g.closePath();
      const rg = g.createRadialGradient(r * 0.6, r * 0.55, 0, r, r, r);
      rg.addColorStop(0, '#b8aca0');
      rg.addColorStop(0.6, '#7a6e64');
      rg.addColorStop(1, '#3a322c');
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 1.4;
      g.strokeStyle = '#1a1410';
      g.stroke();
      for (let k = 0; k < 8; ++k) {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.arc(r + (rand() - 0.5) * r, r + (rand() - 0.5) * r, 1.5 + rand() * 2.5, 0, TWO_PI);
        g.fill();
      }
    });
  }

  function springSprite(world) {
    return sprite('spring' + world, 68, 20, 18, (g, W, H) => {
      /* base plate */
      metalFill(g, 0, H - 6, W, 6, world, mulberry(3));
      g.strokeStyle = '#140c08';
      g.lineWidth = 1;
      g.strokeRect(0.5, H - 6, W - 1, 5.5);
      /* coil */
      g.strokeStyle = '#d8dce4';
      g.lineWidth = 2.6;
      g.beginPath();
      for (let i = 0; i <= 8; ++i) {
        const x = 8 + i * (W - 16) / 8;
        const y = i % 2 ? 4 : H - 7;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.strokeStyle = 'rgba(60,60,70,0.9)';
      g.lineWidth = 1;
      g.stroke();
      /* rubber top pad */
      const lg = g.createLinearGradient(0, -4, 0, 5);
      lg.addColorStop(0, '#9aff7a');
      lg.addColorStop(0.5, '#3ac83a');
      lg.addColorStop(1, '#1a6a1a');
      g.fillStyle = lg;
      roundRect(g, 0, -4, W, 8, 4);
      g.fill();
      g.strokeStyle = '#0a2a0a';
      g.lineWidth = 1.2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(6, -3, W - 12, 1.6);
      /* chevrons pointing out of the face */
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 1.6;
      for (let i = -1; i <= 1; ++i) {
        g.beginPath();
        g.moveTo(W / 2 + i * 16 - 4, 2);
        g.lineTo(W / 2 + i * 16, -2);
        g.lineTo(W / 2 + i * 16 + 4, 2);
        g.stroke();
      }
    });
  }

  function bumperSprite(r, lit) {
    return sprite('bumper' + r + (lit ? 'L' : ''), r * 2, r * 2, 6, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.arc(r + 2, r + 3, r, 0, TWO_PI);
      g.fill();
      const rg = g.createRadialGradient(r * 0.7, r * 0.6, 0, r, r, r);
      rg.addColorStop(0, lit ? '#ffffff' : '#ffd0f0');
      rg.addColorStop(0.4, lit ? '#ff9ae0' : '#ff4ab0');
      rg.addColorStop(1, '#6a0a48');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, TWO_PI);
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = lit ? '#ffffff' : '#ffe0a0';
      g.beginPath();
      g.arc(r, r, r * 0.62, 0, TWO_PI);
      g.stroke();
      g.lineWidth = 1.4;
      g.strokeStyle = '#2a0418';
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, TWO_PI);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.ellipse(r * 0.7, r * 0.55, r * 0.28, r * 0.16, -0.6, 0, TWO_PI);
      g.fill();
    });
  }

  function conveyorSprite(w, world) {
    return sprite('conv' + w + ':' + world, w, 18, 4, (g, W, H) => {
      g.fillStyle = '#1e2026';
      roundRect(g, 0, 0, W, H, 9);
      g.fill();
      g.strokeStyle = '#060608';
      g.lineWidth = 1.4;
      g.stroke();
      /* rollers at the ends */
      for (const x of [9, W - 9]) {
        const rg = g.createRadialGradient(x - 2, 7, 0, x, 9, 7);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.5, METAL[world].base);
        rg.addColorStop(1, METAL[world].dark);
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, 9, 6.5, 0, TWO_PI);
        g.fill();
        g.fillStyle = '#222';
        g.beginPath();
        g.arc(x, 9, 1.8, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(9, 2, W - 18, 2);
    });
  }

  function treadSprite() {
    /* one chevron of the moving belt */
    return sprite('tread', 14, 10, 0, (g) => {
      g.strokeStyle = '#ffcf3a';
      g.lineWidth = 2.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(3, 1.5);
      g.lineTo(9, 5);
      g.lineTo(3, 8.5);
      g.stroke();
    });
  }

  function paddleSprite(w, world) {
    return sprite('paddle' + w + ':' + world, w, 16, 10, (g, W, H, rand) => {
      metalFill(g, 0, 0, W, H, world, rand);
      bevel(g, 0, 0, W, H, 1);
      rivets(g, 0, 0, W, H, world);
      /* gear hub */
      const cx = W / 2, cy = H / 2;
      g.fillStyle = METAL[world].dark;
      g.beginPath();
      for (let k = 0; k < 16; ++k) {
        const a = k / 16 * TWO_PI, rr = k % 2 ? 12 : 15;
        if (k === 0) g.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        else g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
      const rg = g.createRadialGradient(cx - 3, cy - 3, 0, cx, cy, 11);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.5, '#ffcf6a');
      rg.addColorStop(1, '#7a4a10');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(cx, cy, 10, 0, TWO_PI);
      g.fill();
      g.fillStyle = '#2a1a08';
      g.beginPath();
      g.arc(cx, cy, 3, 0, TWO_PI);
      g.fill();
    });
  }

  function fanSprite(world) {
    return sprite('fan' + world, 40, 44, 6, (g, W, H, rand) => {
      metalFill(g, 0, 0, W, H, world, rand);
      bevel(g, 0, 0, W, H, 1);
      g.fillStyle = '#101418';
      roundRect(g, 26, 3, 12, H - 6, 3);
      g.fill();
      rivets(g, 0, 0, 22, H, world);
    });
  }

  function bladeSprite() {
    return sprite('blade', 34, 34, 0, (g) => {
      g.translate(17, 17);
      for (let k = 0; k < 4; ++k) {
        g.rotate(Math.PI / 2);
        g.fillStyle = k % 2 ? '#c8d4e0' : '#9aa8b8';
        g.beginPath();
        g.ellipse(0, -9, 4.5, 9, 0.3, 0, TWO_PI);
        g.fill();
      }
      g.fillStyle = '#ffcf3a';
      g.beginPath();
      g.arc(0, 0, 3.5, 0, TWO_PI);
      g.fill();
    });
  }

  function magnetSprite() {
    return sprite('magnet', 40, 40, 6, (g) => {
      g.translate(20, 20);
      g.lineCap = 'butt';
      g.lineWidth = 11;
      g.strokeStyle = '#d82a2a';
      g.beginPath();
      g.arc(0, -2, 11, Math.PI * 0.05, Math.PI * 0.95, true);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -2, 14, Math.PI * 1.2, Math.PI * 1.8);
      g.stroke();
      /* steel poles */
      for (const x of [-11, 11]) {
        const lg = g.createLinearGradient(x - 5.5, 0, x + 5.5, 0);
        lg.addColorStop(0, '#ffffff');
        lg.addColorStop(0.5, '#a8b0bc');
        lg.addColorStop(1, '#4a5260');
        g.fillStyle = lg;
        g.fillRect(x - 5.5, 0, 11, 12);
        g.strokeStyle = '#1a1010';
        g.lineWidth = 1;
        g.strokeRect(x - 5.5, 0, 11, 12);
      }
      g.lineWidth = 1.2;
      g.strokeStyle = '#3a0808';
      g.beginPath();
      g.arc(0, -2, 16.5, Math.PI * 0.02, Math.PI * 0.98, true);
      g.stroke();
      g.beginPath();
      g.arc(0, -2, 5.5, Math.PI * 0.02, Math.PI * 0.98, true);
      g.stroke();
    });
  }

  function plankSprite(world) {
    return sprite('plank' + world, 132, 16, 4, (g, W, H, rand) => {
      woodFill(g, 0, 0, W, H, world === 2 || world === 4 ? 0 : world, rand, false);
      bevel(g, 0, 0, W, H, 1);
      for (const x of [8, W - 8]) {
        g.fillStyle = '#d8d0c0';
        g.beginPath();
        g.arc(x, H / 2, 2, 0, TWO_PI);
        g.fill();
      }
    });
  }

  function blockSprite(world) {
    return steelSprite(56, 56, world);
  }

  function bobSprite(r) {
    return sprite('bob' + r, r * 2, r * 2, 4, (g) => {
      const rg = g.createRadialGradient(r * 0.6, r * 0.55, 0, r, r, r);
      rg.addColorStop(0, '#ffffff');
      rg.addColorStop(0.3, '#c8a070');
      rg.addColorStop(1, '#3a2410');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(r, r, r - 0.5, 0, TWO_PI);
      g.fill();
      g.strokeStyle = '#1a0e04';
      g.lineWidth = 1.4;
      g.stroke();
      g.fillStyle = '#5a3a1a';
      g.fillRect(r - 4, 0, 8, 6);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     BALL, TARGET, STAR, LAUNCHER
     ══════════════════════════════════════════════════════════════════ */

  function ballBase(skin, r) {
    return sprite('ball' + skin.id + r, r * 2, r * 2, 3, (g) => {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath();
      g.arc(r + 1.5, r + 2, r, 0, TWO_PI);
      g.fill();
      const rg = g.createRadialGradient(r * 0.65, r * 0.55, 0, r, r, r);
      rg.addColorStop(0, skin.id === 'marble' ? 'rgba(255,255,255,0.95)' : '#ffffff');
      rg.addColorStop(0.35, skin.base);
      rg.addColorStop(1, skin.dark);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(r, r, r - 0.4, 0, TWO_PI);
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = 'rgba(10,10,20,0.75)';
      g.stroke();
    });
  }

  function ballDetail(skin, r) {
    return sprite('balld' + skin.id + r, r * 2, r * 2, 3, (g) => {
      g.save();
      g.beginPath();
      g.arc(r, r, r - 1, 0, TWO_PI);
      g.clip();
      if (skin.id === 'marble') {
        g.strokeStyle = 'rgba(255,90,140,0.75)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(r * 0.2, r * 1.2);
        g.bezierCurveTo(r * 0.8, r * 0.2, r * 1.2, r * 1.8, r * 1.8, r * 0.8);
        g.stroke();
        g.strokeStyle = 'rgba(80,200,255,0.7)';
        g.beginPath();
        g.moveTo(r * 0.4, r * 1.7);
        g.bezierCurveTo(r, r * 1.1, r * 1.2, r * 0.4, r * 1.6, r * 0.3);
        g.stroke();
      } else if (skin.id === 'plasma') {
        g.strokeStyle = 'rgba(255,255,255,0.8)';
        g.lineWidth = 1.4;
        for (let k = 0; k < 3; ++k) {
          g.beginPath();
          g.moveTo(r, r);
          const a = k * 2.1;
          g.lineTo(r + Math.cos(a) * r * 0.5, r + Math.sin(a) * r * 0.5 + 2);
          g.lineTo(r + Math.cos(a + 0.3) * r, r + Math.sin(a + 0.3) * r);
          g.stroke();
        }
      } else {
        /* a seam band so rolling shows */
        g.strokeStyle = rgba(skin.dark, 0.55);
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(r, r, r * 0.35, r, 0, 0, TWO_PI);
        g.stroke();
      }
      g.restore();
    });
  }

  function ballShine(r) {
    return sprite('ballshine' + r, r * 2, r * 2, 3, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.ellipse(r * 0.66, r * 0.5, r * 0.32, r * 0.2, -0.6, 0, TWO_PI);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.beginPath();
      g.arc(r * 1.3, r * 1.4, r * 0.18, 0, TWO_PI);
      g.fill();
    });
  }

  function drawBall(ctx, x, y, a, skin, r, t) {
    const R = r || 13;
    if (skin.id === 'plasma' || skin.id === 'gold')
      drawGlow(ctx, x, y, R * (skin.id === 'plasma' ? 5 : 3.4), skin.glow, skin.id === 'plasma' ? 0.55 + 0.15 * Math.sin(t * 12) : 0.3);
    blit(ctx, ballBase(skin, R), x, y, 0);
    blit(ctx, ballDetail(skin, R), x, y, a);
    blit(ctx, ballShine(R), x, y, 0);
  }

  function targetSprite(color, lit) {
    return sprite('target' + color + (lit ? 'L' : ''), 60, 60, 8, (g) => {
      g.translate(30, 30);
      /* a brass gong-like bullseye */
      const rings = lit ? ['#fff4c0', '#ffd84a', '#ffffff', '#ffb02a', '#fff8e0'] : [shade(color, -0.55), color, '#f4f0e8', color, '#ffffff'];
      const radii = [29, 24, 18, 12, 6];
      for (let i = 0; i < rings.length; ++i) {
        const rg = g.createRadialGradient(-radii[i] * 0.3, -radii[i] * 0.3, 0, 0, 0, radii[i]);
        rg.addColorStop(0, shade(rings[i], 0.35));
        rg.addColorStop(1, shade(rings[i], -0.15));
        g.fillStyle = rg;
        g.beginPath();
        g.arc(0, 0, radii[i], 0, TWO_PI);
        g.fill();
      }
      g.lineWidth = 1.6;
      g.strokeStyle = 'rgba(20,10,4,0.85)';
      g.beginPath();
      g.arc(0, 0, 29, 0, TWO_PI);
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath();
      g.ellipse(-9, -12, 10, 5, -0.5, 0, TWO_PI);
      g.fill();
    });
  }

  function haloSprite(color) {
    return sprite('halo' + color, 120, 120, 0, (g) => {
      g.translate(60, 60);
      for (let k = 0; k < 3; ++k) {
        g.strokeStyle = rgba(color, [0.15, 0.35, 0.8][k]);
        g.lineWidth = [10, 5, 2][k];
        g.beginPath();
        g.arc(0, 0, 50, 0, TWO_PI);
        g.stroke();
      }
    });
  }

  function drawTarget(ctx, x, y, lit, t, color) {
    const c = color || '#ff5a5a';
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    drawGlow(ctx, x, y, lit ? 200 : 120 + 30 * pulse, lit ? '#ffd84a' : c, lit ? 0.7 : 0.35 + 0.15 * pulse);
    const halo = haloSprite(lit ? '#ffe066' : c);
    const hs = 66 + (lit ? 12 : 10 * pulse);
    ctx.save();
    ctx.globalAlpha *= lit ? 0.9 : 0.5 + 0.4 * (1 - pulse);
    ctx.drawImage(halo.c, x - hs / 2, y - hs / 2, hs, hs);
    ctx.restore();
    const s = targetSprite(c, lit);
    const sc = lit ? 1 + 0.05 * Math.sin(t * 10) : 1;
    ctx.drawImage(s.c, x - s.ax * sc, y - s.ay * sc, s.w * sc, s.h * sc);
  }

  function starSprite() {
    return sprite('star', 36, 36, 4, (g) => {
      g.translate(18, 18);
      g.beginPath();
      for (let k = 0; k < 10; ++k) {
        const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7.5 : 17;
        if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      const rg = g.createRadialGradient(-4, -6, 0, 0, 0, 18);
      rg.addColorStop(0, '#fffbe0');
      rg.addColorStop(0.45, '#ffd84a');
      rg.addColorStop(1, '#c87a10');
      g.fillStyle = rg;
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = '#6a3a04';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.moveTo(0, -14);
      g.lineTo(3, -4);
      g.lineTo(-3, -4);
      g.closePath();
      g.fill();
    });
  }

  function drawStar(ctx, x, y, t, phase) {
    const bob = Math.sin(t * 2.4 + (phase || 0)) * 4;
    drawGlow(ctx, x, y + bob, 70 + 10 * Math.sin(t * 5 + (phase || 0)), '#ffd84a', 0.45);
    const s = starSprite();
    const sx = Math.cos(t * 2 + (phase || 0));
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(0.35 + 0.65 * Math.abs(sx), 1);
    ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h);
    ctx.restore();
  }

  function launcherBase(world) {
    return sprite('lbase' + world, 84, 48, 8, (g, W, H, rand) => {
      /* a wooden carriage with two wheels */
      woodFill(g, 6, 14, W - 12, 18, world === 3 ? 3 : 0, rand, false);
      bevel(g, 6, 14, W - 12, 18, 1);
      for (const x of [20, W - 20]) {
        g.fillStyle = '#2a1a0c';
        g.beginPath();
        g.arc(x, 34, 13, 0, TWO_PI);
        g.fill();
        const rg = g.createRadialGradient(x - 3, 31, 0, x, 34, 12);
        rg.addColorStop(0, '#d8b080');
        rg.addColorStop(1, '#6a4020');
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, 34, 11, 0, TWO_PI);
        g.fill();
        g.strokeStyle = '#3a2410';
        g.lineWidth = 1.6;
        for (let k = 0; k < 6; ++k) {
          const a = k / 6 * Math.PI;
          g.beginPath();
          g.moveTo(x - Math.cos(a) * 10, 34 - Math.sin(a) * 10);
          g.lineTo(x + Math.cos(a) * 10, 34 + Math.sin(a) * 10);
          g.stroke();
        }
        g.fillStyle = '#c8a050';
        g.beginPath();
        g.arc(x, 34, 3, 0, TWO_PI);
        g.fill();
      }
      /* the pivot bracket */
      g.fillStyle = '#5a5e68';
      g.beginPath();
      g.moveTo(W / 2 - 14, 16);
      g.lineTo(W / 2 - 6, 0);
      g.lineTo(W / 2 + 6, 0);
      g.lineTo(W / 2 + 14, 16);
      g.closePath();
      g.fill();
      g.strokeStyle = '#14161a';
      g.lineWidth = 1.2;
      g.stroke();
    });
  }

  function barrelSprite() {
    return sprite('barrel', 64, 26, 4, (g, W, H) => {
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, '#fff0c0');
      lg.addColorStop(0.25, '#e0a848');
      lg.addColorStop(0.7, '#9a6418');
      lg.addColorStop(1, '#4a2a08');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, 3);
      g.lineTo(W - 8, 1);
      g.lineTo(W, 0);
      g.lineTo(W, H);
      g.lineTo(W - 8, H - 1);
      g.lineTo(0, H - 3);
      g.closePath();
      g.fill();
      g.strokeStyle = '#2a1404';
      g.lineWidth = 1.4;
      g.stroke();
      /* bands */
      for (const x of [14, 34, W - 6]) {
        g.fillStyle = 'rgba(40,20,4,0.6)';
        g.fillRect(x, 1, 4, H - 2);
        g.fillStyle = 'rgba(255,240,200,0.5)';
        g.fillRect(x, 1, 1.2, H - 2);
      }
      g.fillStyle = '#1a0c02';
      g.beginPath();
      g.ellipse(W - 1, H / 2, 2.5, H / 2 - 3, 0, 0, TWO_PI);
      g.fill();
    });
  }

  /* angle in degrees, power 0..1; the launcher pivot sits at (x, y) */
  function drawLauncher(ctx, x, y, angleDeg, power, t, world, recoil) {
    const base = launcherBase(world || 0);
    const a = -angleDeg * DEG;
    const r = recoil || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.translate(-r * 10, 0);
    const b = barrelSprite();
    ctx.drawImage(b.c, -16 - b.ax + 32, -b.ay, b.w, b.h);
    if (power > 0.01) {
      /* power coils glow along the barrel */
      for (let k = 0; k < 4; ++k) {
        const on = power * 4 - k;
        if (on <= 0)
          break;
        const col = power > 0.85 ? '#ff6a3a' : power > 0.5 ? '#ffd84a' : '#7ae8ff';
        drawGlow(ctx, 0 + k * 12, 0, 26, col, Math.min(1, on) * (0.7 + 0.3 * Math.sin(t * 20 + k)));
      }
    }
    ctx.restore();
    ctx.drawImage(base.c, x - base.ax, y - 8 - 6, base.w, base.h);
  }

  /* ══════════════════════════════════════════════════════════════════
     BODIES AND ZONES
     ══════════════════════════════════════════════════════════════════ */

  /* bodies whose look never changes go into the controller's static layer */
  function isStaticArt(b) {
    const k = b.data && b.data.kind;
    return b.type === 'static' && !b.sensor && (k === 'wall' || k === 'ground' || k === 'ramp' || k === 'peg' || k === 'ice');
  }

  function drawBody(ctx, b, world, t, skin) {
    const k = b.data && b.data.kind || 'wall';
    switch (k) {
      case 'ball':
        drawBall(ctx, b.x, b.y, b.a, skin, b.r, t);
        return;
      case 'crate': case 'part-crate': {
        const sz = boxSize(b);
        blit(ctx, crateSprite(Math.round(sz[0]), Math.round(sz[1]), world), b.x, b.y, b.a);
        return;
      }
      case 'steel':
        blit(ctx, steelSprite(Math.round(boxSize(b)[0]), Math.round(boxSize(b)[1]), world), b.x, b.y, b.a);
        return;
      case 'boulder':
        blit(ctx, boulderSprite(Math.round(b.r)), b.x, b.y, b.a);
        return;
      case 'glass': {
        const sz = boxSize(b);
        blit(ctx, glassSprite(Math.round(sz[0]), Math.round(sz[1])), b.x, b.y, b.a);
        return;
      }
      case 'tnt': {
        const fuse = b.fuse && b.fuse > 0;
        if (fuse)
          drawGlow(ctx, b.x, b.y, 120, '#ff5a2a', 0.8);
        blit(ctx, tntSprite(), b.x, b.y, b.a);
        const sp = Math.sin(t * 30 + b.id) > 0;
        const fx = b.x + Math.cos(b.a) * 4 - Math.sin(b.a) * -31, fy = b.y + Math.sin(b.a) * 4 + Math.cos(b.a) * -31;
        drawGlow(ctx, fx, fy, sp ? 16 : 11, '#ffcf6a', 0.9);
        return;
      }
      case 'spring': {
        const hit = b.data.hitAt !== undefined ? t - b.data.hitAt : 9;
        const squash = hit < 0.25 ? Math.sin(hit / 0.25 * Math.PI) * 0.5 : 0;
        const s = springSprite(world);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a);
        ctx.translate(0, 10);
        ctx.scale(1, 1 + squash);
        ctx.drawImage(s.c, -s.ax, -s.ay - 10 + 10, s.w, s.h);
        ctx.restore();
        if (hit < 0.3)
          drawGlow(ctx, b.x + Math.sin(b.a) * 6, b.y - Math.cos(b.a) * 6, 90, '#9aff7a', 1 - hit / 0.3);
        return;
      }
      case 'bumper': {
        const hit = b.data.hitAt !== undefined ? t - b.data.hitAt : 9;
        const lit = hit < 0.18;
        if (lit)
          drawGlow(ctx, b.x, b.y, b.r * 5, '#ff6ad0', 1 - hit / 0.18);
        const sc = lit ? 1 + 0.12 * (1 - hit / 0.18) : 1;
        const s = bumperSprite(Math.round(b.r), lit);
        ctx.drawImage(s.c, b.x - s.ax * sc, b.y - s.ay * sc, s.w * sc, s.h * sc);
        return;
      }
      case 'conveyor': {
        const sz = boxSize(b);
        const w = Math.round(sz[0]);
        blit(ctx, conveyorSprite(w, world), b.x, b.y, b.a);
        /* moving treads */
        const tr = treadSprite();
        const dir = b.surface >= 0 ? 1 : -1;
        const step = 18;
        const off = ((t * Math.abs(b.surface) * 0.5) % step) * dir;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.a);
        if (dir < 0)
          ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.rect(-w / 2 + 14, -9, w - 28, 18);
        ctx.clip();
        for (let x = -w / 2 - step + Math.abs(off) * 1; x < w / 2; x += step)
          ctx.drawImage(tr.c, x, -5, tr.w, tr.h);
        ctx.restore();
        return;
      }
      case 'paddle': {
        const sz = boxSize(b);
        blit(ctx, paddleSprite(Math.round(sz[0]), world), b.x, b.y, b.a);
        return;
      }
      case 'fan': {
        blit(ctx, fanSprite(world), b.x, b.y, b.a);
        const bl = bladeSprite();
        const ox = b.x + Math.cos(b.a) * 12, oy = b.y + Math.sin(b.a) * 12;
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(b.a);
        ctx.scale(0.35, 1);
        ctx.rotate(t * 30);
        ctx.drawImage(bl.c, -17, -17, 34, 34);
        ctx.restore();
        return;
      }
      case 'magnet': {
        drawGlow(ctx, b.x, b.y, 70 + 8 * Math.sin(t * 6), '#ff6a6a', 0.35);
        blit(ctx, magnetSprite(), b.x, b.y, 0);
        return;
      }
      case 'pendulum': {
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.data.ax, b.data.ay);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = '#c8a878';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#5a5e68';
        ctx.beginPath();
        ctx.arc(b.data.ax, b.data.ay, 5, 0, TWO_PI);
        ctx.fill();
        blit(ctx, bobSprite(Math.round(b.r)), b.x, b.y, b.a);
        return;
      }
      case 'plank':
        blit(ctx, plankSprite(world), b.x, b.y, b.a);
        return;
      case 'block':
        blit(ctx, blockSprite(world), b.x, b.y, b.a);
        return;
      case 'lava':
        drawLava(ctx, b, t);
        return;
    }
    if (k === 'crate' || (b.type === 'dynamic' && b.mat === 'wood')) {
      const sz = boxSize(b);
      blit(ctx, crateSprite(Math.round(sz[0]), Math.round(sz[1]), world), b.x, b.y, b.a);
      return;
    }
    blit(ctx, staticSprite(b, world), b.x, b.y, b.a);
  }

  function lavaSurface() {
    return sprite('lavasurf', 128, 24, 0, (g) => {
      g.fillStyle = '#ffcf4a';
      g.beginPath();
      g.moveTo(0, 12);
      for (let x = 0; x <= 128; x += 4)
        g.lineTo(x, 9 + Math.sin(x / 128 * TWO_PI * 2) * 3);
      g.lineTo(128, 24);
      g.lineTo(0, 24);
      g.closePath();
      g.fill();
    });
  }

  function drawLava(ctx, b, t) {
    const sz = boxSize(b);
    const x0 = b.x - sz[0] / 2, y0 = b.y - sz[1] / 2, w = sz[0], h = sz[1];
    const body = sprite('lava' + Math.round(w) + 'x' + Math.round(h), w, h, 0, (g, W, H, rand) => {
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, '#ffb02a');
      lg.addColorStop(0.3, '#ff5a10');
      lg.addColorStop(1, '#7a1004');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      for (let k = 0; k < W / 10; ++k) {
        g.fillStyle = rand() < 0.5 ? 'rgba(255,230,120,0.35)' : 'rgba(80,10,0,0.3)';
        g.beginPath();
        g.ellipse(rand() * W, 8 + rand() * (H - 8), 4 + rand() * 10, 2 + rand() * 3, 0, 0, TWO_PI);
        g.fill();
      }
    });
    drawGlow(ctx, b.x, y0, w * 1.1, '#ff6a1a', 0.45 + 0.08 * Math.sin(t * 3));
    ctx.drawImage(body.c, x0, y0, w, h);
    const s = lavaSurface();
    const off = (t * 30) % 128;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0 - 8, w, 20);
    ctx.clip();
    ctx.globalAlpha *= 0.85;
    for (let x = x0 - off; x < x0 + w; x += 128)
      ctx.drawImage(s.c, x, y0 - 10, 128, 24);
    ctx.restore();
  }

  function swirlSprite(color) {
    return sprite('swirl' + color, 64, 64, 0, (g) => {
      g.translate(32, 32);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, 30);
      rg.addColorStop(0, 'rgba(10,6,20,0.95)');
      rg.addColorStop(0.6, rgba(color, 0.55));
      rg.addColorStop(1, rgba(color, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, 30, 0, TWO_PI);
      g.fill();
      g.lineCap = 'round';
      for (let k = 0; k < 3; ++k) {
        g.rotate(TWO_PI / 3);
        g.strokeStyle = rgba(color, 0.95);
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(0, 0, 22, 0, 1.6);
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1;
        g.beginPath();
        g.arc(0, 0, 14, 0.4, 1.8);
        g.stroke();
      }
    });
  }

  function arrowSprite(color) {
    return sprite('arrow' + color, 24, 18, 2, (g) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 5);
      g.lineTo(13, 5);
      g.lineTo(13, 0);
      g.lineTo(24, 9);
      g.lineTo(13, 18);
      g.lineTo(13, 13);
      g.lineTo(0, 13);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 1;
      g.stroke();
    });
  }

  function drawPortalMouth(ctx, x, y, a, color, t, dir) {
    drawGlow(ctx, x, y, 130, color, 0.55 + 0.1 * Math.sin(t * 5));
    const s = swirlSprite(color);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 3 * dir);
    ctx.drawImage(s.c, -32, -32, 64, 64);
    ctx.rotate(-t * 5 * dir);
    ctx.globalAlpha *= 0.6;
    ctx.drawImage(s.c, -24, -24, 48, 48);
    ctx.restore();
    /* exit arrow */
    const ar = arrowSprite(color);
    const k = (t * 1.5) % 1;
    ctx.save();
    ctx.translate(x + Math.cos(a) * (34 + k * 10), y + Math.sin(a) * (34 + k * 10));
    ctx.rotate(a);
    ctx.globalAlpha *= 1 - k * 0.7;
    ctx.drawImage(ar.c, -ar.ax, -ar.ay, ar.w, ar.h);
    ctx.restore();
  }

  function waterSprite(w, h) {
    return sprite('water' + Math.round(w) + 'x' + Math.round(h), w, h, 0, (g, W, H, rand) => {
      const lg = g.createLinearGradient(0, 0, 0, H);
      lg.addColorStop(0, 'rgba(90,200,255,0.55)');
      lg.addColorStop(0.4, 'rgba(30,110,200,0.6)');
      lg.addColorStop(1, 'rgba(10,40,100,0.8)');
      g.fillStyle = lg;
      g.fillRect(0, 0, W, H);
      for (let k = 0; k < W / 12; ++k) {
        g.strokeStyle = 'rgba(200,240,255,0.18)';
        g.lineWidth = 1;
        const x = rand() * W, y = 10 + rand() * (H - 10);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + 8, y - 3, x + 16, y);
        g.stroke();
      }
    });
  }

  function waveSprite() {
    return sprite('wave', 96, 12, 0, (g) => {
      g.strokeStyle = 'rgba(230,250,255,0.9)';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= 96; x += 3) {
        const y = 6 + Math.sin(x / 96 * TWO_PI * 2) * 2.5;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    });
  }

  /* the faint column of moving air in front of a fan */
  function airSprite() {
    return sprite('air', 128, 32, 0, (g) => {
      const lg = g.createLinearGradient(0, 0, 128, 0);
      lg.addColorStop(0, 'rgba(150,225,255,0.6)');
      lg.addColorStop(0.6, 'rgba(150,225,255,0.25)');
      lg.addColorStop(1, 'rgba(150,225,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, 128, 32);
      const vg = g.createLinearGradient(0, 0, 0, 32);
      vg.addColorStop(0, 'rgba(0,0,0,1)');
      vg.addColorStop(0.25, 'rgba(0,0,0,0)');
      vg.addColorStop(0.75, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = vg;
      g.fillRect(0, 0, 128, 32);
    });
  }

  function windSprite() {
    return sprite('wind', 40, 6, 0, (g) => {
      const lg = g.createLinearGradient(0, 0, 40, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.7, 'rgba(235,252,255,0.95)');
      lg.addColorStop(1, 'rgba(235,252,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 1.5, 40, 3);
      g.fillStyle = 'rgba(40,90,120,0.35)';
      g.fillRect(4, 4.5, 34, 1);
    });
  }

  function drawZone(ctx, z, world, t) {
    if (z.kind === 'water') {
      const w = z.x1 - z.x0, h = z.y1 - z.y0;
      ctx.drawImage(waterSprite(w, h).c, z.x0, z.y0, w, h);
      const wv = waveSprite();
      ctx.save();
      ctx.beginPath();
      ctx.rect(z.x0, z.y0 - 8, w, 16);
      ctx.clip();
      for (let row = 0; row < 2; ++row) {
        const off = ((t * (row ? -24 : 34)) % 96 + 96) % 96;
        ctx.globalAlpha = row ? 0.5 : 0.9;
        for (let x = z.x0 - off; x < z.x1; x += 96)
          ctx.drawImage(wv.c, x, z.y0 - 6 + row * 4, 96, 12);
      }
      ctx.restore();
    } else if (z.kind === 'fan') {
      const col = airSprite();
      const ws = windSprite();
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.rotate(z.a);
      ctx.globalAlpha *= 0.75 + 0.1 * Math.sin(t * 7);
      ctx.drawImage(col.c, 0, -z.width / 2, z.len, z.width);
      ctx.globalAlpha = 1;
      for (let k = 0; k < 9; ++k) {
        const p = ((t * 1.4 + k * 0.29) % 1);
        const along = p * z.len, side = ((k * 37) % 9 - 4) / 4 * z.width * 0.38;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
        ctx.drawImage(ws.c, along - 20, side - 3, 40 + 30 * (1 - p), 6);
      }
      ctx.restore();
    } else if (z.kind === 'magnet') {
      for (let k = 0; k < 3; ++k) {
        const p = ((t * 0.6 + k / 3) % 1);
        ctx.strokeStyle = 'rgba(255,110,110,' + (0.35 * p).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius * (1 - p) + 22, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (z.kind === 'portal') {
      drawPortalMouth(ctx, z.ax, z.ay, z.aa, '#ff9a2a', t, 1);
      drawPortalMouth(ctx, z.bx, z.by, z.ba, '#3ab8ff', t, -1);
    }
  }

  /* ── inventory icons and part previews ── */

  function partIcon(type, world) {
    switch (type) {
      case 'plank': return plankSprite(world);
      case 'block': return blockSprite(world);
      case 'spring': return springSprite(world);
      case 'bumper': return bumperSprite(24, false);
      case 'fan': return fanSprite(world);
      case 'conveyor': return conveyorSprite(180, world);
      case 'magnet': return magnetSprite();
      case 'crate': return crateSprite(48, 48, world);
      case 'glass': return glassSprite(120, 14);
      case 'tnt': return tntSprite();
    }
    return plankSprite(world);
  }

  /* draws a placeable part at a placement { type, x, y, a } */
  function drawPart(ctx, p, world, t) {
    const a = (p.a || 0) * DEG;
    if (p.type === 'fan') {
      const fake = { x: p.x, y: p.y, a: a, data: { kind: 'fan' } };
      drawBody(ctx, fake, world, t);
      drawZone(ctx, { kind: 'fan', x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, a: a, len: 300, width: 70 }, world, t);
      return;
    }
    if (p.type === 'conveyor') {
      drawBody(ctx, { x: p.x, y: p.y, a: a, surface: 300, poly: { count: 4, verts: [-90, -9, 90, -9, 90, 9, -90, 9] }, data: { kind: 'conveyor' } }, world, t);
      return;
    }
    if (p.type === 'spring' || p.type === 'bumper') {
      drawBody(ctx, { x: p.x, y: p.y, a: a, r: 24, data: { kind: p.type } }, world, t);
      return;
    }
    if (p.type === 'magnet') {
      drawBody(ctx, { x: p.x, y: p.y, a: 0, data: { kind: 'magnet' } }, world, t);
      return;
    }
    const s = partIcon(p.type, world);
    blit(ctx, s, p.x, p.y, a);
  }

  function setScale(s) {
    const q = Math.max(1, Math.min(3, Math.round(s * 4) / 4));
    if (q !== scale) {
      scale = q;
      cache = new Map();
    }
  }

  SZ.PhysicsPuzzleArt = Object.freeze({
    setScale: setScale, get scale() { return scale; }, get cacheSize() { return cache.size; },
    drawBody: drawBody, drawZone: drawZone, drawBall: drawBall, drawTarget: drawTarget, drawStar: drawStar,
    drawLauncher: drawLauncher, drawPart: drawPart, partIcon: partIcon, drawGlow: drawGlow, glowSprite: glowSprite,
    isStaticArt: isStaticArt, staticSprite: staticSprite, blit: blit, starSprite: starSprite, targetSprite: targetSprite,
    rgba: rgba, shade: shade
  });
})();
