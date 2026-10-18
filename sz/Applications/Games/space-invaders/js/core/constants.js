/* Fixed numbers of the game: field and sprite sizes, speeds, timings, bunker shape.
   Owns no state, reads nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});

  const GAME_W = 1280;
  const GAME_H = 720;

  const ALIEN_W = 36;
  const ALIEN_H = 27;
  const ALIEN_PAD_X = 18;
  const ALIEN_PAD_Y = 15;

  const PLAYER_W = 45;
  const PLAYER_H = 24;
  const PLAYER_SPEED = 6;
  const PLAYER_Y_OFFSET = 60;

  const BULLET_W = 4;
  const BULLET_H = 15;
  const BULLET_SPEED = 10.5;
  const LASER_W = 9;

  const ALIEN_BULLET_SPEED = 4.5;
  const ALIEN_BULLET_W = 4;
  const ALIEN_BULLET_H = 18;

  const SHIELD_COUNT = 5;
  const SHIELD_BLOCK_SIZE = 6;
  const SHIELD_COLS = 16;
  const SHIELD_ROWS = 12;
  const SHIELD_Y_OFFSET = 120;

  const UFO_W = 48;
  const UFO_H = 21;
  const UFO_SPEED = 3;
  const UFO_MIN_INTERVAL = 10000;
  const UFO_MAX_INTERVAL = 25000;

  const BOSS_W = 180;
  const BOSS_H = 90;
  /* The painted boss art is a fixed 120 x 60 box, scaled up into the boss box */
  const BOSS_SPRITE_W = 120;
  const BOSS_SPRITE_H = 60;
  const BOSS_ESCORT_MIN_Y = 280;
  const BOSS_BASE_HP = 15;
  const BOSS_HP_PER_BOSS = 5;

  const DRONE_W = 24;
  const DRONE_H = 15;
  const DRONE_SHOOT_INTERVAL = 800;

  const ALIEN_DROP = 18;
  const BASE_MOVE_INTERVAL = 800;
  const MIN_MOVE_INTERVAL = 60;

  const POWERUP_SIZE = 24;
  const POWERUP_FALL_SPEED = 1.8;
  const POWERUP_DROP_CHANCE = 0.08;
  const POWERUP_DROP_CHANCE_SPECIAL = 0.20;

  const COMBO_TIMEOUT = 1500;
  const COMBO_MULTIPLIERS = [1, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5];

  /* Death cry pitch per species, so the fleet sounds different kill by kill */
  const SPECIES_DEATH_PITCH = { 1: 1.2, 2: 1.05, 3: 0.95, 4: 1.3, 5: 1.1, 6: 0.8 };

  const THEME_ORDER = ['moon', 'mars', 'asteroids', 'jupiter', 'saturn', 'mothership'];
  const MARCH_PITCHES = [1, 0.89, 0.79, 0.75];
  const SPECIES_FLARE = { 1: 'orange', 2: 'orange', 3: 'cyan', 4: 'orange', 5: 'cyan', 6: 'white' };

  const COMBO_COLORS = { 2: '#5af2ff', 3: '#5ae06a', 4: '#ffd23f', 5: '#ff4a5a' };

  /* Simulation runs in fixed 60 Hz steps regardless of display refresh rate */
  const SIM_STEP = 1000 / 60;
  const SIM_MAX_STEPS = 3;
  const SIM_SNAP = 0.5;

  /* One bunker as a block mask, 16 x 12 blocks */
  const SHIELD_SHAPE = [
    [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1],
    [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1],
  ];

  /* Energy-crystal wall: one precomputed colour per bunker row, top to bottom */
  const BUNKER_ROW_COLORS = (function() {
    const top = [0x5a, 0xf2, 0xff];
    const bot = [0x1a, 0x8a, 0xa8];
    const out = [];
    for (let r = 0; r < SHIELD_ROWS; ++r) {
      const t = r / (SHIELD_ROWS - 1);
      out.push('rgb(' + top.map((v, k) => Math.round(v + (bot[k] - v) * t)).join(',') + ')');
    }
    return out;
  })();

  Object.assign(NS.constants, {
    GAME_W, GAME_H, ALIEN_W, ALIEN_H, ALIEN_PAD_X, ALIEN_PAD_Y, PLAYER_W, PLAYER_H, PLAYER_SPEED,
    PLAYER_Y_OFFSET, BULLET_W, BULLET_H, BULLET_SPEED, LASER_W, ALIEN_BULLET_SPEED, ALIEN_BULLET_W,
    ALIEN_BULLET_H, SHIELD_COUNT, SHIELD_BLOCK_SIZE, SHIELD_COLS, SHIELD_ROWS, SHIELD_Y_OFFSET, UFO_W, UFO_H,
    UFO_SPEED, UFO_MIN_INTERVAL, UFO_MAX_INTERVAL, BOSS_W, BOSS_H, BOSS_SPRITE_W, BOSS_SPRITE_H,
    BOSS_ESCORT_MIN_Y, BOSS_BASE_HP, BOSS_HP_PER_BOSS, DRONE_W, DRONE_H, DRONE_SHOOT_INTERVAL, ALIEN_DROP,
    BASE_MOVE_INTERVAL, MIN_MOVE_INTERVAL, POWERUP_SIZE, POWERUP_FALL_SPEED, POWERUP_DROP_CHANCE,
    POWERUP_DROP_CHANCE_SPECIAL, COMBO_TIMEOUT, COMBO_MULTIPLIERS, SPECIES_DEATH_PITCH, THEME_ORDER,
    MARCH_PITCHES, SPECIES_FLARE, COMBO_COLORS, SIM_STEP, SIM_MAX_STEPS, SIM_SNAP, SHIELD_SHAPE,
    BUNKER_ROW_COLORS
  });
})();
