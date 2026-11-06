/* Mau-Mau: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['maumau'];
  const S = V.S;
  const { SUIT_BTN_SIZE, suitChoiceRects, SUIT_NAMES, SUIT_SYMBOLS, SUIT_BTN_GAP, CANVAS_H, CANVAS_W, HAND_Y, HAND_SPACING, HAND_X_START, DISCARD_Y, DISCARD_X, STOCK_Y, STOCK_X, AI_HAND_Y, AI_HAND_SPACING, AI_HAND_X_START } = V;

  /* ================================================================
     SUIT CHOICE OVERLAY (after Jack)
     ================================================================ */

  function drawSuitChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Choose a suit (Jack played):', CANVAS_W / 2, CANVAS_H / 2 - 65);

    suitChoiceRects.length = 0;
    const totalW = CE.SUITS.length * SUIT_BTN_SIZE + (CE.SUITS.length - 1) * SUIT_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 20;

    for (let i = 0; i < CE.SUITS.length; ++i) {
      const x = startX + i * (SUIT_BTN_SIZE + SUIT_BTN_GAP);
      const suit = CE.SUITS[i];
      const suitColor = CE.SUIT_COLORS[suit];

      S._ctx.fillStyle = '#fff';
      CE.drawRoundedRect(S._ctx, x, y, SUIT_BTN_SIZE, SUIT_BTN_SIZE, 8);
      S._ctx.fill();
      S._ctx.strokeStyle = '#888';
      S._ctx.lineWidth = 2;
      S._ctx.stroke();

      S._ctx.fillStyle = suitColor;
      S._ctx.font = '28px serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(SUIT_SYMBOLS[suit], x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE / 2 - 6);

      S._ctx.font = '10px sans-serif';
      S._ctx.fillText(SUIT_NAMES[suit], x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE - 10);

      suitChoiceRects.push({ x, y, w: SUIT_BTN_SIZE, h: SUIT_BTN_SIZE, suit });
    }
    S._ctx.restore();
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawMauMau() {
    // Title
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Mau-Mau', 20, 18);

    // AI hand (face down)
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI (' + S.hands[1].length + ' cards)', AI_HAND_X_START, AI_HAND_Y + CE.CARD_H * 0.6 + 16);
    for (let i = 0; i < S.hands[1].length; ++i)
      CE.drawCardBack(S._ctx, AI_HAND_X_START + i * AI_HAND_SPACING, AI_HAND_Y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);

    // Stock pile
    if (S.stock.length > 0) {
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('' + S.stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 14);
    } else {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = '#555';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }

    // Discard pile
    const top = V.topDiscard();
    if (top)
      CE.drawCardFace(S._ctx, DISCARD_X, DISCARD_Y, top);
    else {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
    }

    // Draw obligation indicator
    if (S.drawObligation > 0) {
      S._ctx.save();
      S._ctx.fillStyle = '#f44';
      S._ctx.font = 'bold 20px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('+' + S.drawObligation, DISCARD_X + CE.CARD_W + 30, DISCARD_Y + CE.CARD_H / 2);
      S._ctx.restore();
    }

    // Chosen suit indicator (after Jack)
    if (S.chosenSuit) {
      S._ctx.save();
      const indX = DISCARD_X + CE.CARD_W + 20;
      const indY = DISCARD_Y - 30;
      S._ctx.fillStyle = '#1a3a1a';
      S._ctx.strokeStyle = '#8af';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, indX, indY, 60, 26, 4);
      S._ctx.fill();
      S._ctx.stroke();
      S._ctx.fillStyle = CE.SUIT_COLORS[S.chosenSuit];
      S._ctx.font = 'bold 14px serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(SUIT_SYMBOLS[S.chosenSuit] + ' ' + SUIT_NAMES[S.chosenSuit], indX + 30, indY + 13);
      S._ctx.restore();
    }

    // Player hand
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Hand', HAND_X_START, HAND_Y - 10);
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const x = HAND_X_START + i * HAND_SPACING;
      CE.drawCardFace(S._ctx, x, HAND_Y, S.hands[0][i]);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.waitingForSuitChoice && !S.roundOver && !S.gameOver && V.canPlay(S.hands[0][i]))
        CE.drawHintGlow(S._ctx, x, HAND_Y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Highlight playable cards when it's player's turn
      if (S.currentPlayer === 0 && !S.roundOver && !S.gameOver && !S.waitingForSuitChoice && V.canPlay(S.hands[0][i])) {
        S._ctx.save();
        S._ctx.strokeStyle = '#8f8';
        S._ctx.lineWidth = 2;
        S._ctx.shadowColor = '#8f8';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, x - 1, HAND_Y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }

    // Turn indicator
    if (!S.roundOver && !S.gameOver && !S.waitingForSuitChoice) {
      if (S.currentPlayer === 0) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.font = '12px sans-serif';
        S._ctx.textAlign = 'center';
        if (S.drawObligation > 0 && !V.hasPlayableCard(S.hands[0]))
          S._ctx.fillText('You must draw ' + S.drawObligation + ' cards \u2014 click the stock pile', CANVAS_W / 2, CANVAS_H - 15);
        else if (S.drawObligation > 0)
          S._ctx.fillText('Play a 7 to stack, or click stock to draw ' + S.drawObligation, CANVAS_W / 2, CANVAS_H - 15);
        else if (V.hasPlayableCard(S.hands[0]))
          S._ctx.fillText('Your turn \u2014 click a card to play, or click stock to draw', CANVAS_W / 2, CANVAS_H - 15);
        else
          S._ctx.fillText('No playable card \u2014 click stock to draw', CANVAS_W / 2, CANVAS_H - 15);
      } else {
        S._ctx.fillStyle = '#f88';
        S._ctx.font = '12px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 15);
      }
    }

    // Score display
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Score: ' + S.score, CANVAS_W - 20, 18);

    // Current player indicator
    S._ctx.fillStyle = S.currentPlayer === 0 ? '#8f8' : '#f88';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.currentPlayer === 0 ? '\u25BC Your Turn' : '\u25B2 AI Turn', CANVAS_W / 2, 220);

    // Round over message
    if (S.roundOver && !S.waitingForSuitChoice) {
      S._ctx.fillStyle = 'rgba(0,0,0,0.4)';
      S._ctx.fillRect(0, CANVAS_H / 2 - 30, CANVAS_W, 60);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Click anywhere to continue', CANVAS_W / 2, CANVAS_H / 2);
    }

    // Suit choice overlay
    if (S.waitingForSuitChoice)
      drawSuitChoiceOverlay();
  }

  Object.assign(V, { drawMauMau });

})();
