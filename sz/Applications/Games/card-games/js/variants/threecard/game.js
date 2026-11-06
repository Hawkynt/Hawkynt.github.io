/* Three Card Poker: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.threecard;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_DEALING, PHASE_DECISION, PHASE_REVEAL, HAND_PAIR,
    DEALER_HAND_Y, PLAYER_HAND_Y } = V;

  /**
   * Checks if dealer qualifies (Queen-high or better).
   * Dealer qualifies if hand rank >= Pair, or if high card is Q or above.
   */
  function dealerQualifies(hand) {
    const handRank = V.evaluateHand(hand);
    if (handRank >= HAND_PAIR) return true;
    const vals = V.sortedValues(hand);
    return vals[0] >= 12; // Q=12, K=13, A=14
  }

  function startDeal() {
    if (S.phase !== PHASE_BETTING || S.anteBet <= 0) return;
    S.phase = PHASE_DEALING;
    S.playerHand = [];
    S.dealerHand = [];
    S.resultMsg = '';
    S.resultDetail = '';
    S.dealStep = 0;
    S.dealTimer = 0;
    S.deck = V.createFreshDeck();
  }

  function dealNextCard() {
    const card = V.drawCard();
    const isPlayer = S.dealStep < 3;
    const hand = isPlayer ? S.playerHand : S.dealerHand;
    const idx = isPlayer ? S.dealStep : S.dealStep - 3;
    const targetY = isPlayer ? PLAYER_HAND_Y : DEALER_HAND_Y;

    card.faceUp = isPlayer; // Player cards face-up, dealer cards face-down
    hand.push(card);

    if (S._host)
      S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, V.handCardX(idx), targetY, 0);

    ++S.dealStep;
  }

  function finishDealing() {
    S.phase = PHASE_DECISION;
  }

  function finishRound() {
    S.roundOver = true;
    if (S.score <= 0) {
      S.score = 0;
      S.gameOver = true;
      S.resultMsg = 'GAME OVER';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function setupThreeCard() {
    S.deck = V.createFreshDeck();
    S.playerHand = [];
    S.dealerHand = [];
    S.phase = PHASE_BETTING;
    S.anteBet = 0;
    S.pairPlusBet = 0;
    S.selectedChip = 10;
    S.betTarget = null;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.resultDetail = '';
    S.dealStep = 0;
    S.dealTimer = 0;
    S.revealStep = 0;
    S.revealTimer = 0;
  }

  function tick(dt) {
    if (S.phase === PHASE_DEALING) {
      S.dealTimer += dt;
      if (S.dealTimer >= 0.3) {
        S.dealTimer = 0;
        dealNextCard();
        if (S.dealStep >= 6)
          finishDealing();
      }
      return;
    }

    if (S.phase === PHASE_REVEAL) {
      S.revealTimer += dt;
      if (S.revealStep === 0 && S.revealTimer >= 0.4) {
        // Reveal dealer cards
        V.revealDealerCards();
        ++S.revealStep;
        S.revealTimer = 0;
        return;
      }
      if (S.revealStep === 1 && S.revealTimer >= 0.6) {
        // Resolve after brief pause
        V.resolveRound();
      }
    }
  }

  Object.assign(V, { dealerQualifies, startDeal, finishRound, setupThreeCard, tick });

})();
