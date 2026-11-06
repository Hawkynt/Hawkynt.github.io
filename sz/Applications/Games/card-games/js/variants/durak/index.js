/* Durak: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.durak;
  const S = V.S;

  const AI_TURN_DELAY = 1.0;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupDurak();
    },

    draw: V.draw,

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    handleKey: V.handleKey,

    tick(dt) {
      if (S.roundOver || S.gameOver) return;

      /* AI actions on a timer */
      const isAiTurn = (S.isPlayerAttacking && S.waitingForDefense) ||
                       (!S.isPlayerAttacking && S.attackCards.length === 0) ||
                       (!S.isPlayerAttacking && V.allDefended() && S.attackCards.length > 0);

      if (!isAiTurn) return;

      S.aiTurnTimer += dt;
      if (S.aiTurnTimer < AI_TURN_DELAY) return;
      S.aiTurnTimer = 0;

      if (S.isPlayerAttacking && S.waitingForDefense) {
        /* AI must defend */
        V.aiDefend();
      } else if (!S.isPlayerAttacking && S.attackCards.length === 0) {
        /* AI must attack */
        V.aiAttack();
      } else if (!S.isPlayerAttacking && V.allDefended() && S.attackCards.length > 0) {
        /* AI can add more attack cards or finish */
        V.aiAttack();
      }
    },

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.stock = [];
      S.discard = [];
      S.attackCards = [];
      S.defenseCards = [];
      S.trumpCard = null;
      S.trumpSuit = '';
      S.roundOver = false;
      S.gameOver = false;
      S.isPlayerAttacking = true;
      S.waitingForDefense = false;
      S.boutOver = false;
      S.aiTurnTimer = 0;
      S.aiActionPending = false;
      S.hoverCardIdx = -1;
      S.selectedCardIdx = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('durak', module);

})();
