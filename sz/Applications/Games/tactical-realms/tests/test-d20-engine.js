;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { D20, CombatGrid, PRNG } = window.SZ.TacticalRealms;

  describe('D20 Engine', () => {
    let prng;

    beforeEach(() => {
      prng = new PRNG(42);
    });

    it('rollInitiative returns object with roll and total', () => {
      const result = D20.rollInitiative(prng, 2, 0);
      assert.ok('roll' in result);
      assert.ok('total' in result);
      assert.ok(result.roll >= 1 && result.roll <= 20);
      assert.equal(result.total, result.roll + 2);
    });

    it('rollInitiative includes misc modifier', () => {
      const result = D20.rollInitiative(prng, 3, 2);
      assert.equal(result.total, result.roll + 3 + 2);
    });

    it('sortInitiative sorts by total descending', () => {
      const entries = [
        { id: 'a', total: 10, dexMod: 2 },
        { id: 'b', total: 15, dexMod: 1 },
        { id: 'c', total: 12, dexMod: 3 },
      ];
      const sorted = D20.sortInitiative(entries, prng);
      assert.equal(sorted[0].id, 'b');
      assert.equal(sorted[1].id, 'c');
      assert.equal(sorted[2].id, 'a');
    });

    it('sortInitiative tiebreaks by dexMod descending', () => {
      const entries = [
        { id: 'a', total: 15, dexMod: 1 },
        { id: 'b', total: 15, dexMod: 3 },
      ];
      const sorted = D20.sortInitiative(entries, prng);
      assert.equal(sorted[0].id, 'b');
      assert.equal(sorted[1].id, 'a');
    });

    it('sortInitiative tiebreaks by random when total and dexMod equal', () => {
      const entries = [
        { id: 'a', total: 15, dexMod: 2 },
        { id: 'b', total: 15, dexMod: 2 },
      ];
      const sorted = D20.sortInitiative(entries, new PRNG(42));
      assert.equal(sorted.length, 2);
      assert.ok(sorted[0].id === 'a' || sorted[0].id === 'b');
    });

    it('sortInitiative is deterministic with same seed', () => {
      const entries = [
        { id: 'a', total: 15, dexMod: 2 },
        { id: 'b', total: 15, dexMod: 2 },
        { id: 'c', total: 15, dexMod: 2 },
      ];
      const s1 = D20.sortInitiative(entries.map(e => ({ ...e })), new PRNG(99));
      const s2 = D20.sortInitiative(entries.map(e => ({ ...e })), new PRNG(99));
      for (let i = 0; i < s1.length; ++i)
        assert.equal(s1[i].id, s2[i].id);
    });

    it('attackRoll returns complete result object', () => {
      const result = D20.attackRoll(prng, 5, 3, 0, 14);
      assert.ok('d20' in result);
      assert.ok('total' in result);
      assert.ok('hit' in result);
      assert.ok('natural20' in result);
      assert.ok('natural1' in result);
    });

    it('attackRoll d20 is in range 1-20', () => {
      for (let i = 0; i < 50; ++i) {
        const r = D20.attackRoll(prng, 0, 0, 0, 10);
        assert.ok(r.d20 >= 1 && r.d20 <= 20);
      }
    });

    it('attackRoll total equals d20 + bab + abilityMod + misc', () => {
      const r = D20.attackRoll(prng, 5, 3, 2, 10);
      assert.equal(r.total, r.d20 + 5 + 3 + 2);
    });

    it('attackRoll hit is true when total >= targetAC', () => {
      const rng = new PRNG(1);
      let hitFound = false;
      for (let i = 0; i < 100; ++i) {
        const r = D20.attackRoll(rng, 20, 0, 0, 10);
        if (r.total >= 10 && !r.natural1)
          hitFound = hitFound || r.hit;
      }
      assert.ok(hitFound);
    });

    it('attackRoll natural 20 always hits', () => {
      for (let seed = 0; seed < 1000; ++seed) {
        const r = D20.attackRoll(new PRNG(seed), 0, 0, 0, 100);
        if (r.d20 === 20) {
          assert.ok(r.hit, 'natural 20 should always hit');
          assert.ok(r.natural20);
          return;
        }
      }
      assert.ok(false, 'could not find a natural 20 in 1000 seeds');
    });

    it('attackRoll natural 1 always misses', () => {
      for (let seed = 0; seed < 1000; ++seed) {
        const r = D20.attackRoll(new PRNG(seed), 100, 0, 0, 1);
        if (r.d20 === 1) {
          assert.ok(!r.hit, 'natural 1 should always miss');
          assert.ok(r.natural1);
          return;
        }
      }
      assert.ok(false, 'could not find a natural 1 in 1000 seeds');
    });

    it('damageRoll returns rolls array and total', () => {
      const r = D20.damageRoll(prng, 2, 6, 3, 0);
      assert.ok('rolls' in r);
      assert.ok('total' in r);
      assert.isArray(r.rolls);
      assert.equal(r.rolls.length, 2);
    });

    it('damageRoll each die is in range 1-sides', () => {
      for (let i = 0; i < 20; ++i) {
        const r = D20.damageRoll(prng, 3, 8, 0, 0);
        for (const d of r.rolls) {
          assert.ok(d >= 1 && d <= 8);
        }
      }
    });

    it('damageRoll total = sum of rolls + strMod + misc', () => {
      const r = D20.damageRoll(prng, 2, 6, 4, 1);
      const sum = r.rolls.reduce((a, b) => a + b, 0);
      assert.equal(r.total, sum + 4 + 1);
    });

    it('damageRoll minimum total is 1 even with negative mods', () => {
      const r = D20.damageRoll(prng, 1, 4, -10, 0);
      assert.ok(r.total >= 1);
    });

    it('criticalCheck returns crit result', () => {
      const r = D20.criticalCheck(prng, 20, [20], 5, 3, 0, 10, 2);
      assert.ok('confirmed' in r);
      assert.ok('multiplier' in r);
    });

    it('criticalCheck confirms when confirm roll meets AC', () => {
      let confirmed = false;
      for (let seed = 0; seed < 200; ++seed) {
        const r = D20.criticalCheck(new PRNG(seed), 20, [20], 20, 0, 0, 10, 2);
        if (r.confirmed) {
          confirmed = true;
          assert.equal(r.multiplier, 2);
          break;
        }
      }
      assert.ok(confirmed, 'should confirm at least once in 200 seeds');
    });

    it('criticalCheck returns unconfirmed when roll is not in threat range', () => {
      const r = D20.criticalCheck(prng, 15, [20], 5, 0, 0, 10, 2);
      assert.ok(!r.confirmed);
      assert.equal(r.multiplier, 1);
    });

    it('criticalCheck wider threat range (19-20)', () => {
      const r = D20.criticalCheck(prng, 19, [19, 20], 5, 0, 0, 10, 2);
      assert.ok('confirmed' in r);
    });

    it('isFlanking returns true for N/S flanking', () => {
      const grid = makeSmallGrid();
      grid.placeUnit('party_1', 3, 2);
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_2', 3, 4);
      assert.ok(D20.isFlanking(grid, { col: 3, row: 2 }, { col: 3, row: 3 }, 'party'));
    });

    it('isFlanking returns true for E/W flanking', () => {
      const grid = makeSmallGrid();
      grid.placeUnit('party_1', 2, 3);
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_2', 4, 3);
      assert.ok(D20.isFlanking(grid, { col: 2, row: 3 }, { col: 3, row: 3 }, 'party'));
    });

    it('isFlanking returns false for diagonal "flanking"', () => {
      const grid = makeSmallGrid();
      grid.placeUnit('party_1', 2, 2);
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_2', 4, 4);
      assert.ok(!D20.isFlanking(grid, { col: 2, row: 2 }, { col: 3, row: 3 }, 'party'));
    });

    it('isFlanking returns false when no ally opposite', () => {
      const grid = makeSmallGrid();
      grid.placeUnit('party_1', 3, 2);
      grid.placeUnit('enemy_1', 3, 3);
      assert.ok(!D20.isFlanking(grid, { col: 3, row: 2 }, { col: 3, row: 3 }, 'party'));
    });

    it('isFlanking returns false if opposite unit is enemy', () => {
      const grid = makeSmallGrid();
      grid.placeUnit('party_1', 3, 2);
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('enemy_2', 3, 4);
      assert.ok(!D20.isFlanking(grid, { col: 3, row: 2 }, { col: 3, row: 3 }, 'party'));
    });

    it('isAdjacent returns true for cardinal neighbors', () => {
      assert.ok(D20.isAdjacent({ col: 3, row: 3 }, { col: 3, row: 4 }));
      assert.ok(D20.isAdjacent({ col: 3, row: 3 }, { col: 4, row: 3 }));
      assert.ok(D20.isAdjacent({ col: 3, row: 3 }, { col: 3, row: 2 }));
      assert.ok(D20.isAdjacent({ col: 3, row: 3 }, { col: 2, row: 3 }));
    });

    it('isAdjacent returns false for diagonals', () => {
      assert.ok(!D20.isAdjacent({ col: 3, row: 3 }, { col: 4, row: 4 }));
      assert.ok(!D20.isAdjacent({ col: 3, row: 3 }, { col: 2, row: 2 }));
    });

    it('isAdjacent returns false for same position', () => {
      assert.ok(!D20.isAdjacent({ col: 3, row: 3 }, { col: 3, row: 3 }));
    });

    it('isAdjacent returns false for distance > 1', () => {
      assert.ok(!D20.isAdjacent({ col: 0, row: 0 }, { col: 2, row: 0 }));
    });

    it('isAdjacent with reach 2 allows 2-tile distance', () => {
      assert.ok(D20.isAdjacent({ col: 0, row: 0 }, { col: 2, row: 0 }, 2));
      assert.ok(D20.isAdjacent({ col: 0, row: 0 }, { col: 0, row: 2 }, 2));
    });

    it('isAdjacent with reach 2 does not allow diagonal at 2', () => {
      assert.ok(!D20.isAdjacent({ col: 0, row: 0 }, { col: 1, row: 1 }, 2));
    });

    it('multiple initiative rolls produce varied results', () => {
      const totals = new Set();
      for (let i = 0; i < 20; ++i)
        totals.add(D20.rollInitiative(prng, 0, 0).total);
      assert.greaterThan(totals.size, 1);
    });

    it('damageRoll with 0 dice returns minimum 1', () => {
      const r = D20.damageRoll(prng, 0, 6, 0, 0);
      assert.equal(r.rolls.length, 0);
      assert.equal(r.total, 1);
    });
  });

  function makeSmallGrid() {
    const terrain = [];
    for (let i = 0; i < 64; ++i)
      terrain.push('plains');
    return new (window.SZ.TacticalRealms.CombatGrid)(8, 8, terrain);
  }
})();
