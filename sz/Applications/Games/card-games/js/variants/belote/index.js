/* Belote: module interface - wires setup, tick, input and drawing and registers the variant. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.belote;
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

    draw: V.draw,

    handleClick: V.handleClick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp(mx, my, e) {},

    handleKey(e) {},

    tick: V.tick,

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.deck = [];
      S.trickCards = [];
      S.trickPlayers = [];
      S.trumpSuit = null;
      S.proposedCard = null;
      S.takerPlayer = -1;
      S.takerTeam = -1;
      S.teamScores = [0, 0];
      S.teamTrickPoints = [0, 0];
      S.teamBeloteBonus = [0, 0];
      S.beloteDeclared = [false, false, false, false];
      S.rebeloteDeclared = [false, false, false, false];
      S.roundOver = false;
      S.gameOver = false;
      S.phase = PHASE_DEALING;
      S.aiTurnTimer = 0;
      S.hoveredCard = -1;
      S.hoveredBtn = '';
      S.roundMessage = '';
      S.statusText = '';
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

  SZ.CardGames.registerVariant('belote', module);

})();
