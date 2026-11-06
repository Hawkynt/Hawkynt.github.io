/* Beggar Neighbor: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.beggar;
  const S = V.S;
  const { PENALTY, AI_PILE_X, AI_PILE_Y, PLAYER_PILE_X, PLAYER_PILE_Y, CENTER_X, CENTER_Y,
    PHASE_IDLE, PHASE_PLAY, PHASE_SHOW } = V;

  function isCourt(card) {
    return PENALTY[card.rank] !== undefined;
  }

  function playOneCard() {
    if (S.phase !== PHASE_IDLE || S.roundOver || S.gameOver) return;

    const source = S.isPlayerTurn ? S.playerPile : S.aiPile;
    if (source.length === 0) {
      V.finishGame(S.isPlayerTurn ? 'ai' : 'player');
      return;
    }

    const card = source.shift();
    card.faceUp = true;
    S.currentCard = card;
    S.centerPile.push(card);

    // Deal animation
    if (S._host) {
      const fromX = S.isPlayerTurn ? PLAYER_PILE_X : AI_PILE_X;
      const fromY = S.isPlayerTurn ? PLAYER_PILE_Y : AI_PILE_Y;
      S._host.dealCardAnim(card, fromX, fromY, CENTER_X, CENTER_Y, 0);
    }

    S.flipAnimProgress = 0;
    S.phase = PHASE_PLAY;
  }

  function resolveCard() {
    const card = S.currentCard;
    const playedByPlayer = S.isPlayerTurn;

    if (S.penaltyRemaining > 0) {
      // We are in a penalty payment phase
      --S.penaltyRemaining;

      if (isCourt(card)) {
        // Penalty transfers! The new court card sets a new penalty for the other player
        S.penaltyChallenger = playedByPlayer ? 'player' : 'ai';
        S.penaltyTotal = PENALTY[card.rank];
        S.penaltyRemaining = S.penaltyTotal;
        S.isPlayerTurn = !S.isPlayerTurn;
        S.phase = PHASE_SHOW;
        S.phaseTimer = 0;
        if (S._host)
          S._host.floatingText.add(CENTER_X + CE.CARD_W / 2, CENTER_Y - 20,
            card.rank + '! Pay ' + S.penaltyTotal, { color: '#ff0', size: 18 });
        return;
      }

      if (S.penaltyRemaining === 0) {
        // Payment complete without a court card -- challenger wins the pile
        S.collectTarget = S.penaltyChallenger;
        S.phase = PHASE_SHOW;
        S.phaseTimer = 0;
        S.resultText = (S.penaltyChallenger === 'player' ? 'You collect' : 'AI collects') + ' the pile!';
        if (S._host)
          S._host.floatingText.add(CENTER_X + CE.CARD_W / 2, CENTER_Y - 20,
            (S.penaltyChallenger === 'player' ? 'You' : 'AI') + ' collect!',
            { color: S.penaltyChallenger === 'player' ? '#4f4' : '#f44', size: 20 });
        return;
      }

      // Still paying -- keep same player's turn
      S.phase = PHASE_SHOW;
      S.phaseTimer = 0;
      return;
    }

    // Normal play (no active penalty)
    if (isCourt(card)) {
      // Court card played -- opponent must pay
      S.penaltyChallenger = playedByPlayer ? 'player' : 'ai';
      S.penaltyTotal = PENALTY[card.rank];
      S.penaltyRemaining = S.penaltyTotal;
      S.isPlayerTurn = !S.isPlayerTurn;
      S.phase = PHASE_SHOW;
      S.phaseTimer = 0;
      if (S._host)
        S._host.floatingText.add(CENTER_X + CE.CARD_W / 2, CENTER_Y - 20,
          card.rank + '! Pay ' + S.penaltyTotal, { color: '#ff0', size: 18 });
      return;
    }

    // Regular card, no penalty -- switch turn
    S.isPlayerTurn = !S.isPlayerTurn;
    S.phase = PHASE_SHOW;
    S.phaseTimer = 0;
  }

  function collectCards() {
    const winner = S.collectTarget;
    const allCards = S.centerPile.splice(0, S.centerPile.length);
    // Add to bottom of winner's pile
    if (winner === 'player')
      S.playerPile.push(...allCards);
    else
      S.aiPile.push(...allCards);

    S.penaltyRemaining = 0;
    S.penaltyTotal = 0;
    S.penaltyChallenger = '';
    S.collectTarget = '';
    S.resultText = '';
    S.currentCard = null;

    // Winner leads next
    S.isPlayerTurn = winner === 'player';

    // Update score
    S.score = S.playerPile.length;
    if (S._host) S._host.onScoreChanged(S.score);

    // Check game over
    if (S.playerPile.length === 0) {
      V.finishGame('ai');
    } else if (S.aiPile.length === 0) {
      V.finishGame('player');
    } else {
      S.phase = PHASE_IDLE;
    }
  }

  Object.assign(V, { playOneCard, resolveCard, collectCards });

})();
