;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { OverworldMap, OverworldTile: Tile, OverworldTileInfo, PlaneWorlds, PlaneRegistry } = TR;

  const others = () => PlaneRegistry.getAll().filter(p => p.id !== 'material');

  describe('PlaneWorlds -- profiles', () => {

    it('every plane but the Material has a world profile', () => {
      for (const p of others()) {
        const w = PlaneWorlds.get(p.id);
        assert.ok(w, `${p.id} has no profile`);
        assert.equal(typeof w.terrain, 'function', `${p.id} has no terrain`);
        assert.ok(Tile[w.base] !== undefined, `${p.id} base ${w.base}`);
        assert.ok(TR.TerrainArt.has(w.road), `${p.id} road ${w.road}`);
        assert.ok(w.gate, `${p.id} has no gate`);
        assert.ok(w.sites.length >= 2, `${p.id} has ${w.sites.length} sites`);
      }
    });

    it('terrain only names tiles that exist', () => {
      for (const p of others()) {
        const w = PlaneWorlds.get(p.id);
        for (let h = 0; h <= 1; h += 0.05)
          for (let m = 0; m <= 1; m += 0.1)
            for (let v = 0; v <= 1; v += 0.1) {
              const name = w.terrain(h, m, v, 3, 5);
              assert.ok(Tile[name] !== undefined, `${p.id}: ${name}`);
            }
      }
    });

    it('sites use dungeon themes that exist', () => {
      for (const p of others())
        for (const s of PlaneWorlds.get(p.id).sites)
          assert.ok(TR.DungeonThemes.THEMES[s.theme], `${p.id}: ${s.name} has theme ${s.theme}`);
    });

    it('the planes are more dangerous than home, the outer planes most', () => {
      assert.equal(PlaneWorlds.get('material').levelBonus, 0);
      assert.ok(PlaneWorlds.get('astral').levelBonus > 0);
      assert.ok(PlaneWorlds.get('abyss').levelBonus > PlaneWorlds.get('astral').levelBonus);
    });
  });

  describe('PlaneWorlds -- tiles', () => {

    it('every planar tile has travel rules, painted ground and a battle backdrop', () => {
      for (let t = Tile.ASTRAL; t <= Tile.RIFT; ++t) {
        const info = OverworldTileInfo[t];
        assert.ok(info, `tile ${t} has no info`);
        assert.ok(TR.BattleBackdrop.THEMES[info.battle], `tile ${t} battle ${info.battle}`);
        assert.ok(TR.TerrainArt.has(TR.OverworldGround[t]), `tile ${t} ground ${TR.OverworldGround[t]}`);
        assert.ok(TR.BiomeRegistry.has(info.biome), `tile ${t} biome ${info.biome}`);
      }
    });

    it('battles on planar tiles stand on known terrain', () => {
      const tiles = [];
      for (let t = Tile.PORTAL; t <= Tile.RIFT; ++t)
        tiles.push(t);
      const grid = TR.CombatGrid.fromOverworldTiles(tiles, tiles.length, 1);
      for (let c = 0; c < tiles.length; ++c)
        assert.ok(TR.Terrain.byId(grid.terrainIdAt(c, 0)), `tile ${tiles[c]} -> ${grid.terrainIdAt(c, 0)}`);
    });

    it('every planar battle biome has a palette and a backdrop', () => {
      for (const t of Object.values(OverworldTileInfo))
        assert.ok(TR.BattleBackdrop.THEMES[t.battle], t.battle);
    });
  });

  describe('PlaneWorlds -- overworlds', () => {

    it('the Material Plane is the default world', () => {
      const a = new OverworldMap(1234), b = new OverworldMap(1234, 'material');
      for (let r = -20; r < 20; r += 3)
        for (let c = -20; c < 20; c += 3)
          assert.equal(a.getTile(c, r), b.getTile(c, r));
      assert.equal(a.plane, 'material');
    });

    it('each plane grows its own land from the world seed', () => {
      const count = (map, tile) => {
        let n = 0;
        for (let r = -30; r < 30; ++r)
          for (let c = -30; c < 30; ++c)
            if (map.regionTile(c, r) === tile)
              ++n;
        return n;
      };
      assert.ok(count(new OverworldMap(77, 'astral'), Tile.ASTRAL) > 1000);
      assert.ok(count(new OverworldMap(77, 'nine_hells'), Tile.BRIMSTONE) > 600);
      assert.ok(count(new OverworldMap(77, 'mechanus'), Tile.GEARS) > 600);
      assert.equal(count(new OverworldMap(77, 'material'), Tile.ASTRAL), 0);
      const a = new OverworldMap(77, 'abyss'), b = new OverworldMap(77, 'abyss');
      for (let r = -10; r < 10; ++r)
        assert.equal(a.getTile(r * 3, r), b.getTile(r * 3, r));
    });

    it('the party arrives at a gate home, and every place around it is reachable', () => {
      for (const p of others())
        for (const seed of [5, 91]) {
          const map = new OverworldMap(seed, p.id);
          const gate = map.getLocation(0, 0);
          assert.ok(gate && gate.tile === Tile.PORTAL && gate.returnGate, `${p.id} has no gate at home`);
          for (const [c, r] of [[5, -3], [-4, 4], [8, 5], [-6, -5]]) {
            const loc = map.getLocation(c, r);
            assert.ok(loc, `${p.id}: nothing at ${c},${r}`);
            const path = map.findPath({ col: 0, row: 0 }, { col: c, row: r }, 120);
            assert.ok(path && path.length > 1, `${p.id} (${seed}): ${loc.name} cut off`);
          }
        }
    });

    it('planar sites lead into their own kind of dungeon', () => {
      const map = new OverworldMap(42, 'abyss');
      const loc = map.getLocation(5, -3);
      assert.equal(loc.tile, Tile.DUNGEON);
      assert.equal(TR.DungeonThemes.themeForLocation(loc).id, 'abyssal');
      assert.ok(loc.difficulty >= 6, `difficulty ${loc.difficulty}`);
    });

    it('the planar dungeon themes only field monsters the game knows', () => {
      for (const id of ['astral', 'ethereal', 'shadowkeep', 'drowned', 'geode', 'skyhold', 'celestial', 'fey_glade', 'chaos', 'abyssal', 'clockwork']) {
        const T = TR.DungeonThemes.THEMES[id];
        assert.ok(T, id);
        for (const pool of T.pools)
          for (const m of pool)
            assert.ok(TR.MonsterRoster.crOf(m) != null, `${id}: ${m}`);
        assert.ok(TR.TerrainArt.has(T.floorArt) && TR.TerrainArt.has(T.wallArt), `${id} art`);
      }
    });

    it('a map remembers its plane', () => {
      const map = new OverworldMap(9, 'limbo');
      const back = OverworldMap.deserialize(JSON.parse(JSON.stringify(map.serialize())));
      assert.equal(back.plane, 'limbo');
      assert.equal(back.getTile(12, 7), map.getTile(12, 7));
    });
  });
  describe('PlaneWorlds -- inhabitants', () => {

    it('every plane is home to creatures the game can field', () => {
      for (const p of others()) {
        const natives = PlaneWorlds.natives(p.id);
        assert.equal(natives.length, (p.inhabitants || []).length, `${p.id}: ${p.inhabitants.filter(i => !natives.includes(i)).join(', ')}`);
        assert.ok(natives.length >= 3, `${p.id} has ${natives.length} natives`);
      }
    });

    it('the celestial and chaotic hosts have joined the roster', () => {
      for (const id of ['lantern_archon', 'hound_archon', 'astral_deva', 'planetar', 'solar', 'bralani_eladrin', 'ghaele_eladrin', 'avoral_guardinal', 'leonal_guardinal', 'red_slaad', 'death_slaad', 'formian_warrior', 'formian_myrmarch', 'hell_hound', 'triton', 'xill', 'arrowhawk_adult', 'magmin', 'nightwalker'])
        assert.ok(TR.MonsterRoster.crOf(id) != null, id);
    });

    it('fights on a plane are mostly with its natives', () => {
      const map = new OverworldMap(3, 'nine_hells');
      const natives = new Set(PlaneWorlds.natives('nine_hells'));
      const prng = new TR.PRNG(17);
      let native = 0, total = 0;
      for (let i = 0; i < 60; ++i)
        for (const e of map.encounterEnemies(9, 9, prng, 6)) {
          ++total;
          if (natives.has(e.templateId) || /devil|imp|lemure|hell/.test(e.templateId))
            ++native;
        }
      assert.ok(native / total > 0.6, `${native} of ${total}`);
    });

    it('the planes fight harder than home, the outer planes hardest', () => {
      const level = (plane, seed) => {
        const map = new OverworldMap(seed, plane);
        const prng = new TR.PRNG(seed);
        let sum = 0;
        for (let i = 0; i < 40; ++i)
          sum += TR.MonsterRoster.encounterLevel(map.encounterEnemies(6, 6, prng, 5).map(e => e.templateId));
        return sum / 40;
      };
      const home = level('material', 5), astral = level('astral', 5), hells = level('nine_hells', 5);
      assert.ok(astral > home, `astral ${astral.toFixed(1)} vs home ${home.toFixed(1)}`);
      assert.ok(hells > home + 1, `hells ${hells.toFixed(1)} vs home ${home.toFixed(1)}`);
    });
  });
})();
