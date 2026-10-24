/* The scrolling overworld: the infinite tile map, day/night ambience and the fallback tile colors. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const Renderer = TR.Renderer;

  Object.assign(Renderer.prototype, {
    drawInfiniteMap(tileGetter, dimension, groundGetter = null) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const ts = this._tileSize;
      const cx = this._camera.x;
      const cy = this._camera.y;
      const startCol = Math.floor(cx / ts) - 1;
      const startRow = Math.floor(cy / ts) - 1;
      const endCol = Math.ceil((cx + this._width) / ts) + 1;
      const endRow = Math.ceil((cy + this._height) / ts) + 1;

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const dimSprites = TR.DIMENSION_TERRAIN_SPRITES;
      const spriteMap = (dimension && dimSprites && dimSprites[dimension])
        ? dimSprites[dimension]
        : TR.OVERWORLD_TERRAIN_SPRITES;
      const assets = this._assets;
      const hasSheet = assets && assets.ready && assets.has('overworld');
      const sheetImg = hasSheet ? assets.get('overworld') : null;

      const TILE_NAMES = ['VOID', 'GRASS', 'FOREST', 'MOUNTAIN', 'DUNGEON', 'TOWN', 'ROAD', 'CAMP', 'WATER', 'SAND'];

      // Tiles that need a GRASS base layer drawn underneath (overlay-on-grass)
      const NEEDS_BASE = { 2: true, 3: true, 4: true, 5: true, 7: true };

      const computeBitmask = TR.computeBitmask;
      const getAutotileRect = TR.getAutotileRect;
      const getAutotileSheet = TR.getAutotileSheet;

      ctx.imageSmoothingEnabled = false;
      // Floor camera offsets to integer pixels to prevent sub-pixel gaps between tiles
      const fcx = Math.floor(cx);
      const fcy = Math.floor(cy);
      // Draw tiles 1px wider/taller to overlap and hide hairline seams
      const tsDraw = ts + 1;
      // painted, varied ground; each plane paves its roads its own way and
      // scatters its own features
      const TA = TR.TerrainArt;
      const painted = TA && assets ? assets.get('terrain') : null;
      const world = dimension && dimension !== 'material' && TR.PlaneWorlds ? TR.PlaneWorlds.get(dimension) : null;
      const roadArt = world ? world.road : 'road';
      const planeProps = new Map();
      if (world && TR.OverworldTile)
        for (const [name, spec] of Object.entries(world.props))
          planeProps.set(TR.OverworldTile[name], spec);
      const props = assets ? assets.get('props') : null;
      const DA = TR.DungeonArt;
      const kenney = i => TR.spriteRectM ? TR.spriteRectM(i, TR.OVERWORLD_COLS, TR.OVERWORLD_MARGIN) : null;
      const OVERLAY_TREES = [kenney(528), kenney(526), kenney(528)];
      const CACTUS = kenney(592), DEAD_TREE = kenney(597);
      const paint = (id, c, r, sx, sy) => {
        const q = TA.rect(id, c, r);
        ctx.drawImage(painted, q.x, q.y, q.w, q.h, sx, sy, tsDraw, tsDraw);
      };
      for (let r = startRow; r <= endRow; ++r)
        for (let c = startCol; c <= endCol; ++c) {
          const tile = tileGetter(c, r);
          const sx = c * ts - fcx;
          const sy = r * ts - fcy;
          let drawn = false;
          if (painted && groundGetter && tile !== 6 && tile !== 8 && tile > 0) {
            paint(groundGetter(c, r), c, r, sx, sy);
            const h = (Math.imul(c * 73856093 ^ r * 19349663, 0x9E3779B1) >>> 0) >>> 5;
            const prop = id => {
              const q = DA && props ? DA.rect(id) : null;
              if (q)
                ctx.drawImage(props, q.x, q.y, q.w, q.h, sx, sy, tsDraw, tsDraw);
            };
            const sheetRect = q => {
              if (q && sheetImg)
                ctx.drawImage(sheetImg, q.x, q.y, q.w, q.h, sx, sy, tsDraw, tsDraw);
            };
            switch (tile) {
              case 1: if (h % 29 === 0) prop('flowers'); break;
              case 2: sheetRect(OVERLAY_TREES[h % 3]); break;
              case 10: if (h % 13 === 0) prop('snow_rock'); break;
              case 11: prop('snow_pine'); break;
              case 12: if (h % 3 === 1) prop('palm'); else if (h % 3 === 2) sheetRect(OVERLAY_TREES[h % 2]); break;
              case 13: if (h % 9 === 0) sheetRect(CACTUS); break;
              case 14: if (h % 7 === 0) prop('mesa'); break;
              case 15: if (h % 11 === 0) sheetRect(DEAD_TREE); else if (h % 3 === 0) prop('reeds'); break;
              case 16: prop('hillock'); break;
              case 17: if (h % 8 === 0) prop('acacia'); break;
              case 19: if (h % 9 === 0) prop('vent'); break;
              case 21: prop('portal'); break;
              default: {
                const spec = planeProps.get(tile);
                if (spec && h % spec[1] === 0)
                  prop(spec[0]);
                break;
              }
            }
            // mountains and locations stand on the regional ground
            if ((tile === 3 || tile === 4 || tile === 5 || tile === 7) && spriteMap) {
              const rect = spriteMap[TILE_NAMES[tile]];
              const img = rect && rect.sheet ? assets.get(rect.sheet) : sheetImg;
              if (rect && img)
                ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, sx, sy, tsDraw, tsDraw);
            }
            continue;
          }
          if (sheetImg && tile > 0 && tile < TILE_NAMES.length) {
            // Draw grass base layer for overlay tiles (forest, mountain, etc.)
            if (NEEDS_BASE[tile] && painted)
              paint('meadow', c, r, sx, sy);
            else if (NEEDS_BASE[tile] && spriteMap) {
              const baseRect = spriteMap.GRASS;
              if (baseRect)
                ctx.drawImage(sheetImg, baseRect.x, baseRect.y, baseRect.w, baseRect.h, sx, sy, tsDraw, tsDraw);
            }
            if (painted && (tile === 1 || tile === 6)) {
              paint(tile === 1 ? 'meadow' : roadArt, c, r, sx, sy);
              continue;
            }
            let rect = null;
            let srcImg = sheetImg;
            if (computeBitmask && getAutotileRect) {
              const mask = computeBitmask(c, r, tileGetter, tile);
              rect = getAutotileRect(tile, mask);
              if (rect && getAutotileSheet) {
                const genSheet = getAutotileSheet(tile);
                if (genSheet)
                  srcImg = genSheet;
              }
            }
            if (!rect && spriteMap) {
              rect = spriteMap[TILE_NAMES[tile]];
              if (rect && rect.sheet)
                srcImg = assets.get(rect.sheet);
            }
            if (rect && srcImg) {
              ctx.drawImage(srcImg, rect.x, rect.y, rect.w, rect.h, sx, sy, tsDraw, tsDraw);
              drawn = true;
            }
          }
          if (!drawn) {
            ctx.fillStyle = this._tileColor(tile);
            ctx.fillRect(sx, sy, tsDraw, tsDraw);
          }
        }
    }

    // Living overworld: glints moving over water, cloud shadows drifting
    // across the land (on the other planes their own air and motes instead),
    // and a soft vignette.
  ,
    drawOverworldAmbience(tileGetter, time, plane = 'material') {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const ts = this._tileSize;
      const cx = this._camera.x, cy = this._camera.y;
      const c0 = Math.floor(cx / ts) - 1, r0 = Math.floor(cy / ts) - 1;
      const c1 = Math.ceil((cx + this._width) / ts) + 1, r1 = Math.ceil((cy + this._height) / ts) + 1;
      const WATER = 8;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let r = r0; r <= r1; ++r)
        for (let c = c0; c <= c1; ++c) {
          if (tileGetter(c, r) !== WATER)
            continue;
          // each water tile glints now and then at its own phase
          const h = Math.imul(c * 73856093 ^ r * 19349663, 0x9E3779B1) >>> 0;
          const phase = ((h & 1023) / 1023) * Math.PI * 2;
          const k = Math.sin(time * 1.7 + phase);
          if (k < 0.55)
            continue;
          const gx = Math.floor(c * ts - cx + 4 + (h >>> 10) % (ts - 12));
          const gy = Math.floor(r * ts - cy + 6 + (h >>> 16) % (ts - 12));
          const len = Math.round(2 + (k - 0.55) * 14);
          ctx.globalAlpha = (k - 0.55) * 2;
          ctx.fillRect(gx, gy, len * 2, 2);
          ctx.fillRect(gx + len, gy - 2, 2, 2);
        }
      ctx.globalAlpha = 1;
      const BB = (window.SZ && window.SZ.TacticalRealms && window.SZ.TacticalRealms.BattleBackdrop) || null;
      const tint = plane && plane !== 'material' && BB ? BB.PLANE_TINTS[plane] : null;
      if (tint) {
        ctx.fillStyle = tint.world;
        ctx.fillRect(0, 0, this._width, this._height);
        BB.drawAmbient(ctx, tint.ambient, time, this._width, this._height);
      }
      // cloud shadows live in world space and drift east
      ctx.fillStyle = 'rgba(10,20,40,0.12)';
      if ('filter' in ctx)
        ctx.filter = 'blur(18px)';
      const span = 2400;
      for (let i = 0; i < (tint ? 0 : 5); ++i) {
        const wx = ((i * 977 + time * 18) % span + span) % span;
        const wy = ((i * 613) % 1800);
        // repeat the cloud field so it covers any camera position
        const ox = Math.floor((cx - wx) / span) * span + wx + span - cx;
        const oy = Math.floor((cy - wy) / 1800) * 1800 + wy + 1800 - cy;
        for (const [dx, dy] of [[0, 0], [-span, 0], [0, -1800], [-span, -1800]]) {
          const x = ox + dx, y = oy + dy;
          if (x < -400 || x > this._width + 400 || y < -300 || y > this._height + 300)
            continue;
          ctx.beginPath();
          ctx.ellipse(x, y, 190, 70, 0, 0, Math.PI * 2);
          ctx.ellipse(x + 120, y - 30, 130, 60, 0, 0, Math.PI * 2);
          ctx.ellipse(x - 110, y + 20, 110, 50, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if ('filter' in ctx)
        ctx.filter = 'none';
      const g = ctx.createRadialGradient(this._width / 2, this._height / 2, this._height * 0.45, this._width / 2, this._height / 2, this._height * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.32)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this._width, this._height);
      ctx.restore();
    }

  ,
    _tileColor(type) {
      switch (type) {
        case 1: return '#4a8a3a';
        case 2: return '#2a5a2a';
        case 3: return '#7a6a5a';
        case 4: return '#6a3a4a';
        case 5: return '#b8a868';
        case 6: return '#a89860';
        case 7: return '#5a7a8a';
        case 8: return '#2a4a8a';
        case 9: return '#c8b878';
        case 10: return '#e8eef6';
        case 11: return '#2f5a46';
        case 12: return '#2a6a2a';
        case 13: return '#d8bc80';
        case 14: return '#b0663e';
        case 15: return '#4a5a36';
        case 16: return '#6aa848';
        case 17: return '#c8b05a';
        case 18: return '#a8d0ea';
        case 19: return '#5a5658';
        case 20: return '#e8501a';
        case 21: return '#8a5ad6';
        default: {
          const TR = (window.SZ && window.SZ.TacticalRealms) || {};
          const T = TR.TerrainArt;
          const ground = TR.OverworldGround && TR.OverworldGround[type];
          return ground && T && T.color ? T.color(ground) : '#333';
        }
      }
    }

  ,
  });
})();
