/* Cheat: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.cheat;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, RANKS, NUM_PLAYERS, PLAYER_NAMES, PHASE_CHALLENGE_WINDOW,
    PHASE_RESOLVING, CHALLENGE_WINDOW_DURATION, RESOLVE_DELAY, MESSAGE_FADE } = V;

  function requiredRank() {
    return RANKS[S.requiredRankIdx % 13];
  }

  function setMessage(msg, color) {
    S.message = msg;
    S.messageColor = color || '#fff';
    S.messageTimer = MESSAGE_FADE;
  }

  function sortHand(hand) {
    const rankOrder = {};
    for (let i = 0; i < RANKS.length; ++i)
      rankOrder[RANKS[i]] = i;
    const suitOrder = { clubs: 0, diamonds: 1, hearts: 2, spades: 3 };
    hand.sort((a, b) => {
      const rd = rankOrder[a.rank] - rankOrder[b.rank];
      if (rd !== 0) return rd;
      return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
    });
  }

  function cardsAllMatch(cards, rank) {
    for (const c of cards)
      if (c.rank !== rank) return false;
    return true;
  }

  function playCards(playerIdx, cardIndices) {
    const sorted = cardIndices.slice().sort((a, b) => b - a);
    const actualCards = [];
    for (const idx of sorted)
      actualCards.push(S.hands[playerIdx].splice(idx, 1)[0]);

    const claimedRank = requiredRank();
    for (const c of actualCards)
      S.discardPile.push(c);

    S.lastPlayInfo = {
      player: playerIdx,
      count: actualCards.length,
      claimedRank,
      actualCards
    };

    const name = PLAYER_NAMES[playerIdx];
    setMessage(name + ' plays ' + actualCards.length + ' card(s) as ' + claimedRank, '#ff0');

    if (S._host)
      S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, name + ': ' + actualCards.length + 'x ' + claimedRank, { color: '#ff0', size: 16 });

    V.advanceRank();

    // Check if this player won
    if (S.hands[playerIdx].length === 0) {
      V.endGame(playerIdx);
      return;
    }

    // Enter challenge window
    S.phase = PHASE_CHALLENGE_WINDOW;
    S.challengeTimer = CHALLENGE_WINDOW_DURATION;
  }

  function resolveChallenge(challengerIdx) {
    if (!S.lastPlayInfo) return;

    const honest = cardsAllMatch(S.lastPlayInfo.actualCards, S.lastPlayInfo.claimedRank);
    const challengerName = PLAYER_NAMES[challengerIdx];
    const playerName = PLAYER_NAMES[S.lastPlayInfo.player];

    S.phase = PHASE_RESOLVING;

    if (honest) {
      // Challenger picks up pile -- play was honest
      S.resolveMessage = challengerName + ' challenged but ' + playerName + ' was honest! ' + challengerName + ' picks up ' + S.discardPile.length + ' cards!';
      S.resolveColor = '#f88';
      const pile = S.discardPile.splice(0, S.discardPile.length);
      for (const c of pile) {
        c.faceUp = true;
        S.hands[challengerIdx].push(c);
      }
      sortHand(S.hands[challengerIdx]);

      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Honest! ' + challengerName + ' takes pile!', { color: '#f88', size: 18 });
        if (challengerIdx === 0)
          S._host.screenShake.trigger(6, 300);
      }
    } else {
      // Cheater picks up pile
      const cheaterIdx = S.lastPlayInfo.player;
      const cheaterName = PLAYER_NAMES[cheaterIdx];
      S.resolveMessage = challengerName + ' caught ' + cheaterName + ' cheating! ' + cheaterName + ' picks up ' + S.discardPile.length + ' cards!';
      S.resolveColor = '#8f8';
      const pile = S.discardPile.splice(0, S.discardPile.length);
      for (const c of pile) {
        c.faceUp = true;
        S.hands[cheaterIdx].push(c);
      }
      sortHand(S.hands[cheaterIdx]);

      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Caught cheating! ' + cheaterName + ' takes pile!', { color: '#8f8', size: 18 });
        if (cheaterIdx === 0)
          S._host.screenShake.trigger(6, 300);
      }
    }

    S.resolveTimer = RESOLVE_DELAY;
    S.lastPlayInfo = null;
  }

  function afterResolve() {
    // Check for any empty-hand win
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.hands[p].length === 0) {
        V.endGame(p);
        return;
      }
    }

    // Next player's turn
    S.currentPlayer = V.nextPlayer(S.currentPlayer);
    V.startTurn();
  }

  function skipChallenge() {
    if (!S.lastPlayInfo) return;

    // No challenge -- move to next player
    S.lastPlayInfo = null;
    S.currentPlayer = V.nextPlayer(S.currentPlayer);
    V.startTurn();
  }

  Object.assign(V, { requiredRank, setMessage, sortHand, playCards, resolveChallenge, afterResolve,
    skipChallenge });

})();
