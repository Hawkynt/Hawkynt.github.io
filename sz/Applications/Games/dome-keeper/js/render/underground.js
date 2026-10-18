;(function() {
  'use strict';

  // Drawing the mine: tiles, cached tile art, ore piles and the keeper.
  // Owns: NS.undergroundArt
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, rules, upgrades, cargo, chestArt,
  //   artifacts, droneArt, mineHud, gadgetArt, bombArt
  // Reads state of: gameState, bombs

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_EMPTY, TILE_DIRT, TILE_GADGET,
    TILE_CORE, TILE_CHEST, TILE_HIGHLIGHT_COLORS, TILE_ICONS } = NS.constants;
  const { makeRng, makeCanvas, parseHex } = NS.util;
  const { ctx } = NS.dom;
  const { SPRITE_OUTLINE, getSprite, drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { uiFont } = NS.textLayout;
  const { roundRectPath, drawMeter } = NS.panels;
  const { ORE_SPECKLE_COLORS, RESOURCE_TILES, DEPTH_TIERS, getDepthTier } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { drawFlyingOre } = NS.cargo;
  const { drawUndergroundArtifacts, drawChests, drawChestHints } = NS.chestArt;
  const { hasArtifact } = NS.artifacts;
  const { drawUndergroundDrones, drawDroneHUD } = NS.droneArt;

  /* ======================================================================
     DRAWING -- UNDERGROUND
     ====================================================================== */

  // Loose ore piles: one sprite (largest stack) and a cached count badge per
  // cell, pre-drawn into a layer that is reused while piles and camera rest
  const PILE_LAYER_MARGIN = 3;       // extra tiles around the view held by the layer
  const PILE_GLOW_LIMIT = 120;       // glows only while fewer piles are in view
  const pileBadges = new Map();      // display text -> small canvas
  const pileLayer = { canvas: null, ctx: null, version: -1, scale: 0, c0: 0, r0: 0, c1: -1, r1: -1, piles: [] };

  function pileCountText(n) {
    if (n <= 999) return String(n);
    if (n < 10000) return (Math.floor(n / 100) / 10).toString() + 'k';
    return Math.floor(n / 1000) + 'k';
  }

  function getPileBadge(text) {
    let b = pileBadges.get(text);
    if (b) return b;
    const px = 15, font = uiFont(px, 'bold');
    const m = document.createElement('canvas').getContext('2d');
    m.font = font;
    const w = Math.ceil(m.measureText(text).width) + 6, h = px + 6;
    const scale = Math.max(1, G.renderScale);
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.lineWidth = Math.max(2, px / 6);
    g.lineJoin = 'round';
    g.strokeText(text, w / 2, h - 2);
    g.fillStyle = '#fff';
    g.fillText(text, w / 2, h - 2);
    b = { canvas: c, w, h };
    pileBadges.set(text, b);
    return b;
  }

  // Kind of ore with the most items in a pile
  function pileMainType(p) {
    let best = -1, bestN = -1;
    for (const t in p.items)
      if (p.items[t] > bestN) {
        bestN = p.items[t];
        best = +t;
      }
    return best;
  }

  function rebuildPileLayer(c0, r0, c1, r1) {
    const L = pileLayer;
    const w = (c1 - c0 + 1) * TILE_SIZE, h = (r1 - r0 + 1) * TILE_SIZE;
    const scale = G.renderScale;
    if (!L.canvas) {
      L.canvas = document.createElement('canvas');
      L.ctx = L.canvas.getContext('2d');
    }
    const bw = Math.ceil(w * scale), bh = Math.ceil(h * scale);
    if (L.canvas.width !== bw || L.canvas.height !== bh) {
      L.canvas.width = bw;
      L.canvas.height = bh;
    } else
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = L.ctx;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, w, h);
    L.piles = [];
    for (const p of G.droppedResources) {
      if (p.col < c0 || p.col > c1 || p.row < r0 || p.row > r1) continue;
      L.piles.push(p);
      const x = (p.col - c0) * TILE_SIZE + TILE_SIZE / 2, y = (p.row - r0) * TILE_SIZE + TILE_SIZE / 2;
      const type = pileMainType(p);
      p.mainType = type;
      const img = getSprite(TILE_ICONS[type] || 'crate');
      if (img) {
        const s = p.total >= 10 ? 26 : 22;
        g.imageSmoothingEnabled = s * scale / img.width < 1.5;
        g.drawImage(img, Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      }
      const b = getPileBadge(pileCountText(p.total));
      g.imageSmoothingEnabled = true;
      g.drawImage(b.canvas, Math.round(x - b.w / 2), Math.round(y - 10 - b.h), b.w, b.h);
    }
    L.version = G.pileVersion;
    L.scale = scale;
    L.c0 = c0;
    L.r0 = r0;
    L.c1 = c1;
    L.r1 = r1;
  }

  function drawPiles(startCol, endCol, startRow, endRow, ox, oy) {
    if (!G.droppedResources.length) return;
    const L = pileLayer;
    const vc0 = startCol - 1, vr0 = startRow - 1, vc1 = endCol, vr1 = endRow;
    if (L.scale !== G.renderScale)
      pileBadges.clear();
    if (L.version !== G.pileVersion || L.scale !== G.renderScale || vc0 < L.c0 || vr0 < L.r0 || vc1 > L.c1 || vr1 > L.r1)
      rebuildPileLayer(vc0 - PILE_LAYER_MARGIN, vr0 - PILE_LAYER_MARGIN, vc1 + PILE_LAYER_MARGIN, vr1 + PILE_LAYER_MARGIN);
    const bob = Math.sin(G.animTime * 4) * 3;
    if (L.piles.length < PILE_GLOW_LIMIT)
      for (const p of L.piles) {
        const dx = p.col * TILE_SIZE + TILE_SIZE / 2 - ox, dy = p.row * TILE_SIZE + TILE_SIZE / 2 - oy;
        if (dx < -TILE_SIZE || dx > CANVAS_W + TILE_SIZE || dy < -TILE_SIZE || dy > CANVAS_H + TILE_SIZE) continue;
        drawGlow(TILE_HIGHLIGHT_COLORS[p.mainType] || '#fff', dx, dy + bob, 22, 0.35);
      }
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(L.canvas, L.c0 * TILE_SIZE - ox, L.r0 * TILE_SIZE - oy + Math.round(bob), (L.c1 - L.c0 + 1) * TILE_SIZE, (L.r1 - L.r0 + 1) * TILE_SIZE);
    ctx.imageSmoothingEnabled = prevSmooth;
  }

  function drawUnderground() {
    const art = buildTileArt();
    ctx.fillStyle = '#070403';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid tiles (viewport culled)
    const startCol = Math.max(0, Math.floor(G.cameraX / TILE_SIZE));
    const endCol = Math.min(GRID_COLS, Math.ceil((G.cameraX + CANVAS_W) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(G.cameraY / TILE_SIZE));
    const endRow = Math.min(GRID_ROWS, Math.ceil((G.cameraY + CANVAS_H) / TILE_SIZE));
    const ox = Math.round(G.cameraX), oy = Math.round(G.cameraY);
    const oreTiles = [];

    for (let r = startRow; r < endRow; ++r) {
      const row = G.undergroundGrid[r];
      for (let c = startCol; c < endCol; ++c) {
        const x = c * TILE_SIZE - ox;
        const y = r * TILE_SIZE - oy;
        const tile = row[c];

        if (tile === TILE_EMPTY) {
          ctx.drawImage(art.cave[getDepthTier(r)][tileVariant(r, c) % art.VARIANTS], x, y);
          continue;
        }
        drawTile(x, y, tile === TILE_GADGET || tile === TILE_CORE || tile === TILE_CHEST ? TILE_DIRT : tile, r, c);
        if (tile !== TILE_DIRT && tile !== TILE_GADGET && tile !== TILE_CORE && tile !== TILE_CHEST)
          oreTiles.push(r, c);

        // Cracks on partially-mined tiles
        if (G.tileHP[r] && G.tileMaxHP[r] && G.tileMaxHP[r][c] > 0) {
          const hpRatio = G.tileHP[r][c] / G.tileMaxHP[r][c];
          if (hpRatio < 0.99) {
            const damage = 1 - hpRatio;
            ctx.fillStyle = `rgba(0,0,0,${damage * 0.3})`;
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.drawImage(art.cracks[Math.min(3, Math.floor(damage * 4))], x, y);
          }
        }
      }
    }

    // Gadget chamber overlays and probe highlights
    NS.gadgetArt.drawUndergroundGadgets();

    // Edges between rock and tunnel: rim light on rock, occlusion in the tunnel
    const solidAt = (r, c) => r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS || G.undergroundGrid[r][c] !== TILE_EMPTY;
    for (let r = startRow; r < endRow; ++r)
      for (let c = startCol; c < endCol; ++c) {
        const x = c * TILE_SIZE - ox;
        const y = r * TILE_SIZE - oy;
        const solid = G.undergroundGrid[r][c] !== TILE_EMPTY;
        const up = solidAt(r - 1, c), down = solidAt(r + 1, c), left = solidAt(r, c - 1), right = solidAt(r, c + 1);
        if (solid) {
          if (!up) ctx.drawImage(art.rimTop, x, y);
          if (!down) ctx.drawImage(art.rimBottom, x, y);
          if (!left) ctx.drawImage(art.rimLeft, x, y);
          if (!right) ctx.drawImage(art.rimRight, x, y);
        } else {
          if (up) ctx.drawImage(art.aoTop, x, y);
          if (down) ctx.drawImage(art.aoBottom, x, y);
          if (left) ctx.drawImage(art.aoLeft, x, y);
          if (right) ctx.drawImage(art.aoRight, x, y);
        }
      }

    // Resource reveal glows (drawn over tiles)
    for (const g of G.resourceGlows)
      drawGlow(g.color, g.x, g.y, g.radius, Math.max(0, g.life) * 0.6);

    // Rock crumble debris
    for (const crumble of G.crumbleEffects) {
      const alpha = Math.max(0, crumble.life / 0.6);
      ctx.globalAlpha = alpha;
      for (const p of crumble.pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = SPRITE_OUTLINE;
        ctx.fillRect(-p.size / 2 - 1, -p.size / 2 - 1, p.size + 2, p.size + 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Dust clouds
    for (const d of G.dustClouds) {
      ctx.save();
      ctx.globalAlpha = d.alpha * 0.8;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, TWO_PI);
      ctx.fillStyle = '#9a8a6a';
      ctx.fill();
      ctx.restore();
    }

    // Dropped resources: bobbing ore icons with their amount
    drawPiles(startCol, endCol, startRow, endRow, ox, oy);

    // Planned path
    if (G.movePath && G.movePathIndex < G.movePath.length) {
      ctx.strokeStyle = 'rgba(120,210,255,0.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -G.animTime * 20;
      ctx.beginPath();
      ctx.moveTo(G.drillX * TILE_SIZE + TILE_SIZE / 2 - ox, G.drillY * TILE_SIZE + TILE_SIZE / 2 - oy);
      for (let pi = G.movePathIndex; pi < G.movePath.length; ++pi) {
        const step = G.movePath[pi];
        ctx.lineTo(step.col * TILE_SIZE + TILE_SIZE / 2 - ox, step.row * TILE_SIZE + TILE_SIZE / 2 - oy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.fillStyle = 'rgba(140,220,255,0.6)';
      for (let pi = G.movePathIndex; pi < G.movePath.length; ++pi) {
        const step = G.movePath[pi];
        ctx.beginPath();
        ctx.arc(step.col * TILE_SIZE + TILE_SIZE / 2 - ox, step.row * TILE_SIZE + TILE_SIZE / 2 - oy, pi === G.movePath.length - 1 ? 5 : 2.5, 0, TWO_PI);
        ctx.fill();
      }
      if (G.mineTarget) {
        ctx.strokeStyle = `rgba(255,140,60,${0.5 + Math.sin(G.animTime * 6) * 0.2})`;
        ctx.lineWidth = 3;
        roundRectPath(G.mineTarget.col * TILE_SIZE + 3 - ox, G.mineTarget.row * TILE_SIZE + 3 - oy, TILE_SIZE - 6, TILE_SIZE - 6, 5);
        ctx.stroke();
      }
    }

    // Draw drill/player character
    drawPlayer();

    // Lamp light: darkness deepens with depth, warm glow around the keeper
    const pcx = G.drillX * TILE_SIZE + TILE_SIZE / 2 - ox;
    const pcy = G.drillY * TILE_SIZE + TILE_SIZE / 2 - oy;
    const depth = G.drillY / GRID_ROWS;
    const radar = (1 + 0.25 * getEffectiveLevel('undergroundRadar')) * (hasArtifact('sunLamp') ? 1.6 : 1);
    const lw = CANVAS_W * 1.9 * radar, lh = CANVAS_H * 1.9 * 0.75 * radar;
    ctx.globalAlpha = 0.6 + depth * 0.35;
    ctx.drawImage(art.light, pcx - lw / 2, pcy - lh / 2, lw, lh);
    ctx.fillStyle = '#000';
    if (pcx - lw / 2 > 0) ctx.fillRect(0, 0, pcx - lw / 2, CANVAS_H);
    if (pcx + lw / 2 < CANVAS_W) ctx.fillRect(pcx + lw / 2, 0, CANVAS_W - pcx - lw / 2, CANVAS_H);
    if (pcy - lh / 2 > 0) ctx.fillRect(0, 0, CANVAS_W, pcy - lh / 2);
    if (pcy + lh / 2 < CANVAS_H) ctx.fillRect(0, pcy + lh / 2, CANVAS_W, CANVAS_H - pcy - lh / 2);
    ctx.globalAlpha = 1;
    drawGlow('#ffcf80', pcx, pcy, 150, 0.16);

    // Courier drones carry their own lights; the core glows through the dark
    drawUndergroundDrones();
    drawFlyingOre(ox, oy);
    NS.gadgetArt.drawRelocationCoreMarker();
    drawChests();
    drawChestHints(G.toolState.scannerActive ? NS.gadgetArt.scannerRange() : 0);
    drawUndergroundArtifacts();

    // Ore glints twinkle through the dark
    for (let i = 0; i < oreTiles.length; i += 2) {
      const r = oreTiles[i], c = oreTiles[i + 1];
      const h = tileVariant(r, c);
      const tw = Math.sin(G.animTime * 1.7 + (h % 628) / 100);
      if (tw < 0.9) continue;
      const k = (tw - 0.9) * 10;
      const gx = c * TILE_SIZE - ox + 8 + (h % 24), gy = r * TILE_SIZE - oy + 8 + ((h >>> 5) % 24);
      drawGlow(TILE_HIGHLIGHT_COLORS[G.undergroundGrid[r][c]] || '#fff', gx, gy, 10 + k * 6, k);
      ctx.fillStyle = `rgba(255,255,255,${k})`;
      ctx.fillRect(gx - 4 * k, gy - 0.5, 8 * k, 1);
      ctx.fillRect(gx - 0.5, gy - 4 * k, 1, 8 * k);
    }

    // Bombs lying in the mine, explosions and the throw preview
    NS.bombArt.drawPlacedBombs();
    NS.bombArt.drawBlasts(true);
    NS.bombArt.drawThrowPreview();

    // Mining progress bar above the block being mined
    if (G.miningTarget && G.miningDuration > 0) {
      const progress = Math.min(G.miningProgress / G.miningDuration, 1);
      drawMeter(G.miningTarget.col * TILE_SIZE - ox + 2, G.miningTarget.row * TILE_SIZE - oy - 10, TILE_SIZE - 4, 7, progress, progress > 0.8 ? '#5ae070' : '#ffb030');
    }

    // Resource display (improved styling)
    NS.mineHud.drawResourceHUD();

    NS.bombArt.drawBombBar();

    // Tool and drone HUD (underground, right side)
    drawDroneHUD(CANVAS_W - 296, NS.mineHud.drawToolHUDUnderground() + 12, 280);

    NS.gadgetArt.drawKeyHints([
      { key: 'Space', label: 'Surface' },
      { key: 'WASD', label: 'Move & mine' },
      { key: 'Click', label: 'Walk / dig' },
      { key: 'B', label: 'Bomb' },
      { key: 'C', label: 'Craft' },
      { key: 'H', label: 'Help' }
    ], CANVAS_W / 2 - 150, CANVAS_H - 24, 680);
  }


  // Tile textures, edge overlays, cracks and light maps -- built once
  function buildTileArt() {
    if (G.tileArt) return G.tileArt;
    const T = TILE_SIZE;
    const VARIANTS = 4;
    const rgb = (hex) => parseHex(hex);
    const shade = ([r, g, b], k) => `rgb(${Math.max(0, Math.min(255, r * k)) | 0},${Math.max(0, Math.min(255, g * k)) | 0},${Math.max(0, Math.min(255, b * k)) | 0})`;

    const paintGround = (g, base, rng, stony, density) => {
      const c = rgb(base);
      g.fillStyle = shade(c, 1);
      g.fillRect(0, 0, T, T);
      // 2px pixel noise for a hand-made texture
      for (let y = 0; y < T; y += 2)
        for (let x = 0; x < T; x += 2) {
          const v = rng();
          if (v < density) {
            g.fillStyle = shade(c, 0.78 + rng() * 0.1);
            g.fillRect(x, y, 2, 2);
          } else if (v > 1 - density * 0.6) {
            g.fillStyle = shade(c, 1.12 + rng() * 0.1);
            g.fillRect(x, y, 2, 2);
          }
        }
      // Pebbles / stones with a lit top
      const n = stony ? 3 : 2;
      for (let i = 0; i < n; ++i) {
        const px = 4 + rng() * (T - 8), py = 4 + rng() * (T - 8);
        const w = (stony ? 5 : 3) + rng() * 4, h = 2 + rng() * 3;
        g.fillStyle = shade(c, 0.62);
        g.fillRect(px - w / 2, py - h / 2 + 1, w, h);
        g.fillStyle = shade(c, stony ? 1.3 : 1.22);
        g.fillRect(px - w / 2, py - h / 2, w, h - 1);
        g.fillStyle = shade(c, 1.5);
        g.fillRect(px - w / 2, py - h / 2, w * 0.6, 1);
      }
      if (stony) {
        g.strokeStyle = shade(c, 0.6);
        g.lineWidth = 1;
        g.beginPath();
        let x = rng() * T, y = 0;
        g.moveTo(x, y);
        for (let k = 0; k < 4; ++k) {
          x += (rng() - 0.5) * 14;
          y += T / 4;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    };

    // Extra surface detail that gives each deep stratum its own look
    const paintStyle = (g, style, base, rng, variant) => {
      const c = rgb(base);
      const line = (pts, col, w) => {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
        g.stroke();
      };
      if (style === 'slate') {
        // Thin cleavage layers
        for (let y = 3 + rng() * 4; y < T; y += 5 + rng() * 4) {
          line([[0, y], [T * 0.4, y + (rng() - 0.5) * 2], [T, y + (rng() - 0.5) * 3]], shade(c, 0.7), 1);
          line([[0, y + 1], [T, y + 1 + (rng() - 0.5) * 2]], shade(c, 1.25), 1);
        }
      } else if (style === 'granite') {
        // Feldspar and mica flecks
        for (let i = 0; i < 26; ++i) {
          const x = rng() * T, y = rng() * T, k = rng();
          g.fillStyle = k < 0.35 ? 'rgba(255,220,210,0.55)' : (k < 0.7 ? 'rgba(20,10,10,0.55)' : 'rgba(255,255,255,0.7)');
          g.fillRect(x | 0, y | 0, k > 0.85 ? 2 : 1 + (rng() * 2 | 0), 1 + (rng() * 2 | 0));
        }
      } else if (style === 'basalt') {
        // Column joints
        const x1 = T * 0.33 + (rng() - 0.5) * 4, x2 = T * 0.68 + (rng() - 0.5) * 4, ym = T * (0.3 + rng() * 0.4);
        for (const [pts, a] of [[[[x1, 0], [x1 + 2, ym], [x1, T]], 0.75], [[[x2, 0], [x2 - 2, T - ym], [x2 + 1, T]], 0.75], [[[x1 + 2, ym], [x2 - 1, ym + 3]], 0.6]]) {
          line(pts, shade(c, 0.45), 2);
          line(pts.map(([x, y]) => [x + 1, y + 1]), `rgba(255,255,255,${0.08 * a})`, 1);
        }
      } else if (style === 'obsidian') {
        // Glassy glints and a conchoidal fracture now and then
        for (let i = 0; i < 3; ++i) {
          const x = rng() * T, y = rng() * T, l = 3 + rng() * 6;
          line([[x, y], [x + l, y - l * 0.6]], `rgba(210,190,255,${0.12 + rng() * 0.18})`, 1);
        }
        if (rng() < 0.5) {
          g.strokeStyle = 'rgba(220,200,255,0.16)';
          g.lineWidth = 1;
          g.beginPath();
          g.arc(rng() * T, rng() * T, 5 + rng() * 6, rng() * 3, rng() * 3 + 1.6);
          g.stroke();
        }
      } else if (style === 'magma') {
        // A glowing fissure in some tiles, embers in the rest
        if (variant === 1) {
          const horiz = rng() < 0.5;
          let a = rng() * T, b = 0;
          const pts = [];
          while (b <= T + 6) {
            pts.push(horiz ? [b, a] : [a, b]);
            a = Math.max(4, Math.min(T - 4, a + (rng() - 0.5) * 10));
            b += 5 + rng() * 6;
          }
          line(pts, 'rgba(255,90,20,0.3)', 4);
          line(pts, '#e8601a', 1.6);
          line(pts, '#ffd070', 0.6);
        }
        for (let i = 0; i < 3; ++i) {
          g.fillStyle = `rgba(255,${120 + rng() * 100 | 0},40,${0.4 + rng() * 0.4})`;
          g.fillRect(rng() * T | 0, rng() * T | 0, 1 + (rng() < 0.3 ? 1 : 0), 1);
        }
      } else if (style === 'abyss') {
        // Faint violet veins and pinpoint lights
        line([[0, rng() * T], [T * 0.5, rng() * T], [T, rng() * T]], 'rgba(140,90,255,0.35)', 1);
        for (let i = 0; i < 5; ++i) {
          g.fillStyle = `rgba(${200 + rng() * 55 | 0},180,255,${0.35 + rng() * 0.5})`;
          g.fillRect(rng() * T | 0, rng() * T | 0, 1, 1);
        }
      }
    };
    const STONY = { gravel: true, stone: true, slate: false, granite: true, basalt: true, obsidian: false, magma: true, abyss: false };

    const rng = makeRng(777);
    const dirt = [], cave = [];
    for (let t = 0; t < DEPTH_TIERS.length; ++t) {
      dirt.push([]);
      cave.push([]);
      const tier = DEPTH_TIERS[t];
      for (let v = 0; v < VARIANTS; ++v) {
        const d = makeCanvas(T, T);
        const dg = d.getContext('2d');
        paintGround(dg, tier.base, rng, !!STONY[tier.style], tier.style === 'obsidian' ? 0.12 : 0.22);
        paintStyle(dg, tier.style, tier.base, rng, v);
        dirt[t].push(d);
        const cv = makeCanvas(T, T);
        const cg = cv.getContext('2d');
        const base = rgb(DEPTH_TIERS[t].base);
        paintGround(cg, shade(base, 0.32).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g2, b) => '#' + [r, g2, b].map(n => (+n).toString(16).padStart(2, '0')).join('')), rng, false, 0.3);
        cave[t].push(cv);
      }
    }

    // First row of each tier: the tier above reaches down with a jagged edge
    const seam = [null];
    for (let t = 1; t < DEPTH_TIERS.length; ++t) {
      seam.push([]);
      for (let v = 0; v < VARIANTS; ++v) {
        const sc = makeCanvas(T, T);
        const g = sc.getContext('2d');
        const pts = [];
        for (let x = 0; x <= T; x += 5)
          pts.push([x, 3 + rng() * 11]);
        g.beginPath();
        g.moveTo(0, 0);
        for (const [x, y] of pts)
          g.lineTo(x, y);
        g.lineTo(T, 0);
        g.closePath();
        g.save();
        g.clip();
        g.drawImage(dirt[t - 1][v], 0, 0);
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 2;
        g.beginPath();
        pts.forEach(([x, y], i) => i ? g.lineTo(x, y + 1) : g.moveTo(x, y + 1));
        g.stroke();
        seam[t].push(sc);
      }
    }

    // Embedded ore chunks per resource type
    const ore = {};
    for (const tile of RESOURCE_TILES) {
      ore[tile] = [];
      const cols = ORE_SPECKLE_COLORS[tile] || ['#fff'];
      for (let v = 0; v < VARIANTS; ++v) {
        const oc = makeCanvas(T, T);
        const g = oc.getContext('2d');
        for (let i = 0; i < 9; ++i) {
          const x = 4 + rng() * (T - 8), y = 4 + rng() * (T - 8);
          // keep the centre free for the sprite
          if (Math.abs(x - T / 2) < 12 && Math.abs(y - T / 2) < 12) continue;
          const s = 2 + rng() * 2.5;
          g.fillStyle = SPRITE_OUTLINE;
          g.fillRect(x - s / 2 - 1, y - s / 2 - 1, s + 2, s + 2);
          g.fillStyle = cols[i % cols.length];
          g.fillRect(x - s / 2, y - s / 2, s, s);
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fillRect(x - s / 2, y - s / 2, Math.max(1, s / 2), 1);
        }
        ore[tile].push(oc);
      }
    }

    // Edge overlays on solid tiles that border a tunnel (rim light / lip)
    const edge = (draw) => {
      const c = makeCanvas(T, T);
      draw(c.getContext('2d'));
      return c;
    };
    const rimTop = edge(g => {
      g.fillStyle = 'rgba(255,240,210,0.28)';
      g.fillRect(0, 0, T, 3);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, T, 1);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 3, T, 1);
    });
    const rimBottom = edge(g => {
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, T - 4, T, 4);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(0, T - 5, T, 1);
    });
    const rimLeft = edge(g => {
      g.fillStyle = 'rgba(255,240,210,0.14)';
      g.fillRect(0, 0, 2, T);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(2, 0, 1, T);
    });
    const rimRight = edge(g => {
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(T - 3, 0, 3, T);
    });
    // Ambient occlusion inside tunnels next to solid rock
    const ao = (x0, y0, x1, y1) => edge(g => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, T, T);
    });
    const aoTop = ao(0, 0, 0, T * 0.45), aoBottom = ao(0, T, 0, T * 0.6), aoLeft = ao(0, 0, T * 0.4, 0), aoRight = ao(T, 0, T * 0.6, 0);

    // Crack stages for partly mined tiles
    const cracks = [];
    for (let stage = 1; stage <= 4; ++stage) {
      const c = makeCanvas(T, T);
      const g = c.getContext('2d');
      const r2 = makeRng(stage * 31);
      g.lineCap = 'round';
      for (let k = 0; k < stage + 1; ++k) {
        let x = T / 2 + (r2() - 0.5) * 8, y = T / 2 + (r2() - 0.5) * 8;
        let a = r2() * TWO_PI;
        const pts = [[x, y]];
        for (let i = 0; i < 2 + stage; ++i) {
          a += (r2() - 0.5) * 1.2;
          x += Math.cos(a) * (4 + stage * 1.5);
          y += Math.sin(a) * (4 + stage * 1.5);
          pts.push([x, y]);
        }
        for (const [col, w, oy] of [['rgba(255,255,255,0.25)', 1.5, 1], ['rgba(0,0,0,0.75)', 1.5 + stage * 0.4, 0]]) {
          g.strokeStyle = col;
          g.lineWidth = w;
          g.beginPath();
          pts.forEach(([px, py], i) => i ? g.lineTo(px, py + oy) : g.moveTo(px, py + oy));
          g.stroke();
        }
      }
      cracks.push(c);
    }

    // Darkness map around the miner's lamp (scaled up when drawn)
    const LW = 400, LH = 300;
    const light = makeCanvas(LW, LH);
    const lg = light.getContext('2d');
    const lgr = lg.createRadialGradient(LW / 2, LH / 2, 18, LW / 2, LH / 2, LW * 0.42);
    lgr.addColorStop(0, 'rgba(0,0,0,0)');
    lgr.addColorStop(0.35, 'rgba(0,0,0,0.25)');
    lgr.addColorStop(1, 'rgba(0,0,0,1)');
    lg.fillStyle = lgr;
    lg.fillRect(0, 0, LW, LH);

    G.tileArt = { dirt, cave, seam, ore, VARIANTS, rimTop, rimBottom, rimLeft, rimRight, aoTop, aoBottom, aoLeft, aoRight, cracks, light };
    return G.tileArt;
  }

  function tileVariant(r, c) {
    return ((r * 73856093) ^ (c * 19349663)) >>> 0;
  }

  function drawTile(x, y, tile, r, c) {
    const art = buildTileArt();
    const h = tileVariant(r, c);
    const tier = getDepthTier(r);
    ctx.drawImage(art.dirt[tier][h % art.VARIANTS], x, y);
    if (tier > 0 && getDepthTier(r - 1) !== tier)
      ctx.drawImage(art.seam[tier][(h >>> 5) % art.VARIANTS], x, y);
    if (tile === TILE_DIRT || tile === TILE_GADGET)
      return;
    const ores = art.ore[tile];
    if (ores)
      ctx.drawImage(ores[(h >>> 3) % art.VARIANTS], x, y);
    // Soft colour bloom so ore tiles read at a glance
    const hl = TILE_HIGHLIGHT_COLORS[tile];
    if (hl)
      drawGlow(hl, x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE * 0.62, 0.3);
    const tIcon = TILE_ICONS[tile];
    if (tIcon)
      drawSprite(tIcon, x + TILE_SIZE / 2, y + TILE_SIZE / 2, 26);
  }

  function drawPlayer() {
    const px = G.drillX * TILE_SIZE - Math.round(G.cameraX);
    const py = G.drillY * TILE_SIZE - Math.round(G.cameraY);
    const bob = G.playerBob;
    if (G.lastMineDir.dx)
      G.keeperFaceX = G.lastMineDir.dx < 0 ? -1 : 1;
    const face = G.keeperFaceX;

    // Selection brackets
    const sel = 0.55 + Math.sin(G.animTime * 5) * 0.25;
    ctx.strokeStyle = `rgba(255,220,90,${sel})`;
    ctx.lineWidth = 3;
    const L = 10, t = TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(px, py + L); ctx.lineTo(px, py); ctx.lineTo(px + L, py);
    ctx.moveTo(px + t - L, py); ctx.lineTo(px + t, py); ctx.lineTo(px + t, py + L);
    ctx.moveTo(px + t, py + t - L); ctx.lineTo(px + t, py + t); ctx.lineTo(px + t - L, py + t);
    ctx.moveTo(px + L, py + t); ctx.lineTo(px, py + t); ctx.lineTo(px, py + t - L);
    ctx.stroke();

    // Headlamp beam in the facing / mining direction
    const lampX = px + TILE_SIZE / 2 + face * 2, lampY = py + 10 + bob;
    const dirX = G.lastMineDir.dx || (G.lastMineDir.dy ? 0 : face), dirY = G.lastMineDir.dy || 0;
    const ang = Math.atan2(dirY, dirX);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createRadialGradient(lampX, lampY, 4, lampX, lampY, 150);
    cone.addColorStop(0, 'rgba(255,230,160,0.28)');
    cone.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(lampX, lampY);
    ctx.arc(lampX, lampY, 150, ang - 0.42, ang + 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(px + TILE_SIZE / 2, py + TILE_SIZE / 2 + bob);
    ctx.scale(face, 1);
    const O = SPRITE_OUTLINE;
    const legAnim = G.pickaxeSwinging ? Math.sin(G.animTime * 15) * 1.5 : 0;

    // Backpack
    ctx.fillStyle = O;
    roundRectPath(-13, -4, 9, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#c87a2a';
    roundRectPath(-12, -3, 7, 12, 2);
    ctx.fill();

    // Legs and boots
    ctx.fillStyle = O;
    ctx.fillRect(-7 + legAnim, 9, 6, 9);
    ctx.fillRect(1 - legAnim, 9, 6, 9);
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(-6 + legAnim, 9, 4, 7);
    ctx.fillRect(2 - legAnim, 9, 4, 7);
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(-7 + legAnim, 15, 6, 3);
    ctx.fillRect(1 - legAnim, 15, 6, 3);

    // Suit
    ctx.fillStyle = O;
    roundRectPath(-9, -3, 18, 15, 4);
    ctx.fill();
    const sg = ctx.createLinearGradient(-8, 0, 8, 0);
    sg.addColorStop(0, '#5a8ae8');
    sg.addColorStop(1, '#2a4aa0');
    ctx.fillStyle = sg;
    roundRectPath(-8, -2, 16, 13, 3);
    ctx.fill();
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(-8, 6, 16, 2);

    // Head and helmet
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.arc(0, -8, 8.5, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#f0c090';
    ctx.beginPath();
    ctx.arc(0, -7, 7, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(2, -8, 2, 2);
    ctx.fillRect(-3, -8, 2, 2);
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.arc(0, -10, 9, Math.PI, 0);
    ctx.lineTo(10, -9);
    ctx.lineTo(-10, -9);
    ctx.closePath();
    ctx.fill();
    const hg = ctx.createLinearGradient(0, -18, 0, -9);
    hg.addColorStop(0, '#ffe070');
    hg.addColorStop(1, '#d09010');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -10, 7.5, Math.PI, 0);
    ctx.lineTo(9, -10);
    ctx.lineTo(-9, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.arc(5, -13, 2.5, 0, TWO_PI);
    ctx.fill();

    // Arm and pickaxe
    ctx.save();
    ctx.translate(6, 1);
    const swing = G.pickaxeSwinging ? -1.2 + G.pickaxeAngle * 1.8 : -0.5;
    ctx.rotate(swing);
    ctx.fillStyle = O;
    ctx.fillRect(-1, -2, 15, 4);
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(0, -1, 14, 2);
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.moveTo(10, -9);
    ctx.quadraticCurveTo(17, -2, 12, 9);
    ctx.lineTo(14, 9);
    ctx.quadraticCurveTo(20, -2, 12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, -8);
    ctx.quadraticCurveTo(17, -2, 13, 8);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = O;
    ctx.beginPath();
    ctx.arc(6, 2, 3.2, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#f0c090';
    ctx.beginPath();
    ctx.arc(6, 2, 2, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    drawGlow('#fff0b0', lampX + face * 3, py + 6 + bob, 14, 0.7);

    // Dazed by a blast: stars circle the helmet
    if (G.keeperStun > 0) {
      const cx = px + TILE_SIZE / 2, cy = py + 2 + bob;
      for (let i = 0; i < 3; ++i) {
        const a = G.animTime * 5 + i * TWO_PI / 3;
        drawSprite('sparkle', cx + Math.cos(a) * 16, cy + Math.sin(a) * 5, 14, Math.min(1, G.keeperStun));
      }
    }
  }

  NS.undergroundArt = { pileCountText, getPileBadge, drawUnderground, drawTile };
})();
