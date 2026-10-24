/* The battle field: grid, terrain edges, lighting, unit tokens and the movement/attack highlights. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const Renderer = TR.Renderer;

  Object.assign(Renderer.prototype, {
    drawCombatGrid(grid, tileSize, offsetX, offsetY, biome, dimension, theme = null) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this._assets;
      const isDungeon = biome === 'dungeon' || biome === 'ruins' || biome === 'cave';
      const sheetId = isDungeon ? 'dungeon' : 'overworld';
      const hasSheet = assets && assets.ready && assets.has(sheetId);
      const sheetImg = hasSheet ? assets.get(sheetId) : null;
      const dungeonImg = (assets && assets.ready && assets.has('dungeon')) ? assets.get('dungeon') : null;

      ctx.imageSmoothingEnabled = false;
      for (let r = 0; r < grid.rows; ++r)
        for (let c = 0; c < grid.cols; ++c) {
          const t = grid.terrainAt(c, r);
          const sx = offsetX + c * tileSize;
          const sy = offsetY + r * tileSize;
          let drawn = false;

          // hand-painted underground tiles, varied per cell
          const isWall = theme && t && t.id === theme.wallTerrain;
          const artId = !t ? null : isWall ? theme.wallArt : theme && t.id === theme.floorTerrain ? theme.floorArt : t.id;
          const art = artId && TR.TerrainArt && TR.TerrainArt.has(artId) ? TR.TerrainArt.rect(artId, c, r) : null;
          const artImg = art && assets ? assets.get('terrain') : null;
          if (art && artImg) {
            ctx.drawImage(artImg, art.x, art.y, art.w, art.h, sx, sy, tileSize, tileSize);
            if (isWall) {
              // buried rock shows its dark top, rock above open floor its face
              const below = grid.inBounds(c, r + 1) ? grid.terrainIdAt(c, r + 1) : t.id;
              ctx.fillStyle = below === t.id ? 'rgba(8,6,14,0.72)' : 'rgba(0,0,0,0.25)';
              ctx.fillRect(sx, sy, tileSize, below === t.id ? tileSize : Math.round(tileSize * 0.18));
              continue;
            }
            if (theme && grid.inBounds(c, r - 1) && grid.terrainIdAt(c, r - 1) === theme.wallTerrain) {
              ctx.fillStyle = 'rgba(0,0,0,0.32)';
              ctx.fillRect(sx, sy, tileSize, Math.round(tileSize * 0.22));
            }
            this._drawTerrainEdges(ctx, grid, c, r, t.id, sx, sy, tileSize);
            // trees, rocks and reeds stand on the painted ground
            const layers = TR.TERRAIN_LAYERS && TR.TERRAIN_LAYERS[t.id];
            if (layers && layers.length > 1)
              for (const def of layers.slice(1)) {
                const rect = TR.resolveSprite ? TR.resolveSprite(def.sprite, 'combat_terrain') : null;
                const img = rect && assets.has(rect.sheet || 'dungeon') ? assets.get(rect.sheet || 'dungeon') : null;
                if (img)
                  ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, sx, sy, tileSize, tileSize);
              }
            continue;
          }

          if (t) {
            const terrainLayers = TR.TERRAIN_LAYERS && TR.TERRAIN_LAYERS[t.id];
            if (terrainLayers) {
              const layers = [];
              for (const def of terrainLayers) {
                const rect = TR.resolveSprite ? TR.resolveSprite(def.sprite, 'combat_terrain') : null;
                if (!rect)
                  continue;
                const lSheet = rect.sheet || 'dungeon';
                const img = assets && assets.has(lSheet) ? assets.get(lSheet) : null;
                if (img)
                  layers.push({ img, rect, tint: def.tint || null });
              }
              if (layers.length > 0) {
                this._compositor.drawComposite(ctx, layers, tileSize, sx, sy);
                drawn = true;
              }
            }

            if (!drawn) {
              const rect = TR.resolveSprite ? TR.resolveSprite(t.id, 'combat_terrain') : (TR.COMBAT_TERRAIN_SPRITES && TR.COMBAT_TERRAIN_SPRITES[t.id]);
              if (rect) {
                const rSheet = (rect.sheet) || 'dungeon';
                const useSheet = rSheet === sheetId ? sheetImg : (assets && assets.has(rSheet) ? assets.get(rSheet) : null);
                if (useSheet) {
                  ctx.drawImage(useSheet, rect.x, rect.y, rect.w, rect.h, sx, sy, tileSize, tileSize);
                  drawn = true;
                } else if (sheetImg) {
                  ctx.drawImage(sheetImg, rect.x, rect.y, rect.w, rect.h, sx, sy, tileSize, tileSize);
                  drawn = true;
                } else if (dungeonImg) {
                  ctx.drawImage(dungeonImg, rect.x, rect.y, rect.w, rect.h, sx, sy, tileSize, tileSize);
                  drawn = true;
                }
              }
            }
          }

          if (!drawn) {
            ctx.fillStyle = t ? t.color : '#333';
            ctx.fillRect(sx, sy, tileSize, tileSize);
          }
        }
    }

    // fx: optional CombatFx.unitState() result ({ dx, dy, flash, alpha, tint }).
    // Faint cell lines so distances stay readable on painted ground.
  ,
    drawGridLines(cols, rows, tileSize, offsetX, offsetY) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 1; c < cols; ++c) {
        const x = Math.round(offsetX + c * tileSize) + 0.5;
        ctx.moveTo(x, offsetY);
        ctx.lineTo(x, offsetY + rows * tileSize);
      }
      for (let r = 1; r < rows; ++r) {
        const y = Math.round(offsetY + r * tileSize) + 0.5;
        ctx.moveTo(offsetX, y);
        ctx.lineTo(offsetX + cols * tileSize, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Flagstone floors read as raised slabs: a dark lip where they meet
    // rougher ground below or to the right, a light one above or left.
  ,
    _drawTerrainEdges(ctx, grid, c, r, id, sx, sy, ts) {
      if (id !== 'dungeon_floor' && id !== 'ruins')
        return;
      const lip = Math.max(2, Math.round(ts / 16) * 2);
      const other = (cc, rr) => grid.inBounds(cc, rr) && grid.terrainIdAt(cc, rr) !== id;
      ctx.fillStyle = 'rgba(10,6,12,0.45)';
      if (other(c, r + 1))
        ctx.fillRect(sx, sy + ts - lip, ts, lip);
      if (other(c + 1, r))
        ctx.fillRect(sx + ts - lip, sy, lip, ts);
      ctx.fillStyle = 'rgba(255,240,220,0.14)';
      if (other(c, r - 1))
        ctx.fillRect(sx, sy, ts, lip / 2);
      if (other(c - 1, r))
        ctx.fillRect(sx, sy, lip / 2, ts);
    }

    // Underground darkness with torch-light around each light source.
    // lights: [{ x, y, radius }] in screen pixels.
  ,
    drawLighting(x, y, w, h, lights, time = 0, darkness = 0.62) {
      if (!this._bufCtx || typeof document === 'undefined')
        return;
      if (!this._lightCanvas || this._lightCanvas.width !== Math.ceil(w) || this._lightCanvas.height !== Math.ceil(h)) {
        this._lightCanvas = document.createElement('canvas');
        this._lightCanvas.width = Math.ceil(w);
        this._lightCanvas.height = Math.ceil(h);
      }
      const lc = this._lightCanvas.getContext('2d');
      if (!lc)
        return;
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, w, h);
      lc.fillStyle = `rgba(6,4,16,${darkness})`;
      lc.fillRect(0, 0, w, h);
      lc.globalCompositeOperation = 'destination-out';
      lights.forEach((l, i) => {
        const flick = 1 + 0.04 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i);
        const rad = l.radius * flick;
        const g = lc.createRadialGradient(l.x - x, l.y - y, rad * 0.15, l.x - x, l.y - y, rad);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = g;
        lc.fillRect(l.x - x - rad, l.y - y - rad, rad * 2, rad * 2);
      });
      const ctx = this._bufCtx;
      ctx.drawImage(this._lightCanvas, x, y);
      // warm tint where the light falls
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      lights.forEach(l => {
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.radius * 0.8);
        g.addColorStop(0, 'rgba(255,150,60,0.10)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(l.x - l.radius, l.y - l.radius, l.radius * 2, l.radius * 2);
      });
      ctx.restore();
    }

  ,
    drawUnitToken(col, row, unit, tileSize, offsetX, offsetY, { active = false, dead = false, fx = null, time = 0 } = {}) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const ts = tileSize;
      const dx = offsetX + col * ts + (fx ? fx.dx : 0);
      const dy = offsetY + row * ts + (fx ? fx.dy : 0);
      const cx = dx + ts / 2;
      const footY = dy + ts * 0.9;
      const isParty = unit.faction === 'party';
      // A unit killed this turn fades out (fx.dying); older corpses stay faint.
      const dying = dead && fx && fx.dying;
      const alpha = dead ? (dying ? fx.alpha : 0.28) : (fx ? fx.alpha : 1);

      ctx.save();
      ctx.globalAlpha = alpha;

      // ground shadow and faction base ring
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath();
      ctx.ellipse(cx, footY, ts * 0.32, ts * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!dead || dying) {
        ctx.strokeStyle = isParty ? 'rgba(90,170,255,0.85)' : 'rgba(255,90,80,0.85)';
        ctx.lineWidth = Math.max(1.5, ts * 0.04);
        ctx.beginPath();
        ctx.ellipse(cx, footY, ts * 0.36, ts * 0.13, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (active) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 5);
        ctx.strokeStyle = `rgba(255,215,90,${(0.55 + 0.45 * pulse).toFixed(3)})`;
        ctx.lineWidth = Math.max(2, ts * 0.05);
        ctx.beginPath();
        ctx.ellipse(cx, footY, ts * (0.4 + 0.04 * pulse), ts * (0.15 + 0.015 * pulse), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // idle bob, desynchronised per unit
      let seed = 0;
      for (let i = 0; i < unit.id.length; ++i)
        seed = (seed * 31 + unit.id.charCodeAt(i)) | 0;
      const bob = dead ? 0 : Math.round(Math.sin(time * 3.2 + (seed % 628) / 100) * ts * 0.035);
      const size = ts - 4;
      const sx = dx + 2;
      const sy = dy + 2 - ts * 0.06 + bob;

      const classId = unit.character ? unit.character.class : null;
      const flash = fx && !dead ? fx.flash : (dying ? 0.5 * (1 - fx.alpha) : 0);
      let spriteDrawn = false;
      let headY = dy;
      // heroes and humanoid foes use the same doll as in the battle scenes
      const BS = TR.BattleSprites;
      if (BS && BS.hasDoll(unit)) {
        const art = BS.ART_H;
        const h = Math.max(art, Math.floor(ts / art) * art);
        const look = BS.lookFor(unit);
        headY = dy + ts * 0.94 + bob - 60 * (look.scale || 1) * (h / art);
        BS.draw(ctx, unit, 'idle', (time * 0.8 + (seed % 100) / 100) % 1, cx, dy + ts * 0.94 + bob, h, isParty ? 1 : -1, { flash });
        spriteDrawn = true;
      } else
        spriteDrawn = this._drawCreatureSprite(ctx, classId, isParty ? 'party' : 'enemy', sx, sy, size,
          null, null, null, flash);

      if (!spriteDrawn) {
        ctx.fillStyle = dead ? '#444' : (isParty ? '#4488cc' : '#cc4444');
        ctx.beginPath();
        ctx.arc(cx, dy + ts / 2 + bob, ts * 0.36, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, ts * 0.3) | 0}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.name.charAt(0).toUpperCase(), cx, dy + ts / 2 + bob);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      if (fx && fx.tint && !dead) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = fx.tint;
        ctx.beginPath();
        ctx.ellipse(cx, dy + ts * 0.5, ts * 0.42, ts * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();

      // active marker: bouncing chevron above the head
      if (active && !dead) {
        const hop = Math.abs(Math.sin(time * 4)) * ts * 0.08;
        const ay = Math.min(dy, headY) - ts * 0.04 - hop;
        const aw = ts * 0.14;
        ctx.fillStyle = '#ffd75a';
        ctx.strokeStyle = '#3a2a08';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - aw, ay - aw);
        ctx.lineTo(cx + aw, ay - aw);
        ctx.lineTo(cx, ay + aw * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // conditions in effect: small badges, statues turn grey
      const conds = !dead && unit.conditions ? unit.conditions : null;
      if (conds && conds.length) {
        const BADGES = { paralyzed: '#f0e080', stunned: '#ffd24a', petrified: '#a8a29a', sickened: '#7ac85a', shaken: '#c8a0ff',
          confused: '#ff8ad8', entangled: '#8ad84a', grappled: '#e8a870', energy_drained: '#b88ae8', fatigued: '#c8b8a0', slowed: '#7ab0ff', unconscious: '#8a8ad8' };
        if (conds.includes('petrified')) {
          ctx.save();
          ctx.globalCompositeOperation = 'saturation';
          ctx.fillStyle = '#808080';
          ctx.fillRect(dx + 2, dy + 2, ts - 4, ts - 4);
          ctx.restore();
        }
        [...new Set(conds)].slice(0, 4).forEach((c, i) => {
          ctx.fillStyle = '#140a18';
          ctx.beginPath();
          ctx.arc(dx + ts - 6 - i * 9, dy + 7, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = BADGES[c] || '#ffffff';
          ctx.beginPath();
          ctx.arc(dx + ts - 6 - i * 9, dy + 7, 3.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (!dead && unit.currentHp < unit.maxHp) {
        const barW = ts * 0.7;
        const barH = Math.max(3, ts * 0.07);
        const bx = cx - barW / 2;
        const by = dy + ts - barH - 1;
        const ratio = Math.max(0, unit.currentHp / unit.maxHp);
        ctx.fillStyle = 'rgba(10,6,14,0.85)';
        ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#3a1010';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = ratio > 0.5 ? '#48d060' : ratio > 0.25 ? '#e0c040' : '#e04838';
        ctx.fillRect(bx, by, barW * ratio, barH);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(bx, by, barW * ratio, Math.max(1, barH * 0.35));
      }
    }

  ,
    drawUnitTokenAt(col, row, unit, tileSize, offsetX, offsetY, { active = false, fx = null, time = 0 } = {}) {
      this.drawUnitToken(col, row, unit, tileSize, offsetX, offsetY, { active, dead: false, fx, time });
    }

    // Reachable area: soft inset fill with a bright outline along its rim.
  ,
    highlightTiles(tiles, tileSize, offsetX, offsetY, color) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const fill = color || 'rgba(80,140,255,0.3)';
      const rim = fill.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgba($1,$2,$3,0.95)');
      const set = new Set();
      for (const [key] of tiles)
        set.add(key);
      const ts = tileSize;
      ctx.save();
      ctx.fillStyle = fill;
      for (const key of set) {
        const [c, r] = key.split(',').map(Number);
        ctx.fillRect(offsetX + c * ts + 2, offsetY + r * ts + 2, ts - 4, ts - 4);
      }
      ctx.strokeStyle = rim;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const key of set) {
        const [c, r] = key.split(',').map(Number);
        const x = offsetX + c * ts, y = offsetY + r * ts;
        if (!set.has(`${c},${r - 1}`)) { ctx.moveTo(x, y + 1); ctx.lineTo(x + ts, y + 1); }
        if (!set.has(`${c},${r + 1}`)) { ctx.moveTo(x, y + ts - 1); ctx.lineTo(x + ts, y + ts - 1); }
        if (!set.has(`${c - 1},${r}`)) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + ts); }
        if (!set.has(`${c + 1},${r}`)) { ctx.moveTo(x + ts - 1, y); ctx.lineTo(x + ts - 1, y + ts); }
      }
      ctx.stroke();
      ctx.restore();
    }

    // Attackable foes: a red glow under them and pulsing corner brackets.
  ,
    highlightAttackTargets(targets, units, tileSize, offsetX, offsetY, time = 0) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const ts = tileSize;
      const pulse = 0.5 + 0.5 * Math.sin(time * 6);
      const inset = 2 + pulse * ts * 0.06;
      const arm = ts * 0.28;
      ctx.save();
      for (const tid of targets) {
        const u = units.find(u => u.id === tid);
        if (!u)
          continue;
        const x = offsetX + u.position.col * ts, y = offsetY + u.position.row * ts;
        ctx.fillStyle = `rgba(255,60,50,${(0.18 + 0.12 * pulse).toFixed(3)})`;
        ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
        ctx.strokeStyle = '#ff5a48';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const [cx, cy, sx, sy] of [[x + inset, y + inset, 1, 1], [x + ts - inset, y + inset, -1, 1], [x + inset, y + ts - inset, 1, -1], [x + ts - inset, y + ts - inset, -1, -1]]) {
          ctx.moveTo(cx, cy + sy * arm);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + sx * arm, cy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }





  ,
    drawAoeRadius(ox, oy, ts, centerCol, centerRow, radius, gridCols, gridRows, fillColor) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;

      for (let r = 0; r < gridRows; ++r)
        for (let c = 0; c < gridCols; ++c) {
          const dist = Math.abs(c - centerCol) + Math.abs(r - centerRow);
          if (dist > radius)
            continue;
          const tx = ox + c * ts;
          const ty = oy + r * ts;

          const falloff = 1 - (dist / (radius + 1)) * 0.5;
          const alpha = 0.2 + 0.3 * falloff;
          ctx.fillStyle = fillColor.replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
          ctx.fillRect(tx, ty, ts, ts);

          if (dist === radius) {
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 2;
            ctx.strokeRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
        }

      if (radius >= 2) {
        for (let band = 1; band < radius; ++band)
          for (let r = 0; r < gridRows; ++r)
            for (let c = 0; c < gridCols; ++c) {
              const dist = Math.abs(c - centerCol) + Math.abs(r - centerRow);
              if (dist !== band)
                continue;
              const tx = ox + c * ts;
              const ty = oy + r * ts;
              ctx.strokeStyle = `rgba(255,255,255,${(0.3 + 0.2 * (1 - band / radius)).toFixed(2)})`;
              ctx.lineWidth = 1;
              ctx.strokeRect(tx + 1, ty + 1, ts - 2, ts - 2);
            }
      }
    }




  ,
  });
})();
