;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* G: the one mutable game state every module reads and writes. All fields exist from
     the start, so the object keeps one shape; the systems mutate it in place. */

  const { BIRD_X, STATE_READY, STATE_TITLE } = NS.C;

  function freshPower() {
    return { shield: false, magnet: 0, slow: 0, ghost: 0, double: 0, tiny: 0, blast: 0, rush: 0, freeze: 0, gold: 0, buddy: 0 };
  }

  Object.assign(NS.state, {
    freshPower: freshPower,

    /* View — logical pixels -> backing-store pixels, letterbox offsets, pointer */
    viewScale: 1,
    viewOffX: 0,
    viewOffY: 0,
    mouseX: -1,                     // pointer in logical coordinates
    mouseY: -1,
    dpr: 1,
    touchUsed: false,               // a touch screen was used: show touch hints

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
    save: null,                     // the v3 save, see save.js
    season: null,                   // { event, key, daysLeft } for today
    twist: null,                    // today's Daily Challenge twist
    frameMs: 0,                     // smoothed JS time per frame

    /* Run */
    mode: 'classic',                // 'adventure' | 'classic' | 'arcade' | 'zen' | 'time' | 'daily' | 'bossrush'
    stageIndex: 0,                  // adventure: index into SZ.FlappyCourse.STAGES
    seed: 0,
    courseOpts: null,               // how the course was generated (kept with the snapshot)
    course: null,
    dist: 0,
    runTime: 0,
    worldT: 0,                      // the course clock: moving pipes and hazards; stops under Frost Time
    coinsRun: 0,
    coinsPicked: 0,
    tokensRun: 0,
    hearts: 1,
    heartsAtPause: 0,               // the heart limit when the pause menu opened (Nest upgrades)
    hitsTaken: 0,
    invuln: 0,
    timeLeft: 0,
    runSaveT: 0,                    // seconds until the next autosave snapshot

    /* Power-ups, combo, fever, arcade points */
    power: freshPower(),
    blastCharges: 0,
    buddy: { x: BIRD_X - 70, y: 260, shield: false },
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    coinCarry: 0,
    comboSaves: 0,
    revives: 0,
    coinStreak: 0,
    coinStreakTime: 0,
    fever: 0,                       // meter 0..1
    feverT: 0,                      // seconds of FEVER left
    points: 0,                      // arcade score
    mult: 1,
    multClean: 0,
    flow: 0,                        // zen: pipes in a row without a bump
    zenNote: 0,
    zenBumps: 0,

    /* Boss arena */
    boss: null,                     // SZ.FlappyBoss simulation while a boss fight runs
    bossIntro: 0,                   // seconds of the boss entrance banner left
    bossRush: null,                 // { list, index, time }
    bossBeaten: false,

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
    squash: 0,                      // flap stretch timer
    globalTime: 0,
    lastStars: 0,
    newBest: false,
    rankArcade: -1,                 // the new entry in the arcade table, or -1
    runReward: null,                // { coins, interest, quests } paid at the end of a run

    /* Juice — feathers, weather, hit-stop, flashes, fades, toasts */
    feathers: [],
    weather: [],
    rings: [],
    debris: [],
    weatherCarry: 0,
    hitStop: 0,
    flash: 0,
    flashColor: '#ffffff',
    fade: 0,
    afterimages: [],
    afterimageTick: 0,
    trailTick: 0,
    coinBump: 0,
    lastCoinsShown: 0,
    panelAt: 0,
    clearStarFx: 0,
    toasts: [],                     // achievement and quest pop-ups

    /* Cinematics */
    cine: null,                     // { id, shots, index, t, onEnd, skipArmed }

    /* Menus — hit areas are rebuilt by every menu draw, the cursor indexes them */
    hitAreas: [],
    menuCursor: 0,
    prevState: STATE_TITLE,
    treeBranch: 0,
    treeSelected: null,
    treeLayout: null,
    treeBuyFlash: null,
    aviaryIndex: 0,
    wardrobeTab: 0,
    mapSel: 0,
    goalsTab: 0,
    goalsPage: 0,
    helpPage: 0,
    menuBiomeIndex: 0,
    menuBiomeAt: 0,
    confirmReset: false
  });
})();
