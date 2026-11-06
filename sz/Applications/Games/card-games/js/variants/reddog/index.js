/* Red Dog: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.reddog;
  const S = V.S;
  const { PHASE_BET, PHASE_SHOW_POSTS } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 500;
      if (S.score <= 0) S.score = 500;
      V.setupRedDog();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawRedDog();
    },

    handleClick(mx, my) {
      V.handleClick(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;
      const k = e.key.toLowerCase();
      if (S.phase === PHASE_BET) {
        if (k === 'd') V.startDeal();
        else if (k === '1') S.selectedChip = 10;
        else if (k === '2') S.selectedChip = 25;
        else if (k === '3') S.selectedChip = 50;
        else if (k === '4') S.selectedChip = 100;
        else if (k === '+' || k === '=') V.adjustBet(S.selectedChip);
        else if (k === '-') V.adjustBet(-S.selectedChip);
        else if (k === 'c') { V.clearBet(); S.betAmount = 10; }
      } else if (S.phase === PHASE_SHOW_POSTS) {
        if (k === 'r') V.playerRaise();
        else if (k === 'c' || k === 'd') V.playerCall();
      }
    },

    tick(dt) {
      V.tick(dt);
    },

    cleanup() {
      S.postCards = [];
      S.middleCard = null;
      S.deck = [];
      S.phase = PHASE_BET;
      S.betAmount = 0;
      S.raisedBet = 0;
      S.spread = 0;
      S.payoutMultiplier = 0;
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

  SZ.CardGames.registerVariant('reddog', module);

})();
