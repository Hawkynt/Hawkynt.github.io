;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { Pathfinding, D20 } = TR;

  // --- AI Difficulty Tiers ---
  const AI_TIER = Object.freeze({
    TRIVIAL:    0, // nearest target, melee only
    SIMPLE:     1, // + basic spell casting
    TACTICAL:   2, // + flanking, target priority
    STRATEGIC:  3, // + screening, buff/debuff, threat assessment
    MASTERMIND: 4, // + coordination, lookahead, optimal spells
  });

  // Scoring weights per tier
  const TIER_WEIGHTS = Object.freeze([
    Object.freeze({ proximity: 1.0, lowHp: 0.3, spell: 0,   flanking: 0,   threat: 0,   blocking: 0,   coordination: 0   }),
    Object.freeze({ proximity: 1.0, lowHp: 0.5, spell: 0.8, flanking: 0,   threat: 0,   blocking: 0,   coordination: 0   }),
    Object.freeze({ proximity: 0.8, lowHp: 0.8, spell: 1.0, flanking: 1.2, threat: 0.5, blocking: 0,   coordination: 0   }),
    Object.freeze({ proximity: 0.6, lowHp: 1.0, spell: 1.2, flanking: 1.2, threat: 1.0, blocking: 1.0, coordination: 0.3 }),
    Object.freeze({ proximity: 0.4, lowHp: 1.0, spell: 1.5, flanking: 1.5, threat: 1.2, blocking: 1.0, coordination: 1.0 }),
  ]);

  // Map dungeon difficulty (1-8) or overworld tier (0-7) to AI tier
  function difficultyToAiTier(difficulty) {
    return Math.min(4, Math.floor((difficulty || 0) / 2));
  }

  // --- Target scoring ---
  function scoreTarget(unit, target, weights) {
    const pos = unit.position;
    const tPos = target.position;
    const dist = Math.abs(pos.col - tPos.col) + Math.abs(pos.row - tPos.row);

    let score = 0;
    // Proximity: closer = better (inverse distance, normalized)
    score += weights.proximity * (10 / Math.max(1, dist));
    // Low HP: bonus for targets near death (finishing blow priority)
    const hpRatio = target.currentHp / target.maxHp;
    score += weights.lowHp * (1 - hpRatio) * 5;
    // Threat: prioritize high-damage party members (high BAB, casters)
    if (weights.threat > 0) {
      const isCaster = target.spells && target.spells.length > 0;
      const babThreat = (target.bab || 0) / 10;
      score += weights.threat * (isCaster ? 3 : babThreat * 2);
    }
    return score;
  }

  // --- Flanking check for a hypothetical position ---
  function wouldFlank(grid, movePos, targetPos, faction) {
    if (!D20.isFlanking) return false;
    // Temporarily check: if unit were at movePos, would it flank targetPos?
    // isFlanking checks for ally on opposite side
    return D20.isFlanking(grid, movePos, targetPos, faction === 'enemy' ? 'enemy' : 'party');
  }

  // --- Screening: does this position block party access to friendly casters? ---
  function scoreBlocking(grid, movePos, partyUnits, allEnemyUnits) {
    if (!allEnemyUnits) return 0;
    let score = 0;
    // Find friendly casters (enemies with spells)
    const casters = allEnemyUnits.filter(u => u.isAlive && u.isConscious && u.spells && u.spells.length > 0);
    if (casters.length === 0) return 0;

    for (const caster of casters) {
      const cPos = caster.position;
      for (const pu of partyUnits) {
        if (!pu.isAlive) continue;
        const pPos = pu.position;
        // Check if movePos is between party unit and caster (on the line)
        const dx = cPos.col - pPos.col;
        const dy = cPos.row - pPos.row;
        const mx = movePos.col - pPos.col;
        const my = movePos.row - pPos.row;
        // Simple: is movePos closer to the party unit than the caster, and roughly in between?
        const distToParty = Math.abs(mx) + Math.abs(my);
        const distToCaster = Math.abs(cPos.col - movePos.col) + Math.abs(cPos.row - movePos.row);
        const totalDist = Math.abs(dx) + Math.abs(dy);
        if (distToParty + distToCaster <= totalDist + 2 && distToParty >= 1)
          score += 1;
      }
    }
    return score;
  }

  // --- Spell evaluation ---
  function evaluateSpellActions(grid, unit, partyUnits, allEnemyUnits, weights, aiTier) {
    const Spells = TR.Spells;
    if (!Spells || !unit.spells || unit.spells.length === 0) return [];

    const actions = [];
    const pos = unit.position;

    for (const spellId of unit.spells) {
      const spell = Spells.byId(spellId);
      if (!spell) continue;
      if (!unit.canCastSpell(spell)) continue;

      const isHeal = (spell.healDice > 0 && spell.healSides > 0) || spell.target === 'ally';
      const isBuff = spell.target === 'ally' || spell.target === 'self';
      const isDamage = (spell.damageDice > 0 && spell.damageSides > 0) || spell.target === 'enemy';
      const isCantrip = spell.level === 0 || (typeof spell.level === 'object' && Math.min(...Object.values(spell.level)) === 0);

      // Tier 1: only damage spells and cantrips
      if (aiTier <= 1 && !isDamage) continue;
      // Tier 2: damage spells
      if (aiTier <= 2 && !isDamage && !isCantrip) continue;
      // Tier 3+: also consider heals and buffs

      if (isDamage || (!isBuff && !isHeal)) {
        // Offensive spell: target party
        const range = typeof spell.range === 'number' ? spell.range : 4;
        for (const pu of partyUnits) {
          if (!pu.isAlive) continue;
          const tPos = pu.position;
          if (!Spells.isInRange(pos.col, pos.row, tPos.col, tPos.row, range)) continue;

          let score = 0;
          const expectedDmg = (spell.damageDice || 1) * ((spell.damageSides || 6) / 2);
          score += weights.spell * (expectedDmg / 5);
          // AoE bonus at tier 2+
          if (spell.aoe && spell.aoe > 0 && aiTier >= 2) {
            let hitCount = 0;
            for (const other of partyUnits) {
              if (!other.isAlive) continue;
              if (Spells.isInRange(tPos.col, tPos.row, other.position.col, other.position.row, spell.aoe))
                ++hitCount;
            }
            score += weights.spell * hitCount * 2;
          }
          // Finishing blow bonus
          if (pu.currentHp <= expectedDmg)
            score += weights.lowHp * 3;
          // Prefer cantrips when MP is low (tier 3+)
          if (aiTier >= 3 && isCantrip)
            score += 0.5;

          score += scoreTarget(unit, pu, weights) * 0.3;
          actions.push({ type: 'spell', spellId, target: pu.id, score });
        }
      }

      if ((isHeal || isBuff) && aiTier >= 3) {
        // Defensive/buff spell: target allies
        const range = typeof spell.range === 'number' ? spell.range : 1;
        const allies = allEnemyUnits || [];
        for (const ally of allies) {
          if (!ally.isAlive || ally.id === unit.id) continue;
          const aPos = ally.position;
          if (!Spells.isInRange(pos.col, pos.row, aPos.col, aPos.row, range)) continue;

          let score = 0;
          if (isHeal) {
            const hpDeficit = ally.maxHp - ally.currentHp;
            const expectedHeal = (spell.healDice || 1) * ((spell.healSides || 6) / 2);
            score += weights.spell * Math.min(hpDeficit, expectedHeal) / 5;
            // Prioritize badly wounded allies
            if (ally.currentHp < ally.maxHp * 0.3)
              score += weights.spell * 3;
          } else {
            score += weights.spell * 2; // generic buff bonus
          }
          actions.push({ type: 'spell', spellId, target: ally.id, score });
        }
      }
    }

    return actions;
  }

  // --- Melee action scoring ---
  function evaluateMeleeActions(grid, unit, partyUnits, moveRange, weights, aiTier, allEnemyUnits) {
    const actions = [];
    const pos = unit.position;

    for (const pu of partyUnits) {
      if (!pu.isAlive) continue;
      const tPos = pu.position;

      // Already adjacent: attack in place
      if (D20.isAdjacent(pos, tPos)) {
        let score = scoreTarget(unit, pu, weights) + 5; // base melee bonus
        if (weights.flanking > 0 && wouldFlank(grid, pos, tPos, unit.faction))
          score += weights.flanking * 3;
        actions.push({ type: 'attack', target: pu.id, score });
        continue;
      }

      // Check reachable tiles adjacent to target
      const adjacentTiles = grid.neighbors(tPos.col, tPos.row);
      for (const at of adjacentTiles) {
        const key = `${at.col},${at.row}`;
        if (!moveRange.has(key) || grid.isOccupied(at.col, at.row)) continue;

        let score = scoreTarget(unit, pu, weights) + 3; // move+attack bonus
        // Flanking bonus
        if (weights.flanking > 0 && wouldFlank(grid, at, tPos, unit.faction))
          score += weights.flanking * 3;
        // Blocking bonus
        if (weights.blocking > 0)
          score += weights.blocking * scoreBlocking(grid, at, partyUnits, allEnemyUnits);

        actions.push({ type: 'move_and_attack', moveTo: { col: at.col, row: at.row }, target: pu.id, score });
      }
    }

    return actions;
  }

  // --- Move-only scoring (when no attack possible) ---
  function evaluateMoveActions(grid, unit, partyUnits, moveRange, weights, allEnemyUnits) {
    const pos = unit.position;
    // Find best target to approach
    let bestTarget = null;
    let bestTargetScore = -Infinity;
    for (const pu of partyUnits) {
      if (!pu.isAlive) continue;
      const s = scoreTarget(unit, pu, weights);
      if (s > bestTargetScore) {
        bestTargetScore = s;
        bestTarget = pu;
      }
    }
    if (!bestTarget) return [];

    const tPos = bestTarget.position;
    let bestMove = null;
    let bestDist = Infinity;
    let bestScore = -Infinity;

    for (const [key] of moveRange) {
      const [c, r] = key.split(',').map(Number);
      if (c === pos.col && r === pos.row) continue;
      if (grid.isOccupied(c, r)) continue;

      const dist = Math.abs(c - tPos.col) + Math.abs(r - tPos.row);
      let score = weights.proximity * (10 / Math.max(1, dist));

      // Blocking bonus for strategic tiers
      if (weights.blocking > 0)
        score += weights.blocking * scoreBlocking(grid, { col: c, row: r }, partyUnits, allEnemyUnits);

      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        bestScore = score;
        bestDist = dist;
        bestMove = { col: c, row: r };
      }
    }

    if (!bestMove) return [];
    return [{ type: 'move', moveTo: bestMove, score: bestScore }];
  }

  // --- Tier 4: Coordinated multi-unit pre-planning ---
  function coordinatedDecide(grid, enemyUnits, partyUnits, prng) {
    const weights = TIER_WEIGHTS[4];
    const decisions = new Map();
    const claimed = new Set(); // tiles claimed by earlier units

    // Classify units: tanks (high HP, melee), casters (have spells), flankers (rest)
    const sorted = [...enemyUnits].filter(u => u.isAlive && u.isConscious).sort((a, b) => {
      const aHasSpells = a.spells && a.spells.length > 0;
      const bHasSpells = b.spells && b.spells.length > 0;
      if (aHasSpells !== bHasSpells) return aHasSpells ? 1 : -1; // melee first
      return b.maxHp - a.maxHp; // tanky units first
    });

    for (const unit of sorted) {
      const moveRange = Pathfinding.movementRange(grid, unit.position, unit.speedTiles, unit.faction);

      // Generate all candidate actions
      const melee = evaluateMeleeActions(grid, unit, partyUnits, moveRange, weights, 4, enemyUnits);
      const spells = evaluateSpellActions(grid, unit, partyUnits, enemyUnits, weights, 4);
      const moves = evaluateMoveActions(grid, unit, partyUnits, moveRange, weights, enemyUnits);
      const all = [...melee, ...spells, ...moves];

      // Filter out tiles already claimed
      const filtered = all.filter(a => {
        if (a.moveTo) {
          const key = `${a.moveTo.col},${a.moveTo.row}`;
          return !claimed.has(key);
        }
        return true;
      });

      // Coordination bonus: reward spreading out attacks across different targets
      const targetCounts = new Map();
      for (const [, d] of decisions)
        if (d.target)
          targetCounts.set(d.target, (targetCounts.get(d.target) || 0) + 1);
      for (const a of filtered) {
        if (a.target && targetCounts.has(a.target))
          a.score -= weights.coordination * targetCounts.get(a.target);
      }

      filtered.sort((a, b) => b.score - a.score);
      const best = filtered[0] || { type: 'wait' };

      if (best.moveTo)
        claimed.add(`${best.moveTo.col},${best.moveTo.row}`);
      decisions.set(unit.id, best);
    }

    return decisions;
  }

  // --- Main entry point ---
  const EnemyAI = {

    AI_TIER,
    TIER_WEIGHTS,
    difficultyToAiTier,

    findNearestTarget(grid, enemyPos, partyUnits) {
      let best = null;
      let bestDist = Infinity;
      let bestHp = Infinity;

      for (const pu of partyUnits) {
        if (!pu.isAlive)
          continue;
        const pos = pu.position;
        const dist = Math.abs(pos.col - enemyPos.col) + Math.abs(pos.row - enemyPos.row);
        if (dist < bestDist || (dist === bestDist && pu.currentHp < bestHp)) {
          best = pu;
          bestDist = dist;
          bestHp = pu.currentHp;
        }
      }

      return best;
    },

    chooseMoveTarget(grid, unitPos, targetPos, moveRange) {
      let bestKey = null;
      let bestDist = Infinity;

      for (const [key] of moveRange) {
        const [c, r] = key.split(',').map(Number);
        if (c === unitPos.col && r === unitPos.row)
          continue;
        if (grid.isOccupied(c, r))
          continue;
        const dist = Math.abs(c - targetPos.col) + Math.abs(r - targetPos.row);
        if (dist < bestDist) {
          bestDist = dist;
          bestKey = key;
        }
      }

      if (!bestKey)
        return null;
      const [bc, br] = bestKey.split(',').map(Number);
      return { col: bc, row: br };
    },

    // Main decision function.
    // aiTier: 0-4, defaults to 0 (Trivial) for backward compat
    // allEnemyUnits: all living enemy units (needed for tier 3+ blocking/coordination)
    decide(grid, unit, partyUnits, prng, aiTier, allEnemyUnits) {
      aiTier = aiTier || 0;

      // --- Tier 0: exact legacy behavior ---
      if (aiTier === 0) {
        const pos = unit.position;
        const target = EnemyAI.findNearestTarget(grid, pos, partyUnits);
        if (!target)
          return { type: 'wait' };

        const targetPos = target.position;

        if (D20.isAdjacent(pos, targetPos))
          return { type: 'attack', target: target.id };

        const moveRange = Pathfinding.movementRange(grid, pos, unit.speedTiles, unit.faction);
        const adjacentTiles = grid.neighbors(targetPos.col, targetPos.row);

        for (const at of adjacentTiles) {
          const key = `${at.col},${at.row}`;
          if (moveRange.has(key) && !grid.isOccupied(at.col, at.row))
            return { type: 'move_and_attack', moveTo: { col: at.col, row: at.row }, target: target.id };
        }

        const moveTo = EnemyAI.chooseMoveTarget(grid, pos, targetPos, moveRange);
        if (moveTo)
          return { type: 'move', moveTo };

        return { type: 'wait' };
      }

      // --- Tier 1+: scoring-based decision ---
      const weights = TIER_WEIGHTS[Math.min(aiTier, 4)];
      const pos = unit.position;
      const moveRange = Pathfinding.movementRange(grid, pos, unit.speedTiles, unit.faction);

      // Generate all candidate actions
      const melee = evaluateMeleeActions(grid, unit, partyUnits, moveRange, weights, aiTier, allEnemyUnits);
      const spells = evaluateSpellActions(grid, unit, partyUnits, allEnemyUnits, weights, aiTier);
      const moves = evaluateMoveActions(grid, unit, partyUnits, moveRange, weights, allEnemyUnits);

      // Also consider spells after moving
      if (aiTier >= 2 && TR.Spells) {
        for (const [key] of moveRange) {
          const [c, r] = key.split(',').map(Number);
          if (grid.isOccupied(c, r)) continue;
          // Check if moving here puts new spell targets in range
          const movePos = { col: c, row: r };
          for (const spellId of (unit.spells || [])) {
            const spell = TR.Spells.byId(spellId);
            if (!spell || !unit.canCastSpell(spell)) continue;
            if (spell.target !== 'enemy') continue;
            const range = typeof spell.range === 'number' ? spell.range : 4;
            for (const pu of partyUnits) {
              if (!pu.isAlive) continue;
              if (!TR.Spells.isInRange(c, r, pu.position.col, pu.position.row, range)) continue;
              // Already in range from current pos? Skip (covered by non-move spell actions)
              if (TR.Spells.isInRange(pos.col, pos.row, pu.position.col, pu.position.row, range)) continue;
              const expectedDmg = (spell.damageDice || 1) * ((spell.damageSides || 6) / 2);
              let score = weights.spell * (expectedDmg / 5) + scoreTarget(unit, pu, weights) * 0.2;
              spells.push({ type: 'move_and_spell', moveTo: movePos, spellId, target: pu.id, score });
            }
          }
        }
      }

      const all = [...melee, ...spells, ...moves];
      if (all.length === 0)
        return { type: 'wait' };

      // Pick highest scoring action (with small random tiebreaker to avoid predictability)
      all.sort((a, b) => b.score - a.score || (prng ? prng.next() - 0.5 : 0));
      const best = all[0];
      // Strip internal score from returned action
      const { score: _, ...action } = best;
      return action;
    },

    // Tier 4: pre-plan all enemy moves at once for coordination
    coordinatedDecide,
  };

  TR.EnemyAI = EnemyAI;
})();
