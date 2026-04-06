;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const GameState = Object.freeze({
    TITLE: 'TITLE',
    LOAD_GAME: 'LOAD_GAME',
    CHARACTER_SELECT: 'CHARACTER_SELECT',
    OVERWORLD: 'OVERWORLD',
    TOWN: 'TOWN',
    DUNGEON: 'DUNGEON',
    COMBAT: 'COMBAT',
    VICTORY: 'VICTORY',
    DEFEAT: 'DEFEAT',
    CAMP: 'CAMP'
  });

  const TRANSITIONS = Object.freeze({
    [GameState.TITLE]:            [GameState.CHARACTER_SELECT, GameState.LOAD_GAME],
    [GameState.LOAD_GAME]:        [GameState.OVERWORLD, GameState.CAMP, GameState.TITLE],
    [GameState.CHARACTER_SELECT]: [GameState.OVERWORLD],
    [GameState.OVERWORLD]:        [GameState.DUNGEON, GameState.TOWN, GameState.CAMP, GameState.COMBAT],
    [GameState.TOWN]:             [GameState.OVERWORLD, GameState.CAMP],
    [GameState.DUNGEON]:          [GameState.COMBAT, GameState.OVERWORLD],
    [GameState.COMBAT]:           [GameState.VICTORY, GameState.DEFEAT, GameState.OVERWORLD],
    [GameState.VICTORY]:          [GameState.DUNGEON, GameState.CAMP],
    [GameState.DEFEAT]:           [GameState.CAMP, GameState.TITLE],
    [GameState.CAMP]:             [GameState.OVERWORLD]
  });

  const AUTO_SAVE_TRIGGERS = Object.freeze({
    [GameState.CHARACTER_SELECT]: 'partyConfirm',
    [GameState.OVERWORLD]: 'zoneEntry',
    [GameState.TOWN]: 'townEntry',
    [GameState.DUNGEON]: 'floorEntry',
    [GameState.VICTORY]: 'rewardsCollected',
    [GameState.DEFEAT]: 'retreat',
    [GameState.CAMP]: 'entry'
  });

  class StateMachine {
    #current;
    #listeners;
    #guards;
    #history;

    constructor(initial) {
      this.#current = initial || GameState.TITLE;
      this.#listeners = new Map();
      this.#guards = new Map();
      this.#history = [];
    }

    get current() {
      return this.#current;
    }

    get history() {
      return this.#history.slice();
    }

    canTransition(target) {
      const allowed = TRANSITIONS[this.#current];
      return allowed ? allowed.includes(target) : false;
    }

    validTransitions() {
      return (TRANSITIONS[this.#current] || []).slice();
    }

    transition(target, ctx) {
      if (!this.canTransition(target))
        throw new Error(`Invalid transition: ${this.#current} -> ${target}`);

      const guardKey = `${this.#current}->${target}`;
      const guard = this.#guards.get(guardKey);
      if (guard && !guard(ctx))
        throw new Error(`Guard rejected transition: ${this.#current} -> ${target}`);

      const from = this.#current;
      const autoSave = AUTO_SAVE_TRIGGERS[target] || null;

      this.#emit('beforeTransition', { from, to: target, ctx, autoSave });

      this.#history.push(from);
      this.#current = target;

      this.#emit('afterTransition', { from, to: target, ctx, autoSave });

      return { from, to: target, autoSave };
    }

    on(event, cb) {
      if (!this.#listeners.has(event))
        this.#listeners.set(event, []);
      this.#listeners.get(event).push(cb);
    }

    off(event, cb) {
      const list = this.#listeners.get(event);
      if (!list)
        return;
      const idx = list.indexOf(cb);
      if (idx >= 0)
        list.splice(idx, 1);
    }

    registerGuard(from, to, fn) {
      this.#guards.set(`${from}->${to}`, fn);
    }

    serialize() {
      return {
        current: this.#current,
        history: this.#history.slice()
      };
    }

    static deserialize(data) {
      if (!data || !GameState[data.current])
        throw new Error('Invalid state machine data');
      const sm = new StateMachine(data.current);
      if (Array.isArray(data.history))
        sm.#history = data.history.filter(s => GameState[s]);
      return sm;
    }

    #emit(event, detail) {
      const list = this.#listeners.get(event);
      if (!list)
        return;
      for (const cb of list)
        cb(detail);
    }
  }

  TR.GameState = GameState;
  TR.StateMachine = StateMachine;
  TR.TRANSITIONS = TRANSITIONS;
  TR.AUTO_SAVE_TRIGGERS = AUTO_SAVE_TRIGGERS;
})();
