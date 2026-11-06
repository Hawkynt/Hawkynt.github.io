/* Cheat: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.cheat;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, PHASE_PLAYER_TURN, PHASE_CHALLENGE_WINDOW,
    PHASE_AI_TURN, PHASE_RESOLVING, PHASE_GAME_OVER, PLAYER_HAND_Y, AI1_HAND_Y, AI2_HAND_X,
    AI3_HAND_X, PILE_X, PILE_Y, PLAY_BTN, CHEAT_BTN } = V;

  function playerCardX(idx, total) {
    const maxWidth = 700;
    const spacing = total > 1 ? Math.min(50, maxWidth / (total - 1)) : 0;
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  // AI 1: top center (face-down, horizontal fan)
  function ai1CardX(idx, total) {
    const maxWidth = 500;
    const sw = CE.CARD_W * 0.5;
    const spacing = total > 1 ? Math.min(25, maxWidth / (total - 1)) : 0;
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - sw / 2;
    return startX + idx * spacing;
  }

  // AI 2: left side (face-down, vertical fan)
  function ai2CardY(idx, total) {
    const maxHeight = 380;
    const sh = CE.CARD_H * 0.5;
    const spacing = total > 1 ? Math.min(22, maxHeight / (total - 1)) : 0;
    const fanHeight = (total - 1) * spacing;
    const startY = (CANVAS_H - fanHeight) / 2 - sh / 2;
    return startY + idx * spacing;
  }

  // AI 3: right side (face-down, vertical fan)
  function ai3CardY(idx, total) {
    return ai2CardY(idx, total);
  }

  function drawCheat() {
    drawTurnInfo();
    drawAI1Hand();
    drawAI2Hand();
    drawAI3Hand();
    drawDiscardPile();
    drawRequiredRank();
    drawPlayerHand();
    drawButtons();
    drawMessageArea();
    drawResolveOverlay();
    drawScoreArea();

    if (S.phase === PHASE_GAME_OVER)
      drawGameOverUI();
  }

  function drawTurnInfo() {
    const name = PLAYER_NAMES[S.currentPlayer];
    const turnColor = S.currentPlayer === 0 ? '#8f8' : '#fa0';

    S._ctx.fillStyle = turnColor;
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';

    let phaseLabel = '';
    if (S.phase === PHASE_PLAYER_TURN) phaseLabel = 'Your Turn';
    else if (S.phase === PHASE_AI_TURN) phaseLabel = name + '\'s Turn';
    else if (S.phase === PHASE_CHALLENGE_WINDOW) phaseLabel = 'Challenge Window';
    else if (S.phase === PHASE_RESOLVING) phaseLabel = 'Resolving...';
    else if (S.phase === PHASE_GAME_OVER) phaseLabel = 'Game Over';

    S._ctx.fillText(phaseLabel, 10, 10);

    // Card counts
    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#aaa';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const label = PLAYER_NAMES[p] + ': ' + S.hands[p].length;
      S._ctx.fillText(label, 10, 28 + p * 14);
    }
  }

  function drawScoreArea() {
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pile: ' + S.discardPile.length, 10, 90);
  }

  function drawAI1Hand() {
    const hand = S.hands[1];
    const total = hand.length;
    const sw = CE.CARD_W * 0.5;
    const sh = CE.CARD_H * 0.5;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('AI 1 (' + total + ')', CANVAS_W / 2, AI1_HAND_Y - 1);

    for (let i = 0; i < total; ++i)
      CE.drawCardBack(S._ctx, ai1CardX(i, total), AI1_HAND_Y, sw, sh);
  }

  function drawAI2Hand() {
    const hand = S.hands[2];
    const total = hand.length;
    const sw = CE.CARD_W * 0.5;
    const sh = CE.CARD_H * 0.5;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('AI 2 (' + total + ')', AI2_HAND_X + sw / 2, ai2CardY(0, total) - 4);

    for (let i = 0; i < total; ++i)
      CE.drawCardBack(S._ctx, AI2_HAND_X, ai2CardY(i, total), sw, sh);
  }

  function drawAI3Hand() {
    const hand = S.hands[3];
    const total = hand.length;
    const sw = CE.CARD_W * 0.5;
    const sh = CE.CARD_H * 0.5;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('AI 3 (' + total + ')', AI3_HAND_X + sw / 2, ai3CardY(0, total) - 4);

    for (let i = 0; i < total; ++i)
      CE.drawCardBack(S._ctx, AI3_HAND_X, ai3CardY(i, total), sw, sh);
  }

  function drawDiscardPile() {
    if (S.discardPile.length === 0) {
      CE.drawEmptySlot(S._ctx, PILE_X, PILE_Y, 'Pile');
      return;
    }

    // Stack effect
    const count = Math.min(S.discardPile.length, 4);
    for (let i = 0; i < count; ++i) {
      const offset = (count - 1 - i) * 2;
      CE.drawCardBack(S._ctx, PILE_X + offset, PILE_Y + offset);
    }

    // Count label
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.discardPile.length + ' card(s)', PILE_X + CE.CARD_W / 2, PILE_Y + CE.CARD_H + 6);
  }

  function drawRequiredRank() {
    const rank = V.requiredRank();

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(S._ctx, CANVAS_W / 2 - 60, PILE_Y - 36, 120, 28, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Rank: ' + rank, CANVAS_W / 2, PILE_Y - 22);
    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Your Hand (' + total + ')', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    if (total === 0) {
      S._ctx.fillStyle = 'rgba(255,255,255,0.3)';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('(empty)', CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H / 2);
      return;
    }

    const rank = V.requiredRank();

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      const isSelected = S.selectedIndices.includes(i);
      if (isSelected) y -= 15;
      else if (i === S.hoverCardIdx && S.phase === PHASE_PLAYER_TURN) y -= 8;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Selection highlight
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

      // Hint glow for matching rank
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYER_TURN && !isSelected && hand[i].rank === rank)
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }
  }

  function drawButtons() {
    // Play button (during player turn, with cards selected)
    if (S.phase === PHASE_PLAYER_TURN && S.selectedIndices.length > 0)
      CE.drawButton(S._ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, 'Play (' + S.selectedIndices.length + ')', { bg: '#2a5a2a', border: '#4f4', fontSize: 13 });

    // Cheat! button (during challenge window after AI play, only for human)
    if (S.phase === PHASE_CHALLENGE_WINDOW && S.lastPlayInfo && S.lastPlayInfo.player !== 0)
      CE.drawButton(S._ctx, CHEAT_BTN.x, CHEAT_BTN.y, CHEAT_BTN.w, CHEAT_BTN.h, 'Cheat!', { bg: '#6a1a1a', border: '#f44', fontSize: 16 });
  }

  function drawMessageArea() {
    if (S.message.length === 0 || S.messageTimer <= 0) return;

    const alpha = Math.min(1, S.messageTimer / 0.5);
    S._ctx.save();
    S._ctx.globalAlpha = alpha;

    const textWidth = S._ctx.measureText(S.message).width || 200;
    const pw = Math.max(textWidth + 40, 240);
    const px = CANVAS_W / 2 - pw / 2;
    const py = CANVAS_H / 2 + 108;

    S._ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CE.drawRoundedRect(S._ctx, px, py - 14, pw, 28, 8);
    S._ctx.fill();

    S._ctx.fillStyle = S.messageColor;
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(S.message, CANVAS_W / 2, py);
    S._ctx.restore();
  }

  function drawResolveOverlay() {
    if (S.phase !== PHASE_RESOLVING || S.resolveMessage.length === 0) return;

    S._ctx.save();
    const alpha = Math.min(1, S.resolveTimer / 0.3);
    S._ctx.globalAlpha = alpha;

    const pw = 520;
    const ph = 36;
    const px = CANVAS_W / 2 - pw / 2;
    const py = CANVAS_H / 2 + 40;

    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 8);
    S._ctx.fill();

    S._ctx.fillStyle = S.resolveColor;
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(S.resolveMessage, CANVAS_W / 2, py + ph / 2);
    S._ctx.restore();
  }

  function drawGameOverUI() {
    const px = CANVAS_W / 2 - 150;
    const py = 200;
    const pw = 300;
    const ph = 140;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Game Over', CANVAS_W / 2, py + 14);

    // Find the winner (player with 0 cards)
    let winnerIdx = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (S.hands[p].length === 0) { winnerIdx = p; break; }

    if (winnerIdx === 0) {
      S._ctx.fillStyle = '#4f4';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.fillText('You win!', CANVAS_W / 2, py + 48);

      S._ctx.fillStyle = '#afa';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.fillText('Score: 100', CANVAS_W / 2, py + 76);
    } else {
      S._ctx.fillStyle = '#f66';
      S._ctx.font = 'bold 16px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[winnerIdx >= 0 ? winnerIdx : 1] + ' wins!', CANVAS_W / 2, py + 48);

      S._ctx.fillStyle = '#faa';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.fillText('Score: 0', CANVAS_W / 2, py + 76);
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    S._ctx.restore();
  }

  Object.assign(V, { playerCardX, drawCheat });

})();
