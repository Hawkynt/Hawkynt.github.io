;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  // D&D 3.5e named bonus types.
  // Same-named bonuses do NOT stack (highest wins), except dodge (always stacks).
  // Untyped bonuses always stack.
  const BonusType = Object.freeze({
    ARMOR:       'armor',
    SHIELD:      'shield',
    NATURAL:     'natural',
    DEFLECTION:  'deflection',
    ENHANCEMENT: 'enhancement',
    RESISTANCE:  'resistance',
    SACRED:      'sacred',
    PROFANE:     'profane',
    LUCK:        'luck',
    INSIGHT:     'insight',
    MORALE:      'morale',
    COMPETENCE:  'competence',
    CIRCUMSTANCE:'circumstance',
    DODGE:       'dodge',        // exception: always stacks
    SIZE:        'size',
    RACIAL:      'racial',
    UNTYPED:     'untyped',      // always stacks
    PENALTY:     'penalty',      // always stacks (negative)
  });

  // A bonus entry: { type, value, source }
  // source is a string label for debugging (e.g. 'Full Plate', 'Shield of Faith')

  class BonusAggregator {
    #bonuses;   // Map<targetStat, Array<{ type, value, source }>>

    constructor() {
      this.#bonuses = new Map();
    }

    add(stat, type, value, source) {
      if (!this.#bonuses.has(stat))
        this.#bonuses.set(stat, []);
      this.#bonuses.get(stat).push({ type: type || BonusType.UNTYPED, value, source: source || '' });
    }

    // Calculate the total for a stat following D&D stacking rules
    total(stat) {
      const entries = this.#bonuses.get(stat);
      if (!entries || entries.length === 0)
        return 0;

      let sum = 0;
      const bestByType = new Map();   // type -> highest value

      for (const e of entries) {
        // Dodge and untyped always stack
        if (e.type === BonusType.DODGE || e.type === BonusType.UNTYPED) {
          sum += e.value;
          continue;
        }

        // Penalties always stack
        if (e.type === BonusType.PENALTY) {
          sum += e.value;
          continue;
        }

        // Named bonuses: highest wins
        const prev = bestByType.get(e.type);
        if (prev === undefined || e.value > prev)
          bestByType.set(e.type, e.value);
      }

      for (const val of bestByType.values())
        sum += val;

      return sum;
    }

    // Get all bonuses for a stat (for UI display)
    breakdown(stat) {
      return this.#bonuses.get(stat) || [];
    }

    clear() {
      this.#bonuses.clear();
    }

    clearStat(stat) {
      this.#bonuses.delete(stat);
    }
  }

  // Compute full AC from a character with all bonuses
  function computeAC(character, equipment, conditions, spellEffects) {
    const agg = new BonusAggregator();

    // Base
    agg.add('ac', BonusType.UNTYPED, 10, 'base');

    // Dex mod (may be limited by armor maxDex)
    let dexMod = Math.floor((character.stats.dex - 10) / 2);
    if (equipment?.body?.maxDex != null)
      dexMod = Math.min(dexMod, equipment.body.maxDex);
    agg.add('ac', BonusType.UNTYPED, dexMod, 'Dexterity');

    // Size bonus
    const sizeMap = { Fine: 8, Diminutive: 4, Tiny: 2, Small: 1, Medium: 0, Large: -1, Huge: -2, Gargantuan: -4, Colossal: -8 };
    const sizeBonus = sizeMap[character.size] || 0;
    if (sizeBonus !== 0)
      agg.add('ac', BonusType.SIZE, sizeBonus, 'size');

    // Armor
    if (equipment?.body?.armorBonus)
      agg.add('ac', BonusType.ARMOR, equipment.body.armorBonus + (equipment.body.enhancement || 0), equipment.body.name || 'armor');

    // Shield
    if (equipment?.offHand?.category === 'shield') {
      const shieldBonus = (equipment.offHand.shieldBonus || equipment.offHand.armorBonus || 0) + (equipment.offHand.enhancement || 0);
      agg.add('ac', BonusType.SHIELD, shieldBonus, equipment.offHand.name || 'shield');
    }

    // Natural armor
    if (character.naturalArmor)
      agg.add('ac', BonusType.NATURAL, character.naturalArmor, 'natural');

    // Spell effects (deflection, sacred, etc.)
    if (spellEffects) {
      for (const eff of spellEffects)
        if (eff.stat === 'ac')
          agg.add('ac', eff.bonusType || BonusType.UNTYPED, eff.value, eff.source);
    }

    // Conditions
    if (conditions) {
      for (const cond of conditions) {
        if (cond.acPenalty)
          agg.add('ac', BonusType.PENALTY, cond.acPenalty, cond.name);
      }
    }

    return agg.total('ac');
  }

  // Compute attack bonus
  function computeAttack(bab, abilityMod, sizeBonus, equipment, spellEffects) {
    const agg = new BonusAggregator();
    agg.add('attack', BonusType.UNTYPED, bab, 'BAB');
    agg.add('attack', BonusType.UNTYPED, abilityMod, 'ability');
    if (sizeBonus)
      agg.add('attack', BonusType.SIZE, sizeBonus, 'size');
    if (equipment?.mainHand?.enhancement)
      agg.add('attack', BonusType.ENHANCEMENT, equipment.mainHand.enhancement, equipment.mainHand.name);
    if (spellEffects)
      for (const eff of spellEffects)
        if (eff.stat === 'attack')
          agg.add('attack', eff.bonusType || BonusType.UNTYPED, eff.value, eff.source);
    return agg.total('attack');
  }

  // Compute save
  function computeSave(baseSave, abilityMod, equipment, spellEffects, saveName) {
    const agg = new BonusAggregator();
    agg.add(saveName, BonusType.UNTYPED, baseSave, 'base');
    agg.add(saveName, BonusType.UNTYPED, abilityMod, 'ability');
    if (spellEffects)
      for (const eff of spellEffects)
        if (eff.stat === saveName)
          agg.add(saveName, eff.bonusType || BonusType.UNTYPED, eff.value, eff.source);
    return agg.total(saveName);
  }

  TR.BonusType = BonusType;
  TR.BonusAggregator = BonusAggregator;
  TR.BonusStacking = Object.freeze({
    computeAC,
    computeAttack,
    computeSave,
  });
})();
