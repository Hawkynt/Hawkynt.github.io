/* Uno: pointer and key handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['uno'];
  const S = V.S;
  const { CANVAS_W, colorChoiceRects, swapChoiceRects, settingsRects, PLAYER_NAMES } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function handleClick(mx, my) {
    // Settings overlay
    if (S.showingSettings) {
      for (const r of settingsRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          if (r.key === '_close') {
            S.showingSettings = false;
            V.saveHouseRules();
          } else {
            S.houseRules[r.key] = !S.houseRules[r.key];
            V.saveHouseRules();
          }
          return;
        }
      }
      return;
    }

    // Settings gear button
    if (mx >= CANVAS_W - 70 && mx <= CANVAS_W && my >= 2 && my <= 24) {
      S.showingSettings = true;
      return;
    }

    // Swap choice (Seven rule)
    if (S.waitingForSwapChoice) {
      for (const r of swapChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForSwapChoice = false;
          const tmp = S.unoHands[S.swapChoicePlayer];
          S.unoHands[S.swapChoicePlayer] = S.unoHands[r.target];
          S.unoHands[r.target] = tmp;
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 200, 'Swapped with ' + PLAYER_NAMES[r.target] + '!', { color: '#ff0', size: 16 });
          V.checkWin(S.swapChoicePlayer);
          S.swapChoicePlayer = -1;
          return;
        }
      }
      return;
    }

    // Color choice
    if (S.waitingForColorChoice) {
      for (const r of colorChoiceRects) {
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.waitingForColorChoice = false;
          V.finishWildPlay(S.pendingWildCard, S.pendingWildPlayer, r.color);
          S.pendingWildCard = null;
          S.pendingWildPlayer = -1;
          return;
        }
      }
      return;
    }

    if (S.roundOver || S.gameOver) {
      if (PL.settlePending(S)) return;
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    // Player card click
    for (let i = S.unoHands[0].length - 1; i >= 0; --i) {
      const cx = 80 + i * 55;
      if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
        if (S.unoCurrentPlayer === 0) {
          if (!V.unoPlayCard(0, i))
            if (S._host) S._host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        } else if (S.houseRules.jumpIn && S.unoTopCard) {
          const card = S.unoHands[0][i];
          if (card.color === S.unoTopCard.color && card.value === S.unoTopCard.value && card.color !== 'wild') {
            // Jump-in: play exact match out of turn
            const savedPlayer = S.unoCurrentPlayer;
            S.unoCurrentPlayer = 0;
            if (!V.unoPlayCard(0, i))
              S.unoCurrentPlayer = savedPlayer;
            else if (S._host)
              S._host.floatingText.add(CANVAS_W / 2, 400, 'Jump-In!', { color: '#0ff', size: 18 });
          }
        }
        return;
      }
    }

    // Deck click (draw)
    if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 20, 240, CE.CARD_W, CE.CARD_H) && S.unoCurrentPlayer === 0) {
      if (S.drawStack > 0) {
        V.applyDrawStack(0);
        S.unoCurrentPlayer = V.nextSeat(S.unoCurrentPlayer);
      } else {
        const drawn = V.drawUnoCard();
        if (drawn) S.unoHands[0].push(drawn);
        S.unoCurrentPlayer = V.nextSeat(S.unoCurrentPlayer);
      }
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver || S.waitingForColorChoice || S.waitingForSwapChoice || S.showingSettings) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 7 && S.unoCurrentPlayer === 0) {
      const idx = num - 1;
      if (idx < S.unoHands[0].length)
        V.unoPlayCard(0, idx);
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
