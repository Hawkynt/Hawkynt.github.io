/* Schwimmen: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const sortHand = SZ.CardGames.shared.euroCards.sortBySuit;

  const V = SZ.CardGames.v.schwimmen;
  const S = V.S;

  const AI_TURN_DELAY = 1.0;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.lives = [3, 3, 3, 3];
      S.eliminated = [false, false, false, false];
      S.gameOver = false;
      V.setupRound();
    },

    draw: V.draw,

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick(dt) {
      if (S.roundOver || S.gameOver) return;
      if (S.currentTurn === 0) return;
      if (S.eliminated[S.currentTurn]) {
        S.currentTurn = V.nextActivePlayer(S.currentTurn);
        S.aiTurnTimer = 0;
        return;
      }

      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        V.aiPlay(S.currentTurn);
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    sortPlayerHand() { sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.pool = [];
      S.lives = [3, 3, 3, 3];
      S.eliminated = [false, false, false, false];
      S.roundOver = false;
      S.gameOver = false;
      S.hasKnocked = -1;
      S.knockFinalTurns = 0;
      S.selectedHandCard = -1;
      S.selectedPoolCard = -1;
      S.swapMode = 'none';
      S.aiTurnTimer = 0;
      S.resultMsg = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('schwimmen', module);

})();
