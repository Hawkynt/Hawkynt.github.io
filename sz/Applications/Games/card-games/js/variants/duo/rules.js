/* 8-Color Duo: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['duo'];
  const S = V.S;
  const { duoColors, NUM_PLAYERS, CANVAS_W, CANVAS_H } = V;

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
     DUO RULES
     ================================================================ */

  function canPlay(card, top) {
    if (!top) return true;
    if (S.drawStack > 0) {
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
    S.currentPlayer = ((S.currentPlayer + S.direction) % NUM_PLAYERS + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function applyDrawStack(targetPlayer) {
    if (S.drawStack > 0) {
      refillDeck();
      for (let i = 0; i < S.drawStack && S.deck.length > 0; ++i)
        S.hands[targetPlayer].push(S.deck.pop());
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, V.getPlayerLabel(targetPlayer) + ' draws ' + S.drawStack + '!', { color: '#f88', size: 18 });
      S.drawStack = 0;
    }
  }

  function refillDeck() {
    if (S.deck.length > 0) return;
    if (!S.topCard) return;
    S.deck = CE.shuffle(createDuoDeck());
  }

  function finishWildPlay(card, playerIndex, chosenColor) {
    card.color = chosenColor;
    if (card.value === 'Wild Draw Four')
      S.drawStack += 4;
    checkWin(playerIndex);
  }

  function cardPointValue(card) {
    if (card.value === 'Wild Draw Four') return 50;
    if (card.value === 'Wild') return 40;
    if (card.value === 'Skip' || card.value === 'Reverse' || card.value === 'Draw Two') return 20;
    return parseInt(card.value, 10) || 0;
  }

  function checkWin(playerIndex) {
    const hand = S.hands[playerIndex];
    if (hand.length === 0) {
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300,
          playerIndex === 0 ? 'YOU WIN!' : V.getPlayerLabel(playerIndex) + ' WINS',
          { color: playerIndex === 0 ? '#4f4' : '#f44', size: 28 });
      }
      if (playerIndex === 0) {
        let pts = 0;
        for (let p = 1; p < NUM_PLAYERS; ++p)
          for (const c of S.hands[p])
            pts += cardPointValue(c);
        S.score += pts;
        if (S._host) {
          S._host.addGlow(60, 420, S.hands[0].length * 55 + CE.CARD_W, CE.CARD_H, 2);
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      }
      S.roundOver = true;
      if (S._host) S._host.onScoreChanged(S.score);
      return true;
    }
    advancePlayer();
    if (S.drawStack > 0) {
      let canCounter = false;
      for (const c of S.hands[S.currentPlayer]) {
        if (canPlay(c, S.topCard)) {
          canCounter = true;
          break;
        }
      }
      if (!canCounter) {
        applyDrawStack(S.currentPlayer);
        advancePlayer();
      }
    }
    return false;
  }

  function playCard(playerIndex, cardIndex) {
    if (S.waitingForColorChoice) return false;
    const hand = S.hands[playerIndex];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlay(card, S.topCard)) return false;
    hand.splice(cardIndex, 1);
    S.topCard = card;

    if (card.type === 'wild') {
      if (playerIndex === 0) {
        S.waitingForColorChoice = true;
        S.pendingWildCard = card;
        S.pendingWildPlayer = playerIndex;
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
      S.direction = -S.direction;
    else if (card.value === 'Draw Two')
      S.drawStack += 2;

    checkWin(playerIndex);
    return true;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupDuo() {
    S.deck = CE.shuffle(createDuoDeck());
    S.hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      S.hands.push([]);
    S.currentPlayer = 0;
    S.direction = 1;
    S.roundOver = false;
    S.gameOver = false;
    S.waitingForColorChoice = false;
    S.pendingWildCard = null;
    S.pendingWildPlayer = -1;
    S.drawStack = 0;
    S.aiTurnTimer = 0;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (let i = 0; i < 7; ++i)
        S.hands[p].push(S.deck.pop());

    S.topCard = S.deck.pop();
    while (S.topCard.type === 'wild') {
      S.deck.unshift(S.topCard);
      S.topCard = S.deck.pop();
    }

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
    }
  }

  function sortHand(hand) {
    const co = { red: 0, blue: 1, green: 2, yellow: 3, purple: 4, orange: 5, pink: 6, teal: 7, wild: 8 };
    const to = { number: 0, action: 1, wild: 2 };
    hand.sort((a, b) => {
      const cd = (co[a.color] ?? 8) - (co[b.color] ?? 8);
      if (cd !== 0) return cd;
      const td = (to[a.type] ?? 2) - (to[b.type] ?? 2);
      if (td !== 0) return td;
      const av = parseInt(a.value) || 0, bv = parseInt(b.value) || 0;
      return av - bv || String(a.value).localeCompare(String(b.value));
    });
  }

  Object.assign(V, { advancePlayer, refillDeck, playCard, canPlay, applyDrawStack, finishWildPlay, sortHand, setupDuo });

})();
