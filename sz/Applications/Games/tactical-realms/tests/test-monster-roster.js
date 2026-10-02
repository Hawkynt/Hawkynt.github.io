;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { MonsterRoster: R, PRNG } = TR;
  const spawnable = id => !!(TR.CreatureRegistry.getMonster(id) || TR.CombatEngine.ENEMY_TEMPLATES[id]);

  describe('MonsterRoster -- who lives where', () => {

    it('every biome encounter table names creatures the game can spawn', () => {
      const bad = [];
      for (const b of TR.BiomeRegistry.getAll())
        for (const id of b.encounterTable || [])
          if (!spawnable(id))
            bad.push(`${b.id}:${id}`);
      assert.deepEqual(bad, []);
    });

    it('a biome lists its table first, then its kin from the registry', () => {
      const ids = R.forBiome('arctic_tundra');
      assert.equal(ids[0], 'winter_wolf');
      assert.ok(ids.includes('white_dragon_adult'), 'white dragons live in the cold');
      assert.ok(!ids.includes('red_dragon_adult'), 'red dragons do not');
    });

    it('the sea is home to the aquatic', () => {
      const ids = R.forBiome('ocean');
      assert.ok(ids.includes('sahuagin') && ids.includes('shark_large'), ids.join(','));
      assert.ok(!ids.includes('goblin'));
    });

    it('the CR window filters', () => {
      const ids = R.forBiome('underground', { crMin: 2, crMax: 5 });
      assert.ok(ids.length > 3);
      for (const id of ids)
        assert.ok(R.crOf(id) >= 2 && R.crOf(id) <= 5, id);
    });

    it('overworld and dungeon biome names map onto the registry', () => {
      assert.equal(R.resolveBiome('forest'), 'temperate_forest');
      assert.equal(R.resolveBiome('cave'), 'underground');
      assert.equal(R.resolveBiome('swamp'), 'swamp');
      assert.equal(R.resolveBiome('nowhere_at_all'), 'temperate_plains');
    });

    it('the lower planes are full of fiends', () => {
      assert.ok(R.forBiome('abyss').includes('balor'));
      assert.ok(R.forBiome('infernal_waste').includes('pit_fiend'));
    });
  });

  describe('MonsterRoster -- fair fights', () => {

    it('encounter levels follow the open rules', () => {
      assert.equal(Math.round(R.encounterLevel(['ogre'])), 3);
      assert.equal(Math.round(R.encounterLevel(['ogre', 'ogre'])), 5);
      assert.equal(Math.round(R.encounterLevel(['ogre', 'ogre', 'ogre', 'ogre'])), 7);
      assert.equal(Math.round(R.encounterLevel(['hobgoblin', 'hobgoblin'])), 1);
    });

    it('an encounter is within a level of the party, in every biome and at every level', () => {
      const prng = new PRNG(42);
      for (const b of TR.BiomeRegistry.getAll())
        for (const lvl of [1, 3, 6, 10, 15]) {
          const group = R.encounter(b.id, lvl, prng);
          assert.ok(group.length >= 1 && group.length <= 7, `${b.id} L${lvl}: ${group.length}`);
          for (const g of group)
            assert.ok(spawnable(g.templateId), g.templateId);
          if (group.some(g => g.targetLevel))
            continue;
          const el = R.encounterLevel(group.map(g => g.templateId));
          assert.ok(Math.abs(el - lvl) <= 1.6, `${b.id} L${lvl}: EL ${el.toFixed(1)} ${group.map(g => g.templateId).join(',')}`);
        }
    });

    it('groups are mostly of one kind', () => {
      const prng = new PRNG(7);
      let alike = 0;
      for (let i = 0; i < 60; ++i) {
        const group = R.encounter('temperate_forest', 4, prng);
        if (new Set(group.map(g => g.templateId)).size === 1)
          ++alike;
      }
      assert.ok(alike >= 30, `${alike} of 60`);
    });

    it('the same seed gives the same encounter', () => {
      const a = R.encounter('mountain', 7, new PRNG(9));
      const b = R.encounter('mountain', 7, new PRNG(9));
      assert.deepEqual(a, b);
    });

    it('every encounter spawns in the combat engine', () => {
      const group = R.encounter('underground', 5, new PRNG(5));
      const eng = new TR.CombatEngine(new PRNG(1));
      const hero = TR.Character.createCharacter('human', 'fighter', 'H', 5, new PRNG(1));
      eng.initCombat([hero], group, 16, 12, 'cave');
      assert.equal(eng.units.filter(u => u.faction === 'enemy').length, group.length);
    });
  });

  describe('Dungeon themes -- registry monsters', () => {

    it('every pool id spawns and the legacy boss stays last', () => {
      for (const t of Object.values(TR.DungeonThemes.THEMES))
        for (const pool of t.pools)
          for (const id of pool)
            assert.ok(spawnable(id), `${t.id}: ${id}`);
      assert.equal(TR.DungeonThemes.THEMES.crypt.pools[4].at(-1), 'death_knight');
    });

    it('pools grew with creatures from the bestiary', () => {
      const all = new Set(Object.values(TR.DungeonThemes.THEMES).flatMap(t => t.pools.flat()));
      for (const id of ['mummy', 'umber_hulk', 'ettin', 'bearded_devil', 'white_dragon_wyrmling', 'shambling_mound'])
        assert.ok(all.has(id), id);
    });
  });
})();
