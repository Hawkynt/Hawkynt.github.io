/* Static fleet data: the thirteen buildable unit types (who builds them, hit points, speed,
   weapons, supply, cost, build time, role, the licence some need and the ability some carry),
   the abilities, the ten hostile types (nine invaders and the hive nest) of pirate raids, alien
   swarms and the nanoprobe Lattice (with the per-belt mothership), wave point costs, the
   four formations and the veterancy ranks. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* dtype: damage type in the combat model; range/dmg/rof: weapon reach, damage per shot,
     seconds between shots (0 = unarmed);
     supply: fleet supply used; aggro: auto-engage reach when idle */
  const UNITS = [
    { id: 'miner', dtype: '', name: 'Mining Drone', from: 'dronefactory', icon: 'drone', hp: 60, speed: 190, r: 10, range: 0, dmg: 0, rof: 0, supply: 1, build: 8,
      cost: { cr: 120, ore: { iron: 4 } }, haul: 6, color: '#5cff9a', role: 'Drills nearby rocks and brings the ore to the hub' },
    { id: 'mender', dtype: '', name: 'Repair Drone', from: 'dronefactory', icon: 'wrench', hp: 70, speed: 200, r: 10, range: 160, dmg: 0, rof: 0, supply: 1, build: 9,
      cost: { cr: 160, bar: { iron: 2 } }, heal: 16, color: '#7cff9a', role: 'Repairs damaged buildings and units' },
    { id: 'purger', dtype: '', name: 'Purge Tender', from: 'dronefactory', icon: 'serum', hp: 90, speed: 170, r: 12, range: 140, dmg: 0, rof: 0, supply: 2, build: 12,
      cost: { cr: 260, bar: { silver: 1 }, comp: { circuit: 1 } }, purge: 0.22, color: '#c8f4ff', role: 'Sterilises infection and purges nanoprobe corruption' },
    { id: 'fighter', dtype: 'energy', name: 'Fighter', from: 'shipyard', icon: 'fighter', hp: 90, speed: 300, r: 12, range: 230, dmg: 9, rof: 0.32, supply: 1, build: 8,
      cost: { cr: 180, bar: { iron: 2 } }, aggro: 420, color: '#4fd8ff', role: 'Fast interceptor - chases swarmers and raiders' },
    { id: 'gunboat', dtype: 'kinetic', name: 'Gunboat', from: 'shipyard', icon: 'turret', hp: 300, speed: 170, r: 18, range: 320, dmg: 28, rof: 0.9, supply: 2, build: 14,
      cost: { cr: 420, bar: { iron: 4, titanium: 2 }, comp: { alloy: 1 } }, aggro: 460, color: '#ffb44a', role: 'Armoured cannon boat for frigates and bombers' },
    { id: 'escort', dtype: 'flak', name: 'Escort Frigate', from: 'shipyard', icon: 'shield', hp: 420, speed: 210, r: 20, range: 260, dmg: 12, rof: 0.25, supply: 3, build: 18,
      cost: { cr: 640, bar: { titanium: 4, cobalt: 2 }, comp: { alloy: 2, circuit: 1 } }, aggro: 380, flak: 50, color: '#9ac4ff', role: 'Point-defense flak; guards your ship by default' },
    { id: 'transport', dtype: '', name: 'Transport', from: 'shipyard', icon: 'cargo', hp: 260, speed: 150, r: 20, range: 0, dmg: 0, rof: 0, supply: 2, build: 14,
      cost: { cr: 360, bar: { iron: 4 }, comp: { alloy: 1 } }, haul: 40, color: '#ffd25a', role: 'Hauls bars and components from the outpost to the home dock' },
    { id: 'herder', dtype: '', name: 'Herder Tug', from: 'dronefactory', icon: 'move', hp: 180, speed: 160, r: 14, range: 0, dmg: 0, rof: 0, supply: 2, build: 12, licence: 'verdant', ability: 'herd',
      cost: { cr: 300, bar: { iron: 3 } }, color: '#d8b060', role: 'Herds the loose rocks round a point into a clump - a wall or a mining cluster' },
    { id: 'minelayer', dtype: 'explosive', name: 'Minelayer', from: 'dronefactory', icon: 'blast', hp: 150, speed: 190, r: 13, range: 0, dmg: 0, rof: 0, supply: 2, build: 12, licence: 'verdant', ability: 'mines',
      cost: { cr: 360, ore: { copper: 6 }, bar: { iron: 3 } }, color: '#ff9a4a', role: 'Drops rings of contact mines that blast and stun' },
    { id: 'aegis', dtype: '', name: 'Aegis', from: 'shipyard', icon: 'shield', hp: 380, speed: 180, r: 18, range: 0, dmg: 0, rof: 0, supply: 3, build: 16, licence: 'verdant', ability: 'bubble',
      cost: { cr: 520, bar: { iron: 4, titanium: 2 } }, color: '#58c8ff', role: 'Projects a shield bubble over the craft around it' },
    { id: 'phantom', dtype: 'energy', name: 'Phantom', from: 'shipyard', icon: 'glitch', hp: 140, speed: 280, r: 13, range: 220, dmg: 10, rof: 0.35, supply: 2, build: 14, licence: 'crimson', ability: 'cloak',
      cost: { cr: 480, bar: { titanium: 3 }, comp: { circuit: 1 } }, aggro: 380, color: '#a0b4d0', role: 'Cloaks itself and the allies around it - invaders lose them' },
    { id: 'lancer', dtype: 'kinetic', name: 'Lancer', from: 'shipyard', icon: 'crosshair', hp: 220, speed: 160, r: 16, range: 520, dmg: 70, rof: 2.6, supply: 3, build: 18, licence: 'crimson', ability: 'overcharge',
      cost: { cr: 600, bar: { titanium: 4 }, comp: { alloy: 1 } }, aggro: 560, color: '#e0e8ff', role: 'Long-range rail gun for armour; Overcharge pierces a whole line' },
    { id: 'bulwark', dtype: 'explosive', name: 'Bulwark', from: 'shipyard', icon: 'turret', hp: 520, speed: 110, r: 22, range: 640, dmg: 60, rof: 3.4, splash: 80, supply: 4, build: 22, licence: 'crimson', ability: 'barrage',
      cost: { cr: 760, bar: { iron: 6, titanium: 4 }, comp: { alloy: 2 } }, aggro: 660, color: '#ff8a5a', role: 'Siege artillery for structures and heavies; Barrage shells an area' },
  ];
  /* abilities: cooldown (s), duration (s) and their numbers; auto: cast on its own by default */
  const ABILITIES = {
    herd: { name: 'Herd', icon: 'move', cd: 16, dur: 4, radius: 340, pull: 220, auto: false, desc: 'Pulls the loose rocks round the target point into a clump' },
    mines: { name: 'Mine Ring', icon: 'blast', cd: 14, n: 6, ring: 110, arm: 0.5, blast: 70, dmg: 80, stun: 1.5, max: 18, life: 90, auto: true, desc: 'Drops six contact mines round it' },
    bubble: { name: 'Bubble', icon: 'shield', cd: 22, dur: 8, radius: 260, hp: 700, auto: true, desc: 'Soaks the damage to every allied craft inside it' },
    cloak: { name: 'Cloak', icon: 'glitch', cd: 26, dur: 8, radius: 230, auto: true, desc: 'Invaders lose it and the allies around it' },
    overcharge: { name: 'Overcharge', icon: 'crosshair', cd: 15, mul: 2, length: 900, width: 26, auto: true, desc: 'Its next shot pierces everything on a line' },
    barrage: { name: 'Barrage', icon: 'blast', cd: 24, shells: 6, spread: 120, every: 0.45, auto: true, desc: 'Six shells on the target area' },
  };
  const UNIT_BY_ID = {};
  for (let i = 0; i < UNITS.length; ++i) {
    UNITS[i].index = i;
    UNIT_BY_ID[UNITS[i].id] = UNITS[i];
  }

  /* faction: pirate | alien | lattice; armour: its class in the combat model; pts: wave budget
     cost; target: what it goes for first */
  const ENEMIES = [
    { id: 'swarmer', armour: 'swarm', name: 'Swarmer', faction: 'alien', hp: 26, speed: 330, r: 9, range: 18, dmg: 7, rof: 0.5, pts: 1, target: 'any', loot: 6, color: '#c070ff' },
    { id: 'raider', armour: 'light', name: 'Raider', faction: 'pirate', hp: 90, speed: 280, r: 18, range: 240, dmg: 7, rof: 1.1, pts: 3, target: 'units', loot: 30, color: '#ff5a3a' },
    { id: 'bomber', armour: 'armoured', name: 'Bomber', faction: 'pirate', hp: 150, speed: 190, r: 20, range: 60, dmg: 60, rof: 2.6, pts: 5, target: 'buildings', loot: 50, color: '#ff8a3a' },
    { id: 'frigate', armour: 'shielded', name: 'Shielded Frigate', faction: 'pirate', hp: 380, speed: 150, r: 28, range: 340, dmg: 16, rof: 0.7, pts: 8, target: 'any', loot: 110, shield: 220, color: '#ff4a4a' },
    { id: 'carrier', armour: 'bio', name: 'Brood Carrier', faction: 'alien', hp: 700, speed: 95, r: 40, range: 700, dmg: 0, rof: 5, pts: 14, target: 'standoff', loot: 180, spawns: 'swarmer', color: '#a040ff' },
    { id: 'siege', armour: 'armoured', name: 'Siege Ship', faction: 'pirate', hp: 520, speed: 110, r: 34, range: 640, dmg: 45, rof: 3.2, pts: 12, target: 'buildings', loot: 160, artillery: true, color: '#ff6a2a' },
    { id: 'nanoswarm', armour: 'swarm', name: 'Nanoprobe Swarm', faction: 'lattice', hp: 80, speed: 160, r: 16, range: 22, dmg: 0, rof: 0.6, pts: 6, target: 'buildings', loot: 20, corrupt: 0.18, color: '#3affd0' },
    { id: 'nanodrone', armour: 'light', name: 'Lattice Drone', faction: 'lattice', hp: 50, speed: 260, r: 10, range: 180, dmg: 5, rof: 0.6, pts: 2, target: 'units', loot: 8, corrupt: 0.04, color: '#3affd0' },
    { id: 'hive', armour: 'structure', name: 'Hive Nest', faction: 'alien', hp: 900, speed: 0, r: 46, range: 560, dmg: 0, rof: 4.5, pts: 0, target: 'static', loot: 120, spawns: 'swarmer', jelly: 8, color: '#ff8ae0' },
    { id: 'mothership', armour: 'bio', name: 'Hive Mothership', faction: 'alien', hp: 6000, speed: 55, r: 96, range: 520, dmg: 22, rof: 0.45, pts: 80, target: 'buildings', loot: 3000, shield: 1500, spawns: 'swarmer', boss: true, color: '#d050ff' },
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
    ABILITIES,
    UNITS, UNIT_BY_ID, ENEMIES, ENEMY_BY_ID, WAVE_UNLOCK, BOSS_WAVE, FORMATIONS, VET_KILLS, VET_NAMES
  });
})();
