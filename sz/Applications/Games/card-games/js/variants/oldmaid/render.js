/* Old Maid: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.oldmaid;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, SUIT_GLYPHS, PHASE_PLAYER_DRAW, PHASE_GAME_OVER } = V;

  function playerCardX(idx, total) {
    const maxWidth = 680;
    const fanWidth = Math.min(maxWidth, total * 50);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function aiDrawCardX(idx, total) {
    const maxWidth = 580;
    const fanWidth = Math.min(maxWidth, total * 45);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function drawOldMaid() {
    // Title and phase info
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Old Maid', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    const phaseNames = ['Dealing...', 'Removing initial pairs...', 'Your turn: draw a card', 'AI is thinking...', 'Discarding pair...', 'Game Over'];
    S._ctx.fillText(phaseNames[S.phase] || '', 10, 28);

    drawInfoPanel();
    drawAiDrawableHand();
    drawPlayerHand();
    drawPairStacks();

    if (S.phase === PHASE_PLAYER_DRAW)
      drawDrawPrompt();

    if (S.phase === PHASE_GAME_OVER)
      drawGameOverUI();
  }

  function drawInfoPanel() {
    const px = CANVAS_W - 170;
    const py = 10;
    const pw = 160;
    const ph = 90;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Old Maid', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('You: ' + S.playerHand.length + ' cards, ' + S.playerPairs.length + ' pairs', px + 10, py + 28);
    S._ctx.fillStyle = '#faa';
    S._ctx.fillText('AI: ' + S.aiHand.length + ' cards, ' + S.aiPairs.length + ' pairs', px + 10, py + 46);

    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('Score: ' + S.score, px + 10, py + 66);
    S._ctx.restore();
  }

  function drawAiDrawableHand() {
    const total = S.aiDrawableOrder.length;
    if (total === 0) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('AI has no cards', CANVAS_W / 2, 110);
      return;
    }

    // Label
    S._ctx.fillStyle = S.phase === PHASE_PLAYER_DRAW ? '#ff0' : '#aaa';
    S._ctx.font = (S.phase === PHASE_PLAYER_DRAW ? 'bold ' : '') + '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('AI\'s Hand (' + S.aiHand.length + ' cards)', CANVAS_W / 2, 60);

    const y = 80;
    for (let di = 0; di < total; ++di) {
      const x = aiDrawCardX(di, total);
      const isHovered = S.phase === PHASE_PLAYER_DRAW && S.hoverCardIdx >= 0 && S.aiDrawableOrder[di] === S.hoverCardIdx;

      if (isHovered) {
        S._ctx.save();
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 12;
        CE.drawCardBack(S._ctx, x, y - 5);
        S._ctx.restore();

        // Highlight border
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 2;
        CE.drawRoundedRect(S._ctx, x - 1, y - 6, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      } else
        CE.drawCardBack(S._ctx, x, y);
    }
  }

  function drawPlayerHand() {
    const total = S.playerHand.length;
    if (total === 0) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('Your hand is empty', CANVAS_W / 2, CANVAS_H - 70);
      return;
    }

    // Label
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Your Hand (' + total + ' cards)', CANVAS_W / 2, CANVAS_H - CE.CARD_H - 40);

    const y = CANVAS_H - CE.CARD_H - 20;

    for (let i = 0; i < total; ++i) {
      if (S.playerHand[i]._dealing) continue;
      const x = playerCardX(i, total);
      CE.drawCardFace(S._ctx, x, y, S.playerHand[i]);

      // Hint glow: highlight cards that form pairs (matching rank)
      if (S._host && S._host.hintsEnabled && S.phase !== PHASE_GAME_OVER) {
        let hasPair = false;
        for (let j = 0; j < total; ++j) {
          if (j !== i && S.playerHand[j].rank === S.playerHand[i].rank) {
            hasPair = true;
            break;
          }
        }
        if (hasPair)
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

      // Glow the Old Maid if game is over
      if (S.phase === PHASE_GAME_OVER && V.isTheOldMaid(S.playerHand[i])) {
        S._ctx.save();
        S._ctx.strokeStyle = '#f44';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#f44';
        S._ctx.shadowBlur = 10 + 6 * Math.sin(S.queenGlowTimer * 4);
        CE.drawRoundedRect(S._ctx, x - 2, y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 2);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawPairStacks() {
    // Player pairs on the left
    const pairStartX = 15;
    const pairStartY = 220;

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Your Pairs (' + S.playerPairs.length + ')', pairStartX, pairStartY - 14);

    const maxVisible = 8;
    const pairOffset = 20;
    const visiblePairs = S.playerPairs.slice(-maxVisible);
    for (let i = 0; i < visiblePairs.length; ++i) {
      const y = pairStartY + i * pairOffset;
      S._ctx.save();
      S._ctx.globalAlpha = 0.7;
      drawMiniPair(pairStartX, y, visiblePairs[i]);
      S._ctx.restore();
    }

    // AI pairs on the right
    const aiPairX = CANVAS_W - 110;
    const aiPairY = 220;

    S._ctx.fillStyle = '#faa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('AI Pairs (' + S.aiPairs.length + ')', aiPairX + 90, aiPairY - 14);

    const visibleAiPairs = S.aiPairs.slice(-maxVisible);
    for (let i = 0; i < visibleAiPairs.length; ++i) {
      const y = aiPairY + i * pairOffset;
      S._ctx.save();
      S._ctx.globalAlpha = 0.7;
      drawMiniPair(aiPairX, y, visibleAiPairs[i]);
      S._ctx.restore();
    }
  }

  function drawMiniPair(x, y, pair) {
    const mw = 40;
    const mh = 18;

    // First card mini
    S._ctx.fillStyle = '#fff';
    S._ctx.strokeStyle = '#999';
    S._ctx.lineWidth = 0.5;
    CE.drawRoundedRect(S._ctx, x, y, mw, mh, 2);
    S._ctx.fill();
    S._ctx.stroke();

    const c1 = pair[0];
    S._ctx.fillStyle = CE.resolveSuitColor(c1.suit);
    S._ctx.font = 'bold 10px serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(c1.rank + (SUIT_GLYPHS[c1.suit] || c1.suit), x + 3, y + mh / 2);

    // Second card mini (overlapping slightly)
    const x2 = x + mw + 4;
    S._ctx.fillStyle = '#fff';
    S._ctx.strokeStyle = '#999';
    S._ctx.lineWidth = 0.5;
    CE.drawRoundedRect(S._ctx, x2, y, mw, mh, 2);
    S._ctx.fill();
    S._ctx.stroke();

    const c2 = pair[1];
    S._ctx.fillStyle = CE.resolveSuitColor(c2.suit);
    S._ctx.font = 'bold 10px serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(c2.rank + (SUIT_GLYPHS[c2.suit] || c2.suit), x2 + 3, y + mh / 2);
  }

  function drawDrawPrompt() {
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('\u25B6 Click a card from AI\'s hand to draw', CANVAS_W / 2, 190);
  }

  function drawGameOverUI() {
    const px = CANVAS_W / 2 - 160;
    const py = 220;
    const pw = 320;
    const ph = 160;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    const playerIsOldMaid = S.playerHand.some(c => V.isTheOldMaid(c));

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Game Over', CANVAS_W / 2, py + 14);

    if (playerIsOldMaid) {
      S._ctx.fillStyle = '#f66';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.fillText('You are the Old Maid!', CANVAS_W / 2, py + 50);

      S._ctx.font = '13px sans-serif';
      S._ctx.fillStyle = '#faa';
      S._ctx.fillText('The Q\u2660 was left in your hand.', CANVAS_W / 2, py + 76);

      S._ctx.fillStyle = '#f44';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.fillText('Score: 0', CANVAS_W / 2, py + 100);
    } else {
      S._ctx.fillStyle = '#4f4';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.fillText('AI is the Old Maid! You win!', CANVAS_W / 2, py + 50);

      S._ctx.font = '13px sans-serif';
      S._ctx.fillStyle = '#afa';
      S._ctx.fillText('The Q\u2660 was left in AI\'s hand.', CANVAS_W / 2, py + 76);

      S._ctx.fillStyle = '#4f4';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.fillText('Score: 100', CANVAS_W / 2, py + 100);
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    S._ctx.restore();

    // Show the remaining card(s) face up
    if (S.aiHand.length > 0) {
      for (let i = 0; i < S.aiHand.length; ++i) {
        const x = CANVAS_W / 2 - (S.aiHand.length * 40) / 2 + i * 40;
        CE.drawCardFace(S._ctx, x, py - CE.CARD_H - 10, S.aiHand[i]);

        if (V.isTheOldMaid(S.aiHand[i])) {
          S._ctx.save();
          S._ctx.strokeStyle = '#f44';
          S._ctx.lineWidth = 3;
          S._ctx.shadowColor = '#f44';
          S._ctx.shadowBlur = 10 + 6 * Math.sin(S.queenGlowTimer * 4);
          CE.drawRoundedRect(S._ctx, x - 2, py - CE.CARD_H - 12, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 2);
          S._ctx.stroke();
          S._ctx.restore();
        }
      }
    }
  }

  Object.assign(V, { playerCardX, aiDrawCardX, drawOldMaid });

})();
