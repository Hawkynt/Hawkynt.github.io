;(function() {
  'use strict';

  const { User32 } = SZ.Dlls;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SUIT_COLORS = { spades: '#000', hearts: '#d00', diamonds: '#d00', clubs: '#000' };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const CARD_W = 71;
  const CARD_H = 96;
  const CARD_RADIUS = 5;
  const CARD_GAP = 14;
  const FACE_UP_OFFSET = 22;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FREECELL_COUNT = 4;
  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 8;

  const GREEN = '#1a7a2e';
  const DARK_GREEN = '#126622';

  const TOP_ROW_Y = MARGIN_Y;
  const TABLEAU_TOP = TOP_ROW_Y + CARD_H + 16;

  /* ================================================================
   *  CARD OBJECT
   * ================================================================ */

  function makeCard(suit, rank) {
    return {
      suit,
      rank,
      value: RANKS.indexOf(rank),
      faceUp: true,
      color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black'
    };
  }

  /* ================================================================
   *  GAME STATE
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

  // Selection state (click-to-move)
  let selection = null;

  // Drag state
  let dragging = null;

  // Win animation
  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;

  /* ================================================================
   *  CANVAS
   * ================================================================ */

  const canvasArea = document.getElementById('canvasArea');
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let canvasW = 640;
  let canvasH = 480;

  function resizeCanvas() {
    const rect = canvasArea.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasW = rect.width;
    canvasH = rect.height;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  window.addEventListener('resize', resizeCanvas);

  /* ================================================================
   *  DECK + SEEDED RNG (Windows FreeCell style)
   * ================================================================ */

  function createDeck() {
    const deck = [];
    const winSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
    for (const suit of winSuits)
      for (const rank of RANKS)
        deck.push(makeCard(suit, rank));
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

    updateStatusMsg('Game #' + gameNumber);
    updateMoves();
    updateTimer();
    draw();
    updateTitle();
  }

  function restartGame() {
    newGame(gameNumber);
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
    const state = JSON.parse(json);
    freeCells = state.freeCells.map(c => c ? makeCard(c.suit, c.rank) : null);
    foundations = state.foundations.map(f => f.map(c => makeCard(c.suit, c.rank)));
    tableau = state.tableau.map(t => t.map(c => makeCard(c.suit, c.rank)));
    moveCount = state.moveCount;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
    selection = null;
    updateMoves();
    draw();
  }

  /* ================================================================
   *  TIMER
   * ================================================================ */

  function startTimer() {
    if (timerInterval)
      return;
    gameStarted = true;
    timerInterval = setInterval(() => {
      ++timerSeconds;
      updateTimer();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimer() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    document.getElementById('statusTimer').textContent = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');
  }

  function updateMoves() {
    document.getElementById('statusMoves').textContent = 'Moves: ' + moveCount;
  }

  function updateStatusMsg(msg) {
    document.getElementById('statusMsg').textContent = msg;
  }

  function updateTitle() {
    const title = 'FreeCell - Game #' + gameNumber;
    document.title = title;
    User32.SetWindowText(title);
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
   *  DRAWING - Card rendering
   * ================================================================ */

  function drawRoundedRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.arcTo(x + w, y, x + w, y + r, r);
    cx.lineTo(x + w, y + h - r);
    cx.arcTo(x + w, y + h, x + w - r, y + h, r);
    cx.lineTo(x + r, y + h);
    cx.arcTo(x, y + h, x, y + h - r, r);
    cx.lineTo(x, y + r);
    cx.arcTo(x, y, x + r, y, r);
    cx.closePath();
  }

  function drawSuitSymbol(cx, suit, x, y, size) {
    const hs = size / 2;
    cx.save();
    cx.translate(x, y);
    cx.beginPath();

    switch (suit) {
      case 'hearts': {
        const w = hs;
        const h = hs;
        cx.moveTo(0, h * 0.4);
        cx.bezierCurveTo(-w * 0.1, -h * 0.1, -w, -h * 0.3, -w, h * 0.05);
        cx.bezierCurveTo(-w, h * 0.55, -w * 0.2, h * 0.7, 0, h);
        cx.bezierCurveTo(w * 0.2, h * 0.7, w, h * 0.55, w, h * 0.05);
        cx.bezierCurveTo(w, -h * 0.3, w * 0.1, -h * 0.1, 0, h * 0.4);
        break;
      }
      case 'diamonds': {
        cx.moveTo(0, -hs);
        cx.lineTo(hs * 0.6, 0);
        cx.lineTo(0, hs);
        cx.lineTo(-hs * 0.6, 0);
        cx.closePath();
        break;
      }
      case 'spades': {
        const w = hs;
        const h = hs;
        cx.moveTo(0, -h);
        cx.bezierCurveTo(-w * 0.2, -h * 0.7, -w, -h * 0.55, -w, -h * 0.05);
        cx.bezierCurveTo(-w, h * 0.3, -w * 0.1, h * 0.1, 0, -h * 0.15);
        cx.bezierCurveTo(w * 0.1, h * 0.1, w, h * 0.3, w, -h * 0.05);
        cx.bezierCurveTo(w, -h * 0.55, w * 0.2, -h * 0.7, 0, -h);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(-hs * 0.15, -h * 0.1);
        cx.lineTo(-hs * 0.3, h);
        cx.lineTo(hs * 0.3, h);
        cx.lineTo(hs * 0.15, -h * 0.1);
        cx.closePath();
        break;
      }
      case 'clubs': {
        const r = hs * 0.38;
        cx.arc(0, -hs * 0.4, r, 0, Math.PI * 2);
        cx.closePath();
        cx.moveTo(-hs * 0.4 + r, hs * 0.05);
        cx.arc(-hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.closePath();
        cx.moveTo(hs * 0.4 + r, hs * 0.05);
        cx.arc(hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.closePath();
        cx.fill();
        cx.beginPath();
        cx.moveTo(-hs * 0.15, hs * 0.05);
        cx.lineTo(-hs * 0.3, hs);
        cx.lineTo(hs * 0.3, hs);
        cx.lineTo(hs * 0.15, hs * 0.05);
        cx.closePath();
        break;
      }
    }

    cx.fill();
    cx.restore();
  }

  /* ---- Pip layouts for number cards ---- */

  const PIP_LAYOUTS = {
    1:  [[0.5, 0.5]],
    2:  [[0.5, 0.2], [0.5, 0.8]],
    3:  [[0.5, 0.2], [0.5, 0.5], [0.5, 0.8]],
    4:  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.8], [0.7, 0.8]],
    5:  [[0.3, 0.2], [0.7, 0.2], [0.5, 0.5], [0.3, 0.8], [0.7, 0.8]],
    6:  [[0.3, 0.2], [0.7, 0.2], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    7:  [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.3, 0.8], [0.7, 0.8]],
    8:  [[0.3, 0.2], [0.7, 0.2], [0.5, 0.35], [0.3, 0.5], [0.7, 0.5], [0.5, 0.65], [0.3, 0.8], [0.7, 0.8]],
    9:  [[0.3, 0.18], [0.7, 0.18], [0.3, 0.38], [0.7, 0.38], [0.5, 0.5], [0.3, 0.62], [0.7, 0.62], [0.3, 0.82], [0.7, 0.82]],
    10: [[0.3, 0.18], [0.7, 0.18], [0.5, 0.28], [0.3, 0.38], [0.7, 0.38], [0.3, 0.62], [0.7, 0.62], [0.5, 0.72], [0.3, 0.82], [0.7, 0.82]],
  };

  function drawPips(cx, card, x, y, w, h) {
    const color = SUIT_COLORS[card.suit];
    const rankNum = card.value + 1;

    const pipLeft = x + 10;
    const pipTop = y + 20;
    const pipW = w - 20;
    const pipH = h - 40;

    cx.fillStyle = color;

    if (rankNum === 1) {
      drawSuitSymbol(cx, card.suit, pipLeft + pipW * 0.5, pipTop + pipH * 0.5, 24);
      return;
    }

    const layout = PIP_LAYOUTS[rankNum];
    if (!layout)
      return;

    const pipSize = 11;

    for (const [relX, relY] of layout) {
      const px = pipLeft + pipW * relX;
      const py = pipTop + pipH * relY;

      if (relY > 0.5) {
        cx.save();
        cx.translate(px, py);
        cx.rotate(Math.PI);
        drawSuitSymbol(cx, card.suit, 0, 0, pipSize);
        cx.restore();
      } else
        drawSuitSymbol(cx, card.suit, px, py, pipSize);
    }
  }

  function drawFaceCardCenter(cx, x, y, card) {
    const color = SUIT_COLORS[card.suit];
    const centerX = x + CARD_W / 2;
    const centerY = y + CARD_H / 2;
    const frameW = 40;
    const frameH = 52;

    drawRoundedRect(cx, centerX - frameW / 2, centerY - frameH / 2, frameW, frameH, 3);
    cx.fillStyle = color === '#d00' ? '#ffe8e8' : '#e8e8f0';
    cx.fill();
    cx.strokeStyle = color;
    cx.lineWidth = 2;
    cx.stroke();

    drawRoundedRect(cx, centerX - frameW / 2 + 3, centerY - frameH / 2 + 3, frameW - 6, frameH - 6, 2);
    cx.strokeStyle = color;
    cx.lineWidth = 0.5;
    cx.stroke();

    cx.font = 'bold 24px serif';
    cx.fillStyle = color;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(card.rank, centerX, centerY - 4);

    cx.fillStyle = color;
    drawSuitSymbol(cx, card.suit, centerX, centerY + 16, 12);
  }

  function drawCardFace(cx, x, y, card) {
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    const color = SUIT_COLORS[card.suit];

    cx.font = 'bold 13px serif';
    cx.fillStyle = color;
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, x + 4, y + 4);

    cx.fillStyle = color;
    drawSuitSymbol(cx, card.suit, x + 8, y + 24, 8);

    cx.save();
    cx.translate(x + CARD_W - 4, y + CARD_H - 4);
    cx.rotate(Math.PI);
    cx.font = 'bold 13px serif';
    cx.fillStyle = color;
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, 0, 0);
    cx.restore();

    cx.save();
    cx.translate(x + CARD_W - 8, y + CARD_H - 24);
    cx.rotate(Math.PI);
    cx.fillStyle = color;
    drawSuitSymbol(cx, card.suit, 0, 0, 8);
    cx.restore();

    cx.fillStyle = color;
    if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K')
      drawFaceCardCenter(cx, x, y, card);
    else
      drawPips(cx, card, x, y, CARD_W, CARD_H);
  }

  function drawCard(cx, x, y, card) {
    drawCardFace(cx, x, y, card);
  }

  function drawEmptySlot(cx, x, y, label) {
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();

    if (label) {
      cx.font = '28px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);
    }
  }

  function drawSelectionHighlight(cx, x, y, h) {
    cx.save();
    cx.strokeStyle = '#ffff00';
    cx.lineWidth = 3;
    cx.shadowColor = '#ffff00';
    cx.shadowBlur = 6;
    drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, h + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
  }

  /* ---- Main draw ---- */

  function draw() {
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = DARK_GREEN;
    ctx.fillRect(0, 0, canvasW, 2);
    ctx.fillRect(0, 0, 2, canvasH);

    // Separator line between free cells and foundations
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    const sepX = MARGIN_X + 4 * PILE_GAP - CARD_GAP / 2;
    ctx.beginPath();
    ctx.moveTo(sepX, TOP_ROW_Y + 4);
    ctx.lineTo(sepX, TOP_ROW_Y + CARD_H - 4);
    ctx.stroke();

    // Free cells
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      const pos = freeCellPos(i);
      if (freeCells[i]) {
        if (!isDragSource('freecell', i)) {
          drawCard(ctx, pos.x, pos.y, freeCells[i]);
          if (selection && selection.source === 'freecell' && selection.col === i)
            drawSelectionHighlight(ctx, pos.x, pos.y, CARD_H);
        }
      } else
        drawEmptySlot(ctx, pos.x, pos.y, null);
    }

    // Foundation piles
    const foundSuits = ['clubs', 'diamonds', 'hearts', 'spades'];
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (foundations[i].length === 0) {
        drawEmptySlot(ctx, fp.x, fp.y, null);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        drawSuitSymbol(ctx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      } else {
        const top = foundations[i][foundations[i].length - 1];
        drawCard(ctx, fp.x, fp.y, top);
      }
    }

    // Tableau columns
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      if (tableau[col].length === 0) {
        drawEmptySlot(ctx, tp.x, tp.y, null);
        continue;
      }
      for (let i = 0; i < tableau[col].length; ++i) {
        if (isDragSource('tableau', col) && i >= dragging.sourceIndex)
          continue;
        const pos = tableauCardPos(col, i);
        drawCard(ctx, pos.x, pos.y, tableau[col][i]);
      }
      // Selection highlight on tableau
      if (selection && selection.source === 'tableau' && selection.col === col) {
        const selPos = tableauCardPos(col, selection.index);
        const stackH = (tableau[col].length - 1 - selection.index) * FACE_UP_OFFSET + CARD_H;
        drawSelectionHighlight(ctx, selPos.x, selPos.y, stackH);
      }
    }

    // Draw dragged cards on top
    if (dragging) {
      for (let i = 0; i < dragging.cards.length; ++i) {
        const dx = dragging.currentX - dragging.offsetX;
        const dy = dragging.currentY - dragging.offsetY + i * FACE_UP_OFFSET;
        drawCard(ctx, dx, dy, dragging.cards[i]);
      }
    }
  }

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
   *  AUTO-MOVE TO FOUNDATION
   * ================================================================ */

  function autoMoveToFoundation(card, sourceType, sourceCol) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!gameStarted)
      startTimer();
    saveState();

    if (sourceType === 'freecell')
      freeCells[sourceCol] = null;
    else if (sourceType === 'tableau')
      tableau[sourceCol].pop();

    foundations[fi].push(card);
    ++moveCount;
    updateMoves();
    draw();
    checkWin();
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
          freeCells[i] = null;
          foundations[fi].push(card);
          ++moveCount;
          moved = true;
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
            pile.pop();
            foundations[fi].push(card);
            ++moveCount;
            moved = true;
            break;
          }
        }
      }

      updateMoves();
      draw();

      if (moved) {
        let total = 0;
        for (let i = 0; i < FOUNDATION_COUNT; ++i)
          total += foundations[i].length;
        if (total === 52)
          doWin();
        else
          setTimeout(step, 60);
      }
    };
    updateStatusMsg('Auto-completing...');
    setTimeout(step, 200);
  }

  /* ================================================================
   *  MOVE LOGIC
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
        updateMoves();
        draw();
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
      updateMoves();
      draw();
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
      updateMoves();
      draw();
      return true;
    }

    if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
      const targetCol = hit.col;
      if (canPlaceOnTableau(card, targetCol)) {
        const moveLimit = maxMoveableCards(targetCol);
        if (cards.length > moveLimit) {
          updateStatusMsg('Not enough free cells to move ' + cards.length + ' cards');
          return false;
        }
        if (!gameStarted)
          startTimer();
        saveState();
        removeSelectionFromSource();
        for (const c of cards)
          tableau[targetCol].push(c);
        ++moveCount;
        selection = null;
        updateMoves();
        draw();
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

    if (dropped) {
      updateMoves();
      updateStatusMsg('Game #' + gameNumber);
    } else {
      if (undoHistory.length > 0)
        undoHistory.pop();
    }

    dragging = null;
    draw();

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
    const minVals = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      minVals.push(foundations[i].length > 0 ? foundations[i][foundations[i].length - 1].value : -1);

    const minVal = Math.min(...minVals);

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = tableau[col];
      for (let i = 0; i < pile.length - 1; ++i) {
        const curr = pile[i];
        const next = pile[i + 1];
        if (curr.color === next.color || curr.value !== next.value + 1)
          return false;
      }
    }
    for (let i = 0; i < FREECELL_COUNT; ++i) {
      if (freeCells[i] && freeCells[i].value > minVal + 2)
        return false;
    }
    return true;
  }

  function doWin() {
    gameWon = true;
    stopTimer();
    updateStatusMsg('Congratulations! You won Game #' + gameNumber + ' in ' + moveCount + ' moves!');
    startWinAnimation();
  }

  /* ================================================================
   *  WIN ANIMATION: bouncing cards
   * ================================================================ */

  function startWinAnimation() {
    winAnimCards = [];
    winAnimRunning = true;

    const allCards = [];
    for (let fi = 0; fi < FOUNDATION_COUNT; ++fi) {
      const fp = foundationPos(fi);
      for (const card of foundations[fi])
        allCards.push({ card, startX: fp.x, startY: fp.y });
    }

    let launchIndex = 0;
    const launchInterval = setInterval(() => {
      if (launchIndex >= allCards.length || !winAnimRunning) {
        clearInterval(launchInterval);
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
        bounces: 0
      });
      ++launchIndex;
    }, 80);

    const animate = () => {
      if (!winAnimRunning)
        return;

      ctx.fillStyle = GREEN;
      ctx.fillRect(0, 0, canvasW, canvasH);

      let anyAlive = false;

      for (const ac of winAnimCards) {
        ac.vy += ac.gravity;
        ac.x += ac.vx;
        ac.y += ac.vy;

        if (ac.y + CARD_H > canvasH) {
          ac.y = canvasH - CARD_H;
          ac.vy = -ac.vy * 0.7;
          ++ac.bounces;
        }

        if (ac.x + CARD_W < -50 || ac.x > canvasW + 50 || ac.bounces > 8)
          continue;

        anyAlive = true;
        drawCardFace(ctx, ac.x, ac.y, ac.card);
      }

      if (anyAlive || launchIndex < allCards.length)
        winAnimId = requestAnimationFrame(animate);
      else
        winAnimRunning = false;
    };

    winAnimId = requestAnimationFrame(animate);
  }

  function stopWinAnimation() {
    winAnimRunning = false;
    if (winAnimId) {
      cancelAnimationFrame(winAnimId);
      winAnimId = null;
    }
    winAnimCards = [];
  }

  /* ================================================================
   *  POINTER EVENTS
   * ================================================================ */

  let lastClickTime = 0;
  let lastClickHit = null;
  let pointerDown = false;
  let pointerStartX = 0;
  let pointerStartY = 0;

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (tryAutoCompleteStep())
      doAutoComplete();
  });

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0)
      return;

    if (gameWon) {
      stopWinAnimation();
      newGame();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    pointerDown = true;
    pointerStartX = px;
    pointerStartY = py;

    const hit = hitTest(px, py);
    if (!hit) {
      selection = null;
      draw();
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
        draw();
        return;
      }
    }

    if (hit.area === 'freecell') {
      const card = freeCells[hit.col];
      if (card) {
        selection = { source: 'freecell', col: hit.col, index: 0, cards: [card] };
        draw();
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
        canvas.setPointerCapture(e.pointerId);
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
      draw();

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
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (selection && (hit.area === 'tableau-empty' || hit.area === 'foundation' || hit.area === 'freecell-empty')) {
      const moved = moveSelectionTo(hit);
      if (!moved) {
        selection = null;
        draw();
      }
      return;
    }

    selection = null;
    draw();
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging)
      return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dx = px - pointerStartX;
    const dy = py - pointerStartY;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5)
      return;

    dragging.currentX = px;
    dragging.currentY = py;
    draw();
  });

  canvas.addEventListener('pointerup', e => {
    if (e.button !== 0)
      return;
    pointerDown = false;

    if (!dragging)
      return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dx = px - pointerStartX;
    const dy = py - pointerStartY;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
      if (undoHistory.length > 0)
        undoHistory.pop();
      dragging = null;
      draw();
      return;
    }

    canvas.releasePointerCapture(e.pointerId);
    selection = null;
    tryDrop(px, py);
  });

  canvas.addEventListener('lostpointercapture', () => {
    if (dragging) {
      if (undoHistory.length > 0)
        undoHistory.pop();
      dragging = null;
      draw();
    }
  });

  /* ================================================================
   *  MENU SYSTEM
   * ================================================================ */

  new SZ.MenuBar({ onAction: handleMenuAction });

  function handleMenuAction(action) {
    switch (action) {
      case 'new':
        newGame();
        break;
      case 'select':
        showSelectGame();
        break;
      case 'restart':
        restartGame();
        break;
      case 'undo':
        doUndo();
        break;
      case 'exit':
        User32.DestroyWindow();
        break;
      case 'about':
        showAbout();
        break;
    }
  }

  /* ================================================================
   *  ABOUT DIALOG
   * ================================================================ */

  function showAbout() {
    SZ.Dialog.show('dlg-about');
  }

  /* ================================================================
   *  SELECT GAME DIALOG
   * ================================================================ */

  const gameNumInput = document.getElementById('gameNumInput');

  function showSelectGame() {
    gameNumInput.value = gameNumber;
    SZ.Dialog.show('selectBackdrop').then(result => {
      if (result === 'ok')
        confirmSelectGame();
    });
    gameNumInput.focus();
    gameNumInput.select();
  }

  function confirmSelectGame() {
    const num = parseInt(gameNumInput.value, 10);
    if (isNaN(num) || num < 1 || num > 1000000) {
      showSelectGame();
      gameNumInput.focus();
      gameNumInput.select();
      return;
    }
    newGame(num);
  }

  gameNumInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      SZ.Dialog.close('selectBackdrop');
      confirmSelectGame();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      SZ.Dialog.close('selectBackdrop');
    }
  });

  /* ================================================================
   *  KEYBOARD SHORTCUTS
   * ================================================================ */

  document.addEventListener('keydown', e => {
    const selectOverlay = document.getElementById('selectBackdrop');
    const aboutDlg = document.getElementById('dlg-about');
    if ((selectOverlay && selectOverlay.classList.contains('visible')) || (aboutDlg && aboutDlg.classList.contains('visible'))) {
      if (e.key === 'Escape') {
        SZ.Dialog.close('selectBackdrop');
        SZ.Dialog.close('dlg-about');
      }
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
    }
    if (e.key === 'F3') {
      e.preventDefault();
      showSelectGame();
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      doUndo();
    }
    if (e.key === 'Escape') {
      selection = null;
      draw();
    }
    if (e.key === 'a' && !e.ctrlKey && !e.altKey) {
      if (tryAutoCompleteStep())
        doAutoComplete();
    }
  });

  /* ================================================================
   *  INIT
   * ================================================================ */

  User32.EnableVisualStyles();
  newGame(1);
  requestAnimationFrame(() => resizeCanvas());

})();
