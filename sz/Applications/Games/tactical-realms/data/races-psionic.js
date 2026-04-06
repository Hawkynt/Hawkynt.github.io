;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatures || (TR._pending.creatures = []);
  TR._pending.creatures.push(

    // -----------------------------------------------------------------------
    //  Expanded Psionics Handbook -- 6 psionic playable races
    // -----------------------------------------------------------------------

    // Elan -- XPH p9
    {
      id: 'elan', name: 'Elan',
      type: 'aberration', subtypes: ['psionic'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'naturally_psionic', 'resistance',
        'resilience', 'repletion',
        'aberration_type'
      ],
      languages: ['Common'],
      favoredClass: 'psion',
      playable: true, availability: 'psionic',
      source: 'psionic/Expanded-Psionics-Handbook',
      passMode: 0b00001
    },

    // Maenad -- XPH p11
    {
      id: 'maenad', name: 'Maenad',
      type: 'humanoid', subtypes: ['maenad', 'psionic'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'naturally_psionic', 'energy_ray_pla',
        'outburst', 'sonic_affinity'
      ],
      languages: ['Common', 'Maenad'],
      favoredClass: 'wilder',
      playable: true, availability: 'psionic',
      source: 'psionic/Expanded-Psionics-Handbook',
      passMode: 0b00001
    },

    // Xeph -- XPH p13
    {
      id: 'xeph', name: 'Xeph',
      type: 'humanoid', subtypes: ['xeph', 'psionic'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'naturally_psionic', 'burst',
        'darkvision_60', 'power_resistance'
      ],
      languages: ['Common', 'Xeph'],
      favoredClass: 'soulknife',
      playable: true, availability: 'psionic',
      source: 'psionic/Expanded-Psionics-Handbook',
      passMode: 0b00001
    },

    // Dromite -- XPH p6
    {
      id: 'dromite', name: 'Dromite',
      type: 'monstrous_humanoid', subtypes: ['psionic'],
      size: 'Small', speed: { land: 20 },
      abilityMods: { str: -2, dex: 0, con: 0, int: 0, wis: 0, cha: 2 },
      naturalArmor: 3, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 0,
      traits: [
        'naturally_psionic', 'energy_ray_pla',
        'small_size', 'chitin', 'scent',
        'compound_eyes', 'blindsense_30'
      ],
      languages: ['Common'],
      favoredClass: 'wilder',
      playable: true, availability: 'psionic',
      source: 'psionic/Expanded-Psionics-Handbook',
      passMode: 0b00001
    },

    // Half-Giant -- XPH p12
    {
      id: 'half-giant', name: 'Half-Giant',
      type: 'giant', subtypes: ['psionic'],
      size: 'Medium', speed: { land: 30 },
      abilityMods: { str: 2, dex: 0, con: 2, int: 0, wis: 0, cha: -2 },
      naturalArmor: 0, hitDie: null, racialHD: 0,
      bab: null, baseSaves: null,
      cr: null, la: 1,
      traits: [
        'naturally_psionic', 'stomp_pla',
        'powerful_build', 'fire_acclimated',
        'low_light_vision'
      ],
      languages: ['Common'],
      favoredClass: 'psychic_warrior',
      playable: true, availability: 'psionic',
      source: 'psionic/Expanded-Psionics-Handbook',
      passMode: 0b00001
    },

    // Thri-kreen -- XPH p15
    {
      id: 'thri-kreen', name: 'Thri-kreen',
      type: 'monstrous_humanoid', subtypes: ['psionic'],
      size: 'Medium', speed: { land: 40 },
      abilityMods: { str: 2, dex: 4, con: 0, int: 0, wis: 2, cha: -2 },
      naturalArmor: 3, hitDie: 8, racialHD: 2,
      bab: 2, baseSaves: { fort: 0, ref: 3, will: 3 },
      cr: 1, la: 2,
      traits: [
        'naturally_psionic', 'chameleon_pla',
        'darkvision_60', 'immunity_sleep',
        'natural_weapons_claws', 'natural_weapons_bite',
        'multiweapon_fighting', 'leap', 'poison_bite',
        'deflect_arrows', 'four_arms',
        'weapon_familiarity_gythka', 'weapon_familiarity_chatkcha'
      ],
      languages: ['Common', 'Kreen'],
      favoredClass: 'psychic_warrior',
      playable: true, availability: 'psionic',
      source: 'psionic/Expanded-Psionics-Handbook',
      passMode: 0b00001
    }

  );
})();
