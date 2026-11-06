/* Three Card Poker: canvas drawing of the table, cards and status. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const CHIP = SZ.CardGames.shared.casinoChips;
  const V = SZ.CardGames.v.threecard;
  const S = V.S;
  const { CANVAS_W, PHASE_BETTING, PHASE_DEALING, PHASE_DECISION, HAND_NAMES, DEALER_HAND_Y,
    PLAYER_HAND_Y, HAND_CENTER_X, CARD_GAP, HAND_OFFSET_X, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H,
    BET_ZONE_GAP, CHIP_BTN_Y, DEAL_BTN, PLAY_BTN, FOLD_BTN } = V;

  function handCardX(index) {
    return HAND_CENTER_X + HAND_OFFSET_X + index * (CE.CARD_W + CARD_GAP);
  }

  function betZoneX(index) {
    const totalW = 2 * BET_ZONE_W + BET_ZONE_GAP;
    return (CANVAS_W - totalW) / 2 + index * (BET_ZONE_W + BET_ZONE_GAP);
  }

  function drawThreeCard() {
    /* ── Title ── */
    S._ctx.fillStyle = '#fff';
    S._ctx.font = 'bold 22px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Three Card Poker', CANVAS_W / 2, 35);

    /* ── Chips display (top right) ── */
    S._ctx.fillStyle = '#fa0';
    S._ctx.font = 'bold 14px sans-serif';
    S._ctx.textAlign = 'right';
    S._ctx.fillText('Chips: $' + S.score, CANVAS_W - 40, 60);

    /* ── Hand labels ── */
    S._ctx.fillStyle = '#cdf';
    S._ctx.font = 'bold 16px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Dealer', CANVAS_W / 2, DEALER_HAND_Y - 20);
    S._ctx.fillText('Player', CANVAS_W / 2, PLAYER_HAND_Y - 20);

    /* ── Dealer hand ── */
    drawHand(S.dealerHand, DEALER_HAND_Y, true);

    /* ── Player hand ── */
    drawHand(S.playerHand, PLAYER_HAND_Y, false);

    /* ── Hand rank labels (when visible) ── */
    if (S.playerHand.length === 3 && S.phase !== PHASE_BETTING && S.phase !== PHASE_DEALING) {
      const pRank = V.evaluateHand(S.playerHand);
      S._ctx.fillStyle = '#afa';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(HAND_NAMES[pRank], CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H + 20);
    }

    if (S.dealerHand.length === 3 && S.dealerHand[0].faceUp) {
      const dRank = V.evaluateHand(S.dealerHand);
      const qualifies = V.dealerQualifies(S.dealerHand);
      S._ctx.fillStyle = qualifies ? '#faa' : '#888';
      S._ctx.font = '13px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(
        HAND_NAMES[dRank] + (qualifies ? '' : ' (Does not qualify)'),
        CANVAS_W / 2, DEALER_HAND_Y + CE.CARD_H + 20
      );
    }

    /* ── Result text ── */
    if (S.resultMsg) {
      S._ctx.fillStyle = '#ff8';
      S._ctx.font = 'bold 18px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultMsg, CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H + 45);
    }
    if (S.resultDetail) {
      S._ctx.fillStyle = '#ccc';
      S._ctx.font = '12px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(S.resultDetail, CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H + 63);
    }

    /* ── Betting area / action buttons ── */
    drawBettingArea();
    drawActionButtons();
  }

  function drawHand(hand, y, isDealer) {
    if (hand.length === 0) {
      for (let i = 0; i < 3; ++i)
        CE.drawEmptySlot(S._ctx, handCardX(i), y);
      return;
    }

    for (let i = 0; i < hand.length; ++i) {
      if (hand[i]._dealing) continue;
      if (hand[i].faceUp)
        CE.drawCardFace(S._ctx, handCardX(i), y, hand[i]);
      else
        CE.drawCardBack(S._ctx, handCardX(i), y);
    }
  }

  function drawBettingArea() {
    const zones = [
      { target: 'ante',     label: 'Ante',       amount: S.anteBet,     idx: 0 },
      { target: 'pairplus', label: 'Pair Plus',   amount: S.pairPlusBet, idx: 1 }
    ];

    for (const z of zones) {
      const zx = betZoneX(z.idx);
      const selected = z.amount > 0;
      const bg = selected ? 'rgba(255,200,0,0.25)' : 'rgba(255,255,255,0.08)';
      const border = selected ? '#fa0' : 'rgba(255,255,255,0.3)';

      CE.drawRoundedRect(S._ctx, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, 8);
      S._ctx.fillStyle = bg;
      S._ctx.fill();
      S._ctx.strokeStyle = border;
      S._ctx.lineWidth = selected ? 2.5 : 1.5;
      S._ctx.stroke();

      S._ctx.fillStyle = selected ? '#fc0' : '#ccc';
      S._ctx.font = 'bold 14px sans-serif';
      S._ctx.textAlign = 'center';
      S._ctx.fillText(z.label, zx + BET_ZONE_W / 2, BET_ZONE_Y + 20);

      if (z.amount > 0) {
        S._ctx.fillStyle = '#fc0';
        S._ctx.font = 'bold 12px sans-serif';
        S._ctx.fillText('$' + z.amount, zx + BET_ZONE_W / 2, BET_ZONE_Y + 40);
      } else {
        S._ctx.fillStyle = '#777';
        S._ctx.font = '11px sans-serif';
        S._ctx.fillText(z.target === 'ante' ? 'Required' : 'Optional', zx + BET_ZONE_W / 2, BET_ZONE_Y + 40);
      }

      /* ── Hint glow on ante zone if hints enabled and no ante placed ── */
      if (S._host && S._host.hintsEnabled && S.phase === PHASE_BETTING && z.target === 'ante' && S.anteBet === 0)
        CE.drawHintGlow(S._ctx, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, S._host.hintTime);
    }

    /* ── Chip selector buttons (only during betting) ── */
    if (S.phase === PHASE_BETTING) {
      CHIP.drawChipButtons(S._ctx, CHIP_BTN_Y, S.selectedChip);

      /* ── Deal button ── */
      const canDeal = S.anteBet > 0;
      CE.drawButton(
        S._ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
        'Deal (D)',
        { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
      );

      /* ── Clear button ── */
      if (S.anteBet > 0 || S.pairPlusBet > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        CE.drawButton(S._ctx, clearX, DEAL_BTN.y, 70, DEAL_BTN.h, 'Clear', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });
      }

      /* ── Instructions ── */
      if (S.anteBet === 0) {
        S._ctx.fillStyle = '#888';
        S._ctx.font = '13px sans-serif';
        S._ctx.textAlign = 'center';
        S._ctx.fillText('Place an Ante bet to start. Pair Plus is optional.', CANVAS_W / 2, BET_ZONE_Y - 12);
      }
    }
  }

  function drawActionButtons() {
    if (S.phase !== PHASE_DECISION) return;

    const playHint = S._host && S._host.hintsEnabled && V.shouldPlay(S.playerHand);
    const foldHint = S._host && S._host.hintsEnabled && !V.shouldPlay(S.playerHand);

    /* ── Play button ── */
    CE.drawButton(
      S._ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h,
      'Play $' + S.anteBet + ' (P)',
      { bg: '#2a5a2a', border: '#6c6', fontSize: 14 }
    );

    if (playHint)
      CE.drawHintGlow(S._ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, S._host.hintTime);

    /* ── Fold button ── */
    CE.drawButton(
      S._ctx, FOLD_BTN.x, FOLD_BTN.y, FOLD_BTN.w, FOLD_BTN.h,
      'Fold (F)',
      { bg: '#5a2a2a', border: '#c66', fontSize: 14 }
    );

    if (foldHint)
      CE.drawHintGlow(S._ctx, FOLD_BTN.x, FOLD_BTN.y, FOLD_BTN.w, FOLD_BTN.h, S._host.hintTime);

    /* ── Instruction text ── */
    S._ctx.fillStyle = '#aaa';
    S._ctx.font = '13px sans-serif';
    S._ctx.textAlign = 'center';
    S._ctx.fillText('Play matches your Ante. Fold forfeits Ante & Pair Plus.', CANVAS_W / 2, PLAY_BTN.y + PLAY_BTN.h + 22);
  }

  function drawPayoutTable() {
    const px = 20;
    const py = 65;

    S._ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(S._ctx, px, py, 180, 155, 6);
    S._ctx.fill();

    S._ctx.fillStyle = '#fc0';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('PAIR PLUS PAYOUTS', px + 10, py + 16);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    const ppLines = [
      ['Straight Flush', '40 : 1'],
      ['Three of a Kind', '30 : 1'],
      ['Straight', '6 : 1'],
      ['Flush', '3 : 1'],
      ['Pair', '1 : 1']
    ];
    for (let i = 0; i < ppLines.length; ++i) {
      S._ctx.textAlign = 'left';
      S._ctx.fillText(ppLines[i][0], px + 10, py + 34 + i * 15);
      S._ctx.textAlign = 'right';
      S._ctx.fillText(ppLines[i][1], px + 170, py + 34 + i * 15);
    }

    S._ctx.fillStyle = '#fc0';
    S._ctx.font = 'bold 11px sans-serif';
    S._ctx.textAlign = 'left';
    S._ctx.fillText('ANTE BONUS', px + 10, py + 114);

    S._ctx.fillStyle = '#ccc';
    S._ctx.font = '11px sans-serif';
    const abLines = [
      ['Straight Flush', '5 : 1'],
      ['Three of a Kind', '4 : 1'],
      ['Straight', '1 : 1']
    ];
    for (let i = 0; i < abLines.length; ++i) {
      S._ctx.textAlign = 'left';
      S._ctx.fillText(abLines[i][0], px + 10, py + 130 + i * 15);
      S._ctx.textAlign = 'right';
      S._ctx.fillText(abLines[i][1], px + 170, py + 130 + i * 15);
    }
  }

  Object.assign(V, { handCardX, betZoneX, drawThreeCard, drawPayoutTable });

})();
