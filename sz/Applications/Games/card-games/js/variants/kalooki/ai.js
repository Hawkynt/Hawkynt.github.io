/* Kalooki opponents: draw choice, melding, laying off, joker replacement and discarding. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.kalooki;
  const S = V.S;
  const { CANVAS_W, INITIAL_MELD_MIN, PLAYER_NAMES } = V;
  const RC = SZ.CardGames.shared.rummyCards;
  const RM = SZ.CardGames.shared.rummyMelds;

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiTakeTurn(p) {
    const hand = S.hands[p];

    if (S.aiStep === 0) {
      // Draw phase
      if (S.discardPile.length > 0 && aiShouldDrawDiscard(hand))
        hand.push(S.discardPile.pop());
      else if (V.replenishStock())
        hand.push(S.stockPile.pop());
      else if (S.discardPile.length > 0)
        hand.push(S.discardPile.pop());
      else
        return; // stuck
      S.aiStep = 1;
      S.aiTimer = 0;
      return;
    }

    if (S.aiStep === 1) {
      // Meld / lay off phase
      aiTryMelds(p);
      aiTryLayOffs(p);
      aiTryJokerReplace(p);

      if (hand.length === 0) {
        V.endRound(p);
        return;
      }

      S.aiStep = 2;
      S.aiTimer = 0;
      return;
    }

    // Discard phase
    const discIdx = aiChooseDiscard(hand);
    const card = hand.splice(discIdx, 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);

    if (hand.length === 0) {
      V.endRound(p);
      return;
    }

    V.advanceTurn();
  }

  function aiShouldDrawDiscard(hand) {
    if (S.discardPile.length === 0) return false;
    const topDiscard = S.discardPile[S.discardPile.length - 1];
    const testHand = hand.concat(topDiscard);
    const before = V.findBestMelds(hand);
    const after = V.findBestMelds(testHand);
    return after.melds.length > before.melds.length || after.penalty < before.penalty - 3;
  }

  function aiTryMelds(p) {
    const hand = S.hands[p];
    let changed = true;
    while (changed) {
      changed = false;
      const allMelds = [...RM.findAllSets(hand), ...RM.findAllRuns(hand)];
      for (const meldIndices of allMelds) {
        const cards = meldIndices.map(i => hand[i]);
        if (!RM.isValidMeld(cards)) continue;

        if (!S.hasMelded[p]) {
          const val = V.meldPointValue(cards);
          if (val < INITIAL_MELD_MIN) continue;
        }

        const sorted = meldIndices.slice().sort((a, b) => b - a);
        for (const idx of sorted) hand.splice(idx, 1);
        for (const c of cards) c.faceUp = true;
        S.tableMelds.push({ cards, owner: p });
        S.hasMelded[p] = true;
        changed = true;
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' melds!', { color: '#88f', size: 16 });
        break;
      }
    }
  }

  function aiTryLayOffs(p) {
    if (!S.hasMelded[p]) return;
    const hand = S.hands[p];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = hand.length - 1; i >= 0; --i) {
        if (RC.isJoker(hand[i])) continue; // AI saves jokers
        for (const tm of S.tableMelds) {
          if (RM.canLayOffOn(hand[i], tm)) {
            const card = hand.splice(i, 1)[0];
            card.faceUp = true;
            tm.cards.push(card);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
  }

  function aiTryJokerReplace(p) {
    if (!S.hasMelded[p]) return;
    const hand = S.hands[p];
    for (let i = hand.length - 1; i >= 0; --i) {
      if (RC.isJoker(hand[i])) continue;
      for (const tm of S.tableMelds) {
        if (V.canReplaceJoker(hand[i], tm)) {
          const jokerIdx = tm.cards.findIndex(c => RC.isJoker(c));
          const joker = tm.cards[jokerIdx];
          tm.cards[jokerIdx] = hand[i];
          hand[i].faceUp = true;
          hand.splice(i, 1);
          hand.push(joker);
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' replaces joker!', { color: '#ff8', size: 14 });
          return;
        }
      }
    }
  }

  function aiChooseDiscard(hand) {
    let bestIdx = 0;
    let bestPen = -1;
    for (let i = 0; i < hand.length; ++i) {
      // AI never discards jokers if avoidable
      if (RC.isJoker(hand[i]) && hand.length > 1) continue;
      const pen = V.cardPenalty(hand[i]);
      // Prefer discarding high-penalty non-meldable cards
      const testHand = hand.filter((_, j) => j !== i);
      const result = V.findBestMelds(testHand);
      const value = pen * 2 + result.penalty;
      // Higher value = more desirable to discard (higher penalty card + remaining hand well off)
      // Actually we want to minimize remaining penalty but prefer discarding high-value deadwood
      const rating = result.penalty;
      if (bestPen < 0 || rating < bestPen || (rating === bestPen && pen > V.cardPenalty(hand[bestIdx]))) {
        bestPen = rating;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  Object.assign(V, { aiTakeTurn });

})();
