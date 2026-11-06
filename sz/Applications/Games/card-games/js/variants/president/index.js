/* President: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['president'];
  const S = V.S;
  const { PHASE_PLAYING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup: V.setup,

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawAll();
    },

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    handleKey: V.handleKey,

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.pile = [];
      S.selectedCards = [];
      S.finishOrder = [];
      S.titles = [-1, -1, -1, -1];
      S.scores = [0, 0, 0, 0];
      S.exchangeCards = [[], [], [], []];
      S.exchangeDone = [false, false, false, false];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_PLAYING;
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

  SZ.CardGames.registerVariant('president', module);

})();
