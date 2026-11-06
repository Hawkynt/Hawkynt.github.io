/* Cheat: pointer and keyboard handling. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.cheat;
  const S = V.S;
  const { PHASE_PLAYER_TURN, PHASE_CHALLENGE_WINDOW, PHASE_GAME_OVER, PLAYER_HAND_Y, PLAY_BTN,
    CHEAT_BTN } = V;

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (S.selectedIndices.includes(i)) cy -= 15;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handlePlayerClick(mx, my) {
    if (S.phase === PHASE_GAME_OVER) {
      if (S._host) S._host.onRoundOver(true);
      return;
    }

    // Cheat button
    if (S.phase === PHASE_CHALLENGE_WINDOW && S.lastPlayInfo && S.lastPlayInfo.player !== 0) {
      if (CE.isInRect(mx, my, CHEAT_BTN.x, CHEAT_BTN.y, CHEAT_BTN.w, CHEAT_BTN.h)) {
        V.resolveChallenge(0);
        return;
      }
    }

    if (S.phase !== PHASE_PLAYER_TURN) return;

    // Play button
    if (S.selectedIndices.length > 0 && CE.isInRect(mx, my, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) {
      V.playCards(0, S.selectedIndices);
      S.selectedIndices = [];
      return;
    }

    // Card selection
    const idx = hitTestPlayerCard(mx, my);
    if (idx < 0) return;

    const pos = S.selectedIndices.indexOf(idx);
    if (pos >= 0) {
      S.selectedIndices.splice(pos, 1);
    } else {
      if (S.selectedIndices.length >= 4) return;
      S.selectedIndices.push(idx);
    }
  }

  Object.assign(V, { hitTestPlayerCard, handlePlayerClick });

})();
