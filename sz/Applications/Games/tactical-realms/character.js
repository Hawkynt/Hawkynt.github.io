;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // --- Legacy data (fallback when registries not loaded) ---

  const RACES = Object.freeze([
    Object.freeze({ id: 'human', name: 'Human', mods: Object.freeze({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }), size: 'M', speed: 30, season: null, vision: 'normal', traits: Object.freeze(['versatile', 'bonus_feat']) }),
    Object.freeze({ id: 'elf', name: 'Elf', mods: Object.freeze({ str: 0, dex: 2, con: -2, int: 0, wis: 0, cha: 0 }), size: 'M', speed: 30, season: null, vision: 'low-light', traits: Object.freeze(['keen_senses', 'elven_magic']) }),
    Object.freeze({ id: 'dwarf', name: 'Dwarf', mods: Object.freeze({ str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -2 }), size: 'M', speed: 20, season: null, vision: 'darkvision', traits: Object.freeze(['hardy', 'stonecunning']) }),
    Object.freeze({ id: 'halfling', name: 'Halfling', mods: Object.freeze({ str: -2, dex: 2, con: 0, int: 0, wis: 0, cha: 0 }), size: 'S', speed: 20, season: null, vision: 'normal', traits: Object.freeze(['lucky', 'nimble']) }),
    Object.freeze({ id: 'half-orc', name: 'Half-Orc', mods: Object.freeze({ str: 2, dex: 0, con: 0, int: -2, wis: 0, cha: -2 }), size: 'M', speed: 30, season: null, vision: 'darkvision', traits: Object.freeze(['ferocity', 'intimidating']) }),
    Object.freeze({ id: 'gnome', name: 'Gnome', mods: Object.freeze({ str: -2, dex: 0, con: 2, int: 0, wis: 0, cha: 0 }), size: 'S', speed: 20, season: null, vision: 'low-light', traits: Object.freeze(['gnome_magic', 'obsessive']) }),
    Object.freeze({ id: 'tiefling', name: 'Tiefling', mods: Object.freeze({ str: 0, dex: 0, con: 0, int: 2, wis: 0, cha: -2 }), size: 'M', speed: 30, season: 'autumn', vision: 'darkvision', traits: Object.freeze(['fiendish_resistance', 'hellfire']) }),
    Object.freeze({ id: 'dragonborn', name: 'Dragonborn', mods: Object.freeze({ str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: -2 }), size: 'M', speed: 30, season: 'summer', vision: 'normal', traits: Object.freeze(['breath_weapon', 'draconic_resistance']) }),
  ]);

  const CLASSES = Object.freeze([
    Object.freeze({ id: 'fighter', name: 'Fighter', hitDie: 10, bab: 'full', goodSaves: Object.freeze(['fort']), primaryAbility: 'str', caster: false, baseMP: 0, season: null }),
    Object.freeze({ id: 'wizard', name: 'Wizard', hitDie: 4, bab: 'poor', goodSaves: Object.freeze(['will']), primaryAbility: 'int', caster: true, baseMP: 10, season: null }),
    Object.freeze({ id: 'cleric', name: 'Cleric', hitDie: 8, bab: 'medium', goodSaves: Object.freeze(['fort', 'will']), primaryAbility: 'wis', caster: true, baseMP: 8, season: null }),
    Object.freeze({ id: 'rogue', name: 'Rogue', hitDie: 6, bab: 'medium', goodSaves: Object.freeze(['ref']), primaryAbility: 'dex', caster: false, baseMP: 0, season: null }),
    Object.freeze({ id: 'ranger', name: 'Ranger', hitDie: 8, bab: 'full', goodSaves: Object.freeze(['fort', 'ref']), primaryAbility: 'dex', caster: true, baseMP: 4, season: null }),
    Object.freeze({ id: 'paladin', name: 'Paladin', hitDie: 10, bab: 'full', goodSaves: Object.freeze(['fort', 'will']), primaryAbility: 'cha', caster: true, baseMP: 4, season: null }),
    Object.freeze({ id: 'barbarian', name: 'Barbarian', hitDie: 12, bab: 'full', goodSaves: Object.freeze(['fort']), primaryAbility: 'str', caster: false, baseMP: 0, season: null }),
    Object.freeze({ id: 'bard', name: 'Bard', hitDie: 6, bab: 'medium', goodSaves: Object.freeze(['ref', 'will']), primaryAbility: 'cha', caster: true, baseMP: 6, season: 'spring' }),
    Object.freeze({ id: 'warlock', name: 'Warlock', hitDie: 6, bab: 'medium', goodSaves: Object.freeze(['will']), primaryAbility: 'cha', caster: true, baseMP: 8, season: 'autumn' }),
    Object.freeze({ id: 'sorcerer', name: 'Sorcerer', hitDie: 4, bab: 'poor', goodSaves: Object.freeze(['will']), primaryAbility: 'cha', caster: true, baseMP: 12, season: 'winter' }),
  ]);

  // --- Registry-aware lookups (use registry if available, fallback to legacy) ---

  function _findRace(raceId) {
    // Try registry first
    if (TR.CreatureRegistry) {
      const reg = TR.CreatureRegistry.getRace(raceId);
      if (reg) return reg;
    }
    return RACES.find(r => r.id === raceId) || null;
  }

  function _findClass(classId) {
    if (TR.ClassRegistry) {
      const reg = TR.ClassRegistry.get(classId);
      if (reg) return reg;
    }
    return CLASSES.find(c => c.id === classId) || null;
  }

  // Normalize race data to the legacy format character.js expects internally
  function _normalizeRace(raceDef) {
    if (!raceDef) return null;
    // Registry race format has abilityMods and different field names
    if (raceDef.abilityMods && !raceDef.mods) {
      const sizeMap = { Fine: 'F', Diminutive: 'D', Tiny: 'T', Small: 'S', Medium: 'M', Large: 'L', Huge: 'H', Gargantuan: 'G', Colossal: 'C' };
      return {
        id: raceDef.id,
        name: raceDef.name,
        mods: raceDef.abilityMods,
        size: sizeMap[raceDef.size] || raceDef.size,
        speed: raceDef.speed?.land || raceDef.speed || 30,
        season: raceDef.season || null,
        vision: raceDef.traits?.includes('darkvision60') ? 'darkvision' :
                raceDef.traits?.includes('darkvision120') ? 'darkvision' :
                raceDef.traits?.includes('lowLightVision') ? 'low-light' : 'normal',
        traits: raceDef.traits || [],
      };
    }
    return raceDef;
  }

  // Normalize class data
  function _normalizeClass(classDef) {
    if (!classDef) return null;
    // Registry class format has babProgression instead of bab
    if (classDef.babProgression && !classDef.bab) {
      const babMap = { 'full': 'full', '3/4': 'medium', '1/2': 'poor' };
      return {
        id: classDef.id,
        name: classDef.name,
        hitDie: classDef.hitDie,
        bab: babMap[classDef.babProgression] || 'medium',
        goodSaves: classDef.goodSaves || [],
        primaryAbility: classDef.spellcasting?.abilityScore || _guessPrimary(classDef),
        caster: !!classDef.spellcasting,
        baseMP: classDef.spellcasting ? 8 : 0,
        season: classDef.season || null,
      };
    }
    return classDef;
  }

  function _guessPrimary(classDef) {
    if (classDef.hitDie >= 10) return 'str';
    if (classDef.goodSaves?.includes('ref')) return 'dex';
    return 'int';
  }

  // --- Required fields for deserialization ---

  const REQUIRED_FIELDS = ['name', 'race', 'class', 'level', 'stats', 'hp', 'maxHp', 'mp', 'maxMp', 'ac', 'bab', 'saves', 'initiative', 'speed', 'size', 'vision'];

  // --- Equipment helpers (self-contained, no items.js dependency) ---

  const _SLOTS = ['mainHand', 'offHand', 'body', 'accessory'];
  const _STAT_KEYS = ['attack', 'damage', 'ac', 'maxHp', 'maxMp', 'fortSave', 'refSave', 'willSave'];

  function _emptyEquip() {
    return { mainHand: null, offHand: null, body: null, accessory: null };
  }

  function _equipBonuses(equipment) {
    const b = {};
    for (const k of _STAT_KEYS) b[k] = 0;
    if (!equipment) return b;
    for (const slot of _SLOTS) {
      const item = equipment[slot];
      if (!item || !item.stats) continue;
      for (const k of _STAT_KEYS)
        b[k] += item.stats[k] || 0;
    }
    return b;
  }

  function _serializeItem(item) {
    if (!item) return null;
    const d = {};
    for (const k of Object.keys(item)) {
      const v = item[k];
      if (Array.isArray(v)) d[k] = [...v];
      else if (v && typeof v === 'object') d[k] = { ...v };
      else d[k] = v;
    }
    return d;
  }

  function _deserializeItem(data) {
    if (!data || typeof data !== 'object') return null;
    const item = {};
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (Array.isArray(v)) item[k] = Object.freeze([...v]);
      else if (v && typeof v === 'object') item[k] = Object.freeze({ ...v });
      else item[k] = v;
    }
    return Object.freeze(item);
  }

  function _rebuildCharacter(character, equipment, inventory) {
    const classDef = _normalizeClass(_findClass(character.class));
    const raceDef = _normalizeRace(_findRace(character.race));
    if (!classDef || !raceDef) return null;

    const conMod = Character.abilityMod(character.stats.con);
    const dexMod = Character.abilityMod(character.stats.dex);
    const primaryMod = Character.abilityMod(character.stats[classDef.primaryAbility]);
    const sb = Character.sizeBonus(raceDef.size);
    const eb = _equipBonuses(equipment);

    const maxHp = Character.calcHP(classDef.hitDie, conMod, character.level) + eb.maxHp;
    const maxMp = Character.calcMP(classDef, primaryMod, character.level) + eb.maxMp;

    const result = {
      name: character.name,
      race: character.race,
      class: character.class,
      level: character.level,
      stats: character.stats,
      hp: Math.min(character.hp, maxHp),
      maxHp,
      mp: Math.min(character.mp, maxMp),
      maxMp,
      ac: Character.calcAC(dexMod, sb, eb.ac, 0, 0),
      bab: Character.calcBAB(classDef.bab, character.level),
      saves: Object.freeze({
        fort: Character.calcSave(classDef.goodSaves.includes('fort') ? 'good' : 'poor', character.level) + eb.fortSave,
        ref: Character.calcSave(classDef.goodSaves.includes('ref') ? 'good' : 'poor', character.level) + eb.refSave,
        will: Character.calcSave(classDef.goodSaves.includes('will') ? 'good' : 'poor', character.level) + eb.willSave,
      }),
      initiative: Character.calcInitiative(dexMod),
      speed: character.speed,
      size: character.size,
      vision: character.vision,
      equipment: Object.freeze(equipment),
      inventory: Object.freeze(inventory),
    };

    // Preserve new D&D 3.5e fields if present
    if (character.classes) result.classes = character.classes;
    if (character.spellSlots) result.spellSlots = character.spellSlots;
    if (character.preparedSpells) result.preparedSpells = character.preparedSpells;
    if (character.knownSpells) result.knownSpells = character.knownSpells;
    if (character.skillRanks) result.skillRanks = character.skillRanks;
    if (character.feats) result.feats = character.feats;
    if (character.xp != null) result.xp = character.xp;
    if (character.passMode != null) result.passMode = character.passMode;
    if (character.naturalArmor != null) result.naturalArmor = character.naturalArmor;

    return Object.freeze(result);
  }

  // --- D&D 3.5e spell slot system ---

  function _calcSpellSlots(classDef, classLevel, abilityMod) {
    if (!classDef || !classDef.spellsPerDay) return null;
    const idx = Math.min(classLevel, classDef.spellsPerDay.length) - 1;
    if (idx < 0) return null;
    const base = classDef.spellsPerDay[idx];
    if (!base) return null;
    // Bonus spells from ability mod: 1 bonus spell per level where abilityMod >= spellLevel
    const slots = {};
    for (let lvl = 0; lvl < base.length; ++lvl) {
      const bonusSlots = (lvl > 0 && abilityMod >= lvl) ? Math.floor((abilityMod - lvl) / 4) + 1 : 0;
      slots[lvl] = { total: base[lvl] + bonusSlots, used: 0 };
    }
    return slots;
  }

  // --- Multiclass BAB/saves computation ---

  function _multiclassBAB(classes) {
    let totalBAB = 0;
    for (const entry of classes) {
      const def = _normalizeClass(_findClass(entry.classId));
      if (def)
        totalBAB += Character.calcBAB(def.bab, entry.level);
    }
    return totalBAB;
  }

  function _multiclassSaves(classes) {
    const saves = { fort: 0, ref: 0, will: 0 };
    for (const entry of classes) {
      const def = _normalizeClass(_findClass(entry.classId));
      if (!def) continue;
      saves.fort += Character.calcSave(def.goodSaves.includes('fort') ? 'good' : 'poor', entry.level);
      saves.ref += Character.calcSave(def.goodSaves.includes('ref') ? 'good' : 'poor', entry.level);
      saves.will += Character.calcSave(def.goodSaves.includes('will') ? 'good' : 'poor', entry.level);
    }
    return saves;
  }

  function _multiclassHP(classes, conMod) {
    let hp = 0;
    let firstLevel = true;
    for (const entry of classes) {
      const def = _normalizeClass(_findClass(entry.classId));
      if (!def) continue;
      for (let lvl = 0; lvl < entry.level; ++lvl) {
        if (firstLevel) {
          hp += def.hitDie + conMod;
          firstLevel = false;
        } else
          hp += Math.max(1, Math.ceil(def.hitDie / 2) + conMod);
      }
    }
    return hp;
  }

  // --- D&D 3.5e XP table ---

  const XP_TABLE_35 = Object.freeze([
    0, 0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000,
    55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000,
  ]);

  // --- Character object ---

  const Character = {

    abilityMod(score) {
      return Math.floor((score - 10) / 2);
    },

    calcBAB(type, level) {
      if (type === 'full')
        return level;
      if (type === 'medium')
        return Math.floor(level * 3 / 4);
      return Math.floor(level / 2);
    },

    calcSave(type, level) {
      if (type === 'good')
        return 2 + Math.floor(level / 2);
      return Math.floor(level / 3);
    },

    sizeBonus(size) {
      return size === 'S' ? 1 : 0;
    },

    calcHP(hitDie, conMod, level) {
      let hp = Math.max(1, hitDie + conMod);
      for (let i = 1; i < level; ++i)
        hp += Math.max(1, Math.ceil(hitDie / 2) + conMod);
      return Math.max(1, hp);
    },

    calcMP(classDef, casterAbilityMod, level) {
      if (!classDef.caster)
        return 0;
      return classDef.baseMP + casterAbilityMod * level;
    },

    calcAC(dexMod, sizeBonus, armorBonus, shieldBonus, naturalArmor) {
      return 10 + dexMod + sizeBonus + armorBonus + shieldBonus + naturalArmor;
    },

    calcInitiative(dexMod) {
      return dexMod;
    },

    xpForNextLevel(level) {
      // Use D&D 3.5e table if ActionEconomy is loaded, otherwise legacy
      if (TR.ActionEconomy) {
        const current = TR.ActionEconomy.xpForLevel(level);
        const next = TR.ActionEconomy.xpForLevel(level + 1);
        return next - current;
      }
      return level * 100;
    },

    totalXpForLevel(targetLevel) {
      if (TR.ActionEconomy)
        return TR.ActionEconomy.xpForLevel(targetLevel);
      let total = 0;
      for (let l = 1; l < targetLevel; ++l)
        total += l * 100;
      return total;
    },

    levelFromXp(xp) {
      if (TR.ActionEconomy)
        return TR.ActionEconomy.levelFromXp(xp);
      let level = 1;
      let needed = 0;
      while (needed + level * 100 <= xp) {
        needed += level * 100;
        ++level;
      }
      return level;
    },

    levelUp(character) {
      if (!character)
        return null;
      const classDef = _normalizeClass(_findClass(character.class));
      const raceDef = _normalizeRace(_findRace(character.race));
      if (!classDef || !raceDef)
        return null;

      const newLevel = character.level + 1;
      const conMod = Character.abilityMod(character.stats.con);
      const dexMod = Character.abilityMod(character.stats.dex);
      const primaryMod = Character.abilityMod(character.stats[classDef.primaryAbility]);
      const sb = Character.sizeBonus(raceDef.size);
      const equipment = character.equipment || _emptyEquip();
      const eb = _equipBonuses(equipment);

      const hp = Character.calcHP(classDef.hitDie, conMod, newLevel) + eb.maxHp;
      const mp = Character.calcMP(classDef, primaryMod, newLevel) + eb.maxMp;
      const ac = Character.calcAC(dexMod, sb, eb.ac, 0, 0);
      const bab = Character.calcBAB(classDef.bab, newLevel);
      const initiative = Character.calcInitiative(dexMod);

      const saves = Object.freeze({
        fort: Character.calcSave(classDef.goodSaves.includes('fort') ? 'good' : 'poor', newLevel) + eb.fortSave,
        ref: Character.calcSave(classDef.goodSaves.includes('ref') ? 'good' : 'poor', newLevel) + eb.refSave,
        will: Character.calcSave(classDef.goodSaves.includes('will') ? 'good' : 'poor', newLevel) + eb.willSave,
      });

      const result = {
        name: character.name,
        race: character.race,
        class: character.class,
        level: newLevel,
        stats: Object.freeze({ ...character.stats }),
        hp,
        maxHp: hp,
        mp,
        maxMp: mp,
        ac,
        bab,
        saves,
        initiative,
        speed: character.speed,
        size: character.size,
        vision: character.vision,
        equipment: character.equipment ? character.equipment : Object.freeze(_emptyEquip()),
        inventory: character.inventory || Object.freeze([]),
      };

      // Preserve new D&D 3.5e fields
      if (character.classes) result.classes = character.classes;
      if (character.spellSlots) result.spellSlots = character.spellSlots;
      if (character.preparedSpells) result.preparedSpells = character.preparedSpells;
      if (character.knownSpells) result.knownSpells = character.knownSpells;
      if (character.skillRanks) result.skillRanks = character.skillRanks;
      if (character.feats) result.feats = character.feats;
      if (character.xp != null) result.xp = character.xp;
      if (character.passMode != null) result.passMode = character.passMode;

      return Object.freeze(result);
    },

    createCharacter(raceId, classId, name, level, _prng) {
      const raceDef = _normalizeRace(_findRace(raceId));
      const classDef = _normalizeClass(_findClass(classId));
      if (!raceDef || !classDef)
        return null;

      const stats = {
        str: 10 + (raceDef.mods?.str || 0),
        dex: 10 + (raceDef.mods?.dex || 0),
        con: 10 + (raceDef.mods?.con || 0),
        int: 10 + (raceDef.mods?.int || 0),
        wis: 10 + (raceDef.mods?.wis || 0),
        cha: 10 + (raceDef.mods?.cha || 0),
      };

      const conMod = Character.abilityMod(stats.con);
      const dexMod = Character.abilityMod(stats.dex);
      const primaryMod = Character.abilityMod(stats[classDef.primaryAbility]);
      const sb = Character.sizeBonus(raceDef.size);

      const hp = Character.calcHP(classDef.hitDie, conMod, level);
      const mp = Character.calcMP(classDef, primaryMod, level);
      const ac = Character.calcAC(dexMod, sb, 0, 0, 0);
      const bab = Character.calcBAB(classDef.bab, level);
      const initiative = Character.calcInitiative(dexMod);

      const saves = Object.freeze({
        fort: Character.calcSave(classDef.goodSaves.includes('fort') ? 'good' : 'poor', level),
        ref: Character.calcSave(classDef.goodSaves.includes('ref') ? 'good' : 'poor', level),
        will: Character.calcSave(classDef.goodSaves.includes('will') ? 'good' : 'poor', level),
      });

      const result = {
        name,
        race: raceId,
        class: classId,
        level,
        stats: Object.freeze(stats),
        hp,
        maxHp: hp,
        mp,
        maxMp: mp,
        ac,
        bab,
        saves,
        initiative,
        speed: raceDef.speed,
        size: raceDef.size,
        vision: raceDef.vision,
        equipment: Object.freeze(_emptyEquip()),
        inventory: Object.freeze([]),
      };

      // Add multiclass tracking
      result.classes = Object.freeze([{ classId, level }]);

      // Add D&D 3.5e fields
      result.xp = Character.totalXpForLevel(level);
      result.skillRanks = Object.freeze({});
      result.feats = Object.freeze([]);
      result.passMode = TR.PassMode ? TR.PassMode.WALK : 0b00001;

      // Spell slots if caster
      if (classDef.caster && TR.ClassRegistry) {
        const regClass = TR.ClassRegistry.get(classId);
        if (regClass?.spellsPerDay) {
          const abilityScore = stats[classDef.primaryAbility] || 10;
          const abilityMod = Character.abilityMod(abilityScore);
          result.spellSlots = Object.freeze(_calcSpellSlots(regClass, level, abilityMod) || {});
        }
      }

      return Object.freeze(result);
    },

    // Create a multiclass character with multiple class levels
    createMulticlassCharacter(raceId, classEntries, name, _prng) {
      const raceDef = _normalizeRace(_findRace(raceId));
      if (!raceDef || !classEntries || classEntries.length === 0)
        return null;

      const totalLevel = classEntries.reduce((sum, e) => sum + e.level, 0);
      const primaryClass = _normalizeClass(_findClass(classEntries[0].classId));
      if (!primaryClass) return null;

      const stats = {
        str: 10 + (raceDef.mods?.str || 0),
        dex: 10 + (raceDef.mods?.dex || 0),
        con: 10 + (raceDef.mods?.con || 0),
        int: 10 + (raceDef.mods?.int || 0),
        wis: 10 + (raceDef.mods?.wis || 0),
        cha: 10 + (raceDef.mods?.cha || 0),
      };

      const conMod = Character.abilityMod(stats.con);
      const dexMod = Character.abilityMod(stats.dex);
      const sb = Character.sizeBonus(raceDef.size);

      const hp = _multiclassHP(classEntries, conMod);
      const bab = _multiclassBAB(classEntries);
      const baseSaves = _multiclassSaves(classEntries);

      return Object.freeze({
        name,
        race: raceId,
        class: classEntries[0].classId,
        level: totalLevel,
        classes: Object.freeze(classEntries.map(e => Object.freeze({ ...e }))),
        stats: Object.freeze(stats),
        hp,
        maxHp: hp,
        mp: 0,
        maxMp: 0,
        ac: Character.calcAC(dexMod, sb, 0, 0, 0),
        bab,
        saves: Object.freeze(baseSaves),
        initiative: Character.calcInitiative(dexMod),
        speed: raceDef.speed,
        size: raceDef.size,
        vision: raceDef.vision,
        equipment: Object.freeze(_emptyEquip()),
        inventory: Object.freeze([]),
        xp: Character.totalXpForLevel(totalLevel),
        skillRanks: Object.freeze({}),
        feats: Object.freeze([]),
        passMode: TR.PassMode ? TR.PassMode.WALK : 0b00001,
      });
    },

    applyDailyVariance(character, prng, bonusStat) {
      const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      const newStats = {};
      for (const a of abilities) {
        let delta = prng.nextInt(-1, 1);
        if (a === bonusStat)
          delta += 2;
        newStats[a] = Math.max(1, character.stats[a] + delta);
      }

      const classDef = _normalizeClass(_findClass(character.class));
      const raceDef = _normalizeRace(_findRace(character.race));
      const conMod = Character.abilityMod(newStats.con);
      const dexMod = Character.abilityMod(newStats.dex);
      const primaryMod = Character.abilityMod(newStats[classDef.primaryAbility]);
      const sb = Character.sizeBonus(raceDef.size);
      const equipment = character.equipment || _emptyEquip();
      const eb = _equipBonuses(equipment);

      const hp = Character.calcHP(classDef.hitDie, conMod, character.level) + eb.maxHp;
      const mp = Character.calcMP(classDef, primaryMod, character.level) + eb.maxMp;
      const ac = Character.calcAC(dexMod, sb, eb.ac, 0, 0);
      const bab = Character.calcBAB(classDef.bab, character.level);
      const initiative = Character.calcInitiative(dexMod);

      const saves = Object.freeze({
        fort: Character.calcSave(classDef.goodSaves.includes('fort') ? 'good' : 'poor', character.level) + eb.fortSave,
        ref: Character.calcSave(classDef.goodSaves.includes('ref') ? 'good' : 'poor', character.level) + eb.refSave,
        will: Character.calcSave(classDef.goodSaves.includes('will') ? 'good' : 'poor', character.level) + eb.willSave,
      });

      const result = {
        name: character.name,
        race: character.race,
        class: character.class,
        level: character.level,
        stats: Object.freeze(newStats),
        hp,
        maxHp: hp,
        mp,
        maxMp: mp,
        ac,
        bab,
        saves,
        initiative,
        speed: character.speed,
        size: character.size,
        vision: character.vision,
        equipment: character.equipment ? character.equipment : Object.freeze(_emptyEquip()),
        inventory: character.inventory || Object.freeze([]),
      };

      // Preserve new D&D 3.5e fields
      if (character.classes) result.classes = character.classes;
      if (character.skillRanks) result.skillRanks = character.skillRanks;
      if (character.feats) result.feats = character.feats;
      if (character.xp != null) result.xp = character.xp;

      return Object.freeze(result);
    },

    equip(character, slot, item) {
      if (!character || !item || !item.slot || item.slot !== slot)
        return null;
      const oldEquipment = character.equipment || _emptyEquip();
      const newEquipment = {};
      for (const s of _SLOTS)
        newEquipment[s] = s === slot ? item : oldEquipment[s];

      const inventory = character.inventory ? [...character.inventory] : [];
      const oldItem = oldEquipment[slot];
      if (oldItem)
        inventory.push(oldItem);
      const newInventory = inventory.filter(i => i.id !== item.id);

      return _rebuildCharacter(character, newEquipment, newInventory);
    },

    unequip(character, slot) {
      if (!character)
        return null;
      const oldEquipment = character.equipment || _emptyEquip();
      const item = oldEquipment[slot];
      if (!item)
        return character;

      const newEquipment = {};
      for (const s of _SLOTS)
        newEquipment[s] = s === slot ? null : oldEquipment[s];

      const inventory = character.inventory ? [...character.inventory] : [];
      inventory.push(item);

      return _rebuildCharacter(character, newEquipment, inventory);
    },

    serialize(character) {
      const data = {
        name: character.name,
        race: character.race,
        class: character.class,
        level: character.level,
        stats: { ...character.stats },
        hp: character.hp,
        maxHp: character.maxHp,
        mp: character.mp,
        maxMp: character.maxMp,
        ac: character.ac,
        bab: character.bab,
        saves: { ...character.saves },
        initiative: character.initiative,
        speed: character.speed,
        size: character.size,
        vision: character.vision,
      };
      if (character.equipment) {
        const eq = {};
        for (const s of _SLOTS)
          eq[s] = character.equipment[s] ? _serializeItem(character.equipment[s]) : null;
        data.equipment = eq;
      }
      if (character.inventory && character.inventory.length > 0)
        data.inventory = character.inventory.map(_serializeItem).filter(Boolean);

      // Serialize new D&D 3.5e fields
      if (character.classes) data.classes = character.classes;
      if (character.spellSlots) data.spellSlots = character.spellSlots;
      if (character.preparedSpells) data.preparedSpells = character.preparedSpells;
      if (character.knownSpells) data.knownSpells = character.knownSpells;
      if (character.skillRanks) data.skillRanks = character.skillRanks;
      if (character.feats) data.feats = character.feats;
      if (character.xp != null) data.xp = character.xp;
      if (character.passMode != null) data.passMode = character.passMode;

      return data;
    },

    deserialize(data) {
      if (!data || typeof data !== 'object')
        return null;
      for (const f of REQUIRED_FIELDS)
        if (!(f in data))
          return null;

      const equipment = _emptyEquip();
      if (data.equipment)
        for (const s of _SLOTS)
          equipment[s] = data.equipment[s] ? _deserializeItem(data.equipment[s]) : null;

      const inventory = Array.isArray(data.inventory)
        ? data.inventory.map(_deserializeItem).filter(Boolean)
        : [];

      const result = {
        name: data.name,
        race: data.race,
        class: data.class,
        level: data.level,
        stats: Object.freeze({ str: data.stats.str, dex: data.stats.dex, con: data.stats.con, int: data.stats.int, wis: data.stats.wis, cha: data.stats.cha }),
        hp: data.hp,
        maxHp: data.maxHp,
        mp: data.mp,
        maxMp: data.maxMp,
        ac: data.ac,
        bab: data.bab,
        saves: Object.freeze({ fort: data.saves.fort, ref: data.saves.ref, will: data.saves.will }),
        initiative: data.initiative,
        speed: data.speed,
        size: data.size,
        vision: data.vision,
        equipment: Object.freeze(equipment),
        inventory: Object.freeze(inventory),
      };

      // Deserialize new D&D 3.5e fields
      if (data.classes) result.classes = Object.freeze(data.classes);
      if (data.spellSlots) result.spellSlots = data.spellSlots;
      if (data.preparedSpells) result.preparedSpells = data.preparedSpells;
      if (data.knownSpells) result.knownSpells = data.knownSpells;
      if (data.skillRanks) result.skillRanks = Object.freeze(data.skillRanks || {});
      if (data.feats) result.feats = Object.freeze(data.feats || []);
      if (data.xp != null) result.xp = data.xp;
      if (data.passMode != null) result.passMode = data.passMode;

      return Object.freeze(result);
    },

    // --- New D&D 3.5e methods ---

    // Get all available races (from registry or legacy)
    getAvailableRaces() {
      if (TR.CreatureRegistry)
        return TR.CreatureRegistry.getRaces();
      return [...RACES];
    },

    // Get all available classes (from registry or legacy)
    getAvailableClasses() {
      if (TR.ClassRegistry)
        return TR.ClassRegistry.getBaseClasses();
      return [...CLASSES];
    },

    // Check if character meets prestige class prerequisites
    meetsPrestigePrereqs(character, prestigeClassId) {
      if (!TR.ClassRegistry) return false;
      const prestige = TR.ClassRegistry.get(prestigeClassId);
      if (!prestige) return false;
      return TR.ClassRegistry.meetsPrerequisites(prestige, character);
    },

    // Get creature passMode from race speed and active effects
    getPassMode(character) {
      if (character.passMode) return character.passMode;
      const raceDef = _findRace(character.race);
      if (raceDef?.speed && typeof raceDef.speed === 'object') {
        if (TR.Passability)
          return TR.Passability.creaturePassMode(raceDef.speed, null);
      }
      return TR.PassMode ? TR.PassMode.WALK : 0b00001;
    },
  };

  TR.RACES = RACES;
  TR.CLASSES = CLASSES;
  TR.Character = Character;
})();
