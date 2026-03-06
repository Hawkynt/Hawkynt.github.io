;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const NUM_PLAYERS = 4;
  const PLAYER_NAMES = ['You', 'West', 'North', 'East'];
  const INITIAL_HAND_SIZE = 7;
  const AI_TURN_DELAY = 0.9;
  const CHALLENGE_WINDOW = 1.5;

  const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];
  const COLOR_MAP = { red: '#e33', blue: '#33e', green: '#3a3', yellow: '#ea0', wild: '#555' };

  let hands = [];
  let deck = [];
  let discardPile = [];
  let currentPlayer = 0;
  let direction = 1;
  let currentColor = '';
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;

  // Bluffing state
  let lastPlayInfo = null; // { player, card, faceDown, claimedColor, claimedValue, actualColor, actualValue }
  let challengePhase = false;
  let challengeTimer = 0;
  let bluffMode = false; // human bluff mode toggle
  let bluffClaimStep = 0; // 0=choose color, 1=choose value
  let bluffCard = null;
  let bluffCardIndex = -1;
  let challengeResult = null; // { text, color, timer }

  function createLiarsDeck() {
    const d = [];
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
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild', type: 'wild' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 'Wild Draw Four', type: 'wild' });
    return d;
  }

  function cardLabel(card) {
    if (card.value === 'Skip') return '\u00D8';
    if (card.value === 'Reverse') return '\u21C4';
    if (card.value === 'Draw Two') return '+2';
    if (card.value === 'Wild') return 'W';
    if (card.value === 'Wild Draw Four') return 'W+4';
    return card.value;
  }

  function drawLiarsCard(x, y, w, h, card, highlight, faceDown) {
    _ctx.save();
    if (faceDown) {
      // Face-down card with "?" mark
      _ctx.fillStyle = '#444';
      _ctx.strokeStyle = '#888';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
      _ctx.fill();
      _ctx.stroke();
      _ctx.fillStyle = '#aaa';
      _ctx.font = 'bold 24px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('?', x + w / 2, y + h / 2);
    } else {
      _ctx.fillStyle = COLOR_MAP[card.color] || '#555';
      _ctx.strokeStyle = highlight ? '#ff0' : '#fff';
      _ctx.lineWidth = highlight ? 3 : 1;
      CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
      _ctx.fill();
      _ctx.stroke();
      _ctx.fillStyle = 'rgba(255,255,255,0.6)';
      _ctx.beginPath();
      _ctx.ellipse(x + w / 2, y + h / 2, w / 3.5, h / 4, 0, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.fillStyle = card.color === 'wild' ? '#fff' : (COLOR_MAP[card.color] || '#555');
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(cardLabel(card), x + w / 2, y + h / 2);
    }
    _ctx.restore();
  }

  function isLegalPlay(card) {
    if (card.type === 'wild') return true;
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
    currentPlayer = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function resolveAction(claimedValue, claimedColor) {
    if (claimedValue === 'Skip')
      nextPlayer();
    else if (claimedValue === 'Reverse') {
      if (NUM_PLAYERS === 2) nextPlayer();
      else direction = -direction;
    } else if (claimedValue === 'Draw Two') {
      const target = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
      drawCards(target, 2);
      nextPlayer();
    } else if (claimedValue === 'Wild Draw Four') {
      const target = (currentPlayer + direction + NUM_PLAYERS) % NUM_PLAYERS;
      drawCards(target, 4);
      nextPlayer();
    }

    if (claimedColor && claimedColor !== 'wild')
      currentColor = claimedColor;
  }

  function checkWin(playerIndex) {
    if (hands[playerIndex].length > 0) return false;
    roundOver = true;
    if (playerIndex === 0) {
      score += 100;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.onScoreChanged(score);
      }
    } else if (_host) {
      _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[playerIndex] + ' WINS!', { color: '#f44', size: 28 });
      _host.onScoreChanged(score);
    }
    return true;
  }

  function doPlay(playerIndex, cardIndex, faceDown, claimedColor, claimedValue) {
    const hand = hands[playerIndex];
    const card = hand[cardIndex];
    hand.splice(cardIndex, 1);
    discardPile.push(card);

    const actualColor = card.type === 'wild' ? 'wild' : card.color;
    const actualValue = card.value;

    if (!faceDown) {
      // Face-up: must be legal
      if (card.type === 'wild')
        currentColor = claimedColor || UNO_COLORS[0];
      else
        currentColor = card.color;
      claimedColor = currentColor;
      claimedValue = actualValue;
    } else {
      // Face-down bluff: claimed values used
      currentColor = claimedColor || currentColor;
    }

    lastPlayInfo = {
      player: playerIndex,
      card,
      faceDown,
      claimedColor: claimedColor || currentColor,
      claimedValue: claimedValue || actualValue,
      actualColor,
      actualValue,
    };

    // Uno call
    if (hand.length === 1 && _host)
      _host.floatingText.add(CANVAS_W / 2, 350, 'UNO!', { color: '#0ff', size: 24 });

    if (checkWin(playerIndex)) {
      lastPlayInfo = null;
      return true;
    }

    // Enter challenge phase
    challengePhase = true;
    challengeTimer = 0;
    challengeResult = null;

    return true;
  }

  function finishTurn() {
    if (!lastPlayInfo) return;
    // Resolve action based on claimed values
    resolveAction(lastPlayInfo.claimedValue, lastPlayInfo.claimedColor);
    lastPlayInfo = null;
    challengePhase = false;
    nextPlayer();
  }

  function doChallenge(challengerIndex) {
    if (!lastPlayInfo) return;
    const info = lastPlayInfo;
    const wasBluff = info.faceDown &&
      (info.claimedColor !== info.actualColor || info.claimedValue !== info.actualValue);

    challengePhase = false;
    const challengerName = challengerIndex === 0 ? 'You' : PLAYER_NAMES[challengerIndex];
    const playerName = info.player === 0 ? 'You' : PLAYER_NAMES[info.player];

    if (wasBluff) {
      // Liar caught — liar picks up entire discard pile
      const pile = discardPile.splice(0);
      for (const c of pile) hands[info.player].push(c);
      // Put a fresh card on discard
      refillDeck();
      if (deck.length > 0) discardPile.push(deck.pop());
      currentColor = discardPile.length > 0 && discardPile[discardPile.length - 1].color !== 'wild' ? discardPile[discardPile.length - 1].color : currentColor;

      challengeResult = { text: challengerName + ' caught ' + playerName + ' bluffing! Picks up pile!', color: '#4f4', timer: 2 };
      if (_host) _host.floatingText.add(CANVAS_W / 2, 250, 'CAUGHT!', { color: '#4f4', size: 22 });
    } else {
      // Wrong accusation — challenger draws 2
      drawCards(challengerIndex, 2);
      // Resolve the play normally
      resolveAction(info.claimedValue, info.claimedColor);

      challengeResult = { text: playerName + ' was honest! ' + challengerName + ' draws 2!', color: '#f88', timer: 2 };
      if (_host) _host.floatingText.add(CANVAS_W / 2, 250, 'Honest!', { color: '#f88', size: 22 });
    }

    lastPlayInfo = null;
    nextPlayer();
  }

  function aiShouldBluff(playerIndex) {
    const hand = hands[playerIndex];
    let legalCount = 0;
    for (const c of hand)
      if (isLegalPlay(c)) ++legalCount;
    // More likely to bluff when stuck
    if (legalCount === 0) return Math.random() < 0.7;
    if (legalCount <= 1) return Math.random() < 0.2;
    return Math.random() < 0.08;
  }

  function aiShouldChallenge(info) {
    if (!info.faceDown) return false;
    // More suspicious if claimed high-value (Wild Draw Four)
    if (info.claimedValue === 'Wild Draw Four') return Math.random() < 0.4;
    if (info.claimedValue === 'Draw Two') return Math.random() < 0.25;
    return Math.random() < 0.15;
  }

  function aiPickBluffClaim(playerIndex) {
    // Pick a plausible claim that matches the current state
    const claimedColor = currentColor || UNO_COLORS[(Math.random() * 4) | 0];
    const top = discardPile[discardPile.length - 1];
    // Claim a matching color card with a random number
    const possibleValues = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw Two'];
    const claimedValue = possibleValues[(Math.random() * possibleValues.length) | 0];
    return { claimedColor, claimedValue };
  }

  function aiTurn() {
    if (roundOver || gameOver) return;
    if (challengePhase) {
      // AI decides whether to challenge
      if (lastPlayInfo && lastPlayInfo.player !== currentPlayer) {
        // Each AI after the player can challenge during challenge phase
        for (let p = 1; p < NUM_PLAYERS; ++p) {
          if (p === lastPlayInfo.player) continue;
          if (aiShouldChallenge(lastPlayInfo)) {
            doChallenge(p);
            return;
          }
        }
      }
      // No challenge — finish turn
      finishTurn();
      return;
    }

    const hand = hands[currentPlayer];

    // Decide bluff or honest play
    if (aiShouldBluff(currentPlayer)) {
      // Pick any card, claim something plausible
      const idx = (Math.random() * hand.length) | 0;
      const claim = aiPickBluffClaim(currentPlayer);
      doPlay(currentPlayer, idx, true, claim.claimedColor, claim.claimedValue);
      return;
    }

    // Honest play — find legal card
    // Prefer non-wild first
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type !== 'wild' && isLegalPlay(hand[i])) {
        doPlay(currentPlayer, i, false, hand[i].color, hand[i].value);
        return;
      }
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].type === 'wild') {
        const chosen = aiChooseColor();
        doPlay(currentPlayer, i, false, chosen, hand[i].value);
        return;
      }

    // No legal play — must bluff or draw
    if (Math.random() < 0.5 && hand.length > 0) {
      const idx = (Math.random() * hand.length) | 0;
      const claim = aiPickBluffClaim(currentPlayer);
      doPlay(currentPlayer, idx, true, claim.claimedColor, claim.claimedValue);
    } else {
      refillDeck();
      if (deck.length > 0) hand.push(deck.pop());
      nextPlayer();
    }
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

  const playerPos = [
    { x: CANVAS_W / 2, y: CANVAS_H - 70, label: 'You' },
    { x: 70, y: CANVAS_H / 2, label: 'West' },
    { x: CANVAS_W / 2, y: 50, label: 'North' },
    { x: CANVAS_W - 70, y: CANVAS_H / 2, label: 'East' },
  ];

  function setupGame() {
    deck = CE.shuffle(createLiarsDeck());
    hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      hands.push([]);
      for (let i = 0; i < INITIAL_HAND_SIZE; ++i)
        hands[p].push(deck.pop());
    }
    let first = deck.pop();
    while (first.type === 'wild') {
      deck.unshift(first);
      first = deck.pop();
    }
    discardPile = [first];
    currentColor = first.color;
    currentPlayer = 0;
    direction = 1;
    roundOver = false;
    gameOver = false;
    lastPlayInfo = null;
    challengePhase = false;
    challengeTimer = 0;
    bluffMode = false;
    bluffClaimStep = 0;
    bluffCard = null;
    bluffCardIndex = -1;
    challengeResult = null;
    aiTurnTimer = 0;
    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 140 + i * 60, 440, i * 0.1);
  }

  function drawBluffClaimOverlay() {
    _ctx.fillStyle = 'rgba(0,0,0,0.6)';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';

    if (bluffClaimStep === 0) {
      _ctx.fillText('Claim a color:', CANVAS_W / 2, 210);
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        CE.drawButton(_ctx, bx, 230, 65, 32, UNO_COLORS[i].charAt(0).toUpperCase() + UNO_COLORS[i].slice(1), { bg: COLOR_MAP[UNO_COLORS[i]], border: '#fff', fontSize: 12 });
      }
    } else {
      _ctx.fillText('Claim a value:', CANVAS_W / 2, 190);
      const vals = ['0','1','2','3','4','5','6','7','8','9','Skip','Rev','+2','W','W+4'];
      for (let i = 0; i < vals.length; ++i) {
        const col = (i % 8);
        const row = (i / 8) | 0;
        const bx = CANVAS_W / 2 - 200 + col * 52;
        const by = 215 + row * 38;
        CE.drawButton(_ctx, bx, by, 48, 32, vals[i], { bg: '#444', border: '#888', fontSize: 11 });
      }
    }
  }

  function drawGame() {
    // Discard pile — show top card (face down if last play was bluff and in challenge phase)
    const topDiscard = discardPile[discardPile.length - 1];
    if (topDiscard) {
      const showFaceDown = challengePhase && lastPlayInfo && lastPlayInfo.faceDown;
      drawLiarsCard(CANVAS_W / 2 - CE.CARD_W / 2, 210, CE.CARD_W, CE.CARD_H, topDiscard, false, showFaceDown);
      if (showFaceDown && lastPlayInfo) {
        _ctx.fillStyle = '#ff0';
        _ctx.font = '11px sans-serif';
        _ctx.textAlign = 'center';
        _ctx.fillText('Claims: ' + lastPlayInfo.claimedColor + ' ' + lastPlayInfo.claimedValue, CANVAS_W / 2, 318);
      }
    }

    // Color indicator
    _ctx.fillStyle = COLOR_MAP[currentColor] || '#555';
    _ctx.fillRect(CANVAS_W / 2 - 30, 195, 60, 8);

    // Draw pile
    CE.drawCardBack(_ctx, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('' + deck.length, CANVAS_W / 2 - CE.CARD_W / 2 - 80, 320);

    // Player hand
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      const x = 140 + i * 60;
      const playable = !roundOver && !gameOver && currentPlayer === 0 && !challengePhase;
      drawLiarsCard(x, 440, CE.CARD_W, CE.CARD_H, hands[0][i], playable, false);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && !challengePhase && !roundOver && !gameOver && (bluffMode || isLegalPlay(hands[0][i])))
        CE.drawHintGlow(_ctx, x, 440, CE.CARD_W, CE.CARD_H, _host.hintTime);
    }

    // AI hands
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const pp = playerPos[p];
      _ctx.fillStyle = currentPlayer === p ? '#ff0' : '#aaa';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(pp.label + ' (' + hands[p].length + ')', pp.x, pp.y - 10);
      for (let i = 0; i < Math.min(hands[p].length, 7); ++i)
        CE.drawCardBack(_ctx, pp.x - 30 + i * 14, pp.y + 4, CE.CARD_W * 0.5, CE.CARD_H * 0.5);
    }

    // Direction
    _ctx.fillStyle = '#888';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(direction === 1 ? '\u21BB CW' : '\u21BA CCW', CANVAS_W / 2 + 90, 205);

    // Bluff mode button
    if (!roundOver && !gameOver && currentPlayer === 0 && !challengePhase && bluffClaimStep === 0) {
      const bluffBg = bluffMode ? '#a44' : '#555';
      CE.drawButton(_ctx, CANVAS_W - 140, 450, 80, 30, bluffMode ? 'Bluffing' : 'Bluff', { bg: bluffBg, border: '#fff', fontSize: 12 });
    }

    // Challenge button during challenge phase (for human)
    if (challengePhase && lastPlayInfo && lastPlayInfo.player !== 0 && lastPlayInfo.faceDown) {
      CE.drawButton(_ctx, CANVAS_W / 2 - 40, 345, 80, 30, 'Liar!', { bg: '#a22', border: '#ff0', fontSize: 14 });
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      const remaining = Math.max(0, CHALLENGE_WINDOW - challengeTimer);
      _ctx.fillText('Challenge? (' + remaining.toFixed(1) + 's)', CANVAS_W / 2, 390);
    }

    // Challenge result text
    if (challengeResult) {
      _ctx.fillStyle = challengeResult.color;
      _ctx.font = 'bold 14px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(challengeResult.text, CANVAS_W / 2, 170);
    }

    // Instructions
    if (!roundOver && !gameOver && currentPlayer === 0 && !challengePhase && bluffClaimStep === 0) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      if (bluffMode)
        _ctx.fillText('BLUFF MODE: Click any card to play face-down, then claim a color & value', CANVAS_W / 2, CANVAS_H - 12);
      else
        _ctx.fillText('Click a card to play honestly, or click Bluff to enable bluffing', CANVAS_W / 2, CANVAS_H - 12);
    }

    // Bluff claim overlay
    if (bluffClaimStep > 0)
      drawBluffClaimOverlay();
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

      // Bluff claim overlay
      if (bluffClaimStep === 1) {
        const vals = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','Draw Two','Wild','Wild Draw Four'];
        const labels = ['0','1','2','3','4','5','6','7','8','9','Skip','Rev','+2','W','W+4'];
        for (let i = 0; i < labels.length; ++i) {
          const col = (i % 8);
          const row = (i / 8) | 0;
          const bx = CANVAS_W / 2 - 200 + col * 52;
          const by = 215 + row * 38;
          if (CE.isInRect(mx, my, bx, by, 48, 32)) {
            bluffClaimStep = 0;
            doPlay(0, bluffCardIndex, true, bluffCard._claimedColor, vals[i]);
            bluffCard = null;
            bluffCardIndex = -1;
            bluffMode = false;
            return;
          }
        }
        return;
      }

      if (bluffClaimStep === 2) return; // shouldn't happen

      // Bluff claim step 0: choose color
      if (bluffCard && bluffClaimStep === 0 && bluffCardIndex >= 0) {
        // This shouldn't happen since we set step to 1 after color
        // But handle the overlay
      }

      // Challenge button
      if (challengePhase && lastPlayInfo && lastPlayInfo.player !== 0 && lastPlayInfo.faceDown) {
        if (CE.isInRect(mx, my, CANVAS_W / 2 - 40, 345, 80, 30)) {
          doChallenge(0);
          return;
        }
      }
      if (challengePhase) return; // wait for challenge phase to end

      if (currentPlayer !== 0) return;

      // Bluff toggle button
      if (CE.isInRect(mx, my, CANVAS_W - 140, 450, 80, 30)) {
        bluffMode = !bluffMode;
        return;
      }

      // Draw pile
      if (CE.isInRect(mx, my, CANVAS_W / 2 - CE.CARD_W - 80, 215, CE.CARD_W, CE.CARD_H)) {
        refillDeck();
        if (deck.length > 0) hands[0].push(deck.pop());
        nextPlayer();
        return;
      }

      // Player cards
      for (let i = hands[0].length - 1; i >= 0; --i) {
        const cx = 140 + i * 60;
        if (CE.isInRect(mx, my, cx, 440, CE.CARD_W, CE.CARD_H)) {
          if (bluffMode) {
            // Play face-down — need to choose claim
            bluffCard = hands[0][i];
            bluffCardIndex = i;
            bluffClaimStep = 0;
            // Show color choice first
            // We'll handle it through the overlay
            _showColorChoiceForBluff = true;
            return;
          }
          // Honest play
          if (!isLegalPlay(hands[0][i])) {
            if (_host) _host.floatingText.add(mx, my - 20, 'Can\'t play!', { color: '#f88', size: 14 });
            return;
          }
          if (hands[0][i].type === 'wild') {
            bluffCard = hands[0][i];
            bluffCardIndex = i;
            _showColorChoiceForHonest = true;
            return;
          }
          doPlay(0, i, false, hands[0][i].color, hands[0][i].value);
          return;
        }
      }
    },
    handleKey(e) {},
    handlePointerMove() {},
    handlePointerUp() {},
    tick(dt) {
      if (roundOver || gameOver) return;

      // Challenge result display timer
      if (challengeResult) {
        challengeResult.timer -= dt;
        if (challengeResult.timer <= 0)
          challengeResult = null;
      }

      // Challenge phase timer
      if (challengePhase && lastPlayInfo) {
        challengeTimer += dt;
        if (challengeTimer >= CHALLENGE_WINDOW) {
          // Time's up — no challenge
          if (currentPlayer !== 0 || lastPlayInfo.player === 0) {
            // AI challenge decision already happened or human didn't challenge
            finishTurn();
          } else if (lastPlayInfo.player !== 0) {
            // Human's chance expired
            finishTurn();
          }
        }
        return;
      }

      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) { aiTurnTimer = 0; aiTurn(); }
      }
    },
    cleanup() {
      hands = []; deck = []; discardPile = [];
      roundOver = false; gameOver = false; aiTurnTimer = 0;
      lastPlayInfo = null; challengePhase = false; challengeResult = null;
      bluffMode = false; bluffClaimStep = 0; bluffCard = null;
      _ctx = null; _host = null;
    },
    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  // Color choice state for honest wild and bluff
  let _showColorChoiceForBluff = false;
  let _showColorChoiceForHonest = false;

  const origDraw = module.draw;
  module.draw = function(ctx, W, H) {
    _ctx = ctx;
    drawGame();
    if (_showColorChoiceForBluff || _showColorChoiceForHonest) {
      _ctx.fillStyle = 'rgba(0,0,0,0.6)';
      _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(_showColorChoiceForBluff ? 'Claim a color:' : 'Choose a color:', CANVAS_W / 2, 220);
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        CE.drawButton(_ctx, bx, 245, 65, 36, UNO_COLORS[i].charAt(0).toUpperCase() + UNO_COLORS[i].slice(1), { bg: COLOR_MAP[UNO_COLORS[i]], border: '#fff', fontSize: 12 });
      }
    }
  };

  const origClick = module.handleClick;
  module.handleClick = function(mx, my) {
    if (_showColorChoiceForBluff) {
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
          _showColorChoiceForBluff = false;
          bluffCard._claimedColor = UNO_COLORS[i];
          bluffClaimStep = 1; // now pick value
          return;
        }
      }
      return;
    }
    if (_showColorChoiceForHonest) {
      for (let i = 0; i < UNO_COLORS.length; ++i) {
        const bx = CANVAS_W / 2 - 140 + i * 75;
        if (CE.isInRect(mx, my, bx, 245, 65, 36)) {
          _showColorChoiceForHonest = false;
          doPlay(0, bluffCardIndex, false, UNO_COLORS[i], bluffCard.value);
          bluffCard = null;
          bluffCardIndex = -1;
          return;
        }
      }
      return;
    }
    origClick.call(this, mx, my);
  };

  SZ.CardGames.registerVariant('liarsuno', module);

})();
