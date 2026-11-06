/* Faro: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.faro;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_BETTING, PHASE_RESULT, RANKS, RANK_LABELS, BOARD_X, BOARD_Y,
    CELL_W, CELL_H, CELL_GAP, CELLS_PER_ROW, DRAWN_X, DRAWN_Y, DRAWN_GAP, CASE_KEEPER_X,
    CASE_KEEPER_Y, CK_ROW_H, CHIP_DENOMINATIONS, CHIP_COLORS, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H,
    CHIP_BTN_GAP, DEAL_BTN, CLEAR_BTN, HIGHCARD_BTN } = V;

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

  function drawFaro() {
    // Title
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Faro', CANVAS_W / 2, 35);

    // Subtitle
    S._ctx.fillStyle = '#999';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('The Frontier Casino Game', CANVAS_W / 2, 52);

    // Chips & deck info (top right)
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Chips: ' + S.score, CANVAS_W - 20, 30);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Deck: ' + S.deck.length + '  Turn: ' + S.turnNumber + '/' + S.maxTurns, CANVAS_W - 20, 48);

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
    if (S.resultMsg) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.font = 'bold 15px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H - 10);
    }
  }

  function drawBoard() {
    const hintMax = (S._host && S._host.hintsEnabled) ? V.maxRemainingCount() : 0;

    for (let i = 0; i < RANKS.length; ++i) {
      const { x, y } = cellPos(i);
      const rank = RANKS[i];
      const remaining = S.caseKeeper[rank];
      const hasBet = S.bets[rank] && S.bets[rank] > 0;
      const isHover = S.hoverCell === i && S.phase === PHASE_BETTING;

      // Hint glow for ranks with most remaining cards
      if (S._host && S._host.hintsEnabled && remaining === hintMax && remaining > 0)
        CE.drawHintGlow(S._ctx, x - 2, y - 2, CELL_W + 4, CELL_H + 4, S._host.hintTime);

      // Cell background
      CE.drawRoundedRect(S._ctx, x, y, CELL_W, CELL_H, 5);
      if (hasBet)
        S._ctx.fillStyle = 'rgba(255,200,0,0.2)';
      else if (isHover)
        S._ctx.fillStyle = 'rgba(255,255,255,0.12)';
      else
        S._ctx.fillStyle = remaining > 0 ? 'rgba(255,255,255,0.06)' : 'rgba(80,80,80,0.15)';
      S._ctx.fill();

      // Cell border
      S._ctx.strokeStyle = hasBet ? '#fa0' : (remaining > 0 ? 'rgba(255,255,255,0.3)' : 'rgba(100,100,100,0.3)');
      S._ctx.lineWidth = hasBet ? 2 : 1;
      S._ctx.stroke();

      // Rank label
      S._ctx.fillStyle = remaining > 0 ? '#fff' : '#666';
      S._ctx.font = 'bold 20px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(RANK_LABELS[i], x + CELL_W / 2, y + 28);

      // Remaining count
      S._ctx.fillStyle = remaining > 2 ? '#8f8' : (remaining > 0 ? '#fa0' : '#555');
      S._ctx.font = '11px sans-serif';
      S._ctx.fillText(remaining + ' left', x + CELL_W / 2, y + 45);

      // Bet amount
      if (hasBet) {
        S._ctx.fillStyle = '#fc0';
        S._ctx.font = 'bold 12px sans-serif';
        S._ctx.fillText('$' + S.bets[rank], x + CELL_W / 2, y + CELL_H - 6);
      }

      // Highlight if this rank was just drawn
      if (S.loserCard && S.loserCard.rank === rank && S.phase === PHASE_RESULT) {
        S._ctx.strokeStyle = '#f44';
        S._ctx.lineWidth = 2.5;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CELL_W + 2, CELL_H + 2, 6);
        S._ctx.stroke();
      }
      if (S.winnerCard && S.winnerCard.rank === rank && S.phase === PHASE_RESULT) {
        S._ctx.strokeStyle = '#4f4';
        S._ctx.lineWidth = 2.5;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CELL_W + 2, CELL_H + 2, 6);
        S._ctx.stroke();
      }
    }
  }

  function drawDealtCards() {
    // Labels
    S._ctx.fillStyle = '#f66';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Loser', DRAWN_X + CE.CARD_W / 2, DRAWN_Y - 8);

    S._ctx.fillStyle = '#6f6';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.fillText('Winner', DRAWN_X + DRAWN_GAP + CE.CARD_W / 2, DRAWN_Y - 8);

    if (S.loserCard && !S.loserCard._dealing)
      CE.drawCardFace(S._ctx, DRAWN_X, DRAWN_Y, S.loserCard);
    else {
      CE.drawRoundedRect(S._ctx, DRAWN_X, DRAWN_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.fillStyle = 'rgba(255,100,100,0.08)';
      S._ctx.fill();
      S._ctx.strokeStyle = 'rgba(255,100,100,0.3)';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();
    }

    if (S.winnerCard && !S.winnerCard._dealing)
      CE.drawCardFace(S._ctx, DRAWN_X + DRAWN_GAP, DRAWN_Y, S.winnerCard);
    else {
      CE.drawRoundedRect(S._ctx, DRAWN_X + DRAWN_GAP, DRAWN_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.fillStyle = 'rgba(100,255,100,0.08)';
      S._ctx.fill();
      S._ctx.strokeStyle = 'rgba(100,255,100,0.3)';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();
    }
  }

  function drawCaseKeeper() {
    // Header
    S._ctx.fillStyle = '#cdf';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Case Keeper', CASE_KEEPER_X, CASE_KEEPER_Y - 5);

    S._ctx.fillStyle = '#888';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('Cards remaining by rank', CASE_KEEPER_X, CASE_KEEPER_Y + 10);

    // Background panel
    const panelH = RANKS.length * CK_ROW_H + 10;
    CE.drawRoundedRect(S._ctx, CASE_KEEPER_X - 5, CASE_KEEPER_Y + 16, 200, panelH, 5);
    S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    for (let i = 0; i < RANKS.length; ++i) {
      const rank = RANKS[i];
      const count = S.caseKeeper[rank];
      const rowY = CASE_KEEPER_Y + 30 + i * CK_ROW_H;

      // Rank label
      S._ctx.fillStyle = count > 0 ? '#ddd' : '#555';
      S._ctx.font = 'bold 12px monospace';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(RANK_LABELS[i].padStart(2), CASE_KEEPER_X + 5, rowY);

      // Pips showing remaining
      for (let p = 0; p < 4; ++p) {
        const px = CASE_KEEPER_X + 35 + p * 18;
        S._ctx.beginPath();
        S._ctx.arc(px, rowY - 3, 5, 0, Math.PI * 2);
        if (p < count) {
          S._ctx.fillStyle = count === 4 ? '#4a4' : (count >= 2 ? '#aa4' : '#a44');
          S._ctx.fill();
        } else {
          S._ctx.fillStyle = 'rgba(255,255,255,0.08)';
          S._ctx.fill();
        }
        S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        S._ctx.lineWidth = 0.5;
        S._ctx.stroke();
      }

      // Numeric count
      S._ctx.fillStyle = count > 0 ? '#aaa' : '#444';
      S._ctx.font = '11px monospace';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('(' + count + ')', CASE_KEEPER_X + 110, rowY);

      // Probability
      if (S.deck.length > 0 && count > 0) {
        const pct = ((count / S.deck.length) * 100).toFixed(1);
        S._ctx.fillStyle = '#777';
        S._ctx.font = '10px monospace';
        S._ctx.fillText(pct + '%', CASE_KEEPER_X + 145, rowY);
      }
    }
  }

  function drawHighCardArea() {
    const hasBet = S.highCardBet > 0;
    const bg = hasBet ? 'rgba(255,200,0,0.2)' : 'rgba(255,255,255,0.08)';
    const border = hasBet ? '#fa0' : 'rgba(255,255,255,0.3)';

    CE.drawRoundedRect(S._ctx, HIGHCARD_BTN.x, HIGHCARD_BTN.y, HIGHCARD_BTN.w, HIGHCARD_BTN.h, 5);
    S._ctx.fillStyle = bg;
    S._ctx.fill();
    S._ctx.strokeStyle = border;
    S._ctx.lineWidth = hasBet ? 2 : 1;
    S._ctx.stroke();

    S._ctx.fillStyle = hasBet ? '#fc0' : '#ccc';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('High Card' + (hasBet ? ' $' + S.highCardBet : ''), HIGHCARD_BTN.x + HIGHCARD_BTN.w / 2, HIGHCARD_BTN.y + 19);
  }

  function drawControls() {
    if (S.phase !== PHASE_BETTING) return;

    // Chip selector buttons
    for (let i = 0; i < CHIP_DENOMINATIONS.length; ++i) {
      const cx = chipBtnX(i);
      const chip = CHIP_DENOMINATIONS[i];
      const isSelected = S.selectedChip === chip;
      const bg = CHIP_COLORS[chip];
      const border = isSelected ? '#fc0' : '#888';
      CE.drawButton(S._ctx, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H, '$' + chip, { bg, border, fontSize: 12 });
      if (isSelected) {
        S._ctx.strokeStyle = '#fc0';
        S._ctx.lineWidth = 2;
        CE.drawRoundedRect(S._ctx, cx - 2, CHIP_BTN_Y - 2, CHIP_BTN_W + 4, CHIP_BTN_H + 4, 8);
        S._ctx.stroke();
      }
    }

    // Clear button
    if (V.totalBets() > 0)
      CE.drawButton(S._ctx, CLEAR_BTN.x, CLEAR_BTN.y, CLEAR_BTN.w, CLEAR_BTN.h, 'Clear (C)', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });

    // Deal button
    const canDeal = V.totalBets() > 0 && S.deck.length >= 2;
    CE.drawButton(
      S._ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
      'Deal (D)',
      { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
    );

    // Instructions
    if (V.totalBets() <= 0) {
      S._ctx.fillStyle = '#888';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Place bets on ranks, then Deal', CANVAS_W / 2, CANVAS_H - 10);
    }
  }

  Object.assign(V, { cellPos, chipBtnX, drawFaro });

})();
