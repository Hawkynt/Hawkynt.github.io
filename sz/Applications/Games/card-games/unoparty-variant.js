;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const AI_SCALE = 0.45;
  const AI_CARD_W = (CE.CARD_W * AI_SCALE) | 0;
  const AI_CARD_H = (CE.CARD_H * AI_SCALE) | 0;

  const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];
  const COLOR_HEX = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f', wild: '#2c3e50' };
  const COLOR_DARK = { red: '#c0392b', blue: '#2980b9', green: '#27ae60', yellow: '#d4ac0f', wild: '#1a252f' };

  const PLAYER_COUNT = 6;
  const DEAL_COUNT = 7;
  const WIN_SCORE = 500;

  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3', 'AI 4', 'AI 5'];
  const AI_TURN_DELAY = 0.7;

  // Hexagonal layout positions for 6 players
  const PLAYER_POS = [
    { x: CANVAS_W / 2, y: CANVAS_H - 55, labelY: CANVAS_H - 90 },        // 0: bottom center (human)
    { x: 75, y: CANVAS_H * 0.65, labelY: CANVAS_H * 0.65 - 35 },          // 1: bottom-left
    { x: 75, y: CANVAS_H * 0.25, labelY: CANVAS_H * 0.25 - 35 },          // 2: top-left
    { x: CANVAS_W / 2, y: 50, labelY: 22 },                                // 3: top center
    { x: CANVAS_W - 75, y: CANVAS_H * 0.25, labelY: CANVAS_H * 0.25 - 35 }, // 4: top-right
    { x: CANVAS_W - 75, y: CANVAS_H * 0.65, labelY: CANVAS_H * 0.65 - 35 }, // 5: bottom-right
  ];

  let hands = [];
  let deck = [];
  let discardPile = [];
  let currentPlayer = 0;
  let direction = 1;
  let currentColor = '';
  let drawPending = 0;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let colorChoiceActive = false;
  let tradeChoiceActive = false;
  let pendingWildIndex = -1;
  let pendingTradeType = ''; // 'trade'
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;

  function createPartyDeck() {
    const d = [];
    // Double standard Uno deck
    for (let copy = 0; copy < 2; ++copy) {
      for (const color of UNO_COLORS) {
        d.push({ color, value: '0', type: 'number' });
        for (let n = 1; n <= 9; ++n)
          for (let c = 0; c < 2; ++c)
            d.push({ color, value: String(n), type: 'number' });
        for (let c = 0; c < 2; ++c)
          d.push({ color, value: 'Skip', type: 'action' });
        for (let c = 0; c < 2; ++c)
          d.push({ color, value: 'Reverse', type: 'action' });
        for (let c = 0; c < 2; ++c)
          d.push({ color, value: 'Draw Two', type: 'action' });
      }
    }
    // Party Wild cards (replace 16 standard wilds from double deck)
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild Everyone Draw', type: 'party' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild Trade Hands', type: 'party' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild Discard All', type: 'party' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild Pick Color', type: 'party' });
    return d;
  }

  function cardLabel(card) {
    if (card.value === 'Skip') return '\u00D8';
    if (card.value === 'Reverse') return '\u21C4';
    if (card.value === 'Draw Two') return '+2';
    if (card.value === 'Wild Everyone Draw') return 'WED';
    if (card.value === 'Wild Trade Hands') return 'WTH';
    if (card.value === 'Wild Discard All') return 'WDA';
    if (card.value === 'Wild Pick Color') return 'W';
    return card.value;
  }

  function drawPartyCard(x, y, w, h, card, highlight) {
    _ctx.save();
    const col = card.color;
    if (col === 'wild') {
      // Rainbow gradient for party wilds
      const grad = _ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#e33');
      grad.addColorStop(0.33, '#3a3');
      grad.addColorStop(0.66, '#33e');
      grad.addColorStop(1, '#ea0');
      _ctx.fillStyle = grad;
    } else
      _ctx.fillStyle = COLOR_HEX[col] || '#555';
    _ctx.strokeStyle = highlight ? '#ff0' : '#fff';
    _ctx.lineWidth = highlight ? 3 : 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();
    // White ellipse
    _ctx.fillStyle = 'rgba(255,255,255,0.6)';
    _ctx.beginPath();
    _ctx.ellipse(x + w / 2, y + h / 2, w / 3.5, h / 4, 0, 0, Math.PI * 2);
    _ctx.fill();
    // Label
    _ctx.fillStyle = col === 'wild' ? '#fff' : (COLOR_DARK[col] || '#333');
    _ctx.font = 'bold 13px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(cardLabel(card), x + w / 2, y + h / 2);
    _ctx.restore();
  }

  function canPlay(card) {
    if (drawPending > 0) {
      return card.value === 'Draw Two' || card.value === 'Wild Everyone Draw';
    }
    if (card.type === 'party') return true;
    if (card.color === currentColor) return true;
    const top = discardPile[discardPile.length - 1];
    if (top && card.value === top.value) return true;
    return false;
  }

  function refillDeck() {
    if (deck.length > 0) return;
    if (discardPile.length <= 1) return;
    const top = discardPile.pop();
    deck = CE.shuffle(discardPile);
    discardPile = [top];
  }

  function drawCards(playerIndex, count) {
    for (let i = 0; i < count; ++i) {
      refillDeck();
      if (deck.length > 0)
        hands[playerIndex].push(deck.pop());
    }
  }

  function nextPlayer() {
    currentPlayer = (currentPlayer + direction + PLAYER_COUNT) % PLAYER_COUNT;
  }

  function cardPoints(card) {
    if (card.type === 'party') return 50;
    if (card.value === 'Skip' || card.value === 'Reverse' || card.value === 'Draw Two') return 20;
    return parseInt(card.value) || 0;
  }

  function checkWin(playerIndex) {
    if (hands[playerIndex].length > 0) return false;
    roundOver = true;
    let pts = 0;
    for (let p = 0; p < PLAYER_COUNT; ++p)
      if (p !== playerIndex)
        for (const c of hands[p])
          pts += cardPoints(c);
    if (playerIndex === 0) {
      score += pts;
      if (score >= WIN_SCORE) gameOver = true;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN! +' + pts, { color: '#4f4', size: 28 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.onScoreChanged(score);
      }
    } else {
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[playerIndex] + ' WINS!', { color: '#f44', size: 28 });
        _host.onScoreChanged(score);
      }
    }
    return true;
  }

  function playCard(playerIndex, cardIndex, chosenColor) {
    const hand = hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    discardPile.push(card);

    // Handle actions
    if (card.value === 'Skip') {
      if (card.color !== 'wild') currentColor = card.color;
      nextPlayer(); // skip
    } else if (card.value === 'Reverse') {
      if (card.color !== 'wild') currentColor = card.color;
      if (PLAYER_COUNT === 2) nextPlayer();
      else direction = -direction;
    } else if (card.value === 'Draw Two') {
      if (card.color !== 'wild') currentColor = card.color;
      drawPending += 2;
    } else if (card.value === 'Wild Everyone Draw') {
      currentColor = chosenColor || currentColor;
      // All other players draw 2
      for (let p = 0; p < PLAYER_COUNT; ++p)
        if (p !== playerIndex)
          drawCards(p, 2);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 250, 'Everyone draws 2!', { color: '#f88', size: 18 });
    } else if (card.value === 'Wild Trade Hands') {
      currentColor = chosenColor || currentColor;
      // Trade hands — handled after color choice for human, AI picks immediately
      if (playerIndex !== 0) {
        // AI trades with player who has fewest cards (maximize advantage)
        let target = -1, minCards = Infinity;
        for (let p = 0; p < PLAYER_COUNT; ++p)
          if (p !== playerIndex && hands[p].length < minCards) { minCards = hands[p].length; target = p; }
        if (target >= 0) {
          const tmp = hands[playerIndex];
          hands[playerIndex] = hands[target];
          hands[target] = tmp;
          if (_host)
            _host.floatingText.add(CANVAS_W / 2, 250, PLAYER_NAMES[playerIndex] + ' trades with ' + PLAYER_NAMES[target] + '!', { color: '#ff0', size: 16 });
        }
      } else {
        // Human — show trade choice overlay after this returns
        pendingTradeType = 'trade';
        tradeChoiceActive = true;
      }
    } else if (card.value === 'Wild Discard All') {
      currentColor = chosenColor || currentColor;
      // Discard all cards of current color from hand
      let discarded = 0;
      for (let i = hand.length - 1; i >= 0; --i)
        if (hand[i].color === currentColor) {
          discardPile.push(hand[i]);
          hand.splice(i, 1);
          ++discarded;
        }
      if (_host && discarded > 0)
        _host.floatingText.add(CANVAS_W / 2, 250, 'Discarded ' + discarded + ' ' + currentColor + ' cards!', { color: '#4f4', size: 16 });
    } else if (card.value === 'Wild Pick Color') {
      currentColor = chosenColor || currentColor;
    } else {
      // Number card
      if (card.color !== 'wild') currentColor = card.color;
    }

    // Uno call
    if (hand.length === 1 && _host)
      _host.floatingText.add(CANVAS_W / 2, 350, 'UNO!', { color: '#0ff', size: 24 });

    if (checkWin(playerIndex)) return true;

    // Don't advance if trade choice pending (human picks target)
    if (tradeChoiceActive) return true;

    nextPlayer();

    // Resolve pending draws
    if (drawPending > 0) {
      const nh = hands[currentPlayer];
      let canStack = false;
      for (const c of nh)
        if (c.value === 'Draw Two') { canStack = true; break; }
      if (!canStack) {
        drawCards(currentPlayer, drawPending);
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 250, PLAYER_NAMES[currentPlayer] + ' draws ' + drawPending + '!', { color: '#f88', size: 16 });
        drawPending = 0;
        nextPlayer();
      }
    }

    return true;
  }

  function aiChooseColor() {
    const hand = hands[currentPlayer];
    const counts = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const c of hand)
      if (c.color !== 'wild' && counts[c.color] !== undefined) ++counts[c.color];
    let best = 'red', bestN = -1;
    for (const c of UNO_COLORS)
      if (counts[c] > bestN) { bestN = counts[c]; best = c; }
    return best;
  }

  function aiTurn() {
    if (roundOver || gameOver) return;
    const hand = hands[currentPlayer];

    // Prefer non-wild playable
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type !== 'party' && canPlay(hand[i])) {
        playCard(currentPlayer, i);
        return;
      }
    // Play party wilds
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type === 'party' && canPlay(hand[i])) {
        playCard(currentPlayer, i, aiChooseColor());
        return;
      }

    // Draw
    refillDeck();
    if (deck.length > 0) {
      const drawn = deck.pop();
      hand.push(drawn);
      if (canPlay(drawn)) {
        const ci = hand.length - 1;
        if (drawn.type === 'party')
          playCard(currentPlayer, ci, aiChooseColor());
        else
          playCard(currentPlayer, ci);
      } else
        nextPlayer();
    } else
      nextPlayer();
  }

  function setupGame() {
    deck = CE.shuffle(createPartyDeck());
    hands = [];
    for (let p = 0; p < PLAYER_COUNT; ++p) {
      hands.push([]);
      for (let i = 0; i < DEAL_COUNT; ++i)
        hands[p].push(deck.pop());
    }
    let first = deck.pop();
    while (first.type === 'party') {
      deck.unshift(first);
      first = deck.pop();
    }
    discardPile = [first];
    currentColor = first.color;
    currentPlayer = 0;
    direction = 1;
    drawPending = 0;
    roundOver = false;
    gameOver = false;
    colorChoiceActive = false;
    tradeChoiceActive = false;
    pendingWildIndex = -1;
    pendingTradeType = '';
    aiTurnTimer = 0;
    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 100 + i * 55, 450, i * 0.1);
  }

  function drawColorOverlay() {
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Choose a color', CANVAS_W / 2, 220);
    for (let i = 0; i < UNO_COLORS.length; ++i) {
      const bx = CANVAS_W / 2 - 140 + i * 75;
      CE.drawButton(_ctx, bx, 245, 65, 36, UNO_COLORS[i].charAt(0).toUpperCase() + UNO_COLORS[i].slice(1), { bg: COLOR_HEX[UNO_COLORS[i]], border: '#fff', fontSize: 12 });
    }
  }

  function drawTradeOverlay() {
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Choose a player to trade hands with', CANVAS_W / 2, 200);
    let col = 0;
    for (let p = 1; p < PLAYER_COUNT; ++p) {
      const bx = CANVAS_W / 2 - 200 + col * 85;
      const by = 230;
      CE.drawButton(_ctx, bx, by, 78, 36, PLAYER_NAMES[p] + ' (' + hands[p].length + ')', { bg: '#446', border: '#88a', fontSize: 11 });
      ++col;
    }
  }

  function drawGame() {
    // Current color bar
    _ctx.fillStyle = COLOR_HEX[currentColor] || '#555';
    _ctx.fillRect(CANVAS_W / 2 - 30, 170, 60, 8);

    // Discard pile
    if (discardPile.length > 0)
      drawPartyCard(CANVAS_W / 2 - CE.CARD_W / 2, 185, CE.CARD_W, CE.CARD_H, discardPile[discardPile.length - 1], false);

    // Draw pile
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 80, 190, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 80, 295);

    // Draw pending
    if (drawPending > 0) {
      _ctx.fillStyle = '#f88';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('+' + drawPending + ' pending', CANVAS_W / 2 + 80, 230);
    }

    // Direction
    _ctx.fillStyle = '#888';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2, 300);

    // Player hand (bottom center)
    const handLen = hands[0].length;
    const cardSpacing = Math.min(55, (CANVAS_W - 200) / Math.max(handLen, 1));
    const handStartX = (CANVAS_W - (handLen - 1) * cardSpacing - CE.CARD_W) / 2;
    for (let i = 0; i < handLen; ++i) {
      if (hands[0][i]._dealing) continue;
      const x = handStartX + i * cardSpacing;
      const playable = !roundOver && !gameOver && currentPlayer === 0 && canPlay(hands[0][i]);
      drawPartyCard(x, 450, CE.CARD_W, CE.CARD_H, hands[0][i], playable);
      if (_host && _host.hintsEnabled && !roundOver && !gameOver && currentPlayer === 0 && !colorChoiceActive && !tradeChoiceActive && canPlay(hands[0][i]))
        CE.drawHintGlow(_ctx, x, 450, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    // AI hands (positions 1-5)
    for (let p = 1; p < PLAYER_COUNT; ++p) {
      const pp = PLAYER_POS[p];
      _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + hands[p].length + ')', pp.x, pp.labelY);
      const maxShow = Math.min(hands[p].length, 7);
      const startX = pp.x - (maxShow * 14) / 2;
      for (let i = 0; i < maxShow; ++i)
        CE.drawCardBack(_ctx, startX + i * 14, pp.labelY + 15, AI_CARD_W, AI_CARD_H);
    }

    // Instructions
    if (!roundOver && !gameOver && currentPlayer === 0 && !colorChoiceActive && !tradeChoiceActive) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      if (drawPending > 0)
        _ctx.fillText('Stack a Draw Two or click the draw pile to accept +' + drawPending, CANVAS_W / 2, CANVAS_H - 8);
      else
        _ctx.fillText('Click a card to play, or click the draw pile to draw', CANVAS_W / 2, CANVAS_H - 8);
    }

    // Overlays
    if (colorChoiceActive) drawColorOverlay();
    if (tradeChoiceActive) drawTradeOverlay();
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

      // Color choice overlay
      if (colorChoiceActive) {
        for (let i = 0; i < UNO_COLORS.length; ++i) {
          const bx = CANVAS_W / 2 - 140 + i * 75;
          if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
            colorChoiceActive = false;
            if (pendingWildIndex >= 0)
              playCard(0, pendingWildIndex, UNO_COLORS[i]);
            pendingWildIndex = -1;
            return;
          }
        }
        return;
      }

      // Trade choice overlay
      if (tradeChoiceActive) {
        let col = 0;
        for (let p = 1; p < PLAYER_COUNT; ++p) {
          const bx = CANVAS_W / 2 - 200 + col * 85;
          if (CE.isInRect(mx, my, bx, 230, 78, 36)) {
            tradeChoiceActive = false;
            const tmp = hands[0];
            hands[0] = hands[p];
            hands[p] = tmp;
            if (_host)
              _host.floatingText.add(CANVAS_W / 2, 250, 'Traded with ' + PLAYER_NAMES[p] + '!', { color: '#ff0', size: 16 });
            nextPlayer();
            return;
          }
          ++col;
        }
        return;
      }

      if (currentPlayer !== 0) return;

      // Draw pile
      if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 80, 190, CE.CARD_W, CE.CARD_H)) {
        if (drawPending > 0) {
          drawCards(0, drawPending);
          if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Drew ' + drawPending + '!', { color: '#f88', size: 16 });
          drawPending = 0;
          nextPlayer();
        } else {
          refillDeck();
          if (deck.length > 0) {
            const drawn = deck.pop();
            hands[0].push(drawn);
            if (canPlay(drawn)) {
              if (_host) _host.floatingText.add(mx, my - 20, 'Drew playable!', { color: '#8f8', size: 12 });
            } else
              nextPlayer();
          } else
            nextPlayer();
        }
        return;
      }

      // Player cards
      const handLen = hands[0].length;
      const cardSpacing = Math.min(55, (CANVAS_W - 200) / Math.max(handLen, 1));
      const handStartX = (CANVAS_W - (handLen - 1) * cardSpacing - CE.CARD_W) / 2;
      for (let i = handLen - 1; i >= 0; --i) {
        const cx = handStartX + i * cardSpacing;
        if (CE.isInRect(mx, my, cx, 450, CE.CARD_W, CE.CARD_H)) {
          if (!canPlay(hands[0][i])) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
            return;
          }
          if (hands[0][i].type === 'party') {
            pendingWildIndex = i;
            colorChoiceActive = true;
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
      if (roundOver || gameOver || colorChoiceActive || tradeChoiceActive) return;
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) { aiTurnTimer = 0; aiTurn(); }
      }
    },
    cleanup() {
      hands = []; deck = []; discardPile = [];
      roundOver = false; gameOver = false; aiTurnTimer = 0;
      colorChoiceActive = false; tradeChoiceActive = false;
      pendingWildIndex = -1;
      _ctx = null; _host = null;
    },
    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('unoparty', module);

})();
