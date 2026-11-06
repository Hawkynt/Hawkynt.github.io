;(function() {
  'use strict';

  /* Clock: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.clock;
  const S = V.S;
  const {
    AUTO_BTN, NEXT_BTN, MOVE_DURATION, AUTO_INTERVAL, startMove, newGame, hitTestPile, isInRect,
    drawClock
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
      drawClock(ctx, W, H);
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host)
          S._host.onRoundOver(S.gameOver);
        return;
      }

      // Auto play button
      if (isInRect(mx, my, AUTO_BTN)) {
        S.autoPlaying = !S.autoPlaying;
        S.autoTimer = 0;
        return;
      }

      // Next button (manual step)
      if (!S.autoPlaying && isInRect(mx, my, NEXT_BTN)) {
        startMove();
        return;
      }

      // Clicking anywhere else also steps (convenient)
      if (!S.autoPlaying && !S.animating)
        startMove();
    },

    handlePointerMove(mx, my) {
      S.hoverPile = hitTestPile(mx, my);
    },

    handlePointerUp(mx, my) {},

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;

      if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
        e.preventDefault();
        if (!S.autoPlaying && !S.animating)
          startMove();
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        S.autoPlaying = !S.autoPlaying;
        S.autoTimer = 0;
        return;
      }
    },

    tick(dt) {
      // Animation update
      if (S.animating) {
        S.animProgress += dt;
        if (S.animProgress >= MOVE_DURATION) {
          S.animProgress = MOVE_DURATION;
          S.animating = false;
          const cb = S.animCallback;
          S.animCard = null;
          S.animCallback = null;
          if (cb) cb();
        }
      }

      // Auto play timer
      if (S.autoPlaying && !S.roundOver && !S.gameOver && !S.animating) {
        S.autoTimer += dt;
        if (S.autoTimer >= AUTO_INTERVAL) {
          S.autoTimer = 0;
          startMove();
        }
      }
    },

    cleanup() {
      S.piles = [];
      S.score = 0;
      S.cardsPlaced = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.currentCard = null;
      S.currentFromPile = -1;
      S.autoPlaying = false;
      S.autoTimer = 0;
      S.animating = false;
      S.animCard = null;
      S.animCallback = null;
      S.hoverPile = -1;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('clock', module);

})();
