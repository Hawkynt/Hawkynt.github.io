/* Cribbage: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_H = 600;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const WINNING_SCORE = 121;

  const HAND_SIZE = 4;
  const PEG_MAX = 31;

  /* ── Phases ── */
  const PHASE_DISCARD = 0;
  const PHASE_CUT = 1;
  const PHASE_PEGGING = 2;
  const PHASE_SHOW = 3;
  const PHASE_CRIB_SHOW = 4;
  const PHASE_ROUND_OVER = 5;

  const HAND_Y = 470;

  const CENTER_Y = 240;

  /* ── Button areas ── */
  const DISCARD_BTN = { x: 280, y: 420, w: 100, h: 30 };
  const CONTINUE_BTN = { x: 280, y: 380, w: 100, h: 30 };

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.cribbage = {
    CANVAS_H,
    WINNING_SCORE,
    HAND_SIZE,
    PEG_MAX,
    PHASE_DISCARD,
    PHASE_CUT,
    PHASE_PEGGING,
    PHASE_SHOW,
    PHASE_CRIB_SHOW,
    PHASE_ROUND_OVER,
    HAND_Y,
    CENTER_Y,
    DISCARD_BTN,
    CONTINUE_BTN,
    S: {
      /* ================================================================
       *  GAME STATE
       * ================================================================ */
      playerHand: [],
      aiHand: [],
      playerKeep: [],
      aiKeep: [],
      crib: [],
      starter: null,
      deck: [],
      playerScore: 0,
      aiScore: 0,
      playerPrevScore: 0,
      aiPrevScore: 0,
      dealerIsPlayer: false,
      phase: PHASE_DISCARD,
      selectedIndices: [],
      roundOver: false,
      gameOver: false,
      score: 0,
      resultMsg: '',
      /* ── Pegging state ── */
      pegCards: [],
      pegCount: 0,
      playerPegHand: [],
      aiPegHand: [],
      playerSaidGo: false,
      aiSaidGo: false,
      currentPegger: 0, // 0=player, 1=AI
      pegMsg: '',
      waitingForGo: false,
      /* ── Show state ── */
      showBreakdown: [],
      showPhaseIdx: 0, // 0=non-dealer, 1=dealer, 2=crib
      /* ── AI timing ── */
      aiTimer: 0,
      pendingAiAction: false,
      /* ── Host references ── */
      _ctx: null,
      _host: null,
      hoverCardIdx: -1
    }
  };

})();
