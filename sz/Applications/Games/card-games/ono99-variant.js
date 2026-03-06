;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 4;
  const AI_TURN_DELAY = 0.8;

  let hands = [];
  let deck = [];
  let discardPile = [];
  let runningTotal = 0;
  let currentPlayer = 0;
  let direction = 1;
  let eliminated = [];
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let doublePlayCount = 0;
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;

  const cardColors = { number: '#2a6', Hold: '#47c', Reverse: '#c47', 'Double Play': '#c74', 'Minus 10': '#74c' };

  function createDeck() {
    const d = [];
    for (let n = 0; n <= 9; ++n)
      for (let i = 0; i < 4; ++i)
        d.push({ color: '#2a6', value: String(n), type: 'number', pointValue: n });
    for (let i = 0; i < 4; ++i)
      d.push({ color: '#47c', value: 'Hold', type: 'special', pointValue: 0 });
    for (let i = 0; i < 4; ++i)
      d.push({ color: '#c47', value: 'Reverse', type: 'special', pointValue: 0 });
    for (let i = 0; i < 4; ++i)
      d.push({ color: '#c74', value: 'Double Play', type: 'special', pointValue: 0 });
    for (let i = 0; i < 2; ++i)
      d.push({ color: '#74c', value: 'Minus 10', type: 'special', pointValue: -10 });
    return d;
  }

  function drawOno99Card(x, y, w, h, card) {
    _ctx.save();
    _ctx.fillStyle = card.color || '#2a6';
    _ctx.strokeStyle = '#fff';
    _ctx.lineWidth = 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();
    _ctx.fillStyle = 'rgba(255,255,255,0.2)';
    _ctx.beginPath();
    _ctx.ellipse(x + w / 2, y + h / 2, w / 3, h / 2.5, -0.3, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    const label = card.value === 'Hold' ? 'H' : card.value === 'Reverse' ? '\u21C4' : card.value === 'Double Play' ? '\u00D72' : card.value === 'Minus 10' ? '-10' : card.value;
    _ctx.fillText(label, x + w / 2, y + h / 2);
    _ctx.restore();
  }

  function getNextAlive(from) {
    let p = from;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      p = (p + direction + NUM_PLAYERS) % NUM_PLAYERS;
      if (!eliminated[p]) return p;
    }
    return from;
  }

  function aliveCount() {
    let c = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!eliminated[i]) ++c;
    return c;
  }

  function refillDeck() {
    if (deck.length > 0) return;
    if (discardPile.length <= 1) return;
    const top = discardPile.pop();
    deck = CE.shuffle(discardPile);
    discardPile = [top];
  }

  function canPlay(card) {
    if (card.type !== 'number') return true;
    return runningTotal + card.pointValue <= 99;
  }

  function canPlayAny(playerIndex) {
    for (const c of hands[playerIndex])
      if (canPlay(c)) return true;
    return false;
  }

  function eliminatePlayer(playerIndex) {
    eliminated[playerIndex] = true;
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 250, (playerIndex === 0 ? 'YOU' : 'AI ' + playerIndex) + ' BUSTED!', { color: '#f44', size: 22 });
  }

  function checkGameEnd() {
    if (aliveCount() <= 1) {
      roundOver = true;
      let winner = -1;
      for (let i = 0; i < NUM_PLAYERS; ++i)
        if (!eliminated[i]) winner = i;
      if (winner === 0) {
        score += 100;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      } else if (_host)
        _host.floatingText.add(CANVAS_W / 2, 300, (winner >= 0 ? 'AI ' + winner : 'Nobody') + ' WINS!', { color: '#f44', size: 28 });
      if (_host) _host.onScoreChanged(score);
      return true;
    }
    return false;
  }

  function playCard(playerIndex, cardIndex) {
    const hand = hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    discardPile.push(card);

    if (card.type === 'number')
      runningTotal += card.pointValue;
    else if (card.value === 'Minus 10')
      runningTotal = Math.max(0, runningTotal - 10);
    else if (card.value === 'Reverse')
      direction = -direction;
    else if (card.value === 'Double Play')
      doublePlayCount = 2;

    refillDeck();
    if (deck.length > 0)
      hand.push(deck.pop());

    if (checkGameEnd()) return true;

    if (doublePlayCount <= 0)
      currentPlayer = getNextAlive(currentPlayer);
    else {
      --doublePlayCount;
      if (doublePlayCount <= 0)
        currentPlayer = getNextAlive(currentPlayer);
    }
    return true;
  }

  function aiTurn() {
    if (roundOver || gameOver || eliminated[currentPlayer]) return;
    if (!canPlayAny(currentPlayer)) {
      eliminatePlayer(currentPlayer);
      if (!checkGameEnd())
        currentPlayer = getNextAlive(currentPlayer);
      return;
    }

    const hand = hands[currentPlayer];
    // Near 99: prefer specials
    if (runningTotal >= 85) {
      for (let i = 0; i < hand.length; ++i)
        if (hand[i].value === 'Hold' || hand[i].value === 'Minus 10') { playCard(currentPlayer, i); return; }
      for (let i = 0; i < hand.length; ++i)
        if (hand[i].value === 'Reverse' || hand[i].value === 'Double Play') { playCard(currentPlayer, i); return; }
    }
    // Play highest safe number
    let bestIdx = -1, bestVal = -1;
    for (let i = 0; i < hand.length; ++i) {
      if (hand[i].type === 'number' && canPlay(hand[i]) && hand[i].pointValue > bestVal) {
        bestVal = hand[i].pointValue;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) { playCard(currentPlayer, bestIdx); return; }
    // Any playable
    for (let i = 0; i < hand.length; ++i)
      if (canPlay(hand[i])) { playCard(currentPlayer, i); return; }
  }

  function setupGame() {
    deck = CE.shuffle(createDeck());
    hands = [];
    eliminated = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      hands.push([]);
      eliminated.push(false);
      for (let i = 0; i < 4; ++i)
        hands[p].push(deck.pop());
    }
    discardPile = [];
    runningTotal = 0;
    currentPlayer = 0;
    direction = 1;
    roundOver = false;
    gameOver = false;
    doublePlayCount = 0;
    aiTurnTimer = 0;
    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 250 + i * 70, 460, i * 0.1);
  }

  const playerPos = [
    { x: CANVAS_W / 2, y: CANVAS_H - 70, label: 'You' },
    { x: 70, y: CANVAS_H / 2, label: 'AI 1' },
    { x: CANVAS_W / 2, y: 40, label: 'AI 2' },
    { x: CANVAS_W - 70, y: CANVAS_H / 2, label: 'AI 3' },
  ];

  function drawGame() {
    // Running total
    const tc = runningTotal < 50 ? '#4f4' : runningTotal < 70 ? '#ff0' : runningTotal < 85 ? '#fa0' : '#f44';
    _ctx.fillStyle = tc;
    _ctx.font = 'bold 52px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(String(runningTotal), CANVAS_W / 2, CANVAS_H / 2 - 10);
    _ctx.font = '13px sans-serif';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Total (bust at 99)', CANVAS_W / 2, CANVAS_H / 2 + 28);

    // Discard
    if (discardPile.length > 0)
      drawOno99Card(CANVAS_W / 2 + 90, CANVAS_H / 2 - CE.CARD_H / 2, CE.CARD_W, CE.CARD_H, discardPile[discardPile.length - 1]);
    // Draw pile
    if (deck.length > 0)
      CE.drawCardBack(_ctx, CANVAS_W / 2 - 90 - CE.CARD_W, CANVAS_H / 2 - CE.CARD_H / 2, CE.CARD_W, CE.CARD_H);

    // Player hand
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      drawOno99Card(250 + i * 70, 460, CE.CARD_W, CE.CARD_H, hands[0][i]);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !eliminated[0] && !roundOver && !gameOver && canPlay(hands[0][i]))
        CE.drawHintGlow(_ctx, 250 + i * 70, 460, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    // AI hands + labels
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      _ctx.fillStyle = eliminated[p] ? '#666' : currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(pp.label + ' (' + hands[p].length + ')', pp.x, pp.y - 10);
      if (eliminated[p]) {
        _ctx.fillStyle = '#f44';
        _ctx.font = 'bold 22px sans-serif';
        _ctx.fillText('X', pp.x, pp.y + 25);
      } else
        for (let i = 0; i < Math.min(hands[p].length, 4); ++i)
          CE.drawCardBack(_ctx, pp.x - 25 + i * 14, pp.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Status
    if (eliminated[0]) {
      _ctx.fillStyle = '#f44';
      _ctx.font = 'bold 18px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('ELIMINATED', CANVAS_W / 2, 435);
    } else if (!roundOver && !gameOver && currentPlayer === 0) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Your turn \u2014 click a card to play', CANVAS_W / 2, CANVAS_H - 12);
    }

    // Direction arrow
    _ctx.fillStyle = '#888';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2, CANVAS_H / 2 + 50);
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
      if (roundOver || gameOver) { if (_host) _host.onRoundOver(gameOver); return; }
      if (currentPlayer !== 0 || eliminated[0]) return;
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = 250 + i * 70;
        if (CE.isInRect(mx, my, cx, 460, CE.CARD_W, CE.CARD_H)) {
          if (!canPlayAny(0)) {
            eliminatePlayer(0);
            if (!checkGameEnd()) currentPlayer = getNextAlive(0);
            return;
          }
          if (!canPlay(hands[0][i])) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Would bust!', { color: '#f88', size: 14 });
            return;
          }
          playCard(0, i);
          return;
        }
      }
    },
    handleKey(e) {},
    handlePointerMove() {},
    handlePointerUp() {},
    tick(dt) {
      if (roundOver || gameOver) return;
      if (eliminated[currentPlayer]) { currentPlayer = getNextAlive(currentPlayer); return; }
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) { aiTurnTimer = 0; aiTurn(); }
      }
    },
    cleanup() {
      hands = []; deck = []; discardPile = []; eliminated = [];
      runningTotal = 0; roundOver = false; gameOver = false; aiTurnTimer = 0;
      _ctx = null; _host = null;
    },
    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('ono99', module);

})();
