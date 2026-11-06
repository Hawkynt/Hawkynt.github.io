/* Old Maid: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.oldmaid;
  const S = V.S;
  const { CANVAS_H, PHASE_PLAYER_DRAW } = V;

  function cardKey(card) {
    return card.rank + card.suit;
  }

  function hitTestAiCards(mx, my) {
    if (S.phase !== PHASE_PLAYER_DRAW) return -1;
    const total = S.aiDrawableOrder.length;
    if (total === 0) return -1;

    const y = 80;
    for (let di = total - 1; di >= 0; --di) {
      const x = V.aiDrawCardX(di, total);
      const rightEdge = di === total - 1 ? x + CE.CARD_W : V.aiDrawCardX(di + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return S.aiDrawableOrder[di];
    }
    return -1;
  }

  function hitTestPlayerCards(mx, my) {
    const total = S.playerHand.length;
    if (total === 0) return -1;

    const y = CANVAS_H - CE.CARD_H - 20;
    for (let i = total - 1; i >= 0; --i) {
      const x = V.playerCardX(i, total);
      const rightEdge = i === total - 1 ? x + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  Object.assign(V, { hitTestAiCards });

})();
