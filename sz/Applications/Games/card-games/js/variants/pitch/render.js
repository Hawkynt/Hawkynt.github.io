/* Pitch - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pitch;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, NUM_PLAYERS, HAND_SIZE,
    WIN_SCORE, PLAYER_NAMES, PHASE_BIDDING, PHASE_PLAYING,
    PHASE_TRICK_DONE, PHASE_ROUND_SCORE, PHASE_GAME_OVER, PLAYER_HAND_Y
  } = V;

  /* ================================================================
     DRAWING - LAYOUT
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 500;
    const fanWidth = Math.min(maxWidth, total * 60);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },
    { x: CANVAS_W / 2 + 50, y: 250 }
  ];

  const AI_HAND_POSITIONS = [
    null,
    { x: 20, y: 160, dir: 'vertical', label: 'West' },
    { x: CANVAS_W / 2 - 120, y: 10, dir: 'horizontal', label: 'North' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* -- Bidding button positions -- */
  const BID_BTN_W = 60;
  const BID_BTN_H = 32;
  const BID_BTN_GAP = 10;
  const BID_AREA_Y = 340;

  function bidBtnRect(bidVal) {
    // Buttons: 1, 2, 3, 4, Pass (5 total)
    const labels = 5;
    const totalW = labels * BID_BTN_W + (labels - 1) * BID_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    return {
      x: startX + bidVal * (BID_BTN_W + BID_BTN_GAP),
      y: BID_AREA_Y,
      w: BID_BTN_W,
      h: BID_BTN_H
    };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 130;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.55)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 6);
    S._ctx.fill();
    S._ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    S._ctx.lineWidth = 1;
    S._ctx.stroke();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 12px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pitch (All Fours)', px + 10, py + 8);
    S._ctx.font = '10px sans-serif';
    S._ctx.fillStyle = '#aaa';
    S._ctx.fillText('First to ' + WIN_SCORE, px + 130, py + 8);

    S._ctx.font = '11px sans-serif';
    const lh = 15;
    let y = py + 28;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S._ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 10, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.playerScores[p], px + pw - 10, y);
      y += lh;
    }

    // Trump indicator
    if (S.trumpSuit) {
      y += 4;
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('Trump: ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], px + 10, y);
    }

    // Dealer indicator
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Dealer: ' + PLAYER_NAMES[S.dealer], px + 10, py + ph - 14);

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Your Hand', CANVAS_W / 2, PLAYER_HAND_Y - 4);

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      const isHover = i === S.hoveredCard && S.phase === PHASE_PLAYING && S.currentTurn === 0;
      const yOff = isHover ? -10 : 0;

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
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = S.hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrent = S.currentTurn === p && S.phase === PHASE_PLAYING;

      S._ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';

      const label = pos.label + ' (' + count + ')';

      if (pos.dir === 'horizontal') {
        S._ctx.fillText(label, CANVAS_W / 2, pos.y);
        const spacing = Math.min(22, 240 / Math.max(count, 1));
        const totalW = (count - 1) * spacing + CE.CARD_W * 0.5;
        const startX = CANVAS_W / 2 - totalW / 2;
        for (let i = 0; i < count; ++i)
          CE.drawCardBack(S._ctx, startX + i * spacing, pos.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
      } else {
        const lx = p === 1 ? pos.x + 20 : pos.x;
        S._ctx.fillText(label, lx + CE.CARD_W * 0.25, pos.y - 2);
        const spacing = Math.min(18, 200 / Math.max(count, 1));
        for (let i = 0; i < count; ++i) {
          const cx = pos.x + (p === 1 ? 5 : -CE.CARD_W * 0.5 + 5);
          CE.drawCardBack(S._ctx, cx, pos.y + 14 + i * spacing, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
        }
      }
    }
  }

  function drawTrickArea() {
    // Subtle center
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(CANVAS_W / 2, 280, 90, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const playerIdx = S.trickPlayers[i];
      const pos = TRICK_POSITIONS[playerIdx];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);

      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      const labelY = playerIdx === 2 ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      S._ctx.fillText(PLAYER_NAMES[playerIdx], pos.x + CE.CARD_W / 2, labelY);
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

  function drawBiddingUI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 18px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Bidding Phase', CANVAS_W / 2, 220);

    // Show who has bid
    let y = 250;
    S._ctx.font = '13px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!S.playerBidDone[p]) continue;
      const bidText = S.playerBids[p] === 0 ? 'Pass' : '' + S.playerBids[p];
      S._ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      S._ctx.fillText(PLAYER_NAMES[p] + ': ' + bidText, CANVAS_W / 2, y);
      y += 18;
    }

    // Current highest bid
    if (S.bidAmount > 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('Current high: ' + PLAYER_NAMES[S.bidder] + ' at ' + S.bidAmount, CANVAS_W / 2, BID_AREA_Y - 30);
    }

    // Buttons for human
    if (S.biddingPlayer === 0 && !S.playerBidDone[0]) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Your bid (min ' + (S.bidAmount + 1) + ', or pass):', CANVAS_W / 2, BID_AREA_Y - 14);

      const bidLabels = ['1', '2', '3', '4', 'Pass'];
      for (let i = 0; i < 5; ++i) {
        const r = bidBtnRect(i);
        const bidVal = i < 4 ? i + 1 : 0;
        const enabled = bidVal === 0 || bidVal > S.bidAmount || (bidVal >= 1 && S.bidAmount === 0);
        const isPass = bidVal === 0;

        let bg, border;
        if (!enabled && !isPass) {
          bg = '#333';
          border = '#555';
        } else if (isPass) {
          bg = S.hoveredBtn === 'pass' ? '#6a3a3a' : '#5a2a2a';
          border = '#c66';
        } else {
          bg = S.hoveredBtn === ('bid' + bidVal) ? '#3a6a3a' : '#2a5a2a';
          border = '#6c6';
        }

        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, bidLabels[i], { bg, border, textColor: enabled || isPass ? '#fff' : '#666', fontSize: 13 });
      }
    } else if (!S.playerBidDone[S.biddingPlayer]) {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is thinking...', CANVAS_W / 2, BID_AREA_Y + 10);
    }
  }

  function drawPlayingUI() {
    if (S.currentTurn === 0 && S.trickCards.length < NUM_PLAYERS && !S.roundOver) {
      S._ctx.fillStyle = '#8f8';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 8);
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/' + HAND_SIZE, 10, CANVAS_H - 16);
  }

  function drawRoundScoreUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 120;
    const pw = 360;
    const lineCount = S.roundMessages.length;
    const ph = 160 + lineCount * 16;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Round Complete', CANVAS_W / 2, py + 14);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText(PLAYER_NAMES[S.bidder] + ' bid ' + S.bidAmount + ' \u2014 Trump: ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], CANVAS_W / 2, py + 38);

    S._ctx.font = '12px sans-serif';
    let y = py + 62;
    for (const msg of S.roundMessages) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.fillText(msg, CANVAS_W / 2, y);
      y += 16;
    }

    y += 8;
    S._ctx.font = '11px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S._ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      S._ctx.fillText(PLAYER_NAMES[p] + ': ' + S.playerScores[p], CANVAS_W / 2, y);
      y += 14;
    }

    y += 6;
    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, y);
    S._ctx.restore();
  }

  function drawGameOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = S.playerScores[0] >= WIN_SCORE;
    let winnerName = 'You';
    if (!won) {
      let best = -Infinity;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (S.playerScores[p] > best) {
          best = S.playerScores[p];
          winnerName = PLAYER_NAMES[p];
        }
      }
    }

    S._ctx.fillStyle = won ? '#4f4' : '#f44';
    S._ctx.font = 'bold 24px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(won ? 'You Win!' : winnerName + ' Wins!', CANVAS_W / 2, 220);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    let y = 260;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S._ctx.fillStyle = p === 0 ? '#8cf' : '#ccc';
      S._ctx.fillText(PLAYER_NAMES[p] + ': ' + S.playerScores[p], CANVAS_W / 2, y);
      y += 20;
    }

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '14px sans-serif';
    S._ctx.fillText('Click to start a new game', CANVAS_W / 2, y + 20);
    S._ctx.restore();
  }

  function drawAll() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Pitch', 10, 10);

    drawScorePanel();
    drawAIHands();

    if (S.phase === PHASE_BIDDING) {
      drawBiddingUI();
      drawPlayerHand();
    } else if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (S.phase === PHASE_ROUND_SCORE) {
      drawRoundScoreUI();
    } else if (S.phase === PHASE_GAME_OVER) {
      drawGameOverUI();
    }
  }

  Object.assign(V, {
    playerCardX, bidBtnRect, drawAll
  });

})();
