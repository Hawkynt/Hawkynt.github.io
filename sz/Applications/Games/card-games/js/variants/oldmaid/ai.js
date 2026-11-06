/* Old Maid: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.oldmaid;
  const S = V.S;
  const { CANVAS_W, PHASE_PLAYER_DRAW, PHASE_DISCARD_ANIM, DISCARD_ANIM_DELAY } = V;

  function aiDrawCard() {
    if (S.playerHand.length === 0) {
      if (V.checkGameEnd()) return;
      // Skip AI turn if player has no cards
      S.phase = PHASE_PLAYER_DRAW;
      V.refreshAiDrawableOrder();
      return;
    }

    const idx = (Math.random() * S.playerHand.length) | 0;
    const card = S.playerHand.splice(idx, 1)[0];
    S.aiHand.push(card);

    const drawnRank = card.rank;

    if (S._host) {
      const fromX = V.playerCardX(idx, S.playerHand.length + 1);
      S._host.floatingText.add(CANVAS_W / 2, 200, 'AI draws a card...', { color: '#aaf', size: 14 });
    }

    // Check for new pair
    const newPairIdx = V.findMatchInHand(S.aiHand, card);
    if (newPairIdx >= 0) {
      const pairCard = S.aiHand.splice(newPairIdx, 1)[0];
      const drawnCard = S.aiHand.splice(S.aiHand.indexOf(card), 1)[0];
      if (drawnCard)
        S.aiPairs.push([pairCard, drawnCard]);
      else
        S.aiPairs.push([pairCard, card]);

      S.lastDiscardedPair = S.aiPairs[S.aiPairs.length - 1];
      S.lastDiscardedBy = 'AI';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'AI: Pair of ' + drawnRank + 's!', { color: '#fa0', size: 16 });

      S.phase = PHASE_DISCARD_ANIM;
      S.discardAnimTimer = DISCARD_ANIM_DELAY;
    } else {
      V.sortHand(S.aiHand);
      V.finishAiTurn();
    }
  }

  Object.assign(V, { aiDrawCard });

})();
