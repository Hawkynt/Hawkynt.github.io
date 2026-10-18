/* data/tower-types.js -- the sixteen tower families with tiers and specializations, and the targeting modes.
   Reads: constants. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const { shade } = NS.constants;

  /* ══════════════════════════════════════════════════════════════════
     TOWER FAMILIES
     Stats are base values; tiers and branches multiply damage, range
     and reload and may set any special value. Range is in tiles.
     ══════════════════════════════════════════════════════════════════ */

  const MUL_KEYS = { damage: 1, range: 1, reload: 1 };

  const TOWER_TYPES = [
    {
      id: 'arrow', name: 'Archer', cost: 50, color: '#8fd16a', hits: 'both', kind: 'arrow',
      damage: 9, range: 3.6, reload: 0.7, speed: 460,
      desc: 'Quick arrows at a single target. Hits flyers.',
      strong: 'Flyers, fast enemies', weak: 'Heavy armor',
      tiers: [{}, { damage: 1.6, range: 1.08, reload: 0.92 }, { damage: 2.4, range: 1.15, reload: 0.85 }],
      branches: [
        { id: 'longbow', name: 'Longbow', desc: 'Long-range heavy shots that pierce armor and crit; spots stealth.',
          t4: { damage: 5.2, range: 1.5, reload: 1.15, pierce: 0.5, crit: 0.25, critMul: 2.5, trueSight: true },
          t5: { damage: 8.4, range: 1.65, reload: 1.1, pierce: 0.7, crit: 0.35, critMul: 3, trueSight: true } },
        { id: 'volley', name: 'Volley', desc: 'Looses arrows at three enemies at once.',
          t4: { damage: 2.9, range: 1.15, reload: 0.75, multishot: 3 },
          t5: { damage: 4.2, range: 1.2, reload: 0.68, multishot: 5 } }
      ]
    },
    {
      id: 'cannon', name: 'Cannon', cost: 80, color: '#e0894a', hits: 'ground', kind: 'shell',
      damage: 24, range: 3.0, reload: 1.5, speed: 260, splash: 1.1,
      desc: 'Lobs shells that blast every enemy near the impact.',
      strong: 'Groups, swarms', weak: 'Flyers (cannot hit them)',
      tiers: [{}, { damage: 1.6, range: 1.05, reload: 0.95 }, { damage: 2.4, range: 1.1, splash: 1.25, reload: 0.9 }],
      branches: [
        { id: 'bombard', name: 'Bombard', desc: 'Huge shells with a wide blast that briefly stuns.',
          t4: { damage: 5.2, range: 1.2, reload: 1.3, splash: 1.6, stun: 0.35 },
          t5: { damage: 8.0, range: 1.3, reload: 1.2, splash: 1.9, stun: 0.5 } },
        { id: 'shrapnel', name: 'Shrapnel', desc: 'Shells burst into bomblets that shred armor.',
          t4: { damage: 3.6, reload: 0.9, splash: 1.25, bomblets: 5, shred: 2 },
          t5: { damage: 5.2, reload: 0.85, splash: 1.35, bomblets: 8, shred: 4 } }
      ]
    },
    {
      id: 'frost', name: 'Frost', cost: 70, color: '#7fd4ff', hits: 'both', kind: 'bolt',
      damage: 5, range: 3.0, reload: 1.0, speed: 320, slow: 0.4, slowTime: 2,
      desc: 'Ice bolts slow their target down.',
      strong: 'Fast enemies, bosses', weak: 'Low damage',
      tiers: [{}, { damage: 1.6, range: 1.08, slow: 0.45 }, { damage: 2.2, range: 1.15, slow: 0.5, slowTime: 2.5 }],
      branches: [
        { id: 'glacier', name: 'Glacier', desc: 'Bolts may freeze enemies solid; frozen enemies shatter for extra damage.',
          t4: { damage: 4, range: 1.2, slow: 0.5, slowTime: 2.5, freeze: 0.2, freezeTime: 1.4 },
          t5: { damage: 6.5, range: 1.25, slow: 0.55, slowTime: 3, freeze: 0.33, freezeTime: 1.8 } },
        { id: 'blizzard', name: 'Blizzard', desc: 'A freezing storm slows everything in range.',
          t4: { damage: 2.6, range: 1.05, reload: 0.9, slow: 0.5, slowTime: 1.2, aura: true },
          t5: { damage: 4.2, range: 1.15, reload: 0.8, slow: 0.62, slowTime: 1.4, aura: true } }
      ]
    },
    {
      id: 'tesla', name: 'Tesla', cost: 120, color: '#7ae8ff', hits: 'both', kind: 'chain',
      damage: 16, range: 2.8, reload: 1.15, chains: 3, chainRange: 2.0,
      desc: 'Lightning jumps between enemies. Double damage to shields.',
      strong: 'Shields, packs', weak: 'Lone tough targets',
      tiers: [{}, { damage: 1.55, range: 1.05 }, { damage: 2.2, range: 1.1, chains: 4 }],
      branches: [
        { id: 'storm', name: 'Storm Spire', desc: 'Bolts arc through many more enemies.',
          t4: { damage: 3.0, range: 1.15, chains: 7, chainRange: 2.4 },
          t5: { damage: 4.2, range: 1.2, chains: 10, chainRange: 2.8 } },
        { id: 'overload', name: 'Overload', desc: 'Massive bolts that stun what they hit.',
          t4: { damage: 4.4, range: 1.1, reload: 1.1, chains: 3, stun: 0.6 },
          t5: { damage: 6.8, range: 1.15, reload: 1.05, chains: 4, stun: 0.9 } }
      ]
    },
    {
      id: 'flame', name: 'Flamer', cost: 100, color: '#ff8a3a', hits: 'ground', kind: 'flame',
      damage: 4, range: 2.0, reload: 0.15, cone: 0.5, burn: 6, burnTime: 2.5,
      desc: 'Short-range jet of fire that burns everything in its cone.',
      strong: 'Swarms, groups', weak: 'Flyers, range',
      tiers: [{}, { damage: 1.55, range: 1.05, burn: 9 }, { damage: 2.2, range: 1.1, burn: 13 }],
      branches: [
        { id: 'inferno', name: 'Inferno', desc: 'Leaves pools of burning ground on the path.',
          t4: { damage: 3.0, range: 1.15, burn: 18, lava: 14 },
          t5: { damage: 4.2, range: 1.2, burn: 26, lava: 22 } },
        { id: 'dragon', name: 'Dragon Breath', desc: 'Longer flames that melt armor.',
          t4: { damage: 3.2, range: 1.5, burn: 16, melt: 3, cone: 0.42 },
          t5: { damage: 4.6, range: 1.7, burn: 22, melt: 6, cone: 0.42 } }
      ]
    },
    {
      id: 'poison', name: 'Venom', cost: 90, color: '#7ce35a', hits: 'both', kind: 'glob',
      damage: 4, range: 3.0, reload: 1.6, speed: 240, cloud: 0.9, cloudTime: 3, cloudDps: 9,
      desc: 'Toxic clouds that ignore armor and shields.',
      strong: 'Armor, shields', weak: 'Fast enemies',
      tiers: [{}, { damage: 1.5, range: 1.05, cloudDps: 14 }, { damage: 2.1, range: 1.1, cloudDps: 20, cloud: 1.0 }],
      branches: [
        { id: 'plague', name: 'Plague', desc: 'Poisoned enemies burst into new clouds when they die.',
          t4: { damage: 3, range: 1.15, cloudDps: 30, cloud: 1.1, plague: true },
          t5: { damage: 4, range: 1.2, cloudDps: 44, cloud: 1.2, plague: true } },
        { id: 'acid', name: 'Acid', desc: 'Corrodes armor and makes enemies take more damage.',
          t4: { damage: 3, range: 1.15, cloudDps: 26, cloud: 1.05, acid: true },
          t5: { damage: 4, range: 1.2, cloudDps: 38, cloud: 1.15, acid: true } }
      ]
    },
    {
      id: 'laser', name: 'Laser', cost: 150, color: '#ff5ad2', hits: 'both', kind: 'beam',
      damage: 22, range: 3.2, reload: 0, ramp: 2.5, rampTime: 2.2, pierce: 0.5,
      desc: 'Continuous beam that heats up on the same target. Half ignores armor.',
      strong: 'Bosses, armor', weak: 'Swarms',
      tiers: [{}, { damage: 1.5, range: 1.05 }, { damage: 2.1, range: 1.1, ramp: 3 }],
      branches: [
        { id: 'prism', name: 'Prism', desc: 'Splits into three beams.',
          t4: { damage: 2.4, range: 1.15, beams: 3, ramp: 2.5 },
          t5: { damage: 3.4, range: 1.2, beams: 4, ramp: 2.8 } },
        { id: 'solar', name: 'Solar Lance', desc: 'Searing beam that ramps far higher.',
          t4: { damage: 2.8, range: 1.25, ramp: 5, rampTime: 2.6, pierce: 0.8 },
          t5: { damage: 4.0, range: 1.35, ramp: 7, rampTime: 2.8, pierce: 1 } }
      ]
    },
    {
      id: 'sniper', name: 'Sniper', cost: 160, color: '#e8e8f0', hits: 'both', kind: 'snipe',
      damage: 70, range: 6.0, reload: 3.0, pierce: 0.6, trueSight: true,
      desc: 'Very long range, heavy single shots. Spots stealthed enemies.',
      strong: 'Stealth, healers, bosses', weak: 'Swarms',
      tiers: [{}, { damage: 1.5, range: 1.05, reload: 0.95 }, { damage: 2.1, range: 1.1, reload: 0.9 }],
      branches: [
        { id: 'railgun', name: 'Railgun', desc: 'Slugs pierce every enemy along the line.',
          t4: { damage: 3.2, range: 1.15, reload: 0.95, rail: true, pierce: 1 },
          t5: { damage: 4.6, range: 1.25, reload: 0.9, rail: true, pierce: 1 } },
        { id: 'assassin', name: 'Assassin', desc: 'Crits often and executes weakened enemies.',
          t4: { damage: 3.0, range: 1.15, reload: 0.75, crit: 0.3, critMul: 2.5, execute: 0.2 },
          t5: { damage: 4.4, range: 1.2, reload: 0.7, crit: 0.4, critMul: 3, execute: 0.3 } }
      ]
    },
    {
      id: 'spikes', name: 'Spikes', cost: 30, color: '#b8c0cc', hits: 'ground', kind: 'trap', trap: true,
      damage: 12, range: 0.5, reload: 0,
      desc: 'Trap on the path; hurts every enemy walking over it.',
      strong: 'Chokepoints, swarms', weak: 'Flyers',
      tiers: [{}, { damage: 1.7 }, { damage: 2.6 }],
      branches: [
        { id: 'tar', name: 'Tar Pit', desc: 'Sticky tar slows enemies crossing it.',
          t4: { damage: 3.4, slow: 0.45, slowTime: 0.6 },
          t5: { damage: 4.8, slow: 0.6, slowTime: 0.8 } },
        { id: 'razor', name: 'Razor Field', desc: 'Blades that tear through armor.',
          t4: { damage: 6, pierce: 1 },
          t5: { damage: 9, pierce: 1 } }
      ]
    },
    {
      id: 'mine', name: 'Gold Mine', cost: 110, color: '#ffd75a', hits: 'none', kind: 'mine',
      damage: 0, range: 0, reload: 0, income: 14,
      desc: 'Digs up gold at the end of every wave.',
      strong: 'Economy', weak: 'Cannot attack',
      tiers: [{}, { income: 24 }, { income: 36 }],
      branches: [
        { id: 'bank', name: 'Bank', desc: 'Pays interest on the gold you keep (up to a limit).',
          t4: { income: 40, interest: 0.03, interestCap: 60 },
          t5: { income: 50, interest: 0.05, interestCap: 110 } },
        { id: 'alchemist', name: 'Alchemist', desc: 'Enemies dying nearby drop extra gold.',
          t4: { income: 40, range: 3, bounty: 2 },
          t5: { income: 50, range: 3.5, bounty: 4 } }
      ]
    }
  ];

  // Families added later; they follow the first ten so old hotkeys stay put
  TOWER_TYPES.push(
    {
      id: 'mortar', name: 'Mortar', cost: 120, color: '#c8a070', hits: 'ground', kind: 'shell',
      damage: 38, range: 6.0, reload: 3.0, speed: 170, splash: 1.5, minRange: 1.6,
      desc: 'Very long range artillery with a wide blast; cannot hit what stands right next to it.',
      strong: 'Packs far down the road', weak: 'Flyers, enemies at its feet',
      tiers: [{}, { damage: 1.6, range: 1.05 }, { damage: 2.4, range: 1.1, splash: 1.7 }],
      branches: [
        { id: 'barrage', name: 'Barrage', desc: 'Fires a salvo of three shells.',
          t4: { damage: 3.0, range: 1.15, reload: 0.95, salvo: 3 },
          t5: { damage: 4.4, range: 1.2, reload: 0.9, salvo: 4 } },
        { id: 'incendiary', name: 'Incendiary', desc: 'Shells leave the road burning.',
          t4: { damage: 4.2, range: 1.15, splash: 1.8, lava: 18 },
          t5: { damage: 6.2, range: 1.2, splash: 2.0, lava: 30 } }
      ]
    },
    {
      id: 'storm', name: 'Storm', cost: 130, color: '#b8a0ff', hits: 'both', kind: 'skybolt', target: 'strong',
      damage: 55, range: 4.2, reload: 2.6, splash: 0.7,
      desc: 'Calls lightning from the sky onto the strongest enemy in range.',
      strong: 'Tough targets, flyers', weak: 'Fast swarms',
      tiers: [{}, { damage: 1.6, range: 1.05 }, { damage: 2.3, range: 1.1, splash: 0.8 }],
      branches: [
        { id: 'thunderhead', name: 'Thunderhead', desc: 'Each storm hurls several bolts.',
          t4: { damage: 3.4, range: 1.15, bolts: 3 },
          t5: { damage: 4.8, range: 1.2, bolts: 5 } },
        { id: 'static', name: 'Static Field', desc: 'Bolts paralyse everything they strike.',
          t4: { damage: 3.6, range: 1.15, splash: 1.2, stun: 1.0 },
          t5: { damage: 5.0, range: 1.2, splash: 1.4, stun: 1.5 } }
      ]
    },
    {
      id: 'wind', name: 'Wind', cost: 90, color: '#a8f0e0', hits: 'both', kind: 'gust',
      damage: 4, range: 2.4, reload: 2.4, cone: 0.6, push: 34,
      desc: 'Gusts blow enemies back down the road.',
      strong: 'Buying time, runners', weak: 'Bosses (too heavy to move)',
      tiers: [{}, { damage: 1.6, range: 1.05, push: 44 }, { damage: 2.2, range: 1.1, push: 54 }],
      branches: [
        { id: 'cyclone', name: 'Cyclone', desc: 'A whirlwind that lifts enemies off their feet.',
          t4: { damage: 3.0, range: 1.15, push: 40, stun: 0.9, cone: 0.9 },
          t5: { damage: 4.2, range: 1.2, push: 50, stun: 1.3, cone: 1.1 } },
        { id: 'gale', name: 'Gale', desc: 'Storm-force gusts that hurl enemies far back.',
          t4: { damage: 3.0, range: 1.3, push: 85, reload: 0.9 },
          t5: { damage: 4.2, range: 1.4, push: 115, reload: 0.85 } }
      ]
    },
    {
      id: 'missile', name: 'Missile', cost: 140, color: '#ff6a6a', hits: 'both', kind: 'missile',
      damage: 30, range: 4.8, reload: 1.9, speed: 230, splash: 0.7, airBonus: 1.6,
      desc: 'Homing rockets that seek flyers first; extra damage against them.',
      strong: 'Flyers, wyverns, dragons', weak: 'Armor',
      tiers: [{}, { damage: 1.6, range: 1.05 }, { damage: 2.3, range: 1.1 }],
      branches: [
        { id: 'swarm', name: 'Rocket Swarm', desc: 'Launches a swarm of small rockets.',
          t4: { damage: 1.7, range: 1.15, reload: 0.9, multishot: 4 },
          t5: { damage: 2.4, range: 1.2, reload: 0.85, multishot: 6 } },
        { id: 'hellfire', name: 'Hellfire', desc: 'Heavy warheads with a fiery blast.',
          t4: { damage: 4.6, range: 1.2, splash: 1.3, burn: 14, burnTime: 2.5 },
          t5: { damage: 6.6, range: 1.25, splash: 1.5, burn: 24, burnTime: 3 } }
      ]
    },
    {
      id: 'beacon', name: 'Beacon', cost: 150, color: '#ffe08a', hits: 'none', kind: 'support',
      damage: 0, range: 2.2, reload: 0, buffDmg: 0.15, buffRate: 0.1,
      desc: 'Inspires every tower in range: they hit harder and shoot faster.',
      strong: 'Tight clusters of towers', weak: 'Cannot attack',
      tiers: [{}, { range: 1.05, buffDmg: 0.2, buffRate: 0.14 }, { range: 1.1, buffDmg: 0.25, buffRate: 0.18 }],
      branches: [
        { id: 'drum', name: 'War Drum', desc: 'A thundering rhythm: much more damage.',
          t4: { range: 1.15, buffDmg: 0.4, buffRate: 0.2 },
          t5: { range: 1.2, buffDmg: 0.55, buffRate: 0.25 } },
        { id: 'oracle', name: 'Oracle', desc: 'Wider reach; towers in range spot stealthed enemies.',
          t4: { range: 1.45, buffDmg: 0.25, buffRate: 0.2, reveal: true },
          t5: { range: 1.65, buffDmg: 0.32, buffRate: 0.25, reveal: true } }
      ]
    },
    {
      id: 'arcane', name: 'Arcane', cost: 160, color: '#e070ff', hits: 'both', kind: 'orb', target: 'strong',
      damage: 12, range: 3.4, reload: 1.5, speed: 190, maxHpDmg: 0.02,
      desc: 'Orbs that ignore armor and shields and burn a share of the target\'s maximum health.',
      strong: 'Bosses, juggernauts', weak: 'Many weak enemies',
      tiers: [{}, { damage: 1.5, range: 1.05, maxHpDmg: 0.025 }, { damage: 2.0, range: 1.1, maxHpDmg: 0.03 }],
      branches: [
        { id: 'disintegrate', name: 'Disintegrate', desc: 'Orbs eat a much larger share of maximum health.',
          t4: { damage: 2.6, range: 1.15, maxHpDmg: 0.05 },
          t5: { damage: 3.4, range: 1.2, maxHpDmg: 0.075 } },
        { id: 'ricochet', name: 'Ricochet', desc: 'Orbs bounce on to further enemies.',
          t4: { damage: 2.6, range: 1.15, bounces: 3 },
          t5: { damage: 3.6, range: 1.2, bounces: 5 } }
      ]
    }
  );
  const TOWER_BY_ID = {};
  for (let i = 0; i < TOWER_TYPES.length; ++i) {
    TOWER_TYPES[i].index = i;
    TOWER_BY_ID[TOWER_TYPES[i].id] = TOWER_TYPES[i];
    TOWER_TYPES[i].colorDark = shade(TOWER_TYPES[i].color, -0.45);
  }

  // Upgrade cost to reach tier n (index n), as a multiple of the build cost
  const TIER_COST = [0, 0, 0.7, 1.1, 1.8, 2.8];

  const TARGET_MODES = ['first', 'last', 'strong', 'close'];
  const TARGET_LABELS = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };
  const TARGET_DESC = {
    first: 'The enemy furthest along the path',
    last: 'The enemy that just entered the range',
    strong: 'The enemy with the most health',
    close: 'The enemy nearest to the tower'
  };

  NS.towerTypes = { MUL_KEYS, TOWER_TYPES, TOWER_BY_ID, TIER_COST, TARGET_MODES, TARGET_LABELS, TARGET_DESC };

})();
