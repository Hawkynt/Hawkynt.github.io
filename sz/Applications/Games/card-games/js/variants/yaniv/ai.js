/* Yaniv opponents: best discard (runs, sets, singles), draw source and calling Yaniv. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.yaniv;
  const S = V.S;
  const { CANVAS_W, PLAYER_NAMES, PHASE_YANIV_REVEAL, STOCK_Y } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const AI_YANIV_THRESHOLD = 5;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiFindBestDiscard(p) {
    const hand = S.hands[p];
    if (hand.length === 0) return [];

    // Strategy: try to discard highest-value combo
    // 1. Find runs (longest first for maximum discard)
    const bestRun = aiFindBestRun(hand);
    // 2. Find sets
    const bestSet = aiFindBestSet(hand);

    // Compare: prefer the combo that removes the most value
    let runValue = 0;
    if (bestRun) {
      for (const idx of bestRun) runValue += V.cardValue(hand[idx]);
    }
    let setValue = 0;
    if (bestSet) {
      for (const idx of bestSet) setValue += V.cardValue(hand[idx]);
    }

    // If a combo removes more value, use it
    if (bestRun && runValue >= setValue && bestRun.length >= 3)
      return bestRun;
    if (bestSet && setValue > 0 && bestSet.length >= 2)
      return bestSet;

    // Otherwise, discard the single highest-value card
    let highIdx = 0;
    let highVal = V.cardValue(hand[0]);
    for (let i = 1; i < hand.length; ++i) {
      const v = V.cardValue(hand[i]);
      if (v > highVal) {
        highVal = v;
        highIdx = i;
      }
    }
    return [highIdx];
  }

  function aiFindBestRun(hand) {
    // Group by suit (excluding jokers)
    const bySuit = {};
    const jokerIndices = [];
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === 'joker') {
        jokerIndices.push(i);
        continue;
      }
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }

    let bestRun = null;
    let bestRunValue = 0;

    for (const suit in bySuit) {
      const indices = bySuit[suit];
      indices.sort((a, b) => RC.rankIndexJokers(hand[a]) - RC.rankIndexJokers(hand[b]));

      // Try all starting points
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        let jokersUsed = 0;
        let jokersAvail = jokerIndices.length;
        let lastRank = RC.rankIndexJokers(hand[indices[start]]);

        for (let next = start + 1; next < indices.length; ++next) {
          const nextRank = RC.rankIndexJokers(hand[indices[next]]);
          const gap = nextRank - lastRank - 1;

          if (gap === 0) {
            run.push(indices[next]);
            lastRank = nextRank;
          } else if (gap > 0 && gap <= jokersAvail - jokersUsed) {
            // Fill gaps with jokers
            for (let g = 0; g < gap; ++g) {
              run.push(jokerIndices[jokersUsed]);
              ++jokersUsed;
            }
            run.push(indices[next]);
            lastRank = nextRank;
          } else {
            break;
          }
        }

        if (run.length >= 3) {
          let runVal = 0;
          for (const idx of run) runVal += V.cardValue(hand[idx]);
          if (runVal > bestRunValue) {
            bestRunValue = runVal;
            bestRun = run.slice();
          }
        }
      }
    }

    return bestRun;
  }

  function aiFindBestSet(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === 'joker') continue;
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }

    let bestSet = null;
    let bestSetValue = 0;

    for (const rank in byRank) {
      if (byRank[rank].length >= 2) {
        const setIndices = byRank[rank];
        let setVal = 0;
        for (const idx of setIndices) setVal += V.cardValue(hand[idx]);
        if (setVal > bestSetValue) {
          bestSetValue = setVal;
          bestSet = setIndices.slice();
        }
      }
    }

    return bestSet;
  }

  function aiChooseDrawSource(p) {
    // Check if first or last card of discard group is useful
    const hand = S.hands[p];
    const drawableIndices = V.getDrawableDiscardCards();

    for (const di of drawableIndices) {
      const card = S.discardGroup[di];
      // Check if this card would help form a meld or lower hand total
      const currentTotal = V.handTotal(hand);
      // Taking a low-value card is generally good
      if (V.cardValue(card) <= 3) return { source: 'discard', idx: di };

      // Check if it completes a set
      let sameRank = 0;
      for (let i = 0; i < hand.length; ++i)
        if (hand[i].rank === card.rank) ++sameRank;
      if (sameRank >= 1 && V.cardValue(card) <= 5) return { source: 'discard', idx: di };

      // Check if it extends a run
      if (card.suit !== 'joker') {
        let consecutive = 0;
        for (let i = 0; i < hand.length; ++i) {
          if (hand[i].suit === card.suit) {
            const diff = Math.abs(RC.rankIndexJokers(card) - RC.rankIndexJokers(hand[i]));
            if (diff === 1) ++consecutive;
          }
        }
        if (consecutive >= 2) return { source: 'discard', idx: di };
      }
    }

    return { source: 'stock', idx: -1 };
  }

  function aiTakeTurn(p) {
    if (S.roundOver || S.gameOver) return;
    if (S.eliminated[p]) {
      V.advanceToNextPlayer();
      return;
    }

    if (S.aiStep === 0) {
      // Check if AI should call Yaniv
      if (V.handTotal(S.hands[p]) <= AI_YANIV_THRESHOLD) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' calls Yaniv!', { color: '#fa0', size: 22 });
        S.phase = PHASE_YANIV_REVEAL;
        S.yanivCaller = p;
        S.revealTimer = 0;
        return;
      }

      // Discard phase
      const discardIndices = aiFindBestDiscard(p);
      const cards = discardIndices.map(i => S.hands[p][i]);

      // Remove from hand (descending index order)
      const desc = discardIndices.slice().sort((a, b) => b - a);
      for (const idx of desc) S.hands[p].splice(idx, 1);

      for (const c of cards) c.faceUp = true;
      S.discardGroup = cards;

      if (S._host && cards.length > 1)
        S._host.floatingText.add(CANVAS_W / 2, STOCK_Y - 20, PLAYER_NAMES[p] + ' discards ' + cards.length + ' cards', { color: '#aaa', size: 12 });

      ++S.aiStep;
      S.aiTimer = 0;
      return;
    }

    if (S.aiStep === 1) {
      // Draw phase
      const choice = aiChooseDrawSource(p);
      if (choice.source === 'discard' && S.discardGroup.length > 0) {
        const card = S.discardGroup.splice(choice.idx, 1)[0];
        S.hands[p].push(card);
      } else {
        if (S.stockPile.length === 0) V.reshuffleStock();
        if (S.stockPile.length > 0) {
          const card = S.stockPile.pop();
          S.hands[p].push(card);
        }
      }

      // Advance to next player
      V.advanceToNextPlayer();
    }
  }

  Object.assign(V, { aiTakeTurn });

})();
