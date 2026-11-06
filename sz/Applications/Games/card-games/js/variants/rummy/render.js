/* Rummy drawing: table, melds, the player hand and the round-over overlay. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.rummy;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PENALTY_LIMIT, PLAYER_NAMES, PHASE_DRAW, PHASE_MELD,
    PHASE_DISCARD, PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y,
    MELD_AREA_Y, DRAW_BTN, MELD_BTN, LAYOFF_BTN, DISCARD_BTN } = V;

  const MELD_AREA_X = 300;

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
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, CANVAS_W - 195, 5, 185, 80, 6);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Penalties (game over at ' + PENALTY_LIMIT + ')', CANVAS_W - 187, 10);
    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], CANVAS_W - 187, 28 + p * 16);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.penaltyScores[p], CANVAS_W - 18, 28 + p * 16);
    }
    S._ctx.restore();

    if (S.phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    // AI hands (face down) at top
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const startX = p === 1 ? 30 : CANVAS_W / 2 + 50;
      const label = PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')';
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(label, startX, 15);
      for (let i = 0; i < S.hands[p].length; ++i)
        CE.drawCardBack(S._ctx, startX + i * 22, 28, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Stock pile
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 10);
    if (S.stockPile.length > 0) {
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);
      S._ctx.fillText('' + S.stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 12);
    } else
      CE.drawEmptySlot(S._ctx, STOCK_X, STOCK_Y);

    // Discard pile
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 10);
    if (S.discardPile.length > 0) {
      const showCount = Math.min(S.discardPile.length, 4);
      const startIdx = S.discardPile.length - showCount;
      for (let i = startIdx; i < S.discardPile.length; ++i) {
        const offset = (i - startIdx) * 16;
        CE.drawCardFace(S._ctx, DISCARD_X + offset, DISCARD_Y, S.discardPile[i]);
      }
      // Clickable highlight in DRAW phase
      if (S.phase === PHASE_DRAW) {
        S._ctx.fillStyle = 'rgba(255,255,0,0.15)';
        const lastX = DISCARD_X + (showCount - 1) * 16;
        CE.drawRoundedRect(S._ctx, lastX - 1, DISCARD_Y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.fill();
      }
    } else
      CE.drawEmptySlot(S._ctx, DISCARD_X, DISCARD_Y);

    // Table melds
    drawTableMelds();

    // Action buttons (only during player's turn)
    if (S.currentPlayer === 0) {
      if (S.phase === PHASE_DRAW) {
        CE.drawButton(S._ctx, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h, 'Draw', { bg: '#1a3a1a', border: '#4a4' });
      } else if (S.phase === PHASE_MELD) {
        if (S.selectedIndices.length >= 3)
          CE.drawButton(S._ctx, MELD_BTN.x, MELD_BTN.y, MELD_BTN.w, MELD_BTN.h, 'Meld', { bg: '#2a2a5a', border: '#88f' });
        if (S.selectedIndices.length === 1 && V.findLayOffTarget(S.hands[0][S.selectedIndices[0]]) >= 0)
          CE.drawButton(S._ctx, LAYOFF_BTN.x, LAYOFF_BTN.y, LAYOFF_BTN.w, LAYOFF_BTN.h, 'Lay Off', { bg: '#3a3a1a', border: '#cc8' });
        CE.drawButton(S._ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#3a1a1a', border: '#c44' });
      } else if (S.phase === PHASE_DISCARD) {
        if (S.selectedIndices.length === 1)
          CE.drawButton(S._ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#3a1a1a', border: '#c44' });
      }
    }

    // Player hand at bottom
    drawPlayerHand();

    // Phase prompts
    S._ctx.textAlign = 'center';
    S._ctx.font = '13px sans-serif';
    if (S.currentPlayer === 0) {
      if (S.phase === PHASE_DRAW) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Draw from Stock or Discard pile', CANVAS_W / 2, CANVAS_H - 8);
      } else if (S.phase === PHASE_MELD) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Select cards to Meld/Lay Off, or Discard to end turn', CANVAS_W / 2, CANVAS_H - 8);
      } else if (S.phase === PHASE_DISCARD) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Select a card and click Discard', CANVAS_W / 2, CANVAS_H - 8);
      }
    } else if (S.phase === PHASE_AI_THINKING) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.fillText(PLAYER_NAMES[S.currentPlayer] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  function drawTableMelds() {
    if (S.tableMelds.length === 0) {
      S._ctx.fillStyle = 'rgba(255,255,255,0.15)';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Table Melds', MELD_AREA_X + 150, MELD_AREA_Y - 4);
      S._ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, MELD_AREA_X, MELD_AREA_Y, 580, 80, 6);
      S._ctx.stroke();
      return;
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Table Melds:', MELD_AREA_X, MELD_AREA_Y - 4);

    let mx = MELD_AREA_X;
    let my = MELD_AREA_Y + 4;
    const cardScale = 0.6;
    const cw = CE.CARD_W * cardScale;
    const ch = CE.CARD_H * cardScale;
    const cardSpacing = 32;
    const meldGap = 14;

    for (let m = 0; m < S.tableMelds.length; ++m) {
      const meld = S.tableMelds[m];
      // Wrap to next row if needed
      if (mx + meld.cards.length * cardSpacing + cw > CANVAS_W - 10) {
        mx = MELD_AREA_X;
        my += ch + 8;
      }

      // Owner indicator
      const ownerColor = meld.owner === 0 ? '#8f8' : '#fa0';
      S._ctx.fillStyle = ownerColor;
      S._ctx.font = '8px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(PLAYER_NAMES[meld.owner], mx + (meld.cards.length * cardSpacing) / 2, my - 2);

      for (let c = 0; c < meld.cards.length; ++c) {
        const card = meld.cards[c];
        card.faceUp = true;
        CE.drawCardFace(S._ctx, mx + c * cardSpacing, my, card, cw, ch);
      }
      mx += meld.cards.length * cardSpacing + meldGap;
    }
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    // Hand penalty
    let handPenalty = 0;
    for (const c of hand) handPenalty += V.cardPenalty(c);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Hand (penalty: ' + handPenalty + ')', 80, CANVAS_H - CE.CARD_H - 38);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isSelected = S.selectedIndices.includes(i);
      const y = isSelected ? (CANVAS_H - CE.CARD_H - 35) : (CANVAS_H - CE.CARD_H - 20);

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && (S.phase === PHASE_MELD || S.phase === PHASE_DRAW) && V.cardHasHint(hand, i))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Selection highlight
      if (isSelected) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawRoundOver() {
    S._ctx.save();
    const pw = 380;
    const ph = 280;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round Over', CANVAS_W / 2, py + 14);

    // Round breakdown
    S._ctx.font = '12px sans-serif';
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Hand Penalty  |  Total Penalty', CANVAS_W / 2, py + 44);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 68 + p * 28;
      let handPenalty = 0;
      for (const c of S.hands[p]) handPenalty += V.cardPenalty(c);

      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 16, y);
      S._ctx.textAlign = 'center';
      S._ctx.fillStyle = handPenalty === 0 ? '#4f4' : '#f88';
      S._ctx.fillText(handPenalty === 0 ? 'Out!' : '+' + handPenalty, px + 170, y);
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.penaltyScores[p], px + pw - 24, y);
    }

    // Result message
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.resultMsg, CANVAS_W / 2, py + ph - 55);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 22);
    S._ctx.restore();
  }

  Object.assign(V, { playerCardX, drawStraightRummy });

})();
