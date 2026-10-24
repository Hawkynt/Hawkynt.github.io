;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { CombatGrid, CombatUnit, Pathfinding, D20, EnemyAI, Character, Terrain, Spells, CLASSES } = TR;

  const CombatPhase = Object.freeze({
    INIT:            'INIT',
    TURN_START:      'TURN_START',
    AWAITING_MOVE:   'AWAITING_MOVE',
    AWAITING_ACTION: 'AWAITING_ACTION',
    AWAITING_TARGET: 'AWAITING_TARGET',
    AWAITING_SPELL_TARGET: 'AWAITING_SPELL_TARGET',
    RESOLVING:       'RESOLVING',
    ENEMY_TURN:      'ENEMY_TURN',
    TURN_END:        'TURN_END',
    VICTORY:         'VICTORY',
    DEFEAT:          'DEFEAT',
  });

  // D&D 3.5e SRD creature type classifications — consumed from data/creature-types.js
  const _ctPending = TR._pending?.creatureTypes || {};
  const CREATURE_TYPES = {};
  for (const [key, val] of Object.entries(_ctPending))
    CREATURE_TYPES[key] = Object.freeze({ hitDie: val.hitDie, bab: val.bab, goodSaves: Object.freeze(val.goodSaves || []) });
  Object.freeze(CREATURE_TYPES);
  if (TR._pending) delete TR._pending.creatureTypes;

  // Enemy templates consumed from data/enemy-templates.js via _pending
  const _etPending = TR._pending?.enemyTemplates || {};
  const _etObj = {};
  for (const [key, val] of Object.entries(_etPending)) {
    const frozen = { ...val };
    if (frozen.stats) frozen.stats = Object.freeze(frozen.stats);
    if (frozen.spells) frozen.spells = Object.freeze(frozen.spells);
    _etObj[key] = Object.freeze(frozen);
  }
  if (TR._pending) delete TR._pending.enemyTemplates;

  const ENEMY_TEMPLATES = Object.freeze(_etObj);

  // Boss templates consumed from data/boss-templates.js via _pending
  const _btPending = TR._pending?.bossTemplates || {};
  const _btObj = {};
  for (const [key, val] of Object.entries(_btPending)) {
    const frozen = { ...val };
    if (frozen.phases) frozen.phases = Object.freeze(frozen.phases.map(p => Object.freeze({ ...p })));
    _btObj[key] = Object.freeze(frozen);
  }
  if (TR._pending) delete TR._pending.bossTemplates;
  const BOSS_TEMPLATES = Object.freeze(_btObj);


  function createBossCharacter(bossId, prng) {
    const boss = BOSS_TEMPLATES[bossId];
    if (!boss) return null;
    const base = templateToCharacter(boss.base, prng, boss.extraHD || 0);
    if (!base) return null;
    return Object.freeze({
      ...base,
      name: boss.name,
      hp: Math.round(base.hp * boss.hpMult),
      maxHp: Math.round(base.maxHp * boss.hpMult),
      ac: base.ac + (boss.acBonus || 0),
      bab: base.bab + (boss.babBonus || 0),
      isBoss: true,
      bossId,
      bossPhases: boss.phases,
      bossCurrentPhase: 0,
    });
  }

  function getBossPhase(unit) {
    const ch = unit.character;
    if (!ch || !ch.isBoss || !ch.bossPhases)
      return null;
    const hpRatio = unit.currentHp / unit.maxHp;
    let active = null;
    for (const phase of ch.bossPhases)
      if (hpRatio <= phase.hpThreshold)
        active = phase;
    return active;
  }

  // D&D 3.5e SRD monster advancement: creature type drives HP die, BAB, saves, and ability bumps
  // Legacy wrapper - kept for backward compat
  function levelUpTemplate(templateId, extraHD) {
    const base = ENEMY_TEMPLATES[templateId];
    if (!base || extraHD <= 0) return base;
    return scaleCreature(base, (base.hitDice || 1) + extraHD);
  }

  // Scale any creature to an arbitrary target level (hit dice).
  // targetHD can be 1 (baby tarrasque) or 100 (epic rat).
  // Returns a new frozen template with all stats recalculated.
  function scaleCreature(base, targetHD) {
    if (!base) return null;
    targetHD = Math.max(1, Math.round(targetHD));

    const typeInfo = CREATURE_TYPES[base.type] || CREATURE_TYPES.humanoid;
    const baseHD = base.hitDice || 1;
    const ratio = targetHD / baseHD;

    // Ability score scaling: +1 per 4 HD (D&D 3.5e), applied to primary stat
    // For downscaling, stats don't go below racial minimum (base - bumps already baked in)
    const baseAbilityBumps = Math.floor(baseHD / 4);
    const targetAbilityBumps = Math.floor(targetHD / 4);
    const bumpDelta = targetAbilityBumps - baseAbilityBumps;
    const primaryStat = base.stats.str >= base.stats.dex ? 'str' : 'dex';
    const secondaryStat = primaryStat === 'str' ? 'con' : 'wis';
    const newStats = { ...base.stats };
    if (bumpDelta !== 0) {
      // Distribute bumps: 2/3 to primary, 1/3 to secondary
      const primaryBumps = Math.ceil(Math.abs(bumpDelta) * 2 / 3) * Math.sign(bumpDelta);
      const secondaryBumps = bumpDelta - primaryBumps;
      newStats[primaryStat] = Math.max(1, newStats[primaryStat] + primaryBumps);
      newStats[secondaryStat] = Math.max(1, newStats[secondaryStat] + secondaryBumps);
    }

    // HP: recalculate from scratch using target HD
    const conMod = Character.abilityMod(newStats.con);
    const hpPerHD = Math.max(1, Math.ceil(typeInfo.hitDie / 2) + conMod);
    const newHp = Math.max(1, hpPerHD * targetHD);

    // BAB: recalculate from creature type progression
    const newBab = Character.calcBAB(typeInfo.bab, targetHD);

    // AC: base AC scales with natural armor growth
    const baseDexMod = Character.abilityMod(base.stats.dex);
    const baseNatural = base.ac - 10 - baseDexMod;
    const newDexMod = Character.abilityMod(newStats.dex);
    // Natural armor grows roughly +1 per 4 HD beyond base
    const naturalGrowth = Math.floor(Math.max(0, targetHD - baseHD) / 4);
    const naturalShrink = Math.floor(Math.max(0, baseHD - targetHD) / 4);
    const newNatural = Math.max(0, baseNatural + naturalGrowth - naturalShrink);
    const newAc = 10 + newDexMod + newNatural;

    // Damage: scale dice count with HD ratio
    const baseDamageDice = base.damageDice || 1;
    const baseDamageSides = base.damageSides || 6;
    const newDamageDice = Math.max(1, Math.round(baseDamageDice * Math.max(0.5, Math.min(ratio, 5))));

    // CR: scale proportionally
    const baseCR = base.cr || 1;
    const newCR = Math.max(0.125, baseCR * ratio);

    // XP/Gold scale with CR ratio
    const crRatio = newCR / Math.max(0.125, baseCR);
    const newXp = Math.max(1, Math.round((base.xpReward || 0) * crRatio));
    const newGold = Math.max(0, Math.round((base.goldReward || 0) * crRatio));

    // Name suffix for level-shifted creatures
    let name = base.name;
    if (targetHD > baseHD * 2)
      name = 'Greater ' + base.name;
    else if (targetHD > baseHD)
      name = base.name + (targetHD >= baseHD + 3 ? ' Champion' : ' Leader');
    else if (targetHD < baseHD / 2)
      name = 'Lesser ' + base.name;
    else if (targetHD < baseHD)
      name = 'Young ' + base.name;

    return Object.freeze({
      ...base,
      name,
      hp: newHp,
      ac: newAc,
      bab: newBab,
      stats: Object.freeze(newStats),
      hitDice: targetHD,
      cr: newCR,
      damageDice: newDamageDice,
      damageSides: baseDamageSides,
      xpReward: newXp,
      goldReward: newGold,
    });
  }

  // D&D size modifier to AC and attack rolls.
  const SIZE_MOD = Object.freeze({ F: 8, D: 4, T: 2, S: 1, M: 0, L: -1, H: -2, G: -4, C: -8 });

  // Grid movement: flyers use their wings, but boards are small, so very
  // fast creatures are capped to keep battles on screen.
  const MAX_SPEED = 60;

  function _abilityMod(score) {
    return Math.floor(((score == null ? 10 : score) - 10) / 2);
  }

  // Registry monsters are scaled to the game's reward economy, which is
  // far below tabletop XP: about 20 + 25 XP per CR.
  function _registryTemplate(reg) {
    const stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...(reg.stats || {}) };
    const die = parseInt(String(reg.hitDie || 'd8').slice(1), 10) || 8;
    const racialHD = reg.racialHD || 1;
    // undead and constructs have no Con score: no Con bonus to their HP
    const conMod = reg.type === 'undead' || reg.type === 'construct' ? 0 : _abilityMod(stats.con);
    const hp = Math.max(1, Math.round(racialHD * (die / 2 + 0.5 + conMod)));
    const sizeCode = String(reg.size || 'Medium').charAt(0).toUpperCase();
    const sizeMod = SIZE_MOD[sizeCode] || 0;
    const sp = reg.speed && typeof reg.speed === 'object' ? reg.speed : { land: Number(reg.speed) || 30 };
    const land = sp.land || 0, fly = sp.fly || 0, swim = sp.swim || 0;
    const speed = Math.max(10, Math.min(MAX_SPEED, Math.max(land, fly, land ? 0 : swim)));
    const traits = reg.traits || [];
    const darkvision = traits.some(t => /^darkvision\d+$/.test(t)) || traits.includes('see_in_darkness');
    const vision = darkvision ? 'darkvision' : traits.includes('low_light_vision') ? 'low-light' : 'normal';
    const cr = reg.cr || 1;
    return {
      name: reg.name,
      type: reg.type,
      subtypes: reg.subtypes || [],
      cr,
      hitDice: Math.max(1, Math.round(racialHD)),
      hp,
      ac: 10 + _abilityMod(stats.dex) + (reg.naturalArmor || 0) + sizeMod,
      bab: reg.bab || 0,
      sizeMod,
      speed,
      passMode: reg.passMode || undefined,
      size: sizeCode,
      vision,
      stats,
      saves: reg.baseSaves ? { ...reg.baseSaves } : null,
      damageDice: reg.damageDice || 1,
      damageSides: reg.damageSides || 6,
      breath: reg.breath || null,
      traits,
      casterLevel: reg.casterLevel || 0,
      xpReward: Math.round(20 + 25 * cr),
      goldReward: Math.round(5 + 10 * cr),
      mp: 0,
      maxMp: 0,
      spells: [],
    };
  }

  // Resolve a template ID to a base template object (legacy or registry)
  function _resolveTemplate(templateId) {
    let tmpl = ENEMY_TEMPLATES[templateId];
    // legacy templates keep their tuned stats but gain the full creature's
    // special abilities, subtypes and movement
    if (tmpl && TR.CreatureRegistry && !tmpl.traits) {
      const reg = TR.CreatureRegistry.getMonster(templateId);
      if (reg)
        tmpl = { ...tmpl, traits: reg.traits || [], subtypes: reg.subtypes || [], passMode: reg.passMode || undefined };
    }
    if (!tmpl && TR.CreatureRegistry) {
      const reg = TR.CreatureRegistry.getMonster(templateId);
      if (reg)
        tmpl = _registryTemplate(reg);
    }
    return tmpl || null;
  }

  // Create a combat character from a template.
  // targetLevel: if provided, scale the creature to this HD (supports arbitrary level scaling)
  // extraHD: legacy parameter, adds HD on top of base (backward compat)
  function templateToCharacter(templateId, prng, extraHD, targetLevel) {
    let tmpl = _resolveTemplate(templateId);
    if (!tmpl)
      return null;

    // Apply scaling: targetLevel takes priority, else extraHD for backward compat
    if (targetLevel != null && targetLevel > 0)
      tmpl = scaleCreature(tmpl, targetLevel);
    else if (extraHD > 0)
      tmpl = scaleCreature(tmpl, (tmpl.hitDice || 1) + extraHD);

    const typeInfo = CREATURE_TYPES[tmpl.type] || CREATURE_TYPES.humanoid;
    const totalHD = tmpl.hitDice || 1;
    // monsters keep the saves from their stat block, shifted by advancement
    const baseHD = (_resolveTemplate(templateId) || tmpl).hitDice || 1;
    const shift = kind => Character.calcSave(typeInfo.goodSaves.includes(kind) ? 'good' : 'poor', totalHD)
      - Character.calcSave(typeInfo.goodSaves.includes(kind) ? 'good' : 'poor', baseHD);
    const saves = tmpl.saves ? Object.freeze({
      fort: tmpl.saves.fort + shift('fort'),
      ref: tmpl.saves.ref + shift('ref'),
      will: tmpl.saves.will + shift('will'),
    }) : Object.freeze({
      fort: Character.calcSave(typeInfo.goodSaves.includes('fort') ? 'good' : 'poor', totalHD)
            + Character.abilityMod(tmpl.stats.con),
      ref:  Character.calcSave(typeInfo.goodSaves.includes('ref') ? 'good' : 'poor', totalHD)
            + Character.abilityMod(tmpl.stats.dex),
      will: Character.calcSave(typeInfo.goodSaves.includes('will') ? 'good' : 'poor', totalHD)
            + Character.abilityMod(tmpl.stats.wis),
    });

    let spells = tmpl.spells || [];
    let mp = tmpl.mp || 0;
    if (!spells.length && tmpl.traits && TR.MonsterAbilities) {
      spells = TR.MonsterAbilities.spellsFor(tmpl.traits, tmpl.casterLevel || 0, totalHD);
      if (spells.length)
        mp = 4 + 2 * Math.max(1, tmpl.casterLevel || Math.ceil(totalHD / 2));
    }
    return Object.freeze({
      name: tmpl.name,
      race: 'monster',
      class: templateId,
      level: totalHD,
      stats: Object.freeze({ ...tmpl.stats }),
      hp: tmpl.hp,
      maxHp: tmpl.hp,
      mp,
      maxMp: mp,
      ac: tmpl.ac,
      bab: tmpl.bab,
      saves,
      initiative: Character.abilityMod(tmpl.stats.dex),
      speed: tmpl.speed,
      size: tmpl.size,
      sizeMod: tmpl.sizeMod || 0,
      passMode: tmpl.passMode,
      vision: tmpl.vision,
      creatureType: tmpl.type,
      subtypes: Object.freeze([...(tmpl.subtypes || [])]),
      traits: Object.freeze([...(tmpl.traits || [])]),
      cr: tmpl.cr,
      breath: tmpl.breath || null,
      casterLevel: tmpl.casterLevel || 0,
      spells,
      xpReward: tmpl.xpReward || 0,
      goldReward: tmpl.goldReward || 0,
      damageDice: tmpl.damageDice,
      damageSides: tmpl.damageSides,
    });
  }

  TR.CREATURE_TYPES = CREATURE_TYPES;
  TR.BOSS_TEMPLATES = BOSS_TEMPLATES;
  TR.CombatPhase = CombatPhase;
  TR.CombatTemplates = {
    CREATURE_TYPES, ENEMY_TEMPLATES, BOSS_TEMPLATES,
    createBossCharacter, getBossPhase, levelUpTemplate, scaleCreature,
    SIZE_MOD, MAX_SPEED, templateToCharacter,
  };
})();
