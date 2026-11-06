/* President: card painter, table layout and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['president'];
  const S = V.S;
  const { CANVAS_W, CANVAS_H, WIN_SCORE, PLAYER_NAMES, TITLE_NAMES, NUM_PLAYERS, RANK_STRENGTH, PHASE_PLAYING, TITLE_COLORS, AI_HAND_POSITIONS, PILE_Y, PILE_X, PASS_BTN, PLAY_BTN, TITLE_POINTS, PHASE_ROUND_OVER, PHASE_EXCHANGE } = V;

  /* ================================================================
     DRAWING - LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 680;
    const fanWidth = Math.min(maxWidth, total * 50);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 20;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('President', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Round ' + (S.roundNumber + 1) + '  |  First to ' + WIN_SCORE + ' pts', 10, 28);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 180;
    const py = 10;
    const pw = 170;
    const ph = 120;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scores', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 28 + p * 20;
      const titleIdx = S.titles[p];
      const titleStr = titleIdx >= 0 ? ' (' + TITLE_NAMES[titleIdx] + ')' : '';

      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 10, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText(S.scores[p] + ' pts' + titleStr, px + pw - 10, y);
    }
    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      const isSelected = S.selectedCards.indexOf(hand[i]) >= 0;
      if (isSelected) y -= 20;

      if (S.phase === PHASE_PLAYING && i === S.hoverCardIdx && S.currentTurn === 0)
        y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (isSelected) {
        S._ctx.save();
        S._ctx.strokeStyle = '#ff0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#ff0';
        S._ctx.shadowBlur = 6;
        CE.drawRoundedRect(S._ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0) {
        const sameRank = V.cardsOfRank(hand, hand[i].rank);
        let hintable = false;
        if (S.pile.length === 0)
          hintable = true;
        else if (sameRank.length >= S.pileCount && V.cardStrength(hand[i]) > RANK_STRENGTH[S.pileRank])
          hintable = true;
        if (hintable)
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = S.hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrentTurn = S.currentTurn === p && S.phase === PHASE_PLAYING;
      const titleIdx = S.titles[p];

      S._ctx.fillStyle = isCurrentTurn ? '#ff0' : '#aaa';
      S._ctx.font = isCurrentTurn ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 10;
        let labelText = PLAYER_NAMES[p] + ' (' + count + ')';
        if (titleIdx >= 0) labelText += ' ' + TITLE_NAMES[titleIdx][0];
        S._ctx.fillText(labelText, labelX, pos.y - 16);
        for (let i = 0; i < count; ++i) {
          const cy = pos.y + i * 16;
          CE.drawCardBack(S._ctx, pos.x, cy, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      } else {
        let labelText = PLAYER_NAMES[p] + ' (' + count + ')';
        if (titleIdx >= 0) labelText += ' ' + TITLE_NAMES[titleIdx][0];
        S._ctx.fillText(labelText, pos.x, pos.y - 2);
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + i * 22;
          CE.drawCardBack(S._ctx, cx, pos.y + 14, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      }

      if (S.finishOrder.indexOf(p) >= 0 && S.hands[p].length === 0) {
        const rank = S.finishOrder.indexOf(p);
        S._ctx.fillStyle = TITLE_COLORS[rank];
        S._ctx.font = 'bold 11px sans-serif';
        const fx = pos.dir === 'vertical' ? pos.x + 10 : pos.x + 60;
        const fy = pos.dir === 'vertical' ? pos.y + 10 : pos.y + 30;
        S._ctx.fillText(TITLE_NAMES[rank], fx, fy);
      }
    }
  }

  function drawPileArea() {
    S._ctx.save();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    S._ctx.lineWidth = 2;
    CE.drawRoundedRect(S._ctx, PILE_X - 30, PILE_Y - 10, CE.CARD_W + 60, CE.CARD_H + 40, 10);
    S._ctx.stroke();
    S._ctx.restore();

    if (S.pile.length === 0) {
      CE.drawEmptySlot(S._ctx, PILE_X, PILE_Y, 'Pile');
      return;
    }

    const showCount = Math.min(S.pile.length, S.pileCount);
    const startIdx = S.pile.length - showCount;
    for (let i = 0; i < showCount; ++i) {
      const offset = i * 18;
      CE.drawCardFace(S._ctx, PILE_X + offset, PILE_Y, S.pile[startIdx + i]);
    }

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.pileCount + 'x ' + S.pileRank + ' (' + S.pile.length + ' in pile)', CANVAS_W / 2, PILE_Y + CE.CARD_H + 6);
  }

  function drawTurnIndicator() {
    if (S.phase !== PHASE_PLAYING) return;

    const name = S.currentTurn === 0 ? 'Your' : PLAYER_NAMES[S.currentTurn] + "'s";
    S._ctx.fillStyle = S.currentTurn === 0 ? '#8f8' : '#ff0';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(name + ' turn', CANVAS_W / 2, PILE_Y - 24);
  }

  function drawPlayerButtons() {
    if (S.phase !== PHASE_PLAYING || S.currentTurn !== 0) return;
    if (S.roundOver || S.gameOver) return;

    const hasSelection = S.selectedCards.length > 0;
    const selectionValid = hasSelection && V.isValidPlay(S.selectedCards, S.hands[0]);

    if (hasSelection) {
      const bg = selectionValid ? '#2a5a2a' : '#5a2a2a';
      const border = selectionValid ? '#6c6' : '#c66';
      CE.drawButton(S._ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, 'Play', { bg, border, fontSize: 13 });
    }

    CE.drawButton(S._ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass', { bg: '#3a3a5a', border: '#88c', fontSize: 13 });

    if (S.currentTurn === 0) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Select cards of the same rank, then Play or Pass', CANVAS_W / 2, CANVAS_H - 6);
    }
  }

  function drawExchangeUI() {
    S._ctx.save();
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    const myTitle = S.titles[0];
    if (myTitle < 0) {
      S._ctx.fillText('Waiting for card exchange...', CANVAS_W / 2, 260);
      S._ctx.restore();
      return;
    }

    const count = V.getExchangeCount(myTitle);
    if (count === 0) {
      S._ctx.fillText('No exchange needed', CANVAS_W / 2, 260);
      S._ctx.restore();
      return;
    }

    const giving = myTitle <= 1 ? 'worst' : 'best';
    S._ctx.fillText(TITLE_NAMES[myTitle] + ': Select ' + count + ' ' + giving + ' card(s) to give', CANVAS_W / 2, 250);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('(' + S.selectedCards.length + '/' + count + ' selected)', CANVAS_W / 2, 274);

    if (S.selectedCards.length === count) {
      const btn = { x: CANVAS_W / 2 - 60, y: 290, w: 120, h: 30 };
      CE.drawButton(S._ctx, btn.x, btn.y, btn.w, btn.h, 'Exchange', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });
    }
    S._ctx.restore();
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 160;
    const py = 130;
    const pw = 320;
    const ph = 280;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round ' + S.roundNumber + ' Results', CANVAS_W / 2, py + 12);

    S._ctx.font = '13px sans-serif';
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const p = S.finishOrder[i];
      const y = py + 44 + i * 28;

      S._ctx.fillStyle = TITLE_COLORS[i];
      S._ctx.textAlign = 'left';
      S._ctx.fillText(TITLE_NAMES[i], px + 20, y);

      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(PLAYER_NAMES[p], px + pw / 2, y);

      S._ctx.textAlign = 'right';
      S._ctx.fillText('+' + TITLE_POINTS[i] + ' (Total: ' + S.scores[p] + ')', px + pw - 20, y);
    }

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 24);
    S._ctx.restore();
  }

  function drawAll() {
    drawTitle();
    drawScorePanel();
    drawAIHands();
    drawPileArea();
    drawTurnIndicator();
    drawPlayerHand();

    if (S.phase === PHASE_EXCHANGE)
      drawExchangeUI();
    else if (S.phase === PHASE_PLAYING)
      drawPlayerButtons();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  Object.assign(V, { playerCardY, playerCardX, drawAll });

})();
