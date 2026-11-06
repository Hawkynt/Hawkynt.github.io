/* Tonk opponents: draw choice, spreading, dropping and discarding. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.tonk;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, PLAYER_NAMES, PHASE_DRAW } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const AI_KNOCK_THRESHOLD = 15;

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiShouldDrawDiscard(p) {
    if (S.discardPile.length === 0) return false;
    const top = S.discardPile[S.discardPile.length - 1];
    // Check if the discard card completes a meld
    const testHand = S.hands[p].concat(top);
    const beforeMeld = V.findBestMeld(S.hands[p]);
    const afterMeld = V.findBestMeld(testHand);
    if (afterMeld && !beforeMeld) return true;
    if (afterMeld && beforeMeld && afterMeld.length > beforeMeld.length) return true;
    return false;
  }

  function aiSpreadMelds(p) {
    let spreading = true;
    while (spreading) {
      spreading = false;
      const meldIndices = V.findBestMeld(S.hands[p]);
      if (meldIndices && meldIndices.length >= 3) {
        const cards = meldIndices.map(i => S.hands[p][i]);
        if (V.isValidMeld(cards)) {
          const sorted = meldIndices.slice().sort((a, b) => b - a);
          for (const idx of sorted) S.hands[p].splice(idx, 1);
          S.tableMelds.push({ cards, owner: p });
          spreading = true;
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 180, PLAYER_NAMES[p] + ' spreads!', { color: '#fa0', size: 14 });
        }
      }
    }

    // Try extending existing melds
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = S.hands[p].length - 1; i >= 0; --i) {
        const target = V.findExtendTarget(S.hands[p][i]);
        if (target >= 0) {
          const card = S.hands[p].splice(i, 1)[0];
          S.tableMelds[target].cards.push(card);
          extended = true;
        }
      }
    }
  }

  function aiChooseDiscard(p) {
    if (S.hands[p].length === 0) return -1;
    // Discard the highest-value card that is least useful
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < S.hands[p].length; ++i) {
      const v = RC.cardValue(S.hands[p][i]);
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function aiShouldDrop(p) {
    return V.handTotal(S.hands[p]) <= AI_KNOCK_THRESHOLD;
  }

  function aiDraw(p) {
    if (aiShouldDrawDiscard(p) && S.discardPile.length > 0) {
      const card = S.discardPile.pop();
      S.hands[p].push(card);
    } else {
      if (S.stockPile.length === 0) {
        if (S.discardPile.length <= 1) {
          V.stockEmpty();
          return;
        }
        const top = S.discardPile.pop();
        S.stockPile = CE.shuffle(S.discardPile);
        for (const c of S.stockPile) c.faceUp = false;
        S.discardPile = [top];
      }
      const card = S.stockPile.pop();
      S.hands[p].push(card);
    }
  }

  function aiTakeTurn(p) {
    if (S.roundOver || S.gameOver) return;

    if (S.aiStep === 0) {
      // Draw
      aiDraw(p);
      if (S.roundOver) return;
      ++S.aiStep;
      S.aiTimer = 0;
      return;
    }

    if (S.aiStep === 1) {
      // Spread melds
      aiSpreadMelds(p);
      if (S.hands[p].length === 0) {
        V.emptyHandWin(p);
        return;
      }

      // Decide whether to drop
      if (aiShouldDrop(p)) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' drops! (' + V.handTotal(S.hands[p]) + ')', { color: '#fa0', size: 20 });
        V.playerDrop(p);
        return;
      }

      ++S.aiStep;
      S.aiTimer = 0;
      return;
    }

    if (S.aiStep === 2) {
      // Discard
      const discIdx = aiChooseDiscard(p);
      if (discIdx < 0) return;
      const card = S.hands[p].splice(discIdx, 1)[0];
      card.faceUp = true;
      S.discardPile.push(card);

      if (S.hands[p].length === 0) {
        V.emptyHandWin(p);
        return;
      }

      // Advance to next player
      const next = (p + 1) % NUM_PLAYERS;
      if (next === 0) {
        S.currentPlayer = 0;
        S.phase = PHASE_DRAW;
        S.selectedIndices = [];
        // Check stock
        if (S.stockPile.length === 0 && S.discardPile.length <= 1) {
          V.stockEmpty();
          return;
        }
      } else {
        S.currentPlayer = next;
        S.aiStep = 0;
        S.aiTimer = 0;
      }
    }
  }

  Object.assign(V, { aiTakeTurn });

})();
