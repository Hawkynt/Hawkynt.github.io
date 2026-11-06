/* Pishti: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const WINNING_SCORE = 151;

  const PHASE_PLAY = 0;
  const PHASE_AI_TURN = 1;
  const PHASE_DEALING = 2;
  const PHASE_ROUND_OVER = 3;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 25;

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.pishti = {
    CANVAS_W,
    CANVAS_H,
    WINNING_SCORE,
    PHASE_PLAY,
    PHASE_AI_TURN,
    PHASE_DEALING,
    PHASE_ROUND_OVER,
    PLAYER_HAND_Y,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      centerPile: [],
      stock: [],
      playerCaptures: [],
      aiCaptures: [],
      playerPishtis: 0,
      aiPishtis: 0,
      cumulativePlayer: 0,
      cumulativeAI: 0,
      lastCapturer: -1, // 0 = player, 1 = AI
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_PLAY,
      roundNumber: 0,
      hoverHandIdx: -1,
      aiTurnTimer: 0,
      roundBreakdown: null,
      pishtiFlashTimer: 0,
      pishtiFlashText: '',
      _ctx: null,
      _host: null
    }
  };

})();
