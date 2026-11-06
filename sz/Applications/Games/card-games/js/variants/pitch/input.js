/* Pitch - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pitch;
  const S = V.S;
  const {
    CANVAS_W, SUIT_NAMES, PHASE_BIDDING, PHASE_PLAYING, PHASE_ROUND_SCORE,
    PHASE_GAME_OVER, PLAYER_HAND_Y
  } = V;

  /* ================================================================
     DRAWING - HIT TEST
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      if (mx >= cx && mx <= rightEdge && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    // Game over
    if (S.phase === PHASE_GAME_OVER) {
      S.playerScores = [0, 0, 0, 0];
      S.score = 0;
      S.gameOver = false;
      S.dealer = 0;
      if (S._host) S._host.onScoreChanged(S.score);
      V.dealRound();
      return;
    }

    // Round score screen
    if (S.phase === PHASE_ROUND_SCORE) {
      S.dealer = V.leftOf(S.dealer);
      V.dealRound();
      return;
    }

    // Bidding -- player's turn
    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0 && !S.playerBidDone[0]) {
      for (let i = 0; i < 5; ++i) {
        const r = V.bidBtnRect(i);
        if (!CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) continue;

        const bidVal = i < 4 ? i + 1 : 0;

        // Pass
        if (bidVal === 0) {
          // Dealer can't pass if everyone else passed
          const allOthersPassed = S.playerBidDone.every((d, p) => p === 0 || !d || S.playerBids[p] === 0);
          if (S.biddingPlayer === S.dealer && allOthersPassed && S.bidAmount === 0) {
            if (S._host) S._host.floatingText.add(mx, my - 20, 'Dealer must bid!', { color: '#f88', size: 14 });
            return;
          }
          V.processBid(0, 0, null);
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 300, 'You pass', { color: '#aaa', size: 12 });
          V.advanceBidding();
          return;
        }

        // Must bid higher than current
        if (bidVal <= S.bidAmount) {
          if (S._host) S._host.floatingText.add(mx, my - 20, 'Must bid higher than ' + S.bidAmount + '!', { color: '#f88', size: 14 });
          return;
        }

        // Human picks bid -- trump is their best suit for that bid
        const result = V.aiBid(0); // evaluate best suit
        V.processBid(0, bidVal, result.suit);
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 300, 'You bid ' + bidVal, { color: '#ff0', size: 14 });
        V.advanceBidding();
        return;
      }
      return;
    }

    // Playing -- player's turn
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0) {
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      const hand = S.hands[0];
      if (V.isValidPlay(hand[idx], hand)) {
        V.playCard(0, idx);
      } else {
        const leadSuit = S.trickCards[0].suit;
        if (S._host) S._host.floatingText.add(mx, my - 20, 'Must follow ' + SUIT_NAMES[leadSuit] + '!', { color: '#f88', size: 14 });
      }
      return;
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;
    S.hoveredBtn = '';

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      S.hoveredCard = hitTestPlayerCard(mx, my);

    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0 && !S.playerBidDone[0]) {
      for (let i = 0; i < 5; ++i) {
        const r = V.bidBtnRect(i);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          S.hoveredBtn = i < 4 ? 'bid' + (i + 1) : 'pass';
          break;
        }
      }
    }
  }

  Object.assign(V, {
    handleClick, handlePointerMove
  });

})();
