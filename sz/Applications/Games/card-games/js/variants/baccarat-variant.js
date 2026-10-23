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
  const PHASE_DRAWING = 'DRAWING';
  const PHASE_RESULT = 'RESULT';

  /* ── Bet targets ── */
  const BET_PLAYER = 'player';
  const BET_BANKER = 'banker';
  const BET_TIE = 'tie';

  /* ── Chip denominations ── */
  const CHIPS = [10, 25, 50, 100];
  const CHIP_COLORS = { 10: '#2266cc', 25: '#22aa44', 50: '#cc4422', 100: '#222222' };

  /* ── Layout constants ── */
  const HAND_Y = 200;
  const PLAYER_HAND_X = 180;
  const BANKER_HAND_X = 530;
  const CARD_GAP = 12;
  const BET_ZONE_Y = 430;
  const BET_ZONE_W = 140;
  const BET_ZONE_H = 60;
  const BET_ZONE_GAP = 30;
  const CHIP_BTN_Y = 510;
  const CHIP_BTN_W = 50;
  const CHIP_BTN_H = 34;
  const CHIP_BTN_GAP = 12;
  const DEAL_BTN = { x: CANVAS_W / 2 - 50, y: 560, w: 100, h: 32 };

  /* ── Game state ── */
  let shoe = [];
  let playerHand = [];
  let bankerHand = [];
  let phase = PHASE_BETTING;
  let betTarget = null;
  let betAmount = 0;
  let selectedChip = 10;
  let score = 1000;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let dealTimer = 0;
  let dealStep = 0;
  let drawTimer = 0;
  let drawStep = 0;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     SHOE MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function createShoe() {
    const cards = [];
    for (let d = 0; d < 8; ++d) {
      const deck = CE.createDeck();
      for (const c of deck)
        cards.push(c);
    }
    return CE.shuffle(cards);
  }

  function drawFromShoe() {
    if (shoe.length < 6)
      shoe = createShoe();
    return shoe.pop();
  }

  /* ══════════════════════════════════════════════════════════════════
     BACCARAT CARD / HAND VALUES
     ══════════════════════════════════════════════════════════════════ */

  function cardValue(card) {
    if (card.rank === 'A') return 1;
    const n = parseInt(card.rank, 10);
    if (!isNaN(n)) return n <= 9 ? n : 0;
    return 0; // J, Q, K
  }

  function handTotal(hand) {
    let sum = 0;
    for (const c of hand)
      sum += cardValue(c);
    return sum % 10;
  }

  /* ══════════════════════════════════════════════════════════════════
     THIRD-CARD RULES
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawsThird(total) {
    return total <= 5;
  }

  function bankerDrawsThird(bankerTotal, playerThirdValue) {
    if (playerThirdValue === null)
      return bankerTotal <= 5;
    if (bankerTotal <= 2) return true;
    if (bankerTotal === 3) return playerThirdValue !== 8;
    if (bankerTotal === 4) return playerThirdValue >= 2 && playerThirdValue <= 7;
    if (bankerTotal === 5) return playerThirdValue >= 4 && playerThirdValue <= 7;
    if (bankerTotal === 6) return playerThirdValue === 6 || playerThirdValue === 7;
    return false; // 7 stands
  }

  /* ══════════════════════════════════════════════════════════════════
     BET ZONE POSITIONS
     ══════════════════════════════════════════════════════════════════ */

  function betZoneX(index) {
    const totalW = 3 * BET_ZONE_W + 2 * BET_ZONE_GAP;
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
    if (betTarget && betTarget !== target) {
      betAmount = 0;
    }
    betTarget = target;
    betAmount += selectedChip;
    if (betAmount > score)
      betAmount = score;
  }

  function clearBet() {
    betTarget = null;
    betAmount = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     DEALING & GAME FLOW
     ══════════════════════════════════════════════════════════════════ */

  function startDeal() {
    if (phase !== PHASE_BETTING || !betTarget || betAmount <= 0) return;
    phase = PHASE_DEALING;
    playerHand = [];
    bankerHand = [];
    resultMsg = '';
    dealStep = 0;
    dealTimer = 0;
  }

  function dealNextCard() {
    const card = drawFromShoe();
    card.faceUp = true;
    const isPlayer = dealStep % 2 === 0;
    const hand = isPlayer ? playerHand : bankerHand;
    hand.push(card);
    const baseX = isPlayer ? PLAYER_HAND_X : BANKER_HAND_X;
    const idx = hand.length - 1;
    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, baseX + idx * (CE.CARD_W + CARD_GAP), HAND_Y, 0);
    ++dealStep;
  }

  function checkNaturalOrDraw() {
    const pTotal = handTotal(playerHand);
    const bTotal = handTotal(bankerHand);

    // Natural
    if (pTotal >= 8 || bTotal >= 8) {
      resolveRound();
      return;
    }

    phase = PHASE_DRAWING;
    drawStep = 0;
    drawTimer = 0;
  }

  function applyThirdCards() {
    const pTotal = handTotal(playerHand);
    const bTotal = handTotal(bankerHand);
    let playerThirdVal = null;

    // Player third card
    if (drawStep === 0) {
      if (playerDrawsThird(pTotal)) {
        const card = drawFromShoe();
        card.faceUp = true;
        playerHand.push(card);
        playerThirdVal = cardValue(card);
        if (_host)
          _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, PLAYER_HAND_X + 2 * (CE.CARD_W + CARD_GAP), HAND_Y, 0);
        ++drawStep;
        return; // wait for next tick for banker
      }
      ++drawStep; // skip player draw, go to banker
    }

    // Banker third card
    if (drawStep === 1) {
      if (playerHand.length === 3)
        playerThirdVal = cardValue(playerHand[2]);
      if (bankerDrawsThird(bTotal, playerThirdVal)) {
        const card = drawFromShoe();
        card.faceUp = true;
        bankerHand.push(card);
        if (_host)
          _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, BANKER_HAND_X + 2 * (CE.CARD_W + CARD_GAP), HAND_Y, 0);
      }
      ++drawStep;
      return;
    }

    resolveRound();
  }

  /* ══════════════════════════════════════════════════════════════════
     RESULT
     ══════════════════════════════════════════════════════════════════ */

  function resolveRound() {
    phase = PHASE_RESULT;
    const pTotal = handTotal(playerHand);
    const bTotal = handTotal(bankerHand);

    let winner;
    if (pTotal > bTotal)
      winner = BET_PLAYER;
    else if (bTotal > pTotal)
      winner = BET_BANKER;
    else
      winner = BET_TIE;

    let payout = 0;
    if (winner === betTarget) {
      if (betTarget === BET_PLAYER)
        payout = betAmount;
      else if (betTarget === BET_BANKER)
        payout = Math.floor(betAmount * 0.95);
      else
        payout = betAmount * 8;
      score += payout;
      resultMsg = winnerLabel(winner) + ' wins! +' + payout;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 170, resultMsg, { color: '#4f4', size: 24 });
        _host.addGlow(
          winner === BET_BANKER ? BANKER_HAND_X : PLAYER_HAND_X,
          HAND_Y,
          (winner === BET_TIE ? 3 : Math.max(playerHand.length, bankerHand.length)) * (CE.CARD_W + CARD_GAP),
          CE.CARD_H, 2.0
        );
        _host.triggerChipSparkle(CANVAS_W / 2, BET_ZONE_Y);
        _host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      score -= betAmount;
      resultMsg = winnerLabel(winner) + ' wins. -' + betAmount;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 170, resultMsg, { color: '#f44', size: 24 });
        _host.screenShake.trigger(6, 300);
      }
    }

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

  function winnerLabel(w) {
    if (w === BET_PLAYER) return 'Player';
    if (w === BET_BANKER) return 'Banker';
    return 'Tie';
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupBaccarat() {
    if (shoe.length < 52)
      shoe = createShoe();
    playerHand = [];
    bankerHand = [];
    phase = PHASE_BETTING;
    betTarget = null;
    betAmount = 0;
    selectedChip = 10;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    dealStep = 0;
    dealTimer = 0;
    drawStep = 0;
    drawTimer = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawBaccarat() {
    // Title
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Baccarat', CANVAS_W / 2, 35);

    // Shoe count & chips (top right)
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Chips: ' + score, CANVAS_W - 40, 60);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Shoe: ' + shoe.length, CANVAS_W - 40, 78);

    // Hand labels
    _ctx.fillStyle = '#cdf';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Player', PLAYER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y - 20);
    _ctx.fillText('Banker', BANKER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y - 20);

    // Player hand
    if (playerHand.length > 0) {
      for (let i = 0; i < playerHand.length; ++i) {
        if (playerHand[i]._dealing) continue;
        CE.drawCardFace(_ctx, PLAYER_HAND_X + i * (CE.CARD_W + CARD_GAP), HAND_Y, playerHand[i]);
      }
      const pTotal = handTotal(playerHand);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 18px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('' + pTotal, PLAYER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y + CE.CARD_H + 24);
    } else {
      CE.drawEmptySlot(_ctx, PLAYER_HAND_X, HAND_Y);
      CE.drawEmptySlot(_ctx, PLAYER_HAND_X + CE.CARD_W + CARD_GAP, HAND_Y);
    }

    // Banker hand
    if (bankerHand.length > 0) {
      for (let i = 0; i < bankerHand.length; ++i) {
        if (bankerHand[i]._dealing) continue;
        CE.drawCardFace(_ctx, BANKER_HAND_X + i * (CE.CARD_W + CARD_GAP), HAND_Y, bankerHand[i]);
      }
      const bTotal = handTotal(bankerHand);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 18px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('' + bTotal, BANKER_HAND_X + CE.CARD_W + CARD_GAP / 2, HAND_Y + CE.CARD_H + 24);
    } else {
      CE.drawEmptySlot(_ctx, BANKER_HAND_X, HAND_Y);
      CE.drawEmptySlot(_ctx, BANKER_HAND_X + CE.CARD_W + CARD_GAP, HAND_Y);
    }

    // Result text
    if (resultMsg) {
      _ctx.fillStyle = '#ff8';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultMsg, CANVAS_W / 2, HAND_Y + CE.CARD_H + 55);
    }

    // Betting area
    drawBettingArea();
  }

  function drawBettingArea() {
    const zones = [
      { target: BET_PLAYER, label: 'Player\n1 : 1', idx: 0 },
      { target: BET_TIE,    label: 'Tie\n8 : 1',    idx: 1 },
      { target: BET_BANKER, label: 'Banker\n1:1 -5%', idx: 2 }
    ];

    for (const z of zones) {
      const zx = betZoneX(z.idx);
      const selected = betTarget === z.target && betAmount > 0;
      const bg = selected ? 'rgba(255,200,0,0.25)' : 'rgba(255,255,255,0.08)';
      const border = selected ? '#fa0' : 'rgba(255,255,255,0.3)';

      CE.drawRoundedRect(_ctx, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H, 8);
      _ctx.fillStyle = bg;
      _ctx.fill();
      _ctx.strokeStyle = border;
      _ctx.lineWidth = selected ? 2.5 : 1.5;
      _ctx.stroke();

      const lines = z.label.split('\n');
      _ctx.fillStyle = selected ? '#fc0' : '#ccc';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(lines[0], zx + BET_ZONE_W / 2, BET_ZONE_Y + 22);
      _ctx.font = '11px sans-serif';
      _ctx.fillStyle = selected ? '#da0' : '#999';
      _ctx.fillText(lines[1], zx + BET_ZONE_W / 2, BET_ZONE_Y + 40);

      if (selected) {
        _ctx.fillStyle = '#fc0';
        _ctx.font = 'bold 12px sans-serif';
        _ctx.fillText('$' + betAmount, zx + BET_ZONE_W / 2, BET_ZONE_Y + 55);
      }
    }

    // Chip selector buttons
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

      // Deal button
      const canDeal = betTarget && betAmount > 0;
      CE.drawButton(
        _ctx, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h,
        'Deal (D)',
        { bg: canDeal ? '#2a5a2a' : '#333', border: canDeal ? '#6c6' : '#555', fontSize: 14 }
      );

      // Clear button
      if (betAmount > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        CE.drawButton(_ctx, clearX, DEAL_BTN.y, 70, DEAL_BTN.h, 'Clear', { bg: '#5a2a2a', border: '#c66', fontSize: 12 });
      }
    }

    // Instructions during betting
    if (phase === PHASE_BETTING && !betTarget) {
      _ctx.fillStyle = '#888';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click a bet zone, then Deal', CANVAS_W / 2, BET_ZONE_Y - 12);
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
      // Bet zone clicks
      const targets = [BET_PLAYER, BET_TIE, BET_BANKER];
      for (let i = 0; i < 3; ++i) {
        const zx = betZoneX(i);
        if (CE.isInRect(mx, my, zx, BET_ZONE_Y, BET_ZONE_W, BET_ZONE_H)) {
          placeBet(targets[i]);
          return;
        }
      }

      // Chip selector clicks
      for (let i = 0; i < CHIPS.length; ++i) {
        const cx = chipBtnX(i);
        if (CE.isInRect(mx, my, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H)) {
          selectedChip = CHIPS[i];
          return;
        }
      }

      // Deal button
      if (CE.isInRect(mx, my, DEAL_BTN.x, DEAL_BTN.y, DEAL_BTN.w, DEAL_BTN.h)) {
        startDeal();
        return;
      }

      // Clear button
      if (betAmount > 0) {
        const clearX = DEAL_BTN.x + DEAL_BTN.w + 15;
        if (CE.isInRect(mx, my, clearX, DEAL_BTN.y, 70, DEAL_BTN.h)) {
          clearBet();
          return;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TICK (animation timing)
     ══════════════════════════════════════════════════════════════════ */

  function tick(dt) {
    if (phase === PHASE_DEALING) {
      dealTimer += dt;
      if (dealTimer >= 0.35) {
        dealTimer = 0;
        dealNextCard();
        if (dealStep >= 4)
          checkNaturalOrDraw();
      }
      return;
    }

    if (phase === PHASE_DRAWING) {
      drawTimer += dt;
      if (drawTimer >= 0.5) {
        drawTimer = 0;
        applyThirdCards();
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
      setupBaccarat();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawBaccarat();
    },

    handleClick(mx, my) {
      handleClick(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      const k = e.key.toLowerCase();
      if (k === 'd') startDeal();
      else if (k === '1') { selectedChip = 10; }
      else if (k === '2') { selectedChip = 25; }
      else if (k === '3') { selectedChip = 50; }
      else if (k === '4') { selectedChip = 100; }
      else if (k === 'p') placeBet(BET_PLAYER);
      else if (k === 'b') placeBet(BET_BANKER);
      else if (k === 't') placeBet(BET_TIE);
      else if (k === 'c') clearBet();
    },

    tick(dt) {
      tick(dt);
    },

    cleanup() {
      playerHand = [];
      bankerHand = [];
      shoe = [];
      phase = PHASE_BETTING;
      betTarget = null;
      betAmount = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('baccarat', module);

})();
