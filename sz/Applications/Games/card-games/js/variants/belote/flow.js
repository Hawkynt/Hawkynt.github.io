/* Belote: game flow - dealing, turn sequence and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.belote;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, NUM_PLAYERS, TRICKS_PER_ROUND, WIN_SCORE,
    PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_BID_ROUND1, PHASE_BID_ROUND2, PHASE_DEAL_REMAINING,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_OVER, PHASE_GAME_OVER, PLAYER_HAND_Y } = V;

  const BELOTE_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  const TRICK_DONE_DELAY = 1.2;

  const DEAL_REMAINING_DELAY = 0.6;

  const AI_TURN_DELAY = 0.8;

  function checkBeloteDeclaration(playerIdx, card) {
    if (card.suit !== S.trumpSuit) return;
    if (card.rank !== 'K' && card.rank !== 'Q') return;

    const otherRank = card.rank === 'K' ? 'Q' : 'K';
    const handHasOther = S.hands[playerIdx].some(c => c.suit === S.trumpSuit && c.rank === otherRank);

    if (!S.beloteDeclared[playerIdx] && (handHasOther || S.rebeloteDeclared[playerIdx])) {
      // Playing the first of the pair
      if (handHasOther) {
        S.beloteDeclared[playerIdx] = true;
        if (S._host) {
          const who = playerIdx === 0 ? 'You declare' : PLAYER_NAMES[playerIdx] + ' declares';
          S._host.floatingText.add(CANVAS_W / 2, 180, who + ' Belote!', { color: '#ff0', size: 16 });
        }
      }
    } else if (S.beloteDeclared[playerIdx] && !S.rebeloteDeclared[playerIdx]) {
      // Playing the second of the pair
      S.rebeloteDeclared[playerIdx] = true;
      S.teamBeloteBonus[V.teamOf(playerIdx)] += 20;
      if (S._host) {
        const who = playerIdx === 0 ? 'You declare' : PLAYER_NAMES[playerIdx] + ' declares';
        S._host.floatingText.add(CANVAS_W / 2, 180, who + ' Rebelote! (+20)', { color: '#ff0', size: 16 });
      }
    }
  }

  /* ================================================================
     SETUP / DEALING
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, BELOTE_RANKS));

    S.hands = [[], [], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickCount = 0;
    S.teamTrickPoints = [0, 0];
    S.trumpSuit = null;
    S.proposedCard = null;
    S.takerPlayer = -1;
    S.takerTeam = -1;
    S.hoveredCard = -1;
    S.hoveredBtn = '';
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.dealRemainingTimer = 0;
    S.aiTurnTimer = 0;
    S.roundMessage = '';
    S.statusText = '';
    S.roundOver = false;
    S.beloteDeclared = [false, false, false, false];
    S.rebeloteDeclared = [false, false, false, false];
    S.teamBeloteBonus = [0, 0];

    // Deal 5 cards each (3+2 or 2+3 pattern, but simplified to 5 straight)
    let idx = 0;
    for (let i = 0; i < 5; ++i)
      for (let p = 0; p < NUM_PLAYERS; ++p)
        S.hands[p].push(d[idx++]);

    // Remaining cards for later dealing
    S.deck = d.slice(idx);

    // Turn up one card as proposed trump
    S.proposedCard = S.deck.shift();
    S.proposedCard.faceUp = true;

    for (const c of S.hands[0])
      c.faceUp = true;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    S.biddingPlayer = V.leftOf(S.dealer);
    S.phase = PHASE_BID_ROUND1;

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  /* ================================================================
     TRUMP SELECTION
     ================================================================ */

  function acceptTrumpRound1(playerIdx) {
    S.trumpSuit = S.proposedCard.suit;
    S.takerPlayer = playerIdx;
    S.takerTeam = V.teamOf(playerIdx);

    if (S._host) {
      const who = playerIdx === 0 ? 'You take' : PLAYER_NAMES[playerIdx] + ' takes';
      S._host.floatingText.add(CANVAS_W / 2, 250, who + ' ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], { color: '#ff0', size: 16 });
    }

    // Give the proposed card to the taker
    S.proposedCard.faceUp = playerIdx === 0;
    S.hands[playerIdx].push(S.proposedCard);

    // Deal remaining 3 cards to each player (taker gets 2 since they got the proposed card)
    dealRemainingCards();
  }

  function acceptTrumpRound2(playerIdx, suit) {
    S.trumpSuit = suit;
    S.takerPlayer = playerIdx;
    S.takerTeam = V.teamOf(playerIdx);

    if (S._host) {
      const who = playerIdx === 0 ? 'You call' : PLAYER_NAMES[playerIdx] + ' calls';
      S._host.floatingText.add(CANVAS_W / 2, 250, who + ' ' + SUIT_SYMBOLS[suit] + ' ' + SUIT_NAMES[suit], { color: '#ff0', size: 16 });
    }

    // Proposed card goes back into deck (not taken)
    S.deck.unshift(S.proposedCard);

    // Deal remaining 3 cards each
    dealRemainingCards();
  }

  function dealRemainingCards() {
    S.phase = PHASE_DEAL_REMAINING;
    S.dealRemainingTimer = 0;
  }

  function finishDealRemaining() {
    // Each player needs 8 cards total
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      while (S.hands[p].length < 8 && S.deck.length > 0) {
        const c = S.deck.shift();
        c.faceUp = p === 0;
        S.hands[p].push(c);
      }
    }

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    if (S._host) {
      const total = S.hands[0].length;
      for (let i = 5; i < total; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, total), PLAYER_HAND_Y, (i - 5) * 0.06);
    }

    startPlaying();
  }

  function advanceBidding() {
    S.biddingPlayer = V.leftOf(S.biddingPlayer);
    S.aiTurnTimer = 0;
  }

  function startPlaying() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);
    for (const c of S.hands[0])
      c.faceUp = true;

    S.phase = PHASE_PLAYING;
    S.trickLeader = V.leftOf(S.dealer);
    S.currentTurn = S.trickLeader;
    S.trickCards = [];
    S.trickPlayers = [];
    S.aiTurnTimer = 0;
    S.statusText = S.currentTurn === 0 ? 'Your turn' : PLAYER_NAMES[S.currentTurn] + ' is playing...';
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(playerIdx, cardIdx) {
    const card = S.hands[playerIdx].splice(cardIdx, 1)[0];
    card.faceUp = true;

    // Check belote/rebelote
    checkBeloteDeclaration(playerIdx, card);

    S.trickCards.push(card);
    S.trickPlayers.push(playerIdx);

    if (S.trickCards.length >= NUM_PLAYERS) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinnerIdx = V.resolveTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }

    S.currentTurn = V.leftOf(S.currentTurn);
    S.statusText = S.currentTurn === 0 ? 'Your turn' : PLAYER_NAMES[S.currentTurn] + ' is playing...';
  }

  function finishTrick() {
    const winner = S.trickWinnerIdx;
    const winTeam = V.teamOf(winner);
    ++S.trickCount;

    // Sum card points
    let trickPts = 0;
    for (const c of S.trickCards)
      trickPts += V.cardPoints(c);

    // Last trick bonus
    if (S.trickCount === TRICKS_PER_ROUND)
      trickPts += 10;

    S.teamTrickPoints[winTeam] += trickPts;

    if (S._host) {
      const who = winner === 0 ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win trick #' + S.trickCount + ' (+' + trickPts + ')';
      const color = winTeam === TEAM_A ? '#4f4' : '#f88';
      S._host.floatingText.add(CANVAS_W / 2, 280, label, { color, size: 14 });
    }

    S.trickCards = [];
    S.trickPlayers = [];
    S.trickWinnerIdx = -1;

    if (S.trickCount >= TRICKS_PER_ROUND) {
      endRound();
      return;
    }

    S.trickLeader = winner;
    S.currentTurn = winner;
    S.phase = PHASE_PLAYING;
    S.aiTurnTimer = 0;
    S.statusText = S.currentTurn === 0 ? 'Your turn' : PLAYER_NAMES[S.currentTurn] + ' is playing...';
  }

  function endRound() {
    // Taker's team must score > 81 (out of 162)
    const takerPts = S.teamTrickPoints[S.takerTeam];
    const defenderPts = S.teamTrickPoints[1 - S.takerTeam];
    let takerFinal = 0;
    let defenderFinal = 0;
    let msg = '';

    if (takerPts > 81) {
      // Taker succeeds: both teams score what they won
      takerFinal = takerPts;
      defenderFinal = defenderPts;
      msg = 'Contract made! (' + takerPts + ' pts)';
    } else {
      // Taker fails (dedans): defenders get all 162
      takerFinal = 0;
      defenderFinal = 162;
      msg = 'Dedans! Taker fails (' + takerPts + ' pts)';
    }

    // Add belote bonuses (always awarded regardless of contract success)
    takerFinal += S.teamBeloteBonus[S.takerTeam];
    defenderFinal += S.teamBeloteBonus[1 - S.takerTeam];

    S.teamScores[S.takerTeam] += takerFinal;
    S.teamScores[1 - S.takerTeam] += defenderFinal;

    S.score = S.teamScores[TEAM_A];
    if (S._host) S._host.onScoreChanged(S.score);

    const teamALabel = 'Your Team: ' + S.teamScores[TEAM_A];
    const teamBLabel = 'Opponents: ' + S.teamScores[TEAM_B];
    S.roundMessage = msg + '\n' + teamALabel + '  ' + teamBLabel;

    if (S.teamBeloteBonus[TEAM_A] > 0 || S.teamBeloteBonus[TEAM_B] > 0) {
      const bonusA = S.teamBeloteBonus[TEAM_A] > 0 ? 'Your Team +' + S.teamBeloteBonus[TEAM_A] + ' belote' : '';
      const bonusB = S.teamBeloteBonus[TEAM_B] > 0 ? 'Opponents +' + S.teamBeloteBonus[TEAM_B] + ' belote' : '';
      const bonusMsg = [bonusA, bonusB].filter(s => s).join(', ');
      S.roundMessage += '\n' + bonusMsg;
    }

    S.roundOver = true;

    if (S.teamScores[TEAM_A] >= WIN_SCORE || S.teamScores[TEAM_B] >= WIN_SCORE) {
      S.gameOver = true;
      S.phase = PHASE_GAME_OVER;
      if (S._host) {
        const won = S.teamScores[TEAM_A] >= WIN_SCORE;
        const gmsg = won ? 'You win the game!' : 'Opponents win!';
        S._host.floatingText.add(CANVAS_W / 2, 200, gmsg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) {
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 80);
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      }
    } else {
      S.phase = PHASE_ROUND_OVER;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: '#ff0', size: 18 });
    }
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_OVER || S.phase === PHASE_GAME_OVER) return;

    // Deal remaining timer
    if (S.phase === PHASE_DEAL_REMAINING) {
      S.dealRemainingTimer += dt;
      if (S.dealRemainingTimer >= DEAL_REMAINING_DELAY)
        finishDealRemaining();
      return;
    }

    // Trick done timer
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

    // AI bidding round 1
    if (S.phase === PHASE_BID_ROUND1 && S.biddingPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        if (V.aiShouldTakeRound1(S.biddingPlayer)) {
          if (S._host) {
            const msg = PLAYER_NAMES[S.biddingPlayer] + ' takes!';
            S._host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
          }
          acceptTrumpRound1(S.biddingPlayer);
        } else {
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' passes', { color: '#aaa', size: 12 });
          if (S.biddingPlayer === S.dealer) {
            S.biddingPlayer = V.leftOf(S.dealer);
            S.phase = PHASE_BID_ROUND2;
            S.aiTurnTimer = 0;
          } else
            advanceBidding();
        }
      }
      return;
    }

    // AI bidding round 2
    if (S.phase === PHASE_BID_ROUND2 && S.biddingPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        const picked = V.aiPickTrumpRound2(S.biddingPlayer);
        if (picked) {
          if (S._host) {
            const msg = PLAYER_NAMES[S.biddingPlayer] + ' calls ' + SUIT_SYMBOLS[picked];
            S._host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
          }
          acceptTrumpRound2(S.biddingPlayer, picked);
        } else {
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' passes', { color: '#aaa', size: 12 });
          if (S.biddingPlayer === S.dealer) {
            // All passed both rounds, redeal
            if (S._host)
              S._host.floatingText.add(CANVAS_W / 2, 260, 'All passed! Redealing...', { color: '#f80', size: 16 });
            S.dealer = V.leftOf(S.dealer);
            dealRound();
          } else
            advanceBidding();
        }
      }
      return;
    }

    // Wait for player during bidding
    if ((S.phase === PHASE_BID_ROUND1 || S.phase === PHASE_BID_ROUND2) && S.biddingPlayer === 0) return;

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

  V.dealRound = dealRound;
  V.acceptTrumpRound1 = acceptTrumpRound1;
  V.acceptTrumpRound2 = acceptTrumpRound2;
  V.advanceBidding = advanceBidding;
  V.playCard = playCard;
  V.tick = tick;

})();
