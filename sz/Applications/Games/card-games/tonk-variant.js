;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Card values: A=1, 2-10=face, J/Q/K=10 ── */
  const CARD_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 };

  /* ── Constants ── */
  const NUM_PLAYERS = 3;
  const HAND_SIZE = 5;
  const WIN_SCORE = 100;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2'];
  const AI_KNOCK_THRESHOLD = 15;

  /* ── Phases ── */
  const PHASE_DEAL_CHECK = 0;
  const PHASE_DRAW = 1;
  const PHASE_PLAY = 2;
  const PHASE_AI_THINKING = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Game state ── */
  let hands = [[], [], []];
  let stockPile = [];
  let discardPile = [];
  let tableMelds = [];
  let scores = [0, 0, 0];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_DEAL_CHECK;
  let currentPlayer = 0;
  let selectedIndices = [];
  let resultMsg = '';
  let tonkDeclared = false;

  /* ── AI timing ── */
  let aiTimer = 0;
  let aiStep = 0;
  const AI_DELAY = 0.8;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── Layout positions ── */
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 30;
  const STOCK_Y = 210;
  const DISCARD_X = CANVAS_W / 2 + 30;
  const DISCARD_Y = 210;

  const MELD_AREA_X = 250;
  const MELD_AREA_Y = 130;

  const BTN_W = 90;
  const BTN_H = 30;
  const BTN_Y = 380;
  const BTN_GAP = 10;
  const BTN_START_X = CANVAS_W / 2 - (4 * BTN_W + 3 * BTN_GAP) / 2;

  const SPREAD_BTN  = { x: BTN_START_X, y: BTN_Y, w: BTN_W, h: BTN_H };
  const DROP_BTN    = { x: BTN_START_X + BTN_W + BTN_GAP, y: BTN_Y, w: BTN_W, h: BTN_H };
  const DISCARD_BTN = { x: BTN_START_X + 2 * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };
  const TONK_BTN    = { x: BTN_START_X + 3 * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };

  /* ══════════════════════════════════════════════════════════════════
     CARD UTILITIES
     ══════════════════════════════════════════════════════════════════ */

  function cardValue(card) {
    return CARD_VALUES[card.rank];
  }

  function rankIndex(card) {
    return CE.RANKS.indexOf(card.rank);
  }

  function handTotal(hand) {
    let total = 0;
    for (let i = 0; i < hand.length; ++i)
      total += cardValue(hand[i]);
    return total;
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return rankIndex(a) - rankIndex(b);
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     MELD DETECTION
     ══════════════════════════════════════════════════════════════════ */

  /* Sets: 3-4 cards of the same rank */
  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const rank = cards[0].rank;
    const suits = new Set();
    for (let i = 0; i < cards.length; ++i) {
      if (cards[i].rank !== rank) return false;
      if (suits.has(cards[i].suit)) return false;
      suits.add(cards[i].suit);
    }
    return true;
  }

  /* Runs: 3+ consecutive cards of the same suit */
  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const suit = cards[0].suit;
    for (let i = 0; i < cards.length; ++i)
      if (cards[i].suit !== suit) return false;
    const sorted = cards.slice().sort((a, b) => rankIndex(a) - rankIndex(b));
    for (let i = 1; i < sorted.length; ++i)
      if (rankIndex(sorted[i]) !== rankIndex(sorted[i - 1]) + 1) return false;
    return true;
  }

  function isValidMeld(cards) {
    return isValidSet(cards) || isValidRun(cards);
  }

  /* Can a card be added to an existing table meld? */
  function canExtendMeld(card, meld) {
    const testCards = meld.cards.concat(card);
    return isValidSet(testCards) || isValidRun(testCards);
  }

  /* Find all possible sets from hand indices */
  function findSetsInHand(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const results = [];
    for (const rank in byRank)
      if (byRank[rank].length >= 3)
        results.push(byRank[rank].slice(0, Math.min(byRank[rank].length, 4)));
    return results;
  }

  /* Find all possible runs from hand indices */
  function findRunsInHand(hand) {
    const bySuit = {};
    for (let i = 0; i < hand.length; ++i) {
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }
    const results = [];
    for (const suit in bySuit) {
      const indices = bySuit[suit];
      indices.sort((a, b) => rankIndex(hand[a]) - rankIndex(hand[b]));
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        for (let next = start + 1; next < indices.length; ++next) {
          if (rankIndex(hand[indices[next]]) === rankIndex(hand[run[run.length - 1]]) + 1)
            run.push(indices[next]);
          else
            break;
        }
        if (run.length >= 3)
          results.push(run.slice());
      }
    }
    return results;
  }

  function findBestMeld(hand) {
    const all = [...findSetsInHand(hand), ...findRunsInHand(hand)];
    if (all.length === 0) return null;
    let best = null;
    let bestLen = 0;
    for (const m of all) {
      if (m.length > bestLen) {
        bestLen = m.length;
        best = m;
      }
    }
    return best;
  }

  /* Find which table meld index this card can extend, or -1 */
  function findExtendTarget(card) {
    for (let i = 0; i < tableMelds.length; ++i)
      if (canExtendMeld(card, tableMelds[i])) return i;
    return -1;
  }

  /* ── Hint helper: does this card participate in a potential meld or extend one? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];

    // Check for 2+ same rank in hand
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run potential (2+ consecutive same suit)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit === card.suit)
        suitCards.push(rankIndex(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = rankIndex(card);
    for (let s = 0; s < suitCards.length; ++s) {
      let runLen = 1;
      let inRun = suitCards[s] === ci;
      for (let n = s + 1; n < suitCards.length; ++n) {
        if (suitCards[n] === suitCards[n - 1] + 1) {
          ++runLen;
          if (suitCards[n] === ci) inRun = true;
        } else
          break;
      }
      if (runLen >= 2 && inRun) return true;
    }

    // Check if card can extend an existing table meld
    if (findExtendTarget(card) >= 0) return true;

    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     LAYOUT HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function playerCardX(idx, total) {
    const maxWidth = 650;
    const spacing = Math.min(60, maxWidth / Math.max(total, 1));
    const startX = (CANVAS_W - spacing * (total - 1) - CE.CARD_W) / 2;
    return startX + idx * spacing;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupRound() {
    const deck = CE.shuffle(CE.createDeck());
    hands = [[], [], []];
    discardPile = [];
    tableMelds = [];
    roundOver = false;
    tonkDeclared = false;
    phase = PHASE_DEAL_CHECK;
    currentPlayer = 0;
    selectedIndices = [];
    resultMsg = '';
    aiTimer = 0;
    aiStep = 0;

    // Deal 5 cards each
    for (let i = 0; i < HAND_SIZE; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const card = deck.pop();
        if (p === 0) card.faceUp = true;
        hands[p].push(card);
      }

    // Turn one card face-up for discard pile
    const top = deck.pop();
    top.faceUp = true;
    discardPile.push(top);

    stockPile = deck;
    sortHand(hands[0]);

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, HAND_SIZE), 455, i * 0.08);
    }

    // Check for immediate Tonk (hand total 49 or 50) for all players
    checkDealTonk();
  }

  function checkDealTonk() {
    // Check player first
    const playerTotal = handTotal(hands[0]);
    if (playerTotal === 49 || playerTotal === 50) {
      // Player can choose to declare Tonk on first click
      phase = PHASE_DEAL_CHECK;
      return;
    }

    // Check AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const total = handTotal(hands[p]);
      if (total === 49 || total === 50) {
        declareTonk(p);
        return;
      }
    }

    // No tonk -- move to draw phase
    phase = PHASE_DRAW;
  }

  /* ══════════════════════════════════════════════════════════════════
     TONK / DROP / ROUND END
     ══════════════════════════════════════════════════════════════════ */

  function declareTonk(playerIdx) {
    tonkDeclared = true;
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    // Tonk wins double from each opponent
    let totalWon = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === playerIdx) continue;
      const opponentTotal = handTotal(hands[p]);
      totalWon += opponentTotal * 2;
    }
    scores[playerIdx] += totalWon;
    score = scores[0];

    if (playerIdx === 0) {
      resultMsg = 'TONK! You win ' + totalWon + ' points (double stakes)!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 200, 'TONK!', { color: '#ff0', size: 32 });
        _host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      resultMsg = PLAYER_NAMES[playerIdx] + ' declares Tonk! (' + handTotal(hands[playerIdx]) + ' pts) \u2014 wins ' + totalWon + '!';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' TONK!', { color: '#f84', size: 28 });
    }

    if (_host) _host.onScoreChanged(score);
    checkGameOver();
  }

  function playerDrop(playerIdx) {
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    // Find who has the lowest hand total
    let lowestTotal = Infinity;
    let lowestPlayer = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const t = handTotal(hands[p]);
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
        totalWon += handTotal(hands[p]);
      }
      scores[playerIdx] += totalWon;
      score = scores[0];

      if (playerIdx === 0) {
        resultMsg = 'Drop wins! You score ' + totalWon + ' points!';
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 200, 'Drop wins!', { color: '#4f4', size: 24 });
          _host.particles.confetti(CANVAS_W / 2, 300, 15);
        }
      } else {
        resultMsg = PLAYER_NAMES[playerIdx] + ' drops and wins! +' + totalWon + ' points.';
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' wins drop!', { color: '#fa0', size: 22 });
      }
    } else {
      // Dropper loses -- pays double to the actual lowest player
      const penalty = handTotal(hands[playerIdx]) * 2;
      scores[lowestPlayer] += penalty;
      score = scores[0];

      if (playerIdx === 0) {
        resultMsg = 'Drop fails! ' + PLAYER_NAMES[lowestPlayer] + ' had lower (' + lowestTotal + '). You pay ' + penalty + ' double!';
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 200, 'Drop fails!', { color: '#f44', size: 24 });
      } else {
        resultMsg = PLAYER_NAMES[playerIdx] + ' drops but loses! ' + PLAYER_NAMES[lowestPlayer] + ' had ' + lowestTotal + '. +' + penalty + ' to winner.';
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' drop fails!', { color: '#f84', size: 20 });
      }
    }

    if (_host) _host.onScoreChanged(score);
    checkGameOver();
  }

  function stockEmpty() {
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    let lowestTotal = Infinity;
    let lowestPlayer = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const t = handTotal(hands[p]);
      if (t < lowestTotal) {
        lowestTotal = t;
        lowestPlayer = p;
      }
    }

    let totalWon = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === lowestPlayer) continue;
      totalWon += handTotal(hands[p]);
    }
    scores[lowestPlayer] += totalWon;
    score = scores[0];

    resultMsg = 'Stock empty! ' + PLAYER_NAMES[lowestPlayer] + ' wins with ' + lowestTotal + ' pts. +' + totalWon + '!';
    if (lowestPlayer === 0 && _host) {
      _host.floatingText.add(CANVAS_W / 2, 200, 'You win!', { color: '#4f4', size: 24 });
      _host.particles.confetti(CANVAS_W / 2, 300, 15);
    }

    if (_host) _host.onScoreChanged(score);
    checkGameOver();
  }

  function emptyHandWin(playerIdx) {
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    let totalWon = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === playerIdx) continue;
      totalWon += handTotal(hands[p]);
    }
    scores[playerIdx] += totalWon;
    score = scores[0];

    if (playerIdx === 0) {
      resultMsg = 'Hand empty! You score ' + totalWon + ' points!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 200, 'Hand empty \u2014 you win!', { color: '#4f4', size: 24 });
        _host.particles.confetti(CANVAS_W / 2, 300, 20);
      }
    } else {
      resultMsg = PLAYER_NAMES[playerIdx] + ' empties hand! +' + totalWon + ' points.';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' hand empty!', { color: '#fa0', size: 22 });
    }

    if (_host) _host.onScoreChanged(score);
    checkGameOver();
  }

  function checkGameOver() {
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (scores[p] >= WIN_SCORE) {
        gameOver = true;
        if (p === 0) {
          resultMsg = 'YOU WIN THE GAME! Final: ' + scores.join(' / ');
          if (_host) {
            _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
            _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          }
        } else {
          resultMsg = PLAYER_NAMES[p] + ' wins the game! Final: ' + scores.join(' / ');
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        }
        return;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawStock() {
    if (stockPile.length === 0) {
      if (discardPile.length <= 1) {
        stockEmpty();
        return;
      }
      const top = discardPile.pop();
      stockPile = CE.shuffle(discardPile);
      for (const c of stockPile) c.faceUp = false;
      discardPile = [top];
    }
    const card = stockPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    sortHand(hands[0]);
    selectedIndices = [];
    phase = PHASE_PLAY;
    if (_host) _host.dealCardAnim(card, STOCK_X, STOCK_Y, playerCardX(hands[0].length - 1, hands[0].length), 455, 0);
  }

  function playerDrawDiscard() {
    if (discardPile.length === 0) return;
    const card = discardPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    sortHand(hands[0]);
    selectedIndices = [];
    phase = PHASE_PLAY;
    if (_host) _host.dealCardAnim(card, DISCARD_X, DISCARD_Y, playerCardX(hands[0].length - 1, hands[0].length), 455, 0);
  }

  function playerSpread() {
    if (selectedIndices.length < 3) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 420, 'Select 3+ cards to spread', { color: '#f88', size: 14 });
      return;
    }
    const cards = selectedIndices.map(i => hands[0][i]);
    if (!isValidMeld(cards)) {
      // Check if it is a single card extending a table meld
      if (selectedIndices.length === 1) {
        const card = hands[0][selectedIndices[0]];
        const target = findExtendTarget(card);
        if (target >= 0) {
          hands[0].splice(selectedIndices[0], 1);
          tableMelds[target].cards.push(card);
          selectedIndices = [];
          sortHand(hands[0]);
          if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Extended meld!', { color: '#4f4', size: 16 });
          if (hands[0].length === 0) {
            emptyHandWin(0);
            return;
          }
          return;
        }
      }
      if (_host) _host.floatingText.add(CANVAS_W / 2, 420, 'Invalid meld!', { color: '#f88', size: 14 });
      return;
    }

    // Remove from hand (descending index order)
    const sorted = selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted) hands[0].splice(idx, 1);
    tableMelds.push({ cards, owner: 0 });
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Spread!', { color: '#4f4', size: 18 });

    if (hands[0].length === 0) {
      emptyHandWin(0);
      return;
    }
  }

  function playerExtend() {
    if (selectedIndices.length !== 1) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 420, 'Select 1 card to hit', { color: '#f88', size: 14 });
      return;
    }
    const card = hands[0][selectedIndices[0]];
    const target = findExtendTarget(card);
    if (target < 0) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 420, 'Cannot add to any meld!', { color: '#f88', size: 14 });
      return;
    }
    hands[0].splice(selectedIndices[0], 1);
    tableMelds[target].cards.push(card);
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Hit!', { color: '#4f4', size: 16 });

    if (hands[0].length === 0) {
      emptyHandWin(0);
      return;
    }
  }

  function playerDiscard() {
    if (selectedIndices.length !== 1) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 420, 'Select 1 card to discard', { color: '#f88', size: 14 });
      return;
    }
    const card = hands[0].splice(selectedIndices[0], 1)[0];
    card.faceUp = true;
    discardPile.push(card);
    selectedIndices = [];
    sortHand(hands[0]);

    if (hands[0].length === 0) {
      emptyHandWin(0);
      return;
    }

    // Next player
    currentPlayer = 1;
    phase = PHASE_AI_THINKING;
    aiTimer = 0;
    aiStep = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiShouldDrawDiscard(p) {
    if (discardPile.length === 0) return false;
    const top = discardPile[discardPile.length - 1];
    // Check if the discard card completes a meld
    const testHand = hands[p].concat(top);
    const beforeMeld = findBestMeld(hands[p]);
    const afterMeld = findBestMeld(testHand);
    if (afterMeld && !beforeMeld) return true;
    if (afterMeld && beforeMeld && afterMeld.length > beforeMeld.length) return true;
    return false;
  }

  function aiSpreadMelds(p) {
    let spreading = true;
    while (spreading) {
      spreading = false;
      const meldIndices = findBestMeld(hands[p]);
      if (meldIndices && meldIndices.length >= 3) {
        const cards = meldIndices.map(i => hands[p][i]);
        if (isValidMeld(cards)) {
          const sorted = meldIndices.slice().sort((a, b) => b - a);
          for (const idx of sorted) hands[p].splice(idx, 1);
          tableMelds.push({ cards, owner: p });
          spreading = true;
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 180, PLAYER_NAMES[p] + ' spreads!', { color: '#fa0', size: 14 });
        }
      }
    }

    // Try extending existing melds
    let extended = true;
    while (extended) {
      extended = false;
      for (let i = hands[p].length - 1; i >= 0; --i) {
        const target = findExtendTarget(hands[p][i]);
        if (target >= 0) {
          const card = hands[p].splice(i, 1)[0];
          tableMelds[target].cards.push(card);
          extended = true;
        }
      }
    }
  }

  function aiChooseDiscard(p) {
    if (hands[p].length === 0) return -1;
    // Discard the highest-value card that is least useful
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < hands[p].length; ++i) {
      const v = cardValue(hands[p][i]);
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function aiShouldDrop(p) {
    return handTotal(hands[p]) <= AI_KNOCK_THRESHOLD;
  }

  function aiDraw(p) {
    if (aiShouldDrawDiscard(p) && discardPile.length > 0) {
      const card = discardPile.pop();
      hands[p].push(card);
    } else {
      if (stockPile.length === 0) {
        if (discardPile.length <= 1) {
          stockEmpty();
          return;
        }
        const top = discardPile.pop();
        stockPile = CE.shuffle(discardPile);
        for (const c of stockPile) c.faceUp = false;
        discardPile = [top];
      }
      const card = stockPile.pop();
      hands[p].push(card);
    }
  }

  function aiTakeTurn(p) {
    if (roundOver || gameOver) return;

    if (aiStep === 0) {
      // Draw
      aiDraw(p);
      if (roundOver) return;
      ++aiStep;
      aiTimer = 0;
      return;
    }

    if (aiStep === 1) {
      // Spread melds
      aiSpreadMelds(p);
      if (hands[p].length === 0) {
        emptyHandWin(p);
        return;
      }

      // Decide whether to drop
      if (aiShouldDrop(p)) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' drops! (' + handTotal(hands[p]) + ')', { color: '#fa0', size: 20 });
        playerDrop(p);
        return;
      }

      ++aiStep;
      aiTimer = 0;
      return;
    }

    if (aiStep === 2) {
      // Discard
      const discIdx = aiChooseDiscard(p);
      if (discIdx < 0) return;
      const card = hands[p].splice(discIdx, 1)[0];
      card.faceUp = true;
      discardPile.push(card);

      if (hands[p].length === 0) {
        emptyHandWin(p);
        return;
      }

      // Advance to next player
      const next = (p + 1) % NUM_PLAYERS;
      if (next === 0) {
        currentPlayer = 0;
        phase = PHASE_DRAW;
        selectedIndices = [];
        // Check stock
        if (stockPile.length === 0 && discardPile.length <= 1) {
          stockEmpty();
          return;
        }
      } else {
        currentPlayer = next;
        aiStep = 0;
        aiTimer = 0;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawTonk() {
    // Score panel
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, CANVAS_W - 180, 5, 170, 80, 6);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores (first to ' + WIN_SCORE + ')', CANVAS_W - 172, 10);
    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], CANVAS_W - 172, 28 + p * 16);
      _ctx.textAlign = 'right';
      _ctx.fillText('' + scores[p], CANVAS_W - 18, 28 + p * 16);
    }
    _ctx.restore();

    if (phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    // AI hands (face down) at top
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const startX = p === 1 ? 30 : CANVAS_W / 2 + 50;
      _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + hands[p].length + ')', startX, 15);
      for (let i = 0; i < hands[p].length; ++i)
        CE.drawCardBack(_ctx, startX + i * 22, 28, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Stock pile
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 6);
    if (stockPile.length > 0) {
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('' + stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 4);
    } else
      CE.drawEmptySlot(_ctx, STOCK_X, STOCK_Y);

    // Discard pile
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 6);
    if (discardPile.length > 0)
      CE.drawCardFace(_ctx, DISCARD_X, DISCARD_Y, discardPile[discardPile.length - 1]);
    else
      CE.drawEmptySlot(_ctx, DISCARD_X, DISCARD_Y);

    // Table melds
    drawTableMelds();

    // Action buttons
    if (currentPlayer === 0 && !roundOver && !gameOver) {
      if (phase === PHASE_DEAL_CHECK) {
        const pt = handTotal(hands[0]);
        if (pt === 49 || pt === 50)
          CE.drawButton(_ctx, TONK_BTN.x, TONK_BTN.y, TONK_BTN.w, TONK_BTN.h, 'Tonk! (T)', { bg: '#5a1a5a', border: '#f4f' });
        // Also show a "Pass" to skip tonk declaration
        CE.drawButton(_ctx, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h, 'Pass', { bg: '#3a3a3a', border: '#888' });
      } else if (phase === PHASE_DRAW) {
        // No explicit buttons; click stock or discard
      } else if (phase === PHASE_PLAY) {
        if (selectedIndices.length >= 3)
          CE.drawButton(_ctx, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h, 'Spread (S)', { bg: '#2a2a5a', border: '#88f' });
        else if (selectedIndices.length === 1 && findExtendTarget(hands[0][selectedIndices[0]]) >= 0)
          CE.drawButton(_ctx, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h, 'Hit (S)', { bg: '#2a4a2a', border: '#4a4' });

        CE.drawButton(_ctx, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h, 'Drop (K)', { bg: '#5a3a1a', border: '#c84' });

        if (selectedIndices.length === 1)
          CE.drawButton(_ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard (D)', { bg: '#3a1a1a', border: '#c44' });
      }
    }

    // Player hand
    drawPlayerHand();

    // Phase prompts
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'alphabetic';
    _ctx.font = '13px sans-serif';
    if (currentPlayer === 0) {
      if (phase === PHASE_DEAL_CHECK) {
        const pt = handTotal(hands[0]);
        if (pt === 49 || pt === 50) {
          _ctx.fillStyle = '#f4f';
          _ctx.fillText('Your hand totals ' + pt + '! Declare Tonk or Pass.', CANVAS_W / 2, CANVAS_H - 8);
        } else {
          _ctx.fillStyle = '#8f8';
          _ctx.fillText('Hand total: ' + pt + '. Click to begin.', CANVAS_W / 2, CANVAS_H - 8);
        }
      } else if (phase === PHASE_DRAW) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Draw from Stock or Discard pile', CANVAS_W / 2, CANVAS_H - 8);
      } else if (phase === PHASE_PLAY) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Spread melds, Hit on melds, Drop, or select a card to Discard', CANVAS_W / 2, CANVAS_H - 8);
      }
    } else if (phase === PHASE_AI_THINKING) {
      _ctx.fillStyle = '#ff8';
      _ctx.fillText(PLAYER_NAMES[currentPlayer] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawTableMelds() {
    if (tableMelds.length === 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.15)';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Melds', MELD_AREA_X + 150, MELD_AREA_Y - 4);
      _ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, MELD_AREA_X, MELD_AREA_Y, 420, 65, 6);
      _ctx.stroke();
      return;
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Melds:', MELD_AREA_X, MELD_AREA_Y - 4);

    let mx = MELD_AREA_X;
    let my = MELD_AREA_Y + 2;
    const cardScale = 0.55;
    const cw = CE.CARD_W * cardScale;
    const ch = CE.CARD_H * cardScale;
    const cardSpacing = 30;
    const meldGap = 14;

    for (let m = 0; m < tableMelds.length; ++m) {
      const meld = tableMelds[m];
      if (mx + meld.cards.length * cardSpacing + cw > CANVAS_W - 10) {
        mx = MELD_AREA_X;
        my += ch + 8;
      }

      const ownerColor = meld.owner === 0 ? '#8f8' : '#fa0';
      _ctx.fillStyle = ownerColor;
      _ctx.font = '8px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText(PLAYER_NAMES[meld.owner], mx + (meld.cards.length * cardSpacing) / 2, my - 1);

      for (let c = 0; c < meld.cards.length; ++c) {
        meld.cards[c].faceUp = true;
        CE.drawCardFace(_ctx, mx + c * cardSpacing, my, meld.cards[c], cw, ch);
      }
      mx += meld.cards.length * cardSpacing + meldGap;
    }
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    const ht = handTotal(hand);
    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Your Hand (total: ' + ht + ')', 90, 440);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isSelected = selectedIndices.includes(i);
      const y = isSelected ? 440 : 455;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow
      if (_host && _host.hintsEnabled && currentPlayer === 0 && (phase === PHASE_PLAY || phase === PHASE_DRAW) && cardHasHint(hand, i))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Selection highlight
      if (isSelected) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawRoundOver() {
    // Reveal all hands
    _ctx.save();
    const pw = 400;
    const ph = 300;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    _ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round Over', CANVAS_W / 2, py + 14);

    // Show each player's hand and total
    _ctx.font = '12px sans-serif';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Hand Total  |  Score', CANVAS_W / 2, py + 44);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const rowY = py + 68 + p * 50;
      const ht = handTotal(hands[p]);

      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.font = '12px sans-serif';
      _ctx.fillText(PLAYER_NAMES[p] + ':', px + 16, rowY);

      // Draw cards small
      const cardScale = 0.45;
      const cw = CE.CARD_W * cardScale;
      const ch = CE.CARD_H * cardScale;
      for (let c = 0; c < hands[p].length; ++c) {
        hands[p][c].faceUp = true;
        CE.drawCardFace(_ctx, px + 16 + c * 26, rowY + 14, hands[p][c], cw, ch);
      }

      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'right';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('Total: ' + ht + '  |  Score: ' + scores[p], px + pw - 16, rowY + 6);
    }

    // Result message
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(resultMsg, CANVAS_W / 2, py + ph - 45);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 18);
    _ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     HIT TESTING
     ══════════════════════════════════════════════════════════════════ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const x = playerCardX(i, total);
      const isSelected = selectedIndices.includes(i);
      const y = isSelected ? 440 : 455;
      const rightEdge = i === total - 1 ? x + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      scores = [0, 0, 0];
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawTonk();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          scores = [0, 0, 0];
          score = 0;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        setupRound();
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (currentPlayer !== 0) return;

      // DEAL CHECK phase (Tonk declaration)
      if (phase === PHASE_DEAL_CHECK) {
        const pt = handTotal(hands[0]);
        if ((pt === 49 || pt === 50) && CE.isInRect(mx, my, TONK_BTN.x, TONK_BTN.y, TONK_BTN.w, TONK_BTN.h)) {
          declareTonk(0);
          return;
        }
        // Pass button or any click to skip
        if (CE.isInRect(mx, my, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h) || !(pt === 49 || pt === 50)) {
          phase = PHASE_DRAW;
          return;
        }
        return;
      }

      // DRAW phase
      if (phase === PHASE_DRAW) {
        if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
          playerDrawStock();
          return;
        }
        if (discardPile.length > 0 && CE.isInRect(mx, my, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
          playerDrawDiscard();
          return;
        }
        return;
      }

      // PLAY phase
      if (phase === PHASE_PLAY) {
        // Spread button
        if (selectedIndices.length >= 3 && CE.isInRect(mx, my, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h)) {
          playerSpread();
          return;
        }
        // Hit button (1 selected card extending a meld)
        if (selectedIndices.length === 1 && findExtendTarget(hands[0][selectedIndices[0]]) >= 0 && CE.isInRect(mx, my, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h)) {
          playerExtend();
          return;
        }
        // Drop button
        if (CE.isInRect(mx, my, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h)) {
          playerDrop(0);
          return;
        }
        // Discard button
        if (selectedIndices.length === 1 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
          playerDiscard();
          return;
        }
        // Click hand cards to toggle selection
        const idx = hitTestPlayerCard(mx, my);
        if (idx >= 0) {
          const pos = selectedIndices.indexOf(idx);
          if (pos >= 0)
            selectedIndices.splice(pos, 1);
          else
            selectedIndices.push(idx);
          return;
        }
        return;
      }
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (currentPlayer !== 0) return;

      if (phase === PHASE_DEAL_CHECK) {
        const pt = handTotal(hands[0]);
        if ((e.key === 't' || e.key === 'T') && (pt === 49 || pt === 50)) {
          declareTonk(0);
          return;
        }
        if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') {
          phase = PHASE_DRAW;
          return;
        }
      }

      if (phase === PHASE_PLAY) {
        if (e.key === 's' || e.key === 'S') {
          if (selectedIndices.length >= 3)
            playerSpread();
          else if (selectedIndices.length === 1 && findExtendTarget(hands[0][selectedIndices[0]]) >= 0)
            playerExtend();
        } else if (e.key === 'k' || e.key === 'K') {
          playerDrop(0);
        } else if (e.key === 'd' || e.key === 'D') {
          if (selectedIndices.length === 1)
            playerDiscard();
        } else if (e.key === 'Escape') {
          selectedIndices = [];
        }
      }
    },

    tick(dt) {
      if (roundOver || gameOver) return;
      if (phase !== PHASE_AI_THINKING) return;

      aiTimer += dt;
      if (aiTimer >= AI_DELAY)
        aiTakeTurn(currentPlayer);
    },

    cleanup() {
      hands = [[], [], []];
      stockPile = [];
      discardPile = [];
      tableMelds = [];
      scores = [0, 0, 0];
      selectedIndices = [];
      roundOver = false;
      gameOver = false;
      tonkDeclared = false;
      phase = PHASE_DEAL_CHECK;
      currentPlayer = 0;
      resultMsg = '';
      aiTimer = 0;
      aiStep = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('tonk', module);

})();
