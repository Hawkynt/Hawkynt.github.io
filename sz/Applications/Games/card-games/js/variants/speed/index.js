/* Speed: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.speed;
  const S = V.S;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 0;
      V.setupSpeed();
      if (S._host) S._host.onScoreChanged(S.score);
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawSpeed();
    },

    handleClick(mx, my) {
      V.handleClickImpl(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      V.handleKeyImpl(e);
    },

    tick(dt) {
      V.tickImpl(dt);
    },

    cleanup() {
      S.playerHand = [];
      S.playerDraw = [];
      S.playerReserve = [];
      S.aiHand = [];
      S.aiDraw = [];
      S.aiReserve = [];
      S.centerPiles = [[], []];
      S.selectedIndex = -1;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.showFlipButton = false;
      S.stuckCheckTimer = 0;
      S.aiTimer = 0;
      S.aiDelay = 0;
      S.score = 0;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('speed', module);

})();
