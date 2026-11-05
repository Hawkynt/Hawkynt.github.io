/* Scenery: the themed cavern vista (layered rock silhouettes, glowing crystals, mushrooms,
   icicles or lava falls, plus the season's decorations) that fills menus and bleeds into the
   letterbox around the cave, the cave's own back wall painted once per cave, and the drifting
   ambient particles (dust, snow, spores, embers, sparkles, petals, leaves, bats, fireworks).
   Owns the scenery caches and the ambient particle list. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const { ctx, visible } = NS.view;
  const T = C.TILE;

  const vistas = {};
  let wall = null, wallKey = '';

  function pal(id) {
    return NS.story.THEMES[id] || NS.story.THEMES.amber;
  }

  function crystal(x, cx, cy, h, col, a) {
    x.save();
    x.translate(cx, cy);
    x.rotate(a);
    const g = x.createLinearGradient(-h * 0.2, 0, h * 0.2, 0);
    g.addColorStop(0, K.lighten(col, 0.5)); g.addColorStop(0.5, col); g.addColorStop(1, K.darken(col, 0.4));
    x.fillStyle = g;
    K.poly(x, [0, -h, h * 0.18, -h * 0.75, h * 0.16, 0, -h * 0.16, 0, -h * 0.18, -h * 0.75]);
    x.fill();
    x.restore();
  }

  function decor(x, p, themeId, w, h, r, density) {
    const glowCol = p.glow;
    for (let k = 0; k < density; ++k) {
      const px = r() * w, py = h * (0.35 + r() * 0.65), s = 0.5 + r();
      x.globalAlpha = 0.5 + r() * 0.5;
      x.drawImage(K.glow(glowCol), px - 30 * s, py - 30 * s, 60 * s, 60 * s);
      x.globalAlpha = 1;
      if (themeId === 'grotto') {
        x.fillStyle = K.darken(p.rock, 0.3);
        x.fillRect(px - 2 * s, py - 10 * s, 4 * s, 12 * s);
        x.fillStyle = r() < 0.5 ? '#7dffb5' : '#c58bff';
        x.beginPath(); x.ellipse(px, py - 10 * s, 10 * s, 6 * s, 0, Math.PI, 0); x.fill();
      } else if (themeId === 'magma') {
        x.fillStyle = K.rgba('#ff7a2f', 0.8);
        x.fillRect(px - 1.5 * s, py - 40 * s, 3 * s, 40 * s);
      } else if (themeId === 'frost') {
        x.fillStyle = K.rgba('#dff6ff', 0.85);
        K.poly(x, [px - 5 * s, 0, px + 5 * s, 0, px, 40 * s * (0.5 + r())]);
        x.fill();
        crystal(x, px, py, 22 * s, '#9ff1ff', (r() - 0.5) * 0.6);
      } else {
        for (let c = 0; c < 3; ++c) crystal(x, px + (c - 1) * 7 * s, py, (14 + r() * 18) * s, glowCol, (c - 1) * 0.35);
      }
    }
  }

  function seasonDecor(x, w, h, season, r) {
    if (!season) return;
    x.save();
    switch (season.decor) {
      case 'snow':
      case 'fireworks':
        x.fillStyle = 'rgba(240,250,255,0.85)';
        for (let px = 0; px < w; px += 6) { const hh = 4 + K.smooth(px / 40, 0, 5) * 10; x.fillRect(px, h * 0.72 - hh + 2, 6, hh); }
        if (season.decor === 'fireworks')
          for (let k = 0; k < 4; ++k) {
            const fx = r() * w, fy = h * (0.08 + r() * 0.25), col = [season.color, season.color2, '#5fd6ff', '#7dff8a'][k];
            x.strokeStyle = K.rgba(col, 0.7); x.lineWidth = 2;
            for (let a = 0; a < 12; ++a) { const an = a / 12 * C.TAU; x.beginPath(); x.moveTo(fx + Math.cos(an) * 6, fy + Math.sin(an) * 6); x.lineTo(fx + Math.cos(an) * 22, fy + Math.sin(an) * 22); x.stroke(); }
          }
        break;
      case 'petals':
        for (let k = 0; k < 18; ++k) {
          const px = r() * w, py = h * (0.7 + r() * 0.25);
          x.fillStyle = ['#ffb0d8', '#ffe066', '#ffffff', '#c58bff'][k % 4];
          for (let q = 0; q < 5; ++q) { const a = q / 5 * C.TAU; x.beginPath(); x.arc(px + Math.cos(a) * 3, py + Math.sin(a) * 3, 2.4, 0, C.TAU); x.fill(); }
        }
        break;
      case 'sun':
        x.drawImage(K.glow('#ffe066'), w * 0.75, -h * 0.15, h * 0.6, h * 0.6);
        break;
      case 'leaves':
        for (let k = 0; k < 26; ++k) {
          x.fillStyle = ['#e0802a', '#c9502a', '#e0c040'][k % 3];
          x.beginPath(); x.ellipse(r() * w, h * (0.74 + r() * 0.22), 4, 2, r() * 3, 0, C.TAU); x.fill();
        }
        break;
      case 'bats':
        for (let k = 0; k < 4; ++k) {
          const px = w * (0.1 + r() * 0.8), py = h * (0.68 + r() * 0.2), s = 8 + r() * 6;
          x.drawImage(K.glow('#ff8a1a'), px - s * 2, py - s * 2, s * 4, s * 4);
          K.orb(x, px, py, s, '#ff8a1a', '#ffd08a', '#a04a00');
          x.fillStyle = '#ffe36a';
          K.poly(x, [px - s * 0.5, py - 1, px - s * 0.2, py - s * 0.4, px, py - 1]); x.fill();
          K.poly(x, [px + s * 0.5, py - 1, px + s * 0.2, py - s * 0.4, px, py - 1]); x.fill();
        }
        break;
    }
    x.restore();
  }

  /* 640 x 360 vista, scaled up to cover the view */
  function vista(themeId) {
    const season = G.season;
    const key = themeId + '|' + (season ? season.id : '');
    if (vistas[key]) return vistas[key];
    const p = pal(themeId);
    const w = 640, h = 360;
    const c = K.canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.skyTop); g.addColorStop(1, p.skyBottom);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    const r = K.rand(K.parse(p.rock)[0] * 31 + 7);
    for (let layer = 0; layer < 4; ++layer) {
      const depth = layer / 3;
      const col = K.mix(K.darken(p.skyTop, 0.1), p.rock, 0.25 + depth * 0.6);
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(0, 0);
      for (let px = 0; px <= w; px += 16) x.lineTo(px, 20 + layer * 14 + K.fbm(px / 90, layer, 3) * (60 + layer * 20));
      x.lineTo(w, 0);
      x.closePath();
      x.fill();
      x.beginPath();
      x.moveTo(0, h);
      for (let px = 0; px <= w; px += 16) x.lineTo(px, h - 30 - (3 - layer) * 26 - K.fbm(px / 80, layer + 9, 4) * (70 + (3 - layer) * 10));
      x.lineTo(w, h);
      x.closePath();
      x.fill();
      if (layer === 1) decor(x, p, themeId, w, h, r, 9);
      if (layer === 3) decor(x, p, themeId, w, h, r, 5);
    }
    seasonDecor(x, w, h, season, r);
    const v = x.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = v;
    x.fillRect(0, 0, w, h);
    vistas[key] = c;
    return c;
  }

  /* draws the vista over the whole visible rect with a gentle parallax drift */
  function drawVista(themeId, px, py) {
    const v = visible();
    const img = vista(themeId);
    const s = Math.max(v.w / img.width, v.h / img.height) * 1.08;
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, v.x0 + (v.w - w) / 2 + (px || 0) * 0.03 * s, v.y0 + (v.h - h) / 2 + (py || 0) * 0.03 * s, w, h);
  }

  /* the cave's back wall, painted at half resolution once per cave */
  function backWall(cv, themeId) {
    const key = cv.seed + '|' + themeId + '|' + cv.w + 'x' + cv.h;
    if (wall && wallKey === key) return wall;
    const p = pal(themeId);
    const W = cv.w * T / 2, H = cv.h * T / 2;
    const c = K.canvas(W, H), x = c.getContext('2d');
    x.fillStyle = p.bg;
    x.fillRect(0, 0, W, H);
    const step = 4;
    for (let py = 0; py < H; py += step)
      for (let px = 0; px < W; px += step) {
        const n = K.fbm(px / 60, py / 60, cv.seed & 255);
        if (n > 0.5) { x.fillStyle = K.rgba(p.rock, (n - 0.5) * 1.1); x.fillRect(px, py, step, step); }
      }
    const r = K.rand(cv.seed);
    x.strokeStyle = K.rgba(K.darken(p.bg, 0.5), 0.8);
    x.lineWidth = 1.5;
    for (let k = 0; k < cv.w; ++k) {
      let px = r() * W, py = r() * H;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 4; ++s) { px += (r() - 0.5) * 30; py += r() * 18; x.lineTo(px, py); }
      x.stroke();
    }
    for (let k = 0; k < cv.w / 2; ++k) {
      const px = r() * W, py = r() * H;
      x.globalAlpha = 0.25 + r() * 0.3;
      x.drawImage(K.glow(p.vein), px - 12, py - 12, 24, 24);
      x.globalAlpha = 1;
      x.fillStyle = K.rgba(p.vein, 0.5);
      x.fillRect(px - 1, py - 1, 2, 2);
    }
    wall = c;
    wallKey = key;
    return c;
  }

  /* ── Seasonal decorations hung along the cave's top border ── */
  const garlands = {};
  function garland(season) {
    if (garlands[season.id]) return garlands[season.id];
    const c = K.canvas(T * 2, T * 1.4), x = c.getContext('2d');
    const w = T * 2;
    x.strokeStyle = season.id === 'halloween' ? 'rgba(220,220,230,0.7)' : season.id === 'spring' || season.id === 'autumn' ? '#4a7a2a' : '#2a3a2a';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, 4); x.quadraticCurveTo(w / 2, 22, w, 4); x.stroke();
    const mid = (t) => [t * w, 4 + 18 * (1 - (2 * t - 1) * (2 * t - 1)) * 0.95];
    switch (season.id) {
      case 'yearend':
      case 'winter':
        for (let k = 0; k < 4; ++k) {
          const [px, py] = mid((k + 0.5) / 4);
          const col = season.id === 'winter' ? ['#cfefff', '#5fd6ff', '#ffffff', '#9ff1ff'][k] : ['#ff4fa0', '#ffd54a', '#5fd6ff', '#7dff8a'][k];
          x.drawImage(K.glow(col), px - 10, py - 4, 20, 20);
          K.orb(x, px, py + 6, 3.5, col, '#ffffff', K.darken(col, 0.4));
        }
        if (season.id === 'winter') { x.fillStyle = 'rgba(230,248,255,0.9)'; for (let k = 0; k < 6; ++k) K.poly(x, [k * 13 + 2, 2, k * 13 + 8, 2, k * 13 + 5, 10 + (k % 3) * 5]), x.fill(); }
        break;
      case 'halloween':
        for (let k = 0; k < 2; ++k) {
          const [px, py] = mid(0.25 + k * 0.5);
          x.drawImage(K.glow('#ff8a1a'), px - 16, py - 6, 32, 32);
          K.orb(x, px, py + 10, 8, '#ff8a1a', '#ffd08a', '#a04a00');
          x.fillStyle = '#ffe36a';
          K.poly(x, [px - 4, py + 8, px - 1, py + 8, px - 2.5, py + 5]); x.fill();
          K.poly(x, [px + 1, py + 8, px + 4, py + 8, px + 2.5, py + 5]); x.fill();
          x.fillRect(px - 4, py + 12, 8, 2);
        }
        x.strokeStyle = 'rgba(230,230,240,0.5)'; x.lineWidth = 1;
        for (let k = 0; k < 4; ++k) { x.beginPath(); x.moveTo(0, 0); x.lineTo(18, 6 + k * 6); x.stroke(); }
        break;
      case 'spring':
        for (let k = 0; k < 5; ++k) {
          const [px, py] = mid((k + 0.5) / 5);
          x.fillStyle = ['#ffb0d8', '#ffe066', '#ffffff', '#c58bff', '#ff9ac8'][k];
          for (let q = 0; q < 5; ++q) { const a = q / 5 * C.TAU; x.beginPath(); x.arc(px + Math.cos(a) * 3, py + 4 + Math.sin(a) * 3, 2.6, 0, C.TAU); x.fill(); }
          x.fillStyle = '#ffd54a'; x.beginPath(); x.arc(px, py + 4, 1.6, 0, C.TAU); x.fill();
        }
        break;
      case 'summer':
        for (let k = 0; k < 5; ++k) {
          const [px, py] = mid((k + 0.5) / 5);
          x.fillStyle = ['#ff5d5d', '#ffd54a', '#2fd0c8', '#ff8a3c', '#5fd6ff'][k];
          K.poly(x, [px - 6, py - 2, px + 6, py - 2, px, py + 12]); x.fill();
        }
        break;
      default:
        for (let k = 0; k < 6; ++k) {
          const [px, py] = mid((k + 0.5) / 6);
          x.fillStyle = ['#e0802a', '#c9502a', '#e0c040'][k % 3];
          x.beginPath(); x.ellipse(px, py + 5, 5, 2.6, k, 0, C.TAU); x.fill();
        }
    }
    garlands[season.id] = c;
    return c;
  }

  /* hangs the season's garland under the top border and snow on exposed boulders in winter */
  function drawSeasonDecor(cv, ox, oy) {
    const s = G.season;
    if (!s) return;
    const g = garland(s);
    for (let c = 0; c < cv.w - 1; c += 2) {
      const sway = Math.sin(G.time * 1.4 + c * 0.7) * 1.5;
      ctx.drawImage(g, ox + c * T, oy + T - 4 + sway);
    }
  }

  /* ── Ambient particles (view space) ── */
  const amb = [];
  function ambientKind(themeId) {
    const s = G.season;
    if (s && (s.decor === 'snow' || s.decor === 'fireworks')) return 'snow';
    if (s && s.decor === 'petals') return 'petals';
    if (s && s.decor === 'leaves') return 'leaves';
    return pal(themeId).ambient;
  }

  function drawAmbient(themeId, dt, count) {
    const v = visible();
    const kind = ambientKind(themeId);
    if (kind === 'none') return;
    const n = count || 46;
    while (amb.length < n) amb.push({ x: v.x0 + Math.random() * v.w, y: v.y0 + Math.random() * v.h, s: 0.5 + Math.random(), p: Math.random() * 6 });
    const p = pal(themeId);
    for (let i = 0; i < n; ++i) {
      const a = amb[i];
      a.p += dt;
      let vx = 0, vy = 0, col = p.glow, size = 2 * a.s, glowIt = true;
      switch (kind) {
        case 'snow': vx = Math.sin(a.p) * 12; vy = 26 * a.s; col = '#ffffff'; glowIt = false; break;
        case 'petals': vx = 18 + Math.sin(a.p * 1.3) * 16; vy = 20 * a.s; col = '#ffb0d8'; size = 3 * a.s; glowIt = false; break;
        case 'leaves': vx = 14 + Math.sin(a.p) * 22; vy = 24 * a.s; col = '#e0802a'; size = 3 * a.s; glowIt = false; break;
        case 'embers': vx = Math.sin(a.p * 2) * 10; vy = -30 * a.s; col = '#ff9a3c'; break;
        case 'spores': vx = Math.sin(a.p * 0.7) * 10; vy = -8 * a.s; col = i % 2 ? '#7dffb5' : '#c58bff'; break;
        case 'sparkle': vx = Math.sin(a.p) * 6; vy = -6 * a.s; col = i % 3 ? p.glow : '#ffffff'; break;
        case 'motes': vx = Math.sin(a.p * 0.5) * 8; vy = -5 * a.s; col = '#c9fff4'; break;
        default: vx = Math.sin(a.p * 0.6) * 6; vy = 6 * a.s; col = p.vein;
      }
      a.x += vx * dt; a.y += vy * dt;
      if (a.y > v.y1 + 10) { a.y = v.y0 - 10; a.x = v.x0 + Math.random() * v.w; }
      if (a.y < v.y0 - 10) { a.y = v.y1 + 10; a.x = v.x0 + Math.random() * v.w; }
      if (a.x > v.x1 + 10) a.x = v.x0 - 10;
      if (a.x < v.x0 - 10) a.x = v.x1 + 10;
      const tw = 0.5 + 0.5 * Math.sin(a.p * 2.3);
      if (glowIt) {
        ctx.globalAlpha = 0.35 + tw * 0.4;
        ctx.drawImage(K.glow(col), a.x - size * 4, a.y - size * 4, size * 8, size * 8);
      } else {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = col;
        ctx.fillRect(a.x - size / 2, a.y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.backdrop, { vista, drawVista, backWall, drawAmbient, drawSeasonDecor, garland });
})();
