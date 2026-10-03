;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Procedural 16x16 pixel tiles for underground combat terrain, which the
  // Kenney sheets only cover with flat floors. Each terrain gets several
  // seeded variants so a board never shows the same tile twice in a row.
  // Tiles are painted once into an in-memory sheet ("terrain").

  const T = 16;
  const VARIANTS = 4;

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rgb(hex, f = 1) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function px(ctx, x, y, color, w = 1, h = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // --- painters (draw one tile at ox, oy) -------------------------------------

  // Irregular flagstones with mortar, bevel light and the odd crack.
  function flagstones(ctx, ox, oy, r, base, mortar, { moss = 0 } = {}) {
    px(ctx, ox, oy, mortar, T, T);
    const rows = [[0, 5], [5, 6], [11, 5]];
    let shift = Math.floor(r() * 6);
    for (const [y0, h] of rows) {
      let x = -shift;
      shift = (shift + 3 + Math.floor(r() * 4)) % 8;
      while (x < T) {
        const w = 5 + Math.floor(r() * 5);
        const x0 = Math.max(0, x + 1), x1 = Math.min(T, x + w);
        if (x1 - x0 >= 2) {
          const tone = 0.86 + r() * 0.24;
          px(ctx, ox + x0, oy + y0 + 1, rgb(base, tone), x1 - x0, h - 1);
          px(ctx, ox + x0, oy + y0 + 1, rgb(base, tone * 1.16), x1 - x0, 1);       // top bevel
          px(ctx, ox + x0, oy + y0 + h - 1, rgb(base, tone * 0.78), x1 - x0, 1);   // bottom shadow
          if (r() < 0.25) {
            const cx = x0 + 1 + Math.floor(r() * Math.max(1, x1 - x0 - 2));
            px(ctx, ox + cx, oy + y0 + 2, rgb(base, 0.6), 1, 2);
            px(ctx, ox + cx + 1, oy + y0 + 3, rgb(base, 0.6), 1, 1);
          }
          if (moss > 0 && r() < moss) {
            px(ctx, ox + x0, oy + y0 + h - 2, '#4f7a3a', 2, 1);
            px(ctx, ox + x0 + 1, oy + y0 + h - 3, '#6a9a4a', 1, 1);
          }
        }
        x += w;
      }
    }
  }

  // Packed earth with stones, grit and a few pebbles casting shadows.
  function roughGround(ctx, ox, oy, r, base) {
    for (let y = 0; y < T; ++y)
      for (let x = 0; x < T; ++x)
        px(ctx, ox + x, oy + y, rgb(base, 0.9 + r() * 0.16));
    for (let i = 0; i < 3; ++i) {
      const x = 1 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 12);
      const w = 2 + Math.floor(r() * 3), h = 2 + Math.floor(r() * 2);
      px(ctx, ox + x, oy + y + h, rgb(base, 0.62), w, 1);              // shadow
      px(ctx, ox + x, oy + y, rgb('#8a8290', 0.85 + r() * 0.3), w, h);  // stone
      px(ctx, ox + x, oy + y, rgb('#8a8290', 1.25), w - 1, 1);           // highlight
    }
    for (let i = 0; i < 6; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), rgb(base, 0.65));
  }

  function lavaTile(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#3a2420');
    // glowing veins
    let x = Math.floor(r() * T), y = 0;
    while (y < T) {
      px(ctx, ox + x, oy + y, '#ff7a1a', 1, 1);
      if (x + 1 < T)
        px(ctx, ox + x + 1, oy + y, '#ffc84a', 1, 1);
      x = Math.max(0, Math.min(T - 2, x + Math.floor(r() * 3) - 1));
      ++y;
    }
    for (let i = 0; i < 5; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), '#ff9a3a');
  }

  function brickWall(ctx, ox, oy, r, base) {
    px(ctx, ox, oy, rgb(base, 0.55), T, T);
    for (let row = 0; row < 4; ++row) {
      const off = row % 2 ? 4 : 0;
      for (let x = -off; x < T; x += 8) {
        const x0 = Math.max(0, x), x1 = Math.min(T, x + 7);
        const tone = 0.9 + r() * 0.2;
        px(ctx, ox + x0, oy + row * 4, rgb(base, tone), x1 - x0, 3);
        px(ctx, ox + x0, oy + row * 4, rgb(base, tone * 1.2), x1 - x0, 1);
      }
    }
  }

  // Meadow grass: mottled greens, blade tufts, the odd flower.
  function grass(ctx, ox, oy, r, base, { flowers = 0.5, dry = 0 } = {}) {
    for (let y = 0; y < T; y += 2)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb(base, 0.92 + r() * 0.14), 2, 2);
    for (let i = 0; i < 7; ++i) {
      const x = Math.floor(r() * 15), y = 2 + Math.floor(r() * 13);
      px(ctx, ox + x, oy + y - 2, rgb(base, 1.28), 1, 2);
      px(ctx, ox + x + 1, oy + y - 1, rgb(base, 1.18), 1, 1);
      px(ctx, ox + x, oy + y, rgb(base, 0.72), 2, 1);
    }
    if (dry > 0)
      for (let i = 0; i < 6; ++i)
        px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), '#b8a860', 2, 1);
    if (r() < flowers) {
      const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11);
      const petal = ['#f4e05a', '#f4f4f4', '#e86a8a', '#8ab8ff'][Math.floor(r() * 4)];
      px(ctx, ox + x - 1, oy + y, petal); px(ctx, ox + x + 1, oy + y, petal);
      px(ctx, ox + x, oy + y - 1, petal); px(ctx, ox + x, oy + y + 1, petal);
      px(ctx, ox + x, oy + y, '#f8c040');
    }
  }

  // Wheel-rutted dirt track.
  function dirtRoad(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#9a7a52');
    for (let i = 0; i < 4; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), '#c8a878', 2, 1);
  }

  function sand(ctx, ox, oy, r) {
    for (let y = 0; y < T; ++y)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb('#d8bc80', 0.94 + r() * 0.1), 2, 1);
    for (let i = 0; i < 3; ++i) {
      const y = 2 + Math.floor(r() * 12), x = Math.floor(r() * 8);
      px(ctx, ox + x, oy + y, '#e8d098', 6, 1);
      px(ctx, ox + x + 1, oy + y + 1, '#b89a60', 5, 1);
    }
  }

  function snowField(ctx, ox, oy, r) {
    for (let y = 0; y < T; y += 2)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb('#e8eef8', 0.95 + r() * 0.06), 2, 2);
    for (let i = 0; i < 4; ++i) {
      const x = Math.floor(r() * 12), y = Math.floor(r() * 14);
      px(ctx, ox + x, oy + y, '#c8d4e6', 4, 1);
      px(ctx, ox + x + 1, oy + y - 1, '#ffffff', 2, 1);
    }
  }

  function swampGround(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#5a6a3a', { flowers: 0 });
    const x = 2 + Math.floor(r() * 7), y = 3 + Math.floor(r() * 8);
    const w = 5 + Math.floor(r() * 4);
    px(ctx, ox + x, oy + y, '#3a4a3a', w, 3);
    px(ctx, ox + x + 1, oy + y, '#5a7a6a', w - 2, 1);
    px(ctx, ox + x + w - 2, oy + y - 2, '#4a7a3a', 1, 3);
  }

  // Rock face: boulders with lit tops and dark seams.
  function rockWall(ctx, ox, oy, r, base) {
    px(ctx, ox, oy, rgb(base, 0.5), T, T);
    for (let i = 0; i < 7; ++i) {
      const w = 4 + Math.floor(r() * 5), h = 3 + Math.floor(r() * 4);
      const x = Math.floor(r() * (T - w + 2)) - 1, y = Math.floor(r() * (T - h + 2)) - 1;
      const tone = 0.8 + r() * 0.35;
      px(ctx, ox + Math.max(0, x), oy + Math.max(0, y), rgb(base, tone), Math.min(w, T - Math.max(0, x)), Math.min(h, T - Math.max(0, y)));
      px(ctx, ox + Math.max(0, x), oy + Math.max(0, y), rgb(base, tone * 1.25), Math.min(w, T - Math.max(0, x)), 1);
    }
  }

  // Wooden planks running across, with seams and nail heads.
  function planks(ctx, ox, oy, r, base) {
    for (let row = 0; row < 4; ++row) {
      const tone = 0.88 + r() * 0.2;
      px(ctx, ox, oy + row * 4, rgb(base, tone), T, 4);
      px(ctx, ox, oy + row * 4, rgb(base, tone * 1.15), T, 1);
      px(ctx, ox, oy + row * 4 + 3, rgb(base, 0.55), T, 1);
      const seam = Math.floor(r() * 14) + 1;
      px(ctx, ox + seam, oy + row * 4, rgb(base, 0.55), 1, 3);
      px(ctx, ox + (seam + 3) % T, oy + row * 4 + 1, '#3a2a1a');
      for (let i = 0; i < 3; ++i)
        px(ctx, ox + Math.floor(r() * T), oy + row * 4 + 1 + Math.floor(r() * 2), rgb(base, 0.78), 2, 1);
    }
  }

  // Glassy black rock split by glowing seams.
  function obsidian(ctx, ox, oy, r) {
    for (let y = 0; y < T; y += 2)
      for (let x = 0; x < T; x += 2)
        px(ctx, ox + x, oy + y, rgb('#2a1a20', 0.85 + r() * 0.35), 2, 2);
    let x = Math.floor(r() * T), y = 0;
    while (y < T) {
      px(ctx, ox + x, oy + y, r() < 0.5 ? '#e8501a' : '#ff8a2a');
      if (r() < 0.4)
        x = Math.max(0, Math.min(T - 1, x + (r() < 0.5 ? -1 : 1)));
      else
        ++y;
    }
    px(ctx, ox + Math.floor(r() * 12), oy + Math.floor(r() * 12), '#6a4a5a', 2, 1);
  }

  function iceFloor(ctx, ox, oy, r) {
    for (let y = 0; y < T; ++y)
      for (let x = 0; x < T; x += 4)
        px(ctx, ox + x, oy + y, rgb('#a8d0ea', 0.94 + r() * 0.1), 4, 1);
    for (let i = 0; i < 2; ++i) {
      let x = Math.floor(r() * T), y = Math.floor(r() * 6);
      for (let k = 0; k < 8; ++k) {
        px(ctx, ox + x, oy + y, '#7aa8c8');
        x += r() < 0.5 ? 1 : 0;
        y += 1;
        if (x >= T || y >= T)
          break;
      }
    }
    px(ctx, ox + 3, oy + 3, '#ffffff', 3, 1);
    px(ctx, ox + 4, oy + 4, '#e8f6ff', 1, 1);
  }

  // Dense canopy seen from above: overlapping leaf clusters.
  function thicket(ctx, ox, oy, r) {
    px(ctx, ox, oy, '#1e3a1e', T, T);
    for (let i = 0; i < 6; ++i) {
      const cx = Math.floor(r() * T), cy = Math.floor(r() * T), rad = 3 + Math.floor(r() * 3);
      const tone = 0.75 + r() * 0.4;
      for (let y = -rad; y <= rad; ++y)
        for (let x = -rad; x <= rad; ++x)
          if (x * x + y * y <= rad * rad && cx + x >= 0 && cx + x < T && cy + y >= 0 && cy + y < T)
            px(ctx, ox + cx + x, oy + cy + y, rgb('#3f7a34', tone + (y < 0 ? 0.15 : 0)));
    }
  }

  // Layered cliff face.
  function cliff(ctx, ox, oy, r) {
    for (let y = 0; y < T; ++y)
      px(ctx, ox, oy + y, rgb('#7a7468', 0.7 + (y % 5) * 0.08 + r() * 0.06), T, 1);
    for (let i = 0; i < 5; ++i)
      px(ctx, ox + Math.floor(r() * 14), oy + Math.floor(r() * 16), '#4e4a42', 2 + Math.floor(r() * 3), 1);
    px(ctx, ox, oy, '#9a948a', T, 1);
  }

  // Dry golden grass with darker tufts.
  function savanna(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#c8b05a', { flowers: 0, dry: 1 });
    for (let i = 0; i < 3; ++i)
      px(ctx, ox + Math.floor(r() * 14), oy + Math.floor(r() * 14), '#8a7a3a', 2, 1);
  }

  // Blue glacier ice in blocks with deep cracks.
  function glacier(ctx, ox, oy, r) {
    iceFloor(ctx, ox, oy, r);
    px(ctx, ox, oy + 7 + Math.floor(r() * 3), '#5a88b0', T, 1);
    px(ctx, ox + 5 + Math.floor(r() * 6), oy, '#5a88b0', 1, 8);
    px(ctx, ox + 2, oy + 2, '#ffffff', 4, 1);
  }

  // Jungle undergrowth: dark loam under ferns.
  function jungleFloor(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#3f7a34', { flowers: 0.25 });
    for (let i = 0; i < 4; ++i) {
      const x = Math.floor(r() * 13), y = 3 + Math.floor(r() * 12);
      px(ctx, ox + x, oy + y, '#2a5a24', 3, 1);
      px(ctx, ox + x + 1, oy + y - 1, '#5aa848', 1, 1);
    }
  }

  // Red rock and cracked clay of the badlands.
  function badlands(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#b0663e');
    for (let i = 0; i < 2; ++i)
      px(ctx, ox + Math.floor(r() * 12), oy + Math.floor(r() * 15), '#7a3a22', 4, 1);
  }

  // Grey ash with cinders.
  function ash(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#5a5658');
    for (let i = 0; i < 3; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), r() < 0.5 ? '#ff7a2a' : '#2a2628');
  }

  // --- the planes -----------------------------------------------------------

  // Fine mottling over a flat base: the ground of most planar tiles.
  function mottle(ctx, ox, oy, r, base, spread = 0.12, step = 2) {
    for (let y = 0; y < T; y += step)
      for (let x = 0; x < T; x += step)
        px(ctx, ox + x, oy + y, rgb(base, 1 - spread / 2 + r() * spread), step, step);
  }

  function specks(ctx, ox, oy, r, colors, n) {
    for (let i = 0; i < n; ++i)
      px(ctx, ox + Math.floor(r() * T), oy + Math.floor(r() * T), colors[Math.floor(r() * colors.length)]);
  }

  // Silver-violet nothing with drifting motes and a faint current.
  function astral(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#3a3466', 0.16, 4);
    const y0 = Math.floor(r() * T);
    for (let x = 0; x < T; ++x)
      if ((x + y0) % 5)
        px(ctx, ox + x, oy + (y0 + (x >> 2)) % T, 'rgba(190,180,255,0.35)');
    specks(ctx, ox, oy, r, ['#ffffff', '#c8c0ff', '#8a80d8'], 4);
  }

  // Grey stone drifting in the silver void, lit along its upper rim.
  function driftRock(ctx, ox, oy, r) {
    astral(ctx, ox, oy, r);
    const cx = 8 + Math.floor(r() * 3) - 1, cy = 9;
    for (let y = -5; y <= 5; ++y)
      for (let x = -7; x <= 7; ++x)
        if ((x * x) / 49 + (y * y) / 25 <= 1 - r() * 0.15)
          px(ctx, ox + cx + x, oy + cy + y, rgb('#7a7890', y < -2 ? 1.25 : y > 2 ? 0.7 : 0.95 + r() * 0.1));
    px(ctx, ox + cx - 3, oy + cy - 4, '#c8c4e0', 4, 1);
  }

  // Pale fog, swirled lighter and darker.
  function mist(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#a8b4cc', 0.1, 2);
    for (let i = 0; i < 3; ++i) {
      const x = Math.floor(r() * 10), y = 2 + Math.floor(r() * 12), w = 4 + Math.floor(r() * 6);
      px(ctx, ox + x, oy + y, 'rgba(240,246,255,0.55)', w, 1);
      px(ctx, ox + x + 1, oy + y + 1, 'rgba(120,130,160,0.35)', w - 1, 1);
    }
  }

  // Colourless grass of the plane of shadow.
  function gloom(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#3c4440', { flowers: 0 });
    specks(ctx, ox, oy, r, ['#1e2220', '#5a6460'], 5);
  }

  // Scorched ground of the plane of fire: embers glow between the cinders.
  function cinder(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#4a2418');
    specks(ctx, ox, oy, r, ['#ff7a1a', '#ffb03a', '#ff5a10'], 9);
    const x = 2 + Math.floor(r() * 11), y = 3 + Math.floor(r() * 10);
    px(ctx, ox + x, oy + y, '#ffd24a', 1, 2);
    px(ctx, ox + x - 1, oy + y + 1, '#ff7a1a', 3, 1);
  }

  // Open water you can swim through: deep blue with lit wavelets.
  function current(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#1c4c8c', 0.14, 2);
    for (let i = 0; i < 4; ++i) {
      const x = Math.floor(r() * 12), y = 1 + Math.floor(r() * 14);
      px(ctx, ox + x, oy + y, '#3a7ac8', 4, 1);
      px(ctx, ox + x + 1, oy + y - 1, '#8ac8f0', 2, 1);
    }
  }

  function coral(ctx, ox, oy, r) {
    current(ctx, ox, oy, r);
    for (let i = 0; i < 3; ++i) {
      const x = 2 + Math.floor(r() * 11), y = 4 + Math.floor(r() * 10);
      const col = ['#e86a6a', '#f0a050', '#d870c0'][Math.floor(r() * 3)];
      px(ctx, ox + x, oy + y - 3, col, 1, 4);
      px(ctx, ox + x - 2, oy + y - 2, col, 1, 2);
      px(ctx, ox + x + 2, oy + y - 2, col, 1, 2);
      px(ctx, ox + x - 2, oy + y, col, 5, 1);
    }
  }

  // Packed earth of the deep places, with the odd buried gem.
  function bedrock(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#6a5440');
    if (r() < 0.45) {
      const x = 2 + Math.floor(r() * 11), y = 2 + Math.floor(r() * 11);
      const gem = ['#5ad0ff', '#ff5a8a', '#7aff8a', '#ffd24a'][Math.floor(r() * 4)];
      px(ctx, ox + x, oy + y, gem, 2, 2);
      px(ctx, ox + x, oy + y, '#ffffff');
    }
  }

  // Open sky: blue with streaks of wind and wisps of cloud.
  function sky(ctx, ox, oy, r) {
    for (let y = 0; y < T; ++y)
      px(ctx, ox, oy + y, rgb('#6aa8e8', 0.96 + (y % 8) * 0.01 + r() * 0.03), T, 1);
    for (let i = 0; i < 2; ++i) {
      const x = Math.floor(r() * 8), y = 2 + Math.floor(r() * 12), w = 5 + Math.floor(r() * 6);
      px(ctx, ox + x, oy + y, 'rgba(255,255,255,0.6)', w, 1);
      px(ctx, ox + x + 2, oy + y - 1, 'rgba(255,255,255,0.4)', w - 4, 1);
    }
  }

  // A bank of cloud thick enough to stand on.
  function cloudbank(ctx, ox, oy, r) {
    px(ctx, ox, oy, '#c8d4e6', T, T);
    for (let i = 0; i < 6; ++i) {
      const cx = Math.floor(r() * T), cy = Math.floor(r() * T), rad = 3 + Math.floor(r() * 3);
      for (let y = -rad; y <= rad; ++y)
        for (let x = -rad; x <= rad; ++x)
          if (x * x + y * y <= rad * rad && cx + x >= 0 && cx + x < T && cy + y >= 0 && cy + y < T)
            px(ctx, ox + cx + x, oy + cy + y, y < 0 ? '#ffffff' : '#e6ecf6');
    }
  }

  // The blinding brightness of the plane of positive energy.
  function radiance(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#fff0bc', 0.08, 2);
    specks(ctx, ox, oy, r, ['#ffffff', '#fff8e0'], 8);
    const x = 3 + Math.floor(r() * 10), y = 3 + Math.floor(r() * 10);
    px(ctx, ox + x - 2, oy + y, '#ffffff', 5, 1);
    px(ctx, ox + x, oy + y - 2, '#ffffff', 1, 5);
  }

  // The black of the plane of negative energy, with drifting grey motes.
  function darkness(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#120e1a', 0.4, 4);
    specks(ctx, ox, oy, r, ['#4a4458', '#2a2434', '#6a5a7a'], 6);
  }

  // Golden grass of the upper planes, starred with white flowers.
  function celestial(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#b8c85a', { flowers: 0.7 });
    specks(ctx, ox, oy, r, ['#fff8c8'], 2);
  }

  // Blue-green fey grass with glowing blooms.
  function fey(ctx, ox, oy, r) {
    grass(ctx, ox, oy, r, '#3aa88a', { flowers: 0 });
    for (let i = 0; i < 2; ++i) {
      const x = 2 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 12);
      const col = ['#ff8af0', '#b88aff', '#8affea'][Math.floor(r() * 3)];
      px(ctx, ox + x - 1, oy + y, col, 3, 1);
      px(ctx, ox + x, oy + y - 1, col, 1, 3);
      px(ctx, ox + x, oy + y, '#ffffff');
    }
  }

  // Red rock of the lower planes, crusted with sulphur.
  function brimstone(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#7a2c1c');
    specks(ctx, ox, oy, r, ['#e8c828', '#c8a018'], 5);
    px(ctx, ox + Math.floor(r() * 12), oy + Math.floor(r() * 15), '#4a140c', 4, 1);
  }

  // Purple-black rock of the Abyss with red veins.
  function abyssal(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#4a1a3a', 0.3, 2);
    let x = Math.floor(r() * T), y = 0;
    while (y < T) {
      px(ctx, ox + x, oy + y, r() < 0.6 ? '#c8203a' : '#ff5a4a');
      if (r() < 0.45)
        x = Math.max(0, Math.min(T - 1, x + (r() < 0.5 ? -1 : 1)));
      else
        ++y;
    }
    specks(ctx, ox, oy, r, ['#7a3a6a'], 3);
  }

  // Brass plates of the clockwork plane, a gear sunk into each.
  function gears(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#a8823a', 0.1, 4);
    px(ctx, ox, oy, '#6a4e1e', T, 1);
    px(ctx, ox, oy, '#6a4e1e', 1, T);
    const cx = 5 + Math.floor(r() * 6), cy = 5 + Math.floor(r() * 6);
    for (let a = 0; a < 16; ++a) {
      const rad = a % 2 ? 4 : 3;
      px(ctx, ox + cx + Math.round(Math.cos(a / 16 * 6.283) * rad), oy + cy + Math.round(Math.sin(a / 16 * 6.283) * rad), '#6a4e1e');
    }
    px(ctx, ox + cx - 1, oy + cy - 1, '#d8b060', 2, 2);
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]])
      px(ctx, ox + x, oy + y, '#e8c87a');
  }

  // Riveted iron, streaked with rust.
  function ironPlate(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#5a6068', 0.12, 4);
    px(ctx, ox, oy + 7, '#3a3e44', T, 1);
    px(ctx, ox + 7, oy, '#3a3e44', 1, T);
    for (const [x, y] of [[2, 2], [12, 2], [2, 11], [12, 11]])
      px(ctx, ox + x, oy + y, '#9aa0a8');
    px(ctx, ox + Math.floor(r() * 12), oy + Math.floor(r() * 12), '#8a4a22', 2, 3);
  }

  // Limbo: fire, water, earth and air churning side by side.
  // each patch of Limbo is one element for now, streaked with the next
  function chaos(ctx, ox, oy, r) {
    const bases = ['#8a4a3a', '#3a5a9a', '#6a5a48', '#7a8aa8', '#6a4a8a'];
    const i = Math.floor(r() * bases.length);
    mottle(ctx, ox, oy, r, bases[i], 0.2, 2);
    const streak = bases[(i + 1 + Math.floor(r() * 3)) % bases.length];
    let y = Math.floor(r() * T);
    for (let x = 0; x < T; ++x) {
      px(ctx, ox + x, oy + y, rgb(streak, 1.3), 1, 2);
      if (r() < 0.35)
        y = Math.max(0, Math.min(T - 2, y + (r() < 0.5 ? -1 : 1)));
    }
    specks(ctx, ox, oy, r, ['#e8d8ff'], 2);
  }

  function ooze(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#5a7a2a', 0.18, 2);
    for (let i = 0; i < 3; ++i) {
      const x = 1 + Math.floor(r() * 13), y = 1 + Math.floor(r() * 13);
      px(ctx, ox + x, oy + y, '#9ac84a', 2, 2);
      px(ctx, ox + x, oy + y, '#d8f08a');
    }
  }

  function smoke(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#5e5c62', 0.14, 2);
    for (let i = 0; i < 3; ++i) {
      const x = Math.floor(r() * 10), y = 1 + Math.floor(r() * 14);
      px(ctx, ox + x, oy + y, 'rgba(200,200,205,0.35)', 5, 1);
    }
  }

  // Dead grey dust of the gray waste.
  function greyWaste(ctx, ox, oy, r) {
    roughGround(ctx, ox, oy, r, '#7a7876');
    specks(ctx, ox, oy, r, ['#5a5856', '#9a9896'], 6);
  }

  // A chasm into nothing: black with distant stars.
  function rift(ctx, ox, oy, r) {
    mottle(ctx, ox, oy, r, '#07060e', 0.5, 4);
    specks(ctx, ox, oy, r, ['#ffffff', '#8a80d8', '#3a3466'], 3);
  }

  const PAINTERS = Object.freeze({
    astral:         (ctx, x, y, r) => astral(ctx, x, y, r),
    astral_rock:    (ctx, x, y, r) => driftRock(ctx, x, y, r),
    mist:           (ctx, x, y, r) => mist(ctx, x, y, r),
    gloom:          (ctx, x, y, r) => gloom(ctx, x, y, r),
    cinder:         (ctx, x, y, r) => cinder(ctx, x, y, r),
    current:        (ctx, x, y, r) => current(ctx, x, y, r),
    coral:          (ctx, x, y, r) => coral(ctx, x, y, r),
    bedrock:        (ctx, x, y, r) => bedrock(ctx, x, y, r),
    earth_wall:     (ctx, x, y, r) => rockWall(ctx, x, y, r, '#5a4636'),
    sky:            (ctx, x, y, r) => sky(ctx, x, y, r),
    cloudbank:      (ctx, x, y, r) => cloudbank(ctx, x, y, r),
    radiance:       (ctx, x, y, r) => radiance(ctx, x, y, r),
    darkness:       (ctx, x, y, r) => darkness(ctx, x, y, r),
    celestial:      (ctx, x, y, r) => celestial(ctx, x, y, r),
    fey:            (ctx, x, y, r) => fey(ctx, x, y, r),
    brimstone:      (ctx, x, y, r) => brimstone(ctx, x, y, r),
    abyssal:        (ctx, x, y, r) => abyssal(ctx, x, y, r),
    gears:          (ctx, x, y, r) => gears(ctx, x, y, r),
    iron_plate:     (ctx, x, y, r) => ironPlate(ctx, x, y, r),
    chaos:          (ctx, x, y, r) => chaos(ctx, x, y, r),
    ooze:           (ctx, x, y, r) => ooze(ctx, x, y, r),
    smoke:          (ctx, x, y, r) => smoke(ctx, x, y, r),
    grey_waste:     (ctx, x, y, r) => greyWaste(ctx, x, y, r),
    rift:           (ctx, x, y, r) => rift(ctx, x, y, r),
    marble:         (ctx, x, y, r) => flagstones(ctx, x, y, r, '#e8e2d4', '#a8a090'),
    silver_path:    (ctx, x, y, r) => flagstones(ctx, x, y, r, '#a8a4c8', '#4a4670'),
    hell_road:      (ctx, x, y, r) => flagstones(ctx, x, y, r, '#6a3026', '#2a0e0a'),
    savanna:       (ctx, x, y, r) => savanna(ctx, x, y, r),
    glacier:        (ctx, x, y, r) => glacier(ctx, x, y, r),
    jungle_floor:   (ctx, x, y, r) => jungleFloor(ctx, x, y, r),
    badlands:       (ctx, x, y, r) => badlands(ctx, x, y, r),
    ash:            (ctx, x, y, r) => ash(ctx, x, y, r),
    crypt_floor:    (ctx, x, y, r) => flagstones(ctx, x, y, r, '#8a8070', '#3a322c'),
    crypt_wall:     (ctx, x, y, r) => brickWall(ctx, x, y, r, '#4a4660'),
    cave_wall:      (ctx, x, y, r) => rockWall(ctx, x, y, r, '#4e4450'),
    wood_floor:     (ctx, x, y, r) => planks(ctx, x, y, r, '#8a6238'),
    fortress_wall:  (ctx, x, y, r) => brickWall(ctx, x, y, r, '#5a5a66'),
    infernal_floor: (ctx, x, y, r) => obsidian(ctx, x, y, r),
    infernal_wall:  (ctx, x, y, r) => brickWall(ctx, x, y, r, '#6a2a26'),
    ice_floor:      (ctx, x, y, r) => iceFloor(ctx, x, y, r),
    ice_wall:       (ctx, x, y, r) => brickWall(ctx, x, y, r, '#7ab0d4'),
    ruin_wall:      (ctx, x, y, r) => { brickWall(ctx, x, y, r, '#8a8474'); px(ctx, x + 2, y + 9, '#4f7a3a', 3, 2); px(ctx, x + 10, y + 1, '#6a9a4a', 2, 2); },
    thicket:        (ctx, x, y, r) => thicket(ctx, x, y, r),
    cliff:          (ctx, x, y, r) => cliff(ctx, x, y, r),
    plains:        (ctx, x, y, r) => grass(ctx, x, y, r, '#5f9e44'),
    // overworld grass: Kenney's grass colour so pond and shore tiles still blend
    meadow:        (ctx, x, y, r) => grass(ctx, x, y, r, '#8dc435', { flowers: 0.3 }),
    forest:        (ctx, x, y, r) => grass(ctx, x, y, r, '#4f8a3c', { flowers: 0.15 }),
    road:          (ctx, x, y, r) => dirtRoad(ctx, x, y, r),
    desert:        (ctx, x, y, r) => sand(ctx, x, y, r),
    snow:          (ctx, x, y, r) => snowField(ctx, x, y, r),
    swamp:         (ctx, x, y, r) => swampGround(ctx, x, y, r),
    mountain:      (ctx, x, y, r) => roughGround(ctx, x, y, r, '#7a7a72'),
    dungeon_floor: (ctx, x, y, r) => flagstones(ctx, x, y, r, '#7a6e72', '#3a3236'),
    cave:          (ctx, x, y, r) => roughGround(ctx, x, y, r, '#5a4a40'),
    ruins:         (ctx, x, y, r) => flagstones(ctx, x, y, r, '#8a8070', '#4a4438', { moss: 0.35 }),
    lava:          (ctx, x, y, r) => lavaTile(ctx, x, y, r),
    wall:          (ctx, x, y, r) => brickWall(ctx, x, y, r, '#6a6470'),
  });

  const IDS = Object.freeze(Object.keys(PAINTERS));

  // A flat colour per planar ground, for drawing without the sheet.
  const COLORS = Object.freeze({
    astral: '#3a3466', astral_rock: '#6a6880', mist: '#a8b4cc', gloom: '#3c4440', cinder: '#5a2a18',
    current: '#1c4c8c', coral: '#2a5a8a', bedrock: '#6a5440', earth_wall: '#4a3a2c', sky: '#6aa8e8',
    cloudbank: '#e0e8f2', radiance: '#fff0bc', darkness: '#120e1a', celestial: '#b8c85a', fey: '#3aa88a',
    brimstone: '#7a2c1c', abyssal: '#4a1a3a', gears: '#a8823a', iron_plate: '#5a6068', chaos: '#8a3ac8',
    ooze: '#5a7a2a', smoke: '#5e5c62', grey_waste: '#7a7876', rift: '#07060e',
  });

  let _sheet = null;

  function sheet() {
    if (_sheet || typeof document === 'undefined')
      return _sheet;
    const c = document.createElement('canvas');
    c.width = VARIANTS * T;
    c.height = IDS.length * T;
    const ctx = c.getContext('2d');
    if (!ctx)
      return null;
    IDS.forEach((id, row) => {
      for (let v = 0; v < VARIANTS; ++v)
        PAINTERS[id](ctx, v * T, row * T, rng((row + 1) * 7919 + v * 104729));
    });
    _sheet = c;
    return _sheet;
  }

  // Variant for a board cell: stable per position, varied between neighbours.
  function rect(id, col, row) {
    const r = IDS.indexOf(id);
    if (r < 0)
      return null;
    const h = Math.imul(col * 73856093 ^ row * 19349663, 0x9E3779B1) >>> 0;
    return { x: ((h >>> 7) % VARIANTS) * T, y: r * T, w: T, h: T, sheet: 'terrain' };
  }

  function has(id) {
    return IDS.includes(id);
  }

  TR.TerrainArt = Object.freeze({
    TILE: T, VARIANTS, IDS, has, rect, sheet,
    color: id => COLORS[id] || null,
    get: id => (id === 'terrain' ? sheet() : null),
  });
})();
