/* 8-Color Duo: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['duo'];
  const S = V.S;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupDuo();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawDuo();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick: V.tick,

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [];
      S.deck = [];
      S.topCard = null;
      S.roundOver = false;
      S.gameOver = false;
      S.waitingForColorChoice = false;
      S.pendingWildCard = null;
      S.pendingWildPlayer = -1;
      S.drawStack = 0;
      S.aiTurnTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('duo', module);

})();
