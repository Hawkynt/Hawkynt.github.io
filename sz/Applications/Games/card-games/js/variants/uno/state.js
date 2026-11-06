/* Uno: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* -- Game state -- */
  const unoColors = ['red', 'blue', 'green', 'yellow'];
  const swapChoiceRects = [];
  const AI_TURN_DELAY = 0.8;
  const NUM_PLAYERS = 3;
  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2'];

  const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#000' };

  const COLOR_BTN_SIZE = 60;
  const COLOR_BTN_GAP = 12;
  const colorChoiceRects = [];

  const settingsRects = [];

  const S = {
    unoTopCard: null,
    unoDirection: 1,
    unoCurrentPlayer: 0,
    unoHands: [],
    unoDeck: [],
    unoDiscard: [],
    score: 0,
    roundOver: false,
    gameOver: false,
    waitingForColorChoice: false,
    pendingWildCard: null,
    pendingWildPlayer: -1,
    drawStack: 0,

    /* -- Playing for places -- */
    finished: [],
    finishOrder: null,
    podiumPending: false,

    /* -- House rules -- */
    houseRules: {
      stackPlus4: false,
      stackPlus2OnPlus4: false,
      stackPlus2: false,
      wildOnWild: true,
      showRulesOnStart: false,
      noMercy: false,
      zeroRotate: false,
      sevenSwap: false,
      jumpIn: false,
    },

    /* -- Seven-swap overlay state -- */
    waitingForSwapChoice: false,
    swapChoicePlayer: -1,

    /* -- Host references -- */
    _ctx: null,
    _host: null,

    /* -- AI timer -- */
    aiTurnTimer: 0,
    showingSettings: false
  };

  SZ.CardGames.v['uno'] = { S, CANVAS_W, CANVAS_H, unoColors, swapChoiceRects, AI_TURN_DELAY, NUM_PLAYERS, PLAYER_NAMES, colorMap, COLOR_BTN_SIZE, COLOR_BTN_GAP, colorChoiceRects, settingsRects };

})();
