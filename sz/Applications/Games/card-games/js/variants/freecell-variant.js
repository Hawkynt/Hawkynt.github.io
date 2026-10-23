;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const CARD_GAP = 14;
  const FACE_UP_OFFSET = 22;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FREECELL_COUNT = 4;
  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 8;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 450;

  const TOP_ROW_Y = MARGIN_Y;
  const TABLEAU_TOP = TOP_ROW_Y + CARD_H + 16;

  /* ================================================================
   *  GAME STATE (module-scoped)
   * ================================================================ */

  let freeCells = [null, null, null, null];
  let foundations = [[], [], [], []];
  let tableau = [[], [], [], [], [], [], [], []];
  let gameNumber = 1;
  let moveCount = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let gameStarted = false;
  let gameWon = false;
  let undoHistory = [];
  const MAX_UNDO = 500;

  let selection = null;
  let dragging = null;

  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;
  let particles = [];
  let lastFireworkTime = 0;

  let animatingCards = [];

  let dealAnimCards = [];
  let dealAnimRunning = false;

  let _ctx = null;
  let _canvas = null;
  let _host = null;
  let canvasW = 900;
  let canvasH = 600;
  let scale = 1;

  let lastClickTime = 0;
  let lastClickHit = null;

  let pointerStartX = 0;
  let pointerStartY = 0;

  /* ================================================================
   *  DECK + SEEDED RNG (Windows FreeCell style)
   * ================================================================ */

  function createDeck() {
    const deck = [];
    const winSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
    for (const suit of winSuits)
      for (const rank of CE.RANKS)
        deck.push(CE.makeCard(suit, rank));
    // FreeCell cards are always face-up
    for (const c of deck)
      c.faceUp = true;
    return deck;
  }

  function msRng(seed) {
    let state = seed;
    return function() {
      state = (state * 214013 + 2531011) & 0x7FFFFFFF;
      return (state >> 16) & 0x7FFF;
    };
  }

  function dealGame(num) {
    const deck = createDeck();
    const rng = msRng(num);

    for (let i = 51; i > 0; --i) {
      const j = rng() % (i + 1);
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }

    const cols = [[], [], [], [], [], [], [], []];
    for (let i = 0; i < 52; ++i)
      cols[i % 8].push(deck[i]);

    return cols;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame(num) {
    stopWinAnimation();
    stopTimer();
    dealAnimCards = [];
    dealAnimRunning = false;

    if (num === undefined)
      num = Math.floor(Math.random() * 1000000) + 1;

    gameNumber = num;

    freeCells = [null, null, null, null];
    foundations = [[], [], [], []];
    moveCount = 0;
    timerSeconds = 0;
    gameStarted = false;
    gameWon = false;
    undoHistory = [];
    dragging = null;
    selection = null;

    tableau = dealGame(gameNumber);
    startDealAnimation();
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      freeCells: freeCells.map(c => c ? { suit: c.suit, rank: c.rank } : null),
      foundations: foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank }))),
      tableau: tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank }))),
      moveCount
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    freeCells = s.freeCells.map(c => c ? CE.makeCard(c.suit, c.rank) : null);
    // FreeCell cards are always face-up
    for (const c of freeCells)
      if (c) c.faceUp = true;
    foundations = s.foundations.map(f => f.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = true; return card; }));
    tableau = s.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = true; return card; }));
    moveCount = s.moveCount;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
    selection = null;
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
   *  LAYOUT: compute positions
   * ================================================================ */

  function freeCellPos(i) {
    return { x: MARGIN_X + i * PILE_GAP, y: TOP_ROW_Y };
  }

  function foundationPos(i) {
    return { x: MARGIN_X + (4 + i) * PILE_GAP, y: TOP_ROW_Y };
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * PILE_GAP, y: TABLEAU_TOP };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    return { x: base.x, y: base.y + index * FACE_UP_OFFSET };
  }

  /* ================================================================
   *  SUPERMOVE CALCULATION
   * ================================================================ */

  function emptyFreeCellCount() {
    let count = 0;
    for (let i = 0; i < FREECELL_COUNT; ++i)
      if (!freeCells[i])
        ++count;
    return count;
  }

  function emptyTableauCount(excludeCol) {
    let count = 0;
    for (let i = 0; i < TABLEAU_COUNT; ++i)
      if (i !== excludeCol && tableau[i].length === 0)
        ++count;
    return count;
  }

  function maxMoveableCards(excludeCol) {
    const free = emptyFreeCellCount();
    const empty = emptyTableauCount(excludeCol);
    return (1 + free) * Math.pow(2, empty);
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const pos = freeCellPos(i);
      if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + CARD_H)
        return { area: freeCells[i] ? 'freecell' : 'freecell-empty', col: i };
    }

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
      return card.value === 0;
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = tableau[col];
    if (pile.length === 0)
      return true;
    const top = pile[pile.length - 1];
    return card.color !== top.color && card.value === top.value - 1;
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
    for (let i = 0; i < FREECELL_COUNT; ++i)
      if (!freeCells[i])
        return true;
    return false;
  }

  function isValidRun(col, fromIndex) {
    const pile = tableau[col];
    for (let i = fromIndex; i < pile.length - 1; ++i) {
      const curr = pile[i];
      const next = pile[i + 1];
      if (curr.color === next.color || curr.value !== next.value + 1)
        return false;
    }
    return true;
  }

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(type, index) {
    if (!dragging)
      return false;
    if (type === 'freecell' && dragging.source === 'freecell' && dragging.sourceCol === index)
      return true;
    if (type === 'tableau' && dragging.source === 'tableau' && dragging.sourceCol === index)
      return true;
    return false;
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION
   * ================================================================ */

  function autoMoveToFoundation(card, sourceType, sourceCol) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!gameStarted)
      startTimer();
    saveState();

    let fromX, fromY;
    if (sourceType === 'freecell') {
      const pos = freeCellPos(sourceCol);
      fromX = pos.x;
      fromY = pos.y;
      freeCells[sourceCol] = null;
    } else if (sourceType === 'tableau') {
      const pos = tableauCardPos(sourceCol, tableau[sourceCol].length - 1);
      fromX = pos.x;
      fromY = pos.y;
      tableau[sourceCol].pop();
    }

    foundations[fi].push(card);
    ++moveCount;

    const fp = foundationPos(fi);
    startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  AUTO-COMPLETE
   * ================================================================ */

  function tryAutoCompleteStep() {
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const card = freeCells[i];
      if (card && findFoundationTarget(card) >= 0)
        return true;
    }
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

  function doAutoComplete() {
    const step = () => {
      let moved = false;

      for (let i = 0; i < FREECELL_COUNT; ++i) {
        const card = freeCells[i];
        if (!card)
          continue;
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          saveState();
          const fromPos = freeCellPos(i);
          freeCells[i] = null;
          foundations[fi].push(card);
          ++moveCount;
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

      if (!moved) {
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
            foundations[fi].push(card);
            ++moveCount;
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
      }
    };
    setTimeout(step, 200);
  }

  /* ================================================================
   *  MOVE LOGIC (click-to-move selection)
   * ================================================================ */

  function moveSelectionTo(hit) {
    if (!selection)
      return false;

    const cards = selection.cards;
    const card = cards[0];

    if (hit.area === 'foundation' && cards.length === 1) {
      if (canPlaceOnFoundation(card, hit.index)) {
        if (!gameStarted)
          startTimer();
        saveState();
        removeSelectionFromSource();
        foundations[hit.index].push(card);
        ++moveCount;
        selection = null;
        checkWin();
        return true;
      }
    }

    if (hit.area === 'freecell-empty' && cards.length === 1) {
      if (!gameStarted)
        startTimer();
      saveState();
      removeSelectionFromSource();
      freeCells[hit.col] = card;
      ++moveCount;
      selection = null;
      return true;
    }

    if (hit.area === 'freecell' && cards.length === 1 && selection.source === 'freecell') {
      if (!gameStarted)
        startTimer();
      saveState();
      const temp = freeCells[hit.col];
      freeCells[hit.col] = freeCells[selection.col];
      freeCells[selection.col] = temp;
      ++moveCount;
      selection = null;
      return true;
    }

    if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
      const targetCol = hit.col;
      if (canPlaceOnTableau(card, targetCol)) {
        const moveLimit = maxMoveableCards(targetCol);
        if (cards.length > moveLimit)
          return false;
        if (!gameStarted)
          startTimer();
        saveState();
        removeSelectionFromSource();
        for (const c of cards)
          tableau[targetCol].push(c);
        ++moveCount;
        selection = null;
        checkWin();
        return true;
      }
    }

    return false;
  }

  function removeSelectionFromSource() {
    if (!selection)
      return;
    if (selection.source === 'freecell')
      freeCells[selection.col] = null;
    else if (selection.source === 'tableau')
      tableau[selection.col].splice(selection.index);
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
      if (hit.area === 'foundation' && dragging.cards.length === 1) {
        if (canPlaceOnFoundation(dragging.cards[0], hit.index)) {
          removeFromDragSource();
          foundations[hit.index].push(dragging.cards[0]);
          ++moveCount;
          dropped = true;
        }
      } else if (hit.area === 'freecell-empty' && dragging.cards.length === 1) {
        removeFromDragSource();
        freeCells[hit.col] = dragging.cards[0];
        ++moveCount;
        dropped = true;
      } else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const targetCol = hit.col;
        if (canPlaceOnTableau(dragging.cards[0], targetCol)) {
          const moveLimit = maxMoveableCards(targetCol);
          if (dragging.cards.length <= moveLimit) {
            removeFromDragSource();
            for (const card of dragging.cards)
              tableau[targetCol].push(card);
            ++moveCount;
            dropped = true;
          }
        }
      }
    }

    if (!dropped) {
      if (dragging.cards.length === 1) {
        for (let i = 0; i < FOUNDATION_COUNT; ++i) {
          const fp = foundationPos(i);
          const dx = px - fp.x - CARD_W / 2;
          const dy = py - fp.y - CARD_H / 2;
          if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(dragging.cards[0], i)) {
            removeFromDragSource();
            foundations[i].push(dragging.cards[0]);
            ++moveCount;
            dropped = true;
            break;
          }
        }
      }

      if (!dropped && dragging.cards.length === 1) {
        for (let i = 0; i < FREECELL_COUNT; ++i) {
          if (freeCells[i])
            continue;
          const pos = freeCellPos(i);
          const dx = px - pos.x - CARD_W / 2;
          const dy = py - pos.y - CARD_H / 2;
          if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H) {
            removeFromDragSource();
            freeCells[i] = dragging.cards[0];
            ++moveCount;
            dropped = true;
            break;
          }
        }
      }

      if (!dropped) {
        for (let col = 0; col < TABLEAU_COUNT; ++col) {
          const pile = tableau[col];
          let targetY;
          if (pile.length === 0) {
            const tp = tableauPos(col);
            targetY = tp.y;
          } else {
            const tp = tableauCardPos(col, pile.length - 1);
            targetY = tp.y;
          }
          const tx = tableauPos(col).x;
          const dx = px - tx - CARD_W / 2;
          const dy = py - targetY - CARD_H / 2;
          if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H * 0.8 && canPlaceOnTableau(dragging.cards[0], col)) {
            if (dragging.source === 'tableau' && dragging.sourceCol === col)
              continue;
            const moveLimit = maxMoveableCards(col);
            if (dragging.cards.length <= moveLimit) {
              removeFromDragSource();
              for (const card of dragging.cards)
                tableau[col].push(card);
              ++moveCount;
              dropped = true;
              break;
            }
          }
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
    if (dragging.source === 'freecell')
      freeCells[dragging.sourceCol] = null;
    else if (dragging.source === 'tableau')
      tableau[dragging.sourceCol].splice(dragging.sourceIndex);
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

    if (tryAutoCompleteStep()) {
      if (isSafeAutoComplete())
        doAutoComplete();
    }
  }

  function isSafeAutoComplete() {
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      for (let i = 0; i < pile.length - 1; ++i) {
        const curr = pile[i];
        const next = pile[i + 1];
        if (curr.color === next.color || curr.value !== next.value + 1)
          return false;
      }
    }

    const minVals = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      minVals.push(foundations[i].length > 0 ? foundations[i][foundations[i].length - 1].value : -1);
    const minVal = Math.min(...minVals);

    for (let i = 0; i < FREECELL_COUNT; ++i) {
      if (freeCells[i] && freeCells[i].value > minVal + 2)
        return false;
    }
    return true;
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
   *  DEAL ANIMATION
   * ================================================================ */

  function startDealAnimation() {
    dealAnimCards = [];
    dealAnimRunning = true;
    const now = performance.now();
    const centerX = canvasW / 2 - CARD_W / 2;
    const centerY = canvasH / 2 - CARD_H / 2;
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
          startTime: now + cardNum * 30,
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
   *  MAIN DRAW (called by host each frame)
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
      for (let i = 0; i < FREECELL_COUNT; ++i) {
        const pos = freeCellPos(i);
        CE.drawEmptySlot(cx, pos.x, pos.y, null);
      }
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
      cx.fillText('You won Game #' + gameNumber + ' in ' + moveCount + ' moves!', scaledW / 2, 4);

      cx.restore();
      return;
    }

    // --- Normal game draw ---
    const animSet = new Set();
    for (const a of animatingCards)
      animSet.add(a.card);

    // Separator line
    cx.strokeStyle = 'rgba(255,255,255,0.1)';
    cx.lineWidth = 1;
    const sepX = MARGIN_X + 4 * PILE_GAP - CARD_GAP / 2;
    cx.beginPath();
    cx.moveTo(sepX, TOP_ROW_Y + 4);
    cx.lineTo(sepX, TOP_ROW_Y + CARD_H - 4);
    cx.stroke();

    // Free cells
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const pos = freeCellPos(i);
      if (freeCells[i]) {
        if (!isDragSource('freecell', i)) {
          CE.drawCardFace(cx, pos.x, pos.y, freeCells[i]);
          if (selection && selection.source === 'freecell' && selection.col === i)
            CE.drawSelectionHighlight(cx, pos.x, pos.y, CARD_H);
          else if (_host && _host.hintsEnabled && !dragging && !animSet.has(freeCells[i]) && hasAnyValidMove(freeCells[i], -1))
            CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
        }
      } else
        CE.drawEmptySlot(cx, pos.x, pos.y, null);
    }

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
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        continue;
      }
      for (let i = 0; i < tableau[col].length; ++i) {
        if (isDragSource('tableau', col) && i >= dragging.sourceIndex)
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCardFace(cx, pos.x, pos.y, tableau[col][i]);
        if (i === tableau[col].length - 1 && _host && _host.hintsEnabled && !dragging && !animSet.has(tableau[col][i]) && hasAnyValidMove(tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
      }
      if (selection && selection.source === 'tableau' && selection.col === col) {
        const selPos = tableauCardPos(col, selection.index);
        const stackH = (tableau[col].length - 1 - selection.index) * FACE_UP_OFFSET + CARD_H;
        CE.drawSelectionHighlight(cx, selPos.x, selPos.y, stackH);
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

    // Draw dragged cards on top
    if (dragging) {
      for (let i = 0; i < dragging.cards.length; ++i) {
        const dx = dragging.currentX - dragging.offsetX;
        const dy = dragging.currentY - dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCardFace(cx, dx, dy, dragging.cards[i]);
      }
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

    cx.fillText('Game #' + gameNumber + '  |  Moves: ' + moveCount + '  |  ' + timeStr, 4, h - 2);
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

      if (isDoubleClick && hit.area === 'freecell') {
        const card = freeCells[hit.col];
        if (card) {
          selection = null;
          autoMoveToFoundation(card, 'freecell', hit.col);
        }
        return;
      }

      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && hit.index === tableau[hit.col].length - 1) {
          selection = null;
          autoMoveToFoundation(card, 'tableau', hit.col);
        }
        return;
      }

      if (selection) {
        const moved = moveSelectionTo(hit);
        if (moved)
          return;
        if (selection.source === hit.area && selection.col === hit.col &&
          ((hit.area === 'freecell') || (hit.area === 'tableau' && selection.index === hit.index))) {
          selection = null;
          return;
        }
      }

      if (hit.area === 'freecell') {
        const card = freeCells[hit.col];
        if (card) {
          selection = { source: 'freecell', col: hit.col, index: 0, cards: [card] };
          const pos = freeCellPos(hit.col);
          if (!gameStarted)
            startTimer();
          saveState();
          dragging = {
            cards: [card],
            source: 'freecell',
            sourceCol: hit.col,
            sourceIndex: 0,
            offsetX: px - pos.x,
            offsetY: py - pos.y,
            currentX: px,
            currentY: py
          };
          pointerStartX = px;
          pointerStartY = py;
          if (_canvas)
            _canvas.setPointerCapture(getLastPointerId());
        }
        return;
      }

      if (hit.area === 'tableau') {
        const card = hit.card;
        if (!card)
          return;

        let runStart = hit.index;
        if (!isValidRun(hit.col, runStart)) {
          for (let s = hit.index; s < tableau[hit.col].length; ++s) {
            if (isValidRun(hit.col, s)) {
              runStart = s;
              break;
            }
          }
          if (!isValidRun(hit.col, runStart))
            return;
        }

        const cards = tableau[hit.col].slice(runStart);
        selection = { source: 'tableau', col: hit.col, index: runStart, cards };

        const pos = tableauCardPos(hit.col, runStart);
        if (!gameStarted)
          startTimer();
        saveState();
        dragging = {
          cards,
          source: 'tableau',
          sourceCol: hit.col,
          sourceIndex: runStart,
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

      if (selection && (hit.area === 'tableau-empty' || hit.area === 'foundation' || hit.area === 'freecell-empty')) {
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
        if (tryAutoCompleteStep())
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
      freeCells = [null, null, null, null];
      foundations = [[], [], [], []];
      tableau = [[], [], [], [], [], [], [], []];
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
      timerSeconds = 0;
      lastClickTime = 0;
      lastClickHit = null;
      _ctx = null;
      _canvas = null;
      _host = null;
    }
  };

  /* ================================================================
   *  POINTER ID TRACKING
   * ================================================================ */

  let _lastPointerId = 0;

  function getLastPointerId() {
    return _lastPointerId;
  }

  const origSetup = module.setup;
  module.setup = function(ctx, canvas, W, H) {
    origSetup.call(this, ctx, canvas, W, H);
    if (_canvas) {
      _canvas.addEventListener('pointerdown', function(ev) {
        _lastPointerId = ev.pointerId;
      });
    }
  };

  /* ================================================================
   *  REGISTER WITH HOST
   * ================================================================ */

  SZ.CardGames.registerVariant('freecell', module);

})();
