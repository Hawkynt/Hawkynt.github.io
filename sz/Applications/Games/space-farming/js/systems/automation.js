/* Space Farming - automation: auto-collectors, auto-planters, the shuffled work orders they
   share, and energy regeneration.
   Owns: G.energy, G.autoPlanterTimer, G.shuffleCacheTimer, G.cachedHarvestOrder, G.cachedPlantOrder,
     G.autoCollectorTimer
   Reads: G.state, G.credits, G.selectedCropIndex, G.gridRows, G.farmGrid, G.tileTypes, G.buildings,
     G.livestockPens, G.priceMultipliers, G.inventory, G.gridCols, G.viewZoom */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_ROCK, TILE_WATER, STATE_PLAYING, CROPS, LIVESTOCK, BUILDINGS, particles,
    SHUFFLE_CACHE_INTERVAL, getSeedCost, getEnergyMax, getEnergyRegenRate, getBuildingRange,
    getAutoCollectorInterval, getAutoPlanterInterval, tileCenter, penCenter, flyProduce, techOwned,
    isCropUnlocked, popText, getFeedInterval } = NS;

  /* ── Auto-Collector Buildings ── */
  function updateAutoCollector(dt) {
    if (G.state !== STATE_PLAYING) return;
    if (!G.livestockPens.length) return;

    G.autoCollectorTimer += dt;

    // Find the fastest auto-collector interval on the grid
    let minInterval = Infinity;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        if (BUILDINGS[bld.typeIndex].name !== 'Auto-Collector') continue;
        minInterval = Math.min(minInterval, getAutoCollectorInterval(bld));
      }
    if (minInterval === Infinity) return;
    if (G.autoCollectorTimer < minInterval) return;
    G.autoCollectorTimer -= minInterval;

    // For each auto-collector building, check livestock pens within range
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        if (BUILDINGS[bld.typeIndex].name !== 'Auto-Collector') continue;

        const range = getBuildingRange(bld);
        for (let pi = 0; pi < G.livestockPens.length; ++pi) {
          const pen = G.livestockPens[pi];
          if (!pen.produceReady) continue;

          // Check if pen is within range of this collector (using grid coordinates)
          const dr = Math.abs(pen.gridRow - r);
          const dc = Math.abs(pen.gridCol - c);
          if (dr > range || dc > range) continue;

          // Auto-collect the produce
          const def = LIVESTOCK[pen.typeIndex];
          pen.produceReady = false;
          pen.feedTimer = getFeedInterval(def);

          G.inventory[def.produce] = (G.inventory[def.produce] || 0) + (techOwned('husb_happy') && Math.random() < 0.2 ? 2 : 1);

          if (G.viewZoom >= 0.5) {
            const scr = penCenter(pen);
            flyProduce(def.produceSprite, scr.x, scr.y, 1, true);
            particles.sparkle(scr.x, scr.y, Math.ceil(4 * G.viewZoom), { color: '#0cf', speed: 1.5 });
          }
        }
      }
  }

  /* ── Shuffle Cache ── */

  function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function refreshShuffleCache() {
    // Build all grid positions in order, then shuffle
    const all = [];
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c)
        all.push({ r, c });
    G.cachedHarvestOrder = fisherYatesShuffle(all.slice());
    G.cachedPlantOrder = fisherYatesShuffle(all.slice());
  }

  function updateShuffleCache(dt) {
    if (G.state !== STATE_PLAYING) return;
    G.shuffleCacheTimer += dt;
    if (G.shuffleCacheTimer >= SHUFFLE_CACHE_INTERVAL) {
      G.shuffleCacheTimer -= SHUFFLE_CACHE_INTERVAL;
      refreshShuffleCache();
    }
  }

  /* ── Energy System ── */
  function updateEnergy(dt) {
    if (G.state !== STATE_PLAYING) return;
    const maxE = getEnergyMax();
    G.energy = Math.min(maxE, G.energy + getEnergyRegenRate() * dt);
  }

  /* ── Auto-Planter Buildings ── */
  function updateAutoPlanter(dt) {
    if (G.state !== STATE_PLAYING) return;
    G.autoPlanterTimer += dt;

    // Find the fastest auto-planter interval on the grid
    let minInterval = Infinity;
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const bld = G.buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Auto-Planter L1' || bname === 'Auto-Planter L2')
          minInterval = Math.min(minInterval, getAutoPlanterInterval(bld));
      }
    if (minInterval === Infinity) return;
    if (G.autoPlanterTimer < minInterval) return;
    G.autoPlanterTimer -= minInterval;

    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const pBld = G.buildings[r]?.[c];
        if (!pBld) continue;
        const bdef = BUILDINGS[pBld.typeIndex];
        if (bdef.name !== 'Auto-Planter L1' && bdef.name !== 'Auto-Planter L2') continue;

        // Determine crop candidates for L2 (diversification pool), or fixed crop for L1
        const isL2 = bdef.name === 'Auto-Planter L2';
        let l2Candidates = null;
        if (isL2) {
          // Find the best market factor first
          let bestFactor = -Infinity;
          for (let ci = 0; ci < CROPS.length; ++ci) {
            const factor = G.priceMultipliers[ci] || 1;
            if (factor > bestFactor && isCropUnlocked(ci))
              bestFactor = factor;
          }
          // Collect all crops within 0.15 of the best for diversification
          l2Candidates = [];
          for (let ci = 0; ci < CROPS.length; ++ci) {
            const factor = G.priceMultipliers[ci] || 1;
            if (bestFactor - factor <= 0.15 && isCropUnlocked(ci))
              l2Candidates.push(ci);
          }
        }

        const range = getBuildingRange(pBld);

        // Use cached plant order for even distribution across ticks
        if (!G.cachedPlantOrder.length)
          refreshShuffleCache();
        const plantable = [];
        for (const { r: pr, c: pc } of G.cachedPlantOrder) {
          const nr = pr, nc = pc;
          if (nr < 0 || nr >= G.gridRows || nc < 0 || nc >= G.gridCols) continue;
          const dr = nr - r, dc = nc - c;
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) > range || Math.abs(dc) > range) continue;
          const adjTT = G.tileTypes[nr]?.[nc];
          if (adjTT === TILE_WATER || adjTT === TILE_ROCK) continue;
          if (G.buildings[nr]?.[nc]) continue;
          if (G.farmGrid[nr][nc] !== null) continue;
          plantable.push({ nr, nc });
        }
        for (const { nr, nc } of plantable) {
          // Each tile independently picks a crop for L2 diversification
          const cropIdx = isL2
            ? l2Candidates[Math.floor(Math.random() * l2Candidates.length)]
            : G.selectedCropIndex;
          const crop = CROPS[cropIdx];
          const seedCost = getSeedCost(crop);
          if (G.credits < seedCost) break;
          G.credits -= seedCost;
          G.farmGrid[nr][nc] = {
            cropIndex: cropIdx,
            growthProgress: 0,
            growthStage: 0,
            plantAnim: 1.0
          };
          if (G.viewZoom >= 0.5) {
            const { x: tx, y: ty } = tileCenter(nc, nr);
            particles.sparkle(tx, ty, Math.ceil(4 * G.viewZoom), { color: crop.color, speed: 1.5 });
            popText(tx, ty - 10, `-${seedCost}`, { color: '#8af', font: 'bold 10px' });
          }
        }
      }
  }

  Object.assign(NS, { updateAutoCollector, refreshShuffleCache, updateShuffleCache, updateEnergy,
    updateAutoPlanter });

})();
