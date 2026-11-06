/* Go Fish: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const HANDS = SZ.CardGames.shared.quickHands;
  const V = SZ.CardGames.v.gofish;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PLAYER_HAND_Y, AI_HAND_Y, STOCK_X, STOCK_Y, PLAYER_BOOKS_X,
    PLAYER_BOOKS_Y, AI_BOOKS_X, AI_BOOKS_Y, MESSAGE_Y } = V;

  function playerCardX(idx, total) {
    const maxWidth = 700;
    const spacing = total > 1 ? Math.min(55, maxWidth / (total - 1)) : 0;
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  function aiCardX(idx, total) {
    const spacing = Math.min(30, 400 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  function drawBooks(books, startX, startY, label) {
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(label + ' (' + books.length + ')', startX, startY - 14);

    for (let i = 0; i < books.length; ++i) {
      const col = i % 3;
      const row = (i / 3) | 0;
      const bx = startX + col * 28;
      const by = startY + row * 22;

      S._ctx.save();
      S._ctx.fillStyle = 'rgba(0,0,0,0.4)';
      CE.drawRoundedRect(S._ctx, bx, by, 24, 18, 3);
      S._ctx.fill();
      S._ctx.strokeStyle = '#888';
      S._ctx.lineWidth = 1;
      CE.drawRoundedRect(S._ctx, bx, by, 24, 18, 3);
      S._ctx.stroke();
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(books[i].rank, bx + 12, by + 9);
      S._ctx.restore();
    }
  }

  function drawStockPile() {
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Stock (' + S.stock.length + ')', STOCK_X + CE.CARD_W / 2, STOCK_Y - 4);

    if (S.stock.length > 0) {
      // Draw a small stack effect
      if (S.stock.length > 2) CE.drawCardBack(S._ctx, STOCK_X + 2, STOCK_Y + 2);
      if (S.stock.length > 1) CE.drawCardBack(S._ctx, STOCK_X + 1, STOCK_Y + 1);
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y);
    } else {
      S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = 'rgba(255,255,255,0.2)';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }
  }

  function drawPlayerHandArea() {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) {
      S._ctx.fillStyle = 'rgba(255,255,255,0.3)';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('(no cards)', CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H / 2);
      return;
    }

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (i === S.hoverCardIdx && S.isPlayerTurn && !S.roundOver)
        y -= 10;
      if (i === S.selectedCardIdx)
        y -= 16;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow: highlight cards with 2+ of the same rank
      if (S._host && S._host.hintsEnabled && S.isPlayerTurn && !S.roundOver) {
        if (HANDS.countRank(hand, hand[i].rank) >= 2)
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

      if (i === S.selectedCardIdx) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawAIHandArea() {
    const total = S.aiHand.length;
    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('AI (' + total + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    if (total === 0) return;

    const scaleW = CE.CARD_W * 0.5;
    const scaleH = CE.CARD_H * 0.5;
    for (let i = 0; i < total; ++i)
      CE.drawCardBack(S._ctx, aiCardX(i, total), AI_HAND_Y, scaleW, scaleH);
  }

  function drawTurnIndicator() {
    const text = S.isPlayerTurn ? 'Your Turn' : 'AI\'s Turn';
    const color = S.isPlayerTurn ? '#8f8' : '#fa0';

    S._ctx.fillStyle = color;
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(text, 15, 10);
  }

  function drawMessageArea() {
    if (S.message.length === 0) return;

    const alpha = Math.min(1, S.messageTimer / 0.5);
    S._ctx.save();
    S._ctx.globalAlpha = alpha;

    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const textWidth = S._ctx.measureText(S.message).width || 200;
    const pw = Math.max(textWidth + 40, 240);
    const px = CANVAS_W / 2 - pw / 2;
    CE.drawRoundedRect(S._ctx, px, MESSAGE_Y - 16, pw, 32, 8);
    S._ctx.fill();

    S._ctx.fillStyle = S.messageColor;
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(S.message, CANVAS_W / 2, MESSAGE_Y);
    S._ctx.restore();
  }

  function drawInstructions() {
    if (S.roundOver || S.gameOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 8);
      return;
    }

    if (!S.isPlayerTurn) return;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';

    if (S.playerHand.length > 0)
      S._ctx.fillText('Click a card in your hand to ask AI for that rank', CANVAS_W / 2, CANVAS_H - 8);
  }

  function drawScoreArea() {
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('You: ' + S.playerBooks.length + '  AI: ' + S.aiBooks.length, CANVAS_W - 15, 10);
  }

  function drawGoFish() {
    drawTurnIndicator();
    drawScoreArea();
    drawAIHandArea();
    drawStockPile();
    drawBooks(S.playerBooks, PLAYER_BOOKS_X, PLAYER_BOOKS_Y, 'Your Books');
    drawBooks(S.aiBooks, AI_BOOKS_X, AI_BOOKS_Y, 'AI Books');
    drawPlayerHandArea();
    drawMessageArea();
    drawInstructions();
  }

  Object.assign(V, { playerCardX, drawGoFish });

})();
