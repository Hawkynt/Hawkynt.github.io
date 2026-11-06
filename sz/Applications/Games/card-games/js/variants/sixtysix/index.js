/* Sixty-Six - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.sixtysix;
  const S = V.S;
  const { PHASE_PLAY } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      S.playerGamePoints = 0;
      S.aiGamePoints = 0;
      V.setupSixtySix();
      if (S._host) S._host.onScoreChanged(S.score);
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawSixtySix();
    },

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    handleKey(e) {},

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.playerHand); },

    cleanup() {
      S.playerHand = [];
      S.aiHand = [];
      S.stock = [];
      S.playerCaptured = [];
      S.aiCaptured = [];
      S.trickCards = [];
      S.trickPlayers = [];
      S.trumpCard = null;
      S.trumpSuit = '';
      S.playerTrickPoints = 0;
      S.aiTrickPoints = 0;
      S.playerTricksTaken = 0;
      S.aiTricksTaken = 0;
      S.trickCount = 0;
      S.trickWinner = -1;
      S.roundOver = false;
      S.gameOver = false;
      S.matchOver = false;
      S.stockClosed = false;
      S.closedBy = -1;
      S.marriagePending = false;
      S.marriageSuit = '';
      S.marriageShownTimer = 0;
      S.marriageShownSuit = '';
      S.marriageShownBy = -1;
      S.aiDeclaredMarriage = false;
      S.playerGamePoints = 0;
      S.aiGamePoints = 0;
      S.phase = PHASE_PLAY;
      S.aiTurnTimer = 0;
      S.hoverCardIdx = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.matchOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('sixtysix', module);

})();
