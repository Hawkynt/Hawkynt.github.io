/* Kalooki round flow: dealing, stock refills, draws, the opening meld, lay-offs, discards, turns and round scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.kalooki;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, INITIAL_MELD_MIN, PENALTY_LIMIT, PLAYER_NAMES,
    PHASE_DRAW, PHASE_MELD, PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X,
    DISCARD_Y } = V;
  const RC = SZ.CardGames.shared.rummyCards;
  const RM = SZ.CardGames.shared.rummyMelds;

  const HAND_SIZE = 9;

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupKalooki() {
    const deck = CE.shuffle(V.createKalookiDeck());
    S.hands = [[], [], []];
    S.stockPile = [];
    S.discardPile = [];
    S.tableMelds = [];
    S.hasMelded = [false, false, false];
    S.noPriorMelds = [true, true, true];
    S.roundOver = false;
    S.phase = PHASE_DRAW;
    S.currentPlayer = 0;
    S.selectedIndices = [];
    S.resultMsg = '';
    S.aiTimer = 0;
    S.aiStep = 0;
    S.drewFromDiscard = false;

    for (let i = 0; i < HAND_SIZE; ++i) {
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const c = deck.pop();
        if (p === 0) c.faceUp = true;
        S.hands[p].push(c);
      }
    }

    const top = deck.pop();
    top.faceUp = true;
    S.discardPile.push(top);

    S.stockPile = deck;
    RC.sortHandJokers(S.hands[0]);
  }

  /* ══════════════════════════════════════════════════════════════════
     STOCK REPLENISH
     ══════════════════════════════════════════════════════════════════ */

  function replenishStock() {
    if (S.stockPile.length > 0) return true;
    if (S.discardPile.length <= 1) return false;
    const top = S.discardPile.pop();
    S.stockPile = CE.shuffle(S.discardPile);
    for (const c of S.stockPile) c.faceUp = false;
    S.discardPile = [top];
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawStock() {
    if (!replenishStock()) return;
    const card = S.stockPile.pop();
    card.faceUp = true;
    S.hands[0].push(card);
    if (S._host) S._host.dealCardAnim(card, STOCK_X, STOCK_Y, 30 + (S.hands[0].length - 1) * 55, 418, 0);
    S.drewFromDiscard = false;
    S.phase = PHASE_MELD;
    S.selectedIndices = [];
  }

  function playerDrawDiscard() {
    if (S.discardPile.length === 0) return;
    const card = S.discardPile.pop();
    card.faceUp = true;
    S.hands[0].push(card);
    if (S._host) S._host.dealCardAnim(card, DISCARD_X, DISCARD_Y, 30 + (S.hands[0].length - 1) * 55, 418, 0);
    S.drewFromDiscard = true;
    S.phase = PHASE_MELD;
    S.selectedIndices = [];
  }

  function playerMeld() {
    if (S.selectedIndices.length < 3) return;
    const cards = S.selectedIndices.map(i => S.hands[0][i]);
    if (!RM.isValidMeld(cards)) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 380, 'Invalid meld!', { color: '#f44', size: 16 });
      return;
    }

    // Check initial meld threshold
    if (!S.hasMelded[0]) {
      const totalMeldValue = V.meldPointValue(cards);
      if (totalMeldValue < INITIAL_MELD_MIN) {
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 380, 'Need ' + INITIAL_MELD_MIN + '+ points! (got ' + totalMeldValue + ')', { color: '#f84', size: 14 });
        return;
      }
    }

    // Remove from hand (sort descending to splice safely)
    const sorted = S.selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted) S.hands[0].splice(idx, 1);

    for (const c of cards) c.faceUp = true;
    S.tableMelds.push({ cards, owner: 0 });
    S.hasMelded[0] = true;
    S.selectedIndices = [];
    RC.sortHandJokers(S.hands[0]);

    if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Meld!', { color: '#4f4', size: 18 });

    if (S.hands[0].length === 0) {
      endRound(0);
      return;
    }
  }

  function playerLayOff() {
    if (S.selectedIndices.length !== 1) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 380, 'Select 1 card to lay off', { color: '#f84', size: 14 });
      return;
    }
    if (!S.hasMelded[0]) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 380, 'Must meld first!', { color: '#f84', size: 14 });
      return;
    }

    const card = S.hands[0][S.selectedIndices[0]];

    // Try replacing a joker first
    for (const tm of S.tableMelds) {
      if (V.canReplaceJoker(card, tm)) {
        const jokerIdx = tm.cards.findIndex(c => RC.isJoker(c));
        const joker = tm.cards[jokerIdx];
        tm.cards[jokerIdx] = card;
        card.faceUp = true;
        S.hands[0].splice(S.selectedIndices[0], 1);
        joker.faceUp = true;
        S.hands[0].push(joker); // joker goes to player's hand
        S.selectedIndices = [];
        RC.sortHandJokers(S.hands[0]);
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Joker replaced!', { color: '#ff0', size: 16 });
        if (S.hands[0].length === 0) endRound(0);
        return;
      }
    }

    // Try laying off on a meld
    for (const tm of S.tableMelds) {
      if (RM.canLayOffOn(card, tm)) {
        card.faceUp = true;
        tm.cards.push(card);
        S.hands[0].splice(S.selectedIndices[0], 1);
        S.selectedIndices = [];
        RC.sortHandJokers(S.hands[0]);
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 350, 'Laid off!', { color: '#8f8', size: 16 });
        if (S.hands[0].length === 0) endRound(0);
        return;
      }
    }

    if (S._host) S._host.floatingText.add(CANVAS_W / 2, 380, 'Cannot lay off here', { color: '#f84', size: 14 });
  }

  function playerDiscard() {
    if (S.selectedIndices.length !== 1) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 380, 'Select 1 card to discard', { color: '#f84', size: 14 });
      return;
    }
    const card = S.hands[0].splice(S.selectedIndices[0], 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);
    S.selectedIndices = [];
    RC.sortHandJokers(S.hands[0]);

    if (S.hands[0].length === 0) {
      endRound(0);
      return;
    }

    // Next player
    advanceTurn();
  }

  /* ══════════════════════════════════════════════════════════════════
     TURN MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function advanceTurn() {
    S.currentPlayer = (S.currentPlayer + 1) % NUM_PLAYERS;
    if (S.currentPlayer === 0)
      S.phase = PHASE_DRAW;
    else {
      S.phase = PHASE_AI_THINKING;
      S.aiTimer = 0;
      S.aiStep = 0;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     ROUND RESOLUTION
     ══════════════════════════════════════════════════════════════════ */

  function endRound(winner) {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    const isKalooki = S.noPriorMelds[winner] && S.hands[winner].length === 0;
    const multiplier = isKalooki ? 2 : 1;

    let msgs = [];
    if (isKalooki) {
      msgs.push(PLAYER_NAMES[winner] + ' declares KALOOKI! Double penalty!');
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 250, 'KALOOKI!', { color: '#ff0', size: 32 });
    } else
      msgs.push(PLAYER_NAMES[winner] + ' goes out!');

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === winner) continue;
      const pen = V.handPenalty(S.hands[p]) * multiplier;
      S.cumulScores[p] += pen;
      msgs.push(PLAYER_NAMES[p] + ': +' + pen + ' penalty');
    }

    S.score = -S.cumulScores[0]; // lower penalty = higher score (negative penalty as positive)
    if (S._host) S._host.onScoreChanged(S.score);

    // Check game over
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.cumulScores[p] >= PENALTY_LIMIT) {
        S.gameOver = true;
        // Find lowest penalty player
        let bestP = 0;
        for (let q = 1; q < NUM_PLAYERS; ++q)
          if (S.cumulScores[q] < S.cumulScores[bestP]) bestP = q;
        msgs.push(PLAYER_NAMES[bestP] + ' wins the game!');
        if (bestP === 0) {
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        } else {
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        }
        break;
      }
    }

    if (winner === 0 && !S.gameOver) {
      if (S._host) {
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.particles.confetti(CANVAS_W / 2, 300, 20);
      }
    }

    S.resultMsg = msgs.join(' | ');

    // Reveal all hands
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of S.hands[p]) c.faceUp = true;
  }

  Object.assign(V, { replenishStock, endRound, advanceTurn, playerDrawStock, playerDrawDiscard,
    playerMeld, playerLayOff, playerDiscard, setupKalooki });

})();
