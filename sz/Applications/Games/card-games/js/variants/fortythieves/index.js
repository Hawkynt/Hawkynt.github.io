;(function() {
  'use strict';

  /* Forty Thieves: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.fortythieves;
  const S = V.S;
  const {
    BASE_W, BASE_H, wastePos, tableauCardPos, startTimer, stopTimer, saveState, doUndo, newGame,
    dealFromStock, autoMoveToFoundation, hitTest, tryDrop, stopWinAnimation, findHints, drawScene,
    toGame, isStalemate
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
      drawScene(ctx, W, H);
    },

    handleClick(mx, my) {
      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      if (S.gameWon) {
        stopWinAnimation();
        newGame();
        return;
      }

      if (S.dealAnimRunning)
        return;

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
        // Check for stalemate after dealing
        if (S.stock.length === 0 && S.waste.length > 0)
          setTimeout(() => {
            if (isStalemate())
              S.statusMsg = 'No more moves available!';
          }, 300);
        return;
      }

      // Double-click waste -> auto foundation
      if (isDoubleClick && hit.area === 'waste') {
        const card = S.waste[hit.index];
        if (card && card.faceUp)
          autoMoveToFoundation(card, 'waste', 0, hit.index);
        return;
      }

      // Double-click tableau top -> auto foundation
      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && hit.index === S.tableau[hit.col].length - 1)
          autoMoveToFoundation(card, 'tableau', hit.col, hit.index);
        return;
      }

      // Single card drag from waste
      if (hit.area === 'waste') {
        if (hit.index !== S.waste.length - 1)
          return;
        const card = S.waste[hit.index];
        if (!card || !card.faceUp)
          return;
        if (!S.gameStarted)
          startTimer();
        saveState();
        S.dragging = {
          cards: [card],
          source: 'waste',
          sourceIndex: hit.index,
          offsetX: px - wastePos().x,
          offsetY: py - wastePos().y,
          currentX: px,
          currentY: py
        };
        if (S._canvas && S._canvas.setPointerCapture)
          S._canvas.szPointerId != null && S._canvas.setPointerCapture(S._canvas.szPointerId);
        return;
      }

      // Single card drag from tableau (only top card in Forty Thieves)
      if (hit.area === 'tableau') {
        const card = hit.card;
        if (!card || !card.faceUp)
          return;
        // Forty Thieves: only the top card can be moved
        if (hit.index !== S.tableau[hit.col].length - 1)
          return;
        if (!S.gameStarted)
          startTimer();
        saveState();
        const pos = tableauCardPos(hit.col, hit.index);
        S.dragging = {
          cards: [card],
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: hit.index,
          offsetX: px - pos.x,
          offsetY: py - pos.y,
          currentX: px,
          currentY: py
        };
        if (S._canvas && S._canvas.setPointerCapture)
          S._canvas.szPointerId != null && S._canvas.setPointerCapture(S._canvas.szPointerId);
      }
    },

    handlePointerMove(mx, my) {
      if (!S.dragging)
        return;
      const p = toGame(mx, my);
      S.dragging.currentX = p.x;
      S.dragging.currentY = p.y;
    },

    handlePointerUp(mx, my, e) {
      if (!S.dragging)
        return;

      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      const dx = px - S.pointerStartX;
      const dy = py - S.pointerStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        if (S.undoHistory.length > 0)
          S.undoHistory.pop();
        S.dragging = null;
        return;
      }

      if (S._canvas && e && e.pointerId !== undefined && S._canvas.releasePointerCapture)
        S._canvas.releasePointerCapture(e.pointerId);

      tryDrop(px, py);
    },

    handleKey(e) {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        const hints = findHints();
        if (hints.length === 0)
          S.statusMsg = 'No hints available';
        else
          S.statusMsg = hints.length + ' possible move' + (hints.length > 1 ? 's' : '') + ' available';
      }
    },

    tick(dt) {
      // Animations driven by draw loop
    },

    cleanup() {
      stopWinAnimation();
      stopTimer();

      S.stock = [];
      S.waste = [];
      S.foundations = [[], [], [], [], [], [], [], []];
      S.tableau = [[], [], [], [], [], [], [], [], [], []];
      S.undoHistory = [];
      S.dragging = null;
      S.animatingCards = [];
      S.dealAnimCards = [];
      S.dealAnimRunning = false;
      S.particles = [];
      S.winAnimCards = [];
      S.gameWon = false;
      S.gameStarted = false;
      S.moveCount = 0;
      S.score = 0;
      S.timerSeconds = 0;
      S.statusMsg = '';
      S.lastClickTime = 0;
      S.lastClickHit = null;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.gameWon; },
    isGameOver() { return S.gameWon || (S.stock.length === 0 && isStalemate()); },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('fortythieves', module);

})();
