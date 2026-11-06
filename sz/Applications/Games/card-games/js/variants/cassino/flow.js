/* Cassino: game flow - dealing, turn sequence and round/game end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardX = SZ.CardGames.shared.euroLayout.fanCardX;

  const V = SZ.CardGames.v.cassino;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, WINNING_SCORE, PHASE_PLAY, PHASE_SELECT_TABLE, PHASE_AI_TURN,
    PHASE_ROUND_OVER, PLAYER_HAND_Y } = V;

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function dealHands() {
    for (let i = 0; i < 4; ++i) {
      if (S.stock.length > 0) {
        const pc = S.stock.pop();
        pc.faceUp = true;
        S.playerHand.push(pc);
      }
      if (S.stock.length > 0) {
        const ac = S.stock.pop();
        ac.faceUp = false;
        S.aiHand.push(ac);
      }
    }

    if (S._host) {
      for (let i = 0; i < S.playerHand.length; ++i)
        S._host.dealCardAnim && S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, S.playerHand.length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  function setupRound() {
    const d = CE.shuffle(CE.createDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.table = [];
    S.stock = d;
    S.playerCaptures = [];
    S.aiCaptures = [];
    S.playerSweeps = 0;
    S.aiSweeps = 0;
    S.lastCapturer = -1;
    S.roundOver = false;
    S.roundBreakdown = null;
    S.selectedHandIdx = -1;
    S.selectedTableIdxs = [];
    S.hoverHandIdx = -1;
    S.hoverTableIdx = -1;
    S.aiTurnTimer = 0;

    // Place 4 cards on the table
    for (let i = 0; i < 4; ++i) {
      const c = S.stock.pop();
      c.faceUp = true;
      S.table.push(c);
    }

    // Deal 4 to each
    dealHands();
    S.phase = PHASE_PLAY;
  }

  function performCapture(who, handCard, tableIdxs) {
    const captures = who === 0 ? S.playerCaptures : S.aiCaptures;
    const captured = [];

    // Remove table items (descending order to preserve indices)
    const sorted = tableIdxs.slice().sort((a, b) => b - a);
    for (const idx of sorted) {
      const item = S.table.splice(idx, 1)[0];
      if (V.isBuild(item)) {
        for (const c of item.cards)
          captured.push(c);
      } else
        captured.push(item);
    }

    captures.push(handCard);
    for (const c of captured)
      captures.push(c);

    // Check sweep (cleared entire table)
    if (S.table.length === 0) {
      if (who === 0) {
        ++S.playerSweeps;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'SWEEP!', { color: '#ff0', size: 28 });
          S._host.particles && S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 20);
        }
      } else {
        ++S.aiSweeps;
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Sweep!', { color: '#fa0', size: 22 });
      }
    }

    S.lastCapturer = who;
  }

  function performBuild(who, handCard, tableIdxs, buildValue) {
    const buildCards = [handCard];
    // Collect table items (descending order)
    const sorted = tableIdxs.slice().sort((a, b) => b - a);
    for (const idx of sorted) {
      const item = S.table.splice(idx, 1)[0];
      if (V.isBuild(item)) {
        for (const c of item.cards)
          buildCards.push(c);
      } else
        buildCards.push(item);
    }

    const build = V.makeBuild(buildCards, buildValue, who);
    S.table.push(build);

    if (S._host) {
      const label = who === 0 ? 'Build ' + buildValue : 'AI builds ' + buildValue;
      const color = who === 0 ? '#8cf' : '#fa0';
      S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, label, { color, size: 16 });
    }
  }

  function playCardToTable(who, card) {
    card.faceUp = true;
    S.table.push(card);
  }

  function playerPlayCapture(handIdx, tableIdxs) {
    const card = S.playerHand.splice(handIdx, 1)[0];
    performCapture(0, card, tableIdxs);
    if (S._host) {
      const count = tableIdxs.length;
      S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 40, 'Captured ' + (count + 1) + ' cards', { color: '#8f8', size: 14 });
    }
    S.selectedHandIdx = -1;
    S.selectedTableIdxs = [];
    afterTurn();
  }

  function playerPlayBuild(handIdx, tableIdxs, buildValue) {
    const card = S.playerHand.splice(handIdx, 1)[0];
    performBuild(0, card, tableIdxs, buildValue);
    S.selectedHandIdx = -1;
    S.selectedTableIdxs = [];
    afterTurn();
  }

  function playerPlayTrail(handIdx) {
    const card = S.playerHand.splice(handIdx, 1)[0];
    playCardToTable(0, card);
    S.selectedHandIdx = -1;
    S.selectedTableIdxs = [];
    afterTurn();
  }

  function afterTurn() {
    // Check if hands empty => re-deal or end round
    if (S.playerHand.length === 0 && S.aiHand.length === 0) {
      if (S.stock.length > 0) {
        dealHands();
        S.phase = PHASE_PLAY;
        return;
      }
      // End of round: last capturer takes remaining table cards
      if (S.table.length > 0 && S.lastCapturer >= 0) {
        const captures = S.lastCapturer === 0 ? S.playerCaptures : S.aiCaptures;
        while (S.table.length > 0) {
          const item = S.table.pop();
          if (V.isBuild(item)) {
            for (const c of item.cards)
              captures.push(c);
          } else
            captures.push(item);
        }
        // No sweep for this
      }
      endRound();
      return;
    }

    // Switch to AI turn
    if (S.phase === PHASE_PLAY || S.phase === PHASE_SELECT_TABLE) {
      S.phase = PHASE_AI_TURN;
      S.aiTurnTimer = 0;
    }
  }

  function endRound() {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;
    ++S.roundNumber;

    S.roundBreakdown = V.scoreRound();

    S.cumulativePlayer += S.roundBreakdown.player.total;
    S.cumulativeAI += S.roundBreakdown.ai.total;

    S.score = S.cumulativePlayer * 10;
    if (S._host) S._host.onScoreChanged(S.score);

    if (S.cumulativePlayer >= WINNING_SCORE || S.cumulativeAI >= WINNING_SCORE) {
      S.gameOver = true;
      if (S.cumulativePlayer >= WINNING_SCORE && S.cumulativePlayer > S.cumulativeAI) {
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.particles && S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          S._host.triggerChipSparkle && S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      } else if (S.cumulativeAI >= WINNING_SCORE && S.cumulativeAI > S.cumulativePlayer) {
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI WINS', { color: '#f44', size: 28 });
      } else {
        // Tie at or above threshold -- continue
        S.gameOver = false;
      }
    }

    if (S.gameOver && S._host)
      S._host.onRoundOver(true);
  }

  V.setupRound = setupRound;
  V.performCapture = performCapture;
  V.performBuild = performBuild;
  V.playCardToTable = playCardToTable;
  V.playerPlayCapture = playerPlayCapture;
  V.playerPlayBuild = playerPlayBuild;
  V.playerPlayTrail = playerPlayTrail;
  V.afterTurn = afterTurn;

})();
