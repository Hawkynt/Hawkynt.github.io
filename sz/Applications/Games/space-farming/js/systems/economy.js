/* Space Farming - selling, buying seeds, placing and removing buildings, market price drift
   and solar/wind income.
   Owns: G.credits, G.priceMultipliers, G.priceChangeTimer, G.inventory, G.buildingIncomeTimer, G.priceNext,
     G.buildingIncomeAccum, G.buildingIncomeSurplusAccum
   Reads: G.UW, G.state, G.selectedCropIndex, G.selectedTool, G.gridRows, G.farmGrid, G.tileTypes,
     G.buildings, G.selectedBuildingIndex, G.energy, G.gridCols, G.uiTime, G.stats */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_WATER, STATE_PLAYING, CROPS, LIVESTOCK, TOOL_PLANT, BUILDINGS, PRICE_CHANGE_INTERVAL,
    PRICE_MIN_MULT, PRICE_MAX_MULT, screenShake, UI, getBuildingCost, getTotalInventoryCount,
    getEffectiveSellPrice, getEffectiveProduceValue, getEnergyMax, getSolarPanelIncome, getWindTurbineIncome,
    tileCenter, invalidateField, buildAnim, worldToUI, flyCoins, dustRing, techOwned, isBuildingUnlocked,
    hudLayout, popText, toast } = NS;

  /* ══════════════════════════════════════════════════════════════════
     SHOP — SELL & BUY
     ══════════════════════════════════════════════════════════════════ */

  function sellAllProduce() {
    if (G.state !== STATE_PLAYING) return;
    let totalEarned = 0;
    const bulk = techOwned('com_broker') && getTotalInventoryCount() >= 20 ? 1.1 : 1;

    for (const crop of CROPS) {
      const count = G.inventory[crop.name] || 0;
      if (count > 0) {
        const earned = Math.round(count * getEffectiveSellPrice(crop) * bulk);
        G.credits += earned;
        totalEarned += earned;
        delete G.inventory[crop.name];
      }
    }

    for (const live of LIVESTOCK) {
      const count = G.inventory[live.produce] || 0;
      if (count > 0) {
        const earned = Math.round(count * getEffectiveProduceValue(live) * bulk);
        G.credits += earned;
        totalEarned += earned;
        delete G.inventory[live.produce];
      }
    }

    if (totalEarned > 0) {
      G.stats.earned += totalEarned;
      toast(`Sold produce for ${totalEarned} credits`, UI.gold, 'coin');
      const L = hudLayout();
      const from = L.storage.h ? { x: L.storage.x + L.storage.w / 2, y: L.storage.y + L.storage.h - 30 } : { x: G.UW / 2, y: L.dock.y };
      flyCoins(Math.min(14, 3 + Math.ceil(totalEarned / 40)), from.x, from.y);
      screenShake.trigger(2, 120);
      SZ.GameAudio.play('coin');
    } else
      SZ.GameAudio.play('error', { volume: 0.6 });
  }

  function buySeed(cropIndex) {
    if (G.state !== STATE_PLAYING) return;
    G.selectedCropIndex = cropIndex;
    G.selectedTool = TOOL_PLANT;
  }

  function placeBuilding(row, col) {
    if (G.state !== STATE_PLAYING) return;
    if (G.selectedBuildingIndex < 0 || G.selectedBuildingIndex >= BUILDINGS.length) return;
    const tt = G.tileTypes[row]?.[col];
    if (tt === TILE_WATER) return;
    if (G.buildings[row]?.[col]) return; // already has a building

    const bdef = BUILDINGS[G.selectedBuildingIndex];
    if (!isBuildingUnlocked(G.selectedBuildingIndex)) return;
    const bcost = getBuildingCost(bdef);
    if (G.credits < bcost) return;

    // Destroy existing crop if any
    if (G.farmGrid[row][col] !== null) {
      G.farmGrid[row][col] = null;
      const { x: dx, y: dy } = tileCenter(col, row);
      popText(dx, dy + 6, 'Crop removed', { color: '#ffb080', font: 'bold 11px' });
    }

    G.credits -= bcost;
    ++G.stats.built;
    G.buildings[row][col] = { typeIndex: G.selectedBuildingIndex, level: 1 };
    invalidateField();

    const { x: tx, y: ty } = tileCenter(col, row);
    buildAnim[row + ',' + col] = G.uiTime;
    dustRing(tx, ty + 20);
    popText(tx, ty - 24, `-${bcost} cr`, { color: '#ff9a8a', font: 'bold 12px' });
    SZ.GameAudio.play('whoosh', { pitch: 1.4, volume: 0.5 });
    SZ.GameAudio.noise(0.15, 0.12, 'lowpass', 500, 100, 0.3);
  }

  function removeBuilding(row, col) {
    if (G.state !== STATE_PLAYING) return;
    if (!G.buildings[row]?.[col]) return;
    const bdef = BUILDINGS[G.buildings[row][col].typeIndex];
    G.buildings[row][col] = null;
    invalidateField();
    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 10, `Removed ${bdef.name}`, { color: '#fa0', font: 'bold 11px sans-serif' });
    SZ.GameAudio.play('smallExplode', { volume: 0.6 });
  }

  /* ══════════════════════════════════════════════════════════════════
     PRICE FLUCTUATION
     ══════════════════════════════════════════════════════════════════ */

  function updatePriceFluctuation(dt) {
    if (G.state !== STATE_PLAYING) return;
    G.priceChangeTimer -= dt;
    if (G.priceChangeTimer <= 0) {
      G.priceChangeTimer = PRICE_CHANGE_INTERVAL;
      const next = getNextPrices();
      for (let i = 0; i < CROPS.length; ++i)
        G.priceMultipliers[i] = next[i];
      G.priceNext = null;
      toast('Market prices changed', '#8cf', 'chart');
    }
  }

  /* The coming price change, rolled once so Market Insight can show it early */
  function getNextPrices() {
    if (!G.priceNext || G.priceNext.length !== CROPS.length) {
      G.priceNext = [];
      for (let i = 0; i < CROPS.length; ++i) {
        // Drift toward 1.0 with random perturbation
        const old = G.priceMultipliers[i] || 1;
        const drift = (1 - old) * 0.3; // mean-reversion
        const noise = (Math.random() - 0.5) * 0.6;
        G.priceNext.push(Math.max(PRICE_MIN_MULT, Math.min(PRICE_MAX_MULT, old + drift + noise)));
      }
    }
    return G.priceNext;
  }

  /* ── Building Income (Solar Panel / Wind Turbine) ── */
  const BUILDING_INCOME_INTERVAL = 5; // seconds between income ticks (short for visible feedback)
  const BUILDING_INCOME_FRACTION = BUILDING_INCOME_INTERVAL / 30; // fraction of full cycle income per tick

  function updateBuildingIncome(dt) {
    if (G.state !== STATE_PLAYING) return;
    G.buildingIncomeTimer += dt;
    if (G.buildingIncomeTimer < BUILDING_INCOME_INTERVAL) return;
    G.buildingIncomeTimer -= BUILDING_INCOME_INTERVAL;

    const energyFull = G.energy >= getEnergyMax();
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel') {
          const income = getSolarPanelIncome(bld) * BUILDING_INCOME_FRACTION;
          G.buildingIncomeAccum += income;
          if (energyFull)
            G.buildingIncomeSurplusAccum += income;
        } else if (bname === 'Wind Turbine') {
          const income = getWindTurbineIncome(bld) * BUILDING_INCOME_FRACTION;
          G.buildingIncomeAccum += income;
          if (energyFull)
            G.buildingIncomeSurplusAccum += income;
        }
      }

    // Only award whole credits; keep fractional remainder for next tick
    const earned = Math.floor(G.buildingIncomeAccum);
    const surplusBonus = Math.floor(G.buildingIncomeSurplusAccum);
    G.buildingIncomeAccum -= earned;
    G.buildingIncomeSurplusAccum -= surplusBonus;

    const total = earned + surplusBonus;
    if (total > 0) {
      G.credits += total;
      let shown = 0;
      for (let r = 0; r < G.gridRows && shown < 2; ++r)
        for (let c = 0; c < G.gridCols && shown < 2; ++c) {
          const bld = G.buildings[r]?.[c];
          if (!bld) continue;
          const bname = BUILDINGS[bld.typeIndex].name;
          if (bname !== 'Solar Panel' && bname !== 'Wind Turbine') continue;
          const p = tileCenter(c, r);
          const u = worldToUI(p.x, p.y - 20);
          flyCoins(1, u.x, u.y, { size: 14 });
          ++shown;
        }
    }
  }

  Object.assign(NS, { sellAllProduce, placeBuilding, removeBuilding, updatePriceFluctuation, getNextPrices,
    updateBuildingIncome });

})();
