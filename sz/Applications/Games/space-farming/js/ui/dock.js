/* Space Farming - the tool dock: tools, crop and building slots, selection, action hint,
   soil legend and zoom chip.
   Owns: G.selectedCropIndex, G.selectedTool, G.selectedBuildingIndex, G.dockFollow
   Reads: G.UW, G.state, G.credits, G.livestockPens, G.priceMultipliers, G.currentSeason, G.viewZoom,
     G.frameRegions, G.hoverRegionId, G.uiTime, G.frameDt, G.soilOverlay, G.orders, G.dialog */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, CROPS, LIVESTOCK, TOOL_PLANT, TOOL_HOE, BUILDINGS, TOOL_BUILD, SEASON_SPRITES, ctx,
    drawSprite, fitText, drawTextBlock, UI, roundRectPath, drawBaked, rrPath, drawPanel, drawChip, addRegion,
    hoverAmount, isPressed, drawButton, getSeedCost, getBuildingCost, ROCK_CLEAR_COST, sellAllProduce,
    getNextPrices, showNutrients, TREE_BRANCH_SHORT, techOwned, arePrereqsMet, nodeCost, canPay,
    unlockedByTech, isCropUnlocked, isBuildingUnlocked, nodeTitle, openTree, HUD_M, DOCK_H, SLOT_W, SLOT_H,
    SLOT_GAP, dockScroll, dockMode, hudFade, beginHudPanel, endHudPanel, toggleDialog, toggleTree,
    buildCropBarTooltip, buildBuildingShopTooltip, buildSellButtonTooltip, toolTooltip } = NS;

  /* ── Tool dock ── */

  function dockItems(mode) {
    if (mode === 'plant') {
      const open = [], shut = [];
      CROPS.forEach((c, i) => (isCropUnlocked(i) ? open : shut).push({ kind: 'crop', index: i, locked: !isCropUnlocked(i) }));
      return open.concat(shut);
    }
    if (mode === 'build') {
      const open = [], shut = [];
      BUILDINGS.forEach((b, i) => (isBuildingUnlocked(i) ? open : shut).push({ kind: 'building', index: i, locked: !isBuildingUnlocked(i) }));
      return open.concat(shut);
    }
    return [];
  }

  function selectCrop(i) {
    if (!isCropUnlocked(i)) {
      lockedHint(unlockedByTech('crops', i));
      return;
    }
    G.selectedCropIndex = i;
    G.selectedTool = TOOL_PLANT;
    G.selectedBuildingIndex = -1;
    SZ.GameAudio.play('click');
  }

  /* A locked item was picked: show where it is unlocked */
  function lockedHint(n) {
    SZ.GameAudio.play('error', { volume: 0.5 });
    if (n)
      openTree(n.id);
  }

  function selectBuilding(i) {
    if (!isBuildingUnlocked(i)) {
      lockedHint(unlockedByTech('buildings', i));
      return;
    }
    G.selectedBuildingIndex = i;
    G.selectedTool = TOOL_BUILD;
    SZ.GameAudio.play('click');
  }

  function setTool(mode) {
    if (mode === 'plant') {
      G.selectedTool = TOOL_PLANT;
      G.selectedBuildingIndex = -1;
    } else if (mode === 'build') {
      G.selectedTool = TOOL_BUILD;
      if (G.selectedBuildingIndex < 0 || !isBuildingUnlocked(G.selectedBuildingIndex))
        G.selectedBuildingIndex = 0;
    } else {
      G.selectedTool = TOOL_HOE;
      G.selectedBuildingIndex = -1;
    }
    SZ.GameAudio.play('click');
  }

  function drawDock(L) {
    const d = L.dock;
    beginHudPanel('dock', d.x, d.y, d.w, d.h);
    drawPanel(d.x, d.y, d.w, d.h, { accent: UI.leaf, radius: 14 });
    const mode = dockMode();
    // a narrow dock has two rows: tools and actions on top, the slots below
    const twoRow = d.h > DOCK_H;
    const top = twoRow ? d.y + 8 : d.y + (d.h - SLOT_H) / 2;
    const slotTop = twoRow ? top + SLOT_H + 10 : top;

    // Tools
    const tools = [
      { mode: 'plant', icon: 'seedbag', label: 'Seeds', key: 'P' },
      { mode: 'build', icon: 'hammer', label: 'Build', key: 'B' },
      { mode: 'hoe', icon: 'hoe', label: 'Hoe', key: 'T' }
    ];
    let x = d.x + 10;
    for (const t of tools) {
      drawButton({ id: 'tool-' + t.mode, x, y: top, w: 56, h: SLOT_H }, {
        label: t.label, icon: t.icon, vertical: true, active: mode === t.mode, color: UI.leaf, px: 11,
        onClick: () => setTool(t.mode), tip: () => toolTooltip(t.mode)
      });
      if (mode === t.mode) {
        ctx.fillStyle = UI.leaf;
        ctx.fillRect(x + 14, top + SLOT_H + 3, 28, 3);
      }
      x += 62;
    }
    x += 6;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    if (twoRow)
      ctx.fillRect(d.x + 12, slotTop - 5, d.w - 24, 1);
    else
      ctx.fillRect(x - 5, d.y + 12, 1, d.h - 24);

    // Actions (right)
    const actions = [
      { id: 'act-sell', icon: 'coin', label: 'Sell', key: 'S', onClick: sellAllProduce, tip: buildSellButtonTooltip, color: '#59c96a' },
      { id: 'act-market', icon: 'market', label: 'Market', key: 'M', onClick: () => toggleDialog('market'), tip: () => ['[[market]] Market', 'Sell single crops, check prices and deliver orders.', `${G.orders.length} order${G.orders.length === 1 ? '' : 's'} open`, 'Shortcut: M'], color: UI.gold },
      { id: 'act-animals', icon: 'paw', label: 'Animals', key: 'L', onClick: () => toggleDialog('livestock'), tip: () => ['[[paw]] Livestock', 'Buy animals for the pens around your farm.', `${G.livestockPens.length} animals on the farm.`, 'Shortcut: L'], color: '#ff9ac0' },
      { id: 'act-upgrades', icon: 'techtree', label: 'Tech tree', key: 'U', onClick: () => toggleTree(), tip: () => ['[[techtree]] Tech tree', 'Upgrades, new crops, animals and buildings.', 'Shortcut: U'], color: UI.gold }
    ];
    const actW = 62;
    const actX0 = d.x + d.w - 10 - actions.length * (actW + 6) + 6;
    actions.forEach((a, i) => {
      drawButton({ id: a.id, x: actX0 + i * (actW + 6), y: top, w: actW, h: SLOT_H }, {
        label: a.label, icon: a.icon, vertical: true, color: a.color, px: 11, onClick: a.onClick, tip: a.tip,
        active: (a.id === 'act-animals' && G.dialog === 'livestock') || (a.id === 'act-market' && G.dialog === 'market') || (a.id === 'act-upgrades' && G.dialog === 'tree')
      });
    });
    if (!twoRow) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(actX0 - 7, d.y + 12, 1, d.h - 24);
    }

    // Slots
    const sx0 = twoRow ? d.x + 10 : x, sx1 = twoRow ? d.x + d.w - 10 : actX0 - 12;
    const items = dockItems(mode);
    if (mode === 'hoe') {
      roundRectPath(sx0, slotTop, sx1 - sx0, SLOT_H, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      drawSprite('hoe', sx0 + 30, slotTop + SLOT_H / 2, 32);
      drawTextBlock(`Click soil beside water (or water itself) to enrich it: +20% nutrients, sand turns into farmland. Click a rock to break it up (${ROCK_CLEAR_COST} cr). Right-click a crop to uproot it for half its seed cost.`, sx0 + 56, slotTop + 4, sx1 - sx0 - 66, SLOT_H - 8, 12, { color: UI.textDim, valign: 'middle' });
    } else {
      const areaW = sx1 - sx0;
      const total = items.length * (SLOT_W + SLOT_GAP) - SLOT_GAP;
      const overflow = total > areaW;
      const arrowW = overflow ? 22 : 0;
      const viewX0 = sx0 + arrowW, viewW = areaW - arrowW * 2;
      const maxScroll = Math.max(0, total - viewW);
      dockScroll[mode] = Math.max(0, Math.min(maxScroll, dockScroll[mode]));
      ctx.save();
      ctx.beginPath();
      ctx.rect(viewX0, twoRow ? slotTop - 4 : d.y + 2, viewW, twoRow ? d.y + d.h - slotTop + 2 : d.h - 4);
      ctx.clip();
      items.forEach((it, i) => {
        const sx = viewX0 + i * (SLOT_W + SLOT_GAP) - dockScroll[mode];
        if (sx + SLOT_W < viewX0 || sx > viewX0 + viewW) return;
        drawDockSlot(it, sx, slotTop, i, viewX0, viewX0 + viewW);
      });
      ctx.restore();
      if (overflow) {
        const step = (SLOT_W + SLOT_GAP) * 3;
        drawButton({ id: 'dock-left', x: sx0, y: slotTop, w: arrowW - 2, h: SLOT_H }, { label: '', chevron: -1, disabled: dockScroll[mode] <= 0, onClick: () => { dockScroll[mode] -= step; } });
        drawButton({ id: 'dock-right', x: sx1 - arrowW + 2, y: slotTop, w: arrowW - 2, h: SLOT_H }, { label: '', chevron: 1, disabled: dockScroll[mode] >= maxScroll, onClick: () => { dockScroll[mode] += step; } });
      }
      addRegion({ id: 'dock-slots-wheel', x: sx0, y: twoRow ? slotTop - 4 : d.y, w: areaW, h: twoRow ? d.y + d.h - slotTop + 4 : d.h, passive: true, onWheel: (dy) => { dockScroll[mode] += dy > 0 ? 64 : -64; } });
      // keep the selected slot visible
      const sel = items.findIndex(it => it.index === (mode === 'plant' ? G.selectedCropIndex : G.selectedBuildingIndex));
      if (sel >= 0 && G.dockFollow) {
        const sx = sel * (SLOT_W + SLOT_GAP);
        if (sx < dockScroll[mode]) dockScroll[mode] = sx;
        else if (sx + SLOT_W > dockScroll[mode] + viewW) dockScroll[mode] = sx + SLOT_W - viewW;
        G.dockFollow = false;
      }
    }
    addRegion({ id: 'dock-bg', x: d.x, y: d.y, w: d.w, h: d.h, passive: true });
    reorderPassiveRegions();
    endHudPanel();

    // Action hint above the dock
    drawActionHint(d);
  }

  /* Wheel-only regions sit below the buttons they surround */
  function reorderPassiveRegions() {
    const passive = G.frameRegions.filter(r => r.passive);
    const active = G.frameRegions.filter(r => !r.passive);
    G.frameRegions = passive.concat(active);
  }

  function drawDockSlot(it, x, y, i, clipL, clipR) {
    const id = 'slot-' + it.kind + '-' + it.index;
    const hv = hoverAmount(id);
    const pressed = isPressed(id) && G.hoverRegionId === id;
    const isCrop = it.kind === 'crop';
    const def = isCrop ? CROPS[it.index] : BUILDINGS[it.index];
    const selected = isCrop ? (G.selectedTool === TOOL_PLANT && G.selectedCropIndex === it.index) : (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex === it.index);
    const cost = isCrop ? getSeedCost(def) : getBuildingCost(def);
    const afford = G.credits >= cost;
    const locked = it.locked;
    const lift = pressed ? 1 : -hv * 3;
    const yy = y + lift;
    ctx.save();
    if (selected) {
      roundRectPath(x, yy, SLOT_W, SLOT_H, 10);
      ctx.lineWidth = 7 + Math.sin(G.uiTime * 4) * 2;
      ctx.strokeStyle = 'rgba(126,224,106,0.22)';
      ctx.stroke();
    }
    const hq = Math.round(hv * 8) / 8;
    drawBaked(['slot', selected ? 1 : 0, hq].join('|'), x, yy, SLOT_W, SLOT_H, 3, (g, px, py, w, h) => {
      rrPath(g, px, py, w, h, 10);
      const gr = g.createLinearGradient(0, py, 0, py + h);
      gr.addColorStop(0, selected ? 'rgba(126,224,106,0.32)' : `rgba(44,54,80,${0.85 + hq * 0.1})`);
      gr.addColorStop(1, selected ? 'rgba(40,90,40,0.45)' : 'rgba(20,24,38,0.9)');
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = selected ? 2.5 : 1.2;
      g.strokeStyle = selected ? UI.leaf : `rgba(140,160,210,${0.25 + hq * 0.45})`;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.07)';
      rrPath(g, px + 2, py + 2, w - 4, h * 0.4, 8);
      g.fill();
    });
    // Icon
    const bob = selected ? Math.sin(G.uiTime * 3) * 1.5 : 0;
    if (locked) {
      drawSprite(def.sprite, x + SLOT_W / 2, yy + 25, 32, 0.25);
      drawSprite('lock', x + SLOT_W / 2, yy + 27, 20, 0.9);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText('Tech tree', x + SLOT_W / 2, yy + SLOT_H - 11, SLOT_W - 6, 10, { weight: 'bold', color: UI.textMute });
      ctx.restore();
      const rx0 = Math.max(x, clipL), rx1 = Math.min(x + SLOT_W, clipR);
      if (rx1 - rx0 > 6)
        addRegion({ id, x: rx0, y, w: rx1 - rx0, h: SLOT_H, onClick: () => isCrop ? selectCrop(it.index) : selectBuilding(it.index), tip: () => lockedTooltip(isCrop ? 'crops' : 'buildings', it.index) });
      return;
    }
    drawSprite(def.sprite, x + SLOT_W / 2, yy + 25 + bob, 32, afford ? 1 : 0.55);
    // Number key
    if (i < 10)
      drawChip(String((i + 1) % 10), x + 3, yy + 3, 14, { px: 9, bg: 'rgba(0,0,0,0.5)', color: UI.textDim });
    // Market trend
    if (isCrop) {
      const pm = G.priceMultipliers[it.index] || 1;
      if (techOwned('com_insight')) {
        const nx = getNextPrices()[it.index];
        if (Math.abs(nx - pm) > 0.03) {
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          fitText(nx > pm ? '↗' : '↘', x + SLOT_W - 5, yy + 24, 14, 11, { weight: 'bold', color: nx > pm ? '#9df0ff' : '#ffb0a0' });
        }
      }
      if (pm > 1.05 || pm < 0.95) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        fitText(pm > 1 ? '▲' : '▼', x + SLOT_W - 5, yy + 10, 14, 11, { weight: 'bold', color: pm > 1 ? UI.good : UI.bad });
      }
    }
    if (isCrop && def.favorite === G.currentSeason)
      drawSprite(SEASON_SPRITES[def.favorite], x + SLOT_W - 9, yy + 36, 12);
    // Price
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`${cost} [[coin]]`, x + SLOT_W / 2, yy + SLOT_H - 11, SLOT_W - 6, 12, { weight: 'bold', color: afford ? '#e8f0ff' : UI.bad });
    ctx.restore();
    const rx0 = Math.max(x, clipL), rx1 = Math.min(x + SLOT_W, clipR);
    if (rx1 - rx0 > 6)
      addRegion({
        id, x: rx0, y, w: rx1 - rx0, h: SLOT_H,
        onClick: () => isCrop ? selectCrop(it.index) : selectBuilding(it.index),
        tip: () => isCrop ? buildCropBarTooltip(it.index) : buildBuildingShopTooltip(it.index)
      });
  }

  function lockedTooltip(kind, index) {
    const def = kind === 'crops' ? CROPS[index] : (kind === 'animals' ? LIVESTOCK[index] : BUILDINGS[index]);
    const n = unlockedByTech(kind, index);
    const lines = [`[[${def.sprite}]] ${def.name}`, '✘ Locked'];
    if (n) {
      lines.push(`Unlock it with [[${n.icon}]] ${nodeTitle(n)} in the ${TREE_BRANCH_SHORT[n.branch]} branch.`);
      lines.push(arePrereqsMet(n) ? (canPay(nodeCost(n)) ? '✔ You can unlock it now' : '⚠ Not affordable yet') : '⚠ Its branch needs earlier upgrades first');
      lines.push('Click to show it in the tech tree');
    }
    return lines;
  }

  function drawActionHint(d) {
    let text;
    const mode = dockMode();
    if (mode === 'plant')
      text = `[[${CROPS[G.selectedCropIndex].sprite}]] Plant ${CROPS[G.selectedCropIndex].name} (${getSeedCost(CROPS[G.selectedCropIndex])} cr) · drag to plant or harvest an area · click a building to inspect it`;
    else if (mode === 'build' && G.selectedBuildingIndex >= 0)
      text = `[[${BUILDINGS[G.selectedBuildingIndex].sprite}]] Place ${BUILDINGS[G.selectedBuildingIndex].name} (${getBuildingCost(BUILDINGS[G.selectedBuildingIndex])} cr) · right-click a building to upgrade it`;
    else
      text = '[[hoe]] Hoe · click soil beside water to enrich it · click a rock to clear it · right-click a crop to uproot it';
    ctx.save();
    ctx.globalAlpha *= hudFade.dock ? Math.max(0.35, hudFade.dock.a) : 1;
    drawChip(text, d.x + d.w / 2, d.y - 28, 22, { align: 'center', px: 12, weight: '', bg: 'rgba(8,12,24,0.78)', border: 'rgba(126,224,106,0.35)', color: UI.text, maxW: d.w - 40 });
    ctx.restore();
  }

  /* ── Zoom chip ── */

  let zoomChipT = 0, zoomChipLast = 1;

  function drawSoilLegend(L) {
    if (!showNutrients() || G.state !== STATE_PLAYING) return;
    const full = G.soilOverlay || G.selectedTool === TOOL_HOE;
    const y = L.dock.y - 58;
    let x = L.dock.x + 4;
    const items = [['#ff6a5a', 'Poor'], ['#ffc24a', 'Fair'], ['#9be35a', 'Good'], ['#4fe08a', 'Rich']];
    ctx.save();
    ctx.globalAlpha *= hudFade.dock ? Math.max(0.4, hudFade.dock.a) : 1;
    const w = 330, h = 24;
    roundRectPath(x, y, w, h, 12);
    ctx.fillStyle = 'rgba(8,12,24,0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cx = x + 10;
    cx += fitText('[[soil]] Nutrients', cx, y + h / 2 + 1, 90, 11, { weight: 'bold', color: UI.text }) + 8;
    for (const [col, label] of items) {
      ctx.fillStyle = col;
      ctx.fillRect(cx, y + h / 2 - 3, 10, 6);
      cx += 13;
      cx += fitText(label, cx, y + h / 2 + 1, 40, 11, { color: UI.textDim }) + 7;
    }
    fitText(full ? 'N hides' : 'N shows all', cx, y + h / 2 + 1, x + w - 8 - cx, 10, { color: UI.textMute });
    ctx.restore();
    addRegion({ id: 'soil-legend', x, y, w, h, onClick: toggleSoilOverlay, tip: () => ['[[soil]] Soil nutrients', 'Pips under each plot: one per 30% fertility.', 'More nutrients, faster crops (up to 150%).', 'Raise them with the hoe beside water, compost bins and the Rich Soil upgrades.', 'Click or press N to show the overlay on every plot.'] });
  }

  function toggleSoilOverlay() {
    G.soilOverlay = !G.soilOverlay;
    SZ.GameAudio.play('click');
  }

  function drawZoomChip(L) {
    if (Math.abs(G.viewZoom - zoomChipLast) > 0.001) {
      zoomChipLast = G.viewZoom;
      zoomChipT = 2;
    }
    zoomChipT = Math.max(0, zoomChipT - G.frameDt);
    if (zoomChipT <= 0) return;
    const text = `[[zoom]] ${Math.round(G.viewZoom * 100)}%  ·  Home fits the farm`;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, zoomChipT * 2) * 0.9;
    drawChip(text, G.UW - HUD_M, L.dock.y - 58, 22, { align: 'right', px: 11, weight: '', bg: 'rgba(8,12,24,0.75)', border: 'rgba(255,255,255,0.15)', color: UI.textDim });
    ctx.restore();
  }

  Object.assign(NS, { dockItems, selectCrop, selectBuilding, setTool, drawDock, reorderPassiveRegions,
    lockedTooltip, drawSoilLegend, toggleSoilOverlay, drawZoomChip });

})();
