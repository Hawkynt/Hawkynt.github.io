/* Bezique: game flow - dealing, turn sequence and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardY = SZ.CardGames.shared.euroLayout.duelPlayerCardY;

  const V = SZ.CardGames.v.bezique;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, GAME_WIN_SCORE, PHASE_PLAY, PHASE_TRICK_DONE, PHASE_MELD_SELECT,
    PHASE_ROUND_OVER } = V;

  const HAND_SIZE = 8;

  function dealRound() {
    S.cardIdCounter = 0;
    const d = CE.shuffle(V.createBeziqueDeck());
    S.stock = d;
    S.playerHand = [];
    S.aiHand = [];
    S.playerCaptured = [];
    S.aiCaptured = [];
    S.playerMeldScore = 0;
    S.aiMeldScore = 0;
    S.playerMeldsUsed = {};
    S.aiMeldsUsed = {};
    S.playerMeldCards = [];
    S.aiMeldCards = [];
    S.trumpSwapped = [false, false];
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickCount = 0;
    S.trickWinner = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.hoverCardIdx = -1;
    S.roundOver = false;
    S.pendingMeldOptions = [];
    S.meldDisplayTimer = 0;
    S.lastMeldMsg = '';
    S.phase = PHASE_PLAY;

    // Deal 8 cards each
    for (let i = 0; i < HAND_SIZE; ++i) {
      S.playerHand.push(S.stock.pop());
      S.aiHand.push(S.stock.pop());
    }

    // Flip trump indicator from stock
    S.trumpCard = S.stock.shift();
    S.trumpCard.faceUp = true;
    S.trumpSuit = S.trumpCard.suit;

    for (const c of S.playerHand) c.faceUp = true;
    V.sortHand(S.playerHand);
    V.sortHand(S.aiHand);

    // Non-dealer leads
    S.currentTurn = 0;
    S.trickLeader = 0;
    ++S.dealNumber;

    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.playerHand.length), playerCardY(), i * 0.08);
    }
  }

  function setupBezique() {
    S.roundOver = false;
    S.gameOver = false;
    S.dealNumber = 0;
    dealRound();
  }

  /* ================================================================
     TRICK FLOW
     ================================================================ */

  function playCard(who, cardIdx) {
    const hand = who === 0 ? S.playerHand : S.aiHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;

    S.trickCards.push(card);
    S.trickPlayers.push(who);

    if (S.trickCards.length >= 2) {
      S.phase = PHASE_TRICK_DONE;
      S.trickWinner = V.resolveTrickWinner();
      S.trickDoneTimer = 0;
      return;
    }

    S.currentTurn = 1 - S.currentTurn;
  }

  function finishTrick() {
    const winner = S.trickWinner;
    const captured = winner === 0 ? S.playerCaptured : S.aiCaptured;
    for (const c of S.trickCards)
      captured.push(c);

    ++S.trickCount;
    S.trickCards = [];
    S.trickPlayers = [];

    // Winner draws first from stock, then loser
    if (S.stock.length > 0) {
      const winnerHand = winner === 0 ? S.playerHand : S.aiHand;
      const loserHand = winner === 0 ? S.aiHand : S.playerHand;

      winnerHand.push(S.stock.pop());
      V.assignCardId(winnerHand[winnerHand.length - 1]);
      if (S.stock.length > 0) {
        loserHand.push(S.stock.pop());
        V.assignCardId(loserHand[loserHand.length - 1]);
      } else if (S.trumpCard) {
        // Last card: take the trump indicator
        loserHand.push(S.trumpCard);
        S.trumpCard = null;
      }

      for (const c of S.playerHand) c.faceUp = true;
      V.sortHand(S.playerHand);
      V.sortHand(S.aiHand);
    } else if (S.trumpCard) {
      // Stock just ran out, trump card goes to loser of this trick
      const loserHand = winner === 0 ? S.aiHand : S.playerHand;
      loserHand.push(S.trumpCard);
      if (winner !== 0) S.trumpCard.faceUp = true;
      S.trumpCard = null;
      V.sortHand(S.playerHand);
      V.sortHand(S.aiHand);
    }

    // Check if round is over
    if (S.playerHand.length === 0 && S.aiHand.length === 0) {
      endRound();
      return;
    }

    // Winner can declare melds (only in phase 1 with stock)
    if (!V.isPhase2()) {
      if (winner === 0) {
        const melds = V.getAvailableMelds(0);
        if (melds.length > 0) {
          S.pendingMeldOptions = melds;
          S.phase = PHASE_MELD_SELECT;
          S.currentTurn = 0;
          S.trickLeader = 0;
          S.trickWinner = -1;
          return;
        }
      } else {
        // AI declares meld
        const meld = V.aiSelectMeld();
        if (meld)
          V.declareMeld(1, meld);
      }
    }

    // Winner leads next trick
    S.currentTurn = winner;
    S.trickLeader = winner;
    S.trickWinner = -1;
    S.phase = PHASE_PLAY;
    S.aiTurnTimer = 0;
  }

  function endRound() {
    // Last trick winner gets 10 bonus points
    const lastWinner = S.trickWinner >= 0 ? S.trickWinner : S.trickLeader;

    // Count brisques (A and 10 in captured piles)
    const playerBrisques = V.countBrisques(S.playerCaptured);
    const aiBrisques = V.countBrisques(S.aiCaptured);

    // Last trick bonus
    const lastTrickBonus = 10;

    const playerRoundScore = S.playerMeldScore + playerBrisques + (lastWinner === 0 ? lastTrickBonus : 0);
    const aiRoundScore = S.aiMeldScore + aiBrisques + (lastWinner === 1 ? lastTrickBonus : 0);

    S.playerTotalScore += playerRoundScore;
    S.aiTotalScore += aiRoundScore;
    S.score = S.playerTotalScore;

    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    if (S.playerTotalScore >= GAME_WIN_SCORE || S.aiTotalScore >= GAME_WIN_SCORE) {
      S.gameOver = true;
      if (S._host) {
        S._host.onScoreChanged(S.score);
        if (S.playerTotalScore >= GAME_WIN_SCORE) {
          S._host.floatingText.add(CANVAS_W / 2, 200, 'You win! (' + S.playerTotalScore + ' pts)', { color: '#4f4', size: 24 });
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
        } else {
          S._host.floatingText.add(CANVAS_W / 2, 200, 'AI wins! (' + S.aiTotalScore + ' pts)', { color: '#f44', size: 24 });
        }
      }
    } else if (S._host) {
      S._host.onScoreChanged(S.score);
      S._host.floatingText.add(CANVAS_W / 2, 200, 'Deal complete! You: +' + playerRoundScore + ' | AI: +' + aiRoundScore, { color: '#ff0', size: 16 });
    }
  }

  V.dealRound = dealRound;
  V.setupBezique = setupBezique;
  V.playCard = playCard;
  V.finishTrick = finishTrick;

})();
