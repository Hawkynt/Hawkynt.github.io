;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* -- Game state -- */
  const unoColors = ['red', 'blue', 'green', 'yellow'];
  let unoTopCard = null;
  let unoDirection = 1;
  let unoCurrentPlayer = 0;
  let unoHands = [];
  let unoDeck = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let waitingForColorChoice = false;
  let pendingWildCard = null;
  let pendingWildPlayer = -1;
  let drawStack = 0;

  /* -- House rules -- */
  let houseRules = {
    stackPlus4: false,
    stackPlus2OnPlus4: false,
    stackPlus2: false,
    wildOnWild: true,
    showRulesOnStart: false,
    noMercy: false,
    zeroRotate: false,
    sevenSwap: false,
    jumpIn: false,
  };

  /* -- Seven-swap overlay state -- */
  let waitingForSwapChoice = false;
  let swapChoicePlayer = -1;
  const swapChoiceRects = [];

  /* -- Host references -- */
  let _ctx = null;
  let _host = null;

  /* -- AI timer -- */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;

  /* -- Persistence -- */
  function loadHouseRules() {
    try {
      const saved = localStorage.getItem('sz-uno-houserules');
      if (saved) Object.assign(houseRules, JSON.parse(saved));
    } catch (_e) { /* ignore */ }
  }

  function saveHouseRules() {
    try {
      localStorage.setItem('sz-uno-houserules', JSON.stringify(houseRules));
    } catch (_e) { /* ignore */ }
  }

  /* ================================================================
     DECK
     ================================================================ */

  function createUnoDeck() {
    const d = [];
    for (const color of unoColors) {
      d.push({ color, value: '0', type: 'number' });
      for (let i = 1; i <= 9; ++i) {
        d.push({ color, value: String(i), type: 'number' });
        d.push({ color, value: String(i), type: 'number' });
      }
      for (const special of ['Skip', 'Reverse', 'Draw Two']) {
        d.push({ color, value: special, type: 'action' });
        d.push({ color, value: special, type: 'action' });
      }
      if (houseRules.noMercy) {
        d.push({ color, value: 'Draw Six', type: 'action' });
        d.push({ color, value: 'Draw Ten', type: 'action' });
      }
    }
    for (let i = 0; i < 4; ++i) {
      d.push({ color: 'wild', value: 'Wild', type: 'wild' });
      d.push({ color: 'wild', value: 'Wild Draw Four', type: 'wild' });
    }
    return d;
  }

  /* ================================================================
     DRAWING HELPERS
     ================================================================ */

  const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#000' };

  function drawUnoCard(x, y, w, h, card) {
    _ctx.save();
    const isWild = card.type === 'wild' && card.color === 'wild';
    _ctx.fillStyle = isWild ? '#000' : (colorMap[card.color] || '#000');
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();

    if (isWild) {
      // Draw rainbow quadrants for wild cards
      const hw = w / 2;
      const hh = h / 2;
      _ctx.save();
      _ctx.beginPath();
      CE.drawRoundedRect(_ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      _ctx.clip();
      _ctx.fillStyle = '#e33';
      _ctx.fillRect(x, y, hw, hh);
      _ctx.fillStyle = '#33e';
      _ctx.fillRect(x + hw, y, hw, hh);
      _ctx.fillStyle = '#ea0';
      _ctx.fillRect(x, y + hh, hw, hh);
      _ctx.fillStyle = '#3a3';
      _ctx.fillRect(x + hw, y + hh, hw, hh);
      _ctx.restore();
      // Dark overlay for black card feel
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      CE.drawRoundedRect(_ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      _ctx.fill();
    } else {
      _ctx.fillStyle = 'rgba(255,255,255,0.3)';
      _ctx.beginPath();
      _ctx.ellipse(x + w / 2, y + h / 2, w / 3, h / 2.5, -0.3, 0, Math.PI * 2);
      _ctx.fill();
    }

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    const label = card.value === 'Wild Draw Four' ? '+4' : card.value === 'Wild' ? 'W' : card.value === 'Draw Two' ? '+2' : card.value === 'Draw Six' ? '+6' : card.value === 'Draw Ten' ? '+10' : card.value;
    _ctx.fillText(label, x + w / 2, y + h / 2);
    _ctx.restore();
  }

  /* ================================================================
     UNO RULES
     ================================================================ */

  function isDrawCard(value) {
    return value === 'Draw Two' || value === 'Wild Draw Four' || value === 'Draw Six' || value === 'Draw Ten';
  }

  function canPlayUno(card, topCard) {
    if (!topCard) return true;

    // Handle draw stacking
    if (drawStack > 0) {
      if (houseRules.stackPlus4 && card.value === 'Wild Draw Four' && topCard.value === 'Wild Draw Four')
        return true;
      if (houseRules.stackPlus2 && card.value === 'Draw Two' && topCard.value === 'Draw Two')
        return true;
      if (houseRules.stackPlus2OnPlus4 && card.value === 'Draw Two' && topCard.value === 'Wild Draw Four')
        return true;
      if (houseRules.noMercy && isDrawCard(card.value) && isDrawCard(topCard.value))
        return true;
      if (drawStack > 0 && isDrawCard(topCard.value))
        return false; // Must draw if can't stack
    }

    if (card.type === 'wild') return true;
    return card.color === topCard.color || card.value === topCard.value;
  }

  function applyDrawStack(nextPlayer) {
    if (drawStack > 0) {
      for (let i = 0; i < drawStack && unoDeck.length > 0; ++i)
        unoHands[nextPlayer].push(unoDeck.pop());
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, 'Draw ' + drawStack + '!', { color: '#f88', size: 18 });
      drawStack = 0;
    }
  }

  function finishWildPlay(card, playerIndex, chosenColor) {
    card.color = chosenColor;
    if (card.value === 'Wild Draw Four') {
      const next = (unoCurrentPlayer + unoDirection + 3) % 3;
      if (houseRules.stackPlus4 || houseRules.noMercy)
        drawStack += 4;
      else {
        for (let i = 0; i < 4 && unoDeck.length > 0; ++i)
          unoHands[next].push(unoDeck.pop());
      }
    }
    checkWin(playerIndex);
  }

  function checkWin(playerIndex) {
    const hand = unoHands[playerIndex];
    if (hand.length === 0) {
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300,
          playerIndex === 0 ? 'YOU WIN!' : 'AI ' + playerIndex + ' WINS',
          { color: playerIndex === 0 ? '#4f4' : '#f44', size: 28 });
      }
      if (playerIndex === 0) {
        score += 50;
        if (_host) {
          _host.addGlow(60, 420, unoHands[0].length * 55 + CE.CARD_W, CE.CARD_H, 2);
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      }
      roundOver = true;
      if (_host) _host.onScoreChanged(score);
      return true;
    }
    unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;

    // If next player must draw from stack and can't counter
    if (drawStack > 0 && !houseRules.stackPlus4 && !houseRules.stackPlus2 && !houseRules.noMercy) {
      applyDrawStack(unoCurrentPlayer);
      unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
    }
    return false;
  }

  function unoPlayCard(playerIndex, cardIndex) {
    if (waitingForColorChoice) return false;
    const hand = unoHands[playerIndex];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlayUno(card, unoTopCard)) return false;
    hand.splice(cardIndex, 1);
    unoTopCard = card;

    if (card.type === 'wild') {
      if (playerIndex === 0) {
        // Human player: show color choice overlay
        waitingForColorChoice = true;
        pendingWildCard = card;
        pendingWildPlayer = playerIndex;
        return true;
      }
      // AI: pick most common color in hand
      const counts = {};
      for (const c of unoColors) counts[c] = 0;
      for (const c of hand)
        if (c.color !== 'wild') ++counts[c.color];
      let best = unoColors[0];
      for (const c of unoColors)
        if (counts[c] > counts[best]) best = c;
      finishWildPlay(card, playerIndex, best);
      return true;
    }

    if (card.value === 'Skip')
      unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
    else if (card.value === 'Reverse')
      unoDirection = -unoDirection;
    else if (card.value === 'Draw Two') {
      if (houseRules.stackPlus2 || houseRules.noMercy)
        drawStack += 2;
      else {
        const next = (unoCurrentPlayer + unoDirection + 3) % 3;
        for (let i = 0; i < 2 && unoDeck.length > 0; ++i)
          unoHands[next].push(unoDeck.pop());
      }
    } else if (card.value === 'Draw Six') {
      drawStack += 6;
    } else if (card.value === 'Draw Ten') {
      drawStack += 10;
    } else if (card.value === '0' && houseRules.zeroRotate) {
      // Rotate all hands in direction of play
      if (unoDirection === 1) {
        const last = unoHands.pop();
        unoHands.unshift(last);
      } else {
        const first = unoHands.shift();
        unoHands.push(first);
      }
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, 'Hands rotated!', { color: '#ff0', size: 16 });
    } else if (card.value === '7' && houseRules.sevenSwap) {
      if (playerIndex === 0) {
        waitingForSwapChoice = true;
        swapChoicePlayer = playerIndex;
        return true;
      }
      // AI: swap with opponent who has the most cards
      let target = -1;
      let maxCards = -1;
      for (let p = 0; p < 3; ++p) {
        if (p !== playerIndex && unoHands[p].length > maxCards) {
          maxCards = unoHands[p].length;
          target = p;
        }
      }
      if (target >= 0) {
        const tmp = unoHands[playerIndex];
        unoHands[playerIndex] = unoHands[target];
        unoHands[target] = tmp;
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 200, 'AI ' + playerIndex + ' swaps with ' + (target === 0 ? 'You' : 'AI ' + target) + '!', { color: '#ff0', size: 16 });
      }
    }

    checkWin(playerIndex);
    return true;
  }

  function unoAiTurn() {
    if (roundOver || gameOver || waitingForColorChoice || waitingForSwapChoice) return;

    // If AI must draw from stack
    if (drawStack > 0) {
      const hand = unoHands[unoCurrentPlayer];
      let canStack = false;
      for (let i = 0; i < hand.length; ++i) {
        if (canPlayUno(hand[i], unoTopCard)) {
          canStack = true;
          unoPlayCard(unoCurrentPlayer, i);
          return;
        }
      }
      // Can't stack: draw
      applyDrawStack(unoCurrentPlayer);
      unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
      return;
    }

    const hand = unoHands[unoCurrentPlayer];
    for (let i = 0; i < hand.length; ++i) {
      if (canPlayUno(hand[i], unoTopCard)) {
        unoPlayCard(unoCurrentPlayer, i);
        return;
      }
    }
    if (unoDeck.length > 0)
      hand.push(unoDeck.pop());
    unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupUno() {
    loadHouseRules();
    unoDeck = CE.shuffle(createUnoDeck());
    unoHands = [[], [], []];
    unoCurrentPlayer = 0;
    unoDirection = 1;
    roundOver = false;
    gameOver = false;
    waitingForColorChoice = false;
    waitingForSwapChoice = false;
    pendingWildCard = null;
    pendingWildPlayer = -1;
    swapChoicePlayer = -1;
    drawStack = 0;
    aiTurnTimer = 0;
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 7; ++i)
        unoHands[p].push(unoDeck.pop());
    unoTopCard = unoDeck.pop();
    while (unoTopCard.type === 'wild') {
      unoDeck.unshift(unoTopCard);
      unoTopCard = unoDeck.pop();
    }
    if (_host) {
      for (let i = 0; i < unoHands[0].length; ++i)
        _host.dealCardAnim(unoHands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
    }
  }

  /* ================================================================
     COLOR CHOICE OVERLAY
     ================================================================ */

  const COLOR_BTN_SIZE = 60;
  const COLOR_BTN_GAP = 12;
  const colorChoiceRects = [];

  function drawColorChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Choose a color:', CANVAS_W / 2, CANVAS_H / 2 - 60);

    colorChoiceRects.length = 0;
    const totalW = unoColors.length * COLOR_BTN_SIZE + (unoColors.length - 1) * COLOR_BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 15;

    for (let i = 0; i < unoColors.length; ++i) {
      const x = startX + i * (COLOR_BTN_SIZE + COLOR_BTN_GAP);
      const col = unoColors[i];
      _ctx.fillStyle = colorMap[col];
      CE.drawRoundedRect(_ctx, x, y, COLOR_BTN_SIZE, COLOR_BTN_SIZE, 8);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 2;
      _ctx.stroke();

      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 12px sans-serif';
      _ctx.fillText(col[0].toUpperCase() + col.slice(1), x + COLOR_BTN_SIZE / 2, y + COLOR_BTN_SIZE / 2);

      colorChoiceRects.push({ x, y, w: COLOR_BTN_SIZE, h: COLOR_BTN_SIZE, color: col });
    }
    _ctx.restore();
  }

  /* ================================================================
     SEVEN-SWAP CHOICE OVERLAY
     ================================================================ */

  function drawSwapChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Swap hands with:', CANVAS_W / 2, CANVAS_H / 2 - 50);

    swapChoiceRects.length = 0;
    const btnW = 120;
    const btnH = 40;
    const gap = 20;
    const targets = [];
    for (let p = 0; p < 3; ++p)
      if (p !== swapChoicePlayer)
        targets.push(p);
    const totalW = targets.length * btnW + (targets.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2;

    for (let i = 0; i < targets.length; ++i) {
      const x = startX + i * (btnW + gap);
      const p = targets[i];
      const label = p === 0 ? 'You' : 'AI ' + p + ' (' + unoHands[p].length + ')';
      _ctx.fillStyle = '#4a4';
      CE.drawRoundedRect(_ctx, x, y, btnW, btnH, 6);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.fillText(label, x + btnW / 2, y + btnH / 2);
      swapChoiceRects.push({ x, y, w: btnW, h: btnH, target: p });
    }
    _ctx.restore();
  }

  /* ================================================================
     HOUSE RULES SETTINGS OVERLAY
     ================================================================ */

  let showingSettings = false;

  function drawSettingsOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const bw = 380;
    const bh = 370;
    const bx = (CANVAS_W - bw) / 2;
    const by = (CANVAS_H - bh) / 2;

    _ctx.fillStyle = '#1a3a1a';
    _ctx.strokeStyle = '#4a4';
    _ctx.lineWidth = 2;
    CE.drawRoundedRect(_ctx, bx, by, bw, bh, 10);
    _ctx.fill();
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Uno House Rules', CANVAS_W / 2, by + 28);

    const rules = [
      { key: 'stackPlus4', label: 'Stack +4 on +4' },
      { key: 'stackPlus2OnPlus4', label: 'Stack +2 on +4' },
      { key: 'stackPlus2', label: 'Stack +2 on +2' },
      { key: 'wildOnWild', label: 'Wild on Wild' },
      { key: 'noMercy', label: 'No Mercy (+6, +10, all stacking)' },
      { key: 'zeroRotate', label: 'Zero rotates all hands' },
      { key: 'sevenSwap', label: 'Seven swaps hands' },
      { key: 'jumpIn', label: 'Jump-In (exact match out of turn)' },
    ];

    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'left';

    settingsRects.length = 0;
    for (let i = 0; i < rules.length; ++i) {
      const rx = bx + 30;
      const ry = by + 58 + i * 32;
      const checked = houseRules[rules[i].key];

      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1.5;
      _ctx.fillStyle = checked ? '#4a4' : '#333';
      _ctx.fillRect(rx, ry, 18, 18);
      _ctx.strokeRect(rx, ry, 18, 18);
      if (checked) {
        _ctx.strokeStyle = '#fff';
        _ctx.lineWidth = 2;
        _ctx.beginPath();
        _ctx.moveTo(rx + 3, ry + 9);
        _ctx.lineTo(rx + 7, ry + 14);
        _ctx.lineTo(rx + 15, ry + 4);
        _ctx.stroke();
      }

      _ctx.fillStyle = '#fff';
      _ctx.fillText(rules[i].label, rx + 28, ry + 13);
      settingsRects.push({ x: rx, y: ry, w: 200, h: 18, key: rules[i].key });
    }

    // Close button
    const closeX = bx + bw / 2 - 40;
    const closeY = by + bh - 44;
    _ctx.fillStyle = '#4a4';
    CE.drawRoundedRect(_ctx, closeX, closeY, 80, 28, 4);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Close', closeX + 40, closeY + 15);
    settingsRects.push({ x: closeX, y: closeY, w: 80, h: 28, key: '_close' });

    _ctx.restore();
  }

  const settingsRects = [];

  /* ================================================================
     DRAW
     ================================================================ */

  function drawUno() {
    if (unoTopCard)
      drawUnoCard(CANVAS_W / 2 - CE.CARD_W / 2, 240, CE.CARD_W, CE.CARD_H, unoTopCard);
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 20, 240, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + unoDeck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 20, 350);

    // Draw stack indicator
    if (drawStack > 0) {
      _ctx.fillStyle = '#f44';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText('Stack: +' + drawStack, CANVAS_W / 2, 230);
    }

    for (let i = 0; i < unoHands[0].length; ++i) {
      if (unoHands[0][i]._dealing) continue;
      const x = 80 + i * 55;
      drawUnoCard(x, 440, CE.CARD_W, CE.CARD_H, unoHands[0][i]);
      if (_host && _host.hintsEnabled && unoCurrentPlayer === 0 && !waitingForColorChoice && !waitingForSwapChoice && !roundOver && !gameOver && canPlayUno(unoHands[0][i], unoTopCard))
        CE.drawHintGlow(_ctx, x, 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    for (let p = 1; p < unoHands.length; ++p) {
      const y = 20 + (p - 1) * 120;
      _ctx.textAlign = 'left';
      _ctx.fillText('AI ' + p + ' (' + unoHands[p].length + ' cards)', 60, y + CE.CARD_H + 15);
      for (let i = 0; i < Math.min(unoHands[p].length, 7); ++i)
        CE.drawCardBack(_ctx, 60 + i * 20, y, CE.CARD_W * 0.6, CE.CARD_H * 0.6);
    }

    // Settings button
    _ctx.fillStyle = '#888';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('\u2699 Rules', CANVAS_W - 12, 18);

    if (!roundOver && !gameOver && unoCurrentPlayer === 0 && !waitingForColorChoice) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (waitingForColorChoice)
      drawColorChoiceOverlay();

    if (waitingForSwapChoice)
      drawSwapChoiceOverlay();

    if (showingSettings)
      drawSettingsOverlay();
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupUno();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawUno();
    },

    handleClick(mx, my) {
      // Settings overlay
      if (showingSettings) {
        for (const r of settingsRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            if (r.key === '_close') {
              showingSettings = false;
              saveHouseRules();
            } else {
              houseRules[r.key] = !houseRules[r.key];
              saveHouseRules();
            }
            return;
          }
        }
        return;
      }

      // Settings gear button
      if (mx >= CANVAS_W - 70 && mx <= CANVAS_W && my >= 2 && my <= 24) {
        showingSettings = true;
        return;
      }

      // Swap choice (Seven rule)
      if (waitingForSwapChoice) {
        for (const r of swapChoiceRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForSwapChoice = false;
            const tmp = unoHands[swapChoicePlayer];
            unoHands[swapChoicePlayer] = unoHands[r.target];
            unoHands[r.target] = tmp;
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 200, 'Swapped with ' + (r.target === 0 ? 'You' : 'AI ' + r.target) + '!', { color: '#ff0', size: 16 });
            checkWin(swapChoicePlayer);
            swapChoicePlayer = -1;
            return;
          }
        }
        return;
      }

      // Color choice
      if (waitingForColorChoice) {
        for (const r of colorChoiceRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForColorChoice = false;
            finishWildPlay(pendingWildCard, pendingWildPlayer, r.color);
            pendingWildCard = null;
            pendingWildPlayer = -1;
            return;
          }
        }
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      // Player card click
      for (let i = unoHands[0].length - 1; i >= 0; --i) {
        const cx = 80 + i * 55;
        if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
          if (unoCurrentPlayer === 0) {
            if (!unoPlayCard(0, i))
              if (_host) _host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
          } else if (houseRules.jumpIn && unoTopCard) {
            const card = unoHands[0][i];
            if (card.color === unoTopCard.color && card.value === unoTopCard.value && card.color !== 'wild') {
              // Jump-in: play exact match out of turn
              const savedPlayer = unoCurrentPlayer;
              unoCurrentPlayer = 0;
              if (!unoPlayCard(0, i))
                unoCurrentPlayer = savedPlayer;
              else if (_host)
                _host.floatingText.add(CANVAS_W / 2, 400, 'Jump-In!', { color: '#0ff', size: 18 });
            }
          }
          return;
        }
      }

      // Deck click (draw)
      if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 20, 240, CE.CARD_W, CE.CARD_H) && unoCurrentPlayer === 0) {
        if (drawStack > 0) {
          applyDrawStack(0);
          unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
        } else if (unoDeck.length > 0) {
          unoHands[0].push(unoDeck.pop());
          unoCurrentPlayer = (unoCurrentPlayer + unoDirection + 3) % 3;
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver || waitingForColorChoice || waitingForSwapChoice || showingSettings) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 7 && unoCurrentPlayer === 0) {
        const idx = num - 1;
        if (idx < unoHands[0].length)
          unoPlayCard(0, idx);
      }
    },

    tick(dt) {
      if (roundOver || gameOver || waitingForColorChoice || waitingForSwapChoice || showingSettings) return;

      // Jump-in check for AI players (even when it's not their turn)
      if (houseRules.jumpIn && unoTopCard && unoCurrentPlayer !== 0) {
        for (let p = 1; p < 3; ++p) {
          if (p === unoCurrentPlayer) continue;
          for (let i = 0; i < unoHands[p].length; ++i) {
            const c = unoHands[p][i];
            if (c.color === unoTopCard.color && c.value === unoTopCard.value && c.color !== 'wild' && Math.random() < 0.3) {
              const savedPlayer = unoCurrentPlayer;
              unoCurrentPlayer = p;
              if (unoPlayCard(p, i)) {
                if (_host)
                  _host.floatingText.add(CANVAS_W / 2, 200, 'AI ' + p + ' jumps in!', { color: '#0ff', size: 16 });
                aiTurnTimer = 0;
                return;
              }
              unoCurrentPlayer = savedPlayer;
            }
          }
        }
      }

      if (unoCurrentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          unoAiTurn();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      unoHands = [];
      unoDeck = [];
      unoTopCard = null;
      roundOver = false;
      gameOver = false;
      waitingForColorChoice = false;
      waitingForSwapChoice = false;
      pendingWildCard = null;
      pendingWildPlayer = -1;
      swapChoicePlayer = -1;
      drawStack = 0;
      showingSettings = false;
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('uno', module);

})();
