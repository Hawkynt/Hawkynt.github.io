;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const NUM_PLAYERS = 3;
  const HAND_SIZE = 7;
  const PENALTY_LIMIT = 100;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2'];

  /* ── Phases ── */
  const PHASE_DRAW = 0;
  const PHASE_MELD = 1;
  const PHASE_DISCARD = 2;
  const PHASE_AI_THINKING = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Card penalty values: A=1, 2-10=face, J/Q/K=10 ── */
  function cardPenalty(card) {
    if (card.rank === 'A') return 1;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function rankIndex(card) {
    return CE.RANKS.indexOf(card.rank);
  }

  /* ── Layout constants ── */
  const STOCK_X = 30;
  const STOCK_Y = 220;
  const DISCARD_X = 130;
  const DISCARD_Y = 220;
  const MELD_AREA_X = 300;
  const MELD_AREA_Y = 140;

  const BTN_W = 80;
  const BTN_H = 28;
  const DRAW_BTN    = { x: 30,  y: 340, w: BTN_W, h: BTN_H };
  const MELD_BTN    = { x: 120, y: 340, w: BTN_W, h: BTN_H };
  const LAYOFF_BTN  = { x: 210, y: 340, w: BTN_W, h: BTN_H };
  const DISCARD_BTN = { x: 300, y: 340, w: BTN_W, h: BTN_H };

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], []];
  let stockPile = [];
  let discardPile = [];
  let tableMelds = [];           // [{cards:[], owner:int}]
  let penaltyScores = [0, 0, 0]; // cumulative penalty points
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_DRAW;
  let currentPlayer = 0;
  let selectedIndices = [];      // indices in player's hand
  let resultMsg = '';

  let aiTimer = 0;
  let aiStep = 0;               // 0=draw, 1=meld, 2=discard
  const AI_DELAY = 0.8;

  let _ctx = null;
  let _host = null;

  /* ================================================================
     HAND SORTING
     ================================================================ */

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return rankIndex(a) - rankIndex(b);
    });
  }

  /* ================================================================
     MELD VALIDATION
     ================================================================ */

  /* Check if cards form a valid set (3-4 cards of the same rank) */
  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const rank = cards[0].rank;
    for (const c of cards)
      if (c.rank !== rank) return false;
    // No duplicate suits
    const suits = new Set();
    for (const c of cards) {
      if (suits.has(c.suit)) return false;
      suits.add(c.suit);
    }
    return true;
  }

  /* Check if cards form a valid run (3+ consecutive same-suit cards) */
  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const suit = cards[0].suit;
    for (const c of cards)
      if (c.suit !== suit) return false;
    const sorted = cards.slice().sort((a, b) => rankIndex(a) - rankIndex(b));
    for (let i = 1; i < sorted.length; ++i) {
      if (rankIndex(sorted[i]) !== rankIndex(sorted[i - 1]) + 1)
        return false;
      if (rankIndex(sorted[i]) === rankIndex(sorted[i - 1]))
        return false; // duplicate
    }
    return true;
  }

  function isValidMeld(cards) {
    return isValidSet(cards) || isValidRun(cards);
  }

  /* Check if a single card can be laid off on an existing table meld */
  function canLayOffOn(card, meld) {
    const testCards = meld.cards.concat(card);
    return isValidSet(testCards) || isValidRun(testCards);
  }

  function findLayOffTarget(card) {
    for (let i = 0; i < tableMelds.length; ++i)
      if (canLayOffOn(card, tableMelds[i])) return i;
    return -1;
  }

  /* ================================================================
     MELD DETECTION (for AI and hints)
     ================================================================ */

  function findAllSets(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const results = [];
    for (const rank in byRank) {
      if (byRank[rank].length >= 3)
        results.push(byRank[rank].slice(0, Math.min(byRank[rank].length, 4)));
    }
    return results;
  }

  function findAllRuns(hand) {
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

  /* Find the best non-overlapping melds that remove the most penalty points */
  function findBestMelds(hand) {
    const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
    if (allMelds.length === 0)
      return { melds: [], indices: new Set() };

    let bestRemoved = 0;
    let bestCombo = [];

    function search(meldIdx, used, combo) {
      let removed = 0;
      for (const idx of used) removed += cardPenalty(hand[idx]);
      if (removed > bestRemoved) {
        bestRemoved = removed;
        bestCombo = combo.slice();
      }
      for (let m = meldIdx; m < allMelds.length; ++m) {
        const meld = allMelds[m];
        let overlaps = false;
        for (const idx of meld) {
          if (used.has(idx)) { overlaps = true; break; }
        }
        if (overlaps) continue;
        for (const idx of meld) used.add(idx);
        combo.push(m);
        search(m + 1, used, combo);
        combo.pop();
        for (const idx of meld) used.delete(idx);
      }
    }

    search(0, new Set(), []);

    const usedIndices = new Set();
    const meldGroups = [];
    for (const mi of bestCombo) {
      const meld = allMelds[mi];
      meldGroups.push(meld.slice());
      for (const i of meld) usedIndices.add(i);
    }
    return { melds: meldGroups, indices: usedIndices };
  }

  /* Find the single best meld to play (for AI incremental melding) */
  function findBestSingleMeld(hand) {
    const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
    if (allMelds.length === 0) return null;
    let best = null;
    let bestVal = 0;
    for (const m of allMelds) {
      let val = 0;
      for (const idx of m) val += cardPenalty(hand[idx]);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  /* ── Hint: does this card participate in a potential meld or lay-off? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];

    // Check for 2+ cards of the same rank (potential set)
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run potential (2+ consecutive same suit)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit === card.suit) suitCards.push(rankIndex(hand[i]));
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

    // Check if card can lay off on existing table melds
    for (const tm of tableMelds)
      if (canLayOffOn(card, tm)) return true;

    return false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    const deck = CE.shuffle(CE.createDeck());
    hands = [[], [], []];
    discardPile = [];
    tableMelds = [];
    roundOver = false;
    phase = PHASE_DRAW;
    currentPlayer = 0;
    selectedIndices = [];
    resultMsg = '';
    aiTimer = 0;
    aiStep = 0;

    // Deal 7 cards each
    for (let i = 0; i < HAND_SIZE; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const card = deck.pop();
        if (p === 0) card.faceUp = true;
        hands[p].push(card);
      }

    // Start discard pile with one card
    const top = deck.pop();
    top.faceUp = true;
    discardPile.push(top);

    stockPile = deck;
    sortHand(hands[0]);

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), CANVAS_H - CE.CARD_H - 20, i * 0.06);
    }
  }

  /* ================================================================
     SCORING -- penalty-based (lowest cumulative penalty wins)
     ================================================================ */

  function computeRoundScores(winnerIdx) {
    // Winner scores 0 penalty; others score hand penalty
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === winnerIdx) continue;
      let penalty = 0;
      for (const c of hands[p]) penalty += cardPenalty(c);
      penaltyScores[p] += penalty;

      if (_host && p !== 0) {
        const label = '+' + penalty + ' penalty';
        _host.floatingText.add(CANVAS_W / 2, 180 + p * 30, PLAYER_NAMES[p] + ': ' + label, { color: '#f88', size: 14 });
      }
    }

    // Player sees own penalty (which is cumulative)
    if (winnerIdx !== 0 && _host) {
      let penalty = 0;
      for (const c of hands[0]) penalty += cardPenalty(c);
      _host.floatingText.add(CANVAS_W / 2, 280, '+' + penalty + ' penalty', { color: '#f44', size: 18 });
    } else if (winnerIdx === 0 && _host) {
      _host.floatingText.add(CANVAS_W / 2, 280, 'You went out!', { color: '#4f4', size: 18 });
      _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      _host.particles.confetti(CANVAS_W / 2, 300, 20);
    }

    // For host score, report player's cumulative penalty (lower is better)
    score = penaltyScores[0];
    if (_host) _host.onScoreChanged(score);

    // Check game over -- anyone at or above penalty limit
    let anyOver = false;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (penaltyScores[p] >= PENALTY_LIMIT)
        anyOver = true;
    }

    roundOver = true;

    if (anyOver) {
      gameOver = true;
      // Winner is the player with the lowest cumulative penalty
      let bestP = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (penaltyScores[p] < penaltyScores[bestP])
          bestP = p;
      }
      if (bestP === 0) {
        resultMsg = 'You win! Penalties: ' + penaltyScores.join(' / ');
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 200, 'YOU WIN!', { color: '#4f4', size: 32 });
          _host.particles.confetti(CANVAS_W / 2, 300, 30);
        }
      } else {
        resultMsg = PLAYER_NAMES[bestP] + ' wins! Penalties: ' + penaltyScores.join(' / ');
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 200, 'GAME OVER', { color: '#f44', size: 32 });
          _host.screenShake.trigger(6, 300);
        }
      }
    } else {
      resultMsg = 'Round over! Penalties: ' + penaltyScores.join(' / ') + ' \u2014 click to continue';
    }

    phase = PHASE_ROUND_OVER;
  }

  function endRound(winnerIdx) {
    computeRoundScores(winnerIdx);
  }

  /* ================================================================
     STOCK EXHAUSTED
     ================================================================ */

  function checkStockExhausted() {
    if (stockPile.length === 0 && discardPile.length <= 1) {
      // No cards left at all -- end round, no winner (everyone penalized)
      endRound(-1);
      return true;
    }
    if (stockPile.length === 0) {
      // Reshuffle all but top discard card back into stock
      const top = discardPile.pop();
      stockPile = CE.shuffle(discardPile);
      for (const c of stockPile) c.faceUp = false;
      discardPile = [top];
    }
    return false;
  }

  /* ================================================================
     PLAYER ACTIONS
     ================================================================ */

  function playerDrawStock() {
    if (checkStockExhausted()) return;
    const card = stockPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    sortHand(hands[0]);
    selectedIndices = [];
    phase = PHASE_MELD;
    if (_host) _host.dealCardAnim(card, STOCK_X, STOCK_Y, playerCardX(hands[0].length - 1, hands[0].length), CANVAS_H - CE.CARD_H - 20, 0);
  }

  function playerDrawFromDiscard() {
    if (discardPile.length === 0) return;
    const card = discardPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    sortHand(hands[0]);
    selectedIndices = [];
    phase = PHASE_MELD;
    if (_host) _host.dealCardAnim(card, DISCARD_X, DISCARD_Y, playerCardX(hands[0].length - 1, hands[0].length), CANVAS_H - CE.CARD_H - 20, 0);
  }

  function playerMeld() {
    if (selectedIndices.length < 3) return;
    const cards = selectedIndices.map(i => hands[0][i]);
    if (!isValidMeld(cards)) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Invalid meld!', { color: '#f88', size: 14 });
      return;
    }
    // Remove from hand (descending order to preserve indices)
    const sorted = selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted) hands[0].splice(idx, 1);

    tableMelds.push({ cards, owner: 0 });
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) {
      _host.floatingText.add(CANVAS_W / 2, 400, 'Meld placed!', { color: '#4f4', size: 16 });
      _host.triggerChipSparkle(CANVAS_W / 2, MELD_AREA_Y + 40);
    }

    // Check if hand is empty -- must still discard last card to go out
    if (hands[0].length === 0) {
      endRound(0);
      return;
    }
  }

  function playerLayOff() {
    if (selectedIndices.length !== 1) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Select 1 card to lay off', { color: '#f88', size: 14 });
      return;
    }
    const card = hands[0][selectedIndices[0]];
    const target = findLayOffTarget(card);
    if (target < 0) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Cannot lay off here!', { color: '#f88', size: 14 });
      return;
    }
    hands[0].splice(selectedIndices[0], 1);
    tableMelds[target].cards.push(card);
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Laid off!', { color: '#4f4', size: 14 });

    if (hands[0].length === 0) {
      endRound(0);
      return;
    }
  }

  function playerDiscard() {
    if (selectedIndices.length !== 1) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Select 1 card to discard', { color: '#f88', size: 14 });
      return;
    }
    const card = hands[0].splice(selectedIndices[0], 1)[0];
    card.faceUp = true;
    discardPile.push(card);
    selectedIndices = [];
    sortHand(hands[0]);

    // Going out: empty hand after discarding
    if (hands[0].length === 0) {
      endRound(0);
      return;
    }

    // Next player
    currentPlayer = 1;
    phase = PHASE_AI_THINKING;
    aiTimer = 0;
    aiStep = 0;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiShouldDrawDiscard(p) {
    if (discardPile.length === 0) return false;
    const top = discardPile[discardPile.length - 1];
    // Check if top card completes a meld in hand
    const testHand = hands[p].concat(top);
    const before = findBestSingleMeld(hands[p]);
    const after = findBestSingleMeld(testHand);
    if (after && !before) return true;
    if (after && before) {
      let afterVal = 0, beforeVal = 0;
      for (const idx of after) afterVal += cardPenalty(testHand[idx]);
      for (const idx of before) beforeVal += cardPenalty(hands[p][idx]);
      if (afterVal > beforeVal) return true;
    }
    return false;
  }

  function aiDraw(p) {
    if (aiShouldDrawDiscard(p) && discardPile.length > 0) {
      const card = discardPile.pop();
      card.faceUp = false;
      hands[p].push(card);
    } else {
      if (checkStockExhausted()) return;
      const card = stockPile.pop();
      hands[p].push(card);
    }
  }

  function aiMeldAll(p) {
    // Repeatedly find and lay melds until none remain
    let melded = true;
    while (melded) {
      melded = false;
      const meldIndices = findBestSingleMeld(hands[p]);
      if (meldIndices && meldIndices.length >= 3) {
        const cards = meldIndices.map(i => hands[p][i]);
        if (isValidMeld(cards)) {
          const sorted = meldIndices.slice().sort((a, b) => b - a);
          for (const idx of sorted) hands[p].splice(idx, 1);
          tableMelds.push({ cards, owner: p });
          melded = true;

          if (_host) _host.floatingText.add(CANVAS_W / 2, 180, PLAYER_NAMES[p] + ' melds!', { color: '#fa0', size: 14 });
        }
      }
    }

    // Try lay offs
    let laidOff = true;
    while (laidOff) {
      laidOff = false;
      for (let i = hands[p].length - 1; i >= 0; --i) {
        const target = findLayOffTarget(hands[p][i]);
        if (target >= 0) {
          const card = hands[p].splice(i, 1)[0];
          tableMelds[target].cards.push(card);
          laidOff = true;
          if (_host) _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' lays off', { color: '#fa0', size: 12 });
        }
      }
    }
  }

  function aiDiscard(p) {
    if (hands[p].length === 0) return;
    // Discard highest-penalty card that doesn't help the hand
    // Try discarding each card, pick the one that leaves the most meld potential with lowest remaining penalty
    let bestIdx = 0;
    let bestPenalty = -1;
    for (let i = 0; i < hands[p].length; ++i) {
      const testHand = hands[p].filter((_, j) => j !== i);
      const result = findBestMelds(testHand);
      // Remaining penalty after removing best melds
      let remaining = 0;
      for (let j = 0; j < testHand.length; ++j) {
        if (!result.indices.has(j)) remaining += cardPenalty(testHand[j]);
      }
      // We want to discard the card whose removal leaves the lowest remaining penalty
      // But we also want to discard high-value cards when they're useless
      // So: discard the card where (cardPenalty of discarded) is highest AND remaining is lowest
      const discardValue = cardPenalty(hands[p][i]);
      const score = discardValue * 2 - remaining; // heuristic
      if (score > bestPenalty) {
        bestPenalty = score;
        bestIdx = i;
      }
    }

    const card = hands[p].splice(bestIdx, 1)[0];
    card.faceUp = true;
    discardPile.push(card);
  }

  function aiTakeTurn(p) {
    if (aiStep === 0) {
      aiDraw(p);
      if (roundOver) return;
      ++aiStep;
      aiTimer = 0;
      return;
    }

    if (aiStep === 1) {
      aiMeldAll(p);
      if (hands[p].length === 0) {
        endRound(p);
        return;
      }
      ++aiStep;
      aiTimer = 0;
      return;
    }

    if (aiStep === 2) {
      aiDiscard(p);
      if (hands[p].length === 0) {
        endRound(p);
        return;
      }

      // Advance to next player
      const next = (p + 1) % NUM_PLAYERS;
      if (next === 0) {
        currentPlayer = 0;
        phase = PHASE_DRAW;
        selectedIndices = [];
        if (checkStockExhausted()) return;
      } else {
        currentPlayer = next;
        aiStep = 0;
        aiTimer = 0;
      }
    }
  }

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 700;
    const spacing = Math.min(55, maxWidth / Math.max(total, 1));
    const startX = (CANVAS_W - spacing * (total - 1) - CE.CARD_W) / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawStraightRummy() {
    // Score panel (penalty scores -- lower is better)
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, CANVAS_W - 195, 5, 185, 80, 6);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Penalties (game over at ' + PENALTY_LIMIT + ')', CANVAS_W - 187, 10);
    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], CANVAS_W - 187, 28 + p * 16);
      _ctx.textAlign = 'right';
      _ctx.fillText('' + penaltyScores[p], CANVAS_W - 18, 28 + p * 16);
    }
    _ctx.restore();

    if (phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    // AI hands (face down) at top
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const startX = p === 1 ? 30 : CANVAS_W / 2 + 50;
      const label = PLAYER_NAMES[p] + ' (' + hands[p].length + ')';
      _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(label, startX, 15);
      for (let i = 0; i < hands[p].length; ++i)
        CE.drawCardBack(_ctx, startX + i * 22, 28, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Stock pile
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 10);
    if (stockPile.length > 0) {
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);
      _ctx.fillText('' + stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 12);
    } else
      CE.drawEmptySlot(_ctx, STOCK_X, STOCK_Y);

    // Discard pile
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 10);
    if (discardPile.length > 0) {
      const showCount = Math.min(discardPile.length, 4);
      const startIdx = discardPile.length - showCount;
      for (let i = startIdx; i < discardPile.length; ++i) {
        const offset = (i - startIdx) * 16;
        CE.drawCardFace(_ctx, DISCARD_X + offset, DISCARD_Y, discardPile[i]);
      }
      // Clickable highlight in DRAW phase
      if (phase === PHASE_DRAW) {
        _ctx.fillStyle = 'rgba(255,255,0,0.15)';
        const lastX = DISCARD_X + (showCount - 1) * 16;
        CE.drawRoundedRect(_ctx, lastX - 1, DISCARD_Y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.fill();
      }
    } else
      CE.drawEmptySlot(_ctx, DISCARD_X, DISCARD_Y);

    // Table melds
    drawTableMelds();

    // Action buttons (only during player's turn)
    if (currentPlayer === 0) {
      if (phase === PHASE_DRAW) {
        CE.drawButton(_ctx, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h, 'Draw', { bg: '#1a3a1a', border: '#4a4' });
      } else if (phase === PHASE_MELD) {
        if (selectedIndices.length >= 3)
          CE.drawButton(_ctx, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h, 'Meld', { bg: '#2a2a5a', border: '#88f' });
        if (selectedIndices.length === 1 && findLayOffTarget(hands[0][selectedIndices[0]]) >= 0)
          CE.drawButton(_ctx, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h, 'Lay Off', { bg: '#3a3a1a', border: '#cc8' });
        CE.drawButton(_ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#3a1a1a', border: '#c44' });
      } else if (phase === PHASE_DISCARD) {
        if (selectedIndices.length === 1)
          CE.drawButton(_ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#3a1a1a', border: '#c44' });
      }
    }

    // Player hand at bottom
    drawPlayerHand();

    // Phase prompts
    _ctx.textAlign = 'center';
    _ctx.font = '13px sans-serif';
    if (currentPlayer === 0) {
      if (phase === PHASE_DRAW) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Draw from Stock or Discard pile', CANVAS_W / 2, CANVAS_H - 8);
      } else if (phase === PHASE_MELD) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Select cards to Meld/Lay Off, or Discard to end turn', CANVAS_W / 2, CANVAS_H - 8);
      } else if (phase === PHASE_DISCARD) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Select a card and click Discard', CANVAS_W / 2, CANVAS_H - 8);
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
      _ctx.fillText('Table Melds', MELD_AREA_X + 150, MELD_AREA_Y - 4);
      _ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, MELD_AREA_X, MELD_AREA_Y, 580, 80, 6);
      _ctx.stroke();
      return;
    }

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Table Melds:', MELD_AREA_X, MELD_AREA_Y - 4);

    let mx = MELD_AREA_X;
    let my = MELD_AREA_Y + 4;
    const cardScale = 0.6;
    const cw = CE.CARD_W * cardScale;
    const ch = CE.CARD_H * cardScale;
    const cardSpacing = 32;
    const meldGap = 14;

    for (let m = 0; m < tableMelds.length; ++m) {
      const meld = tableMelds[m];
      // Wrap to next row if needed
      if (mx + meld.cards.length * cardSpacing + cw > CANVAS_W - 10) {
        mx = MELD_AREA_X;
        my += ch + 8;
      }

      // Owner indicator
      const ownerColor = meld.owner === 0 ? '#8f8' : '#fa0';
      _ctx.fillStyle = ownerColor;
      _ctx.font = '8px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(PLAYER_NAMES[meld.owner], mx + (meld.cards.length * cardSpacing) / 2, my - 2);

      for (let c = 0; c < meld.cards.length; ++c) {
        const card = meld.cards[c];
        card.faceUp = true;
        CE.drawCardFace(_ctx, mx + c * cardSpacing, my, card, cw, ch);
      }
      mx += meld.cards.length * cardSpacing + meldGap;
    }
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    // Hand penalty
    let handPenalty = 0;
    for (const c of hand) handPenalty += cardPenalty(c);

    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Hand (penalty: ' + handPenalty + ')', 80, CANVAS_H - CE.CARD_H - 38);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isSelected = selectedIndices.includes(i);
      const y = isSelected ? (CANVAS_H - CE.CARD_H - 35) : (CANVAS_H - CE.CARD_H - 20);

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow
      if (_host && _host.hintsEnabled && currentPlayer === 0 && (phase === PHASE_MELD || phase === PHASE_DRAW) && cardHasHint(hand, i))
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
    _ctx.save();
    const pw = 380;
    const ph = 280;
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

    // Round breakdown
    _ctx.font = '12px sans-serif';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Hand Penalty  |  Total Penalty', CANVAS_W / 2, py + 44);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 68 + p * 28;
      let handPenalty = 0;
      for (const c of hands[p]) handPenalty += cardPenalty(c);

      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 16, y);
      _ctx.textAlign = 'center';
      _ctx.fillStyle = handPenalty === 0 ? '#4f4' : '#f88';
      _ctx.fillText(handPenalty === 0 ? 'Out!' : '+' + handPenalty, px + 170, y);
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'right';
      _ctx.fillText('' + penaltyScores[p], px + pw - 24, y);
    }

    // Result message
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(resultMsg, CANVAS_W / 2, py + ph - 55);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 22);
    _ctx.restore();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const x = playerCardX(i, total);
      const isSelected = selectedIndices.includes(i);
      const y = isSelected ? (CANVAS_H - CE.CARD_H - 35) : (CANVAS_H - CE.CARD_H - 20);
      const rightEdge = i === total - 1 ? x + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      penaltyScores = [0, 0, 0];
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawStraightRummy();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          penaltyScores = [0, 0, 0];
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

      // DRAW phase
      if (phase === PHASE_DRAW) {
        // Click stock
        if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
          playerDrawStock();
          return;
        }
        // Click discard pile (take top card only)
        if (discardPile.length > 0) {
          const showCount = Math.min(discardPile.length, 4);
          const lastOffset = (showCount - 1) * 16;
          if (CE.isInRect(mx, my, DISCARD_X + lastOffset, DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
            playerDrawFromDiscard();
            return;
          }
        }
        // Click Draw button
        if (CE.isInRect(mx, my, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h)) {
          playerDrawStock();
          return;
        }
        return;
      }

      // MELD phase
      if (phase === PHASE_MELD) {
        // Meld button
        if (selectedIndices.length >= 3 && CE.isInRect(mx, my, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h)) {
          playerMeld();
          return;
        }
        // Lay Off button
        if (selectedIndices.length === 1 && CE.isInRect(mx, my, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h)) {
          playerLayOff();
          return;
        }
        // Discard button (transitions to DISCARD phase or discards if 1 selected)
        if (CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
          if (selectedIndices.length === 1)
            playerDiscard();
          else {
            selectedIndices = [];
            phase = PHASE_DISCARD;
          }
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

      // DISCARD phase
      if (phase === PHASE_DISCARD) {
        // Discard button with selection
        if (selectedIndices.length === 1 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
          playerDiscard();
          return;
        }
        // Click hand card to select for discard
        const idx = hitTestPlayerCard(mx, my);
        if (idx >= 0) {
          if (selectedIndices.length === 1 && selectedIndices[0] === idx) {
            // Double click = discard
            playerDiscard();
          } else
            selectedIndices = [idx];
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

      if (e.key === 'm' || e.key === 'M') {
        if (phase === PHASE_MELD && selectedIndices.length >= 3)
          playerMeld();
      } else if (e.key === 'l' || e.key === 'L') {
        if (phase === PHASE_MELD && selectedIndices.length === 1)
          playerLayOff();
      } else if (e.key === 'd' || e.key === 'D') {
        if ((phase === PHASE_MELD || phase === PHASE_DISCARD) && selectedIndices.length === 1)
          playerDiscard();
        else if (phase === PHASE_MELD) {
          selectedIndices = [];
          phase = PHASE_DISCARD;
        }
      } else if (e.key === 'Escape') {
        selectedIndices = [];
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
      penaltyScores = [0, 0, 0];
      selectedIndices = [];
      roundOver = false;
      gameOver = false;
      phase = PHASE_DRAW;
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

  SZ.CardGames.registerVariant('rummy', module);

})();
