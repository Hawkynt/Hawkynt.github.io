/* Pinochle - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pinochle;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, HAND_SIZE, GAME_WIN_SCORE,
    PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_BIDDING, PHASE_TRUMP_SELECT,
    PHASE_MELDING, PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_SCORE,
    PLAYER_HAND_Y
  } = V;

  const TRICK_DONE_DELAY = 1.2;
  const MELD_DISPLAY_DELAY = 3.0;
  const AI_TURN_DELAY = 0.6;

  /* ================================================================
     SETUP & DEALING
     ================================================================ */

  function deal() {
    const d = CE.shuffle(V.createPinochleDeck());
    S.hands = [[], [], [], []];
    for (let i = 0; i < 48; ++i)
      S.hands[i % NUM_PLAYERS].push(d[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);
    for (const c of S.hands[0])
      c.faceUp = true;

    S.trickCards = [];
    S.trickPlayers = [];
    S.meldPoints = [0, 0, 0, 0];
    S.trickPointsWon = [0, 0];
    S.tricksWon = [0, 0];
    S.trickCount = 0;
    S.roundOver = false;
    S.trumpSuit = null;
    S.highBid = 0;
    S.highBidder = -1;
    S.passCount = 0;
    S.bidPassed = [false, false, false, false];
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.hoverCardIdx = -1;
    S.hoverBidBtn = -1;
    S.hoveredTrumpSuit = null;
    S.meldDisplayTimer = 0;
    S.meldResults = [];

    S.currentBidder = (S.dealer + 1) % NUM_PLAYERS;
    S.phase = PHASE_BIDDING;

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  function setupGame() {
    S.teamScores = [0, 0];
    S.gameOver = false;
    S.score = 0;
    S.roundNumber = 0;
    S.dealer = 0;
    deal();
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function advanceBidding() {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const next = (S.currentBidder + i) % NUM_PLAYERS;
      if (!S.bidPassed[next]) {
        S.currentBidder = next;
        return;
      }
    }
    finalizeBidding();
  }

  function processBid(playerIdx, bid) {
    if (bid === 0) {
      S.bidPassed[playerIdx] = true;
      ++S.passCount;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(CANVAS_W / 2, 280, PLAYER_NAMES[playerIdx] + ' passes', { color: '#aaa', size: 14 });
    } else {
      S.highBid = bid;
      S.highBidder = playerIdx;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(CANVAS_W / 2, 280, PLAYER_NAMES[playerIdx] + ' bids ' + bid, { color: '#ff0', size: 14 });
    }

    if (S.passCount >= 3) {
      finalizeBidding();
      return;
    }
    advanceBidding();
  }

  function finalizeBidding() {
    if (S.highBidder < 0) {
      // Everyone passed - redeal
      S.dealer = (S.dealer + 1) % NUM_PLAYERS;
      deal();
      return;
    }
    if (S.highBidder === 0) {
      S.phase = PHASE_TRUMP_SELECT;
    } else {
      S.trumpSuit = V.aiSelectTrump(S.highBidder);
      startMelding();
    }
  }

  /* ================================================================
     MELDING PHASE
     ================================================================ */

  function startMelding() {
    S.phase = PHASE_MELDING;
    S.meldResults = [];
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const result = V.computeMelds(S.hands[p]);
      S.meldPoints[p] = result.total;
      S.meldResults.push({ player: p, melds: result.melds, total: result.total });
    }
    S.meldDisplayTimer = MELD_DISPLAY_DELAY;

    // Add meld points to team trick-point tallies
    S.trickPointsWon[TEAM_A] += S.meldPoints[0] + S.meldPoints[2];
    S.trickPointsWon[TEAM_B] += S.meldPoints[1] + S.meldPoints[3];

    if (S._host) {
      const teamAMeld = S.meldPoints[0] + S.meldPoints[2];
      const teamBMeld = S.meldPoints[1] + S.meldPoints[3];
      if (teamAMeld > 0)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Team A melds: ' + teamAMeld + ' pts', { color: '#8cf', size: 16 });
      if (teamBMeld > 0)
        S._host.floatingText.add(CANVAS_W / 2, 230, 'Team B melds: ' + teamBMeld + ' pts', { color: '#f88', size: 16 });
    }
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function startPlaying() {
    S.phase = PHASE_PLAYING;
    S.currentTurn = S.highBidder;
    S.trickLeader = S.highBidder;
    S.trickCards = [];
    S.trickPlayers = [];
    S.aiTurnTimer = 0;
  }

  function playCard(playerIdx, cardIdx) {
    const card = S.hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);

    if (S.trickCards.length >= NUM_PLAYERS) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinnerIdx = V.determineTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }
    S.currentTurn = (S.currentTurn + 1) % NUM_PLAYERS;
  }

  function finishTrick() {
    const winner = S.trickWinnerIdx;
    const team = V.teamOf(winner);
    const pts = V.computeTrickPoints();
    ++S.trickCount;

    // Last trick bonus
    const isLastTrick = S.trickCount >= HAND_SIZE || S.hands.every(h => h.length === 0);
    const totalPts = pts + (isLastTrick ? 10 : 0);
    S.trickPointsWon[team] += totalPts;
    ++S.tricksWon[team];

    if (S._host && totalPts > 0) {
      const label = PLAYER_NAMES[winner] + ' +' + totalPts + (isLastTrick ? ' (last trick!)' : '');
      const color = team === TEAM_A ? '#8cf' : '#f88';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 14 });
    }

    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerIdx = -1;

    if (isLastTrick) {
      endRound();
      return;
    }

    S.currentTurn = winner;
    S.trickLeader = winner;
    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    const bidTeam = V.teamOf(S.highBidder);
    const bidTeamPts = S.trickPointsWon[bidTeam];

    // Check if bidding team met their bid
    if (bidTeamPts >= S.highBid) {
      S.teamScores[bidTeam] += bidTeamPts;
    } else {
      S.teamScores[bidTeam] -= S.highBid;
      if (S._host) {
        const teamName = bidTeam === TEAM_A ? 'Team A' : 'Team B';
        S._host.floatingText.add(CANVAS_W / 2, 250, teamName + ' set! -' + S.highBid, { color: '#f44', size: 18 });
      }
    }

    // Non-bidding team always gets their points
    const otherTeam = bidTeam === TEAM_A ? TEAM_B : TEAM_A;
    S.teamScores[otherTeam] += S.trickPointsWon[otherTeam];

    S.score = S.teamScores[TEAM_A];
    if (S._host) S._host.onScoreChanged(S.score);

    ++S.roundNumber;
    S.roundOver = true;
    S.dealer = (S.dealer + 1) % NUM_PLAYERS;

    if (S.teamScores[TEAM_A] >= GAME_WIN_SCORE || S.teamScores[TEAM_B] >= GAME_WIN_SCORE) {
      S.gameOver = true;
      if (S._host) {
        const won = S.teamScores[TEAM_A] >= GAME_WIN_SCORE;
        const msg = won ? 'Your team wins!' : 'Opponents win!';
        const col = won ? '#4f4' : '#f88';
        S._host.floatingText.add(CANVAS_W / 2, 220, msg, { color: col, size: 24 });
        if (won) S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    }

    S.phase = PHASE_ROUND_SCORE;
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_SCORE) return;

    // Meld display timer
    if (S.phase === PHASE_MELDING) {
      S.meldDisplayTimer -= dt;
      if (S.meldDisplayTimer <= 0)
        startPlaying();
      return;
    }

    // Trick done timer
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

    // AI bidding
    if (S.phase === PHASE_BIDDING && S.currentBidder !== 0 && !S.bidPassed[S.currentBidder]) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        const bid = V.aiBid(S.currentBidder);
        processBid(S.currentBidder, bid);
      }
      return;
    }

    // AI playing
    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;
      const idx = V.aiChooseCard(S.currentTurn);
      if (idx >= 0)
        playCard(S.currentTurn, idx);
    }
  }

  Object.assign(V, {
    deal, setupGame, processBid, startMelding, playCard, tick
  });

})();
