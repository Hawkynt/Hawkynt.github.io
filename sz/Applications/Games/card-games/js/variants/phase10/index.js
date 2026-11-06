/* Phase 10 variant module: wires setup, drawing, input, timing and cleanup and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.phase10;
  const S = V.S;

  const AI_TURN_DELAY = 0.7;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      V.setupGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawGame();
    },

    handleClick: V.handleClick,

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey: V.handleKey,

    tick(dt) {
      if (S.roundOver || S.gameOver) return;
      if (S.currentPlayer !== 0) {
        S.aiTurnTimer += dt;
        if (S.aiTurnTimer >= AI_TURN_DELAY) {
          S.aiTurnTimer = 0;
          V.aiPlayTurn(S.currentPlayer);
        }
      }
    },

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [];
      S.deck = [];
      S.discardPile = [];
      S.playerPhases = [];
      S.laidPhases = [];
      S.selectedCards = [];
      S.hitTarget = null;
      S.roundOver = false;
      S.gameOver = false;
      S.aiTurnTimer = 0;
      S.aiSubStep = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('phase10', module);

})();
