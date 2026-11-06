/* President: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];
  const WIN_SCORE = 15;

  /* President rank order: 3 (lowest) through 2 (highest) */
  const RANK_STRENGTH = {
    '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5,
    '9': 6, '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12
  };

  const TITLE_NAMES = ['President', 'Vice President', 'Vice Scum', 'Scum'];
  const TITLE_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32', '#888'];
  const TITLE_POINTS = [3, 2, 1, 0];

  /* Phases */
  const PHASE_EXCHANGE = 0;
  const PHASE_PLAYING = 1;
  const PHASE_TRICK_CLEAR = 2;
  const PHASE_ROUND_OVER = 3;
  const TRICK_CLEAR_DELAY = 1.0;
  const AI_TURN_DELAY = 0.8;

  const PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PILE_Y = 220;

  const AI_HAND_POSITIONS = [
    null,
    { x: 10, y: 160, dir: 'vertical' },
    { x: 250, y: 10, dir: 'horizontal' },
    { x: CANVAS_W - 10 - CE.CARD_W * 0.55, y: 160, dir: 'vertical' }
  ];

  const PLAY_BTN = { x: CANVAS_W / 2 - 110, y: CANVAS_H - CE.CARD_H - 60, w: 90, h: 30 };
  const PASS_BTN = { x: CANVAS_W / 2 + 20, y: CANVAS_H - CE.CARD_H - 60, w: 90, h: 30 };

  const S = {
    hands: [[], [], [], []],
    pile: [],
    pileCount: 0,
    pileRank: '',
    currentTurn: 0,
    leadPlayer: 0,
    passCount: 0,
    phase: PHASE_PLAYING,
    selectedCards: [],
    hoverCardIdx: -1,
    finishOrder: [],
    titles: [-1, -1, -1, -1],
    scores: [0, 0, 0, 0],
    score: 0,
    roundNumber: 0,
    roundOver: false,
    gameOver: false,
    exchangeCards: [[], [], [], []],
    exchangeDone: [false, false, false, false],
    exchangePhaseActive: false,
    trickClearTimer: 0,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v['president'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, WIN_SCORE, RANK_STRENGTH, TITLE_NAMES, TITLE_COLORS, TITLE_POINTS, PHASE_EXCHANGE, PHASE_PLAYING, PHASE_TRICK_CLEAR, PHASE_ROUND_OVER, TRICK_CLEAR_DELAY, AI_TURN_DELAY, PILE_X, PILE_Y, AI_HAND_POSITIONS, PLAY_BTN, PASS_BTN };

})();
