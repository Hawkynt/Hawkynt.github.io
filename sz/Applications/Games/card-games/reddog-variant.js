;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CE = SZ.CardEngine;
  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Phases ── */
  const PHASE_BET = 'BET';
  const PHASE_SHOW_POSTS = 'SHOW_POSTS';
  const PHASE_RESULT = 'RESULT';

  /* ── Chip denominations ── */
  const CHIPS = [10, 25, 50, 100];
  const CHIP_COLORS = { 10: '#2266cc', 25: '#22aa44', 50: '#cc4422', 100: '#222222' };

  /* ── Layout constants ── */
  const POST_Y = 180;
  const LEFT_POST_X = 250;
  const RIGHT_POST_X = 550;
  const MIDDLE_CARD_X = 400;
  const MIDDLE_CARD_Y = 180;
  const CARD_GAP = 12;
  const CHIP_BTN_Y = 500;
  const CHIP_BTN_W = 50;
  const CHIP_BTN_H = 34;
  const CHIP_BTN_GAP = 12;
  const DEAL_BTN = { x: CANVAS_W / 2 - 50, y: 555, w: 100, h: 32 };
  const RAISE_BTN = { x: CANVAS_W / 2 - 130, y: 460, w: 110, h: 36 };
  const CALL_BTN = { x: CANVAS_W / 2 + 20, y: 460, w: 110, h: 36 };

  /* ── Game state ── */
  let deck = [];
  let postCards = [];     // the two "post" cards dealt face-up
  let middleCard = null;  // the third card drawn
  let phase = PHASE_BET;
  let betAmount = 0;
  let selectedChip = 10;
  let raisedBet = 0;      // additional raise amount (0 if just called)
  let spread = 0;
  let payoutMultiplier = 0;
  let score = 500;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let showTimer = 0;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ══════════════════════════════════════════════════════════════════
     RANK HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function rankIndex(card) {
    return card.value;
  }

  // Ensure low <= high; returns [lowCard, highCard]
  function orderPosts(a, b) {
    return rankIndex(a) <= rankIndex(b) ? [a, b] : [b, a];
  }

  function computeSpread(low, high) {
    return rankIndex(high) - rankIndex(low) - 1;
  }

  function payoutForSpread(s) {
    if (s === 1) return 5;
    if (s === 2) return 4;
    if (s === 3) return 2;
    if (s >= 4) return 1;
    return 0;
  }

  // Win probability = spread / remaining-cards-that-could-appear
  // With a single deck of 52 cards, 2 are dealt as posts, 50 remain.
  // Exactly `spread * 4` cards fall strictly between the posts,
  // minus any suits where the boundary ranks are used.
  function computeWinProbability(low, high, deckSize) {
    const s = computeSpread(low, high);
    if (s <= 0) return 0;
    // Number of ranks strictly between low and high
    // Each rank has 4 cards in a fresh deck, but 2 cards are already dealt.
    // Remaining = deckSize (cards left after drawing 2 posts).
    // Winning cards = s * 4 (each in-between rank has 4 suits in the original deck)
    // However both post cards are removed, so we need to check if any winning rank
    // shares a rank with a post card -- they don't, since they are strictly between.
    const winningCards = s * 4;
    return winningCards / deckSize;
  }

  /* ══════════════════════════════════════════════════════════════════
     BET MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function maxBet() {
    return Math.min(score, 100);
  }

  function adjustBet(amount) {
    if (phase !== PHASE_BET) return;
    betAmount = Math.max(10, Math.min(betAmount + amount, maxBet()));
  }

  function clearBet() {
    betAmount = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     CHIP BUTTON POSITIONS
     ══════════════════════════════════════════════════════════════════ */

  function chipBtnX(index) {
    const totalW = CHIPS.length * CHIP_BTN_W + (CHIPS.length - 1) * CHIP_BTN_GAP;
    return (CANVAS_W - totalW) / 2 + index * (CHIP_BTN_W + CHIP_BTN_GAP);
  }

  /* ══════════════════════════════════════════════════════════════════
     DEALING & GAME FLOW
     ══════════════════════════════════════════════════════════════════ */

  function startDeal() {
    if (phase !== PHASE_BET || betAmount < 10) return;
    if (betAmount > score) betAmount = score;

    // Reshuffle if low
    if (deck.length < 10)
      deck = CE.shuffle(CE.createDeck());

    postCards = [];
    middleCard = null;
    raisedBet = 0;
    resultMsg = '';
    showTimer = 0;

    // Draw two post cards
    const c1 = deck.pop();
    c1.faceUp = true;
    const c2 = deck.pop();
    c2.faceUp = true;

    const [low, high] = orderPosts(c1, c2);
    postCards = [low, high];

    if (_host) {
      _host.dealCardAnim(low, CANVAS_W / 2, -CE.CARD_H, LEFT_POST_X, POST_Y, 0);
      _host.dealCardAnim(high, CANVAS_W / 2, -CE.CARD_H, RIGHT_POST_X, POST_Y, 0.15);
    }

    spread = computeSpread(low, high);
    payoutMultiplier = payoutForSpread(spread);

    // Check for pair or consecutive immediately
    if (rankIndex(low) === rankIndex(high)) {
      // Pair: auto-draw third card
      phase = PHASE_SHOW_POSTS;
      showTimer = 0;
    } else if (spread === 0) {
      // Consecutive: push
      phase = PHASE_SHOW_POSTS;
      showTimer = 0;
    } else {
      // Normal spread: player decides to raise or call
      phase = PHASE_SHOW_POSTS;
      showTimer = 0;
    }
  }

  function playerCall() {
    if (phase !== PHASE_SHOW_POSTS) return;
    // Consecutive => auto-resolve as push
    if (spread === 0 && rankIndex(postCards[0]) !== rankIndex(postCards[1])) {
      resolvePush();
      return;
    }
    raisedBet = 0;
    drawMiddleCard();
  }

  function playerRaise() {
    if (phase !== PHASE_SHOW_POSTS) return;
    if (spread <= 0 && rankIndex(postCards[0]) !== rankIndex(postCards[1])) {
      resolvePush();
      return;
    }
    // Raise doubles the bet (up to what the player can afford)
    const raiseMax = Math.min(betAmount, score - betAmount);
    raisedBet = Math.max(0, raiseMax);
    drawMiddleCard();
  }

  function drawMiddleCard() {
    const card = deck.pop();
    card.faceUp = true;
    middleCard = card;

    if (_host)
      _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30, 0);

    resolveRound();
  }

  /* ══════════════════════════════════════════════════════════════════
     RESULT
     ══════════════════════════════════════════════════════════════════ */

  function resolvePush() {
    phase = PHASE_RESULT;
    roundOver = true;
    resultMsg = 'Consecutive - Push! Bet returned.';
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 350, 'PUSH', { color: '#ff8', size: 24 });
    if (_host) _host.onScoreChanged(score);
  }

  function resolveRound() {
    phase = PHASE_RESULT;
    roundOver = true;
    const totalBet = betAmount + raisedBet;
    const lowRank = rankIndex(postCards[0]);
    const highRank = rankIndex(postCards[1]);
    const midRank = rankIndex(middleCard);

    if (lowRank === highRank) {
      // Pair case
      if (midRank === lowRank) {
        // Three of a kind: 11:1 payout
        const payout = totalBet * 11;
        score += payout;
        resultMsg = 'Three of a kind! +' + payout;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 350, 'THREE OF A KIND! +' + payout, { color: '#4f4', size: 28 });
          _host.addGlow(LEFT_POST_X, POST_Y, RIGHT_POST_X + CE.CARD_W - LEFT_POST_X, CE.CARD_H, 2.0);
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
          _host.particles.confetti(CANVAS_W / 2, 300, 50);
        }
      } else {
        // Pair but no match: push
        resultMsg = 'Pair - Push! Bet returned.';
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 350, 'PUSH', { color: '#ff8', size: 24 });
      }
    } else if (midRank > lowRank && midRank < highRank) {
      // Win: card falls between the posts
      const payout = totalBet * payoutMultiplier;
      score += payout;
      resultMsg = 'Win! Spread ' + spread + ' pays ' + payoutMultiplier + ':1  +' + payout;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 350, 'WIN! +' + payout, { color: '#4f4', size: 28 });
        _host.addGlow(MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30, CE.CARD_W, CE.CARD_H, 2.0);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.particles.confetti(CANVAS_W / 2, 300, 30);
      }
    } else {
      // Lose: card outside the spread
      score -= totalBet;
      resultMsg = 'Lose! -' + totalBet;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 350, 'LOSE -' + totalBet, { color: '#f44', size: 24 });
        _host.screenShake.trigger(6, 300);
      }
    }

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

  function setupRedDog() {
    if (deck.length < 10)
      deck = CE.shuffle(CE.createDeck());
    postCards = [];
    middleCard = null;
    phase = PHASE_BET;
    betAmount = 10;
    selectedChip = 10;
    raisedBet = 0;
    spread = 0;
    payoutMultiplier = 0;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    showTimer = 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAW
     ══════════════════════════════════════════════════════════════════ */

  function drawRedDog() {
    // Title
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 22px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Red Dog (In-Between)', CANVAS_W / 2, 35);

    // Chips & deck count (top right)
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Chips: ' + score, CANVAS_W - 40, 60);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Deck: ' + deck.length, CANVAS_W - 40, 78);

    // Bet display (top left)
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Bet: ' + betAmount + (raisedBet > 0 ? ' + ' + raisedBet + ' raise' : ''), 40, 60);

    // Post card labels
    _ctx.fillStyle = '#cdf';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Low Post', LEFT_POST_X + CE.CARD_W / 2, POST_Y - 14);
    _ctx.fillText('High Post', RIGHT_POST_X + CE.CARD_W / 2, POST_Y - 14);

    // Draw post cards
    if (postCards.length === 2) {
      for (let i = 0; i < 2; ++i) {
        if (postCards[i]._dealing) continue;
        const x = i === 0 ? LEFT_POST_X : RIGHT_POST_X;
        CE.drawCardFace(_ctx, x, POST_Y, postCards[i]);
      }
    } else {
      CE.drawEmptySlot(_ctx, LEFT_POST_X, POST_Y);
      CE.drawEmptySlot(_ctx, RIGHT_POST_X, POST_Y);
    }

    // Middle card area
    _ctx.fillStyle = '#cdf';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Draw Card', MIDDLE_CARD_X + CE.CARD_W / 2, MIDDLE_CARD_Y + CE.CARD_H + 16);
    if (middleCard) {
      if (!middleCard._dealing)
        CE.drawCardFace(_ctx, MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30, middleCard);
    } else if (phase !== PHASE_BET) {
      CE.drawEmptySlot(_ctx, MIDDLE_CARD_X, MIDDLE_CARD_Y + CE.CARD_H + 30);
    }

    // Spread info
    if (phase === PHASE_SHOW_POSTS && postCards.length === 2) {
      const isPair = rankIndex(postCards[0]) === rankIndex(postCards[1]);
      const isConsecutive = !isPair && spread === 0;

      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 20px sans-serif';
      _ctx.textAlign = 'center';

      if (isPair) {
        _ctx.fillText('PAIR! Drawing third card...', CANVAS_W / 2, POST_Y + CE.CARD_H + 50);
        _ctx.fillStyle = '#aaf';
        _ctx.font = '14px sans-serif';
        _ctx.fillText('Match = 11:1 payout, No match = Push', CANVAS_W / 2, POST_Y + CE.CARD_H + 72);
      } else if (isConsecutive) {
        _ctx.fillText('CONSECUTIVE - Push!', CANVAS_W / 2, POST_Y + CE.CARD_H + 50);
      } else {
        _ctx.fillText('Spread: ' + spread + '  |  Payout: ' + payoutMultiplier + ':1', CANVAS_W / 2, POST_Y + CE.CARD_H + 50);

        // Win probability
        const prob = computeWinProbability(postCards[0], postCards[1], deck.length);
        const pct = (prob * 100).toFixed(1);
        _ctx.fillStyle = '#aaf';
        _ctx.font = '14px sans-serif';
        _ctx.fillText('Win chance: ' + pct + '%', CANVAS_W / 2, POST_Y + CE.CARD_H + 72);
      }

      // Hint display
      if (_host && _host.hintsEnabled && !isPair && !isConsecutive) {
        const prob = computeWinProbability(postCards[0], postCards[1], deck.length);
        const ev = prob * payoutMultiplier - (1 - prob);
        const recommendation = ev > 0 ? 'Raise recommended (EV+)' : 'Call recommended (EV-)';
        _ctx.fillStyle = '#8f8';
        _ctx.font = '13px sans-serif';
        _ctx.textAlign = 'center';
        if (_host.hintTime)
          CE.drawHintGlow(_ctx, CANVAS_W / 2 - 120, POST_Y + CE.CARD_H + 78, 240, 20, _host.hintTime);
        _ctx.fillText('Hint: EV=' + ev.toFixed(2) + ' | ' + recommendation, CANVAS_W / 2, POST_Y + CE.CARD_H + 92);
      }
    }

    // Result message
    if (resultMsg) {
      _ctx.fillStyle = '#ff8';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H - 30);
      if (roundOver && !gameOver) {
        _ctx.fillStyle = '#aaa';
        _ctx.font = '13px sans-serif';
        _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 10);
      }
    }

    // Action buttons for SHOW_POSTS phase (when there's a real spread to bet on)
    if (phase === PHASE_SHOW_POSTS && postCards.length === 2) {
      const isPair = rankIndex(postCards[0]) === rankIndex(postCards[1]);
      const isConsecutive = !isPair && spread === 0;

      if (isPair) {
        // Auto-draw for pair: show a single "Draw" button
        CE.drawButton(_ctx, CANVAS_W / 2 - 55, 460, 110, 36, 'Draw (D)', { bg: '#2a5a2a', border: '#6c6' });
      } else if (isConsecutive) {
        // Consecutive: just a continue button
        CE.drawButton(_ctx, CANVAS_W / 2 - 55, 460, 110, 36, 'Continue', { bg: '#555', border: '#888' });
      } else {
        // Normal spread: raise or call
        const canRaise = score > betAmount;
        CE.drawButton(_ctx, RAISE_BTN.x, RAISE_BTN.y, RAISE_BTN.w, RAISE_BTN.h, 'Raise (R)', {
          bg: canRaise ? '#2a5a2a' : '#333',
          border: canRaise ? '#6c6' : '#555'
        });
        CE.drawButton(_ctx, CALL_BTN.x, CALL_BTN.y, CALL_BTN.w, CALL_BTN.h, 'Call (C)', { bg: '#5a5a2a', border: '#cc6' });
      }
    }

    // Betting area
    if (phase === PHASE_BET)
      drawBettingArea();
  }

  function drawBettingArea() {
    // Payout table
    _ctx.fillStyle = '#ccc';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Payout Table', CANVAS_W / 2, 110);

    const payouts = [
      ['Spread 1', '5 : 1'],
      ['Spread 2', '4 : 1'],
      ['Spread 3', '2 : 1'],
      ['Spread 4+', '1 : 1'],
      ['Pair + Match', '11 : 1'],
      ['Consecutive / Pair', 'Push']
    ];

    _ctx.font = '12px monospace';
    for (let i = 0; i < payouts.length; ++i) {
      const y = 132 + i * 18;
      _ctx.fillStyle = '#aaa';
      _ctx.textAlign = 'right';
      _ctx.fillText(payouts[i][0], CANVAS_W / 2 - 10, y);
      _ctx.fillStyle = '#fc0';
      _ctx.textAlign = 'left';
      _ctx.fillText(payouts[i][1], CANVAS_W / 2 + 10, y);
    }

    // Bet amount display
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Bet: $' + betAmount, CANVAS_W / 2, 270);
    _ctx.fillStyle = '#888';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('Min: 10  |  Max: ' + maxBet(), CANVAS_W / 2, 290);

    // Chip selector buttons
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

    // + / - bet buttons
    const minusBtnX = CANVAS_W / 2 - 120;
    const plusBtnX = CANVAS_W / 2 + 70;
    CE.drawButton(_ctx, minusBtnX, 310, 50, 30, '-', { bg: '#5a2a2a', border: '#c66', fontSize: 16 });
    CE.drawButton(_ctx, plusBtnX, 310, 50, 30, '+', { bg: '#2a5a2a', border: '#6c6', fontSize: 16 });

    // Deal button
    const canDeal = betAmount >= 10 && betAmount <= score;
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

    // Instructions
    _ctx.fillStyle = '#888';
    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Set your bet, then Deal', CANVAS_W / 2, 370);
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleClick(mx, my) {
    if (roundOver || gameOver) {
      if (_host) _host.onRoundOver(gameOver);
      return;
    }

    if (phase === PHASE_BET) {
      // Chip selector clicks
      for (let i = 0; i < CHIPS.length; ++i) {
        const cx = chipBtnX(i);
        if (CE.isInRect(mx, my, cx, CHIP_BTN_Y, CHIP_BTN_W, CHIP_BTN_H)) {
          selectedChip = CHIPS[i];
          adjustBet(0); // clamp if needed
          return;
        }
      }

      // +/- buttons
      const minusBtnX = CANVAS_W / 2 - 120;
      const plusBtnX = CANVAS_W / 2 + 70;
      if (CE.isInRect(mx, my, minusBtnX, 310, 50, 30)) {
        adjustBet(-selectedChip);
        return;
      }
      if (CE.isInRect(mx, my, plusBtnX, 310, 50, 30)) {
        adjustBet(selectedChip);
        return;
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
          betAmount = 10; // reset to minimum
          return;
        }
      }
      return;
    }

    if (phase === PHASE_SHOW_POSTS) {
      const isPair = rankIndex(postCards[0]) === rankIndex(postCards[1]);
      const isConsecutive = !isPair && spread === 0;

      if (isPair) {
        // Draw button
        if (CE.isInRect(mx, my, CANVAS_W / 2 - 55, 460, 110, 36)) {
          playerCall();
          return;
        }
      } else if (isConsecutive) {
        // Continue button
        if (CE.isInRect(mx, my, CANVAS_W / 2 - 55, 460, 110, 36)) {
          playerCall();
          return;
        }
      } else {
        // Raise button
        if (CE.isInRect(mx, my, RAISE_BTN.x, RAISE_BTN.y, RAISE_BTN.w, RAISE_BTN.h)) {
          playerRaise();
          return;
        }
        // Call button
        if (CE.isInRect(mx, my, CALL_BTN.x, CALL_BTN.y, CALL_BTN.w, CALL_BTN.h)) {
          playerCall();
          return;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TICK
     ══════════════════════════════════════════════════════════════════ */

  function tick(dt) {
    // Pair/consecutive auto-handling with a short delay for visual feedback
    // (handled by button click instead for better UX)
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 500;
      if (score <= 0) score = 500;
      setupRedDog();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawRedDog();
    },

    handleClick(mx, my) {
      handleClick(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      const k = e.key.toLowerCase();
      if (phase === PHASE_BET) {
        if (k === 'd') startDeal();
        else if (k === '1') selectedChip = 10;
        else if (k === '2') selectedChip = 25;
        else if (k === '3') selectedChip = 50;
        else if (k === '4') selectedChip = 100;
        else if (k === '+' || k === '=') adjustBet(selectedChip);
        else if (k === '-') adjustBet(-selectedChip);
        else if (k === 'c') { clearBet(); betAmount = 10; }
      } else if (phase === PHASE_SHOW_POSTS) {
        if (k === 'r') playerRaise();
        else if (k === 'c' || k === 'd') playerCall();
      }
    },

    tick(dt) {
      tick(dt);
    },

    cleanup() {
      postCards = [];
      middleCard = null;
      deck = [];
      phase = PHASE_BET;
      betAmount = 0;
      raisedBet = 0;
      spread = 0;
      payoutMultiplier = 0;
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

  SZ.CardGames.registerVariant('reddog', module);

})();
