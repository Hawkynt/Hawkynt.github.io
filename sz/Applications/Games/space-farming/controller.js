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
  const MAX_EXPANSION_ROWS = 3;
  const BASE_TILE_SIZE = 56;
  const GRID_OFFSET_X = 30;
  const GRID_OFFSET_Y = 60;

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
    { name: 'Plasma Pepper', icon: '🌶', color: '#f52',  growTime: 6,  stages: 3, sellPrice: 30, seedCost: 15, weatherAffinity: 'cold-vulnerable' },
    { name: 'Astral Flower', icon: '🌸', color: '#8af',  growTime: 20, stages: 5, sellPrice: 55, seedCost: 28, weatherAffinity: 'solar' }
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
  const WEATHER_DURATION = 8;
  const WEATHER_MIN_INTERVAL = 25;
  const WEATHER_MAX_INTERVAL = 50;

  /* ── Shop modes ── */
  const TOOL_PLANT = 'plant';
  const TOOL_HARVEST = 'harvest';
  const TOOL_FEED = 'feed';

  /* ── Upgrade Definitions ── */
  const UPGRADES = [
    { id: 'growSpeed',       name: 'Growth Boost',       icon: '🌱', maxLevel: 5, baseCost: 50,  costScale: 1.8, desc: 'Crops grow faster (+25%/lvl)' },
    { id: 'yieldMultiplier', name: 'Yield Multiplier',   icon: '📦', maxLevel: 5, baseCost: 80,  costScale: 2.0, desc: 'Harvest more per crop (+20%/lvl)' },
    { id: 'weatherResist',   name: 'Weather Shield',     icon: '🛡', maxLevel: 3, baseCost: 120, costScale: 2.5, desc: 'Reduce meteor damage chance' },
    { id: 'autoHarvest',     name: 'Auto-Harvester',     icon: '🤖', maxLevel: 3, baseCost: 200, costScale: 3.0, desc: 'Auto-harvest mature crops' },
    { id: 'plotExpansion',   name: 'Plot Expansion',     icon: '🗺', maxLevel: 3, baseCost: 150, costScale: 2.2, desc: 'Add 1 extra row of farmland' },
    { id: 'soilQuality',    name: 'Soil Quality',        icon: '🧪', maxLevel: 5, baseCost: 100, costScale: 1.9, desc: 'All tiles grow faster (+15%/lvl)' },
    { id: 'marketAccess',   name: 'Market Access',       icon: '📈', maxLevel: 5, baseCost: 120, costScale: 2.0, desc: 'Sell prices +10% per level' },
    { id: 'irrigation',     name: 'Irrigation System',   icon: '💧', maxLevel: 3, baseCost: 140, costScale: 2.3, desc: 'Reduce crop damage -15%/lvl (stacks w/ Shield)' }
  ];

  /* ── Price Fluctuation ── */
  const PRICE_CHANGE_INTERVAL = 60; // seconds between price shifts
  const PRICE_MIN_MULT = 0.5;
  const PRICE_MAX_MULT = 2.0;

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
    { title: 'Crops & Weather', lines: ['Void Mushroom grows in any weather.', 'Plasma Pepper is fast but cold-vulnerable.', 'Astral Flower benefits from solar flares.', '', 'Solar flares boost growth; meteor showers', 'damage unprotected crops!'] },
    { title: 'Upgrades', lines: ['Press U or click UPGRADES to open the shop.', '', 'Growth Boost, Yield, Weather Shield, Auto-Harvest,', 'Plot Expansion (more rows!), Soil Quality,', 'Market Access (better prices), Irrigation.', 'Each has multiple levels. Invest wisely!'] },
    { title: 'Market & Land', lines: ['Crop prices fluctuate every 60 seconds!', 'Green arrow = high price, red = low price.', 'Buy seeds when cheap, sell when prices are high.', '', 'New expansion rows have lower soil quality.', 'Upgrade Soil Quality to improve all tiles.'] },
    { title: 'Controls', lines: ['Mouse wheel: zoom in/out (0.5x-2.0x).', 'Middle-click drag or Ctrl+drag: pan view.', 'Home key: reset zoom & pan.', '', 'Drag-select multiple plots at once.', 'Press H anytime to see this help again.'] }
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

  // Livestock pens: array of { typeIndex, feedTimer, produceReady, x, y }
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

  // Auto-harvest timer (ticks every second-ish based on upgrade level)
  let autoHarvestTimer = 0;

  // High scores
  let highScores = [];

  // Input
  const keys = {};

  // Zoom & pan
  let viewZoom = 1.0;
  let viewPanX = 0;
  let viewPanY = 0;
  const VIEW_ZOOM_MIN = 0.5;
  const VIEW_ZOOM_MAX = 2.0;
  let isPanning = false;
  let panLastX = 0;
  let panLastY = 0;

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

  function getTileSoilQuality(row) {
    const baseQ = (row < BASE_GRID_ROWS) ? SOIL_QUALITY_TIERS[0] : SOIL_QUALITY_TIERS[row - BASE_GRID_ROWS + 1] || SOIL_QUALITY_TIERS[SOIL_QUALITY_TIERS.length - 1];
    return Math.min(1.5, baseQ + getUpgradeLevel('soilQuality') * 0.15);
  }

  function getEffectiveSellPrice(crop) {
    const cropIdx = CROPS.indexOf(crop);
    const priceMult = (cropIdx >= 0 && cropIdx < priceMultipliers.length) ? priceMultipliers[cropIdx] : 1;
    return Math.round(crop.sellPrice * getMarketPriceMultiplier() * priceMult);
  }

  function getEffectiveProduceValue(live) {
    return Math.round(live.produceValue * getMarketPriceMultiplier());
  }

  function getAutoHarvestInterval() {
    const lvl = getUpgradeLevel('autoHarvest');
    if (lvl <= 0) return 0; // disabled
    // level 1 = every 5s, level 2 = every 3s, level 3 = every 1.5s
    return [0, 5, 3, 1.5][lvl] || 0;
  }

  function purchaseUpgrade(upgradeIndex) {
    if (state !== STATE_PLAYING) return;
    const def = UPGRADES[upgradeIndex];
    const curLevel = getUpgradeLevel(def.id);
    if (curLevel >= def.maxLevel) return;
    const cost = getUpgradeCost(def, curLevel);
    if (credits < cost) return;

    credits -= cost;
    upgradeLevels[def.id] = curLevel + 1;
    floatingText.add(canvasW / 2, canvasH / 2 - 30, `${def.icon} ${def.name} Lv${curLevel + 1}!`, { color: '#0ff', font: 'bold 14px sans-serif' });
    particles.confetti(canvasW / 2, canvasH / 2, 15, { speed: 4 });

    // Plot Expansion: add a new row
    if (def.id === 'plotExpansion')
      expandGrid();
  }

  function expandGrid() {
    const newRow = [];
    for (let c = 0; c < GRID_COLS; ++c)
      newRow.push(null);
    farmGrid.push(newRow);
    ++gridRows;
    soilQuality.push(getTileSoilQuality(gridRows - 1));
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
    autoHarvestTimer = 0;

    // Reset grid to base size
    gridRows = BASE_GRID_ROWS;

    // Initialize empty farm grid with soil quality
    farmGrid = [];
    soilQuality = [];
    for (let r = 0; r < gridRows; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c)
        row.push(null); // empty tile
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

    // Enhanced harvest: golden burst + crop-colored sparkle ring
    particles.burst(tx, ty, 10, { color: '#fd0', speed: 3.5, life: 0.7, gravity: 0.05 });
    particles.burst(tx, ty, 6, { color: crop.color, speed: 2, life: 0.5 });
    // Rising golden sparkles
    for (let i = 0; i < 4; ++i)
      particles.trail(tx + (Math.random() - 0.5) * 16, ty, {
        vx: (Math.random() - 0.5) * 1,
        vy: -1.5 - Math.random() * 2,
        color: '#ff0',
        size: 2 + Math.random(),
        life: 0.5 + Math.random() * 0.3,
        decay: 0.03,
        shape: 'star'
      });

    // Yield multiplier: chance for bonus crops
    const yieldMul = getYieldMultiplier();
    let harvestCount = 1;
    const bonusChance = yieldMul - 1; // 0..1
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

  /* ══════════════════════════════════════════════════════════════════
     CROP GROWTH
     ══════════════════════════════════════════════════════════════════ */

  function updateCrops(dt) {
    if (state !== STATE_PLAYING) return;

    // Base growth multiplier from weather
    let weatherGrowthBoost = 1;
    if (weatherType === WEATHER_SOLAR_FLARE)
      weatherGrowthBoost = 2; // solarFlare boosts growth

    // Upgrade growth speed multiplier
    const upgradeGrowthMul = getGrowthSpeedMultiplier();

    for (let r = 0; r < gridRows; ++r) {
      for (let c = 0; c < GRID_COLS; ++c) {
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

        // Soil quality for this row
        const tileSoil = getTileSoilQuality(r);

        // Advance growth progress (soil quality is multiplicative)
        cell.growthProgress += (dt / crop.growTime) * cropWeatherMul * upgradeGrowthMul * tileSoil;

        // Check stage advancement
        const newStage = Math.min(maxStage, Math.floor(cell.growthProgress * crop.stages));
        if (newStage > cell.growthStage) {
          cell.growthStage = newStage;
          // Enhanced growth particles: green sparkles rising
          const { x: tx, y: ty } = gridCenterToScreen(c, r);
          particles.sparkle(tx, ty, 4, { color: crop.color, speed: 1.5 });
          for (let p = 0; p < 3; ++p)
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

        // Plant animation decay
        if (cell.plantAnim > 0)
          cell.plantAnim = Math.max(0, cell.plantAnim - dt * 3);
      }
    }

    // Auto-harvest upgrade
    const autoInterval = getAutoHarvestInterval();
    if (autoInterval > 0) {
      autoHarvestTimer += dt;
      if (autoHarvestTimer >= autoInterval) {
        autoHarvestTimer -= autoInterval;
        autoHarvestOneCrop();
      }
    }
  }

  /** Auto-harvest the first mature crop found (one per tick). */
  function autoHarvestOneCrop() {
    for (let r = 0; r < gridRows; ++r)
      for (let c = 0; c < GRID_COLS; ++c) {
        const cell = farmGrid[r][c];
        if (!cell) continue;
        const crop = CROPS[cell.cropIndex];
        if (cell.growthStage >= crop.stages - 1) {
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

    floatingText.add(pen.x, pen.y - 10, `+1 ${def.produce}`, { color: '#0f0', font: 'bold 12px sans-serif' });
    particles.sparkle(pen.x, pen.y, 5, { color: def.color, speed: 1.5 });
  }

  function buyLivestock(typeIndex) {
    if (state !== STATE_PLAYING) return;
    const def = LIVESTOCK[typeIndex];
    if (credits < def.cost) return;

    credits -= def.cost;
    const penX = 520 + (livestockPens.length % 2) * 80;
    const penY = 80 + Math.floor(livestockPens.length / 2) * 90;

    livestockPens.push({
      typeIndex,
      feedTimer: def.feedInterval,
      produceReady: false,
      x: penX,
      y: penY
    });

    floatingText.add(penX, penY - 15, `-${def.cost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
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
    // Spawn persistent weather particles
    weatherParticles = [];

    if (Math.random() < 0.5) {
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
    } else {
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

      // Meteor damage with weather resistance and affinity
      const resist = getWeatherResistance();
      const baseDamageChance = 0.2;
      for (let r = 0; r < gridRows; ++r) {
        for (let c = 0; c < GRID_COLS; ++c) {
          const cell = farmGrid[r][c];
          if (!cell) continue;
          const crop = CROPS[cell.cropIndex];
          // 'any' affinity crops are immune to meteor destruction
          if (crop.weatherAffinity === 'any') continue;
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
    }
    weatherTimer = WEATHER_DURATION;
  }

  /* ══════════════════════════════════════════════════════════════════
     DAY CYCLE
     ══════════════════════════════════════════════════════════════════ */

  function updateDayCycle(dt) {
    if (state !== STATE_PLAYING) return;
    const prevDay = Math.floor(gameTime / 30);
    gameTime += dt;
    const curDay = Math.floor(gameTime / 30);
    if (curDay > prevDay) {
      ++dayCount;
      updateWindowTitle();
    }
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
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    const ts = BASE_TILE_SIZE * viewZoom;
    for (let r = 0; r < gridRows; ++r) {
      for (let c = 0; c < GRID_COLS; ++c) {
        const x = (GRID_OFFSET_X + c * BASE_TILE_SIZE) * viewZoom + viewPanX;
        const y = (GRID_OFFSET_Y + r * BASE_TILE_SIZE) * viewZoom + viewPanY;
        const cell = farmGrid[r][c];

        // Skip tiles fully off-screen
        if (x + ts < 0 || x > canvasW || y + ts < 0 || y > canvasH - 45) continue;

        // Draw soil tile with quality tint
        const q = getTileSoilQuality(r);
        ctx.fillStyle = cell ? '#3a2a1a' : '#2a1a0a';
        ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);

        // Soil quality tint overlay: greener = better, yellower = worse
        if (q >= 0.9) {
          // Good soil: subtle green
          const ga = Math.min(0.2, (q - 0.9) * 0.5);
          ctx.fillStyle = `rgba(0,180,40,${ga})`;
        } else {
          // Poor soil: yellowish-brown
          const ya = Math.min(0.25, (0.9 - q) * 0.4);
          ctx.fillStyle = `rgba(180,160,40,${ya})`;
        }
        ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);

        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);

        // Show soil quality label on empty tiles when zoomed in enough
        if (!cell && viewZoom >= 0.8) {
          ctx.fillStyle = '#555';
          ctx.font = `${Math.round(7 * viewZoom)}px sans-serif`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${Math.round(q * 100)}%`, x + ts - 3, y + ts - 2);
        }

        if (cell) {
          const crop = CROPS[cell.cropIndex];
          const maxStage = crop.stages - 1;
          const mature = cell.growthStage >= maxStage;

          // Growth indicator bar
          const progress = Math.min(1, cell.growthProgress);
          ctx.fillStyle = mature ? '#0f0' : crop.color;
          ctx.fillRect(x + 3, y + ts - 6 * viewZoom, (ts - 6) * progress, 3 * viewZoom);

          // Special crop background effects
          if (crop.weatherAffinity === 'any') {
            ctx.fillStyle = `rgba(90,30,120,${0.15 + 0.05 * Math.sin(gameTime * 2 + r * 3 + c)})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
          } else if (crop.weatherAffinity === 'cold-vulnerable') {
            const pulse = 0.1 + 0.08 * Math.sin(gameTime * 4 + c * 2);
            ctx.fillStyle = `rgba(255,80,20,${pulse})`;
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#f52';
            ctx.fillStyle = 'transparent';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.shadowBlur = 0;
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
          ctx.font = `${Math.round((14 + cell.growthStage * 3) * viewZoom)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(crop.icon, 0, 0);
          ctx.restore();

          // Glow on mature crops
          if (mature) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = crop.color;
            ctx.fillStyle = 'transparent';
            ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
            ctx.shadowBlur = 0;
          }
        }
      }
    }
  }

  function drawLivestock() {
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];

      // Pen background
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(pen.x - 30, pen.y - 25, 60, 55);
      ctx.strokeStyle = '#4a5a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(pen.x - 30, pen.y - 25, 60, 55);

      // Animal icon
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, pen.x, pen.y);

      // Ready indicator
      if (pen.produceReady) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0f0';
        ctx.font = '14px sans-serif';
        ctx.fillText(def.produceIcon, pen.x + 18, pen.y - 15);
        ctx.shadowBlur = 0;
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

    // Sell button
    const sellBtnX = canvasW - 145;
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
    const upgBtnX = canvasW - 78;
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

    // Livestock buy area
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Livestock:', 510, GRID_OFFSET_Y - 10);

    for (let i = 0; i < LIVESTOCK.length; ++i) {
      const ly = GRID_OFFSET_Y + i * 25;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#bbb';
      ctx.fillText(`${LIVESTOCK[i].icon} ${LIVESTOCK[i].cost}cr`, 510, ly + 10);
    }
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
      const cost = maxed ? 0 : getUpgradeCost(def, curLevel);
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

      // Level pips
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#888';
      let pipStr = '';
      for (let l = 0; l < def.maxLevel; ++l)
        pipStr += l < curLevel ? '\u25A0 ' : '\u25A1 ';
      ctx.fillText(pipStr + `Lv${curLevel}/${def.maxLevel}`, px + 12, ry + 27);

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

  function drawDragSelection() {
    if (!isDragging || !dragStartedOnGrid) return;

    const { r0, c0, r1, c1 } = getDragGridRect();
    const ts = BASE_TILE_SIZE * viewZoom;

    // Highlight individual tiles within the selection
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const tx = (GRID_OFFSET_X + c * BASE_TILE_SIZE) * viewZoom + viewPanX;
        const ty = (GRID_OFFSET_Y + r * BASE_TILE_SIZE) * viewZoom + viewPanY;
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

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    if (state === STATE_PLAYING || state === STATE_GAME_OVER) {
      drawGrid();
      drawLivestock();
      drawWeatherOverlay();
      drawUI();
      drawDragSelection();
      drawUpgradeShop();
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

  function buildCropTileTooltip(cell, row) {
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
    const sq = getTileSoilQuality(row);
    if (sq < 1.0)
      lines.push({ text: 'Soil quality: ' + Math.round(sq * 100) + '% (slower growth)', color: '#ca4' });
    else if (sq > 1.0)
      lines.push({ text: 'Soil quality: ' + Math.round(sq * 100) + '% (faster growth)', color: '#4d4' });
    const yieldMul = getYieldMultiplier();
    if (yieldMul > 1)
      lines.push({ text: 'Yield bonus: ' + Math.round((yieldMul - 1) * 100) + '% chance double', color: '#ff0' });
    return lines;
  }

  function buildEmptyTileTooltip(row) {
    const crop = CROPS[selectedCropIndex];
    const sq = getTileSoilQuality(row);
    const lines = [
      { text: 'Empty plot', color: '#999', bold: true },
      { text: 'Click to plant ' + crop.icon + ' ' + crop.name + ' (' + crop.seedCost + ' cr)', color: '#aaa' }
    ];
    if (sq < 1.0)
      lines.push({ text: 'Soil quality: ' + Math.round(sq * 100) + '% (slower growth)', color: '#ca4' });
    else if (sq > 1.0)
      lines.push({ text: 'Soil quality: ' + Math.round(sq * 100) + '% (enhanced growth)', color: '#4d4' });
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
      case 'day':
        return [{ text: 'Day ' + dayCount, color: '#8cf', bold: true }, { text: 'Days pass every 30 seconds of playtime', color: '#aaa' }];
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

    // Check farm grid
    const { col, row } = canvasToGrid(mx, my);
    if (isInsideGrid(col, row)) {
      const cell = farmGrid[row][col];
      tooltipLines = cell ? buildCropTileTooltip(cell, row) : buildEmptyTileTooltip(row);
      return;
    }

    // Check livestock pens
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      if (mx >= pen.x - 30 && mx <= pen.x + 30 && my >= pen.y - 25 && my <= pen.y + 30) {
        tooltipLines = buildLivestockPenTooltip(pen);
        return;
      }
    }

    // Check crop selection bar
    const barY = canvasH - 45;
    if (my >= barY && my <= canvasH) {
      // Upgrades button
      const upgBtnX = canvasW - 78;
      if (mx >= upgBtnX && mx <= upgBtnX + 70) {
        tooltipLines = [
          { text: 'Upgrade Shop', color: '#ff0', bold: true },
          { text: 'Buy permanent farm upgrades', color: '#aaa' },
          { text: 'Shortcut: U', color: '#666' }
        ];
        return;
      }
      // Sell button
      const sellBtnX = canvasW - 145;
      if (mx >= sellBtnX && mx <= sellBtnX + 60) {
        tooltipLines = buildSellButtonTooltip();
        return;
      }
      // Crop buttons
      const cropIdx = Math.floor((mx - CROP_BAR_X) / (CROP_BTN_W + CROP_BTN_GAP));
      if (cropIdx >= 0 && cropIdx < CROPS.length && mx >= CROP_BAR_X && mx <= CROP_BAR_X + CROPS.length * (CROP_BTN_W + CROP_BTN_GAP)) {
        tooltipLines = buildCropBarTooltip(cropIdx);
        return;
      }
    }

    // Check livestock buy labels
    for (let i = 0; i < LIVESTOCK.length; ++i) {
      const ly = GRID_OFFSET_Y + i * 25;
      if (mx >= 510 && mx <= 640 && my >= ly && my <= ly + 20) {
        tooltipLines = buildLivestockBuyTooltip(i);
        return;
      }
    }

    // Check HUD header area for day/weather/credits
    if (my < GRID_OFFSET_Y) {
      if (mx < canvasW / 3)
        tooltipLines = buildStatTooltip('credits');
      else if (mx < canvasW * 2 / 3)
        tooltipLines = buildStatTooltip('day');
      else
        tooltipLines = buildStatTooltip('weather');
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
    if (statusTool) statusTool.textContent = `Tool: ${selectedTool}`;
    if (statusWeather) statusWeather.textContent = `Weather: ${weatherType === WEATHER_NONE ? 'Clear' : weatherType}`;
    if (statusDay) statusDay.textContent = `Day: ${dayCount}`;
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
    return col >= 0 && col < GRID_COLS && row >= 0 && row < gridRows;
  }

  /** Returns the grid-clamped selection rectangle { r0, c0, r1, c1 } from drag coordinates. */
  function getDragGridRect() {
    const a = canvasToGrid(dragStartX, dragStartY);
    const b = canvasToGrid(dragCurrentX, dragCurrentY);
    return {
      c0: Math.max(0, Math.min(a.col, b.col)),
      r0: Math.max(0, Math.min(a.row, b.row)),
      c1: Math.min(GRID_COLS - 1, Math.max(a.col, b.col)),
      r1: Math.min(gridRows - 1, Math.max(a.row, b.row))
    };
  }

  /** Apply plant/harvest action to all tiles inside the drag selection. */
  function applyDragAction() {
    const { r0, c0, r1, c1 } = getDragGridRect();
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
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

    // Middle mouse button or ctrl+left for panning
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      isPanning = true;
      const { x, y } = pointerToCanvas(e);
      panLastX = x;
      panLastY = y;
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

    // Check if click is inside farm grid -- start drag
    const { col, row } = canvasToGrid(mx, my);
    if (isInsideGrid(col, row)) {
      isDragging = true;
      dragStartedOnGrid = true;
      dragStartX = mx;
      dragStartY = my;
      dragCurrentX = mx;
      dragCurrentY = my;
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Check bottom bar buttons
    const barY = canvasH - 45;

    // Upgrades button
    const upgBtnX = canvasW - 78;
    if (mx >= upgBtnX && mx <= upgBtnX + 70 && my >= barY + 4 && my <= barY + 41) {
      showUpgradeShop = !showUpgradeShop;
      return;
    }

    // Sell button
    const sellBtnX = canvasW - 145;
    if (mx >= sellBtnX && mx <= sellBtnX + 60 && my >= barY + 4 && my <= barY + 41) {
      sellAllProduce();
      return;
    }

    // Check crop selection bar
    if (my >= barY && my <= canvasH) {
      const cropIdx = Math.floor((mx - CROP_BAR_X) / (CROP_BTN_W + CROP_BTN_GAP));
      if (cropIdx >= 0 && cropIdx < CROPS.length && mx >= CROP_BAR_X && mx <= CROP_BAR_X + CROPS.length * (CROP_BTN_W + CROP_BTN_GAP)) {
        selectedCropIndex = cropIdx;
        selectedTool = TOOL_PLANT;
      }
      return;
    }

    // Check livestock pen click (feeding/collecting)
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      if (mx >= pen.x - 30 && mx <= pen.x + 30 && my >= pen.y - 25 && my <= pen.y + 30) {
        feedAndCollect(i);
        return;
      }
    }

    // Check livestock buy area
    for (let i = 0; i < LIVESTOCK.length; ++i) {
      const ly = GRID_OFFSET_Y + i * 25;
      if (mx >= 510 && mx <= 640 && my >= ly && my <= ly + 20) {
        buyLivestock(i);
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
      canvas.releasePointerCapture(e.pointerId);
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
    const gridW = GRID_COLS * ts;
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
      : `Space Farming — Day ${dayCount} — ${credits}cr`;
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
