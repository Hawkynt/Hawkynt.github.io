/* Static weapon data: the nine hardpoint weapons beside the mining laser - damage type, firing
   mode (auto: fires while held, charge: charges while held and fires on release, press: acts on
   a press, toggle: grabs and lets go), cooldown, damage and their own numbers - what unlocks them
   (an unlock id from an operation or a belt licence) and their price, the three levels, and the
   hardpoints of each hull. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* cd: seconds between uses; dmg: per hit at level 1; range and speed in px and px/s;
     cost: credits for level 1 (0 = handed out by its unlock), levels cost more */
  const WEAPONS = [
    { id: 'pulse', name: 'Pulse Cannon', icon: 'laser', type: 'energy', mode: 'auto', cd: 0.22, dmg: 12, speed: 1300, range: 750,
      unlock: { id: 'w_pulse' }, cost: 2000, color: '#7cf0ff', desc: 'Rapid energy bolts along your aim' },
    { id: 'flak', name: 'Scatter Flak', icon: 'blast', type: 'flak', mode: 'auto', cd: 0.85, dmg: 6, pellets: 7, spread: 0.45, speed: 900, range: 420,
      unlock: { licence: 'amber' }, cost: 3500, color: '#ffb44a', desc: 'A cone of pellets - shreds swarms and light hulls' },
    { id: 'missile', name: 'Missile Rack', icon: 'turret', type: 'explosive', mode: 'auto', cd: 2.2, dmg: 32, salvo: 3, splash: 70, speed: 520, turn: 4.5, range: 1000,
      unlock: { licence: 'amber' }, cost: 6000, color: '#ff8a5a', desc: 'Homing salvos that burst - cracks armour and structures' },
    { id: 'tether', name: 'Tether Tow', icon: 'tractor', type: 'kinetic', mode: 'toggle', cd: 1, dmg: 60, grab: 320, fling: 760,
      unlock: { licence: 'amber' }, cost: 4000, color: '#9ac4ff', desc: 'Grabs a rock behind the ship; press again to fling it' },
    { id: 'rail', name: 'Rail Lance', icon: 'crosshair', type: 'kinetic', mode: 'charge', cd: 2.4, dmg: 130, charge: 0.9, range: 1200,
      unlock: { licence: 'verdant' }, cost: 12000, color: '#e0e8ff', desc: 'Hold to charge, release to pierce everything in line' },
    { id: 'emp', name: 'EMP Mine', icon: 'glitch', type: 'emp', mode: 'press', cd: 7, dmg: 25, radius: 170, stun: 3.5, arm: 0.6,
      unlock: { licence: 'verdant' }, cost: 9000, color: '#3affd0', desc: 'Strips shields and stuns whatever comes close' },
    { id: 'net', name: 'Gravity Net', icon: 'vector', type: 'control', mode: 'press', cd: 8, dmg: 0, radius: 150, hold: 3.5, slow: 0.15, speed: 800, range: 700,
      unlock: { licence: 'crimson' }, cost: 15000, color: '#c88aff', desc: 'Holds enemies in place for a few seconds' },
    { id: 'cloak', name: 'Cloak Field', icon: 'shield', type: 'stealth', mode: 'press', cd: 22, dmg: 0, dur: 5,
      unlock: { licence: 'crimson' }, cost: 18000, color: '#a0b4d0', desc: 'Pirates and invaders lose you until you fire' },
    { id: 'swarm', name: 'Drone Swarm', icon: 'drone', type: 'energy', mode: 'press', cd: 26, dmg: 6, drones: 4, dur: 12, rof: 0.35,
      unlock: { licence: 'void' }, cost: 30000, color: '#5cff9a', desc: 'Four attack drones hunt for a while' },
  ];
  const WEAPON_BY_ID = {};
  for (let i = 0; i < WEAPONS.length; ++i) {
    WEAPONS[i].index = i;
    WEAPON_BY_ID[WEAPONS[i].id] = WEAPONS[i];
  }

  /* per level: damage and cooldown factors, price factor of that level */
  const LEVEL_DMG = [1, 1.35, 1.75];
  const LEVEL_CD = [1, 0.88, 0.76];
  const LEVEL_COST = [1, 1.6, 2.6];
  const SLOTS = { prospector: 1, wasp: 2, hauler: 2, leviathan: 3 };

  Object.assign(NS.weaponData, {
    WEAPONS, WEAPON_BY_ID, LEVEL_DMG, LEVEL_CD, LEVEL_COST, SLOTS
  });
})();
