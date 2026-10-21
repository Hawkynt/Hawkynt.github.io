/* S, the one shared mutable state object: the run's state/distance/score/coins/speed,
   the high scores, the player lane/jump/slide bookkeeping, the entity lists, the
   power-up timers, the rendering bookkeeping and the tutorial page. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const C = NS.constants;

  NS.state = NS.state || {
    /* ── Effects bookkeeping ── */
    coinStreak: 0,
    lastCoinTime: 0,
    lastTierName: '',

    /* ── Tutorial ── */
    tutorialSeen: false,
    showTutorial: false,
    tutorialPage: 0,

    /* ── Game State ── */
    state: C.STATE_READY,
    distance: 0,
    score: 0,
    coinCount: 0,
    totalCoins: 0,
    currentSpeed: C.BASE_SPEED,
    highScores: [],

    /* Player */
    targetLane: 1,
    currentLane: 1,
    laneTransitionTimer: 0,
    previousLane: 1,
    transitionStartX: 200,
    isJumping: false,
    jumpTimer: 0,
    isSliding: false,
    slideTimer: 0,

    /* Entities */
    obstacles: [],
    coins: [],
    powerUps: [],
    speedLines: [],
    lastSpawnZ: 0,

    /* Power-up timers */
    magnetTimer: 0,
    shieldTimer: 0,
    multiplierTimer: 0,

    /* Rendering */
    animFrameId: null,
    lastTimestamp: 0,
    roadOffset: 0,
    skylineOffset: 0,

    /* Dust puffs for running effect */
    dustPuffs: []
  };
})();
