/* Oh Hell - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.ohhell;
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
      S.bids = [-1, -1, -1, -1];
      S.bidsDone = [false, false, false, false];
      S.tricksWon = [0, 0, 0, 0];
      S.cumulativeScores = [0, 0, 0, 0];
      S.trumpCard = null;
      S.trumpSuit = null;
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_BIDDING;
      S.aiTurnTimer = 0;
      S.hoveredCard = -1;
      S.hoveredBid = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('ohhell', module);

})();
