/* core/state.js -- the shared state object G: the run in progress plus every field more than one module touches.
   Reads: constants. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const { STATE_READY } = NS.constants;

  /* One long-lived object holds everything more than one module reads or
     writes; each group names the module that owns (initialises and mainly
     writes) its fields. Module-private state stays inside its module. */
  NS.state = {
    // ── the run in progress ──
    state: STATE_READY,
    currentMap: 0,
    gold: 200,
    lives: 20,
    currentWave: 0,
    totalWaves: 15,
    cleared: false,  // the map's required waves have been held this run
    gameSpeed: 1,
    selectedTowerType: -1,  // tower type chosen in the build bar, -1 = none
    selectedTower: null,
    towers: [],
    enemies: [],
    projectiles: [],
    clouds: [],  // poison clouds
    fxLines: [],  // lightning arcs, sniper tracers (drawn briefly)
    floorEffects: [],  // burning ground and ice patches
    pathCells: new Set(),
    waveEnemies: [],
    spawnTimer: 0,
    waveComplete: false,
    waveCountdown: 0,
    highScores: [],
    /* ── Auto-wave mode ── */
    autoWaveMode: false,
    autoWaveTimer: 0,
    /* ── Pre-wave warning state ── */
    warningTimer: 0,
    warningActive: false,
    warningPulse: 0,
    /* ── Global animation timer ── */
    animTime: 0,
    /* ── Run statistics and HUD bookkeeping ── */
    runStats: { kills: 0, gold: 0, leaked: 0, rp: 0 },
    waveSize: 0,  // enemies in the current wave

    // ── render/layout.js ──
    canvasW: 960,
    canvasH: 640,
    dpr: 1,
    uiS: 1,
    UW: 960,
    UH: 640,
    shakeX: 0,
    shakeY: 0,

    // ── ui/widgets.js ──
    regions: [],
    prevRegions: [],
    hoverId: null,
    frameDt: 0.016,
    frameNo: 0,

    // ── render/effects.js ──
    /* ── Big moments ── */
    hitstop: 0,
    fxBudget: null,
    /* ── Banners: wave start, wave cleared ── */
    banner: null,

    // ── world/research.js ──
    // Research points: one per wave held, more for clearing a map and for new stars;
    // further maps multiply all of it
    lastRp: 0,

    // ── world/abilities.js ──
    rushTimer: 0,
    abilityAim: null,  // 'strike' while choosing the target
    strikes: [],  // bomber runs in flight
    freezeFlash: 0,

    // ── core/progress.js ──
    /* ── Campaign progress: stars per map, kept apart from the saved game ── */
    meta: null,
    lastResult: null,  // outcome of the map just finished, for the end screen

    // ── world/paths.js ──
    paths: [],
    blockedCells: new Map(),  // 'col,row' -> 'water' | 'ice' | 'lava' | 'bog' | 'chasm' | 'rock' | 'tree'

    // ── world/towers.js ──
    // Towers by tile, rebuilt whenever the set of towers changes (towerVersion)
    towerVersion: 0,

    // ── world/waves.js ──
    previewCache: { key: '', list: [] },
    bossIntro: null,
    lastPaidWave: 0,

    // ── world/combat.js ──
    // Lives the running map started with; research bought mid-map does not move it
    runStartLives: 20,
    enemySeq: 0,

    // ── world/savegame.js ──
    autosaveTimer: 0,
    savedGameInfo: null,  // { map, wave, waves } summary for the start screen, null when no save exists
    saveNotice: '',  // shown on the start screen when a save had to be discarded

    // ── ui/research-screen.js ──
    treeDrag: null,
    treeReturn: STATE_READY,

    // ── ui/cinematics.js ──
    cine: null,  // { kind, t, dur, data, done }

    // ── ui/hud.js ──
    shownGold: 0,
    goldPulse: 0,
    livesPulse: 0,
    overlay: null,  // 'help' while the help pages are open
    helpPage: 0,

    // ── ui/map-select.js ──
    /* ── Campaign map select ── */
    mapSelectIndex: 0,

    // ── app/loop.js ──
    lastTimestamp: 0,

    // ── app/actions.js ──
    pausedFrom: null,
    introNext: false
  };

})();
