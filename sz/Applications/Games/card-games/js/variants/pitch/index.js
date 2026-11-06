/* Pitch - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.pitch;
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
      if (S.score !== 0)
        S.playerScores[0] = S.score;
      else
        S.playerScores = [0, 0, 0, 0];
      S.gameOver = false;
      S.dealer = 0;
      V.dealRound();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawAll();
    },

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    handleKey(e) {},

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.capturedCards = [[], [], [], []];
      S.trickCards = [];
      S.trickPlayers = [];
      S.trumpSuit = null;
      S.bidder = -1;
      S.bidAmount = 0;
      S.playerBids = [0, 0, 0, 0];
      S.playerBidDone = [false, false, false, false];
      S.playerScores = [0, 0, 0, 0];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_BIDDING;
      S.aiTurnTimer = 0;
      S.hoveredCard = -1;
      S.hoveredBtn = '';
      S.roundMessages = [];
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) {
      S.score = s;
      S.playerScores[0] = s;
    }
  };

  SZ.CardGames.registerVariant('pitch', module);

})();
