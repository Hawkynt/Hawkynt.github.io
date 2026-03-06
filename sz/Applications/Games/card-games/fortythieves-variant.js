;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const FACE_UP_OFFSET = 20;
  const MARGIN_X = 10;
  const MARGIN_Y = 8;

  const TABLEAU_COUNT = 10;
  const FOUNDATION_COUNT = 8;

  const COL_GAP = Math.floor((900 - MARGIN_X * 2 - TABLEAU_COUNT * CARD_W) / (TABLEAU_COUNT - 1));
  const PILE_GAP = CARD_W + COL_GAP;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 500;

  const FOUNDATION_GAP = 8;
  const FOUNDATION_TOTAL_W = FOUNDATION_COUNT * CARD_W + (FOUNDATION_COUNT - 1) * FOUNDATION_GAP;

  const TABLEAU_TOP = MARGIN_Y + CARD_H + 20;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let stock = [];
  let waste = [];
  let foundations = [[], [], [], [], [], [], [], []];
  let tableau = [[], [], [], [], [], [], [], [], [], []];
  let moveCount = 0;
  let score = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let gameStarted = false;
  let gameWon = false;
  let undoHistory = [];
  const MAX_UNDO = 200;

  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;
  let particles = [];
  let lastFireworkTime = 0;

  let animatingCards = [];
  let dealAnimCards = [];
  let dealAnimRunning = false;

  let dragging = null;

  let lastClickTime = 0;
  let lastClickHit = null;
  let pointerStartX = 0;
  let pointerStartY = 0;

  let _ctx = null;
  let _canvas = null;
  let _host = null;
  let canvasW = 900;
  let canvasH = 600;
  let scale = 1;

  let statusMsg = '';

  let winLaunchInterval = null;

  /* ================================================================
   *  LAYOUT HELPERS
   * ================================================================ */

  function stockPos() {
    return { x: MARGIN_X, y: MARGIN_Y };
  }

  function wastePos() {
    return { x: MARGIN_X + CARD_W + 14, y: MARGIN_Y };
  }

  function foundationPos(i) {
    const totalW = canvasW / scale;
    const startX = (totalW - FOUNDATION_TOTAL_W) / 2 + CARD_W + 40;
    return { x: startX + i * (CARD_W + FOUNDATION_GAP), y: MARGIN_Y };
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * PILE_GAP, y: TABLEAU_TOP };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    return { x: base.x, y: base.y + index * FACE_UP_OFFSET };
  }

  /* ================================================================
   *  DECK (2 standard decks = 104 cards)
   * ================================================================ */

  function createDoubleDeck() {
    const deck = [];
    for (let d = 0; d < 2; ++d)
      for (const suit of CE.SUITS)
        for (const rank of CE.RANKS)
          deck.push(CE.makeCard(suit, rank));
    return deck;
  }

  /* ================================================================
   *  TIMER
   * ================================================================ */

  function startTimer() {
    if (timerInterval)
      return;
    gameStarted = true;
    timerInterval = setInterval(() => { ++timerSeconds; }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const snap = c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp });
    const state = {
      stock: stock.map(snap),
      waste: waste.map(snap),
      foundations: foundations.map(f => f.map(snap)),
      tableau: tableau.map(t => t.map(snap)),
      moveCount,
      score
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreCard(c) {
    const card = CE.makeCard(c.suit, c.rank);
    card.faceUp = c.faceUp;
    return card;
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    stock = s.stock.map(restoreCard);
    waste = s.waste.map(restoreCard);
    foundations = s.foundations.map(f => f.map(restoreCard));
    tableau = s.tableau.map(t => t.map(restoreCard));
    moveCount = s.moveCount;
    score = s.score;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
    statusMsg = '';
  }

  /* ================================================================
   *  GAME RULES
   * ================================================================ */

  function canPlaceOnFoundation(card, fi) {
    const pile = foundations[fi];
    if (pile.length === 0)
      return card.value === 0; // Ace only
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = tableau[col];
    if (pile.length === 0)
      return true; // any card fills empty column
    const top = pile[pile.length - 1];
    // Forty Thieves: build down by SAME suit
    return card.suit === top.suit && card.value === top.value - 1;
  }

  function findFoundationTarget(card) {
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      if (canPlaceOnFoundation(card, i))
        return i;
    return -1;
  }

  function hasAnyValidMove(card, excludeCol) {
    if (findFoundationTarget(card) >= 0)
      return true;
    for (let c = 0; c < TABLEAU_COUNT; ++c) {
      if (c === excludeCol)
        continue;
      if (canPlaceOnTableau(card, c))
        return true;
    }
    return false;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    stopWinAnimation();
    stopTimer();
    dealAnimCards = [];
    dealAnimRunning = false;
    animatingCards = [];

    const deck = CE.shuffle(createDoubleDeck());

    stock = [];
    waste = [];
    foundations = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      foundations.push([]);
    tableau = [];
    for (let i = 0; i < TABLEAU_COUNT; ++i)
      tableau.push([]);

    moveCount = 0;
    score = 0;
    timerSeconds = 0;
    gameStarted = false;
    gameWon = false;
    undoHistory = [];
    dragging = null;
    statusMsg = 'Forty Thieves  |  Build foundations up by suit, tableau down by suit';

    // Deal 4 face-up cards to each of 10 tableau columns (40 cards = "forty thieves")
    let cardIdx = 0;
    for (let row = 0; row < 4; ++row)
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const card = deck[cardIdx++];
        card.faceUp = true;
        tableau[col].push(card);
      }

    // Remaining 64 cards go to stock
    for (let i = cardIdx; i < deck.length; ++i) {
      deck[i].faceUp = false;
      stock.push(deck[i]);
    }

    startDealAnimation();
  }

  /* ================================================================
   *  DEAL ANIMATION
   * ================================================================ */

  function startDealAnimation() {
    dealAnimCards = [];
    dealAnimRunning = true;
    const now = performance.now();
    const sp = stockPos();
    let cardNum = 0;
    for (let row = 0; row < 4; ++row)
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const dest = tableauCardPos(col, row);
        dealAnimCards.push({
          card: tableau[col][row],
          fromX: sp.x,
          fromY: sp.y,
          toX: dest.x,
          toY: dest.y,
          startTime: now + cardNum * 25,
          duration: 250
        });
        ++cardNum;
      }
  }

  /* ================================================================
   *  STOCK DEALING (one card at a time, no recycle)
   * ================================================================ */

  function dealFromStock() {
    if (stock.length === 0)
      return;

    if (!gameStarted)
      startTimer();

    saveState();

    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
    ++moveCount;

    const sp = stockPos();
    const wp = wastePos();
    startCardMoveAnim(card, sp.x, sp.y, wp.x, wp.y, null);
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceType, sourceCol, sourceIndex) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!gameStarted)
      startTimer();
    saveState();

    let fromX, fromY;
    if (sourceType === 'waste') {
      const wp = wastePos();
      fromX = wp.x;
      fromY = wp.y;
      waste.splice(sourceIndex, 1);
    } else if (sourceType === 'tableau') {
      const pos = tableauCardPos(sourceCol, sourceIndex);
      fromX = pos.x;
      fromY = pos.y;
      tableau[sourceCol].splice(sourceIndex, 1);
    }

    card.faceUp = true;
    foundations[fi].push(card);
    ++moveCount;
    score += 10;

    const fp = foundationPos(fi);
    startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });

    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);

    return true;
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    // Stock
    const sp = stockPos();
    if (px >= sp.x && px < sp.x + CARD_W && py >= sp.y && py < sp.y + CARD_H)
      return { area: 'stock' };

    // Waste
    if (waste.length > 0) {
      const wp = wastePos();
      if (px >= wp.x && px < wp.x + CARD_W && py >= wp.y && py < wp.y + CARD_H)
        return { area: 'waste', index: waste.length - 1 };
    }

    // Foundations
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (px >= fp.x && px < fp.x + CARD_W && py >= fp.y && py < fp.y + CARD_H)
        return { area: 'foundation', index: i };
    }

    // Tableau (top-down hit test for overlapping cards)
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      if (pile.length === 0) {
        const tp = tableauPos(col);
        if (px >= tp.x && px < tp.x + CARD_W && py >= tp.y && py < tp.y + CARD_H)
          return { area: 'tableau-empty', col };
        continue;
      }
      for (let i = pile.length - 1; i >= 0; --i) {
        const pos = tableauCardPos(col, i);
        const h = (i === pile.length - 1) ? CARD_H : FACE_UP_OFFSET;
        if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + h)
          return { area: 'tableau', col, index: i, card: pile[i] };
      }
    }

    return null;
  }

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(type, index) {
    if (!dragging)
      return false;
    if (type === 'waste' && dragging.source === 'waste')
      return index === dragging.sourceIndex;
    if (type === 'tableau' && dragging.source === 'tableau' && dragging.sourceCol === index)
      return true;
    return false;
  }

  /* ================================================================
   *  DROP LOGIC
   * ================================================================ */

  function tryDrop(px, py) {
    if (!dragging)
      return;

    const hit = hitTest(px, py);
    let dropped = false;

    if (hit) {
      // Forty Thieves: single card moves only
      if (hit.area === 'foundation' && dragging.cards.length === 1) {
        if (canPlaceOnFoundation(dragging.cards[0], hit.index)) {
          removeFromSource();
          foundations[hit.index].push(dragging.cards[0]);
          ++moveCount;
          score += 10;
          dropped = true;
        }
      } else if ((hit.area === 'tableau' || hit.area === 'tableau-empty') && dragging.cards.length === 1) {
        const col = hit.col;
        if (dragging.source !== 'tableau' || dragging.sourceCol !== col) {
          if (canPlaceOnTableau(dragging.cards[0], col)) {
            removeFromSource();
            dragging.cards[0].faceUp = true;
            tableau[col].push(dragging.cards[0]);
            ++moveCount;
            dropped = true;
          }
        }
      }
    }

    // Proximity snap to foundations
    if (!dropped && dragging.cards.length === 1) {
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        const dx = px - fp.x - CARD_W / 2;
        const dy = py - fp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(dragging.cards[0], i)) {
          removeFromSource();
          foundations[i].push(dragging.cards[0]);
          ++moveCount;
          score += 10;
          dropped = true;
          break;
        }
      }
    }

    // Proximity snap to tableau
    if (!dropped && dragging.cards.length === 1) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        if (dragging.source === 'tableau' && dragging.sourceCol === col)
          continue;
        const pile = tableau[col];
        const targetY = pile.length === 0 ? tableauPos(col).y : tableauCardPos(col, pile.length - 1).y;
        const tx = tableauPos(col).x;
        const dx = px - tx - CARD_W / 2;
        const dy = py - targetY - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H * 0.8 && canPlaceOnTableau(dragging.cards[0], col)) {
          removeFromSource();
          dragging.cards[0].faceUp = true;
          tableau[col].push(dragging.cards[0]);
          ++moveCount;
          dropped = true;
          break;
        }
      }
    }

    if (!dropped) {
      if (undoHistory.length > 0)
        undoHistory.pop();
    } else {
      statusMsg = '';
      if (_host && _host.onScoreChanged)
        _host.onScoreChanged(score);
    }

    dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromSource() {
    if (!dragging)
      return;
    if (dragging.source === 'waste')
      waste.splice(dragging.sourceIndex, 1);
    else if (dragging.source === 'tableau')
      tableau[dragging.sourceCol].splice(dragging.sourceIndex, 1);
  }

  /* ================================================================
   *  WIN DETECTION + AUTO-COMPLETE
   * ================================================================ */

  function foundationTotal() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += foundations[i].length;
    return total;
  }

  function checkWin() {
    if (foundationTotal() === 104) {
      doWin();
      return;
    }

    if (canAutoComplete()) {
      statusMsg = 'Auto-completing...';
      autoComplete();
    }
  }

  function canAutoComplete() {
    if (stock.length > 0 || waste.length > 0)
      return false;
    // All tableau cards must be face-up and in descending same-suit order
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      for (let i = 0; i < pile.length - 1; ++i) {
        if (pile[i].suit !== pile[i + 1].suit || pile[i].value !== pile[i + 1].value + 1)
          return false;
      }
    }
    return true;
  }

  function autoComplete() {
    const step = () => {
      let moved = false;
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = tableau[col];
        if (pile.length === 0)
          continue;
        const card = pile[pile.length - 1];
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          const fromPos = tableauCardPos(col, pile.length - 1);
          pile.pop();
          foundations[fi].push(card);
          ++moveCount;
          score += 10;
          moved = true;

          const toPos = foundationPos(fi);
          startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            if (foundationTotal() === 104)
              doWin();
            else
              setTimeout(step, 30);
          });
          break;
        }
      }
      if (!moved) {
        // Try waste as well
        if (waste.length > 0) {
          const card = waste[waste.length - 1];
          const fi = findFoundationTarget(card);
          if (fi >= 0) {
            const wp = wastePos();
            waste.pop();
            foundations[fi].push(card);
            ++moveCount;
            score += 10;

            const toPos = foundationPos(fi);
            startCardMoveAnim(card, wp.x, wp.y, toPos.x, toPos.y, () => {
              if (foundationTotal() === 104)
                doWin();
              else
                setTimeout(step, 30);
            });
          }
        }
      }
    };
    setTimeout(step, 200);
  }

  function doWin() {
    gameWon = true;
    stopTimer();
    statusMsg = 'Congratulations! You won in ' + moveCount + ' moves! Score: ' + score;
    if (_host && _host.onRoundOver)
      _host.onRoundOver(true);
    if (_host && _host.particles)
      _host.particles.confetti(canvasW / scale / 2, canvasH / scale / 3, 80);
    startWinAnimation();
  }

  /* ================================================================
   *  CARD MOVE ANIMATION
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
  }

  /* ================================================================
   *  WIN ANIMATION
   * ================================================================ */

  function startWinAnimation() {
    winAnimCards = [];
    particles = [];
    winAnimRunning = true;
    lastFireworkTime = 0;

    const allCards = [];
    for (let fi = 0; fi < FOUNDATION_COUNT; ++fi) {
      const fp = foundationPos(fi);
      for (const card of foundations[fi])
        allCards.push({ card, startX: fp.x, startY: fp.y });
    }

    let launchIndex = 0;
    winLaunchInterval = setInterval(() => {
      if (launchIndex >= allCards.length || !winAnimRunning) {
        clearInterval(winLaunchInterval);
        winLaunchInterval = null;
        return;
      }
      const c = allCards[launchIndex];
      winAnimCards.push({
        card: c.card,
        x: c.startX,
        y: c.startY,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 6 + 2),
        gravity: 0.2,
        bounces: 0,
        angle: 0,
        angularVelocity: (Math.random() - 0.5) * 0.08,
        trail: []
      });
      ++launchIndex;
    }, 40);
  }

  function stopWinAnimation() {
    winAnimRunning = false;
    if (winAnimId) {
      cancelAnimationFrame(winAnimId);
      winAnimId = null;
    }
    if (winLaunchInterval) {
      clearInterval(winLaunchInterval);
      winLaunchInterval = null;
    }
    winAnimCards = [];
    particles = [];
    animatingCards = [];
    dealAnimCards = [];
    dealAnimRunning = false;
  }

  /* ================================================================
   *  HINT SYSTEM
   * ================================================================ */

  function findHints() {
    const hints = [];

    // Check waste top card
    if (waste.length > 0) {
      const card = waste[waste.length - 1];
      if (findFoundationTarget(card) >= 0)
        hints.push({ source: 'waste', card });
      for (let c = 0; c < TABLEAU_COUNT; ++c)
        if (canPlaceOnTableau(card, c))
          hints.push({ source: 'waste', card, target: 'tableau', col: c });
    }

    // Check tableau top cards
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      if (pile.length === 0)
        continue;
      const card = pile[pile.length - 1];
      if (findFoundationTarget(card) >= 0)
        hints.push({ source: 'tableau', col, card });
      for (let c = 0; c < TABLEAU_COUNT; ++c) {
        if (c === col)
          continue;
        if (canPlaceOnTableau(card, c))
          hints.push({ source: 'tableau', col, card, target: 'tableau', targetCol: c });
      }
    }

    return hints;
  }

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  function drawStatusBar(cx, w, h) {
    const barY = h - 18;
    cx.font = '11px sans-serif';
    cx.textBaseline = 'bottom';
    cx.textAlign = 'left';
    cx.fillStyle = 'rgba(255,255,255,0.8)';

    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const timeStr = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');
    const movesStr = 'Moves: ' + moveCount;
    const scoreStr = 'Score: ' + score;
    const stockStr = 'Stock: ' + stock.length;

    const infoText = statusMsg + '  |  ' + scoreStr + '  |  ' + movesStr + '  |  ' + stockStr + '  |  ' + timeStr;
    cx.fillText(infoText, MARGIN_X, barY);
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawScene(cx, W, H) {
    canvasW = W;
    canvasH = H;
    scale = Math.min(W / BASE_W, H / BASE_H);

    cx.save();
    cx.scale(scale, scale);

    const scaledW = W / scale;
    const scaledH = H / scale;

    const now = performance.now();

    // --- Deal animation ---
    if (dealAnimRunning && dealAnimCards.length > 0) {
      // Draw empty slots during deal
      const sp = stockPos();
      CE.drawCardBack(cx, sp.x, sp.y);
      const wp = wastePos();
      CE.drawEmptySlot(cx, wp.x, wp.y, null);

      const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs', 'spades', 'hearts', 'diamonds', 'clubs'];
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      }
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const tp = tableauPos(col);
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
      }

      let allDone = true;
      for (const d of dealAnimCards) {
        if (now < d.startTime) {
          allDone = false;
          continue;
        }
        const elapsed = now - d.startTime;
        const t = Math.min(elapsed / d.duration, 1);
        const e = CE.easeOutCubic(t);
        const x = d.fromX + (d.toX - d.fromX) * e;
        const y = d.fromY + (d.toY - d.fromY) * e;
        CE.drawCardFace(cx, x, y, d.card);
        if (t < 1)
          allDone = false;
      }

      if (allDone) {
        dealAnimRunning = false;
        dealAnimCards = [];
      }

      drawStatusBar(cx, scaledW, scaledH);
      cx.restore();
      return;
    }

    // --- Win animation ---
    if (winAnimRunning) {
      if (now - lastFireworkTime > 500) {
        CE.spawnFirework(particles, Math.random() * scaledW, Math.random() * scaledH * 0.6);
        lastFireworkTime = now;
      }

      CE.drawWinCards(cx, winAnimCards, scaledW, scaledH);
      CE.updateAndDrawParticles(cx, particles);

      cx.fillStyle = '#fff';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(statusMsg, scaledW / 2, 4);

      cx.restore();
      return;
    }

    // --- Normal game draw ---
    const animSet = new Set();
    for (const a of animatingCards)
      animSet.add(a.card);

    // Stock pile
    const sp = stockPos();
    if (stock.length > 0) {
      const stackCount = Math.min(Math.ceil(stock.length / 10), 4);
      for (let i = 0; i < stackCount; ++i)
        CE.drawCardBack(cx, sp.x - i * 2, sp.y);
      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(stock.length, sp.x + CARD_W / 2, sp.y + CARD_H + 3);
    } else
      CE.drawEmptySlot(cx, sp.x, sp.y, null);

    // Waste pile
    const wp = wastePos();
    if (waste.length === 0) {
      CE.drawEmptySlot(cx, wp.x, wp.y, null);
    } else {
      const top = waste[waste.length - 1];
      if (!isDragSource('waste', waste.length - 1) && !animSet.has(top)) {
        CE.drawCardFace(cx, wp.x, wp.y, top);
        if (_host && _host.hintsEnabled && !dragging && hasAnyValidMove(top, -1))
          CE.drawHintGlow(cx, wp.x, wp.y, CARD_W, CARD_H, _host.hintTime);
      }
    }

    // Foundation piles
    const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs', 'spades', 'hearts', 'diamonds', 'clubs'];
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (foundations[i].length === 0) {
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      } else {
        const top = foundations[i][foundations[i].length - 1];
        if (!animSet.has(top))
          CE.drawCardFace(cx, fp.x, fp.y, top);
        else if (foundations[i].length > 1)
          CE.drawCardFace(cx, fp.x, fp.y, foundations[i][foundations[i].length - 2]);
        else {
          CE.drawEmptySlot(cx, fp.x, fp.y, null);
          cx.fillStyle = 'rgba(255,255,255,0.3)';
          CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
        }
      }
    }

    // Tableau columns
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      if (tableau[col].length === 0) {
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        continue;
      }
      for (let i = 0; i < tableau[col].length; ++i) {
        if (isDragSource('tableau', col) && i >= dragging.sourceIndex)
          continue;
        if (animSet.has(tableau[col][i]))
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCardFace(cx, pos.x, pos.y, tableau[col][i]);
        // Hint glow on top card only
        if (i === tableau[col].length - 1 && _host && _host.hintsEnabled && !dragging && hasAnyValidMove(tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
      }
    }

    // Draw animating cards
    for (let i = animatingCards.length - 1; i >= 0; --i) {
      const a = animatingCards[i];
      const elapsed = now - a.startTime;
      const t = Math.min(elapsed / a.duration, 1);
      const e = CE.easeOutCubic(t);
      const x = a.fromX + (a.toX - a.fromX) * e;
      const y = a.fromY + (a.toY - a.fromY) * e;
      CE.drawCardFace(cx, x, y, a.card);
      if (t >= 1) {
        animatingCards.splice(i, 1);
        CE.spawnSparkle(particles, a.toX + CARD_W / 2, a.toY + CARD_H / 2);
        if (a.onDone)
          a.onDone();
      }
    }

    // Draw dragged card on top
    if (dragging) {
      const dx = dragging.currentX - dragging.offsetX;
      const dy = dragging.currentY - dragging.offsetY;
      CE.drawCardFace(cx, dx, dy, dragging.cards[0]);
    }

    CE.updateAndDrawParticles(cx, particles);
    drawStatusBar(cx, scaledW, scaledH);

    cx.restore();
  }

  /* ================================================================
   *  COORDINATE CONVERSION
   * ================================================================ */

  function toGame(mx, my) {
    return { x: mx / scale, y: my / scale };
  }

  /* ================================================================
   *  DETECT STALEMATE
   * ================================================================ */

  function isStalemate() {
    // Can we deal from stock?
    if (stock.length > 0)
      return false;

    // Can waste card move anywhere?
    if (waste.length > 0) {
      const card = waste[waste.length - 1];
      if (findFoundationTarget(card) >= 0)
        return false;
      for (let c = 0; c < TABLEAU_COUNT; ++c)
        if (canPlaceOnTableau(card, c))
          return false;
    }

    // Can any tableau top card move?
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      if (pile.length === 0)
        continue;
      const card = pile[pile.length - 1];
      if (findFoundationTarget(card) >= 0)
        return false;
      for (let c = 0; c < TABLEAU_COUNT; ++c) {
        if (c === col)
          continue;
        if (canPlaceOnTableau(card, c))
          return false;
      }
    }

    return true;
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _canvas = canvas;
      _host = host || null;
      canvasW = W;
      canvasH = H;
      scale = Math.min(W / BASE_W, H / BASE_H);
      newGame();
    },

    draw(ctx, W, H) {
      drawScene(ctx, W, H);
    },

    handleClick(mx, my) {
      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      if (gameWon) {
        stopWinAnimation();
        newGame();
        return;
      }

      if (dealAnimRunning)
        return;

      pointerStartX = px;
      pointerStartY = py;

      const hit = hitTest(px, py);
      if (!hit)
        return;

      const now = Date.now();
      const isDoubleClick = (now - lastClickTime < 400) && lastClickHit &&
        lastClickHit.area === hit.area &&
        lastClickHit.col === hit.col &&
        lastClickHit.index === hit.index;
      lastClickTime = now;
      lastClickHit = hit;

      if (hit.area === 'stock') {
        dealFromStock();
        // Check for stalemate after dealing
        if (stock.length === 0 && waste.length > 0)
          setTimeout(() => {
            if (isStalemate())
              statusMsg = 'No more moves available!';
          }, 300);
        return;
      }

      // Double-click waste -> auto foundation
      if (isDoubleClick && hit.area === 'waste') {
        const card = waste[hit.index];
        if (card && card.faceUp)
          autoMoveToFoundation(card, 'waste', 0, hit.index);
        return;
      }

      // Double-click tableau top -> auto foundation
      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && hit.index === tableau[hit.col].length - 1)
          autoMoveToFoundation(card, 'tableau', hit.col, hit.index);
        return;
      }

      // Single card drag from waste
      if (hit.area === 'waste') {
        if (hit.index !== waste.length - 1)
          return;
        const card = waste[hit.index];
        if (!card || !card.faceUp)
          return;
        if (!gameStarted)
          startTimer();
        saveState();
        dragging = {
          cards: [card],
          source: 'waste',
          sourceIndex: hit.index,
          offsetX: px - wastePos().x,
          offsetY: py - wastePos().y,
          currentX: px,
          currentY: py
        };
        if (_canvas && _canvas.setPointerCapture)
          _canvas.setPointerCapture(0);
        return;
      }

      // Single card drag from tableau (only top card in Forty Thieves)
      if (hit.area === 'tableau') {
        const card = hit.card;
        if (!card || !card.faceUp)
          return;
        // Forty Thieves: only the top card can be moved
        if (hit.index !== tableau[hit.col].length - 1)
          return;
        if (!gameStarted)
          startTimer();
        saveState();
        const pos = tableauCardPos(hit.col, hit.index);
        dragging = {
          cards: [card],
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: hit.index,
          offsetX: px - pos.x,
          offsetY: py - pos.y,
          currentX: px,
          currentY: py
        };
        if (_canvas && _canvas.setPointerCapture)
          _canvas.setPointerCapture(0);
      }
    },

    handlePointerMove(mx, my) {
      if (!dragging)
        return;
      const p = toGame(mx, my);
      dragging.currentX = p.x;
      dragging.currentY = p.y;
    },

    handlePointerUp(mx, my, e) {
      if (!dragging)
        return;

      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      const dx = px - pointerStartX;
      const dy = py - pointerStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        if (undoHistory.length > 0)
          undoHistory.pop();
        dragging = null;
        return;
      }

      if (_canvas && e && e.pointerId !== undefined && _canvas.releasePointerCapture)
        _canvas.releasePointerCapture(e.pointerId);

      tryDrop(px, py);
    },

    handleKey(e) {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        const hints = findHints();
        if (hints.length === 0)
          statusMsg = 'No hints available';
        else
          statusMsg = hints.length + ' possible move' + (hints.length > 1 ? 's' : '') + ' available';
      }
    },

    tick(dt) {
      // Animations driven by draw loop
    },

    cleanup() {
      stopWinAnimation();
      stopTimer();

      stock = [];
      waste = [];
      foundations = [[], [], [], [], [], [], [], []];
      tableau = [[], [], [], [], [], [], [], [], [], []];
      undoHistory = [];
      dragging = null;
      animatingCards = [];
      dealAnimCards = [];
      dealAnimRunning = false;
      particles = [];
      winAnimCards = [];
      gameWon = false;
      gameStarted = false;
      moveCount = 0;
      score = 0;
      timerSeconds = 0;
      statusMsg = '';
      lastClickTime = 0;
      lastClickHit = null;
      _ctx = null;
      _canvas = null;
      _host = null;
    },

    isRoundOver() { return gameWon; },
    isGameOver() { return gameWon || (stock.length === 0 && isStalemate()); },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('fortythieves', module);

})();
