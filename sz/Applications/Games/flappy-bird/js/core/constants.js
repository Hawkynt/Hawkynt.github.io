;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Fixed numbers and tables: canvas size, physics, bird, course, power-ups, medals, modes,
     the Stage Clear panel, the Nest tree and the state names. Read-only. */

  const STORAGE_KEY = 'sz-flappy-bird-highscores';
  const SAVE_KEY_V2 = 'sz-flappy-bird-save-v2';
  const SAVE_KEY = 'sz-flappy-bird-save-v3';
  const RUN_KEY = 'sz-flappy-bird-run-v1';
  const MAX_HIGH_SCORES = 5;
  const MAX_ARCADE_SCORES = 10;
  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  const MAX_DT = 0.05;
  const AUTOSAVE_EVERY = 3;         // seconds between run snapshots while flying

  /* Physics */
  const GRAVITY = 0.48;
  const FLAP_IMPULSE = -9;
  const TERMINAL_VELOCITY = 14.4;

  /* Bird */
  const BIRD_X = 360;
  const BIRD_W = 41;
  const BIRD_H = 29;
  const BIRD_RADIUS = 14;           // circular hitbox
  const COIN_RADIUS = 26;           // pickup distance
  const INVULN_TIME = 1.2;
  const TIME_ATTACK_SECONDS = 60;

  /* Course */
  const GROUND_Y = SZ.FlappyCourse.GROUND_Y;
  const GATE_W = SZ.FlappyCourse.GATE_W;
  const CAP_EXTRA_W = 8;            // gate caps stick out this far on each side
  const CAP_H = 30;                 // gate cap height at the gap ends
  const LEVELUP_INTERVAL = 12;

  /* Power-ups: twelve bubbles. The timed ones count down in G.power, shield and heart are
     instant, blast keeps charges. */
  const POWERS = [
    { id: 'shield', name: 'Shield', color: '#4aa3ff', desc: 'Eats the next hit.' },
    { id: 'magnet', name: 'Magnet', color: '#ff4a4a', desc: 'Pulls nearby coins in.', time: 8 },
    { id: 'slow', name: 'Slow-Mo', color: '#b06aff', desc: 'The whole world slows down.', time: 5 },
    { id: 'ghost', name: 'Ghost', color: '#bff4ff', desc: 'Pass through anything but the ground.', time: 4 },
    { id: 'double', name: 'Double Coins', color: '#ffc21a', desc: 'Every coin pays twice.', time: 10 },
    { id: 'tiny', name: 'Tiny', color: '#5ad06a', desc: 'The bird and its hitbox shrink.', time: 8 },
    { id: 'blast', name: 'Rocket Beak', color: '#ff7a2a', desc: 'Smash straight through the next pipes.', time: 10 },
    { id: 'rush', name: 'Sky Rush', color: '#ff4ad8', desc: 'Autopilot dash through the gaps, untouchable.', time: 4 },
    { id: 'heart', name: 'Extra Heart', color: '#ff5a6a', desc: 'One more heart for this run.' },
    { id: 'freeze', name: 'Frost Time', color: '#8ae8ff', desc: 'Moving pipes and hazards freeze.', time: 6 },
    { id: 'gold', name: 'Gold Rush', color: '#ffe14a', desc: 'Every pipe you pass showers coins.', time: 8 },
    { id: 'buddy', name: 'Wingmate', color: '#7ad85a', desc: 'A friend flies along and grabs coins.', time: 12 }
  ];
  const POWER_BY_ID = {};
  for (let i = 0; i < POWERS.length; ++i)
    POWER_BY_ID[POWERS[i].id] = POWERS[i];
  const POWER_TIMED = POWERS.filter(p => p.time).map(p => p.id);
  const BUBBLE_COLORS = {};
  const POWER_NAMES = {};
  for (let i = 0; i < POWERS.length; ++i) {
    BUBBLE_COLORS[POWERS[i].id] = POWERS[i].color;
    POWER_NAMES[POWERS[i].id] = POWERS[i].name.toUpperCase() + '!';
  }

  /* Medal tiers */
  const MEDAL_TIERS = [
    { name: 'Platinum', min: 100, color: '#e5e4e2' },
    { name: 'Gold', min: 50, color: '#ffd700' },
    { name: 'Silver', min: 25, color: '#c0c0c0' },
    { name: 'Bronze', min: 10, color: '#cd7f32' }
  ];

  /* Modes: the card text and the rule switches every system reads */
  const MODES = {
    adventure: { name: 'Story', short: 'Story', desc: 'Six lands, 24 stages, six bosses.', coinRate: 1 },
    classic: { name: 'Classic', short: 'Classic', desc: 'The original: endless pipes, one score, medals.', coinRate: 1 },
    arcade: { name: 'Arcade', short: 'Arcade', desc: 'Score attack: multiplier, fever, crows and lots of power-ups.', coinRate: 1, bubbleEvery: 4 },
    zen: { name: 'Zen', short: 'Zen', desc: 'No crashes, wide gaps, soft chimes. Just fly.', coinRate: 0.5, bubbleEvery: 6 },
    time: { name: 'Time Attack', short: 'Time', desc: '60 seconds on the clock; every hit costs 3.', coinRate: 1 },
    daily: { name: 'Daily Challenge', short: 'Daily', desc: 'Today\'s course and twist, the same for everyone.', coinRate: 1.25 },
    bossrush: { name: 'Boss Rush', short: 'Boss Rush', desc: 'Every boss you have beaten, back to back.', coinRate: 1 }
  };
  const MODE_ORDER = ['classic', 'arcade', 'zen', 'time', 'daily', 'bossrush'];

  /* Arcade scoring */
  const ARCADE = { gate: 100, perfect: 50, coin: 10, close: 25, token: 40, multEvery: 5, multMax: 8 };
  const FEVER_TIME = 6;

  /* Stage Clear panel — the height is the sum of the blocks it draws */
  const CLEAR_PW = 420;
  const CLEAR_HEAD_H = 36, CLEAR_STARS_H = 96, CLEAR_PAD_H = 14;
  const CLEAR_LINES_H = 32 + 28 + 26 + 30 + 28;   // coins, earned, total, hits, combo
  const CLEAR_PH = CLEAR_HEAD_H + CLEAR_STARS_H + CLEAR_LINES_H + CLEAR_PAD_H;
  const CLEAR_STAR_CY = CLEAR_HEAD_H + CLEAR_STARS_H / 2;

  /* Nest tech tree: six branches, every node has levels with rising costs */
  const TREE_BRANCHES = [
    { id: 'wings', name: 'Wings', color: '#5ab8ff' },
    { id: 'armor', name: 'Armor', color: '#6fe08a' },
    { id: 'magnet', name: 'Magnet', color: '#ffd23f' },
    { id: 'power', name: 'Power', color: '#c04cff' },
    { id: 'spirit', name: 'Spirit', color: '#ff7a3a' },
    { id: 'fortune', name: 'Fortune', color: '#3ae0c8' }
  ];

  const TREE = [
    { id: 'w_light', branch: 'wings', name: 'Light Feathers', desc: 'Gravity 4% weaker per level', costs: [150, 300, 600], req: [] },
    { id: 'w_glide', branch: 'wings', name: 'Glide', desc: 'Hold flap while falling to sink 35% slower', costs: [800], req: [['w_light', 1]] },
    { id: 'w_wind', branch: 'wings', name: 'Storm Rider', desc: 'Wind gusts push 40% less per level', costs: [400, 900], req: [['w_light', 1]] },
    { id: 'w_rush', branch: 'wings', name: 'Jet Stream', desc: 'Sky Rush lasts 1 s longer per level', costs: [500, 1100], req: [['w_glide', 1]] },
    { id: 'a_heart', branch: 'armor', name: 'Extra Heart', desc: '+1 heart per level', costs: [500, 1500], req: [] },
    { id: 'a_shield', branch: 'armor', name: 'Starting Shield', desc: 'Start every run with a shield', costs: [1200], req: [['a_heart', 1]] },
    { id: 'a_down', branch: 'armor', name: 'Thick Down', desc: '+0.4 s safety after a hit per level', costs: [300, 700], req: [['a_heart', 1]] },
    { id: 'a_crow', branch: 'armor', name: 'Crow Scarer', desc: 'Storm crows dive 20% slower per level', costs: [450, 950], req: [['a_down', 1]] },
    { id: 'm_magnet', branch: 'magnet', name: 'Coin Magnet', desc: 'Always pull in coins within 60 px per level', costs: [200, 450, 900], req: [] },
    { id: 'm_value', branch: 'magnet', name: 'Golden Touch', desc: '+10% coins per level', costs: [400, 900, 1600], req: [['m_magnet', 1]] },
    { id: 'm_super', branch: 'magnet', name: 'Super Magnet', desc: 'Magnet power-up range +50% per level', costs: [500, 1000], req: [['m_magnet', 2]] },
    { id: 'm_gold', branch: 'magnet', name: 'Mother Lode', desc: 'Gold Rush pays +2 coins per pipe per level', costs: [600, 1300], req: [['m_value', 1]] },
    { id: 'p_long', branch: 'power', name: 'Long Lasting', desc: 'Power-ups last 20% longer per level', costs: [300, 650, 1200], req: [] },
    { id: 'p_more', branch: 'power', name: 'Bubble Luck', desc: 'Power-up bubbles 25% more often per level', costs: [600, 1300], req: [['p_long', 1]] },
    { id: 'p_kit', branch: 'power', name: 'Starter Kit', desc: 'Begin every run with a random power-up', costs: [2000], req: [['p_long', 2], ['p_more', 1]] },
    { id: 'p_blast', branch: 'power', name: 'Hard Beak', desc: 'Rocket Beak smashes 1 more pipe per level', costs: [450, 900], req: [['p_long', 1]] },
    { id: 'p_freeze', branch: 'power', name: 'Deep Frost', desc: 'Frost Time lasts 1.5 s longer per level', costs: [400, 850], req: [['p_long', 1]] },
    { id: 'p_buddy', branch: 'power', name: 'Loyal Wingmate', desc: 'The Wingmate takes one hit for you', costs: [1500], req: [['p_more', 1]] },
    { id: 's_eye', branch: 'spirit', name: 'Eagle Eye', desc: 'Perfect zone 15% wider per level', costs: [250, 550, 1000], req: [] },
    { id: 's_keep', branch: 'spirit', name: 'Combo Keeper', desc: 'An imperfect pass keeps the combo, once per level each run', costs: [700, 1500], req: [['s_eye', 1]] },
    { id: 's_phoenix', branch: 'spirit', name: 'Phoenix Feather', desc: 'Come back to life once per run', costs: [3000], req: [['s_eye', 2]] },
    { id: 's_fever', branch: 'spirit', name: 'Fever Pitch', desc: 'The fever meter fills 25% faster per level', costs: [350, 750, 1400], req: [['s_eye', 1]] },
    { id: 'f_quest', branch: 'fortune', name: 'Quest Hunter', desc: 'Daily quest rewards +25% per level', costs: [300, 700], req: [] },
    { id: 'f_streak', branch: 'fortune', name: 'Homing Instinct', desc: 'Daily streak bonus +50% per level', costs: [400, 900], req: [['f_quest', 1]] },
    { id: 'f_season', branch: 'fortune', name: 'Festive Spirit', desc: 'Seasonal tokens count 50% more per level', costs: [500, 1100], req: [['f_quest', 1]] },
    { id: 'f_boss', branch: 'fortune', name: 'Sun Caller', desc: 'Sun orbs come 15% more often in boss fights per level', costs: [600, 1200], req: [['f_streak', 1]] },
    { id: 'f_egg', branch: 'fortune', name: 'Nest Egg', desc: 'Every run pays 2% interest on banked coins (up to 60 per level)', costs: [800, 1800], req: [['f_season', 1]] }
  ];

  /* States */
  const STATE_TITLE = 'TITLE';
  const STATE_WORLDS = 'WORLDS';
  const STATE_MODES = 'MODES';
  const STATE_NEST = 'NEST';
  const STATE_AVIARY = 'AVIARY';    // the Wardrobe screen
  const STATE_GOALS = 'GOALS';
  const STATE_HELP = 'HELP';
  const STATE_CINE = 'CINE';
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DYING = 'DYING';
  const STATE_DEAD = 'DEAD';
  const STATE_CLEAR = 'CLEAR';      // adventure stage finished

  const MENU_STATES = [STATE_TITLE, STATE_WORLDS, STATE_MODES, STATE_NEST, STATE_AVIARY, STATE_GOALS, STATE_HELP];

  Object.assign(NS.C, {
    STORAGE_KEY, SAVE_KEY_V2, SAVE_KEY, RUN_KEY, MAX_HIGH_SCORES, MAX_ARCADE_SCORES, CANVAS_W, CANVAS_H, MAX_DT,
    AUTOSAVE_EVERY, GRAVITY, FLAP_IMPULSE, TERMINAL_VELOCITY, BIRD_X, BIRD_W, BIRD_H, BIRD_RADIUS, COIN_RADIUS,
    INVULN_TIME, TIME_ATTACK_SECONDS, GROUND_Y, GATE_W, CAP_EXTRA_W, CAP_H, LEVELUP_INTERVAL, POWERS, POWER_BY_ID,
    POWER_TIMED, BUBBLE_COLORS, POWER_NAMES, MEDAL_TIERS, MODES, MODE_ORDER, ARCADE, FEVER_TIME, CLEAR_PW,
    CLEAR_HEAD_H, CLEAR_STARS_H, CLEAR_PAD_H, CLEAR_LINES_H, CLEAR_PH, CLEAR_STAR_CY, TREE_BRANCHES, TREE,
    STATE_TITLE, STATE_WORLDS, STATE_MODES, STATE_NEST, STATE_AVIARY, STATE_GOALS, STATE_HELP, STATE_CINE,
    STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR, MENU_STATES
  });
})();
