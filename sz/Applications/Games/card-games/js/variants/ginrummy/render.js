/* Gin Rummy drawing: table, hands, buttons and the end-of-round reveal. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ginrummy;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, PHASE_PLAYER_DRAW, PHASE_PLAYER_DISCARD, PHASE_AI_THINKING,
    PHASE_ROUND_REVEAL, STOCK_X, STOCK_Y, DISCARD_X, DISCARD_Y, KNOCK_BTN } = V;
  const RC = SZ.CardGames.shared.rummyCards;

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGinRummy() {
    // Scores
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('You: ' + S.score, 20, 20);
    S._ctx.fillText('AI: ' + S.aiScore, 20, 38);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('First to 100 wins', 20, 56);

    if (S.phase === PHASE_ROUND_REVEAL) {
      drawReveal();
      return;
    }

    // AI hand (face down) at top
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI (' + S.aiHand.length + ' cards)', 90, 55);
    for (let i = 0; i < S.aiHand.length; ++i)
      CE.drawCardBack(S._ctx, 90 + i * 30, 70, CE.CARD_W * 0.7, CE.CARD_H * 0.7);

    // Stock pile
    if (S.stockPile.length > 0) {
      CE.drawCardBack(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('' + S.stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 14);
    } else {
      S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
    }
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 8);

    // Discard pile
    if (S.discardPile.length > 0)
      CE.drawCardFace(S._ctx, DISCARD_X, DISCARD_Y, S.discardPile[S.discardPile.length - 1], CE.CARD_W, CE.CARD_H);
    else {
      S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      S._ctx.lineWidth = 2;
      CE.drawRoundedRect(S._ctx, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      S._ctx.stroke();
    }
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 8);

    // Player hand at bottom
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    const dwVal = V.calcDeadwood(S.playerHand);
    S._ctx.fillText('Your Hand (deadwood: ' + dwVal + ')', 90, 445);
    const handSpacing = Math.min(68, (CANVAS_W - 180) / Math.max(S.playerHand.length, 1));
    for (let i = 0; i < S.playerHand.length; ++i) {
      if (S.playerHand[i]._dealing) continue;
      const x = 90 + i * handSpacing;
      const y = (i === S.selectedCardIndex) ? 450 : 460;
      CE.drawCardFace(S._ctx, x, y, S.playerHand[i], CE.CARD_W, CE.CARD_H);
      if (S._host && S._host.hintsEnabled && V.cardHasHint(S.playerHand, i))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      if (i === S.selectedCardIndex) {
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

    // Phase prompts
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'center';
    if (S.phase === PHASE_PLAYER_DRAW)
      S._ctx.fillText('Draw from Stock or Discard pile', CANVAS_W / 2, 410);
    else if (S.phase === PHASE_PLAYER_DISCARD)
      S._ctx.fillText('Click a card in your hand to discard it', CANVAS_W / 2, 410);
    else if (S.phase === PHASE_AI_THINKING) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.fillText('AI is thinking...', CANVAS_W / 2, 410);
    }

    // Knock button (player's discard phase, deadwood <= 10)
    if (S.phase === PHASE_PLAYER_DISCARD && dwVal <= 10)
      CE.drawButton(S._ctx, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h, dwVal === 0 ? 'Gin! (K)' : 'Knock (K)', { bg: '#5a4a0a', border: '#cc8' });

    // Result message
    if (S.resultMsg) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, CANVAS_H - 15);
    }
  }

  function drawReveal() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.knocker === 0 ? 'You knocked!' : 'AI knocked!', CANVAS_W / 2, 75);
    if (S.isGin)
      S._ctx.fillText(S.knocker === 0 ? 'GIN!' : 'AI has Gin!', CANVAS_W / 2, 95);

    // Draw player melds
    S._ctx.fillStyle = '#aaf';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Your Melds:', 30, 420);
    let px = 30;
    for (let m = 0; m < S.playerMelds.length; ++m) {
      for (let c = 0; c < S.playerMelds[m].length; ++c) {
        CE.drawCardFace(S._ctx, px, 435, S.playerMelds[m][c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
        px += 38;
      }
      px += 12;
    }
    // Player deadwood
    if (S.playerDeadwood.length > 0) {
      S._ctx.fillStyle = '#f88';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('Deadwood:', px + 4, 420);
      for (let c = 0; c < S.playerDeadwood.length; ++c)
        CE.drawCardFace(S._ctx, px + 4 + c * 38, 435, S.playerDeadwood[c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
    }

    // Draw AI melds
    S._ctx.fillStyle = '#aaf';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('AI Melds:', 30, 115);
    let ax = 30;
    for (let m = 0; m < S.aiMelds.length; ++m) {
      for (let c = 0; c < S.aiMelds[m].length; ++c) {
        CE.drawCardFace(S._ctx, ax, 130, S.aiMelds[m][c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
        ax += 38;
      }
      ax += 12;
    }
    // AI deadwood
    if (S.aiDeadwood.length > 0) {
      S._ctx.fillStyle = '#f88';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('Deadwood:', ax + 4, 115);
      for (let c = 0; c < S.aiDeadwood.length; ++c)
        CE.drawCardFace(S._ctx, ax + 4 + c * 38, 130, S.aiDeadwood[c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
    }

    // Layoff info
    if (S.layoffCards.length > 0) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Laid off ' + S.layoffCards.length + ' card(s) on opponent\u2019s melds', CANVAS_W / 2, 280);
    }

    // Deadwood totals
    const pDW = S.playerDeadwood.reduce((s, c) => s + RC.cardValue(c), 0);
    const aDW = S.aiDeadwood.reduce((s, c) => s + RC.cardValue(c), 0);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Your deadwood: ' + pDW + '    AI deadwood: ' + aDW, CANVAS_W / 2, 310);

    // Result
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.fillText(S.resultMsg, CANVAS_W / 2, 350);

    // Continue prompt
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '13px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, 385);
  }

  Object.assign(V, { drawGinRummy });

})();
