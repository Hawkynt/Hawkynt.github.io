;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { CombatGrid, CombatUnit, Pathfinding, D20, EnemyAI, Character, Terrain, Spells, CLASSES, CombatPhase } = TR;
  const { ENEMY_TEMPLATES, CREATURE_TYPES, BOSS_TEMPLATES, templateToCharacter, getBossPhase } = TR.CombatTemplates;
  const CombatEngine = TR.CombatEngine;

  Object.assign(CombatEngine.prototype, {
    checkVictory() {
      return this._units.filter(u => u.faction === 'enemy').every(u => this._out(u));
    },

    checkDefeat() {
      return this._units.filter(u => u.faction === 'party').every(u => this._out(u));
    },

    // Conditions on a unit right now (ids), e.g. ['paralyzed'].
    conditionsOf(unitId) {
      return this._conditions ? this._conditions.getActive(unitId).map(c => c.conditionId) : [];
    },

    // Puts a condition on a unit unless it is immune; durations in rounds,
    // -1 lasts the whole battle.
    applyCondition(unitId, conditionId, rounds, source) {
      const unit = this.unitById(unitId);
      if (!unit || !this._conditions || !unit.isAlive)
        return false;
      if (TR.MonsterAbilities && TR.MonsterAbilities.immuneToCondition(unit, conditionId))
        return false;
      this._conditions.apply(unit.id, conditionId, rounds, source || '');
      this._syncUnit(unit);
      return true;
    },

    _resetEffects() {
      this._conditions = TR.ConditionTracker ? new TR.ConditionTracker() : null;
      this._cooldowns = new Map();
      this._auraDone = new Set();
      this._skipGuard = 0;
    },

    _effects(unit) {
      return this._conditions && unit ? this._conditions.getEffects(unit.id) : null;
    },

    _drainedLevels(unit) {
      return this._conditions ? this._conditions.getActive(unit.id).filter(c => c.conditionId === 'energy_drained').length : 0;
    },

    _syncUnit(unit) {
      const fx = this._effects(unit);
      unit.setConditions(this.conditionsOf(unit.id), fx ? fx.speedMult : 1);
    },

    _out(u) {
      return !u.isAlive || (!!this._conditions && this._conditions.has(u.id, 'petrified'));
    },

    _save(unit, kind, dc) {
      const fx = this._effects(unit);
      const bonus = TR.MonsterAbilities.saveBonus(unit, kind, (fx ? fx.savePenalty : 0) - this._drainedLevels(unit));
      return D20.savingThrow(this._prng, bonus, 0, 0, dc).success;
    },

    _beginTurnEffects(unit) {
      this._planeTurnEffects(unit);
      if (!unit.isAlive)
        return false;
      if (this._conditions) {
        const expired = this._conditions.tickRound(unit.id);
        if (expired.length) {
          this._syncUnit(unit);
          this._combatLog.push(`${unit.logName} recovers (${expired.join(', ')})`);
        }
      }
      const a = TR.MonsterAbilities ? TR.MonsterAbilities.parse(unit.character) : null;
      const healing = a ? (a.regen || a.fastHeal) : 0;
      if (healing && unit.isAlive && unit.currentHp < unit.maxHp) {
        unit.heal(healing);
        this._combatLog.push(`${unit.logName} regenerates ${healing} HP`);
      }
      const fx = this._effects(unit);
      if (fx && fx.canAct === false) {
        this._combatLog.push(`${unit.logName} is ${fx.conditions.join(', ')} and loses the turn`);
        return false;
      }
      if (fx && fx.conditions.includes('confused') && this._prng.next() < 0.5) {
        this._combatLog.push(`${unit.logName} staggers about in confusion`);
        return false;
      }
      return true;
    },

    // Spell damage after spell resistance and energy defences.
    _spellDamage(caster, target, spell, raw) {
      const MA = TR.MonsterAbilities;
      raw = this._planeSpellDamage(spell, raw);
      if (!MA || caster.faction === target.faction)
        return raw;
      const a = MA.parse(target.character);
      if (a && a.sr) {
        const sr = D20.spellResistanceCheck(this._prng, caster.character.level || 1, a.sr);
        if (!sr.overcome) {
          this._combatLog.push(`  ${target.logName} shrugs off ${spell.name} (SR ${a.sr})`);
          return 0;
        }
      }
      const el = MA.spellElement(spell);
      if (!el)
        return raw;
      const adj = MA.adjustDamage(target, raw, el);
      if (adj.note)
        this._combatLog.push(`  ${target.logName}: ${adj.note}`);
      return adj.amount;
    },

    // Extra effects of a monster's hit: poison, paralysis, drain, disease,
    // blood drain, grab and constrict, rend. Returns [{ unitId, text }].
    _applyRiders(attacker, defender, attacks) {
      const MA = TR.MonsterAbilities;
      const a = MA ? MA.parse(attacker.character) : null;
      if (!a || !a.riders.length || attacker.faction === defender.faction)
        return [];
      const out = [];
      const ch = attacker.character;
      const dc = MA.saveDC(ch, 'con');
      const note = (text, color) => out.push({ unitId: defender.id, text, color });
      const roll = (n, d) => D20.damageRoll(this._prng, n, d, 0, 0).total;
      const riders = new Set(a.riders);
      for (const r of riders) {
        if (!defender.isAlive)
          break;
        switch (r) {
          case 'poison':
            if (MA.isImmune(defender, 'poison'))
              break;
            if (this._save(defender, 'fort', dc)) {
              note('Resists poison', '#a8e0a8');
              break;
            }
            defender.takeDamage(roll(1, 6));
            this.applyCondition(defender.id, 'sickened', 3, ch.name);
            note('Poisoned', '#7ac85a');
            this._combatLog.push(`  ${defender.logName} is poisoned`);
            break;
          case 'paralysis':
            if (MA.immuneToCondition(defender, 'paralyzed') || this._save(defender, 'fort', dc))
              break;
            if (this.applyCondition(defender.id, 'paralyzed', this._prng.nextInt(2, 5), ch.name)) {
              note('Paralyzed', '#f0e080');
              this._combatLog.push(`  ${defender.logName} is paralyzed`);
            }
            break;
          case 'drain':
            if (this.applyCondition(defender.id, 'energy_drained', 10, ch.name)) {
              attacker.heal(5);
              note('Drained', '#b88ae8');
              this._combatLog.push(`  ${defender.logName} loses life energy`);
            }
            break;
          case 'weaken':
            if (this.applyCondition(defender.id, 'fatigued', 4, ch.name))
              note('Weakened', '#c8b8a0');
            break;
          case 'disease':
            if (!this._save(defender, 'fort', dc) && this.applyCondition(defender.id, 'sickened', 4, ch.name))
              note('Diseased', '#9ab84a');
            break;
          case 'blood': {
            const d = roll(1, 4);
            defender.takeDamage(d);
            attacker.heal(d);
            note('Blood drained', '#e84838');
            break;
          }
          case 'grab': {
            const order = MA.SIZE_ORDER;
            const sa = order.indexOf(ch.size || 'M'), sd = order.indexOf(defender.character.size || 'M');
            if (sa < sd)
              break;
            const grip = s => [-16, -12, -8, -4, 0, 4, 8, 12, 16][s] || 0;
            const mine = D20.grappleCheck(this._prng, attacker.bab, attacker.strMod, grip(sa), 0).total;
            const theirs = D20.grappleCheck(this._prng, defender.bab, defender.strMod, grip(sd), 0).total;
            if (mine < theirs)
              break;
            this.applyCondition(defender.id, 'grappled', 1, ch.name);
            if (riders.has('constrict')) {
              const d = roll(ch.damageDice || 1, ch.damageSides || 6) + attacker.strMod;
              defender.takeDamage(Math.max(1, d));
              note('Crushed', '#e8a870');
              this._combatLog.push(`  ${attacker.logName} constricts ${defender.logName} (${Math.max(1, d)} dmg)`);
            } else
              note('Grabbed', '#e8c878');
            break;
          }
          case 'rend':
            if (attacks.filter(x => x.hit && x.name === 'claw').length >= 2) {
              const d = Math.max(1, roll(2, 6) + Math.floor(attacker.strMod * 1.5));
              defender.takeDamage(d);
              note('Rent', '#e84838');
              this._combatLog.push(`  ${attacker.logName} rends ${defender.logName} (${d} dmg)`);
            }
            break;
          default:
            break;
        }
      }
      return out;
    },

    // --- monster special actions ---

    _ready(unit, key) {
      const cd = this._cooldowns.get(unit.id);
      return !cd || !(cd[key] > this._round);
    },

    _cooldown(unit, key, rounds) {
      const cd = this._cooldowns.get(unit.id) || {};
      cd[key] = this._round + rounds;
      this._cooldowns.set(unit.id, cd);
    },

    // A special the monster should use now, or null.
    nextTurn() {
      this._turnIndex = (this._turnIndex + 1) % this._turnOrder.length;
      if (this._turnIndex === 0) {
        ++this._round;
        this._combatLog.push(`--- Round ${this._round} ---`);
      }
      this._phase = CombatPhase.TURN_START;
    },

    getAttackTargets(unitId) {
      const unit = this.unitById(unitId);
      if (!unit)
        return [];
      const pos = unit.position;
      const targets = [];
      for (const other of this._units) {
        if (other.faction === unit.faction || !other.isAlive)
          continue;
        if (D20.isAdjacent(pos, other.position, D20.attackReach(unit.character)))
          targets.push(other.id);
      }
      return targets;
    },

    getRewards() {
      let xp = 0;
      let gold = 0;
      let maxCr = 0;
      for (const u of this._units) {
        if (u.faction !== 'enemy' || u.isAlive)
          continue;
        const ch = u.character;
        const tmpl = ENEMY_TEMPLATES[ch.class];
        if (ch.xpReward !== undefined) {
          xp += ch.xpReward;
          gold += ch.goldReward || 0;
        } else if (tmpl) {
          xp += tmpl.xpReward || 0;
          gold += tmpl.goldReward || 0;
        }
        const cr = tmpl ? (tmpl.cr || 1) : (ch.level || 1);
        if (cr > maxCr)
          maxCr = cr;
      }
      const Items = TR.Items;
      const loot = Items ? Items.generateLoot(this._prng, maxCr) : [];
      return { xp, gold, loot };
    },

    unitById(id) {
      return this._units.find(u => u.id === id) || null;
    },

    on(event, cb) {
      if (!this._listeners.has(event))
        this._listeners.set(event, []);
      this._listeners.get(event).push(cb);
    },

    off(event, cb) {
      const list = this._listeners.get(event);
      if (!list)
        return;
      const idx = list.indexOf(cb);
      if (idx >= 0)
        list.splice(idx, 1);
    },

    _emit(event, data) {
      const list = this._listeners.get(event);
      if (list)
        for (const cb of list)
          cb(data);
    },
  });
})();
