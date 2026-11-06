/* Bridge - drawing of the table, hands, dummy and tricks. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.bridge;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, STRAIN_ORDER, PLAYER_NAMES, PLAYER_SHORT, SOUTH,
    WEST, NORTH, EAST, TEAM_NS, PHASE_BIDDING, PHASE_PLAYING,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER, PHASE_GAME_OVER, BID_AREA_Y,
    PLAYER_HAND_Y, DUMMY_HAND_Y, AI_HAND_POS
  } = V;

  /* ================================================================
     BIDDING BUTTON GRID
     ================================================================ */

  const BID_BTN_W = 42;
  const BID_BTN_H = 26;
  const BID_BTN_GAP = 3;
  const BID_AREA_X = 260;

  /* 7 rows x 5 columns: levels 1-7 x strains (C D H S NT) */
  function bidBtnRect(level, strainIdx) {
    return {
      x: BID_AREA_X + strainIdx * (BID_BTN_W + BID_BTN_GAP),
      y: BID_AREA_Y + (level - 1) * (BID_BTN_H + BID_BTN_GAP),
      w: BID_BTN_W,
      h: BID_BTN_H
    };
  }

  function bidBtnIndex(level, strainIdx) {
    return (level - 1) * 5 + strainIdx;
  }

  function bidFromIndex(idx) {
    const level = Math.floor(idx / 5) + 1;
    const strainIdx = idx % 5;
    return { level, strain: STRAIN_ORDER[strainIdx] };
  }

  /* ================================================================
     LAYOUT CONSTANTS
     ================================================================ */

  function playerCardX(idx, total) {
    const maxWidth = 640;
    const fanWidth = Math.min(maxWidth, total * 48);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }
  function dummyCardX(idx, total) {
    const maxWidth = 600;
    const fanWidth = Math.min(maxWidth, total * 48);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  /* Trick card positions: center, arranged by seat */
  const TRICK_POS = [
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 330 },          // South
    { x: CANVAS_W / 2 - CE.CARD_W - 45, y: 270 },          // West
    { x: CANVAS_W / 2 - CE.CARD_W / 2, y: 210 },           // North
    { x: CANVAS_W / 2 + 45, y: 270 }                        // East
  ];

  /* ================================================================
     DRAWING - PLAYER HAND (South)
     ================================================================ */

  function drawPlayerHand() {
    const hand = S.hands[SOUTH];
    const total = hand.length;
    if (total === 0) return;

    const isPlayerTurn = S.phase === PHASE_PLAYING && V.controllerOf(S.currentTurn) === SOUTH && S.currentTurn === SOUTH;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (isPlayerTurn && i === S.hoveredCard)
        y -= 10;

      const valid = isPlayerTurn && V.isValidPlay(hand[i], hand);

      if (valid) {
        S._ctx.save();
        S._ctx.shadowColor = '#4f4';
        S._ctx.shadowBlur = 8;
        CE.drawCardFace(S._ctx, x, y, hand[i]);
        S._ctx.restore();
      } else
        CE.drawCardFace(S._ctx, x, y, hand[i]);

      if (S._host && S._host.hintsEnabled && isPlayerTurn && valid)
        CE.drawHintGlow(S._ctx, x, y, CE.CARD_W, CE.CARD_H, S._host.hintTime);

      if (isPlayerTurn && !valid) {
        S._ctx.save();
        S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
        CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        S._ctx.fill();
        S._ctx.restore();
      }
    }
  }

  /* ================================================================
     DRAWING - DUMMY HAND (North when revealed)
     ================================================================ */

  function drawDummyHand() {
    const hand = S.hands[S.dummyPlayer];
    const total = hand.length;

    /* If dummy is South (player is dummy), cards shown at bottom -- handled in drawPlayerHand */
    if (S.dummyPlayer === SOUTH) return;

    /* If dummy is North, show face-up at top */
    if (S.dummyPlayer === NORTH) {
      if (!S.dummyRevealed) {
        /* Show as card backs */
        const spacing = Math.min(22, 360 / Math.max(total, 1));
        const totalW = (total - 1) * spacing + CE.CARD_W * 0.55;
        const startX = CANVAS_W / 2 - totalW / 2;
        S._ctx.fillStyle = '#aaa';
        S._ctx.font = '11px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.textBaseline = 'bottom';
        S._ctx.fillText('North (' + total + ')', CANVAS_W / 2, DUMMY_HAND_Y);
        for (let i = 0; i < total; ++i)
          CE.drawCardBack(S._ctx, startX + i * spacing, DUMMY_HAND_Y + 2, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        return;
      }

      const isDummyTurn = S.phase === PHASE_PLAYING && S.currentTurn === S.dummyPlayer;
      const isHumanControlling = isDummyTurn && V.controllerOf(S.dummyPlayer) === SOUTH;

      S._ctx.fillStyle = isDummyTurn ? '#ff0' : '#aaa';
      S._ctx.font = isDummyTurn ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('Dummy (North) \u2014 ' + total + ' cards', CANVAS_W / 2, DUMMY_HAND_Y);

      for (let i = 0; i < total; ++i) {
        const x = dummyCardX(i, total);
        let y = DUMMY_HAND_Y + 2;

        const valid = isHumanControlling && V.isValidPlay(hand[i], hand);

        if (isHumanControlling && i === S.hoveredCard && S.currentTurn === S.dummyPlayer)
          y += 8;

        CE.drawCardFace(S._ctx, x, y, hand[i], CE.CARD_W * 0.75, CE.CARD_H * 0.75);

        if (S._host && S._host.hintsEnabled && isHumanControlling && valid)
          CE.drawHintGlow(S._ctx, x, y, CE.CARD_W * 0.75, CE.CARD_H * 0.75, S._host.hintTime);

        if (isHumanControlling && !valid) {
          S._ctx.save();
          S._ctx.fillStyle = 'rgba(0,0,0,0.35)';
          CE.drawRoundedRect(S._ctx, x, y, CE.CARD_W * 0.75, CE.CARD_H * 0.75, CE.CARD_RADIUS);
          S._ctx.fill();
          S._ctx.restore();
        }
      }
      return;
    }

    /* If dummy is West or East -- draw face up in their position */
    drawAISingleHand(S.dummyPlayer, true);
  }

  /* ================================================================
     DRAWING - AI HANDS
     ================================================================ */

  function drawAISingleHand(p, faceUp) {
    const hand = S.hands[p];
    const count = hand.length;
    const pos = AI_HAND_POS[p];
    if (!pos) return;

    const isCurrent = S.currentTurn === p && S.phase === PHASE_PLAYING;
    const isDummy = p === S.dummyPlayer && S.dummyRevealed;

    S._ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
    S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.textBaseline = 'bottom';

    const label = pos.label + (isDummy ? ' (Dummy)' : '') + ' (' + count + ')';

    const spacing = Math.min(18, 240 / Math.max(count, 1));
    const lx = pos.x + (p === WEST ? 20 : 0);
    S._ctx.fillText(label, lx + CE.CARD_W * 0.25, pos.y - 2);

    for (let i = 0; i < count; ++i) {
      const cx = pos.x + (p === WEST ? 5 : -CE.CARD_W * 0.5 + 5);
      const cy = pos.y + 14 + i * spacing;

      if (faceUp || isDummy) {
        CE.drawCardFace(S._ctx, cx, cy, hand[i], CE.CARD_W * 0.5, CE.CARD_H * 0.45);

        /* If human controls dummy at West/East, show valid hints */
        if (isDummy && S.currentTurn === p && V.controllerOf(p) === SOUTH) {
          if (S._host && S._host.hintsEnabled && V.isValidPlay(hand[i], hand))
            CE.drawHintGlow(S._ctx, cx, cy, CE.CARD_W * 0.5, CE.CARD_H * 0.45, S._host.hintTime);
        }
      } else
        CE.drawCardBack(S._ctx, cx, cy, CE.CARD_W * 0.5, CE.CARD_H * 0.45);
    }
  }

  function drawAIHands() {
    for (const p of [WEST, EAST]) {
      if (p === S.dummyPlayer && S.dummyRevealed) continue; // drawn by drawDummyHand
      drawAISingleHand(p, false);
    }
    /* Draw North as card backs if not dummy or not revealed */
    if (S.dummyPlayer !== NORTH || !S.dummyRevealed) {
      const hand = S.hands[NORTH];
      const count = hand.length;
      const isCurrent = S.currentTurn === NORTH && S.phase === PHASE_PLAYING;

      S._ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      S._ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'bottom';
      S._ctx.fillText('North (' + count + ')', CANVAS_W / 2, DUMMY_HAND_Y);

      const spacing = Math.min(22, 360 / Math.max(count, 1));
      const totalW = (count - 1) * spacing + CE.CARD_W * 0.55;
      const startX = CANVAS_W / 2 - totalW / 2;
      for (let i = 0; i < count; ++i)
        CE.drawCardBack(S._ctx, startX + i * spacing, DUMMY_HAND_Y + 2, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }
  }

  /* ================================================================
     DRAWING - TRICK AREA
     ================================================================ */

  function drawTrickArea() {
    S._ctx.save();
    S._ctx.fillStyle = 'rgba(255,255,255,0.04)';
    S._ctx.beginPath();
    S._ctx.arc(CANVAS_W / 2, 290, 85, 0, Math.PI * 2);
    S._ctx.fill();
    S._ctx.restore();

    for (let i = 0; i < S.trickCards.length; ++i) {
      const p = S.trickPlayers[i];
      const pos = TRICK_POS[p];
      CE.drawCardFace(S._ctx, pos.x, pos.y, S.trickCards[i]);

      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '10px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'top';
      const labelY = p === NORTH ? pos.y - 12 : pos.y + CE.CARD_H + 3;
      S._ctx.fillText(PLAYER_SHORT[p], pos.x + CE.CARD_W / 2, labelY);
    }

    if (S.phase === PHASE_TRICK_DONE && S.trickWinnerIdx >= 0) {
      S._ctx.fillStyle = '#ff0';
      S._ctx.font = 'bold 13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.textBaseline = 'middle';
      const who = S.trickWinnerIdx === SOUTH ? 'You take' : PLAYER_NAMES[S.trickWinnerIdx] + ' takes';
      S._ctx.fillText(who + ' the trick', CANVAS_W / 2, 195);
    }
  }

  /* ================================================================
     DRAWING - TRICK COUNTER
     ================================================================ */

  function drawTrickCounter() {
    if (S.phase < PHASE_PLAYING || !S.contractBid) return;

    const needed = S.contractBid.level + 6;
    const declTeam = V.teamOf(S.contractPlayer);
    const declTricks = declTeam === TEAM_NS ? S.tricksWonNS : S.tricksWonEW;
    const defTricks = declTeam === TEAM_NS ? S.tricksWonEW : S.tricksWonNS;

    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '10px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';
    S._ctx.fillText('Trick ' + (S.trickCount + 1) + '/13', 10, CANVAS_H - 28);

    S._ctx.fillStyle = '#8cf';
    S._ctx.fillText('Decl: ' + declTricks + '/' + needed, 10, CANVAS_H - 14);
    S._ctx.fillStyle = '#f88';
    S._ctx.fillText('Def: ' + defTricks, 100, CANVAS_H - 14);
  }

  /* ================================================================
     DRAWING - MAIN
     ================================================================ */

  function drawAll() {
    S._ctx.fillStyle = '#fff';
    S._ctx.font = '14px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.textBaseline = 'top';

    V.drawScorePanel();

    if (S.phase === PHASE_BIDDING) {
      drawAIHands();
      /* Show North as card backs during bidding */
      drawPlayerHand();
      V.drawBiddingUI();
    } else if (S.phase >= PHASE_PLAYING && S.phase <= PHASE_TRICK_DONE) {
      V.drawContractDisplay();
      drawAIHands();
      if (S.dummyRevealed)
        drawDummyHand();
      drawTrickArea();
      drawPlayerHand();
      drawTrickCounter();
      V.drawStatusBar();
    } else if (S.phase === PHASE_ROUND_OVER) {
      V.drawRoundOverUI();
    } else if (S.phase === PHASE_GAME_OVER) {
      V.drawGameOverUI();
    }
  }

  Object.assign(V, {
    bidBtnRect, bidBtnIndex, playerCardX, dummyCardX, drawAll
  });

})();
