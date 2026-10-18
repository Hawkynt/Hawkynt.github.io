;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* G: the one mutable game state every module reads and writes. All fields exist from
     the start, so the object keeps one shape; the systems mutate it in place. */

  const { BIRD_X, STATE_READY, STATE_TITLE } = NS.C;

  Object.assign(NS.state, {
    /* View — logical pixels -> backing-store pixels, letterbox offsets, pointer */
    viewScale: 1,
    viewOffX: 0,
    viewOffY: 0,
    mouseX: -1,                     // pointer in logical coordinates
    mouseY: -1,
    dpr: 1,

    /* Game */
    state: STATE_READY,
    bird: { x: BIRD_X, y: 300, vy: 0, angle: 0 },
    score: 0,
    highScores: [],
    animFrameId: null,
    lastTimestamp: 0,
    readyBobT: 0,
    dyingTimer: 0,
    scorePopTimer: 0,
    save: null,                     // the v2 save, see save.js

    /* Run */
    mode: 'classic',                // 'classic' | 'adventure' | 'time' | 'daily'
    stageIndex: 0,                  // adventure: index into SZ.FlappyCourse.STAGES
    course: null,
    dist: 0,
    runTime: 0,
    coinsRun: 0,
    coinsPicked: 0,
    hearts: 1,
    hitsTaken: 0,
    invuln: 0,
    timeLeft: 0,

    /* Power-ups & combo */
    power: { shield: false, magnet: 0, slow: 0, ghost: 0, double: 0, tiny: 0 },
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    coinCarry: 0,
    comboSaves: 0,
    revives: 0,
    coinStreak: 0,
    coinStreakTime: 0,

    /* Glide */
    flapHeld: false,
    glideTick: 0,

    /* Scenery */
    scene: null,
    sceneBiome: '',
    sceneCache: {},
    biomeBanner: 0,
    biomeBannerText: '',

    /* Animation & results */
    wingFrame: 0,
    flapAnim: 0,
    globalTime: 0,
    lastStars: 0,
    newBest: false,

    /* Juice — feathers, biome weather, hit-stop, flashes, fades */
    feathers: [],
    weather: [],
    rings: [],
    weatherCarry: 0,
    hitStop: 0,
    flash: 0,
    flashColor: '#ffffff',
    fade: 0,
    afterimages: [],
    afterimageTick: 0,
    coinBump: 0,
    lastCoinsShown: 0,
    panelAt: 0,
    clearStarFx: 0,

    /* Menus — hit areas are rebuilt by every menu draw, the cursor indexes them */
    hitAreas: [],
    menuCursor: 0,
    prevState: STATE_TITLE,
    treeBranch: 0,
    treeSelected: null,
    treeLayout: null,
    treeBuyFlash: null,
    aviaryIndex: 0,
    helpPage: 0,
    menuBiomeIndex: 0,
    menuBiomeAt: 0
  });
})();
