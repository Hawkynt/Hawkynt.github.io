;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
     CONSTANTS
     ================================================================ */

  const NUM_PLAYERS = 4;
  const STARTING_CHIPS = 1000;
  const SMALL_BLIND = 10;
  const BIG_BLIND = 20;
  const BLUFF_CHANCE = 0.15;

  const PLAYER_NAMES = ['You', 'Left', 'Top', 'Right'];

  const RANK_VALUE = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
    '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  const HAND_RANKS = {
    HIGH_CARD: 0, PAIR: 1, TWO_PAIR: 2, THREE_KIND: 3,
    STRAIGHT: 4, FLUSH: 5, FULL_HOUSE: 6, FOUR_KIND: 7,
    STRAIGHT_FLUSH: 8, ROYAL_FLUSH: 9
  };

  const HAND_NAMES = [
    'High Card', 'Pair', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind',
    'Straight Flush', 'Royal Flush'
  ];

  /* ── Phases ── */
  const PHASE_PREFLOP = 0;
  const PHASE_FLOP = 1;
  const PHASE_TURN = 2;
  const PHASE_RIVER = 3;
  const PHASE_SHOWDOWN = 4;
  const PHASE_ROUND_OVER = 5;

  const PHASE_NAMES = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown', ''];

  /* ── Layout ── */
  const COMMUNITY_Y = 220;
  const COMMUNITY_START_X = (CANVAS_W - 5 * CE.CARD_W - 4 * 8) / 2;
  const CARD_GAP = 8;

  const PLAYER_POSITIONS = [
    { x: CANVAS_W / 2, y: CANVAS_H - 130, labelY: CANVAS_H - 140, align: 'bottom' },
    { x: 80, y: 280, labelY: 250, align: 'left' },
    { x: CANVAS_W / 2, y: 40, labelY: 30, align: 'top' },
    { x: CANVAS_W - 80 - CE.CARD_W, y: 280, labelY: 250, align: 'right' }
  ];

  /* ── Button layout ── */
  const BTN_W = 90;
  const BTN_H = 34;
  const BTN_Y = CANVAS_H - 50;
  const BTN_GAP = 10;

  function btnRect(i, count) {
    const totalW = count * BTN_W + (count - 1) * BTN_GAP;
    const startX = (CANVAS_W - totalW) / 2;
    return { x: startX + i * (BTN_W + BTN_GAP), y: BTN_Y, w: BTN_W, h: BTN_H };
  }

  /* ================================================================
     GAME STATE
     ================================================================ */

  let deck = [];
  let community = [];
  let holeCards = [[], [], [], []];
  let chips = [0, 0, 0, 0];
  let bets = [0, 0, 0, 0];
  let folded = [false, false, false, false];
  let allIn = [false, false, false, false];
  let eliminated = [false, false, false, false];
  let pot = 0;
  let sidePots = [];
  let dealerIdx = 0;
  let currentTurn = 0;
  let phase = PHASE_PREFLOP;
  let roundOver = false;
  let gameOver = false;
  let score = STARTING_CHIPS;
  let currentBet = 0;
  let minRaise = BIG_BLIND;
  let raiseAmount = BIG_BLIND;
  let lastRaiser = -1;
  let actedThisRound = [];
  let showdownRevealed = false;
  let resultMessage = '';
  let handRankText = '';

  let hoverBtn = -1;

  let _ctx = null;
  let _host = null;
  let aiTurnTimer = 0;
  const AI_TURN_DELAY = 0.8;
  let showdownTimer = 0;
  const SHOWDOWN_DELAY = 2.5;

  /* ================================================================
     HAND EVALUATION — best 5 of 7
     ================================================================ */

  function cardVal(card) {
    return RANK_VALUE[card.rank] || 0;
  }

  function combinations(arr, k) {
    const result = [];
    function recurse(start, combo) {
      if (combo.length === k) {
        result.push(combo.slice());
        return;
      }
      for (let i = start; i < arr.length; ++i) {
        combo.push(arr[i]);
        recurse(i + 1, combo);
        combo.pop();
      }
    }
    recurse(0, []);
    return result;
  }

  function evaluate5(hand) {
    const vals = hand.map(c => cardVal(c)).sort((a, b) => b - a);
    const suits = hand.map(c => c.suit);
    const isFlush = suits.every(s => s === suits[0]);

    const counts = {};
    for (const v of vals) counts[v] = (counts[v] || 0) + 1;

    const groups = Object.entries(counts)
      .map(([v, c]) => ({ val: +v, count: c }))
      .sort((a, b) => b.count - a.count || b.val - a.val);

    const unique = [...new Set(vals)].sort((a, b) => b - a);
    let isStraight = false;
    let straightHigh = 0;

    if (unique.length === 5) {
      if (unique[0] - unique[4] === 4) {
        isStraight = true;
        straightHigh = unique[0];
      }
      if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
        isStraight = true;
        straightHigh = 5;
      }
    }

    const kickers = vals.slice();

    if (isFlush && isStraight && straightHigh === 14 && unique[1] === 13)
      return { rank: HAND_RANKS.ROYAL_FLUSH, kickers: [14] };
    if (isFlush && isStraight)
      return { rank: HAND_RANKS.STRAIGHT_FLUSH, kickers: [straightHigh] };
    if (groups[0].count === 4)
      return { rank: HAND_RANKS.FOUR_KIND, kickers: [groups[0].val, groups[1].val] };
    if (groups[0].count === 3 && groups[1].count === 2)
      return { rank: HAND_RANKS.FULL_HOUSE, kickers: [groups[0].val, groups[1].val] };
    if (isFlush)
      return { rank: HAND_RANKS.FLUSH, kickers };
    if (isStraight)
      return { rank: HAND_RANKS.STRAIGHT, kickers: [straightHigh] };
    if (groups[0].count === 3)
      return { rank: HAND_RANKS.THREE_KIND, kickers: [groups[0].val, ...kickers.filter(v => v !== groups[0].val).slice(0, 2)] };
    if (groups[0].count === 2 && groups[1].count === 2) {
      const high = Math.max(groups[0].val, groups[1].val);
      const low = Math.min(groups[0].val, groups[1].val);
      const kick = kickers.find(v => v !== high && v !== low);
      return { rank: HAND_RANKS.TWO_PAIR, kickers: [high, low, kick] };
    }
    if (groups[0].count === 2)
      return { rank: HAND_RANKS.PAIR, kickers: [groups[0].val, ...kickers.filter(v => v !== groups[0].val).slice(0, 3)] };
    return { rank: HAND_RANKS.HIGH_CARD, kickers };
  }

  function evaluateBest(hole, board) {
    const all = hole.concat(board);
    if (all.length < 5) return { rank: -1, kickers: [], name: '' };
    const combos = combinations(all, 5);
    let best = null;
    for (const combo of combos) {
      const ev = evaluate5(combo);
      if (!best || compareHands(ev, best) > 0)
        best = ev;
    }
    best.name = HAND_NAMES[best.rank];
    return best;
  }

  function compareHands(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); ++i) {
      if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
    }
    return 0;
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function holeCardStrength(hole) {
    const v1 = cardVal(hole[0]);
    const v2 = cardVal(hole[1]);
    const high = Math.max(v1, v2);
    const low = Math.min(v1, v2);
    const paired = v1 === v2;
    const suited = hole[0].suit === hole[1].suit;
    const gap = high - low;

    let strength = 0;

    if (paired) {
      strength = 5 + high * 0.5;
      if (high >= 10) strength += 3;
    } else {
      strength = (high + low) * 0.15;
      if (suited) strength += 1.5;
      if (gap === 1) strength += 1.2;
      else if (gap === 2) strength += 0.6;
      if (high >= 13) strength += 1.5;
      if (high >= 11 && low >= 11) strength += 2;
    }

    return Math.min(strength, 12);
  }

  function aiDecide(playerIdx) {
    const hole = holeCards[playerIdx];
    const myChips = chips[playerIdx];
    const toCall = currentBet - bets[playerIdx];

    let strength = holeCardStrength(hole);

    if (community.length > 0) {
      const ev = evaluateBest(hole, community);
      strength = Math.max(strength, ev.rank * 1.5 + 2);
    }

    const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
    const bluffing = Math.random() < BLUFF_CHANCE;

    if (toCall === 0) {
      if (strength >= 7 || bluffing) {
        const raise = Math.max(minRaise, Math.floor(pot * (0.3 + strength * 0.08)));
        return { action: 'raise', amount: Math.min(raise, myChips) };
      }
      return { action: 'check' };
    }

    if (toCall >= myChips) {
      if (strength >= 6 || (strength >= 4 && bluffing))
        return { action: 'allin' };
      if (strength >= 3 && potOdds < 0.35)
        return { action: 'allin' };
      return { action: 'fold' };
    }

    if (strength >= 8) {
      const raise = Math.max(minRaise, Math.floor(pot * 0.6));
      return { action: 'raise', amount: Math.min(toCall + raise, myChips) };
    }

    if (strength >= 5 || bluffing) {
      if (Math.random() < 0.4 && strength >= 6) {
        const raise = Math.max(minRaise, Math.floor(pot * 0.4));
        return { action: 'raise', amount: Math.min(toCall + raise, myChips) };
      }
      return { action: 'call' };
    }

    if (strength >= 3 && potOdds < 0.3)
      return { action: 'call' };

    return { action: 'fold' };
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function activePlayers() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!folded[i] && !eliminated[i]) ++count;
    return count;
  }

  function activeNonAllIn() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!folded[i] && !eliminated[i] && !allIn[i]) ++count;
    return count;
  }

  function nextActive(from) {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const idx = (from + i) % NUM_PLAYERS;
      if (!folded[idx] && !eliminated[idx] && !allIn[idx]) return idx;
    }
    return -1;
  }

  function nextActiveOrAllIn(from) {
    for (let i = 1; i <= NUM_PLAYERS; ++i) {
      const idx = (from + i) % NUM_PLAYERS;
      if (!folded[idx] && !eliminated[idx]) return idx;
    }
    return -1;
  }

  function collectBets() {
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      pot += bets[i];
      bets[i] = 0;
    }
    currentBet = 0;
  }

  function dealCommunity(count) {
    for (let i = 0; i < count; ++i) {
      const card = deck.pop();
      card.faceUp = true;
      community.push(card);
      if (_host) {
        const cx = COMMUNITY_START_X + (community.length - 1) * (CE.CARD_W + CARD_GAP);
        _host.dealCardAnim(card, CANVAS_W / 2, -CE.CARD_H, cx, COMMUNITY_Y, i * 0.15);
      }
    }
  }

  function startBettingRound() {
    actedThisRound = new Array(NUM_PLAYERS).fill(false);
    lastRaiser = -1;

    if (phase === PHASE_PREFLOP) {
      currentTurn = nextActive((dealerIdx + 2) % NUM_PLAYERS);
      if (currentTurn < 0) currentTurn = nextActiveOrAllIn(dealerIdx);
    } else {
      currentTurn = nextActive(dealerIdx);
      if (currentTurn < 0) currentTurn = nextActiveOrAllIn(dealerIdx);
    }

    if (currentTurn < 0 || activePlayers() <= 1)
      advancePhase();
  }

  function isBettingComplete() {
    if (activePlayers() <= 1) return true;
    if (activeNonAllIn() === 0) return true;

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (folded[i] || eliminated[i] || allIn[i]) continue;
      if (!actedThisRound[i]) return false;
      if (bets[i] < currentBet) return false;
    }
    return true;
  }

  function advancePhase() {
    collectBets();

    if (activePlayers() <= 1) {
      resolveHand();
      return;
    }

    if (phase === PHASE_PREFLOP) {
      phase = PHASE_FLOP;
      dealCommunity(3);
    } else if (phase === PHASE_FLOP) {
      phase = PHASE_TURN;
      dealCommunity(1);
    } else if (phase === PHASE_TURN) {
      phase = PHASE_RIVER;
      dealCommunity(1);
    } else if (phase === PHASE_RIVER) {
      phase = PHASE_SHOWDOWN;
      revealAllHands();
      resolveHand();
      return;
    }

    minRaise = BIG_BLIND;
    raiseAmount = BIG_BLIND;

    if (activeNonAllIn() <= 1 && activePlayers() > 1) {
      advancePhase();
      return;
    }

    startBettingRound();
  }

  function revealAllHands() {
    showdownRevealed = true;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (folded[i] || eliminated[i]) continue;
      for (const c of holeCards[i])
        c.faceUp = true;
    }
  }

  function resolveHand() {
    if (!showdownRevealed) revealAllHands();

    let bestEval = null;
    let winnerIdx = -1;

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (folded[i] || eliminated[i]) continue;
      if (activePlayers() === 1) {
        winnerIdx = i;
        break;
      }
      const ev = evaluateBest(holeCards[i], community);
      if (!bestEval || compareHands(ev, bestEval) > 0) {
        bestEval = ev;
        winnerIdx = i;
      }
    }

    if (winnerIdx >= 0) {
      chips[winnerIdx] += pot;
      const winName = PLAYER_NAMES[winnerIdx];
      const handName = bestEval ? bestEval.name : '';
      resultMessage = winName + ' wins ' + pot + ' chips' + (handName ? ' with ' + handName : '') + '!';

      if (_host) {
        const col = winnerIdx === 0 ? '#4f4' : '#fa0';
        _host.floatingText.add(CANVAS_W / 2, 180, resultMessage, { color: col, size: 18 });
        if (winnerIdx === 0) {
          _host.particles.confetti(CANVAS_W / 2, 200, 40);
          _host.particles.sparkle(CANVAS_W / 2, 200, 20, {});
        }
      }
    }

    pot = 0;
    score = chips[0];
    if (_host) _host.onScoreChanged(score);

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (chips[i] <= 0 && !eliminated[i]) {
        eliminated[i] = true;
        if (_host) _host.floatingText.add(CANVAS_W / 2, 280, PLAYER_NAMES[i] + ' eliminated!', { color: '#f88', size: 16 });
      }
    }

    let remaining = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!eliminated[i]) ++remaining;

    roundOver = true;

    if (eliminated[0] || remaining <= 1) {
      gameOver = true;
      const msg = eliminated[0] ? 'You were eliminated!' : 'You win the tournament!';
      const col = eliminated[0] ? '#f44' : '#4f4';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, msg, { color: col, size: 28 });
        if (!eliminated[0]) _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
      }
    }

    phase = PHASE_ROUND_OVER;
    showdownTimer = 0;
  }

  function performAction(playerIdx, action, amount) {
    const toCall = currentBet - bets[playerIdx];

    if (action === 'fold') {
      folded[playerIdx] = true;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Fold', { color: '#f88', size: 14 });
      actedThisRound[playerIdx] = true;
    } else if (action === 'check') {
      actedThisRound[playerIdx] = true;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Check', { color: '#aaa', size: 14 });
    } else if (action === 'call') {
      const callAmt = Math.min(toCall, chips[playerIdx]);
      bets[playerIdx] += callAmt;
      chips[playerIdx] -= callAmt;
      if (chips[playerIdx] <= 0) allIn[playerIdx] = true;
      actedThisRound[playerIdx] = true;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Call ' + callAmt, { color: '#8cf', size: 14 });
    } else if (action === 'raise') {
      const raiseTotal = Math.min(amount || (currentBet + minRaise), chips[playerIdx] + bets[playerIdx]);
      const raiseDiff = raiseTotal - currentBet;
      if (raiseDiff > minRaise) minRaise = raiseDiff;
      const cost = raiseTotal - bets[playerIdx];
      chips[playerIdx] -= cost;
      bets[playerIdx] = raiseTotal;
      currentBet = raiseTotal;
      if (chips[playerIdx] <= 0) allIn[playerIdx] = true;
      lastRaiser = playerIdx;
      actedThisRound = actedThisRound.map((v, i) => i === playerIdx);
      actedThisRound[playerIdx] = true;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Raise ' + raiseTotal, { color: '#fc4', size: 14 });
    } else if (action === 'allin') {
      const allInAmt = chips[playerIdx];
      bets[playerIdx] += allInAmt;
      chips[playerIdx] = 0;
      allIn[playerIdx] = true;
      if (bets[playerIdx] > currentBet) {
        const raiseDiff = bets[playerIdx] - currentBet;
        if (raiseDiff > minRaise) minRaise = raiseDiff;
        currentBet = bets[playerIdx];
        lastRaiser = playerIdx;
        actedThisRound = actedThisRound.map((v, i) => i === playerIdx);
      }
      actedThisRound[playerIdx] = true;
      if (_host && playerIdx !== 0)
        _host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'All-In!', { color: '#f44', size: 16 });
    }

    if (_host) _host.onScoreChanged(chips[0]);

    if (isBettingComplete()) {
      advancePhase();
      return;
    }

    currentTurn = nextActive(playerIdx);
    if (currentTurn < 0)
      advancePhase();
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupHand() {
    deck = CE.shuffle(CE.createDeck());
    community = [];
    holeCards = [[], [], [], []];
    bets = [0, 0, 0, 0];
    folded = [false, false, false, false];
    allIn = [false, false, false, false];
    pot = 0;
    sidePots = [];
    currentBet = 0;
    minRaise = BIG_BLIND;
    raiseAmount = BIG_BLIND;
    lastRaiser = -1;
    actedThisRound = new Array(NUM_PLAYERS).fill(false);
    showdownRevealed = false;
    resultMessage = '';
    handRankText = '';
    roundOver = false;
    showdownTimer = 0;
    hoverBtn = -1;

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      folded[i] = eliminated[i];
      allIn[i] = false;
    }

    while (eliminated[dealerIdx])
      dealerIdx = (dealerIdx + 1) % NUM_PLAYERS;

    const sbIdx = nextActiveOrAllIn(dealerIdx);
    const bbIdx = nextActiveOrAllIn(sbIdx);

    for (let round = 0; round < 2; ++round) {
      for (let i = 0; i < NUM_PLAYERS; ++i) {
        if (eliminated[i]) continue;
        const card = deck.pop();
        card.faceUp = i === 0;
        holeCards[i].push(card);
      }
    }

    if (_host) {
      for (let i = 0; i < holeCards[0].length; ++i) {
        const px = CANVAS_W / 2 - CE.CARD_W - 4 + i * (CE.CARD_W + CARD_GAP);
        _host.dealCardAnim(holeCards[0][i], CANVAS_W / 2, -CE.CARD_H, px, CANVAS_H - 130, i * 0.12);
      }
    }

    if (sbIdx >= 0 && !eliminated[sbIdx]) {
      const sbAmt = Math.min(SMALL_BLIND, chips[sbIdx]);
      bets[sbIdx] = sbAmt;
      chips[sbIdx] -= sbAmt;
      if (chips[sbIdx] <= 0) allIn[sbIdx] = true;
    }
    if (bbIdx >= 0 && !eliminated[bbIdx]) {
      const bbAmt = Math.min(BIG_BLIND, chips[bbIdx]);
      bets[bbIdx] = bbAmt;
      chips[bbIdx] -= bbAmt;
      if (chips[bbIdx] <= 0) allIn[bbIdx] = true;
    }
    currentBet = BIG_BLIND;

    phase = PHASE_PREFLOP;
    startBettingRound();
  }

  function setupGame() {
    chips = [STARTING_CHIPS, STARTING_CHIPS, STARTING_CHIPS, STARTING_CHIPS];
    eliminated = [false, false, false, false];
    dealerIdx = 0;
    score = STARTING_CHIPS;
    roundOver = false;
    gameOver = false;
    setupHand();
  }

  /* ================================================================
     DRAWING HELPERS
     ================================================================ */

  function drawChipBadge(x, y, amount, highlight) {
    _ctx.save();
    const text = '' + amount;
    _ctx.font = 'bold 11px sans-serif';
    const tw = _ctx.measureText(text).width;
    const pw = tw + 14;
    const ph = 18;
    const px = x - pw / 2;
    const py = y - ph / 2;

    _ctx.fillStyle = highlight ? 'rgba(255,200,0,0.85)' : 'rgba(0,0,0,0.6)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 9);
    _ctx.fill();

    _ctx.fillStyle = highlight ? '#000' : '#fc0';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText(text, x, y);
    _ctx.restore();
  }

  function drawDealerButton(x, y) {
    _ctx.save();
    _ctx.beginPath();
    _ctx.arc(x, y, 12, 0, Math.PI * 2);
    _ctx.fillStyle = '#fff';
    _ctx.fill();
    _ctx.strokeStyle = '#333';
    _ctx.lineWidth = 2;
    _ctx.stroke();

    _ctx.fillStyle = '#000';
    _ctx.font = 'bold 10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('D', x, y);
    _ctx.restore();
  }

  function drawBlindLabel(x, y, text) {
    _ctx.save();
    _ctx.font = 'bold 9px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    const tw = _ctx.measureText(text).width;
    const pw = tw + 8;
    const ph = 14;

    _ctx.fillStyle = 'rgba(100,100,255,0.7)';
    CE.drawRoundedRect(_ctx, x - pw / 2, y - ph / 2, pw, ph, 7);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.fillText(text, x, y);
    _ctx.restore();
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawCommunityCards() {
    for (let i = 0; i < 5; ++i) {
      const cx = COMMUNITY_START_X + i * (CE.CARD_W + CARD_GAP);
      if (i < community.length) {
        if (!community[i]._dealing)
          CE.drawCardFace(_ctx, cx, COMMUNITY_Y, community[i]);
      } else
        CE.drawEmptySlot(_ctx, cx, COMMUNITY_Y, '');
    }
  }

  function drawPot() {
    const totalInPlay = pot + bets.reduce((s, b) => s + b, 0);
    if (totalInPlay <= 0) return;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.5)';
    CE.drawRoundedRect(_ctx, CANVAS_W / 2 - 60, COMMUNITY_Y - 35, 120, 26, 8);
    _ctx.fill();

    _ctx.fillStyle = '#fc0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('Pot: ' + totalInPlay, CANVAS_W / 2, COMMUNITY_Y - 22);
    _ctx.restore();
  }

  function drawPlayerArea(idx) {
    if (eliminated[idx]) return;

    const pos = PLAYER_POSITIONS[idx];
    const isActive = currentTurn === idx && phase < PHASE_SHOWDOWN && !roundOver;
    const isFolded = folded[idx];

    let hx, hy;
    if (idx === 0) {
      hx = CANVAS_W / 2 - CE.CARD_W - 4;
      hy = CANVAS_H - 130;
    } else if (idx === 1) {
      hx = 30;
      hy = 280;
    } else if (idx === 2) {
      hx = CANVAS_W / 2 - CE.CARD_W - 4;
      hy = 50;
    } else {
      hx = CANVAS_W - 30 - 2 * CE.CARD_W - CARD_GAP;
      hy = 280;
    }

    if (isActive) {
      _ctx.save();
      _ctx.strokeStyle = '#ff0';
      _ctx.lineWidth = 2;
      _ctx.shadowColor = '#ff0';
      _ctx.shadowBlur = 8;
      CE.drawRoundedRect(_ctx, hx - 6, hy - 6, 2 * CE.CARD_W + CARD_GAP + 12, CE.CARD_H + 12, 8);
      _ctx.stroke();
      _ctx.restore();
    }

    for (let i = 0; i < holeCards[idx].length; ++i) {
      const cx = hx + i * (CE.CARD_W + CARD_GAP);
      const card = holeCards[idx][i];
      if (card._dealing) continue;

      if (isFolded) {
        _ctx.save();
        _ctx.globalAlpha = 0.3;
        CE.drawCardBack(_ctx, cx, hy);
        _ctx.restore();
      } else if (card.faceUp)
        CE.drawCardFace(_ctx, cx, hy, card);
      else
        CE.drawCardBack(_ctx, cx, hy);
    }

    _ctx.save();
    _ctx.fillStyle = isActive ? '#ff0' : (isFolded ? '#666' : '#fff');
    _ctx.font = isActive ? 'bold 12px sans-serif' : '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    const labelX = hx + CE.CARD_W + CARD_GAP / 2;
    const labelY = hy + CE.CARD_H + 4;
    _ctx.fillText(PLAYER_NAMES[idx], labelX, labelY);
    _ctx.restore();

    drawChipBadge(labelX, labelY + 20, chips[idx], isActive);

    if (bets[idx] > 0) {
      const betX = idx === 1 ? hx + 2 * CE.CARD_W + CARD_GAP + 20 :
                   idx === 3 ? hx - 20 :
                   labelX;
      const betY = idx === 0 ? hy - 18 :
                   idx === 2 ? hy + CE.CARD_H + 4 :
                   hy + CE.CARD_H / 2;
      _ctx.save();
      _ctx.fillStyle = '#8cf';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Bet: ' + bets[idx], betX, betY);
      _ctx.restore();
    }

    const sbIdx = nextActiveOrAllIn(dealerIdx);
    const bbIdx = nextActiveOrAllIn(sbIdx);

    const dealerBtnOffset = 28;
    let dbx, dby;
    if (idx === 0) { dbx = hx - 20; dby = hy + CE.CARD_H / 2; }
    else if (idx === 1) { dbx = hx + 2 * CE.CARD_W + CARD_GAP + dealerBtnOffset; dby = hy - 10; }
    else if (idx === 2) { dbx = hx + 2 * CE.CARD_W + CARD_GAP + 20; dby = hy + CE.CARD_H / 2; }
    else { dbx = hx - dealerBtnOffset; dby = hy - 10; }

    if (idx === dealerIdx) drawDealerButton(dbx, dby);
    if (idx === sbIdx && !eliminated[idx]) drawBlindLabel(dbx, dby + (idx === dealerIdx ? 20 : 0), 'SB');
    if (idx === bbIdx && !eliminated[idx]) drawBlindLabel(dbx, dby + (idx === dealerIdx ? 20 : (idx === sbIdx ? 20 : 0)), 'BB');
  }

  function getPlayerHandRank() {
    if (holeCards[0].length < 2) return '';
    const board = community.filter(c => c.faceUp);
    if (board.length === 0) return '';
    const ev = evaluateBest(holeCards[0], board);
    return ev.name || '';
  }

  function drawActionButtons() {
    if (phase >= PHASE_SHOWDOWN || roundOver || gameOver) return;
    if (currentTurn !== 0) return;

    const toCall = currentBet - bets[0];
    const myChips = chips[0];
    const canCheck = toCall === 0;
    const canRaise = myChips > toCall;

    const buttons = [];
    buttons.push({ label: 'Fold (F)', action: 'fold', bg: '#5a2a2a', border: '#c66' });

    if (canCheck)
      buttons.push({ label: 'Check (C)', action: 'check', bg: '#2a3a5a', border: '#6ac' });
    else
      buttons.push({ label: 'Call ' + Math.min(toCall, myChips) + ' (C)', action: 'call', bg: '#2a3a5a', border: '#6ac' });

    if (canRaise) {
      const rAmt = Math.min(currentBet + raiseAmount, myChips + bets[0]);
      buttons.push({ label: 'Raise (R)', action: 'raise', bg: '#5a5a2a', border: '#cc6' });
    }

    buttons.push({ label: 'All-In (A)', action: 'allin', bg: '#5a2a3a', border: '#c6a' });

    for (let i = 0; i < buttons.length; ++i) {
      const r = btnRect(i, buttons.length);
      const isHover = hoverBtn === i;
      CE.drawButton(_ctx, r.x, r.y, r.w, r.h, buttons[i].label, {
        bg: isHover ? buttons[i].border : buttons[i].bg,
        border: buttons[i].border,
        fontSize: 11
      });
    }

    return buttons;
  }

  function drawPhaseInfo() {
    if (phase < PHASE_SHOWDOWN) {
      _ctx.save();
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.fillText(PHASE_NAMES[phase], 10, CANVAS_H - 16);
      _ctx.restore();
    }

    const handText = getPlayerHandRank();
    if (handText) {
      _ctx.save();
      _ctx.fillStyle = '#aaf';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText(handText, CANVAS_W / 2, CANVAS_H - 72);
      _ctx.restore();
    }
  }

  function drawRoundOverUI() {
    _ctx.save();
    const pw = 300;
    const ph = 180;
    const px = (CANVAS_W - pw) / 2;
    const py = (CANVAS_H - ph) / 2 - 20;

    _ctx.fillStyle = 'rgba(0,0,0,0.7)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Hand Complete', CANVAS_W / 2, py + 12);

    _ctx.font = '12px sans-serif';
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      const y = py + 42 + i * 22;
      const el = eliminated[i];
      _ctx.fillStyle = el ? '#666' : (i === 0 ? '#8f8' : '#ccc');
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[i] + (el ? ' (out)' : ''), px + 20, y);
      _ctx.textAlign = 'right';
      _ctx.fillText(el ? '0' : '' + chips[i], px + pw - 20, y);
    }

    if (resultMessage) {
      _ctx.fillStyle = '#fc0';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultMessage, CANVAS_W / 2, py + ph - 36);
    }

    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);
    _ctx.restore();
  }

  function drawTitle() {
    _ctx.save();
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText("Texas Hold'em", 10, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Blinds: ' + SMALL_BLIND + '/' + BIG_BLIND, 10, 28);
    _ctx.restore();
  }

  let _cachedButtons = null;

  function drawHoldem() {
    drawTitle();
    drawCommunityCards();
    drawPot();

    for (let i = 0; i < NUM_PLAYERS; ++i)
      drawPlayerArea(i);

    drawPhaseInfo();
    _cachedButtons = drawActionButtons();

    if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function getButtonActions() {
    if (phase >= PHASE_SHOWDOWN || roundOver || gameOver) return [];
    if (currentTurn !== 0) return [];

    const toCall = currentBet - bets[0];
    const myChips = chips[0];
    const canCheck = toCall === 0;
    const canRaise = myChips > toCall;

    const actions = [];
    actions.push('fold');
    actions.push(canCheck ? 'check' : 'call');
    if (canRaise) actions.push('raise');
    actions.push('allin');
    return actions;
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : STARTING_CHIPS;
      if (score <= 0) score = STARTING_CHIPS;
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawHoldem();
    },

    handleClick(mx, my) {
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          score = STARTING_CHIPS;
          if (_host) _host.onScoreChanged(score);
          setupGame();
        } else {
          dealerIdx = nextActiveOrAllIn(dealerIdx);
          setupHand();
        }
        return;
      }

      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      if (currentTurn !== 0 || phase >= PHASE_SHOWDOWN) return;

      const actions = getButtonActions();
      for (let i = 0; i < actions.length; ++i) {
        const r = btnRect(i, actions.length);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          executePlayerAction(actions[i]);
          return;
        }
      }
    },

    handlePointerMove(mx, my) {
      hoverBtn = -1;
      if (currentTurn !== 0 || phase >= PHASE_SHOWDOWN || roundOver) return;

      const actions = getButtonActions();
      for (let i = 0; i < actions.length; ++i) {
        const r = btnRect(i, actions.length);
        if (CE.isInRect(mx, my, r.x, r.y, r.w, r.h)) {
          hoverBtn = i;
          return;
        }
      }
    },

    handlePointerUp() {},

    handleKey(e) {
      if (phase >= PHASE_SHOWDOWN || roundOver || gameOver) return;
      if (currentTurn !== 0) return;

      const key = e.key.toLowerCase();
      if (key === 'f') executePlayerAction('fold');
      else if (key === 'c') executePlayerAction(currentBet - bets[0] === 0 ? 'check' : 'call');
      else if (key === 'r') executePlayerAction('raise');
      else if (key === 'a') executePlayerAction('allin');
    },

    tick(dt) {
      if (gameOver && phase !== PHASE_ROUND_OVER) return;

      if (phase === PHASE_SHOWDOWN && !roundOver) {
        showdownTimer += dt;
        if (showdownTimer >= SHOWDOWN_DELAY)
          resolveHand();
        return;
      }

      if (phase >= PHASE_SHOWDOWN || roundOver) return;
      if (currentTurn === 0) return;

      aiTurnTimer += dt;
      if (aiTurnTimer >= AI_TURN_DELAY) {
        aiTurnTimer = 0;
        const decision = aiDecide(currentTurn);
        performAction(currentTurn, decision.action, decision.amount);
      }
    },

    cleanup() {
      deck = [];
      community = [];
      holeCards = [[], [], [], []];
      chips = [0, 0, 0, 0];
      bets = [0, 0, 0, 0];
      folded = [false, false, false, false];
      allIn = [false, false, false, false];
      eliminated = [false, false, false, false];
      pot = 0;
      roundOver = false;
      gameOver = false;
      _cachedButtons = null;
      hoverBtn = -1;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  function executePlayerAction(action) {
    if (action === 'raise') {
      const rAmt = Math.min(currentBet + raiseAmount, chips[0] + bets[0]);
      performAction(0, 'raise', rAmt);
    } else
      performAction(0, action);
  }

  SZ.CardGames.registerVariant('holdem', module);

})();
