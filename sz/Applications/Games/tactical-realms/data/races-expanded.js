;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatures || (TR._pending.creatures = []);
  TR._pending.creatures.push(

    // -----------------------------------------------------------------------
    //  Expanded playable races -- various 3.5e supplements
    // -----------------------------------------------------------------------

    // Aasimar -- Monster Manual p209 / Races of Destiny
    {
      id: 'aasimar', name: 'Aasimar',
      type: 'outsider', subtypes: ['native'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 2, cha: 2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_60', 'acid_resistance_5',
        'cold_resistance_5', 'electricity_resistance_5',
        'daylight_sla', 'spot_bonus', 'listen_bonus'
      ],
      languages: ['Common', 'Celestial'],
      favoredClass: 'paladin',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Destiny',
      passMode: 0b00001
    },

    // Tiefling -- Monster Manual p210 / Races of Destiny
    {
      id: 'tiefling', name: 'Tiefling',
      type: 'outsider', subtypes: ['native'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: 0, int: 2, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_60', 'fire_resistance_5',
        'cold_resistance_5', 'electricity_resistance_5',
        'darkness_sla', 'bluff_bonus', 'hide_bonus'
      ],
      languages: ['Common', 'Infernal'],
      favoredClass: 'rogue',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Destiny',
      passMode: 0b00001
    },

    // Fire Genasi -- Forgotten Realms Campaign Setting / Races of Faerun
    {
      id: 'fire-genasi', name: 'Fire Genasi',
      type: 'outsider', subtypes: ['native', 'fire'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 2, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_60', 'fire_resistance_5',
        'control_flame_sla'
      ],
      languages: ['Common'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Faerun',
      passMode: 0b00001
    },

    // Water Genasi -- Forgotten Realms Campaign Setting / Races of Faerun
    {
      id: 'water-genasi', name: 'Water Genasi',
      type: 'outsider', subtypes: ['native', 'water'],
      size: 'Medium', speed: { land: 30, swim: 30 },
      abilityMods: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_60', 'water_breathing',
        'create_water_sla', 'swim_bonus'
      ],
      languages: ['Common'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Faerun',
      passMode: 0b00101 // WALK | SWIM
    },

    // Earth Genasi -- Forgotten Realms Campaign Setting / Races of Faerun
    {
      id: 'earth-genasi', name: 'Earth Genasi',
      type: 'outsider', subtypes: ['native', 'earth'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 2, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_60', 'pass_without_trace_sla'
      ],
      languages: ['Common'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Faerun',
      passMode: 0b00001
    },

    // Air Genasi -- Forgotten Realms Campaign Setting / Races of Faerun
    {
      id: 'air-genasi', name: 'Air Genasi',
      type: 'outsider', subtypes: ['native', 'air'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: 0, int: 2, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_60', 'levitate_sla', 'breathless'
      ],
      languages: ['Common'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Faerun',
      passMode: 0b00001
    },

    // Goliath -- Races of Stone p53
    {
      id: 'goliath', name: 'Goliath',
      type: 'monstrous_humanoid', subtypes: [],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 4, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 1, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'powerful_build', 'mountain_movement',
        'acclimated', 'darkvision_60',
        'sense_motive_bonus'
      ],
      languages: ['Common', 'Gol-Kaa'],
      favoredClass: 'barbarian',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-Stone',
      passMode: 0b00001
    },

    // Raptoran -- Races of the Wild p66
    {
      id: 'raptoran', name: 'Raptoran',
      type: 'humanoid', subtypes: ['raptoran'],
      size: 'Medium', speed: { land: 30, fly: 40 },
      abilityMods: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'gliding', 'flight_at_5th', 'low_light_vision',
        'footbow_proficiency', 'unerring_direction',
        'spot_bonus'
      ],
      languages: ['Common', 'Tuilvilanuue'],
      favoredClass: 'cleric',
      playable: true, availability: 'expanded',
      source: 'expanded/Races-of-the-Wild',
      passMode: 0b00011 // WALK | FLY
    },

    // Shifter -- Eberron Campaign Setting p18
    {
      id: 'shifter', name: 'Shifter',
      type: 'humanoid', subtypes: ['shapechanger'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'shifting', 'low_light_vision',
        'balance_bonus', 'climb_bonus', 'jump_bonus'
      ],
      languages: ['Common'],
      favoredClass: 'ranger',
      playable: true, availability: 'expanded',
      source: 'expanded/Eberron-Campaign-Setting',
      passMode: 0b00001
    },

    // Changeling -- Eberron Campaign Setting p12
    {
      id: 'changeling', name: 'Changeling',
      type: 'humanoid', subtypes: ['shapechanger'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'minor_change_shape', 'social_intuition',
        'sleep_save_bonus', 'charm_save_bonus',
        'intuition_bonus'
      ],
      languages: ['Common'],
      favoredClass: 'rogue',
      playable: true, availability: 'expanded',
      source: 'expanded/Eberron-Campaign-Setting',
      passMode: 0b00001
    },

    // Kalashtar -- Eberron Campaign Setting p16
    {
      id: 'kalashtar', name: 'Kalashtar',
      type: 'humanoid', subtypes: ['psionic'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 2, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'mindlink_sla', 'naturally_psionic',
        'psi_like_abilities', 'dual_spirit',
        'mind_affecting_save_bonus'
      ],
      languages: ['Common', 'Quor'],
      favoredClass: 'psion',
      playable: true, availability: 'expanded',
      source: 'expanded/Eberron-Campaign-Setting',
      passMode: 0b00001
    },

    // Warforged -- Eberron Campaign Setting p20
    {
      id: 'warforged', name: 'Warforged',
      type: 'living_construct', subtypes: [],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 2, int: 0, wis: -2, cha: -2 },
      naturalArmor: 2, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'composite_plating', 'light_fortification',
        'immunity_poison', 'immunity_sleep',
        'immunity_nausea', 'immunity_fatigue',
        'immunity_energy_drain', 'no_natural_healing',
        'half_healing_from_spells'
      ],
      languages: ['Common'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Eberron-Campaign-Setting',
      passMode: 0b00001
    },

    // Drow (Dark Elf) -- Monster Manual p103 / Forgotten Realms
    {
      id: 'drow', name: 'Drow',
      type: 'humanoid', subtypes: ['elf'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: -2, int: 2, wis: 0, cha: 2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: 1, la: 2,
      traits: [
        'darkvision_120', 'immunity_sleep',
        'enchantment_save_bonus', 'spell_resistance',
        'dancing_lights_sla', 'darkness_sla', 'faerie_fire_sla',
        'keen_senses', 'light_blindness',
        'drow_weapon_proficiency'
      ],
      languages: ['Common', 'Elven', 'Undercommon'],
      favoredClass: 'wizard',
      playable: true, availability: 'expanded',
      source: 'expanded/Forgotten-Realms',
      passMode: 0b00001
    },

    // Duergar (Gray Dwarf) -- Monster Manual p91 / Expanded Psionics Handbook
    {
      id: 'duergar', name: 'Duergar',
      type: 'humanoid', subtypes: ['dwarf'],
      size: 'Medium', speed: { land: 20 },
      abilityMods: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: -4 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'darkvision_120', 'immunity_paralysis',
        'immunity_phantasm', 'poison_save_bonus',
        'spell_save_bonus_vs_spells', 'stability',
        'enlarge_person_sla', 'invisibility_sla',
        'light_sensitivity', 'stonecunning',
        'no_speed_penalty_armor'
      ],
      languages: ['Common', 'Dwarven', 'Undercommon'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Svirfneblin (Deep Gnome) -- Monster Manual p132
    {
      id: 'svirfneblin', name: 'Svirfneblin',
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
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Kobold -- Monster Manual p161 (as playable)
    {
      id: 'kobold', name: 'Kobold',
      type: 'humanoid', subtypes: ['reptilian', 'dragonblood'],
      size: 'Small', speed: { land: 30 },
      abilityMods: { str: -4, dex: 2, con: -2, int: 0, wis: 0, cha: 0 },
      naturalArmor: 1, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'small_size',
        'light_sensitivity', 'craft_trapmaking_bonus',
        'profession_miner_bonus', 'search_bonus'
      ],
      languages: ['Common', 'Draconic'],
      favoredClass: 'sorcerer',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Goblin -- Monster Manual p133 (as playable)
    {
      id: 'goblin', name: 'Goblin',
      type: 'humanoid', subtypes: ['goblinoid'],
      size: 'Small', speed: { land: 30 },
      abilityMods: { str: -2, dex: 2, con: 0, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'small_size',
        'move_silently_bonus', 'ride_bonus'
      ],
      languages: ['Common', 'Goblin'],
      favoredClass: 'rogue',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Orc -- Monster Manual p203 (as playable)
    {
      id: 'orc', name: 'Orc',
      type: 'humanoid', subtypes: ['orc'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 4, dex: 0, con: 0, int: -2, wis: -2, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'light_sensitivity',
        'orc_weapon_proficiency'
      ],
      languages: ['Common', 'Orc'],
      favoredClass: 'barbarian',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Hobgoblin -- Monster Manual p153 (as playable)
    {
      id: 'hobgoblin', name: 'Hobgoblin',
      type: 'humanoid', subtypes: ['goblinoid'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'darkvision_60', 'move_silently_bonus'
      ],
      languages: ['Common', 'Goblin'],
      favoredClass: 'fighter',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Bugbear -- Monster Manual p29 (as playable)
    {
      id: 'bugbear', name: 'Bugbear',
      type: 'humanoid', subtypes: ['goblinoid'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 4, dex: 2, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 3, hitDie: 8, racialHD: 3,
      bab: 2, baseSaves: { fort: 1, ref: 3, will: 1 },
      cr: 2, la: 1,
      traits: [
        'darkvision_60', 'scent',
        'move_silently_bonus', 'intimidate_bonus'
      ],
      languages: ['Common', 'Goblin'],
      favoredClass: 'rogue',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00001
    },

    // Lizardfolk -- Monster Manual p169 (as playable)
    {
      id: 'lizardfolk', name: 'Lizardfolk',
      type: 'humanoid', subtypes: ['reptilian'],
      size: 'Medium', speed: { land: 30, swim: 15 },
      abilityMods: { str: 2, dex: 0, con: 2, int: -2, wis: 0, cha: 0 },
      naturalArmor: 5, hitDie: 8, racialHD: 2,
      bab: 1, baseSaves: { fort: 0, ref: 3, will: 0 },
      cr: 1, la: 1,
      traits: [
        'hold_breath', 'natural_weapons_claws',
        'natural_weapons_bite', 'multiattack',
        'swim_bonus', 'balance_bonus', 'jump_bonus'
      ],
      languages: ['Common', 'Draconic'],
      favoredClass: 'druid',
      playable: true, availability: 'expanded',
      source: 'expanded/Monster-Manual',
      passMode: 0b00101 // WALK | SWIM
    }

  );
})();
