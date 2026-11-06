/* Cassino: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardX = SZ.CardGames.shared.euroLayout.fanCardX;
  const aiCardX = SZ.CardGames.shared.euroLayout.fanBackX;

  const V = SZ.CardGames.v.cassino;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, WINNING_SCORE, PHASE_PLAY, PHASE_SELECT_TABLE, PHASE_AI_TURN,
    PHASE_ROUND_OVER, PLAYER_HAND_Y, BTN_Y, CAPTURE_BTN, BUILD_BTN, TRAIL_BTN } = V;

  const AI_HAND_Y = 15;
  const TABLE_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;
  const TABLE_MAX_PER_ROW = 7;

  function tableCardPos(idx) {
    const row = Math.floor(idx / TABLE_MAX_PER_ROW);
    const col = idx % TABLE_MAX_PER_ROW;
    const itemsInRow = Math.min(S.table.length - row * TABLE_MAX_PER_ROW, TABLE_MAX_PER_ROW);
    const spacing = Math.min(85, 560 / Math.max(itemsInRow - 1, 1));
    const fanWidth = (itemsInRow - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return {
      x: startX + col * spacing,
      y: TABLE_Y + row * (CE.CARD_H + 10)
    };
  }

  /* ================================================================
     CAPTURE PILE & SCORE AREAS
     ================================================================ */

  const PLAYER_PILE_X = 20;
  const PLAYER_PILE_Y = CANVAS_H / 2 + 60;
  const AI_PILE_X = CANVAS_W - 110;
  const AI_PILE_Y = 100;

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Cassino', 20, 10);

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

  function drawCapturePile(x, y, captures, sweeps, label) {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
    CE.drawRoundedRect(S._ctx, x, y, 90, 80, 5);
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

    if (sweeps > 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.fillText('Sweeps: ' + sweeps, x + 45, y + 60);
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

      if (i === S.selectedHandIdx) y -= 18;
      else if (i === S.hoverHandIdx && S.phase === PHASE_PLAY) y -= 8;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow: highlight cards that can capture
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAY && S.selectedHandIdx < 0)
        if (V.canCapture(hand[i]))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Selection highlight
      if (i === S.selectedHandIdx) {
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

  function drawBuildItem(x, y, build) {
    // Draw stacked cards slightly offset
    const cards = build.cards;
    const offsetStep = 3;
    const numCards = Math.min(cards.length, 4);
    for (let i = 0; i < numCards; ++i) {
      const ox = x + i * offsetStep;
      const oy = y - i * offsetStep;
      if (i < numCards - 1) {
        // Draw small partial card backs for stack effect
        S._ctx.save();
        S._ctx.fillStyle = '#246';
        CE.drawRoundedRect(S._ctx, ox, oy, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.fill();
        S._ctx.strokeStyle = '#fff';
        S._ctx.lineWidth = 0.5;
        S._ctx.stroke();
        S._ctx.restore();
      } else
        CE.drawCardFace(S._ctx, ox, oy, cards[cards.length - 1]);
    }

    // Draw build value badge
    const badgeX = x + CE.CARD_W - 12;
    const badgeY = y - numCards * offsetStep - 8;
    S._ctx.save();
    S._ctx.fillStyle = build.owner === 0 ? '#2a6' : '#a62';
    S._ctx.beginPath();
    S._ctx.arc(badgeX, badgeY, 12, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('' + build.value, badgeX, badgeY);
    S._ctx.restore();
  }

  function drawTable() {
    if (S.table.length === 0) {
      S._ctx.fillStyle = 'rgba(255,255,255,0.15)';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('Table empty', CANVAS_W / 2, TABLE_Y + CE.CARD_H / 2);
      return;
    }

    for (let i = 0; i < S.table.length; ++i) {
      const pos = tableCardPos(i);
      const item = S.table[i];

      if (V.isBuild(item))
        drawBuildItem(pos.x, pos.y, item);
      else
        CE.drawCardFace(S._ctx, pos.x, pos.y, item);

      const isSelected = S.selectedTableIdxs.indexOf(i) >= 0;
      const isHovered = i === S.hoverTableIdx && S.phase === PHASE_SELECT_TABLE;

      // When a hand card is selected, hint valid table cards
      if (S.selectedHandIdx >= 0 && S.phase === PHASE_SELECT_TABLE) {
        if (S._host && S._host.hintsEnabled) {
          const cardVal = V.captureValue(S.playerHand[S.selectedHandIdx]);
          if (V.captureValue(item) <= cardVal)
            CE.drawHintGlow(S._ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
        }
      }

      if (isSelected) {
        S._ctx.save();
        S._ctx.strokeStyle = '#0f0';
        S._ctx.lineWidth = 3;
        S._ctx.shadowColor = '#0f0';
        S._ctx.shadowBlur = 8;
        CE.drawRoundedRect(S._ctx, pos.x - 2, pos.y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      } else if (isHovered) {
        S._ctx.save();
        S._ctx.strokeStyle = 'rgba(0,255,0,0.4)';
        S._ctx.lineWidth = 2;
        CE.drawRoundedRect(S._ctx, pos.x - 1, pos.y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        S._ctx.stroke();
        S._ctx.restore();
      }
    }
  }

  function drawActionButtons() {
    if (S.selectedHandIdx < 0 || S.phase !== PHASE_SELECT_TABLE) return;

    const cardVal = V.captureValue(S.playerHand[S.selectedHandIdx]);
    const currentSum = V.selectedTableSum();

    // Show sum info
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    if (S.selectedTableIdxs.length > 0)
      S._ctx.fillText('Selected sum: ' + currentSum + ' / card value: ' + cardVal, CANVAS_W / 2, BTN_Y - 6);

    // Capture button
    if (V.canPlayerCapture())
      CE.drawButton(S._ctx, CAPTURE_BTN.x, CAPTURE_BTN.y, CAPTURE_BTN.w, CAPTURE_BTN.h, 'Capture', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });
    else
      CE.drawButton(S._ctx, CAPTURE_BTN.x, CAPTURE_BTN.y, CAPTURE_BTN.w, CAPTURE_BTN.h, 'Capture', { bg: '#333', border: '#666', fontSize: 13 });

    // Build button
    if (V.canPlayerBuild()) {
      const bv = V.buildValueForSelection();
      CE.drawButton(S._ctx, BUILD_BTN.x, BUILD_BTN.y, BUILD_BTN.w, BUILD_BTN.h, 'Build ' + bv, { bg: '#2a3a5a', border: '#68c', fontSize: 13 });
    } else
      CE.drawButton(S._ctx, BUILD_BTN.x, BUILD_BTN.y, BUILD_BTN.w, BUILD_BTN.h, 'Build', { bg: '#333', border: '#666', fontSize: 13 });

    // Trail button
    if (V.canPlayerTrail())
      CE.drawButton(S._ctx, TRAIL_BTN.x, TRAIL_BTN.y, TRAIL_BTN.w, TRAIL_BTN.h, 'Trail', { bg: '#5a3a2a', border: '#c86', fontSize: 13 });
    else
      CE.drawButton(S._ctx, TRAIL_BTN.x, TRAIL_BTN.y, TRAIL_BTN.w, TRAIL_BTN.h, 'Trail', { bg: '#333', border: '#666', fontSize: 13 });
  }

  function drawInstructions() {
    if (S.phase === PHASE_PLAY) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Your turn \u2014 click a card from your hand', CANVAS_W / 2, CANVAS_H - 6);
    } else if (S.phase === PHASE_SELECT_TABLE) {
      S._ctx.fillStyle = '#8cf';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Select table cards, then Capture / Build / Trail', CANVAS_W / 2, CANVAS_H - 6);
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

    const px = CANVAS_W / 2 - 210;
    const py = 80;
    const pw = 420;
    const ph = 400;

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
    S._ctx.fillText('You', CANVAS_W / 2 + 60, colY);
    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('AI', CANVAS_W / 2 + 150, colY);

    const rb = S.roundBreakdown;
    const rows = [
      ['Cards (27+)', rb.player.cards + (rb.player.cardsWin ? ' (+3)' : ''), rb.ai.cards + (rb.ai.cardsWin ? ' (+3)' : '')],
      ['Spades', rb.player.spades + (rb.player.spadesWin ? ' (+1)' : ''), rb.ai.spades + (rb.ai.spadesWin ? ' (+1)' : '')],
      ['Big Cassino', rb.player.bigCassino ? 'Yes (+2)' : 'No', rb.ai.bigCassino ? 'Yes (+2)' : 'No'],
      ['Little Cassino', rb.player.littleCassino ? 'Yes (+1)' : 'No', rb.ai.littleCassino ? 'Yes (+1)' : 'No'],
      ['Aces', '+' + rb.player.aces, '+' + rb.ai.aces],
      ['Sweeps', '+' + rb.player.sweeps, '+' + rb.ai.sweeps]
    ];

    S._ctx.font = '12px sans-serif';
    for (let i = 0; i < rows.length; ++i) {
      const ry = colY + 24 + i * 24;
      S._ctx.textAlign = 'center';
      S._ctx.fillStyle = '#ccc';
      S._ctx.fillText(rows[i][0], CANVAS_W / 2 - 80, ry);
      S._ctx.fillStyle = '#8f8';
      S._ctx.fillText(rows[i][1], CANVAS_W / 2 + 60, ry);
      S._ctx.fillStyle = '#fa0';
      S._ctx.fillText(rows[i][2], CANVAS_W / 2 + 150, ry);
    }

    // Totals
    const totalY = colY + 24 + rows.length * 24 + 10;
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.fillStyle = '#ccc';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Round Total', CANVAS_W / 2 - 80, totalY);
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('+' + rb.player.total, CANVAS_W / 2 + 60, totalY);
    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('+' + rb.ai.total, CANVAS_W / 2 + 150, totalY);

    // Cumulative
    const cumY = totalY + 24;
    S._ctx.fillStyle = '#ccc';
    S._ctx.fillText('Overall', CANVAS_W / 2 - 80, cumY);
    S._ctx.fillStyle = '#8f8';
    S._ctx.fillText('' + S.cumulativePlayer, CANVAS_W / 2 + 60, cumY);
    S._ctx.fillStyle = '#fa0';
    S._ctx.fillText('' + S.cumulativeAI, CANVAS_W / 2 + 150, cumY);

    // Winner display for game over
    if (S.gameOver) {
      const winY = cumY + 30;
      S._ctx.font = 'bold 16px sans-serif';
      if (S.cumulativePlayer > S.cumulativeAI) {
        S._ctx.fillStyle = '#4f4';
        S._ctx.fillText('You win!', CANVAS_W / 2, winY);
      } else {
        S._ctx.fillStyle = '#f44';
        S._ctx.fillText('AI wins!', CANVAS_W / 2, winY);
      }
    }

    // Continue prompt
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);

    S._ctx.restore();
  }

  function drawCassino() {
    drawTitle();
    drawScorePanel();
    drawAIHand();
    drawTable();
    drawPlayerHand();
    drawCapturePile(PLAYER_PILE_X, PLAYER_PILE_Y, S.playerCaptures, S.playerSweeps, 'Your Pile');
    drawCapturePile(AI_PILE_X, AI_PILE_Y, S.aiCaptures, S.aiSweeps, 'AI Pile');
    drawActionButtons();
    drawInstructions();

    if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawCassino();
  }

  V.tableCardPos = tableCardPos;
  V.draw = draw;

})();
