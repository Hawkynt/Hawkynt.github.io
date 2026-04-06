;(function() {
  'use strict';
  const { describe, it, afterEach, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const { Debug, Character, CLASSES, RACES, Spells, CombatEngine, PRNG } = TR;

  // The headless runner has a no-op localStorage; provide a real in-memory store for tests
  const _store = {};
  const _origGet = localStorage.getItem;
  const _origSet = localStorage.setItem;
  const _origRemove = localStorage.removeItem;

  function _installStorage() {
    localStorage.getItem = (k) => k in _store ? _store[k] : null;
    localStorage.setItem = (k, v) => { _store[k] = String(v); };
    localStorage.removeItem = (k) => { delete _store[k]; };
  }

  function _restoreStorage() {
    delete _store['sz-tactical-realms-premium'];
    localStorage.getItem = _origGet;
    localStorage.setItem = _origSet;
    localStorage.removeItem = _origRemove;
  }

  function _mockAccessor(overrides) {
    return {
      getParty: () => null,
      getPartyHp: () => null,
      getPartyXp: () => null,
      getGold: () => 0,
      getPlayerPos: () => null,
      getOverworldMap: () => null,
      getCombatEngine: () => null,
      getStateMachine: () => null,
      getRoster: () => null,
      getTimeRotation: () => null,
      getPrng: () => null,
      setParty: () => {},
      setPartyHp: () => {},
      setPartyXp: () => {},
      setGold: () => {},
      setPlayerPos: () => {},
      setRoster: () => {},
      ...overrides,
    };
  }

  describe('Debug Console', () => {

    afterEach(() => {
      _restoreStorage();
      Debug._registerController(null);
    });

    it('Debug module exists on namespace', () => {
      assert.ok(Debug);
      assert.equal(typeof Debug.help, 'function');
      assert.equal(typeof Debug.enablePremium, 'function');
      assert.equal(typeof Debug.disablePremium, 'function');
    });

    it('enablePremium sets localStorage key', () => {
      _installStorage();
      Debug.enablePremium();
      assert.equal(localStorage.getItem('sz-tactical-realms-premium'), 'true');
    });

    it('disablePremium removes localStorage key', () => {
      _installStorage();
      Debug.enablePremium();
      Debug.disablePremium();
      assert.equal(localStorage.getItem('sz-tactical-realms-premium'), null);
    });

    it('methods throw without premium', () => {
      _installStorage();
      assert.throws(() => Debug.help());
      assert.throws(() => Debug.partyInfo());
      assert.throws(() => Debug.listSpells());
      assert.throws(() => Debug.listClasses());
      assert.throws(() => Debug.listRaces());
      assert.throws(() => Debug.listEnemyTemplates());
      assert.throws(() => Debug.setGold(100));
      assert.throws(() => Debug.addGold(50));
      assert.throws(() => Debug.giveSpell(0, 'fireball'));
      assert.throws(() => Debug.removeSpell(0, 'fireball'));
      assert.throws(() => Debug.setLevel(0, 5));
    });

    it('help does not throw with premium', () => {
      _installStorage();
      Debug.enablePremium();
      const result = Debug.help();
      assert.ok(typeof result === 'string');
      assert.ok(result.includes('Debug Console'));
    });

    it('partyInfo returns null without controller', () => {
      _installStorage();
      Debug.enablePremium();
      Debug._registerController(null);
      const result = Debug.partyInfo();
      assert.equal(result, null);
    });

    it('listSpells returns all spell IDs', () => {
      _installStorage();
      Debug.enablePremium();
      const result = Debug.listSpells();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, Spells.SPELL_LIST.length);
      assert.ok(result.some(s => s.id === 'fireball'));
      assert.ok(result.some(s => s.id === 'arcane_bolt'));
    });

    it('listClasses returns all classes', () => {
      _installStorage();
      Debug.enablePremium();
      const result = Debug.listClasses();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, CLASSES.length);
      assert.ok(result.some(c => c.id === 'fighter'));
      assert.ok(result.some(c => c.id === 'wizard'));
    });

    it('listRaces returns all races', () => {
      _installStorage();
      Debug.enablePremium();
      const result = Debug.listRaces();
      assert.ok(Array.isArray(result));
      assert.equal(result.length, RACES.length);
      assert.ok(result.some(r => r.id === 'human'));
      assert.ok(result.some(r => r.id === 'elf'));
    });

    it('listEnemyTemplates returns template keys', () => {
      _installStorage();
      Debug.enablePremium();
      const result = Debug.listEnemyTemplates();
      assert.ok(Array.isArray(result));
      assert.ok(result.includes('goblin'));
      assert.ok(result.includes('skeleton'));
      assert.ok(result.includes('dark_mage'));
    });

    it('setGold changes gold value via accessor', () => {
      _installStorage();
      Debug.enablePremium();
      let gold = 0;
      Debug._registerController(_mockAccessor({
        getGold: () => gold,
        setGold: (v) => { gold = v; },
      }));
      Debug.setGold(500);
      assert.equal(gold, 500);
    });

    it('addGold adds to existing gold', () => {
      _installStorage();
      Debug.enablePremium();
      let gold = 100;
      Debug._registerController(_mockAccessor({
        getGold: () => gold,
        setGold: (v) => { gold = v; },
      }));
      Debug.addGold(250);
      assert.equal(gold, 350);
    });

    it('giveSpell adds spell to character', () => {
      _installStorage();
      Debug.enablePremium();
      const char = Character.createCharacter('human', 'fighter', 'TestHero', 1, null);
      let party = Object.freeze([char]);
      let hp = [char.maxHp];
      Debug._registerController(_mockAccessor({
        getParty: () => party,
        setParty: (v) => { party = v; },
        getPartyHp: () => hp,
        setPartyHp: (v) => { hp = v; },
      }));
      Debug.giveSpell(0, 'fireball');
      assert.ok(party[0].spells.includes('fireball'));
    });

    it('removeSpell removes spell from character', () => {
      _installStorage();
      Debug.enablePremium();
      const char = Object.freeze({ ...Character.createCharacter('human', 'wizard', 'TestMage', 1, null), spells: ['fireball', 'magic_missile'] });
      let party = Object.freeze([char]);
      let hp = [char.maxHp];
      Debug._registerController(_mockAccessor({
        getParty: () => party,
        setParty: (v) => { party = v; },
        getPartyHp: () => hp,
        setPartyHp: (v) => { hp = v; },
      }));
      Debug.removeSpell(0, 'fireball');
      assert.ok(!party[0].spells.includes('fireball'));
      assert.ok(party[0].spells.includes('magic_missile'));
    });

    it('setLevel rebuilds character at new level', () => {
      _installStorage();
      Debug.enablePremium();
      const char = Character.createCharacter('human', 'fighter', 'TestHero', 1, null);
      let party = Object.freeze([char]);
      let hp = [char.maxHp];
      Debug._registerController(_mockAccessor({
        getParty: () => party,
        setParty: (v) => { party = v; },
        getPartyHp: () => hp,
        setPartyHp: (v) => { hp = v; },
      }));
      Debug.setLevel(0, 10);
      assert.equal(party[0].level, 10);
      assert.ok(party[0].maxHp > char.maxHp);
      assert.equal(hp[0], party[0].maxHp);
    });

    it('templateToCharacter is exported on CombatEngine', () => {
      assert.ok(typeof CombatEngine.templateToCharacter === 'function');
      const prng = new PRNG(42);
      const char = CombatEngine.templateToCharacter('goblin', prng);
      assert.ok(char);
      assert.equal(char.name, 'Goblin');
      assert.equal(char.race, 'monster');
    });

  });
})();
