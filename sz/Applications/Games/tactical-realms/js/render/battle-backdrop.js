;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Pixel-art battle backdrops, drawn procedurally at low resolution
  // (LOW_W x LOW_H) and scaled up with nearest-neighbour so they match the
  // sprites. Three layers scroll with parallax: far (sky and horizon), mid
  // (trees, pillars, rocks) and ground (the platform the fighters stand on).
  // Ambient motes (embers, snow, fireflies, dust) are drawn live on top.

  const LOW_W = 360;         // wider than 320 so the camera can pan
  const LOW_H = 180;
  const HORIZON = 112;       // low-res y where the ground starts
  const PIXEL = 4;           // 1280 / 320

  const THEMES = Object.freeze({
    plains:   { sky: ['#6fb3e8', '#cfe8f4'], far: 'hills', farCol: '#7fa8a0', mid: 'trees', midCol: '#3f7a3a', ground: ['#6aa84a', '#4f8a3a'], detail: 'grass', ambient: 'pollen' },
    forest:   { sky: ['#5a9ad0', '#b8dcc8'], far: 'pines', farCol: '#4a7a6a', mid: 'pines', midCol: '#2a5a32', ground: ['#4f8a3a', '#3a6a2a'], detail: 'grass', ambient: 'fireflies' },
    mountain: { sky: ['#6a94c8', '#d8e4ee'], far: 'peaks', farCol: '#8a98b0', mid: 'rocks', midCol: '#6a6a72', ground: ['#8a8a86', '#6a6a66'], detail: 'pebbles', ambient: 'wind' },
    swamp:    { sky: ['#5a7a6a', '#a8b89a'], far: 'hills', farCol: '#56705a', mid: 'deadtrees', midCol: '#3a4a36', ground: ['#4a5a36', '#36462a'], detail: 'puddles', ambient: 'fireflies' },
    desert:   { sky: ['#e8a860', '#f8e0b0'], far: 'dunes', farCol: '#d8a868', mid: 'cacti', midCol: '#5a8a4a', ground: ['#e0c080', '#c8a468'], detail: 'ripples', ambient: 'dust' },
    snow:     { sky: ['#8aa4c8', '#e8eef6'], far: 'peaks', farCol: '#b8c8dc', mid: 'pines', midCol: '#4a6a6a', ground: ['#eef2f8', '#cdd8e6'], detail: 'drifts', ambient: 'snow' },
    lava:     { sky: ['#2a0a0a', '#8a2a0a'], far: 'peaks', farCol: '#3a1410', mid: 'rocks', midCol: '#2a1410', ground: ['#3a2420', '#241410'], detail: 'cracks', ambient: 'embers', glow: '#ff6a1a' },
    dungeon:  { sky: ['#140e18', '#2a2030'], far: 'wall', farCol: '#3a3440', mid: 'pillars', midCol: '#4a4450', ground: ['#5a3a34', '#3e2824'], detail: 'flagstones', ambient: 'dust', torches: true },
    cave:     { sky: ['#0e0c12', '#221c24'], far: 'cavewall', farCol: '#2a2428', mid: 'stalactites', midCol: '#3a3236', ground: ['#4a3a34', '#322622'], detail: 'pebbles', ambient: 'drips', torches: true },
    jungle:   { sky: ['#5aa8c8', '#c8e8c0'], far: 'hills', farCol: '#3a7a4a', mid: 'trees', midCol: '#2a6a2a', ground: ['#4a8a34', '#2f6a24'], detail: 'grass', ambient: 'fireflies' },
    taiga:    { sky: ['#7a94b8', '#e0e8f0'], far: 'peaks', farCol: '#9aacc4', mid: 'pines', midCol: '#2f5a46', ground: ['#e8eef6', '#c8d4e2'], detail: 'drifts', ambient: 'snow' },
    badlands: { sky: ['#d8884a', '#f4d0a0'], far: 'peaks', farCol: '#b0663e', mid: 'rocks', midCol: '#8a4a2a', ground: ['#c07a4a', '#9a5a34'], detail: 'pebbles', ambient: 'dust' },
    hills:    { sky: ['#6fb3e8', '#d8ecf6'], far: 'hills', farCol: '#7aa86a', mid: 'trees', midCol: '#4f8a3c', ground: ['#7ab854', '#5a9a40'], detail: 'grass', ambient: 'pollen' },
    savanna:  { sky: ['#e8b060', '#f8e8c0'], far: 'hills', farCol: '#c8a868', mid: 'cacti', midCol: '#6a8a34', ground: ['#d0b860', '#b09a48'], detail: 'grass', ambient: 'dust' },
    ash:      { sky: ['#3a3236', '#8a7a72'], far: 'peaks', farCol: '#4a4044', mid: 'rocks', midCol: '#3a3436', ground: ['#5a5658', '#3e3a3c'], detail: 'cracks', ambient: 'embers', glow: '#ff6a1a' },
    town:     { sky: ['#6fb3e8', '#d8ecf6'], far: 'hills', farCol: '#8ab098', mid: 'houses', midCol: '#e8d8b8', ground: ['#b8a88a', '#8a7a64'], detail: 'cobbles', ambient: 'pollen' },
    ruins:    { sky: ['#4a5a7a', '#a8a0a0'], far: 'hills', farCol: '#6a7068', mid: 'ruins', midCol: '#8a8478', ground: ['#7a6a58', '#5a4c3e'], detail: 'flagstones', ambient: 'dust' },
    // the other planes
    astral:    { sky: ['#1a1438', '#5a4a9a'], stars: true, far: 'islands', farCol: '#6a6890', mid: 'crystals', midCol: '#a89aff', ground: ['#4a4478', '#2a2650'], detail: 'pebbles', ambient: 'stars' },
    ethereal:  { sky: ['#8a98b8', '#d8e0f0'], far: 'hills', farCol: '#a0aac0', mid: 'deadtrees', midCol: '#7a8498', ground: ['#b8c0d4', '#9aa4bc'], detail: 'drifts', ambient: 'mist' },
    shadow:    { sky: ['#14161c', '#3a3e48'], noClouds: true, far: 'hills', farCol: '#2a2e36', mid: 'deadtrees', midCol: '#1e2228', ground: ['#3c4440', '#262c2a'], detail: 'grass', ambient: 'ash' },
    fire:      { sky: ['#4a0a00', '#ff7a1a'], far: 'peaks', farCol: '#5a1a0a', mid: 'spires', midCol: '#3a1008', ground: ['#5a2a18', '#3a180c'], detail: 'cracks', ambient: 'embers', glow: '#ff6a1a' },
    water:     { sky: ['#06204a', '#2a6ab0'], noClouds: true, far: 'coral', farCol: '#1a4a7a', mid: 'coral', midCol: '#d86a6a', ground: ['#2a5a8a', '#1a3a6a'], detail: 'ripples', ambient: 'bubbles' },
    earth:     { sky: ['#1a120c', '#3a2a1e'], far: 'cavewall', farCol: '#3a2a1e', mid: 'crystals', midCol: '#6ad8ff', ground: ['#6a5440', '#4a3a2a'], detail: 'pebbles', ambient: 'dust' },
    sky:       { sky: ['#3a7ad8', '#d8ecff'], far: 'clouds', farCol: '#ffffff', mid: 'clouds', midCol: '#e8f0fa', ground: ['#f0f4fa', '#c8d4e6'], detail: 'drifts', ambient: 'wind' },
    radiant:   { sky: ['#fff4c8', '#ffffff'], noClouds: true, far: 'clouds', farCol: '#fffaf0', mid: 'spires', midCol: '#fff0bc', ground: ['#fff0bc', '#f0d890'], detail: 'grass', ambient: 'sparkles' },
    void:      { sky: ['#000000', '#120e1a'], stars: true, far: 'islands', farCol: '#1e1828', mid: 'none', midCol: '#000000', ground: ['#1a1422', '#0a080e'], detail: 'pebbles', ambient: 'ash' },
    celestial: { sky: ['#7ab8f0', '#fff4d8'], far: 'peaks', farCol: '#e8e0f0', mid: 'trees', midCol: '#c8b84a', ground: ['#b8c85a', '#98a848'], detail: 'grass', ambient: 'sparkles' },
    fey:       { sky: ['#3a2a6a', '#c88ae8'], stars: true, far: 'hills', farCol: '#4a6a8a', mid: 'trees', midCol: '#2a8a7a', ground: ['#3aa88a', '#2a7a68'], detail: 'grass', ambient: 'fireflies' },
    infernal:  { sky: ['#2a0606', '#a83a1a'], far: 'peaks', farCol: '#3a0e08', mid: 'spires', midCol: '#2a0a06', ground: ['#7a2c1c', '#4a1810'], detail: 'cracks', ambient: 'embers', glow: '#ff4a1a' },
    abyss:     { sky: ['#1a0414', '#6a1a4a'], far: 'spires', farCol: '#2a0a20', mid: 'spires', midCol: '#3a0e2a', ground: ['#4a1a3a', '#2a0e22'], detail: 'cracks', ambient: 'embers', glow: '#c8203a' },
    clockwork: { sky: ['#3a2e1a', '#c8a860'], noClouds: true, far: 'gears', farCol: '#7a5a2a', mid: 'gears', midCol: '#a8823a', ground: ['#a8823a', '#7a5a28'], detail: 'cobbles', ambient: 'dust' },
    chaos:     { sky: ['#4a1a6a', '#3a8ac8'], far: 'islands', farCol: '#8a3ac8', mid: 'crystals', midCol: '#ff8a3a', ground: ['#6a5038', '#2a5ab8'], detail: 'cobbles', ambient: 'sparkles' },
    ooze:      { sky: ['#2a3a14', '#7a9a3a'], noClouds: true, far: 'hills', farCol: '#4a5a24', mid: 'deadtrees', midCol: '#3a4a1a', ground: ['#5a7a2a', '#3a5a1a'], detail: 'puddles', ambient: 'drips' },
    grey:      { sky: ['#4a4a4a', '#9a9a9a'], noClouds: true, far: 'hills', farCol: '#6a6a6a', mid: 'deadtrees', midCol: '#5a5a5a', ground: ['#7a7876', '#5a5856'], detail: 'pebbles', ambient: 'ash' },
  });

  // Planes recolour whatever biome they contain, keyed by data/planes.js
  // ids; the Material Plane keeps its own colours.
  const PLANE_TINTS = Object.freeze({
    astral:          { sky: 'rgba(150,130,230,0.45)', world: 'rgba(120,110,200,0.25)', ambient: 'stars' },
    ethereal:        { sky: 'rgba(200,220,255,0.50)', world: 'rgba(170,190,230,0.35)', ambient: 'mist' },
    shadow:          { sky: 'rgba(40,40,60,0.55)', world: 'rgba(30,30,50,0.40)', ambient: 'ash' },
    elemental_fire:  { sky: 'rgba(255,90,0,0.50)', world: 'rgba(200,60,0,0.30)', ambient: 'embers' },
    elemental_water: { sky: 'rgba(20,80,170,0.55)', world: 'rgba(20,70,160,0.40)', ambient: 'bubbles' },
    elemental_earth: { sky: 'rgba(70,50,30,0.60)', world: 'rgba(80,60,40,0.30)', ambient: 'dust' },
    elemental_air:   { sky: 'rgba(150,200,255,0.40)', world: 'rgba(200,230,255,0.25)', ambient: 'wind' },
    para_ice:        { sky: 'rgba(180,220,255,0.45)', world: 'rgba(170,210,255,0.30)', ambient: 'snow' },
    para_magma:      { sky: 'rgba(255,60,0,0.50)', world: 'rgba(180,40,0,0.35)', ambient: 'embers' },
    para_ooze:       { sky: 'rgba(90,120,40,0.50)', world: 'rgba(80,110,30,0.35)', ambient: 'drips' },
    para_smoke:      { sky: 'rgba(90,90,90,0.55)', world: 'rgba(70,70,70,0.35)', ambient: 'ash' },
    positive_energy: { sky: 'rgba(255,250,210,0.55)', world: 'rgba(255,245,200,0.35)', ambient: 'sparkles' },
    negative_energy: { sky: 'rgba(10,0,20,0.70)', world: 'rgba(20,10,30,0.50)', ambient: 'ash' },
    mount_celestia:  { sky: 'rgba(255,230,150,0.30)', world: 'rgba(255,240,200,0.15)', ambient: 'sparkles' },
    bytopia:         { sky: 'rgba(200,220,160,0.20)', world: 'rgba(220,200,140,0.10)', ambient: 'pollen' },
    elysium:         { sky: 'rgba(255,220,180,0.30)', world: 'rgba(255,230,190,0.15)', ambient: 'pollen' },
    beastlands:      { sky: 'rgba(120,200,100,0.25)', world: 'rgba(60,140,60,0.15)', ambient: 'fireflies' },
    arborea:         { sky: 'rgba(255,120,220,0.30)', world: 'rgba(200,120,255,0.12)', ambient: 'sparkles' },
    ysgard:          { sky: 'rgba(140,170,255,0.25)', world: 'rgba(150,140,120,0.12)', ambient: 'wind' },
    limbo:           { sky: 'rgba(160,60,200,0.40)', world: 'rgba(120,80,160,0.25)', ambient: 'sparkles' },
    pandemonium:     { sky: 'rgba(20,20,40,0.60)', world: 'rgba(40,30,60,0.35)', ambient: 'wind' },
    abyss:           { sky: 'rgba(120,0,140,0.45)', world: 'rgba(80,0,90,0.25)', ambient: 'embers' },
    carceri:         { sky: 'rgba(110,20,20,0.50)', world: 'rgba(80,20,10,0.30)', ambient: 'ash' },
    gray_waste:      { sky: 'rgba(110,110,110,0.60)', world: 'rgba(90,90,90,0.50)', ambient: 'ash' },
    gehenna:         { sky: 'rgba(160,60,20,0.45)', world: 'rgba(120,40,10,0.30)', ambient: 'embers' },
    nine_hells:      { sky: 'rgba(200,30,0,0.45)', world: 'rgba(120,20,0,0.25)', ambient: 'embers' },
    acheron:         { sky: 'rgba(90,100,120,0.45)', world: 'rgba(80,90,110,0.30)', ambient: 'dust' },
    mechanus:        { sky: 'rgba(200,170,90,0.35)', world: 'rgba(180,150,80,0.20)', ambient: 'dust' },
    arcadia:         { sky: 'rgba(200,230,180,0.20)', world: 'rgba(180,220,160,0.10)', ambient: 'pollen' },
    outlands:        { sky: 'rgba(170,150,120,0.20)', world: 'rgba(150,130,100,0.12)', ambient: 'dust' },
  });

  function themeFor(biome) {
    return THEMES[biome] || THEMES.plains;
  }

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

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; ++i)
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  function canvas(w, h) {
    if (typeof document === 'undefined')
      return null;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // --- layer painters (low-res pixel coordinates) --------------------------

  function paintSky(ctx, th, r) {
    // banded gradient reads as pixel art better than a smooth one
    const bands = 14;
    const [top, bot] = th.sky;
    for (let i = 0; i < bands; ++i) {
      const t = i / (bands - 1);
      ctx.fillStyle = mix(top, bot, t);
      ctx.fillRect(0, Math.floor(i * HORIZON / bands), LOW_W, Math.ceil(HORIZON / bands) + 1);
    }
    if (th.stars)
      for (let i = 0; i < 70; ++i) {
        ctx.fillStyle = r() > 0.7 ? '#ffffff' : 'rgba(200,190,255,0.7)';
        ctx.fillRect(Math.floor(r() * LOW_W), Math.floor(r() * (HORIZON - 10)), 1, 1);
      }
    if (th.far !== 'wall' && th.far !== 'cavewall' && !th.glow && !th.noClouds && !th.stars) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 5; ++i) {
        const cx = r() * LOW_W, cy = 10 + r() * 40, w = 18 + r() * 30;
        ctx.fillRect(cx, cy, w, 3);
        ctx.fillRect(cx + 4, cy - 2, w - 10, 2);
        ctx.fillRect(cx + 8, cy - 4, w * 0.4, 2);
      }
    }
    if (th.glow) {
      const g = ctx.createLinearGradient(0, HORIZON - 40, 0, HORIZON);
      g.addColorStop(0, 'rgba(255,90,20,0)');
      g.addColorStop(1, 'rgba(255,120,30,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, HORIZON - 40, LOW_W, 40);
    }
  }

  function ridge(ctx, r, baseY, amp, rough, color, step = 4) {
    ctx.fillStyle = color;
    let y = baseY - r() * amp;
    for (let x = 0; x < LOW_W; x += step) {
      y += (r() - 0.5) * rough;
      y = Math.max(baseY - amp, Math.min(baseY, y));
      ctx.fillRect(x, Math.floor(y), step, HORIZON - Math.floor(y) + 1);
    }
  }

  function paintFar(ctx, th, r) {
    const c = th.farCol;
    switch (th.far) {
      case 'hills':
        ridge(ctx, r, HORIZON - 8, 26, 5, shade(c, 1.1));
        ridge(ctx, r, HORIZON, 16, 4, c);
        break;
      case 'peaks': {
        for (let i = 0; i < 7; ++i) {
          const px = r() * LOW_W, ph = 40 + r() * 45, pw = 40 + r() * 50;
          ctx.fillStyle = shade(c, 0.9 + r() * 0.2);
          for (let y = 0; y < ph; ++y) {
            const w = pw * (y / ph);
            ctx.fillRect(Math.floor(px - w / 2), HORIZON - ph + y, Math.ceil(w), 1);
          }
          ctx.fillStyle = th.glow ? '#ff7a2a' : '#f4f8fc';
          for (let y = 0; y < ph * 0.22; ++y) {
            const w = pw * (y / ph);
            ctx.fillRect(Math.floor(px - w / 2), HORIZON - ph + y, Math.ceil(w), 1);
          }
        }
        break;
      }
      case 'pines':
        for (let i = 0; i < 60; ++i)
          pine(ctx, r() * LOW_W, HORIZON + 2, 14 + r() * 16, shade(c, 0.85 + r() * 0.3));
        break;
      case 'dunes':
        ridge(ctx, r, HORIZON - 4, 18, 2, shade(c, 1.05), 2);
        break;
      case 'islands':
        // rocks adrift in the void, flat on top, tapering beneath
        for (let i = 0; i < 9; ++i) {
          const x = r() * LOW_W, y = 14 + r() * (HORIZON - 40), w = 10 + r() * 34, h = 6 + r() * 16;
          for (let k = 0; k < h; ++k) {
            ctx.fillStyle = shade(c, k < 2 ? 1.35 : 1 - k / h * 0.4);
            const ww = w * (1 - k / h);
            ctx.fillRect(Math.floor(x - ww / 2), Math.floor(y + k), Math.ceil(ww), 1);
          }
        }
        break;
      case 'clouds':
        for (let i = 0; i < 14; ++i)
          blob(ctx, r() * LOW_W, HORIZON - 4 - r() * 50, 10 + r() * 22, shade(c, 0.9 + r() * 0.12));
        break;
      case 'coral':
        for (let i = 0; i < 16; ++i)
          coralFan(ctx, r() * LOW_W, HORIZON + 2, 18 + r() * 30, shade(c, 0.8 + r() * 0.4), r);
        break;
      case 'spires':
        for (let i = 0; i < 12; ++i)
          spire(ctx, r() * LOW_W, HORIZON + 2, 30 + r() * 60, 6 + r() * 10, shade(c, 0.85 + r() * 0.3));
        break;
      case 'gears':
        for (let i = 0; i < 7; ++i)
          gear(ctx, r() * LOW_W, 20 + r() * (HORIZON - 30), 10 + r() * 24, shade(c, 0.85 + r() * 0.3));
        break;
      case 'wall':
      case 'cavewall': {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, LOW_W, HORIZON);
        if (th.far === 'wall') {
          for (let y = 0; y < HORIZON; y += 8)
            for (let x = (y / 8) % 2 ? -6 : 0; x < LOW_W; x += 12) {
              ctx.fillStyle = shade(c, 0.85 + r() * 0.3);
              ctx.fillRect(x + 1, y + 1, 10, 6);
            }
        } else {
          for (let i = 0; i < 140; ++i) {
            ctx.fillStyle = shade(c, 0.7 + r() * 0.6);
            ctx.fillRect(r() * LOW_W, r() * HORIZON, 2 + r() * 8, 2 + r() * 5);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  function blob(ctx, cx, cy, rad, color) {
    ctx.fillStyle = color;
    for (let y = -rad; y <= rad * 0.6; ++y) {
      const w = Math.sqrt(Math.max(0, rad * rad - y * y)) * 2;
      ctx.fillRect(Math.floor(cx - w / 2), Math.floor(cy + y), Math.ceil(w), 1);
    }
  }

  function spire(ctx, x, baseY, h, w, color) {
    ctx.fillStyle = color;
    for (let y = 0; y < h; ++y) {
      const ww = Math.max(1, w * (y / h));
      ctx.fillRect(Math.floor(x - ww / 2), Math.floor(baseY - h + y), Math.ceil(ww), 1);
    }
    ctx.fillStyle = shade(color.startsWith('#') ? color : '#3a1008', 1.4);
    ctx.fillRect(Math.floor(x), Math.floor(baseY - h * 0.6), 1, Math.floor(h * 0.3));
  }

  function coralFan(ctx, x, baseY, h, color, r) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), baseY - h, 2, h);
    for (let k = 0; k < 4; ++k) {
      const by = baseY - h * (0.3 + r() * 0.6), bw = 4 + r() * 8, dir = r() > 0.5 ? 1 : -1;
      ctx.fillRect(Math.floor(dir > 0 ? x : x - bw), Math.floor(by), Math.ceil(bw), 2);
      ctx.fillRect(Math.floor(x + dir * bw), Math.floor(by - 6), 2, 6);
    }
  }

  function gear(ctx, cx, cy, rad, color) {
    ctx.fillStyle = color;
    for (let y = -rad - 3; y <= rad + 3; ++y)
      for (let x = -rad - 3; x <= rad + 3; ++x) {
        const d = Math.sqrt(x * x + y * y);
        const tooth = Math.floor((Math.atan2(y, x) + Math.PI) / (Math.PI / 6)) % 2 === 0;
        if ((d <= rad && d > rad * 0.35) || (tooth && d > rad && d <= rad + 3))
          ctx.fillRect(Math.floor(cx + x), Math.floor(cy + y), 1, 1);
      }
  }

  function pine(ctx, x, baseY, h, color) {
    ctx.fillStyle = shade('#4a3020', 1);
    ctx.fillRect(Math.floor(x), baseY - 3, 2, 3);
    ctx.fillStyle = color;
    for (let y = 0; y < h; ++y) {
      const w = Math.max(1, (y / h) * h * 0.55 + (y % 4 === 3 ? 1 : 0));
      ctx.fillRect(Math.floor(x + 1 - w / 2), baseY - 3 - h + y, Math.ceil(w), 1);
    }
  }

  function roundTree(ctx, x, baseY, h, color) {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(Math.floor(x) - 1, baseY - h * 0.45, 3, h * 0.45);
    ctx.fillStyle = color;
    const r = h * 0.38;
    for (let y = -r; y <= r; ++y) {
      const w = Math.sqrt(r * r - y * y) * 2;
      ctx.fillRect(Math.floor(x - w / 2), Math.floor(baseY - h * 0.62 + y), Math.ceil(w), 1);
    }
    ctx.fillStyle = shade(color.startsWith('#') ? color : '#3f7a3a', 1.25);
    ctx.fillRect(Math.floor(x - r * 0.5), Math.floor(baseY - h * 0.62 - r * 0.6), Math.ceil(r * 0.6), 2);
  }

  function paintMid(ctx, th, r) {
    const c = th.midCol;
    switch (th.mid) {
      case 'trees':
        for (let i = 0; i < 9; ++i)
          roundTree(ctx, r() * LOW_W, HORIZON + 4, 26 + r() * 22, shade(c, 0.85 + r() * 0.3));
        break;
      case 'pines':
        for (let i = 0; i < 14; ++i)
          pine(ctx, r() * LOW_W, HORIZON + 6, 34 + r() * 30, shade(c, 0.8 + r() * 0.35));
        break;
      case 'deadtrees':
        for (let i = 0; i < 7; ++i) {
          const x = Math.floor(r() * LOW_W), h = 30 + r() * 30;
          ctx.fillStyle = shade(c, 0.8 + r() * 0.3);
          ctx.fillRect(x, HORIZON + 4 - h, 3, h);
          ctx.fillRect(x - 8, HORIZON + 4 - h * 0.7, 9, 2);
          ctx.fillRect(x + 3, HORIZON + 4 - h * 0.55, 8, 2);
          ctx.fillRect(x - 5, HORIZON + 4 - h * 0.85, 2, 6);
        }
        break;
      case 'rocks':
        for (let i = 0; i < 10; ++i) {
          const x = r() * LOW_W, w = 10 + r() * 26, h = 6 + r() * 16;
          ctx.fillStyle = shade(c, 0.8 + r() * 0.3);
          for (let y = 0; y < h; ++y) {
            const ww = w * (0.55 + 0.45 * (y / h));
            ctx.fillRect(Math.floor(x - ww / 2), Math.floor(HORIZON + 4 - h + y), Math.ceil(ww), 1);
          }
          ctx.fillStyle = shade(c, 1.3);
          ctx.fillRect(Math.floor(x - w * 0.2), Math.floor(HORIZON + 4 - h), Math.ceil(w * 0.25), 1);
        }
        break;
      case 'cacti':
        for (let i = 0; i < 6; ++i) {
          const x = Math.floor(r() * LOW_W), h = 12 + r() * 16;
          ctx.fillStyle = c;
          ctx.fillRect(x, HORIZON + 4 - h, 4, h);
          ctx.fillRect(x - 4, HORIZON + 4 - h * 0.7, 4, 2);
          ctx.fillRect(x - 4, HORIZON + 4 - h * 0.9, 2, 6);
          ctx.fillRect(x + 4, HORIZON + 4 - h * 0.55, 4, 2);
          ctx.fillRect(x + 6, HORIZON + 4 - h * 0.75, 2, 6);
        }
        break;
      case 'pillars':
        for (let x = 20; x < LOW_W; x += 70) {
          ctx.fillStyle = shade(c, 0.95);
          ctx.fillRect(x, 8, 16, HORIZON - 4);
          ctx.fillStyle = shade(c, 1.2);
          ctx.fillRect(x, 8, 3, HORIZON - 4);
          ctx.fillStyle = shade(c, 0.7);
          ctx.fillRect(x + 13, 8, 3, HORIZON - 4);
          ctx.fillStyle = shade(c, 1.1);
          ctx.fillRect(x - 3, 4, 22, 5);
          ctx.fillRect(x - 3, HORIZON - 1, 22, 5);
        }
        break;
      case 'crystals':
        for (let i = 0; i < 12; ++i) {
          const x = r() * LOW_W, h = 10 + r() * 30, w = 4 + r() * 6;
          ctx.fillStyle = shade(c, 0.75 + r() * 0.5);
          for (let y = 0; y < h; ++y) {
            const ww = y < h * 0.3 ? w * (y / (h * 0.3)) : w;
            ctx.fillRect(Math.floor(x - ww / 2), Math.floor(HORIZON + 4 - h + y), Math.ceil(ww), 1);
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.floor(x - 1), Math.floor(HORIZON + 4 - h * 0.8), 1, Math.ceil(h * 0.4));
        }
        break;
      case 'spires':
        for (let i = 0; i < 8; ++i)
          spire(ctx, r() * LOW_W, HORIZON + 6, 26 + r() * 40, 8 + r() * 8, shade(c, 0.8 + r() * 0.4));
        break;
      case 'coral':
        for (let i = 0; i < 10; ++i)
          coralFan(ctx, r() * LOW_W, HORIZON + 6, 14 + r() * 24, shade(c, 0.8 + r() * 0.4), r);
        break;
      case 'clouds':
        for (let i = 0; i < 8; ++i)
          blob(ctx, r() * LOW_W, HORIZON + 2 - r() * 16, 8 + r() * 14, shade(c, 0.92 + r() * 0.08));
        break;
      case 'gears':
        for (let i = 0; i < 5; ++i)
          gear(ctx, r() * LOW_W, HORIZON - 10 - r() * 30, 8 + r() * 14, shade(c, 0.85 + r() * 0.3));
        break;
      case 'stalactites':
        for (let i = 0; i < 26; ++i) {
          const x = r() * LOW_W, h = 8 + r() * 34, w = 4 + r() * 8;
          ctx.fillStyle = shade(c, 0.8 + r() * 0.4);
          for (let y = 0; y < h; ++y) {
            const ww = w * (1 - y / h);
            ctx.fillRect(Math.floor(x - ww / 2), y, Math.ceil(ww), 1);
          }
        }
        for (let i = 0; i < 8; ++i) {
          const x = r() * LOW_W, h = 6 + r() * 18, w = 5 + r() * 8;
          ctx.fillStyle = shade(c, 0.9 + r() * 0.3);
          for (let y = 0; y < h; ++y) {
            const ww = w * (y / h);
            ctx.fillRect(Math.floor(x - ww / 2), HORIZON + 4 - h + y, Math.ceil(ww), 1);
          }
        }
        break;
      case 'houses': {
        const roofs = ['#b84a32', '#8a4a2a', '#3a5a8a', '#6a3a3a', '#4a6a3a'];
        let x = -10;
        while (x < LOW_W) {
          const w = 34 + Math.floor(r() * 22), h = 30 + Math.floor(r() * 26);
          const base = HORIZON + 6;
          const wall = shade(c, 0.85 + r() * 0.25);
          const roof = roofs[Math.floor(r() * roofs.length)];
          // timber-framed wall
          ctx.fillStyle = wall;
          ctx.fillRect(x, base - h, w, h);
          ctx.fillStyle = '#5a3a24';
          ctx.fillRect(x, base - h, w, 2);
          ctx.fillRect(x, base - h, 2, h);
          ctx.fillRect(x + w - 2, base - h, 2, h);
          ctx.fillRect(x, base - Math.floor(h / 2), w, 2);
          // gabled roof
          const rh = 12 + Math.floor(r() * 10);
          ctx.fillStyle = roof;
          for (let y = 0; y < rh; ++y) {
            const ww = w + 6 - (y / rh) * (w + 6);
            ctx.fillRect(Math.floor(x + (w - ww) / 2), base - h - y, Math.ceil(ww), 1);
          }
          ctx.fillStyle = shade(roof, 1.25);
          ctx.fillRect(x - 3, base - h, w + 6, 2);
          // chimney
          if (r() > 0.5) {
            ctx.fillStyle = '#6a5a52';
            ctx.fillRect(x + Math.floor(w * 0.7), base - h - rh + 2, 4, 8);
          }
          // windows and door
          ctx.fillStyle = '#ffd87a';
          for (let wx = x + 5; wx < x + w - 8; wx += 11) {
            ctx.fillRect(wx, base - h + 6, 5, 6);
            if (r() > 0.4)
              ctx.fillRect(wx, base - Math.floor(h / 2) + 5, 5, 6);
          }
          ctx.fillStyle = '#4a2c18';
          ctx.fillRect(x + Math.floor(w / 2) - 3, base - 11, 7, 11);
          x += w + 6 + Math.floor(r() * 10);
        }
        break;
      }
      case 'ruins':
        for (let i = 0; i < 6; ++i) {
          const x = Math.floor(r() * LOW_W), h = 16 + r() * 40;
          ctx.fillStyle = shade(c, 0.85 + r() * 0.3);
          ctx.fillRect(x, HORIZON + 4 - h, 12, h);
          ctx.fillStyle = shade(c, 1.2);
          ctx.fillRect(x, HORIZON + 4 - h, 3, h);
          ctx.fillStyle = shade(c, 0.7);
          ctx.fillRect(x + 4, HORIZON + 4 - h, 8, 3);
          if (r() > 0.5) {
            ctx.fillStyle = shade(c, 0.9);
            ctx.fillRect(x + 12, HORIZON + 4 - h + 4, 18, 5);
          }
        }
        break;
      default:
        break;
    }
  }

  function paintGround(ctx, th, r) {
    const [a, b] = th.ground;
    // perspective bands: darker toward the horizon
    for (let y = HORIZON; y < LOW_H; ++y) {
      const t = (y - HORIZON) / (LOW_H - HORIZON);
      ctx.fillStyle = mix(b, a, Math.min(1, t * 1.6));
      ctx.fillRect(0, y, LOW_W, 1);
    }
    ctx.fillStyle = shade(b, 0.8);
    ctx.fillRect(0, HORIZON, LOW_W, 1);
    const n = 260;
    for (let i = 0; i < n; ++i) {
      const y = HORIZON + 2 + Math.pow(r(), 0.8) * (LOW_H - HORIZON - 2);
      const x = r() * LOW_W;
      const near = (y - HORIZON) / (LOW_H - HORIZON);
      switch (th.detail) {
        case 'grass':
          ctx.fillStyle = shade(a, r() > 0.5 ? 1.2 : 0.8);
          ctx.fillRect(x, y, 1, 1 + near * 3);
          if (r() > 0.97) {
            ctx.fillStyle = r() > 0.5 ? '#f4e05a' : '#f4f4f4';
            ctx.fillRect(x, y - 1, 2, 2);
          }
          break;
        case 'pebbles':
        case 'cracks':
          ctx.fillStyle = shade(a, 0.7 + r() * 0.6);
          ctx.fillRect(x, y, 1 + near * 3, 1 + near);
          if (th.detail === 'cracks' && r() > 0.9) {
            ctx.fillStyle = '#ff7a2a';
            ctx.fillRect(x, y, 3 + near * 8, 1);
          }
          break;
        case 'flagstones':
          if (i % 3 === 0) {
            ctx.fillStyle = shade(b, 0.7);
            ctx.fillRect(x, y, 6 + near * 16, 1);
          }
          break;
        case 'puddles':
          if (r() > 0.9) {
            ctx.fillStyle = 'rgba(120,150,140,0.5)';
            ctx.fillRect(x, y, 6 + near * 18, 1 + near * 2);
          }
          break;
        case 'cobbles':
          ctx.fillStyle = shade(r() > 0.5 ? a : b, 0.8 + r() * 0.3);
          ctx.fillRect(x, y, 2 + near * 6, 1 + near * 2);
          break;
        case 'ripples':
          ctx.fillStyle = shade(a, 1.08);
          ctx.fillRect(x, y, 4 + near * 10, 1);
          break;
        case 'drifts':
          ctx.fillStyle = r() > 0.5 ? '#ffffff' : shade(b, 0.9);
          ctx.fillRect(x, y, 3 + near * 8, 1);
          break;
        default:
          break;
      }
    }
    // the stage: a slightly lighter oval where the fighters stand
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = 0; y < 26; ++y) {
      const w = Math.sqrt(1 - Math.pow((y - 13) / 13, 2)) * LOW_W * 0.42;
      ctx.fillRect(Math.floor(LOW_W / 2 - w), HORIZON + 30 + y, Math.ceil(w * 2), 1);
    }
  }

  function mix(h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const ch = s => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // --- cache ------------------------------------------------------------------

  const _cache = new Map();

  function layers(biome, plane) {
    const key = `${biome || 'plains'}|${plane || 'material'}`;
    let entry = _cache.get(key);
    if (entry)
      return entry;
    const th = themeFor(biome);
    const tint = PLANE_TINTS[plane] || null;
    const far = canvas(LOW_W, LOW_H), mid = canvas(LOW_W, LOW_H), ground = canvas(LOW_W, LOW_H);
    if (!far)
      return null;
    const r = rng(hashStr(key));
    const fctx = far.getContext('2d'), mctx = mid.getContext('2d'), gctx = ground.getContext('2d');
    if (!fctx || !mctx || !gctx)
      return null;
    paintSky(fctx, th, r);
    paintFar(fctx, th, r);
    paintMid(mctx, th, r);
    paintGround(gctx, th, r);
    if (tint) {
      for (const [c, col] of [[fctx, tint.sky], [mctx, tint.world], [gctx, tint.world]]) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = col;
        c.fillRect(0, 0, LOW_W, LOW_H);
        c.globalCompositeOperation = 'source-over';
      }
    }
    entry = { far, mid, ground, theme: th, tint, ambient: (tint && tint.ambient) || th.ambient, key };
    _cache.set(key, entry);
    return entry;
  }

  // --- drawing ------------------------------------------------------------------

  // camX: camera pan in screen pixels (+ moves the view right).
  function draw(ctx, biome, plane, camX, time, w, h) {
    const L = layers(biome, plane);
    if (!L) {
      ctx.fillStyle = '#10101a';
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const scale = h / LOW_H;
    const baseX = -(LOW_W * scale - w) / 2;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(L.far, Math.round(baseX - camX * 0.25), 0, LOW_W * scale, LOW_H * scale);
    ctx.drawImage(L.mid, Math.round(baseX - camX * 0.55), 0, LOW_W * scale, LOW_H * scale);
    ctx.drawImage(L.ground, Math.round(baseX - camX), 0, LOW_W * scale, LOW_H * scale);
    if (L.theme.torches)
      drawTorches(ctx, baseX - camX * 0.55, scale, time);
    ctx.restore();
  }

  function drawTorches(ctx, ox, scale, time) {
    for (let x = 58; x < LOW_W; x += 140) {
      const sx = ox + x * scale, sy = 56 * scale;
      const flick = 0.75 + 0.25 * Math.sin(time * 13 + x) * Math.sin(time * 7.3 + x * 0.3);
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 90 * flick);
      g.addColorStop(0, 'rgba(255,190,90,0.45)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - 100, sy - 100, 200, 200);
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(sx - scale, sy, scale * 2, scale * 7);
      ctx.fillStyle = '#ffb040';
      ctx.fillRect(sx - scale * 1.5, sy - scale * 3 * flick, scale * 3, scale * 3 * flick);
      ctx.fillStyle = '#fff2b0';
      ctx.fillRect(sx - scale * 0.5, sy - scale * 2 * flick, scale, scale * 2 * flick);
    }
  }

  // Deterministic ambient motes: position is a pure function of time.
  function drawAmbient(ctx, kind, time, w, h) {
    if (!kind)
      return;
    const s = h / LOW_H;
    const px = Math.max(2, Math.round(s * 0.75));
    ctx.save();
    for (let i = 0; i < 46; ++i) {
      const seed = i * 97.13;
      const fx = (seed * 13.7) % 1;
      const fy = (seed * 7.31) % 1;
      let x, y, col, size = px;
      switch (kind) {
        case 'embers':
          x = ((fx * w + Math.sin(time * 1.3 + i) * 30) % w + w) % w;
          y = h - ((fy * h + time * (40 + (i % 7) * 12)) % h);
          col = i % 3 ? 'rgba(255,140,40,0.85)' : 'rgba(255,220,120,0.9)';
          break;
        case 'snow':
          x = ((fx * w + time * 25 + Math.sin(time + i) * 20) % w + w) % w;
          y = (fy * h + time * (30 + (i % 5) * 10)) % h;
          col = 'rgba(255,255,255,0.9)';
          break;
        case 'fireflies':
        case 'spores':
        case 'sparkles':
          if (i > 24)
            continue;
          x = fx * w + Math.sin(time * 0.7 + i * 2.1) * 40;
          y = h * 0.35 + fy * h * 0.45 + Math.cos(time * 0.9 + i) * 20;
          col = kind === 'fireflies' ? `rgba(220,255,120,${(0.4 + 0.6 * Math.abs(Math.sin(time * 2 + i))).toFixed(2)})`
            : kind === 'spores' ? `rgba(150,110,255,${(0.3 + 0.5 * Math.abs(Math.sin(time * 1.5 + i))).toFixed(2)})`
            : `rgba(255,200,255,${(0.3 + 0.7 * Math.abs(Math.sin(time * 3 + i))).toFixed(2)})`;
          break;
        case 'ash':
          x = ((fx * w - time * 20) % w + w) % w;
          y = (fy * h + time * 18) % h;
          col = 'rgba(160,160,170,0.6)';
          break;
        case 'dust':
        case 'pollen':
        case 'wind':
          if (i > 20)
            continue;
          x = ((fx * w + time * (kind === 'wind' ? 120 : 14)) % w + w) % w;
          y = h * 0.3 + fy * h * 0.5 + Math.sin(time + i) * 10;
          col = kind === 'pollen' ? 'rgba(255,250,200,0.6)' : 'rgba(230,220,200,0.35)';
          if (kind === 'wind')
            size = px * 3;
          break;
        case 'stars':
          if (i > 30)
            continue;
          x = fx * w;
          y = fy * h * 0.7;
          col = `rgba(230,220,255,${(0.25 + 0.75 * Math.abs(Math.sin(time * 1.1 + i * 1.7))).toFixed(2)})`;
          break;
        case 'mist':
          if (i > 14)
            continue;
          x = ((fx * w + time * (8 + (i % 4) * 4)) % (w + 200) + w + 200) % (w + 200) - 100;
          y = h * 0.25 + fy * h * 0.6;
          col = 'rgba(230,240,255,0.16)';
          size = px * 18;
          break;
        case 'bubbles':
          if (i > 26)
            continue;
          x = fx * w + Math.sin(time * 2 + i) * 6;
          y = h - ((fy * h + time * (30 + (i % 5) * 9)) % h);
          col = 'rgba(200,235,255,0.55)';
          break;
        case 'drips':
          if (i > 10)
            continue;
          x = fx * w;
          y = ((fy * h + time * 160) % (h * 0.8));
          col = 'rgba(160,200,230,0.6)';
          break;
        default:
          continue;
      }
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), size, kind === 'drips' ? px * 2 : kind === 'mist' ? px * 4 : px);
    }
    ctx.restore();
  }

  TR.BattleBackdrop = Object.freeze({
    LOW_W, LOW_H, HORIZON, PIXEL, THEMES, PLANE_TINTS,
    themeFor, layers, draw, drawAmbient,
    groundY: h => HORIZON / LOW_H * h,
    clearCache: () => _cache.clear(),
  });
})();
