/*
 * Shared game state: ONE long-lived object (SZ.SpaceRacing.state, called G in every
 * module) with every value more than one module reads or writes: screen state, track,
 * player ship, race progress, AI field, items, effects, career save, menu cursor and
 * input. Systems change it with plain property writes; nothing here has behaviour.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const { STATE_TITLE } = NS.constants;
  const { trackVariant } = NS.defs;

  NS.state = {
    viewScale: 1, // logical pixels -> backing-store pixels
    viewOffX: 0, // letterbox offset in backing-store pixels
    viewOffY: 0,
    renderScale: 1, // lowered automatically when frames get slow

    /* ── Tutorial ── */
    showTutorial: false,
    tutorialPage: 0,

    state: STATE_TITLE,
    currentTrackIndex: 0,
    currentVariant: trackVariant(0, false),
    track: null,
    geo: null, // built track geometry (SZ.RacingTrack.build)
    trackArt: null, // themed road/background art for the current track
    raceBoostPads: [], // [{x, y, angle}]
    raceHazards: [], // [{x, y, radius, type}]
    raceGravity: [], // [{x, y, mass, radius, type, color}]
    raceWormholes: [], // [{x, y, color, pairIndex}]
    raceItemBoxes: [], // [{x, y, angle, respawn}]
    camZoom: 1, // world -> screen zoom (1 = 1:1)

    // Player ship
    ship: { x: 0, y: 0, angle: 0, speed: 0, vx: 0, vy: 0, bank: 0, spin: 0, shieldTime: 0 },
    boostTimer: 0,
    boostActive: false,

    // Items and combat
    playerItem: null, // item name the player is carrying, or null
    playerItem2: null, // second slot, unlocked by the Item Rack
    projectiles: [], // [{x, y, angle, speed, target, owner, life}]
    mines: [], // [{x, y, owner, armed, life}]
    shockwaves: [], // [{x, y, r, life}]

    // Camera
    camX: 0,
    camY: 0,

    // Race state
    raceLaps: 3,
    playerLap: 0, // laps completed (0 at the start)
    wrongWay: false,
    raceTime: 0,
    playerPlace: 1,
    raceFinished: false,

    // Start countdown and skill mechanics
    countdown: 0,
    raceStarted: false,
    launchWindow: 0, // seconds left for a perfect start after GO
    earlyThrottle: false, // throttle was already down before GO
    stallTimer: 0, // throttle locked while this counts down
    boostMeter: 0,
    driftTime: 0,
    drifting: false,
    driftDir: 0,
    slipstream: 0, // 0..1 tow behind an opponent

    // Racing sound refresh timers
    engineTick: 0, // engine hum refresh
    engineBeat: 0, // hum beat counter, the low tone rides every second one
    driftTick: 0, // drift hiss refresh
    scrapeTick: 0, // barrier scrape refresh
    slipstreamSounded: false, // slipstream sweep, re-armed below 0.2

    // AI opponents
    opponents: [],

    // Wormhole cooldown (prevents ping-pong teleporting)
    wormholeCooldown: 0,
    aiWormholeCooldowns: [],

    // Global elapsed time for animations
    globalTime: 0,

    // Speed streaks flying away from the view center (screen space)
    speedLines: [],

    // Drift skid marks on the road (world space)
    skids: [],
    skidPrev: null,

    // Full-screen lap flashes (screen space)
    lapFlash: null,
    finalFlash: null,

    // Themed ambience particles and per-theme timers (screen space)
    ambient: [],
    stormFlash: 0,
    stormBolt: null,
    pulsarRings: [],

    // Boost kick edge detection
    prevBoostActive: false,

    // High scores
    highScores: [],

    // Ship selection & upgrades
    selectedShipIndex: 0,
    credits: 0,

    // Workshop tree screen
    treeBranch: 0,
    treeSelected: null, // node id of the keyboard selection
    treeBuyFlash: null, // { id, at } -- white flash over a just-bought card
    treeLayout: null, // rebuilt each frame: { tabs, cards, branch }

    // Career save (v2) and the race being driven
    save: null, // replaced by loadSave() at startup, before the first frame
    raceCup: null, // cup index while a cup race runs, null for a quick race
    lastCupResult: null, // { cup, standings, trophy } once a cup is done
    lastRaceReward: null, // { base, bonuses, total } of the last finished race

    // Menu screens: per-frame hit areas, keyboard cursor and screen data
    hitAreas: [], // { id, x, y, w, h, action, disabled } rebuilt every frame
    menuCursor: 0, // keyboard selection, index into hitAreas
    chosenCup: 0, // cup picked on the career screen
    cupIntroRace: 0, // race index shown on the cup intro
    lastStandings: [], // finishing order of the last race, for the results table
    lastPodium: [], // top three racers of the last race, for the podium
    lastRacePoints: {}, // cup points each racer earned in the last race
    resultsWasCup: false, // the last race belonged to a cup
    resultsTime: 0, // seconds since the results screen appeared
    standingsTime: 0, // seconds since the standings screen appeared
    confetti: [], // screen-space confetti on the results screen
    coinTick: 0, // last 'coin' tick of the reward count-up

    // Reward bonuses collected during one race, reset by resetGame()
    bonusPerfectStart: false,
    bonusMegaTurbos: 0,
    bonusHitsLanded: 0,
    bonusCleanRace: true,
    lastLapStamp: 0, // raceTime at the last completed player lap

    // Race HUD: panel fades, place-change chip, lap splits, minimap projection
    placeDelta: 0, // +1 gained a place, -1 lost one (0 = no recent change)
    placeDeltaAt: -99, // raceTime of the last place change
    lapSplitNumber: 0, // lap number of the shown split
    lapSplitTime: 0, // duration of the shown split
    lapSplitAt: -99, // raceTime the split popup appeared
    lapSplitBest: false, // the shown split is the best lap of this race
    raceBestLap: 0, // best lap driven so far in this race

    // Input
    keys: {},
    keyJustPressed: {},
    mouseX: -1,
    mouseY: -1,
    mouseDown: false,
    mouseControlActive: false
  };
  NS.state.track = NS.state.currentVariant;
})();
