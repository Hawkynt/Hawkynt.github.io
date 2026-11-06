/* Beggar Neighbor: layout constants and the one state object of the variant (SZ.CardGames.v.beggar). */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.beggar = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Court card payment counts ── */
  const PENALTY = { 'A': 4, 'K': 3, 'Q': 2, 'J': 1 };

  /* ── Layout positions ── */
  const AI_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const AI_PILE_Y = 40;
  const PLAYER_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const PLAYER_PILE_Y = CANVAS_H - 40 - CE.CARD_H;

  const CENTER_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const CENTER_Y = CANVAS_H / 2 - CE.CARD_H / 2;

  const NEXT_BTN = { x: CANVAS_W / 2 - 110, y: CANVAS_H / 2 + CE.CARD_H / 2 + 20, w: 100, h: 36 };
  const AUTO_BTN = { x: CANVAS_W / 2 + 10, y: CANVAS_H / 2 + CE.CARD_H / 2 + 20, w: 100, h: 36 };

  /* ── Animation phases ── */
  const PHASE_IDLE = 0;
  const PHASE_PLAY = 1;         // card flip animation
  const PHASE_SHOW = 2;         // brief pause to show the card
  const PHASE_COLLECT = 3;      // winner collects pile
  const FLIP_DURATION = 0.3;
  const COLLECT_DURATION = 0.4;
  const AUTO_INTERVAL = 0.6;

  const S = V.S = {
    /* ── Game state ── */
    playerPile: [],
    aiPile: [],
    centerPile: [],
    score: 0,
    roundOver: false,
    gameOver: false,
    /* ── Turn state ── */
    isPlayerTurn: true,       // who plays next card
    penaltyRemaining: 0,      // cards left to pay
    penaltyTotal: 0,          // original penalty count
    penaltyChallenger: '',    // 'player' or 'ai' -- who played the court card
    phase: PHASE_IDLE,
    phaseTimer: 0,
    /* ── Flip animation ── */
    flipAnimProgress: 0,
    currentCard: null,
    /* ── Collect animation ── */
    collectTarget: '',
    collectProgress: 0,
    /* ── Auto play ── */
    autoPlay: false,
    autoTimer: 0,
    /* ── Result display ── */
    resultText: '',
    /* ── Host references ── */
    _ctx: null,
    _host: null
  };

  Object.assign(V, { CANVAS_W, CANVAS_H, PENALTY, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X,
    PLAYER_PILE_Y, CENTER_X, CENTER_Y, NEXT_BTN, AUTO_BTN, PHASE_IDLE, PHASE_PLAY, PHASE_SHOW,
    PHASE_COLLECT, FLIP_DURATION, COLLECT_DURATION, AUTO_INTERVAL });

})();
