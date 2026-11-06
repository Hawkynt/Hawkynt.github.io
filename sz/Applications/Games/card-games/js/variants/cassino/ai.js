/* Cassino: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.cassino;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAY } = V;

  const ACTION_CAPTURE = 'capture';
  const ACTION_BUILD = 'build';
  const ACTION_TRAIL = 'trail';

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

      // Evaluate captures
      for (const combo of combos) {
        let s = 10;
        const capturedCards = [];
        for (const ci of combo) {
          if (V.isBuild(S.table[ci])) {
            for (const bc of S.table[ci].cards)
              capturedCards.push(bc);
          } else
            capturedCards.push(S.table[ci]);
        }

        // High-value card bonuses
        for (const c of capturedCards) {
          if (V.isBigCassino(c)) s += 80;
          if (V.isLittleCassino(c)) s += 40;
          if (V.isAce(c)) s += 30;
          if (V.isSpade(c)) s += 5;
        }
        if (V.isBigCassino(card)) s += 40;
        if (V.isLittleCassino(card)) s += 20;
        if (V.isAce(card)) s += 15;

        // More cards captured = better
        s += capturedCards.length * 3;

        // Sweep bonus
        if (combo.length === S.table.length)
          s += 60;

        if (s > bestScore) {
          bestScore = s;
          bestPlay = { action: ACTION_CAPTURE, handIdx: hi, tableIdxs: combo };
        }
      }

      // Evaluate builds
      const builds = V.findPossibleBuilds(card, hand);
      for (const b of builds) {
        let s = 5;
        // Prefer builds toward high values
        s += b.buildValue;
        // Bonus if build captures valuable cards later
        for (const ci of b.tableIdxs) {
          if (!V.isBuild(S.table[ci])) {
            if (V.isBigCassino(S.table[ci])) s += 30;
            if (V.isLittleCassino(S.table[ci])) s += 15;
            if (V.isAce(S.table[ci])) s += 10;
          }
        }
        if (s > bestScore) {
          bestScore = s;
          bestPlay = { action: ACTION_BUILD, handIdx: hi, tableIdxs: b.tableIdxs, buildValue: b.buildValue };
        }
      }
    }

    // If no capture or build found, trail least valuable card
    if (!bestPlay) {
      let worstIdx = 0;
      let worstVal = Infinity;
      for (let hi = 0; hi < hand.length; ++hi) {
        const card = hand[hi];
        let v = V.captureValue(card);
        // Penalize trailing high-value cards
        if (V.isBigCassino(card)) v += 100;
        if (V.isLittleCassino(card)) v += 50;
        if (V.isAce(card)) v += 40;
        if (V.isSpade(card)) v += 5;
        // Don't trail a card that is needed for a build on the table
        for (const item of S.table) {
          if (V.isBuild(item) && item.owner === 1 && item.value === V.captureValue(card))
            v += 200;
        }
        if (v < worstVal) {
          worstVal = v;
          worstIdx = hi;
        }
      }
      bestPlay = { action: ACTION_TRAIL, handIdx: worstIdx };
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

    if (play.action === ACTION_CAPTURE) {
      V.performCapture(1, card, play.tableIdxs);
      if (S._host) {
        const count = play.tableIdxs.length;
        S._host.floatingText.add(CANVAS_W / 2, 180, 'AI captures ' + (count + 1) + ' cards', { color: '#fa0', size: 14 });
      }
    } else if (play.action === ACTION_BUILD) {
      V.performBuild(1, card, play.tableIdxs, play.buildValue);
    } else {
      V.playCardToTable(1, card);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 180, 'AI trails', { color: '#aaa', size: 12 });
    }

    // Switch back to player
    if (S.playerHand.length > 0)
      S.phase = PHASE_PLAY;
    else
      V.afterTurn();
  }

  V.aiTakeTurn = aiTakeTurn;

})();
