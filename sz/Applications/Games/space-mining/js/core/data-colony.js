/* Static colony data: the seven components fabricated from bars and their recipes, which ores
   each processing plant takes, the build categories and the 23 outpost buildings (footprint,
   hit points, costs in credits and stock, build time, power, crew, upkeep, role numbers and
   the text the build menu shows). Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* value: credits per unit at the home market */
  const COMPONENTS = [
    { id: 'alloy', name: 'Alloy Plate', icon: 'hull', value: 90, color: '#b8c0cc' },
    { id: 'circuit', name: 'Circuits', icon: 'chip', value: 120, color: '#5cff9a' },
    { id: 'fuelcell', name: 'Fuel Cell', icon: 'fuel', value: 80, color: '#ffc84a' },
    { id: 'optics', name: 'Optics', icon: 'gem', value: 220, color: '#c8f4ff' },
    { id: 'serum', name: 'Antiviral Serum', icon: 'serum', value: 260, color: '#9ae04a' },
    { id: 'plasma', name: 'Plasma Coil', icon: 'flame', value: 320, color: '#ff8a3a' },
    { id: 'warpcore', name: 'Warp Core', icon: 'warp', value: 900, color: '#c88aff' },
  ];
  const COMP_BY_ID = {};
  for (let i = 0; i < COMPONENTS.length; ++i) {
    COMPONENTS[i].index = i;
    COMP_BY_ID[COMPONENTS[i].id] = COMPONENTS[i];
  }

  /* Fabricator recipes: bars (and components) in, one component out */
  const RECIPES = [
    { id: 'alloy', out: 'alloy', bar: { iron: 2, nickel: 1 }, comp: {}, time: 6 },
    { id: 'circuit', out: 'circuit', bar: { copper: 1, silver: 1 }, comp: {}, time: 7 },
    { id: 'fuelcell', out: 'fuelcell', bar: { ice: 1, hydrogen: 1 }, comp: {}, time: 6 },
    { id: 'optics', out: 'optics', bar: { quartz: 2, gold: 1 }, comp: {}, time: 9 },
    { id: 'serum', out: 'serum', bar: { biomass: 2, carbon: 1 }, comp: {}, time: 9 },
    { id: 'plasma', out: 'plasma', bar: { helium3: 1, cobalt: 1, uranium: 1 }, comp: {}, time: 11 },
    { id: 'warpcore', out: 'warpcore', bar: { voidCrystal: 1, exotic: 1, xenon: 1 }, comp: { plasma: 1 }, time: 18 },
  ];
  const RECIPE_BY_ID = {};
  for (let i = 0; i < RECIPES.length; ++i) RECIPE_BY_ID[RECIPES[i].id] = RECIPES[i];

  /* which ore kinds each plant smelts (3 ore -> 1 bar) */
  const SMELTS = {
    smelter: { bulk: 1, salvage: 1 },
    refinery: { precious: 1, gas: 1, crystal: 1, exotic: 1, bio: 1 },
  };

  const CATEGORIES = [
    { id: 'core', name: 'Core', icon: 'station', color: '#ffb44a' },
    { id: 'industry', name: 'Industry', icon: 'refinery', color: '#ffd25a' },
    { id: 'power', name: 'Power', icon: 'bolt', color: '#7cf0ff' },
    { id: 'defense', name: 'Defense', icon: 'turret', color: '#ff5c6c' },
    { id: 'fleet', name: 'Fleet', icon: 'drone', color: '#4fd8ff' },
    { id: 'science', name: 'Science', icon: 'scan', color: '#b48aff' },
  ];

  /* size: footprint in cells; power: + makes, - uses; crew: staff to run at full speed;
     upkeep: credits per market cycle; cost: { cr, ore, bar, comp }; build: seconds;
     deposit: the deposit kind an extractor must stand on; prio: crew priority (high first) */
  const BUILDINGS = [
    { id: 'hub', name: 'Command Hub', cat: 'core', icon: 'station', size: 3, hp: 1600, build: 6, power: 12, crew: 2, upkeep: 0, prio: 9,
      cost: { cr: 500 }, storage: 160, housing: 6, supply: 4, link: 6, color: '#ffb44a',
      desc: 'The heart of the outpost. Stores stock, houses six crew and links buildings within six cells. Lose it and the outpost falls.' },
    { id: 'warehouse', name: 'Warehouse', cat: 'core', icon: 'cargo', size: 2, hp: 700, build: 8, power: -1, crew: 0, upkeep: 4, prio: 1,
      cost: { cr: 160, ore: { iron: 12 } }, storage: 260, color: '#c8a070',
      desc: 'Bulk racks for 260 more units of stock per level. Production stalls when storage is full.' },
    { id: 'habitat', name: 'Habitat', cat: 'core', icon: 'habitat', size: 2, hp: 600, build: 10, power: -2, crew: 0, upkeep: 6, prio: 1,
      cost: { cr: 220, ore: { iron: 8, ice: 8 } }, housing: 8, supply: 6, color: '#ffe0a0',
      desc: 'Quarters for eight crew and six fleet supply per level. Crew grow faster with homes to fill.' },
    { id: 'relay', name: 'Power Relay', cat: 'core', icon: 'relay', size: 1, hp: 320, build: 4, power: 0, crew: 0, upkeep: 1, prio: 1,
      cost: { cr: 80, ore: { copper: 4 } }, link: 5, color: '#7cf0ff',
      desc: 'A pylon that carries power and links five cells further. Infection and nanoprobes travel the links too.' },
    { id: 'depot', name: 'Trade Depot', cat: 'core', icon: 'trade', size: 2, hp: 600, build: 10, power: -2, crew: 1, upkeep: 5, prio: 3,
      cost: { cr: 300, ore: { iron: 10 }, bar: { copper: 2 } }, color: '#ffd25a',
      desc: 'Market uplink: ships the most valuable bars and components home every few seconds (Siege: sells them).' },

    { id: 'rig', name: 'Mining Rig', cat: 'industry', icon: 'drill', size: 2, hp: 520, build: 8, power: -3, crew: 1, upkeep: 3, prio: 5,
      cost: { cr: 160, ore: { iron: 8 } }, deposit: 'ore', rate: 3, color: '#ff8a3a',
      desc: 'Drills an ore deposit it stands on: one unit every three seconds per level.' },
    { id: 'siphon', name: 'Gas Siphon', cat: 'industry', icon: 'siphon', size: 2, hp: 460, build: 8, power: -3, crew: 1, upkeep: 3, prio: 5,
      cost: { cr: 180, ore: { iron: 6, copper: 4 } }, deposit: 'gas', rate: 4, color: '#8ab4ff',
      desc: 'Pumps a nebula gas pocket it stands on - hydrogen, helium-3 or xenon.' },
    { id: 'harvester', name: 'Crystal Harvester', cat: 'industry', icon: 'gem', size: 2, hp: 520, build: 10, power: -4, crew: 1, upkeep: 4, prio: 5,
      cost: { cr: 260, ore: { iron: 10 }, bar: { copper: 2 } }, deposit: 'crystal', rate: 6, color: '#f0d8e8',
      desc: 'Grows and cuts a crystal cluster it stands on - quartz, verdite, exotic matter or void crystal.' },
    { id: 'smelter', name: 'Smelter', cat: 'industry', icon: 'refinery', size: 2, hp: 600, build: 9, power: -4, crew: 1, upkeep: 4, prio: 6,
      cost: { cr: 200, ore: { iron: 10, copper: 4 } }, rate: 4, color: '#ff6a3a',
      desc: 'Melts three bulk ore or scrap into one bar: iron, carbon, nickel, ice, copper, titanium.' },
    { id: 'refinery', name: 'Refinery', cat: 'industry', icon: 'flask', size: 2, hp: 620, build: 12, power: -5, crew: 2, upkeep: 6, prio: 6,
      cost: { cr: 420, ore: { iron: 10 }, bar: { iron: 4, copper: 2 } }, rate: 5, color: '#ffc83a',
      desc: 'Refines three precious ore, gas, crystal or bio-matter into one bar or canister.' },
    { id: 'fabricator', name: 'Fabricator', cat: 'industry', icon: 'chip', size: 2, hp: 640, build: 14, power: -6, crew: 2, upkeep: 8, prio: 6,
      cost: { cr: 600, bar: { iron: 6, copper: 4 } }, color: '#5cff9a',
      desc: 'Assembles components from bars: alloy, circuits, fuel cells, optics, serum, plasma coils, warp cores.' },

    { id: 'solar', name: 'Solar Array', cat: 'power', icon: 'solar', size: 2, hp: 360, build: 6, power: 10, crew: 0, upkeep: 2, prio: 1,
      cost: { cr: 120, ore: { iron: 4, copper: 3 } }, color: '#4fa8ff',
      desc: 'Ten power per level from starlight; a third more in belts with a sun.' },
    { id: 'fusion', name: 'Fusion Reactor', cat: 'power', icon: 'rad', size: 2, hp: 800, build: 16, power: 36, crew: 2, upkeep: 10, prio: 8,
      cost: { cr: 900, bar: { iron: 8, titanium: 4 }, comp: { circuit: 2 } }, fuelEvery: 18, color: '#ffe08a',
      desc: '36 power per level while it burns a unit of hydrogen or helium-3 every 18 seconds; six when dry.' },

    { id: 'laser', name: 'Laser Turret', cat: 'defense', icon: 'laser', size: 1, hp: 420, build: 6, power: -3, crew: 1, upkeep: 3, prio: 7,
      cost: { cr: 150, ore: { iron: 6, copper: 2 } }, range: 300, dmg: 20, rof: 0.12, color: '#ff6a3a',
      desc: 'A fast-tracking beam that shreds swarmers and raiders.' },
    { id: 'flak', name: 'Flak Tower', cat: 'defense', icon: 'blast', size: 1, hp: 460, build: 8, power: -3, crew: 1, upkeep: 4, prio: 7,
      cost: { cr: 220, ore: { iron: 8 }, bar: { iron: 2 } }, range: 280, dmg: 24, rof: 1.1, splash: 70, color: '#ffb44a',
      desc: 'Bursting shells with a wide blast - the answer to swarms.' },
    { id: 'missile', name: 'Missile Battery', cat: 'defense', icon: 'missile', size: 2, hp: 640, build: 12, power: -5, crew: 1, upkeep: 6, prio: 7,
      cost: { cr: 480, bar: { iron: 6, copper: 2 }, comp: { circuit: 1 } }, range: 560, dmg: 60, rof: 2.4, color: '#ff4a6a',
      desc: 'Long-range homing missiles for frigates, siege ships and carriers.' },
    { id: 'shield', name: 'Shield Generator', cat: 'defense', icon: 'shield', size: 2, hp: 560, build: 14, power: -8, crew: 1, upkeep: 7, prio: 8,
      cost: { cr: 620, bar: { iron: 6, cobalt: 2 }, comp: { circuit: 2 } }, radius: 230, cap: 420, regen: 18, color: '#58c8ff',
      desc: 'A dome that soaks damage for every building under it and recharges when powered.' },

    { id: 'dronefactory', name: 'Drone Factory', cat: 'fleet', icon: 'drone', size: 2, hp: 620, build: 12, power: -4, crew: 2, upkeep: 6, prio: 4,
      cost: { cr: 380, ore: { iron: 10 }, bar: { copper: 3 } }, makes: ['miner', 'mender', 'purger'], color: '#5cff9a',
      desc: 'Builds mining drones that bring rocks home, repair drones and purge tenders.' },
    { id: 'shipyard', name: 'Shipyard', cat: 'fleet', icon: 'engine', size: 3, hp: 1100, build: 18, power: -8, crew: 3, upkeep: 10, prio: 4,
      cost: { cr: 900, bar: { iron: 10, titanium: 4 }, comp: { alloy: 2 } }, makes: ['fighter', 'gunboat', 'escort', 'transport'], color: '#4fd8ff',
      desc: 'Builds fighters, gunboats, escort frigates and transports.' },
    { id: 'repairbay', name: 'Repair Bay', cat: 'fleet', icon: 'wrench', size: 2, hp: 560, build: 10, power: -4, crew: 1, upkeep: 4, prio: 5,
      cost: { cr: 320, ore: { iron: 10 }, bar: { iron: 3 } }, radius: 240, heal: 14, color: '#7cff9a',
      desc: 'Nanite arms repair buildings, units and your ship within reach.' },

    { id: 'radar', name: 'Sensor Array', cat: 'science', icon: 'scan', size: 1, hp: 300, build: 7, power: -3, crew: 1, upkeep: 3, prio: 4,
      cost: { cr: 200, ore: { copper: 6 } }, color: '#4fd8ff',
      desc: 'Previews the next wave, shows threats and lifeforms on the minimap and scans docking cargo for spores.' },
    { id: 'lab', name: 'Research Lab', cat: 'science', icon: 'data', size: 2, hp: 480, build: 14, power: -5, crew: 2, upkeep: 6, prio: 3,
      cost: { cr: 520, bar: { copper: 3, silver: 2 } }, rate: 24, color: '#b48aff',
      desc: 'Turns out research data for the tech tree; doubles it while it has circuits to burn.' },
    { id: 'medbay', name: 'Medical Bay', cat: 'science', icon: 'serum', size: 2, hp: 520, build: 12, power: -4, crew: 2, upkeep: 6, prio: 8,
      cost: { cr: 440, ore: { ice: 8 }, bar: { silver: 2 } }, radius: 340, cure: 0.05, color: '#9ae04a',
      desc: 'Treats infected crew within reach, scans cargo, and with serum in stock vaccinates the whole outpost.' },
  ];

  const BUILDING_BY_ID = {};
  for (let i = 0; i < BUILDINGS.length; ++i) {
    BUILDINGS[i].index = i;
    BUILDING_BY_ID[BUILDINGS[i].id] = BUILDINGS[i];
  }

  /* levels: 1..3; an upgrade costs this share of the base cost per level reached */
  const MAX_LEVEL = 3;
  const UPGRADE_MUL = [0, 0.9, 1.6];

  Object.assign(NS.colonyData, {
    COMPONENTS, COMP_BY_ID, RECIPES, RECIPE_BY_ID, SMELTS, CATEGORIES, BUILDINGS, BUILDING_BY_ID, MAX_LEVEL, UPGRADE_MUL
  });
})();
