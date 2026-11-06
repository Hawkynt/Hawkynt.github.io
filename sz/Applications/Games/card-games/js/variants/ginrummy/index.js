/* Gin Rummy variant module: wires setup, drawing, input, timing and cleanup and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.ginrummy;
  const S = V.S;
  const { PHASE_PLAYER_DRAW, PHASE_AI_THINKING } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const AI_DELAY = 1.0;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.aiScore = 0;
      V.setupGinRummy();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawGinRummy();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick(dt) {
      if (S.roundOver || S.gameOver) return;
      if (S.phase !== PHASE_AI_THINKING) return;

      S.aiTimer += dt;
      if (S.aiTimer >= AI_DELAY)
        V.aiTakeTurn();
    },

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { RC.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.stockPile = [];
      S.discardPile = [];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_PLAYER_DRAW;
      S.selectedCardIndex = -1;
      S.resultMsg = '';
      S.knocker = -1;
      S.playerMelds = [];
      S.aiMelds = [];
      S.playerDeadwood = [];
      S.aiDeadwood = [];
      S.layoffCards = [];
      S.aiTimer = 0;
      S.aiDrawn = false;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('ginrummy', module);

})();
