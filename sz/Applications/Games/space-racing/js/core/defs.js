/*
 * Game data: ships, the old upgrade table (save migration), the Workshop tree, AI
 * personalities, the career cups, tutorial pages, theme colors and the reverse-track
 * variant builder. Owns no state; reads SZ.RacingTracks.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;

  const SHIP_DEFS = [
    {
      id: 'falcon',
      name: 'Star Falcon',
      description: 'Balanced all-rounder. Good for beginners.',
      color: '#4af',
      accentColor: '#27d',
      exhaustColor: '#48f',
      stats: { speed: 1.0, accel: 1.0, handling: 1.0, boost: 1.0 },
      shape: 'arrow',
      unlock: { free: true }
    },
    {
      id: 'viper',
      name: 'Neon Viper',
      description: 'Blazing fast but drifts on turns.',
      color: '#f44',
      accentColor: '#a22',
      exhaustColor: '#f84',
      stats: { speed: 1.25, accel: 0.9, handling: 0.7, boost: 1.1 },
      shape: 'dart',
      unlock: { trophy: 'bronze' }
    },
    {
      id: 'mantis',
      name: 'Void Mantis',
      description: 'Nimble and quick to accelerate. Fragile top speed.',
      color: '#4f4',
      accentColor: '#2a2',
      exhaustColor: '#8f4',
      stats: { speed: 0.85, accel: 1.3, handling: 1.25, boost: 0.9 },
      shape: 'wing',
      unlock: { price: 1500 }
    },
    {
      id: 'titan',
      name: 'Iron Titan',
      description: 'Slow starter but unstoppable at max speed.',
      color: '#fa0',
      accentColor: '#a70',
      exhaustColor: '#fc0',
      stats: { speed: 1.15, accel: 0.7, handling: 0.85, boost: 1.3 },
      shape: 'heavy',
      unlock: { trophy: 'silver' }
    },
    {
      id: 'phantom',
      name: 'Ghost Phantom',
      description: 'Excellent handling and boost. Lower raw speed.',
      color: '#c4f',
      accentColor: '#82a',
      exhaustColor: '#d8f',
      stats: { speed: 0.9, accel: 1.05, handling: 1.35, boost: 1.25 },
      shape: 'stealth',
      unlock: { trophy: 'gold' }
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     UPGRADE DEFINITIONS
     ══════════════════════════════════════════════════════════════════ */

  const UPGRADE_DEFS = [
    {
      id: 'engine',
      name: 'Engine',
      stat: 'speed',
      icon: 'SPD',
      maxLevel: 5,
      costBase: 200,
      costScale: 1.5,
      bonusPerLevel: 0.06
    },
    {
      id: 'thruster',
      name: 'Thruster',
      stat: 'accel',
      icon: 'ACC',
      maxLevel: 5,
      costBase: 180,
      costScale: 1.5,
      bonusPerLevel: 0.07
    },
    {
      id: 'gyro',
      name: 'Gyroscope',
      stat: 'handling',
      icon: 'HND',
      maxLevel: 5,
      costBase: 160,
      costScale: 1.4,
      bonusPerLevel: 0.06
    },
    {
      id: 'nitro',
      name: 'Nitro Tank',
      stat: 'boost',
      icon: 'BST',
      maxLevel: 5,
      costBase: 250,
      costScale: 1.6,
      bonusPerLevel: 0.08
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     WORKSHOP TECH TREE -- five branches of leveled upgrades bought with credits
     ══════════════════════════════════════════════════════════════════ */

  const TREE = {
    branches: [
      { id: 'engine', name: 'Engine', color: '#ff7a3a' },
      { id: 'handling', name: 'Handling', color: '#5ab8ff' },
      { id: 'hull', name: 'Hull', color: '#6fe08a' },
      { id: 'boost', name: 'Boost', color: '#c04cff' },
      { id: 'arsenal', name: 'Arsenal', color: '#ffd75a' }
    ],
    nodes: [
      { id: 'e_speed', branch: 'engine', name: 'Ion Drive', desc: '+4% top speed per level', costs: [300, 450, 700, 1000, 1500], req: [] },
      { id: 'e_accel', branch: 'engine', name: 'Thruster Array', desc: '+5% acceleration per level', costs: [250, 400, 600, 900, 1300], req: [] },
      { id: 'e_fusion', branch: 'engine', name: 'Fusion Core', desc: '+6% top speed and acceleration', costs: [3000], req: [['e_speed', 3], ['e_accel', 3]], trophy: 'silver' },

      { id: 'h_gyro', branch: 'handling', name: 'Gyro Stabilizers', desc: '+5% steering per level', costs: [250, 400, 600, 900, 1300], req: [] },
      { id: 'h_drift', branch: 'handling', name: 'Drift Coils', desc: 'Drifts charge 15% faster per level', costs: [500, 900, 1400], req: [['h_gyro', 1]] },
      { id: 'h_grip', branch: 'handling', name: 'Magnetic Grip', desc: '30% less drag off the road per level', costs: [600, 1100], req: [['h_gyro', 2]] },

      { id: 'u_armor', branch: 'hull', name: 'Reinforced Hull', desc: 'Spin-outs 15% shorter per level', costs: [400, 800, 1300], req: [] },
      { id: 'u_bumper', branch: 'hull', name: 'Shock Bumpers', desc: 'Keep 25% more speed when hitting the barrier', costs: [500, 1000], req: [['u_armor', 1]] },
      { id: 'u_shield', branch: 'hull', name: 'Shield Emitter', desc: 'Shields last 3 s longer per level', costs: [450, 850, 1300], req: [['u_armor', 1]] },

      { id: 'b_tank', branch: 'boost', name: 'Nitro Tank', desc: '+6% boost power per level', costs: [300, 450, 700, 1000, 1500], req: [] },
      { id: 'b_cap', branch: 'boost', name: 'Boost Capacitor', desc: 'Boost meter fills 15% faster per level', costs: [500, 900, 1400], req: [['b_tank', 1]] },
      { id: 'b_burn', branch: 'boost', name: 'Efficient Burners', desc: 'Manual boost costs 5 less per level', costs: [800, 1400], req: [['b_cap', 1]] },
      { id: 'b_launch', branch: 'boost', name: 'Launch Control', desc: 'Wider perfect-start window and a longer launch', costs: [900], req: [['b_tank', 2]] },

      { id: 'a_luck', branch: 'arsenal', name: 'Lucky Charms', desc: 'Better items from item boxes', costs: [400, 800, 1200], req: [] },
      { id: 'a_homing', branch: 'arsenal', name: 'Smart Missiles', desc: 'Missiles turn 40% faster per level', costs: [600, 1100], req: [['a_luck', 1]] },
      { id: 'a_emp', branch: 'arsenal', name: 'Wide EMP', desc: '+100 EMP radius per level', costs: [600, 1100], req: [['a_luck', 1]] },
      { id: 'a_twin', branch: 'arsenal', name: 'Twin Mines', desc: 'Mines drop in pairs', costs: [1200], req: [['a_luck', 2]] },
      { id: 'a_rack', branch: 'arsenal', name: 'Item Rack', desc: 'Carry a second item', costs: [2500], req: [['a_luck', 3]], trophy: 'gold' }
    ]
  };

  /* ══════════════════════════════════════════════════════════════════
     AI RACER PERSONALITIES (visually distinct, unique behaviors)
     ══════════════════════════════════════════════════════════════════ */

  const AI_PERSONALITIES = [
    {
      name: 'Blaze',
      color: '#f55',
      accentColor: '#c22',
      exhaustColor: '#f80',
      shape: 'dart',
      speedBias: 1.05,
      turnBias: 0.85,
      aggressiveness: 0.6,
      mistakeRate: 1.2,
      lane: -0.8
    },
    {
      name: 'Comet',
      color: '#fa0',
      accentColor: '#a70',
      exhaustColor: '#ff4',
      shape: 'wing',
      speedBias: 0.9,
      turnBias: 1.1,
      aggressiveness: 0.4,
      mistakeRate: 0.8,
      lane: 0.4
    },
    {
      name: 'Nebula',
      color: '#5f5',
      accentColor: '#2a2',
      exhaustColor: '#8f8',
      shape: 'heavy',
      speedBias: 0.95,
      turnBias: 0.95,
      aggressiveness: 0.5,
      mistakeRate: 1.0,
      lane: 0
    },
    {
      name: 'Pulse',
      color: '#f5f',
      accentColor: '#a2a',
      exhaustColor: '#faf',
      shape: 'stealth',
      speedBias: 0.85,
      turnBias: 1.15,
      aggressiveness: 0.3,
      mistakeRate: 1.4,
      lane: 0.9
    },
    {
      name: 'Drift',
      color: '#5ff',
      accentColor: '#2aa',
      exhaustColor: '#8ff',
      shape: 'arrow',
      speedBias: 1.0,
      turnBias: 1.0,
      aggressiveness: 0.5,
      mistakeRate: 1.1,
      lane: -0.3
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     TRACKS (large loops from tracks-data.js, built by track-geometry.js)
     ══════════════════════════════════════════════════════════════════ */

  const TRACKS = SZ.RacingTracks;

  /* ══════════════════════════════════════════════════════════════════
     CAREER -- four cups of four races, championship points per race
     ══════════════════════════════════════════════════════════════════ */

  /* races entries are [TRACKS index, reverse]; ai scales the field, reward the credits */
  const CUPS = [
    { id: 'bronze', name: 'Bronze Cup', color: '#d08a4a', ai: 0.92, reward: 1.0, races: [[0, false], [2, false], [3, false], [6, false]] },
    { id: 'silver', name: 'Silver Cup', color: '#c8d0e0', ai: 1.0, reward: 1.4, races: [[1, false], [4, false], [5, false], [7, false]] },
    { id: 'gold', name: 'Gold Cup', color: '#ffd75a', ai: 1.06, reward: 1.9, races: [[0, true], [3, true], [4, true], [7, true]] },
    { id: 'platinum', name: 'Platinum Cup', color: '#9fe8ff', ai: 1.12, reward: 2.5, races: [[2, true], [1, true], [5, true], [6, true]] }
  ];
  const CUP_POINTS = [10, 6, 4, 3];
  const CUP_RACES = 4;
  const TROPHY_RANK = { bronze: 1, silver: 2, gold: 3 };

  /* A racing track: the base definition, plus a reversed variant that keeps the
     start line where it is and runs the lap the other way round. Features move
     to the matching point of the lap (t -> 1 - t) and to the mirrored side. */
  function trackVariant(index, reverse) {
    const base = TRACKS[index];
    const variant = Object.assign({}, base);
    variant.key = base.name + (reverse ? ' R' : '');
    variant.displayName = base.name + (reverse ? ' (Reverse)' : '');
    variant.reverse = !!reverse;
    variant.baseIndex = index;
    if (reverse) {
      const cp = base.controlPoints;
      const points = [cp[0]];
      for (let i = cp.length - 1; i >= 1; --i)
        points.push(cp[i]);
      variant.controlPoints = points;
      variant.boost = base.boost.map(f => [(1 - f[0]) % 1, -f[1]]);
      variant.hazards = base.hazards.map(f => [(1 - f[0]) % 1, -f[1], f[2]]);
      variant.gravity = base.gravity.map(f => [(1 - f[0]) % 1, -f[1], f[2], f[3]]);
      variant.items = base.items.map(t => (1 - t) % 1);
      variant.wormholes = base.wormholes.map(w => [(1 - w[1]) % 1, (1 - w[0]) % 1]);
    }
    return variant;
  }

  const TUTORIAL_PAGES = [
    { title: 'Racing', lines: ['Up / W accelerates, Down / S brakes.', 'Left / Right or A / D steer.', 'Hold the mouse button to steer toward the cursor.', 'Finish all laps ahead of the AI field.', 'A WRONG WAY banner warns of a wrong direction.', 'The barrier at the track edge bounces you back.'] },
    { title: 'Drift & Boost', lines: ['Hold Space while steering to drift.', 'Blue sparks give a mini-turbo, orange a mega turbo.', 'Drifting and slipstream fill the boost meter.', 'Shift spends the meter on a boost.', 'Tuck in behind an opponent for the tow.', 'Accelerate right at GO for a perfect start.'] },
    { title: 'Items', lines: ['Drive through item boxes to grab an item.', 'E or the right mouse button uses it.', 'Missiles chase the racer ahead, mines drop behind.', 'Shields eat one hit, EMP spins out rivals.', 'Turbo is a short speed burst.', 'Boxes refill a few seconds after pickup.'] },
    { title: 'Career', lines: ['Four cups: Bronze, Silver, Gold, Platinum.', 'Each cup is four races, points 10/6/4/3.', 'Finish a cup top three for a trophy and the next cup.', 'Gold and Platinum run the tracks in reverse.', 'Trophies unlock ships and Workshop nodes.'] },
    { title: 'Workshop', lines: ['Spend race credits in the tech tree.', 'Five branches: Engine, Handling, Hull, Boost, Arsenal.', 'Nodes improve speed, steering, hull, boost and items.', 'Buy a prerequisite before the node behind it.', 'Two nodes also need a cup trophy.'] },
    { title: 'Controls', lines: ['Up / W accelerate, Down / S brake.', 'Left / Right or A / D steer, mouse steers too.', 'Space drift, Shift boost, E use item.', 'Esc pause, H help, F2 new race.', 'Garage and Workshop: title screen or Game menu.'] }
  ];

  const THEME_COLORS = {
    nebula: '#c04cff', storm: '#5ab8ff', pulsar: '#8ad8ff', asteroid: '#b09a7a',
    solar: '#ffb648', comet: '#6fe08a', quasar: '#ff6ad5', void: '#9fe8ff'
  };
  const TROPHY_COLORS = { bronze: '#d08a4a', silver: '#c8d0e0', gold: '#ffd75a', platinum: '#9fe8ff' };

  Object.assign(NS.module('defs'), {
    SHIP_DEFS, UPGRADE_DEFS, TREE, AI_PERSONALITIES, TRACKS, CUPS, CUP_POINTS, CUP_RACES, TROPHY_RANK,
    trackVariant, TUTORIAL_PAGES, THEME_COLORS, TROPHY_COLORS
  });
})();
