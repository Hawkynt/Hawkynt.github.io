;(function() {
  'use strict';

  /* FreeCell: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.freecell;
  const S = V.S;
  const {
    BASE_W, BASE_H, newGame, saveState, doUndo, startTimer, stopTimer, freeCellPos,
    tableauCardPos, hitTest, isValidRun, autoMoveToFoundation, tryAutoCompleteStep,
    doAutoComplete, moveSelectionTo, tryDrop, stopWinAnimation, drawScene, toGame
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

      if (isDoubleClick && hit.area === 'freecell') {
        const card = S.freeCells[hit.col];
        if (card) {
          S.selection = null;
          autoMoveToFoundation(card, 'freecell', hit.col);
        }
        return;
      }

      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && hit.index === S.tableau[hit.col].length - 1) {
          S.selection = null;
          autoMoveToFoundation(card, 'tableau', hit.col);
        }
        return;
      }

      if (S.selection) {
        const moved = moveSelectionTo(hit);
        if (moved)
          return;
        if (S.selection.source === hit.area && S.selection.col === hit.col &&
          ((hit.area === 'freecell') || (hit.area === 'tableau' && S.selection.index === hit.index))) {
          S.selection = null;
          return;
        }
      }

      if (hit.area === 'freecell') {
        const card = S.freeCells[hit.col];
        if (card) {
          S.selection = { source: 'freecell', col: hit.col, index: 0, cards: [card] };
          const pos = freeCellPos(hit.col);
          if (!S.gameStarted)
            startTimer();
          saveState();
          S.dragging = {
            cards: [card],
            source: 'freecell',
            sourceCol: hit.col,
            sourceIndex: 0,
            offsetX: px - pos.x,
            offsetY: py - pos.y,
            currentX: px,
            currentY: py
          };
          S.pointerStartX = px;
          S.pointerStartY = py;
          if (S._canvas)
            S._canvas.setPointerCapture(getLastPointerId());
        }
        return;
      }

      if (hit.area === 'tableau') {
        const card = hit.card;
        if (!card)
          return;

        let runStart = hit.index;
        if (!isValidRun(hit.col, runStart)) {
          for (let s = hit.index; s < S.tableau[hit.col].length; ++s) {
            if (isValidRun(hit.col, s)) {
              runStart = s;
              break;
            }
          }
          if (!isValidRun(hit.col, runStart))
            return;
        }

        const cards = S.tableau[hit.col].slice(runStart);
        S.selection = { source: 'tableau', col: hit.col, index: runStart, cards };

        const pos = tableauCardPos(hit.col, runStart);
        if (!S.gameStarted)
          startTimer();
        saveState();
        S.dragging = {
          cards,
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: runStart,
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

      if (S.selection && (hit.area === 'tableau-empty' || hit.area === 'foundation' || hit.area === 'freecell-empty')) {
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
        if (tryAutoCompleteStep())
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
      S.freeCells = [null, null, null, null];
      S.foundations = [[], [], [], []];
      S.tableau = [[], [], [], [], [], [], [], []];
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
      S.timerSeconds = 0;
      S.lastClickTime = 0;
      S.lastClickHit = null;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    }
  };

  function getLastPointerId() {
    return S._lastPointerId;
  }

  const origSetup = module.setup;
  /* remember which pointer started a drag; one listener per canvas */
  module.setup = function(ctx, canvas, W, H, host) {
    origSetup.call(this, ctx, canvas, W, H, host);
    if (S._canvas && !S._canvas.szTrackPointerFreeCell) {
      S._canvas.szTrackPointerFreeCell = true;
      S._canvas.addEventListener('pointerdown', function(ev) {
        S._lastPointerId = ev.pointerId;
      });
    }
  };

  /* ================================================================
   *  REGISTER WITH HOST
   * ================================================================ */

  SZ.CardGames.registerVariant('freecell', module);

})();
