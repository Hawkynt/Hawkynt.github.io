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

  // Resolve a template ID to a base template object (legacy or registry)
  function _resolveTemplate(templateId) {
    let tmpl = ENEMY_TEMPLATES[templateId];
    if (!tmpl && TR.CreatureRegistry) {
      const reg = TR.CreatureRegistry.getMonster(templateId);
      if (reg) {
        const _mod = s => Math.floor(((s || 10) - 10) / 2);
        tmpl = {
          name: reg.name,
          type: reg.type,
          cr: reg.cr || 1,
          hitDice: reg.racialHD || 1,
          hp: reg.racialHD * (Math.ceil((reg.hitDie ? parseInt(reg.hitDie.slice(1)) : 8) / 2) + _mod(reg.stats?.con || 10)),
          ac: 10 + _mod(reg.stats?.dex || 10) + (reg.naturalArmor || 0),
          bab: reg.bab || 0,
          speed: reg.speed?.land || reg.speed || 30,
          size: reg.size?.charAt(0) || 'M',
          vision: reg.traits?.includes('darkvision60') ? 'darkvision' : reg.traits?.includes('lowLightVision') ? 'low-light' : 'normal',
          stats: reg.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          damageDice: reg.damageDice || 1,
          damageSides: reg.damageSides || 6,
          xpReward: reg.xpReward || Math.round(300 * (reg.cr || 1)),
          goldReward: reg.goldReward || Math.round(100 * (reg.cr || 1)),
          mp: 0,
          maxMp: 0,
          spells: [],
        };
      }
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
    const saves = Object.freeze({
      fort: Character.calcSave(typeInfo.goodSaves.includes('fort') ? 'good' : 'poor', totalHD)
            + Character.abilityMod(tmpl.stats.con),
      ref:  Character.calcSave(typeInfo.goodSaves.includes('ref') ? 'good' : 'poor', totalHD)
            + Character.abilityMod(tmpl.stats.dex),
      will: Character.calcSave(typeInfo.goodSaves.includes('will') ? 'good' : 'poor', totalHD)
            + Character.abilityMod(tmpl.stats.wis),
    });

    const spells = tmpl.spells || [];
    const mp = tmpl.mp || 0;
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
      vision: tmpl.vision,
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

    initCombatWithGrid(party, enemies, grid, biome, partyCenter) {
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

      while (!unit.isAlive) {
        this.nextTurn();
        return this.startTurn();
      }

      unit.beginTurn();
      this.#emit('turnStart', { unit });

      if (unit.faction === 'party') {
        this.#moveRange = Pathfinding.movementRange(this.#grid, unit.position, unit.speedTiles, unit.faction);
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
      this.#moveRange = Pathfinding.movementRange(this.#grid, unit.position, unit.speedTiles, unit.faction);
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
          damage = Math.max(1, Math.round(dmg.total * falloff));
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
        damage = dmg.total;
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
      const effectiveAC = defender.ac + terrainCover;

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

      const attackResult = D20.attackRoll(this.#prng, attacker.bab, attacker.strMod, flankBonus + equipAtk + bossAtk, effectiveAC);
      let damage = 0;
      let critical = false;

      if (attackResult.hit) {
        const tmpl = ENEMY_TEMPLATES[ch.class];
        const dieCount = weapon ? weapon.damageDice : (ch.damageDice || (tmpl ? tmpl.damageDice : 1));
        const dieSides = weapon ? weapon.damageSides : (ch.damageSides || (tmpl ? tmpl.damageSides : 6));
        const critRange = weapon ? weapon.critRange : [20];
        const critMult = weapon ? weapon.critMult : 2;
        const dmgResult = D20.damageRoll(this.#prng, dieCount, dieSides, attacker.strMod, equipDmg);

        const critResult = D20.criticalCheck(this.#prng, attackResult.d20, critRange, attacker.bab, attacker.strMod, flankBonus + equipAtk + bossAtk, effectiveAC, critMult);
        if (critResult.confirmed) {
          critical = true;
          damage = dmgResult.total * critResult.multiplier;
        } else {
          damage = dmgResult.total;
        }

        if (weapon && weapon.affixDamage) {
          const affix = D20.damageRoll(this.#prng, weapon.affixDamage.dice, weapon.affixDamage.sides, 0, 0);
          damage += affix.total;
        }

        damage = Math.round(damage * bossDmgMult);
        defender.takeDamage(damage);
      }

      const logEntry = `${attacker.logName} attacks ${defender.logName}: d20+${attacker.bab}${flankBonus ? `+${flankBonus}flank` : ''}=${attackResult.total} vs AC ${effectiveAC} ${attackResult.hit ? 'HIT' : 'MISS'}${critical ? ' CRITICAL!' : ''}${attackResult.hit ? ` (${damage} dmg)` : ''}${!defender.isAlive ? ' - SLAIN!' : ''}`;
      this.#combatLog.push(logEntry);

      this.#emit('attackResolved', { attacker, defender, result: attackResult, damage, critical, flanking });

      if (this.checkVictory())
        this.#phase = CombatPhase.VICTORY;
      else if (this.checkDefeat())
        this.#phase = CombatPhase.DEFEAT;

      return { hit: attackResult.hit, damage, critical, flanking, d20: attackResult.d20, total: attackResult.total, natural20: attackResult.natural20, natural1: attackResult.natural1 };
    }

    executeEnemyTurn(unitId) {
      const unit = this.unitById(unitId);
      if (!unit || unit.faction !== 'enemy' || !unit.isAlive || !unit.isConscious)
        return;

      unit.beginTurn();
      const partyUnits = this.#units.filter(u => u.faction === 'party' && u.isAlive);
      const allEnemyUnits = this.#aiTier >= 3 ? this.#units.filter(u => u.faction === 'enemy' && u.isAlive) : null;

      // Tier 4: use pre-coordinated plan if available
      let decision;
      if (this.#aiTier >= 4 && this.#coordinatedPlan && this.#coordinatedPlan.has(unitId))
        decision = this.#coordinatedPlan.get(unitId);
      else
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
      return this.#units.filter(u => u.faction === 'enemy').every(u => !u.isAlive);
    }

    checkDefeat() {
      return this.#units.filter(u => u.faction === 'party').every(u => !u.isAlive);
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
