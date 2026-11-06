/* Spite & Malice: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.spitemalice;
  const S = V.S;

  function aiTurn() {
    if (S.roundOver || S.gameOver || S.playerTurn) return;

    // Priority 1: play from pay-off pile
    const payTop = V.topCard(S.payoff[1]);
    if (payTop) {
      for (let c = 0; c < 4; ++c) {
        if (V.canPlayOn(payTop, S.centerPiles[c])) {
          S.payoff[1].pop();
          V.playToCenter(payTop, c);
          if (V.checkWin(1)) return;
          S.aiDiscarded = false;
          return;
        }
      }
    }

    // Priority 2: play from hand
    for (let i = S.hands[1].length - 1; i >= 0; --i) {
      for (let c = 0; c < 4; ++c) {
        if (V.canPlayOn(S.hands[1][i], S.centerPiles[c])) {
          const card = S.hands[1].splice(i, 1)[0];
          V.playToCenter(card, c);
          if (S.hands[1].length === 0)
            V.drawHand(1);
          S.aiDiscarded = false;
          return;
        }
      }
    }

    // Priority 3: play from side stacks
    for (let s = 0; s < 4; ++s) {
      const st = V.topCard(S.sideStacks[1][s]);
      if (st) {
        for (let c = 0; c < 4; ++c) {
          if (V.canPlayOn(st, S.centerPiles[c])) {
            S.sideStacks[1][s].pop();
            V.playToCenter(st, c);
            S.aiDiscarded = false;
            return;
          }
        }
      }
    }

    // No plays available -- discard to a side stack to end turn
    if (S.hands[1].length > 0 && !S.aiDiscarded) {
      // Pick the side stack strategically: prefer empty or matching-value piles
      let bestStack = 0;
      let bestScore = -1;
      const cardToDiscard = S.hands[1][S.hands[1].length - 1];
      for (let s = 0; s < 4; ++s) {
        let sc = 0;
        if (S.sideStacks[1][s].length === 0)
          sc = 5; // prefer empty
        else {
          const st = V.topCard(S.sideStacks[1][s]);
          if (!cardToDiscard.isJoker && !st.isJoker && V.rankIndex(st) === V.rankIndex(cardToDiscard))
            sc = 3; // same value stacking
        }
        if (sc > bestScore) {
          bestScore = sc;
          bestStack = s;
        }
      }
      S.sideStacks[1][bestStack].push(S.hands[1].pop());
      S.aiDiscarded = true;
      return;
    }

    // End AI turn
    S.aiDiscarded = false;
    V.drawHand(1);
    V.drawHand(0);
    S.playerTurn = true;
    S.selectedSource = null;
  }

  Object.assign(V, { aiTurn });

})();
