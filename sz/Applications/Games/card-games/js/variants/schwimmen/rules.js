/* Schwimmen: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.schwimmen;
  const S = V.S;
  const { CANVAS_W, CANVAS_H } = V;

  /* ── Schwimmen-specific constants (32-card deck: 7..A) ── */
  const SCHWIMMEN_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const RANK_VALUES = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };

  /* ── Table size ── */
  const NUM_PLAYERS = 4;

  /* ================================================================
     SCHWIMMEN RULES
     ================================================================ */

  function cardValue(card) {
    return RANK_VALUES[card.rank] || 0;
  }

  function handValue(hand) {
    // Best same-suit total, or 30.5 for three-of-a-kind
    if (hand.length !== 3) return 0;

    // Check three-of-a-kind
    if (hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank)
      return 30.5;

    // Best same-suit sum
    let best = 0;
    for (const suit of CE.SUITS) {
      let sum = 0;
      for (const c of hand) {
        if (c.suit === suit)
          sum += cardValue(c);
      }
      if (sum > best) best = sum;
    }
    return best;
  }

  function handValueLabel(hand) {
    const val = handValue(hand);
    if (val === 30.5) return '30.5 (Three of a Kind)';
    if (val === 31) return '31 (Feuer!)';
    return '' + val;
  }

  function bestSuitName(hand) {
    let bestSuit = CE.SUITS[0];
    let bestVal = 0;
    for (const suit of CE.SUITS) {
      let sum = 0;
      for (const c of hand) {
        if (c.suit === suit)
          sum += cardValue(c);
      }
      if (sum > bestVal) {
        bestVal = sum;
        bestSuit = suit;
      }
    }
    return SUIT_NAMES[bestSuit];
  }

  function nextActivePlayer(from) {
    let p = (from + 1) % NUM_PLAYERS;
    let safety = 0;
    while (S.eliminated[p] && safety < NUM_PLAYERS) {
      p = (p + 1) % NUM_PLAYERS;
      ++safety;
    }
    return p;
  }

  function countActivePlayers() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!S.eliminated[i]) ++count;
    return count;
  }

  /* ================================================================
     SETUP / DEAL
     ================================================================ */

  function setupRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, SCHWIMMEN_RANKS));
    S.hands = [[], [], [], []];
    S.pool = [];
    S.selectedHandCard = -1;
    S.selectedPoolCard = -1;
    S.swapMode = 'none';
    S.hasKnocked = -1;
    S.knockFinalTurns = 0;
    S.roundOver = false;
    S.resultMsg = '';
    S.aiTurnTimer = 0;

    // Deal 3 cards to each player, 3 to pool
    for (let i = 0; i < 3; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p)
        S.hands[p].push(d.pop());
    for (let i = 0; i < 3; ++i)
      S.pool.push(d.pop());

    // Player cards face up, pool face up
    for (const c of S.hands[0]) c.faceUp = true;
    for (const c of S.pool) c.faceUp = true;

    // Find first active player starting from 0
    S.currentTurn = 0;
    if (S.eliminated[0]) S.currentTurn = nextActivePlayer(0);

    // Check for immediate 31
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!S.eliminated[p] && handValue(S.hands[p]) === 31) {
        if (S._host) {
          const label = p === 0 ? 'You got 31 - Feuer!' : 'AI ' + p + ' has 31 - Feuer!';
          S._host.floatingText.add(CANVAS_W / 2, 280, label, { color: '#ff0', size: 24 });
        }
        endRound(p);
        return;
      }
    }

    if (S._host) {
      for (let i = 0; i < 3; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i), V.playerCardY(), i * 0.1);
    }
  }

  /* ================================================================
     SWAP LOGIC
     ================================================================ */

  function performSwap1(playerIdx, handIdx, poolIdx) {
    const tmp = S.hands[playerIdx][handIdx];
    S.hands[playerIdx][handIdx] = S.pool[poolIdx];
    S.pool[poolIdx] = tmp;
    // Keep face-up state correct
    if (playerIdx === 0)
      S.hands[0][handIdx].faceUp = true;
    S.pool[poolIdx].faceUp = true;
  }

  function performSwapAll(playerIdx) {
    const tmp = S.hands[playerIdx].slice();
    S.hands[playerIdx] = S.pool.slice();
    S.pool.length = 0;
    for (const c of tmp) {
      c.faceUp = true;
      S.pool.push(c);
    }
    if (playerIdx === 0) {
      for (const c of S.hands[0]) c.faceUp = true;
    }
  }

  function advanceTurn() {
    // Check for 31 after a swap
    if (!S.roundOver && handValue(S.hands[S.currentTurn]) === 31) {
      if (S._host) {
        const label = S.currentTurn === 0 ? 'You got 31 - Feuer!' : 'AI ' + S.currentTurn + ' has 31!';
        S._host.floatingText.add(CANVAS_W / 2, 280, label, { color: '#ff0', size: 24 });
      }
      endRound(S.currentTurn);
      return;
    }

    // If someone knocked, count down final turns
    if (S.hasKnocked >= 0) {
      ++S.knockFinalTurns;
      const activeCount = countActivePlayers();
      if (S.knockFinalTurns >= activeCount - 1) {
        evaluateRound();
        return;
      }
    }

    S.currentTurn = nextActivePlayer(S.currentTurn);
    S.aiTurnTimer = 0;
    S.selectedHandCard = -1;
    S.selectedPoolCard = -1;
    S.swapMode = 'none';
  }

  /* ================================================================
     ROUND EVALUATION
     ================================================================ */

  function evaluateRound() {
    // Find lowest hand value among active players
    let lowestVal = Infinity;
    let losers = [];

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.eliminated[p]) continue;
      const val = handValue(S.hands[p]);
      if (val < lowestVal) {
        lowestVal = val;
        losers = [p];
      } else if (val === lowestVal)
        losers.push(p);
    }

    endRound(-1, losers);
  }

  function endRound(feuerWinner, losers) {
    S.roundOver = true;

    if (feuerWinner >= 0) {
      // 31 instant win -- everyone else loses a life
      const fLosers = [];
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p !== feuerWinner && !S.eliminated[p]) {
          --S.lives[p];
          fLosers.push(p);
          if (S._host) {
            const label = p === 0 ? 'You lose a life!' : 'AI ' + p + ' loses a life!';
            S._host.floatingText.add(200 + p * 150, 200, label, { color: '#f44', size: 14 });
          }
        }
      }
      losers = fLosers;
    } else if (losers && losers.length > 0) {
      for (const p of losers) {
        --S.lives[p];
        if (S._host) {
          const label = p === 0 ? 'You lose a life!' : 'AI ' + p + ' loses a life!';
          S._host.floatingText.add(200 + p * 150, 200, label, { color: '#f44', size: 14 });
        }
      }
    }

    // Check eliminations
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!S.eliminated[p] && S.lives[p] <= 0) {
        S.eliminated[p] = true;
        if (S._host) {
          const label = p === 0 ? 'You are out!' : 'AI ' + p + ' is out!';
          S._host.floatingText.add(CANVAS_W / 2, 240, label, { color: '#f00', size: 22 });
        }
      }
    }

    // Compute score for host
    S.score = S.lives[0] * 30 + (S.eliminated[0] ? 0 : handValue(S.hands[0]));

    // Check game over
    if (S.eliminated[0]) {
      S.gameOver = true;
      S.resultMsg = 'GAME OVER - You are eliminated!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        S._host.onScoreChanged(S.score);
      }
      return;
    }

    if (countActivePlayers() <= 1) {
      S.gameOver = true;
      if (!S.eliminated[0]) {
        S.resultMsg = 'YOU WIN! Last player standing!';
        S.score += 100;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      }
    } else {
      // Build result message
      const lostNames = losers ? losers.map(p => p === 0 ? 'You' : 'AI ' + p).join(', ') : '';
      S.resultMsg = lostNames + ' lost a life. Click to continue.';
    }

    if (S._host) S._host.onScoreChanged(S.score);
  }

  V.cardValue = cardValue;
  V.handValue = handValue;
  V.handValueLabel = handValueLabel;
  V.bestSuitName = bestSuitName;
  V.nextActivePlayer = nextActivePlayer;
  V.setupRound = setupRound;
  V.performSwap1 = performSwap1;
  V.performSwapAll = performSwapAll;
  V.advanceTurn = advanceTurn;

})();
