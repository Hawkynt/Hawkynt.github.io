/* Space Farming - field tiles, soil nutrients, crops, rocks and the expansion strip.
   Owns: G.soilOverlay, G.expandBadge
   Reads: G.state, G.credits, G.selectedTool, G.gridRows, G.farmGrid, G.tileTypes, G.hoedTiles, G.buildings,
     G.weatherType, G.currentSeason, G.dayPhase, G.gridCols, G.gridColOffset, G.expansionDirection,
     G.viewZoom, G.uiTime, G.animT, G.dialog, G.pointerX, G.pointerY, G.pointerUX, G.pointerUY,
     G.pointerInside */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, TILE_FARMLAND, TILE_ROCK, TILE_WATER,
    TILE_SAND, STATE_PLAYING, CROPS, WEATHER_RAIN, WEATHER_THUNDERSTORM, TOOL_PLANT, TOOL_HOE, ctx,
    shadeColor, bakeSprite, SPRITE_PAINTERS, spriteCache, getSprite, getYoungCropSprite, drawSprite, uiFont,
    UI, hexToRgba, drawChip, hitRegion, getTileSoilQuality, hash2, tileTexture, drawGlow, isPenSlot,
    windStrength, DIR_NAMES, expansionTiles, expansionAt, expandCost, lightAt, getField, worldToUI } = NS;

  /* ── Field tiles ── */

  function drawTiles(v) {
    const T = BASE_TILE_SIZE;
    const F = getField();
    const c0 = Math.max(0, Math.floor((v.x0 - GRID_OFFSET_X) / T)), c1 = Math.min(G.gridCols - 1, Math.floor((v.x1 - GRID_OFFSET_X) / T));
    const r0 = Math.max(0, Math.floor((v.y0 - GRID_OFFSET_Y) / T)), r1 = Math.min(G.gridRows - 1, Math.floor((v.y1 - GRID_OFFSET_Y) / T));
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = G.viewZoom < 0.5;
    const waterFrame = Math.floor(G.animT * 2.5) % 4;
    const rainWet = G.weatherType === WEATHER_RAIN || G.weatherType === WEATHER_THUNDERSTORM;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = G.tileTypes[r][c];
        const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
        const variant = Math.floor(hash2(c - G.gridColOffset, r) * 4);
        let flags = 0;
        if (tt === TILE_WATER)
          flags = waterFrame;
        else if (tt === TILE_FARMLAND) {
          if (F.wet[r * G.gridCols + c] || rainWet) flags |= 1;
          if (G.hoedTiles[r][c]) flags |= 2;
        }
        ctx.drawImage(tileTexture(tt, variant, G.currentSeason, flags), x, y, T, T);
      }
    ctx.imageSmoothingEnabled = smooth;

    // Shorelines, plot seams and soil quality tint
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = G.tileTypes[r][c];
        const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
        if (tt === TILE_WATER) {
          const foam = G.currentSeason === 3 ? 'rgba(255,255,255,0.7)' : `rgba(200,240,255,${0.55 + Math.sin(G.animT * 3 + r + c) * 0.2})`;
          ctx.fillStyle = foam;
          if (r > 0 && G.tileTypes[r - 1][c] !== TILE_WATER) ctx.fillRect(x, y, T, 3);
          if (r < G.gridRows - 1 && G.tileTypes[r + 1][c] !== TILE_WATER) ctx.fillRect(x, y + T - 3, T, 3);
          if (c > 0 && G.tileTypes[r][c - 1] !== TILE_WATER) ctx.fillRect(x, y, 3, T);
          if (c < G.gridCols - 1 && G.tileTypes[r][c + 1] !== TILE_WATER) ctx.fillRect(x + T - 3, y, 3, T);
          continue;
        }
        if (tt === TILE_FARMLAND || tt === TILE_SAND) {
          // poor soil looks pale and dusty, rich soil dark and green-flecked
          const q = getTileSoilQuality(r, c);
          if (q < 0.85) {
            ctx.fillStyle = `rgba(214,196,150,${Math.min(0.42, (0.85 - q) * 0.9)})`;
            ctx.fillRect(x, y, T, T);
          } else if (q > 1.0) {
            ctx.fillStyle = `rgba(20,40,14,${Math.min(0.35, (q - 1.0) * 0.7)})`;
            ctx.fillRect(x, y, T, T);
          }
        }
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(x + T - 1, y, 1, T);
        ctx.fillRect(x, y + T - 1, T, 1);
      }
  }

  function showNutrients() {
    return G.soilOverlay || G.selectedTool === TOOL_HOE || (G.selectedTool === TOOL_PLANT && !G.dialog);
  }

  function nutrientColor(q) {
    return q < 0.65 ? '#ff6a5a' : (q < 0.9 ? '#ffc24a' : (q < 1.15 ? '#9be35a' : '#4fe08a'));
  }

  /* 5 pips: one per 30% of fertility */
  function nutrientPips(q) {
    return Math.max(1, Math.min(5, Math.round(q / 0.3)));
  }

  function drawNutrients(v) {
    if (!showNutrients()) return;
    const T = BASE_TILE_SIZE;
    const c0 = Math.max(0, Math.floor((v.x0 - GRID_OFFSET_X) / T)), c1 = Math.min(G.gridCols - 1, Math.floor((v.x1 - GRID_OFFSET_X) / T));
    const r0 = Math.max(0, Math.floor((v.y0 - GRID_OFFSET_Y) / T)), r1 = Math.min(G.gridRows - 1, Math.floor((v.y1 - GRID_OFFSET_Y) / T));
    const full = G.soilOverlay || G.selectedTool === TOOL_HOE;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = G.tileTypes[r][c];
        const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
        if (tt === TILE_WATER) continue;
        if (tt === TILE_ROCK) {
          if (full) {
            ctx.fillStyle = 'rgba(40,40,52,0.35)';
            ctx.fillRect(x, y, T, T);
          }
          continue;
        }
        if (G.buildings[r][c]) continue;
        // seed mode marks the empty plots only, so ripe crops stay readable
        if (!full && G.farmGrid[r][c]) continue;
        const q = getTileSoilQuality(r, c);
        const col = nutrientColor(q);
        if (full) {
          ctx.fillStyle = hexToRgba(col, 0.2);
          ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        }
        const n = nutrientPips(q);
        const pw = 7, ph = 5, gap = 2, bx = x + 4, by = y + T - ph - 4;
        ctx.fillStyle = 'rgba(10,8,6,0.7)';
        ctx.fillRect(bx - 2, by - 2, 5 * (pw + gap) - gap + 4, ph + 4);
        for (let i = 0; i < 5; ++i) {
          ctx.fillStyle = i < n ? col : 'rgba(255,255,255,0.14)';
          ctx.fillRect(bx + i * (pw + gap), by, pw, ph);
        }
      }
  }

  /* ── Crops ── */

  function youngFruitSprite(crop) {
    const key = 'bud:' + crop.sprite;
    if (!spriteCache[key])
      spriteCache[key] = bakeSprite((p, P) => {
        p.ell(7.5, 14, 6, 1.5, P.soil);
        p.line(7.5, 14, 7.5, 5, P.leaf);
        p.line(7.5, 11, 3, 8, P.leaf); p.line(7.5, 10, 12, 7, P.leaf);
        p.ell(3, 8, 2.5, 1.2, P.green); p.ell(12, 7, 2.5, 1.2, P.green);
        p.ell(6, 4, 2, 1, P.green); p.ell(10, 3.5, 2, 1, P.green);
        p.disc(7.5, 4, 2.2, shadeColor(crop.color, -0.15));
        p.disc(3.5, 11, 1.4, crop.color); p.disc(11.5, 10.5, 1.4, crop.color);
        p.px(7, 3, P.white, true);
      });
    return spriteCache[key];
  }

  function cropVisual(crop, cell) {
    const maxStage = crop.stages - 1;
    const st = Math.min(cell.growthStage, maxStage);
    if (st >= maxStage) return { spr: getSprite(crop.sprite), size: 46 };
    const within = Math.max(0, Math.min(1, cell.growthProgress * crop.stages - st));
    if (st === 0) return { spr: getSprite('sprout'), size: 26 + within * 8 };
    if (st === maxStage - 1 && maxStage >= 3) return { spr: youngFruitSprite(crop), size: 40 + within * 4 };
    return { spr: getYoungCropSprite(crop), size: 32 + (st / maxStage) * 8 + within * 4 };
  }

  function drawCrop(r, c, cell) {
    const T = BASE_TILE_SIZE;
    const crop = CROPS[cell.cropIndex];
    const mature = cell.growthStage >= crop.stages - 1;
    const cx = GRID_OFFSET_X + (c + 0.5) * T, baseY = GRID_OFFSET_Y + (r + 1) * T - 7;
    const vis = cropVisual(crop, cell);
    const pop = cell.plantAnim > 0 ? 1 + Math.sin(cell.plantAnim * Math.PI) * 0.35 : 1;
    const ph = hash2(c * 3 + 1, r * 5 + 2) * TWO_PI;
    const shear = Math.sin(G.animT * 1.8 + ph + c * 0.4) * 0.06 * windStrength();
    const bob = mature ? Math.sin(G.animT * 2.4 + ph) * 0.6 : 0;
    const size = vis.size * pop;
    const sleeping = (crop.nightOnly && G.dayPhase < 0.5) || (crop.dayOnly && G.dayPhase >= 0.5);

    if (mature)
      drawGlow(cx, baseY - 14, T * 0.55, crop.color, 0.18 + Math.sin(G.animT * 3 + ph) * 0.08);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, size * 0.32, size * 0.08, 0, 0, TWO_PI);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, baseY + bob);
    ctx.transform(1, 0, shear, 1, 0, 0);
    drawSprite(vis.spr, 0, -size / 2, size, sleeping ? 0.75 : 1);
    ctx.restore();
    if (G.currentSeason === 3) {
      ctx.fillStyle = 'rgba(240,248,255,0.55)';
      ctx.fillRect(cx - size * 0.25, baseY - size * 0.92, size * 0.5, 2);
    }
    if (sleeping) {
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(G.animT * 2 + ph) * 0.3;
      ctx.fillStyle = '#cfe0ff';
      ctx.font = uiFont(9, 'bold');
      ctx.textAlign = 'center';
      ctx.fillText('z', cx + 12, baseY - size + 6 - (G.animT * 6 + ph) % 8);
      ctx.restore();
    }
    // Ripe sparkle
    if (mature) {
      const k = (G.animT * 0.9 + ph) % 1.6;
      if (k < 0.5) {
        const a = Math.sin(k / 0.5 * Math.PI);
        const sx = cx + (hash2(Math.floor(G.animT * 0.9 + ph), c) - 0.5) * T * 0.6;
        const sy = baseY - 10 - hash2(r, Math.floor(G.animT * 0.9 + ph)) * T * 0.6;
        drawTwinkle(sx, sy, 5 * a, a);
      }
      if (crop.name === 'Astral Flower' || crop.name === 'Lunar Moss' || crop.name === 'Solar Vine')
        lightAt(cx, baseY - 16, T * 0.9, crop.color, 0.7);
    }
    // Growth progress ring for growing crops
    if (!mature && G.viewZoom >= 0.55) {
      const prog = Math.min(1, cell.growthProgress);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx + T * 0.34, baseY - T + 16, 4, 0, TWO_PI);
      ctx.stroke();
      ctx.strokeStyle = '#9df08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + T * 0.34, baseY - T + 16, 4, -Math.PI / 2, -Math.PI / 2 + prog * TWO_PI);
      ctx.stroke();
    }
  }

  function drawTwinkle(x, y, s, a) {
    if (s < 0.5) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = '#fffbe0';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.25, y - s * 0.25);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s * 0.25, y + s * 0.25);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.25, y + s * 0.25);
    ctx.lineTo(x - s, y);
    ctx.lineTo(x - s * 0.25, y - s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* Boulders on rock tiles: obstacles for crops, ground for buildings */
  function rockSprite(r, c) {
    const v = hash2(c - G.gridColOffset + 17, r + 3) < 0.5 ? 'rockpile' : 'rockpile2';
    const key = v + ':' + G.currentSeason;
    if (!spriteCache[key])
      spriteCache[key] = bakeSprite((p, P) => {
        SPRITE_PAINTERS[v](p, P);
        if (G.currentSeason === 3) {
          p.ell(6, 6, 3.5, 1.2, P.white, true);
          p.ell(10.5, 8.5, 2.5, 0.9, P.white, true);
        } else if (G.currentSeason < 2) {
          p.px(4, 12, P.leaf, true); p.px(12, 12, P.green, true);
        }
      });
    return spriteCache[key];
  }

  function drawRock(r, c) {
    const T = BASE_TILE_SIZE;
    const cx = GRID_OFFSET_X + (c + 0.5) * T, baseY = GRID_OFFSET_Y + (r + 1) * T - 5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 2, T * 0.42, T * 0.12, 0, 0, TWO_PI);
    ctx.fill();
    drawSprite(rockSprite(r, c), cx, baseY - T * 0.42, T * 0.92);
  }

  function drawExpansionStrip() {
    expandChip = null;
    G.expandBadge = null;
    if (G.state !== STATE_PLAYING) return;
    const T = BASE_TILE_SIZE;
    const tiles = expansionTiles();
    const cost = expandCost();
    const afford = G.credits >= cost;
    const hover = G.pointerInside && !hitRegion(G.pointerUX, G.pointerUY) && expansionAt(G.pointerX, G.pointerY);
    const pulse = 0.5 + Math.sin(G.uiTime * 3) * 0.5;
    ctx.save();
    for (const tl of tiles) {
      if (isPenSlot(tl.r, tl.c)) continue;
      const x = GRID_OFFSET_X + tl.c * T, y = GRID_OFFSET_Y + tl.r * T;
      ctx.fillStyle = hover ? 'rgba(120,90,50,0.55)' : 'rgba(110,80,45,0.28)';
      ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = hover ? 2.5 : 1.5;
      ctx.strokeStyle = hover ? 'rgba(255,230,140,0.95)' : `rgba(255,230,160,${0.35 + (afford ? pulse * 0.3 : 0)})`;
      ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
      ctx.setLineDash([]);
    }
    // the + badge in the middle of the strip
    const mid = tiles[Math.floor((tiles.length - 1) / 2)];
    const bx = GRID_OFFSET_X + (mid.c + 0.5) * T + (tiles.length % 2 === 0 && G.expansionDirection > 1 ? T / 2 : 0);
    const by = GRID_OFFSET_Y + (mid.r + 0.5) * T + (tiles.length % 2 === 0 && G.expansionDirection < 2 ? T / 2 : 0);
    G.expandBadge = { x: bx, y: by };
    const rad = T * 0.3 * (1 + (afford && !hover ? pulse * 0.08 : 0)) * (hover ? 1.12 : 1);
    if (afford)
      drawGlow(bx, by, rad * 2.4, '#ffe68c', 0.35 + pulse * 0.2);
    ctx.fillStyle = afford ? '#ffd75a' : 'rgba(160,160,170,0.85)';
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, TWO_PI);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(40,24,8,0.85)';
    ctx.stroke();
    ctx.fillStyle = '#3a2408';
    ctx.fillRect(bx - rad * 0.55, by - rad * 0.14, rad * 1.1, rad * 0.28);
    ctx.fillRect(bx - rad * 0.14, by - rad * 0.55, rad * 0.28, rad * 1.1);
    ctx.restore();
    expandChip = hover ? { wx: bx, wy: by - T * 0.55, text: `[[map]] Expand ${DIR_NAMES[G.expansionDirection]}: +${tiles.length} plots · ${cost} [[coin]]`, afford } : null;
  }

  let expandChip = null;

  /* Price chip over the + badge, drawn with the HUD */
  function drawExpandChip() {
    if (!expandChip) return;
    const u = worldToUI(expandChip.wx, expandChip.wy);
    drawChip(expandChip.text, u.x, u.y - 24, 24, { align: 'center', px: 12, bg: 'rgba(8,12,24,0.9)', border: expandChip.afford ? 'rgba(255,215,90,0.8)' : 'rgba(255,106,106,0.7)', color: expandChip.afford ? UI.gold : '#ffc0b8', maxW: 420 });
  }

  Object.assign(NS, { drawTiles, showNutrients, nutrientPips, drawNutrients, drawCrop, drawTwinkle, drawRock,
    drawExpansionStrip, drawExpandChip });

})();
