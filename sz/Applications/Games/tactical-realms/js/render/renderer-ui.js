/* Panels, buttons, text, the character card, tooltips and context menus. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const Renderer = TR.Renderer;

  function brighten(hex, f) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7)
      return hex;
    const n = parseInt(hex.slice(1), 16);
    const ch = sh => Math.min(255, Math.round(((n >> sh) & 255) * f));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  Object.assign(Renderer.prototype, {
    drawRect(worldX, worldY, w, h, color) {
      if (!this._bufCtx)
        return;
      const s = this.worldToScreen(worldX, worldY);
      this._bufCtx.fillStyle = color;
      this._bufCtx.fillRect(s.x, s.y, w, h);
    }

  ,
    drawText(worldX, worldY, text, { color = '#fff', font = '14px monospace', align = 'left' } = {}) {
      if (!this._bufCtx)
        return;
      const s = this.worldToScreen(worldX, worldY);
      this._bufCtx.fillStyle = color;
      this._bufCtx.font = font;
      this._bufCtx.textAlign = align;
      this._bufCtx.fillText(text, s.x, s.y);
    }

  ,
    drawScreenText(x, y, text, { color = '#fff', font = '14px monospace', align = 'left' } = {}) {
      if (!this._bufCtx)
        return;
      this._bufCtx.fillStyle = color;
      this._bufCtx.font = font;
      this._bufCtx.textAlign = align;
      this._bufCtx.fillText(text, x, y);
    }

  ,
    highlightTile(col, row, color) {
      if (!this._bufCtx)
        return;
      const ts = this._tileSize;
      const sx = col * ts - this._camera.x;
      const sy = row * ts - this._camera.y;
      this._bufCtx.fillStyle = color || 'rgba(255,255,0,0.3)';
      this._bufCtx.fillRect(sx, sy, ts, ts);
      this._bufCtx.strokeStyle = color || 'rgba(255,255,0,0.8)';
      this._bufCtx.lineWidth = 2;
      this._bufCtx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
      this._bufCtx.lineWidth = 1;
    }

  ,
    drawPanel(x, y, w, h, { bg = 'rgba(0,0,0,0.85)', border = '#888', radius = 4 } = {}) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, radius);
      ctx.stroke();
    }

  ,
    drawButton(x, y, w, h, text, { bg = '#444', hover = false, color = '#fff', font = '14px monospace' } = {}) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
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

  ,
    drawCharacterCard(x, y, w, h, character, { selected = false, locked = false } = {}) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
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

    // theme: optional dungeon theme; its floor and wall art replace the
    // generic look of its floor and wall terrain.
  ,
    drawTooltip(x, y, lines) {
      if (!this._bufCtx || !lines || lines.length === 0)
        return;
      const ctx = this._bufCtx;
      ctx.font = "14px Georgia, 'Times New Roman', serif";
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      const lineH = 20;
      const pad = 10;
      let maxW = 0;
      for (const l of lines)
        maxW = Math.max(maxW, ctx.measureText(l).width);
      const w = maxW + pad * 2;
      const h = lines.length * lineH + pad * 2 - 4;
      const tx = Math.min(x, this._width - w - 4);
      const ty = Math.min(y, this._height - h - 4);
      this._frame(ctx, tx, ty, w, h);
      for (let i = 0; i < lines.length; ++i) {
        ctx.fillStyle = i === 0 ? '#f0d890' : '#e8e0c8';
        ctx.fillText(lines[i], tx + pad, ty + pad + 12 + i * lineH);
      }
    }

  ,
    drawContextMenu(x, y, items, hoverIndex) {
      if (!this._bufCtx || !items || items.length === 0)
        return;
      const ctx = this._bufCtx;
      const itemH = 28;
      const menuW = 200;
      const padY = 4;
      const h = items.length * itemH + padY * 2;
      const mx = Math.min(x, this._width - menuW - 4);
      const my = Math.min(y, this._height - h - 4);
      this._frame(ctx, mx, my, menuW, h);
      ctx.font = "bold 14px Georgia, 'Times New Roman', serif";
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      for (let i = 0; i < items.length; ++i) {
        const iy = my + padY + i * itemH;
        if (i === hoverIndex) {
          const g = ctx.createLinearGradient(0, iy, 0, iy + itemH);
          g.addColorStop(0, '#3a4a8a');
          g.addColorStop(1, '#1e2650');
          ctx.fillStyle = g;
          ctx.fillRect(mx + 4, iy, menuW - 8, itemH);
          ctx.fillStyle = '#ffd75a';
          ctx.fillRect(mx + 4, iy, 3, itemH);
        }
        const icon = items[i].action === 'attack' ? '⚔ ' : '✨ ';
        ctx.fillStyle = i === hoverIndex ? '#ffffff' : '#e8e0c8';
        ctx.fillText(icon + items[i].label, mx + 14, iy + 19);
      }
    }

    // Gold-framed navy panel shared by the canvas widgets.
  ,
    _frame(ctx, x, y, w, h) {
      const SA = TR.ScreenArt;
      if (SA) {
        SA.frame(ctx, x, y, w, h);
        return;
      }
      ctx.fillStyle = 'rgba(10,10,20,0.95)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#888';
      ctx.strokeRect(x, y, w, h);
    }



  ,
    drawScreenRect(x, y, w, h, color) {
      if (!this._bufCtx)
        return;
      this._bufCtx.fillStyle = color;
      this._bufCtx.fillRect(x, y, w, h);
    }

  ,
  });
})();
