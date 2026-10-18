/* Space Farming - the meadow around the field (cached), its decorations and the field fence.
   Reads: G.canvasW, G.canvasH, G.gridRows, G.livestockPens, G.currentSeason, G.gridCols, G.gridColOffset,
     G.viewZoom, G.viewPanX, G.viewPanY, G.animT, G.lowQuality */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, ctx, drawSprite, hash2, turfPattern,
    DECOR_KINDS, decorSprite, horizonWorldY, windStrength, lightAt } = NS;

  /* ── Ground: meadow, decorations and the field's fence ── */

  function viewWorldRect() {
    return {
      x0: -G.viewPanX / G.viewZoom,
      y0: -G.viewPanY / G.viewZoom,
      x1: (G.canvasW - G.viewPanX) / G.viewZoom,
      y1: (G.canvasH - G.viewPanY) / G.viewZoom
    };
  }

  let groundCanvas = null, groundKey = '';

  /* The meadow only changes with the view and the season, so it is painted
     into a screen-sized bitmap and reused until one of them changes */
  function drawGround(v) {
    const hy = horizonWorldY();
    const top = Math.max(v.y0, hy);
    if (top >= v.y1) return;
    const key = [G.canvasW, G.canvasH, window.devicePixelRatio || 1, G.viewZoom.toFixed(4), G.viewPanX.toFixed(1), G.viewPanY.toFixed(1), G.currentSeason, G.gridRows, G.gridCols, G.gridColOffset, G.lowQuality].join('|');
    if (key !== groundKey || !groundCanvas) {
      if (!groundCanvas)
        groundCanvas = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      const W = Math.round(G.canvasW * dpr), H = Math.round(G.canvasH * dpr);
      if (groundCanvas.width !== W || groundCanvas.height !== H) {
        groundCanvas.width = W;
        groundCanvas.height = H;
      }
      const g = groundCanvas.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.translate(G.viewPanX, G.viewPanY);
      g.scale(G.viewZoom, G.viewZoom);
      g.fillStyle = turfPattern(G.currentSeason);
      g.fillRect(v.x0 - 4, top, v.x1 - v.x0 + 8, v.y1 - top + 4);
      // soft shadow just below the horizon
      const sh = g.createLinearGradient(0, hy, 0, hy + 40);
      sh.addColorStop(0, 'rgba(10,20,30,0.45)');
      sh.addColorStop(1, 'rgba(10,20,30,0)');
      g.fillStyle = sh;
      g.fillRect(v.x0, hy, v.x1 - v.x0, 40);
      drawDecor(v, 'bake', g);
      groundKey = key;
    }
    // drawn in screen space, before the world transform
    ctx.drawImage(groundCanvas, 0, 0, G.canvasW, G.canvasH);
  }

  function isPenSlot(r, c) {
    for (const pen of G.livestockPens)
      if (pen.gridRow === r && pen.gridCol === c) return true;
    return false;
  }

  const SWAYING_DECOR = { tree: 1, reeds: 1, bloom: 1 };

  /* mode 'bake' paints shadows and still decorations into g (world units);
     mode 'live' draws the swaying ones and registers the glowing ones */
  function drawDecor(v, mode, g) {
    const T = BASE_TILE_SIZE;
    const c0 = Math.floor((v.x0 - GRID_OFFSET_X) / T) - 1, c1 = Math.ceil((v.x1 - GRID_OFFSET_X) / T) + 1;
    const r0 = Math.floor((Math.max(v.y0, horizonWorldY()) - GRID_OFFSET_Y) / T), r1 = Math.ceil((v.y1 - GRID_OFFSET_Y) / T) + 1;
    if ((c1 - c0) * (r1 - r0) > 6000) return;
    const offC = G.gridColOffset;
    const bake = mode === 'bake';
    const still = (kind) => !SWAYING_DECOR[kind] || G.lowQuality;
    if (bake)
      g.imageSmoothingEnabled = G.viewZoom < 0.5;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        if (r >= -1 && r <= G.gridRows && c >= -1 && c <= G.gridCols) continue;
        const h = hash2(c - offC, r);
        if (h > 0.2) continue;
        const kind = DECOR_KINDS[Math.floor(hash2(r + 7, c - offC + 3) * DECOR_KINDS.length)];
        const ox = (hash2(c - offC, r + 11) - 0.5) * T * 0.5, oy = (hash2(c - offC + 5, r) - 0.5) * T * 0.4;
        const x = GRID_OFFSET_X + (c + 0.5) * T + ox, y = GRID_OFFSET_Y + (r + 0.5) * T + oy;
        if (y - 30 < horizonWorldY()) continue;
        const big = kind === 'tree' ? 1.6 : 1;
        const size = T * 0.85 * big;
        const spr = decorSprite(kind, G.currentSeason);
        if (bake) {
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.beginPath();
          g.ellipse(x, y + size * 0.42, size * 0.35, size * 0.1, 0, 0, TWO_PI);
          g.fill();
          if (still(kind))
            g.drawImage(spr, x - size / 2, y + size * 0.5 - size, size, size);
          continue;
        }
        if (!still(kind)) {
          const sway = Math.sin(G.animT * 1.3 + h * 40) * 0.05 * windStrength();
          ctx.save();
          ctx.translate(x, y + size * 0.5);
          ctx.transform(1, 0, sway, 1, 0, 0);
          drawSprite(spr, 0, -size / 2, size);
          ctx.restore();
        }
        if (kind === 'shroom' || kind === 'crystal')
          lightAt(x, y, T * 0.9, kind === 'shroom' ? '#5ff0e0' : '#a8e8ff', 0.5);
      }
  }

  /* Wooden fence around the field with posts on every tile corner */
  function drawFieldFence() {
    const T = BASE_TILE_SIZE;
    const x0 = GRID_OFFSET_X - 3, y0 = GRID_OFFSET_Y - 3;
    const x1 = GRID_OFFSET_X + G.gridCols * T + 3, y1 = GRID_OFFSET_Y + G.gridRows * T + 3;
    const winter = G.currentSeason === 3;
    ctx.save();
    // dark border so the field reads as one plot of land
    ctx.fillStyle = 'rgba(30,18,10,0.55)';
    ctx.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, 4);
    ctx.fillRect(x0 - 4, y1, x1 - x0 + 8, 6);
    ctx.fillRect(x0 - 4, y0, 4, y1 - y0);
    ctx.fillRect(x1, y0, 4, y1 - y0);
    const rail = (ax, ay, bx, by) => {
      ctx.fillStyle = '#5e3820';
      if (ay === by) {
        ctx.fillRect(ax, ay - 7, bx - ax, 3);
        ctx.fillRect(ax, ay - 2, bx - ax, 3);
        ctx.fillStyle = '#9a5b34';
        ctx.fillRect(ax, ay - 7, bx - ax, 1);
        ctx.fillRect(ax, ay - 2, bx - ax, 1);
      } else {
        ctx.fillRect(ax - 2, ay, 3, by - ay);
        ctx.fillStyle = '#9a5b34';
        ctx.fillRect(ax - 2, ay, 1, by - ay);
      }
    };
    rail(x0, y0, x1, y0);
    rail(x0, y1, x1, y1);
    rail(x0, y0, x0, y1);
    rail(x1, y0, x1, y1);
    const post = (px, py) => {
      ctx.fillStyle = '#4a2a16';
      ctx.fillRect(px - 3, py - 10, 6, 12);
      ctx.fillStyle = '#b07a4a';
      ctx.fillRect(px - 3, py - 10, 2, 12);
      if (winter) {
        ctx.fillStyle = '#f4f8ff';
        ctx.fillRect(px - 3, py - 12, 6, 3);
      }
    };
    for (let c = 0; c <= G.gridCols; ++c) {
      post(GRID_OFFSET_X + c * T, y0);
      post(GRID_OFFSET_X + c * T, y1);
    }
    for (let r = 1; r < G.gridRows; ++r) {
      post(x0, GRID_OFFSET_Y + r * T);
      post(x1, GRID_OFFSET_Y + r * T);
    }
    ctx.restore();
  }

  Object.assign(NS, { viewWorldRect, drawGround, isPenSlot, drawDecor, drawFieldFence });

})();
