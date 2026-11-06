/* Pishti: opponent AI decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.pishti;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAY } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay() {
    const hand = S.aiHand;
    if (hand.length === 0) return -1;

    const pileEmpty = S.centerPile.length === 0;
    const pileHasOne = S.centerPile.length === 1;
    const topCard = S.centerPile.length > 0 ? S.centerPile[S.centerPile.length - 1] : null;

    // Priority 1: If pile has exactly 1 card, play a Jack for pishti bonus (20 pts)
    if (pileHasOne) {
      for (let i = 0; i < hand.length; ++i)
        if (V.isJack(hand[i])) return i;
    }

    // Priority 2: If pile has exactly 1 card, play a matching rank for pishti (10 pts)
    if (pileHasOne && topCard) {
      for (let i = 0; i < hand.length; ++i)
        if (V.ranksMatch(hand[i], topCard) && !V.isJack(hand[i])) return i;
    }

    // Priority 3: Capture with rank match (non-Jack) when pile has multiple cards
    if (!pileEmpty && !pileHasOne && topCard) {
      for (let i = 0; i < hand.length; ++i)
        if (V.ranksMatch(hand[i], topCard) && !V.isJack(hand[i])) return i;
    }

    // Priority 4: Capture with Jack when pile has many cards (big haul)
    if (!pileEmpty && S.centerPile.length >= 3) {
      for (let i = 0; i < hand.length; ++i)
        if (V.isJack(hand[i])) return i;
    }

    // Priority 5: Trail a low-value card (avoid Jacks, Aces, 2C, 10D)
    let bestIdx = -1;
    let bestScore = Infinity;
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      if (V.isJack(c)) continue; // save Jacks
      let s = 0;
      if (c.rank === 'A') s += 10;
      if (c.rank === '2' && c.suit === 'clubs') s += 20;
      if (c.rank === '10' && c.suit === 'diamonds') s += 30;
      // Prefer trailing low numeric cards
      const numVal = CE.RANKS.indexOf(c.rank);
      s += numVal;
      if (s < bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) return bestIdx;

    // Fallback: play first card (even if Jack)
    return 0;
  }

  function aiTakeTurn() {
    const idx = aiChoosePlay();
    if (idx < 0) {
      V.afterTurn();
      return;
    }

    const card = S.aiHand.splice(idx, 1)[0];
    card.faceUp = true;

    if (V.canCapture(card)) {
      V.performCapture(1, card);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 180, 'AI captures!', { color: '#fa0', size: 14 });
    } else {
      V.playCardToCenter(card);
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
