/* Bridge - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.bridge;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, STRAIN_SHORT, NUM_PLAYERS, PLAYER_NAMES, SOUTH,
    TEAM_NS, PHASE_BIDDING, PHASE_PLAYING, PHASE_TRICK_DONE,
    PHASE_ROUND_OVER, PHASE_GAME_OVER, PLAYER_HAND_Y
  } = V;

  const HAND_SIZE = 13;
  const TRICK_DONE_DELAY = 1.0;
  const AI_TURN_DELAY = 0.6;
  const AI_BID_DELAY = 0.5;

  /* ================================================================
     SETUP
     ================================================================ */

  function deal() {
    const d = CE.shuffle(CE.createDeck());
    S.hands = [[], [], [], []];
    for (let i = 0; i < 52; ++i)
      S.hands[i % NUM_PLAYERS].push(d[i]);

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    for (const c of S.hands[SOUTH])
      c.faceUp = true;

    S.trickCards = [];
    S.trickPlayers = [];
    S.bidHistory = [];
    S.consecutivePasses = 0;
    S.contractBid = null;
    S.contractPlayer = -1;
    S.dummyPlayer = -1;
    S.defendingLead = -1;
    S.trumpSuit = null;
    S.trickCount = 0;
    S.tricksWonNS = 0;
    S.tricksWonEW = 0;
    S.roundOver = false;
    S.dummyRevealed = false;
    S.openingLeadMade = false;

    S.phase = PHASE_BIDDING;
    S.biddingPlayer = V.leftOf(S.dealer);
    S.aiTurnTimer = 0;
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.hoveredCard = -1;
    S.hoveredBidBtn = -1;
    S.hoveredPassBtn = false;
    S.statusMessage = '';

    if (S._host) {
      for (let i = 0; i < S.hands[SOUTH].length; ++i)
        S._host.dealCardAnim(S.hands[SOUTH][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[SOUTH].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  function setupGame() {
    S.nsAboveLine = 0;
    S.nsBelow = 0;
    S.ewAboveLine = 0;
    S.ewBelow = 0;
    S.nsGamesWon = 0;
    S.ewGamesWon = 0;
    S.nsVulnerable = false;
    S.ewVulnerable = false;
    S.dealer = SOUTH;
    S.gameOver = false;
    S.score = 0;
    deal();
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function placeBid(playerIdx, bid) {
    S.bidHistory.push({ player: playerIdx, bid: bid });

    if (bid === 'pass') {
      ++S.consecutivePasses;

      /* All 4 pass initially => redeal */
      if (S.bidHistory.length === 4 && S.consecutivePasses === 4) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, 280, 'All pass \u2014 redeal!', { color: '#ff0', size: 16 });
        S.dealer = V.leftOf(S.dealer);
        deal();
        return;
      }

      /* 3 consecutive passes after at least one bid => auction ends */
      if (S.consecutivePasses >= 3 && V.getAllBids().length > 0) {
        finishBidding();
        return;
      }
    } else {
      S.consecutivePasses = 0;
    }

    S.biddingPlayer = V.leftOf(S.biddingPlayer);
    S.aiTurnTimer = 0;
  }

  function finishBidding() {
    const winningBidEntry = V.getAllBids()[V.getAllBids().length - 1];
    S.contractBid = winningBidEntry.bid;
    S.contractPlayer = V.findDeclarer(S.contractBid, winningBidEntry.player);
    S.dummyPlayer = V.partnerOf(S.contractPlayer);
    S.trumpSuit = S.contractBid.strain === 'notrump' ? null : S.contractBid.strain;
    S.defendingLead = V.leftOf(S.contractPlayer);

    if (S._host) {
      const strName = STRAIN_SHORT[S.contractBid.strain];
      const msg = PLAYER_NAMES[S.contractPlayer] + ' declares ' + S.contractBid.level + strName;
      S._host.floatingText.add(CANVAS_W / 2, 250, msg, { color: '#ff0', size: 18 });
    }

    /* Start play phase: left of declarer leads */
    S.phase = PHASE_PLAYING;
    S.trickLeader = S.defendingLead;
    S.currentTurn = S.defendingLead;
    S.aiTurnTimer = 0;
    S.openingLeadMade = false;
    S.dummyRevealed = false;
    S.statusMessage = PLAYER_NAMES[S.defendingLead] + ' leads';
  }

  /* ================================================================
     PLAY FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const hand = S.hands[playerIdx];
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);

    /* After opening lead, reveal dummy */
    if (!S.openingLeadMade) {
      S.openingLeadMade = true;
      S.dummyRevealed = true;
      for (const c of S.hands[S.dummyPlayer])
        c.faceUp = true;
    }

    if (S.trickCards.length >= NUM_PLAYERS) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinnerIdx = V.resolveTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }

    S.currentTurn = V.leftOf(S.currentTurn);
    S.aiTurnTimer = 0;
  }

  function finishTrick() {
    const winner = S.trickWinnerIdx;
    if (V.teamOf(winner) === TEAM_NS)
      ++S.tricksWonNS;
    else
      ++S.tricksWonEW;
    ++S.trickCount;

    if (S._host) {
      const who = winner === SOUTH ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win' + (winner === SOUTH ? '' : 's') + ' trick #' + S.trickCount;
      const color = V.teamOf(winner) === TEAM_NS ? '#4f4' : '#f88';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 16 });
    }

    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerIdx = -1;

    if (S.trickCount >= HAND_SIZE) {
      endRound();
      return;
    }

    S.trickLeader = winner;
    S.currentTurn = winner;
    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    const result = V.scoreContract();
    S.roundOver = true;

    if (V.checkRubberOver()) {
      /* Rubber bonus */
      const nsWon = S.nsGamesWon >= 2;
      const bonus = (nsWon ? (S.ewGamesWon === 0 ? 700 : 500) : (S.nsGamesWon === 0 ? 700 : 500));
      if (nsWon)
        S.nsAboveLine += bonus;
      else
        S.ewAboveLine += bonus;

      S.score = S.nsAboveLine + S.nsBelow;
      if (S._host) S._host.onScoreChanged(S.score);

      S.gameOver = true;
      S.phase = PHASE_GAME_OVER;

      if (S._host) {
        const nsTot = S.nsAboveLine + S.nsBelow;
        const ewTot = S.ewAboveLine + S.ewBelow;
        const won = nsTot > ewTot;
        const msg = won ? 'Rubber Won!' : 'Rubber Lost!';
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 80);
      }
    } else {
      S.phase = PHASE_ROUND_OVER;

      if (S._host) {
        const over = result.over;
        let msg;
        if (over >= 0)
          msg = 'Contract made! +' + result.belowPts + ' below' + (result.abovePts > 0 ? ', +' + result.abovePts + ' above' : '');
        else
          msg = 'Down ' + result.under + '! Defenders +' + result.defenseAbove;
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: over >= 0 ? '#4f4' : '#f88', size: 16 });
      }
    }
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_OVER || S.phase === PHASE_GAME_OVER) return;

    /* Trick done timer */
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

    /* AI bidding */
    if (S.phase === PHASE_BIDDING && S.biddingPlayer !== SOUTH) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_BID_DELAY) {
        S.aiTurnTimer = 0;
        const bid = V.aiBid(S.biddingPlayer);
        if (S._host) {
          const label = PLAYER_NAMES[S.biddingPlayer] + ': ' + (bid === 'pass' ? 'Pass' : V.bidToString(bid));
          const color = bid === 'pass' ? '#aaa' : '#ff0';
          S._host.floatingText.add(CANVAS_W / 2, 300, label, { color, size: 13 });
        }
        placeBid(S.biddingPlayer, bid);
      }
      return;
    }

    /* AI playing */
    if (S.phase !== PHASE_PLAYING) return;

    const ctrl = V.controllerOf(S.currentTurn);
    if (ctrl === SOUTH) return; // waiting for human

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;

      /* AI plays for itself, or AI declarer plays dummy's hand */
      const hand = S.hands[S.currentTurn];
      if (hand.length === 0) return;

      const idx = V.aiChooseCard(S.currentTurn);
      if (idx >= 0)
        playCard(S.currentTurn, idx);
    }
  }

  Object.assign(V, {
    deal, setupGame, placeBid, playCard, tick
  });

})();
