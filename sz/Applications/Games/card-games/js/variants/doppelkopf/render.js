/* Doppelkopf - drawing of the table, hands, trick and summaries. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.doppelkopf;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, HAND_SIZE, ROUNDS_PER_MATCH,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER, PLAYER_NAMES
  } = V;

  const SMALL_W = CE.CARD_W * 0.55;
  const SMALL_H = CE.CARD_H * 0.55;

  /* ================================================================
     LAYOUT
     ================================================================ */

  function playerCardX(idx, total) {
    const fanWidth = Math.min(600, Math.max(0, total - 1) * 52);
    const startX = (CANVAS_W - fanWidth - CE.CARD_W) / 2;
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 18;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 300 },
    { x: CANVAS_W / 2 - CE.CARD_W - 55, y: 240 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 180 },
    { x: CANVAS_W / 2 + 55, y: 240 }
  ];

  const AI_HANDS = [
    null,
    { x: 14, y: 175, dir: 'vertical' },
    { x: 310, y: 62, dir: 'horizontal' },
    { x: CANVAS_W - 14 - SMALL_W, y: 175, dir: 'vertical' }
  ];

  function seatLabel(p) {
    const party = V.partyLabel(0, p);
    return PLAYER_NAMES[p] + (party ? ' — ' + party : '') + (p === S.dealer ? ' (dealer)' : '');
  }

  function partyColor(p) {
    const party = V.partyLabel(0, p);
    if (!party)
      return '#ccc';
    return party.indexOf('Re') === 0 ? '#ffb74d' : '#81d4fa';
  }

  /* ================================================================
     PANELS
     ================================================================ */

  function text(str, x, y, font, color, align) {
    const ctx = S._ctx;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
  }

  function drawScorePanel() {
    const ctx = S._ctx;
    const px = 10;
    const py = 10;
    const pw = 200;
    const ph = 128;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(ctx, px, py, pw, ph, 6);
    ctx.fill();
    text('Doppelkopf', px + 10, py + 8, 'bold 13px sans-serif', '#fff');
    text('Round ' + Math.min(S.roundNumber + (S.phase === PHASE_ROUND_OVER ? 0 : 1), ROUNDS_PER_MATCH) + '/' + ROUNDS_PER_MATCH, px + pw - 10, py + 9, '11px sans-serif', '#aaa', 'right');
    text('Player', px + 10, py + 30, '10px sans-serif', '#999');
    text('Tricks', px + 120, py + 30, '10px sans-serif', '#999', 'right');
    text('Total', px + pw - 10, py + 30, '10px sans-serif', '#999', 'right');
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const y = py + 46 + p * 18;
      const col = p === 0 ? '#8f8' : '#ddd';
      text(PLAYER_NAMES[p], px + 10, y, '11px sans-serif', col);
      text(String(S.tricksWon[p]), px + 120, y, '11px sans-serif', col, 'right');
      text(String(S.cumulativeScores[p]), px + pw - 10, y, '11px sans-serif', col, 'right');
    }
    ctx.restore();
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = S.hands[p];
      const pos = AI_HANDS[p];
      const active = S.phase === PHASE_PLAYING && S.currentTurn === p;
      const font = active ? 'bold 12px sans-serif' : '12px sans-serif';
      const color = active ? '#ff0' : partyColor(p);
      if (pos.dir === 'vertical') {
        const align = p === 1 ? 'left' : 'right';
        const lx = p === 1 ? pos.x : pos.x + SMALL_W;
        text(seatLabel(p), lx, pos.y - 18, font, color, align);
        for (let i = 0; i < hand.length; ++i)
          CE.drawCardBack(S._ctx, pos.x, pos.y + i * 16, SMALL_W, SMALL_H);
      } else {
        text(seatLabel(p), pos.x, pos.y - 18, font, color);
        for (let i = 0; i < hand.length; ++i)
          CE.drawCardBack(S._ctx, pos.x + i * 22, pos.y, SMALL_W, SMALL_H);
      }
    }
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    const myTurn = S.phase === PHASE_PLAYING && S.currentTurn === 0;
    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing)
        continue;
      const x = playerCardX(i, total);
      let y = playerCardY();
      if (myTurn && i === S.hoverCardIdx)
        y -= 12;
      CE.drawCardFace(S._ctx, x, y, hand[i]);
      if (myTurn && S._host && S._host.hintsEnabled && V.isValidPlay(hand[i], hand, S.trickCards))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);
    }
    const label = seatLabel(0);
    text(label, 14, CANVAS_H - 18, (myTurn ? 'bold ' : '') + '12px sans-serif', myTurn ? '#ff0' : partyColor(0));
  }

  function drawTrick() {
    const ctx = S._ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    CE.drawRoundedRect(ctx, CANVAS_W / 2 - 150, 172, 300, 248, 12);
    ctx.stroke();
    ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const pos = TRICK_POSITIONS[S.trickPlayers[i]];
      CE.drawCardFace(ctx, pos.x, pos.y, S.trickCards[i]);
    }

    if (S.phase === PHASE_TRICK_DONE && S.trickWinnerIdx >= 0) {
      const w = S.trickWinnerIdx;
      const pts = V.sumPoints(S.trickCards);
      const who = w === 0 ? 'You take' : PLAYER_NAMES[w] + ' takes';
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      CE.drawRoundedRect(ctx, CANVAS_W / 2 - 170, 424, 340, 38, 8);
      ctx.fill();
      text(who + ' the trick (' + pts + ' points)', CANVAS_W / 2, 428, 'bold 13px sans-serif', '#ff0', 'center');
      text('Click to continue', CANVAS_W / 2, 446, '11px sans-serif', '#8f8', 'center');
      ctx.restore();
    }
  }

  function drawStatusLine() {
    text(V.TRUMP_HINT, CANVAS_W / 2, 152, '11px sans-serif', 'rgba(255,255,255,0.7)', 'center');
    text('Trick ' + Math.min(S.tricks.length + 1, HAND_SIZE) + '/' + HAND_SIZE, CANVAS_W - 14, CANVAS_H - 18, '11px sans-serif', '#aaa', 'right');
    if (S.phase === PHASE_PLAYING && S.currentTurn === 0)
      text('Your turn — click a card (keys 1-9, 0, -, =)', CANVAS_W / 2, 428, '12px sans-serif', '#8f8', 'center');
  }

  function drawRoundSummary() {
    const r = S.result;
    if (!r)
      return;
    const ctx = S._ctx;
    const pw = 440;
    const ph = 360;
    const px = (CANVAS_W - pw) / 2;
    const py = 110;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    CE.drawRoundedRect(ctx, px, py, pw, ph, 10);
    ctx.fill();

    const title = S.gameOver ? 'Match over' : 'Round ' + S.roundNumber + ' of ' + ROUNDS_PER_MATCH;
    text(title, CANVAS_W / 2, py + 12, 'bold 17px sans-serif', '#fff', 'center');

    const reNames = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (S.re[p])
        reNames.push(PLAYER_NAMES[p]);
    const reTitle = r.isSolo ? 'Re (silent solo: ' + reNames.join(', ') + ')' : 'Re (' + reNames.join(' & ') + ')';
    text(reTitle, px + 20, py + 42, '12px sans-serif', '#ffb74d');
    text(r.rePoints + ' pts', px + pw - 20, py + 42, '12px sans-serif', '#ffb74d', 'right');
    text('Kontra', px + 20, py + 60, '12px sans-serif', '#81d4fa');
    text(r.kontraPoints + ' pts', px + pw - 20, py + 60, '12px sans-serif', '#81d4fa', 'right');
    text((r.reWins ? 'Re' : 'Kontra') + ' wins', CANVAS_W / 2, py + 82, 'bold 13px sans-serif', '#ff0', 'center');

    let y = py + 104;
    for (let i = 0; i < r.lines.length && i < 9; ++i) {
      const ln = r.lines[i];
      const col = ln.party === 're' ? '#ffb74d' : '#81d4fa';
      text(ln.label + ' (' + (ln.party === 're' ? 'Re' : 'Kontra') + ')', px + 30, y, '11px sans-serif', col);
      text('+' + ln.value, px + pw - 30, y, '11px sans-serif', col, 'right');
      y += 15;
    }
    text('Game value: ' + r.value + (r.isSolo ? ' (soloist x3)' : ''), CANVAS_W / 2, py + 244, 'bold 12px sans-serif', '#fff', 'center');

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const x = px + 20 + p * 102;
      const v = r.playerScores[p];
      text(PLAYER_NAMES[p], x + 40, py + 266, '11px sans-serif', p === 0 ? '#8f8' : '#ccc', 'center');
      text((v > 0 ? '+' : '') + v, x + 40, py + 282, 'bold 12px sans-serif', v > 0 ? '#8f8' : v < 0 ? '#f88' : '#ccc', 'center');
      text('= ' + S.cumulativeScores[p], x + 40, py + 298, '11px sans-serif', '#aaa', 'center');
    }

    let foot = 'Click to continue';
    if (S.gameOver) {
      let best = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (S.cumulativeScores[p] > S.cumulativeScores[best])
          best = p;
      foot = (best === 0 ? 'You win the match!' : PLAYER_NAMES[best] + ' wins the match') + ' — click to continue';
    }
    text(foot, CANVAS_W / 2, py + ph - 26, 'bold 12px sans-serif', '#8f8', 'center');
    ctx.restore();
  }

  function drawDoppelkopf() {
    drawScorePanel();
    drawStatusLine();
    drawAIHands();
    drawTrick();
    drawPlayerHand();
    if (S.phase === PHASE_ROUND_OVER)
      drawRoundSummary();
  }

  Object.assign(V, { playerCardX, playerCardY, drawDoppelkopf });

})();
