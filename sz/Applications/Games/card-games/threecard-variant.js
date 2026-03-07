;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BETTING = 'BETTING';
  const PHASE_DEALING = 'DEALING';
  const PHASE_DECISION = 'DECISION';
  const PHASE_REVEAL = 'REVEAL';
  const PHASE_RESULT = 'RESULT';

  /* ── Hand ranks ── */
  const HAND_HIGH_CARD = 0;
  const HAND_PAIR = 1;
  const HAND_FLUSH = 2;
  const HAND_STRAIGHT = 3;
  const HAND_THREE_KIND = 4;
  const HAND_STRAIGHT_FLUSH = 5;

  const HAND_NAMES = ['High Card', 'Pair', 'Flush', 'Straight', 'Three of a Kind', 'Straight Flush'];

  /* ── Chip denominations ── */
  const CHIPS = [10, 25, 50, 100];
  const CHIP_COLORS = { 10: '#2266cc', 25: '#22aa44', 50: '#cc4422', 100: '#222222' };

  /* ── Pair Plus payouts (multiplier, not including original bet) ── */
  const PP_PAYOUTS = {
    [HAND_PAIR]: 1,
    [HAND_FLUSH]: 3,
    [HAND_STRAIGHT]: 6,
    [HAND_THREE_KIND]: 30,
    [HAND_STRAIGHT_FLUSH]: 40
  };

  /* ── Ante Bonus payouts ── */
  const ANTE_BONUS = {
    [HAND_STRAIGHT]: 1,
    [HAND_THREE_KIND]: 4,
    [HAND_STRAIGHT_FLUSH]: 5
  };

  /* ── Layout constants ── */
  const DEALER_HAND_Y = 130;
  const PLAYER_HAND_Y = 300;
  const HAND_CENTER_X = CANVAS_W / 2;
  const CARD_GAP = 14;
  const HAND_OFFSET_X = -(CE.CARD_W + CARD_GAP); // center 3 cards around HAND_CENTER_X

  const BET_ZONE_Y = 232;
  const BET_ZONE_W = 120;
  const BET_ZONE_H = 50;
  const BET_ZONE_GAP = 40;

  const CHIP_BTN_Y = 510;
  const CHIP_BTN_W = 50;
  const CHIP_BTN_H = 34;
  const CHIP_BTN_GAP = 12;

  const DEAL_BTN = { x: CANVAS_W / 2 - 50, y: 555, w: 100, h: 32 };
  const PLAY_BTN = { x: CANVAS_W / 2 - 130, y: 460, w: 110, h: 36 };
  const FOLD_BTN = { x: CANVAS_W / 2 + 20, y: 460, w: 110, h: 36 };

  /* ── Game state ── */
  let deck = [];
  let playerHand = [];
  let dealerHand = [];
  let phase = PHASE_BETTING;
  let anteBet = 0;
  let pairPlusBet = 0;
  let selectedChip = 10;
  let betTarget = null; // 'ante' or 'pairplus' during betting
  let score = 1000;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let resultDetail = '';
  let dealTimer = 0;
  let dealStep = 0;
  let revealTimer = 0;
  let revealStep = 0;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     DECK MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function createFreshDeck() {
    return CE.shuffle(CE.createDeck());
  }

  function drawCard() {
    if (deck.length < 1)
      deck = createFreshDeck();
    return deck.pop();
  }

  /* ══════════════════════════════════════════════════════════════════
     CARD EVALUATION (3-card poker)
     ══════════════════════════════════════════════════════════════════ */

  function rankValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank, 10);
  }

  function sortedValues(hand) {
    const vals = hand.map(c => rankValue(c.rank));
    vals.sort((a, b) => b - a);
    return vals;
  }

  function isFlush(hand) {
    return hand[0].suit === hand[1].suit && hand[1].suit === hand[2].suit;
  }

  function isStraight(hand) {
    const vals = sortedValues(hand);
    // Normal straight: consecutive descending
    if (vals[0] - vals[1] === 1 && vals[1] - vals[2] === 1)
      return true;
    // Ace-low straight: A-2-3
    if (vals[0] === 14 && vals[1] === 3 && vals[2] === 2)
      return true;
    return false;
  }

  function isThreeOfAKind(hand) {
    return hand[0].rank === hand[1].rank && hand[1].rank === hand[2].rank;
  }

  function isPair(hand) {
    return hand[0].rank === hand[1].rank || hand[1].rank === hand[2].rank || hand[0].rank === hand[2].rank;
  }

  function evaluateHand(hand) {
    const flush = isFlush(hand);
    const straight = isStraight(hand);
    const threeKind = isThreeOfAKind(hand);
    const pair = isPair(hand);

    if (straight && flush) return HAND_STRAIGHT_FLUSH;
    if (threeKind) return HAND_THREE_KIND;
    if (straight) return HAND_STRAIGHT;
    if (flush) return HAND_FLUSH;
    if (pair) return HAND_PAIR;
    return HAND_HIGH_CARD;
  }

  /**
   * Returns an array of tiebreaker values for comparing hands of equal rank.
   * For pairs, the pair value comes first, then the kicker.
   * For everything else, descending sorted values (with ace-low straight handled).
   */
  function tiebreakers(hand) {
    const vals = sortedValues(hand);
    const handRank = evaluateHand(hand);

    if (handRank === HAND_PAIR) {
      // Find the pair value
      if (vals[0] === vals[1])
        return [vals[0], vals[2]];
      if (vals[1] === vals[2])
        return [vals[1], vals[0]];
      // vals[0] === vals[2] shouldn't happen with sorted, but handle it
      return [vals[0], vals[1]];
    }

    // Ace-low straight: A-2-3 should compare as 3-2-1
    if ((handRank === HAND_STRAIGHT || handRank === HAND_STRAIGHT_FLUSH) &&
        vals[0] === 14 && vals[1] === 3 && vals[2] === 2)
      return [3, 2, 1];

    return vals;
  }

  /**
   * Compares two 3-card hands. Returns positive if hand1 wins, negative if hand2 wins, 0 for tie.
   */
  function compareHands(hand1, hand2) {
    const rank1 = evaluateHand(hand1);
    const rank2 = evaluateHand(hand2);
    if (rank1 !== rank2)
      return rank1 - rank2;

    const tb1 = tiebreakers(hand1);
    const tb2 = tiebreakers(hand2);
    for (let i = 0; i < tb1.length; ++i) {
      if (tb1[i] !== tb2[i])
        return tb1[i] - tb2[i];
    }
    return 0;
  }

  /**
   * Checks if dealer qualifies (Queen-high or better).
   * Dealer qualifies if hand rank >= Pair, or if high card is Q or above.
   */
  function dealerQualifies(hand) {
    const handRank = evaluateHand(hand);
    if (handRank >= HAND_PAIR) return true;
    const vals = sortedValues(hand);
    return vals[0] >= 12; // Q=12, K=13, A=14
  }

  /**
   * Checks if player hand meets the Q-6-4 threshold for the play hint.
   */
  function shouldPlay(hand) {
    const handRank = evaluateHand(hand);
    if (handRank >= HAND_PAIR) return true;
    const vals = sortedValues(hand);
    if (vals[0] > 12) return true;
    if (vals[0] < 12) return false;
    // High card is exactly Q
    if (vals[1] > 6) return true;
    if (vals[1] < 6) return false;
    // Second card is exactly 6
    return vals[2] >= 4;
  }

  /* ══════════════════════════════════════════════════════════════════
     LAYOUT HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function handCardX(index) {
    return HAND_CENTER_X + HAND_OFFSET_X + index * (CE.CARD_W + CARD_GAP);
  }

  function betZoneX(index) {
    const totalW = 2 * BET_ZONE_W + BET_ZONE_GAP;
    return (CANVAS_W - totalW) / 2 + index * (BET_ZONE_W + BET_ZONE_GAP);
  }

  function chipBtnX(index) {
    const totalW = CHIPS.length * CHIP_BTN_W + (CHIPS.length - 1) * CHIP_BTN_GAP;
    return (CANVAS_W - totalW) / 2 + index * (CHIP_BTN_W + CHIP_BTN_GAP);
  }

  /* ══════════════════════════════════════════════════════════════════
     BETTING
     ══════════════════════════════════════════════════════════════════ */

  function placeBet(target) {
    if (phase !== PHASE_BETTING) return;
    if (selectedChip > score) return;

    if (target === 'ante') {
      const newAnte = anteBet + selectedChip;
      // Ante + potential Play bet must not exceed score (minus existing pair plus)
      if (newAnte * 2 + pairPlusBet > score)
        return;
      anteBet = newAnte;
    } else if (target === 'pairplus') {
      const newPP = pairPlusBet + selectedChip;
      if (anteBet * 2 + newPP > score)
        return;
      pairPlusBet = newPP;
    }
  }

  function clearBets() {
    anteBet = 0;
    pairPlusBet = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     DEALING & GAME FLOW
     ══════════════════════════════════════════════════════════════════ */

  function startDeal() {
    if (phase !== PHASE_BETTING || anteBet <= 0) return;
    phase = PHASE_DEALING;
    playerHand = [];
    dealerHand = [];
    resultMsg = '';
    resultDetail = '';
    dealStep = 0;
    dealTimer = 0;
    deck = createFreshDeck();
  }

  function dealNextCard() {
    const card = drawCard();
    const isPlayer = dealStep < 3;
    const hand = isPlayer ? playerHand : dealerHand;
    const idx = isPlayer ? dealStep : dealStep - 3;
    const targetY = isPlayer ? PLAYER_HAND_Y : DEALER_HAND_Y;

    card.faceUp = isPlayer; // Player cards face-up, dealer cards face-down
    hand.push(card);

    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, handCardX(idx), targetY, 0);

    ++dealStep;
  }

  function finishDealing() {
    phase = PHASE_DECISION;
  }

  function doPlay() {
    if (phase !== PHASE_DECISION) return;
    // Play bet matches ante
    phase = PHASE_REVEAL;
    revealStep = 0;
    revealTimer = 0;
  }

  function doFold() {
    if (phase !== PHASE_DECISION) return;
    // Lose ante + pair plus
    const loss = anteBet + pairPlusBet;
    score -= loss;
    resultMsg = 'Folded! -$' + loss;
    resultDetail = '';

    if (_host) {
      _host.floatingText.add(CANVAS_W / 2, 250, 'Fold -$' + loss, { color: '#f44', size: 22 });
      _host.screenShake.trigger(4, 200);
    }

    finishRound();
  }

  function revealDealerCards() {
    for (const c of dealerHand) {
      c.faceUp = true;
      if (_host)
        _host.flipCard(c, true);
    }
  }

  function resolveRound() {
    phase = PHASE_RESULT;
    revealDealerCards();

    const playerRank = evaluateHand(playerHand);
    const qualifies = dealerQualifies(dealerHand);
    const comparison = compareHands(playerHand, dealerHand);

    let totalWin = 0;
    let totalLoss = 0;
    const details = [];

    /* ── Pair Plus (independent of everything) ── */
    if (pairPlusBet > 0) {
      const ppMult = PP_PAYOUTS[playerRank];
      if (ppMult !== undefined) {
        const ppWin = pairPlusBet * ppMult;
        totalWin += ppWin;
        details.push('Pair Plus +$' + ppWin);
      } else {
        totalLoss += pairPlusBet;
        details.push('Pair Plus -$' + pairPlusBet);
      }
    }

    /* ── Ante Bonus (paid regardless of dealer qualifying) ── */
    const abMult = ANTE_BONUS[playerRank];
    if (abMult !== undefined) {
      const abWin = anteBet * abMult;
      totalWin += abWin;
      details.push('Ante Bonus +$' + abWin);
    }

    /* ── Ante / Play resolution ── */
    if (!qualifies) {
      // Ante pays 1:1, Play pushes (returned)
      totalWin += anteBet;
      details.push('Dealer doesn\'t qualify: Ante +$' + anteBet + ', Play push');
    } else if (comparison > 0) {
      // Player wins: Ante 1:1, Play 1:1
      totalWin += anteBet + anteBet; // ante win + play win
      details.push('Player wins: +$' + (anteBet * 2));
    } else if (comparison < 0) {
      // Dealer wins: lose ante + play
      totalLoss += anteBet + anteBet;
      details.push('Dealer wins: -$' + (anteBet * 2));
    } else {
      // Tie: both push
      details.push('Tie: Ante & Play push');
    }

    const net = totalWin - totalLoss;
    score += net;

    if (net > 0) {
      resultMsg = 'Win +$' + net + '!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 250, resultMsg, { color: '#4f4', size: 24 });
        _host.addGlow(handCardX(0), PLAYER_HAND_Y, 3 * (CE.CARD_W + CARD_GAP), CE.CARD_H, 2.0);
        _host.triggerChipSparkle(CANVAS_W / 2, BET_ZONE_Y);
        _host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else if (net < 0) {
      resultMsg = 'Lose $' + Math.abs(net);
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 250, resultMsg, { color: '#f44', size: 24 });
        _host.screenShake.trigger(6, 300);
      }
    } else {
      resultMsg = 'Push (break even)';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 250, 'Push', { color: '#ff8', size: 22 });
    }

    resultDetail = details.join('  |  ');

    finishRound();
  }

  function finishRound() {
    roundOver = true;
    if (score <= 0) {
      score = 0;
      gameOver = true;
      resultMsg = 'GAME OVER';
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
    if (_host) _host.onScoreChanged(score);
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupThreeCard() {
    deck = createFreshDeck();
    playerHand = [];
    dealerHand = [];
    phase = PHASE_BETTING;
    anteBet = 0;
    pairPlusBet = 0;
    selectedChip = 10;
    betTarget = null;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    resultDetail = '';
    dealStep = 0;
    dealTimer = 0;
    revealStep = 0;
    revealTimer = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawThreeCard() {
    /* ── Title ── */
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Three Card Poker', CANVAS_W / 2, 35);

    /* ── Chips display (top right) ── */
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Chips: $' + score, CANVAS_W - 40, 60);

    /* ── Hand labels ── */
    _ctx.fillStyle = '#cdf';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Dealer', CANVAS_W / 2, DEALER_HAND_Y - 20);
    _ctx.fillText('Player', CANVAS_W / 2, PLAYER_HAND_Y - 20);

    /* ── Dealer hand ── */
    drawHand(dealerHand, DEALER_HAND_Y, true);

    /* ── Player hand ── */
    drawHand(playerHand, PLAYER_HAND_Y, false);

    /* ── Hand rank labels (when visible) ── */
    if (playerHand.length === 3 && phase !== PHASE_BETTING && phase !== PHASE_DEALING) {
      const pRank = evaluateHand(playerHand);
      _ctx.fillStyle = '#afa';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(HAND_NAMES[pRank], CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H + 20);
    }

    if (dealerHand.length === 3 && dealerHand[0].faceUp) {
      const dRank = evaluateHand(dealerHand);
      const qualifies = dealerQualifies(dealerHand);
      _ctx.fillStyle = qualifies ? '#faa' : '#888';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(
        HAND_NAMES[dRank] + (qualifies ? '' : ' (Does not qualify)'),
        CANVAS_W / 2, DEALER_HAND_Y + CE.CARD_H + 20
      );
    }

    /* ── Result text ── */
    if (resultMsg) {
      _ctx.fillStyle = '#ff8';
      _ctx.font = 'bold 18px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultMsg, CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H + 45);
    }
    if (resultDetail) {
      _ctx.fillStyle = '#ccc';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultDetail, CANVAS_W / 2, PLAYER_HAND_Y + CE.CARD_H + 63);
    }

    /* ── Betting area / action buttons ── */
    drawBettingArea();
    drawActionButtons();
  }

  function drawHand(hand, y, isDealer) {
    if (hand.length === 0) {
      for (let i = 0; i < 3; ++i)
        CE.drawEmptySlot(_ctx, handCardX(i), y);
      return;
    }

    for (let i = 0; i < hand.length; ++i) {
      if (hand[i]._dealing) continue;
      if (hand[i].faceUp)
        CE.drawCardFace(_ctx, handCardX(i), y, hand[i]);
      else
        CE.drawCardBack(_ctx, handCardX(i), y);
    }
  }

  function drawBettingArea() {
    const zones = [
      { target: 'ante',     label: 'Ante',       amount: anteBet,     idx: 0 },
      { target: 'pairplus', label: 'Pair Plus',   amount: pairPlusBet, idx: 1 }
    ];

    for (const z of zones) {
      const zx = betZoneX(z.idx);
      const selected = z.amount > 0;
      const bg = selected ? 'rgba(255,200,0,0.25)' : 'rgba(255,255,255,0.08)';
      const border = selected ? '#fa0' : 'rgba(255,255,255,0.3)';

      CE.drawRoundedRect(_ctx, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, 8);
      _ctx.fillStyle = bg;
      _ctx.fill();
      _ctx.strokeStyle = border;
      _ctx.lineWidth = selected ? 2.5 : 1.5;
      _ctx.stroke();

      _ctx.fillStyle = selected ? '#fc0' : '#ccc';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(z.label, zx + BET_ZONE_W / 2, BET_ZONE_Y + 20);

      if (z.amount > 0) {
        _ctx.fillStyle = '#fc0';
        _ctx.font = 'bold 12px sans-serif';
        _ctx.fillText('$' + z.amount, zx + BET_ZONE_W / 2, BET_ZONE_Y + 40);
      } else {
        _ctx.fillStyle = '#777';
        _ctx.font = '11px sans-serif';
        _ctx.fillText(z.target === 'ante' ? 'Required' : 'Optional', zx + BET_ZONE_W / 2, BET_ZONE_Y + 40);
      }

      /* ── Hint glow on ante zone if hints enabled and no ante placed ── */
      if (_host && _host.hintsEnabled && phase === PHASE_BETTING && z.target === 'ante' && anteBet === 0)
        CE.drawHintGlow(_ctx, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, _host.hintTime);
    }

    /* ── Chip selector buttons (only during betting) ── */
    if (phase === PHASE_BETTING) {
      for (let i = 0; i < CHIPS.length; ++i) {
        const cx = chipBtnX(i);
        const isSelected = selectedChip === CHIPS[i];
        const bg = CHIP_COLORS[CHIPS[i]];
        const border = isSelected ? '#fc0' : '#888';
        CE.drawButton(_ctx, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H, '$' + CHIPS[i], { bg, border, fontSize: 12 });
        if (isSelected) {
          _ctx.strokeStyle = '#fc0';
          _ctx.lineWidth = 2;
          CE.drawRoundedRect(_ctx, cx - 2, CHIP_BTN_Y - 2, CHIP_BTN_W + 4, CHIP_BTN_H + 4, 8);
          _ctx.stroke();
        }
      }

      /* ── Deal button ── */
      const canDeal = anteBet > 0;
      CE.drawButton(
        _ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
        'Deal (D)',
        { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
      );

      /* ── Clear button ── */
      if (anteBet > 0 || pairPlusBet > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        CE.drawButton(_ctx, clearX, DEAL_BTN.y, 70, DEAL_BTN.h, 'Clear', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });
      }

      /* ── Instructions ── */
      if (anteBet === 0) {
        _ctx.fillStyle = '#888';
        _ctx.font = '13px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText('Place an Ante bet to start. Pair Plus is optional.', CANVAS_W / 2, BET_ZONE_Y - 12);
      }
    }
  }

  function drawActionButtons() {
    if (phase !== PHASE_DECISION) return;

    const playHint = _host && _host.hintsEnabled && shouldPlay(playerHand);
    const foldHint = _host && _host.hintsEnabled && !shouldPlay(playerHand);

    /* ── Play button ── */
    CE.drawButton(
      _ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h,
      'Play $' + anteBet + ' (P)',
      { bg: '#2a5a2a', border: '#6c6', fontSize: 14 }
    );

    if (playHint)
      CE.drawHintGlow(_ctx, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h, _host.hintTime);

    /* ── Fold button ── */
    CE.drawButton(
      _ctx, FOLD_BTN.x, FOLD_BTN.y, FOLD_BTN.w, FOLD_BTN.h,
      'Fold (F)',
      { bg: '#5a2a2a', border: '#c66', fontSize: 14 }
    );

    if (foldHint)
      CE.drawHintGlow(_ctx, FOLD_BTN.x, FOLD_BTN.y, FOLD_BTN.w, FOLD_BTN.h, _host.hintTime);

    /* ── Instruction text ── */
    _ctx.fillStyle = '#aaa';
    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Play matches your Ante. Fold forfeits Ante & Pair Plus.', CANVAS_W / 2, PLAY_BTN.y + PLAY_BTN.h + 22);
  }

  /* ══════════════════════════════════════════════════════════════════
     PAYOUT TABLE OVERLAY (drawn in betting phase)
     ══════════════════════════════════════════════════════════════════ */

  function drawPayoutTable() {
    const px = 20;
    const py = 65;

    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(_ctx, px, py, 180, 155, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fc0';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('PAIR PLUS PAYOUTS', px + 10, py + 16);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    const ppLines = [
      ['Straight Flush', '40 : 1'],
      ['Three of a Kind', '30 : 1'],
      ['Straight', '6 : 1'],
      ['Flush', '3 : 1'],
      ['Pair', '1 : 1']
    ];
    for (let i = 0; i < ppLines.length; ++i) {
      _ctx.textAlign = 'left';
      _ctx.fillText(ppLines[i][0], px + 10, py + 34 + i * 15);
      _ctx.textAlign = 'right';
      _ctx.fillText(ppLines[i][1], px + 170, py + 34 + i * 15);
    }

    _ctx.fillStyle = '#fc0';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('ANTE BONUS', px + 10, py + 114);

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    const abLines = [
      ['Straight Flush', '5 : 1'],
      ['Three of a Kind', '4 : 1'],
      ['Straight', '1 : 1']
    ];
    for (let i = 0; i < abLines.length; ++i) {
      _ctx.textAlign = 'left';
      _ctx.fillText(abLines[i][0], px + 10, py + 130 + i * 15);
      _ctx.textAlign = 'right';
      _ctx.fillText(abLines[i][1], px + 170, py + 130 + i * 15);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleClick(mx, my) {
    if (roundOver || gameOver) {
      if (_host) _host.onRoundOver(gameOver);
      return;
    }

    if (phase === PHASE_BETTING) {
      /* ── Bet zone clicks ── */
      const targets = ['ante', 'pairplus'];
      for (let i = 0; i < 2; ++i) {
        const zx = betZoneX(i);
        if (CE.isInRect(mx, my, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H)) {
          placeBet(targets[i]);
          return;
        }
      }

      /* ── Chip selector clicks ── */
      for (let i = 0; i < CHIPS.length; ++i) {
        const cx = chipBtnX(i);
        if (CE.isInRect(mx, my, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H)) {
          selectedChip = CHIPS[i];
          return;
        }
      }

      /* ── Deal button ── */
      if (CE.isInRect(mx, my, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h)) {
        startDeal();
        return;
      }

      /* ── Clear button ── */
      if (anteBet > 0 || pairPlusBet > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        if (CE.isInRect(mx, my, clearX, DEAL_BTN.y, 70, DEAL_BTN.h)) {
          clearBets();
          return;
        }
      }
      return;
    }

    if (phase === PHASE_DECISION) {
      if (CE.isInRect(mx, my, PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h)) {
        doPlay();
        return;
      }
      if (CE.isInRect(mx, my, FOLD_BTN.x, FOLD_BTN.y, FOLD_BTN.w, FOLD_BTN.h)) {
        doFold();
        return;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     KEY HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleKey(e) {
    if (roundOver || gameOver) return;
    const k = e.key.toLowerCase();

    if (phase === PHASE_BETTING) {
      if (k === 'd') startDeal();
      else if (k === '1') selectedChip = 10;
      else if (k === '2') selectedChip = 25;
      else if (k === '3') selectedChip = 50;
      else if (k === '4') selectedChip = 100;
      else if (k === 'a') placeBet('ante');
      else if (k === 's') placeBet('pairplus');
      else if (k === 'c') clearBets();
      return;
    }

    if (phase === PHASE_DECISION) {
      if (k === 'p') doPlay();
      else if (k === 'f') doFold();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TICK (animation timing)
     ══════════════════════════════════════════════════════════════════ */

  function tick(dt) {
    if (phase === PHASE_DEALING) {
      dealTimer += dt;
      if (dealTimer >= 0.3) {
        dealTimer = 0;
        dealNextCard();
        if (dealStep >= 6)
          finishDealing();
      }
      return;
    }

    if (phase === PHASE_REVEAL) {
      revealTimer += dt;
      if (revealStep === 0 && revealTimer >= 0.4) {
        // Reveal dealer cards
        revealDealerCards();
        ++revealStep;
        revealTimer = 0;
        return;
      }
      if (revealStep === 1 && revealTimer >= 0.6) {
        // Resolve after brief pause
        resolveRound();
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 1000;
      if (score <= 0) score = 1000;
      setupThreeCard();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawThreeCard();
      drawPayoutTable();
    },

    handleClick(mx, my) {
      handleClick(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      handleKey(e);
    },

    tick(dt) {
      tick(dt);
    },

    cleanup() {
      playerHand = [];
      dealerHand = [];
      deck = [];
      phase = PHASE_BETTING;
      anteBet = 0;
      pairPlusBet = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      resultDetail = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('threecard', module);

})();
