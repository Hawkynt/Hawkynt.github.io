/* Uno All Wild: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['unowild'];
  const S = V.S;
  const { CARD_DEFS, NUM_PLAYERS, CANVAS_W, PLAYER_NAMES, CANVAS_H, HAND_SIZE } = V;
  const PL = SZ.CardGames.shared.sheddingPlaces;

  function createDeck() {
    const d = [];
    for (const def of CARD_DEFS)
      for (let i = 0; i < def.count; ++i)
        d.push({ color: 'wild', value: def.value, type: 'wild' });
    return d;
  }

  function reshuffleDeck() {
    if (S.deck.length > 0) return;
    if (S.discardPile.length <= 1) return;
    const top = S.discardPile.pop();
    S.deck = CE.shuffle(S.discardPile.splice(0));
    S.discardPile.push(top);
  }

  function drawFromDeck() {
    if (S.deck.length === 0) reshuffleDeck();
    return S.deck.length > 0 ? S.deck.pop() : null;
  }

  function findLeadingOpponent(excludePlayer) {
    let bestP = -1;
    let fewest = Infinity;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === excludePlayer || PL.isFinished(S, p)) continue;
      if (S.hands[p].length < fewest) {
        fewest = S.hands[p].length;
        bestP = p;
      }
    }
    return bestP;
  }

  /* finished players have left the turn order */
  function nextPlayer(from) {
    return PL.nextActive(S, from, S.direction, NUM_PLAYERS);
  }

  function advancePlayer() {
    S.currentPlayer = nextPlayer(S.currentPlayer);
  }

  function playCard(playerIdx, cardIdx) {
    if (S.roundOver || S.gameOver) return false;
    const hand = S.hands[playerIdx];
    if (cardIdx < 0 || cardIdx >= hand.length) return false;

    const card = hand.splice(cardIdx, 1)[0];
    S.discardPile.push(card);
    S.topCard = card;

    return resolveAction(card, playerIdx);
  }

  function resolveAction(card, playerIdx) {
    const val = card.value;

    switch (val) {
      case 'Wild':
        if (!checkWin(playerIdx)) advancePlayer();
        break;

      case 'Wild Skip': {
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Skip!', { color: '#ff0', size: 16 });
        if (!checkWin(playerIdx)) {
          advancePlayer();
          advancePlayer();
        }
        break;
      }

      case 'Wild Reverse': {
        S.direction = -S.direction;
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 200, 'Reverse!', { color: '#0ff', size: 16 });
        if (!checkWin(playerIdx)) advancePlayer();
        break;
      }

      case 'Wild Draw Two': {
        if (!checkWin(playerIdx)) {
          advancePlayer();
          const target = S.currentPlayer;
          for (let i = 0; i < 2; ++i) {
            const c = drawFromDeck();
            if (c) S.hands[target].push(c);
          }
          if (S._host) {
            const name = target === 0 ? 'You draw' : PLAYER_NAMES[target] + ' draws';
            S._host.floatingText.add(CANVAS_W / 2, 200, name + ' 2!', { color: '#f88', size: 16 });
          }
          advancePlayer();
        }
        break;
      }

      case 'Wild Forced Swap': {
        if (checkWin(playerIdx)) break;
        // A player who just went out has no hand left to swap
        if (PL.isFinished(S, playerIdx)) {
          advancePlayer();
          break;
        }
        if (playerIdx === 0) {
          S.waitingForTargetChoice = true;
          S.targetAction = 'swap';
          S.targetSourcePlayer = playerIdx;
          S.targetCard = card;
          return true;
        }
        const swapTarget = findLeadingOpponent(playerIdx);
        executeSwap(playerIdx, swapTarget);
        advancePlayer();
        break;
      }

      case 'Wild Targeted Draw Two': {
        if (checkWin(playerIdx)) break;
        if (playerIdx === 0) {
          S.waitingForTargetChoice = true;
          S.targetAction = 'targetdraw';
          S.targetSourcePlayer = playerIdx;
          S.targetCard = card;
          return true;
        }
        const drawTarget = findLeadingOpponent(playerIdx);
        executeTargetedDraw(drawTarget);
        advancePlayer();
        break;
      }

      case 'Wild Gap': {
        if (checkWin(playerIdx)) break;
        if (playerIdx === 0) {
          S.waitingForGapChoice = true;
          S.gapSourcePlayer = playerIdx;
          return true;
        }
        executeGap(1, playerIdx);
        break;
      }
    }

    return true;
  }

  function executeSwap(fromPlayer, withPlayer) {
    const tmp = S.hands[fromPlayer];
    S.hands[fromPlayer] = S.hands[withPlayer];
    S.hands[withPlayer] = tmp;
    if (S._host) {
      const from = fromPlayer === 0 ? 'You' : PLAYER_NAMES[fromPlayer];
      const to = withPlayer === 0 ? 'you' : PLAYER_NAMES[withPlayer];
      S._host.floatingText.add(CANVAS_W / 2, 200, from + ' swapped with ' + to + '!', { color: '#ff0', size: 16 });
    }
  }

  function executeTargetedDraw(targetPlayer) {
    for (let i = 0; i < 2; ++i) {
      const c = drawFromDeck();
      if (c) S.hands[targetPlayer].push(c);
    }
    if (S._host) {
      const name = targetPlayer === 0 ? 'You draw' : PLAYER_NAMES[targetPlayer] + ' draws';
      S._host.floatingText.add(CANVAS_W / 2, 200, name + ' 2!', { color: '#f88', size: 16 });
    }
  }

  function executeGap(gapCount, fromPlayer) {
    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, 200, 'Gap ' + gapCount + '!', { color: '#e3e', size: 16 });
    S.currentPlayer = fromPlayer;
    for (let i = 0; i <= gapCount; ++i)
      S.currentPlayer = nextPlayer(S.currentPlayer);
  }

  /* an empty hand takes the player out; true once that has ended the round */
  function checkWin(playerIdx) {
    if (S.roundOver) return true;
    if (!PL.recordFinish(S, playerIdx, S.hands[playerIdx], NUM_PLAYERS, PLAYER_NAMES[playerIdx], CANVAS_W / 2, 300)) return false;
    PL.presentPodium(S, S.hands, NUM_PLAYERS, PLAYER_NAMES, null, settleRound);
    return true;
  }

  /* the first player out scores 10 per card still held at round end */
  function settleRound(winner) {
    if (S._host) {
      const label = winner === 0 ? 'YOU WIN!' : PLAYER_NAMES[winner] + ' WINS!';
      const color = winner === 0 ? '#4f4' : '#f44';
      S._host.floatingText.add(CANVAS_W / 2, 300, label, { color: color, size: 28 });
    }

    if (winner === 0) {
      let pts = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        pts += S.hands[p].length * 10;
      S.score += pts;
      if (S._host) {
        S._host.addGlow(60, 420, 600, CE.CARD_H, 2);
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    }

    if (S._host) S._host.onScoreChanged(S.score);
  }

  function setupGame() {
    S.deck = CE.shuffle(createDeck());
    S.hands = [[], [], [], []];
    S.discardPile = [];
    S.currentPlayer = 0;
    S.direction = 1;
    S.roundOver = false;
    S.gameOver = false;
    S.aiTurnTimer = 0;
    S.hoverCardIdx = -1;
    S.waitingForTargetChoice = false;
    S.waitingForGapChoice = false;
    S.targetAction = null;
    S.targetSourcePlayer = -1;
    S.targetCard = null;
    S.gapSourcePlayer = -1;
    PL.resetPlaces(S);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      for (let i = 0; i < HAND_SIZE; ++i)
        S.hands[p].push(S.deck.pop());

    S.topCard = S.deck.pop();
    S.discardPile.push(S.topCard);

    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), V.playerCardY(), i * 0.1);

    if (S.topCard.value === 'Wild Skip')
      advancePlayer();
    else if (S.topCard.value === 'Wild Reverse')
      S.direction = -S.direction;
    else if (S.topCard.value === 'Wild Draw Two') {
      for (let i = 0; i < 2; ++i) {
        const c = drawFromDeck();
        if (c) S.hands[0].push(c);
      }
      advancePlayer();
    }
  }

  function sortHand(hand) {
    hand.sort((a, b) => String(a.value).localeCompare(String(b.value)));
  }

  Object.assign(V, { nextPlayer, findLeadingOpponent, advancePlayer, drawFromDeck, playCard, checkWin, executeTargetedDraw, executeSwap, sortHand, setupGame });

})();
