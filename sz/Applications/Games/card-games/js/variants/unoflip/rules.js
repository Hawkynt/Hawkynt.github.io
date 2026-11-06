/* Uno Flip: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoflip'];
  const S = V.S;
  const { DARK_COLORS, LIGHT_COLORS, NUM_PLAYERS, CANVAS_W, CANVAS_H, INITIAL_HAND } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

  function getColor(card) { return S.activeSide === 'light' ? card.lightColor : card.darkColor; }
  function getValue(card) { return S.activeSide === 'light' ? card.lightValue : card.darkValue; }
  function getType(card) { return S.activeSide === 'light' ? card.lightType : card.darkType; }

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

  function otherSideColor(card) {
    return S.activeSide === 'light' ? card.darkColor : card.lightColor;
  }

  function canPlay(card) {
    if (S.drawPending > 0) {
      const v = getValue(card);
      if (v === 'Draw One' || v === 'Draw Five' || v === 'Wild Draw Two' || v === 'Wild Draw Color')
        return true;
      return false;
    }
    if (getType(card) === 'wild') return true;
    if (getColor(card) === S.currentColor) return true;
    if (getValue(card) === getValue(S.discardPile[S.discardPile.length - 1])) return true;
    return false;
  }

  function nextPlayer() {
    S.currentPlayer = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function flipAll() {
    S.activeSide = S.activeSide === 'light' ? 'dark' : 'light';
    // Update current color from top discard
    const top = S.discardPile[S.discardPile.length - 1];
    const tc = getColor(top);
    S.currentColor = tc === 'wild' ? S.currentColor : tc;
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 200, 'FLIP! Now ' + S.activeSide.toUpperCase() + ' side', { color: '#ff0', size: 20 });
  }

  function checkWin(playerIndex) {
    if (S.hands[playerIndex].length > 0) return false;
    S.roundOver = true;
    if (playerIndex === 0) {
      let pts = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        for (const c of S.hands[p])
          pts += cardPoints(c);
      S.score += pts;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN! +' + pts, { color: '#4f4', size: 28 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.onScoreChanged(S.score);
      }
    } else {
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'AI ' + playerIndex + ' WINS', { color: '#f44', size: 28 });
        S._host.onScoreChanged(S.score);
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
    const hand = S.hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    S.discardPile.push(card);

    const v = getValue(card);
    const t = getType(card);

    // Update color
    if (t === 'wild')
      S.currentColor = chosenColor || S.currentColor;
    else {
      const c = getColor(card);
      if (c !== 'wild') S.currentColor = c;
    }

    // Action resolution
    if (v === 'Skip') {
      nextPlayer(); // skip
    } else if (v === 'Skip Everyone') {
      // Skip all others — current player goes again (don't advance)
      // We'll just not call nextPlayer below
      S.skipPending = true;
    } else if (v === 'Reverse') {
      if (NUM_PLAYERS === 2)
        nextPlayer(); // acts as skip in 2-player
      else
        S.direction = -S.direction;
    } else if (v === 'Draw One') {
      S.drawPending += 1;
    } else if (v === 'Draw Five') {
      S.drawPending += 5;
    } else if (v === 'Wild Draw Two') {
      S.drawPending += 2;
    } else if (v === 'Wild Draw Color') {
      // next player draws until they get a card of chosen color
      // We'll handle this as a special draw
      const target = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
      let drawn = 0;
      for (let i = 0; i < 20; ++i) {
        SH.refillDeck(S);
        if (S.deck.length === 0) break;
        const c = S.deck.pop();
        S.hands[target].push(c);
        ++drawn;
        if (getColor(c) === S.currentColor) break;
      }
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 250, (target === 0 ? 'You draw' : 'AI ' + target + ' draws') + ' ' + drawn + '!', { color: '#f88', size: 16 });
      nextPlayer(); // skip that player's turn
    } else if (v === 'Flip') {
      flipAll();
    }

    // Resolve pending draws if next player can't stack
    if (S.drawPending > 0 && v !== 'Draw One' && v !== 'Draw Five' && v !== 'Wild Draw Two') {
      // Don't resolve yet — let it stack
    }

    // Uno call
    if (hand.length === 1 && S._host)
      S._host.floatingText.add(CANVAS_W / 2, 350, 'UNO!', { color: '#0ff', size: 24 });

    if (checkWin(playerIndex)) return true;

    if (S.skipPending) {
      S.skipPending = false;
      // Current player goes again
    } else
      nextPlayer();

    // If next player has pending draw and can't stack, force draw
    if (S.drawPending > 0) {
      const nh = S.hands[S.currentPlayer];
      let canStack = false;
      for (const c of nh) {
        const cv = getValue(c);
        if (cv === 'Draw One' || cv === 'Draw Five' || cv === 'Wild Draw Two' || cv === 'Wild Draw Color') {
          canStack = true;
          break;
        }
      }
      if (!canStack) {
        SH.drawCards(S, S.currentPlayer, S.drawPending);
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 250, (S.currentPlayer === 0 ? 'You draw' : 'AI ' + S.currentPlayer + ' draws') + ' ' + S.drawPending + '!', { color: '#f88', size: 16 });
        S.drawPending = 0;
        nextPlayer();
      }
    }

    return true;
  }

  function setupGame() {
    S.deck = CE.shuffle(createFlipDeck());
    S.hands = [];
    S.activeSide = 'light';
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S.hands.push([]);
      for (let i = 0; i < INITIAL_HAND; ++i)
        S.hands[p].push(S.deck.pop());
    }
    // First discard — must be a light-side number
    let first = S.deck.pop();
    while (getType(first) !== 'number') {
      S.deck.unshift(first);
      first = S.deck.pop();
    }
    S.discardPile = [first];
    S.currentColor = getColor(first);
    S.currentPlayer = 0;
    S.direction = 1;
    S.drawPending = 0;
    S.skipPending = false;
    S.roundOver = false;
    S.gameOver = false;
    S.colorChoiceActive = false;
    S.wildDrawColorActive = false;
    S.aiTurnTimer = 0;
    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 120 + i * 60, 440, i * 0.1);
  }

  function getColorChoices() {
    return S.activeSide === 'light' ? LIGHT_COLORS : DARK_COLORS;
  }

  function sortHand(hand) {
    const lco = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
    const dco = { pink: 0, teal: 1, orange: 2, purple: 3, wild: 4 };
    const to = { number: 0, action: 1, wild: 2 };
    hand.sort((a, b) => {
      const co = S.activeSide === 'light' ? lco : dco;
      const cd = (co[getColor(a)] ?? 4) - (co[getColor(b)] ?? 4);
      if (cd !== 0) return cd;
      const td = (to[getType(a)] ?? 2) - (to[getType(b)] ?? 2);
      if (td !== 0) return td;
      const av = parseInt(getValue(a)) || 0, bv = parseInt(getValue(b)) || 0;
      return av - bv || String(getValue(a)).localeCompare(String(getValue(b)));
    });
  }

  Object.assign(V, { getValue, otherSideColor, getColor, nextPlayer, playCard, getType, canPlay, getColorChoices, sortHand, setupGame });

})();
