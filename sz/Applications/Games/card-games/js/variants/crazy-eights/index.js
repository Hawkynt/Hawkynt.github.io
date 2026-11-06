/* Crazy Eights: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['crazy-eights'];
  const S = V.S;
  const SH = SZ.CardGames.shared.sheddingHand;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.gameOver = false;
      V.setupCrazyEights();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawCrazyEights();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick: V.tick,

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { SH.sortSuitHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.stock = [];
      S.discardPile = [];
      S.currentSuit = null;
      S.playerTurn = true;
      S.drawCount = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.waitingForSuitChoice = false;
      S.pendingSuitPlayer = -1;
      S.aiTurnTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('crazy-eights', module);

})();
