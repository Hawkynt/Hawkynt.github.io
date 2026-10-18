/* Space Farming - crop growth per frame and automatic harvesting (upgrade drones and harvesters).
   Owns: G.buildingHarvestTimer, G.autoHarvestTimer
   Reads: G.state, G.gridRows, G.farmGrid, G.tileTypes, G.buildings, G.weatherType, G.currentSeason,
     G.dayPhase, G.energy, G.gridCols, G.viewZoom */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_WATER, TILE_SAND, STATE_PLAYING, CROPS, WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER,
    WEATHER_RAIN, WEATHER_THUNDERSTORM, WEATHER_SNOW, WEATHER_DUST, BUILDINGS, particles,
    getGrowthSpeedMultiplier, getTileSoilQuality, getSeasonGrowthMultiplier, getEnergyMax,
    getAutoHarvestInterval, getBuildingRange, getMinHarvesterInterval, tileCenter, harvestCrop, getField,
    techOwned } = NS;

  /* ══════════════════════════════════════════════════════════════════
     CROP GROWTH
     ══════════════════════════════════════════════════════════════════ */

  function updateCrops(dt) {
    if (G.state !== STATE_PLAYING) return;

    // Base growth multiplier from weather
    let weatherGrowthBoost = 1;
    if (G.weatherType === WEATHER_SOLAR_FLARE)
      weatherGrowthBoost = 2;
    else if (G.weatherType === WEATHER_RAIN)
      weatherGrowthBoost = 1.5;
    else if (G.weatherType === WEATHER_THUNDERSTORM)
      weatherGrowthBoost = 2;
    else if (G.weatherType === WEATHER_SNOW)
      weatherGrowthBoost = techOwned('sci_frost') ? 1 : 0.8;
    else if (G.weatherType === WEATHER_DUST)
      weatherGrowthBoost = 0.75;

    // Upgrade growth speed multiplier
    const upgradeGrowthMul = getGrowthSpeedMultiplier();
    const field = getField();

    for (let r = 0; r < G.gridRows; ++r) {
      for (let c = 0; c < G.gridCols; ++c) {
        const cell = G.farmGrid[r][c];
        if (!cell) continue;

        const crop = CROPS[cell.cropIndex];
        const maxStage = crop.stages - 1;

        // Per-crop weather affinity modifier
        let cropWeatherMul = weatherGrowthBoost;
        const fi = r * G.gridCols + c;
        if (crop.weatherAffinity === 'any')
          cropWeatherMul = Math.max(1, weatherGrowthBoost); // never penalized
        else if (crop.weatherAffinity === 'solar' && G.weatherType === WEATHER_SOLAR_FLARE)
          cropWeatherMul = 3; // extra solar bonus
        else if (crop.weatherAffinity === 'cold-vulnerable' && G.weatherType === WEATHER_METEOR_SHOWER)
          cropWeatherMul = 0.3; // growth slows in cold

        // Per-tile fertility (replaces row-based soil quality)
        const tileSoil = getTileSoilQuality(r, c);

        // Tile type modifier: sand = 0.7x growth
        let tileTypeMul = 1.0;
        if (G.tileTypes[r]?.[c] === TILE_SAND) tileTypeMul = 0.7;

        // Water adjacency bonus: +0.15 per adjacent water tile
        let waterBonus = 0;
        if (r > 0 && G.tileTypes[r - 1]?.[c] === TILE_WATER) waterBonus += 0.15;
        if (r < G.gridRows - 1 && G.tileTypes[r + 1]?.[c] === TILE_WATER) waterBonus += 0.15;
        if (c > 0 && G.tileTypes[r]?.[c - 1] === TILE_WATER) waterBonus += 0.15;
        if (c < G.gridCols - 1 && G.tileTypes[r]?.[c + 1] === TILE_WATER) waterBonus += 0.15;

        // Sprinkler bonus, Wind Turbine bonus, and Greenhouse growth bonus (all scale with level and range)
        const sprinklerBonus = field.sprinkler[fi];
        const windTurbineBonus = field.wind[fi];
        const greenhouseBonus = field.green[fi];

        // Season growth modifier (Feature 5); every crop loves one season
        let seasonMul = getSeasonGrowthMultiplier();
        if (crop.hardy && G.currentSeason === 3)
          seasonMul = 1;
        if (crop.favorite === G.currentSeason)
          seasonMul *= 1.3;
        if (crop.hardy && G.weatherType === WEATHER_SNOW)
          cropWeatherMul = 1;

        // Day/night crop restrictions (Feature 6); grow lamps keep day crops going
        const isNight = G.dayPhase >= 0.5;
        const lamp = isNight ? field.lamp[fi] : 0;
        if (crop.nightOnly && !isNight) continue; // nightOnly crops skip during day
        if (crop.dayOnly && isNight && !lamp) continue;     // dayOnly crops skip during night

        // Winter: Astral Flower and some crops won't grow
        if (G.currentSeason === 3 && (crop.name === 'Astral Flower' || crop.dayOnly)) continue;

        // Advance growth progress (soil quality, tile type, water/sprinkler/wind/greenhouse bonuses are multiplicative/additive)
        cell.growthProgress += (dt / crop.growTime) * cropWeatherMul * upgradeGrowthMul * tileSoil * tileTypeMul * seasonMul * (1 + waterBonus + sprinklerBonus + windTurbineBonus + greenhouseBonus + lamp + field.bees[fi]);

        // Check stage advancement
        const newStage = Math.min(maxStage, Math.floor(cell.growthProgress * crop.stages));
        if (newStage > cell.growthStage) {
          cell.growthStage = newStage;
          // Enhanced growth particles: green sparkles rising (scaled with zoom)
          if (G.viewZoom >= 0.5) {
            const { x: tx, y: ty } = tileCenter(c, r);
            particles.sparkle(tx, ty, Math.ceil(4 * G.viewZoom), { color: crop.color, speed: 1.5 });
            const trailCount = Math.ceil(3 * G.viewZoom);
            for (let p = 0; p < trailCount; ++p)
              particles.trail(tx + (Math.random() - 0.5) * 12, ty + 5, {
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random() * 1.5,
                color: '#4f4',
                size: 1.5 + Math.random(),
                life: 0.4 + Math.random() * 0.3,
                decay: 0.03,
                shape: 'star'
              });
          }
        }

        // Plant animation decay
        if (cell.plantAnim > 0)
          cell.plantAnim = Math.max(0, cell.plantAnim - dt * 3);
      }
    }

    // Auto-harvest upgrade (uses energy: 1 per harvest, speed scales with energy)
    const autoInterval = getAutoHarvestInterval();
    if (autoInterval > 0) {
      // Scale speed with energy: below 20% energy, auto-harvest slows to 3x interval
      const energyFraction = G.energy / getEnergyMax();
      const effectiveInterval = energyFraction < 0.2 ? autoInterval * 3 : autoInterval;
      G.autoHarvestTimer += dt;
      if (G.autoHarvestTimer >= effectiveInterval) {
        G.autoHarvestTimer -= effectiveInterval;
        if (G.energy >= 1) {
          G.energy -= 1;
          autoHarvestOneCrop();
        }
      }
    }

    // Building Harvester: auto-harvest crops in range (interval and range scale with level)
    G.buildingHarvestTimer += dt;
    const minHarvesterInterval = getMinHarvesterInterval();
    if (minHarvesterInterval > 0 && G.buildingHarvestTimer >= minHarvesterInterval) {
      G.buildingHarvestTimer -= minHarvesterInterval;
      for (let r = 0; r < G.gridRows; ++r)
        for (let c = 0; c < G.gridCols; ++c) {
          const hBld = G.buildings[r]?.[c];
          if (!hBld) continue;
          if (BUILDINGS[hBld.typeIndex].name !== 'Harvester') continue;
          // Check if this harvester's interval has elapsed (for mixed-level harvesters, use fastest)
          const range = getBuildingRange(hBld);
          for (let dr = -range; dr <= range; ++dr)
            for (let dc = -range; dc <= range; ++dc) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < G.gridRows && nc >= 0 && nc < G.gridCols) {
                const adjCell = G.farmGrid[nr][nc];
                if (adjCell && adjCell.growthStage >= CROPS[adjCell.cropIndex].stages - 1) {
                  if (G.energy >= 1) {
                    G.energy -= 1;
                    harvestCrop(nr, nc, true);
                  }
                }
              }
            }
        }
    }
  }

  /** Auto-harvest a mature crop using randomized selection for even distribution. */
  function autoHarvestOneCrop() {
    // Build list of all mature crop positions, then pick one at random
    const matureTiles = [];
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const cell = G.farmGrid[r]?.[c];
        if (!cell) continue;
        if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1)
          matureTiles.push({ r, c });
      }
    if (!matureTiles.length) return;
    const pick = matureTiles[Math.floor(Math.random() * matureTiles.length)];
    harvestCrop(pick.r, pick.c, true);
  }

  Object.assign(NS, { updateCrops });

})();
