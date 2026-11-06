;(function() {
  'use strict';

  /* Canfield: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.canfield;
  const S = V.S;
  const {
    BASE_W, BASE_H, reservePos, tableauCardPos, wasteCardPos, startTimer, stopTimer, saveState,
    doUndo, newGame, dealFromStock, hitTest, autoMoveToFoundation, tryDrop, stopWinAnimation,
    drawAll, toInternal
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
      drawAll(ctx, W, H);
    },

    handleClick(mx, my) {
      const pt = toInternal(mx, my);
      const px = pt.x;
      const py = pt.y;

      if (S.gameWon) {
        stopWinAnimation();
        newGame();
        return;
      }

      S.pointerStartX = px;
      S.pointerStartY = py;

      const hit = hitTest(px, py);
      if (!hit)
        return;

      const now = Date.now();
      const isDoubleClick = (now - S.lastClickTime < 400) && S.lastClickHit &&
        S.lastClickHit.area === hit.area &&
        S.lastClickHit.col === hit.col &&
        S.lastClickHit.index === hit.index;
      S.lastClickTime = now;
      S.lastClickHit = hit;

      if (hit.area === 'stock') {
        dealFromStock();
        return;
      }

      // Double-click: auto-move to foundation
      if (isDoubleClick && hit.area === 'waste') {
        const card = S.waste[hit.index];
        if (card && card.faceUp)
          autoMoveToFoundation(card, 'waste', 0, hit.index);
        return;
      }

      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && card.faceUp && hit.index === S.tableau[hit.col].length - 1)
          autoMoveToFoundation(card, 'tableau', hit.col, hit.index);
        return;
      }

      if (isDoubleClick && hit.area === 'reserve') {
        if (S.reserve.length > 0) {
          const card = S.reserve[S.reserve.length - 1];
          if (card.faceUp)
            autoMoveToFoundation(card, 'reserve', 0, 0);
        }
        return;
      }

      // Start drag from waste
      if (hit.area === 'waste') {
        if (hit.index !== S.waste.length - 1)
          return;
        const card = S.waste[hit.index];
        if (!card || !card.faceUp)
          return;
        if (!S.gameStarted)
          startTimer();
        saveState();
        const wpos = wasteCardPos(hit.index);
        S.dragging = {
          cards: [card],
          source: 'waste',
          sourceIndex: hit.index,
          offsetX: px - wpos.x,
          offsetY: py - wpos.y,
          currentX: px,
          currentY: py
        };
        if (S._canvas)
          S._canvas.setPointerCapture && S._canvas.szPointerId != null && S._canvas.setPointerCapture(S._canvas.szPointerId);
        return;
      }

      // Start drag from reserve top
      if (hit.area === 'reserve') {
        if (S.reserve.length === 0)
          return;
        const card = S.reserve[S.reserve.length - 1];
        if (!card.faceUp)
          return;
        if (!S.gameStarted)
          startTimer();
        saveState();
        const rpos = reservePos();
        const stackOff = (Math.min(S.reserve.length, 4) - 1) * 2;
        S.dragging = {
          cards: [card],
          source: 'reserve',
          sourceIndex: S.reserve.length - 1,
          offsetX: px - (rpos.x + stackOff),
          offsetY: py - rpos.y,
          currentX: px,
          currentY: py
        };
        if (S._canvas)
          S._canvas.setPointerCapture && S._canvas.szPointerId != null && S._canvas.setPointerCapture(S._canvas.szPointerId);
        return;
      }

      // Start drag from tableau
      if (hit.area === 'tableau') {
        const card = hit.card;
        if (!card || !card.faceUp)
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
          offsetX: px - pos.x,
          offsetY: py - pos.y,
          currentX: px,
          currentY: py
        };
        if (S._canvas)
          S._canvas.setPointerCapture && S._canvas.szPointerId != null && S._canvas.setPointerCapture(S._canvas.szPointerId);
      }
    },

    handlePointerMove(mx, my) {
      if (!S.dragging)
        return;
      const pt = toInternal(mx, my);
      S.dragging.currentX = pt.x;
      S.dragging.currentY = pt.y;
    },

    handlePointerUp(mx, my, e) {
      if (!S.dragging)
        return;

      const pt = toInternal(mx, my);
      const px = pt.x;
      const py = pt.y;

      const dx = px - S.pointerStartX;
      const dy = py - S.pointerStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        if (S.undoHistory.length > 0)
          S.undoHistory.pop();
        S.dragging = null;
        return;
      }

      if (S._canvas && e && e.pointerId !== undefined)
        S._canvas.releasePointerCapture && S._canvas.releasePointerCapture(e.pointerId);
      tryDrop(px, py);
    },

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
      }
    },

    tick(dt) {},

    cleanup() {
      stopWinAnimation();
      stopTimer();
      S.stock = [];
      S.waste = [];
      S.reserve = [];
      S.foundations = [[], [], [], []];
      S.tableau = [[], [], [], []];
      S.dragging = null;
      S.undoHistory = [];
      S.animatingCards = [];
      S.flippingCards = [];
      S.dealAnimCards = [];
      S.particles = [];
      S.winAnimCards = [];
      S.gameStarted = false;
      S.gameWon = false;
      S.roundOver = false;
      S.gameOver = false;
      S.moveCount = 0;
      S.score = 0;
      S.timerSeconds = 0;
      S.baseRank = -1;
      S.statusMsg = '';
      S.lastClickTime = 0;
      S.lastClickHit = null;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  /* ================================================================
   *  REGISTER WITH HOST
   * ================================================================ */

  SZ.CardGames.registerVariant('canfield', module);

})();
