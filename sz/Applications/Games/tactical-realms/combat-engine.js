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

  class CombatEngine {
    #prng;
    #grid;
    #units;
    #turnOrder;
    #turnIndex;
    #round;
    #phase;
    #moveRange;
    #pendingMove;
    #prevPosition;
    #combatLog;
    #listeners;
    #selectedSpell;
    #aiTier;
    #coordinatedPlan;
    #plannedRound = 0;
    #conditions = null;
    #cooldowns = new Map();
    #auraDone = new Set();
    #skipGuard = 0;
    #planeTraits = [];

    constructor(prng) {
      this.#prng = prng;
      this.#grid = null;
      this.#units = [];
      this.#turnOrder = [];
      this.#turnIndex = 0;
      this.#round = 1;
      this.#phase = CombatPhase.INIT;
      this.#moveRange = null;
      this.#pendingMove = null;
      this.#prevPosition = null;
      this.#combatLog = [];
      this.#listeners = new Map();
      this.#selectedSpell = null;
      this.#aiTier = 0;
      this.#coordinatedPlan = null;
    }

    get grid() { return this.#grid; }
    get planeTraits() { return this.#planeTraits; }

    // The traits of the plane the fight happens on (TR.PlaneWorlds.traits):
    // call after the units are placed.
    setPlaneTraits(traits) {
      this.#planeTraits = (traits || []).slice();
      for (const t of this.#planeTraits)
        if (t.passMode)
          for (const u of this.#units)
            u.grantPassMode(t.passMode);
      if (this.#planeTraits.length)
        this.#combatLog.push(`The plane: ${this.#planeTraits.map(t => t.name).join(', ')}`);
    }

    #planeTrait(key) {
      return this.#planeTraits.find(t => t[key] != null) || null;
    }

    // natives of an aligned plane hit a little more often, visitors of a
    // despairing one a little less
    #planeAttackBonus(unit) {
      let bonus = 0;
      const home = this.#planeTrait('natives');
      const subs = unit.character.subtypes || [];
      const native = !!home && home.natives.every(s => subs.includes(s));
      if (native)
        bonus += 1;
      const visitors = this.#planeTrait('visitorAttack');
      if (visitors && !native && unit.faction === 'party')
        bonus += visitors.visitorAttack;
      return bonus;
    }

    // energy of the plane burning, freezing or draining at a turn's start
    #planeTurnEffects(unit) {
      const hz = this.#planeTrait('hazard');
      if (hz && unit.isAlive) {
        const { energy, dice } = hz.hazard;
        const ch = unit.character;
        const undead = ch.creatureType === 'undead';
        const kin = (ch.subtypes || []).includes(energy);
        if (!(energy === 'negative' && (undead || ch.creatureType === 'construct')) && !kin) {
          let dmg = 0;
          for (let i = 0; i < dice[0]; ++i)
            dmg += 1 + Math.floor(this.#prng.next() * dice[1]);
          const adj = TR.MonsterAbilities && energy !== 'negative' ? TR.MonsterAbilities.adjustDamage(unit, dmg, energy) : { amount: dmg, note: null };
          if (adj.amount > 0) {
            unit.takeDamage(adj.amount);
            this.#combatLog.push(`${unit.logName} suffers ${adj.amount} ${energy} damage (${hz.name})${unit.isAlive ? '' : ' - SLAIN!'}`);
            this.#emit('planeEffect', { unit, amount: adj.amount, kind: energy, trait: hz.id });
          } else if (adj.note)
            this.#combatLog.push(`${unit.logName}: ${adj.note}`);
        }
      }
      const vital = this.#planeTrait('heal');
      if (vital && unit.isAlive && unit.currentHp < unit.maxHp) {
        const before = unit.currentHp;
        unit.heal(vital.heal);
        if (unit.currentHp > before)
          this.#emit('planeEffect', { unit, amount: -(unit.currentHp - before), kind: 'positive', trait: vital.id });
      }
    }

    // spell damage after the plane's magic: elements, potency, wild surges
    #planeSpellDamage(spell, raw) {
      if (!this.#planeTraits.length || raw <= 0)
        return raw;
      let mult = 1;
      const el = TR.MonsterAbilities ? TR.MonsterAbilities.spellElement(spell) : null;
      const elem = this.#planeTrait('energy');
      if (elem && el === elem.energy)
        mult *= 1.5;
      else if (elem && el === elem.opposed)
        mult *= 0.5;
      const potent = this.#planeTrait('spellMult');
      if (potent)
        mult *= potent.spellMult;
      if (this.#planeTrait('wild'))
        mult *= 0.5 + this.#prng.next();
      return Math.max(1, Math.round(raw * mult));
    }
    get aiTier() { return this.#aiTier; }
    setAiTier(tier) { this.#aiTier = Math.min(4, Math.max(0, tier || 0)); }
    get units() { return this.#units; }
    get turnOrder() { return this.#turnOrder; }
    get turnIndex() { return this.#turnIndex; }
    get round() { return this.#round; }
    get phase() { return this.#phase; }
    get moveRange() { return this.#moveRange; }
    get combatLog() { return this.#combatLog; }
    get selectedSpell() { return this.#selectedSpell; }

    get currentUnit() {
      if (this.#turnOrder.length === 0)
        return null;
      return this.unitById(this.#turnOrder[this.#turnIndex].id);
    }

    static get ENEMY_TEMPLATES() { return ENEMY_TEMPLATES; }
    static get BOSS_TEMPLATES() { return BOSS_TEMPLATES; }
    static get CREATURE_TYPES() { return CREATURE_TYPES; }

    initCombat(party, enemies, gridCols, gridRows, biome) {
      this.#resetEffects();
      CombatUnit.resetCombatTags();
      this.#grid = CombatGrid.generate(gridCols, gridRows, this.#prng.fork('grid'), biome);
      this.#units = [];
      this.#combatLog = [];
      this.#round = 1;
      this.#turnIndex = 0;

      for (let i = 0; i < party.length; ++i) {
        const id = `party_${i}`;
        const row = Math.floor(gridRows / 2) - Math.floor(party.length / 2) + i;
        const col = 1;
        const r = Math.max(0, Math.min(gridRows - 1, row));
        let charData = party[i];
        if (!charData.spells && Spells) {
          const spells = Spells.assignSpells(charData.class, charData.level, this.#prng.fork(`spells_${i}`));
          if (spells.length > 0)
            charData = Object.freeze({ ...charData, spells });
        }
        const unit = new CombatUnit(id, charData, 'party', col, r);
        this.#units.push(unit);
        this.#grid.placeUnit(id, col, r);
      }

      for (let i = 0; i < enemies.length; ++i) {
        const tmpl = enemies[i];
        const id = `enemy_${i}`;
        const char = templateToCharacter(tmpl.templateId, this.#prng, tmpl.extraHD || 0, tmpl.targetLevel);
        const row = Math.floor(gridRows / 2) - Math.floor(enemies.length / 2) + i;
        const col = gridCols - 2;
        const r = Math.max(0, Math.min(gridRows - 1, row));
        const unit = new CombatUnit(id, char, 'enemy', col, r);
        this.#units.push(unit);
        this.#grid.placeUnit(id, col, r);
      }

      const initEntries = [];
      for (const u of this.#units) {
        const roll = D20.rollInitiative(this.#prng, u.dexMod, 0);
        initEntries.push({ id: u.id, total: roll.total, dexMod: u.dexMod, roll: roll.roll });
      }
      this.#turnOrder = D20.sortInitiative(initEntries, this.#prng);

      this.#combatLog.push(`Combat begins! Round ${this.#round}`);
      for (const e of this.#turnOrder)
        this.#combatLog.push(`  ${this.unitById(e.id).logName}: Initiative ${e.total} (d20=${e.roll})`);

      this.#phase = CombatPhase.TURN_START;
    }

    // Battle on a prepared board with everyone already placed (dungeon
    // encounters). `ambush` gives the side that noticed the other first a
    // head start on initiative: 'party', 'enemy' or null.
    initCombatAt(party, enemies, grid, partyPositions, enemyPositions, { ambush = null } = {}) {
      this.#resetEffects();
      CombatUnit.resetCombatTags();
      this.#grid = grid;
      this.#units = [];
      this.#combatLog = [];
      this.#round = 1;
      this.#turnIndex = 0;

      for (let i = 0; i < party.length; ++i) {
        const id = `party_${i}`;
        const slot = partyPositions[i] || partyPositions[partyPositions.length - 1];
        let charData = party[i];
        if (!charData.spells && Spells) {
          const spells = Spells.assignSpells(charData.class, charData.level, this.#prng.fork(`spells_${i}`));
          if (spells.length > 0)
            charData = Object.freeze({ ...charData, spells });
        }
        const unit = new CombatUnit(id, charData, 'party', slot.col, slot.row);
        this.#units.push(unit);
        this.#grid.placeUnit(id, slot.col, slot.row);
      }

      for (let i = 0; i < enemies.length; ++i) {
        const tmpl = enemies[i];
        const id = `enemy_${i}`;
        const char = templateToCharacter(tmpl.templateId, this.#prng, tmpl.extraHD || 0, tmpl.targetLevel);
        const slot = enemyPositions[i];
        const unit = new CombatUnit(id, char, 'enemy', slot.col, slot.row);
        this.#units.push(unit);
        this.#grid.placeUnit(id, slot.col, slot.row);
      }

      const initEntries = [];
      for (const u of this.#units) {
        const head = ambush && ambush === u.faction ? 10 : 0;
        const roll = D20.rollInitiative(this.#prng, u.dexMod, head);
        initEntries.push({ id: u.id, total: roll.total, dexMod: u.dexMod, roll: roll.roll });
      }
      this.#turnOrder = D20.sortInitiative(initEntries, this.#prng);

      this.#combatLog.push(ambush === 'party' ? 'You catch them unawares!' : ambush === 'enemy' ? 'They were waiting for you!' : `Combat begins! Round ${this.#round}`);
      for (const e of this.#turnOrder)
        this.#combatLog.push(`  ${this.unitById(e.id).logName}: Initiative ${e.total} (d20=${e.roll})`);

      this.#phase = CombatPhase.TURN_START;
    }

    initCombatWithGrid(party, enemies, grid, biome, partyCenter) {
      this.#resetEffects();
      CombatUnit.resetCombatTags();
      this.#grid = grid;
      this.#units = [];
      this.#combatLog = [];
      this.#round = 1;
      this.#turnIndex = 0;

      const isPassable = (c, r) => {
        if (!grid.inBounds(c, r))
          return false;
        const t = grid.terrainAt(c, r);
        if (!t)
          return false;
        const id = t.id;
        return id !== 'water' && id !== 'mountain';
      };

      const findPassableNear = (centerCol, centerRow, minDist, maxDist) => {
        const candidates = [];
        for (let r = centerRow - maxDist; r <= centerRow + maxDist; ++r)
          for (let c = centerCol - maxDist; c <= centerCol + maxDist; ++c) {
            const dist = Math.abs(c - centerCol) + Math.abs(r - centerRow);
            if (dist < minDist || dist > maxDist)
              continue;
            if (isPassable(c, r) && !grid.isOccupied(c, r))
              candidates.push({ col: c, row: r, dist });
          }
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates;
      };

      const pc = partyCenter || { col: Math.floor(grid.cols / 2), row: Math.floor(grid.rows / 2) };

      const partySlots = findPassableNear(pc.col, pc.row, 0, 3);
      for (let i = 0; i < party.length; ++i) {
        const id = `party_${i}`;
        const slot = partySlots[i] || partySlots[partySlots.length - 1] || pc;
        let charData = party[i];
        if (!charData.spells && Spells) {
          const spells = Spells.assignSpells(charData.class, charData.level, this.#prng.fork(`spells_${i}`));
          if (spells.length > 0)
            charData = Object.freeze({ ...charData, spells });
        }
        const unit = new CombatUnit(id, charData, 'party', slot.col, slot.row);
        this.#units.push(unit);
        this.#grid.placeUnit(id, slot.col, slot.row);
      }

      const enemySlots = findPassableNear(pc.col, pc.row, 4, 6);
      for (let i = 0; i < enemies.length; ++i) {
        const tmpl = enemies[i];
        const id = `enemy_${i}`;
        const char = templateToCharacter(tmpl.templateId, this.#prng, tmpl.extraHD || 0, tmpl.targetLevel);
        const slot = enemySlots[i] || enemySlots[enemySlots.length - 1] || { col: pc.col + 4, row: pc.row };
        const unit = new CombatUnit(id, char, 'enemy', slot.col, slot.row);
        this.#units.push(unit);
        this.#grid.placeUnit(id, slot.col, slot.row);
      }

      const initEntries = [];
      for (const u of this.#units) {
        const roll = D20.rollInitiative(this.#prng, u.dexMod, 0);
        initEntries.push({ id: u.id, total: roll.total, dexMod: u.dexMod, roll: roll.roll });
      }
      this.#turnOrder = D20.sortInitiative(initEntries, this.#prng);

      this.#combatLog.push(`Combat begins! Round ${this.#round}`);
      for (const e of this.#turnOrder)
        this.#combatLog.push(`  ${this.unitById(e.id).logName}: Initiative ${e.total} (d20=${e.roll})`);

      this.#phase = CombatPhase.TURN_START;
    }

    startTurn() {
      const unit = this.currentUnit;
      if (!unit)
        return;
      // a side can fall outside an attack (traps, effects, a fled foe)
      if (this.checkVictory()) {
        this.#phase = CombatPhase.VICTORY;
        return;
      }
      if (this.checkDefeat()) {
        this.#phase = CombatPhase.DEFEAT;
        return;
      }

      while (!unit.isAlive) {
        this.nextTurn();
        return this.startTurn();
      }

      // conditions run out, wounds knit; the helpless lose their turn
      if (!this.#beginTurnEffects(unit) && this.#skipGuard < 200) {
        ++this.#skipGuard;
        this.nextTurn();
        return this.startTurn();
      }
      this.#skipGuard = 0;

      unit.beginTurn();
      this.#emit('turnStart', { unit });

      if (unit.faction === 'party') {
        const fx = this.#effects(unit);
        this.#moveRange = Pathfinding.movementRange(this.#grid, unit.position, fx && !fx.canMove ? 0 : unit.speedTiles, unit.faction, unit.passMode);
        this.#phase = CombatPhase.AWAITING_MOVE;
      } else {
        this.#phase = CombatPhase.ENEMY_TURN;
      }
    }

    selectMoveTile(col, row) {
      if (this.#phase !== CombatPhase.AWAITING_MOVE)
        return false;
      const key = `${col},${row}`;
      if (!this.#moveRange || !this.#moveRange.has(key))
        return false;
      if (this.#grid.isOccupied(col, row) && this.#grid.unitAt(col, row) !== this.currentUnit.id)
        return false;
      this.#pendingMove = { col, row };
      return true;
    }

    confirmMove() {
      if (!this.#pendingMove)
        return;
      const unit = this.currentUnit;
      const prev = unit.position;
      this.#prevPosition = { col: prev.col, row: prev.row };

      this.#grid.moveUnit(unit.id, this.#pendingMove.col, this.#pendingMove.row);
      unit.setPosition(this.#pendingMove.col, this.#pendingMove.row);
      unit.endMove();
      this.#pendingMove = null;
      this.#phase = CombatPhase.AWAITING_ACTION;
    }

    undoMove() {
      if (this.#phase !== CombatPhase.AWAITING_ACTION || !this.#prevPosition)
        return;
      const unit = this.currentUnit;
      this.#grid.moveUnit(unit.id, this.#prevPosition.col, this.#prevPosition.row);
      unit.undoMove(this.#prevPosition.col, this.#prevPosition.row);
      this.#prevPosition = null;
      this.#moveRange = Pathfinding.movementRange(this.#grid, unit.position, unit.speedTiles, unit.faction, unit.passMode);
      this.#phase = CombatPhase.AWAITING_MOVE;
    }

    selectAttack() {
      if (this.#phase !== CombatPhase.AWAITING_ACTION && this.#phase !== CombatPhase.AWAITING_MOVE)
        return;
      this.#phase = CombatPhase.AWAITING_TARGET;
    }

    cancelTarget() {
      if (this.#phase !== CombatPhase.AWAITING_TARGET && this.#phase !== CombatPhase.AWAITING_SPELL_TARGET)
        return;
      this.#selectedSpell = null;
      const unit = this.currentUnit;
      if (unit && unit.hasMoved)
        this.#phase = CombatPhase.AWAITING_ACTION;
      else
        this.#phase = CombatPhase.AWAITING_MOVE;
    }

    selectSpell(spellId) {
      if (this.#phase !== CombatPhase.AWAITING_ACTION && this.#phase !== CombatPhase.AWAITING_MOVE)
        return false;
      const unit = this.currentUnit;
      if (!unit)
        return false;
      const spell = Spells ? Spells.byId(spellId) : null;
      if (!spell || !unit.canCastSpell(spell))
        return false;
      this.#selectedSpell = spell;
      this.#phase = CombatPhase.AWAITING_SPELL_TARGET;
      return true;
    }

    getSpellTargets(unitId, spellId) {
      const unit = this.unitById(unitId);
      if (!unit || !Spells)
        return [];
      const spell = Spells.byId(spellId);
      if (!spell)
        return [];
      return Spells.getSpellTargetsInRange(this.#grid, unit.position, spell, unit.faction, this.#units);
    }

    selectSpellTarget(col, row) {
      if (this.#phase !== CombatPhase.AWAITING_SPELL_TARGET || !this.#selectedSpell)
        return null;
      const spell = this.#selectedSpell;

      if (spell.aoe && spell.aoe > 0)
        return this.selectAoeSpellTarget(col, row);

      const targetId = this.#grid.unitAt(col, row);
      if (!targetId)
        return null;
      const targets = this.getSpellTargets(this.currentUnit.id, spell.id);
      if (!targets.includes(targetId))
        return null;
      const result = this.resolveSpell(this.currentUnit.id, targetId, spell.id);
      this.currentUnit.endAction();
      this.#selectedSpell = null;
      if (this.#phase !== CombatPhase.VICTORY && this.#phase !== CombatPhase.DEFEAT)
        this.#phase = CombatPhase.TURN_END;
      return result;
    }

    selectAoeSpellTarget(col, row) {
      if (this.#phase !== CombatPhase.AWAITING_SPELL_TARGET || !this.#selectedSpell)
        return null;
      const spell = this.#selectedSpell;
      const caster = this.currentUnit;
      if (!caster)
        return null;

      const dist = Math.abs(caster.position.col - col) + Math.abs(caster.position.row - row);
      if (dist > spell.range)
        return null;

      const result = this.resolveAoeSpell(caster.id, spell.id, col, row);
      if (!result)
        return null;
      caster.endAction();
      this.#selectedSpell = null;
      if (this.#phase !== CombatPhase.VICTORY && this.#phase !== CombatPhase.DEFEAT)
        this.#phase = CombatPhase.TURN_END;
      return result;
    }

    resolveAoeSpell(casterId, spellId, centerCol, centerRow) {
      const caster = this.unitById(casterId);
      const spell = Spells ? Spells.byId(spellId) : null;
      if (!caster || !spell)
        return null;

      const aoeRadius = spell.aoe || 0;
      const affectedUnits = [];
      for (const u of this.#units) {
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
          const dmg = D20.damageRoll(this.#prng, spell.damageDice, spell.damageSides, castMod, 0);
          damage = this.#spellDamage(caster, target, spell, Math.max(1, Math.round(dmg.total * falloff)));
          target.takeDamage(damage);
          totalDamage += damage;
        }

        if (spell.healDice > 0 && spell.healSides > 0) {
          const h = D20.damageRoll(this.#prng, spell.healDice, spell.healSides, castMod, 0);
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
      this.#combatLog.push(logParts.join(' '));

      this.#emit('spellResolved', { caster, spell, aoe: true, targets, totalDamage, totalHeal });

      if (this.checkVictory())
        this.#phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this.#phase = CombatPhase.DEFEAT;

      return { hit: true, damage: totalDamage, heal: totalHeal, spell, mpCost: spell.mpCost, aoe: true, centerCol, centerRow, targets };
    }

    getAoeSpellRange(unitId, spellId) {
      const unit = this.unitById(unitId);
      if (!unit || !Spells)
        return [];
      const spell = Spells.byId(spellId);
      if (!spell)
        return [];
      const tiles = [];
      const pos = unit.position;
      for (let r = 0; r < this.#grid.rows; ++r)
        for (let c = 0; c < this.#grid.cols; ++c) {
          const dist = Math.abs(c - pos.col) + Math.abs(r - pos.row);
          if (dist <= spell.range)
            tiles.push({ col: c, row: r });
        }
      return tiles;
    }

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
        const dmg = D20.damageRoll(this.#prng, spell.damageDice, spell.damageSides, castMod, 0);
        damage = this.#spellDamage(caster, target, spell, dmg.total);
        target.takeDamage(damage);
      }

      if (spell.healDice > 0 && spell.healSides > 0) {
        const h = D20.damageRoll(this.#prng, spell.healDice, spell.healSides, castMod, 0);
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
      this.#combatLog.push(logParts.join(' '));

      this.#emit('spellResolved', { caster, target, spell, damage, heal, hit });

      if (this.checkVictory())
        this.#phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this.#phase = CombatPhase.DEFEAT;

      return { hit, damage, heal, spell, mpCost: spell.mpCost };
    }

    selectTarget(col, row) {
      if (this.#phase !== CombatPhase.AWAITING_TARGET)
        return null;
      const targetId = this.#grid.unitAt(col, row);
      if (!targetId)
        return null;
      const targets = this.getAttackTargets(this.currentUnit.id);
      if (!targets.includes(targetId))
        return null;
      const result = this.resolveAttack(this.currentUnit.id, targetId);
      this.currentUnit.endAction();
      if (this.#phase !== CombatPhase.VICTORY && this.#phase !== CombatPhase.DEFEAT)
        this.#phase = CombatPhase.TURN_END;
      return result;
    }

    selectWait() {
      const unit = this.currentUnit;
      if (unit) {
        unit.endMove();
        unit.endAction();
      }
      this.#phase = CombatPhase.TURN_END;
    }

    useItem(item) {
      const unit = this.currentUnit;
      if (!unit || unit.faction !== 'party' || unit.hasActed)
        return null;
      if (this.#phase !== CombatPhase.AWAITING_ACTION && this.#phase !== CombatPhase.AWAITING_MOVE)
        return null;
      if (!item || !item.effect)
        return null;
      const Items = TR.Items;
      if (!Items)
        return null;

      const result = Items.applyConsumable(this.#prng, item, unit.currentHp, unit.maxHp, unit.currentMp, unit.maxMp);
      if (!result)
        return null;

      if (result.type === 'heal') {
        unit.heal(result.amount);
        this.#combatLog.push(`${unit.logName} uses ${item.name} (heals ${result.amount})`);
      } else if (result.type === 'restoreMp') {
        unit.restoreMp(result.amount);
        this.#combatLog.push(`${unit.logName} uses ${item.name} (restores ${result.amount} MP)`);
      } else if (result.type === 'buff') {
        this.#combatLog.push(`${unit.logName} uses ${item.name} (+${result.bonus} ${result.stat} for ${result.duration} rounds)`);
      } else if (result.type === 'cure') {
        this.#combatLog.push(`${unit.logName} uses ${item.name} (cures ${result.condition})`);
      } else if (result.type === 'castSpell') {
        this.#combatLog.push(`${unit.logName} uses ${item.name} (casts ${result.spellId})`);
      }

      unit.endAction();
      this.#emit('itemUsed', { unit, item, result });

      if (this.#phase !== CombatPhase.VICTORY && this.#phase !== CombatPhase.DEFEAT)
        this.#phase = CombatPhase.TURN_END;

      return result;
    }

    resolveAttack(attackerId, defenderId) {
      const attacker = this.unitById(attackerId);
      const defender = this.unitById(defenderId);
      if (!attacker || !defender)
        return { hit: false, damage: 0, critical: false, flanking: false };

      const flanking = D20.isFlanking(this.#grid, attacker.position, defender.position, attacker.faction);
      const flankBonus = flanking ? 2 : 0;

      const terrainCover = Terrain.coverBonus(this.#grid.terrainIdAt(defender.position.col, defender.position.row));
      const defFx = this.#effects(defender);
      const atkFx = this.#effects(attacker);
      // the helpless are easy to hit
      const helpless = defFx && defFx.canAct === false ? -4 : 0;
      const effectiveAC = defender.ac + terrainCover + (defFx ? defFx.acPenalty : 0) + helpless;
      const fxAtk = (atkFx ? atkFx.attackPenalty : 0) - this.#drainedLevels(attacker) + this.#planeAttackBonus(attacker);

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
        const roll = D20.attackRoll(this.#prng, attacker.bab, attacker.strMod, misc, effectiveAC);
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
          const dmgResult = D20.damageRoll(this.#prng, dieCount, dieSides, strBonus, equipDmg);
          const critResult = D20.criticalCheck(this.#prng, roll.d20, critRange, attacker.bab, attacker.strMod, misc, effectiveAC, critMult);
          if (critResult.confirmed) {
            crit = true;
            critical = true;
            dealt = dmgResult.total * critResult.multiplier;
          } else
            dealt = dmgResult.total;
          if (weapon && !swing && weapon.affixDamage) {
            const affix = D20.damageRoll(this.#prng, weapon.affixDamage.dice, weapon.affixDamage.sides, 0, 0);
            dealt += affix.total;
          }
          dealt = Math.max(1, Math.round(dealt * bossDmgMult));
          // damage reduction, incorporeal bodies
          const adj = TR.MonsterAbilities ? TR.MonsterAbilities.adjustDamage(defender, dealt, 'physical', swing ? null : weapon, this.#prng) : { amount: dealt, note: null };
          if (adj.note)
            this.#combatLog.push(`  ${defender.logName}: ${adj.note}`);
          dealt = adj.amount;
          defender.takeDamage(dealt);
          damage += dealt;
        }
        attacks.push({ name: swing ? swing.name : 'weapon', hit: roll.hit, damage: dealt, critical: crit, d20: roll.d20, total: roll.total });
        if (!defender.isAlive)
          break;
      }
      attackResult = { ...attackResult, hit: anyHit };
      const effects = anyHit ? this.#applyRiders(attacker, defender, attacks) : [];

      attacks.forEach((at, i) => {
        const how = attacks.length > 1 ? ` (${at.name})` : '';
        const slain = i === attacks.length - 1 && !defender.isAlive ? ' - SLAIN!' : '';
        this.#combatLog.push(`${attacker.logName} attacks ${defender.logName}${how}: d20+${attacker.bab}${flankBonus ? `+${flankBonus}flank` : ''}=${at.total} vs AC ${effectiveAC} ${at.hit ? 'HIT' : 'MISS'}${at.critical ? ' CRITICAL!' : ''}${at.hit ? ` (${at.damage} dmg)` : ''}${slain}`);
      });

      this.#emit('attackResolved', { attacker, defender, result: attackResult, damage, critical, flanking, effects });

      if (this.checkVictory())
        this.#phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this.#phase = CombatPhase.DEFEAT;

      return { hit: attackResult.hit, damage, critical, flanking, d20: attackResult.d20, total: attackResult.total, natural20: attackResult.natural20, natural1: attackResult.natural1, attacks, effects };
    }

    executeEnemyTurn(unitId) {
      const unit = this.unitById(unitId);
      if (!unit || unit.faction !== 'enemy' || !unit.isAlive || !unit.isConscious)
        return;

      unit.beginTurn();
      const partyUnits = this.#units.filter(u => u.faction === 'party' && u.isAlive && !this.conditionsOf(u.id).includes('petrified'));
      this.#maybeAura(unit, partyUnits);
      const special = this.#chooseSpecial(unit, partyUnits);
      if (special) {
        this.#resolveSpecial(unit, special);
        unit.endAction();
        if (this.#phase !== CombatPhase.VICTORY && this.#phase !== CombatPhase.DEFEAT)
          this.#phase = CombatPhase.TURN_END;
        return;
      }
      const allEnemyUnits = this.#aiTier >= 3 ? this.#units.filter(u => u.faction === 'enemy' && u.isAlive) : null;

      // Tier 4: the first enemy to act each round plans for all of them
      if (this.#aiTier >= 4 && this.#plannedRound !== this.#round) {
        this.#plannedRound = this.#round;
        this.planEnemyRound();
      }
      let decision = null;
      if (this.#aiTier >= 4 && this.#coordinatedPlan && this.#coordinatedPlan.has(unitId)) {
        decision = this.#coordinatedPlan.get(unitId);
        // the plan was made before others moved; drop steps that no longer fit
        if (!this.#planStillValid(unit, decision))
          decision = null;
      }
      if (!decision)
        decision = EnemyAI.decide(this.#grid, unit, partyUnits, this.#prng, this.#aiTier, allEnemyUnits);

      if (decision.type === 'attack') {
        this.resolveAttack(unit.id, decision.target);
      } else if (decision.type === 'move_and_attack') {
        this.#grid.moveUnit(unit.id, decision.moveTo.col, decision.moveTo.row);
        unit.setPosition(decision.moveTo.col, decision.moveTo.row);
        unit.endMove();
        this.resolveAttack(unit.id, decision.target);
      } else if (decision.type === 'spell') {
        this.resolveSpell(unit.id, decision.target, decision.spellId);
      } else if (decision.type === 'move_and_spell') {
        this.#grid.moveUnit(unit.id, decision.moveTo.col, decision.moveTo.row);
        unit.setPosition(decision.moveTo.col, decision.moveTo.row);
        unit.endMove();
        this.resolveSpell(unit.id, decision.target, decision.spellId);
      } else if (decision.type === 'move') {
        this.#grid.moveUnit(unit.id, decision.moveTo.col, decision.moveTo.row);
        unit.setPosition(decision.moveTo.col, decision.moveTo.row);
        unit.endMove();
        this.#combatLog.push(`${unit.logName} moves to (${decision.moveTo.col},${decision.moveTo.row})`);
      } else {
        this.#combatLog.push(`${unit.logName} waits`);
      }

      unit.endAction();
      if (this.#phase !== CombatPhase.VICTORY && this.#phase !== CombatPhase.DEFEAT)
        this.#phase = CombatPhase.TURN_END;
    }

    #planStillValid(unit, d) {
      if (!d || !d.type)
        return false;
      if (d.moveTo) {
        const { col, row } = d.moveTo;
        if (!this.#grid.inBounds(col, row))
          return false;
        const occupant = this.#grid.unitAt(col, row);
        if (occupant && occupant !== unit.id)
          return false;
        const range = Pathfinding.movementRange(this.#grid, unit.position, unit.speedTiles, unit.faction, unit.passMode);
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
    }

    // Called at the start of each enemy round for tier 4 coordination
    planEnemyRound() {
      if (this.#aiTier < 4) {
        this.#coordinatedPlan = null;
        return;
      }
      const enemyUnits = this.#units.filter(u => u.faction === 'enemy' && u.isAlive && u.isConscious);
      const partyUnits = this.#units.filter(u => u.faction === 'party' && u.isAlive);
      this.#coordinatedPlan = EnemyAI.coordinatedDecide(this.#grid, enemyUnits, partyUnits, this.#prng);
    }

    checkVictory() {
      return this.#units.filter(u => u.faction === 'enemy').every(u => this.#out(u));
    }

    checkDefeat() {
      return this.#units.filter(u => u.faction === 'party').every(u => this.#out(u));
    }

    // Conditions on a unit right now (ids), e.g. ['paralyzed'].
    conditionsOf(unitId) {
      return this.#conditions ? this.#conditions.getActive(unitId).map(c => c.conditionId) : [];
    }

    // Puts a condition on a unit unless it is immune; durations in rounds,
    // -1 lasts the whole battle.
    applyCondition(unitId, conditionId, rounds, source) {
      const unit = this.unitById(unitId);
      if (!unit || !this.#conditions || !unit.isAlive)
        return false;
      if (TR.MonsterAbilities && TR.MonsterAbilities.immuneToCondition(unit, conditionId))
        return false;
      this.#conditions.apply(unit.id, conditionId, rounds, source || '');
      this.#syncUnit(unit);
      return true;
    }

    #resetEffects() {
      this.#conditions = TR.ConditionTracker ? new TR.ConditionTracker() : null;
      this.#cooldowns = new Map();
      this.#auraDone = new Set();
      this.#skipGuard = 0;
    }

    #effects(unit) {
      return this.#conditions && unit ? this.#conditions.getEffects(unit.id) : null;
    }

    #drainedLevels(unit) {
      return this.#conditions ? this.#conditions.getActive(unit.id).filter(c => c.conditionId === 'energy_drained').length : 0;
    }

    #syncUnit(unit) {
      const fx = this.#effects(unit);
      unit.setConditions(this.conditionsOf(unit.id), fx ? fx.speedMult : 1);
    }

    #out(u) {
      return !u.isAlive || (!!this.#conditions && this.#conditions.has(u.id, 'petrified'));
    }

    #save(unit, kind, dc) {
      const fx = this.#effects(unit);
      const bonus = TR.MonsterAbilities.saveBonus(unit, kind, (fx ? fx.savePenalty : 0) - this.#drainedLevels(unit));
      return D20.savingThrow(this.#prng, bonus, 0, 0, dc).success;
    }

    #beginTurnEffects(unit) {
      this.#planeTurnEffects(unit);
      if (!unit.isAlive)
        return false;
      if (this.#conditions) {
        const expired = this.#conditions.tickRound(unit.id);
        if (expired.length) {
          this.#syncUnit(unit);
          this.#combatLog.push(`${unit.logName} recovers (${expired.join(', ')})`);
        }
      }
      const a = TR.MonsterAbilities ? TR.MonsterAbilities.parse(unit.character) : null;
      const healing = a ? (a.regen || a.fastHeal) : 0;
      if (healing && unit.isAlive && unit.currentHp < unit.maxHp) {
        unit.heal(healing);
        this.#combatLog.push(`${unit.logName} regenerates ${healing} HP`);
      }
      const fx = this.#effects(unit);
      if (fx && fx.canAct === false) {
        this.#combatLog.push(`${unit.logName} is ${fx.conditions.join(', ')} and loses the turn`);
        return false;
      }
      if (fx && fx.conditions.includes('confused') && this.#prng.next() < 0.5) {
        this.#combatLog.push(`${unit.logName} staggers about in confusion`);
        return false;
      }
      return true;
    }

    // Spell damage after spell resistance and energy defences.
    #spellDamage(caster, target, spell, raw) {
      const MA = TR.MonsterAbilities;
      raw = this.#planeSpellDamage(spell, raw);
      if (!MA || caster.faction === target.faction)
        return raw;
      const a = MA.parse(target.character);
      if (a && a.sr) {
        const sr = D20.spellResistanceCheck(this.#prng, caster.character.level || 1, a.sr);
        if (!sr.overcome) {
          this.#combatLog.push(`  ${target.logName} shrugs off ${spell.name} (SR ${a.sr})`);
          return 0;
        }
      }
      const el = MA.spellElement(spell);
      if (!el)
        return raw;
      const adj = MA.adjustDamage(target, raw, el);
      if (adj.note)
        this.#combatLog.push(`  ${target.logName}: ${adj.note}`);
      return adj.amount;
    }

    // Extra effects of a monster's hit: poison, paralysis, drain, disease,
    // blood drain, grab and constrict, rend. Returns [{ unitId, text }].
    #applyRiders(attacker, defender, attacks) {
      const MA = TR.MonsterAbilities;
      const a = MA ? MA.parse(attacker.character) : null;
      if (!a || !a.riders.length || attacker.faction === defender.faction)
        return [];
      const out = [];
      const ch = attacker.character;
      const dc = MA.saveDC(ch, 'con');
      const note = (text, color) => out.push({ unitId: defender.id, text, color });
      const roll = (n, d) => D20.damageRoll(this.#prng, n, d, 0, 0).total;
      const riders = new Set(a.riders);
      for (const r of riders) {
        if (!defender.isAlive)
          break;
        switch (r) {
          case 'poison':
            if (MA.isImmune(defender, 'poison'))
              break;
            if (this.#save(defender, 'fort', dc)) {
              note('Resists poison', '#a8e0a8');
              break;
            }
            defender.takeDamage(roll(1, 6));
            this.applyCondition(defender.id, 'sickened', 3, ch.name);
            note('Poisoned', '#7ac85a');
            this.#combatLog.push(`  ${defender.logName} is poisoned`);
            break;
          case 'paralysis':
            if (MA.immuneToCondition(defender, 'paralyzed') || this.#save(defender, 'fort', dc))
              break;
            if (this.applyCondition(defender.id, 'paralyzed', this.#prng.nextInt(2, 5), ch.name)) {
              note('Paralyzed', '#f0e080');
              this.#combatLog.push(`  ${defender.logName} is paralyzed`);
            }
            break;
          case 'drain':
            if (this.applyCondition(defender.id, 'energy_drained', 10, ch.name)) {
              attacker.heal(5);
              note('Drained', '#b88ae8');
              this.#combatLog.push(`  ${defender.logName} loses life energy`);
            }
            break;
          case 'weaken':
            if (this.applyCondition(defender.id, 'fatigued', 4, ch.name))
              note('Weakened', '#c8b8a0');
            break;
          case 'disease':
            if (!this.#save(defender, 'fort', dc) && this.applyCondition(defender.id, 'sickened', 4, ch.name))
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
            const mine = D20.grappleCheck(this.#prng, attacker.bab, attacker.strMod, grip(sa), 0).total;
            const theirs = D20.grappleCheck(this.#prng, defender.bab, defender.strMod, grip(sd), 0).total;
            if (mine < theirs)
              break;
            this.applyCondition(defender.id, 'grappled', 1, ch.name);
            if (riders.has('constrict')) {
              const d = roll(ch.damageDice || 1, ch.damageSides || 6) + attacker.strMod;
              defender.takeDamage(Math.max(1, d));
              note('Crushed', '#e8a870');
              this.#combatLog.push(`  ${attacker.logName} constricts ${defender.logName} (${Math.max(1, d)} dmg)`);
            } else
              note('Grabbed', '#e8c878');
            break;
          }
          case 'rend':
            if (attacks.filter(x => x.hit && x.name === 'claw').length >= 2) {
              const d = Math.max(1, roll(2, 6) + Math.floor(attacker.strMod * 1.5));
              defender.takeDamage(d);
              note('Rent', '#e84838');
              this.#combatLog.push(`  ${attacker.logName} rends ${defender.logName} (${d} dmg)`);
            }
            break;
          default:
            break;
        }
      }
      return out;
    }

    // --- monster special actions ---

    #ready(unit, key) {
      const cd = this.#cooldowns.get(unit.id);
      return !cd || !(cd[key] > this.#round);
    }

    #cooldown(unit, key, rounds) {
      const cd = this.#cooldowns.get(unit.id) || {};
      cd[key] = this.#round + rounds;
      this.#cooldowns.set(unit.id, cd);
    }

    // A special the monster should use now, or null.
    #chooseSpecial(unit, foes) {
      const MA = TR.MonsterAbilities;
      const a = MA ? MA.parse(unit.character) : null;
      if (!a || !foes.length)
        return null;
      const friends = this.#units.filter(u => u.faction === unit.faction && u.isAlive);
      const adjacent = foes.some(f => D20.isAdjacent(unit.position, f.position));
      const near = (range, pred = () => true) => foes
        .filter(f => MA.distance(unit.position, f.position) <= range && pred(f))
        .sort((x, y) => MA.distance(unit.position, x.position) - MA.distance(unit.position, y.position));
      if (a.breath && this.#ready(unit, 'breath')) {
        const area = MA.bestArea(this.#grid, unit, foes, friends, a.breath.shape, a.breath.length);
        if (area && !area.own.length && (area.hit.length >= 2 || !adjacent))
          return { kind: 'breath', area };
      }
      if (a.specials.includes('mindblast') && this.#ready(unit, 'mindblast')) {
        const area = MA.bestArea(this.#grid, unit, foes, friends, 'cone', 6);
        if (area && !area.own.length && (area.hit.length >= 2 || !adjacent))
          return { kind: 'mindblast', area };
      }
      if (a.gaze && this.#ready(unit, 'gaze')) {
        const t = near(6, f => !this.conditionsOf(f.id).includes('petrified'))[0];
        if (t)
          return { kind: 'gaze', target: t };
      }
      if (a.specials.includes('rays') && this.#ready(unit, 'rays')) {
        const ts = near(8);
        if (ts.length)
          return { kind: 'rays', targets: ts.slice(0, 3) };
      }
      if (!adjacent) {
        if (a.specials.includes('web') && this.#ready(unit, 'web')) {
          const t = near(6, f => !this.conditionsOf(f.id).includes('entangled'))[0];
          if (t)
            return { kind: 'web', target: t };
        }
        if (a.specials.includes('spit') && this.#ready(unit, 'spit')) {
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
    }

    // Fear auras (frightful presence) wash over the party once per battle.
    #maybeAura(unit, foes) {
      const MA = TR.MonsterAbilities;
      const a = MA ? MA.parse(unit.character) : null;
      if (!a || !a.aura || this.#auraDone.has(unit.id))
        return;
      this.#auraDone.add(unit.id);
      const dc = MA.saveDC(unit.character, 'cha');
      for (const f of foes)
        if (MA.distance(unit.position, f.position) <= 6 && !this.#save(f, 'will', dc)
            && this.applyCondition(f.id, 'shaken', this.#prng.nextInt(3, 6), unit.character.name))
          this.#combatLog.push(`  ${f.logName} is shaken by ${unit.logName}`);
    }

    #resolveSpecial(unit, sp) {
      const MA = TR.MonsterAbilities;
      const a = MA.parse(unit.character);
      const ch = unit.character;
      const roll = (n, d) => D20.damageRoll(this.#prng, n, d, 0, 0).total;
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
              if (this.#save(t, b.effect.save, dc))
                results.push({ unit: t, damage: 0, effect: 'Resists' });
              else
                condition(t, b.effect.condition, this.#prng.nextInt(b.effect.rounds[0], b.effect.rounds[1]), b.effect.condition.replace(/_/g, ' '));
              continue;
            }
            let dmg = roll(b.dice, b.sides);
            const saved = this.#save(t, b.poison ? 'fort' : 'ref', dc);
            if (saved)
              dmg = Math.floor(dmg / 2);
            results.push({ unit: t, damage: hurt(t, dmg, b.energy), effect: saved ? 'Half' : null });
          }
          this.#cooldown(unit, 'breath', this.#prng.nextInt(1, 4) + 1);
          break;
        }
        case 'mindblast': {
          const dc = MA.saveDC(ch, 'cha');
          name = 'Mind blast';
          element = 'psychic';
          shape = 'cone';
          for (const t of sp.area.hit)
            if (this.#save(t, 'will', dc))
              results.push({ unit: t, damage: 0, effect: 'Resists' });
            else
              condition(t, 'stunned', this.#prng.nextInt(1, 4), 'Stunned');
          this.#cooldown(unit, 'mindblast', this.#prng.nextInt(1, 4) + 1);
          break;
        }
        case 'gaze': {
          const g = a.gaze;
          const dc = MA.saveDC(ch, g.ability);
          const t = sp.target;
          name = { petrify: 'Petrifying gaze', stun: 'Stunning gaze', confuse: 'Maddening gaze', death: 'Deathly gaze' }[g.kind];
          element = g.kind === 'petrify' ? 'earth' : g.kind === 'death' ? 'necrotic' : 'psychic';
          if (this.#save(t, g.save, dc))
            results.push({ unit: t, damage: 0, effect: 'Looks away' });
          else if (g.kind === 'petrify')
            condition(t, 'petrified', -1, 'Petrified');
          else if (g.kind === 'stun')
            condition(t, 'stunned', this.#prng.nextInt(1, 4), 'Stunned');
          else if (g.kind === 'confuse')
            condition(t, 'confused', this.#prng.nextInt(2, 5), 'Confused');
          else
            results.push({ unit: t, damage: hurt(t, roll(6, 6)), effect: null });
          this.#cooldown(unit, 'gaze', 2);
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
            const k = kinds[this.#prng.nextInt(0, kinds.length - 1)];
            if (k === 'fire' || k === 'cold') {
              let d = roll(4, 6);
              if (this.#save(t, 'ref', dc))
                d = Math.floor(d / 2);
              results.push({ unit: t, damage: hurt(t, d, k), effect: `${k} ray` });
            } else if (k === 'wound' || k === 'disintegrate') {
              const saved = this.#save(t, k === 'wound' ? 'will' : 'fort', dc);
              const d = k === 'wound' ? roll(3, 8) : saved ? roll(5, 6) : roll(10, 6);
              results.push({ unit: t, damage: hurt(t, k === 'wound' && saved ? Math.floor(d / 2) : d), effect: k === 'wound' ? 'Wounding ray' : 'Disintegrating ray' });
            } else if (this.#save(t, k === 'petrify' ? 'fort' : 'will', dc))
              results.push({ unit: t, damage: 0, effect: 'Resists' });
            else
              condition(t, { petrify: 'petrified', sleep: 'unconscious', slow: 'slowed', fear: 'shaken' }[k], k === 'petrify' ? -1 : this.#prng.nextInt(2, 4), `${k} ray`);
          }
          this.#cooldown(unit, 'rays', 1);
          break;
        }
        case 'web': {
          name = 'Web';
          element = 'nature';
          const dc = MA.saveDC(ch, 'con');
          if (this.#save(sp.target, 'ref', dc))
            results.push({ unit: sp.target, damage: 0, effect: 'Dodges' });
          else
            condition(sp.target, 'entangled', 2, 'Entangled');
          this.#cooldown(unit, 'web', 3);
          break;
        }
        case 'spit': {
          name = 'Spit';
          element = 'acid';
          const dc = MA.saveDC(ch, 'con');
          let d = roll(2, 6);
          if (this.#save(sp.target, 'ref', dc))
            d = Math.floor(d / 2);
          results.push({ unit: sp.target, damage: hurt(sp.target, d, 'acid'), effect: null });
          this.#cooldown(unit, 'spit', 2);
          break;
        }
        case 'rock': {
          name = 'Hurled rock';
          element = 'force';
          const t = sp.target;
          const hit = D20.attackRoll(this.#prng, unit.bab, unit.dexMod, ch.sizeMod || 0, t.ac);
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
      this.#combatLog.push(`${unit.logName} uses ${name}: ${results.map(r => `${r.unit.logName} ${r.damage ? r.damage + ' dmg' : ''}${r.effect ? ' ' + r.effect : ''}${!r.unit.isAlive ? ' - SLAIN!' : ''}`).join(', ')}`);
      const out = { attacker: unit, special, name, element, shape, targets: results, totalDamage: total };
      this.#emit('specialResolved', out);
      if (this.checkVictory())
        this.#phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this.#phase = CombatPhase.DEFEAT;
      return out;
    }

    nextTurn() {
      this.#turnIndex = (this.#turnIndex + 1) % this.#turnOrder.length;
      if (this.#turnIndex === 0) {
        ++this.#round;
        this.#combatLog.push(`--- Round ${this.#round} ---`);
      }
      this.#phase = CombatPhase.TURN_START;
    }

    getAttackTargets(unitId) {
      const unit = this.unitById(unitId);
      if (!unit)
        return [];
      const pos = unit.position;
      const targets = [];
      for (const other of this.#units) {
        if (other.faction === unit.faction || !other.isAlive)
          continue;
        if (D20.isAdjacent(pos, other.position))
          targets.push(other.id);
      }
      return targets;
    }

    getRewards() {
      let xp = 0;
      let gold = 0;
      let maxCr = 0;
      for (const u of this.#units) {
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
      const loot = Items ? Items.generateLoot(this.#prng, maxCr) : [];
      return { xp, gold, loot };
    }

    unitById(id) {
      return this.#units.find(u => u.id === id) || null;
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

    #emit(event, data) {
      const list = this.#listeners.get(event);
      if (list)
        for (const cb of list)
          cb(data);
    }
  }

  CombatEngine.templateToCharacter = templateToCharacter;
  CombatEngine.scaleCreature = scaleCreature;
  CombatEngine.levelUpTemplate = levelUpTemplate;
  CombatEngine.createBossCharacter = createBossCharacter;
  CombatEngine.getBossPhase = getBossPhase;

  TR.CREATURE_TYPES = CREATURE_TYPES;
  TR.BOSS_TEMPLATES = BOSS_TEMPLATES;
  TR.CombatPhase = CombatPhase;
  TR.CombatEngine = CombatEngine;
})();
