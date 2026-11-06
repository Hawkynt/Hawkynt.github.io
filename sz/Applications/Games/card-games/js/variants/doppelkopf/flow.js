/* Doppelkopf - dealing, turn flow, round end and the eight-round match. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.doppelkopf;
  const S = V.S;
  const {
    CANVAS_W, NUM_PLAYERS, HAND_SIZE, ROUNDS_PER_MATCH,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER, PLAYER_NAMES
  } = V;

  const AI_TURN_DELAY = 0.7;
  const TRICK_AUTO_CONTINUE = 4;

  /* ================================================================
     MATCH / ROUND SETUP
     ================================================================ */

  function newMatch() {
    S.roundNumber = 0;
    S.dealer = Math.floor(Math.random() * NUM_PLAYERS);
    S.cumulativeScores = [0, 0, 0, 0];
    S.matchInProgress = true;
    S.gameOver = false;
  }

  function dealRound() {
    const d = CE.shuffle(V.createDeck());
    S.hands = [[], [], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.tricks = [];
    S.tricksWon = [0, 0, 0, 0];
    S.playedQueenOfClubs = [false, false, false, false];
    S.queensOfClubsPlayed = 0;
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.hoverCardIdx = -1;
    S.result = null;
    S.roundOver = false;
    S.reportedToHost = false;

    /* deal 3-3-3-3 starting left of the dealer */
    for (let r = 0; r < HAND_SIZE / 3; ++r)
      for (let k = 1; k <= NUM_PLAYERS; ++k) {
        const p = (S.dealer + k) % NUM_PLAYERS;
        for (let j = 0; j < 3; ++j)
          S.hands[p].push(d.pop());
      }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);
    for (const c of S.hands[0])
      c.faceUp = true;

    S.re = [false, false, false, false];
    S.soloist = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const queens = S.hands[p].filter(V.isQueenOfClubs).length;
      S.re[p] = queens > 0;
      if (queens === 2)
        S.soloist = p;
    }

    S.currentTurn = (S.dealer + 1) % NUM_PLAYERS;
    S.phase = PHASE_PLAYING;

    if (S._host && S._host.dealCardAnim) {
      const hand = S.hands[0];
      for (let i = 0; i < hand.length; ++i)
        S._host.dealCardAnim(hand[i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, hand.length), V.playerCardY(), i * 0.05);
    }
  }

  /* called from setup(): the host re-runs setup for every new round */
  function startRoundFromSetup() {
    if (!S.continueMatch || !S.matchInProgress || S.gameOver)
      newMatch();
    else
      S.dealer = (S.dealer + 1) % NUM_PLAYERS;
    S.continueMatch = false;
    dealRound();
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(p, idx) {
    const card = S.hands[p].splice(idx, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(p);

    if (V.isQueenOfClubs(card)) {
      S.playedQueenOfClubs[p] = true;
      ++S.queensOfClubsPlayed;
      if (S._host && S._host.floatingText) {
        const solo = S.soloist === p && S.queensOfClubsPlayed === 2;
        const text = PLAYER_NAMES[p] + (solo ? ': silent solo!' : (p === 0 ? ' are Re' : ' is Re'));
        S._host.floatingText.add(CANVAS_W / 2, 150, text, { color: '#ffd54f', size: 16 });
      }
    }

    if (S.trickCards.length >= NUM_PLAYERS) {
      S.trickWinnerIdx = S.trickPlayers[V.winningIndex(S.trickCards)];
      S.trickDoneTimer = 0;
      S.phase = PHASE_TRICK_DONE;
      return;
    }
    S.currentTurn = (p + 1) % NUM_PLAYERS;
    S.aiTurnTimer = 0;
  }

  function finishTrick() {
    if (S.phase !== PHASE_TRICK_DONE)
      return;
    const winner = S.trickWinnerIdx;
    S.tricks.push({ cards: S.trickCards.slice(), players: S.trickPlayers.slice(), winner });
    ++S.tricksWon[winner];

    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerIdx = -1;
    S.aiTurnTimer = 0;

    if (S.tricks.length >= HAND_SIZE) {
      endRound();
      return;
    }
    S.currentTurn = winner;
    S.phase = PHASE_PLAYING;
  }

  function endRound() {
    const r = V.scoreRound(S.re, S.soloist, S.tricks);
    S.result = r;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      S.cumulativeScores[p] += r.playerScores[p];

    S.score += r.playerScores[0] * 10;
    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);

    ++S.roundNumber;
    S.roundOver = true;
    if (S.roundNumber >= ROUNDS_PER_MATCH) {
      S.gameOver = true;
      S.matchInProgress = false;
    }
    S.phase = PHASE_ROUND_OVER;

    if (S._host && S._host.floatingText) {
      const won = r.playerScores[0] > 0;
      S._host.floatingText.add(CANVAS_W / 2, 110, won ? 'Your party wins the round!' : 'Your party loses the round', { color: won ? '#8f8' : '#f88', size: 18 });
    }
  }

  /* round summary acknowledged: hand control back to the host */
  function acknowledgeRound() {
    if (S.phase !== PHASE_ROUND_OVER || S.reportedToHost)
      return;
    S.reportedToHost = true;
    S.continueMatch = !S.gameOver;
    if (S._host && S._host.onRoundOver)
      S._host.onRoundOver(S.gameOver);
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_OVER)
      return;

    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_AUTO_CONTINUE)
        finishTrick();
      return;
    }

    if (S.currentTurn === 0)
      return;
    S.aiTurnTimer += dt;
    if (S.aiTurnTimer < AI_TURN_DELAY)
      return;
    S.aiTurnTimer = 0;
    const idx = V.aiChooseCard(S.currentTurn);
    if (idx >= 0)
      playCard(S.currentTurn, idx);
  }

  Object.assign(V, {
    newMatch, dealRound, startRoundFromSetup, playCard, finishTrick,
    endRound, acknowledgeRound, tick
  });

})();
