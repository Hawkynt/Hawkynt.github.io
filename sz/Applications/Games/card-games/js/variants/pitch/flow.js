/* Pitch - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.pitch;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, STRENGTH_ORDER,
    NUM_PLAYERS, HAND_SIZE, WIN_SCORE, PLAYER_NAMES, PHASE_BIDDING,
    PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_SCORE, PHASE_GAME_OVER,
    PLAYER_HAND_Y
  } = V;

  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     DEALING
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeck());
    S.hands = [[], [], [], []];
    S.capturedCards = [[], [], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickCount = 0;
    S.trumpSuit = null;
    S.bidder = -1;
    S.bidAmount = 0;
    S.playerBids = [0, 0, 0, 0];
    S.playerBidDone = [false, false, false, false];
    S.hoveredCard = -1;
    S.hoveredBtn = '';
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.roundMessages = [];
    S.roundOver = false;

    // Deal 6 cards each
    for (let i = 0; i < NUM_PLAYERS * HAND_SIZE; ++i)
      S.hands[i % NUM_PLAYERS].push(d[i]);

    for (const c of S.hands[0])
      c.faceUp = true;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    S.biddingPlayer = V.leftOf(S.dealer);
    S.phase = PHASE_BIDDING;

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  /* ================================================================
     BIDDING FLOW
     ================================================================ */

  function processBid(playerIdx, bid, suit) {
    S.playerBids[playerIdx] = bid;
    S.playerBidDone[playerIdx] = true;

    if (bid > 0 && bid > S.bidAmount) {
      S.bidder = playerIdx;
      S.bidAmount = bid;
      if (suit) S.trumpSuit = suit;
    }
  }

  function advanceBidding() {
    let next = V.leftOf(S.biddingPlayer);

    // Check if we've gone around to the dealer
    if (next === V.leftOf(S.dealer) && S.playerBidDone[S.biddingPlayer]) {
      // All players have had a chance to bid
      finishBidding();
      return;
    }

    // If next player is back to start and all have bid, finish
    let allBid = true;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (!S.playerBidDone[i]) {
        allBid = false;
        break;
      }
    }
    if (allBid) {
      finishBidding();
      return;
    }

    S.biddingPlayer = next;
    S.aiTurnTimer = 0;
  }

  function finishBidding() {
    // If nobody bid, dealer must take it at 1 ("steal the deal")
    if (S.bidder < 0) {
      S.bidder = S.dealer;
      S.bidAmount = 1;
      // Dealer picks best suit
      const result = V.aiBid(S.dealer);
      S.trumpSuit = result.suit || CE.SUITS[0];
      if (S.dealer === 0) {
        // Human is dealer and was forced -- we already picked from their best suit eval
        // Let the human's chosen trump stand from player choice if they had one
      }
      S.playerBids[S.dealer] = 1;

      if (S._host) {
        const who = S.dealer === 0 ? 'You steal' : PLAYER_NAMES[S.dealer] + ' steals';
        S._host.floatingText.add(CANVAS_W / 2, 250, who + ' the deal at 1', { color: '#ff0', size: 16 });
      }
    }

    // Bidder names trump and leads first trick
    if (S._host) {
      const who = S.bidder === 0 ? 'You bid' : PLAYER_NAMES[S.bidder] + ' bids';
      S._host.floatingText.add(CANVAS_W / 2, 230, who + ' ' + S.bidAmount + ' \u2014 ' + SUIT_SYMBOLS[S.trumpSuit] + ' ' + SUIT_NAMES[S.trumpSuit], { color: '#ff0', size: 16 });
    }

    startPlaying();
  }

  function startPlaying() {
    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);
    for (const c of S.hands[0])
      c.faceUp = true;

    S.phase = PHASE_PLAYING;
    S.trickLeader = S.bidder;
    S.currentTurn = S.bidder;
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

    S.currentTurn = V.leftOf(S.currentTurn);
  }

  function finishTrick() {
    const winner = S.trickWinnerIdx;
    ++S.trickCount;

    // Collect cards for winner
    for (const c of S.trickCards)
      S.capturedCards[winner].push(c);

    if (S._host) {
      const who = winner === 0 ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win trick #' + S.trickCount;
      const color = winner === 0 ? '#4f4' : '#f88';
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

  /* ================================================================
     ROUND SCORING
     ================================================================ */

  function endRound() {
    // Determine the 4 pitch scoring points
    let highPlayer = -1, lowPlayer = -1, jackPlayer = -1, gamePlayer = -1;
    let highRank = -1, lowRank = 14;

    const gamePointTotals = [0, 0, 0, 0];

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      for (const c of S.capturedCards[p]) {
        gamePointTotals[p] += V.gamePointValue(c);

        if (c.suit === S.trumpSuit) {
          const str = V.cardStrength(c);
          if (str > highRank) {
            highRank = str;
            highPlayer = p;
          }
          if (str < lowRank) {
            lowRank = str;
            lowPlayer = p;
          }
          if (c.rank === 'J')
            jackPlayer = p;
        }
      }
    }

    // Game point: highest total of game-point-valued cards; tie = nobody gets it
    let bestGamePts = -1;
    let gameTied = false;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (gamePointTotals[p] > bestGamePts) {
        bestGamePts = gamePointTotals[p];
        gamePlayer = p;
        gameTied = false;
      } else if (gamePointTotals[p] === bestGamePts)
        gameTied = true;
    }
    if (gameTied) gamePlayer = -1;

    // Award points
    const pointsEarned = [0, 0, 0, 0];
    S.roundMessages = [];

    if (highPlayer >= 0) {
      ++pointsEarned[highPlayer];
      S.roundMessages.push('High (' + SUIT_SYMBOLS[S.trumpSuit] + STRENGTH_ORDER[highRank] + '): ' + PLAYER_NAMES[highPlayer]);
    }
    if (lowPlayer >= 0) {
      ++pointsEarned[lowPlayer];
      S.roundMessages.push('Low (' + SUIT_SYMBOLS[S.trumpSuit] + STRENGTH_ORDER[lowRank] + '): ' + PLAYER_NAMES[lowPlayer]);
    }
    if (jackPlayer >= 0) {
      ++pointsEarned[jackPlayer];
      S.roundMessages.push('Jack (' + SUIT_SYMBOLS[S.trumpSuit] + 'J): ' + PLAYER_NAMES[jackPlayer]);
    } else
      S.roundMessages.push('Jack: not played');

    if (gamePlayer >= 0) {
      ++pointsEarned[gamePlayer];
      S.roundMessages.push('Game (' + bestGamePts + ' pts): ' + PLAYER_NAMES[gamePlayer]);
    } else
      S.roundMessages.push('Game: tied \u2014 no point');

    // Check bidder -- must make at least their bid or get set
    const bidderPoints = pointsEarned[S.bidder];
    if (bidderPoints >= S.bidAmount) {
      S.playerScores[S.bidder] += bidderPoints;
      S.roundMessages.push(PLAYER_NAMES[S.bidder] + ' makes bid (' + S.bidAmount + '), earns ' + bidderPoints);
    } else {
      S.playerScores[S.bidder] -= S.bidAmount;
      S.roundMessages.push(PLAYER_NAMES[S.bidder] + ' SET! Loses ' + S.bidAmount + ' points');
    }

    // Other players keep what they earn
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === S.bidder) continue;
      if (pointsEarned[p] > 0) {
        S.playerScores[p] += pointsEarned[p];
        S.roundMessages.push(PLAYER_NAMES[p] + ' earns ' + pointsEarned[p]);
      }
    }

    S.score = S.playerScores[0];
    if (S._host) S._host.onScoreChanged(S.score);

    S.roundOver = true;

    // Check for game over
    let anyWinner = false;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (S.playerScores[p] >= WIN_SCORE) {
        anyWinner = true;
        break;
      }
    }

    if (anyWinner) {
      S.gameOver = true;
      S.phase = PHASE_GAME_OVER;
      if (S._host) {
        const won = S.playerScores[0] >= WIN_SCORE;
        const gmsg = won ? 'You win the game!' : 'Game Over!';
        S._host.floatingText.add(CANVAS_W / 2, 200, gmsg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      S.phase = PHASE_ROUND_SCORE;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, 'Round complete', { color: '#ff0', size: 18 });
    }
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupGame() {
    S.playerScores = [0, 0, 0, 0];
    S.gameOver = false;
    S.score = 0;
    S.dealer = 0;
    dealRound();
  }

  function tick(dt) {
    if (S.phase === PHASE_ROUND_SCORE || S.phase === PHASE_GAME_OVER) return;

    // Trick done timer
    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

    // AI bidding
    if (S.phase === PHASE_BIDDING && S.biddingPlayer !== 0 && !S.playerBidDone[S.biddingPlayer]) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        const result = V.aiBid(S.biddingPlayer);

        if (result.bid > S.bidAmount) {
          processBid(S.biddingPlayer, result.bid, result.suit);
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' bids ' + result.bid, { color: '#ff0', size: 14 });
        } else {
          // Check if dealer must bid
          const isDealer = S.biddingPlayer === S.dealer;
          const allOthersPassed = (() => {
            for (let p = 0; p < NUM_PLAYERS; ++p) {
              if (p === S.biddingPlayer) continue;
              if (S.playerBidDone[p] && S.playerBids[p] > 0) return false;
            }
            return true;
          })();

          if (isDealer && allOthersPassed && S.bidAmount === 0) {
            // Dealer steals at 1
            processBid(S.biddingPlayer, 1, result.suit || CE.SUITS[0]);
            if (S._host)
              S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' steals at 1', { color: '#ff0', size: 14 });
          } else {
            processBid(S.biddingPlayer, 0, null);
            if (S._host)
              S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' passes', { color: '#aaa', size: 12 });
          }
        }
        advanceBidding();
      }
      return;
    }

    // Player bidding -- wait for click
    if (S.phase === PHASE_BIDDING && S.biddingPlayer === 0) return;

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
    dealRound, processBid, advanceBidding, playCard, tick
  });

})();
