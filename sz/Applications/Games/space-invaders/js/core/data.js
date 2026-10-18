/* Static game data and pure lookups: alien species, power-ups, wave formations, play modes,
   hangar ships, the armory tech tree and the menu screen list. Owns no state; reads SZ.InvaderArt. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});

  /* Alien species 1..6 (0 is an empty grid cell): points, colour, sprite row */
  const ALIEN_TYPE_INFO = [
    null,
    { points: 30, color: '#f44', drawIndex: 0 },
    { points: 20, color: '#ff4', drawIndex: 1 },
    { points: 10, color: '#4f4', drawIndex: 2 },
    { points: 50, color: '#f80', drawIndex: 0 },
    { points: 40, color: '#4ff', drawIndex: 1 },
    { points: 60, color: '#9aa6c0', drawIndex: 2 },
  ];

  /* Power-up kinds with duration (0 = instant) and drop weight */
  const POWERUPS = [
    { id: 'tripleShot', name: 'Triple Shot', abbr: 'TRI', color: '#0ff', duration: 8000, weight: 20 },
    { id: 'rapidFire', name: 'Rapid Fire', abbr: 'RPD', color: '#ff0', duration: 6000, weight: 20 },
    { id: 'shield', name: 'Shield', abbr: 'SHD', color: '#88f', duration: 5000, weight: 12 },
    { id: 'laser', name: 'Laser', abbr: 'LAS', color: '#f0f', duration: 4000, weight: 10 },
    { id: 'slowMo', name: 'Slow-Mo', abbr: 'SLO', color: '#aaf', duration: 5000, weight: 15 },
    { id: 'extraLife', name: 'Extra Life', abbr: '+HP', color: '#f88', duration: 0, weight: 5 },
    { id: 'bomb', name: 'Bomb', abbr: 'BOM', color: '#fa0', duration: 0, weight: 5 },
    { id: 'drone', name: 'Drone', abbr: 'DRN', color: '#8f8', duration: 10000, weight: 13 },
  ];

  const TOTAL_POWERUP_WEIGHT = POWERUPS.reduce((s, p) => s + p.weight, 0);

  /* The twelve wave formations of the arcade modes, as species grids */
  const FORMATIONS = [
    { name: 'Classic Grid', grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [2,2,2,2,2,2,2,2,2,2,2],
      [2,2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'V-Formation', grid: [
      [1,0,0,0,0,0,0,0,0,0,1],
      [2,2,0,0,0,0,0,0,0,2,2],
      [0,2,2,0,0,0,0,0,2,2,0],
      [0,0,3,3,0,0,0,3,3,0,0],
      [0,0,0,3,3,0,3,3,0,0,0],
    ]},
    { name: 'Diamond Strike', grid: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,2,2,2,2,2,0,0,0],
      [0,2,2,2,2,2,2,2,2,2,0],
      [0,0,0,3,3,3,3,3,0,0,0],
      [0,0,0,0,0,3,0,0,0,0,0],
    ]},
    { name: 'Arrow Assault', grid: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,2,2,2,0,0,0,0],
      [0,0,0,2,2,2,2,2,0,0,0],
      [0,0,3,3,3,3,3,3,3,0,0],
      [0,3,3,0,0,0,0,0,3,3,0],
    ]},
    { name: 'Cross Attack', grid: [
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,0,2,2,2,0,0,0,0],
      [2,2,2,2,2,2,2,2,2,2,2],
      [0,0,0,0,3,3,3,0,0,0,0],
      [0,0,0,0,3,3,3,0,0,0,0],
    ]},
    { name: 'Zigzag', grid: [
      [1,1,0,1,1,0,1,1,0,1,1],
      [0,2,2,0,2,2,0,2,2,0,0],
      [2,0,2,2,0,2,2,0,2,2,0],
      [0,3,0,3,3,0,3,3,0,3,3],
      [3,3,3,0,3,3,0,3,3,0,3],
    ]},
    { name: 'Fortress', grid: [
      [1,0,1,0,1,0,1,0,1,0,1],
      [2,2,2,2,2,2,2,2,2,2,2],
      [0,0,2,0,0,0,0,0,2,0,0],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,0,0,0,3,3,3,0,0,0,3],
    ]},
    { name: 'Wings', grid: [
      [1,1,0,0,0,0,0,0,0,1,1],
      [2,2,2,0,0,0,0,0,2,2,2],
      [0,2,2,2,0,0,0,2,2,2,0],
      [0,0,3,3,3,0,3,3,3,0,0],
      [0,0,0,3,3,3,3,3,0,0,0],
    ]},
    { name: 'Scatter', grid: [
      [1,0,1,0,1,0,1,0,1,0,1],
      [0,2,0,2,0,2,0,2,0,2,0],
      [2,0,2,0,2,0,2,0,2,0,2],
      [0,3,0,3,0,3,0,3,0,3,0],
      [3,0,3,0,3,0,3,0,3,0,3],
    ]},
    { name: 'Phalanx', grid: [
      [5,1,1,1,1,1,1,1,1,1,5],
      [2,2,2,2,2,2,2,2,2,2,2],
      [4,2,2,2,4,2,4,2,2,2,4],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'Diver Squadron', grid: [
      [4,0,4,0,4,0,4,0,4,0,4],
      [0,2,0,2,0,2,0,2,0,2,0],
      [2,0,2,0,2,0,2,0,2,0,2],
      [0,3,0,3,0,3,0,3,0,3,0],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
    { name: 'Shield Wall', grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [5,5,5,5,5,5,5,5,5,5,5],
      [2,2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3,3],
      [3,3,3,3,3,3,3,3,3,3,3],
    ]},
  ];

  /* Escort grids that march below a boss */
  const BOSS_ESCORTS = [
    { grid: [
      [0,0,2,0,2,0,2,0,2,0,0],
      [0,0,0,3,0,3,0,3,0,0,0],
    ]},
    { grid: [
      [0,4,0,0,0,0,0,0,0,4,0],
      [0,0,2,2,0,0,0,2,2,0,0],
      [0,0,0,0,3,3,3,0,0,0,0],
    ]},
    { grid: [
      [5,0,0,5,0,0,0,5,0,0,5],
      [0,2,2,0,2,2,2,0,2,2,0],
    ]},
    { grid: [
      [4,0,4,0,0,0,0,0,4,0,4],
      [0,2,0,2,0,0,0,2,0,2,0],
      [0,0,3,0,3,0,3,0,3,0,0],
    ]},
  ];

  /* Play modes: boss interval and power-up drop multiplier */
  const MODES = {
    classic: { name: 'Classic', bossEvery: 5, powerupMult: 1.0 },
    survival: { name: 'Survival', bossEvery: 0, powerupMult: 1.5 },
    bossRush: { name: 'Boss Rush', bossEvery: 1, powerupMult: 2.0 },
    campaign: { name: 'Campaign', bossEvery: 0, powerupMult: 1.0 },
    daily: { name: 'Daily', bossEvery: 5, powerupMult: 1.0 },
  };

  /* Hangar ships: stat factors, price or unlocking stage, special ability */
  const SHIP_DEFS = {
    interceptor: { speed: 1.0, fire: 1.0, damage: 1.0, lives: 0, price: 0, special: 'overdrive', specialName: 'Overdrive', desc: 'Balanced fighter. Special: 4 s of triple rapid fire.' },
    striker: { speed: 0.95, fire: 0.85, damage: 1.25, lives: 0, price: 1500, special: 'railgun', specialName: 'Railgun', desc: 'Hard-hitting. Special: a piercing rail beam for 1.2 s.' },
    guardian: { speed: 0.9, fire: 1.1, damage: 1.0, lives: 1, price: 2500, special: 'barrier', specialName: 'Barrier', desc: 'Extra hull. Special: a dome that eats enemy shots for 5 s.' },
    phantom: { speed: 1.25, fire: 0.95, damage: 1.0, lives: 0, unlock: '3-5', special: 'phase', specialName: 'Phase', desc: 'Fast. Special: 3 s untouchable while the enemy slows down.' },
    titan: { speed: 0.85, fire: 1.15, damage: 1.6, lives: 0, unlock: '5-5', special: 'nova', specialName: 'Nova', desc: 'Heavy gunship. Special: a shockwave that wipes nearby aliens.' },
  };

  const SHIP_ORDER = ['interceptor', 'striker', 'guardian', 'phantom', 'titan'];

  /* Names and colours of the fleet live in the sprite art, SHIP_DEFS holds the stats */
  function shipArtFor(id) {
    for (let i = 0; i < SZ.InvaderArt.SHIPS.length; ++i)
      if (SZ.InvaderArt.SHIPS[i].id === id)
        return SZ.InvaderArt.SHIPS[i];
    return SZ.InvaderArt.SHIPS[0];
  }

  function shipName(id) {
    return shipArtFor(id).name;
  }

  /* Largest value of each hangar stat across the whole fleet, for the bars */
  const HANGAR_STAT_MAX = (function() {
    const max = { Speed: 0, 'Fire rate': 0, Damage: 0, Hull: 0 };
    for (const id of SHIP_ORDER) {
      const d = SHIP_DEFS[id];
      max.Speed = Math.max(max.Speed, d.speed);
      max['Fire rate'] = Math.max(max['Fire rate'], 1 / d.fire);
      max.Damage = Math.max(max.Damage, d.damage);
      max.Hull = Math.max(max.Hull, 3 + d.lives);
    }
    return max;
  })();

  /* Armory tech tree: five branches, sixteen nodes with level costs and prerequisites */
  const TREE_BRANCHES = {
    weapons: { color: '#ff5a5a', name: 'Weapons' },
    defense: { color: '#5ab8ff', name: 'Defense' },
    engine: { color: '#6fe08a', name: 'Engine' },
    power: { color: '#c04cff', name: 'Power' },
    special: { color: '#ffd23f', name: 'Special' },
  };

  const TREE = [
    { id: 'w_rate', branch: 'weapons', name: 'Rapid Cycler', desc: 'Fire 15% faster per level', costs: [200, 400, 800], req: [] },
    { id: 'w_dmg', branch: 'weapons', name: 'Plasma Rounds', desc: '+40% damage per level', costs: [300, 700, 1400], req: [] },
    { id: 'w_speed', branch: 'weapons', name: 'Accelerators', desc: 'Shots fly 15% faster per level', costs: [250, 500], req: [] },
    { id: 'w_twin', branch: 'weapons', name: 'Twin Cannons', desc: 'Every shot fires two parallel bolts', costs: [1500], req: [['w_rate', 2]] },
    { id: 'd_hull', branch: 'defense', name: 'Extra Hull', desc: '+1 life per level', costs: [600, 1500], req: [] },
    { id: 'd_bunker', branch: 'defense', name: 'Hardened Bunkers', desc: 'Bunker blocks take 1 more hit per level', costs: [300, 700], req: [] },
    { id: 'd_shield', branch: 'defense', name: 'Deflector', desc: 'Start every run with a Shield', costs: [1200], req: [['d_hull', 1]] },
    { id: 'e_speed', branch: 'engine', name: 'Thrusters', desc: 'Move 8% faster per level', costs: [150, 300, 600], req: [] },
    { id: 'e_dash', branch: 'engine', name: 'Dash Jets', desc: 'Double-tap left/right to dash', costs: [900], req: [['e_speed', 1]] },
    { id: 'p_dur', branch: 'power', name: 'Long Charge', desc: 'Power-ups last 20% longer per level', costs: [250, 550, 1100], req: [] },
    { id: 'p_luck', branch: 'power', name: 'Salvage Scanner', desc: '25% more power-up drops per level', costs: [400, 900], req: [] },
    { id: 'p_magnet', branch: 'power', name: 'Tractor Beam', desc: 'Falling power-ups drift toward you', costs: [700], req: [['p_luck', 1]] },
    { id: 's_charge', branch: 'special', name: 'Capacitors', desc: 'Special charges 20% faster per level', costs: [300, 700, 1400], req: [] },
    { id: 's_power', branch: 'special', name: 'Amplifier', desc: 'Special lasts 30% longer / hits harder per level', costs: [600, 1300], req: [['s_charge', 1]] },
    { id: 's_drone', branch: 'special', name: 'Wingman', desc: 'Start every run with a drone for 12 s', costs: [1500], req: [['s_charge', 2]] },
    { id: 's_double', branch: 'special', name: 'Twin Charge', desc: 'Store two special charges', costs: [2500], req: [['s_power', 1], ['s_charge', 3]] },
  ];

  const TREE_BRANCH_LIST = Object.keys(TREE_BRANCHES).map(id => ({
    id: id, name: TREE_BRANCHES[id].name, color: TREE_BRANCHES[id].color,
  }));

  function treeNodeById(id) {
    return TREE.find(n => n.id === id) || null;
  }

  /* Axis-aligned box overlap, the hit test of every collision */
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  /* States that show a full menu screen instead of the battlefield */
  const MENU_SCREENS = ['title', 'campaignMap', 'hangar', 'armory', 'help'];

  function isMenuState(s) {
    return MENU_SCREENS.indexOf(s) >= 0;
  }

  Object.assign(NS.data, {
    ALIEN_TYPE_INFO, POWERUPS, TOTAL_POWERUP_WEIGHT, FORMATIONS, BOSS_ESCORTS, MODES, SHIP_DEFS, SHIP_ORDER,
    shipArtFor, shipName, HANGAR_STAT_MAX, TREE, TREE_BRANCHES, TREE_BRANCH_LIST, treeNodeById, rectsOverlap,
    isMenuState
  });
})();
