;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const SpellTarget = Object.freeze({
    ENEMY:  'enemy',
    ALLY:   'ally',
    SELF:   'self',
  });

  const SpellSchool = Object.freeze({
    EVOCATION:      'evocation',
    NECROMANCY:     'necromancy',
    CONJURATION:    'conjuration',
    ILLUSION:       'illusion',
    TRANSMUTATION:  'transmutation',
    ABJURATION:     'abjuration',
    DIVINATION:     'divination',
    RESTORATION:    'restoration',
    ENCHANTMENT:    'enchantment',
  });

  const CLASS_SCHOOLS = Object.freeze({
    wizard:   Object.freeze([SpellSchool.EVOCATION, SpellSchool.NECROMANCY, SpellSchool.CONJURATION, SpellSchool.ILLUSION, SpellSchool.TRANSMUTATION]),
    cleric:   Object.freeze([SpellSchool.ABJURATION, SpellSchool.DIVINATION, SpellSchool.RESTORATION]),
    paladin:  Object.freeze([SpellSchool.ABJURATION, SpellSchool.RESTORATION]),
    ranger:   Object.freeze([SpellSchool.RESTORATION, SpellSchool.DIVINATION]),
    bard:     Object.freeze([SpellSchool.ENCHANTMENT, SpellSchool.ILLUSION, SpellSchool.DIVINATION]),
    warlock:  Object.freeze([SpellSchool.NECROMANCY, SpellSchool.CONJURATION, SpellSchool.ENCHANTMENT]),
    sorcerer: Object.freeze([SpellSchool.EVOCATION, SpellSchool.ENCHANTMENT, SpellSchool.TRANSMUTATION]),
  });

  const SPELLS_KNOWN_TABLE = Object.freeze([
    Object.freeze({ level: 1,  cantrips: 2, l1: 1, l2: 0, l3: 0, l4: 0 }),
    Object.freeze({ level: 2,  cantrips: 2, l1: 2, l2: 0, l3: 0, l4: 0 }),
    Object.freeze({ level: 3,  cantrips: 3, l1: 2, l2: 0, l3: 0, l4: 0 }),
    Object.freeze({ level: 5,  cantrips: 3, l1: 3, l2: 1, l3: 0, l4: 0 }),
    Object.freeze({ level: 7,  cantrips: 3, l1: 3, l2: 2, l3: 0, l4: 0 }),
    Object.freeze({ level: 10, cantrips: 4, l1: 3, l2: 3, l3: 1, l4: 0 }),
    Object.freeze({ level: 13, cantrips: 4, l1: 3, l2: 3, l3: 2, l4: 0 }),
    Object.freeze({ level: 16, cantrips: 4, l1: 3, l2: 3, l3: 3, l4: 1 }),
    Object.freeze({ level: 19, cantrips: 4, l1: 3, l2: 3, l3: 3, l4: 2 }),
    Object.freeze({ level: 20, cantrips: 5, l1: 3, l2: 3, l3: 3, l4: 3 }),
  ]);

  const SPELL_LIST = Object.freeze([
    // === Cantrips (Level 0) — free, unlimited uses ===
    Object.freeze({ id: 'arcane_bolt',      name: 'Arcane Bolt',      school: SpellSchool.EVOCATION,     level: 0, mpCost: 0, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 6, healDice: 0, healSides: 0, description: 'A bolt of arcane energy' }),
    Object.freeze({ id: 'sacred_flame',     name: 'Sacred Flame',     school: SpellSchool.RESTORATION,   level: 0, mpCost: 0, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 6, healDice: 0, healSides: 0, description: 'A radiant flame' }),
    Object.freeze({ id: 'eldritch_blast',   name: 'Eldritch Blast',   school: SpellSchool.NECROMANCY,    level: 0, mpCost: 0, range: 4, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 8, healDice: 0, healSides: 0, description: 'A crackling beam of eldritch force' }),
    Object.freeze({ id: 'fire_bolt',        name: 'Fire Bolt',        school: SpellSchool.EVOCATION,     level: 0, mpCost: 0, range: 4, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 8, healDice: 0, healSides: 0, description: 'A mote of fire' }),
    Object.freeze({ id: 'vicious_mockery',  name: 'Vicious Mockery',  school: SpellSchool.ENCHANTMENT,   level: 0, mpCost: 0, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 4, healDice: 0, healSides: 0, description: 'A string of insults laced with magic' }),
    Object.freeze({ id: 'chill_touch',      name: 'Chill Touch',      school: SpellSchool.NECROMANCY,    level: 0, mpCost: 0, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 6, healDice: 0, healSides: 0, description: 'A ghostly hand drains life' }),
    Object.freeze({ id: 'shocking_grasp',   name: 'Shocking Grasp',   school: SpellSchool.EVOCATION,     level: 0, mpCost: 0, range: 1, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 8, healDice: 0, healSides: 0, description: 'Lightning arcs from your hand' }),
    Object.freeze({ id: 'mending',          name: 'Mending',          school: SpellSchool.RESTORATION,   level: 0, mpCost: 0, range: 1, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 1, healSides: 4, description: 'Minor restorative magic' }),
    Object.freeze({ id: 'light',            name: 'Light',            school: SpellSchool.TRANSMUTATION,  level: 0, mpCost: 0, range: 0, target: SpellTarget.SELF,  damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Illuminates the area' }),
    Object.freeze({ id: 'minor_illusion',   name: 'Minor Illusion',   school: SpellSchool.ILLUSION,      level: 0, mpCost: 0, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 4, healDice: 0, healSides: 0, description: 'A distracting illusion' }),

    // === Level 1 — cost 2 MP ===
    Object.freeze({ id: 'magic_missile',    name: 'Magic Missile',    school: SpellSchool.EVOCATION,     level: 1, mpCost: 2, range: 4, target: SpellTarget.ENEMY, damageDice: 3, damageSides: 4, healDice: 0, healSides: 0, description: 'Three darts of magical force (auto-hit)' }),
    Object.freeze({ id: 'cure_wounds',      name: 'Cure Wounds',      school: SpellSchool.RESTORATION,   level: 1, mpCost: 2, range: 1, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 1, healSides: 8, description: 'Healing energy flows into an ally' }),
    Object.freeze({ id: 'burning_hands',    name: 'Burning Hands',    school: SpellSchool.EVOCATION,     level: 1, mpCost: 2, range: 2, target: SpellTarget.ENEMY, damageDice: 3, damageSides: 6, healDice: 0, healSides: 0, aoe: 1, description: 'A thin sheet of flames' }),
    Object.freeze({ id: 'hex',              name: 'Hex',              school: SpellSchool.NECROMANCY,     level: 1, mpCost: 2, range: 3, target: SpellTarget.ENEMY, damageDice: 2, damageSides: 6, healDice: 0, healSides: 0, description: 'A necrotic curse' }),
    Object.freeze({ id: 'shield_of_faith',  name: 'Shield of Faith',  school: SpellSchool.ABJURATION,    level: 1, mpCost: 2, range: 1, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: '+2 AC for 3 rounds' }),
    Object.freeze({ id: 'hunters_mark',     name: "Hunter's Mark",    school: SpellSchool.DIVINATION,    level: 1, mpCost: 2, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 6, healDice: 0, healSides: 0, description: 'Mark a foe, dealing bonus damage' }),
    Object.freeze({ id: 'healing_word',     name: 'Healing Word',     school: SpellSchool.RESTORATION,   level: 1, mpCost: 2, range: 3, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 1, healSides: 6, description: 'A spoken word of restoration' }),
    Object.freeze({ id: 'sleep',            name: 'Sleep',            school: SpellSchool.ENCHANTMENT,   level: 1, mpCost: 2, range: 3, target: SpellTarget.ENEMY, damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Target falls asleep (skip 1 turn)' }),
    Object.freeze({ id: 'silent_image',     name: 'Silent Image',     school: SpellSchool.ILLUSION,      level: 1, mpCost: 2, range: 3, target: SpellTarget.ENEMY, damageDice: 1, damageSides: 4, healDice: 0, healSides: 0, description: 'A confusing phantasm' }),
    Object.freeze({ id: 'grease',           name: 'Grease',           school: SpellSchool.CONJURATION,   level: 1, mpCost: 2, range: 3, target: SpellTarget.ENEMY, damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, aoe: 1, description: 'Target slips (skip 1 turn)' }),
    Object.freeze({ id: 'divine_smite',     name: 'Divine Smite',     school: SpellSchool.RESTORATION,   level: 1, mpCost: 2, range: 1, target: SpellTarget.ENEMY, damageDice: 2, damageSides: 8, healDice: 0, healSides: 0, description: 'Channel divine energy through your weapon' }),

    // === Level 2 — cost 4 MP ===
    Object.freeze({ id: 'fireball',         name: 'Fireball',         school: SpellSchool.EVOCATION,     level: 2, mpCost: 4, range: 4, target: SpellTarget.ENEMY, damageDice: 6, damageSides: 6, healDice: 0, healSides: 0, aoe: 2, description: 'A fiery explosion' }),
    Object.freeze({ id: 'scorching_ray',    name: 'Scorching Ray',    school: SpellSchool.EVOCATION,     level: 2, mpCost: 4, range: 4, target: SpellTarget.ENEMY, damageDice: 4, damageSides: 6, healDice: 0, healSides: 0, description: 'Three rays of fire' }),
    Object.freeze({ id: 'ray_of_enfeeblement', name: 'Ray of Enfeeblement', school: SpellSchool.NECROMANCY, level: 2, mpCost: 4, range: 3, target: SpellTarget.ENEMY, damageDice: 2, damageSides: 8, healDice: 0, healSides: 0, description: 'A black beam saps strength' }),
    Object.freeze({ id: 'aid',              name: 'Aid',              school: SpellSchool.RESTORATION,   level: 2, mpCost: 4, range: 1, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 2, healSides: 8, description: 'Bolsters allies with toughness' }),
    Object.freeze({ id: 'hold_person',      name: 'Hold Person',      school: SpellSchool.ENCHANTMENT,   level: 2, mpCost: 4, range: 3, target: SpellTarget.ENEMY, damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Target is paralyzed (skip 2 turns)' }),
    Object.freeze({ id: 'invisibility',     name: 'Invisibility',     school: SpellSchool.ILLUSION,      level: 2, mpCost: 4, range: 0, target: SpellTarget.SELF,  damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Become invisible (+4 AC, 2 rounds)' }),
    Object.freeze({ id: 'web',              name: 'Web',              school: SpellSchool.CONJURATION,   level: 2, mpCost: 4, range: 3, target: SpellTarget.ENEMY, damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, aoe: 1, description: 'Sticky webs immobilize (skip 2 turns)' }),
    Object.freeze({ id: 'lesser_restoration', name: 'Lesser Restoration', school: SpellSchool.RESTORATION, level: 2, mpCost: 4, range: 1, target: SpellTarget.ALLY, damageDice: 0, damageSides: 0, healDice: 3, healSides: 8, description: 'Cures afflictions and restores vitality' }),

    // === Level 3 — cost 6 MP ===
    Object.freeze({ id: 'lightning_bolt',   name: 'Lightning Bolt',   school: SpellSchool.EVOCATION,     level: 3, mpCost: 6, range: 5, target: SpellTarget.ENEMY, damageDice: 8, damageSides: 6, healDice: 0, healSides: 0, description: 'A stroke of lightning' }),
    Object.freeze({ id: 'vampiric_touch',   name: 'Vampiric Touch',   school: SpellSchool.NECROMANCY,    level: 3, mpCost: 6, range: 1, target: SpellTarget.ENEMY, damageDice: 4, damageSides: 6, healDice: 0, healSides: 0, description: 'Drain life from a foe (heal half damage)' }),
    Object.freeze({ id: 'mass_healing_word', name: 'Mass Healing Word', school: SpellSchool.RESTORATION, level: 3, mpCost: 6, range: 3, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 2, healSides: 8, aoe: 2, description: 'Heals multiple allies' }),
    Object.freeze({ id: 'dispel_magic',     name: 'Dispel Magic',     school: SpellSchool.ABJURATION,    level: 3, mpCost: 6, range: 3, target: SpellTarget.ENEMY, damageDice: 3, damageSides: 6, healDice: 0, healSides: 0, description: 'Strip magical protections' }),
    Object.freeze({ id: 'fear',             name: 'Fear',             school: SpellSchool.ILLUSION,      level: 3, mpCost: 6, range: 3, target: SpellTarget.ENEMY, damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, aoe: 2, description: 'Enemies flee in terror (skip 2 turns)' }),
    Object.freeze({ id: 'haste',            name: 'Haste',            school: SpellSchool.TRANSMUTATION,  level: 3, mpCost: 6, range: 1, target: SpellTarget.ALLY,  damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Double movement speed for 3 rounds' }),

    // === Level 4 — cost 8 MP ===
    Object.freeze({ id: 'ice_storm',        name: 'Ice Storm',        school: SpellSchool.EVOCATION,     level: 4, mpCost: 8, range: 5, target: SpellTarget.ENEMY, damageDice: 8, damageSides: 8, healDice: 0, healSides: 0, aoe: 2, description: 'A hail of ice and sleet' }),
    Object.freeze({ id: 'blight',           name: 'Blight',           school: SpellSchool.NECROMANCY,    level: 4, mpCost: 8, range: 3, target: SpellTarget.ENEMY, damageDice: 6, damageSides: 8, healDice: 0, healSides: 0, description: 'Necrotic energy withers the target' }),
    Object.freeze({ id: 'greater_restoration', name: 'Greater Restoration', school: SpellSchool.RESTORATION, level: 4, mpCost: 8, range: 1, target: SpellTarget.ALLY, damageDice: 0, damageSides: 0, healDice: 4, healSides: 8, description: 'Powerful restorative magic' }),
    Object.freeze({ id: 'dimension_door',   name: 'Dimension Door',   school: SpellSchool.CONJURATION,   level: 4, mpCost: 8, range: 5, target: SpellTarget.SELF,  damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Teleport to a visible location' }),
    Object.freeze({ id: 'dominate_person',  name: 'Dominate Person',  school: SpellSchool.ENCHANTMENT,   level: 4, mpCost: 8, range: 3, target: SpellTarget.ENEMY, damageDice: 0, damageSides: 0, healDice: 0, healSides: 0, description: 'Charm an enemy (skip 3 turns)' }),
  ]);

  const _byId = new Map();
  for (const s of SPELL_LIST)
    _byId.set(s.id, s);

  // Extract numeric spell level (handles both legacy number and registry object formats)
  function _spellLevel(spell, classId) {
    if (typeof spell.level === 'number') return spell.level;
    if (spell.level && typeof spell.level === 'object') {
      if (classId && spell.level[classId] !== undefined) return spell.level[classId];
      const vals = Object.values(spell.level);
      return vals.length > 0 ? Math.min(...vals) : -1;
    }
    return -1;
  }

  // Resolve spell: legacy takes precedence (preserves format), registry for new spells
  function _resolveSpell(id) {
    const legacy = _byId.get(id);
    if (legacy) return legacy;
    if (TR.SpellRegistry && TR.SpellRegistry.has(id))
      return TR.SpellRegistry.get(id);
    return null;
  }

  // Get all spells: legacy first, then registry additions not already in legacy
  function _allSpells() {
    if (!TR.SpellRegistry)
      return SPELL_LIST;
    const result = [...SPELL_LIST];
    for (const s of TR.SpellRegistry.getAll())
      if (!_byId.has(s.id))
        result.push(s);
    return result;
  }

  const Spells = Object.freeze({
    SpellTarget,
    SpellSchool,
    CLASS_SCHOOLS,
    SPELLS_KNOWN_TABLE,
    SPELL_LIST,

    byId(id) {
      return _resolveSpell(id);
    },

    allIds() {
      return _allSpells().map(s => s.id);
    },

    bySchool(school) {
      if (TR.SpellRegistry)
        return TR.SpellRegistry.bySchool(school);
      return SPELL_LIST.filter(s => s.school === school);
    },

    byLevel(level) {
      return _allSpells().filter(s => _spellLevel(s) === level);
    },

    cantrips() {
      return _allSpells().filter(s => _spellLevel(s) === 0);
    },

    schoolsForClass(classId) {
      // Prefer class data from registry, fallback to hardcoded CLASS_SCHOOLS
      if (TR.ClassRegistry) {
        const regSchools = TR.ClassRegistry.getSpellSchools(classId);
        if (regSchools.length > 0) return regSchools;
      }
      return CLASS_SCHOOLS[classId] || [];
    },

    spellsForClass(classId) {
      // Get schools from class data (registry or legacy)
      const schools = Spells.schoolsForClass(classId);
      const legacy = schools.length > 0 ? SPELL_LIST.filter(s => schools.includes(s.school)) : [];
      if (!TR.SpellRegistry) return legacy;
      // Merge with registry class-based spells, deduplicating
      const seen = new Set(legacy.map(s => s.id));
      const result = [...legacy];
      for (const s of TR.SpellRegistry.forClass(classId))
        if (!seen.has(s.id))
          result.push(s);
      return result;
    },

    // D&D 3.5e spell slot computation: DC = 10 + spell level + ability mod
    spellDC(spellLevel, abilityMod) {
      return 10 + spellLevel + abilityMod;
    },

    // Check if caster can cast a specific spell from their slots
    canCastFromSlots(spellSlots, spellLevel) {
      if (!spellSlots || spellLevel < 0 || spellLevel > 9)
        return false;
      const remaining = spellSlots[spellLevel];
      return remaining !== undefined && remaining > 0;
    },

    // Expend a spell slot
    expendSlot(spellSlots, spellLevel) {
      if (!spellSlots || !Spells.canCastFromSlots(spellSlots, spellLevel))
        return false;
      --spellSlots[spellLevel];
      return true;
    },

    // Legacy MP check (backward compat)
    canCastMP(caster, spell) {
      if (spell.mpCost === 0) return true;
      return (caster.mp || 0) >= (spell.mpCost || 0);
    },

    // Unified: can this caster cast this spell?
    canCast(caster, spell) {
      // If caster has D&D 3.5e spell slots, use those
      if (caster.spellSlots)
        return Spells.canCastFromSlots(caster.spellSlots, spell.level);
      // Otherwise fallback to legacy MP system
      return Spells.canCastMP(caster, spell);
    },

    // Unified: spend the cost for casting
    spendCastCost(caster, spell) {
      if (caster.spellSlots)
        return Spells.expendSlot(caster.spellSlots, spell.level);
      if (spell.mpCost > 0)
        caster.mp = Math.max(0, (caster.mp || 0) - spell.mpCost);
      return true;
    },

    // Get spells known at a given character level.
    // For levels beyond the table, extrapolate: +1 to each non-zero slot per 3 epic levels.
    spellsKnownAtLevel(charLevel) {
      let entry = SPELLS_KNOWN_TABLE[0];
      for (const row of SPELLS_KNOWN_TABLE) {
        if (charLevel >= row.level)
          entry = row;
        else
          break;
      }
      const result = { cantrips: entry.cantrips, l1: entry.l1, l2: entry.l2, l3: entry.l3, l4: entry.l4 };
      // Epic extrapolation beyond table max
      const tableMax = SPELLS_KNOWN_TABLE[SPELLS_KNOWN_TABLE.length - 1].level;
      if (charLevel > tableMax) {
        const epicBonus = Math.floor((charLevel - tableMax) / 3);
        if (result.cantrips > 0) result.cantrips += epicBonus;
        if (result.l1 > 0) result.l1 += epicBonus;
        if (result.l2 > 0) result.l2 += epicBonus;
        if (result.l3 > 0) result.l3 += epicBonus;
        if (result.l4 > 0) result.l4 += epicBonus;
      }
      return result;
    },

    assignSpells(classId, charLevel, prng) {
      const schools = CLASS_SCHOOLS[classId];
      if (!schools)
        return [];
      const slots = Spells.spellsKnownAtLevel(charLevel);
      const available = Spells.spellsForClass(classId).filter(s => _spellLevel(s, classId) <= 4 && _spellLevel(s, classId) >= 0);

      const byLvl = [[], [], [], [], []];
      for (const s of available) {
        const lvl = _spellLevel(s, classId);
        if (lvl >= 0 && lvl <= 4)
          byLvl[lvl].push(s);
      }

      const chosen = [];
      const pick = (pool, count) => {
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; --i) {
          const j = prng.nextInt(0, i);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (let i = 0; i < count && i < shuffled.length; ++i)
          chosen.push(shuffled[i].id);
      };

      pick(byLvl[0], slots.cantrips);
      pick(byLvl[1], slots.l1);
      pick(byLvl[2], slots.l2);
      pick(byLvl[3], slots.l3);
      pick(byLvl[4], slots.l4);

      return chosen;
    },

    isInRange(casterCol, casterRow, targetCol, targetRow, range) {
      const dc = Math.abs(casterCol - targetCol);
      const dr = Math.abs(casterRow - targetRow);
      return (dc + dr) <= range;
    },

    getSpellTargetsInRange(grid, casterPos, spell, casterFaction, units) {
      if (spell.range === 0 && spell.target === SpellTarget.SELF)
        return [casterPos];

      const targets = [];
      for (const u of units) {
        if (!u.isAlive)
          continue;
        if (spell.target === SpellTarget.ENEMY && u.faction === casterFaction)
          continue;
        if (spell.target === SpellTarget.ALLY && u.faction !== casterFaction)
          continue;
        if (Spells.isInRange(casterPos.col, casterPos.row, u.position.col, u.position.row, spell.range))
          targets.push(u.id);
      }
      return targets;
    },
  });

  TR.Spells = Spells;
})();
