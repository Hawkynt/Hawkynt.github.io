/* Memory: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.memory;
  const S = V.S;
  const { FLIP_DURATION, NEW_GAME_BTN } = V;

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 200;
      if (S.score <= 0)
        S.score = 200;
      V.newGame();
    },

    draw(ctx, W, H) {
      V.drawScene(ctx, W, H);
    },

    handleClick(mx, my) {
      // Game over: new game button
      if (S.roundOver) {
        if (CE.isInRect(mx, my, NEW_GAME_BTN.x, NEW_GAME_BTN.y, NEW_GAME_BTN.w, NEW_GAME_BTN.h)) {
          if (S._host)
            S._host.onRoundOver(true);
          else
            V.newGame();
        }
        return;
      }

      // Ignore clicks during deal animation
      if (S.dealAnimActive)
        return;

      // Ignore clicks during flip-back delay
      if (S.flipLockTimer > 0)
        return;

      // Ignore clicks during active flip animation
      for (const card of S.cards)
        if (card.flipDirection)
          return;

      const index = V.hitTestGrid(mx, my);
      if (index < 0)
        return;

      const card = S.cards[index];

      // Ignore matched or already face-up cards
      if (card.matched || card.faceUp)
        return;

      if (S.firstPick < 0) {
        // First card of the pair
        S.firstPick = index;
        card.faceUp = true;
        V.startFlip(index, 'up');
      } else if (S.secondPick < 0 && index !== S.firstPick) {
        // Second card of the pair
        S.secondPick = index;
        card.faceUp = true;
        V.startFlip(index, 'up');

        // Delay match check until flip animation completes
        setTimeout(() => {
          V.checkMatch();
        }, FLIP_DURATION + 50);
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        V.newGame();
      }
    },

    tick(dt) {
      // Handle flip-back timer for unmatched pairs
      if (S.flipLockTimer > 0) {
        S.flipLockTimer -= dt;
        if (S.flipLockTimer <= 0) {
          S.flipLockTimer = 0;
          V.flipBackUnmatched();
        }
      }
    },

    cleanup() {
      S.cards = [];
      S.firstPick = -1;
      S.secondPick = -1;
      S.flipLockTimer = 0;
      S.moves = 0;
      S.matchesFound = 0;
      S.score = 200;
      S.roundOver = false;
      S.gameOver = false;
      S.dealAnimActive = false;
      S.dealAnimCards = [];
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('memory', module);

})();
