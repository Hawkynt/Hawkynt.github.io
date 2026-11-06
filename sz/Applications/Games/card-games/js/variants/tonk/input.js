/* Tonk input: hand hit testing, clicks on piles, buttons and cards, and keyboard shortcuts. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.tonk;
  const S = V.S;
  const { PHASE_DEAL_CHECK, PHASE_DRAW, PHASE_PLAY, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X,
    DISCARD_Y, SPREAD_BTN, DROP_BTN, DISCARD_BTN, TONK_BTN } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ══════════════════════════════════════════════════════════════════
     HIT TESTING
     ══════════════════════════════════════════════════════════════════ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const x = RC.playerCardX(i, total);
      const isSelected = S.selectedIndices.includes(i);
      const y = isSelected ? 440 : 455;
      const rightEdge = i === total - 1 ? x + CE.CARD_W : RC.playerCardX(i + 1, total);
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
        S.scores = [0, 0, 0];
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

    // DEAL CHECK phase (Tonk declaration)
    if (S.phase === PHASE_DEAL_CHECK) {
      const pt = V.handTotal(S.hands[0]);
      if ((pt === 49 || pt === 50) && CE.isInRect(mx, my, TONK_BTN.x, TONK_BTN.y, TONK_BTN.w, TONK_BTN.h)) {
        V.declareTonk(0);
        return;
      }
      // Pass button or any click to skip
      if (CE.isInRect(mx, my, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h) || !(pt === 49 || pt === 50)) {
        S.phase = PHASE_DRAW;
        return;
      }
      return;
    }

    // DRAW phase
    if (S.phase === PHASE_DRAW) {
      if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
        V.playerDrawStock();
        return;
      }
      if (S.discardPile.length > 0 && CE.isInRect(mx, my, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
        V.playerDrawDiscard();
        return;
      }
      return;
    }

    // PLAY phase
    if (S.phase === PHASE_PLAY) {
      // Spread button
      if (S.selectedIndices.length >= 3 && CE.isInRect(mx, my, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h)) {
        V.playerSpread();
        return;
      }
      // Hit button (1 selected card extending a meld)
      if (S.selectedIndices.length === 1 && V.findExtendTarget(S.hands[0][S.selectedIndices[0]]) >= 0 && CE.isInRect(mx, my, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h)) {
        V.playerExtend();
        return;
      }
      // Drop button
      if (CE.isInRect(mx, my, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h)) {
        V.playerDrop(0);
        return;
      }
      // Discard button
      if (S.selectedIndices.length === 1 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
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
  }

  function handleKey(e) {
    if (S.roundOver || S.gameOver) return;
    if (S.currentPlayer !== 0) return;

    if (S.phase === PHASE_DEAL_CHECK) {
      const pt = V.handTotal(S.hands[0]);
      if ((e.key === 't' || e.key === 'T') && (pt === 49 || pt === 50)) {
        V.declareTonk(0);
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') {
        S.phase = PHASE_DRAW;
        return;
      }
    }

    if (S.phase === PHASE_PLAY) {
      if (e.key === 's' || e.key === 'S') {
        if (S.selectedIndices.length >= 3)
          V.playerSpread();
        else if (S.selectedIndices.length === 1 && V.findExtendTarget(S.hands[0][S.selectedIndices[0]]) >= 0)
          V.playerExtend();
      } else if (e.key === 'k' || e.key === 'K') {
        V.playerDrop(0);
      } else if (e.key === 'd' || e.key === 'D') {
        if (S.selectedIndices.length === 1)
          V.playerDiscard();
      } else if (e.key === 'Escape') {
        S.selectedIndices = [];
      }
    }
  }

  Object.assign(V, { handleClick, handleKey });

})();
