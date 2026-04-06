;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});

  // Shared enum constants for the entire game.
  // Use these instead of magic strings throughout the codebase.

  TR.Enums = Object.freeze({

    // D&D 3.5e Creature Types
    CreatureType: Object.freeze({
      ABERRATION:         'aberration',
      ANIMAL:             'animal',
      CONSTRUCT:          'construct',
      DRAGON:             'dragon',
      ELEMENTAL:          'elemental',
      FEY:                'fey',
      GIANT:              'giant',
      HUMANOID:           'humanoid',
      MAGICAL_BEAST:      'magical_beast',
      MONSTROUS_HUMANOID: 'monstrous_humanoid',
      OOZE:               'ooze',
      OUTSIDER:           'outsider',
      PLANT:              'plant',
      UNDEAD:             'undead',
      VERMIN:             'vermin',
    }),

    // Size categories
    Size: Object.freeze({
      FINE:        'Fine',
      DIMINUTIVE:  'Diminutive',
      TINY:        'Tiny',
      SMALL:       'Small',
      MEDIUM:      'Medium',
      LARGE:       'Large',
      HUGE:        'Huge',
      GARGANTUAN:  'Gargantuan',
      COLOSSAL:    'Colossal',
    }),

    // Size abbreviations (used in some legacy code)
    SizeAbbrev: Object.freeze({
      F: 'Fine', D: 'Diminutive', T: 'Tiny', S: 'Small',
      M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', C: 'Colossal',
    }),

    // BAB progression types
    BABProgression: Object.freeze({
      FULL:         'full',
      THREE_QUARTER: '3/4',
      HALF:         '1/2',
    }),

    // Save types
    SaveType: Object.freeze({
      FORTITUDE: 'fort',
      REFLEX:    'ref',
      WILL:      'will',
    }),

    // Spell schools (D&D 3.5e SRD)
    SpellSchool: Object.freeze({
      ABJURATION:    'abjuration',
      CONJURATION:   'conjuration',
      DIVINATION:    'divination',
      ENCHANTMENT:   'enchantment',
      EVOCATION:     'evocation',
      ILLUSION:      'illusion',
      NECROMANCY:    'necromancy',
      TRANSMUTATION: 'transmutation',
      UNIVERSAL:     'universal',
      // Game-specific (maps to D&D healing/cure spells under conjuration/evocation)
      RESTORATION:   'restoration',
    }),

    // Damage types
    DamageType: Object.freeze({
      BLUDGEONING: 'bludgeoning',
      PIERCING:    'piercing',
      SLASHING:    'slashing',
      FIRE:        'fire',
      COLD:        'cold',
      ELECTRICITY: 'electricity',
      ACID:        'acid',
      SONIC:       'sonic',
      FORCE:       'force',
      POSITIVE:    'positive',
      NEGATIVE:    'negative',
      HOLY:        'holy',
      UNHOLY:      'unholy',
      NONLETHAL:   'nonlethal',
    }),

    // Ability scores
    Ability: Object.freeze({
      STR: 'str',
      DEX: 'dex',
      CON: 'con',
      INT: 'int',
      WIS: 'wis',
      CHA: 'cha',
    }),

    // Alignment axes
    Alignment: Object.freeze({
      LAWFUL_GOOD:     'LG',
      NEUTRAL_GOOD:    'NG',
      CHAOTIC_GOOD:    'CG',
      LAWFUL_NEUTRAL:  'LN',
      TRUE_NEUTRAL:    'N',
      CHAOTIC_NEUTRAL: 'CN',
      LAWFUL_EVIL:     'LE',
      NEUTRAL_EVIL:    'NE',
      CHAOTIC_EVIL:    'CE',
    }),

    // Vision types
    Vision: Object.freeze({
      NORMAL:     'normal',
      LOW_LIGHT:  'low-light',
      DARKVISION: 'darkvision',
      BLINDSIGHT: 'blindsight',
      TREMORSENSE:'tremorsense',
    }),

    // Weapon proficiency categories
    WeaponProficiency: Object.freeze({
      SIMPLE:  'simple',
      MARTIAL: 'martial',
      EXOTIC:  'exotic',
    }),

    // Armor categories
    ArmorCategory: Object.freeze({
      LIGHT:  'light',
      MEDIUM: 'medium',
      HEAVY:  'heavy',
      SHIELD: 'shield',
    }),

    // Class types
    ClassType: Object.freeze({
      BASE:     'base',
      PRESTIGE: 'prestige',
      NPC:      'npc',
    }),

    // Spellcasting types
    CastingType: Object.freeze({
      ARCANE:     'arcane',
      DIVINE:     'divine',
      PSIONIC:    'psionic',
      INVOCATION: 'invocation',
    }),

    // Spell components
    SpellComponent: Object.freeze({
      VERBAL:   'V',
      SOMATIC:  'S',
      MATERIAL: 'M',
      FOCUS:    'F',
      DIVINE:   'DF',
      XP:       'XP',
    }),

    // Item categories
    ItemCategory: Object.freeze({
      WEAPON:     'weapon',
      ARMOR:      'armor',
      SHIELD:     'shield',
      POTION:     'potion',
      SCROLL:     'scroll',
      WAND:       'wand',
      ROD:        'rod',
      STAFF:      'staff',
      RING:       'ring',
      WONDROUS:   'wondrous',
      MUNDANE:    'mundane',
      MATERIAL:   'material',
      ENCHANTMENT:'enchantment',
      ARTIFACT:   'artifact',
    }),

    // Equipment slots
    EquipmentSlot: Object.freeze({
      HEAD:      'head',
      FACE:      'face',
      NECK:      'neck',
      SHOULDERS: 'shoulders',
      BODY:      'body',
      TORSO:     'torso',
      ARMS:      'arms',
      HANDS:     'hands',
      RING1:     'ring1',
      RING2:     'ring2',
      WAIST:     'waist',
      FEET:      'feet',
      MAIN_HAND: 'mainHand',
      OFF_HAND:  'offHand',
    }),
  });
})();
