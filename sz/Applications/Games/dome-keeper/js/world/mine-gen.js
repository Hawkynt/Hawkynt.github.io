;(function() {
  'use strict';

  // Generating the underground grid: strata, ore veins, gadget chambers and tile hit points.
  // Owns: NS.mineGen
  // Reads: constants, util, rules, gameState, relocation, chests, biomes
  // Reads state of: gameState

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { STRATUM_ROWS, GRID_COLS, GRID_ROWS, TILE_EMPTY, TILE_DIRT, TILE_IRON, TILE_WATER, TILE_COBALT,
    TILE_GADGET, TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER, TILE_LEAD, TILE_COAL, TILE_QUARTZ,
    TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY, TILE_TITANIUM, TILE_SAPPHIRE, TILE_URANIUM,
    TILE_AMETHYST, TILE_OPAL, TILE_VOIDSTONE, TILE_LABELS } = NS.constants;
  const { makeRng } = NS.util;
  const { RESOURCE_TILES, DEPTH_TIERS, DEEP_STRATUM, getDepthMineMultiplier, BASE_MINE_TIME,
    TILE_MINE_MULTIPLIER } = NS.rules;
  const { MINE_GADGETS } = NS.gameState;

  /* ======================================================================
     UNDERGROUND GRID GENERATION
     ====================================================================== */

  // Vein spawn configuration per ore type
  // seedChance: probability that a scan point spawns a vein of this type
  // minLen/maxLen: base vein length range
  // depthLenBonus: multiplier added to maxLen per unit of depth (0..1)
  const VEIN_CONFIG = {
    // Common ores: veins of 3-8, longer at depth
    [TILE_IRON]:     { seedChance: 0.055, minLen: 3, maxLen: 8, depthLenBonus: 3 },
    [TILE_COPPER]:   { seedChance: 0.028, minLen: 3, maxLen: 7, depthLenBonus: 2 },
    [TILE_TIN]:      { seedChance: 0.020, minLen: 3, maxLen: 6, depthLenBonus: 2 },
    [TILE_COAL]:     { seedChance: 0.028, minLen: 3, maxLen: 8, depthLenBonus: 3 },
    // Medium ores: veins of 2-5, longer at depth
    [TILE_LEAD]:     { seedChance: 0.018, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_SILVER]:   { seedChance: 0.015, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_GOLD]:     { seedChance: 0.014, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_WATER]:    { seedChance: 0.032, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_COBALT]:   { seedChance: 0.022, minLen: 2, maxLen: 5, depthLenBonus: 3 },
    // Rare ores: veins of 1-4
    [TILE_QUARTZ]:   { seedChance: 0.014, minLen: 1, maxLen: 4, depthLenBonus: 1 },
    [TILE_REDSTONE]: { seedChance: 0.016, minLen: 1, maxLen: 4, depthLenBonus: 1 },
    // Gems: veins of 1-3, short but valuable
    [TILE_DIAMOND]:  { seedChance: 0.010, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    [TILE_EMERALD]:  { seedChance: 0.012, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    [TILE_RUBY]:     { seedChance: 0.011, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    // Deep signature ores: plentiful in their own stratum
    [TILE_TITANIUM]:  { seedChance: 0.042, minLen: 3, maxLen: 6, depthLenBonus: 1 },
    [TILE_SAPPHIRE]:  { seedChance: 0.038, minLen: 2, maxLen: 5, depthLenBonus: 1 },
    [TILE_URANIUM]:   { seedChance: 0.036, minLen: 2, maxLen: 5, depthLenBonus: 1 },
    [TILE_AMETHYST]:  { seedChance: 0.034, minLen: 2, maxLen: 5, depthLenBonus: 1 },
    [TILE_OPAL]:      { seedChance: 0.032, minLen: 2, maxLen: 4, depthLenBonus: 1 },
    [TILE_VOIDSTONE]: { seedChance: 0.030, minLen: 1, maxLen: 4, depthLenBonus: 1 }
  };

  // Ore availability at a row. The classic ores keep their old depth curves
  // across the upper ten strata and thin out below; each deep stratum adds
  // its own signature ore (with a short tail into the next layer)
  function getOreSpawnChance(row, tileType) {
    const d = row / (DEEP_STRATUM * STRATUM_ROWS);        // 0..1 over the upper strata
    const deep = Math.max(0, d - 1) * DEEP_STRATUM;       // strata below the upper ones
    const ramp = (start, end) => d < start ? 0 : d > end ? 1 : (d - start) / (end - start);
    const bell = (center, width) => Math.max(0, 1 - Math.pow((d - center) / width, 2));
    const common = Math.max(0, 1 - deep * 0.8);           // base metals fade fast below bedrock
    const mid = Math.max(0.1, 1 - deep * 0.45);           // precious metals thin out
    const rare = Math.max(0.15, 1 - deep * 0.22);         // gems linger
    switch (tileType) {
      case TILE_IRON:     return (0.4 + 0.6 * bell(0.2, 0.3) - 0.2 * ramp(0.6, 1.0)) * common;
      case TILE_COPPER:   return (0.1 + 0.9 * bell(0.25, 0.3)) * common;
      case TILE_TIN:      return (0.05 + 0.95 * bell(0.3, 0.3)) * common;
      case TILE_COAL:     return (0.1 + 0.9 * bell(0.35, 0.35)) * common;
      case TILE_LEAD:     return bell(0.45, 0.25);
      case TILE_SILVER:   return ramp(0.2, 0.5) * (1 - 0.4 * ramp(0.8, 1.0)) * common;
      case TILE_WATER:    return (0.3 + 0.7 * bell(0.4, 0.35)) * Math.max(0.2, common);
      case TILE_COBALT:   return (ramp(0.2, 0.5) + 0.5 * ramp(0.5, 0.9)) * mid;
      case TILE_GOLD:     return ramp(0.35, 0.7) * (1 - 0.3 * ramp(0.9, 1.0)) * mid;
      case TILE_QUARTZ:   return ramp(0.3, 0.65) * mid;
      case TILE_REDSTONE: return ramp(0.55, 0.85) * mid;
      case TILE_EMERALD:  return ramp(0.6, 0.9) * rare;
      case TILE_DIAMOND:  return ramp(0.65, 0.95) * rare;
      case TILE_RUBY:     return ramp(0.63, 0.92) * rare;
      default: {
        // Signature ore of a deep stratum
        const home = DEPTH_TIERS.findIndex(t => t.ore === tileType);
        if (home < 0) return 0;
        const st = row / STRATUM_ROWS;
        if (st < home - 0.25) return 0;
        if (st < home + 1) return 1;
        return Math.max(0, 0.35 - (st - home - 1) * 0.15);
      }
    }
  }

  // Grow a vein from a seed point using random walk / BFS flood
  function growVein(grid, seedR, seedC, tileType, targetLen, rand) {
    const placed = [];
    const frontier = [{ r: seedR, c: seedC }];
    const visited = new Set();
    visited.add(seedR * GRID_COLS + seedC);

    while (placed.length < targetLen && frontier.length > 0) {
      // Pick a random frontier cell
      const idx = Math.floor(rand() * frontier.length);
      const { r, c } = frontier[idx];
      frontier.splice(idx, 1);

      // Only place on dirt tiles (don't overwrite other ores or gadgets)
      if (grid[r][c] !== TILE_DIRT) continue;

      grid[r][c] = tileType;
      placed.push({ r, c });

      // Add neighbors to frontier (4-directional)
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        const key = nr * GRID_COLS + nc;
        if (visited.has(key)) continue;
        visited.add(key);
        frontier.push({ r: nr, c: nc });
      }
    }
    return placed.length;
  }

  // Build a fresh mine; rand is the site's seeded generator
  function generateUnderground(rand) {
    rand = rand || Math.random;
    G.undergroundGrid = [];
    for (let r = 0; r < GRID_ROWS; ++r)
      G.undergroundGrid.push(new Array(GRID_COLS).fill(TILE_DIRT));

    // Ore veins: every cell may seed one vein, the type weighted by depth and biome
    const oreBias = NS.biomes.currentBiome().ore;
    for (let r = 0; r < GRID_ROWS; ++r) {
      const d = r / GRID_ROWS;
      const weights = RESOURCE_TILES.map(t => getOreSpawnChance(r, t) * (oreBias[TILE_LABELS[t]] || 1));
      for (let c = 0; c < GRID_COLS; ++c) {
        if (G.undergroundGrid[r][c] !== TILE_DIRT) continue;
        for (let i = 0; i < RESOURCE_TILES.length; ++i) {
          const depthWeight = weights[i];
          if (depthWeight <= 0) continue;
          const oreType = RESOURCE_TILES[i];
          const cfg = VEIN_CONFIG[oreType];
          // Divide by the average vein length to keep the overall density similar
          const avgLen = (cfg.minLen + cfg.maxLen) / 2;
          if (rand() < (cfg.seedChance * depthWeight) / avgLen) {
            const maxL = cfg.maxLen + Math.floor(d * cfg.depthLenBonus);
            const targetLen = cfg.minLen + Math.floor(rand() * (maxL - cfg.minLen + 1));
            growVein(G.undergroundGrid, r, c, oreType, targetLen, rand);
            break; // only one vein type per seed point
          }
        }
      }
    }

    // Clear starting area around player spawn
    const spawnCol = Math.floor(GRID_COLS / 2);
    G.undergroundGrid[0][spawnCol] = TILE_EMPTY;
    G.undergroundGrid[0][spawnCol - 1] = TILE_EMPTY;
    G.undergroundGrid[0][spawnCol + 1] = TILE_EMPTY;

    // Gadget chambers (2x2 TILE_GADGET blocks), one band of depth each so they
    // are spread over all strata
    G.gadgetChambers = [];
    const chamberCount = 10 + Math.floor(rand() * 5);
    for (let n = 0; n < chamberCount; ++n) {
      const bandTop = 2 + Math.floor(n * (GRID_ROWS - 4) / chamberCount);
      const bandH = Math.max(2, Math.floor((GRID_ROWS - 4) / chamberCount));
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; ++attempt) {
        const cr = Math.min(GRID_ROWS - 2, bandTop + Math.floor(rand() * bandH));
        const cc = 1 + Math.floor(rand() * (GRID_COLS - 3));
        let ok = true;
        for (let dr = 0; dr < 2 && ok; ++dr)
          for (let dc = 0; dc < 2 && ok; ++dc) {
            if (cr + dr < 2 && cc + dc >= spawnCol - 2 && cc + dc <= spawnCol + 1) ok = false;
            if (G.undergroundGrid[cr + dr][cc + dc] === TILE_GADGET) ok = false;
          }
        if (!ok) continue;
        const available = MINE_GADGETS.filter(g => !G.gadgetChambers.some(ch => ch.gadgetType === g));
        const pool = available.length > 0 ? available : MINE_GADGETS;
        const gadgetType = pool[Math.floor(rand() * pool.length)];
        G.gadgetChambers.push({ r: cr, c: cc, gadgetType, revealed: false });
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            G.undergroundGrid[cr + dr][cc + dc] = TILE_GADGET;
        placed = true;
      }
    }

    NS.relocation.placeRelocationCore(rand);
    NS.chests.placeSecretChests(makeRng(NS.chests.chestSeed()));
    initTileHP();
  }

  // Get intrinsic tile hardness (independent of player upgrades)
  function getTileHardness(row, tile) {
    const depthMultiplier = getDepthMineMultiplier(row);
    const tileMultiplier = TILE_MINE_MULTIPLIER[tile] || 1.0;
    return BASE_MINE_TIME * depthMultiplier * tileMultiplier;
  }

  // Initialize (or reinitialize) the per-tile mining HP arrays
  function initTileHP() {
    G.tileHP = [];
    G.tileMaxHP = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const hpRow = [];
      const maxRow = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const tile = G.undergroundGrid[r][c];
        if (tile === TILE_EMPTY) {
          hpRow.push(0);
          maxRow.push(0);
        } else {
          const hp = getTileHardness(r, tile);
          hpRow.push(hp);
          maxRow.push(hp);
        }
      }
      G.tileHP.push(hpRow);
      G.tileMaxHP.push(maxRow);
    }
  }

  NS.mineGen = { generateUnderground, getTileHardness, initTileHP };
})();
