;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).classes || (TR._pending.classes = []);
  TR._pending.classes.push(

    // ── Incarnate (Magic of Incarnum) ───────────────────────────────────
    {
      id: 'incarnate',
      name: 'Incarnate',
      type: 'base',
      hitDie: 6,
      babProgression: '3/4',
      goodSaves: ['fort', 'will'],
      skillPoints: 4,
      classSkills: ['concentration', 'craft', 'diplomacy', 'heal', 'knowledgeArcana', 'knowledgePlanes', 'knowledgeReligion', 'profession', 'spellcraft'],
      proficiencies: { weapons: ['simple'], armor: ['light'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'aura', name: 'Aura (alignment)' },
        { level: 1, id: 'detectOpposed', name: 'Detect Opposed Alignment' },
        { level: 1, id: 'meldshaping', name: 'Meldshaping' },
        { level: 2, id: 'chakraBinds', name: 'Chakra Bind (crown)' },
        { level: 3, id: 'expandedSoulmeld', name: 'Expanded Soulmeld Capacity +1' },
        { level: 4, id: 'chakraBinds', name: 'Chakra Bind (feet, hands)' },
        { level: 6, id: 'rapidMeldshaping', name: 'Rapid Meldshaping 1/day' },
        { level: 7, id: 'expandedSoulmeld', name: 'Expanded Soulmeld Capacity +2' },
        { level: 9, id: 'chakraBinds', name: 'Chakra Bind (arms, brow, shoulders)' },
        { level: 10, id: 'incarnumRadiance', name: 'Incarnum Radiance' },
        { level: 11, id: 'expandedSoulmeld', name: 'Expanded Soulmeld Capacity +3' },
        { level: 12, id: 'rapidMeldshaping', name: 'Rapid Meldshaping 2/day' },
        { level: 14, id: 'chakraBinds', name: 'Chakra Bind (throat, waist)' },
        { level: 15, id: 'expandedSoulmeld', name: 'Expanded Soulmeld Capacity +4' },
        { level: 18, id: 'rapidMeldshaping', name: 'Rapid Meldshaping 3/day' },
        { level: 19, id: 'chakraBinds', name: 'Chakra Bind (heart)' },
        { level: 20, id: 'perfectMeldshaper', name: 'Perfect Meldshaper' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'supplement/Magic-of-Incarnum',
    },

    // ── Soulborn (Magic of Incarnum) ────────────────────────────────────
    {
      id: 'soulborn',
      name: 'Soulborn',
      type: 'base',
      hitDie: 10,
      babProgression: 'full',
      goodSaves: ['fort'],
      skillPoints: 2,
      classSkills: ['climb', 'concentration', 'craft', 'intimidate', 'jump', 'knowledgeArcana', 'profession', 'ride', 'swim'],
      proficiencies: { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shield'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'aura', name: 'Aura (alignment)' },
        { level: 1, id: 'smiteOpposed', name: 'Smite Opposed Alignment 1/day' },
        { level: 2, id: 'meldshaping', name: 'Meldshaping' },
        { level: 3, id: 'incarnumDefense', name: 'Incarnum Defense' },
        { level: 4, id: 'chakraBinds', name: 'Chakra Bind (crown)' },
        { level: 5, id: 'smiteOpposed', name: 'Smite Opposed Alignment 2/day' },
        { level: 8, id: 'chakraBinds', name: 'Chakra Bind (feet, hands)' },
        { level: 10, id: 'smiteOpposed', name: 'Smite Opposed Alignment 3/day' },
        { level: 12, id: 'chakraBinds', name: 'Chakra Bind (arms, brow, shoulders)' },
        { level: 15, id: 'smiteOpposed', name: 'Smite Opposed Alignment 4/day' },
        { level: 16, id: 'chakraBinds', name: 'Chakra Bind (throat, waist)' },
        { level: 20, id: 'smiteOpposed', name: 'Smite Opposed Alignment 5/day' },
        { level: 20, id: 'chakraBinds', name: 'Chakra Bind (heart)' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'supplement/Magic-of-Incarnum',
    },

    // ── Totemist (Magic of Incarnum) ────────────────────────────────────
    {
      id: 'totemist',
      name: 'Totemist',
      type: 'base',
      hitDie: 8,
      babProgression: '3/4',
      goodSaves: ['fort', 'ref'],
      skillPoints: 4,
      classSkills: ['climb', 'concentration', 'craft', 'handleAnimal', 'hide', 'jump', 'knowledgeArcana', 'knowledgeNature', 'listen', 'profession', 'ride', 'spot', 'survival', 'swim'],
      proficiencies: { weapons: ['simple'], armor: ['light'] },
      spellcasting: null,
      features: [
        { level: 1, id: 'wildEmpathy', name: 'Wild Empathy' },
        { level: 1, id: 'meldshaping', name: 'Meldshaping' },
        { level: 2, id: 'totemChakraBind', name: 'Totem Chakra Bind +1' },
        { level: 3, id: 'chakraBinds', name: 'Chakra Bind (crown, feet, hands)' },
        { level: 5, id: 'totemChakraBind', name: 'Totem Chakra Bind +2' },
        { level: 7, id: 'chakraBinds', name: 'Chakra Bind (arms, brow, shoulders)' },
        { level: 9, id: 'totemChakraBind', name: 'Totem Chakra Bind +3' },
        { level: 11, id: 'chakraBinds', name: 'Chakra Bind (throat, waist)' },
        { level: 13, id: 'totemChakraBind', name: 'Totem Chakra Bind +4' },
        { level: 15, id: 'rebindTotemSoulmeld', name: 'Rebind Totem Soulmeld 1/day' },
        { level: 17, id: 'totemChakraBind', name: 'Totem Chakra Bind +5' },
        { level: 19, id: 'chakraBinds', name: 'Chakra Bind (heart)' },
        { level: 20, id: 'perfectTotemist', name: 'Perfect Totemist' },
      ],
      spellsPerDay: null,
      prerequisites: null,
      source: 'supplement/Magic-of-Incarnum',
    }

  );
})();
