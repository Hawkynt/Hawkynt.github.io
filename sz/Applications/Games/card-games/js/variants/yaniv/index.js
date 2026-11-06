/* Yaniv variant module: wires setup, drawing, input, timing and cleanup and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.yaniv;
  const S = V.S;
  const { PHASE_DISCARD, PHASE_AI_THINKING, PHASE_YANIV_REVEAL, PHASE_ROUND_OVER, REVEAL_DELAY } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const AI_DELAY = 0.8;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.cumulativeScores = [0, 0, 0, 0];
      S.eliminated = [false, false, false, false];
      S.gameOver = false;
      V.setupRound();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawYaniv();
    },

    handleClick: V.handleClick,

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey: V.handleKey,

    tick(dt) {
      if (S.gameOver && S.phase !== PHASE_ROUND_OVER) return;

      // Yaniv reveal phase: wait then resolve
      if (S.phase === PHASE_YANIV_REVEAL) {
        S.revealTimer += dt;
        if (S.revealTimer >= REVEAL_DELAY)
          V.resolveYaniv(S.yanivCaller);
        return;
      }

      if (S.roundOver) return;

      // AI thinking
      if (S.phase === PHASE_AI_THINKING) {
        S.aiTimer += dt;
        if (S.aiTimer >= AI_DELAY)
          V.aiTakeTurn(S.currentPlayer);
      }
    },

    sortPlayerHand() { RC.sortHandJokers(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.stockPile = [];
      S.discardGroup = [];
      S.cumulativeScores = [0, 0, 0, 0];
      S.eliminated = [false, false, false, false];
      S.selectedIndices = [];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_DISCARD;
      S.currentPlayer = 0;
      S.resultMsg = '';
      S.yanivCaller = -1;
      S.assafTriggered = false;
      S.aiTimer = 0;
      S.aiStep = 0;
      S.revealTimer = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('yaniv', module);

})();
