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
  });

  const LOCATION_TYPES = Object.freeze([
    Object.freeze({ tile: Tile.DUNGEON, name: 'Goblin Cave', difficulty: 1, biome: 'cave', enemies: ['goblin', 'wolf', 'rat'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Skeleton Crypt', difficulty: 2, biome: 'dungeon_floor', enemies: ['skeleton', 'skeleton', 'bandit'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Bandit Stronghold', difficulty: 2, biome: 'ruins', enemies: ['bandit', 'bandit', 'wolf'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Wolf Den', difficulty: 1, biome: 'forest', enemies: ['wolf', 'wolf', 'goblin'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Dark Cavern', difficulty: 3, biome: 'cave', enemies: ['skeleton', 'bandit', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Cursed Ruins', difficulty: 3, biome: 'ruins', enemies: ['skeleton', 'bandit', 'goblin'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Spider Nest', difficulty: 2, biome: 'cave', enemies: ['spider', 'spider', 'rat'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Orc Fortress', difficulty: 3, biome: 'mountain', enemies: ['orc', 'orc', 'goblin', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Mage Tower', difficulty: 4, biome: 'dungeon_floor', enemies: ['dark_mage', 'skeleton', 'wraith'], minCount: 2, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Troll Bridge', difficulty: 3, biome: 'forest', enemies: ['troll', 'goblin'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Rat Warren', difficulty: 1, biome: 'cave', enemies: ['rat', 'rat', 'rat'], minCount: 2, maxCount: 5 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Haunted Catacombs', difficulty: 4, biome: 'dungeon_floor', enemies: ['wraith', 'skeleton', 'skeleton'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Ogre Lair', difficulty: 4, biome: 'cave', enemies: ['ogre', 'orc', 'goblin'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Brigand Camp', difficulty: 2, biome: 'forest', enemies: ['bandit', 'bandit', 'bandit'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Minotaur Labyrinth', difficulty: 4, biome: 'dungeon_floor', enemies: ['minotaur', 'hobgoblin', 'ghoul'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Wyvern Roost', difficulty: 5, biome: 'mountain', enemies: ['wyvern', 'dire_wolf'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: "Lich's Sanctum", difficulty: 6, biome: 'dungeon_floor', enemies: ['lich', 'wraith', 'skeleton', 'ghoul'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Vampire Crypt', difficulty: 5, biome: 'dungeon_floor', enemies: ['vampire_spawn', 'ghoul', 'skeleton'], minCount: 2, maxCount: 3 }),
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
    Object.freeze({ tile: Tile.DUNGEON, name: 'Zombie Graveyard', difficulty: 2, biome: 'dungeon_floor', enemies: ['zombie', 'zombie', 'ghoul', 'skeleton'], minCount: 2, maxCount: 5 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Worg Hunting Grounds', difficulty: 2, biome: 'forest', enemies: ['worg', 'worg', 'wolf'], minCount: 2, maxCount: 4 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Gargoyle Perch', difficulty: 4, biome: 'ruins', enemies: ['gargoyle', 'gargoyle', 'wight'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Owlbear Territory', difficulty: 3, biome: 'forest', enemies: ['owlbear', 'wolf', 'dire_wolf'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Manticore Peak', difficulty: 4, biome: 'mountain', enemies: ['manticore', 'harpy'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Phase Spider Web', difficulty: 3, biome: 'cave', enemies: ['phase_spider', 'spider', 'spider'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: "Giant's Keep", difficulty: 5, biome: 'mountain', enemies: ['hill_giant', 'ogre'], minCount: 1, maxCount: 2 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Elemental Rift', difficulty: 5, biome: 'lava', enemies: ['fire_elemental', 'fire_elemental'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Mind Flayer Colony', difficulty: 6, biome: 'dungeon_floor', enemies: ['mind_flayer', 'wight', 'ghoul'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: 'Dragon Hoard', difficulty: 8, biome: 'cave', enemies: ['young_dragon', 'kobold', 'kobold'], minCount: 1, maxCount: 3 }),
    Object.freeze({ tile: Tile.DUNGEON, name: "Death Knight's Tomb", difficulty: 8, biome: 'dungeon_floor', enemies: ['death_knight', 'wight', 'skeleton'], minCount: 1, maxCount: 3 }),
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

  function moistureNoise(col, row, seed) {
    return noise2d(col, row, seed + 48611, 12);
  }

  class OverworldMap {
    #worldSeed;
    #chunks;
    #locations;
    #roads;
    #pathCache;

    constructor(worldSeed) {
      this.#worldSeed = worldSeed >>> 0;
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

      if (this.#roads.has(key)) {
        const base = this.#baseTerrain(col, row);
        if (base !== Tile.WATER && base !== Tile.MOUNTAIN)
          return Tile.ROAD;
      }

      return this.#baseTerrain(col, row);
    }

    getLocation(col, row) {
      this.#ensureLocationsAround(col, row);
      return this.#locations.get(this.#locationKey(col, row)) || null;
    }

    isPassable(col, row) {
      const t = this.getTile(col, row);
      return t !== Tile.MOUNTAIN && t !== Tile.WATER && t !== Tile.VOID;
    }

    #baseTerrain(col, row) {
      const height = terrainNoise(col, row, this.#worldSeed);
      const moisture = moistureNoise(col, row, this.#worldSeed);

      if (height < 0.18)
        return Tile.WATER;
      if (height < 0.23)
        return Tile.SAND;
      if (height > 0.82)
        return Tile.MOUNTAIN;

      if (moisture > 0.6 && height < 0.6)
        return Tile.FOREST;
      if (moisture > 0.45 && height < 0.45)
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
      const locType = this.#pickLocationType(rng, dist);
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

      this.#locations.set(this.#locationKey(5, -3), Object.freeze({
        ...LOCATION_TYPES[0], col: 5, row: -3
      }));
      this.#clearTerrainAround(5, -3);
      this.#drawRoad(0, 0, 5, -3);

      this.#locations.set(this.#locationKey(-4, 4), Object.freeze({
        ...LOCATION_TYPES[20], col: -4, row: 4
      }));
      this.#clearTerrainAround(-4, 4);
      this.#drawRoad(0, 0, -4, 4);

      this.#locations.set(this.#locationKey(8, 5), Object.freeze({
        ...LOCATION_TYPES[3], col: 8, row: 5
      }));
      this.#clearTerrainAround(8, 5);
      this.#drawRoad(0, 0, 8, 5);

      this.#locations.set(this.#locationKey(-6, -5), Object.freeze({
        ...LOCATION_TYPES[1], col: -6, row: -5
      }));
      this.#clearTerrainAround(-6, -5);
      this.#drawRoad(0, 0, -6, -5);
    }

    #pickLocationType(rng, dist) {
      const dungeonCount = 41;
      const townStart = 20;
      const townCount = 4;
      const campStart = 24;
      const campCount = 3;
      const newDungeonStart = 27;
      const newDungeonCount = 14;

      const roll = rng.next();
      if (roll < 0.12)
        return LOCATION_TYPES[townStart + rng.nextInt(0, townCount - 1)];
      if (roll < 0.22)
        return LOCATION_TYPES[campStart + rng.nextInt(0, campCount - 1)];

      if (dist <= 1)
        return LOCATION_TYPES[rng.nextInt(0, 3)];
      if (dist <= 3)
        return LOCATION_TYPES[rng.nextInt(0, 8)];
      if (dist <= 5)
        return LOCATION_TYPES[rng.nextInt(0, 14)];
      if (dist <= 8)
        return LOCATION_TYPES[rng.nextInt(0, newDungeonStart + 10)];
      return LOCATION_TYPES[rng.nextInt(0, dungeonCount - 1)];
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
      const t = this.getTile(col, row);
      if (t === Tile.FOREST)
        return 0.12;
      if (t === Tile.GRASS)
        return 0.06;
      if (t === Tile.SAND)
        return 0.04;
      if (t === Tile.ROAD)
        return 0.02;
      return 0;
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
      const pool = pools[tier];
      const count = prng.nextInt(1, Math.min(4, 1 + tier));
      const enemies = [];

      // Scale enemies to party level with some variance
      // D&D encounter design: CR ≈ party level for a moderate challenge
      // Multiple enemies: each should be CR ≈ partyLevel - 2 per doubling of count
      const crBudget = avgLevel + tier * 0.5;
      const perEnemyCR = count === 1 ? crBudget : Math.max(0.5, crBudget - Math.log2(count) * 2);

      for (let i = 0; i < count; ++i) {
        const templateId = prng.pick(pool);
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
      if (t === Tile.MOUNTAIN || t === Tile.WATER || t === Tile.VOID)
        return -1;
      if (t === Tile.DUNGEON || t === Tile.TOWN || t === Tile.CAMP) {
        if (col === goalCol && row === goalRow)
          return 1;
        return -1;
      }
      if (t === Tile.ROAD)
        return 0.5;
      if (t === Tile.FOREST)
        return 1.5;
      if (t === Tile.SAND)
        return 1.2;
      return 1;
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

    encounterBiome(col, row) {
      const t = this.getTile(col, row);
      if (t === Tile.FOREST)
        return 'forest';
      if (t === Tile.SAND)
        return 'plains';
      return 'plains';
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
  TR.OverworldTile = Tile;
  TR.CHUNK_SIZE = CHUNK_SIZE;
  TR.LOCATION_SPACING = LOCATION_SPACING;
})();
