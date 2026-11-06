/* Doppelkopf - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.doppelkopf;
  const S = V.S;
  const { PHASE_PLAYING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.startRoundFromSetup();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawDoppelkopf();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    /* match progress (round, dealer, totals, continueMatch) survives so the next setup deals the next round */
    cleanup() {
      S.hands = [[], [], [], []];
      S.trickCards = [];
      S.trickPlayers = [];
      S.tricks = [];
      S.tricksWon = [0, 0, 0, 0];
      S.result = null;
      S.roundOver = false;
      S.phase = PHASE_PLAYING;
      S.aiTurnTimer = 0;
      S.trickDoneTimer = 0;
      S.hoverCardIdx = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('doppelkopf', module);

})();
