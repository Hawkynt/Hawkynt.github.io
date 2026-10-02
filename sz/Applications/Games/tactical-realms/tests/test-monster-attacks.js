;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { MonsterAttacks, CombatEngine, PRNG, Character } = TR;

  const monster = id => CombatEngine.templateToCharacter(id, new PRNG(3), 0);
  const names = id => MonsterAttacks.routine(monster(id)).map(a => a.name);

  function duel(monsterId, seed = 9) {
    const eng = new CombatEngine(new PRNG(seed));
    const hero = Character.createCharacter('human', 'fighter', 'Hero', 1, new PRNG(1));
    eng.initCombat([{ ...hero, hp: 999, maxHp: 999 }], [{ templateId: monsterId }], 10, 8, 'plains');
    const foe = eng.units.find(u => u.faction === 'enemy');
    const me = eng.units.find(u => u.faction === 'party');
    eng.grid.moveUnit(foe.id, me.position.col + 1, me.position.row);
    foe.setPosition(me.position.col + 1, me.position.row);
    return { eng, foe, me };
  }

  describe('MonsterAttacks -- routines', () => {

    it('dragons bite and claw twice', () => {
      assert.deepEqual(names('red_dragon_adult'), ['bite', 'claw', 'claw']);
    });

    it('bears and great cats claw, claw, bite', () => {
      const bear = TR.CreatureRegistry.getMonsters().find(m => /bear/.test(m.id) && !/owlbear|bugbear/.test(m.id)).id;
      assert.deepEqual(names(bear), ['claw', 'claw', 'bite']);
    });

    it('scorpions pinch twice and sting', () => {
      const id = TR.CreatureRegistry.getMonsters().find(m => /scorpion/.test(m.id)).id;
      assert.deepEqual(names(id), ['claw', 'claw', 'sting']);
    });

    it('thinking humanoids and giants use a weapon', () => {
      assert.deepEqual(names('ettin'), ['weapon']);
    });

    it('the stat block damage stays the primary attack', () => {
      const d = monster('red_dragon_adult');
      const r = MonsterAttacks.routine(d);
      assert.equal(r[0].dice, d.damageDice);
      assert.equal(r[0].sides, d.damageSides);
      assert.ok(r[1].dice * r[1].sides <= r[0].dice * r[0].sides, 'claws hit softer than the bite');
    });

    it('party characters have no natural routine', () => {
      const hero = Character.createCharacter('human', 'fighter', 'Hero', 1, new PRNG(1));
      assert.equal(MonsterAttacks.routine(hero), null);
    });
  });

  describe('MonsterAttacks -- full attacks in combat', () => {

    it('a monster that stood still makes all its attacks', () => {
      const { eng, foe, me } = duel('red_dragon_adult');
      const res = eng.resolveAttack(foe.id, me.id);
      assert.equal(res.attacks.length, 3);
    });

    it('after moving only the primary attack lands', () => {
      const { eng, foe, me } = duel('red_dragon_adult');
      foe.endMove();
      const res = eng.resolveAttack(foe.id, me.id);
      assert.equal(res.attacks.length, 1);
    });

    it('pouncers make all their attacks even after moving', () => {
      const pouncer = TR.CreatureRegistry.getMonsters().find(m => (m.traits || []).includes('pounce') && MonsterAttacks.routine(monster(m.id)).length > 1);
      const { eng, foe, me } = duel(pouncer.id);
      foe.endMove();
      const res = eng.resolveAttack(foe.id, me.id);
      assert.ok(res.attacks.length > 1, pouncer.id);
    });

    it('the total damage is the sum of the hits', () => {
      const { eng, foe, me } = duel('red_dragon_adult', 21);
      const before = me.currentHp;
      const res = eng.resolveAttack(foe.id, me.id);
      assert.equal(before - me.currentHp, res.damage);
      assert.equal(res.damage, res.attacks.reduce((s, a) => s + a.damage, 0));
    });
  });
})();
