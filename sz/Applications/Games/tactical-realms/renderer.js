;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;
  const DEFAULT_TILE_SIZE = 32;

  function brighten(hex, f) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7)
      return hex;
    const n = parseInt(hex.slice(1), 16);
    const ch = sh => Math.min(255, Math.round(((n >> sh) & 255) * f));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  class Renderer {
    #canvas;
    #ctx;
    #buffer;
    #bufCtx;
    #width;
    #height;
    #tileSize;
    #camera;
    #assets;
    #compositor;
    #lightCanvas = null;

    constructor(canvas, { width, height, tileSize } = {}) {
      this.#width = width || DEFAULT_WIDTH;
      this.#height = height || DEFAULT_HEIGHT;
      this.#tileSize = tileSize || DEFAULT_TILE_SIZE;
      this.#camera = { x: 0, y: 0 };
      this.#assets = null;
      this.#compositor = new TR.SpriteCompositor(1024);

      if (canvas) {
        this.#canvas = canvas;
        canvas.width = this.#width;
        canvas.height = this.#height;
        this.#ctx = canvas.getContext('2d');

        if (typeof OffscreenCanvas !== 'undefined') {
          this.#buffer = new OffscreenCanvas(this.#width, this.#height);
        } else {
          this.#buffer = document.createElement('canvas');
          this.#buffer.width = this.#width;
          this.#buffer.height = this.#height;
        }
        this.#bufCtx = this.#buffer.getContext('2d');
      } else {
        this.#canvas = null;
        this.#ctx = null;
        this.#buffer = null;
        this.#bufCtx = null;
      }
    }

    get width() { return this.#width; }
    get height() { return this.#height; }
    get tileSize() { return this.#tileSize; }

    set assets(loader) { this.#assets = loader; }
    get assets() { return this.#assets; }
    get bufCtx() { return this.#bufCtx; }

    get compositor() { return this.#compositor; }

    #drawTintedSprite(ctx, img, rect, dx, dy, destSize, tint) {
      this.#compositor.drawComposite(ctx, [{ img, rect, tint }], destSize, dx, dy);
    }

    #drawCreatureSprite(ctx, creatureId, category, dx, dy, destSize, animType, direction, frame, flash) {
      const resolver = TR.spriteResolver;
      if (!resolver)
        return false;
      const sprite = resolver.resolve(creatureId, category,
        animType || 'stand', direction || 'down', frame || 0);
      if (!sprite)
        return false;
      ctx.imageSmoothingEnabled = false;
      if (sprite.flip) {
        ctx.save();
        ctx.translate(dx + destSize, dy);
        ctx.scale(-1, 1);
        dx = 0; dy = 0;
      }
      const rect = { x: sprite.srcX, y: sprite.srcY, w: sprite.srcW, h: sprite.srcH };
      // Flash is quantised so the compositor cache holds only a few variants.
      const flashStep = flash > 0 ? Math.ceil(flash * 4) / 4 : 0;
      if (flashStep > 0) {
        const layers = [{ img: sprite.img, rect, tint: sprite.tint || null },
          { img: sprite.img, rect, tint: `rgba(255,255,255,${(flashStep * 0.85).toFixed(2)})` }];
        this.#compositor.drawComposite(ctx, layers, Math.round(destSize), Math.round(dx), Math.round(dy));
      } else if (sprite.tint)
        this.#drawTintedSprite(ctx, sprite.img, rect, Math.round(dx), Math.round(dy), Math.round(destSize), sprite.tint);
      else
        ctx.drawImage(sprite.img, sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH,
          dx, dy, destSize, destSize);
      if (sprite.flip)
        ctx.restore();
      return true;
    }

    get camera() {
      return { x: this.#camera.x, y: this.#camera.y };
    }

    set camera(pos) {
      this.#camera.x = pos.x;
      this.#camera.y = pos.y;
    }

    centerOn(worldX, worldY) {
      this.#camera.x = worldX - Math.floor(this.#width / 2);
      this.#camera.y = worldY - Math.floor(this.#height / 2);
    }

    worldToScreen(worldX, worldY) {
      return {
        x: worldX - this.#camera.x,
        y: worldY - this.#camera.y
      };
    }

    screenToWorld(screenX, screenY) {
      return {
        x: screenX + this.#camera.x,
        y: screenY + this.#camera.y
      };
    }

    isVisible(worldX, worldY, w, h) {
      const sx = worldX - this.#camera.x;
      const sy = worldY - this.#camera.y;
      return sx + w > 0 && sx < this.#width && sy + h > 0 && sy < this.#height;
    }

    beginFrame() {
      if (!this.#bufCtx)
        return;
      this.#bufCtx.clearRect(0, 0, this.#width, this.#height);
    }

    endFrame() {
      if (!this.#ctx || !this.#buffer)
        return;
      this.#ctx.clearRect(0, 0, this.#width, this.#height);
      this.#ctx.drawImage(this.#buffer, 0, 0);
    }


    drawInfiniteMap(tileGetter, dimension) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const ts = this.#tileSize;
      const cx = this.#camera.x;
      const cy = this.#camera.y;
      const startCol = Math.floor(cx / ts) - 1;
      const startRow = Math.floor(cy / ts) - 1;
      const endCol = Math.ceil((cx + this.#width) / ts) + 1;
      const endRow = Math.ceil((cy + this.#height) / ts) + 1;

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const dimSprites = TR.DIMENSION_TERRAIN_SPRITES;
      const spriteMap = (dimension && dimSprites && dimSprites[dimension])
        ? dimSprites[dimension]
        : TR.OVERWORLD_TERRAIN_SPRITES;
      const assets = this.#assets;
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
      for (let r = startRow; r <= endRow; ++r)
        for (let c = startCol; c <= endCol; ++c) {
          const tile = tileGetter(c, r);
          const sx = c * ts - fcx;
          const sy = r * ts - fcy;
          let drawn = false;
          if (sheetImg && tile > 0 && tile < TILE_NAMES.length) {
            // Draw grass base layer for overlay tiles (forest, mountain, etc.)
            if (NEEDS_BASE[tile] && spriteMap) {
              const baseRect = spriteMap.GRASS;
              if (baseRect)
                ctx.drawImage(sheetImg, baseRect.x, baseRect.y, baseRect.w, baseRect.h, sx, sy, tsDraw, tsDraw);
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
            ctx.fillStyle = this.#tileColor(tile);
            ctx.fillRect(sx, sy, tsDraw, tsDraw);
          }
        }
    }

    #tileColor(type) {
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
        default: return '#333';
      }
    }

    drawRect(worldX, worldY, w, h, color) {
      if (!this.#bufCtx)
        return;
      const s = this.worldToScreen(worldX, worldY);
      this.#bufCtx.fillStyle = color;
      this.#bufCtx.fillRect(s.x, s.y, w, h);
    }

    drawText(worldX, worldY, text, { color = '#fff', font = '14px monospace', align = 'left' } = {}) {
      if (!this.#bufCtx)
        return;
      const s = this.worldToScreen(worldX, worldY);
      this.#bufCtx.fillStyle = color;
      this.#bufCtx.font = font;
      this.#bufCtx.textAlign = align;
      this.#bufCtx.fillText(text, s.x, s.y);
    }

    drawScreenText(x, y, text, { color = '#fff', font = '14px monospace', align = 'left' } = {}) {
      if (!this.#bufCtx)
        return;
      this.#bufCtx.fillStyle = color;
      this.#bufCtx.font = font;
      this.#bufCtx.textAlign = align;
      this.#bufCtx.fillText(text, x, y);
    }

    highlightTile(col, row, color) {
      if (!this.#bufCtx)
        return;
      const ts = this.#tileSize;
      const sx = col * ts - this.#camera.x;
      const sy = row * ts - this.#camera.y;
      this.#bufCtx.fillStyle = color || 'rgba(255,255,0,0.3)';
      this.#bufCtx.fillRect(sx, sy, ts, ts);
      this.#bufCtx.strokeStyle = color || 'rgba(255,255,0,0.8)';
      this.#bufCtx.lineWidth = 2;
      this.#bufCtx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
      this.#bufCtx.lineWidth = 1;
    }

    drawPanel(x, y, w, h, { bg = 'rgba(0,0,0,0.85)', border = '#888', radius = 4 } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
    }

    drawButton(x, y, w, h, text, { bg = '#444', hover = false, color = '#fff', font = '14px monospace' } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const SA = (window.SZ && window.SZ.TacticalRealms && window.SZ.TacticalRealms.ScreenArt) || null;
      if (SA) {
        // coloured buttons (green confirm, red leave, ...) keep their hue as an accent stripe
        const accent = bg === '#444' || bg === '#333' ? null : brighten(bg, 2.2);
        SA.button(ctx, x, y, w, h, text, { accent, hover });
        return;
      }
      ctx.fillStyle = hover ? '#666' : bg;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#888';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    drawCharacterCard(x, y, w, h, character, { selected = false, locked = false } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const Character = TR.Character;
      const CLASSES = TR.CLASSES;

      const classDef = CLASSES && CLASSES.find(c => c.id === character.class);
      const classColors = {
        fighter: '#8b4513', wizard: '#4169e1', cleric: '#daa520', rogue: '#2f4f4f',
        ranger: '#228b22', paladin: '#b8860b', barbarian: '#8b0000', bard: '#9370db',
        warlock: '#4b0082', sorcerer: '#dc143c',
      };
      const borderColor = selected ? '#ffd700' : (classColors[character.class] || '#555');

      if (locked) {
        ctx.fillStyle = 'rgba(40,40,40,0.9)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = 'bold 28px serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u{1f512}', x + w / 2, y + h / 2 - 10);
        ctx.font = '13px monospace';
        ctx.fillText('Seasonal', x + w / 2, y + h / 2 + 20);
        ctx.textAlign = 'left';
        return;
      }

      ctx.fillStyle = '#1a1e2a';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();

      if (selected) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1;

      let cy = y + 14;
      const cx = x + w / 2;
      const pad = 10;

      const SA = TR.ScreenArt;
      if (SA && TR.BattleSprites) {
        // the hero on a little stage, idling
        const pw = w - 20, ph = 100;
        const px = x + 10, py = cy - 4;
        const g = ctx.createLinearGradient(0, py, 0, py + ph);
        g.addColorStop(0, '#2c3a60');
        g.addColorStop(0.72, '#1a2240');
        g.addColorStop(0.72, '#3a3024');
        g.addColorStop(1, '#241c14');
        ctx.fillStyle = g;
        ctx.fillRect(px, py, pw, ph);
        const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
        ctx.save();
        ctx.beginPath();
        ctx.rect(px, py, pw, ph);
        ctx.clip();
        // feet below the stage: head to waist fills it, like a portrait
        TR.BattleSprites.draw(ctx, SA.asUnit(character), 'idle', (t * 0.8) % 1, cx, SA.bustFootY(character, py, 144, 8), 144, 1);
        ctx.restore();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, ph);
        ctx.lineWidth = 1;
        cy += ph + 12;
      } else {
        cy += 8;
      }

      ctx.fillStyle = '#e8d8a0';
      ctx.font = 'bold 15px serif';
      ctx.textAlign = 'center';
      ctx.fillText(character.name, cx, cy);
      cy += 18;

      const raceName = character.race.charAt(0).toUpperCase() + character.race.slice(1).replace('-', ' ');
      const className = classDef ? classDef.name : character.class;
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText(`${raceName} ${className}`, cx, cy);
      cy += 20;

      const abilities = [
        { key: 'str', label: 'STR' }, { key: 'dex', label: 'DEX' }, { key: 'con', label: 'CON' },
        { key: 'int', label: 'INT' }, { key: 'wis', label: 'WIS' }, { key: 'cha', label: 'CHA' },
      ];
      const colW = Math.floor((w - pad * 2) / 3);
      for (let i = 0; i < abilities.length; ++i) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const ax = x + pad + col * colW + colW / 2;
        const ay = cy + row * 30;
        const score = character.stats[abilities[i].key];
        const mod = Character ? Character.abilityMod(score) : 0;
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        ctx.fillText(abilities[i].label, ax, ay);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`${score}`, ax - 9, ay + 15);
        ctx.fillStyle = mod > 0 ? '#4c4' : mod < 0 ? '#c44' : '#888';
        ctx.font = '11px monospace';
        ctx.fillText(modStr, ax + 9, ay + 15);
      }
      cy += 66;

      const barW = w - pad * 2;
      const barH = 9;

      ctx.fillStyle = '#333';
      ctx.fillRect(x + pad, cy, barW, barH);
      const hpRatio = character.maxHp > 0 ? Math.min(1, character.hp / character.maxHp) : 0;
      ctx.fillStyle = '#4a4';
      ctx.fillRect(x + pad, cy, barW * hpRatio, barH);
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`HP ${character.hp}/${character.maxHp}`, x + pad, cy - 2);
      cy += barH + 16;

      if (character.maxMp > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x + pad, cy, barW, barH);
        const mpRatio = Math.min(1, character.mp / character.maxMp);
        ctx.fillStyle = '#44a';
        ctx.fillRect(x + pad, cy, barW * mpRatio, barH);
        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        ctx.fillText(`MP ${character.mp}/${character.maxMp}`, x + pad, cy - 2);
        cy += barH + 16;
      }

      ctx.fillStyle = '#999';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`AC ${character.ac}  BAB +${character.bab}  Spd ${character.speed}  Init ${character.initiative >= 0 ? '+' : ''}${character.initiative}`, cx, cy);

      ctx.textAlign = 'left';
    }

    drawCombatGrid(grid, tileSize, offsetX, offsetY, biome, dimension) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this.#assets;
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
          const art = t && TR.TerrainArt && TR.TerrainArt.has(t.id) ? TR.TerrainArt.rect(t.id, c, r) : null;
          const artImg = art && assets ? assets.get('terrain') : null;
          if (art && artImg) {
            ctx.drawImage(artImg, art.x, art.y, art.w, art.h, sx, sy, tileSize, tileSize);
            this.#drawTerrainEdges(ctx, grid, c, r, t.id, sx, sy, tileSize);
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
                this.#compositor.drawComposite(ctx, layers, tileSize, sx, sy);
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
    // Flagstone floors read as raised slabs: a dark lip where they meet
    // rougher ground below or to the right, a light one above or left.
    #drawTerrainEdges(ctx, grid, c, r, id, sx, sy, ts) {
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
    drawLighting(x, y, w, h, lights, time = 0, darkness = 0.62) {
      if (!this.#bufCtx || typeof document === 'undefined')
        return;
      if (!this.#lightCanvas || this.#lightCanvas.width !== Math.ceil(w) || this.#lightCanvas.height !== Math.ceil(h)) {
        this.#lightCanvas = document.createElement('canvas');
        this.#lightCanvas.width = Math.ceil(w);
        this.#lightCanvas.height = Math.ceil(h);
      }
      const lc = this.#lightCanvas.getContext('2d');
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
      const ctx = this.#bufCtx;
      ctx.drawImage(this.#lightCanvas, x, y);
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

    drawUnitToken(col, row, unit, tileSize, offsetX, offsetY, { active = false, dead = false, fx = null, time = 0 } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
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
      const spriteDrawn = this.#drawCreatureSprite(ctx, classId, isParty ? 'party' : 'enemy', sx, sy, size,
        null, null, null, fx && !dead ? fx.flash : (dying ? 0.5 * (1 - fx.alpha) : 0));

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
        const ay = dy - ts * 0.02 - hop;
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

    drawUnitTokenAt(col, row, unit, tileSize, offsetX, offsetY, { active = false, fx = null, time = 0 } = {}) {
      this.drawUnitToken(col, row, unit, tileSize, offsetX, offsetY, { active, dead: false, fx, time });
    }

    highlightTiles(tiles, tileSize, offsetX, offsetY, color) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      ctx.fillStyle = color || 'rgba(80,140,255,0.3)';
      for (const [key] of tiles) {
        const [c, r] = key.split(',').map(Number);
        ctx.fillRect(offsetX + c * tileSize, offsetY + r * tileSize, tileSize, tileSize);
      }
    }

    highlightAttackTargets(targets, units, tileSize, offsetX, offsetY) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      ctx.fillStyle = 'rgba(255,60,60,0.35)';
      for (const tid of targets) {
        const u = units.find(u => u.id === tid);
        if (!u)
          continue;
        const pos = u.position;
        ctx.fillRect(offsetX + pos.col * tileSize, offsetY + pos.row * tileSize, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(255,60,60,0.8)';
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX + pos.col * tileSize + 1, offsetY + pos.row * tileSize + 1, tileSize - 2, tileSize - 2);
        ctx.lineWidth = 1;
      }
    }





    drawTooltip(x, y, lines) {
      if (!this.#bufCtx || !lines || lines.length === 0)
        return;
      const ctx = this.#bufCtx;
      ctx.font = '13px monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const lineH = 18;
      const pad = 8;
      let maxW = 0;
      for (const l of lines)
        maxW = Math.max(maxW, ctx.measureText(l).width);
      const w = maxW + pad * 2;
      const h = lines.length * lineH + pad * 2;

      const tx = Math.min(x, this.#width - w - 4);
      const ty = Math.min(y, this.#height - h - 4);

      ctx.fillStyle = 'rgba(10,10,20,0.95)';
      ctx.fillRect(tx, ty, w, h);
      ctx.strokeStyle = '#888';
      ctx.strokeRect(tx, ty, w, h);

      ctx.fillStyle = '#ddd';
      for (let i = 0; i < lines.length; ++i)
        ctx.fillText(lines[i], tx + pad, ty + pad + 12 + i * lineH);
    }

    drawContextMenu(x, y, items, hoverIndex) {
      if (!this.#bufCtx || !items || items.length === 0)
        return;
      const ctx = this.#bufCtx;
      const itemH = 28;
      const menuW = 200;
      const padY = 4;
      const h = items.length * itemH + padY * 2;

      const mx = Math.min(x, this.#width - menuW - 4);
      const my = Math.min(y, this.#height - h - 4);

      ctx.fillStyle = 'rgba(10,10,20,0.95)';
      ctx.fillRect(mx, my, menuW, h);
      ctx.strokeStyle = '#888';
      ctx.strokeRect(mx, my, menuW, h);

      ctx.font = '13px monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      for (let i = 0; i < items.length; ++i) {
        const iy = my + padY + i * itemH;
        if (i === hoverIndex) {
          ctx.fillStyle = 'rgba(80,120,200,0.5)';
          ctx.fillRect(mx + 1, iy, menuW - 2, itemH);
        }
        const icon = items[i].action === 'attack' ? '\u2694 ' : '\u2728 ';
        ctx.fillStyle = '#ddd';
        ctx.fillText(icon + items[i].label, mx + 8, iy + 19);
      }
    }



    drawScreenRect(x, y, w, h, color) {
      if (!this.#bufCtx)
        return;
      this.#bufCtx.fillStyle = color;
      this.#bufCtx.fillRect(x, y, w, h);
    }

    drawAoeRadius(ox, oy, ts, centerCol, centerRow, radius, gridCols, gridRows, fillColor) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;

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




    drawTitleScreen(time) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;
      const t = Math.max(0, time);
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const SA = TR.ScreenArt;

      if (SA) {
        // dusk over the mountains, the heroes waiting on the road
        SA.stage(ctx, 'mountain', 'material', t, { pan: Math.sin(t * 0.08) * 160 });
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#c88a78';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        const heroes = [
          { name: 'Paladin', class: 'paladin', race: 'human' },
          { name: 'Wizard', class: 'wizard', race: 'elf' },
          { name: 'Ranger', class: 'ranger', race: 'halfling' },
          { name: 'Barbarian', class: 'barbarian', race: 'half_orc' },
          { name: 'Cleric', class: 'cleric', race: 'dwarf' },
        ];
        SA.partyLine(ctx, heroes, { x: w / 2, footY: h - 64, spacing: 150, height: 216, time: t, facing: 1 });
        SA.vignette(ctx, 0.6);
      } else {
        ctx.fillStyle = '#0a0a1e';
        ctx.fillRect(0, 0, w, h);
      }

      const midX = w / 2;
      const rise = Math.min(1, t * 1.5);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = "bold 76px Georgia, 'Times New Roman', serif";
      const ty = 150 - (1 - rise) * 30;
      ctx.globalAlpha = rise;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#1a0e08';
      ctx.strokeText('TACTICAL REALMS', midX, ty);
      const g = ctx.createLinearGradient(0, ty - 64, 0, ty + 6);
      g.addColorStop(0, '#fff4c0');
      g.addColorStop(0.5, '#f0c050');
      g.addColorStop(1, '#a86a18');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(255,200,80,0.6)';
      ctx.shadowBlur = 18 + Math.sin(t * 2) * 6;
      ctx.fillText('TACTICAL REALMS', midX, ty);
      ctx.shadowBlur = 0;
      ctx.font = "italic 24px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1a0e08';
      ctx.strokeText('A Tactical RPG Adventure', midX, ty + 46);
      ctx.fillStyle = '#f0e6d0';
      ctx.fillText('A Tactical RPG Adventure', midX, ty + 46);
      ctx.restore();
    }

    drawVictoryScreen(party, xpGained, goldGained, progress, { time = 0, biome = 'plains', plane = 'material' } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;
      const p = Math.min(1, Math.max(0, progress));
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const SA = TR.ScreenArt;
      const midX = w / 2;

      if (SA) {
        SA.stage(ctx, biome, plane, time);
        // the party cheers: arms up, hopping
        SA.partyLine(ctx, party, {
          x: midX, footY: h - 12, spacing: 200, height: 144, time, hop: 10,
          pose: i => ({ pose: 'cast', p: 0.6 + 0.4 * Math.abs(Math.sin(time * 4 + i)) }),
        });
        SA.vignette(ctx, 0.45);
        SA.frame(ctx, midX - 330, 206, 660, 330, { alpha: 0.88 });
        SA.confetti(ctx, time);
      } else {
        ctx.fillStyle = '#1a2a0a';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.textAlign = 'center';
      const pop = Math.min(1, time * 3);
      ctx.translate(midX, 120);
      ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
      ctx.font = "900 78px Georgia, 'Times New Roman', serif";
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#1a0e08';
      ctx.strokeText('VICTORY!', 0, 0);
      const g = ctx.createLinearGradient(0, -64, 0, 6);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(0.5, '#ffd24a');
      g.addColorStop(1, '#c87a10');
      ctx.fillStyle = g;
      ctx.fillText('VICTORY!', 0, 0);
      ctx.restore();

      // the controller lists the rewards inside the panel; this bar fills with them
      const barW = 360, barH = 8, barX = midX - barW / 2;
      ctx.fillStyle = '#0a0610';
      ctx.fillRect(barX - 1, 223, barW + 2, barH + 2);
      ctx.fillStyle = '#46d468';
      ctx.fillRect(barX, 224, barW * p, barH);
    }

    drawDefeatScreen(time, { party = null, biome = 'plains', plane = 'material' } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;
      const t = Math.max(0, time);
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const SA = TR.ScreenArt;
      const midX = w / 2;

      if (SA) {
        SA.stage(ctx, biome, plane, t, { dim: 0.35 });
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#8a3a3a';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        if (party)
          SA.partyLine(ctx, party, {
            x: midX, footY: h - 86, spacing: 200, height: 180, time: t, facing: 1,
            pose: () => ({ pose: 'down', p: 1, opts: { rotate: -1.35, alpha: 0.85 } }),
          });
        SA.vignette(ctx, 0.8, '20,0,0');
      } else {
        ctx.fillStyle = '#1a0a0a';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, t * 0.8);
      ctx.font = "900 76px Georgia, 'Times New Roman', serif";
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#0a0404';
      ctx.strokeText('DEFEAT', midX, 220);
      ctx.fillStyle = '#d84a3a';
      ctx.fillText('DEFEAT', midX, 220);
      ctx.font = "italic 22px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 6;
      ctx.strokeText('Your party has fallen...', midX, 270);
      ctx.fillStyle = '#e0d0c8';
      ctx.fillText('Your party has fallen...', midX, 270);
      ctx.restore();
    }

    drawImage(image, x, y, w, h) {
      if (!this.#bufCtx || !image)
        return;
      this.#bufCtx.drawImage(image, x, y, w, h);
    }




  }

  TR.Renderer = Renderer;
})();
