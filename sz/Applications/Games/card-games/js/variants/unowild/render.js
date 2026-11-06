/* Uno All Wild: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unowild'];
  const S = V.S;
  const PL = SZ.CardGames.shared.sheddingPlaces;
  const { CANVAS_W, CANVAS_H, rainbowColors, targetChoiceRects, PLAYER_NAMES, NUM_PLAYERS, gapChoiceRects, AI_HAND_POSITIONS, DRAW_PILE_Y, DRAW_PILE_X, DISCARD_Y, DISCARD_X } = V;

  function playerCardX(idx, total) {
    const maxWidth = 680;
    const fanWidth = Math.min(maxWidth, total * 55);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 25;
  }

  function drawWildCard(x, y, w, h, card, faceDown) {
    if (faceDown) {
      CE.drawCardBack(S._ctx, x, y, w, h);
      return;
    }
    const val = card.value;
    const art = {
      'Wild': ['W', ''], 'Wild Draw Two': ['+2', 'DRAW TWO'], 'Wild Reverse': ['\u21C4', 'REVERSE'], 'Wild Skip': ['\u2718', 'SKIP'],
      'Wild Forced Swap': ['\u21CB', 'SWAP'], 'Wild Targeted Draw Two': ['\u2691+2', 'TARGET'], 'Wild Gap': ['\u23ED', 'GAP']
    }[val] || [String(val), ''];
    CE.drawColorCard(S._ctx, x, y, w, h, { color: '#303030', label: art[0], sub: art[1], rainbow: true, ink: '#ffffff', corner: getShortLabel(val) }, card);
  }


  function getShortLabel(val) {
    switch (val) {
      case 'Wild': return 'W';
      case 'Wild Draw Two': return '+2';
      case 'Wild Reverse': return 'REV';
      case 'Wild Skip': return 'SKP';
      case 'Wild Forced Swap': return 'SWP';
      case 'Wild Targeted Draw Two': return 'T+2';
      case 'Wild Gap': return 'GAP';
      default: return '?';
    }
  }

  function drawTargetChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.65)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    const title = S.targetAction === 'swap' ? 'Swap hands with:' : 'Choose target to draw 2:';
    S._ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 60);

    targetChoiceRects.length = 0;
    const btnW = 140;
    const btnH = 40;
    const gap = 20;

    const targets = [];
    for (let p = 1; p < NUM_PLAYERS; ++p)
      if (!PL.isFinished(S, p)) targets.push(p);

    const totalW = targets.length * btnW + (targets.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 10;

    for (let i = 0; i < targets.length; ++i) {
      const bx = startX + i * (btnW + gap);
      const p = targets[i];
      const label = PLAYER_NAMES[p] + ' (' + S.hands[p].length + ' cards)';

      S._ctx.fillStyle = S.targetAction === 'swap' ? '#4a4' : '#a44';
      CE.drawRoundedRect(S._ctx, bx, y, btnW, btnH, 6);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();

      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 12px sans-serif';
      S._ctx.fillText(label, bx + btnW / 2, y + btnH / 2);

      targetChoiceRects.push({ x: bx, y: y, w: btnW, h: btnH, target: p });
    }

    S._ctx.restore();
  }

  function drawGapChoiceOverlay() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.65)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Skip how many players? (1\u20133)', CANVAS_W / 2, CANVAS_H / 2 - 60);

    gapChoiceRects.length = 0;
    const btnW = 80;
    const btnH = 50;
    const gapSize = 20;

    const options = [1, 2, 3];
    const totalW = options.length * btnW + (options.length - 1) * gapSize;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 10;

    for (let i = 0; i < options.length; ++i) {
      const bx = startX + i * (btnW + gapSize);
      const n = options[i];

      S._ctx.fillStyle = '#649';
      CE.drawRoundedRect(S._ctx, bx, y, btnW, btnH, 6);
      S._ctx.fill();
      S._ctx.strokeStyle = '#fff';
      S._ctx.lineWidth = 1;
      S._ctx.stroke();

      S._ctx.fillStyle = '#fff';
      S._ctx.font = 'bold 20px sans-serif';
      S._ctx.fillText(String(n), bx + btnW / 2, y + btnH / 2);

      gapChoiceRects.push({ x: bx, y: y, w: btnW, h: btnH, gapCount: n });
    }

    S._ctx.restore();
  }

  function drawDirectionIndicator() {
    S._ctx.save();
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    const arrow = S.direction === 1 ? '\u21BB' : '\u21BA';
    S._ctx.fillText('Direction: ' + arrow, CANVAS_W / 2, 225);
    S._ctx.restore();
  }

  function drawCurrentPlayerIndicator() {
    if (S.roundOver || S.gameOver) return;
    S._ctx.save();
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'center';

    if (S.currentPlayer === 0) {
      S._ctx.fillText('\u25BC', CANVAS_W / 2, playerCardY() - 8);
    } else {
      const pos = AI_HAND_POSITIONS[S.currentPlayer];
      if (pos) {
        if (pos.dir === 'vertical')
          S._ctx.fillText('\u25B6', pos.x - 10, pos.y + 20);
        else
          S._ctx.fillText('\u25BC', pos.x + 40, pos.y - 4);
      }
    }
    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (PL.drawPlaceBadge(S._ctx, S, 0, CANVAS_W / 2, playerCardY() + CE.CARD_H / 2, 'center', 26)) return;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (i === S.hoverCardIdx && S.currentPlayer === 0 && !S.waitingForTargetChoice && !S.waitingForGapChoice)
        y -= 12;

      drawWildCard(x, y, CE.CARD_W, CE.CARD_H, hand[i], false);
      if (S._host && S._host.hintsEnabled && S.currentPlayer === 0 && !S.waitingForTargetChoice && !S.waitingForGapChoice && !S.roundOver && !S.gameOver)
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = S.hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrent = S.currentPlayer === p && !S.roundOver && !S.gameOver;

      S._ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 10;
        S._ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', labelX, pos.y - 16);
        if (PL.drawPlaceBadge(S._ctx, S, p, pos.x + CE.CARD_W * 0.275, pos.y + 30, 'center', 22)) continue;
        for (let i = 0; i < Math.min(count, 10); ++i) {
          const cy = pos.y + i * 16;
          CE.drawCardBack(S._ctx, pos.x, cy, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
        if (count > 10) {
          S._ctx.fillStyle = '#aaa';
          S._ctx.font = '10px sans-serif';
          S._ctx.fillText('+' + (count - 10), pos.x + 5, pos.y + 10 * 16 + 4);
        }
      } else {
        S._ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 2);
        if (PL.drawPlaceBadge(S._ctx, S, p, pos.x, pos.y + 14 + CE.CARD_H * 0.275, 'left', 22)) continue;
        for (let i = 0; i < Math.min(count, 14); ++i) {
          const cx = pos.x + i * 22;
          CE.drawCardBack(S._ctx, cx, pos.y + 14, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
        if (count > 14) {
          S._ctx.fillStyle = '#aaa';
          S._ctx.font = '10px sans-serif';
          S._ctx.fillText('+' + (count - 14), pos.x + 14 * 22 + 5, pos.y + 20);
        }
      }
    }
  }

  function drawGame() {
    if (S.topCard)
      drawWildCard(DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, S.topCard, false);

    CE.drawCardBack(S._ctx, DRAW_PILE_X, DRAW_PILE_Y, CE.CARD_W, CE.CARD_H);
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(String(S.deck.length), DRAW_PILE_X + CE.CARD_W / 2, DRAW_PILE_Y + CE.CARD_H + 14);

    drawDirectionIndicator();
    drawCurrentPlayerIndicator();
    drawAIHands();
    drawPlayerHand();

    if (!S.roundOver && !S.gameOver && S.currentPlayer === 0 && !S.waitingForTargetChoice && !S.waitingForGapChoice) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 8);
    }

    PL.drawFinishedStatus(S._ctx, S, CANVAS_W / 2, CANVAS_H - 8);

    if (S.roundOver) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 8);
    }

    if (S.waitingForTargetChoice)
      drawTargetChoiceOverlay();

    if (S.waitingForGapChoice)
      drawGapChoiceOverlay();
  }

  Object.assign(V, { playerCardY, playerCardX, drawGame });

})();
