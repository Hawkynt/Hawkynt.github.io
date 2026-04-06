;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  // D&D 3.5e Action Types
  const ActionType = Object.freeze({
    FULL_ROUND:  'fullRound',   // full attack, charge, run, withdraw, full-round spell
    STANDARD:    'standard',    // single attack, cast spell, use ability, use item
    MOVE:        'move',        // move, draw weapon, stand from prone, open door
    SWIFT:       'swift',       // 1 per round (some spells/abilities)
    IMMEDIATE:   'immediate',   // like swift but can be done off-turn (uses next swift)
    FREE:        'free',        // drop item, speak, 5-foot step
    NOT_AN_ACTION: 'notAnAction',
  });

  // Tracks available actions for a unit during its turn
  class ActionBudget {
    #standardUsed;
    #moveUsed;
    #swiftUsed;
    #fullRoundUsed;
    #fiveFootStepUsed;
    #hasMovedMoreThanFiveFootStep;
    #aoosUsed;
    #aoosPerRound;

    constructor(combatReflexesBonusAoOs) {
      this.#standardUsed = false;
      this.#moveUsed = false;
      this.#swiftUsed = false;
      this.#fullRoundUsed = false;
      this.#fiveFootStepUsed = false;
      this.#hasMovedMoreThanFiveFootStep = false;
      this.#aoosUsed = 0;
      // 1 AoO base + DEX mod if Combat Reflexes
      this.#aoosPerRound = 1 + (combatReflexesBonusAoOs || 0);
    }

    get canStandard() { return !this.#standardUsed && !this.#fullRoundUsed; }
    get canMove()     { return !this.#moveUsed && !this.#fullRoundUsed; }
    get canSwift()    { return !this.#swiftUsed; }
    get canFullRound(){ return !this.#standardUsed && !this.#moveUsed && !this.#fullRoundUsed; }
    get canFiveFootStep() { return !this.#fiveFootStepUsed && !this.#hasMovedMoreThanFiveFootStep; }
    get canAoO()      { return this.#aoosUsed < this.#aoosPerRound; }

    useStandard()   { this.#standardUsed = true; }
    useMove()       { this.#moveUsed = true; this.#hasMovedMoreThanFiveFootStep = true; }
    useSwift()      { this.#swiftUsed = true; }
    useFullRound()  { this.#fullRoundUsed = true; }
    useFiveFootStep(){ this.#fiveFootStepUsed = true; }
    useAoO()        { ++this.#aoosUsed; }

    // Convert standard to move (allowed in 3.5e)
    standardToMove() {
      if (this.#standardUsed) return false;
      this.#standardUsed = true;
      return true;
    }
  }

  // Full attack resolution
  // Given a BAB (e.g. 16), returns iterative attack bonuses [+16, +11, +6, +1]
  function iterativeAttacks(bab) {
    const attacks = [];
    for (let bonus = bab; bonus > 0; bonus -= 5)
      attacks.push(bonus);
    return attacks;
  }

  // Two-weapon fighting penalties
  function twoWeaponPenalties(hasLightOffhand, hasTWF, hasITWF, hasGTWF) {
    let mainPenalty = -6;
    let offPenalty = -10;

    if (hasLightOffhand) {
      mainPenalty += 2;
      offPenalty += 2;
    }

    if (hasTWF) {
      mainPenalty += 2;
      offPenalty += 6;
    }

    // ITWF grants 1 extra off-hand attack at -5
    // GTWF grants another at -10
    let offhandAttacks = 1;
    if (hasITWF) ++offhandAttacks;
    if (hasGTWF) ++offhandAttacks;

    return { mainPenalty, offPenalty, offhandAttacks };
  }

  // Attack of Opportunity triggers
  const AOO_TRIGGERS = Object.freeze({
    MOVE_THROUGH_THREATENED: 'moveThrough',
    CAST_IN_MELEE: 'castInMelee',
    RANGED_IN_MELEE: 'rangedInMelee',
    STAND_FROM_PRONE: 'standFromProne',
    USE_ITEM: 'useItem',
    DRINK_POTION: 'drinkPotion',
    READ_SCROLL: 'readScroll',
  });

  // Check if a given action provokes AoO
  function provokesAoO(actionType, context) {
    if (actionType === AOO_TRIGGERS.MOVE_THROUGH_THREATENED)
      return true;
    if (actionType === AOO_TRIGGERS.CAST_IN_MELEE && !context?.castDefensively)
      return true;
    if (actionType === AOO_TRIGGERS.RANGED_IN_MELEE)
      return true;
    if (actionType === AOO_TRIGGERS.STAND_FROM_PRONE)
      return true;
    if (actionType === AOO_TRIGGERS.DRINK_POTION)
      return true;
    if (actionType === AOO_TRIGGERS.READ_SCROLL)
      return true;
    return false;
  }

  // Concentration check for casting defensively: DC = 15 + spell level
  function castDefensivelyDC(spellLevel) {
    return 15 + spellLevel;
  }

  // Charge action: move in straight line, +2 attack, -2 AC until next turn
  function chargeBonus() {
    return { attackBonus: 2, acPenalty: -2 };
  }

  // D&D 3.5e XP table (level -> total XP needed), extended to level 100
  // Levels 1-20: standard SRD table
  // Levels 21+: epic progression at 1000 * level * (level - 1) / 2 base
  const _xpTable = [
    0, 0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000,
    55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000,
  ];
  // Epic levels 21-100: each level costs (level - 1) * 1000 more than the previous
  for (let lvl = 21; lvl <= 100; ++lvl)
    _xpTable[lvl] = _xpTable[lvl - 1] + (lvl - 1) * 1000;
  const XP_TABLE = Object.freeze(_xpTable);

  function xpForLevel(level) {
    if (level < 1) return 0;
    if (level > 100) return XP_TABLE[100];
    return XP_TABLE[level];
  }

  function levelFromXp(xp) {
    for (let l = 100; l >= 1; --l)
      if (xp >= XP_TABLE[l])
        return l;
    return 1;
  }

  // CR-based XP award (from DMG Table 3-2, simplified)
  // Party level vs CR determines XP per character
  function xpAward(cr, partyLevel, partySize) {
    // Base XP for CR equal to party level
    const baseCR = 300 * partyLevel;
    // Adjust for CR difference
    const diff = cr - partyLevel;
    const mult = Math.pow(2, diff / 2);
    const totalXP = Math.round(baseCR * mult);
    return Math.max(1, Math.round(totalXP / partySize));
  }

  TR.ActionType = ActionType;
  TR.ActionBudget = ActionBudget;
  TR.AOO_TRIGGERS = AOO_TRIGGERS;
  TR.ActionEconomy = Object.freeze({
    iterativeAttacks,
    twoWeaponPenalties,
    provokesAoO,
    castDefensivelyDC,
    chargeBonus,
    xpForLevel,
    levelFromXp,
    xpAward,
    XP_TABLE,
  });
})();
