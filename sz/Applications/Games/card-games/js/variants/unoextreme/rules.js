/* Uno Extreme: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoextreme'];
  const S = V.S;
  const { unoColors, CANVAS_W, NUM_PLAYERS, CANVAS_H } = V;

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

  function canPlay(card) {
    if (!S.topCard) return true;
    if (card.type === 'wild' || card.type === 'extreme') return true;
    return card.color === S.topCard.color || card.value === S.topCard.value;
  }

  function launcherDraw(playerIndex) {
    const r = Math.random();
    let count = r < 0.25 ? 0 : r < 0.60 ? 1 : r < 0.85 ? 2 : 3;
    if (count === 0) {
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Click! Nothing!', { color: '#8f8', size: 16 });
    } else {
      for (let i = 0; i < count && S.deck.length > 0; ++i)
        S.hands[playerIndex].push(S.deck.pop());
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Launcher: ' + count + ' card' + (count > 1 ? 's' : '') + '!', { color: '#f88', size: 16 });
    }
    S.launcherAnim = 0.5;
  }

  function finishWildPlay(card, playerIndex, chosenColor) {
    card.color = chosenColor;
    if (card.value === 'Wild Draw Four') {
      const next = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
      for (let i = 0; i < 4 && S.deck.length > 0; ++i)
        S.hands[next].push(S.deck.pop());
    }
    checkWin(playerIndex);
  }

  function extremeHit(targetPlayer) {
    launcherDraw(targetPlayer);
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 250, (targetPlayer === 0 ? 'You' : 'AI ' + targetPlayer) + ' hit the launcher!', { color: '#fa0', size: 16 });
  }

  function checkWin(playerIndex) {
    if (S.hands[playerIndex].length === 0) {
      S.roundOver = true;
      if (playerIndex === 0) {
        S.score += 50;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      } else if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 300, 'AI ' + playerIndex + ' WINS', { color: '#f44', size: 28 });
      if (S._host) S._host.onScoreChanged(S.score);
      return true;
    }
    S.currentPlayer = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
    return false;
  }

  function playCard(playerIndex, cardIndex) {
    if (S.waitingForColorChoice || S.waitingForTargetChoice) return false;
    const hand = S.hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    S.topCard = card;

    if (card.type === 'extreme') {
      if (playerIndex === 0) {
        S.waitingForTargetChoice = true;
        S.pendingWildPlayer = playerIndex;
        return true;
      }
      // AI: target player closest to winning
      let target = -1, minCards = Infinity;
      for (let p = 0; p < NUM_PLAYERS; ++p)
        if (p !== playerIndex && S.hands[p].length < minCards) { minCards = S.hands[p].length; target = p; }
      extremeHit(target);
      checkWin(playerIndex);
      return true;
    }

    if (card.type === 'wild') {
      if (playerIndex === 0) {
        S.waitingForColorChoice = true;
        S.pendingWildCard = card;
        S.pendingWildPlayer = playerIndex;
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
      S.currentPlayer = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
    else if (card.value === 'Reverse')
      S.direction = -S.direction;
    else if (card.value === 'Draw Two') {
      const next = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
      for (let i = 0; i < 2 && S.deck.length > 0; ++i)
        S.hands[next].push(S.deck.pop());
    }

    checkWin(playerIndex);
    return true;
  }

  function setupGame() {
    S.deck = CE.shuffle(createDeck());
    S.hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S.hands.push([]);
      for (let i = 0; i < 7; ++i) S.hands[p].push(S.deck.pop());
    }
    S.topCard = S.deck.pop();
    while (S.topCard.type === 'wild' || S.topCard.type === 'extreme') {
      S.deck.unshift(S.topCard);
      S.topCard = S.deck.pop();
    }
    S.currentPlayer = 0;
    S.direction = 1;
    S.roundOver = false;
    S.gameOver = false;
    S.waitingForColorChoice = false;
    S.waitingForTargetChoice = false;
    S.pendingWildCard = null;
    S.pendingWildPlayer = -1;
    S.launcherAnim = 0;
    S.aiTurnTimer = 0;
    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
  }

  Object.assign(V, { launcherDraw, playCard, canPlay, finishWildPlay, checkWin, extremeHit, setupGame });

})();
