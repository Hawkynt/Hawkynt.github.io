/* Yaniv input: hand and discard hit testing, clicks, and keyboard shortcuts. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.yaniv;
  const S = V.S;
  const { YANIV_THRESHOLD, PHASE_DISCARD, PHASE_DRAW, PHASE_ROUND_OVER, STOCK_X, STOCK_Y,
    DISCARD_X, DISCARD_Y, PLAYER_HAND_Y, DISCARD_BTN, YANIV_BTN } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const x = RC.playerCardX(i, total);
      const isSelected = S.selectedIndices.includes(i);
      const y = isSelected ? PLAYER_HAND_Y - 15 : PLAYER_HAND_Y;
      const rightEdge = i === total - 1 ? x + CE.CARD_W : RC.playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestDiscardGroup(mx, my) {
    if (S.discardGroup.length === 0) return -1;
    const totalWidth = (S.discardGroup.length - 1) * 35 + CE.CARD_W;
    const startX = DISCARD_X + CE.CARD_W / 2 - totalWidth / 2;
    const drawable = V.getDrawableDiscardCards();

    // Check in reverse order (rightmost card on top)
    for (let i = S.discardGroup.length - 1; i >= 0; --i) {
      if (!drawable.includes(i)) continue;
      const x = startX + i * 35;
      if (CE.isInRect(mx, my, x, DISCARD_Y, CE.CARD_W, CE.CARD_H))
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Round over / game over
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        S.cumulativeScores = [0, 0, 0, 0];
        S.eliminated = [false, false, false, false];
        S.score = 0;
        S.gameOver = false;
        if (S._host) S._host.onScoreChanged(S.score);
      }
      S.roundOver = false;
      V.setupRound();
      return;
    }

    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    if (S.currentPlayer !== 0 || S.eliminated[0]) return;

    // DISCARD phase
    if (S.phase === PHASE_DISCARD) {
      // Yaniv button
      if (V.handTotal(S.hands[0]) <= YANIV_THRESHOLD &&
          CE.isInRect(mx, my, YANIV_BTN.x, YANIV_BTN.y, YANIV_BTN.w, YANIV_BTN.h)) {
        V.playerCallYaniv();
        return;
      }

      // Discard button
      if (S.selectedIndices.length > 0 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
        V.playerDiscard();
        return;
      }

      // Click hand cards to toggle selection
      const idx = hitTestPlayerCard(mx, my);
      if (idx >= 0) {
        const pos = S.selectedIndices.indexOf(idx);
        if (pos >= 0)
          S.selectedIndices.splice(pos, 1);
        else
          S.selectedIndices.push(idx);
        return;
      }
      return;
    }

    // DRAW phase
    if (S.phase === PHASE_DRAW) {
      // Click stock pile
      if (S.stockPile.length > 0 && CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        V.playerDrawFromStock();
        return;
      }

      // Click discard group (first or last card)
      const discardIdx = hitTestDiscardGroup(mx, my);
      if (discardIdx >= 0) {
        V.playerDrawFromDiscard(discardIdx);
        return;
      }
      return;
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    if (S.currentPlayer !== 0 || S.eliminated[0]) return;

    if (S.phase === PHASE_DISCARD) {
      if (e.key === 'd' || e.key === 'D') {
        if (S.selectedIndices.length > 0)
          V.playerDiscard();
      } else if (e.key === 'y' || e.key === 'Y') {
        if (V.handTotal(S.hands[0]) <= YANIV_THRESHOLD)
          V.playerCallYaniv();
      } else if (e.key === 'Escape') {
        S.selectedIndices = [];
      }
    } else if (S.phase === PHASE_DRAW) {
      if (e.key === 's' || e.key === 'S') {
        V.playerDrawFromStock();
      }
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
