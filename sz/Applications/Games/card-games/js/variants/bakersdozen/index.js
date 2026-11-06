;(function() {
  'use strict';

  /* Baker's Dozen: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.bakersdozen;
  const S = V.S;
  const {
    BASE_W, BASE_H, tableauCardPos, newGame, saveState, doUndo, startTimer, stopTimer, hitTest,
    autoMoveToFoundation, tryAutoCompleteStep, isSafeAutoComplete, doAutoComplete,
    moveSelectionTo, tryDrop, stopWinAnimation, isStalemate, drawScene, toGame
  } = V;

  /* ================================================================
   *  PUBLIC INTERFACE
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

      const hit = hitTest(px, py);
      if (!hit) {
        S.selection = null;
        return;
      }

      const now = Date.now();
      const isDoubleClick = (now - S.lastClickTime < 400) && S.lastClickHit &&
        S.lastClickHit.area === hit.area &&
        S.lastClickHit.col === hit.col &&
        S.lastClickHit.index === hit.index;
      S.lastClickTime = now;
      S.lastClickHit = hit;

      // Double-click: auto-move top card to foundation
      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && hit.index === S.tableau[hit.col].length - 1) {
          S.selection = null;
          autoMoveToFoundation(card, hit.col);
        }
        return;
      }

      // If there's a current selection, try to move it to the clicked target
      if (S.selection) {
        const moved = moveSelectionTo(hit);
        if (moved)
          return;
        // Clicking the same card deselects
        if (S.selection.col === hit.col && hit.area === 'tableau') {
          S.selection = null;
          return;
        }
      }

      // Only top cards can be selected/dragged in Baker's Dozen
      if (hit.area === 'tableau') {
        const pile = S.tableau[hit.col];
        if (hit.index !== pile.length - 1)
          return;

        const card = hit.card;
        if (!card)
          return;

        S.selection = { col: hit.col, card };

        const pos = tableauCardPos(hit.col, hit.index);
        if (!S.gameStarted)
          startTimer();
        saveState();
        S.dragging = {
          card,
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: hit.index,
          offsetX: px - pos.x,
          offsetY: py - pos.y,
          currentX: px,
          currentY: py
        };
        S.pointerStartX = px;
        S.pointerStartY = py;
        if (S._canvas)
          S._canvas.setPointerCapture(getLastPointerId());
        return;
      }

      // Clicking foundation or empty tableau with selection
      if (S.selection && (hit.area === 'tableau-empty' || hit.area === 'foundation')) {
        const moved = moveSelectionTo(hit);
        if (!moved)
          S.selection = null;
        return;
      }

      S.selection = null;
    },

    handlePointerMove(mx, my) {
      if (!S.dragging)
        return;
      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      const dx = px - S.pointerStartX;
      const dy = py - S.pointerStartY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5)
        return;

      S.dragging.currentX = px;
      S.dragging.currentY = py;
    },

    handlePointerUp(mx, my, e) {
      if (!S.dragging)
        return;

      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      const dx = px - S.pointerStartX;
      const dy = py - S.pointerStartY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        if (S.undoHistory.length > 0)
          S.undoHistory.pop();
        S.dragging = null;
        return;
      }

      if (S._canvas && e && e.pointerId !== undefined)
        S._canvas.releasePointerCapture(e.pointerId);
      S.selection = null;
      tryDrop(px, py);
    },

    handleKey(e) {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === 'a' && !e.ctrlKey && !e.altKey) {
        if (tryAutoCompleteStep() && isSafeAutoComplete())
          doAutoComplete();
        return;
      }
      if (e.key === 'Escape')
        S.selection = null;
    },

    tick(dt) {},

    cleanup() {
      stopWinAnimation();
      stopTimer();
      S.foundations = [[], [], [], []];
      S.tableau = [];
      S.undoHistory = [];
      S.dragging = null;
      S.selection = null;
      S.dealAnimCards = [];
      S.dealAnimRunning = false;
      S.animatingCards = [];
      S.particles = [];
      S.gameWon = false;
      S.gameStarted = false;
      S.moveCount = 0;
      S.score = 0;
      S.timerSeconds = 0;
      S.lastClickTime = 0;
      S.lastClickHit = null;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.gameWon; },
    isGameOver() { return S.gameWon || isStalemate(); },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  function getLastPointerId() {
    return S._lastPointerId;
  }

  const origSetup = module.setup;
  module.setup = function(ctx, canvas, W, H, host) {
    origSetup.call(this, ctx, canvas, W, H, host);
    if (S._canvas) {
      S._canvas.addEventListener('pointerdown', function(ev) {
        S._lastPointerId = ev.pointerId;
      });
    }
  };

  /* ================================================================
   *  REGISTER WITH HOST
   * ================================================================ */

  SZ.CardGames.registerVariant('bakersdozen', module);

})();
