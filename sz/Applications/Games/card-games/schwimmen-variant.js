;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Schwimmen-specific constants (32-card deck: 7..A) ── */
  const SCHWIMMEN_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUIT_NAMES = { spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs' };
  const RANK_VALUES = { '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10, 'A': 11 };

  /* ── Game state ── */
  const NUM_PLAYERS = 4;
  let hands = [[], [], [], []];
  let pool = [];
  let lives = [3, 3, 3, 3];
  let eliminated = [false, false, false, false];
  let currentTurn = 0;
  let hasKnocked = -1;
  let knockFinalTurns = 0;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let resultMsg = '';

  /* ── Swap-1 interaction state ── */
  let selectedHandCard = -1;
  let selectedPoolCard = -1;
  let swapMode = 'none'; // 'none' | 'swap1' | 'swapAll' | 'knock'

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 1.0;

  /* ── Button layout ── */
  const BTN_W = 100;
  const BTN_H = 34;
  const BTN_Y = CANVAS_H - 55;
  const BTN_GAP = 12;
  const BTN_START_X = CANVAS_W / 2 - (3 * BTN_W + 2 * BTN_GAP) / 2;

  const SWAP1_BTN = { x: BTN_START_X, y: BTN_Y, w: BTN_W, h: BTN_H };
  const SWAP_ALL_BTN = { x: BTN_START_X + BTN_W + BTN_GAP, y: BTN_Y, w: BTN_W, h: BTN_H };
  const KNOCK_BTN = { x: BTN_START_X + 2 * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };

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
    while (eliminated[p] && safety < NUM_PLAYERS) {
      p = (p + 1) % NUM_PLAYERS;
      ++safety;
    }
    return p;
  }

  function countActivePlayers() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!eliminated[i]) ++count;
    return count;
  }

  /* ================================================================
     SETUP / DEAL
     ================================================================ */

  function setupRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, SCHWIMMEN_RANKS));
    hands = [[], [], [], []];
    pool = [];
    selectedHandCard = -1;
    selectedPoolCard = -1;
    swapMode = 'none';
    hasKnocked = -1;
    knockFinalTurns = 0;
    roundOver = false;
    resultMsg = '';
    aiTurnTimer = 0;

    // Deal 3 cards to each player, 3 to pool
    for (let i = 0; i < 3; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p)
        hands[p].push(d.pop());
    for (let i = 0; i < 3; ++i)
      pool.push(d.pop());

    // Player cards face up, pool face up
    for (const c of hands[0]) c.faceUp = true;
    for (const c of pool) c.faceUp = true;

    // Find first active player starting from 0
    currentTurn = 0;
    if (eliminated[0]) currentTurn = nextActivePlayer(0);

    // Check for immediate 31
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!eliminated[p] && handValue(hands[p]) === 31) {
        if (_host) {
          const label = p === 0 ? 'You got 31 - Feuer!' : 'AI ' + p + ' has 31 - Feuer!';
          _host.floatingText.add(CANVAS_W / 2, 280, label, { color: '#ff0', size: 24 });
        }
        endRound(p);
        return;
      }
    }

    if (_host) {
      for (let i = 0; i < 3; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i), playerCardY(), i * 0.1);
    }
  }

  /* ================================================================
     CARD POSITIONS
     ================================================================ */

  function playerCardX(i) {
    return CANVAS_W / 2 - 1.5 * CE.CARD_W - 10 + i * (CE.CARD_W + 10);
  }

  function playerCardY() {
    return CANVAS_H - 175;
  }

  function poolCardX(i) {
    return CANVAS_W / 2 - 1.5 * CE.CARD_W - 10 + i * (CE.CARD_W + 10);
  }

  function poolCardY() {
    return CANVAS_H / 2 - CE.CARD_H / 2;
  }

  /* ================================================================
     SWAP LOGIC
     ================================================================ */

  function performSwap1(playerIdx, handIdx, poolIdx) {
    const tmp = hands[playerIdx][handIdx];
    hands[playerIdx][handIdx] = pool[poolIdx];
    pool[poolIdx] = tmp;
    // Keep face-up state correct
    if (playerIdx === 0)
      hands[0][handIdx].faceUp = true;
    pool[poolIdx].faceUp = true;
  }

  function performSwapAll(playerIdx) {
    const tmp = hands[playerIdx].slice();
    hands[playerIdx] = pool.slice();
    pool.length = 0;
    for (const c of tmp) {
      c.faceUp = true;
      pool.push(c);
    }
    if (playerIdx === 0) {
      for (const c of hands[0]) c.faceUp = true;
    }
  }

  function advanceTurn() {
    // Check for 31 after a swap
    if (!roundOver && handValue(hands[currentTurn]) === 31) {
      if (_host) {
        const label = currentTurn === 0 ? 'You got 31 - Feuer!' : 'AI ' + currentTurn + ' has 31!';
        _host.floatingText.add(CANVAS_W / 2, 280, label, { color: '#ff0', size: 24 });
      }
      endRound(currentTurn);
      return;
    }

    // If someone knocked, count down final turns
    if (hasKnocked >= 0) {
      ++knockFinalTurns;
      const activeCount = countActivePlayers();
      if (knockFinalTurns >= activeCount - 1) {
        evaluateRound();
        return;
      }
    }

    currentTurn = nextActivePlayer(currentTurn);
    aiTurnTimer = 0;
    selectedHandCard = -1;
    selectedPoolCard = -1;
    swapMode = 'none';
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiPlay(playerIdx) {
    const hand = hands[playerIdx];
    const val = handValue(hand);

    // Knock if hand value >= 28
    if (val >= 28 && hasKnocked < 0) {
      hasKnocked = playerIdx;
      knockFinalTurns = 0;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' knocks!', { color: '#fa0', size: 20 });
      advanceTurn();
      return;
    }

    // Swap all 3 if hand value < 18
    if (val < 18) {
      performSwapAll(playerIdx);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' swaps all 3', { color: '#8cf', size: 16 });
      advanceTurn();
      return;
    }

    // Try to swap 1 card to maximize same-suit total
    let bestImprovement = 0;
    let bestHandIdx = -1;
    let bestPoolIdx = -1;

    for (let hi = 0; hi < 3; ++hi) {
      for (let pi = 0; pi < 3; ++pi) {
        // Simulate swap
        const origCard = hand[hi];
        const poolCard = pool[pi];
        hand[hi] = poolCard;
        const newVal = handValue(hand);
        hand[hi] = origCard;
        const improvement = newVal - val;
        if (improvement > bestImprovement) {
          bestImprovement = improvement;
          bestHandIdx = hi;
          bestPoolIdx = pi;
        }
      }
    }

    if (bestHandIdx >= 0 && bestImprovement > 0) {
      performSwap1(playerIdx, bestHandIdx, bestPoolIdx);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' swaps 1 card', { color: '#8cf', size: 16 });
      advanceTurn();
      return;
    }

    // No good swap available: knock if possible, otherwise swap a random card
    if (hasKnocked < 0 && val >= 22) {
      hasKnocked = playerIdx;
      knockFinalTurns = 0;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 280, 'AI ' + playerIdx + ' knocks!', { color: '#fa0', size: 20 });
      advanceTurn();
      return;
    }

    // Swap weakest hand card for best pool card
    let weakestHi = 0;
    let weakestVal = cardValue(hand[0]);
    for (let hi = 1; hi < 3; ++hi) {
      if (cardValue(hand[hi]) < weakestVal) {
        weakestVal = cardValue(hand[hi]);
        weakestHi = hi;
      }
    }
    let bestPi = 0;
    let bestPVal = cardValue(pool[0]);
    for (let pi = 1; pi < 3; ++pi) {
      if (cardValue(pool[pi]) > bestPVal) {
        bestPVal = cardValue(pool[pi]);
        bestPi = pi;
      }
    }
    performSwap1(playerIdx, weakestHi, bestPi);
    advanceTurn();
  }

  /* ================================================================
     ROUND EVALUATION
     ================================================================ */

  function evaluateRound() {
    // Find lowest hand value among active players
    let lowestVal = Infinity;
    let losers = [];

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (eliminated[p]) continue;
      const val = handValue(hands[p]);
      if (val < lowestVal) {
        lowestVal = val;
        losers = [p];
      } else if (val === lowestVal)
        losers.push(p);
    }

    endRound(-1, losers);
  }

  function endRound(feuerWinner, losers) {
    roundOver = true;

    if (feuerWinner >= 0) {
      // 31 instant win -- everyone else loses a life
      const fLosers = [];
      for (let p = 0; p < NUM_PLAYERS; ++p) {
        if (p !== feuerWinner && !eliminated[p]) {
          --lives[p];
          fLosers.push(p);
          if (_host) {
            const label = p === 0 ? 'You lose a life!' : 'AI ' + p + ' loses a life!';
            _host.floatingText.add(200 + p * 150, 200, label, { color: '#f44', size: 14 });
          }
        }
      }
      losers = fLosers;
    } else if (losers && losers.length > 0) {
      for (const p of losers) {
        --lives[p];
        if (_host) {
          const label = p === 0 ? 'You lose a life!' : 'AI ' + p + ' loses a life!';
          _host.floatingText.add(200 + p * 150, 200, label, { color: '#f44', size: 14 });
        }
      }
    }

    // Check eliminations
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!eliminated[p] && lives[p] <= 0) {
        eliminated[p] = true;
        if (_host) {
          const label = p === 0 ? 'You are out!' : 'AI ' + p + ' is out!';
          _host.floatingText.add(CANVAS_W / 2, 240, label, { color: '#f00', size: 22 });
        }
      }
    }

    // Compute score for host
    score = lives[0] * 30 + (eliminated[0] ? 0 : handValue(hands[0]));

    // Check game over
    if (eliminated[0]) {
      gameOver = true;
      resultMsg = 'GAME OVER - You are eliminated!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
        _host.onScoreChanged(score);
      }
      return;
    }

    if (countActivePlayers() <= 1) {
      gameOver = true;
      if (!eliminated[0]) {
        resultMsg = 'YOU WIN! Last player standing!';
        score += 100;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      }
    } else {
      // Build result message
      const lostNames = losers ? losers.map(p => p === 0 ? 'You' : 'AI ' + p).join(', ') : '';
      resultMsg = lostNames + ' lost a life. Click to continue.';
    }

    if (_host) _host.onScoreChanged(score);
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawLives(x, y, count, isSwimming) {
    for (let i = 0; i < 3; ++i) {
      _ctx.font = '16px sans-serif';
      _ctx.fillStyle = i < count ? '#f44' : '#444';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('\u2764', x + i * 20, y);
    }
    if (isSwimming) {
      _ctx.fillStyle = '#fa0';
      _ctx.font = 'bold 10px sans-serif';
      _ctx.fillText('SCHWIMMT', x, y + 14);
    }
  }

  function drawPlayerLabel(x, y, playerIdx) {
    const isActive = currentTurn === playerIdx && !roundOver;
    const elim = eliminated[playerIdx];

    if (elim) {
      _ctx.fillStyle = '#666';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText(playerIdx === 0 ? 'You (out)' : 'AI ' + playerIdx + ' (out)', x, y);
      return;
    }

    _ctx.fillStyle = isActive ? '#ff0' : '#ccc';
    _ctx.font = isActive ? 'bold 13px sans-serif' : '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    const name = playerIdx === 0 ? 'You' : 'AI ' + playerIdx;
    const knockLabel = hasKnocked === playerIdx ? ' [Knocked]' : '';
    _ctx.fillText(name + knockLabel, x, y);
  }

  function drawSchwimmen() {
    // Title
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Schwimmen / 31', 20, 12);

    // Knock indicator
    if (hasKnocked >= 0 && !roundOver) {
      _ctx.fillStyle = '#fa0';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'left';
      const knocker = hasKnocked === 0 ? 'You' : 'AI ' + hasKnocked;
      _ctx.fillText(knocker + ' knocked \u2014 final round!', 20, 34);
    }

    const smallW = CE.CARD_W * 0.55;
    const smallH = CE.CARD_H * 0.55;

    // ── AI 2 (top center) ──
    if (!eliminated[2]) {
      const ax = CANVAS_W / 2;
      const ay = 20;
      drawPlayerLabel(ax, ay, 2);
      drawLives(ax - 28, ay + 18, lives[2], lives[2] === 1);
      if (!roundOver) {
        for (let i = 0; i < hands[2].length; ++i)
          CE.drawCardBack(_ctx, ax - 1.5 * 40 + i * 40, ay + 36, smallW, smallH);
      } else {
        for (let i = 0; i < hands[2].length; ++i)
          CE.drawCardFace(_ctx, ax - 1.5 * 40 + i * 40, ay + 36, hands[2][i], smallW, smallH);
      }
    }

    // ── AI 1 (left) ──
    if (!eliminated[1]) {
      const ax = 60;
      const ay = CANVAS_H / 2 - 60;
      drawPlayerLabel(ax + 20, ay - 16, 1);
      drawLives(ax - 8, ay, lives[1], lives[1] === 1);
      if (!roundOver) {
        for (let i = 0; i < hands[1].length; ++i)
          CE.drawCardBack(_ctx, ax - 10, ay + 18 + i * 32, smallW, smallH);
      } else {
        for (let i = 0; i < hands[1].length; ++i)
          CE.drawCardFace(_ctx, ax - 10, ay + 18 + i * 32, hands[1][i], smallW, smallH);
      }
    }

    // ── AI 3 (right) ──
    if (!eliminated[3]) {
      const ax = CANVAS_W - 100;
      const ay = CANVAS_H / 2 - 60;
      drawPlayerLabel(ax + 20, ay - 16, 3);
      drawLives(ax + 2, ay, lives[3], lives[3] === 1);
      if (!roundOver) {
        for (let i = 0; i < hands[3].length; ++i)
          CE.drawCardBack(_ctx, ax, ay + 18 + i * 32, smallW, smallH);
      } else {
        for (let i = 0; i < hands[3].length; ++i)
          CE.drawCardFace(_ctx, ax, ay + 18 + i * 32, hands[3][i], smallW, smallH);
      }
    }

    // ── Center pool ──
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('Pool', CANVAS_W / 2, poolCardY() - 6);
    for (let i = 0; i < pool.length; ++i) {
      const px = poolCardX(i);
      const py = poolCardY();
      CE.drawCardFace(_ctx, px, py, pool[i]);
      // Highlight selected pool card
      if (selectedPoolCard === i && swapMode === 'swap1') {
        _ctx.save();
        _ctx.strokeStyle = '#0f0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#0f0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, px - 2, py - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }

    // ── Player hand (bottom center) ──
    if (!eliminated[0]) {
      const py = playerCardY();
      drawPlayerLabel(CANVAS_W / 2, py - 22, 0);
      drawLives(CANVAS_W / 2 - 28, py - 8, lives[0], lives[0] === 1);
      for (let i = 0; i < hands[0].length; ++i) {
        if (hands[0][i]._dealing) continue;
        const px = playerCardX(i);
        CE.drawCardFace(_ctx, px, py, hands[0][i]);
        // Hint glow: all hand cards are valid plays when it's the player's swap turn
        if (_host && _host.hintsEnabled && currentTurn === 0 && !roundOver && !gameOver)
          CE.drawHintGlow(_ctx, px, py, CE.CARD_W, CE.CARD_H, _host.hintTime);
        // Highlight selected hand card
        if (selectedHandCard === i && swapMode === 'swap1') {
          _ctx.save();
          _ctx.strokeStyle = '#ff0';
          _ctx.lineWidth = 3;
          _ctx.shadowColor = '#ff0';
          _ctx.shadowBlur = 8;
          CE.drawRoundedRect(_ctx, px - 2, py - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
          _ctx.stroke();
          _ctx.restore();
        }
      }

      // Hand value indicator
      if (!eliminated[0]) {
        _ctx.fillStyle = '#8f8';
        _ctx.font = '13px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'top';
        _ctx.fillText('Hand: ' + handValueLabel(hands[0]) + ' (' + bestSuitName(hands[0]) + ')', CANVAS_W / 2, py + CE.CARD_H + 6);
      }
    }

    // ── Action buttons (only on player's turn) ──
    if (currentTurn === 0 && !roundOver && !gameOver && !eliminated[0]) {
      const swap1Active = swapMode === 'swap1';
      CE.drawButton(_ctx, SWAP1_BTN.x, SWAP1_BTN.y, SWAP1_BTN.w, SWAP1_BTN.h, swap1Active ? 'Select...' : 'Swap 1', {
        bg: swap1Active ? '#3a5a1a' : '#2a4a2a',
        border: swap1Active ? '#8c8' : '#4a4'
      });
      CE.drawButton(_ctx, SWAP_ALL_BTN.x, SWAP_ALL_BTN.y, SWAP_ALL_BTN.w, SWAP_ALL_BTN.h, 'Swap All', {
        bg: '#2a3a5a',
        border: '#48c'
      });

      if (hasKnocked < 0)
        CE.drawButton(_ctx, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h, 'Knock', {
          bg: '#5a3a1a',
          border: '#c84'
        });
      else
        CE.drawButton(_ctx, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h, 'Pass', {
          bg: '#3a3a3a',
          border: '#888'
        });

      // Instructions
      if (swapMode === 'swap1') {
        _ctx.fillStyle = '#8f8';
        _ctx.font = '11px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'top';
        _ctx.fillText('Click one of your cards, then a pool card to swap', CANVAS_W / 2, BTN_Y + BTN_H + 4);
      }
    }

    // ── Round over message ──
    if (roundOver && resultMsg) {
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      _ctx.fillRect(CANVAS_W / 2 - 250, CANVAS_H / 2 + 50, 500, 50);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H / 2 + 75);
    }
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      lives = [3, 3, 3, 3];
      eliminated = [false, false, false, false];
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawSchwimmen();
    },

    handleClick(mx, my) {
      if (gameOver) {
        if (_host) _host.onRoundOver(true);
        return;
      }

      if (roundOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      // Only handle clicks on player's turn
      if (currentTurn !== 0 || eliminated[0]) return;

      // ── Button: Swap 1 ──
      if (CE.isInRect(mx, my, SWAP1_BTN.x, SWAP1_BTN.y, SWAP1_BTN.w, SWAP1_BTN.h)) {
        swapMode = swapMode === 'swap1' ? 'none' : 'swap1';
        selectedHandCard = -1;
        selectedPoolCard = -1;
        return;
      }

      // ── Button: Swap All ──
      if (CE.isInRect(mx, my, SWAP_ALL_BTN.x, SWAP_ALL_BTN.y, SWAP_ALL_BTN.w, SWAP_ALL_BTN.h)) {
        performSwapAll(0);
        if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Swapped all 3!', { color: '#8cf', size: 18 });
        advanceTurn();
        return;
      }

      // ── Button: Knock / Pass ──
      if (CE.isInRect(mx, my, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h)) {
        if (hasKnocked < 0) {
          hasKnocked = 0;
          knockFinalTurns = 0;
          if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Knock!', { color: '#fa0', size: 22 });
        }
        advanceTurn();
        return;
      }

      // ── Swap-1 card selection ──
      if (swapMode === 'swap1') {
        // Check player hand cards
        for (let i = hands[0].length - 1; i >= 0; --i) {
          const px = playerCardX(i);
          const py = playerCardY();
          if (CE.isInRect(mx, my, px, py, CE.CARD_W, CE.CARD_H)) {
            selectedHandCard = i;
            // If both selected, do the swap
            if (selectedPoolCard >= 0) {
              performSwap1(0, selectedHandCard, selectedPoolCard);
              if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Swapped!', { color: '#8cf', size: 18 });
              swapMode = 'none';
              advanceTurn();
            }
            return;
          }
        }

        // Check pool cards
        for (let i = pool.length - 1; i >= 0; --i) {
          const px = poolCardX(i);
          const py = poolCardY();
          if (CE.isInRect(mx, my, px, py, CE.CARD_W, CE.CARD_H)) {
            selectedPoolCard = i;
            // If both selected, do the swap
            if (selectedHandCard >= 0) {
              performSwap1(0, selectedHandCard, selectedPoolCard);
              if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Swapped!', { color: '#8cf', size: 18 });
              swapMode = 'none';
              advanceTurn();
            }
            return;
          }
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver || currentTurn !== 0 || eliminated[0]) return;
      if (e.key === '1' || e.key === 's') {
        swapMode = swapMode === 'swap1' ? 'none' : 'swap1';
        selectedHandCard = -1;
        selectedPoolCard = -1;
      } else if (e.key === '3' || e.key === 'a') {
        performSwapAll(0);
        if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Swapped all 3!', { color: '#8cf', size: 18 });
        advanceTurn();
      } else if (e.key === 'k' || e.key === 'K') {
        if (hasKnocked < 0) {
          hasKnocked = 0;
          knockFinalTurns = 0;
          if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Knock!', { color: '#fa0', size: 22 });
        }
        advanceTurn();
      }
    },

    tick(dt) {
      if (roundOver || gameOver) return;
      if (currentTurn === 0) return;
      if (eliminated[currentTurn]) {
        currentTurn = nextActivePlayer(currentTurn);
        aiTurnTimer = 0;
        return;
      }

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        aiPlay(currentTurn);
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      hands = [[], [], [], []];
      pool = [];
      lives = [3, 3, 3, 3];
      eliminated = [false, false, false, false];
      roundOver = false;
      gameOver = false;
      hasKnocked = -1;
      knockFinalTurns = 0;
      selectedHandCard = -1;
      selectedPoolCard = -1;
      swapMode = 'none';
      aiTurnTimer = 0;
      resultMsg = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('schwimmen', module);

})();
