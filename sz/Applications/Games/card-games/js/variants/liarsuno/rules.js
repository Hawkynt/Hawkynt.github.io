/* Liar's Uno: deck, legal moves, card effects, scoring and round flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v['liarsuno'];
  const S = V.S;
  const { UNO_COLORS, NUM_PLAYERS, PLAYER_NAMES, CANVAS_W, CANVAS_H, INITIAL_HAND_SIZE } = V;
  const SH = SZ.CardGames.shared.sheddingHand;

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

  function isLegalPlay(card) {
    if (card.type === 'wild') return true;
    if (card.color === S.currentColor) return true;
    const top = S.discardPile[S.discardPile.length - 1];
    if (top && card.value === top.value) return true;
    return false;
  }

  function nextPlayer() {
    S.currentPlayer = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
  }

  function resolveAction(claimedValue, claimedColor) {
    if (claimedValue === 'Skip')
      nextPlayer();
    else if (claimedValue === 'Reverse') {
      if (NUM_PLAYERS === 2) nextPlayer();
      else S.direction = -S.direction;
    } else if (claimedValue === 'Draw Two') {
      const target = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
      SH.drawCards(S, target, 2);
      nextPlayer();
    } else if (claimedValue === 'Wild Draw Four') {
      const target = (S.currentPlayer + S.direction + NUM_PLAYERS) % NUM_PLAYERS;
      SH.drawCards(S, target, 4);
      nextPlayer();
    }

    if (claimedColor && claimedColor !== 'wild')
      S.currentColor = claimedColor;
  }

  function checkWin(playerIndex) {
    if (S.hands[playerIndex].length > 0) return false;
    S.roundOver = true;
    if (playerIndex === 0) {
      S.score += 100;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 300, 'YOU WIN!', { color: '#4f4', size: 28 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        S._host.onScoreChanged(S.score);
      }
    } else if (S._host) {
      S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[playerIndex] + ' WINS!', { color: '#f44', size: 28 });
      S._host.onScoreChanged(S.score);
    }
    return true;
  }

  function doPlay(playerIndex, cardIndex, faceDown, claimedColor, claimedValue) {
    const hand = S.hands[playerIndex];
    const card = hand[cardIndex];
    hand.splice(cardIndex, 1);
    S.discardPile.push(card);

    const actualColor = card.type === 'wild' ? 'wild' : card.color;
    const actualValue = card.value;

    if (!faceDown) {
      // Face-up: must be legal
      if (card.type === 'wild')
        S.currentColor = claimedColor || UNO_COLORS[0];
      else
        S.currentColor = card.color;
      claimedColor = S.currentColor;
      claimedValue = actualValue;
    } else {
      // Face-down bluff: claimed values used
      S.currentColor = claimedColor || S.currentColor;
    }

    S.lastPlayInfo = {
      player: playerIndex,
      card,
      faceDown,
      claimedColor: claimedColor || S.currentColor,
      claimedValue: claimedValue || actualValue,
      actualColor,
      actualValue,
    };

    // Uno call
    if (hand.length === 1 && S._host)
      S._host.floatingText.add(CANVAS_W / 2, 350, 'UNO!', { color: '#0ff', size: 24 });

    if (checkWin(playerIndex)) {
      S.lastPlayInfo = null;
      return true;
    }

    // Enter challenge phase
    S.challengePhase = true;
    S.challengeTimer = 0;
    S.challengeResult = null;

    return true;
  }

  function finishTurn() {
    if (!S.lastPlayInfo) return;
    // Resolve action based on claimed values
    resolveAction(S.lastPlayInfo.claimedValue, S.lastPlayInfo.claimedColor);
    S.lastPlayInfo = null;
    S.challengePhase = false;
    nextPlayer();
  }

  function doChallenge(challengerIndex) {
    if (!S.lastPlayInfo) return;
    const info = S.lastPlayInfo;
    const wasBluff = info.faceDown &&
      (info.claimedColor !== info.actualColor || info.claimedValue !== info.actualValue);

    S.challengePhase = false;
    const challengerName = challengerIndex === 0 ? 'You' : PLAYER_NAMES[challengerIndex];
    const playerName = info.player === 0 ? 'You' : PLAYER_NAMES[info.player];

    if (wasBluff) {
      // Liar caught — liar picks up entire discard pile
      const pile = S.discardPile.splice(0);
      for (const c of pile) S.hands[info.player].push(c);
      // Put a fresh card on discard
      SH.refillDeck(S);
      if (S.deck.length > 0) S.discardPile.push(S.deck.pop());
      S.currentColor = S.discardPile.length > 0 && S.discardPile[S.discardPile.length - 1].color !== 'wild' ? S.discardPile[S.discardPile.length - 1].color : S.currentColor;

      S.challengeResult = { text: challengerName + ' caught ' + playerName + ' bluffing! Picks up pile!', color: '#4f4', timer: 2 };
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 250, 'CAUGHT!', { color: '#4f4', size: 22 });
    } else {
      // Wrong accusation — challenger draws 2
      SH.drawCards(S, challengerIndex, 2);
      // Resolve the play normally
      resolveAction(info.claimedValue, info.claimedColor);

      S.challengeResult = { text: playerName + ' was honest! ' + challengerName + ' draws 2!', color: '#f88', timer: 2 };
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 250, 'Honest!', { color: '#f88', size: 22 });
    }

    S.lastPlayInfo = null;
    nextPlayer();
  }

  function setupGame() {
    S.deck = CE.shuffle(createLiarsDeck());
    S.hands = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      S.hands.push([]);
      for (let i = 0; i < INITIAL_HAND_SIZE; ++i)
        S.hands[p].push(S.deck.pop());
    }
    let first = S.deck.pop();
    while (first.type === 'wild') {
      S.deck.unshift(first);
      first = S.deck.pop();
    }
    S.discardPile = [first];
    S.currentColor = first.color;
    S.currentPlayer = 0;
    S.direction = 1;
    S.roundOver = false;
    S.gameOver = false;
    S.lastPlayInfo = null;
    S.challengePhase = false;
    S.challengeTimer = 0;
    S.bluffMode = false;
    S.bluffClaimStep = 0;
    S.bluffCard = null;
    S.bluffCardIndex = -1;
    S.challengeResult = null;
    S.aiTurnTimer = 0;
    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, 140 + i * 60, 440, i * 0.1);
  }

  Object.assign(V, { isLegalPlay, nextPlayer, doPlay, finishTurn, doChallenge, setupGame });

})();
