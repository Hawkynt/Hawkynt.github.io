/* Three Card Poker: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.threecard;
  const S = V.S;
  const { PHASE_BETTING } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 1000;
      if (S.score <= 0) S.score = 1000;
      V.setupThreeCard();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawThreeCard();
      V.drawPayoutTable();
    },

    handleClick(mx, my) {
      V.handleClick(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      V.handleKey(e);
    },

    tick(dt) {
      V.tick(dt);
    },

    cleanup() {
      S.playerHand = [];
      S.dealerHand = [];
      S.deck = [];
      S.phase = PHASE_BETTING;
      S.anteBet = 0;
      S.pairPlusBet = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.resultDetail = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('threecard', module);

})();
