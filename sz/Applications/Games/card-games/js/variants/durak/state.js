/* Durak: shared constants and the single mutable state object V.S used by every file of the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.v) SZ.CardGames.v = {};

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const MAX_ATTACK_CARDS = 6;

  /* ================================================================
     BUTTON POSITIONS
     ================================================================ */

  const TAKE_BTN = { x: CANVAS_W / 2 + 120, y: 280, w: 90, h: 34 };
  const DONE_BTN = { x: CANVAS_W / 2 + 120, y: 320, w: 90, h: 34 };
  const PASS_BTN = { x: CANVAS_W / 2 + 120, y: 280, w: 90, h: 34 };

  /* ── Mutable game state (one object shared by every file of the variant) ── */
  SZ.CardGames.v.durak = {
    CANVAS_W,
    CANVAS_H,
    MAX_ATTACK_CARDS,
    TAKE_BTN,
    DONE_BTN,
    PASS_BTN,
    S: {
      /* ================================================================
         GAME STATE
         ================================================================ */
      playerHand: [],
      aiHand: [],
      stock: [],
      discard: [],
      trumpCard: null,
      trumpSuit: '',
      /* Table: pairs of attack/defense cards */
      attackCards: [],
      defenseCards: [],
      isPlayerAttacking: true,
      waitingForDefense: false,
      boutOver: false,
      score: 0,
      roundOver: false,
      gameOver: false,
      resultMsg: '',
      _ctx: null,
      _host: null,
      aiTurnTimer: 0,
      aiActionPending: false,
      hoverCardIdx: -1,
      selectedCardIdx: -1
    }
  };

})();
