/* Sevens: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sevens;
  const S = V.S;
  const { PLAYER_HAND_Y } = V;

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  Object.assign(V, { hitTestPlayerCard });

})();
