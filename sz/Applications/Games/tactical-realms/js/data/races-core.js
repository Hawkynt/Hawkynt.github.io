;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatures || (TR._pending.creatures = []);
  TR._pending.creatures.push(

    // -----------------------------------------------------------------------
    //  Player's Handbook (v3.5) -- 7 core playable races
    // -----------------------------------------------------------------------

    // Human -- PHB p12
    {
      id: 'human', name: 'Human',
      type: 'humanoid', subtypes: ['human'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: ['versatile', 'bonus_feat', 'bonus_skill_points'],
      languages: ['Common'],
      favoredClass: 'any',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    },

    // Elf (High Elf) -- PHB p15
    {
      id: 'elf', name: 'Elf',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: -2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'elven_weapon_proficiency',
        'keen_senses', 'low_light_vision',
        'enchantment_save_bonus'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'wizard',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    },

    // Dwarf (Hill Dwarf) -- PHB p14
    {
      id: 'dwarf', name: 'Dwarf',
      type: 'humanoid', subtypes: ['dwarf'],
      size: 'Medium', speed: { land: 20 },
      abilityMods: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'stonecunning', 'stability',
        'poison_save_bonus', 'spell_save_bonus_vs_spells',
        'giant_dodge', 'orc_attack_bonus', 'goblin_attack_bonus',
        'appraise_stone', 'dwarven_weapon_proficiency',
        'no_speed_penalty_armor'
      ],
      languages: ['Common', 'Dwarven'],
      favoredClass: 'fighter',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    },

    // Halfling (Lightfoot) -- PHB p18
    {
      id: 'halfling', name: 'Halfling',
      type: 'humanoid', subtypes: ['halfling'],
      size: 'Small', speed: { land: 20 },
      abilityMods: { str: -2, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'small_size', 'lucky', 'morale_save_bonus',
        'thrown_weapon_bonus', 'keen_ear',
        'climb_bonus', 'jump_bonus', 'move_silently_bonus'
      ],
      languages: ['Common', 'Halfling'],
      favoredClass: 'rogue',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    },

    // Half-Orc -- PHB p17
    {
      id: 'half-orc', name: 'Half-Orc',
      type: 'humanoid', subtypes: ['orc', 'human'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 2, dex: 0, con: 0, int: -2, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: ['darkvision_60', 'orc_blood'],
      languages: ['Common', 'Orc'],
      favoredClass: 'barbarian',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    },

    // Gnome (Rock Gnome) -- PHB p16
    {
      id: 'gnome', name: 'Gnome',
      type: 'humanoid', subtypes: ['gnome'],
      size: 'Small', speed: { land: 20 },
      abilityMods: { str: -2, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'small_size', 'low_light_vision',
        'illusion_save_bonus', 'illusion_dc_bonus',
        'giant_dodge', 'kobold_attack_bonus', 'goblin_attack_bonus',
        'listen_bonus', 'gnome_magic',
        'speak_with_burrowing_mammals'
      ],
      languages: ['Common', 'Gnome'],
      favoredClass: 'bard',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    },

    // Half-Elf -- PHB p16
    {
      id: 'half-elf', name: 'Half-Elf',
      type: 'humanoid', subtypes: ['elf', 'human'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'elven_blood',
        'low_light_vision', 'enchantment_save_bonus',
        'diplomacy_bonus', 'gather_information_bonus',
        'keen_senses'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'any',
      playable: true, availability: 'core',
      source: 'core/Players-Handbook',
      passMode: 0b00001
    }

  );
})();
