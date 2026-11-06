/* Piquet: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.piquet;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, HAND_SIZE, GAME_WIN_SCORE, ELDER_MAX_EXCHANGE, PHASE_EXCHANGE,
    PHASE_DECLARE_POINT, PHASE_DECLARE_SEQUENCE, PHASE_DECLARE_SET, PHASE_TRICK_PLAY,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER, EXCHANGE_BTN, PLAYER_HAND_Y } = V;

  const AI_HAND_Y = 30;

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 160;
    const spacing = Math.min(55, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     DRAWING - SCORE PANEL
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 195;
    const py = 10;
    const pw = 185;
    const ph = 130;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Piquet', px + 10, py + 6);

    S._ctx.font = '11px sans-serif';
    let y = py + 24;

    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('You: ' + S.playerScore, px + 10, y);
    y += 16;

    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('AI: ' + S.aiScore, px + 10, y);
    y += 18;

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '10px sans-serif';
    S._ctx.fillText('First to ' + GAME_WIN_SCORE + ' wins', px + 10, y);
    y += 14;

    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('Round ' + (S.roundNumber + 1), px + 10, y);
    y += 14;

    const dealerLabel = S.dealer === 0 ? 'You deal' : 'AI deals';
    S._ctx.fillText(dealerLabel, px + 10, y);

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - PLAYER HAND
     ================================================================ */

  function drawPlayerHand() {
    const total = S.playerHand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      // Raise selected cards during exchange
      if (S.phase === PHASE_EXCHANGE && S.selectedIndices.includes(i))
        y -= 18;

      // Raise hovered card
      if (i === S.hoverCardIdx && (S.phase === PHASE_EXCHANGE || (S.phase === PHASE_TRICK_PLAY && S.currentTurn === 0)))
        y -= 10;

      CE.drawCardFace(S._ctx, x, y, S.playerHand[i]);

      // Hint glow during exchange
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_EXCHANGE && !S.exchangeDone) {
        if (V.isDiscardCandidate(i))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

      // Hint glow during trick play
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_TRICK_PLAY && S.currentTurn === 0) {
        if (V.isValidPlay(S.playerHand[i], S.playerHand))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

      // Dim invalid cards during trick play
      if (S.phase === PHASE_TRICK_PLAY && S.currentTurn === 0 && !V.isValidPlay(S.playerHand[i], S.playerHand)) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, 4);
        S._ctx.fill();
        S._ctx.restore();
      }
    }
  }

  /* ================================================================
     DRAWING - AI HAND
     ================================================================ */

  function drawAIHand() {
    const count = S.aiHand.length;
    if (count === 0) return;

    S._ctx.fillStyle = (S.currentTurn === 1 && S.phase === PHASE_TRICK_PLAY) ? '#ff0' : '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('AI (' + count + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    const spacing = Math.min(28, 500 / Math.max(count, 1));
    const totalW = (count - 1) * spacing + CE.CARD_W * 0.55;
    const startX = CANVAS_W / 2 - totalW / 2;
    for (let i = 0; i < count; ++i)
      CE.drawCardBack(S._ctx, startX + i * spacing, AI_HAND_Y + 12, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
  }

  /* ================================================================
     DRAWING - TALON
     ================================================================ */

  function drawTalon() {
    if (S.talon.length === 0) return;
    const tx = 30;
    const ty = 250;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Talon (' + S.talon.length + ')', tx + CE.CARD_W * 0.3, ty - 4);

    for (let i = 0; i < Math.min(S.talon.length, 3); ++i)
      CE.drawCardBack(S._ctx, tx + i * 3, ty + i * 2, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
  }

  /* ================================================================
     DRAWING - TRICK AREA
     ================================================================ */

  function drawTrickArea() {
    // Center trick display
    const cx = CANVAS_W / 2;
    const cy = 270;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const entry = S.trickCards[i];
      const yOff = entry.player === 0 ? 30 : -30;
      const xOff = i === 0 ? -40 : 10;
      CE.drawCardFace(S._ctx, cx + xOff - CE.CARD_W / 2, cy + yOff - CE.CARD_H / 2, entry.card);
    }

    // Trick count display
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/12  |  You: ' + S.playerTricksWon + '  AI: ' + S.aiTricksWon, cx, cy + 65);

    if (S.phase === PHASE_TRICK_DONE) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.trickWinnerLabel, cx, cy - 65);
    }
  }

  /* ================================================================
     DRAWING - EXCHANGE UI
     ================================================================ */

  function drawExchangeUI() {
    const elderIsPlayer = V.elder() === 0;
    const maxExch = elderIsPlayer
      ? Math.min(ELDER_MAX_EXCHANGE, S.talon.length)
      : Math.min(S.talon.length, S.talon.length);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Exchange Phase', CANVAS_W / 2, 180);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    const role = elderIsPlayer ? 'You are Elder (non-dealer)' : 'You are Younger (dealer)';
    S._ctx.fillText(role, CANVAS_W / 2, 200);

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '13px sans-serif';
    S._ctx.fillText('Select 1-' + maxExch + ' cards to discard, then click Exchange', CANVAS_W / 2, 220);

    S._ctx.fillStyle = '#8cf';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Selected: ' + S.selectedIndices.length + '/' + maxExch, CANVAS_W / 2, 240);

    // Exchange button
    const canExchange = S.selectedIndices.length >= 1 && S.selectedIndices.length <= maxExch;
    const bg = canExchange ? '#1a5a1a' : '#333';
    const border = canExchange ? '#4a4' : '#555';
    CE.drawButton(S._ctx, EXCHANGE_BTN.x, EXCHANGE_BTN.y, EXCHANGE_BTN.w, EXCHANGE_BTN.h, 'Exchange', { bg, border, textColor: '#fff', fontSize: 13 });
  }

  /* ================================================================
     DRAWING - DECLARATION UI
     ================================================================ */

  function drawDeclarationUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const px = CANVAS_W / 2 - 220;
    const py = 140;
    const pw = 440;
    const ph = 30 + S.declResults.length * 28 + 30;

    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 8);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Declarations', CANVAS_W / 2, py + 8);

    let y = py + 32;
    const currentPhaseIdx = S.phase === PHASE_DECLARE_POINT ? 0
      : S.phase === PHASE_DECLARE_SEQUENCE ? 1
      : 2;

    for (let i = 0; i < S.declResults.length; ++i) {
      const d = S.declResults[i];
      const isActive = (d.phase === 'Point' && S.phase === PHASE_DECLARE_POINT)
        || (d.phase === 'Sequence' && S.phase === PHASE_DECLARE_SEQUENCE)
        || (d.phase === 'Set' && S.phase === PHASE_DECLARE_SET)
        || d.phase === 'Bonus';

      // Only show declarations up to current phase
      const declPhaseOrder = { 'Point': 0, 'Sequence': 1, 'Set': 2, 'Bonus': 2 };
      if ((declPhaseOrder[d.phase] || 0) > currentPhaseIdx) continue;

      S._ctx.fillStyle = d.winner === 'player' ? '#8cf' : d.winner === 'ai' ? '#f88' : '#aaa';
      S._ctx.font = isActive ? 'bold 12px sans-serif' : '12px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(d.msg, px + 16, y);
      y += 24;
    }

    // Totals
    S._ctx.fillStyle = '#8cf';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Your decl: +' + S.playerDeclScore + '  |  AI decl: +' + S.aiDeclScore, CANVAS_W / 2, y + 4);

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - ROUND OVER UI
     ================================================================ */

  function drawRoundOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    if (S.gameOver) {
      const won = S.playerScore >= GAME_WIN_SCORE;
      S._ctx.fillStyle = won ? '#4f4' : '#f44';
      S._ctx.fillText(won ? 'You Win!' : 'AI Wins!', CANVAS_W / 2, 160);

      S._ctx.fillStyle = '#fff';
      S._ctx.font = '16px sans-serif';
      S._ctx.fillText('You: ' + S.playerScore + '  |  AI: ' + S.aiScore, CANVAS_W / 2, 200);

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to start a new game', CANVAS_W / 2, 240);
    } else {
      S._ctx.fillText('Round ' + S.roundNumber + ' Complete', CANVAS_W / 2, 140);

      let y = 180;
      S._ctx.font = '14px sans-serif';

      // Declaration summary
      for (const d of S.declResults) {
        S._ctx.fillStyle = d.winner === 'player' ? '#8cf' : d.winner === 'ai' ? '#f88' : '#aaa';
        S._ctx.fillText(d.msg, CANVAS_W / 2, y);
        y += 22;
      }

      y += 8;
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText('Tricks won - You: ' + S.playerTricksWon + '  AI: ' + S.aiTricksWon, CANVAS_W / 2, y);
      y += 20;
      S._ctx.fillText('Trick points - You: +' + S.playerTrickPlayPts + '  AI: +' + S.aiTrickPlayPts, CANVAS_W / 2, y);
      y += 24;

      if (S.playerTricksWon === HAND_SIZE) {
        S._ctx.fillStyle = '#4f4';
        S._ctx.fillText('CAPOT! You win all tricks (+40)', CANVAS_W / 2, y);
        y += 22;
      } else if (S.aiTricksWon === HAND_SIZE) {
        S._ctx.fillStyle = '#f84';
        S._ctx.fillText('AI CAPOT! All tricks (+40)', CANVAS_W / 2, y);
        y += 22;
      }

      S._ctx.fillStyle = '#8cf';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.fillText('You: ' + S.playerScore, CANVAS_W / 2 - 80, y);
      S._ctx.fillStyle = '#f88';
      S._ctx.fillText('AI: ' + S.aiScore, CANVAS_W / 2 + 80, y);
      y += 30;

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to deal next round', CANVAS_W / 2, y);
    }

    S._ctx.restore();
  }

  /* ================================================================
     DRAWING - STATUS BAR
     ================================================================ */

  function drawStatusBar() {
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.font = '12px sans-serif';

    if (S.phase === PHASE_TRICK_PLAY) {
      if (S.currentTurn === 0) {
        S._ctx.fillStyle = '#8f8';
        S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
      } else {
        S._ctx.fillStyle = '#aaa';
        S._ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 8);
      }
    } else if (S.phase === PHASE_EXCHANGE) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.fillText('Select cards to exchange with the talon', CANVAS_W / 2, CANVAS_H - 8);
    }
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawAll() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Piquet', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    const elderLabel = V.elder() === 0 ? 'You' : 'AI';
    S._ctx.fillText('Round ' + (S.roundNumber + 1) + ' \u2014 Elder: ' + elderLabel, 10, 28);

    drawScorePanel();
    drawAIHand();

    if (S.phase === PHASE_EXCHANGE) {
      drawTalon();
      drawExchangeUI();
    }

    if (S.phase === PHASE_DECLARE_POINT || S.phase === PHASE_DECLARE_SEQUENCE || S.phase === PHASE_DECLARE_SET)
      drawDeclarationUI();

    if (S.phase === PHASE_TRICK_PLAY || S.phase === PHASE_TRICK_DONE)
      drawTrickArea();

    drawPlayerHand();
    drawStatusBar();

    if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawAll();
  }

  V.playerCardX = playerCardX;
  V.draw = draw;

})();
