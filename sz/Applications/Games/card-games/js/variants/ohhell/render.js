/* Oh Hell - drawing of the table, hands and overlays. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const T = SZ.CardGames.shared.trickRules;
  const V = SZ.CardGames.v.ohhell;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SUIT_NAMES, NUM_PLAYERS, PLAYER_NAMES,
    TOTAL_ROUNDS, PHASE_BIDDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_OVER, PLAYER_HAND_Y
  } = V;

  const SUIT_SYMBOLS = T.SUIT_SYMBOLS;

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxSpread = 680;
    const spacing = Math.min(52, maxSpread / Math.max(total, 1));
    const totalWidth = (total - 1) * spacing + CE.CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2;
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
    { x: CANVAS_W / 2 - 180, y: 20, dir: 'horizontal', label: 'North' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'East' }
  ];

  /* Bid button layout */
  const BID_BTN_W = 44;
  const BID_BTN_H = 30;
  const BID_AREA_Y = 340;

  function bidBtnRect(bidVal) {
    const maxPerRow = 8;
    const row = Math.floor(bidVal / maxPerRow);
    const col = bidVal % maxPerRow;
    const colsInRow = Math.min(maxPerRow, S.handSize + 1 - row * maxPerRow);
    const totalW = colsInRow * BID_BTN_W + (colsInRow - 1) * 4;
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

  function drawTitle() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Oh Hell', 10, 10);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Round ' + (S.roundIndex + 1) + '/' + TOTAL_ROUNDS + ' \u2014 ' + S.handSize + ' card' + (S.handSize > 1 ? 's' : ''), 10, 28);

    S._ctx.fillText('Dealer: ' + PLAYER_NAMES[S.dealer], 10, 42);
  }

  function drawTrumpIndicator() {
    const tx = CANVAS_W - 100;
    const ty = 146;

    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(S._ctx, tx - 10, ty - 22, CE.CARD_W + 20, CE.CARD_H + 36, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';
    S._ctx.fillText('Trump', tx + CE.CARD_W / 2 - 10, ty - 6);

    if (S.trumpCard)
      CE.drawCardFace(S._ctx, tx - 10, ty, S.trumpCard);
    else {
      S._ctx.fillStyle = '#888';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      S._ctx.fillText('None', tx + CE.CARD_W / 2 - 10, ty + CE.CARD_H / 2);
    }
    S._ctx.restore();
  }

  function drawScorePanel() {
    const px = CANVAS_W - 220;
    const py = 10;
    const pw = 210;
    const ph = 128;

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
    S._ctx.fillText('Scoreboard', px + 8, py + 6);

    /* Header row */
    const lh = 16;
    let y = py + 24;
    S._ctx.font = '10px sans-serif';
    S._ctx.fillStyle = '#888';
    S._ctx.fillText('Player', px + 8, y);
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Bid', px + 120, y);
    S._ctx.fillText('Won', px + 152, y);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Total', px + pw - 8, y);
    y += lh;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const isCurrent = S.currentTurn === p && S.phase === PHASE_PLAYING;
      S._ctx.fillStyle = p === 0 ? '#8f8' : (isCurrent ? '#ff0' : '#ccc');
      S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 8, y);

      S._ctx.textAlign = 'center';
      const bidLabel = S.bidsDone[p] ? '' + S.bids[p] : '?';
      S._ctx.fillText(bidLabel, px + 120, y);

      if (S.phase !== PHASE_BIDDING)
        S._ctx.fillText('' + S.tricksWon[p], px + 152, y);

      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.cumulativeScores[p], px + pw - 8, y);

      /* Highlight if bid met */
      if (S.phase !== PHASE_BIDDING && S.bidsDone[p] && S.tricksWon[p] === S.bids[p]) {
        S._ctx.fillStyle = 'rgba(0,255,0,0.15)';
        S._ctx.fillRect(px + 2, y - 1, pw - 4, lh);
      }

      y += lh;
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
      const yOff = (i === S.hoveredCard && S.phase === PHASE_PLAYING && S.currentTurn === 0) ? -10 : 0;

      CE.drawCardFace(S._ctx, x, PLAYER_HAND_Y + yOff, hand[i]);

      /* Hint glow */
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand))
        CE.drawHintGlow(S._ctx, x, PLAYER_HAND_Y + yOff, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      /* Dim invalid */
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
        const spacing = Math.min(22, 360 / Math.max(count, 1));
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
    S._ctx.fillText('Bidding Phase', CANVAS_W / 2, 200);

    S._ctx.font = '12px sans-serif';
    S._ctx.fillStyle = '#aaa';
    const trumpLabel = S.trumpSuit ? SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit] : 'No Trump';
    S._ctx.fillText(S.handSize + ' card' + (S.handSize > 1 ? 's' : '') + ' \u2014 Trump: ' + trumpLabel, CANVAS_W / 2, 222);

    /* Show completed bids */
    let y = 246;
    S._ctx.font = '13px sans-serif';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (!S.bidsDone[p]) continue;
      S._ctx.fillStyle = p === 0 ? '#8f8' : '#ccc';
      S._ctx.fillText(PLAYER_NAMES[p] + ' bids: ' + S.bids[p], CANVAS_W / 2, y);
      y += 18;
    }

    /* Show total bids so far */
    S._ctx.fillStyle = '#888';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Total bids so far: ' + S.totalBidsSoFar + ' / ' + S.handSize + ' tricks', CANVAS_W / 2, y + 4);

    /* Player bid buttons or AI thinking */
    if (S.biddingPlayer === 0 && !S.bidsDone[0]) {
      const forbidden = V.forbiddenBid();

      S._ctx.fillStyle = '#ff0';
      S._ctx.font = '14px sans-serif';
      S._ctx.fillText('Choose your bid:', CANVAS_W / 2, BID_AREA_Y - 18);

      if (forbidden >= 0) {
        S._ctx.fillStyle = '#f88';
        S._ctx.font = '11px sans-serif';
        S._ctx.fillText('(Hook rule: cannot bid ' + forbidden + ')', CANVAS_W / 2, BID_AREA_Y - 4);
      }

      for (let b = 0; b <= S.handSize; ++b) {
        const r = bidBtnRect(b);
        const isForbidden = b === forbidden;
        const bg = isForbidden ? '#444' : (S.hoveredBid === b ? '#4a7a4a' : '#2a5a2a');
        const border = isForbidden ? '#666' : (S.hoveredBid === b ? '#8c8' : '#6c6');
        const textColor = isForbidden ? '#888' : '#fff';
        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, '' + b, { bg, border, textColor, fontSize: 13 });
      }
    } else if (!S.bidsDone[S.biddingPlayer]) {
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
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/' + S.handSize, 10, CANVAS_H - 16);
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const pw = 340;
    const lineH = 22;
    const ph = 90 + NUM_PLAYERS * lineH + (S.gameOver ? 40 : 20);
    const px = CANVAS_W / 2 - pw / 2;
    const py = 140;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText(S.gameOver ? 'Game Over' : 'Round ' + S.roundIndex + ' Complete', CANVAS_W / 2, py + 12);

    /* Per-player results */
    S._ctx.font = '12px sans-serif';
    let y = py + 42;

    /* Header */
    S._ctx.fillStyle = '#888';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Player', px + 16, y);
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Bid', px + 160, y);
    S._ctx.fillText('Won', px + 210, y);
    S._ctx.fillText('Pts', px + 260, y);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Total', px + pw - 16, y);
    y += lineH;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const made = S.tricksWon[p] === S.bids[p];
      const roundPts = made ? 10 + S.bids[p] : 0;
      S._ctx.fillStyle = made ? '#4f4' : '#f88';
      S._ctx.textAlign = 'left';
      S._ctx.fillText(PLAYER_NAMES[p], px + 16, y);
      S._ctx.textAlign = 'center';
      S._ctx.fillText('' + S.bids[p], px + 160, y);
      S._ctx.fillText('' + S.tricksWon[p], px + 210, y);
      S._ctx.fillText(made ? '+' + roundPts : '0', px + 260, y);
      S._ctx.textAlign = 'right';
      S._ctx.fillText('' + S.cumulativeScores[p], px + pw - 16, y);
      y += lineH;
    }

    if (S.gameOver) {
      let best = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (S.cumulativeScores[p] > S.cumulativeScores[best]) best = p;
      const won = best === 0;
      S._ctx.fillStyle = won ? '#4f4' : '#f88';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(won ? 'You win!' : PLAYER_NAMES[best] + ' wins!', CANVAS_W / 2, y + 4);
      y += 22;
    }

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText(S.gameOver ? 'Click to start a new game' : 'Click to continue', CANVAS_W / 2, y + 4);

    S._ctx.restore();
  }

  function drawAll() {
    drawTitle();
    drawScorePanel();
    drawTrumpIndicator();
    drawAIHands();

    if (S.phase === PHASE_BIDDING) {
      drawBiddingUI();
      drawPlayerHand();
    } else if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (S.phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  Object.assign(V, {
    playerCardX, bidBtnRect, drawAll
  });

})();
