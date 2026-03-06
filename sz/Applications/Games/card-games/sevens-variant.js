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
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];
  const SUITS = CE ? CE.SUITS : ['spades', 'hearts', 'diamonds', 'clubs'];
  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUIT_SYMBOLS = { spades: '\u2660', hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663' };
  const SUIT_DISPLAY = ['spades', 'hearts', 'diamonds', 'clubs'];

  const GAME_OVER_THRESHOLD = 100;

  /* Rank index helpers: A=0 .. K=12, 7 is at index 6 */
  function rankIdx(card) {
    return card.value !== undefined ? card.value : RANKS.indexOf(card.rank);
  }

  function cardPenalty(card) {
    const ri = rankIdx(card);
    if (ri === 0) return 1;
    if (ri >= 10) return 10;
    return ri + 1;
  }

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [[], [], [], []];
  let suitRows = {};            // { suit: { low: rankIdx, high: rankIdx } }
  let placedCards = {};          // { suit: Set of rankIdx }
  let cumulativeScores = [0, 0, 0, 0];
  let roundScores = [0, 0, 0, 0];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let roundNumber = 0;

  let currentTurn = 0;
  let passCount = 0;            // consecutive passes (informational)
  let totalPasses = [0, 0, 0, 0];

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.7;

  let hoverCardIdx = -1;
  let hoverPassBtn = false;

  /* ================================================================
     SUIT ROW LOGIC
     ================================================================ */

  function initSuitRows() {
    suitRows = {};
    placedCards = {};
    for (const suit of SUIT_DISPLAY) {
      suitRows[suit] = null;        // null = no 7 placed yet
      placedCards[suit] = new Set();
    }
  }

  function placeSeven(suit) {
    suitRows[suit] = { low: 6, high: 6 };
    placedCards[suit].add(6);
  }

  function canPlace(card) {
    const suit = card.suit;
    const ri = rankIdx(card);
    const row = suitRows[suit];

    // If no 7 placed yet for this suit, only the 7 can start it
    if (!row)
      return ri === 6;

    // Extend low side (6,5,4,3,2,1,0) or high side (8,9,10,11,12)
    return ri === row.low - 1 || ri === row.high + 1;
  }

  function placeCard(card) {
    const suit = card.suit;
    const ri = rankIdx(card);
    const row = suitRows[suit];

    if (!row) {
      placeSeven(suit);
      return;
    }

    if (ri === row.low - 1)
      row.low = ri;
    else if (ri === row.high + 1)
      row.high = ri;

    placedCards[suit].add(ri);
  }

  function getValidPlays(hand) {
    const valid = [];
    for (let i = 0; i < hand.length; ++i)
      if (canPlace(hand[i]))
        valid.push(i);
    return valid;
  }

  /* ================================================================
     SORTING
     ================================================================ */

  function sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
    hand.sort((a, b) => {
      const sd = suitOrder[a.suit] - suitOrder[b.suit];
      if (sd !== 0) return sd;
      return rankIdx(a) - rankIdx(b);
    });
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    const valid = getValidPlays(hand);
    if (valid.length === 0) return -1;
    if (valid.length === 1) return valid[0];

    // Score each valid play: prefer plays that open fewer options for opponents
    let bestIdx = valid[0];
    let bestScore = -Infinity;

    for (const vi of valid) {
      const card = hand[vi];
      const ri = rankIdx(card);
      const suit = card.suit;
      let evalScore = 0;

      // Prefer playing 7s early (opens the row)
      if (ri === 6) {
        evalScore += 15;
        // Prefer suits where we hold adjacent cards
        const has6 = hand.some(c => c.suit === suit && rankIdx(c) === 5);
        const has8 = hand.some(c => c.suit === suit && rankIdx(c) === 7);
        if (has6) evalScore += 5;
        if (has8) evalScore += 5;
      }

      // Prefer extending toward cards we hold (unblocks our own hand)
      const row = suitRows[suit];
      if (row) {
        const nextLow = ri - 1;
        const nextHigh = ri + 1;
        const weHaveNext = hand.some(c =>
          c.suit === suit && (rankIdx(c) === nextLow || rankIdx(c) === nextHigh)
        );
        if (weHaveNext) evalScore += 8;

        // Penalize opening directions where opponents probably benefit
        // (if we don't hold the next card, opponents might)
        if (!weHaveNext) evalScore -= 3;
      }

      // Prefer playing extreme cards (A, K) to clear blocking potential
      if (ri === 0 || ri === 12) evalScore += 4;
      if (ri === 1 || ri === 11) evalScore += 2;

      // Prefer playing cards from suits where we hold the most cards
      const suitCount = hand.filter(c => c.suit === suit).length;
      evalScore += suitCount;

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestIdx = vi;
      }
    }

    return bestIdx;
  }

  /* ================================================================
     DEAL & SETUP
     ================================================================ */

  function findSevenOfDiamonds() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (const c of hands[p])
        if (c.suit === 'diamonds' && rankIdx(c) === 6) return p;
    return 0;
  }

  function dealRound() {
    const deck = CE.shuffle(CE.createDeck());
    hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      hands[i % NUM_PLAYERS].push(deck[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      sortHand(hands[p]);

    for (const c of hands[0])
      c.faceUp = true;

    initSuitRows();
    roundScores = [0, 0, 0, 0];
    totalPasses = [0, 0, 0, 0];
    passCount = 0;
    roundOver = false;
    hoverCardIdx = -1;
    hoverPassBtn = false;
    aiTurnTimer = 0;

    // Find who has the 7 of diamonds -- they go first and must play it
    const starter = findSevenOfDiamonds();
    currentTurn = starter;

    // If an AI starts, auto-play the 7 of diamonds on first tick
    if (starter === 0) {
      // Highlight for human to play
    }

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), PLAYER_HAND_Y, i * 0.05);
    }
  }

  function setupGame() {
    cumulativeScores = [0, 0, 0, 0];
    roundNumber = 0;
    roundOver = false;
    gameOver = false;
    score = 0;
    dealRound();
  }

  /* ================================================================
     PLAY FLOW
     ================================================================ */

  function doPlayCard(playerIdx, handIdx) {
    const card = hands[playerIdx].splice(handIdx, 1)[0];
    card.faceUp = true;
    placeCard(card);

    if (_host && _host.floatingText) {
      const label = card.rank + SUIT_SYMBOLS[card.suit];
      const color = playerIdx === 0 ? '#4f4' : '#ff0';
      _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ': ' + label, { color, size: 14 });
    }

    passCount = 0;
    checkRoundEnd();
    if (!roundOver)
      advanceTurn();
  }

  function doPass(playerIdx) {
    ++totalPasses[playerIdx];
    ++passCount;

    if (_host && _host.floatingText) {
      const color = playerIdx === 0 ? '#f88' : '#fa0';
      _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[playerIdx] + ' passes', { color, size: 14 });
    }

    advanceTurn();
  }

  function advanceTurn() {
    currentTurn = (currentTurn + 1) % NUM_PLAYERS;
    aiTurnTimer = 0;
  }

  function checkRoundEnd() {
    // Round ends when any player empties their hand
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (hands[p].length === 0) {
        endRound(p);
        return;
      }
    }
  }

  function endRound(winnerId) {
    roundOver = true;
    ++roundNumber;

    // Score penalties for remaining cards
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      let penalty = 0;
      for (const c of hands[p])
        penalty += cardPenalty(c);
      roundScores[p] = penalty;
      cumulativeScores[p] += penalty;
    }

    // Player score is inverted: lower cumulative = better, so we track as negative penalty
    score = -cumulativeScores[0];
    if (_host) _host.onScoreChanged(score);

    if (_host && _host.floatingText) {
      const msg = winnerId === 0 ? 'You go out first!' : PLAYER_NAMES[winnerId] + ' goes out first!';
      const col = winnerId === 0 ? '#4f4' : '#fa0';
      _host.floatingText.add(CANVAS_W / 2, 260, msg, { color: col, size: 20 });
    }
    if (_host && winnerId === 0 && _host.particles)
      _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 3, 30);

    // Check game over
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (cumulativeScores[p] >= GAME_OVER_THRESHOLD) {
        gameOver = true;
        break;
      }
    }

    if (gameOver && _host) {
      let lowest = cumulativeScores[0];
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (cumulativeScores[p] < lowest) {
          lowest = cumulativeScores[p];
          winner = p;
        }
      }
      const gmsg = winner === 0 ? 'You win the game!' : PLAYER_NAMES[winner] + ' wins!';
      const gcol = winner === 0 ? '#4f4' : '#f88';
      _host.floatingText.add(CANVAS_W / 2, 220, gmsg, { color: gcol, size: 22 });
      if (winner === 0 && _host.particles)
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
    }
  }

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 22;
  const SMALL_W = CE.CARD_W * 0.5;
  const SMALL_H = CE.CARD_H * 0.5;

  const ROW_TOP = 140;
  const ROW_SPACING = 80;
  const CARD_SPACING = 28;    // horizontal spacing for placed cards in row

  const PASS_BTN = { x: CANVAS_W / 2 - 50, y: PLAYER_HAND_Y - 36, w: 100, h: 28 };

  function playerCardX(idx, total) {
    const maxWidth = 660;
    const fanWidth = Math.min(maxWidth, total * 48);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  /* Suit row positions: 4 rows centered on canvas */
  function suitRowY(suitIdx) {
    return ROW_TOP + suitIdx * ROW_SPACING;
  }

  /* X position for a card at a given rank index in a suit row */
  function rowCardX(ri) {
    // 7 (index 6) is the center; left cards go 5,4,3,2,A; right cards go 8,9,10,J,Q,K
    const center = CANVAS_W / 2 - CE.CARD_W / 2;
    return center + (ri - 6) * CARD_SPACING;
  }

  /* AI hand positions */
  const AI_POS = [
    null,
    { x: 12, y: 150, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 160, y: 8, dir: 'horizontal', label: 'North' },
    { x: CANVAS_W - 12 - SMALL_W, y: 150, dir: 'vertical', label: 'East' }
  ];

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 170;
    const py = 55;
    const pw = 160;
    const ph = 108;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores', px + 10, py + 8);

    _ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 28 + p * 18;
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + hands[p].length + ')', px + 10, y);
      _ctx.textAlign = 'right';
      _ctx.fillText('' + cumulativeScores[p], px + pw - 10, y);
    }
    _ctx.restore();
  }

  function drawSuitRows() {
    const miniW = CE.CARD_W * 0.42;
    const miniH = CE.CARD_H * 0.42;
    const miniSpacing = miniW + 2;

    for (let si = 0; si < SUIT_DISPLAY.length; ++si) {
      const suit = SUIT_DISPLAY[si];
      const y = suitRowY(si);
      const row = suitRows[suit];

      // Suit label
      _ctx.fillStyle = (suit === 'hearts' || suit === 'diamonds') ? '#f44' : '#ccc';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'right';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(SUIT_SYMBOLS[suit], CANVAS_W / 2 - 6 * miniSpacing - 10, y + miniH / 2);

      // Draw 13 slots (A through K)
      const rowLeft = CANVAS_W / 2 - 6.5 * miniSpacing;
      for (let ri = 0; ri < 13; ++ri) {
        const x = rowLeft + ri * miniSpacing;

        if (placedCards[suit] && placedCards[suit].has(ri)) {
          // Draw a placed mini card
          const card = CE.makeCard(suit, RANKS[ri]);
          card.faceUp = true;
          CE.drawCardFace(_ctx, x, y, card, miniW, miniH);
        } else {
          // Draw empty slot, highlight next playable
          CE.drawEmptySlot(_ctx, x, y, null, miniW, miniH);

          // Highlight playable positions
          if (row && (ri === row.low - 1 || ri === row.high + 1)) {
            _ctx.save();
            _ctx.strokeStyle = 'rgba(100,255,100,0.4)';
            _ctx.lineWidth = 1.5;
            CE.drawRoundedRect(_ctx, x - 1, y - 1, miniW + 2, miniH + 2, 3);
            _ctx.stroke();
            _ctx.restore();
          } else if (!row && ri === 6) {
            // 7 slot highlighted
            _ctx.save();
            _ctx.strokeStyle = 'rgba(255,255,100,0.5)';
            _ctx.lineWidth = 1.5;
            CE.drawRoundedRect(_ctx, x - 1, y - 1, miniW + 2, miniH + 2, 3);
            _ctx.stroke();
            _ctx.restore();
          }
        }
      }
    }
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    const validIdxs = currentTurn === 0 && !roundOver ? getValidPlays(hand) : [];
    const validSet = new Set(validIdxs);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (currentTurn === 0 && i === hoverCardIdx && validSet.has(i))
        y -= 10;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow for valid plays
      if (_host && _host.hintsEnabled && validSet.has(i))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Dim invalid cards on player's turn
      if (currentTurn === 0 && !roundOver && !validSet.has(i)) {
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.fill();
        _ctx.restore();
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pos = AI_POS[p];
      const count = hands[p].length;
      const isCurrent = currentTurn === p && !roundOver;

      _ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 8;
        _ctx.fillText(pos.label + ' (' + count + ')', labelX, pos.y - 16);
        const spacing = Math.min(16, 260 / Math.max(count, 1));
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(_ctx, pos.x, pos.y + i * spacing, SMALL_W, SMALL_H);
      } else {
        _ctx.textAlign = 'center';
        _ctx.fillText(pos.label + ' (' + count + ')', CANVAS_W / 2, pos.y);
        const spacing = Math.min(20, 320 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + SMALL_W;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(_ctx, startX + i * spacing, pos.y + 14, SMALL_W, SMALL_H);
      }
    }
  }

  function drawCurrentPlayerIndicator() {
    if (roundOver) return;

    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';

    if (currentTurn === 0) {
      const valid = getValidPlays(hands[0]);
      if (valid.length > 0)
        _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 6);
      else
        _ctx.fillText('No valid plays \u2014 you must pass', CANVAS_W / 2, CANVAS_H - 6);
    } else
      _ctx.fillText(PLAYER_NAMES[currentTurn] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 6);
  }

  function drawPassButton() {
    if (roundOver || currentTurn !== 0) return;
    const valid = getValidPlays(hands[0]);
    if (valid.length > 0) return;

    const bg = hoverPassBtn ? '#5a2a2a' : '#3a1a1a';
    CE.drawButton(_ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass', { bg, border: '#c66', fontSize: 13 });
  }

  function drawRoundOverUI() {
    _ctx.save();
    const pw = 300;
    const ph = 220;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundNumber + ' Results', CANVAS_W / 2, py + 12);

    _ctx.font = '12px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 42 + p * 24;
      _ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p], px + 20, y);
      _ctx.textAlign = 'center';
      _ctx.fillText(roundScores[p] > 0 ? '+' + roundScores[p] : '0', px + pw / 2, y);
      _ctx.textAlign = 'right';
      _ctx.fillText('Total: ' + cumulativeScores[p], px + pw - 20, y);
    }

    if (gameOver) {
      let lowest = cumulativeScores[0];
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (cumulativeScores[p] < lowest) {
          lowest = cumulativeScores[p];
          winner = p;
        }
      }
      _ctx.fillStyle = winner === 0 ? '#4f4' : '#f88';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      const winMsg = winner === 0 ? 'You win!' : PLAYER_NAMES[winner] + ' wins!';
      _ctx.fillText(winMsg + ' (Lowest: ' + lowest + ')', CANVAS_W / 2, py + ph - 46);
    }

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 20);

    _ctx.restore();
  }

  function drawTitle() {
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Sevens (Fan Tan)', 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1), 10, 28);
  }

  function drawAll() {
    drawTitle();
    drawScorePanel();
    drawSuitRows();
    drawAIHands();
    drawPlayerHand();
    drawPassButton();
    drawCurrentPlayerIndicator();

    if (roundOver)
      drawRoundOverUI();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;
      if (mx >= cx && mx <= cx + hitW && my >= PLAYER_HAND_Y && my <= PLAYER_HAND_Y + CE.CARD_H)
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
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawAll();
    },

    handleClick(mx, my) {
      if (roundOver) {
        if (gameOver) {
          gameOver = false;
          cumulativeScores = [0, 0, 0, 0];
          roundNumber = 0;
          score = 0;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        dealRound();
        return;
      }

      if (currentTurn !== 0) return;

      // Check pass button
      const valid = getValidPlays(hands[0]);
      if (valid.length === 0 && CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h)) {
        doPass(0);
        return;
      }

      // Check card click
      const idx = hitTestPlayerCard(mx, my);
      if (idx < 0) return;

      if (canPlace(hands[0][idx])) {
        doPlayCard(0, idx);
      } else {
        if (_host && _host.floatingText)
          _host.floatingText.add(mx, my - 20, 'Cannot play this card!', { color: '#f88', size: 14 });
      }
    },

    handlePointerMove(mx, my) {
      hoverCardIdx = -1;
      hoverPassBtn = false;

      if (currentTurn === 0 && !roundOver) {
        hoverCardIdx = hitTestPlayerCard(mx, my);
        const valid = getValidPlays(hands[0]);
        if (valid.length === 0)
          hoverPassBtn = CE.isInRect(mx, my, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h);
      }
    },

    handlePointerUp() {},

    handleKey(e) {
      if (roundOver) return;
      if (currentTurn !== 0) return;

      // Space to pass
      if (e.key === ' ') {
        const valid = getValidPlays(hands[0]);
        if (valid.length === 0) {
          e.preventDefault();
          doPass(0);
        }
      }
    },

    tick(dt) {
      if (roundOver) return;
      if (currentTurn === 0) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;

        const hand = hands[currentTurn];
        const validIdx = aiChooseCard(currentTurn);

        if (validIdx >= 0)
          doPlayCard(currentTurn, validIdx);
        else
          doPass(currentTurn);
      }
    },

    cleanup() {
      hands = [[], [], [], []];
      suitRows = {};
      placedCards = {};
      cumulativeScores = [0, 0, 0, 0];
      roundScores = [0, 0, 0, 0];
      totalPasses = [0, 0, 0, 0];
      roundOver = false;
      gameOver = false;
      currentTurn = 0;
      passCount = 0;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      hoverPassBtn = false;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('sevens', module);

})();
