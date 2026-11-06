/* Uno Party: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unoparty'];
  const S = V.S;
  const { UNO_COLORS, PLAYER_COUNT, PLAYER_NAMES, CANVAS_W, CANVAS_H, WIN_SCORE, DEAL_COUNT } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

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

  function canPlay(card) {
    if (S.drawPending > 0) {
      return card.value === 'Draw Two' || card.value === 'Wild Everyone Draw';
    }
    if (card.type === 'party') return true;
    if (card.color === S.currentColor) return true;
    const top = S.discardPile[S.discardPile.length - 1];
    if (top && card.value === top.value) return true;
    return false;
  }

  function nextPlayer() {
    S.currentPlayer = (S.currentPlayer + S.direction + PLAYER_COUNT) % PLAYER_COUNT;
  }

  function cardPoints(card) {
    if (card.type === 'party') return 50;
    if (card.value === 'Skip' || card.value === 'Reverse' || card.value === 'Draw Two') return 20;
    return parseInt(card.value) || 0;
  }

  function checkWin(playerIndex) {
    if (S.hands[playerIndex].length > 0) return false;
    S.roundOver = true;
    let pts = 0;
    for (let p = 0; p < PLAYER_COUNT; ++p)
      if (p !== playerIndex)
        for (const c of S.hands[p])
          pts += cardPoints(c);
    if (playerIndex === 0) {
      S.score += pts;
      if (S.score >= WIN_SCORE) S.gameOver = true;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN! +' + pts, { color: '#4f4', size: 28 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.onScoreChanged(S.score);
      }
    } else {
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[playerIndex] + ' WINS!', { color: '#f44', size: 28 });
        S._host.onScoreChanged(S.score);
      }
    }
    return true;
  }

  function playCard(playerIndex, cardIndex, chosenColor) {
    const hand = S.hands[playerIndex];
    const card = hand[cardIndex];
    if (!canPlay(card)) return false;
    hand.splice(cardIndex, 1);
    S.discardPile.push(card);

    // Handle actions
    if (card.value === 'Skip') {
      if (card.color !== 'wild') S.currentColor = card.color;
      nextPlayer(); // skip
    } else if (card.value === 'Reverse') {
      if (card.color !== 'wild') S.currentColor = card.color;
      if (PLAYER_COUNT === 2) nextPlayer();
      else S.direction = -S.direction;
    } else if (card.value === 'Draw Two') {
      if (card.color !== 'wild') S.currentColor = card.color;
      S.drawPending += 2;
    } else if (card.value === 'Wild Everyone Draw') {
      S.currentColor = chosenColor || S.currentColor;
      // All other players draw 2
      for (let p = 0; p < PLAYER_COUNT; ++p)
        if (p !== playerIndex)
          SH.drawCards(S, p, 2);
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 250, 'Everyone draws 2!', { color: '#f88', size: 18 });
    } else if (card.value === 'Wild Trade Hands') {
      S.currentColor = chosenColor || S.currentColor;
      // Trade hands — handled after color choice for human, AI picks immediately
      if (playerIndex !== 0) {
        // AI trades with player who has fewest cards (maximize advantage)
        let target = -1, minCards = Infinity;
        for (let p = 0; p < PLAYER_COUNT; ++p)
          if (p !== playerIndex && S.hands[p].length < minCards) { minCards = S.hands[p].length; target = p; }
        if (target >= 0) {
          const tmp = S.hands[playerIndex];
          S.hands[playerIndex] = S.hands[target];
          S.hands[target] = tmp;
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 250, PLAYER_NAMES[playerIndex] + ' trades with ' + PLAYER_NAMES[target] + '!', { color: '#ff0', size: 16 });
        }
      } else {
        // Human — show trade choice overlay after this returns
        S.pendingTradeType = 'trade';
        S.tradeChoiceActive = true;
      }
    } else if (card.value === 'Wild Discard All') {
      S.currentColor = chosenColor || S.currentColor;
      // Discard all cards of current color from hand
      let discarded = 0;
      for (let i = hand.length - 1; i >= 0; --i)
        if (hand[i].color === S.currentColor) {
          S.discardPile.push(hand[i]);
          hand.splice(i, 1);
          ++discarded;
        }
      if (S._host && discarded > 0)
        S._host.floatingText.add(CANVAS_W / 2, 250, 'Discarded ' + discarded + ' ' + S.currentColor + ' cards!', { color: '#4f4', size: 16 });
    } else if (card.value === 'Wild Pick Color') {
      S.currentColor = chosenColor || S.currentColor;
    } else {
      // Number card
      if (card.color !== 'wild') S.currentColor = card.color;
    }

    // Uno call
    if (hand.length === 1 && S._host)
      S._host.floatingText.add(CANVAS_W / 2, 350, 'UNO!', { color: '#0ff', size: 24 });

    if (checkWin(playerIndex)) return true;

    // Don't advance if trade choice pending (human picks target)
    if (S.tradeChoiceActive) return true;

    nextPlayer();

    // Resolve pending draws
    if (S.drawPending > 0) {
      const nh = S.hands[S.currentPlayer];
      let canStack = false;
      for (const c of nh)
        if (c.value === 'Draw Two') { canStack = true; break; }
      if (!canStack) {
        SH.drawCards(S, S.currentPlayer, S.drawPending);
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 250, PLAYER_NAMES[S.currentPlayer] + ' draws ' + S.drawPending + '!', { color: '#f88', size: 16 });
        S.drawPending = 0;
        nextPlayer();
      }
    }

    return true;
  }

  function setupGame() {
    S.deck = CE.shuffle(createPartyDeck());
    S.hands = [];
    for (let p = 0; p < PLAYER_COUNT; ++p) {
      S.hands.push([]);
      for (let i = 0; i < DEAL_COUNT; ++i)
        S.hands[p].push(S.deck.pop());
    }
    let first = S.deck.pop();
    while (first.type === 'party') {
      S.deck.unshift(first);
      first = S.deck.pop();
    }
    S.discardPile = [first];
    S.currentColor = first.color;
    S.currentPlayer = 0;
    S.direction = 1;
    S.drawPending = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.colorChoiceActive = false;
    S.tradeChoiceActive = false;
    S.pendingWildIndex = -1;
    S.pendingTradeType = '';
    S.aiTurnTimer = 0;
    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 100 + i * 55, 450, i * 0.1);
  }

  Object.assign(V, { nextPlayer, playCard, canPlay, setupGame });

})();
