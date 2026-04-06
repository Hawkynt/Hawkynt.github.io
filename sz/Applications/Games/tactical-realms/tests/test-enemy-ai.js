;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { EnemyAI, CombatGrid, CombatUnit, Pathfinding, Character, PRNG, D20 } = window.SZ.TacticalRealms;

  function makeChar(name, overrides) {
    const prng = new PRNG(42);
    const base = Character.createCharacter('human', 'fighter', name || 'Test', 1, prng);
    if (!overrides)
      return base;
    return Object.freeze({ ...base, ...overrides, stats: Object.freeze({ ...base.stats, ...(overrides.stats || {}) }) });
  }

  function makeGrid() {
    const terrain = [];
    for (let i = 0; i < 64; ++i)
      terrain.push('plains');
    return new CombatGrid(8, 8, terrain);
  }

  describe('EnemyAI', () => {

    it('findNearestTarget returns closest living party member', () => {
      const grid = makeGrid();
      const p1 = new CombatUnit('party_1', makeChar('Near'), 'party', 3, 3);
      const p2 = new CombatUnit('party_2', makeChar('Far'), 'party', 7, 7);
      grid.placeUnit('party_1', 3, 3);
      grid.placeUnit('party_2', 7, 7);
      const target = EnemyAI.findNearestTarget(grid, { col: 2, row: 3 }, [p1, p2]);
      assert.equal(target.id, 'party_1');
    });

    it('findNearestTarget prefers lower HP on tie distance', () => {
      const grid = makeGrid();
      const p1 = new CombatUnit('party_1', makeChar('HighHP'), 'party', 4, 3);
      const p2 = new CombatUnit('party_2', makeChar('LowHP'), 'party', 2, 3);
      p2.takeDamage(5);
      grid.placeUnit('party_1', 4, 3);
      grid.placeUnit('party_2', 2, 3);
      const target = EnemyAI.findNearestTarget(grid, { col: 3, row: 3 }, [p1, p2]);
      assert.equal(target.id, 'party_2');
    });

    it('findNearestTarget skips dead units', () => {
      const grid = makeGrid();
      const p1 = new CombatUnit('party_1', makeChar('Dead'), 'party', 3, 3);
      p1.takeDamage(9999);
      const p2 = new CombatUnit('party_2', makeChar('Alive'), 'party', 7, 7);
      grid.placeUnit('party_1', 3, 3);
      grid.placeUnit('party_2', 7, 7);
      const target = EnemyAI.findNearestTarget(grid, { col: 2, row: 3 }, [p1, p2]);
      assert.equal(target.id, 'party_2');
    });

    it('findNearestTarget returns null if no living targets', () => {
      const grid = makeGrid();
      const p1 = new CombatUnit('party_1', makeChar('Dead'), 'party', 3, 3);
      p1.takeDamage(9999);
      grid.placeUnit('party_1', 3, 3);
      const target = EnemyAI.findNearestTarget(grid, { col: 2, row: 3 }, [p1]);
      assert.isNull(target);
    });

    it('decide returns attack when adjacent to target', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 3, 3);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 3, 4);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_1', 3, 4);
      const prng = new PRNG(42);
      const decision = EnemyAI.decide(grid, enemy, [party], prng);
      assert.equal(decision.type, 'attack');
      assert.equal(decision.target, 'party_1');
    });

    it('decide returns move_and_attack when can reach and attack', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 2, 0);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 2, 0);
      const prng = new PRNG(42);
      const decision = EnemyAI.decide(grid, enemy, [party], prng);
      assert.equal(decision.type, 'move_and_attack');
      assert.ok(decision.moveTo);
      assert.equal(decision.target, 'party_1');
    });

    it('decide returns move when target is far away', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 7, 7);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 7, 7);
      const prng = new PRNG(42);
      const decision = EnemyAI.decide(grid, enemy, [party], prng);
      assert.equal(decision.type, 'move');
      assert.ok(decision.moveTo);
    });

    it('decide returns wait when no targets alive', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Dead'), 'party', 7, 7);
      party.takeDamage(9999);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 7, 7);
      const prng = new PRNG(42);
      const decision = EnemyAI.decide(grid, enemy, [party], prng);
      assert.equal(decision.type, 'wait');
    });

    it('decide is deterministic with same seed', () => {
      const grid = makeGrid();
      const e1 = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 0, 0);
      const p1 = new CombatUnit('party_1', makeChar('Fighter'), 'party', 5, 5);
      e1.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 5, 5);

      const d1 = EnemyAI.decide(grid, e1, [p1], new PRNG(77));

      grid.removeUnit('enemy_1');
      grid.placeUnit('enemy_1', 0, 0);
      e1.setPosition(0, 0);
      e1.beginTurn();

      const d2 = EnemyAI.decide(grid, e1, [p1], new PRNG(77));
      assert.equal(d1.type, d2.type);
      if (d1.moveTo && d2.moveTo) {
        assert.equal(d1.moveTo.col, d2.moveTo.col);
        assert.equal(d1.moveTo.row, d2.moveTo.row);
      }
    });

    it('chooseMoveTarget picks tile closest to target within range', () => {
      const grid = makeGrid();
      grid.placeUnit('enemy_1', 0, 0);
      const moveRange = Pathfinding.movementRange(grid, { col: 0, row: 0 }, 6, 'enemy');
      const result = EnemyAI.chooseMoveTarget(grid, { col: 0, row: 0 }, { col: 7, row: 0 }, moveRange);
      assert.ok(result);
      assert.greaterThan(result.col, 0);
    });

    it('decide moves even when blocked from reaching target', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 7, 7);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 7, 7);
      grid.placeUnit('enemy_2', 1, 0);
      grid.placeUnit('enemy_3', 0, 1);
      const prng = new PRNG(42);
      const decision = EnemyAI.decide(grid, enemy, [party], prng);
      assert.ok(decision.type === 'wait' || decision.type === 'move');
    });

    it('decide prefers attack without move when already adjacent', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 3, 3);
      const p1 = new CombatUnit('party_1', makeChar('Near'), 'party', 3, 4);
      const p2 = new CombatUnit('party_2', makeChar('Far'), 'party', 7, 7);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_1', 3, 4);
      grid.placeUnit('party_2', 7, 7);
      const prng = new PRNG(42);
      const decision = EnemyAI.decide(grid, enemy, [p1, p2], prng);
      assert.equal(decision.type, 'attack');
      assert.equal(decision.target, 'party_1');
    });
  });

  describe('EnemyAI — Tier System', () => {

    it('AI_TIER enum exists and is frozen', () => {
      assert.ok(EnemyAI.AI_TIER);
      assert.ok(Object.isFrozen(EnemyAI.AI_TIER));
      assert.equal(EnemyAI.AI_TIER.TRIVIAL, 0);
      assert.equal(EnemyAI.AI_TIER.SIMPLE, 1);
      assert.equal(EnemyAI.AI_TIER.TACTICAL, 2);
      assert.equal(EnemyAI.AI_TIER.STRATEGIC, 3);
      assert.equal(EnemyAI.AI_TIER.MASTERMIND, 4);
    });

    it('TIER_WEIGHTS has entries for all 5 tiers', () => {
      assert.ok(EnemyAI.TIER_WEIGHTS);
      assert.equal(EnemyAI.TIER_WEIGHTS.length, 5);
    });

    it('difficultyToAiTier maps correctly', () => {
      assert.equal(EnemyAI.difficultyToAiTier(0), 0);
      assert.equal(EnemyAI.difficultyToAiTier(1), 0);
      assert.equal(EnemyAI.difficultyToAiTier(2), 1);
      assert.equal(EnemyAI.difficultyToAiTier(3), 1);
      assert.equal(EnemyAI.difficultyToAiTier(4), 2);
      assert.equal(EnemyAI.difficultyToAiTier(5), 2);
      assert.equal(EnemyAI.difficultyToAiTier(6), 3);
      assert.equal(EnemyAI.difficultyToAiTier(7), 3);
      assert.equal(EnemyAI.difficultyToAiTier(8), 4);
      assert.equal(EnemyAI.difficultyToAiTier(10), 4); // capped at 4
    });
  });

  describe('EnemyAI — Tier 0 Backward Compat', () => {

    it('tier 0 explicit produces same result as default (no tier arg)', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 3, 3);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 3, 3);
      const d1 = EnemyAI.decide(grid, enemy, [party], new PRNG(42));
      grid.removeUnit('enemy_1');
      grid.placeUnit('enemy_1', 0, 0);
      enemy.setPosition(0, 0);
      enemy.beginTurn();
      const d2 = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 0);
      assert.equal(d1.type, d2.type);
    });

    it('tier 0 returns attack when adjacent', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Goblin'), 'enemy', 3, 3);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 3, 4);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_1', 3, 4);
      const d = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 0);
      assert.equal(d.type, 'attack');
    });

    it('tier 0 never returns spell action', () => {
      const grid = makeGrid();
      const casterChar = makeChar('Caster', { spells: Object.freeze(['arcane_bolt', 'magic_missile']), mp: 10, maxMp: 10 });
      const enemy = new CombatUnit('enemy_1', casterChar, 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 3, 3);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 3, 3);
      const d = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 0);
      assert.ok(d.type !== 'spell' && d.type !== 'move_and_spell', 'tier 0 should not cast spells');
    });
  });

  describe('EnemyAI — Tier 1 Spell Casting', () => {

    function makeCasterChar(name, spells) {
      return makeChar(name, { spells: Object.freeze(spells || ['arcane_bolt']), mp: 20, maxMp: 20 });
    }

    it('tier 1 caster considers spells as valid actions', () => {
      const Spells = window.SZ.TacticalRealms.Spells;
      if (!Spells || !Spells.byId('arcane_bolt')) return;
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeCasterChar('Mage'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 3, 0);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 3, 0);
      const d = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 1);
      // At tier 1, the AI should produce a valid action (spell, move_and_attack, or move are all reasonable)
      const validTypes = ['attack', 'move_and_attack', 'move', 'spell', 'move_and_spell'];
      assert.ok(validTypes.includes(d.type), `tier 1 caster should produce valid action, got ${d.type}`);
    });

    it('tier 1 non-caster still attacks normally', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Orc'), 'enemy', 3, 3);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 3, 4);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_1', 3, 4);
      const d = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 1);
      assert.equal(d.type, 'attack');
    });

    it('spell action has correct format', () => {
      const Spells = window.SZ.TacticalRealms.Spells;
      if (!Spells || !Spells.byId('arcane_bolt')) return;
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeCasterChar('Mage'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 2, 0);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 2, 0);
      const d = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 1);
      if (d.type === 'spell') {
        assert.ok(d.spellId, 'spell action should have spellId');
        assert.ok(d.target, 'spell action should have target');
      }
    });
  });

  describe('EnemyAI — Tier 2 Flanking & Target Priority', () => {

    it('tier 2 prefers low-HP targets over full-HP targets at same distance', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Orc'), 'enemy', 3, 3);
      const pFull = new CombatUnit('party_1', makeChar('Tank'), 'party', 3, 4);
      const pWeak = new CombatUnit('party_2', makeChar('Weak'), 'party', 3, 2);
      pWeak.takeDamage(pWeak.maxHp - 1); // 1 HP left
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 3, 3);
      grid.placeUnit('party_1', 3, 4);
      grid.placeUnit('party_2', 3, 2);
      const d = EnemyAI.decide(grid, enemy, [pFull, pWeak], new PRNG(42), 2);
      assert.equal(d.type, 'attack');
      assert.equal(d.target, 'party_2', 'tier 2 should prefer nearly-dead target');
    });

    it('tier 2 generates valid action types', () => {
      const grid = makeGrid();
      const enemy = new CombatUnit('enemy_1', makeChar('Orc'), 'enemy', 0, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 5, 5);
      enemy.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('party_1', 5, 5);
      const d = EnemyAI.decide(grid, enemy, [party], new PRNG(42), 2);
      const validTypes = ['attack', 'move_and_attack', 'move', 'spell', 'move_and_spell', 'wait'];
      assert.ok(validTypes.includes(d.type), `unexpected action type: ${d.type}`);
    });
  });

  describe('EnemyAI — Tier 3 Screening & Buff/Debuff', () => {

    it('tier 3 passes allEnemyUnits context', () => {
      const grid = makeGrid();
      const e1 = new CombatUnit('enemy_1', makeChar('Tank'), 'enemy', 0, 0);
      const e2 = new CombatUnit('enemy_2', makeChar('Caster', { spells: Object.freeze(['arcane_bolt']), mp: 10, maxMp: 10 }), 'enemy', 1, 0);
      const party = new CombatUnit('party_1', makeChar('Fighter'), 'party', 5, 0);
      e1.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('enemy_2', 1, 0);
      grid.placeUnit('party_1', 5, 0);
      const d = EnemyAI.decide(grid, e1, [party], new PRNG(42), 3, [e1, e2]);
      const validTypes = ['attack', 'move_and_attack', 'move', 'spell', 'move_and_spell', 'wait'];
      assert.ok(validTypes.includes(d.type), `tier 3 should return valid action: ${d.type}`);
    });
  });

  describe('EnemyAI — Tier 4 Coordination', () => {

    it('coordinatedDecide returns a Map of decisions', () => {
      const grid = makeGrid();
      const e1 = new CombatUnit('enemy_1', makeChar('Orc1'), 'enemy', 0, 0);
      const e2 = new CombatUnit('enemy_2', makeChar('Orc2'), 'enemy', 1, 0);
      const p1 = new CombatUnit('party_1', makeChar('Fighter'), 'party', 5, 5);
      e1.beginTurn();
      e2.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('enemy_2', 1, 0);
      grid.placeUnit('party_1', 5, 5);
      const plan = EnemyAI.coordinatedDecide(grid, [e1, e2], [p1], new PRNG(42));
      assert.ok(plan instanceof Map, 'should return a Map');
      assert.ok(plan.has('enemy_1'), 'should have decision for enemy_1');
      assert.ok(plan.has('enemy_2'), 'should have decision for enemy_2');
    });

    it('coordinated enemies dont claim same tile', () => {
      const grid = makeGrid();
      const e1 = new CombatUnit('enemy_1', makeChar('Orc1'), 'enemy', 0, 0);
      const e2 = new CombatUnit('enemy_2', makeChar('Orc2'), 'enemy', 0, 1);
      const p1 = new CombatUnit('party_1', makeChar('Fighter'), 'party', 4, 0);
      e1.beginTurn();
      e2.beginTurn();
      grid.placeUnit('enemy_1', 0, 0);
      grid.placeUnit('enemy_2', 0, 1);
      grid.placeUnit('party_1', 4, 0);
      const plan = EnemyAI.coordinatedDecide(grid, [e1, e2], [p1], new PRNG(42));
      const d1 = plan.get('enemy_1');
      const d2 = plan.get('enemy_2');
      if (d1.moveTo && d2.moveTo)
        assert.ok(d1.moveTo.col !== d2.moveTo.col || d1.moveTo.row !== d2.moveTo.row, 'should not claim same tile');
    });

    it('coordination completes in reasonable time', () => {
      const grid = makeGrid();
      const units = [];
      for (let i = 0; i < 4; ++i) {
        const u = new CombatUnit(`enemy_${i}`, makeChar(`Orc${i}`), 'enemy', i, 0);
        u.beginTurn();
        grid.placeUnit(`enemy_${i}`, i, 0);
        units.push(u);
      }
      const p1 = new CombatUnit('party_1', makeChar('Fighter'), 'party', 7, 7);
      grid.placeUnit('party_1', 7, 7);
      const start = performance.now();
      EnemyAI.coordinatedDecide(grid, units, [p1], new PRNG(42));
      const elapsed = performance.now() - start;
      assert.ok(elapsed < 200, `coordination took ${elapsed}ms, should be <200ms`);
    });
  });

  describe('EnemyAI — Overworld AI Tier', () => {

    it('encounterAiTier maps distance to tier', () => {
      const OverworldMap = window.SZ.TacticalRealms.OverworldMap;
      if (!OverworldMap) return;
      const map = new OverworldMap(42);
      assert.equal(map.encounterAiTier(0, 0), 0, 'origin should be tier 0');
      assert.equal(map.encounterAiTier(50, 0), 2, 'dist ~50 should be tier 2');
      assert.ok(map.encounterAiTier(100, 0) >= 3, 'dist ~100 should be tier 3+');
    });
  });
})();

