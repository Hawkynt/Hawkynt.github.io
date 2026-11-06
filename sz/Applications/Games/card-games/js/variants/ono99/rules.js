/* ONO 99: deck, running total, eliminations, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['ono99'];
  const S = V.S;
  const { NUM_PLAYERS, CANVAS_W, CANVAS_H } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

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

  function getNextAlive(from) {
    let p = from;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      p = (p + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
      if (!S.eliminated[p]) return p;
    }
    return from;
  }

  function aliveCount() {
    let c = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!S.eliminated[i]) ++c;
    return c;
  }

  function canPlay(card) {
    if (card.type !== 'number') return true;
    return S.runningTotal + card.pointValue <= 99;
  }

  function canPlayAny(playerIndex) {
    for (const c of S.hands[playerIndex])
      if (canPlay(c)) return true;
    return false;
  }

  function eliminatePlayer(playerIndex) {
    S.eliminated[playerIndex] = true;
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 250, (playerIndex === 0 ? 'YOU' : 'AI ' + playerIndex) + ' BUSTED!', { color: '#f44', size: 22 });
  }

  function checkGameEnd() {
    if (aliveCount() <= 1) {
      S.roundOver = true;
      let winner = -1;
      for (let i = 0; i < NUM_PLAYERS; ++i)
        if (!S.eliminated[i]) winner = i;
      if (winner === 0) {
        S.score += 100;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      } else if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 300, (winner >= 0 ? 'AI ' + winner : 'Nobody') + ' WINS!', { color: '#f44', size: 28 });
      if (S._host) S._host.onScoreChanged(S.score);
      return true;
    }
    return false;
  }

  function playCard(playerIndex, cardIndex) {
    const hand = S.hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    S.discardPile.push(card);

    if (card.type === 'number')
      S.runningTotal += card.pointValue;
    else if (card.value === 'Minus 10')
      S.runningTotal = Math.max(0, S.runningTotal - 10);
    else if (card.value === 'Reverse')
      S.direction = -S.direction;
    else if (card.value === 'Double Play')
      S.doublePlayCount = 2;

    SH.refillDeck(S);
    if (S.deck.length > 0)
      hand.push(S.deck.pop());

    if (checkGameEnd()) return true;

    if (S.doublePlayCount <= 0)
      S.currentPlayer = getNextAlive(S.currentPlayer);
    else {
      --S.doublePlayCount;
      if (S.doublePlayCount <= 0)
        S.currentPlayer = getNextAlive(S.currentPlayer);
    }
    return true;
  }

  function setupGame() {
    S.deck = CE.shuffle(createDeck());
    S.hands = [];
    S.eliminated = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S.hands.push([]);
      S.eliminated.push(false);
      for (let i = 0; i < 4; ++i)
        S.hands[p].push(S.deck.pop());
    }
    S.discardPile = [];
    S.runningTotal = 0;
    S.currentPlayer = 0;
    S.direction = 1;
    S.roundOver = false;
    S.gameOver = false;
    S.doublePlayCount = 0;
    S.aiTurnTimer = 0;
    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 250 + i * 70, 460, i * 0.1);
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const an = typeof a.value === 'number' ? 0 : 1;
      const bn = typeof b.value === 'number' ? 0 : 1;
      if (an !== bn) return an - bn;
      if (an === 0) return a.value - b.value;
      return String(a.value).localeCompare(String(b.value));
    });
  }

  Object.assign(V, { playCard, canPlay, getNextAlive, checkGameEnd, eliminatePlayer, canPlayAny, sortHand, setupGame });

})();
