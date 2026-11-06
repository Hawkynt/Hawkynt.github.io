/* Hearts - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.hearts;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, PHASE_PASSING, PHASE_PLAYING,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER, PLAYER_NAMES, PASS_BTN
  } = V;

  const PASS_NAMES = ['Left', 'Right', 'Across', 'None'];

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

  function playerCardY(idx) {
    return CANVAS_H - CE.CARD_H - 20;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },
    { x: CANVAS_W / 2 + 50, y: 250 }
  ];

  const AI_HAND_POSITIONS = [
    null,
    { x: 10, y: 160, dir: 'vertical' },
    { x: 250, y: 10, dir: 'horizontal' },
    { x: CANVAS_W - 10 - CE.CARD_W * 0.55, y: 160, dir: 'vertical' }
  ];

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 170;
    const py = 10;
    const pw = 160;
    const ph = 110;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scores', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 28 + p * 18;
      const name = PLAYER_NAMES[p];
      const cumul = S.cumulativeScores[p];
      const rd = S.roundScores[p];
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(name, px + 10, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText(cumul + (S.phase !== PHASE_PASSING && rd > 0 ? ' (+' + rd + ')' : ''), px + pw - 10, y);
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
      let y = playerCardY(i);

      const isSelected = S.selectedForPass.indexOf(i) >= 0;
      if (isSelected) y -= 20;

      if (S.phase === PHASE_PLAYING && i === S.hoverCardIdx && S.currentTurn === 0)
        y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0) {
        const isFirstTrick = S.trickCount === 0;
        const isLeading = S.trickCards.length === 0;
        const leadSuit = isLeading ? null : S.trickCards[0].suit;
        if (V.isValidPlay(hand[i], hand, leadSuit, isFirstTrick, isLeading))
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
      }

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
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = S.hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrentTurn = S.currentTurn === p && S.phase === PHASE_PLAYING;

      S._ctx.fillStyle = isCurrentTurn ? '#ff0' : '#aaa';
      S._ctx.font = isCurrentTurn ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 10;
        S._ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', labelX, pos.y - 16);
        for (let i = 0; i < count; ++i) {
          const cy = pos.y + i * 16;
          CE.drawCardBack(S._ctx, pos.x, cy, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      } else {
        S._ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 2);
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + i * 22;
          CE.drawCardBack(S._ctx, cx, pos.y + 14, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
      }
    }
  }

  function drawTrickArea() {
    S._ctx.save();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    S._ctx.lineWidth = 2;
    CE.drawRoundedRect(S._ctx, CANVAS_W / 2 - 100, 180, 200, 200, 10);
    S._ctx.stroke();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const playerIdx = S.trickPlayers[i];
      const pos = TRICK_POSITIONS[playerIdx];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);
    }

    if (S.phase === PHASE_TRICK_DONE && S.trickWinnerIdx >= 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      const who = S.trickWinnerIdx === 0 ? 'You take' : PLAYER_NAMES[S.trickWinnerIdx] + ' takes';
      S._ctx.fillText(who + ' the trick', CANVAS_W / 2, 170);
    }
  }

  function drawPassingUI() {
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Select 3 cards to pass ' + PASS_NAMES[S.passDirection], CANVAS_W / 2, 260);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('(' + S.selectedForPass.length + '/3 selected)', CANVAS_W / 2, 282);

    if (S.selectedForPass.length === 3)
      CE.drawButton(S._ctx, PASS_BTN.x, PASS_BTN.y, PASS_BTN.w, PASS_BTN.h, 'Pass Cards', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });
  }

  function drawPlayingUI() {
    if (S.currentTurn === 0 && S.trickCards.length < NUM_PLAYERS && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    if (S.heartsBroken) {
      S._ctx.fillStyle = '#f66';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';
      S._ctx.fillText('\u2665 broken', 10, CANVAS_H - 16);
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/13', 10, CANVAS_H - 30);
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 140;
    const py = 140;
    const pw = 280;
    const ph = 200;

    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round ' + S.roundNumber + ' Results', CANVAS_W / 2, py + 12);

    S._ctx.font = '12px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 42 + p * 24;
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 20, y);
      S._ctx.textAlign = 'center';
      S._ctx.fillText('+' + S.roundScores[p], px + pw / 2, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('Total: ' + S.cumulativeScores[p], px + pw - 20, y);
    }

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 20);
    S._ctx.restore();
  }

  function drawHearts() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Hearts', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Round ' + (S.roundNumber + 1) + ' \u2014 Pass: ' + PASS_NAMES[S.passDirection], 10, 28);

    drawScorePanel();
    drawAIHands();
    drawTrickArea();
    drawPlayerHand();

    if (S.phase === PHASE_PASSING)
      drawPassingUI();
    else if (S.phase === PHASE_PLAYING)
      drawPlayingUI();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  Object.assign(V, {
    playerCardX, playerCardY, drawHearts
  });

})();
