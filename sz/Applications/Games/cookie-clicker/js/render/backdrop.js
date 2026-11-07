/* The kitchen behind everything, by theme (Cozy Bakery, Night Shift, Candy Land, Tea Garden,
   Starfield): a wall gradient and tile pattern that fill the whole canvas including the
   letterbox bars, a cached decor layer (the season's decorations - snowmen and lights,
   blossoms, bunting, autumn leaves, pumpkins and cobwebs, year-end lights), the counter
   across the full width, the era-coloured glow behind the treat, drifting seasonal particles
   (snow, petals, sun motes, leaves, bats, fireworks) and a vignette. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, TAU, LAYOUT } = NS.constants;
  const K = NS.artKit;
  const { THEMES } = NS.treatData;
  const { ctx } = NS.view;

  const COUNTER_Y = 660;
  /* each season washes the kitchen in its own light */
  const TINT = { winter: 'rgba(120,170,255,0.14)', spring: 'rgba(255,170,210,0.12)', summer: 'rgba(255,220,120,0.12)',
    autumn: 'rgba(255,130,40,0.12)', halloween: 'rgba(110,40,160,0.22)', yearend: 'rgba(40,40,140,0.2)' };
  const patterns = {};
  const grads = {};
  const motes = [];
  for (let i = 0; i < 46; ++i) motes.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: Math.random(), p: Math.random() * TAU });

  function theme(id) {
    for (let i = 0; i < THEMES.length; ++i) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }

  function tile(t) {
    return K.sprite('tile:' + t.id, 64, 64, (g) => {
      if (t.id === 'bakery' || t.id === 'night') {
        /* bricks: two staggered rows with uneven tone and soft mortar */
        const r = NS.rng.create('bricks-' + t.id);
        for (let row = 0; row < 4; ++row)
          for (let k = -1; k < 2; ++k) {
            const x = k * 32 + (row % 2 ? 16 : 0), y = row * 16;
            g.fillStyle = 'rgba(' + (t.id === 'night' ? '120,140,220,' : '255,190,140,') + r.range(0.02, 0.09) + ')';
            g.fillRect(x + 1.5, y + 1.5, 29, 13);
            g.fillStyle = 'rgba(255,240,220,0.05)';
            g.fillRect(x + 1.5, y + 1.5, 29, 2);
          }
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let row = 0; row < 4; ++row) g.fillRect(0, row * 16, 64, 1.5);
      } else if (t.id === 'candy') {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 0); g.lineTo(0, 32); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.lineTo(0, 64); g.closePath(); g.fill();
      } else if (t.id === 'garden') {
        g.strokeStyle = 'rgba(220,255,200,0.07)';
        g.lineWidth = 3;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
      } else if (t.id === 'greenhouse') {
        /* glass panes in white frames with a leaf behind one */
        g.fillStyle = 'rgba(200,255,220,0.05)';
        g.fillRect(2, 2, 28, 28);
        g.fillRect(34, 34, 28, 28);
        g.strokeStyle = 'rgba(240,255,240,0.16)';
        g.lineWidth = 2;
        g.strokeRect(1, 1, 62, 62);
        g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 64); g.moveTo(0, 32); g.lineTo(64, 32); g.stroke();
        g.fillStyle = 'rgba(120,200,110,0.12)';
        g.beginPath(); g.ellipse(48, 14, 10, 4, -0.6, 0, TAU); g.fill();
      } else if (t.id === 'sanctum') {
        /* a crystal lattice */
        g.strokeStyle = 'rgba(230,180,255,0.12)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.lineTo(0, 32); g.closePath(); g.stroke();
        g.fillStyle = 'rgba(154,255,234,0.07)';
        g.beginPath(); g.moveTo(32, 18); g.lineTo(46, 32); g.lineTo(32, 46); g.lineTo(18, 32); g.closePath(); g.fill();
      } else {
        const r = NS.rng.create('tile-stars');
        for (let i = 0; i < 8; ++i) K.circle(g, r.range(0, 64), r.range(0, 64), r.range(0.4, 1.2), 'rgba(255,255,255,' + r.range(0.2, 0.7) + ')');
      }
    });
  }

  function decor(t, season) {
    return K.sprite('decor:' + t.id + ':' + season, VIEW_W, VIEW_H, (g) => {
      const r = NS.rng.create('decor-' + t.id);
      seasonDecor(g, season, r);
    });
  }

  /* what lies along the counter's edge */
  function counterDecor(g, season, r) {
    const y = COUNTER_Y;
    if (season === 'winter' || season === 'yearend') {
      g.fillStyle = 'rgba(245,250,255,0.95)';
      g.beginPath();
      g.moveTo(0, y + 4);
      for (let x = 0; x <= VIEW_W; x += 16) g.lineTo(x, y - 3 - Math.abs(Math.sin(x * 0.05)) * 5 - r.range(0, 2));
      g.lineTo(VIEW_W, y + 4);
      g.closePath();
      g.fill();
    } else if (season === 'spring') {
      for (let x = 6; x < VIEW_W; x += r.range(14, 40)) {
        g.strokeStyle = '#6aa03a';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + r.range(-3, 3), y - r.range(6, 12)); g.stroke();
        if (r.next() < 0.3) flower(g, x, y - 12, 5, ['#ffc0d8', '#ffffff', '#ffe08a'][Math.floor(r.next() * 3)]);
      }
    } else if (season === 'autumn' || season === 'halloween')
      for (let i = 0; i < 60; ++i) leaf(g, r.range(0, VIEW_W), y - r.range(-2, 4), r.range(5, 9), ['#e8782a', '#c8402a', '#e8b02a', '#8a4a1a'][i % 4], r.range(0, TAU));
    else if (season === 'summer')
      for (let x = 30; x < VIEW_W; x += 160) {
        K.ellipse(g, x, y - 4, 16, 5, 'rgba(255,240,200,0.5)');
        K.circle(g, x + 40, y - 6, 5, '#ff5a5a');
        K.circle(g, x + 52, y - 5, 4, '#ffd25a');
      }
  }

  function seasonDecor(g, season, r) {
    counterDecor(g, season, r);
    if (season === 'winter' || season === 'yearend') {
      /* string of lights along the top */
      g.strokeStyle = 'rgba(40,60,40,0.9)';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= VIEW_W; x += 20) g.lineTo(x, 8 + Math.sin(x / 80) * 8 + 8);
      g.stroke();
      const cols = season === 'yearend' ? ['#ffd25a', '#ff5ab4', '#5ad8ff', '#ffffff'] : ['#ff4a4a', '#4ae07a', '#ffd25a', '#5ab4ff'];
      for (let x = 10, i = 0; x < VIEW_W; x += 40, ++i) {
        const y = 8 + Math.sin(x / 80) * 8 + 14;
        const gr = g.createRadialGradient(x, y, 1, x, y, 12);
        gr.addColorStop(0, K.rgba(cols[i % 4], 0.6));
        gr.addColorStop(1, K.rgba(cols[i % 4], 0));
        g.fillStyle = gr;
        g.fillRect(x - 12, y - 12, 24, 24);
        K.ellipse(g, x, y, 3.5, 5, cols[i % 4]);
      }
      if (season === 'winter')
        for (let i = 0; i < 2; ++i) {
          snowman(g, i ? 420 : 46, COUNTER_Y + 4);
        }
    } else if (season === 'spring') {
      for (let i = 0; i < 14; ++i) flower(g, r.range(10, VIEW_W - 10), r.range(4, 30), r.range(6, 10), ['#ffc0d8', '#ffffff', '#ffe08a'][i % 3]);
    } else if (season === 'summer') {
      g.strokeStyle = 'rgba(80,60,40,0.8)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 12); g.quadraticCurveTo(VIEW_W / 2, 50, VIEW_W, 12); g.stroke();
      const cols = ['#ff5a5a', '#ffd25a', '#5ab4ff', '#7be08a'];
      for (let i = 0; i < 26; ++i) {
        const t = (i + 0.5) / 26, x = t * VIEW_W, y = 12 + 4 * t * (1 - t) * 38;
        g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x + 12, y); g.lineTo(x, y + 22); g.closePath();
        g.fillStyle = cols[i % 4];
        g.fill();
      }
    } else if (season === 'autumn') {
      for (let i = 0; i < 26; ++i) leaf(g, r.range(0, VIEW_W), r.range(0, 26), r.range(7, 12), ['#e8782a', '#c8402a', '#e8b02a'][i % 3], r.range(0, TAU));
    } else if (season === 'halloween') {
      for (let i = 0; i < 2; ++i) pumpkin(g, i ? 420 : 46, COUNTER_Y + 2, 30);
      g.strokeStyle = 'rgba(230,230,230,0.35)';
      g.lineWidth = 1;
      for (let k = 0; k < 6; ++k) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(k * 0.3) * 120, Math.sin(k * 0.3) * 120);
        g.stroke();
      }
      for (let k = 1; k < 5; ++k) {
        g.beginPath();
        for (let j = 0; j < 6; ++j) g.lineTo(Math.cos(j * 0.3) * k * 26, Math.sin(j * 0.3) * k * 26);
        g.stroke();
      }
    }
  }

  function snowman(g, x, y) {
    K.circle(g, x, y - 24, 24, '#f4f8ff');
    K.circle(g, x, y - 62, 17, '#ffffff');
    K.circle(g, x - 6, y - 66, 2.2, '#222');
    K.circle(g, x + 6, y - 66, 2.2, '#222');
    g.fillStyle = '#ff8a2a';
    g.beginPath(); g.moveTo(x, y - 61); g.lineTo(x + 14, y - 58); g.lineTo(x, y - 56); g.closePath(); g.fill();
    g.fillStyle = '#c83a3a';
    g.fillRect(x - 16, y - 48, 32, 6);
  }

  function flower(g, x, y, s, c) {
    for (let i = 0; i < 5; ++i) K.circle(g, x + Math.cos(i * 1.256) * s * 0.6, y + Math.sin(i * 1.256) * s * 0.6, s * 0.5, c);
    K.circle(g, x, y, s * 0.35, '#ffd25a');
  }

  function leaf(g, x, y, s, c, a) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(-s, 0);
    g.quadraticCurveTo(0, -s * 0.8, s, 0);
    g.quadraticCurveTo(0, s * 0.8, -s, 0);
    g.fillStyle = c;
    g.fill();
    g.restore();
  }

  function pumpkin(g, x, y, s) {
    for (let i = -2; i <= 2; ++i) K.ellipse(g, x + i * s * 0.32, y - s * 0.7, s * 0.42, s * 0.7, i % 2 ? '#e8701a' : '#f08a2a');
    g.fillStyle = '#4a6a2a';
    g.fillRect(x - 3, y - s * 1.55, 6, s * 0.4);
    g.fillStyle = '#ffd25a';
    g.beginPath(); g.moveTo(x - 14, y - 32); g.lineTo(x - 6, y - 26); g.lineTo(x - 14, y - 22); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(x + 14, y - 32); g.lineTo(x + 6, y - 26); g.lineTo(x + 14, y - 22); g.closePath(); g.fill();
    g.fillRect(x - 12, y - 14, 24, 4);
  }

  function vignette() {
    return K.sprite('vignette', 256, 144, (g) => {
      const gr = g.createRadialGradient(128, 72, 40, 128, 72, 150);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 256, 144);
    });
  }

  function update(dt) {
    const se = G.season;
    for (let i = 0; i < motes.length; ++i) {
      const m = motes[i];
      m.p += dt;
      const fall = se === 'summer' ? -10 : se === 'halloween' ? 0 : 24 + m.s * 30;
      m.y += fall * dt;
      m.x += Math.sin(m.p * (0.6 + m.s)) * 18 * dt + (se === 'autumn' ? 14 * dt : 0);
      if (se === 'halloween') {
        m.x += (40 + m.s * 40) * dt;
        m.y += Math.sin(m.p * 3) * 20 * dt;
      }
      if (m.y > VIEW_H + 20) m.y = -20;
      if (m.y < -30) m.y = VIEW_H + 10;
      if (m.x > VIEW_W + 40) m.x = -40;
    }
  }

  function drawMotes(v) {
    const se = G.season;
    const k = v.w / VIEW_W;
    for (let i = 0; i < motes.length; ++i) {
      const m = motes[i];
      const x = v.x0 + m.x * k, y = m.y;
      if (se === 'winter' || se === 'yearend') {
        if (se === 'yearend' && i % 3 === 0) continue;
        K.circle(ctx, x, y, 1.5 + m.s * 2.5, 'rgba(255,255,255,' + (0.35 + m.s * 0.4) + ')');
      } else if (se === 'spring') K.ellipse(ctx, x, y, 3 + m.s * 2, 2, 'rgba(255,200,220,0.7)');
      else if (se === 'summer') K.circle(ctx, x, y, 1 + m.s * 2, 'rgba(255,240,180,' + (0.2 + 0.3 * Math.sin(m.p * 2) ** 2) + ')');
      else if (se === 'autumn') leaf(ctx, x, y, 5 + m.s * 3, ['#e8782a', '#c8402a', '#e8b02a'][i % 3], m.p);
      else if (se === 'halloween') {
        if (i % 4) continue;
        const f = Math.sin(m.p * 12) * 6;
        ctx.fillStyle = 'rgba(20,10,30,0.85)';
        ctx.beginPath();
        ctx.moveTo(x - 12, y - f); ctx.quadraticCurveTo(x - 5, y - 2, x, y + 2); ctx.quadraticCurveTo(x + 5, y - 2, x + 12, y - f);
        ctx.quadraticCurveTo(x, y + 6, x - 12, y - f);
        ctx.fill();
      }
    }
    if (se === 'yearend') {
      /* a firework every few seconds */
      const t = G.time % 3.2, fx = v.x0 + ((Math.floor(G.time / 3.2) * 397) % Math.floor(v.w)), fy = 90 + (Math.floor(G.time / 3.2) * 53) % 120;
      if (t < 1.2) {
        const r = t * 70, a = 1 - t / 1.2;
        for (let i = 0; i < 12; ++i) {
          const ang = i / 12 * TAU;
          K.circle(ctx, fx + Math.cos(ang) * r, fy + Math.sin(ang) * r + t * t * 20, 2.2, 'rgba(255,' + (150 + i * 8) + ',120,' + a + ')');
        }
      }
    }
  }

  function draw(stage) {
    const v = NS.view.visible();
    const t = theme(G.profile.theme);
    const key = t.id;
    if (!grads[key]) {
      const gr = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      gr.addColorStop(0, t.top);
      gr.addColorStop(1, t.bottom);
      grads[key] = gr;
    }
    ctx.fillStyle = grads[key];
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    if (!patterns[key]) patterns[key] = ctx.createPattern(tile(t), 'repeat');
    if (patterns[key]) {
      ctx.fillStyle = patterns[key];
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
    }
    ctx.fillStyle = TINT[G.season] || 'rgba(0,0,0,0)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    /* counter along the bottom, across the bars too */
    const cg = grads['counter'] || (grads['counter'] = (() => {
      const g = ctx.createLinearGradient(0, COUNTER_Y, 0, VIEW_H);
      g.addColorStop(0, '#8a5a36');
      g.addColorStop(0.12, '#6a4228');
      g.addColorStop(1, '#2a1810');
      return g;
    })());
    ctx.fillStyle = cg;
    ctx.fillRect(v.x0, COUNTER_Y, v.w, v.y1 - COUNTER_Y);
    ctx.fillStyle = 'rgba(255,220,180,0.18)';
    ctx.fillRect(v.x0, COUNTER_Y, v.w, 3);
    ctx.drawImage(decor(t, G.season), 0, 0);
    /* era glow behind the treat */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.32 + Math.sin(G.time * 1.3) * 0.05;
    K.blit(ctx, K.glow(NS.treatArt.glowColor(stage)), LAYOUT.treatX, LAYOUT.treatY, 4.2);
    ctx.restore();
    drawMotes(v);
  }

  function drawVignette() {
    const v = NS.view.visible();
    ctx.drawImage(vignette(), v.x0, v.y0, v.w, v.h);
  }

  Object.assign(NS.backdrop, { COUNTER_Y, theme, tile, decor, update, draw, drawVignette, pumpkin, snowman, flower, leaf });
})();
