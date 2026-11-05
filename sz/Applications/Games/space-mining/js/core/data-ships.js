/* Static equipment data: the four hulls (price, base stats, paint), the six hangar upgrades
   that level up with rising costs, the five station modules, and the pirate types. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* base stats; thrust in px/s^2, laser in damage/s, cargo in ore units */
  const HULLS = [
    {
      id: 'prospector', name: 'Prospector', cost: 0, desc: 'A sturdy starter rig. Balanced, forgiving, slow to fill.',
      thrust: 520, maxSpeed: 430, laser: 26, cargo: 30, fuel: 100, hull: 100, drones: 0, scale: 1,
      colors: { hull: '#c8ccd4', trim: '#ff9a3a', dark: '#3a404c', glow: '#ffb060', glass: '#7ad8ff' },
    },
    {
      id: 'wasp', name: 'Wasp', cost: 7500, desc: 'A nimble cutter with a hot laser. Small hold, quick hands.',
      thrust: 700, maxSpeed: 540, laser: 34, cargo: 28, fuel: 120, hull: 90, drones: 0, scale: 0.95,
      colors: { hull: '#f0d040', trim: '#22262e', dark: '#4a3a10', glow: '#7ae0ff', glass: '#ff8a3a' },
    },
    {
      id: 'hauler', name: 'Hauler', cost: 19000, desc: 'A flying warehouse. Huge hold and armour, ponderous turns.',
      thrust: 430, maxSpeed: 380, laser: 30, cargo: 72, fuel: 160, hull: 170, drones: 1, scale: 1.2,
      colors: { hull: '#6a8a6a', trim: '#e8d8a0', dark: '#2a3426', glow: '#ffd070', glass: '#a0ffd0' },
    },
    {
      id: 'leviathan', name: 'Leviathan', cost: 85000, desc: 'A deep-belt mining cruiser: twin lasers, drone racks, a fortress hull.',
      thrust: 560, maxSpeed: 470, laser: 48, cargo: 110, fuel: 220, hull: 260, drones: 1, scale: 1.35,
      colors: { hull: '#5a4a8a', trim: '#e8c8ff', dark: '#1e1834', glow: '#c88aff', glass: '#ffd25a' },
    },
  ];

  const HULL_BY_ID = {};
  for (let i = 0; i < HULLS.length; ++i) HULL_BY_ID[HULLS[i].id] = HULLS[i];

  /* hangar upgrades: per level the stat grows by `per` (a fraction of the hull's base); max 10 */
  const UPGRADES = [
    { id: 'laser', name: 'Mining Laser', icon: 'laser', stat: 'laser', per: 0.18, base: 260, growth: 1.55, max: 10, fmt: '+{p}% laser power' },
    { id: 'cargo', name: 'Cargo Racks', icon: 'cargo', stat: 'cargo', per: 0.14, base: 220, growth: 1.55, max: 10, fmt: '+{p}% hold space' },
    { id: 'fuel', name: 'Fuel Tanks', icon: 'fuel', stat: 'fuel', per: 0.16, base: 160, growth: 1.5, max: 10, fmt: '+{p}% fuel' },
    { id: 'hull', name: 'Hull Plating', icon: 'hull', stat: 'hull', per: 0.16, base: 220, growth: 1.55, max: 10, fmt: '+{p}% hull' },
    { id: 'thrust', name: 'Thrusters', icon: 'engine', stat: 'thrust', per: 0.07, base: 200, growth: 1.55, max: 10, fmt: '+{p}% thrust and speed' },
    { id: 'tractor', name: 'Tractor Beam', icon: 'tractor', stat: 'tractor', per: 0.12, base: 180, growth: 1.5, max: 10, fmt: '+{p}% tractor reach and pull' },
  ];

  const UPGRADE_BY_ID = {};
  for (let i = 0; i < UPGRADES.length; ++i) UPGRADE_BY_ID[UPGRADES[i].id] = UPGRADES[i];

  /* station modules, three levels each; costs per level */
  const MODULES = [
    { id: 'refinery', name: 'Refinery', icon: 'refinery', costs: [3000, 11000, 32000],
      levels: ['Smelts 3 ore into 1 bar worth 30% more', 'Bars worth 45% more', 'Bars worth 60% more'] },
    { id: 'droneBay', name: 'Drone Bay', icon: 'drone', costs: [5000, 16000, 42000],
      levels: ['One mining drone rides along', 'Two drones', 'Three drones'] },
    { id: 'scanner', name: 'Scanner Array', icon: 'scan', costs: [4000, 14000, 36000],
      levels: ['The radar shows each rock\'s ore', 'Market forecasts and rarer finds', 'Pinpoints geodes and derelicts'] },
    { id: 'tradeHub', name: 'Trade Hub', icon: 'trade', costs: [2500, 9000, 26000],
      levels: ['+1 contract, +4% prices', '+2 contracts, +8% prices', '+3 contracts, +12% prices'] },
    { id: 'depot', name: 'Fuel Depot', icon: 'fuel', costs: [2000, 7000, 20000],
      levels: ['Service costs -35%', 'Service costs -65%', 'Free refuelling and repairs'] },
  ];

  const MODULE_BY_ID = {};
  for (let i = 0; i < MODULES.length; ++i) MODULE_BY_ID[MODULES[i].id] = MODULES[i];

  /* pirates: hp, speed, fire interval, bolt damage, loot credits */
  const PIRATES = {
    skimmer: { name: 'Skimmer', hp: 40, speed: 360, accel: 520, r: 15, fire: 0, dmg: 10, loot: 60, steal: true },
    raider: { name: 'Raider', hp: 90, speed: 300, accel: 380, r: 20, fire: 1.4, dmg: 7, loot: 140 },
    gunship: { name: 'Gunship', hp: 260, speed: 210, accel: 240, r: 30, fire: 0.55, dmg: 6, loot: 420 },
  };

  Object.assign(NS.ships, {
    HULLS, HULL_BY_ID, UPGRADES, UPGRADE_BY_ID, MODULES, MODULE_BY_ID, PIRATES
  });
})();
