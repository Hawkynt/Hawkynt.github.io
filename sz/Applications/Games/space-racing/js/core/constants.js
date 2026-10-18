/*
 * Constants: canvas size, screen states, storage keys and every tuning number of
 * physics, drifting, slipstream, AI, items and rewards. Owns no state, reads nothing.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceRacing || (SZ.SpaceRacing = {});

  /* one shared object per module; created on first use so modules can name each other in any load order */
  NS.module = function(name) {
    return NS[name] || (NS[name] = {});
  };

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

  const AMBIENCE_MAX = 40;

  const TREE_CARD_W = 300, TREE_CARD_H = 120, TREE_COL_GAP = 90, TREE_ROW_GAP = 26;

  Object.assign(NS.module('constants'), {
    _hexAlpha, CANVAS_W, CANVAS_H, MAX_DT, TWO_PI, STATE_TITLE, STATE_CAREER, STATE_CUP_INTRO, STATE_TRACKS,
    STATE_GARAGE, STATE_TREE, STATE_PLAYING, STATE_PAUSED, STATE_RESULTS, STATE_STANDINGS, STORAGE_PREFIX,
    STORAGE_HIGHSCORES, STORAGE_CREDITS, STORAGE_UPGRADES, STORAGE_SELECTED_SHIP, STORAGE_TUTORIAL,
    STORAGE_SAVE, MAX_HIGH_SCORES, GRAVITY_CONSTANT, GRAVITY_MIN_DIST, GRAVITY_MAX_DIST, WORMHOLE_RADIUS,
    WORMHOLE_COOLDOWN, BASE_ACCEL, BASE_BRAKE, SHIP_FRICTION, BASE_TURN_SPEED, BASE_MAX_SPEED, SHIP_RADIUS,
    BASE_BOOST_MULT, BASE_BOOST_DURATION, COUNTDOWN_TIME, PERFECT_START_WINDOW, EARLY_THROTTLE_WINDOW,
    STALL_DURATION, BOOST_METER_MAX, BOOST_COST, DRIFT_MIN_SPEED, DRIFT_TURN_MULT, DRIFT_TIER1, DRIFT_TIER2,
    DRIFT_ACCEL_MULT, DRIFT_METER_RATE, SLIPSTREAM_RANGE, SLIPSTREAM_CONE, SLIPSTREAM_MIN_SPEED,
    SLIP_METER_RATE, SLIP_SPEED_MULT, NUM_OPPONENTS, AI_BASE_ACCEL, AI_BASE_TURN_SPEED, AI_SPEED_VARIANCE,
    AI_REACTION_DELAY, AI_MISTAKE_CHANCE, AI_MISTAKE_DURATION, AI_BRAKE_ON_TURN_THRESHOLD, AI_BRAKE_FACTOR,
    ITEM_BOX_RADIUS, ITEM_BOX_RESPAWN, ITEM_LATERAL, ITEM_NAMES, ITEM_LABELS, ITEM_WEIGHTS, MISSILE_SPEED,
    MISSILE_TURN, MISSILE_LIFE, MISSILE_HIT, MINE_ARM_TIME, MINE_LIFE, MINE_RADIUS, EMP_RADIUS, SHIELD_TIME,
    SPIN_RATE, CREDITS_1ST, CREDITS_2ND, CREDITS_3RD, CREDITS_4TH, REWARD_PERFECT_START, REWARD_MEGA_TURBO,
    REWARD_HIT, REWARD_CLEAN_RACE, AMBIENCE_MAX, TREE_CARD_W, TREE_CARD_H, TREE_COL_GAP, TREE_ROW_GAP
  });
})();
