/* Pinochle - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.pinochle;
  const S = V.S;
  const { TEAM_A, TEAM_B, PHASE_BIDDING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      if (S.score !== 0) {
        S.teamScores[TEAM_A] = S.score;
        S.teamScores[TEAM_B] = 0;
      }
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
      S.teamScores = [0, 0];
      S.meldPoints = [0, 0, 0, 0];
      S.trickPointsWon = [0, 0];
      S.tricksWon = [0, 0];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_BIDDING;
      S.trumpSuit = null;
      S.aiTurnTimer = 0;
      S.hoverCardIdx = -1;
      S.hoverBidBtn = -1;
      S.hoveredTrumpSuit = null;
      S.meldResults = [];
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) {
      S.score = s;
      S.teamScores[TEAM_A] = s;
    }
  };

  SZ.CardGames.registerVariant('pinochle', module);

})();
