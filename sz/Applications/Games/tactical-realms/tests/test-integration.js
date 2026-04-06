;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { GameState, StateMachine, SaveManager, SaveCrypto, PRNG, TimeRotation, CombatEngine, CombatPhase, Character } = window.SZ.TacticalRealms;

  function createMemoryStorage() {
    const store = new Map();
    return {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, val) { store.set(key, val); },
      removeItem(key) { store.delete(key); },
      clear() { store.clear(); }
    };
  }

  describe('Integration', () => {
    let sm;
    let saveManager;
    let storage;

    beforeEach(() => {
      sm = new StateMachine(GameState.TITLE);
      storage = createMemoryStorage();
      saveManager = new SaveManager({ crypto: new SaveCrypto(), storage, prefix: 'test-integ' });
    });

    it('CAMP entry triggers auto-save via afterTransition event', async () => {
      let autoSaveTriggered = false;
      sm.on('afterTransition', async (e) => {
        if (e.autoSave) {
          await saveManager.save({ lastState: e.to, timestamp: Date.now() });
          autoSaveTriggered = true;
        }
      });

      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      sm.transition(GameState.CAMP);

      await new Promise(r => setTimeout(r, 50));
      assert.ok(autoSaveTriggered);
      assert.ok(saveManager.hasSave());
    });

    it('save-load roundtrip preserves game state', async () => {
      const gameState = {
        lastState: GameState.OVERWORLD,
        playerPos: { col: 10, row: 7 },
        gold: 500,
        party: ['Fighter', 'Mage']
      };

      await saveManager.save(gameState);
      const loaded = await saveManager.load();
      assert.equal(loaded.state.lastState, GameState.OVERWORLD);
      assert.equal(loaded.state.playerPos.col, 10);
      assert.equal(loaded.state.playerPos.row, 7);
      assert.equal(loaded.state.gold, 500);
      assert.deepEqual(loaded.state.party, ['Fighter', 'Mage']);
    });

    it('full cycle: TITLE -> CHARACTER_SELECT -> OVERWORLD -> CAMP -> reload', async () => {
      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      sm.transition(GameState.CAMP);

      await saveManager.save({ lastState: GameState.CAMP, step: GameState.CAMP });

      const loaded = await saveManager.load();
      assert.ok(loaded);
      assert.equal(loaded.state.lastState, GameState.CAMP);

      const sm2 = new StateMachine(GameState.LOAD_GAME);
      sm2.transition(GameState.CAMP);
      assert.equal(sm2.current, GameState.CAMP);
    });

    it('PRNG + TimeRotation produce consistent daily seeds', () => {
      const clock = () => new Date(2024, 5, 15, 12, 0, 0);
      const tr = new TimeRotation(clock);
      const seed = tr.dailySeed();
      const rng1 = PRNG.fromDate(seed);
      const rng2 = PRNG.fromDate(seed);
      assert.equal(rng1.next(), rng2.next());
      assert.equal(rng1.d20(), rng2.d20());
    });

    it('state machine serialize -> save -> load -> deserialize roundtrip', async () => {
      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      sm.transition(GameState.DUNGEON);

      const serialized = sm.serialize();
      await saveManager.save({ stateMachine: serialized, gold: 100 });

      const loaded = await saveManager.load();
      const restored = StateMachine.deserialize(loaded.state.stateMachine);
      assert.equal(restored.current, GameState.DUNGEON);
      assert.deepEqual(restored.history, [GameState.TITLE, GameState.CHARACTER_SELECT, GameState.OVERWORLD]);
    });

    it('OVERWORLD auto-save fires on zone entry', async () => {
      let saved = false;
      sm.on('afterTransition', async (e) => {
        if (e.autoSave === 'zoneEntry') {
          await saveManager.save({ lastState: e.to });
          saved = true;
        }
      });

      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      await new Promise(r => setTimeout(r, 50));
      assert.ok(saved);
    });

    it('TOWN auto-save fires on town entry', async () => {
      let savedTown = false;
      const sm2 = new StateMachine(GameState.OVERWORLD);
      sm2.on('afterTransition', async (e) => {
        if (e.autoSave === 'townEntry') {
          await saveManager.save({ lastState: e.to });
          savedTown = true;
        }
      });

      sm2.transition(GameState.TOWN);
      await new Promise(r => setTimeout(r, 50));
      assert.ok(savedTown);
    });

    it('COMBAT does not trigger auto-save', async () => {
      let autoSaved = false;
      const sm2 = new StateMachine(GameState.DUNGEON);
      sm2.on('afterTransition', (e) => {
        if (e.autoSave) autoSaved = true;
      });

      sm2.transition(GameState.COMBAT);
      await new Promise(r => setTimeout(r, 50));
      assert.ok(!autoSaved);
    });

    it('multiple saves followed by delete clears all data', async () => {
      await saveManager.save({ step: 1 });
      await saveManager.save({ step: 2 });
      assert.ok(saveManager.hasSave());
      saveManager.deleteSave();
      assert.ok(!saveManager.hasSave());
      const loaded = await saveManager.load();
      assert.isNull(loaded);
    });

    it('full combat loop: party vs goblins with flanking', () => {
      const prng = new PRNG(42);
      const party = [
        Character.createCharacter('human', 'fighter', 'Tank', 3, prng),
        Character.createCharacter('elf', 'rogue', 'Striker', 3, prng),
      ];
      const eng = new CombatEngine(prng);
      eng.initCombat(party, [{ templateId: 'goblin' }], 8, 8, 'plains');
      assert.equal(eng.phase, CombatPhase.TURN_START);
      assert.greaterThan(eng.units.length, 0);
      assert.greaterThan(eng.turnOrder.length, 0);

      let rounds = 0;
      while (rounds < 50) {
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
        if (eng.checkVictory() || eng.checkDefeat())
          break;
        eng.nextTurn();
        ++rounds;
      }
      assert.ok(eng.checkVictory() || eng.checkDefeat(), 'combat should end within 50 rounds');
    });

    it('combat defeat scenario: single weak character vs bandits', () => {
      const prng = new PRNG(7);
      const party = [
        Character.createCharacter('halfling', 'wizard', 'Weakling', 1, prng),
      ];
      const eng = new CombatEngine(prng);
      eng.initCombat(party, [{ templateId: 'bandit' }, { templateId: 'bandit' }], 8, 8, 'plains');

      let rounds = 0;
      while (rounds < 100) {
        eng.startTurn();
        if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
          break;
        if (eng.currentUnit.faction === 'party')
          eng.selectWait();
        else
          eng.executeEnemyTurn(eng.currentUnit.id);
        if (eng.checkVictory() || eng.checkDefeat())
          break;
        eng.nextTurn();
        ++rounds;
      }
      assert.ok(eng.checkDefeat(), 'wizard should be defeated by 2 bandits');
    });

    it('multi-round combat tracks round numbers correctly', () => {
      const prng = new PRNG(99);
      const party = [
        Character.createCharacter('human', 'fighter', 'Hero', 5, prng),
      ];
      const eng = new CombatEngine(prng);
      eng.initCombat(party, [{ templateId: 'goblin' }], 8, 8, 'plains');
      assert.equal(eng.round, 1);

      const totalUnits = eng.turnOrder.length;
      for (let i = 0; i < totalUnits; ++i) {
        eng.startTurn();
        if (eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
          return;
        if (eng.currentUnit.faction === 'party')
          eng.selectWait();
        else
          eng.executeEnemyTurn(eng.currentUnit.id);
        if (eng.checkVictory() || eng.checkDefeat())
          return;
        eng.nextTurn();
      }
      assert.equal(eng.round, 2);
    });

    it('combat state transitions: DUNGEON -> COMBAT -> VICTORY -> CAMP', () => {
      const sm2 = new StateMachine(GameState.DUNGEON);
      sm2.transition(GameState.COMBAT);
      assert.equal(sm2.current, GameState.COMBAT);
      sm2.transition(GameState.VICTORY);
      assert.equal(sm2.current, GameState.VICTORY);
      sm2.transition(GameState.CAMP);
      assert.equal(sm2.current, GameState.CAMP);
    });

    it('combat state transitions: DUNGEON -> COMBAT -> DEFEAT -> CAMP or TITLE', () => {
      const sm2 = new StateMachine(GameState.DUNGEON);
      sm2.transition(GameState.COMBAT);
      sm2.transition(GameState.DEFEAT);
      assert.equal(sm2.current, GameState.DEFEAT);
      assert.ok(sm2.canTransition(GameState.CAMP) || sm2.canTransition(GameState.TITLE));
    });

    it('combat engine deterministic with same PRNG seed', () => {
      function runCombat(seed) {
        const prng = new PRNG(seed);
        const party = [Character.createCharacter('human', 'fighter', 'Test', 3, new PRNG(1))];
        const eng = new CombatEngine(prng);
        eng.initCombat(party, [{ templateId: 'goblin' }], 8, 8, 'plains');
        const log1 = eng.combatLog.slice();
        return log1;
      }
      const log1 = runCombat(42);
      const log2 = runCombat(42);
      assert.deepEqual(log1, log2);
    });
  });
})();
