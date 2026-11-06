/* Sixty-Six - dealing, turn flow and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const V = SZ.CardGames.v.sixtysix;
  const S = V.S;
  const {
    CANVAS_W, CANVAS_H, TARGET_POINTS, MATCH_TARGET, PHASE_PLAY,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER
  } = V;

  const SIXTYSIX_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'];
  const HAND_LIMIT = 6;

  const TRICK_DONE_DELAY = 1.2;
  const AI_TURN_DELAY = 0.8;

  /* ================================================================
     SETUP
     ================================================================ */

  function dealRound() {
    const d = CE.shuffle(CE.createDeckFromRanks(CE.SUITS, SIXTYSIX_RANKS));
    S.stock = d;
    S.playerHand = [];
    S.aiHand = [];
    S.playerCaptured = [];
    S.aiCaptured = [];
    S.playerTrickPoints = 0;
    S.aiTrickPoints = 0;
    S.playerTricksTaken = 0;
    S.aiTricksTaken = 0;
    S.trickCards = [];
    S.trickPlayers = [];
    S.trickCount = 0;
    S.trickWinner = -1;
    S.trickDoneTimer = 0;
    S.aiTurnTimer = 0;
    S.hoverCardIdx = -1;
    S.roundOver = false;
    S.stockClosed = false;
    S.closedBy = -1;
    S.stockClosedPointsAtClose = [0, 0];
    S.marriagePending = false;
    S.marriageSuit = '';
    S.marriageShownTimer = 0;
    S.marriageShownSuit = '';
    S.marriageShownBy = -1;
    S.aiDeclaredMarriage = false;
    S.phase = PHASE_PLAY;

    /* Trump card is the bottom of the stock, shown face-up */
    S.trumpCard = S.stock[0];
    S.trumpCard.faceUp = true;
    S.trumpSuit = S.trumpCard.suit;

    /* Deal 6 cards each */
    for (let i = 0; i < HAND_LIMIT; ++i) {
      S.playerHand.push(S.stock.pop());
      S.aiHand.push(S.stock.pop());
    }

    for (const c of S.playerHand) c.faceUp = true;
    V.sortHand(S.playerHand);
    V.sortHand(S.aiHand);

    /* Non-dealer leads (player leads first round) */
    S.currentTurn = 0;
    S.trickLeader = 0;

    V.checkPlayerMarriage();

    if (S._host)
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, V.playerCardX(i, S.playerHand.length), V.playerCardY(), i * 0.08);
  }

  function setupSixtySix() {
    S.roundOver = false;
    S.gameOver = false;
    S.matchOver = false;
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

    /* Next player's turn */
    S.currentTurn = 1 - S.currentTurn;
  }

  function finishTrick() {
    const pts = V.trickPointValue();

    if (S.trickWinner === 0) {
      S.playerTrickPoints += pts;
      ++S.playerTricksTaken;
      for (const c of S.trickCards) S.playerCaptured.push(c);
      if (S._host && pts > 0)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'You +' + pts + ' pts', { color: '#4f4', size: 16 });
    } else {
      S.aiTrickPoints += pts;
      ++S.aiTricksTaken;
      for (const c of S.trickCards) S.aiCaptured.push(c);
      if (S._host && pts > 0)
        S._host.floatingText.add(CANVAS_W / 2, 280, 'AI +' + pts + ' pts', { color: '#fa0', size: 16 });
    }

    ++S.trickCount;
    S.trickCards = [];
    S.trickPlayers = [];

    /* Check if someone reached 66 */
    if (S.playerTrickPoints >= TARGET_POINTS && !S.roundOver) {
      endRound(0);
      return;
    }
    if (S.aiTrickPoints >= TARGET_POINTS && !S.roundOver) {
      endRound(1);
      return;
    }

    /* Draw from stock (only if stock is open) */
    if (V.isStockOpen() && S.stock.length > 0) {
      const winnerHand = S.trickWinner === 0 ? S.playerHand : S.aiHand;
      const loserHand = S.trickWinner === 0 ? S.aiHand : S.playerHand;

      winnerHand.push(S.stock.pop());
      if (S.stock.length > 0)
        loserHand.push(S.stock.pop());

      for (const c of S.playerHand) c.faceUp = true;
      V.sortHand(S.playerHand);
      V.sortHand(S.aiHand);
    }

    /* Check if round is over (all cards played) */
    if (S.playerHand.length === 0 && S.aiHand.length === 0 && !S.roundOver) {
      /* last trick bonus: winner of last trick gets 10 points (in some rules) */
      /* Standard 66 doesn't have last trick bonus, but we check for winner */
      endRoundNoReach();
      return;
    }

    /* Winner leads next trick */
    S.currentTurn = S.trickWinner;
    S.trickLeader = S.trickWinner;
    S.trickWinner = -1;
    S.phase = PHASE_PLAY;
    S.aiTurnTimer = 0;
    S.aiDeclaredMarriage = false;

    V.sortHand(S.playerHand);
    V.sortHand(S.aiHand);

    /* Check if player can declare marriage */
    if (S.currentTurn === 0)
      V.checkPlayerMarriage();
    else
      S.marriagePending = false;
  }

  function endRound(winner) {
    if (S.roundOver) return;
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;

    const loser = 1 - winner;
    const loserPts = loser === 0 ? S.playerTrickPoints : S.aiTrickPoints;
    const loserTricks = loser === 0 ? S.playerTricksTaken : S.aiTricksTaken;

    let gamePointsWon = 1;
    if (loserTricks === 0)
      gamePointsWon = 3;
    else if (loserPts < 33)
      gamePointsWon = 2;

    /* If the closer failed to reach 66, the opponent gets the game points */
    if (S.stockClosed && S.closedBy === loser) {
      /* Closer failed -- opponent gets at least 2, or 3 if no tricks */
      gamePointsWon = loserTricks === 0 ? 3 : 2;
      /* But actually the winner is the opponent of the closer */
      /* This case means the closer didn't reach 66, so the other player wins */
    }

    if (winner === 0) {
      S.playerGamePoints += gamePointsWon;
      S.score += gamePointsWon;
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, 180, 'You win ' + gamePointsWon + ' game point' + (gamePointsWon > 1 ? 's' : '') + '!', { color: '#4f4', size: 22 });
        if (gamePointsWon >= 3) S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 50);
      }
    } else {
      S.aiGamePoints += gamePointsWon;
      if (S.score > 0) S.score = Math.max(0, S.score - gamePointsWon);
      if (S._host) {
        S._host.onScoreChanged(S.score);
        S._host.floatingText.add(CANVAS_W / 2, 180, 'AI wins ' + gamePointsWon + ' game point' + (gamePointsWon > 1 ? 's' : '') + '!', { color: '#f44', size: 22 });
      }
    }

    if (S.playerGamePoints >= MATCH_TARGET || S.aiGamePoints >= MATCH_TARGET)
      S.matchOver = true;
  }

  function endRoundNoReach() {
    /* Neither player declared 66 -- all cards exhausted */
    /* The player with more trick points wins */
    if (S.playerTrickPoints > S.aiTrickPoints)
      endRound(0);
    else if (S.aiTrickPoints > S.playerTrickPoints)
      endRound(1);
    else {
      /* Tie in points -- the non-dealer (player, in our case) wins by convention */
      endRound(0);
    }
  }

  function tick(dt) {
    /* Marriage show timer */
    if (S.marriageShownTimer > 0)
      S.marriageShownTimer -= dt;

    if (S.phase === PHASE_ROUND_OVER) return;

    if (S.phase === PHASE_TRICK_DONE) {
      S.trickDoneTimer += dt;
      if (S.trickDoneTimer >= TRICK_DONE_DELAY)
        finishTrick();
      return;
    }

    if (S.phase !== PHASE_PLAY) return;
    if (S.currentTurn !== 1) return;

    S.aiTurnTimer += dt;
    if (S.aiTurnTimer >= AI_TURN_DELAY) {
      S.aiTurnTimer = 0;

      /* AI: consider closing the stock */
      if (S.trickCards.length === 0 && V.aiShouldClose())
        V.closeStock(1);

      /* AI: consider declaring marriage (when leading) */
      if (S.trickCards.length === 0 && !S.aiDeclaredMarriage) {
        const mSuit = V.aiCheckMarriage();
        if (mSuit) {
          V.declareMarriage(1, mSuit);
          S.aiDeclaredMarriage = true;
          /* Don't play card yet -- wait another tick */
          S.aiTurnTimer = -AI_TURN_DELAY * 0.5;
          return;
        }
      }

      const idx = V.aiChooseCard();
      if (idx >= 0)
        playCard(1, idx);
    }
  }

  Object.assign(V, {
    dealRound, setupSixtySix, playCard, endRound, tick
  });

})();
