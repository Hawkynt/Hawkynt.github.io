/* Cribbage: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.cribbage;
  const S = V.S;
  const { PHASE_DISCARD } = V;

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.playerScore = S.score;
      S.aiScore = 0;
      S.playerPrevScore = 0;
      S.aiPrevScore = 0;
      S.gameOver = false;
      S.roundOver = false;
      S.dealerIsPlayer = false;
      V.dealRound();
    },

    draw: V.draw,

    handleClick(mx, my) {
      V.handleGameClick(mx, my);
    },

    handlePointerMove: V.handlePointerMove,

    handlePointerUp(mx, my, e) {},

    handleKey: V.handleKey,

    tick(dt) {
      V.aiTick(dt);
    },

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.playerKeep = [];
      S.aiKeep = [];
      S.crib = [];
      S.starter = null;
      S.deck = [];
      S.pegCards = [];
      S.playerPegHand = [];
      S.aiPegHand = [];
      S.showBreakdown = [];
      S.selectedIndices = [];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_DISCARD;
      S.resultMsg = '';
      S.pegMsg = '';
      S.pendingAiAction = false;
      S.aiTimer = 0;
      S.hoverCardIdx = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; S.playerScore = s; }
  };

  SZ.CardGames.registerVariant('cribbage', module);

})();
