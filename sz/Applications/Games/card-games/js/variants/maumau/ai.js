/* Mau-Mau: opponent decisions and turn pacing. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['maumau'];
  const S = V.S;
  const { RANK_POINTS, AI_TURN_DELAY } = V;

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseSuit() {
    const hand = S.hands[1];
    const counts = {};
    for (const s of CE.SUITS) counts[s] = 0;
    for (const c of hand)
      if (c.rank !== 'J') ++counts[c.suit];
    let best = CE.SUITS[0];
    for (const s of CE.SUITS)
      if (counts[s] > counts[best]) best = s;
    return best;
  }

  function aiTurn() {
    if (S.roundOver || S.gameOver || S.waitingForSuitChoice) return;
    if (S.currentPlayer !== 1) return;

    const hand = S.hands[1];

    // Under draw obligation: try to stack a 7
    if (S.drawObligation > 0) {
      for (let i = 0; i < hand.length; ++i) {
        if (hand[i].rank === '7') {
          V.playCard(1, i);
          return;
        }
      }
      // Can't stack -- must draw
      V.playerDrawCards();
      return;
    }

    // Collect playable cards (excluding Jacks initially)
    const playable = [];
    const jacks = [];
    for (let i = 0; i < hand.length; ++i) {
      if (V.canPlay(hand[i])) {
        if (hand[i].rank === 'J')
          jacks.push(i);
        else
          playable.push(i);
      }
    }

    if (playable.length > 0) {
      // Strategic: prefer special cards (7, 8, A) when beneficial
      // Sort: prefer 7 if opponent has few cards, 8 to skip, then by rank value
      playable.sort((a, b) => {
        const ca = hand[a];
        const cb = hand[b];
        // Prefer 8 (skip) when opponent is close to winning
        if (S.hands[0].length <= 3) {
          if (ca.rank === '8' && cb.rank !== '8') return -1;
          if (cb.rank === '8' && ca.rank !== '8') return 1;
        }
        // Prefer 7 (draw 2) to burden opponent
        if (ca.rank === '7' && cb.rank !== '7') return -1;
        if (cb.rank === '7' && ca.rank !== '7') return 1;
        // Prefer higher point cards to shed them early
        return (RANK_POINTS[cb.rank] || 0) - (RANK_POINTS[ca.rank] || 0);
      });
      V.playCard(1, playable[0]);
      return;
    }

    // Use Jack only as last resort (strategic saving)
    if (jacks.length > 0) {
      V.playCard(1, jacks[0]);
      return;
    }

    // No playable card -- draw
    V.playerDrawCards();
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver || S.waitingForSuitChoice) return;
    if (S.currentPlayer === 1) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        aiTurn();
      }
    }
  }

  Object.assign(V, { aiChooseSuit, tick });

})();
