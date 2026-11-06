/* Uno All Wild: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 7;
  const AI_TURN_DELAY = 0.8;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  const CARD_DEFS = [
    { value: 'Wild', count: 20 },
    { value: 'Wild Draw Two', count: 16 },
    { value: 'Wild Reverse', count: 12 },
    { value: 'Wild Skip', count: 12 },
    { value: 'Wild Forced Swap', count: 12 },
    { value: 'Wild Targeted Draw Two', count: 16 },
    { value: 'Wild Gap', count: 14 }
  ];
  const targetChoiceRects = [];
  const gapChoiceRects = [];

  const AI_HAND_POSITIONS = [
    null,
    { x: 10, y: 160, dir: 'vertical', label: PLAYER_NAMES[1] },
    { x: 250, y: 10, dir: 'horizontal', label: PLAYER_NAMES[2] },
    { x: CANVAS_W - 10 - CE.CARD_W * 0.55, y: 160, dir: 'vertical', label: PLAYER_NAMES[3] }
  ];

  const DISCARD_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const DISCARD_Y = 240;
  const DRAW_PILE_X = CANVAS_W / 2 - CE.CARD_W - 25;
  const DRAW_PILE_Y = 240;

  const rainbowColors = ['#e33', '#33e', '#3a3', '#ea0', '#e3e', '#3ee'];

  const S = {
    hands: [[], [], [], []],
    deck: [],
    discardPile: [],
    topCard: null,
    direction: 1,
    currentPlayer: 0,
    score: 0,
    roundOver: false,
    gameOver: false,
    aiTurnTimer: 0,
    hoverCardIdx: -1,
    waitingForTargetChoice: false,
    targetAction: null,
    targetSourcePlayer: -1,
    targetCard: null,
    waitingForGapChoice: false,
    gapSourcePlayer: -1,
    finished: [],
    finishOrder: null,
    podiumPending: false,
    _ctx: null,
    _host: null
  };

  SZ.CardGames.v['unowild'] = { S, CANVAS_W, CANVAS_H, NUM_PLAYERS, HAND_SIZE, AI_TURN_DELAY, PLAYER_NAMES, CARD_DEFS, targetChoiceRects, gapChoiceRects, AI_HAND_POSITIONS, DISCARD_X, DISCARD_Y, DRAW_PILE_X, DRAW_PILE_Y, rainbowColors };

})();
