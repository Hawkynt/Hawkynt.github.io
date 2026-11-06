/* Bridge - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.bridge;
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
      V.setupGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawAll();
    },

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.trickCards = [];
      S.trickPlayers = [];
      S.bidHistory = [];
      S.contractBid = null;
      S.contractPlayer = -1;
      S.dummyPlayer = -1;
      S.trumpSuit = null;
      S.nsAboveLine = 0;
      S.nsBelow = 0;
      S.ewAboveLine = 0;
      S.ewBelow = 0;
      S.nsGamesWon = 0;
      S.ewGamesWon = 0;
      S.nsVulnerable = false;
      S.ewVulnerable = false;
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_BIDDING;
      S.aiTurnTimer = 0;
      S.hoveredCard = -1;
      S.hoveredBidBtn = -1;
      S.hoveredPassBtn = false;
      S.statusMessage = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('bridge', module);

})();
