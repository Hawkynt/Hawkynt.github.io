/* Spades - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spades;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, PLAYER_NAMES, TEAM_NS, TEAM_EW, PHASE_BIDDING,
    PHASE_PLAYING, PHASE_ROUND_OVER, PLAYER_HAND_Y
  } = V;

  const lightenColor = SZ.CardGames.shared.trickPaint.lightenColor;

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxSpread = CANVAS_W - 200;
    const spacing = Math.min(52, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + idx * spacing;
  }

  /* Trick card positions: center of canvas, arranged by seat */
  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },         // South (player)
    { x: CANVAS_W / 2 - CE.CARD_W - 40, y: 260 },         // West
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 210 },          // North (partner)
    { x: CANVAS_W / 2 + 40, y: 260 }                       // East
  ];

  /* AI hand display positions */
  const AI_POS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'Partner (N)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* Bid button layout */
  const BID_BTN_W = 44;
  const BID_BTN_H = 30;
  const BID_AREA_Y = 320;

  function bidBtnRect(bidVal) {
    let row, col;
    if (bidVal <= 6) {
      row = 0;
      col = bidVal;
    } else {
      row = 1;
      col = bidVal - 7;
    }
    const totalCols = 7;
    const totalW = totalCols * BID_BTN_W + (totalCols - 1) * 4;
    const startX = (CANVAS_W - totalW) / 2;
    return {
      x: startX + col * (BID_BTN_W + 4),
      y: BID_AREA_Y + row * (BID_BTN_H + 4),
      w: BID_BTN_W,
      h: BID_BTN_H
    };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 220;
    const py = 10;
    const pw = 210;
    const ph = 140;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 13px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Scoreboard', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    const lh = 15;
    let y = py + 28;

    // Team headers
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('NS (You + Partner)', px + 10, y);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('EW (West + East)', px + 110, y);
    y += lh + 2;

    // Scores
    S._ctx.fillStyle = '#fff';
    S._ctx.fillText('Score: ' + S.teamScores[TEAM_NS], px + 10, y);
    S._ctx.fillText('Score: ' + S.teamScores[TEAM_EW], px + 110, y);
    y += lh;

    S._ctx.fillText('Bags: ' + S.teamBags[TEAM_NS], px + 10, y);
    S._ctx.fillText('Bags: ' + S.teamBags[TEAM_EW], px + 110, y);
    y += lh + 2;

    // Current round bids and tricks
    if (S.phase !== PHASE_BIDDING || S.bidsDone.some(b => b)) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.fillText('Bids:', px + 10, y);
      let bx = px + 50;
      for (let p = 0; p < 4; ++p) {
        const label = PLAYER_NAMES[p][0] + ':' + (S.bidsDone[p] ? (S.bids[p] === 0 ? 'Nil' : S.bids[p]) : '?');
        S._ctx.fillStyle = V.teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
        S._ctx.fillText(label, bx, y);
        bx += 40;
      }
      y += lh;

      if (S.phase !== PHASE_BIDDING) {
        S._ctx.fillStyle = '#aaa';
        S._ctx.fillText('Won:', px + 10, y);
        bx = px + 50;
        for (let p = 0; p < 4; ++p) {
          S._ctx.fillStyle = V.teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
          S._ctx.fillText(PLAYER_NAMES[p][0] + ':' + S.tricksWon[p], bx, y);
          bx += 40;
        }
      }
    }

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Your Hand', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const yOff = (i === S.hoveredCard && S.phase === PHASE_PLAYING && S.currentTurn === 0) ? -10 : 0;

      // Highlight valid cards on player's turn
      if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand)) {
        S._ctx.save();
        S._ctx.shadowColor = '#4f4';
        S._ctx.shadowBlur = 8;
        CE.drawCardFace(S._ctx, x, PLAYER_HAND_Y + yOff, hand[i]);
        S._ctx.restore();
      } else
        CE.drawCardFace(S._ctx, x, PLAYER_HAND_Y + yOff, hand[i]);

      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand))
        CE.drawHintGlow(S._ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Dim invalid cards
      if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && !V.isValidPlay(hand[i], hand)) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(S._ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.fill();
        S._ctx.restore();
      }
    }
  }

  function drawAIHands() {
    for (let p = 1; p < 4; ++p) {
      const pos = AI_POS[p];
      const count = S.hands[p].length;

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.textBaseline = 'top';

      if (pos.dir === 'horizontal') {
        S._ctx.textAlign = 'center';
        S._ctx.fillText(pos.label + ' (' + count + ')', CANVAS_W / 2, pos.y - 2);
        const spacing = Math.min(22, 360 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(S._ctx, startX + i * spacing, pos.y + 10, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        // Vertical layout for West and East
        const spacing = Math.min(18, 250 / Math.max(count, 1));
        const totalH = (count - 1) * spacing + CE.CARD_H * 0.45;
        const startY = pos.y + 20;

        S._ctx.save();
        S._ctx.translate(pos.x + (p === 1 ? 20 : 0), pos.y);
        S._ctx.fillStyle = '#aaa';
        S._ctx.font = '11px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.textBaseline = 'bottom';
        S._ctx.fillText(pos.label + ' (' + count + ')', CE.CARD_W * 0.25, -2);
        S._ctx.restore();

        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(S._ctx, cx, startY + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    // Draw a subtle center area
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    // Draw played cards at their seat positions
    for (let i = 0; i < S.trickCards.length; ++i) {
      const player = S.trickPlayers[i];
      const pos = TRICK_POS[player];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);

      // Player label under/over card
      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      const labelY = player === 2 ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      S._ctx.fillText(PLAYER_NAMES[player], pos.x + CE.CARD_W / 2, labelY);
    }

    // Trick winner display
    if (S.trickWinnerDisplay) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText(S.trickWinnerDisplay, CANVAS_W / 2, 195);
    }
  }

  function drawBiddingUI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Bidding Phase', CANVAS_W / 2, 220);

    // Show who has bid
    let y = 248;
    S._ctx.font = '13px sans-serif';
    for (let p = 0; p < 4; ++p) {
      if (S.bidsDone[p]) {
        const bidText = S.bids[p] === 0 ? 'Nil' : '' + S.bids[p];
        S._ctx.fillStyle = V.teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
        S._ctx.fillText(PLAYER_NAMES[p] + ' bids: ' + bidText, CANVAS_W / 2, y);
        y += 18;
      }
    }

    // Waiting for AI or show buttons for player
    if (S.biddingPlayer === 0 && !S.bidsDone[0]) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Choose your bid (0 = Nil):', CANVAS_W / 2, BID_AREA_Y - 16);

      for (let b = 0; b <= 13; ++b) {
        const r = bidBtnRect(b);
        const label = b === 0 ? 'Nil' : '' + b;
        const color = b === 0 ? '#a44' : '#4a4';
        const bg = S.hoveredBid === b ? lightenColor(color) : color;
        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, label, { bg: bg, border: lightenColor(color, 40), textColor: '#fff', fontSize: 12 });
      }
    } else if (!S.bidsDone[S.biddingPlayer]) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is thinking...', CANVAS_W / 2, BID_AREA_Y + 10);
    }
  }

  function drawRoundOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.7)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';

    if (S.gameOver) {
      const nsWin = S.teamScores[TEAM_NS] >= 500;
      const ewLose = S.teamScores[TEAM_EW] <= -200;
      const won = nsWin || ewLose;
      S._ctx.fillStyle = won ? '#4f4' : '#f44';
      S._ctx.fillText(won ? 'You Win the Game!' : 'Game Over - You Lose!', CANVAS_W / 2, 200);
      S._ctx.fillStyle = '#fff';
      S._ctx.font = '16px sans-serif';
      S._ctx.fillText('NS: ' + S.teamScores[TEAM_NS] + '  |  EW: ' + S.teamScores[TEAM_EW], CANVAS_W / 2, 240);
      S._ctx.font = '14px sans-serif';
      S._ctx.fillStyle = '#aaa';
      S._ctx.fillText('Click to start a new game', CANVAS_W / 2, 280);
    } else {
      S._ctx.fillText('Round Complete', CANVAS_W / 2, 180);

      S._ctx.font = '14px sans-serif';
      let y = 220;

      for (let p = 0; p < 4; ++p) {
        const bidLabel = S.bids[p] === 0 ? 'Nil' : '' + S.bids[p];
        S._ctx.fillStyle = V.teamOf(p) === TEAM_NS ? '#8cf' : '#f88';
        S._ctx.fillText(PLAYER_NAMES[p] + ': bid ' + bidLabel + ', won ' + S.tricksWon[p], CANVAS_W / 2, y);
        y += 20;
      }

      y += 10;
      S._ctx.fillStyle = '#8cf';
      S._ctx.fillText('NS Score: ' + S.teamScores[TEAM_NS] + ' (Bags: ' + S.teamBags[TEAM_NS] + ')', CANVAS_W / 2, y);
      y += 20;
      S._ctx.fillStyle = '#f88';
      S._ctx.fillText('EW Score: ' + S.teamScores[TEAM_EW] + ' (Bags: ' + S.teamBags[TEAM_EW] + ')', CANVAS_W / 2, y);
      y += 30;

      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Click to deal next round', CANVAS_W / 2, y);
    }
    S._ctx.restore();
  }

  function drawStatusBar() {
    if (!S.statusMessage) return;
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText(S.statusMessage, CANVAS_W / 2, CANVAS_H - 8);
  }

  function drawSpadesBrokenIndicator() {
    S._ctx.fillStyle = S.spadesBroken ? '#8f8' : '#888';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('\u2660 ' + (S.spadesBroken ? 'Broken' : 'Not broken'), 15, CANVAS_H - 20);
  }

  function drawAll() {
    drawScorePanel();
    drawAIHands();
    drawTrickArea();
    drawPlayerHand();
    drawSpadesBrokenIndicator();

    if (S.phase === PHASE_BIDDING)
      drawBiddingUI();
    else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
    else {
      if (S.currentTurn === 0 && S.trickCards.length < 4 && !S.roundOver)
        S.statusMessage = 'Your turn \u2014 click a card to play';
      else if (S.currentTurn !== 0 && !S.roundOver)
        S.statusMessage = PLAYER_NAMES[S.currentTurn] + ' is thinking...';
      else
        S.statusMessage = '';
      drawStatusBar();
    }
  }

  Object.assign(V, {
    playerCardX, bidBtnRect, drawAll
  });

})();
