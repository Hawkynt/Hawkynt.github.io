;(function() {
  'use strict';

  /* TriPeaks: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.tripeaks;
  const S = V.S;
  const {
    doUndo, newGame, dealFromStock, playCard, updateParticles, hitTestPeaks, hitTestStock,
    drawGame
  } = V;

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      newGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      drawGame();
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host)
          S._host.onRoundOver(S.gameOver);
        return;
      }

      // Check stock click
      if (hitTestStock(mx, my)) {
        dealFromStock();
        return;
      }

      // Check peak card click
      const peakIdx = hitTestPeaks(mx, my);
      if (peakIdx >= 0)
        playCard(peakIdx);
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
        if (S._host)
          S._host.onScoreChanged(S.score);
        return;
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
      }
    },

    tick(dt) {
      updateParticles();
    },

    cleanup() {
      S.peaks = [];
      S.stock = [];
      S.waste = [];
      S.streak = 0;
      S.score = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.peaksCleared = false;
      S.resultMsg = '';
      S.undoHistory = [];
      S.animatingCards = [];
      S.particles = [];
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('tripeaks', module);

})();
