;(function() {
  'use strict';

  /* Accordion: module interface wiring the host callbacks to the variant;
     registers it with the suite. Loaded last. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.accordion;
  const S = V.S;
  const { CE, validTargets, doUndo, movePile, newGame, hitTest, drawAccordion } = V;

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
      drawAccordion(ctx, W, H);
    },

    handleClick(mx, my) {
      if (S.roundOver || S.gameOver) {
        if (S._host)
          S._host.onRoundOver(S.gameOver);
        return;
      }

      const hit = hitTest(mx, my);

      // Clicked empty space — deselect
      if (hit < 0) {
        S.selected = -1;
        return;
      }

      // Nothing selected yet — select this pile
      if (S.selected < 0) {
        // Only allow selecting piles that have valid moves
        if (validTargets(hit).length > 0)
          S.selected = hit;
        return;
      }

      // Clicked the already-selected pile — deselect
      if (hit === S.selected) {
        S.selected = -1;
        return;
      }

      // Check if clicked pile is a valid target for the selected pile
      const targets = validTargets(S.selected);
      if (targets.includes(hit)) {
        movePile(S.selected, hit);
        return;
      }

      // Clicked a different pile — re-select if it has moves, otherwise deselect
      if (validTargets(hit).length > 0)
        S.selected = hit;
      else
        S.selected = -1;
    },

    handlePointerMove(mx, my) {
      const hit = hitTest(mx, my);
      S.hoverIdx = hit;
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
      if (e.key === 'Escape') {
        S.selected = -1;
        return;
      }
    },

    tick(dt) {
      if (CE && CE.updateParticles)
        CE.updateParticles(S.particles);
    },

    cleanup() {
      S.piles = [];
      S.selected = -1;
      S.moveCount = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.undoHistory = [];
      S.animatingCards = [];
      S.particles = [];
      S.hoverIdx = -1;
      S._ctx = null;
      S._canvas = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('accordion', module);

})();
