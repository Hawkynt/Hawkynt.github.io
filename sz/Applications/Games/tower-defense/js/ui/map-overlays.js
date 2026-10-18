/* ui/map-overlays.js -- placement ghost, keyboard cursor, selection brackets and enemy tooltips.
   Reads: constants, towerTypes, env, widgets, towerArt, towers, waves, enemies, hud and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_PLAYING, STATE_BUILD, TWO_PI, WORLD_W, WORLD_H } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { ctx } = NS.env;
  const { UI, pointer, regionAt, hudPassThrough } = NS.widgets;
  const { drawTowerIconWorld } = NS.towerArt;
  const { towerStats, towerAt, canBuildAt } = NS.towers;
  const { enemyFlags } = NS.waves;
  const { enemySpeed } = NS.enemies;
  const { kbCursor } = NS.hud;

  /* ══════════════════════════════════════════════════════════════════
     MAP OVERLAYS -- placement ghost, cursor, selection
     ══════════════════════════════════════════════════════════════════ */

  function cursorCell() {
    if (kbCursor.active)
      return { col: kbCursor.col, row: kbCursor.row };
    if (!pointer.inside || pointer.wx < 0 || pointer.wy < 0 || pointer.wx >= WORLD_W || pointer.wy >= WORLD_H)
      return null;
    if (regionAt(pointer.ux, pointer.uy) && !hudPassThrough(pointer.ux, pointer.uy))
      return null;
    return { col: Math.floor(pointer.wx / CELL), row: Math.floor(pointer.wy / CELL) };
  }

  function drawMapOverlays() {
    const c = cursorCell();
    const pulse = 0.5 + 0.5 * Math.sin(G.animTime * 6);
    // Selected tower: range and brackets
    if (G.selectedTower) {
      const t = G.selectedTower;
      ctx.fillStyle = 'rgba(255,215,90,0.06)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, Math.max(towerStats(t).rangePx, 1), 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,90,0.55)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -G.animTime * 12;
      ctx.stroke();
      ctx.setLineDash([]);
      drawBrackets(t.col * CELL, t.row * CELL, CELL, UI.gold, 2 + pulse * 1.5);
    }
    if (!c || (G.state !== STATE_BUILD && G.state !== STATE_PLAYING)) return;
    if (G.selectedTowerType >= 0) {
      const def = TOWER_TYPES[G.selectedTowerType];
      const ok = canBuildAt(G.selectedTowerType, c.col, c.row);
      const afford = G.gold >= def.cost;
      const cx = c.col * CELL + CELL / 2, cy = c.row * CELL + CELL / 2;
      const good = ok && afford;
      ctx.fillStyle = good ? 'rgba(80,255,120,0.18)' : 'rgba(255,70,70,0.22)';
      ctx.fillRect(c.col * CELL, c.row * CELL, CELL, CELL);
      const range = def.range * CELL;
      if (def.range > 0 && ok && !def.trap) {
        ctx.fillStyle = good ? 'rgba(120,255,150,0.07)' : 'rgba(255,120,120,0.06)';
        ctx.beginPath();
        ctx.arc(cx, cy, range, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = good ? 'rgba(140,255,170,0.6)' : 'rgba(255,140,140,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (ok) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawTowerIconWorld(G.selectedTowerType, 1, cx, cy);
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(255,90,90,0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
        ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
        ctx.stroke();
      }
      drawBrackets(c.col * CELL, c.row * CELL, CELL, good ? '#8fff9f' : '#ff7a7a', 1.5 + pulse);
    } else if (kbCursor.active || towerAt(c.col, c.row)) {
      drawBrackets(c.col * CELL, c.row * CELL, CELL, kbCursor.active ? '#ffffff' : 'rgba(255,255,255,0.7)', 1 + pulse);
    }
  }

  function drawBrackets(x, y, s, color, inset) {
    const l = s * 0.3;
    const i = -inset;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + i, y + i + l); ctx.lineTo(x + i, y + i); ctx.lineTo(x + i + l, y + i);
    ctx.moveTo(x + s - i - l, y + i); ctx.lineTo(x + s - i, y + i); ctx.lineTo(x + s - i, y + i + l);
    ctx.moveTo(x + s - i, y + s - i - l); ctx.lineTo(x + s - i, y + s - i); ctx.lineTo(x + s - i - l, y + s - i);
    ctx.moveTo(x + i + l, y + s - i); ctx.lineTo(x + i, y + s - i); ctx.lineTo(x + i, y + s - i - l);
    ctx.stroke();
  }

  function enemyAtPointer() {
    if (!pointer.inside) return null;
    let best = null, bd = 1e9;
    for (const e of G.enemies) {
      const d = Math.hypot(e.x - pointer.wx, e.y - pointer.wy);
      if (d < e.radius + 6 && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  function enemyTooltip(e) {
    const f = enemyFlags(e);
    const lines = [(e.elite ? 'Elite ' : '') + f.name, f.info, `[[heart]] ${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}   Speed ${Math.round(enemySpeed(e))}   [[coin]] ${e.bounty}`];
    if (e.armor > 0) lines.push(`[[shield]] Armor ${Math.max(0, e.armor - e.shred)}${e.shred ? ' (shredded)' : ''}`);
    if (e.shieldHp > 0) lines.push(`[[bolt]] Shield ${Math.ceil(e.shieldHp)}`);
    if (f.stealth) lines.push(e.revealed ? '✔ Spotted: towers can shoot it' : '⚠ Hidden: needs a Sniper, Longbow or area damage');
    if (e.elite) lines.push('⚠ Elite: hurries nearby enemies');
    if (f.boss) lines.push(`⚠ Boss: costs ${f.lives} lives if it gets through`);
    lines.push(`✔ Counter: ${f.counter}`);
    return lines;
  }

  NS.mapOverlays = { drawMapOverlays, drawBrackets, enemyAtPointer, enemyTooltip };

})();
