/* Space Farming - game rules derived from upgrades and buildings: prices, growth and yield
   multipliers, storage, energy, building levels, ranges and bonuses, and the per-tile field
   cache of building effects.
   Owns: G.penVersion
   Reads: G.state, G.credits, G.gridRows, G.tileTypes, G.tileFertility, G.buildings, G.livestockPens,
     G.priceMultipliers, G.inventory, G.weatherType, G.currentSeason, G.dayPhase, G.gridCols,
     G.expansionDirection */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, BASE_GRID_ROWS, TILE_WATER, SOIL_QUALITY_TIERS, STATE_PLAYING, CROPS, LIVESTOCK,
    WEATHER_SOLAR_FLARE, WEATHER_THUNDERSTORM, WEATHER_DUST, BUILDINGS, BUILDING_MAX_LEVEL, particles,
    ENERGY_BASE_MAX, ENERGY_REGEN_BASE, tileCenter, LEGACY_CHAINS, techOwned, techChainCount, popText } = NS;

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  /* ── Upgrade Helpers ── */

  /* Levels of the old flat upgrades, now counted from their tree chains */
  function getUpgradeLevel(id) {
    const prefix = LEGACY_CHAINS[id];
    return prefix ? techChainCount(prefix) : 0;
  }

  function getSeedCost(crop) {
    return Math.max(1, Math.round(crop.seedCost * (techOwned('agri_seedbank') ? 0.8 : 1)));
  }

  function getBuildingCost(bdef) {
    return Math.round(bdef.cost * (techOwned('eng_builder') ? 0.85 : 1));
  }

  function getGrowthSpeedMultiplier() {
    const base = 1 + getUpgradeLevel('growSpeed') * 0.25;
    const soil = 1 + getUpgradeLevel('soilQuality') * 0.15;
    return base * soil;
  }

  function getYieldMultiplier() {
    const lvl = getUpgradeLevel('yieldMultiplier');
    // level 1 = 1 extra 25% chance, level 5 = guaranteed double
    return 1 + lvl * 0.2;
  }

  function getWeatherResistance() {
    // Weather Shield: 0..3 => 0%, 25%, 50%, 75%
    // Irrigation: 0..3 => 0%, 15%, 30%, 45%
    // They stack multiplicatively: combined = 1 - (1 - shield) * (1 - irrigation)
    const shield = getUpgradeLevel('weatherResist') * 0.25;
    const irrigation = getUpgradeLevel('irrigation') * 0.15;
    return 1 - (1 - shield) * (1 - irrigation);
  }

  function getMarketPriceMultiplier() {
    return 1 + getUpgradeLevel('marketAccess') * 0.10;
  }

  function getTileSoilQuality(row, col) {
    let base;
    // Use per-tile fertility if available, fallback to row-based tiers
    if (col !== undefined && G.tileFertility[row] && G.tileFertility[row][col] !== undefined)
      base = G.tileFertility[row][col];
    else {
      const tierIdx = (row < BASE_GRID_ROWS) ? 0 : Math.min(SOIL_QUALITY_TIERS.length - 1, row - BASE_GRID_ROWS + 1);
      base = SOIL_QUALITY_TIERS[tierIdx];
    }

    let bonus = getUpgradeLevel('soilQuality') * 0.15;

    // Compost Bin bonus (scales with building level and range)
    if (col !== undefined && row >= 0 && row < G.gridRows && col >= 0 && col < G.gridCols)
      bonus += getField().compost[row * G.gridCols + col];

    return Math.min(1.5, base + bonus);
  }

  function getSiloBonusMultiplier() {
    let bonus = 0;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Silo')
          bonus += getSiloSellBonus(bld);
      }
    return 1 + bonus;
  }

  function getStorageCapacity() {
    let totalStorage = 50 + techChainCount('com_storage') * 40;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Silo')
          totalStorage += getSiloStorageBonus(bld);
      }
    return totalStorage;
  }

  function getTotalInventoryCount() {
    let total = 0;
    for (const key in G.inventory)
      total += G.inventory[key] || 0;
    return total;
  }

  function getSeasonGrowthMultiplier() {
    switch (G.currentSeason) {
      case 0: return 1.10; // Spring: +10%
      case 1: return 1.25; // Summer: +25%
      case 2: return 0.90; // Autumn: -10%
      case 3: return techOwned('sci_frost') ? 0.8 : 0.60; // Winter: -40% (-20% with frost hardiness)
      default: return 1.0;
    }
  }

  function getSeasonHarvestMultiplier() {
    return G.currentSeason === 2 ? 1.15 : 1.0; // Autumn: +15% harvest
  }

  function getEffectiveSellPrice(crop) {
    const cropIdx = CROPS.indexOf(crop);
    let priceMult = (cropIdx >= 0 && cropIdx < G.priceMultipliers.length) ? G.priceMultipliers[cropIdx] : 1;
    if (techOwned('com_floor'))
      priceMult = Math.max(0.8, priceMult);
    return Math.round(crop.sellPrice * getMarketPriceMultiplier() * priceMult * getSiloBonusMultiplier());
  }

  function getEffectiveProduceValue(live) {
    return Math.round(live.produceValue * getMarketPriceMultiplier() * (1 + techChainCount('husb_premium') * 0.15));
  }

  function getEnergyMax() {
    let total = ENERGY_BASE_MAX + techChainCount('eng_grid') * 25;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel')
          total += getSolarPanelEnergyBonus(bld);
        else if (bname === 'Wind Turbine')
          total += getWindTurbineEnergyBonus(bld);
      }
    return total;
  }

  function getEnergyRegenRate() {
    let rate = ENERGY_REGEN_BASE + techChainCount('eng_grid') * 0.5;
    const isNight = G.dayPhase >= 0.5;

    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel') {
          let bonus = getSolarPanelRegenBonus(bld);
          // Solar: 0 at night, double in summer, triple during solar flares
          if (isNight)
            bonus = 0;
          else {
            if (G.currentSeason === 1) bonus *= 2; // summer
            if (G.weatherType === WEATHER_SOLAR_FLARE) bonus *= 3;
            if (G.weatherType === WEATHER_DUST) bonus *= 0.3;
          }
          rate += bonus;
        } else if (bname === 'Wind Turbine') {
          let bonus = getWindTurbineRegenBonus(bld);
          // Wind: +50% at night, double in autumn, triple during thunderstorms
          if (isNight) bonus *= 1.5;
          if (G.currentSeason === 2) bonus *= 2; // autumn
          if (G.weatherType === WEATHER_THUNDERSTORM) bonus *= 3;
          rate += bonus;
        }
      }
    return rate;
  }

  function getEstimatedStorageValue() {
    let totalValue = 0;
    for (const crop of CROPS) {
      const count = G.inventory[crop.name] || 0;
      if (count > 0)
        totalValue += count * getEffectiveSellPrice(crop);
    }
    for (const live of LIVESTOCK) {
      const count = G.inventory[live.produce] || 0;
      if (count > 0)
        totalValue += count * getEffectiveProduceValue(live);
    }
    return totalValue;
  }

  function isAdjacentToWater(row, col) {
    if (row > 0 && G.tileTypes[row - 1]?.[col] === TILE_WATER) return true;
    if (row < G.gridRows - 1 && G.tileTypes[row + 1]?.[col] === TILE_WATER) return true;
    if (col > 0 && G.tileTypes[row]?.[col - 1] === TILE_WATER) return true;
    if (col < G.gridCols - 1 && G.tileTypes[row]?.[col + 1] === TILE_WATER) return true;
    return false;
  }

  function getAutoHarvestInterval() {
    const lvl = getUpgradeLevel('autoHarvest');
    if (lvl <= 0) return 0; // disabled
    // level 1 = every 5s, level 2 = every 3s, level 3 = every 1.5s
    return [0, 5, 3, 1.5][lvl] || 0;
  }

  /* ── Building Level Upgrade Helpers ── */

  function getBuildingUpgradeCost(bld) {
    const bdef = BUILDINGS[bld.typeIndex];
    return Math.round(bdef.cost * 0.5 * (techOwned('eng_builder') ? 0.85 : 1));
  }

  function canUpgradeBuilding(bld) {
    if (!bld) return false;
    return (bld.level || 1) < BUILDING_MAX_LEVEL;
  }

  function upgradeBuilding(row, col) {
    if (G.state !== STATE_PLAYING) return;
    const bld = G.buildings[row]?.[col];
    if (!bld || !canUpgradeBuilding(bld)) return;

    const cost = getBuildingUpgradeCost(bld);
    if (G.credits < cost) return;

    G.credits -= cost;
    bld.level = (bld.level || 1) + 1;
    invalidateField();

    const bdef = BUILDINGS[bld.typeIndex];
    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 24, `${bdef.name} Lv ${bld.level}!`, { color: '#7ad8ff', font: 'bold 13px' });
    particles.confetti(tx, ty, 14, { speed: 3 });
    for (let i = 0; i < 12; ++i) {
      const a = i / 12 * TWO_PI;
      particles.trail(tx, ty, { vx: Math.cos(a) * 2.5, vy: Math.sin(a) * 2.5, color: '#ffd75a', life: 0.5, size: 2.5, decay: 0.04, shape: 'star' });
    }
    SZ.GameAudio.play('powerup', { pitch: 1 + Math.min(bld.level, 10) * 0.04 });
  }

  /** Get the effective range of a building based on its level. Base range + (level - 1). */
  function getBuildingRange(bld) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    // Silo and Fence have range 0 (global/self), no range scaling
    if (bdef.range === 0) return 0;
    return bdef.range + (lvl - 1);
  }

  /** Get the scarecrow scare radius in Chebyshev distance based on level. */
  function getScarecrowRadius(bld) {
    const lvl = bld.level || 1;
    // L1: 3x3 (radius 1), L2: 5x5 (radius 2), ..., L6: 13x13 (radius 6)
    return lvl;
  }

  /** Check if a tile (tr, tc) is within building range of building at (br, bc). */
  function isInBuildingRange(bld, br, bc, tr, tc) {
    const range = getBuildingRange(bld);
    return Math.abs(tr - br) <= range && Math.abs(tc - bc) <= range;
  }

  /** Get sprinkler growth bonus for a given level. */
  function getSprinklerBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +20%, L2: +24%, L3: +28%, L4: +32%, L5: +36%, L6: +40%
    return 0.20 + (lvl - 1) * 0.04;
  }

  /** Get wind turbine growth bonus for a given level. */
  function getWindTurbineGrowthBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +10%, L2: +15%, L3: +20%, L4: +25%, L5: +30%, L6: +35%
    return 0.10 + (lvl - 1) * 0.05;
  }

  /** Get compost bin fertility bonus for a given level. */
  function getCompostBinBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +25%, L2: +35%, L3: +45%, L4: +55%, L5: +65%, L6: +75%
    return 0.25 + (lvl - 1) * 0.10;
  }

  /** Get greenhouse growth bonus for a given level (small bonus on top of protection). */
  function getGreenhouseGrowthBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +5%, L2: +10%, L3: +15%, L4: +20%, L5: +25%, L6: +30%
    return (lvl - 1) * 0.05;
  }

  /** Get silo storage bonus for a given level. */
  function getSiloStorageBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +50, L2: +75, L3: +100, L4: +125, L5: +150, L6: +175
    return 50 + (lvl - 1) * 25;
  }

  /** Get silo sell bonus multiplier for a given level. */
  function getSiloSellBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +10%, L2: +12%, L3: +14%, L4: +16%, L5: +18%, L6: +20%
    return 0.10 + (lvl - 1) * 0.02;
  }

  /** Get solar panel max energy bonus per panel based on level. */
  function getSolarPanelEnergyBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +30, L2: +45, L3: +60, L4: +75, L5: +90, L6: +105
    return 30 + (lvl - 1) * 15;
  }

  /** Get solar panel income per cycle based on level. */
  function getSolarPanelIncome(bld) {
    const lvl = bld.level || 1;
    // L1: 2cr, L2: 3cr, L3: 4cr, L4: 5cr, L5: 6cr, L6: 7cr
    return 2 + (lvl - 1);
  }

  /** Get wind turbine income per cycle based on level. */
  function getWindTurbineIncome(bld) {
    const lvl = bld.level || 1;
    // L1: 5cr, L2: 7cr, L3: 9cr, L4: 11cr, L5: 13cr, L6: 15cr
    return 5 + (lvl - 1) * 2;
  }

  /** Get wind turbine max energy bonus per turbine based on level. */
  function getWindTurbineEnergyBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +20, L2: +40, L3: +60, L4: +80, L5: +100, L6: +120
    return 20 * lvl;
  }

  /** Get wind turbine energy regen bonus per turbine based on level. */
  function getWindTurbineRegenBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +0.5, L2: +1.0, L3: +1.5, L4: +2.0, L5: +2.5, L6: +3.0
    return 0.5 * lvl;
  }

  /** Get solar panel energy regen bonus based on level. */
  function getSolarPanelRegenBonus(bld) {
    const lvl = bld.level || 1;
    // L1: 1.0, L2: 1.4, L3: 1.8, L4: 2.2, L5: 2.6, L6: 3.0
    return 1.0 + (lvl - 1) * 0.4;
  }

  /** Get harvester interval based on level. */
  function getHarvesterInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 2s, L2: 1.6s, L3: 1.2s, L4: 0.9s, L5: 0.7s, L6: 0.5s
    return [2.0, 2.0, 1.6, 1.2, 0.9, 0.7, 0.5][lvl] || 2.0;
  }

  /** Get auto-collector interval based on level. */
  function getAutoCollectorInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 8s, L2: 5s, L3: 3s, L4: 2s, L5: 1.5s, L6: 1s
    return [8, 8, 5, 3, 2, 1.5, 1][lvl] || 8;
  }

  /** Get auto-planter interval based on level. */
  function getAutoPlanterInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 15s, L2: 12s, L3: 9s, L4: 7s, L5: 5s, L6: 3s
    return [15, 15, 12, 9, 7, 5, 3][lvl] || 15;
  }

  /** Find the fastest harvester interval on the grid (for the shared timer). */
  function getMinHarvesterInterval() {
    let minInterval = Infinity;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Harvester')
          minInterval = Math.min(minInterval, getHarvesterInterval(bld));
      }
    return minInterval === Infinity ? 0 : minInterval;
  }

  /** Number of tiles the next plot expansion strip will add. */
  function getNextExpansionTileCount() {
    // L(0), R(1) add a column (gridRows tiles); T(2), B(3) add a row (gridCols tiles)
    return (G.expansionDirection < 2) ? G.gridRows : G.gridCols;
  }

  /* ── Field cache: building effects per tile, rebuilt when anything changes ── */

  let buildVersion = 0;
  let fieldCache = null, fieldKey = '';

  function getField() {
    const key = G.gridRows + 'x' + G.gridCols + ':' + buildVersion + ':' + G.penVersion + ':' + G.livestockPens.length;
    if (fieldCache && fieldKey === key) return fieldCache;
    const n = G.gridRows * G.gridCols;
    const f = {
      sprinkler: new Float32Array(n), wind: new Float32Array(n), green: new Float32Array(n),
      compost: new Float32Array(n), shelter: new Uint8Array(n), wet: new Uint8Array(n),
      lamp: new Float32Array(n), bees: new Float32Array(n)
    };
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        const name = BUILDINGS[bld.typeIndex].name;
        const range = getBuildingRange(bld);
        if (!range) continue;
        for (let rr = Math.max(0, r - range); rr <= Math.min(G.gridRows - 1, r + range); ++rr)
          for (let cc = Math.max(0, c - range); cc <= Math.min(G.gridCols - 1, c + range); ++cc) {
            if (rr === r && cc === c) continue;
            const i = rr * G.gridCols + cc;
            if (name === 'Sprinkler') {
              f.sprinkler[i] += getSprinklerBonus(bld);
              f.wet[i] = 1;
            } else if (name === 'Wind Turbine')
              f.wind[i] += getWindTurbineGrowthBonus(bld);
            else if (name === 'Greenhouse') {
              f.green[i] += getGreenhouseGrowthBonus(bld);
              f.shelter[i] = 1;
            } else if (name === 'Compost Bin')
              f.compost[i] += getCompostBinBonus(bld);
            else if (name === 'Grow Lamp')
              f.lamp[i] = Math.max(f.lamp[i], 0.15 + ((bld.level || 1) - 1) * 0.05);
          }
      }
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c)
        if (G.tileTypes[r][c] !== TILE_WATER && isAdjacentToWater(r, c))
          f.wet[r * G.gridCols + c] = 1;
    // star bee hives pollinate crops within two tiles
    for (const pen of G.livestockPens)
      if (LIVESTOCK[pen.typeIndex].sprite === 'bee')
        for (let r = Math.max(0, pen.gridRow - 2); r <= Math.min(G.gridRows - 1, pen.gridRow + 2); ++r)
          for (let c = Math.max(0, pen.gridCol - 2); c <= Math.min(G.gridCols - 1, pen.gridCol + 2); ++c)
            f.bees[r * G.gridCols + c] = 0.15;
    fieldCache = f;
    fieldKey = key;
    return f;
  }

  function invalidateField() {
    ++buildVersion;
  }

  Object.assign(NS, { getSeedCost, getBuildingCost, getGrowthSpeedMultiplier, getYieldMultiplier,
    getWeatherResistance, getTileSoilQuality, getStorageCapacity, getTotalInventoryCount,
    getSeasonGrowthMultiplier, getSeasonHarvestMultiplier, getEffectiveSellPrice, getEffectiveProduceValue,
    getEnergyMax, getEnergyRegenRate, getEstimatedStorageValue, isAdjacentToWater, getAutoHarvestInterval,
    getBuildingUpgradeCost, canUpgradeBuilding, upgradeBuilding, getBuildingRange, getScarecrowRadius,
    getSprinklerBonus, getWindTurbineGrowthBonus, getCompostBinBonus, getGreenhouseGrowthBonus,
    getSiloStorageBonus, getSiloSellBonus, getSolarPanelEnergyBonus, getSolarPanelIncome,
    getWindTurbineIncome, getWindTurbineEnergyBonus, getWindTurbineRegenBonus, getSolarPanelRegenBonus,
    getHarvesterInterval, getAutoCollectorInterval, getAutoPlanterInterval, getMinHarvesterInterval,
    getNextExpansionTileCount, getField, invalidateField });

})();
