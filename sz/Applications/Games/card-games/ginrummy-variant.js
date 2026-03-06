;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ── Card point values: A=1, 2-10=face, J/Q/K=10 ── */
  const CARD_VALUES = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10 };

  /* ── Phases ── */
  const PHASE_PLAYER_DRAW = 0;
  const PHASE_PLAYER_DISCARD = 1;
  const PHASE_AI_THINKING = 2;
  const PHASE_ROUND_REVEAL = 3;
  const PHASE_LAYOFF = 4;

  /* ── Game state ── */
  let playerHand = [];
  let aiHand = [];
  let stockPile = [];
  let discardPile = [];
  let score = 0;
  let aiScore = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_PLAYER_DRAW;
  let selectedCardIndex = -1;
  let resultMsg = '';

  /* ── Round reveal state ── */
  let knocker = -1;       // 0 = player, 1 = AI
  let isGin = false;
  let playerMelds = [];
  let aiMelds = [];
  let playerDeadwood = [];
  let aiDeadwood = [];
  let layoffCards = [];    // cards opponent laid off

  /* ── AI timing ── */
  let aiTimer = 0;
  const AI_DELAY = 1.0;
  let aiDrawn = false;

  /* ── Host references ── */
  let _ctx = null;
  let _host = null;

  /* ── Button positions ── */
  const STOCK_X = CANVAS_W / 2 - CE.CARD_W - 20;
  const STOCK_Y = 240;
  const DISCARD_X = CANVAS_W / 2 + 20;
  const DISCARD_Y = 240;
  const KNOCK_BTN = { x: CANVAS_W / 2 - 45, y: 370, w: 90, h: 32 };

  /* ══════════════════════════════════════════════════════════════════
     CARD UTILITIES
     ══════════════════════════════════════════════════════════════════ */

  function cardValue(card) {
    return CARD_VALUES[card.rank];
  }

  function rankIndex(card) {
    return CE.RANKS.indexOf(card.rank);
  }

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return rankIndex(a) - rankIndex(b);
    });
  }

  /* ── Hint helper: does this card participate in any potential meld? ── */
  function cardHasHint(hand, idx) {
    const card = hand[idx];
    // Check for 2+ cards of the same rank (potential set)
    let rankCount = 0;
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].rank === card.rank) ++rankCount;
    if (rankCount >= 2) return true;

    // Check for run of 3+ consecutive cards in the same suit
    const suitCards = [];
    for (let i = 0; i < hand.length; ++i)
      if (hand[i].suit === card.suit) suitCards.push(rankIndex(hand[i]));
    suitCards.sort((a, b) => a - b);
    const ci = rankIndex(card);
    // Find where this card sits in consecutive sequences
    for (let start = 0; start < suitCards.length; ++start) {
      let runLen = 1;
      let inRun = suitCards[start] === ci;
      for (let next = start + 1; next < suitCards.length; ++next) {
        if (suitCards[next] === suitCards[next - 1] + 1) {
          ++runLen;
          if (suitCards[next] === ci) inRun = true;
        } else
          break;
      }
      if (runLen >= 3 && inRun) return true;
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     MELD DETECTION
     ══════════════════════════════════════════════════════════════════ */

  // Find all possible sets (3-4 cards of the same rank)
  function findSets(hand) {
    const byRank = {};
    for (let i = 0; i < hand.length; ++i) {
      const r = hand[i].rank;
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(i);
    }
    const sets = [];
    for (const rank in byRank) {
      const indices = byRank[rank];
      if (indices.length >= 3) {
        if (indices.length === 4) {
          // Can form a set of 4 or multiple sets of 3
          sets.push(indices.slice());
          // Also offer all combinations of 3
          for (let skip = 0; skip < 4; ++skip)
            sets.push(indices.filter((_, j) => j !== skip));
        } else
          sets.push(indices.slice());
      }
    }
    return sets;
  }

  // Find all possible runs (3+ consecutive same-suit cards)
  function findRuns(hand) {
    const bySuit = {};
    for (let i = 0; i < hand.length; ++i) {
      const s = hand[i].suit;
      if (!bySuit[s]) bySuit[s] = [];
      bySuit[s].push(i);
    }
    const runs = [];
    for (const suit in bySuit) {
      const indices = bySuit[suit];
      // Sort by rank index
      indices.sort((a, b) => rankIndex(hand[a]) - rankIndex(hand[b]));
      // Find all consecutive sequences of length >= 3
      for (let start = 0; start < indices.length; ++start) {
        const run = [indices[start]];
        for (let next = start + 1; next < indices.length; ++next) {
          if (rankIndex(hand[indices[next]]) === rankIndex(hand[run[run.length - 1]]) + 1)
            run.push(indices[next]);
          else
            break;
        }
        if (run.length >= 3) {
          // Add all sub-runs of length >= 3
          for (let len = 3; len <= run.length; ++len)
            for (let off = 0; off <= run.length - len; ++off)
              runs.push(run.slice(off, off + len));
        }
      }
    }
    return runs;
  }

  // Find the best combination of non-overlapping melds that minimizes deadwood
  function findBestMelds(hand) {
    const allMelds = [...findSets(hand), ...findRuns(hand)];
    if (allMelds.length === 0)
      return { melds: [], deadwood: hand.slice(), deadwoodValue: hand.reduce((s, c) => s + cardValue(c), 0) };

    let bestDeadwood = Infinity;
    let bestCombo = [];

    // Recursive search with pruning (limited depth for performance)
    function search(meldIdx, used, combo) {
      // Calculate current deadwood
      let dw = 0;
      for (let i = 0; i < hand.length; ++i) {
        if (!used.has(i))
          dw += cardValue(hand[i]);
      }
      if (dw < bestDeadwood) {
        bestDeadwood = dw;
        bestCombo = combo.slice();
      }
      if (dw === 0) return; // Perfect gin, no need to search further

      for (let m = meldIdx; m < allMelds.length; ++m) {
        const meld = allMelds[m];
        let overlaps = false;
        for (const idx of meld) {
          if (used.has(idx)) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        for (const idx of meld) used.add(idx);
        combo.push(m);
        search(m + 1, used, combo);
        combo.pop();
        for (const idx of meld) used.delete(idx);
      }
    }

    search(0, new Set(), []);

    const meldCards = [];
    const usedIndices = new Set();
    for (const mi of bestCombo) {
      const meld = allMelds[mi];
      const cards = meld.map(i => hand[i]);
      meldCards.push(cards);
      for (const i of meld) usedIndices.add(i);
    }
    const deadwood = [];
    for (let i = 0; i < hand.length; ++i) {
      if (!usedIndices.has(i))
        deadwood.push(hand[i]);
    }
    return {
      melds: meldCards,
      deadwood,
      deadwoodValue: deadwood.reduce((s, c) => s + cardValue(c), 0)
    };
  }

  function calcDeadwood(hand) {
    return findBestMelds(hand).deadwoodValue;
  }

  // Check if a card can be laid off on existing melds
  function canLayOff(card, melds) {
    for (const meld of melds) {
      // Check if it extends a set
      if (meld.length >= 3 && meld.every(c => c.rank === meld[0].rank)) {
        if (card.rank === meld[0].rank && meld.length < 4)
          return true;
      }
      // Check if it extends a run
      const suitCards = meld.filter(c => c.suit === card.suit);
      if (suitCards.length === meld.length && meld.length >= 3) {
        const ranks = meld.map(c => rankIndex(c)).sort((a, b) => a - b);
        const ci = rankIndex(card);
        if (ci === ranks[0] - 1 || ci === ranks[ranks.length - 1] + 1)
          return true;
      }
    }
    return false;
  }

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function aiShouldDrawDiscard() {
    if (discardPile.length === 0) return false;
    const topDiscard = discardPile[discardPile.length - 1];
    // Simulate adding discard to hand
    const testHand = aiHand.concat(topDiscard);
    const before = findBestMelds(aiHand);
    const after = findBestMelds(testHand);
    // Draw from discard if it reduces deadwood by completing/extending a meld
    return after.melds.length > before.melds.length || after.deadwoodValue < before.deadwoodValue - 2;
  }

  function aiChooseDiscard() {
    // Try discarding each card, pick the one that leaves lowest deadwood
    let bestIdx = 0;
    let bestDW = Infinity;
    for (let i = 0; i < aiHand.length; ++i) {
      const testHand = aiHand.filter((_, j) => j !== i);
      const result = findBestMelds(testHand);
      if (result.deadwoodValue < bestDW) {
        bestDW = result.deadwoodValue;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function aiShouldKnock() {
    const dw = calcDeadwood(aiHand);
    if (dw === 0) return true;  // Always gin
    return dw <= 5;             // Conservative: knock at 5 or below
  }

  /* ══════════════════════════════════════════════════════════════════
     ROUND RESOLUTION
     ══════════════════════════════════════════════════════════════════ */

  function resolveKnock(knockerIdx) {
    knocker = knockerIdx;
    const pResult = findBestMelds(playerHand);
    const aResult = findBestMelds(aiHand);

    playerMelds = pResult.melds;
    playerDeadwood = pResult.deadwood;
    aiMelds = aResult.melds;
    aiDeadwood = aResult.deadwood;
    layoffCards = [];

    let knockerDW, defenderDW;
    let knockerMelds;

    if (knockerIdx === 0) {
      knockerDW = pResult.deadwoodValue;
      defenderDW = aResult.deadwoodValue;
      knockerMelds = playerMelds;
      isGin = knockerDW === 0;

      // AI lays off on player melds (unless gin)
      if (!isGin) {
        const remainingDeadwood = [];
        for (const card of aiDeadwood) {
          if (canLayOff(card, knockerMelds)) {
            layoffCards.push(card);
            defenderDW -= cardValue(card);
          } else
            remainingDeadwood.push(card);
        }
        aiDeadwood = remainingDeadwood;
      }
    } else {
      knockerDW = aResult.deadwoodValue;
      defenderDW = pResult.deadwoodValue;
      knockerMelds = aiMelds;
      isGin = knockerDW === 0;

      // Player lays off on AI melds (automatic for simplicity)
      if (!isGin) {
        const remainingDeadwood = [];
        for (const card of playerDeadwood) {
          if (canLayOff(card, knockerMelds)) {
            layoffCards.push(card);
            defenderDW -= cardValue(card);
          } else
            remainingDeadwood.push(card);
        }
        playerDeadwood = remainingDeadwood;
      }
    }

    // Scoring
    let roundPoints = 0;
    let winnerIdx;

    if (isGin) {
      // Gin bonus: 25 + opponent's deadwood
      roundPoints = 25 + defenderDW;
      winnerIdx = knockerIdx;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'GIN!', { color: '#ff0', size: 32 });
    } else if (knockerDW < defenderDW) {
      // Normal knock: difference in deadwood
      roundPoints = defenderDW - knockerDW;
      winnerIdx = knockerIdx;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Knock!', { color: '#4f4', size: 24 });
    } else {
      // Undercut: defender gets 25 + difference
      roundPoints = 25 + (knockerDW - defenderDW);
      winnerIdx = knockerIdx === 0 ? 1 : 0;
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'Undercut!', { color: '#f84', size: 26 });
    }

    if (winnerIdx === 0) {
      score += roundPoints;
      resultMsg = 'You score ' + roundPoints + ' points!';
      if (_host) {
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
        _host.particles.confetti(CANVAS_W / 2, 300, 20);
      }
    } else {
      aiScore += roundPoints;
      resultMsg = 'AI scores ' + roundPoints + ' points.';
      if (_host) _host.screenShake.trigger(6, 300);
    }

    if (_host) _host.onScoreChanged(score);

    // Check game over at 100
    if (score >= 100) {
      gameOver = true;
      resultMsg = 'You win the game! Final: ' + score + ' - ' + aiScore;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
    } else if (aiScore >= 100) {
      gameOver = true;
      resultMsg = 'AI wins the game! Final: ' + aiScore + ' - ' + score;
      if (_host) _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
    }

    roundOver = true;
    phase = PHASE_ROUND_REVEAL;
  }

  /* ══════════════════════════════════════════════════════════════════
     SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupGinRummy() {
    const deck = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHand = [];
    discardPile = [];
    stockPile = [];
    roundOver = false;
    phase = PHASE_PLAYER_DRAW;
    selectedCardIndex = -1;
    resultMsg = '';
    knocker = -1;
    isGin = false;
    playerMelds = [];
    aiMelds = [];
    playerDeadwood = [];
    aiDeadwood = [];
    layoffCards = [];
    aiTimer = 0;
    aiDrawn = false;

    // Deal 10 cards each
    for (let i = 0; i < 10; ++i) {
      const pc = deck.pop();
      pc.faceUp = true;
      playerHand.push(pc);
      if (_host) _host.dealCardAnim(pc, CANVAS_W / 2, -CE.CARD_H, 90 + i * 68, 460, i * 0.08);
      const ac = deck.pop();
      aiHand.push(ac);
    }

    // Turn one card face-up for discard
    const top = deck.pop();
    top.faceUp = true;
    discardPile.push(top);

    // Rest is stock
    stockPile = deck;
    sortHand(playerHand);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGinRummy() {
    // Scores
    _ctx.fillStyle = '#fa0';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('You: ' + score, 20, 20);
    _ctx.fillText('AI: ' + aiScore, 20, 38);
    _ctx.fillStyle = '#aaa';
    _ctx.font = '12px sans-serif';
    _ctx.fillText('First to 100 wins', 20, 56);

    if (phase === PHASE_ROUND_REVEAL) {
      drawReveal();
      return;
    }

    // AI hand (face down) at top
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI (' + aiHand.length + ' cards)', 90, 55);
    for (let i = 0; i < aiHand.length; ++i)
      CE.drawCardBack(_ctx, 90 + i * 30, 70, CE.CARD_W * 0.7, CE.CARD_H * 0.7);

    // Stock pile
    if (stockPile.length > 0) {
      CE.drawCardBack(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('' + stockPile.length, STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 14);
    } else {
      _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
    }
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Stock', STOCK_X + CE.CARD_W / 2, STOCK_Y - 8);

    // Discard pile
    if (discardPile.length > 0)
      CE.drawCardFace(_ctx, DISCARD_X, DISCARD_Y, discardPile[discardPile.length - 1], CE.CARD_W, CE.CARD_H);
    else {
      _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
    }
    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Discard', DISCARD_X + CE.CARD_W / 2, DISCARD_Y - 8);

    // Player hand at bottom
    _ctx.fillStyle = '#fff';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'left';
    const dwVal = calcDeadwood(playerHand);
    _ctx.fillText('Your Hand (deadwood: ' + dwVal + ')', 90, 445);
    const handSpacing = Math.min(68, (CANVAS_W - 180) / Math.max(playerHand.length, 1));
    for (let i = 0; i < playerHand.length; ++i) {
      if (playerHand[i]._dealing) continue;
      const x = 90 + i * handSpacing;
      const y = (i === selectedCardIndex) ? 450 : 460;
      CE.drawCardFace(_ctx, x, y, playerHand[i], CE.CARD_W, CE.CARD_H);
      if (_host && _host.hintsEnabled && cardHasHint(playerHand, i))
        CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);
      if (i === selectedCardIndex) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }

    // Phase prompts
    _ctx.fillStyle = '#8f8';
    _ctx.font = '13px sans-serif';
    _ctx.textAlign = 'center';
    if (phase === PHASE_PLAYER_DRAW)
      _ctx.fillText('Draw from Stock or Discard pile', CANVAS_W / 2, 410);
    else if (phase === PHASE_PLAYER_DISCARD)
      _ctx.fillText('Click a card in your hand to discard it', CANVAS_W / 2, 410);
    else if (phase === PHASE_AI_THINKING) {
      _ctx.fillStyle = '#ff8';
      _ctx.fillText('AI is thinking...', CANVAS_W / 2, 410);
    }

    // Knock button (player's discard phase, deadwood <= 10)
    if (phase === PHASE_PLAYER_DISCARD && dwVal <= 10)
      CE.drawButton(_ctx, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h, dwVal === 0 ? 'Gin! (K)' : 'Knock (K)', { bg: '#5a4a0a', border: '#cc8' });

    // Result message
    if (resultMsg) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H - 15);
    }
  }

  function drawReveal() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(knocker === 0 ? 'You knocked!' : 'AI knocked!', CANVAS_W / 2, 75);
    if (isGin)
      _ctx.fillText(knocker === 0 ? 'GIN!' : 'AI has Gin!', CANVAS_W / 2, 95);

    // Draw player melds
    _ctx.fillStyle = '#aaf';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('Your Melds:', 30, 420);
    let px = 30;
    for (let m = 0; m < playerMelds.length; ++m) {
      for (let c = 0; c < playerMelds[m].length; ++c) {
        CE.drawCardFace(_ctx, px, 435, playerMelds[m][c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
        px += 38;
      }
      px += 12;
    }
    // Player deadwood
    if (playerDeadwood.length > 0) {
      _ctx.fillStyle = '#f88';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('Deadwood:', px + 4, 420);
      for (let c = 0; c < playerDeadwood.length; ++c)
        CE.drawCardFace(_ctx, px + 4 + c * 38, 435, playerDeadwood[c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
    }

    // Draw AI melds
    _ctx.fillStyle = '#aaf';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.fillText('AI Melds:', 30, 115);
    let ax = 30;
    for (let m = 0; m < aiMelds.length; ++m) {
      for (let c = 0; c < aiMelds[m].length; ++c) {
        CE.drawCardFace(_ctx, ax, 130, aiMelds[m][c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
        ax += 38;
      }
      ax += 12;
    }
    // AI deadwood
    if (aiDeadwood.length > 0) {
      _ctx.fillStyle = '#f88';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('Deadwood:', ax + 4, 115);
      for (let c = 0; c < aiDeadwood.length; ++c)
        CE.drawCardFace(_ctx, ax + 4 + c * 38, 130, aiDeadwood[c], CE.CARD_W * 0.65, CE.CARD_H * 0.65);
    }

    // Layoff info
    if (layoffCards.length > 0) {
      _ctx.fillStyle = '#ff8';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Laid off ' + layoffCards.length + ' card(s) on opponent\u2019s melds', CANVAS_W / 2, 280);
    }

    // Deadwood totals
    const pDW = playerDeadwood.reduce((s, c) => s + cardValue(c), 0);
    const aDW = aiDeadwood.reduce((s, c) => s + cardValue(c), 0);
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 14px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Your deadwood: ' + pDW + '    AI deadwood: ' + aDW, CANVAS_W / 2, 310);

    // Result
    _ctx.fillStyle = '#ff0';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.fillText(resultMsg, CANVAS_W / 2, 350);

    // Continue prompt
    _ctx.fillStyle = '#8f8';
    _ctx.font = '13px sans-serif';
    _ctx.fillText('Click to continue', CANVAS_W / 2, 385);
  }

  /* ══════════════════════════════════════════════════════════════════
     PLAYER ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function playerDrawStock() {
    if (stockPile.length === 0) {
      // Reshuffle discard into stock, keep top card
      if (discardPile.length <= 1) return;
      const top = discardPile.pop();
      stockPile = CE.shuffle(discardPile);
      discardPile = [top];
    }
    const card = stockPile.pop();
    card.faceUp = true;
    playerHand.push(card);
    if (_host) _host.dealCardAnim(card, STOCK_X, STOCK_Y, 90 + (playerHand.length - 1) * 68, 460, 0);
    phase = PHASE_PLAYER_DISCARD;
    selectedCardIndex = -1;
  }

  function playerDrawDiscard() {
    if (discardPile.length === 0) return;
    const card = discardPile.pop();
    card.faceUp = true;
    playerHand.push(card);
    if (_host) _host.dealCardAnim(card, DISCARD_X, DISCARD_Y, 90 + (playerHand.length - 1) * 68, 460, 0);
    phase = PHASE_PLAYER_DISCARD;
    selectedCardIndex = -1;
  }

  function playerDiscard(index) {
    if (index < 0 || index >= playerHand.length) return;
    const card = playerHand.splice(index, 1)[0];
    card.faceUp = true;
    discardPile.push(card);
    selectedCardIndex = -1;
    sortHand(playerHand);
    // Now AI's turn
    phase = PHASE_AI_THINKING;
    aiTimer = 0;
    aiDrawn = false;
  }

  function playerKnock() {
    if (playerHand.length !== 11) return;
    // Must discard first, then knock -- but we allow knock during discard phase
    // If hand has 11 cards, we need to discard one first
    // Actually, the knock should happen after the hand is at 10 cards
    // So: select a card to discard, then knock with remaining 10

    // For simplicity: if selectedCardIndex is set, discard that card then knock
    if (selectedCardIndex >= 0) {
      const card = playerHand.splice(selectedCardIndex, 1)[0];
      card.faceUp = true;
      discardPile.push(card);
      selectedCardIndex = -1;
      sortHand(playerHand);
      resolveKnock(0);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     AI TURN
     ══════════════════════════════════════════════════════════════════ */

  function aiTakeTurn() {
    if (!aiDrawn) {
      // Draw phase
      if (aiShouldDrawDiscard())
        aiHand.push(discardPile.pop());
      else if (stockPile.length > 0)
        aiHand.push(stockPile.pop());
      else if (discardPile.length > 1) {
        // Reshuffle
        const top = discardPile.pop();
        stockPile = CE.shuffle(discardPile);
        discardPile = [top];
        aiHand.push(stockPile.pop());
      } else
        return; // No cards available
      aiDrawn = true;
      aiTimer = 0;
      return;
    }

    // Discard phase
    const discIdx = aiChooseDiscard();
    const card = aiHand.splice(discIdx, 1)[0];
    card.faceUp = true;
    discardPile.push(card);

    // Check if AI should knock
    const dw = calcDeadwood(aiHand);
    if (dw === 0) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'AI declares Gin!', { color: '#f44', size: 24 });
      resolveKnock(1);
      return;
    }
    if (dw <= 5) {
      if (_host) _host.floatingText.add(CANVAS_W / 2, 200, 'AI knocks!', { color: '#f84', size: 22 });
      resolveKnock(1);
      return;
    }

    // Back to player
    phase = PHASE_PLAYER_DRAW;
    selectedCardIndex = -1;

    // Check if stock is empty -- if 2 or fewer cards left, round is a draw
    if (stockPile.length <= 2) {
      roundOver = true;
      resultMsg = 'Draw -- stock depleted. Click to continue.';
      phase = PHASE_ROUND_REVEAL;
      playerMelds = findBestMelds(playerHand).melds;
      playerDeadwood = findBestMelds(playerHand).deadwood;
      aiMelds = findBestMelds(aiHand).melds;
      aiDeadwood = findBestMelds(aiHand).deadwood;
      knocker = -1;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MODULE INTERFACE
     ══════════════════════════════════════════════════════════════════ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      aiScore = 0;
      setupGinRummy();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGinRummy();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host) _host.onRoundOver(gameOver);
        return;
      }

      // Player draw phase: click stock or discard
      if (phase === PHASE_PLAYER_DRAW) {
        if (CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H)) {
          playerDrawStock();
          return;
        }
        if (CE.isInRect(mx, my, DISCARD_X, DISCARD_Y, CE.CARD_W, CE.CARD_H) && discardPile.length > 0) {
          playerDrawDiscard();
          return;
        }
        return;
      }

      // Player discard phase: click card in hand to select/discard, or knock
      if (phase === PHASE_PLAYER_DISCARD) {
        // Check knock button
        const dwVal = calcDeadwood(playerHand);
        if (dwVal <= 10 && selectedCardIndex >= 0 && CE.isInRect(mx, my, KNOCK_BTN.x, KNOCK_BTN.y, KNOCK_BTN.w, KNOCK_BTN.h)) {
          playerKnock();
          return;
        }

        // Click on hand cards
        const handSpacing = Math.min(68, (CANVAS_W - 180) / Math.max(playerHand.length, 1));
        for (let i = playerHand.length - 1; i >= 0; --i) {
          const cx = 90 + i * handSpacing;
          const cy = (i === selectedCardIndex) ? 450 : 460;
          if (mx >= cx && mx <= cx + CE.CARD_W && my >= cy && my <= cy + CE.CARD_H) {
            if (i === selectedCardIndex) {
              // Second click on same card = discard it
              playerDiscard(i);
            } else
              selectedCardIndex = i;
            return;
          }
        }
      }
    },

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (phase === PHASE_PLAYER_DISCARD) {
        if ((e.key === 'k' || e.key === 'K') && selectedCardIndex >= 0) {
          const dwVal = calcDeadwood(playerHand);
          if (dwVal <= 10)
            playerKnock();
        }
      }
    },

    tick(dt) {
      if (roundOver || gameOver) return;
      if (phase !== PHASE_AI_THINKING) return;

      aiTimer += dt;
      if (aiTimer >= AI_DELAY)
        aiTakeTurn();
    },

    handlePointerMove() {},
    handlePointerUp() {},

    cleanup() {
      playerHand = [];
      aiHand = [];
      stockPile = [];
      discardPile = [];
      roundOver = false;
      gameOver = false;
      phase = PHASE_PLAYER_DRAW;
      selectedCardIndex = -1;
      resultMsg = '';
      knocker = -1;
      playerMelds = [];
      aiMelds = [];
      playerDeadwood = [];
      aiDeadwood = [];
      layoffCards = [];
      aiTimer = 0;
      aiDrawn = false;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('ginrummy', module);

})();
