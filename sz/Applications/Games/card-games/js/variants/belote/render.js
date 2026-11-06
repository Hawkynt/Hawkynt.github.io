/* Belote: drawing of the table, hands, scores and buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.belote;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, NUM_PLAYERS, TRICKS_PER_ROUND, WIN_SCORE,
    PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_BID_ROUND1, PHASE_BID_ROUND2, PHASE_DEAL_REMAINING,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER, PHASE_GAME_OVER, PLAYER_HAND_Y } = V;

  function playerCardX(idx, total) {
    const maxWidth = 520;
    const fanWidth = Math.min(maxWidth, total * 60);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2 - 40;
    return startX + idx * spacing;
  }

  const TRICK_POSITIONS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 310 },       // bottom (player)
    { x: CANVAS_W / 2 - CE.CARD_W - 50, y: 250 },       // left (AI-1)
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 190 },        // top (partner)
    { x: CANVAS_W / 2 + 50, y: 250 }                     // right (AI-3)
  ];

  const AI_HAND_POSITIONS = [
    null, // player 0
    { x: 20, y: 160, dir: 'vertical', label: 'AI-1 (L)' },
    { x: CANVAS_W / 2 - 120, y: 10, dir: 'horizontal', label: 'Partner (T)' },
    { x: CANVAS_W - 70, y: 160, dir: 'vertical', label: 'AI-3 (R)' }
  ];

  /* ── Button positions ── */
  const BTN_W = 100;
  const BTN_H = 30;
  const BTN_GAP = 12;
  const BTN_Y = 360;

  function takeBtnRect() {
    return { x: CANVAS_W / 2 - BTN_W - BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function passBtnRect() {
    return { x: CANVAS_W / 2 + BTN_GAP / 2, y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  function suitBtnRect(idx) {
    const totalW = 3 * 80 + 2 * 8;
    const startX = (CANVAS_W - totalW) / 2;
    return { x: startX + idx * 88, y: BTN_Y, w: 80, h: BTN_H };
  }

  function passR2BtnRect() {
    return { x: CANVAS_W / 2 - BTN_W / 2, y: BTN_Y + BTN_H + 8, w: BTN_W, h: BTN_H };
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawScorePanel() {
    const px = CANVAS_W - 200;
    const py = 10;
    const pw = 190;
    const ph = 140;

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
    S._ctx.fillText('Belote', px + 10, py + 8);

    S._ctx.font = '11px sans-serif';
    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Your Team (You+Partner)', px + 10, py + 28);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('' + S.teamScores[TEAM_A], px + pw - 10, py + 28);

    S._ctx.textAlign = 'left';
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Opponents (AI-1+AI-3)', px + 10, py + 44);
    S._ctx.textAlign = 'right';
    S._ctx.fillText('' + S.teamScores[TEAM_B], px + pw - 10, py + 44);

    // Tricks & points this round
    if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_ROUND_OVER) {
      S._ctx.textAlign = 'left';
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '10px sans-serif';
      S._ctx.fillText('Round pts: A=' + S.teamTrickPoints[TEAM_A] + '  B=' + S.teamTrickPoints[TEAM_B], px + 10, py + 64);
      S._ctx.fillText('Trick ' + (S.trickCount + (S.phase === PHASE_PLAYING ? 1 : 0)) + '/' + TRICKS_PER_ROUND, px + 10, py + 78);
    }

    // Trump indicator
    if (S.trumpSuit) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 11px sans-serif';
      S._ctx.textAlign = 'left';
      S._ctx.fillText('Trump: ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], px + 10, py + 96);

      if (S.takerPlayer >= 0) {
        S._ctx.fillStyle = '#f80';
        S._ctx.font = '10px sans-serif';
        S._ctx.fillText('Taker: ' + PLAYER_NAMES[S.takerPlayer], px + 10, py + 112);
      }
    }

    // Dealer
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('Dealer: ' + PLAYER_NAMES[S.dealer], px + 10, py + 126);

    S._ctx.restore();
  }

  function drawPlayerHand() {
    const hand = S.hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      const isHover = i === S.hoveredCard && S.phase === PHASE_PLAYING && S.currentTurn === 0;
      if (isHover) y -= 10;

      CE.drawCardFace(S._ctx, x, y, hand[i]);

      // Hint glow
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_PLAYING && S.currentTurn === 0 && V.isValidPlay(hand[i], hand, 0))
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      // Dim invalid cards
      if (S.phase === PHASE_PLAYING && S.currentTurn === 0 && !V.isValidPlay(hand[i], hand, 0)) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
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
    // Subtle center circle
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

  function drawProposedCard() {
    if (!S.proposedCard) return;
    const kx = CANVAS_W / 2 - CE.CARD_W / 2;
    const ky = 230;
    CE.drawCardFace(S._ctx, kx, ky, S.proposedCard);
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Proposed trump', CANVAS_W / 2, ky + CE.CARD_H + 4);
  }

  function drawBidRound1UI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Bidding \u2014 Round 1', CANVAS_W / 2, 180);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    S._ctx.fillText('Proposed trump: ' + SUIT_SYMBOLS[S.proposedCard.suit] + ' ' + S.proposedCard.rank + ' of ' + SUIT_NAMES[S.proposedCard.suit], CANVAS_W / 2, 200);

    drawProposedCard();

    if (S.biddingPlayer === 0) {
      const tb = takeBtnRect();
      const pb = passBtnRect();
      CE.drawButton(S._ctx, tb.x, tb.y, tb.w, tb.h, 'Take', { bg: S.hoveredBtn === 'take' ? '#3a6a3a' : '#2a5a2a', border: '#6c6', fontSize: 12 });
      CE.drawButton(S._ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: S.hoveredBtn === 'pass' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
    } else {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawBidRound2UI() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Bidding \u2014 Round 2', CANVAS_W / 2, 200);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '12px sans-serif';
    const excludeSuit = S.proposedCard ? S.proposedCard.suit : null;
    S._ctx.fillText('Name any suit except ' + (excludeSuit ? SUIT_NAMES[excludeSuit] : '?'), CANVAS_W / 2, 220);

    if (S.biddingPlayer === 0) {
      let suitIdx = 0;
      for (const s of CE.SUITS) {
        if (s === excludeSuit) continue;
        const r = suitBtnRect(suitIdx);
        const col = (s === 'hearts' || s === 'diamonds') ? '#8a2a2a' : '#2a2a6a';
        const colHover = (s === 'hearts' || s === 'diamonds') ? '#aa4a4a' : '#4a4a8a';
        CE.drawButton(S._ctx, r.x, r.y, r.w, r.h, SUIT_SYMBOLS[s] + ' ' + SUIT_NAMES[s], { bg: S.hoveredBtn === s ? colHover : col, border: '#aaa', fontSize: 11 });
        ++suitIdx;
      }
      const pb = passR2BtnRect();
      CE.drawButton(S._ctx, pb.x, pb.y, pb.w, pb.h, 'Pass', { bg: S.hoveredBtn === 'pass2' ? '#6a3a3a' : '#5a2a2a', border: '#c66', fontSize: 12 });
    } else {
      S._ctx.fillStyle = '#aaa';
      S._ctx.font = '13px sans-serif';
      S._ctx.fillText(PLAYER_NAMES[S.biddingPlayer] + ' is deciding...', CANVAS_W / 2, BTN_Y + 15);
    }
  }

  function drawDealRemainingUI() {
    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText('Dealing remaining cards...', CANVAS_W / 2, CANVAS_H / 2);

    if (S.trumpSuit) {
      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '12px sans-serif';
      S._ctx.fillText('Trump: ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit] + '  |  Taker: ' + PLAYER_NAMES[S.takerPlayer], CANVAS_W / 2, CANVAS_H / 2 + 24);
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
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/' + TRICKS_PER_ROUND, 10, CANVAS_H - 16);
  }

  function drawRoundOverUI() {
    S._ctx.save();
    const px = CANVAS_W / 2 - 180;
    const py = 140;
    const pw = 360;
    const ph = 260;

    S._ctx.fillStyle = 'rgba(0,0,0,0.75)';
    CE.drawRoundedRect(S._ctx, px, py, pw, ph, 10);
    S._ctx.fill();

    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Round Complete', CANVAS_W / 2, py + 14);

    S._ctx.font = '13px sans-serif';
    S._ctx.fillStyle = '#ccc';
    const takerName = S.takerTeam === TEAM_A ? 'Your Team' : 'Opponents';
    S._ctx.fillText(takerName + ' took contract (' + SUIT_SYMBOLS[S.trumpSuit] + ')', CANVAS_W / 2, py + 40);

    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Your Team pts: ' + S.teamTrickPoints[TEAM_A] + '   Total: ' + S.teamScores[TEAM_A], CANVAS_W / 2, py + 68);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Opponents pts: ' + S.teamTrickPoints[TEAM_B] + '   Total: ' + S.teamScores[TEAM_B], CANVAS_W / 2, py + 88);

    S._ctx.fillStyle = '#ff0';
    S._ctx.font = 'bold 14px sans-serif';
    const lines = S.roundMessage.split('\n');
    for (let i = 0; i < lines.length; ++i)
      S._ctx.fillText(lines[i], CANVAS_W / 2, py + 118 + i * 18);

    S._ctx.fillStyle = '#8f8';
    S._ctx.font = '11px sans-serif';
    S._ctx.fillText('Click to continue', CANVAS_W / 2, py + ph - 22);
    S._ctx.restore();
  }

  function drawGameOverUI() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(0,0,0,0.8)';
    S._ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const won = S.teamScores[TEAM_A] >= WIN_SCORE;
    S._ctx.fillStyle = won ? '#4f4' : '#f44';
    S._ctx.font = 'bold 24px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'middle';
    S._ctx.fillText(won ? 'You Win!' : 'You Lose!', CANVAS_W / 2, 220);

    S._ctx.fillStyle = '#fff';
    S._ctx.font = '16px sans-serif';
    S._ctx.fillText('Your Team: ' + S.teamScores[TEAM_A] + '  |  Opponents: ' + S.teamScores[TEAM_B], CANVAS_W / 2, 260);

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '14px sans-serif';
    S._ctx.fillText('Click to start a new game', CANVAS_W / 2, 300);
    S._ctx.restore();
  }

  function drawAll() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Belote', 10, 10);

    drawScorePanel();
    drawAIHands();

    if (S.phase === PHASE_BID_ROUND1) {
      drawBidRound1UI();
      drawPlayerHand();
    } else if (S.phase === PHASE_BID_ROUND2) {
      drawBidRound2UI();
      drawPlayerHand();
    } else if (S.phase === PHASE_DEAL_REMAINING) {
      drawDealRemainingUI();
      drawPlayerHand();
    } else if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_TRICK_DONE) {
      drawTrickArea();
      drawPlayerHand();
      drawPlayingUI();
    } else if (S.phase === PHASE_ROUND_OVER) {
      drawRoundOverUI();
    } else if (S.phase === PHASE_GAME_OVER) {
      drawGameOverUI();
    }
  }

  function draw(ctx, W, H) {
    S._ctx = ctx;
    drawAll();
  }

  V.playerCardX = playerCardX;
  V.takeBtnRect = takeBtnRect;
  V.passBtnRect = passBtnRect;
  V.suitBtnRect = suitBtnRect;
  V.passR2BtnRect = passR2BtnRect;
  V.draw = draw;

})();
