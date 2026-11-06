/* Uno Party: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoparty'];
  const S = V.S;
  const { CANVAS_W, PLAYER_NAMES, UNO_COLORS } = V;
  const SH = SZ.CardGames.shared.sheddingHand;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function handleClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (PL.settlePending(S)) return;
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    // Color choice overlay
    if (S.colorChoiceActive) {
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
          S.colorChoiceActive = false;
          if (S.pendingWildIndex >= 0)
            V.playCard(0, S.pendingWildIndex, UNO_COLORS[i]);
          S.pendingWildIndex = -1;
          return;
        }
      }
      return;
    }

    // Trade choice overlay
    if (S.tradeChoiceActive) {
      let col = 0;
      for (const p of V.tradeTargets()) {
        const bx = CANVAS_W / 2 - 200 + col * 85;
        if (CE.isInRect(mx, my, bx, 230, 78, 36)) {
          S.tradeChoiceActive = false;
          const tmp = S.hands[0];
          S.hands[0] = S.hands[p];
          S.hands[p] = tmp;
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 250, 'Traded with ' + PLAYER_NAMES[p] + '!', { color: '#ff0', size: 16 });
          V.nextPlayer();
          return;
        }
        ++col;
      }
      return;
    }

    if (S.currentPlayer !== 0) return;

    // Draw pile
    if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 80, 190, CE.CARD_W, CE.CARD_H)) {
      if (S.drawPending > 0) {
        SH.drawCards(S, 0, S.drawPending);
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Drew ' + S.drawPending + '!', { color: '#f88', size: 16 });
        S.drawPending = 0;
        V.nextPlayer();
      } else {
        SH.refillDeck(S);
        if (S.deck.length > 0) {
          const drawn = S.deck.pop();
          S.hands[0].push(drawn);
          if (V.canPlay(drawn)) {
            if (S._host) S._host.floatingText.add(mx, my - 20, 'Drew playable!', { color: '#8f8', size: 12 });
          } else
            V.nextPlayer();
        } else
          V.nextPlayer();
      }
      return;
    }

    // Player cards
    const handLen = S.hands[0].length;
    const cardSpacing = Math.min(55, (CANVAS_W - 200) / Math.max(handLen, 1));
    const handStartX = (CANVAS_W - (handLen - 1) * cardSpacing - CE.CARD_W) / 2;
    for (let i = handLen - 1; i >= 0; --i) {
      const cx = handStartX + i * cardSpacing;
      if (CE.isInRect(mx, my, cx, 450, CE.CARD_W, CE.CARD_H)) {
        if (!V.canPlay(S.hands[0][i])) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
          return;
        }
        if (S.hands[0][i].type === 'party') {
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
