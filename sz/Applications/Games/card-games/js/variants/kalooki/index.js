/* Kalooki variant module: wires setup, drawing, input, timing and cleanup and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.kalooki;
  const S = V.S;
  const { PHASE_DRAW, PHASE_AI_THINKING } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ── AI timing ── */
  const AI_DELAY = 0.8;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.cumulScores = [0, 0, 0];
      S.gameOver = false;
      V.setupKalooki();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawKalooki();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick(dt) {
      if (S.roundOver || S.gameOver) return;
      if (S.phase !== PHASE_AI_THINKING) return;

      S.aiTimer += dt;
      if (S.aiTimer >= AI_DELAY)
        V.aiTakeTurn(S.currentPlayer);
    },

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { RC.sortHandJokers(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], []];
      S.stockPile = [];
      S.discardPile = [];
      S.tableMelds = [];
      S.cumulScores = [0, 0, 0];
      S.hasMelded = [false, false, false];
      S.noPriorMelds = [true, true, true];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_DRAW;
      S.currentPlayer = 0;
      S.selectedIndices = [];
      S.resultMsg = '';
      S.aiTimer = 0;
      S.aiStep = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('kalooki', module);

})();
