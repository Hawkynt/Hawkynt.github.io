/* Yaniv round flow: dealing, reshuffles, discards, draws, turn passing and Yaniv/Assaf resolution. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.yaniv;
  const S = V.S;
  const { CANVAS_W, NUM_PLAYERS, YANIV_THRESHOLD, ELIMINATION_SCORE, PLAYER_NAMES, PHASE_DISCARD,
    PHASE_DRAW, PHASE_AI_THINKING, PHASE_YANIV_REVEAL, PHASE_ROUND_OVER, STOCK_X, STOCK_Y,
    DISCARD_X, DISCARD_Y, PLAYER_HAND_Y } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const HAND_SIZE = 5;
  const HALVE_MILESTONES = [50, 100, 150];

  /* ================================================================
     RESHUFFLE STOCK FROM DISCARD
     ================================================================ */

  function reshuffleStock() {
    if (S.stockPile.length > 0) return;
    // Keep the current discard group visible; reshuffle everything else
    // In practice, Yaniv games rarely run out of stock, but handle it
    S.stockPile = CE.shuffle(S.discardGroup.splice(0, S.discardGroup.length));
    for (const c of S.stockPile) c.faceUp = false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    const deck = CE.shuffle(V.createYanivDeck());
    S.hands = [[], [], [], []];
    S.discardGroup = [];
    S.stockPile = [];
    S.roundOver = false;
    S.phase = PHASE_DISCARD;
    S.currentPlayer = 0;
    S.selectedIndices = [];
    S.resultMsg = '';
    S.yanivCaller = -1;
    S.assafTriggered = false;
    S.aiTimer = 0;
    S.aiStep = 0;
    S.revealTimer = 0;

    // Skip eliminated players for dealing
    for (let i = 0; i < HAND_SIZE; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (S.eliminated[p]) continue;
        const card = deck.pop();
        if (p === 0) card.faceUp = true;
        S.hands[p].push(card);
      }

    S.stockPile = deck;

    RC.sortHandJokers(S.hands[0]);

    // Find the first non-eliminated player
    S.currentPlayer = 0;
    if (S.eliminated[0])
      S.currentPlayer = V.nextActivePlayer(NUM_PLAYERS - 1);

    // If it's an AI player's turn first, set AI phase
    if (S.currentPlayer !== 0) {
      S.phase = PHASE_AI_THINKING;
      S.aiStep = 0;
      S.aiTimer = 0;
    }

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, RC.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function resolveYaniv(callerIdx) {
    S.yanivCaller = callerIdx;
    const callerTotal = V.handTotal(S.hands[callerIdx]);

    // Check for Assaf: does any other active player have equal or lower total?
    S.assafTriggered = false;
    let lowestOther = Infinity;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === callerIdx || S.eliminated[p]) continue;
      const t = V.handTotal(S.hands[p]);
      if (t <= callerTotal) {
        S.assafTriggered = true;
      }
      if (t < lowestOther) lowestOther = t;
    }

    if (S.assafTriggered) {
      // Assaf! Caller gets 30 + their hand total
      S.cumulativeScores[callerIdx] += 30 + callerTotal;
      // Others score their hand totals
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p === callerIdx || S.eliminated[p]) continue;
        S.cumulativeScores[p] += V.handTotal(S.hands[p]);
      }
      S.resultMsg = 'ASSAF! ' + PLAYER_NAMES[callerIdx] + ' called Yaniv but was caught!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 200, 'ASSAF!', { color: '#f44', size: 32 });
        S._host.screenShake.trigger(8, 400);
      }
    } else {
      // Caller scores 0; others score their hand totals
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p === callerIdx || S.eliminated[p]) continue;
        S.cumulativeScores[p] += V.handTotal(S.hands[p]);
      }
      S.resultMsg = PLAYER_NAMES[callerIdx] + ' calls Yaniv! (' + callerTotal + ' pts)';
      if (callerIdx === 0 && S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 200, 'YANIV!', { color: '#4f4', size: 32 });
        S._host.particles.confetti(CANVAS_W / 2, 300, 25);
      } else if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[callerIdx] + ' YANIV!', { color: '#fa0', size: 28 });
      }
    }

    // Check for milestone halving (exact 50, 100, or 150)
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.eliminated[p]) continue;
      for (const milestone of HALVE_MILESTONES) {
        if (S.cumulativeScores[p] === milestone) {
          S.cumulativeScores[p] = Math.floor(milestone / 2);
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 260 + p * 20, PLAYER_NAMES[p] + ' hits ' + milestone + '! Halved to ' + S.cumulativeScores[p], { color: '#ff0', size: 14 });
        }
      }
    }

    // Check eliminations
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.eliminated[p]) continue;
      if (S.cumulativeScores[p] >= ELIMINATION_SCORE) {
        S.eliminated[p] = true;
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 280 + p * 20, PLAYER_NAMES[p] + ' eliminated!', { color: '#f88', size: 14 });
      }
    }

    S.score = S.cumulativeScores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    // Check game over
    const active = V.countActivePlayers();
    if (active <= 1 || S.eliminated[0]) {
      S.gameOver = true;
      if (!S.eliminated[0] && active === 1)
        S.resultMsg += ' -- YOU WIN THE GAME!';
      else if (S.eliminated[0])
        S.resultMsg += ' -- You have been eliminated!';
      else {
        // Find winner
        for (let p = 0; p < NUM_PLAYERS; ++p) {
          if (!S.eliminated[p]) {
            S.resultMsg += ' -- ' + PLAYER_NAMES[p] + ' wins the game!';
            break;
          }
        }
      }
    }

    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;
  }

  /* ================================================================
     PLAYER ACTIONS
     ================================================================ */

  function playerDiscard() {
    if (S.selectedIndices.length === 0) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, PLAYER_HAND_Y - 20, 'Select cards to discard', { color: '#f88', size: 14 });
      return false;
    }

    // Build the discard cards
    const sorted = S.selectedIndices.slice().sort((a, b) => a - b);
    const cards = sorted.map(i => S.hands[0][i]);

    if (!V.isValidDiscard(cards)) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, PLAYER_HAND_Y - 20, 'Invalid discard!', { color: '#f88', size: 14 });
      return false;
    }

    // Remove from hand (descending index order)
    const descIndices = sorted.slice().sort((a, b) => b - a);
    for (const idx of descIndices) S.hands[0].splice(idx, 1);

    // Set as the new discard group
    for (const c of cards) c.faceUp = true;
    S.discardGroup = cards;

    S.selectedIndices = [];
    RC.sortHandJokers(S.hands[0]);
    S.phase = PHASE_DRAW;
    return true;
  }

  function playerCallYaniv() {
    if (V.handTotal(S.hands[0]) > YANIV_THRESHOLD) return;
    S.phase = PHASE_YANIV_REVEAL;
    S.revealTimer = 0;
    S.yanivCaller = 0;
  }

  function playerDrawFromStock() {
    if (S.stockPile.length === 0) reshuffleStock();
    if (S.stockPile.length === 0) return;
    const card = S.stockPile.pop();
    card.faceUp = true;
    S.hands[0].push(card);
    RC.sortHandJokers(S.hands[0]);
    S.selectedIndices = [];

    if (S._host) S._host.dealCardAnim(card, STOCK_X, STOCK_Y, RC.playerCardX(S.hands[0].length - 1, S.hands[0].length), PLAYER_HAND_Y, 0);

    // Advance to next player
    advanceToNextPlayer();
  }

  function playerDrawFromDiscard(discardIdx) {
    if (discardIdx < 0 || discardIdx >= S.discardGroup.length) return;
    const card = S.discardGroup.splice(discardIdx, 1)[0];
    card.faceUp = true;
    S.hands[0].push(card);
    RC.sortHandJokers(S.hands[0]);
    S.selectedIndices = [];

    if (S._host) S._host.dealCardAnim(card, DISCARD_X, DISCARD_Y, RC.playerCardX(S.hands[0].length - 1, S.hands[0].length), PLAYER_HAND_Y, 0);

    advanceToNextPlayer();
  }

  function advanceToNextPlayer() {
    const next = V.nextActivePlayer(S.currentPlayer);
    S.currentPlayer = next;
    if (next === 0) {
      S.phase = PHASE_DISCARD;
      S.selectedIndices = [];
    } else {
      S.phase = PHASE_AI_THINKING;
      S.aiStep = 0;
      S.aiTimer = 0;
    }
  }

  Object.assign(V, { advanceToNextPlayer, reshuffleStock, setupRound, playerCallYaniv,
    playerDiscard, playerDrawFromStock, playerDrawFromDiscard, resolveYaniv });

})();
