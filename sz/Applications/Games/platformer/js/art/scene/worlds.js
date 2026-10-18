;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.sceneKit || (NS.sceneKit = {});
  const { VIEW_W, STRIP_W, TWO_PI, makeCanvas, mulberry, rgba, mix, loopNoise, linear, radial, grain, ridgePath, wrapDraw, strip, paintRange, paintHills, treeClump, poplar, bush, pine, cloudStrip, meadowGround, seaStrip, shaftStrip } = Kit;

  /*
   * Scenery: the five world builders, strip cropping and the atmosphere bands.
   */

  /* ── world 0: Sunleaf Meadows ── */
  function buildMeadow(rand) {
    const L = [];
    L.push({ s: cloudStrip(rand, 340, 6, 150, 270, 140, 330, '#fffbea', '#eef3fb', '#a9b4d6'), y: 0, f: 0.04, vx: 6, alpha: 0.9 });
    const far = paintRange(rand, 380, 300, 210, '#7f9cc4', '#c8d8ee', '#f4f8ff', '#5a6e9a', '#f4f8ff', 0.55, '#c8dcf0');
    L.push({ s: far.s, y: 150, f: 0.08 });
    const mid = paintHills(rand, 360, 190, 90, '#86c45a', '#3e7a34', '#e8ff9a', function(g, ys, r) {
      /* distant tree clumps, hedgerows and a windmill on the crests */
      for (let i = 0; i < 26; ++i) {
        const x = r() * STRIP_W, k = Math.floor(x / 4);
        const size = 12 + r() * 10, seed = Math.floor(r() * 1e6);
        wrapDraw(STRIP_W, x, 40, function(xx) { treeClump(g, xx, ys[Math.min(ys.length - 1, Math.max(0, Math.floor(xx / 4)))] + 6, size, mulberry(seed), '#2f6a30', '#4a8e3c', '#7ab84e', 1); });
        void k;
      }
      for (let i = 0; i < 2; ++i) {
        const x = 300 + i * 760, y = ys[Math.floor(x / 4)] + 4;
        g.fillStyle = '#e8dcc0';
        g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x - 5, y - 46); g.lineTo(x + 5, y - 46); g.lineTo(x + 9, y); g.closePath(); g.fill();
        g.fillStyle = '#b8a888';
        g.fillRect(x + 1, y - 46, 4, 46);
        g.fillStyle = '#a84a3a';
        g.beginPath(); g.moveTo(x - 8, y - 46); g.lineTo(x, y - 56); g.lineTo(x + 8, y - 46); g.closePath(); g.fill();
        g.strokeStyle = '#6a5a48';
        g.lineWidth = 2.5;
        for (let b = 0; b < 4; ++b) {
          const a = b * Math.PI / 2 + 0.4;
          g.beginPath(); g.moveTo(x, y - 48); g.lineTo(x + Math.cos(a) * 26, y - 48 + Math.sin(a) * 26); g.stroke();
        }
      }
    });
    L.push({ s: mid, y: 290, f: 0.2 });
    const near = paintHills(rand, 420, 150, 50, '#4a9a3e', '#1f4a24', '#d8ff90', function(g, ys, r) {
      meadowGround(g, ys, 420, r);
      /* a mixed wood: oaks of every size, poplars and bushes in three greens,
         back row first; the sun stands to the right */
      const greens = [['#1c4a22', '#2e6e2e', '#5aa040'], ['#24502a', '#3c7a32', '#7ab84e'], ['#1a4430', '#2a6644', '#58a066']];
      const items = [];
      for (let x = 0; x < STRIP_W; x += 22 + r() * 34) {
        const k = r();
        items.push({ x: x, dy: 6 + r() * 30, kind: k < 0.16 ? 'poplar' : k < 0.34 ? 'bush' : 'oak', size: r(), pal: greens[Math.floor(r() * 3)], seed: Math.floor(r() * 1e6) });
      }
      items.sort((a, b) => a.dy - b.dy);
      for (const it of items) {
        const y = ys[Math.floor(it.x / 4)] + it.dy;
        const p = it.pal;
        wrapDraw(STRIP_W, it.x, 80, function(px) {
          const rr = mulberry(it.seed);
          if (it.kind === 'poplar')
            poplar(g, px, y, 80 + it.size * 60, p[0], p[1], p[2], 1);
          else if (it.kind === 'bush')
            bush(g, px, y, 14 + it.size * 14, rr, p[0], p[1], p[2], 1);
          else
            treeClump(g, px, y, 20 + it.size * 30, rr, p[0], p[1], p[2], 1);
        });
      }
      /* warm light from the sun side, and a darker grass base so the level
         terrain in front stands out */
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = linear(g, 0, 0, STRIP_W, 0, [[0, 'rgba(255,236,160,0.04)'], [0.6, 'rgba(255,236,160,0.12)'], [1, 'rgba(255,236,160,0.04)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.fillStyle = linear(g, 0, 190, 0, 420, [[0, 'rgba(8,36,14,0)'], [0.4, 'rgba(8,36,14,0.35)'], [1, 'rgba(8,36,14,0.6)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
      grain(g, STRIP_W, 420, r, 2, 'rgba(255,255,220,0.05)', 'rgba(0,30,0,0.08)');
    });
    L.push({ s: near, y: 420, f: 0.38, fill: '#10301a' });
    return { layers: L, glows: [{ x: 0.75, y: 0.22, r: 220, color: '#fff2c0', pulse: 0.08, fixed: true }],
      palette: { ambient: '#fff6b0', fog: 'rgba(240,248,255,0.25)', light: '#fff2c0' },
      front: { top: null, bottom: '#c8e8a8', bottomA: 0.22, warm: null } };
  }

  /* ── world 1: Glimmer Caverns ── */
  function crystal(g, x, y, h, w, color, dir) {
    g.save();
    g.translate(x, y);
    if (dir < 0) g.scale(1, -1);
    g.fillStyle = radial(g, 0, -h * 0.5, 0, h * 1.1, [[0, rgba(color, 0.35)], [0.5, rgba(color, 0.1)], [1, rgba(color, 0)]]);
    g.fillRect(-h * 1.1, -h * 1.6, h * 2.2, h * 2.2);
    g.fillStyle = mix(color, '#102030', 0.45);
    g.beginPath(); g.moveTo(-w, 0); g.lineTo(-w * 0.6, -h * 0.8); g.lineTo(0, -h); g.lineTo(w * 0.7, -h * 0.75); g.lineTo(w, 0); g.closePath(); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.moveTo(-w * 0.6, -h * 0.8); g.lineTo(0, -h); g.lineTo(w * 0.1, 0); g.lineTo(-w, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.moveTo(-w * 0.45, -h * 0.7); g.lineTo(-w * 0.05, -h * 0.92); g.lineTo(-w * 0.2, -h * 0.4); g.closePath(); g.fill();
    g.restore();
  }

  function spikes(g, ys, H, rand, fromTop, body, light, minH, maxH, gap) {
    for (let x = 0; x < STRIP_W; x += gap * (0.6 + rand() * 0.8)) {
      const h = minH + rand() * (maxH - minH), w = h * (0.14 + rand() * 0.1);
      wrapDraw(STRIP_W, x, w, function(xx) {
        const by = fromTop ? 0 : H;
        const ty = fromTop ? h : H - h;
        g.fillStyle = body;
        g.beginPath(); g.moveTo(xx - w, by); g.quadraticCurveTo(xx - w * 0.3, (by + ty) / 2, xx, ty); g.quadraticCurveTo(xx + w * 0.4, (by + ty) / 2, xx + w, by); g.closePath(); g.fill();
        g.fillStyle = light;
        g.beginPath(); g.moveTo(xx - w * 0.7, by); g.quadraticCurveTo(xx - w * 0.25, (by + ty) / 2, xx, ty); g.lineTo(xx - w * 0.2, by); g.closePath(); g.fill();
      });
    }
    void ys;
  }

  function buildCaverns(rand) {
    const L = [];
    /* the far chamber wall: pillars and glowing crystal clusters */
    const far = strip(720);
    {
      const g = far.g;
      for (let i = 0; i < 9; ++i) {
        const x = (i + rand() * 0.5) * STRIP_W / 9, w = 40 + rand() * 70;
        wrapDraw(STRIP_W, x, w, function(xx) {
          g.fillStyle = linear(g, xx - w, 0, xx + w, 0, [[0, '#0e1c2c'], [0.4, '#1d3550'], [1, '#0c1824']]);
          g.beginPath();
          g.moveTo(xx - w * 0.6, 0);
          g.quadraticCurveTo(xx - w * 0.2, 360, xx - w, 720);
          g.lineTo(xx + w, 720);
          g.quadraticCurveTo(xx + w * 0.25, 360, xx + w * 0.6, 0);
          g.closePath();
          g.fill();
        });
      }
      spikes(g, null, 720, rand, true, '#13253a', '#21405e', 40, 150, 50);
      spikes(g, null, 720, rand, false, '#13253a', '#21405e', 50, 170, 46);
      const cols = ['#6ab8ff', '#b88aff', '#5ae0e0'];
      for (let i = 0; i < 16; ++i) {
        const x = rand() * STRIP_W, top = rand() < 0.4;
        const col = cols[i % 3];
        wrapDraw(STRIP_W, x, 40, function(xx) {
          for (let k = 0; k < 3; ++k)
            crystal(g, xx + (k - 1) * 12, top ? 20 + rand() * 60 : 700 - rand() * 50, 18 + rand() * 26, 6 + rand() * 4, col, top ? -1 : 1);
        });
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(10,22,38,0.45)';
      g.fillRect(0, 0, STRIP_W, 720);
      g.restore();
      grain(g, STRIP_W, 720, rand, 2, 'rgba(140,200,255,0.05)', 'rgba(0,0,0,0.08)');
    }
    L.push({ s: far, y: 0, f: 0.08, fill: '#0e1c2c', fillTop: '#0e1c2c', alpha: 1 });
    L.push({ s: shaftStrip(rand, '#8ad0ff'), y: 0, f: 0.12, alpha: 0.8, shimmer: true, add: true });
    /* the middle ceiling teeth and floor stalagmites */
    const top = strip(280);
    spikes(top.g, null, 280, rand, true, '#0c1726', '#1a3048', 60, 250, 70);
    top.g.fillStyle = '#0c1726';
    top.g.fillRect(0, 0, STRIP_W, 30);
    L.push({ s: top, y: -40, f: 0.22, fillTop: '#0c1726' });
    const floor = paintHills(rand, 340, 170, 70, '#1c3854', '#0a1420', '#6ac0ff', function(g, ys, r) {
      spikes(g, ys, 340, r, false, '#122336', '#22405c', 60, 220, 80);
      for (let i = 0; i < 10; ++i) {
        const x = r() * STRIP_W, y = ys[Math.floor(x / 4)] + 10;
        wrapDraw(STRIP_W, x, 30, function(xx) { crystal(g, xx, y, 26 + r() * 30, 8 + r() * 5, i % 2 ? '#6ab8ff' : '#b88aff', 1); });
      }
    });
    L.push({ s: floor, y: 400, f: 0.24, fill: '#0a1420' });
    /* near: stalagmite clusters and glowing fungus */
    const near = strip(440);
    {
      const g = near.g;
      for (let x = 0; x < STRIP_W; x += 50 + rand() * 90) {
        const h = 90 + rand() * 180, w = h * 0.16;
        wrapDraw(STRIP_W, x, w * 2, function(xx) {
          g.fillStyle = '#081322';
          g.beginPath(); g.moveTo(xx - w, 440); g.quadraticCurveTo(xx - w * 0.3, 440 - h * 0.5, xx, 440 - h); g.quadraticCurveTo(xx + w * 0.35, 440 - h * 0.5, xx + w, 440); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(110,190,255,0.3)';
          g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(xx - w * 0.8, 440 - h * 0.08); g.quadraticCurveTo(xx - w * 0.3, 440 - h * 0.5, xx, 440 - h); g.stroke();
        });
      }
      g.fillStyle = '#081322';
      g.fillRect(0, 400, STRIP_W, 40);
      for (let m = 0; m < 26; ++m) {
        const mx = rand() * STRIP_W, my = 396 + rand() * 30, sz = 4 + rand() * 6;
        g.fillStyle = 'rgba(90,240,200,0.14)';
        g.beginPath(); g.arc(mx, my - sz, sz * 3, 0, TWO_PI); g.fill();
        g.fillStyle = '#c8fff0';
        g.fillRect(mx - 1, my - sz, 2, sz + 2);
        g.fillStyle = m % 3 ? '#5af0c8' : '#9a8aff';
        g.beginPath(); g.ellipse(mx, my - sz, sz, sz * 0.6, 0, Math.PI, TWO_PI); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(mx - sz * 0.5, my - sz * 1.4, sz * 0.4, 1.5);
      }
    }
    L.push({ s: near, y: 330, f: 0.42, fill: '#081322' });
    const glows = [];
    for (let i = 0; i < 6; ++i)
      glows.push({ x: rand(), y: 0.15 + rand() * 0.7, r: 60 + rand() * 80, color: i % 2 ? '#6ab8ff' : '#b88aff', pulse: 0.35, f: 0.08, speed: 0.7 + rand() });
    return { layers: L, glows: glows,
      palette: { ambient: '#8ad0ff', fog: 'rgba(40,90,140,0.25)', light: '#6ab8ff' },
      front: { top: '#02060c', topA: 0.55, bottom: '#123048', bottomA: 0.35 } };
  }

  /* ── world 2: Frostfang Peaks ── */
  function aurora(rand) {
    const s = strip(300);
    const g = s.g;
    const n = loopNoise(rand, 4);
    g.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; ++band) {
      const col = ['#4affb0', '#5ad8ff', '#b88aff'][band];
      for (let x = 0; x < STRIP_W; x += 3) {
        const u = x / STRIP_W;
        const y = 60 + n(u + band * 0.31, 0.5) * 120 + band * 18;
        const h = 60 + n(u * 2 + band, 0.6) * 120;
        const a = 0.1 + 0.22 * n(u * 3 + band * 0.7, 0.4);
        g.fillStyle = linear(g, 0, y, 0, y + h, [[0, rgba(col, 0)], [0.6, rgba(col, a)], [1, rgba(col, 0)]]);
        g.fillRect(x, y, 3, h);
      }
    }
    return s;
  }

  function buildPeaks(rand) {
    const L = [];
    L.push({ s: aurora(rand), y: 10, f: 0.02, vx: 4, alpha: 0.9, shimmer: true });
    const far = paintRange(rand, 460, 420, 340, '#6a7cb0', '#b8c4e8', '#ffffff', '#3a4680', '#f2f6ff', 0.6, '#d8b8d0');
    L.push({ s: far.s, y: 70, f: 0.06 });
    const mid = paintRange(rand, 380, 300, 200, '#41598c', '#8aa0cc', '#e8f4ff', '#22305a', '#e8f2ff', 0.5, '#8890c0');
    L.push({ s: mid.s, y: 230, f: 0.16 });
    const near = paintHills(rand, 420, 170, 60, '#dfe8f6', '#a8b8d8', '#ffffff', function(g, ys, r) {
      /* a snowy valley: blue shadow pooling below the treeline, wind-carved
         drifts with lit crests, frozen lakes catching the sky, glittering snow */
      g.save();
      ridgePath(g, ys, 420);
      g.clip();
      g.fillStyle = linear(g, 0, 170, 0, 420, [[0, 'rgba(70,90,160,0.3)'], [0.35, 'rgba(70,90,160,0.08)'], [1, 'rgba(40,60,120,0.25)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
      for (let b = 0; b < 5; ++b) {
        const off = 50 + b * 45, ph = r() * 6;
        const line = [];
        for (let i = 0; i < ys.length; ++i)
          line.push(ys[i] + off + Math.sin(i * 0.035 + ph) * 14 + Math.sin(i * 0.11 + ph * 2) * 5);
        /* the drift body, its blue lee shadow and a lit crest */
        g.fillStyle = 'rgba(236,242,255,0.55)';
        g.beginPath(); g.moveTo(0, 420);
        for (let i = 0; i < line.length; ++i) g.lineTo(i * 4, line[i]);
        g.lineTo(STRIP_W, 420); g.closePath(); g.fill();
        g.fillStyle = linear(g, 0, off + 150, 0, off + 210, [[0, 'rgba(90,112,180,0.28)'], [1, 'rgba(90,112,180,0)']]);
        g.beginPath(); g.moveTo(0, 420);
        for (let i = 0; i < line.length; ++i) g.lineTo(i * 4, line[i] + 3);
        g.lineTo(STRIP_W, 420); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 1.5;
        g.beginPath();
        for (let i = 0; i < line.length; ++i) { if (i) g.lineTo(i * 4, line[i]); else g.moveTo(0, line[0]); }
        g.stroke();
        if (b === 1) {
          /* frozen lakes lying in this hollow */
          for (let k = 0; k < 2; ++k) {
            const lx = 300 + k * 760 + r() * 120, lw = 170 + r() * 110;
            const ly = line[Math.floor(lx / 4)] + 24;
            wrapDraw(STRIP_W, lx, lw, function(xx) {
              g.fillStyle = '#f2f6ff';
              g.beginPath(); g.ellipse(xx, ly, lw + 8, 19, 0, 0, TWO_PI); g.fill();
              g.fillStyle = linear(g, 0, ly - 14, 0, ly + 14, [[0, '#5a7ab8'], [0.5, '#8ab4e0'], [1, '#c8e0f8']]);
              g.beginPath(); g.ellipse(xx, ly, lw, 14, 0, 0, TWO_PI); g.fill();
              /* mirrored treeline and a glint of moonlight */
              g.fillStyle = 'rgba(22,36,60,0.3)';
              for (let t = 0; t < 12; ++t)
                g.fillRect(xx - lw * 0.8 + t * lw * 0.14, ly - 13, 4, 6 + (t * 7) % 8);
              g.fillStyle = 'rgba(255,255,255,0.7)';
              g.fillRect(xx - lw * 0.4, ly + 2, lw * 0.5, 1.5);
              g.fillRect(xx - lw * 0.2, ly + 6, lw * 0.3, 1);
            });
          }
        }
      }
      for (let i = 0; i < 700; ++i) {
        const x = r() * STRIP_W, y0 = ys[Math.floor(x / 4)];
        const y = y0 + 30 + r() * (420 - y0 - 30);
        if (r() < 0.12) {
          /* a glint */
          g.fillStyle = 'rgba(255,255,255,0.9)';
          g.fillRect(x - 3, y, 7, 1);
          g.fillRect(x, y - 3, 1, 7);
        } else {
          g.fillStyle = r() < 0.6 ? 'rgba(255,255,255,0.7)' : 'rgba(110,140,200,0.35)';
          g.fillRect(x, y, 2, 1.5);
        }
      }
      for (let x = 0; x < STRIP_W; x += 18 + r() * 26) {
        const y = ys[Math.floor(x / 4)] + 16, h = 70 + r() * 90;
        wrapDraw(STRIP_W, x, 40, function(xx) { pine(g, xx, y, h, '#16243c', '#2a3e5e', 'rgba(240,248,255,0.9)'); });
      }
    });
    L.push({ s: near, y: 380, f: 0.36, fill: '#a8b8d8' });
    /* slow distant snowfall */
    const snow = strip(720);
    for (let i = 0; i < 700; ++i) {
      const x = rand() * STRIP_W, y = rand() * 720, r = 0.6 + rand() * 1.8;
      snow.g.fillStyle = 'rgba(255,255,255,' + (0.3 + rand() * 0.5).toFixed(3) + ')';
      snow.g.beginPath(); snow.g.arc(x, y, r, 0, TWO_PI); snow.g.fill();
    }
    L.push({ s: snow, y: 0, f: 0.1, vx: -10, vy: 30, alpha: 0.7, rain: true });
    return { layers: L, glows: [{ x: 0.24, y: 0.2, r: 140, color: '#c8dcff', pulse: 0.05, fixed: true }],
      palette: { ambient: '#ffffff', fog: 'rgba(220,230,255,0.3)', light: '#c8dcff' },
      front: { top: null, bottom: '#e8f0ff', bottomA: 0.28 } };
  }

  /* ── world 3: Cinder Forge ── */
  function buildForge(rand) {
    const L = [];
    /* volcanoes with lava runs and craters */
    const far = strip(420);
    {
      const g = far.g;
      const cones = [[250, 160, 300], [820, 110, 380], [1300, 190, 280]];
      for (const cn of cones) {
        wrapDraw(STRIP_W, cn[0], cn[2] + 40, function(x) {
          const top = cn[1], w = cn[2];
          g.fillStyle = linear(g, 0, top, 0, 420, [[0, '#4a1c18'], [1, '#22100e']]);
          g.beginPath();
          g.moveTo(x - w, 420);
          g.quadraticCurveTo(x - w * 0.35, top + 90, x - 34, top);
          g.lineTo(x + 34, top);
          g.quadraticCurveTo(x + w * 0.35, top + 90, x + w, 420);
          g.closePath();
          g.fill();
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath(); g.moveTo(x + 10, top); g.lineTo(x + 34, top); g.quadraticCurveTo(x + w * 0.35, top + 90, x + w, 420); g.lineTo(x + w * 0.2, 420); g.closePath(); g.fill();
          /* glowing lava rivulets */
          g.strokeStyle = 'rgba(255,120,40,0.85)';
          g.lineCap = 'round';
          for (let k = 0; k < 4; ++k) {
            let px = x + (k - 1.5) * 16, py = top + 4;
            g.lineWidth = 3.5 - k * 0.5;
            g.beginPath();
            g.moveTo(px, py);
            while (py < 420) {
              py += 18;
              px += (rand() - 0.5) * 18 + (k - 1.5) * 4;
              g.lineTo(px, py);
            }
            g.stroke();
          }
          g.fillStyle = radial(g, x, top, 0, 70, [[0, 'rgba(255,200,90,0.9)'], [0.4, 'rgba(255,110,40,0.4)'], [1, 'rgba(255,90,30,0)']]);
          g.fillRect(x - 70, top - 70, 140, 140);
        });
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(80,24,16,0.35)';
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
    }
    L.push({ s: far, y: 130, f: 0.06 });
    /* basalt columns and forge towers with lit windows */
    const mid = strip(380);
    {
      const g = mid.g;
      for (let x = 0; x < STRIP_W;) {
        const w = 20 + rand() * 34, h = 90 + rand() * 200;
        const xx = x;
        g.fillStyle = linear(g, xx, 0, xx + w, 0, [[0, '#3a1814'], [0.5, '#2a100e'], [1, '#160808']]);
        g.fillRect(xx, 380 - h, w, h);
        g.fillStyle = 'rgba(255,120,50,0.25)';
        g.fillRect(xx, 380 - h, w, 3);
        if (rand() < 0.35) {
          for (let k = 0; k < 4; ++k) {
            g.fillStyle = rand() < 0.6 ? '#ffb04a' : '#ff7a2a';
            g.fillRect(xx + w * 0.3, 380 - h + 20 + k * 26, w * 0.4, 9);
          }
        }
        x += w + rand() * 8;
      }
      for (let i = 0; i < 3; ++i) {
        const x = 200 + i * 520, h = 300;
        g.fillStyle = '#1c0a0a';
        g.fillRect(x, 380 - h, 46, h);
        g.fillRect(x - 8, 380 - h, 62, 16);
        g.fillStyle = 'rgba(255,140,60,0.5)';
        g.fillRect(x + 4, 380 - h - 4, 38, 4);
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = linear(g, 0, 200, 0, 380, [[0, 'rgba(255,90,30,0)'], [1, 'rgba(255,90,30,0.35)']]);
      g.fillRect(0, 0, STRIP_W, 380);
      g.restore();
    }
    L.push({ s: mid, y: 250, f: 0.18 });
    /* near: crags and pipes underlit by lava */
    const near = paintHills(rand, 420, 190, 80, '#2a1210', '#0e0606', '#ff6a2a', function(g, ys, r) {
      for (let i = 0; i < 6; ++i) {
        const x = r() * STRIP_W, y = ys[Math.floor(x / 4)];
        wrapDraw(STRIP_W, x, 60, function(xx) {
          g.fillStyle = '#120808';
          g.fillRect(xx - 14, y - 160, 28, 180);
          g.fillRect(xx - 22, y - 168, 44, 14);
          g.fillStyle = 'rgba(255,110,40,0.55)';
          g.fillRect(xx - 14, y - 160, 3, 180);
          for (let b = 0; b < 4; ++b) {
            g.fillStyle = '#241010';
            g.fillRect(xx - 17, y - 130 + b * 36, 34, 6);
            g.fillStyle = 'rgba(255,140,60,0.4)';
            g.fillRect(xx - 17, y - 130 + b * 36, 34, 1);
          }
        });
      }
      /* glowing cracks in the slag below the crest */
      g.lineCap = 'round';
      for (let i = 0; i < 18; ++i) {
        let x = r() * STRIP_W, y = ys[Math.floor(x / 4)] + 30 + r() * 120;
        g.strokeStyle = 'rgba(255,' + (90 + Math.floor(r() * 80)) + ',30,0.75)';
        g.lineWidth = 1.5 + r() * 2;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; ++k) {
          x += 10 + r() * 24;
          y += (r() - 0.5) * 18;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = linear(g, 0, 200, 0, 420, [[0, 'rgba(255,100,30,0)'], [1, 'rgba(255,100,30,0.4)']]);
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
    });
    L.push({ s: near, y: 370, f: 0.38, fill: '#0e0606' });
    const glows = [];
    for (let i = 0; i < 3; ++i)
      glows.push({ x: [250, 820, 1300][i] / STRIP_W, y: 0, r: 160, color: '#ff8a3a', pulse: 0.4, f: 0.06, strip: true, sy: 130 + [160, 110, 190][i], speed: 1.3 + i * 0.4 });
    return { layers: L, glows: glows,
      palette: { ambient: '#ffb05a', fog: 'rgba(255,110,40,0.2)', light: '#ff8a3a' },
      front: { top: '#1a0606', topA: 0.35, bottom: '#ff5a1a', bottomA: 0.3 } };
  }

  /* ── world 4: Skyspire Citadel ── */
  function spire(g, x, base, h, w, body, light, gold) {
    g.fillStyle = body;
    g.fillRect(x - w / 2, base - h, w, h);
    g.fillStyle = light;
    g.fillRect(x - w / 2, base - h, w * 0.3, h);
    g.fillStyle = body;
    g.beginPath(); g.moveTo(x - w * 0.7, base - h); g.lineTo(x, base - h - w * 2.2); g.lineTo(x + w * 0.7, base - h); g.closePath(); g.fill();
    g.fillStyle = gold;
    g.beginPath(); g.moveTo(x - w * 0.15, base - h - w * 1.6); g.lineTo(x, base - h - w * 2.2); g.lineTo(x + w * 0.1, base - h - w * 1.6); g.closePath(); g.fill();
    g.fillRect(x - 1, base - h - w * 2.2 - 8, 2, 8);
    for (let k = 0; k < Math.floor(h / 24); ++k) {
      g.fillStyle = 'rgba(255,224,138,0.75)';
      g.fillRect(x - w * 0.12, base - h + 10 + k * 24, w * 0.24, 8);
    }
  }

  function island(g, x, y, w, rand, rock, grass, light) {
    const depth = w * (0.55 + rand() * 0.2);
    const pts = [];
    for (let k = 0; k <= 10; ++k) {
      const u = k / 10;
      pts.push([x - w / 2 + u * w, y + Math.pow(Math.sin(u * Math.PI), 0.8) * depth * (0.75 + rand() * 0.3)]);
    }
    g.beginPath();
    g.moveTo(x - w / 2, y);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.closePath();
    g.fillStyle = linear(g, x - w / 2, y, x + w / 2, y + depth, [[0, mix(rock, '#ffffff', 0.18)], [0.5, rock], [1, mix(rock, '#000000', 0.35)]]);
    g.fill();
    /* strata */
    g.save();
    g.clip();
    for (let k = 1; k < 6; ++k) {
      g.strokeStyle = k % 2 ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.1)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - w / 2, y + k * depth / 7);
      g.quadraticCurveTo(x, y + k * depth / 7 + 8 * (rand() - 0.5), x + w / 2, y + k * depth / 7);
      g.stroke();
    }
    g.restore();
    /* hanging roots */
    g.strokeStyle = 'rgba(70,50,60,0.6)';
    g.lineWidth = 1.2;
    for (let k = 0; k < 6; ++k) {
      const rx = x - w * 0.4 + rand() * w * 0.8;
      g.beginPath(); g.moveTo(rx, y + depth * 0.3); g.quadraticCurveTo(rx + 4, y + depth * 0.6, rx - 2, y + depth * (0.7 + rand() * 0.4)); g.stroke();
    }
    /* lush top with tufts */
    g.fillStyle = mix(grass, '#000000', 0.25);
    g.beginPath(); g.ellipse(x, y + 2, w / 2 + 4, 9, 0, 0, TWO_PI); g.fill();
    g.fillStyle = grass;
    g.beginPath(); g.ellipse(x, y - 1, w / 2 + 2, 7, 0, 0, TWO_PI); g.fill();
    g.fillStyle = light;
    g.beginPath(); g.ellipse(x - w * 0.12, y - 4, w * 0.32, 2.5, 0, 0, TWO_PI); g.fill();
    for (let k = 0; k < 8; ++k) {
      const tx = x - w * 0.45 + rand() * w * 0.9;
      g.fillStyle = mix(grass, '#ffffff', 0.15);
      g.beginPath(); g.arc(tx, y - 4, 4 + rand() * 5, Math.PI, TWO_PI); g.fill();
    }
    if (rand() < 0.5) {
      g.fillStyle = 'rgba(220,235,255,0.55)';
      g.fillRect(x + w * 0.28, y + 2, 3, depth * 1.4);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(x + w * 0.28 + 1, y + 2, 1, depth * 1.4);
    }
  }

  function buildCitadel(rand) {
    const L = [];
    L.push({ s: cloudStrip(rand, 320, 7, 140, 260, 120, 280, '#fff2e6', '#f0dcef', '#a990c8'), y: 0, f: 0.03, vx: 5 });
    const far = strip(420);
    {
      const g = far.g;
      for (let i = 0; i < 5; ++i) {
        const x = (i + 0.3 + rand() * 0.4) * STRIP_W / 5, y = 220 + rand() * 80, w = 150 + rand() * 80;
        wrapDraw(STRIP_W, x, w, function(xx) {
          island(g, xx, y, w, mulberry(i * 17 + 3), '#9a88c8', '#c8d8a8', '#fff0c8');
          if (i % 2 === 0) {
            spire(g, xx - 20, y, 110 + rand() * 60, 18, '#c8b8e8', '#ece0ff', '#ffe08a');
            spire(g, xx + 26, y, 70 + rand() * 40, 14, '#b8a8e0', '#e0d4ff', '#ffe08a');
          }
        });
      }
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(210,190,240,0.4)';
      g.fillRect(0, 0, STRIP_W, 420);
      g.restore();
    }
    L.push({ s: far, y: 70, f: 0.07 });
    const mid = strip(420);
    {
      const g = mid.g;
      for (let i = 0; i < 4; ++i) {
        const x = (i + 0.5) * STRIP_W / 4 + (rand() - 0.5) * 120, y = 200 + rand() * 90, w = 180 + rand() * 120;
        wrapDraw(STRIP_W, x, w, function(xx) {
          island(g, xx, y, w, mulberry(i * 29 + 11), '#6e5c9c', '#8ac070', '#fff0b0');
          if (i === 1)
            spire(g, xx, y, 160, 26, '#a090d0', '#d8ccff', '#ffd75a');
        });
      }
    }
    L.push({ s: mid, y: 150, f: 0.15, bob: 6 });
    L.push({ s: seaStrip(rand, 480, 9, 300, 260, 420, '#fff8ff', '#efe0f6', '#c8b4e4'), y: 260, f: 0.3, vx: 10, fill: '#c8b4e4' });
    const sea = seaStrip(rand, 420, 7, 290, 300, 460, '#f6eefc', '#e2d6f0', '#a898c8');
    /* the near sea sinks into soft lavender shade so pale platforms in front stay readable */
    sea.g.save();
    sea.g.globalCompositeOperation = 'source-atop';
    sea.g.fillStyle = linear(sea.g, 0, 240, 0, 420, [[0, 'rgba(90,70,140,0)'], [0.5, 'rgba(90,70,140,0.25)'], [1, 'rgba(70,52,120,0.45)']]);
    sea.g.fillRect(0, 0, STRIP_W, 420);
    sea.g.restore();
    L.push({ s: sea, y: 350, f: 0.45, vx: 16, fill: '#8a78b0' });
    return { layers: L, glows: [{ x: 0.23, y: 0.55, r: 260, color: '#ffe0a0', pulse: 0.06, fixed: true }],
      palette: { ambient: '#fff0c0', fog: 'rgba(255,240,255,0.3)', light: '#ffe08a' },
      front: { top: null, bottom: '#fff4ff', bottomA: 0.35 } };
  }

  const BUILDERS = [buildMeadow, buildCaverns, buildPeaks, buildForge, buildCitadel];

  /* trims fully transparent rows off a strip (build time only) so no
     empty pixels are blended every frame; returns the rows cut off the top */
  function cropStrip(L) {
    const c = L.img;
    const g = c.getContext('2d');
    if (!g.getImageData || L.rain)
      return;
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const rowHas = function(y) {
      for (let x = 0; x < c.width; x += 3)
        if (data[(y * c.width + x) * 4 + 3] > 2)
          return true;
      return false;
    };
    let top = 0, bottom = c.height - 1;
    while (top < bottom && !rowHas(top)) ++top;
    while (bottom > top && !rowHas(bottom)) --bottom;
    top = Math.max(0, top - 1);
    bottom = Math.min(c.height - 1, bottom + 1);
    if (top === 0 && bottom === c.height - 1)
      return;
    const n = makeCanvas(c.width, bottom - top + 1);
    n.getContext('2d').drawImage(c, 0, -top);
    L.img = n;
    L.y += top;
    L.h = n.height;
  }

  /* the thin atmosphere bands drawn over the level */
  const BAND_H = 230;
  function band(color, alpha, fromTop) {
    const c = makeCanvas(VIEW_W, BAND_H);
    const g = c.getContext('2d');
    g.fillStyle = linear(g, 0, 0, 0, BAND_H, fromTop
      ? [[0, rgba(color, alpha)], [0.5, rgba(color, alpha * 0.3)], [1, rgba(color, 0)]]
      : [[0, rgba(color, 0)], [0.5, rgba(color, alpha * 0.3)], [1, rgba(color, alpha)]]);
    g.fillRect(0, 0, VIEW_W, BAND_H);
    return c;
  }

  Object.assign(Kit, { BUILDERS, cropStrip, BAND_H, band });
})();
