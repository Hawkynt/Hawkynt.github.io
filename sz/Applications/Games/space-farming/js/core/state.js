/* Space Farming - the shared game state: one long-lived object (SZ.SpaceFarming.state, "G" in
   every module) holding everything more than one module reads or writes, grouped by the module
   that owns it. State only one module uses stays private inside that module. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const { GRID_COLS, BASE_GRID_ROWS, STATE_READY, WEATHER_NONE, TOOL_PLANT } = NS;

  NS.state = {

    /* ── core/dom.js ── */
    canvasW: 700,
    canvasH: 500,
    uiS: 1, // HUD scale (screen px per UI unit)
    UW: 700, // HUD size in UI units
    UH: 500,

    /* ── render/sprites.js ── */
    spriteScale: 1, // device pixels per drawing unit of the current pass

    /* ── ui/regions.js ── */
    uiRegions: [],
    frameRegions: [],
    hoverRegionId: null,
    pressRegionId: null,
    uiTime: 0,
    frameDt: 1 / 60,

    /* ── ui/dialog-state.js ── */
    dialog: null, // 'tree' | 'market' | 'livestock' | 'help'
    dialogT: 0, // open animation 0..1
    helpPage: 0,
    dialogScroll: 0,

    /* ── ui/view.js ── */
    // Zoom & pan
    viewZoom: 1.0,
    viewPanX: 0,
    viewPanY: 0,
    pointerX: 0, // canvas px
    pointerY: 0,
    pointerUX: 0, // UI units
    pointerUY: 0,
    pointerInside: false,
    pinch: null, // { dist, zoom, cx, cy }
    pressStart: null, // { x, y, region }

    /* ── ui/hud-layout.js ── */
    creditsShown: 100, // eased counter value
    creditsPulse: 0,
    creditsDelta: 0,
    creditsDeltaT: 0,
    banner: null, // { title, sub, color, icon, t }
    screenFade: 1, // fades the screen in after a state change
    hudFrame: 0,

    /* ── render/juice.js ── */
    storagePulse: 0,
    harvestCombo: 0,
    harvestComboT: 0,

    /* ── core/tech.js ── */
    techLevels: {}, // node id -> level (1 = owned; repeatable nodes count up)
    techBoughtTotal: 0,

    /* ── core/rules.js ── */
    penVersion: 0,

    /* ── world/farm.js ── */
    // Effective grid rows (base + expansion)
    gridRows: BASE_GRID_ROWS,
    // Per-tile soil quality (2D array matching farmGrid dimensions)
    soilQuality: [],
    // Farm grid: each cell is null or { cropIndex, growthProgress, growthStage, plantAnim }
    farmGrid: [],
    // Tile types: 2D array of TILE_FARMLAND / TILE_ROCK / TILE_WATER / TILE_SAND
    tileTypes: [],
    // Per-tile fertility: 2D array of 0.0..1.0 values
    tileFertility: [],
    // Hoed tiles: 2D array of booleans — true if hoe-fertilized for visual indicator
    hoedTiles: [],
    // Buildings placed on the grid: 2D array (null or { typeIndex })
    buildings: [],
    gridCols: GRID_COLS, // now mutable for east/west expansion
    gridColOffset: 0, // tracks how many columns were added to the left (west)
    // Expansion direction: cycles L(0), R(1), T(2), B(3)
    expansionDirection: 0,

    /* ── systems/crops.js ── */
    // Building auto-harvest timer
    buildingHarvestTimer: 0,
    // Auto-harvest timer (ticks every second-ish based on upgrade level)
    autoHarvestTimer: 0,

    /* ── systems/livestock.js ── */
    // Livestock pens: array of { typeIndex, feedTimer, produceReady, gridRow, gridCol }
    livestockPens: [],

    /* ── systems/economy.js ── */
    credits: 100,
    // Price fluctuation: per-crop multiplier
    priceMultipliers: [],
    priceChangeTimer: 0,
    // Inventory: { cropName: count }
    inventory: {},
    // Solar/Wind income timer (Feature 3)
    buildingIncomeTimer: 0,
    priceNext: null,
    buildingIncomeAccum: 0, // fractional credit accumulator for base income
    buildingIncomeSurplusAccum: 0, // fractional credit accumulator for surplus

    /* ── systems/weather.js ── */
    // Weather
    weatherType: WEATHER_NONE,
    weatherTimer: 0,
    weatherInterval: 0,
    meteors: [], // { wx, wy, r, c, delay, t, smash }
    bolts: [], // { pts, t }
    decals: [], // { wx, wy, t, life, kind }
    splashes: [], // { wx, wy, t }
    flashA: 0,
    wxShown: WEATHER_NONE,
    wxK: 0,
    wxDrops: [],
    rainMakerDay: 0, // first day the rain maker can be used again
    nextWeather: null,

    /* ── systems/automation.js ── */
    // Energy system
    energy: 100,
    // Auto-planter timer
    autoPlanterTimer: 0,
    // Cached shuffle arrays for auto-harvester/planter (re-randomize every 60s)
    shuffleCacheTimer: 0,
    cachedHarvestOrder: [],
    cachedPlantOrder: [],
    // Auto-collector timer (for livestock produce)
    autoCollectorTimer: 0,

    /* ── systems/mice.js ── */
    // Animals (Feature 8)
    wildAnimals: [], // {x, y, targetCol, targetRow, moveTimer, hp}
    nextAnimalSpawn: 0,

    /* ── systems/goals.js ── */
    stats: null,
    goalIndex: 0,
    orders: [], // { id, item, qty, reward, until }
    orderTimer: 25,
    orderSerial: 0,

    /* ── systems/simulation.js ── */
    gameTime: 0,
    dayCount: 0,
    // Seasons
    currentSeason: 0, // index into SEASONS
    // Day/Night phase: 0..1 within each 30s game day
    dayPhase: 0,

    /* ── core/save.js ── */
    /* ── Tutorial ── */
    tutorialSeen: false,
    state: STATE_READY,
    // High scores
    highScores: [],
    // Saved farm
    savedGameAvailable: false,
    autosaveTimer: 0,
    saveNotice: '',
    newGameConfirmOpen: false,

    /* ── render/world-common.js ── */
    animT: 0, // world animation clock (stops while paused)

    /* ── render/lighting.js ── */
    lowQuality: false, // set by the frame-time monitor when frames get slow

    /* ── render/field.js ── */
    /* ── Soil nutrients: pip bars on every plot, plus a heat-map overlay ── */
    soilOverlay: false, // toggled with N
    expandBadge: null, // world position of the + badge

    /* ── ui/tech-tree.js ── */
    /* ── Layout (ported from the Dome Keeper tree): depth columns, lanes, regions ── */
    treeLayout: null,
    /* ── Tree dialog state ── */
    treeTab: 'all',
    treeFocusId: null,
    treeHoverId: null,
    treePanning: null, // { x, y, tx, ty, moved }

    /* ── ui/dock.js ── */
    selectedCropIndex: 0,
    selectedTool: TOOL_PLANT,
    // Selected building index (-1 = none)
    selectedBuildingIndex: -1,
    dockFollow: true,

    /* ── ui/screens.js ── */
    /* ── Building inspector (non-modal popover) ── */
    inspect: null, // { row, col }

    /* ── ui/input.js ── */
    isPanning: false,
    panLastX: 0,
    panLastY: 0,
    panButton: -1, // which button started panning
    // Right-click pan vs. remove tracking (Feature 1)
    rightClickStartX: 0,
    rightClickStartY: 0,
    // Drag selection
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragCurrentX: 0,
    dragCurrentY: 0,
    dragStartedOnGrid: false,

    /* ── app.js ── */
    lastSeason: -1,
    lastCredits: null
  };

})();
