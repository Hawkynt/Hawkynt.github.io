/* Faro: wires the variant module and registers it with the suite. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.faro;
  const S = V.S;
  const { PHASE_BETTING, RANKS, CELL_W, CELL_H } = V;

  const module = {
    setup(ctx, canvas, W, H, host) {
      S._ctx = ctx;
      S._host = host || null;
      S.score = (S._host && S._host.getScore) ? S._host.getScore() : 500;
      if (S.score <= 0) S.score = 500;
      V.setupFaro();
    },

    draw(ctx, W, H) {
      S._ctx = ctx;
      V.drawFaro();
    },

    handleClick(mx, my) {
      V.handleClick(mx, my);
    },

    handlePointerMove(mx, my) {
      S.hoverCell = -1;
      if (S.phase !== PHASE_BETTING) return;
      for (let i = 0; i < RANKS.length; ++i) {
        const { x, y } = V.cellPos(i);
        if (CE.isInRect(mx, my, x, y, CELL_W, CELL_H)) {
          S.hoverCell = i;
          return;
        }
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (S.roundOver || S.gameOver) return;
      const k = e.key.toLowerCase();
      if (k === 'd') V.startDeal();
      else if (k === 'c') V.clearAllBets();
      else if (k === '1') S.selectedChip = 10;
      else if (k === '2') S.selectedChip = 25;
      else if (k === '3') S.selectedChip = 50;
      else if (k === 'h') V.placeBetHighCard();
    },

    tick(dt) {
      V.tick(dt);
    },

    cleanup() {
      S.deck = [];
      S.bets = {};
      S.highCardBet = 0;
      S.loserCard = null;
      S.winnerCard = null;
      S.caseKeeper = {};
      S.phase = PHASE_BETTING;
      S.roundOver = false;
      S.gameOver = false;
      S.resultMsg = '';
      S.hoverCell = -1;
      S._ctx = null;
      S._host = null;
    },

    isRoundOver() { return S.roundOver; },
    isGameOver() { return S.gameOver; },
    getScore() { return S.score; },
    setScore(s) { S.score = s; }
  };

  SZ.CardGames.registerVariant('faro', module);

})();
