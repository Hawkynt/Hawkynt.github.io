/* Sevens: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sevens;
  const S = V.S;
  const { AI_TURN_DELAY, PASS_BTN } = V;

  const module = {

    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawAll();
    },

    handleClick(mx, my) {
      if (S.roundOver) {
        if (S.gameOver) {
          S.gameOver = false;
          S.cumulativeScores = [0, 0, 0, 0];
          S.roundNumber = 0;
          S.score = 0;
          if (S._host) S._host.onScoreChanged(S.score);
        }
        S.roundOver = false;
        V.dealRound();
        return;
      }

      if (S.currentTurn !== 0) return;

      // Check pass button
      const valid = V.getValidPlays(S.hands[0]);
      if (valid.length === 0 && CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
        V.doPass(0);
        return;
      }

      // Check card click
      const idx = V.hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      if (V.canPlace(S.hands[0][idx])) {
        V.doPlayCard(0, idx);
      } else {
        if (S._host && S._host.floatingText)
          S._host.floatingText.add(mx, my - 20, 'Cannot play this card!', { color: '#f88', size: 14 });
      }
    },

    handlePointerMove(mx, my) {
      S.hoverCardIdx = -1;
      S.hoverPassBtn = false;

      if (S.currentTurn === 0 && !S.roundOver) {
        S.hoverCardIdx = V.hitTestPlayerCard(mx, my);
        const valid = V.getValidPlays(S.hands[0]);
        if (valid.length === 0)
          S.hoverPassBtn = CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h);
      }
    },

    handlePointerUp() {},

    handleKey(e) {
      if (S.roundOver) return;
      if (S.currentTurn !== 0) return;

      // Space to pass
      if (e.key === ' ') {
        const valid = V.getValidPlays(S.hands[0]);
        if (valid.length === 0) {
          e.preventDefault();
          V.doPass(0);
        }
      }
    },

    tick(dt) {
      if (S.roundOver) return;
      if (S.currentTurn === 0) return;

      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;

        const hand = S.hands[S.currentTurn];
        const validIdx = V.aiChooseCard(S.currentTurn);

        if (validIdx >= 0)
          V.doPlayCard(S.currentTurn, validIdx);
        else
          V.doPass(S.currentTurn);
      }
    },

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.suitRows = {};
      S.placedCards = {};
      S.cumulativeScores = [0, 0, 0, 0];
      S.roundScores = [0, 0, 0, 0];
      S.totalPasses = [0, 0, 0, 0];
      S.roundOver = false;
      S.gameOver = false;
      S.currentTurn = 0;
      S.passCount = 0;
      S.aiTurnTimer = 0;
      S.hoverCardIdx = -1;
      S.hoverPassBtn = false;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('sevens', module);

})();
