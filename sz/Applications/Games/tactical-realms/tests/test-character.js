;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const Character = TR.Character;
  const RACES = TR.RACES;
  const CLASSES = TR.CLASSES;
  const PRNG = TR.PRNG;

  describe('Character — Data Tables', () => {

    it('RACES has exactly 8 entries', () => {
      assert.equal(RACES.length, 8);
    });

    it('RACES is frozen', () => {
      assert.ok(Object.isFrozen(RACES));
    });

    it('each race entry is frozen', () => {
      for (const race of RACES)
        assert.ok(Object.isFrozen(race), `Race ${race.id} is not frozen`);
    });

    it('each race has required fields', () => {
      const fields = ['id', 'name', 'mods', 'size', 'speed', 'season', 'vision', 'traits'];
      for (const race of RACES)
        for (const f of fields)
          assert.ok(f in race, `Race ${race.id} missing field ${f}`);
    });

    it('each race mods object has all 6 ability keys', () => {
      const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const race of RACES)
        for (const k of keys)
          assert.typeOf(race.mods[k], 'number', `Race ${race.id} mods.${k} not a number`);
    });

    it('Human has no racial mods', () => {
      const human = RACES.find(r => r.id === 'human');
      assert.ok(human);
      const { str, dex, con, int, wis, cha } = human.mods;
      assert.equal(str + dex + con + int + wis + cha, 0);
    });

    it('Elf has +2 DEX, -2 CON', () => {
      const elf = RACES.find(r => r.id === 'elf');
      assert.ok(elf);
      assert.equal(elf.mods.dex, 2);
      assert.equal(elf.mods.con, -2);
    });

    it('Dwarf has +2 CON, -2 CHA', () => {
      const dwarf = RACES.find(r => r.id === 'dwarf');
      assert.ok(dwarf);
      assert.equal(dwarf.mods.con, 2);
      assert.equal(dwarf.mods.cha, -2);
    });

    it('Halfling has +2 DEX, -2 STR', () => {
      const halfling = RACES.find(r => r.id === 'halfling');
      assert.ok(halfling);
      assert.equal(halfling.mods.dex, 2);
      assert.equal(halfling.mods.str, -2);
    });

    it('Half-Orc has +2 STR, -2 INT', () => {
      const halfOrc = RACES.find(r => r.id === 'half-orc');
      assert.ok(halfOrc);
      assert.equal(halfOrc.mods.str, 2);
      assert.equal(halfOrc.mods.int, -2);
    });

    it('Gnome has +2 CON, -2 STR', () => {
      const gnome = RACES.find(r => r.id === 'gnome');
      assert.ok(gnome);
      assert.equal(gnome.mods.con, 2);
      assert.equal(gnome.mods.str, -2);
    });

    it('Tiefling is seasonal (autumn or winter)', () => {
      const tiefling = RACES.find(r => r.id === 'tiefling');
      assert.ok(tiefling);
      assert.ok(tiefling.season === 'autumn' || tiefling.season === 'winter',
        `Tiefling season should be autumn or winter, got ${tiefling.season}`);
    });

    it('Dragonborn is seasonal (summer)', () => {
      const dragonborn = RACES.find(r => r.id === 'dragonborn');
      assert.ok(dragonborn);
      assert.equal(dragonborn.season, 'summer');
    });

    it('Halfling and Gnome are size S', () => {
      const halfling = RACES.find(r => r.id === 'halfling');
      const gnome = RACES.find(r => r.id === 'gnome');
      assert.equal(halfling.size, 'S');
      assert.equal(gnome.size, 'S');
    });

    it('non-small races are size M', () => {
      for (const race of RACES)
        if (race.id !== 'halfling' && race.id !== 'gnome')
          assert.equal(race.size, 'M', `Race ${race.id} should be size M`);
    });

    it('CLASSES has exactly 10 entries', () => {
      assert.equal(CLASSES.length, 10);
    });

    it('CLASSES is frozen', () => {
      assert.ok(Object.isFrozen(CLASSES));
    });

    it('each class entry is frozen', () => {
      for (const cls of CLASSES)
        assert.ok(Object.isFrozen(cls), `Class ${cls.id} is not frozen`);
    });

    it('each class has required fields', () => {
      const fields = ['id', 'name', 'hitDie', 'bab', 'goodSaves', 'primaryAbility', 'caster', 'baseMP', 'season'];
      for (const cls of CLASSES)
        for (const f of fields)
          assert.ok(f in cls, `Class ${cls.id} missing field ${f}`);
    });

    it('Fighter has hitDie 10 and full BAB', () => {
      const fighter = CLASSES.find(c => c.id === 'fighter');
      assert.ok(fighter);
      assert.equal(fighter.hitDie, 10);
      assert.equal(fighter.bab, 'full');
    });

    it('Wizard has hitDie 4 and poor BAB', () => {
      const wizard = CLASSES.find(c => c.id === 'wizard');
      assert.ok(wizard);
      assert.equal(wizard.hitDie, 4);
      assert.equal(wizard.bab, 'poor');
    });

    it('Cleric has hitDie 8 and medium BAB', () => {
      const cleric = CLASSES.find(c => c.id === 'cleric');
      assert.ok(cleric);
      assert.equal(cleric.hitDie, 8);
      assert.equal(cleric.bab, 'medium');
    });

    it('Rogue has hitDie 6 and medium BAB', () => {
      const rogue = CLASSES.find(c => c.id === 'rogue');
      assert.ok(rogue);
      assert.equal(rogue.hitDie, 6);
      assert.equal(rogue.bab, 'medium');
    });

    it('Barbarian has hitDie 12 and full BAB', () => {
      const barb = CLASSES.find(c => c.id === 'barbarian');
      assert.ok(barb);
      assert.equal(barb.hitDie, 12);
      assert.equal(barb.bab, 'full');
    });

    it('Bard, Warlock, Sorcerer are premium (seasonal)', () => {
      const bard = CLASSES.find(c => c.id === 'bard');
      const warlock = CLASSES.find(c => c.id === 'warlock');
      const sorcerer = CLASSES.find(c => c.id === 'sorcerer');
      assert.ok(bard.season !== null, 'Bard should have a season');
      assert.ok(warlock.season !== null, 'Warlock should have a season');
      assert.ok(sorcerer.season !== null, 'Sorcerer should have a season');
    });

    it('free classes have null season', () => {
      const freeIds = ['fighter', 'wizard', 'cleric', 'rogue', 'ranger', 'paladin', 'barbarian'];
      for (const id of freeIds) {
        const cls = CLASSES.find(c => c.id === id);
        assert.ok(cls, `Class ${id} not found`);
        assert.isNull(cls.season, `Class ${id} should have null season`);
      }
    });

    it('caster classes have baseMP > 0', () => {
      for (const cls of CLASSES)
        if (cls.caster)
          assert.greaterThan(cls.baseMP, 0, `Caster ${cls.id} should have baseMP > 0`);
    });

    it('non-caster classes have baseMP 0', () => {
      for (const cls of CLASSES)
        if (!cls.caster)
          assert.equal(cls.baseMP, 0, `Non-caster ${cls.id} should have baseMP 0`);
    });
  });

  describe('Character — Pure Math Functions', () => {

    it('abilityMod(10) returns 0', () => {
      assert.equal(Character.abilityMod(10), 0);
    });

    it('abilityMod(11) returns 0', () => {
      assert.equal(Character.abilityMod(11), 0);
    });

    it('abilityMod(14) returns +2', () => {
      assert.equal(Character.abilityMod(14), 2);
    });

    it('abilityMod(8) returns -1', () => {
      assert.equal(Character.abilityMod(8), -1);
    });

    it('abilityMod(1) returns -5', () => {
      assert.equal(Character.abilityMod(1), -5);
    });

    it('abilityMod(20) returns +5', () => {
      assert.equal(Character.abilityMod(20), 5);
    });

    it('calcBAB full at level 1 returns 1', () => {
      assert.equal(Character.calcBAB('full', 1), 1);
    });

    it('calcBAB full at level 5 returns 5', () => {
      assert.equal(Character.calcBAB('full', 5), 5);
    });

    it('calcBAB medium at level 5 returns 3', () => {
      assert.equal(Character.calcBAB('medium', 5), 3);
    });

    it('calcBAB medium at level 1 returns 0', () => {
      assert.equal(Character.calcBAB('medium', 1), 0);
    });

    it('calcBAB poor at level 10 returns 5', () => {
      assert.equal(Character.calcBAB('poor', 10), 5);
    });

    it('calcBAB poor at level 1 returns 0', () => {
      assert.equal(Character.calcBAB('poor', 1), 0);
    });

    it('calcSave good at level 1 returns 2', () => {
      assert.equal(Character.calcSave('good', 1), 2);
    });

    it('calcSave poor at level 1 returns 0', () => {
      assert.equal(Character.calcSave('poor', 1), 0);
    });

    it('calcSave good at level 10 returns 7', () => {
      assert.equal(Character.calcSave('good', 10), 7);
    });

    it('calcSave poor at level 10 returns 3', () => {
      assert.equal(Character.calcSave('poor', 10), 3);
    });

    it('sizeBonus M returns 0', () => {
      assert.equal(Character.sizeBonus('M'), 0);
    });

    it('sizeBonus S returns 1', () => {
      assert.equal(Character.sizeBonus('S'), 1);
    });

    it('calcHP at level 1 uses full hit die', () => {
      assert.equal(Character.calcHP(10, 2, 1), 12);
    });

    it('calcHP at level 1 with negative CON mod', () => {
      assert.equal(Character.calcHP(8, -1, 1), 7);
    });

    it('calcHP at multi-level adds half die + conMod per level', () => {
      const hp = Character.calcHP(10, 2, 3);
      const lvl1 = 10 + 2;
      const perLevel = Math.max(1, Math.ceil(10 / 2) + 2);
      assert.equal(hp, lvl1 + perLevel * 2);
    });

    it('calcHP per-level minimum is 1', () => {
      // D&D 3.5e: each level grants at least 1 HP
      const hp = Character.calcHP(4, -5, 2);
      // Level 1: max(1, 4 + -5) = 1; Level 2: max(1, ceil(4/2) + -5) = 1; total = 2
      assert.equal(hp, 2);
      // Even extreme negatives can't bring total below 1
      assert.ok(Character.calcHP(4, -10, 1) >= 1, 'HP should never be less than 1');
    });

    it('calcMP returns 0 for non-casters', () => {
      const fighter = CLASSES.find(c => c.id === 'fighter');
      assert.equal(Character.calcMP(fighter, 3, 1), 0);
    });

    it('calcMP returns baseMP + mod*level for casters', () => {
      const wizard = CLASSES.find(c => c.id === 'wizard');
      const mp = Character.calcMP(wizard, 2, 3);
      assert.equal(mp, wizard.baseMP + 2 * 3);
    });

    it('calcAC sums all components with base 10', () => {
      assert.equal(Character.calcAC(2, 1, 3, 1, 1), 18);
    });

    it('calcAC with zero bonuses returns 10', () => {
      assert.equal(Character.calcAC(0, 0, 0, 0, 0), 10);
    });

    it('calcAC with negative dex returns less than 10', () => {
      assert.equal(Character.calcAC(-2, 0, 0, 0, 0), 8);
    });

    it('calcInitiative equals dexMod', () => {
      assert.equal(Character.calcInitiative(3), 3);
      assert.equal(Character.calcInitiative(-1), -1);
      assert.equal(Character.calcInitiative(0), 0);
    });
  });

  describe('Character — Factory', () => {

    it('createCharacter returns an object with all required fields', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'Test', 1, prng);
      const fields = ['name', 'race', 'class', 'level', 'stats', 'hp', 'maxHp', 'mp', 'maxMp',
        'ac', 'bab', 'saves', 'initiative', 'speed', 'size', 'vision'];
      for (const f of fields)
        assert.ok(f in char, `Missing field ${f}`);
    });

    it('createCharacter base stats are 10 + racial mods', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('elf', 'wizard', 'Elfy', 1, prng);
      assert.equal(char.stats.str, 10);
      assert.equal(char.stats.dex, 12);
      assert.equal(char.stats.con, 8);
      assert.equal(char.stats.int, 10);
      assert.equal(char.stats.wis, 10);
      assert.equal(char.stats.cha, 10);
    });

    it('createCharacter derives HP from hit die and CON mod', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'Tank', 1, prng);
      const conMod = Character.abilityMod(char.stats.con);
      assert.equal(char.hp, 10 + conMod);
      assert.equal(char.maxHp, char.hp);
    });

    it('createCharacter derives saves from class goodSaves', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const cls = CLASSES.find(c => c.id === 'fighter');
      for (const s of ['fort', 'ref', 'will']) {
        const type = cls.goodSaves.includes(s) ? 'good' : 'poor';
        assert.equal(char.saves[s], Character.calcSave(type, 1), `Save ${s} mismatch`);
      }
    });

    it('createCharacter derives BAB from class type', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.equal(char.bab, Character.calcBAB('full', 1));
    });

    it('different race/class combos produce different stats', () => {
      const prng1 = new PRNG(42);
      const prng2 = new PRNG(42);
      const fighter = Character.createCharacter('human', 'fighter', 'A', 1, prng1);
      const elfWiz = Character.createCharacter('elf', 'wizard', 'B', 1, prng2);
      assert.notEqual(fighter.hp, elfWiz.hp);
    });

    it('createCharacter returns a frozen object', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.ok(Object.isFrozen(char));
    });

    it('createCharacter sets speed from race', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('dwarf', 'fighter', 'D', 1, prng);
      const dwarf = RACES.find(r => r.id === 'dwarf');
      assert.equal(char.speed, dwarf.speed);
    });

    it('createCharacter sets size from race', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('halfling', 'rogue', 'H', 1, prng);
      assert.equal(char.size, 'S');
    });

    it('createCharacter at higher level calculates multi-level HP', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 5, prng);
      const conMod = Character.abilityMod(10);
      const expected = Character.calcHP(10, conMod, 5);
      assert.equal(char.hp, expected);
    });
  });

  describe('Character — Daily Variance', () => {

    it('applyDailyVariance changes stats by +/-1', () => {
      const prng = new PRNG(42);
      const base = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const varied = Character.applyDailyVariance(base, new PRNG(100), 'str');
      const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const a of abilities) {
        const diff = Math.abs(varied.stats[a] - base.stats[a]);
        assert.ok(diff <= 3, `Stat ${a} changed by ${diff} (expected <= 3 with bonus)`);
      }
    });

    it('bonus stat gets +2', () => {
      const prng = new PRNG(42);
      const base = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const varied = Character.applyDailyVariance(base, new PRNG(100), 'str');
      const diff = varied.stats.str - base.stats.str;
      assert.ok(diff >= 1, `Bonus stat should get at least +1 (+2 bonus + possible -1 variance), got diff ${diff}`);
    });

    it('no stat goes below 1', () => {
      const prng = new PRNG(42);
      const base = Character.createCharacter('half-orc', 'wizard', 'Orc', 1, prng);
      const varied = Character.applyDailyVariance(base, new PRNG(999), 'str');
      const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const a of abilities)
        assert.ok(varied.stats[a] >= 1, `Stat ${a} went below 1: ${varied.stats[a]}`);
    });

    it('same PRNG seed produces identical variance', () => {
      const prng = new PRNG(42);
      const base = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const v1 = Character.applyDailyVariance(base, new PRNG(500), 'dex');
      const v2 = Character.applyDailyVariance(base, new PRNG(500), 'dex');
      assert.deepEqual(v1.stats, v2.stats);
    });

    it('derived stats are recalculated after variance', () => {
      const prng = new PRNG(42);
      const base = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const varied = Character.applyDailyVariance(base, new PRNG(100), 'con');
      const conMod = Character.abilityMod(varied.stats.con);
      const expectedHp = Character.calcHP(10, conMod, 1);
      assert.equal(varied.hp, expectedHp);
      assert.equal(varied.maxHp, expectedHp);
    });

    it('applyDailyVariance returns a frozen object', () => {
      const prng = new PRNG(42);
      const base = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const varied = Character.applyDailyVariance(base, new PRNG(100), 'str');
      assert.ok(Object.isFrozen(varied));
    });
  });

  describe('Character — XP and Leveling', () => {

    // D&D 3.5e XP table: L2=1000, L3=3000, L4=6000, L5=10000, ...
    it('xpForNextLevel(1) returns 1000', () => {
      assert.equal(Character.xpForNextLevel(1), 1000);
    });

    it('xpForNextLevel(2) returns 2000', () => {
      assert.equal(Character.xpForNextLevel(2), 2000);
    });

    it('xpForNextLevel(5) returns 5000', () => {
      assert.equal(Character.xpForNextLevel(5), 5000);
    });

    it('totalXpForLevel(1) returns 0', () => {
      assert.equal(Character.totalXpForLevel(1), 0);
    });

    it('totalXpForLevel(2) returns 1000', () => {
      assert.equal(Character.totalXpForLevel(2), 1000);
    });

    it('totalXpForLevel(3) returns 3000', () => {
      assert.equal(Character.totalXpForLevel(3), 3000);
    });

    it('totalXpForLevel(4) returns 6000', () => {
      assert.equal(Character.totalXpForLevel(4), 6000);
    });

    it('levelFromXp(0) returns 1', () => {
      assert.equal(Character.levelFromXp(0), 1);
    });

    it('levelFromXp(999) returns 1', () => {
      assert.equal(Character.levelFromXp(999), 1);
    });

    it('levelFromXp(1000) returns 2', () => {
      assert.equal(Character.levelFromXp(1000), 2);
    });

    it('levelFromXp(2999) returns 2', () => {
      assert.equal(Character.levelFromXp(2999), 2);
    });

    it('levelFromXp(3000) returns 3', () => {
      assert.equal(Character.levelFromXp(3000), 3);
    });

    it('levelFromXp(6000) returns 4', () => {
      assert.equal(Character.levelFromXp(6000), 4);
    });

    it('levelFromXp and totalXpForLevel are consistent', () => {
      for (let level = 1; level <= 10; ++level) {
        const xp = Character.totalXpForLevel(level);
        assert.equal(Character.levelFromXp(xp), level, `levelFromXp(${xp}) should be ${level}`);
        if (level > 1)
          assert.equal(Character.levelFromXp(xp - 1), level - 1, `levelFromXp(${xp - 1}) should be ${level - 1}`);
      }
    });

    it('levelUp increases level by 1', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const leveled = Character.levelUp(char);
      assert.equal(leveled.level, 2);
    });

    it('levelUp recalculates HP', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const leveled = Character.levelUp(char);
      const conMod = Character.abilityMod(char.stats.con);
      const expected = Character.calcHP(10, conMod, 2);
      assert.equal(leveled.hp, expected);
      assert.equal(leveled.maxHp, expected);
    });

    it('levelUp recalculates BAB', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const leveled = Character.levelUp(char);
      assert.equal(leveled.bab, Character.calcBAB('full', 2));
    });

    it('levelUp recalculates saves', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const leveled = Character.levelUp(char);
      assert.equal(leveled.saves.fort, Character.calcSave('good', 2));
    });

    it('levelUp preserves name, race, class, stats', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('elf', 'wizard', 'Elara', 3, prng);
      const leveled = Character.levelUp(char);
      assert.equal(leveled.name, 'Elara');
      assert.equal(leveled.race, 'elf');
      assert.equal(leveled.class, 'wizard');
      assert.deepEqual(leveled.stats, char.stats);
    });

    it('levelUp returns a frozen object', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const leveled = Character.levelUp(char);
      assert.ok(Object.isFrozen(leveled));
    });

    it('levelUp returns null for null input', () => {
      assert.isNull(Character.levelUp(null));
    });

    it('levelUp can chain (level 1 → 3)', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const l2 = Character.levelUp(char);
      const l3 = Character.levelUp(l2);
      assert.equal(l3.level, 3);
      const conMod = Character.abilityMod(char.stats.con);
      assert.equal(l3.hp, Character.calcHP(10, conMod, 3));
    });

    it('levelUp recalculates MP for casters', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'wizard', 'Wiz', 1, prng);
      const leveled = Character.levelUp(char);
      assert.ok(leveled.mp > 0, 'wizard should have MP');
      assert.ok(leveled.mp >= char.mp, 'MP should not decrease on level up');
      assert.equal(leveled.maxMp, leveled.mp);
    });
  });

  describe('Character — Serialization', () => {

    it('roundtrip: deserialize(serialize(char)) deep-equals original', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('elf', 'wizard', 'Elara', 3, prng);
      const json = Character.serialize(char);
      const restored = Character.deserialize(json);
      assert.deepEqual(restored.stats, char.stats);
      assert.equal(restored.name, char.name);
      assert.equal(restored.hp, char.hp);
      assert.equal(restored.maxHp, char.maxHp);
      assert.equal(restored.mp, char.mp);
      assert.equal(restored.maxMp, char.maxMp);
      assert.equal(restored.ac, char.ac);
      assert.equal(restored.bab, char.bab);
      assert.equal(restored.level, char.level);
      assert.equal(restored.speed, char.speed);
      assert.equal(restored.size, char.size);
    });

    it('serialize returns a plain object (JSON-safe)', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'Bob', 1, prng);
      const json = Character.serialize(char);
      const str = JSON.stringify(json);
      assert.ok(str.length > 0);
      const parsed = JSON.parse(str);
      assert.equal(parsed.name, 'Bob');
    });

    it('deserialize with missing fields returns null', () => {
      const result = Character.deserialize({});
      assert.isNull(result);
    });

    it('deserialize with null returns null', () => {
      const result = Character.deserialize(null);
      assert.isNull(result);
    });

    it('deserialized character is frozen', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const restored = Character.deserialize(Character.serialize(char));
      assert.ok(Object.isFrozen(restored));
    });

    it('roundtrip preserves equipment', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const restored = Character.deserialize(Character.serialize(equipped));
      assert.ok(restored.equipment.mainHand);
      assert.equal(restored.equipment.mainHand.templateId, 'short_sword');
    });

    it('roundtrip preserves inventory', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const dagger = Items.createItem('dagger');
      const equippedAgain = Character.equip(equipped, 'mainHand', dagger);
      assert.ok(equippedAgain.inventory.length > 0);
      const restored = Character.deserialize(Character.serialize(equippedAgain));
      assert.equal(restored.inventory.length, equippedAgain.inventory.length);
    });

    it('deserialize handles missing equipment gracefully', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const data = Character.serialize(char);
      delete data.equipment;
      delete data.inventory;
      const restored = Character.deserialize(data);
      assert.ok(restored);
      assert.ok(restored.equipment);
      assert.isNull(restored.equipment.mainHand);
      assert.equal(restored.inventory.length, 0);
    });
  });

  describe('Character — Equipment Integration', () => {

    it('createCharacter includes empty equipment', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.ok(char.equipment);
      assert.isNull(char.equipment.mainHand);
      assert.isNull(char.equipment.offHand);
      assert.isNull(char.equipment.body);
      assert.isNull(char.equipment.accessory);
    });

    it('createCharacter includes empty inventory', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.isArray(char.inventory);
      assert.equal(char.inventory.length, 0);
    });

    it('equipment is frozen on new characters', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.ok(Object.isFrozen(char.equipment));
    });

    it('inventory is frozen on new characters', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.ok(Object.isFrozen(char.inventory));
    });

    it('equip places item in correct slot', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      assert.ok(equipped);
      assert.equal(equipped.equipment.mainHand.templateId, 'short_sword');
    });

    it('equip returns frozen character', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      assert.ok(Object.isFrozen(equipped));
      assert.ok(Object.isFrozen(equipped.equipment));
    });

    it('equip rejects item in wrong slot', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      assert.isNull(Character.equip(char, 'body', sword));
    });

    it('equip returns null for null character', () => {
      const Items = TR.Items;
      const sword = Items.createItem('short_sword');
      assert.isNull(Character.equip(null, 'mainHand', sword));
    });

    it('equip returns null for null item', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      assert.isNull(Character.equip(char, 'mainHand', null));
    });

    it('equip moves old item to inventory', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const dagger = Items.createItem('dagger');
      const step1 = Character.equip(char, 'mainHand', sword);
      const step2 = Character.equip(step1, 'mainHand', dagger);
      assert.equal(step2.equipment.mainHand.templateId, 'dagger');
      assert.equal(step2.inventory.length, 1);
      assert.equal(step2.inventory[0].templateId, 'short_sword');
    });

    it('equip removes item from inventory', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const dagger = Items.createItem('dagger');
      const step1 = Character.equip(char, 'mainHand', sword);
      const step2 = Character.equip(step1, 'mainHand', dagger);
      // sword is now in inventory; equip sword again from inventory
      const step3 = Character.equip(step2, 'mainHand', step2.inventory[0]);
      assert.equal(step3.equipment.mainHand.templateId, 'short_sword');
      // dagger should be in inventory (old weapon), sword removed from inventory
      assert.equal(step3.inventory.length, 1);
      assert.equal(step3.inventory[0].templateId, 'dagger');
    });

    it('equip armor increases AC', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const baseAc = char.ac;
      const armor = Items.createItem('chain_mail');
      const equipped = Character.equip(char, 'body', armor);
      assert.ok(equipped.ac > baseAc, 'AC should increase with armor');
      assert.equal(equipped.ac, baseAc + armor.stats.ac);
    });

    it('equip shield increases AC', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const baseAc = char.ac;
      const shield = Items.createItem('round_shield');
      const equipped = Character.equip(char, 'offHand', shield);
      assert.ok(equipped.ac > baseAc);
    });

    it('equip amulet of health increases maxHp', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const baseMaxHp = char.maxHp;
      const amulet = Items.createItem('amulet_of_health');
      const equipped = Character.equip(char, 'accessory', amulet);
      assert.ok(equipped.maxHp > baseMaxHp, 'maxHp should increase');
      assert.equal(equipped.maxHp, baseMaxHp + amulet.stats.maxHp);
    });

    it('equip cloak of resistance increases saves', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const baseFort = char.saves.fort;
      const cloak = Items.createItem('cloak_of_resistance');
      const equipped = Character.equip(char, 'accessory', cloak);
      assert.equal(equipped.saves.fort, baseFort + cloak.stats.fortSave);
      assert.equal(equipped.saves.ref, char.saves.ref + cloak.stats.refSave);
      assert.equal(equipped.saves.will, char.saves.will + cloak.stats.willSave);
    });

    it('equip multiple items sums all bonuses', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const baseAc = char.ac;
      const armor = Items.createItem('chain_mail');
      const shield = Items.createItem('round_shield');
      let equipped = Character.equip(char, 'body', armor);
      equipped = Character.equip(equipped, 'offHand', shield);
      assert.equal(equipped.ac, baseAc + armor.stats.ac + shield.stats.ac);
    });

    it('unequip removes item and adds to inventory', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const unequipped = Character.unequip(equipped, 'mainHand');
      assert.isNull(unequipped.equipment.mainHand);
      assert.equal(unequipped.inventory.length, 1);
      assert.equal(unequipped.inventory[0].templateId, 'short_sword');
    });

    it('unequip recalculates AC', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const baseAc = char.ac;
      const armor = Items.createItem('chain_mail');
      const equipped = Character.equip(char, 'body', armor);
      const unequipped = Character.unequip(equipped, 'body');
      assert.equal(unequipped.ac, baseAc);
    });

    it('unequip caps hp to new maxHp', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const amulet = Items.createItem('amulet_of_health');
      const equipped = Character.equip(char, 'accessory', amulet);
      // hp was capped to equipped maxHp (original hp since it was already at max)
      const unequipped = Character.unequip(equipped, 'accessory');
      assert.ok(unequipped.hp <= unequipped.maxHp, 'hp should not exceed maxHp');
      assert.equal(unequipped.maxHp, char.maxHp);
    });

    it('unequip empty slot returns same character', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const result = Character.unequip(char, 'mainHand');
      assert.equal(result, char);
    });

    it('unequip returns null for null character', () => {
      assert.isNull(Character.unequip(null, 'mainHand'));
    });

    it('unequip returns frozen character', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const unequipped = Character.unequip(equipped, 'mainHand');
      assert.ok(Object.isFrozen(unequipped));
    });

    it('levelUp preserves equipment', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const leveled = Character.levelUp(equipped);
      assert.ok(leveled.equipment.mainHand);
      assert.equal(leveled.equipment.mainHand.templateId, 'short_sword');
    });

    it('levelUp preserves inventory', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const dagger = Items.createItem('dagger');
      const step2 = Character.equip(equipped, 'mainHand', dagger);
      const leveled = Character.levelUp(step2);
      assert.equal(leveled.inventory.length, step2.inventory.length);
    });

    it('levelUp factors equipment into derived stats', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const armor = Items.createItem('chain_mail');
      const equipped = Character.equip(char, 'body', armor);
      const leveled = Character.levelUp(equipped);
      assert.ok(leveled.ac > Character.calcAC(Character.abilityMod(char.stats.dex), 0, 0, 0, 0),
        'leveled AC should include armor bonus');
    });

    it('applyDailyVariance preserves equipment', () => {
      const prng = new PRNG(42);
      const Items = TR.Items;
      const char = Character.createCharacter('human', 'fighter', 'F', 1, prng);
      const sword = Items.createItem('short_sword');
      const equipped = Character.equip(char, 'mainHand', sword);
      const varied = Character.applyDailyVariance(equipped, new PRNG(100), 'str');
      assert.ok(varied.equipment.mainHand);
      assert.equal(varied.equipment.mainHand.templateId, 'short_sword');
    });
  });

})();
