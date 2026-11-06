/* Bezique: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.bezique;
  const S = V.S;
  const { PHASE_PLAY, PHASE_TRICK_DONE, PHASE_MELD_SELECT, PHASE_ROUND_OVER } = V;

  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.playerTotalScore = S.score;
      S.aiTotalScore = 0;
      V.setupBezique();
      if (S._host) S._host.onScoreChanged(S.score);
    },

    draw: V.draw,

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    handleKey(e) {},

    tick(dt) {
      if (S.phase === PHASE_ROUND_OVER) return;

      if (S.phase === PHASE_TRICK_DONE) {
        S.trickDoneTimer += dt;
        if (S.trickDoneTimer >= TRICK_DONE_DELAY)
          V.finishTrick();
        return;
      }

      if (S.phase === PHASE_MELD_SELECT) return;

      if (S.phase !== PHASE_PLAY) return;
      if (S.currentTurn !== 1) return;

      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        let idx;
        if (V.isPhase2()) {
          const valid = V.getValidIndicesPhase2(S.aiHand);
          idx = V.aiChooseCardPhase2(valid);
        } else {
          idx = V.aiChooseCard();
        }
        if (idx >= 0)
          V.playCard(1, idx);
      }
    },

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.stock = [];
      S.playerCaptured = [];
      S.aiCaptured = [];
      S.trickCards = [];
      S.trickPlayers = [];
      S.playerMeldCards = [];
      S.aiMeldCards = [];
      S.playerMeldsUsed = {};
      S.aiMeldsUsed = {};
      S.pendingMeldOptions = [];
      S.trumpCard = null;
      S.trumpSuit = '';
      S.playerMeldScore = 0;
      S.aiMeldScore = 0;
      S.playerTotalScore = 0;
      S.aiTotalScore = 0;
      S.trickCount = 0;
      S.trickWinner = -1;
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_PLAY;
      S.aiTurnTimer = 0;
      S.hoverCardIdx = -1;
      S.hoverMeldBtn = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) {
      S.score = s;
      S.playerTotalScore = s;
    }
  };

  SZ.CardGames.registerVariant('bezique', module);

})();
