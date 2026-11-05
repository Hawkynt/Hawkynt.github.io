/* Cached procedural cell art per tile set and season: dirt in two textures and sixteen edge
   shapes (rounded where the cave is open, with a seasonal lip of snow, grass, leaves or sand),
   brick, steel, four boulders, gem and crystal shimmer frames, the closed exit and its swirling
   open portal, magic wall runes, spore moss, lava, ice, powder barrels and explosion frames.
   Every tile is painted once into an offscreen canvas. Owns the tile cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const T = C.TILE;

  const cache = {};

  const LIPS = {
    winter: ['#f4fbff', '#cfe6f5'], yearend: ['#f4fbff', '#ffd54a'], spring: ['#7fd06a', '#ffb0d8'],
    summer: ['#f0d890', '#ffe066'], autumn: ['#e0802a', '#c9502a'], halloween: ['#8a4ad8', '#ff8a1a']
  };

  function dirtTexture(pal, variant) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.fillStyle = pal.dirt;
    x.fillRect(0, 0, T, T);
    for (let py = 0; py < T; py += 2)
      for (let px = 0; px < T; px += 2) {
        const n = K.fbm(px / 9 + variant * 5, py / 9, 3 + variant);
        if (n > 0.62) { x.fillStyle = K.rgba(pal.dirtHi, (n - 0.62) * 1.6); x.fillRect(px, py, 2, 2); }
        else if (n < 0.38) { x.fillStyle = K.rgba(pal.dirtLo, (0.38 - n) * 1.8); x.fillRect(px, py, 2, 2); }
      }
    const r = K.rand(77 + variant * 13);
    for (let k = 0; k < 5; ++k) {
      const px = 4 + r() * (T - 8), py = 4 + r() * (T - 8), s = 1.5 + r() * 2.5;
      x.fillStyle = K.darken(pal.dirtLo, 0.2);
      x.beginPath(); x.ellipse(px + 0.6, py + 0.8, s, s * 0.75, 0, 0, C.TAU); x.fill();
      x.fillStyle = K.lighten(pal.dirt, 0.25);
      x.beginPath(); x.ellipse(px, py, s, s * 0.75, 0, 0, C.TAU); x.fill();
    }
    if (variant === 1) {
      x.strokeStyle = K.rgba(pal.vein, 0.35);
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(6, 30); x.quadraticCurveTo(16, 22, 30, 26); x.stroke();
    }
    return c;
  }

  /* mask bits: 1 up open, 2 right open, 4 down open, 8 left open */
  function dirtShape(tex, pal, mask, lip) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const R = 11;
    const tl = (mask & 1) && (mask & 8) ? R : 0, tr = (mask & 1) && (mask & 2) ? R : 0;
    const br = (mask & 4) && (mask & 2) ? R : 0, bl = (mask & 4) && (mask & 8) ? R : 0;
    x.save();
    x.beginPath();
    x.moveTo(tl, 0); x.lineTo(T - tr, 0);
    if (tr) x.arcTo(T, 0, T, tr, tr);
    x.lineTo(T, T - br);
    if (br) x.arcTo(T, T, T - br, T, br);
    x.lineTo(bl, T);
    if (bl) x.arcTo(0, T, 0, T - bl, bl);
    x.lineTo(0, tl);
    if (tl) x.arcTo(0, 0, tl, 0, tl);
    x.closePath();
    x.clip();
    x.drawImage(tex, 0, 0);
    /* shading toward open sides */
    if (mask & 4) { const g = x.createLinearGradient(0, T - 9, 0, T); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); x.fillStyle = g; x.fillRect(0, T - 9, T, 9); }
    if (mask & 2) { const g = x.createLinearGradient(T - 7, 0, T, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); x.fillStyle = g; x.fillRect(T - 7, 0, 7, T); }
    if (mask & 8) { const g = x.createLinearGradient(0, 0, 7, 0); g.addColorStop(0, K.rgba(pal.dirtHi, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 7, T); }
    if (mask & 1) {
      const g = x.createLinearGradient(0, 0, 0, 7);
      g.addColorStop(0, K.lighten(pal.dirtHi, 0.25)); g.addColorStop(1, K.rgba(pal.dirtHi, 0));
      x.fillStyle = g; x.fillRect(0, 0, T, 7);
      if (lip) {
        x.fillStyle = lip[0];
        x.beginPath();
        x.moveTo(0, 0); x.lineTo(T, 0); x.lineTo(T, 4);
        for (let px = T; px >= 0; px -= 5) x.lineTo(px, 4 + ((px / 5) % 2 ? 3 : 0));
        x.closePath(); x.fill();
        x.fillStyle = lip[1];
        for (let px = 5; px < T; px += 11) { x.beginPath(); x.arc(px, 3, 1.6, 0, C.TAU); x.fill(); }
      }
    }
    x.restore();
    return c;
  }

  function brick(pal) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.fillStyle = K.darken(pal.brick, 0.45);
    x.fillRect(0, 0, T, T);
    const rows = 4, bh = T / rows;
    for (let r = 0; r < rows; ++r) {
      const off = r % 2 ? -10 : 0;
      for (let bx = off; bx < T; bx += 20) {
        const shade = K.hash2(bx + 50, r, 4) * 0.25;
        const col = K.mix(pal.brick, shade > 0.12 ? pal.brickHi : K.darken(pal.brick, 0.2), shade * 2);
        x.fillStyle = col;
        x.fillRect(bx + 1, r * bh + 1, 18, bh - 2);
        x.fillStyle = K.rgba(pal.brickHi, 0.55);
        x.fillRect(bx + 1, r * bh + 1, 18, 1.5);
        x.fillStyle = 'rgba(0,0,0,0.25)';
        x.fillRect(bx + 1, r * bh + bh - 2.5, 18, 1.5);
      }
    }
    return c;
  }

  function steel(pal) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, T, T);
    g.addColorStop(0, pal.steelHi); g.addColorStop(0.45, pal.steel); g.addColorStop(1, K.darken(pal.steel, 0.4));
    x.fillStyle = g;
    x.fillRect(0, 0, T, T);
    x.fillStyle = K.darken(pal.steel, 0.25);
    x.fillRect(3, 3, T - 6, T - 6);
    const g2 = x.createLinearGradient(0, 0, T, T);
    g2.addColorStop(0, K.lighten(pal.steel, 0.15)); g2.addColorStop(1, K.darken(pal.steel, 0.15));
    x.fillStyle = g2;
    x.fillRect(5, 5, T - 10, T - 10);
    x.strokeStyle = K.rgba('#ffffff', 0.12);
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(8, T - 14); x.lineTo(T - 14, 8); x.stroke();
    for (const [px, py] of [[8, 8], [T - 8, 8], [8, T - 8], [T - 8, T - 8]]) {
      K.orb(x, px, py, 2.6, pal.steel, pal.steelHi, K.darken(pal.steel, 0.5));
    }
    return c;
  }

  function boulder(pal, v) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const r = K.rand(900 + v * 31);
    const pts = [];
    const n = 11;
    for (let i = 0; i < n; ++i) {
      const a = i / n * C.TAU;
      const rad = 16.5 + r() * 2.5;
      pts.push(T / 2 + Math.cos(a) * rad, T / 2 + 1 + Math.sin(a) * rad * 0.94);
    }
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath(); x.ellipse(T / 2 + 1, T - 4, 15, 4, 0, 0, C.TAU); x.fill();
    const base = K.mix('#8c8580', pal.rockHi, 0.35);
    const gr = x.createRadialGradient(T * 0.36, T * 0.32, 2, T / 2, T / 2, 22);
    gr.addColorStop(0, K.lighten(base, 0.45)); gr.addColorStop(0.5, base); gr.addColorStop(1, K.darken(base, 0.55));
    x.fillStyle = gr;
    K.poly(x, pts);
    x.fill();
    x.strokeStyle = K.darken(base, 0.6);
    x.lineWidth = 1.5;
    x.stroke();
    x.strokeStyle = K.rgba(K.darken(base, 0.55), 0.8);
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(T * 0.55 + r() * 4, T * 0.3); x.lineTo(T * 0.62, T * 0.5); x.lineTo(T * 0.56 + r() * 5, T * 0.68);
    if (v % 2) { x.moveTo(T * 0.3, T * 0.62); x.lineTo(T * 0.42, T * 0.7); }
    x.stroke();
    for (let k = 0; k < 6; ++k) {
      x.fillStyle = K.rgba(k % 2 ? '#ffffff' : '#000000', 0.15);
      x.beginPath(); x.arc(10 + r() * 20, 10 + r() * 20, 1 + r() * 1.5, 0, C.TAU); x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.beginPath(); x.ellipse(T * 0.38, T * 0.3, 5, 3, -0.6, 0, C.TAU); x.fill();
    return c;
  }

  /* faceted gem; f shifts the sparkle and hue */
  function gem(f, big) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const cx = T / 2, cy = T / 2 + 1;
    const base = big ? '#ff5ae0' : '#38e6ff', hi = big ? '#ffd0f6' : '#d8fbff', lo = big ? '#8a1a90' : '#0a6b9a';
    const w = big ? 17 : 14, h = big ? 17 : 15;
    if (big) {
      for (const [dx, s] of [[-9, 0.7], [9, 0.75]]) {
        x.fillStyle = K.mix(base, lo, 0.3);
        K.poly(x, [cx + dx, cy - h * s, cx + dx + 5, cy - 2, cx + dx, cy + h * 0.8, cx + dx - 5, cy - 2]);
        x.fill();
      }
    }
    const top = cy - h, mid = cy - h * 0.3, bot = cy + h;
    const facets = [
      [cx - w, mid, cx - w * 0.5, top, cx, mid, hi],
      [cx, mid, cx - w * 0.5, top, cx + w * 0.5, top, K.lighten(base, 0.3)],
      [cx, mid, cx + w * 0.5, top, cx + w, mid, base],
      [cx - w, mid, cx, mid, cx, bot, K.mix(base, hi, 0.25)],
      [cx, mid, cx + w, mid, cx, bot, lo]
    ];
    const shift = (f % 8) / 8;
    for (let i = 0; i < facets.length; ++i) {
      const p = facets[i];
      x.fillStyle = K.mix(p[6], '#ffffff', Math.max(0, Math.sin((shift + i * 0.2) * C.TAU)) * 0.25);
      K.poly(x, [p[0], p[1], p[2], p[3], p[4], p[5]]);
      x.fill();
    }
    x.strokeStyle = K.rgba('#ffffff', 0.55);
    x.lineWidth = 1;
    K.poly(x, [cx - w, mid, cx - w * 0.5, top, cx + w * 0.5, top, cx + w, mid, cx, bot]);
    x.stroke();
    /* travelling sparkle */
    const sa = Math.max(0, Math.sin(shift * C.TAU));
    if (sa > 0.2) {
      x.fillStyle = K.rgba('#ffffff', sa);
      K.star(x, cx - w * 0.4 + shift * w * 0.8, top + 5, 5 * sa + 1, 1, 4);
      x.fill();
    }
    return c;
  }

  function exitTile(pal, open, f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.drawImage(steel(pal), 0, 0);
    x.fillStyle = '#120c08';
    K.roundRect(x, 6, 4, T - 12, T - 6, 12);
    x.fill();
    if (!open) {
      x.fillStyle = K.darken(pal.steel, 0.2);
      K.roundRect(x, 8, 6, T - 16, T - 10, 10); x.fill();
      x.strokeStyle = K.darken(pal.steel, 0.5);
      x.lineWidth = 2;
      for (let yy = 12; yy < T - 6; yy += 6) { x.beginPath(); x.moveTo(10, yy); x.lineTo(T - 10, yy); x.stroke(); }
      x.fillStyle = '#ffd54a';
      x.beginPath(); x.arc(T / 2, T / 2 + 2, 3, 0, C.TAU); x.fill();
      return c;
    }
    const a = f / 8 * C.TAU;
    const g = x.createRadialGradient(T / 2, T / 2 + 2, 1, T / 2, T / 2 + 2, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#ffe9a0'); g.addColorStop(0.75, '#ffb347'); g.addColorStop(1, 'rgba(255,120,40,0.2)');
    x.fillStyle = g;
    K.roundRect(x, 8, 6, T - 16, T - 10, 10);
    x.fill();
    x.save();
    x.translate(T / 2, T / 2 + 2);
    x.rotate(a);
    x.strokeStyle = 'rgba(255,255,255,0.7)';
    x.lineWidth = 2;
    for (let k = 0; k < 3; ++k) {
      x.beginPath();
      x.arc(0, 0, 5 + k * 4, k * 2, k * 2 + 2.2);
      x.stroke();
    }
    x.restore();
    return c;
  }

  function magic(pal, f, active) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.drawImage(brick(Object.assign({}, pal, { brick: '#4a3a6a', brickHi: '#8a6fc0' })), 0, 0);
    const glowA = active ? 0.55 + 0.45 * Math.sin(f / 4 * C.TAU) : 0.25;
    x.strokeStyle = K.rgba(active ? '#e8b0ff' : '#a080d0', glowA);
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(T / 2, 7); x.lineTo(T / 2, T - 7);
    x.moveTo(12, 14 + f); x.lineTo(T - 12, 26 - f);
    x.stroke();
    if (active) {
      x.fillStyle = K.rgba('#ffffff', glowA * 0.6);
      x.beginPath(); x.arc(T / 2, T / 2, 4, 0, C.TAU); x.fill();
    }
    return c;
  }

  function amoeba(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.fillStyle = '#1f5a1a';
    x.fillRect(0, 0, T, T);
    const r = K.rand(40 + f);
    for (let k = 0; k < 7; ++k) {
      const px = 4 + r() * (T - 8), py = 4 + r() * (T - 8), s = 6 + r() * 7 + Math.sin(f + k) * 1.5;
      K.orb(x, px, py, s, '#4fcf3a', '#c8ff9a', '#1f6a1a');
    }
    for (let k = 0; k < 4; ++k) {
      x.fillStyle = 'rgba(230,255,200,0.6)';
      x.beginPath(); x.arc(6 + r() * 28, 6 + r() * 28, 1.4, 0, C.TAU); x.fill();
    }
    return c;
  }

  function lava(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, '#ffd54a'); g.addColorStop(0.4, '#ff7a1a'); g.addColorStop(1, '#a8200a');
    x.fillStyle = g;
    x.fillRect(0, 0, T, T);
    for (let py = 0; py < T; py += 4)
      for (let px = 0; px < T; px += 4) {
        const n = K.smooth(px / 10 + f * 0.5, py / 10 - f * 0.25, 9);
        if (n > 0.6) { x.fillStyle = K.rgba('#fff2a0', (n - 0.6) * 2); x.fillRect(px, py, 4, 4); }
        if (n < 0.3) { x.fillStyle = K.rgba('#5a0a00', (0.3 - n) * 1.5); x.fillRect(px, py, 4, 4); }
      }
    x.fillStyle = 'rgba(255,240,180,0.8)';
    x.beginPath(); x.arc(10 + f * 6, 8 + (f % 2) * 4, 2.5, 0, C.TAU); x.fill();
    return c;
  }

  function ice() {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, T, T);
    g.addColorStop(0, 'rgba(230,250,255,0.95)'); g.addColorStop(0.5, 'rgba(140,210,245,0.9)'); g.addColorStop(1, 'rgba(60,130,190,0.95)');
    x.fillStyle = g;
    K.roundRect(x, 2, 2, T - 4, T - 4, 6);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.lineWidth = 1.5;
    x.stroke();
    x.strokeStyle = 'rgba(255,255,255,0.6)';
    x.beginPath(); x.moveTo(8, 26); x.lineTo(16, 10); x.moveTo(14, 30); x.lineTo(26, 8); x.stroke();
    return c;
  }

  function tnt() {
    const c = K.canvas(T, T), x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath(); x.ellipse(T / 2, T - 4, 14, 3.5, 0, 0, C.TAU); x.fill();
    const g = x.createLinearGradient(6, 0, T - 6, 0);
    g.addColorStop(0, '#7a1608'); g.addColorStop(0.35, '#e0401f'); g.addColorStop(0.6, '#c8301a'); g.addColorStop(1, '#5a0e05');
    x.fillStyle = g;
    K.roundRect(x, 7, 6, T - 14, T - 10, 6);
    x.fill();
    x.fillStyle = '#3a2a20';
    x.fillRect(7, 11, T - 14, 3); x.fillRect(7, T - 11, T - 14, 3);
    x.fillStyle = '#f4e6c8';
    x.fillRect(11, 17, T - 22, 9);
    x.fillStyle = '#a0200a';
    x.font = 'bold 8px ' + C.FONT;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('TNT', T / 2, 22);
    x.strokeStyle = '#3a2a20';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(T / 2, 6); x.quadraticCurveTo(T / 2 + 6, 1, T / 2 + 9, 3); x.stroke();
    return c;
  }

  function explode(f) {
    const c = K.canvas(T, T), x = c.getContext('2d');
    const k = 1 - f / 4;
    const g = x.createRadialGradient(T / 2, T / 2, 1, T / 2, T / 2, 20);
    g.addColorStop(0, K.rgba('#ffffff', k));
    g.addColorStop(0.3, K.rgba('#ffe27a', k));
    g.addColorStop(0.7, K.rgba('#ff6a1a', k * 0.8));
    g.addColorStop(1, 'rgba(120,20,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, T, T);
    const r = K.rand(300 + f);
    x.fillStyle = K.rgba('#fff6c0', k);
    for (let i = 0; i < 5; ++i) { x.beginPath(); x.arc(6 + r() * 28, 6 + r() * 28, 2 + r() * 3 * k, 0, C.TAU); x.fill(); }
    return c;
  }

  function build(pal, seasonId) {
    const lip = LIPS[seasonId] || null;
    const tex = [dirtTexture(pal, 0), dirtTexture(pal, 1)];
    const dirt = [[], []];
    for (let v = 0; v < 2; ++v)
      for (let m = 0; m < 16; ++m) dirt[v].push(dirtShape(tex[v], pal, m, lip));
    const set = {
      dirt, brick: brick(pal), steel: steel(pal),
      boulder: [0, 1, 2, 3].map((v) => boulder(pal, v)),
      gem: [], biggem: [], exitOpen: [], magicOn: [], amoeba: [], lava: [], explode: [],
      exitClosed: exitTile(pal, false, 0), magicOff: magic(pal, 0, false), ice: ice(), tnt: tnt()
    };
    for (let f = 0; f < 8; ++f) {
      set.gem.push(gem(f, false));
      set.biggem.push(gem(f, true));
      set.exitOpen.push(exitTile(pal, true, f));
    }
    for (let f = 0; f < 4; ++f) {
      set.magicOn.push(magic(pal, f, true));
      set.amoeba.push(amoeba(f));
      set.lava.push(lava(f));
      set.explode.push(explode(f));
    }
    return set;
  }

  function tiles(themeId, seasonId) {
    const key = themeId + '|' + (seasonId || '');
    if (!cache[key]) cache[key] = build(NS.story.THEMES[themeId] || NS.story.THEMES.amber, seasonId);
    return cache[key];
  }

  Object.assign(NS.tileArt, { tiles, LIPS });
})();
