;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 3;
  const AI_TURN_DELAY = 0.8;
  const INITIAL_HAND = 7;

  const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'];
  const DARK_COLORS = ['pink', 'teal', 'orange', 'purple'];
  const LIGHT_HEX = { red: '#e33', yellow: '#ea0', green: '#3a3', blue: '#33e' };
  const DARK_HEX = { pink: '#d48', teal: '#2aa', orange: '#e82', purple: '#82e' };
  const WILD_HEX = '#555';

  let hands = [];
  let deck = [];
  let discardPile = [];
  let currentPlayer = 0;
  let direction = 1;
  let activeSide = 'light';
  let currentColor = '';
  let drawPending = 0;
  let skipPending = false;
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let colorChoiceActive = false;
  let wildDrawColorActive = false;
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;

  function getColor(card) { return activeSide === 'light' ? card.lightColor : card.darkColor; }
  function getValue(card) { return activeSide === 'light' ? card.lightValue : card.darkValue; }
  function getType(card) { return activeSide === 'light' ? card.lightType : card.darkType; }
  function getHex(color) {
    if (LIGHT_HEX[color]) return LIGHT_HEX[color];
    if (DARK_HEX[color]) return DARK_HEX[color];
    return WILD_HEX;
  }

  function createFlipDeck() {
    const d = [];
    for (let ci = 0; ci < 4; ++ci) {
      const lc = LIGHT_COLORS[ci];
      const dc = DARK_COLORS[ci];
      // 0 — one each
      d.push({ lightColor: lc, lightValue: '0', lightType: 'number', darkColor: dc, darkValue: '0', darkType: 'number' });
      // 1-9 — two each
      for (let n = 1; n <= 9; ++n)
        for (let c = 0; c < 2; ++c)
          d.push({ lightColor: lc, lightValue: String(n), lightType: 'number', darkColor: dc, darkValue: String(n), darkType: 'number' });
      // Skip — 2 each (light: Skip, dark: Skip Everyone)
      for (let c = 0; c < 2; ++c)
        d.push({ lightColor: lc, lightValue: 'Skip', lightType: 'action', darkColor: dc, darkValue: 'Skip Everyone', darkType: 'action' });
      // Reverse — 2 each
      for (let c = 0; c < 2; ++c)
        d.push({ lightColor: lc, lightValue: 'Reverse', lightType: 'action', darkColor: dc, darkValue: 'Reverse', darkType: 'action' });
      // Draw One (light) / Draw Five (dark) — 2 each
      for (let c = 0; c < 2; ++c)
        d.push({ lightColor: lc, lightValue: 'Draw One', lightType: 'action', darkColor: dc, darkValue: 'Draw Five', darkType: 'action' });
      // Flip — 2 each
      for (let c = 0; c < 2; ++c)
        d.push({ lightColor: lc, lightValue: 'Flip', lightType: 'action', darkColor: dc, darkValue: 'Flip', darkType: 'action' });
    }
    // Wilds: 4× Wild (light: Wild Draw Two / dark: Wild Draw Color)
    for (let i = 0; i < 4; ++i)
      d.push({ lightColor: 'wild', lightValue: 'Wild', lightType: 'wild', darkColor: 'wild', darkValue: 'Wild', darkType: 'wild' });
    for (let i = 0; i < 4; ++i)
      d.push({ lightColor: 'wild', lightValue: 'Wild Draw Two', lightType: 'wild', darkColor: 'wild', darkValue: 'Wild Draw Color', darkType: 'wild' });
    return d;
  }

  function cardLabel(card) {
    const v = getValue(card);
    if (v === 'Skip') return '\u00D8';
    if (v === 'Skip Everyone') return '\u00D8\u00D8';
    if (v === 'Reverse') return '\u21C4';
    if (v === 'Draw One') return '+1';
    if (v === 'Draw Five') return '+5';
    if (v === 'Flip') return '\u21BB';
    if (v === 'Wild') return 'W';
    if (v === 'Wild Draw Two') return 'W+2';
    if (v === 'Wild Draw Color') return 'WDC';
    return v;
  }

  function otherSideColor(card) {
    return activeSide === 'light' ? card.darkColor : card.lightColor;
  }

  function drawFlipCard(x, y, w, h, card, highlight) {
    _ctx.save();
    const col = getColor(card);
    _ctx.fillStyle = col === 'wild' ? WILD_HEX : getHex(col);
    _ctx.strokeStyle = highlight ? '#ff0' : '#fff';
    _ctx.lineWidth = highlight ? 3 : 1;
    CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
    _ctx.fill();
    _ctx.stroke();
    // White ellipse
    _ctx.fillStyle = 'rgba(255,255,255,0.65)';
    _ctx.beginPath();
    _ctx.ellipse(x + w / 2, y + h / 2, w / 3.5, h / 4, 0, 0, Math.PI * 2);
    _ctx.fill();
    // Label
    _ctx.fillStyle = col === 'wild' ? '#fff' : (getHex(col) || '#555');
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(cardLabel(card), x + w / 2, y + h / 2);
    // Thin stripe at bottom showing other side color
    const oc = otherSideColor(card);
    _ctx.fillStyle = oc === 'wild' ? WILD_HEX : getHex(oc);
    _ctx.fillRect(x + 4, y + h - 8, w - 8, 5);
    _ctx.restore();
  }

  function canPlay(card) {
    if (drawPending > 0) {
      const v = getValue(card);
      if (v === 'Draw One' || v === 'Draw Five' || v === 'Wild Draw Two' || v === 'Wild Draw Color')
        return true;
      return false;
    }
    if (getType(card) === 'wild') return true;
    if (getColor(card) === currentColor) return true;
    if (getValue(card) === getValue(discardPile[discardPile.length - 1])) return true;
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
    currentPlayer = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function flipAll() {
    activeSide = activeSide === 'light' ? 'dark' : 'light';
    // Update current color from top discard
    const top = discardPile[discardPile.length - 1];
    const tc = getColor(top);
    currentColor = tc === 'wild' ? currentColor : tc;
    if (_host)
      _host.floatingText.add(CANVAS_W / 2, 200, 'FLIP! Now ' + activeSide.toUpperCase() + ' side', { color: '#ff0', size: 20 });
  }

  function checkWin(playerIndex) {
    if (hands[playerIndex].length > 0) return false;
    roundOver = true;
    if (playerIndex === 0) {
      let pts = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        for (const c of hands[p])
          pts += cardPoints(c);
      score += pts;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN! +' + pts, { color: '#4f4', size: 28 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.onScoreChanged(score);
      }
    } else {
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'AI ' + playerIndex + ' WINS', { color: '#f44', size: 28 });
        _host.onScoreChanged(score);
      }
    }
    return true;
  }

  function cardPoints(card) {
    const v = getValue(card);
    const t = getType(card);
    if (t === 'wild') return 40;
    if (t === 'action') return 20;
    return parseInt(v) || 0;
  }

  function playCard(playerIndex, cardIndex, chosenColor) {
    const hand = hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    discardPile.push(card);

    const v = getValue(card);
    const t = getType(card);

    // Update color
    if (t === 'wild')
      currentColor = chosenColor || currentColor;
    else {
      const c = getColor(card);
      if (c !== 'wild') currentColor = c;
    }

    // Action resolution
    if (v === 'Skip') {
      nextPlayer(); // skip
    } else if (v === 'Skip Everyone') {
      // Skip all others — current player goes again (don't advance)
      // We'll just not call nextPlayer below
      skipPending = true;
    } else if (v === 'Reverse') {
      if (NUM_PLAYERS === 2)
        nextPlayer(); // acts as skip in 2-player
      else
        direction = -direction;
    } else if (v === 'Draw One') {
      drawPending += 1;
    } else if (v === 'Draw Five') {
      drawPending += 5;
    } else if (v === 'Wild Draw Two') {
      drawPending += 2;
    } else if (v === 'Wild Draw Color') {
      // next player draws until they get a card of chosen color
      // We'll handle this as a special draw
      const target = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
      let drawn = 0;
      for (let i = 0; i < 20; ++i) {
        refillDeck();
        if (deck.length === 0) break;
        const c = deck.pop();
        hands[target].push(c);
        ++drawn;
        if (getColor(c) === currentColor) break;
      }
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 250, (target === 0 ? 'You draw' : 'AI ' + target + ' draws') + ' ' + drawn + '!', { color: '#f88', size: 16 });
      nextPlayer(); // skip that player's turn
    } else if (v === 'Flip') {
      flipAll();
    }

    // Resolve pending draws if next player can't stack
    if (drawPending > 0 && v !== 'Draw One' && v !== 'Draw Five' && v !== 'Wild Draw Two') {
      // Don't resolve yet — let it stack
    }

    // Uno call
    if (hand.length === 1 && _host)
      _host.floatingText.add(CANVAS_W / 2, 350, 'UNO!', { color: '#0ff', size: 24 });

    if (checkWin(playerIndex)) return true;

    if (skipPending) {
      skipPending = false;
      // Current player goes again
    } else
      nextPlayer();

    // If next player has pending draw and can't stack, force draw
    if (drawPending > 0) {
      const nh = hands[currentPlayer];
      let canStack = false;
      for (const c of nh) {
        const cv = getValue(c);
        if (cv === 'Draw One' || cv === 'Draw Five' || cv === 'Wild Draw Two' || cv === 'Wild Draw Color') {
          canStack = true;
          break;
        }
      }
      if (!canStack) {
        drawCards(currentPlayer, drawPending);
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, 250, (currentPlayer === 0 ? 'You draw' : 'AI ' + currentPlayer + ' draws') + ' ' + drawPending + '!', { color: '#f88', size: 16 });
        drawPending = 0;
        nextPlayer();
      }
    }

    return true;
  }

  function aiChooseColor() {
    const hand = hands[currentPlayer];
    const counts = {};
    const palette = activeSide === 'light' ? LIGHT_COLORS : DARK_COLORS;
    for (const c of palette) counts[c] = 0;
    for (const card of hand) {
      const col = getColor(card);
      if (col !== 'wild' && counts[col] !== undefined) ++counts[col];
    }
    let best = palette[0], bestN = -1;
    for (const c of palette)
      if (counts[c] > bestN) { bestN = counts[c]; best = c; }
    return best;
  }

  function aiTurn() {
    if (roundOver || gameOver) return;
    const hand = hands[currentPlayer];

    // If must draw (pending draw, can't stack)
    if (drawPending > 0) {
      for (let i = 0; i < hand.length; ++i) {
        const v = getValue(hand[i]);
        if (v === 'Draw One' || v === 'Draw Five' || v === 'Wild Draw Two' || v === 'Wild Draw Color') {
          playCard(currentPlayer, i, aiChooseColor());
          return;
        }
      }
      // Shouldn't reach here due to auto-resolve, but safety
      drawCards(currentPlayer, drawPending);
      drawPending = 0;
      nextPlayer();
      return;
    }

    // Prefer color/value matches
    for (let i = 0; i < hand.length; ++i) {
      if (getType(hand[i]) !== 'wild' && canPlay(hand[i])) {
        playCard(currentPlayer, i);
        return;
      }
    }

    // Play wilds
    for (let i = 0; i < hand.length; ++i) {
      if (getType(hand[i]) === 'wild' && canPlay(hand[i])) {
        playCard(currentPlayer, i, aiChooseColor());
        return;
      }
    }

    // Draw
    refillDeck();
    if (deck.length > 0) {
      const drawn = deck.pop();
      hand.push(drawn);
      if (canPlay(drawn)) {
        const ci = hand.length - 1;
        if (getType(drawn) === 'wild')
          playCard(currentPlayer, ci, aiChooseColor());
        else
          playCard(currentPlayer, ci);
      } else
        nextPlayer();
    } else
      nextPlayer();
  }

  function setupGame() {
    deck = CE.shuffle(createFlipDeck());
    hands = [];
    activeSide = 'light';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      hands.push([]);
      for (let i = 0; i < INITIAL_HAND; ++i)
        hands[p].push(deck.pop());
    }
    // First discard — must be a light-side number
    let first = deck.pop();
    while (getType(first) !== 'number') {
      deck.unshift(first);
      first = deck.pop();
    }
    discardPile = [first];
    currentColor = getColor(first);
    currentPlayer = 0;
    direction = 1;
    drawPending = 0;
    skipPending = false;
    roundOver = false;
    gameOver = false;
    colorChoiceActive = false;
    wildDrawColorActive = false;
    aiTurnTimer = 0;
    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 120 + i * 60, 440, i * 0.1);
  }

  function getColorChoices() {
    return activeSide === 'light' ? LIGHT_COLORS : DARK_COLORS;
  }

  function drawColorOverlay() {
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Choose a color', CANVAS_W / 2, 220);
    const colors = getColorChoices();
    for (let i = 0; i < colors.length; ++i) {
      const bx = CANVAS_W / 2 - 140 + i * 75;
      const by = 245;
      CE.drawButton(_ctx, bx, by, 65, 36, colors[i].charAt(0).toUpperCase() + colors[i].slice(1), { bg: getHex(colors[i]), border: '#fff', fontSize: 12 });
    }
  }

  function drawGame() {
    // Side indicator
    _ctx.fillStyle = activeSide === 'light' ? '#ffe' : '#223';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(activeSide === 'light' ? '\u2600 LIGHT SIDE' : '\u263E DARK SIDE', CANVAS_W / 2, 18);

    // Current color indicator
    _ctx.fillStyle = getHex(currentColor);
    _ctx.fillRect(CANVAS_W / 2 - 30, 25, 60, 8);

    // Discard pile
    if (discardPile.length > 0)
      drawFlipCard(CANVAS_W / 2 - CE.CARD_W / 2, 210, CE.CARD_W, CE.CARD_H, discardPile[discardPile.length - 1], false);

    // Draw pile
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 80, 320);

    // Draw pending
    if (drawPending > 0) {
      _ctx.fillStyle = '#f88';
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Draw pending: +' + drawPending, CANVAS_W / 2 + 80, 260);
    }

    // Player hand
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      const x = 120 + i * 60;
      const playable = !roundOver && !gameOver && currentPlayer === 0 && canPlay(hands[0][i]);
      drawFlipCard(x, 440, CE.CARD_W, CE.CARD_H, hands[0][i], playable);
      if (_host && _host.hintsEnabled && !roundOver && !gameOver && currentPlayer === 0 && !colorChoiceActive && canPlay(hands[0][i]))
        CE.drawHintGlow(_ctx, x, 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    // AI hands
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const lx = p === 1 ? 60 : CANVAS_W - 160;
      const ly = 100;
      _ctx.textAlign = 'left';
      _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.fillText('AI ' + p + ' (' + hands[p].length + ')', lx, ly - 8);
      for (let i = 0; i < Math.min(hands[p].length, 8); ++i)
        CE.drawCardBack(_ctx, lx + i * 16, ly, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Direction
    _ctx.fillStyle = '#888';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2, 340);

    // Instructions
    if (!roundOver && !gameOver && currentPlayer === 0 && !colorChoiceActive) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      if (drawPending > 0)
        _ctx.fillText('Stack a draw card or click the draw pile to accept +' + drawPending, CANVAS_W / 2, CANVAS_H - 12);
      else
        _ctx.fillText('Click a card to play, or click the draw pile to draw', CANVAS_W / 2, CANVAS_H - 12);
    }

    if (colorChoiceActive)
      drawColorOverlay();
  }

  let pendingWildIndex = -1;

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
      if (currentPlayer !== 0) return;

      // Color choice overlay
      if (colorChoiceActive) {
        const colors = getColorChoices();
        for (let i = 0; i < colors.length; ++i) {
          const bx = CANVAS_W / 2 - 140 + i * 75;
          if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
            colorChoiceActive = false;
            if (pendingWildIndex >= 0)
              playCard(0, pendingWildIndex, colors[i]);
            pendingWildIndex = -1;
            return;
          }
        }
        return;
      }

      // Draw pile click
      if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H)) {
        if (drawPending > 0) {
          drawCards(0, drawPending);
          if (_host) _host.floatingText.add(CANVAS_W / 2, 350, 'Drew ' + drawPending + ' cards!', { color: '#f88', size: 16 });
          drawPending = 0;
          nextPlayer();
        } else {
          refillDeck();
          if (deck.length > 0) {
            const drawn = deck.pop();
            hands[0].push(drawn);
            if (canPlay(drawn)) {
              if (_host) _host.floatingText.add(mx, my - 20, 'Drew playable card!', { color: '#8f8', size: 12 });
            } else
              nextPlayer();
          } else
            nextPlayer();
        }
        return;
      }

      // Player cards
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = 120 + i * 60;
        if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
          if (!canPlay(hands[0][i])) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
            return;
          }
          if (getType(hands[0][i]) === 'wild') {
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
      if (roundOver || gameOver || colorChoiceActive) return;
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) { aiTurnTimer = 0; aiTurn(); }
      }
    },
    cleanup() {
      hands = []; deck = []; discardPile = [];
      roundOver = false; gameOver = false; aiTurnTimer = 0;
      colorChoiceActive = false; pendingWildIndex = -1;
      _ctx = null; _host = null;
    },
    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('unoflip', module);

})();
