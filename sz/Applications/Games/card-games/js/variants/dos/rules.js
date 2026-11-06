/* Dos: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['dos'];
  const S = V.S;
  const { dosColors, NUM_PLAYERS, CANVAS_W, CANVAS_H } = V;

  function createDosDeck() {
    const d = [];
    const dist = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 2, 9: 2, 10: 2 };
    for (const color of dosColors)
      for (let val = 1; val <= 10; ++val)
        for (let c = 0; c < dist[val]; ++c)
          d.push({ color, value: val, type: 'number' });
    for (let i = 0; i < 4; ++i)
      d.push({ color: 'wild', value: 2, type: 'wild' });
    return d;
  }

  function refillDeck() {
    if (S.deck.length > 0) return;
    // Reshuffle — keep center piles
    const newDeck = [];
    // Can't refill if no cards available
    S.deck = CE.shuffle(newDeck);
  }

  function canMatchSingle(card, pileCard) {
    if (!pileCard) return false;
    if (card.type === 'wild') return card.value === pileCard.value;
    return card.value === pileCard.value;
  }

  function canMatchDouble(card1, card2, pileCard) {
    if (!pileCard) return false;
    const sum = (card1.type === 'wild' ? 2 : card1.value) + (card2.type === 'wild' ? 2 : card2.value);
    return sum === pileCard.value;
  }

  function isColorMatch(card, pileCard) {
    if (card.type === 'wild' || pileCard.type === 'wild') return false;
    return card.color === pileCard.color;
  }

  function doPlay(playerIndex, cardIndices, pileIndex) {
    const hand = S.hands[playerIndex];
    const pileCard = S.centerPiles[pileIndex];
    let colorBonus = false;

    if (cardIndices.length === 1) {
      const card = hand[cardIndices[0]];
      if (!canMatchSingle(card, pileCard)) return false;
      colorBonus = isColorMatch(card, pileCard);
      S.centerPiles[pileIndex] = card;
      hand.splice(cardIndices[0], 1);
    } else if (cardIndices.length === 2) {
      const [i1, i2] = cardIndices.sort((a, b) => b - a);
      const card1 = hand[i1];
      const card2 = hand[i2];
      if (!canMatchDouble(card1, card2, pileCard)) return false;
      colorBonus = isColorMatch(card1, pileCard) || isColorMatch(card2, pileCard);
      S.centerPiles[pileIndex] = card1;
      hand.splice(i1, 1);
      hand.splice(Math.min(i1, i2), 1);
    } else return false;

    // Color bonus: discard one extra card
    if (colorBonus && hand.length > 0) {
      hand.splice(0, 1);
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Color Bonus!', { color: '#ff0', size: 16 });
    }

    // "Dos!" call at 2 cards
    if (hand.length === 2 && S._host)
      S._host.floatingText.add(CANVAS_W / 2, 350, 'DOS!', { color: '#0ff', size: 24 });

    // Check win
    if (hand.length === 0) {
      S.roundOver = true;
      if (playerIndex === 0) {
        S.score += 50;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
          S._host.onScoreChanged(S.score);
        }
      } else if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'AI ' + playerIndex + ' WINS', { color: '#f44', size: 28 });
        S._host.onScoreChanged(S.score);
      }
      return true;
    }

    S.currentPlayer = (S.currentPlayer + 1) % NUM_PLAYERS;
    return true;
  }

  function drawFromDeck(playerIndex) {
    if (S.deck.length > 0)
      S.hands[playerIndex].push(S.deck.pop());
    S.currentPlayer = (S.currentPlayer + 1) % NUM_PLAYERS;
  }

  function setupGame() {
    S.deck = CE.shuffle(createDosDeck());
    S.hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S.hands.push([]);
      for (let i = 0; i < 7; ++i)
        S.hands[p].push(S.deck.pop());
    }
    S.centerPiles = [S.deck.pop(), S.deck.pop()];
    // Ensure center piles are not wild
    for (let p = 0; p < 2; ++p)
      while (S.centerPiles[p].type === 'wild') {
        S.deck.unshift(S.centerPiles[p]);
        S.centerPiles[p] = S.deck.pop();
      }
    S.currentPlayer = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.selectedCards = [];
    S.aiTurnTimer = 0;
    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 100 + i * 55, 440, i * 0.1);
  }

  Object.assign(V, { canMatchDouble, canMatchSingle, drawFromDeck, doPlay, isColorMatch, setupGame });

})();
