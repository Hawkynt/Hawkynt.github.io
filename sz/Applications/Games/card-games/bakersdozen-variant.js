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
  const MARGIN_X = 6;
  const MARGIN_Y = 8;

  const TABLEAU_COUNT = 13;
  const FOUNDATION_COUNT = 4;
  const CARDS_PER_COLUMN = 4;

  const COL_GAP = Math.floor((900 - MARGIN_X * 2 - TABLEAU_COUNT * CARD_W) / (TABLEAU_COUNT - 1));
  const PILE_GAP = CARD_W + COL_GAP;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 480;

  const FOUNDATION_GAP = 12;
  const FOUNDATION_TOTAL_W = FOUNDATION_COUNT * CARD_W + (FOUNDATION_COUNT - 1) * FOUNDATION_GAP;

  const TABLEAU_TOP = MARGIN_Y + CARD_H + 18;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let foundations = [[], [], [], []];
  let tableau = [];
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
  let selection = null;

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

  /* ================================================================
   *  LAYOUT HELPERS
   * ================================================================ */

  function foundationPos(i) {
    const totalW = canvasW / scale;
    const startX = (totalW - FOUNDATION_TOTAL_W) / 2;
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
   *  DECK + DEAL
   * ================================================================ */

  function createFaceUpDeck() {
    const deck = CE.shuffle(CE.createDeck());
    for (const c of deck)
      c.faceUp = true;
    return deck;
  }

  function dealGame() {
    const deck = createFaceUpDeck();

    const cols = [];
    for (let c = 0; c < TABLEAU_COUNT; ++c)
      cols.push([]);

    for (let i = 0; i < deck.length; ++i)
      cols[i % TABLEAU_COUNT].push(deck[i]);

    // Baker's Dozen rule: move kings to the bottom of each column
    for (let c = 0; c < TABLEAU_COUNT; ++c) {
      const col = cols[c];
      // Repeatedly scan and move kings down until all kings are at the bottom
      let changed = true;
      while (changed) {
        changed = false;
        for (let i = 0; i < col.length - 1; ++i) {
          if (col[i].value === 12) { // King
            const king = col.splice(i, 1)[0];
            col.unshift(king);
            changed = true;
            break;
          }
        }
      }
    }

    return cols;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    stopWinAnimation();
    stopTimer();
    dealAnimCards = [];
    dealAnimRunning = false;

    foundations = [[], [], [], []];
    moveCount = 0;
    score = 0;
    timerSeconds = 0;
    gameStarted = false;
    gameWon = false;
    undoHistory = [];
    dragging = null;
    selection = null;
    animatingCards = [];
    particles = [];

    tableau = dealGame();
    startDealAnimation();
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      foundations: foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank }))),
      tableau: tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank }))),
      moveCount,
      score
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    foundations = s.foundations.map(f => f.map(c => {
      const card = CE.makeCard(c.suit, c.rank);
      card.faceUp = true;
      return card;
    }));
    tableau = s.tableau.map(t => t.map(c => {
      const card = CE.makeCard(c.suit, c.rank);
      card.faceUp = true;
      return card;
    }));
    moveCount = s.moveCount;
    score = s.score;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
    selection = null;
    dragging = null;
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
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (px >= fp.x && px < fp.x + CARD_W && py >= fp.y && py < fp.y + CARD_H)
        return { area: 'foundation', index: i };
    }

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
   *  GAME RULES
   * ================================================================ */

  function canPlaceOnFoundation(card, foundationIndex) {
    const pile = foundations[foundationIndex];
    if (pile.length === 0)
      return card.value === 0; // Ace
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = tableau[col];
    // Empty columns cannot be filled in Baker's Dozen
    if (pile.length === 0)
      return false;
    const top = pile[pile.length - 1];
    // Cannot place on a King
    if (top.value === 12)
      return false;
    // Build down regardless of suit
    return card.value === top.value - 1;
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
   *  isDragSource HELPER
   * ================================================================ */

  function isDragSource(type, col) {
    if (!dragging)
      return false;
    if (type === 'tableau' && dragging.source === 'tableau' && dragging.sourceCol === col)
      return true;
    return false;
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceCol) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!gameStarted)
      startTimer();
    saveState();

    const pos = tableauCardPos(sourceCol, tableau[sourceCol].length - 1);
    tableau[sourceCol].pop();
    card.faceUp = true;
    foundations[fi].push(card);
    ++moveCount;
    score += 10;

    const fp = foundationPos(fi);
    startCardMoveAnim(card, pos.x, pos.y, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  AUTO-COMPLETE
   * ================================================================ */

  function tryAutoCompleteStep() {
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      if (pile.length > 0) {
        const card = pile[pile.length - 1];
        if (findFoundationTarget(card) >= 0)
          return true;
      }
    }
    return false;
  }

  function isSafeAutoComplete() {
    // Safe to auto-complete when all remaining cards are in descending order
    // within each column (which they always are in Baker's Dozen since only
    // top cards move) and all foundation minimums are close enough
    const minVals = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      minVals.push(foundations[i].length > 0 ? foundations[i][foundations[i].length - 1].value : -1);
    const minVal = Math.min(...minVals);

    // Only auto-complete if all top cards are within 2 ranks of the min foundation
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      if (pile.length > 0 && pile[pile.length - 1].value > minVal + 2)
        return false;
    }
    return true;
  }

  function doAutoComplete() {
    const step = () => {
      let moved = false;

      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = tableau[col];
        if (pile.length === 0)
          continue;
        const card = pile[pile.length - 1];
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          saveState();
          const fromPos = tableauCardPos(col, pile.length - 1);
          pile.pop();
          card.faceUp = true;
          foundations[fi].push(card);
          ++moveCount;
          score += 10;
          moved = true;

          const toPos = foundationPos(fi);
          startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            let total = 0;
            for (let j = 0; j < FOUNDATION_COUNT; ++j)
              total += foundations[j].length;
            if (total === 52)
              doWin();
            else
              setTimeout(step, 30);
          });
          break;
        }
      }
    };
    setTimeout(step, 200);
  }

  /* ================================================================
   *  SELECTION-BASED MOVE
   * ================================================================ */

  function moveSelectionTo(hit) {
    if (!selection)
      return false;

    const card = selection.card;

    if (hit.area === 'foundation') {
      if (canPlaceOnFoundation(card, hit.index)) {
        if (!gameStarted)
          startTimer();
        saveState();
        tableau[selection.col].pop();
        foundations[hit.index].push(card);
        ++moveCount;
        score += 10;
        selection = null;
        checkWin();
        return true;
      }
    }

    if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
      const targetCol = hit.col;
      if (canPlaceOnTableau(card, targetCol)) {
        if (!gameStarted)
          startTimer();
        saveState();
        tableau[selection.col].pop();
        tableau[targetCol].push(card);
        ++moveCount;
        selection = null;
        checkWin();
        return true;
      }
    }

    return false;
  }

  /* ================================================================
   *  DROP LOGIC (drag and drop)
   * ================================================================ */

  function tryDrop(px, py) {
    if (!dragging)
      return;

    const hit = hitTest(px, py);
    let dropped = false;

    if (hit) {
      if (hit.area === 'foundation') {
        if (canPlaceOnFoundation(dragging.card, hit.index)) {
          removeFromDragSource();
          foundations[hit.index].push(dragging.card);
          ++moveCount;
          score += 10;
          dropped = true;
        }
      } else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const targetCol = hit.col;
        if (canPlaceOnTableau(dragging.card, targetCol)) {
          removeFromDragSource();
          tableau[targetCol].push(dragging.card);
          ++moveCount;
          dropped = true;
        }
      }
    }

    // Proximity snap to foundations
    if (!dropped) {
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        const dx = px - fp.x - CARD_W / 2;
        const dy = py - fp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(dragging.card, i)) {
          removeFromDragSource();
          foundations[i].push(dragging.card);
          ++moveCount;
          score += 10;
          dropped = true;
          break;
        }
      }
    }

    // Proximity snap to tableau columns
    if (!dropped) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = tableau[col];
        if (pile.length === 0)
          continue;
        const tp = tableauCardPos(col, pile.length - 1);
        const tx = tableauPos(col).x;
        const dx = px - tx - CARD_W / 2;
        const dy = py - tp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H * 0.8 && canPlaceOnTableau(dragging.card, col)) {
          if (dragging.source === 'tableau' && dragging.sourceCol === col)
            continue;
          removeFromDragSource();
          tableau[col].push(dragging.card);
          ++moveCount;
          dropped = true;
          break;
        }
      }
    }

    if (!dropped) {
      if (undoHistory.length > 0)
        undoHistory.pop();
    }

    dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromDragSource() {
    if (!dragging)
      return;
    if (dragging.source === 'tableau')
      tableau[dragging.sourceCol].pop();
  }

  /* ================================================================
   *  WIN DETECTION + ANIMATION
   * ================================================================ */

  function checkWin() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += foundations[i].length;
    if (total === 52) {
      doWin();
      return;
    }

    if (tryAutoCompleteStep() && isSafeAutoComplete())
      doAutoComplete();
  }

  function doWin() {
    gameWon = true;
    stopTimer();
    startWinAnimation();
  }

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

    CE.launchWinCards(allCards, winAnimCards, { get value() { return winAnimRunning; } }, 80);
  }

  function stopWinAnimation() {
    winAnimRunning = false;
    if (winAnimId) {
      cancelAnimationFrame(winAnimId);
      winAnimId = null;
    }
    winAnimCards = [];
    particles = [];
    animatingCards = [];
    dealAnimCards = [];
    dealAnimRunning = false;
  }

  /* ================================================================
   *  STALEMATE DETECTION
   * ================================================================ */

  function isStalemate() {
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      if (pile.length === 0)
        continue;
      const card = pile[pile.length - 1];
      if (hasAnyValidMove(card, col))
        return false;
    }
    return true;
  }

  /* ================================================================
   *  DEAL ANIMATION
   * ================================================================ */

  function startDealAnimation() {
    dealAnimCards = [];
    dealAnimRunning = true;
    const now = performance.now();
    const centerX = (canvasW / scale) / 2 - CARD_W / 2;
    const centerY = (canvasH / scale) / 2 - CARD_H / 2;
    let cardNum = 0;
    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (let row = 0; row < tableau[col].length; ++row) {
        const dest = tableauCardPos(col, row);
        dealAnimCards.push({
          card: tableau[col][row],
          fromX: centerX,
          fromY: centerY,
          toX: dest.x,
          toY: dest.y,
          startTime: now + cardNum * 25,
          duration: 250
        });
        ++cardNum;
      }
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
      const foundSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
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

      drawStatusOverlay(cx, scaledW, scaledH);
      cx.restore();
      return;
    }

    // --- Win animation ---
    if (winAnimRunning) {
      if (now - lastFireworkTime > 500) {
        CE.spawnFirework(particles, Math.random() * scaledW, Math.random() * scaledH * 0.6);
        lastFireworkTime = now;
      }

      const anyAlive = CE.drawWinCards(cx, winAnimCards, scaledW, scaledH);
      CE.updateAndDrawParticles(cx, particles);

      if (!anyAlive && winAnimCards.length > 0 && particles.length === 0)
        winAnimRunning = false;

      cx.fillStyle = '#fff';
      cx.font = 'bold 16px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText('You won! Score: ' + score + '  Moves: ' + moveCount, scaledW / 2, 4);

      cx.restore();
      return;
    }

    // --- Normal game draw ---
    const animSet = new Set();
    for (const a of animatingCards)
      animSet.add(a.card);

    // Foundation piles
    const foundSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
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
        // Draw dimmed empty slot (cannot be filled)
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        cx.fillStyle = 'rgba(255,0,0,0.15)';
        cx.fillRect(tp.x + 1, tp.y + 1, CARD_W - 2, CARD_H - 2);
        continue;
      }
      for (let i = 0; i < tableau[col].length; ++i) {
        if (isDragSource('tableau', col) && i >= dragging.sourceIndex)
          continue;
        const pos = tableauCardPos(col, i);
        const card = tableau[col][i];
        if (!animSet.has(card))
          CE.drawCardFace(cx, pos.x, pos.y, card);
        if (i === tableau[col].length - 1 && _host && _host.hintsEnabled && !dragging && !animSet.has(card) && hasAnyValidMove(card, col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
      }
      if (selection && selection.col === col) {
        const selPos = tableauCardPos(col, tableau[col].length - 1);
        CE.drawSelectionHighlight(cx, selPos.x, selPos.y, CARD_H);
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
      CE.drawCardFace(cx, dx, dy, dragging.card);
    }

    CE.updateAndDrawParticles(cx, particles);
    drawStatusOverlay(cx, scaledW, scaledH);

    cx.restore();
  }

  function drawStatusOverlay(cx, w, h) {
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.font = '11px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'bottom';

    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const timeStr = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');

    let foundTotal = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      foundTotal += foundations[i].length;

    cx.fillText('Score: ' + score + '  |  Moves: ' + moveCount + '  |  ' + timeStr + '  |  Foundation: ' + foundTotal + '/52', 4, h - 2);
  }

  /* ================================================================
   *  COORDINATE CONVERSION
   * ================================================================ */

  function toGame(mx, my) {
    return { x: mx / scale, y: my / scale };
  }

  /* ================================================================
   *  PUBLIC INTERFACE
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

      const hit = hitTest(px, py);
      if (!hit) {
        selection = null;
        return;
      }

      const now = Date.now();
      const isDoubleClick = (now - lastClickTime < 400) && lastClickHit &&
        lastClickHit.area === hit.area &&
        lastClickHit.col === hit.col &&
        lastClickHit.index === hit.index;
      lastClickTime = now;
      lastClickHit = hit;

      // Double-click: auto-move top card to foundation
      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && hit.index === tableau[hit.col].length - 1) {
          selection = null;
          autoMoveToFoundation(card, hit.col);
        }
        return;
      }

      // If there's a current selection, try to move it to the clicked target
      if (selection) {
        const moved = moveSelectionTo(hit);
        if (moved)
          return;
        // Clicking the same card deselects
        if (selection.col === hit.col && hit.area === 'tableau') {
          selection = null;
          return;
        }
      }

      // Only top cards can be selected/dragged in Baker's Dozen
      if (hit.area === 'tableau') {
        const pile = tableau[hit.col];
        if (hit.index !== pile.length - 1)
          return;

        const card = hit.card;
        if (!card)
          return;

        selection = { col: hit.col, card };

        const pos = tableauCardPos(hit.col, hit.index);
        if (!gameStarted)
          startTimer();
        saveState();
        dragging = {
          card,
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: hit.index,
          offsetX: px - pos.x,
          offsetY: py - pos.y,
          currentX: px,
          currentY: py
        };
        pointerStartX = px;
        pointerStartY = py;
        if (_canvas)
          _canvas.setPointerCapture(getLastPointerId());
        return;
      }

      // Clicking foundation or empty tableau with selection
      if (selection && (hit.area === 'tableau-empty' || hit.area === 'foundation')) {
        const moved = moveSelectionTo(hit);
        if (!moved)
          selection = null;
        return;
      }

      selection = null;
    },

    handlePointerMove(mx, my) {
      if (!dragging)
        return;
      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      const dx = px - pointerStartX;
      const dy = py - pointerStartY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5)
        return;

      dragging.currentX = px;
      dragging.currentY = py;
    },

    handlePointerUp(mx, my, e) {
      if (!dragging)
        return;

      const p = toGame(mx, my);
      const px = p.x;
      const py = p.y;

      const dx = px - pointerStartX;
      const dy = py - pointerStartY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        if (undoHistory.length > 0)
          undoHistory.pop();
        dragging = null;
        return;
      }

      if (_canvas && e && e.pointerId !== undefined)
        _canvas.releasePointerCapture(e.pointerId);
      selection = null;
      tryDrop(px, py);
    },

    handleKey(e) {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === 'a' && !e.ctrlKey && !e.altKey) {
        if (tryAutoCompleteStep() && isSafeAutoComplete())
          doAutoComplete();
        return;
      }
      if (e.key === 'Escape')
        selection = null;
    },

    tick(dt) {},

    cleanup() {
      stopWinAnimation();
      stopTimer();
      foundations = [[], [], [], []];
      tableau = [];
      undoHistory = [];
      dragging = null;
      selection = null;
      dealAnimCards = [];
      dealAnimRunning = false;
      animatingCards = [];
      particles = [];
      gameWon = false;
      gameStarted = false;
      moveCount = 0;
      score = 0;
      timerSeconds = 0;
      lastClickTime = 0;
      lastClickHit = null;
      _ctx = null;
      _canvas = null;
      _host = null;
    },

    isRoundOver() { return gameWon; },
    isGameOver() { return gameWon || isStalemate(); },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  /* ================================================================
   *  POINTER ID TRACKING
   * ================================================================ */

  let _lastPointerId = 0;

  function getLastPointerId() {
    return _lastPointerId;
  }

  const origSetup = module.setup;
  module.setup = function(ctx, canvas, W, H, host) {
    origSetup.call(this, ctx, canvas, W, H, host);
    if (_canvas) {
      _canvas.addEventListener('pointerdown', function(ev) {
        _lastPointerId = ev.pointerId;
      });
    }
  };

  /* ================================================================
   *  REGISTER WITH HOST
   * ================================================================ */

  SZ.CardGames.registerVariant('bakersdozen', module);

})();
