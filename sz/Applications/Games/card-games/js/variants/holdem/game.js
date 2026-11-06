/* Texas Hold'em: game flow - dealing, turn sequencing and timed phases. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.holdem;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, STARTING_CHIPS, SMALL_BLIND, BIG_BLIND, PHASE_PREFLOP,
    PHASE_FLOP, PHASE_TURN, PHASE_RIVER, PHASE_SHOWDOWN, COMMUNITY_Y, COMMUNITY_START_X, CARD_GAP } = V;

  function nextActive(from) {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const idx = (from + i) % NUM_PLAYERS;
      if (!S.folded[idx] && !S.eliminated[idx] && !S.allIn[idx]) return idx;
    }
    return -1;
  }

  function nextActiveOrAllIn(from) {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const idx = (from + i) % NUM_PLAYERS;
      if (!S.folded[idx] && !S.eliminated[idx]) return idx;
    }
    return -1;
  }

  function dealCommunity(count) {
    for (let i = 0; i < count; ++i) {
      const card = S.deck.pop();
      card.faceUp = true;
      S.community.push(card);
      if (S._host) {
        const cx = COMMUNITY_START_X + (S.community.length - 1) * (CE.CARD_W + CARD_GAP);
        S._host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, cx, COMMUNITY_Y, i * 0.15);
      }
    }
  }

  function startBettingRound() {
    S.actedThisRound = new Array(NUM_PLAYERS).fill(false);
    S.lastRaiser = -1;

    if (S.phase === PHASE_PREFLOP) {
      S.currentTurn = nextActive((S.dealerIdx + 2) % NUM_PLAYERS);
      if (S.currentTurn < 0) S.currentTurn = nextActiveOrAllIn(S.dealerIdx);
    } else {
      S.currentTurn = nextActive(S.dealerIdx);
      if (S.currentTurn < 0) S.currentTurn = nextActiveOrAllIn(S.dealerIdx);
    }

    if (S.currentTurn < 0 || V.activePlayers() <= 1)
      advancePhase();
  }

  function advancePhase() {
    V.collectBets();

    if (V.activePlayers() <= 1) {
      V.resolveHand();
      return;
    }

    if (S.phase === PHASE_PREFLOP) {
      S.phase = PHASE_FLOP;
      dealCommunity(3);
    } else if (S.phase === PHASE_FLOP) {
      S.phase = PHASE_TURN;
      dealCommunity(1);
    } else if (S.phase === PHASE_TURN) {
      S.phase = PHASE_RIVER;
      dealCommunity(1);
    } else if (S.phase === PHASE_RIVER) {
      S.phase = PHASE_SHOWDOWN;
      V.revealAllHands();
      V.resolveHand();
      return;
    }

    S.minRaise = BIG_BLIND;
    S.raiseAmount = BIG_BLIND;

    if (V.activeNonAllIn() <= 1 && V.activePlayers() > 1) {
      advancePhase();
      return;
    }

    startBettingRound();
  }

  function setupHand() {
    S.deck = CE.shuffle(CE.createDeck());
    S.community = [];
    S.holeCards = [[], [], [], []];
    S.bets = [0, 0, 0, 0];
    S.folded = [false, false, false, false];
    S.allIn = [false, false, false, false];
    S.pot = 0;
    S.sidePots = [];
    S.currentBet = 0;
    S.minRaise = BIG_BLIND;
    S.raiseAmount = BIG_BLIND;
    S.lastRaiser = -1;
    S.actedThisRound = new Array(NUM_PLAYERS).fill(false);
    S.showdownRevealed = false;
    S.resultMessage = '';
    S.handRankText = '';
    S.roundOver = false;
    S.showdownTimer = 0;
    S.hoverBtn = -1;

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      S.folded[i] = S.eliminated[i];
      S.allIn[i] = false;
    }

    while (S.eliminated[S.dealerIdx])
      S.dealerIdx = (S.dealerIdx + 1) % NUM_PLAYERS;

    const sbIdx = nextActiveOrAllIn(S.dealerIdx);
    const bbIdx = nextActiveOrAllIn(sbIdx);

    for (let round = 0; round < 2; ++round) {
      for (let i = 0; i < NUM_PLAYERS; ++i) {
        if (S.eliminated[i]) continue;
        const card = S.deck.pop();
        card.faceUp = i === 0;
        S.holeCards[i].push(card);
      }
    }

    if (S._host) {
      for (let i = 0; i < S.holeCards[0].length; ++i) {
        const px = CANVAS_W / 2 - CE.CARD_W - 4 + i * (CE.CARD_W + CARD_GAP);
        S._host.dealCardAnim(S.holeCards[0][i], CANVAS_W / 2, -CE.CARD_H, px, CANVAS_H - 130, i * 0.12);
      }
    }

    if (sbIdx >= 0 && !S.eliminated[sbIdx]) {
      const sbAmt = Math.min(SMALL_BLIND, S.chips[sbIdx]);
      S.bets[sbIdx] = sbAmt;
      S.chips[sbIdx] -= sbAmt;
      if (S.chips[sbIdx] <= 0) S.allIn[sbIdx] = true;
    }
    if (bbIdx >= 0 && !S.eliminated[bbIdx]) {
      const bbAmt = Math.min(BIG_BLIND, S.chips[bbIdx]);
      S.bets[bbIdx] = bbAmt;
      S.chips[bbIdx] -= bbAmt;
      if (S.chips[bbIdx] <= 0) S.allIn[bbIdx] = true;
    }
    S.currentBet = BIG_BLIND;

    S.phase = PHASE_PREFLOP;
    startBettingRound();
  }

  function setupGame() {
    S.chips = [STARTING_CHIPS, STARTING_CHIPS, STARTING_CHIPS, STARTING_CHIPS];
    S.eliminated = [false, false, false, false];
    S.dealerIdx = 0;
    S.score = STARTING_CHIPS;
    S.roundOver = false;
    S.gameOver = false;
    setupHand();
  }

  Object.assign(V, { nextActive, nextActiveOrAllIn, advancePhase, setupHand, setupGame });

})();
