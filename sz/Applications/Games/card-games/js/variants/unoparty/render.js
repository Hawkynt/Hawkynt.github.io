/* Uno Party: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoparty'];
  const S = V.S;
  const { COLOR_DARK, COLOR_HEX, UNO_COLORS, CANVAS_W, CANVAS_H, PLAYER_NAMES, PLAYER_COUNT, AI_CARD_H, AI_CARD_W, PLAYER_POS } = V;

  function cardLabel(card) {
    if (card.value === 'Skip') return '\u00D8';
    if (card.value === 'Reverse') return '\u21C4';
    if (card.value === 'Draw Two') return '+2';
    if (card.value === 'Wild Everyone Draw') return 'WED';
    if (card.value === 'Wild Trade Hands') return 'WTH';
    if (card.value === 'Wild Discard All') return 'WDA';
    if (card.value === 'Wild Pick Color') return 'W';
    return card.value;
  }

  function drawPartyCard(x, y, w, h, card, highlight) {
    const col = card.color;
    CE.drawColorCard(S._ctx, x, y, w, h, { color: col === 'wild' ? 'wild' : (COLOR_HEX[col] || '#555555'), label: cardLabel(card), wild: col === 'wild', highlight }, card);
  }


  function drawColorOverlay() {
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Choose a color', CANVAS_W / 2, 220);
    for (let i = 0; i < UNO_COLORS.length; ++i) {
      const bx = CANVAS_W / 2 - 140 + i * 75;
      CE.drawButton(S._ctx, bx, 245, 65, 36, UNO_COLORS[i].charAt(0).toUpperCase() + UNO_COLORS[i].slice(1), { bg: COLOR_HEX[UNO_COLORS[i]], border: '#fff', fontSize: 12 });
    }
  }

  function drawTradeOverlay() {
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Choose a player to trade hands with', CANVAS_W / 2, 200);
    let col = 0;
    for (let p = 1; p < PLAYER_COUNT; ++p) {
      const bx = CANVAS_W / 2 - 200 + col * 85;
      const by = 230;
      CE.drawButton(S._ctx, bx, by, 78, 36, PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')', { bg: '#446', border: '#88a', fontSize: 11 });
      ++col;
    }
  }

  function drawGame() {
    // Current color bar
    S._ctx.fillStyle = COLOR_HEX[S.currentColor] || '#555';
    S._ctx.fillRect(CANVAS_W / 2 - 30, 170, 60, 8);

    // Discard pile
    if (S.discardPile.length > 0)
      drawPartyCard(CANVAS_W / 2 - CE.CARD_W / 2, 185, CE.CARD_W, CE.CARD_H, S.discardPile[S.discardPile.length - 1], false);

    // Draw pile
    CE.drawCardBack(S._ctx, CANVAS_W / 2 - CE.CARD_W - 80, 190, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 80, 295);

    // Draw pending
    if (S.drawPending > 0) {
      S._ctx.fillStyle = '#f88';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('+' + S.drawPending + ' pending', CANVAS_W / 2 + 80, 230);
    }

    // Direction
    S._ctx.fillStyle = '#888';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2, 300);

    // Player hand (bottom center)
    const handLen = S.hands[0].length;
    const cardSpacing = Math.min(55, (CANVAS_W - 200) / Math.max(handLen, 1));
    const handStartX = (CANVAS_W - (handLen - 1) * cardSpacing - CE.CARD_W) / 2;
    for (let i = 0; i < handLen; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const x = handStartX + i * cardSpacing;
      const playable = !S.roundOver && !S.gameOver && S.currentPlayer === 0 && V.canPlay(S.hands[0][i]);
      drawPartyCard(x, 450, CE.CARD_W, CE.CARD_H, S.hands[0][i], playable);
      if (S._host && S._host.hintsEnabled && !S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.colorChoiceActive && !S.tradeChoiceActive && V.canPlay(S.hands[0][i]))
        CE.drawHintGlow(S._ctx, x, 450, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    // AI hands (positions 1-5)
    for (let p = 1; p < PLAYER_COUNT; ++p) {
      const pp = PLAYER_POS[p];
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(PLAYER_NAMES[p] + ' (' + S.hands[p].length + ')', pp.x, pp.labelY);
      const maxShow = Math.min(S.hands[p].length, 7);
      const startX = pp.x - (maxShow * 14) / 2;
      for (let i = 0; i < maxShow; ++i)
        CE.drawCardBack(S._ctx, startX + i * 14, pp.labelY + 15, AI_CARD_W, AI_CARD_H);
    }

    // Instructions
    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.colorChoiceActive && !S.tradeChoiceActive) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.drawPending > 0)
        S._ctx.fillText('Stack a Draw Two or click the draw pile to accept +' + S.drawPending, CANVAS_W / 2, CANVAS_H - 8);
      else
        S._ctx.fillText('Click a card to play, or click the draw pile to draw', CANVAS_W / 2, CANVAS_H - 8);
    }

    // Overlays
    if (S.colorChoiceActive) drawColorOverlay();
    if (S.tradeChoiceActive) drawTradeOverlay();
  }

  Object.assign(V, { drawGame });

})();
