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
  const HAND_SIZE = 10;
  const P10_COLORS = ['red', 'blue', 'green', 'yellow'];
  const COLOR_HEX = { red: '#e33', blue: '#38e', green: '#3a3', yellow: '#ec0' };
  const PLAYER_NAMES = ['You', 'AI 1', 'AI 2', 'AI 3'];
  const AI_TURN_DELAY = 0.7;

  const PHASES = [
    { desc: '2 sets of 3', groups: [{ type: 'set', count: 3 }, { type: 'set', count: 3 }] },
    { desc: '1 set of 3 + 1 run of 4', groups: [{ type: 'set', count: 3 }, { type: 'run', count: 4 }] },
    { desc: '1 set of 4 + 1 run of 4', groups: [{ type: 'set', count: 4 }, { type: 'run', count: 4 }] },
    { desc: '1 run of 7', groups: [{ type: 'run', count: 7 }] },
    { desc: '1 run of 8', groups: [{ type: 'run', count: 8 }] },
    { desc: '1 run of 9', groups: [{ type: 'run', count: 9 }] },
    { desc: '2 sets of 4', groups: [{ type: 'set', count: 4 }, { type: 'set', count: 4 }] },
    { desc: '7 of one color', groups: [{ type: 'color', count: 7 }] },
    { desc: '1 set of 5 + 1 set of 2', groups: [{ type: 'set', count: 5 }, { type: 'set', count: 2 }] },
    { desc: '1 set of 5 + 1 set of 3', groups: [{ type: 'set', count: 5 }, { type: 'set', count: 3 }] },
  ];

  const TURN_DRAW = 0;
  const TURN_PLAY = 1;

  /* ================================================================
     GAME STATE
     ================================================================ */

  let hands = [];
  let deck = [];
  let discardPile = [];
  let playerPhases = [];
  let laidPhases = [];     // laidPhases[p] = array of groups laid down
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let currentPlayer = 0;
  let turnPhase = TURN_DRAW;
  let selectedCards = [];   // indices in hand for human player
  let aiTurnTimer = 0;
  let aiSubStep = 0;

  let _ctx = null;
  let _host = null;

  /* -- UI buttons -- */
  const BTN_PHASE = { x: 570, y: 320, w: 90, h: 30 };
  const BTN_HIT = { x: 670, y: 320, w: 70, h: 30 };
  let hitTarget = null;     // { player, groupIdx } when picking a hit target

  /* ================================================================
     DECK CREATION
     ================================================================ */

  function createPhase10Deck() {
    const d = [];
    for (const color of P10_COLORS)
      for (let num = 1; num <= 12; ++num)
        for (let copy = 0; copy < 2; ++copy)
          d.push({ number: num, color, type: 'number' });
    for (let i = 0; i < 4; ++i)
      d.push({ number: 0, color: 'skip', type: 'skip' });
    for (let i = 0; i < 8; ++i)
      d.push({ number: 0, color: 'wild', type: 'wild' });
    return d;
  }

  function cardPoints(card) {
    if (card.type === 'wild') return 25;
    if (card.type === 'skip') return 15;
    if (card.number >= 10) return 10;
    return 5;
  }

  function handPoints(hand) {
    let pts = 0;
    for (const c of hand) pts += cardPoints(c);
    return pts;
  }

  /* ================================================================
     CUSTOM CARD DRAWING
     ================================================================ */

  function drawP10Card(x, y, w, h, card) {
    _ctx.save();
    if (card.type === 'wild') {
      // Multi-colored wild
      _ctx.beginPath();
      CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
      _ctx.clip();
      const qw = w / 2, qh = h / 2;
      _ctx.fillStyle = COLOR_HEX.red;    _ctx.fillRect(x, y, qw, qh);
      _ctx.fillStyle = COLOR_HEX.blue;   _ctx.fillRect(x + qw, y, qw, qh);
      _ctx.fillStyle = COLOR_HEX.green;  _ctx.fillRect(x, y + qh, qw, qh);
      _ctx.fillStyle = COLOR_HEX.yellow; _ctx.fillRect(x + qw, y + qh, qw, qh);
      _ctx.restore();
      _ctx.save();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 22px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.shadowColor = '#000';
      _ctx.shadowBlur = 4;
      _ctx.fillText('W', x + w / 2, y + h / 2);
    } else if (card.type === 'skip') {
      CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
      _ctx.fillStyle = '#c22';
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();
      // circle-slash
      const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.25;
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 3;
      _ctx.beginPath();
      _ctx.arc(cx, cy, r, 0, Math.PI * 2);
      _ctx.stroke();
      _ctx.beginPath();
      _ctx.moveTo(cx - r * 0.7, cy + r * 0.7);
      _ctx.lineTo(cx + r * 0.7, cy - r * 0.7);
      _ctx.stroke();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 13px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText('S', x + w / 2, y + 4);
    } else {
      const bg = COLOR_HEX[card.color] || '#888';
      CE.drawRoundedRect(_ctx, x, y, w, h, CE.CARD_RADIUS);
      _ctx.fillStyle = bg;
      _ctx.fill();
      _ctx.strokeStyle = '#fff';
      _ctx.lineWidth = 1;
      _ctx.stroke();
      // white ellipse center
      _ctx.fillStyle = 'rgba(255,255,255,0.35)';
      _ctx.beginPath();
      _ctx.ellipse(x + w / 2, y + h / 2, w / 3, h / 2.5, -0.3, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 22px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.shadowColor = 'rgba(0,0,0,0.5)';
      _ctx.shadowBlur = 2;
      _ctx.fillText(String(card.number), x + w / 2, y + h / 2);
      // corner numbers
      _ctx.font = 'bold 11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.shadowBlur = 0;
      _ctx.fillText(String(card.number), x + 4, y + 3);
      _ctx.save();
      _ctx.translate(x + w - 4, y + h - 3);
      _ctx.rotate(Math.PI);
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'top';
      _ctx.fillText(String(card.number), 0, 0);
      _ctx.restore();
    }
    _ctx.restore();
  }

  /* ================================================================
     PHASE VALIDATION
     ================================================================ */

  function isSet(cards, minCount) {
    if (cards.length < minCount) return false;
    let num = -1;
    for (const c of cards) {
      if (c.type === 'wild') continue;
      if (num < 0) num = c.number;
      else if (c.number !== num) return false;
    }
    return true;
  }

  function isRun(cards, minCount) {
    if (cards.length < minCount) return false;
    // Extract non-wild numbers, sort, then check if wilds fill gaps
    const nums = [];
    let wilds = 0;
    for (const c of cards) {
      if (c.type === 'wild') ++wilds;
      else nums.push(c.number);
    }
    nums.sort((a, b) => a - b);
    // Check for duplicates among non-wild numbers
    for (let i = 1; i < nums.length; ++i)
      if (nums[i] === nums[i - 1]) return false;
    if (nums.length === 0) return wilds >= minCount;
    let gaps = 0;
    for (let i = 1; i < nums.length; ++i)
      gaps += nums[i] - nums[i - 1] - 1;
    return gaps <= wilds;
  }

  function isColorGroup(cards, minCount) {
    if (cards.length < minCount) return false;
    let col = null;
    for (const c of cards) {
      if (c.type === 'wild') continue;
      if (!col) col = c.color;
      else if (c.color !== col) return false;
    }
    return true;
  }

  function validateGroup(cards, group) {
    if (cards.length < group.count) return false;
    if (group.type === 'set') return isSet(cards, group.count);
    if (group.type === 'run') return isRun(cards, group.count);
    if (group.type === 'color') return isColorGroup(cards, group.count);
    return false;
  }

  /* Try to split selected cards into the groups required by a phase.
     Returns array of card-groups (matching phase.groups order) or null. */
  function tryMatchPhase(cards, phase) {
    const groups = phase.groups;
    if (groups.length === 1)
      return validateGroup(cards, groups[0]) ? [cards.slice()] : null;

    // Two groups: try every partition
    const n = cards.length;
    const g0Count = groups[0].count;
    const g1Count = groups[1].count;
    if (n < g0Count + g1Count) return null;

    // Generate combinations of size g0Count
    const indices = [];
    function combo(start, chosen) {
      if (chosen.length === g0Count) {
        const set0 = chosen.map(i => cards[i]);
        const used = new Set(chosen);
        const set1 = [];
        for (let i = 0; i < n; ++i)
          if (!used.has(i)) set1.push(cards[i]);
        if (set1.length >= g1Count && validateGroup(set0, groups[0]) && validateGroup(set1, groups[1]))
          indices.push([set0, set1]);
        return;
      }
      if (indices.length > 0) return; // found one, stop
      for (let i = start; i < n; ++i)
        combo(i + 1, [...chosen, i]);
    }
    combo(0, []);
    return indices.length > 0 ? indices[0] : null;
  }

  /* ================================================================
     HITTING
     ================================================================ */

  function canHitOnSet(card, group) {
    if (card.type === 'wild') return true;
    // group is a set -- all same number
    let num = -1;
    for (const c of group)
      if (c.type !== 'wild') { num = c.number; break; }
    return num < 0 || card.number === num;
  }

  function canHitOnRun(card, group) {
    if (card.type === 'wild') return true;
    const nums = [];
    let wilds = 0;
    for (const c of group) {
      if (c.type === 'wild') ++wilds;
      else nums.push(c.number);
    }
    nums.sort((a, b) => a - b);
    // Figure out the effective run range
    if (nums.length === 0) return true;
    const lo = nums[0];
    const hi = nums[nums.length - 1];
    const span = hi - lo;
    const filledLen = span + 1;
    const totalLen = filledLen + (wilds - (filledLen - nums.length));
    // Card extends the run if it's adjacent
    const extLo = lo - (totalLen > filledLen ? 0 : 1);
    const extHi = hi + 1;
    return (card.number === lo - 1 && lo - 1 >= 1) || (card.number === hi + 1 && hi + 1 <= 12);
  }

  function canHitOnColor(card, group) {
    if (card.type === 'wild') return true;
    let col = null;
    for (const c of group)
      if (c.type !== 'wild') { col = c.color; break; }
    return !col || card.color === col;
  }

  function canHitOnGroup(card, group, groupDef) {
    if (groupDef.type === 'set') return canHitOnSet(card, group);
    if (groupDef.type === 'run') return canHitOnRun(card, group);
    if (groupDef.type === 'color') return canHitOnColor(card, group);
    return false;
  }

  /* ================================================================
     SETUP
     ================================================================ */

  function setupRound() {
    deck = CE.shuffle(createPhase10Deck());
    discardPile = [];
    hands = [];
    laidPhases = [];
    selectedCards = [];
    hitTarget = null;
    turnPhase = TURN_DRAW;
    currentPlayer = 0;
    roundOver = false;
    aiTurnTimer = 0;
    aiSubStep = 0;

    for (let p = 0; p < NUM_PLAYERS; ++p) {
      hands.push([]);
      laidPhases.push([]);
      for (let i = 0; i < HAND_SIZE; ++i)
        hands[p].push(deck.pop());
    }
    discardPile.push(deck.pop());

    if (_host)
      for (let i = 0; i < hands[0].length; ++i)
        _host.dealCardAnim(hands[0][i], CANVAS_W / 2, -CE.CARD_H, 40 + i * 55, 470, i * 0.08);
  }

  function setupGame() {
    playerPhases = [];
    for (let p = 0; p < NUM_PLAYERS; ++p)
      playerPhases.push(0);
    score = (_host && _host.getScore) ? _host.getScore() : 0;
    gameOver = false;
    setupRound();
  }

  /* ================================================================
     RECYCLING DECK
     ================================================================ */

  function recycleDeck() {
    if (deck.length > 0) return;
    const top = discardPile.pop();
    deck = CE.shuffle(discardPile);
    discardPile = top ? [top] : [];
  }

  /* ================================================================
     ROUND END
     ================================================================ */

  function endRound(winner) {
    roundOver = true;
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (laidPhases[p].length > 0 && playerPhases[p] < 10)
        ++playerPhases[p];
    }
    // Score penalty points for cards left in hand
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (p === 0) score -= handPoints(hands[p]);
    }
    if (winner === 0) {
      score += 50;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, 300, 'You went out!', { color: '#4f4', size: 22 });
        _host.triggerChipSparkle(CANVAS_W / 2, CANVAS_H - 60);
      }
    } else if (_host)
      _host.floatingText.add(CANVAS_W / 2, 300, PLAYER_NAMES[winner] + ' went out!', { color: '#f88', size: 22 });

    // Check game over
    for (let p = 0; p < NUM_PLAYERS; ++p) {
      if (playerPhases[p] >= 10) {
        gameOver = true;
        if (_host) {
          const msg = p === 0 ? 'YOU WIN THE GAME!' : PLAYER_NAMES[p] + ' wins the game!';
          const col = p === 0 ? '#4f4' : '#f44';
          _host.floatingText.add(CANVAS_W / 2, 260, msg, { color: col, size: 28 });
        }
        break;
      }
    }
    if (_host) _host.onScoreChanged(score);
  }

  /* ================================================================
     TURN LOGIC
     ================================================================ */

  function drawFromStock(p) {
    recycleDeck();
    if (deck.length === 0) return;
    hands[p].push(deck.pop());
    turnPhase = TURN_PLAY;
  }

  function drawFromDiscard(p) {
    if (discardPile.length === 0) return;
    hands[p].push(discardPile.pop());
    turnPhase = TURN_PLAY;
  }

  function discardCard(p, handIdx) {
    const card = hands[p].splice(handIdx, 1)[0];
    discardPile.push(card);
    // Skip card effect
    if (card.type === 'skip') {
      const next = (currentPlayer + 1) % NUM_PLAYERS;
      currentPlayer = (next + 1) % NUM_PLAYERS;
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, 230, PLAYER_NAMES[next] + ' skipped!', { color: '#ff8', size: 14 });
    } else
      currentPlayer = (currentPlayer + 1) % NUM_PLAYERS;

    turnPhase = TURN_DRAW;
    selectedCards = [];
    hitTarget = null;

    if (hands[p].length === 0)
      endRound(p);
  }

  function layPhase(p, groupArrays) {
    for (const g of groupArrays)
      laidPhases[p].push(g.slice());
    // Remove cards from hand
    const used = new Set();
    for (const g of groupArrays)
      for (const c of g)
        for (let i = 0; i < hands[p].length; ++i)
          if (!used.has(i) && hands[p][i] === c) { used.add(i); break; }
    const newHand = [];
    for (let i = 0; i < hands[p].length; ++i)
      if (!used.has(i)) newHand.push(hands[p][i]);
    hands[p] = newHand;
    if (_host) {
      const msg = p === 0 ? 'Phase laid!' : PLAYER_NAMES[p] + ' laid phase!';
      _host.floatingText.add(CANVAS_W / 2, 230, msg, { color: '#ff0', size: 16 });
    }
  }

  function hitOnGroup(p, handIdx, targetPlayer, groupIdx) {
    const card = hands[p][handIdx];
    laidPhases[targetPlayer][groupIdx].push(card);
    hands[p].splice(handIdx, 1);
  }

  /* ================================================================
     AI LOGIC
     ================================================================ */

  function aiCardUsefulForPhase(card, phaseIdx) {
    if (card.type === 'wild') return true;
    const ph = PHASES[phaseIdx];
    for (const g of ph.groups) {
      if (g.type === 'set') return true; // any number can form sets
      if (g.type === 'run') return true;
      if (g.type === 'color') return true;
    }
    return false;
  }

  function aiTryLayPhase(p) {
    const phaseIdx = playerPhases[p];
    if (phaseIdx >= 10 || laidPhases[p].length > 0) return false;
    const ph = PHASES[phaseIdx];
    const result = tryMatchPhase(hands[p], ph);
    if (!result) return false;
    layPhase(p, result);
    return true;
  }

  function aiTryHit(p) {
    if (laidPhases[p].length === 0) return false;
    for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
      if (laidPhases[tp].length === 0) continue;
      const phIdx = playerPhases[tp];
      const ph = PHASES[phIdx];
      for (let gi = 0; gi < laidPhases[tp].length; ++gi) {
        const gDef = ph.groups[gi] || ph.groups[0];
        for (let hi = 0; hi < hands[p].length; ++hi) {
          if (canHitOnGroup(hands[p][hi], laidPhases[tp][gi], gDef)) {
            hitOnGroup(p, hi, tp, gi);
            return true;
          }
        }
      }
    }
    return false;
  }

  function aiBestDiscard(p) {
    const phIdx = playerPhases[p];
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < hands[p].length; ++i) {
      const c = hands[p][i];
      const pts = cardPoints(c);
      let useful = 0;
      // Prefer discarding skip cards toward the player closest to winning
      if (c.type === 'skip') useful = -5;
      if (c.type === 'wild') useful = 100; // never discard wilds if possible
      if (pts - useful > bestScore) {
        bestScore = pts - useful;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function aiShouldDrawDiscard(p) {
    if (discardPile.length === 0) return false;
    const top = discardPile[discardPile.length - 1];
    if (top.type === 'wild') return true;
    // Check if it helps complete current phase
    const phIdx = playerPhases[p];
    const ph = PHASES[phIdx];
    // Simple heuristic: if the card matches numbers already in hand
    let matchCount = 0;
    for (const c of hands[p])
      if (c.type !== 'wild' && c.type !== 'skip' && c.number === top.number) ++matchCount;
    if (matchCount >= 2) return true;
    // Check for run adjacency
    for (const c of hands[p])
      if (c.type === 'number' && c.number !== top.number && Math.abs(c.number - top.number) === 1) ++matchCount;
    return matchCount >= 3;
  }

  function aiPlayTurn(p) {
    switch (aiSubStep) {
      case 0: // Draw
        if (aiShouldDrawDiscard(p))
          drawFromDiscard(p);
        else
          drawFromStock(p);
        ++aiSubStep;
        break;
      case 1: // Try lay phase
        aiTryLayPhase(p);
        ++aiSubStep;
        break;
      case 2: // Try hits
        if (laidPhases[p].length > 0) {
          let hitSomething = true;
          while (hitSomething && hands[p].length > 1)
            hitSomething = aiTryHit(p);
        }
        ++aiSubStep;
        break;
      case 3: { // Discard
        const idx = aiBestDiscard(p);
        discardCard(p, idx);
        aiSubStep = 0;
        break;
      }
    }
  }

  /* ================================================================
     HINT HELPERS
     ================================================================ */

  function isCardUsefulForCurrentPhase(hand, idx) {
    const card = hand[idx];
    if (card.type === 'wild') return true;
    const phIdx = playerPhases[0];
    if (phIdx >= 10) return false;
    const ph = PHASES[phIdx];
    for (const g of ph.groups) {
      if (g.type === 'set') {
        let count = 0;
        for (const c of hand)
          if (c.type === 'wild' || (c.type === 'number' && c.number === card.number)) ++count;
        if (count >= 2) return true;
      }
      if (g.type === 'run') {
        for (const c of hand)
          if (c !== card && c.type === 'number' && Math.abs(c.number - card.number) <= 1) return true;
      }
      if (g.type === 'color') {
        let count = 0;
        for (const c of hand)
          if (c.type === 'wild' || (c.type === 'number' && c.color === card.color)) ++count;
        if (count >= 3) return true;
      }
    }
    return false;
  }

  function canHitAny(card) {
    for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
      if (laidPhases[tp].length === 0) continue;
      const phIdx = playerPhases[tp];
      const ph = PHASES[phIdx];
      for (let gi = 0; gi < laidPhases[tp].length; ++gi) {
        const gDef = ph.groups[gi] || ph.groups[0];
        if (canHitOnGroup(card, laidPhases[tp][gi], gDef)) return true;
      }
    }
    return false;
  }

  /* ================================================================
     PLAYER PHASE CHECK
     ================================================================ */

  function playerCanLayPhase() {
    const phIdx = playerPhases[0];
    if (phIdx >= 10 || laidPhases[0].length > 0) return false;
    const sel = selectedCards.map(i => hands[0][i]);
    return tryMatchPhase(sel, PHASES[phIdx]) !== null;
  }

  function playerCanHitSelected() {
    if (laidPhases[0].length === 0 || selectedCards.length !== 1) return false;
    const card = hands[0][selectedCards[0]];
    return canHitAny(card);
  }

  /* ================================================================
     DRAWING
     ================================================================ */

  function drawPhaseInfo(x, y, p) {
    const phIdx = playerPhases[p];
    const txt = phIdx >= 10 ? 'DONE' : 'Ph ' + (phIdx + 1);
    _ctx.fillStyle = phIdx >= 10 ? '#4f4' : '#ccc';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText(txt, x, y);
  }

  function drawLaidGroups(x, y, p, scale) {
    const groups = laidPhases[p];
    if (groups.length === 0) return;
    let ox = x;
    const cw = CE.CARD_W * scale;
    const ch = CE.CARD_H * scale;
    for (const g of groups) {
      for (const c of g) {
        drawP10Card(ox, y, cw, ch, c);
        ox += cw * 0.55;
      }
      ox += 8;
    }
  }

  function drawGame() {
    // Top: AI hands
    const aiY = 10;
    const aiCardW = CE.CARD_W * 0.5;
    const aiCardH = CE.CARD_H * 0.5;
    for (let p = 1; p < NUM_PLAYERS; ++p) {
      const baseX = 20 + (p - 1) * 300;
      _ctx.fillStyle = currentPlayer === p ? '#8f8' : '#aaa';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText(PLAYER_NAMES[p] + ' (' + hands[p].length + ')', baseX, aiY + 10);
      drawPhaseInfo(baseX + 130, aiY + 10, p);
      // Face-down cards
      const shown = Math.min(hands[p].length, 8);
      for (let i = 0; i < shown; ++i)
        CE.drawCardBack(_ctx, baseX + i * 18, aiY + 18, aiCardW, aiCardH);
      // Laid phase groups
      if (laidPhases[p].length > 0)
        drawLaidGroups(baseX, aiY + 18 + aiCardH + 4, p, 0.4);
    }

    // Center: Stock + Discard
    const stockX = CANVAS_W / 2 - CE.CARD_W - 20;
    const stockY = 200;
    const discardX = CANVAS_W / 2 + 20;
    const discardY = 200;

    if (deck.length > 0) {
      CE.drawCardBack(_ctx, stockX, stockY);
      _ctx.fillStyle = '#aaa';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText(deck.length + '', stockX + CE.CARD_W / 2, stockY + CE.CARD_H + 14);
    } else
      CE.drawEmptySlot(_ctx, stockX, stockY);

    if (discardPile.length > 0)
      drawP10Card(discardX, discardY, CE.CARD_W, CE.CARD_H, discardPile[discardPile.length - 1]);
    else
      CE.drawEmptySlot(_ctx, discardX, discardY, 'D');

    _ctx.fillStyle = '#888';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'center';
    _ctx.fillText('Stock', stockX + CE.CARD_W / 2, stockY - 6);
    _ctx.fillText('Discard', discardX + CE.CARD_W / 2, discardY - 6);

    // Player's laid phase
    if (laidPhases[0].length > 0) {
      _ctx.fillStyle = '#ccc';
      _ctx.font = '10px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.fillText('Your laid phase:', 40, 360);
      drawLaidGroups(40, 372, 0, 0.55);
    }

    // Phase requirement
    const phIdx = playerPhases[0];
    _ctx.fillStyle = '#ddd';
    _ctx.font = '12px sans-serif';
    _ctx.textAlign = 'center';
    if (phIdx < 10)
      _ctx.fillText('Phase ' + (phIdx + 1) + ': ' + PHASES[phIdx].desc, CANVAS_W / 2, 170);
    else
      _ctx.fillText('All phases complete!', CANVAS_W / 2, 170);

    // Buttons
    if (currentPlayer === 0 && turnPhase === TURN_PLAY && !roundOver && !gameOver) {
      if (playerCanLayPhase())
        CE.drawButton(_ctx, BTN_PHASE.x, BTN_PHASE.y, BTN_PHASE.w, BTN_PHASE.h, 'Lay Phase');
      if (playerCanHitSelected())
        CE.drawButton(_ctx, BTN_HIT.x, BTN_HIT.y, BTN_HIT.w, BTN_HIT.h, 'Hit');
    }

    // Bottom: Player hand
    const handY = 470;
    const handSpacing = Math.min(55, (CANVAS_W - 80) / Math.max(hands[0].length, 1));
    for (let i = 0; i < hands[0].length; ++i) {
      if (hands[0][i]._dealing) continue;
      const cx = 40 + i * handSpacing;
      const raised = selectedCards.includes(i) ? -12 : 0;
      drawP10Card(cx, handY + raised, CE.CARD_W, CE.CARD_H, hands[0][i]);
      if (selectedCards.includes(i))
        CE.drawSelectionHighlight(_ctx, cx, handY + raised, CE.CARD_H);
      if (_host && _host.hintsEnabled && currentPlayer === 0 && turnPhase === TURN_PLAY && !roundOver && !gameOver) {
        if (isCardUsefulForCurrentPhase(hands[0], i) || (laidPhases[0].length > 0 && canHitAny(hands[0][i])))
          CE.drawHintGlow(_ctx, cx, handY + raised, CE.CARD_W, CE.CARD_H, _host.hintTime);
      }
    }

    // Turn indicator
    if (!roundOver && !gameOver) {
      _ctx.fillStyle = currentPlayer === 0 ? '#8f8' : '#f88';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      if (currentPlayer === 0) {
        const msg = turnPhase === TURN_DRAW
          ? 'Draw from Stock or Discard pile'
          : 'Select cards for phase/hit, then Discard to end turn';
        _ctx.fillText(msg, CANVAS_W / 2, CANVAS_H - 10);
      } else
        _ctx.fillText(PLAYER_NAMES[currentPlayer] + ' is thinking...', CANVAS_W / 2, CANVAS_H - 10);
    }

    // Scores
    _ctx.fillStyle = '#aaa';
    _ctx.font = '10px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.fillText('Score: ' + score, CANVAS_W - 12, CANVAS_H - 10);

    // Hit target picking overlay
    if (hitTarget !== null) {
      _ctx.save();
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      _ctx.fillStyle = '#fff';
      _ctx.font = 'bold 16px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('Click a laid group to hit on (or click away to cancel)', CANVAS_W / 2, 140);
      // Re-draw all laid groups so they are clickable
      for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
        if (laidPhases[tp].length === 0) continue;
        const gy = 160 + tp * 80;
        _ctx.fillStyle = '#ccc';
        _ctx.font = '11px sans-serif';
        _ctx.textAlign = 'left';
        _ctx.fillText(PLAYER_NAMES[tp] + ':', 40, gy);
        drawLaidGroups(40, gy + 8, tp, 0.6);
      }
      _ctx.restore();
    }
  }

  /* ================================================================
     CLICK HANDLING
     ================================================================ */

  function handleClickDraw(mx, my) {
    const stockX = CANVAS_W / 2 - CE.CARD_W - 20;
    const stockY = 200;
    const discardX = CANVAS_W / 2 + 20;
    const discardY = 200;

    if (CE.isInRect(mx, my, stockX, stockY, CE.CARD_W, CE.CARD_H)) {
      drawFromStock(0);
      return true;
    }
    if (CE.isInRect(mx, my, discardX, discardY, CE.CARD_W, CE.CARD_H)) {
      drawFromDiscard(0);
      return true;
    }
    return false;
  }

  function handleClickPlay(mx, my) {
    // Hit target selection overlay
    if (hitTarget !== null) {
      const card = hands[0][hitTarget.handIdx];
      for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
        if (laidPhases[tp].length === 0) continue;
        const gy = 160 + tp * 80 + 8;
        let ox = 40;
        const cw = CE.CARD_W * 0.6;
        const ch = CE.CARD_H * 0.6;
        const phIdx = playerPhases[tp];
        const ph = PHASES[phIdx];
        for (let gi = 0; gi < laidPhases[tp].length; ++gi) {
          const gLen = laidPhases[tp][gi].length;
          const gw = gLen * cw * 0.55 + cw * 0.45;
          if (CE.isInRect(mx, my, ox, gy, gw, ch)) {
            const gDef = ph.groups[gi] || ph.groups[0];
            if (canHitOnGroup(card, laidPhases[tp][gi], gDef)) {
              hitOnGroup(0, hitTarget.handIdx, tp, gi);
              selectedCards = [];
              hitTarget = null;
              if (hands[0].length === 0) endRound(0);
              return true;
            }
            if (_host) _host.floatingText.add(mx, my - 20, 'Cannot hit here!', { color: '#f88', size: 14 });
            return true;
          }
          ox += gw + 8;
        }
      }
      hitTarget = null;
      return true;
    }

    // Lay Phase button
    if (playerCanLayPhase() && CE.isInRect(mx, my, BTN_PHASE.x, BTN_PHASE.y, BTN_PHASE.w, BTN_PHASE.h)) {
      const sel = selectedCards.map(i => hands[0][i]);
      const phIdx = playerPhases[0];
      const result = tryMatchPhase(sel, PHASES[phIdx]);
      if (result) {
        layPhase(0, result);
        selectedCards = [];
        if (hands[0].length === 0) endRound(0);
        return true;
      }
    }

    // Hit button
    if (playerCanHitSelected() && CE.isInRect(mx, my, BTN_HIT.x, BTN_HIT.y, BTN_HIT.w, BTN_HIT.h)) {
      hitTarget = { handIdx: selectedCards[0] };
      return true;
    }

    // Card selection / discard
    const handY = 470;
    const handSpacing = Math.min(55, (CANVAS_W - 80) / Math.max(hands[0].length, 1));
    for (let i = hands[0].length - 1; i >= 0; --i) {
      const cx = 40 + i * handSpacing;
      const raised = selectedCards.includes(i) ? -12 : 0;
      if (CE.isInRect(mx, my, cx, handY + raised, CE.CARD_W, CE.CARD_H)) {
        const idx = selectedCards.indexOf(i);
        if (idx >= 0)
          selectedCards.splice(idx, 1);
        else
          selectedCards.push(i);
        return true;
      }
    }

    // Click discard pile to discard last selected card
    const discardX = CANVAS_W / 2 + 20;
    const discardY = 200;
    if (CE.isInRect(mx, my, discardX, discardY, CE.CARD_W, CE.CARD_H) && selectedCards.length === 1) {
      discardCard(0, selectedCards[0]);
      return true;
    }

    return false;
  }

  /* ================================================================
     MODULE INTERFACE
     ================================================================ */

  const module = {
    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      setupGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGame();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (roundOver && !gameOver) {
          setupRound();
          return;
        }
        if (_host) _host.onRoundOver(gameOver);
        return;
      }
      if (currentPlayer !== 0) return;

      if (turnPhase === TURN_DRAW)
        handleClickDraw(mx, my);
      else
        handleClickPlay(mx, my);
    },

    handlePointerMove(mx, my) {},
    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver || currentPlayer !== 0) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && turnPhase === TURN_PLAY) {
        const idx = num - 1;
        if (idx < hands[0].length) {
          const si = selectedCards.indexOf(idx);
          if (si >= 0) selectedCards.splice(si, 1);
          else selectedCards.push(idx);
        }
      }
      if (e.key === 'd' || e.key === 'D') {
        if (turnPhase === TURN_PLAY && selectedCards.length === 1)
          discardCard(0, selectedCards[0]);
      }
    },

    tick(dt) {
      if (roundOver || gameOver) return;
      if (currentPlayer !== 0) {
        aiTurnTimer += dt;
        if (aiTurnTimer >= AI_TURN_DELAY) {
          aiTurnTimer = 0;
          aiPlayTurn(currentPlayer);
        }
      }
    },

    cleanup() {
      hands = [];
      deck = [];
      discardPile = [];
      playerPhases = [];
      laidPhases = [];
      selectedCards = [];
      hitTarget = null;
      roundOver = false;
      gameOver = false;
      aiTurnTimer = 0;
      aiSubStep = 0;
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('phase10', module);

})();
