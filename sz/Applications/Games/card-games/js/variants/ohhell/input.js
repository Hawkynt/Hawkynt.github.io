/* Oh Hell - pointer and keyboard hit testing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ohhell;
  const S = V.S;
  const {
    SUIT_NAMES, NUM_PLAYERS, PHASE_BIDDING, PHASE_PLAYING,
    PHASE_ROUND_OVER, PLAYER_HAND_Y
  } = V;

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = V.playerCardX(i, total);
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : V.playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function handleClick(mx, my) {
    /* Round over / game over */
    if (S.phase === PHASE_ROUND_OVER) {
      if (S.gameOver) {
        S.score = 0;
        S.gameOver = false;
        S.cumulativeScores = [0, 0, 0, 0];
        S.roundIndex = 0;
        S.dealer = 0;
        if (S._host) S._host.onScoreChanged(S.score);
        V.deal();
      } else {
        S.dealer = (S.dealer + 1) % NUM_PLAYERS;
        V.deal();
      }
      return;
    }

    /* Bidding -- player bid selection */
    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0 && !S.bidsDone[0]) {
      const forbidden = V.forbiddenBid();
      for (let b = 0; b <= S.handSize; ++b) {
        if (b === forbidden) continue;
        const r = V.bidBtnRect(b);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          V.placeBid(0, b);
          return;
        }
      }
      return;
    }

    /* Playing -- player's turn */
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0) return;
    if (S.trickCards.length >= NUM_PLAYERS) return;

    const idx = hitTestPlayerCard(mx, my);
    if (idx < 0) return;

    const hand = S.hands[0];
    if (V.isValidPlay(hand[idx], hand)) {
      V.playCard(0, idx);
      if (S.trickCards.length >= NUM_PLAYERS)
        return; /* trick done handled in playCard */
    } else {
      const leadSuit = S.trickCards[0].suit;
      const reason = 'Must follow ' + SUIT_NAMES[leadSuit] + '!';
      if (S._host) S._host.floatingText.add(mx, my - 20, reason, { color: '#f88', size: 14 });
    }
  }

  function handlePointerMove(mx, my) {
    S.hoveredCard = -1;
    S.hoveredBid = -1;

    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      S.hoveredCard = hitTestPlayerCard(mx, my);

    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0 && !S.bidsDone[0]) {
      const forbidden = V.forbiddenBid();
      for (let b = 0; b <= S.handSize; ++b) {
        if (b === forbidden) continue;
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
