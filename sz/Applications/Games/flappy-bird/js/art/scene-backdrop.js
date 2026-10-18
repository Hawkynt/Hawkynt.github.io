;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const PARTS = SZ.FlappySceneParts || (SZ.FlappySceneParts = {});

  /* Backdrop builders: the sky, the far / mid / near silhouette strips, cloud sprites
     and the ground tile, each painted once into an offscreen canvas. */

  const {
    TWO_PI, SCREEN_W, SCREEN_H, GROUND_H, GROUND_TILE, PERIOD, FAR_H, MID_H, NEAR_H, CLOUD_W, CLOUD_H, rgba,
    shade, shadeRgba, makeCanvas, waveTop, blockTop, makeBlocks, coneTop, wrapX, traceProfile, paintStrip,
    crestBand, triangle
  } = PARTS.kit;

  /* ── Sky ── */

  function buildSky(theme, rng) {
    const cv = makeCanvas(SCREEN_W, SCREEN_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, theme.sky[0]);
    g.addColorStop(1, theme.sky[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);

    if (theme.night) {
      for (let i = 0; i < 140; ++i) {
        c.globalAlpha = 0.4 + rng() * 0.6;
        c.fillStyle = '#ffffff';
        const s = rng() < 0.5 ? 1 : 2;
        c.fillRect(rng() * SCREEN_W, rng() * SCREEN_H * 0.6, s, s);
      }
      c.globalAlpha = 1;
    }

    const sun = theme.sun;
    const glow = c.createRadialGradient(sun.x, sun.y, sun.r * 0.4, sun.x, sun.y, sun.r * 3.2);
    glow.addColorStop(0, rgba(sun.glow, theme.night ? 0.32 : 0.55));
    glow.addColorStop(1, rgba(sun.glow, 0));
    c.fillStyle = glow;
    c.beginPath();
    c.arc(sun.x, sun.y, sun.r * 3.2, 0, TWO_PI);
    c.fill();

    const disc = c.createRadialGradient(sun.x - sun.r * 0.3, sun.y - sun.r * 0.3, sun.r * 0.2, sun.x, sun.y, sun.r);
    disc.addColorStop(0, sun.color);
    disc.addColorStop(1, shade(sun.color, -0.08));
    c.fillStyle = disc;
    c.beginPath();
    c.arc(sun.x, sun.y, sun.r, 0, TWO_PI);
    c.fill();

    if (theme.night) {
      c.fillStyle = shadeRgba(sun.color, -0.28, 0.45);
      for (let i = 0; i < 3; ++i) {
        const a = rng() * TWO_PI;
        const d = rng() * sun.r * 0.55;
        c.beginPath();
        c.arc(sun.x + Math.cos(a) * d, sun.y + Math.sin(a) * d, sun.r * (0.12 + rng() * 0.14), 0, TWO_PI);
        c.fill();
      }
    }

    if (theme.weather.kind === 'sand') {
      const haze = c.createLinearGradient(0, 420, 0, 520);
      haze.addColorStop(0, rgba(theme.sky[1], 0));
      haze.addColorStop(0.5, shadeRgba(theme.sky[1], 0.1, 0.45));
      haze.addColorStop(1, rgba(theme.sky[1], 0));
      c.fillStyle = haze;
      c.fillRect(0, 420, SCREEN_W, 100);
    }

    if (theme.weather.kind === 'embers') {
      c.fillStyle = rgba('#1a0505', 0.25);
      for (let i = 0; i < 3; ++i) {
        c.beginPath();
        c.ellipse(300 + i * 340, 80 + i * 85, 620, 42, 0, 0, TWO_PI);
        c.fill();
      }
    }

    return cv;
  }

  /* ── Far strip: the horizon line ── */

  function buildFar(biome, theme, rng) {
    const cv = makeCanvas(PERIOD, FAR_H);
    const c = cv.getContext('2d');
    let top;
    let blocks = null;

    if (biome === 'city') {
      blocks = makeBlocks(rng, 30, 90, 120, 260, FAR_H);
      top = blockTop(FAR_H, blocks);
    } else if (biome === 'volcano') {
      top = coneTop(FAR_H, [
        { cx: 520, hw: 430, top: 46, crater: 46 },
        { cx: 130, hw: 190, top: 150 },
        { cx: 900, hw: 240, top: 118 }
      ]);
    } else if (biome === 'desert') {
      const raw = waveTop(FAR_H, 150, [[72, 1, 0.6], [38, 2, 2.9], [14, 4, 1.8]]);
      top = function(x) { return Math.max(raw(x), 92); }; /* peaks clamp to the plateau level */
    } else if (biome === 'frost') {
      top = waveTop(FAR_H, 160, [[60, 2, 0.4], [34, 3, 1.9], [15, 5, 3.2], [7, 9, 0.7]]);
    } else if (biome === 'forest') {
      top = waveTop(FAR_H, 150, [[36, 1, 2.4], [22, 2, 0.9], [12, 4, 2.0], [6, 8, 5.1], [3, 13, 1.1]]);
    } else {
      top = waveTop(FAR_H, 150, [[42, 1, 0.8], [24, 2, 2.2], [11, 3, 4.1], [5, 6, 1.4]]);
    }

    paintStrip(c, FAR_H, top, theme.far);

    if (biome === 'frost') crestBand(c, top, 105, 26, 'rgba(255,255,255,0.85)');

    if (blocks) {
      /* the window pattern is decided once per building so both seam copies match */
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        const cells = [];
        const cols = Math.floor((b.w - 6) / 6);
        const rows = Math.floor((b.h - 12) / 8);
        for (let r = 0; r < rows; ++r) {
          for (let col = 0; col < cols; ++col) {
            if (rng() >= 0.25) continue;
            cells.push({ dx: 3 + col * 6, dy: 8 + r * 8, color: rng() < 0.5 ? '#ffd96a' : '#6ae4ff' });
          }
        }
        wrapX(b.x + b.w / 2, function(cx) {
          const bx = cx - b.w / 2;
          if (bx > PERIOD || bx + b.w < 0) return;
          c.globalAlpha = 0.85;
          for (let k = 0; k < cells.length; ++k) {
            c.fillStyle = cells[k].color;
            c.fillRect(bx + cells[k].dx, b.top + cells[k].dy, 2, 3);
          }
          c.globalAlpha = 1;
        });
      }
    }

    if (biome === 'volcano') {
      const crater = c.createRadialGradient(520, 46, 4, 520, 46, 120);
      crater.addColorStop(0, rgba('#ffd2a0', 0.75));
      crater.addColorStop(0.35, rgba('#ff7a3a', 0.5));
      crater.addColorStop(1, rgba('#ff7a3a', 0));
      c.fillStyle = crater;
      c.beginPath();
      c.arc(520, 46, 120, 0, TWO_PI);
      c.fill();
    }

    /* atmospheric fog over the lower half of the far strip, clipped to the silhouette */
    c.save();
    traceProfile(c, top);
    c.lineTo(PERIOD, FAR_H);
    c.lineTo(0, FAR_H);
    c.closePath();
    c.clip();
    c.fillStyle = rgba(theme.sky[1], 0.35);
    c.fillRect(0, FAR_H * 0.5, PERIOD, FAR_H * 0.5);
    c.restore();

    return cv;
  }

  /* ── Mid strip: closer, darker shapes ── */

  function buildMid(biome, theme, rng) {
    const cv = makeCanvas(PERIOD, MID_H);
    const c = cv.getContext('2d');
    let top;
    let blocks = null;

    if (biome === 'city') {
      blocks = makeBlocks(rng, 60, 140, 90, 190, MID_H);
      top = blockTop(MID_H, blocks);
    } else if (biome === 'volcano') {
      top = waveTop(MID_H, 88, [[22, 1, 0.8], [10, 3, 2.2]]);
    } else if (biome === 'desert') {
      top = waveTop(MID_H, 112, [[40, 1, 0.5], [22, 2, 2.7], [9, 3, 4.9]]);
    } else if (biome === 'frost') {
      top = waveTop(MID_H, 100, [[26, 1, 2.9], [12, 3, 1.3]]);
    } else if (biome === 'forest') {
      top = waveTop(MID_H, 118, [[30, 1, 0.3], [14, 2, 2.2], [6, 5, 4.4]]);
    } else {
      top = waveTop(MID_H, 108, [[34, 1, 1.7], [18, 2, 4.2], [8, 4, 0.6]]);
    }

    paintStrip(c, MID_H, top, theme.mid);

    if (biome === 'meadow') {
      const trees = [];
      for (let i = 0; i < 7; ++i) trees.push({ x: rng() * PERIOD, r: 12 + rng() * 7 });
      for (let i = 0; i < trees.length; ++i) {
        const tr = trees[i];
        wrapX(tr.x, function(px) {
          const gy = top(px);
          c.fillStyle = shade(theme.mid, 0.06);
          c.beginPath();
          c.arc(px, gy - tr.r - 6, tr.r, 0, TWO_PI);
          c.fill();
          c.fillStyle = shade(theme.mid, -0.25);
          c.fillRect(px - 2, gy - 8, 4, 8);
        });
      }
    } else if (biome === 'frost') {
      const pines = [];
      for (let i = 0; i < 12; ++i) pines.push({ x: rng() * PERIOD, h: 46 + rng() * 26 });
      for (let i = 0; i < pines.length; ++i) {
        const p = pines[i];
        wrapX(p.x, function(px) {
          const gy = top(px) + 4;
          c.fillStyle = shade(theme.mid, -0.14);
          for (let k = 0; k < 3; ++k) {
            const ty = gy - p.h * (k + 1) / 3;
            triangle(c, px, ty - p.h * 0.16, ty + p.h * 0.16, (p.h * 0.42) * (1 - k * 0.26));
          }
          c.fillStyle = 'rgba(255,255,255,0.8)';
          c.fillRect(px - 2, gy - p.h - 8, 4, 4);
        });
      }
    } else if (biome === 'forest') {
      const pines = [];
      for (let i = 0; i < 14; ++i) pines.push({ x: rng() * PERIOD, h: 70 + rng() * 50, hw: 11 + rng() * 7 });
      for (let i = 0; i < pines.length; ++i) {
        const p = pines[i];
        wrapX(p.x, function(px) {
          c.fillStyle = shade(theme.mid, -0.08);
          triangle(c, px, top(px) + 6 - p.h, top(px) + 6, p.hw);
        });
      }
    } else if (blocks) {
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        if (rng() < 0.45) continue;
        const neon = rng() < 0.5 ? '#ff4cd8' : '#4cf0ff';
        const w = 14 + Math.floor(rng() * Math.max(6, b.w - 30));
        const dy = 16 + rng() * Math.max(4, b.h - 44);
        wrapX(b.x + b.w / 2, function(cx) {
          const bx = cx - b.w / 2;
          if (bx > PERIOD || bx + b.w < 0) return;
          const sx = bx + (b.w - w) / 2;
          const sy = b.top + dy;
          c.globalAlpha = 0.18;
          c.fillStyle = neon;
          c.fillRect(sx, sy, w, 9);
          c.globalAlpha = 0.85;
          c.strokeStyle = neon;
          c.lineWidth = 2;
          c.strokeRect(sx, sy, w, 9);
          c.globalAlpha = 1;
        });
      }
    } else if (biome === 'volcano') {
      const spires = [];
      for (let i = 0; i < 9; ++i) spires.push({ x: rng() * PERIOD, h: 90 + rng() * 70, hw: 13 + rng() * 17 });
      for (let i = 0; i < spires.length; ++i) {
        const s = spires[i];
        wrapX(s.x, function(px) {
          const gy = top(px) + 8;
          c.fillStyle = shade(theme.mid, -0.12);
          triangle(c, px, gy - s.h, gy, s.hw);
          c.strokeStyle = rgba('#ff7a3a', 0.7);
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(px, gy - s.h + 8);
          c.lineTo(px - 4, gy - s.h * 0.45);
          c.lineTo(px + 3, gy - 6);
          c.stroke();
          c.strokeStyle = rgba('#ffb27a', 0.6);
          c.lineWidth = 0.7;
          c.stroke();
        });
      }
    }

    return cv;
  }

  /* ── Near strip: the closest band, right above the ground ── */

  function buildNear(biome, theme, rng) {
    const cv = makeCanvas(PERIOD, NEAR_H);
    const c = cv.getContext('2d');
    let top;
    let blocks = null;

    if (biome === 'city') {
      blocks = makeBlocks(rng, 90, 200, 50, 100, NEAR_H);
      top = blockTop(NEAR_H, blocks);
    } else if (biome === 'desert') {
      top = waveTop(NEAR_H, 62, [[14, 1, 2.2], [7, 3, 0.9]]);
    } else if (biome === 'frost') {
      top = waveTop(NEAR_H, 66, [[16, 1, 0.4], [8, 2, 3.1]]);
    } else if (biome === 'volcano') {
      top = waveTop(NEAR_H, 60, [[15, 1, 1.4], [7, 3, 4.6]]);
    } else if (biome === 'forest') {
      top = waveTop(NEAR_H, 64, [[14, 1, 3.3], [7, 4, 1.2]]);
    } else {
      top = waveTop(NEAR_H, 68, [[16, 1, 1.9], [9, 3, 0.7], [4, 7, 2.8]]);
    }

    paintStrip(c, NEAR_H, top, theme.near);

    if (biome === 'meadow') {
      const bushes = [];
      for (let i = 0; i < 10; ++i) bushes.push({ x: rng() * PERIOD, r: 14 + rng() * 12 });
      for (let i = 0; i < bushes.length; ++i) {
        const b = bushes[i];
        wrapX(b.x, function(px) {
          const gy = top(px) + 3;
          c.fillStyle = shade(theme.near, -0.1);
          c.beginPath();
          c.arc(px, gy, b.r, Math.PI, TWO_PI);
          c.fill();
        });
      }
      const petals = ['#ff6a8a', '#ffd94a', '#ffffff', '#ff9ad8'];
      const flowers = [];
      for (let i = 0; i < 40; ++i) flowers.push({ x: rng() * PERIOD, dy: 4 + rng() * 10, color: petals[i % petals.length] });
      for (let i = 0; i < flowers.length; ++i) {
        const f = flowers[i];
        wrapX(f.x, function(px) {
          c.fillStyle = f.color;
          c.globalAlpha = 0.9;
          c.fillRect(px, top(px) + f.dy, 2, 2);
          c.globalAlpha = 1;
        });
      }
    } else if (biome === 'desert') {
      const cacti = [];
      for (let i = 0; i < 6; ++i) cacti.push({ x: rng() * PERIOD, h: 44 + rng() * 30 });
      for (let i = 0; i < cacti.length; ++i) {
        const k = cacti[i];
        wrapX(k.x, function(px) {
          const gy = top(px) + 4;
          const h = k.h;
          c.fillStyle = shade(theme.near, 0.05);
          c.fillRect(px - 4, gy - h, 8, h);
          c.beginPath();
          c.arc(px, gy - h, 4, 0, TWO_PI);
          c.fill();
          c.fillRect(px - 16, gy - h * 0.62, 8, h * 0.34);
          c.fillRect(px - 16, gy - h * 0.62, 12, 7);
          c.fillRect(px + 8, gy - h * 0.44, 8, h * 0.24);
          c.fillRect(px + 4, gy - h * 0.44, 12, 7);
          c.strokeStyle = shadeRgba(theme.near, 0.3, 0.5);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px - 2, gy - h + 4);
          c.lineTo(px - 2, gy - 4);
          c.stroke();
        });
      }
      const rocks = [];
      for (let i = 0; i < 8; ++i) rocks.push({ x: rng() * PERIOD, rx: 10 + rng() * 10, ry: 5 + rng() * 5 });
      for (let i = 0; i < rocks.length; ++i) {
        const r = rocks[i];
        wrapX(r.x, function(px) {
          c.fillStyle = '#9a8468';
          c.beginPath();
          c.ellipse(px, top(px) + 6, r.rx, r.ry, 0, 0, TWO_PI);
          c.fill();
        });
      }
    } else if (biome === 'frost') {
      const firs = [];
      for (let i = 0; i < 10; ++i) firs.push({ x: rng() * PERIOD, h: 52 + rng() * 34 });
      for (let i = 0; i < firs.length; ++i) {
        const f = firs[i];
        wrapX(f.x, function(px) {
          const gy = top(px) + 6;
          c.fillStyle = shade(theme.near, -0.12);
          triangle(c, px, gy - f.h, gy, f.h * 0.32);
          c.fillStyle = 'rgba(255,255,255,0.75)';
          triangle(c, px, gy - f.h, gy - f.h * 0.45, f.h * 0.18);
        });
      }
    } else if (biome === 'forest') {
      c.strokeStyle = shadeRgba(theme.near, 0.35, 0.7);
      c.lineWidth = 1.5;
      const ferns = [];
      for (let i = 0; i < 16; ++i) ferns.push(rng() * PERIOD);
      for (let i = 0; i < ferns.length; ++i) {
        wrapX(ferns[i], function(px) {
          const gy = top(px) + 8;
          for (let k = -1; k <= 1; ++k) {
            c.beginPath();
            c.moveTo(px, gy);
            c.quadraticCurveTo(px + k * 10, gy - 14, px + k * 16, gy - 20);
            c.stroke();
          }
        });
      }
      const shrooms = [];
      for (let i = 0; i < 8; ++i) shrooms.push({ x: rng() * PERIOD, r: 4 + rng() * 3 });
      for (let i = 0; i < shrooms.length; ++i) {
        const m = shrooms[i];
        wrapX(m.x, function(px) {
          const gy = top(px) + 10;
          const halo = c.createRadialGradient(px, gy - 6, 1, px, gy - 6, m.r * 3);
          halo.addColorStop(0, rgba('#7affd8', 0.4));
          halo.addColorStop(1, rgba('#7affd8', 0));
          c.fillStyle = halo;
          c.beginPath();
          c.arc(px, gy - 6, m.r * 3, 0, TWO_PI);
          c.fill();
          c.fillStyle = '#e8e0c8';
          c.fillRect(px - 1.5, gy - 6, 3, 7);
          c.fillStyle = '#7affd8';
          c.beginPath();
          c.arc(px, gy - 6, m.r, Math.PI, TWO_PI);
          c.fill();
        });
      }
    } else if (blocks) {
      for (let i = 0; i < blocks.length; ++i) {
        const b = blocks[i];
        wrapX(b.x + b.w / 2, function(cx) {
          const bx = cx - b.w / 2;
          if (bx > PERIOD || bx + b.w < 0) return;
          c.strokeStyle = shadeRgba(theme.near, 0.3, 0.8);
          c.lineWidth = 2;
          for (let k = 0; k < 2; ++k) {
            const ax = bx + b.w * (0.25 + k * 0.5);
            const ah = 14 + (k ? 10 : 0);
            c.beginPath();
            c.moveTo(ax, b.top);
            c.lineTo(ax, b.top - ah);
            c.stroke();
          }
          const lx = bx + b.w * 0.75;
          const ly = b.top - 24;
          const halo = c.createRadialGradient(lx, ly, 1, lx, ly, 10);
          halo.addColorStop(0, rgba('#ff4d4d', 0.7));
          halo.addColorStop(1, rgba('#ff4d4d', 0));
          c.fillStyle = halo;
          c.beginPath();
          c.arc(lx, ly, 10, 0, TWO_PI);
          c.fill();
          c.fillStyle = '#ff6a6a';
          c.beginPath();
          c.arc(lx, ly, 2.5, 0, TWO_PI);
          c.fill();
        });
      }
    } else if (biome === 'volcano') {
      const rocks = [];
      for (let i = 0; i < 9; ++i) rocks.push({ x: rng() * PERIOD, w: 22 + rng() * 26, h: 18 + rng() * 22 });
      for (let i = 0; i < rocks.length; ++i) {
        const k = rocks[i];
        wrapX(k.x, function(px) {
          const gy = top(px) + 10;
          c.fillStyle = shade(theme.near, 0.06);
          c.beginPath();
          c.moveTo(px - k.w / 2, gy);
          c.lineTo(px - k.w * 0.3, gy - k.h);
          c.lineTo(px + k.w * 0.25, gy - k.h * 0.8);
          c.lineTo(px + k.w / 2, gy);
          c.closePath();
          c.fill();
          c.strokeStyle = rgba('#ff5a1a', 0.85);
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(px - k.w * 0.3, gy - k.h + 3);
          c.lineTo(px - k.w * 0.05, gy - k.h * 0.4);
          c.lineTo(px + k.w * 0.2, gy);
          c.stroke();
          c.strokeStyle = rgba('#ffb27a', 0.7);
          c.lineWidth = 0.8;
          c.stroke();
        });
      }
    }

    return cv;
  }

  /* ── Cloud sprites ── */

  function buildCloud(theme, rng) {
    const cv = makeCanvas(CLOUD_W, CLOUD_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, CLOUD_H);
    g.addColorStop(0, shade(theme.cloud, 0.3));
    g.addColorStop(1, shade(theme.cloud, -0.12));
    c.fillStyle = g;
    c.globalAlpha = 0.9;
    const n = 6 + Math.floor(rng() * 4);
    for (let i = 0; i < n; ++i) {
      const x = 40 + rng() * (CLOUD_W - 80);
      const y = 40 + rng() * 40;
      const r = 26 + rng() * 22;
      c.beginPath();
      c.arc(x, y, r, 0, TWO_PI);
      c.fill();
    }
    c.globalAlpha = 1;
    return cv;
  }

  /* ── Ground tile ── */

  function buildGround(biome, theme, rng) {
    const cv = makeCanvas(GROUND_TILE, GROUND_H);
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, GROUND_H);
    g.addColorStop(0, theme.ground);
    g.addColorStop(1, theme.groundDark);
    c.fillStyle = g;
    c.fillRect(0, 0, GROUND_TILE, GROUND_H);
    c.fillStyle = theme.groundTop;
    c.fillRect(0, 0, GROUND_TILE, 10);
    c.fillStyle = shade(theme.groundTop, -0.25);
    c.fillRect(0, 10, GROUND_TILE, 2);

    /* details are drawn at both wrapped offsets so the tile seams stay clean */
    const wrapTile = function(x, fn) {
      fn(x);
      fn(x - GROUND_TILE);
      fn(x + GROUND_TILE);
    };

    if (biome === 'meadow') {
      const blades = [];
      for (let i = 0; i < 26; ++i) blades.push({ x: rng() * GROUND_TILE, lean: (rng() - 0.5) * 4, tip: 4 + rng() * 4, light: i & 1 });
      for (let i = 0; i < blades.length; ++i) {
        const b = blades[i];
        wrapTile(b.x, function(px) {
          c.strokeStyle = b.light ? shadeRgba(theme.groundTop, 0.2, 0.8) : shadeRgba(theme.groundTop, -0.25, 0.8);
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(px, 12);
          c.lineTo(px + b.lean, b.tip);
          c.stroke();
        });
      }
      const pebbles = [];
      for (let i = 0; i < 10; ++i) pebbles.push({ x: rng() * GROUND_TILE, y: 30 + rng() * 40, rx: 3 + rng() * 3, ry: 2 + rng() * 2 });
      for (let i = 0; i < pebbles.length; ++i) {
        const p = pebbles[i];
        wrapTile(p.x, function(px) {
          c.fillStyle = shadeRgba(theme.groundDark, -0.15, 0.7);
          c.beginPath();
          c.ellipse(px, p.y, p.rx, p.ry, 0, 0, TWO_PI);
          c.fill();
        });
      }
    } else if (biome === 'desert') {
      c.strokeStyle = shadeRgba(theme.groundDark, 0.1, 0.5);
      c.lineWidth = 1.5;
      for (let i = 0; i < 8; ++i) {
        const x = rng() * GROUND_TILE;
        const y = 24 + i * 6;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + 30, y - 4, x + 60, y);
        c.stroke();
      }
    } else if (biome === 'frost') {
      for (let i = 0; i < 40; ++i) {
        const x = rng() * GROUND_TILE;
        const y = 16 + rng() * 58;
        c.fillStyle = 'rgba(255,255,255,' + (0.5 + rng() * 0.5).toFixed(2) + ')';
        wrapTile(x, function(px) { c.fillRect(px, y, 2, 2); });
      }
      c.strokeStyle = shadeRgba(theme.groundDark, -0.2, 0.6);
      c.lineWidth = 1;
      for (let i = 0; i < 5; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.beginPath();
          c.moveTo(px, 20);
          c.lineTo(px + 14, 40);
          c.lineTo(px + 6, 62);
          c.stroke();
        });
      }
    } else if (biome === 'forest') {
      const tufts = [];
      for (let i = 0; i < 14; ++i) tufts.push({ x: rng() * GROUND_TILE, y: 14 + rng() * 8, r: 4 + rng() * 4 });
      for (let i = 0; i < tufts.length; ++i) {
        const t = tufts[i];
        wrapTile(t.x, function(px) {
          c.fillStyle = shadeRgba(theme.groundTop, 0.2, 0.7);
          c.beginPath();
          c.arc(px, t.y, t.r, Math.PI, TWO_PI);
          c.fill();
        });
      }
      c.strokeStyle = shadeRgba(theme.groundDark, -0.2, 0.7);
      c.lineWidth = 2;
      for (let i = 0; i < 6; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.beginPath();
          c.moveTo(px, 26);
          c.quadraticCurveTo(px + 12, 34, px + 26, 30);
          c.stroke();
        });
      }
    } else if (biome === 'city') {
      c.fillStyle = 'rgba(240,210,90,0.75)';
      for (let x = 0; x < GROUND_TILE; x += 64) c.fillRect(x, 40, 32, 4);
      for (let i = 0; i < 30; ++i) {
        const x = rng() * GROUND_TILE;
        const y = 16 + rng() * 58;
        c.fillStyle = shadeRgba(theme.groundDark, 0.2, 0.4);
        wrapTile(x, function(px) { c.fillRect(px, y, 2, 2); });
      }
    } else if (biome === 'volcano') {
      c.strokeStyle = shadeRgba(theme.groundDark, -0.3, 0.8);
      c.lineWidth = 1;
      for (let i = 0; i < 10; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.beginPath();
          c.moveTo(px, 16);
          c.lineTo(px + 10, 34);
          c.lineTo(px - 6, 52);
          c.lineTo(px + 8, 72);
          c.stroke();
        });
      }
      for (let i = 0; i < 5; ++i) {
        const x = rng() * GROUND_TILE;
        wrapTile(x, function(px) {
          c.strokeStyle = rgba('#ff5a1a', 0.8);
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(px, 22 + i * 9);
          c.lineTo(px + 18, 26 + i * 9);
          c.lineTo(px + 34, 21 + i * 9);
          c.stroke();
          c.strokeStyle = rgba('#ffb27a', 0.7);
          c.lineWidth = 0.8;
          c.stroke();
        });
      }
    }

    return cv;
  }

  PARTS.backdrop = { buildSky, buildFar, buildMid, buildNear, buildCloud, buildGround };
})();
