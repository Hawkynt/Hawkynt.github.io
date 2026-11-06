/* Cribbage: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;

  const V = SZ.CardGames.v.cribbage;
  const S = V.S;
  const { PEG_MAX, PHASE_CUT, PHASE_PEGGING } = V;

  const AI_DELAY = 0.8;

  /* ================================================================
   *  AI LOGIC - DISCARD
   * ================================================================ */

  function aiChooseDiscards() {
    // Try all combinations of 2 cards to discard, keep best 4
    let bestScore = -1;
    let bestDiscards = [0, 1];
    const n = S.aiHand.length;
    for (let i = 0; i < n; ++i) {
      for (let j = i + 1; j < n; ++j) {
        const keep = S.aiHand.filter((_, idx) => idx !== i && idx !== j);
        // Estimate hand value without starter (just structure)
        const est = V.scoreHand(keep, null, false).total;
        if (est > bestScore) {
          bestScore = est;
          bestDiscards = [i, j];
        }
      }
    }
    return bestDiscards;
  }

  /* ================================================================
   *  AI LOGIC - PEGGING
   * ================================================================ */

  function aiChoosePegCard() {
    // Prefer: reach 15, reach 31, pair, extend run, then lowest value
    let bestIdx = -1;
    let bestPts = -1;
    let bestVal = 999;

    for (let i = 0; i < S.aiPegHand.length; ++i) {
      const c = S.aiPegHand[i];
      if (S.pegCount + V.cardValue(c) > PEG_MAX)
        continue;
      const pts = V.scorePegPlay(S.pegCards, c);
      const val = V.cardValue(c);
      if (pts > bestPts || (pts === bestPts && val < bestVal)) {
        bestPts = pts;
        bestIdx = i;
        bestVal = val;
      }
    }

    // If no scoring play, pick card least likely to help opponent
    if (bestIdx < 0)
      return -1;
    if (bestPts === 0) {
      // Play highest card that doesn't set up opponent for 15 or 31
      let safeIdx = -1;
      let safeVal = -1;
      for (let i = 0; i < S.aiPegHand.length; ++i) {
        const c = S.aiPegHand[i];
        if (S.pegCount + V.cardValue(c) > PEG_MAX)
          continue;
        const newTotal = S.pegCount + V.cardValue(c);
        // Avoid leaving 5 or 21 (opponent can reach 15 or hit 31 easily)
        const dangerous = (newTotal === 5 || newTotal === 21);
        const v = V.cardValue(c);
        if (!dangerous && v > safeVal) {
          safeVal = v;
          safeIdx = i;
        }
      }
      if (safeIdx >= 0)
        return safeIdx;
    }
    return bestIdx;
  }

  /* ================================================================
   *  AI TICK
   * ================================================================ */

  function aiTick(dt) {
    if (!S.pendingAiAction)
      return;
    S.aiTimer += dt;
    if (S.aiTimer < AI_DELAY)
      return;
    S.pendingAiAction = false;
    S.aiTimer = 0;

    if (S.phase === PHASE_CUT) {
      V.startPegging();
      return;
    }

    if (S.phase === PHASE_PEGGING) {
      // Check if pegging is done
      if (S.playerPegHand.length === 0 && S.aiPegHand.length === 0) {
        V.startShow();
        return;
      }

      if (S.currentPegger !== 1)
        return;

      if (!V.canPlayPeg(S.aiPegHand)) {
        S.aiSaidGo = true;
        S.pegMsg = 'AI says Go';
        if (S.playerPegHand.length > 0 && V.canPlayPeg(S.playerPegHand)) {
          S.currentPegger = 0;
        } else {
          // Both stuck
          if (S.pegCount < 31 && S.pegCards.length > 0) {
            V.addAiScore(1);
            S.pegMsg += ' +1 last card';
          }
          V.resetPegRound();
          V.checkPeggingEnd();
        }
        return;
      }

      const cardIdx = aiChoosePegCard();
      if (cardIdx >= 0)
        V.playPegCard(false, cardIdx);
      return;
    }
  }

  V.aiChooseDiscards = aiChooseDiscards;
  V.aiTick = aiTick;

})();
