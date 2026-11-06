/* Uno Party: constants and the one state object S shared by this variant's files. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const AI_SCALE = 0.45;
  const AI_CARD_W = (CE.CARD_W * AI_SCALE) | 0;
  const AI_CARD_H = (CE.CARD_H * AI_SCALE) | 0;

  const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];
  const COLOR_HEX = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f', wild: '#2c3e50' };
  const COLOR_DARK = { red: '#c0392b', blue: '#2980b9', green: '#27ae60', yellow: '#d4ac0f', wild: '#1a252f' };

  const PLAYER_COUNT = 6;
  const DEAL_COUNT = 7;
  const WIN_SCORE = 500;

  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3', 'AI 4', 'AI 5'];
  const AI_TURN_DELAY = 0.7;

  // Hexagonal layout positions for 6 players
  const PLAYER_POS = [
    { x: CANVAS_W / 2, y: CANVAS_H - 55, labelY: CANVAS_H - 90 },        // 0: bottom center (human)
    { x: 75, y: CANVAS_H * 0.65, labelY: CANVAS_H * 0.65 - 35 },          // 1: bottom-left
    { x: 75, y: CANVAS_H * 0.25, labelY: CANVAS_H * 0.25 - 35 },          // 2: top-left
    { x: CANVAS_W / 2, y: 50, labelY: 22 },                                // 3: top center
    { x: CANVAS_W - 75, y: CANVAS_H * 0.25, labelY: CANVAS_H * 0.25 - 35 }, // 4: top-right
    { x: CANVAS_W - 75, y: CANVAS_H * 0.65, labelY: CANVAS_H * 0.65 - 35 }, // 5: bottom-right
  ];

  const S = {
    hands: [],
    deck: [],
    discardPile: [],
    currentPlayer: 0,
    direction: 1,
    currentColor: '',
    drawPending: 0,
    roundOver: false,
    gameOver: false,
    score: 0,
    colorChoiceActive: false,
    tradeChoiceActive: false,
    pendingWildIndex: -1,
    pendingTradeType: '',
    finished: [],
    finishOrder: null,
    podiumPending: false,
    _ctx: null,
    _host: null,
    aiTurnTimer: 0
  };

  SZ.CardGames.v['unoparty'] = { S, CANVAS_W, CANVAS_H, AI_SCALE, AI_CARD_W, AI_CARD_H, UNO_COLORS, COLOR_HEX, COLOR_DARK, PLAYER_COUNT, DEAL_COUNT, WIN_SCORE, PLAYER_NAMES, AI_TURN_DELAY, PLAYER_POS };

})();
