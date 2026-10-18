/* Space Farming - growing the farm: wave-function style tile generation for new strips,
   adding a strip on the next side, and buying it from the field or the tree.
   Reads: G.state, G.gridRows, G.soilQuality, G.farmGrid, G.tileTypes, G.tileFertility, G.hoedTiles,
     G.buildings, G.livestockPens, G.wildAnimals, G.gridCols, G.gridColOffset, G.expansionDirection, G.dialog */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND, STATE_PLAYING, UI, getTileSoilQuality, tileCenter,
    invalidateField, worldToUI, celebrate, dustRing, TECH_BY_ID, nodeCost, canPay, toast, canvasToGrid,
    clampPan } = NS;

  /** WFC-inspired tile generation: weighted random based on neighbor types. */
  function wfcTileType(neighbors) {
    // Count neighbor types
    let waterCount = 0, rockCount = 0, sandCount = 0, farmCount = 0;
    for (const n of neighbors) {
      if (n === TILE_WATER) ++waterCount;
      else if (n === TILE_ROCK) ++rockCount;
      else if (n === TILE_SAND) ++sandCount;
      else ++farmCount;
    }
    const total = neighbors.length || 1;

    // Weighted probabilities based on adjacency
    let wWater = 0.06 + (waterCount / total) * 0.45;
    let wRock = 0.05 + (rockCount / total) * 0.40;
    let wSand = 0.08 + (sandCount / total) * 0.35;
    // Sand also appears near water edges
    if (waterCount > 0 && sandCount === 0) wSand += 0.15;
    let wFarm = 1 - wWater - wRock - wSand;
    if (wFarm < 0.2) wFarm = 0.2;

    // Normalize
    const sum = wWater + wRock + wSand + wFarm;
    wWater /= sum;
    wRock /= sum;
    wSand /= sum;

    const roll = Math.random();
    if (roll < wWater) return TILE_WATER;
    if (roll < wWater + wRock) return TILE_ROCK;
    if (roll < wWater + wRock + wSand) return TILE_SAND;
    return TILE_FARMLAND;
  }

  /** Collect existing neighbor tile types for a position (row, col). */
  function getNeighborTypes(row, col) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < G.gridRows && nc >= 0 && nc < G.gridCols && G.tileTypes[nr]?.[nc] !== undefined)
          neighbors.push(G.tileTypes[nr][nc]);
      }
    return neighbors;
  }

  function makeExpansionFertility(tileType) {
    let fert = 0.5 + Math.random() * 0.5;
    if (tileType === TILE_SAND) fert *= 0.7;
    // Expansion tiles start with slightly lower base fertility
    fert *= 0.75;
    return fert;
  }

  function expandGrid() {
    // Expand one strip at a time, cycling L(0), R(1), T(2), B(3)
    const dir = G.expansionDirection;

    if (dir === 0) {
      // LEFT: add column at left
      for (let r = 0; r < G.gridRows; ++r) {
        const neighbors = [];
        if (G.tileTypes[r]?.[0] !== undefined) neighbors.push(G.tileTypes[r][0]);
        if (r > 0 && G.tileTypes[r - 1]?.[0] !== undefined) neighbors.push(G.tileTypes[r - 1][0]);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        G.farmGrid[r].unshift(null);
        G.tileTypes[r].unshift(tt);
        G.tileFertility[r].unshift(makeExpansionFertility(tt));
        if (G.hoedTiles[r]) G.hoedTiles[r].unshift(false);
        G.buildings[r].unshift(null);
      }
      ++G.gridCols;
      ++G.gridColOffset;
      for (const animal of G.wildAnimals) ++animal.x;
      for (const pen of G.livestockPens) ++pen.gridCol;
    } else if (dir === 1) {
      // RIGHT: add column at right
      for (let r = 0; r < G.gridRows; ++r) {
        const neighbors = [];
        const lastC = G.gridCols - 1;
        if (G.tileTypes[r]?.[lastC] !== undefined) neighbors.push(G.tileTypes[r][lastC]);
        if (r > 0 && G.tileTypes[r - 1]?.[lastC] !== undefined) neighbors.push(G.tileTypes[r - 1][lastC]);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        G.farmGrid[r].push(null);
        G.tileTypes[r].push(tt);
        G.tileFertility[r].push(makeExpansionFertility(tt));
        if (G.hoedTiles[r]) G.hoedTiles[r].push(false);
        G.buildings[r].push(null);
      }
      ++G.gridCols;
    } else if (dir === 2) {
      // TOP: add row at top
      const northRow = [];
      const northType = [];
      const northFert = [];
      const northBuild = [];
      for (let c = 0; c < G.gridCols; ++c) {
        northRow.push(null);
        northBuild.push(null);
        const neighbors = [];
        if (G.tileTypes[0]?.[c] !== undefined) neighbors.push(G.tileTypes[0][c]);
        if (c > 0 && northType[c - 1] !== undefined) neighbors.push(northType[c - 1]);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        northType.push(tt);
        northFert.push(makeExpansionFertility(tt));
      }
      G.farmGrid.unshift(northRow);
      G.tileTypes.unshift(northType);
      G.tileFertility.unshift(northFert);
      G.hoedTiles.unshift(new Array(G.gridCols).fill(false));
      G.buildings.unshift(northBuild);
      ++G.gridRows;
      G.soilQuality.unshift(getTileSoilQuality(0));
      for (const animal of G.wildAnimals) ++animal.y;
      for (const pen of G.livestockPens) ++pen.gridRow;
    } else {
      // BOTTOM: add row at bottom
      const southRow = [];
      const southType = [];
      const southFert = [];
      const southBuild = [];
      for (let c = 0; c < G.gridCols; ++c) {
        southRow.push(null);
        southBuild.push(null);
        const neighbors = getNeighborTypes(G.gridRows, c);
        const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
        southType.push(tt);
        southFert.push(makeExpansionFertility(tt));
      }
      G.farmGrid.push(southRow);
      G.tileTypes.push(southType);
      G.tileFertility.push(southFert);
      G.hoedTiles.push(new Array(G.gridCols).fill(false));
      G.buildings.push(southBuild);
      ++G.gridRows;
      G.soilQuality.push(getTileSoilQuality(G.gridRows - 1));
    }

    // Advance direction: L -> R -> T -> B -> L -> ...
    G.expansionDirection = (G.expansionDirection + 1) % 4;
    invalidateField();

    // Refresh shuffle cache since grid dimensions changed
    NS.refreshShuffleCache();
  }

  /* ── Field expansion: ghost plots where the next strip of land will go ── */

  const DIR_NAMES = ['west', 'east', 'north', 'south'];

  /* Tiles (outside the grid) the next Expand Field adds */
  function expansionTiles() {
    const out = [];
    if (G.expansionDirection === 0) for (let r = 0; r < G.gridRows; ++r) out.push({ r, c: -1 });
    else if (G.expansionDirection === 1) for (let r = 0; r < G.gridRows; ++r) out.push({ r, c: G.gridCols });
    else if (G.expansionDirection === 2) for (let c = 0; c < G.gridCols; ++c) out.push({ r: -1, c });
    else for (let c = 0; c < G.gridCols; ++c) out.push({ r: G.gridRows, c });
    return out;
  }

  function expansionAt(sx, sy) {
    if (G.state !== STATE_PLAYING || G.dialog) return false;
    const { col, row } = canvasToGrid(sx, sy);
    return expansionTiles().some(t => t.r === row && t.c === col);
  }

  function expandCost() {
    return nodeCost(TECH_BY_ID.eng_land).cr;
  }

  /* Buys the next strip, or shows it in the tech tree when it can't be paid */
  function expandField() {
    if (G.state !== STATE_PLAYING) return;
    const n = TECH_BY_ID.eng_land;
    if (canPay(nodeCost(n))) {
      const dir = G.expansionDirection;
      const tiles = expansionTiles();
      if (NS.tryPurchaseTreeNode(n)) {
        // the strip is now part of the grid: west and north strips shifted the indices
        const at = (tl) => tileCenter(tl.c + (dir === 0 ? 1 : 0), tl.r + (dir === 2 ? 1 : 0));
        for (const tl of tiles) {
          const p = at(tl);
          dustRing(p.x, p.y + 14);
        }
        const p = at(tiles[Math.floor(tiles.length / 2)]);
        const u = worldToUI(p.x, p.y);
        celebrate(u.x, u.y, 30);
        clampPan();
      }
    } else {
      SZ.GameAudio.play('error', { volume: 0.5 });
      toast(`Expanding the field needs ${expandCost()} credits`, UI.warn, 'map');
    }
  }

  Object.assign(NS, { expandGrid, DIR_NAMES, expansionTiles, expansionAt, expandCost, expandField });

})();
