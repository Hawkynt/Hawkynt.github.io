/* Piquet: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.piquet;
  const S = V.S;
  const { PHASE_EXCHANGE, PHASE_DECLARE_POINT, PHASE_DECLARE_SEQUENCE, PHASE_DECLARE_SET,
    PHASE_TRICK_PLAY, PHASE_TRICK_DONE } = V;

  const TRICK_DONE_DELAY = 1.0;

  const AI_DELAY = 0.7;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      if (S.score !== 0)
        S.playerScore = S.score;
      V.setupGame();
    },

    draw: V.draw,

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp(mx, my, e) {},

    handleKey: V.handleKey,

    tick(dt) {
      // Declaration auto-advance timer
      if (S.phase === PHASE_DECLARE_POINT || S.phase === PHASE_DECLARE_SEQUENCE || S.phase === PHASE_DECLARE_SET) {
        S.declPhaseTimer -= dt;
        if (S.declPhaseTimer <= 0)
          V.advanceDeclarationPhase();
        return;
      }

      // Trick done timer
      if (S.phase === PHASE_TRICK_DONE) {
        S.trickDoneTimer += dt;
        if (S.trickDoneTimer >= TRICK_DONE_DELAY)
          V.finishTrick();
        return;
      }

      // AI trick play
      if (S.phase === PHASE_TRICK_PLAY && S.currentTurn === 1) {
        S.aiTimer += dt;
        if (S.aiTimer >= AI_DELAY) {
          S.aiTimer = 0;
          const idx = V.aiChooseCard();
          if (idx >= 0)
            V.playCard(1, idx);
        }
      }
    },

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.talon = [];
      S.deck = [];
      S.trickCards = [];
      S.selectedIndices = [];
      S.declResults = [];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_EXCHANGE;
      S.resultMsg = '';
      S.pendingAiAction = false;
      S.aiTimer = 0;
      S.hoverCardIdx = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; S.playerScore = s; }
  };

  SZ.CardGames.registerVariant('piquet', module);

})();
