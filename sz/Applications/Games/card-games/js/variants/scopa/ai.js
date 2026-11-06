/* Scopa: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.scopa;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAY } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay() {
    const hand = S.aiHand;
    if (hand.length === 0) return null;

    let bestPlay = null;
    let bestScore = -Infinity;

    for (let hi = 0; hi < hand.length; ++hi) {
      const card = hand[hi];
      const val = V.captureValue(card);
      const combos = V.findCaptureCombinations(val, S.table);

      if (combos.length === 0) {
        // No capture possible: evaluate placing the card
        // Penalize leaving easy captures for opponent (table sum <= 10)
        let placeScore = -1;

        // Prefer not playing 7 of diamonds if we can avoid it
        if (V.isSetteBello(card))
          placeScore -= 50;
        if (V.isDiamond(card))
          placeScore -= 5;

        // Penalize if placing makes table sum <= 10
        let tableSum = 0;
        for (const tc of S.table)
          tableSum += V.captureValue(tc);
        if (tableSum + val <= 10)
          placeScore -= 10;

        if (bestPlay === null || placeScore > bestScore) {
          bestScore = placeScore;
          bestPlay = { handIdx: hi, tableIdxs: [] };
        }
        continue;
      }

      // Evaluate each capture combination
      for (const combo of combos) {
        let s = 10; // base bonus for capturing
        const capturedCards = combo.map(i => S.table[i]);

        // Huge bonus for capturing 7 of diamonds
        for (const c of capturedCards)
          if (V.isSetteBello(c)) s += 100;
        if (V.isSetteBello(card)) s += 50; // we keep our sette bello in our captures

        // Bonus for diamonds
        for (const c of capturedCards)
          if (V.isDiamond(c)) s += 8;
        if (V.isDiamond(card)) s += 3;

        // Bonus for 7s (primiera)
        for (const c of capturedCards)
          if (c.rank === '7') s += 6;
        if (card.rank === '7') s += 3;

        // More cards captured = better
        s += combo.length * 2;

        // Massive bonus for scopa
        if (combo.length === S.table.length)
          s += 60;

        if (s > bestScore) {
          bestScore = s;
          bestPlay = { handIdx: hi, tableIdxs: combo };
        }
      }
    }

    return bestPlay;
  }

  function aiTakeTurn() {
    const play = aiChoosePlay();
    if (!play) {
      V.afterTurn();
      return;
    }

    const card = S.aiHand.splice(play.handIdx, 1)[0];
    card.faceUp = true;

    if (play.tableIdxs.length > 0) {
      V.performCapture(1, card, play.tableIdxs);
      if (S._host) {
        const count = play.tableIdxs.length;
        S._host.floatingText.add(CANVAS_W / 2, 180, 'AI captures ' + (count + 1) + ' cards', { color: '#fa0', size: 14 });
      }
    } else {
      V.playCardToTable(1, card);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 180, 'AI plays to table', { color: '#aaa', size: 12 });
    }

    // Switch back to player
    if (S.playerHand.length > 0)
      S.phase = PHASE_PLAY;
    else
      V.afterTurn();
  }

  V.aiTakeTurn = aiTakeTurn;

})();
