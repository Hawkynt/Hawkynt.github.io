;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).classes || (TR._pending.classes = []);
  TR._pending.classes.push(

    // ── Psion (Expanded Psionics Handbook) ──────────────────────────────
    {
      id: 'psion',
      name: 'Psion',
      type: 'base',
      hitDie: 4,
      babProgression: '1/2',
      goodSaves: ['will'],
      skillPoints: 2,
      classSkills: ['concentration', 'craft', 'knowledgeArcana', 'knowledgePsionics', 'profession', 'psicraft'],
      proficiencies: { weapons: ['club', 'dagger', 'heavyCrossbow', 'lightCrossbow', 'quarterstaff', 'shortspear'], armor: [] },
      spellcasting: { type: 'psionic', progression: 'full', abilityScore: 'int', prepared: false },
      features: [
        { level: 1, id: 'discipline', name: 'Psionic Discipline' },
        { level: 1, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 5, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 10, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 15, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 20, id: 'bonusFeat', name: 'Bonus Feat' },
      ],
      // Power points per day (psionic classes use power points instead of spell slots)
      spellsPerDay: [
        null,
        [2],     // 1
        [6],     // 2
        [11],    // 3
        [17],    // 4
        [25],    // 5
        [35],    // 6
        [46],    // 7
        [58],    // 8
        [72],    // 9
        [88],    // 10
        [106],   // 11
        [126],   // 12
        [147],   // 13
        [170],   // 14
        [195],   // 15
        [221],   // 16
        [250],   // 17
        [280],   // 18
        [311],   // 19
        [343],   // 20
      ],
      prerequisites: null,
      source: 'supplement/Expanded-Psionics-Handbook',
    },

    // ── Wilder (Expanded Psionics Handbook) ─────────────────────────────
    {
      id: 'wilder',
      name: 'Wilder',
      type: 'base',
      hitDie: 6,
      babProgression: '3/4',
      goodSaves: ['will'],
      skillPoints: 4,
      classSkills: ['autohypnosis', 'balance', 'bluff', 'climb', 'concentration', 'craft', 'escapeArtist', 'intimidate', 'jump', 'knowledgePsionics', 'listen', 'profession', 'psicraft', 'senseMotive', 'spot', 'swim', 'tumble'],
      proficiencies: { weapons: ['simple'], armor: ['light', 'shield'] },
      spellcasting: { type: 'psionic', progression: 'full', abilityScore: 'cha', prepared: false },
      features: [
        { level: 1, id: 'wildSurge', name: 'Wild Surge +1' },
        { level: 1, id: 'psychicEnervation', name: 'Psychic Enervation' },
        { level: 3, id: 'wildSurge', name: 'Wild Surge +2' },
        { level: 5, id: 'volatileMind', name: 'Volatile Mind (1 PP)' },
        { level: 7, id: 'wildSurge', name: 'Wild Surge +3' },
        { level: 9, id: 'volatileMind', name: 'Volatile Mind (2 PP)' },
        { level: 11, id: 'wildSurge', name: 'Wild Surge +4' },
        { level: 13, id: 'volatileMind', name: 'Volatile Mind (3 PP)' },
        { level: 15, id: 'wildSurge', name: 'Wild Surge +5' },
        { level: 17, id: 'volatileMind', name: 'Volatile Mind (4 PP)' },
        { level: 19, id: 'wildSurge', name: 'Wild Surge +6' },
        { level: 20, id: 'surgingEuphoria', name: 'Surging Euphoria +2' },
      ],
      spellsPerDay: [
        null,
        [2],     // 1
        [6],     // 2
        [11],    // 3
        [17],    // 4
        [25],    // 5
        [35],    // 6
        [46],    // 7
        [58],    // 8
        [72],    // 9
        [88],    // 10
        [106],   // 11
        [126],   // 12
        [147],   // 13
        [170],   // 14
        [195],   // 15
        [221],   // 16
        [250],   // 17
        [280],   // 18
        [311],   // 19
        [343],   // 20
      ],
      prerequisites: null,
      source: 'supplement/Expanded-Psionics-Handbook',
    },

    // ── Soulknife (Expanded Psionics Handbook) ──────────────────────────
    {
      id: 'soulknife',
      name: 'Soulknife',
      type: 'base',
      hitDie: 10,
      babProgression: '3/4',
      goodSaves: ['fort', 'ref'],
      skillPoints: 4,
      classSkills: ['autohypnosis', 'climb', 'concentration', 'craft', 'hide', 'jump', 'knowledgePsionics', 'listen', 'moveSilently', 'profession', 'spot', 'tumble'],
      proficiencies: { weapons: ['simple'], armor: ['light', 'shield'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'mindBlade', name: 'Mind Blade' },
        { level: 1, id: 'weaponFocus', name: 'Weapon Focus (mind blade)' },
        { level: 1, id: 'wildTalent', name: 'Wild Talent' },
        { level: 2, id: 'throwMindBlade', name: 'Throw Mind Blade' },
        { level: 3, id: 'psychicStrike', name: 'Psychic Strike +1d8' },
        { level: 4, id: 'mindBlade', name: 'Mind Blade +1' },
        { level: 5, id: 'freeDrawMindBlade', name: 'Free Draw' },
        { level: 5, id: 'shapeMindBlade', name: 'Shape Mind Blade' },
        { level: 6, id: 'mindBladeEnhancement', name: 'Mind Blade Enhancement' },
        { level: 7, id: 'psychicStrike', name: 'Psychic Strike +2d8' },
        { level: 8, id: 'mindBlade', name: 'Mind Blade +2' },
        { level: 9, id: 'bladewind', name: 'Bladewind' },
        { level: 10, id: 'mindBladeEnhancement', name: 'Mind Blade Enhancement +2' },
        { level: 11, id: 'psychicStrike', name: 'Psychic Strike +3d8' },
        { level: 12, id: 'mindBlade', name: 'Mind Blade +3' },
        { level: 13, id: 'knifeToTheSoul', name: 'Knife to the Soul' },
        { level: 14, id: 'mindBladeEnhancement', name: 'Mind Blade Enhancement +3' },
        { level: 15, id: 'psychicStrike', name: 'Psychic Strike +4d8' },
        { level: 16, id: 'mindBlade', name: 'Mind Blade +4' },
        { level: 17, id: 'multipleThrow', name: 'Multiple Throw' },
        { level: 18, id: 'mindBladeEnhancement', name: 'Mind Blade Enhancement +4' },
        { level: 19, id: 'psychicStrike', name: 'Psychic Strike +5d8' },
        { level: 20, id: 'mindBlade', name: 'Mind Blade +5' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'supplement/Expanded-Psionics-Handbook',
    },

    // ── Psychic Warrior (Expanded Psionics Handbook) ────────────────────
    {
      id: 'psychicWarrior',
      name: 'Psychic Warrior',
      type: 'base',
      hitDie: 8,
      babProgression: '3/4',
      goodSaves: ['fort'],
      skillPoints: 2,
      classSkills: ['autohypnosis', 'climb', 'concentration', 'craft', 'jump', 'knowledgePsionics', 'profession', 'ride', 'search', 'swim'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shield'] },
      spellcasting: { type: 'psionic', progression: 'half', abilityScore: 'wis', prepared: false },
      features: [
        { level: 1, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 2, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 5, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 8, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 11, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 14, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 17, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 20, id: 'bonusFeat', name: 'Bonus Feat' },
      ],
      spellsPerDay: [
        null,
        [0],     // 1
        [1],     // 2
        [3],     // 3
        [5],     // 4
        [7],     // 5
        [11],    // 6
        [15],    // 7
        [19],    // 8
        [23],    // 9
        [27],    // 10
        [35],    // 11
        [43],    // 12
        [51],    // 13
        [59],    // 14
        [67],    // 15
        [79],    // 16
        [91],    // 17
        [103],   // 18
        [115],   // 19
        [127],   // 20
      ],
      prerequisites: null,
      source: 'supplement/Expanded-Psionics-Handbook',
    },

    // ── Ardent (Complete Psionic) ───────────────────────────────────────
    {
      id: 'ardent',
      name: 'Ardent',
      type: 'base',
      hitDie: 6,
      babProgression: '3/4',
      goodSaves: ['will'],
      skillPoints: 2,
      classSkills: ['autohypnosis', 'concentration', 'craft', 'diplomacy', 'knowledgePsionics', 'profession', 'psicraft'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shield'] },
      spellcasting: { type: 'psionic', progression: 'full', abilityScore: 'wis', prepared: false },
      features: [
        { level: 1, id: 'mantles', name: 'Mantle (2)' },
        { level: 2, id: 'assume', name: 'Assume Psionic Mantle' },
        { level: 3, id: 'mantles', name: 'Mantle (3rd)' },
        { level: 7, id: 'mantles', name: 'Mantle (4th)' },
        { level: 12, id: 'mantles', name: 'Mantle (5th)' },
        { level: 18, id: 'mantles', name: 'Mantle (6th)' },
      ],
      spellsPerDay: [
        null,
        [2],     // 1
        [6],     // 2
        [11],    // 3
        [17],    // 4
        [25],    // 5
        [35],    // 6
        [46],    // 7
        [58],    // 8
        [72],    // 9
        [88],    // 10
        [106],   // 11
        [126],   // 12
        [147],   // 13
        [170],   // 14
        [195],   // 15
        [221],   // 16
        [250],   // 17
        [280],   // 18
        [311],   // 19
        [343],   // 20
      ],
      prerequisites: null,
      source: 'supplement/Complete-Psionic',
    },

    // ── Divine Mind (Complete Psionic) ───────────────────────────────────
    {
      id: 'divineMind',
      name: 'Divine Mind',
      type: 'base',
      hitDie: 10,
      babProgression: 'full',
      goodSaves: ['fort', 'will'],
      skillPoints: 2,
      classSkills: ['autohypnosis', 'concentration', 'craft', 'diplomacy', 'knowledgePsionics', 'knowledgeReligion', 'profession', 'psicraft', 'ride'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shield'] },
      spellcasting: { type: 'psionic', progression: 'half', abilityScore: 'cha', prepared: false },
      features: [
        { level: 1, id: 'psionicAura', name: 'Psionic Aura' },
        { level: 2, id: 'shieldOfFaith', name: 'Shield of Thought' },
        { level: 3, id: 'psionicAura', name: 'Psionic Aura (2 active)' },
        { level: 5, id: 'centeredDefense', name: 'Centered Defense +1' },
        { level: 7, id: 'psionicAura', name: 'Psionic Aura (3 active)' },
        { level: 10, id: 'centeredDefense', name: 'Centered Defense +2' },
        { level: 15, id: 'centeredDefense', name: 'Centered Defense +3' },
        { level: 20, id: 'centeredDefense', name: 'Centered Defense +4' },
      ],
      spellsPerDay: [
        null,
        [0],
        [1],
        [3],
        [5],
        [7],
        [11],
        [15],
        [19],
        [23],
        [27],
        [35],
        [43],
        [51],
        [59],
        [67],
        [79],
        [91],
        [103],
        [115],
        [127],
      ],
      prerequisites: null,
      source: 'supplement/Complete-Psionic',
    },

    // ── Lurk (Complete Psionic) ─────────────────────────────────────────
    {
      id: 'lurk',
      name: 'Lurk',
      type: 'base',
      hitDie: 6,
      babProgression: '3/4',
      goodSaves: ['ref'],
      skillPoints: 6,
      classSkills: ['autohypnosis', 'balance', 'bluff', 'climb', 'concentration', 'craft', 'disableDevice', 'disguise', 'escapeArtist', 'gatherInformation', 'hide', 'jump', 'knowledgeLocal', 'knowledgePsionics', 'listen', 'moveSilently', 'openLock', 'profession', 'psicraft', 'search', 'senseMotive', 'sleightOfHand', 'spot', 'swim', 'tumble', 'usePsionicDevice'],
      proficiencies: { weapons: ['simple', 'shortbow', 'shortSword', 'rapier'], armor: ['light'] },
      spellcasting: { type: 'psionic', progression: 'half', abilityScore: 'int', prepared: false },
      features: [
        { level: 1, id: 'sneakAttack', name: 'Sneak Attack +1d6' },
        { level: 1, id: 'lurkAugment', name: 'Lurk Augment' },
        { level: 2, id: 'trapfinding', name: 'Trapfinding' },
        { level: 3, id: 'sneakAttack', name: 'Sneak Attack +2d6' },
        { level: 4, id: 'evasion', name: 'Evasion' },
        { level: 5, id: 'sneakAttack', name: 'Sneak Attack +3d6' },
        { level: 7, id: 'sneakAttack', name: 'Sneak Attack +4d6' },
        { level: 9, id: 'sneakAttack', name: 'Sneak Attack +5d6' },
        { level: 11, id: 'sneakAttack', name: 'Sneak Attack +6d6' },
        { level: 13, id: 'sneakAttack', name: 'Sneak Attack +7d6' },
        { level: 15, id: 'sneakAttack', name: 'Sneak Attack +8d6' },
        { level: 17, id: 'sneakAttack', name: 'Sneak Attack +9d6' },
        { level: 19, id: 'sneakAttack', name: 'Sneak Attack +10d6' },
      ],
      spellsPerDay: [
        null,
        [0],
        [1],
        [3],
        [5],
        [7],
        [11],
        [15],
        [19],
        [23],
        [27],
        [35],
        [43],
        [51],
        [59],
        [67],
        [79],
        [91],
        [103],
        [115],
        [127],
      ],
      prerequisites: null,
      source: 'supplement/Complete-Psionic',
    }

  );
})();
