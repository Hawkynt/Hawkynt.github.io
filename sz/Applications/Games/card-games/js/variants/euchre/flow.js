/* Euchre - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.euchre;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, SUIT_NAMES, SUIT_SYMBOLS, NUM_PLAYERS, WIN_SCORE,
    PLAYER_NAMES, TEAM_A, TEAM_B, PHASE_TRUMP_ROUND1, PHASE_TRUMP_ROUND2,
    PHASE_DISCARD, PHASE_PLAYING, PHASE_TRICK_DONE, PHASE_ROUND_SCORE,
    PHASE_GAME_OVER, PLAYER_HAND_Y
  } = V;

  const EUCHRE_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];
  const HAND_SIZE = 5;
  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     SETUP / DEALING
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, EUCHRE_RANKS));
    S.hands = [[], [], [], []];
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickCount = 0;
    S.tricksWon = [0, 0];
    S.trumpSuit = null;
    S.callingTeam = -1;
    S.callingPlayer = -1;
    S.goingAlone = false;
    S.sittingOutPlayer = -1;
    S.hoveredCard = -1;
    S.hoveredBtn = '';
    S.trickWinnerIdx = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.roundMessage = '';
    S.roundOver = false;

    // Deal 5 cards each
    for (let i = 0; i < 20; ++i)
      S.hands[i % NUM_PLAYERS].push(d[i]);

    // Remaining 4 = kitty, top card face up
    S.kitty = d.slice(20);
    S.kittyCard = S.kitty[0];
    S.kittyCard.faceUp = true;

    for (const c of S.hands[0])
      c.faceUp = true;

    for (let p = 0; p < NUM_PLAYERS; ++p)
      V.sortHand(S.hands[p]);

    S.biddingPlayer = V.leftOf(S.dealer);
    S.phase = PHASE_TRUMP_ROUND1;

    if (S._host) {
      for (let i = 0; i < S.hands[0].length; ++i)
        S._host.dealCardAnim(S.hands[0][i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.hands[0].length), PLAYER_HAND_Y, i * 0.06);
    }
  }

  /* ================================================================
     TRUMP SELECTION FLOW
     ================================================================ */

  function acceptTrump(playerIdx, suit, alone) {
    S.trumpSuit = suit;
    S.callingPlayer = playerIdx;
    S.callingTeam = V.teamOf(playerIdx);
    S.goingAlone = !!alone;
    if (S.goingAlone)
      S.sittingOutPlayer = V.partnerOf(playerIdx);

    if (S._host) {
      const who = playerIdx === 0 ? 'You call' : PLAYER_NAMES[playerIdx] + ' calls';
      const msg = who + ' ' + SUIT_SYMBOLS[suit] + ' ' + SUIT_NAMES[suit] + (S.goingAlone ? ' (alone!)' : '');
      S._host.floatingText.add(CANVAS_W / 2, 250, msg, { color: '#ff0', size: 16 });
    }

    // Round 1: dealer picks up kitty card and discards
    if (S.phase === PHASE_TRUMP_ROUND1) {
      S.hands[S.dealer].push(S.kittyCard);
      S.kitty.shift();
      if (S.dealer === 0) {
        // Human must discard
        for (const c of S.hands[0]) c.faceUp = true;
        V.sortHand(S.hands[0]);
        S.phase = PHASE_DISCARD;
        return;
      }
      // AI dealer discards worst
      const discIdx = V.aiDiscardWorst(S.dealer);
      S.hands[S.dealer].splice(discIdx, 1);
      V.sortHand(S.hands[S.dealer]);
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
    while (V.isSkipped(S.trickLeader)) S.trickLeader = V.leftOf(S.trickLeader);
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

    const activeCount = S.goingAlone ? 3 : 4;
    if (S.trickCards.length >= activeCount) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinnerIdx = V.resolveTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }

    S.currentTurn = V.nextActivePlayer(S.currentTurn);
  }

  function finishTrick() {
    const winner = S.trickWinnerIdx;
    const winTeam = V.teamOf(winner);
    ++S.tricksWon[winTeam];
    ++S.trickCount;

    if (S._host) {
      const who = winner === 0 ? 'You' : PLAYER_NAMES[winner];
      const label = who + ' win trick #' + S.trickCount;
      const color = winTeam === TEAM_A ? '#4f4' : '#f88';
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
    // Scoring
    const callerTricks = S.tricksWon[S.callingTeam];
    const defenderTricks = S.tricksWon[1 - S.callingTeam];
    let pts = 0;
    let msg = '';

    if (callerTricks >= 3) {
      if (callerTricks === 5 && S.goingAlone) {
        pts = 4;
        msg = 'Alone sweep! +4 pts';
      } else if (callerTricks === 5) {
        pts = 2;
        msg = 'March! +2 pts';
      } else {
        pts = 1;
        msg = 'Made it. +1 pt';
      }
      S.teamScores[S.callingTeam] += pts;
    } else {
      pts = 2;
      S.teamScores[1 - S.callingTeam] += pts;
      msg = 'Euchred! Opponents +2 pts';
    }

    S.score = S.teamScores[TEAM_A];
    if (S._host) S._host.onScoreChanged(S.score);

    S.roundMessage = msg + '\nTeam A: ' + S.teamScores[TEAM_A] + '  Team B: ' + S.teamScores[TEAM_B];
    S.roundOver = true;

    if (S.teamScores[TEAM_A] >= WIN_SCORE || S.teamScores[TEAM_B] >= WIN_SCORE) {
      S.gameOver = true;
      S.phase = PHASE_GAME_OVER;
      if (S._host) {
        const won = S.teamScores[TEAM_A] >= WIN_SCORE;
        const gmsg = won ? 'You win the game!' : 'Opponents win!';
        S._host.floatingText.add(CANVAS_W / 2, 200, gmsg, { color: won ? '#4f4' : '#f88', size: 24 });
        if (won) S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
      }
    } else {
      S.phase = PHASE_ROUND_SCORE;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: '#ff0', size: 18 });
    }
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

    // AI bidding round 1
    if (S.phase === PHASE_TRUMP_ROUND1 && S.biddingPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        if (V.aiShouldOrderUp(S.biddingPlayer, S.kittyCard.suit)) {
          const alone = V.aiShouldGoAlone(S.biddingPlayer, S.kittyCard.suit);
          if (S._host) {
            const msg = PLAYER_NAMES[S.biddingPlayer] + ' orders up' + (alone ? ' alone!' : '');
            S._host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
          }
          acceptTrump(S.biddingPlayer, S.kittyCard.suit, alone);
        } else {
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' passes', { color: '#aaa', size: 12 });

          // Check if everyone passed round 1
          if (S.biddingPlayer === S.dealer) {
            // All passed round 1, go to round 2
            S.biddingPlayer = V.leftOf(S.dealer);
            S.phase = PHASE_TRUMP_ROUND2;
            S.aiTurnTimer = 0;
          } else {
            advanceBidding();
          }
        }
      }
      return;
    }

    // AI bidding round 2
    if (S.phase === PHASE_TRUMP_ROUND2 && S.biddingPlayer !== 0) {
      S.aiTurnTimer += dt;
      if (S.aiTurnTimer >= AI_TURN_DELAY) {
        S.aiTurnTimer = 0;
        const picked = V.aiPickTrumpRound2(S.biddingPlayer);
        if (picked) {
          const alone = V.aiShouldGoAlone(S.biddingPlayer, picked);
          if (S._host) {
            const msg = PLAYER_NAMES[S.biddingPlayer] + ' calls ' + SUIT_SYMBOLS[picked] + (alone ? ' alone!' : '');
            S._host.floatingText.add(CANVAS_W / 2, 300, msg, { color: '#ff0', size: 14 });
          }
          acceptTrump(S.biddingPlayer, picked, alone);
        } else {
          if (S._host)
            S._host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[S.biddingPlayer] + ' passes', { color: '#aaa', size: 12 });

          if (S.biddingPlayer === S.dealer) {
            // Stuck dealer - should not reach here because aiPickTrumpRound2 forces a pick
            // Fallback: pick first non-kitty suit
            const kittyS = S.kittyCard ? S.kittyCard.suit : null;
            for (const s of CE.SUITS) {
              if (s !== kittyS) {
                acceptTrump(S.biddingPlayer, s, false);
                break;
              }
            }
          } else {
            advanceBidding();
          }
        }
      }
      return;
    }

    // Player bidding round 1 - wait for click
    if (S.phase === PHASE_TRUMP_ROUND1 && S.biddingPlayer === 0) return;

    // Player bidding round 2 - wait for click
    if (S.phase === PHASE_TRUMP_ROUND2 && S.biddingPlayer === 0) return;

    // Discard - wait for player
    if (S.phase === PHASE_DISCARD) return;

    // AI playing
    if (S.phase !== PHASE_PLAYING) return;
    if (S.currentTurn === 0) return;
    if (V.isSkipped(S.currentTurn)) {
      S.currentTurn = V.nextActivePlayer(S.currentTurn);
      return;
    }

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;
      const idx = V.aiChooseCard(S.currentTurn);
      if (idx >= 0)
        playCard(S.currentTurn, idx);
    }
  }

  Object.assign(V, {
    dealRound, acceptTrump, advanceBidding, startPlaying, playCard, tick
  });

})();
