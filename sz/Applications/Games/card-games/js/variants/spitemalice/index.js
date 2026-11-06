/* Spite & Malice: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spitemalice;
  const S = V.S;
  const { AI_DELAY } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupSpiteMalice();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawSpiteMalice();
    },

    handleClick(mx, my) {
      V.handlePlayerClick(mx, my);
    },

    handleKey(e) {},

    tick(dt) {
      if (S.roundOver || S.gameOver) return;
      if (!S.playerTurn) {
        S.aiTimer += dt;
        if (S.aiTimer >= AI_DELAY) {
          S.aiTimer = 0;
          V.aiTurn();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.payoff = [[], []];
      S.hands = [[], []];
      S.centerPiles = [[], [], [], []];
      S.sideStacks = [[[], [], [], []], [[], [], [], []]];
      S.stock = [];
      S.selectedSource = null;
      S.playerTurn = true;
      S.roundOver = false;
      S.gameOver = false;
      S.aiTimer = 0;
      S.aiDiscarded = false;
      S.score = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('spitemalice', module);

})();
