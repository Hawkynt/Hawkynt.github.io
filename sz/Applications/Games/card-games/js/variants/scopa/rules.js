/* Scopa: rules - deck, legal moves, scoring and round/game flow. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;
  const playerCardX = SZ.CardGames.shared.euroLayout.fanCardX;

  const V = SZ.CardGames.v.scopa;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, WINNING_SCORE, PHASE_PLAY, PHASE_CAPTURE, PHASE_AI_TURN,
    PHASE_ROUND_OVER, PLAYER_HAND_Y } = V;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const SCOPA_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
  const CAPTURE_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'J': 8, 'Q': 9, 'K': 10 };
  const PRIMIERA_VALUES = { '7': 21, '6': 18, 'A': 16, '5': 15, '4': 14, '3': 13, '2': 12, 'J': 10, 'Q': 10, 'K': 10 };

  const DIAMOND = 'diamonds';

  /* ================================================================
     DECK CREATION (40-card Italian-style)
     ================================================================ */

  function createScopaDeck() {
    return CE.createDeckFromRanks(CE.SUITS, SCOPA_RANKS);
  }

  /* ================================================================
     CARD VALUE HELPERS
     ================================================================ */

  function captureValue(card) {
    return CAPTURE_VALUES[card.rank] || 0;
  }

  function primieraValue(card) {
    return PRIMIERA_VALUES[card.rank] || 10;
  }

  function isDiamond(card) {
    return card.suit === DIAMOND;
  }

  function isSetteBello(card) {
    return card.rank === '7' && card.suit === DIAMOND;
  }

  /* ================================================================
     CAPTURE LOGIC — find all valid capture combinations
     ================================================================ */

  function findCaptureCombinations(cardVal, tableCards) {
    const results = [];

    // Single card matches
    for (let i = 0; i < tableCards.length; ++i)
      if (captureValue(tableCards[i]) === cardVal)
        results.push([i]);

    // Multi-card subsets that sum to cardVal (up to full table)
    const n = tableCards.length;
    if (n >= 2) {
      for (let mask = 3; mask < (1 << n); ++mask) {
        // Skip single-bit masks (already handled)
        if ((mask & (mask - 1)) === 0) continue;
        let sum = 0;
        const idxs = [];
        for (let b = 0; b < n; ++b) {
          if (mask & (1 << b)) {
            sum += captureValue(tableCards[b]);
            idxs.push(b);
          }
        }
        if (sum === cardVal)
          results.push(idxs);
      }
    }

    return results;
  }

  function canCapture(card) {
    return findCaptureCombinations(captureValue(card), S.table).length > 0;
  }

  function selectedTableSum() {
    let sum = 0;
    for (const idx of S.selectedTableIdxs)
      sum += captureValue(S.table[idx]);
    return sum;
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function dealHands() {
    for (let i = 0; i < 3; ++i) {
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
        S._host.dealCardAnim(S.playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, S.playerHand.length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  function setupRound() {
    const d = CE.shuffle(createScopaDeck());
    S.playerHand = [];
    S.aiHand = [];
    S.table = [];
    S.stock = d;
    S.playerCaptures = [];
    S.aiCaptures = [];
    S.playerScopas = 0;
    S.aiScopas = 0;
    S.lastCapturer = -1;
    S.roundOver = false;
    S.roundBreakdown = null;
    S.selectedHandIdx = -1;
    S.selectedTableIdxs = [];
    S.hoverHandIdx = -1;
    S.hoverTableIdx = -1;
    S.aiTurnTimer = 0;
    S.dealTimer = 0;

    // Place 4 cards on the table
    for (let i = 0; i < 4; ++i) {
      const c = S.stock.pop();
      c.faceUp = true;
      S.table.push(c);
    }

    // Deal 3 to each
    dealHands();
    S.phase = PHASE_PLAY;
  }

  function performCapture(who, handCard, tableIdxs) {
    const captures = who === 0 ? S.playerCaptures : S.aiCaptures;
    const captured = [];

    // Remove table cards (descending order to preserve indices)
    const sorted = tableIdxs.slice().sort((a, b) => b - a);
    for (const idx of sorted)
      captured.push(S.table.splice(idx, 1)[0]);

    captures.push(handCard);
    for (const c of captured)
      captures.push(c);

    // Check scopa (cleared entire table)
    if (S.table.length === 0) {
      if (who === 0) {
        ++S.playerScopas;
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'SCOPA!', { color: '#ff0', size: 28 });
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 20);
        }
      } else {
        ++S.aiScopas;
        if (S._host)
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Scopa!', { color: '#fa0', size: 22 });
      }
    }

    S.lastCapturer = who;
  }

  function playCardToTable(who, card) {
    card.faceUp = true;
    S.table.push(card);
  }

  function playerPlayCard(handIdx, tableIdxs) {
    const card = S.playerHand.splice(handIdx, 1)[0];

    if (tableIdxs.length > 0) {
      performCapture(0, card, tableIdxs);
      if (S._host) {
        const count = tableIdxs.length;
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 40, 'Captured ' + (count + 1) + ' cards', { color: '#8f8', size: 14 });
      }
    } else
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
        while (S.table.length > 0)
          captures.push(S.table.pop());
        // No scopa for this
      }
      endRound();
      return;
    }

    // Switch to AI turn
    if (S.phase === PHASE_PLAY || S.phase === PHASE_CAPTURE) {
      S.phase = PHASE_AI_TURN;
      S.aiTurnTimer = 0;
    }
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function countDiamonds(captures) {
    let n = 0;
    for (const c of captures)
      if (isDiamond(c)) ++n;
    return n;
  }

  function hasSetteBello(captures) {
    for (const c of captures)
      if (isSetteBello(c)) return true;
    return false;
  }

  function computePrimiera(captures) {
    // Best card per suit using primiera values
    const best = {};
    for (const c of captures) {
      const pv = primieraValue(c);
      if (!best[c.suit] || pv > best[c.suit])
        best[c.suit] = pv;
    }
    let sum = 0;
    let suitCount = 0;
    for (const suit of CE.SUITS) {
      if (best[suit]) {
        sum += best[suit];
        ++suitCount;
      }
    }
    // Need at least one card in each suit to count fully;
    // partial is still used for comparison
    return { sum, suitCount };
  }

  function scoreRound() {
    let pPts = 0;
    let aPts = 0;
    const details = { player: {}, ai: {} };

    // Most cards
    details.player.cards = S.playerCaptures.length;
    details.ai.cards = S.aiCaptures.length;
    if (S.playerCaptures.length > S.aiCaptures.length)
      ++pPts;
    else if (S.aiCaptures.length > S.playerCaptures.length)
      ++aPts;
    details.player.cardsWin = S.playerCaptures.length > S.aiCaptures.length;
    details.ai.cardsWin = S.aiCaptures.length > S.playerCaptures.length;

    // Most diamonds
    const pDiam = countDiamonds(S.playerCaptures);
    const aDiam = countDiamonds(S.aiCaptures);
    details.player.diamonds = pDiam;
    details.ai.diamonds = aDiam;
    if (pDiam > aDiam)
      ++pPts;
    else if (aDiam > pDiam)
      ++aPts;
    details.player.diamondsWin = pDiam > aDiam;
    details.ai.diamondsWin = aDiam > pDiam;

    // Sette Bello (7 of diamonds)
    const pSB = hasSetteBello(S.playerCaptures);
    const aSB = hasSetteBello(S.aiCaptures);
    if (pSB) ++pPts;
    if (aSB) ++aPts;
    details.player.setteBello = pSB;
    details.ai.setteBello = aSB;

    // Primiera
    const pPrim = computePrimiera(S.playerCaptures);
    const aPrim = computePrimiera(S.aiCaptures);
    details.player.primiera = pPrim.sum;
    details.ai.primiera = aPrim.sum;
    if (pPrim.sum > aPrim.sum)
      ++pPts;
    else if (aPrim.sum > pPrim.sum)
      ++aPts;
    details.player.primieraWin = pPrim.sum > aPrim.sum;
    details.ai.primieraWin = aPrim.sum > pPrim.sum;

    // Scopas
    pPts += S.playerScopas;
    aPts += S.aiScopas;
    details.player.scopas = S.playerScopas;
    details.ai.scopas = S.aiScopas;

    details.player.total = pPts;
    details.ai.total = aPts;
    return details;
  }

  function endRound() {
    S.roundOver = true;
    S.phase = PHASE_ROUND_OVER;
    ++S.roundNumber;

    S.roundBreakdown = scoreRound();

    S.cumulativePlayer += S.roundBreakdown.player.total;
    S.cumulativeAI += S.roundBreakdown.ai.total;

    S.score = S.cumulativePlayer * 10;
    if (S._host) S._host.onScoreChanged(S.score);

    if (S.cumulativePlayer >= WINNING_SCORE || S.cumulativeAI >= WINNING_SCORE) {
      S.gameOver = true;
      if (S.cumulativePlayer >= WINNING_SCORE && S.cumulativePlayer > S.cumulativeAI) {
        if (S._host) {
          S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'YOU WIN!', { color: '#4f4', size: 28 });
          S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          S._host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
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

  V.captureValue = captureValue;
  V.isDiamond = isDiamond;
  V.isSetteBello = isSetteBello;
  V.findCaptureCombinations = findCaptureCombinations;
  V.canCapture = canCapture;
  V.selectedTableSum = selectedTableSum;
  V.setupRound = setupRound;
  V.performCapture = performCapture;
  V.playCardToTable = playCardToTable;
  V.playerPlayCard = playerPlayCard;
  V.afterTurn = afterTurn;

})();
