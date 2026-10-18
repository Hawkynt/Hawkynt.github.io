;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Fixed numbers and tables: canvas size, physics, bird, course, power-ups, medals,
     the Stage Clear panel, the Nest tree, the Aviary birds and the state names. Read-only. */

  const STORAGE_KEY = 'sz-flappy-bird-highscores';
  const SAVE_KEY = 'sz-flappy-bird-save-v2';
  const MAX_HIGH_SCORES = 5;
  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  const MAX_DT = 0.05;

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

  /* Power-ups */
  const BUBBLE_COLORS = { shield: '#4aa3ff', magnet: '#ff4a4a', slow: '#b06aff', ghost: '#bff4ff', double: '#ffc21a', tiny: '#5ad06a' };
  const POWER_NAMES = { shield: 'SHIELD!', magnet: 'MAGNET!', slow: 'SLOW-MO!', ghost: 'GHOST!', double: 'DOUBLE COINS!', tiny: 'TINY!' };
  const POWER_TIMED = ['magnet', 'slow', 'ghost', 'double', 'tiny'];

  /* Medal tiers */
  const MEDAL_TIERS = [
    { name: 'Platinum', min: 100, color: '#e5e4e2' },
    { name: 'Gold', min: 50, color: '#ffd700' },
    { name: 'Silver', min: 25, color: '#c0c0c0' },
    { name: 'Bronze', min: 10, color: '#cd7f32' }
  ];

  /* Stage Clear panel — the height is the sum of the blocks it draws */
  const CLEAR_PW = 420;
  const CLEAR_HEAD_H = 36, CLEAR_STARS_H = 96, CLEAR_PAD_H = 14;
  const CLEAR_LINES_H = 32 + 28 + 26 + 30 + 28;   // coins, earned, total, hits, combo
  const CLEAR_PH = CLEAR_HEAD_H + CLEAR_STARS_H + CLEAR_LINES_H + CLEAR_PAD_H;
  const CLEAR_STAR_CY = CLEAR_HEAD_H + CLEAR_STARS_H / 2;

  /* Nest tech tree */
  const TREE_BRANCHES = [
    { id: 'wings', name: 'Wings', color: '#5ab8ff' },
    { id: 'armor', name: 'Armor', color: '#6fe08a' },
    { id: 'magnet', name: 'Magnet', color: '#ffd23f' },
    { id: 'power', name: 'Power', color: '#c04cff' },
    { id: 'spirit', name: 'Spirit', color: '#ff7a3a' }
  ];

  const TREE = [
    { id: 'w_light', branch: 'wings', name: 'Light Feathers', desc: 'Gravity 4% weaker per level', costs: [150, 300, 600], req: [] },
    { id: 'w_glide', branch: 'wings', name: 'Glide', desc: 'Hold flap while falling to sink 35% slower', costs: [800], req: [['w_light', 1]] },
    { id: 'w_wind', branch: 'wings', name: 'Storm Rider', desc: 'Wind gusts push 40% less per level', costs: [400, 900], req: [['w_light', 1]] },
    { id: 'a_heart', branch: 'armor', name: 'Extra Heart', desc: '+1 heart per level', costs: [500, 1500], req: [] },
    { id: 'a_shield', branch: 'armor', name: 'Starting Shield', desc: 'Start every run with a shield', costs: [1200], req: [['a_heart', 1]] },
    { id: 'a_down', branch: 'armor', name: 'Thick Down', desc: '+0.4 s safety after a hit per level', costs: [300, 700], req: [['a_heart', 1]] },
    { id: 'm_magnet', branch: 'magnet', name: 'Coin Magnet', desc: 'Always pull in coins within 60 px per level', costs: [200, 450, 900], req: [] },
    { id: 'm_value', branch: 'magnet', name: 'Golden Touch', desc: '+10% coins per level', costs: [400, 900, 1600], req: [['m_magnet', 1]] },
    { id: 'm_super', branch: 'magnet', name: 'Super Magnet', desc: 'Magnet power-up range +50% per level', costs: [500, 1000], req: [['m_magnet', 2]] },
    { id: 'p_long', branch: 'power', name: 'Long Lasting', desc: 'Power-ups last 20% longer per level', costs: [300, 650, 1200], req: [] },
    { id: 'p_more', branch: 'power', name: 'Bubble Luck', desc: 'Power-up bubbles 25% more often per level', costs: [600, 1300], req: [['p_long', 1]] },
    { id: 'p_kit', branch: 'power', name: 'Starter Kit', desc: 'Begin every run with a random power-up', costs: [2000], req: [['p_long', 2], ['p_more', 1]] },
    { id: 's_eye', branch: 'spirit', name: 'Eagle Eye', desc: 'Perfect zone 15% wider per level', costs: [250, 550, 1000], req: [] },
    { id: 's_keep', branch: 'spirit', name: 'Combo Keeper', desc: 'An imperfect pass keeps the combo, once per level each run', costs: [700, 1500], req: [['s_eye', 1]] },
    { id: 's_phoenix', branch: 'spirit', name: 'Phoenix Feather', desc: 'Come back to life once per run', costs: [3000], req: [['s_eye', 2]] }
  ];

  /* Aviary birds — the art lives in SZ.FlappyBirdArt.BIRDS */
  const BIRD_DEFS = [
    { id: 'sunny', perk: 'Balanced all-rounder', price: 0 },
    { id: 'ruby', perk: 'Light: gravity 6% weaker', price: 400 },
    { id: 'jay', perk: 'Shiny eyes: +50 px coin magnet', price: 900 },
    { id: 'pip', perk: 'Lucky: +15% coins', unlock: '2-4' },
    { id: 'snowy', perk: 'Tough: +1 heart', unlock: '4-4' },
    { id: 'phoenix', perk: 'Reborn: revive once per run', unlock: '6-4' }
  ];

  /* States */
  const STATE_TITLE = 'TITLE';
  const STATE_WORLDS = 'WORLDS';
  const STATE_NEST = 'NEST';
  const STATE_AVIARY = 'AVIARY';
  const STATE_HELP = 'HELP';
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DYING = 'DYING';
  const STATE_DEAD = 'DEAD';
  const STATE_CLEAR = 'CLEAR';      // adventure stage finished

  Object.assign(NS.C, {
    STORAGE_KEY, SAVE_KEY, MAX_HIGH_SCORES, CANVAS_W, CANVAS_H, MAX_DT, GRAVITY, FLAP_IMPULSE,
    TERMINAL_VELOCITY, BIRD_X, BIRD_W, BIRD_H, BIRD_RADIUS, COIN_RADIUS, INVULN_TIME, TIME_ATTACK_SECONDS,
    GROUND_Y, GATE_W, CAP_EXTRA_W, CAP_H, LEVELUP_INTERVAL, BUBBLE_COLORS, POWER_NAMES, POWER_TIMED,
    MEDAL_TIERS, CLEAR_PW, CLEAR_HEAD_H, CLEAR_STARS_H, CLEAR_PAD_H, CLEAR_LINES_H, CLEAR_PH, CLEAR_STAR_CY,
    TREE_BRANCHES, TREE, BIRD_DEFS, STATE_TITLE, STATE_WORLDS, STATE_NEST, STATE_AVIARY, STATE_HELP,
    STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR
  });
})();
