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

  const SCOPA_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
  const CAPTURE_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'J': 8, 'Q': 9, 'K': 10 };
  const PRIMIERA_VALUES = { '7': 21, '6': 18, 'A': 16, '5': 15, '4': 14, '3': 13, '2': 12, 'J': 10, 'Q': 10, 'K': 10 };

  const DIAMOND = 'diamonds';
  const WINNING_SCORE = 11;

  const PHASE_PLAY = 0;
  const PHASE_CAPTURE = 1;
  const PHASE_AI_TURN = 2;
  const PHASE_DEALING = 3;
  const PHASE_ROUND_OVER = 4;

  const AI_TURN_DELAY = 0.9;
  const DEAL_ANIM_DELAY = 0.6;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let table = [];
  let stock = [];
  let playerCaptures = [];
  let aiCaptures = [];
  let playerScopas = 0;
  let aiScopas = 0;
  let cumulativePlayer = 0;
  let cumulativeAI = 0;
  let lastCapturer = -1; // 0 = player, 1 = AI

  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_DEALING;
  let roundNumber = 0;

  let selectedHandIdx = -1;
  let selectedTableIdxs = [];
  let hoverHandIdx = -1;
  let hoverTableIdx = -1;

  let aiTurnTimer = 0;
  let dealTimer = 0;

  let roundBreakdown = null; // set at round end for display

  let _ctx = null;
  let _host = null;

  /* ================================================================
     DECK CREATION (40-card Italian-style)
     ================================================================ */

  function createScopaDeck() {
    return CE.createDeckFromRanks(CE.SUITS, SCOPA_RANKS);
  }

  /* ================================================================
     CARD VALUE HELPERS
     ================================================================ */

  function captureValue(card) {
    return CAPTURE_VALUES[card.rank] || 0;
  }

  function primieraValue(card) {
    return PRIMIERA_VALUES[card.rank] || 10;
  }

  function isDiamond(card) {
    return card.suit === DIAMOND;
  }

  function isSetteBello(card) {
    return card.rank === '7' && card.suit === DIAMOND;
  }

  /* ================================================================
     CAPTURE LOGIC — find all valid capture combinations
     ================================================================ */

  function findCaptureCombinations(cardVal, tableCards) {
    const results = [];

    // Single card matches
    for (let i = 0; i < tableCards.length; ++i)
      if (captureValue(tableCards[i]) === cardVal)
        results.push([i]);

    // Multi-card subsets that sum to cardVal (up to full table)
    const n = tableCards.length;
    if (n >= 2) {
      for (let mask = 3; mask < (1 << n); ++mask) {
        // Skip single-bit masks (already handled)
        if ((mask & (mask - 1)) === 0) continue;
        let sum = 0;
        const idxs = [];
        for (let b = 0; b < n; ++b) {
          if (mask & (1 << b)) {
            sum += captureValue(tableCards[b]);
            idxs.push(b);
          }
        }
        if (sum === cardVal)
          results.push(idxs);
      }
    }

    return results;
  }

  function canCapture(card) {
    return findCaptureCombinations(captureValue(card), table).length > 0;
  }

  function selectedTableSum() {
    let sum = 0;
    for (const idx of selectedTableIdxs)
      sum += captureValue(table[idx]);
    return sum;
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function dealHands() {
    for (let i = 0; i < 3; ++i) {
      if (stock.length > 0) {
        const pc = stock.pop();
        pc.faceUp = true;
        playerHand.push(pc);
      }
      if (stock.length > 0) {
        const ac = stock.pop();
        ac.faceUp = false;
        aiHand.push(ac);
      }
    }

    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  function setupRound() {
    const d = CE.shuffle(createScopaDeck());
    playerHand = [];
    aiHand = [];
    table = [];
    stock = d;
    playerCaptures = [];
    aiCaptures = [];
    playerScopas = 0;
    aiScopas = 0;
    lastCapturer = -1;
    roundOver = false;
    roundBreakdown = null;
    selectedHandIdx = -1;
    selectedTableIdxs = [];
    hoverHandIdx = -1;
    hoverTableIdx = -1;
    aiTurnTimer = 0;
    dealTimer = 0;

    // Place 4 cards on the table
    for (let i = 0; i < 4; ++i) {
      const c = stock.pop();
      c.faceUp = true;
      table.push(c);
    }

    // Deal 3 to each
    dealHands();
    phase = PHASE_PLAY;
  }

  function performCapture(who, handCard, tableIdxs) {
    const captures = who === 0 ? playerCaptures : aiCaptures;
    const captured = [];

    // Remove table cards (descending order to preserve indices)
    const sorted = tableIdxs.slice().sort((a, b) => b - a);
    for (const idx of sorted)
      captured.push(table.splice(idx, 1)[0]);

    captures.push(handCard);
    for (const c of captured)
      captures.push(c);

    // Check scopa (cleared entire table)
    if (table.length === 0) {
      if (who === 0) {
        ++playerScopas;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'SCOPA!', { color: '#ff0', size: 28 });
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 20);
        }
      } else {
        ++aiScopas;
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Scopa!', { color: '#fa0', size: 22 });
      }
    }

    lastCapturer = who;
  }

  function playCardToTable(who, card) {
    card.faceUp = true;
    table.push(card);
  }

  function playerPlayCard(handIdx, tableIdxs) {
    const card = playerHand.splice(handIdx, 1)[0];

    if (tableIdxs.length > 0) {
      performCapture(0, card, tableIdxs);
      if (_host) {
        const count = tableIdxs.length;
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 40, 'Captured ' + (count + 1) + ' cards', { color: '#8f8', size: 14 });
      }
    } else
      playCardToTable(0, card);

    selectedHandIdx = -1;
    selectedTableIdxs = [];

    afterTurn();
  }

  function afterTurn() {
    // Check if hands empty => re-deal or end round
    if (playerHand.length === 0 && aiHand.length === 0) {
      if (stock.length > 0) {
        dealHands();
        phase = PHASE_PLAY;
        return;
      }
      // End of round: last capturer takes remaining table cards
      if (table.length > 0 && lastCapturer >= 0) {
        const captures = lastCapturer === 0 ? playerCaptures : aiCaptures;
        while (table.length > 0)
          captures.push(table.pop());
        // No scopa for this
      }
      endRound();
      return;
    }

    // Switch to AI turn
    if (phase === PHASE_PLAY || phase === PHASE_CAPTURE) {
      phase = PHASE_AI_TURN;
      aiTurnTimer = 0;
    }
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay() {
    const hand = aiHand;
    if (hand.length === 0) return null;

    let bestPlay = null;
    let bestScore = -Infinity;

    for (let hi = 0; hi < hand.length; ++hi) {
      const card = hand[hi];
      const val = captureValue(card);
      const combos = findCaptureCombinations(val, table);

      if (combos.length === 0) {
        // No capture possible: evaluate placing the card
        // Penalize leaving easy captures for opponent (table sum <= 10)
        let placeScore = -1;

        // Prefer not playing 7 of diamonds if we can avoid it
        if (isSetteBello(card))
          placeScore -= 50;
        if (isDiamond(card))
          placeScore -= 5;

        // Penalize if placing makes table sum <= 10
        let tableSum = 0;
        for (const tc of table)
          tableSum += captureValue(tc);
        if (tableSum + val <= 10)
          placeScore -= 10;

        if (bestPlay === null || placeScore > bestScore) {
          bestScore = placeScore;
          bestPlay = { handIdx: hi, tableIdxs: [] };
        }
        continue;
      }

      // Evaluate each capture combination
      for (const combo of combos) {
        let s = 10; // base bonus for capturing
        const capturedCards = combo.map(i => table[i]);

        // Huge bonus for capturing 7 of diamonds
        for (const c of capturedCards)
          if (isSetteBello(c)) s += 100;
        if (isSetteBello(card)) s += 50; // we keep our sette bello in our captures

        // Bonus for diamonds
        for (const c of capturedCards)
          if (isDiamond(c)) s += 8;
        if (isDiamond(card)) s += 3;

        // Bonus for 7s (primiera)
        for (const c of capturedCards)
          if (c.rank === '7') s += 6;
        if (card.rank === '7') s += 3;

        // More cards captured = better
        s += combo.length * 2;

        // Massive bonus for scopa
        if (combo.length === table.length)
          s += 60;

        if (s > bestScore) {
          bestScore = s;
          bestPlay = { handIdx: hi, tableIdxs: combo };
        }
      }
    }

    return bestPlay;
  }

  function aiTakeTurn() {
    const play = aiChoosePlay();
    if (!play) {
      afterTurn();
      return;
    }

    const card = aiHand.splice(play.handIdx, 1)[0];
    card.faceUp = true;

    if (play.tableIdxs.length > 0) {
      performCapture(1, card, play.tableIdxs);
      if (_host) {
        const count = play.tableIdxs.length;
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI captures ' + (count + 1) + ' cards', { color: '#fa0', size: 14 });
      }
    } else {
      playCardToTable(1, card);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI plays to table', { color: '#aaa', size: 12 });
    }

    // Switch back to player
    if (playerHand.length > 0)
      phase = PHASE_PLAY;
    else
      afterTurn();
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function countDiamonds(captures) {
    let n = 0;
    for (const c of captures)
      if (isDiamond(c)) ++n;
    return n;
  }

  function hasSetteBello(captures) {
    for (const c of captures)
      if (isSetteBello(c)) return true;
    return false;
  }

  function computePrimiera(captures) {
    // Best card per suit using primiera values
    const best = {};
    for (const c of captures) {
      const pv = primieraValue(c);
      if (!best[c.suit] || pv > best[c.suit])
        best[c.suit] = pv;
    }
    let sum = 0;
    let suitCount = 0;
    for (const suit of CE.SUITS) {
      if (best[suit]) {
        sum += best[suit];
        ++suitCount;
      }
    }
    // Need at least one card in each suit to count fully;
    // partial is still used for comparison
    return { sum, suitCount };
  }

  function scoreRound() {
    let pPts = 0;
    let aPts = 0;
    const details = { player: {}, ai: {} };

    // Most cards
    details.player.cards = playerCaptures.length;
    details.ai.cards = aiCaptures.length;
    if (playerCaptures.length > aiCaptures.length)
      ++pPts;
    else if (aiCaptures.length > playerCaptures.length)
      ++aPts;
    details.player.cardsWin = playerCaptures.length > aiCaptures.length;
    details.ai.cardsWin = aiCaptures.length > playerCaptures.length;

    // Most diamonds
    const pDiam = countDiamonds(playerCaptures);
    const aDiam = countDiamonds(aiCaptures);
    details.player.diamonds = pDiam;
    details.ai.diamonds = aDiam;
    if (pDiam > aDiam)
      ++pPts;
    else if (aDiam > pDiam)
      ++aPts;
    details.player.diamondsWin = pDiam > aDiam;
    details.ai.diamondsWin = aDiam > pDiam;

    // Sette Bello (7 of diamonds)
    const pSB = hasSetteBello(playerCaptures);
    const aSB = hasSetteBello(aiCaptures);
    if (pSB) ++pPts;
    if (aSB) ++aPts;
    details.player.setteBello = pSB;
    details.ai.setteBello = aSB;

    // Primiera
    const pPrim = computePrimiera(playerCaptures);
    const aPrim = computePrimiera(aiCaptures);
    details.player.primiera = pPrim.sum;
    details.ai.primiera = aPrim.sum;
    if (pPrim.sum > aPrim.sum)
      ++pPts;
    else if (aPrim.sum > pPrim.sum)
      ++aPts;
    details.player.primieraWin = pPrim.sum > aPrim.sum;
    details.ai.primieraWin = aPrim.sum > pPrim.sum;

    // Scopas
    pPts += playerScopas;
    aPts += aiScopas;
    details.player.scopas = playerScopas;
    details.ai.scopas = aiScopas;

    details.player.total = pPts;
    details.ai.total = aPts;
    return details;
  }

  function endRound() {
    roundOver = true;
    phase = PHASE_ROUND_OVER;
    ++roundNumber;

    roundBreakdown = scoreRound();

    cumulativePlayer += roundBreakdown.player.total;
    cumulativeAI += roundBreakdown.ai.total;

    score = cumulativePlayer * 10;
    if (_host) _host.onScoreChanged(score);

    if (cumulativePlayer >= WINNING_SCORE || cumulativeAI >= WINNING_SCORE) {
      gameOver = true;
      if (cumulativePlayer >= WINNING_SCORE && cumulativePlayer > cumulativeAI) {
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      } else if (cumulativeAI >= WINNING_SCORE && cumulativeAI > cumulativePlayer) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI WINS', { color: '#f44', size: 28 });
      } else {
        // Tie at or above threshold -- continue
        gameOver = false;
      }
    }

    if (gameOver && _host)
      _host.onRoundOver(true);
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 25;
  const AI_HAND_Y = 15;
  const TABLE_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;
  const TABLE_MAX_PER_ROW = 7;

  function playerCardX(idx, total) {
    const spacing = Math.min(80, 400 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  function tableCardPos(idx) {
    const row = Math.floor(idx / TABLE_MAX_PER_ROW);
    const col = idx % TABLE_MAX_PER_ROW;
    const itemsInRow = Math.min(table.length - row * TABLE_MAX_PER_ROW, TABLE_MAX_PER_ROW);
    const spacing = Math.min(85, 560 / Math.max(itemsInRow - 1, 1));
    const fanWidth = (itemsInRow - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return {
      x: startX + col * spacing,
      y: TABLE_Y + row * (CE.CARD_H + 10)
    };
  }

  function aiCardX(idx, total) {
    const spacing = Math.min(35, 300 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     CAPTURE PILE & SCORE AREAS
     ================================================================ */

  const PLAYER_PILE_X = 20;
  const PLAYER_PILE_Y = CANVAS_H / 2 + 60;
  const AI_PILE_X = CANVAS_W - 110;
  const AI_PILE_Y = 100;

  const CONFIRM_BTN = { x: CANVAS_W / 2 - 55, y: PLAYER_HAND_Y - 38, w: 110, h: 28 };

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scopa', 20, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1) + '  |  Stock: ' + stock.length, 20, 30);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 175;
    const py = 10;
    const pw = 165;
    const ph = 68;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores (first to ' + WINNING_SCORE + ')', px + 8, py + 8);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You:', px + 8, py + 28);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + cumulativePlayer, px + pw - 8, py + 28);

    _ctx.textAlign = 'left';
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('AI:', px + 8, py + 46);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + cumulativeAI, px + pw - 8, py + 46);
    _ctx.restore();
  }

  function drawCapturePile(x, y, captures, scopas, label) {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.35)';
    CE.drawRoundedRect(_ctx, x, y, 90, 80, 5);
    _ctx.fill();

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(label, x + 45, y + 4);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.fillText('' + captures.length, x + 45, y + 22);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('cards', x + 45, y + 44);

    if (scopas > 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.fillText('Scopas: ' + scopas, x + 45, y + 60);
    }

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (i === selectedHandIdx) y -= 18;
      else if (i === hoverHandIdx && phase === PHASE_PLAY) y -= 8;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow: highlight cards that can capture
      if (_host && _host.hintsEnabled && phase === PHASE_PLAY && selectedHandIdx < 0)
        if (canCapture(hand[i]))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Selection highlight
      if (i === selectedHandIdx) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawAIHand() {
    const total = aiHand.length;
    if (total === 0) return;

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI (' + total + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    const scaleW = CE.CARD_W * 0.5;
    const scaleH = CE.CARD_H * 0.5;
    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, aiCardX(i, total), AI_HAND_Y, scaleW, scaleH);
  }

  function drawTable() {
    if (table.length === 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.15)';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Table empty', CANVAS_W / 2, TABLE_Y + CE.CARD_H / 2);
      return;
    }

    for (let i = 0; i < table.length; ++i) {
      const pos = tableCardPos(i);
      CE.drawCardFace(_ctx, pos.x, pos.y, table[i]);

      const isSelected = selectedTableIdxs.indexOf(i) >= 0;
      const isHovered = i === hoverTableIdx && phase === PHASE_CAPTURE;

      // When a hand card is selected, highlight valid table cards
      if (selectedHandIdx >= 0 && phase === PHASE_CAPTURE) {
        // Glow on table cards that match or could form combos
        if (_host && _host.hintsEnabled) {
          const cardVal = captureValue(playerHand[selectedHandIdx]);
          if (captureValue(table[i]) <= cardVal)
            CE.drawHintGlow(_ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, _host.hintTime);
        }
      }

      if (isSelected) {
        _ctx.save();
        _ctx.strokeStyle = '#0f0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#0f0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, pos.x - 2, pos.y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      } else if (isHovered) {
        _ctx.save();
        _ctx.strokeStyle = 'rgba(0,255,0,0.4)';
        _ctx.lineWidth = 2;
        CE.drawRoundedRect(_ctx, pos.x - 1, pos.y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawCaptureUI() {
    if (selectedHandIdx < 0 || phase !== PHASE_CAPTURE) return;

    const card = playerHand[selectedHandIdx];
    const cardVal = captureValue(card);
    const currentSum = selectedTableSum();

    // Show sum info
    _ctx.fillStyle = '#ff0';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    const sumText = 'Selected sum: ' + currentSum + ' / ' + cardVal;
    _ctx.fillText(sumText, CANVAS_W / 2, CONFIRM_BTN.y - 6);

    // Confirm button when sum matches
    if (currentSum === cardVal && selectedTableIdxs.length > 0)
      CE.drawButton(_ctx, CONFIRM_BTN.x, CONFIRM_BTN.y, CONFIRM_BTN.w, CONFIRM_BTN.h, 'Capture!', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });

    // "Place on table" button when no captures desired
    const placeBtn = { x: CANVAS_W / 2 - 55, y: CONFIRM_BTN.y, w: 110, h: 28 };
    if (currentSum !== cardVal || selectedTableIdxs.length === 0) {
      // Only show "Place on table" if no captures are possible
      const combos = findCaptureCombinations(cardVal, table);
      if (combos.length === 0)
        CE.drawButton(_ctx, placeBtn.x, placeBtn.y, placeBtn.w, placeBtn.h, 'Place on Table', { bg: '#3a3a5a', border: '#88c', fontSize: 12 });
    }
  }

  function drawInstructions() {
    if (phase === PHASE_PLAY) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Your turn \u2014 click a card from your hand', CANVAS_W / 2, CANVAS_H - 6);
    } else if (phase === PHASE_CAPTURE) {
      _ctx.fillStyle = '#8cf';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      const card = playerHand[selectedHandIdx];
      const combos = findCaptureCombinations(captureValue(card), table);
      if (combos.length > 0)
        _ctx.fillText('Select table cards to capture (sum must equal ' + captureValue(card) + ')', CANVAS_W / 2, CANVAS_H - 6);
      else
        _ctx.fillText('No captures possible \u2014 card will be placed on table', CANVAS_W / 2, CANVAS_H - 6);
    } else if (phase === PHASE_AI_TURN) {
      _ctx.fillStyle = '#fa0';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 6);
    }
  }

  function drawRoundOverUI() {
    if (!roundBreakdown) return;

    const px = CANVAS_W / 2 - 200;
    const py = 100;
    const pw = 400;
    const ph = 340;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundNumber + ' Results', CANVAS_W / 2, py + 12);

    // Column headers
    const colY = py + 44;
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Category', CANVAS_W / 2 - 80, colY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You', CANVAS_W / 2 + 50, colY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('AI', CANVAS_W / 2 + 130, colY);

    const rb = roundBreakdown;
    const rows = [
      ['Cards', rb.player.cards + (rb.player.cardsWin ? ' (+1)' : ''), rb.ai.cards + (rb.ai.cardsWin ? ' (+1)' : '')],
      ['Diamonds', rb.player.diamonds + (rb.player.diamondsWin ? ' (+1)' : ''), rb.ai.diamonds + (rb.ai.diamondsWin ? ' (+1)' : '')],
      ['Sette Bello', rb.player.setteBello ? 'Yes (+1)' : 'No', rb.ai.setteBello ? 'Yes (+1)' : 'No'],
      ['Primiera', rb.player.primiera + (rb.player.primieraWin ? ' (+1)' : ''), rb.ai.primiera + (rb.ai.primieraWin ? ' (+1)' : '')],
      ['Scopas', '+' + rb.player.scopas, '+' + rb.ai.scopas]
    ];

    _ctx.font = '12px sans-serif';
    for (let i = 0; i < rows.length; ++i) {
      const ry = colY + 24 + i * 24;
      _ctx.textAlign = 'center';
      _ctx.fillStyle = '#ccc';
      _ctx.fillText(rows[i][0], CANVAS_W / 2 - 80, ry);
      _ctx.fillStyle = '#8f8';
      _ctx.fillText(rows[i][1], CANVAS_W / 2 + 50, ry);
      _ctx.fillStyle = '#fa0';
      _ctx.fillText(rows[i][2], CANVAS_W / 2 + 130, ry);
    }

    // Totals
    const totalY = colY + 24 + rows.length * 24 + 10;
    _ctx.font = 'bold 14px sans-serif';
    _ctx.fillStyle = '#ccc';
    _ctx.textAlign = 'center';
    _ctx.fillText('Round Total', CANVAS_W / 2 - 80, totalY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('+' + rb.player.total, CANVAS_W / 2 + 50, totalY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('+' + rb.ai.total, CANVAS_W / 2 + 130, totalY);

    // Cumulative
    const cumY = totalY + 24;
    _ctx.fillStyle = '#ccc';
    _ctx.fillText('Overall', CANVAS_W / 2 - 80, cumY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('' + cumulativePlayer, CANVAS_W / 2 + 50, cumY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('' + cumulativeAI, CANVAS_W / 2 + 130, cumY);

    // Continue prompt
    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);

    _ctx.restore();
  }

  function drawScopa() {
    drawTitle();
    drawScorePanel();
    drawAIHand();
    drawTable();
    drawPlayerHand();
    drawCapturePile(PLAYER_PILE_X, PLAYER_PILE_Y, playerCaptures, playerScopas, 'Your Pile');
    drawCapturePile(AI_PILE_X, AI_PILE_Y, aiCaptures, aiScopas, 'AI Pile');
    drawCaptureUI();
    drawInstructions();

    if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (i === selectedHandIdx) cy -= 18;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestTableCard(mx, my) {
    // Test in reverse for overlapping cards
    for (let i = table.length - 1; i >= 0; --i) {
      const pos = tableCardPos(i);
      if (CE.isInRect(mx, my, pos.x, pos.y, CE.CARD_W, CE.CARD_H))
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
      score = 0;
      cumulativePlayer = 0;
      cumulativeAI = 0;
      roundNumber = 0;
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawScopa();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          cumulativePlayer = 0;
          cumulativeAI = 0;
          roundNumber = 0;
          score = 0;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        setupRound();
        return;
      }

      if (roundOver || gameOver) return;

      // Player's turn: select hand card
      if (phase === PHASE_PLAY) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        selectedHandIdx = idx;
        selectedTableIdxs = [];

        const card = playerHand[idx];
        const combos = findCaptureCombinations(captureValue(card), table);

        if (combos.length === 0) {
          // No captures: place on table immediately
          playerPlayCard(idx, []);
          return;
        }

        // If exactly one combination, auto-select it
        if (combos.length === 1) {
          playerPlayCard(idx, combos[0]);
          return;
        }

        // Multiple combos: enter capture selection mode
        phase = PHASE_CAPTURE;
        return;
      }

      // Capture selection mode
      if (phase === PHASE_CAPTURE && selectedHandIdx >= 0) {
        // Click on a different hand card: switch selection
        const handIdx = hitTestPlayerCard(mx, my);
        if (handIdx >= 0 && handIdx !== selectedHandIdx) {
          selectedHandIdx = handIdx;
          selectedTableIdxs = [];

          const card = playerHand[handIdx];
          const combos = findCaptureCombinations(captureValue(card), table);
          if (combos.length === 0) {
            playerPlayCard(handIdx, []);
            return;
          }
          if (combos.length === 1) {
            playerPlayCard(handIdx, combos[0]);
            return;
          }
          return;
        }

        // Click confirm button
        const cardVal = captureValue(playerHand[selectedHandIdx]);
        const currentSum = selectedTableSum();
        if (currentSum === cardVal && selectedTableIdxs.length > 0) {
          if (CE.isInRect(mx, my, CONFIRM_BTN.x, CONFIRM_BTN.y, CONFIRM_BTN.w, CONFIRM_BTN.h)) {
            playerPlayCard(selectedHandIdx, selectedTableIdxs.slice());
            return;
          }
        }

        // Click "place on table" (only available when no captures possible -- shouldn't happen in capture mode, but handle edge case)
        const combos = findCaptureCombinations(cardVal, table);
        if (combos.length === 0) {
          const placeBtn = { x: CANVAS_W / 2 - 55, y: CONFIRM_BTN.y, w: 110, h: 28 };
          if (CE.isInRect(mx, my, placeBtn.x, placeBtn.y, placeBtn.w, placeBtn.h)) {
            playerPlayCard(selectedHandIdx, []);
            return;
          }
        }

        // Click table card: toggle selection
        const tableIdx = hitTestTableCard(mx, my);
        if (tableIdx >= 0) {
          const pos = selectedTableIdxs.indexOf(tableIdx);
          if (pos >= 0)
            selectedTableIdxs.splice(pos, 1);
          else {
            // Only add if it wouldn't exceed the target value
            const newSum = currentSum + captureValue(table[tableIdx]);
            if (newSum <= cardVal)
              selectedTableIdxs.push(tableIdx);
            else if (_host)
              _host.floatingText.add(mx, my - 20, 'Sum would exceed ' + cardVal + '!', { color: '#f88', size: 12 });
          }

          // Auto-confirm if sum matches exactly
          const updatedSum = selectedTableSum();
          if (updatedSum === cardVal && selectedTableIdxs.length > 0) {
            // Verify this is a valid combination
            playerPlayCard(selectedHandIdx, selectedTableIdxs.slice());
          }
          return;
        }

        // Click elsewhere: cancel selection
        selectedHandIdx = -1;
        selectedTableIdxs = [];
        phase = PHASE_PLAY;
        return;
      }
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAY) {
        hoverHandIdx = hitTestPlayerCard(mx, my);
        hoverTableIdx = -1;
      } else if (phase === PHASE_CAPTURE) {
        hoverHandIdx = hitTestPlayerCard(mx, my);
        hoverTableIdx = hitTestTableCard(mx, my);
      } else {
        hoverHandIdx = -1;
        hoverTableIdx = -1;
      }
    },

    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      // Escape cancels selection
      if (e.key === 'Escape' && phase === PHASE_CAPTURE) {
        selectedHandIdx = -1;
        selectedTableIdxs = [];
        phase = PHASE_PLAY;
      }
    },

    tick(dt) {
      if (roundOver && phase !== PHASE_ROUND_OVER) return;
      if (gameOver) return;

      if (phase === PHASE_AI_TURN) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTakeTurn();
        }
      }
    },

    cleanup() {
      playerHand = [];
      aiHand = [];
      table = [];
      stock = [];
      playerCaptures = [];
      aiCaptures = [];
      playerScopas = 0;
      aiScopas = 0;
      cumulativePlayer = 0;
      cumulativeAI = 0;
      lastCapturer = -1;
      roundOver = false;
      gameOver = false;
      roundBreakdown = null;
      selectedHandIdx = -1;
      selectedTableIdxs = [];
      hoverHandIdx = -1;
      hoverTableIdx = -1;
      aiTurnTimer = 0;
      dealTimer = 0;
      phase = PHASE_PLAY;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('scopa', module);

})();
