/* Space Farming - persistence and the session: high scores, autosave, validating and restoring
   saves (including old ones), continue, new game and resetting a fresh farm.
   Owns: G.tutorialSeen, G.state, G.highScores, G.savedGameAvailable, G.autosaveTimer, G.saveNotice,
     G.newGameConfirmOpen
   Reads: the whole farm state (it saves, restores and resets it) */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { GRID_COLS, BASE_GRID_ROWS, TILE_FARMLAND, TILE_ROCK, TILE_WATER, TILE_SAND, SOIL_QUALITY_TIERS,
    STATE_PLAYING, STATE_PAUSED, STORAGE_HIGHSCORES, STORAGE_SAVE, STORAGE_SAVE_V1, SAVE_VERSION,
    MAX_HIGH_SCORES, CROPS, LIVESTOCK, WEATHER_NONE, WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER,
    WEATHER_RAIN, WEATHER_THUNDERSTORM, WEATHER_SNOW, WEATHER_DUST, WEATHER_MIN_INTERVAL,
    WEATHER_MAX_INTERVAL, TOOL_PLANT, BUILDINGS, BUILDING_MAX_LEVEL, PRICE_CHANGE_INTERVAL, SEASONS,
    ANIMAL_SPAWN_MIN, ANIMAL_SPAWN_MAX, highScoresBody, ENERGY_BASE_MAX, VIEW_ZOOM_MIN, VIEW_ZOOM_MAX,
    getTileSoilQuality, resetWeatherVisuals, invalidateField, TECH, TECH_BY_ID, LEGACY_CHAINS,
    techChainCount, isCropUnlocked, itemSprite, newStats, GOALS, closeAllDialogs, resetView, updateWindowTitle } = NS;

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        G.highScores = JSON.parse(raw);
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(earned, days) {
    G.highScores.push({ credits: earned, days });
    G.highScores.sort((a, b) => b.credits - a.credits);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < G.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${G.highScores[i].credits}</td><td>${G.highScores[i].days}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!G.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ── Saved farm ── */

  function readSavedGameRaw() {
    try {
      return localStorage.getItem(STORAGE_SAVE) || localStorage.getItem(STORAGE_SAVE_V1);
    } catch (_) {
      return null;
    }
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_SAVE);
      localStorage.removeItem(STORAGE_SAVE_V1);
    } catch (_) {}
    G.savedGameAvailable = false;
  }

  /* A farm from before the tech tree: its upgrade levels become owned tree
     tiers, and everything it could already plant, raise or build stays unlocked */
  function migrateV1Save(d) {
    const levels = {};
    const up = d.upgradeLevels || {};
    for (const key in LEGACY_CHAINS) {
      const lv = Math.max(0, Math.floor(Number(up[key]) || 0));
      for (let i = 1; i <= lv && TECH_BY_ID[LEGACY_CHAINS[key] + i]; ++i)
        levels[LEGACY_CHAINS[key] + i] = 1;
    }
    const land = Math.max(0, Math.floor(Number(up.plotExpansion) || 0));
    if (land)
      levels.eng_land = land;
    const NEW_CONTENT = ['agri_kale', 'agri_pumpkin', 'husb_rabbit', 'husb_bees', 'eng_lamp', 'sci_zapper'];
    for (const n of TECH)
      if (n.unlock && !NEW_CONTENT.includes(n.id))
        levels[n.id] = 1;
    d.techLevels = levels;
    d.version = SAVE_VERSION;
    delete d.upgradeLevels;
    return d;
  }

  function saveGame() {
    if (G.state !== STATE_PLAYING && G.state !== STATE_PAUSED) return;
    G.autosaveTimer = 0;
    const data = {
      version: SAVE_VERSION,
      credits: G.credits, selectedCropIndex: G.selectedCropIndex, gameTime: G.gameTime, dayCount: G.dayCount,
      gridRows: G.gridRows, gridCols: G.gridCols, gridColOffset: G.gridColOffset, expansionDirection: G.expansionDirection,
      soilQuality: G.soilQuality, tileTypes: G.tileTypes, tileFertility: G.tileFertility, hoedTiles: G.hoedTiles,
      farmGrid: G.farmGrid.map(row => row.map(cell => cell ? { cropIndex: cell.cropIndex, growthProgress: cell.growthProgress, growthStage: cell.growthStage } : null)),
      buildings: G.buildings.map(row => row.map(bld => bld ? { typeIndex: bld.typeIndex, level: bld.level || 1 } : null)),
      livestockPens: G.livestockPens.map(pen => ({ typeIndex: pen.typeIndex, feedTimer: pen.feedTimer, produceReady: !!pen.produceReady, gridRow: pen.gridRow, gridCol: pen.gridCol })),
      wildAnimals: G.wildAnimals.map(a => ({ x: a.x, y: a.y, targetCol: a.targetCol, targetRow: a.targetRow, moveTimer: a.moveTimer, hp: a.hp })),
      priceMultipliers: G.priceMultipliers, priceChangeTimer: G.priceChangeTimer, inventory: G.inventory, techLevels: G.techLevels, rainMakerDay: G.rainMakerDay, techBoughtTotal: G.techBoughtTotal,
      stats: G.stats, goalIndex: G.goalIndex, goalsRev: 2, orders: G.orders, orderTimer: G.orderTimer, orderSerial: G.orderSerial,
      weatherType: G.weatherType, weatherTimer: G.weatherTimer, weatherInterval: G.weatherInterval,
      currentSeason: G.currentSeason, dayPhase: G.dayPhase, energy: G.energy, nextAnimalSpawn: G.nextAnimalSpawn,
      buildingHarvestTimer: G.buildingHarvestTimer, autoHarvestTimer: G.autoHarvestTimer, autoCollectorTimer: G.autoCollectorTimer, autoPlanterTimer: G.autoPlanterTimer,
      buildingIncomeTimer: G.buildingIncomeTimer, buildingIncomeAccum: G.buildingIncomeAccum, buildingIncomeSurplusAccum: G.buildingIncomeSurplusAccum,
      viewZoom: G.viewZoom, viewPanX: G.viewPanX, viewPanY: G.viewPanY
    };
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      G.savedGameAvailable = true;
    } catch (_) {}
  }

  function isFiniteNumber(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isIndex(v, length) {
    return Number.isInteger(v) && v >= 0 && v < length;
  }

  function isGridOf(grid, rows, cols, check) {
    return Array.isArray(grid) && grid.length === rows
      && grid.every(row => Array.isArray(row) && row.length === cols && row.every(check));
  }

  function isValidSave(d) {
    if (!d || typeof d !== 'object' || (d.version !== 1 && d.version !== SAVE_VERSION)) return false;
    const rows = d.gridRows, cols = d.gridCols;
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1 || rows > 400 || cols > 400) return false;
    if (!isFiniteNumber(d.credits) || !Number.isInteger(d.dayCount) || !isFiniteNumber(d.gameTime)) return false;
    if (!isGridOf(d.tileTypes, rows, cols, t => t === TILE_FARMLAND || t === TILE_ROCK || t === TILE_WATER || t === TILE_SAND)) return false;
    if (!isGridOf(d.tileFertility, rows, cols, isFiniteNumber)) return false;
    if (!isGridOf(d.hoedTiles, rows, cols, h => typeof h === 'boolean')) return false;
    if (!isGridOf(d.farmGrid, rows, cols, cell => cell === null || (cell && isIndex(cell.cropIndex, CROPS.length)
      && isFiniteNumber(cell.growthProgress) && Number.isInteger(cell.growthStage) && cell.growthStage >= 0))) return false;
    if (!isGridOf(d.buildings, rows, cols, bld => bld === null || (bld && isIndex(bld.typeIndex, BUILDINGS.length)
      && Number.isInteger(bld.level) && bld.level >= 1 && bld.level <= BUILDING_MAX_LEVEL))) return false;
    if (!Array.isArray(d.soilQuality) || !d.soilQuality.every(isFiniteNumber)) return false;
    if (!Array.isArray(d.livestockPens) || !d.livestockPens.every(pen => pen && isIndex(pen.typeIndex, LIVESTOCK.length)
      && isFiniteNumber(pen.feedTimer) && Number.isInteger(pen.gridRow) && Number.isInteger(pen.gridCol))) return false;
    if (!Array.isArray(d.wildAnimals) || !d.wildAnimals.every(a => a && isFiniteNumber(a.x) && isFiniteNumber(a.y))) return false;
    if (!Array.isArray(d.priceMultipliers) || d.priceMultipliers.length > CROPS.length || !d.priceMultipliers.every(isFiniteNumber)) return false;
    if (!d.inventory || typeof d.inventory !== 'object' || Array.isArray(d.inventory)) return false;
    const levels = d.version === 1 ? d.upgradeLevels : d.techLevels;
    if (!levels || typeof levels !== 'object' || Array.isArray(levels)) return false;
    if (!isIndex(d.currentSeason, SEASONS.length)) return false;
    return true;
  }

  /* Returns the parsed save, or null after discarding an unreadable or outdated one */
  function readValidSave() {
    const raw = readSavedGameRaw();
    if (!raw) {
      G.savedGameAvailable = false;
      return null;
    }
    let d = null;
    try {
      d = JSON.parse(raw);
    } catch (_) {
      d = null;
    }
    if (!isValidSave(d)) {
      clearSavedGame();
      G.saveNotice = 'The saved farm could not be loaded and was discarded.';
      return null;
    }
    if (d.version === 1)
      migrateV1Save(d);
    G.savedGameAvailable = true;
    return d;
  }

  function checkSavedGame() {
    readValidSave();
  }

  function restoreSavedGame() {
    const d = readValidSave();
    if (!d)
      return false;

    const num = (v, def) => isFiniteNumber(v) ? v : def;
    const plainCounts = (obj) => {
      const out = {};
      for (const k of Object.keys(obj))
        if (isFiniteNumber(obj[k]))
          out[k] = obj[k];
      return out;
    };

    G.credits = d.credits;
    G.selectedCropIndex = isIndex(d.selectedCropIndex, CROPS.length) ? d.selectedCropIndex : 0;
    G.selectedTool = TOOL_PLANT;
    G.selectedBuildingIndex = -1;
    G.gameTime = d.gameTime;
    G.dayCount = d.dayCount;
    G.gridRows = d.gridRows;
    G.gridCols = d.gridCols;
    G.gridColOffset = Number.isInteger(d.gridColOffset) ? d.gridColOffset : 0;
    G.expansionDirection = isIndex(d.expansionDirection, 4) ? d.expansionDirection : 0;
    G.soilQuality = d.soilQuality.slice();
    G.tileTypes = d.tileTypes.map(row => row.slice());
    G.tileFertility = d.tileFertility.map(row => row.slice());
    G.hoedTiles = d.hoedTiles.map(row => row.slice());
    G.farmGrid = d.farmGrid.map(row => row.map(cell => cell ? {
      cropIndex: cell.cropIndex,
      growthProgress: cell.growthProgress,
      growthStage: Math.min(cell.growthStage, CROPS[cell.cropIndex].stages - 1),
      plantAnim: 0
    } : null));
    G.buildings = d.buildings.map(row => row.map(bld => bld ? { typeIndex: bld.typeIndex, level: bld.level } : null));
    G.livestockPens = d.livestockPens.map(pen => ({
      typeIndex: pen.typeIndex,
      feedTimer: pen.feedTimer,
      produceReady: !!pen.produceReady,
      gridRow: pen.gridRow,
      gridCol: pen.gridCol
    }));
    G.wildAnimals = d.wildAnimals.map(a => ({
      x: a.x,
      y: a.y,
      targetCol: Number.isInteger(a.targetCol) ? a.targetCol : -1,
      targetRow: Number.isInteger(a.targetRow) ? a.targetRow : -1,
      moveTimer: num(a.moveTimer, 0),
      hp: num(a.hp, 1)
    }));
    G.priceMultipliers = d.priceMultipliers.slice();
    if (G.dialog === 'tree')
      G.dialog = null;
    G.priceChangeTimer = num(d.priceChangeTimer, PRICE_CHANGE_INTERVAL);
    G.inventory = plainCounts(d.inventory);
    G.techLevels = {};
    for (const id in d.techLevels)
      if (TECH_BY_ID[id] && isFiniteNumber(d.techLevels[id]) && d.techLevels[id] > 0)
        G.techLevels[id] = Math.floor(d.techLevels[id]);
    G.rainMakerDay = num(d.rainMakerDay, 0);
    G.stats = newStats();
    if (d.stats && typeof d.stats === 'object')
      for (const k in G.stats)
        G.stats[k] = num(d.stats[k], 0);
    G.goalIndex = Math.max(0, Math.min(GOALS.length, Math.floor(num(d.goalIndex, 0))));
    // the 'More room' goal was added as the third goal later on
    if (d.goalsRev !== 2 && G.goalIndex >= 2)
      G.goalIndex = Math.min(GOALS.length, G.goalIndex + 1);
    G.orders = Array.isArray(d.orders) ? d.orders.filter(o => o && typeof o.item === 'string' && isFiniteNumber(o.qty) && isFiniteNumber(o.reward) && isFiniteNumber(o.until) && itemSprite(o.item) !== 'crate')
      .map(o => ({ id: Math.floor(num(o.id, 0)), item: o.item, qty: o.qty, reward: o.reward, until: o.until })) : [];
    G.orderTimer = num(d.orderTimer, 25);
    G.orderSerial = Math.floor(num(d.orderSerial, G.orders.length));
    ++G.penVersion;
    G.techBoughtTotal = num(d.techBoughtTotal, 0);
    G.priceNext = null;
    G.nextWeather = null;
    while (G.priceMultipliers.length < CROPS.length)
      G.priceMultipliers.push(1);
    if (!isCropUnlocked(G.selectedCropIndex))
      G.selectedCropIndex = 0;

    const weathers = [WEATHER_NONE, WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER, WEATHER_RAIN, WEATHER_THUNDERSTORM, WEATHER_SNOW, WEATHER_DUST];
    G.weatherType = weathers.includes(d.weatherType) ? d.weatherType : WEATHER_NONE;
    G.weatherTimer = num(d.weatherTimer, 0);
    G.weatherInterval = num(d.weatherInterval, WEATHER_MIN_INTERVAL);
    resetWeatherVisuals();

    G.currentSeason = d.currentSeason;
    G.dayPhase = num(d.dayPhase, 0);
    G.energy = num(d.energy, ENERGY_BASE_MAX);
    G.nextAnimalSpawn = num(d.nextAnimalSpawn, ANIMAL_SPAWN_MIN);
    G.buildingHarvestTimer = num(d.buildingHarvestTimer, 0);
    G.autoHarvestTimer = num(d.autoHarvestTimer, 0);
    G.autoCollectorTimer = num(d.autoCollectorTimer, 0);
    G.autoPlanterTimer = num(d.autoPlanterTimer, 0);
    G.buildingIncomeTimer = num(d.buildingIncomeTimer, 0);
    G.buildingIncomeAccum = num(d.buildingIncomeAccum, 0);
    G.buildingIncomeSurplusAccum = num(d.buildingIncomeSurplusAccum, 0);

    G.viewZoom = Math.max(VIEW_ZOOM_MIN, Math.min(VIEW_ZOOM_MAX, num(d.viewZoom, 1)));
    G.viewPanX = num(d.viewPanX, 0);
    G.viewPanY = num(d.viewPanY, 0);
    G.isPanning = false;
    G.panButton = -1;

    closeAllDialogs();
    G.lastSeason = -1;
    G.screenFade = 1;
    G.shuffleCacheTimer = 0;
    G.cachedHarvestOrder = [];
    G.cachedPlantOrder = [];
    G.autosaveTimer = 0;
    G.saveNotice = '';
    invalidateField();
    return true;
  }

  function continueSavedGame() {
    if (!restoreSavedGame()) {
      SZ.GameAudio.play('error');
      return;
    }
    G.treeLayout = null;
    NS.treeCam.init = false;
    G.state = STATE_PLAYING;
    // an older save now lives on under the current version
    saveGame();
    try { localStorage.removeItem(STORAGE_SAVE_V1); } catch (_) {}
    resetView();
    G.lastCredits = null;
    G.creditsShown = G.credits;
    SZ.GameAudio.play('select');
    updateWindowTitle();
  }

  /* Starts a new farm, asking first when that would replace a running or saved one */
  function requestNewGame() {
    if (G.newGameConfirmOpen) return;
    const running = G.state === STATE_PLAYING || G.state === STATE_PAUSED;
    if (!running && !G.savedGameAvailable) {
      resetGame();
      return;
    }
    const resumeAfter = G.state === STATE_PLAYING;
    if (resumeAfter) {
      G.state = STATE_PAUSED;
      saveGame();
    }
    G.newGameConfirmOpen = true;
    // the inner panel gets hidden along with the overlay when a button closes it, so show it again
    const panel = document.querySelector('#dlg-new-game .dialog');
    if (panel)
      panel.hidden = false;
    SZ.Dialog.show('dlg-new-game').then((result) => {
      G.newGameConfirmOpen = false;
      if (result === 'yes') {
        clearSavedGame();
        resetGame();
      } else if (resumeAfter && G.state === STATE_PAUSED)
        G.state = STATE_PLAYING;
    });
  }

  function resetGame() {
    G.credits = 100;
    G.selectedCropIndex = 0;
    G.selectedTool = TOOL_PLANT;
    G.gameTime = 0;
    G.dayCount = 1;
    G.inventory = {};

    // Reset upgrades and goals
    G.techLevels = {};
    G.stats = newStats();
    G.goalIndex = 0;
    G.orders = [];
    G.orderTimer = 25;
    G.orderSerial = 0;
    ++G.penVersion;
    G.rainMakerDay = 0;
    G.techBoughtTotal = 0;
    G.priceNext = null;
    G.nextWeather = null;
    NS.treeCam.init = false;
    closeAllDialogs();
    G.lastSeason = -1;
    G.screenFade = 1;
    G.autoHarvestTimer = 0;
    G.autoCollectorTimer = 0;

    // Reset grid to base size
    G.gridRows = BASE_GRID_ROWS;
    G.gridCols = GRID_COLS;
    G.gridColOffset = 0;
    G.expansionDirection = 0;

    // Energy reset
    G.energy = 100;

    // Auto-planter reset
    G.autoPlanterTimer = 0;

    // Shuffle cache reset
    G.shuffleCacheTimer = 0;
    G.cachedHarvestOrder = [];
    G.cachedPlantOrder = [];

    // Initialize empty farm grid with soil quality and tile types
    G.farmGrid = [];
    G.soilQuality = [];
    G.tileTypes = [];
    G.tileFertility = [];
    G.hoedTiles = [];
    G.buildings = [];
    G.selectedBuildingIndex = -1;
    G.buildingHarvestTimer = 0;

    // Generate tile types with natural clustering
    for (let r = 0; r < G.gridRows; ++r) {
      const row = [];
      G.tileTypes[r] = [];
      G.tileFertility[r] = [];
      G.hoedTiles[r] = [];
      G.buildings[r] = [];
      for (let c = 0; c < G.gridCols; ++c) {
        row.push(null); // empty tile
        G.buildings[r][c] = null;
        G.hoedTiles[r][c] = false;

        const noise = Math.random();
        // Check neighbors for clustering
        const leftType = c > 0 ? G.tileTypes[r][c - 1] : TILE_FARMLAND;
        const topType = r > 0 ? G.tileTypes[r - 1][c] : TILE_FARMLAND;
        if (noise < 0.08 || (leftType === TILE_ROCK && noise < 0.3) || (topType === TILE_ROCK && noise < 0.3))
          G.tileTypes[r][c] = TILE_ROCK;
        else if (noise < 0.12 || (leftType === TILE_WATER && noise < 0.25))
          G.tileTypes[r][c] = TILE_WATER;
        else if (noise < 0.18 || (leftType === TILE_SAND && noise < 0.35) || (topType === TILE_SAND && noise < 0.35))
          G.tileTypes[r][c] = TILE_SAND;
        else
          G.tileTypes[r][c] = TILE_FARMLAND;

        // Per-tile fertility
        let fert = 0.5 + Math.random() * 0.5; // 0.5 to 1.0
        if (G.tileTypes[r][c] === TILE_SAND) fert *= 0.7;
        // Apply row-based tier penalty for expansion rows
        const tierPenalty = (r < BASE_GRID_ROWS) ? 1.0 : (SOIL_QUALITY_TIERS[r - BASE_GRID_ROWS + 1] || SOIL_QUALITY_TIERS[SOIL_QUALITY_TIERS.length - 1]);
        fert *= tierPenalty;
        G.tileFertility[r][c] = fert;
      }
      G.farmGrid.push(row);
      G.soilQuality.push(getTileSoilQuality(r));
    }

    // Start with no livestock
    G.livestockPens = [];

    // Weather reset
    G.weatherType = WEATHER_NONE;
    G.weatherTimer = 0;
    G.weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
    resetWeatherVisuals();

    // Price fluctuation reset
    G.priceMultipliers = [];
    for (let i = 0; i < CROPS.length; ++i)
      G.priceMultipliers.push(1.0);
    G.priceChangeTimer = PRICE_CHANGE_INTERVAL;

    // Zoom & pan reset
    resetView();
    G.isPanning = false;
    G.panButton = -1;

    // Season & day/night reset
    G.currentSeason = 0;
    G.dayPhase = 0;

    // Animals reset
    G.wildAnimals = [];
    G.nextAnimalSpawn = (ANIMAL_SPAWN_MIN + Math.random() * (ANIMAL_SPAWN_MAX - ANIMAL_SPAWN_MIN)) * Math.pow(1.4, techChainCount('sci_repel'));

    // Building income timer reset
    G.buildingIncomeTimer = 0;
    G.buildingIncomeAccum = 0;
    G.buildingIncomeSurplusAccum = 0;

    G.autosaveTimer = 0;
    G.saveNotice = '';
    invalidateField();
    G.lastCredits = null;
    G.creditsShown = G.credits;
    G.state = STATE_PLAYING;
    SZ.GameAudio.play('select');
    updateWindowTitle();
  }

  Object.assign(NS, { loadHighScores, saveHighScores, renderHighScores, saveGame, checkSavedGame,
    continueSavedGame, requestNewGame, resetGame });

})();
