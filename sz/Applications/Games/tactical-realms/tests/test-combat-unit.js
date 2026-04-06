;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { CombatUnit, Character, PRNG } = window.SZ.TacticalRealms;

  function makeChar(overrides) {
    const prng = new PRNG(42);
    const base = Character.createCharacter('human', 'fighter', 'Test Fighter', 3, prng);
    if (!overrides)
      return base;
    return Object.freeze({ ...base, ...overrides, stats: Object.freeze({ ...base.stats, ...(overrides.stats || {}) }) });
  }

  describe('CombatUnit', () => {
    let unit;

    beforeEach(() => {
      unit = new CombatUnit('party_1', makeChar(), 'party', 2, 3);
    });

    it('constructor sets id, faction, and position', () => {
      assert.equal(unit.id, 'party_1');
      assert.equal(unit.faction, 'party');
      assert.equal(unit.position.col, 2);
      assert.equal(unit.position.row, 3);
    });

    it('name returns character name', () => {
      assert.equal(unit.name, 'Test Fighter');
    });

    it('currentHp starts at character maxHp', () => {
      assert.equal(unit.currentHp, unit.maxHp);
      assert.greaterThan(unit.maxHp, 0);
    });

    it('isAlive is true when hp > 0', () => {
      assert.ok(unit.isAlive);
    });

    it('takeDamage reduces currentHp', () => {
      const before = unit.currentHp;
      unit.takeDamage(5);
      assert.equal(unit.currentHp, before - 5);
    });

    it('takeDamage allows negative HP (D&D 3.5e dying/dead)', () => {
      unit.takeDamage(9999);
      assert.ok(unit.currentHp < 0, 'HP should go negative');
    });

    it('isDead when HP reaches -10 or below', () => {
      unit.takeDamage(unit.currentHp + 10);
      assert.ok(unit.isDead, 'should be dead at -10 HP');
      assert.ok(!unit.isAlive, 'should not be alive at -10 HP');
    });

    it('isDying when HP is -1 to -9', () => {
      unit.takeDamage(unit.currentHp + 5);
      assert.ok(unit.isDying, 'should be dying at -5 HP');
      assert.ok(unit.isAlive, 'dying creatures are still alive');
    });

    it('isDisabled when HP is exactly 0', () => {
      unit.takeDamage(unit.currentHp);
      assert.equal(unit.currentHp, 0);
      assert.ok(unit.isDisabled, 'should be disabled at 0 HP');
      assert.ok(unit.isAlive, 'disabled creatures are still alive');
      assert.ok(!unit.isConscious, 'disabled creatures are not conscious');
    });

    it('enemies die at 0 HP (no negative HP tracking)', () => {
      const enemy = new CombatUnit('enemy_1', makeChar(), 'enemy', 0, 0);
      enemy.takeDamage(enemy.currentHp);
      assert.equal(enemy.currentHp, 0);
      assert.ok(enemy.isDead, 'enemy should be dead at 0 HP');
      assert.ok(!enemy.isAlive, 'enemy should not be alive at 0 HP');
      assert.ok(!enemy.isDying, 'enemies do not have dying state');
      assert.ok(!enemy.isDisabled, 'enemies do not have disabled state');
    });

    it('party members survive at 0 HP (disabled) but enemies dont', () => {
      const partyUnit = new CombatUnit('party_1', makeChar(), 'party', 0, 0);
      const enemyUnit = new CombatUnit('enemy_1', makeChar(), 'enemy', 1, 0);
      partyUnit.takeDamage(partyUnit.currentHp);
      enemyUnit.takeDamage(enemyUnit.currentHp);
      assert.ok(partyUnit.isAlive, 'party at 0 HP should be alive (disabled)');
      assert.ok(!enemyUnit.isAlive, 'enemy at 0 HP should be dead');
    });

    it('heal increases currentHp', () => {
      unit.takeDamage(10);
      const after = unit.currentHp;
      unit.heal(5);
      assert.equal(unit.currentHp, after + 5);
    });

    it('heal caps at maxHp', () => {
      unit.heal(9999);
      assert.equal(unit.currentHp, unit.maxHp);
    });

    it('ac returns character ac', () => {
      assert.equal(unit.ac, unit.character.ac);
    });

    it('bab returns character bab', () => {
      assert.equal(unit.bab, unit.character.bab);
    });

    it('speed returns character speed', () => {
      assert.equal(unit.speed, unit.character.speed);
    });

    it('speedTiles returns speed / 5', () => {
      assert.equal(unit.speedTiles, Math.floor(unit.character.speed / 5));
    });

    it('dexMod returns correct ability modifier', () => {
      const expected = Character.abilityMod(unit.character.stats.dex);
      assert.equal(unit.dexMod, expected);
    });

    it('strMod returns correct ability modifier', () => {
      const expected = Character.abilityMod(unit.character.stats.str);
      assert.equal(unit.strMod, expected);
    });

    it('hasActed and hasMoved start false after beginTurn', () => {
      unit.beginTurn();
      assert.ok(!unit.hasActed);
      assert.ok(!unit.hasMoved);
    });

    it('endMove sets hasMoved', () => {
      unit.beginTurn();
      unit.endMove();
      assert.ok(unit.hasMoved);
    });

    it('endAction sets hasActed', () => {
      unit.beginTurn();
      unit.endAction();
      assert.ok(unit.hasActed);
    });

    it('setPosition updates position', () => {
      unit.setPosition(5, 6);
      assert.equal(unit.position.col, 5);
      assert.equal(unit.position.row, 6);
    });

    it('undoMove restores previous position and clears hasMoved', () => {
      unit.beginTurn();
      unit.setPosition(5, 5);
      unit.endMove();
      unit.undoMove(2, 3);
      assert.equal(unit.position.col, 2);
      assert.equal(unit.position.row, 3);
      assert.ok(!unit.hasMoved);
    });

    it('serialize returns plain object', () => {
      const data = unit.serialize();
      assert.equal(data.id, 'party_1');
      assert.equal(data.faction, 'party');
      assert.equal(data.col, 2);
      assert.equal(data.row, 3);
      assert.ok(data.character);
    });

    it('deserialize restores unit state', () => {
      unit.takeDamage(5);
      const data = unit.serialize();
      const restored = CombatUnit.deserialize(data);
      assert.equal(restored.id, 'party_1');
      assert.equal(restored.currentHp, unit.currentHp);
      assert.equal(restored.position.col, 2);
    });

    it('currentMp defaults to character mp', () => {
      const wizChar = makeChar({ mp: 10, maxMp: 10 });
      const wiz = new CombatUnit('p1', wizChar, 'party', 0, 0);
      assert.equal(wiz.currentMp, 10);
      assert.equal(wiz.maxMp, 10);
    });

    it('spendMp reduces current mp', () => {
      const wizChar = makeChar({ mp: 10, maxMp: 10 });
      const wiz = new CombatUnit('p1', wizChar, 'party', 0, 0);
      wiz.spendMp(4);
      assert.equal(wiz.currentMp, 6);
    });

    it('spendMp floors at 0', () => {
      const wizChar = makeChar({ mp: 3, maxMp: 10 });
      const wiz = new CombatUnit('p1', wizChar, 'party', 0, 0);
      wiz.spendMp(10);
      assert.equal(wiz.currentMp, 0);
    });

    it('spells defaults to empty array for non-casters', () => {
      assert.ok(Array.isArray(unit.spells));
      assert.equal(unit.spells.length, 0);
    });

    it('spells returns character spells', () => {
      const char = makeChar({ spells: ['arcane_bolt', 'magic_missile'] });
      const u = new CombatUnit('p1', char, 'party', 0, 0);
      assert.equal(u.spells.length, 2);
      assert.ok(u.spells.includes('arcane_bolt'));
    });

    it('canCastSpell returns true for known cantrip (free)', () => {
      const Spells = window.SZ.TacticalRealms.Spells;
      const char = makeChar({ mp: 0, maxMp: 0, spells: ['arcane_bolt'] });
      const u = new CombatUnit('p1', char, 'party', 0, 0);
      const spell = Spells.byId('arcane_bolt');
      assert.ok(u.canCastSpell(spell));
    });

    it('canCastSpell returns false for unknown spell', () => {
      const Spells = window.SZ.TacticalRealms.Spells;
      const char = makeChar({ mp: 10, maxMp: 10, spells: [] });
      const u = new CombatUnit('p1', char, 'party', 0, 0);
      assert.ok(!u.canCastSpell(Spells.byId('magic_missile')));
    });

    it('canCastSpell returns false when not enough MP', () => {
      const Spells = window.SZ.TacticalRealms.Spells;
      const char = makeChar({ mp: 1, maxMp: 10, spells: ['magic_missile'] });
      const u = new CombatUnit('p1', char, 'party', 0, 0);
      assert.ok(!u.canCastSpell(Spells.byId('magic_missile')));
    });

    it('canCastSpell returns true when enough MP for L1 spell', () => {
      const Spells = window.SZ.TacticalRealms.Spells;
      const char = makeChar({ mp: 5, maxMp: 10, spells: ['magic_missile'] });
      const u = new CombatUnit('p1', char, 'party', 0, 0);
      assert.ok(u.canCastSpell(Spells.byId('magic_missile')));
    });

    it('restoreMp increases current mp', () => {
      const wizChar = makeChar({ mp: 10, maxMp: 10 });
      const wiz = new CombatUnit('p1', wizChar, 'party', 0, 0);
      wiz.spendMp(6);
      assert.equal(wiz.currentMp, 4);
      wiz.restoreMp(3);
      assert.equal(wiz.currentMp, 7);
    });

    it('restoreMp caps at maxMp', () => {
      const wizChar = makeChar({ mp: 5, maxMp: 10 });
      const wiz = new CombatUnit('p1', wizChar, 'party', 0, 0);
      wiz.restoreMp(9999);
      assert.equal(wiz.currentMp, 10);
    });

    it('restoreMp with 0 mp does nothing harmful', () => {
      const wizChar = makeChar({ mp: 0, maxMp: 0 });
      const wiz = new CombatUnit('p1', wizChar, 'party', 0, 0);
      wiz.restoreMp(5);
      assert.equal(wiz.currentMp, 0);
    });

    it('serialize/deserialize preserves mp and spells', () => {
      const char = makeChar({ mp: 8, maxMp: 12, spells: ['arcane_bolt', 'fireball'] });
      const u = new CombatUnit('p1', char, 'party', 1, 2);
      u.spendMp(3);
      const data = u.serialize();
      const restored = CombatUnit.deserialize(data);
      assert.equal(restored.currentMp, 5);
      assert.equal(restored.spells.length, 2);
      assert.ok(restored.spells.includes('fireball'));
    });
  });
})();
