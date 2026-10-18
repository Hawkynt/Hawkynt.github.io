/* Space Farming - the tech tree data (five branches of nodes and chains) and its rules:
   levels, prerequisites, costs, unlocks and buying a node.
   Owns: G.techLevels, G.techBoughtTotal
   Reads: G.state, G.credits, G.gridRows, G.inventory, G.gridCols, G.penVersion, G.stats */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, CROPS, LIVESTOCK, BUILDINGS, announce } = NS;

  /* ══════════════════════════════════════════════════════════════════
     TECH TREE — five branches of upgrades bought with credits and
     produce; unlocks crops, animals and buildings
     ══════════════════════════════════════════════════════════════════ */

  const TREE_BRANCH_ORDER = ['agri', 'husb', 'eng', 'sci', 'com'];
  const TREE_BRANCH_LABELS = { agri: 'AGRICULTURE', husb: 'HUSBANDRY', eng: 'ENGINEERING', sci: 'SCIENCE', com: 'COMMERCE' };
  const TREE_BRANCH_SHORT = { agri: 'Crops', husb: 'Animals', eng: 'Engineering', sci: 'Science', com: 'Commerce' };
  const TREE_BRANCH_COLORS = { agri: '#7ee06a', husb: '#ff9ac0', eng: '#4cc4ff', sci: '#c890ff', com: '#ffc94a' };
  const TREE_BRANCH_ICONS = { agri: 'growth', husb: 'paw', eng: 'hammer', sci: 'flask', com: 'coin' };
  const TREE_REGION_ROWS = [['agri', 'husb', 'com'], ['eng', 'sci']];
  const TREE_CARD_W = 200, TREE_CARD_H = 88;
  const TREE_GAP_X = 40, TREE_GAP_Y = 24;
  const TREE_REGION_PAD = 30, TREE_REGION_HEADER = 74, TREE_REGION_GAP = 90;
  const TREE_MIN_ZOOM = 0.18, TREE_MAX_ZOOM = 1.6;

  /* Crops, animals and buildings available from the first day */
  const START_CROPS = [0, 2, 3, 6];
  const START_ANIMALS = [1, 3];
  const START_BUILDINGS = [0, 3, 6, 7, 8];

  const TECH = [];
  function node(id, branch, name, icon, prereqs, cost, desc, extra) {
    const n = Object.assign({ id, branch, name, icon, prereqs, cost, desc, chain: null, tier: 0 }, extra || {});
    TECH.push(n);
    return n;
  }
  /* A chain of tiers "Name I..N" where every tier needs the one before */
  function chain(prefix, branch, name, icon, rootPrereqs, crs, items, desc) {
    for (let i = 0; i < crs.length; ++i) {
      const cost = Object.assign({ cr: crs[i] }, items[i] || {});
      node(prefix + (i + 1), branch, name, icon, i === 0 ? rootPrereqs : [prefix + i], cost, desc, { chain: prefix, tier: i + 1, tiers: crs.length });
    }
  }

  // Agriculture
  chain('agri_growth', 'agri', 'Growth Boost', 'growth', [], [50, 90, 160, 290, 520],
    [null, { 'Space Wheat': 6 }, { 'Lunar Lettuce': 10 }, { 'Cosmic Corn': 10 }, { 'Crystal Melon': 8 }], 'All crops grow 25% faster.');
  chain('agri_soil', 'agri', 'Rich Soil', 'flask', [], [100, 190, 360, 690, 1300],
    [{ 'Space Wheat': 5 }, { 'Nebula Berry': 8 }, { 'Solar Tomato': 10 }, { 'Star Fruit': 10 }, { 'Crystal Melon': 10 }], 'Every plot grows 15% faster and gains 15% fertility.');
  chain('agri_yield', 'agri', 'Bountiful Harvest', 'crate', [], [80, 160, 320, 640, 1280],
    [{ 'Lunar Lettuce': 6 }, { 'Solar Tomato': 8 }, { 'Nebula Berry': 12 }, { 'Cosmic Corn': 12 }, { 'Astral Flower': 6 }], '+20% chance to harvest a bonus crop.');
  node('agri_orchard', 'agri', 'Orchard Seeds', 'starfruit', [], { cr: 120, 'Space Wheat': 8 }, 'Unlocks Star Fruit and Cosmic Corn.', { unlock: { crops: [1, 4] } });
  node('agri_melon', 'agri', 'Crystal Hydroponics', 'melon', ['agri_orchard'], { cr: 300, 'Star Fruit': 8 }, 'Unlocks the Crystal Melon.', { unlock: { crops: [5] } });
  node('agri_seedbank', 'agri', 'Seed Bank', 'seedbag', ['agri_soil2'], { cr: 400, 'Cosmic Corn': 10 }, 'All seeds cost 20% less.');

  // Husbandry
  node('husb_goat', 'husb', 'Goat Herding', 'goat', [], { cr: 150, 'Egg': 6 }, 'Unlocks the Nebula Goat.', { unlock: { animals: [2] } });
  node('husb_cow', 'husb', 'Space Dairy', 'cow', ['husb_goat'], { cr: 260, 'Wool': 6 }, 'Unlocks the Space Cow.', { unlock: { animals: [0] } });
  node('husb_collector', 'husb', 'Auto-Collectors', 'collector', ['husb_cow'], { cr: 300, 'Milk': 6 }, 'Unlocks the Auto-Collector building.', { unlock: { buildings: [11] } });
  chain('husb_care', 'husb', 'Animal Care', 'paw', [], [100, 220, 480], [{ 'Feather': 6 }, { 'Egg': 10 }, { 'Wool': 10 }], 'Animals produce 12% faster.');
  chain('husb_premium', 'husb', 'Premium Produce', 'star', ['husb_care1'], [140, 300, 640], [{ 'Egg': 8 }, { 'Wool': 8 }, { 'Milk': 10 }], 'Animal produce sells for 15% more.');
  node('husb_happy', 'husb', 'Happy Herds', 'heart', ['husb_premium2'], { cr: 500, 'Milk': 12 }, '20% chance to collect double produce.');

  // Engineering
  node('eng_solar', 'eng', 'Solar Power', 'solarpanel', [], { cr: 150, 'Space Wheat': 10 }, 'Unlocks the Solar Panel.', { unlock: { buildings: [4] } });
  node('eng_wind', 'eng', 'Wind Power', 'turbine', ['eng_solar'], { cr: 250, 'Solar Tomato': 10 }, 'Unlocks the Wind Turbine.', { unlock: { buildings: [5] } });
  node('eng_greenhouse', 'eng', 'Greenhouses', 'greenhouse', ['eng_solar'], { cr: 220, 'Lunar Lettuce': 12 }, 'Unlocks the Greenhouse.', { unlock: { buildings: [2] } });
  node('eng_harvester', 'eng', 'Harvester Bots', 'harvester', ['eng_solar'], { cr: 200, 'Nebula Berry': 10 }, 'Unlocks the Harvester building.', { unlock: { buildings: [1] } });
  chain('eng_drones', 'eng', 'Harvest Drones', 'robot', ['eng_harvester'], [200, 600, 1800], [{ 'Cosmic Corn': 8 }, { 'Star Fruit': 12 }, { 'Crystal Melon': 12 }], 'Drones harvest ripe crops anywhere on the farm, faster with every tier.');
  node('eng_planter', 'eng', 'Auto-Planters', 'planter1', ['eng_harvester'], { cr: 260, 'Nebula Berry': 12 }, 'Unlocks the Auto-Planter.', { unlock: { buildings: [9] } });
  node('eng_planter2', 'eng', 'Market Planters', 'planter2', ['eng_planter'], { cr: 600, 'Star Fruit': 12 }, 'Unlocks the Auto-Planter L2 that plants the best-paying crop.', { unlock: { buildings: [10] } });
  chain('eng_irr', 'eng', 'Irrigation', 'drop', [], [140, 322, 741], [{ 'Lunar Lettuce': 6 }, { 'Solar Tomato': 10 }, { 'Cosmic Corn': 12 }], 'Weather damages 15% fewer crops.');
  chain('eng_grid', 'eng', 'Power Grid', 'bolt', ['eng_solar'], [180, 400, 900], [{ 'Space Wheat': 10 }, { 'Cosmic Corn': 10 }, { 'Crystal Melon': 10 }], '+25 max energy and +0.5 energy per second.');
  node('eng_builder', 'eng', 'Efficient Construction', 'hammer', ['eng_grid1'], { cr: 450, 'Solar Tomato': 15 }, 'Buildings and building upgrades cost 15% less.');
  node('eng_land', 'eng', 'Expand Field', 'map', [], { cr: 0 }, 'Adds a strip of new plots to the field (west, east, north, south in turn). Also sold at the + strip beside the field.', { repeat: true });

  // Science
  node('sci_forecast', 'sci', 'Weather Forecast', 'eye', [], { cr: 90, 'Lunar Lettuce': 5 }, 'Shows the coming weather and when it arrives.');
  chain('sci_shield', 'sci', 'Weather Shield', 'shield', [], [120, 300, 750], [{ 'Nebula Berry': 6 }, { 'Star Fruit': 8 }, { 'Plasma Pepper': 8 }], 'Weather damages 25% fewer crops.');
  node('sci_rain', 'sci', 'Rain Maker', 'rain', ['sci_forecast', 'sci_shield1'], { cr: 350, 'Lunar Lettuce': 15 }, 'Call a rain shower from the clock panel once a day.');
  node('sci_fungi', 'sci', 'Fungal Lab', 'mushroom', [], { cr: 180, 'Nebula Berry': 8 }, 'Unlocks the Void Mushroom.', { unlock: { crops: [7] } });
  node('sci_plasma', 'sci', 'Plasma Botany', 'pepper', ['sci_fungi'], { cr: 320, 'Void Mushroom': 8 }, 'Unlocks the Plasma Pepper.', { unlock: { crops: [8] } });
  node('sci_astral', 'sci', 'Astral Botany', 'flower', ['sci_plasma'], { cr: 520, 'Plasma Pepper': 8 }, 'Unlocks the Astral Flower.', { unlock: { crops: [9] } });
  node('sci_cycles', 'sci', 'Day & Night Genetics', 'moss', ['sci_astral'], { cr: 700, 'Astral Flower': 6 }, 'Unlocks Lunar Moss and the Solar Vine.', { unlock: { crops: [10, 11] } });
  chain('sci_repel', 'sci', 'Pest Repellent', 'mouse', [], [120, 360], [{ 'Solar Tomato': 6 }, { 'Void Mushroom': 8 }], 'Space mice show up 40% less often.');
  node('sci_frost', 'sci', 'Frost Hardiness', 'winter', ['sci_shield1'], { cr: 380, 'Lunar Lettuce': 15 }, 'Winter only slows crops by 20% and snowfall no longer slows them.');
  node('sci_meteor', 'sci', 'Meteor Harvesting', 'meteor', ['sci_shield2'], { cr: 600, 'Plasma Pepper': 10 }, 'Every meteor leaves stardust worth 8-17 credits.');

  // Commerce
  chain('com_market', 'com', 'Market Access', 'chart', [], [120, 240, 480, 960, 1920],
    [{ 'Space Wheat': 8 }, { 'Solar Tomato': 10 }, { 'Star Fruit': 10 }, { 'Crystal Melon': 8 }, { 'Astral Flower': 8 }], 'Everything sells for 10% more.');
  chain('com_storage', 'com', 'Warehousing', 'basket', [], [100, 250, 600], [{ 'Nebula Berry': 6 }, { 'Cosmic Corn': 10 }, { 'Milk': 8 }], '+40 storage space.');
  node('com_insight', 'com', 'Market Insight', 'scroll', ['com_market1'], { cr: 200, 'Lunar Lettuce': 10 }, 'See the next price change before it happens.');
  node('com_floor', 'com', 'Price Floor', 'coin', ['com_insight'], { cr: 450, 'Star Fruit': 10 }, 'Prices never fall below 80% of normal.');
  node('com_broker', 'com', 'Bulk Broker', 'market', ['com_market2'], { cr: 380, 'Cosmic Corn': 12 }, 'Selling 20 or more items at once pays 10% extra.');

  node('agri_kale', 'agri', 'Frost Kale', 'kale', ['agri_soil1'], { cr: 220, 'Lunar Lettuce': 12 }, 'Unlocks Frost Kale, which shrugs off winter and snow.', { unlock: { crops: [13] } });
  node('agri_pumpkin', 'agri', 'Comet Pumpkins', 'pumpkin', ['agri_orchard'], { cr: 350, 'Cosmic Corn': 10 }, 'Unlocks the Comet Pumpkin, an autumn giant.', { unlock: { crops: [12] } });
  node('husb_rabbit', 'husb', 'Moon Rabbits', 'rabbit', ['husb_goat'], { cr: 300, 'Feather': 12 }, 'Unlocks the Moon Rabbit.', { unlock: { animals: [4] } });
  node('husb_bees', 'husb', 'Star Bees', 'bee', ['husb_cow'], { cr: 520, 'Milk': 8 }, 'Unlocks Star Bees: honey, and crops near the hive grow 15% faster.', { unlock: { animals: [5] } });
  node('eng_lamp', 'eng', 'Grow Lamps', 'lamp', ['eng_grid1'], { cr: 300, 'Solar Tomato': 12 }, 'Unlocks the Grow Lamp.', { unlock: { buildings: [12] } });
  node('sci_zapper', 'sci', 'Pest Zapper', 'zapper', ['sci_repel1'], { cr: 340, 'Void Mushroom': 8 }, 'Unlocks the Pest Zapper.', { unlock: { buildings: [13] } });
  chain('com_orders', 'com', 'Trade Network', 'order', ['com_market1'], [150, 450], [{ 'Space Wheat': 10 }, { 'Star Fruit': 10 }], 'One more trader order can be open at a time.');

  const TECH_BY_ID = {};
  for (const n of TECH)
    TECH_BY_ID[n.id] = n;

  /* Upgrades of the old flat shop and the tree chain each one became */
  const LEGACY_CHAINS = { growSpeed: 'agri_growth', soilQuality: 'agri_soil', yieldMultiplier: 'agri_yield', weatherResist: 'sci_shield', irrigation: 'eng_irr', autoHarvest: 'eng_drones', marketAccess: 'com_market' };

  function techLevel(id) {
    return G.techLevels[id] || 0;
  }

  function techOwned(id) {
    return techLevel(id) >= 1;
  }

  function techChainCount(prefix) {
    let n = 0;
    for (let i = 1; TECH_BY_ID[prefix + i]; ++i)
      if (techOwned(prefix + i)) ++n;
    return n;
  }

  function isNodeDone(n) {
    return !n.repeat && techOwned(n.id);
  }

  function arePrereqsMet(n) {
    for (const p of n.prereqs)
      if (!techOwned(p)) return false;
    return true;
  }

  function nodeCost(n) {
    if (n.id === 'eng_land')
      return { cr: NS.getNextExpansionTileCount() * 8 };
    return n.cost;
  }

  function canPay(cost) {
    for (const k in cost) {
      const need = cost[k] || 0;
      if (!need) continue;
      if (k === 'cr' ? G.credits < need : (G.inventory[k] || 0) < need)
        return false;
    }
    return true;
  }

  function treeNodeState(n) {
    if (isNodeDone(n)) return 'owned';
    if (!arePrereqsMet(n)) return 'locked';
    return canPay(nodeCost(n)) ? 'ready' : 'poor';
  }

  function unlockedByTech(kind, index) {
    for (const n of TECH)
      if (n.unlock && n.unlock[kind] && n.unlock[kind].includes(index))
        return n;
    return null;
  }

  function isCropUnlocked(i) {
    if (START_CROPS.includes(i)) return true;
    const n = unlockedByTech('crops', i);
    return !!n && techOwned(n.id);
  }

  function isAnimalUnlocked(i) {
    if (START_ANIMALS.includes(i)) return true;
    const n = unlockedByTech('animals', i);
    return !!n && techOwned(n.id);
  }

  function isBuildingUnlocked(i) {
    if (START_BUILDINGS.includes(i)) return true;
    const n = unlockedByTech('buildings', i);
    return !!n && techOwned(n.id);
  }

  function itemSprite(name) {
    if (name === 'cr') return 'coin';
    for (const c of CROPS)
      if (c.name === name) return c.sprite;
    for (const l of LIVESTOCK)
      if (l.produce === name) return l.produceSprite;
    return 'crate';
  }

  function purchaseTreeNode(n) {
    if (G.state !== STATE_PLAYING || isNodeDone(n) || !arePrereqsMet(n)) return false;
    const cost = nodeCost(n);
    if (!canPay(cost)) return false;
    const title = nodeTitle(n);
    for (const k in cost) {
      if (!cost[k]) continue;
      if (k === 'cr') G.credits -= cost[k];
      else {
        G.inventory[k] -= cost[k];
        if (G.inventory[k] <= 0) delete G.inventory[k];
      }
    }
    G.techLevels[n.id] = techLevel(n.id) + 1;
    if (n.id === 'eng_land') {
      ++G.stats.surveys;
      ++G.penVersion;
      NS.expandGrid();
      NS.relocateLivestockToPerimeter();
    }
    NS.invalidateField();
    const names = [];
    if (n.unlock) {
      for (const i of n.unlock.crops || []) names.push(CROPS[i].name);
      for (const i of n.unlock.animals || []) names.push(LIVESTOCK[i].name);
      for (const i of n.unlock.buildings || []) names.push(BUILDINGS[i].name);
    }
    if (names.length) {
      announce('Unlocked: ' + names.join(' & '), title, TREE_BRANCH_COLORS[n.branch], n.icon);
      SZ.GameAudio.play('win', { volume: 0.7 });
    } else {
      announce(title, n.id === 'eng_land' ? `${G.gridCols} × ${G.gridRows} plots now` : n.desc, TREE_BRANCH_COLORS[n.branch], n.icon);
      SZ.GameAudio.play('levelup');
    }
    ++G.techBoughtTotal;
    NS.saveGame();
    return true;
  }

  function toRoman(n) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n - 1] || String(n);
  }

  function nodeTitle(n) {
    if (n.repeat) return n.name + ' ' + (techLevel(n.id) + 1);
    return n.chain ? n.name + ' ' + toRoman(n.tier) : n.name;
  }

  Object.assign(NS, { TREE_BRANCH_ORDER, TREE_BRANCH_LABELS, TREE_BRANCH_SHORT, TREE_BRANCH_COLORS,
    TREE_BRANCH_ICONS, TREE_REGION_ROWS, TREE_CARD_W, TREE_CARD_H, TREE_GAP_X, TREE_GAP_Y, TREE_REGION_PAD,
    TREE_REGION_HEADER, TREE_REGION_GAP, TREE_MIN_ZOOM, TREE_MAX_ZOOM, START_CROPS, TECH, TECH_BY_ID,
    LEGACY_CHAINS, techLevel, techOwned, techChainCount, isNodeDone, arePrereqsMet, nodeCost, canPay,
    treeNodeState, unlockedByTech, isCropUnlocked, isAnimalUnlocked, isBuildingUnlocked, itemSprite,
    purchaseTreeNode, nodeTitle });

})();
