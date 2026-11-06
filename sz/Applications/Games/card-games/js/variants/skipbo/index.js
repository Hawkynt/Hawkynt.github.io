/* Skip-Bo: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['skipbo'];
  const S = V.S;

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupSkipBo();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawSkipBo();
    },

    handleClick: V.handleClick,

    handleKey(e) {},

    tick: V.tick,

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.skipBoStockPiles = [[], []];
      S.skipBoBuildPiles = [[], [], [], []];
      S.skipBoDiscardPiles = [[], [], [], []];
      S.playerHand = [];
      S.aiHands = [[]];
      S.deck = [];
      S.roundOver = false;
      S.gameOver = false;
      S.aiTurnTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('skipbo', module);

})();
