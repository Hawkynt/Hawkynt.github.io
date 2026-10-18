/* Space Farming - actions on single farm tiles: planting, harvesting, clearing rocks and the hoe.
   Owns: G.gridRows, G.soilQuality, G.farmGrid, G.tileTypes, G.tileFertility, G.hoedTiles, G.buildings,
     G.gridCols, G.gridColOffset, G.expansionDirection
   Reads: G.state, G.credits, G.selectedCropIndex, G.inventory, G.viewZoom, G.harvestCombo, G.harvestComboT,
     G.stats */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND, STATE_PLAYING, CROPS, particles, screenShake,
    getSeedCost, getYieldMultiplier, getStorageCapacity, getTotalInventoryCount, getSeasonHarvestMultiplier,
    isAdjacentToWater, tileCenter, invalidateField, flyProduce, dustRing, isCropUnlocked, popText } = NS;

  /* ══════════════════════════════════════════════════════════════════
     FARM GRID OPERATIONS
     ══════════════════════════════════════════════════════════════════ */

  function plantCrop(row, col) {
    if (G.state !== STATE_PLAYING) return;
    const tt = G.tileTypes[row]?.[col];
    if (tt === TILE_WATER || tt === TILE_ROCK) return;
    if (G.buildings[row]?.[col]) return; // tile has a building
    if (G.farmGrid[row][col] !== null) return; // not empty
    const crop = CROPS[G.selectedCropIndex];
    if (!isCropUnlocked(G.selectedCropIndex)) return;
    const seedCost = getSeedCost(crop);
    if (G.credits < seedCost) return;

    G.credits -= seedCost;
    ++G.stats.planted;
    G.farmGrid[row][col] = {
      cropIndex: G.selectedCropIndex,
      growthProgress: 0,
      growthStage: 0,
      plantAnim: 1.0 // plantAnim scale bounce
    };

    // Planting animation: seed sparkle + water droplet splash
    const { x: tx, y: ty } = tileCenter(col, row);
    particles.sparkle(tx, ty, 6, { color: crop.color, speed: 2 });
    // Water droplet splash effect
    for (let i = 0; i < 5; ++i) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const v = 1.5 + Math.random() * 2;
      particles.trail(tx + (Math.random() - 0.5) * 10, ty + 6, {
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1,
        color: '#8fd3ff',
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 2,
        gravity: 0.15,
        decay: 0.03
      });
    }
    particles.burst(tx, ty + 12, 6, { color: '#8a6038', speed: 1.8, life: 0.45, gravity: 0.12 });
    SZ.GameAudio.play('drop', { pitch: 1.3 + Math.random() * 0.3, volume: 0.6 });
  }

  function harvestCrop(row, col, auto) {
    if (G.state !== STATE_PLAYING) return;
    const cell = G.farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const maxStage = crop.stages - 1;
    if (cell.growthStage < maxStage) return; // not mature yet

    const { x: tx, y: ty } = tileCenter(col, row);

    // Check storage capacity (Feature 7)
    if (getTotalInventoryCount() >= getStorageCapacity()) {
      popText(tx, ty - 10, 'Storage Full!', { color: '#f44', font: 'bold 13px sans-serif' });
      if (!auto)
        SZ.GameAudio.play('error');
      return;
    }

    // Enhanced harvest: golden burst + crop-colored sparkle ring (scaled with zoom)
    if (G.viewZoom >= 0.5) {
      particles.burst(tx, ty, Math.ceil(10 * G.viewZoom), { color: '#fd0', speed: 3.5, life: 0.7, gravity: 0.05 });
      particles.burst(tx, ty, Math.ceil(6 * G.viewZoom), { color: crop.color, speed: 2, life: 0.5 });
      // Rising golden sparkles
      const trailCount = Math.ceil(4 * G.viewZoom);
      for (let i = 0; i < trailCount; ++i)
        particles.trail(tx + (Math.random() - 0.5) * 16, ty, {
          vx: (Math.random() - 0.5) * 1,
          vy: -1.5 - Math.random() * 2,
          color: '#ff0',
          size: 2 + Math.random(),
          life: 0.5 + Math.random() * 0.3,
          decay: 0.03,
          shape: 'star'
        });
    }

    // Yield multiplier: chance for bonus crops + season harvest bonus
    const yieldMul = getYieldMultiplier() * getSeasonHarvestMultiplier();
    let harvestCount = 1;
    const bonusChance = yieldMul - 1; // 0..1+
    if (bonusChance > 0 && Math.random() < bonusChance)
      ++harvestCount;

    if (!G.inventory[crop.name])
      G.inventory[crop.name] = 0;
    G.inventory[crop.name] += harvestCount;
    G.stats.harvested += harvestCount;

    flyProduce(crop.sprite, tx, ty, harvestCount, auto);
    if (harvestCount > 1)
      popText(tx, ty - 16, `×${harvestCount}!`, { color: '#ffd75a', font: 'bold 14px' });
    if (!auto) {
      ++G.harvestCombo;
      G.harvestComboT = 0.8;
      SZ.GameAudio.play('pickup', { pitch: 1 + Math.min(G.harvestCombo, 12) * 0.035 + (harvestCount > 1 ? 0.15 : 0) });
    }

    G.farmGrid[row][col] = null; // clear tile
  }

  const ROCK_CLEAR_COST = 25;

  /* The hoe (as a pick) breaks up a rock into poor farmland */
  function clearRock(row, col) {
    if (G.state !== STATE_PLAYING || G.tileTypes[row]?.[col] !== TILE_ROCK) return false;
    const { x: tx, y: ty } = tileCenter(col, row);
    if (G.buildings[row][col]) {
      popText(tx, ty - 14, 'A building stands here', { color: '#ffb080', font: 'bold 11px' });
      SZ.GameAudio.play('error', { volume: 0.5 });
      return false;
    }
    if (G.credits < ROCK_CLEAR_COST) {
      popText(tx, ty - 14, `Need ${ROCK_CLEAR_COST} cr`, { color: '#ff8a8a', font: 'bold 12px' });
      SZ.GameAudio.play('error', { volume: 0.5 });
      return false;
    }
    G.credits -= ROCK_CLEAR_COST;
    G.tileTypes[row][col] = TILE_FARMLAND;
    G.tileFertility[row][col] = Math.min(G.tileFertility[row][col] ?? 0.5, 0.55);
    G.farmGrid[row][col] = null;
    invalidateField();
    particles.burst(tx, ty + 6, 14, { color: '#8e8984', speed: 3, life: 0.6, gravity: 0.15 });
    particles.burst(tx, ty + 6, 8, { color: '#d8dee8', speed: 2, life: 0.4 });
    dustRing(tx, ty + 18, '#b8b0a8');
    popText(tx, ty - 14, `Rock cleared -${ROCK_CLEAR_COST}`, { color: '#e0d8c8', font: 'bold 12px' });
    screenShake.trigger(2, 100);
    SZ.GameAudio.play('smallExplode', { volume: 0.6, pitch: 1.3 });
    SZ.GameAudio.play('thud', { pitch: 0.8 });
    return true;
  }

  /** Hoe a single tile: boost fertility +0.2 (cap 1.5). Returns true if tile was fertilized. */
  function hoeFertilizeTile(row, col) {
    const tt = G.tileTypes[row]?.[col];
    if (tt === undefined || tt === TILE_WATER || tt === TILE_ROCK) return false;
    // Hoeing sand converts it to farmland
    if (tt === TILE_SAND) {
      G.tileTypes[row][col] = TILE_FARMLAND;
      const { x: tx, y: ty } = tileCenter(col, row);
      popText(tx, ty - 20, 'Soil improved!', { color: '#a84', font: 'bold 10px sans-serif' });
    }
    if (G.buildings[row]?.[col]) return false;
    const curFert = G.tileFertility[row]?.[col] ?? 0.5;
    const newFert = Math.min(1.5, curFert + 0.2);
    if (newFert <= curFert) return false;
    G.tileFertility[row][col] = newFert;
    if (G.hoedTiles[row])
      G.hoedTiles[row][col] = true;
    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 10, `+Fertility (${Math.round(newFert * 100)}%)`, { color: '#4d4', font: 'bold 11px sans-serif' });
    particles.sparkle(tx, ty, 5, { color: '#4a2', speed: 1.5 });
    SZ.GameAudio.play('thud', { pitch: 1.6, volume: 0.5 });
    return true;
  }

  /** Hoe left-click: clicking water fertilizes all 8 surrounding tiles; clicking land adjacent to water fertilizes that tile. */
  function hoeFertilize(row, col) {
    if (G.state !== STATE_PLAYING) return;
    const tt = G.tileTypes[row]?.[col];

    if (tt === TILE_WATER) {
      // Fertilize all 8 neighbors around the water tile
      for (let dr = -1; dr <= 1; ++dr)
        for (let dc = -1; dc <= 1; ++dc) {
          if (dr === 0 && dc === 0) continue;
          hoeFertilizeTile(row + dr, col + dc);
        }
      return;
    }

    if (tt === TILE_ROCK) {
      clearRock(row, col);
      return;
    }
    if (!isAdjacentToWater(row, col)) return;
    hoeFertilizeTile(row, col);
  }

  /** Hoe right-click: uproot/remove a plant, returning partial seed cost. */
  function hoeUproot(row, col) {
    if (G.state !== STATE_PLAYING) return;
    const cell = G.farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const refund = Math.floor(getSeedCost(crop) * 0.5);
    G.credits += refund;
    G.farmGrid[row][col] = null;

    const { x: tx, y: ty } = tileCenter(col, row);
    popText(tx, ty - 10, `Uprooted! +${refund}cr`, { color: '#fa0', font: 'bold 11px sans-serif' });
    particles.burst(tx, ty, 6, { color: '#a62', speed: 2, life: 0.4 });
    SZ.GameAudio.play('whoosh', { pitch: 0.8, volume: 0.7 });
  }

  Object.assign(NS, { plantCrop, harvestCrop, ROCK_CLEAR_COST, hoeFertilize, hoeUproot });

})();
