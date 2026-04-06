;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  // Condition definitions
  const CONDITIONS = Object.freeze({
    blinded:    Object.freeze({ id: 'blinded',    name: 'Blinded',    effects: { loseDex: true, acPenalty: -2, attackPenalty: -4, speedMult: 0.5 }, stackable: false }),
    charmed:    Object.freeze({ id: 'charmed',    name: 'Charmed',    effects: { cannotAttackSource: true }, stackable: false }),
    confused:   Object.freeze({ id: 'confused',   name: 'Confused',   effects: { randomAction: true }, stackable: false }),
    cowering:   Object.freeze({ id: 'cowering',   name: 'Cowering',   effects: { canAct: false, loseDex: true, acPenalty: -2 }, stackable: false }),
    dazed:      Object.freeze({ id: 'dazed',      name: 'Dazed',      effects: { canAct: false }, stackable: false }),
    dazzled:    Object.freeze({ id: 'dazzled',    name: 'Dazzled',    effects: { attackPenalty: -1, searchPenalty: -1, spotPenalty: -1 }, stackable: false }),
    deafened:   Object.freeze({ id: 'deafened',   name: 'Deafened',   effects: { initPenalty: -4, spellFailure: 20 }, stackable: false }),
    disabled:   Object.freeze({ id: 'disabled',   name: 'Disabled',   effects: { limitedActions: true }, stackable: false }),
    dying:      Object.freeze({ id: 'dying',      name: 'Dying',      effects: { canAct: false, bleedPerRound: 1 }, stackable: false }),
    energy_drained: Object.freeze({ id: 'energy_drained', name: 'Energy Drained', effects: { negativeLevels: true }, stackable: true }),
    entangled:  Object.freeze({ id: 'entangled',  name: 'Entangled',  effects: { speedMult: 0.5, attackPenalty: -2, dexPenalty: -4 }, stackable: false }),
    exhausted:  Object.freeze({ id: 'exhausted',  name: 'Exhausted',  effects: { strPenalty: -6, dexPenalty: -6, speedMult: 0.5 }, stackable: false }),
    fascinated: Object.freeze({ id: 'fascinated', name: 'Fascinated', effects: { canAct: false, vulnerableToApproach: true }, stackable: false }),
    fatigued:   Object.freeze({ id: 'fatigued',   name: 'Fatigued',   effects: { strPenalty: -2, dexPenalty: -2, cannotRun: true }, stackable: false }),
    flat_footed:Object.freeze({ id: 'flat_footed',name: 'Flat-Footed',effects: { loseDex: true }, stackable: false }),
    frightened: Object.freeze({ id: 'frightened', name: 'Frightened', effects: { mustFlee: true, attackPenalty: -2, savePenalty: -2, skillPenalty: -2 }, stackable: false }),
    grappled:   Object.freeze({ id: 'grappled',   name: 'Grappled',   effects: { cannotMove: true, dexPenalty: -4, attackPenalty: -4 }, stackable: false }),
    helpless:   Object.freeze({ id: 'helpless',   name: 'Helpless',   effects: { canAct: false, dexScore: 0, acPenalty: -5, vulnerableToCoup: true }, stackable: false }),
    incorporeal:Object.freeze({ id: 'incorporeal',name: 'Incorporeal',effects: { passThrough: true, only50PercentDamage: true }, stackable: false }),
    invisible:  Object.freeze({ id: 'invisible',  name: 'Invisible',  effects: { attackBonus: 2, targetAcPenalty: -2, concealTotal: true }, stackable: false }),
    nauseated:  Object.freeze({ id: 'nauseated',  name: 'Nauseated',  effects: { canOnlyMove: true, cannotAttack: true, cannotCast: true }, stackable: false }),
    panicked:   Object.freeze({ id: 'panicked',   name: 'Panicked',   effects: { mustFlee: true, dropItems: true, savePenalty: -2, skillPenalty: -2 }, stackable: false }),
    paralyzed:  Object.freeze({ id: 'paralyzed',  name: 'Paralyzed',  effects: { canAct: false, dexScore: 0, strScore: 0, helpless: true }, stackable: false }),
    petrified:  Object.freeze({ id: 'petrified',  name: 'Petrified',  effects: { canAct: false, unconscious: true, hardness: 8 }, stackable: false }),
    prone:      Object.freeze({ id: 'prone',      name: 'Prone',      effects: { meleeAttackPenalty: -4, rangedDefenseBonus: 4, standProvokesAoO: true }, stackable: false }),
    shaken:     Object.freeze({ id: 'shaken',     name: 'Shaken',     effects: { attackPenalty: -2, savePenalty: -2, skillPenalty: -2 }, stackable: false }),
    sickened:   Object.freeze({ id: 'sickened',   name: 'Sickened',   effects: { attackPenalty: -2, damagePenalty: -2, savePenalty: -2, skillPenalty: -2 }, stackable: false }),
    slowed:     Object.freeze({ id: 'slowed',     name: 'Slowed',     effects: { speedMult: 0.5, acPenalty: -1, attackPenalty: -1, refPenalty: -1 }, stackable: false }),
    stunned:    Object.freeze({ id: 'stunned',    name: 'Stunned',    effects: { canAct: false, loseDex: true, acPenalty: -2 }, stackable: false }),
    turned:     Object.freeze({ id: 'turned',     name: 'Turned',     effects: { mustFlee: true }, stackable: false }),
    unconscious:Object.freeze({ id: 'unconscious',name: 'Unconscious',effects: { canAct: false, helpless: true }, stackable: false }),
  });

  // Active condition on a unit: { conditionId, remainingRounds, source, stacks }
  class ConditionTracker {
    #active;   // Map<unitId, Array<{ conditionId, remainingRounds, source, stacks }>>

    constructor() {
      this.#active = new Map();
    }

    apply(unitId, conditionId, duration, source) {
      const def = CONDITIONS[conditionId];
      if (!def) return false;

      if (!this.#active.has(unitId))
        this.#active.set(unitId, []);

      const list = this.#active.get(unitId);
      const existing = list.find(c => c.conditionId === conditionId);

      if (existing && !def.stackable) {
        // Refresh duration if longer
        if (duration > existing.remainingRounds)
          existing.remainingRounds = duration;
        return true;
      }

      list.push({ conditionId, remainingRounds: duration, source: source || '', stacks: 1 });
      return true;
    }

    remove(unitId, conditionId) {
      const list = this.#active.get(unitId);
      if (!list) return false;
      const idx = list.findIndex(c => c.conditionId === conditionId);
      if (idx < 0) return false;
      list.splice(idx, 1);
      return true;
    }

    has(unitId, conditionId) {
      const list = this.#active.get(unitId);
      return list ? list.some(c => c.conditionId === conditionId) : false;
    }

    getActive(unitId) {
      return (this.#active.get(unitId) || []).map(c => ({
        ...c,
        definition: CONDITIONS[c.conditionId],
      }));
    }

    // Called at the start of each unit's turn — tick down durations
    tickRound(unitId) {
      const list = this.#active.get(unitId);
      if (!list) return [];

      const expired = [];
      for (let i = list.length - 1; i >= 0; --i) {
        if (list[i].remainingRounds > 0) {
          --list[i].remainingRounds;
          if (list[i].remainingRounds <= 0) {
            expired.push(list[i].conditionId);
            list.splice(i, 1);
          }
        }
        // remainingRounds === -1 means permanent until removed
      }
      return expired;
    }

    // Get aggregate effects for a unit
    getEffects(unitId) {
      const list = this.#active.get(unitId);
      if (!list || list.length === 0) return null;

      const effects = {
        canAct: true,
        canMove: true,
        canAttack: true,
        canCast: true,
        attackPenalty: 0,
        damagePenalty: 0,
        acPenalty: 0,
        savePenalty: 0,
        speedMult: 1,
        loseDex: false,
        mustFlee: false,
        conditions: [],
      };

      for (const entry of list) {
        const def = CONDITIONS[entry.conditionId];
        if (!def) continue;
        effects.conditions.push(def.id);
        const e = def.effects;
        if (e.canAct === false) effects.canAct = false;
        if (e.cannotMove) effects.canMove = false;
        if (e.cannotAttack || e.canOnlyMove) effects.canAttack = false;
        if (e.cannotCast) effects.canCast = false;
        if (e.attackPenalty) effects.attackPenalty += e.attackPenalty;
        if (e.damagePenalty) effects.damagePenalty += e.damagePenalty;
        if (e.acPenalty) effects.acPenalty += e.acPenalty;
        if (e.savePenalty) effects.savePenalty += e.savePenalty;
        if (e.speedMult && e.speedMult < effects.speedMult) effects.speedMult = e.speedMult;
        if (e.loseDex) effects.loseDex = true;
        if (e.mustFlee) effects.mustFlee = true;
      }

      return effects;
    }

    clear() {
      this.#active.clear();
    }

    clearUnit(unitId) {
      this.#active.delete(unitId);
    }
  }

  TR.CONDITIONS = CONDITIONS;
  TR.ConditionTracker = ConditionTracker;
})();
