;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 4;
  const AI_TURN_DELAY = 0.8;

  const unoColors = ['red', 'blue', 'green', 'yellow'];
  const colorMap = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#000' };

  let hands = [];
  let deck = [];
  let topCard = null;
  let currentPlayer = 0;
  let direction = 1;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let waitingForColorChoice = false;
  let waitingForTargetChoice = false;
  let pendingWildCard = null;
  let pendingWildPlayer = -1;
  let launcherAnim = 0;
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;

  const colorChoiceRects = [];
  const targetChoiceRects = [];

  function createDeck() {
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
    }
    for (let i = 0; i < 4; ++i) {
      d.push({ color: 'wild', value: 'Wild', type: 'wild' });
      d.push({ color: 'wild', value: 'Wild Draw Four', type: 'wild' });
    }
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Extreme Hit', type: 'extreme' });
    return d;
  }

  function drawExtremeCard(x, y, w, h, card) {
    _ctx.save();
    const isWild = (card.type === 'wild' || card.type === 'extreme') && card.color === 'wild';
    _ctx.fillStyle = isWild ? '#000' : (colorMap[card.color] || '#000');
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();

    if (card.type === 'extreme') {
      // Rainbow gradient for extreme cards
      const grad = _ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#e33');
      grad.addColorStop(0.25, '#ea0');
      grad.addColorStop(0.5, '#3a3');
      grad.addColorStop(0.75, '#33e');
      grad.addColorStop(1, '#e33');
      _ctx.save();
      _ctx.beginPath();
      CE.drawRoundedRect(_ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      _ctx.clip();
      _ctx.fillStyle = grad;
      _ctx.fillRect(x, y, w, h);
      _ctx.restore();
      _ctx.fillStyle = 'rgba(0,0,0,0.4)';
      CE.drawRoundedRect(_ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      _ctx.fill();
    } else if (isWild) {
      const hw = w / 2, hh = h / 2;
      _ctx.save();
      _ctx.beginPath();
      CE.drawRoundedRect(_ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      _ctx.clip();
      _ctx.fillStyle = '#e33'; _ctx.fillRect(x, y, hw, hh);
      _ctx.fillStyle = '#33e'; _ctx.fillRect(x + hw, y, hw, hh);
      _ctx.fillStyle = '#ea0'; _ctx.fillRect(x, y + hh, hw, hh);
      _ctx.fillStyle = '#3a3'; _ctx.fillRect(x + hw, y + hh, hw, hh);
      _ctx.restore();
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
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    const label = card.value === 'Wild Draw Four' ? '+4' : card.value === 'Wild' ? 'W' : card.value === 'Draw Two' ? '+2' : card.value === 'Extreme Hit' ? 'EX!' : card.value;
    _ctx.fillText(label, x + w / 2, y + h / 2);
    _ctx.restore();
  }

  function canPlay(card) {
    if (!topCard) return true;
    if (card.type === 'wild' || card.type === 'extreme') return true;
    return card.color === topCard.color || card.value === topCard.value;
  }

  function launcherDraw(playerIndex) {
    const r = Math.random();
    let count = r < 0.25 ? 0 : r < 0.60 ? 1 : r < 0.85 ? 2 : 3;
    if (count === 0) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Click! Nothing!', { color: '#8f8', size: 16 });
    } else {
      for (let i = 0; i < count && deck.length > 0; ++i)
        hands[playerIndex].push(deck.pop());
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, 'Launcher: ' + count + ' card' + (count > 1 ? 's' : '') + '!', { color: '#f88', size: 16 });
    }
    launcherAnim = 0.5;
  }

  function finishWildPlay(card, playerIndex, chosenColor) {
    card.color = chosenColor;
    if (card.value === 'Wild Draw Four') {
      const next = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
      for (let i = 0; i < 4 && deck.length > 0; ++i)
        hands[next].push(deck.pop());
    }
    checkWin(playerIndex);
  }

  function extremeHit(targetPlayer) {
    launcherDraw(targetPlayer);
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 250, (targetPlayer === 0 ? 'You' : 'AI ' + targetPlayer) + ' hit the launcher!', { color: '#fa0', size: 16 });
  }

  function checkWin(playerIndex) {
    if (hands[playerIndex].length === 0) {
      roundOver = true;
      if (playerIndex === 0) {
        score += 50;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      } else if (_host)
        _host.floatingText.add(CANVAS_W / 2, 300, 'AI ' + playerIndex + ' WINS', { color: '#f44', size: 28 });
      if (_host) _host.onScoreChanged(score);
      return true;
    }
    currentPlayer = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
    return false;
  }

  function playCard(playerIndex, cardIndex) {
    if (waitingForColorChoice || waitingForTargetChoice) return false;
    const hand = hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    topCard = card;

    if (card.type === 'extreme') {
      if (playerIndex === 0) {
        waitingForTargetChoice = true;
        pendingWildPlayer = playerIndex;
        return true;
      }
      // AI: target player closest to winning
      let target = -1, minCards = Infinity;
      for (let p = 0; p < NUM_PLAYERS; ++p)
        if (p !== playerIndex && hands[p].length < minCards) { minCards = hands[p].length; target = p; }
      extremeHit(target);
      checkWin(playerIndex);
      return true;
    }

    if (card.type === 'wild') {
      if (playerIndex === 0) {
        waitingForColorChoice = true;
        pendingWildCard = card;
        pendingWildPlayer = playerIndex;
        return true;
      }
      const counts = {};
      for (const c of unoColors) counts[c] = 0;
      for (const c of hand) if (c.color !== 'wild') ++counts[c.color];
      let best = unoColors[0];
      for (const c of unoColors) if (counts[c] > counts[best]) best = c;
      finishWildPlay(card, playerIndex, best);
      return true;
    }

    if (card.value === 'Skip')
      currentPlayer = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
    else if (card.value === 'Reverse')
      direction = -direction;
    else if (card.value === 'Draw Two') {
      const next = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
      for (let i = 0; i < 2 && deck.length > 0; ++i)
        hands[next].push(deck.pop());
    }

    checkWin(playerIndex);
    return true;
  }

  function aiTurn() {
    if (roundOver || gameOver || waitingForColorChoice || waitingForTargetChoice) return;
    const hand = hands[currentPlayer];
    for (let i = 0; i < hand.length; ++i)
      if (canPlay(hand[i])) { playCard(currentPlayer, i); return; }
    // Can't play: hit launcher
    launcherDraw(currentPlayer);
    currentPlayer = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function setupGame() {
    deck = CE.shuffle(createDeck());
    hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      hands.push([]);
      for (let i = 0; i < 7; ++i) hands[p].push(deck.pop());
    }
    topCard = deck.pop();
    while (topCard.type === 'wild' || topCard.type === 'extreme') {
      deck.unshift(topCard);
      topCard = deck.pop();
    }
    currentPlayer = 0;
    direction = 1;
    roundOver = false;
    gameOver = false;
    waitingForColorChoice = false;
    waitingForTargetChoice = false;
    pendingWildCard = null;
    pendingWildPlayer = -1;
    launcherAnim = 0;
    aiTurnTimer = 0;
    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
  }

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
    const totalW = 4 * 60 + 3 * 12;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 15;
    for (let i = 0; i < 4; ++i) {
      const x = startX + i * 72;
      const col = unoColors[i];
      _ctx.fillStyle = colorMap[col];
      CE.drawRoundedRect(_ctx, x, y, 60, 60, 8);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 2;
      _ctx.stroke();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 12px sans-serif';
      _ctx.fillText(col[0].toUpperCase() + col.slice(1), x + 30, y + 30);
      colorChoiceRects.push({ x, y, w: 60, h: 60, color: col });
    }
    _ctx.restore();
  }

  function drawTargetChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Choose target for Extreme Hit:', CANVAS_W / 2, CANVAS_H / 2 - 60);
    targetChoiceRects.length = 0;
    const targets = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (p !== pendingWildPlayer) targets.push(p);
    const btnW = 110, gap = 15;
    const totalW = targets.length * btnW + (targets.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2;
    for (let i = 0; i < targets.length; ++i) {
      const x = startX + i * (btnW + gap);
      const p = targets[i];
      _ctx.fillStyle = '#4a4';
      CE.drawRoundedRect(_ctx, x, y, btnW, 36, 6);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 12px sans-serif';
      _ctx.fillText((p === 0 ? 'You' : 'AI ' + p) + ' (' + hands[p].length + ')', x + btnW / 2, y + 18);
      targetChoiceRects.push({ x, y, w: btnW, h: 36, target: p });
    }
    _ctx.restore();
  }

  const playerPos = [
    { x: CANVAS_W / 2, y: CANVAS_H - 70, label: 'You' },
    { x: 60, y: CANVAS_H / 2, label: 'AI 1' },
    { x: CANVAS_W / 2, y: 20, label: 'AI 2' },
    { x: CANVAS_W - 60, y: CANVAS_H / 2, label: 'AI 3' },
  ];

  function drawGame() {
    // Top card
    if (topCard) drawExtremeCard(CANVAS_W / 2 - CE.CARD_W / 2, 240, CE.CARD_W, CE.CARD_H, topCard);
    // Draw pile
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 20, 240, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 20, 350);

    // Launcher button
    const lx = CANVAS_W / 2 + CE.CARD_W + 20;
    const ly = 255;
    const lw = 70, lh = 50;
    const lScale = 1 + (launcherAnim > 0 ? Math.sin(launcherAnim * Math.PI * 4) * 0.1 : 0);
    _ctx.save();
    _ctx.translate(lx + lw / 2, ly + lh / 2);
    _ctx.scale(lScale, lScale);
    _ctx.fillStyle = '#d44';
    CE.drawRoundedRect(_ctx, -lw / 2, -lh / 2, lw, lh, 8);
    _ctx.fill();
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 2;
    _ctx.stroke();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('LAUNCHER', 0, 0);
    _ctx.restore();

    // Player hand
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      drawExtremeCard(80 + i * 55, 440, CE.CARD_W, CE.CARD_H, hands[0][i]);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !waitingForColorChoice && !waitingForTargetChoice && !roundOver && !gameOver && canPlay(hands[0][i]))
        CE.drawHintGlow(_ctx, 80 + i * 55, 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(pp.label + ' (' + hands[p].length + ')', pp.x, pp.y - 8);
      for (let i = 0; i < Math.min(hands[p].length, 7); ++i)
        CE.drawCardBack(_ctx, pp.x - 30 + i * 18, pp.y + 4, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
    }

    // Direction
    _ctx.fillStyle = '#888';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(direction === 1 ? '\u21BB' : '\u21BA', CANVAS_W / 2, 225);

    if (!roundOver && !gameOver && currentPlayer === 0 && !waitingForColorChoice && !waitingForTargetChoice) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 play a card or click Launcher', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (waitingForColorChoice) drawColorChoiceOverlay();
    if (waitingForTargetChoice) drawTargetChoiceOverlay();
  }

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupGame();
    },
    draw(ctx, W, H) { _ctx = ctx; drawGame(); },
    handleClick(mx, my) {
      if (waitingForTargetChoice) {
        for (const r of targetChoiceRects)
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForTargetChoice = false;
            extremeHit(r.target);
            checkWin(pendingWildPlayer);
            pendingWildPlayer = -1;
            return;
          }
        return;
      }
      if (waitingForColorChoice) {
        for (const r of colorChoiceRects)
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForColorChoice = false;
            finishWildPlay(pendingWildCard, pendingWildPlayer, r.color);
            pendingWildCard = null;
            pendingWildPlayer = -1;
            return;
          }
        return;
      }
      if (roundOver || gameOver) { if (_host) _host.onRoundOver(gameOver); return; }
      if (currentPlayer !== 0) return;

      // Launcher click
      const lx = CANVAS_W / 2 + CE.CARD_W + 20;
      if (CE.isInRect(mx, my, lx, 255, 70, 50)) {
        launcherDraw(0);
        currentPlayer = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
        return;
      }

      // Card click
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = 80 + i * 55;
        if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
          if (!playCard(0, i))
            if (_host) _host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
          return;
        }
      }
    },
    handleKey(e) {},
    handlePointerMove() {},
    handlePointerUp() {},
    tick(dt) {
      if (launcherAnim > 0) launcherAnim -= dt;
      if (roundOver || gameOver || waitingForColorChoice || waitingForTargetChoice) return;
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) { aiTurnTimer = 0; aiTurn(); }
      }
    },
    cleanup() {
      hands = []; deck = []; topCard = null;
      roundOver = false; gameOver = false;
      waitingForColorChoice = false; waitingForTargetChoice = false;
      pendingWildCard = null; pendingWildPlayer = -1;
      launcherAnim = 0; aiTurnTimer = 0;
      _ctx = null; _host = null;
    },
    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('unoextreme', module);

})();
