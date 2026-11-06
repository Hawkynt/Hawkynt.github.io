/* Speed: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.speed;
  const S = V.S;
  const { CARD_W, CARD_H, CENTER_Y, CENTER_LEFT_X, CENTER_RIGHT_X, PLAYER_HAND_Y, FLIP_BTN } = V;

  function handleClickImpl(mx, my) {
    if (S.roundOver || S.gameOver) {
      if (S._host) S._host.onRoundOver(S.gameOver);
      return;
    }

    // Flip button
    if (S.showFlipButton && CE.isInRect(mx, my, FLIP_BTN.x, FLIP_BTN.y, FLIP_BTN.w, FLIP_BTN.h)) {
      V.flipReserves();
      return;
    }

    // Click on center pile when card is selected
    if (S.selectedIndex >= 0) {
      if (CE.isInRect(mx, my, CENTER_LEFT_X, CENTER_Y, CARD_W, CARD_H)) {
        if (V.tryPlayCard(S.selectedIndex, 0)) return;
      }
      if (CE.isInRect(mx, my, CENTER_RIGHT_X, CENTER_Y, CARD_W, CARD_H)) {
        if (V.tryPlayCard(S.selectedIndex, 1)) return;
      }
    }

    // Click on player hand card
    for (let i = 0; i < S.playerHand.length; ++i) {
      const x = V.handCardX(i, S.playerHand.length);
      const y = S.selectedIndex === i ? PLAYER_HAND_Y - 12 : PLAYER_HAND_Y;
      if (CE.isInRect(mx, my, x, y, CARD_W, CARD_H)) {
        if (S.selectedIndex === i) {
          S.selectedIndex = -1; // deselect
        } else {
          S.selectedIndex = i;
          // Auto-play: if only one valid pile, play immediately
          const leftValid = S.centerPiles[0].length > 0 && V.canPlayOn(S.playerHand[i], S.centerPiles[0][S.centerPiles[0].length - 1]);
          const rightValid = S.centerPiles[1].length > 0 && V.canPlayOn(S.playerHand[i], S.centerPiles[1][S.centerPiles[1].length - 1]);
          if (leftValid && !rightValid) {
            V.tryPlayCard(i, 0);
            return;
          }
          if (!leftValid && rightValid) {
            V.tryPlayCard(i, 1);
            return;
          }
          // Both valid or neither -- keep selected for pile click
        }
        return;
      }
    }

    // Click elsewhere deselects
    S.selectedIndex = -1;
  }

  function handleKeyImpl(e) {
    if (S.roundOver || S.gameOver) return;

    // F = flip
    if (e.key === 'f' || e.key === 'F') {
      if (S.showFlipButton)
        V.flipReserves();
      return;
    }

    // 1-5 selects card in hand
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 5) {
      const idx = num - 1;
      if (idx < S.playerHand.length) {
        if (S.selectedIndex === idx)
          S.selectedIndex = -1;
        else
          S.selectedIndex = idx;
      }
      return;
    }

    // L/R or Left/Right to play selected card on a pile
    if (S.selectedIndex >= 0) {
      if (e.key === 'l' || e.key === 'L' || e.key === 'ArrowLeft') {
        V.tryPlayCard(S.selectedIndex, 0);
        return;
      }
      if (e.key === 'r' || e.key === 'R' || e.key === 'ArrowRight') {
        V.tryPlayCard(S.selectedIndex, 1);
        return;
      }
    }

    // Space = flip if stuck
    if (e.key === ' ' && S.showFlipButton) {
      V.flipReserves();
      return;
    }
  }

  Object.assign(V, { handleClickImpl, handleKeyImpl });

})();
