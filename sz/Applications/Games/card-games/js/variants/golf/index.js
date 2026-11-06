;(function() {
  'use strict';

  /* Golf: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.golf;
  const S = V.S;
  const {
    CE, canPlayOnWaste, doUndo, playColumnCard, dealFromStock, newGame, hitTest, hitTestColumn,
    drawGolf
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
      drawGolf(ctx, W, H);
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host)
          S._host.onRoundOver(S.gameOver);
        return;
      }

      const hit = hitTest(mx, my);
      if (!hit)
        return;

      if (hit.area === 'stock') {
        dealFromStock();
        return;
      }

      if (hit.area === 'column') {
        playColumnCard(hit.col);
        return;
      }
    },

    handlePointerMove(mx, my) {
      const col = hitTestColumn(mx, my);
      if (col >= 0 && S.columns[col].length > 0 && canPlayOnWaste(S.columns[col][S.columns[col].length - 1]))
        S.hoverCol = col;
      else
        S.hoverCol = -1;
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (S.roundOver || S.gameOver)
        return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === ' ' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        dealFromStock();
        return;
      }
      if (e.key >= '1' && e.key <= '7') {
        const col = parseInt(e.key, 10) - 1;
        playColumnCard(col);
        return;
      }
    },

    tick(dt) {
      if (CE && CE.updateParticles)
        CE.updateParticles(S.particles);
    },

    cleanup() {
      S.columns = [];
      S.stock = [];
      S.waste = [];
      S.cardsCleared = 0;
      S.moveCount = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.undoHistory = [];
      S.animatingCards = [];
      S.particles = [];
      S.hoverCol = -1;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('golf', module);

})();
