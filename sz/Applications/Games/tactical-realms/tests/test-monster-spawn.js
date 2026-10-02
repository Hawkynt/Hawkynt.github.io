;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { CombatEngine, CreatureRegistry, PRNG, CombatUnit } = TR;

  const make = (id, opts = {}) => CombatEngine.templateToCharacter(id, new PRNG(5), opts.extraHD || 0, opts.targetLevel);

  describe('Registry monsters -- spawning', () => {

    it('every registry monster becomes a sane combatant', () => {
      const bad = [];
      for (const m of CreatureRegistry.getMonsters()) {
        const ch = make(m.id);
        const ok = ch && Number.isInteger(ch.hp) && ch.hp >= 1 && ch.ac >= 1 && ch.ac <= 60
          && ch.speed >= 10 && ch.speed <= 60
          && ['fort', 'ref', 'will'].every(k => Number.isFinite(ch.saves[k]));
        if (!ok)
          bad.push(m.id);
      }
      assert.deepEqual(bad, []);
    });

    it('stat-block saves and size are kept', () => {
      const ettin = make('ettin');
      assert.equal(ettin.saves.fort, 9);
      assert.equal(ettin.size, 'L');
      assert.equal(ettin.sizeMod, -1);
      // AC 10 - 1 dex + 7 natural - 1 size
      assert.equal(ettin.ac, 15);
    });

    it('tiny creatures get their size bonus and keep at least 1 HP', () => {
      const bat = make('bat');
      assert.equal(bat.sizeMod, 4);
      assert.ok(bat.hp >= 1);
    });

    it('flyers move on the wing, capped to the board', () => {
      const shadow = make('shadow');
      assert.equal(shadow.speed, 40);
      const dragon = make('red_dragon_adult');
      assert.equal(dragon.speed, 60);
    });

    it('vision comes from the traits', () => {
      assert.equal(make('red_dragon_adult').vision, 'darkvision');
      assert.equal(make('bat').vision, 'low-light');
    });

    it('advancement shifts the stat-block saves', () => {
      const base = make('ettin');
      const big = make('ettin', { extraHD: 4 });
      assert.ok(big.saves.fort > base.saves.fort);
    });

    it('dragons bite with their size and keep the breath apart', () => {
      const d = make('red_dragon_adult');
      assert.equal(d.size, 'H');
      assert.equal(d.damageDice, 2);
      assert.equal(d.damageSides, 8);
      assert.ok(d.breath && d.breath.dice >= 6);
    });

    it('legacy templates are untouched', () => {
      const g = make('goblin');
      assert.equal(g.hp, 8);
      assert.equal(g.ac, 14);
    });

    it('flying units carry their movement modes', () => {
      const u = new CombatUnit('e', make('shadow'), 'enemy', 0, 0);
      assert.ok(u.passMode & 0b00010, 'fly bit');
    });
  });
})();
