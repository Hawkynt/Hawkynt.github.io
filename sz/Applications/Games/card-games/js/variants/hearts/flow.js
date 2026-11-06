/* Hearts - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.hearts;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, NUM_PLAYERS, PHASE_PASSING, PHASE_PLAYING,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER, PLAYER_NAMES
  } = V;

  const HAND_SIZE = 13;
  const GAME_OVER_THRESHOLD = 100;
  const PASS_NONE = 3;
  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     SETUP
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeck());
    S.hands = [[], [], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.roundScores = [0, 0, 0, 0];
    S.trickCount = 0;
    S.heartsBroken = false;
    S.selectedForPass = [];
    S.hoverCardIdx = -1;
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;

    for (let i = 0; i < 52; ++i)
      S.hands[i % NUM_PLAYERS].push(d[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    for (const c of S.hands[0])
      c.faceUp = true;

    S.passDirection = S.roundNumber % 4;

    if (S.passDirection === PASS_NONE)
      startPlaying();
    else
      S.phase = PHASE_PASSING;

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), V.playerCardY(i), i * 0.06);
    }
  }

  function executePass() {
    const passCards = [[], [], [], []];

    const playerCards = [];
    for (const idx of S.selectedForPass)
      playerCards.push(S.hands[0][idx]);
    passCards[0] = playerCards;

    for (let p = 1; p < NUM_PLAYERS; ++p)
      passCards[p] = V.aiSelectPassCards(p);

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      const target = V.getPassTarget(p);
      for (const c of passCards[p])
        S.hands[p].splice(S.hands[p].indexOf(c), 1);
      for (const c of passCards[p])
        S.hands[target].push(c);
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    for (const c of S.hands[0])
      c.faceUp = true;

    S.selectedForPass = [];
    startPlaying();
  }

  function startPlaying() {
    S.phase = PHASE_PLAYING;
    const starter = V.findTwoOfClubs();
    S.currentTurn = starter;
    S.trickLeader = starter;
    S.trickCards = [];
    S.trickPlayers = [];
  }

  function setupHearts() {
    S.roundOver = false;
    S.gameOver = false;
    dealRound();
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const card = S.hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;

    if (V.isHeart(card) && !S.heartsBroken)
      S.heartsBroken = true;

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
    const penalty = V.computeTrickPenalty();
    S.roundScores[winner] += penalty;

    if (S._host && penalty > 0) {
      const label = (winner === 0 ? 'You' : PLAYER_NAMES[winner]) + ' +' + penalty + ' pts';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color: winner === 0 ? '#f44' : '#fa0', size: 16 });
    }

    ++S.trickCount;
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerIdx = -1;

    if (S.trickCount >= HAND_SIZE || S.hands.every(h => h.length === 0)) {
      endRound();
      return;
    }

    S.currentTurn = winner;
    S.trickLeader = winner;
    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    let shooterIdx = -1;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.roundScores[p] === 26) {
        shooterIdx = p;
        break;
      }
    }

    if (shooterIdx >= 0) {
      for (let p = 0; p < NUM_PLAYERS; ++p)
        S.roundScores[p] = p === shooterIdx ? 0 : 26;

      if (S._host) {
        const who = shooterIdx === 0 ? 'You shot' : PLAYER_NAMES[shooterIdx] + ' shot';
        S._host.floatingText.add(CANVAS_W / 2, 250, who + ' the moon!', { color: '#ff0', size: 22 });
        if (shooterIdx === 0)
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      S.cumulativeScores[p] += S.roundScores[p];

    S.score = 100 - S.cumulativeScores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    let anyOver = false;
    for (let p = 0; p < NUM_PLAYERS; ++p)
      if (S.cumulativeScores[p] >= GAME_OVER_THRESHOLD) anyOver = true;

    ++S.roundNumber;
    S.roundOver = true;

    if (anyOver) {
      S.gameOver = true;
      let lowest = S.cumulativeScores[0];
      let winner = 0;
      for (let p = 1; p < NUM_PLAYERS; ++p) {
        if (S.cumulativeScores[p] < lowest) {
          lowest = S.cumulativeScores[p];
          winner = p;
        }
      }
      if (S._host) {
        const msg = winner === 0 ? 'You win the game!' : PLAYER_NAMES[winner] + ' wins the game!';
        const col = winner === 0 ? '#4f4' : '#f88';
        S._host.floatingText.add(CANVAS_W / 2, 220, msg, { color: col, size: 24 });
        if (winner === 0) S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      if (S._host) {
        const msg = 'Round ' + S.roundNumber + ' complete \u2014 click to continue';
        S._host.floatingText.add(CANVAS_W / 2, 220, msg, { color: '#8f8', size: 16 });
      }
    }

    S.phase = PHASE_ROUND_OVER;
  }

  function tick(dt) {
    if (S.roundOver && S.phase !== PHASE_ROUND_OVER) return;
    if (S.gameOver) return;

    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

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
    dealRound, executePass, setupHearts, playCard, tick
  });

})();
