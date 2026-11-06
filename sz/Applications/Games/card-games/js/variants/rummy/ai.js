/* Rummy opponents: draw choice, melding and discarding. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.rummy;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, PLAYER_NAMES, PHASE_DRAW } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiShouldDrawDiscard(p) {
    if (S.discardPile.length === 0) return false;
    const top = S.discardPile[S.discardPile.length - 1];
    // Check if top card completes a meld in hand
    const testHand = S.hands[p].concat(top);
    const before = V.findBestSingleMeld(S.hands[p]);
    const after = V.findBestSingleMeld(testHand);
    if (after && !before) return true;
    if (after && before) {
      let afterVal = 0, beforeVal = 0;
      for (const idx of after) afterVal += V.cardPenalty(testHand[idx]);
      for (const idx of before) beforeVal += V.cardPenalty(S.hands[p][idx]);
      if (afterVal > beforeVal) return true;
    }
    return false;
  }

  function aiDraw(p) {
    if (aiShouldDrawDiscard(p) && S.discardPile.length > 0) {
      const card = S.discardPile.pop();
      card.faceUp = false;
      S.hands[p].push(card);
    } else {
      if (V.checkStockExhausted()) return;
      const card = S.stockPile.pop();
      S.hands[p].push(card);
    }
  }

  function aiMeldAll(p) {
    // Repeatedly find and lay melds until none remain
    let melded = true;
    while (melded) {
      melded = false;
      const meldIndices = V.findBestSingleMeld(S.hands[p]);
      if (meldIndices && meldIndices.length >= 3) {
        const cards = meldIndices.map(i => S.hands[p][i]);
        if (V.isValidMeld(cards)) {
          const sorted = meldIndices.slice().sort((a, b) => b - a);
          for (const idx of sorted) S.hands[p].splice(idx, 1);
          S.tableMelds.push({ cards, owner: p });
          melded = true;

          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 180, PLAYER_NAMES[p] + ' melds!', { color: '#fa0', size: 14 });
        }
      }
    }

    // Try lay offs
    let laidOff = true;
    while (laidOff) {
      laidOff = false;
      for (let i = S.hands[p].length - 1; i >= 0; --i) {
        const target = V.findLayOffTarget(S.hands[p][i]);
        if (target >= 0) {
          const card = S.hands[p].splice(i, 1)[0];
          S.tableMelds[target].cards.push(card);
          laidOff = true;
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' lays off', { color: '#fa0', size: 12 });
        }
      }
    }
  }

  function aiDiscard(p) {
    if (S.hands[p].length === 0) return;
    // Discard highest-penalty card that doesn't help the hand
    // Try discarding each card, pick the one that leaves the most meld potential with lowest remaining penalty
    let bestIdx = 0;
    let bestPenalty = -1;
    for (let i = 0; i < S.hands[p].length; ++i) {
      const testHand = S.hands[p].filter((_, j) => j !== i);
      const result = V.findBestMelds(testHand);
      // Remaining penalty after removing best melds
      let remaining = 0;
      for (let j = 0; j < testHand.length; ++j) {
        if (!result.indices.has(j)) remaining += V.cardPenalty(testHand[j]);
      }
      // We want to discard the card whose removal leaves the lowest remaining penalty
      // But we also want to discard high-value cards when they're useless
      // So: discard the card where (cardPenalty of discarded) is highest AND remaining is lowest
      const discardValue = V.cardPenalty(S.hands[p][i]);
      const rating = discardValue * 2 - remaining; // heuristic
      if (rating > bestPenalty) {
        bestPenalty = rating;
        bestIdx = i;
      }
    }

    const card = S.hands[p].splice(bestIdx, 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);
  }

  function aiTakeTurn(p) {
    if (S.aiStep === 0) {
      aiDraw(p);
      if (S.roundOver) return;
      ++S.aiStep;
      S.aiTimer = 0;
      return;
    }

    if (S.aiStep === 1) {
      aiMeldAll(p);
      if (S.hands[p].length === 0) {
        V.endRound(p);
        return;
      }
      ++S.aiStep;
      S.aiTimer = 0;
      return;
    }

    if (S.aiStep === 2) {
      aiDiscard(p);
      if (S.hands[p].length === 0) {
        V.endRound(p);
        return;
      }

      // Advance to next player
      const next = (p + 1) % NUM_PLAYERS;
      if (next === 0) {
        S.currentPlayer = 0;
        S.phase = PHASE_DRAW;
        S.selectedIndices = [];
        if (V.checkStockExhausted()) return;
      } else {
        S.currentPlayer = next;
        S.aiStep = 0;
        S.aiTimer = 0;
      }
    }
  }

  Object.assign(V, { aiTakeTurn });

})();
