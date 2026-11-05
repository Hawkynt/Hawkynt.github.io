/* The layered backdrop for each chapter (and the title), covering the whole visible plane at any
   aspect: an fbm nebula painted once into a small canvas and stretched, three drifting star
   tiles, twinkling bright stars, the chapter's planet (ringed, molten, crystalline, stormy or a
   black hole), the season's tint and its drifting decor (snow, petals, solar glare and embers,
   falling leaves, wisps, fireworks) computed from the clock, so it costs no state. Owns the
   current theme index. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, VIEW_W, VIEW_H } = NS.constants;
  const { CHAPTERS } = NS.campaign;
  const K = NS.artKit;
  const P = NS.propArt;
  const { makeRng, hashString } = NS.rng;
  const { ctx, visible } = NS.view;

  const TITLE_THEME = { bg0: '#02030a', bg1: '#0a1030', neb: ['#2a1a6a', '#3a8ad0', '#0a0a30'], accent: '#5ad8ff', star: '#e8f0ff',
    planet: { col: '#4a7ad0', dark: '#0a1430', ring: true, x: 1060, y: 560, r: 130 }, dust: '#bfe8ff' };

  let chapter = -1;
  const nebCache = {};

  function theme() {
    return chapter < 0 ? TITLE_THEME : CHAPTERS[chapter].theme;
  }

  function setChapter(i) {
    chapter = i;
  }

  function current() {
    return chapter;
  }

  /* fbm nebula into a 320 x 180 canvas, cached per chapter */
  function nebula(idx) {
    const key = idx + ':' + (G.cal ? G.cal.season : '');
    if (nebCache[key]) return nebCache[key];
    const th = idx < 0 ? TITLE_THEME : CHAPTERS[idx].theme;
    const w = 320, h = 180;
    const c = K.makeCanvas(w, h);
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const d = img.data;
    const n1 = K.valueNoise(hashString('neb' + idx)), n2 = K.valueNoise(hashString('neb2' + idx));
    const b0 = K.parse(th.bg0), b1 = K.parse(th.bg1), c0 = K.parse(th.neb[0]), c1 = K.parse(th.neb[1]), c2 = K.parse(th.neb[2]);
    const tint = G.cal ? K.parse(G.cal.seasonDef.tint) : null;
    const tk = idx < 0 ? 0.16 : 0.06;
    for (let y = 0; y < h; ++y)
      for (let x = 0; x < w; ++x) {
        const v = K.fbm(n1, x / 70, y / 70, 5);
        const v2 = K.fbm(n2, x / 40 + 9, y / 40 + 3, 4);
        const gy = y / h;
        const cloud = K.smooth(0.45, 0.85, v);
        const wisp = K.smooth(0.55, 0.9, v2) * 0.6;
        const i = (y * w + x) * 4;
        for (let k = 0; k < 3; ++k) {
          let col = b0[k] + (b1[k] - b0[k]) * (0.5 + 0.5 * Math.sin(gy * 3 + v * 2)) * 0.6;
          col += (c0[k] - col) * cloud * 0.75;
          col += (c1[k] - col) * wisp * cloud * 0.8;
          col += (c2[k] - col) * (1 - cloud) * 0.3;
          if (tint) col += (tint[k] - col) * tk * (0.4 + cloud);
          d[i + k] = col;
        }
        d[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    nebCache[key] = c;
    return c;
  }

  function starTile(layer) {
    return K.sprite('stars:' + layer, 512, 512, (g) => {
      const rng = makeRng(hashString('stars' + layer));
      const n = [260, 90, 30][layer];
      for (let i = 0; i < n; ++i) {
        const x = rng() * 512, y = rng() * 512;
        const s = [0.5, 0.9, 1.4][layer] * (0.6 + rng() * 0.8);
        const tint = rng();
        g.fillStyle = tint < 0.15 ? '#ffd8a0' : tint < 0.3 ? '#a8c8ff' : '#ffffff';
        g.globalAlpha = [0.45, 0.7, 0.95][layer] * (0.5 + rng() * 0.5);
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
        if (layer === 2 && rng() < 0.4) {
          g.globalAlpha *= 0.4;
          g.fillRect(x - s * 4, y - 0.4, s * 8, 0.8);
          g.fillRect(x - 0.4, y - s * 4, 0.8, s * 8);
        }
      }
    });
  }

  function planet(idx) {
    const th = idx < 0 ? TITLE_THEME : CHAPTERS[idx].theme;
    const p = th.planet;
    const R = p.r;
    return K.sprite('planet:' + idx, R * 2.8, R * 2.8, (g, w) => {
      const c = w / 2;
      if (p.hole) {
        const gr = g.createRadialGradient(c, c, R * 0.3, c, c, R * 1.4);
        gr.addColorStop(0, '#000000');
        gr.addColorStop(0.32, '#000000');
        gr.addColorStop(0.36, 'rgba(255,190,210,0.95)');
        gr.addColorStop(0.5, 'rgba(255,60,110,0.5)');
        gr.addColorStop(1, 'rgba(80,0,20,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, w);
        g.strokeStyle = 'rgba(255,140,170,0.5)';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(c, c, R * 1.2, R * 0.28, -0.2, 0, TAU);
        g.stroke();
        return;
      }
      /* atmosphere */
      const at = g.createRadialGradient(c, c, R * 0.9, c, c, R * 1.25);
      at.addColorStop(0, K.rgba(p.col, 0.5));
      at.addColorStop(1, K.rgba(p.col, 0));
      g.fillStyle = at;
      g.fillRect(0, 0, w, w);
      if (p.ring) ringHalf(g, c, R, p, true);
      const gr = g.createRadialGradient(c - R * 0.4, c - R * 0.4, R * 0.1, c, c, R);
      gr.addColorStop(0, K.shade(p.col, 0.3));
      gr.addColorStop(0.6, p.col);
      gr.addColorStop(1, p.dark);
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.clip();
      const rng = makeRng(hashString('planet' + idx));
      for (let i = 0; i < 9; ++i) {
        g.fillStyle = K.rgba(i % 2 ? p.dark : K.shade(p.col, 0.2), 0.18);
        g.fillRect(c - R, c - R + rng() * R * 2, R * 2, R * (0.04 + rng() * 0.12));
      }
      if (p.lava) {
        g.strokeStyle = 'rgba(255,200,80,0.8)';
        g.lineWidth = 2;
        for (let i = 0; i < 12; ++i) {
          let x = c + (rng() - 0.5) * R * 1.6, y = c + (rng() - 0.5) * R * 1.6;
          g.beginPath();
          g.moveTo(x, y);
          for (let k = 0; k < 4; ++k) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; g.lineTo(x, y); }
          g.stroke();
        }
      }
      if (p.crystal) {
        for (let i = 0; i < 10; ++i) {
          g.fillStyle = K.rgba('#e0c8ff', 0.25);
          const x = c + (rng() - 0.5) * R * 1.6, y = c + (rng() - 0.5) * R * 1.6, s = 8 + rng() * 16;
          K.poly(g, [[x, y - s], [x + s * 0.5, y], [x, y + s], [x - s * 0.5, y]]);
          g.fill();
        }
      }
      if (p.storm) {
        g.strokeStyle = 'rgba(220,255,200,0.3)';
        g.lineWidth = 6;
        for (let i = 0; i < 3; ++i) {
          g.beginPath();
          g.arc(c + (rng() - 0.5) * R, c + (rng() - 0.5) * R, 10 + rng() * 30, 0, 4.5);
          g.stroke();
        }
      }
      const sh = g.createRadialGradient(c - R * 0.6, c - R * 0.6, R * 0.6, c - R * 0.2, c - R * 0.2, R * 1.7);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,0,0.85)');
      g.fillStyle = sh;
      g.fillRect(0, 0, w, w);
      g.restore();
      if (p.ring) ringHalf(g, c, R, p, false);
    });
  }

  function ringHalf(g, c, R, p, back) {
    g.save();
    g.beginPath();
    if (back) g.rect(0, 0, c * 2, c);
    else g.rect(0, c, c * 2, c);
    g.clip();
    for (let i = 0; i < 4; ++i) {
      g.strokeStyle = K.rgba(i % 2 ? '#ffffff' : p.col, 0.25 - i * 0.04);
      g.lineWidth = 6 - i;
      g.beginPath();
      g.ellipse(c, c, R * (1.35 + i * 0.09), R * (0.32 + i * 0.02), -0.25, 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  /* dim: darken for menus; t: seconds */
  function draw(dim, noPlanet) {
    const v = visible();
    const th = theme();
    const t = G.time;
    ctx.fillStyle = th.bg0;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const neb = nebula(chapter);
    const sc = Math.max(v.w / 320, v.h / 180) * 1.06;
    const nw = 320 * sc, nh = 180 * sc;
    ctx.drawImage(neb, (v.x0 + v.x1) / 2 - nw / 2 + Math.sin(t * 0.03) * 12, (v.y0 + v.y1) / 2 - nh / 2 + Math.cos(t * 0.025) * 8, nw, nh);
    /* stars drift slowly at three depths */
    for (let l = 0; l < 3; ++l) {
      const tile = starTile(l);
      const ox = ((t * (2 + l * 3)) % 512 + 512) % 512, oy = ((t * (1 + l * 1.5)) % 512 + 512) % 512;
      for (let y = Math.floor((v.y0 - oy) / 512) * 512 + oy; y < v.y1; y += 512)
        for (let x = Math.floor((v.x0 - ox) / 512) * 512 + ox; x < v.x1; x += 512)
          ctx.drawImage(tile.canvas, x, y, 512, 512);
    }
    twinkle(v, t);
    if (!noPlanet) {
      const p = th.planet;
      ctx.globalAlpha = 0.95;
      K.blit(ctx, planet(chapter), p.x + Math.sin(t * 0.02) * 6, p.y + Math.cos(t * 0.017) * 4);
      ctx.globalAlpha = 1;
    }
    seasonDecor(v, t);
    if (dim) {
      ctx.fillStyle = 'rgba(0,0,6,' + dim + ')';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
  }

  function twinkle(v, t) {
    ctx.globalCompositeOperation = 'lighter';
    const glow = K.glow(theme().star);
    for (let i = 0; i < 26; ++i) {
      const x = v.x0 + ((i * 397.3) % 1) * 0 + ((i * 7919) % 1000) / 1000 * v.w;
      const y = v.y0 + ((i * 104729) % 1000) / 1000 * v.h;
      const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * (0.8 + (i % 5) * 0.3) + i));
      ctx.globalAlpha = a;
      K.blit(ctx, glow, x, y, 0.14 + (i % 3) * 0.05);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* stateless seasonal particles from the clock */
  function seasonDecor(v, t) {
    if (!G.cal) return;
    const sd = G.cal.seasonDef;
    const kind = sd.decor;
    const W = v.w + 60, H = v.h + 60;
    if (kind === 'fireworks') {
      fireworks(v, t);
      return;
    }
    if (kind === 'flares') {
      /* a hot sun glare from the upper left and rising embers */
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(t * 0.5) * 0.05;
      K.blit(ctx, K.glow('#ffb030'), v.x0 + 40, v.y0 + 30, 9);
      ctx.globalAlpha = 1;
    }
    const n = kind === 'snow' ? 70 : 40;
    const shape = kind === 'snow' ? 0 : kind === 'petals' ? 1 : kind === 'leaves' ? 2 : 3;
    const cols = kind === 'snow' ? ['#ffffff', '#cfefff'] : kind === 'petals' ? ['#ffd0e8', '#ff9ac8'] : kind === 'leaves' ? ['#ffb040', '#e06020', '#c04010'] :
      kind === 'wisps' ? ['#a0ff90'] : ['#ffd060', '#ff9a30'];
    if (kind === 'wisps' || kind === 'flares') ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; ++i) {
      const s1 = (i * 0.6180339887) % 1, s2 = (i * 0.7548776662) % 1, s3 = (i * 0.5698402910) % 1;
      const depth = 0.4 + s3 * 0.6;
      let vx = 0, vy = 0;
      switch (kind) {
        case 'snow': vx = -8 + Math.sin(t * 0.5 + i) * 14; vy = 26 * depth + 10; break;
        case 'petals': vx = 30 * depth; vy = 16 * depth; break;
        case 'leaves': vx = Math.sin(t * 0.8 + i) * 30; vy = 22 * depth; break;
        case 'wisps': vx = Math.sin(t * 0.4 + i) * 10; vy = -14 * depth; break;
        default: vx = 6; vy = -30 * depth; break;
      }
      const x = v.x0 - 30 + (((s1 * W + (kind === 'snow' || kind === 'leaves' ? vx : vx * t)) % W) + W) % W;
      const y = v.y0 - 30 + (((s2 * H + vy * t) % H) + H) % H;
      const col = cols[i % cols.length];
      if (kind === 'wisps') {
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2 + i);
        K.blit(ctx, K.glow(col), x, y, 0.3 * depth);
      } else if (kind === 'flares') {
        ctx.globalAlpha = 0.5 * depth;
        K.blit(ctx, K.glow(col), x, y, 0.12 * depth);
      } else {
        ctx.globalAlpha = 0.35 + depth * 0.4;
        K.blitRot(ctx, P.decor(shape, col), x, y, t * (0.5 + s3) + i, 0.5 + depth * 0.6);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function fireworks(v, t) {
    ctx.globalCompositeOperation = 'lighter';
    const cols = ['#ff5ad0', '#ffd25a', '#5ad8ff', '#6dff9a', '#ffffff'];
    for (let k = 0; k < 3; ++k) {
      const period = 3.1 + k * 0.7;
      const n = Math.floor((t + k * 1.3) / period);
      const life = ((t + k * 1.3) % period) / period;
      if (life > 0.6) continue;
      const rng = makeRng(hashString('fw' + k + ':' + n));
      const cx = v.x0 + v.w * (0.1 + rng() * 0.8), cy = v.y0 + v.h * (0.08 + rng() * 0.4);
      const col = cols[Math.floor(rng() * cols.length)];
      const e = life / 0.6;
      const rad = 30 + e * 90;
      ctx.globalAlpha = (1 - e) * 0.9;
      const gl = K.glow(col);
      for (let i = 0; i < 18; ++i) {
        const a = i * TAU / 18;
        K.blit(ctx, gl, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad + e * e * 30, 0.18);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* paint caches ahead of time (one per idle call) */
  let warm = -1;
  function prewarm() {
    if (warm >= CHAPTERS.length) return false;
    nebula(warm);
    planet(warm);
    ++warm;
    return true;
  }

  Object.assign(NS.backdrop, {
    TITLE_THEME, setChapter, current, theme, draw, nebula, planet, starTile, prewarm
  });
})();
