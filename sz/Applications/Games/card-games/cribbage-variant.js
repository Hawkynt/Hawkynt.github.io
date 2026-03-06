;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const WINNING_SCORE = 121;
  const HAND_DEAL = 6;
  const HAND_SIZE = 4;
  const PEG_MAX = 31;

  const CARD_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 };
  const RANK_ORDER = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };

  /* ── Phases ── */
  const PHASE_DISCARD = 0;
  const PHASE_CUT = 1;
  const PHASE_PEGGING = 2;
  const PHASE_SHOW = 3;
  const PHASE_CRIB_SHOW = 4;
  const PHASE_ROUND_OVER = 5;

  const PHASE_NAMES = ['Discard to Crib', 'Cut', 'Pegging', 'Show', 'Crib', 'Round Over'];

  /* ── Layout ── */
  const BOARD_X = 680;
  const BOARD_Y = 30;
  const BOARD_W = 200;
  const BOARD_H = 540;

  const HAND_Y = 470;
  const AI_HAND_Y = 30;
  const CENTER_Y = 240;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let playerKeep = [];
  let aiKeep = [];
  let crib = [];
  let starter = null;
  let deck = [];

  let playerScore = 0;
  let aiScore = 0;
  let playerPrevScore = 0;
  let aiPrevScore = 0;
  let dealerIsPlayer = false;

  let phase = PHASE_DISCARD;
  let selectedIndices = [];
  let roundOver = false;
  let gameOver = false;
  let score = 0;
  let resultMsg = '';

  /* ── Pegging state ── */
  let pegCards = [];
  let pegCount = 0;
  let playerPegHand = [];
  let aiPegHand = [];
  let playerSaidGo = false;
  let aiSaidGo = false;
  let currentPegger = 0; // 0=player, 1=AI
  let pegMsg = '';
  let waitingForGo = false;

  /* ── Show state ── */
  let showBreakdown = [];
  let showPhaseIdx = 0; // 0=non-dealer, 1=dealer, 2=crib

  /* ── AI timing ── */
  let aiTimer = 0;
  const AI_DELAY = 0.8;
  let pendingAiAction = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  let hoverCardIdx = -1;

  /* ── Button areas ── */
  const DISCARD_BTN = { x: 280, y: 420, w: 100, h: 30 };
  const CONTINUE_BTN = { x: 280, y: 380, w: 100, h: 30 };

  /* ================================================================
   *  CARD UTILITIES
   * ================================================================ */

  function cardValue(card) {
    return CARD_VALUES[card.rank];
  }

  function rankOrder(card) {
    return RANK_ORDER[card.rank];
  }

  function sortHand(hand) {
    hand.sort((a, b) => rankOrder(a) - rankOrder(b));
  }

  /* ================================================================
   *  SCORING - FIFTEENS
   * ================================================================ */

  function countFifteens(cards) {
    let count = 0;
    const n = cards.length;
    for (let mask = 1; mask < (1 << n); ++mask) {
      let sum = 0;
      for (let i = 0; i < n; ++i)
        if (mask & (1 << i))
          sum += cardValue(cards[i]);
      if (sum === 15)
        ++count;
    }
    return count * 2;
  }

  /* ================================================================
   *  SCORING - PAIRS
   * ================================================================ */

  function countPairs(cards) {
    let pts = 0;
    for (let i = 0; i < cards.length; ++i)
      for (let j = i + 1; j < cards.length; ++j)
        if (cards[i].rank === cards[j].rank)
          pts += 2;
    return pts;
  }

  /* ================================================================
   *  SCORING - RUNS
   * ================================================================ */

  function countRuns(cards) {
    const orders = cards.map(c => rankOrder(c)).sort((a, b) => a - b);
    let pts = 0;
    let bestLen = 0;
    let bestCount = 0;

    // Find all runs of length 3+, accounting for duplicates
    // Use frequency-based approach
    const freq = {};
    for (const o of orders)
      freq[o] = (freq[o] || 0) + 1;

    const unique = [...new Set(orders)].sort((a, b) => a - b);

    // Find consecutive sequences among unique values
    let i = 0;
    while (i < unique.length) {
      let j = i;
      while (j < unique.length - 1 && unique[j + 1] === unique[j] + 1)
        ++j;
      const runLen = j - i + 1;
      if (runLen >= 3) {
        // Multiply by frequencies of each rank in the run
        let multiplier = 1;
        for (let k = i; k <= j; ++k)
          multiplier *= freq[unique[k]];
        const runPts = runLen * multiplier;
        if (runLen > bestLen) {
          bestLen = runLen;
          bestCount = runPts;
        } else if (runLen === bestLen)
          bestCount += runPts;
      }
      i = j + 1;
    }
    pts = bestCount;
    return pts;
  }

  /* ================================================================
   *  SCORING - FLUSH
   * ================================================================ */

  function countFlush(hand, starter, isCrib) {
    if (hand.length < 4)
      return 0;
    const suit = hand[0].suit;
    const allSame = hand.every(c => c.suit === suit);
    if (!allSame)
      return 0;
    if (isCrib) {
      // Crib flush requires all 5 same suit
      if (starter && starter.suit === suit)
        return 5;
      return 0;
    }
    if (starter && starter.suit === suit)
      return 5;
    return 4;
  }

  /* ================================================================
   *  SCORING - NOBS
   * ================================================================ */

  function countNobs(hand, starter) {
    if (!starter)
      return 0;
    for (const c of hand)
      if (c.rank === 'J' && c.suit === starter.suit)
        return 1;
    return 0;
  }

  /* ================================================================
   *  SCORING - TOTAL HAND SCORE
   * ================================================================ */

  function scoreHand(hand, starter, isCrib) {
    const cards = starter ? hand.concat(starter) : hand.slice();
    const fifteens = countFifteens(cards);
    const pairs = countPairs(cards);
    const runs = countRuns(cards);
    const flush = countFlush(hand, starter, isCrib);
    const nobs = countNobs(hand, starter);
    const total = fifteens + pairs + runs + flush + nobs;
    return {
      fifteens, pairs, runs, flush, nobs, total,
      breakdown: [
        fifteens > 0 ? 'Fifteens: ' + fifteens : null,
        pairs > 0 ? 'Pairs: ' + pairs : null,
        runs > 0 ? 'Runs: ' + runs : null,
        flush > 0 ? 'Flush: ' + flush : null,
        nobs > 0 ? 'Nobs: ' + nobs : null
      ].filter(Boolean)
    };
  }

  /* ================================================================
   *  PEGGING - SCORING
   * ================================================================ */

  function scorePegPlay(playedCards, newCard) {
    let pts = 0;
    const all = playedCards.concat(newCard);
    let sum = 0;
    for (const c of all)
      sum += cardValue(c);

    // Fifteen
    if (sum === 15)
      pts += 2;
    // Thirty-one
    if (sum === 31)
      pts += 2;

    // Pairs from the end
    const n = all.length;
    if (n >= 2) {
      let pairCount = 0;
      for (let i = n - 2; i >= 0; --i) {
        if (all[i].rank === newCard.rank)
          ++pairCount;
        else
          break;
      }
      if (pairCount === 1) pts += 2;       // pair
      else if (pairCount === 2) pts += 6;   // three of a kind
      else if (pairCount === 3) pts += 12;  // four of a kind
    }

    // Runs from the end (check if last 3,4,5... cards form a run)
    if (n >= 3) {
      let bestRun = 0;
      for (let len = n; len >= 3; --len) {
        const tail = all.slice(n - len);
        const orders = tail.map(c => rankOrder(c)).sort((a, b) => a - b);
        let isRun = true;
        for (let k = 1; k < orders.length; ++k) {
          if (orders[k] !== orders[k - 1] + 1) {
            isRun = false;
            break;
          }
        }
        if (isRun) {
          bestRun = len;
          break;
        }
      }
      if (bestRun >= 3)
        pts += bestRun;
    }

    return pts;
  }

  function canPlayPeg(hand) {
    for (const c of hand)
      if (pegCount + cardValue(c) <= PEG_MAX)
        return true;
    return false;
  }

  /* ================================================================
   *  AI LOGIC - DISCARD
   * ================================================================ */

  function aiChooseDiscards() {
    // Try all combinations of 2 cards to discard, keep best 4
    let bestScore = -1;
    let bestDiscards = [0, 1];
    const n = aiHand.length;
    for (let i = 0; i < n; ++i) {
      for (let j = i + 1; j < n; ++j) {
        const keep = aiHand.filter((_, idx) => idx !== i && idx !== j);
        // Estimate hand value without starter (just structure)
        const est = scoreHand(keep, null, false).total;
        if (est > bestScore) {
          bestScore = est;
          bestDiscards = [i, j];
        }
      }
    }
    return bestDiscards;
  }

  /* ================================================================
   *  AI LOGIC - PEGGING
   * ================================================================ */

  function aiChoosePegCard() {
    // Prefer: reach 15, reach 31, pair, extend run, then lowest value
    let bestIdx = -1;
    let bestPts = -1;
    let bestVal = 999;

    for (let i = 0; i < aiPegHand.length; ++i) {
      const c = aiPegHand[i];
      if (pegCount + cardValue(c) > PEG_MAX)
        continue;
      const pts = scorePegPlay(pegCards, c);
      const val = cardValue(c);
      if (pts > bestPts || (pts === bestPts && val < bestVal)) {
        bestPts = pts;
        bestIdx = i;
        bestVal = val;
      }
    }

    // If no scoring play, pick card least likely to help opponent
    if (bestIdx < 0)
      return -1;
    if (bestPts === 0) {
      // Play highest card that doesn't set up opponent for 15 or 31
      let safeIdx = -1;
      let safeVal = -1;
      for (let i = 0; i < aiPegHand.length; ++i) {
        const c = aiPegHand[i];
        if (pegCount + cardValue(c) > PEG_MAX)
          continue;
        const newTotal = pegCount + cardValue(c);
        // Avoid leaving 5 or 21 (opponent can reach 15 or hit 31 easily)
        const dangerous = (newTotal === 5 || newTotal === 21);
        const v = cardValue(c);
        if (!dangerous && v > safeVal) {
          safeVal = v;
          safeIdx = i;
        }
      }
      if (safeIdx >= 0)
        return safeIdx;
    }
    return bestIdx;
  }

  /* ================================================================
   *  SCORE ADVANCEMENT
   * ================================================================ */

  function addPlayerScore(pts) {
    if (pts <= 0 || gameOver)
      return;
    playerPrevScore = playerScore;
    playerScore += pts;
    score = playerScore;
    if (_host) _host.onScoreChanged(score);
    if (playerScore >= WINNING_SCORE) {
      playerScore = WINNING_SCORE;
      gameOver = true;
      roundOver = true;
      resultMsg = 'You win! ' + playerScore + ' - ' + aiScore;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
        _host.particles.confetti(CANVAS_W / 2, 300, 40);
      }
    }
  }

  function addAiScore(pts) {
    if (pts <= 0 || gameOver)
      return;
    aiPrevScore = aiScore;
    aiScore += pts;
    if (aiScore >= WINNING_SCORE) {
      aiScore = WINNING_SCORE;
      gameOver = true;
      roundOver = true;
      resultMsg = 'AI wins! ' + aiScore + ' - ' + playerScore;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }
  }

  /* ================================================================
   *  DEAL A NEW ROUND
   * ================================================================ */

  function dealRound() {
    deck = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHand = [];
    playerKeep = [];
    aiKeep = [];
    crib = [];
    starter = null;
    selectedIndices = [];
    pegCards = [];
    pegCount = 0;
    playerPegHand = [];
    aiPegHand = [];
    playerSaidGo = false;
    aiSaidGo = false;
    pegMsg = '';
    waitingForGo = false;
    showBreakdown = [];
    showPhaseIdx = 0;
    roundOver = false;
    resultMsg = '';
    pendingAiAction = false;
    aiTimer = 0;
    hoverCardIdx = -1;

    // Deal 6 cards each
    for (let i = 0; i < HAND_DEAL; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      const ac = deck.pop();
      ac.faceUp = false;
      aiHand.push(ac);
    }

    sortHand(playerHand);
    phase = PHASE_DISCARD;

    // AI discards immediately (hidden)
    const aiDisc = aiChooseDiscards();
    aiDisc.sort((a, b) => b - a);
    for (const idx of aiDisc) {
      const c = aiHand.splice(idx, 1)[0];
      crib.push(c);
    }
    aiKeep = aiHand.slice();
  }

  /* ================================================================
   *  PHASE TRANSITIONS
   * ================================================================ */

  function startCut() {
    phase = PHASE_CUT;
    starter = deck.pop();
    starter.faceUp = true;
    // His Heels: if starter is a Jack, dealer gets 2
    if (starter.rank === 'J') {
      if (dealerIsPlayer) {
        addPlayerScore(2);
        pegMsg = 'His Heels! You get 2 points.';
        if (_host) _host.floatingText.add(400, CENTER_Y, '+2 Heels', { color: '#ff0', size: 20 });
      } else {
        addAiScore(2);
        pegMsg = 'His Heels! AI gets 2 points.';
        if (_host) _host.floatingText.add(400, CENTER_Y, '+2 Heels', { color: '#f84', size: 20 });
      }
    }
    if (!gameOver) {
      pendingAiAction = true;
      aiTimer = 0;
    }
  }

  function startPegging() {
    phase = PHASE_PEGGING;
    playerPegHand = playerKeep.slice();
    aiPegHand = aiKeep.slice();
    for (const c of playerPegHand) c.faceUp = true;
    for (const c of aiPegHand) c.faceUp = true;
    pegCards = [];
    pegCount = 0;
    playerSaidGo = false;
    aiSaidGo = false;
    pegMsg = '';
    waitingForGo = false;
    pendingAiAction = false;
    // Non-dealer plays first
    currentPegger = dealerIsPlayer ? 1 : 0;
    if (currentPegger === 1) {
      pendingAiAction = true;
      aiTimer = 0;
    }
  }

  function resetPegRound() {
    pegCards = [];
    pegCount = 0;
    playerSaidGo = false;
    aiSaidGo = false;
    waitingForGo = false;
    pegMsg = '';
  }

  function startShow() {
    phase = PHASE_SHOW;
    showBreakdown = [];
    showPhaseIdx = 0;

    // Non-dealer shows first, then dealer, then crib
    const nonDealerHand = dealerIsPlayer ? aiKeep : playerKeep;
    const dealerHand = dealerIsPlayer ? playerKeep : aiKeep;

    const ndScore = scoreHand(nonDealerHand, starter, false);
    const dScore = scoreHand(dealerHand, starter, false);
    const cScore = scoreHand(crib, starter, true);

    showBreakdown.push({
      label: dealerIsPlayer ? 'AI Hand' : 'Your Hand',
      hand: nonDealerHand,
      result: ndScore,
      isPlayer: !dealerIsPlayer
    });
    showBreakdown.push({
      label: dealerIsPlayer ? 'Your Hand' : 'AI Hand',
      hand: dealerHand,
      result: dScore,
      isPlayer: dealerIsPlayer
    });
    showBreakdown.push({
      label: (dealerIsPlayer ? 'Your' : 'AI') + ' Crib',
      hand: crib,
      result: cScore,
      isPlayer: dealerIsPlayer
    });

    // Score non-dealer hand immediately
    applyShowScore(0);
  }

  function applyShowScore(idx) {
    if (idx >= showBreakdown.length || gameOver)
      return;
    const entry = showBreakdown[idx];
    const pts = entry.result.total;
    if (entry.isPlayer)
      addPlayerScore(pts);
    else
      addAiScore(pts);
    if (pts > 0 && _host) {
      const yPos = 200 + idx * 30;
      const col = entry.isPlayer ? '#4f4' : '#f84';
      _host.floatingText.add(400, yPos, '+' + pts, { color: col, size: 20 });
    }
  }

  function finishRound() {
    phase = PHASE_ROUND_OVER;
    roundOver = true;
    dealerIsPlayer = !dealerIsPlayer;
    if (!gameOver)
      resultMsg = 'Round complete. Click Continue.';
  }

  /* ================================================================
   *  PEGGING - PLAY CARD
   * ================================================================ */

  function playPegCard(isPlayer, cardIdx) {
    const hand = isPlayer ? playerPegHand : aiPegHand;
    const card = hand.splice(cardIdx, 1)[0];
    card.faceUp = true;
    pegCards.push(card);
    pegCount += cardValue(card);

    const pts = scorePegPlay(pegCards.slice(0, -1), card);
    if (pts > 0) {
      if (isPlayer) {
        addPlayerScore(pts);
        pegMsg = 'You score ' + pts + '!';
        if (_host) _host.floatingText.add(350, CENTER_Y + 30, '+' + pts, { color: '#4f4', size: 18 });
      } else {
        addAiScore(pts);
        pegMsg = 'AI scores ' + pts + '!';
        if (_host) _host.floatingText.add(350, CENTER_Y + 30, '+' + pts, { color: '#f84', size: 18 });
      }
    } else
      pegMsg = (isPlayer ? 'You' : 'AI') + ' played ' + card.rank + ' (' + pegCount + ')';

    if (gameOver)
      return;

    // Reset at 31
    if (pegCount === 31) {
      resetPegRound();
      checkPeggingEnd();
      return;
    }

    // Check if both players are stuck
    playerSaidGo = !canPlayPeg(playerPegHand);
    aiSaidGo = !canPlayPeg(aiPegHand);

    if (playerSaidGo && aiSaidGo) {
      // Last card bonus
      const lastPlayer = isPlayer;
      if (pegCount < 31) {
        if (lastPlayer)
          addPlayerScore(1);
        else
          addAiScore(1);
        pegMsg += ' Go! +1';
      }
      resetPegRound();
      checkPeggingEnd();
      return;
    }

    // Switch turn
    if (isPlayer) {
      if (!aiSaidGo) {
        currentPegger = 1;
        pendingAiAction = true;
        aiTimer = 0;
      } else {
        pegMsg = 'AI says Go';
        currentPegger = 0;
      }
    } else {
      if (!playerSaidGo) {
        currentPegger = 0;
        pendingAiAction = false;
      } else {
        pegMsg = 'You say Go';
        currentPegger = 1;
        pendingAiAction = true;
        aiTimer = 0;
      }
    }
  }

  function checkPeggingEnd() {
    if (gameOver)
      return;
    if (playerPegHand.length === 0 && aiPegHand.length === 0) {
      // Pegging done; proceed to show
      pendingAiAction = true;
      aiTimer = 0;
      return;
    }
    // Determine who goes next
    if (playerPegHand.length > 0 && aiPegHand.length > 0) {
      currentPegger = dealerIsPlayer ? 1 : 0;
    } else if (playerPegHand.length > 0)
      currentPegger = 0;
    else {
      currentPegger = 1;
      pendingAiAction = true;
      aiTimer = 0;
    }
    if (currentPegger === 1) {
      pendingAiAction = true;
      aiTimer = 0;
    }
  }

  /* ================================================================
   *  DRAWING - PEGGING BOARD
   * ================================================================ */

  function drawBoard(cx) {
    // Board background
    cx.fillStyle = '#5c3a1e';
    CE.drawRoundedRect(cx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 8);
    cx.fill();
    cx.strokeStyle = '#8b6914';
    cx.lineWidth = 2;
    CE.drawRoundedRect(cx, BOARD_X, BOARD_Y, BOARD_W, BOARD_H, 8);
    cx.stroke();

    // Title
    cx.fillStyle = '#ffd700';
    cx.font = 'bold 14px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Cribbage Board', BOARD_X + BOARD_W / 2, BOARD_Y + 18);

    // Draw two tracks side by side
    const trackW = 70;
    const trackStartX = BOARD_X + 25;
    const trackStartY = BOARD_Y + 35;
    const trackH = BOARD_H - 70;
    const holesPerCol = 30;
    const cols = 4; // 4 columns of 30 = 120 + finish hole
    const holeSpacing = trackH / (holesPerCol + 1);
    const colSpacing = trackW / (cols + 1);

    // Labels
    cx.fillStyle = '#ddd';
    cx.font = '10px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('You', trackStartX + trackW / 2, trackStartY - 2);
    cx.fillText('AI', trackStartX + trackW + 30 + trackW / 2, trackStartY - 2);

    for (let track = 0; track < 2; ++track) {
      const baseX = trackStartX + track * (trackW + 30);
      const score_ = track === 0 ? playerScore : aiScore;
      const prevScore_ = track === 0 ? playerPrevScore : aiPrevScore;
      const holeColor = track === 0 ? '#446' : '#644';
      const pegColor = track === 0 ? '#4af' : '#f44';
      const pegPrevColor = track === 0 ? '#28a' : '#a22';

      // Draw holes
      for (let hole = 0; hole <= 120; ++hole) {
        const pos = holePosition(baseX, trackStartY, hole, holesPerCol, holeSpacing, colSpacing);
        cx.beginPath();
        cx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        cx.fillStyle = holeColor;
        cx.fill();
      }

      // Finish hole
      const finPos = holePosition(baseX, trackStartY, 120, holesPerCol, holeSpacing, colSpacing);
      cx.beginPath();
      cx.arc(finPos.x, finPos.y + holeSpacing, 4, 0, Math.PI * 2);
      cx.fillStyle = '#ffd700';
      cx.fill();
      cx.fillStyle = '#888';
      cx.font = '8px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('121', finPos.x, finPos.y + holeSpacing + 12);

      // Draw back peg (previous score)
      if (prevScore_ > 0 && prevScore_ < WINNING_SCORE) {
        const pp = holePosition(baseX, trackStartY, Math.min(prevScore_ - 1, 119), holesPerCol, holeSpacing, colSpacing);
        cx.beginPath();
        cx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
        cx.fillStyle = pegPrevColor;
        cx.fill();
        cx.strokeStyle = '#fff';
        cx.lineWidth = 1;
        cx.stroke();
      }

      // Draw front peg (current score)
      const clampedScore = Math.min(score_, WINNING_SCORE);
      if (clampedScore > 0) {
        let pegPos;
        if (clampedScore >= WINNING_SCORE) {
          pegPos = { x: finPos.x, y: finPos.y + holeSpacing };
        } else
          pegPos = holePosition(baseX, trackStartY, clampedScore - 1, holesPerCol, holeSpacing, colSpacing);
        cx.beginPath();
        cx.arc(pegPos.x, pegPos.y, 5, 0, Math.PI * 2);
        cx.fillStyle = pegColor;
        cx.fill();
        cx.strokeStyle = '#fff';
        cx.lineWidth = 1.5;
        cx.stroke();
      }

      // Score text
      cx.fillStyle = pegColor;
      cx.font = 'bold 12px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('' + Math.min(score_, WINNING_SCORE), baseX + trackW / 2, BOARD_Y + BOARD_H - 15);
    }
  }

  function holePosition(baseX, baseY, holeIdx, perCol, vSpacing, hSpacing) {
    const col = Math.floor(holeIdx / perCol);
    const row = holeIdx % perCol;
    const goingDown = (col % 2) === 0;
    const x = baseX + (col + 1) * hSpacing;
    const y = goingDown
      ? baseY + (row + 1) * vSpacing
      : baseY + (perCol - row) * vSpacing;
    return { x, y };
  }

  /* ================================================================
   *  DRAWING - MAIN
   * ================================================================ */

  function drawGame(cx) {
    // Phase indicator
    cx.fillStyle = '#ffd700';
    cx.font = 'bold 14px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('Phase: ' + PHASE_NAMES[phase], 15, 20);

    // Dealer indicator
    cx.fillStyle = '#aaa';
    cx.font = '12px sans-serif';
    cx.fillText('Dealer: ' + (dealerIsPlayer ? 'You' : 'AI'), 15, 38);

    // Scores
    cx.fillStyle = '#4af';
    cx.font = 'bold 13px sans-serif';
    cx.fillText('You: ' + playerScore + '/' + WINNING_SCORE, 15, 58);
    cx.fillStyle = '#f66';
    cx.fillText('AI: ' + aiScore + '/' + WINNING_SCORE, 15, 76);

    // Board
    drawBoard(cx);

    if (phase === PHASE_DISCARD)
      drawDiscardPhase(cx);
    else if (phase === PHASE_CUT)
      drawCutPhase(cx);
    else if (phase === PHASE_PEGGING)
      drawPeggingPhase(cx);
    else if (phase === PHASE_SHOW || phase === PHASE_CRIB_SHOW)
      drawShowPhase(cx);
    else if (phase === PHASE_ROUND_OVER)
      drawRoundOver(cx);

    // Result message
    if (resultMsg) {
      cx.fillStyle = '#ff0';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(resultMsg, 330, CANVAS_H - 12);
    }
  }

  /* ── Discard phase ── */
  function drawDiscardPhase(cx) {
    // AI hand (face down)
    cx.fillStyle = '#ddd';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('AI (' + aiKeep.length + ' kept, ' + crib.length + ' in crib)', 90, AI_HAND_Y + 10);
    for (let i = 0; i < aiKeep.length; ++i)
      CE.drawCardBack(cx, 90 + i * 35, AI_HAND_Y + 18, CE.CARD_W * 0.65, CE.CARD_H * 0.65);

    // Crib pile
    drawCribPile(cx);

    // Player hand
    cx.fillStyle = '#fff';
    cx.font = '13px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('Select 2 cards for the crib:', 90, HAND_Y - 18);

    const spacing = Math.min(75, (560 - 90) / Math.max(playerHand.length, 1));
    for (let i = 0; i < playerHand.length; ++i) {
      const sel = selectedIndices.includes(i);
      const x = 90 + i * spacing;
      const y = sel ? HAND_Y - 15 : HAND_Y;
      CE.drawCardFace(cx, x, y, playerHand[i]);
      if (sel) {
        cx.save();
        cx.strokeStyle = '#ff0';
        cx.lineWidth = 3;
        cx.shadowColor = '#ff0';
        cx.shadowBlur = 8;
        CE.drawRoundedRect(cx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        cx.stroke();
        cx.restore();
      }
      if (i === hoverCardIdx && !sel) {
        cx.save();
        cx.strokeStyle = 'rgba(255,255,255,0.5)';
        cx.lineWidth = 2;
        CE.drawRoundedRect(cx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        cx.stroke();
        cx.restore();
      }
    }

    // Discard button
    if (selectedIndices.length === 2)
      CE.drawButton(cx, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h, 'Discard', { bg: '#1a5a1a', border: '#4a4' });

    // Hint: highlight cards that form scoring combos
    if (_host && _host.hintsEnabled && selectedIndices.length < 2) {
      for (let i = 0; i < playerHand.length; ++i) {
        if (selectedIndices.includes(i))
          continue;
        const keep = playerHand.filter((_, idx) => idx !== i && !selectedIndices.includes(idx));
        if (keep.length === 4) {
          const est = scoreHand(keep, null, false).total;
          if (est >= 4) {
            const x = 90 + i * spacing;
            const y = HAND_Y;
            CE.drawHintGlow(cx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
          }
        }
      }
    }
  }

  /* ── Cut phase ── */
  function drawCutPhase(cx) {
    drawHandsBrief(cx);
    drawStarterCard(cx);
    cx.fillStyle = '#8f8';
    cx.font = '14px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Starter card revealed!', 330, CENTER_Y + 70);
    if (pegMsg) {
      cx.fillStyle = '#ff0';
      cx.fillText(pegMsg, 330, CENTER_Y + 90);
    }
  }

  /* ── Pegging phase ── */
  function drawPeggingPhase(cx) {
    // AI peg hand (face down for remaining)
    cx.fillStyle = '#ddd';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('AI (' + aiPegHand.length + ' cards left)', 90, AI_HAND_Y + 10);
    for (let i = 0; i < aiPegHand.length; ++i)
      CE.drawCardBack(cx, 90 + i * 35, AI_HAND_Y + 18, CE.CARD_W * 0.65, CE.CARD_H * 0.65);

    // Starter
    drawStarterCard(cx);

    // Crib pile
    drawCribPile(cx);

    // Played peg cards
    cx.fillStyle = '#fff';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.fillText('Count: ' + pegCount, 90, CENTER_Y - 12);

    for (let i = 0; i < pegCards.length; ++i) {
      const x = 90 + i * 40;
      const y = CENTER_Y;
      CE.drawCardFace(cx, x, y, pegCards[i], CE.CARD_W * 0.7, CE.CARD_H * 0.7);
    }

    // Running total bar
    const barX = 90;
    const barY = CENTER_Y + CE.CARD_H * 0.7 + 8;
    const barW = 400;
    const barH = 12;
    cx.fillStyle = '#333';
    CE.drawRoundedRect(cx, barX, barY, barW, barH, 4);
    cx.fill();
    const fillW = Math.min(barW, barW * (pegCount / PEG_MAX));
    if (fillW > 0) {
      cx.fillStyle = pegCount === 15 ? '#ff0' : pegCount >= 31 ? '#f44' : '#4a4';
      CE.drawRoundedRect(cx, barX, barY, fillW, barH, 4);
      cx.fill();
    }
    cx.fillStyle = '#fff';
    cx.font = '9px sans-serif';
    cx.textAlign = 'center';
    cx.fillText(pegCount + '/' + PEG_MAX, barX + barW / 2, barY + 9);

    // Peg message
    if (pegMsg) {
      cx.fillStyle = '#ff0';
      cx.font = '13px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(pegMsg, 330, CENTER_Y - 28);
    }

    // Turn indicator
    cx.fillStyle = currentPegger === 0 ? '#8f8' : '#ff8';
    cx.font = '13px sans-serif';
    cx.textAlign = 'center';
    const turnText = currentPegger === 0 ? 'Your turn — play a card' : 'AI is thinking...';
    cx.fillText(turnText, 330, HAND_Y - 25);

    // Player peg hand
    const spacing = Math.min(75, (560 - 90) / Math.max(playerPegHand.length, 1));
    for (let i = 0; i < playerPegHand.length; ++i) {
      const x = 90 + i * spacing;
      const playable = pegCount + cardValue(playerPegHand[i]) <= PEG_MAX;
      const y = (i === hoverCardIdx && playable) ? HAND_Y - 8 : HAND_Y;
      CE.drawCardFace(cx, x, y, playerPegHand[i]);
      if (!playable) {
        cx.fillStyle = 'rgba(0,0,0,0.5)';
        CE.drawRoundedRect(cx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        cx.fill();
      }
      if (_host && _host.hintsEnabled && playable && currentPegger === 0) {
        const pts = scorePegPlay(pegCards, playerPegHand[i]);
        if (pts > 0)
          CE.drawHintGlow(cx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }
    }

    // If player can't play, show Go message
    if (currentPegger === 0 && playerPegHand.length > 0 && !canPlayPeg(playerPegHand)) {
      cx.fillStyle = '#f84';
      cx.font = 'bold 14px sans-serif';
      cx.textAlign = 'center';
      cx.fillText('Cannot play — Go!', 330, HAND_Y - 8);
    }
  }

  /* ── Show phase ── */
  function drawShowPhase(cx) {
    drawStarterCard(cx);

    if (showPhaseIdx < showBreakdown.length) {
      const entry = showBreakdown[showPhaseIdx];
      cx.fillStyle = '#ffd700';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.fillText(entry.label + ' — ' + entry.result.total + ' points', 330, 110);

      // Draw the hand
      const startX = 150;
      for (let i = 0; i < entry.hand.length; ++i) {
        const c = entry.hand[i];
        c.faceUp = true;
        CE.drawCardFace(cx, startX + i * 80, 130, c);
      }

      // Starter next to hand
      if (starter) {
        cx.fillStyle = '#aaa';
        cx.font = '10px sans-serif';
        cx.textAlign = 'center';
        cx.fillText('Starter', startX + entry.hand.length * 80 + CE.CARD_W / 2 + 15, 125);
        CE.drawCardFace(cx, startX + entry.hand.length * 80 + 15, 130, starter);
      }

      // Breakdown
      let by = 240;
      cx.font = '13px sans-serif';
      cx.textAlign = 'left';
      for (const line of entry.result.breakdown) {
        cx.fillStyle = '#cfc';
        cx.fillText(line, 170, by);
        by += 18;
      }
      if (entry.result.total === 0) {
        cx.fillStyle = '#f88';
        cx.fillText('No points', 170, by);
      }

      // Continue
      CE.drawButton(cx, CONTINUE_BTN.x, CONTINUE_BTN.y, CONTINUE_BTN.w, CONTINUE_BTN.h, 'Continue', { bg: '#1a3a1a', border: '#4a4' });
    }
  }

  /* ── Round over ── */
  function drawRoundOver(cx) {
    cx.fillStyle = '#fff';
    cx.font = 'bold 18px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Round Complete', 330, 180);

    cx.font = '14px sans-serif';
    cx.fillStyle = '#4af';
    cx.fillText('You: ' + playerScore, 330, 210);
    cx.fillStyle = '#f66';
    cx.fillText('AI: ' + aiScore, 330, 230);

    if (!gameOver)
      CE.drawButton(cx, CONTINUE_BTN.x, 260, CONTINUE_BTN.w, CONTINUE_BTN.h, 'Next Round', { bg: '#1a3a1a', border: '#4a4' });
    else {
      cx.fillStyle = '#ffd700';
      cx.font = 'bold 20px sans-serif';
      cx.fillText(resultMsg, 330, 280);
      CE.drawButton(cx, CONTINUE_BTN.x, 310, CONTINUE_BTN.w, CONTINUE_BTN.h, 'New Game', { bg: '#5a1a1a', border: '#a44' });
    }
  }

  /* ── Helpers ── */
  function drawStarterCard(cx) {
    if (!starter)
      return;
    const sx = 560;
    const sy = CENTER_Y - 20;
    cx.fillStyle = '#aaa';
    cx.font = '11px sans-serif';
    cx.textAlign = 'center';
    cx.fillText('Starter', sx + CE.CARD_W / 2, sy - 6);
    CE.drawCardFace(cx, sx, sy, starter);
  }

  function drawCribPile(cx) {
    const cx_ = 560;
    const cy_ = CENTER_Y + CE.CARD_H + 10;
    cx.fillStyle = '#aaa';
    cx.font = '11px sans-serif';
    cx.textAlign = 'center';
    cx.fillText((dealerIsPlayer ? 'Your' : 'AI') + ' Crib', cx_ + CE.CARD_W / 2, cy_ - 6);
    if (crib.length > 0) {
      if (phase === PHASE_SHOW || phase === PHASE_CRIB_SHOW || phase === PHASE_ROUND_OVER) {
        for (let i = 0; i < Math.min(crib.length, 2); ++i)
          CE.drawCardBack(cx, cx_ + i * 4, cy_ + i * 2);
      } else
        CE.drawCardBack(cx, cx_, cy_);
    } else
      CE.drawEmptySlot(cx, cx_, cy_, 'Crib');
  }

  function drawHandsBrief(cx) {
    // AI hand (backs)
    for (let i = 0; i < aiKeep.length; ++i)
      CE.drawCardBack(cx, 90 + i * 35, AI_HAND_Y + 18, CE.CARD_W * 0.65, CE.CARD_H * 0.65);

    // Player hand
    const spacing = Math.min(75, (560 - 90) / Math.max(playerKeep.length, 1));
    for (let i = 0; i < playerKeep.length; ++i)
      CE.drawCardFace(cx, 90 + i * spacing, HAND_Y, playerKeep[i]);
  }

  /* ================================================================
   *  CLICK HANDLING
   * ================================================================ */

  function handleGameClick(mx, my) {
    if (gameOver) {
      if (phase === PHASE_ROUND_OVER && CE.isInRect(mx, my, CONTINUE_BTN.x, 310, CONTINUE_BTN.w, CONTINUE_BTN.h)) {
        // New game
        playerScore = 0;
        aiScore = 0;
        playerPrevScore = 0;
        aiPrevScore = 0;
        score = 0;
        gameOver = false;
        dealerIsPlayer = false;
        if (_host) _host.onScoreChanged(score);
        dealRound();
      }
      return;
    }

    if (phase === PHASE_DISCARD) {
      // Check discard button
      if (selectedIndices.length === 2 && CE.isInRect(mx, my, DISCARD_BTN.x, DISCARD_BTN.y, DISCARD_BTN.w, DISCARD_BTN.h)) {
        doPlayerDiscard();
        return;
      }
      // Check card selection
      const spacing = Math.min(75, (560 - 90) / Math.max(playerHand.length, 1));
      for (let i = playerHand.length - 1; i >= 0; --i) {
        const x = 90 + i * spacing;
        const sel = selectedIndices.includes(i);
        const y = sel ? HAND_Y - 15 : HAND_Y;
        if (CE.isInRect(mx, my, x, y, CE.CARD_W, CE.CARD_H)) {
          if (sel)
            selectedIndices = selectedIndices.filter(idx => idx !== i);
          else if (selectedIndices.length < 2)
            selectedIndices.push(i);
          return;
        }
      }
      return;
    }

    if (phase === PHASE_PEGGING && currentPegger === 0) {
      // Player can't play — auto-go
      if (playerPegHand.length > 0 && !canPlayPeg(playerPegHand)) {
        playerSaidGo = true;
        pegMsg = 'You say Go';
        if (aiPegHand.length > 0 && canPlayPeg(aiPegHand)) {
          currentPegger = 1;
          pendingAiAction = true;
          aiTimer = 0;
        } else {
          // Both stuck, last card
          addAiScore(0); // no points for "go" if nobody played
          if (pegCount < 31 && pegCards.length > 0) {
            // Last card point
            addPlayerScore(1);
            pegMsg += ' +1 last card';
          }
          resetPegRound();
          checkPeggingEnd();
        }
        return;
      }
      // Check card click
      const spacing = Math.min(75, (560 - 90) / Math.max(playerPegHand.length, 1));
      for (let i = playerPegHand.length - 1; i >= 0; --i) {
        const x = 90 + i * spacing;
        const playable = pegCount + cardValue(playerPegHand[i]) <= PEG_MAX;
        const y = HAND_Y;
        if (CE.isInRect(mx, my, x, y, CE.CARD_W, CE.CARD_H) && playable) {
          playPegCard(true, i);
          return;
        }
      }
      return;
    }

    if (phase === PHASE_SHOW || phase === PHASE_CRIB_SHOW) {
      if (CE.isInRect(mx, my, CONTINUE_BTN.x, CONTINUE_BTN.y, CONTINUE_BTN.w, CONTINUE_BTN.h)) {
        ++showPhaseIdx;
        if (showPhaseIdx < showBreakdown.length) {
          applyShowScore(showPhaseIdx);
          if (showPhaseIdx === showBreakdown.length - 1)
            phase = PHASE_CRIB_SHOW;
        } else
          finishRound();
      }
      return;
    }

    if (phase === PHASE_ROUND_OVER) {
      const btnY = gameOver ? 310 : 260;
      if (CE.isInRect(mx, my, CONTINUE_BTN.x, btnY, CONTINUE_BTN.w, CONTINUE_BTN.h)) {
        if (gameOver) {
          playerScore = 0;
          aiScore = 0;
          playerPrevScore = 0;
          aiPrevScore = 0;
          score = 0;
          gameOver = false;
          dealerIsPlayer = false;
          if (_host) _host.onScoreChanged(score);
        }
        dealRound();
      }
      return;
    }
  }

  /* ================================================================
   *  PLAYER DISCARD ACTION
   * ================================================================ */

  function doPlayerDiscard() {
    if (selectedIndices.length !== 2)
      return;
    selectedIndices.sort((a, b) => b - a);
    for (const idx of selectedIndices) {
      const c = playerHand.splice(idx, 1)[0];
      crib.push(c);
    }
    playerKeep = playerHand.slice();
    selectedIndices = [];
    sortHand(playerKeep);
    startCut();
  }

  /* ================================================================
   *  AI TICK
   * ================================================================ */

  function aiTick(dt) {
    if (!pendingAiAction)
      return;
    aiTimer += dt;
    if (aiTimer < AI_DELAY)
      return;
    pendingAiAction = false;
    aiTimer = 0;

    if (phase === PHASE_CUT) {
      startPegging();
      return;
    }

    if (phase === PHASE_PEGGING) {
      // Check if pegging is done
      if (playerPegHand.length === 0 && aiPegHand.length === 0) {
        startShow();
        return;
      }

      if (currentPegger !== 1)
        return;

      if (!canPlayPeg(aiPegHand)) {
        aiSaidGo = true;
        pegMsg = 'AI says Go';
        if (playerPegHand.length > 0 && canPlayPeg(playerPegHand)) {
          currentPegger = 0;
        } else {
          // Both stuck
          if (pegCount < 31 && pegCards.length > 0) {
            addAiScore(1);
            pegMsg += ' +1 last card';
          }
          resetPegRound();
          checkPeggingEnd();
        }
        return;
      }

      const cardIdx = aiChoosePegCard();
      if (cardIdx >= 0)
        playPegCard(false, cardIdx);
      return;
    }
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      playerScore = score;
      aiScore = 0;
      playerPrevScore = 0;
      aiPrevScore = 0;
      gameOver = false;
      roundOver = false;
      dealerIsPlayer = false;
      dealRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGame(ctx);
    },

    handleClick(mx, my) {
      handleGameClick(mx, my);
    },

    handlePointerMove(mx, my) {
      hoverCardIdx = -1;
      if (phase === PHASE_DISCARD) {
        const spacing = Math.min(75, (560 - 90) / Math.max(playerHand.length, 1));
        for (let i = playerHand.length - 1; i >= 0; --i) {
          const x = 90 + i * spacing;
          const sel = selectedIndices.includes(i);
          const y = sel ? HAND_Y - 15 : HAND_Y;
          if (CE.isInRect(mx, my, x, y, CE.CARD_W, CE.CARD_H)) {
            hoverCardIdx = i;
            break;
          }
        }
      } else if (phase === PHASE_PEGGING && currentPegger === 0) {
        const spacing = Math.min(75, (560 - 90) / Math.max(playerPegHand.length, 1));
        for (let i = playerPegHand.length - 1; i >= 0; --i) {
          const x = 90 + i * spacing;
          if (CE.isInRect(mx, my, x, HAND_Y, CE.CARD_W, CE.CARD_H)) {
            hoverCardIdx = i;
            break;
          }
        }
      }
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        playerScore = 0;
        aiScore = 0;
        playerPrevScore = 0;
        aiPrevScore = 0;
        score = 0;
        gameOver = false;
        dealerIsPlayer = false;
        if (_host) _host.onScoreChanged(score);
        dealRound();
      }
      if (phase === PHASE_DISCARD && (e.key === 'Enter' || e.key === 'd' || e.key === 'D')) {
        if (selectedIndices.length === 2)
          doPlayerDiscard();
      }
    },

    tick(dt) {
      aiTick(dt);
    },

    cleanup() {
      playerHand = [];
      aiHand = [];
      playerKeep = [];
      aiKeep = [];
      crib = [];
      starter = null;
      deck = [];
      pegCards = [];
      playerPegHand = [];
      aiPegHand = [];
      showBreakdown = [];
      selectedIndices = [];
      roundOver = false;
      gameOver = false;
      phase = PHASE_DISCARD;
      resultMsg = '';
      pegMsg = '';
      pendingAiAction = false;
      aiTimer = 0;
      hoverCardIdx = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; playerScore = s; }
  };

  SZ.CardGames.registerVariant('cribbage', module);

})();
