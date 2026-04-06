;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { Terrain } = TR;

  const BIOME_PALETTES = Object.freeze({
    plains:   ['plains', 'plains', 'plains', 'plains', 'forest', 'road'],
    forest:   ['forest', 'forest', 'forest', 'plains', 'plains', 'road'],
    dungeon:  ['dungeon_floor', 'dungeon_floor', 'dungeon_floor', 'dungeon_floor', 'cave', 'cave'],
    cave:     ['cave', 'cave', 'cave', 'dungeon_floor', 'dungeon_floor', 'cave'],
    ruins:    ['ruins', 'ruins', 'dungeon_floor', 'dungeon_floor', 'cave', 'ruins'],
    mountain: ['mountain', 'mountain', 'mountain', 'snow', 'snow', 'road'],
    swamp:    ['swamp', 'swamp', 'swamp', 'plains', 'plains', 'water'],
    desert:   ['desert', 'desert', 'desert', 'desert', 'plains', 'road'],
    snow:     ['snow', 'snow', 'snow', 'snow', 'mountain', 'road'],
    lava:     ['lava', 'lava', 'dungeon_floor', 'dungeon_floor', 'cave', 'cave'],
  });

  class CombatGrid {
    #cols;
    #rows;
    #terrain;
    #units;
    #unitPositions;

    constructor(cols, rows, terrainData) {
      this.#cols = cols;
      this.#rows = rows;
      this.#terrain = terrainData.slice();
      this.#units = new Map();
      this.#unitPositions = new Map();
    }

    get cols() { return this.#cols; }
    get rows() { return this.#rows; }

    inBounds(col, row) {
      return col >= 0 && col < this.#cols && row >= 0 && row < this.#rows;
    }

    terrainAt(col, row) {
      if (!this.inBounds(col, row))
        return null;
      return Terrain.byId(this.#terrain[row * this.#cols + col]);
    }

    terrainIdAt(col, row) {
      if (!this.inBounds(col, row))
        return null;
      return this.#terrain[row * this.#cols + col];
    }

    moveCostAt(col, row) {
      if (!this.inBounds(col, row))
        return Infinity;
      return Terrain.moveCost(this.#terrain[row * this.#cols + col]);
    }

    placeUnit(unitId, col, row) {
      if (!this.inBounds(col, row))
        throw new Error(`Out of bounds: ${col},${row}`);
      const key = `${col},${row}`;
      if (this.#units.has(key))
        throw new Error(`Position ${col},${row} already occupied by ${this.#units.get(key)}`);
      this.#units.set(key, unitId);
      this.#unitPositions.set(unitId, { col, row });
    }

    removeUnit(unitId) {
      const pos = this.#unitPositions.get(unitId);
      if (!pos)
        return;
      this.#units.delete(`${pos.col},${pos.row}`);
      this.#unitPositions.delete(unitId);
    }

    moveUnit(unitId, col, row) {
      if (!this.inBounds(col, row))
        throw new Error(`Out of bounds: ${col},${row}`);
      const key = `${col},${row}`;
      const existing = this.#units.get(key);
      if (existing && existing !== unitId)
        throw new Error(`Position ${col},${row} already occupied by ${existing}`);
      const pos = this.#unitPositions.get(unitId);
      if (pos)
        this.#units.delete(`${pos.col},${pos.row}`);
      this.#units.set(key, unitId);
      this.#unitPositions.set(unitId, { col, row });
    }

    unitAt(col, row) {
      if (!this.inBounds(col, row))
        return null;
      return this.#units.get(`${col},${row}`) || null;
    }

    unitPosition(unitId) {
      return this.#unitPositions.get(unitId) || null;
    }

    isOccupied(col, row) {
      return this.#units.has(`${col},${row}`);
    }

    neighbors(col, row) {
      const result = [];
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dc, dr] of dirs)
        if (this.inBounds(col + dc, row + dr))
          result.push({ col: col + dc, row: row + dr });
      return result;
    }

    static fromOverworldTiles(tileData, cols, rows) {
      const TILE_MAP = {
        1: 'plains',   // GRASS
        2: 'forest',   // FOREST
        3: 'mountain', // MOUNTAIN
        4: 'plains',   // DUNGEON
        5: 'road',     // TOWN
        6: 'road',     // ROAD
        7: 'plains',   // CAMP
        8: 'water',    // WATER
        9: 'desert',   // SAND
      };
      const terrain = [];
      for (let i = 0; i < tileData.length; ++i)
        terrain.push(TILE_MAP[tileData[i]] || 'plains');
      return new CombatGrid(cols, rows, terrain);
    }

    static generate(cols, rows, prng, biome) {
      const palette = BIOME_PALETTES[biome] || BIOME_PALETTES.plains;
      const terrain = [];
      for (let i = 0; i < cols * rows; ++i)
        terrain.push(prng.pick(palette));
      return new CombatGrid(cols, rows, terrain);
    }

    serialize() {
      return {
        cols: this.#cols,
        rows: this.#rows,
        terrain: this.#terrain.slice(),
      };
    }

    static deserialize(data) {
      return new CombatGrid(data.cols, data.rows, data.terrain);
    }
  }

  TR.CombatGrid = CombatGrid;
})();
