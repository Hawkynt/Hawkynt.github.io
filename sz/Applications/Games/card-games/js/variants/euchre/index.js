/* Euchre - module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.euchre;
  const S = V.S;
  const { TEAM_A, PHASE_DEALING } = V;

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      if (S.score !== 0) S.teamScores[TEAM_A] = S.score;
      else S.teamScores = [0, 0];
      S.gameOver = false;
      S.dealer = 0;
      V.dealRound();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawAll();
    },

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.kitty = [];
      S.kittyCard = null;
      S.trickCards = [];
      S.trickPlayers = [];
      S.trumpSuit = null;
      S.callingTeam = -1;
      S.callingPlayer = -1;
      S.goingAlone = false;
      S.sittingOutPlayer = -1;
      S.teamScores = [0, 0];
      S.tricksWon = [0, 0];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_DEALING;
      S.aiTurnTimer = 0;
      S.hoveredCard = -1;
      S.hoveredBtn = '';
      S.roundMessage = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) {
      S.score = s;
      S.teamScores[TEAM_A] = s;
    }
  };

  SZ.CardGames.registerVariant('euchre', module);

})();
