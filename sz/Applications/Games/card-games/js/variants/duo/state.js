/* 8-Color Duo: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* -- 8-Color palette -- */
  const duoColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];
  const colorMap = {
    red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0',
    purple: '#82e', orange: '#e82', pink: '#d48', teal: '#2aa',
    wild: '#000'
  };
  const AI_TURN_DELAY = 0.8;
  const NUM_PLAYERS = 4;

  const COLOR_BTN_SIZE = 60;
  const COLOR_BTN_GAP = 10;
  const colorChoiceRects = [];

  const S = {
    /* -- Game state -- */
    topCard: null,
    direction: 1,
    currentPlayer: 0,
    hands: [],
    deck: [],
    score: 0,
    roundOver: false,
    gameOver: false,
    waitingForColorChoice: false,
    pendingWildCard: null,
    pendingWildPlayer: -1,
    drawStack: 0,

    /* -- Host references -- */
    _ctx: null,
    _host: null,

    /* -- AI timer -- */
    aiTurnTimer: 0
  };

  SZ.CardGames.v['duo'] = { S, CANVAS_W, CANVAS_H, duoColors, colorMap, AI_TURN_DELAY, NUM_PLAYERS, COLOR_BTN_SIZE, COLOR_BTN_GAP, colorChoiceRects };

})();
