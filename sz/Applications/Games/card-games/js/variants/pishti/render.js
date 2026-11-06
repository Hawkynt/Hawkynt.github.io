/* Pishti: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.pishti;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, WINNING_SCORE, PHASE_PLAY, PHASE_AI_TURN, PHASE_ROUND_OVER,
    PLAYER_HAND_Y } = V;

  const AI_HAND_Y = 15;

  const CENTER_PILE_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const CENTER_PILE_Y = CANVAS_H / 2 - CE.CARD_H / 2;

  const PLAYER_CAPTURE_X = 20;
  const PLAYER_CAPTURE_Y = CANVAS_H / 2 + 80;
  const AI_CAPTURE_X = CANVAS_W - 110;
  const AI_CAPTURE_Y = 80;

  const STOCK_X = 40;
  const STOCK_Y = CANVAS_H / 2 - CE.CARD_H / 2;

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function playerCardX(idx, total) {
    const spacing = Math.min(85, 420 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  function aiCardX(idx, total) {
    const spacing = Math.min(35, 200 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pishti', 20, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Round ' + (S.roundNumber + 1) + '  |  Stock: ' + S.stock.length, 20, 30);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 175;
    const py = 10;
    const pw = 165;
    const ph = 68;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scores (first to ' + WINNING_SCORE + ')', px + 8, py + 8);

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('You:', px + 8, py + 28);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('' + S.cumulativePlayer, px + pw - 8, py + 28);

    S._ctx.textAlign = 'left';
    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('AI:', px + 8, py + 46);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('' + S.cumulativeAI, px + pw - 8, py + 46);
    S._ctx.restore();
  }

  function drawStock() {
    if (S.stock.length > 0) {
      const layers = Math.min(S.stock.length, 3);
      for (let i = 0; i < layers; ++i)
        CE.drawCardBack(S._ctx, STOCK_X + i * 2, STOCK_Y + i * 2);

      S._ctx.save();
      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('Stock: ' + S.stock.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 6);
      S._ctx.restore();
    }
  }

  function drawCenterPile() {
    const x = CENTER_PILE_X;
    const y = CENTER_PILE_Y;

    if (S.centerPile.length === 0) {
      S._ctx.save();
      S._ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
      S._ctx.fillStyle = 'rgba(255,255,255,0.12)';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Empty', x + CE.CARD_W / 2, y + CE.CARD_H / 2);
      S._ctx.restore();
      return;
    }

    // Draw stacked appearance for bottom cards
    const layers = Math.min(S.centerPile.length, 3);
    for (let i = 0; i < layers - 1; ++i)
      CE.drawCardBack(S._ctx, x + i * 2, y + i * 2);

    // Top card face-up
    const topCard = S.centerPile[S.centerPile.length - 1];
    CE.drawCardFace(S._ctx, x + (layers - 1) * 2, y + (layers - 1) * 2, topCard);

    // Pile count
    S._ctx.save();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pile: ' + S.centerPile.length, x + CE.CARD_W / 2, y + CE.CARD_H + 6);
    S._ctx.restore();
  }

  function drawCapturePile(x, y, captures, pishtis, label) {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
    CE.drawRoundedRect(S._ctx, x, y, 90, 90, 5);
    S._ctx.fill();

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(label, x + 45, y + 4);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.fillText('' + captures.length, x + 45, y + 22);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('cards', x + 45, y + 44);

    if (pishtis > 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.fillText('Pishtis: ' + pishtis, x + 45, y + 62);
    }

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.playerHand;
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (i === S.hoverHandIdx && S.phase === PHASE_PLAY) y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow: highlight cards that can capture the top of the pile
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAY && S.centerPile.length > 0)
        if (V.canCapture(hand[i]))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }
  }

  function drawAIHand() {
    const total = S.aiHand.length;
    if (total === 0) return;

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('AI (' + total + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    const scaleW = CE.CARD_W * 0.5;
    const scaleH = CE.CARD_H * 0.5;
    for (let i = 0; i < total; ++i)
      CE.drawCardBack(S._ctx, aiCardX(i, total), AI_HAND_Y, scaleW, scaleH);
  }

  function drawPishtiFlash() {
    if (S.pishtiFlashTimer <= 0) return;

    const alpha = Math.min(1, S.pishtiFlashTimer / 0.5);
    const scale = 1 + (2.0 - S.pishtiFlashTimer) * 0.15;

    S._ctx.save();
    S._ctx.globalAlpha = alpha;
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold ' + Math.round(28 * scale) + 'px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.shadowColor = '#f80';
    S._ctx.shadowBlur = 12;
    S._ctx.fillText(S.pishtiFlashText, CANVAS_W / 2, CANVAS_H / 2 - 80);
    S._ctx.restore();
  }

  function drawInstructions() {
    if (S.phase === PHASE_PLAY) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 6);
    } else if (S.phase === PHASE_AI_TURN) {
      S._ctx.fillStyle = '#fa0';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 6);
    }
  }

  function drawRoundOverUI() {
    if (!S.roundBreakdown) return;

    const px = CANVAS_W / 2 - 200;
    const py = 80;
    const pw = 400;
    const ph = 380;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round ' + S.roundNumber + ' Results', CANVAS_W / 2, py + 12);

    // Column headers
    const colY = py + 44;
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Category', CANVAS_W / 2 - 80, colY);
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('You', CANVAS_W / 2 + 50, colY);
    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('AI', CANVAS_W / 2 + 130, colY);

    const rb = S.roundBreakdown;
    const rows = [
      ['Cards captured', '' + rb.player.cardCount, '' + rb.ai.cardCount],
      ['Most cards (3pts)', rb.player.mostCards > 0 ? '+3' : '-', rb.ai.mostCards > 0 ? '+3' : '-'],
      ['Card points', '+' + rb.player.cardPoints, '+' + rb.ai.cardPoints],
      ['Pishtis', '' + rb.player.pishtis + ' (+' + rb.player.pishtiBonus + ')', '' + rb.ai.pishtis + ' (+' + rb.ai.pishtiBonus + ')'],
      ['Round total', '' + rb.player.total, '' + rb.ai.total]
    ];

    S._ctx.font = '12px sans-serif';
    for (let i = 0; i < rows.length; ++i) {
      const ry = colY + 24 + i * 26;
      S._ctx.textAlign = 'center';
      S._ctx.fillStyle = '#ccc';
      S._ctx.fillText(rows[i][0], CANVAS_W / 2 - 80, ry);
      S._ctx.fillStyle = '#8f8';
      S._ctx.fillText(rows[i][1], CANVAS_W / 2 + 50, ry);
      S._ctx.fillStyle = '#fa0';
      S._ctx.fillText(rows[i][2], CANVAS_W / 2 + 130, ry);
    }

    // Cumulative
    const cumY = colY + 24 + rows.length * 26 + 16;
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.fillStyle = '#ccc';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Overall', CANVAS_W / 2 - 80, cumY);
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('' + S.cumulativePlayer, CANVAS_W / 2 + 50, cumY);
    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('' + S.cumulativeAI, CANVAS_W / 2 + 130, cumY);

    // Continue prompt
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);

    S._ctx.restore();
  }

  function drawPishti() {
    drawTitle();
    drawScorePanel();
    drawStock();
    drawAIHand();
    drawCenterPile();
    drawPlayerHand();
    drawCapturePile(PLAYER_CAPTURE_X, PLAYER_CAPTURE_Y, S.playerCaptures, S.playerPishtis, 'Your Pile');
    drawCapturePile(AI_CAPTURE_X, AI_CAPTURE_Y, S.aiCaptures, S.aiPishtis, 'AI Pile');
    drawPishtiFlash();
    drawInstructions();

    if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawPishti();
  }

  V.playerCardX = playerCardX;
  V.draw = draw;

})();
