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
    // the other planes
    astral:    ['astral_void', 'astral_void', 'astral_void', 'rubble', 'rubble', 'astral_void'],
    ethereal:  ['ethereal_mist', 'ethereal_mist', 'ethereal_mist', 'shadow_ground', 'ethereal_mist', 'plains'],
    shadow:    ['shadow_ground', 'shadow_ground', 'shadow_ground', 'forest', 'rubble', 'dungeon_floor'],
    fire:      ['infernal_waste', 'infernal_waste', 'infernal_waste', 'lava', 'desert_rock', 'rubble'],
    water:     ['shallow_water', 'shallow_water', 'shallow_water', 'coral_reef', 'seabed', 'shallow_water'],
    earth:     ['earth_packed', 'earth_packed', 'earth_packed', 'stalagmites', 'rubble', 'stone_wall'],
    sky:       ['cloud', 'cloud', 'cloud', 'air_open', 'air_open', 'cloud'],
    radiant:   ['celestial_garden', 'celestial_garden', 'celestial_garden', 'plains', 'celestial_garden', 'road'],
    void:      ['shadow_ground', 'shadow_ground', 'shadow_ground', 'pit', 'rubble', 'shadow_ground'],
    celestial: ['celestial_garden', 'celestial_garden', 'celestial_garden', 'forest', 'plains', 'road'],
    fey:       ['feywild_grove', 'feywild_grove', 'feywild_grove', 'forest', 'plains', 'shallow_water'],
    infernal:  ['infernal_waste', 'infernal_waste', 'infernal_waste', 'lava', 'rubble', 'desert_rock'],
    abyss:     ['infernal_waste', 'infernal_waste', 'infernal_waste', 'lava', 'pit', 'rubble'],
    clockwork: ['mechanus_grid', 'mechanus_grid', 'mechanus_grid', 'mechanus_grid', 'iron_door', 'road'],
    chaos:     ['ethereal_mist', 'ethereal_mist', 'infernal_waste', 'shallow_water', 'earth_packed', 'cloud'],
    ooze:      ['swamp', 'swamp', 'swamp', 'marsh', 'shallow_water', 'plains'],
    grey:      ['shadow_ground', 'shadow_ground', 'shadow_ground', 'desert_rock', 'rubble', 'shadow_ground'],
  });

  function moveCostOf(id) {
    const t = Terrain && Terrain.byId ? Terrain.byId(id) : null;
    return t && Number.isFinite(t.moveCost) ? t.moveCost : 1;
  }

  // Value noise on a coarse lattice, bilinearly smoothed, plus a finer
  // octave; deterministic for a given prng.
  function smoothNoise(cols, rows, prng) {
    const octave = (cell, weight, out) => {
      const gw = Math.ceil(cols / cell) + 2, gh = Math.ceil(rows / cell) + 2;
      const lattice = [];
      for (let i = 0; i < gw * gh; ++i)
        lattice.push(prng.next());
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c) {
          const gx = c / cell, gy = r / cell;
          const x0 = Math.floor(gx), y0 = Math.floor(gy);
          const tx = gx - x0, ty = gy - y0;
          const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
          const v = (x, y) => lattice[y * gw + x];
          const top = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * sx;
          const bot = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * sx;
          out[r * cols + c] += (top + (bot - top) * sy) * weight;
        }
    };
    const out = new Array(cols * rows).fill(0);
    octave(4, 1, out);
    octave(2, 0.35, out);
    return out;
  }

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
        10: 'snow',        // SNOW
        11: 'forest',      // TAIGA
        12: 'jungle',      // JUNGLE
        13: 'desert',      // DESERT
        14: 'desert_rock', // BADLANDS
        15: 'swamp',       // SWAMP
        16: 'hill',        // HILLS
        17: 'plains',      // SAVANNA
        18: 'ice',         // ICE
        19: 'desert_rock', // ASH
        20: 'lava',        // LAVA
        21: 'plains',      // PORTAL
        // the other planes
        22: 'astral_void',      // ASTRAL
        23: 'rubble',           // DRIFT_ROCK
        24: 'ethereal_mist',    // MIST
        25: 'shadow_ground',    // GLOOM
        26: 'infernal_waste',   // CINDER
        27: 'shallow_water',    // CURRENT
        28: 'coral_reef',       // CORAL
        29: 'earth_packed',     // BEDROCK
        30: 'stone_wall',       // SOLID_ROCK
        31: 'air_open',         // SKY
        32: 'cloud',            // CLOUD
        33: 'celestial_garden', // RADIANCE
        34: 'shadow_ground',    // DARKNESS
        35: 'celestial_garden', // CELESTIAL
        36: 'feywild_grove',    // FEY
        37: 'infernal_waste',   // BRIMSTONE
        38: 'infernal_waste',   // ABYSSAL
        39: 'mechanus_grid',    // GEARS
        40: 'ethereal_mist',    // CHAOS
        41: 'swamp',            // OOZE
        42: 'desert_rock',      // SMOKE
        43: 'mechanus_grid',    // IRON
        44: 'shadow_ground',    // GREY
        45: 'pit',              // RIFT
      };
      const terrain = [];
      for (let i = 0; i < tileData.length; ++i)
        terrain.push(TILE_MAP[tileData[i]] || 'plains');
      return new CombatGrid(cols, rows, terrain);
    }

    // Terrain keeps the palette's proportions but is placed by a smooth
    // noise field, so it forms patches, paths and clearings instead of
    // speckle. The palette's first entry is the base terrain; the spawn
    // columns (1 and cols - 2) get the palette's easiest footing.
    static generate(cols, rows, prng, biome) {
      const palette = BIOME_PALETTES[biome] || BIOME_PALETTES.plains;
      const n = cols * rows;
      const field = smoothNoise(cols, rows, prng);
      const order = [...Array(n).keys()].sort((a, b) => field[a] - field[b] || a - b);
      const terrain = new Array(n);
      const counts = new Map();
      for (const id of palette)
        counts.set(id, (counts.get(id) || 0) + 1);
      // walk the noise ranks: base terrain in the middle band, others outside it
      const base = palette[0];
      const others = [...counts.keys()].filter(id => id !== base);
      const bands = [];
      const half = Math.ceil(others.length / 2);
      for (const id of others.slice(0, half))
        bands.push(id);
      bands.push(base);
      for (const id of others.slice(half))
        bands.push(id);
      let k = 0;
      for (const id of bands) {
        const take = Math.round(n * counts.get(id) / palette.length);
        for (let i = 0; i < take && k < n; ++i)
          terrain[order[k++]] = id;
      }
      while (k < n)
        terrain[order[k++]] = base;
      const footing = [...counts.keys()].reduce((best, id) => moveCostOf(id) < moveCostOf(best) ? id : best, base);
      for (let r = 0; r < rows; ++r)
        for (const c of [1, cols - 2])
          if (c >= 0 && c < cols)
            terrain[r * cols + c] = footing;
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
