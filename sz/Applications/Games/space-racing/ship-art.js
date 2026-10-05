;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Ship sprites for the race. DESIGNS holds the polygon layers of the five
   * hull shapes; getSprite renders a shaded sprite once per shape/color/accent/
   * bank and caches it, so a race frame only blits a canvas. drawShip wraps the
   * sprite in a ground shadow, engine glow and an optional shield ring.
   */

  const TWO_PI = Math.PI * 2;
  const SPRITE_W = 160;
  const SPRITE_H = 120;
  const RS = 2.5;                    // render scale of the cached sprite
  const LOCAL_W = SPRITE_W / RS;     // local units the sprite canvas covers
  const LOCAL_H = SPRITE_H / RS;
  const GLOW_SIZE = 64;
  const HULL_TOP = -22;              // y range the hull gradients run across
  const HULL_BOTTOM = 22;
  const BANK_SQUASH = 0.12;          // wing narrowing per bank step
  const BANK_SHADE = 0.18;           // shadow overlay per bank step

  const DESIGNS = {
    arrow: {
      layers: [
        { fill: 'hullDark', mirror: true, poly: [[6,-5],[-12,-17],[-18,-17],[-14,-6]] },
        { fill: 'accent',   mirror: true, poly: [[2,-6],[-10,-15],[-12,-15],[-1,-6]] },
        { fill: 'hull',     poly: [[24,0],[10,-5],[-14,-6],[-18,-3],[-18,3],[-14,6],[10,5]] },
        { fill: 'metal',    poly: [[-12,-4],[-18,-3],[-18,3],[-12,4]] },
        { fill: 'glass',    poly: [[14,0],[8,-3],[2,-3],[2,3],[8,3]] }
      ],
      engines: [[-18,-3.5,3],[-18,3.5,3]],
      lights: [[-17,-17],[-17,17]]
    },
    dart: {
      layers: [
        { fill: 'hullDark', mirror: true, poly: [[-2,-4],[-14,-14],[-18,-14],[-12,-4]] },
        { fill: 'hullDark', mirror: true, poly: [[14,-3],[8,-8],[6,-3]] },
        { fill: 'hull',     poly: [[28,0],[12,-3],[-10,-4],[-16,-2],[-16,2],[-10,4],[12,3]] },
        { fill: 'accent',   poly: [[20,-1],[-12,-1],[-12,1],[20,1]] },
        { fill: 'glass',    poly: [[18,0],[12,-2],[6,-2],[6,2],[12,2]] }
      ],
      engines: [[-16,0,4]],
      lights: [[-17,-14],[-17,14]]
    },
    wing: {
      layers: [
        { fill: 'hull',     mirror: true, poly: [[8,-4],[-6,-20],[-14,-22],[-12,-4]] },
        { fill: 'hullDark', mirror: true, poly: [[2,-6],[-8,-17],[-11,-17],[-8,-5]] },
        { fill: 'accent',   mirror: true, poly: [[10,-4],[16,-10],[12,-11],[4,-5]] },
        { fill: 'hull',     poly: [[20,0],[8,-4],[-12,-4],[-14,0],[-12,4],[8,4]] },
        { fill: 'glass',    poly: [[12,0],[6,-3],[0,-3],[0,3],[6,3]] }
      ],
      engines: [[-13,-2.5,2.5],[-13,2.5,2.5]],
      lights: [[-14,-22],[-14,22]]
    },
    heavy: {
      layers: [
        { fill: 'hull',     poly: [[20,-4],[20,4],[12,10],[-16,12],[-20,8],[-20,-8],[-16,-12],[12,-10]] },
        { fill: 'metal',    mirror: true, poly: [[10,-10],[-14,-12],[-14,-16],[6,-14]] },
        { fill: 'hullDark', mirror: true, poly: [[8,-7],[-14,-8],[-14,-10],[8,-9]] },
        { fill: 'accent',   poly: [[16,-3],[-16,-3],[-16,3],[16,3]] },
        { fill: 'glass',    poly: [[14,0],[9,-3],[4,-3],[4,3],[9,3]] }
      ],
      engines: [[-20,-6,3],[-20,0,3],[-20,6,3]],
      lights: [[-14,-16],[-14,16]]
    },
    stealth: {
      layers: [
        { fill: 'hullDark', poly: [[24,0],[4,-6],[-12,-20],[-16,-18],[-10,0],[-16,18],[-12,20],[4,6]] },
        { fill: 'accent',   mirror: true, poly: [[4,-6],[-12,-20],[-13,-18],[3,-5]] },
        { fill: 'hull',     poly: [[22,0],[6,-3],[-12,-2],[-12,2],[6,3]] },
        { fill: 'glass',    poly: [[12,0],[7,-2],[2,-2],[2,2],[7,2]] }
      ],
      engines: [[-11,-3,2],[-11,3,2]],
      lights: [[-13,-19],[-13,19]]
    }
  };

  function designFor(shape) {
    return DESIGNS[shape] || DESIGNS.arrow;
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

  function hexToRgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* ── painting ── */

  function tracePoly(ctx, poly, mirror) {
    ctx.beginPath();
    for (let i = 0; i < poly.length; ++i) {
      const p = poly[i];
      const y = mirror ? -p[1] : p[1];
      if (i === 0)
        ctx.moveTo(p[0], y);
      else
        ctx.lineTo(p[0], y);
    }
    ctx.closePath();
  }

  function hullGradient(ctx, base) {
    const g = ctx.createLinearGradient(0, HULL_TOP, 0, HULL_BOTTOM);
    g.addColorStop(0, shade(base, 0.35));
    g.addColorStop(0.5, base);
    g.addColorStop(1, shade(base, -0.45));
    return g;
  }

  function paintFor(ctx, fill, color, accent) {
    switch (fill) {
      case 'hull':
        return hullGradient(ctx, color);
      case 'hullDark':
        return hullGradient(ctx, shade(color, -0.35));
      case 'accent':
        return accent || '#ffffff';
      case 'metal': {
        const g = ctx.createLinearGradient(0, HULL_TOP, 0, HULL_BOTTOM);
        g.addColorStop(0, '#c8d0e0');
        g.addColorStop(1, '#5a6478');
        return g;
      }
      case 'glass': {
        const g = ctx.createLinearGradient(2, -3, 14, 3);
        g.addColorStop(0, '#e8fbff');
        g.addColorStop(1, '#1f4f8f');
        return g;
      }
      default:
        return '#1a1d2a';
    }
  }

  function drawLayer(ctx, layer, color, accent) {
    const fillStyle = paintFor(ctx, layer.fill, color, accent);
    const copies = layer.mirror ? 2 : 1;
    for (let m = 0; m < copies; ++m) {
      const mirror = m === 1;
      tracePoly(ctx, layer.poly, mirror);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = shade(color, -0.7);
      ctx.stroke();
      if (layer.fill === 'glass' && layer.poly.length > 1) {
        const a = layer.poly[0], b = layer.poly[1];
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(a[0], mirror ? -a[1] : a[1]);
        ctx.lineTo(b[0], mirror ? -b[1] : b[1]);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawPanelLines(ctx, color) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = shade(color, -0.5);
    const xs = [-8, -2, 4];
    for (let i = 0; i < xs.length; ++i) {
      ctx.beginPath();
      ctx.moveTo(xs[i], -3);
      ctx.lineTo(xs[i], 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEngines(ctx, design) {
    for (let i = 0; i < design.engines.length; ++i) {
      const e = design.engines[i];
      ctx.beginPath();
      ctx.arc(e[0], e[1], e[2], 0, TWO_PI);
      ctx.fillStyle = '#1a1d2a';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#8a94a8';
      ctx.stroke();
    }
  }

  function drawLights(ctx, design) {
    for (let i = 0; i < design.lights.length; ++i) {
      const l = design.lights[i];
      ctx.beginPath();
      ctx.arc(l[0], l[1], 1.6, 0, TWO_PI);
      ctx.fillStyle = l[1] < 0 ? '#ff4d4d' : '#4dff88';
      ctx.fill();
    }
  }

  /* Darken the hull side the ship leans away from, so a bank reads as a tilt. */
  function drawBankShade(ctx, design, bank) {
    const alpha = BANK_SHADE * Math.abs(bank);
    if (alpha <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-LOCAL_W, bank > 0 ? 0 : -LOCAL_H, LOCAL_W * 2, LOCAL_H);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    for (let i = 0; i < design.layers.length; ++i) {
      const layer = design.layers[i];
      if (layer.fill !== 'hull' && layer.fill !== 'hullDark') continue;
      const copies = layer.mirror ? 2 : 1;
      for (let m = 0; m < copies; ++m) {
        tracePoly(ctx, layer.poly, m === 1);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ── sprite cache ── */

  const spriteCache = {};

  function getSprite(shape, color, accent, bank) {
    const design = designFor(shape);
    const c = color || '#8899aa';
    const a = accent || '#ffffff';
    const b = Math.max(-2, Math.min(2, Math.round(bank || 0)));
    const key = shape + '|' + c + '|' + a + '|' + b;
    const hit = spriteCache[key];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = SPRITE_W;
    canvas.height = SPRITE_H;
    const ctx = canvas.getContext('2d');
    ctx.translate(SPRITE_W / 2, SPRITE_H / 2);
    ctx.scale(RS, RS);
    if (b !== 0) ctx.scale(1, 1 - BANK_SQUASH * Math.abs(b));

    for (let i = 0; i < design.layers.length; ++i)
      drawLayer(ctx, design.layers[i], c, a);
    drawPanelLines(ctx, c);
    drawEngines(ctx, design);
    drawLights(ctx, design);
    drawBankShade(ctx, design, b);

    const sprite = { canvas: canvas, rs: RS, cx: SPRITE_W / 2, cy: SPRITE_H / 2 };
    spriteCache[key] = sprite;
    return sprite;
  }

  /* ── engine glow cache ── */

  const glowCache = {};

  function getGlow(color) {
    const c = color || '#f80';
    const hit = glowCache[c];
    if (hit) return hit;

    const canvas = document.createElement('canvas');
    canvas.width = GLOW_SIZE;
    canvas.height = GLOW_SIZE;
    const ctx = canvas.getContext('2d');
    const r = GLOW_SIZE / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, hexToRgba(c, 0.85));
    g.addColorStop(1, hexToRgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);

    glowCache[c] = canvas;
    return canvas;
  }

  /* ── the ship as seen in a race frame ── */

  function drawShip(ctx, opts) {
    const design = designFor(opts.shape);
    const scale = opts.scale === undefined ? 1 : opts.scale;
    const time = opts.time || 0;
    const thrust = Math.max(0, Math.min(1, opts.thrust || 0));
    const bank = Math.max(-1, Math.min(1, opts.bank || 0));
    const x = opts.x, y = opts.y, angle = opts.angle || 0;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    // Ground shadow, offset so the ship sits above the track
    ctx.save();
    ctx.translate(x + 7, y + 10);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 12, 0, 0, TWO_PI);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();

    // Engine glow behind every nozzle
    const glow = getGlow(opts.exhaust);
    const boost = !!opts.boost;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < design.engines.length; ++i) {
      const e = design.engines[i];
      const nx = x + e[0] * cos - e[1] * sin;
      const ny = y + e[0] * sin + e[1] * cos;
      const len = (8 + 22 * thrust) * (boost ? 1.8 : 1) * (0.85 + 0.15 * Math.sin(time * 40 + i)) * 2;
      const wide = e[2] * 4;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(angle);
      ctx.drawImage(glow, -len, -wide / 2, len, wide);
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    // The cached sprite, banked by the frame nearest to the current lean
    const s = getSprite(opts.shape, opts.color, opts.accent, Math.round(bank * 2));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale / s.rs, scale / s.rs);
    ctx.drawImage(s.canvas, -s.cx, -s.cy);
    ctx.restore();

    if (opts.shield) {
      ctx.save();
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(time * 8);
      ctx.beginPath();
      ctx.arc(x, y, 30 * scale, 0, TWO_PI);
      ctx.fillStyle = 'rgba(120,200,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(120,200,255,0.7)';
      ctx.stroke();
      ctx.restore();
    }
  }

  SZ.RacingShipArt = Object.freeze({ DESIGNS, getSprite, drawShip });
})();
