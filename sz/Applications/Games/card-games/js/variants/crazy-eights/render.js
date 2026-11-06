/* Crazy Eights: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['crazy-eights'];
  const S = V.S;
  const { CANVAS_W, SUIT_BTN_SIZE, suitChoiceRects, SUIT_NAMES, SUIT_SYMBOLS, SUIT_BTN_GAP, CANVAS_H, WIN_SCORE, PASS_BTN, MAX_DRAWS, DRAW_BTN } = V;

  /* ================================================================
     HIGHLIGHT HELPER -- draws card face then overlays golden border for 8s
     ================================================================ */

  function drawCardWithHighlight(_ctx, x, y, card, w, h) {
    CE.drawCardFace(_ctx, x, y, card, w, h);
    if (card.rank === '8') {
      const cw = w || CE.CARD_W;
      const ch = h || CE.CARD_H;
      const cr = CE.CARD_RADIUS * Math.min(cw / CE.CARD_W, ch / CE.CARD_H);
      _ctx.save();
      _ctx.strokeStyle = '#da0';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, x + 2, y + 2, cw - 4, ch - 4, Math.max(cr - 1, 1));
      _ctx.stroke();
      _ctx.restore();
    }
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function getPlayerCardX(index) {
    const totalCards = S.playerHand.length;
    const maxSpread = CANVAS_W - 120;
    const spacing = Math.min(55, (maxSpread - CE.CARD_W) / Math.max(totalCards - 1, 1));
    const totalWidth = (totalCards - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + index * spacing;
  }

  function getAiCardX(index) {
    const totalCards = S.aiHand.length;
    const spacing = Math.min(30, (400 - CE.CARD_W) / Math.max(totalCards - 1, 1));
    const totalWidth = (totalCards - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + index * spacing;
  }

  /* ================================================================
     SUIT CHOOSER OVERLAY
     ================================================================ */

  function drawSuitChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.65)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 20px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Choose a suit:', CANVAS_W / 2, CANVAS_H / 2 - 70);

    suitChoiceRects.length = 0;
    const totalW = CE.SUITS.length * SUIT_BTN_SIZE + (CE.SUITS.length - 1) * SUIT_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 25;

    for (let i = 0; i < CE.SUITS.length; ++i) {
      const x = startX + i * (SUIT_BTN_SIZE + SUIT_BTN_GAP);
      const suit = CE.SUITS[i];
      const sym = SUIT_SYMBOLS[suit] || '';
      const isRed = suit === 'hearts' || suit === 'diamonds';

      // Button background
      S._ctx.fillStyle = isRed ? '#4a1a1a' : '#1a1a3a';
      S._ctx.strokeStyle = isRed ? '#c44' : '#88a';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, x, y, SUIT_BTN_SIZE, SUIT_BTN_SIZE, 10);
      S._ctx.fill();
      S._ctx.stroke();

      // Suit symbol
      S._ctx.fillStyle = isRed ? '#f44' : '#ddd';
      S._ctx.font = '30px serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(sym, x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE / 2 - 6);

      // Suit name
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.fillText(SUIT_NAMES[suit], x + SUIT_BTN_SIZE / 2, y + SUIT_BTN_SIZE - 10);

      suitChoiceRects.push({ x, y, w: SUIT_BTN_SIZE, h: SUIT_BTN_SIZE, suit });
    }
    S._ctx.restore();
  }

  /* ================================================================
     DRAW
     ================================================================ */

  function drawCrazyEights() {
    const topCard = S.discardPile.length > 0 ? S.discardPile[S.discardPile.length - 1] : null;

    // -- Title / turn indicator --
    S._ctx.fillStyle = S.playerTurn ? '#8f8' : '#f88';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.playerTurn ? 'Your Turn' : 'AI Thinking...', CANVAS_W / 2, 18);

    // -- AI hand (card backs) at top --
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('AI (' + S.aiHand.length + ' cards)', CANVAS_W / 2, 10 + CE.CARD_H * 0.6 + 25);
    for (let i = 0; i < S.aiHand.length; ++i) {
      const x = getAiCardX(i);
      CE.drawCardBack(S._ctx, x, 30, CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    }

    // -- Stock pile (left of center) --
    const stockX = CANVAS_W / 2 - CE.CARD_W - 30;
    const stockY = 245;
    if (S.stock.length > 0) {
      CE.drawCardBack(S._ctx, stockX, stockY, CE.CARD_W, CE.CARD_H);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('' + S.stock.length, stockX + CE.CARD_W / 2, stockY + CE.CARD_H + 14);
    } else {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, stockX, stockY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = '#555';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Empty', stockX + CE.CARD_W / 2, stockY + CE.CARD_H / 2);
    }

    // -- Discard pile (center) --
    const discardX = CANVAS_W / 2 + 10;
    const discardY = 245;
    if (topCard)
      drawCardWithHighlight(S._ctx, discardX, discardY, topCard, CE.CARD_W, CE.CARD_H);
    else {
      S._ctx.strokeStyle = '#555';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, discardX, discardY, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
    }

    // -- Current required suit indicator --
    if (S.currentSuit) {
      const indicatorX = discardX + CE.CARD_W + 16;
      const indicatorY = discardY + 10;
      const isRed = S.currentSuit === 'hearts' || S.currentSuit === 'diamonds';
      const sym = SUIT_SYMBOLS[S.currentSuit] || '';

      S._ctx.fillStyle = 'rgba(0,0,0,0.4)';
      CE.drawRoundedRect(S._ctx, indicatorX - 4, indicatorY - 4, 50, 60, 6);
      S._ctx.fill();

      S._ctx.fillStyle = isRed ? '#f66' : '#ccc';
      S._ctx.font = '28px serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(sym, indicatorX + 21, indicatorY + 20);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '9px sans-serif';
      S._ctx.fillText(SUIT_NAMES[S.currentSuit], indicatorX + 21, indicatorY + 44);
    }

    // -- Draw / Pass buttons (only on player turn) --
    if (S.playerTurn && !S.roundOver && !S.gameOver && !S.waitingForSuitChoice) {
      const canDraw = S.drawCount < MAX_DRAWS && (S.stock.length > 0 || S.discardPile.length > 1);
      if (canDraw)
        CE.drawButton(S._ctx, DRAW_BTN.x, DRAW_BTN.y, DRAW_BTN.w, DRAW_BTN.h,
          'Draw (' + S.drawCount + '/' + MAX_DRAWS + ')', { bg: '#2a3a5a', border: '#68c' });

      if (S.drawCount >= MAX_DRAWS || (!canDraw && !V.hasPlayableCard(S.playerHand, topCard, S.currentSuit)))
        CE.drawButton(S._ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass',
          { bg: '#5a3a2a', border: '#c86', fontSize: 12 });
    }

    // -- Player hand at bottom (fan) --
    for (let i = 0; i < S.playerHand.length; ++i) {
      if (S.playerHand[i]._dealing) continue;
      const x = getPlayerCardX(i);
      const playable = topCard && V.canPlay(S.playerHand[i], topCard, S.currentSuit);
      drawCardWithHighlight(S._ctx, x, 460, S.playerHand[i], CE.CARD_W, CE.CARD_H);
      if (S._host && S._host.hintsEnabled && S.playerTurn && !S.waitingForSuitChoice && !S.roundOver && !S.gameOver && topCard && V.canPlay(S.playerHand[i], topCard, S.currentSuit))
        CE.drawHintGlow(S._ctx, x, 460, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      if (S.playerTurn && playable && !S.waitingForSuitChoice) {
        S._ctx.save();
        S._ctx.strokeStyle = '#8f8';
        S._ctx.lineWidth = 2;
        S._ctx.shadowColor = '#8f8';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, x - 1, 459, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }

    // -- Score & info --
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Score: ' + S.score, 16, 22);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('First to ' + WIN_SCORE + ' wins', 16, 40);

    // -- Result message --
    if (S.roundOver && S.resultMsg) {
      S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
      CE.drawRoundedRect(S._ctx, CANVAS_W / 2 - 200, CANVAS_H / 2 - 30, 400, 60, 10);
      S._ctx.fill();
      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 8);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 16);
    }

    // -- Help text --
    if (!S.roundOver && !S.gameOver && S.playerTurn && !S.waitingForSuitChoice) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Play a matching suit/rank, an 8 (wild), or draw from stock', CANVAS_W / 2, CANVAS_H - 8);
    }

    // -- Suit choice overlay --
    if (S.waitingForSuitChoice)
      drawSuitChoiceOverlay();
  }

  Object.assign(V, { getAiCardX, getPlayerCardX, drawCrazyEights });

})();
