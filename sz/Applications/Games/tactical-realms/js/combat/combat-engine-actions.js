;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { CombatGrid, CombatUnit, Pathfinding, D20, EnemyAI, Character, Terrain, Spells, CLASSES, CombatPhase } = TR;
  const { ENEMY_TEMPLATES, CREATURE_TYPES, BOSS_TEMPLATES, templateToCharacter, getBossPhase } = TR.CombatTemplates;
  const CombatEngine = TR.CombatEngine;

  Object.assign(CombatEngine.prototype, {
    resolveAoeSpell(casterId, spellId, centerCol, centerRow) {
      const caster = this.unitById(casterId);
      const spell = Spells ? Spells.byId(spellId) : null;
      if (!caster || !spell)
        return null;

      const aoeRadius = spell.aoe || 0;
      const affectedUnits = [];
      for (const u of this._units) {
        if (!u.isAlive)
          continue;
        const d = Math.abs(u.position.col - centerCol) + Math.abs(u.position.row - centerRow);
        if (d > aoeRadius)
          continue;
        if (spell.target === 'enemy' && u.faction === caster.faction)
          continue;
        if (spell.target === 'ally' && u.faction !== caster.faction)
          continue;
        affectedUnits.push({ unit: u, distance: d });
      }

      if (affectedUnits.length === 0)
        return null;

      if (spell.mpCost > 0)
        caster.spendMp(spell.mpCost);

      const classId = caster.character.class;
      const classDef = CLASSES ? CLASSES.find(c => c.id === classId) : null;
      // For player characters use class primary ability; for monsters use best mental stat
      const castMod = classDef
        ? Character.abilityMod(caster.character.stats[classDef.primaryAbility])
        : Math.max(caster.intMod, caster.wisMod, caster.chaMod);

      let totalDamage = 0;
      let totalHeal = 0;
      const targets = [];

      for (const { unit: target, distance } of affectedUnits) {
        let damage = 0;
        let heal = 0;
        const falloff = aoeRadius > 0 ? 1 - (distance / (aoeRadius + 1)) * 0.5 : 1;

        if (spell.damageDice > 0 && spell.damageSides > 0) {
          const dmg = D20.damageRoll(this._prng, spell.damageDice, spell.damageSides, castMod, 0);
          damage = this._spellDamage(caster, target, spell, Math.max(1, Math.round(dmg.total * falloff)));
          target.takeDamage(damage);
          totalDamage += damage;
        }

        if (spell.healDice > 0 && spell.healSides > 0) {
          const h = D20.damageRoll(this._prng, spell.healDice, spell.healSides, castMod, 0);
          heal = Math.max(1, Math.round(h.total * falloff));
          target.heal(heal);
          totalHeal += heal;
        }

        targets.push({ unitId: target.id, damage, heal, distance });
      }

      const logParts = [`${caster.logName} casts ${spell.name} (AoE r=${aoeRadius}) at (${centerCol},${centerRow})`];
      if (totalDamage > 0)
        logParts.push(`(${totalDamage} total dmg to ${targets.filter(t => t.damage > 0).length} targets)`);
      if (totalHeal > 0)
        logParts.push(`(${totalHeal} total heal to ${targets.filter(t => t.heal > 0).length} targets)`);
      if (spell.mpCost > 0)
        logParts.push(`[${spell.mpCost} MP]`);
      for (const t of targets) {
        const tu = this.unitById(t.unitId);
        if (tu && !tu.isAlive)
          logParts.push(`${tu.logName} SLAIN!`);
      }
      this._combatLog.push(logParts.join(' '));

      this._emit('spellResolved', { caster, spell, aoe: true, targets, totalDamage, totalHeal });

      if (this.checkVictory())
        this._phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this._phase = CombatPhase.DEFEAT;

      return { hit: true, damage: totalDamage, heal: totalHeal, spell, mpCost: spell.mpCost, aoe: true, centerCol, centerRow, targets };
    },

    getAoeSpellRange(unitId, spellId) {
      const unit = this.unitById(unitId);
      if (!unit || !Spells)
        return [];
      const spell = Spells.byId(spellId);
      if (!spell)
        return [];
      const tiles = [];
      const pos = unit.position;
      for (let r = 0; r < this._grid.rows; ++r)
        for (let c = 0; c < this._grid.cols; ++c) {
          const dist = Math.abs(c - pos.col) + Math.abs(r - pos.row);
          if (dist <= spell.range)
            tiles.push({ col: c, row: r });
        }
      return tiles;
    },

    resolveSpell(casterId, targetId, spellId) {
      const caster = this.unitById(casterId);
      const target = this.unitById(targetId);
      const spell = Spells ? Spells.byId(spellId) : null;
      if (!caster || !target || !spell)
        return { hit: false, damage: 0, heal: 0, spell: null };

      if (spell.mpCost > 0)
        caster.spendMp(spell.mpCost);

      const classId = caster.character.class;
      const classDef = CLASSES ? CLASSES.find(c => c.id === classId) : null;
      // For player characters use class primary ability; for monsters use best mental stat
      const castMod = classDef
        ? Character.abilityMod(caster.character.stats[classDef.primaryAbility])
        : Math.max(caster.intMod, caster.wisMod, caster.chaMod);

      let damage = 0;
      let heal = 0;
      let hit = true;

      if (spell.damageDice > 0 && spell.damageSides > 0) {
        const dmg = D20.damageRoll(this._prng, spell.damageDice, spell.damageSides, castMod, 0);
        damage = this._spellDamage(caster, target, spell, dmg.total);
        target.takeDamage(damage);
      }

      if (spell.healDice > 0 && spell.healSides > 0) {
        const h = D20.damageRoll(this._prng, spell.healDice, spell.healSides, castMod, 0);
        heal = h.total;
        target.heal(heal);
      }

      const logParts = [`${caster.logName} casts ${spell.name} on ${target.logName}`];
      if (damage > 0)
        logParts.push(`(${damage} dmg)`);
      if (heal > 0)
        logParts.push(`(heals ${heal})`);
      if (spell.mpCost > 0)
        logParts.push(`[${spell.mpCost} MP]`);
      if (!target.isAlive)
        logParts.push('- SLAIN!');
      this._combatLog.push(logParts.join(' '));

      this._emit('spellResolved', { caster, target, spell, damage, heal, hit });

      if (this.checkVictory())
        this._phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this._phase = CombatPhase.DEFEAT;

      return { hit, damage, heal, spell, mpCost: spell.mpCost };
    },

    selectTarget(col, row) {
      if (this._phase !== CombatPhase.AWAITING_TARGET)
        return null;
      const targetId = this._grid.unitAt(col, row);
      if (!targetId)
        return null;
      const targets = this.getAttackTargets(this.currentUnit.id);
      if (!targets.includes(targetId))
        return null;
      const result = this.resolveAttack(this.currentUnit.id, targetId);
      this.currentUnit.endAction();
      if (this._phase !== CombatPhase.VICTORY && this._phase !== CombatPhase.DEFEAT)
        this._phase = CombatPhase.TURN_END;
      return result;
    },

    selectWait() {
      const unit = this.currentUnit;
      if (unit) {
        unit.endMove();
        unit.endAction();
      }
      this._phase = CombatPhase.TURN_END;
    },

    useItem(item) {
      const unit = this.currentUnit;
      if (!unit || unit.faction !== 'party' || unit.hasActed)
        return null;
      if (this._phase !== CombatPhase.AWAITING_ACTION && this._phase !== CombatPhase.AWAITING_MOVE)
        return null;
      if (!item || !item.effect)
        return null;
      const Items = TR.Items;
      if (!Items)
        return null;

      const result = Items.applyConsumable(this._prng, item, unit.currentHp, unit.maxHp, unit.currentMp, unit.maxMp);
      if (!result)
        return null;

      if (result.type === 'heal') {
        unit.heal(result.amount);
        this._combatLog.push(`${unit.logName} uses ${item.name} (heals ${result.amount})`);
      } else if (result.type === 'restoreMp') {
        unit.restoreMp(result.amount);
        this._combatLog.push(`${unit.logName} uses ${item.name} (restores ${result.amount} MP)`);
      } else if (result.type === 'buff') {
        this._combatLog.push(`${unit.logName} uses ${item.name} (+${result.bonus} ${result.stat} for ${result.duration} rounds)`);
      } else if (result.type === 'cure') {
        this._combatLog.push(`${unit.logName} uses ${item.name} (cures ${result.condition})`);
      } else if (result.type === 'castSpell') {
        this._combatLog.push(`${unit.logName} uses ${item.name} (casts ${result.spellId})`);
      }

      unit.endAction();
      this._emit('itemUsed', { unit, item, result });

      if (this._phase !== CombatPhase.VICTORY && this._phase !== CombatPhase.DEFEAT)
        this._phase = CombatPhase.TURN_END;

      return result;
    },

    resolveAttack(attackerId, defenderId) {
      const attacker = this.unitById(attackerId);
      const defender = this.unitById(defenderId);
      if (!attacker || !defender)
        return { hit: false, damage: 0, critical: false, flanking: false };

      const flanking = D20.isFlanking(this._grid, attacker.position, defender.position, attacker.faction);
      const flankBonus = flanking ? 2 : 0;

      const terrainCover = Terrain.coverBonus(this._grid.terrainIdAt(defender.position.col, defender.position.row));
      const defFx = this._effects(defender);
      const atkFx = this._effects(attacker);
      // the helpless are easy to hit
      const helpless = defFx && defFx.canAct === false ? -4 : 0;
      const effectiveAC = defender.ac + terrainCover + (defFx ? defFx.acPenalty : 0) + helpless;
      const fxAtk = (atkFx ? atkFx.attackPenalty : 0) - this._drainedLevels(attacker) + this._planeAttackBonus(attacker);

      const ch = attacker.character;
      const eq = ch.equipment;
      const weapon = eq ? eq.mainHand : null;
      let equipAtk = 0, equipDmg = 0;
      if (eq)
        for (const s of ['mainHand', 'offHand', 'body', 'accessory']) {
          const it = eq[s];
          if (it && it.stats) {
            equipAtk += it.stats.attack || 0;
            equipDmg += it.stats.damage || 0;
          }
        }

      // Boss phase bonuses
      const bossPhase = getBossPhase(attacker);
      const bossAtk = bossPhase ? (bossPhase.babBonus || 0) : 0;
      const bossDmgMult = bossPhase ? (bossPhase.damageMult || 1) : 1;

      const sizeAtk = ch.sizeMod || 0;
      // monsters swing their whole natural routine when they stood still
      // (or can pounce); after moving only the primary attack lands
      const routine = TR.MonsterAttacks ? TR.MonsterAttacks.routine(ch) : null;
      const full = !!routine && routine.length > 1 && (!attacker.hasMoved || TR.MonsterAttacks.canPounce(ch));
      const swings = routine ? (full ? routine : [routine[0]]) : [null];
      let damage = 0;
      let critical = false;
      let anyHit = false;
      let attackResult = null;
      const attacks = [];

      for (const swing of swings) {
        const secondary = !!swing && !swing.primary;
        const misc = flankBonus + equipAtk + bossAtk + sizeAtk + fxAtk - (secondary ? 5 : 0);
        const roll = D20.attackRoll(this._prng, attacker.bab, attacker.strMod, misc, effectiveAC);
        if (!attackResult)
          attackResult = roll;
        let dealt = 0;
        let crit = false;
        if (roll.hit) {
          anyHit = true;
          const tmpl = ENEMY_TEMPLATES[ch.class];
          const dieCount = swing ? swing.dice : weapon ? weapon.damageDice : (ch.damageDice || (tmpl ? tmpl.damageDice : 1));
          const dieSides = swing ? swing.sides : weapon ? weapon.damageSides : (ch.damageSides || (tmpl ? tmpl.damageSides : 6));
          const critRange = weapon && !swing ? weapon.critRange : [20];
          const critMult = weapon && !swing ? weapon.critMult : 2;
          const strBonus = secondary ? Math.floor(attacker.strMod / 2) : attacker.strMod;
          const dmgResult = D20.damageRoll(this._prng, dieCount, dieSides, strBonus, equipDmg);
          const critResult = D20.criticalCheck(this._prng, roll.d20, critRange, attacker.bab, attacker.strMod, misc, effectiveAC, critMult);
          if (critResult.confirmed) {
            crit = true;
            critical = true;
            dealt = dmgResult.total * critResult.multiplier;
          } else
            dealt = dmgResult.total;
          if (weapon && !swing && weapon.affixDamage) {
            const affix = D20.damageRoll(this._prng, weapon.affixDamage.dice, weapon.affixDamage.sides, 0, 0);
            dealt += affix.total;
          }
          dealt = Math.max(1, Math.round(dealt * bossDmgMult));
          // damage reduction, incorporeal bodies
          const adj = TR.MonsterAbilities ? TR.MonsterAbilities.adjustDamage(defender, dealt, 'physical', swing ? null : weapon, this._prng) : { amount: dealt, note: null };
          if (adj.note)
            this._combatLog.push(`  ${defender.logName}: ${adj.note}`);
          dealt = adj.amount;
          defender.takeDamage(dealt);
          damage += dealt;
        }
        attacks.push({ name: swing ? swing.name : 'weapon', hit: roll.hit, damage: dealt, critical: crit, d20: roll.d20, total: roll.total });
        if (!defender.isAlive)
          break;
      }
      attackResult = { ...attackResult, hit: anyHit };
      const effects = anyHit ? this._applyRiders(attacker, defender, attacks) : [];

      attacks.forEach((at, i) => {
        const how = attacks.length > 1 ? ` (${at.name})` : '';
        const slain = i === attacks.length - 1 && !defender.isAlive ? ' - SLAIN!' : '';
        this._combatLog.push(`${attacker.logName} attacks ${defender.logName}${how}: d20+${attacker.bab}${flankBonus ? `+${flankBonus}flank` : ''}=${at.total} vs AC ${effectiveAC} ${at.hit ? 'HIT' : 'MISS'}${at.critical ? ' CRITICAL!' : ''}${at.hit ? ` (${at.damage} dmg)` : ''}${slain}`);
      });

      this._emit('attackResolved', { attacker, defender, result: attackResult, damage, critical, flanking, effects });

      if (this.checkVictory())
        this._phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this._phase = CombatPhase.DEFEAT;

      return { hit: attackResult.hit, damage, critical, flanking, d20: attackResult.d20, total: attackResult.total, natural20: attackResult.natural20, natural1: attackResult.natural1, attacks, effects };
    },

  });
})();
