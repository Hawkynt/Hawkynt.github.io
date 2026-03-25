;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;
  const DEFAULT_TILE_SIZE = 32;

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
    #tintCache;
    #tintStage;
    #tintStageCtx;
    #corsBlocked;

    constructor(canvas, { width, height, tileSize } = {}) {
      this.#width = width || DEFAULT_WIDTH;
      this.#height = height || DEFAULT_HEIGHT;
      this.#tileSize = tileSize || DEFAULT_TILE_SIZE;
      this.#camera = { x: 0, y: 0 };
      this.#assets = null;
      this.#tintCache = new Map();
      this.#tintStage = null;
      this.#tintStageCtx = null;
      this.#corsBlocked = false;

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

    #ensureTintStage(size) {
      if (this.#tintStage && this.#tintStage.width >= size && this.#tintStage.height >= size)
        return;
      if (typeof OffscreenCanvas !== 'undefined')
        this.#tintStage = new OffscreenCanvas(size, size);
      else {
        this.#tintStage = document.createElement('canvas');
        this.#tintStage.width = size;
        this.#tintStage.height = size;
      }
      this.#tintStageCtx = this.#tintStage.getContext('2d');
    }

    #drawTintedSprite(ctx, img, rect, dx, dy, destSize, tint) {
      const cacheKey = `${rect.sheet||'dungeon'},${rect.x},${rect.y},${rect.w},${rect.h},${destSize},${tint}`;
      const cached = this.#tintCache.get(cacheKey);
      if (cached) {
        ctx.drawImage(cached, dx, dy);
        return;
      }

      if (!this.#corsBlocked) {
        try {
          this.#ensureTintStage(destSize);
          const stage = this.#tintStageCtx;
          stage.clearRect(0, 0, destSize, destSize);
          stage.imageSmoothingEnabled = false;
          stage.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, destSize, destSize);
          stage.globalCompositeOperation = 'source-atop';
          stage.fillStyle = tint;
          stage.fillRect(0, 0, destSize, destSize);
          stage.globalCompositeOperation = 'source-over';

          if (typeof OffscreenCanvas !== 'undefined') {
            const cache = new OffscreenCanvas(destSize, destSize);
            cache.getContext('2d').drawImage(this.#tintStage, 0, 0);
            this.#tintCache.set(cacheKey, cache);
          } else {
            const cache = document.createElement('canvas');
            cache.width = destSize;
            cache.height = destSize;
            cache.getContext('2d').drawImage(this.#tintStage, 0, 0);
            this.#tintCache.set(cacheKey, cache);
          }

          ctx.drawImage(this.#tintStage, 0, 0, destSize, destSize, dx, dy, destSize, destSize);
          return;
        } catch (_) {
          this.#corsBlocked = true;
        }
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx, dy, destSize, destSize);
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tint;
      ctx.fillRect(dx, dy, destSize, destSize);
      ctx.restore();
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

    drawTileMap(data, cols, rows) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const ts = this.#tileSize;
      const cx = this.#camera.x;
      const cy = this.#camera.y;
      const startCol = Math.max(0, Math.floor(cx / ts));
      const startRow = Math.max(0, Math.floor(cy / ts));
      const endCol = Math.min(cols, Math.ceil((cx + this.#width) / ts));
      const endRow = Math.min(rows, Math.ceil((cy + this.#height) / ts));

      ctx.imageSmoothingEnabled = false;
      for (let r = startRow; r < endRow; ++r) {
        for (let c = startCol; c < endCol; ++c) {
          const tile = data[r * cols + c];
          if (tile === 0)
            continue;
          const sx = c * ts - cx;
          const sy = r * ts - cy;
          ctx.fillStyle = this.#tileColor(tile);
          ctx.fillRect(sx, sy, ts, ts);
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.strokeRect(sx, sy, ts, ts);
        }
      }
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

      const computeBitmask = TR.computeBitmask;
      const getAutotileRect = TR.getAutotileRect;

      ctx.imageSmoothingEnabled = false;
      for (let r = startRow; r <= endRow; ++r)
        for (let c = startCol; c <= endCol; ++c) {
          const tile = tileGetter(c, r);
          const sx = c * ts - cx;
          const sy = r * ts - cy;
          let drawn = false;
          if (sheetImg && tile > 0 && tile < TILE_NAMES.length) {
            let rect = null;
            if (computeBitmask && getAutotileRect) {
              const mask = computeBitmask(c, r, tileGetter, tile);
              rect = getAutotileRect(tile, mask);
            }
            if (!rect && spriteMap)
              rect = spriteMap[TILE_NAMES[tile]];
            if (rect) {
              ctx.drawImage(sheetImg, rect.x, rect.y, rect.w, rect.h, sx, sy, ts, ts);
              drawn = true;
            }
          }
          if (!drawn) {
            ctx.fillStyle = this.#tileColor(tile);
            ctx.fillRect(sx, sy, ts, ts);
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.strokeRect(sx, sy, ts, ts);
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

      const assets = this.#assets;
      const classId = character.class;
      const rect = classId ? TR.resolveSprite(classId, 'party') : null;
      const portraitSheet = (rect && rect.sheet) || 'dungeon';
      if (assets && assets.ready && assets.has(portraitSheet) && rect) {
        const img = assets.get(portraitSheet);
        const portraitSize = 48;
        const px = cx - portraitSize / 2;
        const py = cy;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, px, py, portraitSize, portraitSize);
        ctx.strokeStyle = borderColor;
        ctx.strokeRect(px, py, portraitSize, portraitSize);
        cy += portraitSize + 6;
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
          if (t) {
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
          if (!drawn) {
            ctx.fillStyle = t ? t.color : '#333';
            ctx.fillRect(sx, sy, tileSize, tileSize);
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.strokeRect(sx, sy, tileSize, tileSize);
        }
    }

    drawUnitToken(col, row, unit, tileSize, offsetX, offsetY, { active = false, dead = false } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const dx = offsetX + col * tileSize;
      const dy = offsetY + row * tileSize;
      const cx = dx + tileSize / 2;
      const cy = dy + tileSize / 2;
      const radius = tileSize * 0.38;

      if (active) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this.#assets;
      let spriteDrawn = false;

      if (assets && assets.ready && !dead) {
        const category = unit.faction === 'party' ? 'party' : 'enemy';
        const classId = unit.character ? unit.character.class : null;
        const rect = classId ? TR.resolveSprite(classId, category) : null;
        const sheetId = (rect && rect.sheet) || 'dungeon';
        const img = assets.has(sheetId) ? assets.get(sheetId) : null;
        if (img && rect) {
          const tintMap = unit.faction === 'party' ? TR.PARTY_TINTS : TR.ENEMY_TINTS;
          const tint = tintMap && classId ? tintMap[classId] : null;
          const spriteW = tileSize - 4;
          ctx.imageSmoothingEnabled = false;
          if (tint)
            this.#drawTintedSprite(ctx, img, rect, dx + 2, dy + 2, spriteW, tint);
          else
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx + 2, dy + 2, spriteW, spriteW);
          spriteDrawn = true;
        }
      }

      if (!spriteDrawn) {
        ctx.fillStyle = dead ? '#444' : (unit.faction === 'party' ? '#4488cc' : '#cc4444');
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, tileSize * 0.3)|0}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.name.charAt(0).toUpperCase(), cx, cy);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      if (dead && spriteDrawn) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(dx, dy, tileSize, tileSize);
        ctx.fillStyle = '#c44';
        ctx.font = `bold ${Math.max(10, tileSize * 0.35)|0}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('X', cx, cy + 3);
        ctx.textAlign = 'left';
      }

      if (!dead && unit.currentHp < unit.maxHp) {
        const barW = tileSize - 4;
        const barH = 3;
        const bx = dx + 2;
        const by = dy + tileSize - 5;
        ctx.fillStyle = '#300';
        ctx.fillRect(bx, by, barW, barH);
        const ratio = Math.max(0, unit.currentHp / unit.maxHp);
        ctx.fillStyle = ratio > 0.5 ? '#4a4' : ratio > 0.25 ? '#aa4' : '#a44';
        ctx.fillRect(bx, by, barW * ratio, barH);
      }
    }

    drawUnitTokenAt(col, row, unit, tileSize, offsetX, offsetY, { active = false } = {}) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const dx = offsetX + col * tileSize;
      const dy = offsetY + row * tileSize;
      const cx = dx + tileSize / 2;
      const cy = dy + tileSize / 2;
      const radius = tileSize * 0.38;

      if (active) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this.#assets;
      let spriteDrawn = false;

      if (assets && assets.ready) {
        const category = unit.faction === 'party' ? 'party' : 'enemy';
        const classId = unit.character ? unit.character.class : null;
        const rect = classId ? TR.resolveSprite(classId, category) : null;
        const sheetId = (rect && rect.sheet) || 'dungeon';
        const img = assets.has(sheetId) ? assets.get(sheetId) : null;
        if (img && rect) {
          const tintMap = unit.faction === 'party' ? TR.PARTY_TINTS : TR.ENEMY_TINTS;
          const tint = tintMap && classId ? tintMap[classId] : null;
          const spriteW = tileSize - 4;
          ctx.imageSmoothingEnabled = false;
          if (tint)
            this.#drawTintedSprite(ctx, img, rect, dx + 2, dy + 2, spriteW, tint);
          else
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx + 2, dy + 2, spriteW, spriteW);
          spriteDrawn = true;
        }
      }

      if (!spriteDrawn) {
        ctx.fillStyle = unit.faction === 'party' ? '#4488cc' : '#cc4444';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(10, tileSize * 0.3)|0}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.name.charAt(0).toUpperCase(), cx, cy);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      if (unit.currentHp < unit.maxHp) {
        const barW = tileSize - 4;
        const barH = 3;
        const bx = dx + 2;
        const by = dy + tileSize - 5;
        ctx.fillStyle = '#300';
        ctx.fillRect(bx, by, barW, barH);
        const ratio = Math.max(0, unit.currentHp / unit.maxHp);
        ctx.fillStyle = ratio > 0.5 ? '#4a4' : ratio > 0.25 ? '#aa4' : '#a44';
        ctx.fillRect(bx, by, barW * ratio, barH);
      }
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

    drawTurnOrderBar(turnOrder, units, currentIndex, x, y, w) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const h = 42;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(x, y, w, h);

      const cellW = Math.min(120, (w - 10) / Math.max(1, turnOrder.length));
      for (let i = 0; i < turnOrder.length; ++i) {
        const entry = turnOrder[i];
        const u = units.find(u => u.id === entry.id);
        if (!u)
          continue;
        const cx = x + 5 + i * cellW + cellW / 2;
        const isCurrent = i === currentIndex;

        ctx.fillStyle = !u.isAlive ? '#444' : isCurrent ? '#ffd700' : (u.faction === 'party' ? '#6af' : '#f66');
        ctx.font = isCurrent ? 'bold 13px monospace' : '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(u.name.substring(0, 10), cx, y + 18);
        if (u.isAlive) {
          ctx.fillStyle = '#888';
          ctx.font = '11px monospace';
          ctx.fillText(`${u.currentHp}/${u.maxHp}`, cx, y + 33);
        } else {
          ctx.fillStyle = '#666';
          ctx.font = '11px monospace';
          ctx.fillText('DEAD', cx, y + 33);
        }
      }
      ctx.textAlign = 'left';
    }

    drawActionMenu(buttons, x, y, hoverIndex) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = 180;
      const btnH = 36;
      const gap = 6;
      const totalH = buttons.length * (btnH + gap) + 10;

      ctx.fillStyle = 'rgba(20,20,30,0.9)';
      ctx.fillRect(x, y, w, totalH);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(x, y, w, totalH);

      for (let i = 0; i < buttons.length; ++i) {
        const btn = buttons[i];
        const by = y + 5 + i * (btnH + gap);
        const isHover = i === hoverIndex;
        const bg = btn.disabled ? '#222' : (isHover ? '#555' : (btn.bg || '#333'));
        ctx.fillStyle = bg;
        ctx.fillRect(x + 5, by, w - 10, btnH);
        ctx.strokeStyle = btn.disabled ? '#333' : '#777';
        ctx.strokeRect(x + 5, by, w - 10, btnH);
        ctx.fillStyle = btn.disabled ? '#555' : '#fff';
        ctx.font = '15px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label, x + w / 2, by + btnH / 2);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    drawSpellMenu(spellBtns, x, y, hoverIndex) {
      if (!this.#bufCtx || !spellBtns || spellBtns.length === 0)
        return;
      const ctx = this.#bufCtx;
      const w = 180;
      const btnH = 28;
      const gap = 3;
      const totalH = spellBtns.length * (btnH + gap) + 8;

      ctx.fillStyle = 'rgba(20,15,40,0.95)';
      ctx.fillRect(x, y, w, totalH);
      ctx.strokeStyle = '#66a';
      ctx.strokeRect(x, y, w, totalH);

      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < spellBtns.length; ++i) {
        const btn = spellBtns[i];
        const by = y + 4 + i * (btnH + gap);
        const isHover = i === hoverIndex;
        const bg = btn.disabled ? '#1a1a2a' : (isHover ? '#444a7a' : (btn.bg || '#2a2a5a'));
        ctx.fillStyle = bg;
        ctx.fillRect(x + 4, by, w - 8, btnH);
        ctx.strokeStyle = btn.disabled ? '#333' : '#77a';
        ctx.strokeRect(x + 4, by, w - 8, btnH);
        ctx.fillStyle = btn.disabled ? '#555' : '#cce';
        ctx.fillText(btn.label, x + 8, by + btnH / 2);
        if (btn.range !== undefined) {
          ctx.fillStyle = '#888';
          ctx.textAlign = 'right';
          ctx.fillText(`R:${btn.range}`, x + w - 8, by + btnH / 2);
          ctx.textAlign = 'left';
        }
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    drawCombatLog(messages, x, y, w, h) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#444';
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#bbb';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      const lineH = 17;
      const maxLines = Math.floor((h - 8) / lineH);
      const startIdx = Math.max(0, messages.length - maxLines);
      for (let i = startIdx; i < messages.length; ++i) {
        const ly = y + 14 + (i - startIdx) * lineH;
        const line = messages[i].length > 100 ? messages[i].substring(0, 97) + '...' : messages[i];
        ctx.fillText(line, x + 8, ly);
      }
    }

    drawTooltip(x, y, lines) {
      if (!this.#bufCtx || !lines || lines.length === 0)
        return;
      const ctx = this.#bufCtx;
      ctx.font = '13px monospace';
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

    drawUnitInfoPanel(x, y, unit) {
      if (!this.#bufCtx || !unit)
        return;
      const ctx = this.#bufCtx;
      const w = 180;
      const h = 115;
      ctx.fillStyle = 'rgba(20,20,30,0.9)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#555';
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = unit.faction === 'party' ? '#6af' : '#f66';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(unit.name, x + w / 2, y + 22);

      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText(`HP: ${unit.currentHp}/${unit.maxHp}`, x + w / 2, y + 44);
      ctx.fillText(`AC: ${unit.ac}  BAB: +${unit.bab}`, x + w / 2, y + 62);
      ctx.fillText(`Spd: ${unit.speed}  Init: ${unit.dexMod >= 0 ? '+' : ''}${unit.dexMod}`, x + w / 2, y + 80);

      const barW = w - 16;
      const barH = 7;
      const bx = x + 8;
      const by = y + 92;
      ctx.fillStyle = '#300';
      ctx.fillRect(bx, by, barW, barH);
      const ratio = unit.maxHp > 0 ? Math.max(0, unit.currentHp / unit.maxHp) : 0;
      ctx.fillStyle = ratio > 0.5 ? '#4a4' : ratio > 0.25 ? '#aa4' : '#a44';
      ctx.fillRect(bx, by, barW * ratio, barH);

      ctx.textAlign = 'left';
    }

    drawAttackCutIn(attacker, defender, result, progress) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;

      const panelW = 600;
      const panelH = 180;
      const px = Math.floor((w - panelW) / 2);
      const py = Math.floor(h * 0.18);

      const fadeIn = Math.min(1, progress * 4);
      const alpha = fadeIn * 0.92;
      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.fillStyle = '#0a0a14';
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 8);
      ctx.fill();
      ctx.strokeStyle = result.hit ? (result.critical ? '#ffd700' : '#cc4444') : '#666';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 8);
      ctx.stroke();
      ctx.lineWidth = 1;

      const leftX = px + 20;
      const rightX = px + panelW - 20;
      const midX = px + panelW / 2;
      const topY = py + 20;

      const atkColor = attacker.faction === 'party' ? '#6af' : '#f66';
      const defColor = defender.faction === 'party' ? '#6af' : '#f66';

      const isSpell = !!result.spellName;

      ctx.fillStyle = atkColor;
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'left';
      ctx.fillText(attacker.name, leftX, topY);
      ctx.fillStyle = '#888';
      ctx.font = '13px monospace';
      if (isSpell)
        ctx.fillText(`MP ${attacker.currentMp !== undefined ? attacker.currentMp : '?'}/${attacker.maxMp || '?'}`, leftX, topY + 20);
      else
        ctx.fillText(`BAB +${attacker.bab}  STR ${attacker.strMod >= 0 ? '+' : ''}${attacker.strMod}`, leftX, topY + 20);

      ctx.fillStyle = defColor;
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'right';
      ctx.fillText(defender.name, rightX, topY);
      ctx.fillStyle = '#888';
      ctx.font = '13px monospace';
      ctx.fillText(`AC ${defender.ac}  HP ${defender.currentHp}/${defender.maxHp}`, rightX, topY + 20);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#aaa';
      ctx.font = '14px monospace';
      if (isSpell)
        ctx.fillText(result.spellName, midX, topY + 8);
      else
        ctx.fillText('vs', midX, topY + 8);

      const rollY = topY + 54;
      if (isSpell) {
        ctx.fillStyle = '#c8f';
        ctx.font = 'bold 18px monospace';
        ctx.fillText(`Casts ${result.spellName}`, midX, rollY);
      } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`d20 = ${result.d20}`, midX - 90, rollY);
        ctx.fillStyle = '#ccc';
        ctx.font = '16px monospace';
        ctx.fillText(`Total: ${result.total}`, midX + 90, rollY);
      }

      if (!isSpell && result.flanking) {
        ctx.fillStyle = '#aaf';
        ctx.font = '12px monospace';
        ctx.fillText('FLANKING +2', midX, rollY + 20);
      }

      const resultY = rollY + 48;
      if (isSpell) {
        if (result.damage > 0) {
          ctx.fillStyle = '#bb44ff';
          ctx.font = 'bold 26px serif';
          ctx.fillText('HIT!', midX, resultY);
          ctx.fillStyle = '#cc66ff';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(`${result.damage} damage`, midX, resultY + 28);
        } else if (result.heal > 0) {
          ctx.fillStyle = '#44ff88';
          ctx.font = 'bold 26px serif';
          ctx.fillText('HEALED!', midX, resultY);
          ctx.fillStyle = '#88ffaa';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(`+${result.heal} HP`, midX, resultY + 28);
        } else {
          ctx.fillStyle = '#aaccff';
          ctx.font = 'bold 26px serif';
          ctx.fillText('CAST!', midX, resultY);
        }
      } else if (result.hit) {
        if (result.critical) {
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 30px serif';
          ctx.fillText('CRITICAL HIT!', midX, resultY);
          ctx.fillStyle = '#ff6666';
          ctx.font = 'bold 22px monospace';
          ctx.fillText(`${result.damage} damage`, midX, resultY + 30);
        } else {
          ctx.fillStyle = '#44cc44';
          ctx.font = 'bold 26px serif';
          ctx.fillText('HIT!', midX, resultY);
          ctx.fillStyle = '#ff6666';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(`${result.damage} damage`, midX, resultY + 28);
        }
      } else {
        if (result.natural1) {
          ctx.fillStyle = '#cc4444';
          ctx.font = 'bold 26px serif';
          ctx.fillText('FUMBLE!', midX, resultY);
        } else {
          ctx.fillStyle = '#888888';
          ctx.font = 'bold 26px serif';
          ctx.fillText('MISS', midX, resultY);
        }
      }

      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
      ctx.restore();
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

    drawSlashEffect(x, y, size, progress) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const cx = x + size / 2;
      const cy = y + size / 2;
      const r = size * 0.5;
      const clamp = Math.min(1, Math.max(0, progress));
      const alpha = clamp < 0.5 ? clamp * 2 : 2 - clamp * 2;

      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx + r * 0.6 * clamp, cy + r * 0.6 * clamp);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.6, cy - r * 0.6);
      ctx.lineTo(cx - r * 0.6 * clamp, cy + r * 0.6 * clamp);
      ctx.stroke();
      ctx.restore();
    }

    drawSpellEffect(x, y, size, progress) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const cx = x + size / 2;
      const cy = y + size / 2;
      const r = size * 0.45;
      const clamp = Math.min(1, Math.max(0, progress));
      const alpha = clamp < 0.5 ? clamp * 2 : 2 - clamp * 2;

      ctx.save();
      ctx.strokeStyle = `rgba(180,100,255,${alpha.toFixed(2)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r * clamp, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(100,200,255,${(alpha * 0.6).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r * clamp * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      const sparkCount = 6;
      ctx.fillStyle = `rgba(220,180,255,${alpha.toFixed(2)})`;
      for (let i = 0; i < sparkCount; ++i) {
        const angle = (i / sparkCount) * Math.PI * 2 + clamp * Math.PI;
        const sr = r * clamp * 0.8;
        const sx = cx + Math.cos(angle) * sr;
        const sy = cy + Math.sin(angle) * sr;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBattleScene(attacker, defender, result, progress, type) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;

      ctx.save();

      const fadeIn = Math.min(1, progress * 6.67);
      const fadeOut = progress > 0.85 ? Math.max(0, (1 - progress) / 0.15) : 1;
      const alpha = Math.min(fadeIn, fadeOut);
      ctx.globalAlpha = alpha;

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0a1e');
      grad.addColorStop(1, '#1a0a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const groundY = h * 0.7;
      ctx.fillStyle = '#1a1a2a';
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.strokeStyle = '#2a2a3a';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      const slideIn = progress < 0.15 ? progress / 0.15 : 1;
      const slideOut = progress > 0.85 ? (1 - progress) / 0.15 : 1;
      const slide = Math.min(slideIn, slideOut);
      const spriteSize = 120;
      const spriteY = groundY - spriteSize - 10;
      const atkX = -spriteSize + slide * (w * 0.22 + spriteSize);
      const defX = w - slide * (w * 0.22);

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this.#assets;
      const drawCharSprite = (unit, cx, cy, tint) => {
        let drawn = false;
        if (assets && assets.ready) {
          const category = unit.faction === 'party' ? 'party' : 'enemy';
          const classId = unit.character ? unit.character.class : null;
          const rect = classId ? TR.resolveSprite(classId, category) : null;
          const sheetId = (rect && rect.sheet) || 'dungeon';
          const img = assets.has(sheetId) ? assets.get(sheetId) : null;
          if (img && rect) {
            const tintMap = unit.faction === 'party' ? TR.PARTY_TINTS : TR.ENEMY_TINTS;
            const spriteTint = tintMap && classId ? tintMap[classId] : null;
            ctx.imageSmoothingEnabled = false;
            if (spriteTint)
              this.#drawTintedSprite(ctx, img, rect, cx, cy, spriteSize, spriteTint);
            else
              ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, cx, cy, spriteSize, spriteSize);
            drawn = true;
          }
        }
        if (!drawn) {
          ctx.fillStyle = tint;
          ctx.beginPath();
          ctx.arc(cx + spriteSize / 2, cy + spriteSize / 2, spriteSize * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${spriteSize * 0.3 | 0}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(unit.name.charAt(0).toUpperCase(), cx + spriteSize / 2, cy + spriteSize / 2);
          ctx.textBaseline = 'alphabetic';
        }
      };

      const atkTint = attacker.faction === 'party' ? '#4488cc' : '#cc4444';
      const defTint = defender.faction === 'party' ? '#4488cc' : '#cc4444';
      drawCharSprite(attacker, atkX, spriteY, atkTint);
      drawCharSprite(defender, defX, spriteY, defTint);

      const plateY = groundY + 10;
      const plateW = 200;
      const plateH = 45;
      const atkPlateX = atkX + spriteSize / 2 - plateW / 2;
      const defPlateX = defX + spriteSize / 2 - plateW / 2;

      const drawNamePlate = (px, py, unit, color) => {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(px, py, plateW, plateH);
        ctx.strokeStyle = color;
        ctx.strokeRect(px, py, plateW, plateH);
        ctx.fillStyle = color;
        ctx.font = 'bold 14px serif';
        ctx.textAlign = 'center';
        ctx.fillText(unit.name, px + plateW / 2, py + 16);
        const barW = plateW - 20;
        const barH = 6;
        const bx = px + 10;
        const by = py + 24;
        ctx.fillStyle = '#300';
        ctx.fillRect(bx, by, barW, barH);
        const ratio = unit.maxHp > 0 ? Math.max(0, unit.currentHp / unit.maxHp) : 0;
        ctx.fillStyle = ratio > 0.5 ? '#4a4' : ratio > 0.25 ? '#aa4' : '#a44';
        ctx.fillRect(bx, by, barW * ratio, barH);
        ctx.fillStyle = '#aaa';
        ctx.font = '11px monospace';
        ctx.fillText(`${unit.currentHp}/${unit.maxHp}`, px + plateW / 2, py + 42);
      };

      drawNamePlate(atkPlateX, plateY, attacker, attacker.faction === 'party' ? '#6af' : '#f66');
      drawNamePlate(defPlateX, plateY, defender, defender.faction === 'party' ? '#6af' : '#f66');

      const isSpell = type === 'spell_cast';
      const midX = w / 2;
      const midY = h * 0.35;

      if (progress > 0.15 && progress < 0.85) {
        const actionProgress = Math.min(1, (progress - 0.15) / 0.55);
        ctx.textAlign = 'center';

        if (isSpell) {
          ctx.fillStyle = '#c8f';
          ctx.font = 'bold 22px monospace';
          ctx.fillText(result.spellName || 'Spell', midX, midY - 20);
          this.drawSpellEffect(defX, spriteY, spriteSize, actionProgress);
        } else {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 20px monospace';
          ctx.fillText(`d20 = ${result.d20}`, midX - 70, midY - 20);
          ctx.fillStyle = '#ccc';
          ctx.font = '16px monospace';
          ctx.fillText(`Total: ${result.total}`, midX + 70, midY - 20);
          if (result.flanking) {
            ctx.fillStyle = '#aaf';
            ctx.font = '13px monospace';
            ctx.fillText('FLANKING +2', midX, midY);
          }
          this.drawSlashEffect(defX, spriteY, spriteSize, actionProgress);
        }
      }

      if (progress > 0.5 && progress < 0.85) {
        const resultAlpha = Math.min(1, (progress - 0.5) / 0.15);
        ctx.globalAlpha = alpha * resultAlpha;
        ctx.textAlign = 'center';

        if (isSpell) {
          if (result.damage > 0) {
            ctx.fillStyle = '#bb44ff';
            ctx.font = 'bold 36px serif';
            ctx.fillText('HIT!', midX, midY + 40);
            ctx.fillStyle = '#cc66ff';
            ctx.font = 'bold 24px monospace';
            ctx.fillText(`${result.damage} damage`, midX, midY + 72);
          } else if (result.heal > 0) {
            ctx.fillStyle = '#44ff88';
            ctx.font = 'bold 36px serif';
            ctx.fillText('HEALED!', midX, midY + 40);
            ctx.fillStyle = '#88ffaa';
            ctx.font = 'bold 24px monospace';
            ctx.fillText(`+${result.heal} HP`, midX, midY + 72);
          } else {
            ctx.fillStyle = '#aaccff';
            ctx.font = 'bold 36px serif';
            ctx.fillText('CAST!', midX, midY + 40);
          }
        } else if (result.hit) {
          if (result.critical) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 40px serif';
            ctx.fillText('CRITICAL HIT!', midX, midY + 40);
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 28px monospace';
            ctx.fillText(`${result.damage} damage`, midX, midY + 76);
          } else {
            ctx.fillStyle = '#44cc44';
            ctx.font = 'bold 36px serif';
            ctx.fillText('HIT!', midX, midY + 40);
            ctx.fillStyle = '#ff6666';
            ctx.font = 'bold 24px monospace';
            ctx.fillText(`${result.damage} damage`, midX, midY + 72);
          }
        } else {
          if (result.natural1) {
            ctx.fillStyle = '#cc4444';
            ctx.font = 'bold 36px serif';
            ctx.fillText('FUMBLE!', midX, midY + 40);
          } else {
            ctx.fillStyle = '#888888';
            ctx.font = 'bold 36px serif';
            ctx.fillText('MISS', midX, midY + 40);
          }
        }
        ctx.globalAlpha = alpha;
      }

      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawTitleScreen(progress) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;
      const p = Math.min(1, Math.max(0, progress));

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0a0a1e');
      grad.addColorStop(0.5, '#1a1a2e');
      grad.addColorStop(1, '#0a0a14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this.#assets;
      const spriteMap = TR.OVERWORLD_TERRAIN_SPRITES;
      if (assets && assets.ready && assets.has('overworld') && spriteMap) {
        const img = assets.get('overworld');
        const tiles = ['GRASS', 'FOREST', 'MOUNTAIN', 'WATER', 'SAND', 'ROAD'];
        const ts = 24;
        const cols = Math.ceil(w / ts);
        const rows = Math.ceil(h / ts);
        ctx.globalAlpha = 0.08;
        ctx.imageSmoothingEnabled = false;
        for (let r = 0; r < rows; ++r)
          for (let c = 0; c < cols; ++c) {
            const idx = ((r * 7 + c * 13) ^ 0x5a5a) % tiles.length;
            const rect = spriteMap[tiles[idx]];
            if (rect)
              ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, c * ts, r * ts, ts, ts);
          }
        ctx.globalAlpha = 1;
      }

      const midX = w / 2;

      ctx.save();
      ctx.shadowColor = '#c8a84e';
      ctx.shadowBlur = 20 + Math.sin(p * Math.PI * 2) * 8;
      ctx.fillStyle = '#c8a84e';
      ctx.font = 'bold 56px serif';
      ctx.textAlign = 'center';
      ctx.fillText('TACTICAL REALMS', midX, 140);
      ctx.restore();

      ctx.fillStyle = '#aaa';
      ctx.font = '22px serif';
      ctx.textAlign = 'center';
      ctx.fillText('A Tactical RPG Adventure', midX, 195);

      const sparkCount = 12;
      ctx.globalAlpha = 0.4 + Math.sin(p * Math.PI * 4) * 0.2;
      for (let i = 0; i < sparkCount; ++i) {
        const angle = (i / sparkCount) * Math.PI * 2 + p * Math.PI;
        const radius = 80 + Math.sin(p * Math.PI * 2 + i) * 20;
        const sx = midX + Math.cos(angle) * radius;
        const sy = 140 + Math.sin(angle) * 30;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const pulse = 0.5 + Math.sin(p * Math.PI * 3) * 0.5;
      ctx.fillStyle = `rgba(200,200,200,${(0.4 + pulse * 0.6).toFixed(2)})`;
      ctx.font = '18px serif';
      ctx.fillText('Click to Start', midX, h - 80);
      ctx.textAlign = 'left';
    }

    drawVictoryScreen(party, xpGained, goldGained, progress) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;
      const p = Math.min(1, Math.max(0, progress));

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1a2a0a');
      grad.addColorStop(0.5, '#2a3a1a');
      grad.addColorStop(1, '#1a2a0a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const midX = w / 2;

      ctx.save();
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 16 + Math.sin(p * Math.PI * 2) * 6;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 52px serif';
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY', midX, 120);
      ctx.restore();

      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const assets = this.#assets;
      if (party && party.length > 0 && assets && assets.ready) {
        const spriteSize = 48;
        const totalW = party.length * spriteSize + (party.length - 1) * 12;
        const startX = midX - totalW / 2;
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < party.length; ++i) {
          const classId = party[i].class;
          const rect = classId && TR.resolveSprite ? TR.resolveSprite(classId, 'party') : null;
          const victorySheet = (rect && rect.sheet) || 'dungeon';
          const img = assets.has(victorySheet) ? assets.get(victorySheet) : null;
          const dx = startX + i * (spriteSize + 12);
          if (rect && img)
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, dx, 150, spriteSize, spriteSize);
          else {
            ctx.fillStyle = '#4488cc';
            ctx.beginPath();
            ctx.arc(dx + spriteSize / 2, 150 + spriteSize / 2, spriteSize * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      let y = 230;
      ctx.fillStyle = '#daa520';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${xpGained} XP    +${goldGained} Gold`, midX, y);
      y += 40;

      const barW = 300;
      const barH = 12;
      const barX = midX - barW / 2;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, y, barW, barH);
      ctx.fillStyle = '#4a4';
      ctx.fillRect(barX, y, barW * p, barH);
      ctx.strokeStyle = '#666';
      ctx.strokeRect(barX, y, barW, barH);
      y += 30;

      ctx.fillStyle = '#aaa';
      ctx.font = '14px monospace';
      ctx.fillText('XP Progress', midX, y);
      y += 40;

      const pulse = 0.5 + Math.sin(p * Math.PI * 3) * 0.5;
      ctx.fillStyle = `rgba(200,200,200,${(0.4 + pulse * 0.6).toFixed(2)})`;
      ctx.font = '16px serif';
      ctx.fillText('Click to continue', midX, y);
      ctx.textAlign = 'left';
    }

    drawDefeatScreen(progress) {
      if (!this.#bufCtx)
        return;
      const ctx = this.#bufCtx;
      const w = this.#width;
      const h = this.#height;
      const p = Math.min(1, Math.max(0, progress));

      ctx.fillStyle = '#1a0a0a';
      ctx.fillRect(0, 0, w, h);

      const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.7);
      vignetteGrad.addColorStop(0, 'rgba(40,10,10,0)');
      vignetteGrad.addColorStop(1, 'rgba(10,0,0,0.7)');
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, w, h);

      const midX = w / 2;

      ctx.save();
      ctx.shadowColor = '#cc4444';
      ctx.shadowBlur = 20 + Math.sin(p * Math.PI * 2) * 8;
      ctx.fillStyle = '#cc4444';
      ctx.font = 'bold 52px serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEFEAT', midX, 220);
      ctx.restore();

      ctx.fillStyle = '#888';
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('Your party has fallen...', midX, 270);

      const pulse = 0.5 + Math.sin(p * Math.PI * 3) * 0.5;
      ctx.fillStyle = `rgba(200,200,200,${(0.4 + pulse * 0.6).toFixed(2)})`;
      ctx.font = '16px serif';
      ctx.fillText('Click to continue', midX, h - 80);
      ctx.textAlign = 'left';
    }

    drawImage(image, x, y, w, h) {
      if (!this.#bufCtx || !image)
        return;
      this.#bufCtx.drawImage(image, x, y, w, h);
    }

    drawSpriteFrame(image, srcX, srcY, srcW, srcH, destX, destY, destW, destH) {
      if (!this.#bufCtx || !image)
        return;
      this.#bufCtx.drawImage(image, srcX, srcY, srcW, srcH, destX, destY, destW || srcW, destH || srcH);
    }

    drawTileSprite(image, tileIndex, spriteSize, destX, destY, destSize) {
      if (!this.#bufCtx || !image)
        return;
      const cols = Math.floor(image.width / spriteSize);
      const sx = (tileIndex % cols) * spriteSize;
      const sy = Math.floor(tileIndex / cols) * spriteSize;
      this.#bufCtx.drawImage(image, sx, sy, spriteSize, spriteSize, destX, destY, destSize || spriteSize, destSize || spriteSize);
    }

    drawCharacterSprite(image, col, row, spriteSize, destX, destY, destSize) {
      if (!this.#bufCtx || !image)
        return;
      const sx = col * spriteSize;
      const sy = row * spriteSize;
      this.#bufCtx.drawImage(image, sx, sy, spriteSize, spriteSize, destX, destY, destSize || spriteSize, destSize || spriteSize);
    }
  }

  TR.Renderer = Renderer;
})();
