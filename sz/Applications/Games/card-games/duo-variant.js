;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* -- 8-Color palette -- */
  const duoColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'];
  const colorMap = {
    red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0',
    purple: '#82e', orange: '#e82', pink: '#d48', teal: '#2aa',
    wild: '#000'
  };

  /* -- Game state -- */
  let topCard = null;
  let direction = 1;
  let currentPlayer = 0;
  let hands = [];
  let deck = [];
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let waitingForColorChoice = false;
  let pendingWildCard = null;
  let pendingWildPlayer = -1;
  let drawStack = 0;

  /* -- Host references -- */
  let _ctx = null;
  let _host = null;

  /* -- AI timer -- */
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;
  const NUM_PLAYERS = 4;

  /* ================================================================
     DECK -- 114 cards total
     8 colors x 13 cards = 104 + 6 Wild + 4 Wild Draw Four = 114
     ================================================================ */

  function createDuoDeck() {
    const d = [];
    for (const color of duoColors) {
      d.push({ color, value: '0', type: 'number' });
      for (let i = 1; i <= 9; ++i)
        d.push({ color, value: String(i), type: 'number' });
      d.push({ color, value: 'Skip', type: 'action' });
      d.push({ color, value: 'Reverse', type: 'action' });
      d.push({ color, value: 'Draw Two', type: 'action' });
    }
    for (let i = 0; i < 6; ++i)
      d.push({ color: 'wild', value: 'Wild', type: 'wild' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild Draw Four', type: 'wild' });
    return d;
  }

  /* ================================================================
     DRAWING HELPERS
     ================================================================ */

  function drawDuoCard(x, y, w, h, card) {
    _ctx.save();
    const isWild = card.type === 'wild' && card.color === 'wild';
    _ctx.fillStyle = isWild ? '#000' : (colorMap[card.color] || '#000');
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();

    if (isWild) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const radius = Math.min(w, h) * 0.38;
      _ctx.save();
      _ctx.beginPath();
      CE.drawRoundedRect(_ctx, x + 2, y + 2, w - 4, h - 4, CE.CARD_RADIUS - 1);
      _ctx.clip();
      for (let i = 0; i < 8; ++i) {
        const startAngle = (i * Math.PI / 4) - Math.PI / 8;
        const endAngle = startAngle + Math.PI / 4;
        _ctx.beginPath();
        _ctx.moveTo(cx, cy);
        _ctx.arc(cx, cy, radius, startAngle, endAngle);
        _ctx.closePath();
        _ctx.fillStyle = colorMap[duoColors[i]];
        _ctx.fill();
      }
      _ctx.restore();
      _ctx.fillStyle = 'rgba(0,0,0,0.45)';
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
    const label = card.value === 'Wild Draw Four' ? '+4'
      : card.value === 'Wild' ? 'W'
      : card.value === 'Draw Two' ? '+2'
      : card.value === 'Skip' ? '\u2298'
      : card.value === 'Reverse' ? '\u21C4'
      : card.value;
    _ctx.fillText(label, x + w / 2, y + h / 2);
    _ctx.restore();
  }

  /* ================================================================
     LAYOUT HELPERS
     ================================================================ */

  function getPlayerHandPos(playerIndex) {
    switch (playerIndex) {
      case 0: return { x: 80, y: 440, dx: 55, dy: 0, scale: 1 };
      case 1: return { x: 20, y: 100, dx: 0, dy: 22, scale: 0.6 };
      case 2: return { x: 250, y: 20, dx: 20, dy: 0, scale: 0.6 };
      case 3: return { x: CANVAS_W - 20 - CE.CARD_W * 0.6, y: 100, dx: 0, dy: 22, scale: 0.6 };
      default: return { x: 0, y: 0, dx: 0, dy: 0, scale: 1 };
    }
  }

  function getPlayerLabel(p) {
    if (p === 0) return 'You';
    return 'AI ' + p;
  }

  /* ================================================================
     DUO RULES
     ================================================================ */

  function canPlay(card, top) {
    if (!top) return true;
    if (drawStack > 0) {
      if (card.value === 'Wild Draw Four' && top.value === 'Wild Draw Four')
        return true;
      if (card.value === 'Draw Two' && top.value === 'Draw Two')
        return true;
      return false;
    }
    if (card.type === 'wild') return true;
    return card.color === top.color || card.value === top.value;
  }

  function advancePlayer() {
    currentPlayer = ((currentPlayer + direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function applyDrawStack(targetPlayer) {
    if (drawStack > 0) {
      refillDeck();
      for (let i = 0; i < drawStack && deck.length > 0; ++i)
        hands[targetPlayer].push(deck.pop());
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 200, getPlayerLabel(targetPlayer) + ' draws ' + drawStack + '!', { color: '#f88', size: 18 });
      drawStack = 0;
    }
  }

  function refillDeck() {
    if (deck.length > 0) return;
    if (!topCard) return;
    deck = CE.shuffle(createDuoDeck());
  }

  function finishWildPlay(card, playerIndex, chosenColor) {
    card.color = chosenColor;
    if (card.value === 'Wild Draw Four')
      drawStack += 4;
    checkWin(playerIndex);
  }

  function cardPointValue(card) {
    if (card.value === 'Wild Draw Four') return 50;
    if (card.value === 'Wild') return 40;
    if (card.value === 'Skip' || card.value === 'Reverse' || card.value === 'Draw Two') return 20;
    return parseInt(card.value, 10) || 0;
  }

  function checkWin(playerIndex) {
    const hand = hands[playerIndex];
    if (hand.length === 0) {
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300,
          playerIndex === 0 ? 'YOU WIN!' : getPlayerLabel(playerIndex) + ' WINS',
          { color: playerIndex === 0 ? '#4f4' : '#f44', size: 28 });
      }
      if (playerIndex === 0) {
        let pts = 0;
        for (let p = 1; p < NUM_PLAYERS; ++p)
          for (const c of hands[p])
            pts += cardPointValue(c);
        score += pts;
        if (_host) {
          _host.addGlow(60, 420, hands[0].length * 55 + CE.CARD_W, CE.CARD_H, 2);
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      }
      roundOver = true;
      if (_host) _host.onScoreChanged(score);
      return true;
    }
    advancePlayer();
    if (drawStack > 0) {
      let canCounter = false;
      for (const c of hands[currentPlayer]) {
        if (canPlay(c, topCard)) {
          canCounter = true;
          break;
        }
      }
      if (!canCounter) {
        applyDrawStack(currentPlayer);
        advancePlayer();
      }
    }
    return false;
  }

  function playCard(playerIndex, cardIndex) {
    if (waitingForColorChoice) return false;
    const hand = hands[playerIndex];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlay(card, topCard)) return false;
    hand.splice(cardIndex, 1);
    topCard = card;

    if (card.type === 'wild') {
      if (playerIndex === 0) {
        waitingForColorChoice = true;
        pendingWildCard = card;
        pendingWildPlayer = playerIndex;
        return true;
      }
      const counts = {};
      for (const c of duoColors) counts[c] = 0;
      for (const c of hand)
        if (c.color !== 'wild') ++counts[c.color];
      let best = duoColors[0];
      for (const c of duoColors)
        if (counts[c] > counts[best]) best = c;
      finishWildPlay(card, playerIndex, best);
      return true;
    }

    if (card.value === 'Skip')
      advancePlayer();
    else if (card.value === 'Reverse')
      direction = -direction;
    else if (card.value === 'Draw Two')
      drawStack += 2;

    checkWin(playerIndex);
    return true;
  }

  function aiTurn() {
    if (roundOver || gameOver || waitingForColorChoice) return;

    if (drawStack > 0) {
      const hand = hands[currentPlayer];
      for (let i = 0; i < hand.length; ++i) {
        if (canPlay(hand[i], topCard)) {
          playCard(currentPlayer, i);
          return;
        }
      }
      applyDrawStack(currentPlayer);
      advancePlayer();
      return;
    }

    const hand = hands[currentPlayer];
    let bestIdx = -1;
    let bestPriority = -1;
    for (let i = 0; i < hand.length; ++i) {
      if (!canPlay(hand[i], topCard)) continue;
      let priority = 1;
      if (hand[i].type === 'action') priority = 3;
      else if (hand[i].type === 'number') priority = 2;
      else if (hand[i].value === 'Wild') priority = 0;
      else if (hand[i].value === 'Wild Draw Four') priority = 4;
      if (priority > bestPriority) {
        bestPriority = priority;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      playCard(currentPlayer, bestIdx);
      return;
    }

    refillDeck();
    if (deck.length > 0)
      hand.push(deck.pop());
    advancePlayer();
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupDuo() {
    deck = CE.shuffle(createDuoDeck());
    hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      hands.push([]);
    currentPlayer = 0;
    direction = 1;
    roundOver = false;
    gameOver = false;
    waitingForColorChoice = false;
    pendingWildCard = null;
    pendingWildPlayer = -1;
    drawStack = 0;
    aiTurnTimer = 0;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (let i = 0; i < 7; ++i)
        hands[p].push(deck.pop());

    topCard = deck.pop();
    while (topCard.type === 'wild') {
      deck.unshift(topCard);
      topCard = deck.pop();
    }

    if (_host) {
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
    }
  }

  /* ================================================================
     COLOR CHOICE OVERLAY (4x2 grid of 8 colors)
     ================================================================ */

  const COLOR_BTN_SIZE = 60;
  const COLOR_BTN_GAP = 10;
  const colorChoiceRects = [];

  function drawColorChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.65)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Choose a color:', CANVAS_W / 2, CANVAS_H / 2 - 90);

    colorChoiceRects.length = 0;

    const cols = 4;
    const rows = 2;
    const gridW = cols * COLOR_BTN_SIZE + (cols - 1) * COLOR_BTN_GAP;
    const gridH = rows * COLOR_BTN_SIZE + (rows - 1) * COLOR_BTN_GAP;
    const startX = (CANVAS_W - gridW) / 2;
    const startY = (CANVAS_H - gridH) / 2 - 20;

    for (let i = 0; i < duoColors.length; ++i) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const bx = startX + col * (COLOR_BTN_SIZE + COLOR_BTN_GAP);
      const by = startY + row * (COLOR_BTN_SIZE + COLOR_BTN_GAP);
      const clr = duoColors[i];

      _ctx.fillStyle = colorMap[clr];
      CE.drawRoundedRect(_ctx, bx, by, COLOR_BTN_SIZE, COLOR_BTN_SIZE, 8);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 2;
      _ctx.stroke();

      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(clr[0].toUpperCase() + clr.slice(1), bx + COLOR_BTN_SIZE / 2, by + COLOR_BTN_SIZE / 2);

      colorChoiceRects.push({ x: bx, y: by, w: COLOR_BTN_SIZE, h: COLOR_BTN_SIZE, color: clr });
    }
    _ctx.restore();
  }

  /* ================================================================
     DIRECTION INDICATOR
     ================================================================ */

  function drawDirectionIndicator() {
    _ctx.save();
    const cx = CANVAS_W / 2 + 80;
    const cy = CANVAS_H / 2 - 10;
    const r = 18;

    _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    _ctx.lineWidth = 2;
    _ctx.beginPath();
    _ctx.arc(cx, cy, r, 0, Math.PI * 2);
    _ctx.stroke();

    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 2.5;
    const base = direction === 1 ? -Math.PI / 2 : Math.PI / 2;
    _ctx.beginPath();
    _ctx.arc(cx, cy, r - 2, base - 1.2, base + 1.2);
    _ctx.stroke();

    const tipAngle = base + 1.2;
    const tipX = cx + (r - 2) * Math.cos(tipAngle);
    const tipY = cy + (r - 2) * Math.sin(tipAngle);
    _ctx.beginPath();
    _ctx.moveTo(tipX, tipY);
    _ctx.lineTo(tipX + 6 * Math.cos(tipAngle + 2.3), tipY + 6 * Math.sin(tipAngle + 2.3));
    _ctx.moveTo(tipX, tipY);
    _ctx.lineTo(tipX + 6 * Math.cos(tipAngle - 0.6), tipY + 6 * Math.sin(tipAngle - 0.6));
    _ctx.stroke();

    _ctx.fillStyle = 'rgba(255,255,255,0.4)';
    _ctx.font = '9px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(direction === 1 ? 'CW' : 'CCW', cx, cy);
    _ctx.restore();
  }

  /* ================================================================
     CURRENT PLAYER INDICATOR
     ================================================================ */

  function drawCurrentPlayerIndicator() {
    if (roundOver || gameOver) return;
    _ctx.save();
    _ctx.fillStyle = '#8f8';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    switch (currentPlayer) {
      case 0: {
        const handW = hands[0].length * 55 + CE.CARD_W;
        _ctx.fillText('\u25BC', 80 + handW / 2, 432);
        break;
      }
      case 1: {
        const pos = getPlayerHandPos(1);
        _ctx.fillText('\u25B6', pos.x + CE.CARD_W * pos.scale + 8, pos.y + Math.min(hands[1].length, 10) * pos.dy / 2);
        break;
      }
      case 2: {
        const pos = getPlayerHandPos(2);
        _ctx.fillText('\u25BC', pos.x + Math.min(hands[2].length, 10) * pos.dx / 2, pos.y + CE.CARD_H * pos.scale + 8);
        break;
      }
      case 3: {
        const pos = getPlayerHandPos(3);
        _ctx.fillText('\u25C0', pos.x - 10, pos.y + Math.min(hands[3].length, 10) * pos.dy / 2);
        break;
      }
    }
    _ctx.restore();
  }

  /* ================================================================
     DRAW
     ================================================================ */

  function drawDuo() {
    if (topCard)
      drawDuoCard(CANVAS_W / 2 - CE.CARD_W / 2, 240, CE.CARD_W, CE.CARD_H, topCard);

    const drawPileX = CANVAS_W / 2 - CE.CARD_W - 30;
    const drawPileY = 240;
    CE.drawCardBack(_ctx, drawPileX, drawPileY, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, drawPileX + CE.CARD_W / 2, drawPileY + CE.CARD_H + 14);

    if (drawStack > 0) {
      _ctx.fillStyle = '#f44';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Stack: +' + drawStack, CANVAS_W / 2, 230);
    }

    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      const x = 80 + i * 55;
      drawDuoCard(x, 440, CE.CARD_W, CE.CARD_H, hands[0][i]);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !waitingForColorChoice && !roundOver && !gameOver && canPlay(hands[0][i], topCard))
        CE.drawHintGlow(_ctx, x, 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pos = getPlayerHandPos(p);
      const count = hands[p].length;
      const maxVisible = Math.min(count, 10);

      _ctx.fillStyle = '#aaa';
      _ctx.font = '12px sans-serif';

      if (pos.dy === 0) {
        _ctx.textAlign = 'left';
        _ctx.fillText(getPlayerLabel(p) + ' (' + count + ')', pos.x, pos.y + CE.CARD_H * pos.scale + 14);
        for (let i = 0; i < maxVisible; ++i)
          CE.drawCardBack(_ctx, pos.x + i * pos.dx, pos.y, CE.CARD_W * pos.scale, CE.CARD_H * pos.scale);
      } else {
        _ctx.textAlign = p === 1 ? 'left' : 'right';
        const labelX = p === 1 ? pos.x : pos.x + CE.CARD_W * pos.scale;
        _ctx.fillText(getPlayerLabel(p) + ' (' + count + ')', labelX, pos.y - 10);
        for (let i = 0; i < maxVisible; ++i)
          CE.drawCardBack(_ctx, pos.x, pos.y + i * pos.dy, CE.CARD_W * pos.scale, CE.CARD_H * pos.scale);
      }
    }

    drawDirectionIndicator();
    drawCurrentPlayerIndicator();

    if (!roundOver && !gameOver && currentPlayer === 0 && !waitingForColorChoice) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (roundOver) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 15);
    }

    if (waitingForColorChoice)
      drawColorChoiceOverlay();
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupDuo();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawDuo();
    },

    handleClick(mx, my) {
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

      if (currentPlayer !== 0) return;

      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = 80 + i * 55;
        if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
          if (!playCard(0, i))
            if (_host) _host.floatingText.add(mx, my - 20, 'Cannot play!', { color: '#f88', size: 14 });
          return;
        }
      }

      const dpx = CANVAS_W / 2 - CE.CARD_W - 30;
      const dpy = 240;
      if (CE.isInRect(mx, my, dpx, dpy, CE.CARD_W, CE.CARD_H)) {
        if (drawStack > 0) {
          applyDrawStack(0);
          advancePlayer();
        } else {
          refillDeck();
          if (deck.length > 0)
            hands[0].push(deck.pop());
          advancePlayer();
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver || waitingForColorChoice) return;
      if (currentPlayer !== 0) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx < hands[0].length)
          playCard(0, idx);
      }
    },

    tick(dt) {
      if (roundOver || gameOver || waitingForColorChoice) return;
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTurn();
        }
      }
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      hands = [];
      deck = [];
      topCard = null;
      roundOver = false;
      gameOver = false;
      waitingForColorChoice = false;
      pendingWildCard = null;
      pendingWildPlayer = -1;
      drawStack = 0;
      aiTurnTimer = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('duo', module);

})();
