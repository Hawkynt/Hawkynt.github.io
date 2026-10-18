;(function() {
  'use strict';

  // Resource HUD, cargo tooltip, stack icons and the underground tool HUD.
  // Owns: NS.mineHud
  // Reads: constants, dom, sprites, textLayout, panels, hudFading, rules, time, cargo, chests
  // Reads state of: gameState, chests

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W } = NS.constants;
  const { ctx } = NS.dom;
  const { getSprite, drawSprite } = NS.sprites;
  const { fitText } = NS.textLayout;
  const { UI, drawPanel, drawMeter, drawChip } = NS.panels;
  const { beginHudPanel, endHudPanel } = NS.hudFading;
  const { DEPTH_TIERS, getDepthTier, TOOL_DEFS } = NS.rules;
  const { drawMineClock } = NS.time;
  const { compressionLevel, packedStacks, packedName } = NS.cargo;
  const { chestsOpened } = NS.chests;

  // Resource HUD display configuration
  const RESOURCE_HUD_ENTRIES = [
    { key: 'iron', label: 'Fe', color: '#bbb' },
    { key: 'water', label: 'H2O', color: '#6af' },
    { key: 'cobalt', label: 'Co', color: '#88c' },
    { key: 'copper', label: 'Cu', color: '#d4944d' },
    { key: 'tin', label: 'Sn', color: '#d4d4d4' },
    { key: 'coal', label: 'C', color: '#888' },
    { key: 'lead', label: 'Pb', color: '#999' },
    { key: 'silver', label: 'Ag', color: '#e0e0e0' },
    { key: 'gold', label: 'Au', color: '#ffd700' },
    { key: 'quartz', label: 'Qz', color: '#f0e6d3' },
    { key: 'redstone', label: 'Rs', color: '#ff3333' },
    { key: 'emerald', label: 'Em', color: '#50c878' },
    { key: 'diamond', label: 'Di', color: '#b9f2ff' },
    { key: 'ruby', label: 'Rb', color: '#ff4488' },
    { key: 'titanium', label: 'Ti', color: '#c8dcf4' },
    { key: 'sapphire', label: 'Sa', color: '#6aa0ff' },
    { key: 'uranium', label: 'U', color: '#9aff5a' },
    { key: 'amethyst', label: 'Am', color: '#d090ff' },
    { key: 'opal', label: 'Op', color: '#ffd080' },
    { key: 'voidstone', label: 'Vd', color: '#b48aff' }
  ];

  function drawResourceHUD() {
    // Only show resources the player has collected (non-zero) plus the base 3
    const visibleEntries = RESOURCE_HUD_ENTRIES.filter(
      (e, i) => i < 3 || G.resources[e.key] > 0
    );
    const lineH = 26;
    const useColumns = visibleEntries.length > 7;
    const colEntries = useColumns ? Math.ceil(visibleEntries.length / 2) : visibleEntries.length;
    const colW = 168;
    const panelX = 16, panelY = 16;
    const panelW = 16 + (useColumns ? 2 : 1) * colW;
    const panelH = 14 + colEntries * lineH;

    beginHudPanel('resources', panelX, panelY, panelW, panelH);
    drawPanel(panelX, panelY, panelW, panelH, { accent: '#c8a060', shadow: 10 });
    ctx.textBaseline = 'middle';
    for (let i = 0; i < visibleEntries.length; ++i) {
      const e = visibleEntries[i];
      const col = useColumns ? Math.floor(i / colEntries) : 0;
      const row = useColumns ? i % colEntries : i;
      const x = panelX + 10 + col * colW;
      const y = panelY + 7 + row * lineH + lineH / 2;
      drawSprite(e.key, x + 10, y, 20);
      ctx.textAlign = 'left';
      fitText(e.label, x + 26, y + 1, 44, 15, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(String(G.resources[e.key]), x + colW - 12, y + 1, colW - 84, 18, { weight: 'bold', color: e.color });
    }
    endHudPanel();

    // Cargo and depth (top-right); a row of packed stacks while the bag holds ore
    const carryX = CANVAS_W - 296, carryW = 280;
    const stacks = bagStackList();
    const stackH = stacks.length ? 34 : 0;
    G.cargoPanelH = 112 + stackH;
    G.cargoPanelRect = { x: carryX, y: panelY, w: carryW, h: G.cargoPanelH };
    beginHudPanel('cargo', carryX, panelY, carryW, G.cargoPanelH);
    drawPanel(carryX, panelY, carryW, G.cargoPanelH, { accent: '#e0c060', shadow: 10 });
    const carryRatio = Math.min(G.carried / G.carryCapacity, 1);
    drawSprite('bag', carryX + 24, panelY + 24, 24);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Cargo', carryX + 44, panelY + 25, 90, 18, { weight: 'bold', color: UI.text });
    ctx.textAlign = 'right';
    fitText(`${G.carried} / ${G.carryCapacity} slots`, carryX + carryW - 16, panelY + 25, 170, 18, { weight: 'bold', color: carryRatio >= 1 ? UI.bad : '#f0d070' });
    drawMeter(carryX + 14, panelY + 42, carryW - 28, 10, carryRatio, carryRatio >= 1 ? '#e84040' : '#e0b030');
    if (stacks.length) {
      const sy = panelY + 58 + 13, cell = 40;
      const show = stacks.length > 6 ? 5 : 6;
      for (let i = 0; i < Math.min(show, stacks.length); ++i) {
        const st = stacks[i], sx = carryX + 16 + i * cell;
        ctx.drawImage(getStackIcon(st.label, st.tier), sx, sy - 13, 26, 26);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText(String(st.count), sx + 25, sy + 6, cell - 24, 12, { weight: 'bold', color: '#fff', outline: 'rgba(0,0,0,0.8)', minPx: 8 });
      }
      if (stacks.length > show) {
        ctx.textAlign = 'left';
        fitText(`+${stacks.length - show}`, carryX + 16 + show * cell + 2, sy + 1, carryW - 32 - show * cell, 14, { weight: 'bold', color: UI.textDim });
      }
    }
    const infoY = panelY + 68 + stackH;
    ctx.textAlign = 'left';
    ctx.textAlign = 'right';
    const chw = fitText(`[[chest]] ${chestsOpened()} / ${G.chests.length}`, carryX + carryW - 16, infoY, 80, 15, { weight: 'bold', color: '#e0b0ff' });
    ctx.textAlign = 'left';
    fitText(`Depth ${G.drillY} m  ·  ${DEPTH_TIERS[getDepthTier(G.drillY)].name}`, carryX + 16, infoY, carryW - 40 - chw, 15, { color: UI.textDim });
    drawMineClock(carryX + 14, infoY + 26, carryW - 28);
    endHudPanel();
  }

  // Packed stacks of the bag, the ones holding the most ore first
  function bagStackList() {
    const L = compressionLevel(), out = [];
    for (const label in G.bag)
      for (const st of packedStacks(G.bag[label], L))
        out.push({ label, tier: st.tier, count: st.count, ore: st.count * Math.pow(9, st.tier) });
    out.sort((a, b) => b.ore - a.ore || b.tier - a.tier);
    return out;
  }

  function cargoTooltipLines() {
    const stacks = bagStackList();
    const lines = ['[[bag]] Cargo: ' + G.carried + ' / ' + G.carryCapacity + ' slots'];
    if (!stacks.length)
      lines.push('The bag is empty');
    for (const st of stacks)
      lines.push(`[[${st.label}]] ${st.count} x ${packedName(st.label, st.tier)}` + (st.tier ? ` (${st.ore} ore)` : ''));
    const L = compressionLevel();
    if (L)
      lines.push(`Compressor ${L}: 9 of a kind pack into the next tier`);
    return lines;
  }

  // Ore icon with a frame per packing tier (cached)
  const stackIconCache = new Map();
  function getStackIcon(label, tier) {
    const key = label + '|' + tier;
    let c = stackIconCache.get(key);
    if (c) return c;
    const S = 52;   // drawn at 26 px, twice the resolution
    c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const img = getSprite(label);
    g.imageSmoothingEnabled = false;
    const inner = tier ? 30 : 40;
    if (img)
      g.drawImage(img, (S - inner) / 2, (S - inner) / 2, inner, inner);
    const frame = (inset, color, width) => {
      g.lineWidth = width;
      g.strokeStyle = color;
      g.strokeRect(inset + width / 2, inset + width / 2, S - inset * 2 - width, S - inset * 2 - width);
    };
    if (tier === 1)
      frame(4, '#d8d8e0', 3);
    else if (tier === 2) {
      frame(2, '#d8d8e0', 3);
      frame(7, '#9aa0b0', 2);
    } else if (tier === 3) {
      frame(1, '#e8e8f0', 2);
      frame(5, '#b0b6c8', 2);
      frame(9, '#8a90a0', 2);
    } else if (tier === 4) {
      frame(2, '#ffd75a', 4);
      frame(8, '#b8741a', 2);
    } else if (tier === 5) {
      g.shadowColor = '#d070ff';
      g.shadowBlur = 8;
      frame(4, '#c070ff', 4);
      g.shadowBlur = 0;
      frame(9, '#f0c8ff', 1.5);
    }
    stackIconCache.set(key, c);
    return c;
  }

  // Returns the bottom edge of the panel
  function drawToolHUDUnderground() {
    const tools = TOOL_DEFS.filter(d => G.unlockedTools[d.key]);
    if (!tools.length) return 16 + G.cargoPanelH;

    const hudX = CANVAS_W - 296, hudW = 280;
    const hudY = 16 + G.cargoPanelH + 12;
    const rowH = 30;
    beginHudPanel('tools', hudX, hudY, hudW, 12 + tools.length * rowH);
    drawPanel(hudX, hudY, hudW, 12 + tools.length * rowH, { accent: '#9a7aff', shadow: 10 });

    for (let i = 0; i < tools.length; ++i) {
      const def = tools[i];
      const y = hudY + 6 + i * rowH + rowH / 2;
      const isActive = G.activeToolKey === def.key;
      const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';
      let label = def.name, status = '', color = UI.textDim;
      if (def.key === 'blastTool') {
        label = 'Blast';
        const cd = G.toolState.blastToolCooldown > 0;
        status = cd ? Math.ceil(G.toolState.blastToolCooldown) + 's' : 'RDY';
        color = cd ? UI.textMute : (isActive ? UI.gold : '#ffa040');
      } else if (def.key === 'teleporter') {
        label = 'Teleport';
        const cd = G.toolState.teleporterCooldown > 0;
        status = cd ? Math.ceil(G.toolState.teleporterCooldown) + 's' : 'RDY';
        color = cd ? UI.textMute : '#c890ff';
      } else if (def.key === 'drill') {
        label = 'Drill';
        status = isActive ? 'SEL' : '';
        color = isActive ? UI.gold : UI.textDim;
      } else if (isPassive) {
        status = 'ON';
        color = UI.good;
      }
      drawChip(def.shortcut, hudX + 10, y - 11, 22, { px: 13, bg: 'rgba(0,0,0,0.45)', border: 'rgba(255,255,255,0.18)', color: UI.textDim });
      drawSprite(def.icon, hudX + 50, y, 20);
      let sw = 0;
      if (status)
        sw = drawChip(status, hudX + hudW - 12, y - 11, 22, { align: 'right', px: 12, bg: 'rgba(255,255,255,0.08)', color });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(label, hudX + 66, y + 1, hudW - 66 - 20 - sw, 16, { weight: 'bold', color });
    }
    endHudPanel();
    return hudY + 12 + tools.length * rowH;
  }

  NS.mineHud = { RESOURCE_HUD_ENTRIES, drawResourceHUD, cargoTooltipLines, drawToolHUDUnderground };
})();
