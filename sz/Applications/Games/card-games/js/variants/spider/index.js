;(function() {
  'use strict';

  /* Spider: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spider;
  const S = V.S;
  const {
    BASE_W, BASE_H, tableauCardPos, saveState, doUndo, startTimer, stopTimer, isValidRun,
    dealFromStock, hitTest, tryDrop, stopCompletionAnim, stopWinAnimation, newGame, drawScene
  } = V;

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._canvas = canvas;
      S._host = host || null;
      S.canvasW = W;
      S.canvasH = H;
      S.scale = Math.min(W / BASE_W, H / BASE_H);
      newGame();
    },

    draw(ctx, W, H) {
      S.canvasW = W;
      S.canvasH = H;
      S.scale = Math.min(W / BASE_W, H / BASE_H);
      S._ctx = ctx;

      if (S.winAnimRunning)
        return; // win animation drives its own rAF loop

      drawScene(ctx);
    },

    handleClick(mx, my) {
      if (S.gameWon) {
        stopWinAnimation();
        newGame();
        return;
      }

      S.pointerStartX = mx;
      S.pointerStartY = my;

      const hit = hitTest(mx, my);
      if (!hit)
        return;

      const now = Date.now();
      S.lastClickTime = now;
      S.lastClickHit = hit;

      if (hit.area === 'stock') {
        dealFromStock();
        return;
      }

      if (hit.area === 'tableau') {
        const card = hit.card;
        if (!card || !card.faceUp)
          return;

        if (!isValidRun(hit.col, hit.index))
          return;

        if (!S.gameStarted)
          startTimer();
        saveState();

        const pos = tableauCardPos(hit.col, hit.index);
        const cards = S.tableau[hit.col].slice(hit.index);
        S.dragging = {
          cards,
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: hit.index,
          offsetX: mx - pos.x,
          offsetY: my - pos.y,
          currentX: mx,
          currentY: my
        };
        if (S._canvas)
          S._canvas.setPointerCapture && S._canvas.szPointerId != null && S._canvas.setPointerCapture(S._canvas.szPointerId);
      }
    },

    handlePointerMove(mx, my) {
      if (!S.dragging)
        return;
      S.dragging.currentX = mx;
      S.dragging.currentY = my;
    },

    handlePointerUp(mx, my, e) {
      if (!S.dragging)
        return;

      const dx = mx - S.pointerStartX;
      const dy = my - S.pointerStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        if (S.undoHistory.length > 0)
          S.undoHistory.pop();
        S.dragging = null;
        return;
      }

      if (S._canvas && e && e.pointerId !== undefined)
        S._canvas.releasePointerCapture && S._canvas.releasePointerCapture(e.pointerId);

      tryDrop(mx, my);
    },

    handleKey(e) {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (S.suitCount === 1)
          S.suitCount = 2;
        else if (S.suitCount === 2)
          S.suitCount = 4;
        else
          S.suitCount = 1;
        newGame();
      }
    },

    tick(dt) {
      // Animations are rAF-driven; nothing extra needed per host tick
    },

    cleanup() {
      stopWinAnimation();
      stopTimer();
      stopCompletionAnim();

      S.stock = [];
      S.tableau = [];
      S.completedSuits = 0;
      S.moveCount = 0;
      S.score = 500;
      S.timerSeconds = 0;
      S.gameStarted = false;
      S.gameWon = false;
      S.undoHistory = [];
      S.dragging = null;
      S.flippingCards = [];
      S.dealAnimCards = [];
      S.particles = [];
      S.winAnimCards = [];
      S.completionAnim = null;
      S.statusMsg = '';
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    }
  };

  SZ.CardGames.registerVariant('spider', module);

})();
