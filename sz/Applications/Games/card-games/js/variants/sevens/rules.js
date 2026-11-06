/* Sevens: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.sevens;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, PLAYER_NAMES, RANKS, SUIT_SYMBOLS } = V;

  /* Rank index helpers: A=0 .. K=12, 7 is at index 6 */
  function rankIdx(card) {
    return card.value !== undefined ? card.value : RANKS.indexOf(card.rank);
  }

  function cardPenalty(card) {
    const ri = rankIdx(card);
    if (ri === 0) return 1;
    if (ri >= 10) return 10;
    return ri + 1;
  }

  function placeSeven(suit) {
    S.suitRows[suit] = { low: 6, high: 6 };
    S.placedCards[suit].add(6);
  }

  function canPlace(card) {
    const suit = card.suit;
    const ri = rankIdx(card);
    const row = S.suitRows[suit];

    // If no 7 placed yet for this suit, only the 7 can start it
    if (!row)
      return ri === 6;

    // Extend low side (6,5,4,3,2,1,0) or high side (8,9,10,11,12)
    return ri === row.low - 1 || ri === row.high + 1;
  }

  function placeCard(card) {
    const suit = card.suit;
    const ri = rankIdx(card);
    const row = S.suitRows[suit];

    if (!row) {
      placeSeven(suit);
      return;
    }

    if (ri === row.low - 1)
      row.low = ri;
    else if (ri === row.high + 1)
      row.high = ri;

    S.placedCards[suit].add(ri);
  }

  function getValidPlays(hand) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (canPlace(hand[i]))
        valid.push(i);
    return valid;
  }

  function sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return rankIdx(a) - rankIdx(b);
    });
  }

  function findSevenOfDiamonds() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of S.hands[p])
        if (c.suit === 'diamonds' && rankIdx(c) === 6) return p;
    return 0;
  }

  function doPlayCard(playerIdx, handIdx) {
    const card = S.hands[playerIdx].splice(handIdx, 1)[0];
    card.faceUp = true;
    placeCard(card);

    if (S._host && S._host.floatingText) {
      const label = card.rank + SUIT_SYMBOLS[card.suit];
      const color = playerIdx === 0 ? '#4f4' : '#ff0';
      S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ': ' + label, { color, size: 14 });
    }

    S.passCount = 0;
    checkRoundEnd();
    if (!S.roundOver)
      V.advanceTurn();
  }

  function doPass(playerIdx) {
    ++S.totalPasses[playerIdx];
    ++S.passCount;

    if (S._host && S._host.floatingText) {
      const color = playerIdx === 0 ? '#f88' : '#fa0';
      S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' passes', { color, size: 14 });
    }

    V.advanceTurn();
  }

  function checkRoundEnd() {
    // Round ends when any player empties their hand
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.hands[p].length === 0) {
        V.endRound(p);
        return;
      }
    }
  }

  Object.assign(V, { rankIdx, cardPenalty, canPlace, getValidPlays, sortHand, findSevenOfDiamonds,
    doPlayCard, doPass });

})();
