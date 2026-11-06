/* Three Card Poker: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.threecard;
  const S = V.S;
  const { CANVAS_W, PHASE_BETTING, PHASE_DECISION, PHASE_REVEAL, PHASE_RESULT, HAND_HIGH_CARD,
    HAND_PAIR, HAND_FLUSH, HAND_STRAIGHT, HAND_THREE_KIND, HAND_STRAIGHT_FLUSH, PP_PAYOUTS,
    ANTE_BONUS, PLAYER_HAND_Y, CARD_GAP, BET_ZONE_Y } = V;

  function createFreshDeck() {
    return CE.shuffle(CE.createDeck());
  }

  function drawCard() {
    if (S.deck.length < 1)
      S.deck = createFreshDeck();
    return S.deck.pop();
  }

  function rankValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank, 10);
  }

  function sortedValues(hand) {
    const vals = hand.map(c => rankValue(c.rank));
    vals.sort((a, b) => b - a);
    return vals;
  }

  function isFlush(hand) {
    return hand[0].suit === hand[1].suit && hand[1].suit === hand[2].suit;
  }

  function isStraight(hand) {
    const vals = sortedValues(hand);
    // Normal straight: consecutive descending
    if (vals[0] - vals[1] === 1 && vals[1] - vals[2] === 1)
      return true;
    // Ace-low straight: A-2-3
    if (vals[0] === 14 && vals[1] === 3 && vals[2] === 2)
      return true;
    return false;
  }

  function isThreeOfAKind(hand) {
    return hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank;
  }

  function isPair(hand) {
    return hand[0].rank === hand[1].rank || hand[1].rank === hand[2].rank || hand[0].rank === hand[2].rank;
  }

  function evaluateHand(hand) {
    const flush = isFlush(hand);
    const straight = isStraight(hand);
    const threeKind = isThreeOfAKind(hand);
    const pair = isPair(hand);

    if (straight && flush) return HAND_STRAIGHT_FLUSH;
    if (threeKind) return HAND_THREE_KIND;
    if (straight) return HAND_STRAIGHT;
    if (flush) return HAND_FLUSH;
    if (pair) return HAND_PAIR;
    return HAND_HIGH_CARD;
  }

  /**
   * Returns an array of tiebreaker values for comparing hands of equal rank.
   * For pairs, the pair value comes first, then the kicker.
   * For everything else, descending sorted values (with ace-low straight handled).
   */
  function tiebreakers(hand) {
    const vals = sortedValues(hand);
    const handRank = evaluateHand(hand);

    if (handRank === HAND_PAIR) {
      // Find the pair value
      if (vals[0] === vals[1])
        return [vals[0], vals[2]];
      if (vals[1] === vals[2])
        return [vals[1], vals[0]];
      // vals[0] === vals[2] shouldn't happen with sorted, but handle it
      return [vals[0], vals[1]];
    }

    // Ace-low straight: A-2-3 should compare as 3-2-1
    if ((handRank === HAND_STRAIGHT || handRank === HAND_STRAIGHT_FLUSH) &&
        vals[0] === 14 && vals[1] === 3 && vals[2] === 2)
      return [3, 2, 1];

    return vals;
  }

  /**
   * Compares two 3-card hands. Returns positive if hand1 wins, negative if hand2 wins, 0 for tie.
   */
  function compareHands(hand1, hand2) {
    const rank1 = evaluateHand(hand1);
    const rank2 = evaluateHand(hand2);
    if (rank1 !== rank2)
      return rank1 - rank2;

    const tb1 = tiebreakers(hand1);
    const tb2 = tiebreakers(hand2);
    for (let i = 0; i < tb1.length; ++i) {
      if (tb1[i] !== tb2[i])
        return tb1[i] - tb2[i];
    }
    return 0;
  }

  /**
   * Checks if player hand meets the Q-6-4 threshold for the play hint.
   */
  function shouldPlay(hand) {
    const handRank = evaluateHand(hand);
    if (handRank >= HAND_PAIR) return true;
    const vals = sortedValues(hand);
    if (vals[0] > 12) return true;
    if (vals[0] < 12) return false;
    // High card is exactly Q
    if (vals[1] > 6) return true;
    if (vals[1] < 6) return false;
    // Second card is exactly 6
    return vals[2] >= 4;
  }

  function placeBet(target) {
    if (S.phase !== PHASE_BETTING) return;
    if (S.selectedChip > S.score) return;

    if (target === 'ante') {
      const newAnte = S.anteBet + S.selectedChip;
      // Ante + potential Play bet must not exceed score (minus existing pair plus)
      if (newAnte * 2 + S.pairPlusBet > S.score)
        return;
      S.anteBet = newAnte;
    } else if (target === 'pairplus') {
      const newPP = S.pairPlusBet + S.selectedChip;
      if (S.anteBet * 2 + newPP > S.score)
        return;
      S.pairPlusBet = newPP;
    }
  }

  function clearBets() {
    S.anteBet = 0;
    S.pairPlusBet = 0;
  }

  function doPlay() {
    if (S.phase !== PHASE_DECISION) return;
    // Play bet matches ante
    S.phase = PHASE_REVEAL;
    S.revealStep = 0;
    S.revealTimer = 0;
  }

  function doFold() {
    if (S.phase !== PHASE_DECISION) return;
    // Lose ante + pair plus
    const loss = S.anteBet + S.pairPlusBet;
    S.score -= loss;
    S.resultMsg = 'Folded! -$' + loss;
    S.resultDetail = '';

    if (S._host) {
      S._host.floatingText.add(CANVAS_W / 2, 250, 'Fold -$' + loss, { color: '#f44', size: 22 });
      S._host.screenShake.trigger(4, 200);
    }

    V.finishRound();
  }

  function revealDealerCards() {
    for (const c of S.dealerHand) {
      c.faceUp = true;
      if (S._host)
        S._host.flipCard(c, true);
    }
  }

  function resolveRound() {
    S.phase = PHASE_RESULT;
    revealDealerCards();

    const playerRank = evaluateHand(S.playerHand);
    const qualifies = V.dealerQualifies(S.dealerHand);
    const comparison = compareHands(S.playerHand, S.dealerHand);

    let totalWin = 0;
    let totalLoss = 0;
    const details = [];

    /* ── Pair Plus (independent of everything) ── */
    if (S.pairPlusBet > 0) {
      const ppMult = PP_PAYOUTS[playerRank];
      if (ppMult !== undefined) {
        const ppWin = S.pairPlusBet * ppMult;
        totalWin += ppWin;
        details.push('Pair Plus +$' + ppWin);
      } else {
        totalLoss += S.pairPlusBet;
        details.push('Pair Plus -$' + S.pairPlusBet);
      }
    }

    /* ── Ante Bonus (paid regardless of dealer qualifying) ── */
    const abMult = ANTE_BONUS[playerRank];
    if (abMult !== undefined) {
      const abWin = S.anteBet * abMult;
      totalWin += abWin;
      details.push('Ante Bonus +$' + abWin);
    }

    /* ── Ante / Play resolution ── */
    if (!qualifies) {
      // Ante pays 1:1, Play pushes (returned)
      totalWin += S.anteBet;
      details.push('Dealer doesn\'t qualify: Ante +$' + S.anteBet + ', Play push');
    } else if (comparison > 0) {
      // Player wins: Ante 1:1, Play 1:1
      totalWin += S.anteBet + S.anteBet; // ante win + play win
      details.push('Player wins: +$' + (S.anteBet * 2));
    } else if (comparison < 0) {
      // Dealer wins: lose ante + play
      totalLoss += S.anteBet + S.anteBet;
      details.push('Dealer wins: -$' + (S.anteBet * 2));
    } else {
      // Tie: both push
      details.push('Tie: Ante & Play push');
    }

    const net = totalWin - totalLoss;
    S.score += net;

    if (net > 0) {
      S.resultMsg = 'Win +$' + net + '!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 250, S.resultMsg, { color: '#4f4', size: 24 });
        S._host.addGlow(V.handCardX(0), PLAYER_HAND_Y, 3 * (CE.CARD_W + CARD_GAP), CE.CARD_H, 2.0);
        S._host.triggerChipSparkle(CANVAS_W / 2, BET_ZONE_Y);
        S._host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else if (net < 0) {
      S.resultMsg = 'Lose $' + Math.abs(net);
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 250, S.resultMsg, { color: '#f44', size: 24 });
        S._host.screenShake.trigger(6, 300);
      }
    } else {
      S.resultMsg = 'Push (break even)';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 250, 'Push', { color: '#ff8', size: 22 });
    }

    S.resultDetail = details.join('  |  ');

    V.finishRound();
  }

  Object.assign(V, { createFreshDeck, drawCard, sortedValues, evaluateHand, shouldPlay, placeBet,
    clearBets, doPlay, doFold, revealDealerCards, resolveRound });

})();
