/* Dos: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['dos'];
  const S = V.S;
  const { CANVAS_W } = V;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) { if (S._host) S._host.onRoundOver(S.gameOver); return; }
    if (S.currentPlayer !== 0) return;

    // Clear button
    if (S.selectedCards.length > 0 && CE.isInRect(mx, my, CANVAS_W - 180, 440, 70, 28)) {
      S.selectedCards = [];
      return;
    }

    // Click on pile — attempt play
    for (let p = 0; p < 2; ++p) {
      const px = CANVAS_W / 2 - 80 + p * 100;
      if (CE.isInRect(mx, my, px, 230, CE.CARD_W, CE.CARD_H) && S.selectedCards.length > 0) {
        if (S.selectedCards.length === 1) {
          if (V.canMatchSingle(S.hands[0][S.selectedCards[0]], S.centerPiles[p])) {
            V.doPlay(0, [...S.selectedCards], p);
            S.selectedCards = [];
            return;
          }
          if (S._host) S._host.floatingText.add(mx, my - 20, 'No match!', { color: '#f88', size: 14 });
        } else if (S.selectedCards.length === 2) {
          if (V.canMatchDouble(S.hands[0][S.selectedCards[0]], S.hands[0][S.selectedCards[1]], S.centerPiles[p])) {
            V.doPlay(0, [...S.selectedCards], p);
            S.selectedCards = [];
            return;
          }
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Sum doesn\'t match!', { color: '#f88', size: 14 });
        }
        return;
      }
    }

    // Click on draw pile
    if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 120, 240, CE.CARD_W, CE.CARD_H)) {
      S.selectedCards = [];
      V.drawFromDeck(0);
      return;
    }

    // Click on player cards
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 100 + i * 55;
      if (CE.isInRect(mx, my, cx, 425, CE.CARD_W, CE.CARD_H + 15)) {
        const idx = S.selectedCards.indexOf(i);
        if (idx >= 0)
          S.selectedCards.splice(idx, 1);
        else if (S.selectedCards.length < 2)
          S.selectedCards.push(i);
        return;
      }
    }
  }

  Object.assign(V, { handleClick });

})();
