/* Liar's Uno: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];
  const INITIAL_HAND_SIZE = 7;
  const AI_TURN_DELAY = 0.9;
  const CHALLENGE_WINDOW = 1.5;

  const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];
  const COLOR_MAP = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#555' };

  const playerPos = [
    { x: CANVAS_W / 2, y: CANVAS_H - 70, label: 'You' },
    { x: 70, y: CANVAS_H / 2, label: 'West' },
    { x: CANVAS_W / 2, y: 50, label: 'North' },
    { x: CANVAS_W - 70, y: CANVAS_H / 2, label: 'East' },
  ];

  const S = {
    hands: [],
    deck: [],
    discardPile: [],
    currentPlayer: 0,
    direction: 1,
    currentColor: '',
    roundOver: false,
    gameOver: false,
    score: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0,

    // Playing for places
    finished: [],
    finishOrder: null,
    podiumPending: false,

    // Bluffing state
    lastPlayInfo: null,
    challengePhase: false,
    challengeTimer: 0,
    bluffMode: false,
    bluffClaimStep: 0,
    bluffCard: null,
    bluffCardIndex: -1,
    challengeResult: null,

    // Color choice state for honest wild and bluff
    _showColorChoiceForBluff: false,
    _showColorChoiceForHonest: false
  };

  SZ.CardGames.v['liarsuno'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, INITIAL_HAND_SIZE, AI_TURN_DELAY, CHALLENGE_WINDOW, UNO_COLORS, COLOR_MAP, playerPos };

})();
