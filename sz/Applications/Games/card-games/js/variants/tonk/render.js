/* Tonk drawing: table, melds, the player hand and the round-over overlay. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.tonk;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, WIN_SCORE, PLAYER_NAMES, PHASE_DEAL_CHECK, PHASE_DRAW,
    PHASE_PLAY, PHASE_AI_THINKING, PHASE_ROUND_OVER, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y,
    SPREAD_BTN, DROP_BTN, DISCARD_BTN, TONK_BTN } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  const MELD_AREA_X = 250;
  const MELD_AREA_Y = 130;

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawTonk() {
    // Score panel
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, CANVAS_W - 180, 5, 170, 80, 6);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scores (first to ' + WIN_SCORE + ')', CANVAS_W - 172, 10);
    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], CANVAS_W - 172, 28 + p * 16);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.scores[p], CANVAS_W - 18, 28 + p * 16);
    }
    S._ctx.restore();

    if (S.phase === PHASE_ROUND_OVER) {
      drawRoundOver();
      return;
    }

    // AI hands (face down) at top
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const startX = p === 1 ? 30 : CANVAS_W / 2 + 50;
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')', startX, 15);
      for (let i = 0; i < S.hands[p].length; ++i)
        CE.drawCardBack(S._ctx, startX + i * 22, 28, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Stock pile
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 6);
    if (S.stockPile.length > 0) {
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('' + S.stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 4);
    } else
      CE.drawEmptySlot(S._ctx, STOCK_X, STOCK_Y);

    // Discard pile
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 6);
    if (S.discardPile.length > 0)
      CE.drawCardFace(S._ctx, DISCARD_X, DISCARD_Y, S.discardPile[S.discardPile.length - 1]);
    else
      CE.drawEmptySlot(S._ctx, DISCARD_X, DISCARD_Y);

    // Table melds
    drawTableMelds();

    // Action buttons
    if (S.currentPlayer === 0 && !S.roundOver && !S.gameOver) {
      if (S.phase === PHASE_DEAL_CHECK) {
        const pt = V.handTotal(S.hands[0]);
        if (pt === 49 || pt === 50)
          CE.drawButton(S._ctx, TONK_BTN.x, TONK_BTN.y, TONK_BTN.w, TONK_BTN.h, 'Tonk! (T)', { bg: '#5a1a5a', border: '#f4f' });
        // Also show a "Pass" to skip tonk declaration
        CE.drawButton(S._ctx, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h, 'Pass', { bg: '#3a3a3a', border: '#888' });
      } else if (S.phase === PHASE_DRAW) {
        // No explicit buttons; click stock or discard
      } else if (S.phase === PHASE_PLAY) {
        if (S.selectedIndices.length >= 3)
          CE.drawButton(S._ctx, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h, 'Spread (S)', { bg: '#2a2a5a', border: '#88f' });
        else if (S.selectedIndices.length === 1 && V.findExtendTarget(S.hands[0][S.selectedIndices[0]]) >= 0)
          CE.drawButton(S._ctx, SPREAD_BTN.x, SPREAD_BTN.y, SPREAD_BTN.w, SPREAD_BTN.h, 'Hit (S)', { bg: '#2a4a2a', border: '#4a4' });

        CE.drawButton(S._ctx, DROP_BTN.x, DROP_BTN.y, DROP_BTN.w, DROP_BTN.h, 'Drop (K)', { bg: '#5a3a1a', border: '#c84' });

        if (S.selectedIndices.length === 1)
          CE.drawButton(S._ctx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard (D)', { bg: '#3a1a1a', border: '#c44' });
      }
    }

    // Player hand
    drawPlayerHand();

    // Phase prompts
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'alphabetic';
    S._ctx.font = '13px sans-serif';
    if (S.currentPlayer === 0) {
      if (S.phase === PHASE_DEAL_CHECK) {
        const pt = V.handTotal(S.hands[0]);
        if (pt === 49 || pt === 50) {
          S._ctx.fillStyle = '#f4f';
          S._ctx.fillText('Your hand totals ' + pt + '! Declare Tonk or Pass.', CANVAS_W / 2, CANVAS_H - 8);
        } else {
          S._ctx.fillStyle = '#8f8';
          S._ctx.fillText('Hand total: ' + pt + '. Click to begin.', CANVAS_W / 2, CANVAS_H - 8);
        }
      } else if (S.phase === PHASE_DRAW) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Draw from Stock or Discard pile', CANVAS_W / 2, CANVAS_H - 8);
      } else if (S.phase === PHASE_PLAY) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Spread melds, Hit on melds, Drop, or select a card to Discard', CANVAS_W / 2, CANVAS_H - 8);
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
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Melds', MELD_AREA_X + 150, MELD_AREA_Y - 4);
      S._ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, MELD_AREA_X, MELD_AREA_Y, 420, 65, 6);
      S._ctx.stroke();
      return;
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Melds:', MELD_AREA_X, MELD_AREA_Y - 4);

    let mx = MELD_AREA_X;
    let my = MELD_AREA_Y + 2;
    const cardScale = 0.55;
    const cw = CE.CARD_W * cardScale;
    const ch = CE.CARD_H * cardScale;
    const cardSpacing = 30;
    const meldGap = 14;

    for (let m = 0; m < S.tableMelds.length; ++m) {
      const meld = S.tableMelds[m];
      if (mx + meld.cards.length * cardSpacing + cw > CANVAS_W - 10) {
        mx = MELD_AREA_X;
        my += ch + 8;
      }

      const ownerColor = meld.owner === 0 ? '#8f8' : '#fa0';
      S._ctx.fillStyle = ownerColor;
      S._ctx.font = '8px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText(PLAYER_NAMES[meld.owner], mx + (meld.cards.length * cardSpacing) / 2, my - 1);

      for (let c = 0; c < meld.cards.length; ++c) {
        meld.cards[c].faceUp = true;
        CE.drawCardFace(S._ctx, mx + c * cardSpacing, my, meld.cards[c], cw, ch);
      }
      mx += meld.cards.length * cardSpacing + meldGap;
    }
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    const ht = V.handTotal(hand);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Your Hand (total: ' + ht + ')', 90, 440);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = RC.playerCardX(i, total);
      const isSelected = S.selectedIndices.includes(i);
      const y = isSelected ? 440 : 455;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && (S.phase === PHASE_PLAY || S.phase === PHASE_DRAW) && V.cardHasHint(hand, i))
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
    // Reveal all hands
    S._ctx.save();
    const pw = 400;
    const ph = 300;
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

    // Show each player's hand and total
    S._ctx.font = '12px sans-serif';
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Hand Total  |  Score', CANVAS_W / 2, py + 44);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const rowY = py + 68 + p * 50;
      const ht = V.handTotal(S.hands[p]);

      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[p] + ':', px + 16, rowY);

      // Draw cards small
      const cardScale = 0.45;
      const cw = CE.CARD_W * cardScale;
      const ch = CE.CARD_H * cardScale;
      for (let c = 0; c < S.hands[p].length; ++c) {
        S.hands[p][c].faceUp = true;
        CE.drawCardFace(S._ctx, px + 16 + c * 26, rowY + 14, S.hands[p][c], cw, ch);
      }

      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'right';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('Total: ' + ht + '  |  Score: ' + S.scores[p], px + pw - 16, rowY + 6);
    }

    // Result message
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.resultMsg, CANVAS_W / 2, py + ph - 45);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 18);
    S._ctx.restore();
  }

  Object.assign(V, { drawTonk });

})();
