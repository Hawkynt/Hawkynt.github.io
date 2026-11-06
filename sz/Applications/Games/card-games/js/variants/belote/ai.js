/* Belote: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.belote;
  const S = V.S;
  const { TRUMP_STRENGTH, PLAIN_STRENGTH } = V;

  function aiShouldTakeRound1(playerIdx) {
    const hand = S.hands[playerIdx];
    const suit = S.proposedCard.suit;
    const trumpCount = V.countCardsOfSuit(hand, suit);
    const hasJ = V.hasRankInSuit(hand, suit, 'J');
    const has9 = V.hasRankInSuit(hand, suit, '9');
    const hasA = V.hasRankInSuit(hand, suit, 'A');

    // Strong take: J + 2 others, or 14+ total points
    if (hasJ && trumpCount >= 2) return true;
    if (trumpCount >= 3 && (has9 || hasA)) return true;
    if (V.handPointsForSuit(hand, suit) >= 14) return true;

    // Dealer gets the card, so be more aggressive as dealer
    if (playerIdx === S.dealer && trumpCount >= 2 && (hasJ || has9)) return true;

    return false;
  }

  function aiPickTrumpRound2(playerIdx) {
    const hand = S.hands[playerIdx];
    const excludeSuit = S.proposedCard ? S.proposedCard.suit : null;
    let bestSuit = null;
    let bestScore = 0;

    for (const s of CE.SUITS) {
      if (s === excludeSuit) continue;
      const count = V.countCardsOfSuit(hand, s);
      const hasJ = V.hasRankInSuit(hand, s, 'J');
      const has9 = V.hasRankInSuit(hand, s, '9');

      if (count >= 3 && (hasJ || has9)) {
        const sc = count * 10 + (hasJ ? 20 : 0) + (has9 ? 14 : 0);
        if (sc > bestScore) {
          bestScore = sc;
          bestSuit = s;
        }
      }
    }

    return bestSuit;
  }

  /* ================================================================
     AI - PLAY
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = S.hands[playerIdx];
    if (hand.length === 0) return -1;

    const valid = V.getValidIndices(hand, playerIdx);
    if (valid.length === 1) return valid[0];

    const isLeading = S.trickCards.length === 0;
    const partner = V.partnerOf(playerIdx);

    if (isLeading) {
      // Lead with trump J or 9 if we have strong trumps
      const trumpIdxs = valid.filter(i => hand[i].suit === S.trumpSuit);
      if (trumpIdxs.length >= 3) {
        trumpIdxs.sort((a, b) => TRUMP_STRENGTH[hand[b].rank] - TRUMP_STRENGTH[hand[a].rank]);
        return trumpIdxs[0];
      }
      // Lead with non-trump aces
      const aces = valid.filter(i => hand[i].suit !== S.trumpSuit && hand[i].rank === 'A');
      if (aces.length > 0) return aces[0];
      // Lead with highest non-trump
      const nonTrump = valid.filter(i => hand[i].suit !== S.trumpSuit);
      if (nonTrump.length > 0) {
        nonTrump.sort((a, b) => PLAIN_STRENGTH[hand[b].rank] - PLAIN_STRENGTH[hand[a].rank]);
        return nonTrump[0];
      }
      // Only trumps left, lead lowest
      valid.sort((a, b) => TRUMP_STRENGTH[hand[a].rank] - TRUMP_STRENGTH[hand[b].rank]);
      return valid[0];
    }

    // Not leading
    const winnerPlayer = V.currentWinningPlayer();
    const partnerWinning = winnerPlayer >= 0 && V.teamOf(winnerPlayer) === V.teamOf(playerIdx);
    const leadSuit = S.trickCards[0].suit;

    // Following suit
    const followIdxs = valid.filter(i => hand[i].suit === leadSuit);
    if (followIdxs.length > 0) {
      if (partnerWinning) {
        // Play lowest of suit
        followIdxs.sort((a, b) => {
          const strA = leadSuit === S.trumpSuit ? TRUMP_STRENGTH[hand[a].rank] : PLAIN_STRENGTH[hand[a].rank];
          const strB = leadSuit === S.trumpSuit ? TRUMP_STRENGTH[hand[b].rank] : PLAIN_STRENGTH[hand[b].rank];
          return strA - strB;
        });
        return followIdxs[0];
      }
      // Try to win with lowest winning card
      followIdxs.sort((a, b) => {
        const strA = leadSuit === S.trumpSuit ? TRUMP_STRENGTH[hand[a].rank] : PLAIN_STRENGTH[hand[a].rank];
        const strB = leadSuit === S.trumpSuit ? TRUMP_STRENGTH[hand[b].rank] : PLAIN_STRENGTH[hand[b].rank];
        return strB - strA;
      });
      return followIdxs[0];
    }

    // Can't follow suit
    if (partnerWinning) {
      // Dump lowest non-trump
      const dump = valid.filter(i => hand[i].suit !== S.trumpSuit);
      const choice = dump.length > 0 ? dump : valid;
      choice.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
      return choice[0];
    }

    // Must trump: play lowest winning trump
    const trumpIdxs = valid.filter(i => hand[i].suit === S.trumpSuit);
    if (trumpIdxs.length > 0) {
      trumpIdxs.sort((a, b) => TRUMP_STRENGTH[hand[a].rank] - TRUMP_STRENGTH[hand[b].rank]);
      return trumpIdxs[0];
    }

    // No trump available, dump lowest
    valid.sort((a, b) => V.cardStrength(hand[a]) - V.cardStrength(hand[b]));
    return valid[0];
  }

  V.aiShouldTakeRound1 = aiShouldTakeRound1;
  V.aiPickTrumpRound2 = aiPickTrumpRound2;
  V.aiChooseCard = aiChooseCard;

})();
