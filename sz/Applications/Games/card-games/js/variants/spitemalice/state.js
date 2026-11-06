/* Spite & Malice: layout constants and the one state object of the variant (SZ.CardGames.v.spitemalice). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spitemalice = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Rank helpers ── */
  const RANK_ORDER = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const AI_DELAY = 0.7;

  /* ── Layout constants ── */
  const CW = CE.CARD_W;
  const CH = CE.CARD_H;
  const CW_S = Math.round(CW * 0.72); // small card
  const CH_S = Math.round(CH * 0.72);

  // Center piles (middle of canvas)
  const CENTER_Y = 240;
  const CENTER_X0 = 280;
  const CENTER_GAP = 85;

  // Stock pile
  const STOCK_X = 60;
  const STOCK_Y = CENTER_Y;

  // Player area (bottom)
  const P_PAYOFF_X = 60;
  const P_PAYOFF_Y = 420;
  const P_HAND_X = 180;
  const P_HAND_Y = 420;
  const P_SIDE_X = 180;
  const P_SIDE_Y = 510;

  // AI area (top)
  const AI_PAYOFF_X = 60;
  const AI_PAYOFF_Y = 50;
  const AI_HAND_X = 180;
  const AI_HAND_Y = 50;
  const AI_SIDE_X = 180;
  const AI_SIDE_Y = 140;

  const S = V.S = {
    /* ── Game state ── */
    payoff: [[], []],        // [0]=player, [1]=AI -- goal piles (face-down, top face-up)
    hands: [[], []],         // 5-card hands
    centerPiles: [[], [], [], []], // shared build piles A->K
    sideStacks: [[[], [], [], []], [[], [], [], []]], // each player has 4 discard piles
    stock: [],               // draw pile
    selectedSource: null,    // { type: 'hand'|'payoff'|'side', index }
    playerTurn: true,
    score: 0,
    roundOver: false,
    gameOver: false,
    /* ── AI ── */
    aiTimer: 0,
    aiDiscarded: false,
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, RANK_ORDER, AI_DELAY, CW, CH, CW_S, CH_S, CENTER_Y,
    CENTER_X0, CENTER_GAP, STOCK_X, STOCK_Y, P_PAYOFF_X, P_PAYOFF_Y, P_HAND_X, P_HAND_Y, P_SIDE_X,
    P_SIDE_Y, AI_PAYOFF_X, AI_PAYOFF_Y, AI_HAND_X, AI_HAND_Y, AI_SIDE_X, AI_SIDE_Y });

})();
