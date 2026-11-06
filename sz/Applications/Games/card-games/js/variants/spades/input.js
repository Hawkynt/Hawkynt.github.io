/* Spades - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spades;
  const S = V.S;
  const { PHASE_BIDDING, PHASE_PLAYING, PHASE_ROUND_OVER, PLAYER_HAND_Y } = V;

  function handleClick(mx, my) {
    // Round over / game over -- advance
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        if (S._host) S._host.onRoundOver(true);
      } else {
        V.deal();
      }
      return;
    }

    // Bidding -- player bid selection
    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0 && !S.bidsDone[0]) {
      for (let b = 0; b <= 13; ++b) {
        const r = V.bidBtnRect(b);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.bids[0] = b;
          S.bidsDone[0] = true;
          V.advanceBidding();
          return;
        }
      }
      return;
    }

    // Playing -- player's turn
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0) return;
    if (S.trickCards.length >= 4) return;

    const hand = S.hands[0];
    // Click detection: iterate from right to left for overlapping cards
    for (let i = hand.length - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, hand.length);
      const rightBound = (i === hand.length - 1) ? cx + CE.CARD_W : V.playerCardX(i + 1, hand.length);
      if (mx >= cx && mx < rightBound && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H) {
        if (V.isValidPlay(hand[i], hand)) {
          V.playCard(0, i);
          if (S.trickCards.length >= 4) {
            V.resolveTrick();
          } else {
            S.currentTurn = (S.currentTurn + 1) % 4;
            S.aiTurnTimer = 0;
          }
        } else {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Invalid play!', { color: '#f88', size: 14 });
        }
        return;
      }
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;
    S.hoveredBid = -1;

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

    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0 && !S.bidsDone[0]) {
      for (let b = 0; b <= 13; ++b) {
        const r = V.bidBtnRect(b);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.hoveredBid = b;
          break;
        }
      }
    }
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
