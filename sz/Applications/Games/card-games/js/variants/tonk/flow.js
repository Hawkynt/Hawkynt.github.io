/* Tonk round flow: dealing, Tonk declarations, drops, draws, spreads, discards and round/game end scoring. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.tonk;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, WIN_SCORE, PLAYER_NAMES, PHASE_DEAL_CHECK, PHASE_DRAW,
    PHASE_PLAY, PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const HAND_SIZE = 5;

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupRound() {
    const deck = CE.shuffle(CE.createDeck());
    S.hands = [[], [], []];
    S.discardPile = [];
    S.tableMelds = [];
    S.roundOver = false;
    S.tonkDeclared = false;
    S.phase = PHASE_DEAL_CHECK;
    S.currentPlayer = 0;
    S.selectedIndices = [];
    S.resultMsg = '';
    S.aiTimer = 0;
    S.aiStep = 0;

    // Deal 5 cards each
    for (let i = 0; i < HAND_SIZE; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const card = deck.pop();
        if (p === 0) card.faceUp = true;
        S.hands[p].push(card);
      }

    // Turn one card face-up for discard pile
    const top = deck.pop();
    top.faceUp = true;
    S.discardPile.push(top);

    S.stockPile = deck;
    RC.sortHand(S.hands[0]);

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, RC.playerCardX(i, HAND_SIZE), 455, i * 0.08);
    }

    // Check for immediate Tonk (hand total 49 or 50) for all players
    checkDealTonk();
  }

  function checkDealTonk() {
    // Check player first
    const playerTotal = V.handTotal(S.hands[0]);
    if (playerTotal === 49 || playerTotal === 50) {
      // Player can choose to declare Tonk on first click
      S.phase = PHASE_DEAL_CHECK;
      return;
    }

    // Check AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const total = V.handTotal(S.hands[p]);
      if (total === 49 || total === 50) {
        declareTonk(p);
        return;
      }
    }

    // No tonk -- move to draw phase
    S.phase = PHASE_DRAW;
  }

  /* ══════════════════════════════════════════════════════════════════
     TONK / DROP / ROUND END
     ══════════════════════════════════════════════════════════════════ */

  function declareTonk(playerIdx) {
    S.tonkDeclared = true;
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    // Tonk wins double from each opponent
    let totalWon = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === playerIdx) continue;
      const opponentTotal = V.handTotal(S.hands[p]);
      totalWon += opponentTotal * 2;
    }
    S.scores[playerIdx] += totalWon;
    S.score = S.scores[0];

    if (playerIdx === 0) {
      S.resultMsg = 'TONK! You win ' + totalWon + ' points (double stakes)!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 200, 'TONK!', { color: '#ff0', size: 32 });
        S._host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      S.resultMsg = PLAYER_NAMES[playerIdx] + ' declares Tonk! (' + V.handTotal(S.hands[playerIdx]) + ' pts) \u2014 wins ' + totalWon + '!';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' TONK!', { color: '#f84', size: 28 });
    }

    if (S._host) S._host.onScoreChanged(S.score);
    checkGameOver();
  }

  function playerDrop(playerIdx) {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    // Find who has the lowest hand total
    let lowestTotal = Infinity;
    let lowestPlayer = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const t = V.handTotal(S.hands[p]);
      if (t < lowestTotal) {
        lowestTotal = t;
        lowestPlayer = p;
      }
    }

    if (lowestPlayer === playerIdx) {
      // Dropper wins -- collect losers' hand totals
      let totalWon = 0;
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p === playerIdx) continue;
        totalWon += V.handTotal(S.hands[p]);
      }
      S.scores[playerIdx] += totalWon;
      S.score = S.scores[0];

      if (playerIdx === 0) {
        S.resultMsg = 'Drop wins! You score ' + totalWon + ' points!';
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 200, 'Drop wins!', { color: '#4f4', size: 24 });
          S._host.particles.confetti(CANVAS_W / 2, 300, 15);
        }
      } else {
        S.resultMsg = PLAYER_NAMES[playerIdx] + ' drops and wins! +' + totalWon + ' points.';
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' wins drop!', { color: '#fa0', size: 22 });
      }
    } else {
      // Dropper loses -- pays double to the actual lowest player
      const penalty = V.handTotal(S.hands[playerIdx]) * 2;
      S.scores[lowestPlayer] += penalty;
      S.score = S.scores[0];

      if (playerIdx === 0) {
        S.resultMsg = 'Drop fails! ' + PLAYER_NAMES[lowestPlayer] + ' had lower (' + lowestTotal + '). You pay ' + penalty + ' double!';
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 200, 'Drop fails!', { color: '#f44', size: 24 });
      } else {
        S.resultMsg = PLAYER_NAMES[playerIdx] + ' drops but loses! ' + PLAYER_NAMES[lowestPlayer] + ' had ' + lowestTotal + '. +' + penalty + ' to winner.';
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' drop fails!', { color: '#f84', size: 20 });
      }
    }

    if (S._host) S._host.onScoreChanged(S.score);
    checkGameOver();
  }

  function stockEmpty() {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    let lowestTotal = Infinity;
    let lowestPlayer = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const t = V.handTotal(S.hands[p]);
      if (t < lowestTotal) {
        lowestTotal = t;
        lowestPlayer = p;
      }
    }

    let totalWon = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === lowestPlayer) continue;
      totalWon += V.handTotal(S.hands[p]);
    }
    S.scores[lowestPlayer] += totalWon;
    S.score = S.scores[0];

    S.resultMsg = 'Stock empty! ' + PLAYER_NAMES[lowestPlayer] + ' wins with ' + lowestTotal + ' pts. +' + totalWon + '!';
    if (lowestPlayer === 0 && S._host) {
      S._host.floatingText.add(CANVAS_W / 2, 200, 'You win!', { color: '#4f4', size: 24 });
      S._host.particles.confetti(CANVAS_W / 2, 300, 15);
    }

    if (S._host) S._host.onScoreChanged(S.score);
    checkGameOver();
  }

  function emptyHandWin(playerIdx) {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    let totalWon = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === playerIdx) continue;
      totalWon += V.handTotal(S.hands[p]);
    }
    S.scores[playerIdx] += totalWon;
    S.score = S.scores[0];

    if (playerIdx === 0) {
      S.resultMsg = 'Hand empty! You score ' + totalWon + ' points!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Hand empty \u2014 you win!', { color: '#4f4', size: 24 });
        S._host.particles.confetti(CANVAS_W / 2, 300, 20);
      }
    } else {
      S.resultMsg = PLAYER_NAMES[playerIdx] + ' empties hand! +' + totalWon + ' points.';
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' hand empty!', { color: '#fa0', size: 22 });
    }

    if (S._host) S._host.onScoreChanged(S.score);
    checkGameOver();
  }

  function checkGameOver() {
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.scores[p] >= WIN_SCORE) {
        S.gameOver = true;
        if (p === 0) {
          S.resultMsg = 'YOU WIN THE GAME! Final: ' + S.scores.join(' / ');
          if (S._host) {
            S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
            S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          }
        } else {
          S.resultMsg = PLAYER_NAMES[p] + ' wins the game! Final: ' + S.scores.join(' / ');
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        }
        return;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawStock() {
    if (S.stockPile.length === 0) {
      if (S.discardPile.length <= 1) {
        stockEmpty();
        return;
      }
      const top = S.discardPile.pop();
      S.stockPile = CE.shuffle(S.discardPile);
      for (const c of S.stockPile) c.faceUp = false;
      S.discardPile = [top];
    }
    const card = S.stockPile.pop();
    card.faceUp = true;
    S.hands[0].push(card);
    RC.sortHand(S.hands[0]);
    S.selectedIndices = [];
    S.phase = PHASE_PLAY;
    if (S._host) S._host.dealCardAnim(card, STOCK_X, STOCK_Y, RC.playerCardX(S.hands[0].length - 1, S.hands[0].length), 455, 0);
  }

  function playerDrawDiscard() {
    if (S.discardPile.length === 0) return;
    const card = S.discardPile.pop();
    card.faceUp = true;
    S.hands[0].push(card);
    RC.sortHand(S.hands[0]);
    S.selectedIndices = [];
    S.phase = PHASE_PLAY;
    if (S._host) S._host.dealCardAnim(card, DISCARD_X, DISCARD_Y, RC.playerCardX(S.hands[0].length - 1, S.hands[0].length), 455, 0);
  }

  function playerSpread() {
    if (S.selectedIndices.length < 3) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 420, 'Select 3+ cards to spread', { color: '#f88', size: 14 });
      return;
    }
    const cards = S.selectedIndices.map(i => S.hands[0][i]);
    if (!V.isValidMeld(cards)) {
      // Check if it is a single card extending a table meld
      if (S.selectedIndices.length === 1) {
        const card = S.hands[0][S.selectedIndices[0]];
        const target = V.findExtendTarget(card);
        if (target >= 0) {
          S.hands[0].splice(S.selectedIndices[0], 1);
          S.tableMelds[target].cards.push(card);
          S.selectedIndices = [];
          RC.sortHand(S.hands[0]);
          if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Extended meld!', { color: '#4f4', size: 16 });
          if (S.hands[0].length === 0) {
            emptyHandWin(0);
            return;
          }
          return;
        }
      }
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 420, 'Invalid meld!', { color: '#f88', size: 14 });
      return;
    }

    // Remove from hand (descending index order)
    const sorted = S.selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted) S.hands[0].splice(idx, 1);
    S.tableMelds.push({ cards, owner: 0 });
    S.selectedIndices = [];
    RC.sortHand(S.hands[0]);

    if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Spread!', { color: '#4f4', size: 18 });

    if (S.hands[0].length === 0) {
      emptyHandWin(0);
      return;
    }
  }

  function playerExtend() {
    if (S.selectedIndices.length !== 1) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 420, 'Select 1 card to hit', { color: '#f88', size: 14 });
      return;
    }
    const card = S.hands[0][S.selectedIndices[0]];
    const target = V.findExtendTarget(card);
    if (target < 0) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 420, 'Cannot add to any meld!', { color: '#f88', size: 14 });
      return;
    }
    S.hands[0].splice(S.selectedIndices[0], 1);
    S.tableMelds[target].cards.push(card);
    S.selectedIndices = [];
    RC.sortHand(S.hands[0]);

    if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Hit!', { color: '#4f4', size: 16 });

    if (S.hands[0].length === 0) {
      emptyHandWin(0);
      return;
    }
  }

  function playerDiscard() {
    if (S.selectedIndices.length !== 1) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 420, 'Select 1 card to discard', { color: '#f88', size: 14 });
      return;
    }
    const card = S.hands[0].splice(S.selectedIndices[0], 1)[0];
    card.faceUp = true;
    S.discardPile.push(card);
    S.selectedIndices = [];
    RC.sortHand(S.hands[0]);

    if (S.hands[0].length === 0) {
      emptyHandWin(0);
      return;
    }

    // Next player
    S.currentPlayer = 1;
    S.phase = PHASE_AI_THINKING;
    S.aiTimer = 0;
    S.aiStep = 0;
  }

  Object.assign(V, { stockEmpty, emptyHandWin, playerDrop, setupRound, declareTonk,
    playerDrawStock, playerDrawDiscard, playerSpread, playerExtend, playerDiscard });

})();
