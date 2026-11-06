/* Whist - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.whist;
  const S = V.S;
  const { PHASE_TRUMP_REVEAL, PHASE_PLAYING, PHASE_ROUND_OVER, PLAYER_HAND_Y } = V;

  function handleClick(mx, my) {
    // Trump reveal -- click to skip
    if (S.phase === PHASE_TRUMP_REVEAL) {
      S.trumpRevealTimer = 0;
      S.phase = PHASE_PLAYING;
      S.aiTurnTimer = 0;
      return;
    }

    // Round over / game over -- advance
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        if (S._host) S._host.onRoundOver(true);
      } else {
        S.dealer = (S.dealer + 1) % 4;
        V.deal();
      }
      return;
    }

    // Playing -- player's turn
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0) return;
    if (S.trickCards.length >= 4) return;

    const hand = S.hands[0];
    for (let i = hand.length - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, hand.length);
      const rightBound = (i === hand.length - 1) ? cx + CE.CARD_W : V.playerCardX(i + 1, hand.length);
      if (mx >= cx && mx < rightBound && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H) {
        if (V.isValidPlay(hand[i], hand)) {
          V.playCard(0, i);
          if (S.trickCards.length >= 4)
            V.resolveTrick();
          else
            S.currentTurn = (S.currentTurn + 1) % 4;
          S.aiTurnTimer = 0;
        } else {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Must follow suit!', { color: '#f88', size: 14 });
        }
        return;
      }
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      const hand = S.hands[0];
      for (let i = hand.length - 1; i >= 0; --i) {
        const cx = V.playerCardX(i, hand.length);
        const rightBound = (i === hand.length - 1) ? cx + CE.CARD_W : V.playerCardX(i + 1, hand.length);
        if (mx >= cx && mx < rightBound && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H) {
          S.hoveredCard = i;
          break;
        }
      }
    }
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
