/* Space Farming - tooltip hover tracking and drawing, and the tooltip content for tiles,
   buildings, pens, mice, dock slots and HUD panels.
   Reads: G.UW, G.UH, G.state, G.credits, G.selectedCropIndex, G.selectedTool, G.dayCount, G.farmGrid,
     G.tileTypes, G.buildings, G.selectedBuildingIndex, G.livestockPens, G.priceMultipliers,
     G.priceChangeTimer, G.weatherType, G.weatherInterval, G.currentSeason, G.dayPhase, G.wildAnimals,
     G.expansionDirection, G.viewZoom, G.isPanning, G.isDragging, G.hoverRegionId, G.dialog, G.inspect,
     G.pointerX, G.pointerY, G.pointerUX, G.pointerUY, G.pointerInside */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { BASE_TILE_SIZE, TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND, STATE_PLAYING, CROPS, LIVESTOCK,
    WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER, WEATHER_RAIN, WEATHER_THUNDERSTORM, WEATHER_SNOW,
    WEATHER_DUST, TOOL_HOE, BUILDINGS, TOOL_BUILD, SEASONS, SEASON_SPRITES, ctx, uiFont, measureIconText,
    fillIconText, wrapText, UI, drawPanel, hitRegion, getSeedCost, getBuildingCost, getTileSoilQuality,
    getStorageCapacity, getTotalInventoryCount, getEffectiveSellPrice, getEffectiveProduceValue,
    isAdjacentToWater, getBuildingUpgradeCost, canUpgradeBuilding, getBuildingRange, getScarecrowRadius,
    getSprinklerBonus, getWindTurbineGrowthBonus, getCompostBinBonus, getGreenhouseGrowthBonus,
    getSiloStorageBonus, getSiloSellBonus, getSolarPanelEnergyBonus, getSolarPanelIncome,
    getWindTurbineIncome, getWindTurbineEnergyBonus, getWindTurbineRegenBonus, getSolarPanelRegenBonus,
    getHarvesterInterval, getAutoCollectorInterval, getAutoPlanterInterval, gridToScreen, ROCK_CLEAR_COST,
    livestockPenToScreen, forecastWeather, getNextPrices, nutrientPips, DIR_NAMES, expansionTiles,
    expansionAt, expandCost, techLevel, techOwned, hudPassThrough, storageItems, WEATHER_INFO, weatherInfo,
    getFeedInterval, TOOLTIP_DELAY, tooltip, clearTooltip, setTooltip, canvasToGrid, isInsideGrid } = NS;

  /* Re-evaluates what the pointer is over (regions first, then the farm) */
  function refreshHover() {
    if (!G.pointerInside || G.isPanning) {
      G.hoverRegionId = null;
      clearTooltip();
      return;
    }
    const r = hitRegion(G.pointerUX, G.pointerUY);
    const through = r && !r.modal && hudPassThrough(G.pointerUX, G.pointerUY);
    if (r && !through) {
      G.hoverRegionId = r.onClick || r.disabledClick ? r.id : null;
      const lines = r.tip ? r.tip() : null;
      if (lines)
        setTooltip(r.tipKey ? r.tipKey() : 'r:' + r.id, lines);
      else
        clearTooltip();
      return;
    }
    G.hoverRegionId = null;
    if (G.state !== STATE_PLAYING || G.dialog || G.isDragging) {
      clearTooltip();
      return;
    }
    const w = worldTooltip(G.pointerX, G.pointerY);
    if (w)
      setTooltip(w.key, w.lines);
    else
      clearTooltip();
  }

  function drawTooltip() {
    if (!tooltip.visible || !tooltip.lines.length) return;
    const padding = 10;
    const maxTextW = Math.min(340, G.UW * 0.4);
    let fontSize = 13;
    let rows, boxW, boxH;
    for (;;) {
      rows = [];
      let maxW = 0;
      for (let i = 0; i < tooltip.lines.length; ++i) {
        const raw = tooltip.lines[i];
        const line = typeof raw === 'object' ? raw.text : String(raw);
        const header = /^---\s*(.*?)\s*---$/.exec(line);
        if (header) {
          rows.push({ kind: 'header', text: header[1].toUpperCase(), h: fontSize + 6 });
          ctx.font = uiFont(Math.max(9, fontSize - 3), 'bold');
          maxW = Math.max(maxW, ctx.measureText(header[1].toUpperCase()).width + 30);
          continue;
        }
        const title = i === 0;
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        for (const w of wrapText(line, maxTextW)) {
          rows.push({ kind: title ? 'title' : 'text', text: w, h: (title ? fontSize + 2 : fontSize) * 1.42, src: line, color: typeof raw === 'object' ? raw.color : null });
          maxW = Math.max(maxW, measureIconText(w));
        }
      }
      boxW = Math.ceil(maxW) + padding * 2;
      boxH = padding * 2;
      for (const r of rows)
        boxH += r.h;
      if (boxH <= G.UH - 16 || fontSize <= 10)
        break;
      --fontSize;
    }
    boxW = Math.max(boxW, 120);
    let bx = G.pointerUX + 18, by = G.pointerUY + 20;
    if (bx + boxW > G.UW - 8) bx = G.pointerUX - boxW - 12;
    if (by + boxH > G.UH - 8) by = G.pointerUY - boxH - 12;
    bx = Math.max(8, Math.min(G.UW - 8 - boxW, bx));
    by = Math.max(8, Math.min(G.UH - 8 - boxH, by));
    const a = Math.min(1, (tooltip.timer - TOOLTIP_DELAY) * 10 + 1);
    ctx.save();
    ctx.globalAlpha *= a;
    drawPanel(bx, by, boxW, boxH, { accent: UI.gold, radius: 9, shadow: 12 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let y = by + padding;
    for (const r of rows) {
      const cy = y + r.h / 2;
      if (r.kind === 'header') {
        ctx.font = uiFont(Math.max(9, fontSize - 3), 'bold');
        ctx.fillStyle = UI.textMute;
        ctx.fillText(r.text, bx + padding, cy + 1);
        const tw = ctx.measureText(r.text).width;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bx + padding + tw + 8, cy, boxW - padding * 2 - tw - 8, 1);
      } else {
        const title = r.kind === 'title';
        ctx.font = uiFont(title ? fontSize + 2 : fontSize, title ? 'bold' : '');
        let color = r.color || (title ? UI.gold : '#c4cde0');
        if (!r.color && !title) {
          if (r.src.startsWith('✔')) color = UI.good;
          else if (r.src.startsWith('✘')) color = UI.bad;
          else if (r.src.startsWith('⚠')) color = UI.warn;
        }
        ctx.fillStyle = color;
        fillIconText(r.text, bx + padding, cy + 1);
      }
      y += r.h;
    }
    ctx.restore();
  }

  /* ── Tooltip content ── */

  function adjacentWaterCount(row, col) {
    let n = 0;
    if (G.tileTypes[row - 1]?.[col] === TILE_WATER) ++n;
    if (G.tileTypes[row + 1]?.[col] === TILE_WATER) ++n;
    if (G.tileTypes[row]?.[col - 1] === TILE_WATER) ++n;
    if (G.tileTypes[row]?.[col + 1] === TILE_WATER) ++n;
    return n;
  }

  function fertilityLine(row, col) {
    const sq = getTileSoilQuality(row, col);
    const pct = Math.round(sq * 100);
    const pips = '●'.repeat(nutrientPips(sq)) + '○'.repeat(5 - nutrientPips(sq));
    if (sq < 1)
      return `⚠ Nutrients ${pips} ${pct}%: crops grow ${100 - pct}% slower`;
    if (sq > 1)
      return `✔ Nutrients ${pips} ${pct}%: crops grow ${pct - 100}% faster`;
    return `Nutrients ${pips} ${pct}%`;
  }

  function buildCropTileTooltip(cell, row, col) {
    const crop = CROPS[cell.cropIndex];
    const mature = cell.growthStage >= crop.stages - 1;
    const progress = Math.min(100, Math.round(cell.growthProgress * 100));
    const effPrice = getEffectiveSellPrice(crop);
    const lines = [`[[${crop.sprite}]] ${crop.name}`];
    lines.push(mature ? '✔ Ripe: click to harvest' : `Stage ${cell.growthStage + 1} of ${crop.stages} · ${progress}% grown`);
    lines.push(`Sells for ${effPrice} cr` + (effPrice !== crop.sellPrice ? ` (normally ${crop.sellPrice})` : ''));
    lines.push('--- Plot ---');
    lines.push(fertilityLine(row, col));
    if (G.tileTypes[row]?.[col] === TILE_SAND)
      lines.push('⚠ Sandy soil: 70% growth');
    const water = adjacentWaterCount(row, col);
    if (water)
      lines.push(`✔ Water nearby: +${water * 15}% growth`);
    if (crop.favorite === G.currentSeason)
      lines.push(`✔ In season: +30% growth`);
    if (crop.nightOnly && G.dayPhase < 0.5)
      lines.push('⚠ Sleeping until night');
    if (crop.dayOnly && G.dayPhase >= 0.5)
      lines.push('⚠ Sleeping until morning');
    return lines;
  }

  function buildingStatLines(bld, row, col) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lines = [bdef.desc];
    switch (bdef.name) {
      case 'Sprinkler':
        lines.push(`Growth +${Math.round(getSprinklerBonus(bld) * 100)}% · range ${getBuildingRange(bld)}`);
        break;
      case 'Harvester':
        lines.push(`Harvests every ${getHarvesterInterval(bld).toFixed(1)}s · range ${getBuildingRange(bld)}`);
        break;
      case 'Greenhouse':
        lines.push(`Shields range ${getBuildingRange(bld)} · growth +${Math.round(getGreenhouseGrowthBonus(bld) * 100)}%`);
        break;
      case 'Silo':
        lines.push(`Storage +${getSiloStorageBonus(bld)} · sell prices +${Math.round(getSiloSellBonus(bld) * 100)}%`);
        break;
      case 'Solar Panel':
        lines.push(`+${getSolarPanelIncome(bld)} cr per 30s · energy +${getSolarPanelEnergyBonus(bld)}`);
        lines.push(`Charges +${getSolarPanelRegenBonus(bld).toFixed(1)}/s by day`);
        break;
      case 'Wind Turbine':
        lines.push(`+${getWindTurbineIncome(bld)} cr per 30s · growth +${Math.round(getWindTurbineGrowthBonus(bld) * 100)}%`);
        lines.push(`Energy +${getWindTurbineEnergyBonus(bld)} · +${getWindTurbineRegenBonus(bld).toFixed(1)}/s`);
        break;
      case 'Compost Bin':
        lines.push(`Fertility +${Math.round(getCompostBinBonus(bld) * 100)}% · range ${getBuildingRange(bld)}`);
        break;
      case 'Scarecrow': {
        const r = getScarecrowRadius(bld);
        lines.push(`Scares mice in a ${r * 2 + 1}×${r * 2 + 1} area`);
        break;
      }
      case 'Fence':
        lines.push((bld.level || 1) >= 5 ? 'Blocks and zaps mice' : ((bld.level || 1) >= 3 ? 'Slows mice down' : 'Blocks mice'));
        break;
      case 'Auto-Planter L1':
      case 'Auto-Planter L2':
        lines.push(`Plants every ${getAutoPlanterInterval(bld)}s · range ${getBuildingRange(bld)}`);
        break;
      case 'Auto-Collector': {
        const range = getBuildingRange(bld);
        let pens = 0;
        for (const pen of G.livestockPens)
          if (Math.abs(pen.gridRow - row) <= range && Math.abs(pen.gridCol - col) <= range)
            ++pens;
        lines.push(`Collects every ${getAutoCollectorInterval(bld)}s · range ${range}`);
        lines.push(`${pens} animal${pens === 1 ? '' : 's'} in range`);
        break;
      }
    }
    return lines;
  }

  function buildBuildingTileTooltip(bld, row, col) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    const lines = [`[[${bdef.sprite}]] ${bdef.name} · Lv ${lvl}`].concat(buildingStatLines(bld, row, col));
    if (canUpgradeBuilding(bld)) {
      const cost = getBuildingUpgradeCost(bld);
      lines.push(G.credits >= cost ? `✔ Upgrade to Lv ${lvl + 1}: ${cost} cr` : `✘ Upgrade to Lv ${lvl + 1}: ${cost} cr`);
    } else
      lines.push('✔ Max level');
    lines.push('Click to inspect · right-click upgrades');
    return lines;
  }

  function buildEmptyTileTooltip(row, col) {
    const tt = G.tileTypes[row]?.[col] ?? TILE_FARMLAND;
    if (tt === TILE_WATER)
      return ['Water', '✔ Crops next to it grow 15% faster', 'Click with the hoe to enrich the soil around it', '✘ Nothing can be planted or built here'];
    if (tt === TILE_ROCK) {
      const lines = ['[[rockpile]] Rock', '✘ Crops can\'t grow on rock', '✔ Buildings can stand on it'];
      if (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex >= 0) {
        const b = BUILDINGS[G.selectedBuildingIndex];
        lines.push((G.credits >= getBuildingCost(b) ? '✔ ' : '✘ ') + `Click to build ${b.name} (${getBuildingCost(b)} cr)`);
      } else
        lines.push(G.selectedTool === TOOL_HOE ? ((G.credits >= ROCK_CLEAR_COST ? '✔ ' : '✘ ') + `Click to clear it (${ROCK_CLEAR_COST} cr)`) : `[[hoe]] Clear it with the hoe (T) for ${ROCK_CLEAR_COST} cr`);
      return lines;
    }
    const lines = [tt === TILE_SAND ? 'Sandy plot' : 'Empty plot'];
    if (G.selectedTool === TOOL_BUILD && G.selectedBuildingIndex >= 0) {
      const b = BUILDINGS[G.selectedBuildingIndex];
      lines.push((G.credits >= getBuildingCost(b) ? '✔ ' : '✘ ') + `Click to build ${b.name} (${getBuildingCost(b)} cr)`);
    } else if (G.selectedTool === TOOL_HOE) {
      lines.push(isAdjacentToWater(row, col) ? '✔ Click to enrich the soil' : '⚠ Too far from water to enrich');
    } else {
      const crop = CROPS[G.selectedCropIndex];
      lines.push((G.credits >= getSeedCost(crop) ? '✔ ' : '✘ ') + `Click to plant ${crop.name} (${getSeedCost(crop)} cr)`);
    }
    lines.push(fertilityLine(row, col));
    if (tt === TILE_SAND)
      lines.push('⚠ Sandy soil: 70% growth');
    const water = adjacentWaterCount(row, col);
    if (water)
      lines.push(`✔ Water nearby: +${water * 15}% growth`);
    return lines;
  }

  function buildCropBarTooltip(cropIndex) {
    const crop = CROPS[cropIndex];
    const effPrice = getEffectiveSellPrice(crop);
    const pm = G.priceMultipliers[cropIndex] || 1;
    const lines = [`[[${crop.sprite}]] ${crop.name}`, `Seed ${getSeedCost(crop)} cr · sells for ${effPrice} cr`, `Grows in ${crop.growTime}s over ${crop.stages} stages`];
    if (pm > 1.05)
      lines.push(`✔ Market ${pm.toFixed(2)}×: good time to sell`);
    else if (pm < 0.95)
      lines.push(`⚠ Market ${pm.toFixed(2)}×: prices are low`);
    if (techOwned('com_insight')) {
      const nx = getNextPrices()[cropIndex];
      lines.push(`[[scroll]] In ${Math.ceil(G.priceChangeTimer)}s: ${nx.toFixed(2)}× ` + (nx > pm + 0.03 ? '(rising)' : (nx < pm - 0.03 ? '(falling)' : '(steady)')));
    }
    if (crop.weatherAffinity === 'any')
      lines.push('✔ Ignores weather and meteors');
    else if (crop.weatherAffinity === 'solar')
      lines.push('✔ Solar flares triple its growth');
    else if (crop.weatherAffinity === 'cold-vulnerable')
      lines.push('⚠ Meteor showers hit it hard');
    if (crop.nightOnly)
      lines.push('Grows only at night');
    if (crop.dayOnly)
      lines.push('Grows only by day (or under a grow lamp)');
    if (crop.hardy)
      lines.push('✔ Ignores winter and snowfall');
    lines.push(crop.favorite === G.currentSeason ? `✔ In season: [[${SEASON_SPRITES[crop.favorite]}]] +30% growth` : `Loves [[${SEASON_SPRITES[crop.favorite]}]] ${SEASONS[crop.favorite].toLowerCase()} (+30% growth)`);
    return lines;
  }

  function buildBuildingShopTooltip(i) {
    const b = BUILDINGS[i];
    const lines = [`[[${b.sprite}]] ${b.name}`, b.desc, (G.credits >= getBuildingCost(b) ? '✔ ' : '✘ ') + `Costs ${getBuildingCost(b)} cr`];
    lines.push(b.range > 0 ? `Works on tiles within ${b.range} (grows with level)` : 'Affects the whole farm');
    if (b.name === 'Silo')
      lines.push(`Storage now ${getTotalInventoryCount()}/${getStorageCapacity()}: +50 per silo`);
    if (b.name === 'Solar Panel')
      lines.push('Also +30 max energy and +1/s charge by day');
    if (b.name === 'Wind Turbine')
      lines.push('Also +20 max energy and +0.5/s charge');
    if (b.name === 'Auto-Collector')
      lines.push('Place it beside the animal pens');
    lines.push('Upgradeable to level 6');
    return lines;
  }

  function buildSellButtonTooltip() {
    const items = storageItems();
    const lines = ['[[coin]] Sell all produce'];
    if (!items.length)
      lines.push('⚠ Storage is empty');
    else {
      let total = 0, count = 0;
      for (const it of items) {
        total += it.count * it.value;
        count += it.count;
      }
      lines.push(`✔ ${count} items for ${total} cr`);
    }
    lines.push('Shortcut: S');
    return lines;
  }

  function buildLivestockBuyTooltip(typeIndex) {
    const def = LIVESTOCK[typeIndex];
    return [`[[${def.sprite}]] ${def.name}`, (G.credits >= def.cost ? '✔ ' : '✘ ') + `Costs ${def.cost} cr`, `[[${def.produceSprite}]] ${def.produce} every ${getFeedInterval(def)}s, worth ${getEffectiveProduceValue(def)} cr`, 'Lives in a pen at the edge of the farm'];
  }

  function buildLivestockPenTooltip(pen) {
    const def = LIVESTOCK[pen.typeIndex];
    const lines = [`[[${def.sprite}]] ${def.name}`];
    if (pen.produceReady)
      lines.push(`✔ [[${def.produceSprite}]] ${def.produce} ready: click to collect`);
    else
      lines.push(`Next ${def.produce} in ${Math.max(0, Math.ceil(pen.feedTimer))}s`);
    lines.push(`Worth ${getEffectiveProduceValue(def)} cr each`);
    return lines;
  }

  function buildClockTooltip() {
    const isNight = G.dayPhase >= 0.5;
    const effects = [
      '✔ Spring: crops grow 10% faster',
      '✔ Summer: crops grow 25% faster, more solar flares',
      '✔ Autumn: 15% bigger harvests, 10% slower growth',
      '⚠ Winter: 40% slower growth, snowfall'
    ];
    return [
      `[[${SEASON_SPRITES[G.currentSeason]}]] ${SEASONS[G.currentSeason]} · Day ${G.dayCount}`,
      effects[G.currentSeason],
      'A day lasts 30 seconds, a season four days.',
      isNight ? 'Night: lunar moss grows, solar vines sleep.' : 'Day: solar vines grow, lunar moss sleeps.'
    ];
  }

  function buildWeatherTooltip() {
    const wi = weatherInfo();
    const lines = [`[[${wi.icon}]] ${wi.name}`];
    switch (G.weatherType) {
      case WEATHER_SOLAR_FLARE: lines.push('✔ Crops grow twice as fast, sun-lovers three times'); break;
      case WEATHER_METEOR_SHOWER: lines.push('✘ Meteors smash unprotected crops', 'Greenhouses and the weather shield help'); break;
      case WEATHER_RAIN: lines.push('✔ Crops grow 50% faster'); break;
      case WEATHER_THUNDERSTORM: lines.push('✔ Crops grow twice as fast', '✘ Lightning may destroy crops or scare off animals', 'Wind turbines charge three times faster'); break;
      case WEATHER_SNOW: lines.push('⚠ Crops grow 20% slower while it snows'); break;
      case WEATHER_DUST: lines.push('⚠ Crops grow 25% slower', '⚠ Solar panels barely charge'); break;
      default:
        if (techOwned('sci_forecast')) {
          const nx = WEATHER_INFO[forecastWeather()] || WEATHER_INFO.none;
          lines.push(`[[eye]] Forecast: ${nx.name} in ${Math.ceil(G.weatherInterval)}s`);
        }
        lines.push(['Spring brings rain and the odd storm.', 'Summer brings solar flares, storms and dust.', 'Autumn brings rain, dust and meteors.', 'Winter brings snow and the odd meteor shower.'][G.currentSeason], 'Weather changes every 25-50 seconds.');
        break;
    }
    return lines;
  }

  function toolTooltip(mode) {
    if (mode === 'plant')
      return ['[[seedbag]] Seeds', 'Pick a crop below, then click or drag over empty soil.', 'Clicking ripe crops harvests them.', 'Shortcut: P, number keys pick crops'];
    if (mode === 'build')
      return ['[[hammer]] Build', 'Pick a building below, then click a tile.', 'Buildings work on the tiles around them.', 'Shortcut: B'];
    return ['[[hoe]] Hoe', 'Enrich soil beside water (+20% nutrients).', 'Turns sand into farmland.', `Breaks up rocks for ${ROCK_CLEAR_COST} cr.`, 'Right-click a crop to uproot it.', 'Shortcut: T'];
  }

  function nearestAnimalAt(sx, sy) {
    for (let i = G.wildAnimals.length - 1; i >= 0; --i) {
      const a = G.wildAnimals[i];
      const g = gridToScreen(a.rx !== undefined ? a.rx : a.x, a.ry !== undefined ? a.ry : a.y);
      const ax = g.x + g.size / 2, ay = g.y + g.size / 2;
      if (Math.hypot(sx - ax, sy - ay) < Math.max(18, 22 * G.viewZoom))
        return i;
    }
    return -1;
  }

  function penAt(sx, sy) {
    const half = BASE_TILE_SIZE * G.viewZoom / 2;
    for (let i = 0; i < G.livestockPens.length; ++i) {
      const s = livestockPenToScreen(G.livestockPens[i]);
      if (sx >= s.x - half && sx <= s.x + half && sy >= s.y - half && sy <= s.y + half)
        return i;
    }
    return -1;
  }

  /* Tooltip for the farm under the pointer (screen px) */
  function worldTooltip(sx, sy) {
    const ai = nearestAnimalAt(sx, sy);
    if (ai >= 0)
      return { key: 'mouse:' + ai, lines: ['[[mouse]] Space mouse', '✘ Eats the nearest crop', '✔ Click it to chase it off: +10 cr', 'Scarecrows and fences keep mice out'] };
    const pi = penAt(sx, sy);
    if (pi >= 0)
      return { key: 'pen:' + pi + ':' + (G.livestockPens[pi].produceReady ? 1 : 0), lines: buildLivestockPenTooltip(G.livestockPens[pi]) };
    if (expansionAt(sx, sy)) {
      const cost = expandCost();
      return { key: 'expand:' + techLevel('eng_land') + ':' + (G.credits >= cost ? 1 : 0), lines: [
        '[[map]] Expand the field',
        `Adds ${expansionTiles().length} new plots on the ${DIR_NAMES[G.expansionDirection]} side.`,
        (G.credits >= cost ? '✔ ' : '✘ ') + `Costs ${cost} credits`,
        'Click or press E · also in the tech tree (Engineering)'
      ] };
    }
    const { col, row } = canvasToGrid(sx, sy);
    if (!isInsideGrid(col, row))
      return null;
    const key = 'tile:' + row + ':' + col;
    const tt = G.tileTypes[row]?.[col] ?? TILE_FARMLAND;
    if (tt === TILE_WATER)
      return { key, lines: buildEmptyTileTooltip(row, col) };
    const bld = G.buildings[row]?.[col];
    if (bld) {
      if (G.inspect && G.inspect.row === row && G.inspect.col === col)
        return null;
      return { key: key + ':b' + (bld.level || 1), lines: buildBuildingTileTooltip(bld, row, col) };
    }
    const cell = G.farmGrid[row][col];
    return { key: key + (cell ? ':c' + cell.growthStage : ':e'), lines: cell ? buildCropTileTooltip(cell, row, col) : buildEmptyTileTooltip(row, col) };
  }

  Object.assign(NS, { refreshHover, drawTooltip, buildingStatLines, buildCropBarTooltip,
    buildBuildingShopTooltip, buildSellButtonTooltip, buildLivestockBuyTooltip, buildClockTooltip,
    buildWeatherTooltip, toolTooltip, nearestAnimalAt, penAt });

})();
