;(function() {
  'use strict';

  // Tile names, depth tiers, base stats, mining times, tool definitions and level cost ladders.
  // Owns: NS.rules
  // Reads: constants

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const { CANVAS_W, CANVAS_H, STRATUM_ROWS, GRID_ROWS, TILE_EMPTY, TILE_DIRT, TILE_IRON, TILE_WATER,
    TILE_COBALT, TILE_GADGET, TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER, TILE_LEAD, TILE_COAL,
    TILE_QUARTZ, TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY, TILE_TITANIUM, TILE_SAPPHIRE,
    TILE_URANIUM, TILE_AMETHYST, TILE_OPAL, TILE_VOIDSTONE, TILE_CORE, TILE_CHEST, TILE_COLORS, TILE_LABELS } = NS.constants;

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
    [TILE_RUBY]: 'Ruby',
    [TILE_TITANIUM]: 'Titanium Ore',
    [TILE_SAPPHIRE]: 'Sapphire',
    [TILE_URANIUM]: 'Uranium',
    [TILE_AMETHYST]: 'Amethyst',
    [TILE_OPAL]: 'Fire Opal',
    [TILE_VOIDSTONE]: 'Voidstone',
    [TILE_CORE]: 'Relocation Core',
    [TILE_CHEST]: 'Secret Chest'
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
    [TILE_RUBY]: ['#ff4488', '#e0115f', '#ff2070', '#c00048'],
    [TILE_TITANIUM]: ['#c8dcf4', '#8aa0bc', '#e8f2ff', '#6a80a0'],
    [TILE_SAPPHIRE]: ['#6aa0ff', '#2a64e0', '#a0c4ff', '#1438a0'],
    [TILE_URANIUM]: ['#9aff5a', '#58d030', '#d0ff90', '#30a010'],
    [TILE_AMETHYST]: ['#d090ff', '#9a4ad8', '#f0c8ff', '#6a20a8'],
    [TILE_OPAL]: ['#ffd080', '#ff9a40', '#80e8ff', '#60f0a0'],
    [TILE_VOIDSTONE]: ['#b48aff', '#5a3aa0', '#f0e0ff', '#2a1458']
  };

  // All resource tile types (used for detection in various places)
  const RESOURCE_TILES = [
    TILE_IRON, TILE_WATER, TILE_COBALT,
    TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER, TILE_LEAD, TILE_COAL,
    TILE_QUARTZ, TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY,
    TILE_TITANIUM, TILE_SAPPHIRE, TILE_URANIUM, TILE_AMETHYST, TILE_OPAL, TILE_VOIDSTONE
  ];

  function emptyResources() {
    const r = {};
    for (const t of RESOURCE_TILES)
      r[TILE_LABELS[t]] = 0;
    return r;
  }

  /* -- Rock strata, STRATUM_ROWS rows each -- */
  // style picks the texture painter; ore names the signature ore of a deep layer
  const DEPTH_TIERS = [
    { name: 'Sand',         base: '#c2a55a', highlight: '#d4bb78', shadow: '#8a7438', style: 'soil' },
    { name: 'Loose Soil',   base: '#8b6c42', highlight: '#a88558', shadow: '#5e4628', style: 'soil' },
    { name: 'Dirt',         base: '#4a3a2a', highlight: '#6a5540', shadow: '#2a1a0a', style: 'soil' },
    { name: 'Packed Dirt',  base: '#3d2e1e', highlight: '#584630', shadow: '#221508', style: 'soil' },
    { name: 'Clay',         base: '#6b3a2a', highlight: '#885040', shadow: '#3e1e12', style: 'soil' },
    { name: 'Gravel',       base: '#5a5040', highlight: '#706858', shadow: '#3a3228', style: 'gravel' },
    { name: 'Soft Stone',   base: '#7a7a7a', highlight: '#949494', shadow: '#505050', style: 'stone' },
    { name: 'Stone',        base: '#5a5a5a', highlight: '#707070', shadow: '#383838', style: 'stone' },
    { name: 'Hard Stone',   base: '#3e3e3e', highlight: '#525252', shadow: '#222222', style: 'stone' },
    { name: 'Bedrock',      base: '#2a2628', highlight: '#3c3638', shadow: '#121012', style: 'stone' },
    { name: 'Slate',        base: '#3a4654', highlight: '#4e5c6c', shadow: '#1e2630', style: 'slate', ore: TILE_TITANIUM },
    { name: 'Granite',      base: '#6a4a48', highlight: '#866460', shadow: '#3a2826', style: 'granite', ore: TILE_SAPPHIRE },
    { name: 'Basalt',       base: '#262a2e', highlight: '#363c42', shadow: '#101316', style: 'basalt', ore: TILE_URANIUM },
    { name: 'Obsidian',     base: '#1a1424', highlight: '#2c2240', shadow: '#08060e', style: 'obsidian', ore: TILE_AMETHYST },
    { name: 'Magma Rock',   base: '#3a1a12', highlight: '#5a2618', shadow: '#1a0806', style: 'magma', ore: TILE_OPAL },
    { name: 'Abyssal Core', base: '#140e26', highlight: '#22183c', shadow: '#06040e', style: 'abyss', ore: TILE_VOIDSTONE }
  ];
  const DEEP_STRATUM = 10; // first layer of the deep strata (signature ores)

  // Stratum index (0..STRATUM_COUNT-1) for a given row
  function getDepthTier(row) {
    return Math.max(0, Math.min(DEPTH_TIERS.length - 1, Math.floor(row / STRATUM_ROWS)));
  }

  // Get depth-based colors for dirt at a given row
  function getDepthDirtColors(row) {
    return DEPTH_TIERS[getDepthTier(row)];
  }

  // Depth-based mining time multiplier: 0.5 at the surface, rising every row (about 5 at the core)
  function getDepthMineMultiplier(row) {
    return 0.5 + (row / STRATUM_ROWS) * 0.28;
  }

  // Ore found deeper is richer: up to +60% yield at the bottom of the mine
  function getDepthValueMultiplier(row) {
    return 1 + 0.6 * Math.max(0, Math.min(1, row / (GRID_ROWS - 1)));
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
    [TILE_RUBY]: 2.8,
    [TILE_TITANIUM]: 3.0,
    [TILE_SAPPHIRE]: 3.2,
    [TILE_URANIUM]: 3.4,
    [TILE_AMETHYST]: 3.5,
    [TILE_OPAL]: 3.7,
    [TILE_VOIDSTONE]: 4.0,
    [TILE_CORE]: 3.5,
    [TILE_CHEST]: 3
  };

  /* -- Movement -- */
  const BASE_MOVE_INTERVAL = 0.15; // seconds per tile (base, before upgrades)

  /* -- Tools bought in the upgrade tree (HUD rows and number-key shortcuts) -- */
  const TOOL_DEFS = [
    { key: 'drill', name: 'Drill Gadget', icon: 'drill', shortcut: '1' },
    { key: 'blastTool', name: 'Blast Mining', icon: 'explosion', shortcut: '2' },
    { key: 'scanner', name: 'Scanner', icon: 'magnifier', shortcut: '3' },
    { key: 'reinforcedDome', name: 'Reinforced Dome', icon: 'shield', shortcut: '4' },
    { key: 'teleporter', name: 'Teleporter', icon: 'portal', shortcut: '5' }
  ];

  // Saves from before the single upgrade tree kept a separate quick-upgrade
  // level per stat; those levels become the first nodes of the matching chain
  const LEGACY_UPGRADE_CHAINS = {
    weaponDamage: 'damage', fireRate: 'fireRate', domeHP: 'shield', drillSpeed: 'drillSpeed',
    carryCapacity: 'carry', moveSpeed: 'speed', miningTools: 'mining'
  };

  const GADGET_TOOL_COOLDOWNS = {
    blastTool: 5,   // seconds
    teleporter: 30   // seconds
  };

  /* -- Upgrade Tree -- */
  // Each node: id, name, icon, branch, costs per level [{iron, cobalt, water}],
  //   maxLevel, prereqs ('id' = that node maxed, 'id@N' = that node at level N or more),
  //   upgradeKey (links to game stat)

  // Rising costs of a level-up upgrade: level i pays two neighbouring resources of
  // the ladder (cheap -> rare), moving up the ladder as the levels go by
  function levelCosts(levels, ladder, base, growth) {
    const out = [];
    for (let i = 0; i < levels; ++i) {
      const k = Math.min(ladder.length - 2, Math.floor(i * (ladder.length - 1) / levels));
      const f = Math.pow(growth, i);
      const cost = {};
      cost[ladder[k]] = Math.max(1, Math.round(base * f));
      cost[ladder[k + 1]] = Math.max(1, Math.round(base * 0.6 * f));
      out.push(cost);
    }
    return out;
  }

  NS.rules = { TILE_DISPLAY_NAMES, ORE_SPECKLE_COLORS, RESOURCE_TILES, emptyResources, DEPTH_TIERS,
    DEEP_STRATUM, getDepthTier, getDepthMineMultiplier, getDepthValueMultiplier, getTileBaseColor,
    DOME_RADIUS, DOME_X, DOME_Y, BASE_DOME_HP, BASE_WEAPON_DAMAGE, BASE_FIRE_RATE, BASE_DRILL_SPEED,
    BASE_CARRY_CAPACITY, BASE_MINE_TIME, TILE_MINE_MULTIPLIER, BASE_MOVE_INTERVAL, TOOL_DEFS,
    LEGACY_UPGRADE_CHAINS, GADGET_TOOL_COOLDOWNS, levelCosts };
})();
