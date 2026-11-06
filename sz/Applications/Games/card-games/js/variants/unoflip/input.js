/* Uno Flip: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoflip'];
  const S = V.S;
  const { CANVAS_W } = V;
  const SH = SZ.CardGames.shared.sheddingHand;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (PL.settlePending(S)) return;
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }
    if (S.currentPlayer !== 0) return;

    // Color choice overlay
    if (S.colorChoiceActive) {
      const colors = V.getColorChoices();
      for (let i = 0; i < colors.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
          S.colorChoiceActive = false;
          if (S.pendingWildIndex >= 0)
            V.playCard(0, S.pendingWildIndex, colors[i]);
          S.pendingWildIndex = -1;
          return;
        }
      }
      return;
    }

    // Draw pile click
    if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H)) {
      if (S.drawPending > 0) {
        SH.drawCards(S, 0, S.drawPending);
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Drew ' + S.drawPending + ' cards!', { color: '#f88', size: 16 });
        S.drawPending = 0;
        V.nextPlayer();
      } else {
        SH.refillDeck(S);
        if (S.deck.length > 0) {
          const drawn = S.deck.pop();
          S.hands[0].push(drawn);
          if (V.canPlay(drawn)) {
            if (S._host) S._host.floatingText.add(mx, my - 20, 'Drew playable card!', { color: '#8f8', size: 12 });
          } else
            V.nextPlayer();
        } else
          V.nextPlayer();
      }
      return;
    }

    // Player cards
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const cx = 120 + i * 60;
      if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
        if (!V.canPlay(S.hands[0][i])) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
          return;
        }
        if (V.getType(S.hands[0][i]) === 'wild') {
          S.pendingWildIndex = i;
          S.colorChoiceActive = true;
          return;
        }
        V.playCard(0, i);
        return;
      }
    }
  }

  Object.assign(V, { handleClick });

})();
