/* Baccarat: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.baccarat;
  const S = V.S;
  const { PHASE_BETTING, BET_PLAYER, BET_BANKER, BET_TIE } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 1000;
      if (S.score <= 0) S.score = 1000;
      V.setupBaccarat();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawBaccarat();
    },

    handleClick(mx, my) {
      V.handleClick(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;
      const k = e.key.toLowerCase();
      if (k === 'd') V.startDeal();
      else if (k === '1') { S.selectedChip = 10; }
      else if (k === '2') { S.selectedChip = 25; }
      else if (k === '3') { S.selectedChip = 50; }
      else if (k === '4') { S.selectedChip = 100; }
      else if (k === 'p') V.placeBet(BET_PLAYER);
      else if (k === 'b') V.placeBet(BET_BANKER);
      else if (k === 't') V.placeBet(BET_TIE);
      else if (k === 'c') V.clearBet();
    },

    tick(dt) {
      V.tick(dt);
    },

    cleanup() {
      S.playerHand = [];
      S.bankerHand = [];
      S.shoe = [];
      S.phase = PHASE_BETTING;
      S.betTarget = null;
      S.betAmount = 0;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('baccarat', module);

})();
