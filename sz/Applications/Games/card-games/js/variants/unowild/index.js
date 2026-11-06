/* Uno All Wild: module interface and registration. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v['unowild'];
  const S = V.S;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupGame();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawGame();
    },

    handleClick: V.handleClick,

    handleKey: V.handleKey,

    tick: V.tick,

    handlePointerMove: V.handlePointerMove,

    handlePointerUp() {},

    sortPlayerHand() { V.sortHand(S.hands[0]); },

    cleanup() {
      S.hands = [[], [], [], []];
      S.deck = [];
      S.discardPile = [];
      S.topCard = null;
      S.direction = 1;
      S.currentPlayer = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.aiTurnTimer = 0;
      S.hoverCardIdx = -1;
      S.waitingForTargetChoice = false;
      S.waitingForGapChoice = false;
      S.targetAction = null;
      S.targetSourcePlayer = -1;
      S.targetCard = null;
      S.gapSourcePlayer = -1;
      SZ.CardGames.shared.sheddingPlaces.resetPlaces(S);
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('unowild', module);

})();
