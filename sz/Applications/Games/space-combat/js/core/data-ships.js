/* Static player data: the five hangar ships with their specials, the six primary and four
   secondary weapons, combat power-ups and the cosmetic skins, trails and engine colours.
   Pure data; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  /* hull/shield in points, thrust in px/s^2, speed in px/s, roll = dodge cooldown seconds */
  const SHIPS = [
    {
      id: 'falcon', name: 'Falcon', role: 'Balanced striker', cost: 0,
      desc: 'A dependable all-rounder with a strong gun and a forgiving shield.',
      hull: 110, shield: 70, regen: 15, thrust: 1650, speed: 430, boost: 1, roll: 1.15, dmg: 1,
      ability: { id: 'overdrive', name: 'Overdrive', cd: 20, time: 6, desc: 'Double fire rate and +25% damage for 6 s.' },
      colors: { hull: '#c9d6e8', dark: '#4a5872', trim: '#2f8cff', glow: '#7fd4ff' },
    },
    {
      id: 'wraith', name: 'Wraith', role: 'Fast interceptor', cost: 1800,
      desc: 'Light, quick and slippery. Blinks through danger, but cannot take much of it.',
      hull: 80, shield: 55, regen: 18, thrust: 2100, speed: 520, boost: 1.25, roll: 0.8, dmg: 0.95,
      ability: { id: 'blink', name: 'Phase Blink', cd: 6, time: 0.5, desc: 'Teleport 280 px ahead, leaving a damaging rift behind.' },
      colors: { hull: '#2a2f3e', dark: '#12151e', trim: '#b066ff', glow: '#d9a8ff' },
    },
    {
      id: 'bastion', name: 'Bastion', role: 'Heavy gunship', cost: 2600,
      desc: 'Armoured to the teeth and slow to turn. Its Aegis reflects enemy fire.',
      hull: 170, shield: 100, regen: 12, thrust: 1250, speed: 360, boost: 0.85, roll: 1.5, dmg: 1.1,
      ability: { id: 'aegis', name: 'Aegis', cd: 18, time: 4, desc: 'Invulnerable for 4 s; enemy shots bounce back.' },
      colors: { hull: '#a89a7c', dark: '#4c4434', trim: '#ff9a2a', glow: '#ffd27a' },
    },
    {
      id: 'tempest', name: 'Tempest', role: 'Glass cannon', cost: 3400,
      desc: 'Enormous firepower on a fragile frame. Nova clears the screen.',
      hull: 85, shield: 60, regen: 15, thrust: 1800, speed: 450, boost: 1, roll: 1.05, dmg: 1.35,
      ability: { id: 'nova', name: 'Nova Burst', cd: 16, time: 0.4, desc: 'A 360 px shockwave: 150 damage, erases enemy shots.' },
      colors: { hull: '#e8e4f0', dark: '#5a3a5e', trim: '#ff3d6e', glow: '#ff9ab8' },
    },
    {
      id: 'specter', name: 'Specter', role: 'Tech frigate', cost: 4500,
      desc: 'A tactical ship that bends time. Built-in drone bay and a wider radar.',
      hull: 120, shield: 80, regen: 16, thrust: 1550, speed: 420, boost: 1.1, roll: 1.1, dmg: 1.05,
      ability: { id: 'warp', name: 'Time Warp', cd: 22, time: 5, desc: 'Enemies and their shots slow to 30% for 5 s.' },
      colors: { hull: '#9fe6d8', dark: '#1f4c52', trim: '#18e0b0', glow: '#8affe0' },
      bonus: { radar: 0.25, drones: 1 },
    },
  ];

  /* kind: bolt (projectile), beam (continuous), rail (hitscan, pierces), flak (bursting shell), ion (chain arcs) */
  const PRIMARIES = [
    { id: 'blaster', name: 'Pulse Blaster', cost: 0, kind: 'bolt', dmg: 11, rate: 0.1, speed: 1150, count: 1, arc: 0, jitter: 0.025, life: 0.85, color: 'cyan',
      desc: 'Fast twin-linked bolts. Reliable at any range.' },
    { id: 'spread', name: 'Scatter Cannon', cost: 700, kind: 'bolt', dmg: 7.5, rate: 0.17, speed: 980, count: 5, arc: 0.44, jitter: 0.03, life: 0.55, color: 'lime',
      desc: 'A five-bolt fan that shreds close swarms.' },
    { id: 'laser', name: 'Lance Beam', cost: 1300, kind: 'beam', dps: 110, range: 660, color: 'magenta',
      desc: 'A continuous beam. Melts the first target it touches.' },
    { id: 'rail', name: 'Rail Driver', cost: 1900, kind: 'rail', dmg: 78, rate: 0.62, range: 1500, pierce: 6, color: 'white',
      desc: 'Hitscan slug that pierces up to six targets.' },
    { id: 'flak', name: 'Flak Mortar', cost: 1600, kind: 'flak', dmg: 16, frag: 7, frags: 12, rate: 0.36, speed: 760, life: 0.55, color: 'amber',
      desc: 'Shells burst into shrapnel at the aim point.' },
    { id: 'ion', name: 'Ion Arc', cost: 2400, kind: 'ion', dmg: 17, rate: 0.16, range: 430, chains: 3, chainRange: 210, color: 'blue',
      desc: 'Lightning that jumps between up to four enemies.' },
  ];

  const SECONDARIES = [
    { id: 'missiles', name: 'Seeker Missiles', cost: 0, ammo: 12, rate: 0.4, count: 2, dmg: 26, speed: 640, radius: 60,
      desc: 'Pairs of homing missiles with a small blast.' },
    { id: 'mines', name: 'Proximity Mines', cost: 800, ammo: 8, rate: 0.35, dmg: 95, radius: 130,
      desc: 'Drop mines behind you; they detonate on contact.' },
    { id: 'emp', name: 'EMP Pulse', cost: 1500, ammo: 3, rate: 1, dmg: 24, radius: 470, stun: 3.2,
      desc: 'Stuns everything nearby, drops shields, wipes shots.' },
    { id: 'drones', name: 'Attack Drones', cost: 2100, ammo: 3, rate: 1, life: 24, dmg: 9, fire: 0.24,
      desc: 'Launch a wingman drone that hunts on its own.' },
  ];

  /* combat drops; weight = relative drop chance */
  const POWERUPS = {
    shield: { name: 'Shield Cell', color: '#58c8ff', weight: 30 },
    repair: { name: 'Hull Repair', color: '#5cff9a', weight: 24 },
    overcharge: { name: 'Overcharge', color: '#ff5cf0', weight: 16 },
    magnet: { name: 'Tractor Magnet', color: '#ffd25a', weight: 14 },
    ammo: { name: 'Munitions', color: '#ffa040', weight: 10 },
  };

  /* cosmetics unlocked in the Style branch of the tech tree */
  const SKINS = {
    stock: { name: 'Factory', colors: null },
    crimson: { name: 'Crimson Ace', colors: { hull: '#d83a3a', dark: '#4a1010', trim: '#ffd25a', glow: '#ffb070' } },
    gold: { name: 'Gilded', colors: { hull: '#e8c45a', dark: '#6a4c12', trim: '#ffffff', glow: '#fff0b0' } },
    stealth: { name: 'Nightfall', colors: { hull: '#30343c', dark: '#0c0d10', trim: '#4cff7a', glow: '#a0ffb8' } },
    aurora: { name: 'Aurora', colors: { hull: '#7ad8ff', dark: '#28307a', trim: '#ff6ad5', glow: '#ffe0ff' } },
  };

  const TRAILS = {
    standard: { name: 'Ion Exhaust', colors: null },
    comet: { name: 'Comet Tail', colors: ['#ffffff', '#9ad8ff', '#3a6cff'] },
    ember: { name: 'Ember Wake', colors: ['#fff2a0', '#ff8a2a', '#c02010'] },
    prism: { name: 'Prism Trail', colors: ['#ff5c6c', '#ffd25a', '#5cff9a', '#4fc3ff', '#b066ff'] },
  };

  const ENGINES = {
    stock: { name: 'Ship Default', color: null },
    plasma: { name: 'Plasma Blue', color: '#5aa8ff' },
    solar: { name: 'Solar Orange', color: '#ff9a2a' },
    viridian: { name: 'Viridian', color: '#3cff9a' },
    violet: { name: 'Void Violet', color: '#c070ff' },
  };

  /* projectile colour ramps: core, mid, rim */
  const COLORS = {
    cyan: ['#ffffff', '#8ff0ff', '#1aa8ff'],
    lime: ['#ffffff', '#c8ff8a', '#3ccf3a'],
    magenta: ['#ffffff', '#ff9af0', '#d02cc0'],
    white: ['#ffffff', '#d8e8ff', '#7aa0ff'],
    amber: ['#ffffff', '#ffd27a', '#ff7a1a'],
    blue: ['#ffffff', '#a8c8ff', '#4a6aff'],
    red: ['#ffffff', '#ff9a8a', '#ff2a3a'],
    orange: ['#ffffff', '#ffc070', '#ff5a10'],
    violet: ['#ffffff', '#e0b0ff', '#9a3cff'],
    green: ['#ffffff', '#a0ffb0', '#20c060'],
    gold: ['#ffffff', '#fff0a0', '#ffb020'],
  };

  function byId(list, id) {
    for (let i = 0; i < list.length; ++i)
      if (list[i].id === id)
        return list[i];
    return null;
  }

  Object.assign(NS.ships, {
    SHIPS, PRIMARIES, SECONDARIES, POWERUPS, SKINS, TRAILS, ENGINES, COLORS, byId
  });
})();
