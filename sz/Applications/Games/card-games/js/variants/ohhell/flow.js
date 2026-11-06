/* Oh Hell - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.ohhell;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, ROUND_SIZES,
    TOTAL_ROUNDS, PHASE_BIDDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_OVER, PLAYER_HAND_Y
  } = V;

  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     SETUP / DEALING
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());
    S.handSize = ROUND_SIZES[S.roundIndex];

    S.hands = [[], [], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.bids = [-1, -1, -1, -1];
    S.bidsDone = [false, false, false, false];
    S.tricksWon = [0, 0, 0, 0];
    S.trickCount = 0;
    S.totalBidsSoFar = 0;
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.hoveredCard = -1;
    S.hoveredBid = -1;
    S.roundOver = false;
    S.trumpCard = null;
    S.trumpSuit = null;

    const totalCards = S.handSize * NUM_PLAYERS;
    for (let i = 0; i < totalCards; ++i)
      S.hands[i % NUM_PLAYERS].push(d[i]);

    /* Flip trump from remaining deck */
    if (totalCards < 52) {
      S.trumpCard = d[totalCards];
      S.trumpCard.faceUp = true;
      S.trumpSuit = S.trumpCard.suit;
    }
    /* No trump when no cards remain (handSize=13 would use all 52) */

    for (const c of S.hands[0]) c.faceUp = true;
    for (let p = 0; p < NUM_PLAYERS; ++p) V.sortHand(S.hands[p]);

    /* Bidding starts left of dealer */
    S.biddingPlayer = (S.dealer + 1) % NUM_PLAYERS;
    S.phase = PHASE_BIDDING;

    if (S._host)
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.06);
  }

  function setupGame() {
    S.cumulativeScores = [0, 0, 0, 0];
    S.roundIndex = 0;
    S.dealer = 0;
    S.gameOver = false;
    S.score = 0;
    deal();
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function placeBid(playerIdx, bid) {
    S.bids[playerIdx] = bid;
    S.bidsDone[playerIdx] = true;
    S.totalBidsSoFar += bid;

    if (S._host) {
      const who = playerIdx === 0 ? 'You bid' : PLAYER_NAMES[playerIdx] + ' bids';
      S._host.floatingText.add(CANVAS_W / 2, 300, who + ' ' + bid, { color: '#ff0', size: 14 });
    }

    advanceBidding();
  }

  function advanceBidding() {
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const p = (S.biddingPlayer + 1 + i) % NUM_PLAYERS;
      if (!S.bidsDone[p]) {
        S.biddingPlayer = p;
        S.aiTurnTimer = 0;
        return;
      }
    }
    /* All bids done */
    startPlaying();
  }

  function startPlaying() {
    S.phase = PHASE_PLAYING;
    S.trickLeader = (S.dealer + 1) % NUM_PLAYERS;
    S.currentTurn = S.trickLeader;
    S.trickCards = [];
    S.trickPlayers = [];
    S.aiTurnTimer = 0;
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const card = S.hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);

    if (S.trickCards.length >= NUM_PLAYERS) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinnerIdx = V.resolveTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }

    S.currentTurn = (S.currentTurn + 1) % NUM_PLAYERS;
  }

  function finishTrick() {
    const winner = S.trickWinnerIdx;
    ++S.tricksWon[winner];
    ++S.trickCount;

    if (S._host) {
      const who = winner === 0 ? 'You win' : PLAYER_NAMES[winner] + ' wins';
      S._host.floatingText.add(CANVAS_W / 2, 280, who + ' trick #' + S.trickCount, { color: winner === 0 ? '#4f4' : '#fa0', size: 16 });
    }

    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerIdx = -1;

    if (S.trickCount >= S.handSize || S.hands.every(h => h.length === 0)) {
      endRound();
      return;
    }

    S.trickLeader = winner;
    S.currentTurn = winner;
    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function endRound() {
    const roundScores = [0, 0, 0, 0];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.tricksWon[p] === S.bids[p])
        roundScores[p] = 10 + S.bids[p];
      /* else 0 */
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      S.cumulativeScores[p] += roundScores[p];

    S.score = S.cumulativeScores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (roundScores[p] > 0 && S._host) {
        const label = PLAYER_NAMES[p] + ' +' + roundScores[p];
        const color = p === 0 ? '#4f4' : '#8cf';
        S._host.floatingText.add(CANVAS_W / 2, 260 + p * 18, label, { color, size: 14 });
      }
    }

    ++S.roundIndex;
    S.roundOver = true;

    if (S.roundIndex >= TOTAL_ROUNDS) {
      S.gameOver = true;
      let best = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p)
        if (S.cumulativeScores[p] > S.cumulativeScores[best]) best = p;

      if (S._host) {
        const msg = best === 0 ? 'You win the game!' : PLAYER_NAMES[best] + ' wins the game!';
        const col = best === 0 ? '#4f4' : '#f88';
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: col, size: 24 });
        if (best === 0) S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
      }
    }

    S.phase = PHASE_ROUND_OVER;
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_OVER) return;

    /* Trick done timer */
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

    /* AI bidding */
    if (S.phase === PHASE_BIDDING && S.biddingPlayer !== 0 && !S.bidsDone[S.biddingPlayer]) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        const bid = V.aiBid(S.biddingPlayer);
        placeBid(S.biddingPlayer, bid);
      }
      return;
    }

    /* AI playing */
    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;
    if (S.trickCards.length >= NUM_PLAYERS) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;
      const idx = V.aiChooseCard(S.currentTurn);
      if (idx >= 0)
        playCard(S.currentTurn, idx);
    }
  }

  Object.assign(V, {
    deal, setupGame, placeBid, playCard, tick
  });

})();
