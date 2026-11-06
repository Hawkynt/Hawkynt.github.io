/* Uno Flip: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoflip'];
  const S = V.S;
  const { WILD_HEX, DARK_HEX, LIGHT_HEX, CANVAS_W, CANVAS_H, NUM_PLAYERS } = V;

  function getHex(color) {
    if (LIGHT_HEX[color]) return LIGHT_HEX[color];
    if (DARK_HEX[color]) return DARK_HEX[color];
    return WILD_HEX;
  }

  function cardLabel(card) {
    const v = V.getValue(card);
    if (v === 'Skip') return '\u00D8';
    if (v === 'Skip Everyone') return '\u00D8\u00D8';
    if (v === 'Reverse') return '\u21C4';
    if (v === 'Draw One') return '+1';
    if (v === 'Draw Five') return '+5';
    if (v === 'Flip') return '\u21BB';
    if (v === 'Wild') return 'W';
    if (v === 'Wild Draw Two') return 'W+2';
    if (v === 'Wild Draw Color') return 'WDC';
    return v;
  }

  function drawFlipCard(x, y, w, h, card, highlight) {
    const col = V.getColor(card);
    const oc = V.otherSideColor(card);
    CE.drawColorCard(S._ctx, x, y, w, h, { color: col === 'wild' ? WILD_HEX : getHex(col), label: cardLabel(card), wild: col === 'wild',
      stripe: oc === 'wild' ? WILD_HEX : getHex(oc), highlight }, card);
  }


  function drawColorOverlay() {
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Choose a color', CANVAS_W / 2, 220);
    const colors = V.getColorChoices();
    for (let i = 0; i < colors.length; ++i) {
      const bx = CANVAS_W / 2 - 140 + i * 75;
      const by = 245;
      CE.drawButton(S._ctx, bx, by, 65, 36, colors[i].charAt(0).toUpperCase() + colors[i].slice(1), { bg: getHex(colors[i]), border: '#fff', fontSize: 12 });
    }
  }

  function drawGame() {
    // Side indicator
    S._ctx.fillStyle = S.activeSide === 'light' ? '#ffe' : '#223';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.activeSide === 'light' ? '\u2600 LIGHT SIDE' : '\u263E DARK SIDE', CANVAS_W / 2, 18);

    // Current color indicator
    S._ctx.fillStyle = getHex(S.currentColor);
    S._ctx.fillRect(CANVAS_W / 2 - 30, 25, 60, 8);

    // Discard pile
    if (S.discardPile.length > 0)
      drawFlipCard(CANVAS_W / 2 - CE.CARD_W / 2, 210, CE.CARD_W, CE.CARD_H, S.discardPile[S.discardPile.length - 1], false);

    // Draw pile
    CE.drawCardBack(S._ctx, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 80, 320);

    // Draw pending
    if (S.drawPending > 0) {
      S._ctx.fillStyle = '#f88';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Draw pending: +' + S.drawPending, CANVAS_W / 2 + 80, 260);
    }

    // Player hand
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const x = 120 + i * 60;
      const playable = !S.roundOver && !S.gameOver && S.currentPlayer === 0 && V.canPlay(S.hands[0][i]);
      drawFlipCard(x, 440, CE.CARD_W, CE.CARD_H, S.hands[0][i], playable);
      if (S._host && S._host.hintsEnabled && !S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.colorChoiceActive && V.canPlay(S.hands[0][i]))
        CE.drawHintGlow(S._ctx, x, 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    // AI hands
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const lx = p === 1 ? 60 : CANVAS_W - 160;
      const ly = 100;
      S._ctx.textAlign = 'left';
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.fillText('AI ' + p + ' (' + S.hands[p].length + ')', lx, ly - 8);
      for (let i = 0; i < Math.min(S.hands[p].length, 8); ++i)
        CE.drawCardBack(S._ctx, lx + i * 16, ly, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Direction
    S._ctx.fillStyle = '#888';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2, 340);

    // Instructions
    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.colorChoiceActive) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.drawPending > 0)
        S._ctx.fillText('Stack a draw card or click the draw pile to accept +' + S.drawPending, CANVAS_W / 2, CANVAS_H - 12);
      else
        S._ctx.fillText('Click a card to play, or click the draw pile to draw', CANVAS_W / 2, CANVAS_H - 12);
    }

    if (S.colorChoiceActive)
      drawColorOverlay();
  }

  Object.assign(V, { drawGame });

})();
