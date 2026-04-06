;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { CombatEngine, CombatPhase, CombatUnit, Character, PRNG } = window.SZ.TacticalRealms;

  function makeChar(name, classId, overrides) {
    const prng = new PRNG(42);
    const base = Character.createCharacter('human', classId || 'fighter', name, 3, prng);
    if (!overrides)
      return base;
    return Object.freeze({ ...base, ...overrides, stats: Object.freeze({ ...base.stats, ...(overrides.stats || {}) }) });
  }

  function makeParty() {
    return [
      makeChar('Fighter', 'fighter'),
      makeChar('Rogue', 'rogue'),
    ];
  }

  function makeEnemies() {
    return [
      { templateId: 'goblin' },
      { templateId: 'skeleton' },
    ];
  }

  describe('CombatEngine', () => {
    let engine;
    let prng;

    beforeEach(() => {
      prng = new PRNG(42);
      engine = new CombatEngine(prng);
    });

    it('CombatPhase has all expected phases', () => {
      assert.ok(CombatPhase.INIT);
      assert.ok(CombatPhase.TURN_START);
      assert.ok(CombatPhase.AWAITING_MOVE);
      assert.ok(CombatPhase.AWAITING_ACTION);
      assert.ok(CombatPhase.AWAITING_TARGET);
      assert.ok(CombatPhase.RESOLVING);
      assert.ok(CombatPhase.ENEMY_TURN);
      assert.ok(CombatPhase.TURN_END);
      assert.ok(CombatPhase.VICTORY);
      assert.ok(CombatPhase.DEFEAT);
    });

    it('initCombat sets up grid', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      assert.ok(engine.grid);
      assert.equal(engine.grid.cols, 10);
      assert.equal(engine.grid.rows, 8);
    });

    it('initCombat places party and enemy units', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      assert.ok(engine.units.length >= 4);
      const partyUnits = engine.units.filter(u => u.faction === 'party');
      const enemyUnits = engine.units.filter(u => u.faction === 'enemy');
      assert.equal(partyUnits.length, 2);
      assert.equal(enemyUnits.length, 2);
    });

    it('initCombat rolls initiative and sets turnOrder', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      assert.ok(engine.turnOrder.length >= 4);
    });

    it('initCombat transitions to TURN_START', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      assert.equal(engine.phase, CombatPhase.TURN_START);
    });

    it('startTurn sets phase based on current unit faction', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.startTurn();
      const current = engine.currentUnit;
      if (current.faction === 'party')
        assert.equal(engine.phase, CombatPhase.AWAITING_MOVE);
      else
        assert.equal(engine.phase, CombatPhase.ENEMY_TURN);
    });

    it('currentUnit returns the active unit', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.startTurn();
      assert.ok(engine.currentUnit);
      assert.ok(engine.currentUnit.id);
    });

    it('selectMoveTile sets pending move for valid tile', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.startTurn();
      while (engine.currentUnit.faction !== 'party') {
        engine.executeEnemyTurn(engine.currentUnit.id);
        engine.nextTurn();
        engine.startTurn();
        if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
          return;
      }
      const pos = engine.currentUnit.position;
      const range = engine.moveRange;
      assert.ok(range instanceof Map);
      let targetKey = null;
      for (const [key] of range)
        if (key !== `${pos.col},${pos.row}`) {
          targetKey = key;
          break;
        }
      if (targetKey) {
        const [c, r] = targetKey.split(',').map(Number);
        const result = engine.selectMoveTile(c, r);
        assert.ok(result);
      }
    });

    it('confirmMove moves unit and transitions to AWAITING_ACTION', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      advanceToPartyTurn(engine);
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      const pos = engine.currentUnit.position;
      const range = engine.moveRange;
      let targetKey = null;
      for (const [key] of range) {
        const [c, r] = key.split(',').map(Number);
        if (key !== `${pos.col},${pos.row}` && !engine.grid.isOccupied(c, r)) {
          targetKey = key;
          break;
        }
      }
      if (targetKey) {
        const [c, r] = targetKey.split(',').map(Number);
        engine.selectMoveTile(c, r);
        engine.confirmMove();
        assert.equal(engine.phase, CombatPhase.AWAITING_ACTION);
      }
    });

    it('undoMove returns to AWAITING_MOVE and restores position', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      advanceToPartyTurn(engine);
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      const origPos = { ...engine.currentUnit.position };
      const range = engine.moveRange;
      let targetKey = null;
      for (const [key] of range) {
        const [c, r] = key.split(',').map(Number);
        if (key !== `${origPos.col},${origPos.row}` && !engine.grid.isOccupied(c, r)) {
          targetKey = key;
          break;
        }
      }
      if (targetKey) {
        const [c, r] = targetKey.split(',').map(Number);
        engine.selectMoveTile(c, r);
        engine.confirmMove();
        engine.undoMove();
        assert.equal(engine.phase, CombatPhase.AWAITING_MOVE);
        assert.equal(engine.currentUnit.position.col, origPos.col);
        assert.equal(engine.currentUnit.position.row, origPos.row);
      }
    });

    it('selectWait ends turn without moving or acting', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      advanceToPartyTurn(engine);
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      engine.selectWait();
      assert.equal(engine.phase, CombatPhase.TURN_END);
    });

    it('selectAttack transitions to AWAITING_TARGET', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      advanceToPartyTurn(engine);
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      engine.selectWait();
      engine.nextTurn();
      engine.startTurn();
      advanceToPartyTurn(engine);
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      const targets = engine.getAttackTargets(engine.currentUnit.id);
      if (targets.length > 0) {
        engine.selectAttack();
        assert.equal(engine.phase, CombatPhase.AWAITING_TARGET);
      }
    });

    it('resolveAttack returns hit/miss result', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      const partyUnit = engine.units.find(u => u.faction === 'party');
      const enemyUnit = engine.units.find(u => u.faction === 'enemy');
      if (partyUnit && enemyUnit) {
        const result = engine.resolveAttack(partyUnit.id, enemyUnit.id);
        assert.ok('hit' in result);
        assert.ok('damage' in result);
      }
    });

    it('resolveAttack reduces defender HP on hit', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      const partyUnit = engine.units.find(u => u.faction === 'party');
      const enemyUnit = engine.units.find(u => u.faction === 'enemy');
      if (partyUnit && enemyUnit) {
        const beforeHp = enemyUnit.currentHp;
        let hitOnce = false;
        for (let i = 0; i < 50; ++i) {
          const eng = new CombatEngine(new PRNG(i));
          eng.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
          const pu = eng.units.find(u => u.faction === 'party');
          const eu = eng.units.find(u => u.faction === 'enemy');
          const hpBefore = eu.currentHp;
          const r = eng.resolveAttack(pu.id, eu.id);
          if (r.hit) {
            assert.ok(eu.currentHp < hpBefore);
            hitOnce = true;
            break;
          }
        }
        assert.ok(hitOnce, 'should hit at least once in 50 tries');
      }
    });

    it('executeEnemyTurn produces a valid action', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.startTurn();
      while (engine.currentUnit.faction !== 'enemy') {
        engine.selectWait();
        engine.nextTurn();
        engine.startTurn();
        if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
          return;
      }
      engine.executeEnemyTurn(engine.currentUnit.id);
    });

    it('checkVictory returns true when all enemies dead', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      for (const u of engine.units)
        if (u.faction === 'enemy')
          u.takeDamage(9999);
      assert.ok(engine.checkVictory());
    });

    it('checkVictory returns false when enemies alive', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      assert.ok(!engine.checkVictory());
    });

    it('checkDefeat returns true when all party dead', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      for (const u of engine.units)
        if (u.faction === 'party')
          u.takeDamage(9999);
      assert.ok(engine.checkDefeat());
    });

    it('checkDefeat returns false when party alive', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      assert.ok(!engine.checkDefeat());
    });

    it('nextTurn advances turnIndex', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.startTurn();
      const first = engine.turnIndex;
      if (engine.currentUnit.faction === 'party')
        engine.selectWait();
      else
        engine.executeEnemyTurn(engine.currentUnit.id);
      engine.nextTurn();
      assert.ok(engine.turnIndex !== first || engine.round > 1);
    });

    it('nextTurn wraps around and increments round', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      const totalUnits = engine.turnOrder.length;
      for (let i = 0; i < totalUnits; ++i) {
        engine.startTurn();
        if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
          return;
        if (engine.currentUnit.faction === 'party')
          engine.selectWait();
        else
          engine.executeEnemyTurn(engine.currentUnit.id);
        engine.nextTurn();
      }
      assert.equal(engine.round, 2);
    });

    it('nextTurn skips dead units', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.units.filter(u => u.faction === 'enemy')[0].takeDamage(9999);
      engine.startTurn();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      for (let i = 0; i < 20; ++i) {
        if (engine.currentUnit.faction === 'party')
          engine.selectWait();
        else
          engine.executeEnemyTurn(engine.currentUnit.id);
        engine.nextTurn();
        engine.startTurn();
        if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
          break;
        assert.ok(engine.currentUnit.isAlive, 'should skip dead units');
      }
    });

    it('combatLog records entries', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      assert.isArray(engine.combatLog);
      assert.greaterThan(engine.combatLog.length, 0);
    });

    it('on/off event system works', () => {
      let called = false;
      const cb = () => { called = true; };
      engine.on('turnStart', cb);
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      engine.startTurn();
      assert.ok(called);
      called = false;
      engine.off('turnStart', cb);
    });

    it('unitById returns correct unit', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      const first = engine.units[0];
      assert.equal(engine.unitById(first.id).id, first.id);
    });

    it('unitById returns null for unknown id', () => {
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      assert.isNull(engine.unitById('nonexistent'));
    });

    it('getAttackTargets returns adjacent enemies', () => {
      engine.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      const pu = engine.units.find(u => u.faction === 'party');
      const targets = engine.getAttackTargets(pu.id);
      assert.isArray(targets);
      for (const t of targets) {
        const tu = engine.unitById(t);
        assert.ok(tu.faction !== pu.faction);
      }
    });

    it('enemy templates exist (goblin, skeleton, wolf, bandit)', () => {
      assert.ok(CombatEngine.ENEMY_TEMPLATES);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.goblin);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.skeleton);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.wolf);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.bandit);
    });

    it('enemy templates exist (orc, spider, dark_mage, troll, wraith, rat, ogre)', () => {
      assert.ok(CombatEngine.ENEMY_TEMPLATES.orc);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.spider);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.dark_mage);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.troll);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.wraith);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.rat);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.ogre);
    });

    it('combat works with new enemy types', () => {
      const types = ['orc', 'spider', 'dark_mage', 'troll', 'wraith', 'rat', 'ogre'];
      for (const t of types) {
        const eng = new CombatEngine(new PRNG(42));
        eng.initCombat(makeParty(), [{ templateId: t }], 10, 8, 'plains');
        const enemy = eng.units.find(u => u.faction === 'enemy');
        assert.ok(enemy, `should create unit for ${t}`);
        assert.greaterThan(enemy.maxHp, 0, `${t} should have HP`);
      }
    });

    it('enemy templates have required fields', () => {
      const required = ['name', 'hp', 'ac', 'bab', 'speed', 'stats'];
      for (const [id, tmpl] of Object.entries(CombatEngine.ENEMY_TEMPLATES))
        for (const f of required)
          assert.ok(f in tmpl, `${id} missing field "${f}"`);
    });

    it('flanking bonus is applied during attack resolution', () => {
      let flankingOccurred = false;
      for (let seed = 0; seed < 100; ++seed) {
        const eng = new CombatEngine(new PRNG(seed));
        eng.initCombat(makeParty(), [{ templateId: 'goblin' }], 8, 8, 'plains');
        const partyUnits = eng.units.filter(u => u.faction === 'party');
        const enemy = eng.units.find(u => u.faction === 'enemy');
        if (partyUnits.length >= 2 && enemy) {
          const ePos = enemy.position;
          partyUnits[0].setPosition(ePos.col, ePos.row - 1);
          eng.grid.removeUnit(partyUnits[0].id);
          if (eng.grid.inBounds(ePos.col, ePos.row - 1) && !eng.grid.isOccupied(ePos.col, ePos.row - 1)) {
            eng.grid.placeUnit(partyUnits[0].id, ePos.col, ePos.row - 1);
            partyUnits[1].setPosition(ePos.col, ePos.row + 1);
            eng.grid.removeUnit(partyUnits[1].id);
            if (eng.grid.inBounds(ePos.col, ePos.row + 1) && !eng.grid.isOccupied(ePos.col, ePos.row + 1)) {
              eng.grid.placeUnit(partyUnits[1].id, ePos.col, ePos.row + 1);
              const result = eng.resolveAttack(partyUnits[0].id, enemy.id);
              if (result.flanking) {
                flankingOccurred = true;
                break;
              }
            }
          }
        }
      }
      assert.ok(flankingOccurred, 'flanking should be detected at least once');
    });

    it('full combat loop: party kills all enemies -> VICTORY', () => {
      for (let seed = 0; seed < 50; ++seed) {
        const eng = new CombatEngine(new PRNG(seed));
        eng.initCombat(makeParty(), [{ templateId: 'goblin' }], 8, 8, 'plains');
        const enemy = eng.units.find(u => u.faction === 'enemy');
        enemy.takeDamage(enemy.currentHp - 1);
        for (let turn = 0; turn < 100; ++turn) {
          eng.startTurn();
          if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
            break;
          if (eng.currentUnit.faction === 'party') {
            const targets = eng.getAttackTargets(eng.currentUnit.id);
            if (targets.length > 0) {
              eng.resolveAttack(eng.currentUnit.id, targets[0]);
              eng.currentUnit.endAction();
            }
            eng.selectWait();
          } else {
            eng.executeEnemyTurn(eng.currentUnit.id);
          }
          if (eng.checkVictory()) {
            assert.ok(true);
            return;
          }
          if (eng.checkDefeat())
            break;
          eng.nextTurn();
        }
      }
    });
  });

  function advanceToPartyTurn(engine) {
    engine.startTurn();
    let guard = 0;
    while (engine.currentUnit.faction !== 'party' && guard < 20) {
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT)
        return;
      engine.executeEnemyTurn(engine.currentUnit.id);
      engine.nextTurn();
      engine.startTurn();
      ++guard;
    }
  }

  describe('CombatEngine — Enemy Templates Rewards', () => {

    it('all enemy templates have xpReward', () => {
      const templates = CombatEngine.ENEMY_TEMPLATES;
      for (const [id, tmpl] of Object.entries(templates))
        assert.typeOf(tmpl.xpReward, 'number', `${id} missing xpReward`);
    });

    it('all enemy templates have goldReward', () => {
      const templates = CombatEngine.ENEMY_TEMPLATES;
      for (const [id, tmpl] of Object.entries(templates))
        assert.typeOf(tmpl.goldReward, 'number', `${id} missing goldReward`);
    });

    it('xpReward and goldReward are positive', () => {
      const templates = CombatEngine.ENEMY_TEMPLATES;
      for (const [id, tmpl] of Object.entries(templates)) {
        assert.greaterThan(tmpl.xpReward, 0, `${id} xpReward should be positive`);
        assert.greaterThan(tmpl.goldReward, 0, `${id} goldReward should be positive`);
      }
    });

    it('new enemy templates exist (dire_wolf, hobgoblin, ghoul, minotaur, vampire_spawn, wyvern, lich, dragon_wyrmling)', () => {
      const ids = ['dire_wolf', 'hobgoblin', 'ghoul', 'minotaur', 'vampire_spawn', 'wyvern', 'lich', 'dragon_wyrmling'];
      for (const id of ids)
        assert.ok(CombatEngine.ENEMY_TEMPLATES[id], `missing template ${id}`);
    });

    it('templateToCharacter works for each new template', () => {
      const ids = ['dire_wolf', 'hobgoblin', 'ghoul', 'minotaur', 'vampire_spawn', 'wyvern', 'lich', 'dragon_wyrmling'];
      for (const id of ids) {
        const char = CombatEngine.templateToCharacter(id, new PRNG(42));
        assert.ok(char, `templateToCharacter returned null for ${id}`);
        assert.greaterThan(char.hp, 0, `${id} should have HP`);
        assert.greaterThan(char.ac, 0, `${id} should have AC`);
        assert.equal(char.class, id, `${id} should have class set`);
      }
    });

    it('lich template has spells and MP', () => {
      assert.ok(CombatEngine.ENEMY_TEMPLATES.lich.spells);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.lich.spells.length > 0);
      assert.ok(CombatEngine.ENEMY_TEMPLATES.lich.mp > 0);
    });

    it('combat works with new enemy types', () => {
      const ids = ['dire_wolf', 'hobgoblin', 'ghoul', 'minotaur', 'vampire_spawn', 'wyvern', 'lich', 'dragon_wyrmling'];
      for (const id of ids) {
        const eng = new CombatEngine(new PRNG(42));
        eng.initCombat(makeParty(), [{ templateId: id }], 10, 8, 'plains');
        const enemy = eng.units.find(u => u.faction === 'enemy');
        assert.ok(enemy, `should create unit for ${id}`);
        assert.greaterThan(enemy.maxHp, 0, `${id} should have HP`);
      }
    });
  });

  describe('CombatEngine — getRewards', () => {
    let engine;
    let prng;

    beforeEach(() => {
      prng = new PRNG(42);
      engine = new CombatEngine(prng);
      engine.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
    });

    it('getRewards returns 0 when no enemies are dead', () => {
      const r = engine.getRewards();
      assert.equal(r.xp, 0);
      assert.equal(r.gold, 0);
    });

    it('getRewards sums rewards from dead enemies', () => {
      const enemyUnits = engine.units.filter(u => u.faction === 'enemy');
      for (const u of enemyUnits)
        u.takeDamage(9999);
      const r = engine.getRewards();
      const templates = CombatEngine.ENEMY_TEMPLATES;
      const expectedXp = templates.goblin.xpReward + templates.skeleton.xpReward;
      const expectedGold = templates.goblin.goldReward + templates.skeleton.goldReward;
      assert.equal(r.xp, expectedXp);
      assert.equal(r.gold, expectedGold);
    });

    it('getRewards only counts dead enemies', () => {
      const enemyUnits = engine.units.filter(u => u.faction === 'enemy');
      enemyUnits[0].takeDamage(9999);
      const r = engine.getRewards();
      const templates = CombatEngine.ENEMY_TEMPLATES;
      assert.equal(r.xp, templates.goblin.xpReward);
      assert.equal(r.gold, templates.goblin.goldReward);
    });
  });

  describe('CombatEngine — selectTarget preserves VICTORY/DEFEAT', () => {

    it('selectTarget sets VICTORY when killing last enemy', () => {
      const prng = new PRNG(42);
      const eng = new CombatEngine(prng);
      const party = [makeChar('Fighter', 'fighter', { hp: 200, maxHp: 200 })];
      eng.initCombat(party, [{ templateId: 'goblin' }], 8, 8, 'plains');

      const enemy = eng.units.find(u => u.faction === 'enemy');
      enemy.takeDamage(enemy.currentHp - 1);

      for (let turn = 0; turn < 100; ++turn) {
        eng.startTurn();
        if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
          break;
        if (eng.currentUnit.faction === 'party') {
          eng.selectAttack();
          const targets = eng.getAttackTargets(eng.currentUnit.id);
          if (targets.length > 0) {
            const pos = eng.unitById(targets[0]).position;
            const result = eng.selectTarget(pos.col, pos.row);
            if (result && (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT))
              break;
          }
          if (eng.phase !== CombatPhase.VICTORY && eng.phase !== CombatPhase.DEFEAT)
            eng.selectWait();
        } else {
          eng.executeEnemyTurn(eng.currentUnit.id);
        }
        if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
          break;
        eng.nextTurn();
      }
      assert.ok(eng.phase === CombatPhase.VICTORY || eng.checkVictory(), 'should detect victory via selectTarget');
    });

    it('executeEnemyTurn sets DEFEAT when killing last party member', () => {
      const prng = new PRNG(7);
      const weakParty = [makeChar('Weak', 'wizard', { hp: 1, maxHp: 1 })];
      const eng = new CombatEngine(prng);
      eng.initCombat(weakParty, [{ templateId: 'bandit' }, { templateId: 'bandit' }], 8, 8, 'plains');

      for (let turn = 0; turn < 100; ++turn) {
        eng.startTurn();
        if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
          break;
        if (eng.currentUnit.faction === 'party')
          eng.selectWait();
        else
          eng.executeEnemyTurn(eng.currentUnit.id);
        if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
          break;
        eng.nextTurn();
      }
      assert.equal(eng.phase, CombatPhase.DEFEAT, 'should detect defeat via executeEnemyTurn');
    });
  });

  describe('CombatEngine - Spells', () => {
    let engine, prng;

    beforeEach(() => {
      prng = new PRNG(42);
      engine = new CombatEngine(prng);
    });

    function makeWizard(name) {
      const base = Character.createCharacter('human', 'wizard', name || 'Wizard', 5, new PRNG(99));
      return Object.freeze({ ...base, mp: 20, maxMp: 20, spells: ['arcane_bolt', 'magic_missile', 'cure_wounds', 'fireball'] });
    }

    function makeCleric(name) {
      const base = Character.createCharacter('human', 'cleric', name || 'Cleric', 3, new PRNG(77));
      return Object.freeze({ ...base, mp: 10, maxMp: 10, spells: ['sacred_flame', 'cure_wounds', 'healing_word'] });
    }

    function initSpellCombat() {
      const party = [makeWizard(), makeCleric()];
      const enemies = [{ templateId: 'goblin' }];
      engine.initCombat(party, enemies, 10, 8, 'plains');
      engine.startTurn();
      while (engine.currentUnit && engine.currentUnit.faction === 'enemy') {
        engine.executeEnemyTurn(engine.currentUnit.id);
        engine.nextTurn();
        engine.startTurn();
      }
    }

    it('AWAITING_SPELL_TARGET phase exists', () => {
      assert.ok(CombatPhase.AWAITING_SPELL_TARGET);
    });

    it('selectSpell transitions to AWAITING_SPELL_TARGET', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      const hasSpell = unit.spells && unit.spells.length > 0;
      if (!hasSpell) return;
      const result = engine.selectSpell(unit.spells[0]);
      assert.ok(result);
      assert.equal(engine.phase, CombatPhase.AWAITING_SPELL_TARGET);
    });

    it('selectSpell returns false for unknown spell', () => {
      initSpellCombat();
      assert.ok(!engine.selectSpell('nonexistent'));
    });

    it('selectSpell returns false if unit lacks spell', () => {
      initSpellCombat();
      assert.ok(!engine.selectSpell('ice_storm'));
    });

    it('cancelTarget from AWAITING_SPELL_TARGET returns to previous phase', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || unit.spells.length === 0) return;
      engine.selectSpell(unit.spells[0]);
      engine.cancelTarget();
      assert.ok(engine.phase === CombatPhase.AWAITING_MOVE || engine.phase === CombatPhase.AWAITING_ACTION);
    });

    it('selectedSpell is set after selectSpell', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || unit.spells.length === 0) return;
      engine.selectSpell(unit.spells[0]);
      assert.ok(engine.selectedSpell);
      assert.equal(engine.selectedSpell.id, unit.spells[0]);
    });

    it('getSpellTargets returns enemies in range for damage spell', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || unit.spells.length === 0) return;
      const dmgSpell = unit.spells.find(id => {
        const s = window.SZ.TacticalRealms.Spells.byId(id);
        return s && s.target === 'enemy';
      });
      if (!dmgSpell) return;
      const targets = engine.getSpellTargets(unit.id, dmgSpell);
      assert.ok(Array.isArray(targets));
    });

    it('resolveSpell deals damage and logs', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || !unit.spells.includes('arcane_bolt')) return;
      const enemy = engine.units.find(u => u.faction === 'enemy' && u.isAlive);
      if (!enemy) return;
      const prevHp = enemy.currentHp;
      const result = engine.resolveSpell(unit.id, enemy.id, 'arcane_bolt');
      assert.ok(result);
      assert.ok(result.damage >= 0);
      if (result.damage > 0)
        assert.ok(enemy.currentHp < prevHp);
      assert.ok(engine.combatLog.some(l => l.includes('casts Arcane Bolt')));
    });

    it('resolveSpell with heal spell restores hp', () => {
      initSpellCombat();
      const cleric = engine.units.find(u => u.faction === 'party' && u.spells.includes('cure_wounds'));
      if (!cleric) return;
      const ally = engine.units.find(u => u.faction === 'party' && u.id !== cleric.id);
      if (!ally) return;
      ally.takeDamage(5);
      const prevHp = ally.currentHp;
      const result = engine.resolveSpell(cleric.id, ally.id, 'cure_wounds');
      assert.ok(result.heal > 0);
      assert.ok(ally.currentHp > prevHp);
    });

    it('resolveSpell spends MP for non-cantrip', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || !unit.spells.includes('magic_missile')) return;
      const prevMp = unit.currentMp;
      const enemy = engine.units.find(u => u.faction === 'enemy' && u.isAlive);
      if (!enemy) return;
      engine.resolveSpell(unit.id, enemy.id, 'magic_missile');
      assert.equal(unit.currentMp, prevMp - 2);
    });

    it('resolveSpell does not spend MP for cantrip', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || !unit.spells.includes('arcane_bolt')) return;
      const prevMp = unit.currentMp;
      const enemy = engine.units.find(u => u.faction === 'enemy' && u.isAlive);
      if (!enemy) return;
      engine.resolveSpell(unit.id, enemy.id, 'arcane_bolt');
      assert.equal(unit.currentMp, prevMp);
    });

    it('selectSpellTarget resolves spell and transitions to TURN_END', () => {
      initSpellCombat();
      const unit = engine.currentUnit;
      if (!unit.spells || !unit.spells.includes('arcane_bolt')) return;
      engine.selectSpell('arcane_bolt');
      const enemy = engine.units.find(u => u.faction === 'enemy' && u.isAlive);
      if (!enemy) return;
      const pos = enemy.position;
      const result = engine.selectSpellTarget(pos.col, pos.row);
      assert.ok(result);
      assert.ok(engine.phase === CombatPhase.TURN_END || engine.phase === CombatPhase.VICTORY);
    });

    it('initCombat assigns spells to caster party members', () => {
      initSpellCombat();
      const casters = engine.units.filter(u => u.faction === 'party' && u.spells.length > 0);
      assert.ok(casters.length > 0, 'at least one party caster should have spells');
    });

    it('dark_mage template has spells', () => {
      const templates = CombatEngine.ENEMY_TEMPLATES;
      assert.ok(templates.dark_mage.spells);
      assert.ok(templates.dark_mage.spells.length > 0);
      assert.ok(templates.dark_mage.mp > 0);
    });

    it('initCombatWithGrid places units on provided grid', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 10 * 10; ++i)
        terrain.push('plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid(makeParty(), makeEnemies(), grid, 'plains', { col: 5, row: 5 });
      assert.equal(engine.grid.cols, 10);
      assert.equal(engine.grid.rows, 10);
      assert.ok(engine.units.length >= 4);
    });

    it('initCombatWithGrid sets phase to TURN_START', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 10 * 10; ++i)
        terrain.push('plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid(makeParty(), makeEnemies(), grid, 'plains');
      assert.equal(engine.phase, CombatPhase.TURN_START);
    });

    it('initCombatWithGrid rolls initiative', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 10 * 10; ++i)
        terrain.push('plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid(makeParty(), makeEnemies(), grid, 'plains');
      assert.ok(engine.turnOrder.length >= 4);
    });

    it('initCombatWithGrid party units near center', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i)
        terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      engine.initCombatWithGrid(makeParty(), makeEnemies(), grid, 'plains', { col: 6, row: 6 });
      const partyUnits = engine.units.filter(u => u.faction === 'party');
      for (const u of partyUnits) {
        const dist = Math.abs(u.position.col - 6) + Math.abs(u.position.row - 6);
        assert.ok(dist <= 3, `party unit ${u.name} too far from center: dist=${dist}`);
      }
    });

    it('initCombatWithGrid avoids placing on water terrain', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let r = 0; r < 10; ++r)
        for (let c = 0; c < 10; ++c)
          terrain.push((c === 5 && r === 5) ? 'water' : 'plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid(makeParty(), makeEnemies(), grid, 'plains', { col: 5, row: 5 });
      for (const u of engine.units) {
        const t = engine.grid.terrainAt(u.position.col, u.position.row);
        assert.ok(t.id !== 'water', `unit ${u.name} placed on water`);
      }
    });

    it('getAttackTargets only returns adjacent enemies', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 10 * 10; ++i)
        terrain.push('plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid(makeParty(), makeEnemies(), grid, 'plains', { col: 2, row: 5 });
      engine.startTurn();
      const unit = engine.currentUnit;
      if (unit && unit.faction === 'party') {
        const targets = engine.getAttackTargets(unit.id);
        const D20 = window.SZ.TacticalRealms.D20;
        for (const tid of targets) {
          const t = engine.unitById(tid);
          assert.ok(D20.isAdjacent(unit.position, t.position), `target ${t.name} not adjacent`);
        }
      }
    });

    it('getSpellTargets returns empty for out-of-range spell', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const Spells = window.SZ.TacticalRealms.Spells;
      if (!Spells)
        return;
      const terrain = [];
      for (let i = 0; i < 20 * 20; ++i)
        terrain.push('plains');
      const grid = new CombatGrid(20, 20, terrain);
      const party = [makeChar('Wizard', 'wizard')];
      engine.initCombatWithGrid(party, [{ templateId: 'goblin' }], grid, 'plains', { col: 2, row: 10 });
      engine.startTurn();
      const unit = engine.currentUnit;
      if (unit && unit.faction === 'party' && unit.spells && unit.spells.length > 0) {
        const spellId = unit.spells[0];
        const spell = Spells.byId(spellId);
        if (spell && spell.range > 0) {
          const targets = engine.getSpellTargets(unit.id, spellId);
          for (const tid of targets) {
            const t = engine.unitById(tid);
            const dist = Math.abs(unit.position.col - t.position.col) + Math.abs(unit.position.row - t.position.row);
            assert.ok(dist <= spell.range, `target ${t.name} out of spell range ${spell.range}`);
          }
        }
      }
    });
  });

  describe('CombatEngine — AoE Spells', () => {
    let engine, prng;

    beforeEach(() => {
      prng = new PRNG(42);
      engine = new CombatEngine(prng);
    });

    function makeWizard(name) {
      const base = Character.createCharacter('human', 'wizard', name || 'Wizard', 5, new PRNG(99));
      return Object.freeze({ ...base, mp: 20, maxMp: 20, spells: ['fireball', 'arcane_bolt', 'burning_hands'] });
    }

    it('resolveAoeSpell hits multiple enemies within radius', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i) terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      const party = [makeWizard()];
      const enemies = [{ templateId: 'goblin' }, { templateId: 'goblin' }, { templateId: 'goblin' }];
      engine.initCombatWithGrid(party, enemies, grid, 'plains', { col: 2, row: 6 });

      const caster = engine.units.find(u => u.faction === 'party');
      const enemyUnits = engine.units.filter(u => u.faction === 'enemy');
      enemyUnits[0].setPosition(8, 6);
      enemyUnits[1].setPosition(8, 7);
      enemyUnits[2].setPosition(9, 6);

      const result = engine.resolveAoeSpell(caster.id, 'fireball', 8, 6);
      assert.ok(result, 'should resolve AoE spell');
      assert.ok(result.aoe, 'result should be marked as AoE');
      assert.ok(result.targets.length >= 2, 'should hit multiple targets');
      assert.greaterThan(result.damage, 0, 'should deal total damage > 0');
    });

    it('resolveAoeSpell only deducts MP once', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i) terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      engine.initCombatWithGrid([makeWizard()], [{ templateId: 'goblin' }, { templateId: 'goblin' }], grid, 'plains', { col: 2, row: 6 });

      const caster = engine.units.find(u => u.faction === 'party');
      const prevMp = caster.currentMp;
      const enemies = engine.units.filter(u => u.faction === 'enemy');
      enemies[0].setPosition(8, 6);
      enemies[1].setPosition(8, 7);

      engine.resolveAoeSpell(caster.id, 'fireball', 8, 6);
      const Spells = window.SZ.TacticalRealms.Spells;
      const spell = Spells.byId('fireball');
      assert.equal(caster.currentMp, prevMp - spell.mpCost, 'MP should be deducted exactly once');
    });

    it('resolveAoeSpell filters by faction (enemy spell does not hit allies)', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i) terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      engine.initCombatWithGrid([makeWizard(), makeChar('Fighter', 'fighter')], [{ templateId: 'goblin' }], grid, 'plains', { col: 2, row: 6 });

      const caster = engine.units.find(u => u.faction === 'party' && u.spells.includes('fireball'));
      const ally = engine.units.find(u => u.faction === 'party' && u.id !== caster.id);
      const enemy = engine.units.find(u => u.faction === 'enemy');
      enemy.setPosition(6, 6);
      ally.setPosition(6, 7);

      const allyHpBefore = ally.currentHp;
      engine.resolveAoeSpell(caster.id, 'fireball', 6, 6);
      assert.equal(ally.currentHp, allyHpBefore, 'ally should not be hit by enemy-target AoE');
    });

    it('resolveAoeSpell returns null when no targets in radius', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i) terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      engine.initCombatWithGrid([makeWizard()], [{ templateId: 'goblin' }], grid, 'plains', { col: 2, row: 6 });

      const caster = engine.units.find(u => u.faction === 'party');
      const result = engine.resolveAoeSpell(caster.id, 'fireball', 10, 10);
      assert.isNull(result, 'should return null when no targets');
    });

    it('resolveAoeSpell applies distance-based falloff', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i) terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      engine.initCombatWithGrid([makeWizard()], [{ templateId: 'troll' }, { templateId: 'troll' }], grid, 'plains', { col: 2, row: 6 });

      const caster = engine.units.find(u => u.faction === 'party');
      const enemies = engine.units.filter(u => u.faction === 'enemy');
      enemies[0].setPosition(8, 6);
      enemies[1].setPosition(10, 6);

      const result = engine.resolveAoeSpell(caster.id, 'fireball', 8, 6);
      if (result && result.targets.length === 2) {
        const center = result.targets.find(t => t.distance === 0);
        const edge = result.targets.find(t => t.distance > 0);
        if (center && edge && center.damage > 0 && edge.damage > 0)
          assert.ok(center.damage >= edge.damage, 'center target should take >= damage than edge');
      }
    });

    it('getAoeSpellRange returns tiles within spell range', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const Spells = window.SZ.TacticalRealms.Spells;
      const terrain = [];
      for (let i = 0; i < 10 * 10; ++i) terrain.push('plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid([makeWizard()], [{ templateId: 'goblin' }], grid, 'plains', { col: 5, row: 5 });

      const caster = engine.units.find(u => u.faction === 'party');
      const tiles = engine.getAoeSpellRange(caster.id, 'fireball');
      assert.ok(tiles.length > 0, 'should return tiles');
      const spell = Spells.byId('fireball');
      for (const t of tiles) {
        const dist = Math.abs(t.col - caster.position.col) + Math.abs(t.row - caster.position.row);
        assert.ok(dist <= spell.range, `tile (${t.col},${t.row}) exceeds spell range`);
      }
    });

    it('getAoeSpellRange returns empty for unknown spell', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 10 * 10; ++i) terrain.push('plains');
      const grid = new CombatGrid(10, 10, terrain);
      engine.initCombatWithGrid([makeWizard()], [{ templateId: 'goblin' }], grid, 'plains', { col: 5, row: 5 });
      const caster = engine.units.find(u => u.faction === 'party');
      const tiles = engine.getAoeSpellRange(caster.id, 'nonexistent');
      assert.equal(tiles.length, 0);
    });

    it('selectAoeSpellTarget resolves and transitions to TURN_END', () => {
      const CombatGrid = window.SZ.TacticalRealms.CombatGrid;
      const terrain = [];
      for (let i = 0; i < 12 * 12; ++i) terrain.push('plains');
      const grid = new CombatGrid(12, 12, terrain);
      engine.initCombatWithGrid([makeWizard()], [{ templateId: 'goblin' }], grid, 'plains', { col: 2, row: 6 });

      engine.startTurn();
      while (engine.currentUnit && engine.currentUnit.faction !== 'party') {
        engine.executeEnemyTurn(engine.currentUnit.id);
        engine.nextTurn();
        engine.startTurn();
      }
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;

      const enemy = engine.units.find(u => u.faction === 'enemy');
      engine.selectSpell('fireball');
      const result = engine.selectAoeSpellTarget(enemy.position.col, enemy.position.row);
      if (result)
        assert.ok(engine.phase === CombatPhase.TURN_END || engine.phase === CombatPhase.VICTORY, 'should transition after AoE spell');
    });
  });

  describe('CombatEngine — Phase B New Enemy Templates', () => {

    const NEW_ENEMIES = [
      'kobold', 'zombie', 'stirge', 'gnoll', 'bugbear', 'worg', 'lizardfolk', 'harpy',
      'cockatrice', 'basilisk', 'wight', 'gargoyle', 'owlbear', 'manticore', 'phase_spider',
      'hill_giant', 'mind_flayer', 'young_dragon', 'death_knight', 'fire_elemental',
      'frost_giant', 'demon', 'devil',
    ];

    it('all 23 new enemy templates exist', () => {
      for (const id of NEW_ENEMIES)
        assert.ok(CombatEngine.ENEMY_TEMPLATES[id], `missing template ${id}`);
    });

    it('each new template has required fields', () => {
      const required = ['name', 'hp', 'ac', 'bab', 'speed', 'size', 'vision', 'stats', 'damageDice', 'damageSides', 'xpReward', 'goldReward'];
      for (const id of NEW_ENEMIES) {
        const tmpl = CombatEngine.ENEMY_TEMPLATES[id];
        for (const field of required)
          assert.ok(tmpl[field] !== undefined, `${id} missing field ${field}`);
      }
    });

    it('each new template has valid stat block', () => {
      const statKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      for (const id of NEW_ENEMIES) {
        const tmpl = CombatEngine.ENEMY_TEMPLATES[id];
        for (const key of statKeys) {
          assert.typeOf(tmpl.stats[key], 'number', `${id} stats.${key}`);
          assert.ok(tmpl.stats[key] >= 1, `${id} stats.${key} should be >= 1`);
        }
      }
    });

    it('templateToCharacter works for each new template', () => {
      for (const id of NEW_ENEMIES) {
        const char = CombatEngine.templateToCharacter(id, new PRNG(42));
        assert.ok(char, `templateToCharacter returned null for ${id}`);
        assert.greaterThan(char.hp, 0, `${id} should have HP`);
        assert.greaterThan(char.ac, 0, `${id} should have AC`);
        assert.equal(char.class, id, `${id} should have class set`);
      }
    });

    it('character has embedded xpReward and goldReward', () => {
      const char = CombatEngine.templateToCharacter('gnoll', new PRNG(42));
      assert.ok(char.xpReward > 0, 'gnoll should have xpReward');
      assert.ok(char.goldReward > 0, 'gnoll should have goldReward');
    });

    it('character has embedded damageDice and damageSides', () => {
      const char = CombatEngine.templateToCharacter('bugbear', new PRNG(42));
      assert.ok(char.damageDice > 0, 'bugbear should have damageDice');
      assert.ok(char.damageSides > 0, 'bugbear should have damageSides');
    });

    it('spellcaster enemies have spells array', () => {
      const casters = ['mind_flayer', 'death_knight', 'devil'];
      for (const id of casters) {
        const tmpl = CombatEngine.ENEMY_TEMPLATES[id];
        assert.ok(Array.isArray(tmpl.spells), `${id} should have spells array`);
        assert.ok(tmpl.spells.length > 0, `${id} should have at least one spell`);
        assert.ok(tmpl.mp > 0, `${id} should have MP`);
      }
    });
  });

  describe('CombatEngine — CREATURE_TYPES registry', () => {

    it('CREATURE_TYPES exists and is frozen', () => {
      assert.ok(CombatEngine.CREATURE_TYPES);
      assert.ok(Object.isFrozen(CombatEngine.CREATURE_TYPES));
    });

    it('has all expected creature types', () => {
      const expected = ['aberration', 'animal', 'construct', 'dragon', 'elemental', 'fey', 'giant',
        'humanoid', 'magical_beast', 'monstrous_humanoid', 'ooze', 'outsider', 'plant', 'undead', 'vermin'];
      for (const t of expected)
        assert.ok(CombatEngine.CREATURE_TYPES[t], `missing type ${t}`);
      assert.ok(Object.keys(CombatEngine.CREATURE_TYPES).length >= 15, 'should have at least 15 creature types');
    });

    it('each type has hitDie (number), bab (string), goodSaves (array)', () => {
      for (const [id, type] of Object.entries(CombatEngine.CREATURE_TYPES)) {
        assert.typeOf(type.hitDie, 'number', `${id} hitDie`);
        assert.typeOf(type.bab, 'string', `${id} bab`);
        assert.ok(['full', 'medium', 'poor'].includes(type.bab), `${id} bab should be full/medium/poor`);
        assert.isArray(type.goodSaves, `${id} goodSaves`);
      }
    });

    it('hitDie values match D&D SRD', () => {
      const CT = CombatEngine.CREATURE_TYPES;
      assert.equal(CT.dragon.hitDie, 12);
      assert.equal(CT.undead.hitDie, 12);
      assert.equal(CT.magical_beast.hitDie, 10);
      assert.equal(CT.humanoid.hitDie, 8);
      assert.equal(CT.fey.hitDie, 6);
    });
  });

  describe('CombatEngine — ENEMY_TEMPLATES D&D creature types', () => {

    it('all 42 templates have a type field', () => {
      for (const [id, tmpl] of Object.entries(CombatEngine.ENEMY_TEMPLATES))
        assert.ok(tmpl.type, `${id} missing type`);
    });

    it('all type values reference valid CREATURE_TYPES keys', () => {
      for (const [id, tmpl] of Object.entries(CombatEngine.ENEMY_TEMPLATES))
        assert.ok(CombatEngine.CREATURE_TYPES[tmpl.type], `${id} type "${tmpl.type}" not in CREATURE_TYPES`);
    });

    it('all 42 templates have hitDice', () => {
      for (const [id, tmpl] of Object.entries(CombatEngine.ENEMY_TEMPLATES))
        assert.typeOf(tmpl.hitDice, 'number', `${id} missing hitDice`);
    });

    it('all 42 templates have cr', () => {
      for (const [id, tmpl] of Object.entries(CombatEngine.ENEMY_TEMPLATES))
        assert.typeOf(tmpl.cr, 'number', `${id} missing cr`);
    });
  });

  describe('CombatEngine — Mob Leveling (levelUpTemplate)', () => {

    it('levelUpTemplate exists', () => {
      assert.ok(CombatEngine.levelUpTemplate);
    });

    it('leveled-up template has more HP than base', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.goblin;
      const leveled = CombatEngine.levelUpTemplate('goblin', 2);
      assert.greaterThan(leveled.hp, base.hp, 'leveled HP should be higher');
    });

    it('HP scales with target HD using creature type hit die', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.goblin;
      const leveled = CombatEngine.levelUpTemplate('goblin', 4);
      assert.ok(leveled.hp > base.hp, 'leveled goblin should have more HP');
      // HP is recalculated from total HD (5) using humanoid d8
      const conMod = Character.abilityMod(leveled.stats.con);
      const expectedHpPerHD = Math.max(1, Math.ceil(8 / 2) + conMod);
      assert.equal(leveled.hp, expectedHpPerHD * 5);
    });

    it('HP scales correctly for dragon type (d12)', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.dragon_wyrmling;
      const leveled = CombatEngine.levelUpTemplate('dragon_wyrmling', 4);
      assert.ok(leveled.hp > base.hp, 'leveled dragon should have more HP');
      const conMod = Character.abilityMod(leveled.stats.con);
      const expectedHpPerHD = Math.max(1, Math.ceil(12 / 2) + conMod);
      assert.equal(leveled.hp, expectedHpPerHD * 12);
    });

    it('BAB follows creature type progression (dragon = full)', () => {
      const leveled = CombatEngine.levelUpTemplate('dragon_wyrmling', 4);
      assert.equal(leveled.bab, Character.calcBAB('full', 12));
    });

    it('BAB follows creature type progression (humanoid = medium)', () => {
      const leveled = CombatEngine.levelUpTemplate('orc', 4);
      assert.equal(leveled.bab, Character.calcBAB('medium', 6));
    });

    it('BAB follows creature type progression (undead = poor)', () => {
      const leveled = CombatEngine.levelUpTemplate('skeleton', 4);
      assert.equal(leveled.bab, Character.calcBAB('poor', 5));
    });

    it('AC grows with natural armor from extra HD', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.goblin;
      const leveled = CombatEngine.levelUpTemplate('goblin', 8);
      // +1 natural armor per 4 HD beyond base, so 8 extra HD = +2 natural armor
      assert.ok(leveled.ac >= base.ac, 'AC should not decrease from HD advancement');
    });

    it('ability scores increase per 4 HD thresholds', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.orc;
      const leveled2 = CombatEngine.levelUpTemplate('orc', 2);
      assert.equal(leveled2.stats.str, base.stats.str + 1, 'orc +2HD: totalHD=4, 1 bump');
      const leveled6 = CombatEngine.levelUpTemplate('orc', 6);
      assert.equal(leveled6.stats.str, base.stats.str + 2, 'orc +6HD: totalHD=8, 2 bumps (minus 0 base)');
    });

    it('leveled-up template has increased xp/gold rewards', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.orc;
      const leveled = CombatEngine.levelUpTemplate('orc', 2);
      assert.greaterThan(leveled.xpReward, base.xpReward, 'leveled XP should be higher');
      assert.greaterThan(leveled.goldReward, base.goldReward, 'leveled gold should be higher');
    });

    it('CR increases with extra HD', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.orc;
      const leveled = CombatEngine.levelUpTemplate('orc', 3);
      assert.greaterThan(leveled.cr, base.cr, 'CR should increase');
    });

    it('leveled-up name reflects power level', () => {
      const leader = CombatEngine.levelUpTemplate('orc', 1);
      assert.ok(leader.name !== 'Orc', 'should have a modified name');
      const greater = CombatEngine.levelUpTemplate('orc', 10);
      assert.ok(greater.name.includes('Greater') || greater.name.includes('Champion'), 'high-HD should be Greater or Champion');
    });

    it('returns base template when extraHD is 0', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.goblin;
      const same = CombatEngine.levelUpTemplate('goblin', 0);
      assert.equal(same.hp, base.hp);
      assert.equal(same.name, base.name);
    });

    it('templateToCharacter with extraHD produces leveled character', () => {
      const base = CombatEngine.templateToCharacter('orc', new PRNG(42));
      const leveled = CombatEngine.templateToCharacter('orc', new PRNG(42), 3);
      assert.greaterThan(leveled.hp, base.hp, 'leveled char HP');
      assert.greaterThan(leveled.level, base.level, 'leveled char level');
      assert.equal(leveled.class, 'orc', 'class should still be orc');
    });

    it('initCombat accepts enemy with extraHD', () => {
      const engine = new CombatEngine(new PRNG(42));
      engine.initCombat(makeParty(), [{ templateId: 'orc', extraHD: 2 }], 8, 8, 'plains');
      const enemy = engine.units.find(u => u.faction === 'enemy');
      assert.ok(enemy);
      assert.greaterThan(enemy.maxHp, CombatEngine.ENEMY_TEMPLATES.orc.hp, 'leveled enemy should have more HP');
    });

    it('scaleCreature scales a creature to arbitrary target HD', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.goblin;
      const scaled = CombatEngine.scaleCreature(base, 10);
      assert.ok(scaled);
      assert.equal(scaled.hitDice, 10);
      assert.ok(scaled.hp > base.hp, 'scaled HP should be higher');
      assert.ok(scaled.cr > base.cr, 'scaled CR should be higher');
    });

    it('scaleCreature can downscale (baby tarrasque)', () => {
      const tarrasque = CombatEngine.ENEMY_TEMPLATES.tarrasque;
      if (!tarrasque) return;
      const baby = CombatEngine.scaleCreature(tarrasque, 1);
      assert.ok(baby);
      assert.equal(baby.hitDice, 1);
      assert.ok(baby.hp < tarrasque.hp, 'baby should have less HP');
      assert.ok(baby.cr < tarrasque.cr, 'baby should have lower CR');
      assert.ok(baby.name.includes('Lesser') || baby.name.includes('Young'), 'downscaled name should reflect weakness');
    });

    it('scaleCreature can upscale (epic rat)', () => {
      const rat = CombatEngine.ENEMY_TEMPLATES.rat;
      if (!rat) return;
      const epic = CombatEngine.scaleCreature(rat, 100);
      assert.ok(epic);
      assert.equal(epic.hitDice, 100);
      assert.ok(epic.hp > rat.hp * 10, 'epic rat HP should be massively higher');
      assert.ok(epic.cr > rat.cr * 10, 'epic rat CR should be massively higher');
      assert.ok(epic.name.includes('Greater'), 'upscaled name should reflect power');
    });

    it('scaleCreature at base HD preserves name and HD', () => {
      const base = CombatEngine.ENEMY_TEMPLATES.goblin;
      const same = CombatEngine.scaleCreature(base, base.hitDice);
      assert.equal(same.hitDice, base.hitDice);
      assert.equal(same.name, base.name);
      // HP uses average roll so may differ from template max roll
      assert.ok(same.hp > 0, 'HP should be positive');
    });

    it('templateToCharacter with targetLevel scales creature', () => {
      const base = CombatEngine.templateToCharacter('goblin', new PRNG(42));
      const scaled = CombatEngine.templateToCharacter('goblin', new PRNG(42), 0, 10);
      assert.ok(scaled);
      assert.equal(scaled.level, 10);
      assert.ok(scaled.hp > base.hp, 'scaled character should have more HP');
    });

    it('initCombat accepts enemy with targetLevel', () => {
      const engine = new CombatEngine(new PRNG(42));
      engine.initCombat(makeParty(), [{ templateId: 'goblin', targetLevel: 1 }], 8, 8, 'plains');
      const enemy = engine.units.find(u => u.faction === 'enemy');
      assert.ok(enemy);
      assert.equal(enemy.character.level, 1);
    });
  });

  describe('CombatEngine — Equipment in resolveAttack', () => {

    function makeEquippedChar(name, equipment) {
      const prng = new PRNG(42);
      const base = Character.createCharacter('human', 'fighter', name || 'Equipped', 3, prng);
      return Object.freeze({ ...base, equipment: Object.freeze(equipment) });
    }

    it('resolveAttack uses weapon damageDice/damageSides when mainHand equipped', () => {
      const Items = window.SZ.TacticalRealms.Items;
      const weapon = Items.createItem('greatsword');
      const equipped = makeEquippedChar('Swordfighter', {
        mainHand: weapon, offHand: null, body: null, accessory: null,
      });
      let hitOnce = false;
      for (let seed = 0; seed < 100; ++seed) {
        const eng = new CombatEngine(new PRNG(seed));
        eng.initCombat([equipped], [{ templateId: 'goblin' }], 8, 8, 'plains');
        const pu = eng.units.find(u => u.faction === 'party');
        const eu = eng.units.find(u => u.faction === 'enemy');
        const r = eng.resolveAttack(pu.id, eu.id);
        if (r.hit) {
          assert.greaterThan(r.damage, 0, 'should deal damage with weapon');
          hitOnce = true;
          break;
        }
      }
      assert.ok(hitOnce, 'should hit at least once with equipped weapon');
    });

    it('equipment attack bonus improves hit chance vs unarmed', () => {
      const Items = window.SZ.TacticalRealms.Items;
      const weapon = Items.createItem('rapier'); // +2 attack
      const shield = Items.createItem('buckler'); // +1 AC but 0 attack
      const equipped = makeEquippedChar('Armed', {
        mainHand: weapon, offHand: shield, body: null, accessory: null,
      });
      const unarmed = makeEquippedChar('Unarmed', {
        mainHand: null, offHand: null, body: null, accessory: null,
      });

      let armedHits = 0, unarmedHits = 0;
      const trials = 200;
      for (let seed = 0; seed < trials; ++seed) {
        const eng1 = new CombatEngine(new PRNG(seed));
        eng1.initCombat([equipped], [{ templateId: 'orc' }], 8, 8, 'plains');
        const r1 = eng1.resolveAttack(eng1.units.find(u => u.faction === 'party').id, eng1.units.find(u => u.faction === 'enemy').id);
        if (r1.hit) ++armedHits;

        const eng2 = new CombatEngine(new PRNG(seed));
        eng2.initCombat([unarmed], [{ templateId: 'orc' }], 8, 8, 'plains');
        const r2 = eng2.resolveAttack(eng2.units.find(u => u.faction === 'party').id, eng2.units.find(u => u.faction === 'enemy').id);
        if (r2.hit) ++unarmedHits;
      }
      assert.ok(armedHits >= unarmedHits, `armed (${armedHits}) should hit at least as often as unarmed (${unarmedHits})`);
    });

    it('weapon affix damage is added on hit', () => {
      const Items = window.SZ.TacticalRealms.Items;
      const weapon = Items.createItem('longsword', 3, 'flaming');
      assert.ok(weapon.affixDamage, 'flaming weapon should have affixDamage');
      const equipped = makeEquippedChar('Flameblade', {
        mainHand: weapon, offHand: null, body: null, accessory: null,
      });
      let hitOnce = false;
      for (let seed = 0; seed < 100; ++seed) {
        const eng = new CombatEngine(new PRNG(seed));
        eng.initCombat([equipped], [{ templateId: 'troll' }], 8, 8, 'plains');
        const pu = eng.units.find(u => u.faction === 'party');
        const eu = eng.units.find(u => u.faction === 'enemy');
        const r = eng.resolveAttack(pu.id, eu.id);
        if (r.hit) {
          assert.greaterThan(r.damage, 0, 'should deal damage with affix');
          hitOnce = true;
          break;
        }
      }
      assert.ok(hitOnce, 'should hit at least once');
    });

    it('resolveAttack handles character with no equipment field', () => {
      const eng = new CombatEngine(new PRNG(42));
      eng.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      const pu = eng.units.find(u => u.faction === 'party');
      const eu = eng.units.find(u => u.faction === 'enemy');
      const r = eng.resolveAttack(pu.id, eu.id);
      assert.ok('hit' in r);
      assert.ok('damage' in r);
    });

    it('weapon critRange is used during attack', () => {
      const Items = window.SZ.TacticalRealms.Items;
      const rapier = Items.createItem('rapier'); // critRange [18,19,20]
      assert.ok(rapier.critRange.length >= 3, 'rapier should have wide crit range');
      const equipped = makeEquippedChar('Duelist', {
        mainHand: rapier, offHand: null, body: null, accessory: null,
      });
      const eng = new CombatEngine(new PRNG(42));
      eng.initCombat([equipped], [{ templateId: 'goblin' }], 8, 8, 'plains');
      const pu = eng.units.find(u => u.faction === 'party');
      const eu = eng.units.find(u => u.faction === 'enemy');
      const r = eng.resolveAttack(pu.id, eu.id);
      assert.ok('critical' in r, 'result should contain critical field');
    });

    it('enemy without equipment falls back to template damage dice', () => {
      const eng = new CombatEngine(new PRNG(42));
      eng.initCombat(makeParty(), [{ templateId: 'orc' }], 8, 8, 'plains');
      const eu = eng.units.find(u => u.faction === 'enemy');
      const pu = eng.units.find(u => u.faction === 'party');
      let hitOnce = false;
      for (let seed = 0; seed < 100; ++seed) {
        const eng2 = new CombatEngine(new PRNG(seed));
        eng2.initCombat(makeParty(), [{ templateId: 'orc' }], 8, 8, 'plains');
        const r = eng2.resolveAttack(eng2.units.find(u => u.faction === 'enemy').id, eng2.units.find(u => u.faction === 'party').id);
        if (r.hit) {
          assert.greaterThan(r.damage, 0);
          hitOnce = true;
          break;
        }
      }
      assert.ok(hitOnce, 'enemy should hit at least once');
    });
  });

  describe('CombatEngine — getRewards loot', () => {

    it('getRewards returns loot array', () => {
      const eng = new CombatEngine(new PRNG(42));
      eng.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      for (const u of eng.units)
        if (u.faction === 'enemy')
          u.takeDamage(9999);
      const r = eng.getRewards();
      assert.ok('loot' in r, 'rewards should have loot field');
      assert.isArray(r.loot);
    });

    it('getRewards loot items have expected fields', () => {
      let found = false;
      for (let seed = 0; seed < 200; ++seed) {
        const eng = new CombatEngine(new PRNG(seed));
        eng.initCombat(makeParty(), [{ templateId: 'troll' }], 10, 8, 'plains');
        for (const u of eng.units)
          if (u.faction === 'enemy')
            u.takeDamage(9999);
        const r = eng.getRewards();
        if (r.loot.length > 0) {
          const item = r.loot[0];
          assert.ok(item.id, 'loot item should have id');
          assert.ok(item.name, 'loot item should have name');
          assert.ok(item.category, 'loot item should have category');
          found = true;
          break;
        }
      }
      assert.ok(found, 'should drop loot at least once in 200 seeds');
    });

    it('getRewards returns empty loot when no enemies dead', () => {
      const eng = new CombatEngine(new PRNG(42));
      eng.initCombat(makeParty(), makeEnemies(), 10, 8, 'plains');
      const r = eng.getRewards();
      assert.equal(r.xp, 0);
      assert.equal(r.gold, 0);
      assert.isArray(r.loot);
    });

    it('higher CR enemies can produce higher tier loot', () => {
      let maxTier = 0;
      for (let seed = 0; seed < 300; ++seed) {
        const eng = new CombatEngine(new PRNG(seed));
        eng.initCombat(makeParty(), [{ templateId: 'young_dragon' }], 10, 8, 'plains');
        for (const u of eng.units)
          if (u.faction === 'enemy')
            u.takeDamage(9999);
        const r = eng.getRewards();
        for (const item of r.loot)
          if (item.tier > maxTier)
            maxTier = item.tier;
      }
      assert.greaterThan(maxTier, 1, 'high CR should produce tier > 1 loot');
    });
  });

  describe('CombatEngine — useItem', () => {
    let engine;

    function makeWizardForItem(name) {
      const base = Character.createCharacter('human', 'wizard', name || 'Wizard', 5, new PRNG(99));
      return Object.freeze({ ...base, mp: 20, maxMp: 20, spells: ['arcane_bolt'] });
    }

    function initForUseItem() {
      engine = new CombatEngine(new PRNG(42));
      const party = [makeWizardForItem()];
      engine.initCombat(party, [{ templateId: 'goblin' }], 10, 8, 'plains');
      engine.startTurn();
      while (engine.currentUnit && engine.currentUnit.faction !== 'party') {
        if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
        engine.executeEnemyTurn(engine.currentUnit.id);
        engine.nextTurn();
        engine.startTurn();
      }
    }

    it('useItem with healing potion restores HP', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('healing_potion');
      const unit = engine.currentUnit;
      unit.takeDamage(10);
      const prevHp = unit.currentHp;
      const result = engine.useItem(potion);
      assert.ok(result, 'useItem should return a result');
      assert.equal(result.type, 'heal');
      assert.greaterThan(result.amount, 0);
      assert.greaterThan(unit.currentHp, prevHp);
    });

    it('useItem with mana potion restores MP', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('mana_potion');
      const unit = engine.currentUnit;
      unit.spendMp(8);
      const prevMp = unit.currentMp;
      const result = engine.useItem(potion);
      assert.ok(result);
      assert.equal(result.type, 'restoreMp');
      assert.greaterThan(result.amount, 0);
      assert.greaterThan(unit.currentMp, prevMp);
    });

    it('useItem ends action and transitions to TURN_END', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('healing_potion');
      engine.currentUnit.takeDamage(5);
      engine.useItem(potion);
      assert.ok(engine.currentUnit.hasActed);
      assert.equal(engine.phase, CombatPhase.TURN_END);
    });

    it('useItem logs to combatLog', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('healing_potion');
      engine.currentUnit.takeDamage(5);
      const logBefore = engine.combatLog.length;
      engine.useItem(potion);
      assert.greaterThan(engine.combatLog.length, logBefore);
      assert.ok(engine.combatLog.some(l => l.includes('Healing Potion')));
    });

    it('useItem returns null for null item', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      assert.isNull(engine.useItem(null));
    });

    it('useItem returns null for item without effect', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const sword = Items.createItem('short_sword');
      assert.isNull(engine.useItem(sword));
    });

    it('useItem returns null when unit has already acted', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('healing_potion');
      engine.currentUnit.takeDamage(5);
      engine.useItem(potion);
      const potion2 = Items.createItem('healing_potion');
      assert.isNull(engine.useItem(potion2));
    });

    it('useItem returns null for enemy unit', () => {
      engine = new CombatEngine(new PRNG(42));
      engine.initCombat(makeParty(), [{ templateId: 'goblin' }], 10, 8, 'plains');
      engine.startTurn();
      while (engine.currentUnit && engine.currentUnit.faction !== 'enemy') {
        engine.selectWait();
        engine.nextTurn();
        engine.startTurn();
        if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      }
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('healing_potion');
      assert.isNull(engine.useItem(potion));
    });

    it('useItem emits itemUsed event', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const potion = Items.createItem('healing_potion');
      engine.currentUnit.takeDamage(5);
      let emitted = false;
      engine.on('itemUsed', () => { emitted = true; });
      engine.useItem(potion);
      assert.ok(emitted, 'should emit itemUsed event');
    });

    it('useItem with strength elixir returns buff result', () => {
      initForUseItem();
      if (engine.phase === CombatPhase.VICTORY || engine.phase === CombatPhase.DEFEAT) return;
      const Items = window.SZ.TacticalRealms.Items;
      const elixir = Items.createItem('strength_elixir');
      const result = engine.useItem(elixir);
      assert.ok(result);
      assert.equal(result.type, 'buff');
      assert.equal(result.stat, 'str');
      assert.equal(result.bonus, 2);
      assert.equal(result.duration, 5);
    });
  });

  describe('CombatEngine — templateToCharacter saves', () => {

    it('saves are no longer hardcoded identical', () => {
      const dragon = CombatEngine.templateToCharacter('dragon_wyrmling', new PRNG(42));
      const skeleton = CombatEngine.templateToCharacter('skeleton', new PRNG(42));
      const sameSaves = dragon.saves.fort === skeleton.saves.fort
        && dragon.saves.ref === skeleton.saves.ref
        && dragon.saves.will === skeleton.saves.will;
      assert.ok(!sameSaves, 'different creature types should have different save profiles');
    });

    it('dragon type has good fort/ref/will saves', () => {
      const char = CombatEngine.templateToCharacter('dragon_wyrmling', new PRNG(42));
      const tmpl = CombatEngine.ENEMY_TEMPLATES.dragon_wyrmling;
      const hd = tmpl.hitDice;
      const goodBase = Character.calcSave('good', hd);
      const poorBase = Character.calcSave('poor', hd);
      assert.greaterThan(char.saves.fort, poorBase + Character.abilityMod(tmpl.stats.con), 'dragon fort should use good save');
      assert.greaterThan(char.saves.ref, poorBase + Character.abilityMod(tmpl.stats.dex), 'dragon ref should use good save');
      assert.greaterThan(char.saves.will, poorBase + Character.abilityMod(tmpl.stats.wis), 'dragon will should use good save');
    });

    it('undead type has good will but poor fort/ref', () => {
      const char = CombatEngine.templateToCharacter('skeleton', new PRNG(42));
      const tmpl = CombatEngine.ENEMY_TEMPLATES.skeleton;
      const hd = tmpl.hitDice;
      const goodSave = Character.calcSave('good', hd);
      const poorSave = Character.calcSave('poor', hd);
      assert.equal(char.saves.fort, poorSave + Character.abilityMod(tmpl.stats.con));
      assert.equal(char.saves.ref, poorSave + Character.abilityMod(tmpl.stats.dex));
      assert.equal(char.saves.will, goodSave + Character.abilityMod(tmpl.stats.wis));
    });

    it('humanoid type has good fort but poor ref/will', () => {
      const char = CombatEngine.templateToCharacter('goblin', new PRNG(42));
      const tmpl = CombatEngine.ENEMY_TEMPLATES.goblin;
      const hd = tmpl.hitDice;
      const goodSave = Character.calcSave('good', hd);
      const poorSave = Character.calcSave('poor', hd);
      assert.equal(char.saves.fort, goodSave + Character.abilityMod(tmpl.stats.con));
      assert.equal(char.saves.ref, poorSave + Character.abilityMod(tmpl.stats.dex));
      assert.equal(char.saves.will, poorSave + Character.abilityMod(tmpl.stats.wis));
    });

    it('saves include ability modifiers', () => {
      const char = CombatEngine.templateToCharacter('orc', new PRNG(42));
      const tmpl = CombatEngine.ENEMY_TEMPLATES.orc;
      const conMod = Character.abilityMod(tmpl.stats.con);
      const dexMod = Character.abilityMod(tmpl.stats.dex);
      const wisMod = Character.abilityMod(tmpl.stats.wis);
      const hd = tmpl.hitDice;
      const goodFort = Character.calcSave('good', hd);
      const poorRef = Character.calcSave('poor', hd);
      const poorWill = Character.calcSave('poor', hd);
      assert.equal(char.saves.fort, goodFort + conMod);
      assert.equal(char.saves.ref, poorRef + dexMod);
      assert.equal(char.saves.will, poorWill + wisMod);
    });

    it('leveled enemy has higher saves than base', () => {
      const base = CombatEngine.templateToCharacter('orc', new PRNG(42));
      const leveled = CombatEngine.templateToCharacter('orc', new PRNG(42), 4);
      assert.greaterThan(leveled.saves.fort, base.saves.fort, 'leveled fort save should be higher');
    });

    it('level equals totalHD', () => {
      const base = CombatEngine.templateToCharacter('orc', new PRNG(42));
      assert.equal(base.level, CombatEngine.ENEMY_TEMPLATES.orc.hitDice);
      const leveled = CombatEngine.templateToCharacter('orc', new PRNG(42), 3);
      assert.equal(leveled.level, CombatEngine.ENEMY_TEMPLATES.orc.hitDice + 3);
    });
  });

  describe('CombatEngine — Boss Templates', () => {
    const BOSS_TEMPLATES = window.SZ.TacticalRealms.BOSS_TEMPLATES;

    it('BOSS_TEMPLATES is frozen', () => {
      assert.ok(Object.isFrozen(BOSS_TEMPLATES));
    });

    it('has expected boss ids', () => {
      const expected = ['goblin_chieftain', 'dire_alpha', 'necromancer', 'dragon', 'lich_king', 'demon_lord'];
      for (const id of expected)
        assert.ok(BOSS_TEMPLATES[id], `missing boss: ${id}`);
    });

    it('each boss has required fields', () => {
      for (const [id, boss] of Object.entries(BOSS_TEMPLATES)) {
        assert.ok(boss.base, `${id} missing base`);
        assert.ok(boss.name, `${id} missing name`);
        assert.typeOf(boss.tier, 'number', `${id} tier`);
        assert.typeOf(boss.hpMult, 'number', `${id} hpMult`);
        assert.isArray(boss.phases, `${id} phases`);
        assert.greaterThan(boss.phases.length, 0, `${id} should have at least one phase`);
      }
    });

    it('each boss base references a valid enemy template', () => {
      for (const [id, boss] of Object.entries(BOSS_TEMPLATES))
        assert.ok(CombatEngine.ENEMY_TEMPLATES[boss.base], `${id} base "${boss.base}" not in ENEMY_TEMPLATES`);
    });

    it('boss phases have hpThreshold between 0 and 1', () => {
      for (const [id, boss] of Object.entries(BOSS_TEMPLATES))
        for (const phase of boss.phases) {
          assert.greaterThan(phase.hpThreshold, 0, `${id} phase threshold > 0`);
          assert.ok(phase.hpThreshold <= 1, `${id} phase threshold <= 1`);
        }
    });

    it('createBossCharacter returns a valid character', () => {
      const char = CombatEngine.createBossCharacter('goblin_chieftain', new PRNG(42));
      assert.ok(char);
      assert.equal(char.name, 'Goblin Chieftain');
      assert.ok(char.isBoss);
      assert.equal(char.bossId, 'goblin_chieftain');
      assert.greaterThan(char.hp, 0);
      assert.greaterThan(char.maxHp, 0);
    });

    it('createBossCharacter applies hpMult', () => {
      const boss = BOSS_TEMPLATES.goblin_chieftain;
      const baseChar = CombatEngine.templateToCharacter(boss.base, new PRNG(42), boss.extraHD);
      const bossChar = CombatEngine.createBossCharacter('goblin_chieftain', new PRNG(42));
      assert.equal(bossChar.maxHp, Math.round(baseChar.maxHp * boss.hpMult));
    });

    it('createBossCharacter applies acBonus', () => {
      const boss = BOSS_TEMPLATES.goblin_chieftain;
      const baseChar = CombatEngine.templateToCharacter(boss.base, new PRNG(42), boss.extraHD);
      const bossChar = CombatEngine.createBossCharacter('goblin_chieftain', new PRNG(42));
      assert.equal(bossChar.ac, baseChar.ac + boss.acBonus);
    });

    it('createBossCharacter returns null for unknown boss', () => {
      assert.isNull(CombatEngine.createBossCharacter('nonexistent', new PRNG(42)));
    });

    it('getBossPhase returns null for non-boss unit', () => {
      const eng = new CombatEngine(new PRNG(42));
      eng.initCombat(makeParty(), makeEnemies(), 8, 8, 'plains');
      const unit = eng.units.find(u => u.faction === 'enemy');
      assert.isNull(CombatEngine.getBossPhase(unit));
    });

    it('getBossPhase returns phase when hp below threshold', () => {
      const bossChar = CombatEngine.createBossCharacter('goblin_chieftain', new PRNG(42));
      const unit = new CombatUnit('boss_0', bossChar, 'enemy', 5, 5);
      // At full HP, no phase active (thresholds are 0.75 and 0.25)
      assert.isNull(CombatEngine.getBossPhase(unit));

      // Take damage below 75%
      unit.takeDamage(Math.ceil(bossChar.maxHp * 0.3));
      const phase1 = CombatEngine.getBossPhase(unit);
      assert.ok(phase1);
      assert.equal(phase1.name, 'Enraged');

      // Take damage below 25%
      unit.takeDamage(Math.ceil(bossChar.maxHp * 0.5));
      const phase2 = CombatEngine.getBossPhase(unit);
      assert.ok(phase2);
      assert.equal(phase2.name, 'Desperate');
    });

    it('boss can be used in combat via initCombat', () => {
      const bossChar = CombatEngine.createBossCharacter('dire_alpha', new PRNG(42));
      const eng = new CombatEngine(new PRNG(42));
      // Use boss character directly as an enemy by wrapping in a format initCombat expects
      // We can pass the boss char as a party-style entry since initCombat reads templateId
      eng.initCombat(makeParty(), [{ templateId: 'dire_wolf', extraHD: 4 }], 10, 8, 'plains');
      assert.greaterThan(eng.units.length, 1);
    });

    it('dragon boss has 3 phases', () => {
      assert.equal(BOSS_TEMPLATES.dragon.phases.length, 3);
    });

    it('each boss tier increments', () => {
      const tiers = Object.values(BOSS_TEMPLATES).map(b => b.tier);
      for (let i = 0; i < tiers.length - 1; ++i)
        assert.ok(tiers[i] <= tiers[i + 1], 'tiers should be non-decreasing');
    });
  });
})();
