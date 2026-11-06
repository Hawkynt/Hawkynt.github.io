/* Beggar Neighbor: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.beggar;
  const S = V.S;
  const { AUTO_BTN, PHASE_IDLE, PHASE_PLAY, PHASE_SHOW, PHASE_COLLECT, FLIP_DURATION,
    COLLECT_DURATION, AUTO_INTERVAL } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = 26;
      V.setupBeggar();
      if (S._host) S._host.onScoreChanged(S.score);
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawBeggar();
    },

    handleClick(mx, my) {
      if (S.gameOver) {
        if (S._host) S._host.onRoundOver(true);
        return;
      }
      if (S.phase !== PHASE_IDLE || S.roundOver) return;

      // Auto button
      if (CE.isInRect(mx, my, AUTO_BTN.x, AUTO_BTN.y, AUTO_BTN.w, AUTO_BTN.h)) {
        S.autoPlay = !S.autoPlay;
        S.autoTimer = 0;
        return;
      }

      // Next button or anywhere else
      V.playOneCard();
    },

    handleKey(e) {
      if (S.gameOver) return;
      if (S.phase !== PHASE_IDLE || S.roundOver) return;

      if (e.key === 'n' || e.key === 'N' || e.key === ' ')
        V.playOneCard();
      else if (e.key === 'a' || e.key === 'A') {
        S.autoPlay = !S.autoPlay;
        S.autoTimer = 0;
      }
    },

    tick(dt) {
      if (S.gameOver) return;

      // Auto play timer
      if (S.autoPlay && S.phase === PHASE_IDLE && !S.roundOver) {
        S.autoTimer += dt;
        if (S.autoTimer >= AUTO_INTERVAL) {
          S.autoTimer = 0;
          V.playOneCard();
        }
      }

      switch (S.phase) {
        case PHASE_PLAY:
          S.flipAnimProgress += dt;
          if (S.flipAnimProgress >= FLIP_DURATION) {
            S.flipAnimProgress = FLIP_DURATION;
            V.resolveCard();
          }
          break;

        case PHASE_SHOW:
          S.phaseTimer += dt;
          if (S.collectTarget) {
            // Waiting to collect
            if (S.phaseTimer >= 0.8) {
              S.phase = PHASE_COLLECT;
              S.collectProgress = 0;
            }
          } else {
            // Brief pause then back to idle for next card
            const delay = S.autoPlay ? 0.15 : 0.4;
            if (S.phaseTimer >= delay)
              S.phase = PHASE_IDLE;
          }
          break;

        case PHASE_COLLECT:
          S.collectProgress += dt;
          if (S.collectProgress >= COLLECT_DURATION)
            V.collectCards();
          break;
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      S.playerPile = [];
      S.aiPile = [];
      S.centerPile = [];
      S.penaltyRemaining = 0;
      S.penaltyTotal = 0;
      S.penaltyChallenger = '';
      S.collectTarget = '';
      S.currentCard = null;
      S.phase = PHASE_IDLE;
      S.phaseTimer = 0;
      S.flipAnimProgress = 0;
      S.collectProgress = 0;
      S.resultText = '';
      S.roundOver = false;
      S.gameOver = false;
      S.autoPlay = false;
      S.autoTimer = 0;
      S.score = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('beggar', module);

})();
