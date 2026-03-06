;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const NUM_PLAYERS = 3;
  const HAND_SIZE = 9;
  const INITIAL_MELD_MIN = 51;
  const PENALTY_LIMIT = 200;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2'];

  /* ── Phases ── */
  const PHASE_DRAW = 0;
  const PHASE_MELD = 1;
  const PHASE_DISCARD = 2;
  const PHASE_AI_THINKING = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Layout ── */
  const STOCK_X = 30;
  const STOCK_Y = 220;
  const DISCARD_X = 130;
  const DISCARD_Y = 220;
  const MELD_AREA_X = 280;
  const MELD_AREA_Y = 130;

  const BTN_W = 80;
  const BTN_H = 28;
  const MELD_BTN = { x: 30, y: 345, w: BTN_W, h: BTN_H };
  const LAYOFF_BTN = { x: 120, y: 345, w: BTN_W, h: BTN_H };
  const DISCARD_BTN = { x: 210, y: 345, w: BTN_W, h: BTN_H };

  /* ── AI timing ── */
  const AI_DELAY = 0.8;

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let hands = [[], [], []];
  let stockPile = [];
  let discardPile = [];
  let tableMelds = [];            // [{cards:[], owner:int}]
  let cumulScores = [0, 0, 0];    // cumulative penalties per player
  let hasMelded = [false, false, false]; // initial meld tracker
  let noPriorMelds = [true, true, true]; // kalooki tracker (never melded before this turn)
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_DRAW;
  let currentPlayer = 0;
  let selectedIndices = [];
  let resultMsg = '';

  let aiTimer = 0;
  let aiStep = 0;                 // 0=draw, 1=meld/layoff, 2=discard
  let drewFromDiscard = false;

  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     CARD UTILITIES
     ══════════════════════════════════════════════════════════════════ */

  function isJoker(card) {
    return card.suit === 'joker';
  }

  function cardPenalty(card) {
    if (isJoker(card)) return 50;
    if (card.rank === 'A') return 11;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function cardMeldValue(card, substituteRank) {
    if (isJoker(card))
      return substituteRank ? meldValueOfRank(substituteRank) : 0;
    if (card.rank === 'A') return 11; // A counts as 11 in melds for initial threshold
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function meldValueOfRank(rank) {
    if (rank === 'A') return 11;
    if (rank === 'J' || rank === 'Q' || rank === 'K') return 10;
    const n = parseInt(rank);
    return isNaN(n) ? 0 : n;
  }

  function rankIndex(card) {
    if (isJoker(card)) return -1;
    return CE.RANKS.indexOf(card.rank);
  }

  function handPenalty(hand) {
    let total = 0;
    for (const c of hand) total += cardPenalty(c);
    return total;
  }

  /* ══════════════════════════════════════════════════════════════════
     DECK CREATION (52 + 2 jokers)
     ══════════════════════════════════════════════════════════════════ */

  function createKalookiDeck() {
    const deck = CE.createDeck();
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    deck.push({ suit: 'joker', rank: 'Joker', value: -1, faceUp: false, color: 'red' });
    return deck;
  }

  /* ══════════════════════════════════════════════════════════════════
     HAND SORTING
     ══════════════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════════════
     JOKER DRAWING
     ══════════════════════════════════════════════════════════════════ */

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

    const m = 4;
    CE.drawRoundedRect(cx, x + m, y + m, cw - m * 2, ch - m * 2, Math.max(cr - 1, 1));
    cx.fillStyle = '#6a0dad';
    cx.fill();

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
    if (isJoker(card))
      drawJokerFace(cx, x, y, w, h);
    else
      CE.drawCardFace(cx, x, y, card, w, h);
  }

  /* ══════════════════════════════════════════════════════════════════
     MELD VALIDATION
     ══════════════════════════════════════════════════════════════════ */

  function isValidSet(cards) {
    if (cards.length < 3 || cards.length > 4) return false;
    const nonJokers = cards.filter(c => !isJoker(c));
    if (nonJokers.length === 0) return false;
    const rank = nonJokers[0].rank;
    for (const c of nonJokers)
      if (c.rank !== rank) return false;
    const suits = new Set();
    for (const c of nonJokers) {
      if (suits.has(c.suit)) return false;
      suits.add(c.suit);
    }
    return true;
  }

  function isValidRun(cards) {
    if (cards.length < 3) return false;
    const nonJokers = cards.filter(c => !isJoker(c));
    if (nonJokers.length === 0) return false;
    const suit = nonJokers[0].suit;
    for (const c of nonJokers)
      if (c.suit !== suit) return false;

    const sorted = nonJokers.slice().sort((a, b) => rankIndex(a) - rankIndex(b));
    const jokerCount = cards.length - nonJokers.length;
    let jokersUsed = 0;
    let prev = rankIndex(sorted[0]);
    for (let i = 1; i < sorted.length; ++i) {
      const cur = rankIndex(sorted[i]);
      const gap = cur - prev - 1;
      if (gap < 0) return false;
      jokersUsed += gap;
      if (jokersUsed > jokerCount) return false;
      prev = cur;
    }
    return true;
  }

  function isValidMeld(cards) {
    return isValidSet(cards) || isValidRun(cards);
  }

  /* ── Calculate the meld point value (for initial meld threshold check) ── */
  function meldPointValue(cards) {
    let total = 0;
    const nonJokers = cards.filter(c => !isJoker(c));
    for (const c of nonJokers) total += cardMeldValue(c);

    // Jokers count as the card they substitute for
    if (isValidSet(cards)) {
      const rank = nonJokers[0].rank;
      const jokerCount = cards.length - nonJokers.length;
      total += jokerCount * meldValueOfRank(rank);
    } else if (isValidRun(cards)) {
      // Determine which ranks the jokers fill in
      const sorted = nonJokers.slice().sort((a, b) => rankIndex(a) - rankIndex(b));
      const occupiedRanks = new Set(sorted.map(c => rankIndex(c)));
      const minRank = rankIndex(sorted[0]);
      const maxNeeded = minRank + cards.length - 1;
      for (let r = minRank; r <= maxNeeded && r < CE.RANKS.length; ++r) {
        if (!occupiedRanks.has(r))
          total += meldValueOfRank(CE.RANKS[r]);
      }
    }
    return total;
  }

  /* ── Can a card be laid off on an existing meld? ── */
  function canLayOffOn(card, meld) {
    const testCards = meld.cards.concat(card);
    return isValidSet(testCards) || isValidRun(testCards);
  }

  /* ── Can a real card replace a joker in a meld? ── */
  function canReplaceJoker(card, meld) {
    if (isJoker(card)) return false;
    const jokerIdx = meld.cards.findIndex(c => isJoker(c));
    if (jokerIdx < 0) return false;
    // Try replacing the joker with the card
    const testCards = meld.cards.slice();
    testCards[jokerIdx] = card;
    return isValidSet(testCards) || isValidRun(testCards);
  }

  /* ══════════════════════════════════════════════════════════════════
     MELD DETECTION (AI + hints)
     ══════════════════════════════════════════════════════════════════ */

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
          const jokerIdx = hand.findIndex((c, idx) => isJoker(c) && !run.includes(idx));
          if (jokerIdx >= 0)
            results.push([...run, jokerIdx]);
        }
      }
    }
    return results;
  }

  function findBestMelds(hand) {
    const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
    if (allMelds.length === 0)
      return { melds: [], remaining: hand.slice(), penalty: handPenalty(hand) };

    let bestPenalty = Infinity;
    let bestCombo = [];

    function search(meldIdx, used, combo) {
      let pen = 0;
      for (let i = 0; i < hand.length; ++i)
        if (!used.has(i)) pen += cardPenalty(hand[i]);
      if (pen < bestPenalty) {
        bestPenalty = pen;
        bestCombo = combo.slice();
      }
      if (pen === 0) return;
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

    const meldCards = [];
    const usedIndices = new Set();
    for (const mi of bestCombo) {
      const meld = allMelds[mi];
      meldCards.push(meld.map(i => hand[i]));
      for (const i of meld) usedIndices.add(i);
    }
    const remaining = [];
    for (let i = 0; i < hand.length; ++i)
      if (!usedIndices.has(i)) remaining.push(hand[i]);
    return { melds: meldCards, remaining, penalty: bestPenalty };
  }

  /* ── Hint helper ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];
    // Check sets
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (!isJoker(hand[i]) && hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;
    if (isJoker(card)) return true; // jokers always hintable

    // Check runs
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (!isJoker(hand[i]) && hand[i].suit === card.suit)
        suitCards.push(rankIndex(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = rankIndex(card);
    for (let start = 0; start < suitCards.length; ++start) {
      let runLen = 1;
      let inRun = suitCards[start] === ci;
      for (let next = start + 1; next < suitCards.length; ++next) {
        if (suitCards[next] === suitCards[next - 1] + 1) {
          ++runLen;
          if (suitCards[next] === ci) inRun = true;
        } else
          break;
      }
      if (runLen >= 3 && inRun) return true;
    }

    // Check joker replacement opportunities on table melds
    for (const tm of tableMelds)
      if (canReplaceJoker(card, tm)) return true;

    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupKalooki() {
    const deck = CE.shuffle(createKalookiDeck());
    hands = [[], [], []];
    stockPile = [];
    discardPile = [];
    tableMelds = [];
    hasMelded = [false, false, false];
    noPriorMelds = [true, true, true];
    roundOver = false;
    phase = PHASE_DRAW;
    currentPlayer = 0;
    selectedIndices = [];
    resultMsg = '';
    aiTimer = 0;
    aiStep = 0;
    drewFromDiscard = false;

    for (let i = 0; i < HAND_SIZE; ++i) {
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        const c = deck.pop();
        if (p === 0) c.faceUp = true;
        hands[p].push(c);
      }
    }

    const top = deck.pop();
    top.faceUp = true;
    discardPile.push(top);

    stockPile = deck;
    sortHand(hands[0]);
  }

  /* ══════════════════════════════════════════════════════════════════
     STOCK REPLENISH
     ══════════════════════════════════════════════════════════════════ */

  function replenishStock() {
    if (stockPile.length > 0) return true;
    if (discardPile.length <= 1) return false;
    const top = discardPile.pop();
    stockPile = CE.shuffle(discardPile);
    for (const c of stockPile) c.faceUp = false;
    discardPile = [top];
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawKalooki() {
    // Scores
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    for (let p = 0; p < NUM_PLAYERS; ++p)
      _ctx.fillText(PLAYER_NAMES[p] + ': ' + cumulScores[p], 20, 18 + p * 18);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('First to ' + PENALTY_LIMIT + ' penalty loses', 20, 18 + NUM_PLAYERS * 18 + 4);

    if (phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    // AI hands (face down) at top
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const yOff = 80 + (p - 1) * 30;
      _ctx.fillStyle = '#fff';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + hands[p].length + ')', 280, yOff - 5);
      for (let i = 0; i < Math.min(hands[p].length, 13); ++i)
        CE.drawCardBack(_ctx, 280 + i * 20, yOff, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Stock pile
    if (stockPile.length > 0)
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
    else {
      _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
    }
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 14);
    _ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 8);

    // Discard pile
    if (discardPile.length > 0)
      drawCardAuto(_ctx, DISCARD_X, DISCARD_Y, discardPile[discardPile.length - 1], CE.CARD_W, CE.CARD_H);
    else {
      _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
    }
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 8);

    // Table melds
    drawTableMelds();

    // Player hand
    drawPlayerHand();

    // Buttons
    drawButtons();

    // Phase prompts
    drawPhasePrompt();
  }

  function drawTableMelds() {
    if (tableMelds.length === 0) return;
    _ctx.fillStyle = '#aaf';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Table Melds:', MELD_AREA_X, MELD_AREA_Y - 8);

    let mx = MELD_AREA_X;
    let my = MELD_AREA_Y;
    for (let m = 0; m < tableMelds.length; ++m) {
      const meld = tableMelds[m];
      for (let c = 0; c < meld.cards.length; ++c) {
        drawCardAuto(_ctx, mx, my, meld.cards[c], CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        mx += 32;
      }
      mx += 10;
      if (mx > CANVAS_W - 60) {
        mx = MELD_AREA_X;
        my += CE.CARD_H * 0.55 + 8;
      }
    }
  }

  function drawPlayerHand() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    const penVal = handPenalty(hands[0]);
    _ctx.fillText('Your Hand (penalty: ' + penVal + ')', 30, 400);
    if (!hasMelded[0]) {
      _ctx.fillStyle = '#f84';
      _ctx.font = '11px sans-serif';
      _ctx.fillText('Need ' + INITIAL_MELD_MIN + '+ to meld first', 250, 400);
    }

    const hand = hands[0];
    const spacing = Math.min(65, (CANVAS_W - 80) / Math.max(hand.length, 1));
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i]._dealing) continue;
      const x = 30 + i * spacing;
      const sel = selectedIndices.includes(i);
      const y = sel ? 408 : 418;
      drawCardAuto(_ctx, x, y, hand[i], CE.CARD_W * 0.9, CE.CARD_H * 0.9);
      if (_host && _host.hintsEnabled && cardHasHint(hand, i))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W * 0.9, CE.CARD_H * 0.9, _host.hintTime);
      if (sel) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W * 0.9 + 2, CE.CARD_H * 0.9 + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawButtons() {
    if (currentPlayer !== 0) return;

    if (phase === PHASE_DRAW) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click Stock or Discard to draw', CANVAS_W / 2, 380);
      return;
    }

    if (phase === PHASE_MELD) {
      CE.drawButton(_ctx, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h, 'Meld', { bg: '#3a5a0a', border: '#8c8' });
      CE.drawButton(_ctx, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h, 'Lay Off', { bg: '#3a3a5a', border: '#88c' });
      CE.drawButton(_ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#5a3a0a', border: '#cc8' });
    }
  }

  function drawPhasePrompt() {
    if (currentPlayer !== 0) {
      _ctx.fillStyle = '#ff8';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(PLAYER_NAMES[currentPlayer] + ' is thinking...', CANVAS_W / 2, 380);
      return;
    }
    if (phase === PHASE_MELD) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Select cards to Meld/Lay Off, or pick one to Discard', CANVAS_W / 2, 375);
    }
  }

  function drawRoundOver() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Round Over', CANVAS_W / 2, 100);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const yBase = 140 + p * 110;
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'left';
      const pen = handPenalty(hands[p]);
      _ctx.fillText(PLAYER_NAMES[p] + ' penalty: ' + pen + (hands[p].length === 0 ? ' (OUT!)' : ''), 30, yBase);

      let rx = 30;
      for (let i = 0; i < hands[p].length; ++i) {
        hands[p][i].faceUp = true;
        drawCardAuto(_ctx, rx, yBase + 10, hands[p][i], CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        rx += 34;
        if (rx > CANVAS_W - 60) {
          rx = 30;
          // no overflow expected for 9 cards
        }
      }
    }

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H - 40);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '13px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 18);
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawStock() {
    if (!replenishStock()) return;
    const card = stockPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    if (_host) _host.dealCardAnim(card, STOCK_X, STOCK_Y, 30 + (hands[0].length - 1) * 55, 418, 0);
    drewFromDiscard = false;
    phase = PHASE_MELD;
    selectedIndices = [];
  }

  function playerDrawDiscard() {
    if (discardPile.length === 0) return;
    const card = discardPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    if (_host) _host.dealCardAnim(card, DISCARD_X, DISCARD_Y, 30 + (hands[0].length - 1) * 55, 418, 0);
    drewFromDiscard = true;
    phase = PHASE_MELD;
    selectedIndices = [];
  }

  function playerMeld() {
    if (selectedIndices.length < 3) return;
    const cards = selectedIndices.map(i => hands[0][i]);
    if (!isValidMeld(cards)) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 380, 'Invalid meld!', { color: '#f44', size: 16 });
      return;
    }

    // Check initial meld threshold
    if (!hasMelded[0]) {
      const totalMeldValue = meldPointValue(cards);
      if (totalMeldValue < INITIAL_MELD_MIN) {
        if (_host) _host.floatingText.add(CANVAS_W / 2, 380, 'Need ' + INITIAL_MELD_MIN + '+ points! (got ' + totalMeldValue + ')', { color: '#f84', size: 14 });
        return;
      }
    }

    // Remove from hand (sort descending to splice safely)
    const sorted = selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted) hands[0].splice(idx, 1);

    for (const c of cards) c.faceUp = true;
    tableMelds.push({ cards, owner: 0 });
    hasMelded[0] = true;
    selectedIndices = [];
    sortHand(hands[0]);

    if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Meld!', { color: '#4f4', size: 18 });

    if (hands[0].length === 0) {
      endRound(0);
      return;
    }
  }

  function playerLayOff() {
    if (selectedIndices.length !== 1) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 380, 'Select 1 card to lay off', { color: '#f84', size: 14 });
      return;
    }
    if (!hasMelded[0]) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 380, 'Must meld first!', { color: '#f84', size: 14 });
      return;
    }

    const card = hands[0][selectedIndices[0]];

    // Try replacing a joker first
    for (const tm of tableMelds) {
      if (canReplaceJoker(card, tm)) {
        const jokerIdx = tm.cards.findIndex(c => isJoker(c));
        const joker = tm.cards[jokerIdx];
        tm.cards[jokerIdx] = card;
        card.faceUp = true;
        hands[0].splice(selectedIndices[0], 1);
        joker.faceUp = true;
        hands[0].push(joker); // joker goes to player's hand
        selectedIndices = [];
        sortHand(hands[0]);
        if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Joker replaced!', { color: '#ff0', size: 16 });
        if (hands[0].length === 0) endRound(0);
        return;
      }
    }

    // Try laying off on a meld
    for (const tm of tableMelds) {
      if (canLayOffOn(card, tm)) {
        card.faceUp = true;
        tm.cards.push(card);
        hands[0].splice(selectedIndices[0], 1);
        selectedIndices = [];
        sortHand(hands[0]);
        if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Laid off!', { color: '#8f8', size: 16 });
        if (hands[0].length === 0) endRound(0);
        return;
      }
    }

    if (_host) _host.floatingText.add(CANVAS_W / 2, 380, 'Cannot lay off here', { color: '#f84', size: 14 });
  }

  function playerDiscard() {
    if (selectedIndices.length !== 1) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 380, 'Select 1 card to discard', { color: '#f84', size: 14 });
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
    advanceTurn();
  }

  /* ══════════════════════════════════════════════════════════════════
     TURN MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function advanceTurn() {
    currentPlayer = (currentPlayer + 1) % NUM_PLAYERS;
    if (currentPlayer === 0)
      phase = PHASE_DRAW;
    else {
      phase = PHASE_AI_THINKING;
      aiTimer = 0;
      aiStep = 0;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiTakeTurn(p) {
    const hand = hands[p];

    if (aiStep === 0) {
      // Draw phase
      if (discardPile.length > 0 && aiShouldDrawDiscard(hand))
        hand.push(discardPile.pop());
      else if (replenishStock())
        hand.push(stockPile.pop());
      else if (discardPile.length > 0)
        hand.push(discardPile.pop());
      else
        return; // stuck
      aiStep = 1;
      aiTimer = 0;
      return;
    }

    if (aiStep === 1) {
      // Meld / lay off phase
      aiTryMelds(p);
      aiTryLayOffs(p);
      aiTryJokerReplace(p);

      if (hand.length === 0) {
        endRound(p);
        return;
      }

      aiStep = 2;
      aiTimer = 0;
      return;
    }

    // Discard phase
    const discIdx = aiChooseDiscard(hand);
    const card = hand.splice(discIdx, 1)[0];
    card.faceUp = true;
    discardPile.push(card);

    if (hand.length === 0) {
      endRound(p);
      return;
    }

    advanceTurn();
  }

  function aiShouldDrawDiscard(hand) {
    if (discardPile.length === 0) return false;
    const topDiscard = discardPile[discardPile.length - 1];
    const testHand = hand.concat(topDiscard);
    const before = findBestMelds(hand);
    const after = findBestMelds(testHand);
    return after.melds.length > before.melds.length || after.penalty < before.penalty - 3;
  }

  function aiTryMelds(p) {
    const hand = hands[p];
    let changed = true;
    while (changed) {
      changed = false;
      const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];
      for (const meldIndices of allMelds) {
        const cards = meldIndices.map(i => hand[i]);
        if (!isValidMeld(cards)) continue;

        if (!hasMelded[p]) {
          const val = meldPointValue(cards);
          if (val < INITIAL_MELD_MIN) continue;
        }

        const sorted = meldIndices.slice().sort((a, b) => b - a);
        for (const idx of sorted) hand.splice(idx, 1);
        for (const c of cards) c.faceUp = true;
        tableMelds.push({ cards, owner: p });
        hasMelded[p] = true;
        changed = true;
        if (_host) _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' melds!', { color: '#88f', size: 16 });
        break;
      }
    }
  }

  function aiTryLayOffs(p) {
    if (!hasMelded[p]) return;
    const hand = hands[p];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = hand.length - 1; i >= 0; --i) {
        if (isJoker(hand[i])) continue; // AI saves jokers
        for (const tm of tableMelds) {
          if (canLayOffOn(hand[i], tm)) {
            const card = hand.splice(i, 1)[0];
            card.faceUp = true;
            tm.cards.push(card);
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
  }

  function aiTryJokerReplace(p) {
    if (!hasMelded[p]) return;
    const hand = hands[p];
    for (let i = hand.length - 1; i >= 0; --i) {
      if (isJoker(hand[i])) continue;
      for (const tm of tableMelds) {
        if (canReplaceJoker(hand[i], tm)) {
          const jokerIdx = tm.cards.findIndex(c => isJoker(c));
          const joker = tm.cards[jokerIdx];
          tm.cards[jokerIdx] = hand[i];
          hand[i].faceUp = true;
          hand.splice(i, 1);
          hand.push(joker);
          if (_host) _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' replaces joker!', { color: '#ff8', size: 14 });
          return;
        }
      }
    }
  }

  function aiChooseDiscard(hand) {
    let bestIdx = 0;
    let bestPen = -1;
    for (let i = 0; i < hand.length; ++i) {
      // AI never discards jokers if avoidable
      if (isJoker(hand[i]) && hand.length > 1) continue;
      const pen = cardPenalty(hand[i]);
      // Prefer discarding high-penalty non-meldable cards
      const testHand = hand.filter((_, j) => j !== i);
      const result = findBestMelds(testHand);
      const value = pen * 2 + result.penalty;
      // Higher value = more desirable to discard (higher penalty card + remaining hand well off)
      // Actually we want to minimize remaining penalty but prefer discarding high-value deadwood
      const score = result.penalty;
      if (bestPen < 0 || score < bestPen || (score === bestPen && pen > cardPenalty(hand[bestIdx]))) {
        bestPen = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  /* ══════════════════════════════════════════════════════════════════
     ROUND RESOLUTION
     ══════════════════════════════════════════════════════════════════ */

  function endRound(winner) {
    roundOver = true;
    phase = PHASE_ROUND_OVER;

    const isKalooki = noPriorMelds[winner] && hands[winner].length === 0;
    const multiplier = isKalooki ? 2 : 1;

    let msgs = [];
    if (isKalooki) {
      msgs.push(PLAYER_NAMES[winner] + ' declares KALOOKI! Double penalty!');
      if (_host) _host.floatingText.add(CANVAS_W / 2, 250, 'KALOOKI!', { color: '#ff0', size: 32 });
    } else
      msgs.push(PLAYER_NAMES[winner] + ' goes out!');

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === winner) continue;
      const pen = handPenalty(hands[p]) * multiplier;
      cumulScores[p] += pen;
      msgs.push(PLAYER_NAMES[p] + ': +' + pen + ' penalty');
    }

    score = -cumulScores[0]; // lower penalty = higher score (negative penalty as positive)
    if (_host) _host.onScoreChanged(score);

    // Check game over
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (cumulScores[p] >= PENALTY_LIMIT) {
        gameOver = true;
        // Find lowest penalty player
        let bestP = 0;
        for (let q = 1; q < NUM_PLAYERS; ++q)
          if (cumulScores[q] < cumulScores[bestP]) bestP = q;
        msgs.push(PLAYER_NAMES[bestP] + ' wins the game!');
        if (bestP === 0) {
          if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        } else {
          if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        }
        break;
      }
    }

    if (winner === 0 && !gameOver) {
      if (_host) {
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.particles.confetti(CANVAS_W / 2, 300, 20);
      }
    }

    resultMsg = msgs.join(' | ');

    // Reveal all hands
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of hands[p]) c.faceUp = true;
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      cumulScores = [0, 0, 0];
      gameOver = false;
      setupKalooki();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawKalooki();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      if (currentPlayer !== 0) return;

      // Draw phase
      if (phase === PHASE_DRAW) {
        if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H) && (stockPile.length > 0 || discardPile.length > 1)) {
          playerDrawStock();
          return;
        }
        if (CE.isInRect(mx, my, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H) && discardPile.length > 0) {
          playerDrawDiscard();
          return;
        }
        return;
      }

      // Meld phase -- check buttons
      if (phase === PHASE_MELD) {
        if (CE.isInRect(mx, my, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h)) {
          playerMeld();
          return;
        }
        if (CE.isInRect(mx, my, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h)) {
          playerLayOff();
          return;
        }
        if (CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
          playerDiscard();
          return;
        }

        // Click on hand cards for selection
        const hand = hands[0];
        const spacing = Math.min(65, (CANVAS_W - 80) / Math.max(hand.length, 1));
        for (let i = hand.length - 1; i >= 0; --i) {
          const x = 30 + i * spacing;
          const sel = selectedIndices.includes(i);
          const y = sel ? 408 : 418;
          if (mx >= x && mx <= x + CE.CARD_W * 0.9 && my >= y && my <= y + CE.CARD_H * 0.9) {
            if (sel)
              selectedIndices = selectedIndices.filter(si => si !== i);
            else
              selectedIndices.push(i);
            return;
          }
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver || currentPlayer !== 0) return;
      if (phase === PHASE_MELD) {
        if (e.key === 'm' || e.key === 'M') playerMeld();
        else if (e.key === 'l' || e.key === 'L') playerLayOff();
        else if (e.key === 'd' || e.key === 'D') playerDiscard();
      }
    },

    tick(dt) {
      if (roundOver || gameOver) return;
      if (phase !== PHASE_AI_THINKING) return;

      aiTimer += dt;
      if (aiTimer >= AI_DELAY)
        aiTakeTurn(currentPlayer);
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      hands = [[], [], []];
      stockPile = [];
      discardPile = [];
      tableMelds = [];
      cumulScores = [0, 0, 0];
      hasMelded = [false, false, false];
      noPriorMelds = [true, true, true];
      roundOver = false;
      gameOver = false;
      phase = PHASE_DRAW;
      currentPlayer = 0;
      selectedIndices = [];
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

  SZ.CardGames.registerVariant('kalooki', module);

})();
