;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  function isAllyUnit(unitId, faction) {
    if (!unitId)
      return false;
    const isPartyFaction = faction === 'party';
    const isPartyUnit = unitId.startsWith('party_') || unitId.startsWith('ally');
    return isPartyFaction ? isPartyUnit : !isPartyUnit;
  }

  const D20 = {

    rollInitiative(prng, dexMod, misc) {
      const roll = prng.d20();
      return { roll, total: roll + dexMod + (misc || 0) };
    },

    sortInitiative(entries, prng) {
      const tagged = entries.map(e => ({ ...e, tiebreak: prng.next() }));
      tagged.sort((a, b) => {
        if (b.total !== a.total)
          return b.total - a.total;
        if (b.dexMod !== a.dexMod)
          return b.dexMod - a.dexMod;
        return b.tiebreak - a.tiebreak;
      });
      return tagged;
    },

    attackRoll(prng, bab, abilityMod, misc, targetAC) {
      const d20 = prng.d20();
      const natural20 = d20 === 20;
      const natural1 = d20 === 1;
      const total = d20 + bab + abilityMod + (misc || 0);
      let hit;
      if (natural20)
        hit = true;
      else if (natural1)
        hit = false;
      else
        hit = total >= targetAC;
      return { d20, total, hit, natural20, natural1 };
    },

    damageRoll(prng, dieCount, dieSides, strMod, misc) {
      const rolls = [];
      for (let i = 0; i < dieCount; ++i)
        rolls.push(prng.nextInt(1, dieSides));
      const sum = rolls.reduce((a, b) => a + b, 0);
      const total = Math.max(1, sum + (strMod || 0) + (misc || 0));
      return { rolls, total };
    },

    criticalCheck(prng, naturalRoll, threatRange, bab, abilityMod, misc, targetAC, critMultiplier) {
      if (!threatRange.includes(naturalRoll))
        return { confirmed: false, multiplier: 1, confirmRoll: 0 };
      const confirmD20 = prng.d20();
      const confirmTotal = confirmD20 + bab + abilityMod + (misc || 0);
      const confirmed = confirmTotal >= targetAC;
      return {
        confirmed,
        multiplier: confirmed ? critMultiplier : 1,
        confirmRoll: confirmD20,
        confirmTotal,
      };
    },

    isFlanking(grid, attackerPos, defenderPos, attackerFaction) {
      const dc = defenderPos.col - attackerPos.col;
      const dr = defenderPos.row - attackerPos.row;

      if (Math.abs(dc) + Math.abs(dr) !== 1)
        return false;

      const oppositeCol = defenderPos.col + dc;
      const oppositeRow = defenderPos.row + dr;

      if (!grid.inBounds(oppositeCol, oppositeRow))
        return false;

      const oppositeUnitId = grid.unitAt(oppositeCol, oppositeRow);
      return isAllyUnit(oppositeUnitId, attackerFaction);
    },

    isAdjacent(pos1, pos2, reach) {
      const dist = Math.abs(pos1.col - pos2.col) + Math.abs(pos1.row - pos2.row);
      const maxDist = reach || 1;
      if (dist === 0 || dist > maxDist)
        return false;
      return pos1.col === pos2.col || pos1.row === pos2.row;
    },

    // --- D&D 3.5e Saving Throws ---
    savingThrow(prng, baseSave, abilityMod, misc, dc) {
      const d20 = prng.d20();
      const natural20 = d20 === 20;
      const natural1 = d20 === 1;
      const total = d20 + baseSave + abilityMod + (misc || 0);
      let success;
      if (natural20)
        success = true;
      else if (natural1)
        success = false;
      else
        success = total >= dc;
      return { d20, total, success, natural20, natural1 };
    },

    // --- Iterative Attacks (BAB-based) ---
    iterativeAttacks(bab) {
      const attacks = [];
      for (let bonus = bab; bonus > 0; bonus -= 5)
        attacks.push(bonus);
      return attacks;
    },

    // --- Full Attack action: roll all iterative attacks ---
    fullAttack(prng, bab, abilityMod, misc, targetAC, damageDice, damageSides, strMod, critRange, critMult) {
      const iteratives = D20.iterativeAttacks(bab);
      const results = [];
      for (const attackBonus of iteratives) {
        const atk = D20.attackRoll(prng, attackBonus, abilityMod, misc, targetAC);
        let damage = 0;
        let crit = null;
        if (atk.hit) {
          const threatRange = critRange || [20];
          crit = D20.criticalCheck(prng, atk.d20, threatRange, attackBonus, abilityMod, misc, targetAC, critMult || 2);
          const dmg = D20.damageRoll(prng, damageDice, damageSides, strMod, 0);
          damage = dmg.total * (crit.confirmed ? crit.multiplier : 1);
        }
        results.push({ attackBonus, ...atk, damage, crit });
      }
      return results;
    },

    // --- Two-Weapon Fighting penalties ---
    twoWeaponPenalties(hasImprovedTWF, offhandIsLight) {
      let mainPenalty = -6;
      let offPenalty = -10;
      if (offhandIsLight) {
        mainPenalty = -4;
        offPenalty = -8;
      }
      if (hasImprovedTWF) {
        mainPenalty += 2;
        offPenalty += 2;
      }
      return { mainPenalty, offPenalty };
    },

    // --- Skill Check ---
    skillCheck(prng, ranks, abilityMod, misc) {
      const d20 = prng.d20();
      const total = d20 + ranks + abilityMod + (misc || 0);
      return { d20, total };
    },

    // --- Opposed Check ---
    opposedCheck(prng, bonusA, bonusB) {
      const rollA = prng.d20() + bonusA;
      const rollB = prng.d20() + bonusB;
      return { rollA, rollB, winnerIsA: rollA >= rollB };
    },

    // --- Take 10 / Take 20 ---
    take10(ranks, abilityMod, misc) {
      return 10 + ranks + abilityMod + (misc || 0);
    },

    take20(ranks, abilityMod, misc) {
      return 20 + ranks + abilityMod + (misc || 0);
    },

    // --- Ability Check (d20 + ability mod) ---
    abilityCheck(prng, abilityMod) {
      const d20 = prng.d20();
      return { d20, total: d20 + abilityMod };
    },

    // --- Spell Resistance check ---
    spellResistanceCheck(prng, casterLevel, targetSR) {
      const d20 = prng.d20();
      const total = d20 + casterLevel;
      return { d20, total, overcome: total >= targetSR };
    },

    // --- Concentration check ---
    concentrationCheck(prng, concentrationBonus, dc) {
      const d20 = prng.d20();
      const total = d20 + concentrationBonus;
      return { d20, total, success: total >= dc };
    },

    // --- Grapple check ---
    grappleCheck(prng, bab, strMod, sizeMod, misc) {
      const d20 = prng.d20();
      const total = d20 + bab + strMod + sizeMod + (misc || 0);
      return { d20, total };
    },

    // --- Turn Undead check ---
    turnUndeadCheck(prng, chaMod, turningLevel) {
      const d20 = prng.d20();
      const turningDamage = 2 * (prng.nextInt(1, 6)) + chaMod + turningLevel;
      return { d20, maxHD: d20 + chaMod, turningDamage };
    },

    // --- AC Computation using BonusStacking ---
    computeAC(unit) {
      if (!TR.BonusStacking)
        return unit.ac || 10;
      return TR.BonusStacking.computeAC(unit.bonuses || []);
    },
  };

  TR.D20 = D20;
})();
