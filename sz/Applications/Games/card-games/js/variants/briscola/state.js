/* Briscola: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* Phases */
  const PHASE_PLAY = 0;
  const PHASE_TRICK_DONE = 1;
  const PHASE_ROUND_OVER = 2;

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.briscola = {
    CANVAS_W,
    CANVAS_H,
    PHASE_PLAY,
    PHASE_TRICK_DONE,
    PHASE_ROUND_OVER,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      stock: [],
      trumpCard: null,
      trumpSuit: '',
      trickCards: [], // 0 or 1 or 2 cards on the table
      trickPlayers: [], // who played each card (0=player, 1=ai)
      playerCaptured: [],
      aiCaptured: [],
      playerPoints: 0,
      aiPoints: 0,
      trickCount: 0,
      currentTurn: 0, // 0=player, 1=ai
      trickLeader: 0,
      phase: PHASE_PLAY,
      trickWinner: -1,
      trickDoneTimer: 0,
      score: 0,
      roundOver: false,
      gameOver: false,
      _ctx: null,
      _host: null,
      aiTurnTimer: 0,
      hoverCardIdx: -1
    }
  };

})();
