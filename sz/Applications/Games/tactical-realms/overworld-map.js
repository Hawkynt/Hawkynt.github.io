;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const { PRNG } = TR;

  const CHUNK_SIZE = 16;
  const LOCATION_SPACING = 20;

  const Tile = Object.freeze({
    VOID: 0,
    GRASS: 1,
    FOREST: 2,
    MOUNTAIN: 3,
    DUNGEON: 4,
    TOWN: 5,
    ROAD: 6,
    CAMP: 7,
    WATER: 8,
    SAND: 9,
    // regional biomes
    SNOW: 10,
    TAIGA: 11,
    JUNGLE: 12,
    DESERT: 13,
    BADLANDS: 14,
    SWAMP: 15,
    HILLS: 16,
    SAVANNA: 17,
    ICE: 18,
    ASH: 19,
    LAVA: 20,
  });

  const IMPASSABLE = Object.freeze(new Set([Tile.VOID, Tile.MOUNTAIN, Tile.WATER, Tile.ICE, Tile.LAVA]));

  // Per tile: D&D biome id (data/biomes.js), battle biome (combat palette and
  // backdrop), travel cost, encounter chance and the painted ground under
  // any overlay. Locations and roads keep their own entries.
  const TILE_INFO = Object.freeze({
    [Tile.GRASS]:    { biome: 'temperate_plains', battle: 'plains',   cost: 1,   encounter: 0.022 },
    [Tile.FOREST]:   { biome: 'temperate_forest', battle: 'forest',   cost: 1.5, encounter: 0.035 },
    [Tile.MOUNTAIN]: { biome: 'mountain',         battle: 'mountain', cost: -1,  encounter: 0 },
    [Tile.ROAD]:     { biome: 'temperate_plains', battle: 'plains',   cost: 0.5, encounter: 0.006 },
    [Tile.WATER]:    { biome: 'temperate_plains', battle: 'plains',   cost: -1,  encounter: 0 },
    [Tile.SAND]:     { biome: 'desert_sand',      battle: 'desert',   cost: 1.2, encounter: 0.015 },
    [Tile.SNOW]:     { biome: 'arctic_tundra',    battle: 'snow',     cost: 1.5, encounter: 0.022 },
    [Tile.TAIGA]:    { biome: 'arctic_tundra',    battle: 'taiga',    cost: 1.7, encounter: 0.03 },
    [Tile.JUNGLE]:   { biome: 'tropical_jungle',  battle: 'jungle',   cost: 2,   encounter: 0.04 },
    [Tile.DESERT]:   { biome: 'desert_sand',      battle: 'desert',   cost: 1.4, encounter: 0.025 },
    [Tile.BADLANDS]: { biome: 'desert_rock',      battle: 'badlands', cost: 1.3, encounter: 0.025 },
    [Tile.SWAMP]:    { biome: 'swamp',            battle: 'swamp',    cost: 2,   encounter: 0.04 },
    [Tile.HILLS]:    { biome: 'hill',             battle: 'hills',    cost: 1.6, encounter: 0.028 },
    [Tile.SAVANNA]:  { biome: 'temperate_plains', battle: 'savanna',  cost: 1,   encounter: 0.022 },
    [Tile.ICE]:      { biome: 'arctic_glacier',   battle: 'snow',     cost: -1,  encounter: 0 },
    [Tile.ASH]:      { biome: 'ash_waste',        battle: 'ash',      cost: 1.3, encounter: 0.035 },
    [Tile.LAVA]:     { biome: 'lava_field',       battle: 'lava',     cost: -1,  encounter: 0 },
  });

  // Which overworld regions suit a location's own biome.
  const LOCATION_FIT = Object.freeze({
    forest: [Tile.FOREST, Tile.JUNGLE, Tile.TAIGA, Tile.GRASS],
    swamp: [Tile.SWAMP, Tile.JUNGLE],
    mountain: [Tile.HILLS, Tile.BADLANDS, Tile.SNOW, Tile.TAIGA, Tile.MOUNTAIN],
    lava: [Tile.ASH, Tile.BADLANDS],
  });

  // Which of the classic foes roam each region (data/biomes.js ids).
  const BIOME_CREATURES = Object.freeze({
    temperate_plains: ['bandit', 'wolf', 'goblin', 'orc', 'gnoll', 'hobgoblin', 'cockatrice', 'ogre', 'hill_giant'],
    temperate_forest: ['wolf', 'goblin', 'spider', 'stirge', 'dire_wolf', 'worg', 'bugbear', 'owlbear', 'phase_spider', 'troll'],
    hill: ['goblin', 'orc', 'gnoll', 'hobgoblin', 'ogre', 'harpy', 'manticore', 'hill_giant', 'wyvern'],
    mountain: ['goblin', 'orc', 'harpy', 'gargoyle', 'manticore', 'wyvern', 'frost_giant', 'young_dragon'],
    arctic_tundra: ['wolf', 'worg', 'dire_wolf', 'ogre', 'troll', 'frost_giant'],
    arctic_glacier: ['wolf', 'worg', 'frost_giant'],
    desert_sand: ['kobold', 'gnoll', 'cockatrice', 'basilisk', 'manticore', 'fire_elemental'],
    desert_rock: ['kobold', 'gnoll', 'harpy', 'basilisk', 'manticore', 'gargoyle', 'wyvern'],
    tropical_jungle: ['spider', 'stirge', 'lizardfolk', 'phase_spider', 'basilisk', 'harpy', 'wyvern'],
    swamp: ['rat', 'stirge', 'lizardfolk', 'zombie', 'ghoul', 'cockatrice', 'basilisk', 'troll'],
    ash_waste: ['fire_elemental', 'gargoyle', 'devil', 'demon'],
    lava_field: ['fire_elemental', 'devil', 'demon'],
  });

  function creatureCR(id) {
    const t = TR.CombatEngine && TR.CombatEngine.ENEMY_TEMPLATES ? TR.CombatEngine.ENEMY_TEMPLATES[id] : null;
    return t && Number.isFinite(t.cr) ? t.cr : 1;
  }

  const GROUND = Object.freeze({
    [Tile.GRASS]: 'meadow', [Tile.FOREST]: 'meadow', [Tile.HILLS]: 'meadow', [Tile.SAVANNA]: 'savanna',
    [Tile.SNOW]: 'snow', [Tile.TAIGA]: 'snow', [Tile.ICE]: 'glacier', [Tile.JUNGLE]: 'jungle_floor',
    [Tile.DESERT]: 'desert', [Tile.SAND]: 'desert', [Tile.BADLANDS]: 'badlands', [Tile.SWAMP]: 'swamp',
    [Tile.ASH]: 'ash', [Tile.LAVA]: 'lava',
  });

  const LOCATION_TYPES = Object.freeze([
    Object.freeze({ tile: Tile.DUNGEON, name: 'Goblin Cave', difficulty: 1, biome: 'cave', enemies: ['goblin', 'wolf', 'rat'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Skeleton Crypt', difficulty: 2, biome: 'dungeon', enemies: ['skeleton', 'skeleton', 'bandit'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Bandit Stronghold', difficulty: 2, biome: 'ruins', enemies: ['bandit', 'bandit', 'wolf'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Wolf Den', difficulty: 1, biome: 'forest', enemies: ['wolf', 'wolf', 'goblin'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Dark Cavern', difficulty: 3, biome: 'cave', enemies: ['skeleton', 'bandit', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Cursed Ruins', difficulty: 3, biome: 'ruins', enemies: ['skeleton', 'bandit', 'goblin'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Spider Nest', difficulty: 2, biome: 'cave', enemies: ['spider', 'spider', 'rat'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Orc Fortress', difficulty: 3, biome: 'mountain', enemies: ['orc', 'orc', 'goblin', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Mage Tower', difficulty: 4, biome: 'dungeon', enemies: ['dark_mage', 'skeleton', 'wraith'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Troll Bridge', difficulty: 3, biome: 'forest', enemies: ['troll', 'goblin'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Rat Warren', difficulty: 1, biome: 'cave', enemies: ['rat', 'rat', 'rat'], minCount: 2, maxCount: 5 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Haunted Catacombs', difficulty: 4, biome: 'dungeon', enemies: ['wraith', 'skeleton', 'skeleton'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Ogre Lair', difficulty: 4, biome: 'cave', enemies: ['ogre', 'orc', 'goblin'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Brigand Camp', difficulty: 2, biome: 'forest', enemies: ['bandit', 'bandit', 'bandit'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Minotaur Labyrinth', difficulty: 4, biome: 'dungeon', enemies: ['minotaur', 'hobgoblin', 'ghoul'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Wyvern Roost', difficulty: 5, biome: 'mountain', enemies: ['wyvern', 'dire_wolf'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: "Lich's Sanctum", difficulty: 6, biome: 'dungeon', enemies: ['lich', 'wraith', 'skeleton', 'ghoul'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Vampire Crypt', difficulty: 5, biome: 'dungeon', enemies: ['vampire_spawn', 'ghoul', 'skeleton'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Dragon Lair', difficulty: 7, biome: 'cave', enemies: ['dragon_wyrmling', 'hobgoblin', 'hobgoblin'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Dire Wolf Pack', difficulty: 3, biome: 'forest', enemies: ['dire_wolf', 'dire_wolf', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.TOWN, name: 'Village', difficulty: 0 }),
    Object.freeze({ tile: Tile.TOWN, name: 'Market Town', difficulty: 0 }),
    Object.freeze({ tile: Tile.TOWN, name: 'Hamlet', difficulty: 0 }),
    Object.freeze({ tile: Tile.TOWN, name: 'Trading Post', difficulty: 0 }),
    Object.freeze({ tile: Tile.CAMP, name: 'Traveler Camp', difficulty: 0 }),
    Object.freeze({ tile: Tile.CAMP, name: 'Roadside Camp', difficulty: 0 }),
    Object.freeze({ tile: Tile.CAMP, name: 'Ranger Outpost', difficulty: 0 }),
    // Phase B: new location types using new enemies
    Object.freeze({ tile: Tile.DUNGEON, name: 'Gnoll Camp', difficulty: 2, biome: 'forest', enemies: ['gnoll', 'gnoll', 'kobold'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Kobold Warren', difficulty: 1, biome: 'cave', enemies: ['kobold', 'kobold', 'rat'], minCount: 2, maxCount: 5 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Bugbear Den', difficulty: 3, biome: 'cave', enemies: ['bugbear', 'goblin', 'hobgoblin'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Lizardfolk Village', difficulty: 2, biome: 'swamp', enemies: ['lizardfolk', 'lizardfolk', 'cockatrice'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Basilisk Lair', difficulty: 3, biome: 'cave', enemies: ['basilisk', 'cockatrice', 'spider'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Harpy Nest', difficulty: 3, biome: 'mountain', enemies: ['harpy', 'harpy', 'stirge'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Zombie Graveyard', difficulty: 2, biome: 'dungeon', enemies: ['zombie', 'zombie', 'ghoul', 'skeleton'], minCount: 2, maxCount: 5 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Worg Hunting Grounds', difficulty: 2, biome: 'forest', enemies: ['worg', 'worg', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Gargoyle Perch', difficulty: 4, biome: 'ruins', enemies: ['gargoyle', 'gargoyle', 'wight'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Owlbear Territory', difficulty: 3, biome: 'forest', enemies: ['owlbear', 'wolf', 'dire_wolf'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Manticore Peak', difficulty: 4, biome: 'mountain', enemies: ['manticore', 'harpy'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Phase Spider Web', difficulty: 3, biome: 'cave', enemies: ['phase_spider', 'spider', 'spider'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: "Giant's Keep", difficulty: 5, biome: 'mountain', enemies: ['hill_giant', 'ogre'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Elemental Rift', difficulty: 5, biome: 'lava', enemies: ['fire_elemental', 'fire_elemental'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Thoughtdrinker Colony', difficulty: 6, biome: 'dungeon', enemies: ['mind_flayer', 'wight', 'ghoul'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Dragon Hoard', difficulty: 8, biome: 'cave', enemies: ['young_dragon', 'kobold', 'kobold'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: "Death Knight's Tomb", difficulty: 8, biome: 'dungeon', enemies: ['death_knight', 'wight', 'skeleton'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Frozen Fortress', difficulty: 7, biome: 'mountain', enemies: ['frost_giant', 'worg', 'dire_wolf'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Demon Gate', difficulty: 7, biome: 'lava', enemies: ['demon', 'devil', 'fire_elemental'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Infernal Pit', difficulty: 6, biome: 'lava', enemies: ['devil', 'devil', 'demon'], minCount: 1, maxCount: 3 }),
  ]);

  function hashCoords(x, y, seed) {
    let h = seed >>> 0;
    h = (h + Math.imul(x | 0, 2654435761)) >>> 0;
    h = (h + Math.imul(y | 0, 2246822519)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 2654435769) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 3266489917) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  function noise2d(col, row, seed, scale) {
    const x = Math.floor(col / scale);
    const y = Math.floor(row / scale);
    const fx = (col / scale) - x;
    const fy = (row / scale) - y;

    const v00 = (hashCoords(x, y, seed) >>> 0) / 0x100000000;
    const v10 = (hashCoords(x + 1, y, seed) >>> 0) / 0x100000000;
    const v01 = (hashCoords(x, y + 1, seed) >>> 0) / 0x100000000;
    const v11 = (hashCoords(x + 1, y + 1, seed) >>> 0) / 0x100000000;

    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = v00 + (v10 - v00) * sx;
    const bot = v01 + (v11 - v01) * sx;
    return top + (bot - top) * sy;
  }

  function terrainNoise(col, row, seed) {
    const n1 = noise2d(col, row, seed, 8);
    const n2 = noise2d(col, row, seed + 7919, 16) * 0.5;
    const n3 = noise2d(col, row, seed + 15383, 32) * 0.25;
    return (n1 + n2 + n3) / 1.75;
  }

  // Blended value noise bunches around 0.5; stretching spreads it back
  // over 0..1 so thresholds read as rough shares of the world.
  const stretch = (v, k) => Math.max(0, Math.min(1, 0.5 + (v - 0.5) * k));

  function moistureNoise(col, row, seed) {
    return stretch(noise2d(col, row, seed + 48611, 12) * 0.35 + noise2d(col, row, seed + 52711, 40) * 0.65, 1.75);
  }

  // Continental shape: large swells under the local detail.
  function elevationNoise(col, row, seed) {
    return stretch(terrainNoise(col, row, seed) * 0.55 + noise2d(col, row, seed + 91141, 56) * 0.45, 2.2);
  }

  // Climate bands wide enough to walk through: a region spans dozens of tiles.
  function temperatureNoise(col, row, seed) {
    return stretch(noise2d(col, row, seed + 77003, 90) * 0.75 + noise2d(col, row, seed + 81239, 30) * 0.25, 1.65);
  }

  function volcanismNoise(col, row, seed) {
    return noise2d(col, row, seed + 23017, 26);
  }

  // Home Camp and the four locations around it; type indexes LOCATION_TYPES.
  const STARTING_LOCATIONS = Object.freeze([
    Object.freeze({ col: 0, row: 0, type: null }),
    Object.freeze({ col: 5, row: -3, type: 0 }),
    Object.freeze({ col: -4, row: 4, type: 20 }),
    Object.freeze({ col: 8, row: 5, type: 3 }),
    Object.freeze({ col: -6, row: -5, type: 1 }),
  ]);

  class OverworldMap {
    #worldSeed;
    #tempShift;
    #terrainCache = new Map();
    #chunks;
    #locations;
    #roads;
    #pathCache;

    constructor(worldSeed) {
      this.#worldSeed = worldSeed >>> 0;
      // every world starts in a temperate land; the correction fades with
      // distance so the rest of the world keeps its own climate
      this.#tempShift = 0.5 - temperatureNoise(0, 0, this.#worldSeed);
      this.#chunks = new Map();
      this.#locations = new Map();
      this.#roads = new Set();
      this.#pathCache = new Map();
    }

    get worldSeed() { return this.#worldSeed; }

    getTile(col, row) {
      const key = this.#locationKey(col, row);

      const loc = this.#locations.get(key);
      if (loc)
        return loc.tile;

      this.#ensureLocationsAround(col, row);
      const loc2 = this.#locations.get(key);
      if (loc2)
        return loc2.tile;

      // Roads always win: across water they are causeways, through mountains
      // passes, so every location stays reachable.
      if (this.#roads.has(key))
        return Tile.ROAD;

      return this.#baseTerrain(col, row);
    }

    getLocation(col, row) {
      this.#ensureLocationsAround(col, row);
      return this.#locations.get(this.#locationKey(col, row)) || null;
    }

    isPassable(col, row) {
      return !IMPASSABLE.has(this.getTile(col, row));
    }

    // Temperature 0 (frozen) .. 1 (scorching) at a cell.
    temperatureAt(col, row) {
      const d = Math.sqrt(col * col + row * row);
      const homeward = d < 40 ? 1 : d > 90 ? 0 : 1 - (d - 40) / 50;
      return Math.max(0, Math.min(1, temperatureNoise(col, row, this.#worldSeed) + this.#tempShift * homeward));
    }

    // The D&D biome a cell belongs to (data/biomes.js ids).
    biomeAt(col, row) {
      const info = TILE_INFO[this.#regionTile(col, row)];
      return info ? info.biome : 'temperate_plains';
    }

    // Natural ground of a cell, ignoring locations and roads.
    regionTile(col, row) {
      return this.#regionTile(col, row);
    }

    #regionTile(col, row) {
      const t = this.#baseTerrain(col, row);
      // overlays (mountains) take the climate of their surroundings
      if (t === Tile.MOUNTAIN || t === Tile.WATER) {
        const temp = this.temperatureAt(col, row);
        return temp < 0.25 ? Tile.SNOW : temp > 0.74 ? Tile.DESERT : Tile.GRASS;
      }
      return t;
    }

    // Painted ground under a cell's overlay (trees, rocks, landmarks).
    groundAt(col, row) {
      const t = this.#regionTile(col, row);
      return GROUND[t] || 'meadow';
    }

    // Whittaker-style biomes from elevation, moisture and temperature,
    // cached because the map is redrawn every frame.
    #baseTerrain(col, row) {
      const key = `${col},${row}`;
      let t = this.#terrainCache.get(key);
      if (t === undefined) {
        if (this.#terrainCache.size > 60000)
          this.#terrainCache.clear();
        t = this.#computeTerrain(col, row);
        this.#terrainCache.set(key, t);
      }
      return t;
    }

    #computeTerrain(col, row) {
      const seed = this.#worldSeed;
      const height = elevationNoise(col, row, seed);
      const moisture = moistureNoise(col, row, seed);
      const temp = this.temperatureAt(col, row);

      // rare volcanic country: ash plains around rivers of lava
      const volc = volcanismNoise(col, row, seed);
      if (volc > 0.85 && height > 0.45 && temp > 0.45)
        return volc > 0.92 ? Tile.LAVA : Tile.ASH;

      if (height < 0.14)
        return temp < 0.18 ? Tile.ICE : Tile.WATER;
      if (height < 0.18)
        return temp < 0.25 ? Tile.SNOW : Tile.SAND;
      if (height > 0.88)
        return Tile.MOUNTAIN;

      if (temp < 0.25) {
        if (height > 0.78 && temp < 0.12)
          return Tile.ICE;
        return moisture > 0.5 ? Tile.TAIGA : Tile.SNOW;
      }
      if (temp > 0.74) {
        if (moisture > 0.62)
          return Tile.JUNGLE;
        if (moisture < 0.4)
          return height > 0.62 ? Tile.BADLANDS : Tile.DESERT;
        return height > 0.74 ? Tile.HILLS : Tile.SAVANNA;
      }
      if (height > 0.76)
        return Tile.HILLS;
      if (moisture > 0.72 && height < 0.36)
        return Tile.SWAMP;
      if (moisture > 0.6 && height < 0.66)
        return Tile.FOREST;
      if (moisture > 0.48 && height < 0.44)
        return Tile.FOREST;
      return Tile.GRASS;
    }

    #locationKey(col, row) {
      return `${col},${row}`;
    }

    #ensureLocationsAround(col, row) {
      const gcx = Math.floor(col / LOCATION_SPACING);
      const gcy = Math.floor(row / LOCATION_SPACING);
      for (let dy = -1; dy <= 1; ++dy)
        for (let dx = -1; dx <= 1; ++dx)
          this.#generateLocationCell(gcx + dx, gcy + dy);
    }

    #generateLocationCell(gcx, gcy) {
      const cellKey = `lc:${gcx},${gcy}`;
      if (this.#chunks.has(cellKey))
        return;
      this.#chunks.set(cellKey, true);

      const seed = hashCoords(gcx, gcy, this.#worldSeed + 99991);
      const rng = new PRNG(seed);

      if (gcx === 0 && gcy === 0) {
        this.#placeStartingArea(rng);
        return;
      }

      const baseCol = gcx * LOCATION_SPACING + rng.nextInt(3, LOCATION_SPACING - 4);
      const baseRow = gcy * LOCATION_SPACING + rng.nextInt(3, LOCATION_SPACING - 4);

      const dist = Math.sqrt(gcx * gcx + gcy * gcy);
      const locType = this.#pickLocationType(rng, dist, this.#regionTile(baseCol, baseRow));
      const key = this.#locationKey(baseCol, baseRow);
      this.#locations.set(key, Object.freeze({ ...locType, col: baseCol, row: baseRow }));

      this.#clearTerrainAround(baseCol, baseRow);

      const prevCells = [];
      for (let dy = -1; dy <= 1; ++dy)
        for (let dx = -1; dx <= 1; ++dx) {
          if (dx === 0 && dy === 0)
            continue;
          const nKey = `lc:${gcx + dx},${gcy + dy}`;
          if (!this.#chunks.has(nKey))
            continue;
          for (const [k, loc] of this.#locations) {
            if (loc.col !== undefined && loc.row !== undefined) {
              const lgcx = Math.floor(loc.col / LOCATION_SPACING);
              const lgcy = Math.floor(loc.row / LOCATION_SPACING);
              if (lgcx === gcx + dx && lgcy === gcy + dy)
                prevCells.push(loc);
            }
          }
        }

      if (prevCells.length > 0) {
        const nearest = prevCells.reduce((best, l) => {
          const d = Math.abs(l.col - baseCol) + Math.abs(l.row - baseRow);
          return d < best.d ? { d, l } : best;
        }, { d: Infinity, l: null }).l;
        if (nearest)
          this.#drawRoad(baseCol, baseRow, nearest.col, nearest.row);
      }

      // Cells around the start always link to the starting area; otherwise
      // they only link to cells generated before them, which can leave the
      // start cut off from the rest of the road network.
      if (Math.abs(gcx) <= 1 && Math.abs(gcy) <= 1) {
        const home = STARTING_LOCATIONS.reduce((best, p) => {
          const d = Math.abs(p.col - baseCol) + Math.abs(p.row - baseRow);
          return d < best.d ? { d, p } : best;
        }, { d: Infinity, p: null }).p;
        this.#drawRoad(baseCol, baseRow, home.col, home.row);
      }

      const centerCol = Math.round(LOCATION_SPACING / 2);
      const centerRow = Math.round(LOCATION_SPACING / 2);
      this.#drawRoad(baseCol, baseRow,
        gcx * LOCATION_SPACING + centerCol,
        gcy * LOCATION_SPACING + centerRow
      );
    }

    #placeStartingArea(rng) {
      this.#locations.set(this.#locationKey(0, 0), Object.freeze({
        tile: Tile.CAMP, name: 'Home Camp', difficulty: 0, col: 0, row: 0
      }));
      this.#clearTerrainAround(0, 0);

      for (const p of STARTING_LOCATIONS) {
        if (p.type === null)
          continue;
        this.#locations.set(this.#locationKey(p.col, p.row), Object.freeze({
          ...LOCATION_TYPES[p.type], col: p.col, row: p.row
        }));
        this.#clearTerrainAround(p.col, p.row);
        this.#drawRoad(0, 0, p.col, p.row);
      }
    }

    // Towns and camps are common everywhere; dungeons get harder with
    // distance from home and prefer regions that suit them (a lizardfolk
    // village in a swamp, a frozen fortress in the snow).
    #pickLocationType(rng, dist, region) {
      const roll = rng.next();
      const towns = LOCATION_TYPES.filter(l => l.tile === Tile.TOWN);
      const camps = LOCATION_TYPES.filter(l => l.tile === Tile.CAMP);
      if (roll < 0.12)
        return towns[rng.nextInt(0, towns.length - 1)];
      if (roll < 0.22)
        return camps[rng.nextInt(0, camps.length - 1)];

      const maxDiff = dist <= 1 ? 2 : dist <= 3 ? 3 : dist <= 5 ? 4 : dist <= 8 ? 6 : 8;
      const minDiff = Math.max(1, maxDiff - 3);
      const dungeons = LOCATION_TYPES.filter(l => l.tile === Tile.DUNGEON && l.difficulty >= minDiff && l.difficulty <= maxDiff);
      const weights = dungeons.map(l => {
        const fit = LOCATION_FIT[l.biome];
        if (!fit)
          return 1;                      // caves, crypts and ruins fit anywhere
        return fit.includes(region) ? 3 : 0.15;
      });
      const total = weights.reduce((a, w) => a + w, 0);
      let pick = rng.next() * total;
      for (let i = 0; i < dungeons.length; ++i) {
        pick -= weights[i];
        if (pick <= 0)
          return dungeons[i];
      }
      return dungeons[dungeons.length - 1];
    }

    #clearTerrainAround(_col, _row) {
      // no-op: terrain is generated on-the-fly from noise
      // locations override terrain via getTile
    }

    #drawRoad(c1, r1, c2, r2) {
      let c = c1, r = r1;
      while (c !== c2 || r !== r2) {
        this.#roads.add(this.#locationKey(c, r));
        if (c !== c2)
          c += c < c2 ? 1 : -1;
        else if (r !== r2)
          r += r < r2 ? 1 : -1;
      }
      this.#roads.add(this.#locationKey(c2, r2));
    }

    getVisibleTiles(camX, camY, viewW, viewH, tileSize) {
      const startCol = Math.floor(camX / tileSize) - 1;
      const startRow = Math.floor(camY / tileSize) - 1;
      const endCol = Math.ceil((camX + viewW) / tileSize) + 1;
      const endRow = Math.ceil((camY + viewH) / tileSize) + 1;
      const tiles = [];
      for (let r = startRow; r <= endRow; ++r)
        for (let c = startCol; c <= endCol; ++c)
          tiles.push({ col: c, row: r, tile: this.getTile(c, r) });
      return tiles;
    }

    getVisibleLocations(camX, camY, viewW, viewH, tileSize) {
      const startCol = Math.floor(camX / tileSize) - 2;
      const startRow = Math.floor(camY / tileSize) - 2;
      const endCol = Math.ceil((camX + viewW) / tileSize) + 2;
      const endRow = Math.ceil((camY + viewH) / tileSize) + 2;
      const locs = [];
      for (let r = startRow; r <= endRow; ++r)
        for (let c = startCol; c <= endCol; ++c) {
          const loc = this.getLocation(c, r);
          if (loc)
            locs.push(loc);
        }
      return locs;
    }

    encounterChance(col, row) {
      const info = TILE_INFO[this.getTile(col, row)];
      return info ? info.encounter : 0;
    }

    // Map distance-based tier to AI behavior tier (0-4)
    encounterAiTier(col, row) {
      const dist = Math.sqrt(col * col + row * row);
      const tier = Math.min(7, Math.floor(dist / 12));
      return Math.min(4, Math.floor(tier / 2));
    }

    // Generate encounter enemies scaled to party level.
    // partyLevel: average level of party (defaults to 1 if not provided)
    encounterEnemies(col, row, prng, partyLevel) {
      const avgLevel = partyLevel || 1;
      const dist = Math.sqrt(col * col + row * row);
      const tier = Math.min(7, Math.floor(dist / 12));
      const biome = this.biomeAt(col, row);

      // the full monster roster knows who lives where
      if (TR.MonsterRoster && typeof TR.MonsterRoster.encounter === 'function') {
        // far from home the land gets more dangerous than the party
        const list = TR.MonsterRoster.encounter(biome, avgLevel + Math.round(tier * 0.6), prng);
        if (list && list.length)
          return list;
      }

      // Thematic creature pools by distance tier (flavor only - stats are scaled)
      const pools = [
        ['rat', 'goblin', 'wolf', 'kobold'],
        ['goblin', 'wolf', 'bandit', 'spider', 'kobold', 'stirge', 'cockatrice'],
        ['skeleton', 'bandit', 'wolf', 'orc', 'spider', 'hobgoblin', 'gnoll', 'zombie', 'lizardfolk'],
        ['orc', 'skeleton', 'dark_mage', 'bandit', 'troll', 'dire_wolf', 'ghoul', 'bugbear', 'worg', 'harpy'],
        ['wraith', 'ogre', 'troll', 'dark_mage', 'orc', 'minotaur', 'hobgoblin', 'basilisk', 'wight', 'gargoyle', 'owlbear', 'manticore', 'phase_spider'],
        ['vampire_spawn', 'wyvern', 'wraith', 'ogre', 'lich', 'minotaur', 'hill_giant', 'fire_elemental'],
        ['dragon_wyrmling', 'lich', 'vampire_spawn', 'wyvern', 'minotaur', 'mind_flayer', 'demon', 'devil'],
        ['young_dragon', 'death_knight', 'frost_giant', 'mind_flayer', 'demon', 'devil', 'lich'],
      ];
      // mostly the region's own creatures (not too strong yet), the rest
      // from the danger of the distance: far lands stay deadly
      const local = (BIOME_CREATURES[biome] || []).filter(id => creatureCR(id) <= 1 + tier * 1.2);
      const pickId = () => (local.length >= 2 && prng.next() < 0.6 ? prng.pick(local) : prng.pick(pools[tier]));
      const count = prng.nextInt(1, Math.min(4, 1 + tier));
      const enemies = [];

      // Scale enemies to party level with some variance
      // D&D encounter design: CR ≈ party level for a moderate challenge
      // Multiple enemies: each should be CR ≈ partyLevel - 2 per doubling of count
      const crBudget = avgLevel + tier * 0.5;
      const perEnemyCR = count === 1 ? crBudget : Math.max(0.5, crBudget - Math.log2(count) * 2);

      for (let i = 0; i < count; ++i) {
        const templateId = pickId();
        // Target level = perEnemyCR with ±20% variance
        const variance = 0.8 + prng.next() * 0.4;
        const targetLevel = Math.max(1, Math.round(perEnemyCR * variance));
        enemies.push({ templateId, targetLevel });
      }

      // Leader variant: ~25% chance the first enemy is stronger
      if (count >= 2 && tier >= 1 && prng.next() < 0.25)
        enemies[0].targetLevel = Math.max(1, Math.round(crBudget * (1.1 + prng.next() * 0.3)));

      return enemies;
    }

    #pathCost(col, row, goalCol, goalRow) {
      const t = this.getTile(col, row);
      if (IMPASSABLE.has(t))
        return -1;
      if (t === Tile.DUNGEON || t === Tile.TOWN || t === Tile.CAMP) {
        if (col === goalCol && row === goalRow)
          return 1;
        return -1;
      }
      const info = TILE_INFO[t];
      return info && info.cost > 0 ? info.cost : 1;
    }

    findPath(start, goal, maxDist) {
      if (start.col === goal.col && start.row === goal.row)
        return [{ col: start.col, row: start.row }];
      if (!this.isPassable(goal.col, goal.row))
        return null;

      const limit = maxDist || 200;
      const h0 = Math.abs(goal.col - start.col) + Math.abs(goal.row - start.row);
      if (h0 > limit)
        return null;

      // Check path cache
      const cacheKey = `${start.col},${start.row}|${goal.col},${goal.row}`;
      const cached = this.#pathCache.get(cacheKey);
      if (cached !== undefined)
        return cached;

      // Evict oldest if cache is full
      if (this.#pathCache.size >= 128) {
        const oldest = this.#pathCache.keys().next().value;
        this.#pathCache.delete(oldest);
      }

      const result = this.#biDirAStar(start, goal, limit);
      this.#pathCache.set(cacheKey, result);
      return result;
    }

    clearPathCache() {
      this.#pathCache.clear();
    }

    // Bidirectional weighted A*
    #biDirAStar(start, goal, limit) {
      const startKey = `${start.col},${start.row}`;
      const goalKey = `${goal.col},${goal.row}`;
      const DIRS = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];
      const heuristic = (ac, ar, bc, br) => Math.abs(ac - bc) + Math.abs(ar - br);

      const fwdG = new Map();
      const bwdG = new Map();
      const fwdFrom = new Map();
      const bwdFrom = new Map();
      const fwdClosed = new Set();
      const bwdClosed = new Set();

      fwdG.set(startKey, 0);
      bwdG.set(goalKey, 0);

      // Simple sorted array open lists (overworld paths are modest length)
      const fwdOpen = [{ key: startKey, f: heuristic(start.col, start.row, goal.col, goal.row) }];
      const bwdOpen = [{ key: goalKey, f: heuristic(goal.col, goal.row, start.col, start.row) }];

      let bestCost = Infinity;
      let meetKey = null;

      const popBest = (list) => {
        let bestIdx = 0;
        for (let i = 1; i < list.length; ++i)
          if (list[i].f < list[bestIdx].f)
            bestIdx = i;
        const item = list[bestIdx];
        list[bestIdx] = list[list.length - 1];
        list.pop();
        return item;
      };

      const expandSide = (openList, myG, myFrom, myClosed, otherG, otherClosed, targetCol, targetRow, isForward) => {
        if (openList.length === 0)
          return;
        const current = popBest(openList);
        myClosed.add(current.key);
        const [cc, cr] = current.key.split(',').map(Number);
        const cg = myG.get(current.key);

        if (otherClosed.has(current.key)) {
          const total = cg + otherG.get(current.key);
          if (total < bestCost) {
            bestCost = total;
            meetKey = current.key;
          }
        }

        for (const d of DIRS) {
          const nc = cc + d.dc;
          const nr = cr + d.dr;
          const nbKey = `${nc},${nr}`;
          if (myClosed.has(nbKey))
            continue;
          const cost = isForward
            ? this.#pathCost(nc, nr, goal.col, goal.row)
            : this.#pathCost(nc, nr, start.col, start.row);
          if (cost < 0)
            continue;
          const tentG = cg + cost;
          if (tentG > limit)
            continue;
          const prevG = myG.get(nbKey);
          if (prevG !== undefined && tentG >= prevG)
            continue;
          myG.set(nbKey, tentG);
          myFrom.set(nbKey, current.key);
          const h = heuristic(nc, nr, targetCol, targetRow);
          openList.push({ key: nbKey, f: tentG + h });
          if (otherG.has(nbKey)) {
            const total = tentG + otherG.get(nbKey);
            if (total < bestCost) {
              bestCost = total;
              meetKey = nbKey;
            }
          }
        }
      };

      let iterations = 0;
      const maxIter = limit * limit;

      while ((fwdOpen.length > 0 || bwdOpen.length > 0) && iterations < maxIter) {
        ++iterations;
        expandSide(fwdOpen, fwdG, fwdFrom, fwdClosed, bwdG, bwdClosed, goal.col, goal.row, true);
        expandSide(bwdOpen, bwdG, bwdFrom, bwdClosed, fwdG, fwdClosed, start.col, start.row, false);

        if (meetKey !== null && fwdOpen.length > 0 && bwdOpen.length > 0) {
          // Both fronts' minimums exceed best
          let fwdMin = Infinity, bwdMin = Infinity;
          for (const e of fwdOpen)
            if (e.f < fwdMin)
              fwdMin = e.f;
          for (const e of bwdOpen)
            if (e.f < bwdMin)
              bwdMin = e.f;
          if (fwdMin >= bestCost && bwdMin >= bestCost)
            break;
        }
      }

      if (!meetKey)
        return null;

      // Reconstruct: forward path to meetKey
      const fwdPath = [];
      let k = meetKey;
      while (k) {
        const [c, r] = k.split(',').map(Number);
        fwdPath.push({ col: c, row: r });
        k = fwdFrom.get(k);
      }
      fwdPath.reverse();

      // Append backward path from meetKey
      k = bwdFrom.get(meetKey);
      while (k) {
        const [c, r] = k.split(',').map(Number);
        fwdPath.push({ col: c, row: r });
        k = bwdFrom.get(k);
      }

      return fwdPath;
    }

    extractTileRect(centerCol, centerRow, cols, rows) {
      const startCol = centerCol - Math.floor(cols / 2);
      const startRow = centerRow - Math.floor(rows / 2);
      const tiles = [];
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c)
          tiles.push(this.getTile(startCol + c, startRow + r));
      return { tiles, startCol, startRow };
    }

    // Battle biome (combat palette, backdrop) for a fight at a cell.
    encounterBiome(col, row) {
      const info = TILE_INFO[this.#regionTile(col, row)];
      return info ? info.battle : 'plains';
    }

    serialize() {
      return { worldSeed: this.#worldSeed };
    }

    static deserialize(data) {
      if (!data || typeof data.worldSeed !== 'number')
        return null;
      return new OverworldMap(data.worldSeed);
    }
  }

  TR.OverworldMap = OverworldMap;
  // Encounter pacing: no fight within GRACE steps of the last one (or of
  // leaving a town, camp or dungeon), then the odds ramp up gently.
  const GRACE = 15;
  function encounterPacing(stepsSince) {
    if (stepsSince < GRACE)
      return 0;
    return Math.min(1.5, (stepsSince - GRACE) / 30);
  }

  TR.OverworldTile = Tile;
  TR.encounterPacing = encounterPacing;
  TR.OverworldTileInfo = TILE_INFO;
  TR.CHUNK_SIZE = CHUNK_SIZE;
  TR.LOCATION_SPACING = LOCATION_SPACING;
})();
