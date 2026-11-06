/* Scopa: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const WINNING_SCORE = 11;

  const PHASE_PLAY = 0;
  const PHASE_CAPTURE = 1;
  const PHASE_AI_TURN = 2;
  const PHASE_DEALING = 3;
  const PHASE_ROUND_OVER = 4;

  const DEAL_ANIM_DELAY = 0.6;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 25;

  const CONFIRM_BTN = { x: CANVAS_W / 2 - 55, y: PLAYER_HAND_Y - 38, w: 110, h: 28 };

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.scopa = {
    CANVAS_W,
    CANVAS_H,
    WINNING_SCORE,
    PHASE_PLAY,
    PHASE_CAPTURE,
    PHASE_AI_TURN,
    PHASE_DEALING,
    PHASE_ROUND_OVER,
    DEAL_ANIM_DELAY,
    PLAYER_HAND_Y,
    CONFIRM_BTN,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      table: [],
      stock: [],
      playerCaptures: [],
      aiCaptures: [],
      playerScopas: 0,
      aiScopas: 0,
      cumulativePlayer: 0,
      cumulativeAI: 0,
      lastCapturer: -1, // 0 = player, 1 = AI
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_DEALING,
      roundNumber: 0,
      selectedHandIdx: -1,
      selectedTableIdxs: [],
      hoverHandIdx: -1,
      hoverTableIdx: -1,
      aiTurnTimer: 0,
      dealTimer: 0,
      roundBreakdown: null, // set at round end for display
      _ctx: null,
      _host: null
    }
  };

})();
