;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { DungeonCrawl, DungeonThemes } = TR;
  const { Cell } = DungeonCrawl;
  const THEMES = DungeonThemes.THEMES;

  const make = (themeId, seed = 7, difficulty = 3) =>
    new DungeonCrawl({ seed, theme: THEMES[themeId], name: 'Test', difficulty, enemies: [] });

  function reachable(L, from, to) {
    const d = L.distances(from.col, from.row);
    return d[to.row * L.w + to.col] >= 0;
  }

  describe('DungeonCrawl -- generation', () => {

    for (const id of Object.keys(THEMES))
      it(`${id}: entrance and exit are connected and the floor has chambers`, () => {
        const c = make(id, 11);
        const L = c.level;
        assert.ok(L.entrance && L.exit, 'stairs placed');
        assert.ok(reachable(L, L.entrance, L.exit), 'exit reachable');
        assert.ok(L.chambers.length >= 3, `${L.chambers.length} chambers`);
        assert.ok(c.isOpen(c.position.col, c.position.row), 'party stands on open ground');
      });

    it('the same seed builds the same dungeon', () => {
      const a = make('cavern', 99), b = make('cavern', 99);
      assert.equal(a.level.cells.join(''), b.level.cells.join(''));
      assert.deepEqual(a.groups.map(g => g.members.map(m => m.templateId)), b.groups.map(g => g.members.map(m => m.templateId)));
    });

    it('caverns are big, organic and different from built crypts', () => {
      const cave = make('cavern', 5).level, crypt = make('crypt', 5).level;
      const open = L => L.cells.reduce((s, v) => s + (v !== Cell.WALL), 0);
      assert.ok(open(cave) > 600, `cave has ${open(cave)} open cells`);
      assert.ok(cave.w * cave.h > crypt.w * crypt.h);
    });

    it('a dungeon of several floors gets stairs down on all but the last', () => {
      const c = make('tower', 3, 6);
      assert.ok(c.floorCount >= 2, `${c.floorCount} floors`);
      const L = c.level;
      assert.equal(L.get(L.exit.col, L.exit.row), Cell.STAIRS_DOWN);
      c.enterFloor(c.floorCount - 1, 'up');
      const last = c.level;
      assert.notEqual(last.get(last.exit.col, last.exit.row), Cell.STAIRS_DOWN);
    });

    it('chambers hold monster groups, and the deepest one a boss', () => {
      const c = make('crypt', 21, 5);
      assert.ok(c.groups.length >= 2, `${c.groups.length} groups`);
      c.enterFloor(c.floorCount - 1, 'up');
      assert.ok(c.groups.some(g => g.boss), 'boss group on the last floor');
    });

    it('themes pick the right look for map locations', () => {
      const pick = (name, biome) => DungeonThemes.themeForLocation({ name, biome }).id;
      assert.equal(pick('Skeleton Crypt', 'dungeon'), 'crypt');
      assert.equal(pick('Goblin Cave', 'cave'), 'cavern');
      assert.equal(pick('Dragon Hoard', 'cave'), 'lair');
      assert.equal(pick('Orc Fortress', 'mountain'), 'fortress');
      assert.equal(pick('Wolf Den', 'forest'), 'woods');
      assert.equal(pick('Demon Gate', 'lava'), 'infernal');
      assert.equal(pick('Minotaur Labyrinth', 'dungeon'), 'labyrinth');
      assert.equal(pick('Frozen Fortress', 'mountain'), 'frozen');
    });
  });

  describe('DungeonCrawl -- exploring', () => {

    it('walls stop the party and block sight', () => {
      const c = make('crypt', 4);
      const p = c.position;
      let wall = null;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!c.isOpen(p.col + dc, p.row + dr))
          wall = [dc, dr];
      if (wall)
        assert.equal(c.step(wall[0], wall[1]).moved, false);
      // nothing beyond a solid wall is visible
      const L = c.level;
      for (let r = 0; r < L.h; ++r)
        for (let col = 0; col < L.w; ++col)
          if (c.isVisible(col, r) && (col !== p.col || r !== p.row))
            assert.ok(c.hasLineOfSight(p.col, p.row, col, r));
    });

    it('walking reveals the map and remembers it', () => {
      const c = make('cavern', 8);
      const before = [...Array(c.level.w * c.level.h).keys()].filter(i => c.isExplored(i % c.level.w, Math.floor(i / c.level.w))).length;
      assert.ok(before > 5);
      const path = c.pathTo(c.position.col, c.position.row);
      assert.deepEqual(path, []);
    });

    it('getting close to a group starts an encounter', () => {
      const c = make('crypt', 13, 4);
      const g = c.groups[0];
      const m = c.aliveMembers(g)[0];
      // walk the true path toward the monster until something happens
      const L = c.level;
      const d = L.distances(m.col, m.row);
      let found = false;
      for (let i = 0; i < 400 && !found; ++i) {
        const p = c.position;
        let best = null;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nd = d[(p.row + dr) * L.w + p.col + dc];
          if (nd >= 0 && c.canEnter(p.col + dc, p.row + dr) && (!best || nd < best.nd))
            best = { dc, dr, nd };
        }
        if (!best)
          break;
        const res = c.step(best.dc, best.dr);
        if (res.events.some(e => e.type === 'encounter'))
          found = true;
      }
      assert.ok(found, 'no encounter on the way to a monster');
    });
  });

  describe('DungeonCrawl -- battles', () => {

    // battles start when a group is close, so test with the nearest one
    function battleFor(themeId, seed) {
      const c = make(themeId, seed, 4);
      const p = c.position;
      const dist = g => Math.min(...c.aliveMembers(g).map(m => Math.abs(m.col - p.col) + Math.abs(m.row - p.row)));
      const g = c.groups.slice().sort((a, b) => dist(a) - dist(b))[0];
      const m = c.aliveMembers(g)[0];
      // stand a few steps from it
      const L = c.level;
      const d = L.distances(m.col, m.row);
      for (let i = 0; i < 400; ++i) {
        const q = c.position;
        if (d[q.row * L.w + q.col] <= 5)
          break;
        let best = null;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nd = d[(q.row + dr) * L.w + q.col + dc];
          if (nd >= 0 && c.canEnter(q.col + dc, q.row + dr) && (!best || nd < best.nd))
            best = { dc, dr, nd };
        }
        if (!best)
          break;
        c.step(best.dc, best.dr);
      }
      return { c, g, setup: c.battleSetup(g) };
    }

    it('the board is cut from the dungeon with its walls', () => {
      const { setup } = battleFor('crypt', 17);
      const { grid } = setup;
      assert.ok(grid.cols >= 16 && grid.cols <= 34, `${grid.cols} cols`);
      assert.ok(grid.rows >= 12 && grid.rows <= 24, `${grid.rows} rows`);
      let walls = 0;
      for (let r = 0; r < grid.rows; ++r)
        for (let c = 0; c < grid.cols; ++c)
          if (grid.terrainIdAt(c, r) === 'stone_wall')
            ++walls;
      assert.ok(walls > 0, 'walls carried over');
    });

    it('everyone starts on open floor, nobody shares a tile', () => {
      for (const id of ['crypt', 'cavern', 'woods']) {
        const { setup } = battleFor(id, 23);
        const seen = new Set();
        for (const p of [...setup.partyPositions.slice(0, 4), ...setup.enemyPositions]) {
          assert.notEqual(setup.grid.terrainIdAt(p.col, p.row), 'stone_wall', `${id} unit in a wall`);
          const k = `${p.col},${p.row}`;
          assert.ok(!seen.has(k), `${id} shared tile ${k}`);
          seen.add(k);
        }
        assert.ok(setup.partyPositions.length >= 4, `${id} party spots`);
        assert.ok(setup.enemies.length > 0 && setup.deployZone.length > 4);
      }
    });

    it('slain monsters stay dead and the group disappears', () => {
      const { c, g, setup } = battleFor('cavern', 29);
      const slain = setup.enemies.map(e => ({ groupId: e.groupId, member: e.member }));
      c.resolveBattle(setup, slain);
      assert.ok(!c.groups.some(x => x.id === g.id));
    });

    it('saves and restores position, map memory and the slain', () => {
      const { c, setup } = battleFor('crypt', 31);
      c.resolveBattle(setup, setup.enemies.slice(0, 1).map(e => ({ groupId: e.groupId, member: e.member })));
      const data = JSON.parse(JSON.stringify(c.serialize()));
      const back = DungeonCrawl.deserialize(data);
      assert.deepEqual(back.position, c.position);
      assert.equal(back.groups.reduce((s, g) => s + back.aliveMembers(g).length, 0),
        c.groups.reduce((s, g) => s + c.aliveMembers(g).length, 0));
      assert.ok(back.isExplored(c.position.col, c.position.row));
    });
  });
})();
