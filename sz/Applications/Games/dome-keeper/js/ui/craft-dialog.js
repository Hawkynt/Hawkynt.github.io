;(function() {
  'use strict';

  // The Bomb Workshop dialog: layout, input and drawing.
  // Owns: NS.craftDialog
  // Reads: constants, dom, sprites, fxArt, textLayout, panels, upgrades, persistence, bombs, upgradeTree,
  //   gadgetArt, bombArt, hud, tooltip
  // Reads state of: gameState, bombs

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, STATE_PLAYING, STATE_CRAFT } = NS.constants;
  const { ctx } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawChip, drawScrim } = NS.panels;
  const { getEffectiveLevel } = NS.upgrades;
  const { saveRun } = NS.persistence;
  const { BOMB_TIERS, BOMB_COMBINE, craftFlash, bombCount, bombCapacity, bombRadius, bombPower, recipeKnown,
    craftCost, craftBlocker, craftBomb, combineBombs } = NS.bombs;
  const { drawCostRow } = NS.upgradeTree;
  const { drawKeyHints } = NS.gadgetArt;
  const { inRect, drawSmallButton } = NS.bombArt;

  /* -- Bomb workshop (crafting and combining) -- */
  function craftLayout() {
    const w = 1080, h = 724, x = (CANVAS_W - w) / 2, y = (CANVAS_H - h) / 2;
    const rows = BOMB_TIERS.map((T, i) => {
      const ry = y + 112 + i * 104;
      return {
        i, x: x + 24, y: ry, w: w - 48, h: 94,
        craft: { x: x + w - 40 - 250 - 12 - 170, y: ry + 25, w: 170, h: 44 },
        combine: i < BOMB_TIERS.length - 1 ? { x: x + w - 40 - 250, y: ry + 25, w: 250, h: 44 } : null
      };
    });
    return { x, y, w, h, rows, close: { x: x + w - 54, y: y + 12, w: 40, h: 40 } };
  }

  function openCraftDialog() {
    if (G.state !== STATE_PLAYING) return;
    G.stateBeforeCraft = G.state;
    G.state = STATE_CRAFT;
    G.craftFocus = Math.max(0, G.bombSel);
    G.craftHover = null;
    G.bombThrowMode = false;
    NS.tooltip.clearTooltip();
    SZ.GameAudio.play('select');
  }

  function closeCraftDialog() {
    G.state = G.stateBeforeCraft || STATE_PLAYING;
    G.stateBeforeCraft = null;
    G.craftHover = null;
    SZ.GameAudio.play('click');
    saveRun();
  }

  function hitCraftDialog(mx, my) {
    const L = craftLayout();
    if (inRect(mx, my, L.close)) return { kind: 'close' };
    for (const r of L.rows) {
      if (inRect(mx, my, r.craft)) return { kind: 'craft', row: r.i };
      if (r.combine && inRect(mx, my, r.combine)) return { kind: 'combine', row: r.i };
      if (inRect(mx, my, r)) return { kind: 'row', row: r.i };
    }
    return inRect(mx, my, L) ? { kind: 'panel' } : { kind: 'outside' };
  }

  function handleCraftClick(mx, my) {
    const hit = hitCraftDialog(mx, my);
    if (hit.kind === 'close' || hit.kind === 'outside') {
      closeCraftDialog();
      return;
    }
    if (hit.row !== undefined) {
      G.craftFocus = hit.row;
      if (hit.kind === 'craft') craftBomb(hit.row);
      else if (hit.kind === 'combine') combineBombs(hit.row);
      else {
        G.bombSel = hit.row;
        SZ.GameAudio.play('blip', { pitch: 1 + hit.row * 0.1, volume: 0.6 });
      }
    }
  }

  function handleCraftKey(e) {
    const n = BOMB_TIERS.length;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') G.craftFocus = (G.craftFocus + n - 1) % n;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') G.craftFocus = (G.craftFocus + 1) % n;
    else if (/^Digit[1-5]$/.test(e.code)) G.craftFocus = parseInt(e.code.slice(5), 10) - 1;
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') craftBomb(G.craftFocus);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyM') combineBombs(G.craftFocus);
    else if (e.code === 'Escape' || e.code === 'KeyC') closeCraftDialog();
    else return false;
    G.bombSel = G.craftFocus;
    return true;
  }

  function drawCraftDialog() {
    drawScrim(0.66);
    const L = craftLayout();
    drawPanel(L.x, L.y, L.w, L.h, { accent: '#ff9a40', radius: 16, title: '[[bomb]] Bomb Workshop', titlePx: 28, headerH: 64, top: 'rgba(26,30,48,0.98)', bottom: 'rgba(12,14,24,0.98)' });
    const ch = G.craftHover;
    // Stock and close button
    const full = bombCount() >= bombCapacity();
    drawChip(`Stock ${bombCount()} / ${bombCapacity()}`, L.close.x - 14, L.y + 19, 28, { align: 'right', px: 16, maxW: 220, bg: full ? 'rgba(255,182,72,0.18)' : 'rgba(255,215,90,0.12)', border: full ? UI.warn : 'rgba(255,215,90,0.5)', color: full ? UI.warn : UI.gold });
    drawSmallButton(L.close, '×', true, ch && ch.kind === 'close', '#8aa8d8', 22);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Craft bombs from stored ore and combine three of one size into one of the next. Drop or throw them in the mine, lob them at monsters.', L.x + 28, L.y + 88, L.w - 56, 16, { color: UI.textDim });
    for (const r of L.rows) {
      const T = BOMB_TIERS[r.i];
      const focus = G.craftFocus === r.i;
      const known = recipeKnown(r.i);
      const why = craftBlocker(r.i);
      ctx.save();
      NS.hud.drawNodeFrame(r.x, r.y, r.w, r.h, T.color, known ? (why ? 'poor' : 'ready') : 'locked', ch && ch.row === r.i);
      if (focus || G.bombSel === r.i) {
        roundRectPath(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 14);
        ctx.lineWidth = focus ? 3 : 1.5;
        ctx.strokeStyle = focus ? UI.gold : 'rgba(255,215,90,0.45)';
        ctx.stroke();
      }
      // Icon well
      const ix = r.x + 12, iy = r.y + 11;
      roundRectPath(ix, iy, 72, 72, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      drawGlow(T.color, ix + 36, iy + 36, 40, 0.35 + Math.sin(G.animTime * 3 + r.i) * 0.1);
      drawSprite(T.icon, ix + 36, iy + 36, 52, known || G.bombInv[r.i] > 0 ? 1 : 0.45);
      // Name, numbers and recipe
      const tx = r.x + 100, tw = r.craft.x - 110 - tx;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(T.name, tx, r.y + 22, tw, 22, { weight: 'bold', color: known ? '#ffffff' : '#9aa2b8' });
      fitText(`Radius ${bombRadius(r.i).toFixed(1)} tiles · rock power ${bombPower(r.i).toFixed(1)} · ${Math.round(T.monster * (1 + 0.3 * getEffectiveLevel('bombPower')))} damage to monsters`, tx, r.y + 47, tw, 14, { color: UI.textDim });
      if (known)
        drawCostRow(craftCost(r.i), tx, r.y + 73, Math.min(tw, 300), 15);
      else {
        drawSprite('lock', tx + 9, r.y + 73, 18, 0.8);
        fitText('Recipe locked - buy it in the Tools branch (combining still works)', tx + 24, r.y + 74, tw - 24, 14, { color: UI.warn });
      }
      // Stock
      const sx = r.craft.x - 100;
      roundRectPath(sx, r.y + 18, 86, 58, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.textAlign = 'center';
      fitText('in stock', sx + 43, r.y + 32, 76, 12, { color: UI.textMute });
      fitText(String(G.bombInv[r.i]), sx + 43, r.y + 57, 76, 26, { weight: 'bold', color: G.bombInv[r.i] > 0 ? UI.gold : UI.textMute });
      // Buttons
      drawSmallButton(r.craft, known ? 'Craft' : 'Locked', !why, ch && ch.kind === 'craft' && ch.row === r.i, '#5ac87a', 18);
      if (r.combine) {
        const can = G.bombInv[r.i] >= BOMB_COMBINE;
        drawSmallButton(r.combine, `Combine ${BOMB_COMBINE} [[${T.icon}]] → 1 [[${BOMB_TIERS[r.i + 1].icon}]]`, can, ch && ch.kind === 'combine' && ch.row === r.i, '#ff9a40', 17);
      } else {
        ctx.textAlign = 'center';
        fitText('The biggest bomb there is', r.x + r.w - 40 - 125, r.y + 48, 240, 15, { color: UI.textMute });
      }
      // Craft / combine flash
      const fl = craftFlash[r.i];
      if (fl !== undefined) {
        const t = (performance.now() - fl) / 600;
        if (t >= 1) delete craftFlash[r.i];
        else {
          roundRectPath(r.x, r.y, r.w, r.h, 12);
          ctx.fillStyle = `rgba(255,240,200,${0.3 * (1 - t)})`;
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText('In the mine: [B] drops the selected bomb, [T] throws it, [Q] picks the next size  ·  on the surface [B] lobs it at the cursor', CANVAS_W / 2, L.y + L.h - 62, L.w - 60, 15, { color: UI.textDim });
    drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Craft' },
      { key: '→', label: 'Combine' },
      { key: 'Esc', label: 'Close' }
    ], CANVAS_W / 2, L.y + L.h - 26, L.w - 80);
  }

  NS.craftDialog = { openCraftDialog, hitCraftDialog, handleCraftClick, handleCraftKey, drawCraftDialog };
})();
