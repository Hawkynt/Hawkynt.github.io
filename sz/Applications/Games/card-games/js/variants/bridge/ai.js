/* Bridge - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.bridge;
  const S = V.S;

  /* ================================================================
     AI BIDDING
     ================================================================ */

  function aiBid(playerIdx) {
    const hand = S.hands[playerIdx];
    const hcp = V.getHCP(hand);
    const dp = V.getDistributionPoints(hand);
    const totalPts = hcp + dp;
    const lastBid = V.getLastNonPassBid();
    const partner = V.partnerOf(playerIdx);

    /* Check if partner has bid */
    let partnerBid = null;
    for (const h of S.bidHistory)
      if (h.player === partner && h.bid !== 'pass')
        partnerBid = h.bid;

    /* Determine a suit to bid */
    let bestSuit = V.getLongestSuit(hand);
    let bestSuitCount = V.countSuit(hand, bestSuit);

    /* With balanced hand and 15-17 HCP, prefer notrump */
    const isBalanced = CE.SUITS.every(s => V.countSuit(hand, s) >= 2);

    /* Opening bid logic */
    if (!lastBid && !partnerBid) {
      if (totalPts < 13) return 'pass';

      if (isBalanced && hcp >= 15 && hcp <= 17)
        return { level: 1, strain: 'notrump' };

      if (bestSuitCount >= 5)
        return { level: 1, strain: bestSuit };

      /* Bid longest minor with short major suits */
      const clubCount = V.countSuit(hand, 'clubs');
      const diamondCount = V.countSuit(hand, 'diamonds');
      return { level: 1, strain: diamondCount >= clubCount ? 'diamonds' : 'clubs' };
    }

    /* Responding to partner's bid */
    if (partnerBid && !lastBid) {
      if (totalPts < 6) return 'pass';

      /* Raise partner's suit */
      if (partnerBid.strain !== 'notrump') {
        const support = V.countSuit(hand, partnerBid.strain);
        if (support >= 3 && totalPts >= 6) {
          const newLevel = partnerBid.level + (totalPts >= 13 ? 1 : 0);
          if (newLevel <= 4) {
            const candidate = { level: Math.min(newLevel + 1, 4), strain: partnerBid.strain };
            if (V.bidIsHigher(candidate, lastBid))
              return candidate;
          }
        }
      }

      /* Bid new suit at 1 level if possible */
      if (bestSuitCount >= 4 && totalPts >= 6) {
        const candidate = { level: 1, strain: bestSuit };
        if (V.bidIsHigher(candidate, lastBid || partnerBid))
          return candidate;
        if (totalPts >= 10) {
          const candidate2 = { level: 2, strain: bestSuit };
          if (V.bidIsHigher(candidate2, lastBid || partnerBid))
            return candidate2;
        }
      }

      /* Bid NT */
      if (isBalanced && hcp >= 6) {
        const ntLevel = partnerBid.strain === 'notrump' ? partnerBid.level + 1 : 1;
        if (ntLevel <= 3) {
          const candidate = { level: ntLevel, strain: 'notrump' };
          if (V.bidIsHigher(candidate, lastBid || partnerBid))
            return candidate;
        }
      }

      return 'pass';
    }

    /* Competitive bidding: opponent has bid, we respond */
    if (lastBid) {
      if (totalPts < 10) return 'pass';

      /* Try to overcall with a good 5+ card suit */
      if (bestSuitCount >= 5 && hcp >= 10) {
        for (let lvl = lastBid.level; lvl <= Math.min(lastBid.level + 1, 3); ++lvl) {
          const candidate = { level: lvl, strain: bestSuit };
          if (V.bidIsHigher(candidate, lastBid))
            return candidate;
        }
      }

      /* NT overcall with 15-18 HCP and balanced hand */
      if (isBalanced && hcp >= 15 && hcp <= 18) {
        const candidate = { level: lastBid.level, strain: 'notrump' };
        if (V.bidIsHigher(candidate, lastBid))
          return candidate;
        const candidate2 = { level: lastBid.level + 1, strain: 'notrump' };
        if (candidate2.level <= 3 && V.bidIsHigher(candidate2, lastBid))
          return candidate2;
      }

      return 'pass';
    }

    return 'pass';
  }

  /* ================================================================
     AI PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = V.getValidIndices(hand);
    if (valid.length === 1) return valid[0];

    const isLeading = S.trickCards.length === 0;
    const partner = V.partnerOf(playerIdx);

    /* Check if partner is winning */
    let partnerWinning = false;
    if (S.trickCards.length > 0) {
      const tempWinner = V.resolveTrickWinnerPartial();
      partnerWinning = V.teamOf(tempWinner) === V.teamOf(playerIdx);
    }

    if (isLeading) {
      /* Lead partner's suit if known from bidding */
      /* Otherwise lead through declarer -- lead low from long suit */
      const nonTrump = valid.filter(i => !S.trumpSuit || hand[i].suit !== S.trumpSuit);
      const pool = nonTrump.length > 0 ? nonTrump : valid;

      /* Lead 4th best from longest suit */
      let bestSuit = null;
      let bestLen = 0;
      for (const s of CE.SUITS) {
        if (s === S.trumpSuit) continue;
        const suitCards = pool.filter(i => hand[i].suit === s);
        if (suitCards.length > bestLen) {
          bestLen = suitCards.length;
          bestSuit = s;
        }
      }

      if (bestSuit) {
        const suitCards = pool.filter(i => hand[i].suit === bestSuit);
        suitCards.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        /* Lead 4th best (or lowest if fewer than 4) */
        const idx = Math.max(0, suitCards.length - 4);
        return suitCards[idx];
      }

      pool.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return pool[0];
    }

    const leadSuit = S.trickCards[0].suit;
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);

    if (followIdxs.length > 0) {
      /* Second hand low */
      if (S.trickCards.length === 1) {
        followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return followIdxs[0];
      }

      /* Third hand high */
      if (S.trickCards.length === 2 && !partnerWinning) {
        followIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        return followIdxs[0];
      }

      /* Fourth hand: play just enough to win, or dump lowest */
      if (S.trickCards.length === 3) {
        if (partnerWinning) {
          followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
          return followIdxs[0];
        }
        /* Try to win with minimum */
        const currentBest = Math.max(...S.trickCards.filter(c => c.suit === leadSuit).map(c => V.cardStrength(c)));
        const winners = followIdxs.filter(i => V.cardStrength(hand[i]) > currentBest);
        if (winners.length > 0) {
          winners.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
          return winners[0];
        }
        followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return followIdxs[0];
      }

      /* Default: partner winning => lowest, else highest */
      if (partnerWinning) {
        followIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        return followIdxs[0];
      }
      followIdxs.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      return followIdxs[0];
    }

    /* Can't follow suit */
    if (partnerWinning) {
      /* Dump lowest non-trump */
      const nonTrump = valid.filter(i => !S.trumpSuit || hand[i].suit !== S.trumpSuit);
      const dump = nonTrump.length > 0 ? nonTrump : valid;
      dump.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return dump[0];
    }

    /* Trump in with lowest trump if possible */
    if (S.trumpSuit) {
      const trumpIdxs = valid.filter(i => hand[i].suit === S.trumpSuit);
      if (trumpIdxs.length > 0) {
        /* Check if existing trump in trick */
        const trickTrumps = S.trickCards.filter(c => c.suit === S.trumpSuit);
        if (trickTrumps.length > 0) {
          const bestTrump = Math.max(...trickTrumps.map(c => V.cardStrength(c)));
          const overTrumps = trumpIdxs.filter(i => V.cardStrength(hand[i]) > bestTrump);
          if (overTrumps.length > 0) {
            overTrumps.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
            return overTrumps[0];
          }
        } else {
          trumpIdxs.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
          return trumpIdxs[0];
        }
      }
    }

    /* Dump lowest */
    valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return valid[0];
  }

  Object.assign(V, {
    aiBid, aiChooseCard
  });

})();
