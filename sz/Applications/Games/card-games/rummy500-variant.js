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
  const WIN_SCORE = 500;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2'];

  /* ── Phases ── */
  const PHASE_DRAW = 0;
  const PHASE_MELD = 1;
  const PHASE_DISCARD = 2;
  const PHASE_AI_THINKING = 3;
  const PHASE_ROUND_OVER = 4;
  const PHASE_DISCARD_PICK = 5;

  /* ── Card point values for scoring ── */
  function cardPoints(card) {
    if (card.suit === 'joker') return 15;
    if (card.rank === 'A') return 15;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function rankIndex(card) {
    if (card.suit === 'joker') return -1;
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
  const DRAW_BTN   = { x: 30,  y: 340, w: BTN_W, h: BTN_H };
  const MELD_BTN   = { x: 120, y: 340, w: BTN_W, h: BTN_H };
  const LAYOFF_BTN = { x: 210, y: 340, w: BTN_W, h: BTN_H };
  const DISCARD_BTN = { x: 300, y: 340, w: BTN_W, h: BTN_H };

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], []];
  let stockPile = [];
  let discardPile = [];
  let tableMelds = [];           // [{cards:[], owner:int}]
  let cumulScores = [0, 0, 0];
  let roundMeldPoints = [0, 0, 0];
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
     DECK CREATION (52 + 2 jokers)
     ================================================================ */

  function createRummy500Deck() {
    const deck = CE.createDeck();
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    return deck;
  }

  /* ================================================================
     HAND SORTING
     ================================================================ */

  function sortHand(hand) {
    hand.sort((a, b) => {
      if (a.suit === 'joker' && b.suit === 'joker') return 0;
      if (a.suit === 'joker') return 1;
      if (b.suit === 'joker') return -1;
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return rankIndex(a) - rankIndex(b);
    });
  }

  /* ================================================================
     JOKER DRAWING
     ================================================================ */

  function drawJokerFace(cx, x, y, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    CE.drawRoundedRect(cx, x, y, cw, ch, cr);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    // Purple inner
    const m = 4;
    CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
    cx.fillStyle = '#6a0dad';
    cx.fill();

    // Star symbol
    const ss = Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    cx.fillStyle = '#ffd700';
    cx.font = 'bold ' + Math.round(28 * ss) + 'px serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText('\u2605', x + cw / 2, y + ch / 2 - 4 * ss);

    cx.fillStyle = '#fff';
    cx.font = 'bold ' + Math.round(10 * ss) + 'px sans-serif';
    cx.fillText('JOKER', x + cw / 2, y + ch / 2 + 16 * ss);
  }

  function drawCardAuto(cx, x, y, card, w, h) {
    if (!card.faceUp) {
      CE.drawCardBack(cx, x, y, w, h);
      return;
    }
    if (card.suit === 'joker')
      drawJokerFace(cx, x, y, w, h);
    else
      CE.drawCardFace(cx, x, y, card, w, h);
  }

  /* ================================================================
     MELD VALIDATION
     ================================================================ */

  function isJoker(card) {
    return card.suit === 'joker';
  }

  /* Check if cards form a valid set (3-4 same rank, jokers fill gaps) */
  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const nonJokers = cards.filter(c => !isJoker(c));
    if (nonJokers.length === 0) return false;
    const rank = nonJokers[0].rank;
    for (const c of nonJokers)
      if (c.rank !== rank) return false;
    // Check for duplicate suits among non-jokers
    const suits = new Set();
    for (const c of nonJokers) {
      if (suits.has(c.suit)) return false;
      suits.add(c.suit);
    }
    return true;
  }

  /* Check if cards form a valid run (3+ consecutive same suit, jokers fill gaps) */
  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const nonJokers = cards.filter(c => !isJoker(c));
    if (nonJokers.length === 0) return false;
    // All non-jokers must be same suit
    const suit = nonJokers[0].suit;
    for (const c of nonJokers)
      if (c.suit !== suit) return false;

    // Sort non-jokers by rank
    const sorted = nonJokers.slice().sort((a, b) => rankIndex(a) - rankIndex(b));
    const jokerCount = cards.length - nonJokers.length;
    let jokersUsed = 0;

    // Build the sequence
    let prev = rankIndex(sorted[0]);
    for (let i = 1; i < sorted.length; ++i) {
      const cur = rankIndex(sorted[i]);
      const gap = cur - prev - 1;
      if (gap < 0) return false; // duplicate rank
      jokersUsed += gap;
      if (jokersUsed > jokerCount) return false;
      prev = cur;
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
      if (isJoker(hand[i])) continue;
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const results = [];
    for (const rank in byRank) {
      if (byRank[rank].length >= 3)
        results.push(byRank[rank].slice(0, Math.min(byRank[rank].length, 4)));
      else if (byRank[rank].length === 2) {
        // Check if a joker can complete it
        const jokerIdx = hand.findIndex(c => isJoker(c));
        if (jokerIdx >= 0 && !byRank[rank].includes(jokerIdx))
          results.push([...byRank[rank], jokerIdx]);
      }
    }
    return results;
  }

  function findAllRuns(hand) {
    const bySuit = {};
    for (let i = 0; i < hand.length; ++i) {
      if (isJoker(hand[i])) continue;
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
        else if (run.length === 2) {
          // Try adding a joker
          const jokerIdx = hand.findIndex((c, idx) => isJoker(c) && !run.includes(idx));
          if (jokerIdx >= 0)
            results.push([...run, jokerIdx]);
        }
      }
    }
    return results;
  }

  function findBestMeld(hand) {
    const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
    if (allMelds.length === 0) return null;
    // Pick highest-value meld
    let best = null;
    let bestVal = 0;
    for (const m of allMelds) {
      let val = 0;
      for (const idx of m) val += cardPoints(hand[idx]);
      if (val > bestVal) {
        bestVal = val;
        best = m;
      }
    }
    return best;
  }

  /* ── Hint: does this card participate in a potential meld? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];
    if (isJoker(card)) return true; // jokers always useful

    // Check for 2+ same rank
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (!isJoker(hand[i]) && hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run potential (2+ consecutive same suit)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (!isJoker(hand[i]) && hand[i].suit === card.suit)
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

    // Check if card can lay off on existing table melds
    for (const tm of tableMelds)
      if (canLayOffOn(card, tm)) return true;

    return false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    const deck = CE.shuffle(createRummy500Deck());
    hands = [[], [], []];
    discardPile = [];
    tableMelds = [];
    roundMeldPoints = [0, 0, 0];
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
     SCORING
     ================================================================ */

  function computeRoundScores(emptierIdx) {
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      let handPenalty = 0;
      for (const c of hands[p]) handPenalty += cardPoints(c);
      const net = roundMeldPoints[p] - handPenalty;
      cumulScores[p] += net;

      if (_host && p === 0) {
        const label = (net >= 0 ? '+' : '') + net + ' pts';
        const color = net >= 0 ? '#4f4' : '#f44';
        _host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 18 });
      }
    }

    score = cumulScores[0];
    if (_host) _host.onScoreChanged(score);

    // Check game over
    let anyWin = false;
    let winnerIdx = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (cumulScores[p] >= WIN_SCORE) {
        anyWin = true;
        if (winnerIdx < 0 || cumulScores[p] > cumulScores[winnerIdx])
          winnerIdx = p;
      }
    }

    roundOver = true;

    if (anyWin) {
      gameOver = true;
      if (winnerIdx === 0) {
        resultMsg = 'You win! Final: ' + cumulScores.join(' / ');
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 200, 'YOU WIN!', { color: '#4f4', size: 32 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
          _host.particles.confetti(CANVAS_W / 2, 300, 30);
        }
      } else {
        resultMsg = PLAYER_NAMES[winnerIdx] + ' wins! Final: ' + cumulScores.join(' / ');
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 200, 'GAME OVER', { color: '#f44', size: 32 });
          _host.screenShake.trigger(6, 300);
        }
      }
    } else {
      resultMsg = 'Round over! Scores: ' + cumulScores.join(' / ') + ' \u2014 click to continue';
    }

    phase = PHASE_ROUND_OVER;
  }

  function endRound(emptierIdx) {
    computeRoundScores(emptierIdx);
  }

  /* ================================================================
     CHECK STOCK EXHAUSTED
     ================================================================ */

  function checkStockExhausted() {
    if (stockPile.length === 0 && discardPile.length <= 1) {
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

  function playerDrawFromDiscard(upToIdx) {
    // Must take from upToIdx to top, and immediately use the deepest card
    const taken = discardPile.splice(upToIdx);
    for (const c of taken) {
      c.faceUp = true;
      hands[0].push(c);
    }
    sortHand(hands[0]);
    selectedIndices = [];
    phase = PHASE_MELD;
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

    let pts = 0;
    for (const c of cards) pts += cardPoints(c);
    roundMeldPoints[0] += pts;

    tableMelds.push({ cards, owner: 0 });
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) {
      _host.floatingText.add(CANVAS_W / 2, 400, '+' + pts + ' melded!', { color: '#4f4', size: 16 });
      _host.triggerChipSparkle(CANVAS_W / 2, MELD_AREA_Y + 40);
    }

    // Check if hand is empty
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

    const pts = cardPoints(card);
    roundMeldPoints[0] += pts;
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) _host.floatingText.add(CANVAS_W / 2, 400, '+' + pts + ' laid off!', { color: '#4f4', size: 14 });

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
    const before = findBestMeld(hands[p]);
    const after = findBestMeld(testHand);
    if (after && !before) return true;
    if (after && before) {
      let afterVal = 0, beforeVal = 0;
      for (const idx of after) afterVal += cardPoints(testHand[idx]);
      for (const idx of before) beforeVal += cardPoints(hands[p][idx]);
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
      const meldIndices = findBestMeld(hands[p]);
      if (meldIndices && meldIndices.length >= 3) {
        const cards = meldIndices.map(i => hands[p][i]);
        if (isValidMeld(cards)) {
          const sorted = meldIndices.slice().sort((a, b) => b - a);
          for (const idx of sorted) hands[p].splice(idx, 1);
          let pts = 0;
          for (const c of cards) pts += cardPoints(c);
          roundMeldPoints[p] += pts;
          tableMelds.push({ cards, owner: p });
          melded = true;

          if (_host) _host.floatingText.add(CANVAS_W / 2, 180, PLAYER_NAMES[p] + ' melds +' + pts, { color: '#fa0', size: 14 });
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
          roundMeldPoints[p] += cardPoints(card);
          laidOff = true;
        }
      }
    }
  }

  function aiDiscard(p) {
    if (hands[p].length === 0) return -1;
    // Discard highest-value unmatched card
    // Simple: find card with highest point value that isn't part of a potential meld
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < hands[p].length; ++i) {
      const v = cardPoints(hands[p][i]);
      if (v > bestVal) {
        bestVal = v;
        bestIdx = i;
      }
    }

    // Prefer discarding cards that don't help the next player
    // Simple heuristic: discard the highest card
    const card = hands[p].splice(bestIdx, 1)[0];
    card.faceUp = true;
    discardPile.push(card);
    return bestIdx;
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
    const spacing = Math.min(55, (maxWidth) / Math.max(total, 1));
    const startX = (CANVAS_W - spacing * (total - 1) - CE.CARD_W) / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawRummy500() {
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
      _ctx.fillText('' + cumulScores[p], CANVAS_W - 18, 28 + p * 16);
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

    // Discard pile (fan last few cards)
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 10);
    if (discardPile.length > 0) {
      const showCount = Math.min(discardPile.length, 4);
      const startIdx = discardPile.length - showCount;
      for (let i = startIdx; i < discardPile.length; ++i) {
        const offset = (i - startIdx) * 16;
        drawCardAuto(_ctx, DISCARD_X + offset, DISCARD_Y, discardPile[i]);
      }
      // Clickable highlight in DRAW phase or DISCARD_PICK
      if (phase === PHASE_DRAW || phase === PHASE_DISCARD_PICK) {
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
        drawCardAuto(_ctx, mx + c * cardSpacing, my, card, cw, ch);
      }
      mx += meld.cards.length * cardSpacing + meldGap;
    }
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    _ctx.fillStyle = '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    const meldPts = roundMeldPoints[0];
    _ctx.fillText('Your Hand' + (meldPts > 0 ? ' (melded: ' + meldPts + ' pts)' : ''), 80, CANVAS_H - CE.CARD_H - 38);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isSelected = selectedIndices.includes(i);
      const y = isSelected ? (CANVAS_H - CE.CARD_H - 35) : (CANVAS_H - CE.CARD_H - 20);

      drawCardAuto(_ctx, x, y, hand[i]);

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
    const pw = 360;
    const ph = 260;
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
    _ctx.fillText('Melded  |  Hand  |  Net  |  Total', CANVAS_W / 2, py + 44);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 68 + p * 28;
      let handPenalty = 0;
      for (const c of hands[p]) handPenalty += cardPoints(c);
      const net = roundMeldPoints[p] - handPenalty;

      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 16, y);
      _ctx.textAlign = 'center';
      _ctx.fillText('' + roundMeldPoints[p], px + 130, y);
      _ctx.fillText('-' + handPenalty, px + 185, y);
      _ctx.fillStyle = net >= 0 ? '#4f4' : '#f44';
      _ctx.fillText((net >= 0 ? '+' : '') + net, px + 240, y);
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'right';
      _ctx.fillText('' + cumulScores[p], px + pw - 16, y);
    }

    // Result message
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(resultMsg, CANVAS_W / 2, py + ph - 50);

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
      cumulScores = [0, 0, 0];
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawRummy500();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          cumulScores = [0, 0, 0];
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
        // Click discard pile (take top card)
        if (discardPile.length > 0) {
          const showCount = Math.min(discardPile.length, 4);
          const lastOffset = (showCount - 1) * 16;
          if (CE.isInRect(mx, my, DISCARD_X + lastOffset, DISCARD_Y, CE.CARD_W, CE.CARD_H)) {
            playerDrawFromDiscard(discardPile.length - 1);
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
          if (selectedIndices.length === 1) {
            playerDiscard();
          } else {
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
          } else {
            selectedIndices = [idx];
          }
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
      cumulScores = [0, 0, 0];
      roundMeldPoints = [0, 0, 0];
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

  SZ.CardGames.registerVariant('rummy500', module);

})();
