/* Pinochle - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.pinochle;
  const S = V.S;
  const { MIN_BID, BID_STEP } = V;

  const getCardsOfSuit = T.getCardsOfSuit;

  /* ================================================================
     AI BIDDING
     ================================================================ */

  function aiEstimateMelds(hand) {
    let est = 0;
    // Rough meld estimate without knowing trump
    for (const suit of CE.SUITS) {
      const k = V.countRankInSuit(hand, 'K', suit);
      const q = V.countRankInSuit(hand, 'Q', suit);
      est += Math.min(k, q) * 20;
    }
    const jd = V.countRankInSuit(hand, 'J', 'diamonds');
    const qs = V.countRankInSuit(hand, 'Q', 'spades');
    if (Math.min(jd, qs) >= 2)
      est += 300;
    else if (Math.min(jd, qs) >= 1)
      est += 40;

    const aroundRanks = ['A', 'K', 'Q', 'J'];
    const aroundValues = [100, 80, 60, 40];
    for (let i = 0; i < aroundRanks.length; ++i) {
      if (V.countRankAcrossSuits(hand, aroundRanks[i]) === 4)
        est += aroundValues[i];
    }
    return est;
  }

  function aiCountHighCards(hand) {
    let count = 0;
    for (const c of hand)
      if (c.rank === 'A' || c.rank === '10' || c.rank === 'K')
        ++count;
    return count;
  }

  function aiBid(playerIdx) {
    const hand = S.hands[playerIdx];
    const meldEst = aiEstimateMelds(hand);
    const highCards = aiCountHighCards(hand);
    const trickEst = highCards * 8;
    const totalEst = meldEst + trickEst;
    const maxBid = Math.floor(totalEst * 0.8);
    const nextBid = S.highBid > 0 ? S.highBid + BID_STEP : MIN_BID;

    if (meldEst >= 40 && highCards >= 3 && nextBid <= maxBid)
      return nextBid;
    if (meldEst >= 20 && highCards >= 4 && nextBid <= maxBid)
      return nextBid;
    if (nextBid <= MIN_BID && highCards >= 5)
      return nextBid;

    return 0;
  }

  function aiSelectTrump(playerIdx) {
    const hand = S.hands[playerIdx];
    let bestSuit = CE.SUITS[0];
    let bestScore = -1;
    for (const suit of CE.SUITS) {
      const cards = getCardsOfSuit(hand, suit);
      let suitScore = cards.length * 10;
      for (const c of cards) {
        if (c.rank === 'A') suitScore += 15;
        else if (c.rank === '10') suitScore += 12;
        else if (c.rank === 'K') suitScore += 5;
      }
      // Marriage bonus
      const hasK = cards.some(c => c.rank === 'K');
      const hasQ = cards.some(c => c.rank === 'Q');
      if (hasK && hasQ) suitScore += 20;
      if (suitScore > bestScore) {
        bestScore = suitScore;
        bestSuit = suit;
      }
    }
    return bestSuit;
  }

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;
    const validIdxs = V.getValidIndices(hand);
    if (validIdxs.length === 1) return validIdxs[0];

    const partnerIdx = (playerIdx + 2) % 4;
    let partnerWinning = false;
    if (S.trickCards.length > 0) {
      const curWinner = V.determineTrickWinnerPartial();
      partnerWinning = V.teamOf(curWinner) === V.teamOf(playerIdx);
    }

    const isLeading = S.trickCards.length === 0;

    if (isLeading) {
      // Lead trump if strong trump hand
      const trumpCards = validIdxs.filter(i => hand[i].suit === S.trumpSuit);
      if (trumpCards.length >= 3) {
        trumpCards.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return trumpCards[0];
      }
      // Otherwise lead highest non-trump
      const nonTrump = validIdxs.filter(i => hand[i].suit !== S.trumpSuit);
      const pool = nonTrump.length > 0 ? nonTrump : validIdxs;
      pool.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return pool[0];
    }

    const leadSuit = S.trickCards[0].suit;
    const followSuit = validIdxs.filter(i => hand[i].suit === leadSuit);

    if (followSuit.length > 0) {
      if (partnerWinning) {
        // Partner winning: play lowest of suit
        followSuit.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return followSuit[0];
      }
      // Try to head the trick
      followSuit.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return followSuit[0];
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest
      validIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return validIdxs[0];
    }

    // Try to trump
    const trumpIdxs = validIdxs.filter(i => hand[i].suit === S.trumpSuit);
    if (trumpIdxs.length > 0) {
      // Estimate trick value
      let trickValue = 0;
      for (const c of S.trickCards)
        trickValue += V.cardTrickValue(c);
      // Trump with lowest winning trump for high-value tricks
      if (trickValue >= 10) {
        trumpIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return trumpIdxs[0];
      }
      // Low value trick: dump lowest card
      validIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return validIdxs[0];
    }

    // No trump available: dump lowest
    validIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return validIdxs[0];
  }

  Object.assign(V, {
    aiBid, aiSelectTrump, aiChooseCard
  });

})();
