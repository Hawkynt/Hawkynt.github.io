/* Uno: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['uno'];
  const S = V.S;
  const { unoColors, CANVAS_W, CANVAS_H } = V;

  /* -- Persistence -- */
  function loadHouseRules() {
    try {
      const saved = localStorage.getItem('sz-uno-houserules');
      if (saved) Object.assign(S.houseRules, JSON.parse(saved));
    } catch (_e) { /* ignore */ }
  }

  function saveHouseRules() {
    try {
      localStorage.setItem('sz-uno-houserules', JSON.stringify(S.houseRules));
    } catch (_e) { /* ignore */ }
  }

  /* ================================================================
     DECK
     ================================================================ */

  function createUnoDeck() {
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
      if (S.houseRules.noMercy) {
        d.push({ color, value: 'Draw Six', type: 'action' });
        d.push({ color, value: 'Draw Ten', type: 'action' });
      }
    }
    for (let i = 0; i < 4; ++i) {
      d.push({ color: 'wild', value: 'Wild', type: 'wild' });
      d.push({ color: 'wild', value: 'Wild Draw Four', type: 'wild' });
    }
    return d;
  }

  /* ================================================================
     UNO RULES
     ================================================================ */

  function isDrawCard(value) {
    return value === 'Draw Two' || value === 'Wild Draw Four' || value === 'Draw Six' || value === 'Draw Ten';
  }

  function canPlayUno(card, topCard) {
    if (!topCard) return true;

    // Handle draw stacking
    if (S.drawStack > 0) {
      if (S.houseRules.stackPlus4 && card.value === 'Wild Draw Four' && topCard.value === 'Wild Draw Four')
        return true;
      if (S.houseRules.stackPlus2 && card.value === 'Draw Two' && topCard.value === 'Draw Two')
        return true;
      if (S.houseRules.stackPlus2OnPlus4 && card.value === 'Draw Two' && topCard.value === 'Wild Draw Four')
        return true;
      if (S.houseRules.noMercy && isDrawCard(card.value) && isDrawCard(topCard.value))
        return true;
      if (S.drawStack > 0 && isDrawCard(topCard.value))
        return false; // Must draw if can't stack
    }

    if (card.type === 'wild') return true;
    return card.color === topCard.color || card.value === topCard.value;
  }

  function applyDrawStack(nextPlayer) {
    if (S.drawStack > 0) {
      for (let i = 0; i < S.drawStack && S.unoDeck.length > 0; ++i)
        S.unoHands[nextPlayer].push(S.unoDeck.pop());
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Draw ' + S.drawStack + '!', { color: '#f88', size: 18 });
      S.drawStack = 0;
    }
  }

  function finishWildPlay(card, playerIndex, chosenColor) {
    card.color = chosenColor;
    if (card.value === 'Wild Draw Four') {
      const next = (S.unoCurrentPlayer + S.unoDirection + 3) % 3;
      if (S.houseRules.stackPlus4 || S.houseRules.noMercy)
        S.drawStack += 4;
      else {
        for (let i = 0; i < 4 && S.unoDeck.length > 0; ++i)
          S.unoHands[next].push(S.unoDeck.pop());
      }
    }
    checkWin(playerIndex);
  }

  function checkWin(playerIndex) {
    const hand = S.unoHands[playerIndex];
    if (hand.length === 0) {
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300,
          playerIndex === 0 ? 'YOU WIN!' : 'AI ' + playerIndex + ' WINS',
          { color: playerIndex === 0 ? '#4f4' : '#f44', size: 28 });
      }
      if (playerIndex === 0) {
        S.score += 50;
        if (S._host) {
          S._host.addGlow(60, 420, S.unoHands[0].length * 55 + CE.CARD_W, CE.CARD_H, 2);
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        }
      }
      S.roundOver = true;
      if (S._host) S._host.onScoreChanged(S.score);
      return true;
    }
    S.unoCurrentPlayer = (S.unoCurrentPlayer + S.unoDirection + 3) % 3;

    // If next player must draw from stack and can't counter
    if (S.drawStack > 0 && !S.houseRules.stackPlus4 && !S.houseRules.stackPlus2 && !S.houseRules.noMercy) {
      applyDrawStack(S.unoCurrentPlayer);
      S.unoCurrentPlayer = (S.unoCurrentPlayer + S.unoDirection + 3) % 3;
    }
    return false;
  }

  function unoPlayCard(playerIndex, cardIndex) {
    if (S.waitingForColorChoice) return false;
    const hand = S.unoHands[playerIndex];
    if (cardIndex < 0 || cardIndex >= hand.length) return false;
    const card = hand[cardIndex];
    if (!canPlayUno(card, S.unoTopCard)) return false;
    hand.splice(cardIndex, 1);
    S.unoTopCard = card;

    if (card.type === 'wild') {
      if (playerIndex === 0) {
        // Human player: show color choice overlay
        S.waitingForColorChoice = true;
        S.pendingWildCard = card;
        S.pendingWildPlayer = playerIndex;
        return true;
      }
      // AI: pick most common color in hand
      const counts = {};
      for (const c of unoColors) counts[c] = 0;
      for (const c of hand)
        if (c.color !== 'wild') ++counts[c.color];
      let best = unoColors[0];
      for (const c of unoColors)
        if (counts[c] > counts[best]) best = c;
      finishWildPlay(card, playerIndex, best);
      return true;
    }

    if (card.value === 'Skip')
      S.unoCurrentPlayer = (S.unoCurrentPlayer + S.unoDirection + 3) % 3;
    else if (card.value === 'Reverse')
      S.unoDirection = -S.unoDirection;
    else if (card.value === 'Draw Two') {
      if (S.houseRules.stackPlus2 || S.houseRules.noMercy)
        S.drawStack += 2;
      else {
        const next = (S.unoCurrentPlayer + S.unoDirection + 3) % 3;
        for (let i = 0; i < 2 && S.unoDeck.length > 0; ++i)
          S.unoHands[next].push(S.unoDeck.pop());
      }
    } else if (card.value === 'Draw Six') {
      S.drawStack += 6;
    } else if (card.value === 'Draw Ten') {
      S.drawStack += 10;
    } else if (card.value === '0' && S.houseRules.zeroRotate) {
      // Rotate all hands in direction of play
      if (S.unoDirection === 1) {
        const last = S.unoHands.pop();
        S.unoHands.unshift(last);
      } else {
        const first = S.unoHands.shift();
        S.unoHands.push(first);
      }
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Hands rotated!', { color: '#ff0', size: 16 });
    } else if (card.value === '7' && S.houseRules.sevenSwap) {
      if (playerIndex === 0) {
        S.waitingForSwapChoice = true;
        S.swapChoicePlayer = playerIndex;
        return true;
      }
      // AI: swap with opponent who has the most cards
      let target = -1;
      let maxCards = -1;
      for (let p = 0; p < 3; ++p) {
        if (p !== playerIndex && S.unoHands[p].length > maxCards) {
          maxCards = S.unoHands[p].length;
          target = p;
        }
      }
      if (target >= 0) {
        const tmp = S.unoHands[playerIndex];
        S.unoHands[playerIndex] = S.unoHands[target];
        S.unoHands[target] = tmp;
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 200, 'AI ' + playerIndex + ' swaps with ' + (target === 0 ? 'You' : 'AI ' + target) + '!', { color: '#ff0', size: 16 });
      }
    }

    checkWin(playerIndex);
    return true;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupUno() {
    loadHouseRules();
    S.unoDeck = CE.shuffle(createUnoDeck());
    S.unoHands = [[], [], []];
    S.unoCurrentPlayer = 0;
    S.unoDirection = 1;
    S.roundOver = false;
    S.gameOver = false;
    S.waitingForColorChoice = false;
    S.waitingForSwapChoice = false;
    S.pendingWildCard = null;
    S.pendingWildPlayer = -1;
    S.swapChoicePlayer = -1;
    S.drawStack = 0;
    S.aiTurnTimer = 0;
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 7; ++i)
        S.unoHands[p].push(S.unoDeck.pop());
    S.unoTopCard = S.unoDeck.pop();
    while (S.unoTopCard.type === 'wild') {
      S.unoDeck.unshift(S.unoTopCard);
      S.unoTopCard = S.unoDeck.pop();
    }
    if (S._host) {
      for (let i = 0; i < S.unoHands[0].length; ++i)
        S._host.dealCardAnim(S.unoHands[0][i], CANVAS_W / 2, -CE.CARD_H, 80 + i * 55, 440, i * 0.1);
    }
  }

  Object.assign(V, { unoPlayCard, canPlayUno, applyDrawStack, finishWildPlay, checkWin, saveHouseRules, setupUno });

})();
