;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ======================================================================
     CONSTANTS
     ====================================================================== */

  const CANVAS_W = 1400;
  const CANVAS_H = 1000;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* -- Views -- */
  const VIEW_SURFACE = 'SURFACE';
  const VIEW_UNDERGROUND = 'UNDERGROUND';

  /* -- States -- */
  const STATE_READY = 'READY';
  const STATE_GADGET_SELECT = 'GADGET_SELECT';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_UPGRADE_DIALOG = 'UPGRADE_DIALOG';

  /* -- Storage -- */
  const STORAGE_PREFIX = 'sz-dome-keeper';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* -- Underground Grid -- */
  const GRID_COLS = 110;
  const GRID_ROWS = 80;
  const TILE_SIZE = 40;
  const GRID_OFFSET_X = 140;
  const GRID_OFFSET_Y = 120;

  /* -- Tile Types -- */
  const TILE_EMPTY = 0;
  const TILE_DIRT = 1;
  const TILE_IRON = 2;
  const TILE_WATER = 3;
  const TILE_COBALT = 4;
  const TILE_GADGET = 5;
  const TILE_COPPER = 6;
  const TILE_GOLD = 7;
  const TILE_TIN = 8;
  const TILE_SILVER = 9;
  const TILE_LEAD = 10;
  const TILE_COAL = 11;
  const TILE_QUARTZ = 12;
  const TILE_REDSTONE = 13;
  const TILE_DIAMOND = 14;
  const TILE_EMERALD = 15;
  const TILE_RUBY = 16;

  const TILE_COLORS = {
    [TILE_DIRT]: '#4a3a2a',
    [TILE_IRON]: '#888888',
    [TILE_WATER]: '#4488ff',
    [TILE_COBALT]: '#4444aa',
    [TILE_COPPER]: '#b87333',
    [TILE_GOLD]: '#ffd700',
    [TILE_TIN]: '#d4d4d4',
    [TILE_SILVER]: '#c0c0c0',
    [TILE_LEAD]: '#666666',
    [TILE_COAL]: '#333333',
    [TILE_QUARTZ]: '#f0e6d3',
    [TILE_REDSTONE]: '#cc0000',
    [TILE_DIAMOND]: '#b9f2ff',
    [TILE_EMERALD]: '#50c878',
    [TILE_RUBY]: '#e0115f'
  };

  const TILE_HIGHLIGHT_COLORS = {
    [TILE_IRON]: '#bbbbbb',
    [TILE_WATER]: '#66aaff',
    [TILE_COBALT]: '#6666cc',
    [TILE_COPPER]: '#d4944d',
    [TILE_GOLD]: '#ffea50',
    [TILE_TIN]: '#eeeeee',
    [TILE_SILVER]: '#e0e0e0',
    [TILE_LEAD]: '#999999',
    [TILE_COAL]: '#555555',
    [TILE_QUARTZ]: '#fff8ee',
    [TILE_REDSTONE]: '#ff3333',
    [TILE_DIAMOND]: '#dff8ff',
    [TILE_EMERALD]: '#80e8a0',
    [TILE_RUBY]: '#ff4488'
  };

  const TILE_SHADOW_COLORS = {
    [TILE_DIRT]: '#2a1a0a',
    [TILE_IRON]: '#555555',
    [TILE_WATER]: '#2266aa',
    [TILE_COBALT]: '#222288',
    [TILE_COPPER]: '#7a4a1a',
    [TILE_GOLD]: '#aa8800',
    [TILE_TIN]: '#999999',
    [TILE_SILVER]: '#888888',
    [TILE_LEAD]: '#333333',
    [TILE_COAL]: '#111111',
    [TILE_QUARTZ]: '#b0a890',
    [TILE_REDSTONE]: '#880000',
    [TILE_DIAMOND]: '#6ab0c0',
    [TILE_EMERALD]: '#2a7844',
    [TILE_RUBY]: '#900030'
  };

  const TILE_VALUES = {
    [TILE_IRON]: 10,
    [TILE_WATER]: 20,
    [TILE_COBALT]: 40,
    [TILE_COPPER]: 12,
    [TILE_TIN]: 15,
    [TILE_COAL]: 8,
    [TILE_LEAD]: 18,
    [TILE_SILVER]: 25,
    [TILE_GOLD]: 35,
    [TILE_QUARTZ]: 30,
    [TILE_REDSTONE]: 45,
    [TILE_EMERALD]: 60,
    [TILE_DIAMOND]: 80,
    [TILE_RUBY]: 70
  };

  const TILE_LABELS = {
    [TILE_IRON]: 'iron',
    [TILE_WATER]: 'water',
    [TILE_COBALT]: 'cobalt',
    [TILE_COPPER]: 'copper',
    [TILE_GOLD]: 'gold',
    [TILE_TIN]: 'tin',
    [TILE_SILVER]: 'silver',
    [TILE_LEAD]: 'lead',
    [TILE_COAL]: 'coal',
    [TILE_QUARTZ]: 'quartz',
    [TILE_REDSTONE]: 'redstone',
    [TILE_DIAMOND]: 'diamond',
    [TILE_EMERALD]: 'emerald',
    [TILE_RUBY]: 'ruby'
  };

  const TILE_ICONS = {
    [TILE_IRON]: '\u2699',      // ⚙
    [TILE_WATER]: '\u{1F4A7}',  // 💧
    [TILE_COBALT]: '\u{1F48E}', // 💎 (blue gem)
    [TILE_COPPER]: '\u{1FA99}', // 🪙
    [TILE_GOLD]: '\u{1F451}',   // 👑
    [TILE_TIN]: '\u{1F52A}',    // 🔪
    [TILE_SILVER]: '\u2B50',    // ⭐
    [TILE_LEAD]: '\u26D3',      // ⛓
    [TILE_COAL]: '\u{1F525}',   // 🔥
    [TILE_QUARTZ]: '\u{1F52E}', // 🔮
    [TILE_REDSTONE]: '\u2764',  // ❤
    [TILE_DIAMOND]: '\u{1F4A0}',// 💠
    [TILE_EMERALD]: '\u{1F49A}',// 💚
    [TILE_RUBY]: '\u2763'       // ❣
  };

  const TILE_DISPLAY_NAMES = {
    [TILE_EMPTY]: 'Empty',
    [TILE_DIRT]: 'Dirt',
    [TILE_IRON]: 'Iron Ore',
    [TILE_WATER]: 'Water Crystal',
    [TILE_COBALT]: 'Cobalt',
    [TILE_GADGET]: 'Gadget Chamber',
    [TILE_COPPER]: 'Copper Ore',
    [TILE_GOLD]: 'Gold Vein',
    [TILE_TIN]: 'Tin Ore',
    [TILE_SILVER]: 'Silver Deposit',
    [TILE_LEAD]: 'Lead Ore',
    [TILE_COAL]: 'Coal',
    [TILE_QUARTZ]: 'Quartz',
    [TILE_REDSTONE]: 'Redstone',
    [TILE_DIAMOND]: 'Diamond',
    [TILE_EMERALD]: 'Emerald',
    [TILE_RUBY]: 'Ruby'
  };

  const ORE_SPECKLE_COLORS = {
    [TILE_IRON]: ['#cccccc', '#aaaaaa', '#eeeeee', '#999999'],
    [TILE_WATER]: ['#66bbff', '#88ddff', '#4499dd', '#aaeeff'],
    [TILE_COBALT]: ['#7777cc', '#9999ee', '#5555aa', '#aaaaff'],
    [TILE_COPPER]: ['#d4944d', '#c08040', '#e0a060', '#a06020'],
    [TILE_GOLD]: ['#ffea50', '#ffd700', '#ffe030', '#ffcc00'],
    [TILE_TIN]: ['#eeeeee', '#d0d0d0', '#f4f4f4', '#c8c8c8'],
    [TILE_SILVER]: ['#e0e0e0', '#c8c8c8', '#f0f0f0', '#b0b0b0'],
    [TILE_LEAD]: ['#888888', '#666666', '#999999', '#555555'],
    [TILE_COAL]: ['#444444', '#333333', '#555555', '#222222'],
    [TILE_QUARTZ]: ['#fff8ee', '#f0e6d3', '#ffe8d0', '#e8dac0'],
    [TILE_REDSTONE]: ['#ff3333', '#cc0000', '#ff5555', '#aa0000'],
    [TILE_DIAMOND]: ['#dff8ff', '#b9f2ff', '#c8f0ff', '#a0e8ff'],
    [TILE_EMERALD]: ['#80e8a0', '#50c878', '#60d888', '#40b868'],
    [TILE_RUBY]: ['#ff4488', '#e0115f', '#ff2070', '#c00048']
  };

  // All resource tile types (used for detection in various places)
  const RESOURCE_TILES = [
    TILE_IRON, TILE_WATER, TILE_COBALT,
    TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER, TILE_LEAD, TILE_COAL,
    TILE_QUARTZ, TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY
  ];

  /* -- Depth-based dirt tiers (10 levels) -- */
  // Each tier: { name, base, highlight, shadow } colors
  const DEPTH_TIERS = [
    { name: 'Sand',        base: '#c2a55a', highlight: '#d4bb78', shadow: '#8a7438' },  // 0-10%
    { name: 'Loose Soil',  base: '#8b6c42', highlight: '#a88558', shadow: '#5e4628' },  // 10-20%
    { name: 'Dirt',        base: '#4a3a2a', highlight: '#6a5540', shadow: '#2a1a0a' },  // 20-30% (original)
    { name: 'Packed Dirt', base: '#3d2e1e', highlight: '#584630', shadow: '#221508' },  // 30-40%
    { name: 'Clay',        base: '#6b3a2a', highlight: '#885040', shadow: '#3e1e12' },  // 40-50%
    { name: 'Gravel',      base: '#5a5040', highlight: '#706858', shadow: '#3a3228' },  // 50-60%
    { name: 'Soft Stone',  base: '#7a7a7a', highlight: '#949494', shadow: '#505050' },  // 60-70%
    { name: 'Stone',       base: '#5a5a5a', highlight: '#707070', shadow: '#383838' },  // 70-80%
    { name: 'Hard Stone',  base: '#3e3e3e', highlight: '#525252', shadow: '#222222' },  // 80-90%
    { name: 'Bedrock',     base: '#1e1e1e', highlight: '#303030', shadow: '#0a0a0a' }   // 90-100%
  ];

  // Get depth tier index (0-9) for a given row
  function getDepthTier(row) {
    const t = Math.floor((row / GRID_ROWS) * DEPTH_TIERS.length);
    return Math.min(t, DEPTH_TIERS.length - 1);
  }

  // Get depth-based colors for dirt at a given row
  function getDepthDirtColors(row) {
    return DEPTH_TIERS[getDepthTier(row)];
  }

  // Depth-based mining time multiplier: 0.5 at surface, ~4.0 at bottom
  function getDepthMineMultiplier(row) {
    return 0.5 + (row / GRID_ROWS) * 3.5;
  }

  // Get the display color for any tile, accounting for depth-based dirt
  function getTileBaseColor(tile, row) {
    if (tile === TILE_DIRT)
      return getDepthDirtColors(row).base;
    return TILE_COLORS[tile] || '#654';
  }

  /* -- Dome -- */
  const DOME_RADIUS = 100;
  const DOME_X = CANVAS_W / 2;
  const DOME_Y = CANVAS_H - 100; // dome center at ground line; arc draws upward
  const BASE_DOME_HP = 100;

  /* -- Weapon defaults -- */
  const BASE_WEAPON_DAMAGE = 10;
  const BASE_FIRE_RATE = 1.0;
  const BASE_DRILL_SPEED = 0.3;
  const BASE_CARRY_CAPACITY = 50;

  /* -- Waves -- */
  const WAVE_INTERVAL = 40;
  const BASE_ENEMIES_PER_WAVE = 3;

  /* -- Mining time -- */
  const BASE_MINE_TIME = 0.5; // seconds for surface blocks (row 0)
  const TILE_MINE_MULTIPLIER = {
    [TILE_DIRT]: 1.0,
    [TILE_IRON]: 1.5,
    [TILE_WATER]: 0.8,
    [TILE_COBALT]: 2.0,
    [TILE_GADGET]: 2.5,
    [TILE_COPPER]: 1.4,
    [TILE_TIN]: 1.3,
    [TILE_COAL]: 1.0,
    [TILE_LEAD]: 1.6,
    [TILE_SILVER]: 1.8,
    [TILE_GOLD]: 2.2,
    [TILE_QUARTZ]: 1.7,
    [TILE_REDSTONE]: 2.3,
    [TILE_EMERALD]: 2.5,
    [TILE_DIAMOND]: 3.0,
    [TILE_RUBY]: 2.8
  };

  /* -- Movement -- */
  const BASE_MOVE_INTERVAL = 0.15; // seconds per tile (base, before upgrades)

  /* -- Upgrade costs (resource units) -- */
  const UPGRADE_DEFS = [
    { name: 'Weapon Damage', key: 'weaponDamage', baseCost: 30, perLevel: 20 },
    { name: 'Fire Rate', key: 'fireRate', baseCost: 25, perLevel: 15 },
    { name: 'Dome HP', key: 'domeHP', baseCost: 40, perLevel: 25 },
    { name: 'Drill Speed', key: 'drillSpeed', baseCost: 20, perLevel: 10 },
    { name: 'Carry Capacity', key: 'carryCapacity', baseCost: 20, perLevel: 10 },
    { name: 'Move Speed', key: 'moveSpeed', baseCost: 25, perLevel: 15 },
    { name: 'Mining Tools', key: 'miningTools', baseCost: 35, perLevel: 20 }
  ];

  /* -- Unlockable Gadgets/Tools -- */
  const GADGET_DEFS = [
    {
      key: 'drill', name: 'Drill Gadget', icon: '\u26CF',
      desc: 'Mines a column downward. 30% faster on consecutive same-column tiles.',
      costIron: 25, costCobalt: 0, shortcut: '1'
    },
    {
      key: 'blastTool', name: 'Blast Mining', icon: '\u{1F4A5}',
      desc: 'Clears a 3x3 area. Costs 10 iron per blast. 5s cooldown.',
      costIron: 30, costCobalt: 0, shortcut: '2'
    },
    {
      key: 'scanner', name: 'Scanner', icon: '\u{1F50D}',
      desc: 'Reveals resource types in a 3-tile radius around the miner.',
      costIron: 35, costCobalt: 10, shortcut: '3'
    },
    {
      key: 'reinforcedDome', name: 'Reinforced Dome', icon: '\u{1F6E1}',
      desc: 'Dome takes 25% less damage from enemies. Passive.',
      costIron: 50, costCobalt: 25, shortcut: '4'
    },
    {
      key: 'teleporter', name: 'Teleporter', icon: '\u{1F300}',
      desc: 'Instantly return to dome surface. 30s cooldown.',
      costIron: 30, costCobalt: 15, shortcut: '5'
    }
  ];

  const GADGET_TOOL_COOLDOWNS = {
    blastTool: 5,   // seconds
    teleporter: 30   // seconds
  };

  /* -- Upgrade Tree -- */
  // Each node: id, name, icon, branch, costs per level [{iron, cobalt, water}],
  //   maxLevel, prereqs (ids that must be maxed or at least level 1), upgradeKey (links to game stat)
  // type: 'stat' = upgradeable stat, 'gadget' = unlockable tool/gadget (1 level)
  const UPGRADE_TREE = [
    // =============================================================
    // === Dome Branch (25 nodes) ===
    // =============================================================
    // -- Shield Capacity chain (7 levels) --
    { id: 'shield1', name: 'Shield Cap. L1', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield2', name: 'Shield Cap. L2', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ iron: 35, cobalt: 10 }], maxLevel: 1, prereqs: ['shield1'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield3', name: 'Shield Cap. L3', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ iron: 50, cobalt: 20, copper: 10 }], maxLevel: 1, prereqs: ['shield2'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield4', name: 'Shield Cap. L4', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ iron: 60, silver: 15, cobalt: 25 }], maxLevel: 1, prereqs: ['shield3'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield5', name: 'Shield Cap. L5', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ gold: 20, cobalt: 30, diamond: 5 }], maxLevel: 1, prereqs: ['shield4'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield6', name: 'Shield Cap. L6', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ gold: 30, diamond: 10, ruby: 5 }], maxLevel: 1, prereqs: ['shield5'],
      upgradeKey: 'domeHP', type: 'stat' },
    { id: 'shield7', name: 'Shield Cap. L7', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ diamond: 15, ruby: 12, emerald: 10 }], maxLevel: 1, prereqs: ['shield6'],
      upgradeKey: 'domeHP', type: 'stat' },
    // -- Shield Recharge chain (4 levels) --
    { id: 'shieldRecharge1', name: 'Shield Rech. L1', icon: '\u26A1', branch: 'dome',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    { id: 'shieldRecharge2', name: 'Shield Rech. L2', icon: '\u26A1', branch: 'dome',
      costs: [{ iron: 40, cobalt: 15, water: 10 }], maxLevel: 1, prereqs: ['shieldRecharge1'],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    { id: 'shieldRecharge3', name: 'Shield Rech. L3', icon: '\u26A1', branch: 'dome',
      costs: [{ iron: 55, silver: 12, water: 20 }], maxLevel: 1, prereqs: ['shieldRecharge2'],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    { id: 'shieldRecharge4', name: 'Shield Rech. L4', icon: '\u26A1', branch: 'dome',
      costs: [{ gold: 15, quartz: 20, cobalt: 25 }], maxLevel: 1, prereqs: ['shieldRecharge3'],
      upgradeKey: 'shieldRecharge', type: 'stat' },
    // -- Gadgets --
    { id: 'reinforcedDome', name: 'Reinforced Dome', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ iron: 50, cobalt: 25, copper: 15 }], maxLevel: 1, prereqs: ['shield2'],
      upgradeKey: 'reinforcedDome', type: 'gadget' },
    { id: 'autoRepair', name: 'Auto-Repair L1', icon: '\u{1F527}', branch: 'dome',
      costs: [{ iron: 40, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['shieldRecharge2'],
      upgradeKey: 'autoRepair', type: 'gadget' },
    { id: 'autoRepair2', name: 'Auto-Repair L2', icon: '\u{1F527}', branch: 'dome',
      costs: [{ silver: 20, gold: 10, cobalt: 20 }], maxLevel: 1, prereqs: ['autoRepair'],
      upgradeKey: 'autoRepairSpeed', type: 'stat' },
    { id: 'autoRepair3', name: 'Auto-Repair L3', icon: '\u{1F527}', branch: 'dome',
      costs: [{ gold: 25, quartz: 15, diamond: 5 }], maxLevel: 1, prereqs: ['autoRepair2'],
      upgradeKey: 'autoRepairSpeed', type: 'stat' },
    { id: 'domeExpansion', name: 'Dome Expansion', icon: '\u{1F310}', branch: 'dome',
      costs: [{ silver: 25, gold: 15, cobalt: 30 }], maxLevel: 1, prereqs: ['shield3'],
      upgradeKey: 'domeExpansion', type: 'gadget' },
    { id: 'energyShield', name: 'Energy Shield', icon: '\u26A1', branch: 'dome',
      costs: [{ diamond: 10, ruby: 8, emerald: 10, gold: 20 }], maxLevel: 1, prereqs: ['shield4', 'domeExpansion'],
      upgradeKey: 'energyShield', type: 'gadget' },
    // -- New dome abilities --
    { id: 'damageReflect', name: 'Damage Reflect', icon: '\u{1F4A2}', branch: 'dome',
      costs: [{ silver: 18, copper: 25, redstone: 10 }], maxLevel: 1, prereqs: ['reinforcedDome'],
      upgradeKey: 'damageReflect', type: 'gadget' },
    { id: 'damageReflect2', name: 'Reflect L2', icon: '\u{1F4A2}', branch: 'dome',
      costs: [{ gold: 20, redstone: 15, ruby: 5 }], maxLevel: 1, prereqs: ['damageReflect'],
      upgradeKey: 'damageReflect', type: 'stat' },
    { id: 'emergencyShield', name: 'Emergency Shield', icon: '\u{1F6E1}', branch: 'dome',
      costs: [{ diamond: 12, emerald: 15, ruby: 10, gold: 25 }], maxLevel: 1, prereqs: ['energyShield', 'shieldRecharge4'],
      upgradeKey: 'emergencyShield', type: 'gadget' },
    { id: 'shieldRegen1', name: 'Shield Regen L1', icon: '\u{1F49A}', branch: 'dome',
      costs: [{ iron: 30, water: 15 }], maxLevel: 1, prereqs: ['shieldRecharge1'],
      upgradeKey: 'shieldRegen', type: 'stat' },
    { id: 'shieldRegen2', name: 'Shield Regen L2', icon: '\u{1F49A}', branch: 'dome',
      costs: [{ iron: 50, water: 25, cobalt: 15 }], maxLevel: 1, prereqs: ['shieldRegen1'],
      upgradeKey: 'shieldRegen', type: 'stat' },
    { id: 'shieldRegen3', name: 'Shield Regen L3', icon: '\u{1F49A}', branch: 'dome',
      costs: [{ silver: 15, water: 35, quartz: 10 }], maxLevel: 1, prereqs: ['shieldRegen2'],
      upgradeKey: 'shieldRegen', type: 'stat' },
    { id: 'fortifiedBase', name: 'Fortified Base', icon: '\u{1F3F0}', branch: 'dome',
      costs: [{ gold: 30, cobalt: 35, diamond: 8 }], maxLevel: 1, prereqs: ['shield5', 'reinforcedDome'],
      upgradeKey: 'fortifiedBase', type: 'gadget' },
    { id: 'lastStand', name: 'Last Stand', icon: '\u{1F4AA}', branch: 'dome',
      costs: [{ ruby: 15, diamond: 10, emerald: 12 }], maxLevel: 1, prereqs: ['emergencyShield'],
      upgradeKey: 'lastStand', type: 'gadget' },

    // =============================================================
    // === Mining Branch (27 nodes) ===
    // =============================================================
    // -- Mining Tools chain (7 levels) --
    { id: 'mining1', name: 'Mining Tools L1', icon: '\u26CF', branch: 'mining',
      costs: [{ iron: 15 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining2', name: 'Mining Tools L2', icon: '\u26CF', branch: 'mining',
      costs: [{ iron: 30, cobalt: 10 }], maxLevel: 1, prereqs: ['mining1'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining3', name: 'Mining Tools L3', icon: '\u26CF', branch: 'mining',
      costs: [{ iron: 50, cobalt: 25, copper: 10 }], maxLevel: 1, prereqs: ['mining2'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining4', name: 'Mining Tools L4', icon: '\u26CF', branch: 'mining',
      costs: [{ iron: 60, silver: 15, coal: 20 }], maxLevel: 1, prereqs: ['mining3'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining5', name: 'Mining Tools L5', icon: '\u26CF', branch: 'mining',
      costs: [{ gold: 20, cobalt: 30, redstone: 10 }], maxLevel: 1, prereqs: ['mining4'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining6', name: 'Mining Tools L6', icon: '\u26CF', branch: 'mining',
      costs: [{ gold: 30, redstone: 15, emerald: 8 }], maxLevel: 1, prereqs: ['mining5'],
      upgradeKey: 'miningTools', type: 'stat' },
    { id: 'mining7', name: 'Mining Tools L7', icon: '\u26CF', branch: 'mining',
      costs: [{ diamond: 12, ruby: 10, redstone: 20 }], maxLevel: 1, prereqs: ['mining6'],
      upgradeKey: 'miningTools', type: 'stat' },
    // -- Carry Capacity chain (5 levels) --
    { id: 'carry1', name: 'Carry Cap. L1', icon: '\u{1F4E6}', branch: 'mining',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry2', name: 'Carry Cap. L2', icon: '\u{1F4E6}', branch: 'mining',
      costs: [{ iron: 35, cobalt: 15, tin: 10 }], maxLevel: 1, prereqs: ['carry1'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry3', name: 'Carry Cap. L3', icon: '\u{1F4E6}', branch: 'mining',
      costs: [{ iron: 50, silver: 10, lead: 15 }], maxLevel: 1, prereqs: ['carry2'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry4', name: 'Carry Cap. L4', icon: '\u{1F4E6}', branch: 'mining',
      costs: [{ gold: 15, cobalt: 20, tin: 20 }], maxLevel: 1, prereqs: ['carry3'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    { id: 'carry5', name: 'Carry Cap. L5', icon: '\u{1F4E6}', branch: 'mining',
      costs: [{ gold: 25, diamond: 5, lead: 20 }], maxLevel: 1, prereqs: ['carry4'],
      upgradeKey: 'carryCapacity', type: 'stat' },
    // -- Gadgets --
    { id: 'drill', name: 'Drill Gadget', icon: '\u26CF', branch: 'mining',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: ['mining1'],
      upgradeKey: 'drill', type: 'gadget' },
    { id: 'magnet', name: 'Magnet', icon: '\u{1F9F2}', branch: 'mining',
      costs: [{ iron: 40, copper: 25, lead: 15 }], maxLevel: 1, prereqs: ['carry2'],
      upgradeKey: 'magnet', type: 'gadget' },
    { id: 'fortune', name: 'Fortune', icon: '\u2728', branch: 'mining',
      costs: [{ gold: 15, silver: 20, quartz: 10 }], maxLevel: 1, prereqs: ['mining3'],
      upgradeKey: 'fortune', type: 'gadget' },
    { id: 'silkTouch', name: 'Silk Touch', icon: '\u{1F48E}', branch: 'mining',
      costs: [{ diamond: 8, emerald: 10, ruby: 5, gold: 15 }], maxLevel: 1, prereqs: ['fortune', 'mining4'],
      upgradeKey: 'silkTouch', type: 'gadget' },
    // -- New mining abilities --
    { id: 'oreDetector', name: 'Ore Detector', icon: '\u{1F4E1}', branch: 'mining',
      costs: [{ iron: 30, copper: 15, cobalt: 10 }], maxLevel: 1, prereqs: ['mining2'],
      upgradeKey: 'oreDetector', type: 'gadget' },
    { id: 'oreDetector2', name: 'Ore Detect L2', icon: '\u{1F4E1}', branch: 'mining',
      costs: [{ silver: 15, quartz: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['oreDetector'],
      upgradeKey: 'oreDetector', type: 'stat' },
    { id: 'speedMining1', name: 'Speed Mining L1', icon: '\u{1F4A8}', branch: 'mining',
      costs: [{ iron: 35, coal: 20 }], maxLevel: 1, prereqs: ['mining2'],
      upgradeKey: 'speedMining', type: 'stat' },
    { id: 'speedMining2', name: 'Speed Mining L2', icon: '\u{1F4A8}', branch: 'mining',
      costs: [{ iron: 55, silver: 10, coal: 25 }], maxLevel: 1, prereqs: ['speedMining1'],
      upgradeKey: 'speedMining', type: 'stat' },
    { id: 'speedMining3', name: 'Speed Mining L3', icon: '\u{1F4A8}', branch: 'mining',
      costs: [{ gold: 15, redstone: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['speedMining2'],
      upgradeKey: 'speedMining', type: 'stat' },
    { id: 'autoMine', name: 'Auto-Mine', icon: '\u{1F916}', branch: 'mining',
      costs: [{ gold: 20, cobalt: 25, copper: 30 }], maxLevel: 1, prereqs: ['mining4', 'speedMining2'],
      upgradeKey: 'autoMine', type: 'gadget' },
    { id: 'tunnelBore', name: 'Tunnel Bore', icon: '\u{1F6A7}', branch: 'mining',
      costs: [{ gold: 25, redstone: 15, diamond: 5, cobalt: 30 }], maxLevel: 1, prereqs: ['mining5', 'drill'],
      upgradeKey: 'tunnelBore', type: 'gadget' },
    { id: 'magnetRange1', name: 'Magnet Range L1', icon: '\u{1F9F2}', branch: 'mining',
      costs: [{ silver: 15, copper: 20, lead: 10 }], maxLevel: 1, prereqs: ['magnet'],
      upgradeKey: 'magnetRange', type: 'stat' },
    { id: 'magnetRange2', name: 'Magnet Range L2', icon: '\u{1F9F2}', branch: 'mining',
      costs: [{ gold: 15, quartz: 10, lead: 20 }], maxLevel: 1, prereqs: ['magnetRange1'],
      upgradeKey: 'magnetRange', type: 'stat' },
    { id: 'fortuneL2', name: 'Fortune L2', icon: '\u2728', branch: 'mining',
      costs: [{ gold: 25, emerald: 10, ruby: 8 }], maxLevel: 1, prereqs: ['fortune'],
      upgradeKey: 'fortune', type: 'stat' },
    { id: 'veinMiner', name: 'Vein Miner', icon: '\u{1F48E}', branch: 'mining',
      costs: [{ diamond: 10, ruby: 8, emerald: 12, gold: 20 }], maxLevel: 1, prereqs: ['silkTouch', 'tunnelBore'],
      upgradeKey: 'veinMiner', type: 'gadget' },

    // =============================================================
    // === Movement Branch (25 nodes) ===
    // =============================================================
    // -- Move Speed chain (7 levels) --
    { id: 'speed1', name: 'Move Speed L1', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ iron: 15 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed2', name: 'Move Speed L2', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ iron: 25, cobalt: 8 }], maxLevel: 1, prereqs: ['speed1'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed3', name: 'Move Speed L3', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ iron: 40, cobalt: 15, copper: 10 }], maxLevel: 1, prereqs: ['speed2'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed4', name: 'Move Speed L4', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ iron: 55, silver: 12, coal: 15 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed5', name: 'Move Speed L5', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ gold: 15, cobalt: 25, redstone: 8 }], maxLevel: 1, prereqs: ['speed4'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed6', name: 'Move Speed L6', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ gold: 25, redstone: 12, emerald: 5 }], maxLevel: 1, prereqs: ['speed5'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    { id: 'speed7', name: 'Move Speed L7', icon: '\u{1F3C3}', branch: 'movement',
      costs: [{ diamond: 8, ruby: 8, emerald: 8 }], maxLevel: 1, prereqs: ['speed6'],
      upgradeKey: 'moveSpeed', type: 'stat' },
    // -- Gadgets --
    { id: 'teleporter', name: 'Teleporter', icon: '\u{1F300}', branch: 'movement',
      costs: [{ iron: 30, cobalt: 15 }], maxLevel: 1, prereqs: ['speed1'],
      upgradeKey: 'teleporter', type: 'gadget' },
    { id: 'jetpack', name: 'Jetpack', icon: '\u{1F680}', branch: 'movement',
      costs: [{ iron: 45, copper: 20, coal: 25 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'jetpack', type: 'gadget' },
    { id: 'phaseShift', name: 'Phase Shift', icon: '\u{1F47B}', branch: 'movement',
      costs: [{ silver: 20, gold: 10, quartz: 15, cobalt: 20 }], maxLevel: 1, prereqs: ['speed4'],
      upgradeKey: 'phaseShift', type: 'gadget' },
    { id: 'echoLocation', name: 'Echo Location', icon: '\u{1F4E1}', branch: 'movement',
      costs: [{ copper: 15, tin: 20, cobalt: 15 }], maxLevel: 1, prereqs: ['speed2'],
      upgradeKey: 'echoLocation', type: 'gadget' },
    { id: 'echoLocation2', name: 'Echo Loc. L2', icon: '\u{1F4E1}', branch: 'movement',
      costs: [{ silver: 15, gold: 10, redstone: 8 }], maxLevel: 1, prereqs: ['echoLocation'],
      upgradeKey: 'echoLocation', type: 'stat' },
    { id: 'echoLocation3', name: 'Echo Loc. L3', icon: '\u{1F4E1}', branch: 'movement',
      costs: [{ gold: 20, quartz: 15, redstone: 12 }], maxLevel: 1, prereqs: ['echoLocation2'],
      upgradeKey: 'echoLocation', type: 'stat' },
    // -- New movement abilities --
    { id: 'doubleJump', name: 'Double Jump', icon: '\u{1F998}', branch: 'movement',
      costs: [{ iron: 35, copper: 20, cobalt: 12 }], maxLevel: 1, prereqs: ['speed2'],
      upgradeKey: 'doubleJump', type: 'gadget' },
    { id: 'wallClimb', name: 'Wall Climb', icon: '\u{1F9D7}', branch: 'movement',
      costs: [{ iron: 45, cobalt: 20, tin: 15 }], maxLevel: 1, prereqs: ['speed3', 'doubleJump'],
      upgradeKey: 'wallClimb', type: 'gadget' },
    { id: 'dash', name: 'Dash', icon: '\u{1F4A8}', branch: 'movement',
      costs: [{ silver: 15, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['speed3'],
      upgradeKey: 'dash', type: 'gadget' },
    { id: 'dash2', name: 'Dash L2', icon: '\u{1F4A8}', branch: 'movement',
      costs: [{ gold: 12, redstone: 10, cobalt: 18 }], maxLevel: 1, prereqs: ['dash'],
      upgradeKey: 'dash', type: 'stat' },
    { id: 'undergroundRadar', name: 'Ground Radar', icon: '\u{1F4E1}', branch: 'movement',
      costs: [{ silver: 20, copper: 25, quartz: 10 }], maxLevel: 1, prereqs: ['echoLocation'],
      upgradeKey: 'undergroundRadar', type: 'gadget' },
    { id: 'undergroundRadar2', name: 'Radar L2', icon: '\u{1F4E1}', branch: 'movement',
      costs: [{ gold: 18, quartz: 15, redstone: 10 }], maxLevel: 1, prereqs: ['undergroundRadar'],
      upgradeKey: 'undergroundRadar', type: 'stat' },
    { id: 'teleportCooldown1', name: 'Teleport CDR L1', icon: '\u{1F300}', branch: 'movement',
      costs: [{ silver: 12, cobalt: 15, copper: 10 }], maxLevel: 1, prereqs: ['teleporter'],
      upgradeKey: 'teleportCooldown', type: 'stat' },
    { id: 'teleportCooldown2', name: 'Teleport CDR L2', icon: '\u{1F300}', branch: 'movement',
      costs: [{ gold: 15, quartz: 12, redstone: 8 }], maxLevel: 1, prereqs: ['teleportCooldown1'],
      upgradeKey: 'teleportCooldown', type: 'stat' },
    { id: 'jetpackFuel1', name: 'Jetpack Fuel L1', icon: '\u{1F680}', branch: 'movement',
      costs: [{ copper: 25, coal: 30, cobalt: 15 }], maxLevel: 1, prereqs: ['jetpack'],
      upgradeKey: 'jetpackFuel', type: 'stat' },
    { id: 'jetpackFuel2', name: 'Jetpack Fuel L2', icon: '\u{1F680}', branch: 'movement',
      costs: [{ gold: 15, coal: 35, redstone: 10 }], maxLevel: 1, prereqs: ['jetpackFuel1'],
      upgradeKey: 'jetpackFuel', type: 'stat' },
    { id: 'phaseShift2', name: 'Phase Shift L2', icon: '\u{1F47B}', branch: 'movement',
      costs: [{ gold: 20, quartz: 20, diamond: 5 }], maxLevel: 1, prereqs: ['phaseShift'],
      upgradeKey: 'phaseShift', type: 'stat' },

    // =============================================================
    // === Weapon Branch (27 nodes) ===
    // =============================================================
    // -- Fire Rate chain (6 levels) --
    { id: 'fireRate1', name: 'Fire Rate L1', icon: '\u{1F525}', branch: 'weapon',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate2', name: 'Fire Rate L2', icon: '\u{1F525}', branch: 'weapon',
      costs: [{ iron: 35, cobalt: 12 }], maxLevel: 1, prereqs: ['fireRate1'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate3', name: 'Fire Rate L3', icon: '\u{1F525}', branch: 'weapon',
      costs: [{ iron: 50, copper: 15, coal: 10 }], maxLevel: 1, prereqs: ['fireRate2'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate4', name: 'Fire Rate L4', icon: '\u{1F525}', branch: 'weapon',
      costs: [{ silver: 15, gold: 10, redstone: 12 }], maxLevel: 1, prereqs: ['fireRate3'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate5', name: 'Fire Rate L5', icon: '\u{1F525}', branch: 'weapon',
      costs: [{ gold: 20, redstone: 15, ruby: 5 }], maxLevel: 1, prereqs: ['fireRate4'],
      upgradeKey: 'fireRate', type: 'stat' },
    { id: 'fireRate6', name: 'Fire Rate L6', icon: '\u{1F525}', branch: 'weapon',
      costs: [{ diamond: 8, ruby: 10, redstone: 18 }], maxLevel: 1, prereqs: ['fireRate5'],
      upgradeKey: 'fireRate', type: 'stat' },
    // -- Damage chain (7 levels) --
    { id: 'damage1', name: 'Damage L1', icon: '\u2694', branch: 'weapon',
      costs: [{ iron: 25 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage2', name: 'Damage L2', icon: '\u2694', branch: 'weapon',
      costs: [{ iron: 40, cobalt: 15 }], maxLevel: 1, prereqs: ['damage1'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage3', name: 'Damage L3', icon: '\u2694', branch: 'weapon',
      costs: [{ iron: 60, cobalt: 30, copper: 15 }], maxLevel: 1, prereqs: ['damage2'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage4', name: 'Damage L4', icon: '\u2694', branch: 'weapon',
      costs: [{ silver: 20, gold: 15, redstone: 10 }], maxLevel: 1, prereqs: ['damage3'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage5', name: 'Damage L5', icon: '\u2694', branch: 'weapon',
      costs: [{ diamond: 8, ruby: 10, emerald: 8, gold: 20 }], maxLevel: 1, prereqs: ['damage4'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage6', name: 'Damage L6', icon: '\u2694', branch: 'weapon',
      costs: [{ diamond: 12, ruby: 12, gold: 25 }], maxLevel: 1, prereqs: ['damage5'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    { id: 'damage7', name: 'Damage L7', icon: '\u2694', branch: 'weapon',
      costs: [{ diamond: 15, ruby: 15, emerald: 12 }], maxLevel: 1, prereqs: ['damage6'],
      upgradeKey: 'weaponDamage', type: 'stat' },
    // -- Drill Speed chain (5 levels) --
    { id: 'drillSpeed1', name: 'Drill Speed L1', icon: '\u{1F529}', branch: 'weapon',
      costs: [{ iron: 20 }], maxLevel: 1, prereqs: [],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed2', name: 'Drill Speed L2', icon: '\u{1F529}', branch: 'weapon',
      costs: [{ iron: 35, cobalt: 10, tin: 8 }], maxLevel: 1, prereqs: ['drillSpeed1'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed3', name: 'Drill Speed L3', icon: '\u{1F529}', branch: 'weapon',
      costs: [{ iron: 50, silver: 10, coal: 15 }], maxLevel: 1, prereqs: ['drillSpeed2'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed4', name: 'Drill Speed L4', icon: '\u{1F529}', branch: 'weapon',
      costs: [{ gold: 12, redstone: 10, cobalt: 20 }], maxLevel: 1, prereqs: ['drillSpeed3'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    { id: 'drillSpeed5', name: 'Drill Speed L5', icon: '\u{1F529}', branch: 'weapon',
      costs: [{ gold: 20, diamond: 5, redstone: 15 }], maxLevel: 1, prereqs: ['drillSpeed4'],
      upgradeKey: 'drillSpeed', type: 'stat' },
    // -- Gadgets --
    { id: 'blastTool', name: 'Blast Mining', icon: '\u{1F4A5}', branch: 'weapon',
      costs: [{ iron: 30, coal: 10 }], maxLevel: 1, prereqs: ['damage1'],
      upgradeKey: 'blastTool', type: 'gadget' },
    { id: 'scanner', name: 'Scanner', icon: '\u{1F50D}', branch: 'weapon',
      costs: [{ iron: 35, cobalt: 10 }], maxLevel: 1, prereqs: ['drillSpeed1'],
      upgradeKey: 'scanner', type: 'gadget' },
    { id: 'chainLightning', name: 'Chain Lightning', icon: '\u26A1', branch: 'weapon',
      costs: [{ silver: 20, copper: 25, redstone: 15 }], maxLevel: 1, prereqs: ['damage3', 'fireRate2'],
      upgradeKey: 'chainLightning', type: 'gadget' },
    { id: 'freezeRay', name: 'Freeze Ray', icon: '\u2744', branch: 'weapon',
      costs: [{ water: 30, quartz: 15, silver: 10 }], maxLevel: 1, prereqs: ['fireRate3'],
      upgradeKey: 'freezeRay', type: 'gadget' },
    { id: 'plasmaCannon', name: 'Plasma Cannon', icon: '\u{1F4A5}', branch: 'weapon',
      costs: [{ diamond: 10, ruby: 12, redstone: 15, gold: 20 }], maxLevel: 1, prereqs: ['damage4', 'chainLightning'],
      upgradeKey: 'plasmaCannon', type: 'gadget' },
    // -- New weapon abilities --
    { id: 'multiShot', name: 'Multi-Shot', icon: '\u{1F4AB}', branch: 'weapon',
      costs: [{ silver: 18, copper: 20, coal: 15 }], maxLevel: 1, prereqs: ['fireRate2', 'damage2'],
      upgradeKey: 'multiShot', type: 'gadget' },
    { id: 'multiShot2', name: 'Multi-Shot L2', icon: '\u{1F4AB}', branch: 'weapon',
      costs: [{ gold: 15, redstone: 12, cobalt: 20 }], maxLevel: 1, prereqs: ['multiShot'],
      upgradeKey: 'multiShot', type: 'stat' },
    { id: 'homingShots', name: 'Homing Shots', icon: '\u{1F3AF}', branch: 'weapon',
      costs: [{ gold: 20, quartz: 15, redstone: 12 }], maxLevel: 1, prereqs: ['damage3', 'fireRate3'],
      upgradeKey: 'homingShots', type: 'gadget' },
    { id: 'turretSpeed1', name: 'Turret Speed L1', icon: '\u{1F504}', branch: 'weapon',
      costs: [{ iron: 25, copper: 15 }], maxLevel: 1, prereqs: ['fireRate1'],
      upgradeKey: 'turretSpeed', type: 'stat' },
    { id: 'turretSpeed2', name: 'Turret Speed L2', icon: '\u{1F504}', branch: 'weapon',
      costs: [{ iron: 40, cobalt: 15, tin: 10 }], maxLevel: 1, prereqs: ['turretSpeed1'],
      upgradeKey: 'turretSpeed', type: 'stat' },
    { id: 'turretSpeed3', name: 'Turret Speed L3', icon: '\u{1F504}', branch: 'weapon',
      costs: [{ silver: 15, gold: 10, redstone: 8 }], maxLevel: 1, prereqs: ['turretSpeed2'],
      upgradeKey: 'turretSpeed', type: 'stat' },
    { id: 'criticalHit', name: 'Critical Hit', icon: '\u{1F4A5}', branch: 'weapon',
      costs: [{ gold: 18, redstone: 15, cobalt: 20 }], maxLevel: 1, prereqs: ['damage3'],
      upgradeKey: 'criticalHit', type: 'gadget' },
    { id: 'criticalHit2', name: 'Critical L2', icon: '\u{1F4A5}', branch: 'weapon',
      costs: [{ gold: 25, ruby: 8, redstone: 18 }], maxLevel: 1, prereqs: ['criticalHit'],
      upgradeKey: 'criticalHit', type: 'stat' },
    { id: 'explosiveRounds', name: 'Explosive Rounds', icon: '\u{1F4A3}', branch: 'weapon',
      costs: [{ diamond: 8, ruby: 10, redstone: 20, gold: 15 }], maxLevel: 1, prereqs: ['plasmaCannon', 'criticalHit'],
      upgradeKey: 'explosiveRounds', type: 'gadget' },
    { id: 'freezeRay2', name: 'Freeze Ray L2', icon: '\u2744', branch: 'weapon',
      costs: [{ water: 40, quartz: 20, diamond: 5 }], maxLevel: 1, prereqs: ['freezeRay'],
      upgradeKey: 'freezeRay', type: 'stat' },
    { id: 'chainLightning2', name: 'Chain Light. L2', icon: '\u26A1', branch: 'weapon',
      costs: [{ gold: 20, redstone: 18, emerald: 8 }], maxLevel: 1, prereqs: ['chainLightning'],
      upgradeKey: 'chainLightning', type: 'stat' }
  ];

  // Upgrade effect descriptions (keyed by upgradeKey)
  const UPGRADE_EFFECT_DESC = {
    domeHP: '+25 max dome HP per level',
    shieldRecharge: 'Shield gadget recharges faster',
    shieldRegen: '+1 HP/5s passive dome regen per level',
    reinforcedDome: 'Dome takes 25% less damage (passive)',
    autoRepair: 'Dome regenerates +2 HP every 5s',
    autoRepairSpeed: 'Auto-repair heals faster per level',
    domeExpansion: '+75 max dome HP, instant heal',
    energyShield: 'Dome takes 15% less damage (stacks with Reinforced)',
    damageReflect: 'Reflects 15% damage back to attackers per level',
    emergencyShield: '3s invincibility when dome drops below 15% HP (60s CD)',
    fortifiedBase: 'Dome takes 10% less damage, +50 max HP',
    lastStand: 'Survive one lethal hit with 1 HP (once per wave)',
    miningTools: '-20% mining time per level',
    carryCapacity: '+20 carry capacity per level',
    drill: 'Mines a column downward, 30% faster on consecutive tiles',
    magnet: 'Auto-collect dropped resources within 2 tiles',
    magnetRange: '+1 magnet range per level',
    fortune: '30% chance to double ore yield (+10% per extra level)',
    silkTouch: 'Preserves full resource value when mining',
    oreDetector: 'Highlights nearby ores through walls (+range per level)',
    speedMining: '-10% mining time per level (stacks with tools)',
    autoMine: 'Auto-mines adjacent blocks when idle for 2s',
    tunnelBore: 'Mine 3 blocks in a line in the direction you face',
    veinMiner: 'Mining an ore mines the entire connected vein',
    moveSpeed: '15% faster movement per level',
    teleporter: 'Instantly return to surface (30s cooldown)',
    teleportCooldown: '-5s teleporter cooldown per level',
    jetpack: 'Fly upward through empty tiles',
    jetpackFuel: '+50% jetpack duration per level',
    phaseShift: 'Pass through a single block once (+uses per level)',
    echoLocation: 'Extends scanner range by +2 tiles per level',
    doubleJump: 'Jump up 2 empty tiles vertically at once',
    wallClimb: 'Move up adjacent to solid walls without empty space',
    dash: 'Quick-move 3 empty tiles in one direction (+range per level)',
    undergroundRadar: 'Reveals wider area around player (+range per level)',
    fireRate: '+0.3 shots/sec per level',
    weaponDamage: '+5 damage per level',
    drillSpeed: '-0.05s drill interval per level',
    blastTool: 'Clears a 3x3 area (costs 10 iron, 5s cooldown)',
    scanner: 'Reveals resources in 3-tile radius (passive)',
    chainLightning: 'Shots arc to 2 nearby enemies for 40% damage (+1 arc/level)',
    freezeRay: 'Shots stun enemies in 60px radius for 0.8s (+0.3s/level)',
    plasmaCannon: 'Shots deal 60% AoE damage in 70px radius',
    multiShot: 'Fire 2 projectiles per shot (+1 per level)',
    homingShots: 'Projectiles track nearest enemy automatically',
    turretSpeed: '+30% turret rotation speed per level',
    criticalHit: '15% chance to deal 2.5x damage (+5% per level)',
    explosiveRounds: 'All shots explode on impact for 40% AoE'
  };

  // Mining difficulty label from depth multiplier
  function getMiningDifficultyLabel(depthMult) {
    if (depthMult < 1.2) return 'Very Easy';
    if (depthMult < 1.8) return 'Easy';
    if (depthMult < 2.4) return 'Medium';
    if (depthMult < 3.0) return 'Hard';
    return 'Very Hard';
  }

  // Precompute node positions for the tree layout
  // Layout: root at top center, 4 branches below
  const TREE_BRANCH_ORDER = ['dome', 'mining', 'movement', 'weapon'];
  const TREE_BRANCH_LABELS = { dome: 'DOME', mining: 'MINING', movement: 'MOVEMENT', weapon: 'WEAPON' };
  const TREE_BRANCH_COLORS = { dome: '#4af', mining: '#fa0', movement: '#0f0', weapon: '#f44' };
  const TREE_NODE_W = 240;
  const TREE_NODE_H = 120;

  /* ======================================================================
     DOM
     ====================================================================== */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusView = document.getElementById('statusView');
  const statusWave = document.getElementById('statusWave');
  const statusDome = document.getElementById('statusDome');
  const statusResources = document.getElementById('statusResources');
  const highScoresBody = document.getElementById('highScoresBody');

  /* -- API: Windows integration -- */
  const { User32 } = SZ?.Dlls ?? {};

  /* -- Effects -- */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();
  const starfield = new SZ.GameEffects.Starfield(CANVAS_W, CANVAS_H * 0.85, 160);

  /* ======================================================================
     ANIMATION STATE
     ====================================================================== */

  let animTime = 0; // global animation clock (seconds)

  // Mining / pickaxe swing
  let pickaxeAngle = 0;         // current swing angle (radians)
  let pickaxeSwinging = false;
  let pickaxeSwingTimer = 0;
  const PICKAXE_SWING_DURATION = 0.25;
  let lastMineDir = { dx: 1, dy: 0 }; // direction of last mine action

  // Dome pulse
  let domePulsePhase = 0;
  let domeHitFlash = 0; // flash timer when dome is hit

  // Player idle bob (underground)
  let playerBob = 0;

  // Rock crumble animations
  let crumbleEffects = []; // { x, y, pieces: [{x,y,vx,vy,rot,rotV,size,color}], life }

  // Dust clouds
  let dustClouds = []; // { x, y, alpha, radius, expandRate }

  // Resource reveal glows
  let resourceGlows = []; // { x, y, color, life, radius }

  // Dome shield impact flashes
  let shieldImpacts = []; // { angle, life, intensity }

  // Ambient underground sparkles for resource tiles
  let tileSparkleTimer = 0;

  /* ======================================================================
     GAME STATE
     ====================================================================== */

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Defend your dome from alien waves on the surface', 'while mining resources underground!', '', 'Click/Tap = Fire weapon (surface) / Mine (underground)', 'Arrow Keys/WASD = Move drill underground', 'Space/Tab = Toggle surface / underground'] },
    { title: 'Upgrades & Tips', lines: ['Press U to open the upgrade shop.', 'Upgrade weapon, dome armor, drill, fire rate.', '', 'Mine resources (iron, copper, gold, gems...) for upgrades.', 'Return to the surface before waves arrive!', 'Press H anytime to see this help again.'] },
    { title: 'Gadgets', lines: ['Choose a primary gadget at game start.', 'Find golden gadget chambers underground (2x2 tiles).', '', 'Press R to activate the Repellent Field.', 'Press B to use Blast Mining charges.', 'Gadgets from chambers activate on pickup!'] },
    { title: 'Tools', lines: ['Unlock tools from the upgrade panel (click "Tools").', 'Press 1-5 to select/activate unlocked tools:', '', '1=Drill (fast column mining), 2=Blast (3x3 clear)', '3=Scanner (reveals nearby ores), 4=Reinforced Dome', '5=Teleporter (instant return to surface)'] }
  ];

  let state = STATE_READY;
  let currentView = VIEW_SURFACE;
  let transitionProgress = 0;
  let transitionTarget = null;

  let domeHP = BASE_DOME_HP;
  let maxDomeHP = BASE_DOME_HP;

  let resources = { iron: 0, water: 0, cobalt: 0, copper: 0, gold: 0, tin: 0, silver: 0, lead: 0, coal: 0, quartz: 0, redstone: 0, diamond: 0, emerald: 0, ruby: 0 };
  let carried = 0;
  let carryCapacity = BASE_CARRY_CAPACITY;

  let weaponDamage = BASE_WEAPON_DAMAGE;
  let fireRate = BASE_FIRE_RATE;
  let fireCooldown = 0;
  let projectiles = [];
  let aimX = 0, aimY = 0; // mouse aim position on surface
  let fireRequested = false; // player clicked to fire
  let turretAngle = -Math.PI / 2; // turret barrel angle (radians); default = straight up
  let mouseAimX = -1, mouseAimY = -1; // continuous mouse position for turret aiming
  const TURRET_BARREL_LENGTH = 40;
  const TURRET_KEYBOARD_SPEED = 2.5; // radians per second

  let drillSpeed = BASE_DRILL_SPEED;
  let drillX = Math.floor(GRID_COLS / 2);
  let drillY = 0;
  let drillTimer = 0;

  let cameraX = 0;
  let cameraY = 0;

  let upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0, moveSpeed: 0, miningTools: 0 };

  let enemies = [];
  let waveNumber = 0;
  let waveTimer = 0;
  let waveActive = false;
  let score = 0;

  let undergroundGrid = [];
  let highScores = [];

  /* ── Persistent tile mining HP ── */
  let tileHP = [];                   // 2D array [row][col] of remaining mining HP (null = full)
  let tileMaxHP = [];                // 2D array [row][col] of max mining HP

  /* ── Mining state ── */
  let miningProgress = 0;          // accumulated time toward current mine
  let miningDuration = 0;          // total time required for current mine
  let miningTarget = null;         // {col, row, dx, dy} -- block being mined
  let miningDir = null;            // {dx, dy} -- direction player is mining toward

  /* ── Dropped resources ── */
  let droppedResources = [];       // [{col, row, type, value, age}]

  /* ── Mouse-based underground navigation ── */
  let moveTarget = null;   // {col, row} -- destination tile
  let movePath = null;     // [{col, row}, ...] -- BFS path steps
  let movePathIndex = 0;   // current step index in path
  let moveStepTimer = 0;   // timer for smooth stepping
  let mineTarget = null;   // {col, row, dx, dy} -- queued mine after arrival
  let moveStepInterval = BASE_MOVE_INTERVAL; // effective move interval (affected by upgrades)

  /* ── Gadget System ── */
  let primaryGadget = null; // 'shield'|'repellent'|'orchard'|'droneyard'
  let primaryGadgetState = {};
  let foundGadgets = [];    // gadgets picked up from mine chambers
  let gadgetChambers = [];  // [{r, c, gadgetType, revealed: bool}]
  let gadgetSelectHover = -1; // which card is hovered on selection screen

  /* ── Unlockable Tool/Gadget System ── */
  let unlockedTools = {};       // { drill: true, blastTool: true, ... }
  let activeToolKey = null;     // currently selected tool key
  let toolState = {};           // per-tool runtime state
  let showToolPanel = false;    // whether tool unlock panel is visible in upgrade menu

  /* ── Upgrade Dialog (full-screen tree) ── */
  let upgradeTreeLevels = {};   // { nodeId: currentLevel }
  let upgradeDialogHover = null; // hovered node id
  let upgradeDialogScroll = 0;  // vertical scroll offset
  let stateBeforeUpgradeDialog = null; // state to restore when closing dialog

  /* ── Tooltip ── */
  const tooltip = {
    lines: [],
    x: 0,
    y: 0,
    visible: false,
    delayTimer: 0,
    lastHoverKey: ''  // identity of what we are hovering; resets delay when it changes
  };
  const TOOLTIP_DELAY = 0.2; // seconds before tooltip appears

  /* ── Upgrade Dialog zoom & pan ── */
  let upgradeZoom = 1.0;        // zoom scale factor
  let upgradePanX = 0;          // pan offset X
  let upgradePanY = 0;          // pan offset Y
  let upgradeViewCustomized = false; // true once user manually zooms/pans
  let upgradePanning = false;   // right-click drag active
  let upgradePanStartX = 0;     // drag start mouse X
  let upgradePanStartY = 0;     // drag start mouse Y
  let upgradePanBaseX = 0;      // pan offset at drag start
  let upgradePanBaseY = 0;      // pan offset at drag start

  const PRIMARY_GADGETS = [
    { key: 'shield', name: 'Shield Generator', icon: '\u{1F6E1}', desc: ['Absorbs the first hit of each wave.', 'Recharges when a new wave starts.'] },
    { key: 'repellent', name: 'Repellent Field', icon: '\u{1F300}', desc: ['Press R: slows all enemies to 40%', 'for 5 seconds (30s cooldown).'] },
    { key: 'orchard', name: 'Orchard', icon: '\u{1F333}', desc: ['Every 20s grows a fruit that gives', '+30% mining speed for 10 seconds.'] },
    { key: 'droneyard', name: 'Droneyard', icon: '\u{1F916}', desc: ['A drone auto-carries 10 resources', 'to surface every 15 seconds.'] }
  ];

  const MINE_GADGETS = ['autoCannon', 'stunLaser', 'blastMining', 'probeScanner', 'domeArmor', 'condenser'];
  const MINE_GADGET_NAMES = {
    autoCannon: 'Auto Cannon', stunLaser: 'Stun Laser', blastMining: 'Blast Mining',
    probeScanner: 'Probe Scanner', domeArmor: 'Dome Armor', condenser: 'Condenser'
  };

  const keys = {};

  /* ======================================================================
     DETERMINISTIC SEED FOR TERRAIN TEXTURE
     ====================================================================== */

  // Pre-generate dirt texture noise offsets for each tile
  let dirtNoise = [];
  function generateDirtNoise() {
    dirtNoise = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const dots = [];
        for (let d = 0; d < 6; ++d)
          dots.push({
            ox: Math.random() * (TILE_SIZE - 6) + 3,
            oy: Math.random() * (TILE_SIZE - 6) + 3,
            size: 1 + Math.random() * 2.5,
            shade: Math.random() * 0.3
          });
        row.push(dots);
      }
      dirtNoise.push(row);
    }
  }

  /* ======================================================================
     CANVAS SETUP
     ====================================================================== */

  function setupCanvas() {
    // Fixed internal resolution -- CSS (width:100%; height:100%) scales the
    // canvas to fill the client area. This avoids per-element scaling, keeps
    // tile count constant, and all mouse handlers already translate coordinates
    // via CANVAS_W/rect.width.
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
  }

  /* ======================================================================
     PERSISTENCE
     ====================================================================== */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(waves, pts) {
    highScores.push({ waves, score: pts });
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].waves}</td><td>${highScores[i].score}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ======================================================================
     UNDERGROUND GRID GENERATION
     ====================================================================== */

  // Vein spawn configuration per ore type
  // seedChance: probability that a scan point spawns a vein of this type
  // minLen/maxLen: base vein length range
  // depthLenBonus: multiplier added to maxLen per unit of depth (0..1)
  const VEIN_CONFIG = {
    // Common ores: veins of 3-8, longer at depth
    [TILE_IRON]:     { seedChance: 0.055, minLen: 3, maxLen: 8, depthLenBonus: 3 },
    [TILE_COPPER]:   { seedChance: 0.028, minLen: 3, maxLen: 7, depthLenBonus: 2 },
    [TILE_TIN]:      { seedChance: 0.020, minLen: 3, maxLen: 6, depthLenBonus: 2 },
    [TILE_COAL]:     { seedChance: 0.028, minLen: 3, maxLen: 8, depthLenBonus: 3 },
    // Medium ores: veins of 2-5, longer at depth
    [TILE_LEAD]:     { seedChance: 0.018, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_SILVER]:   { seedChance: 0.015, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_GOLD]:     { seedChance: 0.014, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_WATER]:    { seedChance: 0.032, minLen: 2, maxLen: 5, depthLenBonus: 2 },
    [TILE_COBALT]:   { seedChance: 0.022, minLen: 2, maxLen: 5, depthLenBonus: 3 },
    // Rare ores: veins of 1-4
    [TILE_QUARTZ]:   { seedChance: 0.014, minLen: 1, maxLen: 4, depthLenBonus: 1 },
    [TILE_REDSTONE]: { seedChance: 0.016, minLen: 1, maxLen: 4, depthLenBonus: 1 },
    // Gems: veins of 1-3, short but valuable
    [TILE_DIAMOND]:  { seedChance: 0.010, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    [TILE_EMERALD]:  { seedChance: 0.012, minLen: 1, maxLen: 3, depthLenBonus: 1 },
    [TILE_RUBY]:     { seedChance: 0.011, minLen: 1, maxLen: 3, depthLenBonus: 1 }
  };

  // Depth-based ore availability: which ores can spawn at a given depth factor (0..1)
  function getOreSpawnChance(d, tileType) {
    const ramp = (start, end) => d < start ? 0 : d > end ? 1 : (d - start) / (end - start);
    const bell = (center, width) => Math.max(0, 1 - Math.pow((d - center) / width, 2));
    switch (tileType) {
      case TILE_IRON:     return 0.4 + 0.6 * bell(0.2, 0.3) - 0.2 * ramp(0.6, 1.0);
      case TILE_COPPER:   return 0.1 + 0.9 * bell(0.25, 0.3);
      case TILE_TIN:      return 0.05 + 0.95 * bell(0.3, 0.3);
      case TILE_COAL:     return 0.1 + 0.9 * bell(0.35, 0.35);
      case TILE_LEAD:     return bell(0.45, 0.25);
      case TILE_SILVER:   return ramp(0.2, 0.5) * (1 - 0.4 * ramp(0.8, 1.0));
      case TILE_WATER:    return 0.3 + 0.7 * bell(0.4, 0.35);
      case TILE_COBALT:   return ramp(0.2, 0.5) + 0.5 * ramp(0.5, 0.9);
      case TILE_GOLD:     return ramp(0.35, 0.7) * (1 - 0.3 * ramp(0.9, 1.0));
      case TILE_QUARTZ:   return ramp(0.3, 0.65);
      case TILE_REDSTONE: return ramp(0.55, 0.85);
      case TILE_EMERALD:  return ramp(0.6, 0.9);
      case TILE_DIAMOND:  return ramp(0.65, 0.95);
      case TILE_RUBY:     return ramp(0.63, 0.92);
      default: return 0;
    }
  }

  // Grow a vein from a seed point using random walk / BFS flood
  function growVein(grid, seedR, seedC, tileType, targetLen) {
    const placed = [];
    const frontier = [{ r: seedR, c: seedC }];
    const visited = new Set();
    visited.add(seedR * GRID_COLS + seedC);

    while (placed.length < targetLen && frontier.length > 0) {
      // Pick a random frontier cell
      const idx = Math.floor(Math.random() * frontier.length);
      const { r, c } = frontier[idx];
      frontier.splice(idx, 1);

      // Only place on dirt tiles (don't overwrite other ores or gadgets)
      if (grid[r][c] !== TILE_DIRT) continue;

      grid[r][c] = tileType;
      placed.push({ r, c });

      // Add neighbors to frontier (4-directional)
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue;
        const key = nr * GRID_COLS + nc;
        if (visited.has(key)) continue;
        visited.add(key);
        frontier.push({ r: nr, c: nc });
      }
    }
    return placed.length;
  }

  function generateUnderground() {
    // Step 1: Fill entire grid with dirt
    undergroundGrid = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c)
        row.push(TILE_DIRT);
      undergroundGrid.push(row);
    }

    // Step 2: Spawn ore veins from seed points
    // Scan the grid at every cell; each cell has a chance to seed a vein
    // The ore type picked depends on depth probabilities
    const oreTypes = [
      TILE_IRON, TILE_COPPER, TILE_TIN, TILE_COAL,
      TILE_LEAD, TILE_SILVER, TILE_WATER, TILE_COBALT,
      TILE_GOLD, TILE_QUARTZ,
      TILE_REDSTONE, TILE_EMERALD, TILE_DIAMOND, TILE_RUBY
    ];

    for (let r = 0; r < GRID_ROWS; ++r) {
      const d = r / GRID_ROWS; // depth factor 0..1
      for (let c = 0; c < GRID_COLS; ++c) {
        // Only seed on dirt tiles (skip already placed veins)
        if (undergroundGrid[r][c] !== TILE_DIRT) continue;

        // For each ore type, check if this cell seeds a vein
        for (const oreType of oreTypes) {
          const cfg = VEIN_CONFIG[oreType];
          const depthWeight = getOreSpawnChance(d, oreType);
          if (depthWeight <= 0) continue;

          // Effective seed chance scaled by depth availability
          // Divide by average vein length to keep overall density similar
          const avgLen = (cfg.minLen + cfg.maxLen) / 2;
          const effectiveChance = (cfg.seedChance * depthWeight) / avgLen;

          if (Math.random() < effectiveChance) {
            // Determine vein length: base range + depth bonus
            const depthBonus = Math.floor(d * cfg.depthLenBonus);
            const minL = cfg.minLen;
            const maxL = cfg.maxLen + depthBonus;
            const targetLen = minL + Math.floor(Math.random() * (maxL - minL + 1));
            growVein(undergroundGrid, r, c, oreType, targetLen);
            break; // only one vein type per seed point
          }
        }
      }
    }

    // Clear starting area around player spawn
    const spawnCol = Math.floor(GRID_COLS / 2);
    undergroundGrid[0][spawnCol] = TILE_EMPTY;
    undergroundGrid[0][spawnCol - 1] = TILE_EMPTY;
    undergroundGrid[0][spawnCol + 1] = TILE_EMPTY;

    // Place 4-8 gadget chambers (2x2 TILE_GADGET blocks) spread throughout the larger grid
    gadgetChambers = [];
    const chamberCount = 4 + Math.floor(Math.random() * 5); // 4, 5, 6, 7, or 8
    for (let n = 0; n < chamberCount; ++n) {
      let placed = false;
      for (let attempt = 0; attempt < 80 && !placed; ++attempt) {
        const cr = 2 + Math.floor(Math.random() * (GRID_ROWS - 3)); // rows 2..GRID_ROWS-2
        const cc = 1 + Math.floor(Math.random() * (GRID_COLS - 3)); // cols 1..GRID_COLS-3
        // Check no overlap with start area (rows 0-1, near spawn) or other chambers
        let ok = true;
        for (let dr = 0; dr < 2 && ok; ++dr)
          for (let dc = 0; dc < 2 && ok; ++dc) {
            if (cr + dr < 2 && cc + dc >= spawnCol - 2 && cc + dc <= spawnCol + 1) ok = false;
            if (undergroundGrid[cr + dr][cc + dc] === TILE_GADGET) ok = false;
          }
        if (!ok) continue;
        // Pick a random mine gadget for this chamber
        const available = MINE_GADGETS.filter(g => !gadgetChambers.some(ch => ch.gadgetType === g));
        const gadgetType = available.length > 0
          ? available[Math.floor(Math.random() * available.length)]
          : MINE_GADGETS[Math.floor(Math.random() * MINE_GADGETS.length)];
        gadgetChambers.push({ r: cr, c: cc, gadgetType, revealed: false });
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            undergroundGrid[cr + dr][cc + dc] = TILE_GADGET;
        placed = true;
      }
    }

    // Initialize persistent tile mining HP arrays
    initTileHP();

    generateDirtNoise();
    generateOreSpeckles();
  }

  // Get intrinsic tile hardness (independent of player upgrades)
  function getTileHardness(row, tile) {
    const depthMultiplier = getDepthMineMultiplier(row);
    const tileMultiplier = TILE_MINE_MULTIPLIER[tile] || 1.0;
    return BASE_MINE_TIME * depthMultiplier * tileMultiplier;
  }

  // Initialize (or reinitialize) the per-tile mining HP arrays
  function initTileHP() {
    tileHP = [];
    tileMaxHP = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const hpRow = [];
      const maxRow = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) {
          hpRow.push(0);
          maxRow.push(0);
        } else {
          const hp = getTileHardness(r, tile);
          hpRow.push(hp);
          maxRow.push(hp);
        }
      }
      tileHP.push(hpRow);
      tileMaxHP.push(maxRow);
    }
  }

  /* ======================================================================
     GAME INIT / RESET
     ====================================================================== */

  function resetGame() {
    state = STATE_GADGET_SELECT;
    currentView = VIEW_SURFACE;
    transitionProgress = 0;
    transitionTarget = null;
    transitionPhase = 'none';

    domeHP = BASE_DOME_HP;
    maxDomeHP = BASE_DOME_HP;
    resources = { iron: 0, water: 0, cobalt: 0, copper: 0, gold: 0, tin: 0, silver: 0, lead: 0, coal: 0, quartz: 0, redstone: 0, diamond: 0, emerald: 0, ruby: 0 };
    carried = 0;
    carryCapacity = BASE_CARRY_CAPACITY;

    weaponDamage = BASE_WEAPON_DAMAGE;
    fireRate = BASE_FIRE_RATE;
    fireCooldown = 0;
    projectiles = [];
    turretAngle = -Math.PI / 2;
    mouseAimX = -1;
    mouseAimY = -1;

    drillSpeed = BASE_DRILL_SPEED;
    drillX = Math.floor(GRID_COLS / 2);
    drillY = 0;
    drillTimer = 0;
    cameraX = 0;
    cameraY = 0;

    upgradeLevels = { weaponDamage: 0, fireRate: 0, domeHP: 0, drillSpeed: 0, carryCapacity: 0, moveSpeed: 0, miningTools: 0 };

    enemies = [];
    waveNumber = 0;
    waveTimer = 12;
    waveActive = false;
    score = 0;

    // Reset navigation state
    moveTarget = null;
    movePath = null;
    movePathIndex = 0;
    moveStepTimer = 0;
    mineTarget = null;
    moveStepInterval = BASE_MOVE_INTERVAL;

    // Reset mining state
    miningProgress = 0;
    miningDuration = 0;
    miningTarget = null;
    miningDir = null;

    // Reset persistent tile HP (will be re-initialized in generateUnderground)
    tileHP = [];
    tileMaxHP = [];

    // Reset dropped resources
    droppedResources = [];

    // Reset animation state
    animTime = 0;
    pickaxeAngle = 0;
    pickaxeSwinging = false;
    pickaxeSwingTimer = 0;
    domePulsePhase = 0;
    domeHitFlash = 0;
    playerBob = 0;
    crumbleEffects = [];
    dustClouds = [];
    resourceGlows = [];
    shieldImpacts = [];
    tileSparkleTimer = 0;

    // Reset gadget state (clear auto-laser visuals so they never persist into a new game)
    primaryGadget = null;
    primaryGadgetState = {};
    foundGadgets = [];

    // Reset tool/gadget state
    unlockedTools = {};
    activeToolKey = null;
    toolState = {
      drillLastCol: -1,          // last column mined for drill combo
      drillConsecutive: 0,       // consecutive same-column mines
      blastToolCooldown: 0,      // cooldown timer for blast tool
      scannerActive: false,      // whether scanner is passively active
      teleporterCooldown: 0,     // cooldown timer for teleporter
      autoRepairTimer: 0,        // auto-repair interval timer
      jetpackCooldown: 0,        // jetpack cooldown timer
      phaseShiftCooldown: 0,     // phase shift cooldown timer
      echoLocationActive: false  // echo location passive
    };
    showToolPanel = false;
    gadgetSelectHover = -1;

    // Reset upgrade tree
    upgradeTreeLevels = {};
    for (const node of UPGRADE_TREE)
      upgradeTreeLevels[node.id] = 0;
    upgradeDialogHover = null;
    upgradeDialogScroll = 0;
    stateBeforeUpgradeDialog = null;
    upgradeZoom = 1.0;
    upgradePanX = 0;
    upgradePanY = 0;
    upgradePanning = false;
    upgradeViewCustomized = false;

    // Reset tooltip
    clearTooltip();

    generateUnderground();
    updateWindowTitle();
  }

  function startGameAfterGadgetSelect() {
    state = STATE_PLAYING;
    // Initialize primary gadget state
    switch (primaryGadget) {
      case 'shield':
        primaryGadgetState = { active: true };
        break;
      case 'repellent':
        primaryGadgetState = { active: false, duration: 0, cooldown: 0 };
        break;
      case 'orchard':
        primaryGadgetState = { fruitTimer: 20, fruitReady: false, speedBoostTimer: 0 };
        break;
      case 'droneyard':
        primaryGadgetState = { droneTimer: 15, droneY: 0, droneActive: false, dronePhase: 0 };
        break;
    }
  }

  /* ======================================================================
     VIEW TRANSITION
     ====================================================================== */

  const TRANSITION_DURATION = 0.6; // seconds for a full view switch
  let transitionPhase = 'none';    // 'none' | 'fade-out' | 'fade-in'

  function toggleView() {
    if (state !== STATE_PLAYING) return;
    if (transitionPhase !== 'none') return;

    transitionTarget = currentView === VIEW_SURFACE ? VIEW_UNDERGROUND : VIEW_SURFACE;
    transitionProgress = 0;
    transitionPhase = 'fade-out';

    // Cancel any active mining when switching views
    cancelMining();

    if (transitionTarget === VIEW_SURFACE && carried > 0) {
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${carried} resources deposited`, { color: '#0f0', font: 'bold 28px sans-serif' });
      carried = 0;
    }
  }

  function updateTransition(dt) {
    if (transitionPhase === 'none') return;

    const speed = 1 / (TRANSITION_DURATION / 2); // each half takes TRANSITION_DURATION/2
    transitionProgress += dt * speed;

    if (transitionPhase === 'fade-out' && transitionProgress >= 1) {
      // Midpoint: switch the actual view
      transitionProgress = 1;
      currentView = transitionTarget;
      transitionPhase = 'fade-in';

      // Snap camera to player when entering underground
      if (currentView !== VIEW_SURFACE) {
        const targetCamX = drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
        const targetCamY = drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
        const maxCamX = GRID_COLS * TILE_SIZE - CANVAS_W;
        const maxCamY = GRID_ROWS * TILE_SIZE - CANVAS_H;
        cameraX = Math.max(0, Math.min(maxCamX, targetCamX));
        cameraY = Math.max(0, Math.min(maxCamY, targetCamY));

        // Auto-collect loose resources at or near the player position
        for (let i = droppedResources.length - 1; i >= 0; --i) {
          const drop = droppedResources[i];
          const dist = Math.abs(drop.col - drillX) + Math.abs(drop.row - drillY);
          if (dist > 1) continue;
          const canCarry = carryCapacity - carried;
          if (canCarry <= 0) break;
          const pickUp = Math.min(drop.value, canCarry);
          const label = TILE_LABELS[drop.type];
          resources[label] += pickUp;
          carried += pickUp;
          drop.value -= pickUp;
          const tx = drop.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
          const ty = drop.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
          floatingText.add(tx, ty - 30, `+${pickUp} ${label}`, { color: '#0f0', font: 'bold 22px sans-serif' });
          if (drop.value <= 0)
            droppedResources.splice(i, 1);
        }
      }
    } else if (transitionPhase === 'fade-in' && transitionProgress >= 2) {
      // Done
      transitionProgress = 0;
      transitionPhase = 'none';
      transitionTarget = null;
    }
  }

  function getTransitionAlpha() {
    if (transitionPhase === 'none') return 1;
    if (transitionPhase === 'fade-out')
      return 1 - transitionProgress; // 1 -> 0
    // fade-in: transitionProgress goes from 1 -> 2
    return transitionProgress - 1; // 0 -> 1
  }

  /* ======================================================================
     ANIMATION UPDATES
     ====================================================================== */

  function updateAnimations(dt) {
    animTime += dt;

    // Dome pulse
    domePulsePhase += dt * 2.0;

    // Dome hit flash decay
    if (domeHitFlash > 0)
      domeHitFlash = Math.max(0, domeHitFlash - dt * 4);

    // Player idle bob
    playerBob = Math.sin(animTime * 3) * 2;

    // Pickaxe swing
    if (pickaxeSwinging) {
      pickaxeSwingTimer -= dt;
      const progress = 1 - (pickaxeSwingTimer / PICKAXE_SWING_DURATION);
      // Swing out to 70 deg then back
      if (progress < 0.5)
        pickaxeAngle = progress * 2 * 1.2;
      else
        pickaxeAngle = (1 - progress) * 2 * 1.2;

      if (pickaxeSwingTimer <= 0) {
        pickaxeSwinging = false;
        pickaxeAngle = 0;
      }
    }

    // Crumble effects
    for (let i = crumbleEffects.length - 1; i >= 0; --i) {
      const c = crumbleEffects[i];
      c.life -= dt;
      for (const p of c.pieces) {
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 0.15;
        p.rot += p.rotV;
      }
      if (c.life <= 0)
        crumbleEffects.splice(i, 1);
    }

    // Dust clouds
    for (let i = dustClouds.length - 1; i >= 0; --i) {
      const d = dustClouds[i];
      d.alpha -= dt * 2;
      d.radius += d.expandRate * dt * 60;
      d.y -= dt * 15;
      if (d.alpha <= 0)
        dustClouds.splice(i, 1);
    }

    // Resource glows
    for (let i = resourceGlows.length - 1; i >= 0; --i) {
      const g = resourceGlows[i];
      g.life -= dt * 1.5;
      g.radius += dt * 40;
      if (g.life <= 0)
        resourceGlows.splice(i, 1);
    }

    // Shield impacts
    for (let i = shieldImpacts.length - 1; i >= 0; --i) {
      const s = shieldImpacts[i];
      s.life -= dt * 3;
      if (s.life <= 0)
        shieldImpacts.splice(i, 1);
    }

    // Ambient sparkles on resource tiles underground
    if (currentView === VIEW_UNDERGROUND) {
      tileSparkleTimer -= dt;
      if (tileSparkleTimer <= 0) {
        tileSparkleTimer = 0.3 + Math.random() * 0.4;
        // Pick a random visible resource tile
        const candidates = [];
        const spkR0 = Math.max(0, Math.floor(cameraY / TILE_SIZE));
        const spkR1 = Math.min(GRID_ROWS, Math.ceil((cameraY + CANVAS_H) / TILE_SIZE));
        const spkC0 = Math.max(0, Math.floor(cameraX / TILE_SIZE));
        const spkC1 = Math.min(GRID_COLS, Math.ceil((cameraX + CANVAS_W) / TILE_SIZE));
        for (let r = spkR0; r < spkR1; ++r)
          for (let c = spkC0; c < spkC1; ++c)
            if (undergroundGrid[r][c] !== TILE_EMPTY && undergroundGrid[r][c] !== TILE_DIRT && undergroundGrid[r][c] !== TILE_GADGET)
              candidates.push({ r, c });
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const sx = pick.c * TILE_SIZE + Math.random() * TILE_SIZE - cameraX;
          const sy = pick.r * TILE_SIZE + Math.random() * TILE_SIZE - cameraY;
          particles.sparkle(sx, sy, 1, { color: TILE_HIGHLIGHT_COLORS[undergroundGrid[pick.r][pick.c]] || '#fff', speed: 0.5 });
        }
      }
    }

    // Update starfield
    starfield.update(dt);

    // Update enemy animation phases
    for (const e of enemies) {
      if (e.wobblePhase === undefined) {
        e.wobblePhase = Math.random() * TWO_PI;
        e.legPhase = Math.random() * TWO_PI;
        e.eyeBlinkTimer = 2 + Math.random() * 3;
        e.eyeBlinking = false;
      }
      e.wobblePhase += dt * 4;
      e.legPhase += dt * 8;
      if (e.type === 'flyer')
        e.wingPhase = (e.wingPhase || 0) + dt * 12;
      e.eyeBlinkTimer -= dt;
      if (e.eyeBlinkTimer <= 0) {
        e.eyeBlinking = !e.eyeBlinking;
        e.eyeBlinkTimer = e.eyeBlinking ? 0.15 : (2 + Math.random() * 3);
      }
    }
  }

  /* ======================================================================
     CRUMBLE / DUST SPAWNERS
     ====================================================================== */

  function spawnCrumble(tx, ty, color) {
    const pieces = [];
    for (let i = 0; i < 8; ++i)
      pieces.push({
        x: tx + (Math.random() - 0.5) * 20,
        y: ty + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2 - 1,
        rot: Math.random() * TWO_PI,
        rotV: (Math.random() - 0.5) * 0.3,
        size: 4 + Math.random() * 8,
        color: color
      });
    crumbleEffects.push({ x: tx, y: ty, pieces, life: 0.6 });
  }

  function spawnDust(tx, ty) {
    for (let i = 0; i < 3; ++i)
      dustClouds.push({
        x: tx + (Math.random() - 0.5) * 30,
        y: ty + (Math.random() - 0.5) * 10,
        alpha: 0.4 + Math.random() * 0.2,
        radius: 6 + Math.random() * 8,
        expandRate: 0.5 + Math.random() * 0.3
      });
  }

  function spawnResourceGlow(tx, ty, color) {
    resourceGlows.push({ x: tx, y: ty, color, life: 1.0, radius: 10 });
  }

  function spawnShieldImpact(ex, ey) {
    const angle = Math.atan2(ey - DOME_Y, ex - DOME_X);
    shieldImpacts.push({ angle, life: 1.0, intensity: 1.0 });
  }

  /* ======================================================================
     DAMAGE HELPER (shields)
     ====================================================================== */

  function applyDamageToEnemy(e, amount) {
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, amount);
      e.shield -= absorbed;
      amount -= absorbed;
      particles.burst(e.x, e.y, 6, { color: '#4af', speed: 2, life: 0.3 });
      if (e.shield <= 0) {
        e.shield = 0;
        floatingText.add(e.x, e.y - (e.size || 20) - 36, 'SHIELD BROKEN', { color: '#4af', font: 'bold 22px sans-serif' });
        particles.burst(e.x, e.y, 15, { color: '#4af', speed: 3.5, life: 0.5 });
        particles.sparkle(e.x, e.y, 8, { color: '#8cf', speed: 2 });
      }
    }
    e.hp -= amount;
  }

  /* ======================================================================
     PATHFINDING (BFS for underground navigation)
     ====================================================================== */

  function findPath(fromCol, fromRow, toCol, toRow) {
    if (fromCol === toCol && fromRow === toRow) return [];
    if (toCol < 0 || toCol >= GRID_COLS || toRow < 0 || toRow >= GRID_ROWS) return null;
    if (undergroundGrid[toRow][toCol] !== TILE_EMPTY) return null;

    const visited = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      visited.push([]);
      for (let c = 0; c < GRID_COLS; ++c)
        visited[r].push(false);
    }

    const prev = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      prev.push([]);
      for (let c = 0; c < GRID_COLS; ++c)
        prev[r].push(null);
    }

    const queue = [{ col: fromCol, row: fromRow }];
    visited[fromRow][fromCol] = true;
    const dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];

    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.col === toCol && cur.row === toRow) {
        // Reconstruct path
        const path = [];
        let step = { col: toCol, row: toRow };
        while (step.col !== fromCol || step.row !== fromRow) {
          path.unshift(step);
          step = prev[step.row][step.col];
        }
        return path;
      }
      for (const d of dirs) {
        const nc = cur.col + d.dc;
        const nr = cur.row + d.dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        if (visited[nr][nc]) continue;
        if (undergroundGrid[nr][nc] !== TILE_EMPTY) continue;
        visited[nr][nc] = true;
        prev[nr][nc] = { col: cur.col, row: cur.row };
        queue.push({ col: nc, row: nr });
      }
    }
    return null; // no path found
  }

  function findAdjacentEmptyNear(targetCol, targetRow) {
    // Find the closest empty tile adjacent to (targetCol, targetRow) that has a path from player
    const dirs = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];
    let bestPath = null;
    let bestAdj = null;
    for (const d of dirs) {
      const ac = targetCol + d.dc;
      const ar = targetRow + d.dr;
      if (ac < 0 || ac >= GRID_COLS || ar < 0 || ar >= GRID_ROWS) continue;
      if (undergroundGrid[ar][ac] !== TILE_EMPTY) continue;
      const path = findPath(drillX, drillY, ac, ar);
      if (path !== null && (bestPath === null || path.length < bestPath.length)) {
        bestPath = path;
        bestAdj = { col: ac, row: ar, dx: targetCol - ac, dy: targetRow - ar };
      }
    }
    return bestAdj ? { path: bestPath, adj: bestAdj } : null;
  }

  /* ======================================================================
     ENEMY WAVES
     ====================================================================== */

  function spawnWave() {
    ++waveNumber;
    waveActive = true;

    // Recharge shield gadget at wave start
    if (primaryGadget === 'shield') {
      primaryGadgetState.active = true;
      floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Recharged!', { color: '#4af', font: 'bold 24px sans-serif' });
    }

    const isBossWave = waveNumber >= 15 && waveNumber % 5 === 0;

    // Gradual count ramp: 2 at wave 1, slowly increases, capped at 20
    const baseCount = Math.min(20, 2 + Math.floor(waveNumber * 0.8));
    // Flyer ratio: 0% for waves 1-4, ramps to ~40% by wave 10+
    const flyerRatio = waveNumber <= 4 ? 0 : Math.min(0.4, (waveNumber - 4) * 0.07);
    const flyerCount = Math.floor(baseCount * flyerRatio);
    const walkerCount = baseCount - flyerCount;

    // HP scaling: starts very low (8-10 for wave 1), gradually increases
    const baseHP = 8 + (waveNumber - 1) * 3;
    // Damage scaling: starts at 2-3, gradually increases
    const baseDamage = 2 + Math.floor((waveNumber - 1) * 0.8);
    // Speed scaling
    const baseSpeed = 15 + Math.min(25, waveNumber * 2);

    // Spawn ground walkers
    for (let i = 0; i < walkerCount; ++i) {
      // Ground walkers approach from left or right at ground level
      const fromLeft = Math.random() < 0.5;
      const spawnX = fromLeft ? -60 - Math.random() * 160 : CANVAS_W + 60 + Math.random() * 160;
      const spawnY = DOME_Y + (Math.random() - 0.5) * 40;

      const isArmored = waveNumber >= 9 && Math.random() < Math.min(0.35, (waveNumber - 8) * 0.07);
      const hpMult = isArmored ? 2.0 : 1.0;
      const spdMult = isArmored ? 0.75 : 1.0;
      const sizeMult = isArmored ? 1.3 : 1.0;
      const hp = (baseHP + Math.random() * 5) * hpMult;
      const hasShield = waveNumber >= 11 && Math.random() < Math.min(0.3, (waveNumber - 10) * 0.05);
      const shieldVal = hasShield ? Math.floor(hp * 0.5 + waveNumber) : 0;

      enemies.push({
        type: 'ground',
        x: spawnX,
        y: spawnY,
        hp: hp,
        maxHP: hp,
        speed: (baseSpeed + Math.random() * 10) * spdMult,
        damage: baseDamage + Math.floor(Math.random() * 2),
        attackTimer: 0,
        stunTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: (20 + Math.random() * 8) * sizeMult,
        armored: isArmored,
        shield: shieldVal,
        maxShield: shieldVal,
        boss: false
      });
    }

    // Spawn airborne flyers
    for (let i = 0; i < flyerCount; ++i) {
      // Flyers approach from upper hemisphere at any angle
      const angle = Math.PI + Math.random() * Math.PI;
      const dist = 600 + Math.random() * 200;
      const flyerHP = (baseHP * 0.6 + Math.random() * 3);
      const hasShield = waveNumber >= 11 && Math.random() < Math.min(0.2, (waveNumber - 10) * 0.04);
      const shieldVal = hasShield ? Math.floor(flyerHP * 0.4 + waveNumber * 0.5) : 0;

      enemies.push({
        type: 'flyer',
        x: DOME_X + Math.cos(angle) * dist,
        y: DOME_Y + Math.sin(angle) * dist * 0.6,
        hp: flyerHP,
        maxHP: flyerHP,
        speed: baseSpeed * 1.3 + Math.random() * 12,
        damage: Math.max(1, baseDamage - 1),
        attackTimer: 0,
        stunTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        wingPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: 14 + Math.random() * 6,
        armored: false,
        shield: shieldVal,
        maxShield: shieldVal,
        boss: false
      });
    }

    // Boss enemy every 5 waves starting at wave 15
    if (isBossWave) {
      const bossHP = baseHP * 8 + waveNumber * 5;
      const bossShield = Math.floor(bossHP * 0.4);
      const fromLeft = Math.random() < 0.5;
      enemies.push({
        type: 'ground',
        x: fromLeft ? -120 : CANVAS_W + 120,
        y: DOME_Y - 20,
        hp: bossHP,
        maxHP: bossHP,
        speed: baseSpeed * 0.5,
        damage: baseDamage * 3,
        attackTimer: 0,
        stunTimer: 0,
        wobblePhase: Math.random() * TWO_PI,
        legPhase: Math.random() * TWO_PI,
        eyeBlinkTimer: 2 + Math.random() * 3,
        eyeBlinking: false,
        size: 44 + Math.random() * 8,
        armored: true,
        shield: bossShield,
        maxShield: bossShield,
        boss: true
      });
      floatingText.add(CANVAS_W / 2, 140, 'BOSS INCOMING!', { color: '#f00', font: 'bold 48px sans-serif' });
    }

    floatingText.add(CANVAS_W / 2, 80, `WAVE ${waveNumber}`, { color: '#f80', font: 'bold 40px sans-serif' });
    updateWindowTitle();
  }

  function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; --i) {
      const e = enemies[i];

      const dx = DOME_X - e.x;
      const dy = DOME_Y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Repellent field slows enemies
      const speedMult = (primaryGadget === 'repellent' && primaryGadgetState.active) ? 0.4 : 1.0;
      // Stun laser freezes targeted enemy
      const isStunned = e.stunTimer > 0;
      if (isStunned) {
        e.stunTimer -= dt;
        if (e.stunTimer < 0) e.stunTimer = 0;
      }

      if (dist > DOME_RADIUS + 10) {
        if (!isStunned) {
          e.x += (dx / dist) * e.speed * speedMult * dt;
          e.y += (dy / dist) * e.speed * speedMult * dt;
        }
      } else if (!isStunned) {
        e.attackTimer -= dt;
        if (e.attackTimer <= 0) {
          e.attackTimer = 1.0;

          // Shield gadget absorbs first hit
          if (primaryGadget === 'shield' && primaryGadgetState.active) {
            primaryGadgetState.active = false;
            floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Shield Absorbed!', { color: '#4af', font: 'bold 28px sans-serif' });
            particles.burst(e.x, e.y, 15, { color: '#4af', speed: 3, life: 0.5 });
            spawnShieldImpact(e.x, e.y);
            continue; // skip damage
          }

          let effectiveDmg = e.damage;
          if (unlockedTools.reinforcedDome) effectiveDmg = Math.ceil(effectiveDmg * 0.75);
          if (unlockedTools.energyShield) effectiveDmg = Math.ceil(effectiveDmg * 0.85);
          domeHP -= effectiveDmg;
          domeHitFlash = 1.0;
          screenShake.trigger(8, 250);
          floatingText.add(DOME_X + (Math.random() - 0.5) * 80, DOME_Y - 60, `-${effectiveDmg} HP`, { color: '#f44', font: 'bold 28px sans-serif' });

          // Shield impact flash
          spawnShieldImpact(e.x, e.y);

          // Dome-hit sparks along the shield surface
          const impactAngle = Math.atan2(e.y - DOME_Y, e.x - DOME_X);
          for (let s = 0; s < 12; ++s) {
            const spread = (Math.random() - 0.5) * 0.6;
            const sa = impactAngle + spread;
            const ix = DOME_X + Math.cos(sa) * DOME_RADIUS;
            const iy = DOME_Y + Math.sin(sa) * DOME_RADIUS;
            particles.trail(ix, iy, {
              vx: Math.cos(sa) * (1 + Math.random() * 2),
              vy: Math.sin(sa) * (1 + Math.random() * 2) - 1,
              color: Math.random() > 0.5 ? '#4af' : '#8cf',
              life: 0.3 + Math.random() * 0.3,
              size: 1 + Math.random() * 2
            });
          }
          particles.burst(e.x, e.y, 10, { color: '#f44', speed: 2.5, life: 0.5 });

          if (domeHP <= 0) {
            domeHP = 0;
            state = STATE_GAME_OVER;
            // Dome destruction explosion
            particles.burst(DOME_X, DOME_Y, 40, { color: '#4af', speed: 5, life: 0.8 });
            particles.burst(DOME_X, DOME_Y, 25, { color: '#f80', speed: 4, life: 0.6 });
            screenShake.trigger(15, 500);
            addHighScore(waveNumber, score);
            updateWindowTitle();
            return;
          }
        }
      }

      // Remove dead enemies with death animation
      if (e.hp <= 0) {
        score += 10 + waveNumber * 5;
        // Chunky death explosion
        particles.burst(e.x, e.y, 20, { color: '#fa0', speed: 3.5, life: 0.6, gravity: 0.05 });
        particles.burst(e.x, e.y, 10, { color: '#f44', speed: 2, life: 0.4 });
        particles.sparkle(e.x, e.y, 6, { color: '#ff0', speed: 1.5 });
        // Gore chunks (squares)
        for (let g = 0; g < 5; ++g)
          particles.trail(e.x + (Math.random() - 0.5) * 8, e.y + (Math.random() - 0.5) * 8, {
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3 - 1,
            color: '#c33',
            life: 0.5 + Math.random() * 0.3,
            size: 3 + Math.random() * 3,
            gravity: 0.12,
            shape: 'square'
          });
        floatingText.add(e.x, e.y - 30, `+${10 + waveNumber * 5}`, { color: '#ff0', font: 'bold 24px sans-serif' });
        enemies.splice(i, 1);
      }
    }

    if (waveActive && enemies.length === 0) {
      waveActive = false;
      waveTimer = WAVE_INTERVAL;
      floatingText.add(CANVAS_W / 2, 80, 'WAVE CLEAR!', { color: '#0f0', font: 'bold 36px sans-serif' });
    }
  }

  /* ======================================================================
     WEAPON SYSTEM
     ====================================================================== */

  function updateWeapon(dt) {
    if (currentView !== VIEW_SURFACE) return;

    // Turret aiming: track mouse position continuously
    // Nozzle moves along dome arc — compute aim angle from dome center
    // Upper semicircle only, clamped above ground so nozzle never dips into terrain
    const TURRET_MIN_ANGLE = -Math.PI;
    const TURRET_MAX_ANGLE = 0;
    if (mouseAimX >= 0 && mouseAimY >= 0) {
      const adx = mouseAimX - DOME_X;
      const ady = mouseAimY - DOME_Y;
      if (adx * adx + ady * ady > 4) {
        if (ady < 0)
          // Mouse is above ground — atan2 with negative ady always yields [-PI, 0]
          turretAngle = Math.atan2(ady, adx);
        // When mouse is below ground, don't change turret angle — avoids snapping
      }
    }

    // Keyboard aiming: Left/Right or A/D rotate barrel
    if (keys['ArrowLeft'] || keys['KeyA'])
      turretAngle -= TURRET_KEYBOARD_SPEED * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      turretAngle += TURRET_KEYBOARD_SPEED * dt;

    // Clamp turret to upper dome arc, above ground on both sides
    if (turretAngle > TURRET_MAX_ANGLE) turretAngle = TURRET_MAX_ANGLE;
    if (turretAngle < TURRET_MIN_ANGLE) turretAngle = TURRET_MIN_ANGLE;

    // Nozzle position on dome arc
    const nozzleR = DOME_RADIUS + 16;
    const turretBaseX = DOME_X + Math.cos(turretAngle) * nozzleR;
    const turretBaseY = DOME_Y + Math.sin(turretAngle) * nozzleR;

    fireCooldown -= dt;

    // Fire toward current turret aim direction on click
    if (fireRequested && fireCooldown <= 0) {
      fireRequested = false;
      fireCooldown = 1.0 / fireRate;

      // Project a far-off aim point along the turret angle
      const aimDist = 400;
      const farX = turretBaseX + Math.cos(turretAngle) * aimDist;
      const farY = turretBaseY + Math.sin(turretAngle) * aimDist;

      // Find enemy closest to the projected aim line
      let target = null;
      let bestDist = 80 * 80; // hit radius of 80px
      for (const e of enemies) {
        const dx = e.x - farX;
        const dy = e.y - farY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          target = e;
        }
      }

      // Also check enemies near the aim line (not just the far point)
      if (!target) {
        let bestLineDist = 60;
        for (const e of enemies) {
          // Distance from enemy to the aim ray
          const ex = e.x - turretBaseX;
          const ey = e.y - turretBaseY;
          const projLen = ex * Math.cos(turretAngle) + ey * Math.sin(turretAngle);
          if (projLen < 0) continue; // behind turret
          const perpDist = Math.abs(-ex * Math.sin(turretAngle) + ey * Math.cos(turretAngle));
          if (perpDist < bestLineDist) {
            bestLineDist = perpDist;
            target = e;
          }
        }
      }

      const tx = target ? target.x : farX;
      const ty = target ? target.y : farY;

      const muzzleX = turretBaseX + Math.cos(turretAngle) * TURRET_BARREL_LENGTH;
      const muzzleY = turretBaseY + Math.sin(turretAngle) * TURRET_BARREL_LENGTH;

      projectiles.push({
        x: muzzleX,
        y: muzzleY,
        tx, ty,
        target,
        life: 0.3,
        maxLife: 0.3
      });

      if (target) {
        applyDamageToEnemy(target, weaponDamage);

        // Chain Lightning: arc damage to 2 nearby enemies
        if (unlockedTools.chainLightning) {
          let chainCount = 0;
          const chainDamage = Math.ceil(weaponDamage * 0.4);
          for (const ce of enemies) {
            if (ce === target || chainCount >= 2) break;
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 160 * 160) {
              applyDamageToEnemy(ce, chainDamage);
              particles.burst(ce.x, ce.y, 4, { color: '#4af', speed: 2, life: 0.2 });
              // Arc visual
              projectiles.push({ x: target.x, y: target.y, tx: ce.x, ty: ce.y, life: 0.15, maxLife: 0.15 });
              ++chainCount;
            }
          }
        }

        // Freeze Ray: slow enemies near target
        if (unlockedTools.freezeRay) {
          for (const ce of enemies) {
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 120 * 120)
              ce.stunTimer = Math.max(ce.stunTimer || 0, 0.8);
          }
        }

        // Plasma Cannon: AoE damage around target
        if (unlockedTools.plasmaCannon) {
          const aoeDamage = Math.ceil(weaponDamage * 0.6);
          for (const ce of enemies) {
            if (ce === target) continue;
            const cdx = ce.x - target.x;
            const cdy = ce.y - target.y;
            if (cdx * cdx + cdy * cdy < 140 * 140) {
              applyDamageToEnemy(ce, aoeDamage);
              particles.burst(ce.x, ce.y, 6, { color: '#f80', speed: 2, life: 0.3 });
            }
          }
          particles.burst(target.x, target.y, 15, { color: '#f80', speed: 3, life: 0.4 });
        }
      }

      particles.burst(muzzleX, muzzleY, 4, { color: '#faa', speed: 1.5, life: 0.15, size: 2 });
    }

    fireRequested = false;

    for (let i = projectiles.length - 1; i >= 0; --i) {
      projectiles[i].life -= dt;
      if (projectiles[i].life <= 0)
        projectiles.splice(i, 1);
    }
  }

  /* ======================================================================
     MINING
     ====================================================================== */

  function cancelMining() {
    // Save partial progress to the tile's HP array so it persists
    if (miningTarget && miningDuration > 0 && miningProgress > 0) {
      const r = miningTarget.row;
      const c = miningTarget.col;
      if (tileMaxHP[r] && tileMaxHP[r][c] > 0)
        tileHP[r][c] = tileMaxHP[r][c] * (1 - Math.min(miningProgress / miningDuration, 0.99));
    }
    miningTarget = null;
    miningDir = null;
    miningProgress = 0;
    miningDuration = 0;
  }

  function getMiningTime(row, tile) {
    const depthMultiplier = getDepthMineMultiplier(row);
    const tileMultiplier = TILE_MINE_MULTIPLIER[tile] || 1.0;
    let time = BASE_MINE_TIME * depthMultiplier * tileMultiplier;

    // Drill speed upgrade reduces mining time
    const effectiveDrillSpeed = (primaryGadget === 'orchard' && primaryGadgetState.speedBoostTimer > 0)
      ? drillSpeed * 0.7
      : drillSpeed;
    // drillSpeed starts at 0.3 and decreases with upgrades; normalize to a multiplier
    time *= effectiveDrillSpeed / BASE_DRILL_SPEED;

    // Mining tools upgrade: each level reduces time by 20%
    time *= Math.pow(0.8, getEffectiveLevel('miningTools'));

    // Drill Gadget: 30% faster when mining consecutive tiles in the same column
    if (unlockedTools.drill && activeToolKey === 'drill' && toolState.drillConsecutive > 0)
      time *= 0.7;

    return time;
  }

  function tryMine(dx, dy) {
    if (state !== STATE_PLAYING) return;
    if (currentView !== VIEW_UNDERGROUND) return;

    const nx = drillX + dx;
    const ny = drillY + dy;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return;

    const tile = undergroundGrid[ny][nx];
    if (tile === TILE_EMPTY) {
      // Movement dust
      cancelMining();
      const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      spawnDust(cx, cy);
      drillX = nx;
      drillY = ny;
      // Pick up dropped resources at destination
      pickUpDroppedResources();
      return;
    }

    // If already mining the same block, ignore repeated starts
    if (miningTarget && miningTarget.col === nx && miningTarget.row === ny)
      return;

    // Start mining a new block (save progress of previous target first)
    cancelMining();
    miningTarget = { col: nx, row: ny };
    miningDir = { dx, dy };
    miningDuration = getMiningTime(ny, tile);

    // Restore partial progress from persistent tile HP
    if (tileMaxHP[ny] && tileMaxHP[ny][nx] > 0 && tileHP[ny][nx] < tileMaxHP[ny][nx])
      miningProgress = miningDuration * (1 - tileHP[ny][nx] / tileMaxHP[ny][nx]);
    else
      miningProgress = 0;

    lastMineDir = { dx, dy };

    // Trigger pickaxe swing animation
    pickaxeSwinging = true;
    pickaxeSwingTimer = PICKAXE_SWING_DURATION;
  }

  function completeMining() {
    if (!miningTarget) return;

    const nx = miningTarget.col;
    const ny = miningTarget.row;
    const dx = miningDir.dx;
    const dy = miningDir.dy;
    const tile = undergroundGrid[ny][nx];

    // Trigger pickaxe swing animation on completion
    pickaxeSwinging = true;
    pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    lastMineDir = { dx, dy };

    const tx = nx * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const ty = ny * TILE_SIZE + TILE_SIZE / 2 - cameraY;

    // Rich mining particles
    const tileColor = getTileBaseColor(tile, ny);

    // Directional rock debris (chunks fly opposite to mining direction)
    for (let p = 0; p < 6; ++p)
      particles.trail(tx + (Math.random() - 0.5) * 12, ty + (Math.random() - 0.5) * 12, {
        vx: -dx * (1.5 + Math.random() * 2) + (Math.random() - 0.5),
        vy: -dy * (1.5 + Math.random() * 2) - Math.random() * 1.5,
        color: tileColor,
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        gravity: 0.08,
        shape: 'square'
      });

    // Small circular dust particles
    particles.burst(tx, ty, 6, { color: '#8a7a6a', speed: 1.5, life: 0.3, size: 1.5 });

    // Rock crumble animation
    spawnCrumble(tx, ty, tileColor);

    // Dust cloud at impact
    spawnDust(tx, ty);

    // Stronger shake for mining
    screenShake.trigger(4, 120);

    if (RESOURCE_TILES.includes(tile)) {
      const label = TILE_LABELS[tile];
      let value = TILE_VALUES[tile];

      // Fortune: 30% chance to double ore yield
      if (unlockedTools.fortune && Math.random() < 0.3) {
        value *= 2;
        const tx2 = nx * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const ty2 = ny * TILE_SIZE + TILE_SIZE / 2 - cameraY;
        floatingText.add(tx2, ty2 - 60, 'FORTUNE!', { color: '#ffd700', font: 'bold 24px sans-serif' });
        particles.sparkle(tx2, ty2, 8, { color: '#ffd700', speed: 2 });
      }

      const fitsInInventory = Math.min(value, carryCapacity - carried);
      const excess = value - fitsInInventory;

      if (fitsInInventory > 0) {
        resources[label] += fitsInInventory;
        carried += fitsInInventory;
        floatingText.add(tx, ty - 30, `+${fitsInInventory} ${label}`, { color: '#0f0', font: 'bold 24px sans-serif' });
      }

      // Drop excess resources on the ground
      if (excess > 0) {
        droppedResources.push({ col: nx, row: ny, type: tile, value: excess, age: 0 });
        floatingText.add(tx, ty - 60, `${excess} ${label} dropped!`, { color: '#f80', font: 'bold 22px sans-serif' });
      }

      // Resource reveal glow burst
      spawnResourceGlow(tx, ty, TILE_HIGHLIGHT_COLORS[tile] || '#fff');
      particles.sparkle(tx, ty, 12, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2.5 });

      // Extra screen shake for precious resources
      screenShake.trigger(5, 150);
    }

    // Gadget chamber tile -- grant the chamber's gadget
    if (tile === TILE_GADGET) {
      const chamber = gadgetChambers.find(ch => {
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (ch.r + dr === ny && ch.c + dc === nx) return true;
        return false;
      });
      if (chamber) {
        grantMineGadget(chamber.gadgetType, tx, ty);
        // Clear remaining tiles of this chamber
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (undergroundGrid[chamber.r + dr][chamber.c + dc] === TILE_GADGET) {
              undergroundGrid[chamber.r + dr][chamber.c + dc] = TILE_EMPTY;
              if (tileHP[chamber.r + dr]) tileHP[chamber.r + dr][chamber.c + dc] = 0;
              if (tileMaxHP[chamber.r + dr]) tileMaxHP[chamber.r + dr][chamber.c + dc] = 0;
            }
      }
    }

    undergroundGrid[ny][nx] = TILE_EMPTY;
    // Reset tile HP on clear
    if (tileHP[ny]) tileHP[ny][nx] = 0;
    if (tileMaxHP[ny]) tileMaxHP[ny][nx] = 0;
    drillX = nx;
    drillY = ny;

    // Track drill gadget consecutive column mining
    if (unlockedTools.drill && activeToolKey === 'drill') {
      if (dy === 1 && dx === 0 && nx === toolState.drillLastCol)
        ++toolState.drillConsecutive;
      else
        toolState.drillConsecutive = 0;
      toolState.drillLastCol = nx;
    }

    // Pick up dropped resources at destination
    pickUpDroppedResources();

    // Reveal adjacent gadget chambers
    for (const ch of gadgetChambers) {
      if (ch.revealed) continue;
      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc) {
          const cr = ch.r + dr, cc = ch.c + dc;
          if (Math.abs(cr - ny) + Math.abs(cc - nx) === 1)
            ch.revealed = true;
        }
    }

    cancelMining();
  }

  function updateMining(dt) {
    if (!miningTarget) return;
    if (currentView !== VIEW_UNDERGROUND) {
      cancelMining();
      return;
    }

    // Check the block is still there (blast mining could clear it)
    const tile = undergroundGrid[miningTarget.row][miningTarget.col];
    if (tile === TILE_EMPTY) {
      cancelMining();
      return;
    }

    miningProgress += dt;

    // Update persistent tile HP in real-time for visual crack overlay
    const mr = miningTarget.row;
    const mc = miningTarget.col;
    if (tileMaxHP[mr] && tileMaxHP[mr][mc] > 0) {
      const ratio = Math.min(miningProgress / miningDuration, 1);
      tileHP[mr][mc] = tileMaxHP[mr][mc] * (1 - ratio);
    }

    // Periodically retrigger pickaxe swing animation while mining
    if (!pickaxeSwinging) {
      pickaxeSwinging = true;
      pickaxeSwingTimer = PICKAXE_SWING_DURATION;
    }

    // Emit small mining particles while in progress
    if (Math.random() < dt * 8) {
      const tx = miningTarget.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const ty = miningTarget.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      const tileColor = getTileBaseColor(tile, miningTarget.row);
      particles.trail(tx + (Math.random() - 0.5) * 10, ty + (Math.random() - 0.5) * 10, {
        vx: -(miningDir.dx) * (0.5 + Math.random()),
        vy: -(miningDir.dy) * (0.5 + Math.random()) - Math.random() * 0.5,
        color: tileColor,
        life: 0.2 + Math.random() * 0.2,
        size: 1 + Math.random() * 2,
        gravity: 0.05,
        shape: 'square'
      });
    }

    if (miningProgress >= miningDuration)
      completeMining();
  }

  function pickUpDroppedResources() {
    for (let i = droppedResources.length - 1; i >= 0; --i) {
      const drop = droppedResources[i];
      if (drop.col !== drillX || drop.row !== drillY) continue;

      const canCarry = carryCapacity - carried;
      if (canCarry <= 0) break;

      const pickUp = Math.min(drop.value, canCarry);
      const label = TILE_LABELS[drop.type];
      resources[label] += pickUp;
      carried += pickUp;
      drop.value -= pickUp;

      const tx = drop.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const ty = drop.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      floatingText.add(tx, ty - 30, `+${pickUp} ${label}`, { color: '#0f0', font: 'bold 22px sans-serif' });

      if (drop.value <= 0)
        droppedResources.splice(i, 1);
    }
  }

  function grantMineGadget(type, tx, ty) {
    foundGadgets.push(type);
    const name = MINE_GADGET_NAMES[type] || type;
    floatingText.add(tx, ty - 50, `GADGET: ${name}!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.burst(tx, ty, 25, { color: '#ffd700', speed: 3, life: 0.7 });
    particles.sparkle(tx, ty, 15, { color: '#ffaa00', speed: 2 });
    screenShake.trigger(8, 200);

    switch (type) {
      case 'domeArmor':
        maxDomeHP += 50;
        domeHP = Math.min(domeHP + 50, maxDomeHP);
        floatingText.add(tx, ty - 90, '+50 Max HP!', { color: '#0f0', font: 'bold 24px sans-serif' });
        break;
      case 'blastMining':
        primaryGadgetState.blastCharges = (primaryGadgetState.blastCharges || 0) + 2;
        floatingText.add(tx, ty - 90, '+2 Blast Charges!', { color: '#f80', font: 'bold 24px sans-serif' });
        break;
      case 'probeScanner':
        primaryGadgetState.probeTimer = 15;
        primaryGadgetState.probePlayerR = drillY;
        primaryGadgetState.probePlayerC = drillX;
        floatingText.add(tx, ty - 90, 'Resources Revealed!', { color: '#ffd700', font: 'bold 24px sans-serif' });
        break;
      case 'autoCannon':
        primaryGadgetState.autoCannonTimer = 0;
        break;
      case 'stunLaser':
        primaryGadgetState.stunLaserTimer = 0;
        primaryGadgetState.stunLaserTarget = null;
        primaryGadgetState.stunLaserFlash = 0;
        break;
      case 'condenser':
        primaryGadgetState.condenserTimer = 0;
        break;
    }
  }

  function useBlastMining() {
    if (!foundGadgets.includes('blastMining')) return;
    if ((primaryGadgetState.blastCharges || 0) <= 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;

    --primaryGadgetState.blastCharges;
    floatingText.add(
      drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
      drillY * TILE_SIZE - 10 - cameraY,
      `BLAST! (${primaryGadgetState.blastCharges} left)`,
      { color: '#f80', font: 'bold 28px sans-serif' }
    );

    // Clear 3x3 area around player
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        const r = drillY + dr, c = drillX + dc;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;

        const tx = c * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const ty = r * TILE_SIZE + TILE_SIZE / 2 - cameraY;

        if (tile === TILE_GADGET) {
          const chamber = gadgetChambers.find(ch => {
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                if (ch.r + dr2 === r && ch.c + dc2 === c) return true;
            return false;
          });
          if (chamber) {
            grantMineGadget(chamber.gadgetType, tx, ty);
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                undergroundGrid[chamber.r + dr2][chamber.c + dc2] = TILE_EMPTY;
          }
        } else if (RESOURCE_TILES.includes(tile)) {
          const label = TILE_LABELS[tile];
          const value = TILE_VALUES[tile];
          const fitsInInventory = Math.min(value, carryCapacity - carried);
          const excess = value - fitsInInventory;
          if (fitsInInventory > 0) {
            resources[label] += fitsInInventory;
            carried += fitsInInventory;
          }
          if (excess > 0)
            droppedResources.push({ col: c, row: r, type: tile, value: excess, age: 0 });
        }
        undergroundGrid[r][c] = TILE_EMPTY;
        if (tileHP[r]) tileHP[r][c] = 0;
        if (tileMaxHP[r]) tileMaxHP[r][c] = 0;

        // Red explosive flash particles
        particles.burst(tx, ty, 8, { color: '#f44', speed: 2.5, life: 0.4 });
        spawnCrumble(tx, ty, getTileBaseColor(tile, r));
      }

    // Big explosion effect
    const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    particles.burst(cx, cy, 30, { color: '#f80', speed: 4, life: 0.6 });
    particles.burst(cx, cy, 15, { color: '#ff0', speed: 3, life: 0.4 });
    screenShake.trigger(10, 300);
  }

  /* ======================================================================
     TOOL ACTIONS
     ====================================================================== */

  function useBlastTool() {
    if (!unlockedTools.blastTool) return;
    if (toolState.blastToolCooldown > 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;
    if (resources.iron < 10) {
      floatingText.add(
        drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
        drillY * TILE_SIZE - 10 - cameraY,
        'Need 10 iron!', { color: '#f44', font: 'bold 24px sans-serif' }
      );
      return;
    }

    resources.iron -= 10;
    toolState.blastToolCooldown = GADGET_TOOL_COOLDOWNS.blastTool;

    floatingText.add(
      drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX,
      drillY * TILE_SIZE - 10 - cameraY,
      'BLAST! (-10 iron)', { color: '#f80', font: 'bold 28px sans-serif' }
    );

    // Clear 3x3 area around player
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        const r = drillY + dr, c = drillX + dc;
        if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) continue;
        const tile = undergroundGrid[r][c];
        if (tile === TILE_EMPTY) continue;

        const tx = c * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const ty = r * TILE_SIZE + TILE_SIZE / 2 - cameraY;

        if (tile === TILE_GADGET) {
          const chamber = gadgetChambers.find(ch => {
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                if (ch.r + dr2 === r && ch.c + dc2 === c) return true;
            return false;
          });
          if (chamber) {
            grantMineGadget(chamber.gadgetType, tx, ty);
            for (let dr2 = 0; dr2 < 2; ++dr2)
              for (let dc2 = 0; dc2 < 2; ++dc2)
                undergroundGrid[chamber.r + dr2][chamber.c + dc2] = TILE_EMPTY;
          }
        } else if (RESOURCE_TILES.includes(tile)) {
          const label = TILE_LABELS[tile];
          const value = TILE_VALUES[tile];
          const fitsInInventory = Math.min(value, carryCapacity - carried);
          const excess = value - fitsInInventory;
          if (fitsInInventory > 0) {
            resources[label] += fitsInInventory;
            carried += fitsInInventory;
          }
          if (excess > 0)
            droppedResources.push({ col: c, row: r, type: tile, value: excess, age: 0 });
        }
        undergroundGrid[r][c] = TILE_EMPTY;
        if (tileHP[r]) tileHP[r][c] = 0;
        if (tileMaxHP[r]) tileMaxHP[r][c] = 0;
        particles.burst(tx, ty, 8, { color: '#f44', speed: 2.5, life: 0.4 });
        spawnCrumble(tx, ty, getTileBaseColor(tile, r));
      }

    const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    particles.burst(cx, cy, 30, { color: '#f80', speed: 4, life: 0.6 });
    particles.burst(cx, cy, 15, { color: '#ff0', speed: 3, life: 0.4 });
    screenShake.trigger(10, 300);
  }

  function useTeleporter() {
    if (!unlockedTools.teleporter) return;
    if (toolState.teleporterCooldown > 0) return;
    if (state !== STATE_PLAYING || currentView !== VIEW_UNDERGROUND) return;

    toolState.teleporterCooldown = GADGET_TOOL_COOLDOWNS.teleporter;

    // Teleport particles at origin
    const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
    const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
    particles.burst(cx, cy, 20, { color: '#a0f', speed: 3, life: 0.5 });
    particles.sparkle(cx, cy, 10, { color: '#c4f', speed: 2 });
    screenShake.trigger(6, 200);

    // Cancel mining and movement
    cancelMining();
    clearMoveTarget();

    // Deposit carried resources
    if (carried > 0) {
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${carried} resources deposited`, { color: '#0f0', font: 'bold 28px sans-serif' });
      carried = 0;
    }

    // Switch to surface
    transitionTarget = VIEW_SURFACE;
    transitionProgress = 0;
    transitionPhase = 'fade-out';

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'Teleported!', { color: '#a0f', font: 'bold 32px sans-serif' });
  }

  function selectTool(key) {
    if (!unlockedTools[key]) return;
    // Scanner and reinforcedDome are passive -- no selection needed
    if (key === 'scanner' || key === 'reinforcedDome') return;
    activeToolKey = activeToolKey === key ? null : key;
  }

  function unlockTool(idx) {
    if (state !== STATE_PLAYING) return;
    const def = GADGET_DEFS[idx];
    if (unlockedTools[def.key]) return;
    if (resources.iron < def.costIron || resources.cobalt < def.costCobalt) return;

    resources.iron -= def.costIron;
    resources.cobalt -= def.costCobalt;
    unlockedTools[def.key] = true;

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${def.name} Unlocked!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 15, { color: '#ffd700', speed: 2.5 });
    screenShake.trigger(5, 150);

    // Auto-select non-passive tools
    if (def.key !== 'scanner' && def.key !== 'reinforcedDome')
      activeToolKey = def.key;
  }

  /* ======================================================================
     UPGRADE SYSTEM
     ====================================================================== */

  function getUpgradeCost(idx) {
    const def = UPGRADE_DEFS[idx];
    return def.baseCost + upgradeLevels[def.key] * def.perLevel;
  }

  function totalResources() {
    let total = 0;
    for (const key in resources)
      total += resources[key];
    return total;
  }

  function spendResources(amount) {
    let remaining = amount;
    // Spend from most valuable first
    for (const key of ['ruby', 'diamond', 'emerald', 'redstone', 'quartz', 'cobalt', 'gold', 'silver', 'lead', 'tin', 'copper', 'coal', 'water', 'iron']) {
      const spend = Math.min(resources[key] || 0, remaining);
      resources[key] -= spend;
      remaining -= spend;
      if (remaining <= 0) break;
    }
  }

  function applyUpgrade(idx) {
    if (state !== STATE_PLAYING) return;

    const cost = getUpgradeCost(idx);
    if (totalResources() < cost) return;

    spendResources(cost);
    const def = UPGRADE_DEFS[idx];
    ++upgradeLevels[def.key];

    // Recalculate using effective level (legacy + tree combined)
    applyStatUpgrade(def.key);

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${def.name} Lv${getEffectiveLevel(def.key)}`, { color: '#4af', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 10, { color: '#4af', speed: 2 });
  }

  /* ======================================================================
     UPGRADE TREE (full-screen dialog)
     ====================================================================== */

  function getTreeNodeLevel(id) {
    return upgradeTreeLevels[id] || 0;
  }

  function isTreeNodeMaxed(id) {
    const node = UPGRADE_TREE.find(n => n.id === id);
    if (!node) return false;
    return getTreeNodeLevel(id) >= node.maxLevel;
  }

  function arePrereqsMet(node) {
    for (const pid of node.prereqs)
      if (!isTreeNodeMaxed(pid))
        return false;
    return true;
  }

  function canAffordTreeNode(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return false;
    const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
    for (const key in cost)
      if ((cost[key] || 0) > 0 && (resources[key] || 0) < cost[key])
        return false;
    return true;
  }

  function isTreeNodeAvailable(node) {
    return !isTreeNodeMaxed(node.id) && arePrereqsMet(node);
  }

  function purchaseTreeNode(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return;
    if (!arePrereqsMet(node)) return;
    const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
    // Check affordability for all resource types in the cost
    for (const key in cost)
      if ((cost[key] || 0) > 0 && (resources[key] || 0) < cost[key])
        return;

    // Deduct all costs
    for (const key in cost)
      if ((cost[key] || 0) > 0)
        resources[key] -= cost[key];
    upgradeTreeLevels[node.id] = lvl + 1;

    // Apply the upgrade effect
    if (node.type === 'gadget')
      applyGadgetUnlock(node.upgradeKey);
    else
      applyStatUpgrade(node.upgradeKey);

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${node.name} purchased!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 12, { color: '#ffd700', speed: 2.5 });
    screenShake.trigger(4, 120);
  }

  // Passive gadgets that don't need selection
  const PASSIVE_GADGETS = ['scanner', 'reinforcedDome', 'autoRepair', 'domeExpansion', 'energyShield', 'magnet', 'fortune', 'silkTouch', 'echoLocation', 'chainLightning', 'freezeRay', 'plasmaCannon', 'damageReflect', 'emergencyShield', 'fortifiedBase', 'lastStand', 'oreDetector', 'autoMine', 'tunnelBore', 'veinMiner', 'doubleJump', 'wallClimb', 'dash', 'undergroundRadar', 'multiShot', 'homingShots', 'criticalHit', 'explosiveRounds'];

  function applyGadgetUnlock(key) {
    unlockedTools[key] = true;
    // Apply immediate effects for certain gadgets
    if (key === 'domeExpansion') {
      maxDomeHP += 75;
      domeHP = Math.min(domeHP + 75, maxDomeHP);
    }
    // Auto-select non-passive tools
    if (!PASSIVE_GADGETS.includes(key))
      activeToolKey = key;
  }

  function getEffectiveLevel(key) {
    // Sum of tree-based levels AND legacy upgrade levels for this key
    let treeLevels = 0;
    for (const n of UPGRADE_TREE)
      if (n.upgradeKey === key)
        treeLevels += getTreeNodeLevel(n.id);
    return treeLevels + (upgradeLevels[key] || 0);
  }

  function applyStatUpgrade(key) {
    const totalLevels = getEffectiveLevel(key);

    switch (key) {
      case 'weaponDamage':
        weaponDamage = BASE_WEAPON_DAMAGE + totalLevels * 5;
        break;
      case 'fireRate':
        fireRate = BASE_FIRE_RATE + totalLevels * 0.3;
        break;
      case 'domeHP':
        maxDomeHP = BASE_DOME_HP + totalLevels * 25;
        domeHP = Math.min(domeHP + 25, maxDomeHP);
        break;
      case 'drillSpeed':
        drillSpeed = Math.max(0.1, BASE_DRILL_SPEED - totalLevels * 0.05);
        break;
      case 'carryCapacity':
        carryCapacity = BASE_CARRY_CAPACITY + totalLevels * 20;
        break;
      case 'moveSpeed':
        moveStepInterval = BASE_MOVE_INTERVAL * Math.pow(0.85, totalLevels);
        break;
      case 'miningTools':
        // Applied dynamically in getMiningTime()
        break;
      case 'shieldRecharge':
        // Passive: reduces shield gadget recharge conceptually (already tracked by level count)
        break;
      case 'echoLocation':
        // Passive: extended scanner range (tracked by level count, applied in scanner code)
        break;
    }
  }

  // Compute positions for tree nodes using a strict grid layout.
  // Each branch gets a vertical column section; within a branch nodes are
  // placed on a grid where row = topological depth (max prerequisite row + 1)
  // and columns are assigned left-to-right per row. A fixed cell size
  // guarantees no two nodes can ever overlap.
  function computeTreeLayout() {
    const nodes = [];
    const margin = 40;
    const branchGap = 32;
    const startY = 200;
    const cellW = 280;   // horizontal cell pitch
    const cellH = 160;    // vertical cell pitch

    // First pass: determine how many columns each branch needs so we can
    // allocate horizontal space proportionally.
    const branchGrids = []; // per-branch: { branch, gridNodes: [{node, row, col}], maxCol, maxRow }

    for (const branch of TREE_BRANCH_ORDER) {
      const branchNodes = UPGRADE_TREE.filter(n => n.branch === branch);
      const nodeMap = {};
      for (const n of branchNodes)
        nodeMap[n.id] = n;

      // --- Row assignment via topological depth ---
      const rowOf = {};
      const assignRow = (n) => {
        if (rowOf[n.id] !== undefined) return rowOf[n.id];
        let maxParent = -1;
        for (const pid of n.prereqs)
          if (nodeMap[pid])
            maxParent = Math.max(maxParent, assignRow(nodeMap[pid]));
        rowOf[n.id] = maxParent + 1;
        return rowOf[n.id];
      };
      for (const n of branchNodes) assignRow(n);

      // --- Column assignment ---
      // Group nodes by row, then assign columns left-to-right.
      // To produce a visually pleasing tree we sort each row's nodes so that
      // nodes sharing a common parent stay adjacent, ordered by their parent's
      // column (assigned in the previous row).
      const byRow = {};
      let maxRow = 0;
      for (const n of branchNodes) {
        const r = rowOf[n.id];
        if (!byRow[r]) byRow[r] = [];
        byRow[r].push(n);
        if (r > maxRow) maxRow = r;
      }

      const colOf = {};
      let globalMaxCol = 0;
      for (let r = 0; r <= maxRow; ++r) {
        const rowNodes = byRow[r];
        if (!rowNodes) continue;

        // Sort: by minimum parent column (so children cluster under parents),
        // then by definition order for stability.
        rowNodes.sort((a, b) => {
          const aParentCol = Math.min(...a.prereqs.filter(p => nodeMap[p]).map(p => colOf[p] ?? 0), Infinity);
          const bParentCol = Math.min(...b.prereqs.filter(p => nodeMap[p]).map(p => colOf[p] ?? 0), Infinity);
          const apc = aParentCol === Infinity ? 0 : aParentCol;
          const bpc = bParentCol === Infinity ? 0 : bParentCol;
          if (apc !== bpc) return apc - bpc;
          return branchNodes.indexOf(a) - branchNodes.indexOf(b);
        });

        for (let c = 0; c < rowNodes.length; ++c) {
          colOf[rowNodes[c].id] = c;
          if (c > globalMaxCol) globalMaxCol = c;
        }
      }

      const gridNodes = branchNodes.map(n => ({ node: n, row: rowOf[n.id], col: colOf[n.id] }));
      branchGrids.push({ branch, gridNodes, maxCol: globalMaxCol, maxRow });
    }

    // Second pass: compute pixel positions.
    // Distribute branches across the available width, each getting space
    // proportional to its column count (minimum 1 column).
    const totalCols = branchGrids.reduce((s, bg) => s + bg.maxCol + 1, 0);
    const totalBranchGaps = (TREE_BRANCH_ORDER.length - 1) * branchGap;
    const availW = CANVAS_W - margin * 2 - totalBranchGaps;
    const colUnit = availW / Math.max(1, totalCols);

    let curX = margin;
    for (const bg of branchGrids) {
      const branchCols = bg.maxCol + 1;
      const branchPixelW = branchCols * Math.max(colUnit, cellW);
      const branchCenterX = curX + branchPixelW / 2;

      for (const gn of bg.gridNodes) {
        const nx = branchCenterX + (gn.col - (branchCols - 1) / 2) * cellW - TREE_NODE_W / 2;
        const ny = startY + gn.row * cellH - upgradeDialogScroll;
        nodes.push({
          node: gn.node,
          x: nx,
          y: ny,
          w: TREE_NODE_W,
          h: TREE_NODE_H,
          branch: bg.branch
        });
      }

      curX += branchPixelW + branchGap;
    }
    return nodes;
  }

  function openUpgradeDialog() {
    if (state !== STATE_PLAYING && state !== STATE_PAUSED) return;
    stateBeforeUpgradeDialog = state;
    state = STATE_UPGRADE_DIALOG;
    upgradeDialogHover = null;
    upgradeDialogScroll = 0;
    upgradePanning = false;

    // Only auto-fit on first open; preserve user's zoom/pan after manual interaction
    if (!upgradeViewCustomized) {
      const layout = computeTreeLayout();
      if (layout.length) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const ln of layout) {
          if (ln.x < minX) minX = ln.x;
          if (ln.x + ln.w > maxX) maxX = ln.x + ln.w;
          if (ln.y < minY) minY = ln.y;
          if (ln.y + ln.h > maxY) maxY = ln.y + ln.h;
        }
        const treeW = maxX - minX + 80; // padding
        const treeH = maxY - minY + 80;
        const headerH = 170; // space reserved for title + resource bar
        const footerH = 50; // space for close hint
        const fitZoomX = CANVAS_W / treeW;
        const fitZoomY = (CANVAS_H - headerH - footerH) / treeH;
        upgradeZoom = Math.min(fitZoomX, fitZoomY, 1.0);
        upgradeZoom = Math.max(upgradeZoom, 0.3);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        upgradePanX = CANVAS_W / 2 - centerX * upgradeZoom;
        upgradePanY = (headerH + (CANVAS_H - headerH - footerH) / 2) - centerY * upgradeZoom;
      } else {
        upgradeZoom = 1.0;
        upgradePanX = 0;
        upgradePanY = 0;
      }
    }
  }

  function closeUpgradeDialog() {
    state = stateBeforeUpgradeDialog || STATE_PLAYING;
    stateBeforeUpgradeDialog = null;
    upgradeDialogHover = null;
  }

  function drawUpgradeDialog() {
    // Full-screen dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title (fixed, not affected by zoom/pan)
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffd700';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('UPGRADE TREE', CANVAS_W / 2, 60);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Resource bar at top (fixed)
    const resY = 100;
    ctx.fillStyle = 'rgba(20,25,40,0.9)';
    ctx.fillRect(20, resY, CANVAS_W - 40, 56);
    ctx.strokeStyle = '#3a4a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, resY, CANVAS_W - 40, 56);

    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const resBarY = resY + 28;
    let resBarX = 40;
    for (const entry of RESOURCE_HUD_ENTRIES) {
      if (resources[entry.key] <= 0 && entry.key !== 'iron' && entry.key !== 'water' && entry.key !== 'cobalt') continue;
      ctx.fillStyle = entry.color;
      const resText = `${entry.icon} ${entry.label}:${resources[entry.key]}`;
      ctx.fillText(resText, resBarX, resBarY);
      resBarX += ctx.measureText(resText).width + 20;
      if (resBarX > CANVAS_W - 280) break;
    }

    // Total upgrades stat
    let totalPurchased = 0, totalAvailable = 0;
    for (const n of UPGRADE_TREE) {
      totalPurchased += getTreeNodeLevel(n.id);
      totalAvailable += n.maxLevel;
    }
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'right';
    ctx.fillText(`Upgrades: ${totalPurchased}/${totalAvailable}`, CANVAS_W - 40, resBarY);

    // Apply zoom & pan transform for tree content
    ctx.save();
    ctx.translate(upgradePanX, upgradePanY);
    ctx.scale(upgradeZoom, upgradeZoom);

    // Compute node layout
    const layoutNodes = computeTreeLayout();

    // Branch headers -- derive center X from actual laid-out nodes
    for (const branch of TREE_BRANCH_ORDER) {
      const bNodes = layoutNodes.filter(ln => ln.branch === branch);
      if (!bNodes.length) continue;
      let minX = Infinity, maxX = -Infinity;
      for (const ln of bNodes) {
        if (ln.x < minX) minX = ln.x;
        if (ln.x + ln.w > maxX) maxX = ln.x + ln.w;
      }
      const bcx = (minX + maxX) / 2;
      ctx.fillStyle = TREE_BRANCH_COLORS[branch];
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TREE_BRANCH_LABELS[branch], bcx, 92 - upgradeDialogScroll);
    }

    // Draw connection lines first
    ctx.lineWidth = 4;
    for (const ln of layoutNodes) {
      const node = ln.node;
      for (const pid of node.prereqs) {
        const parent = layoutNodes.find(l => l.node.id === pid);
        if (!parent) continue;
        const fromX = parent.x + parent.w / 2;
        const fromY = parent.y + parent.h;
        const toX = ln.x + ln.w / 2;
        const toY = ln.y;

        const purchased = isTreeNodeMaxed(pid);
        const childAvail = isTreeNodeAvailable(node);

        if (purchased && childAvail)
          ctx.strokeStyle = canAffordTreeNode(node) ? TREE_BRANCH_COLORS[ln.branch] : 'rgba(255,165,0,0.5)';
        else if (purchased)
          ctx.strokeStyle = 'rgba(100,200,100,0.3)';
        else
          ctx.strokeStyle = 'rgba(100,100,100,0.2)';

        ctx.setLineDash(purchased ? [] : [8, 8]);
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        // Curved connector
        const midY = (fromY + toY) / 2;
        ctx.bezierCurveTo(fromX, midY, toX, midY, toX, toY);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Draw nodes
    for (const ln of layoutNodes) {
      const node = ln.node;
      const x = ln.x, y = ln.y, w = ln.w, h = ln.h;
      const lvl = getTreeNodeLevel(node.id);
      const maxed = lvl >= node.maxLevel;
      const prereqsMet = arePrereqsMet(node);
      const affordable = canAffordTreeNode(node);
      const available = prereqsMet && !maxed;
      const isHover = upgradeDialogHover === node.id;

      // Skip nodes that are fully off-screen
      if (y + h < 50 || y > CANVAS_H) continue;

      // Node background
      let bgColor, borderColor, borderWidth;
      if (maxed) {
        bgColor = 'rgba(30,80,30,0.7)';
        borderColor = '#0c0';
        borderWidth = 2;
      } else if (available && affordable) {
        bgColor = isHover ? 'rgba(60,80,120,0.9)' : 'rgba(40,60,100,0.7)';
        borderColor = isHover ? '#fff' : TREE_BRANCH_COLORS[ln.branch];
        borderWidth = isHover ? 2.5 : 2;
      } else if (available && !affordable) {
        bgColor = 'rgba(40,40,40,0.7)';
        borderColor = 'rgba(255,165,0,0.6)';
        borderWidth = 1.5;
      } else {
        bgColor = 'rgba(25,25,25,0.6)';
        borderColor = 'rgba(80,80,80,0.4)';
        borderWidth = 1;
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      if (!prereqsMet)
        ctx.setLineDash([6, 6]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Icon
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = maxed ? '#0f0' : (available ? '#fff' : '#555');
      ctx.fillText(node.icon, x + 8, y + h / 2 - 12);

      // Name
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = maxed ? '#8f8' : (available ? '#ddd' : '#666');
      ctx.fillText(node.name, x + 44, y + 28);

      // Cost display
      if (!maxed) {
        const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
        const COST_ABBREV = { iron: 'Fe', water: 'H2O', cobalt: 'Co', copper: 'Cu', tin: 'Sn', coal: 'C', lead: 'Pb', silver: 'Ag', gold: 'Au', quartz: 'Qz', redstone: 'Rs', emerald: 'Em', diamond: 'Di', ruby: 'Rb' };
        const COST_ICONS = { iron: '\u2699', water: '\u{1F4A7}', cobalt: '\u{1F48E}', copper: '\u{1FA99}', tin: '\u{1F52A}', coal: '\u{1F525}', lead: '\u26D3', silver: '\u2B50', gold: '\u{1F451}', quartz: '\u{1F52E}', redstone: '\u2764', emerald: '\u{1F49A}', diamond: '\u{1F4A0}', ruby: '\u2763' };
        let costParts = [];
        for (const key in cost)
          if ((cost[key] || 0) > 0)
            costParts.push(`${cost[key]}${COST_ICONS[key] || ''}${COST_ABBREV[key] || key}`);
        const costStr = costParts.join(' ');

        ctx.font = '16px sans-serif';
        ctx.fillStyle = affordable ? '#0f0' : '#a44';
        ctx.fillText(costStr, x + 44, y + 54);
      }

      // Level indicator / checkmark
      if (maxed) {
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('\u2714', x + w - 8, y + h / 2);
      } else if (!prereqsMet) {
        ctx.fillStyle = '#888';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('\u{1F512}', x + w - 8, y + h / 2);
      }

      // Level bar at bottom
      if (node.maxLevel > 1) {
        const barX = x + 8;
        const barY = y + h - 16;
        const barW = w - 16;
        const segW = barW / node.maxLevel;
        for (let s = 0; s < node.maxLevel; ++s) {
          ctx.fillStyle = s < lvl ? '#0c0' : '#222';
          ctx.fillRect(barX + s * segW + 2, barY, segW - 4, 8);
        }
      } else {
        // Single-level: thin indicator line
        const barX = x + 8;
        const barY = y + h - 12;
        const barW = w - 16;
        ctx.fillStyle = maxed ? '#0c0' : '#222';
        ctx.fillRect(barX, barY, barW, 6);
      }

      // Type indicator
      if (node.type === 'gadget') {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = maxed ? '#8f8' : '#888';
        ctx.fillText('GADGET', x + w - 8, y + h - 20);
      }

      // Hover tooltip
      if (isHover && !maxed && available) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Click to purchase', x + w / 2, y + h + 20);
      }
    }

    // End zoom/pan transform
    ctx.restore();

    // Close hint (fixed, not affected by zoom/pan)
    ctx.fillStyle = '#666';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Press U or Escape to close  |  Scroll=Zoom (${Math.round(upgradeZoom * 100)}%)  |  Right-drag=Pan`, CANVAS_W / 2, CANVAS_H - 20);
  }

  // Convert screen coords to tree-local coords (inverse zoom/pan)
  function screenToTreeCoords(mx, my) {
    return {
      x: (mx - upgradePanX) / upgradeZoom,
      y: (my - upgradePanY) / upgradeZoom
    };
  }

  function handleUpgradeDialogClick(mx, my) {
    const { x: tx, y: ty } = screenToTreeCoords(mx, my);
    const layoutNodes = computeTreeLayout();
    for (const ln of layoutNodes) {
      if (tx >= ln.x && tx <= ln.x + ln.w && ty >= ln.y && ty <= ln.y + ln.h) {
        const node = ln.node;
        if (isTreeNodeAvailable(node) && canAffordTreeNode(node))
          purchaseTreeNode(node);
        return;
      }
    }
  }

  function handleUpgradeDialogHover(mx, my) {
    const { x: tx, y: ty } = screenToTreeCoords(mx, my);
    const layoutNodes = computeTreeLayout();
    upgradeDialogHover = null;
    for (const ln of layoutNodes) {
      if (tx >= ln.x && tx <= ln.x + ln.w && ty >= ln.y && ty <= ln.y + ln.h) {
        upgradeDialogHover = ln.node.id;
        return;
      }
    }
  }

  /* ======================================================================
     GADGET UPDATES
     ====================================================================== */

  function updateGadgets(dt) {
    // -- Primary gadget updates --
    if (primaryGadget === 'repellent') {
      if (primaryGadgetState.active) {
        primaryGadgetState.duration -= dt;
        if (primaryGadgetState.duration <= 0) {
          primaryGadgetState.active = false;
          primaryGadgetState.cooldown = 30;
        }
      } else if (primaryGadgetState.cooldown > 0)
        primaryGadgetState.cooldown -= dt;
    }

    if (primaryGadget === 'orchard') {
      if (primaryGadgetState.speedBoostTimer > 0)
        primaryGadgetState.speedBoostTimer -= dt;

      if (!primaryGadgetState.fruitReady) {
        primaryGadgetState.fruitTimer -= dt;
        if (primaryGadgetState.fruitTimer <= 0)
          primaryGadgetState.fruitReady = true;
      }
    }

    if (primaryGadget === 'droneyard') {
      primaryGadgetState.droneTimer -= dt;
      if (primaryGadgetState.droneTimer <= 0) {
        primaryGadgetState.droneTimer = 15;
        // Auto-carry up to 10 resources from carried to deposited
        if (carried > 0) {
          const transfer = Math.min(carried, 10);
          carried -= transfer;
          floatingText.add(DOME_X - 80, DOME_Y - 80, `Drone: +${transfer} delivered`, { color: '#4af', font: 'bold 22px sans-serif' });
        }
      }
      // Animate drone phase for visual bob
      primaryGadgetState.dronePhase = (primaryGadgetState.dronePhase || 0) + dt * 3;
    }

    // -- Mine gadgets updates --
    // Auto Cannon
    if (foundGadgets.includes('autoCannon')) {
      // Always decay flash so the beam never persists after enemies die or view switches
      if (primaryGadgetState.autoCannonFlash > 0) {
        primaryGadgetState.autoCannonFlash -= dt;
        if (primaryGadgetState.autoCannonFlash <= 0) {
          primaryGadgetState.autoCannonFlash = 0;
          primaryGadgetState.autoCannonTarget = null;
        }
      }
      if (enemies.length > 0) {
        primaryGadgetState.autoCannonTimer = (primaryGadgetState.autoCannonTimer || 0) - dt;
        if (primaryGadgetState.autoCannonTimer <= 0) {
          primaryGadgetState.autoCannonTimer = 2;
          // Find nearest enemy
          let nearest = null, bestD = Infinity;
          for (const e of enemies) {
            const dx = e.x - DOME_X;
            const dy = e.y - DOME_Y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            applyDamageToEnemy(nearest, 5);
            // Store last target for drawing
            primaryGadgetState.autoCannonTarget = { x: nearest.x, y: nearest.y };
            primaryGadgetState.autoCannonFlash = 0.3;
            particles.burst(nearest.x, nearest.y, 6, { color: '#ff0', speed: 2, life: 0.3 });
          }
        }
      }
    }

    // Stun Laser
    if (foundGadgets.includes('stunLaser')) {
      // Always decay flash so the beam never persists after enemies die or view switches
      if (primaryGadgetState.stunLaserFlash > 0) {
        primaryGadgetState.stunLaserFlash -= dt;
        if (primaryGadgetState.stunLaserFlash <= 0) {
          primaryGadgetState.stunLaserFlash = 0;
          primaryGadgetState.stunLaserTarget = null;
        }
      }
      if (enemies.length > 0) {
        primaryGadgetState.stunLaserTimer = (primaryGadgetState.stunLaserTimer || 0) - dt;
        if (primaryGadgetState.stunLaserTimer <= 0) {
          primaryGadgetState.stunLaserTimer = 8;
          let nearest = null, bestD = Infinity;
          for (const e of enemies) {
            const dx = e.x - DOME_X;
            const dy = e.y - DOME_Y;
            const d = dx * dx + dy * dy;
            if (d < bestD) { bestD = d; nearest = e; }
          }
          if (nearest) {
            nearest.stunTimer = 2;
            primaryGadgetState.stunLaserTarget = { x: nearest.x, y: nearest.y };
            primaryGadgetState.stunLaserFlash = 0.4;
            floatingText.add(nearest.x, nearest.y - 40, 'STUNNED!', { color: '#4af', font: 'bold 22px sans-serif' });
          }
        }
      }
    }

    // Probe Scanner timer
    if (foundGadgets.includes('probeScanner') && primaryGadgetState.probeTimer > 0)
      primaryGadgetState.probeTimer -= dt;

    // Condenser
    if (foundGadgets.includes('condenser')) {
      primaryGadgetState.condenserTimer = (primaryGadgetState.condenserTimer || 0) - dt;
      if (primaryGadgetState.condenserTimer <= 0) {
        primaryGadgetState.condenserTimer = 30;
        resources.water += 5;
        floatingText.add(DOME_X + 80, DOME_Y - 40, '+5 water (condenser)', { color: '#6af', font: 'bold 22px sans-serif' });
      }
    }

    // -- New gadget effects --

    // Auto-Repair: slowly regenerate dome HP
    if (unlockedTools.autoRepair && domeHP < maxDomeHP) {
      toolState.autoRepairTimer = (toolState.autoRepairTimer || 0) - dt;
      if (toolState.autoRepairTimer <= 0) {
        toolState.autoRepairTimer = 5; // heal every 5 seconds
        const heal = 2;
        domeHP = Math.min(domeHP + heal, maxDomeHP);
        floatingText.add(DOME_X + 60, DOME_Y - 40, `+${heal} HP`, { color: '#0f0', font: 'bold 18px sans-serif' });
      }
    }

    // Energy Shield: absorb a percentage of damage (tracked passively via unlockedTools)

    // Magnet: auto-collect dropped resources within 2 tiles
    if (unlockedTools.magnet && currentView === VIEW_UNDERGROUND) {
      for (let i = droppedResources.length - 1; i >= 0; --i) {
        const drop = droppedResources[i];
        const dist = Math.abs(drop.col - drillX) + Math.abs(drop.row - drillY);
        if (dist > 2) continue;
        const canCarry = carryCapacity - carried;
        if (canCarry <= 0) break;
        const pickUp = Math.min(drop.value, canCarry);
        const label = TILE_LABELS[drop.type];
        resources[label] += pickUp;
        carried += pickUp;
        drop.value -= pickUp;
        if (drop.value <= 0)
          droppedResources.splice(i, 1);
      }
    }

    // Chain Lightning: when turret fires, extra damage arcs to nearby enemies (handled in weapon)
    // Freeze Ray: slows enemies near projectile impacts (handled in weapon)
    // Plasma Cannon: AoE damage on hit (handled in weapon)

    // Jetpack cooldown
    if (toolState.jetpackCooldown > 0)
      toolState.jetpackCooldown = Math.max(0, toolState.jetpackCooldown - dt);

    // Phase Shift cooldown
    if (toolState.phaseShiftCooldown > 0)
      toolState.phaseShiftCooldown = Math.max(0, toolState.phaseShiftCooldown - dt);

    // -- Unlockable tool cooldowns --
    if (toolState.blastToolCooldown > 0)
      toolState.blastToolCooldown = Math.max(0, toolState.blastToolCooldown - dt);
    if (toolState.teleporterCooldown > 0)
      toolState.teleporterCooldown = Math.max(0, toolState.teleporterCooldown - dt);

    // Scanner passive: always active when unlocked (echo location extends range)
    toolState.scannerActive = !!unlockedTools.scanner;
    toolState.echoLocationActive = !!unlockedTools.echoLocation;
  }

  /* ======================================================================
     MOVEMENT (mouse-based underground navigation)
     ====================================================================== */

  function updateMovement(dt) {
    if (currentView !== VIEW_UNDERGROUND) return;
    // Block movement while mining
    if (miningTarget) return;

    if (!movePath || movePathIndex >= movePath.length) {
      // Arrived at destination -- check queued mine action
      if (mineTarget && movePath) {
        tryMine(mineTarget.dx, mineTarget.dy);
        mineTarget = null;
      }
      movePath = null;
      moveTarget = null;
      return;
    }

    moveStepTimer -= dt;
    if (moveStepTimer <= 0) {
      moveStepTimer = moveStepInterval;
      const step = movePath[movePathIndex];
      // Spawn dust at old position
      const cx = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const cy = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      spawnDust(cx, cy);
      drillX = step.col;
      drillY = step.row;
      ++movePathIndex;
      // Pick up dropped resources at new position
      pickUpDroppedResources();
    }
  }

  function clearMoveTarget() {
    moveTarget = null;
    movePath = null;
    movePathIndex = 0;
    moveStepTimer = 0;
    mineTarget = null;
    cancelMining();
  }

  /* ======================================================================
     UPDATE
     ====================================================================== */

  function updateGame(dt) {
    if (state !== STATE_PLAYING) return;

    updateTransition(dt);
    updateAnimations(dt);
    updateGadgets(dt);
    updateMining(dt);
    updateMovement(dt);

    // Age dropped resources; despawn after 120s
    for (let i = droppedResources.length - 1; i >= 0; --i) {
      droppedResources[i].age += dt;
      if (droppedResources[i].age > 120)
        droppedResources.splice(i, 1);
    }

    // Center camera on player underground
    if (currentView !== VIEW_SURFACE) {
      const targetCamX = drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
      const targetCamY = drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
      const maxCamX = GRID_COLS * TILE_SIZE - CANVAS_W;
      const maxCamY = GRID_ROWS * TILE_SIZE - CANVAS_H;
      cameraX += (Math.max(0, Math.min(maxCamX, targetCamX)) - cameraX) * 0.15;
      cameraY += (Math.max(0, Math.min(maxCamY, targetCamY)) - cameraY) * 0.15;
    }

    if (!waveActive) {
      waveTimer -= dt;
      if (waveTimer <= 0)
        spawnWave();
    }

    updateEnemies(dt);
    updateWeapon(dt);
  }

  /* ======================================================================
     DRAWING HELPERS
     ====================================================================== */

  function drawGroundLayer() {
    const groundY = DOME_Y;

    // Multi-layer ground gradient
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_H);
    groundGrad.addColorStop(0, '#3a2510');
    groundGrad.addColorStop(0.3, '#2a1a0a');
    groundGrad.addColorStop(1, '#1a0f05');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, CANVAS_W, CANVAS_H - groundY);

    // Ground highlight edge
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(CANVAS_W, groundY);
    ctx.stroke();

    // Grass tufts along the ground line
    ctx.strokeStyle = '#2a5a1a';
    ctx.lineWidth = 3;
    for (let gx = 10; gx < CANVAS_W; gx += 24 + Math.sin(gx * 0.3) * 10) {
      const tiltSeed = Math.sin(gx * 0.7 + animTime * 0.8);
      const h = 8 + Math.abs(Math.sin(gx * 0.5)) * 12;
      ctx.beginPath();
      ctx.moveTo(gx, groundY);
      ctx.quadraticCurveTo(gx + tiltSeed * 6, groundY - h * 0.6, gx + tiltSeed * 4, groundY - h);
      ctx.stroke();
    }

    // Pebble/rock details on the ground surface
    ctx.fillStyle = '#4a3a20';
    const pebbleSeed = 42;
    for (let px = 40; px < CANVAS_W; px += 70 + ((px * pebbleSeed) % 40)) {
      const py = groundY + 10 + ((px * 7) % 30);
      const pr = 2 + ((px * 3) % 6);
      ctx.beginPath();
      ctx.ellipse(px, py, pr * 1.5, pr * 1, 0, 0, TWO_PI);
      ctx.fill();
    }
  }

  function drawDome() {
    const pulse = Math.sin(domePulsePhase) * 0.15;
    const flashAlpha = domeHitFlash * 0.6;
    const hpRatio = domeHP / maxDomeHP;

    // Dome interior gradient fill (semi-transparent)
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 2, Math.PI, 0);
    ctx.closePath();
    const interiorGrad = ctx.createRadialGradient(DOME_X, DOME_Y - 20, 10, DOME_X, DOME_Y, DOME_RADIUS);
    interiorGrad.addColorStop(0, 'rgba(80,140,220,0.08)');
    interiorGrad.addColorStop(0.6, 'rgba(60,120,200,0.04)');
    interiorGrad.addColorStop(1, 'rgba(40,100,180,0.02)');
    ctx.fillStyle = interiorGrad;
    ctx.fill();
    ctx.restore();

    // Hex pattern on dome
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - 1, Math.PI, 0);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = `rgba(100,180,255,${0.25 + pulse * 0.12})`;
    ctx.lineWidth = 2;
    const hexSize = 24;
    const hexH = hexSize * Math.sqrt(3);
    for (let hy = DOME_Y - DOME_RADIUS; hy < DOME_Y + 10; hy += hexH) {
      for (let hx = DOME_X - DOME_RADIUS; hx < DOME_X + DOME_RADIUS; hx += hexSize * 3) {
        const ox = ((Math.floor((hy - DOME_Y + DOME_RADIUS) / hexH)) % 2) * hexSize * 1.5;
        drawHexagon(hx + ox, hy, hexSize);
      }
    }
    ctx.restore();

    // Dome shield arc (main) -- thicker with more shield upgrades
    const shieldLevel = getEffectiveLevel('domeHP');
    const domeLineWidth = 3 + shieldLevel * 2;
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
    ctx.closePath();
    const domeGrad = ctx.createLinearGradient(DOME_X - DOME_RADIUS, DOME_Y, DOME_X + DOME_RADIUS, DOME_Y);
    domeGrad.addColorStop(0, `rgba(40,120,255,${0.5 + pulse})`);
    domeGrad.addColorStop(0.5, `rgba(80,170,255,${0.8 + pulse})`);
    domeGrad.addColorStop(1, `rgba(40,120,255,${0.5 + pulse})`);
    ctx.strokeStyle = domeGrad;
    ctx.lineWidth = domeLineWidth;
    ctx.shadowBlur = 20 + pulse * 10 + shieldLevel * 3;
    ctx.shadowColor = '#4af';
    ctx.stroke();

    // Second pass -- brighter inner line
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS - domeLineWidth / 2, Math.PI, 0);
    ctx.strokeStyle = `rgba(140,200,255,${0.3 + pulse * 0.2})`;
    ctx.lineWidth = 1 + shieldLevel * 0.5;
    ctx.shadowBlur = 8 + shieldLevel * 2;
    ctx.shadowColor = '#8cf';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Dome base (ground contact)
    ctx.beginPath();
    ctx.moveTo(DOME_X - DOME_RADIUS, DOME_Y);
    ctx.lineTo(DOME_X + DOME_RADIUS, DOME_Y);
    ctx.strokeStyle = '#4af';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Dome hit flash overlay
    if (flashAlpha > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,80,80,${flashAlpha})`;
      ctx.fill();
      ctx.restore();
    }

    // Shield impact flashes
    for (const impact of shieldImpacts) {
      const ia = impact.angle;
      const il = impact.life;
      ctx.save();
      ctx.beginPath();
      const arcSpan = 0.3 * il;
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 4, ia - arcSpan, ia + arcSpan);
      ctx.strokeStyle = `rgba(100,200,255,${il * 0.8})`;
      ctx.lineWidth = 8 * il;
      ctx.shadowBlur = 15 * il;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Turret nozzle position on dome arc
    const nozzleDrawR = DOME_RADIUS + 16;
    const tbx = DOME_X + Math.cos(turretAngle) * nozzleDrawR;
    const tby = DOME_Y + Math.sin(turretAngle) * nozzleDrawR;

    // Dome turret base (small weapon mount at nozzle position)
    ctx.save();
    ctx.translate(tbx, tby);
    ctx.rotate(turretAngle + Math.PI / 2);
    ctx.fillStyle = '#6a8ab0';
    ctx.fillRect(-8, -12, 16, 24);
    const turretGrad = ctx.createLinearGradient(-8, 0, 8, 0);
    turretGrad.addColorStop(0, '#8ab0d0');
    turretGrad.addColorStop(1, '#4a6a8a');
    ctx.fillStyle = turretGrad;
    ctx.fillRect(-6, -8, 12, 16);
    ctx.restore();

    // Turret barrel (rotates with turretAngle)
    ctx.save();
    ctx.translate(tbx, tby);
    ctx.rotate(turretAngle);
    // Barrel body
    ctx.fillStyle = '#556';
    ctx.fillRect(0, -3, TURRET_BARREL_LENGTH, 6);
    // Barrel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, -3, TURRET_BARREL_LENGTH, 2);
    // Muzzle tip
    ctx.fillStyle = '#778';
    ctx.fillRect(TURRET_BARREL_LENGTH - 6, -5, 6, 10);
    ctx.restore();

    // Turret pivot dot
    ctx.fillStyle = '#aac';
    ctx.beginPath();
    ctx.arc(tbx, tby, 6, 0, TWO_PI);
    ctx.fill();

    // Dome HP bar with gradient
    const barW = 240;
    const barH = 20;
    const barX = DOME_X - barW / 2;
    const barY = DOME_Y + 44;

    // Bar background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    // Health bar fill with gradient
    const hpBarGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    if (hpRatio > 0.3) {
      hpBarGrad.addColorStop(0, '#6e6');
      hpBarGrad.addColorStop(0.5, '#4c4');
      hpBarGrad.addColorStop(1, '#3a3');
    } else {
      hpBarGrad.addColorStop(0, '#f66');
      hpBarGrad.addColorStop(0.5, '#f44');
      hpBarGrad.addColorStop(1, '#c22');
    }
    ctx.fillStyle = hpBarGrad;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    // HP bar highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW * hpRatio, barH / 2);

    // Bar border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // HP text
    ctx.fillStyle = '#ddd';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.ceil(domeHP)}/${maxDomeHP}`, DOME_X, barY + barH + 6);
  }

  function drawHexagon(cx, cy, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; ++i) {
      const a = (TWO_PI / 6) * i - Math.PI / 6;
      const hx = cx + Math.cos(a) * size;
      const hy = cy + Math.sin(a) * size;
      if (i === 0)
        ctx.moveTo(hx, hy);
      else
        ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function drawEnemy(e) {
    if (e.type === 'flyer')
      return drawFlyer(e);
    return drawGroundEnemy(e);
  }

  function drawGroundEnemy(e) {
    const hpR = e.hp / e.maxHP;
    const sz = e.size || 10;
    const wobble = Math.sin(e.wobblePhase) * 3;
    const legOffset = Math.sin(e.legPhase) * 6;

    ctx.save();
    ctx.translate(e.x, e.y + wobble);

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, sz + 4, sz * 0.8, 6, 0, 0, TWO_PI);
    ctx.fill();

    // Legs (4 little appendages)
    ctx.strokeStyle = e.armored ? '#664' : '#a33';
    ctx.lineWidth = e.boss ? 6 : 4;
    // Left legs
    ctx.beginPath();
    ctx.moveTo(-sz * 0.4, sz * 0.3);
    ctx.lineTo(-sz * 0.8, sz * 0.6 + legOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, sz * 0.1);
    ctx.lineTo(-sz * 0.7, sz * 0.3 - legOffset);
    ctx.stroke();
    // Right legs
    ctx.beginPath();
    ctx.moveTo(sz * 0.4, sz * 0.3);
    ctx.lineTo(sz * 0.8, sz * 0.6 - legOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, sz * 0.1);
    ctx.lineTo(sz * 0.7, sz * 0.3 + legOffset);
    ctx.stroke();

    // Body -- gradient sphere (armored = darker metallic, boss = thicker border)
    const bodyGrad = ctx.createRadialGradient(-sz * 0.15, -sz * 0.2, 1, 0, 0, sz);
    if (e.armored) {
      bodyGrad.addColorStop(0, `rgba(160,140,100,${0.6 + hpR * 0.4})`);
      bodyGrad.addColorStop(0.6, `rgba(100,90,60,${0.5 + hpR * 0.5})`);
      bodyGrad.addColorStop(1, `rgba(60,50,30,${0.4 + hpR * 0.4})`);
    } else {
      bodyGrad.addColorStop(0, `rgba(240,80,80,${0.6 + hpR * 0.4})`);
      bodyGrad.addColorStop(0.6, `rgba(180,40,40,${0.5 + hpR * 0.5})`);
      bodyGrad.addColorStop(1, `rgba(100,20,20,${0.4 + hpR * 0.4})`);
    }
    ctx.beginPath();
    ctx.arc(0, 0, sz, 0, TWO_PI);
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 8;
    ctx.shadowColor = e.armored
      ? `rgba(180,160,80,${0.3 + hpR * 0.4})`
      : `rgba(255,50,50,${0.3 + hpR * 0.4})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Boss: thicker border ring
    if (e.boss) {
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 4, 0, TWO_PI);
      ctx.stroke();
    }

    // Body highlight (specular)
    ctx.fillStyle = e.armored ? 'rgba(220,210,170,0.3)' : 'rgba(255,180,180,0.3)';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.25, -sz * 0.3, sz * 0.35, sz * 0.2, -0.3, 0, TWO_PI);
    ctx.fill();

    // Boss: crown/horns
    if (e.boss) {
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.moveTo(-sz * 0.5, -sz * 0.85);
      ctx.lineTo(-sz * 0.3, -sz * 1.3);
      ctx.lineTo(-sz * 0.1, -sz * 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sz * 0.1, -sz * 0.85);
      ctx.lineTo(sz * 0.3, -sz * 1.3);
      ctx.lineTo(sz * 0.5, -sz * 0.85);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-sz * 0.2, -sz * 0.9);
      ctx.lineTo(0, -sz * 1.45);
      ctx.lineTo(sz * 0.2, -sz * 0.9);
      ctx.fill();
    }

    // Eyes
    const eyeH = e.eyeBlinking ? 1 : 6;
    ctx.fillStyle = e.boss ? '#f00' : '#ff0';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.3, -sz * 0.15, 6, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    if (!e.eyeBlinking) {
      ctx.fillStyle = '#200';
      ctx.beginPath();
      ctx.arc(-sz * 0.3, -sz * 0.15, 2.4, 0, TWO_PI);
      ctx.fill();
    }
    ctx.fillStyle = e.boss ? '#f00' : '#ff0';
    ctx.beginPath();
    ctx.ellipse(sz * 0.3, -sz * 0.15, 6, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    if (!e.eyeBlinking) {
      ctx.fillStyle = '#200';
      ctx.beginPath();
      ctx.arc(sz * 0.3, -sz * 0.15, 2.4, 0, TWO_PI);
      ctx.fill();
    }

    // Mouth (angry slit)
    ctx.strokeStyle = '#300';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-sz * 0.25, sz * 0.25);
    ctx.quadraticCurveTo(0, sz * 0.4, sz * 0.25, sz * 0.25);
    ctx.stroke();

    // Stun overlay
    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
    }

    ctx.restore();

    // Shield arc
    if (e.shield > 0)
      drawEnemyShield(e, wobble);

    // Enemy HP bar (improved)
    drawEnemyHPBar(e, sz, wobble);
  }

  function drawFlyer(e) {
    const hpR = e.hp / e.maxHP;
    const sz = e.size || 7;
    const bob = Math.sin(e.wobblePhase) * 8; // sinusoidal vertical bobbing

    ctx.save();
    ctx.translate(e.x, e.y + bob);

    // Faint shadow far below (on ground)
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, 80 - bob, sz * 0.5, 4, 0, 0, TWO_PI);
    ctx.fill();

    // Wings (flapping lines)
    ctx.strokeStyle = '#806';
    ctx.lineWidth = 4;
    // Left wing
    ctx.beginPath();
    ctx.moveTo(-sz * 0.3, 0);
    ctx.lineTo(-sz * 1.4, -sz * 0.3 + Math.sin(e.wingPhase || 0) * sz * 0.5);
    ctx.lineTo(-sz * 0.9, sz * 0.2 + Math.sin(e.wingPhase || 0) * sz * 0.3);
    ctx.stroke();
    // Right wing
    ctx.beginPath();
    ctx.moveTo(sz * 0.3, 0);
    ctx.lineTo(sz * 1.4, -sz * 0.3 + Math.sin((e.wingPhase || 0) + Math.PI) * sz * 0.5);
    ctx.lineTo(sz * 0.9, sz * 0.2 + Math.sin((e.wingPhase || 0) + Math.PI) * sz * 0.3);
    ctx.stroke();

    // Body -- triangular/bat-like, purple/dark
    const bodyGrad = ctx.createRadialGradient(0, -sz * 0.1, 1, 0, 0, sz);
    bodyGrad.addColorStop(0, `rgba(160,60,180,${0.6 + hpR * 0.4})`);
    bodyGrad.addColorStop(0.6, `rgba(100,30,120,${0.5 + hpR * 0.5})`);
    bodyGrad.addColorStop(1, `rgba(50,15,60,${0.4 + hpR * 0.4})`);
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.9);
    ctx.lineTo(-sz * 0.7, sz * 0.5);
    ctx.lineTo(0, sz * 0.3);
    ctx.lineTo(sz * 0.7, sz * 0.5);
    ctx.closePath();
    ctx.fillStyle = bodyGrad;
    ctx.shadowBlur = 6;
    ctx.shadowColor = `rgba(180,60,220,${0.3 + hpR * 0.4})`;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Body highlight
    ctx.fillStyle = 'rgba(220,180,240,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, -sz * 0.3, sz * 0.25, sz * 0.15, 0, 0, TWO_PI);
    ctx.fill();

    // Glowing eyes (larger, more menacing)
    const eyeH = e.eyeBlinking ? 0.6 : 5;
    ctx.fillStyle = '#f0f';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#f0f';
    ctx.beginPath();
    ctx.ellipse(-sz * 0.2, -sz * 0.2, 4, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sz * 0.2, -sz * 0.2, 4, eyeH, 0, 0, TWO_PI);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Stun overlay
    if (e.stunTimer > 0) {
      ctx.fillStyle = `rgba(80,160,255,${0.25 + Math.sin(animTime * 10) * 0.1})`;
      ctx.beginPath();
      ctx.arc(0, 0, sz + 6, 0, TWO_PI);
      ctx.fill();
    }

    ctx.restore();

    // Shield arc
    if (e.shield > 0)
      drawEnemyShield(e, bob);

    // HP bar
    drawEnemyHPBar(e, sz, bob);
  }

  function drawEnemyShield(e, vertOffset) {
    const sz = e.size || 10;
    const shieldR = e.shield / (e.maxShield || 1);
    ctx.save();
    ctx.translate(e.x, e.y + vertOffset);
    ctx.strokeStyle = `rgba(80,160,255,${0.4 + shieldR * 0.4})`;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#4af';
    ctx.beginPath();
    ctx.arc(0, 0, sz + 10, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawEnemyHPBar(e, sz, vertOffset) {
    const hpR = e.hp / e.maxHP;
    const barW = sz * 2 + 8;
    const barX = e.x - barW / 2;
    const barY = e.y - sz - 20 + vertOffset;
    ctx.fillStyle = '#200';
    ctx.fillRect(barX, barY, barW, 8);
    const ehpGrad = ctx.createLinearGradient(barX, barY, barX + barW * hpR, barY);
    ehpGrad.addColorStop(0, '#f66');
    ehpGrad.addColorStop(1, '#f44');
    ctx.fillStyle = ehpGrad;
    ctx.fillRect(barX, barY, barW * hpR, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW * hpR, 4);

    // Shield bar (drawn above HP bar if shield exists)
    if (e.shield > 0 && e.maxShield > 0) {
      const shieldR = e.shield / e.maxShield;
      ctx.fillStyle = '#024';
      ctx.fillRect(barX, barY - 10, barW, 6);
      ctx.fillStyle = '#4af';
      ctx.fillRect(barX, barY - 10, barW * shieldR, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY - 10, barW * shieldR, 2);
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      const alpha = p.life / p.maxLife;

      // Electric arc effect using shared helper
      SZ.GameEffects.drawElectricArc(ctx, p.x, p.y, p.tx, p.ty, {
        segments: 8,
        jitter: 12 * alpha,
        color: `rgba(255,120,120,${alpha})`,
        glowColor: `rgba(255,60,60,${alpha * 0.5})`,
        width: 3 * alpha,
        glowWidth: 8 * alpha
      });

      // Impact flash
      ctx.beginPath();
      ctx.arc(p.tx, p.ty, 12 * alpha, 0, TWO_PI);
      const impactGrad = ctx.createRadialGradient(p.tx, p.ty, 0, p.tx, p.ty, 12 * alpha);
      impactGrad.addColorStop(0, `rgba(255,220,150,${alpha})`);
      impactGrad.addColorStop(0.5, `rgba(255,100,50,${alpha * 0.6})`);
      impactGrad.addColorStop(1, `rgba(255,50,50,0)`);
      ctx.fillStyle = impactGrad;
      ctx.fill();

      // Emit trail particles along beam
      if (Math.random() < 0.3) {
        const t = Math.random();
        const px = p.x + (p.tx - p.x) * t;
        const py = p.y + (p.ty - p.y) * t;
        particles.trail(px, py, { color: '#f88', life: 0.15, size: 1 });
      }
    }
  }

  /* ======================================================================
     DRAWING -- SURFACE
     ====================================================================== */

  function drawSurface() {
    // Sky gradient (deeper, richer)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, DOME_Y);
    skyGrad.addColorStop(0, '#050520');
    skyGrad.addColorStop(0.4, '#0a0a30');
    skyGrad.addColorStop(0.7, '#101040');
    skyGrad.addColorStop(1, '#1a1a50');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, DOME_Y);

    // Starfield
    starfield.draw(ctx);

    // Distant mountains silhouette
    ctx.fillStyle = '#0f0f2a';
    ctx.beginPath();
    ctx.moveTo(0, DOME_Y);
    for (let mx = 0; mx <= CANVAS_W; mx += 2) {
      const h = 40 + Math.sin(mx * 0.008) * 50 + Math.sin(mx * 0.02 + 1) * 24 + Math.sin(mx * 0.05 + 2) * 10;
      ctx.lineTo(mx, DOME_Y - h);
    }
    ctx.lineTo(CANVAS_W, DOME_Y);
    ctx.closePath();
    ctx.fill();

    // Near hills
    ctx.fillStyle = '#151530';
    ctx.beginPath();
    ctx.moveTo(0, DOME_Y);
    for (let mx = 0; mx <= CANVAS_W; mx += 2) {
      const h = 16 + Math.sin(mx * 0.015 + 3) * 24 + Math.sin(mx * 0.04) * 12;
      ctx.lineTo(mx, DOME_Y - h);
    }
    ctx.lineTo(CANVAS_W, DOME_Y);
    ctx.closePath();
    ctx.fill();

    // Ground layer with details
    drawGroundLayer();

    // Dome
    drawDome();

    // Gadget visuals on surface
    drawSurfaceGadgets();

    // Enemies
    for (const e of enemies)
      drawEnemy(e);

    // Projectiles
    drawProjectiles();

    // Wave info with styled text
    ctx.fillStyle = '#bbb';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    if (waveActive) {
      ctx.fillStyle = '#f88';
      ctx.fillText(`Wave ${waveNumber}`, 20, 28);
      ctx.fillStyle = '#aaa';
      ctx.font = '22px sans-serif';
      ctx.fillText(`${enemies.length} enemies remaining`, 20, 60);
    } else {
      ctx.fillText(`Next wave in ${Math.ceil(waveTimer)}s`, 20, 28);
      // Timer bar
      const timerRatio = waveTimer / WAVE_INTERVAL;
      ctx.fillStyle = '#333';
      ctx.fillRect(20, 64, 200, 8);
      ctx.fillStyle = '#f80';
      ctx.fillRect(20, 64, 200 * (1 - timerRatio), 8);
    }

    // Score with glow
    ctx.textAlign = 'right';
    ctx.fillStyle = '#dd8';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`Score: ${score}`, CANVAS_W - 20, 28);

    // View toggle hint
    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '22px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('SPACE = underground  |  U = upgrade tree', CANVAS_W / 2, CANVAS_H - 20);

    // Upgrade panel
    drawUpgradePanel();
  }

  /* ======================================================================
     DRAWING -- UNDERGROUND
     ====================================================================== */

  function drawUnderground() {
    // Dark cavern background (flat fill for performance)
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid tiles (viewport culled)
    const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endCol = Math.min(GRID_COLS, Math.ceil((cameraX + CANVAS_W) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
    const endRow = Math.min(GRID_ROWS, Math.ceil((cameraY + CANVAS_H) / TILE_SIZE));

    for (let r = startRow; r < endRow; ++r) {
      for (let c = startCol; c < endCol; ++c) {
        const x = c * TILE_SIZE - cameraX;
        const y = r * TILE_SIZE - cameraY;
        const tile = undergroundGrid[r][c];

        if (tile === TILE_EMPTY) {
          // Empty cave space (flat fill for performance)
          ctx.fillStyle = '#140f0a';
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (tile === TILE_GADGET) {
          // Gadget tiles rendered by drawUndergroundGadgets() -- draw dirt base here
          drawTile(x, y, TILE_DIRT, r, c);
        } else {
          drawTile(x, y, tile, r, c);
        }

        // Draw crack overlay for partially-mined tiles
        if (tile !== TILE_EMPTY && tileHP[r] && tileMaxHP[r] && tileMaxHP[r][c] > 0) {
          const hpRatio = tileHP[r][c] / tileMaxHP[r][c];
          if (hpRatio < 0.99) {
            const damage = 1 - hpRatio; // 0 = pristine, 1 = about to break
            // Darken overlay proportional to damage
            ctx.fillStyle = `rgba(0,0,0,${damage * 0.4})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
            // Draw crack lines that grow with damage
            ctx.strokeStyle = `rgba(0,0,0,${0.2 + damage * 0.5})`;
            ctx.lineWidth = 0.8 + damage * 1.2;
            const seed = r * GRID_COLS + c;
            const cx = x + TILE_SIZE / 2;
            const cy = y + TILE_SIZE / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (seed % 13 - 6) * damage, cy + (seed % 11 - 5) * damage);
            ctx.lineTo(cx + (seed % 17 - 8) * damage, cy + (seed % 9 - 4) * damage * 1.5);
            ctx.stroke();
            if (damage > 0.4) {
              ctx.beginPath();
              ctx.moveTo(cx - 3, cy + 2);
              ctx.lineTo(cx + (seed % 7 - 3) * damage * 1.3, cy - (seed % 5 + 2) * damage);
              ctx.stroke();
            }
          }
        }

        // Grid lines
        ctx.strokeStyle = '#2a2010';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      }
    }

    // Gadget chamber overlays and probe highlights
    drawUndergroundGadgets();

    // Resource reveal glows (drawn over tiles)
    for (const g of resourceGlows) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, TWO_PI);
      const glowGrad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
      glowGrad.addColorStop(0, `rgba(255,255,255,${g.life * 0.4})`);
      glowGrad.addColorStop(0.5, hexToRgba(g.color, g.life * 0.2));
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fill();
      ctx.restore();
    }

    // Rock crumble debris
    for (const crumble of crumbleEffects) {
      const alpha = Math.max(0, crumble.life / 0.6);
      ctx.globalAlpha = alpha;
      for (const p of crumble.pieces) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Dust clouds
    for (const d of dustClouds) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius, 0, TWO_PI);
      ctx.fillStyle = '#8a7a5a';
      ctx.fill();
      ctx.restore();
    }

    // Draw dropped resources as small colored dots (viewport-culled)
    for (const drop of droppedResources) {
      const dx = drop.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const dy = drop.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      if (dx < -TILE_SIZE || dx > CANVAS_W + TILE_SIZE || dy < -TILE_SIZE || dy > CANVAS_H + TILE_SIZE) continue;
      const dropColor = TILE_HIGHLIGHT_COLORS[drop.type] || '#fff';
      const pulse = Math.sin(animTime * 4 + drop.col + drop.row) * 0.3 + 0.7;
      ctx.fillStyle = dropColor;
      ctx.globalAlpha = pulse;
      ctx.fillRect(dx - 10, dy - 8, 8, 8);
      ctx.fillRect(dx + 2, dy - 2, 7, 7);
      ctx.fillRect(dx - 4, dy + 4, 6, 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(drop.value), dx, dy - 12);
    }

    // Draw mining progress bar above the block being mined
    if (miningTarget && miningDuration > 0) {
      const mx = miningTarget.col * TILE_SIZE - cameraX;
      const my = miningTarget.row * TILE_SIZE - cameraY;
      const barW = TILE_SIZE - 8;
      const barH = 5;
      const barX = mx + 4;
      const barY = my - barH - 3;
      const progress = Math.min(miningProgress / miningDuration, 1);

      // Bar background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);

      // Bar fill (gradient from yellow to green as it completes)
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
      barGrad.addColorStop(0, '#da2');
      barGrad.addColorStop(1, progress > 0.8 ? '#0c0' : '#fa0');
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX, barY, barW * progress, barH);

      // Bar highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY, barW * progress, barH / 2);

      // Bar border
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);
    }

    // Draw planned path dots
    if (movePath && movePathIndex < movePath.length) {
      ctx.fillStyle = 'rgba(100,200,255,0.3)';
      for (let pi = movePathIndex; pi < movePath.length; ++pi) {
        const step = movePath[pi];
        const px = step.col * TILE_SIZE + TILE_SIZE / 2 - cameraX;
        const py = step.row * TILE_SIZE + TILE_SIZE / 2 - cameraY;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, TWO_PI);
        ctx.fill();
      }
      // Draw dots connecting them
      ctx.strokeStyle = 'rgba(100,200,255,0.15)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      const pathStartX = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const pathStartY = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      ctx.moveTo(pathStartX, pathStartY);
      for (let pi = movePathIndex; pi < movePath.length; ++pi) {
        const step = movePath[pi];
        ctx.lineTo(step.col * TILE_SIZE + TILE_SIZE / 2 - cameraX,
                   step.row * TILE_SIZE + TILE_SIZE / 2 - cameraY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Show mine target marker
      if (mineTarget) {
        ctx.strokeStyle = 'rgba(255,100,50,0.4)';
        ctx.lineWidth = 4;
        ctx.strokeRect(mineTarget.col * TILE_SIZE + 2 - cameraX,
                       mineTarget.row * TILE_SIZE + 2 - cameraY,
                       TILE_SIZE - 4, TILE_SIZE - 4);
      }
    }

    // Draw drill/player character
    drawPlayer();

    // Resource display (improved styling)
    drawResourceHUD();

    // View toggle hint
    // Blast charges hint
    if (foundGadgets.includes('blastMining') && (primaryGadgetState.blastCharges || 0) > 0) {
      ctx.fillStyle = '#f80';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`Blast [B]: ${primaryGadgetState.blastCharges}`, CANVAS_W - 20, CANVAS_H - 110);
    }

    // Tool HUD (underground)
    drawToolHUDUnderground();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#555';
    ctx.font = '22px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Press SPACE to return to surface', CANVAS_W / 2, CANVAS_H - 20);
  }

  // Pre-generate deterministic ore speckle positions per tile
  let oreSpeckles = [];
  function generateOreSpeckles() {
    oreSpeckles = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c) {
        const dots = [];
        for (let d = 0; d < 10; ++d)
          dots.push({
            ox: 4 + Math.random() * (TILE_SIZE - 8),
            oy: 4 + Math.random() * (TILE_SIZE - 8),
            size: 1.5 + Math.random() * 2.5,
            brightness: 0.4 + Math.random() * 0.6
          });
        row.push(dots);
      }
      oreSpeckles.push(row);
    }
  }

  function drawTile(x, y, tile, r, c) {
    // Depth-based colors for dirt tiles
    let baseColor, shadowColor, highlightColor;
    if (tile === TILE_DIRT) {
      const tier = getDepthDirtColors(r);
      baseColor = tier.base;
      shadowColor = tier.shadow;
      highlightColor = tier.highlight;
    } else {
      baseColor = TILE_COLORS[tile] || '#3a2a1a';
      shadowColor = TILE_SHADOW_COLORS[tile] || '#1a0f05';
      highlightColor = TILE_HIGHLIGHT_COLORS[tile];
    }
    const bevel = 3; // bevel thickness in pixels

    // Main tile fill (flat base)
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    // === Minecraft-style 3D bevel ===
    // Top bevel (bright highlight)
    ctx.fillStyle = highlightColor || lightenColor(baseColor, 40);
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, bevel);

    // Left bevel (slightly less bright)
    ctx.fillStyle = lightenColor(baseColor, 25);
    ctx.fillRect(x + 1, y + 1 + bevel, bevel, TILE_SIZE - 2 - bevel * 2);

    // Bottom bevel (dark shadow)
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 1, y + TILE_SIZE - 1 - bevel, TILE_SIZE - 2, bevel);

    // Right bevel (medium shadow)
    ctx.fillStyle = lightenColor(shadowColor.startsWith('#') ? shadowColor : '#1a0f05', 15);
    ctx.fillRect(x + TILE_SIZE - 1 - bevel, y + 1 + bevel, bevel, TILE_SIZE - 2 - bevel * 2);

    // Inner face (flat fill for performance -- avoids per-tile gradient creation)
    ctx.fillStyle = baseColor;
    ctx.fillRect(x + 1 + bevel, y + 1 + bevel, TILE_SIZE - 2 - bevel * 2, TILE_SIZE - 2 - bevel * 2);

    // Dirt texture noise dots
    if (tile === TILE_DIRT && dirtNoise[r] && dirtNoise[r][c]) {
      for (const dot of dirtNoise[r][c]) {
        ctx.fillStyle = `rgba(0,0,0,${dot.shade})`;
        ctx.beginPath();
        ctx.arc(x + dot.ox, y + dot.oy, dot.size * 0.6, 0, TWO_PI);
        ctx.fill();
      }
      // Small cracks on dirt
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 0.5;
      const seed = r * GRID_COLS + c;
      ctx.beginPath();
      ctx.moveTo(x + 8 + (seed % 10), y + 5 + (seed % 7));
      ctx.lineTo(x + 15 + (seed % 12), y + 18 + (seed % 5));
      ctx.lineTo(x + 20 + (seed % 8), y + 28 + (seed % 9));
      ctx.stroke();
    }

    // === Ore-specific decorations ===
    if (tile !== TILE_DIRT) {
      const colors = ORE_SPECKLE_COLORS[tile] || ['#fff'];
      if (oreSpeckles[r] && oreSpeckles[r][c]) {
        for (const dot of oreSpeckles[r][c]) {
          const ci = Math.floor(dot.brightness * colors.length) % colors.length;
          ctx.fillStyle = colors[ci];
          const sz = dot.size;
          ctx.fillRect(x + dot.ox - sz / 2, y + dot.oy - sz / 2, sz, sz);
        }
      }

      // Glowing edge around resource tiles (no shadowBlur for performance)
      const glowPulse = Math.sin(animTime * 3 + r * 0.5 + c * 0.7) * 0.3 + 0.3;
      ctx.strokeStyle = highlightColor || baseColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5 + glowPulse;
      ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      ctx.globalAlpha = 1;

      // Resource-specific animated details (only near player to save draw calls)
      const nearPlayer = Math.abs(r - drillY) + Math.abs(c - drillX) <= 6;
      if (nearPlayer) {
        if (tile === TILE_IRON) {
          ctx.fillStyle = 'rgba(200,200,200,0.15)';
          ctx.fillRect(x + 8, y + 10, 3, 20);
          ctx.fillRect(x + 18, y + 6, 3, 15);
          ctx.fillRect(x + 28, y + 12, 3, 18);
        } else if (tile === TILE_WATER) {
          ctx.strokeStyle = 'rgba(100,180,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let wx = x + 5; wx < x + TILE_SIZE - 5; wx += 4) {
            const wy = y + TILE_SIZE / 2 + Math.sin((wx - x) * 0.3 + animTime * 4) * 3;
            if (wx === x + 5)
              ctx.moveTo(wx, wy);
            else
              ctx.lineTo(wx, wy);
          }
          ctx.stroke();
        } else if (tile === TILE_COBALT) {
          ctx.fillStyle = 'rgba(100,100,200,0.2)';
          ctx.beginPath();
          ctx.moveTo(x + 12, y + 8);
          ctx.lineTo(x + 20, y + 5);
          ctx.lineTo(x + 28, y + 14);
          ctx.lineTo(x + 22, y + 20);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Resource icon
      const tIcon = TILE_ICONS[tile];
      if (tIcon) {
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tIcon, x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 8);
      }
    }
  }

  function drawPlayer() {
    const px = drillX * TILE_SIZE - cameraX;
    const py = drillY * TILE_SIZE - cameraY;
    const cx = px + TILE_SIZE / 2;
    const cy = px + TILE_SIZE / 2; // intentionally kept but we use py below
    const bob = playerBob;

    // Selection highlight (animated border)
    const selPulse = Math.sin(animTime * 5) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,255,0,${selPulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.setLineDash([]);

    // Player body
    const bodyX = px + TILE_SIZE / 2;
    const bodyY = py + TILE_SIZE / 2 + bob;

    ctx.save();
    ctx.translate(bodyX, bodyY);
    ctx.scale(0.5, 0.5);

    // Mining helmet (top arc)
    ctx.fillStyle = '#da2';
    ctx.beginPath();
    ctx.arc(0, -8, 16, Math.PI, 0);
    ctx.fill();
    // Helmet highlight
    ctx.fillStyle = '#fc4';
    ctx.beginPath();
    ctx.arc(-4, -12, 6, Math.PI, 0);
    ctx.fill();
    // Headlamp
    ctx.fillStyle = '#ff8';
    ctx.beginPath();
    ctx.arc(0, -16, 5, 0, TWO_PI);
    ctx.fill();
    // Headlamp glow
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff8';
    ctx.beginPath();
    ctx.arc(0, -16, 4, 0, TWO_PI);
    ctx.fillStyle = 'rgba(255,255,128,0.3)';
    ctx.fill();
    ctx.restore();

    // Face
    ctx.fillStyle = '#d8a060';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, TWO_PI);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-5, -2, 2.4, 0, TWO_PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -2, 2.4, 0, TWO_PI);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = '#733';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Body/suit
    ctx.fillStyle = '#36a';
    ctx.fillRect(-10, 12, 20, 16);

    // Arms (one holds pickaxe)
    ctx.strokeStyle = '#d8a060';
    ctx.lineWidth = 5;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(-18, 28);
    ctx.stroke();
    // Right arm (holding pickaxe, animated)
    ctx.beginPath();
    ctx.moveTo(10, 16);
    if (pickaxeSwinging) {
      const swingDir = lastMineDir.dx !== 0 ? lastMineDir.dx : lastMineDir.dy;
      ctx.lineTo(10 + Math.cos(-pickaxeAngle * swingDir) * 16, 16 + Math.sin(pickaxeAngle) * 8);
    } else
      ctx.lineTo(18, 28);
    ctx.stroke();

    // Pickaxe in right hand
    ctx.save();
    if (pickaxeSwinging) {
      const swingAngle = pickaxeAngle * (lastMineDir.dx >= 0 ? 1 : -1);
      ctx.translate(14, 20);
      ctx.rotate(-0.5 + swingAngle * 1.5);
    } else {
      ctx.translate(18, 26);
      ctx.rotate(-0.3);
    }
    // Handle
    ctx.strokeStyle = '#854';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16, -12);
    ctx.stroke();
    // Pick head
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(26, -16);
    ctx.lineTo(20, -8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -12);
    ctx.lineTo(10, -20);
    ctx.lineTo(12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Legs
    ctx.strokeStyle = '#248';
    ctx.lineWidth = 5;
    const legAnim = pickaxeSwinging ? Math.sin(animTime * 15) * 1 : 0;
    ctx.beginPath();
    ctx.moveTo(-6, 28);
    ctx.lineTo(-8 + legAnim * 2, 40);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, 28);
    ctx.lineTo(8 - legAnim * 2, 40);
    ctx.stroke();

    // Boots
    ctx.fillStyle = '#543';
    ctx.fillRect(-12 + legAnim * 2, 36, 10, 6);
    ctx.fillRect(4 - legAnim * 2, 36, 10, 6);

    ctx.restore();
  }

  // Resource HUD display configuration
  const RESOURCE_HUD_ENTRIES = [
    { key: 'iron', label: 'Fe', color: '#bbb', icon: '\u2699' },
    { key: 'water', label: 'H2O', color: '#6af', icon: '\u{1F4A7}' },
    { key: 'cobalt', label: 'Co', color: '#88c', icon: '\u{1F48E}' },
    { key: 'copper', label: 'Cu', color: '#d4944d', icon: '\u{1FA99}' },
    { key: 'tin', label: 'Sn', color: '#d4d4d4', icon: '\u{1F52A}' },
    { key: 'coal', label: 'C', color: '#888', icon: '\u{1F525}' },
    { key: 'lead', label: 'Pb', color: '#999', icon: '\u26D3' },
    { key: 'silver', label: 'Ag', color: '#e0e0e0', icon: '\u2B50' },
    { key: 'gold', label: 'Au', color: '#ffd700', icon: '\u{1F451}' },
    { key: 'quartz', label: 'Qz', color: '#f0e6d3', icon: '\u{1F52E}' },
    { key: 'redstone', label: 'Rs', color: '#ff3333', icon: '\u2764' },
    { key: 'emerald', label: 'Em', color: '#50c878', icon: '\u{1F49A}' },
    { key: 'diamond', label: 'Di', color: '#b9f2ff', icon: '\u{1F4A0}' },
    { key: 'ruby', label: 'Rb', color: '#ff4488', icon: '\u2763' }
  ];

  function drawResourceHUD() {
    // Only show resources the player has collected (non-zero) plus the base 3
    const visibleEntries = RESOURCE_HUD_ENTRIES.filter(
      (e, i) => i < 3 || resources[e.key] > 0
    );
    const lineH = 26;
    const panelH = 6 + visibleEntries.length * lineH;
    const panelX = 10;
    const panelY = 10;

    // Two-column layout if many resources
    const useColumns = visibleEntries.length > 7;
    const colEntries = useColumns ? Math.ceil(visibleEntries.length / 2) : visibleEntries.length;
    const colPanelH = 6 + colEntries * lineH;
    const colPanelW = useColumns ? 440 : 260;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(panelX, panelY, colPanelW, colPanelH);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, colPanelW, colPanelH);

    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < visibleEntries.length; ++i) {
      const e = visibleEntries[i];
      const col = useColumns ? Math.floor(i / colEntries) : 0;
      const row = useColumns ? i % colEntries : i;
      const x = panelX + 12 + col * 220;
      const y = panelY + 3 + row * lineH;
      ctx.fillStyle = e.color;
      ctx.fillText(`${e.icon} ${e.label}: ${resources[e.key]}`, x, y);
    }

    // Carried indicator (right side)
    const carryX = CANVAS_W - 290;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(carryX, panelY, 280, 60);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(carryX, panelY, 280, 60);

    ctx.fillStyle = '#cc8';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`\u{1F392} Carried: ${carried}/${carryCapacity}`, carryX + 12, panelY + 10);

    // Carry capacity bar
    const carryRatio = Math.min(carried / carryCapacity, 1);
    ctx.fillStyle = '#333';
    ctx.fillRect(carryX + 12, panelY + 40, 256, 10);
    ctx.fillStyle = carryRatio >= 1 ? '#f44' : '#da2';
    ctx.fillRect(carryX + 12, panelY + 40, 256 * carryRatio, 10);
  }

  function drawToolHUDUnderground() {
    // Show active/unlocked tools in the underground view
    const anyUnlocked = GADGET_DEFS.some(d => unlockedTools[d.key]);
    if (!anyUnlocked) return;

    const hudX = CANVAS_W - 290;
    let hudY = 84;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const toolCount = GADGET_DEFS.filter(d => unlockedTools[d.key]).length;
    ctx.fillRect(hudX, hudY, 280, 12 + toolCount * 28);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(hudX, hudY, 280, 12 + toolCount * 28);

    hudY += 2;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (const def of GADGET_DEFS) {
      if (!unlockedTools[def.key]) continue;
      const isActive = activeToolKey === def.key;
      const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';

      if (def.key === 'blastTool') {
        ctx.fillStyle = toolState.blastToolCooldown > 0 ? '#555' : (isActive ? '#ffd700' : '#f80');
        const cd = toolState.blastToolCooldown > 0 ? ` ${Math.ceil(toolState.blastToolCooldown)}s` : ' RDY';
        ctx.fillText(`[2] ${def.icon} Blast${cd}`, hudX + 8, hudY);
      } else if (def.key === 'teleporter') {
        ctx.fillStyle = toolState.teleporterCooldown > 0 ? '#555' : '#a0f';
        const cd = toolState.teleporterCooldown > 0 ? ` ${Math.ceil(toolState.teleporterCooldown)}s` : ' RDY';
        ctx.fillText(`[5] ${def.icon} Teleport${cd}`, hudX + 8, hudY);
      } else if (def.key === 'drill') {
        ctx.fillStyle = isActive ? '#ffd700' : '#aaa';
        ctx.fillText(`[1] ${def.icon} Drill${isActive ? ' SEL' : ''}`, hudX + 8, hudY);
      } else if (isPassive) {
        ctx.fillStyle = '#0f0';
        ctx.fillText(`[${def.shortcut}] ${def.icon} ${def.name}`, hudX + 8, hudY);
      }
      hudY += 28;
    }
  }

  function parseHex(hex) {
    if (hex.length === 4)
      return [parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16), parseInt(hex[3] + hex[3], 16)];
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  const _lightenCache = {};
  function lightenColor(hex, amount) {
    const key = hex + '|' + amount;
    if (_lightenCache[key]) return _lightenCache[key];
    const [r, g, b] = parseHex(hex);
    const result = `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
    _lightenCache[key] = result;
    return result;
  }

  function hexToRgba(hex, alpha) {
    const [r, g, b] = parseHex(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ======================================================================
     DRAWING -- GADGETS
     ====================================================================== */

  function drawSurfaceGadgets() {
    // Shield Generator: blue arc around dome when active
    if (primaryGadget === 'shield' && primaryGadgetState.active) {
      ctx.save();
      const shieldPulse = Math.sin(animTime * 4) * 0.15 + 0.85;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 12, Math.PI, 0);
      ctx.strokeStyle = `rgba(80,180,255,${0.5 * shieldPulse})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 16, Math.PI + 0.2, -0.2);
      ctx.strokeStyle = `rgba(120,200,255,${0.3 * shieldPulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Repellent Field: expanding purple ring
    if (primaryGadget === 'repellent' && primaryGadgetState.active) {
      ctx.save();
      const ringPulse = Math.sin(animTime * 6) * 0.2 + 0.8;
      const ringRadius = DOME_RADIUS + 40 + Math.sin(animTime * 3) * 10;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, ringRadius, 0, TWO_PI);
      ctx.strokeStyle = `rgba(160,80,220,${0.6 * ringPulse})`;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#a0f';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, ringRadius + 10, 0, TWO_PI);
      ctx.strokeStyle = `rgba(180,100,240,${0.25 * ringPulse})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Orchard: small tree inside dome
    if (primaryGadget === 'orchard') {
      const treeX = DOME_X - 60;
      const treeY = DOME_Y - 16;
      // Trunk
      ctx.fillStyle = '#654';
      ctx.fillRect(treeX - 4, treeY - 30, 8, 30);
      // Canopy
      ctx.fillStyle = '#2a6';
      ctx.beginPath();
      ctx.arc(treeX, treeY - 36, 16, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#3a8';
      ctx.beginPath();
      ctx.arc(treeX - 6, treeY - 32, 10, 0, TWO_PI);
      ctx.fill();
      // Fruit (glowing when ready)
      if (primaryGadgetState.fruitReady) {
        ctx.save();
        const fruitGlow = Math.sin(animTime * 5) * 0.3 + 0.7;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff0';
        ctx.fillStyle = `rgba(255,200,50,${fruitGlow})`;
        ctx.beginPath();
        ctx.arc(treeX + 10, treeY - 30, 6, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // Droneyard: small diamond drone flying
    if (primaryGadget === 'droneyard') {
      const dronePhase = primaryGadgetState.dronePhase || 0;
      const droneY = DOME_Y - 100 + Math.sin(dronePhase) * 40;
      const droneX = DOME_X + 70;
      ctx.save();
      ctx.translate(droneX, droneY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#8ac';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#adf';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      // Propeller lines
      ctx.strokeStyle = 'rgba(150,200,255,0.4)';
      ctx.lineWidth = 2;
      const propLen = 10 + Math.sin(animTime * 20) * 4;
      ctx.beginPath();
      ctx.moveTo(droneX - propLen, droneY - 4);
      ctx.lineTo(droneX + propLen, droneY - 4);
      ctx.stroke();
    }

    // Auto Cannon: turret on top of dome (apex) so it can reach both sides
    if (foundGadgets.includes('autoCannon')) {
      const acX = DOME_X;
      const acY = DOME_Y - DOME_RADIUS;
      // Base
      ctx.fillStyle = '#667';
      ctx.fillRect(acX - 10, acY - 4, 20, 16);
      // Barrel (points upward)
      ctx.fillStyle = '#556';
      ctx.fillRect(acX - 3, acY - 20, 6, 20);
      // Muzzle flash
      if (primaryGadgetState.autoCannonFlash > 0 && primaryGadgetState.autoCannonTarget) {
        const t = primaryGadgetState.autoCannonTarget;
        const alpha = primaryGadgetState.autoCannonFlash / 0.3;
        ctx.strokeStyle = `rgba(255,255,0,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(acX, acY - 20);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,200,0,${alpha * 0.4})`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(acX, acY - 20);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }
    }

    // Stun Laser: blue beam from dome to target
    if (foundGadgets.includes('stunLaser') && primaryGadgetState.stunLaserFlash > 0 && primaryGadgetState.stunLaserTarget) {
      const t = primaryGadgetState.stunLaserTarget;
      const alpha = primaryGadgetState.stunLaserFlash / 0.4;
      ctx.save();
      ctx.strokeStyle = `rgba(80,160,255,${alpha})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#4af';
      ctx.beginPath();
      ctx.moveTo(DOME_X, DOME_Y - DOME_RADIUS);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.strokeStyle = `rgba(150,210,255,${alpha * 0.6})`;
      ctx.lineWidth = 10;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(DOME_X, DOME_Y - DOME_RADIUS);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Reinforced Dome: extra thick dome arc
    if (unlockedTools.reinforcedDome) {
      ctx.save();
      const armorPulse = Math.sin(animTime * 2) * 0.1 + 0.9;
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 8, Math.PI, 0);
      ctx.strokeStyle = `rgba(180,160,100,${0.35 * armorPulse})`;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 6, Math.PI + 0.1, -0.1);
      ctx.strokeStyle = `rgba(220,200,140,${0.2 * armorPulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // Gadget HUD info (bottom-left, above hint text)
    drawGadgetHUD();
  }

  function drawGadgetHUD() {
    const hudX = 20;
    let hudY = CANVAS_H - 110;

    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Primary gadget status
    if (primaryGadget === 'shield') {
      ctx.fillStyle = primaryGadgetState.active ? '#4af' : '#555';
      ctx.fillText('Shield: ' + (primaryGadgetState.active ? 'ACTIVE' : 'depleted'), hudX, hudY);
      hudY -= 28;
    } else if (primaryGadget === 'repellent') {
      if (primaryGadgetState.active) {
        ctx.fillStyle = '#a0f';
        ctx.fillText(`Repellent: ${Math.ceil(primaryGadgetState.duration)}s`, hudX, hudY);
      } else if (primaryGadgetState.cooldown > 0) {
        ctx.fillStyle = '#555';
        ctx.fillText(`Repellent [R]: ${Math.ceil(primaryGadgetState.cooldown)}s CD`, hudX, hudY);
      } else {
        ctx.fillStyle = '#a0f';
        ctx.fillText('Repellent [R]: READY', hudX, hudY);
      }
      hudY -= 28;
    } else if (primaryGadget === 'orchard') {
      if (primaryGadgetState.speedBoostTimer > 0) {
        ctx.fillStyle = '#0f0';
        ctx.fillText(`Mining Boost: ${Math.ceil(primaryGadgetState.speedBoostTimer)}s`, hudX, hudY);
      } else if (primaryGadgetState.fruitReady) {
        ctx.fillStyle = '#ff0';
        ctx.fillText('Orchard: Fruit ready! (click dome)', hudX, hudY);
      } else {
        ctx.fillStyle = '#2a6';
        ctx.fillText(`Orchard: ${Math.ceil(primaryGadgetState.fruitTimer)}s`, hudX, hudY);
      }
      hudY -= 28;
    } else if (primaryGadget === 'droneyard') {
      ctx.fillStyle = '#8ac';
      ctx.fillText(`Drone: ${Math.ceil(primaryGadgetState.droneTimer)}s`, hudX, hudY);
      hudY -= 28;
    }

    // Blast charges
    if (foundGadgets.includes('blastMining') && (primaryGadgetState.blastCharges || 0) > 0) {
      ctx.fillStyle = '#f80';
      ctx.fillText(`Blast [B]: ${primaryGadgetState.blastCharges} charges`, hudX, hudY);
      hudY -= 28;
    }

    // Found gadget names
    for (const g of foundGadgets) {
      if (g === 'blastMining') continue; // shown above
      ctx.fillStyle = '#aa8';
      ctx.fillText(MINE_GADGET_NAMES[g] || g, hudX, hudY);
      hudY -= 28;
    }

    // Unlockable tool indicators
    for (const def of GADGET_DEFS) {
      if (!unlockedTools[def.key]) continue;
      const isActive = activeToolKey === def.key;
      const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';

      if (def.key === 'blastTool') {
        if (toolState.blastToolCooldown > 0) {
          ctx.fillStyle = '#555';
          ctx.fillText(`${def.icon} Blast [2]: ${Math.ceil(toolState.blastToolCooldown)}s CD`, hudX, hudY);
        } else {
          ctx.fillStyle = isActive ? '#ffd700' : '#f80';
          ctx.fillText(`${def.icon} Blast [2]: READY`, hudX, hudY);
        }
        hudY -= 28;
      } else if (def.key === 'teleporter') {
        if (toolState.teleporterCooldown > 0) {
          ctx.fillStyle = '#555';
          ctx.fillText(`${def.icon} Teleport [5]: ${Math.ceil(toolState.teleporterCooldown)}s CD`, hudX, hudY);
        } else {
          ctx.fillStyle = isActive ? '#ffd700' : '#a0f';
          ctx.fillText(`${def.icon} Teleport [5]: READY`, hudX, hudY);
        }
        hudY -= 28;
      } else if (def.key === 'drill') {
        ctx.fillStyle = isActive ? '#ffd700' : '#aaa';
        const combo = isActive && toolState.drillConsecutive > 0 ? ` (x${toolState.drillConsecutive} combo)` : '';
        ctx.fillText(`${def.icon} Drill [1]${combo}`, hudX, hudY);
        hudY -= 28;
      } else if (isPassive) {
        ctx.fillStyle = '#0f0';
        ctx.fillText(`${def.icon} ${def.name} [${def.shortcut}]: ON`, hudX, hudY);
        hudY -= 28;
      }
    }
  }

  function drawUndergroundGadgets() {
    // Draw gadget chamber tiles
    for (const ch of gadgetChambers) {
      // Check if any tile of this chamber still exists
      let anyLeft = false;
      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc)
          if (undergroundGrid[ch.r + dr] && undergroundGrid[ch.r + dr][ch.c + dc] === TILE_GADGET)
            anyLeft = true;
      if (!anyLeft) continue;

      for (let dr = 0; dr < 2; ++dr)
        for (let dc = 0; dc < 2; ++dc) {
          if (undergroundGrid[ch.r + dr][ch.c + dc] !== TILE_GADGET) continue;
          const x = (ch.c + dc) * TILE_SIZE - cameraX;
          const y = (ch.r + dr) * TILE_SIZE - cameraY;

          if (!ch.revealed) {
            // Hidden: looks like dirt but with faint shimmer
            drawTile(x, y, TILE_DIRT, ch.r + dr, ch.c + dc);
            const shimmer = Math.sin(animTime * 3 + dr + dc) * 0.1 + 0.1;
            ctx.fillStyle = `rgba(255,215,0,${shimmer})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else {
            // Revealed: golden glowing tile with "?" symbol
            const pulse = Math.sin(animTime * 4) * 0.15 + 0.85;
            ctx.fillStyle = `rgba(200,160,0,${0.7 * pulse})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

            // Bevel
            ctx.fillStyle = `rgba(255,240,150,${0.4 * pulse})`;
            ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 3);
            ctx.fillStyle = `rgba(100,80,0,${0.5 * pulse})`;
            ctx.fillRect(x + 1, y + TILE_SIZE - 4, TILE_SIZE - 2, 3);

            // "?" symbol
            ctx.fillStyle = `rgba(255,255,200,${pulse})`;
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', x + TILE_SIZE / 2, y + TILE_SIZE / 2);

            // Sparkle particles on border
            if (Math.random() < 0.03)
              particles.sparkle(
                x + Math.random() * TILE_SIZE,
                y + Math.random() * TILE_SIZE,
                1,
                { color: '#ffd700', speed: 0.5 }
              );
          }
        }
    }

    // Probe Scanner: highlight resource tiles within 4 tiles of pickup location
    if (foundGadgets.includes('probeScanner') && primaryGadgetState.probeTimer > 0) {
      const fadeAlpha = Math.min(1, primaryGadgetState.probeTimer / 3); // fade out in last 3s
      const probePulse = Math.sin(animTime * 5) * 0.3 + 0.7;
      const pr = primaryGadgetState.probePlayerR || drillY;
      const pc = primaryGadgetState.probePlayerC || drillX;
      const probeR0 = Math.max(0, pr - 4), probeR1 = Math.min(GRID_ROWS, pr + 5);
      const probeC0 = Math.max(0, pc - 4), probeC1 = Math.min(GRID_COLS, pc + 5);
      for (let r = probeR0; r < probeR1; ++r)
        for (let c = probeC0; c < probeC1; ++c) {
          const tile = undergroundGrid[r][c];
          if (!RESOURCE_TILES.includes(tile)) continue;
          if (Math.abs(r - pr) + Math.abs(c - pc) > 4) continue;
          const x = c * TILE_SIZE - cameraX;
          const y = r * TILE_SIZE - cameraY;
          ctx.strokeStyle = `rgba(255,215,0,${0.6 * probePulse * fadeAlpha})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        }
    }

    // Scanner gadget (unlockable tool): continuous passive reveal in 3-tile Manhattan radius
    if (toolState.scannerActive) {
      const scanPulse = Math.sin(animTime * 3) * 0.2 + 0.8;
      const scanRange = 3 + (toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
      const scanR0 = Math.max(0, drillY - scanRange), scanR1 = Math.min(GRID_ROWS, drillY + scanRange + 1);
      const scanC0 = Math.max(0, drillX - scanRange), scanC1 = Math.min(GRID_COLS, drillX + scanRange + 1);
      for (let r = scanR0; r < scanR1; ++r)
        for (let c = scanC0; c < scanC1; ++c) {
          const tile = undergroundGrid[r][c];
          if (!RESOURCE_TILES.includes(tile)) continue;
          if (Math.abs(r - drillY) + Math.abs(c - drillX) > scanRange) continue;
          const x = c * TILE_SIZE - cameraX;
          const y = r * TILE_SIZE - cameraY;

          // Semi-transparent resource type indicator
          const tileColor = TILE_HIGHLIGHT_COLORS[tile] || '#fff';
          ctx.strokeStyle = hexToRgba(tileColor, 0.5 * scanPulse);
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);

          // Small resource type icon
          ctx.fillStyle = hexToRgba(tileColor, 0.7 * scanPulse);
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(TILE_ICONS[tile] || '', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        }

      // Scanner radius ring around player
      const playerScreenX = drillX * TILE_SIZE + TILE_SIZE / 2 - cameraX;
      const playerScreenY = drillY * TILE_SIZE + TILE_SIZE / 2 - cameraY;
      ctx.save();
      ctx.strokeStyle = `rgba(0,255,200,${0.15 * scanPulse})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      const scanRingRange = 3 + (toolState.echoLocationActive ? 2 + getEffectiveLevel('echoLocation') : 0);
      ctx.arc(playerScreenX, playerScreenY, (scanRingRange + 0.5) * TILE_SIZE, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /* ======================================================================
     DRAWING -- UPGRADE PANEL
     ====================================================================== */

  function drawUpgradePanel() {
    const px = CANVAS_W - 340;
    const py = 100;
    const toolSectionH = showToolPanel ? 44 + GADGET_DEFS.length * 44 : 36;
    const panelH = 60 + UPGRADE_DEFS.length * 48 + toolSectionH;

    // Panel background with gradient
    const panelGrad = ctx.createLinearGradient(px, py, px, py + panelH);
    panelGrad.addColorStop(0, 'rgba(10,15,30,0.7)');
    panelGrad.addColorStop(1, 'rgba(5,8,20,0.8)');
    ctx.fillStyle = panelGrad;
    ctx.fillRect(px, py, 320, panelH);

    // Border
    ctx.strokeStyle = '#3a4a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, 320, panelH);

    // Header
    ctx.fillStyle = '#4af';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Upgrades', px + 16, py + 32);
    ctx.fillStyle = '#ffd700';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[U] Full Tree', px + 310, py + 32);
    ctx.textAlign = 'left';

    // Separator line
    ctx.strokeStyle = '#334';
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 44);
    ctx.lineTo(px + 310, py + 44);
    ctx.stroke();

    const total = totalResources();
    for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
      const def = UPGRADE_DEFS[i];
      const cost = getUpgradeCost(i);
      const ly = py + 56 + i * 48;
      const canAfford = total >= cost;

      // Hover-like highlight for affordable upgrades
      if (canAfford) {
        ctx.fillStyle = 'rgba(60,120,200,0.08)';
        ctx.fillRect(px + 4, ly - 4, 312, 44);
      }

      ctx.fillStyle = canAfford ? '#ccc' : '#555';
      ctx.font = '20px sans-serif';
      ctx.fillText(`${def.name} Lv${getEffectiveLevel(def.key)}`, px + 16, ly + 20);
      ctx.fillStyle = canAfford ? '#0f0' : '#633';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`[${cost}]`, px + 236, ly + 20);
    }

    // -- Tool/Gadget section --
    const toolY = py + 56 + UPGRADE_DEFS.length * 48 + 8;

    // Separator
    ctx.strokeStyle = '#334';
    ctx.beginPath();
    ctx.moveTo(px + 10, toolY - 4);
    ctx.lineTo(px + 310, toolY - 4);
    ctx.stroke();

    // Section header (toggleable)
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(showToolPanel ? 'Tools (click to collapse)' : 'Tools (click to expand)', px + 16, toolY + 20);

    if (showToolPanel) {
      for (let i = 0; i < GADGET_DEFS.length; ++i) {
        const def = GADGET_DEFS[i];
        const ly = toolY + 32 + i * 44;
        const isUnlocked = !!unlockedTools[def.key];
        const canAfford = !isUnlocked && resources.iron >= def.costIron && resources.cobalt >= def.costCobalt;
        const isActive = activeToolKey === def.key;
        const isPassive = def.key === 'scanner' || def.key === 'reinforcedDome';

        // Background highlight
        if (isUnlocked) {
          ctx.fillStyle = isActive ? 'rgba(255,215,0,0.12)' : 'rgba(40,100,40,0.1)';
          ctx.fillRect(px + 4, ly - 4, 312, 40);
        } else if (canAfford) {
          ctx.fillStyle = 'rgba(60,120,200,0.08)';
          ctx.fillRect(px + 4, ly - 4, 312, 40);
        }

        // Active border indicator
        if (isActive) {
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 4, ly - 4, 312, 40);
        }

        // Icon + Name
        ctx.font = '20px sans-serif';
        if (isUnlocked) {
          ctx.fillStyle = isActive ? '#ffd700' : (isPassive ? '#0f0' : '#aaa');
          const status = isPassive ? ' [ON]' : (isActive ? ' [SEL]' : '');
          ctx.fillText(`[${def.shortcut}] ${def.icon} ${def.name}${status}`, px + 12, ly + 20);
        } else {
          ctx.fillStyle = canAfford ? '#ccc' : '#555';
          ctx.fillText(`[${def.shortcut}] ${def.icon} ${def.name}`, px + 12, ly + 20);
          // Cost display
          let costText = `${def.costIron}Fe`;
          if (def.costCobalt > 0)
            costText += `+${def.costCobalt}Co`;
          ctx.fillStyle = canAfford ? '#0f0' : '#633';
          ctx.font = 'bold 18px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(costText, px + 310, ly + 20);
          ctx.textAlign = 'left';
        }
      }
    }
  }

  /* ======================================================================
     DRAWING -- HUD
     ====================================================================== */

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Title with glow
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#4af';
      ctx.fillStyle = '#4af';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOME KEEPER', CANVAS_W / 2, CANVAS_H / 2 - 120);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Subtitle
      ctx.fillStyle = '#aaa';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Defend your dome. Mine resources. Upgrade.', CANVAS_W / 2, CANVAS_H / 2 - 30);

      // Pulsing start prompt
      const startPulse = Math.sin(animTime * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(170,170,170,${startPulse})`;
      ctx.font = '28px sans-serif';
      ctx.fillText('Tap or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 40);

      // Decorative dome outline
      ctx.beginPath();
      ctx.arc(CANVAS_W / 2, CANVAS_H / 2 + 200, 100, Math.PI, 0);
      ctx.closePath();
      ctx.strokeStyle = `rgba(80,160,255,${0.2 + Math.sin(animTime * 2) * 0.1})`;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#4af';
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'start';
    }

    if (state === STATE_GADGET_SELECT) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Title
      ctx.save();
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffd700';
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Choose Your Gadget', CANVAS_W / 2, 100);
      ctx.shadowBlur = 0;
      ctx.restore();

      // 4 cards
      const cardW = 280;
      const cardH = 320;
      const gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;

      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const g = PRIMARY_GADGETS[i];
        const cx = startX + i * (cardW + gap);
        const isHover = gadgetSelectHover === i;

        // Card background
        const cardGrad = ctx.createLinearGradient(cx, cardY, cx, cardY + cardH);
        if (isHover) {
          cardGrad.addColorStop(0, 'rgba(60,80,120,0.9)');
          cardGrad.addColorStop(1, 'rgba(30,50,80,0.9)');
        } else {
          cardGrad.addColorStop(0, 'rgba(25,30,45,0.85)');
          cardGrad.addColorStop(1, 'rgba(15,18,30,0.85)');
        }
        ctx.fillStyle = cardGrad;
        ctx.fillRect(cx, cardY, cardW, cardH);

        // Card border
        ctx.strokeStyle = isHover ? '#ffd700' : '#3a4a6a';
        ctx.lineWidth = isHover ? 2 : 1;
        ctx.strokeRect(cx, cardY, cardW, cardH);

        // Hover glow
        if (isHover) {
          ctx.save();
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#ffd700';
          ctx.strokeStyle = 'rgba(255,215,0,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - 1, cardY - 1, cardW + 2, cardH + 2);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // Icon
        ctx.font = '64px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(g.icon, cx + cardW / 2, cardY + 70);

        // Name
        ctx.fillStyle = isHover ? '#ffd700' : '#ccc';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(g.name, cx + cardW / 2, cardY + 140);

        // Description lines
        ctx.fillStyle = '#999';
        ctx.font = '20px sans-serif';
        for (let l = 0; l < g.desc.length; ++l)
          ctx.fillText(g.desc[l], cx + cardW / 2, cardY + 184 + l * 28);

        // Click hint
        if (isHover) {
          ctx.fillStyle = '#ffd700';
          ctx.font = 'bold 20px sans-serif';
          ctx.fillText('Click to select', cx + cardW / 2, cardY + cardH - 24);
        }
      }

      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff0';
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.fillStyle = '#aaa';
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Escape to resume', CANVAS_W / 2, CANVAS_H / 2 + 60);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Red glow title
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f44';
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DOME DESTROYED', CANVAS_W / 2, CANVAS_H / 2 - 60);
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = '#ccc';
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Wave: ${waveNumber} -- Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 + 20);

      const restartPulse = Math.sin(animTime * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(204,204,204,${restartPulse})`;
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 80);
      ctx.textAlign = 'start';
    }
  }

  /* ======================================================================
     DRAWING -- MAIN
     ====================================================================== */

  function drawGame() {
    const alpha = getTransitionAlpha();
    ctx.globalAlpha = alpha;

    if (currentView === VIEW_SURFACE)
      drawSurface();
    else
      drawUnderground();

    ctx.globalAlpha = 1;

    // Transition overlay (black fade)
    if (alpha < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - alpha})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    drawHUD();

    if (state === STATE_UPGRADE_DIALOG)
      drawUpgradeDialog();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 800, ph = 440, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(15,10,5,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#c80';
    ctx.lineWidth = 4;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 24);
    ctx.fillStyle = '#c80';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(page.title, cx, py + 60);
    ctx.fillStyle = '#ccc';
    ctx.font = '26px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      ctx.fillText(page.lines[i], cx, py + 116 + i * 44);
    ctx.fillStyle = '#888';
    ctx.font = '22px sans-serif';
    if (tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 56);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 56);
  }

  /* ======================================================================
     TOOLTIP SYSTEM
     ====================================================================== */

  function updateTooltipHover(dt) {
    if (!tooltip.visible && tooltip.lines.length > 0) {
      tooltip.delayTimer += dt;
      if (tooltip.delayTimer >= TOOLTIP_DELAY)
        tooltip.visible = true;
    }
  }

  function clearTooltip() {
    tooltip.lines = [];
    tooltip.visible = false;
    tooltip.delayTimer = 0;
    tooltip.lastHoverKey = '';
  }

  function setTooltip(x, y, lines, hoverKey) {
    if (hoverKey !== tooltip.lastHoverKey) {
      tooltip.delayTimer = 0;
      tooltip.visible = false;
      tooltip.lastHoverKey = hoverKey;
    }
    tooltip.lines = lines;
    tooltip.x = x;
    tooltip.y = y;
  }

  function drawTooltip() {
    if (!tooltip.visible || tooltip.lines.length === 0) return;

    const padding = 16;
    const lineH = 32;
    const fontSize = 22;
    ctx.font = `${fontSize}px sans-serif`;

    // Measure max line width
    let maxW = 0;
    for (const line of tooltip.lines) {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    }

    const boxW = maxW + padding * 2;
    const boxH = tooltip.lines.length * lineH + padding * 2 - 4;

    // Position near cursor, clamped to canvas
    let bx = tooltip.x + 28;
    let by = tooltip.y + 28;
    if (bx + boxW > CANVAS_W - 8) bx = tooltip.x - boxW - 12;
    if (by + boxH > CANVAS_H - 8) by = tooltip.y - boxH - 12;
    if (bx < 8) bx = 8;
    if (by < 8) by = 8;

    // Background: semi-transparent dark rounded rectangle
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 20, 0.92)';
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.5)';
    ctx.lineWidth = 1;
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + boxW - r, by);
    ctx.arcTo(bx + boxW, by, bx + boxW, by + r, r);
    ctx.lineTo(bx + boxW, by + boxH - r);
    ctx.arcTo(bx + boxW, by + boxH, bx + boxW - r, by + boxH, r);
    ctx.lineTo(bx + r, by + boxH);
    ctx.arcTo(bx, by + boxH, bx, by + boxH - r, r);
    ctx.lineTo(bx, by + r);
    ctx.arcTo(bx, by, bx + r, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (let i = 0; i < tooltip.lines.length; ++i) {
      const line = tooltip.lines[i];
      // First line is bold (title)
      if (i === 0) {
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#fff';
      } else {
        ctx.font = `${fontSize}px sans-serif`;
        // Color-code lines starting with special markers
        if (line.startsWith('\u2714'))       // checkmark
          ctx.fillStyle = '#8f8';
        else if (line.startsWith('\u2718'))   // X mark
          ctx.fillStyle = '#f88';
        else if (line.startsWith('\u26A0'))   // warning
          ctx.fillStyle = '#fa0';
        else
          ctx.fillStyle = '#ccc';
      }
      ctx.fillText(line, bx + padding, by + padding + i * lineH);
    }
    ctx.restore();
  }

  // Build tooltip content for an underground tile
  function buildTileTooltip(col, row) {
    const tile = undergroundGrid[row][col];
    if (tile === TILE_EMPTY) return null;

    const lines = [];
    const displayName = TILE_DISPLAY_NAMES[tile] || 'Unknown';
    const depthTier = DEPTH_TIERS[getDepthTier(row)];
    const depthMult = getDepthMineMultiplier(row);

    if (tile === TILE_DIRT) {
      lines.push(depthTier.name);
      lines.push('Depth tier: ' + depthTier.name);
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else if (tile === TILE_GADGET) {
      lines.push('Gadget Chamber');
      const chamber = gadgetChambers.find(ch => {
        for (let dr = 0; dr < 2; ++dr)
          for (let dc = 0; dc < 2; ++dc)
            if (ch.r + dr === row && ch.c + dc === col) return true;
        return false;
      });
      if (chamber && chamber.revealed)
        lines.push('Mine to discover a gadget');
      else
        lines.push('Hidden - mine nearby to reveal');
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    } else {
      const icon = TILE_ICONS[tile] || '';
      lines.push((icon ? icon + ' ' : '') + displayName);
      if (TILE_VALUES[tile])
        lines.push('Value: ' + TILE_VALUES[tile] + ' resources');
      lines.push('Depth: ' + depthTier.name);
      lines.push('Mining: ' + getMiningDifficultyLabel(depthMult));
    }

    // Partial mining status
    if (tileHP[row] && tileMaxHP[row] && tileMaxHP[row][col] > 0) {
      const hpRatio = tileHP[row][col] / tileMaxHP[row][col];
      if (hpRatio < 0.99) {
        const pct = Math.round(hpRatio * 100);
        lines.push('Remaining: ' + pct + '%');
      }
    }

    return lines;
  }

  // Build tooltip content for an enemy
  function buildEnemyTooltip(e) {
    const lines = [];
    let typeName;
    if (e.boss)
      typeName = 'Boss';
    else if (e.type === 'flyer')
      typeName = 'Flyer';
    else
      typeName = 'Walker';

    lines.push(typeName + (e.armored ? ' (Armored)' : ''));
    lines.push('HP: ' + Math.ceil(e.hp) + ' / ' + Math.ceil(e.maxHP));
    if (e.shield > 0)
      lines.push('Shield: ' + Math.ceil(e.shield) + ' / ' + Math.ceil(e.maxShield));
    else if (e.maxShield > 0)
      lines.push('\u2718 Shield broken');
    if (e.armored)
      lines.push('\u26A0 Armored: 2x HP, 0.75x speed');
    lines.push('Damage: ' + e.damage + ' per hit');
    if (e.stunTimer > 0)
      lines.push('\u26A0 Stunned: ' + e.stunTimer.toFixed(1) + 's');

    return lines;
  }

  // Build tooltip content for an upgrade tree node
  function buildUpgradeNodeTooltip(node) {
    const lines = [];
    const lvl = getTreeNodeLevel(node.id);
    const maxed = lvl >= node.maxLevel;

    lines.push(node.icon + ' ' + node.name);

    // Effect description
    const effectDesc = UPGRADE_EFFECT_DESC[node.upgradeKey];
    if (effectDesc)
      lines.push(effectDesc);

    // Type
    lines.push('Type: ' + (node.type === 'gadget' ? 'Gadget (unlock)' : 'Stat upgrade'));

    // Level
    if (maxed)
      lines.push('\u2714 Purchased');
    else
      lines.push('Level: ' + lvl + ' / ' + node.maxLevel);

    // Cost
    if (!maxed) {
      const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
      const COST_NAMES = {
        iron: 'Iron', water: 'Water', cobalt: 'Cobalt', copper: 'Copper',
        tin: 'Tin', coal: 'Coal', lead: 'Lead', silver: 'Silver',
        gold: 'Gold', quartz: 'Quartz', redstone: 'Redstone',
        emerald: 'Emerald', diamond: 'Diamond', ruby: 'Ruby'
      };
      let costParts = [];
      const TT_ICONS = { iron: '\u2699', water: '\u{1F4A7}', cobalt: '\u{1F48E}', copper: '\u{1FA99}', tin: '\u{1F52A}', coal: '\u{1F525}', lead: '\u26D3', silver: '\u2B50', gold: '\u{1F451}', quartz: '\u{1F52E}', redstone: '\u2764', emerald: '\u{1F49A}', diamond: '\u{1F4A0}', ruby: '\u2763' };
      for (const key in cost)
        if ((cost[key] || 0) > 0) {
          const have = resources[key] || 0;
          const need = cost[key];
          const mark = have >= need ? '\u2714' : '\u2718';
          const ico = TT_ICONS[key] || '';
          costParts.push(mark + ' ' + ico + (COST_NAMES[key] || key) + ': ' + have + '/' + need);
        }
      if (costParts.length > 0) {
        lines.push('--- Cost ---');
        for (const cp of costParts)
          lines.push(cp);
      }
    }

    // Prerequisites
    if (node.prereqs.length > 0) {
      const unmet = [];
      for (const pid of node.prereqs) {
        if (!isTreeNodeMaxed(pid)) {
          const prereqNode = UPGRADE_TREE.find(n => n.id === pid);
          if (prereqNode)
            unmet.push('\u2718 ' + prereqNode.name);
        }
      }
      if (unmet.length > 0) {
        lines.push('--- Prerequisites ---');
        for (const u of unmet)
          lines.push(u);
      }
    }

    return lines;
  }

  /* ======================================================================
     STATUS BAR
     ====================================================================== */

  function updateStatusBar() {
    if (statusView) statusView.textContent = `View: ${currentView}`;
    if (statusWave) statusWave.textContent = `Wave: ${waveNumber}`;
    if (statusDome) statusDome.textContent = `Dome: ${Math.ceil(domeHP)}/${maxDomeHP}`;
    if (statusResources) {
      let resParts = [];
      for (const entry of RESOURCE_HUD_ENTRIES)
        if (resources[entry.key] > 0)
          resParts.push(`${entry.icon}${entry.label}:${resources[entry.key]}`);
      statusResources.textContent = resParts.join(' ') || 'Fe:0 H2O:0 Co:0';
    }
  }

  /* ======================================================================
     GAME LOOP
     ====================================================================== */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    // Always update animations (even on title/pause/game-over for visual polish)
    animTime += state !== STATE_PLAYING ? dt : 0;
    updateGame(dt);
    updateTooltipHover(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    // Draw tooltip outside screen shake so it stays stable
    drawTooltip();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ======================================================================
     INPUT
     ====================================================================== */

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'F2') {
      e.preventDefault();
      resetGame();
      return;
    }

    /* Tutorial navigation */
    if (showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++tutorialPage;
        if (tutorialPage >= TUTORIAL_PAGES.length)
          showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && tutorialPage > 0) {
        e.preventDefault();
        --tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        showTutorial = false;
        return;
      }
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_READY || state === STATE_GADGET_SELECT) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_UPGRADE_DIALOG) {
        closeUpgradeDialog();
        return;
      }
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    // U key: open/close upgrade dialog
    if (e.code === 'KeyU') {
      if (state === STATE_UPGRADE_DIALOG) {
        closeUpgradeDialog();
        return;
      }
      if (state === STATE_PLAYING && currentView === VIEW_SURFACE) {
        openUpgradeDialog();
        return;
      }
    }

    if (state === STATE_UPGRADE_DIALOG) return; // block other keys while dialog is open
    if (state !== STATE_PLAYING) return;

    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
      toggleView();
    }

    if (currentView === VIEW_UNDERGROUND) {
      let newDx = 0, newDy = 0;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { newDx = 0; newDy = -1; }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { newDx = 0; newDy = 1; }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { newDx = -1; newDy = 0; }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { newDx = 1; newDy = 0; }

      if (newDx !== 0 || newDy !== 0) {
        // Cancel mining if direction changed
        if (miningTarget && miningDir && (miningDir.dx !== newDx || miningDir.dy !== newDy))
          cancelMining();
        clearMoveTarget();
        tryMine(newDx, newDy);
      }
    }

    // Repellent field activation
    if (e.code === 'KeyR' && primaryGadget === 'repellent') {
      if (!primaryGadgetState.active && primaryGadgetState.cooldown <= 0) {
        primaryGadgetState.active = true;
        primaryGadgetState.duration = 5;
        floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Repellent Field!', { color: '#a0f', font: 'bold 28px sans-serif' });
        particles.burst(DOME_X, DOME_Y, 20, { color: '#a0f', speed: 3, life: 0.5 });
      }
    }

    // Blast mining activation
    if (e.code === 'KeyB')
      useBlastMining();

    // Tool/Gadget shortcuts (1-5)
    if (e.code === 'Digit1' || e.key === '1') {
      if (unlockedTools.drill)
        selectTool('drill');
    }
    if (e.code === 'Digit2' || e.key === '2') {
      if (unlockedTools.blastTool)
        useBlastTool();
    }
    if (e.code === 'Digit3' || e.key === '3') {
      if (unlockedTools.scanner)
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Scanner active (passive)', { color: '#0f0', font: 'bold 22px sans-serif' });
    }
    if (e.code === 'Digit4' || e.key === '4') {
      if (unlockedTools.reinforcedDome)
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Reinforced Dome active (passive)', { color: '#0f0', font: 'bold 22px sans-serif' });
    }
    if (e.code === 'Digit5' || e.key === '5') {
      if (unlockedTools.teleporter)
        useTeleporter();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* -- Click/Tap handling -- */
  canvas.addEventListener('pointerdown', (e) => {
    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_READY || state === STATE_GAME_OVER) {
      resetGame();
      return;
    }

    // Upgrade dialog click (left-click only; right-click is pan)
    if (state === STATE_UPGRADE_DIALOG) {
      if (e.button === 2) return; // right-click handled by pan listener
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      handleUpgradeDialogClick(mx, my);
      return;
    }

    // Gadget selection screen click
    if (state === STATE_GADGET_SELECT) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const cardW = 280, cardH = 320, gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;

      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const cx = startX + i * (cardW + gap);
        if (mx >= cx && mx <= cx + cardW && my >= cardY && my <= cardY + cardH) {
          primaryGadget = PRIMARY_GADGETS[i].key;
          startGameAfterGadgetSelect();
          return;
        }
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    if (currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((mx + cameraX) / TILE_SIZE);
      const row = Math.floor((my + cameraY) / TILE_SIZE);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const ddx = col - drillX;
        const ddy = row - drillY;
        if (ddx === 0 && ddy === 0) {
          toggleView();
        } else if (undergroundGrid[row][col] === TILE_EMPTY) {
          // Click on empty tile: move there via pathfinding
          const path = findPath(drillX, drillY, col, row);
          if (path && path.length > 0) {
            clearMoveTarget();
            moveTarget = { col, row };
            movePath = path;
            movePathIndex = 0;
            moveStepTimer = 0;
            mineTarget = null;
          }
        } else if (Math.abs(ddx) + Math.abs(ddy) === 1) {
          // Adjacent non-empty tile: mine directly
          clearMoveTarget();
          tryMine(ddx, ddy);
        } else {
          // Non-adjacent non-empty tile: pathfind to adjacent empty, then queue mine
          const result = findAdjacentEmptyNear(col, row);
          if (result) {
            clearMoveTarget();
            moveTarget = { col: result.adj.col, row: result.adj.row };
            movePath = result.path;
            movePathIndex = 0;
            moveStepTimer = 0;
            mineTarget = { col: col, row: row, dx: result.adj.dx, dy: result.adj.dy };
          }
        }
      }
    } else {
      // Orchard: clicking near the dome tree when fruit is ready
      if (primaryGadget === 'orchard' && primaryGadgetState.fruitReady) {
        const treeX = DOME_X - 60, treeY = DOME_Y - 30;
        if (Math.abs(mx - treeX) < 40 && Math.abs(my - treeY) < 50) {
          primaryGadgetState.fruitReady = false;
          primaryGadgetState.fruitTimer = 20;
          primaryGadgetState.speedBoostTimer = 10;
          floatingText.add(treeX, treeY - 40, '+30% Mining Speed!', { color: '#0f0', font: 'bold 24px sans-serif' });
          particles.sparkle(treeX, treeY - 15, 8, { color: '#ff0', speed: 2 });
          return;
        }
      }

      // Surface view: check upgrade panel first, then fire weapon
      const px = CANVAS_W - 340;
      const py = 100;
      if (mx >= px && mx <= px + 320) {
        // Check upgrade rows
        for (let i = 0; i < UPGRADE_DEFS.length; ++i) {
          const ly = py + 56 + i * 48;
          if (my >= ly && my <= ly + 48) {
            applyUpgrade(i);
            return;
          }
        }

        // Check tool section header (toggle expand/collapse)
        const toolHeaderY = py + 56 + UPGRADE_DEFS.length * 48 + 8;
        if (my >= toolHeaderY - 8 && my <= toolHeaderY + 28) {
          showToolPanel = !showToolPanel;
          return;
        }

        // Check tool rows (when panel is expanded)
        if (showToolPanel) {
          for (let i = 0; i < GADGET_DEFS.length; ++i) {
            const ly = toolHeaderY + 32 + i * 44;
            if (my >= ly - 4 && my <= ly + 40) {
              const def = GADGET_DEFS[i];
              if (unlockedTools[def.key]) {
                // Already unlocked -- select/activate it
                if (def.key === 'blastTool')
                  useBlastTool();
                else if (def.key === 'teleporter')
                  useTeleporter();
                else
                  selectTool(def.key);
              } else
                unlockTool(i);
              return;
            }
          }
        }
      }
      // Fire weapon toward current turret aim direction
      fireRequested = true;
    }
  });

  /* -- Scroll/zoom for upgrade dialog -- */
  canvas.addEventListener('wheel', (e) => {
    if (state === STATE_UPGRADE_DIALOG) {
      e.preventDefault();
      // Zoom with mouse wheel
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      const oldZoom = upgradeZoom;
      upgradeZoom = Math.max(0.3, Math.min(2.0, upgradeZoom + zoomDelta));
      // Adjust pan to zoom toward mouse position
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const zoomRatio = upgradeZoom / oldZoom;
      upgradePanX = mx - (mx - upgradePanX) * zoomRatio;
      upgradePanY = my - (my - upgradePanY) * zoomRatio;
      upgradeViewCustomized = true;
    }
  }, { passive: false });

  /* -- Right-click pan for upgrade dialog -- */
  canvas.addEventListener('contextmenu', (e) => {
    if (state === STATE_UPGRADE_DIALOG)
      e.preventDefault();
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (state === STATE_UPGRADE_DIALOG && e.button === 2) {
      e.preventDefault();
      upgradePanning = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      upgradePanStartX = (e.clientX - rect.left) * scaleX;
      upgradePanStartY = (e.clientY - rect.top) * scaleY;
      upgradePanBaseX = upgradePanX;
      upgradePanBaseY = upgradePanY;
      upgradeViewCustomized = true;
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (upgradePanning && e.button === 2) {
      upgradePanning = false;
      canvas.releasePointerCapture(e.pointerId);
    }
  });

  /* -- Continuous mouse tracking for turret aim + gadget selection hover + tooltips -- */
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    mouseAimX = (e.clientX - rect.left) * scaleX;
    mouseAimY = (e.clientY - rect.top) * scaleY;

    // Right-click drag panning in upgrade dialog
    if (upgradePanning && state === STATE_UPGRADE_DIALOG) {
      upgradePanX = upgradePanBaseX + (mouseAimX - upgradePanStartX);
      upgradePanY = upgradePanBaseY + (mouseAimY - upgradePanStartY);
      clearTooltip();
      return;
    }

    // Track hover on upgrade dialog + tooltip
    if (state === STATE_UPGRADE_DIALOG) {
      handleUpgradeDialogHover(mouseAimX, mouseAimY);
      // Build tooltip for hovered upgrade node
      if (upgradeDialogHover) {
        const node = UPGRADE_TREE.find(n => n.id === upgradeDialogHover);
        if (node) {
          const ttLines = buildUpgradeNodeTooltip(node);
          setTooltip(mouseAimX, mouseAimY, ttLines, 'node:' + node.id);
        } else
          clearTooltip();
      } else
        clearTooltip();
      return;
    }

    // Track hover on gadget selection screen
    if (state === STATE_GADGET_SELECT) {
      const cardW = 280, cardH = 320, gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;
      gadgetSelectHover = -1;
      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const cx = startX + i * (cardW + gap);
        if (mouseAimX >= cx && mouseAimX <= cx + cardW && mouseAimY >= cardY && mouseAimY <= cardY + cardH) {
          gadgetSelectHover = i;
          break;
        }
      }
      clearTooltip();
      return;
    }

    // Tooltip detection for playing state
    if (state === STATE_PLAYING) {
      if (currentView === VIEW_UNDERGROUND) {
        // Underground: detect tile under mouse
        const col = Math.floor((mouseAimX + cameraX) / TILE_SIZE);
        const row = Math.floor((mouseAimY + cameraY) / TILE_SIZE);
        if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS && undergroundGrid[row][col] !== TILE_EMPTY) {
          const ttLines = buildTileTooltip(col, row);
          if (ttLines)
            setTooltip(mouseAimX, mouseAimY, ttLines, 'tile:' + col + ',' + row);
          else
            clearTooltip();
        } else
          clearTooltip();
      } else if (currentView === VIEW_SURFACE) {
        // Surface: detect enemy under mouse
        let foundEnemy = false;
        for (const e of enemies) {
          const sz = e.size || 10;
          const dx = mouseAimX - e.x;
          const dy = mouseAimY - e.y;
          if (dx * dx + dy * dy < (sz + 8) * (sz + 8)) {
            const ttLines = buildEnemyTooltip(e);
            // Use enemy position as identity since enemies don't have IDs
            setTooltip(mouseAimX, mouseAimY, ttLines, 'enemy:' + Math.round(e.x) + ',' + Math.round(e.y));
            foundEnemy = true;
            break;
          }
        }
        if (!foundEnemy)
          clearTooltip();
      } else
        clearTooltip();
    } else
      clearTooltip();
  });

  /* ======================================================================
     MENU ACTIONS
     ====================================================================== */

  function handleAction(action) {
    switch (action) {
      case 'new':
        resetGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'tutorial':
        showTutorial = true;
        tutorialPage = 0;
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ======================================================================
     OS INTEGRATION
     ====================================================================== */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = state === STATE_GAME_OVER
      ? `Dome Keeper -- Game Over -- Wave ${waveNumber}`
      : `Dome Keeper -- Wave ${waveNumber} -- Score ${score}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  /* ======================================================================
     INIT
     ====================================================================== */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadHighScores();
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }
  updateWindowTitle();

  if (!tutorialSeen) {
    showTutorial = true;
    tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
