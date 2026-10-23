;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CE = SZ.CardEngine;
  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BETTING = 'BETTING';
  const PHASE_DEALING = 'DEALING';
  const PHASE_RESULT = 'RESULT';

  /* ── Layout constants ── */
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const BOARD_X = 30;
  const BOARD_Y = 80;
  const CELL_W = 58;
  const CELL_H = 70;
  const CELL_GAP = 4;
  const CELLS_PER_ROW = 7;

  const DRAWN_X = 540;
  const DRAWN_Y = 85;
  const DRAWN_GAP = 90;

  const CASE_KEEPER_X = 550;
  const CASE_KEEPER_Y = 250;
  const CK_ROW_H = 18;

  const CHIP_DENOMINATIONS = [10, 25, 50];
  const CHIP_COLORS = { 10: '#2266cc', 25: '#22aa44', 50: '#cc4422' };
  const CHIP_BTN_Y = 555;
  const CHIP_BTN_W = 50;
  const CHIP_BTN_H = 30;
  const CHIP_BTN_GAP = 10;

  const DEAL_BTN = { x: 720, y: 555, w: 90, h: 30 };
  const CLEAR_BTN = { x: 620, y: 555, w: 70, h: 30 };
  const HIGHCARD_BTN = { x: 540, y: 200, w: 120, h: 30 };

  /* ── Game state ── */
  let deck = [];
  let bets = {};          // rank -> bet amount
  let highCardBet = 0;
  let selectedChip = 10;
  let score = 500;
  let phase = PHASE_BETTING;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let turnNumber = 0;
  let maxTurns = 25;
  let loserCard = null;
  let winnerCard = null;
  let caseKeeper = {};    // rank -> count remaining (0-4)
  let dealTimer = 0;
  let dealStep = 0;
  let hoverCell = -1;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     LAYOUT HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function cellPos(index) {
    const row = Math.floor(index / CELLS_PER_ROW);
    const col = index % CELLS_PER_ROW;
    return {
      x: BOARD_X + col * (CELL_W + CELL_GAP),
      y: BOARD_Y + row * (CELL_H + CELL_GAP)
    };
  }

  function chipBtnX(index) {
    return BOARD_X + index * (CHIP_BTN_W + CHIP_BTN_GAP);
  }

  function totalBets() {
    let sum = highCardBet;
    for (const r of RANKS)
      if (bets[r]) sum += bets[r];
    return sum;
  }

  /* ══════════════════════════════════════════════════════════════════
     CASE KEEPER
     ══════════════════════════════════════════════════════════════════ */

  function initCaseKeeper() {
    caseKeeper = {};
    for (const r of RANKS)
      caseKeeper[r] = 4;
  }

  function updateCaseKeeper(card) {
    if (card && caseKeeper[card.rank] > 0)
      --caseKeeper[card.rank];
  }

  function maxRemainingCount() {
    let max = 0;
    for (const r of RANKS)
      if (caseKeeper[r] > max) max = caseKeeper[r];
    return max;
  }

  /* ══════════════════════════════════════════════════════════════════
     RANK VALUE (for high-card comparison)
     ══════════════════════════════════════════════════════════════════ */

  function rankValue(rank) {
    return RANKS.indexOf(rank);
  }

  /* ══════════════════════════════════════════════════════════════════
     BETTING
     ══════════════════════════════════════════════════════════════════ */

  function placeBetOnRank(rank) {
    if (phase !== PHASE_BETTING) return;
    if (selectedChip > score - totalBets()) return;
    if (!bets[rank]) bets[rank] = 0;
    bets[rank] += selectedChip;
    if (bets[rank] > score - totalBets() + bets[rank])
      bets[rank] = score;
  }

  function placeBetHighCard() {
    if (phase !== PHASE_BETTING) return;
    if (selectedChip > score - totalBets()) return;
    highCardBet += selectedChip;
    if (highCardBet > score)
      highCardBet = score;
  }

  function clearAllBets() {
    bets = {};
    highCardBet = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     DEALING & GAME FLOW
     ══════════════════════════════════════════════════════════════════ */

  function startDeal() {
    if (phase !== PHASE_BETTING) return;
    if (totalBets() <= 0) return;
    if (deck.length < 2) {
      endGame();
      return;
    }
    phase = PHASE_DEALING;
    loserCard = null;
    winnerCard = null;
    resultMsg = '';
    dealStep = 0;
    dealTimer = 0;
  }

  function dealNextCard() {
    const card = deck.pop();
    card.faceUp = true;

    if (dealStep === 0) {
      loserCard = card;
      if (_host)
        _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, DRAWN_X, DRAWN_Y, 0);
      updateCaseKeeper(card);
    } else {
      winnerCard = card;
      if (_host)
        _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, DRAWN_X + DRAWN_GAP, DRAWN_Y, 0);
      updateCaseKeeper(card);
    }
    ++dealStep;
  }

  function resolveTurn() {
    phase = PHASE_RESULT;
    ++turnNumber;

    let netChange = 0;
    const isSplit = loserCard.rank === winnerCard.rank;

    // Resolve rank bets
    for (const r of RANKS) {
      if (!bets[r] || bets[r] <= 0) continue;

      if (isSplit && r === loserCard.rank) {
        // Split: house takes half
        const halfLoss = Math.floor(bets[r] / 2);
        netChange -= halfLoss;
        if (_host)
          _host.floatingText.add(cellPos(RANKS.indexOf(r)).x + CELL_W / 2, cellPos(RANKS.indexOf(r)).y, 'SPLIT -' + halfLoss, { color: '#fa0', size: 14 });
        bets[r] -= halfLoss;
      } else if (r === winnerCard.rank) {
        // Winner: player wins even money
        const win = bets[r];
        netChange += win;
        if (_host) {
          const pos = cellPos(RANKS.indexOf(r));
          _host.floatingText.add(pos.x + CELL_W / 2, pos.y, '+' + win, { color: '#4f4', size: 16 });
          _host.triggerChipSparkle(pos.x + CELL_W / 2, pos.y + CELL_H / 2);
        }
        bets[r] = 0;
      } else if (r === loserCard.rank) {
        // Loser: player loses bet
        const loss = bets[r];
        netChange -= loss;
        if (_host) {
          const pos = cellPos(RANKS.indexOf(r));
          _host.floatingText.add(pos.x + CELL_W / 2, pos.y, '-' + loss, { color: '#f44', size: 16 });
        }
        bets[r] = 0;
      }
      // else: bet stays for next turn
    }

    // Resolve high-card bet
    if (highCardBet > 0) {
      if (isSplit) {
        // Split on high card: push
        if (_host)
          _host.floatingText.add(HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y, 'PUSH', { color: '#ff8', size: 14 });
      } else {
        const wVal = rankValue(winnerCard.rank);
        const lVal = rankValue(loserCard.rank);
        if (wVal > lVal) {
          netChange += highCardBet;
          if (_host)
            _host.floatingText.add(HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y, '+' + highCardBet, { color: '#4f4', size: 14 });
        } else {
          netChange -= highCardBet;
          if (_host)
            _host.floatingText.add(HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y, '-' + highCardBet, { color: '#f44', size: 14 });
        }
        highCardBet = 0;
      }
    }

    score += netChange;

    if (netChange > 0) {
      resultMsg = 'Won ' + netChange + ' chips! Click to continue';
      if (_host) {
        _host.particles.confetti(CANVAS_W / 2, 200, 20);
        _host.addGlow(DRAWN_X + DRAWN_GAP, DRAWN_Y, CE.CARD_W, CE.CARD_H, 1.5);
      }
    } else if (netChange < 0) {
      resultMsg = 'Lost ' + Math.abs(netChange) + ' chips. Click to continue';
      if (_host)
        _host.screenShake.trigger(5, 250);
    } else {
      resultMsg = 'No change. Click to continue';
    }

    roundOver = true;

    if (score <= 0) {
      score = 0;
      gameOver = true;
      resultMsg = 'GAME OVER - Busted!';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    } else if (turnNumber >= maxTurns || deck.length < 2) {
      endGame();
    }

    if (_host) _host.onScoreChanged(score);
  }

  function endGame() {
    roundOver = true;
    gameOver = true;
    if (score > 500)
      resultMsg = 'Deck exhausted! Final chips: ' + score + ' - You profit!';
    else if (score === 500)
      resultMsg = 'Deck exhausted! Broke even.';
    else
      resultMsg = 'Deck exhausted! Final chips: ' + score;
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#ff8', size: 30 });
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupFaro() {
    // Burn the first card (soda) as per historic Faro rules
    deck = CE.shuffle(CE.createDeck());
    const sodaCard = deck.pop();
    initCaseKeeper();
    updateCaseKeeper(sodaCard);

    bets = {};
    highCardBet = 0;
    selectedChip = 10;
    phase = PHASE_BETTING;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    turnNumber = 0;
    maxTurns = Math.floor((deck.length) / 2);
    loserCard = null;
    winnerCard = null;
    dealStep = 0;
    dealTimer = 0;
    hoverCell = -1;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawFaro() {
    // Title
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Faro', CANVAS_W / 2, 35);

    // Subtitle
    _ctx.fillStyle = '#999';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('The Frontier Casino Game', CANVAS_W / 2, 52);

    // Chips & deck info (top right)
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Chips: ' + score, CANVAS_W - 20, 30);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Deck: ' + deck.length + '  Turn: ' + turnNumber + '/' + maxTurns, CANVAS_W - 20, 48);

    // Draw the layout board (13 rank positions)
    drawBoard();

    // Draw dealt cards area
    drawDealtCards();

    // Draw case keeper
    drawCaseKeeper();

    // Draw high-card bet button
    drawHighCardArea();

    // Draw chip selector & action buttons
    drawControls();

    // Result message
    if (resultMsg) {
      _ctx.fillStyle = '#ff8';
      _ctx.font = 'bold 15px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H - 10);
    }
  }

  function drawBoard() {
    const hintMax = (_host && _host.hintsEnabled) ? maxRemainingCount() : 0;

    for (let i = 0; i < RANKS.length; ++i) {
      const { x, y } = cellPos(i);
      const rank = RANKS[i];
      const remaining = caseKeeper[rank];
      const hasBet = bets[rank] && bets[rank] > 0;
      const isHover = hoverCell === i && phase === PHASE_BETTING;

      // Hint glow for ranks with most remaining cards
      if (_host && _host.hintsEnabled && remaining === hintMax && remaining > 0)
        CE.drawHintGlow(_ctx, x - 2, y - 2, CELL_W + 4, CELL_H + 4, _host.hintTime);

      // Cell background
      CE.drawRoundedRect(_ctx, x, y, CELL_W, CELL_H, 5);
      if (hasBet)
        _ctx.fillStyle = 'rgba(255,200,0,0.2)';
      else if (isHover)
        _ctx.fillStyle = 'rgba(255,255,255,0.12)';
      else
        _ctx.fillStyle = remaining > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(80,80,80,0.15)';
      _ctx.fill();

      // Cell border
      _ctx.strokeStyle = hasBet ? '#fa0' : (remaining > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(100,100,100,0.3)');
      _ctx.lineWidth = hasBet ? 2 : 1;
      _ctx.stroke();

      // Rank label
      _ctx.fillStyle = remaining > 0 ? '#fff' : '#666';
      _ctx.font = 'bold 20px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(RANK_LABELS[i], x + CELL_W / 2, y + 28);

      // Remaining count
      _ctx.fillStyle = remaining > 2 ? '#8f8' : (remaining > 0 ? '#fa0' : '#555');
      _ctx.font = '11px sans-serif';
      _ctx.fillText(remaining + ' left', x + CELL_W / 2, y + 45);

      // Bet amount
      if (hasBet) {
        _ctx.fillStyle = '#fc0';
        _ctx.font = 'bold 12px sans-serif';
        _ctx.fillText('$' + bets[rank], x + CELL_W / 2, y + CELL_H - 6);
      }

      // Highlight if this rank was just drawn
      if (loserCard && loserCard.rank === rank && phase === PHASE_RESULT) {
        _ctx.strokeStyle = '#f44';
        _ctx.lineWidth = 2.5;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CELL_W + 2, CELL_H + 2, 6);
        _ctx.stroke();
      }
      if (winnerCard && winnerCard.rank === rank && phase === PHASE_RESULT) {
        _ctx.strokeStyle = '#4f4';
        _ctx.lineWidth = 2.5;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CELL_W + 2, CELL_H + 2, 6);
        _ctx.stroke();
      }
    }
  }

  function drawDealtCards() {
    // Labels
    _ctx.fillStyle = '#f66';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Loser', DRAWN_X + CE.CARD_W / 2, DRAWN_Y - 8);

    _ctx.fillStyle = '#6f6';
    _ctx.font = 'bold 13px sans-serif';
    _ctx.fillText('Winner', DRAWN_X + DRAWN_GAP + CE.CARD_W / 2, DRAWN_Y - 8);

    if (loserCard && !loserCard._dealing)
      CE.drawCardFace(_ctx, DRAWN_X, DRAWN_Y, loserCard);
    else {
      CE.drawRoundedRect(_ctx, DRAWN_X, DRAWN_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.fillStyle = 'rgba(255,100,100,0.08)';
      _ctx.fill();
      _ctx.strokeStyle = 'rgba(255,100,100,0.3)';
      _ctx.lineWidth = 1;
      _ctx.stroke();
    }

    if (winnerCard && !winnerCard._dealing)
      CE.drawCardFace(_ctx, DRAWN_X + DRAWN_GAP, DRAWN_Y, winnerCard);
    else {
      CE.drawRoundedRect(_ctx, DRAWN_X + DRAWN_GAP, DRAWN_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.fillStyle = 'rgba(100,255,100,0.08)';
      _ctx.fill();
      _ctx.strokeStyle = 'rgba(100,255,100,0.3)';
      _ctx.lineWidth = 1;
      _ctx.stroke();
    }
  }

  function drawCaseKeeper() {
    // Header
    _ctx.fillStyle = '#cdf';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Case Keeper', CASE_KEEPER_X, CASE_KEEPER_Y - 5);

    _ctx.fillStyle = '#888';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('Cards remaining by rank', CASE_KEEPER_X, CASE_KEEPER_Y + 10);

    // Background panel
    const panelH = RANKS.length * CK_ROW_H + 10;
    CE.drawRoundedRect(_ctx, CASE_KEEPER_X - 5, CASE_KEEPER_Y + 16, 200, panelH, 5);
    _ctx.fillStyle = 'rgba(0,0,0,0.35)';
    _ctx.fill();
    _ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    _ctx.lineWidth = 1;
    _ctx.stroke();

    for (let i = 0; i < RANKS.length; ++i) {
      const rank = RANKS[i];
      const count = caseKeeper[rank];
      const rowY = CASE_KEEPER_Y + 30 + i * CK_ROW_H;

      // Rank label
      _ctx.fillStyle = count > 0 ? '#ddd' : '#555';
      _ctx.font = 'bold 12px monospace';
      _ctx.textAlign = 'left';
      _ctx.fillText(RANK_LABELS[i].padStart(2), CASE_KEEPER_X + 5, rowY);

      // Pips showing remaining
      for (let p = 0; p < 4; ++p) {
        const px = CASE_KEEPER_X + 35 + p * 18;
        _ctx.beginPath();
        _ctx.arc(px, rowY - 3, 5, 0, Math.PI * 2);
        if (p < count) {
          _ctx.fillStyle = count === 4 ? '#4a4' : (count >= 2 ? '#aa4' : '#a44');
          _ctx.fill();
        } else {
          _ctx.fillStyle = 'rgba(255,255,255,0.08)';
          _ctx.fill();
        }
        _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        _ctx.lineWidth = 0.5;
        _ctx.stroke();
      }

      // Numeric count
      _ctx.fillStyle = count > 0 ? '#aaa' : '#444';
      _ctx.font = '11px monospace';
      _ctx.textAlign = 'left';
      _ctx.fillText('(' + count + ')', CASE_KEEPER_X + 110, rowY);

      // Probability
      if (deck.length > 0 && count > 0) {
        const pct = ((count / deck.length) * 100).toFixed(1);
        _ctx.fillStyle = '#777';
        _ctx.font = '10px monospace';
        _ctx.fillText(pct + '%', CASE_KEEPER_X + 145, rowY);
      }
    }
  }

  function drawHighCardArea() {
    const hasBet = highCardBet > 0;
    const bg = hasBet ? 'rgba(255,200,0,0.2)' : 'rgba(255,255,255,0.08)';
    const border = hasBet ? '#fa0' : 'rgba(255,255,255,0.3)';

    CE.drawRoundedRect(_ctx, HIGHCARD_BTN.x, HIGHCARD_BTN.y, HIGHCARD_BTN.w, HIGHCARD_BTN.h, 5);
    _ctx.fillStyle = bg;
    _ctx.fill();
    _ctx.strokeStyle = border;
    _ctx.lineWidth = hasBet ? 2 : 1;
    _ctx.stroke();

    _ctx.fillStyle = hasBet ? '#fc0' : '#ccc';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('High Card' + (hasBet ? ' $' + highCardBet : ''), HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y + 19);
  }

  function drawControls() {
    if (phase !== PHASE_BETTING) return;

    // Chip selector buttons
    for (let i = 0; i < CHIP_DENOMINATIONS.length; ++i) {
      const cx = chipBtnX(i);
      const chip = CHIP_DENOMINATIONS[i];
      const isSelected = selectedChip === chip;
      const bg = CHIP_COLORS[chip];
      const border = isSelected ? '#fc0' : '#888';
      CE.drawButton(_ctx, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H, '$' + chip, { bg, border, fontSize: 12 });
      if (isSelected) {
        _ctx.strokeStyle = '#fc0';
        _ctx.lineWidth = 2;
        CE.drawRoundedRect(_ctx, cx - 2, CHIP_BTN_Y - 2, CHIP_BTN_W + 4, CHIP_BTN_H + 4, 8);
        _ctx.stroke();
      }
    }

    // Clear button
    if (totalBets() > 0)
      CE.drawButton(_ctx, CLEAR_BTN.x, CLEAR_BTN.y, CLEAR_BTN.w, CLEAR_BTN.h, 'Clear (C)', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });

    // Deal button
    const canDeal = totalBets() > 0 && deck.length >= 2;
    CE.drawButton(
      _ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
      'Deal (D)',
      { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
    );

    // Instructions
    if (totalBets() <= 0) {
      _ctx.fillStyle = '#888';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Place bets on ranks, then Deal', CANVAS_W / 2, CANVAS_H - 10);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleClick(mx, my) {
    if (roundOver || gameOver) {
      if (_host) _host.onRoundOver(gameOver);
      return;
    }

    if (phase === PHASE_BETTING) {
      // Rank cell clicks
      for (let i = 0; i < RANKS.length; ++i) {
        const { x, y } = cellPos(i);
        if (CE.isInRect(mx, my, x, y, CELL_W, CELL_H)) {
          if (caseKeeper[RANKS[i]] > 0)
            placeBetOnRank(RANKS[i]);
          return;
        }
      }

      // High card bet
      if (CE.isInRect(mx, my, HIGHCARD_BTN.x, HIGHCARD_BTN.y, HIGHCARD_BTN.w, HIGHCARD_BTN.h)) {
        placeBetHighCard();
        return;
      }

      // Chip selector clicks
      for (let i = 0; i < CHIP_DENOMINATIONS.length; ++i) {
        const cx = chipBtnX(i);
        if (CE.isInRect(mx, my, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H)) {
          selectedChip = CHIP_DENOMINATIONS[i];
          return;
        }
      }

      // Deal button
      if (CE.isInRect(mx, my, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h)) {
        startDeal();
        return;
      }

      // Clear button
      if (totalBets() > 0 && CE.isInRect(mx, my, CLEAR_BTN.x, CLEAR_BTN.y, CLEAR_BTN.w, CLEAR_BTN.h)) {
        clearAllBets();
        return;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TICK (animation timing)
     ══════════════════════════════════════════════════════════════════ */

  function tick(dt) {
    if (phase === PHASE_DEALING) {
      dealTimer += dt;
      if (dealTimer >= 0.4) {
        dealTimer = 0;
        dealNextCard();
        if (dealStep >= 2)
          resolveTurn();
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 500;
      if (score <= 0) score = 500;
      setupFaro();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawFaro();
    },

    handleClick(mx, my) {
      handleClick(mx, my);
    },

    handlePointerMove(mx, my) {
      hoverCell = -1;
      if (phase !== PHASE_BETTING) return;
      for (let i = 0; i < RANKS.length; ++i) {
        const { x, y } = cellPos(i);
        if (CE.isInRect(mx, my, x, y, CELL_W, CELL_H)) {
          hoverCell = i;
          return;
        }
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      const k = e.key.toLowerCase();
      if (k === 'd') startDeal();
      else if (k === 'c') clearAllBets();
      else if (k === '1') selectedChip = 10;
      else if (k === '2') selectedChip = 25;
      else if (k === '3') selectedChip = 50;
      else if (k === 'h') placeBetHighCard();
    },

    tick(dt) {
      tick(dt);
    },

    cleanup() {
      deck = [];
      bets = {};
      highCardBet = 0;
      loserCard = null;
      winnerCard = null;
      caseKeeper = {};
      phase = PHASE_BETTING;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      hoverCell = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('faro', module);

})();
