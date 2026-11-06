/* Mau-Mau: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['maumau'];
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
      V.setupMauMau();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawMauMau();
    },

    handleClick: V.handleClick,

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey: V.handleKey,

    tick: V.tick,

    sortPlayerHand() { SH.sortSuitHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], []];
      S.stock = [];
      S.discardPile = [];
      S.roundOver = false;
      S.gameOver = false;
      S.drawObligation = 0;
      S.skipNext = false;
      S.extraTurn = false;
      S.chosenSuit = null;
      S.waitingForSuitChoice = false;
      S.pendingJackPlayer = -1;
      S.mauAnnounced = [false, false];
      S.mauMauAnnounced = [false, false];
      S.aiTurnTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('maumau', module);

})();
