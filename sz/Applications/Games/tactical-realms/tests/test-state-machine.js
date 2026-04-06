;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const { GameState, StateMachine, TRANSITIONS, AUTO_SAVE_TRIGGERS } = window.SZ.TacticalRealms;

  describe('StateMachine', () => {

    it('starts in TITLE by default', () => {
      const sm = new StateMachine();
      assert.equal(sm.current, GameState.TITLE);
    });

    it('starts in given initial state', () => {
      const sm = new StateMachine(GameState.CAMP);
      assert.equal(sm.current, GameState.CAMP);
    });

    it('canTransition() returns true for valid transitions', () => {
      const sm = new StateMachine(GameState.TITLE);
      assert.ok(sm.canTransition(GameState.CHARACTER_SELECT));
      assert.ok(sm.canTransition(GameState.LOAD_GAME));
    });

    it('canTransition() returns false for invalid transitions', () => {
      const sm = new StateMachine(GameState.TITLE);
      assert.ok(!sm.canTransition(GameState.COMBAT));
      assert.ok(!sm.canTransition(GameState.CAMP));
      assert.ok(!sm.canTransition(GameState.OVERWORLD));
    });

    it('validTransitions() returns correct targets from TITLE', () => {
      const sm = new StateMachine(GameState.TITLE);
      const valid = sm.validTransitions();
      assert.deepEqual(valid.sort(), [GameState.CHARACTER_SELECT, GameState.LOAD_GAME].sort());
    });

    it('transition() changes state for valid target', () => {
      const sm = new StateMachine(GameState.TITLE);
      sm.transition(GameState.CHARACTER_SELECT);
      assert.equal(sm.current, GameState.CHARACTER_SELECT);
    });

    it('transition() throws for invalid target', () => {
      const sm = new StateMachine(GameState.TITLE);
      assert.throws(() => sm.transition(GameState.COMBAT));
    });

    it('transition() returns from, to, and autoSave', () => {
      const sm = new StateMachine(GameState.TITLE);
      const result = sm.transition(GameState.CHARACTER_SELECT);
      assert.equal(result.from, GameState.TITLE);
      assert.equal(result.to, GameState.CHARACTER_SELECT);
    });

    it('transition() records history', () => {
      const sm = new StateMachine(GameState.TITLE);
      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      assert.deepEqual(sm.history, [GameState.TITLE, GameState.CHARACTER_SELECT]);
    });

    it('TITLE -> CHARACTER_SELECT -> OVERWORLD chain', () => {
      const sm = new StateMachine();
      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('OVERWORLD -> DUNGEON -> COMBAT -> VICTORY -> CAMP chain', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.transition(GameState.DUNGEON);
      sm.transition(GameState.COMBAT);
      sm.transition(GameState.VICTORY);
      sm.transition(GameState.CAMP);
      assert.equal(sm.current, GameState.CAMP);
    });

    it('OVERWORLD -> DUNGEON -> COMBAT -> DEFEAT -> CAMP chain', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.transition(GameState.DUNGEON);
      sm.transition(GameState.COMBAT);
      sm.transition(GameState.DEFEAT);
      sm.transition(GameState.CAMP);
      assert.equal(sm.current, GameState.CAMP);
    });

    it('DEFEAT -> TITLE (game over) path', () => {
      const sm = new StateMachine(GameState.DEFEAT);
      sm.transition(GameState.TITLE);
      assert.equal(sm.current, GameState.TITLE);
    });

    it('CAMP -> OVERWORLD', () => {
      const sm = new StateMachine(GameState.CAMP);
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('OVERWORLD -> TOWN -> OVERWORLD', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.transition(GameState.TOWN);
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('TOWN -> CAMP', () => {
      const sm = new StateMachine(GameState.TOWN);
      sm.transition(GameState.CAMP);
      assert.equal(sm.current, GameState.CAMP);
    });

    it('LOAD_GAME -> OVERWORLD', () => {
      const sm = new StateMachine(GameState.LOAD_GAME);
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('LOAD_GAME -> CAMP', () => {
      const sm = new StateMachine(GameState.LOAD_GAME);
      sm.transition(GameState.CAMP);
      assert.equal(sm.current, GameState.CAMP);
    });

    it('LOAD_GAME -> TITLE (corrupt save)', () => {
      const sm = new StateMachine(GameState.LOAD_GAME);
      sm.transition(GameState.TITLE);
      assert.equal(sm.current, GameState.TITLE);
    });

    it('VICTORY -> DUNGEON (next floor)', () => {
      const sm = new StateMachine(GameState.VICTORY);
      sm.transition(GameState.DUNGEON);
      assert.equal(sm.current, GameState.DUNGEON);
    });

    it('DUNGEON -> OVERWORLD (leave dungeon)', () => {
      const sm = new StateMachine(GameState.DUNGEON);
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('DEFEAT is not reachable from DUNGEON directly', () => {
      const sm = new StateMachine(GameState.DUNGEON);
      assert.ok(!sm.canTransition(GameState.DEFEAT));
    });

    it('DEFEAT is not reachable from OVERWORLD directly', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      assert.ok(!sm.canTransition(GameState.DEFEAT));
    });

    it('COMBAT cannot go directly to CAMP', () => {
      const sm = new StateMachine(GameState.COMBAT);
      assert.ok(!sm.canTransition(GameState.CAMP));
    });

    it('every state has at least one outgoing transition', () => {
      for (const state of Object.values(GameState)) {
        const targets = TRANSITIONS[state];
        assert.ok(targets && targets.length > 0, `${state} has no transitions`);
      }
    });

    it('fires beforeTransition event', () => {
      const sm = new StateMachine(GameState.TITLE);
      let fired = false;
      sm.on('beforeTransition', (e) => {
        fired = true;
        assert.equal(e.from, GameState.TITLE);
        assert.equal(e.to, GameState.CHARACTER_SELECT);
      });
      sm.transition(GameState.CHARACTER_SELECT);
      assert.ok(fired);
    });

    it('fires afterTransition event', () => {
      const sm = new StateMachine(GameState.TITLE);
      let fired = false;
      sm.on('afterTransition', (e) => {
        fired = true;
        assert.equal(e.from, GameState.TITLE);
        assert.equal(e.to, GameState.CHARACTER_SELECT);
      });
      sm.transition(GameState.CHARACTER_SELECT);
      assert.ok(fired);
    });

    it('afterTransition includes autoSave flag for CAMP', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      let autoSave = null;
      sm.on('afterTransition', (e) => { autoSave = e.autoSave; });
      sm.transition(GameState.CAMP);
      assert.equal(autoSave, 'entry');
    });

    it('afterTransition includes autoSave flag for TOWN', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      let autoSave = null;
      sm.on('afterTransition', (e) => { autoSave = e.autoSave; });
      sm.transition(GameState.TOWN);
      assert.equal(autoSave, 'townEntry');
    });

    it('COMBAT has no autoSave', () => {
      const sm = new StateMachine(GameState.DUNGEON);
      let autoSave = 'UNSET';
      sm.on('afterTransition', (e) => { autoSave = e.autoSave; });
      sm.transition(GameState.COMBAT);
      assert.isNull(autoSave);
    });

    it('off() removes listener', () => {
      const sm = new StateMachine(GameState.TITLE);
      let count = 0;
      const cb = () => ++count;
      sm.on('afterTransition', cb);
      sm.transition(GameState.CHARACTER_SELECT);
      assert.equal(count, 1);
      sm.off('afterTransition', cb);
      sm.transition(GameState.OVERWORLD);
      assert.equal(count, 1);
    });

    it('registerGuard() blocks transition when guard returns false', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.registerGuard(GameState.OVERWORLD, GameState.DUNGEON, () => false);
      assert.throws(() => sm.transition(GameState.DUNGEON));
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('registerGuard() allows transition when guard returns true', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.registerGuard(GameState.OVERWORLD, GameState.DUNGEON, () => true);
      sm.transition(GameState.DUNGEON);
      assert.equal(sm.current, GameState.DUNGEON);
    });

    it('guard receives context', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      let receivedCtx = null;
      sm.registerGuard(GameState.OVERWORLD, GameState.DUNGEON, (ctx) => {
        receivedCtx = ctx;
        return true;
      });
      sm.transition(GameState.DUNGEON, { dungeonId: 5 });
      assert.deepEqual(receivedCtx, { dungeonId: 5 });
    });

    it('serialize() captures current state and history', () => {
      const sm = new StateMachine(GameState.TITLE);
      sm.transition(GameState.CHARACTER_SELECT);
      sm.transition(GameState.OVERWORLD);
      const data = sm.serialize();
      assert.equal(data.current, GameState.OVERWORLD);
      assert.deepEqual(data.history, [GameState.TITLE, GameState.CHARACTER_SELECT]);
    });

    it('deserialize() restores state machine', () => {
      const data = { current: GameState.CAMP, history: [GameState.TITLE, GameState.OVERWORLD] };
      const sm = StateMachine.deserialize(data);
      assert.equal(sm.current, GameState.CAMP);
      assert.deepEqual(sm.history, [GameState.TITLE, GameState.OVERWORLD]);
    });

    it('deserialize() throws on invalid state', () => {
      assert.throws(() => StateMachine.deserialize({ current: 'INVALID' }));
    });

    it('deserialize() throws on null data', () => {
      assert.throws(() => StateMachine.deserialize(null));
    });

    it('deserialize() filters invalid history entries', () => {
      const data = { current: GameState.CAMP, history: ['BOGUS', GameState.TITLE] };
      const sm = StateMachine.deserialize(data);
      assert.deepEqual(sm.history, [GameState.TITLE]);
    });

    it('transition ctx is passed through events', () => {
      const sm = new StateMachine(GameState.TITLE);
      let receivedCtx = null;
      sm.on('afterTransition', (e) => { receivedCtx = e.ctx; });
      sm.transition(GameState.CHARACTER_SELECT, { roster: [1, 2] });
      assert.deepEqual(receivedCtx, { roster: [1, 2] });
    });

    it('AUTO_SAVE_TRIGGERS covers CAMP, TOWN, OVERWORLD, DUNGEON, VICTORY, DEFEAT, CHARACTER_SELECT', () => {
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.CAMP]);
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.TOWN]);
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.OVERWORLD]);
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.DUNGEON]);
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.VICTORY]);
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.DEFEAT]);
      assert.ok(AUTO_SAVE_TRIGGERS[GameState.CHARACTER_SELECT]);
    });

    it('COMBAT and TITLE have no auto-save trigger', () => {
      assert.isUndefined(AUTO_SAVE_TRIGGERS[GameState.COMBAT]);
      assert.isUndefined(AUTO_SAVE_TRIGGERS[GameState.TITLE]);
    });

    it('OVERWORLD can transition directly to COMBAT (random encounters)', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      assert.ok(sm.canTransition(GameState.COMBAT));
      sm.transition(GameState.COMBAT);
      assert.equal(sm.current, GameState.COMBAT);
    });

    it('COMBAT can transition to OVERWORLD (flee from overworld combat)', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.transition(GameState.COMBAT);
      assert.ok(sm.canTransition(GameState.OVERWORLD));
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });

    it('full overworld random encounter loop: OVERWORLD -> COMBAT -> VICTORY -> CAMP -> OVERWORLD', () => {
      const sm = new StateMachine(GameState.OVERWORLD);
      sm.transition(GameState.COMBAT);
      sm.transition(GameState.VICTORY);
      sm.transition(GameState.CAMP);
      sm.transition(GameState.OVERWORLD);
      assert.equal(sm.current, GameState.OVERWORLD);
    });
  });
})();
