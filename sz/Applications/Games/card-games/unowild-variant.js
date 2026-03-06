;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const NUM_PLAYERS = 4;
  const HAND_SIZE = 7;
  const AI_TURN_DELAY = 0.8;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];

  const CARD_DEFS = [
    { value: 'Wild', count: 20 },
    { value: 'Wild Draw Two', count: 16 },
    { value: 'Wild Reverse', count: 12 },
    { value: 'Wild Skip', count: 12 },
    { value: 'Wild Forced Swap', count: 12 },
    { value: 'Wild Targeted Draw Two', count: 16 },
    { value: 'Wild Gap', count: 14 }
  ];

  let hands = [[], [], [], []];
  let deck = [];
  let discardPile = [];
  let topCard = null;
  let direction = 1;
  let currentPlayer = 0;
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let aiTurnTimer = 0;
  let hoverCardIdx = -1;

  let waitingForTargetChoice = false;
  let targetAction = null;
  let targetSourcePlayer = -1;
  let targetCard = null;
  const targetChoiceRects = [];

  let waitingForGapChoice = false;
  let gapSourcePlayer = -1;
  const gapChoiceRects = [];

  let _ctx = null;
  let _host = null;

  const AI_HAND_POSITIONS = [
    null,
    { x: 10, y: 160, dir: 'vertical', label: PLAYER_NAMES[1] },
    { x: 250, y: 10, dir: 'horizontal', label: PLAYER_NAMES[2] },
    { x: CANVAS_W - 10 - CE.CARD_W * 0.55, y: 160, dir: 'vertical', label: PLAYER_NAMES[3] }
  ];

  const DISCARD_X = CANVAS_W / 2 - CE.CARD_W / 2;
  const DISCARD_Y = 240;
  const DRAW_PILE_X = CANVAS_W / 2 - CE.CARD_W - 25;
  const DRAW_PILE_Y = 240;

  function playerCardX(idx, total) {
    const maxWidth = 680;
    const fanWidth = Math.min(maxWidth, total * 55);
    const spacing = total > 1 ? fanWidth / (total - 1) : 0;
    const startX = (CANVAS_W - fanWidth) / 2;
    return startX + idx * spacing;
  }

  function playerCardY() {
    return CANVAS_H - CE.CARD_H - 25;
  }

  function createDeck() {
    const d = [];
    for (const def of CARD_DEFS)
      for (let i = 0; i < def.count; ++i)
        d.push({ color: 'wild', value: def.value, type: 'wild' });
    return d;
  }

  function reshuffleDeck() {
    if (deck.length > 0) return;
    if (discardPile.length <= 1) return;
    const top = discardPile.pop();
    deck = CE.shuffle(discardPile.splice(0));
    discardPile.push(top);
  }

  function drawFromDeck() {
    if (deck.length === 0) reshuffleDeck();
    return deck.length > 0 ? deck.pop() : null;
  }

  const rainbowColors = ['#e33', '#33e', '#3a3', '#ea0', '#e3e', '#3ee'];

  function drawWildCard(x, y, w, h, card, faceDown) {
    _ctx.save();
    if (faceDown) {
      CE.drawCardBack(_ctx, x, y, w, h);
      _ctx.restore();
      return;
    }

    _ctx.save();
    _ctx.beginPath();
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.clip();

    const grad = _ctx.createLinearGradient(x, y, x + w, y + h);
    for (let i = 0; i < rainbowColors.length; ++i)
      grad.addColorStop(i / (rainbowColors.length - 1), rainbowColors[i]);
    _ctx.fillStyle = grad;
    _ctx.fillRect(x, y, w, h);

    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    _ctx.fillRect(x, y, w, h);
    _ctx.restore();

    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 1.5;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.stroke();

    _ctx.fillStyle = '#fff';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    const cx = x + w / 2;
    const cy = y + h / 2;
    const val = card.value;

    if (val === 'Wild') {
      _ctx.font = 'bold 20px sans-serif';
      _ctx.fillText('W', cx, cy);
    } else if (val === 'Wild Draw Two') {
      _ctx.font = 'bold 18px sans-serif';
      _ctx.fillText('+2', cx, cy - 6);
      _ctx.font = '9px sans-serif';
      _ctx.fillText('DRAW TWO', cx, cy + 14);
    } else if (val === 'Wild Reverse') {
      _ctx.font = 'bold 22px sans-serif';
      _ctx.fillText('\u21C4', cx, cy - 4);
      _ctx.font = '8px sans-serif';
      _ctx.fillText('REVERSE', cx, cy + 14);
    } else if (val === 'Wild Skip') {
      _ctx.font = 'bold 22px sans-serif';
      _ctx.fillText('\u2718', cx, cy - 4);
      _ctx.font = '8px sans-serif';
      _ctx.fillText('SKIP', cx, cy + 14);
    } else if (val === 'Wild Forced Swap') {
      _ctx.font = 'bold 18px sans-serif';
      _ctx.fillText('\u21CB', cx, cy - 4);
      _ctx.font = '8px sans-serif';
      _ctx.fillText('SWAP', cx, cy + 14);
    } else if (val === 'Wild Targeted Draw Two') {
      _ctx.font = 'bold 16px sans-serif';
      _ctx.fillText('\u2691+2', cx, cy - 4);
      _ctx.font = '8px sans-serif';
      _ctx.fillText('TARGET', cx, cy + 14);
    } else if (val === 'Wild Gap') {
      _ctx.font = 'bold 18px sans-serif';
      _ctx.fillText('\u23ED', cx, cy - 4);
      _ctx.font = '8px sans-serif';
      _ctx.fillText('GAP', cx, cy + 14);
    }

    _ctx.font = 'bold 8px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText(getShortLabel(val), x + 4, y + 4);

    _ctx.restore();
  }

  function getShortLabel(val) {
    switch (val) {
      case 'Wild': return 'W';
      case 'Wild Draw Two': return '+2';
      case 'Wild Reverse': return 'REV';
      case 'Wild Skip': return 'SKP';
      case 'Wild Forced Swap': return 'SWP';
      case 'Wild Targeted Draw Two': return 'T+2';
      case 'Wild Gap': return 'GAP';
      default: return '?';
    }
  }

  function findLeadingOpponent(excludePlayer) {
    let bestP = -1;
    let fewest = Infinity;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === excludePlayer) continue;
      if (hands[p].length < fewest) {
        fewest = hands[p].length;
        bestP = p;
      }
    }
    return bestP;
  }

  function aiChooseCard(playerIdx) {
    const hand = hands[playerIdx];
    if (hand.length === 0) return -1;

    const leader = findLeadingOpponent(playerIdx);
    const nextP = nextPlayer(playerIdx);

    const priorities = [];
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      let prio = 0;
      switch (c.value) {
        case 'Wild Targeted Draw Two':
          prio = 10;
          break;
        case 'Wild Forced Swap':
          prio = hand.length > hands[leader].length ? 1 : 9;
          break;
        case 'Wild Draw Two':
          prio = nextP === leader ? 8 : 5;
          break;
        case 'Wild Skip':
          prio = nextP === leader ? 2 : 6;
          break;
        case 'Wild Reverse':
          prio = 5;
          break;
        case 'Wild Gap':
          prio = 4;
          break;
        case 'Wild':
          prio = 3;
          break;
      }
      priorities.push({ idx: i, prio: prio });
    }

    priorities.sort(function(a, b) { return b.prio - a.prio; });
    return priorities[0].idx;
  }

  function nextPlayer(from) {
    return ((from + direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function advancePlayer() {
    currentPlayer = nextPlayer(currentPlayer);
  }

  function playCard(playerIdx, cardIdx) {
    if (roundOver || gameOver) return false;
    const hand = hands[playerIdx];
    if (cardIdx < 0 || cardIdx >= hand.length) return false;

    const card = hand.splice(cardIdx, 1)[0];
    discardPile.push(card);
    topCard = card;

    return resolveAction(card, playerIdx);
  }

  function resolveAction(card, playerIdx) {
    const val = card.value;

    switch (val) {
      case 'Wild':
        if (!checkWin(playerIdx)) advancePlayer();
        break;

      case 'Wild Skip': {
        if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Skip!', { color: '#ff0', size: 16 });
        if (!checkWin(playerIdx)) {
          advancePlayer();
          advancePlayer();
        }
        break;
      }

      case 'Wild Reverse': {
        direction = -direction;
        if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Reverse!', { color: '#0ff', size: 16 });
        if (!checkWin(playerIdx)) advancePlayer();
        break;
      }

      case 'Wild Draw Two': {
        if (!checkWin(playerIdx)) {
          advancePlayer();
          const target = currentPlayer;
          for (let i = 0; i < 2; ++i) {
            const c = drawFromDeck();
            if (c) hands[target].push(c);
          }
          if (_host) {
            const name = target === 0 ? 'You draw' : PLAYER_NAMES[target] + ' draws';
            _host.floatingText.add(CANVAS_W / 2, 200, name + ' 2!', { color: '#f88', size: 16 });
          }
          advancePlayer();
        }
        break;
      }

      case 'Wild Forced Swap': {
        if (checkWin(playerIdx)) break;
        if (playerIdx === 0) {
          waitingForTargetChoice = true;
          targetAction = 'swap';
          targetSourcePlayer = playerIdx;
          targetCard = card;
          return true;
        }
        const swapTarget = findLeadingOpponent(playerIdx);
        executeSwap(playerIdx, swapTarget);
        advancePlayer();
        break;
      }

      case 'Wild Targeted Draw Two': {
        if (checkWin(playerIdx)) break;
        if (playerIdx === 0) {
          waitingForTargetChoice = true;
          targetAction = 'targetdraw';
          targetSourcePlayer = playerIdx;
          targetCard = card;
          return true;
        }
        const drawTarget = findLeadingOpponent(playerIdx);
        executeTargetedDraw(drawTarget);
        advancePlayer();
        break;
      }

      case 'Wild Gap': {
        if (checkWin(playerIdx)) break;
        if (playerIdx === 0) {
          waitingForGapChoice = true;
          gapSourcePlayer = playerIdx;
          return true;
        }
        executeGap(1, playerIdx);
        break;
      }
    }

    return true;
  }

  function executeSwap(fromPlayer, withPlayer) {
    const tmp = hands[fromPlayer];
    hands[fromPlayer] = hands[withPlayer];
    hands[withPlayer] = tmp;
    if (_host) {
      const from = fromPlayer === 0 ? 'You' : PLAYER_NAMES[fromPlayer];
      const to = withPlayer === 0 ? 'you' : PLAYER_NAMES[withPlayer];
      _host.floatingText.add(CANVAS_W / 2, 200, from + ' swapped with ' + to + '!', { color: '#ff0', size: 16 });
    }
  }

  function executeTargetedDraw(targetPlayer) {
    for (let i = 0; i < 2; ++i) {
      const c = drawFromDeck();
      if (c) hands[targetPlayer].push(c);
    }
    if (_host) {
      const name = targetPlayer === 0 ? 'You draw' : PLAYER_NAMES[targetPlayer] + ' draws';
      _host.floatingText.add(CANVAS_W / 2, 200, name + ' 2!', { color: '#f88', size: 16 });
    }
  }

  function executeGap(gapCount, fromPlayer) {
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 200, 'Gap ' + gapCount + '!', { color: '#e3e', size: 16 });
    currentPlayer = fromPlayer;
    for (let i = 0; i <= gapCount; ++i)
      currentPlayer = nextPlayer(currentPlayer);
  }

  function checkWin(playerIdx) {
    if (hands[playerIdx].length > 0) return false;

    roundOver = true;
    if (_host) {
      const label = playerIdx === 0 ? 'YOU WIN!' : PLAYER_NAMES[playerIdx] + ' WINS!';
      const color = playerIdx === 0 ? '#4f4' : '#f44';
      _host.floatingText.add(CANVAS_W / 2, 300, label, { color: color, size: 28 });
    }

    if (playerIdx === 0) {
      let pts = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        pts += hands[p].length * 10;
      score += pts;
      if (_host) {
        _host.addGlow(60, 420, 600, CE.CARD_H, 2);
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    }

    if (_host) _host.onScoreChanged(score);
    return true;
  }

  function aiTurn() {
    if (roundOver || gameOver) return;
    if (waitingForTargetChoice || waitingForGapChoice) return;

    const hand = hands[currentPlayer];
    const cardIdx = aiChooseCard(currentPlayer);

    if (cardIdx >= 0) {
      playCard(currentPlayer, cardIdx);
      return;
    }

    const drawn = drawFromDeck();
    if (drawn) {
      hand.push(drawn);
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, PLAYER_NAMES[currentPlayer] + ' draws', { color: '#aaa', size: 14 });
    }
    advancePlayer();
  }

  function setupGame() {
    deck = CE.shuffle(createDeck());
    hands = [[], [], [], []];
    discardPile = [];
    currentPlayer = 0;
    direction = 1;
    roundOver = false;
    gameOver = false;
    aiTurnTimer = 0;
    hoverCardIdx = -1;
    waitingForTargetChoice = false;
    waitingForGapChoice = false;
    targetAction = null;
    targetSourcePlayer = -1;
    targetCard = null;
    gapSourcePlayer = -1;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (let i = 0; i < HAND_SIZE; ++i)
        hands[p].push(deck.pop());

    topCard = deck.pop();
    discardPile.push(topCard);

    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, hands[0].length), playerCardY(), i * 0.1);

    if (topCard.value === 'Wild Skip')
      advancePlayer();
    else if (topCard.value === 'Wild Reverse')
      direction = -direction;
    else if (topCard.value === 'Wild Draw Two') {
      for (let i = 0; i < 2; ++i) {
        const c = drawFromDeck();
        if (c) hands[0].push(c);
      }
      advancePlayer();
    }
  }

  function drawTargetChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.65)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';

    const title = targetAction === 'swap' ? 'Swap hands with:' : 'Choose target to draw 2:';
    _ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 60);

    targetChoiceRects.length = 0;
    const btnW = 140;
    const btnH = 40;
    const gap = 20;

    const targets = [];
    for (let p = 1; p < NUM_PLAYERS; ++p)
      targets.push(p);

    const totalW = targets.length * btnW + (targets.length - 1) * gap;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 10;

    for (let i = 0; i < targets.length; ++i) {
      const bx = startX + i * (btnW + gap);
      const p = targets[i];
      const label = PLAYER_NAMES[p] + ' (' + hands[p].length + ' cards)';

      _ctx.fillStyle = targetAction === 'swap' ? '#4a4' : '#a44';
      CE.drawRoundedRect(_ctx, bx, y, btnW, btnH, 6);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();

      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 12px sans-serif';
      _ctx.fillText(label, bx + btnW / 2, y + btnH / 2);

      targetChoiceRects.push({ x: bx, y: y, w: btnW, h: btnH, target: p });
    }

    _ctx.restore();
  }

  function drawGapChoiceOverlay() {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.65)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Skip how many players? (1\u20133)', CANVAS_W / 2, CANVAS_H / 2 - 60);

    gapChoiceRects.length = 0;
    const btnW = 80;
    const btnH = 50;
    const gapSize = 20;

    const options = [1, 2, 3];
    const totalW = options.length * btnW + (options.length - 1) * gapSize;
    const startX = (CANVAS_W - totalW) / 2;
    const y = CANVAS_H / 2 - 10;

    for (let i = 0; i < options.length; ++i) {
      const bx = startX + i * (btnW + gapSize);
      const n = options[i];

      _ctx.fillStyle = '#649';
      CE.drawRoundedRect(_ctx, bx, y, btnW, btnH, 6);
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();

      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 20px sans-serif';
      _ctx.fillText(String(n), bx + btnW / 2, y + btnH / 2);

      gapChoiceRects.push({ x: bx, y: y, w: btnW, h: btnH, gapCount: n });
    }

    _ctx.restore();
  }

  function drawDirectionIndicator() {
    _ctx.save();
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    const arrow = direction === 1 ? '\u21BB' : '\u21BA';
    _ctx.fillText('Direction: ' + arrow, CANVAS_W / 2, 225);
    _ctx.restore();
  }

  function drawCurrentPlayerIndicator() {
    if (roundOver || gameOver) return;
    _ctx.save();
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'center';

    if (currentPlayer === 0) {
      _ctx.fillText('\u25BC', CANVAS_W / 2, playerCardY() - 8);
    } else {
      const pos = AI_HAND_POSITIONS[currentPlayer];
      if (pos) {
        if (pos.dir === 'vertical')
          _ctx.fillText('\u25B6', pos.x - 10, pos.y + 20);
        else
          _ctx.fillText('\u25BC', pos.x + 40, pos.y - 4);
      }
    }
    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = hands[0];
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = playerCardY();

      if (i === hoverCardIdx && currentPlayer === 0 && !waitingForTargetChoice && !waitingForGapChoice)
        y -= 12;

      drawWildCard(x, y, CE.CARD_W, CE.CARD_H, hand[i], false);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !waitingForTargetChoice && !waitingForGapChoice && !roundOver && !gameOver)
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }
  }

  function drawAIHands() {
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const hand = hands[p];
      const pos = AI_HAND_POSITIONS[p];
      if (!pos) continue;

      const count = hand.length;
      const isCurrent = currentPlayer === p && !roundOver && !gameOver;

      _ctx.fillStyle = isCurrent ? '#ff0' : '#aaa';
      _ctx.font = isCurrent ? 'bold 11px sans-serif' : '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';

      if (pos.dir === 'vertical') {
        const labelX = p === 1 ? pos.x : pos.x - 10;
        _ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', labelX, pos.y - 16);
        for (let i = 0; i < Math.min(count, 10); ++i) {
          const cy = pos.y + i * 16;
          CE.drawCardBack(_ctx, pos.x, cy, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
        if (count > 10) {
          _ctx.fillStyle = '#aaa';
          _ctx.font = '10px sans-serif';
          _ctx.fillText('+' + (count - 10), pos.x + 5, pos.y + 10 * 16 + 4);
        }
      } else {
        _ctx.fillText(PLAYER_NAMES[p] + ' (' + count + ')', pos.x, pos.y - 2);
        for (let i = 0; i < Math.min(count, 14); ++i) {
          const cx = pos.x + i * 22;
          CE.drawCardBack(_ctx, cx, pos.y + 14, CE.CARD_W * 0.55, CE.CARD_H * 0.55);
        }
        if (count > 14) {
          _ctx.fillStyle = '#aaa';
          _ctx.font = '10px sans-serif';
          _ctx.fillText('+' + (count - 14), pos.x + 14 * 22 + 5, pos.y + 20);
        }
      }
    }
  }

  function drawGame() {
    if (topCard)
      drawWildCard(DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, topCard, false);

    CE.drawCardBack(_ctx, DRAW_PILE_X, DRAW_PILE_Y, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(String(deck.length), DRAW_PILE_X + CE.CARD_W / 2, DRAW_PILE_Y + CE.CARD_H + 14);

    drawDirectionIndicator();
    drawCurrentPlayerIndicator();
    drawAIHands();
    drawPlayerHand();

    if (!roundOver && !gameOver && currentPlayer === 0 && !waitingForTargetChoice && !waitingForGapChoice) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play, or click deck to draw', CANVAS_W / 2, CANVAS_H - 8);
    }

    if (roundOver) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H - 8);
    }

    if (waitingForTargetChoice)
      drawTargetChoiceOverlay();

    if (waitingForGapChoice)
      drawGapChoiceOverlay();
  }

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGame();
    },

    handleClick(mx, my) {
      if (waitingForTargetChoice) {
        for (const r of targetChoiceRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForTargetChoice = false;
            if (targetAction === 'swap')
              executeSwap(targetSourcePlayer, r.target);
            else if (targetAction === 'targetdraw')
              executeTargetedDraw(r.target);
            targetAction = null;
            targetCard = null;
            if (!checkWin(targetSourcePlayer)) advancePlayer();
            targetSourcePlayer = -1;
            return;
          }
        }
        return;
      }

      if (waitingForGapChoice) {
        for (const r of gapChoiceRects) {
          if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
            waitingForGapChoice = false;
            const from = gapSourcePlayer;
            gapSourcePlayer = -1;
            currentPlayer = from;
            for (let i = 0; i <= r.gapCount; ++i)
              currentPlayer = nextPlayer(currentPlayer);
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 200, 'Gap ' + r.gapCount + '!', { color: '#e3e', size: 16 });
            return;
          }
        }
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (currentPlayer === 0) {
        const hand = hands[0];
        const total = hand.length;
        for (let i = total - 1; i >= 0; --i) {
          const cx = playerCardX(i, total);
          const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
          const hitW = rightEdge - cx;
          if (CE.isInRect(mx, my, cx, playerCardY(), hitW, CE.CARD_H)) {
            playCard(0, i);
            return;
          }
        }

        if (CE.isInRect(mx, my, DRAW_PILE_X, DRAW_PILE_Y, CE.CARD_W, CE.CARD_H)) {
          const drawn = drawFromDeck();
          if (drawn) {
            hands[0].push(drawn);
            if (_host) _host.floatingText.add(CANVAS_W / 2, 400, 'Drew a card', { color: '#aaa', size: 14 });
          }
          advancePlayer();
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver || waitingForTargetChoice || waitingForGapChoice) return;
      if (currentPlayer !== 0) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const idx = num - 1;
        if (idx < hands[0].length)
          playCard(0, idx);
      }
    },

    tick(dt) {
      if (roundOver || gameOver || waitingForTargetChoice || waitingForGapChoice) return;

      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTurn();
        }
      }
    },

    handlePointerMove(mx, my) {
      if (currentPlayer !== 0 || waitingForTargetChoice || waitingForGapChoice) {
        hoverCardIdx = -1;
        return;
      }
      const hand = hands[0];
      const total = hand.length;
      hoverCardIdx = -1;
      for (let i = total - 1; i >= 0; --i) {
        const cx = playerCardX(i, total);
        const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
        const hitW = rightEdge - cx;
        if (CE.isInRect(mx, my, cx, playerCardY(), hitW, CE.CARD_H)) {
          hoverCardIdx = i;
          break;
        }
      }
    },

    handlePointerUp() {},

    cleanup() {
      hands = [[], [], [], []];
      deck = [];
      discardPile = [];
      topCard = null;
      direction = 1;
      currentPlayer = 0;
      roundOver = false;
      gameOver = false;
      aiTurnTimer = 0;
      hoverCardIdx = -1;
      waitingForTargetChoice = false;
      waitingForGapChoice = false;
      targetAction = null;
      targetSourcePlayer = -1;
      targetCard = null;
      gapSourcePlayer = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('unowild', module);

})();
