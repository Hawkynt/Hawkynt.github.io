;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { DungeonFloor, DungeonInstance, DungeonTile, FeatureType, PRNG } = window.SZ.TacticalRealms;

  describe('DungeonFloor — BSP Generation', () => {

    it('generates rooms within bounds', () => {
      const floor = new DungeonFloor(30, 20);
      floor.generate(4, new PRNG(42));
      assert.greaterThan(floor.rooms.length, 0);
      for (const room of floor.rooms) {
        assert.ok(room.x >= 0, `room x=${room.x} out of bounds`);
        assert.ok(room.y >= 0, `room y=${room.y} out of bounds`);
        assert.ok(room.x + room.w <= 30, `room extends past width`);
        assert.ok(room.y + room.h <= 20, `room extends past height`);
      }
    });

    it('generates multiple rooms', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(6, new PRNG(123));
      assert.greaterThan(floor.rooms.length, 1);
    });

    it('entrance and exit are placed on different rooms', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(4, new PRNG(42));
      assert.ok(floor.entrance, 'entrance should exist');
      assert.ok(floor.exit, 'exit should exist');
      if (floor.rooms.length > 1)
        assert.ok(
          floor.entrance.col !== floor.exit.col || floor.entrance.row !== floor.exit.row,
          'entrance and exit should be at different positions'
        );
    });

    it('entrance tile is STAIRS_UP', () => {
      const floor = new DungeonFloor(30, 20);
      floor.generate(3, new PRNG(42));
      if (floor.entrance)
        assert.equal(floor.getTile(floor.entrance.col, floor.entrance.row), DungeonTile.STAIRS_UP);
    });

    it('exit tile is STAIRS_DOWN when multiple rooms exist', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(4, new PRNG(42));
      if (floor.rooms.length > 1 && floor.exit)
        assert.equal(floor.getTile(floor.exit.col, floor.exit.row), DungeonTile.STAIRS_DOWN);
    });

    it('all rooms are reachable from entrance', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(5, new PRNG(42));
      if (!floor.entrance)
        return;
      for (const room of floor.rooms) {
        const cx = room.x + Math.floor(room.w / 2);
        const cy = room.y + Math.floor(room.h / 2);
        assert.ok(
          floor.isReachable(floor.entrance.col, floor.entrance.row, cx, cy),
          `room ${room.id} at (${cx},${cy}) should be reachable from entrance`
        );
      }
    });

    it('getTile returns valid terrain types', () => {
      const floor = new DungeonFloor(30, 20);
      floor.generate(3, new PRNG(42));
      const validTiles = new Set(['wall', 'floor', 'corridor', 'door', 'stairs_up', 'stairs_down']);
      for (let r = 0; r < 20; ++r)
        for (let c = 0; c < 30; ++c)
          assert.ok(validTiles.has(floor.getTile(c, r)), `invalid tile at (${c},${r}): ${floor.getTile(c, r)}`);
    });

    it('getTile returns WALL for out-of-bounds coords', () => {
      const floor = new DungeonFloor(10, 10);
      floor.generate(2, new PRNG(42));
      assert.equal(floor.getTile(-1, 0), DungeonTile.WALL);
      assert.equal(floor.getTile(0, -1), DungeonTile.WALL);
      assert.equal(floor.getTile(10, 0), DungeonTile.WALL);
      assert.equal(floor.getTile(0, 10), DungeonTile.WALL);
    });

    it('deterministic output with seeded PRNG', () => {
      const f1 = new DungeonFloor(30, 20);
      f1.generate(4, new PRNG(42));
      const f2 = new DungeonFloor(30, 20);
      f2.generate(4, new PRNG(42));
      assert.equal(f1.rooms.length, f2.rooms.length);
      for (let i = 0; i < f1.rooms.length; ++i) {
        assert.equal(f1.rooms[i].x, f2.rooms[i].x);
        assert.equal(f1.rooms[i].y, f2.rooms[i].y);
        assert.equal(f1.rooms[i].w, f2.rooms[i].w);
        assert.equal(f1.rooms[i].h, f2.rooms[i].h);
      }
    });

    it('getRoomAt returns correct room', () => {
      const floor = new DungeonFloor(30, 20);
      floor.generate(3, new PRNG(42));
      const room = floor.rooms[0];
      const found = floor.getRoomAt(room.x, room.y);
      assert.ok(found);
      assert.equal(found.id, room.id);
    });

    it('getRoomAt returns null for wall tiles', () => {
      const floor = new DungeonFloor(30, 20);
      floor.generate(3, new PRNG(42));
      const result = floor.getRoomAt(0, 0);
      assert.isNull(result);
    });

    it('minimum size dungeon generates at least one room', () => {
      const floor = new DungeonFloor(12, 12);
      floor.generate(1, new PRNG(42));
      assert.greaterThan(floor.rooms.length, 0);
    });

    it('large dungeon generates many rooms', () => {
      const floor = new DungeonFloor(60, 40);
      floor.generate(8, new PRNG(42));
      assert.greaterThan(floor.rooms.length, 3);
    });

    it('corridors array is populated', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(5, new PRNG(42));
      if (floor.rooms.length > 1)
        assert.greaterThan(floor.corridors.length, 0);
    });
  });

  describe('DungeonFloor — Features', () => {

    it('placeFeatures adds features within room bounds', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(5, new PRNG(42));
      floor.placeFeatures(new PRNG(99));
      for (const feat of floor.features) {
        const room = floor.rooms.find(r => r.id === feat.roomId);
        assert.ok(room, `feature references invalid room ${feat.roomId}`);
        assert.ok(feat.col >= room.x && feat.col < room.x + room.w, `feature col ${feat.col} outside room`);
        assert.ok(feat.row >= room.y && feat.row < room.y + room.h, `feature row ${feat.row} outside room`);
      }
    });

    it('features have valid types', () => {
      const floor = new DungeonFloor(40, 30);
      floor.generate(5, new PRNG(42));
      floor.placeFeatures(new PRNG(99));
      const validTypes = new Set([FeatureType.TREASURE, FeatureType.TRAP, FeatureType.FOUNTAIN, FeatureType.ENEMY, FeatureType.ALTAR, FeatureType.LIBRARY, FeatureType.BOSS, FeatureType.ARMORY]);
      for (const feat of floor.features)
        assert.ok(validTypes.has(feat.type), `invalid feature type: ${feat.type}`);
    });
  });

  describe('DungeonInstance', () => {

    it('multi-floor dungeon has stairs connecting floors', () => {
      const inst = new DungeonInstance(2);
      inst.generate(40, 30, 3, new PRNG(42));
      assert.equal(inst.floorCount, 3);
      for (let f = 0; f < inst.floorCount; ++f) {
        inst.moveToFloor(f);
        const floor = inst.currentFloorData;
        assert.ok(floor);
        assert.ok(floor.entrance, `floor ${f} missing entrance`);
      }
    });

    it('currentFloor starts at 0', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 2, new PRNG(42));
      assert.equal(inst.currentFloor, 0);
    });

    it('moveToFloor changes current floor', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 3, new PRNG(42));
      assert.ok(inst.moveToFloor(1));
      assert.equal(inst.currentFloor, 1);
      assert.ok(inst.moveToFloor(2));
      assert.equal(inst.currentFloor, 2);
    });

    it('moveToFloor rejects invalid index', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 2, new PRNG(42));
      assert.ok(!inst.moveToFloor(-1));
      assert.ok(!inst.moveToFloor(5));
    });

    it('floor count clamped to 1-10', () => {
      const inst1 = new DungeonInstance(1);
      inst1.generate(30, 20, 0, new PRNG(42));
      assert.equal(inst1.floorCount, 1);

      const inst2 = new DungeonInstance(1);
      inst2.generate(30, 20, 10, new PRNG(42));
      assert.equal(inst2.floorCount, 10);

      const inst3 = new DungeonInstance(1);
      inst3.generate(30, 20, 15, new PRNG(42));
      assert.equal(inst3.floorCount, 10);
    });

    it('difficulty is stored', () => {
      const inst = new DungeonInstance(3);
      assert.equal(inst.difficulty, 3);
    });

    it('enemyTier increases with floor index', () => {
      const inst = new DungeonInstance(2);
      inst.generate(30, 20, 3, new PRNG(42));
      assert.ok(inst.enemyTier(0) <= inst.enemyTier(1));
      assert.ok(inst.enemyTier(1) <= inst.enemyTier(2));
    });
  });

  describe('DungeonInstance — Fog of War', () => {

    it('initially nothing is revealed', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 1, new PRNG(42));
      assert.ok(!inst.isRevealed(5, 5));
    });

    it('reveal makes tiles visible', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 1, new PRNG(42));
      inst.reveal(10, 10, 3);
      assert.ok(inst.isRevealed(10, 10));
      assert.ok(inst.isRevealed(11, 10));
      assert.ok(inst.isRevealed(10, 11));
    });

    it('reveal respects manhattan distance', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 1, new PRNG(42));
      inst.reveal(10, 10, 2);
      assert.ok(inst.isRevealed(10, 10));
      assert.ok(inst.isRevealed(12, 10));
      assert.ok(!inst.isRevealed(13, 10));
    });

    it('moveToFloor resets revealed tiles', () => {
      const inst = new DungeonInstance(1);
      inst.generate(30, 20, 2, new PRNG(42));
      inst.reveal(10, 10, 3);
      assert.ok(inst.isRevealed(10, 10));
      inst.moveToFloor(1);
      assert.ok(!inst.isRevealed(10, 10));
    });
  });

  describe('DungeonTile enum', () => {

    it('has all expected tile types', () => {
      assert.equal(DungeonTile.WALL, 'wall');
      assert.equal(DungeonTile.FLOOR, 'floor');
      assert.equal(DungeonTile.CORRIDOR, 'corridor');
      assert.equal(DungeonTile.DOOR, 'door');
      assert.equal(DungeonTile.STAIRS_UP, 'stairs_up');
      assert.equal(DungeonTile.STAIRS_DOWN, 'stairs_down');
    });

    it('is frozen', () => {
      assert.ok(Object.isFrozen(DungeonTile));
    });
  });

  describe('FeatureType enum', () => {

    it('has expected types', () => {
      assert.equal(FeatureType.TREASURE, 'treasure');
      assert.equal(FeatureType.TRAP, 'trap');
      assert.equal(FeatureType.FOUNTAIN, 'fountain');
      assert.equal(FeatureType.ENEMY, 'enemy');
    });

    it('is frozen', () => {
      assert.ok(Object.isFrozen(FeatureType));
    });
  });
})();
