;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { CombatEngine, Character, PRNG, PlaneWorlds } = TR;

  const ids = plane => PlaneWorlds.traits(plane).map(t => t.id);

  function fight(plane, enemies = [{ templateId: 'goblin' }], seed = 42) {
    const engine = new CombatEngine(new PRNG(seed));
    const party = [Character.createCharacter('human', 'fighter', 'Ada', 3, new PRNG(1)), Character.createCharacter('human', 'wizard', 'Bo', 3, new PRNG(2))];
    engine.initCombat(party, enemies, 10, 8, 'plains');
    engine.setPlaneTraits(PlaneWorlds.traits(plane));
    return engine;
  }

  // run turns until every unit has started at least one
  function everyoneActs(engine) {
    const seen = new Set();
    for (let i = 0; i < 40 && seen.size < engine.units.length; ++i) {
      engine.startTurn();
      if (engine.currentUnit)
        seen.add(engine.currentUnit.id);
      engine.nextTurn();
    }
  }

  describe('Plane traits', () => {

    it('the Material Plane has none', () => {
      assert.deepEqual(PlaneWorlds.traits('material'), []);
      assert.deepEqual(PlaneWorlds.traits('nowhere'), []);
    });

    it('come from the plane registry and every one explains itself', () => {
      assert.ok(ids('astral').includes('weightless'));
      assert.ok(ids('ethereal').includes('weightless'));
      assert.ok(ids('elemental_water').includes('flooded'));
      assert.ok(ids('elemental_fire').includes('hazard'));
      assert.ok(ids('elemental_fire').includes('element_magic'));
      assert.ok(ids('negative_energy').includes('hazard'));
      assert.ok(ids('positive_energy').includes('vital'));
      assert.ok(ids('shadow').includes('dulled_magic'));
      assert.ok(ids('limbo').includes('wild_magic'));
      assert.ok(ids('gray_waste').includes('despair'));
      const hell = PlaneWorlds.traits('nine_hells').find(t => t.id === 'home_ground');
      assert.deepEqual(hell.natives, ['lawful', 'evil']);
      for (const p of TR.PlaneRegistry.getAll())
        for (const t of PlaneWorlds.traits(p.id))
          assert.ok(t.name && t.text, `${p.id}.${t.id}`);
    });
  });

  describe('Plane traits -- in battle', () => {

    it('weightless planes let everyone fly', () => {
      const e = fight('astral');
      for (const u of e.units)
        assert.ok(u.passMode & 0b00010, `${u.name} cannot fly`);
      const home = fight('material');
      assert.ok(home.units.some(u => !u.passMode || !(u.passMode & 0b00010)));
    });

    it('the plane of fire burns the unprotected each turn, not its own', () => {
      const e = fight('elemental_fire', [{ templateId: 'fire_elemental_medium' }]);
      const before = new Map(e.units.map(u => [u.id, u.currentHp]));
      everyoneActs(e);
      const party = e.units.filter(u => u.faction === 'party');
      assert.ok(party.some(u => u.currentHp < before.get(u.id)), 'nobody burned');
      const elemental = e.units.find(u => u.faction === 'enemy');
      assert.equal(elemental.currentHp, before.get(elemental.id), 'the fire elemental burned');
      assert.ok(e.combatLog.some(l => /fire damage \(Searing Heat\)/.test(l)));
    });

    it('negative energy drains the living but not the undead', () => {
      const e = fight('negative_energy', [{ templateId: 'skeleton' }]);
      const before = new Map(e.units.map(u => [u.id, u.currentHp]));
      everyoneActs(e);
      const skel = e.units.find(u => u.faction === 'enemy');
      assert.equal(skel.currentHp, before.get(skel.id));
      assert.ok(e.units.filter(u => u.faction === 'party').some(u => u.currentHp < before.get(u.id)));
    });

    it('positive energy mends wounds', () => {
      const e = fight('positive_energy');
      const hero = e.units.find(u => u.faction === 'party');
      hero.takeDamage(5);
      const hurt = hero.currentHp;
      everyoneActs(e);
      assert.ok(hero.currentHp > hurt);
    });

    it('fire spells burn hotter on the plane of fire, frost weaker', () => {
      const cast = (plane, spellId) => {
        let total = 0;
        for (let seed = 1; seed <= 30; ++seed) {
          const e = fight(plane, [{ templateId: 'hill_giant' }], seed);
          const caster = e.units.find(u => u.faction === 'party');
          const target = e.units.find(u => u.faction === 'enemy');
          const before = target.currentHp;
          e.resolveSpell(caster.id, target.id, spellId);
          total += before - target.currentHp;
        }
        return total;
      };
      const fire = 'fire_bolt', cold = 'ice_storm';
      assert.ok(cast('elemental_fire', fire) > cast('material', fire), 'fire not stronger');
      assert.ok(cast('elemental_fire', cold) < cast('material', cold), 'frost not weaker');
    });
  });
})();
