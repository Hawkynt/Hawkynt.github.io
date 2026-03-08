;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  let canvasW = 700;
  let canvasH = 500;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* ── Grid ── */
  const GRID_COLS = 8;
  const BASE_GRID_ROWS = 6;
  // MAX_EXPANSION_ROWS removed: unlimited expansion via plotExpansion upgrade
  const BASE_TILE_SIZE = 56;
  const GRID_OFFSET_X = 30;
  const GRID_OFFSET_Y = 60;

  /* ── Tile types ── */
  const TILE_FARMLAND = 0;
  const TILE_ROCK = 1;
  const TILE_WATER = 2;
  const TILE_SAND = 3;

  /* ── Soil quality per expansion tier ── */
  const SOIL_QUALITY_TIERS = [1.0, 0.8, 0.65, 0.5]; // original, 1st exp, 2nd, 3rd

  /* ── States ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-space-farming';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* ── Crop Definitions ── */
  // weather affinity: 'any' = unaffected, 'solar' = boosted by solar flare,
  //                   'cold-vulnerable' = damaged by meteor shower cold snap
  const CROPS = [
    { name: 'Space Wheat',   icon: '🌾', color: '#da2',  growTime: 8,  stages: 4, sellPrice: 10, seedCost: 5,  weatherAffinity: null },
    { name: 'Star Fruit',    icon: '⭐', color: '#f80',  growTime: 14, stages: 4, sellPrice: 25, seedCost: 12, weatherAffinity: null },
    { name: 'Nebula Berry',  icon: '🫐', color: '#a3f',  growTime: 10, stages: 4, sellPrice: 15, seedCost: 8,  weatherAffinity: null },
    { name: 'Lunar Lettuce', icon: '🥬', color: '#5d5',  growTime: 6,  stages: 3, sellPrice: 8,  seedCost: 3,  weatherAffinity: null },
    { name: 'Cosmic Corn',   icon: '🌽', color: '#ec3',  growTime: 12, stages: 4, sellPrice: 20, seedCost: 10, weatherAffinity: null },
    { name: 'Crystal Melon', icon: '🍈', color: '#0da',  growTime: 18, stages: 5, sellPrice: 40, seedCost: 20, weatherAffinity: null },
    { name: 'Solar Tomato',  icon: '🍅', color: '#e33',  growTime: 9,  stages: 4, sellPrice: 12, seedCost: 6,  weatherAffinity: null },
    { name: 'Void Mushroom', icon: '🍄', color: '#728',  growTime: 11, stages: 4, sellPrice: 18, seedCost: 9,  weatherAffinity: 'any' },
    { name: 'Plasma Pepper', icon: '🌶️', color: '#f52',  growTime: 6,  stages: 3, sellPrice: 30, seedCost: 15, weatherAffinity: 'cold-vulnerable' },
    { name: 'Astral Flower', icon: '🌸', color: '#8af',  growTime: 20, stages: 5, sellPrice: 55, seedCost: 28, weatherAffinity: 'solar' },
    { name: 'Lunar Moss',   icon: '🌑', color: '#679',  growTime: 35, stages: 4, sellPrice: 28, seedCost: 15, weatherAffinity: null, nightOnly: true },
    { name: 'Solar Vine',   icon: '☀️', color: '#fc0',  growTime: 30, stages: 4, sellPrice: 35, seedCost: 20, weatherAffinity: 'solar', dayOnly: true }
  ];

  /* ── Livestock Definitions ── */
  const LIVESTOCK = [
    { name: 'Space Cow',     icon: '🐄', color: '#ddd', feedInterval: 12, produce: 'Milk',      produceIcon: '🥛', produceValue: 18, cost: 50 },
    { name: 'Star Hen',      icon: '🐔', color: '#fb4', feedInterval: 8,  produce: 'Egg',       produceIcon: '🥚', produceValue: 10, cost: 30 },
    { name: 'Nebula Goat',   icon: '🐐', color: '#c96', feedInterval: 10, produce: 'Wool',      produceIcon: '🧶', produceValue: 14, cost: 40 },
    { name: 'Crystal Chick', icon: '🐣', color: '#ff8', feedInterval: 6,  produce: 'Feather',   produceIcon: '🪶', produceValue: 6,  cost: 15 }
  ];

  /* ── Weather ── */
  const WEATHER_NONE = 'none';
  const WEATHER_SOLAR_FLARE = 'solarFlare';
  const WEATHER_METEOR_SHOWER = 'meteorShower';
  const WEATHER_RAIN = 'rain';
  const WEATHER_THUNDERSTORM = 'thunderstorm';
  const WEATHER_DURATION = 8;
  const WEATHER_MIN_INTERVAL = 25;
  const WEATHER_MAX_INTERVAL = 50;

  /* ── Shop modes ── */
  const TOOL_PLANT = 'plant';
  const TOOL_HARVEST = 'harvest';
  const TOOL_FEED = 'feed';
  const TOOL_HOE = 'hoe';

  /* ── Upgrade Definitions ── */
  const UPGRADES = [
    { id: 'growSpeed',       name: 'Growth Boost',       icon: '🌱', maxLevel: 5, baseCost: 50,  costScale: 1.8, desc: 'Crops grow faster (+25%/lvl)' },
    { id: 'yieldMultiplier', name: 'Yield Multiplier',   icon: '📦', maxLevel: 5, baseCost: 80,  costScale: 2.0, desc: 'Harvest more per crop (+20%/lvl)' },
    { id: 'weatherResist',   name: 'Weather Shield',     icon: '🛡', maxLevel: 3, baseCost: 120, costScale: 2.5, desc: 'Reduce meteor damage chance' },
    { id: 'autoHarvest',     name: 'Auto-Harvester',     icon: '🤖', maxLevel: 3, baseCost: 200, costScale: 3.0, desc: 'Auto-harvest mature crops' },
    { id: 'plotExpansion',   name: 'Plot Expansion',     icon: '🗺', maxLevel: 99, baseCost: 150, costScale: 1.5, desc: 'Expand farm outward by 1 ring' },
    { id: 'soilQuality',    name: 'Soil Quality',        icon: '🧪', maxLevel: 5, baseCost: 100, costScale: 1.9, desc: 'All tiles grow faster (+15%/lvl)' },
    { id: 'marketAccess',   name: 'Market Access',       icon: '📈', maxLevel: 5, baseCost: 120, costScale: 2.0, desc: 'Sell prices +10% per level' },
    { id: 'irrigation',     name: 'Irrigation System',   icon: '💧', maxLevel: 3, baseCost: 140, costScale: 2.3, desc: 'Reduce crop damage -15%/lvl (stacks w/ Shield)' }
  ];

  /* ── Building Definitions ── */
  const BUILDINGS = [
    { name: 'Sprinkler',  icon: '\uD83D\uDCA7', cost: 50,  desc: 'Waters adjacent crops (+20% growth)', range: 1 },
    { name: 'Harvester',  icon: '\uD83E\uDD16', cost: 120, desc: 'Auto-harvests adjacent mature crops',   range: 1 },
    { name: 'Greenhouse', icon: '\uD83C\uDFE0', cost: 200, desc: 'Protects adjacent crops from weather',  range: 1 },
    { name: 'Silo',       icon: '\uD83C\uDFD7\uFE0F', cost: 80,  desc: 'Increases sell price by 10% (global)', range: 0 },
    { name: 'Solar Panel',  icon: '\u2600\uFE0F', cost: 150, desc: 'Generates 2 credits/cycle',              range: 0 },
    { name: 'Wind Turbine', icon: '\uD83C\uDF00', cost: 250, desc: 'Generates 5 credits/cycle + adj growth +10%', range: 1 },
    { name: 'Compost Bin',  icon: '\u267B\uFE0F', cost: 100, desc: 'Boosts adjacent fertility +25%',         range: 1 },
    { name: 'Scarecrow',    icon: '\uD83E\uDDD1\u200D\uD83C\uDF3E', cost: 75, desc: 'Protects 3x3 area from animals', range: 1 },
    { name: 'Fence',        icon: '\uD83D\uDD32', cost: 30,  desc: 'Blocks animal movement on this tile',     range: 0 },
    { name: 'Auto-Planter L1', icon: '\uD83C\uDF31', cost: 200, desc: 'Plants selected crop on adj. empty land (15s)', range: 1 },
    { name: 'Auto-Planter L2', icon: '\uD83C\uDF3F', cost: 500, desc: 'Plants highest-price crop on adj. land (15s)',  range: 1 },
    { name: 'Auto-Collector', icon: '\uD83D\uDCE5', cost: 300, desc: 'Auto-collects adjacent livestock produce', range: 1 },
  ];

  const BUILDING_MAX_LEVEL = 6; // levels 1-6 (5 upgrades from L1)

  /* ── Building placement mode ── */
  const TOOL_BUILD = 'build';

  /* ── Price Fluctuation ── */
  const PRICE_CHANGE_INTERVAL = 60; // seconds between price shifts
  const PRICE_MIN_MULT = 0.5;
  const PRICE_MAX_MULT = 2.0;

  /* ── Seasons ── */
  const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const SEASON_DURATION = 4; // days per season
  const SEASON_ICONS = ['\uD83C\uDF31', '\u2600\uFE0F', '\uD83C\uDF42', '\u2744\uFE0F']; // icons per season

  /* ── Day/Night ── */
  const DAY_CYCLE_PERIOD = 30; // same as game day length in seconds

  /* ── Animals ── */
  const ANIMAL_SPAWN_MIN = 60;
  const ANIMAL_SPAWN_MAX = 120;

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCredits = document.getElementById('statusCredits');
  const statusTool = document.getElementById('statusTool');
  const statusWeather = document.getElementById('statusWeather');
  const statusDay = document.getElementById('statusDay');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  /* ── Tutorial ── */
  let tutorialSeen = false;
  let showTutorial = false;
  let tutorialPage = 0;
  const TUTORIAL_PAGES = [
    { title: 'Welcome, Farmer!', lines: ['Grow crops and tend livestock on your', 'space station farm. Sell produce for credits!', '', 'Click a plot to plant, water, or harvest.', 'Press 1-0 to select crop type.', 'Press S to sell all produce.'] },
    { title: 'Terrain & Land', lines: ['Your farm has varied terrain:', 'Brown = farmland, Yellow = sandy (0.7x growth),', 'Blue = water (boosts adjacent +15%), Gray = rock.', '', 'Each tile has unique fertility (50-100%).', 'Only water blocks building placement.'] },
    { title: 'Buildings', lines: ['Press B or use the building bar to place buildings.', 'Sprinkler: +20% growth | Harvester: auto-harvest', 'Greenhouse: weather shield | Silo: +10% sell, +50 storage', 'Solar/Wind: income + energy | Auto-Planter: auto-plant', 'Right-click buildings to upgrade (up to L6)!', 'Shift+right-click to remove. Upgrades cost 50% of base.'] },
    { title: 'Crops & Weather', lines: ['Void Mushroom grows in any weather.', 'Plasma Pepper is fast but cold-vulnerable.', 'Astral Flower/Solar Vine grow best in sunlight.', 'Lunar Moss only grows at night!', 'Solar flares boost growth; meteor showers', 'damage unprotected crops!'] },
    { title: 'Upgrades', lines: ['Press U or click UPGRADES to open the shop.', '', 'Growth Boost, Yield, Weather Shield, Auto-Harvest,', 'Plot Expansion (more rows!), Soil Quality,', 'Market Access (better prices), Irrigation.', 'Each has multiple levels. Invest wisely!'] },
    { title: 'Market & Land', lines: ['Crop prices fluctuate every 60 seconds!', 'Green arrow = high price, red = low price.', 'Buy seeds when cheap, sell when prices are high.', '', 'Land expands in 4 directions (S/W/E/N).', 'New terrain uses biome-aware generation.'] },
    { title: 'Seasons & Day/Night', lines: ['Seasons change every 4 days:', 'Spring: +10% growth | Summer: +25% growth', 'Autumn: +15% harvest, -10% growth', 'Winter: -40% growth, no weather events', '', 'Day/night cycles affect some crops & visuals.'] },
    { title: 'Animals & Storage', lines: ['Wild space mice spawn and eat your crops!', 'Build Scarecrows and Fences to protect crops.', 'Right-click animals to kill them for 10cr.', 'Crop-threatening animals glow red!', 'Storage is limited: 50 + 50 per Silo.', 'Inventory shows estimated total value.'] },
    { title: 'Tools & Energy', lines: ['Press T to toggle the Hoe tool:', 'Left-click near water: boost fertility +0.2', 'Right-click on crop: uproot (50% seed refund)', '', 'Energy (blue bar) powers auto-harvesters.', 'Solar Panels & Wind Turbines add energy & regen.'] },
    { title: 'Controls', lines: ['Mouse wheel: zoom in/out (0.1x-2.0x).', 'Right-click drag or Ctrl+drag: pan view.', 'Short right-click: upgrade building.', 'Shift+right-click: remove building.', 'Home key: reset zoom & pan.', 'Press H anytime to see this help again.'] }
  ];

  let state = STATE_READY;
  let credits = 100;
  let selectedCropIndex = 0;
  let selectedTool = TOOL_PLANT;
  let gameTime = 0;
  let dayCount = 0;

  // Effective grid rows (base + expansion)
  let gridRows = BASE_GRID_ROWS;
  // Per-tile soil quality (2D array matching farmGrid dimensions)
  let soilQuality = [];

  // Farm grid: each cell is null or { cropIndex, growthProgress, growthStage, plantAnim }
  let farmGrid = [];

  // Tile types: 2D array of TILE_FARMLAND / TILE_ROCK / TILE_WATER / TILE_SAND
  let tileTypes = [];

  // Per-tile fertility: 2D array of 0.0..1.0 values
  let tileFertility = [];

  // Hoed tiles: 2D array of booleans — true if hoe-fertilized for visual indicator
  let hoedTiles = [];

  // Buildings placed on the grid: 2D array (null or { typeIndex })
  let buildings = [];

  // Selected building index (-1 = none)
  let selectedBuildingIndex = -1;

  // Building auto-harvest timer
  let buildingHarvestTimer = 0;

  // Livestock pens: array of { typeIndex, feedTimer, produceReady, gridRow, gridCol }
  let livestockPens = [];

  // Price fluctuation: per-crop multiplier
  let priceMultipliers = [];
  let priceChangeTimer = 0;

  // Inventory: { cropName: count }
  let inventory = {};

  // Weather
  let weatherType = WEATHER_NONE;
  let weatherTimer = 0;
  let weatherInterval = 0;
  let weatherEffect = 0; // visual overlay alpha
  let overlayAlpha = 0;

  // Weather visual particle arrays (persistent across frames)
  let weatherParticles = [];

  // Upgrade shop
  let upgradeLevels = {}; // { upgradeId: level }
  let showUpgradeShop = false;
  let upgradeShopScroll = 0;

  // Livestock shop
  let showLivestockShop = false;
  let livestockShopScroll = 0;

  // Auto-harvest timer (ticks every second-ish based on upgrade level)
  let autoHarvestTimer = 0;

  // High scores
  let highScores = [];

  // Input
  const keys = {};

  // Seasons
  let currentSeason = 0; // index into SEASONS

  // Day/Night phase: 0..1 within each 30s game day
  let dayPhase = 0;

  // Animals (Feature 8)
  let wildAnimals = []; // {x, y, targetCol, targetRow, moveTimer, hp}
  let nextAnimalSpawn = 0;

  // Solar/Wind income timer (Feature 3)
  let buildingIncomeTimer = 0;

  // Energy system
  let energy = 100;
  const ENERGY_BASE_MAX = 100;
  const ENERGY_REGEN_BASE = 2; // per second

  let gridCols = GRID_COLS; // now mutable for east/west expansion
  let gridColOffset = 0; // tracks how many columns were added to the left (west)

  // Auto-planter timer
  let autoPlanterTimer = 0;

  // Cached shuffle arrays for auto-harvester/planter (re-randomize every 60s)
  let shuffleCacheTimer = 0;
  const SHUFFLE_CACHE_INTERVAL = 60;
  let cachedHarvestOrder = [];
  let cachedPlantOrder = [];

  // Auto-collector timer (for livestock produce)
  let autoCollectorTimer = 0;

  // Zoom & pan
  let viewZoom = 1.0;
  let viewPanX = 0;
  let viewPanY = 0;
  const VIEW_ZOOM_MIN = 0.1;
  const VIEW_ZOOM_MAX = 2.0;
  let isPanning = false;
  let panLastX = 0;
  let panLastY = 0;
  let panButton = -1; // which button started panning

  // Right-click pan vs. remove tracking (Feature 1)
  let rightClickStartX = 0;
  let rightClickStartY = 0;

  // Drag selection
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCurrentX = 0;
  let dragCurrentY = 0;
  let dragStartedOnGrid = false;

  // Tooltip
  let tooltipLines = [];
  let tooltipX = 0;
  let tooltipY = 0;

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    // Reset canvas size so it doesn't inflate parent measurement
    canvas.style.width = '0';
    canvas.style.height = '0';

    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    canvasW = Math.floor(rect.width) || 700;
    canvasH = Math.floor(rect.height) || 500;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

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

  function addHighScore(earned, days) {
    highScores.push({ credits: earned, days });
    highScores.sort((a, b) => b.credits - a.credits);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].credits}</td><td>${highScores[i].days}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  /* ── Upgrade Helpers ── */

  function getUpgradeLevel(id) {
    return upgradeLevels[id] || 0;
  }

  function getUpgradeCost(def, level) {
    return Math.round(def.baseCost * Math.pow(def.costScale, level));
  }

  function getGrowthSpeedMultiplier() {
    const base = 1 + getUpgradeLevel('growSpeed') * 0.25;
    const soil = 1 + getUpgradeLevel('soilQuality') * 0.15;
    return base * soil;
  }

  function getYieldMultiplier() {
    const lvl = getUpgradeLevel('yieldMultiplier');
    // level 1 = 1 extra 25% chance, level 5 = guaranteed double
    return 1 + lvl * 0.2;
  }

  function getWeatherResistance() {
    // Weather Shield: 0..3 => 0%, 25%, 50%, 75%
    // Irrigation: 0..3 => 0%, 15%, 30%, 45%
    // They stack multiplicatively: combined = 1 - (1 - shield) * (1 - irrigation)
    const shield = getUpgradeLevel('weatherResist') * 0.25;
    const irrigation = getUpgradeLevel('irrigation') * 0.15;
    return 1 - (1 - shield) * (1 - irrigation);
  }

  function getMarketPriceMultiplier() {
    return 1 + getUpgradeLevel('marketAccess') * 0.10;
  }

  function getTileSoilQuality(row, col) {
    let base;
    // Use per-tile fertility if available, fallback to row-based tiers
    if (col !== undefined && tileFertility[row] && tileFertility[row][col] !== undefined)
      base = tileFertility[row][col];
    else {
      const tierIdx = (row < BASE_GRID_ROWS) ? 0 : Math.min(SOIL_QUALITY_TIERS.length - 1, row - BASE_GRID_ROWS + 1);
      base = SOIL_QUALITY_TIERS[tierIdx];
    }

    let bonus = getUpgradeLevel('soilQuality') * 0.15;

    // Compost Bin bonus (scales with building level and range)
    if (col !== undefined) {
      for (let r2 = 0; r2 < gridRows; ++r2)
        for (let c2 = 0; c2 < gridCols; ++c2) {
          if (r2 === row && c2 === col) continue;
          const bld = buildings[r2]?.[c2];
          if (!bld) continue;
          const bdef = BUILDINGS[bld.typeIndex];
          if (bdef.name !== 'Compost Bin') continue;
          if (isInBuildingRange(bld, r2, c2, row, col))
            bonus += getCompostBinBonus(bld);
        }
    }

    return Math.min(1.5, base + bonus);
  }

  function getSiloBonusMultiplier() {
    let bonus = 0;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Silo')
          bonus += getSiloSellBonus(bld);
      }
    return 1 + bonus;
  }

  function getStorageCapacity() {
    let totalStorage = 50;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Silo')
          totalStorage += getSiloStorageBonus(bld);
      }
    return totalStorage;
  }

  function getTotalInventoryCount() {
    let total = 0;
    for (const key in inventory)
      total += inventory[key] || 0;
    return total;
  }

  function getSeasonGrowthMultiplier() {
    switch (currentSeason) {
      case 0: return 1.10; // Spring: +10%
      case 1: return 1.25; // Summer: +25%
      case 2: return 0.90; // Autumn: -10%
      case 3: return 0.60; // Winter: -40%
      default: return 1.0;
    }
  }

  function getSeasonHarvestMultiplier() {
    return currentSeason === 2 ? 1.15 : 1.0; // Autumn: +15% harvest
  }

  function getEffectiveSellPrice(crop) {
    const cropIdx = CROPS.indexOf(crop);
    const priceMult = (cropIdx >= 0 && cropIdx < priceMultipliers.length) ? priceMultipliers[cropIdx] : 1;
    return Math.round(crop.sellPrice * getMarketPriceMultiplier() * priceMult * getSiloBonusMultiplier());
  }

  function getEffectiveProduceValue(live) {
    return Math.round(live.produceValue * getMarketPriceMultiplier());
  }

  function getEnergyMax() {
    let total = ENERGY_BASE_MAX;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel')
          total += getSolarPanelEnergyBonus(bld);
        else if (bname === 'Wind Turbine')
          total += getWindTurbineEnergyBonus(bld);
      }
    return total;
  }

  function getEnergyRegenRate() {
    let rate = ENERGY_REGEN_BASE;
    const isNight = dayPhase >= 0.5;

    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel') {
          let bonus = getSolarPanelRegenBonus(bld);
          // Solar: 0 at night, double in summer, triple during solar flares
          if (isNight)
            bonus = 0;
          else {
            if (currentSeason === 1) bonus *= 2; // summer
            if (weatherType === WEATHER_SOLAR_FLARE) bonus *= 3;
          }
          rate += bonus;
        } else if (bname === 'Wind Turbine') {
          let bonus = getWindTurbineRegenBonus(bld);
          // Wind: +50% at night, double in autumn, triple during thunderstorms
          if (isNight) bonus *= 1.5;
          if (currentSeason === 2) bonus *= 2; // autumn
          if (weatherType === WEATHER_THUNDERSTORM) bonus *= 3;
          rate += bonus;
        }
      }
    return rate;
  }

  function getEstimatedStorageValue() {
    let totalValue = 0;
    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0)
        totalValue += count * getEffectiveSellPrice(crop);
    }
    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0)
        totalValue += count * getEffectiveProduceValue(live);
    }
    return totalValue;
  }

  function isAdjacentToWater(row, col) {
    if (row > 0 && tileTypes[row - 1]?.[col] === TILE_WATER) return true;
    if (row < gridRows - 1 && tileTypes[row + 1]?.[col] === TILE_WATER) return true;
    if (col > 0 && tileTypes[row]?.[col - 1] === TILE_WATER) return true;
    if (col < gridCols - 1 && tileTypes[row]?.[col + 1] === TILE_WATER) return true;
    return false;
  }

  function getAutoHarvestInterval() {
    const lvl = getUpgradeLevel('autoHarvest');
    if (lvl <= 0) return 0; // disabled
    // level 1 = every 5s, level 2 = every 3s, level 3 = every 1.5s
    return [0, 5, 3, 1.5][lvl] || 0;
  }

  /* ── Building Level Upgrade Helpers ── */

  function getBuildingUpgradeCost(bld) {
    const bdef = BUILDINGS[bld.typeIndex];
    return Math.round(bdef.cost * 0.5);
  }

  function canUpgradeBuilding(bld) {
    if (!bld) return false;
    return (bld.level || 1) < BUILDING_MAX_LEVEL;
  }

  function upgradeBuilding(row, col) {
    if (state !== STATE_PLAYING) return;
    const bld = buildings[row]?.[col];
    if (!bld || !canUpgradeBuilding(bld)) return;

    const cost = getBuildingUpgradeCost(bld);
    if (credits < cost) return;

    credits -= cost;
    bld.level = (bld.level || 1) + 1;

    const bdef = BUILDINGS[bld.typeIndex];
    const { x: tx, y: ty } = gridCenterToScreen(col, row);
    floatingText.add(tx, ty - 10, `${bdef.icon} L${bld.level}! -${cost}cr`, { color: '#0ff', font: 'bold 12px sans-serif' });
    particles.confetti(tx, ty, 10, { speed: 3 });
  }

  /** Get the effective range of a building based on its level. Base range + (level - 1). */
  function getBuildingRange(bld) {
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    // Silo and Fence have range 0 (global/self), no range scaling
    if (bdef.range === 0) return 0;
    return bdef.range + (lvl - 1);
  }

  /** Get the scarecrow scare radius in Chebyshev distance based on level. */
  function getScarecrowRadius(bld) {
    const lvl = bld.level || 1;
    // L1: 3x3 (radius 1), L2: 5x5 (radius 2), ..., L6: 13x13 (radius 6)
    return lvl;
  }

  /** Check if a tile (tr, tc) is within building range of building at (br, bc). */
  function isInBuildingRange(bld, br, bc, tr, tc) {
    const range = getBuildingRange(bld);
    return Math.abs(tr - br) <= range && Math.abs(tc - bc) <= range;
  }

  /** Get sprinkler growth bonus for a given level. */
  function getSprinklerBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +20%, L2: +24%, L3: +28%, L4: +32%, L5: +36%, L6: +40%
    return 0.20 + (lvl - 1) * 0.04;
  }

  /** Get wind turbine growth bonus for a given level. */
  function getWindTurbineGrowthBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +10%, L2: +15%, L3: +20%, L4: +25%, L5: +30%, L6: +35%
    return 0.10 + (lvl - 1) * 0.05;
  }

  /** Get compost bin fertility bonus for a given level. */
  function getCompostBinBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +25%, L2: +35%, L3: +45%, L4: +55%, L5: +65%, L6: +75%
    return 0.25 + (lvl - 1) * 0.10;
  }

  /** Get greenhouse growth bonus for a given level (small bonus on top of protection). */
  function getGreenhouseGrowthBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +5%, L2: +10%, L3: +15%, L4: +20%, L5: +25%, L6: +30%
    return (lvl - 1) * 0.05;
  }

  /** Get silo storage bonus for a given level. */
  function getSiloStorageBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +50, L2: +75, L3: +100, L4: +125, L5: +150, L6: +175
    return 50 + (lvl - 1) * 25;
  }

  /** Get silo sell bonus multiplier for a given level. */
  function getSiloSellBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +10%, L2: +12%, L3: +14%, L4: +16%, L5: +18%, L6: +20%
    return 0.10 + (lvl - 1) * 0.02;
  }

  /** Get solar panel max energy bonus per panel based on level. */
  function getSolarPanelEnergyBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +30, L2: +45, L3: +60, L4: +75, L5: +90, L6: +105
    return 30 + (lvl - 1) * 15;
  }

  /** Get solar panel income per cycle based on level. */
  function getSolarPanelIncome(bld) {
    const lvl = bld.level || 1;
    // L1: 2cr, L2: 3cr, L3: 4cr, L4: 5cr, L5: 6cr, L6: 7cr
    return 2 + (lvl - 1);
  }

  /** Get wind turbine income per cycle based on level. */
  function getWindTurbineIncome(bld) {
    const lvl = bld.level || 1;
    // L1: 5cr, L2: 7cr, L3: 9cr, L4: 11cr, L5: 13cr, L6: 15cr
    return 5 + (lvl - 1) * 2;
  }

  /** Get wind turbine max energy bonus per turbine based on level. */
  function getWindTurbineEnergyBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +20, L2: +40, L3: +60, L4: +80, L5: +100, L6: +120
    return 20 * lvl;
  }

  /** Get wind turbine energy regen bonus per turbine based on level. */
  function getWindTurbineRegenBonus(bld) {
    const lvl = bld.level || 1;
    // L1: +0.5, L2: +1.0, L3: +1.5, L4: +2.0, L5: +2.5, L6: +3.0
    return 0.5 * lvl;
  }

  /** Get solar panel energy regen bonus based on level. */
  function getSolarPanelRegenBonus(bld) {
    const lvl = bld.level || 1;
    // L1: 1.0, L2: 1.4, L3: 1.8, L4: 2.2, L5: 2.6, L6: 3.0
    return 1.0 + (lvl - 1) * 0.4;
  }

  /** Get harvester interval based on level. */
  function getHarvesterInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 2s, L2: 1.6s, L3: 1.2s, L4: 0.9s, L5: 0.7s, L6: 0.5s
    return [2.0, 2.0, 1.6, 1.2, 0.9, 0.7, 0.5][lvl] || 2.0;
  }

  /** Get auto-collector interval based on level. */
  function getAutoCollectorInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 8s, L2: 5s, L3: 3s, L4: 2s, L5: 1.5s, L6: 1s
    return [8, 8, 5, 3, 2, 1.5, 1][lvl] || 8;
  }

  /** Get auto-planter interval based on level. */
  function getAutoPlanterInterval(bld) {
    const lvl = bld.level || 1;
    // L1: 15s, L2: 12s, L3: 9s, L4: 7s, L5: 5s, L6: 3s
    return [15, 15, 12, 9, 7, 5, 3][lvl] || 15;
  }

  /** Find the fastest harvester interval on the grid (for the shared timer). */
  function getMinHarvesterInterval() {
    let minInterval = Infinity;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (bld && BUILDINGS[bld.typeIndex].name === 'Harvester')
          minInterval = Math.min(minInterval, getHarvesterInterval(bld));
      }
    return minInterval === Infinity ? 0 : minInterval;
  }

  function purchaseUpgrade(upgradeIndex) {
    if (state !== STATE_PLAYING) return;
    const def = UPGRADES[upgradeIndex];
    const curLevel = getUpgradeLevel(def.id);
    if (curLevel >= def.maxLevel) return;

    let cost;
    if (def.id === 'plotExpansion') {
      // Price based on number of new tiles: full ring around current grid
      const newTiles = 2 * gridRows + 2 * gridCols + 4;
      cost = newTiles * 8;
    } else
      cost = getUpgradeCost(def, curLevel);

    if (credits < cost) return;

    credits -= cost;
    upgradeLevels[def.id] = curLevel + 1;
    floatingText.add(canvasW / 2, canvasH / 2 - 30, `${def.icon} ${def.name} Lv${curLevel + 1}!`, { color: '#0ff', font: 'bold 14px sans-serif' });
    particles.confetti(canvasW / 2, canvasH / 2, 15, { speed: 4 });

    if (def.id === 'plotExpansion')
      expandGrid();
  }

  /** WFC-inspired tile generation: weighted random based on neighbor types. */
  function wfcTileType(neighbors) {
    // Count neighbor types
    let waterCount = 0, rockCount = 0, sandCount = 0, farmCount = 0;
    for (const n of neighbors) {
      if (n === TILE_WATER) ++waterCount;
      else if (n === TILE_ROCK) ++rockCount;
      else if (n === TILE_SAND) ++sandCount;
      else ++farmCount;
    }
    const total = neighbors.length || 1;

    // Weighted probabilities based on adjacency
    let wWater = 0.06 + (waterCount / total) * 0.45;
    let wRock = 0.05 + (rockCount / total) * 0.40;
    let wSand = 0.08 + (sandCount / total) * 0.35;
    // Sand also appears near water edges
    if (waterCount > 0 && sandCount === 0) wSand += 0.15;
    let wFarm = 1 - wWater - wRock - wSand;
    if (wFarm < 0.2) wFarm = 0.2;

    // Normalize
    const sum = wWater + wRock + wSand + wFarm;
    wWater /= sum;
    wRock /= sum;
    wSand /= sum;

    const roll = Math.random();
    if (roll < wWater) return TILE_WATER;
    if (roll < wWater + wRock) return TILE_ROCK;
    if (roll < wWater + wRock + wSand) return TILE_SAND;
    return TILE_FARMLAND;
  }

  /** Collect existing neighbor tile types for a position (row, col). */
  function getNeighborTypes(row, col) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; ++dr)
      for (let dc = -1; dc <= 1; ++dc) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && tileTypes[nr]?.[nc] !== undefined)
          neighbors.push(tileTypes[nr][nc]);
      }
    return neighbors;
  }

  function makeExpansionFertility(tileType) {
    let fert = 0.5 + Math.random() * 0.5;
    if (tileType === TILE_SAND) fert *= 0.7;
    // Expansion tiles start with slightly lower base fertility
    fert *= 0.75;
    return fert;
  }

  function expandGrid() {
    // Expand all 4 sides simultaneously — add a full ring around the grid

    // South: add row at bottom
    const southRow = [];
    const southType = [];
    const southFert = [];
    const southBuild = [];
    for (let c = 0; c < gridCols; ++c) {
      southRow.push(null);
      southBuild.push(null);
      const neighbors = getNeighborTypes(gridRows, c);
      const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
      southType.push(tt);
      southFert.push(makeExpansionFertility(tt));
    }
    farmGrid.push(southRow);
    tileTypes.push(southType);
    tileFertility.push(southFert);
    hoedTiles.push(new Array(gridCols).fill(false));
    buildings.push(southBuild);
    ++gridRows;
    soilQuality.push(getTileSoilQuality(gridRows - 1));

    // North: add row at top
    const northRow = [];
    const northType = [];
    const northFert = [];
    const northBuild = [];
    for (let c = 0; c < gridCols; ++c) {
      northRow.push(null);
      northBuild.push(null);
      const neighbors = [];
      if (tileTypes[0]?.[c] !== undefined) neighbors.push(tileTypes[0][c]);
      if (c > 0 && northType[c - 1] !== undefined) neighbors.push(northType[c - 1]);
      const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
      northType.push(tt);
      northFert.push(makeExpansionFertility(tt));
    }
    farmGrid.unshift(northRow);
    tileTypes.unshift(northType);
    tileFertility.unshift(northFert);
    hoedTiles.unshift(new Array(gridCols).fill(false));
    buildings.unshift(northBuild);
    ++gridRows;
    soilQuality.unshift(getTileSoilQuality(0));
    for (const animal of wildAnimals) ++animal.y;
    for (const pen of livestockPens) ++pen.gridRow;

    // West: add column at left (for each row including the new top/bottom)
    for (let r = 0; r < gridRows; ++r) {
      const neighbors = [];
      if (tileTypes[r]?.[0] !== undefined) neighbors.push(tileTypes[r][0]);
      if (r > 0 && tileTypes[r - 1]?.[0] !== undefined) neighbors.push(tileTypes[r - 1][0]);
      const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
      farmGrid[r].unshift(null);
      tileTypes[r].unshift(tt);
      tileFertility[r].unshift(makeExpansionFertility(tt));
      if (hoedTiles[r]) hoedTiles[r].unshift(false);
      buildings[r].unshift(null);
    }
    ++gridCols;
    ++gridColOffset;
    for (const animal of wildAnimals) ++animal.x;
    for (const pen of livestockPens) ++pen.gridCol;

    // East: add column at right
    for (let r = 0; r < gridRows; ++r) {
      const neighbors = [];
      const lastC = gridCols - 1;
      if (tileTypes[r]?.[lastC] !== undefined) neighbors.push(tileTypes[r][lastC]);
      if (r > 0 && tileTypes[r - 1]?.[lastC] !== undefined) neighbors.push(tileTypes[r - 1][lastC]);
      const tt = neighbors.length > 0 ? wfcTileType(neighbors) : TILE_FARMLAND;
      farmGrid[r].push(null);
      tileTypes[r].push(tt);
      tileFertility[r].push(makeExpansionFertility(tt));
      if (hoedTiles[r]) hoedTiles[r].push(false);
      buildings[r].push(null);
    }
    ++gridCols;

    // Refresh shuffle cache since grid dimensions changed
    refreshShuffleCache();
  }

  function resetGame() {
    credits = 100;
    selectedCropIndex = 0;
    selectedTool = TOOL_PLANT;
    gameTime = 0;
    dayCount = 1;
    inventory = {};

    // Reset upgrades
    upgradeLevels = {};
    showUpgradeShop = false;
    upgradeShopScroll = 0;
    showLivestockShop = false;
    livestockShopScroll = 0;
    autoHarvestTimer = 0;
    autoCollectorTimer = 0;

    // Reset grid to base size
    gridRows = BASE_GRID_ROWS;
    gridCols = GRID_COLS;
    gridColOffset = 0;

    // Energy reset
    energy = 100;

    // Auto-planter reset
    autoPlanterTimer = 0;

    // Shuffle cache reset
    shuffleCacheTimer = 0;
    cachedHarvestOrder = [];
    cachedPlantOrder = [];

    // Initialize empty farm grid with soil quality and tile types
    farmGrid = [];
    soilQuality = [];
    tileTypes = [];
    tileFertility = [];
    hoedTiles = [];
    buildings = [];
    selectedBuildingIndex = -1;
    buildingHarvestTimer = 0;

    // Generate tile types with natural clustering
    for (let r = 0; r < gridRows; ++r) {
      const row = [];
      tileTypes[r] = [];
      tileFertility[r] = [];
      hoedTiles[r] = [];
      buildings[r] = [];
      for (let c = 0; c < gridCols; ++c) {
        row.push(null); // empty tile
        buildings[r][c] = null;
        hoedTiles[r][c] = false;

        const noise = Math.random();
        // Check neighbors for clustering
        const leftType = c > 0 ? tileTypes[r][c - 1] : TILE_FARMLAND;
        const topType = r > 0 ? tileTypes[r - 1][c] : TILE_FARMLAND;
        if (noise < 0.08 || (leftType === TILE_ROCK && noise < 0.3) || (topType === TILE_ROCK && noise < 0.3))
          tileTypes[r][c] = TILE_ROCK;
        else if (noise < 0.12 || (leftType === TILE_WATER && noise < 0.25))
          tileTypes[r][c] = TILE_WATER;
        else if (noise < 0.18 || (leftType === TILE_SAND && noise < 0.35) || (topType === TILE_SAND && noise < 0.35))
          tileTypes[r][c] = TILE_SAND;
        else
          tileTypes[r][c] = TILE_FARMLAND;

        // Per-tile fertility
        let fert = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
        if (tileTypes[r][c] === TILE_SAND) fert *= 0.7;
        // Apply row-based tier penalty for expansion rows
        const tierPenalty = (r < BASE_GRID_ROWS) ? 1.0 : (SOIL_QUALITY_TIERS[r - BASE_GRID_ROWS + 1] || SOIL_QUALITY_TIERS[SOIL_QUALITY_TIERS.length - 1]);
        fert *= tierPenalty;
        tileFertility[r][c] = fert;
      }
      farmGrid.push(row);
      soilQuality.push(getTileSoilQuality(r));
    }

    // Start with no livestock
    livestockPens = [];

    // Weather reset
    weatherType = WEATHER_NONE;
    weatherTimer = 0;
    weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
    overlayAlpha = 0;
    weatherParticles = [];

    // Price fluctuation reset
    priceMultipliers = [];
    for (let i = 0; i < CROPS.length; ++i)
      priceMultipliers.push(1.0);
    priceChangeTimer = PRICE_CHANGE_INTERVAL;

    // Zoom & pan reset
    viewZoom = 1.0;
    viewPanX = 0;
    viewPanY = 0;
    isPanning = false;
    panButton = -1;

    // Season & day/night reset
    currentSeason = 0;
    dayPhase = 0;

    // Animals reset
    wildAnimals = [];
    nextAnimalSpawn = ANIMAL_SPAWN_MIN + Math.random() * (ANIMAL_SPAWN_MAX - ANIMAL_SPAWN_MIN);

    // Building income timer reset
    buildingIncomeTimer = 0;

    state = STATE_PLAYING;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     FARM GRID OPERATIONS
     ══════════════════════════════════════════════════════════════════ */

  function gridToScreen(col, row) {
    const ts = BASE_TILE_SIZE * viewZoom;
    return {
      x: (GRID_OFFSET_X + col * BASE_TILE_SIZE) * viewZoom + viewPanX,
      y: (GRID_OFFSET_Y + row * BASE_TILE_SIZE) * viewZoom + viewPanY,
      size: ts
    };
  }

  function gridCenterToScreen(col, row) {
    const g = gridToScreen(col, row);
    return { x: g.x + g.size / 2, y: g.y + g.size / 2 };
  }

  function plantCrop(row, col) {
    if (state !== STATE_PLAYING) return;
    const tt = tileTypes[row]?.[col];
    if (tt === TILE_WATER || tt === TILE_ROCK) return;
    if (buildings[row]?.[col]) return; // tile has a building
    if (farmGrid[row][col] !== null) return; // not empty
    const crop = CROPS[selectedCropIndex];
    if (credits < crop.seedCost) return;

    credits -= crop.seedCost;
    farmGrid[row][col] = {
      cropIndex: selectedCropIndex,
      growthProgress: 0,
      growthStage: 0,
      plantAnim: 1.0 // plantAnim scale bounce
    };

    // Planting animation: seed sparkle + water droplet splash
    const { x: tx, y: ty } = gridCenterToScreen(col, row);
    particles.sparkle(tx, ty, 6, { color: crop.color, speed: 2 });
    // Water droplet splash effect
    for (let i = 0; i < 5; ++i) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const v = 1.5 + Math.random() * 2;
      particles.trail(tx + (Math.random() - 0.5) * 10, ty, {
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 1,
        color: '#4af',
        life: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 2,
        gravity: 0.15,
        decay: 0.03
      });
    }
    floatingText.add(tx, ty - 10, `-${crop.seedCost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
  }

  function harvestCrop(row, col) {
    if (state !== STATE_PLAYING) return;
    const cell = farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const maxStage = crop.stages - 1;
    if (cell.growthStage < maxStage) return; // not mature yet

    const { x: tx, y: ty } = gridCenterToScreen(col, row);

    // Check storage capacity (Feature 7)
    if (getTotalInventoryCount() >= getStorageCapacity()) {
      floatingText.add(tx, ty - 10, 'Storage Full!', { color: '#f44', font: 'bold 13px sans-serif' });
      return;
    }

    // Enhanced harvest: golden burst + crop-colored sparkle ring (scaled with zoom)
    if (viewZoom >= 0.5) {
      particles.burst(tx, ty, Math.ceil(10 * viewZoom), { color: '#fd0', speed: 3.5, life: 0.7, gravity: 0.05 });
      particles.burst(tx, ty, Math.ceil(6 * viewZoom), { color: crop.color, speed: 2, life: 0.5 });
      // Rising golden sparkles
      const trailCount = Math.ceil(4 * viewZoom);
      for (let i = 0; i < trailCount; ++i)
        particles.trail(tx + (Math.random() - 0.5) * 16, ty, {
          vx: (Math.random() - 0.5) * 1,
          vy: -1.5 - Math.random() * 2,
          color: '#ff0',
          size: 2 + Math.random(),
          life: 0.5 + Math.random() * 0.3,
          decay: 0.03,
          shape: 'star'
        });
    }

    // Yield multiplier: chance for bonus crops + season harvest bonus
    const yieldMul = getYieldMultiplier() * getSeasonHarvestMultiplier();
    let harvestCount = 1;
    const bonusChance = yieldMul - 1; // 0..1+
    if (bonusChance > 0 && Math.random() < bonusChance)
      ++harvestCount;

    if (!inventory[crop.name])
      inventory[crop.name] = 0;
    inventory[crop.name] += harvestCount;

    const label = harvestCount > 1 ? `+${harvestCount} ${crop.name}!` : `+1 ${crop.name}`;
    const labelColor = harvestCount > 1 ? '#ff0' : '#0f0';
    floatingText.add(tx, ty - 10, label, { color: labelColor, font: 'bold 12px sans-serif' });

    farmGrid[row][col] = null; // clear tile
  }

  /** Hoe a single tile: boost fertility +0.2 (cap 1.5). Returns true if tile was fertilized. */
  function hoeFertilizeTile(row, col) {
    const tt = tileTypes[row]?.[col];
    if (tt === undefined || tt === TILE_WATER || tt === TILE_ROCK) return false;
    // Hoeing sand converts it to farmland
    if (tt === TILE_SAND) {
      tileTypes[row][col] = TILE_FARMLAND;
      const { x: tx, y: ty } = gridCenterToScreen(col, row);
      floatingText.add(tx, ty - 20, 'Soil improved!', { color: '#a84', font: 'bold 10px sans-serif' });
    }
    if (buildings[row]?.[col]) return false;
    const curFert = tileFertility[row]?.[col] ?? 0.5;
    const newFert = Math.min(1.5, curFert + 0.2);
    if (newFert <= curFert) return false;
    tileFertility[row][col] = newFert;
    if (hoedTiles[row])
      hoedTiles[row][col] = true;
    const { x: tx, y: ty } = gridCenterToScreen(col, row);
    floatingText.add(tx, ty - 10, `+Fertility (${Math.round(newFert * 100)}%)`, { color: '#4d4', font: 'bold 11px sans-serif' });
    particles.sparkle(tx, ty, 5, { color: '#4a2', speed: 1.5 });
    return true;
  }

  /** Hoe left-click: clicking water fertilizes all 8 surrounding tiles; clicking land adjacent to water fertilizes that tile. */
  function hoeFertilize(row, col) {
    if (state !== STATE_PLAYING) return;
    const tt = tileTypes[row]?.[col];

    if (tt === TILE_WATER) {
      // Fertilize all 8 neighbors around the water tile
      for (let dr = -1; dr <= 1; ++dr)
        for (let dc = -1; dc <= 1; ++dc) {
          if (dr === 0 && dc === 0) continue;
          hoeFertilizeTile(row + dr, col + dc);
        }
      return;
    }

    if (tt === TILE_ROCK) return;
    if (!isAdjacentToWater(row, col)) return;
    hoeFertilizeTile(row, col);
  }

  /** Hoe right-click: uproot/remove a plant, returning partial seed cost. */
  function hoeUproot(row, col) {
    if (state !== STATE_PLAYING) return;
    const cell = farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const refund = Math.floor(crop.seedCost * 0.5);
    credits += refund;
    farmGrid[row][col] = null;

    const { x: tx, y: ty } = gridCenterToScreen(col, row);
    floatingText.add(tx, ty - 10, `Uprooted! +${refund}cr`, { color: '#fa0', font: 'bold 11px sans-serif' });
    particles.burst(tx, ty, 6, { color: '#a62', speed: 2, life: 0.4 });
  }

  /* ══════════════════════════════════════════════════════════════════
     CROP GROWTH
     ══════════════════════════════════════════════════════════════════ */

  function updateCrops(dt) {
    if (state !== STATE_PLAYING) return;

    // Base growth multiplier from weather
    let weatherGrowthBoost = 1;
    if (weatherType === WEATHER_SOLAR_FLARE)
      weatherGrowthBoost = 2;
    else if (weatherType === WEATHER_RAIN)
      weatherGrowthBoost = 1.5;
    else if (weatherType === WEATHER_THUNDERSTORM)
      weatherGrowthBoost = 2;

    // Upgrade growth speed multiplier
    const upgradeGrowthMul = getGrowthSpeedMultiplier();

    for (let r = 0; r < gridRows; ++r) {
      for (let c = 0; c < gridCols; ++c) {
        const cell = farmGrid[r][c];
        if (!cell) continue;

        const crop = CROPS[cell.cropIndex];
        const maxStage = crop.stages - 1;

        // Per-crop weather affinity modifier
        let cropWeatherMul = weatherGrowthBoost;
        if (crop.weatherAffinity === 'any')
          cropWeatherMul = Math.max(1, weatherGrowthBoost); // never penalized
        else if (crop.weatherAffinity === 'solar' && weatherType === WEATHER_SOLAR_FLARE)
          cropWeatherMul = 3; // extra solar bonus
        else if (crop.weatherAffinity === 'cold-vulnerable' && weatherType === WEATHER_METEOR_SHOWER)
          cropWeatherMul = 0.3; // growth slows in cold

        // Per-tile fertility (replaces row-based soil quality)
        const tileSoil = getTileSoilQuality(r, c);

        // Tile type modifier: sand = 0.7x growth
        let tileTypeMul = 1.0;
        if (tileTypes[r]?.[c] === TILE_SAND) tileTypeMul = 0.7;

        // Water adjacency bonus: +0.15 per adjacent water tile
        let waterBonus = 0;
        if (r > 0 && tileTypes[r - 1]?.[c] === TILE_WATER) waterBonus += 0.15;
        if (r < gridRows - 1 && tileTypes[r + 1]?.[c] === TILE_WATER) waterBonus += 0.15;
        if (c > 0 && tileTypes[r]?.[c - 1] === TILE_WATER) waterBonus += 0.15;
        if (c < gridCols - 1 && tileTypes[r]?.[c + 1] === TILE_WATER) waterBonus += 0.15;

        // Sprinkler bonus, Wind Turbine bonus, and Greenhouse growth bonus (all scale with level and range)
        let sprinklerBonus = 0;
        let windTurbineBonus = 0;
        let greenhouseBonus = 0;
        for (let br = 0; br < gridRows; ++br)
          for (let bc = 0; bc < gridCols; ++bc) {
            if (br === r && bc === c) continue;
            const adjBld = buildings[br]?.[bc];
            if (!adjBld) continue;
            const bdef = BUILDINGS[adjBld.typeIndex];
            if (bdef.name === 'Sprinkler' && isInBuildingRange(adjBld, br, bc, r, c))
              sprinklerBonus += getSprinklerBonus(adjBld);
            else if (bdef.name === 'Wind Turbine' && isInBuildingRange(adjBld, br, bc, r, c))
              windTurbineBonus += getWindTurbineGrowthBonus(adjBld);
            else if (bdef.name === 'Greenhouse' && isInBuildingRange(adjBld, br, bc, r, c))
              greenhouseBonus += getGreenhouseGrowthBonus(adjBld);
          }

        // Season growth modifier (Feature 5)
        const seasonMul = getSeasonGrowthMultiplier();

        // Day/night crop restrictions (Feature 6)
        const isNight = dayPhase >= 0.5;
        if (crop.nightOnly && !isNight) continue; // nightOnly crops skip during day
        if (crop.dayOnly && isNight) continue;     // dayOnly crops skip during night

        // Winter: Astral Flower and some crops won't grow
        if (currentSeason === 3 && (crop.name === 'Astral Flower' || crop.dayOnly)) continue;

        // Advance growth progress (soil quality, tile type, water/sprinkler/wind/greenhouse bonuses are multiplicative/additive)
        cell.growthProgress += (dt / crop.growTime) * cropWeatherMul * upgradeGrowthMul * tileSoil * tileTypeMul * seasonMul * (1 + waterBonus + sprinklerBonus + windTurbineBonus + greenhouseBonus);

        // Check stage advancement
        const newStage = Math.min(maxStage, Math.floor(cell.growthProgress * crop.stages));
        if (newStage > cell.growthStage) {
          cell.growthStage = newStage;
          // Enhanced growth particles: green sparkles rising (scaled with zoom)
          if (viewZoom >= 0.5) {
            const { x: tx, y: ty } = gridCenterToScreen(c, r);
            particles.sparkle(tx, ty, Math.ceil(4 * viewZoom), { color: crop.color, speed: 1.5 });
            const trailCount = Math.ceil(3 * viewZoom);
            for (let p = 0; p < trailCount; ++p)
              particles.trail(tx + (Math.random() - 0.5) * 12, ty + 5, {
                vx: (Math.random() - 0.5) * 0.5,
                vy: -1 - Math.random() * 1.5,
                color: '#4f4',
                size: 1.5 + Math.random(),
                life: 0.4 + Math.random() * 0.3,
                decay: 0.03,
                shape: 'star'
              });
          }
        }

        // Plant animation decay
        if (cell.plantAnim > 0)
          cell.plantAnim = Math.max(0, cell.plantAnim - dt * 3);
      }
    }

    // Auto-harvest upgrade (uses energy: 1 per harvest, speed scales with energy)
    const autoInterval = getAutoHarvestInterval();
    if (autoInterval > 0) {
      // Scale speed with energy: below 20% energy, auto-harvest slows to 3x interval
      const energyFraction = energy / getEnergyMax();
      const effectiveInterval = energyFraction < 0.2 ? autoInterval * 3 : autoInterval;
      autoHarvestTimer += dt;
      if (autoHarvestTimer >= effectiveInterval) {
        autoHarvestTimer -= effectiveInterval;
        if (energy >= 1) {
          energy -= 1;
          autoHarvestOneCrop();
        }
      }
    }

    // Building Harvester: auto-harvest crops in range (interval and range scale with level)
    buildingHarvestTimer += dt;
    const minHarvesterInterval = getMinHarvesterInterval();
    if (minHarvesterInterval > 0 && buildingHarvestTimer >= minHarvesterInterval) {
      buildingHarvestTimer -= minHarvesterInterval;
      for (let r = 0; r < gridRows; ++r)
        for (let c = 0; c < gridCols; ++c) {
          const hBld = buildings[r]?.[c];
          if (!hBld) continue;
          if (BUILDINGS[hBld.typeIndex].name !== 'Harvester') continue;
          // Check if this harvester's interval has elapsed (for mixed-level harvesters, use fastest)
          const range = getBuildingRange(hBld);
          for (let dr = -range; dr <= range; ++dr)
            for (let dc = -range; dc <= range; ++dc) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
                const adjCell = farmGrid[nr][nc];
                if (adjCell && adjCell.growthStage >= CROPS[adjCell.cropIndex].stages - 1) {
                  if (energy >= 1) {
                    energy -= 1;
                    harvestCrop(nr, nc);
                  }
                }
              }
            }
        }
    }
  }

  /** Auto-harvest a mature crop using cached shuffle order for even distribution. */
  function autoHarvestOneCrop() {
    if (!cachedHarvestOrder.length)
      refreshShuffleCache();
    for (const { r, c } of cachedHarvestOrder) {
      if (r >= gridRows || c >= gridCols) continue;
      const cell = farmGrid[r]?.[c];
      if (!cell) continue;
      if (cell.growthStage >= CROPS[cell.cropIndex].stages - 1) {
        harvestCrop(r, c);
        return;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LIVESTOCK
     ══════════════════════════════════════════════════════════════════ */

  function updateLivestock(dt) {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];
      pen.feedTimer -= dt;
      if (pen.feedTimer <= 0)
        pen.produceReady = true;
    }
  }

  function feedAndCollect(penIndex) {
    if (state !== STATE_PLAYING) return;
    const pen = livestockPens[penIndex];
    if (!pen || !pen.produceReady) return;

    const def = LIVESTOCK[pen.typeIndex];
    pen.produceReady = false;
    pen.feedTimer = def.feedInterval;

    // Collect produce
    if (!inventory[def.produce])
      inventory[def.produce] = 0;
    ++inventory[def.produce];

    const scr = livestockPenToScreen(pen);
    floatingText.add(scr.x, scr.y - 10, `+1 ${def.produce}`, { color: '#0f0', font: 'bold 12px sans-serif' });
    particles.sparkle(scr.x, scr.y, 5, { color: def.color, speed: 1.5 });
  }

  /** Generate all perimeter positions around the current grid (one tile outside). */
  function getPerimeterPositions() {
    const positions = [];
    // Bottom edge: row = gridRows, col = -1..gridCols
    for (let c = -1; c <= gridCols; ++c)
      positions.push({ gridRow: gridRows, gridCol: c });
    // Right edge: col = gridCols, row = gridRows-1 down to -1
    for (let r = gridRows - 1; r >= -1; --r)
      positions.push({ gridRow: r, gridCol: gridCols });
    // Top edge: row = -1, col = gridCols-1 down to -1
    for (let c = gridCols - 1; c >= -1; --c)
      positions.push({ gridRow: -1, gridCol: c });
    // Left edge: col = -1, row = 0 up to gridRows-1
    for (let r = 0; r < gridRows; ++r)
      positions.push({ gridRow: r, gridCol: -1 });
    return positions;
  }

  /** Find the next available perimeter slot for a livestock pen. */
  function findNextPerimeterSlot() {
    const positions = getPerimeterPositions();
    for (const pos of positions) {
      const occupied = livestockPens.some(p => p.gridRow === pos.gridRow && p.gridCol === pos.gridCol);
      if (!occupied)
        return pos;
    }
    return null; // all perimeter slots full
  }

  /** Convert a livestock pen's grid position to screen coordinates (center of pen tile). */
  function livestockPenToScreen(pen) {
    const ts = BASE_TILE_SIZE * viewZoom;
    return {
      x: (GRID_OFFSET_X + pen.gridCol * BASE_TILE_SIZE) * viewZoom + viewPanX + ts / 2,
      y: (GRID_OFFSET_Y + pen.gridRow * BASE_TILE_SIZE) * viewZoom + viewPanY + ts / 2,
      size: ts
    };
  }

  /** Relocate all livestock pens to stay on the current grid perimeter after expansion. */
  function relocateLivestockToPerimeter() {
    const positions = getPerimeterPositions();
    let slotIdx = 0;
    for (const pen of livestockPens) {
      // Check if pen is still on the perimeter
      const onPerimeter = pen.gridRow === -1 || pen.gridRow === gridRows ||
                          pen.gridCol === -1 || pen.gridCol === gridCols;
      if (!onPerimeter) {
        // Find next available perimeter slot
        while (slotIdx < positions.length) {
          const pos = positions[slotIdx];
          const occupied = livestockPens.some(p => p !== pen && p.gridRow === pos.gridRow && p.gridCol === pos.gridCol);
          if (!occupied) {
            pen.gridRow = pos.gridRow;
            pen.gridCol = pos.gridCol;
            ++slotIdx;
            break;
          }
          ++slotIdx;
        }
      }
    }
  }

  function buyLivestock(typeIndex) {
    if (state !== STATE_PLAYING) return;
    const def = LIVESTOCK[typeIndex];
    if (credits < def.cost) return;

    const slot = findNextPerimeterSlot();
    if (!slot) {
      floatingText.add(canvasW / 2, canvasH / 2 - 20, 'No perimeter space!', { color: '#f44', font: 'bold 13px sans-serif' });
      return;
    }

    credits -= def.cost;
    livestockPens.push({
      typeIndex,
      feedTimer: def.feedInterval,
      produceReady: false,
      gridRow: slot.gridRow,
      gridCol: slot.gridCol
    });

    const scr = livestockPenToScreen(livestockPens[livestockPens.length - 1]);
    floatingText.add(scr.x, scr.y - 15, `-${def.cost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
  }

  /* ══════════════════════════════════════════════════════════════════
     SHOP — SELL & BUY
     ══════════════════════════════════════════════════════════════════ */

  function sellAllProduce() {
    if (state !== STATE_PLAYING) return;
    let totalEarned = 0;

    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0) {
        const earned = count * getEffectiveSellPrice(crop);
        credits += earned;
        totalEarned += earned;
        delete inventory[crop.name];
      }
    }

    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0) {
        const earned = count * getEffectiveProduceValue(live);
        credits += earned;
        totalEarned += earned;
        delete inventory[live.produce];
      }
    }

    if (totalEarned > 0) {
      floatingText.add(canvasW / 2, canvasH / 2 - 20, `+${totalEarned} credits`, { color: '#ff0', font: 'bold 16px sans-serif' });
      screenShake.trigger(3, 150);
    }
  }

  function buySeed(cropIndex) {
    if (state !== STATE_PLAYING) return;
    selectedCropIndex = cropIndex;
    selectedTool = TOOL_PLANT;
  }

  function placeBuilding(row, col) {
    if (state !== STATE_PLAYING) return;
    if (selectedBuildingIndex < 0 || selectedBuildingIndex >= BUILDINGS.length) return;
    const tt = tileTypes[row]?.[col];
    if (tt === TILE_WATER) return;
    if (buildings[row]?.[col]) return; // already has a building

    const bdef = BUILDINGS[selectedBuildingIndex];
    if (credits < bdef.cost) return;

    // Destroy existing crop if any
    if (farmGrid[row][col] !== null) {
      farmGrid[row][col] = null;
      const { x: dx, y: dy } = gridCenterToScreen(col, row);
      floatingText.add(dx, dy - 20, 'Crop removed', { color: '#f84', font: '9px sans-serif' });
    }

    credits -= bdef.cost;
    buildings[row][col] = { typeIndex: selectedBuildingIndex, level: 1 };

    const { x: tx, y: ty } = gridCenterToScreen(col, row);
    particles.sparkle(tx, ty, 8, { color: '#0ff', speed: 2 });
    floatingText.add(tx, ty - 10, `-${bdef.cost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
  }

  function removeBuilding(row, col) {
    if (state !== STATE_PLAYING) return;
    if (!buildings[row]?.[col]) return;
    const bdef = BUILDINGS[buildings[row][col].typeIndex];
    buildings[row][col] = null;
    const { x: tx, y: ty } = gridCenterToScreen(col, row);
    floatingText.add(tx, ty - 10, `Removed ${bdef.name}`, { color: '#fa0', font: 'bold 11px sans-serif' });
  }

  /* ══════════════════════════════════════════════════════════════════
     WEATHER EVENTS
     ══════════════════════════════════════════════════════════════════ */

  function updateWeather(dt) {
    if (state !== STATE_PLAYING) return;

    if (weatherType === WEATHER_NONE) {
      weatherInterval -= dt;
      if (weatherInterval <= 0)
        triggerWeather();
    } else {
      weatherTimer -= dt;
      overlayAlpha = Math.min(0.3, overlayAlpha + dt * 0.5);

      if (weatherTimer <= 0) {
        weatherType = WEATHER_NONE;
        overlayAlpha = 0;
        weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
      }
    }
  }

  function triggerWeather() {
    // No weather events in Winter (Feature 5)
    if (currentSeason === 3) {
      weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
      return;
    }

    // Spawn persistent weather particles
    weatherParticles = [];

    // 4-way weather: solar flare 30% (45% summer), meteor shower 25%, rain 30%, thunderstorm 15%
    const roll = Math.random();
    const solarChance = currentSeason === 1 ? 0.45 : 0.30;
    const meteorChance = solarChance + 0.25;
    const rainChance = meteorChance + 0.30;

    if (roll < solarChance) {
      weatherType = WEATHER_SOLAR_FLARE;
      floatingText.add(canvasW / 2, 30, 'SOLAR FLARE -- Growth Boost!', { color: '#ff0', font: 'bold 14px sans-serif' });
      // Seed solar glow particles
      for (let i = 0; i < 25; ++i)
        weatherParticles.push({
          x: Math.random() * canvasW,
          y: Math.random() * canvasH,
          size: 3 + Math.random() * 6,
          speed: 0.3 + Math.random() * 0.5,
          phase: Math.random() * TWO_PI,
          drift: (Math.random() - 0.5) * 0.3
        });
    } else if (roll < meteorChance) {
      weatherType = WEATHER_METEOR_SHOWER;
      floatingText.add(canvasW / 2, 30, 'METEOR SHOWER -- Crop Damage!', { color: '#f44', font: 'bold 14px sans-serif' });

      // Seed meteor rain particles
      for (let i = 0; i < 40; ++i)
        weatherParticles.push({
          x: Math.random() * canvasW,
          y: -Math.random() * canvasH,
          vx: -1 - Math.random() * 2,
          vy: 3 + Math.random() * 5,
          size: 2 + Math.random() * 3,
          trail: 8 + Math.random() * 12
        });

      // Meteor damage with weather resistance, affinity, and Greenhouse protection
      const resist = getWeatherResistance();
      const baseDamageChance = 0.2;
      for (let r = 0; r < gridRows; ++r) {
        for (let c = 0; c < gridCols; ++c) {
          const cell = farmGrid[r][c];
          if (!cell) continue;
          const crop = CROPS[cell.cropIndex];
          // 'any' affinity crops are immune to meteor destruction
          if (crop.weatherAffinity === 'any') continue;

          // Check for Greenhouse protection (range scales with level)
          let greenhouseProtected = false;
          for (let gr = 0; gr < gridRows && !greenhouseProtected; ++gr)
            for (let gc = 0; gc < gridCols && !greenhouseProtected; ++gc) {
              const gBld = buildings[gr]?.[gc];
              if (gBld && BUILDINGS[gBld.typeIndex].name === 'Greenhouse' && isInBuildingRange(gBld, gr, gc, r, c))
                greenhouseProtected = true;
            }
          if (greenhouseProtected) continue;

          // cold-vulnerable crops have higher damage chance
          let damageChance = baseDamageChance;
          if (crop.weatherAffinity === 'cold-vulnerable')
            damageChance = 0.4;
          // Apply weather resistance upgrade
          damageChance *= (1 - resist);
          if (Math.random() < damageChance) {
            const { x: tx, y: ty } = gridCenterToScreen(c, r);
            particles.burst(tx, ty, 8, { color: '#f44', speed: 3, life: 0.4 });
            farmGrid[r][c] = null; // destroy crop
          }
        }
      }
      screenShake.trigger(8, 400);
    } else if (roll < rainChance) {
      weatherType = WEATHER_RAIN;
      floatingText.add(canvasW / 2, 30, 'RAIN -- Growth Boost!', { color: '#48f', font: 'bold 14px sans-serif' });
      for (let i = 0; i < 60; ++i)
        weatherParticles.push({
          x: Math.random() * canvasW,
          y: -Math.random() * canvasH,
          vx: -0.5 - Math.random(),
          vy: 4 + Math.random() * 3,
          size: 1 + Math.random() * 2
        });
    } else {
      weatherType = WEATHER_THUNDERSTORM;
      floatingText.add(canvasW / 2, 30, 'THUNDERSTORM -- Double Growth, Danger!', { color: '#ff0', font: 'bold 14px sans-serif' });
      for (let i = 0; i < 80; ++i)
        weatherParticles.push({
          x: Math.random() * canvasW,
          y: -Math.random() * canvasH,
          vx: -1 - Math.random() * 2,
          vy: 5 + Math.random() * 4,
          size: 1.5 + Math.random() * 2.5
        });

      // Thunderstorm damage: may kill some crops and livestock
      const resist = getWeatherResistance();
      for (let r = 0; r < gridRows; ++r)
        for (let c = 0; c < gridCols; ++c) {
          const cell = farmGrid[r][c];
          if (!cell) continue;
          const crop = CROPS[cell.cropIndex];
          if (crop.weatherAffinity === 'any') continue;
          let greenhouseProtected = false;
          for (let gr = 0; gr < gridRows && !greenhouseProtected; ++gr)
            for (let gc = 0; gc < gridCols && !greenhouseProtected; ++gc) {
              const gBld = buildings[gr]?.[gc];
              if (gBld && BUILDINGS[gBld.typeIndex].name === 'Greenhouse' && isInBuildingRange(gBld, gr, gc, r, c))
                greenhouseProtected = true;
            }
          if (greenhouseProtected) continue;
          let damageChance = 0.1 * (1 - resist);
          if (Math.random() < damageChance) {
            const { x: tx, y: ty } = gridCenterToScreen(c, r);
            particles.burst(tx, ty, 6, { color: '#ff0', speed: 2.5, life: 0.3 });
            farmGrid[r][c] = null;
          }
        }
      // May kill some livestock
      for (let i = livestockPens.length - 1; i >= 0; --i) {
        if (Math.random() < 0.05 * (1 - resist)) {
          const pen = livestockPens[i];
          const scr = livestockPenToScreen(pen);
          floatingText.add(scr.x, scr.y - 10, `${LIVESTOCK[pen.typeIndex].icon} Lost!`, { color: '#f44', font: 'bold 12px sans-serif' });
          livestockPens.splice(i, 1);
        }
      }
      screenShake.trigger(6, 300);
    }
    weatherTimer = WEATHER_DURATION;
  }

  /* ══════════════════════════════════════════════════════════════════
     DAY CYCLE
     ══════════════════════════════════════════════════════════════════ */

  function updateDayCycle(dt) {
    if (state !== STATE_PLAYING) return;
    const prevDay = Math.floor(gameTime / DAY_CYCLE_PERIOD);
    gameTime += dt;
    const curDay = Math.floor(gameTime / DAY_CYCLE_PERIOD);
    if (curDay > prevDay) {
      ++dayCount;
      updateWindowTitle();
    }

    // Day/night phase: 0..1 within each game day
    dayPhase = (gameTime % DAY_CYCLE_PERIOD) / DAY_CYCLE_PERIOD;

    // Season: changes every SEASON_DURATION days
    currentSeason = Math.floor((dayCount - 1) / SEASON_DURATION) % SEASONS.length;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════════
     PRICE FLUCTUATION
     ══════════════════════════════════════════════════════════════════ */

  function updatePriceFluctuation(dt) {
    if (state !== STATE_PLAYING) return;
    priceChangeTimer -= dt;
    if (priceChangeTimer <= 0) {
      priceChangeTimer = PRICE_CHANGE_INTERVAL;
      for (let i = 0; i < CROPS.length; ++i) {
        // Drift toward 1.0 with random perturbation
        const old = priceMultipliers[i] || 1;
        const drift = (1 - old) * 0.3; // mean-reversion
        const noise = (Math.random() - 0.5) * 0.6;
        priceMultipliers[i] = Math.max(PRICE_MIN_MULT, Math.min(PRICE_MAX_MULT, old + drift + noise));
      }
      floatingText.add(canvasW / 2, 50, 'Market prices updated!', { color: '#8cf', font: 'bold 12px sans-serif' });
    }
  }

  function updateGame(dt) {
    if (state === STATE_PAUSED) return;

    updateDayCycle(dt);
    updateCrops(dt);
    updateLivestock(dt);
    updateWeather(dt);
    updateWeatherParticles();
    updatePriceFluctuation(dt);
    updateBuildingIncome(dt);
    updateAnimals(dt);
    updateEnergy(dt);
    updateAutoPlanter(dt);
    updateAutoCollector(dt);
    updateShuffleCache(dt);
  }

  /* ── Auto-Collector Buildings ── */
  function updateAutoCollector(dt) {
    if (state !== STATE_PLAYING) return;
    if (!livestockPens.length) return;

    autoCollectorTimer += dt;

    // Find the fastest auto-collector interval on the grid
    let minInterval = Infinity;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        if (BUILDINGS[bld.typeIndex].name !== 'Auto-Collector') continue;
        minInterval = Math.min(minInterval, getAutoCollectorInterval(bld));
      }
    if (minInterval === Infinity) return;
    if (autoCollectorTimer < minInterval) return;
    autoCollectorTimer -= minInterval;

    // For each auto-collector building, check livestock pens within range
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        if (BUILDINGS[bld.typeIndex].name !== 'Auto-Collector') continue;

        const range = getBuildingRange(bld);
        for (let pi = 0; pi < livestockPens.length; ++pi) {
          const pen = livestockPens[pi];
          if (!pen.produceReady) continue;

          // Check if pen is within range of this collector (using grid coordinates)
          const dr = Math.abs(pen.gridRow - r);
          const dc = Math.abs(pen.gridCol - c);
          if (dr > range || dc > range) continue;

          // Auto-collect the produce
          const def = LIVESTOCK[pen.typeIndex];
          pen.produceReady = false;
          pen.feedTimer = def.feedInterval;

          if (!inventory[def.produce])
            inventory[def.produce] = 0;
          ++inventory[def.produce];

          if (viewZoom >= 0.5) {
            const scr = livestockPenToScreen(pen);
            floatingText.add(scr.x, scr.y - 10, `Auto: +1 ${def.produce}`, { color: '#0cf', font: 'bold 10px sans-serif' });
            particles.sparkle(scr.x, scr.y, Math.ceil(4 * viewZoom), { color: '#0cf', speed: 1.5 });
          }
        }
      }
  }

  /* ── Shuffle Cache ── */

  function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function refreshShuffleCache() {
    // Build all grid positions in order, then shuffle
    const all = [];
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c)
        all.push({ r, c });
    cachedHarvestOrder = fisherYatesShuffle(all.slice());
    cachedPlantOrder = fisherYatesShuffle(all.slice());
  }

  function updateShuffleCache(dt) {
    if (state !== STATE_PLAYING) return;
    shuffleCacheTimer += dt;
    if (shuffleCacheTimer >= SHUFFLE_CACHE_INTERVAL) {
      shuffleCacheTimer -= SHUFFLE_CACHE_INTERVAL;
      refreshShuffleCache();
    }
  }

  /* ── Energy System ── */
  function updateEnergy(dt) {
    if (state !== STATE_PLAYING) return;
    const maxE = getEnergyMax();
    energy = Math.min(maxE, energy + getEnergyRegenRate() * dt);
  }

  /* ── Auto-Planter Buildings ── */
  function updateAutoPlanter(dt) {
    if (state !== STATE_PLAYING) return;
    autoPlanterTimer += dt;

    // Find the fastest auto-planter interval on the grid
    let minInterval = Infinity;
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Auto-Planter L1' || bname === 'Auto-Planter L2')
          minInterval = Math.min(minInterval, getAutoPlanterInterval(bld));
      }
    if (minInterval === Infinity) return;
    if (autoPlanterTimer < minInterval) return;
    autoPlanterTimer -= minInterval;

    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const pBld = buildings[r]?.[c];
        if (!pBld) continue;
        const bdef = BUILDINGS[pBld.typeIndex];
        if (bdef.name !== 'Auto-Planter L1' && bdef.name !== 'Auto-Planter L2') continue;

        // Determine which crop to plant
        let cropIdx = selectedCropIndex;
        if (bdef.name === 'Auto-Planter L2') {
          // Find the best market factor first
          let bestFactor = -Infinity;
          for (let ci = 0; ci < CROPS.length; ++ci) {
            const factor = priceMultipliers[ci] || 1;
            if (factor > bestFactor)
              bestFactor = factor;
          }
          // Collect all crops within 0.15 of the best for diversification
          const candidates = [];
          for (let ci = 0; ci < CROPS.length; ++ci) {
            const factor = priceMultipliers[ci] || 1;
            if (bestFactor - factor <= 0.15)
              candidates.push(ci);
          }
          cropIdx = candidates[Math.floor(Math.random() * candidates.length)];
        }

        const crop = CROPS[cropIdx];
        const range = getBuildingRange(pBld);

        // Use cached plant order for even distribution across ticks
        if (!cachedPlantOrder.length)
          refreshShuffleCache();
        const plantable = [];
        for (const { r: pr, c: pc } of cachedPlantOrder) {
          const nr = pr, nc = pc;
          if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) continue;
          const dr = nr - r, dc = nc - c;
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) > range || Math.abs(dc) > range) continue;
          const adjTT = tileTypes[nr]?.[nc];
          if (adjTT === TILE_WATER || adjTT === TILE_ROCK) continue;
          if (buildings[nr]?.[nc]) continue;
          if (farmGrid[nr][nc] !== null) continue;
          plantable.push({ nr, nc });
        }
        for (const { nr, nc } of plantable) {
          if (credits < crop.seedCost) break;
          credits -= crop.seedCost;
          farmGrid[nr][nc] = {
            cropIndex: cropIdx,
            growthProgress: 0,
            growthStage: 0,
            plantAnim: 1.0
          };
          if (viewZoom >= 0.5) {
            const { x: tx, y: ty } = gridCenterToScreen(nc, nr);
            particles.sparkle(tx, ty, Math.ceil(4 * viewZoom), { color: crop.color, speed: 1.5 });
            floatingText.add(tx, ty - 10, `Auto: -${crop.seedCost}cr`, { color: '#8af', font: 'bold 10px sans-serif' });
          }
        }
      }
  }

  /* ── Building Income (Solar Panel / Wind Turbine) ── */
  function updateBuildingIncome(dt) {
    if (state !== STATE_PLAYING) return;
    buildingIncomeTimer += dt;
    if (buildingIncomeTimer < 30) return; // every 30 seconds (1 cycle = 1 game day)
    buildingIncomeTimer -= 30;

    let earned = 0;
    let surplusBonus = 0;
    const energyFull = energy >= getEnergyMax();
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < gridCols; ++c) {
        const bld = buildings[r]?.[c];
        if (!bld) continue;
        const bname = BUILDINGS[bld.typeIndex].name;
        if (bname === 'Solar Panel') {
          earned += getSolarPanelIncome(bld);
          if (energyFull)
            surplusBonus += getSolarPanelIncome(bld);
        } else if (bname === 'Wind Turbine') {
          earned += getWindTurbineIncome(bld);
          if (energyFull)
            surplusBonus += getWindTurbineIncome(bld);
        }
      }

    if (earned > 0) {
      const total = earned + surplusBonus;
      credits += total;
      if (surplusBonus > 0)
        floatingText.add(canvasW / 2, 40, `+${total}cr (${earned}+${surplusBonus} surplus)`, { color: '#0ff', font: 'bold 12px sans-serif' });
      else
        floatingText.add(canvasW / 2, 40, `+${total}cr (energy income)`, { color: '#0cf', font: 'bold 11px sans-serif' });
    }
  }

  /* ── Wild Animals (Feature 8) ── */
  function updateAnimals(dt) {
    if (state !== STATE_PLAYING) return;

    // Spawn timer
    nextAnimalSpawn -= dt;
    if (nextAnimalSpawn <= 0) {
      nextAnimalSpawn = ANIMAL_SPAWN_MIN + Math.random() * (ANIMAL_SPAWN_MAX - ANIMAL_SPAWN_MIN);
      spawnAnimal();
    }

    // Update each animal
    for (let i = wildAnimals.length - 1; i >= 0; --i) {
      const animal = wildAnimals[i];
      animal.moveTimer -= dt;
      if (animal.moveTimer > 0) continue;
      animal.moveTimer = 0.5; // move every 0.5s

      // Check if in scarecrow range -- flee (radius scales with level)
      let scared = false;
      for (let r = 0; r < gridRows && !scared; ++r)
        for (let c = 0; c < gridCols && !scared; ++c) {
          const sBld = buildings[r]?.[c];
          if (!sBld) continue;
          if (BUILDINGS[sBld.typeIndex].name !== 'Scarecrow') continue;
          const scareRadius = getScarecrowRadius(sBld);
          if (Math.abs(Math.round(animal.y) - r) <= scareRadius && Math.abs(Math.round(animal.x) - c) <= scareRadius)
            scared = true;
        }

      if (scared) {
        // Flee: move away from grid center
        const gridCenterR = gridRows / 2;
        const gridCenterC = gridCols / 2;
        const dr = animal.y - gridCenterR;
        const dc = animal.x - gridCenterC;
        const len = Math.sqrt(dr * dr + dc * dc) || 1;
        animal.y += (dr / len) * 0.8;
        animal.x += (dc / len) * 0.8;
        // Remove if off-grid
        if (animal.x < -2 || animal.x > gridCols + 2 || animal.y < -2 || animal.y > gridRows + 2) {
          wildAnimals.splice(i, 1);
        }
        continue;
      }

      // Find nearest crop
      let bestDist = Infinity;
      let bestR = -1, bestC = -1;
      for (let r = 0; r < gridRows; ++r)
        for (let c = 0; c < gridCols; ++c) {
          if (!farmGrid[r][c]) continue;
          const d = Math.abs(r - animal.y) + Math.abs(c - animal.x);
          if (d < bestDist) {
            bestDist = d;
            bestR = r;
            bestC = c;
          }
        }

      if (bestR < 0) continue; // no crops to target

      // Move toward target
      const moveR = bestR - animal.y;
      const moveC = bestC - animal.x;
      const moveDist = Math.sqrt(moveR * moveR + moveC * moveC);
      if (moveDist < 0.3) {
        // Reached a crop tile -- eat it
        const eatenCell = farmGrid[bestR][bestC];
        if (eatenCell) {
          farmGrid[bestR][bestC] = null;
          const { x: tx, y: ty } = gridCenterToScreen(bestC, bestR);
          floatingText.add(tx, ty - 10, 'Eaten!', { color: '#f44', font: 'bold 11px sans-serif' });
          particles.burst(tx, ty, 6, { color: '#f88', speed: 2, life: 0.3 });
        }
        // Animal leaves after eating
        wildAnimals.splice(i, 1);
        continue;
      }

      // Check for fence blocking (L3+ slows, L5+ blocks and damages)
      const nextR = Math.round(animal.y + (moveR / moveDist) * 0.5);
      const nextC = Math.round(animal.x + (moveC / moveDist) * 0.5);
      if (nextR >= 0 && nextR < gridRows && nextC >= 0 && nextC < gridCols) {
        const fBld = buildings[nextR]?.[nextC];
        if (fBld && BUILDINGS[fBld.typeIndex].name === 'Fence') {
          const fLvl = fBld.level || 1;
          if (fLvl >= 5) {
            // L5+: block AND damage -- kill animal
            const { x: fx, y: fy } = gridCenterToScreen(nextC, nextR);
            floatingText.add(fx, fy - 10, 'Zapped!', { color: '#f44', font: 'bold 10px sans-serif' });
            particles.burst(fx, fy, 6, { color: '#ff0', speed: 2.5, life: 0.3 });
            wildAnimals.splice(i, 1);
            continue;
          }
          if (fLvl >= 3) {
            // L3-L4: slow animals (reduced movement speed)
            animal.y += (moveR / moveDist) * 0.15;
            animal.x += (moveC / moveDist) * 0.15;
            continue;
          }
          // L1-L2: block completely
          continue;
        }
      }

      animal.y += (moveR / moveDist) * 0.5;
      animal.x += (moveC / moveDist) * 0.5;
    }
  }

  function spawnAnimal() {
    // Spawn at a random edge
    let x, y;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: x = -1; y = Math.random() * gridRows; break; // left
      case 1: x = gridCols; y = Math.random() * gridRows; break; // right
      case 2: x = Math.random() * gridCols; y = -1; break; // top
      default: x = Math.random() * gridCols; y = gridRows; break; // bottom
    }
    wildAnimals.push({ x, y, targetCol: -1, targetRow: -1, moveTimer: 0, hp: 1 });
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    const ts = BASE_TILE_SIZE * viewZoom;
    for (let r = 0; r < gridRows; ++r) {
      for (let c = 0; c < gridCols; ++c) {
        const x = (GRID_OFFSET_X + c * BASE_TILE_SIZE) * viewZoom + viewPanX;
        const y = (GRID_OFFSET_Y + r * BASE_TILE_SIZE) * viewZoom + viewPanY;
        const cell = farmGrid[r][c];
        const tt = tileTypes[r]?.[c] ?? TILE_FARMLAND;
        const bld = buildings[r]?.[c];

        // Skip tiles fully off-screen
        if (x + ts < 0 || x > canvasW || y + ts < 0 || y > canvasH - 45) continue;

        // Draw tile base by type
        if (tt === TILE_ROCK) {
          // Gray stone base
          ctx.fillStyle = '#666';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
          // Lighter gray stone spots
          const seed = r * 31 + c * 17;
          for (let si = 0; si < 4; ++si) {
            const sx = x + 4 + ((seed * (si + 1) * 7) % ((ts - 8) | 1));
            const sy = y + 4 + ((seed * (si + 1) * 13) % ((ts - 8) | 1));
            const sr = 2 + (si % 2) * 1.5;
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.arc(sx, sy, sr * viewZoom, 0, TWO_PI);
            ctx.fill();
          }
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
          // Rock tiles can now have buildings and crops (Feature 2)
        }

        else if (tt === TILE_WATER) {
          // Blue water tile with animated shimmer
          ctx.fillStyle = '#2288cc';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
          // Animated wave shimmer
          const wave1 = 0.15 + 0.1 * Math.sin(gameTime * 2 + r * 1.5 + c * 2.3);
          ctx.fillStyle = `rgba(100,200,255,${wave1})`;
          ctx.fillRect(x + 1, y + 1, ts - 2, ts / 3);
          const wave2 = 0.1 + 0.08 * Math.sin(gameTime * 3 + r * 2.7 + c * 1.1);
          ctx.fillStyle = `rgba(150,230,255,${wave2})`;
          ctx.fillRect(x + 1, y + ts * 0.5, ts - 2, ts / 4);
          ctx.strokeStyle = '#1a6699';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
          continue; // no crops or buildings on water
        }

        else if (tt === TILE_SAND) {
          // Sandy yellow tile
          ctx.fillStyle = '#c4a855';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
          // Subtle sand grain texture
          ctx.fillStyle = 'rgba(180,160,100,0.2)';
          const gseed = r * 41 + c * 23;
          for (let gi = 0; gi < 3; ++gi) {
            const gx = x + 3 + ((gseed * (gi + 1) * 11) % ((ts - 6) | 1));
            const gy = y + 3 + ((gseed * (gi + 1) * 19) % ((ts - 6) | 1));
            ctx.beginPath();
            ctx.arc(gx, gy, (1 + gi * 0.5) * viewZoom, 0, TWO_PI);
            ctx.fill();
          }
          ctx.strokeStyle = '#a89040';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
        } else {
          // TILE_FARMLAND: existing brown/green rendering
          const q = getTileSoilQuality(r, c);
          ctx.fillStyle = cell ? '#3a2a1a' : '#2a1a0a';
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);

          // Soil quality tint overlay: greener = better, yellower = worse
          if (q >= 0.9) {
            const ga = Math.min(0.2, (q - 0.9) * 0.5);
            ctx.fillStyle = `rgba(0,180,40,${ga})`;
          } else {
            const ya = Math.min(0.25, (0.9 - q) * 0.4);
            ctx.fillStyle = `rgba(180,160,40,${ya})`;
          }
          ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);

          ctx.strokeStyle = '#5a4a3a';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
        }

        // Hoed tile indicator: draw furrow lines on fertilized farmland
        if (hoedTiles[r]?.[c] && (tt === TILE_FARMLAND || tt === TILE_SAND)) {
          ctx.save();
          ctx.strokeStyle = 'rgba(100,180,60,0.35)';
          ctx.lineWidth = Math.max(0.5, viewZoom);
          const furrowGap = Math.max(4, 6 * viewZoom);
          for (let fy = y + 4 * viewZoom; fy < y + ts - 2 * viewZoom; fy += furrowGap) {
            ctx.beginPath();
            ctx.moveTo(x + 3 * viewZoom, fy);
            ctx.lineTo(x + ts - 3 * viewZoom, fy);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Show fertility label on empty farmable tiles (no crop, no building) when zoomed in enough
        if (!cell && !bld && viewZoom >= 0.8 && tt !== TILE_ROCK && tt !== TILE_WATER) {
          const q = getTileSoilQuality(r, c);
          ctx.fillStyle = '#555';
          ctx.font = `${Math.round(7 * viewZoom)}px sans-serif`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${Math.round(q * 100)}%`, x + ts - 3, y + ts - 2);
        }

        // Draw building on tile
        if (bld) {
          const bdef = BUILDINGS[bld.typeIndex];
          const bLvl = bld.level || 1;

          // Building border indicator (brighter at higher levels)
          const borderBright = Math.min(255, 150 + bLvl * 20);
          ctx.strokeStyle = `rgb(0,${borderBright},${borderBright})`;
          ctx.lineWidth = 1.5 + (bLvl - 1) * 0.3;
          ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);

          // Dark backdrop for icon visibility
          const pad = 4 * viewZoom;
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.beginPath();
          ctx.arc(x + ts / 2, y + ts / 2, ts / 3, 0, TWO_PI);
          ctx.fill();

          // Building icon (slightly larger at higher levels)
          const iconScale = 1 + (bLvl - 1) * 0.06;
          ctx.font = `${Math.round(20 * viewZoom * iconScale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(bdef.icon, x + ts / 2, y + ts / 2);

          // Building name label when zoomed in
          if (viewZoom >= 0.9) {
            ctx.fillStyle = '#aff';
            ctx.font = `${Math.round(7 * viewZoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(bdef.name, x + ts / 2, y + ts - 2);
          }

          // Level badge in top-right corner
          if (bLvl > 1) {
            const badgeSize = Math.round(12 * viewZoom);
            const badgeX = x + ts - badgeSize - 1;
            const badgeY = y + 1;
            ctx.fillStyle = 'rgba(0,180,255,0.85)';
            ctx.beginPath();
            ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, TWO_PI);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.round(8 * viewZoom)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`L${bLvl}`, badgeX + badgeSize / 2, badgeY + badgeSize / 2);
          }

          continue; // buildings occupy the tile, no crop rendering
        }

        if (cell) {
          const crop = CROPS[cell.cropIndex];
          const maxStage = crop.stages - 1;
          const mature = cell.growthStage >= maxStage;

          // Growth indicator bar
          const progress = Math.min(1, cell.growthProgress);
          ctx.fillStyle = mature ? '#4a4' : crop.color;
          ctx.fillRect(x + 3, y + ts - 6 * viewZoom, (ts - 6) * progress, 2 * viewZoom);

          // Special crop background effects
          if (crop.weatherAffinity === 'any') {
            ctx.fillStyle = `rgba(90,30,120,${0.15 + 0.05 * Math.sin(gameTime * 2 + r * 3 + c)})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
          } else if (crop.weatherAffinity === 'cold-vulnerable') {
            const pulse = 0.1 + 0.08 * Math.sin(gameTime * 4 + c * 2);
            ctx.fillStyle = `rgba(255,80,20,${pulse})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            // Outer glow via shadow — use save/restore to isolate shadow state
            ctx.save();
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#f52';
            ctx.fillStyle = `rgba(255,80,20,${pulse * 0.5})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.restore();
          } else if (crop.weatherAffinity === 'solar') {
            const shimmer = 0.08 + 0.06 * Math.sin(gameTime * 3 + r + c * 5);
            ctx.fillStyle = `rgba(140,180,255,${shimmer})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            const sparkleT = gameTime * 5 + r * 7 + c * 11;
            const sx = x + ts / 2 + Math.sin(sparkleT) * 14 * viewZoom;
            const sy = y + ts / 2 + Math.cos(sparkleT * 1.3) * 10 * viewZoom;
            ctx.globalAlpha = 0.5 + 0.4 * Math.sin(sparkleT * 2);
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, sy, 1.2 * viewZoom, 0, TWO_PI);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Crop icon with plantAnim scale bounce
          const scale = cell.plantAnim > 0 ? 1 + Math.sin(cell.plantAnim * Math.PI) * 0.4 : 1;
          ctx.save();
          ctx.translate(x + ts / 2, y + ts / 2 - 4 * viewZoom);
          ctx.scale(scale, scale);
          ctx.fillStyle = crop.color;
          ctx.font = `${Math.round((14 + cell.growthStage * 3) * viewZoom)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(crop.icon, 0, 0);
          ctx.restore();

          // Light glow on mature crops
          if (mature) {
            ctx.save();
            ctx.shadowBlur = 4;
            ctx.shadowColor = crop.color;
            ctx.strokeStyle = `${crop.color}55`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 3, y + 3, ts - 6, ts - 6);
            ctx.restore();
          }
        }
      }
    }
  }

  function drawLivestock() {
    const ts = BASE_TILE_SIZE * viewZoom;
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];
      const scr = livestockPenToScreen(pen);
      const halfTs = ts / 2;

      // Skip pens fully off-screen
      if (scr.x + halfTs < 0 || scr.x - halfTs > canvasW || scr.y + halfTs < 0 || scr.y - halfTs > canvasH - 45) continue;

      // Pen background
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(scr.x - halfTs, scr.y - halfTs, ts, ts);
      ctx.strokeStyle = '#4a5a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(scr.x - halfTs, scr.y - halfTs, ts, ts);

      // Fence marks on pen border
      ctx.strokeStyle = '#6a7a6a';
      ctx.lineWidth = 0.5;
      const marks = 4;
      for (let m = 1; m < marks; ++m) {
        const frac = m / marks;
        // Top/bottom
        const mx = scr.x - halfTs + ts * frac;
        ctx.beginPath(); ctx.moveTo(mx, scr.y - halfTs); ctx.lineTo(mx, scr.y - halfTs + 3 * viewZoom); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx, scr.y + halfTs); ctx.lineTo(mx, scr.y + halfTs - 3 * viewZoom); ctx.stroke();
        // Left/right
        const my = scr.y - halfTs + ts * frac;
        ctx.beginPath(); ctx.moveTo(scr.x - halfTs, my); ctx.lineTo(scr.x - halfTs + 3 * viewZoom, my); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(scr.x + halfTs, my); ctx.lineTo(scr.x + halfTs - 3 * viewZoom, my); ctx.stroke();
      }

      // Animal icon
      ctx.font = `${Math.round(24 * viewZoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, scr.x, scr.y);

      // Feed timer bar
      if (!pen.produceReady) {
        const barW = ts * 0.7;
        const barH = 3 * viewZoom;
        const barX = scr.x - barW / 2;
        const barY = scr.y + halfTs - 6 * viewZoom;
        const progress = 1 - Math.max(0, pen.feedTimer / def.feedInterval);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#4a4';
        ctx.fillRect(barX, barY, barW * progress, barH);
      }

      // Ready indicator
      if (pen.produceReady) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0f0';
        ctx.font = `${Math.round(14 * viewZoom)}px sans-serif`;
        ctx.fillText(def.produceIcon, scr.x + 14 * viewZoom, scr.y - 12 * viewZoom);
        ctx.restore();

        // Pulsing green border
        const pulse = 0.4 + 0.3 * Math.sin(gameTime * 4);
        ctx.strokeStyle = `rgba(0,255,0,${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(scr.x - halfTs + 1, scr.y - halfTs + 1, ts - 2, ts - 2);
      }
    }
  }

  function updateWeatherParticles() {
    if (weatherType === WEATHER_NONE) {
      weatherParticles = [];
      return;
    }

    for (let i = 0; i < weatherParticles.length; ++i) {
      const wp = weatherParticles[i];
      if (weatherType === WEATHER_SOLAR_FLARE) {
        wp.phase += 0.02;
        wp.x += wp.drift;
        wp.y -= wp.speed * 0.3;
        if (wp.y < -10) { wp.y = canvasH + 10; wp.x = Math.random() * canvasW; }
        if (wp.x < -10) wp.x = canvasW + 10;
        if (wp.x > canvasW + 10) wp.x = -10;
      } else if (weatherType === WEATHER_METEOR_SHOWER) {
        wp.x += wp.vx;
        wp.y += wp.vy;
        if (wp.y > canvasH + 20 || wp.x < -30) {
          wp.x = Math.random() * canvasW + 100;
          wp.y = -Math.random() * 60;
        }
      } else if (weatherType === WEATHER_RAIN || weatherType === WEATHER_THUNDERSTORM) {
        wp.x += wp.vx;
        wp.y += wp.vy;
        if (wp.y > canvasH + 10) {
          wp.x = Math.random() * canvasW;
          wp.y = -Math.random() * 20;
        }
      }
    }
  }

  function drawWeatherOverlay() {
    if (weatherType === WEATHER_NONE) return;

    ctx.save();

    if (weatherType === WEATHER_SOLAR_FLARE) {
      // Tinted golden overlay
      ctx.fillStyle = `rgba(255,200,0,${overlayAlpha * 0.4})`;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Radial solar glow from top-center
      const grad = ctx.createRadialGradient(canvasW / 2, -30, 10, canvasW / 2, -30, canvasH * 0.9);
      grad.addColorStop(0, `rgba(255,240,100,${overlayAlpha * 0.6})`);
      grad.addColorStop(0.4, `rgba(255,200,50,${overlayAlpha * 0.2})`);
      grad.addColorStop(1, 'rgba(255,200,50,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Floating golden orbs
      for (let i = 0; i < weatherParticles.length; ++i) {
        const wp = weatherParticles[i];
        const alpha = 0.25 + 0.25 * Math.sin(wp.phase);
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = wp.size * 2;
        ctx.shadowColor = '#ffa';
        ctx.fillStyle = '#ffe866';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size, 0, TWO_PI);
        ctx.fill();
      }
    } else if (weatherType === WEATHER_METEOR_SHOWER) {
      // Tinted reddish overlay
      ctx.fillStyle = `rgba(180,30,20,${overlayAlpha * 0.25})`;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Meteor rain particles with trails
      for (let i = 0; i < weatherParticles.length; ++i) {
        const wp = weatherParticles[i];
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = '#f80';
        ctx.lineWidth = wp.size * 0.7;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#f60';
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x - wp.vx * (wp.trail / wp.vy) * 0.6, wp.y - wp.trail);
        ctx.stroke();

        // Bright head
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fe8';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#f80';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size * 0.5, 0, TWO_PI);
        ctx.fill();
      }
    } else if (weatherType === WEATHER_RAIN) {
      ctx.fillStyle = `rgba(40,80,200,${overlayAlpha * 0.2})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
      for (let i = 0; i < weatherParticles.length; ++i) {
        const wp = weatherParticles[i];
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#6af';
        ctx.lineWidth = wp.size * 0.4;
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x + wp.vx * 2, wp.y - 8);
        ctx.stroke();
      }
    } else if (weatherType === WEATHER_THUNDERSTORM) {
      ctx.fillStyle = `rgba(20,20,40,${overlayAlpha * 0.35})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
      for (let i = 0; i < weatherParticles.length; ++i) {
        const wp = weatherParticles[i];
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#8bf';
        ctx.lineWidth = wp.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(wp.x, wp.y);
        ctx.lineTo(wp.x + wp.vx * 2, wp.y - 10);
        ctx.stroke();
      }
      // Random lightning flash
      if (Math.random() < 0.02) {
        ctx.globalAlpha = 0.15 + Math.random() * 0.15;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvasW, canvasH);
      }
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Crop bar layout ── */
  const CROP_BTN_W = 48;
  const CROP_BTN_GAP = 4;
  const CROP_BAR_X = 8;

  function drawUI() {
    // Crop selection bar at bottom
    const barY = canvasH - 45;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, barY, canvasW, 45);

    for (let i = 0; i < CROPS.length; ++i) {
      const bx = CROP_BAR_X + i * (CROP_BTN_W + CROP_BTN_GAP);
      const selected = i === selectedCropIndex && selectedTool === TOOL_PLANT;
      ctx.fillStyle = selected ? '#444' : '#222';
      ctx.fillRect(bx, barY + 4, CROP_BTN_W, 37);
      if (selected) {
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, barY + 4, CROP_BTN_W, 37);
      }
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CROPS[i].icon, bx + 14, barY + 18);
      ctx.fillStyle = credits >= CROPS[i].seedCost ? '#aaa' : '#f44';
      ctx.font = '8px sans-serif';
      ctx.fillText(`${CROPS[i].seedCost}cr`, bx + CROP_BTN_W - 10, barY + 18);

      // Price multiplier indicator arrow
      const pm = priceMultipliers[i] || 1;
      if (pm > 1.05) {
        ctx.fillStyle = '#0c0';
        ctx.font = '9px sans-serif';
        ctx.fillText('\u25B2' + pm.toFixed(1), bx + CROP_BTN_W / 2, barY + 38);
      } else if (pm < 0.95) {
        ctx.fillStyle = '#f44';
        ctx.font = '9px sans-serif';
        ctx.fillText('\u25BC' + pm.toFixed(1), bx + CROP_BTN_W / 2, barY + 38);
      } else {
        ctx.fillStyle = '#666';
        ctx.font = '8px sans-serif';
        ctx.fillText(pm.toFixed(1), bx + CROP_BTN_W / 2, barY + 38);
      }
    }

    // Right-side buttons: HOE | SELL | LIVESTOCK | UPGRADES
    const upgBtnX = canvasW - 78;
    const livBtnX = upgBtnX - 77;
    const sellBtnX = livBtnX - 67;
    const hoeBtnX = sellBtnX - 65;

    // Hoe tool button
    const hoeSelected = selectedTool === TOOL_HOE;
    ctx.fillStyle = hoeSelected ? '#432' : '#221';
    ctx.fillRect(hoeBtnX, barY + 4, 58, 37);
    ctx.strokeStyle = hoeSelected ? '#fa0' : '#864';
    ctx.lineWidth = hoeSelected ? 2 : 1;
    ctx.strokeRect(hoeBtnX, barY + 4, 58, 37);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u26CF\uFE0F', hoeBtnX + 29, barY + 20);
    ctx.fillStyle = '#ca8';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('HOE', hoeBtnX + 29, barY + 36);

    // Sell button
    ctx.fillStyle = '#040';
    ctx.fillRect(sellBtnX, barY + 4, 60, 37);
    ctx.strokeStyle = '#0a0';
    ctx.lineWidth = 1;
    ctx.strokeRect(sellBtnX, barY + 4, 60, 37);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SELL ALL', sellBtnX + 30, barY + 26);

    // Upgrades button
    ctx.fillStyle = showUpgradeShop ? '#333' : '#220';
    ctx.fillRect(upgBtnX, barY + 4, 70, 37);
    ctx.strokeStyle = '#cc0';
    ctx.lineWidth = 1;
    ctx.strokeRect(upgBtnX, barY + 4, 70, 37);
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADES', upgBtnX + 35, barY + 20);
    ctx.fillStyle = '#aa0';
    ctx.font = '8px sans-serif';
    ctx.fillText('(U)', upgBtnX + 35, barY + 34);

    // Zoom indicator
    if (Math.abs(viewZoom - 1.0) > 0.01) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(canvasW - 70, 4, 66, 18);
      ctx.fillStyle = '#8cf';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Zoom: ${Math.round(viewZoom * 100)}%`, canvasW - 37, 16);
    }

    // Building selector row above the crop bar
    const bldBarY = barY - 30;
    ctx.fillStyle = 'rgba(0,0,20,0.6)';
    ctx.fillRect(0, bldBarY, canvasW, 28);
    ctx.fillStyle = '#8cf';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Buildings:', CROP_BAR_X, bldBarY + 11);

    const BLD_BTN_W = 56;
    const BLD_BTN_GAP = 4;
    const bldStartX = CROP_BAR_X + 60;
    for (let i = 0; i < BUILDINGS.length; ++i) {
      const bx = bldStartX + i * (BLD_BTN_W + BLD_BTN_GAP);
      const selected = i === selectedBuildingIndex && selectedTool === TOOL_BUILD;
      ctx.fillStyle = selected ? '#224' : '#112';
      ctx.fillRect(bx, bldBarY + 2, BLD_BTN_W, 24);
      if (selected) {
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, bldBarY + 2, BLD_BTN_W, 24);
      }
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(BUILDINGS[i].icon, bx + 12, bldBarY + 17);
      ctx.fillStyle = credits >= BUILDINGS[i].cost ? '#aaa' : '#f44';
      ctx.font = '8px sans-serif';
      ctx.fillText(`${BUILDINGS[i].cost}cr`, bx + BLD_BTN_W - 12, bldBarY + 17);
    }

    // Cancel building mode button (if in build mode)
    if (selectedTool === TOOL_BUILD) {
      const cancelX = bldStartX + BUILDINGS.length * (BLD_BTN_W + BLD_BTN_GAP) + 4;
      ctx.fillStyle = '#300';
      ctx.fillRect(cancelX, bldBarY + 2, 40, 24);
      ctx.strokeStyle = '#f44';
      ctx.lineWidth = 1;
      ctx.strokeRect(cancelX, bldBarY + 2, 40, 24);
      ctx.fillStyle = '#f88';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Cancel', cancelX + 20, bldBarY + 17);
    }

    // Livestock button
    ctx.fillStyle = showLivestockShop ? '#233' : '#122';
    ctx.fillRect(livBtnX, barY + 4, 70, 37);
    ctx.strokeStyle = '#0a8';
    ctx.lineWidth = 1;
    ctx.strokeRect(livBtnX, barY + 4, 70, 37);
    ctx.fillStyle = '#0fc';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LIVESTOCK', livBtnX + 35, barY + 20);
    ctx.fillStyle = '#088';
    ctx.font = '8px sans-serif';
    ctx.fillText('(L)', livBtnX + 35, barY + 34);
  }

  function drawUpgradeShop() {
    if (!showUpgradeShop || state !== STATE_PLAYING) return;

    const panelW = 300;
    const ROW_H = 48;
    const headerH = 30;
    const footerH = 16;
    const contentH = UPGRADES.length * ROW_H;
    const maxVisH = canvasH - 60;
    const panelH = Math.min(headerH + contentH + footerH, maxVisH);
    const px = Math.round((canvasW - panelW) / 2);
    const py = Math.round((canvasH - panelH) / 2) - 10;
    const scrollableH = panelH - headerH - footerH;
    const maxScroll = Math.max(0, contentH - scrollableH);
    upgradeShopScroll = Math.max(0, Math.min(maxScroll, upgradeShopScroll));

    // Panel background
    ctx.fillStyle = 'rgba(5,10,25,0.94)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#cc0';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    // Title
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upgrade Shop', px + panelW / 2, py + 22);

    // Clip content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py + headerH, panelW, scrollableH);
    ctx.clip();

    // Upgrade rows
    for (let i = 0; i < UPGRADES.length; ++i) {
      const def = UPGRADES[i];
      const curLevel = getUpgradeLevel(def.id);
      const maxed = curLevel >= def.maxLevel;
      let cost;
      if (def.id === 'plotExpansion') {
        const newTiles = 2 * gridRows + 2 * gridCols + 4;
        cost = maxed ? 0 : newTiles * 8;
      } else
        cost = maxed ? 0 : getUpgradeCost(def, curLevel);
      const canAfford = credits >= cost;
      const ry = py + headerH + i * ROW_H - upgradeShopScroll;

      // Skip off-screen rows
      if (ry + ROW_H < py + headerH || ry > py + headerH + scrollableH) continue;

      // Row background
      ctx.fillStyle = 'rgba(20,30,40,0.8)';
      ctx.fillRect(px + 6, ry + 1, panelW - 12, ROW_H - 2);

      // Icon + name
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${def.icon} ${def.name}`, px + 12, ry + 15);

      // Level pips (skip for infinite upgrades like Plot Expansion)
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#888';
      if (def.maxLevel > 10) {
        ctx.fillText(`Lv${curLevel}`, px + 12, ry + 27);
      } else {
        let pipStr = '';
        for (let l = 0; l < def.maxLevel; ++l)
          pipStr += l < curLevel ? '\u25A0 ' : '\u25A1 ';
        ctx.fillText(pipStr + `Lv${curLevel}/${def.maxLevel}`, px + 12, ry + 27);
      }

      // Description
      ctx.fillStyle = '#777';
      ctx.font = '8px sans-serif';
      ctx.fillText(def.desc, px + 12, ry + 39);

      // Buy button area
      const btnX = px + panelW - 66;
      const btnY = ry + 5;
      const btnW = 54;
      const btnH = 20;
      if (maxed) {
        ctx.fillStyle = '#060';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#0a0';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MAX', btnX + btnW / 2, btnY + 14);
      } else {
        ctx.fillStyle = canAfford ? '#220' : '#200';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = canAfford ? '#cc0' : '#a44';
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = canAfford ? '#ff0' : '#f66';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${cost}cr`, btnX + btnW / 2, btnY + 14);
      }
    }

    ctx.restore();

    // Scroll indicators
    if (maxScroll > 0) {
      if (upgradeShopScroll > 0) {
        ctx.fillStyle = '#cc0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u25B2', px + panelW - 14, py + headerH + 10);
      }
      if (upgradeShopScroll < maxScroll) {
        ctx.fillStyle = '#cc0';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u25BC', px + panelW - 14, py + panelH - footerH - 4);
      }
    }

    // Close hint
    ctx.fillStyle = '#666';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press U or Esc to close | Scroll for more', px + panelW / 2, py + panelH - 3);
  }

  function drawLivestockShop() {
    if (!showLivestockShop || state !== STATE_PLAYING) return;

    const panelW = 280;
    const ROW_H = 48;
    const headerH = 30;
    const footerH = 16;
    const contentH = LIVESTOCK.length * ROW_H;
    const maxVisH = canvasH - 60;
    const panelH = Math.min(headerH + contentH + footerH, maxVisH);
    const px = Math.round((canvasW - panelW) / 2);
    const py = Math.round((canvasH - panelH) / 2) - 10;
    const scrollableH = panelH - headerH - footerH;
    const maxScroll = Math.max(0, contentH - scrollableH);
    livestockShopScroll = Math.max(0, Math.min(maxScroll, livestockShopScroll));

    // Panel background
    ctx.fillStyle = 'rgba(5,15,10,0.94)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#0a8';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    // Title
    ctx.fillStyle = '#0fc';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Livestock Shop', px + panelW / 2, py + 22);

    // Clip content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py + headerH, panelW, scrollableH);
    ctx.clip();

    // Livestock rows
    for (let i = 0; i < LIVESTOCK.length; ++i) {
      const def = LIVESTOCK[i];
      const canAfford = credits >= def.cost;
      const ry = py + headerH + i * ROW_H - livestockShopScroll;

      // Skip off-screen rows
      if (ry + ROW_H < py + headerH || ry > py + headerH + scrollableH) continue;

      // Row background
      ctx.fillStyle = 'rgba(20,35,25,0.8)';
      ctx.fillRect(px + 6, ry + 1, panelW - 12, ROW_H - 2);

      // Icon + name
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${def.icon} ${def.name}`, px + 12, ry + 15);

      // Produce info
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#aaa';
      ctx.fillText(`${def.produceIcon} ${def.produce} every ${def.feedInterval}s (${getEffectiveProduceValue(def)}cr)`, px + 12, ry + 27);

      // Owned count
      const owned = livestockPens.filter(p => p.typeIndex === i).length;
      if (owned > 0) {
        ctx.fillStyle = '#8cf';
        ctx.font = '8px sans-serif';
        ctx.fillText(`Owned: ${owned}`, px + 12, ry + 39);
      }

      // Buy button area
      const btnX = px + panelW - 66;
      const btnY = ry + 5;
      const btnW = 54;
      const btnH = 20;
      ctx.fillStyle = canAfford ? '#132' : '#200';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = canAfford ? '#0a8' : '#a44';
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.fillStyle = canAfford ? '#0fc' : '#f66';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${def.cost}cr`, btnX + btnW / 2, btnY + 14);
    }

    ctx.restore();

    // Scroll indicators
    if (maxScroll > 0) {
      if (livestockShopScroll > 0) {
        ctx.fillStyle = '#0a8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u25B2', px + panelW - 14, py + headerH + 10);
      }
      if (livestockShopScroll < maxScroll) {
        ctx.fillStyle = '#0a8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u25BC', px + panelW - 14, py + panelH - footerH - 4);
      }
    }

    // Close hint
    ctx.fillStyle = '#666';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press L or Esc to close', px + panelW / 2, py + panelH - 3);
  }

  function drawDragSelection() {
    if (!isDragging || !dragStartedOnGrid) return;

    const { r0, c0, r1, c1 } = getDragGridRect();
    const ts = BASE_TILE_SIZE * viewZoom;

    // Highlight individual tiles within the selection
    const hoeMode = selectedTool === TOOL_HOE;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tt = tileTypes[r]?.[c] ?? TILE_FARMLAND;
        const tx = (GRID_OFFSET_X + c * BASE_TILE_SIZE) * viewZoom + viewPanX;
        const ty = (GRID_OFFSET_Y + r * BASE_TILE_SIZE) * viewZoom + viewPanY;

        if (hoeMode) {
          // Hoe drag: highlight water tiles (fertilize 8 neighbors) and sand (convert to soil)
          if (tt === TILE_WATER) {
            ctx.fillStyle = 'rgba(0,150,255,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt === TILE_SAND) {
            ctx.fillStyle = 'rgba(160,130,60,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else if (tt !== TILE_ROCK && !buildings[r]?.[c]) {
            ctx.fillStyle = 'rgba(80,200,60,0.15)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
          continue;
        }

        // Skip unusable tiles (only water blocks)
        if (tt === TILE_WATER) continue;
        // Skip tiles with buildings
        if (buildings[r]?.[c]) continue;

        const cell = farmGrid[r][c];

        if (cell === null) {
          ctx.fillStyle = 'rgba(0,200,0,0.2)';
          ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
        } else {
          const crop = CROPS[cell.cropIndex];
          if (cell.growthStage >= crop.stages - 1) {
            ctx.fillStyle = 'rgba(255,200,0,0.25)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          } else {
            ctx.fillStyle = 'rgba(255,50,50,0.12)';
            ctx.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
          }
        }
      }

    // Draw outer selection rectangle border
    const rx = (GRID_OFFSET_X + c0 * BASE_TILE_SIZE) * viewZoom + viewPanX;
    const ry = (GRID_OFFSET_Y + r0 * BASE_TILE_SIZE) * viewZoom + viewPanY;
    const rw = (c1 - c0 + 1) * ts;
    const rh = (r1 - r0 + 1) * ts;

    ctx.strokeStyle = 'rgba(0,255,128,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#4d4';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SPACE FARMING', canvasW / 2, canvasH / 2 - 40);
      ctx.fillStyle = '#888';
      ctx.font = '14px sans-serif';
      ctx.fillText('Grow crops, tend livestock, sell produce on your space station.', canvasW / 2, canvasH / 2);
      ctx.fillText('Tap or press F2 to Start', canvasW / 2, canvasH / 2 + 30);
      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', canvasW / 2, canvasH / 2);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#f80';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SEASON OVER', canvasW / 2, canvasH / 2 - 25);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Credits: ${credits} — Days: ${dayCount}`, canvasW / 2, canvasH / 2 + 10);
      ctx.fillText('Tap or press F2 to play again', canvasW / 2, canvasH / 2 + 40);
      ctx.textAlign = 'start';
    }
  }

  function drawDayNightOverlay() {
    if (state !== STATE_PLAYING) return;
    // Night phase: dayPhase 0.5..1.0 is night
    if (dayPhase < 0.5) return;
    // Fade in/out: smooth transition
    const nightProgress = (dayPhase - 0.5) * 2; // 0..1
    const fade = Math.sin(nightProgress * Math.PI); // bell curve fade
    const alpha = fade * 0.25; // max 25% darkness
    ctx.fillStyle = `rgba(10,20,60,${alpha})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  function drawAnimals() {
    if (state !== STATE_PLAYING) return;
    for (let i = 0; i < wildAnimals.length; ++i) {
      const animal = wildAnimals[i];
      const g = gridToScreen(animal.x, animal.y);
      const sx = g.x + g.size / 2;
      const sy = g.y + g.size / 2;

      // Check if animal is near a crop (damaging) -- highlight in red
      const animalR = Math.round(animal.y);
      const animalC = Math.round(animal.x);
      let nearCrop = false;
      for (let dr = -1; dr <= 1 && !nearCrop; ++dr)
        for (let dc = -1; dc <= 1 && !nearCrop; ++dc) {
          const nr = animalR + dr, nc = animalC + dc;
          if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols && farmGrid[nr]?.[nc])
            nearCrop = true;
        }

      // Red pulsing highlight for crop-damaging animals
      if (nearCrop) {
        const pulse = 0.3 + 0.2 * Math.sin(gameTime * 6);
        ctx.fillStyle = `rgba(255,50,50,${pulse})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 10 * viewZoom, 0, TWO_PI);
        ctx.fill();
      }

      // Draw as a small colored dot
      ctx.fillStyle = nearCrop ? '#f44' : '#c44';
      ctx.beginPath();
      ctx.arc(sx, sy, 5 * viewZoom, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Mouse emoji
      ctx.font = `${Math.round(12 * viewZoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83D\uDC2D', sx, sy);

      // Pest control indicator: show trap icon when cursor is nearby
      const mdx = tooltipX - sx, mdy = tooltipY - sy;
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mDist < 20 * viewZoom) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - 22 * viewZoom, sy - 20 * viewZoom, 44 * viewZoom, 14 * viewZoom);
        ctx.fillStyle = '#fa0';
        ctx.font = `bold ${Math.round(8 * viewZoom)}px sans-serif`;
        ctx.fillText('\uD83E\uDEA4 +10cr', sx, sy - 12 * viewZoom);
      }
    }
  }

  function drawInventoryPanel() {
    if (state !== STATE_PLAYING) return;
    const capacity = getStorageCapacity();
    const totalItems = getTotalInventoryCount();

    // Collect items to display
    const items = [];
    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0)
        items.push({ icon: crop.icon, name: crop.name, count });
    }
    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0)
        items.push({ icon: live.produceIcon, name: live.produce, count });
    }

    const estValue = getEstimatedStorageValue();

    const panelW = 110;
    const lineH = 14;
    const headerH = 18;
    const estLineH = totalItems > 0 ? lineH : 0;
    const panelH = headerH + Math.max(1, items.length) * lineH + estLineH + 6;
    const px = canvasW - panelW - 4;
    const py = 24;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = totalItems >= capacity ? '#f44' : '#4a4';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, panelW, panelH);

    // Header
    ctx.fillStyle = totalItems >= capacity ? '#f44' : '#8cf';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Storage: ${totalItems}/${capacity}`, px + 4, py + 13);

    // Items
    ctx.font = '9px sans-serif';
    for (let i = 0; i < items.length; ++i) {
      ctx.fillStyle = '#ccc';
      ctx.fillText(`${items[i].icon} ${items[i].count}`, px + 4, py + headerH + (i + 1) * lineH);
    }
    if (!items.length) {
      ctx.fillStyle = '#666';
      ctx.fillText('Empty', px + 4, py + headerH + lineH);
    }

    // Estimated storage value
    if (totalItems > 0) {
      ctx.fillStyle = '#da2';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText(`Est. value: ${estValue}cr`, px + 4, py + headerH + Math.max(1, items.length) * lineH + lineH);
    }
  }

  function drawSeasonAndDayNightHUD() {
    if (state !== STATE_PLAYING) return;
    // Season display near the day counter area
    const seasonName = SEASONS[currentSeason];
    const seasonIcon = SEASON_ICONS[currentSeason];
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${seasonIcon} ${seasonName}`, 4, 22);

    // Day/night indicator
    const isNight = dayPhase >= 0.5;
    const dnIcon = isNight ? '\uD83C\uDF19' : '\u2600\uFE0F';
    ctx.fillText(`${dnIcon} ${isNight ? 'Night' : 'Day'}`, 4, 36);

    // Energy bar
    const eMax = getEnergyMax();
    const eFrac = energy / eMax;
    const eBarX = 4;
    const eBarY = 42;
    const eBarW = 80;
    const eBarH = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(eBarX, eBarY, eBarW, eBarH);
    const eColor = eFrac > 0.5 ? '#0cf' : eFrac > 0.2 ? '#fa0' : '#f44';
    ctx.fillStyle = eColor;
    ctx.fillRect(eBarX, eBarY, eBarW * eFrac, eBarH);
    ctx.strokeStyle = '#48a';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(eBarX, eBarY, eBarW, eBarH);
    ctx.fillStyle = '#adf';
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'left';
    const eRegen = getEnergyRegenRate();
    ctx.fillText(`Energy: ${Math.round(energy)}/${eMax} (+${eRegen.toFixed(1)}/s)`, eBarX + eBarW + 4, eBarY + 7);
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (state === STATE_PLAYING || state === STATE_GAME_OVER) {
      drawGrid();
      drawAnimals();
      drawLivestock();
      drawDayNightOverlay();
      drawWeatherOverlay();
      drawUI();
      drawDragSelection();
      drawInventoryPanel();
      drawSeasonAndDayNightHUD();
      drawUpgradeShop();
      drawLivestockShop();
    }

    drawHUD();
    drawTooltip();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = canvasW / 2, pw = 380, ph = 220, px = cx - pw / 2, py = (canvasH - ph) / 2;
    ctx.fillStyle = 'rgba(5,20,10,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#5d5';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#5d5';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(page.title, cx, py + 30);
    ctx.fillStyle = '#ccc';
    ctx.font = '13px sans-serif';
    for (let i = 0; i < page.lines.length; ++i)
      ctx.fillText(page.lines[i], cx, py + 58 + i * 22);
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    if (tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
  }

  /* ══════════════════════════════════════════════════════════════════
     TOOLTIP
     ══════════════════════════════════════════════════════════════════ */

  function buildCropTileTooltip(cell, row, col) {
    const crop = CROPS[cell.cropIndex];
    const maxStage = crop.stages - 1;
    const mature = cell.growthStage >= maxStage;
    const progress = Math.min(100, Math.round(cell.growthProgress * 100));
    const effPrice = getEffectiveSellPrice(crop);
    const lines = [
      { text: crop.icon + ' ' + crop.name, color: crop.color, bold: true }
    ];
    if (mature)
      lines.push({ text: 'Ready to harvest! (click)', color: '#0f0' });
    else
      lines.push({ text: 'Stage ' + (cell.growthStage + 1) + '/' + crop.stages + ' -- ' + progress + '% grown', color: '#aaa' });
    lines.push({ text: 'Sell price: ' + effPrice + ' cr' + (effPrice !== crop.sellPrice ? ' (base ' + crop.sellPrice + ')' : ''), color: '#da2' });
    const sq = getTileSoilQuality(row, col);
    if (sq < 1.0)
      lines.push({ text: 'Fertility: ' + Math.round(sq * 100) + '% (slower growth)', color: '#ca4' });
    else if (sq > 1.0)
      lines.push({ text: 'Fertility: ' + Math.round(sq * 100) + '% (faster growth)', color: '#4d4' });
    const tt = tileTypes[row]?.[col] ?? TILE_FARMLAND;
    if (tt === TILE_SAND)
      lines.push({ text: 'Sandy soil: 0.7x growth rate', color: '#c90' });
    // Water adjacency info
    let adjWater = 0;
    if (row > 0 && tileTypes[row - 1]?.[col] === TILE_WATER) ++adjWater;
    if (row < gridRows - 1 && tileTypes[row + 1]?.[col] === TILE_WATER) ++adjWater;
    if (col > 0 && tileTypes[row]?.[col - 1] === TILE_WATER) ++adjWater;
    if (col < gridCols - 1 && tileTypes[row]?.[col + 1] === TILE_WATER) ++adjWater;
    if (adjWater > 0)
      lines.push({ text: 'Water bonus: +' + Math.round(adjWater * 15) + '% growth', color: '#4af' });
    const yieldMul = getYieldMultiplier();
    if (yieldMul > 1)
      lines.push({ text: 'Yield bonus: ' + Math.round((yieldMul - 1) * 100) + '% chance double', color: '#ff0' });
    return lines;
  }

  function buildBuildingTileTooltip(bld, row, col) {
    const bdef = BUILDINGS[bld.typeIndex];
    const bLvl = bld.level || 1;
    const lines = [
      { text: bdef.icon + ' ' + bdef.name + (bLvl > 1 ? ' L' + bLvl : ''), color: '#0ff', bold: true },
      { text: bdef.desc, color: '#aaa' }
    ];

    // Level-specific info per building type
    if (bdef.name === 'Sprinkler') {
      lines.push({ text: `Growth bonus: +${Math.round(getSprinklerBonus(bld) * 100)}% | Range: ${getBuildingRange(bld)}`, color: '#4af' });
    } else if (bdef.name === 'Harvester') {
      lines.push({ text: `Interval: ${getHarvesterInterval(bld).toFixed(1)}s | Range: ${getBuildingRange(bld)}`, color: '#4af' });
    } else if (bdef.name === 'Greenhouse') {
      lines.push({ text: `Protection range: ${getBuildingRange(bld)} | Growth bonus: +${Math.round(getGreenhouseGrowthBonus(bld) * 100)}%`, color: '#4af' });
    } else if (bdef.name === 'Silo') {
      const curCap = getStorageCapacity();
      lines.push({ text: `Storage: ${getTotalInventoryCount()}/${curCap} (+${getSiloStorageBonus(bld)} this silo)`, color: '#da2' });
      lines.push({ text: `Sell bonus: +${Math.round(getSiloSellBonus(bld) * 100)}%`, color: '#4af' });
    } else if (bdef.name === 'Solar Panel') {
      lines.push({ text: `Income: +${getSolarPanelIncome(bld)}cr/cycle | Energy: +${getSolarPanelEnergyBonus(bld)} max, +${getSolarPanelRegenBonus(bld).toFixed(1)}/s regen`, color: '#ff0' });
    } else if (bdef.name === 'Wind Turbine') {
      lines.push({ text: `Income: +${getWindTurbineIncome(bld)}cr/cycle | Growth: +${Math.round(getWindTurbineGrowthBonus(bld) * 100)}%`, color: '#ff0' });
      lines.push({ text: `Energy: +${getWindTurbineEnergyBonus(bld)} max, +${getWindTurbineRegenBonus(bld).toFixed(1)}/s regen`, color: '#0cf' });
    } else if (bdef.name === 'Compost Bin') {
      lines.push({ text: `Fertility: +${Math.round(getCompostBinBonus(bld) * 100)}% | Range: ${getBuildingRange(bld)}`, color: '#4af' });
    } else if (bdef.name === 'Scarecrow') {
      const r = getScarecrowRadius(bld);
      lines.push({ text: `Scare area: ${r * 2 + 1}x${r * 2 + 1}`, color: '#4af' });
    } else if (bdef.name === 'Fence') {
      if (bLvl >= 5)
        lines.push({ text: 'Blocks AND damages animals', color: '#f44' });
      else if (bLvl >= 3)
        lines.push({ text: 'Slows animals that try to pass', color: '#fa0' });
    } else if (bdef.name === 'Auto-Planter L1' || bdef.name === 'Auto-Planter L2') {
      lines.push({ text: `Interval: ${getAutoPlanterInterval(bld)}s | Range: ${getBuildingRange(bld)}`, color: '#4af' });
    } else if (bdef.name === 'Auto-Collector') {
      lines.push({ text: `Interval: ${getAutoCollectorInterval(bld)}s | Range: ${getBuildingRange(bld)}`, color: '#4af' });
      // Count livestock in range
      const acRange = getBuildingRange(bld);
      let pensInRange = 0;
      for (const pen of livestockPens)
        if (Math.abs(pen.gridRow - row) <= acRange && Math.abs(pen.gridCol - col) <= acRange)
          ++pensInRange;
      lines.push({ text: `Livestock in range: ${pensInRange}`, color: '#0cf' });
    }

    // Upgrade info
    if (canUpgradeBuilding(bld)) {
      const cost = getBuildingUpgradeCost(bld);
      lines.push({ text: `Upgrade to L${bLvl + 1}: ${cost}cr (right-click)`, color: credits >= cost ? '#0f0' : '#f44' });
    } else {
      lines.push({ text: 'MAX LEVEL', color: '#0a0' });
    }

    lines.push({ text: 'Shift+right-click to remove', color: '#666' });
    return lines;
  }

  function buildRockTileTooltip() {
    return [
      { text: 'Rocky terrain', color: '#888', bold: true },
      { text: 'Can place buildings or grow crops here', color: '#666' }
    ];
  }

  function buildWaterTileTooltip() {
    return [
      { text: 'Water source', color: '#4af', bold: true },
      { text: 'Boosts growth of adjacent crops (+15%)', color: '#8cf' },
      { text: 'Cannot be built on', color: '#666' }
    ];
  }

  function buildEmptyTileTooltip(row, col) {
    const tt = tileTypes[row]?.[col] ?? TILE_FARMLAND;
    if (tt === TILE_WATER) return buildWaterTileTooltip();

    const crop = CROPS[selectedCropIndex];
    const sq = getTileSoilQuality(row, col);
    const lines = [
      { text: 'Empty plot', color: '#999', bold: true }
    ];
    if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0)
      lines.push({ text: 'Click to place ' + BUILDINGS[selectedBuildingIndex].icon + ' ' + BUILDINGS[selectedBuildingIndex].name + ' (' + BUILDINGS[selectedBuildingIndex].cost + ' cr)', color: '#0ff' });
    else
      lines.push({ text: 'Click to plant ' + crop.icon + ' ' + crop.name + ' (' + crop.seedCost + ' cr)', color: '#aaa' });
    if (sq < 1.0)
      lines.push({ text: 'Fertility: ' + Math.round(sq * 100) + '% (slower growth)', color: '#ca4' });
    else if (sq > 1.0)
      lines.push({ text: 'Fertility: ' + Math.round(sq * 100) + '% (enhanced growth)', color: '#4d4' });
    if (tt === TILE_SAND)
      lines.push({ text: 'Sandy soil: 0.7x growth rate', color: '#c90' });
    if (tt === TILE_ROCK)
      lines.push({ text: 'Rocky terrain', color: '#888' });
    // Water adjacency info
    let adjWater = 0;
    if (row > 0 && tileTypes[row - 1]?.[col] === TILE_WATER) ++adjWater;
    if (row < gridRows - 1 && tileTypes[row + 1]?.[col] === TILE_WATER) ++adjWater;
    if (col > 0 && tileTypes[row]?.[col - 1] === TILE_WATER) ++adjWater;
    if (col < gridCols - 1 && tileTypes[row]?.[col + 1] === TILE_WATER) ++adjWater;
    if (adjWater > 0)
      lines.push({ text: 'Water bonus: +' + Math.round(adjWater * 15) + '% growth', color: '#4af' });
    return lines;
  }

  function buildCropBarTooltip(cropIndex) {
    const crop = CROPS[cropIndex];
    const effPrice = getEffectiveSellPrice(crop);
    const pm = priceMultipliers[cropIndex] || 1;
    const lines = [
      { text: crop.icon + ' ' + crop.name, color: crop.color, bold: true },
      { text: 'Seed cost: ' + crop.seedCost + ' cr', color: '#aaa' },
      { text: 'Sell price: ' + effPrice + ' cr' + (effPrice !== crop.sellPrice ? ' (base ' + crop.sellPrice + ')' : ''), color: '#da2' }
    ];
    if (pm > 1.05)
      lines.push({ text: 'Market: ' + pm.toFixed(2) + 'x (high!)', color: '#0c0' });
    else if (pm < 0.95)
      lines.push({ text: 'Market: ' + pm.toFixed(2) + 'x (low)', color: '#f44' });
    lines.push({ text: 'Grow time: ' + crop.growTime + 's -- ' + crop.stages + ' stages', color: '#8cf' });
    if (crop.weatherAffinity === 'any')
      lines.push({ text: 'Grows in any weather, meteor-immune', color: '#a7f' });
    else if (crop.weatherAffinity === 'solar')
      lines.push({ text: 'Boosted by solar flares (3x growth)', color: '#8af' });
    else if (crop.weatherAffinity === 'cold-vulnerable')
      lines.push({ text: 'Vulnerable to meteor showers!', color: '#f88' });
    if (crop.nightOnly)
      lines.push({ text: 'Only grows at night', color: '#88a' });
    if (crop.dayOnly)
      lines.push({ text: 'Only grows during day', color: '#ff8' });
    return lines;
  }

  function buildSellButtonTooltip() {
    let totalItems = 0;
    let totalValue = 0;
    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      totalItems += count;
      totalValue += count * getEffectiveSellPrice(crop);
    }
    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      totalItems += count;
      totalValue += count * getEffectiveProduceValue(live);
    }
    const lines = [
      { text: 'Sell All Produce', color: '#0f0', bold: true }
    ];
    if (totalItems > 0)
      lines.push({ text: totalItems + ' items worth ' + totalValue + ' cr', color: '#da2' });
    else
      lines.push({ text: 'No produce in inventory', color: '#888' });
    lines.push({ text: 'Shortcut: S', color: '#666' });
    return lines;
  }

  function buildLivestockBuyTooltip(typeIndex) {
    const def = LIVESTOCK[typeIndex];
    return [
      { text: def.icon + ' ' + def.name, color: '#fff', bold: true },
      { text: 'Cost: ' + def.cost + ' cr', color: '#f88' },
      { text: 'Produces: ' + def.produceIcon + ' ' + def.produce + ' (' + getEffectiveProduceValue(def) + ' cr)', color: '#da2' },
      { text: 'Every ' + def.feedInterval + 's — click pen to collect', color: '#8cf' }
    ];
  }

  function buildLivestockPenTooltip(pen) {
    const def = LIVESTOCK[pen.typeIndex];
    const lines = [
      { text: def.icon + ' ' + def.name, color: '#fff', bold: true }
    ];
    if (pen.produceReady)
      lines.push({ text: def.produceIcon + ' ' + def.produce + ' ready! (click to collect)', color: '#0f0' });
    else {
      const remaining = Math.max(0, Math.ceil(pen.feedTimer));
      lines.push({ text: 'Next ' + def.produce + ' in ' + remaining + 's', color: '#aaa' });
    }
    lines.push({ text: 'Value: ' + getEffectiveProduceValue(def) + ' cr each', color: '#da2' });
    return lines;
  }

  function buildStatTooltip(id) {
    switch (id) {
      case 'credits':
        return [{ text: 'Credits — your currency', color: '#ff0', bold: true }, { text: 'Earn by selling produce (S)', color: '#aaa' }];
      case 'day': {
        const lines = [
          { text: 'Day ' + dayCount + ' | ' + SEASONS[currentSeason], color: '#8cf', bold: true },
          { text: 'Days pass every 30 seconds of playtime', color: '#aaa' },
          { text: 'Season changes every ' + SEASON_DURATION + ' days', color: '#aaa' }
        ];
        const isNight = dayPhase >= 0.5;
        lines.push({ text: isNight ? 'Night phase: some crops sleep' : 'Day phase: solar crops thrive', color: isNight ? '#88a' : '#ff8' });
        return lines;
      }
      case 'weather':
        if (weatherType === WEATHER_SOLAR_FLARE)
          return [{ text: 'Solar Flare active', color: '#ff0', bold: true }, { text: 'Crop growth speed doubled!', color: '#0f0' }];
        if (weatherType === WEATHER_METEOR_SHOWER)
          return [{ text: 'Meteor Shower active', color: '#f44', bold: true }, { text: 'Random crops may be destroyed!', color: '#f88' }];
        return [{ text: 'Weather: Clear', color: '#8cf', bold: true }, { text: 'No active weather events', color: '#aaa' }];
      default:
        return [];
    }
  }

  function updateTooltip(mx, my) {
    tooltipX = mx;
    tooltipY = my;
    tooltipLines = [];

    if (state !== STATE_PLAYING) return;

    // Check UI elements FIRST so grid tooltips don't show through UI overlays

    // Check building bar area
    const bldBarY = canvasH - 75;
    if (my >= bldBarY && my < bldBarY + 28) {
      const BLD_BTN_W = 56;
      const BLD_BTN_GAP = 4;
      const bldStartX = CROP_BAR_X + 60;
      const bldIdx = Math.floor((mx - bldStartX) / (BLD_BTN_W + BLD_BTN_GAP));
      if (bldIdx >= 0 && bldIdx < BUILDINGS.length && mx >= bldStartX) {
        const bdef = BUILDINGS[bldIdx];
        tooltipLines = [
          { text: bdef.icon + ' ' + bdef.name, color: '#0ff', bold: true },
          { text: 'Cost: ' + bdef.cost + ' cr', color: '#f88' },
          { text: bdef.desc, color: '#aaa' },
          { text: 'Range: ' + (bdef.range > 0 ? 'adjacent tiles' : 'global') + ' | Upgradeable to L6', color: '#8cf' }
        ];
        // Silo tooltip enhancement: show storage capacity increase
        if (bdef.name === 'Silo') {
          const curCap = getStorageCapacity();
          tooltipLines.push({ text: `Storage: ${getTotalInventoryCount()}/${curCap} (+50 per silo at L1)`, color: '#da2' });
        }
        // Solar Panel electricity info
        if (bdef.name === 'Solar Panel')
          tooltipLines.push({ text: 'Also provides +25 max energy, +0.5/s regen at L1', color: '#0cf' });
        // Wind Turbine electricity info
        if (bdef.name === 'Wind Turbine')
          tooltipLines.push({ text: 'Also provides +15 max energy, +0.3/s regen at L1', color: '#0cf' });
        // Auto-Collector info
        if (bdef.name === 'Auto-Collector')
          tooltipLines.push({ text: 'Place near perimeter livestock pens to auto-collect', color: '#0cf' });
        return;
      }
    }

    // Check livestock pens (grid-relative positions converted to screen)
    const penTs = BASE_TILE_SIZE * viewZoom;
    const penHalf = penTs / 2;
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const scr = livestockPenToScreen(pen);
      if (mx >= scr.x - penHalf && mx <= scr.x + penHalf && my >= scr.y - penHalf && my <= scr.y + penHalf) {
        tooltipLines = buildLivestockPenTooltip(pen);
        return;
      }
    }

    // Check crop selection bar
    const barY = canvasH - 45;
    if (my >= barY && my <= canvasH) {
      // Right-side buttons: HOE | SELL | LIVESTOCK | UPGRADES (same layout as drawUI)
      const ttUpgBtnX = canvasW - 78;
      const ttLivBtnX = ttUpgBtnX - 77;
      const ttSellBtnX = ttLivBtnX - 67;
      const ttHoeBtnX = ttSellBtnX - 65;

      // Upgrades button
      if (mx >= ttUpgBtnX && mx <= ttUpgBtnX + 70) {
        tooltipLines = [
          { text: 'Upgrade Shop', color: '#ff0', bold: true },
          { text: 'Buy permanent farm upgrades', color: '#aaa' },
          { text: 'Shortcut: U', color: '#666' }
        ];
        return;
      }
      // Livestock button
      if (mx >= ttLivBtnX && mx <= ttLivBtnX + 70) {
        tooltipLines = [
          { text: 'Livestock Shop', color: '#0fc', bold: true },
          { text: 'Buy livestock for your farm perimeter', color: '#aaa' },
          { text: `Pens: ${livestockPens.length} owned`, color: '#8cf' },
          { text: 'Shortcut: L', color: '#666' }
        ];
        return;
      }
      // Sell button
      if (mx >= ttSellBtnX && mx <= ttSellBtnX + 60) {
        tooltipLines = buildSellButtonTooltip();
        return;
      }
      // Hoe button
      if (mx >= ttHoeBtnX && mx <= ttHoeBtnX + 58) {
        tooltipLines = [
          { text: '\u26CF\uFE0F Hoe Tool', color: '#fa0', bold: true },
          { text: 'Left-click farmland near water: +0.2 fertility (max 1.5)', color: '#4d4' },
          { text: 'Right-click on crop: uproot (refund 50% seed cost)', color: '#f88' },
          { text: 'Shortcut: T', color: '#666' }
        ];
        return;
      }
      // Crop buttons
      const cropIdx = Math.floor((mx - CROP_BAR_X) / (CROP_BTN_W + CROP_BTN_GAP));
      if (cropIdx >= 0 && cropIdx < CROPS.length && mx >= CROP_BAR_X && mx <= CROP_BAR_X + CROPS.length * (CROP_BTN_W + CROP_BTN_GAP)) {
        tooltipLines = buildCropBarTooltip(cropIdx);
        return;
      }
    }

    // Check HUD header area for weather/day/credits
    if (my < GRID_OFFSET_Y) {
      if (mx < canvasW / 3)
        tooltipLines = buildStatTooltip('weather');
      else if (mx < canvasW * 2 / 3)
        tooltipLines = buildStatTooltip('day');
      else
        tooltipLines = buildStatTooltip('credits');
      return;
    }

    // Check farm grid (AFTER all UI elements so tooltips don't bleed through)
    const { col, row } = canvasToGrid(mx, my);
    if (isInsideGrid(col, row)) {
      const tt = tileTypes[row]?.[col] ?? TILE_FARMLAND;
      if (tt === TILE_WATER) { tooltipLines = buildWaterTileTooltip(); return; }
      const bld = buildings[row]?.[col];
      if (bld) { tooltipLines = buildBuildingTileTooltip(bld, row, col); return; }
      const cell = farmGrid[row][col];
      tooltipLines = cell ? buildCropTileTooltip(cell, row, col) : buildEmptyTileTooltip(row, col);
      return;
    }
  }

  function drawTooltip() {
    if (!tooltipLines.length || state !== STATE_PLAYING) return;

    ctx.save();
    ctx.font = '11px sans-serif';

    const padding = 8;
    const lineH = 16;
    let maxW = 0;
    for (const line of tooltipLines) {
      const t = typeof line === 'object' ? String(line.text || '') : String(line);
      const w = ctx.measureText(t).width;
      if (w > maxW)
        maxW = w;
    }
    const boxW = maxW + padding * 2;
    const boxH = tooltipLines.length * lineH + padding * 2;

    // Position near cursor; prefer right-below, flip if off-screen
    let tx = tooltipX + 14;
    let ty = tooltipY + 18;
    if (tx + boxW > canvasW - 4)
      tx = tooltipX - boxW - 8;
    if (ty + boxH > canvasH - 4)
      ty = tooltipY - boxH - 8;
    if (tx < 4)
      tx = 4;
    if (ty < 4)
      ty = 4;

    // Rounded background
    const r = 4;
    ctx.fillStyle = 'rgba(10, 15, 10, 0.92)';
    ctx.strokeStyle = 'rgba(100, 200, 100, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx + r, ty);
    ctx.lineTo(tx + boxW - r, ty);
    ctx.arcTo(tx + boxW, ty, tx + boxW, ty + r, r);
    ctx.lineTo(tx + boxW, ty + boxH - r);
    ctx.arcTo(tx + boxW, ty + boxH, tx + boxW - r, ty + boxH, r);
    ctx.lineTo(tx + r, ty + boxH);
    ctx.arcTo(tx, ty + boxH, tx, ty + boxH - r, r);
    ctx.lineTo(tx, ty + r);
    ctx.arcTo(tx, ty, tx + r, ty, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw text lines
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < tooltipLines.length; ++i) {
      const line = tooltipLines[i];
      const text = typeof line === 'object' ? String(line.text || '') : String(line);
      const color = (typeof line === 'object' ? line.color : null) || '#ddd';
      ctx.fillStyle = color;
      ctx.font = (line && line.bold) ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.fillText(text, tx + padding, ty + padding + (i + 1) * lineH - 4);
    }

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusCredits) statusCredits.textContent = `Credits: ${credits}`;
    if (statusTool) {
      if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0)
        statusTool.textContent = `Tool: Build (${BUILDINGS[selectedBuildingIndex].name})`;
      else
        statusTool.textContent = `Tool: ${selectedTool}`;
    }
    if (statusWeather) statusWeather.textContent = `Weather: ${weatherType === WEATHER_NONE ? 'Clear' : weatherType}`;
    if (statusDay) statusDay.textContent = `Day: ${dayCount} | ${SEASONS[currentSeason]} | ${dayPhase < 0.5 ? 'Day' : 'Night'}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

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
      if (state === STATE_PLAYING || state === STATE_PAUSED || state === STATE_READY) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (showUpgradeShop) {
        showUpgradeShop = false;
        return;
      }
      if (showLivestockShop) {
        showLivestockShop = false;
        return;
      }
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    // Number keys 1-9, 0 to select crop
    if (state === STATE_PLAYING) {
      const num = parseInt(e.key);
      // 0 maps to crop index 9 (10th crop)
      if (e.key === '0' && CROPS.length >= 10) {
        selectedCropIndex = 9;
        selectedTool = TOOL_PLANT;
      } else if (num >= 1 && num <= CROPS.length) {
        selectedCropIndex = num - 1;
        selectedTool = TOOL_PLANT;
      }
      if (e.code === 'KeyS')
        sellAllProduce();
      if (e.code === 'KeyU') {
        showUpgradeShop = !showUpgradeShop;
        showLivestockShop = false;
        return;
      }
      if (e.code === 'KeyL') {
        showLivestockShop = !showLivestockShop;
        showUpgradeShop = false;
        return;
      }
      if (e.code === 'KeyB') {
        // Toggle building mode: cycle through buildings or cancel
        if (selectedTool === TOOL_BUILD) {
          ++selectedBuildingIndex;
          if (selectedBuildingIndex >= BUILDINGS.length) {
            selectedBuildingIndex = -1;
            selectedTool = TOOL_PLANT;
          }
        } else {
          selectedBuildingIndex = 0;
          selectedTool = TOOL_BUILD;
        }
        return;
      }
      if (e.code === 'KeyT') {
        // Toggle hoe tool
        selectedTool = selectedTool === TOOL_HOE ? TOOL_PLANT : TOOL_HOE;
        selectedBuildingIndex = -1;
        return;
      }
      if (e.code === 'Home') {
        resetView();
        return;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Pointer coordinate helpers ── */

  function pointerToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasW / rect.width),
      y: (e.clientY - rect.top) * (canvasH / rect.height)
    };
  }

  function canvasToGrid(cx, cy) {
    // Invert zoom/pan transform: screen -> world -> grid
    const wx = (cx - viewPanX) / viewZoom;
    const wy = (cy - viewPanY) / viewZoom;
    return {
      col: Math.floor((wx - GRID_OFFSET_X) / BASE_TILE_SIZE),
      row: Math.floor((wy - GRID_OFFSET_Y) / BASE_TILE_SIZE)
    };
  }

  function isInsideGrid(col, row) {
    return col >= 0 && col < gridCols && row >= 0 && row < gridRows;
  }

  /** Returns the grid-clamped selection rectangle { r0, c0, r1, c1 } from drag coordinates. */
  function getDragGridRect() {
    const a = canvasToGrid(dragStartX, dragStartY);
    const b = canvasToGrid(dragCurrentX, dragCurrentY);
    return {
      c0: Math.max(0, Math.min(a.col, b.col)),
      r0: Math.max(0, Math.min(a.row, b.row)),
      c1: Math.min(gridCols - 1, Math.max(a.col, b.col)),
      r1: Math.min(gridRows - 1, Math.max(a.row, b.row))
    };
  }

  /** Apply plant/harvest action to all tiles inside the drag selection. */
  function applyDragAction() {
    if (selectedTool === TOOL_BUILD) return; // building uses single click
    const { r0, c0, r1, c1 } = getDragGridRect();
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        if (selectedTool === TOOL_HOE) {
          hoeFertilize(r, c);
          continue;
        }
        const tt = tileTypes[r]?.[c] ?? TILE_FARMLAND;
        if (tt === TILE_WATER) continue;
        if (buildings[r]?.[c]) continue;
        const cell = farmGrid[r][c];
        if (cell === null)
          plantCrop(r, c);
        else {
          const crop = CROPS[cell.cropIndex];
          if (cell.growthStage >= crop.stages - 1)
            harvestCrop(r, c);
        }
      }
  }

  /* ── Click/Tap/Drag handling ── */

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

    if (state !== STATE_PLAYING) return;

    // Middle mouse button, right-click, or ctrl+left for panning (Feature 1)
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      isPanning = true;
      panButton = e.button;
      const { x, y } = pointerToCanvas(e);
      panLastX = x;
      panLastY = y;
      // Track right-click start for short-click detection
      if (e.button === 2) {
        rightClickStartX = x;
        rightClickStartY = y;
      }
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    const { x: mx, y: my } = pointerToCanvas(e);

    // Check upgrade shop clicks first (it overlays everything)
    if (showUpgradeShop) {
      const panelW = 300;
      const ROW_H = 48;
      const headerH = 30;
      const footerH = 16;
      const contentH = UPGRADES.length * ROW_H;
      const maxVisH = canvasH - 60;
      const panelH = Math.min(headerH + contentH + footerH, maxVisH);
      const px = Math.round((canvasW - panelW) / 2);
      const py = Math.round((canvasH - panelH) / 2) - 10;

      if (mx >= px && mx <= px + panelW && my >= py && my <= py + panelH) {
        // Check buy button clicks
        for (let i = 0; i < UPGRADES.length; ++i) {
          const btnX = px + panelW - 66;
          const btnY = py + headerH + i * ROW_H - upgradeShopScroll + 5;
          if (mx >= btnX && mx <= btnX + 54 && my >= btnY && my <= btnY + 20) {
            purchaseUpgrade(i);
            return;
          }
        }
        return; // click inside panel but not on a button
      }
      // Click outside panel closes it
      showUpgradeShop = false;
      return;
    }

    // Check livestock shop clicks (it overlays everything)
    if (showLivestockShop) {
      const panelW = 280;
      const ROW_H = 48;
      const headerH = 30;
      const footerH = 16;
      const contentH = LIVESTOCK.length * ROW_H;
      const maxVisH = canvasH - 60;
      const panelH = Math.min(headerH + contentH + footerH, maxVisH);
      const px = Math.round((canvasW - panelW) / 2);
      const py = Math.round((canvasH - panelH) / 2) - 10;

      if (mx >= px && mx <= px + panelW && my >= py && my <= py + panelH) {
        // Check buy button clicks
        for (let i = 0; i < LIVESTOCK.length; ++i) {
          const btnX = px + panelW - 66;
          const btnY = py + headerH + i * ROW_H - livestockShopScroll + 5;
          if (mx >= btnX && mx <= btnX + 54 && my >= btnY && my <= btnY + 20) {
            buyLivestock(i);
            return;
          }
        }
        return; // click inside panel but not on a button
      }
      // Click outside panel closes it
      showLivestockShop = false;
      return;
    }

    // Check UI elements FIRST so clicks don't fall through to the grid below

    // Check building bar area
    const bldBarY = canvasH - 75;
    if (my >= bldBarY && my < bldBarY + 28) {
      const BLD_BTN_W = 56;
      const BLD_BTN_GAP = 4;
      const bldStartX = CROP_BAR_X + 60;

      // Cancel button
      if (selectedTool === TOOL_BUILD) {
        const cancelX = bldStartX + BUILDINGS.length * (BLD_BTN_W + BLD_BTN_GAP) + 4;
        if (mx >= cancelX && mx <= cancelX + 40) {
          selectedTool = TOOL_PLANT;
          selectedBuildingIndex = -1;
          return;
        }
      }

      const bldIdx = Math.floor((mx - bldStartX) / (BLD_BTN_W + BLD_BTN_GAP));
      if (bldIdx >= 0 && bldIdx < BUILDINGS.length && mx >= bldStartX) {
        selectedBuildingIndex = bldIdx;
        selectedTool = TOOL_BUILD;
        return;
      }
    }

    // Check bottom bar buttons (same layout as drawUI)
    const barY = canvasH - 45;
    const clkUpgBtnX = canvasW - 78;
    const clkLivBtnX = clkUpgBtnX - 77;
    const clkSellBtnX = clkLivBtnX - 67;
    const clkHoeBtnX = clkSellBtnX - 65;

    // Upgrades button
    if (mx >= clkUpgBtnX && mx <= clkUpgBtnX + 70 && my >= barY + 4 && my <= barY + 41) {
      showUpgradeShop = !showUpgradeShop;
      showLivestockShop = false;
      return;
    }

    // Livestock button
    if (mx >= clkLivBtnX && mx <= clkLivBtnX + 70 && my >= barY + 4 && my <= barY + 41) {
      showLivestockShop = !showLivestockShop;
      showUpgradeShop = false;
      return;
    }

    // Sell button
    if (mx >= clkSellBtnX && mx <= clkSellBtnX + 60 && my >= barY + 4 && my <= barY + 41) {
      sellAllProduce();
      return;
    }

    // Hoe button
    if (mx >= clkHoeBtnX && mx <= clkHoeBtnX + 58 && my >= barY + 4 && my <= barY + 41) {
      selectedTool = selectedTool === TOOL_HOE ? TOOL_PLANT : TOOL_HOE;
      selectedBuildingIndex = -1;
      return;
    }

    // Check crop selection bar (entire bottom bar area absorbs clicks)
    if (my >= barY && my <= canvasH) {
      const cropIdx = Math.floor((mx - CROP_BAR_X) / (CROP_BTN_W + CROP_BTN_GAP));
      if (cropIdx >= 0 && cropIdx < CROPS.length && mx >= CROP_BAR_X && mx <= CROP_BAR_X + CROPS.length * (CROP_BTN_W + CROP_BTN_GAP)) {
        selectedCropIndex = cropIdx;
        selectedTool = TOOL_PLANT;
        selectedBuildingIndex = -1;
      }
      return;
    }

    // Check if click is inside farm grid -- start drag or place building
    const { col, row } = canvasToGrid(mx, my);
    if (isInsideGrid(col, row)) {
      // Building placement mode: single click places building
      if (selectedTool === TOOL_BUILD && selectedBuildingIndex >= 0) {
        placeBuilding(row, col);
        return;
      }
      // Hoe tool: enters drag mode like plant/harvest (applied on release)
      isDragging = true;
      dragStartedOnGrid = true;
      dragStartX = mx;
      dragStartY = my;
      dragCurrentX = mx;
      dragCurrentY = my;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Check livestock pen click (feeding/collecting) -- use screen-converted positions
    const clkPenTs = BASE_TILE_SIZE * viewZoom;
    const clkPenHalf = clkPenTs / 2;
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const scr = livestockPenToScreen(pen);
      if (mx >= scr.x - clkPenHalf && mx <= scr.x + clkPenHalf && my >= scr.y - clkPenHalf && my <= scr.y + clkPenHalf) {
        feedAndCollect(i);
        return;
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = pointerToCanvas(e);

    // Panning
    if (isPanning) {
      viewPanX += x - panLastX;
      viewPanY += y - panLastY;
      clampPan();
      panLastX = x;
      panLastY = y;
      return;
    }

    // Tooltip tracking (always active)
    if (!isDragging)
      updateTooltip(x, y);

    // Drag tracking
    if (isDragging) {
      dragCurrentX = x;
      dragCurrentY = y;
    }
  });

  canvas.addEventListener('pointerleave', () => {
    tooltipLines = [];
  });

  // Prevent context menu on middle-click
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerup', (e) => {
    if (isPanning) {
      isPanning = false;
      const releasedButton = panButton;
      panButton = -1;
      canvas.releasePointerCapture(e.pointerId);

      // Feature 1: short right-click = upgrade building, shift+right-click = remove building, or click animal
      if (releasedButton === 2 && state === STATE_PLAYING) {
        const { x, y } = pointerToCanvas(e);
        const dx = x - rightClickStartX;
        const dy = y - rightClickStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          // Check for animal click first
          let clickedAnimal = false;
          for (let i = wildAnimals.length - 1; i >= 0; --i) {
            const animal = wildAnimals[i];
            const g = gridToScreen(animal.x, animal.y);
            const ax = g.x + g.size / 2;
            const ay = g.y + g.size / 2;
            const adist = Math.sqrt((x - ax) * (x - ax) + (y - ay) * (y - ay));
            if (adist < 15 * viewZoom) {
              // Kill animal for credits
              credits += 10;
              const { x: tx, y: ty } = gridCenterToScreen(Math.round(animal.x), Math.round(animal.y));
              floatingText.add(tx, ty - 10, '+10cr', { color: '#0f0', font: 'bold 13px sans-serif' });
              floatingText.add(tx, ty + 5, 'Pest eliminated!', { color: '#fa0', font: 'bold 10px sans-serif' });
              particles.burst(tx, ty, 8, { color: '#f44', speed: 3, life: 0.4 });
              screenShake.trigger(2, 100);
              wildAnimals.splice(i, 1);
              clickedAnimal = true;
              break;
            }
          }
          if (!clickedAnimal) {
            const { col, row } = canvasToGrid(x, y);
            if (isInsideGrid(col, row)) {
              // Hoe right-click: uproot crop
              if (selectedTool === TOOL_HOE && farmGrid[row]?.[col])
                hoeUproot(row, col);
              else if (e.shiftKey)
                removeBuilding(row, col);
              else if (buildings[row]?.[col])
                upgradeBuilding(row, col);
              else
                removeBuilding(row, col);
            }
          }
        }
      }
      return;
    }
    if (!isDragging) return;
    isDragging = false;
    dragStartedOnGrid = false;
    canvas.releasePointerCapture(e.pointerId);

    if (state !== STATE_PLAYING) return;
    applyDragAction();
  });

  canvas.addEventListener('pointercancel', (e) => {
    if (isPanning) {
      isPanning = false;
      panButton = -1;
      canvas.releasePointerCapture(e.pointerId);
      return;
    }
    if (!isDragging) return;
    isDragging = false;
    dragStartedOnGrid = false;
    canvas.releasePointerCapture(e.pointerId);
  });

  /* ── Zoom & Pan helpers ── */

  function clampPan() {
    // Keep the grid at least partially visible
    const ts = BASE_TILE_SIZE * viewZoom;
    const gridW = gridCols * ts;
    const gridH = gridRows * ts;
    const ox = GRID_OFFSET_X * viewZoom;
    const oy = GRID_OFFSET_Y * viewZoom;

    // Don't let the grid scroll entirely off-screen
    const margin = 60;
    viewPanX = Math.max(-gridW - ox + margin, Math.min(canvasW - ox - margin, viewPanX));
    viewPanY = Math.max(-gridH - oy + margin, Math.min(canvasH - oy - margin - 45, viewPanY));
  }

  function resetView() {
    viewZoom = 1.0;
    viewPanX = 0;
    viewPanY = 0;
  }

  canvas.addEventListener('wheel', (e) => {
    if (state !== STATE_PLAYING) return;
    e.preventDefault();

    // Scroll upgrade shop if open
    if (showUpgradeShop) {
      upgradeShopScroll += e.deltaY > 0 ? 40 : -40;
      return;
    }
    // Scroll livestock shop if open
    if (showLivestockShop) {
      livestockShopScroll += e.deltaY > 0 ? 40 : -40;
      return;
    }

    const { x: mx, y: my } = pointerToCanvas(e);

    // Zoom toward cursor position
    const oldZoom = viewZoom;
    const zoomStep = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(VIEW_ZOOM_MAX, viewZoom * zoomStep));

    // Adjust pan so the point under the cursor stays fixed
    const zoomRatio = viewZoom / oldZoom;
    viewPanX = mx - (mx - viewPanX) * zoomRatio;
    viewPanY = my - (my - viewPanY) * zoomRatio;
    clampPan();
  }, { passive: false });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = state === STATE_GAME_OVER
      ? `Space Farming — Season Over — ${credits}cr`
      : `Space Farming — Day ${dayCount} — ${SEASONS[currentSeason]} — ${credits}cr`;
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

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

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
