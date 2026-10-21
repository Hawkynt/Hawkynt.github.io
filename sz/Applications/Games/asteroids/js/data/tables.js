/* Data tables: game mode configurations, rock types with their palettes,
   enemy ship definitions and the weighted powerup pool. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  /* ---- Mode Configurations ---- */
  const MODE_CONFIGS = {
    classic: {
      lives: 3, label: 'Classic', asteroidSpeedMult: 1, ufoInterval: 15000,
      ufoShootInterval: 2000, extraAsteroids: 0, scoreMult: 1, bonusLifeEvery: 10000,
      description: '3 lives · progressive levels'
    },
    survival: {
      lives: 1, label: 'Survival', asteroidSpeedMult: 1, ufoInterval: 12000,
      ufoShootInterval: 1800, extraAsteroids: 0, scoreMult: 1, spawnInterval: 8000,
      description: '1 life · endless waves'
    },
    zen: {
      lives: Infinity, label: 'Zen', asteroidSpeedMult: 0.85, ufoInterval: 20000,
      ufoShootInterval: 2500, extraAsteroids: 0, scoreMult: 1, timeLimit: 180000,
      description: 'Infinite lives · 3-min timer'
    },
    hardcore: {
      lives: 1, label: 'Hardcore', asteroidSpeedMult: 1.5, ufoInterval: 8000,
      ufoShootInterval: 1400, extraAsteroids: 2, scoreMult: 2, bonusLifeEvery: 0,
      description: '1 life · 1.5× speed · 2× score'
    }
  };

  /* ---- Rock Types ---- */
  const ROCK_TYPES = {
    normal:    { hp: 1, pointsMult: 1,   minLevel: 1,  glow: null },
    iron:      { hp: 2, pointsMult: 1.5, minLevel: 3,  glow: '#aaaacc' },
    crystal:   { hp: 3, pointsMult: 2,   minLevel: 6,  glow: '#44aaff' },
    exploding: { hp: 2, pointsMult: 1.5, minLevel: 9,  glow: '#ff6600' },
    ice:       { hp: 2, pointsMult: 1.5, minLevel: 12, glow: '#88ddff' },
    lava:      { hp: 3, pointsMult: 2,   minLevel: 15, glow: '#ff4400' },
    electric:  { hp: 2, pointsMult: 2,   minLevel: 18, glow: '#ffff66' }
  };

  const ROCK_TYPE_PALETTES = {
    normal: [
      { light: '#9b8365', dark: '#4a3a25', edge: '#b09575' },
      { light: '#8b6050', dark: '#4a2a20', edge: '#a07060' },
      { light: '#8a8a70', dark: '#454530', edge: '#a0a085' }
    ],
    iron: [
      { light: '#8888a0', dark: '#444460', edge: '#aaaacc' },
      { light: '#909098', dark: '#505058', edge: '#b0b0b8' },
      { light: '#787890', dark: '#3a3a50', edge: '#9898b0' }
    ],
    crystal: [
      { light: '#708899', dark: '#354455', edge: '#88bbdd' },
      { light: '#6090a0', dark: '#304050', edge: '#70aabb' },
      { light: '#8060a0', dark: '#402060', edge: '#a080cc' }
    ],
    exploding: [
      { light: '#cc5522', dark: '#661100', edge: '#ff7733' },
      { light: '#bb4411', dark: '#551100', edge: '#ee6622' },
      { light: '#dd6633', dark: '#772200', edge: '#ff8844' }
    ],
    ice: [
      { light: '#aaddee', dark: '#556688', edge: '#cceeFF' },
      { light: '#99ccdd', dark: '#445577', edge: '#bbddee' },
      { light: '#bbddff', dark: '#667799', edge: '#ddeeff' }
    ],
    lava: [
      { light: '#554433', dark: '#221100', edge: '#776655' },
      { light: '#443322', dark: '#110800', edge: '#665544' },
      { light: '#665544', dark: '#332211', edge: '#887766' }
    ],
    electric: [
      { light: '#cccc88', dark: '#666644', edge: '#eeeeaa' },
      { light: '#bbbb77', dark: '#555533', edge: '#dddd99' },
      { light: '#ddddaa', dark: '#777755', edge: '#ffffcc' }
    ]
  };

  /* ---- Enemy Types ---- */
  const ENEMY_TYPES = {
    ufo:       { radius: 18, points: 200,  hp: 1, minLevel: 1,  color: '#00ff88' },
    ufoSmall:  { radius: 10, points: 1000, hp: 1, minLevel: 1,  color: '#00ff88' },
    drone:     { radius: 8,  points: 150,  hp: 1, minLevel: 5,  color: '#ff4444' },
    gunship:   { radius: 16, points: 500,  hp: 3, minLevel: 8,  color: '#88ff44' },
    minelayer: { radius: 14, points: 300,  hp: 2, minLevel: 11, color: '#ffcc00' },
    stealth:   { radius: 12, points: 800,  hp: 2, minLevel: 14, color: '#aa44ff' },
    boss:      { radius: 28, points: 2000, hp: 8, minLevel: 10, color: '#ff44ff' }
  };

  /* ---- Powerup Definitions ---- */
  const POWERUP_TYPES = {
    shield:    { icon: 'S', color: '#44aaff', label: 'Shield',       duration: 15000, weight: 22 },
    triple:    { icon: 'T', color: '#ff8844', label: 'Triple Shot',   duration: 12000, weight: 16 },
    rapid:     { icon: 'R', color: '#ff4444', label: 'Rapid Fire',    duration: 12000, weight: 16 },
    piercing:  { icon: 'P', color: '#aa44ff', label: 'Piercing',      duration: 10000, weight: 12 },
    spread:    { icon: 'W', color: '#44ffaa', label: 'Spread Shot',   duration: 10000, weight: 10 },
    homing:    { icon: 'H', color: '#00ffff', label: 'Homing',        duration: 10000, weight: 5  },
    extraLife: { icon: '+', color: '#44ff44', label: 'Extra Life',     duration: 0,     weight: 10 },
    nuke:      { icon: 'N', color: '#ffff44', label: 'Nuke',          duration: 0,     weight: 9  }
  };

  const DURATION_POWERUPS = ['shield', 'triple', 'rapid', 'piercing', 'spread', 'homing'];

  const POWERUP_POOL = [];
  for (const [key, def] of Object.entries(POWERUP_TYPES))
    for (let i = 0; i < def.weight; ++i)
      POWERUP_POOL.push(key);

  /* ---- Star Colors ---- */
  const STAR_COLORS = ['#fff', '#fff', '#fff', '#aaccff', '#ffddaa', '#fff', '#ffcccc', '#ccddff'];

  Object.assign(NS.tables, {
    MODE_CONFIGS, ROCK_TYPES, ROCK_TYPE_PALETTES, ENEMY_TYPES,
    POWERUP_TYPES, DURATION_POWERUPS, POWERUP_POOL, STAR_COLORS
  });
})();
