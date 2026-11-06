/* Hearts - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.hearts;
  const S = V.S;
  const { PHASE_PASSING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 100;
      S.cumulativeScores = [0, 0, 0, 0];
      S.roundNumber = 0;
      V.setupHearts();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawHearts();
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
      S.cumulativeScores = [0, 0, 0, 0];
      S.roundScores = [0, 0, 0, 0];
      S.selectedForPass = [];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_PASSING;
      S.aiTurnTimer = 0;
      S.hoverCardIdx = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('hearts', module);

})();
