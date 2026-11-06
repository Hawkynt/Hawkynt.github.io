;(function() {
  'use strict';

  /* Pyramid: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.pyramid;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, newGame, drawFromStock, findHint, hitTest, handleSelection, drawScene
  } = V;

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._canvas = canvas;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      newGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      drawScene(ctx, W, H);
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        const hit = hitTest(mx, my);
        if (hit && hit.area === 'newdeal') {
          if (S._host)
            S._host.onRoundOver(S.gameOver);
          return;
        }
        // Click anywhere else also continues
        if (S._host)
          S._host.onRoundOver(S.gameOver);
        return;
      }

      const hit = hitTest(mx, my);
      if (!hit) {
        S.selectedCard = null;
        return;
      }

      handleSelection(hit);
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (S.roundOver || S.gameOver)
        return;

      if (e.key === 'h' || e.key === 'H') {
        const hint = findHint();
        if (hint) {
          S.hintPair = hint;
          S.hintTimer = 2.0;
        } else if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'No moves available', { color: '#f88', size: 18 });
        return;
      }

      if (e.key === 'Escape') {
        S.selectedCard = null;
        return;
      }

      // Space or Enter to draw from stock
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        drawFromStock();
      }
    },

    tick(dt) {
      if (S.hintTimer > 0) {
        S.hintTimer -= dt;
        if (S.hintTimer <= 0) {
          S.hintPair = null;
          S.hintTimer = 0;
        }
      }
    },

    cleanup() {
      S.pyramid = [];
      S.stock = [];
      S.waste = [];
      S.score = 0;
      S.pairsRemoved = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.selectedCard = null;
      S.statusMsg = '';
      S.moveCount = 0;
      S.hintPair = null;
      S.hintTimer = 0;
      S.particles = [];
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('pyramid', module);

})();
