/* Spades - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spades;
  const S = V.S;
  const { TEAM_NS, TEAM_EW, PHASE_BIDDING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      if (S.score !== 0) {
        S.teamScores[TEAM_NS] = S.score;
        S.teamScores[TEAM_EW] = 0;
      }
      V.setupGame();
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
      S.trickCards = [];
      S.trickPlayers = [];
      S.bids = [0, 0, 0, 0];
      S.bidsDone = [false, false, false, false];
      S.tricksWon = [0, 0, 0, 0];
      S.teamScores = [0, 0];
      S.teamBags = [0, 0];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_BIDDING;
      S.aiTurnTimer = 0;
      S.selectedCard = -1;
      S.hoveredCard = -1;
      S.hoveredBid = -1;
      S.statusMessage = '';
      S.trickWinnerDisplay = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) {
      S.score = s;
      S.teamScores[TEAM_NS] = s;
    }
  };

  SZ.CardGames.registerVariant('spades', module);

})();
