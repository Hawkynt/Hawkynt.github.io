;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ── Expand 3-digit hex (#rgb) to 6-digit (#rrggbb) before appending alpha hex digits ── */
  const _hexAlpha = (hex, alpha) => {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return h + alpha;
  };

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  let viewScale = 1;   // logical pixels -> backing-store pixels
  let viewOffX = 0;    // letterbox offset in backing-store pixels
  let viewOffY = 0;
  let renderScale = 1;       // lowered automatically when frames get slow
  let frameMsAvg = 16;       // smoothed real frame time
  let slowFrameTime = 0;     // seconds the frame time has stayed too high
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* ── States ── */
  const STATE_TITLE = 'TITLE';
  const STATE_CAREER = 'CAREER';
  const STATE_CUP_INTRO = 'CUP_INTRO';
  const STATE_TRACKS = 'TRACKS';
  const STATE_GARAGE = 'GARAGE';
  const STATE_TREE = 'TREE';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_RESULTS = 'RESULTS';
  const STATE_STANDINGS = 'STANDINGS';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-space-racing';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_CREDITS = STORAGE_PREFIX + '-credits';
  const STORAGE_UPGRADES = STORAGE_PREFIX + '-upgrades';
  const STORAGE_SELECTED_SHIP = STORAGE_PREFIX + '-selected-ship';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v2';
  const MAX_HIGH_SCORES = 5;

  /* ── Gravity wells ── */
  const GRAVITY_CONSTANT = 8000;
  const GRAVITY_MIN_DIST = 30;
  const GRAVITY_MAX_DIST = 420;

  /* ── Wormholes ── */
  const WORMHOLE_RADIUS = 28;
  const WORMHOLE_COOLDOWN = 1.5;

  /* ── Base ship physics (before ship/upgrade modifiers) ── */
  const BASE_ACCEL = 320;
  const BASE_BRAKE = 200;
  const SHIP_FRICTION = 0.985;
  const BASE_TURN_SPEED = 3.0;
  const BASE_MAX_SPEED = 400;
  const SHIP_RADIUS = 16;

  /* ── Boost ── */
  const BASE_BOOST_MULT = 1.8;
  const BASE_BOOST_DURATION = 1.5;

  /* ── Race start: countdown, launch, stall ── */
  const COUNTDOWN_TIME = 3.0;          // seconds of 3-2-1 before GO
  const PERFECT_START_WINDOW = 0.25;   // accelerate within this after GO for a launch boost
  const EARLY_THROTTLE_WINDOW = 0.5;   // throttle held this close to GO stalls the launch
  const STALL_DURATION = 0.7;          // seconds the throttle stays locked after a jump start

  /* ── Boost meter ── */
  const BOOST_METER_MAX = 100;
  const BOOST_COST = 35;               // meter spent per manual boost

  /* ── Drifting ── */
  const DRIFT_MIN_SPEED = 150;
  const DRIFT_TURN_MULT = 1.55;
  const DRIFT_TIER1 = 0.8, DRIFT_TIER2 = 1.6;   // seconds of drifting for blue / orange mini-turbo
  const DRIFT_ACCEL_MULT = 0.7;        // throttle while sliding sideways
  const DRIFT_METER_RATE = 9;          // meter gained per second of drifting

  /* ── Slipstream ── */
  const SLIPSTREAM_RANGE = 230, SLIPSTREAM_CONE = 0.45;   // world units, radians
  const SLIPSTREAM_MIN_SPEED = 120;
  const SLIP_METER_RATE = 12;          // meter gained per second in the tow
  const SLIP_SPEED_MULT = 0.06;        // extra top speed at full tow

  /* ── Race ── */
  const NUM_OPPONENTS = 3;

  /* ── AI ── */
  const AI_BASE_ACCEL = 270;
  const AI_BASE_TURN_SPEED = 2.6;
  const AI_SPEED_VARIANCE = 0.18;
  const AI_REACTION_DELAY = 0.18;
  const AI_MISTAKE_CHANCE = 0.005;
  const AI_MISTAKE_DURATION = 0.4;
  const AI_BRAKE_ON_TURN_THRESHOLD = 1.2;
  const AI_BRAKE_FACTOR = 0.65;

  /* ── Item boxes and combat items ── */
  const ITEM_BOX_RADIUS = 30;          // world units a racer has to reach a box with
  const ITEM_BOX_RESPAWN = 5;          // seconds until a taken box fills up again
  const ITEM_LATERAL = 0.3;            // row spread across the road, in track widths
  const ITEM_NAMES = ['missile', 'mine', 'shield', 'emp', 'turbo'];
  const ITEM_LABELS = { missile: 'MISSILE', mine: 'MINE', shield: 'SHIELD', emp: 'EMP', turbo: 'TURBO' };
  const ITEM_WEIGHTS = {               // pick weight by race place: 1st / 2nd / 3rd / 4th
    missile: [2, 3, 4, 4],
    mine: [4, 3, 2, 1],
    shield: [3, 3, 2, 2],
    emp: [0, 1, 2, 3],
    turbo: [1, 2, 3, 4]
  };
  const MISSILE_SPEED = 900, MISSILE_TURN = 3.5, MISSILE_LIFE = 4, MISSILE_HIT = 34;
  const MINE_ARM_TIME = 0.6, MINE_LIFE = 30, MINE_RADIUS = 30;
  const EMP_RADIUS = 500, SHIELD_TIME = 8, SPIN_RATE = 9;

  /* ── Credits ── */
  const CREDITS_1ST = 500;
  const CREDITS_2ND = 300;
  const CREDITS_3RD = 150;
  const CREDITS_4TH = 50;

  /* ── Race rewards: bonuses earned while the race runs ── */
  const REWARD_PERFECT_START = 50;
  const REWARD_MEGA_TURBO = 20;
  const REWARD_HIT = 30;
  const REWARD_CLEAN_RACE = 100;

  /* ══════════════════════════════════════════════════════════════════
     SHIP DEFINITIONS (5 ships with unique stats and visuals)
     ══════════════════════════════════════════════════════════════════ */

  const SHIP_DEFS = [
    {
      id: 'falcon',
      name: 'Star Falcon',
      description: 'Balanced all-rounder. Good for beginners.',
      color: '#4af',
      accentColor: '#27d',
      exhaustColor: '#48f',
      stats: { speed: 1.0, accel: 1.0, handling: 1.0, boost: 1.0 },
      shape: 'arrow',
      unlock: { free: true }
    },
    {
      id: 'viper',
      name: 'Neon Viper',
      description: 'Blazing fast but drifts on turns.',
      color: '#f44',
      accentColor: '#a22',
      exhaustColor: '#f84',
      stats: { speed: 1.25, accel: 0.9, handling: 0.7, boost: 1.1 },
      shape: 'dart',
      unlock: { trophy: 'bronze' }
    },
    {
      id: 'mantis',
      name: 'Void Mantis',
      description: 'Nimble and quick to accelerate. Fragile top speed.',
      color: '#4f4',
      accentColor: '#2a2',
      exhaustColor: '#8f4',
      stats: { speed: 0.85, accel: 1.3, handling: 1.25, boost: 0.9 },
      shape: 'wing',
      unlock: { price: 1500 }
    },
    {
      id: 'titan',
      name: 'Iron Titan',
      description: 'Slow starter but unstoppable at max speed.',
      color: '#fa0',
      accentColor: '#a70',
      exhaustColor: '#fc0',
      stats: { speed: 1.15, accel: 0.7, handling: 0.85, boost: 1.3 },
      shape: 'heavy',
      unlock: { trophy: 'silver' }
    },
    {
      id: 'phantom',
      name: 'Ghost Phantom',
      description: 'Excellent handling and boost. Lower raw speed.',
      color: '#c4f',
      accentColor: '#82a',
      exhaustColor: '#d8f',
      stats: { speed: 0.9, accel: 1.05, handling: 1.35, boost: 1.25 },
      shape: 'stealth',
      unlock: { trophy: 'gold' }
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     UPGRADE DEFINITIONS
     ══════════════════════════════════════════════════════════════════ */

  const UPGRADE_DEFS = [
    {
      id: 'engine',
      name: 'Engine',
      stat: 'speed',
      icon: 'SPD',
      maxLevel: 5,
      costBase: 200,
      costScale: 1.5,
      bonusPerLevel: 0.06
    },
    {
      id: 'thruster',
      name: 'Thruster',
      stat: 'accel',
      icon: 'ACC',
      maxLevel: 5,
      costBase: 180,
      costScale: 1.5,
      bonusPerLevel: 0.07
    },
    {
      id: 'gyro',
      name: 'Gyroscope',
      stat: 'handling',
      icon: 'HND',
      maxLevel: 5,
      costBase: 160,
      costScale: 1.4,
      bonusPerLevel: 0.06
    },
    {
      id: 'nitro',
      name: 'Nitro Tank',
      stat: 'boost',
      icon: 'BST',
      maxLevel: 5,
      costBase: 250,
      costScale: 1.6,
      bonusPerLevel: 0.08
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     WORKSHOP TECH TREE -- five branches of leveled upgrades bought with credits
     ══════════════════════════════════════════════════════════════════ */

  const TREE = {
    branches: [
      { id: 'engine', name: 'Engine', color: '#ff7a3a' },
      { id: 'handling', name: 'Handling', color: '#5ab8ff' },
      { id: 'hull', name: 'Hull', color: '#6fe08a' },
      { id: 'boost', name: 'Boost', color: '#c04cff' },
      { id: 'arsenal', name: 'Arsenal', color: '#ffd75a' }
    ],
    nodes: [
      { id: 'e_speed', branch: 'engine', name: 'Ion Drive', desc: '+4% top speed per level', costs: [300, 450, 700, 1000, 1500], req: [] },
      { id: 'e_accel', branch: 'engine', name: 'Thruster Array', desc: '+5% acceleration per level', costs: [250, 400, 600, 900, 1300], req: [] },
      { id: 'e_fusion', branch: 'engine', name: 'Fusion Core', desc: '+6% top speed and acceleration', costs: [3000], req: [['e_speed', 3], ['e_accel', 3]], trophy: 'silver' },

      { id: 'h_gyro', branch: 'handling', name: 'Gyro Stabilizers', desc: '+5% steering per level', costs: [250, 400, 600, 900, 1300], req: [] },
      { id: 'h_drift', branch: 'handling', name: 'Drift Coils', desc: 'Drifts charge 15% faster per level', costs: [500, 900, 1400], req: [['h_gyro', 1]] },
      { id: 'h_grip', branch: 'handling', name: 'Magnetic Grip', desc: '30% less drag off the road per level', costs: [600, 1100], req: [['h_gyro', 2]] },

      { id: 'u_armor', branch: 'hull', name: 'Reinforced Hull', desc: 'Spin-outs 15% shorter per level', costs: [400, 800, 1300], req: [] },
      { id: 'u_bumper', branch: 'hull', name: 'Shock Bumpers', desc: 'Keep 25% more speed when hitting the barrier', costs: [500, 1000], req: [['u_armor', 1]] },
      { id: 'u_shield', branch: 'hull', name: 'Shield Emitter', desc: 'Shields last 3 s longer per level', costs: [450, 850, 1300], req: [['u_armor', 1]] },

      { id: 'b_tank', branch: 'boost', name: 'Nitro Tank', desc: '+6% boost power per level', costs: [300, 450, 700, 1000, 1500], req: [] },
      { id: 'b_cap', branch: 'boost', name: 'Boost Capacitor', desc: 'Boost meter fills 15% faster per level', costs: [500, 900, 1400], req: [['b_tank', 1]] },
      { id: 'b_burn', branch: 'boost', name: 'Efficient Burners', desc: 'Manual boost costs 5 less per level', costs: [800, 1400], req: [['b_cap', 1]] },
      { id: 'b_launch', branch: 'boost', name: 'Launch Control', desc: 'Wider perfect-start window and a longer launch', costs: [900], req: [['b_tank', 2]] },

      { id: 'a_luck', branch: 'arsenal', name: 'Lucky Charms', desc: 'Better items from item boxes', costs: [400, 800, 1200], req: [] },
      { id: 'a_homing', branch: 'arsenal', name: 'Smart Missiles', desc: 'Missiles turn 40% faster per level', costs: [600, 1100], req: [['a_luck', 1]] },
      { id: 'a_emp', branch: 'arsenal', name: 'Wide EMP', desc: '+100 EMP radius per level', costs: [600, 1100], req: [['a_luck', 1]] },
      { id: 'a_twin', branch: 'arsenal', name: 'Twin Mines', desc: 'Mines drop in pairs', costs: [1200], req: [['a_luck', 2]] },
      { id: 'a_rack', branch: 'arsenal', name: 'Item Rack', desc: 'Carry a second item', costs: [2500], req: [['a_luck', 3]], trophy: 'gold' }
    ]
  };

  /* ══════════════════════════════════════════════════════════════════
     AI RACER PERSONALITIES (visually distinct, unique behaviors)
     ══════════════════════════════════════════════════════════════════ */

  const AI_PERSONALITIES = [
    {
      name: 'Blaze',
      color: '#f55',
      accentColor: '#c22',
      exhaustColor: '#f80',
      shape: 'dart',
      speedBias: 1.05,
      turnBias: 0.85,
      aggressiveness: 0.6,
      mistakeRate: 1.2,
      lane: -0.8
    },
    {
      name: 'Comet',
      color: '#fa0',
      accentColor: '#a70',
      exhaustColor: '#ff4',
      shape: 'wing',
      speedBias: 0.9,
      turnBias: 1.1,
      aggressiveness: 0.4,
      mistakeRate: 0.8,
      lane: 0.4
    },
    {
      name: 'Nebula',
      color: '#5f5',
      accentColor: '#2a2',
      exhaustColor: '#8f8',
      shape: 'heavy',
      speedBias: 0.95,
      turnBias: 0.95,
      aggressiveness: 0.5,
      mistakeRate: 1.0,
      lane: 0
    },
    {
      name: 'Pulse',
      color: '#f5f',
      accentColor: '#a2a',
      exhaustColor: '#faf',
      shape: 'stealth',
      speedBias: 0.85,
      turnBias: 1.15,
      aggressiveness: 0.3,
      mistakeRate: 1.4,
      lane: 0.9
    },
    {
      name: 'Drift',
      color: '#5ff',
      accentColor: '#2aa',
      exhaustColor: '#8ff',
      shape: 'arrow',
      speedBias: 1.0,
      turnBias: 1.0,
      aggressiveness: 0.5,
      mistakeRate: 1.1,
      lane: -0.3
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     TRACKS (large loops from tracks-data.js, built by track-geometry.js)
     ══════════════════════════════════════════════════════════════════ */

  const TRACKS = SZ.RacingTracks;

  /* ══════════════════════════════════════════════════════════════════
     CAREER -- four cups of four races, championship points per race
     ══════════════════════════════════════════════════════════════════ */

  /* races entries are [TRACKS index, reverse]; ai scales the field, reward the credits */
  const CUPS = [
    { id: 'bronze', name: 'Bronze Cup', color: '#d08a4a', ai: 0.92, reward: 1.0, races: [[0, false], [2, false], [3, false], [6, false]] },
    { id: 'silver', name: 'Silver Cup', color: '#c8d0e0', ai: 1.0, reward: 1.4, races: [[1, false], [4, false], [5, false], [7, false]] },
    { id: 'gold', name: 'Gold Cup', color: '#ffd75a', ai: 1.06, reward: 1.9, races: [[0, true], [3, true], [4, true], [7, true]] },
    { id: 'platinum', name: 'Platinum Cup', color: '#9fe8ff', ai: 1.12, reward: 2.5, races: [[2, true], [1, true], [5, true], [6, true]] }
  ];
  const CUP_POINTS = [10, 6, 4, 3];
  const CUP_RACES = 4;
  const TROPHY_RANK = { bronze: 1, silver: 2, gold: 3 };

  /* A racing track: the base definition, plus a reversed variant that keeps the
     start line where it is and runs the lap the other way round. Features move
     to the matching point of the lap (t -> 1 - t) and to the mirrored side. */
  function trackVariant(index, reverse) {
    const base = TRACKS[index];
    const variant = Object.assign({}, base);
    variant.key = base.name + (reverse ? ' R' : '');
    variant.displayName = base.name + (reverse ? ' (Reverse)' : '');
    variant.reverse = !!reverse;
    variant.baseIndex = index;
    if (reverse) {
      const cp = base.controlPoints;
      const points = [cp[0]];
      for (let i = cp.length - 1; i >= 1; --i)
        points.push(cp[i]);
      variant.controlPoints = points;
      variant.boost = base.boost.map(f => [(1 - f[0]) % 1, -f[1]]);
      variant.hazards = base.hazards.map(f => [(1 - f[0]) % 1, -f[1], f[2]]);
      variant.gravity = base.gravity.map(f => [(1 - f[0]) % 1, -f[1], f[2], f[3]]);
      variant.items = base.items.map(t => (1 - t) % 1);
      variant.wormholes = base.wormholes.map(w => [(1 - w[1]) % 1, (1 - w[0]) % 1]);
    }
    return variant;
  }

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.RacingUI.create(ctx);
  const statusPosition = document.getElementById('statusPosition');
  const statusLap = document.getElementById('statusLap');
  const statusSpeed = document.getElementById('statusSpeed');
  const statusTime = document.getElementById('statusTime');
  const statusCredits = document.getElementById('statusCredits');
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
    { title: 'Racing', lines: ['Up / W accelerates, Down / S brakes.', 'Left / Right or A / D steer.', 'Hold the mouse button to steer toward the cursor.', 'Finish all laps ahead of the AI field.', 'A WRONG WAY banner warns of a wrong direction.', 'The barrier at the track edge bounces you back.'] },
    { title: 'Drift & Boost', lines: ['Hold Space while steering to drift.', 'Blue sparks give a mini-turbo, orange a mega turbo.', 'Drifting and slipstream fill the boost meter.', 'Shift spends the meter on a boost.', 'Tuck in behind an opponent for the tow.', 'Accelerate right at GO for a perfect start.'] },
    { title: 'Items', lines: ['Drive through item boxes to grab an item.', 'E or the right mouse button uses it.', 'Missiles chase the racer ahead, mines drop behind.', 'Shields eat one hit, EMP spins out rivals.', 'Turbo is a short speed burst.', 'Boxes refill a few seconds after pickup.'] },
    { title: 'Career', lines: ['Four cups: Bronze, Silver, Gold, Platinum.', 'Each cup is four races, points 10/6/4/3.', 'Finish a cup top three for a trophy and the next cup.', 'Gold and Platinum run the tracks in reverse.', 'Trophies unlock ships and Workshop nodes.'] },
    { title: 'Workshop', lines: ['Spend race credits in the tech tree.', 'Five branches: Engine, Handling, Hull, Boost, Arsenal.', 'Nodes improve speed, steering, hull, boost and items.', 'Buy a prerequisite before the node behind it.', 'Two nodes also need a cup trophy.'] },
    { title: 'Controls', lines: ['Up / W accelerate, Down / S brake.', 'Left / Right or A / D steer, mouse steers too.', 'Space drift, Shift boost, E use item.', 'Esc pause, H help, F2 new race.', 'Garage and Workshop: title screen or Game menu.'] }
  ];

  let state = STATE_TITLE;
  let currentTrackIndex = 0;
  let currentVariant = trackVariant(0, false);
  let track = currentVariant;
  let geo = null;            // built track geometry (SZ.RacingTrack.build)
  let trackArt = null;       // themed road/background art for the current track
  let raceBoostPads = [];    // [{x, y, angle}]
  let raceHazards = [];      // [{x, y, radius, type}]
  let raceGravity = [];      // [{x, y, mass, radius, type, color}]
  let raceWormholes = [];    // [{x, y, color, pairIndex}]
  let raceItemBoxes = [];    // [{x, y, angle, respawn}]
  let camZoom = 1;           // world -> screen zoom (1 = 1:1)

  // Player ship
  let ship = { x: 0, y: 0, angle: 0, speed: 0, vx: 0, vy: 0, bank: 0, spin: 0, shieldTime: 0 };
  let boostTimer = 0;
  let boostActive = false;

  // Items and combat
  let playerItem = null;     // item name the player is carrying, or null
  let playerItem2 = null;    // second slot, unlocked by the Item Rack
  let projectiles = [];      // [{x, y, angle, speed, target, owner, life}]
  let mines = [];            // [{x, y, owner, armed, life}]
  let shockwaves = [];       // [{x, y, r, life}]

  // Camera
  let camX = 0;
  let camY = 0;

  // Race state
  let raceLaps = 3;
  let playerLap = 0;         // laps completed (0 at the start)
  let wrongWay = false;
  let raceTime = 0;
  let playerPlace = 1;
  let raceFinished = false;

  // Start countdown and skill mechanics
  let countdown = 0;
  let raceStarted = false;
  let launchWindow = 0;      // seconds left for a perfect start after GO
  let earlyThrottle = false; // throttle was already down before GO
  let stallTimer = 0;        // throttle locked while this counts down
  let boostMeter = 0;
  let driftTime = 0;
  let drifting = false;
  let driftDir = 0;
  let slipstream = 0;        // 0..1 tow behind an opponent

  // Racing sound refresh timers
  let engineTick = 0;        // engine hum refresh
  let engineBeat = 0;        // hum beat counter, the low tone rides every second one
  let driftTick = 0;         // drift hiss refresh
  let scrapeTick = 0;        // barrier scrape refresh
  let slipstreamSounded = false; // slipstream sweep, re-armed below 0.2

  // AI opponents
  let opponents = [];

  // Wormhole cooldown (prevents ping-pong teleporting)
  let wormholeCooldown = 0;
  let aiWormholeCooldowns = [];

  // Global elapsed time for animations
  let globalTime = 0;

  // Speed streaks flying away from the view center (screen space)
  let speedLines = [];

  // Drift skid marks on the road (world space)
  let skids = [];
  let skidPrev = null;

  // Full-screen lap flashes (screen space)
  let lapFlash = null;
  let finalFlash = null;

  // Themed ambience particles and per-theme timers (screen space)
  let ambient = [];
  let stormTimer = 0;
  let stormFlash = 0;
  let stormBolt = null;
  let pulsarTimer = 0;
  let pulsarRings = [];

  // Boost kick edge detection
  let prevBoostActive = false;

  // High scores
  let highScores = [];

  // Ship selection & upgrades
  let selectedShipIndex = 0;
  let credits = 0;
  let shipUpgrades = {};

  // Workshop tree screen
  let treeReturnState = STATE_TITLE;
  let treeBranch = 0;
  let treeSelected = null;   // node id of the keyboard selection
  let treeBuyFlash = null;   // { id, at } -- white flash over a just-bought card
  let treeLayout = null;     // rebuilt each frame: { tabs, cards, branch }

  // Career save (v2) and the race being driven
  let save = defaultSave();
  let raceCup = null;          // cup index while a cup race runs, null for a quick race
  let lastCupResult = null;    // { cup, standings, trophy } once a cup is done
  let lastRaceReward = null;   // { base, bonuses, total } of the last finished race

  // Menu screens: per-frame hit areas, keyboard cursor and screen data
  let hitAreas = [];           // { id, x, y, w, h, action, disabled } rebuilt every frame
  let menuCursor = 0;          // keyboard selection, index into hitAreas
  let chosenCup = 0;           // cup picked on the career screen
  let cupIntroRace = 0;        // race index shown on the cup intro
  let quickReverse = false;    // reverse toggle on the quick race screen
  let garageCursor = 0;        // ship previewed in the garage
  let titleShips = [];         // decorative ships looping across the title screen
  let lastStandings = [];      // finishing order of the last race, for the results table
  let lastPodium = [];         // top three racers of the last race, for the podium
  let lastRacePoints = {};     // cup points each racer earned in the last race
  let resultsWasCup = false;   // the last race belonged to a cup
  let resultsTime = 0;         // seconds since the results screen appeared
  let standingsTime = 0;       // seconds since the standings screen appeared
  let confetti = [];           // screen-space confetti on the results screen
  let coinTick = 0;            // last 'coin' tick of the reward count-up
  const trackGeoCache = {};    // built geometry per track variant key

  // Reward bonuses collected during one race, reset by resetGame()
  let bonusPerfectStart = false;
  let bonusMegaTurbos = 0;
  let bonusHitsLanded = 0;
  let bonusCleanRace = true;
  let lastLapStamp = 0;        // raceTime at the last completed player lap

  // Race HUD: panel fades, place-change chip, lap splits, minimap projection
  const hudFade = {};
  let placeDelta = 0;          // +1 gained a place, -1 lost one (0 = no recent change)
  let placeDeltaAt = -99;      // raceTime of the last place change
  let lapSplitNumber = 0;      // lap number of the shown split
  let lapSplitTime = 0;        // duration of the shown split
  let lapSplitAt = -99;        // raceTime the split popup appeared
  let lapSplitBest = false;    // the shown split is the best lap of this race
  let raceBestLap = 0;         // best lap driven so far in this race
  let minimapCache = null;     // projected minimap outline, rebuilt when geo changes

  // Input
  const keys = {};
  let keyJustPressed = {};
  let mouseX = -1, mouseY = -1;
  let mouseDown = false;
  let mouseControlActive = false;

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    // never render more than ~1.5 logical pixels per game pixel; the browser upscales the rest
    const dprRaw = window.devicePixelRatio || 1;
    const cssWv = Math.max(1, canvas.clientWidth);
    const cssHv = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssWv / CANVAS_W, cssHv / CANVAS_H);
    const dpr = Math.max(0.5, Math.min(dprRaw, 1.5 / Math.max(fit, 0.01)) * renderScale);
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewScale = Math.min(canvas.width / CANVAS_W, canvas.height / CANVAS_H);
    viewOffX = Math.round((canvas.width - CANVAS_W * viewScale) / 2);
    viewOffY = Math.round((canvas.height - CANVAS_H * viewScale) / 2);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
    ctx.imageSmoothingEnabled = true;
  }

  /* Fill the whole canvas (letterbox bars too), then return to logical coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  /* Paint the star field over the whole canvas, letterbox bars included */
  function drawFullBackground(camXv, camYv, zoom) {
    const padX = viewOffX / viewScale;
    const padY = viewOffY / viewScale;
    ctx.save();
    ctx.translate(-padX, -padY);
    trackArt.drawBackground(ctx, camXv - padX, camYv - padY, zoom, globalTime, CANVAS_W + 2 * padX, CANVAS_H + 2 * padY);
    ctx.restore();
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

  function defaultSave() {
    return {
      version: 2,
      credits: 0,
      selectedShip: 'falcon',
      unlockedShips: ['falcon'],
      tree: {},
      trophies: {},
      cupProgress: null,
      bestLaps: {},
      unlockedTracks: [],
      stats: { races: 0, wins: 0 }
    };
  }

  /* The old save kept credits, per-ship upgrade levels and a ship index; the
     upgrade levels are paid back as credits so nothing is lost. */
  function migrateOldSave() {
    const fresh = defaultSave();
    let oldCredits = 0;
    try {
      const raw = localStorage.getItem(STORAGE_CREDITS);
      if (raw)
        oldCredits = Number(JSON.parse(raw)) || 0;
    } catch (_) {}

    let oldUpgrades = {};
    try {
      const raw = localStorage.getItem(STORAGE_UPGRADES);
      if (raw)
        oldUpgrades = JSON.parse(raw) || {};
    } catch (_) {}

    let refund = 0;
    for (const key in oldUpgrades) {
      const colon = key.indexOf(':');
      if (colon < 0) continue;
      const upg = UPGRADE_DEFS.find(u => u.id === key.slice(colon + 1));
      if (!upg) continue;
      const level = oldUpgrades[key] | 0;
      for (let l = 0; l < level; ++l)
        refund += getUpgradeCost(upg, l);
    }

    let oldShipIndex = 0;
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED_SHIP);
      if (raw != null)
        oldShipIndex = JSON.parse(raw);
    } catch (_) {}

    fresh.credits = Math.max(0, Math.round(oldCredits + refund));
    const usedShip = SHIP_DEFS[oldShipIndex];
    if (usedShip) {
      fresh.selectedShip = usedShip.id;
      if (usedShip.id !== 'falcon')
        fresh.unlockedShips.push(usedShip.id);
    }
    return fresh;
  }

  function loadSave() {
    let stored = null;
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.version === 2)
          stored = parsed;
      }
    } catch (_) {
      stored = null;
    }
    if (stored) {
      save = Object.assign(defaultSave(), stored);
      return;
    }
    save = migrateOldSave();
    writeSave();
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
    } catch (_) {}
  }

  function getUpgradeLevel(shipId, upgradeId) {
    const key = shipId + ':' + upgradeId;
    return shipUpgrades[key] || 0;
  }

  function getUpgradeCost(upgradeDef, currentLevel) {
    return Math.floor(upgradeDef.costBase * Math.pow(upgradeDef.costScale, currentLevel));
  }

  /* Hook for the tech tree: it adds its bonuses to the ship's own stats here. */
  function applyTreeBonuses(stats) {
    stats.speed *= 1 + 0.04 * treeLevel('e_speed') + 0.06 * treeLevel('e_fusion');
    stats.accel *= 1 + 0.05 * treeLevel('e_accel') + 0.06 * treeLevel('e_fusion');
    stats.handling *= 1 + 0.05 * treeLevel('h_gyro');
    stats.boost *= 1 + 0.06 * treeLevel('b_tank');
    return stats;
  }

  /* ── Tree queries: level, requirements, purchasability ── */

  function treeLevel(id) {
    return save.tree[id] || 0;
  }

  function treeNodeById(id) {
    return TREE.nodes.find(n => n.id === id) || null;
  }

  function treeReqMet(node) {
    for (let i = 0; i < node.req.length; ++i)
      if (treeLevel(node.req[i][0]) < node.req[i][1])
        return false;
    return true;
  }

  function treeTrophyMet(node) {
    return !node.trophy || !!save.trophies[node.trophy];
  }

  function nodeState(node) {
    const level = treeLevel(node.id);
    if (level >= node.costs.length)
      return 'maxed';
    if (!treeReqMet(node) || !treeTrophyMet(node))
      return 'locked';
    if (save.credits < node.costs[level])
      return 'expensive';
    return level > 0 ? 'owned' : 'available';
  }

  function buyNode(node) {
    const st = nodeState(node);
    if (st !== 'available' && st !== 'owned') {
      SZ.GameAudio.play('error');
      return false;
    }
    const level = treeLevel(node.id);
    save.credits -= node.costs[level];
    credits = save.credits;
    save.tree[node.id] = level + 1;
    writeSave();
    SZ.GameAudio.play('coin');
    SZ.GameAudio.play('powerup');
    return true;
  }

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  function getEffectiveStats(shipDef) {
    const stats = { speed: shipDef.stats.speed, accel: shipDef.stats.accel, handling: shipDef.stats.handling, boost: shipDef.stats.boost };
    return applyTreeBonuses(stats);
  }

  /* ── Ship unlocks ── */

  function isShipUnlocked(def) {
    if (!def) return false;
    const req = def.unlock;
    if (!req || req.free) return true;
    if (save.unlockedShips.indexOf(def.id) >= 0) return true;
    if (req.trophy && save.trophies[req.trophy]) return true;
    return false;
  }

  function buyShip(def) {
    if (!def || isShipUnlocked(def)) return false;
    const price = def.unlock ? def.unlock.price : 0;
    if (!price || save.credits < price) return false;
    save.credits -= price;
    credits = save.credits;
    save.unlockedShips.push(def.id);
    writeSave();
    return true;
  }

  /* ── Cup flow ── */

  function isCupUnlocked(cupIndex) {
    if (cupIndex <= 0) return true;
    if (cupIndex >= CUPS.length) return false;
    return !!save.trophies[CUPS[cupIndex - 1].id];
  }

  /* The same three personalities drive every race of one cup */
  function pickCupPersonalities() {
    const shuffled = AI_PERSONALITIES.slice();
    for (let i = shuffled.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled.slice(0, NUM_OPPONENTS).map(p => p.name);
  }

  function setCupRace(cupIndex, raceIndex) {
    const race = CUPS[cupIndex].races[raceIndex];
    raceCup = cupIndex;
    currentTrackIndex = race[0];
    currentVariant = trackVariant(race[0], race[1]);
  }

  function startCup(cupIndex) {
    if (cupIndex < 0 || cupIndex >= CUPS.length || !isCupUnlocked(cupIndex)) return false;
    save.cupProgress = { cup: cupIndex, race: 0, points: {}, aiNames: pickCupPersonalities() };
    setCupRace(cupIndex, 0);
    writeSave();
    resetGame();
    return true;
  }

  function nextCupRace() {
    const progress = save.cupProgress;
    if (!progress) return false;
    if (!CUPS[progress.cup] || progress.race >= CUP_RACES) {
      save.cupProgress = null;
      writeSave();
      return false;
    }
    setCupRace(progress.cup, progress.race);
    resetGame();
    return true;
  }

  /* All four racers in finishing order: finished first by finish time, then by distance raced */
  function finalStandings() {
    const entries = [{ name: 'player', finished: true, finishTime: raceTime, dist: ship.ts.dist }];
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      entries.push({ name: ai.name, finished: ai.finished, finishTime: ai.finishTime, dist: ai.ts.dist });
    }
    entries.sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished && a.finishTime !== b.finishTime) return a.finishTime - b.finishTime;
      return b.dist - a.dist;
    });
    return entries;
  }

  function awardCupPoints(playerPlace) {
    const progress = save.cupProgress;
    if (!progress) return;
    const cup = CUPS[progress.cup];
    if (!cup) {
      save.cupProgress = null;
      return;
    }
    if (!progress.points) progress.points = {};
    const points = progress.points;
    const playerPts = CUP_POINTS[Math.max(0, Math.min(CUP_POINTS.length - 1, playerPlace - 1))];
    points.player = (points.player || 0) + playerPts;
    const standings = finalStandings();
    lastRacePoints = { player: playerPts };
    for (let i = 0; i < standings.length; ++i) {
      if (standings[i].name === 'player') continue;
      points[standings[i].name] = (points[standings[i].name] || 0) + CUP_POINTS[i];
      lastRacePoints[standings[i].name] = CUP_POINTS[i];
    }

    ++progress.race;
    if (save.unlockedTracks.indexOf(currentVariant.key) < 0)
      save.unlockedTracks.push(currentVariant.key);

    if (progress.race >= CUP_RACES) {
      const table = Object.keys(points).map(name => ({ name: name, points: points[name] }));
      table.sort((a, b) => b.points - a.points || (a.name === 'player' ? -1 : 1));
      let rank = 0;
      while (rank < table.length && table[rank].name !== 'player')
        ++rank;
      const trophy = rank === 0 ? 'gold' : rank === 1 ? 'silver' : rank === 2 ? 'bronze' : null;
      const held = save.trophies[cup.id];
      if (trophy && (!held || TROPHY_RANK[trophy] > TROPHY_RANK[held]))
        save.trophies[cup.id] = trophy;
      lastCupResult = { cup: cup.id, standings: table, trophy: trophy };
      save.cupProgress = null;
      raceCup = null;
      if (trophy === 'gold')
        setTimeout(() => SZ.GameAudio.play('win'), 600);
    }
  }

  function recordBestLap(lapTime) {
    if (!(lapTime > 0)) return;
    const key = currentVariant.key;
    const held = save.bestLaps[key];
    if (held === undefined || lapTime < held)
      save.bestLaps[key] = lapTime;
  }

  /* Credits for one finished race: placement plus the bonuses earned on the way */
  function awardRaceReward(place) {
    const cupFactor = raceCup !== null ? CUPS[raceCup].reward : 1;
    const base = Math.round(([CREDITS_1ST, CREDITS_2ND, CREDITS_3RD, CREDITS_4TH][place - 1] || CREDITS_4TH) * cupFactor);
    const bonuses = [];
    if (bonusPerfectStart) bonuses.push(['Perfect start', REWARD_PERFECT_START]);
    if (bonusMegaTurbos > 0) bonuses.push(['Mega turbos', bonusMegaTurbos * REWARD_MEGA_TURBO]);
    if (bonusHitsLanded > 0) bonuses.push(['Hits landed', bonusHitsLanded * REWARD_HIT]);
    if (bonusCleanRace) bonuses.push(['Clean race', REWARD_CLEAN_RACE]);

    let total = base;
    for (let i = 0; i < bonuses.length; ++i)
      total += bonuses[i][1];

    lastRaceReward = { base: base, bonuses: bonuses, total: total };
    save.credits += total;
    credits = save.credits;
    ++save.stats.races;
    if (place === 1)
      ++save.stats.wins;
    return lastRaceReward;
  }

  /* ── High scores ── */

  function addHighScore(time, trackName) {
    highScores.push({ time, track: trackName });
    highScores.sort((a, b) => a.time - b.time);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${formatTime(highScores[i].time)}</td><td>${highScores[i].track}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  function formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = (t % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  function getPlayerShipDef() {
    return SHIP_DEFS[selectedShipIndex];
  }

  /* Place all race features along the built track geometry */
  function buildRaceFeatures() {
    const L = geo.length;
    const at = (t, lateral) => {
      const p = geo.sampleAt(t * L);
      return { x: p.x + p.nx * lateral, y: p.y + p.ny * lateral, angle: p.angle };
    };

    raceBoostPads = track.boost.map(([t, lat]) => at(t, lat));

    raceHazards = track.hazards.map(([t, lat, type]) => ({
      ...at(t, lat),
      radius: { asteroid: 26, barrier: 30, flare: 34 }[type] || 26,
      type
    }));

    raceGravity = track.gravity.map(([t, side, mass, type]) => ({
      ...at(t, side * track.width),
      mass,
      radius: 22 + mass * 14,
      type,
      color: { planet: '#4a8', star: '#ff8', pulsar: '#8cf', quasar: '#f8f', blackhole: '#a6f' }[type] || '#4a8'
    }));

    raceWormholes = [];
    for (let k = 0; k < track.wormholes.length; ++k) {
      const [tFrom, tTo] = track.wormholes[k];
      const entryIndex = raceWormholes.length;
      raceWormholes.push({ ...at(tFrom, 0), color: '#f80', pairIndex: entryIndex + 1 });
      raceWormholes.push({ ...at(tTo, 0), color: '#08f', pairIndex: -1 });
    }

    raceItemBoxes = [];
    for (let k = 0; k < track.items.length; ++k) {
      for (let col = -1; col <= 1; ++col)
        raceItemBoxes.push({ ...at(track.items[k], col * ITEM_LATERAL * track.width), respawn: 0 });
    }
  }

  /* Build the current track geometry and place every racer on the start grid */
  function prepareTrack() {
    track = currentVariant;
    geo = SZ.RacingTrack.build(track);
    trackArt = SZ.RacingTrackArt.create(geo, track.theme);
    resetAmbience();
    skids = [];
    skidPrev = null;
    buildRaceFeatures();
    const shipDef = getPlayerShipDef();
    const stats = getEffectiveStats(shipDef);

    // Start grid: two columns of slots just behind the start line at s = 0
    const gridPos = (slot) => {
      const s = -90 - Math.floor(slot / 2) * 110;
      const lat = (slot % 2 ? -1 : 1) * track.width * 0.22;
      const p = geo.sampleAt(s);
      return { x: p.x + p.nx * lat, y: p.y + p.ny * lat, angle: p.angle };
    };

    const playerSlot = gridPos(2);
    ship.x = playerSlot.x;
    ship.y = playerSlot.y;
    ship.angle = playerSlot.angle;
    ship.speed = 0;
    ship.vx = 0;
    ship.vy = 0;
    ship.bank = 0;
    ship.spin = 0;
    ship.shieldTime = 0;
    ship.stats = stats;
    ship.def = shipDef;
    ship.ts = trackStateAt(ship.x, ship.y);
    boostTimer = 0;
    boostActive = false;
    prevBoostActive = false;
    ship.trail = [];
    playerItem = null;
    playerItem2 = null;
    projectiles = [];
    mines = [];
    shockwaves = [];

    camX = ship.x;
    camY = ship.y;
    camZoom = 1;

    // Pick NUM_OPPONENTS unique AI personalities -- a cup keeps its field for all four races
    let roster = null;
    const progress = raceCup !== null ? save.cupProgress : null;
    if (progress && progress.cup === raceCup && Array.isArray(progress.aiNames) && progress.aiNames.length) {
      roster = [];
      for (let i = 0; i < NUM_OPPONENTS; ++i) {
        const name = progress.aiNames[i % progress.aiNames.length];
        roster.push(AI_PERSONALITIES.find(p => p.name === name) || AI_PERSONALITIES[i % AI_PERSONALITIES.length]);
      }
    }
    if (!roster) {
      roster = AI_PERSONALITIES.slice();
      for (let i = roster.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = roster[i];
        roster[i] = roster[j];
        roster[j] = tmp;
      }
    }
    const cupStrength = raceCup !== null ? CUPS[raceCup].ai : 1;

    opponents = [];
    const gridSlots = [0, 1, 3];
    for (let i = 0; i < NUM_OPPONENTS; ++i) {
      const personality = roster[i % roster.length];
      const speedFactor = (1 - AI_SPEED_VARIANCE + Math.random() * AI_SPEED_VARIANCE * 2) * personality.speedBias * cupStrength;
      const slot = gridPos(gridSlots[i]);
      const ai = {
        x: slot.x,
        y: slot.y,
        angle: slot.angle,
        speed: 0,
        vx: 0,
        vy: 0,
        lap: 0,
        speedFactor,
        personality,
        color: personality.color,
        accentColor: personality.accentColor,
        exhaustColor: personality.exhaustColor,
        shape: personality.shape,
        name: personality.name,
        finished: false,
        finishTime: 0,
        reactionTimer: AI_REACTION_DELAY * (0.8 + Math.random() * 0.4),
        mistakeTimer: 0,
        mistakeAngle: 0,
        throttle: 0,
        bank: 0,
        spin: 0,
        shieldTime: 0,
        item: null,
        itemCooldown: 2 + Math.random() * 2,
        turbo: 0,
        trail: []
      };
      ai.ts = trackStateAt(ai.x, ai.y);
      opponents.push(ai);
    }

    aiWormholeCooldowns = opponents.map(() => 0);
  }

  function resetGame() {
    prepareTrack();

    raceLaps = track.laps;
    playerLap = 0;
    wrongWay = false;
    raceTime = 0;
    playerPlace = 1;
    raceFinished = false;

    countdown = COUNTDOWN_TIME;
    raceStarted = false;
    launchWindow = 0;
    earlyThrottle = false;
    stallTimer = 0;
    boostMeter = 30;
    driftTime = 0;
    drifting = false;
    driftDir = 0;
    slipstream = 0;
    engineTick = 0;
    engineBeat = 0;
    driftTick = 0;
    scrapeTick = 0;
    slipstreamSounded = false;

    speedLines = [];
    skids = [];
    skidPrev = null;
    lapFlash = null;
    finalFlash = null;
    wormholeCooldown = 0;
    globalTime = 0;

    bonusPerfectStart = false;
    bonusMegaTurbos = 0;
    bonusHitsLanded = 0;
    bonusCleanRace = true;
    lastLapStamp = 0;
    placeDelta = 0;
    placeDeltaAt = -99;
    lapSplitAt = -99;
    lapSplitBest = false;
    raceBestLap = 0;

    state = STATE_PLAYING;
    hitAreas.length = 0;
    SZ.GameAudio.play('powerup', { pitch: 0.7 });
    updateWindowTitle();
  }

  /* ── Menu screen entries: every screen change resets the keyboard cursor ── */

  function gotoState(next) {
    state = next;
    menuCursor = 0;
    hitAreas.length = 0;
    SZ.GameAudio.play('select');
    updateWindowTitle();
  }

  function enterTitle() {
    gotoState(STATE_TITLE);
  }

  function enterCareer() {
    gotoState(STATE_CAREER);
  }

  function enterTracks() {
    gotoState(STATE_TRACKS);
  }

  function enterGarage() {
    gotoState(STATE_GARAGE);
    menuCursor = selectedShipIndex;
  }

  function openCupIntro(cupIndex, raceIndex) {
    chosenCup = cupIndex;
    cupIntroRace = raceIndex;
    gotoState(STATE_CUP_INTRO);
  }

  function pauseRacing() {
    state = STATE_PAUSED;
    hitAreas.length = 0;
    menuCursor = 0;
  }

  function enterTree() {
    treeReturnState = state;
    state = STATE_TREE;
    hitAreas.length = 0;
    treeBranch = 0;
    treeSelected = null;
    treeLayout = null;
    updateWindowTitle();
  }

  function leaveTree() {
    state = treeReturnState;
    hitAreas.length = 0;
    if (state === STATE_TITLE)
      prepareTrack();   // refresh the ship stats with everything just bought
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     SHIP PHYSICS
     ══════════════════════════════════════════════════════════════════ */

  /* Number of 60 Hz frames covered by dt; snaps refresh jitter so 60 Hz stays one frame */
  function frameScale(dt) {
    const frames = dt * 60;
    return Math.abs(frames - 1) < 0.03 ? 1 : frames;
  }

  /* Per-frame rate (blend factor or chance) spread over the frames covered by dt */
  function frameRate(rate, dt) {
    const frames = frameScale(dt);
    return frames === 1 ? rate : 1 - Math.pow(1 - rate, frames);
  }

  function updateShip(dt) {
    if (state !== STATE_PLAYING) return;

    const stats = ship.stats;
    const accel = BASE_ACCEL * stats.accel;
    const brake = BASE_BRAKE * stats.accel;
    const slipMult = slipstream > 0.5 ? 1 + SLIP_SPEED_MULT * slipstream : 1;
    const maxSpeed = (boostActive ? BASE_MAX_SPEED * BASE_BOOST_MULT * stats.boost : BASE_MAX_SPEED) * stats.speed * slipMult;

    // Launch: accelerating right at GO pays off, holding the throttle before it stalls the engine
    if (stallTimer > 0)
      stallTimer -= dt;
    const throttleHeld = keys['ArrowUp'] || keys['KeyW'] || (mouseControlActive && mouseDown);
    if (launchWindow > 0) {
      launchWindow -= dt;
      if (throttleHeld && stallTimer <= 0) {
        boostActive = true;
        boostTimer = 1.0 + (treeLevel('b_launch') > 0 ? 0.5 : 0);
        bonusPerfectStart = true;
        floatingText.add(ship.x, ship.y - 40, 'PERFECT START!', { color: '#ffd75a', font: 'bold 20px sans-serif' });
        SZ.GameAudio.play('powerup');
        launchWindow = 0;
      }
    }

    // Spin-out after a hit: the hull rolls on and ignores the controls
    const spinning = ship.spin > 0;
    if (spinning) {
      ship.spin -= dt;
      ship.angle += SPIN_RATE * dt;
      drifting = false;
      driftTime = 0;
    }

    // Steering
    const steer = spinning ? 0 : (keys['ArrowLeft'] || keys['KeyA'] ? -1 : 0) + (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0);

    // Drifting: hold Space while steering at speed, release for a mini-turbo
    if (keys['Space'] && steer !== 0 && ship.speed > DRIFT_MIN_SPEED) {
      if (!drifting) {
        drifting = true;
        driftDir = steer;
        driftTime = 0;
      }
      driftTime += dt * (1 + 0.15 * treeLevel('h_drift'));
      boostMeter = Math.min(BOOST_METER_MAX, boostMeter + DRIFT_METER_RATE * (1 + 0.15 * treeLevel('b_cap')) * dt);
      if (Math.random() < frameRate(0.6, dt)) {
        const sparkColor = driftTime >= DRIFT_TIER2 ? '#ffaa3a' : driftTime >= DRIFT_TIER1 ? '#5ab8ff' : '#9ad8ff';
        const perp = ship.angle + Math.PI / 2;
        const kickX = Math.cos(perp) * 30 * driftDir;
        const kickY = Math.sin(perp) * 30 * driftDir;
        for (let side = -1; side <= 1; side += 2) {
          particles.burst(
            ship.x - Math.cos(ship.angle) * 12 + Math.cos(perp) * 9 * side,
            ship.y - Math.sin(ship.angle) * 12 + Math.sin(perp) * 9 * side,
            1,
            { color: sparkColor, speed: 2.5, life: 0.3, size: 2, vx: kickX, vy: kickY }
          );
        }
      }
    } else if (drifting) {
      if (driftTime >= DRIFT_TIER2) {
        boostActive = true;
        boostTimer = 1.1;
        ++bonusMegaTurbos;
        floatingText.add(ship.x, ship.y - 40, 'MEGA TURBO!', { color: '#ffaa3a', font: 'bold 20px sans-serif' });
        SZ.GameAudio.play('powerup', { pitch: 1.2 });
      } else if (driftTime >= DRIFT_TIER1) {
        boostActive = true;
        boostTimer = 0.6;
        floatingText.add(ship.x, ship.y - 40, 'TURBO!', { color: '#5ab8ff', font: 'bold 18px sans-serif' });
        SZ.GameAudio.play('whoosh', { pitch: 1.4 });
      }
      drifting = false;
      driftTime = 0;
    }

    // Manual boost: spend the meter with Shift
    if ((keyJustPressed['ShiftLeft'] || keyJustPressed['ShiftRight']) && raceStarted) {
      const boostCost = BOOST_COST - 5 * treeLevel('b_burn');
      if (!boostActive && boostMeter >= boostCost) {
        boostMeter -= boostCost;
        boostActive = true;
        boostTimer = 1.0 * stats.boost;
        SZ.GameAudio.play('whoosh', { pitch: 1.6 });
        screenShake.trigger(4, 150);
      } else if (boostMeter < boostCost)
        SZ.GameAudio.play('error', { volume: 0.4 });
    }

    const turnSpeed = BASE_TURN_SPEED * stats.handling * (drifting ? DRIFT_TURN_MULT : 1);
    if (!spinning && (keys['ArrowLeft'] || keys['KeyA']))
      ship.angle -= turnSpeed * dt;
    if (!spinning && (keys['ArrowRight'] || keys['KeyD']))
      ship.angle += turnSpeed * dt;

    // Mouse steering: ship follows mouse cursor while button pressed
    // Use screen-space coordinates so camera smoothing lag doesn't offset the angle
    if (!spinning && mouseControlActive && mouseDown && mouseX >= 0) {
      const sp = worldToScreen(ship.x, ship.y);
      const shipScreenX = sp.x;
      const shipScreenY = sp.y;
      const mx = mouseX - shipScreenX;
      const my = mouseY - shipScreenY;
      if (mx * mx + my * my > 25)
        ship.angle = Math.atan2(my, mx);
    }

    // Hull bank: ease toward the direction being steered, back to level when not
    ship.bank += (steer - ship.bank) * frameRate(0.15, dt);

    // Acceleration / braking
    if (throttleHeld && stallTimer <= 0 && !spinning) {
      const launchAccel = accel * (drifting ? DRIFT_ACCEL_MULT : 1);
      ship.vx += Math.cos(ship.angle) * launchAccel * dt;
      ship.vy += Math.sin(ship.angle) * launchAccel * dt;
    }
    if (!spinning && (keys['ArrowDown'] || keys['KeyS'])) {
      ship.vx -= Math.cos(ship.angle) * brake * dt;
      ship.vy -= Math.sin(ship.angle) * brake * dt;
    }

    // Friction
    const friction = Math.pow(SHIP_FRICTION, frameScale(dt));
    ship.vx *= friction;
    ship.vy *= friction;

    // Clamp speed
    ship.speed = Math.sqrt(ship.vx * ship.vx + ship.vy * ship.vy);
    if (ship.speed > maxSpeed) {
      const ratio = maxSpeed / ship.speed;
      ship.vx *= ratio;
      ship.vy *= ratio;
      ship.speed = maxSpeed;
    }

    // Move
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    advanceTrackState(ship.ts, ship.x, ship.y);
    applyTrackLimits(ship, dt, true);

    // Boost timer
    if (boostActive) {
      boostTimer -= dt;
      if (boostTimer <= 0) {
        boostActive = false;
        boostTimer = 0;
      }
      particles.trail(
        ship.x - Math.cos(ship.angle) * 14,
        ship.y - Math.sin(ship.angle) * 14,
        { color: ship.def.exhaustColor || '#f80', speed: 1.5, life: 0.4, count: 2 }
      );
    }
  }

  /* Slipstream: sit in the tow of an opponent ahead to refill the boost meter */
  function updateSlipstream(dt) {
    if (state !== STATE_PLAYING || !raceStarted) {
      slipstream = 0;
      return;
    }

    let towed = false;
    if (ship.speed > SLIPSTREAM_MIN_SPEED) {
      const heading = Math.atan2(ship.vy, ship.vx);
      let nearest = SLIPSTREAM_RANGE;
      for (let i = 0; i < opponents.length; ++i) {
        const ai = opponents[i];
        const dx = ai.x - ship.x;
        const dy = ai.y - ship.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= nearest || d < 1) continue;
        let da = Math.atan2(dy, dx) - heading;
        while (da > Math.PI) da -= TWO_PI;
        while (da < -Math.PI) da += TWO_PI;
        if (Math.abs(da) < SLIPSTREAM_CONE) {
          towed = true;
          nearest = d;
        }
      }
    }

    slipstream = towed ? Math.min(1, slipstream + dt * 2) : Math.max(0, slipstream - dt * 3);

    if (slipstream < 0.2)
      slipstreamSounded = false;
    if (slipstream > 0.5) {
      if (!slipstreamSounded) {
        slipstreamSounded = true;
        SZ.GameAudio.sweep(400, 900, 0.3, 'sine', 0.05);
      }
      boostMeter = Math.min(BOOST_METER_MAX, boostMeter + SLIP_METER_RATE * (1 + 0.15 * treeLevel('b_cap')) * dt);
      if (Math.random() < frameRate(0.4, dt)) {
        // thin wind streaks running past the hull
        const side = Math.random() > 0.5 ? 1 : -1;
        const perp = ship.angle + Math.PI / 2 * side;
        particles.trail(
          ship.x + Math.cos(perp) * 14 - Math.cos(ship.angle) * 6,
          ship.y + Math.sin(perp) * 14 - Math.sin(ship.angle) * 6,
          { vx: -ship.vx * 0.02, vy: -ship.vy * 0.02, color: 'rgba(255,255,255,0.7)', life: 0.2, size: 1, decay: 0.06, shrink: 0.96 }
        );
      }
    }
  }

  /* Countdown to GO: accelerating right at the green light pays off, holding the
     throttle just before it stalls the engine */
  function updateRaceStart(dt) {
    if (state !== STATE_PLAYING || raceFinished || raceStarted) return;

    countdown -= dt;
    const throttleHeld = keys['ArrowUp'] || keys['KeyW'] || (mouseControlActive && mouseDown);
    if (throttleHeld && countdown <= EARLY_THROTTLE_WINDOW)
      earlyThrottle = true;
    if (countdown > 0) return;

    raceStarted = true;
    launchWindow = PERFECT_START_WINDOW * (treeLevel('b_launch') > 0 ? 2 : 1);
    if (earlyThrottle) {
      stallTimer = STALL_DURATION;
      floatingText.add(ship.x, ship.y - 40, 'JUMP START!', { color: '#ff6a6a', font: 'bold 18px sans-serif' });
      SZ.GameAudio.play('error', { volume: 0.5 });
    } else {
      floatingText.add(ship.x, ship.y - 40, 'GO!', { color: '#6fe08a', font: 'bold 26px sans-serif' });
      SZ.GameAudio.play('powerup', { pitch: 1.5 });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AI OPPONENTS (nerfed + distinct behaviors)
     ══════════════════════════════════════════════════════════════════ */

  function updateAI(dt) {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      if (ai.finished) continue;

      const p = ai.personality;

      // Turbo item: extra speed and acceleration while it lasts
      if (ai.turbo > 0)
        ai.turbo -= dt;
      const spinning = ai.spin > 0;

      // Reaction delay: AI doesn't steer onto the racing line instantly
      ai.reactionTimer -= dt;
      if (ai.reactionTimer > 0) {
        // During reaction delay, just coast with friction
        const coastFriction = Math.pow(SHIP_FRICTION, frameScale(dt));
        ai.vx *= coastFriction;
        ai.vy *= coastFriction;
        ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
        ai.x += ai.vx * dt;
        ai.y += ai.vy * dt;
        advanceTrackState(ai.ts, ai.x, ai.y);
        applyTrackLimits(ai, dt, false);
        continue;
      }

      // Mistake system: occasionally steer the wrong way
      if (ai.mistakeTimer > 0) {
        ai.mistakeTimer -= dt;
        if (!spinning)
          ai.angle += ai.mistakeAngle * dt;
      } else if (Math.random() < frameRate(AI_MISTAKE_CHANCE * p.mistakeRate, dt)) {
        ai.mistakeTimer = AI_MISTAKE_DURATION * (0.5 + Math.random());
        ai.mistakeAngle = (Math.random() > 0.5 ? 1 : -1) * (1.0 + Math.random() * 1.5);
      }

      // Spin-out after a hit: the hull rolls on and ignores the racing line
      if (spinning) {
        ai.spin -= dt;
        ai.angle += SPIN_RATE * dt;
      }

      // Steer along a racing line ahead on the track
      const L = geo.length;
      const lookAhead = 140 + ai.speed * 0.45;
      const lp = geo.sampleAt(ai.ts.s + lookAhead);
      const lane = ai.personality.lane !== undefined ? ai.personality.lane : 0;
      const sway = Math.sin(globalTime * 0.7 + i * 1.9) * geo.width * 0.08;
      const lat = lane * geo.width * 0.22 + sway;
      const tx = lp.x + lp.nx * lat, ty = lp.y + lp.ny * lat;
      const dx = tx - ai.x;
      const dy = ty - ai.y;
      const targetAngle = Math.atan2(dy, dx);

      let angleDiff = targetAngle - ai.angle;
      while (angleDiff > Math.PI) angleDiff -= TWO_PI;
      while (angleDiff < -Math.PI) angleDiff += TWO_PI;

      const turnSpeed = AI_BASE_TURN_SPEED * p.turnBias;
      if (!spinning && ai.mistakeTimer <= 0) {
        if (angleDiff > 0)
          ai.angle += Math.min(turnSpeed * dt, angleDiff);
        else
          ai.angle += Math.max(-turnSpeed * dt, angleDiff);
      }

      // Hull bank: ease toward the side the AI is turning to
      const steer = Math.abs(angleDiff) > 0.05 ? (angleDiff > 0 ? 1 : -1) : 0;
      ai.bank += (steer - ai.bank) * frameRate(0.15, dt);

      // Sparks at the rear while an AI slides through a bend
      if (Math.abs(angleDiff) > 0.6 && ai.speed > 180 && Math.random() < frameRate(0.3, dt))
        particles.burst(
          ai.x - Math.cos(ai.angle) * 12,
          ai.y - Math.sin(ai.angle) * 12,
          1,
          { color: '#9ad8ff', speed: 2, life: 0.25, size: 1.5 }
        );

      // Brake before bends (AI is less efficient at this)
      const absAngleDiff = Math.abs(angleDiff);
      const a1 = geo.sampleAt(ai.ts.s + 80).angle;
      const a2 = geo.sampleAt(ai.ts.s + 380 + ai.speed * 0.3).angle;
      let bend = Math.abs(a2 - a1);
      if (bend > Math.PI) bend = TWO_PI - bend;
      let throttle = 1.0;
      if (bend > 0.9 || absAngleDiff > AI_BRAKE_ON_TURN_THRESHOLD)
        throttle = AI_BRAKE_FACTOR;
      else if (bend > 0.5)
        throttle = 0.85;

      // Rubber band: keep the race close
      const gap = (ai.ts.dist - ship.ts.dist) / L;     // + = AI ahead
      const band = gap > 0.12 ? 0.94 : gap < -0.12 ? 1.07 : 1;

      // Smooth throttle transitions
      ai.throttle += (throttle - ai.throttle) * frameRate(0.1, dt);

      // Accelerate along the racing line
      const accel = (spinning ? 0 : AI_BASE_ACCEL * ai.speedFactor * ai.throttle * band) * (ai.turbo > 0 ? 1.4 : 1);
      ai.vx += Math.cos(ai.angle) * accel * dt;
      ai.vy += Math.sin(ai.angle) * accel * dt;

      // Friction
      const friction = Math.pow(SHIP_FRICTION, frameScale(dt));
      ai.vx *= friction;
      ai.vy *= friction;

      // Clamp speed
      ai.speed = Math.sqrt(ai.vx * ai.vx + ai.vy * ai.vy);
      const aiMax = BASE_MAX_SPEED * ai.speedFactor * 0.93 * (ai.turbo > 0 ? 1.5 : 1);
      if (ai.speed > aiMax) {
        const ratio = aiMax / ai.speed;
        ai.vx *= ratio;
        ai.vy *= ratio;
        ai.speed = aiMax;
      }

      // Move
      ai.x += ai.vx * dt;
      ai.y += ai.vy * dt;
      advanceTrackState(ai.ts, ai.x, ai.y);
      applyTrackLimits(ai, dt, false);

      // Exhaust particles for AI
      if (ai.speed > 80) {
        const exhaustRate = ai.speed > 200 ? 0.3 : 0.1;
        if (Math.random() < exhaustRate)
          particles.trail(
            ai.x - Math.cos(ai.angle) * 12,
            ai.y - Math.sin(ai.angle) * 12,
            { color: ai.exhaustColor, speed: 0.8, life: 0.25, count: 1 }
          );
      }

      // Laps from the distance covered along the track
      const aiLaps = Math.floor(ai.ts.dist / L);
      if (!ai.finished && aiLaps >= raceLaps) {
        ai.finished = true;
        ai.finishTime = raceTime;
      }
      ai.lap = Math.max(0, Math.min(raceLaps, aiLaps));
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TRACK PROGRESS / LAP / FINISH
     ══════════════════════════════════════════════════════════════════ */

  /* Where a racer is along the track: arc position, search hint and total distance raced */
  function trackStateAt(x, y) {
    const r = geo.locate(x, y);
    const L = geo.length;
    return { s: r.s, hint: r.index, dist: r.s > L / 2 ? r.s - L : r.s, off: r.dist, lateral: r.lateral, lapsDone: 0 };
  }

  function advanceTrackState(st, x, y) {
    const r = geo.locate(x, y, st.hint);
    st.dist += geo.progress(st.s, r.s);
    st.s = r.s;
    st.hint = r.index;
    st.off = r.dist;
    st.lateral = r.lateral;
    return r;
  }

  /* Off the road: drag; far off: a soft barrier pushes back toward the road */
  function applyTrackLimits(racer, dt, isPlayer) {
    const st = racer.ts;
    const half = geo.width / 2;
    if (st.off <= half) return;
    const dragBase = isPlayer ? 0.965 + 0.0105 * treeLevel('h_grip') : 0.965;
    const drag = Math.pow(dragBase, frameScale(dt));
    racer.vx *= drag;
    racer.vy *= drag;
    const c = geo.sampleAt(st.s);
    const dx = racer.x - c.x, dy = racer.y - c.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    if (isPlayer && Math.random() < 0.4)
      particles.trail(racer.x, racer.y, { color: '#8a7a6a', speed: 0.6, life: 0.5, count: 1 });
    const wall = half + 40;
    if (d > wall) {
      // put the racer back onto the barrier line and bounce the outward speed
      if (isPlayer)
        bonusCleanRace = false;
      racer.x = c.x + dx / d * wall;
      racer.y = c.y + dy / d * wall;
      const out = (racer.vx * dx + racer.vy * dy) / d;
      if (out > 0) {
        const speedBefore = Math.sqrt(racer.vx * racer.vx + racer.vy * racer.vy);
        racer.vx -= dx / d * out * 1.4;
        racer.vy -= dy / d * out * 1.4;
        if (isPlayer) {
          // shock bumpers: keep a bigger share of the speed, never more than before the hit
          const speedAfter = Math.sqrt(racer.vx * racer.vx + racer.vy * racer.vy);
          if (speedAfter > 1) {
            const keep = Math.min(speedBefore, speedAfter * (1 + 0.25 * treeLevel('u_bumper'))) / speedAfter;
            racer.vx *= keep;
            racer.vy *= keep;
          }
        }
        if (isPlayer && out > 80) {
          particles.burst(racer.x, racer.y, 10, { color: '#9cf', speed: 3, life: 0.35 });
          screenShake.trigger(5, 200);
          SZ.GameAudio.play('thud', { volume: 0.6 });
        }
      }
    }
  }

  function updateRace(dt) {
    if (state !== STATE_PLAYING || raceFinished || !raceStarted) return;

    raceTime += dt;

    const L = geo.length;
    const lapsDone = Math.floor(ship.ts.dist / L);
    if (lapsDone > playerLap && lapsDone >= 1) {
      playerLap = Math.min(raceLaps, lapsDone);
      const lapTime = raceTime - lastLapStamp;
      recordBestLap(lapTime);
      lapSplitNumber = playerLap;
      lapSplitTime = lapTime;
      lapSplitAt = raceTime;
      lapSplitBest = !(raceBestLap > 0) || lapTime < raceBestLap;
      if (!(raceBestLap > 0) || lapTime < raceBestLap)
        raceBestLap = lapTime;
      lastLapStamp = raceTime;
      lapFlash = { alpha: 0.35, color: '#ffffff', rate: 1 };
      if (playerLap === raceLaps - 1) {
        finalFlash = { alpha: 0.3, color: '#ffd75a', rate: 0.3 / 0.35 };
        screenShake.trigger(4, 200);
      }
      if (playerLap >= raceLaps)
        finishRace();
      else {
        if (playerLap === raceLaps - 1) {
          SZ.GameAudio.play('levelup', { pitch: 1.2 });
          SZ.GameAudio.tone(1319, 0.05, 'square', 0.07, 0.15);
          SZ.GameAudio.tone(1760, 0.18, 'square', 0.07, 0.20);
        } else
          SZ.GameAudio.play('levelup');
        floatingText.add(ship.x, ship.y - 60, playerLap === raceLaps - 1 ? 'FINAL LAP!' : `Lap ${playerLap + 1}/${raceLaps}`, { color: '#ff0', font: 'bold 22px sans-serif' });
      }
    }

    // place: finished racers first by finish time, then by distance raced
    let place = 1;
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      if (ai.finished || ai.ts.dist > ship.ts.dist)
        ++place;
    }
    if (place !== playerPlace) {
      placeDelta = place < playerPlace ? 1 : -1;
      placeDeltaAt = raceTime;
      if (place < playerPlace)
        SZ.GameAudio.play('blip', { pitch: 1.4 });
      else
        SZ.GameAudio.play('blip', { pitch: 0.7, volume: 0.6 });
    }
    playerPlace = place;
    wrongWay = ship.speed > 60 && geo.progress(ship.ts.s, geo.locate(ship.x + ship.vx * 0.2, ship.y + ship.vy * 0.2, ship.ts.hint).s) < -2;
  }

  function finishRace() {
    raceFinished = true;
    state = STATE_RESULTS;
    hitAreas.length = 0;

    // Determine final placement: count AIs that finished before the player,
    // plus AIs that were further along the track when the player crossed the line
    let finalPlace = 1;
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      if ((ai.finished && ai.finishTime <= raceTime) || ai.ts.dist > ship.ts.dist)
        ++finalPlace;
    }

    playerPlace = finalPlace;
    SZ.GameAudio.play(finalPlace === 1 ? 'win' : finalPlace <= 3 ? 'levelup' : 'lose');

    // Everything the results screen shows, captured before the cup bookkeeping
    resultsWasCup = raceCup !== null;
    lastStandings = finalStandings();
    lastPodium = lastStandings.slice(0, 3).map(entry => {
      if (entry.name === 'player') {
        const pd = getPlayerShipDef();
        return { name: 'YOU', color: pd.color, accent: pd.accentColor, exhaust: pd.exhaustColor, shape: pd.shape, player: true };
      }
      const ai = opponents.find(a => a.name === entry.name);
      return ai ? { name: ai.name, color: ai.color, accent: ai.accentColor, exhaust: ai.exhaustColor, shape: ai.shape } : null;
    });
    resultsTime = 0;
    standingsTime = 0;
    coinTick = 0;
    confetti = [];

    // Award credits: placement plus the bonuses earned during the race
    awardRaceReward(finalPlace);
    if (raceCup !== null)
      awardCupPoints(finalPlace);
    writeSave();

    // Confetti for podium finishes (1st, 2nd, 3rd)
    if (finalPlace <= 3)
      spawnConfetti();

    addHighScore(raceTime, track.name);
    updateWindowTitle();
  }

  function getOrdinal(n) {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return n + 'th';
  }

  /* ══════════════════════════════════════════════════════════════════
     BOOST PADS
     ══════════════════════════════════════════════════════════════════ */

  function checkBoostPads() {
    if (state !== STATE_PLAYING) return;

    const stats = ship.stats;
    for (let i = 0; i < raceBoostPads.length; ++i) {
      const pad = raceBoostPads[i];
      const dx = pad.x - ship.x;
      const dy = pad.y - ship.y;
      if (dx * dx + dy * dy < 30 * 30) {
        if (!boostActive)
          SZ.GameAudio.play('whoosh', { pitch: 1.5 });
        boostActive = true;
        boostTimer = BASE_BOOST_DURATION * stats.boost;
        floatingText.add(ship.x, ship.y - 20, 'BOOST!', {
          color: '#0ff',
          font: 'bold 16px sans-serif'
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     HAZARD COLLISIONS
     ══════════════════════════════════════════════════════════════════ */

  function checkHazards() {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < raceHazards.length; ++i) {
      const h = raceHazards[i];
      const dx = h.x - ship.x;
      const dy = h.y - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < h.radius + SHIP_RADIUS) {
        ship.speed *= 0.4;
        ship.vx *= 0.4;
        ship.vy *= 0.4;

        const pushAngle = Math.atan2(-dy, -dx);
        ship.x += Math.cos(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);
        ship.y += Math.sin(pushAngle) * (h.radius + SHIP_RADIUS - dist + 2);

        particles.burst(ship.x, ship.y, 12, {
          color: '#ff0',
          speed: 3,
          life: 0.3
        });

        screenShake.trigger(8, 300);
        SZ.GameAudio.play('thud');
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GRAVITY WELLS
     ══════════════════════════════════════════════════════════════════ */

  function applyGravity(dt) {
    if (state !== STATE_PLAYING) return;
    const bodies = raceGravity;
    if (!bodies || !bodies.length) return;

    for (let b = 0; b < bodies.length; ++b) {
      const body = bodies[b];

      // Apply to player
      const pdx = body.x - ship.x;
      const pdy = body.y - ship.y;
      const pDistSq = pdx * pdx + pdy * pdy;
      const pDist = Math.sqrt(pDistSq);
      if (pDist > GRAVITY_MIN_DIST && pDist < GRAVITY_MAX_DIST) {
        const force = GRAVITY_CONSTANT * body.mass / pDistSq;
        ship.vx += (pdx / pDist) * force * dt;
        ship.vy += (pdy / pDist) * force * dt;
      }

      // Apply to AI opponents
      for (let i = 0; i < opponents.length; ++i) {
        const ai = opponents[i];
        if (ai.finished) continue;
        const adx = body.x - ai.x;
        const ady = body.y - ai.y;
        const aDistSq = adx * adx + ady * ady;
        const aDist = Math.sqrt(aDistSq);
        if (aDist > GRAVITY_MIN_DIST && aDist < GRAVITY_MAX_DIST) {
          const force = GRAVITY_CONSTANT * body.mass / aDistSq;
          ai.vx += (adx / aDist) * force * dt;
          ai.vy += (ady / aDist) * force * dt;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WORMHOLES
     ══════════════════════════════════════════════════════════════════ */

  function checkWormholes(dt) {
    if (state !== STATE_PLAYING) return;
    const holes = raceWormholes;
    if (!holes || !holes.length) return;

    // Player wormhole cooldown
    if (wormholeCooldown > 0) wormholeCooldown -= dt;

    // Check player
    if (wormholeCooldown <= 0) {
      for (let i = 0; i < holes.length; ++i) {
        const wh = holes[i];
        const dx = wh.x - ship.x;
        const dy = wh.y - ship.y;
        if (dx * dx + dy * dy < WORMHOLE_RADIUS * WORMHOLE_RADIUS) {
          const dest = holes[wh.pairIndex];
          if (!dest) continue;

          // Particle burst at entry
          particles.burst(ship.x, ship.y, 20, {
            color: wh.color, speed: 4, life: 0.6, size: 3
          });

          // Teleport
          ship.x = dest.x + Math.cos(ship.angle) * (WORMHOLE_RADIUS + 5);
          ship.y = dest.y + Math.sin(ship.angle) * (WORMHOLE_RADIUS + 5);

          // Particle burst at exit
          particles.burst(ship.x, ship.y, 20, {
            color: dest.color, speed: 4, life: 0.6, size: 3
          });

          floatingText.add(ship.x, ship.y - 25, 'WARP!', {
            color: '#fff', font: 'bold 14px sans-serif'
          });

          screenShake.trigger(6, 250);
          SZ.GameAudio.play('zap', { pitch: 0.6 });
          wormholeCooldown = WORMHOLE_COOLDOWN;
          break;
        }
      }
    }

    // AI wormhole cooldowns
    for (let ai_i = 0; ai_i < opponents.length; ++ai_i) {
      if (aiWormholeCooldowns[ai_i] > 0)
        aiWormholeCooldowns[ai_i] -= dt;
    }

    // Check AI ships
    for (let ai_i = 0; ai_i < opponents.length; ++ai_i) {
      const ai = opponents[ai_i];
      if (ai.finished || aiWormholeCooldowns[ai_i] > 0) continue;

      for (let i = 0; i < holes.length; ++i) {
        const wh = holes[i];
        const dx = wh.x - ai.x;
        const dy = wh.y - ai.y;
        if (dx * dx + dy * dy < WORMHOLE_RADIUS * WORMHOLE_RADIUS) {
          const dest = holes[wh.pairIndex];
          if (!dest) continue;

          particles.burst(ai.x, ai.y, 10, {
            color: wh.color, speed: 3, life: 0.4, size: 2
          });

          ai.x = dest.x + Math.cos(ai.angle) * (WORMHOLE_RADIUS + 5);
          ai.y = dest.y + Math.sin(ai.angle) * (WORMHOLE_RADIUS + 5);

          particles.burst(ai.x, ai.y, 10, {
            color: dest.color, speed: 3, life: 0.4, size: 2
          });

          aiWormholeCooldowns[ai_i] = WORMHOLE_COOLDOWN;
          break;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     ITEM BOXES AND COMBAT ITEMS
     ══════════════════════════════════════════════════════════════════ */

  /* Boxes, items and their effects only live while a race is under way */
  function racingActive() {
    return state === STATE_PLAYING && !raceFinished;
  }

  /* Place of any racer: 1 plus the number of racers further along the track */
  function racerPlace(racer) {
    let place = 1;
    for (let i = 0; i < opponents.length; ++i) {
      const other = opponents[i];
      if (other !== racer && other.ts.dist > racer.ts.dist)
        ++place;
    }
    if (racer !== ship && ship.ts.dist > racer.ts.dist)
      ++place;
    return place;
  }

  /* The further back a racer sits, the more the roll favors weapons */
  function rollItem(place) {
    let total = 0;
    for (let i = 0; i < ITEM_NAMES.length; ++i) {
      const w = ITEM_WEIGHTS[ITEM_NAMES[i]];
      total += w[Math.min(w.length - 1, Math.max(0, place - 1))];
    }
    let roll = Math.random() * total;
    for (let i = 0; i < ITEM_NAMES.length; ++i) {
      const w = ITEM_WEIGHTS[ITEM_NAMES[i]];
      roll -= w[Math.min(w.length - 1, Math.max(0, place - 1))];
      if (roll < 0)
        return ITEM_NAMES[i];
    }
    return ITEM_NAMES[ITEM_NAMES.length - 1];
  }

  /* True if some other racer sits between gapFrom and gapTo track units away */
  function racerInGap(racer, gapFrom, gapTo) {
    for (let i = 0; i < opponents.length; ++i) {
      const other = opponents[i];
      if (other === racer) continue;
      const gap = other.ts.dist - racer.ts.dist;
      if (gap >= gapFrom && gap <= gapTo)
        return true;
    }
    if (racer === ship) return false;
    const gap = ship.ts.dist - racer.ts.dist;
    return gap >= gapFrom && gap <= gapTo;
  }

  /* Closest racer ahead along the track -- what a homing missile chases */
  function nearestAhead(racer) {
    let best = null, bestGap = Infinity;
    for (let i = 0; i < opponents.length; ++i) {
      const other = opponents[i];
      if (other === racer || other.finished) continue;
      const gap = other.ts.dist - racer.ts.dist;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    }
    if (racer !== ship) {
      const gap = ship.ts.dist - racer.ts.dist;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = ship;
      }
    }
    return best;
  }

  /* Grab: the player first, then the AI, one box per frame */
  function updateItemBoxes(dt) {
    const reachSq = ITEM_BOX_RADIUS * ITEM_BOX_RADIUS;
    for (let i = 0; i < raceItemBoxes.length; ++i) {
      const box = raceItemBoxes[i];
      if (box.respawn > 0) {
        box.respawn -= dt;
        continue;
      }
      const freeSlot = !playerItem || (treeLevel('a_rack') > 0 && !playerItem2);
      if (freeSlot && (box.x - ship.x) * (box.x - ship.x) + (box.y - ship.y) * (box.y - ship.y) < reachSq) {
        const item = rollItem(Math.min(4, playerPlace + treeLevel('a_luck')));
        if (!playerItem)
          playerItem = item;
        else
          playerItem2 = item;
        box.respawn = ITEM_BOX_RESPAWN;
        SZ.GameAudio.play('pickup');
        floatingText.add(ship.x, ship.y - 34, ITEM_LABELS[item], { color: '#ffd75a', font: 'bold 16px sans-serif' });
        continue;
      }
      for (let k = 0; k < opponents.length; ++k) {
        const ai = opponents[k];
        if (ai.finished || ai.item) continue;
        if ((box.x - ai.x) * (box.x - ai.x) + (box.y - ai.y) * (box.y - ai.y) >= reachSq) continue;
        ai.item = rollItem(racerPlace(ai));
        box.respawn = ITEM_BOX_RESPAWN;
        break;
      }
    }
  }

  /* AI drivers sit on a cooldown and then use what they carry when it pays off */
  function updateAIItems(dt) {
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      if (ai.finished) continue;
      ai.itemCooldown -= dt;
      if (ai.itemCooldown > 0 || !ai.item) continue;
      if (!aiWantsToUse(ai)) continue;
      useItem(ai, false);
      ai.item = null;
      ai.itemCooldown = 3 + Math.random() * 3;
    }
  }

  function aiWantsToUse(ai) {
    if (ai.item === 'shield')
      return true;
    if (ai.item === 'turbo') {
      // only spend the boost where the road runs straight
      let bend = geo.sampleAt(ai.ts.s + 400).angle - geo.sampleAt(ai.ts.s).angle;
      while (bend > Math.PI) bend -= TWO_PI;
      while (bend < -Math.PI) bend += TWO_PI;
      return Math.abs(bend) < 0.3;
    }
    if (ai.item === 'missile')
      return racerInGap(ai, 1, 700);
    if (ai.item === 'mine')
      return racerInGap(ai, -300, -1);
    if (ai.item === 'emp') {
      const r2 = EMP_RADIUS * EMP_RADIUS;
      if (ai !== ship && (ship.x - ai.x) * (ship.x - ai.x) + (ship.y - ai.y) * (ship.y - ai.y) < r2)
        return true;
      for (let k = 0; k < opponents.length; ++k) {
        const other = opponents[k];
        if (other === ai) continue;
        if ((other.x - ai.x) * (other.x - ai.x) + (other.y - ai.y) * (other.y - ai.y) < r2)
          return true;
      }
    }
    return false;
  }

  function usePlayerItem() {
    if (!racingActive()) return;
    if (!playerItem && playerItem2) {
      playerItem = playerItem2;
      playerItem2 = null;
    }
    if (!playerItem) return;
    useItem(ship, true);
    playerItem = playerItem2;   // the second slot shifts up into the first
    playerItem2 = null;
  }

  function useItem(racer, isPlayer) {
    const item = isPlayer ? playerItem : racer.item;
    if (!item) return;

    if (item === 'turbo') {
      if (isPlayer) {
        boostActive = true;
        boostTimer = 1.2;
        SZ.GameAudio.play('powerup');
      } else {
        racer.turbo = 1.2;
      }
      return;
    }

    if (item === 'shield') {
      racer.shieldTime = SHIELD_TIME + (isPlayer ? 3 * treeLevel('u_shield') : 0);
      SZ.GameAudio.play('zap');
      return;
    }

    if (item === 'mine') {
      const mx = racer.x - Math.cos(racer.angle) * 40;
      const my = racer.y - Math.sin(racer.angle) * 40;
      mines.push({ x: mx, y: my, owner: racer, armed: MINE_ARM_TIME, life: MINE_LIFE });
      if (isPlayer && treeLevel('a_twin') > 0) {
        const perp = racer.angle + Math.PI / 2;
        mines.push({
          x: mx + Math.cos(perp) * 40,
          y: my + Math.sin(perp) * 40,
          owner: racer,
          armed: MINE_ARM_TIME,
          life: MINE_LIFE
        });
      }
      SZ.GameAudio.play('drop');
      return;
    }

    if (item === 'missile') {
      projectiles.push({
        x: racer.x + Math.cos(racer.angle) * 40,
        y: racer.y + Math.sin(racer.angle) * 40,
        angle: racer.angle,
        speed: MISSILE_SPEED,
        turn: MISSILE_TURN * (isPlayer ? 1 + 0.4 * treeLevel('a_homing') : 1),
        target: nearestAhead(racer),
        owner: racer,
        life: MISSILE_LIFE
      });
      SZ.GameAudio.play('shoot');
      return;
    }

    if (item === 'emp') {
      const radius = isPlayer ? EMP_RADIUS + 100 * treeLevel('a_emp') : EMP_RADIUS;
      const r2 = radius * radius;
      if (racer !== ship && (ship.x - racer.x) * (ship.x - racer.x) + (ship.y - racer.y) * (ship.y - racer.y) < r2)
        hit(ship, 'emp', racer);
      for (let i = 0; i < opponents.length; ++i) {
        const other = opponents[i];
        if (other === racer || other.finished) continue;
        if ((other.x - racer.x) * (other.x - racer.x) + (other.y - racer.y) * (other.y - racer.y) < r2)
          hit(other, 'emp', racer);
      }
      shockwaves.push({ x: racer.x, y: racer.y, r: 0, life: 0.5, radius: radius });
      SZ.GameAudio.play('zap', { pitch: 0.6 });
    }
  }

  /* A hit spins the ship out -- unless the shield eats it first */
  function hit(racer, kind, attacker) {
    if (racer.shieldTime > 0) {
      racer.shieldTime = 0;
      particles.burst(racer.x, racer.y, 14, { color: '#8ad8ff', speed: 3, life: 0.4 });
      if (racer === ship)
        SZ.GameAudio.play('bounce');
      return;
    }

    racer.spin = (kind === 'emp' ? 1.2 : 1.0) * (racer === ship ? 1 - 0.15 * treeLevel('u_armor') : 1);
    racer.vx *= 0.35;
    racer.vy *= 0.35;
    if (kind === 'emp') {
      particles.burst(racer.x, racer.y, 18, { color: '#8ad8ff', speed: 4, life: 0.5 });
    } else {
      particles.burst(racer.x, racer.y, 16, { color: '#ff8a3a', speed: 4.5, life: 0.6 });
      particles.burst(racer.x, racer.y, 8, { color: '#ffd75a', speed: 3, life: 0.45 });
    }

    if (racer === ship) {
      screenShake.trigger(10, 350);
      SZ.GameAudio.play('explode');
      floatingText.add(ship.x, ship.y - 34, 'HIT!', { color: '#ff4a4a', font: 'bold 20px sans-serif' });
    } else if (attacker === ship) {
      ++bonusHitsLanded;
      floatingText.add(ship.x, ship.y - 34, 'GOT ONE!', { color: '#ffd75a', font: 'bold 18px sans-serif' });
    }
  }

  /* Missiles home in on their quarry with a fixed turn rate */
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; --i) {
      const p = projectiles[i];
      p.life -= dt;
      if (p.target) {
        let want = Math.atan2(p.target.y - p.y, p.target.x - p.x) - p.angle;
        while (want > Math.PI) want -= TWO_PI;
        while (want < -Math.PI) want += TWO_PI;
        const turn = p.turn || MISSILE_TURN;
        p.angle += Math.max(-turn * dt, Math.min(turn * dt, want));
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      particles.trail(p.x, p.y, { color: '#ff8a3a', life: 0.25, size: 2, decay: 0.05 });

      if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        if (dx * dx + dy * dy < MISSILE_HIT * MISSILE_HIT) {
          hit(p.target, 'missile', p.owner);
          projectiles.splice(i, 1);
          continue;
        }
      }
      if (p.life <= 0) {
        particles.burst(p.x, p.y, 10, { color: '#ff8a3a', speed: 3, life: 0.4 });
        SZ.GameAudio.play('smallExplode', { volume: 0.5 });
        projectiles.splice(i, 1);
      }
    }
  }

  /* Mines arm themselves, then take out whoever runs into them */
  function updateMines(dt) {
    const reachSq = MINE_RADIUS * MINE_RADIUS;
    for (let i = mines.length - 1; i >= 0; --i) {
      const m = mines[i];
      m.life -= dt;
      if (m.armed > 0) {
        m.armed -= dt;
        continue;
      }
      let gone = false;
      if ((m.x - ship.x) * (m.x - ship.x) + (m.y - ship.y) * (m.y - ship.y) < reachSq) {
        hit(ship, 'mine', m.owner);
        gone = true;
      }
      if (!gone) {
        for (let k = 0; k < opponents.length; ++k) {
          const ai = opponents[k];
          if (ai.finished) continue;
          if ((m.x - ai.x) * (m.x - ai.x) + (m.y - ai.y) * (m.y - ai.y) >= reachSq) continue;
          hit(ai, 'mine', m.owner);
          gone = true;
          break;
        }
      }
      if (gone || m.life <= 0)
        mines.splice(i, 1);
    }
  }

  function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; --i) {
      const w = shockwaves[i];
      w.life -= dt;
      w.r = (w.radius || EMP_RADIUS) * (1 - Math.max(0, w.life) / 0.5);
      if (w.life <= 0)
        shockwaves.splice(i, 1);
    }
  }

  function updateItems(dt) {
    if (!racingActive()) return;
    if (ship.shieldTime > 0)
      ship.shieldTime -= dt;
    for (let i = 0; i < opponents.length; ++i) {
      if (opponents[i].shieldTime > 0)
        opponents[i].shieldTime -= dt;
    }
    updateItemBoxes(dt);
    updateAIItems(dt);
    updateProjectiles(dt);
    updateMines(dt);
    updateShockwaves(dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     THRUST & SPEED TRAIL PARTICLES
     ══════════════════════════════════════════════════════════════════ */

  function emitThrustParticles() {
    if (state !== STATE_PLAYING) return;

    const isThrusting = keys['ArrowUp'] || keys['KeyW'];
    const pd = getPlayerShipDef();

    // Thrust exhaust particles when accelerating
    if (isThrusting) {
      const ex = ship.x - Math.cos(ship.angle) * 12;
      const ey = ship.y - Math.sin(ship.angle) * 12;
      const spread = 0.4;
      const baseAngle = ship.angle + Math.PI;
      for (let i = 0; i < 2; ++i) {
        const a = baseAngle + (Math.random() - 0.5) * spread;
        const spd = 1.5 + Math.random() * 2;
        particles.trail(ex + (Math.random() - 0.5) * 4, ey + (Math.random() - 0.5) * 4, {
          vx: Math.cos(a) * spd,
          vy: Math.sin(a) * spd,
          color: pd.exhaustColor || '#f80',
          life: 0.25 + Math.random() * 0.15,
          size: 1.5 + Math.random() * 1.5,
          decay: 0.04,
          shrink: 0.94
        });
      }
    }

    // Speed trail sparkles at high speed
    const speedRatio = ship.speed / BASE_MAX_SPEED;
    if (speedRatio > 0.6) {
      const trailRate = (speedRatio - 0.6) * 5;
      if (Math.random() < trailRate * 0.3) {
        const side = (Math.random() > 0.5 ? 1 : -1);
        const perpAngle = ship.angle + Math.PI / 2 * side;
        const ox = Math.cos(perpAngle) * (3 + Math.random() * 5);
        const oy = Math.sin(perpAngle) * (3 + Math.random() * 5);
        particles.trail(ship.x + ox - Math.cos(ship.angle) * 8, ship.y + oy - Math.sin(ship.angle) * 8, {
          vx: -ship.vx * 0.01,
          vy: -ship.vy * 0.01,
          color: boostActive ? '#0ff' : '#aaf',
          life: 0.15 + Math.random() * 0.1,
          size: 0.8 + Math.random(),
          decay: 0.05,
          shrink: 0.92
        });
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SPEED STREAKS -- screen-space lines spawning near the edges and
     flying away from the view center while the ship is quick
     ══════════════════════════════════════════════════════════════════ */

  function updateSpeedLines(dt) {
    if (state === STATE_PLAYING) {
      const maxSpeed = BASE_MAX_SPEED * (ship.stats ? ship.stats.speed : 1);
      if (ship.speed > 0.7 * maxSpeed || boostActive) {
        const count = 1 + Math.floor((ship.speed / maxSpeed) * 3);
        for (let i = 0; i < count && speedLines.length < 60; ++i) {
          const side = Math.floor(Math.random() * 4);
          let x, y;
          if (side === 0) { x = Math.random() * CANVAS_W; y = 6 + Math.random() * 40; }
          else if (side === 1) { x = CANVAS_W - 6 - Math.random() * 40; y = Math.random() * CANVAS_H; }
          else if (side === 2) { x = Math.random() * CANVAS_W; y = CANVAS_H - 6 - Math.random() * 40; }
          else { x = 6 + Math.random() * 40; y = Math.random() * CANVAS_H; }
          let dx = x - CANVAS_W / 2, dy = y - CANVAS_H / 2;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          speedLines.push({ x: x, y: y, dx: dx / d, dy: dy / d, len: 40 + Math.random() * 80, life: 0.5 });
        }
      }
    }

    const step = (ship.speed / 10) * frameScale(dt);
    for (let i = speedLines.length - 1; i >= 0; --i) {
      const sl = speedLines[i];
      sl.x += sl.dx * step;
      sl.y += sl.dy * step;
      sl.life -= dt;
      if (sl.life <= 0 || sl.x < -140 || sl.x > CANVAS_W + 140 || sl.y < -140 || sl.y > CANVAS_H + 140)
        speedLines.splice(i, 1);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     EXHAUST TRAILS -- the last 18 positions of every racer, drawn as
     a glowing ribbon that thickens toward the ship
     ══════════════════════════════════════════════════════════════════ */

  function updateTrails() {
    if (state !== STATE_PLAYING || !raceStarted) return;
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      ai.trail.push({ x: ai.x, y: ai.y });
      if (ai.trail.length > 18) ai.trail.shift();
    }
    ship.trail.push({ x: ship.x, y: ship.y });
    if (ship.trail.length > 18) ship.trail.shift();
  }

  function drawTrail(trail, color, boosting) {
    if (!trail || trail.length < 2) return;
    ctx.strokeStyle = color;
    for (let i = 1; i < trail.length; ++i) {
      const dx = trail[i].x - trail[i - 1].x, dy = trail[i].y - trail[i - 1].y;
      if (dx * dx + dy * dy > 120 * 120) continue;   // wormhole jump -- no chord across the map
      const t = i / trail.length;
      ctx.lineWidth = (2 + 6 * t) * (boosting ? 2 : 1);
      ctx.globalAlpha = 0.5 * t;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTrails() {
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    drawTrail(ship.trail, (ship.def && ship.def.exhaustColor) || '#f80', boostActive);
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      drawTrail(ai.trail, ai.exhaustColor, ai.turbo > 0);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ══════════════════════════════════════════════════════════════════
     DRIFT SKID MARKS -- segments between the rear wheel corners of
     consecutive frames, fading out over six seconds
     ══════════════════════════════════════════════════════════════════ */

  function updateSkids(dt) {
    if (drifting && state === STATE_PLAYING) {
      const fx = Math.cos(ship.angle), fy = Math.sin(ship.angle);
      const sx = -Math.sin(ship.angle), sy = Math.cos(ship.angle);
      const color = driftTime >= DRIFT_TIER2 ? '#ffaa3a' : driftTime >= DRIFT_TIER1 ? '#5ab8ff' : '#9ad8ff';
      const lx = ship.x - fx * 14 + sx * 9, ly = ship.y - fy * 14 + sy * 9;
      const rx = ship.x - fx * 14 - sx * 9, ry = ship.y - fy * 14 - sy * 9;
      if (skidPrev) {
        const jx = lx - skidPrev.lx, jy = ly - skidPrev.ly;
        if (jx * jx + jy * jy <= 120 * 120) {   // skip wormhole jumps
          skids.push({ x1: skidPrev.lx, y1: skidPrev.ly, x2: lx, y2: ly, life: 6, color: color });
          skids.push({ x1: skidPrev.rx, y1: skidPrev.ry, x2: rx, y2: ry, life: 6, color: color });
          while (skids.length > 600) skids.shift();
        }
      }
      skidPrev = { lx: lx, ly: ly, rx: rx, ry: ry };
    } else {
      skidPrev = null;
    }
    for (let i = skids.length - 1; i >= 0; --i) {
      skids[i].life -= dt;
      if (skids[i].life <= 0)
        skids.splice(i, 1);
    }
  }

  function drawSkids() {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < skids.length; ++i) {
      const s = skids[i];
      ctx.globalAlpha = Math.min(1, s.life / 2) * 0.5;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     THEMED AMBIENCE -- distant particles per track theme, drifting
     with a small parallax against the camera
     ══════════════════════════════════════════════════════════════════ */

  const AMBIENCE_MAX = 40;

  function resetAmbience() {
    ambient = [];
    stormTimer = 3 + Math.random() * 3;
    stormFlash = 0;
    stormBolt = null;
    pulsarTimer = 0;
    pulsarRings = [];
    const theme = track.theme;
    for (let i = 0; i < AMBIENCE_MAX; ++i) {
      if (theme === 'solar') {
        ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: (Math.random() - 0.5) * 10, vy: -(12 + Math.random() * 20), size: 2 + Math.random(), phase: Math.random() * TWO_PI, color: '#ff8a3a' });
      } else if (theme === 'comet') {
        ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: 26 + Math.random() * 22, vy: 16 + Math.random() * 14, size: 1 + Math.random() * 1.5, phase: Math.random() * TWO_PI, color: '#bfe4ff' });
      } else if (theme === 'void') {
        ambient.push({ ax: Math.random() * CANVAS_W, ay: Math.random() * CANVAS_H, r: 10 + Math.random() * 30, a: Math.random() * TWO_PI, w: (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.4), size: 1.5 + Math.random(), phase: Math.random() * TWO_PI, color: '#6affc0' });
      } else if (theme === 'nebula' || theme === 'quasar') {
        const cloud = theme === 'quasar' ? ['#ff4cd8', '#a64cff', '#ff9af0'] : ['#6a3cff', '#c04cff', '#2a5cff'];
        ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, size: 1 + Math.random() * 2, phase: Math.random() * TWO_PI, color: cloud[i % cloud.length] });
      } else if (theme === 'asteroid') {
        ambient.push({ x: Math.random() * CANVAS_W, y: Math.random() * CANVAS_H, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 10, size: 3 + Math.random() * 3, phase: Math.random() * TWO_PI, color: '#5a3a22' });
      }
    }
  }

  function updateAmbient(dt) {
    const theme = track ? track.theme : null;
    if (theme === 'storm') {
      stormTimer -= dt;
      if (stormTimer <= 0) {
        stormTimer = 3 + Math.random() * 3;
        stormFlash = 0.12;
        let x = Math.random() * CANVAS_W;
        const pts = [{ x: x, y: 0 }];
        for (let y = 40; y < CANVAS_H * 0.55; y += 40) {
          x += (Math.random() - 0.5) * 70;
          pts.push({ x: x, y: y });
        }
        stormBolt = { pts: pts, life: 0.1 };
      }
      if (stormFlash > 0)
        stormFlash = Math.max(0, stormFlash - dt * (0.12 / 0.2));
      if (stormBolt) {
        stormBolt.life -= dt;
        if (stormBolt.life <= 0) stormBolt = null;
      }
    } else if (theme === 'pulsar') {
      pulsarTimer -= dt;
      if (pulsarTimer <= 0) {
        pulsarTimer = 1.5;
        pulsarRings.push({ r: 6, life: 1 });
        if (pulsarRings.length > 4) pulsarRings.shift();
      }
      for (let i = pulsarRings.length - 1; i >= 0; --i) {
        pulsarRings[i].r += 90 * dt;
        pulsarRings[i].life -= dt / 1.6;
        if (pulsarRings[i].life <= 0) pulsarRings.splice(i, 1);
      }
    }
    for (let i = 0; i < ambient.length; ++i) {
      const p = ambient[i];
      if (theme === 'void') {
        p.a += p.w * dt;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  function drawAmbient() {
    if (!track) return;
    const theme = track.theme;
    const pz = theme === 'asteroid' ? 0.2 : 0.05;
    for (let i = 0; i < ambient.length; ++i) {
      const p = ambient[i];
      let x = p.x, y = p.y;
      if (theme === 'void') {
        x = p.ax + Math.cos(p.a) * p.r;
        y = p.ay + Math.sin(p.a) * p.r;
      }
      x = (((x - camX * pz) % CANVAS_W) + CANVAS_W) % CANVAS_W;
      y = (((y - camY * pz) % CANVAS_H) + CANVAS_H) % CANVAS_H;
      let alpha = 0.4;
      if (theme === 'solar') alpha = 0.35 + 0.3 * Math.sin(globalTime * 5 + p.phase);
      else if (theme === 'comet') alpha = 0.35;
      else if (theme === 'nebula' || theme === 'quasar') alpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(globalTime * 2.5 + p.phase));
      else if (theme === 'asteroid') alpha = 0.7;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, TWO_PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (theme === 'storm') {
      if (stormFlash > 0) {
        ctx.globalAlpha = stormFlash;
        ctx.fillStyle = '#bff6ff';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
      if (stormBolt) {
        ctx.globalAlpha = Math.min(1, stormBolt.life / 0.1) * 0.8;
        ctx.strokeStyle = '#e8fbff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < stormBolt.pts.length; ++k) {
          const pt = stormBolt.pts[k];
          if (k === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (theme === 'pulsar') {
      ctx.strokeStyle = '#bfe6ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < pulsarRings.length; ++i) {
        const ring = pulsarRings[i];
        ctx.globalAlpha = 0.25 * Math.max(0, ring.life);
        ctx.beginPath();
        ctx.arc(CANVAS_W * 0.82, CANVAS_H * 0.3, ring.r, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LAP FLASHES
     ══════════════════════════════════════════════════════════════════ */

  function updateFlashes(dt) {
    if (lapFlash) {
      lapFlash.alpha -= lapFlash.rate * dt;
      if (lapFlash.alpha <= 0) lapFlash = null;
    }
    if (finalFlash) {
      finalFlash.alpha -= finalFlash.rate * dt;
      if (finalFlash.alpha <= 0) finalFlash = null;
    }
  }

  function drawFlashes() {
    if (lapFlash) {
      ctx.globalAlpha = Math.max(0, lapFlash.alpha);
      ctx.fillStyle = lapFlash.color;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (finalFlash) {
      ctx.globalAlpha = Math.max(0, finalFlash.alpha);
      ctx.fillStyle = finalFlash.color;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.globalAlpha = 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     CAMERA
     ══════════════════════════════════════════════════════════════════ */

  function updateCamera(dt) {
    const look = 0.35;
    const targetX = ship.x + ship.vx * look;
    const targetY = ship.y + ship.vy * look;
    const follow = frameRate(0.1, dt);
    camX += (targetX - camX) * follow;
    camY += (targetY - camY) * follow;
    const maxSpeed = BASE_MAX_SPEED * (ship.stats ? ship.stats.speed : 1);
    const zoomTarget = 1 - Math.min(0.25, (ship.speed / maxSpeed) * 0.25) - (boostActive ? 0.08 : 0);
    camZoom += (zoomTarget - camZoom) * frameRate(0.05, dt);
    if (boostActive && !prevBoostActive)
      screenShake.trigger(3, 120);
    prevBoostActive = boostActive;
  }

  function applyWorldTransform() {
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camX, -camY);
  }

  function worldToScreen(x, y) {
    return { x: (x - camX) * camZoom + CANVAS_W / 2, y: (y - camY) * camZoom + CANVAS_H / 2 };
  }

  /* True when a world point with radius r can be visible this frame */
  function inView(x, y, r) {
    const hw = CANVAS_W / 2 / camZoom + r;
    const hh = CANVAS_H / 2 / camZoom + r;
    return Math.abs(x - camX) < hw && Math.abs(y - camY) < hh;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  /* The player's own racing noise: an engine hum that follows the speed, a
     drift hiss and a barrier scrape. Each source runs on its own refresh
     timer, never faster than every 0.06 s, and the whole layer is silent
     outside the started race. */
  function updateRaceAudio(dt) {
    if (!raceStarted || raceFinished) return;

    engineTick += dt;
    if (engineTick >= 0.09) {
      engineTick = 0;
      ++engineBeat;
      const freq = 55 + ship.speed * 0.22 + (boostActive ? 40 : 0);
      const vol = 0.025 + 0.035 * Math.min(1, ship.speed / 500);
      SZ.GameAudio.tone(freq, 0.12, 'sawtooth', vol);
      if (engineBeat % 2 === 0)
        SZ.GameAudio.tone(freq / 2, 0.12, 'sine', vol * 0.8);
    }

    if (drifting) {
      driftTick += dt;
      if (driftTick >= 0.12) {
        driftTick = 0;
        SZ.GameAudio.noise(0.12, 0.03, 'bandpass', 1800, 1200);
      }
    } else
      driftTick = 0;

    if (ship.ts.off > geo.width / 2) {
      scrapeTick += dt;
      if (scrapeTick >= 0.18) {
        scrapeTick = 0;
        SZ.GameAudio.noise(0.1, 0.04, 'lowpass', 700, 300);
      }
    } else
      scrapeTick = 0;
  }

  function updateGame(dt) {
    globalTime += dt;
    if (state === STATE_RESULTS) {
      resultsTime += dt;
      updateConfetti(dt);
      const tick = Math.floor(resultsTime / 0.1);
      if (resultsTime < 1.2 && tick > coinTick) {
        coinTick = tick;
        SZ.GameAudio.play('coin', { volume: 0.3 });
      }
    } else if (state === STATE_STANDINGS) {
      standingsTime += dt;
    }
    if (state === STATE_PAUSED || state === STATE_TREE || isMenuState(state)) return;

    updateRaceStart(dt);
    updateShip(dt);
    updateSlipstream(dt);
    updateAI(dt);
    applyGravity(dt);
    checkBoostPads();
    checkHazards();
    checkWormholes(dt);
    updateItems(dt);
    emitThrustParticles();
    updateRace(dt);
    updateRaceAudio(dt);
    updateCamera(dt);
    updateSpeedLines(dt);
    updateSkids(dt);
    updateTrails();
    updateAmbient(dt);
    updateFlashes(dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- TRACK & GAME
     ══════════════════════════════════════════════════════════════════ */

  function drawBackground() {
    if (trackArt)
      drawFullBackground(camX, camY, camZoom);
    else {
      ctx.fillStyle = '#0b0d1c';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function drawTrack() {
    if (trackArt)
      trackArt.drawRoad(ctx, globalTime);
  }

  function drawBoostPads() {
    for (let i = 0; i < raceBoostPads.length; ++i) {
      const pad = raceBoostPads[i];
      if (!inView(pad.x, pad.y, 40)) continue;
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.rotate(pad.angle);
      ctx.fillStyle = 'rgba(0,255,255,0.22)';
      ctx.fillRect(-20, -9, 40, 18);
      ctx.fillStyle = '#0ff';
      ctx.fillRect(-15, -5, 30, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('>>>', 0, 0);
      ctx.restore();
    }
  }

  function drawHazards() {
    for (let i = 0; i < raceHazards.length; ++i) {
      const h = raceHazards[i];
      if (!inView(h.x, h.y, h.radius + 40)) continue;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, TWO_PI);
      if (h.type === 'barrier') {
        ctx.fillStyle = '#f22';
      } else {
        ctx.fillStyle = '#665';
      }
      ctx.fill();

      if (h.type === 'asteroid') {
        ctx.fillStyle = '#887';
        ctx.beginPath();
        ctx.arc(h.x - 3, h.y - 2, h.radius * 0.3, 0, TWO_PI);
        ctx.fill();
      }
    }
  }

  function drawGravityBodies() {
    const bodies = raceGravity;
    if (!bodies || !bodies.length) return;

    for (let b = 0; b < bodies.length; ++b) {
      const body = bodies[b];
      if (!inView(body.x, body.y, (body.radius || 60) * 5)) continue;
      ctx.save();

      if (body.type === 'blackhole') {
        // Black hole: dark center with swirling accretion disc
        const pulse = 1 + 0.1 * Math.sin(globalTime * 3);
        // Accretion disc glow
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.3, body.x, body.y, body.radius * 3 * pulse);
        grad.addColorStop(0, 'rgba(80,0,120,0.5)');
        grad.addColorStop(0.4, 'rgba(120,40,180,0.2)');
        grad.addColorStop(1, 'rgba(60,0,100,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 3 * pulse, 0, TWO_PI);
        ctx.fill();

        // Swirl ring
        ctx.strokeStyle = 'rgba(180,100,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(body.x, body.y, body.radius * 2.2 * pulse, body.radius * 1.2 * pulse, globalTime * 0.5, 0, TWO_PI);
        ctx.stroke();

        // Dark center
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, TWO_PI);
        ctx.fill();
      } else if (body.type === 'star') {
        // Star: bright glowing center with pulsating corona
        const pulse = 1 + 0.15 * Math.sin(globalTime * 2.5);
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.2, body.x, body.y, body.radius * 3 * pulse);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, body.color);
        grad.addColorStop(0.6, body.color.slice(0, 4) + '8');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 3 * pulse, 0, TWO_PI);
        ctx.fill();

        // Bright core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 0.6, 0, TWO_PI);
        ctx.fill();
      } else {
        // Planet: solid with atmosphere glow
        const pulse = 1 + 0.05 * Math.sin(globalTime * 1.5);
        // Atmosphere
        const grad = ctx.createRadialGradient(body.x, body.y, body.radius * 0.8, body.x, body.y, body.radius * 2 * pulse);
        grad.addColorStop(0, _hexAlpha(body.color, '60'));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius * 2 * pulse, 0, TWO_PI);
        ctx.fill();

        // Planet body
        ctx.fillStyle = body.color;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, TWO_PI);
        ctx.fill();

        // Light highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(body.x - body.radius * 0.3, body.y - body.radius * 0.3, body.radius * 0.4, 0, TWO_PI);
        ctx.fill();
      }

      // Gravity range indicator (subtle dashed circle)
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(body.x, body.y, GRAVITY_MAX_DIST, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  function drawWormholes() {
    const holes = raceWormholes;
    if (!holes || !holes.length) return;

    for (let i = 0; i < holes.length; ++i) {
      const wh = holes[i];
      if (!inView(wh.x, wh.y, 140)) continue;
      ctx.save();

      // Swirling outer ring
      const time = globalTime * 2;
      for (let ring = 3; ring >= 0; --ring) {
        const r = WORMHOLE_RADIUS + ring * 4;
        const alpha = 0.15 - ring * 0.03;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = wh.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wh.x, wh.y, r, time + ring * 0.5, time + ring * 0.5 + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Swirling gradient center
      const pulse = 1 + 0.12 * Math.sin(globalTime * 3 + i * Math.PI);
      const grad = ctx.createRadialGradient(wh.x, wh.y, 0, wh.x, wh.y, WORMHOLE_RADIUS * pulse);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.2, wh.color);
      grad.addColorStop(0.7, _hexAlpha(wh.color, '40'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, WORMHOLE_RADIUS * pulse, 0, TWO_PI);
      ctx.fill();

      // Inner swirl lines
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      for (let arm = 0; arm < 3; ++arm) {
        const baseAngle = time + arm * (TWO_PI / 3);
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.05) {
          const spiralR = t * WORMHOLE_RADIUS * 0.8;
          const spiralA = baseAngle + t * 4;
          const sx = wh.x + Math.cos(spiralA) * spiralR;
          const sy = wh.y + Math.sin(spiralA) * spiralR;
          if (t === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Center glow dot
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, 3, 0, TWO_PI);
      ctx.fill();

      ctx.restore();
    }
  }

  /* Rounded rectangle path, used by the item boxes and the HUD item slot */
  function pathRoundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawItemBoxes() {
    for (let i = 0; i < raceItemBoxes.length; ++i) {
      const box = raceItemBoxes[i];
      if (!inView(box.x, box.y, 40)) continue;
      if (box.respawn > 0) continue;
      const bob = 3 * Math.sin(globalTime * 3 + i);
      ctx.save();
      ctx.translate(box.x, box.y + bob);

      // soft halo
      ctx.fillStyle = 'rgba(255,215,90,0.18)';
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, TWO_PI);
      ctx.fill();

      // the turning box
      ctx.save();
      ctx.rotate(globalTime * 1.5);
      const grad = ctx.createLinearGradient(0, -13, 0, 13);
      grad.addColorStop(0, '#ffd75a');
      grad.addColorStop(1, '#ff8a3a');
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = grad;
      pathRoundRect(-13, -13, 26, 26, 6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // the question mark stays upright
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 0);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }

  function drawMissiles() {
    for (let i = 0; i < projectiles.length; ++i) {
      const p = projectiles[i];
      ctx.fillStyle = 'rgba(255,138,58,0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, TWO_PI);
      ctx.fill();
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#f2f5fa';
      ctx.fillRect(-8, -2.5, 16, 5);
      ctx.fillStyle = '#f44';
      ctx.beginPath();
      ctx.moveTo(8, -2.5);
      ctx.lineTo(13, 0);
      ctx.lineTo(8, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMines() {
    for (let i = 0; i < mines.length; ++i) {
      const m = mines[i];
      if (!inView(m.x, m.y, 40)) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.strokeStyle = '#7a8296';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; ++k) {
        const a = k * (Math.PI / 2) + Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#232838';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TWO_PI);
      ctx.fill();
      const blink = m.armed > 0 ? 1 : 0.5 + 0.5 * Math.sin(globalTime * 10);
      ctx.fillStyle = `rgba(255,70,70,${(0.3 + 0.7 * blink).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawShockwaves() {
    for (let i = 0; i < shockwaves.length; ++i) {
      const w = shockwaves[i];
      ctx.strokeStyle = `rgba(138,216,255,${(Math.max(0, w.life / 0.5) * 0.8).toFixed(3)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TWO_PI);
      ctx.stroke();
    }
  }

  function drawShip(x, y, angle, color, accentColor, exhaustColor, shape, isPlayer, isThrusting, bank, shield) {
    SZ.RacingShipArt.drawShip(ctx, {
      x: x,
      y: y,
      angle: angle,
      shape: shape,
      color: color,
      accent: accentColor,
      exhaust: exhaustColor || '#f80',
      bank: bank || 0,
      thrust: isThrusting ? 1 : 0.15,
      boost: isPlayer && boostActive,
      scale: 1,
      time: globalTime,
      shield: !!shield
    });
  }

  function drawSpeedLines() {
    if (!speedLines.length) return;
    ctx.lineWidth = 2;
    ctx.strokeStyle = boostActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)';
    for (let i = 0; i < speedLines.length; ++i) {
      const sl = speedLines[i];
      ctx.beginPath();
      ctx.moveTo(sl.x, sl.y);
      ctx.lineTo(sl.x - sl.dx * sl.len, sl.y - sl.dy * sl.len);
      ctx.stroke();
    }
  }

  /* ── A HUD panel sinks back when the player's ship sits on top of it ── */
  function hudAlpha(x, y, w, h) {
    const p = worldToScreen(ship.x, ship.y);
    return (p.x > x - 30 && p.x < x + w + 30 && p.y > y - 30 && p.y < y + h + 30) ? 0.3 : 1;
  }

  function hudFadeAlpha(name, x, y, w, h) {
    const target = hudAlpha(x, y, w, h);
    const prev = hudFade[name];
    const a = prev === undefined ? target : prev + (target - prev) * 0.15;
    hudFade[name] = a;
    return a;
  }

  function drawHUD() {
    if (state === STATE_PLAYING) {
      drawPlacePanel();
      drawLapPanel();
      drawLapSplitPopup();
      drawSpeedometer();
      drawBoostPanel();
      drawMinimap();
      drawStandings();
      drawItemSlot();
    }

    // Countdown to the start
    if (state === STATE_PLAYING && !raceStarted && countdown > 0)
      ui.drawHeadline(String(Math.ceil(countdown)), CANVAS_W / 2, 180, 120, 56, ui.UI.gold);

    // Wrong-way warning banner
    if (wrongWay) {
      const bx = CANVAS_W / 2 - 140, by = 120, bw = 280, bh = 44;
      ui.drawPanel(bx, by, bw, bh, { accent: '#ff6a6a', noStuds: true });
      ui.drawHeadline('WRONG WAY', CANVAS_W / 2, by + bh / 2, bw - 40, 24, '#ff6a6a');
    }

  }

  /* Big ordinal place, with a +1/-1 chip for the last position change */
  function drawPlacePanel() {
    const x = 20, y = 18, w = 180, h = 104;
    const a = hudFadeAlpha('place', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a });
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const num = String(playerPlace);
    const suffix = getOrdinal(playerPlace).slice(num.length);
    const nw = ui.fitText(num, x + 16, y + 76, 96, 64, { weight: 'bold', color: '#ffffff' });
    ui.fitText(suffix, x + 16 + nw + 3, y + 76, 44, 24, { weight: 'bold', color: ui.UI.textDim });
    ui.fitText(`of ${opponents.length + 1}`, x + 16, y + 98, w - 32, 16, { color: ui.UI.textDim });
    if (placeDelta !== 0 && raceTime - placeDeltaAt < 1.2) {
      const gained = placeDelta > 0;
      const col = gained ? ui.UI.good : ui.UI.bad;
      ui.drawChip(gained ? '+1' : '-1', x + w + 8, y + 16, 22, {
        px: 13, color: col, bg: ui.hexToRgba(col, 0.16), border: ui.hexToRgba(col, 0.6)
      });
    }
    ctx.restore();
  }

  /* Lap counter, race clock and the best lap, plus the lap-split popup */
  function drawLapPanel() {
    const x = 212, y = 18, w = 240, h = 104;
    const a = hudFadeAlpha('lap', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a });
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ui.fitText('LAP', x + 16, y + 30, 60, 14, { color: ui.UI.textDim });
    ui.fitText(`${Math.min(raceLaps, playerLap + 1)} / ${raceLaps}`, x + 16, y + 64, w - 32, 34, { weight: 'bold', color: ui.UI.text });
    ui.fitText(formatTime(raceTime), x + 16, y + 94, 110, 20, { weight: 'bold', color: ui.UI.text });
    const best = save.bestLaps[currentVariant.key] !== undefined ? save.bestLaps[currentVariant.key] : raceBestLap;
    ctx.textAlign = 'right';
    ui.fitText('BEST ' + (best > 0 ? formatTime(best) : '--'), x + w - 16, y + 94, 150, 14, { color: ui.UI.textDim });
    ctx.restore();
  }

  function drawLapSplitPopup() {
    if (lapSplitAt < 0) return;
    const age = raceTime - lapSplitAt;
    if (age > 2.5) return;
    const a = Math.min(1, age / 0.25, (2.5 - age) / 0.25);
    if (a <= 0) return;
    const x = CANVAS_W / 2 - 170, y = 140, w = 340, h = 64;
    ui.drawPanel(x, y, w, h, { alpha: a, accent: lapSplitBest ? ui.UI.gold : ui.UI.accent });
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ui.fitText(`LAP ${lapSplitNumber}   ${formatTime(lapSplitTime)}`, CANVAS_W / 2, y + 34, w - 24, 22, { weight: 'bold', color: ui.UI.text });
    if (lapSplitBest)
      ui.drawChip('BEST LAP', CANVAS_W / 2, y + 40, 18, {
        align: 'center', px: 11, color: ui.UI.gold, bg: ui.hexToRgba(ui.UI.gold, 0.14), border: ui.hexToRgba(ui.UI.gold, 0.6)
      });
    ctx.restore();
  }

  /* 270-degree speed dial, bottom right */
  function drawSpeedometer() {
    const cx = CANVAS_W - 120, cy = CANVAS_H - 110, r = 82;
    const a0 = 0.75 * Math.PI, a1 = 2.25 * Math.PI;
    const maxSpeed = BASE_MAX_SPEED * (ship.stats ? ship.stats.speed : 1) * 1.8;
    const ratio = Math.max(0, Math.min(1, ship.speed / maxSpeed));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; ++i) {
      const ta = a0 + (a1 - a0) * (i / 11);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * (r - 14), cy + Math.sin(ta) * (r - 14));
      ctx.lineTo(cx + Math.cos(ta) * (r - 6), cy + Math.sin(ta) * (r - 6));
      ctx.stroke();
    }
    if (ratio > 0) {
      const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      g.addColorStop(0, '#5ab8ff');
      g.addColorStop(0.5, '#c04cff');
      g.addColorStop(1, '#ff4d8d');
      ctx.lineCap = 'round';
      if (boostActive) {
        ctx.save();
        ctx.globalAlpha *= 0.25;
        ctx.lineWidth = 20;
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * ratio);
        ctx.stroke();
        ctx.restore();
      }
      ctx.lineWidth = 12;
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * ratio);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ui.fitText(String(Math.round(ship.speed)), cx, cy + 12, 120, 36, { weight: 'bold', color: '#ffffff' });
    ui.fitText('km/s', cx, cy + 30, 80, 12, { color: ui.UI.textDim });
    if (boostActive)
      ui.drawChip('BOOST', cx, cy - r - 28, 20, {
        align: 'center', px: 11, color: '#ffffff', bg: ui.hexToRgba('#c04cff', 0.5), border: '#c04cff'
      });
    ctx.restore();
  }

  /* Boost meter with the manual-boost cost tick and the drift charge bar */
  function drawBoostPanel() {
    const x = CANVAS_W / 2 - 186, y = CANVAS_H - 70, w = 372, h = 56;
    const a = hudFadeAlpha('boost', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a, accent: '#c04cff' });
    ctx.save();
    ctx.globalAlpha *= a;
    const boostCost = BOOST_COST - 5 * treeLevel('b_burn');
    const mx = CANVAS_W / 2 - 170, my = CANVAS_H - 44, mw = 340, mh = 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ui.fitText('BOOST', mx, my - 12, 80, 12, { weight: 'bold', color: ui.UI.textDim });
    if (boostMeter >= boostCost)
      ui.drawKeycap('Shift', mx + mw - 46, my - 24, 11);
    if (drifting || driftTime > 0) {
      const charge = Math.min(1, driftTime / DRIFT_TIER2);
      const col = driftTime >= DRIFT_TIER2 ? '#ffaa3a' : driftTime >= DRIFT_TIER1 ? '#5ab8ff' : '#9ad8ff';
      ui.drawMeter(mx, my - 8, mw, 6, charge, col, { track: 'rgba(0,0,0,0.4)' });
    }
    ui.drawMeter(mx, my, mw, mh, boostMeter / BOOST_METER_MAX, '#c04cff', {});
    const tx = mx + mw * Math.min(1, boostCost / BOOST_METER_MAX);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, my - 2);
    ctx.lineTo(tx, my + mh + 2);
    ctx.stroke();
    ctx.restore();
  }

  /* Track outline fitted into the minimap panel, projected once per track */
  function minimapProjection() {
    if (minimapCache && minimapCache.geoRef === geo)
      return minimapCache;
    const x = CANVAS_W - 252, y = 18, w = 232, h = 160;
    const ix = x + 12, iy = y + 42, iw = w - 24, ih = h - 52;
    const b = geo.bounds, pad = 160;
    const s = Math.min(iw / (b.maxX - b.minX + pad), ih / (b.maxY - b.minY + pad));
    const ox = ix + (iw - (b.maxX - b.minX) * s) / 2 - b.minX * s;
    const oy = iy + (ih - (b.maxY - b.minY) * s) / 2 - b.minY * s;
    const pts = [];
    for (let i = 0; i < geo.points.length; i += 3)
      pts.push({ x: geo.points[i].x * s + ox, y: geo.points[i].y * s + oy });
    const p0 = geo.points[0], p1 = geo.points[1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    minimapCache = {
      geoRef: geo, s: s, ox: ox, oy: oy, pts: pts,
      start: { x: p0.x * s + ox, y: p0.y * s + oy, nx: Math.sin(ang), ny: -Math.cos(ang) }
    };
    return minimapCache;
  }

  function drawMinimap() {
    const x = CANVAS_W - 252, y = 18, w = 232, h = 160;
    const a = hudFadeAlpha('minimap', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a, title: currentVariant ? currentVariant.displayName : track.name, titlePx: 14 });
    const mm = minimapProjection();
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(mm.pts[0].x, mm.pts[0].y);
    for (let i = 1; i < mm.pts.length; ++i)
      ctx.lineTo(mm.pts[i].x, mm.pts[i].y);
    ctx.closePath();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c8d0e0';
    ctx.stroke();
    ctx.strokeStyle = ui.UI.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mm.start.x - mm.start.nx * 6, mm.start.y - mm.start.ny * 6);
    ctx.lineTo(mm.start.x + mm.start.nx * 6, mm.start.y + mm.start.ny * 6);
    ctx.stroke();
    for (let i = 0; i < opponents.length; ++i) {
      ctx.fillStyle = opponents[i].color;
      ctx.beginPath();
      ctx.arc(opponents[i].x * mm.s + mm.ox, opponents[i].y * mm.s + mm.oy, 4, 0, TWO_PI);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(ship.x * mm.s + mm.ox, ship.y * mm.s + mm.oy);
    ctx.rotate(ship.angle);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = getPlayerShipDef().color;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /* Live ranking: finished racers first, then by distance raced */
  function drawStandings() {
    const x = CANVAS_W - 252, y = 188, w = 232, h = 30 + 26 * 4;
    const a = hudFadeAlpha('standings', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a });
    const pd = getPlayerShipDef();
    const rows = [{ racer: ship, name: 'YOU', color: pd.color, player: true }];
    for (let i = 0; i < opponents.length; ++i)
      rows.push({ racer: opponents[i], name: opponents[i].name, color: opponents[i].color });
    rows.sort((u, v) => {
      const uf = u.racer.finished === true, vf = v.racer.finished === true;
      if (uf !== vf) return uf ? -1 : 1;
      if (uf && vf) return u.racer.finishTime - v.racer.finishTime;
      return v.racer.ts.dist - u.racer.ts.dist;
    });
    const L = geo.length;
    const leaderDist = rows[0].racer.ts.dist;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 14 + i * 26;
      if (rows[i].player) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x + 6, ry - 11, w - 12, 22);
      }
      ctx.textAlign = 'left';
      ui.fitText(String(i + 1), x + 12, ry + 1, 16, 14, { weight: 'bold', color: ui.UI.textDim });
      ctx.fillStyle = rows[i].color;
      ctx.beginPath();
      ctx.arc(x + 36, ry, 4, 0, TWO_PI);
      ctx.fill();
      ui.fitText(rows[i].name, x + 46, ry + 1, 108, 13, { weight: rows[i].player ? 'bold' : undefined, color: rows[i].player ? '#ffffff' : ui.UI.text });
      ctx.textAlign = 'right';
      const r = rows[i].racer;
      if (i === 0)
        ui.fitText('L' + Math.min(raceLaps, Math.floor(r.ts.dist / L) + 1), x + w - 12, ry + 1, 40, 12, { weight: 'bold', color: ui.UI.gold });
      else
        ui.fitText('+' + ((leaderDist - r.ts.dist) / 300).toFixed(1) + 's', x + w - 12, ry + 1, 56, 12, { color: ui.UI.textDim });
    }
    ctx.restore();
  }

  /* Name chips floating above the AI ships, drawn in screen space */
  function drawNameChips() {
    if (state !== STATE_PLAYING) return;
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      const p = worldToScreen(ai.x, ai.y);
      if (p.x < -60 || p.x > CANVAS_W + 60 || p.y < -40 || p.y > CANVAS_H + 40)
        continue;
      ui.drawChip(ai.name, p.x, p.y - 34 * camZoom, 18, {
        align: 'center', px: 11, color: '#ffffff', bg: ui.hexToRgba(ai.color, 0.55), border: ai.color
      });
    }
  }

  /* The slot showing what the player is carrying, with the use-key below it */
  function drawItemSlot() {
    const x = 20, y = CANVAS_H - 116, w = 96, h = 96;
    const a = hudFadeAlpha('item', x, y, w, h);
    ui.drawPanel(x, y, w, h, { accent: playerItem ? '#ffd75a' : undefined, alpha: a });
    ctx.save();
    ctx.globalAlpha *= a;
    const cx = x + w / 2, cy = y + h / 2;
    if (playerItem) {
      drawItemIcon(playerItem, cx, cy);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('?', cx, cy);
    }
    ui.drawKeycap('E', cx - 10, y + h + 2, 12);

    // second slot, unlocked by the Item Rack
    if (treeLevel('a_rack') > 0) {
      const x2 = 124, y2 = CANVAS_H - 92, w2 = 72, h2 = 72;
      ui.drawPanel(x2, y2, w2, h2, { accent: playerItem2 ? '#ffd75a' : undefined, alpha: a, noStuds: true });
      if (playerItem2) {
        ctx.save();
        ctx.translate(x2 + w2 / 2, y2 + h2 / 2);
        ctx.scale(1.1, 1.1);
        drawItemIcon(playerItem2, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('?', x2 + w2 / 2, y2 + h2 / 2);
      }
    }
    ctx.restore();
  }

  function drawItemIcon(item, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (item === 'missile') {
      ctx.fillStyle = '#e8ecf6';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(7, -8);
      ctx.lineTo(7, 16);
      ctx.lineTo(-7, 16);
      ctx.lineTo(-7, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(7, -8);
      ctx.lineTo(-7, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff8a3a';
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.lineTo(-14, 17);
      ctx.lineTo(-7, 17);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7, 4);
      ctx.lineTo(14, 17);
      ctx.lineTo(7, 17);
      ctx.closePath();
      ctx.fill();
    } else if (item === 'mine') {
      ctx.strokeStyle = '#c9d2e4';
      ctx.lineWidth = 3;
      for (let k = 0; k < 8; ++k) {
        const a = k * (Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
        ctx.stroke();
      }
      ctx.fillStyle = '#2b3244';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TWO_PI);
      ctx.fill();
    } else if (item === 'shield') {
      ctx.fillStyle = 'rgba(120,200,255,0.15)';
      ctx.strokeStyle = '#78c8ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
    } else if (item === 'emp') {
      ctx.strokeStyle = '#8ad8ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-9, -21);
      ctx.lineTo(5, -3);
      ctx.lineTo(-5, 3);
      ctx.lineTo(9, 21);
      ctx.stroke();
    } else if (item === 'turbo') {
      ctx.strokeStyle = '#ff8a3a';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-15, 10);
      ctx.lineTo(0, -6);
      ctx.lineTo(15, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-15, 22);
      ctx.lineTo(0, 6);
      ctx.lineTo(15, 22);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU SCREENS -- title, career, cup intro, quick race, garage,
     results, standings and pause, all in the shared panel style
     ══════════════════════════════════════════════════════════════════ */

  const THEME_COLORS = {
    nebula: '#c04cff', storm: '#5ab8ff', pulsar: '#8ad8ff', asteroid: '#b09a7a',
    solar: '#ffb648', comet: '#6fe08a', quasar: '#ff6ad5', void: '#9fe8ff'
  };
  const TROPHY_COLORS = { bronze: '#d08a4a', silver: '#c8d0e0', gold: '#ffd75a', platinum: '#9fe8ff' };

  function isMenuState(s) {
    return s === STATE_TITLE || s === STATE_CAREER || s === STATE_CUP_INTRO ||
      s === STATE_TRACKS || s === STATE_GARAGE || s === STATE_RESULTS || s === STATE_STANDINGS;
  }

  function menuBackground() {
    if (trackArt)
      drawFullBackground(globalTime * 20, globalTime * 14, 1);
    else {
      ctx.fillStyle = '#0b0d1c';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.fillStyle = 'rgba(3,5,12,0.45)';
    ctx.fillRect(-viewOffX / viewScale, -viewOffY / viewScale, CANVAS_W + 2 * viewOffX / viewScale, CANVAS_H + 2 * viewOffY / viewScale);
  }

  /* Register one clickable / keyboard-selectable item for this frame */
  function registerHit(id, x, y, w, h, action, disabled) {
    const index = hitAreas.length;
    hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  /* True when the keyboard cursor or the mouse rests on the item; hovering selects it */
  function isHot(index, x, y, w, h) {
    const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    if (hovered)
      menuCursor = index;
    return hovered || menuCursor === index;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.55;
    if (hot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.03, 1.03);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ui.drawPanel(x, y, w, h, {
      radius: 10,
      noStuds: true,
      accent: hot ? ui.UI.gold : (opts.accent || ui.UI.accent),
      glow: hot,
      top: hot ? 'rgba(36,46,76,0.96)' : undefined,
      bottom: hot ? 'rgba(15,19,36,0.96)' : undefined
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, opts.sub ? y + h / 2 - 8 : y + h / 2 + 1, w - 24, opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
    if (opts.sub)
      ui.fitText(opts.sub, x + w / 2, y + h - 11, w - 24, 11, { color: ui.UI.textDim });
    ctx.restore();
  }

  function moveMenuCursor(d) {
    const n = hitAreas.length;
    if (!n) return;
    menuCursor = (menuCursor + d + n) % n;
    SZ.GameAudio.play('click', { volume: 0.5 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      SZ.GameAudio.play('error');
      return;
    }
    SZ.GameAudio.play('select');
    item.action();
  }

  function menuEscape() {
    if (state === STATE_CAREER || state === STATE_TRACKS || state === STATE_GARAGE || state === STATE_RESULTS)
      enterTitle();
    else if (state === STATE_CUP_INTRO || state === STATE_STANDINGS)
      enterCareer();
    else if (state === STATE_PAUSED)
      state = STATE_PLAYING;
  }

  /* Simple cup: trapezoid bowl, handles, stem and base */
  function drawTrophy(cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.5, cy - size * 0.55);
    ctx.lineTo(cx + size * 0.5, cy - size * 0.55);
    ctx.lineTo(cx + size * 0.26, cy + size * 0.06);
    ctx.lineTo(cx - size * 0.26, cy + size * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.09;
    ctx.beginPath();
    ctx.arc(cx - size * 0.52, cy - size * 0.3, size * 0.17, Math.PI * 0.4, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + size * 0.52, cy - size * 0.3, size * 0.17, -Math.PI * 0.5, Math.PI * 0.6);
    ctx.stroke();
    ctx.fillRect(cx - size * 0.07, cy + size * 0.06, size * 0.14, size * 0.26);
    ctx.fillRect(cx - size * 0.24, cy + size * 0.32, size * 0.48, size * 0.12);
    ctx.restore();
  }

  function drawLock(cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = size * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8d0e0';
    ui.roundRectPath(cx - size * 0.4, cy - size * 0.12, size * 0.8, size * 0.6, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  /* Built geometry per track variant, cached by key */
  function variantGeo(variant) {
    let g = trackGeoCache[variant.key];
    if (!g) {
      g = SZ.RacingTrack.build(variant);
      trackGeoCache[variant.key] = g;
    }
    return g;
  }

  /* Track outline fitted into a box: wide theme stripe, white line, start marker */
  function drawTrackPreview(variant, x, y, w, h, color) {
    const g = variantGeo(variant);
    const b = g.bounds;
    const pad = 140;
    const s = Math.min(w / (b.maxX - b.minX + pad), h / (b.maxY - b.minY + pad));
    const ox = x + (w - (b.maxX - b.minX) * s) / 2 - b.minX * s;
    const oy = y + (h - (b.maxY - b.minY) * s) / 2 - b.minY * s;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < g.points.length; ++i) {
      const px = g.points[i].x * s + ox;
      const py = g.points[i].y * s + oy;
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 10;
    ctx.strokeStyle = ui.hexToRgba(color, 0.3);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    const p0 = g.points[0], p1 = g.points[1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const sx = p0.x * s + ox, sy = p0.y * s + oy;
    ctx.strokeStyle = ui.UI.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - Math.sin(ang) * 9, sy + Math.cos(ang) * 9);
    ctx.lineTo(sx + Math.sin(ang) * 9, sy - Math.cos(ang) * 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawStars(cx, cy, count) {
    for (let i = 0; i < 4; ++i) {
      const x = cx + (i - 1.5) * 20;
      ctx.fillStyle = i < count ? ui.UI.gold : 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(x, cy - 7);
      ctx.lineTo(x + 7, cy);
      ctx.lineTo(x, cy + 7);
      ctx.lineTo(x - 7, cy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* Screen-space confetti for podium finishes */
  function spawnConfetti() {
    confetti = [];
    const cols = ['#f44', '#ffd75a', '#6fe08a', '#5ab8ff', '#f4f', '#0ff'];
    for (let i = 0; i < 140; ++i)
      confetti.push({
        x: Math.random() * CANVAS_W,
        y: -Math.random() * CANVAS_H,
        vx: (Math.random() - 0.5) * 70,
        vy: 130 + Math.random() * 170,
        w: 5 + Math.random() * 5,
        h: 8 + Math.random() * 7,
        rot: Math.random() * TWO_PI,
        vr: (Math.random() - 0.5) * 7,
        color: cols[(Math.random() * cols.length) | 0]
      });
  }

  function updateConfetti(dt) {
    for (let i = 0; i < confetti.length; ++i) {
      const c = confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
      if (c.y > CANVAS_H + 20) {
        c.y = -20;
        c.x = Math.random() * CANVAS_W;
      }
    }
  }

  function drawConfetti() {
    for (let i = 0; i < confetti.length; ++i) {
      const c = confetti[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  /* Three random ships looping across the title screen */
  function initTitleShips() {
    const shapes = ['arrow', 'dart', 'wing', 'heavy', 'stealth'];
    const palette = [
      ['#4af', '#27d', '#48f'], ['#f44', '#a22', '#f84'], ['#4f4', '#2a2', '#8f4'],
      ['#fa0', '#a70', '#fc0'], ['#c4f', '#82a', '#d8f']
    ];
    titleShips = [];
    for (let i = 0; i < 3; ++i) {
      const col = palette[(Math.random() * palette.length) | 0];
      titleShips.push({
        shape: shapes[(Math.random() * shapes.length) | 0],
        color: col[0], accent: col[1], exhaust: col[2],
        y: 430 + i * 95 + Math.random() * 25,
        speed: 90 + Math.random() * 130,
        offset: Math.random() * 1500,
        bob: 0.7 + Math.random() * 0.9
      });
    }
  }

  function drawTitleScreen() {
    menuBackground();

    for (let i = 0; i < titleShips.length; ++i) {
      const t = titleShips[i];
      const span = CANVAS_W + 260;
      const x = ((globalTime * t.speed + t.offset) % span) - 130;
      SZ.RacingShipArt.drawShip(ctx, {
        x: x,
        y: t.y + Math.sin(globalTime * t.bob + t.offset) * 16,
        angle: 0,
        shape: t.shape,
        color: t.color,
        accent: t.accent,
        exhaust: t.exhaust,
        thrust: 1,
        scale: 1.5,
        time: globalTime
      });
    }

    ui.drawHeadline('SPACE RACING', 640, 170, 900, 96, '#5ab8ff', '#c04cff');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Drift. Boost. Win the Galaxy Cup.', 640, 238, 620, 20, { color: ui.UI.textDim });

    const trophyIds = ['bronze', 'silver', 'gold', 'platinum'];
    for (let i = 0; i < trophyIds.length; ++i) {
      const cx = 34 + i * 30;
      ctx.beginPath();
      ctx.arc(cx, 34, 10, 0, TWO_PI);
      if (save.trophies[trophyIds[i]]) {
        ctx.fillStyle = TROPHY_COLORS[trophyIds[i]];
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.stroke();
      }
    }
    ui.drawChip(`${save.credits} CR`, CANVAS_W - 24, 24, 30, { align: 'right', color: '#ffd75a' });

    const bw = 320, bh = 52, gap = 14;
    const bx = (CANVAS_W - bw) / 2;
    let by = 300;
    drawButton('career', 'Career', bx, by, bw, bh, { accent: ui.UI.gold, action: enterCareer });
    by += bh + gap;
    drawButton('quick', 'Quick Race', bx, by, bw, bh, { action: enterTracks });
    by += bh + gap;
    drawButton('garage', 'Garage', bx, by, bw, bh, { action: enterGarage });
    by += bh + gap;
    drawButton('workshop', 'Workshop', bx, by, bw, bh, { action: enterTree });
    by += bh + gap;
    drawButton('help', 'Help', bx, by, bw, bh, { action: () => { showTutorial = true; tutorialPage = 0; } });

    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'H', label: 'Help' }
    ], 640, 692, 900, 1);
  }

  function drawCareerScreen() {
    menuBackground();
    ui.drawHeadline('Career', 640, 66, 500, 48, ui.UI.gold);

    let cardY = 150;
    if (save.cupProgress && CUPS[save.cupProgress.cup]) {
      const progress = save.cupProgress;
      const cup = CUPS[progress.cup];
      drawButton('continue', `Continue ${cup.name} -- race ${progress.race + 1}/${CUP_RACES}`, 240, 100, 800, 40, {
        accent: cup.color,
        action: () => openCupIntro(progress.cup, progress.race)
      });
      cardY = 158;
    }

    const cw = 280, ch = 330, gap = 24;
    const x0 = (CANVAS_W - (CUPS.length * cw + (CUPS.length - 1) * gap)) / 2;
    for (let i = 0; i < CUPS.length; ++i) {
      const cup = CUPS[i];
      const x = x0 + i * (cw + gap);
      const unlocked = isCupUnlocked(i);
      const idx = registerHit('cup' + i, x, cardY, cw, ch, () => openCupIntro(i, 0), !unlocked);
      const hot = isHot(idx, x, cardY, cw, ch);
      ctx.save();
      if (!unlocked)
        ctx.globalAlpha *= 0.45;
      ui.drawPanel(x, cardY, cw, ch, { accent: hot ? ui.UI.gold : cup.color, glow: hot });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(cup.name, x + cw / 2, cardY + 30, cw - 24, 22, { weight: 'bold', color: cup.color });
      const earned = save.trophies[cup.id];
      drawTrophy(x + cw / 2, cardY + 110, 76, unlocked ? (earned ? TROPHY_COLORS[earned] : '#5d6884') : '#3a4058');
      if (!unlocked)
        drawLock(x + cw / 2 + 46, cardY + 142, 26);
      const earnedText = earned ? earned.charAt(0).toUpperCase() + earned.slice(1) + ' trophy' : 'Not won yet';
      ui.fitText(earnedText, x + cw / 2, cardY + 178, cw - 24, 14, { color: earned ? TROPHY_COLORS[earned] : ui.UI.textDim });
      drawStars(x + cw / 2, cardY + 204, i + 1);
      ui.fitText(`x${cup.reward} credits`, x + cw / 2, cardY + 228, cw - 24, 13, { color: ui.UI.textDim });
      for (let r = 0; r < cup.races.length; ++r) {
        const race = cup.races[r];
        const label = TRACKS[race[0]].name + (race[1] ? ' (Reverse)' : '');
        ui.fitText(label, x + cw / 2, cardY + 252 + r * 17, cw - 20, 12, { color: ui.UI.textDim });
      }
      if (!unlocked)
        ui.fitText('Finish the previous cup in the top 3', x + cw / 2, cardY + ch - 16, cw - 20, 11, { color: ui.UI.warn });
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Cup' },
      { key: 'Enter', label: 'Select' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawCupIntroScreen() {
    menuBackground();
    const cup = CUPS[chosenCup];
    const race = cup.races[cupIntroRace];
    const variant = trackVariant(race[0], race[1]);
    const g = variantGeo(variant);
    const pw = 760, ph = 480;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;

    ui.drawPanel(px, py, pw, ph, { accent: cup.color });
    ui.drawHeadline(cup.name, 640, py + 52, 560, 40, cup.color);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(`Race ${cupIntroRace + 1} of ${CUP_RACES}`, 640, py + 88, 400, 17, { color: ui.UI.textDim });
    ui.fitText(variant.displayName, 640, py + 122, 640, 32, { weight: 'bold', color: ui.UI.text });

    drawTrackPreview(variant, px + 30, py + 150, 420, 260, THEME_COLORS[variant.theme] || ui.UI.accent);
    ui.fitText(`${variant.laps} laps   -   ${(g.length / 1000).toFixed(1)} km`, px + 240, py + 424, 420, 16, { color: ui.UI.textDim });

    if (save.cupProgress && save.cupProgress.cup === chosenCup && save.cupProgress.race > 0) {
      const pts = save.cupProgress.points || {};
      const rows = Object.keys(pts).map(name => ({ name: name, points: pts[name] }));
      rows.sort((a, b) => b.points - a.points);
      ctx.textAlign = 'left';
      ui.fitText('Standings', px + 500, py + 160, 200, 16, { weight: 'bold', color: ui.UI.gold });
      for (let i = 0; i < rows.length && i < 4; ++i) {
        const ry = py + 190 + i * 26;
        const isPlayer = rows[i].name === 'player';
        ctx.textAlign = 'left';
        ui.fitText(isPlayer ? 'YOU' : rows[i].name, px + 500, ry, 150, 14, { weight: isPlayer ? 'bold' : undefined, color: isPlayer ? '#ffffff' : ui.UI.text });
        ctx.textAlign = 'right';
        ui.fitText(String(rows[i].points), px + 710, ry, 60, 14, { weight: 'bold', color: ui.UI.gold });
      }
      ctx.textAlign = 'center';
    }

    drawButton('race', 'Race!', px + 120, py + ph - 70, 240, 48, {
      accent: ui.UI.gold,
      action: () => {
        if (save.cupProgress && save.cupProgress.cup === chosenCup) {
          if (!nextCupRace())
            SZ.GameAudio.play('error');
        } else if (!startCup(chosenCup))
          SZ.GameAudio.play('error');
      }
    });
    drawButton('back', 'Back', px + 400, py + ph - 70, 240, 48, { action: enterCareer });

    ui.drawKeyHints([
      { key: 'Enter', label: 'Race!' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawTracksScreen() {
    menuBackground();
    ui.drawHeadline('Quick Race', 640, 56, 500, 44, ui.UI.accent);

    const canReverse = !!save.trophies.gold;
    drawButton('reverse', `Reverse: ${quickReverse ? 'On' : 'Off'}`, 980, 36, 264, 44, {
      disabled: !canReverse,
      sub: canReverse ? undefined : 'Win the Gold Cup',
      action: () => { quickReverse = !quickReverse; }
    });

    const cw = 280, ch = 230, gap = 24;
    const x0 = (CANVAS_W - (4 * cw + 3 * gap)) / 2;
    const y0 = 108;
    for (let i = 0; i < TRACKS.length; ++i) {
      const col = i % 4, row = (i / 4) | 0;
      const x = x0 + col * (cw + gap);
      const y = y0 + row * (ch + gap);
      const variant = trackVariant(i, quickReverse);
      const theme = THEME_COLORS[TRACKS[i].theme] || ui.UI.accent;
      const idx = registerHit('track' + i, x, y, cw, ch, () => {
        currentTrackIndex = i;
        currentVariant = trackVariant(i, quickReverse);
        raceCup = null;
        resetGame();
      });
      const hot = isHot(idx, x, y, cw, ch);
      ui.drawPanel(x, y, cw, ch, { accent: hot ? ui.UI.gold : theme, glow: hot });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(variant.displayName, x + cw / 2, y + 22, cw - 24, 18, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
      drawTrackPreview(variant, x + 24, y + 38, cw - 48, 128, theme);
      ctx.fillStyle = theme;
      ctx.fillRect(x + 16, y + ch - 40, cw - 32, 4);
      const best = save.bestLaps[variant.key];
      ui.fitText('BEST ' + (best !== undefined ? formatTime(best) : '--'), x + cw / 2, y + ch - 18, cw - 32, 13, { color: ui.UI.textDim });
    }

    ui.drawKeyHints([
      { key: '←→↑↓', label: 'Track' },
      { key: 'Enter', label: 'Race' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawGarageScreen() {
    menuBackground();
    garageCursor = menuCursor;
    const def = SHIP_DEFS[garageCursor];
    const unlocked = isShipUnlocked(def);

    // glowing platform under the big preview
    const px = 300, py = 320;
    const glow = ctx.createRadialGradient(px, py + 95, 10, px, py + 95, 180);
    glow.addColorStop(0, ui.hexToRgba(def.color, 0.35));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(px, py + 95, 180, 58, 0, 0, TWO_PI);
    ctx.fill();

    SZ.RacingShipArt.drawShip(ctx, {
      x: px,
      y: py,
      angle: globalTime * 0.6,
      shape: def.shape,
      color: def.color,
      accent: def.accentColor,
      exhaust: def.exhaustColor,
      thrust: 0.6 + 0.4 * Math.abs(Math.sin(globalTime * 1.7)),
      scale: 3.2,
      time: globalTime
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.drawHeadline(def.name, 900, 110, 520, 40, def.color);
    ui.drawTextBlock(def.description, 640, 146, 520, 44, 16, { color: ui.UI.textDim });

    const statDefs = [['speed', 'Speed'], ['accel', 'Acceleration'], ['handling', 'Handling'], ['boost', 'Boost']];
    const statColors = { speed: '#5ab8ff', accel: '#6fe08a', handling: '#ffd75a', boost: '#c04cff' };
    const eff = getEffectiveStats(def);
    for (let s = 0; s < statDefs.length; ++s) {
      const key = statDefs[s][0];
      const y = 210 + s * 46;
      ctx.textAlign = 'left';
      ui.fitText(statDefs[s][1], 640, y + 9, 150, 15, { color: ui.UI.textDim });
      ui.drawMeter(800, y, 340, 18, def.stats[key] / 1.4, statColors[key], {});
      const bw = 340 * ui.clamp(def.stats[key] / 1.4, 0, 1);
      const ew = 340 * ui.clamp(eff[key] / 1.4, 0, 1);
      if (ew > bw) {
        ctx.fillStyle = ui.hexToRgba(statColors[key], 0.4);
        ctx.fillRect(800 + bw, y + 2, ew - bw, 14);
      }
    }
    ui.fitText('The lighter bar extension is the Workshop bonus', 640, 400, 520, 12, { color: ui.UI.textMute });

    const tw = 150, th = 116, gap = 16;
    const x0 = (CANVAS_W - (SHIP_DEFS.length * tw + (SHIP_DEFS.length - 1) * gap)) / 2;
    const ty = 560;
    for (let i = 0; i < SHIP_DEFS.length; ++i) {
      const sd = SHIP_DEFS[i];
      const x = x0 + i * (tw + gap);
      const own = isShipUnlocked(sd);
      const idx = registerHit('ship' + i, x, ty, tw, th, () => {
        if (own) {
          selectedShipIndex = i;
          save.selectedShip = sd.id;
          writeSave();
          SZ.GameAudio.play('select');
        } else if (buyShip(sd)) {
          SZ.GameAudio.play('coin');
          SZ.GameAudio.play('powerup');
          selectedShipIndex = i;
          save.selectedShip = sd.id;
          writeSave();
        } else
          SZ.GameAudio.play('error');
      });
      const hot = isHot(idx, x, ty, tw, th);
      ctx.save();
      if (!own)
        ctx.globalAlpha *= 0.55;
      ui.drawPanel(x, ty, tw, th, { accent: hot ? ui.UI.gold : (i === selectedShipIndex ? sd.color : ui.UI.accent), glow: hot, noStuds: true });
      SZ.RacingShipArt.drawShip(ctx, {
        x: x + tw / 2, y: ty + 34, angle: -Math.PI / 2, shape: sd.shape, color: sd.color,
        accent: sd.accentColor, exhaust: sd.exhaustColor, thrust: 0.3, scale: 1.15, time: globalTime
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(sd.name, x + tw / 2, ty + 84, tw - 12, 12, { weight: 'bold', color: i === selectedShipIndex ? ui.UI.gold : ui.UI.text });
      if (own) {
        if (i === selectedShipIndex)
          ui.fitText('EQUIPPED', x + tw / 2, ty + th - 12, tw - 12, 11, { weight: 'bold', color: ui.UI.good });
      } else {
        const req = sd.unlock.price
          ? `${sd.unlock.price} CR`
          : 'Win the ' + sd.unlock.trophy.charAt(0).toUpperCase() + sd.unlock.trophy.slice(1) + ' Cup';
        ui.fitText(req, x + tw / 2, ty + th - 12, tw - 12, 11, { color: ui.UI.warn });
        drawLock(x + tw - 22, ty + 18, 16);
      }
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Browse' },
      { key: 'Enter', label: unlocked ? 'Select' : 'Buy' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawResultsScreen() {
    menuBackground();
    ui.drawHeadline('Race Results', 640, 56, 600, 44, ui.UI.gold);

    // podium: 2nd, 1st, 3rd
    const groundY = 560;
    const podium = [
      { place: 2, x: 130, h: 120, col: '#c8d0e0' },
      { place: 1, x: 270, h: 160, col: '#ffd75a' },
      { place: 3, x: 410, h: 90, col: '#d08a4a' }
    ];
    for (let i = 0; i < podium.length; ++i) {
      const p = podium[i];
      const entry = lastPodium[p.place - 1];
      const x = p.x - 60, y = groundY - p.h;
      ui.drawPanel(x, y, 120, p.h, { accent: p.col, noStuds: true, glow: p.place === 1 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(String(p.place), p.x, y + p.h / 2, 60, 34, { weight: 'bold', color: p.col });
      if (entry) {
        SZ.RacingShipArt.drawShip(ctx, {
          x: p.x, y: y - 34, angle: -Math.PI / 2, shape: entry.shape, color: entry.color,
          accent: entry.accent, exhaust: entry.exhaust, thrust: 0.35, scale: 1.5, time: globalTime
        });
        if (entry.player)
          ui.drawChip('YOU', p.x, y - 78, 20, { align: 'center', px: 12, color: '#ffffff', bg: ui.hexToRgba('#5ab8ff', 0.5), border: '#5ab8ff' });
      }
    }

    // results table
    const tx = 560, ty = 96, tw = CANVAS_W - tx - 24;
    ui.drawPanel(tx, ty, tw, 210, { title: currentVariant.displayName, titlePx: 15 });
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lastStandings.length && i < 4; ++i) {
      const e = lastStandings[i];
      const ry = ty + 52 + i * 36;
      const isPlayer = e.name === 'player';
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(tx + 8, ry - 15, tw - 16, 30);
      }
      ctx.textAlign = 'left';
      ui.fitText(getOrdinal(i + 1), tx + 16, ry, 50, 16, { weight: 'bold', color: i === 0 ? ui.UI.gold : ui.UI.textDim });
      ui.fitText(isPlayer ? 'YOU' : e.name, tx + 76, ry, 180, 16, { weight: isPlayer ? 'bold' : undefined, color: isPlayer ? '#ffffff' : ui.UI.text });
      ctx.textAlign = 'right';
      const timeText = e.finished ? formatTime(e.finishTime) : `${Math.max(0, Math.floor(e.dist / geo.length))} laps`;
      ui.fitText(timeText, tx + tw - 16, ry, 140, 15, { color: ui.UI.text });
    }
    ctx.textAlign = 'left';
    ui.fitText(`Best lap: ${raceBestLap > 0 ? formatTime(raceBestLap) : '--'}`, tx + 16, ty + 190, 220, 13, { color: ui.UI.textDim });

    // reward breakdown with a count-up total
    const ry0 = ty + 226;
    ui.drawPanel(tx, ry0, tw, 250, { title: 'Reward', titlePx: 15, accent: ui.UI.gold });
    if (lastRaceReward) {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ui.fitText(`${getOrdinal(playerPlace)} place`, tx + 16, ry0 + 52, 200, 16, { weight: 'bold', color: ui.UI.text });
      ctx.textAlign = 'right';
      ui.fitText(String(lastRaceReward.base), tx + tw - 16, ry0 + 52, 120, 16, { color: ui.UI.text });
      for (let i = 0; i < lastRaceReward.bonuses.length && i < 4; ++i) {
        const b = lastRaceReward.bonuses[i];
        ctx.textAlign = 'left';
        ui.fitText(b[0], tx + 16, ry0 + 80 + i * 26, 240, 14, { color: ui.UI.textDim });
        ctx.textAlign = 'right';
        ui.fitText(`+${b[1]}`, tx + tw - 16, ry0 + 80 + i * 26, 120, 14, { color: ui.UI.good });
      }
      const shown = Math.round(lastRaceReward.total * Math.min(1, resultsTime / 1.2));
      ctx.textAlign = 'left';
      ui.fitText('TOTAL', tx + 16, ry0 + 208, 120, 20, { weight: 'bold', color: ui.UI.gold });
      ctx.textAlign = 'right';
      ui.fitText(`${shown} CR`, tx + tw - 16, ry0 + 208, 160, 26, { weight: 'bold', color: ui.UI.gold });
    }

    drawConfetti();

    if (resultsWasCup) {
      drawButton('standings', 'Standings', 520, 600, 240, 48, { accent: ui.UI.gold, action: () => gotoState(STATE_STANDINGS) });
    } else {
      drawButton('again', 'Race Again', 470, 600, 220, 48, { accent: ui.UI.gold, action: () => resetGame() });
      drawButton('tracks', 'Tracks', 710, 600, 220, 48, { action: enterTracks });
      drawButton('menu', 'Menu', 950, 600, 220, 48, { action: enterTitle });
    }

    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' }
    ], 640, 692, 900, 1);
  }

  function drawStandingsScreen() {
    menuBackground();
    const cupDone = !!lastCupResult;
    const cup = cupDone ? CUPS.find(c => c.id === lastCupResult.cup) : CUPS[save.cupProgress ? save.cupProgress.cup : chosenCup];
    if (!cup) {
      enterCareer();
      return;
    }

    ui.drawHeadline(`${cup.name} Standings`, 640, 60, 700, 44, cup.color);

    let rows;
    if (cupDone)
      rows = lastCupResult.standings.slice();
    else {
      const pts = (save.cupProgress && save.cupProgress.points) || {};
      rows = Object.keys(pts).map(name => ({ name: name, points: pts[name] }));
    }
    rows.sort((a, b) => b.points - a.points || (a.name === 'player' ? -1 : 1));

    const px = 300, py = 110, pw = 680, ph = 250;
    ui.drawPanel(px, py, pw, ph, { title: 'Championship', titlePx: 16 });
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length && i < 4; ++i) {
      const r = rows[i];
      const isPlayer = r.name === 'player';
      const ry = py + 56 + i * 44;
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(px + 8, ry - 18, pw - 16, 36);
      }
      ctx.textAlign = 'left';
      ui.fitText(String(i + 1), px + 16, ry, 30, 18, { weight: 'bold', color: i === 0 ? ui.UI.gold : ui.UI.textDim });
      ui.fitText(isPlayer ? 'YOU' : r.name, px + 56, ry, 260, 18, { weight: isPlayer ? 'bold' : undefined, color: isPlayer ? '#ffffff' : ui.UI.text });
      const gained = lastRacePoints[r.name] || 0;
      const shown = Math.max(0, Math.round(r.points - gained * (1 - Math.min(1, standingsTime / 0.8))));
      ctx.textAlign = 'right';
      if (gained > 0)
        ui.fitText(`+${gained}`, px + pw - 110, ry, 60, 14, { color: ui.UI.good });
      ui.fitText(String(shown), px + pw - 20, ry, 80, 20, { weight: 'bold', color: ui.UI.gold });
    }

    if (cupDone) {
      const trophy = lastCupResult.trophy;
      let rank = 0;
      while (rank < rows.length && rows[rank].name !== 'player')
        ++rank;
      if (trophy) {
        drawTrophy(640, 430, 130, TROPHY_COLORS[trophy]);
        ui.drawHeadline(`${cup.name} won!`, 640, 520, 600, 40, TROPHY_COLORS[trophy]);
      } else {
        ui.drawHeadline(`Cup finished: ${getOrdinal(rank + 1)}`, 640, 450, 600, 36, ui.UI.textDim);
      }
      const unlockedNotes = [];
      if (trophy) {
        const nextIdx = CUPS.findIndex(c => c.id === lastCupResult.cup) + 1;
        if (nextIdx < CUPS.length)
          unlockedNotes.push(`${CUPS[nextIdx].name} unlocked`);
        for (let i = 0; i < SHIP_DEFS.length; ++i) {
          const sd = SHIP_DEFS[i];
          if (sd.unlock && sd.unlock.trophy === trophy)
            unlockedNotes.push(`${sd.name} unlocked`);
        }
      }
      ctx.textAlign = 'center';
      ui.fitText(unlockedNotes.join('   -   '), 640, 560, 900, 15, { color: ui.UI.good });
    }

    drawButton('next', save.cupProgress ? 'Next Race' : 'Career', 520, 600, 240, 48, {
      accent: ui.UI.gold,
      action: () => {
        if (save.cupProgress)
          openCupIntro(save.cupProgress.cup, save.cupProgress.race);
        else
          enterCareer();
      }
    });

    ui.drawKeyHints([
      { key: 'Enter', label: save.cupProgress ? 'Next Race' : 'Career' },
      { key: 'Esc', label: 'Career' }
    ], 640, 692, 900, 1);
  }

  function drawPausePanel() {
    ctx.fillStyle = 'rgba(3,5,12,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const pw = 420, ph = 300;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;
    ui.drawPanel(px, py, pw, ph, { title: 'Paused', titlePx: 20, accent: ui.UI.gold });
    drawButton('resume', 'Resume', px + 60, py + 70, 300, 48, { accent: ui.UI.gold, action: () => { state = STATE_PLAYING; SZ.GameAudio.play('select'); } });
    drawButton('restart', 'Restart', px + 60, py + 128, 300, 48, { action: () => resetGame() });
    drawButton('quit', 'Quit to Menu', px + 60, py + 186, 300, 48, { action: enterTitle });
    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'Esc', label: 'Resume' }
    ], 640, 692, 900, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING -- WORKSHOP TECH TREE SCREEN
     ══════════════════════════════════════════════════════════════════ */

  const TREE_CARD_W = 300, TREE_CARD_H = 120, TREE_COL_GAP = 90, TREE_ROW_GAP = 26;

  /* Column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (let i = 0; i < node.req.length; ++i) {
      const parent = treeNodeById(node.req[i][0]);
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

  /* Tabs plus the card grid of the active branch, centered in the card area */
  function buildTreeLayout() {
    const tabs = [];
    const tabW = (1232 - (TREE.branches.length - 1) * 8) / TREE.branches.length;
    for (let i = 0; i < TREE.branches.length; ++i) {
      const b = TREE.branches[i];
      const nodes = TREE.nodes.filter(n => n.branch === b.id);
      let maxed = 0;
      for (let k = 0; k < nodes.length; ++k)
        if (treeLevel(nodes[k].id) >= nodes[k].costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE.branches[treeBranch];
    const cols = [];
    for (const node of TREE.nodes) {
      if (node.branch !== branch.id) continue;
      const d = treeDepth(node);
      if (!cols[d]) cols[d] = [];
      cols[d].push(node);
    }
    let rows = 0;
    for (let c = 0; c < cols.length; ++c)
      if (cols[c]) rows = Math.max(rows, cols[c].length);

    const areaH = 480;   // the card area between tabs and footer, y 160..640
    const gap = rows > 1 ? Math.max(8, Math.min(TREE_ROW_GAP, (areaH - rows * TREE_CARD_H) / (rows - 1))) : TREE_ROW_GAP;
    const gridW = cols.length * TREE_CARD_W + (cols.length - 1) * TREE_COL_GAP;
    const gridH = rows * TREE_CARD_H + (rows - 1) * gap;
    const startX = 24 + (1232 - gridW) / 2;
    const startY = gridH <= areaH ? 160 + (areaH - gridH) / 2 : 160;

    const cards = [];
    for (let c = 0; c < cols.length; ++c) {
      if (!cols[c]) continue;
      for (let r = 0; r < cols[c].length; ++r) {
        const node = cols[c][r];
        cards.push({
          node: node,
          col: c,
          row: r,
          x: startX + c * (TREE_CARD_W + TREE_COL_GAP),
          y: startY + r * (TREE_CARD_H + gap),
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          state: nodeState(node)
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!treeLayout) return null;
    return treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE.branches[treeBranch].id;
    const first = treeLayout ? treeLayout.cards.find(c => c.node.branch === branchId) : null;
    treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!treeLayout) treeLayout = buildTreeLayout();
    const branchId = TREE.branches[treeBranch].id;
    const cur = treeCardById(treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      SZ.GameAudio.play('click', { volume: 0.5 });
      return;
    }
    const cols = {};
    for (const card of treeLayout.cards) {
      if (card.node.branch !== branchId) continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      treeBranch = (treeBranch + (ci < 0 ? -1 : 1) + TREE.branches.length) % TREE.branches.length;
      treeLayout = buildTreeLayout();
      selectFirstInBranch();
      SZ.GameAudio.play('click', { volume: 0.5 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    treeSelected = col[ri].node.id;
    SZ.GameAudio.play('click', { volume: 0.5 });
  }

  function drawTreeScreen() {
    const layout = buildTreeLayout();
    treeLayout = layout;

    // keep a valid selection for the active branch
    if (!treeSelected || !layout.cards.some(c => c.node.id === treeSelected))
      selectFirstInBranch();

    // hover selects the card under the cursor
    if (mouseX >= 0) {
      for (const card of layout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          break;
        }
      }
    }

    ctx.fillStyle = '#070a16';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (trackArt) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      trackArt.drawBackground(ctx, camX, camY, camZoom, globalTime, CANVAS_W, CANVAS_H);
      ctx.restore();
    }

    // header: title, credits, progress
    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Workshop', 130, 58, 220, 40, ui.UI.gold);
    ui.drawChip(`${save.credits} CR`, 1236, 44, 30, { align: 'right', color: '#ffd75a' });
    let complete = 0;
    for (const node of TREE.nodes)
      if (treeLevel(node.id) >= node.costs.length)
        ++complete;
    ctx.textAlign = 'right';
    ui.fitText(`${complete} / ${TREE.nodes.length} upgrades complete`, 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

    // branch tabs
    for (const tab of layout.tabs) {
      const active = tab.index === treeBranch;
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = '#0d1020';
      ctx.fill();
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = ui.hexToRgba(tab.branch.color, active ? 0.55 : 0.25);
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = tab.branch.color;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(`${tab.branch.name} ${tab.maxed}/${tab.total}`, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, tab.w - 16, 14, { weight: 'bold', color: active ? '#ffffff' : '#c9d1e8' });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // connectors under the cards
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from) continue;
        const met = treeLevel(reqId) >= card.node.req[i][1];
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.8) : '#3a4058';
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    for (const card of layout.cards)
      drawTreeNodeCard(card);

    // selection outline
    for (const card of layout.cards) {
      if (card.node.id !== treeSelected) continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' }
    ], 640, 690, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE.branches.find(b => b.id === node.branch);
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    // buyable cards breathe with a pulsing outline
    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(globalTime * 4));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 26, 268, 20, { weight: 'bold', color: ui.UI.text });
    ui.drawChip(`${level ? romanNumeral(level) : '0'} / ${romanNumeral(max)}`, card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

    // level pips
    for (let l = 0; l < max; ++l) {
      const px = card.x + 16 + l * 20;
      const py = card.y + card.h - 18;
      ui.roundRectPath(px, py, 16, 8, 2);
      ctx.fillStyle = l < level ? branch.color : 'rgba(255,255,255,0.07)';
      ctx.fill();
      if (l >= level) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
      }
    }

    // cost or MAX, bottom right
    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      ui.fitText(`${node.costs[level]} CR`, card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

    // locked cards say what is still missing
    if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(`${treeNodeById(node.req[i][0]).name} ${romanNumeral(node.req[i][1])}`);
      }
      if (node.trophy && !save.trophies[node.trophy]) {
        const cup = CUPS.find(c => c.id === node.trophy);
        missing.push(`${cup ? cup.name : node.trophy} trophy`);
      }
      ctx.textAlign = 'center';
      ui.fitText(`Requires ${missing.join(', ')}`, card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    // white flash over a just-bought card
    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (globalTime - treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = `rgba(255,255,255,${(0.55 * f).toFixed(3)})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW GAME
     ══════════════════════════════════════════════════════════════════ */

  function drawGame() {
    hitAreas.length = 0;

    if (state === STATE_TREE) {
      drawTreeScreen();
      return;
    }

    if (isMenuState(state)) {
      if (state === STATE_TITLE)
        drawTitleScreen();
      else if (state === STATE_CAREER)
        drawCareerScreen();
      else if (state === STATE_CUP_INTRO)
        drawCupIntroScreen();
      else if (state === STATE_TRACKS)
        drawTracksScreen();
      else if (state === STATE_GARAGE)
        drawGarageScreen();
      else if (state === STATE_RESULTS)
        drawResultsScreen();
      else
        drawStandingsScreen();
      if (showTutorial)
        drawTutorialOverlay();
      return;
    }

    drawBackground();
    drawAmbient();
    ctx.save();
    applyWorldTransform();
    drawTrack();
    drawSkids();
    drawGravityBodies();
    drawWormholes();
    drawBoostPads();
    drawHazards();
    drawItemBoxes();
    drawMines();
    drawMissiles();
    drawTrails();

    // Draw AI opponents
    for (let i = 0; i < opponents.length; ++i) {
      const ai = opponents[i];
      drawShip(ai.x, ai.y, ai.angle, ai.color, ai.accentColor, ai.exhaustColor, ai.shape, false, ai.speed > 50, ai.bank, ai.shieldTime > 0);
    }

    // Draw player ship
    const pd = getPlayerShipDef();
    drawShip(ship.x, ship.y, ship.angle, pd.color, pd.accentColor, pd.exhaustColor, pd.shape, true, keys['ArrowUp'] || keys['KeyW'], ship.bank, ship.shieldTime > 0);
    drawShockwaves();
    particles.draw(ctx);
    floatingText.draw(ctx);
    ctx.restore();

    drawSpeedLines();
    drawNameChips();
    drawHUD();
    drawFlashes();

    if (state === STATE_PAUSED)
      drawPausePanel();

    if (showTutorial)
      drawTutorialOverlay();
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 460, ph = 220, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#f80';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#f80';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(page.title, cx, py + 30);
    for (let i = 0; i < page.lines.length; ++i)
      ui.fitText(page.lines[i], cx, py + 58 + i * 22, pw - 40, 13, { color: '#ccc' });
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    if (tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function setStatus(el, text) {
    if (el && el.textContent !== text)
      el.textContent = text;
  }

  function updateStatusBar() {
    setStatus(statusPosition, `Pos: ${getOrdinal(playerPlace)}`);
    setStatus(statusLap, `Lap: ${Math.min(playerLap + 1, raceLaps)}/${raceLaps}`);
    setStatus(statusSpeed, `Speed: ${Math.round(ship.speed)}`);
    setStatus(statusTime, `Time: ${formatTime(raceTime)}`);
    setStatus(statusCredits, `Credits: ${credits}`);
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
    // adaptive quality: when racing stays below ~40 fps for 2 s, render fewer pixels
    if (rawDt > 0 && rawDt < 0.25) {
      frameMsAvg += (rawDt * 1000 - frameMsAvg) * 0.05;
      if (state === STATE_PLAYING && frameMsAvg > 25 && renderScale > 0.6) {
        slowFrameTime += rawDt;
        if (slowFrameTime > 2) {
          renderScale = Math.max(0.6, renderScale - 0.15);
          slowFrameTime = 0;
          frameMsAvg = 16;
          setupCanvas();
        }
      } else
        slowFrameTime = 0;
    }

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    beginFrame();
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    screenShake.restore(ctx);
    ctx.restore();

    updateStatusBar();

    // Clear just-pressed flags at end of frame
    keyJustPressed = {};

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_PLAYING,
    pause: () => {
      pauseRacing();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (keys[e.code]) return; // Ignore key repeat
    keys[e.code] = true;
    keyJustPressed[e.code] = true;
    mouseControlActive = false; // keyboard overrides mouse steering

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
      if (state === STATE_PLAYING || state === STATE_PAUSED || isMenuState(state)) {
        showTutorial = !showTutorial;
        tutorialPage = 0;
        return;
      }
    }

    // ── Workshop tree navigation ──
    if (state === STATE_TREE) {
      e.preventDefault();
      if (e.code === 'Escape') {
        leaveTree();
      } else if (e.code === 'Tab') {
        treeBranch = (treeBranch + 1) % TREE.branches.length;
        if (!treeLayout) treeLayout = buildTreeLayout();
        selectFirstInBranch();
        SZ.GameAudio.play('click', { volume: 0.5 });
      } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
        const b = Number(e.code.slice(5)) - 1;
        if (b < TREE.branches.length) {
          treeBranch = b;
          if (!treeLayout) treeLayout = buildTreeLayout();
          selectFirstInBranch();
          SZ.GameAudio.play('click', { volume: 0.5 });
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        moveTreeSelection(-1, 0);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        moveTreeSelection(1, 0);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        moveTreeSelection(0, -1);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        moveTreeSelection(0, 1);
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        const node = treeNodeById(treeSelected);
        if (node && buyNode(node))
          treeBuyFlash = { id: node.id, at: globalTime };
      }
      return;
    }

    // ── Menu screen navigation (all screens share the hit-area cursor) ──
    if (isMenuState(state) || state === STATE_PAUSED) {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
        moveMenuCursor(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
        moveMenuCursor(1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
        activateMenuItem(hitAreas[menuCursor]);
      else if (e.code === 'Escape')
        menuEscape();
      return;
    }

    // ── Normal game controls ──
    if (e.code === 'F2') {
      e.preventDefault();
      raceCup = null;
      currentVariant = trackVariant(currentTrackIndex, false);
      resetGame();
    }

    if (e.code === 'Tab') {
      e.preventDefault();
      if (isMenuState(state))
        enterGarage();
    }

    if (e.code === 'F3') {
      e.preventDefault();
      if (isMenuState(state))
        enterTree();
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        pauseRacing();
    }

    if (e.code === 'KeyE')
      usePlayerItem();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Menu clicks + mouse steering ── */
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    mouseX = ((e.clientX - rect.left) * dpr - viewOffX) / viewScale;
    mouseY = ((e.clientY - rect.top) * dpr - viewOffY) / viewScale;

    if (showTutorial) {
      ++tutorialPage;
      if (tutorialPage >= TUTORIAL_PAGES.length)
        showTutorial = false;
      return;
    }
    if (state === STATE_TREE) {
      if (!treeLayout) treeLayout = buildTreeLayout();
      for (const tab of treeLayout.tabs) {
        if (mouseX >= tab.x && mouseX <= tab.x + tab.w && mouseY >= tab.y && mouseY <= tab.y + tab.h) {
          treeBranch = tab.index;
          selectFirstInBranch();
          SZ.GameAudio.play('click', { volume: 0.5 });
          return;
        }
      }
      for (const card of treeLayout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          if (buyNode(card.node))
            treeBuyFlash = { id: card.node.id, at: globalTime };
          return;
        }
      }
      return;
    }
    if (isMenuState(state) || state === STATE_PAUSED) {
      for (let i = 0; i < hitAreas.length; ++i) {
        const a = hitAreas[i];
        if (mouseX >= a.x && mouseX <= a.x + a.w && mouseY >= a.y && mouseY <= a.y + a.h) {
          menuCursor = i;
          activateMenuItem(a);
          return;
        }
      }
      return;
    }
    if (e.button === 2) { // right button uses the held item instead of steering
      usePlayerItem();
      return;
    }
    mouseDown = true;
    mouseControlActive = true;
  });

  canvas.addEventListener('pointermove', (e) => {
    // keep the logical cursor position for every screen; only racing steers with it
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    mouseX = ((e.clientX - rect.left) * dpr - viewOffX) / viewScale;
    mouseY = ((e.clientY - rect.top) * dpr - viewOffY) / viewScale;
  });

  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
    mouseControlActive = false;
  });

  /* the right mouse button fires the held item, so keep the browser menu away */
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        enterTitle();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          pauseRacing();
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        break;
      case 'ship-select':
        if (isMenuState(state))
          enterGarage();
        break;
      case 'upgrades':
        if (isMenuState(state))
          enterTree();
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
    let title;
    if (state === STATE_GARAGE)
      title = 'Space Racing -- Garage';
    else if (state === STATE_TREE)
      title = 'Space Racing -- Workshop';
    else if (state === STATE_RESULTS)
      title = `Space Racing -- ${getOrdinal(playerPlace)} Place -- ${track.name}`;
    else
      title = `Space Racing -- ${track.name}`;
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

  SZ.GameAudio.attachMuteButton();
  setupCanvas();
  loadHighScores();
  loadSave();
  credits = save.credits;
  const savedShipIndex = SHIP_DEFS.findIndex(d => d.id === save.selectedShip);
  if (savedShipIndex >= 0)
    selectedShipIndex = savedShipIndex;
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }

  // a random track serves as the menu background until a race picks one
  currentTrackIndex = Math.floor(Math.random() * TRACKS.length);
  currentVariant = trackVariant(currentTrackIndex, false);
  initTitleShips();
  prepareTrack();
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
