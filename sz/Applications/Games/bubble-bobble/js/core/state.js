/* S, the one shared mutable state object: the run state and score/lives/level, the
   player, the bubbles/enemies/items/platforms/power-ups, the power-up and level-flow
   flags, the input map, the tutorial bookkeeping, the loop clock and the fixed
   background sparkle dots (seeded once, at load). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;

  NS.state = NS.state || {
    /* Game state */
    state: C.STATE_READY,
    score: 0,
    lives: C.MAX_LIVES,
    popCombo: 0,
    lastPopTime: 0,
    currentLevel: 1,
    highScores: [],

    /* Player */
    player: {
      x: 32, y: 384, vx: 0, vy: 0,
      w: 24, h: 24,
      facingRight: true,
      grounded: false,
      isJumping: false,
      animFrame: 0,
      animTimer: 0,
      alive: true,
      invincible: 0
    },

    /* Bubbles, enemies, items, platforms, power-ups */
    bubbles: [],
    enemies: [],
    items: [],
    platforms: [],
    powerUps: [],
    shootCooldown: 0,

    /* Power-up state */
    powerUpSpeed: false,
    powerUpRange: false,
    powerUpTimer: 0,

    /* Level flow properties */
    levelFlow: { windX: 0, floatSpeed: 1.0 },

    /* Input */
    keysDown: {},

    /* Tutorial */
    tutorialSeen: false,
    showTutorial: false,
    tutorialPage: 0,

    /* Loop clock */
    lastTime: 0,

    /* Background sparkle dots — fixed random positions with unique seeds */
    sparkles: []
  };

  const S = NS.state;
  for (let i = 0; i < 25; ++i)
    S.sparkles.push({ x: Math.random() * C.CANVAS_W, y: Math.random() * C.CANVAS_H, seed: Math.random() * Math.PI * 2 });
})();
