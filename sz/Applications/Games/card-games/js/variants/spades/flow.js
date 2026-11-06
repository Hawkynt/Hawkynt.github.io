/* Spades - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.spades;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, TRUMP_SUIT, PLAYER_NAMES, TEAM_NS, TEAM_EW,
    PHASE_BIDDING, PHASE_PLAYING, PHASE_ROUND_OVER, PLAYER_HAND_Y
  } = V;

  const PHASE_TRICK_DONE = 2;
  const AI_TURN_DELAY = 0.8;
  const TRICK_DISPLAY_TIME = 1.2;

  function playCard(playerIdx, handIndex) {
    const card = S.hands[playerIdx].splice(handIndex, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);

    // Check if spades broken
    if (card.suit === TRUMP_SUIT && S.trickCards.length > 1)
      S.spadesBroken = true;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());

    S.hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      S.hands[i % 4].push(d[i]);

    for (const c of S.hands[0]) c.faceUp = true;
    V.sortHand(S.hands[0]);
    for (let p = 1; p < 4; ++p) V.sortHand(S.hands[p]);

    S.trickCards = [];
    S.trickPlayers = [];
    S.bids = [0, 0, 0, 0];
    S.bidsDone = [false, false, false, false];
    S.tricksWon = [0, 0, 0, 0];
    S.spadesBroken = false;
    S.trickCount = 0;
    S.roundOver = false;
    S.phase = PHASE_BIDDING;
    S.biddingPlayer = 0;
    S.aiTurnTimer = 0;
    S.trickWinnerDisplay = '';
    S.trickDisplayTimer = 0;
    S.selectedCard = -1;
    S.hoveredCard = -1;
    S.hoveredBid = -1;
    S.statusMessage = 'Your bid?';

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  function setupGame() {
    S.teamScores = [0, 0];
    S.teamBags = [0, 0];
    S.gameOver = false;
    S.score = 0;
    deal();
  }

  /* ================================================================
     TRICK RESOLUTION
     ================================================================ */

  function resolveTrick() {
    if (S.trickCards.length < 4) return;

    const winner = V.determineTrickWinner();
    ++S.tricksWon[winner];
    ++S.trickCount;

    S.trickWinnerDisplay = PLAYER_NAMES[winner] + ' wins the trick!';

    if (S._host) {
      const label = (winner === 0 ? 'You win' : PLAYER_NAMES[winner] + ' wins') + ' trick #' + S.trickCount;
      const color = V.teamOf(winner) === TEAM_NS ? '#4f4' : '#f88';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 16 });
    }

    S.phase = PHASE_TRICK_DONE;
    S.trickDisplayTimer = TRICK_DISPLAY_TIME;
    S.currentLead = winner;
    S.currentTurn = winner;
  }

  function clearTrickAndContinue() {
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerDisplay = '';

    if (S.trickCount >= 13) {
      endRound();
      return;
    }

    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    V.scoreRound();
    V.checkGameOver();
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    if (S._host) {
      if (S.gameOver) {
        const won = S.teamScores[TEAM_NS] >= 500 || S.teamScores[TEAM_EW] <= -200;
        if (won) S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    }
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function advanceBidding() {
    // Find next player who hasn't bid
    for (let i = 0; i < 4; ++i) {
      const p = (S.biddingPlayer + 1 + i) % 4;
      if (!S.bidsDone[p]) {
        S.biddingPlayer = p;
        return;
      }
    }
    // All bids done -- start playing
    startPlaying();
  }

  function startPlaying() {
    S.phase = PHASE_PLAYING;
    // Player to left of dealer leads; simplified: player 0 leads first round
    S.currentLead = 0;
    S.currentTurn = 0;
    S.aiTurnTimer = 0;
    S.statusMessage = '';
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_OVER) return;

    // Trick display timer
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDisplayTimer -= dt;
      if (S.trickDisplayTimer <= 0)
        clearTrickAndContinue();
      return;
    }

    // AI bidding
    if (S.phase === PHASE_BIDDING && S.biddingPlayer !== 0 && !S.bidsDone[S.biddingPlayer]) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        S.bids[S.biddingPlayer] = V.aiBid(S.biddingPlayer);
        S.bidsDone[S.biddingPlayer] = true;
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' bids ' + (S.bids[S.biddingPlayer] === 0 ? 'Nil' : S.bids[S.biddingPlayer]), { color: '#ff0', size: 14 });
        advanceBidding();
      }
      return;
    }

    // AI playing
    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;
    if (S.trickCards.length >= 4) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;
      V.aiPlay(S.currentTurn);
      if (S.trickCards.length >= 4)
        resolveTrick();
      else
        S.currentTurn = (S.currentTurn + 1) % 4;
    }
  }

  Object.assign(V, {
    playCard, deal, setupGame, resolveTrick, advanceBidding, tick
  });

})();
