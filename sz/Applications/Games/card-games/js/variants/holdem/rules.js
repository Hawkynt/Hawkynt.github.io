/* Texas Hold'em: rules - deck, legal moves, scoring and round end. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.holdem;
  const S = V.S;
  const { CANVAS_W, CANVAS_H, NUM_PLAYERS, PLAYER_NAMES, RANK_VALUE, HAND_RANKS, HAND_NAMES,
    PHASE_SHOWDOWN, PHASE_ROUND_OVER, PLAYER_POSITIONS } = V;

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

  function activePlayers() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!S.folded[i] && !S.eliminated[i]) ++count;
    return count;
  }

  function activeNonAllIn() {
    let count = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!S.folded[i] && !S.eliminated[i] && !S.allIn[i]) ++count;
    return count;
  }

  function collectBets() {
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      S.pot += S.bets[i];
      S.bets[i] = 0;
    }
    S.currentBet = 0;
  }

  function isBettingComplete() {
    if (activePlayers() <= 1) return true;
    if (activeNonAllIn() === 0) return true;

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (S.folded[i] || S.eliminated[i] || S.allIn[i]) continue;
      if (!S.actedThisRound[i]) return false;
      if (S.bets[i] < S.currentBet) return false;
    }
    return true;
  }

  function revealAllHands() {
    S.showdownRevealed = true;
    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (S.folded[i] || S.eliminated[i]) continue;
      for (const c of S.holeCards[i])
        c.faceUp = true;
    }
  }

  function resolveHand() {
    if (!S.showdownRevealed) revealAllHands();

    let bestEval = null;
    let winnerIdx = -1;

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (S.folded[i] || S.eliminated[i]) continue;
      if (activePlayers() === 1) {
        winnerIdx = i;
        break;
      }
      const ev = evaluateBest(S.holeCards[i], S.community);
      if (!bestEval || compareHands(ev, bestEval) > 0) {
        bestEval = ev;
        winnerIdx = i;
      }
    }

    if (winnerIdx >= 0) {
      S.chips[winnerIdx] += S.pot;
      const winName = PLAYER_NAMES[winnerIdx];
      const handName = bestEval ? bestEval.name : '';
      S.resultMessage = winName + ' wins ' + S.pot + ' chips' + (handName ? ' with ' + handName : '') + '!';

      if (S._host) {
        const col = winnerIdx === 0 ? '#4f4' : '#fa0';
        S._host.floatingText.add(CANVAS_W / 2, 180, S.resultMessage, { color: col, size: 18 });
        if (winnerIdx === 0) {
          S._host.particles.confetti(CANVAS_W / 2, 200, 40);
          S._host.particles.sparkle(CANVAS_W / 2, 200, 20, {});
        }
      }
    }

    S.pot = 0;
    S.score = S.chips[0];
    if (S._host) S._host.onScoreChanged(S.score);

    for (let i = 0; i < NUM_PLAYERS; ++i) {
      if (S.chips[i] <= 0 && !S.eliminated[i]) {
        S.eliminated[i] = true;
        if (S._host) S._host.floatingText.add(CANVAS_W / 2, 280, PLAYER_NAMES[i] + ' eliminated!', { color: '#f88', size: 16 });
      }
    }

    let remaining = 0;
    for (let i = 0; i < NUM_PLAYERS; ++i)
      if (!S.eliminated[i]) ++remaining;

    S.roundOver = true;

    if (S.eliminated[0] || remaining <= 1) {
      S.gameOver = true;
      const msg = S.eliminated[0] ? 'You were eliminated!' : 'You win the tournament!';
      const col = S.eliminated[0] ? '#f44' : '#4f4';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, msg, { color: col, size: 28 });
        if (!S.eliminated[0]) S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
      }
    }

    S.phase = PHASE_ROUND_OVER;
    S.showdownTimer = 0;
  }

  function performAction(playerIdx, action, amount) {
    const toCall = S.currentBet - S.bets[playerIdx];

    if (action === 'fold') {
      S.folded[playerIdx] = true;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Fold', { color: '#f88', size: 14 });
      S.actedThisRound[playerIdx] = true;
    } else if (action === 'check') {
      S.actedThisRound[playerIdx] = true;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Check', { color: '#aaa', size: 14 });
    } else if (action === 'call') {
      const callAmt = Math.min(toCall, S.chips[playerIdx]);
      S.bets[playerIdx] += callAmt;
      S.chips[playerIdx] -= callAmt;
      if (S.chips[playerIdx] <= 0) S.allIn[playerIdx] = true;
      S.actedThisRound[playerIdx] = true;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Call ' + callAmt, { color: '#8cf', size: 14 });
    } else if (action === 'raise') {
      const raiseTotal = Math.min(amount || (S.currentBet + S.minRaise), S.chips[playerIdx] + S.bets[playerIdx]);
      const raiseDiff = raiseTotal - S.currentBet;
      if (raiseDiff > S.minRaise) S.minRaise = raiseDiff;
      const cost = raiseTotal - S.bets[playerIdx];
      S.chips[playerIdx] -= cost;
      S.bets[playerIdx] = raiseTotal;
      S.currentBet = raiseTotal;
      if (S.chips[playerIdx] <= 0) S.allIn[playerIdx] = true;
      S.lastRaiser = playerIdx;
      S.actedThisRound = S.actedThisRound.map((v, i) => i === playerIdx);
      S.actedThisRound[playerIdx] = true;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'Raise ' + raiseTotal, { color: '#fc4', size: 14 });
    } else if (action === 'allin') {
      const allInAmt = S.chips[playerIdx];
      S.bets[playerIdx] += allInAmt;
      S.chips[playerIdx] = 0;
      S.allIn[playerIdx] = true;
      if (S.bets[playerIdx] > S.currentBet) {
        const raiseDiff = S.bets[playerIdx] - S.currentBet;
        if (raiseDiff > S.minRaise) S.minRaise = raiseDiff;
        S.currentBet = S.bets[playerIdx];
        S.lastRaiser = playerIdx;
        S.actedThisRound = S.actedThisRound.map((v, i) => i === playerIdx);
      }
      S.actedThisRound[playerIdx] = true;
      if (S._host && playerIdx !== 0)
        S._host.floatingText.add(PLAYER_POSITIONS[playerIdx].x, PLAYER_POSITIONS[playerIdx].labelY, 'All-In!', { color: '#f44', size: 16 });
    }

    if (S._host) S._host.onScoreChanged(S.chips[0]);

    if (isBettingComplete()) {
      V.advancePhase();
      return;
    }

    S.currentTurn = V.nextActive(playerIdx);
    if (S.currentTurn < 0)
      V.advancePhase();
  }

  function getPlayerHandRank() {
    if (S.holeCards[0].length < 2) return '';
    const board = S.community.filter(c => c.faceUp);
    if (board.length === 0) return '';
    const ev = evaluateBest(S.holeCards[0], board);
    return ev.name || '';
  }

  function getButtonActions() {
    if (S.phase >= PHASE_SHOWDOWN || S.roundOver || S.gameOver) return [];
    if (S.currentTurn !== 0) return [];

    const toCall = S.currentBet - S.bets[0];
    const myChips = S.chips[0];
    const canCheck = toCall === 0;
    const canRaise = myChips > toCall;

    const actions = [];
    actions.push('fold');
    actions.push(canCheck ? 'check' : 'call');
    if (canRaise) actions.push('raise');
    actions.push('allin');
    return actions;
  }

  function executePlayerAction(action) {
    if (action === 'raise') {
      const rAmt = Math.min(S.currentBet + S.raiseAmount, S.chips[0] + S.bets[0]);
      performAction(0, 'raise', rAmt);
    } else
      performAction(0, action);
  }

  Object.assign(V, { evaluateBest, holeCardStrength, activePlayers, activeNonAllIn, collectBets,
    revealAllHands, resolveHand, performAction, getPlayerHandRank, getButtonActions,
    executePlayerAction });

})();
