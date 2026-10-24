;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { CombatGrid, CombatUnit, Pathfinding, D20, EnemyAI, Character, Terrain, Spells, CLASSES, CombatPhase } = TR;
  const { ENEMY_TEMPLATES, CREATURE_TYPES, BOSS_TEMPLATES, templateToCharacter, getBossPhase } = TR.CombatTemplates;
  const CombatEngine = TR.CombatEngine;

  Object.assign(CombatEngine.prototype, {
    executeEnemyTurn(unitId) {
      const unit = this.unitById(unitId);
      if (!unit || unit.faction !== 'enemy' || !unit.isAlive || !unit.isConscious)
        return;

      unit.beginTurn();
      const partyUnits = this._units.filter(u => u.faction === 'party' && u.isAlive && !this.conditionsOf(u.id).includes('petrified'));
      this._maybeAura(unit, partyUnits);
      const special = this._chooseSpecial(unit, partyUnits);
      if (special) {
        this._resolveSpecial(unit, special);
        unit.endAction();
        if (this._phase !== CombatPhase.VICTORY && this._phase !== CombatPhase.DEFEAT)
          this._phase = CombatPhase.TURN_END;
        return;
      }
      const allEnemyUnits = this._aiTier >= 3 ? this._units.filter(u => u.faction === 'enemy' && u.isAlive) : null;

      // Tier 4: the first enemy to act each round plans for all of them
      if (this._aiTier >= 4 && this._plannedRound !== this._round) {
        this._plannedRound = this._round;
        this.planEnemyRound();
      }
      let decision = null;
      if (this._aiTier >= 4 && this._coordinatedPlan && this._coordinatedPlan.has(unitId)) {
        decision = this._coordinatedPlan.get(unitId);
        // the plan was made before others moved; drop steps that no longer fit
        if (!this._planStillValid(unit, decision))
          decision = null;
      }
      if (!decision)
        decision = EnemyAI.decide(this._grid, unit, partyUnits, this._prng, this._aiTier, allEnemyUnits);

      if (decision.type === 'attack') {
        this.resolveAttack(unit.id, decision.target);
      } else if (decision.type === 'move_and_attack') {
        this._grid.moveUnit(unit.id, decision.moveTo.col, decision.moveTo.row);
        unit.setPosition(decision.moveTo.col, decision.moveTo.row);
        unit.endMove();
        this.resolveAttack(unit.id, decision.target);
      } else if (decision.type === 'spell') {
        this.resolveSpell(unit.id, decision.target, decision.spellId);
      } else if (decision.type === 'move_and_spell') {
        this._grid.moveUnit(unit.id, decision.moveTo.col, decision.moveTo.row);
        unit.setPosition(decision.moveTo.col, decision.moveTo.row);
        unit.endMove();
        this.resolveSpell(unit.id, decision.target, decision.spellId);
      } else if (decision.type === 'move') {
        this._grid.moveUnit(unit.id, decision.moveTo.col, decision.moveTo.row);
        unit.setPosition(decision.moveTo.col, decision.moveTo.row);
        unit.endMove();
        this._combatLog.push(`${unit.logName} moves to (${decision.moveTo.col},${decision.moveTo.row})`);
      } else {
        this._combatLog.push(`${unit.logName} waits`);
      }

      unit.endAction();
      if (this._phase !== CombatPhase.VICTORY && this._phase !== CombatPhase.DEFEAT)
        this._phase = CombatPhase.TURN_END;
    },

    _planStillValid(unit, d) {
      if (!d || !d.type)
        return false;
      if (d.moveTo) {
        const { col, row } = d.moveTo;
        if (!this._grid.inBounds(col, row))
          return false;
        const occupant = this._grid.unitAt(col, row);
        if (occupant && occupant !== unit.id)
          return false;
        const range = Pathfinding.movementRange(this._grid, unit.position, unit.speedTiles, unit.faction, unit.passMode);
        if (!(col === unit.position.col && row === unit.position.row) && !range.has(`${col},${row}`))
          return false;
      }
      if (d.target) {
        const t = this.unitById(d.target);
        if (!t || !t.isAlive)
          return false;
        if (d.type === 'attack' || d.type === 'move_and_attack') {
          const from = d.moveTo || unit.position;
          if (!D20.isAdjacent(from, t.position))
            return false;
        }
      }
      return true;
    },

    // Called at the start of each enemy round for tier 4 coordination
    planEnemyRound() {
      if (this._aiTier < 4) {
        this._coordinatedPlan = null;
        return;
      }
      const enemyUnits = this._units.filter(u => u.faction === 'enemy' && u.isAlive && u.isConscious);
      const partyUnits = this._units.filter(u => u.faction === 'party' && u.isAlive);
      this._coordinatedPlan = EnemyAI.coordinatedDecide(this._grid, enemyUnits, partyUnits, this._prng);
    },

    _chooseSpecial(unit, foes) {
      const MA = TR.MonsterAbilities;
      const a = MA ? MA.parse(unit.character) : null;
      if (!a || !foes.length)
        return null;
      const friends = this._units.filter(u => u.faction === unit.faction && u.isAlive);
      const adjacent = foes.some(f => D20.isAdjacent(unit.position, f.position));
      const near = (range, pred = () => true) => foes
        .filter(f => MA.distance(unit.position, f.position) <= range && pred(f))
        .sort((x, y) => MA.distance(unit.position, x.position) - MA.distance(unit.position, y.position));
      if (a.breath && this._ready(unit, 'breath')) {
        const area = MA.bestArea(this._grid, unit, foes, friends, a.breath.shape, a.breath.length);
        if (area && !area.own.length && (area.hit.length >= 2 || !adjacent))
          return { kind: 'breath', area };
      }
      if (a.specials.includes('mindblast') && this._ready(unit, 'mindblast')) {
        const area = MA.bestArea(this._grid, unit, foes, friends, 'cone', 6);
        if (area && !area.own.length && (area.hit.length >= 2 || !adjacent))
          return { kind: 'mindblast', area };
      }
      if (a.gaze && this._ready(unit, 'gaze')) {
        const t = near(6, f => !this.conditionsOf(f.id).includes('petrified'))[0];
        if (t)
          return { kind: 'gaze', target: t };
      }
      if (a.specials.includes('rays') && this._ready(unit, 'rays')) {
        const ts = near(8);
        if (ts.length)
          return { kind: 'rays', targets: ts.slice(0, 3) };
      }
      if (!adjacent) {
        if (a.specials.includes('web') && this._ready(unit, 'web')) {
          const t = near(6, f => !this.conditionsOf(f.id).includes('entangled'))[0];
          if (t)
            return { kind: 'web', target: t };
        }
        if (a.specials.includes('spit') && this._ready(unit, 'spit')) {
          const t = near(5)[0];
          if (t)
            return { kind: 'spit', target: t };
        }
        if (a.specials.includes('rock')) {
          const t = near(10, f => MA.distance(unit.position, f.position) >= 2)[0];
          if (t)
            return { kind: 'rock', target: t };
        }
      }
      return null;
    },

    // Fear auras (frightful presence) wash over the party once per battle.
    _maybeAura(unit, foes) {
      const MA = TR.MonsterAbilities;
      const a = MA ? MA.parse(unit.character) : null;
      if (!a || !a.aura || this._auraDone.has(unit.id))
        return;
      this._auraDone.add(unit.id);
      const dc = MA.saveDC(unit.character, 'cha');
      for (const f of foes)
        if (MA.distance(unit.position, f.position) <= 6 && !this._save(f, 'will', dc)
            && this.applyCondition(f.id, 'shaken', this._prng.nextInt(3, 6), unit.character.name))
          this._combatLog.push(`  ${f.logName} is shaken by ${unit.logName}`);
    },

    _resolveSpecial(unit, sp) {
      const MA = TR.MonsterAbilities;
      const a = MA.parse(unit.character);
      const ch = unit.character;
      const roll = (n, d) => D20.damageRoll(this._prng, n, d, 0, 0).total;
      const results = [];
      const hurt = (t, dmg, energy) => {
        const adj = energy ? MA.adjustDamage(t, dmg, energy) : { amount: dmg };
        t.takeDamage(adj.amount);
        return adj.amount;
      };
      const condition = (t, cond, rounds, text) => {
        if (this.applyCondition(t.id, cond, rounds, ch.name)) {
          results.push({ unit: t, damage: 0, effect: text });
          return true;
        }
        results.push({ unit: t, damage: 0, effect: 'Unaffected' });
        return false;
      };
      let name = '', element = 'arcane', shape = null, special = sp.kind;
      switch (sp.kind) {
        case 'breath': {
          const b = a.breath;
          const dc = MA.saveDC(ch, 'con');
          shape = b.shape;
          element = b.effect ? b.effect.element : b.poison ? 'poison' : (b.energy === 'electricity' ? 'lightning' : b.energy === 'cold' ? 'frost' : b.energy || 'fire');
          name = `${b.word.replace(/_/g, ' ')} breath`.replace(/^\w/, c => c.toUpperCase());
          for (const t of sp.area.hit) {
            if (b.effect) {
              if (this._save(t, b.effect.save, dc))
                results.push({ unit: t, damage: 0, effect: 'Resists' });
              else
                condition(t, b.effect.condition, this._prng.nextInt(b.effect.rounds[0], b.effect.rounds[1]), b.effect.condition.replace(/_/g, ' '));
              continue;
            }
            let dmg = roll(b.dice, b.sides);
            const saved = this._save(t, b.poison ? 'fort' : 'ref', dc);
            if (saved)
              dmg = Math.floor(dmg / 2);
            results.push({ unit: t, damage: hurt(t, dmg, b.energy), effect: saved ? 'Half' : null });
          }
          this._cooldown(unit, 'breath', this._prng.nextInt(1, 4) + 1);
          break;
        }
        case 'mindblast': {
          const dc = MA.saveDC(ch, 'cha');
          name = 'Mind blast';
          element = 'psychic';
          shape = 'cone';
          for (const t of sp.area.hit)
            if (this._save(t, 'will', dc))
              results.push({ unit: t, damage: 0, effect: 'Resists' });
            else
              condition(t, 'stunned', this._prng.nextInt(1, 4), 'Stunned');
          this._cooldown(unit, 'mindblast', this._prng.nextInt(1, 4) + 1);
          break;
        }
        case 'gaze': {
          const g = a.gaze;
          const dc = MA.saveDC(ch, g.ability);
          const t = sp.target;
          name = { petrify: 'Petrifying gaze', stun: 'Stunning gaze', confuse: 'Maddening gaze', death: 'Deathly gaze' }[g.kind];
          element = g.kind === 'petrify' ? 'earth' : g.kind === 'death' ? 'necrotic' : 'psychic';
          if (this._save(t, g.save, dc))
            results.push({ unit: t, damage: 0, effect: 'Looks away' });
          else if (g.kind === 'petrify')
            condition(t, 'petrified', -1, 'Petrified');
          else if (g.kind === 'stun')
            condition(t, 'stunned', this._prng.nextInt(1, 4), 'Stunned');
          else if (g.kind === 'confuse')
            condition(t, 'confused', this._prng.nextInt(2, 5), 'Confused');
          else
            results.push({ unit: t, damage: hurt(t, roll(6, 6)), effect: null });
          this._cooldown(unit, 'gaze', 2);
          break;
        }
        case 'rays': {
          name = 'Eye rays';
          element = 'arcane';
          const dc = MA.saveDC(ch, 'cha');
          const kinds = ['fire', 'cold', 'petrify', 'sleep', 'slow', 'fear', 'wound', 'disintegrate'];
          for (let i = 0; i < 3 && sp.targets.length; ++i) {
            const t = sp.targets[i % sp.targets.length];
            if (!t.isAlive)
              continue;
            const k = kinds[this._prng.nextInt(0, kinds.length - 1)];
            if (k === 'fire' || k === 'cold') {
              let d = roll(4, 6);
              if (this._save(t, 'ref', dc))
                d = Math.floor(d / 2);
              results.push({ unit: t, damage: hurt(t, d, k), effect: `${k} ray` });
            } else if (k === 'wound' || k === 'disintegrate') {
              const saved = this._save(t, k === 'wound' ? 'will' : 'fort', dc);
              const d = k === 'wound' ? roll(3, 8) : saved ? roll(5, 6) : roll(10, 6);
              results.push({ unit: t, damage: hurt(t, k === 'wound' && saved ? Math.floor(d / 2) : d), effect: k === 'wound' ? 'Wounding ray' : 'Disintegrating ray' });
            } else if (this._save(t, k === 'petrify' ? 'fort' : 'will', dc))
              results.push({ unit: t, damage: 0, effect: 'Resists' });
            else
              condition(t, { petrify: 'petrified', sleep: 'unconscious', slow: 'slowed', fear: 'shaken' }[k], k === 'petrify' ? -1 : this._prng.nextInt(2, 4), `${k} ray`);
          }
          this._cooldown(unit, 'rays', 1);
          break;
        }
        case 'web': {
          name = 'Web';
          element = 'nature';
          const dc = MA.saveDC(ch, 'con');
          if (this._save(sp.target, 'ref', dc))
            results.push({ unit: sp.target, damage: 0, effect: 'Dodges' });
          else
            condition(sp.target, 'entangled', 2, 'Entangled');
          this._cooldown(unit, 'web', 3);
          break;
        }
        case 'spit': {
          name = 'Spit';
          element = 'acid';
          const dc = MA.saveDC(ch, 'con');
          let d = roll(2, 6);
          if (this._save(sp.target, 'ref', dc))
            d = Math.floor(d / 2);
          results.push({ unit: sp.target, damage: hurt(sp.target, d, 'acid'), effect: null });
          this._cooldown(unit, 'spit', 2);
          break;
        }
        case 'rock': {
          name = 'Hurled rock';
          element = 'force';
          const t = sp.target;
          const hit = D20.attackRoll(this._prng, unit.bab, unit.dexMod, ch.sizeMod || 0, t.ac);
          const dice = ['L', 'H', 'G', 'C'].includes(ch.size) ? 2 : 1;
          const sides = ch.size === 'H' || ch.size === 'G' || ch.size === 'C' ? 8 : 6;
          if (hit.hit)
            results.push({ unit: t, damage: hurt(t, Math.max(1, roll(dice, sides) + unit.strMod)), effect: null });
          else
            results.push({ unit: t, damage: 0, effect: 'Miss' });
          break;
        }
        default:
          return null;
      }
      const total = results.reduce((s2, r) => s2 + r.damage, 0);
      this._combatLog.push(`${unit.logName} uses ${name}: ${results.map(r => `${r.unit.logName} ${r.damage ? r.damage + ' dmg' : ''}${r.effect ? ' ' + r.effect : ''}${!r.unit.isAlive ? ' - SLAIN!' : ''}`).join(', ')}`);
      const out = { attacker: unit, special, name, element, shape, targets: results, totalDamage: total };
      this._emit('specialResolved', out);
      if (this.checkVictory())
        this._phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this._phase = CombatPhase.DEFEAT;
      return out;
    },

  });
})();
