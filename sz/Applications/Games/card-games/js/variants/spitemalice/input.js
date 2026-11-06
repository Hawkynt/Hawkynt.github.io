/* Spite & Malice: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spitemalice;
  const S = V.S;
  const { CW, CH, CENTER_Y, CENTER_X0, CENTER_GAP, P_PAYOFF_X, P_PAYOFF_Y, P_HAND_X, P_HAND_Y,
    P_SIDE_X, P_SIDE_Y } = V;

  function handlePlayerClick(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }
    if (!S.playerTurn) return;

    // If no card selected, try to select one
    if (!S.selectedSource) {
      // Check hand cards (right to left for overlap)
      for (let i = S.hands[0].length - 1; i >= 0; --i) {
        const hx = P_HAND_X + i * (CW + 6);
        if (CE.isInRect(mx, my, hx, P_HAND_Y, CW, CH)) {
          S.selectedSource = { type: 'hand', index: i };
          return;
        }
      }
      // Check pay-off pile
      if (S.payoff[0].length > 0 && CE.isInRect(mx, my, P_PAYOFF_X, P_PAYOFF_Y, CW, CH)) {
        S.selectedSource = { type: 'payoff', index: 0 };
        return;
      }
      // Check side stack tops
      for (let s = 0; s < 4; ++s) {
        if (S.sideStacks[0][s].length > 0) {
          const sx = P_SIDE_X + s * (CW + 10);
          if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
            S.selectedSource = { type: 'side', index: s };
            return;
          }
        }
      }
      return;
    }

    // Card is selected -- try to play it
    const card = V.getSelectedCard();
    if (!card) {
      S.selectedSource = null;
      return;
    }

    // Try center piles
    for (let c = 0; c < 4; ++c) {
      const cx = CENTER_X0 + c * CENTER_GAP;
      if (CE.isInRect(mx, my, cx, CENTER_Y, CW, CH)) {
        if (V.canPlayOn(card, S.centerPiles[c])) {
          const src = S.selectedSource;
          V.removeSelectedCard();
          V.playToCenter(card, c);
          S.score += 5;
          if (S._host) S._host.onScoreChanged(S.score);
          if (src.type === 'payoff') {
            // Reveal next payoff card
            const next = V.topCard(S.payoff[0]);
            if (next) next.faceUp = true;
            V.checkWin(0);
          }
          // If hand empty, draw 5 more
          if (S.hands[0].length === 0 && !S.roundOver)
            V.drawHand(0);
        } else if (S._host)
          S._host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
        return;
      }
    }

    // Try player discard piles (ends turn) -- only from hand or payoff, not from side to side
    if (S.selectedSource.type === 'hand') {
      for (let s = 0; s < 4; ++s) {
        const sx = P_SIDE_X + s * (CW + 10);
        if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
          S.sideStacks[0][s].push(S.hands[0].splice(S.selectedSource.index, 1)[0]);
          S.selectedSource = null;
          // End player turn
          S.playerTurn = false;
          S.aiDiscarded = false;
          S.aiTimer = 0;
          return;
        }
      }
    }

    // Clicking on the same card deselects
    if (S.selectedSource.type === 'hand') {
      const hx = P_HAND_X + S.selectedSource.index * (CW + 6);
      if (CE.isInRect(mx, my, hx, P_HAND_Y, CW, CH)) {
        S.selectedSource = null;
        return;
      }
    }
    if (S.selectedSource.type === 'payoff' && CE.isInRect(mx, my, P_PAYOFF_X, P_PAYOFF_Y, CW, CH)) {
      S.selectedSource = null;
      return;
    }
    if (S.selectedSource.type === 'side') {
      const sx = P_SIDE_X + S.selectedSource.index * (CW + 10);
      if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
        S.selectedSource = null;
        return;
      }
    }

    // Try to reselect a different card
    for (let i = S.hands[0].length - 1; i >= 0; --i) {
      const hx = P_HAND_X + i * (CW + 6);
      if (CE.isInRect(mx, my, hx, P_HAND_Y, CW, CH)) {
        S.selectedSource = { type: 'hand', index: i };
        return;
      }
    }
    if (S.payoff[0].length > 0 && CE.isInRect(mx, my, P_PAYOFF_X, P_PAYOFF_Y, CW, CH)) {
      S.selectedSource = { type: 'payoff', index: 0 };
      return;
    }
    for (let s = 0; s < 4; ++s) {
      if (S.sideStacks[0][s].length > 0) {
        const sx = P_SIDE_X + s * (CW + 10);
        if (CE.isInRect(mx, my, sx, P_SIDE_Y, CW, CH)) {
          S.selectedSource = { type: 'side', index: s };
          return;
        }
      }
    }
  }

  Object.assign(V, { handlePlayerClick });

})();
