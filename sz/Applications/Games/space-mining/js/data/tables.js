/* The big literal tables: ore types, asteroid yields, upgrade definitions,
   powerup definitions and the tutorial pages. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const T = NS.data = NS.data || {};

  /* Ore types with glow colors and base price */
  T.ORE_TYPES = {
    iron:     { color: '#aaa', glowColor: '#ccc',    basePrice: 10,  label: 'Iron' },
    gold:     { color: '#ffd700', glowColor: '#ffe44d', basePrice: 25,  label: 'Gold' },
    platinum: { color: '#e8e8e8', glowColor: '#fff',    basePrice: 50,  label: 'Platinum' },
    crystal:  { color: '#40e0d0', glowColor: '#7fffd4', basePrice: 80,  label: 'Crystal' }
  };
  T.ORE_KEYS = Object.keys(T.ORE_TYPES);

  /* Asteroid types with yield definitions */
  T.ASTEROID_DEFS = [
    { minRadius: 20, maxRadius: 35, oreType: 'iron',     resourceAmount: 8,  abundance: 0.4, richness: 1.0 },
    { minRadius: 18, maxRadius: 30, oreType: 'gold',     resourceAmount: 5,  abundance: 0.3, richness: 1.2 },
    { minRadius: 15, maxRadius: 28, oreType: 'platinum',  resourceAmount: 3,  abundance: 0.2, richness: 1.5 },
    { minRadius: 12, maxRadius: 22, oreType: 'crystal',   resourceAmount: 2,  abundance: 0.1, richness: 2.0 }
  ];

  /* Upgrades -- now includes hullStrength */
  T.UPGRADE_DEFS = {
    drillSpeed:    { label: 'Drill Speed',   baseCost: 100, costMult: 2.0, maxLevel: 5, icon: 'D', desc: '+40% drill rate' },
    cargoCapacity: { label: 'Cargo Size',    baseCost: 80,  costMult: 1.8, maxLevel: 5, icon: 'C', desc: '+5 cargo slots' },
    enginePower:   { label: 'Engine Power',  baseCost: 120, costMult: 2.2, maxLevel: 5, icon: 'E', desc: '+30% thrust' },
    hullStrength:  { label: 'Hull Armor',    baseCost: 150, costMult: 2.0, maxLevel: 5, icon: 'H', desc: '+20 max hull' },
    scannerRange:  { label: 'Scanner',       baseCost: 60,  costMult: 1.5, maxLevel: 3, icon: 'S', desc: '+ore indicators' }
  };
  T.UPGRADE_KEYS = Object.keys(T.UPGRADE_DEFS);

  /* Powerups */
  T.POWERUP_DEFS = {
    shield:   { label: 'Shield Boost', color: '#44aaff', glowColor: '#88ccff', duration: 10, icon: 'S' },
    speed:    { label: 'Speed Boost',  color: '#ffaa00', glowColor: '#ffcc44', duration: 8,  icon: 'F' },
    magnet:   { label: 'Ore Magnet',   color: '#ff44ff', glowColor: '#ff88ff', duration: 12, icon: 'M' },
    bonusOre: { label: 'Bonus Ore',    color: '#44ff44', glowColor: '#88ff88', duration: 0,  icon: '+' },
    repair:   { label: 'Repair Kit',   color: '#ff4444', glowColor: '#ff8888', duration: 0,  icon: 'R' }
  };
  T.POWERUP_KEYS = Object.keys(T.POWERUP_DEFS);

  /* Tutorial */
  T.TUTORIAL_PAGES = [
    { title: 'Welcome, Miner!', lines: ['You pilot a mining rig in an asteroid field.', 'Your goal: mine ore, sell it, and get rich!', '', 'Keyboard: Arrow Keys or WASD to fly.', 'Mouse: Click and hold to fly toward the cursor.'] },
    { title: 'Mining Ore', lines: ['Keyboard: Hold SPACE near an asteroid to drill.', 'Mouse: Click and hold on an asteroid to fly', '  there and drill automatically.', '', 'Ore types: Iron (grey), Gold (yellow),', 'Platinum (white), Crystal (teal - most valuable).'] },
    { title: 'Selling & Upgrades', lines: ['Return to the green station in the center.', 'Press E or click the station to sell and shop.', '', 'Buy upgrades: better drill, bigger cargo,', 'stronger hull, faster engines, and scanner.', 'Use 1-5 keys or click to purchase.'] },
    { title: 'Powerups & Tips', lines: ['Floating powerups appear periodically:', '  Shield (blue), Speed (orange), Magnet (pink),', '  Bonus Ore (green), Repair Kit (red).', '', 'Fly into them to collect. Watch the minimap!', 'Press H anytime for help. Good luck, miner!'] }
  ];
})();
