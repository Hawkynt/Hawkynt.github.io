/* Baccarat: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.baccarat;
  const S = V.S;
  const { CANVAS_W, PHASE_BETTING, PHASE_DEALING, PHASE_DRAWING, HAND_Y, PLAYER_HAND_X,
    BANKER_HAND_X, CARD_GAP } = V;

  function startDeal() {
    if (S.phase !== PHASE_BETTING || !S.betTarget || S.betAmount <= 0) return;
    S.phase = PHASE_DEALING;
    S.playerHand = [];
    S.bankerHand = [];
    S.resultMsg = '';
    S.dealStep = 0;
    S.dealTimer = 0;
  }

  function dealNextCard() {
    const card = V.drawFromShoe();
    card.faceUp = true;
    const isPlayer = S.dealStep % 2 === 0;
    const hand = isPlayer ? S.playerHand : S.bankerHand;
    hand.push(card);
    const baseX = isPlayer ? PLAYER_HAND_X : BANKER_HAND_X;
    const idx = hand.length - 1;
    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, baseX + idx * (CE.CARD_W + CARD_GAP), HAND_Y, 0);
    ++S.dealStep;
  }

  function setupBaccarat() {
    if (S.shoe.length < 52)
      S.shoe = V.createShoe();
    S.playerHand = [];
    S.bankerHand = [];
    S.phase = PHASE_BETTING;
    S.betTarget = null;
    S.betAmount = 0;
    S.selectedChip = 10;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.dealStep = 0;
    S.dealTimer = 0;
    S.drawStep = 0;
    S.drawTimer = 0;
  }

  function tick(dt) {
    if (S.phase === PHASE_DEALING) {
      S.dealTimer += dt;
      if (S.dealTimer >= 0.35) {
        S.dealTimer = 0;
        dealNextCard();
        if (S.dealStep >= 4)
          V.checkNaturalOrDraw();
      }
      return;
    }

    if (S.phase === PHASE_DRAWING) {
      S.drawTimer += dt;
      if (S.drawTimer >= 0.5) {
        S.drawTimer = 0;
        V.applyThirdCards();
      }
    }
  }

  Object.assign(V, { startDeal, setupBaccarat, tick });

})();
