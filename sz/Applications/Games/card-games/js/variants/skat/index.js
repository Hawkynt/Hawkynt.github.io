/* Skat - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.skat;
  const S = V.S;
  const { PHASE_BIDDING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupSkat();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawSkat();
    },

    handleClick: V.handleClick,

    handleKey(e) {},

    tick: V.tick,

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.skatHands = [[], [], []];
      S.trickCards = [];
      S.trickPlayers = [];
      S.skatPile = [];
      S.deck = [];
      S.roundOver = false;
      S.gameOver = false;
      S.declarer = -1;
      S.phase = PHASE_BIDDING;
      S.aiTurnTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('skat', module);

})();
