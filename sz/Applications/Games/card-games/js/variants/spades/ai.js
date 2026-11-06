/* Spades - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spades;
  const S = V.S;
  const { TRUMP_SUIT } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiBid(playerIdx) {
    const hand = S.hands[playerIdx];
    let bid = 0;

    for (const c of hand) {
      // Count aces
      if (c.rank === 'A') ++bid;
      // Count kings in suits with 3+ cards
      if (c.rank === 'K') {
        const suitCount = hand.filter(h => h.suit === c.suit).length;
        if (suitCount >= 3) ++bid;
      }
    }

    // Count spade length beyond 3
    const spadeCount = hand.filter(c => c.suit === TRUMP_SUIT).length;
    if (spadeCount >= 4)
      bid += spadeCount - 3;

    // Count high spades specifically
    const hasAceSpades = hand.some(c => c.suit === TRUMP_SUIT && c.rank === 'A');
    const hasKingSpades = hand.some(c => c.suit === TRUMP_SUIT && c.rank === 'K');
    const hasQueenSpades = hand.some(c => c.suit === TRUMP_SUIT && c.rank === 'Q');
    if (hasAceSpades && hasKingSpades && hasQueenSpades && spadeCount >= 5)
      ++bid;

    // Clamp to reasonable range; occasionally bid nil with a weak hand
    if (bid === 0) {
      const highCount = hand.filter(c => V.cardStrength(c) >= 10).length;
      if (highCount <= 1 && spadeCount <= 2 && Math.random() < 0.15)
        return 0; // nil bid
      bid = 1;
    }

    return Math.min(bid, 7);
  }

  function aiPlay(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return;

    const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;
    const valid = [];
    for (let i = 0; i < hand.length; ++i) {
      if (V.isValidPlay(hand[i], hand))
        valid.push(i);
    }
    if (valid.length === 0) return;

    // Partner of this AI
    const partnerIdx = (playerIdx + 2) % 4;
    const isPartnerLeading = S.trickPlayers.length > 0 && S.trickPlayers[0] === partnerIdx;

    // Check if partner is currently winning the trick
    let partnerWinning = false;
    if (S.trickCards.length > 0) {
      const tempWinner = V.determineTrickWinnerPartial();
      partnerWinning = V.teamOf(tempWinner) === V.teamOf(playerIdx);
    }

    // Nil bidder handling: if this AI bid nil, play lowest valid card
    if (S.bids[playerIdx] === 0) {
      valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      V.playCard(playerIdx, valid[0]);
      return;
    }

    if (!leadSuit) {
      // Leading: play highest non-spade winner, or spade if broken/all spades
      const nonSpades = valid.filter(i => hand[i].suit !== TRUMP_SUIT);
      const target = nonSpades.length > 0 ? nonSpades : valid;
      target.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      V.playCard(playerIdx, target[0]);
      return;
    }

    // Following suit
    const followSuit = valid.filter(i => hand[i].suit === leadSuit);
    if (followSuit.length > 0) {
      if (partnerWinning) {
        // Partner winning: play lowest of suit
        followSuit.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        V.playCard(playerIdx, followSuit[0]);
      } else {
        // Try to win: play highest of suit
        followSuit.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        // Only play high if it can actually win
        const currentBest = V.currentTrickBestStrength();
        const bestFollow = followSuit[0];
        if (hand[bestFollow].suit === leadSuit && V.cardStrength(hand[bestFollow]) > currentBest && !V.trickHasTrump()) {
          V.playCard(playerIdx, bestFollow);
        } else {
          // Can't beat it, dump lowest
          followSuit.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
          V.playCard(playerIdx, followSuit[0]);
        }
      }
      return;
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest non-trump if possible
      const nonTrumps = valid.filter(i => hand[i].suit !== TRUMP_SUIT);
      const dump = nonTrumps.length > 0 ? nonTrumps : valid;
      dump.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      V.playCard(playerIdx, dump[0]);
    } else {
      // Trump in with lowest spade, or dump lowest
      const trumps = valid.filter(i => hand[i].suit === TRUMP_SUIT);
      if (trumps.length > 0) {
        // Use lowest trump that wins
        trumps.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        V.playCard(playerIdx, trumps[0]);
      } else {
        valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        V.playCard(playerIdx, valid[0]);
      }
    }
  }

  Object.assign(V, {
    aiBid, aiPlay
  });

})();
