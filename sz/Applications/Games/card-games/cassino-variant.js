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

  const CAPTURE_VALUES = {
    'A': 1, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13
  };

  const WINNING_SCORE = 21;

  const PHASE_PLAY = 0;
  const PHASE_SELECT_TABLE = 1;
  const PHASE_AI_TURN = 2;
  const PHASE_ROUND_OVER = 3;

  const AI_TURN_DELAY = 0.9;

  const ACTION_CAPTURE = 'capture';
  const ACTION_BUILD = 'build';
  const ACTION_TRAIL = 'trail';

  /* ================================================================
     GAME STATE
     ================================================================ */

  let playerHand = [];
  let aiHand = [];
  let table = [];        // mix of cards and build objects
  let stock = [];
  let playerCaptures = [];
  let aiCaptures = [];
  let playerSweeps = 0;
  let aiSweeps = 0;
  let cumulativePlayer = 0;
  let cumulativeAI = 0;
  let lastCapturer = -1; // 0 = player, 1 = AI

  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let phase = PHASE_PLAY;
  let roundNumber = 0;

  let selectedHandIdx = -1;
  let selectedTableIdxs = [];
  let hoverHandIdx = -1;
  let hoverTableIdx = -1;

  let aiTurnTimer = 0;
  let roundBreakdown = null;

  let _ctx = null;
  let _host = null;

  /* ================================================================
     BUILD OBJECT
     A build is a stack of cards on the table with a declared sum.
     { isBuild: true, cards: [...], value: N, owner: 0|1 }
     ================================================================ */

  function makeBuild(cards, value, owner) {
    return { isBuild: true, cards, value, owner, faceUp: true };
  }

  function isBuild(item) {
    return item && item.isBuild === true;
  }

  /* ================================================================
     CARD VALUE HELPERS
     ================================================================ */

  function captureValue(card) {
    if (isBuild(card)) return card.value;
    return CAPTURE_VALUES[card.rank] || 0;
  }

  function isAce(card) {
    return !isBuild(card) && card.rank === 'A';
  }

  function isBigCassino(card) {
    return !isBuild(card) && card.rank === '10' && card.suit === 'diamonds';
  }

  function isLittleCassino(card) {
    return !isBuild(card) && card.rank === '2' && card.suit === 'spades';
  }

  function isSpade(card) {
    return !isBuild(card) && card.suit === 'spades';
  }

  /* ================================================================
     CAPTURE LOGIC
     Find all valid capture combinations from table items matching
     a given target value. Each combo is an array of table indices.
     A build can only be captured as a whole (single index).
     ================================================================ */

  function findCaptureCombinations(targetVal, tableItems) {
    const results = [];
    const n = tableItems.length;

    for (let mask = 1; mask < (1 << n); ++mask) {
      let sum = 0;
      const idxs = [];
      for (let b = 0; b < n; ++b) {
        if (mask & (1 << b)) {
          sum += captureValue(tableItems[b]);
          idxs.push(b);
        }
      }
      if (sum === targetVal)
        results.push(idxs);
    }

    return results;
  }

  function canCapture(card) {
    return findCaptureCombinations(captureValue(card), table).length > 0;
  }

  function selectedTableSum() {
    let sum = 0;
    for (const idx of selectedTableIdxs)
      sum += captureValue(table[idx]);
    return sum;
  }

  /* ================================================================
     BUILD LOGIC
     Can the player combine their card with selected table items
     to form a build, if they hold a card matching the build value?
     ================================================================ */

  function canBuildWith(handCard, tableIdxs, hand) {
    if (tableIdxs.length === 0) return false;
    let sum = captureValue(handCard);
    for (const idx of tableIdxs)
      sum += captureValue(table[idx]);
    if (sum > 13) return false;

    // Player must hold another card with this value (not the card being played)
    for (let i = 0; i < hand.length; ++i) {
      const c = hand[i];
      if (c === handCard) continue;
      if (captureValue(c) === sum) return true;
    }
    return false;
  }

  function findPossibleBuilds(handCard, hand) {
    const results = [];
    const n = table.length;
    const cardVal = captureValue(handCard);

    for (let mask = 1; mask < (1 << n); ++mask) {
      let sum = cardVal;
      const idxs = [];
      for (let b = 0; b < n; ++b) {
        if (mask & (1 << b)) {
          sum += captureValue(table[b]);
          idxs.push(b);
        }
      }
      if (sum > 13 || sum <= cardVal) continue;

      // Must hold another card matching the build value
      for (let i = 0; i < hand.length; ++i) {
        const c = hand[i];
        if (c === handCard) continue;
        if (captureValue(c) === sum) {
          results.push({ tableIdxs: idxs, buildValue: sum });
          break;
        }
      }
    }
    return results;
  }

  /* ================================================================
     GAME FLOW
     ================================================================ */

  function dealHands() {
    for (let i = 0; i < 4; ++i) {
      if (stock.length > 0) {
        const pc = stock.pop();
        pc.faceUp = true;
        playerHand.push(pc);
      }
      if (stock.length > 0) {
        const ac = stock.pop();
        ac.faceUp = false;
        aiHand.push(ac);
      }
    }

    if (_host) {
      for (let i = 0; i < playerHand.length; ++i)
        _host.dealCardAnim && _host.dealCardAnim(playerHand[i], CANVAS_W / 2, -CE.CARD_H, playerCardX(i, playerHand.length), PLAYER_HAND_Y, i * 0.08);
    }
  }

  function setupRound() {
    const d = CE.shuffle(CE.createDeck());
    playerHand = [];
    aiHand = [];
    table = [];
    stock = d;
    playerCaptures = [];
    aiCaptures = [];
    playerSweeps = 0;
    aiSweeps = 0;
    lastCapturer = -1;
    roundOver = false;
    roundBreakdown = null;
    selectedHandIdx = -1;
    selectedTableIdxs = [];
    hoverHandIdx = -1;
    hoverTableIdx = -1;
    aiTurnTimer = 0;

    // Place 4 cards on the table
    for (let i = 0; i < 4; ++i) {
      const c = stock.pop();
      c.faceUp = true;
      table.push(c);
    }

    // Deal 4 to each
    dealHands();
    phase = PHASE_PLAY;
  }

  function performCapture(who, handCard, tableIdxs) {
    const captures = who === 0 ? playerCaptures : aiCaptures;
    const captured = [];

    // Remove table items (descending order to preserve indices)
    const sorted = tableIdxs.slice().sort((a, b) => b - a);
    for (const idx of sorted) {
      const item = table.splice(idx, 1)[0];
      if (isBuild(item)) {
        for (const c of item.cards)
          captured.push(c);
      } else
        captured.push(item);
    }

    captures.push(handCard);
    for (const c of captured)
      captures.push(c);

    // Check sweep (cleared entire table)
    if (table.length === 0) {
      if (who === 0) {
        ++playerSweeps;
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'SWEEP!', { color: '#ff0', size: 28 });
          _host.particles && _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 20);
        }
      } else {
        ++aiSweeps;
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'AI Sweep!', { color: '#fa0', size: 22 });
      }
    }

    lastCapturer = who;
  }

  function performBuild(who, handCard, tableIdxs, buildValue) {
    const buildCards = [handCard];
    // Collect table items (descending order)
    const sorted = tableIdxs.slice().sort((a, b) => b - a);
    for (const idx of sorted) {
      const item = table.splice(idx, 1)[0];
      if (isBuild(item)) {
        for (const c of item.cards)
          buildCards.push(c);
      } else
        buildCards.push(item);
    }

    const build = makeBuild(buildCards, buildValue, who);
    table.push(build);

    if (_host) {
      const label = who === 0 ? 'Build ' + buildValue : 'AI builds ' + buildValue;
      const color = who === 0 ? '#8cf' : '#fa0';
      _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, label, { color, size: 16 });
    }
  }

  function playCardToTable(who, card) {
    card.faceUp = true;
    table.push(card);
  }

  function playerPlayCapture(handIdx, tableIdxs) {
    const card = playerHand.splice(handIdx, 1)[0];
    performCapture(0, card, tableIdxs);
    if (_host) {
      const count = tableIdxs.length;
      _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 40, 'Captured ' + (count + 1) + ' cards', { color: '#8f8', size: 14 });
    }
    selectedHandIdx = -1;
    selectedTableIdxs = [];
    afterTurn();
  }

  function playerPlayBuild(handIdx, tableIdxs, buildValue) {
    const card = playerHand.splice(handIdx, 1)[0];
    performBuild(0, card, tableIdxs, buildValue);
    selectedHandIdx = -1;
    selectedTableIdxs = [];
    afterTurn();
  }

  function playerPlayTrail(handIdx) {
    const card = playerHand.splice(handIdx, 1)[0];
    playCardToTable(0, card);
    selectedHandIdx = -1;
    selectedTableIdxs = [];
    afterTurn();
  }

  function afterTurn() {
    // Check if hands empty => re-deal or end round
    if (playerHand.length === 0 && aiHand.length === 0) {
      if (stock.length > 0) {
        dealHands();
        phase = PHASE_PLAY;
        return;
      }
      // End of round: last capturer takes remaining table cards
      if (table.length > 0 && lastCapturer >= 0) {
        const captures = lastCapturer === 0 ? playerCaptures : aiCaptures;
        while (table.length > 0) {
          const item = table.pop();
          if (isBuild(item)) {
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
    if (phase === PHASE_PLAY || phase === PHASE_SELECT_TABLE) {
      phase = PHASE_AI_TURN;
      aiTurnTimer = 0;
    }
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiChoosePlay() {
    const hand = aiHand;
    if (hand.length === 0) return null;

    let bestPlay = null;
    let bestScore = -Infinity;

    for (let hi = 0; hi < hand.length; ++hi) {
      const card = hand[hi];
      const val = captureValue(card);
      const combos = findCaptureCombinations(val, table);

      // Evaluate captures
      for (const combo of combos) {
        let s = 10;
        const capturedCards = [];
        for (const ci of combo) {
          if (isBuild(table[ci])) {
            for (const bc of table[ci].cards)
              capturedCards.push(bc);
          } else
            capturedCards.push(table[ci]);
        }

        // High-value card bonuses
        for (const c of capturedCards) {
          if (isBigCassino(c)) s += 80;
          if (isLittleCassino(c)) s += 40;
          if (isAce(c)) s += 30;
          if (isSpade(c)) s += 5;
        }
        if (isBigCassino(card)) s += 40;
        if (isLittleCassino(card)) s += 20;
        if (isAce(card)) s += 15;

        // More cards captured = better
        s += capturedCards.length * 3;

        // Sweep bonus
        if (combo.length === table.length)
          s += 60;

        if (s > bestScore) {
          bestScore = s;
          bestPlay = { action: ACTION_CAPTURE, handIdx: hi, tableIdxs: combo };
        }
      }

      // Evaluate builds
      const builds = findPossibleBuilds(card, hand);
      for (const b of builds) {
        let s = 5;
        // Prefer builds toward high values
        s += b.buildValue;
        // Bonus if build captures valuable cards later
        for (const ci of b.tableIdxs) {
          if (!isBuild(table[ci])) {
            if (isBigCassino(table[ci])) s += 30;
            if (isLittleCassino(table[ci])) s += 15;
            if (isAce(table[ci])) s += 10;
          }
        }
        if (s > bestScore) {
          bestScore = s;
          bestPlay = { action: ACTION_BUILD, handIdx: hi, tableIdxs: b.tableIdxs, buildValue: b.buildValue };
        }
      }
    }

    // If no capture or build found, trail least valuable card
    if (!bestPlay) {
      let worstIdx = 0;
      let worstVal = Infinity;
      for (let hi = 0; hi < hand.length; ++hi) {
        const card = hand[hi];
        let v = captureValue(card);
        // Penalize trailing high-value cards
        if (isBigCassino(card)) v += 100;
        if (isLittleCassino(card)) v += 50;
        if (isAce(card)) v += 40;
        if (isSpade(card)) v += 5;
        // Don't trail a card that is needed for a build on the table
        for (const item of table) {
          if (isBuild(item) && item.owner === 1 && item.value === captureValue(card))
            v += 200;
        }
        if (v < worstVal) {
          worstVal = v;
          worstIdx = hi;
        }
      }
      bestPlay = { action: ACTION_TRAIL, handIdx: worstIdx };
    }

    return bestPlay;
  }

  function aiTakeTurn() {
    const play = aiChoosePlay();
    if (!play) {
      afterTurn();
      return;
    }

    const card = aiHand.splice(play.handIdx, 1)[0];
    card.faceUp = true;

    if (play.action === ACTION_CAPTURE) {
      performCapture(1, card, play.tableIdxs);
      if (_host) {
        const count = play.tableIdxs.length;
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI captures ' + (count + 1) + ' cards', { color: '#fa0', size: 14 });
      }
    } else if (play.action === ACTION_BUILD) {
      performBuild(1, card, play.tableIdxs, play.buildValue);
    } else {
      playCardToTable(1, card);
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 180, 'AI trails', { color: '#aaa', size: 12 });
    }

    // Switch back to player
    if (playerHand.length > 0)
      phase = PHASE_PLAY;
    else
      afterTurn();
  }

  /* ================================================================
     SCORING
     ================================================================ */

  function countSpades(captures) {
    let n = 0;
    for (const c of captures)
      if (c.suit === 'spades') ++n;
    return n;
  }

  function countAces(captures) {
    let n = 0;
    for (const c of captures)
      if (c.rank === 'A') ++n;
    return n;
  }

  function hasBigCassino(captures) {
    for (const c of captures)
      if (c.rank === '10' && c.suit === 'diamonds') return true;
    return false;
  }

  function hasLittleCassino(captures) {
    for (const c of captures)
      if (c.rank === '2' && c.suit === 'spades') return true;
    return false;
  }

  function scoreRound() {
    let pPts = 0;
    let aPts = 0;
    const details = { player: {}, ai: {} };

    // Most cards (27+)
    details.player.cards = playerCaptures.length;
    details.ai.cards = aiCaptures.length;
    if (playerCaptures.length > 26) ++pPts;
    if (aiCaptures.length > 26) ++aPts;
    details.player.cardsWin = playerCaptures.length > 26;
    details.ai.cardsWin = aiCaptures.length > 26;

    // Most spades (7+)
    const pSpades = countSpades(playerCaptures);
    const aSpades = countSpades(aiCaptures);
    details.player.spades = pSpades;
    details.ai.spades = aSpades;
    if (pSpades > aSpades) ++pPts;
    else if (aSpades > pSpades) ++aPts;
    details.player.spadesWin = pSpades > aSpades;
    details.ai.spadesWin = aSpades > pSpades;

    // Big Cassino (10 of diamonds) = 2pts
    const pBig = hasBigCassino(playerCaptures);
    const aBig = hasBigCassino(aiCaptures);
    if (pBig) pPts += 2;
    if (aBig) aPts += 2;
    details.player.bigCassino = pBig;
    details.ai.bigCassino = aBig;

    // Little Cassino (2 of spades) = 1pt
    const pLittle = hasLittleCassino(playerCaptures);
    const aLittle = hasLittleCassino(aiCaptures);
    if (pLittle) ++pPts;
    if (aLittle) ++aPts;
    details.player.littleCassino = pLittle;
    details.ai.littleCassino = aLittle;

    // Aces = 1pt each
    const pAces = countAces(playerCaptures);
    const aAces = countAces(aiCaptures);
    pPts += pAces;
    aPts += aAces;
    details.player.aces = pAces;
    details.ai.aces = aAces;

    // Sweeps
    pPts += playerSweeps;
    aPts += aiSweeps;
    details.player.sweeps = playerSweeps;
    details.ai.sweeps = aiSweeps;

    details.player.total = pPts;
    details.ai.total = aPts;
    return details;
  }

  function endRound() {
    roundOver = true;
    phase = PHASE_ROUND_OVER;
    ++roundNumber;

    roundBreakdown = scoreRound();

    cumulativePlayer += roundBreakdown.player.total;
    cumulativeAI += roundBreakdown.ai.total;

    score = cumulativePlayer * 10;
    if (_host) _host.onScoreChanged(score);

    if (cumulativePlayer >= WINNING_SCORE || cumulativeAI >= WINNING_SCORE) {
      gameOver = true;
      if (cumulativePlayer >= WINNING_SCORE && cumulativePlayer > cumulativeAI) {
        if (_host) {
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'YOU WIN!', { color: '#4f4', size: 28 });
          _host.particles && _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
          _host.triggerChipSparkle && _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H / 2);
        }
      } else if (cumulativeAI >= WINNING_SCORE && cumulativeAI > cumulativePlayer) {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'AI WINS', { color: '#f44', size: 28 });
      } else {
        // Tie at or above threshold -- continue
        gameOver = false;
      }
    }

    if (gameOver && _host)
      _host.onRoundOver(true);
  }

  /* ================================================================
     LAYOUT POSITIONS
     ================================================================ */

  const PLAYER_HAND_Y = CANVAS_H - CE.CARD_H - 25;
  const AI_HAND_Y = 15;
  const TABLE_Y = CANVAS_H / 2 - CE.CARD_H / 2 - 10;
  const TABLE_MAX_PER_ROW = 7;

  function playerCardX(idx, total) {
    const spacing = Math.min(80, 400 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return startX + idx * spacing;
  }

  function tableCardPos(idx) {
    const row = Math.floor(idx / TABLE_MAX_PER_ROW);
    const col = idx % TABLE_MAX_PER_ROW;
    const itemsInRow = Math.min(table.length - row * TABLE_MAX_PER_ROW, TABLE_MAX_PER_ROW);
    const spacing = Math.min(85, 560 / Math.max(itemsInRow - 1, 1));
    const fanWidth = (itemsInRow - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W / 2;
    return {
      x: startX + col * spacing,
      y: TABLE_Y + row * (CE.CARD_H + 10)
    };
  }

  function aiCardX(idx, total) {
    const spacing = Math.min(35, 300 / Math.max(total - 1, 1));
    const fanWidth = (total - 1) * spacing;
    const startX = (CANVAS_W - fanWidth) / 2 - CE.CARD_W * 0.5 / 2;
    return startX + idx * spacing;
  }

  /* ================================================================
     CAPTURE PILE & SCORE AREAS
     ================================================================ */

  const PLAYER_PILE_X = 20;
  const PLAYER_PILE_Y = CANVAS_H / 2 + 60;
  const AI_PILE_X = CANVAS_W - 110;
  const AI_PILE_Y = 100;

  const BTN_Y = PLAYER_HAND_Y - 38;
  const CAPTURE_BTN = { x: CANVAS_W / 2 - 165, y: BTN_Y, w: 100, h: 28 };
  const BUILD_BTN = { x: CANVAS_W / 2 - 50, y: BTN_Y, w: 100, h: 28 };
  const TRAIL_BTN = { x: CANVAS_W / 2 + 65, y: BTN_Y, w: 100, h: 28 };

  /* ================================================================
     BUTTON STATE HELPERS
     ================================================================ */

  function canPlayerCapture() {
    if (selectedHandIdx < 0) return false;
    const card = playerHand[selectedHandIdx];
    const cardVal = captureValue(card);
    const sum = selectedTableSum();
    return sum === cardVal && selectedTableIdxs.length > 0;
  }

  function canPlayerBuild() {
    if (selectedHandIdx < 0 || selectedTableIdxs.length === 0) return false;
    return canBuildWith(playerHand[selectedHandIdx], selectedTableIdxs, playerHand);
  }

  function canPlayerTrail() {
    if (selectedHandIdx < 0) return false;
    // Cannot trail if you own a build on the table
    for (const item of table)
      if (isBuild(item) && item.owner === 0) return false;
    return true;
  }

  function buildValueForSelection() {
    if (selectedHandIdx < 0) return 0;
    let sum = captureValue(playerHand[selectedHandIdx]);
    for (const idx of selectedTableIdxs)
      sum += captureValue(table[idx]);
    return sum;
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawTitle() {
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 16px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Cassino', 20, 10);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '11px sans-serif';
    _ctx.fillText('Round ' + (roundNumber + 1) + '  |  Stock: ' + stock.length, 20, 30);
  }

  function drawScorePanel() {
    const px = CANVAS_W - 175;
    const py = 10;
    const pw = 165;
    const ph = 68;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.45)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 6);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'left';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Scores (first to ' + WINNING_SCORE + ')', px + 8, py + 8);

    _ctx.font = '11px sans-serif';
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You:', px + 8, py + 28);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + cumulativePlayer, px + pw - 8, py + 28);

    _ctx.textAlign = 'left';
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('AI:', px + 8, py + 46);
    _ctx.textAlign = 'right';
    _ctx.fillText('' + cumulativeAI, px + pw - 8, py + 46);
    _ctx.restore();
  }

  function drawCapturePile(x, y, captures, sweeps, label) {
    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.35)';
    CE.drawRoundedRect(_ctx, x, y, 90, 80, 5);
    _ctx.fill();

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(label, x + 45, y + 4);

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.fillText('' + captures.length, x + 45, y + 22);

    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.fillText('cards', x + 45, y + 44);

    if (sweeps > 0) {
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 11px sans-serif';
      _ctx.fillText('Sweeps: ' + sweeps, x + 45, y + 60);
    }

    _ctx.restore();
  }

  function drawPlayerHand() {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return;

    for (let i = 0; i < total; ++i) {
      if (hand[i]._dealing) continue;
      const x = playerCardX(i, total);
      let y = PLAYER_HAND_Y;

      if (i === selectedHandIdx) y -= 18;
      else if (i === hoverHandIdx && phase === PHASE_PLAY) y -= 8;

      CE.drawCardFace(_ctx, x, y, hand[i]);

      // Hint glow: highlight cards that can capture
      if (_host && _host.hintsEnabled && phase === PHASE_PLAY && selectedHandIdx < 0)
        if (canCapture(hand[i]))
          CE.drawHintGlow(_ctx, x, y, CE.CARD_W, CE.CARD_H, _host.hintTime);

      // Selection highlight
      if (i === selectedHandIdx) {
        _ctx.save();
        _ctx.strokeStyle = '#ff0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#ff0';
        _ctx.shadowBlur = 6;
        CE.drawRoundedRect(_ctx, x - 1, y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawAIHand() {
    const total = aiHand.length;
    if (total === 0) return;

    _ctx.fillStyle = '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('AI (' + total + ' cards)', CANVAS_W / 2, AI_HAND_Y - 2);

    const scaleW = CE.CARD_W * 0.5;
    const scaleH = CE.CARD_H * 0.5;
    for (let i = 0; i < total; ++i)
      CE.drawCardBack(_ctx, aiCardX(i, total), AI_HAND_Y, scaleW, scaleH);
  }

  function drawBuildItem(x, y, build) {
    // Draw stacked cards slightly offset
    const cards = build.cards;
    const offsetStep = 3;
    const numCards = Math.min(cards.length, 4);
    for (let i = 0; i < numCards; ++i) {
      const ox = x + i * offsetStep;
      const oy = y - i * offsetStep;
      if (i < numCards - 1) {
        // Draw small partial card backs for stack effect
        _ctx.save();
        _ctx.fillStyle = '#246';
        CE.drawRoundedRect(_ctx, ox, oy, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
        _ctx.fill();
        _ctx.strokeStyle = '#fff';
        _ctx.lineWidth = 0.5;
        _ctx.stroke();
        _ctx.restore();
      } else
        CE.drawCardFace(_ctx, ox, oy, cards[cards.length - 1]);
    }

    // Draw build value badge
    const badgeX = x + CE.CARD_W - 12;
    const badgeY = y - numCards * offsetStep - 8;
    _ctx.save();
    _ctx.fillStyle = build.owner === 0 ? '#2a6' : '#a62';
    _ctx.beginPath();
    _ctx.arc(badgeX, badgeY, 12, 0, Math.PI * 2);
    _ctx.fill();
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'middle';
    _ctx.fillText('' + build.value, badgeX, badgeY);
    _ctx.restore();
  }

  function drawTable() {
    if (table.length === 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.15)';
      _ctx.font = '13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Table empty', CANVAS_W / 2, TABLE_Y + CE.CARD_H / 2);
      return;
    }

    for (let i = 0; i < table.length; ++i) {
      const pos = tableCardPos(i);
      const item = table[i];

      if (isBuild(item))
        drawBuildItem(pos.x, pos.y, item);
      else
        CE.drawCardFace(_ctx, pos.x, pos.y, item);

      const isSelected = selectedTableIdxs.indexOf(i) >= 0;
      const isHovered = i === hoverTableIdx && phase === PHASE_SELECT_TABLE;

      // When a hand card is selected, hint valid table cards
      if (selectedHandIdx >= 0 && phase === PHASE_SELECT_TABLE) {
        if (_host && _host.hintsEnabled) {
          const cardVal = captureValue(playerHand[selectedHandIdx]);
          if (captureValue(item) <= cardVal)
            CE.drawHintGlow(_ctx, pos.x, pos.y, CE.CARD_W, CE.CARD_H, _host.hintTime);
        }
      }

      if (isSelected) {
        _ctx.save();
        _ctx.strokeStyle = '#0f0';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#0f0';
        _ctx.shadowBlur = 8;
        CE.drawRoundedRect(_ctx, pos.x - 2, pos.y - 2, CE.CARD_W + 4, CE.CARD_H + 4, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      } else if (isHovered) {
        _ctx.save();
        _ctx.strokeStyle = 'rgba(0,255,0,0.4)';
        _ctx.lineWidth = 2;
        CE.drawRoundedRect(_ctx, pos.x - 1, pos.y - 1, CE.CARD_W + 2, CE.CARD_H + 2, CE.CARD_RADIUS + 1);
        _ctx.stroke();
        _ctx.restore();
      }
    }
  }

  function drawActionButtons() {
    if (selectedHandIdx < 0 || phase !== PHASE_SELECT_TABLE) return;

    const cardVal = captureValue(playerHand[selectedHandIdx]);
    const currentSum = selectedTableSum();

    // Show sum info
    _ctx.fillStyle = '#ff0';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'bottom';
    if (selectedTableIdxs.length > 0)
      _ctx.fillText('Selected sum: ' + currentSum + ' / card value: ' + cardVal, CANVAS_W / 2, BTN_Y - 6);

    // Capture button
    if (canPlayerCapture())
      CE.drawButton(_ctx, CAPTURE_BTN.x, CAPTURE_BTN.y, CAPTURE_BTN.w, CAPTURE_BTN.h, 'Capture', { bg: '#2a5a2a', border: '#6c6', fontSize: 13 });
    else
      CE.drawButton(_ctx, CAPTURE_BTN.x, CAPTURE_BTN.y, CAPTURE_BTN.w, CAPTURE_BTN.h, 'Capture', { bg: '#333', border: '#666', fontSize: 13 });

    // Build button
    if (canPlayerBuild()) {
      const bv = buildValueForSelection();
      CE.drawButton(_ctx, BUILD_BTN.x, BUILD_BTN.y, BUILD_BTN.w, BUILD_BTN.h, 'Build ' + bv, { bg: '#2a3a5a', border: '#68c', fontSize: 13 });
    } else
      CE.drawButton(_ctx, BUILD_BTN.x, BUILD_BTN.y, BUILD_BTN.w, BUILD_BTN.h, 'Build', { bg: '#333', border: '#666', fontSize: 13 });

    // Trail button
    if (canPlayerTrail())
      CE.drawButton(_ctx, TRAIL_BTN.x, TRAIL_BTN.y, TRAIL_BTN.w, TRAIL_BTN.h, 'Trail', { bg: '#5a3a2a', border: '#c86', fontSize: 13 });
    else
      CE.drawButton(_ctx, TRAIL_BTN.x, TRAIL_BTN.y, TRAIL_BTN.w, TRAIL_BTN.h, 'Trail', { bg: '#333', border: '#666', fontSize: 13 });
  }

  function drawInstructions() {
    if (phase === PHASE_PLAY) {
      _ctx.fillStyle = '#8f8';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Your turn \u2014 click a card from your hand', CANVAS_W / 2, CANVAS_H - 6);
    } else if (phase === PHASE_SELECT_TABLE) {
      _ctx.fillStyle = '#8cf';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Select table cards, then Capture / Build / Trail', CANVAS_W / 2, CANVAS_H - 6);
    } else if (phase === PHASE_AI_TURN) {
      _ctx.fillStyle = '#fa0';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('AI is thinking...', CANVAS_W / 2, CANVAS_H - 6);
    }
  }

  function drawRoundOverUI() {
    if (!roundBreakdown) return;

    const px = CANVAS_W / 2 - 210;
    const py = 80;
    const pw = 420;
    const ph = 400;

    _ctx.save();
    _ctx.fillStyle = 'rgba(0,0,0,0.8)';
    CE.drawRoundedRect(_ctx, px, py, pw, ph, 10);
    _ctx.fill();

    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.textBaseline = 'top';
    _ctx.fillText(gameOver ? 'Game Over' : 'Round ' + roundNumber + ' Results', CANVAS_W / 2, py + 12);

    // Column headers
    const colY = py + 44;
    _ctx.font = 'bold 12px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillStyle = '#aaa';
    _ctx.fillText('Category', CANVAS_W / 2 - 80, colY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('You', CANVAS_W / 2 + 60, colY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('AI', CANVAS_W / 2 + 150, colY);

    const rb = roundBreakdown;
    const rows = [
      ['Cards (27+)', rb.player.cards + (rb.player.cardsWin ? ' (+3)' : ''), rb.ai.cards + (rb.ai.cardsWin ? ' (+3)' : '')],
      ['Spades', rb.player.spades + (rb.player.spadesWin ? ' (+1)' : ''), rb.ai.spades + (rb.ai.spadesWin ? ' (+1)' : '')],
      ['Big Cassino', rb.player.bigCassino ? 'Yes (+2)' : 'No', rb.ai.bigCassino ? 'Yes (+2)' : 'No'],
      ['Little Cassino', rb.player.littleCassino ? 'Yes (+1)' : 'No', rb.ai.littleCassino ? 'Yes (+1)' : 'No'],
      ['Aces', '+' + rb.player.aces, '+' + rb.ai.aces],
      ['Sweeps', '+' + rb.player.sweeps, '+' + rb.ai.sweeps]
    ];

    _ctx.font = '12px sans-serif';
    for (let i = 0; i < rows.length; ++i) {
      const ry = colY + 24 + i * 24;
      _ctx.textAlign = 'center';
      _ctx.fillStyle = '#ccc';
      _ctx.fillText(rows[i][0], CANVAS_W / 2 - 80, ry);
      _ctx.fillStyle = '#8f8';
      _ctx.fillText(rows[i][1], CANVAS_W / 2 + 60, ry);
      _ctx.fillStyle = '#fa0';
      _ctx.fillText(rows[i][2], CANVAS_W / 2 + 150, ry);
    }

    // Totals
    const totalY = colY + 24 + rows.length * 24 + 10;
    _ctx.font = 'bold 14px sans-serif';
    _ctx.fillStyle = '#ccc';
    _ctx.textAlign = 'center';
    _ctx.fillText('Round Total', CANVAS_W / 2 - 80, totalY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('+' + rb.player.total, CANVAS_W / 2 + 60, totalY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('+' + rb.ai.total, CANVAS_W / 2 + 150, totalY);

    // Cumulative
    const cumY = totalY + 24;
    _ctx.fillStyle = '#ccc';
    _ctx.fillText('Overall', CANVAS_W / 2 - 80, cumY);
    _ctx.fillStyle = '#8f8';
    _ctx.fillText('' + cumulativePlayer, CANVAS_W / 2 + 60, cumY);
    _ctx.fillStyle = '#fa0';
    _ctx.fillText('' + cumulativeAI, CANVAS_W / 2 + 150, cumY);

    // Winner display for game over
    if (gameOver) {
      const winY = cumY + 30;
      _ctx.font = 'bold 16px sans-serif';
      if (cumulativePlayer > cumulativeAI) {
        _ctx.fillStyle = '#4f4';
        _ctx.fillText('You win!', CANVAS_W / 2, winY);
      } else {
        _ctx.fillStyle = '#f44';
        _ctx.fillText('AI wins!', CANVAS_W / 2, winY);
      }
    }

    // Continue prompt
    _ctx.fillStyle = '#8f8';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(gameOver ? 'Click to restart' : 'Click to continue', CANVAS_W / 2, py + ph - 16);

    _ctx.restore();
  }

  function drawCassino() {
    drawTitle();
    drawScorePanel();
    drawAIHand();
    drawTable();
    drawPlayerHand();
    drawCapturePile(PLAYER_PILE_X, PLAYER_PILE_Y, playerCaptures, playerSweeps, 'Your Pile');
    drawCapturePile(AI_PILE_X, AI_PILE_Y, aiCaptures, aiSweeps, 'AI Pile');
    drawActionButtons();
    drawInstructions();

    if (phase === PHASE_ROUND_OVER)
      drawRoundOverUI();
  }

  /* ================================================================
     HIT TESTING
     ================================================================ */

  function hitTestPlayerCard(mx, my) {
    const hand = playerHand;
    const total = hand.length;
    if (total === 0) return -1;

    for (let i = total - 1; i >= 0; --i) {
      const cx = playerCardX(i, total);
      let cy = PLAYER_HAND_Y;
      if (i === selectedHandIdx) cy -= 18;

      const rightEdge = i === total - 1 ? cx + CE.CARD_W : playerCardX(i + 1, total);
      const hitW = rightEdge - cx;

      if (mx >= cx && mx <= cx + hitW && my >= cy && my <= cy + CE.CARD_H)
        return i;
    }
    return -1;
  }

  function hitTestTableCard(mx, my) {
    for (let i = table.length - 1; i >= 0; --i) {
      const pos = tableCardPos(i);
      if (CE.isInRect(mx, my, pos.x, pos.y, CE.CARD_W, CE.CARD_H))
        return i;
    }
    return -1;
  }

  /* ================================================================
     HAND SORTING
     ================================================================ */

  function sortHand(hand) {
    hand.sort((a, b) => {
      const si = CE.SUITS.indexOf(a.suit) - CE.SUITS.indexOf(b.suit);
      if (si !== 0) return si;
      return a.value - b.value;
    });
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = 0;
      cumulativePlayer = 0;
      cumulativeAI = 0;
      roundNumber = 0;
      gameOver = false;
      setupRound();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawCassino();
    },

    handleClick(mx, my) {
      // Round over / game over
      if (phase === PHASE_ROUND_OVER) {
        if (gameOver) {
          cumulativePlayer = 0;
          cumulativeAI = 0;
          roundNumber = 0;
          score = 0;
          gameOver = false;
          if (_host) _host.onScoreChanged(score);
        }
        roundOver = false;
        setupRound();
        return;
      }

      if (roundOver || gameOver) return;

      // Player's turn: select hand card
      if (phase === PHASE_PLAY) {
        const idx = hitTestPlayerCard(mx, my);
        if (idx < 0) return;

        selectedHandIdx = idx;
        selectedTableIdxs = [];

        const card = playerHand[idx];
        const combos = findCaptureCombinations(captureValue(card), table);

        // If only one combination and no possible builds, auto-capture
        if (combos.length === 1 && findPossibleBuilds(card, playerHand).length === 0) {
          playerPlayCapture(idx, combos[0]);
          return;
        }

        // Enter table selection mode
        phase = PHASE_SELECT_TABLE;
        return;
      }

      // Table selection mode
      if (phase === PHASE_SELECT_TABLE && selectedHandIdx >= 0) {
        // Click on a different hand card: switch selection
        const handIdx = hitTestPlayerCard(mx, my);
        if (handIdx >= 0 && handIdx !== selectedHandIdx) {
          selectedHandIdx = handIdx;
          selectedTableIdxs = [];

          const card = playerHand[handIdx];
          const combos = findCaptureCombinations(captureValue(card), table);
          if (combos.length === 1 && findPossibleBuilds(card, playerHand).length === 0) {
            playerPlayCapture(handIdx, combos[0]);
            return;
          }
          return;
        }

        // Click Capture button
        if (canPlayerCapture() && CE.isInRect(mx, my, CAPTURE_BTN.x, CAPTURE_BTN.y, CAPTURE_BTN.w, CAPTURE_BTN.h)) {
          playerPlayCapture(selectedHandIdx, selectedTableIdxs.slice());
          return;
        }

        // Click Build button
        if (canPlayerBuild() && CE.isInRect(mx, my, BUILD_BTN.x, BUILD_BTN.y, BUILD_BTN.w, BUILD_BTN.h)) {
          const bv = buildValueForSelection();
          playerPlayBuild(selectedHandIdx, selectedTableIdxs.slice(), bv);
          return;
        }

        // Click Trail button
        if (canPlayerTrail() && CE.isInRect(mx, my, TRAIL_BTN.x, TRAIL_BTN.y, TRAIL_BTN.w, TRAIL_BTN.h)) {
          playerPlayTrail(selectedHandIdx);
          return;
        }

        // Click table card: toggle selection
        const tableIdx = hitTestTableCard(mx, my);
        if (tableIdx >= 0) {
          const pos = selectedTableIdxs.indexOf(tableIdx);
          if (pos >= 0)
            selectedTableIdxs.splice(pos, 1);
          else
            selectedTableIdxs.push(tableIdx);
          return;
        }

        // Click elsewhere: cancel selection
        selectedHandIdx = -1;
        selectedTableIdxs = [];
        phase = PHASE_PLAY;
        return;
      }
    },

    handlePointerMove(mx, my) {
      if (phase === PHASE_PLAY) {
        hoverHandIdx = hitTestPlayerCard(mx, my);
        hoverTableIdx = -1;
      } else if (phase === PHASE_SELECT_TABLE) {
        hoverHandIdx = hitTestPlayerCard(mx, my);
        hoverTableIdx = hitTestTableCard(mx, my);
      } else {
        hoverHandIdx = -1;
        hoverTableIdx = -1;
      }
    },

    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver) return;
      if (e.key === 'Escape' && phase === PHASE_SELECT_TABLE) {
        selectedHandIdx = -1;
        selectedTableIdxs = [];
        phase = PHASE_PLAY;
      }
    },

    tick(dt) {
      if (roundOver && phase !== PHASE_ROUND_OVER) return;
      if (gameOver) return;

      if (phase === PHASE_AI_TURN) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiTakeTurn();
        }
      }
    },

    sortPlayerHand() { sortHand(playerHand); },

    cleanup() {
      playerHand = [];
      aiHand = [];
      table = [];
      stock = [];
      playerCaptures = [];
      aiCaptures = [];
      playerSweeps = 0;
      aiSweeps = 0;
      cumulativePlayer = 0;
      cumulativeAI = 0;
      lastCapturer = -1;
      roundOver = false;
      gameOver = false;
      roundBreakdown = null;
      selectedHandIdx = -1;
      selectedTableIdxs = [];
      hoverHandIdx = -1;
      hoverTableIdx = -1;
      aiTurnTimer = 0;
      phase = PHASE_PLAY;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('cassino', module);

})();
