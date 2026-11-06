/* Hearts - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.hearts;
  const S = V.S;
  const { RANK_ORDER, HEART, SPADE, NUM_PLAYERS } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiSelectPassCards(playerIdx) {
    const hand = S.hands[playerIdx].slice();
    hand.sort((a, b) => V.cardStrength(b) - V.cardStrength(a));

    const selected = [];

    const qos = hand.find(c => V.isQueenOfSpades(c));
    if (qos) {
      selected.push(qos);
      hand.splice(hand.indexOf(qos), 1);
    }

    const highSpades = hand.filter(c => c.suit === SPADE && RANK_ORDER[c.rank] >= RANK_ORDER['K']);
    for (const c of highSpades) {
      if (selected.length >= 3) break;
      selected.push(c);
      hand.splice(hand.indexOf(c), 1);
    }

    const highHearts = hand.filter(c => c.suit === HEART).sort((a, b) => V.cardStrength(b) - V.cardStrength(a));
    for (const c of highHearts) {
      if (selected.length >= 3) break;
      selected.push(c);
      hand.splice(hand.indexOf(c), 1);
    }

    const remaining = hand.sort((a, b) => V.cardStrength(b) - V.cardStrength(a));
    for (const c of remaining) {
      if (selected.length >= 3) break;
      selected.push(c);
    }

    return selected.slice(0, 3);
  }

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;

    const isFirstTrick = S.trickCount === 0;
    const isLeading = S.trickCards.length === 0;
    const leadSuit = isLeading ? null : S.trickCards[0].suit;
    const validIdxs = V.getValidCards(hand, leadSuit, isFirstTrick, isLeading);

    if (validIdxs.length === 1) return validIdxs[0];

    if (isLeading) {
      const nonHeartIdxs = validIdxs.filter(i => hand[i].suit !== HEART);
      const pool = nonHeartIdxs.length > 0 ? nonHeartIdxs : validIdxs;
      pool.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return pool[0];
    }

    const followIdxs = validIdxs.filter(i => hand[i].suit === leadSuit);

    if (followIdxs.length > 0) {
      const currentBest = Math.max(...S.trickCards.filter(c => c.suit === leadSuit).map(c => V.cardStrength(c)));

      const underIdxs = followIdxs.filter(i => V.cardStrength(hand[i]) < currentBest);
      if (underIdxs.length > 0) {
        underIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return underIdxs[0];
      }

      if (S.trickCards.length === NUM_PLAYERS - 1) {
        const trickPenalty = V.computeTrickPenalty();
        if (trickPenalty === 0) {
          followIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
          return followIdxs[0];
        }
      }

      followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return followIdxs[0];
    }

    const qosIdx = validIdxs.find(i => V.isQueenOfSpades(hand[i]));
    if (qosIdx !== undefined) return qosIdx;

    const heartIdxs = validIdxs.filter(i => V.isHeart(hand[i]));
    if (heartIdxs.length > 0) {
      heartIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return heartIdxs[0];
    }

    const highIdxs = validIdxs.slice().sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
    return highIdxs[0];
  }

  Object.assign(V, {
    aiSelectPassCards, aiChooseCard
  });

})();
