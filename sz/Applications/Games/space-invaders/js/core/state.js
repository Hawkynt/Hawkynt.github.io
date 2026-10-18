/* The one shared game state object (NS.state, used as G everywhere): run, fleet, player,
   boss, effect timers, menu cursor and input. Plain long-lived properties; each group names
   the modules that write it, everyone else only reads. Reads constants. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const { BASE_MOVE_INTERVAL } = NS.constants;

  NS.state = {
    /* Screen and run (screens, waves, stages, sim, combat, input) */
    gameState: 'title',
    gameMode: 'classic',
    /* Random source: plain Math.random, or a seeded generator for the daily run */
    rand: Math.random,
    score: 0,
    lives: 3,
    level: 1,
    wave: 0,
    /* Simulation clock in ms (sim) */
    gameTime: 0,
    deathTimer: 0,
    levelCompleteTimer: 0,
    waveNameTimer: 0,
    waveNameText: '',

    /* Campaign run state (stages, combat) */
    stageIndex: 0,
    stageInfo: null,
    livesLost: 0,
    maxMultiplier: 1,
    stageResult: null,
    runResult: null,
    /* Star-pop jingle on the stage-clear screen: one 'coin' per earned star */
    stageStarBeats: 0,
    stageClearTime: 0,

    /* The persistent save (save, progress, stages) */
    save: null,

    /* Alien fleet and its fire (fleet, waves) */
    aliens: [],
    alienDir: 1,
    alienMoveTimer: 0,
    alienMoveInterval: BASE_MOVE_INTERVAL,
    alienBullets: [],
    alienShootTimer: 0,
    alienShootInterval: 2000,
    divers: [],
    alienFrame: 0,
    marchStep: 0,
    shields: [],
    ufo: null,
    ufoTimer: 0,
    ufoNextSpawn: 0,

    /* Player ship and shots (player, waves, combat) */
    player: { x: 0, y: 0, alive: true, tilt: 0 },
    playerBullets: [],
    playerShootCooldown: 0,

    /* Special ability: meter 0..100 fills, converts to charges, one fires at a time (special) */
    special: 0,
    specialCharges: 0,
    specialActive: 0,
    specialKind: '',
    specialTick: 0,
    novaRing: null,
    /* Dash / brief invulnerability (special, input) */
    invuln: 0,
    dash: null,
    dashCooldown: 0,
    lastTapDir: 0,
    lastTapTime: -1e9,

    /* Power-ups and the escort drone (powerups, special) */
    fallingPowerups: [],
    activePowerups: {},
    drone: null,
    droneShootTimer: 0,

    /* Combo scoring (combat) */
    comboCount: 0,
    comboTimer: 0,
    comboMultiplier: 1,

    /* Boss fight (boss, waves) */
    boss: null,
    bossActive: false,
    bossWarningTimer: 0,
    bossWarnBeats: 0,
    bossDescendY: 0,
    bossVictoryTimer: 0,
    bossFinale: 0,
    bossFinaleTick: 0,
    bossFinaleBox: null,

    /* Cosmetic effects (fx) */
    flares: [],
    /* Debris shards, shockwave rings and engine trails: own capped lists, cheap to draw */
    debris: [],
    rings: [],
    trails: [],
    trailFrame: 0,
    /* Hit-stop freezes the simulation for a beat on big impacts; fade/sweep are overlays */
    hitStop: 0,
    fade: 0,
    sweep: 0,
    comboPop: null,
    dyingSlow: 0,
    screenFlashAlpha: 0,
    screenFlashColor: '#fff',

    /* Menu flow: clickable items rebuilt every draw, one shared keyboard cursor (widgets, screens) */
    hitAreas: [],
    menuCursor: 0,
    prevScreen: 'title',
    helpPage: 0,
    helpFrom: 'title',

    /* Input (input) */
    keys: {},
    mouseX: -1,
    mouseY: -1,
    mouseGameX: -1,
    mouseDown: false,
    mouseActive: false,
  };
})();
