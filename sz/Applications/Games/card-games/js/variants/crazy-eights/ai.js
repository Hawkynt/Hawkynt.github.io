/* Crazy Eights: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['crazy-eights'];
  const S = V.S;
  const { CANVAS_W, MAX_DRAWS, AI_TURN_DELAY } = V;

  /* ================================================================
     AI
     ================================================================ */

  function aiChooseSuit() {
    const counts = {};
    for (const s of CE.SUITS) counts[s] = 0;
    for (const c of S.aiHand)
      if (c.rank !== '8') ++counts[c.suit];
    let best = CE.SUITS[0];
    for (const s of CE.SUITS)
      if (counts[s] > counts[best]) best = s;
    return best;
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver || S.waitingForSuitChoice || S.playerTurn) return;
    const topCard = S.discardPile[S.discardPile.length - 1];

    // Try to play a non-8 card first (suit match preferred)
    let suitMatches = [];
    let rankMatches = [];
    let eights = [];

    for (let i = 0; i < S.aiHand.length; ++i) {
      const c = S.aiHand[i];
      if (c.rank === '8') {
        eights.push(i);
        continue;
      }
      if (c.suit === S.currentSuit)
        suitMatches.push(i);
      else if (c.rank === topCard.rank)
        rankMatches.push(i);
    }

    // Prefer suit matches, then rank matches, then 8s
    if (suitMatches.length > 0) {
      V.playCard(S.aiHand, suitMatches[0], false);
      return;
    }
    if (rankMatches.length > 0) {
      V.playCard(S.aiHand, rankMatches[0], false);
      return;
    }
    if (eights.length > 0) {
      V.playCard(S.aiHand, eights[0], false);
      return;
    }

    // No playable card -- draw up to MAX_DRAWS
    let drew = 0;
    while (drew < MAX_DRAWS) {
      const card = V.drawFromStock();
      if (!card) break;
      card.faceUp = false;
      S.aiHand.push(card);
      ++drew;
      if (V.canPlay(card, topCard, S.currentSuit)) {
        // Play the newly drawn card if it works
        V.playCard(S.aiHand, S.aiHand.length - 1, false);
        return;
      }
    }

    // Still can't play after drawing, pass
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 80, 'AI passes', { color: '#fa0', size: 14 });
    S.drawCount = 0;
    S.playerTurn = true;
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver || S.waitingForSuitChoice) return;
    if (!S.playerTurn) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        aiTurn();
      }
    }
  }

  Object.assign(V, { aiChooseSuit, tick });

})();
