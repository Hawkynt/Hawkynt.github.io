/* Uno: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['uno'];
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
      V.setupUno();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawUno();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick: V.tick,

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { SH.sortColorHand(S.unoHands[0]); },

    cleanup() {
      S.unoHands = [];
      S.unoDeck = [];
      S.unoTopCard = null;
      S.roundOver = false;
      S.gameOver = false;
      S.waitingForColorChoice = false;
      S.waitingForSwapChoice = false;
      S.pendingWildCard = null;
      S.pendingWildPlayer = -1;
      S.swapChoicePlayer = -1;
      S.drawStack = 0;
      S.unoDiscard = [];
      SZ.CardGames.shared.sheddingPlaces.resetPlaces(S);
      S.showingSettings = false;
      S.aiTurnTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('uno', module);

})();
