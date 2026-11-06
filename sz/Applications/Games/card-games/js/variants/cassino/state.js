/* Cassino: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const WINNING_SCORE = 21;

  const PHASE_PLAY = 0;
  const PHASE_SELECT_TABLE = 1;
  const PHASE_AI_TURN = 2;
  const PHASE_ROUND_OVER = 3;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 25;

  const BTN_Y = PLAYER_HAND_Y - 38;
  const CAPTURE_BTN = { x: CANVAS_W / 2 - 165, y: BTN_Y, w: 100, h: 28 };
  const BUILD_BTN = { x: CANVAS_W / 2 - 50, y: BTN_Y, w: 100, h: 28 };
  const TRAIL_BTN = { x: CANVAS_W / 2 + 65, y: BTN_Y, w: 100, h: 28 };

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.cassino = {
    CANVAS_W,
    CANVAS_H,
    WINNING_SCORE,
    PHASE_PLAY,
    PHASE_SELECT_TABLE,
    PHASE_AI_TURN,
    PHASE_ROUND_OVER,
    PLAYER_HAND_Y,
    BTN_Y,
    CAPTURE_BTN,
    BUILD_BTN,
    TRAIL_BTN,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      table: [], // mix of cards and build objects
      stock: [],
      playerCaptures: [],
      aiCaptures: [],
      playerSweeps: 0,
      aiSweeps: 0,
      cumulativePlayer: 0,
      cumulativeAI: 0,
      lastCapturer: -1, // 0 = player, 1 = AI
      score: 0,
      roundOver: false,
      gameOver: false,
      phase: PHASE_PLAY,
      roundNumber: 0,
      selectedHandIdx: -1,
      selectedTableIdxs: [],
      hoverHandIdx: -1,
      hoverTableIdx: -1,
      aiTurnTimer: 0,
      roundBreakdown: null,
      _ctx: null,
      _host: null
    }
  };

})();
