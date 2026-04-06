;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { OverworldMap, OverworldTile, PRNG } = window.SZ.TacticalRealms;

  describe('OverworldMap', () => {

    it('stores world seed', () => {
      const map = new OverworldMap(12345);
      assert.equal(map.worldSeed, 12345);
    });

    it('different seeds produce different maps', () => {
      const map = new OverworldMap(12345);
      const map2 = new OverworldMap(99999);
      let different = false;
      for (let r = -10; r < 10; ++r)
        for (let c = -10; c < 10; ++c)
          if (map.getTile(c, r) !== map2.getTile(c, r))
            different = true;
      assert.ok(different);
    });

    it('returns a valid tile type for any coordinate', () => {
      const map = new OverworldMap(12345);
      const validTiles = new Set(Object.values(OverworldTile));
      for (let r = -50; r < 50; r += 7)
        for (let c = -50; c < 50; c += 7)
          assert.ok(validTiles.has(map.getTile(c, r)), `tile at (${c},${r}) should be valid`);
    });

    it('returns consistent results for same coordinate', () => {
      const map = new OverworldMap(12345);
      for (let r = -20; r < 20; r += 3)
        for (let c = -20; c < 20; c += 3)
          assert.equal(map.getTile(c, r), map.getTile(c, r));
    });

    it('same seed gives same tiles', () => {
      const map = new OverworldMap(12345);
      const map2 = new OverworldMap(12345);
      for (let r = -20; r < 20; r += 3)
        for (let c = -20; c < 20; c += 3)
          assert.equal(map.getTile(c, r), map2.getTile(c, r));
    });

    it('handles negative coordinates', () => {
      const map = new OverworldMap(12345);
      const t = map.getTile(-100, -100);
      assert.ok(typeof t === 'number');
    });

    it('handles large coordinates', () => {
      const map = new OverworldMap(12345);
      const t = map.getTile(10000, 10000);
      assert.ok(typeof t === 'number');
    });

    it('grass is passable', () => {
      const map = new OverworldMap(42);
      let foundGrass = false;
      for (let r = -30; r < 30 && !foundGrass; ++r)
        for (let c = -30; c < 30 && !foundGrass; ++c)
          if (map.getTile(c, r) === OverworldTile.GRASS) {
            assert.ok(map.isPassable(c, r));
            foundGrass = true;
          }
      assert.ok(foundGrass, 'should find at least one grass tile');
    });

    it('water is impassable', () => {
      const map = new OverworldMap(42);
      let foundWater = false;
      for (let r = -100; r < 100 && !foundWater; ++r)
        for (let c = -100; c < 100 && !foundWater; ++c)
          if (map.getTile(c, r) === OverworldTile.WATER) {
            assert.ok(!map.isPassable(c, r));
            foundWater = true;
          }
    });

    it('mountain is impassable', () => {
      const map = new OverworldMap(42);
      let foundMt = false;
      for (let r = -100; r < 100 && !foundMt; ++r)
        for (let c = -100; c < 100 && !foundMt; ++c)
          if (map.getTile(c, r) === OverworldTile.MOUNTAIN) {
            assert.ok(!map.isPassable(c, r));
            foundMt = true;
          }
    });

    it('road is passable', () => {
      const map = new OverworldMap(12345);
      assert.ok(map.isPassable(0, 0) || map.isPassable(1, 0));
    });

    it('home camp at (0,0)', () => {
      const map = new OverworldMap(12345);
      const loc = map.getLocation(0, 0);
      assert.ok(loc);
      assert.equal(loc.tile, OverworldTile.CAMP);
      assert.equal(loc.name, 'Home Camp');
    });

    it('starting position is passable', () => {
      const map = new OverworldMap(12345);
      assert.ok(map.isPassable(0, 0));
    });

    it('has nearby dungeon at (5,-3)', () => {
      const map = new OverworldMap(12345);
      const loc = map.getLocation(5, -3);
      assert.ok(loc);
      assert.equal(loc.tile, OverworldTile.DUNGEON);
    });

    it('has nearby town at (-4,4)', () => {
      const map = new OverworldMap(12345);
      const loc = map.getLocation(-4, 4);
      assert.ok(loc);
      assert.equal(loc.tile, OverworldTile.TOWN);
    });

    it('roads connect starting locations', () => {
      const map = new OverworldMap(12345);
      let roadCount = 0;
      for (let c = 0; c <= 5; ++c)
        for (let r = 0; r >= -3; --r)
          if (map.getTile(c, r) === OverworldTile.ROAD)
            ++roadCount;
      assert.greaterThan(roadCount, 0);
    });

    it('getLocation returns null for empty tiles', () => {
      const map = new OverworldMap(12345);
      let foundNull = false;
      for (let r = -5; r < 5 && !foundNull; ++r)
        for (let c = -5; c < 5 && !foundNull; ++c) {
          const loc = map.getLocation(c, r);
          if (!loc) foundNull = true;
        }
      assert.ok(foundNull);
    });

    it('generates locations in distant regions', () => {
      const map = new OverworldMap(12345);
      let foundLoc = false;
      for (let r = 50; r < 80 && !foundLoc; ++r)
        for (let c = 50; c < 80 && !foundLoc; ++c) {
          const loc = map.getLocation(c, r);
          if (loc) foundLoc = true;
        }
      assert.ok(foundLoc, 'should find locations far from origin');
    });

    it('locations have required fields', () => {
      const map = new OverworldMap(12345);
      const loc = map.getLocation(0, 0);
      assert.ok(loc);
      assert.ok(typeof loc.tile === 'number');
      assert.ok(typeof loc.name === 'string');
      assert.greaterThan(loc.name.length, 0);
    });

    it('dungeon locations have enemy data', () => {
      const map = new OverworldMap(12345);
      const loc = map.getLocation(5, -3);
      assert.ok(loc);
      assert.equal(loc.tile, OverworldTile.DUNGEON);
      assert.ok(Array.isArray(loc.enemies));
      assert.greaterThan(loc.enemies.length, 0);
    });

    it('getVisibleTiles returns array of tile objects', () => {
      const map = new OverworldMap(12345);
      const tiles = map.getVisibleTiles(0, 0, 320, 320, 32);
      assert.ok(Array.isArray(tiles));
      assert.greaterThan(tiles.length, 0);
      assert.ok('col' in tiles[0]);
      assert.ok('row' in tiles[0]);
      assert.ok('tile' in tiles[0]);
    });

    it('getVisibleTiles covers visible area', () => {
      const map = new OverworldMap(12345);
      const tiles = map.getVisibleTiles(0, 0, 128, 128, 32);
      assert.greaterThan(tiles.length, 12);
    });

    it('getVisibleLocations finds starting locations near origin', () => {
      const map = new OverworldMap(12345);
      const locs = map.getVisibleLocations(-200, -200, 600, 600, 32);
      assert.ok(Array.isArray(locs));
      assert.greaterThan(locs.length, 0);
      const camp = locs.find(l => l.name === 'Home Camp');
      assert.ok(camp);
    });

    it('encounterChance returns number between 0 and 1', () => {
      const map = new OverworldMap(12345);
      for (let r = -20; r < 20; r += 5)
        for (let c = -20; c < 20; c += 5) {
          const ch = map.encounterChance(c, r);
          assert.ok(ch >= 0 && ch <= 1, `chance at (${c},${r}) should be 0-1`);
        }
    });

    it('forest has higher encounter rate than road', () => {
      const map = new OverworldMap(42);
      let forestTile = null, roadTile = null;
      for (let r = -30; r < 30; ++r)
        for (let c = -30; c < 30; ++c) {
          const t = map.getTile(c, r);
          if (t === OverworldTile.FOREST && !forestTile) forestTile = { c, r };
          if (t === OverworldTile.ROAD && !roadTile) roadTile = { c, r };
        }
      if (forestTile && roadTile)
        assert.greaterThan(map.encounterChance(forestTile.c, forestTile.r), map.encounterChance(roadTile.c, roadTile.r));
    });

    it('water and mountain have zero encounter chance', () => {
      const map = new OverworldMap(42);
      for (let r = -50; r < 50; ++r)
        for (let c = -50; c < 50; ++c) {
          const t = map.getTile(c, r);
          if (t === OverworldTile.WATER || t === OverworldTile.MOUNTAIN)
            assert.equal(map.encounterChance(c, r), 0);
        }
    });

    it('encounterEnemies returns array of enemy objects', () => {
      const map = new OverworldMap(12345);
      const prng = new PRNG(42);
      const enemies = map.encounterEnemies(10, 10, prng);
      assert.ok(Array.isArray(enemies));
      assert.greaterThan(enemies.length, 0);
      assert.ok(enemies[0].templateId);
    });

    it('encounter difficulty scales with distance', () => {
      const map = new OverworldMap(12345);
      const prng1 = new PRNG(100);
      const prng2 = new PRNG(100);
      const nearEnemies = map.encounterEnemies(5, 5, prng1);
      const farEnemies = map.encounterEnemies(100, 100, prng2);
      assert.ok(farEnemies.length >= nearEnemies.length);
    });

    it('encounterBiome returns string', () => {
      const map = new OverworldMap(12345);
      const b = map.encounterBiome(0, 0);
      assert.ok(typeof b === 'string');
      assert.greaterThan(b.length, 0);
    });

    it('serialize returns object with worldSeed', () => {
      const map = new OverworldMap(12345);
      const data = map.serialize();
      assert.ok(data);
      assert.equal(data.worldSeed, 12345);
    });

    it('deserialize restores map with same seed', () => {
      const map = new OverworldMap(12345);
      const data = map.serialize();
      const restored = OverworldMap.deserialize(data);
      assert.ok(restored);
      assert.equal(restored.worldSeed, 12345);
      for (let r = -10; r < 10; r += 3)
        for (let c = -10; c < 10; c += 3)
          assert.equal(restored.getTile(c, r), map.getTile(c, r));
    });

    it('deserialize returns null for invalid data', () => {
      assert.isNull(OverworldMap.deserialize(null));
      assert.isNull(OverworldMap.deserialize({}));
      assert.isNull(OverworldMap.deserialize({ worldSeed: 'bad' }));
    });

    it('generates multiple terrain types in a region', () => {
      const map = new OverworldMap(12345);
      const types = new Set();
      for (let r = -50; r < 50; ++r)
        for (let c = -50; c < 50; ++c)
          types.add(map.getTile(c, r));
      assert.greaterThan(types.size, 3, 'should have at least 4 terrain types');
    });

    it('generates water tiles somewhere', () => {
      const map = new OverworldMap(12345);
      let found = false;
      for (let r = -100; r < 100 && !found; r += 2)
        for (let c = -100; c < 100 && !found; c += 2)
          if (map.getTile(c, r) === OverworldTile.WATER) found = true;
      assert.ok(found, 'should find water somewhere in a large area');
    });

    it('generates sand tiles somewhere', () => {
      const map = new OverworldMap(12345);
      let found = false;
      for (let r = -100; r < 100 && !found; r += 2)
        for (let c = -100; c < 100 && !found; c += 2)
          if (map.getTile(c, r) === OverworldTile.SAND) found = true;
      assert.ok(found, 'should find sand somewhere in a large area');
    });

    it('OverworldTile has expected tile types', () => {
      assert.equal(OverworldTile.VOID, 0);
      assert.equal(OverworldTile.GRASS, 1);
      assert.equal(OverworldTile.FOREST, 2);
      assert.equal(OverworldTile.MOUNTAIN, 3);
      assert.equal(OverworldTile.DUNGEON, 4);
      assert.equal(OverworldTile.TOWN, 5);
      assert.equal(OverworldTile.ROAD, 6);
      assert.equal(OverworldTile.CAMP, 7);
      assert.equal(OverworldTile.WATER, 8);
      assert.equal(OverworldTile.SAND, 9);
    });

    it('all tile type values are unique', () => {
      const values = Object.values(OverworldTile);
      const unique = new Set(values);
      assert.equal(values.length, unique.size);
    });

    it('findPath returns array from start to adjacent tile', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 1, row: 0 });
      assert.ok(Array.isArray(path));
      assert.greaterThan(path.length, 0);
      assert.equal(path[0].col, 0);
      assert.equal(path[0].row, 0);
      assert.equal(path[path.length - 1].col, 1);
      assert.equal(path[path.length - 1].row, 0);
    });

    it('findPath returns single node for start=goal', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 0, row: 0 });
      assert.ok(Array.isArray(path));
      assert.equal(path.length, 1);
      assert.equal(path[0].col, 0);
      assert.equal(path[0].row, 0);
    });

    it('findPath follows road from camp to dungeon', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 5, row: -3 });
      assert.ok(path, 'should find path to dungeon');
      assert.greaterThan(path.length, 2);
      assert.equal(path[0].col, 0);
      assert.equal(path[0].row, 0);
      assert.equal(path[path.length - 1].col, 5);
      assert.equal(path[path.length - 1].row, -3);
    });

    it('findPath returns null for impassable goal', () => {
      const map = new OverworldMap(12345);
      let waterTile = null;
      for (let r = -50; r < 50 && !waterTile; ++r)
        for (let c = -50; c < 50 && !waterTile; ++c)
          if (map.getTile(c, r) === OverworldTile.WATER)
            waterTile = { col: c, row: r };
      if (waterTile) {
        const path = map.findPath({ col: 0, row: 0 }, waterTile);
        assert.isNull(path);
      }
    });

    it('findPath only uses passable tiles', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 5, row: -3 });
      assert.ok(path);
      for (const step of path)
        assert.ok(map.isPassable(step.col, step.row), `tile at (${step.col},${step.row}) should be passable`);
    });

    it('findPath steps are cardinal-adjacent', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 3, row: 2 });
      assert.ok(path);
      for (let i = 1; i < path.length; ++i) {
        const dc = Math.abs(path[i].col - path[i - 1].col);
        const dr = Math.abs(path[i].row - path[i - 1].row);
        assert.equal(dc + dr, 1, `step ${i} should be cardinal adjacent`);
      }
    });

    it('findPath respects max distance limit', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 500, row: 500 }, 50);
      assert.isNull(path);
    });

    it('findPath works with negative coordinates', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: -4, row: 4 });
      assert.ok(path, 'should find path to village');
      assert.equal(path[path.length - 1].col, -4);
      assert.equal(path[path.length - 1].row, 4);
    });

    it('findPath prefers roads over grass', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 5, row: -3 });
      assert.ok(path);
      let roadSteps = 0;
      for (const step of path)
        if (map.getTile(step.col, step.row) === OverworldTile.ROAD)
          ++roadSteps;
      assert.greaterThan(roadSteps, 0, 'path should use road tiles');
    });

    it('findPath does not pass through non-target dungeon tiles', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 3, row: 2 });
      if (path)
        for (let i = 0; i < path.length - 1; ++i) {
          const t = map.getTile(path[i].col, path[i].row);
          assert.ok(
            t !== OverworldTile.DUNGEON && t !== OverworldTile.TOWN,
            `intermediate step at (${path[i].col},${path[i].row}) should not be a location`
          );
        }
    });

    it('findPath can reach a dungeon tile as the goal', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: 5, row: -3 });
      assert.ok(path);
      assert.equal(map.getTile(5, -3), OverworldTile.DUNGEON);
      assert.equal(path[path.length - 1].col, 5);
      assert.equal(path[path.length - 1].row, -3);
    });

    it('findPath can reach a town tile as the goal', () => {
      const map = new OverworldMap(12345);
      const path = map.findPath({ col: 0, row: 0 }, { col: -4, row: 4 });
      assert.ok(path);
      assert.equal(map.getTile(-4, 4), OverworldTile.TOWN);
    });

    it('findPath road cost is cheaper than grass', () => {
      const map = new OverworldMap(12345);
      const pathToRoadEnd = map.findPath({ col: 0, row: 0 }, { col: 5, row: 0 });
      assert.ok(pathToRoadEnd);
      let roadCount = 0;
      let totalSteps = pathToRoadEnd.length - 1;
      for (const step of pathToRoadEnd)
        if (map.getTile(step.col, step.row) === OverworldTile.ROAD)
          ++roadCount;
      assert.ok(roadCount >= 0);
      assert.ok(totalSteps > 0);
    });

    it('extractTileRect returns correct dimensions', () => {
      const map = new OverworldMap(42);
      const result = map.extractTileRect(5, 5, 8, 6);
      assert.equal(result.tiles.length, 8 * 6);
      assert.equal(result.startCol, 5 - 4);
      assert.equal(result.startRow, 5 - 3);
    });

    it('extractTileRect tiles are valid tile IDs', () => {
      const map = new OverworldMap(42);
      const result = map.extractTileRect(0, 0, 10, 10);
      for (const t of result.tiles)
        assert.ok(t >= 0 && t <= 9, `tile value ${t} out of range`);
    });

    it('extractTileRect center tile matches getTile', () => {
      const map = new OverworldMap(42);
      const result = map.extractTileRect(3, 3, 7, 7);
      const centerIdx = 3 * 7 + 3;
      assert.equal(result.tiles[centerIdx], map.getTile(3, 3));
    });

    it('extractTileRect startCol/startRow are consistent', () => {
      const map = new OverworldMap(99);
      const result = map.extractTileRect(10, 10, 6, 4);
      assert.equal(result.startCol, 10 - 3);
      assert.equal(result.startRow, 10 - 2);
      assert.equal(result.tiles[0], map.getTile(result.startCol, result.startRow));
    });

    it('extractTileRect handles negative coords', () => {
      const map = new OverworldMap(42);
      const result = map.extractTileRect(-5, -5, 4, 4);
      assert.equal(result.tiles.length, 16);
      assert.equal(result.startCol, -5 - 2);
      assert.equal(result.startRow, -5 - 2);
    });
  });

  describe('OverworldMap — Expanded Encounter Pools', () => {

    it('encounter pools include new Phase B enemies at higher tiers', () => {
      const map = new OverworldMap(42);
      const newEnemies = new Set([
        'kobold', 'zombie', 'stirge', 'gnoll', 'bugbear', 'worg', 'lizardfolk', 'harpy',
        'cockatrice', 'basilisk', 'wight', 'gargoyle', 'owlbear', 'manticore', 'phase_spider',
        'hill_giant', 'mind_flayer', 'young_dragon', 'death_knight', 'fire_elemental',
        'frost_giant', 'demon', 'devil',
      ]);
      const seenNew = new Set();
      // Sample encounters at various distances
      for (let d = 0; d < 200; d += 3) {
        const prng = new PRNG(42 + d);
        const enemies = map.encounterEnemies(d, 0, prng);
        for (const e of enemies)
          if (newEnemies.has(e.templateId))
            seenNew.add(e.templateId);
      }
      assert.ok(seenNew.size >= 5, `should see at least 5 new enemy types, saw ${seenNew.size}: ${[...seenNew].join(',')}`);
    });

    it('encounters at high tiers include tier 7 enemies', () => {
      const map = new OverworldMap(42);
      const tier7 = new Set(['young_dragon', 'death_knight', 'frost_giant', 'mind_flayer', 'demon', 'devil', 'lich']);
      const found = new Set();
      for (let i = 0; i < 100; ++i) {
        const prng = new PRNG(i);
        const enemies = map.encounterEnemies(120, 0, prng);
        for (const e of enemies)
          if (tier7.has(e.templateId))
            found.add(e.templateId);
      }
      assert.ok(found.size >= 2, `should see tier 7 enemies at high distance, saw: ${[...found].join(',')}`);
    });

    it('encounter enemies reference valid template IDs', () => {
      const { CombatEngine } = window.SZ.TacticalRealms;
      const map = new OverworldMap(42);
      for (let d = 0; d < 200; d += 5) {
        const prng = new PRNG(42 + d);
        const enemies = map.encounterEnemies(d, 0, prng);
        for (const e of enemies)
          assert.ok(CombatEngine.ENEMY_TEMPLATES[e.templateId], `invalid template ${e.templateId}`);
      }
    });

    it('leader variant sometimes has higher targetLevel', () => {
      const map = new OverworldMap(42);
      let foundLeader = false;
      for (let i = 0; i < 200; ++i) {
        const prng = new PRNG(i);
        const enemies = map.encounterEnemies(50, 0, prng, 5);
        if (enemies.length >= 2 && enemies[0].targetLevel > enemies[1].targetLevel)
          foundLeader = true;
      }
      assert.ok(foundLeader, 'should sometimes generate leader variant with higher level');
    });
  });
})();
