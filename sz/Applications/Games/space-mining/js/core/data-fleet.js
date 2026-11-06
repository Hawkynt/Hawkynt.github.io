/* Static fleet data: the seven buildable unit types (who builds them, hit points, speed,
   weapons, supply, cost, build time, role), the ten hostile types (nine invaders and the hive nest) of pirate raids, alien
   swarms and the nanoprobe Lattice (with the per-belt mothership), wave point costs, the
   four formations and the veterancy ranks. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* range/dmg/rof: weapon reach, damage per shot, seconds between shots (0 = unarmed);
     supply: fleet supply used; aggro: auto-engage reach when idle */
  const UNITS = [
    { id: 'miner', name: 'Mining Drone', from: 'dronefactory', icon: 'drone', hp: 60, speed: 190, r: 10, range: 0, dmg: 0, rof: 0, supply: 1, build: 8,
      cost: { cr: 120, ore: { iron: 4 } }, haul: 6, color: '#5cff9a', role: 'Drills nearby rocks and brings the ore to the hub' },
    { id: 'mender', name: 'Repair Drone', from: 'dronefactory', icon: 'wrench', hp: 70, speed: 200, r: 10, range: 160, dmg: 0, rof: 0, supply: 1, build: 9,
      cost: { cr: 160, bar: { iron: 2 } }, heal: 16, color: '#7cff9a', role: 'Repairs damaged buildings and units' },
    { id: 'purger', name: 'Purge Tender', from: 'dronefactory', icon: 'serum', hp: 90, speed: 170, r: 12, range: 140, dmg: 0, rof: 0, supply: 2, build: 12,
      cost: { cr: 260, bar: { silver: 1 }, comp: { circuit: 1 } }, purge: 0.22, color: '#c8f4ff', role: 'Sterilises infection and purges nanoprobe corruption' },
    { id: 'fighter', name: 'Fighter', from: 'shipyard', icon: 'fighter', hp: 90, speed: 300, r: 12, range: 230, dmg: 9, rof: 0.32, supply: 1, build: 8,
      cost: { cr: 180, bar: { iron: 2 } }, aggro: 420, color: '#4fd8ff', role: 'Fast interceptor - chases swarmers and raiders' },
    { id: 'gunboat', name: 'Gunboat', from: 'shipyard', icon: 'turret', hp: 300, speed: 170, r: 18, range: 320, dmg: 28, rof: 0.9, supply: 2, build: 14,
      cost: { cr: 420, bar: { iron: 4, titanium: 2 }, comp: { alloy: 1 } }, aggro: 460, color: '#ffb44a', role: 'Armoured cannon boat for frigates and bombers' },
    { id: 'escort', name: 'Escort Frigate', from: 'shipyard', icon: 'shield', hp: 420, speed: 210, r: 20, range: 260, dmg: 12, rof: 0.25, supply: 3, build: 18,
      cost: { cr: 640, bar: { titanium: 4, cobalt: 2 }, comp: { alloy: 2, circuit: 1 } }, aggro: 380, flak: 50, color: '#9ac4ff', role: 'Point-defense flak; guards your ship by default' },
    { id: 'transport', name: 'Transport', from: 'shipyard', icon: 'cargo', hp: 260, speed: 150, r: 20, range: 0, dmg: 0, rof: 0, supply: 2, build: 14,
      cost: { cr: 360, bar: { iron: 4 }, comp: { alloy: 1 } }, haul: 40, color: '#ffd25a', role: 'Hauls bars and components from the outpost to the home dock' },
  ];
  const UNIT_BY_ID = {};
  for (let i = 0; i < UNITS.length; ++i) {
    UNITS[i].index = i;
    UNIT_BY_ID[UNITS[i].id] = UNITS[i];
  }

  /* faction: pirate | alien | lattice; pts: wave budget cost; target: what it goes for first */
  const ENEMIES = [
    { id: 'swarmer', name: 'Swarmer', faction: 'alien', hp: 26, speed: 330, r: 9, range: 18, dmg: 7, rof: 0.5, pts: 1, target: 'any', loot: 6, color: '#c070ff' },
    { id: 'raider', name: 'Raider', faction: 'pirate', hp: 90, speed: 280, r: 18, range: 240, dmg: 7, rof: 1.1, pts: 3, target: 'units', loot: 30, color: '#ff5a3a' },
    { id: 'bomber', name: 'Bomber', faction: 'pirate', hp: 150, speed: 190, r: 20, range: 60, dmg: 60, rof: 2.6, pts: 5, target: 'buildings', loot: 50, color: '#ff8a3a' },
    { id: 'frigate', name: 'Shielded Frigate', faction: 'pirate', hp: 380, speed: 150, r: 28, range: 340, dmg: 16, rof: 0.7, pts: 8, target: 'any', loot: 110, shield: 220, color: '#ff4a4a' },
    { id: 'carrier', name: 'Brood Carrier', faction: 'alien', hp: 700, speed: 95, r: 40, range: 700, dmg: 0, rof: 5, pts: 14, target: 'standoff', loot: 180, spawns: 'swarmer', color: '#a040ff' },
    { id: 'siege', name: 'Siege Ship', faction: 'pirate', hp: 520, speed: 110, r: 34, range: 640, dmg: 45, rof: 3.2, pts: 12, target: 'buildings', loot: 160, artillery: true, color: '#ff6a2a' },
    { id: 'nanoswarm', name: 'Nanoprobe Swarm', faction: 'lattice', hp: 80, speed: 160, r: 16, range: 22, dmg: 0, rof: 0.6, pts: 6, target: 'buildings', loot: 20, corrupt: 0.18, color: '#3affd0' },
    { id: 'nanodrone', name: 'Lattice Drone', faction: 'lattice', hp: 50, speed: 260, r: 10, range: 180, dmg: 5, rof: 0.6, pts: 2, target: 'units', loot: 8, corrupt: 0.04, color: '#3affd0' },
    { id: 'hive', name: 'Hive Nest', faction: 'alien', hp: 900, speed: 0, r: 46, range: 560, dmg: 0, rof: 4.5, pts: 0, target: 'static', loot: 120, spawns: 'swarmer', jelly: 8, color: '#ff8ae0' },
    { id: 'mothership', name: 'Hive Mothership', faction: 'alien', hp: 6000, speed: 55, r: 96, range: 520, dmg: 22, rof: 0.45, pts: 80, target: 'buildings', loot: 3000, shield: 1500, spawns: 'swarmer', boss: true, color: '#d050ff' },
  ];
  const ENEMY_BY_ID = {};
  for (let i = 0; i < ENEMIES.length; ++i) {
    ENEMIES[i].index = i;
    ENEMY_BY_ID[ENEMIES[i].id] = ENEMIES[i];
  }

  /* waves: which types may appear from which wave on */
  const WAVE_UNLOCK = { swarmer: 1, raider: 1, bomber: 3, nanoswarm: 4, frigate: 4, siege: 6, carrier: 7 };
  const BOSS_WAVE = 8;

  const FORMATIONS = [
    { id: 'line', name: 'Line', key: 'Z', icon: 'fLine' },
    { id: 'wedge', name: 'Wedge', key: 'X', icon: 'fWedge' },
    { id: 'box', name: 'Box', key: 'C', icon: 'fBox' },
    { id: 'circle', name: 'Circle', key: 'V', icon: 'fCircle' },
  ];

  /* veterancy: kills for each rank; each rank adds 15% damage and hit points */
  const VET_KILLS = [0, 3, 8, 16];
  const VET_NAMES = ['Recruit', 'Veteran', 'Elite', 'Ace'];

  Object.assign(NS.fleetData, {
    UNITS, UNIT_BY_ID, ENEMIES, ENEMY_BY_ID, WAVE_UNLOCK, BOSS_WAVE, FORMATIONS, VET_KILLS, VET_NAMES
  });
})();
