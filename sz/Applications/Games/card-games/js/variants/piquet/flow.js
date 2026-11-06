/* Piquet: game flow - dealing, turn sequence and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.piquet;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, HAND_SIZE, GAME_WIN_SCORE, ELDER_MAX_EXCHANGE, PHASE_EXCHANGE,
    PHASE_DECLARE_POINT, PHASE_DECLARE_SEQUENCE, PHASE_DECLARE_SET, PHASE_TRICK_PLAY,
    PHASE_TRICK_DONE, PHASE_ROUND_OVER } = V;

  const DECL_DISPLAY_DELAY = 1.8;

  /* ================================================================
     EXCHANGE LOGIC
     ================================================================ */

  function doPlayerExchange() {
    if (S.selectedIndices.length < 1) return;
    const elderIsPlayer = V.elder() === 0;
    const maxExch = elderIsPlayer ? Math.min(ELDER_MAX_EXCHANGE, S.talon.length) : S.talon.length;
    if (S.selectedIndices.length > maxExch) return;

    // Remove selected cards (descending order to preserve indices)
    const sorted = S.selectedIndices.slice().sort((a, b) => b - a);
    for (const idx of sorted)
      S.playerHand.splice(idx, 1);

    // Draw from talon
    const drawCount = sorted.length;
    for (let i = 0; i < drawCount && S.talon.length > 0; ++i) {
      const c = S.talon.shift();
      c.faceUp = true;
      S.playerHand.push(c);
    }
    V.sortHand(S.playerHand);
    S.selectedIndices = [];
    S.exchangeDone = true;

    if (!S.aiExchangeDone)
      doAiExchange();
    startDeclarations();
  }

  function doAiExchange() {
    const elderIsAi = V.elder() === 1;
    const maxExch = elderIsAi ? Math.min(ELDER_MAX_EXCHANGE, S.talon.length) : S.talon.length;

    // AI strategy: discard weakest cards (lowest rank, avoid breaking long suits)
    const discards = V.aiChooseDiscards(S.aiHand, maxExch);
    discards.sort((a, b) => b - a);
    for (const idx of discards)
      S.aiHand.splice(idx, 1);

    const drawCount = discards.length;
    for (let i = 0; i < drawCount && S.talon.length > 0; ++i)
      S.aiHand.push(S.talon.shift());

    V.sortHand(S.aiHand);
    S.aiExchangeDone = true;
  }

  /* ================================================================
     DEAL & SETUP
     ================================================================ */

  function dealRound() {
    S.deck = CE.shuffle(V.createPiquetDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.talon = [];
    S.trickCards = [];
    S.selectedIndices = [];
    S.exchangeDone = false;
    S.aiExchangeDone = false;
    S.trickCount = 0;
    S.playerTricksWon = 0;
    S.aiTricksWon = 0;
    S.playerDeclScore = 0;
    S.aiDeclScore = 0;
    S.playerPointsBeforeTricks = 0;
    S.aiPointsBeforeTricks = 0;
    S.playerTrickPlayPts = 0;
    S.aiTrickPlayPts = 0;
    S.declResults = [];
    S.declPhaseTimer = 0;
    S.trickDoneTimer = 0;
    S.trickWinnerLabel = '';
    S.aiTimer = 0;
    S.pendingAiAction = false;
    S.hoverCardIdx = -1;
    S.resultMsg = '';
    S.roundOver = false;

    // Deal 12 cards each
    for (let i = 0; i < HAND_SIZE; ++i) {
      const pc = S.deck.pop();
      pc.faceUp = true;
      S.playerHand.push(pc);
      const ac = S.deck.pop();
      ac.faceUp = false;
      S.aiHand.push(ac);
    }

    // Remaining 8 form the talon
    while (S.deck.length > 0)
      S.talon.push(S.deck.pop());

    V.sortHand(S.playerHand);
    V.sortHand(S.aiHand);

    S.phase = PHASE_EXCHANGE;

    // If AI is elder (non-dealer), AI exchanges first
    if (V.elder() === 1) {
      doAiExchange();
      // Player exchanges as younger after
    }
  }

  function setupGame() {
    S.playerScore = 0;
    S.aiScore = 0;
    S.gameOver = false;
    S.score = 0;
    S.roundNumber = 0;
    S.dealer = 1; // Player is elder (non-dealer) in first round
    dealRound();
  }

  /* ================================================================
     PHASE TRANSITIONS
     ================================================================ */

  function startDeclarations() {
    V.resolveDeclarations();
    S.phase = PHASE_DECLARE_POINT;
    S.declPhaseTimer = DECL_DISPLAY_DELAY;

    if (S._host) {
      for (const d of S.declResults) {
        const color = d.winner === 'player' ? '#4f4' : d.winner === 'ai' ? '#f84' : '#aaa';
        S._host.floatingText.add(CANVAS_W / 2, 200, d.msg, { color, size: 14 });
      }
    }
  }

  function advanceDeclarationPhase() {
    if (S.phase === PHASE_DECLARE_POINT) {
      S.phase = PHASE_DECLARE_SEQUENCE;
      S.declPhaseTimer = DECL_DISPLAY_DELAY;
    } else if (S.phase === PHASE_DECLARE_SEQUENCE) {
      S.phase = PHASE_DECLARE_SET;
      S.declPhaseTimer = DECL_DISPLAY_DELAY;
    } else if (S.phase === PHASE_DECLARE_SET) {
      applyDeclarationScores();
      startTrickPlay();
    }
  }

  function applyDeclarationScores() {
    S.playerScore += S.playerDeclScore;
    S.aiScore += S.aiDeclScore;
    S.score = S.playerScore;
    if (S._host) S._host.onScoreChanged(S.score);
    checkGameOver();
  }

  function startTrickPlay() {
    S.phase = PHASE_TRICK_PLAY;
    S.trickCards = [];
    // Elder (non-dealer) leads first
    S.currentTurn = V.elder();
    S.trickLeader = V.elder();
    S.aiTimer = 0;

    // Check for Pique: 30+ total (decl + leading first trick point) before opponent scores
    // Pique is checked during trick play once a player reaches 30 including trick points
  }

  function playCard(player, cardIdx) {
    const hand = player === 0 ? S.playerHand : S.aiHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    S.trickCards.push({ card, player });

    if (S.trickCards.length >= 2) {
      S.phase = PHASE_TRICK_DONE;
      S.trickDoneTimer = 0;

      const winner = V.determineTrickWinner();
      const leaderWon = winner === S.trickLeader;

      // Score: 1 point for leading to a trick won
      if (winner === 0) {
        ++S.playerTrickPlayPts;
        if (leaderWon)
          S.playerTrickPlayPts += 0; // leading point already counted as 1 for winning the trick
      } else {
        ++S.aiTrickPlayPts;
      }

      S.trickWinnerLabel = winner === 0 ? 'You take the trick' : 'AI takes the trick';
      return;
    }

    // After first card played, switch to other player
    S.currentTurn = S.currentTurn === 0 ? 1 : 0;
  }

  function finishTrick() {
    const winner = V.determineTrickWinner();
    if (winner === 0)
      ++S.playerTricksWon;
    else
      ++S.aiTricksWon;
    ++S.trickCount;

    // Last trick bonus: +1
    const isLastTrick = S.trickCount >= HAND_SIZE || (S.playerHand.length === 0 && S.aiHand.length === 0);
    if (isLastTrick) {
      if (winner === 0)
        ++S.playerTrickPlayPts;
      else
        ++S.aiTrickPlayPts;
    }

    S.trickCards = [];

    if (isLastTrick) {
      endRound();
      return;
    }

    // Winner leads next trick
    S.currentTurn = winner;
    S.trickLeader = winner;
    S.phase = PHASE_TRICK_PLAY;
    S.aiTimer = 0;
  }

  function endRound() {
    // Apply trick play points
    S.playerScore += S.playerTrickPlayPts;
    S.aiScore += S.aiTrickPlayPts;

    // Check Pique (30+ from declarations + trick pts before opponent scores any trick pts)
    // We check the full total: if one side had 29 from decl and scored 1+ trick pt before
    // opponent scored any trick pt, and total >= 30, that's a Pique
    const playerTotal = S.playerDeclScore + S.playerTrickPlayPts;
    const aiTotal = S.aiDeclScore + S.aiTrickPlayPts;

    // Pique: only if repique was not already awarded (repique is declarations-only)
    const hadRepique = S.declResults.some(d => d.phase === 'Bonus');
    if (!hadRepique) {
      if (playerTotal >= 30 && S.aiDeclScore === 0 && S.aiTrickPlayPts === 0) {
        S.playerScore += 30;
        S.declResults.push({ phase: 'Pique', msg: 'PIQUE! You score +30 bonus', winner: 'player' });
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 250, 'PIQUE! +30', { color: '#4f4', size: 20 });
      } else if (aiTotal >= 30 && S.playerDeclScore === 0 && S.playerTrickPlayPts === 0) {
        S.aiScore += 30;
        S.declResults.push({ phase: 'Pique', msg: 'PIQUE! AI scores +30 bonus', winner: 'ai' });
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 250, 'AI PIQUE! +30', { color: '#f84', size: 20 });
      }
    }

    // Capot: winning all 12 tricks = +40 bonus
    if (S.playerTricksWon === HAND_SIZE) {
      S.playerScore += 40;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 280, 'CAPOT! +40', { color: '#4f4', size: 20 });
    } else if (S.aiTricksWon === HAND_SIZE) {
      S.aiScore += 40;
      if (S._host) S._host.floatingText.add(CANVAS_W / 2, 280, 'AI CAPOT! +40', { color: '#f84', size: 20 });
    }

    S.score = S.playerScore;
    if (S._host) S._host.onScoreChanged(S.score);

    ++S.roundNumber;
    S.roundOver = true;

    // Alternate dealer
    S.dealer = S.dealer === 0 ? 1 : 0;

    checkGameOver();
    S.phase = PHASE_ROUND_OVER;
  }

  function checkGameOver() {
    if (S.playerScore >= GAME_WIN_SCORE || S.aiScore >= GAME_WIN_SCORE) {
      S.gameOver = true;
      S.roundOver = true;
      if (S._host) {
        const won = S.playerScore >= GAME_WIN_SCORE;
        const msg = won ? 'You win the game!' : 'AI wins the game!';
        const col = won ? '#4f4' : '#f44';
        S._host.floatingText.add(CANVAS_W / 2, 200, msg, { color: col, size: 24 });
        if (won) S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
      }
    }
  }

  V.doPlayerExchange = doPlayerExchange;
  V.dealRound = dealRound;
  V.setupGame = setupGame;
  V.advanceDeclarationPhase = advanceDeclarationPhase;
  V.playCard = playCard;
  V.finishTrick = finishTrick;

})();
