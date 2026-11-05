/* The scenery behind the maze, filling the letterbox at any aspect: one painted backdrop per
   world look (neon city, candy hills, glacier with aurora, haunted woods, volcano, synthwave),
   the season's decor layered on top (snow drifts, blossoms, sun rays, leaf piles, pumpkins,
   festival lights), and pooled ambient weather (rain, sprinkles, snow, fireflies, embers,
   petals, leaves, bats, sun motes, fireworks). Owns the scenery canvases and weather pool. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const K = NS.artKit;
  const IA = NS.itemArt;
  const TAU = Math.PI * 2;
  const R = NS.rng.fx;

  const BW = 1600, BH = 900;
  const scenes = {};

  function scene(th) {
    const key = th.backdrop + th.skyTop + th.skyBottom + th.accent;
    if (scenes[key]) return scenes[key];
    const c = K.makeCanvas(BW, BH);
    const g = c.getContext('2d');
    const rng = NS.rng.makeRng(NS.rng.hashString(key));
    const sky = g.createLinearGradient(0, 0, 0, BH);
    sky.addColorStop(0, th.skyTop);
    sky.addColorStop(1, th.skyBottom);
    g.fillStyle = sky;
    g.fillRect(0, 0, BW, BH);
    switch (th.backdrop) {
      case 'city': city(g, th, rng); break;
      case 'candy': candy(g, th, rng); break;
      case 'glacier': glacier(g, th, rng); break;
      case 'woods': woods(g, th, rng); break;
      case 'volcano': volcano(g, th, rng); break;
      case 'synth': synth(g, th, rng); break;
    }
    /* soft vignette */
    const v = g.createRadialGradient(BW / 2, BH / 2, BH * 0.3, BW / 2, BH / 2, BW * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v;
    g.fillRect(0, 0, BW, BH);
    scenes[key] = c;
    return c;
  }

  function stars(g, rng, n, maxY) {
    for (let i = 0; i < n; ++i) {
      g.fillStyle = 'rgba(255,255,255,' + (0.3 + rng() * 0.7).toFixed(2) + ')';
      const s = rng() < 0.1 ? 2 : 1;
      g.fillRect(rng() * BW, rng() * maxY, s, s);
    }
  }

  function city(g, th, rng) {
    stars(g, rng, 180, 500);
    g.fillStyle = '#e8e0ff';
    g.beginPath(); g.arc(1320, 150, 46, 0, TAU); g.fill();
    g.fillStyle = 'rgba(232,224,255,0.12)';
    g.beginPath(); g.arc(1320, 150, 90, 0, TAU); g.fill();
    for (let layer = 0; layer < 3; ++layer) {
      const base = 560 + layer * 90, col = K.mix('#0a0620', th.skyBottom, 0.6 - layer * 0.25);
      let x = -20;
      while (x < BW) {
        const w = 50 + rng() * 90, h = 120 + rng() * (260 - layer * 50);
        g.fillStyle = col;
        g.fillRect(x, base - h, w, BH - base + h);
        for (let wy = base - h + 10; wy < BH - 20; wy += 16)
          for (let wx = x + 8; wx < x + w - 8; wx += 12)
            if (rng() < 0.32) {
              g.fillStyle = rng() < 0.7 ? 'rgba(255,220,140,' + (0.3 + layer * 0.2) + ')' : K.rgba(th.accent, 0.5);
              g.fillRect(wx, wy, 5, 7);
            }
        if (layer === 2 && rng() < 0.4) {
          const sx = x + w / 2, sy = base - h - 20;
          g.fillStyle = K.rgba(rng() < 0.5 ? th.accent : th.rim, 0.85);
          g.fillRect(sx - 22, sy, 44, 12);
          g.fillStyle = K.rgba('#ffffff', 0.25);
          g.fillRect(sx - 30, sy - 6, 60, 24);
        }
        x += w + 4 + rng() * 10;
      }
    }
  }

  function candy(g, th, rng) {
    for (let i = 0; i < 9; ++i) {
      const x = rng() * BW, y = 60 + rng() * 260, s = 40 + rng() * 60;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 4; ++k) { g.beginPath(); g.arc(x + k * s * 0.5, y + (k % 2) * -s * 0.25, s * 0.45, 0, TAU); g.fill(); }
    }
    const hills = ['#ff9ad8', '#ffb0e0', '#ff7ac8'];
    for (let l = 0; l < 3; ++l) {
      const base = 520 + l * 120;
      for (let i = 0; i < 6; ++i) {
        const x = i * 320 - 60 + rng() * 80, r = 160 + rng() * 120;
        g.fillStyle = hills[l];
        g.beginPath(); g.arc(x, base + r * 0.5, r, Math.PI, 0); g.fill();
        g.save(); g.beginPath(); g.arc(x, base + r * 0.5, r, Math.PI, 0); g.clip();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 14;
        for (let s = -r * 2; s < r * 2; s += 50) { g.beginPath(); g.moveTo(x + s, base + r); g.lineTo(x + s + r, base - r); g.stroke(); }
        g.restore();
      }
      if (l === 1) {
        for (let i = 0; i < 7; ++i) {
          const x = 100 + i * 230 + rng() * 60, y = 470 + rng() * 60;
          g.fillStyle = '#fff4e0'; g.fillRect(x - 3, y, 6, 140);
          const cols = ['#ff3a6a', '#3ad8ff', '#ffd23a', '#7aff9a'];
          g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(x, y, 30, 0, TAU); g.fill();
          g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(x, y, 18, 0, TAU * 0.8); g.stroke();
        }
      }
    }
  }

  function glacier(g, th, rng) {
    stars(g, rng, 220, 450);
    for (let b = 0; b < 3; ++b) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const col = b === 1 ? '#7affc0' : '#4ad8ff';
      for (let x = 0; x < BW; x += 6) {
        const y = 120 + b * 60 + Math.sin(x * 0.006 + b) * 50 + Math.sin(x * 0.017) * 20;
        const gr = g.createLinearGradient(0, y - 90, 0, y + 30);
        gr.addColorStop(0, K.rgba(col, 0));
        gr.addColorStop(0.7, K.rgba(col, 0.09));
        gr.addColorStop(1, K.rgba(col, 0));
        g.fillStyle = gr;
        g.fillRect(x, y - 90, 6, 120);
      }
      g.restore();
    }
    for (let l = 0; l < 3; ++l) {
      const base = 560 + l * 110;
      let x = -100;
      while (x < BW + 100) {
        const w = 200 + rng() * 220, h = 160 + rng() * 200 - l * 30;
        const gr = g.createLinearGradient(x, base - h, x + w, base);
        gr.addColorStop(0, K.mix('#e8faff', th.skyBottom, 0.3 + l * 0.2));
        gr.addColorStop(1, K.mix('#3a7aa0', th.skyBottom, 0.4 + l * 0.15));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x, BH); g.lineTo(x + w * 0.5, base - h); g.lineTo(x + w, BH); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath(); g.moveTo(x + w * 0.5, base - h); g.lineTo(x + w * 0.62, base - h * 0.6); g.lineTo(x + w * 0.5, base - h * 0.66); g.lineTo(x + w * 0.4, base - h * 0.62); g.closePath(); g.fill();
        x += w * 0.6;
      }
    }
  }

  function woods(g, th, rng) {
    stars(g, rng, 120, 400);
    const mg = g.createRadialGradient(1180, 200, 10, 1180, 200, 220);
    mg.addColorStop(0, 'rgba(230,255,200,0.9)');
    mg.addColorStop(0.3, 'rgba(200,255,160,0.6)');
    mg.addColorStop(0.32, 'rgba(160,255,120,0.12)');
    mg.addColorStop(1, 'rgba(160,255,120,0)');
    g.fillStyle = mg;
    g.fillRect(900, 0, 600, 500);
    for (let l = 0; l < 3; ++l) {
      const col = K.mix('#000000', th.skyBottom, 0.55 - l * 0.22);
      for (let i = 0; i < 12; ++i) {
        const x = rng() * BW, base = 640 + l * 90, h = 260 + rng() * 260;
        g.strokeStyle = col; g.lineCap = 'round';
        g.lineWidth = 16 - l * 3;
        g.beginPath(); g.moveTo(x, BH); g.lineTo(x + (rng() - 0.5) * 30, base - h); g.stroke();
        g.lineWidth = 5;
        for (let b = 0; b < 6; ++b) {
          const by = base - h * (0.3 + rng() * 0.6), dir = rng() < 0.5 ? -1 : 1;
          g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + dir * 40, by - 30, x + dir * (60 + rng() * 50), by - 50 - rng() * 40); g.stroke();
        }
      }
      g.fillStyle = K.rgba('#c8a0ff', 0.06 + l * 0.03);
      g.fillRect(0, 600 + l * 80, BW, 140);
    }
    for (let i = 0; i < 6; ++i) {
      const x = 80 + rng() * (BW - 160), y = 830 + rng() * 40;
      g.fillStyle = '#1a1424';
      g.beginPath(); g.moveTo(x - 16, y); g.lineTo(x - 16, y - 30); g.arc(x, y - 30, 16, Math.PI, 0); g.lineTo(x + 16, y); g.fill();
    }
  }

  function volcano(g, th, rng) {
    for (let i = 0; i < 80; ++i) {
      g.fillStyle = 'rgba(255,' + (100 + rng() * 120 | 0) + ',40,' + (0.2 + rng() * 0.4).toFixed(2) + ')';
      g.fillRect(rng() * BW, rng() * 500, 2, 2);
    }
    const peaks = [[300, 380], [820, 260], [1300, 340]];
    for (let i = 0; i < peaks.length; ++i) {
      const x = peaks[i][0], top = peaks[i][1];
      g.fillStyle = '#1a0604';
      g.beginPath(); g.moveTo(x - 420, BH); g.lineTo(x - 60, top); g.lineTo(x + 60, top); g.lineTo(x + 420, BH); g.closePath(); g.fill();
      const lg = g.createLinearGradient(0, top, 0, BH);
      lg.addColorStop(0, '#ffd23a'); lg.addColorStop(0.4, '#ff5a1a'); lg.addColorStop(1, 'rgba(160,20,0,0.2)');
      g.strokeStyle = lg; g.lineWidth = 7;
      g.beginPath(); g.moveTo(x, top);
      let lx = x;
      for (let y = top; y < BH; y += 40) { lx += (rng() - 0.5) * 60; g.lineTo(lx, y); }
      g.stroke();
      const gl = g.createRadialGradient(x, top, 4, x, top, 160);
      gl.addColorStop(0, 'rgba(255,160,40,0.7)'); gl.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gl; g.fillRect(x - 160, top - 160, 320, 320);
    }
    const fl = g.createLinearGradient(0, 760, 0, BH);
    fl.addColorStop(0, 'rgba(255,80,10,0)'); fl.addColorStop(1, 'rgba(255,80,10,0.5)');
    g.fillStyle = fl; g.fillRect(0, 760, BW, 140);
  }

  function synth(g, th, rng) {
    stars(g, rng, 140, 380);
    const cx = BW / 2, cy = 420;
    const sg = g.createLinearGradient(0, cy - 180, 0, cy + 60);
    sg.addColorStop(0, '#ffe23a'); sg.addColorStop(1, '#ff3a8a');
    g.fillStyle = sg;
    g.beginPath(); g.arc(cx, cy, 180, Math.PI, TAU); g.fill();
    g.fillStyle = th.skyBottom;
    for (let i = 0; i < 7; ++i) g.fillRect(cx - 200, cy - 80 + i * 14, 400, 3 + i);
    g.fillStyle = '#0a0218';
    g.fillRect(0, cy, BW, BH - cy);
    g.strokeStyle = K.rgba('#ff3ad8', 0.7);
    g.lineWidth = 2;
    for (let i = -20; i <= 20; ++i) { g.beginPath(); g.moveTo(cx + i * 20, cy); g.lineTo(cx + i * 160, BH); g.stroke(); }
    for (let k = 0; k < 14; ++k) { const y = cy + Math.pow(k / 14, 2) * (BH - cy); g.beginPath(); g.moveTo(0, y); g.lineTo(BW, y); g.stroke(); }
  }

  /* ── seasonal decor ── */
  const decor = {};
  function seasonDecor(id) {
    if (decor[id]) return decor[id];
    const c = K.makeCanvas(BW, BH);
    const g = c.getContext('2d');
    const rng = NS.rng.makeRng(NS.rng.hashString('decor' + id));
    switch (id) {
      case 'winter': case 'yearend':
        g.fillStyle = '#f0f8ff';
        g.beginPath(); g.moveTo(0, BH);
        for (let x = 0; x <= BW; x += 40) g.lineTo(x, BH - 40 - Math.sin(x * 0.01) * 18 - rng() * 10);
        g.lineTo(BW, BH); g.closePath(); g.fill();
        if (id === 'yearend') {
          for (let s = 0; s < 2; ++s) {
            const y0 = 30 + s * 40;
            g.strokeStyle = '#2a2a3a'; g.lineWidth = 2;
            g.beginPath();
            for (let x = 0; x <= BW; x += 20) g.lineTo(x, y0 + Math.sin(x / BW * Math.PI * 6) * 16 + 16);
            g.stroke();
            const cols = ['#ff3a5a', '#ffd23a', '#3ad8ff', '#5aff9a'];
            for (let x = 10; x < BW; x += 46) {
              const y = y0 + Math.sin(x / BW * Math.PI * 6) * 16 + 22;
              g.fillStyle = K.rgba(cols[(x / 46 | 0) % 4], 0.35); g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
              g.fillStyle = cols[(x / 46 | 0) % 4]; g.beginPath(); g.ellipse(x, y, 4, 6, 0, 0, TAU); g.fill();
            }
          }
          for (let i = 0; i < 10; ++i) {
            const x = 40 + rng() * (BW - 80), w = 30 + rng() * 30;
            g.fillStyle = ['#e8203a', '#2a8aff', '#ffd23a', '#5aff9a'][i % 4]; g.fillRect(x, BH - 60 - w * 0.6, w, w * 0.8);
            g.fillStyle = '#ffffff'; g.fillRect(x + w / 2 - 3, BH - 60 - w * 0.6, 6, w * 0.8);
          }
        }
        break;
      case 'spring':
        for (let i = 0; i < 70; ++i) {
          const x = rng() * BW, y = BH - 10 - rng() * 40;
          g.strokeStyle = '#3aa84a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, BH); g.lineTo(x, y); g.stroke();
          g.fillStyle = ['#ffb0d8', '#fff07a', '#b0d8ff', '#ffffff'][i % 4];
          for (let p = 0; p < 5; ++p) { const a = p * TAU / 5; g.beginPath(); g.arc(x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4, 0, TAU); g.fill(); }
          g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
        }
        break;
      case 'summer': {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; ++i) {
          const a = 0.3 + i * 0.12;
          g.fillStyle = 'rgba(255,240,160,0.05)';
          g.beginPath(); g.moveTo(BW - 80, -40); g.lineTo(BW - 80 - Math.cos(a) * 2000, -40 + Math.sin(a) * 2000); g.lineTo(BW - 80 - Math.cos(a + 0.05) * 2000, -40 + Math.sin(a + 0.05) * 2000); g.closePath(); g.fill();
        }
        g.restore();
        const sun = g.createRadialGradient(BW - 140, 110, 10, BW - 140, 110, 150);
        sun.addColorStop(0, 'rgba(255,250,200,0.95)');
        sun.addColorStop(0.35, 'rgba(255,220,90,0.7)');
        sun.addColorStop(1, 'rgba(255,200,60,0)');
        g.fillStyle = sun;
        g.fillRect(BW - 300, -50, 320, 320);
        for (let k = 0; k < 4; ++k) {
          const px = k < 2 ? 60 + k * 120 : BW - 60 - (k - 2) * 120, base = BH - 30, h = 260 + k * 30;
          const lean = k < 2 ? 40 : -40;
          g.strokeStyle = '#3a2410'; g.lineWidth = 12; g.lineCap = 'round';
          g.beginPath(); g.moveTo(px, base); g.quadraticCurveTo(px + lean * 0.3, base - h * 0.5, px + lean, base - h); g.stroke();
          g.fillStyle = '#1a6a3a';
          for (let f = 0; f < 7; ++f) {
            const a = -Math.PI + f * Math.PI / 6 + (lean > 0 ? 0.2 : -0.2);
            g.beginPath();
            g.moveTo(px + lean, base - h);
            g.quadraticCurveTo(px + lean + Math.cos(a) * 70, base - h + Math.sin(a) * 40 - 20, px + lean + Math.cos(a) * 120, base - h + Math.sin(a) * 60 + 40);
            g.quadraticCurveTo(px + lean + Math.cos(a) * 60, base - h + Math.sin(a) * 30, px + lean, base - h);
            g.fill();
          }
        }
        for (let i = 0; i < 5; ++i) {
          const x = 300 + i * 260 + rng() * 60, y = BH - 26;
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, 16, 0, TAU); g.fill();
          g.fillStyle = ['#ff3a5a', '#3ad8ff', '#ffd23a'][i % 3];
          g.beginPath(); g.arc(x, y, 16, -0.5, 0.6); g.lineTo(x, y); g.fill();
          g.beginPath(); g.arc(x, y, 16, 1.6, 2.7); g.lineTo(x, y); g.fill();
        }
        const sea = g.createLinearGradient(0, BH - 70, 0, BH);
        sea.addColorStop(0, 'rgba(60,200,255,0)'); sea.addColorStop(1, 'rgba(60,200,255,0.4)');
        g.fillStyle = sea; g.fillRect(0, BH - 70, BW, 70);
        break;
      }
      case 'autumn':
        for (let i = 0; i < 260; ++i) {
          const x = rng() * BW, y = BH - rng() * rng() * 60;
          g.fillStyle = ['#ff8a2a', '#e8502a', '#ffc04a', '#a0401a'][i % 4];
          g.beginPath(); g.ellipse(x, y, 6, 3, rng() * 3, 0, TAU); g.fill();
        }
        break;
      case 'halloween':
        for (let i = 0; i < 8; ++i) {
          const x = 60 + i * 200 + rng() * 60, y = BH - 30;
          g.fillStyle = '#e86a10'; g.beginPath(); g.ellipse(x, y, 26, 20, 0, 0, TAU); g.fill();
          g.fillStyle = '#ffe040';
          g.beginPath(); g.moveTo(x - 12, y - 4); g.lineTo(x - 6, y - 12); g.lineTo(x - 2, y - 4); g.fill();
          g.beginPath(); g.moveTo(x + 12, y - 4); g.lineTo(x + 6, y - 12); g.lineTo(x + 2, y - 4); g.fill();
          g.beginPath(); g.moveTo(x - 14, y + 4); g.lineTo(x + 14, y + 4); g.lineTo(x, y + 12); g.fill();
          g.fillStyle = K.rgba('#ffa040', 0.18); g.beginPath(); g.arc(x, y, 60, 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(220,220,240,0.25)'; g.lineWidth = 1;
        for (let k = 0; k < 2; ++k) {
          const cx = k ? BW - 10 : 10, cy = 10;
          for (let r = 30; r < 180; r += 30) { g.beginPath(); g.arc(cx, cy, r, k ? Math.PI / 2 : 0, k ? Math.PI : Math.PI / 2); g.stroke(); }
          for (let a = 0; a <= 4; ++a) { const t = (k ? Math.PI / 2 : 0) + a * Math.PI / 8; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t) * 180, cy + Math.sin(t) * 180); g.stroke(); }
        }
        break;
    }
    decor[id] = c;
    return c;
  }

  /* ── ambient weather ── */
  const MAX_W = 160;
  const weather = [];
  for (let i = 0; i < MAX_W; ++i) weather.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0, s: 1, kind: '', ph: 0 });
  let spawnA = 0, spawnS = 0;

  function add(kind, x, y, vx, vy, life, s) {
    for (let i = 0; i < MAX_W; ++i) {
      const w = weather[i];
      if (w.on) continue;
      w.on = true; w.kind = kind; w.x = x; w.y = y; w.vx = vx; w.vy = vy; w.t = 0; w.life = life; w.s = s; w.ph = R() * TAU;
      return w;
    }
    return null;
  }

  function emit(kind, rect, rate, dt, acc) {
    acc += rate * dt;
    while (acc >= 1) {
      acc -= 1;
      const x = rect.x0 + R() * rect.w, top = rect.y0 - 20, bot = rect.y1 + 10;
      switch (kind) {
        case 'rain': add('drop', x + 100, top, -120, 900, 1.2, 1); break;
        case 'snow': add('flake', x, top, (R() - 0.5) * 30, 40 + R() * 40, 18, 0.5 + R() * 0.7); break;
        case 'sprinkles': add('sprinkle', x, top, (R() - 0.5) * 40, 70 + R() * 60, 14, 0.6 + R() * 0.6); break;
        case 'petals': add('petal', x, top, 30 + R() * 30, 40 + R() * 30, 18, 0.7 + R() * 0.6); break;
        case 'leaves': add('leaf', x, top, 20 + R() * 40, 50 + R() * 40, 16, 0.7 + R() * 0.6); break;
        case 'embers': add('ember', x, bot, (R() - 0.5) * 30, -40 - R() * 60, 12, 0.5 + R()); break;
        case 'fireflies': add('firefly', x, rect.y0 + R() * rect.h, 0, 0, 6 + R() * 4, 0.6 + R() * 0.6); break;
        case 'sunmotes': add('sun', x, rect.y0 + R() * rect.h, 8, -6, 7, 0.5 + R() * 0.6); break;
        case 'bats': add('bat', rect.x0 - 20, rect.y0 + R() * rect.h * 0.6, 120 + R() * 80, 0, 14, 1 + R() * 0.6); break;
        case 'fireworks': firework(rect); break;
      }
    }
    return acc;
  }

  const FW = ['#ff3a5a', '#ffd23a', '#3ad8ff', '#5aff9a', '#ff7ad8'];
  function firework(rect) {
    const x = rect.x0 + 80 + R() * (rect.w - 160), y = rect.y0 + 60 + R() * rect.h * 0.4;
    const col = FW[Math.floor(R() * FW.length)];
    for (let i = 0; i < 24; ++i) {
      const a = i * TAU / 24, s = 80 + R() * 40;
      const w = add('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, 1.4, 1);
      if (w) w.col = col;
    }
  }

  const KIND_OF = { drop: 'rain', flake: 'snow', sprinkle: 'sprinkles', petal: 'petals', leaf: 'leaves', ember: 'embers', firefly: 'fireflies', sun: 'sunmotes', bat: 'bats', spark: 'fireworks' };
  const RATES = { rain: 90, snow: 14, sprinkles: 10, petals: 5, leaves: 5, embers: 14, fireflies: 3, sunmotes: 4, bats: 0.4, fireworks: 0.35 };

  let lastAmbient = '';

  function update(dt) {
    const cine = G.screen === 'cine';
    const th = cine ? null : NS.world.theme ? NS.world.theme() : null;
    const rect = NS.view.visible();
    const amb = th ? th.ambient : 'cine';
    if (amb !== lastAmbient) {
      lastAmbient = amb;
      const keep = G.season ? G.season.ambient : '';
      for (let i = 0; i < MAX_W; ++i) if (weather[i].on && KIND_OF[weather[i].kind] !== keep) weather[i].on = false;
    }
    if (th && th.ambient && RATES[th.ambient]) spawnA = emit(th.ambient, rect, RATES[th.ambient], dt, spawnA);
    const s = G.season;
    if (s && s.ambient && RATES[s.ambient] && (!th || th.ambient !== s.ambient)) spawnS = emit(s.ambient, rect, RATES[s.ambient] * 0.5, dt, spawnS);
    for (let i = 0; i < MAX_W; ++i) {
      const w = weather[i];
      if (!w.on) continue;
      w.t += dt;
      if (w.t >= w.life || w.y > rect.y1 + 40 || w.y < rect.y0 - 60 || w.x > rect.x1 + 60) { w.on = false; continue; }
      w.ph += dt;
      if (w.kind === 'flake' || w.kind === 'petal' || w.kind === 'leaf') w.x += Math.sin(w.ph * 1.3) * 20 * dt;
      if (w.kind === 'firefly') { w.vx = Math.cos(w.ph * 0.7) * 25; w.vy = Math.sin(w.ph * 0.9) * 20; }
      if (w.kind === 'spark') w.vy += 60 * dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
    }
  }

  function drawWeather(ctx) {
    for (let i = 0; i < MAX_W; ++i) {
      const w = weather[i];
      if (!w.on) continue;
      const fade = Math.min(1, w.t * 2, (w.life - w.t) * 1.5);
      ctx.globalAlpha = Math.max(0, fade);
      switch (w.kind) {
        case 'drop':
          ctx.strokeStyle = 'rgba(160,200,255,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x - 2, w.y + 14); ctx.stroke();
          break;
        case 'firefly': case 'ember': case 'spark':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha *= w.kind === 'firefly' ? 0.5 + Math.sin(w.ph * 5) * 0.5 : 1;
          K.blit(ctx, K.glow(w.kind === 'firefly' ? '#c8ff7a' : w.kind === 'ember' ? '#ff7a2a' : (w.col || '#ffd23a')), w.x, w.y, w.s * (w.kind === 'spark' ? 0.25 : 0.3));
          ctx.globalCompositeOperation = 'source-over';
          break;
        default:
          K.blitEx(ctx, IA.shape(w.kind), w.x, w.y, w.ph * (w.kind === 'bat' ? 0 : 1.2), w.s * (w.kind === 'bat' ? (Math.sin(w.ph * 14) > 0 ? 1.4 : 1) : 1), w.s);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* covers the visible area with the scenery for a theme, then the season's decor and weather */
  function draw(ctx, th, opts) {
    const r = NS.view.visible();
    const c = scene(th);
    const pan = opts && opts.pan ? opts.pan : 0;
    const k = Math.max((r.w + Math.abs(pan) * 2) / BW, r.h / BH);
    const w = BW * k, h = BH * k;
    ctx.drawImage(c, (r.x0 + r.x1) / 2 - w / 2 + pan, (r.y0 + r.y1) / 2 - h / 2, w, h);
    if (G.season) ctx.drawImage(seasonDecor(G.season.id), (r.x0 + r.x1) / 2 - w / 2, (r.y0 + r.y1) / 2 - h / 2, w, h);
    drawWeather(ctx);
  }

  Object.assign(NS.backdrop, {
    draw, update, scene, seasonDecor, drawWeather, weather
  });
})();
