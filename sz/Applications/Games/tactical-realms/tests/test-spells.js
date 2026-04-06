;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const Spells = window.SZ.TacticalRealms.Spells;
  const { SpellTarget, SpellSchool, CLASS_SCHOOLS, SPELL_LIST, SPELLS_KNOWN_TABLE } = Spells;

  describe('Spells', () => {

    it('SpellTarget has expected values', () => {
      assert.equal(SpellTarget.ENEMY, 'enemy');
      assert.equal(SpellTarget.ALLY, 'ally');
      assert.equal(SpellTarget.SELF, 'self');
    });

    it('SpellSchool has 9 schools', () => {
      const keys = Object.keys(SpellSchool);
      assert.equal(keys.length, 9);
      assert.ok(SpellSchool.EVOCATION);
      assert.ok(SpellSchool.RESTORATION);
      assert.ok(SpellSchool.ENCHANTMENT);
    });

    it('SPELL_LIST contains at least 30 spells', () => {
      assert.ok(SPELL_LIST.length >= 30);
    });

    it('all spells have required fields', () => {
      for (const s of SPELL_LIST) {
        assert.ok(s.id, `spell missing id`);
        assert.ok(s.name, `${s.id} missing name`);
        assert.ok(s.school, `${s.id} missing school`);
        assert.equal(typeof s.level, 'number', `${s.id} level not number`);
        assert.equal(typeof s.mpCost, 'number', `${s.id} mpCost not number`);
        assert.equal(typeof s.range, 'number', `${s.id} range not number`);
        assert.ok(s.target, `${s.id} missing target`);
        assert.ok(s.description, `${s.id} missing description`);
      }
    });

    it('all spell IDs are unique', () => {
      const ids = SPELL_LIST.map(s => s.id);
      const unique = new Set(ids);
      assert.equal(unique.size, ids.length);
    });

    it('cantrips have mpCost 0', () => {
      for (const s of SPELL_LIST) {
        if (s.level === 0)
          assert.equal(s.mpCost, 0, `${s.id} cantrip should cost 0 MP`);
      }
    });

    it('higher level spells cost more MP', () => {
      for (const s of SPELL_LIST) {
        if (s.level === 1) assert.equal(s.mpCost, 2, `${s.id} L1 should cost 2 MP`);
        if (s.level === 2) assert.equal(s.mpCost, 4, `${s.id} L2 should cost 4 MP`);
        if (s.level === 3) assert.equal(s.mpCost, 6, `${s.id} L3 should cost 6 MP`);
        if (s.level === 4) assert.equal(s.mpCost, 8, `${s.id} L4 should cost 8 MP`);
      }
    });

    it('byId returns correct spell', () => {
      const mm = Spells.byId('magic_missile');
      assert.ok(mm);
      assert.equal(mm.name, 'Magic Missile');
      assert.equal(mm.level, 1);
      assert.equal(mm.school, SpellSchool.EVOCATION);
    });

    it('byId returns null for unknown id', () => {
      assert.equal(Spells.byId('nonexistent'), null);
    });

    it('allIds returns all spell ids', () => {
      const ids = Spells.allIds();
      assert.ok(ids.length >= SPELL_LIST.length, 'should have at least all legacy spells');
      assert.ok(ids.includes('arcane_bolt'));
      assert.ok(ids.includes('fireball'));
    });

    it('bySchool filters correctly', () => {
      const evo = Spells.bySchool(SpellSchool.EVOCATION);
      assert.ok(evo.length > 0);
      for (const s of evo)
        assert.equal(s.school, SpellSchool.EVOCATION);
    });

    it('byLevel returns spells of that level', () => {
      const cantrips = Spells.byLevel(0);
      assert.ok(cantrips.length > 0);
      for (const s of cantrips) {
        const lvl = typeof s.level === 'number' ? s.level : Math.min(...Object.values(s.level));
        assert.equal(lvl, 0);
      }
    });

    it('cantrips() returns only level 0 spells', () => {
      const c = Spells.cantrips();
      assert.ok(c.length > 0);
      for (const s of c) {
        const lvl = typeof s.level === 'number' ? s.level : Math.min(...Object.values(s.level));
        assert.equal(lvl, 0);
      }
    });

    it('CLASS_SCHOOLS has entries for all caster classes', () => {
      const casters = ['wizard', 'cleric', 'paladin', 'ranger', 'bard', 'warlock', 'sorcerer'];
      for (const c of casters)
        assert.ok(CLASS_SCHOOLS[c], `missing schools for ${c}`);
    });

    it('non-caster classes have no schools', () => {
      assert.equal(Spells.schoolsForClass('fighter').length, 0);
      assert.equal(Spells.schoolsForClass('rogue').length, 0);
      assert.equal(Spells.schoolsForClass('barbarian').length, 0);
    });

    it('wizard has access to all arcane schools', () => {
      const schools = Spells.schoolsForClass('wizard');
      assert.ok(schools.length >= 5, 'wizard should have at least 5 schools');
      assert.ok(schools.includes('evocation'));
      assert.ok(schools.includes('necromancy'));
      assert.ok(schools.includes('conjuration'));
    });

    it('cleric has access to divine schools', () => {
      const schools = Spells.schoolsForClass('cleric');
      assert.ok(schools.length >= 3, 'cleric should have at least 3 schools');
      assert.ok(schools.includes('restoration') || schools.includes('abjuration'), 'cleric should have restoration or abjuration');
    });

    it('spellsForClass returns spells for wizard', () => {
      const wizSpells = Spells.spellsForClass('wizard');
      assert.ok(wizSpells.length > 0, 'wizard should have spells');
      const wizSchools = Spells.schoolsForClass('wizard');
      for (const s of wizSpells) {
        if (typeof s.level === 'number') {
          assert.ok(wizSchools.includes(s.school), `legacy ${s.id} school ${s.school} not in wizard schools`);
        }
      }
    });

    it('spellsForClass returns empty for non-casters', () => {
      assert.equal(Spells.spellsForClass('fighter').length, 0);
    });

    it('spellsKnownAtLevel returns correct slots for level 1', () => {
      const slots = Spells.spellsKnownAtLevel(1);
      assert.equal(slots.cantrips, 2);
      assert.equal(slots.l1, 1);
      assert.equal(slots.l2, 0);
      assert.equal(slots.l3, 0);
      assert.equal(slots.l4, 0);
    });

    it('spellsKnownAtLevel returns correct slots for level 5', () => {
      const slots = Spells.spellsKnownAtLevel(5);
      assert.equal(slots.cantrips, 3);
      assert.equal(slots.l1, 3);
      assert.equal(slots.l2, 1);
    });

    it('spellsKnownAtLevel returns correct slots for level 20', () => {
      const slots = Spells.spellsKnownAtLevel(20);
      assert.equal(slots.cantrips, 5);
      assert.equal(slots.l1, 3);
      assert.equal(slots.l2, 3);
      assert.equal(slots.l3, 3);
      assert.equal(slots.l4, 3);
    });

    it('spellsKnownAtLevel interpolates between table entries', () => {
      const slots4 = Spells.spellsKnownAtLevel(4);
      assert.equal(slots4.cantrips, 3);
      assert.equal(slots4.l1, 2);
      assert.equal(slots4.l2, 0);
    });

    it('assignSpells returns spell ids for a caster', () => {
      const PRNG = window.SZ.TacticalRealms.PRNG;
      const prng = new PRNG(42);
      const spells = Spells.assignSpells('wizard', 1, prng);
      assert.ok(spells.length > 0);
      assert.ok(spells.length <= 3);
      for (const id of spells)
        assert.ok(Spells.byId(id), `${id} should be valid spell`);
    });

    it('assignSpells returns empty for non-casters', () => {
      const PRNG = window.SZ.TacticalRealms.PRNG;
      const prng = new PRNG(42);
      assert.equal(Spells.assignSpells('fighter', 1, prng).length, 0);
    });

    it('assignSpells at level 5 includes level 2 spells', () => {
      const PRNG = window.SZ.TacticalRealms.PRNG;
      const prng = new PRNG(42);
      const spells = Spells.assignSpells('wizard', 5, prng);
      const hasL2 = spells.some(id => {
        const s = Spells.byId(id);
        const lvl = typeof s.level === 'number' ? s.level : (s.level?.wizard ?? -1);
        return lvl === 2;
      });
      assert.ok(hasL2, 'level 5 wizard should have at least one L2 spell');
    });

    it('assignSpells for wizard assigns valid spells', () => {
      const PRNG = window.SZ.TacticalRealms.PRNG;
      const prng = new PRNG(42);
      const spells = Spells.assignSpells('wizard', 10, prng);
      assert.ok(spells.length > 0, 'wizard should get assigned spells');
      for (const id of spells) {
        const s = Spells.byId(id);
        assert.ok(s, `${id} should be a valid spell`);
      }
    });

    it('isInRange returns true for adjacent tiles', () => {
      assert.ok(Spells.isInRange(5, 5, 5, 6, 1));
      assert.ok(Spells.isInRange(5, 5, 6, 5, 1));
    });

    it('isInRange returns false when out of range', () => {
      assert.ok(!Spells.isInRange(0, 0, 5, 0, 3));
      assert.ok(!Spells.isInRange(0, 0, 2, 2, 3));
    });

    it('isInRange returns true for zero range at same position', () => {
      assert.ok(Spells.isInRange(3, 3, 3, 3, 0));
    });

    it('getSpellTargetsInRange finds enemies in range', () => {
      const spell = Spells.byId('arcane_bolt');
      const casterPos = { col: 2, row: 2 };
      const units = [
        { id: 'e1', faction: 'enemy', isAlive: true, position: { col: 4, row: 2 } },
        { id: 'e2', faction: 'enemy', isAlive: true, position: { col: 10, row: 10 } },
        { id: 'p1', faction: 'party', isAlive: true, position: { col: 1, row: 2 } },
      ];
      const targets = Spells.getSpellTargetsInRange(null, casterPos, spell, 'party', units);
      assert.ok(targets.includes('e1'));
      assert.ok(!targets.includes('e2'));
      assert.ok(!targets.includes('p1'));
    });

    it('getSpellTargetsInRange finds allies for heal spell', () => {
      const spell = Spells.byId('cure_wounds');
      const casterPos = { col: 2, row: 2 };
      const units = [
        { id: 'p1', faction: 'party', isAlive: true, position: { col: 2, row: 3 } },
        { id: 'p2', faction: 'party', isAlive: true, position: { col: 10, row: 10 } },
        { id: 'e1', faction: 'enemy', isAlive: true, position: { col: 3, row: 2 } },
      ];
      const targets = Spells.getSpellTargetsInRange(null, casterPos, spell, 'party', units);
      assert.ok(targets.includes('p1'));
      assert.ok(!targets.includes('p2'));
      assert.ok(!targets.includes('e1'));
    });

    it('getSpellTargetsInRange excludes dead units', () => {
      const spell = Spells.byId('arcane_bolt');
      const units = [
        { id: 'e1', faction: 'enemy', isAlive: false, position: { col: 3, row: 2 } },
      ];
      const targets = Spells.getSpellTargetsInRange(null, { col: 2, row: 2 }, spell, 'party', units);
      assert.equal(targets.length, 0);
    });

    it('SPELLS_KNOWN_TABLE is sorted by level ascending', () => {
      for (let i = 1; i < SPELLS_KNOWN_TABLE.length; ++i)
        assert.ok(SPELLS_KNOWN_TABLE[i].level > SPELLS_KNOWN_TABLE[i - 1].level);
    });

    it('SPELLS_KNOWN_TABLE slots never decrease at higher levels', () => {
      for (let i = 1; i < SPELLS_KNOWN_TABLE.length; ++i) {
        const prev = SPELLS_KNOWN_TABLE[i - 1];
        const curr = SPELLS_KNOWN_TABLE[i];
        assert.ok(curr.cantrips >= prev.cantrips);
        assert.ok(curr.l1 >= prev.l1);
        assert.ok(curr.l2 >= prev.l2);
        assert.ok(curr.l3 >= prev.l3);
        assert.ok(curr.l4 >= prev.l4);
      }
    });

    it('half-casters (paladin, ranger) have fewer school options', () => {
      const palSchools = Spells.schoolsForClass('paladin');
      const rngSchools = Spells.schoolsForClass('ranger');
      const wizSchools = Spells.schoolsForClass('wizard');
      assert.ok(palSchools.length < wizSchools.length);
      assert.ok(rngSchools.length < wizSchools.length);
    });

    it('each school has at least one cantrip', () => {
      const schools = new Set(SPELL_LIST.filter(s => s.level === 0).map(s => s.school));
      assert.ok(schools.size >= 5, 'at least 5 schools should have cantrips');
    });

    it('damage spells have positive damageDice and damageSides', () => {
      for (const s of SPELL_LIST) {
        if (s.target === SpellTarget.ENEMY && s.damageDice > 0) {
          assert.ok(s.damageSides > 0, `${s.id} has damageDice but no damageSides`);
        }
      }
    });

    it('heal spells target ally and have positive healDice', () => {
      const healSpells = SPELL_LIST.filter(s => s.healDice > 0);
      assert.ok(healSpells.length > 0);
      for (const s of healSpells)
        assert.equal(s.target, SpellTarget.ALLY, `${s.id} heals but doesn't target ally`);
    });

    it('all spell schools referenced in spells are valid', () => {
      const validSchools = new Set(Object.values(SpellSchool));
      for (const s of SPELL_LIST)
        assert.ok(validSchools.has(s.school), `${s.id} has invalid school: ${s.school}`);
    });

    it('all spell targets are valid', () => {
      const validTargets = new Set(Object.values(SpellTarget));
      for (const s of SPELL_LIST)
        assert.ok(validTargets.has(s.target), `${s.id} has invalid target: ${s.target}`);
    });

    it('AoE spells have correct aoe radius values', () => {
      const aoeSpells = {
        burning_hands: 1,
        grease: 1,
        fireball: 2,
        web: 1,
        mass_healing_word: 2,
        fear: 2,
        ice_storm: 2,
      };
      for (const [id, expectedAoe] of Object.entries(aoeSpells)) {
        const s = Spells.byId(id);
        assert.ok(s, `${id} should exist`);
        assert.equal(s.aoe, expectedAoe, `${id} should have aoe=${expectedAoe}`);
      }
    });

    it('non-AoE spells have no aoe field or aoe === undefined', () => {
      const nonAoe = ['arcane_bolt', 'magic_missile', 'cure_wounds', 'scorching_ray', 'lightning_bolt'];
      for (const id of nonAoe) {
        const s = Spells.byId(id);
        assert.ok(s, `${id} should exist`);
        assert.ok(!s.aoe, `${id} should not have aoe set (got ${s.aoe})`);
      }
    });

    it('all aoe values are positive integers when present', () => {
      for (const s of SPELL_LIST) {
        if (s.aoe !== undefined) {
          assert.ok(Number.isInteger(s.aoe), `${s.id} aoe should be integer`);
          assert.greaterThan(s.aoe, 0, `${s.id} aoe should be positive`);
        }
      }
    });
  });
})();
