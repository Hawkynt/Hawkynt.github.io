;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const Kit = NS.tileKit || (NS.tileKit = {});
  const { TS, CHUNK_COLS, CHUNK_W, MAX_CHUNKS, TWO_PI, EMPTY, SOLID, ONEWAY, SPIKE, LIQUID, ICE, FAKE, THEMES, makeCanvas, rgba, texture, isTerrain, codeAt, paintTerrain, paintCap, paintDeco, paintHang, paintLedge, paintSpike, paintLiquidBody, paintOcclusion } = Kit;

  /*
   * Terrain: the live bits (liquid surfaces and secret walls), the chunk cache with its per-frame
   * drawing, menu previews and the public SZ.PlatformerTiles API.
   */

  const surfaceCache = {};
  const SURF_FRAMES = 8;

  function surfaceFrames(world) {
    if (surfaceCache[world])
      return surfaceCache[world];
    const th = THEMES[world];
    const frames = [];
    for (let f = 0; f < SURF_FRAMES; ++f) {
      const c = makeCanvas(TS * 2, 40);
      const g = c.getContext('2d');
      g.scale(2, 2);
      const ph = f / SURF_FRAMES * TWO_PI;
      const lg = g.createLinearGradient(0, 8, 0, 20);
      lg.addColorStop(0, th.surface);
      lg.addColorStop(0.3, th.liquid[0]);
      lg.addColorStop(1, rgba(th.liquid[0], 0));
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(0, 20);
      for (let x = 0; x <= TS; x += 4)
        g.lineTo(x, 13 + Math.sin(x / TS * TWO_PI + ph) * 2 + Math.sin(x / TS * TWO_PI * 2 - ph * 2) * 0.8);
      g.lineTo(TS, 20);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(th.surface, 0.95);
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= TS; x += 4) {
        const yy = 13 + Math.sin(x / TS * TWO_PI + ph) * 2 + Math.sin(x / TS * TWO_PI * 2 - ph * 2) * 0.8;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
      if (th.hot) {
        g.fillStyle = 'rgba(255,250,200,0.8)';
        g.beginPath();
        g.arc((f * 7) % TS, 14, 1.6, 0, TWO_PI);
        g.fill();
      }
      frames.push(c);
    }
    surfaceCache[world] = frames;
    return frames;
  }

  const glowCache = {};
  function liquidGlow(world) {
    if (glowCache[world])
      return glowCache[world];
    const th = THEMES[world];
    const c = makeCanvas(96, 96);
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(48, 48, 0, 48, 48, 48);
    rg.addColorStop(0, rgba(th.liquid[0], 0.55));
    rg.addColorStop(1, rgba(th.liquid[0], 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, 96, 96);
    glowCache[world] = c;
    return c;
  }

  /* ══════════════════════════════════════════════════════════════════
     THE BAKED LEVEL
     ══════════════════════════════════════════════════════════════════ */

  function create(level, opts) {
    opts = opts || {};
    const world = level.world | 0;
    const th = THEMES[world];
    /* a whole number of device pixels per tile keeps cell edges seamless */
    const snap = (k) => Math.max(1, Math.round(TS * k)) / TS;
    let scale = snap(opts.scale || 1);
    const nChunks = Math.ceil(level.cols / CHUNK_COLS);
    const chunks = new Map();   // index -> { canvas, used }
    let stamp = 0;
    const surfaces = [];        // liquid cells with open air above
    const fakes = [];           // secret wall cells
    for (let r = 0; r < level.rows; ++r) {
      for (let c = 0; c < level.cols; ++c) {
        const code = level.tiles[r * level.cols + c];
        if (code === LIQUID && codeAt(level, c, r - 1) !== LIQUID)
          surfaces.push({ c: c, r: r });
        else if (code === FAKE)
          fakes.push({ c: c, r: r });
      }
    }

    function bake(index) {
      const x0 = index * CHUNK_W;
      const canvas = makeCanvas(CHUNK_W * scale, level.rows * TS * scale);
      const g = canvas.getContext('2d');
      g.scale(scale, scale);
      g.translate(-x0, 0);
      const pattern = g.createPattern(texture(world), 'repeat');
      const c0 = Math.max(0, index * CHUNK_COLS - 1), c1 = Math.min(level.cols - 1, (index + 1) * CHUNK_COLS);
      g.save();
      g.beginPath();
      g.rect(x0, 0, CHUNK_W, level.rows * TS);
      g.clip();
      /* pass 1: occlusion and liquids in open cells */
      for (let r = 0; r < level.rows; ++r) {
        for (let c = c0; c <= c1; ++c) {
          const code = level.tiles[r * level.cols + c];
          const x = c * TS, y = r * TS;
          if (code === LIQUID)
            paintLiquidBody(g, th, level, c, r, x, y);
          else if (!isTerrain(code))
            paintOcclusion(g, level, c, r, x, y);
        }
      }
      /* pass 2: terrain bodies */
      const caps = [];
      for (let r = 0; r < level.rows; ++r) {
        for (let c = c0; c <= c1; ++c) {
          const code = level.tiles[r * level.cols + c];
          if (code === SOLID || code === ICE)
            caps.push({ c: c, r: r, f: paintTerrain(g, level, th, c, r, c * TS, r * TS, pattern, code === ICE) });
        }
      }
      /* pass 3: caps, hanging growth and decorations on top of the bodies */
      for (const k of caps) {
        const x = k.c * TS, y = k.r * TS;
        paintCap(g, level, th, k.c, k.r, x, y, k.f, world);
        if (k.f.d && k.r < level.rows - 1)
          paintHang(g, th, k.c, k.r, x, y + TS, th.hang);
      }
      for (const k of caps) {
        if (!k.f.u || k.r < 2)
          continue;
        const above = codeAt(level, k.c, k.r - 1);
        if (above === EMPTY)
          paintDeco(g, th, k.c, k.r, k.c * TS, k.r * TS, world);
      }
      /* pass 4: ledges and spikes */
      for (let r = 0; r < level.rows; ++r) {
        for (let c = c0; c <= c1; ++c) {
          const code = level.tiles[r * level.cols + c];
          if (code === ONEWAY)
            paintLedge(g, th, c, r, c * TS, r * TS, codeAt(level, c - 1, r) !== ONEWAY, codeAt(level, c + 1, r) !== ONEWAY);
          else if (code === SPIKE)
            paintSpike(g, th, c * TS, r * TS, spikeDir(level, c, r));
        }
      }
      g.restore();
      return canvas;
    }

    function spikeDir(lv, c, r) {
      const solid = (cc, rr) => { const k = codeAt(lv, cc, rr); return k === SOLID || k === ICE || k === -1 && rr >= lv.rows; };
      if (solid(c, r + 1)) return 'up';
      if (solid(c, r - 1)) return 'down';
      if (solid(c - 1, r)) return 'right';
      if (solid(c + 1, r)) return 'left';
      return 'up';
    }

    function chunk(index) {
      let ch = chunks.get(index);
      if (!ch) {
        ch = { canvas: bake(index), used: 0 };
        chunks.set(index, ch);
        if (chunks.size > MAX_CHUNKS) {
          let oldest = -1, best = Infinity;
          for (const [k, v] of chunks)
            if (v.used < best && k !== index) { best = v.used; oldest = k; }
          chunks.delete(oldest);
        }
      }
      ch.used = ++stamp;
      return ch;
    }

    function range(rect) {
      return [Math.max(0, Math.floor(rect.x0 / CHUNK_W)), Math.min(nChunks - 1, Math.floor((rect.x1 - 1) / CHUNK_W))];
    }

    /* bakes at most one chunk ahead of or behind the view per call */
    function prepare(rect) {
      const [a, b] = range(rect);
      for (const k of [b + 1, a - 1]) {
        if (k >= 0 && k < nChunks && !chunks.has(k)) {
          chunk(k);
          return true;
        }
      }
      return false;
    }

    function draw(ctx, rect) {
      const [a, b] = range(rect);
      for (let k = a; k <= b; ++k) {
        const ch = chunk(k);
        ctx.drawImage(ch.canvas, k * CHUNK_W, 0, CHUNK_W, level.rows * TS);
      }
    }

    let fakePattern = null;

    function drawLive(ctx, rect, t, fakeAlpha) {
      if (surfaces.length) {
        const frames = surfaceFrames(world);
        const f = frames[Math.floor(t * 8) % SURF_FRAMES];
        const glow = th.hot ? liquidGlow(world) : null;
        for (const s of surfaces) {
          const x = s.c * TS, y = s.r * TS;
          if (x + TS < rect.x0 || x > rect.x1 || y + TS < rect.y0 || y > rect.y1)
            continue;
          ctx.drawImage(f, x, y, TS, 20);
        }
        if (glow) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 2.3);
          for (let i = 0; i < surfaces.length; i += 2) {
            const s = surfaces[i];
            const x = s.c * TS, y = s.r * TS;
            if (x + 96 < rect.x0 || x - 96 > rect.x1 || y + 96 < rect.y0 || y - 96 > rect.y1)
              continue;
            ctx.drawImage(glow, x - 48 + TS / 2, y - 60, 144, 120);
          }
          ctx.restore();
        }
      }
      if (fakes.length && fakeAlpha > 0.01) {
        if (!fakePattern)
          fakePattern = ctx.createPattern(texture(world), 'repeat');
        ctx.save();
        ctx.globalAlpha = fakeAlpha;
        ctx.fillStyle = fakePattern;
        for (const s of fakes) {
          const x = s.c * TS, y = s.r * TS;
          if (x + TS < rect.x0 || x > rect.x1 || y + TS < rect.y0 || y > rect.y1)
            continue;
          ctx.fillRect(x, y, TS, TS);
        }
        ctx.restore();
      }
    }

    /* a tile changed: drop the chunks that show it so they bake again */
    function refresh(c) {
      const k = Math.floor(c / CHUNK_COLS);
      chunks.delete(k);
      if (c % CHUNK_COLS === 0) chunks.delete(k - 1);
      if (c % CHUNK_COLS === CHUNK_COLS - 1) chunks.delete(k + 1);
    }

    function setScale(s) {
      s = snap(s);
      if (Math.abs(s - scale) > 0.001) {
        scale = s;
        chunks.clear();
      }
    }

    return {
      prepare: prepare, draw: draw, drawLive: drawLive, refresh: refresh, setScale: setScale,
      get cachedChunks() { return chunks.size; },
      get chunkCount() { return nChunks; }
    };
  }

  /* a single tile preview (help pages, tree icons): terrain with a cap */
  const previewCache = {};
  function preview(world, code) {
    const key = world + ':' + code;
    if (previewCache[key])
      return previewCache[key];
    const cols = 3, rows = 3;
    const tiles = new Uint8Array(cols * rows);
    tiles[4] = code;
    if (code === SPIKE || code === ONEWAY)
      tiles[7] = SOLID;
    const lv = { cols: cols, rows: rows, tiles: tiles, world: world };
    const baked = create(lv, { scale: 2 });
    const c = makeCanvas(TS * 2, TS * 2);
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.translate(-TS, -TS);
    baked.draw(g, { x0: 0, y0: 0, x1: cols * TS, y1: rows * TS });
    previewCache[key] = c;
    return c;
  }

  SZ.PlatformerTiles = Object.freeze({ TS, CHUNK_COLS, THEMES, create, preview, texture });
})();
