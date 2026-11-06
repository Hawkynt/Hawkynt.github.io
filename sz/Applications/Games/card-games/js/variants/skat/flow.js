/* Skat - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.skat;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SKAT_RANKS, RANK_VALUES, BID_VALUES, PHASE_BIDDING,
    PHASE_SKAT_PICK, PHASE_PLAYING
  } = V;

  const AI_TURN_DELAY = 0.6;

  /* ================================================================
     BIDDING
     ================================================================ */

  function runBiddingStep() {
    // Simplified: AI bids based on hand strength
    if (S.bidPhaseStep === 0) {
      S.bidMessage = 'Bidding...';
      const vals = [V.aiEvalHand(S.skatHands[0]), V.aiEvalHand(S.skatHands[1]), V.aiEvalHand(S.skatHands[2])];
      // AI decides to bid or pass
      const thresholds = [40, 30, 35];
      for (let p = 1; p < 3; ++p) {
        if (vals[p] < thresholds[p])
          S.bidActive[p] = false;
      }
      S.bidPhaseStep = 1;
      return;
    }

    if (S.bidPhaseStep === 1) {
      // Player must decide - show bid buttons
      // Wait for player click
      return;
    }

    if (S.bidPhaseStep >= 2) {
      // Resolve: highest remaining bidder wins
      const remaining = [];
      for (let p = 0; p < 3; ++p) {
        if (S.bidActive[p]) remaining.push(p);
      }
      if (remaining.length === 0) {
        // Everyone passed - player 0 forced as declarer at minimum
        S.declarer = 0;
      } else if (remaining.length === 1)
        S.declarer = remaining[0];
      else
        S.declarer = remaining[0]; // Simplified

      S.bidAmount = BID_VALUES[Math.min(S.bidCurrent, BID_VALUES.length - 1)];
      S.bidMessage = (S.declarer === 0 ? 'You are' : 'AI ' + S.declarer + ' is') + ' the Declarer!';

      if (S.declarer === 0) {
        S.phase = PHASE_SKAT_PICK;
      } else {
        // AI picks trump based on most suits
        const counts = {};
        for (const s of CE.SUITS) counts[s] = 0;
        for (const c of S.skatHands[S.declarer])
          if (c.rank !== 'J') ++counts[c.suit];
        let best = CE.SUITS[0];
        for (const s of CE.SUITS)
          if (counts[s] > counts[best]) best = s;
        S.trumpSuit = best;
        S.phase = PHASE_PLAYING;
        S.currentTrickLead = S.declarer;
        S.currentTurn = S.declarer;
      }
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupSkat() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, SKAT_RANKS));
    S.skatHands = [[], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.skatPile = [];
    S.trumpSuit = 'spades';
    S.roundOver = false;
    S.gameOver = false;
    S.declarer = -1;
    S.currentTrickLead = 0;
    S.currentTurn = 0;
    S.tricksWon = [0, 0, 0];
    S.cardPoints = [0, 0, 0];
    S.trickCount = 0;
    S.phase = PHASE_BIDDING;
    S.bidCurrent = 0;
    S.bidActive = [true, true, true];
    S.bidWinner = -1;
    S.bidAmount = 0;
    S.bidPhaseStep = 0;
    S.bidMessage = '';
    S.aiTurnTimer = 0;

    // Deal: 3-skat(2)-4-3 pattern
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 3; ++i) S.skatHands[p].push(d.pop());
    S.skatPile = [d.pop(), d.pop()];
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 4; ++i) S.skatHands[p].push(d.pop());
    for (let p = 0; p < 3; ++p)
      for (let i = 0; i < 3; ++i) S.skatHands[p].push(d.pop());

    for (const c of S.skatHands[0]) c.faceUp = true;
    S.deck = d;

    if (S._host) {
      for (let i = 0; i < S.skatHands[0].length; ++i)
        S._host.dealCardAnim(S.skatHands[0][i], CANVAS_W / 2, -CE.CARD_H, 60 + i * 60, 440, i * 0.08);
    }
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function resolveTrick() {
    if (S.trickCards.length < 3) return;
    const winner = V.trickWinner(S.trickCards, S.trickPlayers);
    let pts = 0;
    for (const c of S.trickCards) pts += RANK_VALUES[c.rank];
    S.cardPoints[winner] += pts;
    ++S.tricksWon[winner];
    ++S.trickCount;

    if (S._host) {
      const label = winner === 0 ? 'You win trick! +' + pts : 'AI ' + winner + ' wins +' + pts;
      S._host.floatingText.add(CANVAS_W / 2, 300, label, { color: winner === 0 ? '#4f4' : '#f88', size: 16 });
    }

    S.trickCards = [];
    S.trickPlayers = [];
    S.currentTrickLead = winner;
    S.currentTurn = winner;

    // Check if round over (all cards played - 10 tricks)
    if (S.trickCount >= 10 || (S.skatHands[0].length === 0 && S.skatHands[1].length === 0 && S.skatHands[2].length === 0)) {
      endRound();
    }
  }

  function endRound() {
    S.roundOver = true;
    // Declarer needs > 60 card points to win
    const declPts = S.cardPoints[S.declarer];
    const defPts = S.cardPoints.reduce((s, v) => s + v, 0) - declPts;
    const declWon = declPts > 60;

    if (S.declarer === 0 && declWon) {
      S.score += declPts;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, 280, 'You won as Declarer! +' + declPts, { color: '#4f4', size: 22 });
        S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else if (S.declarer === 0 && !declWon) {
      S.score -= 20;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 280, 'Declarer lost! -20', { color: '#f44', size: 22 });
    } else if (S.declarer !== 0 && !declWon) {
      S.score += 30;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 280, 'Defenders win! +30', { color: '#4f4', size: 22 });
    } else {
      S.score -= 10;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 280, 'Declarer AI ' + S.declarer + ' won', { color: '#f88', size: 18 });
    }

    if (S.score <= -50) S.gameOver = true;
    if (S._host) S._host.onScoreChanged(S.score);
  }

  function tick(dt) {
    if (S.roundOver || S.gameOver) return;

    if (S.phase === PHASE_BIDDING) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY && S.bidPhaseStep === 0) {
        S.aiTurnTimer = 0;
        runBiddingStep();
      }
      return;
    }

    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;
      V.skatAiPlay(S.currentTurn);
      S.currentTurn = (S.currentTurn + 1) % 3;
      if (S.trickCards.length >= 3) resolveTrick();
    }
  }

  Object.assign(V, {
    runBiddingStep, setupSkat, resolveTrick, tick
  });

})();
