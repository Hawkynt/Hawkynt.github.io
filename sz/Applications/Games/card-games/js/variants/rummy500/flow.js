/* Rummy 500 round flow: dealing, draws (including deep discard picks), melds, lay-offs, discards and round scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.rummy500;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, WIN_SCORE, PLAYER_NAMES, PHASE_DRAW, PHASE_MELD,
    PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, MELD_AREA_Y } = V;
  const RC = SZ.CardGames.shared.rummyCards;
  const RM = SZ.CardGames.shared.rummyMelds;

  const HAND_SIZE = 7;

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    const deck = CE.shuffle(V.createRummy500Deck());
    S.hands = [[], [], []];
    S.discardPile = [];
    S.tableMelds = [];
    S.roundMeldPoints = [0, 0, 0];
    S.roundOver = false;
    S.phase = PHASE_DRAW;
    S.currentPlayer = 0;
    S.selectedIndices = [];
    S.resultMsg = '';
    S.aiTimer = 0;
    S.aiStep = 0;

    // Deal 7 cards each
    for (let i = 0; i < HAND_SIZE; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const card = deck.pop();
        if (p === 0) card.faceUp = true;
        S.hands[p].push(card);
      }

    // Start discard pile with one card
    const top = deck.pop();
    top.faceUp = true;
    S.discardPile.push(top);

    S.stockPile = deck;
    RC.sortHandJokers(S.hands[0]);

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), CANVAS_H - CE.CARD_H - 20, i * 0.06);
    }
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function computeRoundScores(emptierIdx) {
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      let handPenalty = 0;
      for (const c of S.hands[p]) handPenalty += V.cardPoints(c);
      const net = S.roundMeldPoints[p] - handPenalty;
      S.cumulScores[p] += net;

      if (S._host && p === 0) {
        const label = (net >= 0 ? '+' : '') + net + ' pts';
        const color = net >= 0 ? '#4f4' : '#f44';
        S._host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 18 });
      }
    }

    S.score = S.cumulScores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    // Check game over
    let anyWin = false;
    let winnerIdx = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.cumulScores[p] >= WIN_SCORE) {
        anyWin = true;
        if (winnerIdx < 0 || S.cumulScores[p] > S.cumulScores[winnerIdx])
          winnerIdx = p;
      }
    }

    S.roundOver = true;

    if (anyWin) {
      S.gameOver = true;
      if (winnerIdx === 0) {
        S.resultMsg = 'You win! Final: ' + S.cumulScores.join(' / ');
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 200, 'YOU WIN!', { color: '#4f4', size: 32 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
          S._host.particles.confetti(CANVAS_W / 2, 300, 30);
        }
      } else {
        S.resultMsg = PLAYER_NAMES[winnerIdx] + ' wins! Final: ' + S.cumulScores.join(' / ');
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 200, 'GAME OVER', { color: '#f44', size: 32 });
          S._host.screenShake.trigger(6, 300);
        }
      }
    } else {
      S.resultMsg = 'Round over! Scores: ' + S.cumulScores.join(' / ') + ' \u2014 click to continue';
    }

    S.phase = PHASE_ROUND_OVER;
  }

  function endRound(emptierIdx) {
    computeRoundScores(emptierIdx);
  }

  /* ================================================================
     CHECK STOCK EXHAUSTED
     ================================================================ */

  function checkStockExhausted() {
    if (S.stockPile.length === 0 && S.discardPile.length <= 1) {
      endRound(-1);
      return true;
    }
    if (S.stockPile.length === 0) {
      // Reshuffle all but top discard card back into stock
      const top = S.discardPile.pop();
      S.stockPile = CE.shuffle(S.discardPile);
      for (const c of S.stockPile) c.faceUp = false;
      S.discardPile = [top];
    }
    return false;
  }

  /* ================================================================
     PLAYER ACTIONS
     ================================================================ */

  function playerDrawStock() {
    if (checkStockExhausted()) return;
    const card = S.stockPile.pop();
    card.faceUp = true;
    S.hands[0].push(card);
    RC.sortHandJokers(S.hands[0]);
    S.selectedIndices = [];
    S.phase = PHASE_MELD;
    if (S._host) S._host.dealCardAnim(card, STOCK_X, STOCK_Y, V.playerCardX(S.hands[0].length - 1, S.hands[0].length), CANVAS_H - CE.CARD_H - 20, 0);
  }

  function playerDrawFromDiscard(upToIdx) {
    // Must take from upToIdx to top, and immediately use the deepest card
    const taken = S.discardPile.splice(upToIdx);
    for (const c of taken) {
      c.faceUp = true;
      S.hands[0].push(c);
    }
    RC.sortHandJokers(S.hands[0]);
    S.selectedIndices = [];
    S.phase = PHASE_MELD;
  }

  function playerMeld() {
    if (S.selectedIndices.length < 3) return;
    const cards = S.selectedIndices.map(i => S.hands[0][i]);
    if (!RM.isValidMeld(cards)) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Invalid meld!', { color: '#f88', size: 14 });
      return;
    }
    // Remove from hand (descending order to preserve indices)
    const sorted = S.selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted) S.hands[0].splice(idx, 1);

    let pts = 0;
    for (const c of cards) pts += V.cardPoints(c);
    S.roundMeldPoints[0] += pts;

    S.tableMelds.push({ cards, owner: 0 });
    S.selectedIndices = [];
    RC.sortHandJokers(S.hands[0]);

    if (S._host) {
      S._host.floatingText.add(CANVAS_W / 2, 400, '+' + pts + ' melded!', { color: '#4f4', size: 16 });
      S._host.triggerChipSparkle(CANVAS_W / 2, MELD_AREA_Y + 40);
    }

    // Check if hand is empty
    if (S.hands[0].length === 0) {
      endRound(0);
      return;
    }
  }

  function playerLayOff() {
    if (S.selectedIndices.length !== 1) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Select 1 card to lay off', { color: '#f88', size: 14 });
      return;
    }
    const card = S.hands[0][S.selectedIndices[0]];
    const target = V.findLayOffTarget(card);
    if (target < 0) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Cannot lay off here!', { color: '#f88', size: 14 });
      return;
    }
    S.hands[0].splice(S.selectedIndices[0], 1);
    S.tableMelds[target].cards.push(card);

    const pts = V.cardPoints(card);
    S.roundMeldPoints[0] += pts;
    S.selectedIndices = [];
    RC.sortHandJokers(S.hands[0]);

    if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, '+' + pts + ' laid off!', { color: '#4f4', size: 14 });

    if (S.hands[0].length === 0) {
      endRound(0);
      return;
    }
  }

  function playerDiscard() {
    if (S.selectedIndices.length !== 1) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 400, 'Select 1 card to discard', { color: '#f88', size: 14 });
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
    S.currentPlayer = 1;
    S.phase = PHASE_AI_THINKING;
    S.aiTimer = 0;
    S.aiStep = 0;
  }

  Object.assign(V, { checkStockExhausted, endRound, setupRound, playerDrawStock,
    playerDrawFromDiscard, playerMeld, playerLayOff, playerDiscard });

})();
