/* Whist - opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.whist;
  const S = V.S;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiPlay(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return;

    const valid = V.getValidIndices(hand);
    if (valid.length === 0) return;
    if (valid.length === 1) {
      V.playCard(playerIdx, valid[0]);
      return;
    }

    const leadSuit = S.trickCards.length > 0 ? S.trickCards[0].suit : null;
    const partnerIdx = (playerIdx + 2) % 4;

    let partnerWinning = false;
    if (S.trickCards.length > 0) {
      const tempWinner = V.determineTrickWinnerPartial();
      partnerWinning = V.teamOf(tempWinner) === V.teamOf(playerIdx);
    }

    // Leading
    if (!leadSuit) {
      // Lead with strongest suit; prefer non-trump aces/kings
      const nonTrumps = valid.filter(i => hand[i].suit !== S.trumpSuit);
      const pool = nonTrumps.length > 0 ? nonTrumps : valid;
      // Lead highest card to try to win
      pool.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
      V.playCard(playerIdx, pool[0]);
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
        // Third-hand high: try to win with highest card
        followSuit.sort((a, b) => V.cardStrength(hand[b]) - V.cardStrength(hand[a]));
        const bestFollow = followSuit[0];
        const currentBest = V.currentTrickBestStrength();
        if (V.cardStrength(hand[bestFollow]) > currentBest && !V.trickHasTrump()) {
          V.playCard(playerIdx, bestFollow);
        } else {
          // Can't beat it, dump lowest
          followSuit.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
          V.playCard(playerIdx, followSuit[0]);
        }
      }
      return;
    }

    // Void in led suit
    if (partnerWinning) {
      // Partner winning: dump lowest non-trump
      const nonTrumps = valid.filter(i => hand[i].suit !== S.trumpSuit);
      const dump = nonTrumps.length > 0 ? nonTrumps : valid;
      dump.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      V.playCard(playerIdx, dump[0]);
    } else {
      // Trump in with lowest trump that wins, or dump lowest
      const trumps = valid.filter(i => hand[i].suit === S.trumpSuit);
      if (trumps.length > 0) {
        trumps.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        V.playCard(playerIdx, trumps[0]);
      } else {
        valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
        V.playCard(playerIdx, valid[0]);
      }
    }
  }

  Object.assign(V, {
    aiPlay
  });

})();
