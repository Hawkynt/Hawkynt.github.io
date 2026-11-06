/* Rummy 500 opponents: draw choice, melding everything possible and discarding. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.rummy500;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, PLAYER_NAMES, PHASE_DRAW } = V;
  const RM = SZ.CardGames.shared.rummyMelds;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiShouldDrawDiscard(p) {
    if (S.discardPile.length === 0) return false;
    const top = S.discardPile[S.discardPile.length - 1];
    // Check if top card completes a meld in hand
    const testHand = S.hands[p].concat(top);
    const before = V.findBestMeld(S.hands[p]);
    const after = V.findBestMeld(testHand);
    if (after && !before) return true;
    if (after && before) {
      let afterVal = 0, beforeVal = 0;
      for (const idx of after) afterVal += V.cardPoints(testHand[idx]);
      for (const idx of before) beforeVal += V.cardPoints(S.hands[p][idx]);
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
      const meldIndices = V.findBestMeld(S.hands[p]);
      if (meldIndices && meldIndices.length >= 3) {
        const cards = meldIndices.map(i => S.hands[p][i]);
        if (RM.isValidMeld(cards)) {
          const sorted = meldIndices.slice().sort((a, b) => b - a);
          for (const idx of sorted) S.hands[p].splice(idx, 1);
          let pts = 0;
          for (const c of cards) pts += V.cardPoints(c);
          S.roundMeldPoints[p] += pts;
          S.tableMelds.push({ cards, owner: p });
          melded = true;

          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 180, PLAYER_NAMES[p] + ' melds +' + pts, { color: '#fa0', size: 14 });
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
          S.roundMeldPoints[p] += V.cardPoints(card);
          laidOff = true;
        }
      }
    }
  }

  function aiDiscard(p) {
    if (S.hands[p].length === 0) return -1;
    // Discard highest-value unmatched card
    // Simple: find card with highest point value that isn't part of a potential meld
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < S.hands[p].length; ++i) {
      const v = V.cardPoints(S.hands[p][i]);
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }

    // Prefer discarding cards that don't help the next player
    // Simple heuristic: discard the highest card
    const card = S.hands[p].splice(bestIdx, 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);
    return bestIdx;
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
