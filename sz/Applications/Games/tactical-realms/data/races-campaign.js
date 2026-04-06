;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatures || (TR._pending.creatures = []);
  TR._pending.creatures.push(

    // -----------------------------------------------------------------------
    //  Campaign setting races -- Forgotten Realms & Eberron variants
    //  (FRCS, Races of Faerun, Player's Guide to Faerun, Eberron CS)
    // -----------------------------------------------------------------------

    // Strongheart Halfling -- FRCS p18 / Races of Faerun
    {
      id: 'strongheart-halfling', name: 'Strongheart Halfling',
      type: 'humanoid', subtypes: ['halfling'],
      size: 'Small', speed: { land: 20 },
      abilityMods: { str: -2, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'small_size', 'bonus_feat',
        'morale_save_bonus', 'thrown_weapon_bonus',
        'keen_ear', 'climb_bonus', 'jump_bonus',
        'move_silently_bonus'
      ],
      languages: ['Common', 'Halfling'],
      favoredClass: 'rogue',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Gold Dwarf -- FRCS p13 / Races of Faerun
    {
      id: 'gold-dwarf', name: 'Gold Dwarf',
      type: 'humanoid', subtypes: ['dwarf'],
      size: 'Medium', speed: { land: 20 },
      abilityMods: { str: 0, dex: -2, con: 2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'stonecunning', 'stability',
        'poison_save_bonus', 'spell_save_bonus_vs_spells',
        'aberration_dodge', 'dwarven_weapon_proficiency',
        'appraise_stone', 'no_speed_penalty_armor'
      ],
      languages: ['Common', 'Dwarven'],
      favoredClass: 'fighter',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Shield Dwarf -- FRCS p13 / Races of Faerun
    {
      id: 'shield-dwarf', name: 'Shield Dwarf',
      type: 'humanoid', subtypes: ['dwarf'],
      size: 'Medium', speed: { land: 20 },
      abilityMods: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'stonecunning', 'stability',
        'poison_save_bonus', 'spell_save_bonus_vs_spells',
        'orc_attack_bonus', 'goblin_attack_bonus',
        'giant_dodge', 'dwarven_weapon_proficiency',
        'appraise_stone', 'no_speed_penalty_armor'
      ],
      languages: ['Common', 'Dwarven'],
      favoredClass: 'fighter',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Moon Elf -- FRCS p14 / Races of Faerun
    {
      id: 'moon-elf', name: 'Moon Elf',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: -2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'low_light_vision',
        'enchantment_save_bonus', 'keen_senses',
        'elven_weapon_proficiency'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'wizard',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Sun Elf -- FRCS p14 / Races of Faerun
    {
      id: 'sun-elf', name: 'Sun Elf',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: -2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'low_light_vision',
        'enchantment_save_bonus', 'keen_senses',
        'elven_weapon_proficiency'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'wizard',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Wild Elf -- FRCS p14 / Races of Faerun
    {
      id: 'wild-elf', name: 'Wild Elf',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: 0, int: -2, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'low_light_vision',
        'enchantment_save_bonus', 'keen_senses',
        'elven_weapon_proficiency'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'sorcerer',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Wood Elf -- Monster Manual p104 / FRCS
    {
      id: 'wood-elf', name: 'Wood Elf',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 2, dex: 2, con: -2, int: -2, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'low_light_vision',
        'enchantment_save_bonus', 'keen_senses',
        'elven_weapon_proficiency'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'ranger',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Rock Gnome (FR variant) -- FRCS p15 / Races of Faerun
    {
      id: 'rock-gnome', name: 'Rock Gnome',
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
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Lightfoot Halfling (FR variant) -- FRCS p17 / Races of Faerun
    {
      id: 'lightfoot-halfling', name: 'Lightfoot Halfling',
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
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Ghostwise Halfling -- FRCS p18 / Races of Faerun
    {
      id: 'ghostwise-halfling', name: 'Ghostwise Halfling',
      type: 'humanoid', subtypes: ['halfling'],
      size: 'Small', speed: { land: 20 },
      abilityMods: { str: -2, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'small_size', 'speak_without_sound',
        'morale_save_bonus', 'thrown_weapon_bonus',
        'keen_ear', 'climb_bonus', 'jump_bonus',
        'move_silently_bonus'
      ],
      languages: ['Common', 'Halfling'],
      favoredClass: 'barbarian',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    },

    // Deep Gnome (campaign alias for Svirfneblin) -- FRCS p16
    {
      id: 'deep-gnome', name: 'Deep Gnome',
      type: 'humanoid', subtypes: ['gnome'],
      size: 'Small', speed: { land: 20 },
      abilityMods: { str: -2, dex: 2, con: 0, int: 0, wis: 2, cha: -4 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: 1, la: 3,
      traits: [
        'darkvision_120', 'small_size',
        'spell_resistance', 'stonecunning',
        'nondetection_constant', 'blindsense_sla',
        'disguise_self_sla', 'blur_sla',
        'dodge_bonus', 'hide_bonus',
        'listen_bonus', 'craft_alchemy_bonus',
        'light_sensitivity'
      ],
      languages: ['Common', 'Gnome', 'Undercommon'],
      favoredClass: 'rogue',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      alias: 'svirfneblin',
      passMode: 0b00001
    },

    // Star Elf -- Unapproachable East p10 / Player's Guide to Faerun
    {
      id: 'star-elf', name: 'Star Elf',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: -2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'immunity_sleep', 'low_light_vision',
        'enchantment_save_bonus', 'keen_senses',
        'elven_weapon_proficiency',
        'extraplanar_origin', 'otherworldly_touch'
      ],
      languages: ['Common', 'Elven'],
      favoredClass: 'wizard',
      playable: true, availability: 'campaign',
      source: 'campaign/Forgotten-Realms',
      passMode: 0b00001
    }

  );
})();
