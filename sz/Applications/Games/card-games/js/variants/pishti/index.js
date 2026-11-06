/* Pishti: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const sortHand = SZ.CardGames.shared.euroCards.sortBySuit;

  const V = SZ.CardGames.v.pishti;
  const S = V.S;
  const { PHASE_PLAY, PHASE_AI_TURN, PHASE_ROUND_OVER } = V;

  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = 0;
      S.cumulativePlayer = 0;
      S.cumulativeAI = 0;
      S.roundNumber = 0;
      S.gameOver = false;
      V.setupRound();
    },

    draw: V.draw,

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    handleKey: V.handleKey,

    tick(dt) {
      if (S.roundOver && S.phase !== PHASE_ROUND_OVER) return;
      if (S.gameOver) return;

      // Pishti flash countdown
      if (S.pishtiFlashTimer > 0)
        S.pishtiFlashTimer -= dt;

      if (S.phase === PHASE_AI_TURN) {
        S.aiTurnTimer += dt;
        if (S.aiTurnTimer >= AI_TURN_DELAY) {
          S.aiTurnTimer = 0;
          V.aiTakeTurn();
        }
      }
    },

    sortPlayerHand() { sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.centerPile = [];
      S.stock = [];
      S.playerCaptures = [];
      S.aiCaptures = [];
      S.playerPishtis = 0;
      S.aiPishtis = 0;
      S.cumulativePlayer = 0;
      S.cumulativeAI = 0;
      S.lastCapturer = -1;
      S.roundOver = false;
      S.gameOver = false;
      S.roundBreakdown = null;
      S.hoverHandIdx = -1;
      S.aiTurnTimer = 0;
      S.pishtiFlashTimer = 0;
      S.pishtiFlashText = '';
      S.phase = PHASE_PLAY;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('pishti', module);

})();
