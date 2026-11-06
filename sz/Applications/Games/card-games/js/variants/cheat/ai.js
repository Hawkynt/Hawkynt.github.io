/* Cheat: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const HANDS = SZ.CardGames.shared.quickHands;
  const V = SZ.CardGames.v.cheat;
  const S = V.S;

  function aiPlayTurn(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return;

    const rank = V.requiredRank();
    const matchingIndices = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === rank) matchingIndices.push(i);

    let chosen;

    if (matchingIndices.length > 0) {
      // Play honestly: all matching cards
      chosen = matchingIndices.slice();
    } else {
      // Must bluff: pick 1-2 random cards
      const bluffCount = Math.min(hand.length, 1 + (Math.random() < 0.3 ? 1 : 0));
      const indices = [];
      for (let i = 0; i < hand.length; ++i) indices.push(i);
      CE.shuffle(indices);
      chosen = indices.slice(0, bluffCount);
    }

    V.playCards(playerIdx, chosen);
  }

  function aiDecideChallenge(aiIdx) {
    if (!S.lastPlayInfo) return false;

    const pileSize = S.discardPile.length;
    const cardsPlayed = S.lastPlayInfo.count;
    const claimedRank = S.lastPlayInfo.claimedRank;

    // AI knows its own hand -- count how many of the claimed rank it holds
    const ownCount = HANDS.countRank(S.hands[aiIdx], claimedRank);

    // If AI holds all 4, the claim must be a lie
    if (ownCount === 4) return true;

    // If AI holds 3 and player claims 2+, impossible
    if (ownCount >= 3 && cardsPlayed >= 2) return true;

    // Base probability
    let prob = 0.20;
    // More likely with large pile
    if (pileSize > 4)
      prob += 0.05 * (pileSize - 4);
    // More suspicious when claiming 3-4 cards
    if (cardsPlayed >= 3)
      prob += 0.15;
    // Slightly suspicious when claiming many with few cards of that rank possible
    if (ownCount + cardsPlayed > 4)
      return true; // impossible claim

    // Cap probability
    prob = Math.min(prob, 0.80);

    return Math.random() < prob;
  }

  Object.assign(V, { aiPlayTurn, aiDecideChallenge });

})();
