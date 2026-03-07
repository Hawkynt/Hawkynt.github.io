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

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 5;
  const YANIV_THRESHOLD = 7;
  const ELIMINATION_SCORE = 200;
  const HALVE_MILESTONES = [50, 100, 150];
  const AI_YANIV_THRESHOLD = 5;
  const PLAYER_NAMES = ['You', 'AI-1', 'AI-2', 'AI-3'];

  /* ── Phases ── */
  const PHASE_DISCARD = 0;
  const PHASE_DRAW = 1;
  const PHASE_AI_THINKING = 2;
  const PHASE_YANIV_REVEAL = 3;
  const PHASE_ROUND_OVER = 4;

  /* ── Card values for scoring: A=1, 2-10=face, J/Q/K=10, Joker=0 ── */
  function cardValue(card) {
    if (card.suit === 'joker') return 0;
    if (card.rank === 'A') return 1;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
    const n = parseInt(card.rank);
    return isNaN(n) ? 0 : n;
  }

  function rankIndex(card) {
    if (card.suit === 'joker') return -1;
    return CE.RANKS.indexOf(card.rank);
  }

  function handTotal(hand) {
    let total = 0;
    for (let i = 0; i < hand.length; ++i)
      total += cardValue(hand[i]);
    return total;
  }

  /* ── Layout constants ── */
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 40;
  const STOCK_Y = (CANVAS_H - CE.CARD_H) / 2;
  const DISCARD_X = CANVAS_W / 2 + 40;
  const DISCARD_Y = (CANVAS_H - CE.CARD_H) / 2;

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 28;

  const BTN_W = 90;
  const BTN_H = 30;
  const DISCARD_BTN = { x: CANVAS_W / 2 - BTN_W - 10, y: CANVAS_H - 60, w: BTN_W, h: BTN_H };
  const YANIV_BTN = { x: CANVAS_W / 2 + 10, y: CANVAS_H - 60, w: BTN_W, h: BTN_H };

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let stockPile = [];
  let discardGroup = [];        // last discarded group (array of cards)
  let cumulativeScores = [0, 0, 0, 0];
  let eliminated = [false, false, false, false];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_DISCARD;
  let currentPlayer = 0;
  let selectedIndices = [];     // toggled card indices in player hand
  let resultMsg = '';
  let yanivCaller = -1;
  let assafTriggered = false;

  /* ── AI timing ── */
  let aiTimer = 0;
  let aiStep = 0;              // 0=discard, 1=draw
  const AI_DELAY = 0.8;

  /* ── Yaniv reveal timer ── */
  let revealTimer = 0;
  const REVEAL_DELAY = 2.5;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ================================================================
     DECK CREATION (52 + 2 jokers)
     ================================================================ */

  function createYanivDeck() {
    const deck = CE.createDeck();
    deck.push({ suit: 'joker', rank: 'JK', value: -1, faceUp: false, color: 'red' });
    deck.push({ suit: 'joker', rank: 'JK', value: -1, faceUp: false, color: 'red' });
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
     DISCARD VALIDATION
     ================================================================ */

  /* Single card: always valid */
  function isSingleDiscard(cards) {
    return cards.length === 1;
  }

  /* Set: 2+ cards of the same rank, no jokers */
  function isSetDiscard(cards) {
    if (cards.length < 2) return false;
    for (let i = 0; i < cards.length; ++i)
      if (cards[i].suit === 'joker') return false;
    const rank = cards[0].rank;
    for (let i = 1; i < cards.length; ++i)
      if (cards[i].rank !== rank) return false;
    return true;
  }

  /* Run: 3+ consecutive cards of the same suit (jokers act as wild) */
  function isRunDiscard(cards) {
    if (cards.length < 3) return false;

    // Separate jokers and non-jokers
    const jokers = [];
    const normals = [];
    for (let i = 0; i < cards.length; ++i) {
      if (cards[i].suit === 'joker')
        jokers.push(cards[i]);
      else
        normals.push(cards[i]);
    }

    // Need at least one normal card
    if (normals.length === 0) return false;

    // All normal cards must share the same suit
    const suit = normals[0].suit;
    for (let i = 1; i < normals.length; ++i)
      if (normals[i].suit !== suit) return false;

    // Sort normals by rank index
    normals.sort((a, b) => rankIndex(a) - rankIndex(b));

    // Check for duplicate ranks among normals
    for (let i = 1; i < normals.length; ++i)
      if (rankIndex(normals[i]) === rankIndex(normals[i - 1])) return false;

    // Count gaps between consecutive normals
    let gapsNeeded = 0;
    for (let i = 1; i < normals.length; ++i)
      gapsNeeded += rankIndex(normals[i]) - rankIndex(normals[i - 1]) - 1;

    // Jokers can fill gaps
    return jokers.length >= gapsNeeded;
  }

  function isValidDiscard(cards) {
    if (cards.length === 0) return false;
    return isSingleDiscard(cards) || isSetDiscard(cards) || isRunDiscard(cards);
  }

  /* ================================================================
     DRAW SOURCES
     ================================================================ */

  /* Can draw the first or last card of the discard group, or from stock */
  function getDrawableDiscardCards() {
    if (discardGroup.length === 0) return [];
    if (discardGroup.length === 1) return [0];
    return [0, discardGroup.length - 1];
  }

  /* ================================================================
     NEXT ACTIVE PLAYER
     ================================================================ */

  function nextActivePlayer(from) {
    let next = (from + 1) % NUM_PLAYERS;
    let safety = 0;
    while (eliminated[next] && safety < NUM_PLAYERS) {
      next = (next + 1) % NUM_PLAYERS;
      ++safety;
    }
    return next;
  }

  function countActivePlayers() {
    let count = 0;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (!eliminated[p]) ++count;
    return count;
  }

  /* ================================================================
     RESHUFFLE STOCK FROM DISCARD
     ================================================================ */

  function reshuffleStock() {
    if (stockPile.length > 0) return;
    // Keep the current discard group visible; reshuffle everything else
    // In practice, Yaniv games rarely run out of stock, but handle it
    stockPile = CE.shuffle(discardGroup.splice(0, discardGroup.length));
    for (const c of stockPile) c.faceUp = false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    const deck = CE.shuffle(createYanivDeck());
    hands = [[], [], [], []];
    discardGroup = [];
    stockPile = [];
    roundOver = false;
    phase = PHASE_DISCARD;
    currentPlayer = 0;
    selectedIndices = [];
    resultMsg = '';
    yanivCaller = -1;
    assafTriggered = false;
    aiTimer = 0;
    aiStep = 0;
    revealTimer = 0;

    // Skip eliminated players for dealing
    for (let i = 0; i < HAND_SIZE; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (eliminated[p]) continue;
        const card = deck.pop();
        if (p === 0) card.faceUp = true;
        hands[p].push(card);
      }

    stockPile = deck;

    sortHand(hands[0]);

    // Find the first non-eliminated player
    currentPlayer = 0;
    if (eliminated[0])
      currentPlayer = nextActivePlayer(NUM_PLAYERS - 1);

    // If it's an AI player's turn first, set AI phase
    if (currentPlayer !== 0) {
      phase = PHASE_AI_THINKING;
      aiStep = 0;
      aiTimer = 0;
    }

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function resolveYaniv(callerIdx) {
    yanivCaller = callerIdx;
    const callerTotal = handTotal(hands[callerIdx]);

    // Check for Assaf: does any other active player have equal or lower total?
    assafTriggered = false;
    let lowestOther = Infinity;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === callerIdx || eliminated[p]) continue;
      const t = handTotal(hands[p]);
      if (t <= callerTotal) {
        assafTriggered = true;
      }
      if (t < lowestOther) lowestOther = t;
    }

    if (assafTriggered) {
      // Assaf! Caller gets 30 + their hand total
      cumulativeScores[callerIdx] += 30 + callerTotal;
      // Others score their hand totals
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p === callerIdx || eliminated[p]) continue;
        cumulativeScores[p] += handTotal(hands[p]);
      }
      resultMsg = 'ASSAF! ' + PLAYER_NAMES[callerIdx] + ' called Yaniv but was caught!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 200, 'ASSAF!', { color: '#f44', size: 32 });
        _host.screenShake.trigger(8, 400);
      }
    } else {
      // Caller scores 0; others score their hand totals
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p === callerIdx || eliminated[p]) continue;
        cumulativeScores[p] += handTotal(hands[p]);
      }
      resultMsg = PLAYER_NAMES[callerIdx] + ' calls Yaniv! (' + callerTotal + ' pts)';
      if (callerIdx === 0 && _host) {
        _host.floatingText.add(CANVAS_W / 2, 200, 'YANIV!', { color: '#4f4', size: 32 });
        _host.particles.confetti(CANVAS_W / 2, 300, 25);
      } else if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[callerIdx] + ' YANIV!', { color: '#fa0', size: 28 });
      }
    }

    // Check for milestone halving (exact 50, 100, or 150)
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (eliminated[p]) continue;
      for (const milestone of HALVE_MILESTONES) {
        if (cumulativeScores[p] === milestone) {
          cumulativeScores[p] = Math.floor(milestone / 2);
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 260 + p * 20, PLAYER_NAMES[p] + ' hits ' + milestone + '! Halved to ' + cumulativeScores[p], { color: '#ff0', size: 14 });
        }
      }
    }

    // Check eliminations
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (eliminated[p]) continue;
      if (cumulativeScores[p] >= ELIMINATION_SCORE) {
        eliminated[p] = true;
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 280 + p * 20, PLAYER_NAMES[p] + ' eliminated!', { color: '#f88', size: 14 });
      }
    }

    score = cumulativeScores[0];
    if (_host) _host.onScoreChanged(score);

    // Check game over
    const active = countActivePlayers();
    if (active <= 1 || eliminated[0]) {
      gameOver = true;
      if (!eliminated[0] && active === 1)
        resultMsg += ' -- YOU WIN THE GAME!';
      else if (eliminated[0])
        resultMsg += ' -- You have been eliminated!';
      else {
        // Find winner
        for (let p = 0; p < NUM_PLAYERS; ++p) {
          if (!eliminated[p]) {
            resultMsg += ' -- ' + PLAYER_NAMES[p] + ' wins the game!';
            break;
          }
        }
      }
    }

    roundOver = true;
    phase = PHASE_ROUND_OVER;
  }

  /* ================================================================
     PLAYER ACTIONS
     ================================================================ */

  function playerDiscard() {
    if (selectedIndices.length === 0) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, PLAYER_HAND_Y - 20, 'Select cards to discard', { color: '#f88', size: 14 });
      return false;
    }

    // Build the discard cards
    const sorted = selectedIndices.slice().sort((a, b) => a - b);
    const cards = sorted.map(i => hands[0][i]);

    if (!isValidDiscard(cards)) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, PLAYER_HAND_Y - 20, 'Invalid discard!', { color: '#f88', size: 14 });
      return false;
    }

    // Remove from hand (descending index order)
    const descIndices = sorted.slice().sort((a, b) => b - a);
    for (const idx of descIndices) hands[0].splice(idx, 1);

    // Set as the new discard group
    for (const c of cards) c.faceUp = true;
    discardGroup = cards;

    selectedIndices = [];
    sortHand(hands[0]);
    phase = PHASE_DRAW;
    return true;
  }

  function playerCallYaniv() {
    if (handTotal(hands[0]) > YANIV_THRESHOLD) return;
    phase = PHASE_YANIV_REVEAL;
    revealTimer = 0;
    yanivCaller = 0;
  }

  function playerDrawFromStock() {
    if (stockPile.length === 0) reshuffleStock();
    if (stockPile.length === 0) return;
    const card = stockPile.pop();
    card.faceUp = true;
    hands[0].push(card);
    sortHand(hands[0]);
    selectedIndices = [];

    if (_host) _host.dealCardAnim(card, STOCK_X, STOCK_Y, playerCardX(hands[0].length - 1, hands[0].length), PLAYER_HAND_Y, 0);

    // Advance to next player
    advanceToNextPlayer();
  }

  function playerDrawFromDiscard(discardIdx) {
    if (discardIdx < 0 || discardIdx >= discardGroup.length) return;
    const card = discardGroup.splice(discardIdx, 1)[0];
    card.faceUp = true;
    hands[0].push(card);
    sortHand(hands[0]);
    selectedIndices = [];

    if (_host) _host.dealCardAnim(card, DISCARD_X, DISCARD_Y, playerCardX(hands[0].length - 1, hands[0].length), PLAYER_HAND_Y, 0);

    advanceToNextPlayer();
  }

  function advanceToNextPlayer() {
    const next = nextActivePlayer(currentPlayer);
    currentPlayer = next;
    if (next === 0) {
      phase = PHASE_DISCARD;
      selectedIndices = [];
    } else {
      phase = PHASE_AI_THINKING;
      aiStep = 0;
      aiTimer = 0;
    }
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiFindBestDiscard(p) {
    const hand = hands[p];
    if (hand.length === 0) return [];

    // Strategy: try to discard highest-value combo
    // 1. Find runs (longest first for maximum discard)
    const bestRun = aiFindBestRun(hand);
    // 2. Find sets
    const bestSet = aiFindBestSet(hand);

    // Compare: prefer the combo that removes the most value
    let runValue = 0;
    if (bestRun) {
      for (const idx of bestRun) runValue += cardValue(hand[idx]);
    }
    let setValue = 0;
    if (bestSet) {
      for (const idx of bestSet) setValue += cardValue(hand[idx]);
    }

    // If a combo removes more value, use it
    if (bestRun && runValue >= setValue && bestRun.length >= 3)
      return bestRun;
    if (bestSet && setValue > 0 && bestSet.length >= 2)
      return bestSet;

    // Otherwise, discard the single highest-value card
    let highIdx = 0;
    let highVal = cardValue(hand[0]);
    for (let i = 1; i < hand.length; ++i) {
      const v = cardValue(hand[i]);
      if (v > highVal) {
        highVal = v;
        highIdx = i;
      }
    }
    return [highIdx];
  }

  function aiFindBestRun(hand) {
    // Group by suit (excluding jokers)
    const bySuit = {};
    const jokerIndices = [];
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === 'joker') {
        jokerIndices.push(i);
        continue;
      }
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }

    let bestRun = null;
    let bestRunValue = 0;

    for (const suit in bySuit) {
      const indices = bySuit[suit];
      indices.sort((a, b) => rankIndex(hand[a]) - rankIndex(hand[b]));

      // Try all starting points
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        let jokersUsed = 0;
        let jokersAvail = jokerIndices.length;
        let lastRank = rankIndex(hand[indices[start]]);

        for (let next = start + 1; next < indices.length; ++next) {
          const nextRank = rankIndex(hand[indices[next]]);
          const gap = nextRank - lastRank - 1;

          if (gap === 0) {
            run.push(indices[next]);
            lastRank = nextRank;
          } else if (gap > 0 && gap <= jokersAvail - jokersUsed) {
            // Fill gaps with jokers
            for (let g = 0; g < gap; ++g) {
              run.push(jokerIndices[jokersUsed]);
              ++jokersUsed;
            }
            run.push(indices[next]);
            lastRank = nextRank;
          } else {
            break;
          }
        }

        if (run.length >= 3) {
          let runVal = 0;
          for (const idx of run) runVal += cardValue(hand[idx]);
          if (runVal > bestRunValue) {
            bestRunValue = runVal;
            bestRun = run.slice();
          }
        }
      }
    }

    return bestRun;
  }

  function aiFindBestSet(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === 'joker') continue;
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }

    let bestSet = null;
    let bestSetValue = 0;

    for (const rank in byRank) {
      if (byRank[rank].length >= 2) {
        const setIndices = byRank[rank];
        let setVal = 0;
        for (const idx of setIndices) setVal += cardValue(hand[idx]);
        if (setVal > bestSetValue) {
          bestSetValue = setVal;
          bestSet = setIndices.slice();
        }
      }
    }

    return bestSet;
  }

  function aiChooseDrawSource(p) {
    // Check if first or last card of discard group is useful
    const hand = hands[p];
    const drawableIndices = getDrawableDiscardCards();

    for (const di of drawableIndices) {
      const card = discardGroup[di];
      // Check if this card would help form a meld or lower hand total
      const currentTotal = handTotal(hand);
      // Taking a low-value card is generally good
      if (cardValue(card) <= 3) return { source: 'discard', idx: di };

      // Check if it completes a set
      let sameRank = 0;
      for (let i = 0; i < hand.length; ++i)
        if (hand[i].rank === card.rank) ++sameRank;
      if (sameRank >= 1 && cardValue(card) <= 5) return { source: 'discard', idx: di };

      // Check if it extends a run
      if (card.suit !== 'joker') {
        let consecutive = 0;
        for (let i = 0; i < hand.length; ++i) {
          if (hand[i].suit === card.suit) {
            const diff = Math.abs(rankIndex(card) - rankIndex(hand[i]));
            if (diff === 1) ++consecutive;
          }
        }
        if (consecutive >= 2) return { source: 'discard', idx: di };
      }
    }

    return { source: 'stock', idx: -1 };
  }

  function aiTakeTurn(p) {
    if (roundOver || gameOver) return;
    if (eliminated[p]) {
      advanceToNextPlayer();
      return;
    }

    if (aiStep === 0) {
      // Check if AI should call Yaniv
      if (handTotal(hands[p]) <= AI_YANIV_THRESHOLD) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[p] + ' calls Yaniv!', { color: '#fa0', size: 22 });
        phase = PHASE_YANIV_REVEAL;
        yanivCaller = p;
        revealTimer = 0;
        return;
      }

      // Discard phase
      const discardIndices = aiFindBestDiscard(p);
      const cards = discardIndices.map(i => hands[p][i]);

      // Remove from hand (descending index order)
      const desc = discardIndices.slice().sort((a, b) => b - a);
      for (const idx of desc) hands[p].splice(idx, 1);

      for (const c of cards) c.faceUp = true;
      discardGroup = cards;

      if (_host && cards.length > 1)
        _host.floatingText.add(CANVAS_W / 2, STOCK_Y - 20, PLAYER_NAMES[p] + ' discards ' + cards.length + ' cards', { color: '#aaa', size: 12 });

      ++aiStep;
      aiTimer = 0;
      return;
    }

    if (aiStep === 1) {
      // Draw phase
      const choice = aiChooseDrawSource(p);
      if (choice.source === 'discard' && discardGroup.length > 0) {
        const card = discardGroup.splice(choice.idx, 1)[0];
        hands[p].push(card);
      } else {
        if (stockPile.length === 0) reshuffleStock();
        if (stockPile.length > 0) {
          const card = stockPile.pop();
          hands[p].push(card);
        }
      }

      // Advance to next player
      advanceToNextPlayer();
    }
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 650;
    const spacing = Math.min(60, maxWidth / Math.max(total, 1));
    const startX = (CANVAS_W - spacing * (total - 1) - CE.CARD_W) / 2;
    return startX + idx * spacing;
  }

  /* Positions for AI hands around the table */
  function aiHandPosition(playerIdx) {
    // Player 0 = bottom (human), 1 = left, 2 = top, 3 = right
    switch (playerIdx) {
      case 1: return { x: 20, y: 180, horizontal: false };   // left, vertical fan
      case 2: return { x: 280, y: 12, horizontal: true };    // top, horizontal fan
      case 3: return { x: CANVAS_W - 70, y: 180, horizontal: false }; // right, vertical fan
      default: return { x: 0, y: 0, horizontal: true };
    }
  }

  /* ================================================================
     DRAWING - JOKER CARD
     ================================================================ */

  function drawJokerCard(x, y, card, w, h) {
    const cw = w || CE.CARD_W;
    const ch = h || CE.CARD_H;
    const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    CE.drawRoundedRect(_ctx, x, y, cw, ch, cr);
    _ctx.fillStyle = '#fff';
    _ctx.fill();
    _ctx.strokeStyle = '#333';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    const ss = Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
    _ctx.fillStyle = '#d00';
    _ctx.font = 'bold ' + Math.round(11 * ss) + 'px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('\u2605', x + cw / 2, y + ch * 0.3);
    _ctx.font = 'bold ' + Math.round(14 * ss) + 'px serif';
    _ctx.fillText('JK', x + cw / 2, y + ch * 0.55);
    _ctx.font = Math.round(9 * ss) + 'px sans-serif';
    _ctx.fillText('\u2605', x + cw / 2, y + ch * 0.75);
  }

  function drawAnyCard(x, y, card, w, h) {
    if (card.suit === 'joker')
      drawJokerCard(x, y, card, w, h);
    else
      CE.drawCardFace(_ctx, x, y, card, w, h);
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawYaniv() {
    // Score panel top-right
    drawScorePanel();

    if (phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    if (phase === PHASE_YANIV_REVEAL) {
      drawYanivReveal();
      return;
    }

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p)
      drawAIHand(p);

    // Stock pile
    drawStockPile();

    // Discard pile (group)
    drawDiscardGroup();

    // Action buttons
    if (currentPlayer === 0 && !roundOver && !gameOver) {
      if (phase === PHASE_DISCARD) {
        if (selectedIndices.length > 0) {
          const cards = selectedIndices.map(i => hands[0][i]);
          if (isValidDiscard(cards))
            CE.drawButton(_ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#3a1a1a', border: '#c44' });
        }
        if (handTotal(hands[0]) <= YANIV_THRESHOLD)
          CE.drawButton(_ctx, YANIV_BTN.x, YANIV_BTN.y, YANIV_BTN.w, YANIV_BTN.h, 'Yaniv!', { bg: '#1a4a1a', border: '#4f4' });
      } else if (phase === PHASE_DRAW) {
        // Draw prompts are handled by clicking stock/discard
      }
    }

    // Player hand
    drawPlayerHand();

    // Phase prompts
    drawPhasePrompt();
  }

  function drawScorePanel() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(_ctx, CANVAS_W - 195, 5, 185, 100, 6);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores (out at ' + ELIMINATION_SCORE + ')', CANVAS_W - 187, 10);
    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = 26 + p * 17;
      if (eliminated[p]) {
        _ctx.fillStyle = '#666';
        _ctx.textAlign = 'left';
        _ctx.fillText(PLAYER_NAMES[p] + ' (out)', CANVAS_W - 187, y);
        _ctx.textAlign = 'right';
        _ctx.fillText('' + cumulativeScores[p], CANVAS_W - 18, y);
      } else {
        _ctx.fillStyle = p === 0 ? '#8f8' : (p === currentPlayer ? '#ff0' : '#ccc');
        _ctx.textAlign = 'left';
        _ctx.fillText(PLAYER_NAMES[p], CANVAS_W - 187, y);
        _ctx.textAlign = 'right';
        _ctx.fillText('' + cumulativeScores[p], CANVAS_W - 18, y);
      }
    }
    _ctx.restore();
  }

  function drawAIHand(p) {
    if (eliminated[p]) {
      const pos = aiHandPosition(p);
      _ctx.fillStyle = '#666';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.fillText(PLAYER_NAMES[p] + ' (out)', pos.x, pos.y - 14);
      return;
    }

    const pos = aiHandPosition(p);
    const count = hands[p].length;
    const cardScale = 0.5;
    const cw = CE.CARD_W * cardScale;
    const ch = CE.CARD_H * cardScale;

    _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';

    if (pos.horizontal) {
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 14);
      for (let i = 0; i < count; ++i)
        CE.drawCardBack(_ctx, pos.x + i * 24, pos.y, cw, ch);
    } else {
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 14);
      for (let i = 0; i < count; ++i)
        CE.drawCardBack(_ctx, pos.x, pos.y + i * 18, cw, ch);
    }
  }

  function drawStockPile() {
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 6);
    if (stockPile.length > 0) {
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('' + stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 4);
    } else {
      CE.drawEmptySlot(_ctx, STOCK_X, STOCK_Y);
    }

    // Highlight during draw phase
    if (phase === PHASE_DRAW && currentPlayer === 0 && stockPile.length > 0) {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(0,255,0,0.4)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X - 2, STOCK_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
      _ctx.stroke();
      _ctx.restore();
    }
  }

  function drawDiscardGroup() {
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 6);

    if (discardGroup.length === 0) {
      CE.drawEmptySlot(_ctx, DISCARD_X, DISCARD_Y);
      return;
    }

    // Show all cards in the discard group spread out
    const totalWidth = (discardGroup.length - 1) * 35 + CE.CARD_W;
    const startX = DISCARD_X + CE.CARD_W / 2 - totalWidth / 2;

    for (let i = 0; i < discardGroup.length; ++i) {
      const x = startX + i * 35;
      drawAnyCard(x, DISCARD_Y, discardGroup[i]);

      // Highlight drawable cards during draw phase
      if (phase === PHASE_DRAW && currentPlayer === 0) {
        const drawable = getDrawableDiscardCards();
        if (drawable.includes(i)) {
          _ctx.save();
          _ctx.strokeStyle = 'rgba(255,255,0,0.5)';
          _ctx.lineWidth = 2;
          CE.drawRoundedRect(_ctx, x - 2, DISCARD_Y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
          _ctx.stroke();
          _ctx.restore();
        }
      }
    }
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    if (eliminated[0]) return;

    const ht = handTotal(hand);
    _ctx.fillStyle = ht <= YANIV_THRESHOLD ? '#4f4' : '#fff';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Your Hand (total: ' + ht + (ht <= YANIV_THRESHOLD ? ' - can call Yaniv!' : '') + ')', 90, PLAYER_HAND_Y - 6);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isSelected = selectedIndices.includes(i);
      const y = isSelected ? PLAYER_HAND_Y - 15 : PLAYER_HAND_Y;

      drawAnyCard(x, y, hand[i]);

      // Hint glow
      if (_host && _host.hintsEnabled && currentPlayer === 0 && phase === PHASE_DISCARD)
        if (cardHasHint(hand, i))
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

  function drawPhasePrompt() {
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'alphabetic';
    _ctx.font = '13px sans-serif';
    if (currentPlayer === 0 && !eliminated[0]) {
      if (phase === PHASE_DISCARD) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Select cards to discard (single, set, or run)' + (handTotal(hands[0]) <= YANIV_THRESHOLD ? ' -- or call Yaniv!' : ''), CANVAS_W / 2, CANVAS_H - 8);
      } else if (phase === PHASE_DRAW) {
        _ctx.fillStyle = '#8f8';
        _ctx.fillText('Draw from stock or pick from discard group (first/last card)', CANVAS_W / 2, CANVAS_H - 8);
      }
    } else if (phase === PHASE_AI_THINKING) {
      _ctx.fillStyle = '#ff8';
      _ctx.fillText(PLAYER_NAMES[currentPlayer] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawYanivReveal() {
    // Show all hands revealed
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(PLAYER_NAMES[yanivCaller] + ' calls YANIV!', CANVAS_W / 2, 15);

    // Reveal each player's hand
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (eliminated[p]) continue;
      const rowY = 55 + p * 120;
      const ht = handTotal(hands[p]);
      const isYanivCaller = p === yanivCaller;

      _ctx.fillStyle = isYanivCaller ? '#ff0' : (p === 0 ? '#8f8' : '#ccc');
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.fillText(PLAYER_NAMES[p] + ': ' + ht + ' pts' + (isYanivCaller ? ' (caller)' : ''), 30, rowY);

      const cardScale = 0.65;
      const cw = CE.CARD_W * cardScale;
      const ch = CE.CARD_H * cardScale;
      for (let c = 0; c < hands[p].length; ++c) {
        hands[p][c].faceUp = true;
        drawAnyCard(30 + c * (cw + 4), rowY + 18, hands[p][c], cw, ch);
      }
    }

    // Progress indicator
    const progress = Math.min(revealTimer / REVEAL_DELAY, 1);
    _ctx.fillStyle = 'rgba(255,255,255,0.3)';
    _ctx.fillRect(CANVAS_W / 2 - 100, CANVAS_H - 30, 200 * progress, 4);
  }

  function drawRoundOver() {
    _ctx.save();
    const pw = 440;
    const ph = 340;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round Over', CANVAS_W / 2, py + 14);

    if (assafTriggered) {
      _ctx.fillStyle = '#f44';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText('ASSAF!', CANVAS_W / 2, py + 38);
    }

    // Columns header
    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#888';
    _ctx.textAlign = 'center';
    _ctx.fillText('Hand', px + 200, py + 60);
    _ctx.fillText('Round', px + 280, py + 60);
    _ctx.fillText('Total', px + 360, py + 60);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const rowY = py + 80 + p * 55;
      const ht = handTotal(hands[p]);
      const isYanivCaller = p === yanivCaller;
      const roundPenalty = isYanivCaller
        ? (assafTriggered ? 30 + ht : 0)
        : (eliminated[p] ? 0 : ht);

      _ctx.fillStyle = eliminated[p] ? '#666' : (p === 0 ? '#8f8' : '#ccc');
      _ctx.textAlign = 'left';
      _ctx.font = '12px sans-serif';
      _ctx.fillText(PLAYER_NAMES[p] + (isYanivCaller ? ' (caller)' : '') + (eliminated[p] ? ' OUT' : ''), px + 16, rowY);

      // Show hand cards small
      const cardScale = 0.38;
      const cw = CE.CARD_W * cardScale;
      const ch = CE.CARD_H * cardScale;
      for (let c = 0; c < hands[p].length; ++c) {
        hands[p][c].faceUp = true;
        drawAnyCard(px + 16 + c * (cw + 2), rowY + 16, hands[p][c], cw, ch);
      }

      // Score columns
      _ctx.textAlign = 'center';
      _ctx.fillStyle = ht === 0 ? '#4f4' : '#f88';
      _ctx.font = '12px sans-serif';
      _ctx.fillText('' + ht, px + 200, rowY + 4);

      _ctx.fillStyle = roundPenalty === 0 ? '#4f4' : '#f88';
      _ctx.fillText(roundPenalty === 0 ? '0' : '+' + roundPenalty, px + 280, rowY + 4);

      _ctx.fillStyle = eliminated[p] ? '#f44' : (p === 0 ? '#8f8' : '#ccc');
      _ctx.font = 'bold 12px sans-serif';
      _ctx.fillText('' + cumulativeScores[p], px + 360, rowY + 4);
    }

    // Result message
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(resultMsg, CANVAS_W / 2, py + ph - 50);

    _ctx.fillStyle = '#8f8';
    _ctx.font = '12px sans-serif';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 20);
    _ctx.restore();
  }

  /* ================================================================
     HINT HELPER
     ================================================================ */

  function cardHasHint(hand, idx) {
    const card = hand[idx];

    // Check for 2+ same rank (potential set discard)
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit !== 'joker' && hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Jokers always hint (useful in runs)
    if (card.suit === 'joker') return true;

    // Check for consecutive same suit (potential run)
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].suit === card.suit && hand[i].suit !== 'joker')
        suitCards.push(rankIndex(hand[i]));
    }
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

    // High-value card hint (discard candidates)
    if (cardValue(card) >= 10) return true;

    return false;
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
      const y = isSelected ? PLAYER_HAND_Y - 15 : PLAYER_HAND_Y;
      const rightEdge = i === total - 1 ? x + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - x;
      if (mx >= x && mx <= x + hitW && my >= y && my <= y + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestDiscardGroup(mx, my) {
    if (discardGroup.length === 0) return -1;
    const totalWidth = (discardGroup.length - 1) * 35 + CE.CARD_W;
    const startX = DISCARD_X + CE.CARD_W / 2 - totalWidth / 2;
    const drawable = getDrawableDiscardCards();

    // Check in reverse order (rightmost card on top)
    for (let i = discardGroup.length - 1; i >= 0; --i) {
      if (!drawable.includes(i)) continue;
      const x = startX + i * 35;
      if (CE.isInRect(mx, my, x, DISCARD_Y, CE.CARD_W, CE.CARD_H))
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
      cumulativeScores = [0, 0, 0, 0];
      eliminated = [false, false, false, false];
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawYaniv();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          cumulativeScores = [0, 0, 0, 0];
          eliminated = [false, false, false, false];
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

      if (currentPlayer !== 0 || eliminated[0]) return;

      // DISCARD phase
      if (phase === PHASE_DISCARD) {
        // Yaniv button
        if (handTotal(hands[0]) <= YANIV_THRESHOLD &&
            CE.isInRect(mx, my, YANIV_BTN.x, YANIV_BTN.y, YANIV_BTN.w, YANIV_BTN.h)) {
          playerCallYaniv();
          return;
        }

        // Discard button
        if (selectedIndices.length > 0 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
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

      // DRAW phase
      if (phase === PHASE_DRAW) {
        // Click stock pile
        if (stockPile.length > 0 && CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
          playerDrawFromStock();
          return;
        }

        // Click discard group (first or last card)
        const discardIdx = hitTestDiscardGroup(mx, my);
        if (discardIdx >= 0) {
          playerDrawFromDiscard(discardIdx);
          return;
        }
        return;
      }
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (currentPlayer !== 0 || eliminated[0]) return;

      if (phase === PHASE_DISCARD) {
        if (e.key === 'd' || e.key === 'D') {
          if (selectedIndices.length > 0)
            playerDiscard();
        } else if (e.key === 'y' || e.key === 'Y') {
          if (handTotal(hands[0]) <= YANIV_THRESHOLD)
            playerCallYaniv();
        } else if (e.key === 'Escape') {
          selectedIndices = [];
        }
      } else if (phase === PHASE_DRAW) {
        if (e.key === 's' || e.key === 'S') {
          playerDrawFromStock();
        }
      }
    },

    tick(dt) {
      if (gameOver && phase !== PHASE_ROUND_OVER) return;

      // Yaniv reveal phase: wait then resolve
      if (phase === PHASE_YANIV_REVEAL) {
        revealTimer += dt;
        if (revealTimer >= REVEAL_DELAY)
          resolveYaniv(yanivCaller);
        return;
      }

      if (roundOver) return;

      // AI thinking
      if (phase === PHASE_AI_THINKING) {
        aiTimer += dt;
        if (aiTimer >= AI_DELAY)
          aiTakeTurn(currentPlayer);
      }
    },

    sortPlayerHand() { sortHand(hands[0]); },

    cleanup() {
      hands = [[], [], [], []];
      stockPile = [];
      discardGroup = [];
      cumulativeScores = [0, 0, 0, 0];
      eliminated = [false, false, false, false];
      selectedIndices = [];
      roundOver = false;
      gameOver = false;
      phase = PHASE_DISCARD;
      currentPlayer = 0;
      resultMsg = '';
      yanivCaller = -1;
      assafTriggered = false;
      aiTimer = 0;
      aiStep = 0;
      revealTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('yaniv', module);

})();
