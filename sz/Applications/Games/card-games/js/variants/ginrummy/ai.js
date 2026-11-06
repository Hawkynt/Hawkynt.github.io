/* Gin Rummy opponents: draw choice, discard choice and when to knock. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ginrummy;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAYER_DRAW, PHASE_ROUND_REVEAL } = V;

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiShouldDrawDiscard() {
    if (S.discardPile.length === 0) return false;
    const topDiscard = S.discardPile[S.discardPile.length - 1];
    // Simulate adding discard to hand
    const testHand = S.aiHand.concat(topDiscard);
    const before = V.findBestMelds(S.aiHand);
    const after = V.findBestMelds(testHand);
    // Draw from discard if it reduces deadwood by completing/extending a meld
    return after.melds.length > before.melds.length || after.deadwoodValue < before.deadwoodValue - 2;
  }

  function aiChooseDiscard() {
    // Try discarding each card, pick the one that leaves lowest deadwood
    let bestIdx = 0;
    let bestDW = Infinity;
    for (let i = 0; i < S.aiHand.length; ++i) {
      const testHand = S.aiHand.filter((_, j) => j !== i);
      const result = V.findBestMelds(testHand);
      if (result.deadwoodValue < bestDW) {
        bestDW = result.deadwoodValue;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function aiShouldKnock() {
    const dw = V.calcDeadwood(S.aiHand);
    if (dw === 0) return true;  // Always gin
    return dw <= 5;             // Conservative: knock at 5 or below
  }

  /* ══════════════════════════════════════════════════════════════════
     AI TURN
     ══════════════════════════════════════════════════════════════════ */

  function aiTakeTurn() {
    if (!S.aiDrawn) {
      // Draw phase
      if (aiShouldDrawDiscard())
        S.aiHand.push(S.discardPile.pop());
      else if (S.stockPile.length > 0)
        S.aiHand.push(S.stockPile.pop());
      else if (S.discardPile.length > 1) {
        // Reshuffle
        const top = S.discardPile.pop();
        S.stockPile = CE.shuffle(S.discardPile);
        S.discardPile = [top];
        S.aiHand.push(S.stockPile.pop());
      } else
        return; // No cards available
      S.aiDrawn = true;
      S.aiTimer = 0;
      return;
    }

    // Discard phase
    const discIdx = aiChooseDiscard();
    const card = S.aiHand.splice(discIdx, 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);

    // Check if AI should knock
    const dw = V.calcDeadwood(S.aiHand);
    if (dw === 0) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'AI declares Gin!', { color: '#f44', size: 24 });
      V.resolveKnock(1);
      return;
    }
    if (dw <= 5) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'AI knocks!', { color: '#f84', size: 22 });
      V.resolveKnock(1);
      return;
    }

    // Back to player
    S.phase = PHASE_PLAYER_DRAW;
    S.selectedCardIndex = -1;

    // Check if stock is empty -- if 2 or fewer cards left, round is a draw
    if (S.stockPile.length <= 2) {
      S.roundOver = true;
      S.resultMsg = 'Draw -- stock depleted. Click to continue.';
      S.phase = PHASE_ROUND_REVEAL;
      S.playerMelds = V.findBestMelds(S.playerHand).melds;
      S.playerDeadwood = V.findBestMelds(S.playerHand).deadwood;
      S.aiMelds = V.findBestMelds(S.aiHand).melds;
      S.aiDeadwood = V.findBestMelds(S.aiHand).deadwood;
      S.knocker = -1;
    }
  }

  Object.assign(V, { aiTakeTurn });

})();
