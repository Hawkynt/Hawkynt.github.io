/* Rummy input: hand hit testing, clicks on piles, buttons and cards, and keyboard shortcuts. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.rummy;
  const S = V.S;
  const { CANVAS_H, PHASE_DRAW, PHASE_MELD, PHASE_DISCARD, PHASE_ROUND_OVER, STOCK_X, STOCK_Y,
    DISCARD_X, DISCARD_Y, DRAW_BTN, MELD_BTN, LAYOFF_BTN, DISCARD_BTN } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const x = V.playerCardX(i, total);
      const isSelected = S.selectedIndices.includes(i);
      const y = isSelected ? (CANVAS_H - CE.CARD_H - 35) : (CANVAS_H - CE.CARD_H - 20);
      const rightEdge = i === total - 1 ? x + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Round over / game over
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        S.penaltyScores = [0, 0, 0];
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

    if (S.currentPlayer !== 0) return;

    // DRAW phase
    if (S.phase === PHASE_DRAW) {
      // Click stock
      if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        V.playerDrawStock();
        return;
      }
      // Click discard pile (take top card only)
      if (S.discardPile.length > 0) {
        const showCount = Math.min(S.discardPile.length, 4);
        const lastOffset = (showCount - 1) * 16;
        if (CE.isInRect(mx, my, DISCARD_X + lastOffset, DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
          V.playerDrawFromDiscard();
          return;
        }
      }
      // Click Draw button
      if (CE.isInRect(mx, my, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h)) {
        V.playerDrawStock();
        return;
      }
      return;
    }

    // MELD phase
    if (S.phase === PHASE_MELD) {
      // Meld button
      if (S.selectedIndices.length >= 3 && CE.isInRect(mx, my, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h)) {
        V.playerMeld();
        return;
      }
      // Lay Off button
      if (S.selectedIndices.length === 1 && CE.isInRect(mx, my, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h)) {
        V.playerLayOff();
        return;
      }
      // Discard button (transitions to DISCARD phase or discards if 1 selected)
      if (CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
        if (S.selectedIndices.length === 1)
          V.playerDiscard();
        else {
          S.selectedIndices = [];
          S.phase = PHASE_DISCARD;
        }
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

    // DISCARD phase
    if (S.phase === PHASE_DISCARD) {
      // Discard button with selection
      if (S.selectedIndices.length === 1 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
        V.playerDiscard();
        return;
      }
      // Click hand card to select for discard
      const idx = hitTestPlayerCard(mx, my);
      if (idx >= 0) {
        if (S.selectedIndices.length === 1 && S.selectedIndices[0] === idx) {
          // Double click = discard
          V.playerDiscard();
        } else
          S.selectedIndices = [idx];
        return;
      }
      return;
    }
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    if (S.currentPlayer !== 0) return;

    if (e.key === 'm' || e.key === 'M') {
      if (S.phase === PHASE_MELD && S.selectedIndices.length >= 3)
        V.playerMeld();
    } else if (e.key === 'l' || e.key === 'L') {
      if (S.phase === PHASE_MELD && S.selectedIndices.length === 1)
        V.playerLayOff();
    } else if (e.key === 'd' || e.key === 'D') {
      if ((S.phase === PHASE_MELD || S.phase === PHASE_DISCARD) && S.selectedIndices.length === 1)
        V.playerDiscard();
      else if (S.phase === PHASE_MELD) {
        S.selectedIndices = [];
        S.phase = PHASE_DISCARD;
      }
    } else if (e.key === 'Escape') {
      S.selectedIndices = [];
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
