/* Cribbage: game flow - dealing, turn sequence and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  const V = SZ.CardGames.v.cribbage;
  const S = V.S;
  const { CANVAS_H, WINNING_SCORE, PHASE_DISCARD, PHASE_CUT, PHASE_PEGGING, PHASE_SHOW,
    PHASE_ROUND_OVER, CENTER_Y } = V;

  const CANVAS_W = 900;

  const HAND_DEAL = 6;

  /* ================================================================
   *  SCORE ADVANCEMENT
   * ================================================================ */

  function addPlayerScore(pts) {
    if (pts <= 0 || S.gameOver)
      return;
    S.playerPrevScore = S.playerScore;
    S.playerScore += pts;
    S.score = S.playerScore;
    if (S._host) S._host.onScoreChanged(S.score);
    if (S.playerScore >= WINNING_SCORE) {
      S.playerScore = WINNING_SCORE;
      S.gameOver = true;
      S.roundOver = true;
      S.resultMsg = 'You win! ' + S.playerScore + ' - ' + S.aiScore;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        S._host.particles.confetti(CANVAS_W / 2, 300, 40);
      }
    }
  }

  function addAiScore(pts) {
    if (pts <= 0 || S.gameOver)
      return;
    S.aiPrevScore = S.aiScore;
    S.aiScore += pts;
    if (S.aiScore >= WINNING_SCORE) {
      S.aiScore = WINNING_SCORE;
      S.gameOver = true;
      S.roundOver = true;
      S.resultMsg = 'AI wins! ' + S.aiScore + ' - ' + S.playerScore;
      if (S._host)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
  }

  /* ================================================================
   *  DEAL A NEW ROUND
   * ================================================================ */

  function dealRound() {
    S.deck = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.playerKeep = [];
    S.aiKeep = [];
    S.crib = [];
    S.starter = null;
    S.selectedIndices = [];
    S.pegCards = [];
    S.pegCount = 0;
    S.playerPegHand = [];
    S.aiPegHand = [];
    S.playerSaidGo = false;
    S.aiSaidGo = false;
    S.pegMsg = '';
    S.waitingForGo = false;
    S.showBreakdown = [];
    S.showPhaseIdx = 0;
    S.roundOver = false;
    S.resultMsg = '';
    S.pendingAiAction = false;
    S.aiTimer = 0;
    S.hoverCardIdx = -1;

    // Deal 6 cards each
    for (let i = 0; i < HAND_DEAL; ++i) {
      const pc = S.deck.pop();
      pc.faceUp = true;
      S.playerHand.push(pc);
      const ac = S.deck.pop();
      ac.faceUp = false;
      S.aiHand.push(ac);
    }

    V.sortHand(S.playerHand);
    S.phase = PHASE_DISCARD;

    // AI discards immediately (hidden)
    const aiDisc = V.aiChooseDiscards();
    aiDisc.sort((a, b) => b - a);
    for (const idx of aiDisc) {
      const c = S.aiHand.splice(idx, 1)[0];
      S.crib.push(c);
    }
    S.aiKeep = S.aiHand.slice();
  }

  /* ================================================================
   *  PHASE TRANSITIONS
   * ================================================================ */

  function startCut() {
    S.phase = PHASE_CUT;
    S.starter = S.deck.pop();
    S.starter.faceUp = true;
    // His Heels: if starter is a Jack, dealer gets 2
    if (S.starter.rank === 'J') {
      if (S.dealerIsPlayer) {
        addPlayerScore(2);
        S.pegMsg = 'His Heels! You get 2 points.';
        if (S._host) S._host.floatingText.add(400, CENTER_Y, '+2 Heels', { color: '#ff0', size: 20 });
      } else {
        addAiScore(2);
        S.pegMsg = 'His Heels! AI gets 2 points.';
        if (S._host) S._host.floatingText.add(400, CENTER_Y, '+2 Heels', { color: '#f84', size: 20 });
      }
    }
    if (!S.gameOver) {
      S.pendingAiAction = true;
      S.aiTimer = 0;
    }
  }

  function startPegging() {
    S.phase = PHASE_PEGGING;
    S.playerPegHand = S.playerKeep.slice();
    S.aiPegHand = S.aiKeep.slice();
    for (const c of S.playerPegHand) c.faceUp = true;
    for (const c of S.aiPegHand) c.faceUp = true;
    S.pegCards = [];
    S.pegCount = 0;
    S.playerSaidGo = false;
    S.aiSaidGo = false;
    S.pegMsg = '';
    S.waitingForGo = false;
    S.pendingAiAction = false;
    // Non-dealer plays first
    S.currentPegger = S.dealerIsPlayer ? 1 : 0;
    if (S.currentPegger === 1) {
      S.pendingAiAction = true;
      S.aiTimer = 0;
    }
  }

  function resetPegRound() {
    S.pegCards = [];
    S.pegCount = 0;
    S.playerSaidGo = false;
    S.aiSaidGo = false;
    S.waitingForGo = false;
    S.pegMsg = '';
  }

  function startShow() {
    S.phase = PHASE_SHOW;
    S.showBreakdown = [];
    S.showPhaseIdx = 0;

    // Non-dealer shows first, then dealer, then crib
    const nonDealerHand = S.dealerIsPlayer ? S.aiKeep : S.playerKeep;
    const dealerHand = S.dealerIsPlayer ? S.playerKeep : S.aiKeep;

    const ndScore = V.scoreHand(nonDealerHand, S.starter, false);
    const dScore = V.scoreHand(dealerHand, S.starter, false);
    const cScore = V.scoreHand(S.crib, S.starter, true);

    S.showBreakdown.push({
      label: S.dealerIsPlayer ? 'AI Hand' : 'Your Hand',
      hand: nonDealerHand,
      result: ndScore,
      isPlayer: !S.dealerIsPlayer
    });
    S.showBreakdown.push({
      label: S.dealerIsPlayer ? 'Your Hand' : 'AI Hand',
      hand: dealerHand,
      result: dScore,
      isPlayer: S.dealerIsPlayer
    });
    S.showBreakdown.push({
      label: (S.dealerIsPlayer ? 'Your' : 'AI') + ' Crib',
      hand: S.crib,
      result: cScore,
      isPlayer: S.dealerIsPlayer
    });

    // Score non-dealer hand immediately
    applyShowScore(0);
  }

  function applyShowScore(idx) {
    if (idx >= S.showBreakdown.length || S.gameOver)
      return;
    const entry = S.showBreakdown[idx];
    const pts = entry.result.total;
    if (entry.isPlayer)
      addPlayerScore(pts);
    else
      addAiScore(pts);
    if (pts > 0 && S._host) {
      const yPos = 200 + idx * 30;
      const col = entry.isPlayer ? '#4f4' : '#f84';
      S._host.floatingText.add(400, yPos, '+' + pts, { color: col, size: 20 });
    }
  }

  function finishRound() {
    S.phase = PHASE_ROUND_OVER;
    S.roundOver = true;
    S.dealerIsPlayer = !S.dealerIsPlayer;
    if (!S.gameOver)
      S.resultMsg = 'Round complete. Click Continue.';
  }

  /* ================================================================
   *  PEGGING - PLAY CARD
   * ================================================================ */

  function playPegCard(isPlayer, cardIdx) {
    const hand = isPlayer ? S.playerPegHand : S.aiPegHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    S.pegCards.push(card);
    S.pegCount += V.cardValue(card);

    const pts = V.scorePegPlay(S.pegCards.slice(0, -1), card);
    if (pts > 0) {
      if (isPlayer) {
        addPlayerScore(pts);
        S.pegMsg = 'You score ' + pts + '!';
        if (S._host) S._host.floatingText.add(350, CENTER_Y + 30, '+' + pts, { color: '#4f4', size: 18 });
      } else {
        addAiScore(pts);
        S.pegMsg = 'AI scores ' + pts + '!';
        if (S._host) S._host.floatingText.add(350, CENTER_Y + 30, '+' + pts, { color: '#f84', size: 18 });
      }
    } else
      S.pegMsg = (isPlayer ? 'You' : 'AI') + ' played ' + card.rank + ' (' + S.pegCount + ')';

    if (S.gameOver)
      return;

    // Reset at 31
    if (S.pegCount === 31) {
      resetPegRound();
      checkPeggingEnd();
      return;
    }

    // Check if both players are stuck
    S.playerSaidGo = !V.canPlayPeg(S.playerPegHand);
    S.aiSaidGo = !V.canPlayPeg(S.aiPegHand);

    if (S.playerSaidGo && S.aiSaidGo) {
      // Last card bonus
      const lastPlayer = isPlayer;
      if (S.pegCount < 31) {
        if (lastPlayer)
          addPlayerScore(1);
        else
          addAiScore(1);
        S.pegMsg += ' Go! +1';
      }
      resetPegRound();
      checkPeggingEnd();
      return;
    }

    // Switch turn
    if (isPlayer) {
      if (!S.aiSaidGo) {
        S.currentPegger = 1;
        S.pendingAiAction = true;
        S.aiTimer = 0;
      } else {
        S.pegMsg = 'AI says Go';
        S.currentPegger = 0;
      }
    } else {
      if (!S.playerSaidGo) {
        S.currentPegger = 0;
        S.pendingAiAction = false;
      } else {
        S.pegMsg = 'You say Go';
        S.currentPegger = 1;
        S.pendingAiAction = true;
        S.aiTimer = 0;
      }
    }
  }

  function checkPeggingEnd() {
    if (S.gameOver)
      return;
    if (S.playerPegHand.length === 0 && S.aiPegHand.length === 0) {
      // Pegging done; proceed to show
      S.pendingAiAction = true;
      S.aiTimer = 0;
      return;
    }
    // Determine who goes next
    if (S.playerPegHand.length > 0 && S.aiPegHand.length > 0) {
      S.currentPegger = S.dealerIsPlayer ? 1 : 0;
    } else if (S.playerPegHand.length > 0)
      S.currentPegger = 0;
    else {
      S.currentPegger = 1;
      S.pendingAiAction = true;
      S.aiTimer = 0;
    }
    if (S.currentPegger === 1) {
      S.pendingAiAction = true;
      S.aiTimer = 0;
    }
  }

  /* ================================================================
   *  PLAYER DISCARD ACTION
   * ================================================================ */

  function doPlayerDiscard() {
    if (S.selectedIndices.length !== 2)
      return;
    S.selectedIndices.sort((a, b) => b - a);
    for (const idx of S.selectedIndices) {
      const c = S.playerHand.splice(idx, 1)[0];
      S.crib.push(c);
    }
    S.playerKeep = S.playerHand.slice();
    S.selectedIndices = [];
    V.sortHand(S.playerKeep);
    startCut();
  }

  V.addPlayerScore = addPlayerScore;
  V.addAiScore = addAiScore;
  V.dealRound = dealRound;
  V.startPegging = startPegging;
  V.resetPegRound = resetPegRound;
  V.startShow = startShow;
  V.applyShowScore = applyShowScore;
  V.finishRound = finishRound;
  V.playPegCard = playPegCard;
  V.checkPeggingEnd = checkPeggingEnd;
  V.doPlayerDiscard = doPlayerDiscard;

})();
