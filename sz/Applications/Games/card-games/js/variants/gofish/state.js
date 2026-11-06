/* Go Fish: layout constants and the one state object of the variant (SZ.CardGames.v.gofish). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.gofish = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const RANK_NAMES = {
    'A': 'Aces', '2': '2s', '3': '3s', '4': '4s', '5': '5s', '6': '6s',
    '7': '7s', '8': '8s', '9': '9s', '10': '10s', 'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings'
  };

  const DEAL_COUNT = 7;
  const BOOKS_TO_WIN = 13;
  const POINTS_PER_BOOK = 20;
  const MESSAGE_FADE = 3.0;
  const AI_TURN_DELAY = 1.2;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 30;
  const AI_HAND_Y = 20;
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const STOCK_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;

  const PLAYER_BOOKS_X = 15;
  const PLAYER_BOOKS_Y = 280;
  const AI_BOOKS_X = CANVAS_W - 100;
  const AI_BOOKS_Y = 140;

  const MESSAGE_Y = CANVAS_H / 2 + 65;

  const S = V.S = {
    playerHand: [],
    aiHand: [],
    stock: [],
    playerBooks: [],
    aiBooks: [],
    score: 0,
    roundOver: false,
    gameOver: false,
    isPlayerTurn: true,
    message: '',
    messageColor: '#fff',
    messageTimer: 0,
    hoverCardIdx: -1,
    selectedCardIdx: -1,
    /* -- AI state -- */
    aiTurnTimer: 0,
    aiThinking: false,
    aiMemory: {},       // rank -> true; tracks ranks the player has asked for
    aiLastAsked: '',
    aiDrawnMatchedAsk: false,
    /* -- Host -- */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, RANK_NAMES, DEAL_COUNT, BOOKS_TO_WIN, POINTS_PER_BOOK,
    MESSAGE_FADE, AI_TURN_DELAY, PLAYER_HAND_Y, AI_HAND_Y, STOCK_X, STOCK_Y, PLAYER_BOOKS_X,
    PLAYER_BOOKS_Y, AI_BOOKS_X, AI_BOOKS_Y, MESSAGE_Y });

})();
