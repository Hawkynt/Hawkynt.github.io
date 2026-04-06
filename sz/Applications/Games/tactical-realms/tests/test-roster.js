;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const Roster = TR.Roster;
  const Character = TR.Character;
  const PRNG = TR.PRNG;
  const RACES = TR.RACES;
  const CLASSES = TR.CLASSES;

  describe('Roster — Name Generation', () => {

    it('generateName returns a "First Last" string', () => {
      const prng = new PRNG(42);
      const name = Roster.generateName(prng);
      assert.ok(name.includes(' '), `Name "${name}" should contain a space`);
      const parts = name.split(' ');
      assert.equal(parts.length, 2);
    });

    it('generateName returns non-empty strings', () => {
      const prng = new PRNG(42);
      const name = Roster.generateName(prng);
      const parts = name.split(' ');
      assert.ok(parts[0].length > 0, 'First name should not be empty');
      assert.ok(parts[1].length > 0, 'Last name should not be empty');
    });

    it('same PRNG seed produces same name', () => {
      const a = Roster.generateName(new PRNG(42));
      const b = Roster.generateName(new PRNG(42));
      assert.equal(a, b);
    });

    it('different PRNG seeds produce different names (usually)', () => {
      const names = new Set();
      for (let i = 0; i < 20; ++i)
        names.add(Roster.generateName(new PRNG(i)));
      assert.greaterThan(names.size, 10);
    });
  });

  describe('Roster — Daily Roster Generation', () => {

    it('returns an array of 6-8 characters', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'spring', prng);
      assert.isArray(roster);
      assert.ok(roster.length >= 6 && roster.length <= 8, `Roster length ${roster.length} not in [6,8]`);
    });

    it('same date seed produces identical roster', () => {
      const r1 = Roster.generateDailyRoster('2024-06-15', 'summer', new PRNG(100));
      const r2 = Roster.generateDailyRoster('2024-06-15', 'summer', new PRNG(100));
      assert.equal(r1.length, r2.length);
      for (let i = 0; i < r1.length; ++i) {
        assert.equal(r1[i].name, r2[i].name);
        assert.equal(r1[i].race, r2[i].race);
        assert.equal(r1[i].class, r2[i].class);
      }
    });

    it('different date seeds produce different rosters', () => {
      const r1 = Roster.generateDailyRoster('2024-01-15', 'winter', new PRNG(100));
      const r2 = Roster.generateDailyRoster('2024-01-16', 'winter', new PRNG(200));
      let same = 0;
      const minLen = Math.min(r1.length, r2.length);
      for (let i = 0; i < minLen; ++i)
        if (r1[i].name === r2[i].name) ++same;
      assert.lessThan(same, minLen);
    });

    it('all characters have valid race IDs', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-03-15', 'spring', prng);
      const validIds = RACES.map(r => r.id);
      for (const char of roster)
        assert.includes(validIds, char.race, `Invalid race ${char.race}`);
    });

    it('all characters have valid class IDs', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-03-15', 'spring', prng);
      const validIds = CLASSES.map(c => c.id);
      for (const char of roster)
        assert.includes(validIds, char.class, `Invalid class ${char.class}`);
    });

    it('seasonal filtering excludes out-of-season races in spring', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-04-01', 'spring', prng);
      for (const char of roster) {
        const race = RACES.find(r => r.id === char.race);
        if (race.season)
          assert.equal(race.season, 'spring', `Race ${race.id} (season: ${race.season}) should not appear in spring`);
      }
    });

    it('seasonal filtering excludes out-of-season classes in spring', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-04-01', 'spring', prng);
      for (const char of roster) {
        const cls = CLASSES.find(c => c.id === char.class);
        if (cls.season)
          assert.equal(cls.season, 'spring', `Class ${cls.id} (season: ${cls.season}) should not appear in spring`);
      }
    });

    it('summer season allows dragonborn', () => {
      let found = false;
      for (let seed = 0; seed < 50 && !found; ++seed) {
        const roster = Roster.generateDailyRoster(`2024-07-${10 + seed}`, 'summer', new PRNG(seed));
        if (roster.some(c => c.race === 'dragonborn'))
          found = true;
      }
      assert.ok(found, 'Dragonborn should appear in summer rosters eventually');
    });

    it('characters have names from the name tables', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      for (const char of roster) {
        assert.ok(char.name.includes(' '), `Character name "${char.name}" should be "First Last"`);
        assert.ok(char.name.length > 3, `Character name "${char.name}" too short`);
      }
    });

    it('roster is frozen', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      assert.ok(Object.isFrozen(roster));
    });

    it('each character in roster is frozen', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      for (const char of roster)
        assert.ok(Object.isFrozen(char), `Character ${char.name} is not frozen`);
    });

    it('all characters are level 1', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      for (const char of roster)
        assert.equal(char.level, 1);
    });

    it('all characters have valid stats (all >= 1)', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const char of roster)
        for (const a of abilities)
          assert.ok(char.stats[a] >= 1, `${char.name} stat ${a} = ${char.stats[a]} < 1`);
    });
  });

  describe('Roster — Party Selection', () => {

    it('toggleSelection adds index to empty set', () => {
      const result = Roster.toggleSelection(new Set(), 2, 4);
      assert.ok(result.selected.has(2));
      assert.equal(result.selected.size, 1);
    });

    it('toggleSelection removes already-selected index', () => {
      const initial = new Set([1, 2, 3]);
      const result = Roster.toggleSelection(initial, 2, 4);
      assert.ok(!result.selected.has(2));
      assert.equal(result.selected.size, 2);
    });

    it('toggleSelection returns full:true when at max', () => {
      const initial = new Set([0, 1, 2, 3]);
      const result = Roster.toggleSelection(initial, 5, 4);
      assert.ok(result.full);
      assert.equal(result.selected.size, 4);
    });

    it('toggleSelection allows adding when under max', () => {
      const initial = new Set([0, 1]);
      const result = Roster.toggleSelection(initial, 3, 4);
      assert.ok(result.selected.has(3));
      assert.equal(result.selected.size, 3);
      assert.ok(!result.full);
    });

    it('toggleSelection deselect works even when at max', () => {
      const initial = new Set([0, 1, 2, 3]);
      const result = Roster.toggleSelection(initial, 1, 4);
      assert.ok(!result.selected.has(1));
      assert.equal(result.selected.size, 3);
    });

    it('toggleSelection does not mutate the original set', () => {
      const initial = new Set([1]);
      Roster.toggleSelection(initial, 2, 4);
      assert.equal(initial.size, 1);
      assert.ok(initial.has(1));
    });

    it('isPartyValid returns true for 1 selected', () => {
      assert.ok(Roster.isPartyValid(new Set([0])));
    });

    it('isPartyValid returns true for 4 selected', () => {
      assert.ok(Roster.isPartyValid(new Set([0, 1, 2, 3])));
    });

    it('isPartyValid returns false for 0 selected', () => {
      assert.ok(!Roster.isPartyValid(new Set()));
    });

    it('isPartyValid returns false for 5 selected', () => {
      assert.ok(!Roster.isPartyValid(new Set([0, 1, 2, 3, 4])));
    });

    it('selectParty returns correct subset of roster', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      const selected = new Set([0, 2]);
      const party = Roster.selectParty(roster, selected);
      assert.equal(party.length, 2);
      assert.equal(party[0].name, roster[0].name);
      assert.equal(party[1].name, roster[2].name);
    });

    it('selectParty returns frozen array', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      const party = Roster.selectParty(roster, new Set([0]));
      assert.ok(Object.isFrozen(party));
    });

    it('selectParty preserves character order by index', () => {
      const prng = new PRNG(42);
      const roster = Roster.generateDailyRoster('2024-01-15', 'winter', prng);
      const party = Roster.selectParty(roster, new Set([3, 1]));
      assert.equal(party[0].name, roster[1].name);
      assert.equal(party[1].name, roster[3].name);
    });
  });

})();
