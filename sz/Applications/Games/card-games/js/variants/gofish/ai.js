/* Go Fish: opponent decisions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const HANDS = SZ.CardGames.shared.quickHands;
  const V = SZ.CardGames.v.gofish;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, RANK_NAMES } = V;

  /* -- AI turn logic -- */
  function aiTakeTurn() {
    if (S.aiHand.length === 0) {
      V.refillHandIfEmpty(S.aiHand);
      if (S.aiHand.length === 0) {
        S.isPlayerTurn = true;
        S.aiThinking = false;
        return;
      }
    }

    // Pick a rank to ask for: prefer ranks with most cards, then ranks remembered from player asks
    const rankCounts = {};
    for (const c of S.aiHand)
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;

    let bestRank = null;
    let bestScore = -1;

    for (const rank in rankCounts) {
      let s = rankCounts[rank] * 10;
      // Bonus for ranks the player previously asked about (they might still have some)
      if (S.aiMemory[rank]) s += 5;
      if (s > bestScore) {
        bestScore = s;
        bestRank = rank;
      }
    }

    if (!bestRank) {
      S.isPlayerTurn = true;
      S.aiThinking = false;
      return;
    }

    S.aiLastAsked = bestRank;

    const playerCount = HANDS.countRank(S.playerHand, bestRank);
    if (playerCount > 0) {
      const taken = V.removeCardsOfRank(S.playerHand, bestRank);
      for (const c of taken)
        S.aiHand.push(c);

      V.setMessage('AI asks for ' + RANK_NAMES[bestRank] + ' \u2014 gets ' + playerCount + '!', '#fa0');
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI takes ' + playerCount + ' ' + RANK_NAMES[bestRank], { color: '#fa0', size: 16 });

      V.checkForBooks(S.aiHand, S.aiBooks, 'AI');
      V.refillHandIfEmpty(S.aiHand);
      if (V.checkGameEnd()) return;

      // AI turn continues -- schedule another action
      S.aiTurnTimer = 0;
      S.aiThinking = true;
      S.aiDrawnMatchedAsk = false;
    } else {
      V.setMessage('AI asks for ' + RANK_NAMES[bestRank] + ' \u2014 Go Fish!', '#8cf');
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Go Fish!', { color: '#8cf', size: 20 });

      const drawn = V.drawFromStock(S.aiHand);
      if (drawn) {
        V.checkForBooks(S.aiHand, S.aiBooks, 'AI');
        V.refillHandIfEmpty(S.aiHand);
        if (V.checkGameEnd()) return;

        if (drawn.rank === bestRank) {
          V.setMessage('AI drew a match! AI\'s turn continues.', '#fa0');
          S.aiTurnTimer = 0;
          S.aiThinking = true;
          S.aiDrawnMatchedAsk = false;
          return;
        }
      }

      // End AI turn
      S.isPlayerTurn = true;
      S.aiThinking = false;
      V.refillHandIfEmpty(S.playerHand);
      if (V.checkGameEnd()) return;
    }
  }

  Object.assign(V, { aiTakeTurn });

})();
