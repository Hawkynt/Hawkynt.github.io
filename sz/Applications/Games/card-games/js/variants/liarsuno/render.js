/* Liar's Uno: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['liarsuno'];
  const S = V.S;
  const { COLOR_MAP, CANVAS_W, UNO_COLORS, CANVAS_H, CHALLENGE_WINDOW, playerPos, NUM_PLAYERS } = V;

  function cardLabel(card) {
    if (card.value === 'Skip') return '\u00D8';
    if (card.value === 'Reverse') return '\u21C4';
    if (card.value === 'Draw Two') return '+2';
    if (card.value === 'Wild') return 'W';
    if (card.value === 'Wild Draw Four') return 'W+4';
    return card.value;
  }

  function drawLiarsCard(x, y, w, h, card, highlight, faceDown) {
    if (faceDown) {
      CE.drawCardBack(S._ctx, x, y, w, h);
      S._ctx.save();
      S._ctx.fillStyle = 'rgba(255,255,255,0.85)';
      S._ctx.font = 'bold 24px Georgia, serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('?', x + w / 2, y + h / 2 + 1);
      S._ctx.restore();
      return;
    }
    CE.drawColorCard(S._ctx, x, y, w, h, { color: card.color === 'wild' ? 'wild' : (COLOR_MAP[card.color] ? card.color : '#555'), label: cardLabel(card), wild: card.color === 'wild', highlight }, card);
  }


  function drawBluffClaimOverlay() {
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';

    if (S.bluffClaimStep === 0) {
      S._ctx.fillText('Claim a color:', CANVAS_W / 2, 210);
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        CE.drawButton(S._ctx, bx, 230, 65, 32, UNO_COLORS[i].charAt(0).toUpperCase() + UNO_COLORS[i].slice(1), { bg: COLOR_MAP[UNO_COLORS[i]], border: '#fff', fontSize: 12 });
      }
    } else {
      S._ctx.fillText('Claim a value:', CANVAS_W / 2, 190);
      const vals = ['0','1','2','3','4','5','6','7','8','9','Skip','Rev','+2','W','W+4'];
      for (let i = 0; i < vals.length; ++i) {
        const col = (i % 8);
        const row = (i / 8) | 0;
        const bx = CANVAS_W / 2 - 200 + col * 52;
        const by = 215 + row * 38;
        CE.drawButton(S._ctx, bx, by, 48, 32, vals[i], { bg: '#444', border: '#888', fontSize: 11 });
      }
    }
  }

  function drawGame() {
    // Discard pile — show top card (face down if last play was bluff and in challenge phase)
    const topDiscard = S.discardPile[S.discardPile.length - 1];
    if (topDiscard) {
      const showFaceDown = S.challengePhase && S.lastPlayInfo && S.lastPlayInfo.faceDown;
      drawLiarsCard(CANVAS_W / 2 - CE.CARD_W / 2, 210, CE.CARD_W, CE.CARD_H, topDiscard, false, showFaceDown);
      if (showFaceDown && S.lastPlayInfo) {
        S._ctx.fillStyle = '#ff0';
        S._ctx.font = '11px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.fillText('Claims: ' + S.lastPlayInfo.claimedColor + ' ' + S.lastPlayInfo.claimedValue, CANVAS_W / 2, 318);
      }
    }

    // Color indicator
    S._ctx.fillStyle = COLOR_MAP[S.currentColor] || '#555';
    S._ctx.fillRect(CANVAS_W / 2 - 30, 195, 60, 8);

    // Draw pile
    CE.drawCardBack(S._ctx, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('' + S.deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 80, 320);

    // Player hand
    for (let i = 0; i < S.hands[0].length; ++i) {
      if (S.hands[0][i]._dealing) continue;
      const x = 140 + i * 60;
      const playable = !S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.challengePhase;
      drawLiarsCard(x, 440, CE.CARD_W, CE.CARD_H, S.hands[0][i], playable, false);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.challengePhase && !S.roundOver && !S.gameOver && (S.bluffMode || V.isLegalPlay(S.hands[0][i])))
        CE.drawHintGlow(S._ctx, x, 440, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      S._ctx.fillStyle = S.currentPlayer === p ? '#ff0' : '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(pp.label + ' (' + S.hands[p].length + ')', pp.x, pp.y - 10);
      for (let i = 0; i < Math.min(S.hands[p].length, 7); ++i)
        CE.drawCardBack(S._ctx, pp.x - 30 + i * 14, pp.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Direction
    S._ctx.fillStyle = '#888';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2 + 90, 205);

    // Bluff mode button
    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.challengePhase && S.bluffClaimStep === 0) {
      const bluffBg = S.bluffMode ? '#a44' : '#555';
      CE.drawButton(S._ctx, CANVAS_W - 140, 450, 80, 30, S.bluffMode ? 'Bluffing' : 'Bluff', { bg: bluffBg, border: '#fff', fontSize: 12 });
    }

    // Challenge button during challenge phase (for human)
    if (S.challengePhase && S.lastPlayInfo && S.lastPlayInfo.player !== 0 && S.lastPlayInfo.faceDown) {
      CE.drawButton(S._ctx, CANVAS_W / 2 - 40, 345, 80, 30, 'Liar!', { bg: '#a22', border: '#ff0', fontSize: 14 });
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      const remaining = Math.max(0, CHALLENGE_WINDOW - S.challengeTimer);
      S._ctx.fillText('Challenge? (' + remaining.toFixed(1) + 's)', CANVAS_W / 2, 390);
    }

    // Challenge result text
    if (S.challengeResult) {
      S._ctx.fillStyle = S.challengeResult.color;
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.challengeResult.text, CANVAS_W / 2, 170);
    }

    // Instructions
    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.challengePhase && S.bluffClaimStep === 0) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      if (S.bluffMode)
        S._ctx.fillText('BLUFF MODE: Click any card to play face-down, then claim a color & value', CANVAS_W / 2, CANVAS_H - 12);
      else
        S._ctx.fillText('Click a card to play honestly, or click Bluff to enable bluffing', CANVAS_W / 2, CANVAS_H - 12);
    }

    // Bluff claim overlay
    if (S.bluffClaimStep > 0)
      drawBluffClaimOverlay();
  }

  Object.assign(V, { drawGame });

})();
