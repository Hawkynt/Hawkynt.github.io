;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).classes || (TR._pending.classes = []);
  TR._pending.classes.push(

    // ── Fighter ──────────────────────────────────────────────────────────
    {
      id: 'fighter',
      name: 'Fighter',
      type: 'base',
      hitDie: 10,
      babProgression: 'full',
      goodSaves: ['fort'],
      skillPoints: 2,
      classSkills: ['climb', 'craft', 'handleAnimal', 'intimidate', 'jump', 'ride', 'swim'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shield', 'towerShield'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 2, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 4, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 6, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 8, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 10, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 12, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 14, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 16, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 18, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 20, id: 'bonusFeat', name: 'Bonus Feat' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Barbarian ────────────────────────────────────────────────────────
    {
      id: 'barbarian',
      name: 'Barbarian',
      type: 'base',
      hitDie: 12,
      babProgression: 'full',
      goodSaves: ['fort'],
      skillPoints: 4,
      classSkills: ['climb', 'craft', 'handleAnimal', 'intimidate', 'jump', 'listen', 'ride', 'survival', 'swim'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'shield'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'fastMovement', name: 'Fast Movement' },
        { level: 1, id: 'illiteracy', name: 'Illiteracy' },
        { level: 1, id: 'rage', name: 'Rage 1/day' },
        { level: 2, id: 'uncannyDodge', name: 'Uncanny Dodge' },
        { level: 3, id: 'trapSense', name: 'Trap Sense +1' },
        { level: 4, id: 'rage', name: 'Rage 2/day' },
        { level: 5, id: 'improvedUncannyDodge', name: 'Improved Uncanny Dodge' },
        { level: 6, id: 'trapSense', name: 'Trap Sense +2' },
        { level: 7, id: 'damageReduction', name: 'Damage Reduction 1/--' },
        { level: 8, id: 'rage', name: 'Rage 3/day' },
        { level: 9, id: 'trapSense', name: 'Trap Sense +3' },
        { level: 10, id: 'damageReduction', name: 'Damage Reduction 2/--' },
        { level: 11, id: 'greaterRage', name: 'Greater Rage' },
        { level: 12, id: 'rage', name: 'Rage 4/day' },
        { level: 12, id: 'trapSense', name: 'Trap Sense +4' },
        { level: 13, id: 'damageReduction', name: 'Damage Reduction 3/--' },
        { level: 14, id: 'indomitableWill', name: 'Indomitable Will' },
        { level: 15, id: 'trapSense', name: 'Trap Sense +5' },
        { level: 16, id: 'damageReduction', name: 'Damage Reduction 4/--' },
        { level: 16, id: 'rage', name: 'Rage 5/day' },
        { level: 17, id: 'tirelessRage', name: 'Tireless Rage' },
        { level: 18, id: 'trapSense', name: 'Trap Sense +6' },
        { level: 19, id: 'damageReduction', name: 'Damage Reduction 5/--' },
        { level: 20, id: 'mightyRage', name: 'Mighty Rage' },
        { level: 20, id: 'rage', name: 'Rage 6/day' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Paladin ──────────────────────────────────────────────────────────
    {
      id: 'paladin',
      name: 'Paladin',
      type: 'base',
      hitDie: 10,
      babProgression: 'full',
      goodSaves: ['fort', 'will'],
      skillPoints: 2,
      classSkills: ['concentration', 'craft', 'diplomacy', 'handleAnimal', 'heal', 'knowledgeNobility', 'knowledgeReligion', 'profession', 'ride', 'senseMotive'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shield'] },
      spellcasting: { type: 'divine', progression: 'half', abilityScore: 'wis', prepared: true, spellSchools: ['abjuration', 'restoration'] },
      features: [
        { level: 1, id: 'auraOfGood', name: 'Aura of Good' },
        { level: 1, id: 'detectEvil', name: 'Detect Evil' },
        { level: 1, id: 'smiteEvil', name: 'Smite Evil 1/day' },
        { level: 2, id: 'divineGrace', name: 'Divine Grace' },
        { level: 2, id: 'layOnHands', name: 'Lay on Hands' },
        { level: 3, id: 'auraOfCourage', name: 'Aura of Courage' },
        { level: 3, id: 'divineHealth', name: 'Divine Health' },
        { level: 4, id: 'turnUndead', name: 'Turn Undead' },
        { level: 5, id: 'smiteEvil', name: 'Smite Evil 2/day' },
        { level: 5, id: 'specialMount', name: 'Special Mount' },
        { level: 6, id: 'removeDisease', name: 'Remove Disease 1/week' },
        { level: 9, id: 'removeDisease', name: 'Remove Disease 2/week' },
        { level: 10, id: 'smiteEvil', name: 'Smite Evil 3/day' },
        { level: 12, id: 'removeDisease', name: 'Remove Disease 3/week' },
        { level: 15, id: 'smiteEvil', name: 'Smite Evil 4/day' },
        { level: 15, id: 'removeDisease', name: 'Remove Disease 4/week' },
        { level: 18, id: 'removeDisease', name: 'Remove Disease 5/week' },
        { level: 20, id: 'smiteEvil', name: 'Smite Evil 5/day' },
      ],
      spellsPerDay: [
        null,           // 0 - unused
        null,           // 1
        null,           // 2
        null,           // 3
        [0, 0],         // 4
        [0, 0],         // 5
        [0, 1],         // 6
        [0, 1],         // 7
        [0, 1, 0],      // 8
        [0, 1, 0],      // 9
        [0, 1, 1],      // 10
        [0, 1, 1, 0],   // 11
        [0, 1, 1, 1],   // 12
        [0, 1, 1, 1],   // 13
        [0, 2, 1, 1, 0], // 14
        [0, 2, 1, 1, 1], // 15
        [0, 2, 2, 1, 1], // 16
        [0, 2, 2, 2, 1], // 17
        [0, 3, 2, 2, 1], // 18
        [0, 3, 3, 3, 2], // 19
        [0, 3, 3, 3, 3], // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Ranger ───────────────────────────────────────────────────────────
    {
      id: 'ranger',
      name: 'Ranger',
      type: 'base',
      hitDie: 8,
      babProgression: 'full',
      goodSaves: ['fort', 'ref'],
      skillPoints: 6,
      classSkills: ['climb', 'concentration', 'craft', 'handleAnimal', 'heal', 'hide', 'jump', 'knowledgeDungeoneering', 'knowledgeGeography', 'knowledgeNature', 'listen', 'moveSilently', 'profession', 'ride', 'search', 'spot', 'survival', 'swim', 'useRope'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'shield'] },
      spellcasting: { type: 'divine', progression: 'half', abilityScore: 'wis', prepared: true, spellSchools: ['restoration', 'divination'] },
      features: [
        { level: 1, id: 'favoredEnemy', name: 'Favored Enemy 1st' },
        { level: 1, id: 'track', name: 'Track' },
        { level: 1, id: 'wildEmpathy', name: 'Wild Empathy' },
        { level: 2, id: 'combatStyle', name: 'Combat Style' },
        { level: 3, id: 'endurance', name: 'Endurance' },
        { level: 4, id: 'animalCompanion', name: 'Animal Companion' },
        { level: 5, id: 'favoredEnemy', name: 'Favored Enemy 2nd' },
        { level: 6, id: 'improvedCombatStyle', name: 'Improved Combat Style' },
        { level: 7, id: 'woodlandStride', name: 'Woodland Stride' },
        { level: 8, id: 'swiftTracker', name: 'Swift Tracker' },
        { level: 9, id: 'evasion', name: 'Evasion' },
        { level: 10, id: 'favoredEnemy', name: 'Favored Enemy 3rd' },
        { level: 11, id: 'combatStyleMastery', name: 'Combat Style Mastery' },
        { level: 13, id: 'camouflage', name: 'Camouflage' },
        { level: 15, id: 'favoredEnemy', name: 'Favored Enemy 4th' },
        { level: 17, id: 'hideInPlainSight', name: 'Hide in Plain Sight' },
        { level: 20, id: 'favoredEnemy', name: 'Favored Enemy 5th' },
      ],
      spellsPerDay: [
        null,           // 0 - unused
        null,           // 1
        null,           // 2
        null,           // 3
        [0, 0],         // 4
        [0, 0],         // 5
        [0, 1],         // 6
        [0, 1],         // 7
        [0, 1, 0],      // 8
        [0, 1, 0],      // 9
        [0, 1, 1],      // 10
        [0, 1, 1, 0],   // 11
        [0, 1, 1, 1],   // 12
        [0, 1, 1, 1],   // 13
        [0, 2, 1, 1, 0], // 14
        [0, 2, 1, 1, 1], // 15
        [0, 2, 2, 1, 1], // 16
        [0, 2, 2, 2, 1], // 17
        [0, 3, 2, 2, 1], // 18
        [0, 3, 3, 3, 2], // 19
        [0, 3, 3, 3, 3], // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Monk ─────────────────────────────────────────────────────────────
    {
      id: 'monk',
      name: 'Monk',
      type: 'base',
      hitDie: 8,
      babProgression: '3/4',
      goodSaves: ['fort', 'ref', 'will'],
      skillPoints: 4,
      classSkills: ['balance', 'climb', 'concentration', 'craft', 'diplomacy', 'escapeArtist', 'hide', 'jump', 'knowledgeArcana', 'knowledgeReligion', 'listen', 'moveSilently', 'performance', 'profession', 'senseMotive', 'spot', 'swim', 'tumble'],
      proficiencies: { weapons: ['club', 'crossbow', 'dagger', 'handaxe', 'javelin', 'kama', 'nunchaku', 'quarterstaff', 'sai', 'shuriken', 'siangham', 'sling'], armor: [] },
      spellcasting: null,
      features: [
        { level: 1, id: 'bonusFeat', name: 'Bonus Feat (Improved Grapple or Stunning Fist)' },
        { level: 1, id: 'flurryOfBlows', name: 'Flurry of Blows' },
        { level: 1, id: 'unarmedStrike', name: 'Unarmed Strike 1d6' },
        { level: 2, id: 'bonusFeat', name: 'Bonus Feat (Combat Reflexes or Deflect Arrows)' },
        { level: 2, id: 'evasion', name: 'Evasion' },
        { level: 3, id: 'stillMind', name: 'Still Mind' },
        { level: 3, id: 'fastMovement', name: 'Fast Movement +10ft' },
        { level: 4, id: 'kiStrike', name: 'Ki Strike (magic)' },
        { level: 4, id: 'slowFall', name: 'Slow Fall 20ft' },
        { level: 5, id: 'purityOfBody', name: 'Purity of Body' },
        { level: 6, id: 'bonusFeat', name: 'Bonus Feat (Improved Disarm or Improved Trip)' },
        { level: 6, id: 'slowFall', name: 'Slow Fall 30ft' },
        { level: 7, id: 'wholenessOfBody', name: 'Wholeness of Body' },
        { level: 8, id: 'slowFall', name: 'Slow Fall 40ft' },
        { level: 9, id: 'improvedEvasion', name: 'Improved Evasion' },
        { level: 10, id: 'kiStrike', name: 'Ki Strike (lawful)' },
        { level: 10, id: 'slowFall', name: 'Slow Fall 50ft' },
        { level: 11, id: 'diamondBody', name: 'Diamond Body' },
        { level: 11, id: 'greaterFlurry', name: 'Greater Flurry' },
        { level: 12, id: 'abundantStep', name: 'Abundant Step' },
        { level: 12, id: 'slowFall', name: 'Slow Fall 60ft' },
        { level: 13, id: 'diamondSoul', name: 'Diamond Soul' },
        { level: 14, id: 'slowFall', name: 'Slow Fall 70ft' },
        { level: 15, id: 'quiveringPalm', name: 'Quivering Palm' },
        { level: 16, id: 'kiStrike', name: 'Ki Strike (adamantine)' },
        { level: 16, id: 'slowFall', name: 'Slow Fall 80ft' },
        { level: 17, id: 'timelessBody', name: 'Timeless Body' },
        { level: 17, id: 'tongueOfSunAndMoon', name: 'Tongue of the Sun and Moon' },
        { level: 18, id: 'slowFall', name: 'Slow Fall 90ft' },
        { level: 19, id: 'emptyBody', name: 'Empty Body' },
        { level: 20, id: 'perfectSelf', name: 'Perfect Self' },
        { level: 20, id: 'slowFall', name: 'Slow Fall any distance' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Rogue ────────────────────────────────────────────────────────────
    {
      id: 'rogue',
      name: 'Rogue',
      type: 'base',
      hitDie: 6,
      babProgression: '3/4',
      goodSaves: ['ref'],
      skillPoints: 8,
      classSkills: ['appraise', 'balance', 'bluff', 'climb', 'craft', 'decipher', 'diplomacy', 'disableDevice', 'disguise', 'escapeArtist', 'forgery', 'gatherInformation', 'hide', 'intimidate', 'jump', 'listen', 'moveSilently', 'openLock', 'performace', 'profession', 'search', 'senseMotive', 'sleightOfHand', 'spot', 'swim', 'tumble', 'useMagicDevice', 'useRope'],
      proficiencies: { weapons: ['simple', 'handCrossbow', 'rapier', 'sap', 'shortbow', 'shortSword'], armor: ['light'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'sneakAttack', name: 'Sneak Attack +1d6' },
        { level: 1, id: 'trapfinding', name: 'Trapfinding' },
        { level: 2, id: 'evasion', name: 'Evasion' },
        { level: 3, id: 'sneakAttack', name: 'Sneak Attack +2d6' },
        { level: 3, id: 'trapSense', name: 'Trap Sense +1' },
        { level: 4, id: 'uncannyDodge', name: 'Uncanny Dodge' },
        { level: 5, id: 'sneakAttack', name: 'Sneak Attack +3d6' },
        { level: 6, id: 'trapSense', name: 'Trap Sense +2' },
        { level: 7, id: 'sneakAttack', name: 'Sneak Attack +4d6' },
        { level: 8, id: 'improvedUncannyDodge', name: 'Improved Uncanny Dodge' },
        { level: 9, id: 'sneakAttack', name: 'Sneak Attack +5d6' },
        { level: 9, id: 'trapSense', name: 'Trap Sense +3' },
        { level: 10, id: 'specialAbility', name: 'Special Ability' },
        { level: 11, id: 'sneakAttack', name: 'Sneak Attack +6d6' },
        { level: 12, id: 'trapSense', name: 'Trap Sense +4' },
        { level: 13, id: 'sneakAttack', name: 'Sneak Attack +7d6' },
        { level: 13, id: 'specialAbility', name: 'Special Ability' },
        { level: 15, id: 'sneakAttack', name: 'Sneak Attack +8d6' },
        { level: 15, id: 'trapSense', name: 'Trap Sense +5' },
        { level: 16, id: 'specialAbility', name: 'Special Ability' },
        { level: 17, id: 'sneakAttack', name: 'Sneak Attack +9d6' },
        { level: 18, id: 'trapSense', name: 'Trap Sense +6' },
        { level: 19, id: 'sneakAttack', name: 'Sneak Attack +10d6' },
        { level: 19, id: 'specialAbility', name: 'Special Ability' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Wizard ───────────────────────────────────────────────────────────
    {
      id: 'wizard',
      name: 'Wizard',
      type: 'base',
      hitDie: 4,
      babProgression: '1/2',
      goodSaves: ['will'],
      skillPoints: 2,
      classSkills: ['concentration', 'craft', 'decipherScript', 'knowledgeArcana', 'knowledgeArchitecture', 'knowledgeDungeoneering', 'knowledgeGeography', 'knowledgeHistory', 'knowledgeLocal', 'knowledgeNature', 'knowledgeNobility', 'knowledgeReligion', 'knowledgePlanes', 'profession', 'spellcraft'],
      proficiencies: { weapons: ['club', 'dagger', 'heavyCrossbow', 'lightCrossbow', 'quarterstaff'], armor: [] },
      spellcasting: { type: 'arcane', progression: 'full', abilityScore: 'int', prepared: true, spellSchools: ['evocation', 'necromancy', 'conjuration', 'illusion', 'transmutation', 'abjuration', 'divination', 'enchantment'] },
      features: [
        { level: 1, id: 'summonFamiliar', name: 'Summon Familiar' },
        { level: 1, id: 'scribeScroll', name: 'Scribe Scroll' },
        { level: 5, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 10, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 15, id: 'bonusFeat', name: 'Bonus Feat' },
        { level: 20, id: 'bonusFeat', name: 'Bonus Feat' },
      ],
      spellsPerDay: [
        null,                          // 0 - unused
        [3, 1],                        // 1
        [4, 2],                        // 2
        [4, 2, 1],                     // 3
        [4, 3, 2],                     // 4
        [4, 3, 2, 1],                  // 5
        [4, 3, 3, 2],                  // 6
        [4, 4, 3, 2, 1],               // 7
        [4, 4, 3, 3, 2],               // 8
        [4, 4, 4, 3, 2, 1],            // 9
        [4, 4, 4, 3, 3, 2],            // 10
        [4, 4, 4, 4, 3, 2, 1],         // 11
        [4, 4, 4, 4, 3, 3, 2],         // 12
        [4, 4, 4, 4, 4, 3, 2, 1],      // 13
        [4, 4, 4, 4, 4, 3, 3, 2],      // 14
        [4, 4, 4, 4, 4, 4, 3, 2, 1],   // 15
        [4, 4, 4, 4, 4, 4, 3, 3, 2],   // 16
        [4, 4, 4, 4, 4, 4, 4, 3, 2, 1], // 17
        [4, 4, 4, 4, 4, 4, 4, 3, 3, 2], // 18
        [4, 4, 4, 4, 4, 4, 4, 4, 3, 3], // 19
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4], // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Sorcerer ─────────────────────────────────────────────────────────
    {
      id: 'sorcerer',
      name: 'Sorcerer',
      type: 'base',
      hitDie: 4,
      babProgression: '1/2',
      goodSaves: ['will'],
      skillPoints: 2,
      classSkills: ['bluff', 'concentration', 'craft', 'knowledgeArcana', 'profession', 'spellcraft'],
      proficiencies: { weapons: ['simple'], armor: [] },
      spellcasting: { type: 'arcane', progression: 'full', abilityScore: 'cha', prepared: false, spellSchools: ['evocation', 'enchantment', 'transmutation'] },
      features: [
        { level: 1, id: 'summonFamiliar', name: 'Summon Familiar' },
      ],
      spellsPerDay: [
        null,                             // 0 - unused
        [5, 3],                           // 1
        [6, 4],                           // 2
        [6, 5],                           // 3
        [6, 6, 3],                        // 4
        [6, 6, 4],                        // 5
        [6, 6, 5, 3],                     // 6
        [6, 6, 6, 4],                     // 7
        [6, 6, 6, 5, 3],                  // 8
        [6, 6, 6, 6, 4],                  // 9
        [6, 6, 6, 6, 5, 3],               // 10
        [6, 6, 6, 6, 6, 4],               // 11
        [6, 6, 6, 6, 6, 5, 3],            // 12
        [6, 6, 6, 6, 6, 6, 4],            // 13
        [6, 6, 6, 6, 6, 6, 5, 3],         // 14
        [6, 6, 6, 6, 6, 6, 6, 4],         // 15
        [6, 6, 6, 6, 6, 6, 6, 5, 3],      // 16
        [6, 6, 6, 6, 6, 6, 6, 6, 4],      // 17
        [6, 6, 6, 6, 6, 6, 6, 6, 5, 3],   // 18
        [6, 6, 6, 6, 6, 6, 6, 6, 6, 4],   // 19
        [6, 6, 6, 6, 6, 6, 6, 6, 6, 6],   // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Cleric ───────────────────────────────────────────────────────────
    {
      id: 'cleric',
      name: 'Cleric',
      type: 'base',
      hitDie: 8,
      babProgression: '3/4',
      goodSaves: ['fort', 'will'],
      skillPoints: 2,
      classSkills: ['concentration', 'craft', 'diplomacy', 'heal', 'knowledgeArcana', 'knowledgeHistory', 'knowledgeReligion', 'knowledgePlanes', 'profession', 'spellcraft'],
      proficiencies: { weapons: ['simple'], armor: ['light', 'medium', 'heavy', 'shield'] },
      spellcasting: { type: 'divine', progression: 'full', abilityScore: 'wis', prepared: true, spellSchools: ['abjuration', 'divination', 'restoration', 'necromancy', 'conjuration', 'enchantment', 'transmutation', 'evocation'] },
      features: [
        { level: 1, id: 'aura', name: 'Aura' },
        { level: 1, id: 'domains', name: 'Domains (2)' },
        { level: 1, id: 'spontaneousCasting', name: 'Spontaneous Casting (cure/inflict)' },
        { level: 1, id: 'turnUndead', name: 'Turn or Rebuke Undead' },
      ],
      spellsPerDay: [
        null,                             // 0 - unused
        [3, 1],                           // 1  (+1 domain slot per spell level)
        [4, 2],                           // 2
        [4, 2, 1],                        // 3
        [5, 3, 2],                        // 4
        [5, 3, 2, 1],                     // 5
        [5, 3, 3, 2],                     // 6
        [6, 4, 3, 2, 1],                  // 7
        [6, 4, 3, 3, 2],                  // 8
        [6, 4, 4, 3, 2, 1],               // 9
        [6, 4, 4, 3, 3, 2],               // 10
        [6, 5, 4, 4, 3, 2, 1],            // 11
        [6, 5, 4, 4, 3, 3, 2],            // 12
        [6, 5, 5, 4, 4, 3, 2, 1],         // 13
        [6, 5, 5, 4, 4, 3, 3, 2],         // 14
        [6, 5, 5, 5, 4, 4, 3, 2, 1],      // 15
        [6, 5, 5, 5, 4, 4, 3, 3, 2],      // 16
        [6, 5, 5, 5, 5, 4, 4, 3, 2, 1],   // 17
        [6, 5, 5, 5, 5, 4, 4, 3, 3, 2],   // 18
        [6, 5, 5, 5, 5, 5, 4, 4, 3, 3],   // 19
        [6, 5, 5, 5, 5, 5, 4, 4, 4, 4],   // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Druid ────────────────────────────────────────────────────────────
    {
      id: 'druid',
      name: 'Druid',
      type: 'base',
      hitDie: 8,
      babProgression: '3/4',
      goodSaves: ['fort', 'will'],
      skillPoints: 4,
      classSkills: ['concentration', 'craft', 'diplomacy', 'handleAnimal', 'heal', 'knowledgeNature', 'listen', 'profession', 'ride', 'spellcraft', 'spot', 'survival', 'swim'],
      proficiencies: { weapons: ['club', 'dagger', 'dart', 'quarterstaff', 'scimitar', 'sickle', 'shortspear', 'sling', 'spear'], armor: ['light', 'medium', 'shield'] },
      spellcasting: { type: 'divine', progression: 'full', abilityScore: 'wis', prepared: true, spellSchools: ['conjuration', 'divination', 'evocation', 'necromancy', 'transmutation', 'abjuration', 'restoration'] },
      features: [
        { level: 1, id: 'animalCompanion', name: 'Animal Companion' },
        { level: 1, id: 'natureSense', name: 'Nature Sense' },
        { level: 1, id: 'wildEmpathy', name: 'Wild Empathy' },
        { level: 2, id: 'woodlandStride', name: 'Woodland Stride' },
        { level: 3, id: 'tracklessStep', name: 'Trackless Step' },
        { level: 4, id: 'resistNaturesLure', name: "Resist Nature's Lure" },
        { level: 5, id: 'wildShape', name: 'Wild Shape 1/day' },
        { level: 6, id: 'wildShape', name: 'Wild Shape 2/day' },
        { level: 7, id: 'wildShape', name: 'Wild Shape 3/day' },
        { level: 8, id: 'wildShape', name: 'Wild Shape (Large)' },
        { level: 9, id: 'venomImmunity', name: 'Venom Immunity' },
        { level: 10, id: 'wildShape', name: 'Wild Shape 4/day' },
        { level: 11, id: 'wildShape', name: 'Wild Shape (Tiny)' },
        { level: 12, id: 'wildShape', name: 'Wild Shape (plant)' },
        { level: 13, id: 'thousandFaces', name: 'A Thousand Faces' },
        { level: 14, id: 'wildShape', name: 'Wild Shape 5/day' },
        { level: 15, id: 'timelessBody', name: 'Timeless Body' },
        { level: 15, id: 'wildShape', name: 'Wild Shape (Huge)' },
        { level: 16, id: 'wildShape', name: 'Wild Shape (elemental 1/day)' },
        { level: 18, id: 'wildShape', name: 'Wild Shape 6/day' },
        { level: 18, id: 'wildShape', name: 'Wild Shape (elemental 2/day)' },
        { level: 20, id: 'wildShape', name: 'Wild Shape (elemental 3/day, Huge)' },
      ],
      spellsPerDay: [
        null,                             // 0 - unused
        [3, 1],                           // 1
        [4, 2],                           // 2
        [4, 2, 1],                        // 3
        [5, 3, 2],                        // 4
        [5, 3, 2, 1],                     // 5
        [5, 3, 3, 2],                     // 6
        [6, 4, 3, 2, 1],                  // 7
        [6, 4, 3, 3, 2],                  // 8
        [6, 4, 4, 3, 2, 1],               // 9
        [6, 4, 4, 3, 3, 2],               // 10
        [6, 5, 4, 4, 3, 2, 1],            // 11
        [6, 5, 4, 4, 3, 3, 2],            // 12
        [6, 5, 5, 4, 4, 3, 2, 1],         // 13
        [6, 5, 5, 4, 4, 3, 3, 2],         // 14
        [6, 5, 5, 5, 4, 4, 3, 2, 1],      // 15
        [6, 5, 5, 5, 4, 4, 3, 3, 2],      // 16
        [6, 5, 5, 5, 5, 4, 4, 3, 2, 1],   // 17
        [6, 5, 5, 5, 5, 4, 4, 3, 3, 2],   // 18
        [6, 5, 5, 5, 5, 5, 4, 4, 3, 3],   // 19
        [6, 5, 5, 5, 5, 5, 4, 4, 4, 4],   // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    },

    // ── Bard ─────────────────────────────────────────────────────────────
    {
      id: 'bard',
      name: 'Bard',
      type: 'base',
      hitDie: 6,
      babProgression: '3/4',
      goodSaves: ['ref', 'will'],
      skillPoints: 6,
      classSkills: ['appraise', 'balance', 'bluff', 'climb', 'concentration', 'craft', 'decipherScript', 'diplomacy', 'disguise', 'escapeArtist', 'gatherInformation', 'hide', 'jump', 'knowledgeAll', 'listen', 'moveSilently', 'perform', 'profession', 'senseMotive', 'sleightOfHand', 'speak', 'spellcraft', 'swim', 'tumble', 'useMagicDevice'],
      proficiencies: { weapons: ['simple', 'longSword', 'rapier', 'sap', 'shortSword', 'shortbow', 'whip'], armor: ['light', 'shield'] },
      spellcasting: { type: 'arcane', progression: 'two-thirds', abilityScore: 'cha', prepared: false, spellSchools: ['enchantment', 'illusion', 'divination'] },
      features: [
        { level: 1, id: 'bardicMusic', name: 'Bardic Music' },
        { level: 1, id: 'bardicKnowledge', name: 'Bardic Knowledge' },
        { level: 1, id: 'countersong', name: 'Countersong' },
        { level: 1, id: 'fascinate', name: 'Fascinate' },
        { level: 1, id: 'inspireCourage', name: 'Inspire Courage +1' },
        { level: 3, id: 'inspireCompetence', name: 'Inspire Competence' },
        { level: 6, id: 'suggestion', name: 'Suggestion' },
        { level: 8, id: 'inspireCourage', name: 'Inspire Courage +2' },
        { level: 9, id: 'inspireGreatness', name: 'Inspire Greatness' },
        { level: 12, id: 'songOfFreedom', name: 'Song of Freedom' },
        { level: 14, id: 'inspireCourage', name: 'Inspire Courage +3' },
        { level: 15, id: 'inspireHeroics', name: 'Inspire Heroics' },
        { level: 18, id: 'massSuggestion', name: 'Mass Suggestion' },
        { level: 20, id: 'inspireCourage', name: 'Inspire Courage +4' },
      ],
      spellsPerDay: [
        null,                    // 0 - unused
        [2],                     // 1  (0th only)
        [3, 0],                  // 2
        [3, 1],                  // 3
        [3, 2, 0],               // 4
        [3, 3, 1],               // 5
        [3, 3, 2],               // 6
        [3, 3, 2, 0],            // 7
        [3, 3, 3, 1],            // 8
        [3, 3, 3, 2],            // 9
        [3, 3, 3, 2, 0],         // 10
        [3, 3, 3, 3, 1],         // 11
        [3, 3, 3, 3, 2],         // 12
        [3, 3, 3, 3, 2, 0],      // 13
        [4, 3, 3, 3, 3, 1],      // 14
        [4, 4, 3, 3, 3, 2],      // 15
        [4, 4, 4, 3, 3, 2, 0],   // 16
        [4, 4, 4, 4, 3, 3, 1],   // 17
        [4, 4, 4, 4, 4, 3, 2],   // 18
        [4, 4, 4, 4, 4, 4, 3],   // 19
        [4, 4, 4, 4, 4, 4, 4],   // 20
      ],
      prerequisites: null,
      source: 'core/Players-Handbook',
    }

  );
})();
