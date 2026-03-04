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
  const FACE_DOWN_OFFSET = 14;
  const FACE_UP_OFFSET = 25;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 7;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 450;

  const GREEN = '#1a7a2e';
  const DARK_GREEN = '#126622';

  /* ================================================================
   *  CARD OBJECT
   * ================================================================ */

  function makeCard(suit, rank) {
    return {
      suit,
      rank,
      value: RANKS.indexOf(rank),
      faceUp: false,
      color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black'
    };
  }

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let stock = [];
  let waste = [];
  let foundations = [[], [], [], []];
  let tableau = [[], [], [], [], [], [], []];
  let drawMode = 1;
  let moveCount = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let gameStarted = false;
  let gameWon = false;
  let undoHistory = [];
  const MAX_UNDO = 100;

  // Animation
  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;
  let particles = [];
  let lastFireworkTime = 0;

  // Card move animation
  let animatingCards = [];

  // Card flip animation
  let flippingCards = [];

  // Stock deal animation
  let dealAnimCards = [];

  // Drag state
  let dragging = null;

  /* ================================================================
   *  CANVAS
   * ================================================================ */

  const canvasArea = document.getElementById('canvasArea');
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let canvasW = 640;
  let canvasH = 480;
  let scale = 1;

  function resizeCanvas() {
    const rect = canvasArea.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    scale = Math.min(rect.width / BASE_W, rect.height / BASE_H);
    canvasW = rect.width / scale;
    canvasH = rect.height / scale;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    draw();
  }

  window.addEventListener('resize', resizeCanvas);

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createDeck() {
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push(makeCard(suit, rank));
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    stopWinAnimation();
    stopTimer();

    const deck = shuffle(createDeck());

    stock = [];
    waste = [];
    foundations = [[], [], [], []];
    tableau = [[], [], [], [], [], [], []];
    moveCount = 0;
    timerSeconds = 0;
    gameStarted = false;
    gameWon = false;
    undoHistory = [];
    dragging = null;

    // Deal to tableau
    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (let row = col; row < TABLEAU_COUNT; ++row) {
        const card = deck.pop();
        card.faceUp = (row === col);
        tableau[row].push(card);
      }

    // Remainder goes to stock
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      stock.push(card);
    }

    updateStatusMsg('Click stock pile to deal cards');
    updateMoves();
    updateTimer();
    draw();
    updateTitle();
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      stock: stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      waste: waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      foundations: foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      tableau: tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      moveCount
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreState(json) {
    const state = JSON.parse(json);
    stock = state.stock.map(c => { const card = makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    waste = state.waste.map(c => { const card = makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    foundations = state.foundations.map(f => f.map(c => { const card = makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    tableau = state.tableau.map(t => t.map(c => { const card = makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    moveCount = state.moveCount;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
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
    const title = 'Solitaire';
    document.title = title;
    User32.SetWindowText(title);
  }

  /* ================================================================
   *  LAYOUT: compute positions
   * ================================================================ */

  function stockPos() {
    return { x: MARGIN_X, y: MARGIN_Y };
  }

  function wastePos() {
    return { x: MARGIN_X + PILE_GAP, y: MARGIN_Y };
  }

  function foundationPos(i) {
    return { x: MARGIN_X + (3 + i) * PILE_GAP, y: MARGIN_Y };
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * PILE_GAP, y: MARGIN_Y + CARD_H + 20 };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    let y = base.y;
    for (let i = 0; i < index; ++i)
      y += tableau[col][i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
    return { x: base.x, y };
  }

  function wasteCardPos(i) {
    const base = wastePos();
    if (drawMode === 1)
      return { x: base.x, y: base.y };
    // draw-3: show up to last 3 cards fanned
    const visibleStart = Math.max(0, waste.length - 3);
    const visibleIndex = i - visibleStart;
    if (visibleIndex < 0)
      return { x: base.x, y: base.y };
    return { x: base.x + visibleIndex * 16, y: base.y };
  }

  /* ================================================================
   *  DRAWING
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

  function drawCardBack(cx, x, y) {
    // Card outline
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    // Blue inner area
    const m = 3;
    drawRoundedRect(cx, x + m, y + m, CARD_W - m * 2, CARD_H - m * 2, CARD_RADIUS - 1);
    cx.fillStyle = '#1a237e';
    cx.fill();

    // Diamond pattern
    cx.strokeStyle = '#3949ab';
    cx.lineWidth = 0.5;
    const step = 8;
    cx.save();
    cx.beginPath();
    drawRoundedRect(cx, x + m, y + m, CARD_W - m * 2, CARD_H - m * 2, CARD_RADIUS - 1);
    cx.clip();
    for (let dy = y + m; dy < y + CARD_H - m; dy += step) {
      for (let dx = x + m; dx < x + CARD_W - m; dx += step) {
        const cx2 = dx + step / 2;
        const cy2 = dy + step / 2;
        cx.beginPath();
        cx.moveTo(cx2, cy2 - step / 2 + 1);
        cx.lineTo(cx2 + step / 2 - 1, cy2);
        cx.lineTo(cx2, cy2 + step / 2 - 1);
        cx.lineTo(cx2 - step / 2 + 1, cy2);
        cx.closePath();
        cx.stroke();
      }
    }
    cx.restore();

    // Outer border
    drawRoundedRect(cx, x + m, y + m, CARD_W - m * 2, CARD_H - m * 2, CARD_RADIUS - 1);
    cx.strokeStyle = '#c5cae9';
    cx.lineWidth = 1;
    cx.stroke();
  }

  function drawSuitSymbol(cx, suit, x, y, size) {
    const hs = size / 2;
    cx.save();
    cx.translate(x, y);
    cx.beginPath();

    switch (suit) {
      case 'hearts': {
        // Heart: two bezier lobes meeting at a bottom point
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
        // Diamond: four-point rhombus
        cx.moveTo(0, -hs);
        cx.lineTo(hs * 0.6, 0);
        cx.lineTo(0, hs);
        cx.lineTo(-hs * 0.6, 0);
        cx.closePath();
        break;
      }
      case 'spades': {
        // Spade: inverted heart + stem
        const w = hs;
        const h = hs;
        cx.moveTo(0, -h);
        cx.bezierCurveTo(-w * 0.2, -h * 0.7, -w, -h * 0.55, -w, -h * 0.05);
        cx.bezierCurveTo(-w, h * 0.3, -w * 0.1, h * 0.1, 0, -h * 0.15);
        cx.bezierCurveTo(w * 0.1, h * 0.1, w, h * 0.3, w, -h * 0.05);
        cx.bezierCurveTo(w, -h * 0.55, w * 0.2, -h * 0.7, 0, -h);
        cx.closePath();
        cx.fill();
        // Stem
        cx.beginPath();
        cx.moveTo(-hs * 0.15, -h * 0.1);
        cx.lineTo(-hs * 0.3, h);
        cx.lineTo(hs * 0.3, h);
        cx.lineTo(hs * 0.15, -h * 0.1);
        cx.closePath();
        break;
      }
      case 'clubs': {
        // Club: three circles + stem
        const r = hs * 0.38;
        // Top circle
        cx.arc(0, -hs * 0.4, r, 0, Math.PI * 2);
        cx.closePath();
        // Bottom-left circle
        cx.moveTo(-hs * 0.4 + r, hs * 0.05);
        cx.arc(-hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.closePath();
        // Bottom-right circle
        cx.moveTo(hs * 0.4 + r, hs * 0.05);
        cx.arc(hs * 0.4, hs * 0.05, r, 0, Math.PI * 2);
        cx.closePath();
        cx.fill();
        // Stem
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
    if (card.faceUp)
      drawCardFace(cx, x, y, card);
    else
      drawCardBack(cx, x, y);
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

  function drawRecycleSymbol(cx, x, y) {
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();

    const centerX = x + CARD_W / 2;
    const centerY = y + CARD_H / 2;
    const r = 16;

    cx.strokeStyle = 'rgba(255,255,255,0.35)';
    cx.lineWidth = 3;
    cx.lineCap = 'round';
    cx.beginPath();
    cx.arc(centerX, centerY, r, -Math.PI * 0.7, Math.PI * 0.7);
    cx.stroke();

    const angle = Math.PI * 0.7;
    const ax = centerX + r * Math.cos(angle);
    const ay = centerY + r * Math.sin(angle);
    cx.beginPath();
    cx.moveTo(ax - 6, ay - 3);
    cx.lineTo(ax, ay);
    cx.lineTo(ax - 6, ay + 5);
    cx.stroke();
    cx.lineCap = 'butt';
  }

  function draw() {
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = DARK_GREEN;
    ctx.fillRect(0, 0, canvasW, 2);
    ctx.fillRect(0, 0, 2, canvasH);

    // Stock pile
    const sp = stockPos();
    if (stock.length > 0)
      drawCardBack(ctx, sp.x, sp.y);
    else
      drawRecycleSymbol(ctx, sp.x, sp.y);

    // Build set of cards currently animating (should not be drawn at destination)
    const animSet = new Set();
    for (const d of dealAnimCards)
      animSet.add(d.card);
    for (const a of animatingCards)
      animSet.add(a.card);

    // Waste pile
    const wp = wastePos();
    if (waste.length === 0) {
      drawEmptySlot(ctx, wp.x, wp.y, null);
    } else {
      if (drawMode === 1) {
        const top = waste[waste.length - 1];
        if (!isDragSource('waste', waste.length - 1) && !animSet.has(top))
          drawCard(ctx, wp.x, wp.y, top);
      } else {
        const visibleStart = Math.max(0, waste.length - 3);
        for (let i = visibleStart; i < waste.length; ++i) {
          if (isDragSource('waste', i))
            continue;
          if (animSet.has(waste[i]))
            continue;
          const pos = wasteCardPos(i);
          drawCard(ctx, pos.x, pos.y, waste[i]);
        }
      }
    }

    // Foundation piles
    const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs'];
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (foundations[i].length === 0) {
        drawEmptySlot(ctx, fp.x, fp.y, null);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        drawSuitSymbol(ctx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      } else {
        const top = foundations[i][foundations[i].length - 1];
        if (!animSet.has(top))
          drawCard(ctx, fp.x, fp.y, top);
        else if (foundations[i].length > 1)
          drawCard(ctx, fp.x, fp.y, foundations[i][foundations[i].length - 2]);
        else {
          drawEmptySlot(ctx, fp.x, fp.y, null);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          drawSuitSymbol(ctx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
        }
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
    if (type === 'waste' && dragging.source === 'waste')
      return index === dragging.sourceIndex;
    if (type === 'tableau' && dragging.source === 'tableau' && dragging.sourceCol === index)
      return true;
    return false;
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    const sp = stockPos();
    if (px >= sp.x && px < sp.x + CARD_W && py >= sp.y && py < sp.y + CARD_H)
      return { area: 'stock' };

    if (waste.length > 0) {
      if (drawMode === 1) {
        const wp = wastePos();
        if (px >= wp.x && px < wp.x + CARD_W && py >= wp.y && py < wp.y + CARD_H)
          return { area: 'waste', index: waste.length - 1 };
      } else {
        const visibleStart = Math.max(0, waste.length - 3);
        for (let i = waste.length - 1; i >= visibleStart; --i) {
          const pos = wasteCardPos(i);
          if (px >= pos.x && px < pos.x + CARD_W && py >= pos.y && py < pos.y + CARD_H)
            return { area: 'waste', index: i };
        }
      }
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
        const h = (i === pile.length - 1) ? CARD_H : (pile[i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET);
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
      return card.value === 12;
    const top = pile[pile.length - 1];
    return top.faceUp && card.color !== top.color && card.value === top.value - 1;
  }

  function findFoundationTarget(card) {
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      if (canPlaceOnFoundation(card, i))
        return i;
    return -1;
  }

  /* ================================================================
   *  STOCK DEALING
   * ================================================================ */

  function dealFromStock() {
    if (!gameStarted)
      startTimer();

    if (stock.length === 0) {
      if (waste.length === 0)
        return;
      saveState();
      while (waste.length > 0) {
        const card = waste.pop();
        card.faceUp = false;
        stock.push(card);
      }
      ++moveCount;
      updateMoves();
      draw();
      return;
    }

    saveState();
    const sp = stockPos();
    const count = Math.min(drawMode, stock.length);
    for (let i = 0; i < count; ++i) {
      const card = stock.pop();
      card.faceUp = true;
      waste.push(card);
      const wp = wasteCardPos(waste.length - 1);
      startDealFromStockAnim(card, sp.x, sp.y, wp.x, wp.y, i * 80);
    }
    ++moveCount;
    updateMoves();
    draw();
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

    // Calculate source position before removing
    let fromX, fromY;
    if (sourceType === 'waste') {
      const wp = wasteCardPos(sourceIndex);
      fromX = wp.x;
      fromY = wp.y;
      waste.splice(sourceIndex, 1);
    } else if (sourceType === 'tableau') {
      const tp = tableauCardPos(sourceCol, sourceIndex);
      fromX = tp.x;
      fromY = tp.y;
      tableau[sourceCol].splice(sourceIndex, 1);
      const pile = tableau[sourceCol];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        const flippedCard = pile[pile.length - 1];
        flippedCard.faceUp = true;
        const fpos = tableauCardPos(sourceCol, pile.length - 1);
        startFlipAnim(flippedCard, fpos.x, fpos.y);
      }
    }

    card.faceUp = true;
    foundations[fi].push(card);
    ++moveCount;
    updateMoves();

    const fp = foundationPos(fi);
    startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      draw();
      checkWin();
    });
    draw();
    return true;
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
      if (hit.area === 'foundation' && dragging.cards.length === 1) {
        if (canPlaceOnFoundation(dragging.cards[0], hit.index)) {
          removeFromSource();
          dragging.cards[0].faceUp = true;
          foundations[hit.index].push(dragging.cards[0]);
          ++moveCount;
          dropped = true;
        }
      } else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const col = hit.col !== undefined ? hit.col : hit.col;
        if (canPlaceOnTableau(dragging.cards[0], col)) {
          removeFromSource();
          for (const card of dragging.cards) {
            card.faceUp = true;
            tableau[col].push(card);
          }
          ++moveCount;
          dropped = true;
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
            removeFromSource();
            dragging.cards[0].faceUp = true;
            foundations[i].push(dragging.cards[0]);
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
            removeFromSource();
            for (const card of dragging.cards) {
              card.faceUp = true;
              tableau[col].push(card);
            }
            ++moveCount;
            dropped = true;
            break;
          }
        }
      }
    }

    if (dropped) {
      updateMoves();
      updateStatusMsg('');
    }

    dragging = null;
    draw();

    if (dropped)
      checkWin();
  }

  function removeFromSource() {
    if (!dragging)
      return;
    if (dragging.source === 'waste') {
      waste.splice(dragging.sourceIndex, 1);
    } else if (dragging.source === 'tableau') {
      tableau[dragging.sourceCol].splice(dragging.sourceIndex);
      const pile = tableau[dragging.sourceCol];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        const flippedCard = pile[pile.length - 1];
        flippedCard.faceUp = true;
        const fpos = tableauCardPos(dragging.sourceCol, pile.length - 1);
        startFlipAnim(flippedCard, fpos.x, fpos.y);
      }
    }
  }

  /* ================================================================
   *  WIN DETECTION + AUTO-COMPLETE + ANIMATION
   * ================================================================ */

  function checkWin() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += foundations[i].length;
    if (total === 52) {
      doWin();
      return;
    }

    if (canAutoComplete()) {
      updateStatusMsg('Auto-completing...');
      autoComplete();
    }
  }

  function canAutoComplete() {
    if (stock.length > 0)
      return false;
    if (waste.length > 0)
      return false;
    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (const card of tableau[col])
        if (!card.faceUp)
          return false;
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
          moved = true;

          const toPos = foundationPos(fi);
          updateMoves();
          draw();
          startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            let total = 0;
            for (let i = 0; i < FOUNDATION_COUNT; ++i)
              total += foundations[i].length;
            if (total === 52)
              doWin();
            else
              setTimeout(step, 30);
          });
          break;
        }
      }

      if (!moved) {
        updateMoves();
        draw();
      }
    };
    setTimeout(step, 200);
  }

  function doWin() {
    gameWon = true;
    stopTimer();
    updateStatusMsg('Congratulations! You won in ' + moveCount + ' moves!');
    startWinAnimation();
  }

  /* ================================================================
   *  FIREWORK PARTICLES
   * ================================================================ */

  const FIREWORK_COLORS = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff', '#ff8800', '#ff0088', '#88ff00', '#ffffff'];

  function spawnFirework(x, y) {
    const count = 30 + Math.floor(Math.random() * 31);
    const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    for (let i = 0; i < count; ++i) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.04,
        alpha: 1,
        size: 2 + Math.random() * 3,
        color,
        glow: 8 + Math.random() * 8
      });
    }
  }

  function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; --i) {
      const p = particles[i];
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.012;
      p.size *= 0.995;
      if (p.alpha <= 0 || p.size < 0.3) {
        particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.glow * p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ================================================================
   *  SPARKLE BURST (landing effect)
   * ================================================================ */

  function spawnSparkle(x, y) {
    const count = 8;
    for (let i = 0; i < count; ++i) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.02,
        alpha: 1,
        size: 1 + Math.random() * 2,
        color: '#ffff88',
        glow: 6
      });
    }
  }

  /* ================================================================
   *  CARD MOVE ANIMATION
   * ================================================================ */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    animatingCards.push({
      card,
      fromX,
      fromY,
      toX,
      toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
    if (!winAnimRunning && animatingCards.length === 1)
      requestAnimationFrame(tickAnimations);
  }

  function tickAnimations() {
    if (animatingCards.length === 0 && flippingCards.length === 0 && dealAnimCards.length === 0)
      return;
    const now = performance.now();
    draw();

    for (let i = animatingCards.length - 1; i >= 0; --i) {
      const a = animatingCards[i];
      const elapsed = now - a.startTime;
      const t = Math.min(elapsed / a.duration, 1);
      const e = easeOutCubic(t);
      const x = a.fromX + (a.toX - a.fromX) * e;
      const y = a.fromY + (a.toY - a.fromY) * e;
      drawCardFace(ctx, x, y, a.card);
      if (t >= 1) {
        animatingCards.splice(i, 1);
        spawnSparkle(a.toX + CARD_W / 2, a.toY + CARD_H / 2);
        if (a.onDone)
          a.onDone();
      }
    }

    for (let i = flippingCards.length - 1; i >= 0; --i) {
      const f = flippingCards[i];
      const elapsed = now - f.startTime;
      const t = Math.min(elapsed / f.duration, 1);
      let scaleX;
      if (t < 0.5)
        scaleX = 1 - t * 2;
      else
        scaleX = (t - 0.5) * 2;
      ctx.save();
      ctx.translate(f.x + CARD_W / 2, f.y);
      ctx.scale(scaleX, 1);
      if (t < 0.5)
        drawCardBack(ctx, -CARD_W / 2, 0);
      else
        drawCardFace(ctx, -CARD_W / 2, 0, f.card);
      ctx.restore();
      if (t >= 1)
        flippingCards.splice(i, 1);
    }

    // Stock deal animations (slide + flip from stock to waste)
    for (let i = dealAnimCards.length - 1; i >= 0; --i) {
      const d = dealAnimCards[i];
      if (now < d.startTime)
        continue;
      const elapsed = now - d.startTime;
      const t = Math.min(elapsed / d.duration, 1);
      const e = easeOutCubic(t);
      const x = d.fromX + (d.toX - d.fromX) * e;
      const y = d.fromY + (d.toY - d.fromY) * e;

      // Flip: first part shows back, second part shows face
      let scaleX;
      if (t < 0.35)
        scaleX = 1;
      else if (t < 0.55)
        scaleX = 1 - (t - 0.35) / 0.2;
      else
        scaleX = (t - 0.55) / 0.45;

      ctx.save();
      ctx.translate(x + CARD_W / 2, y);
      ctx.scale(Math.max(scaleX, 0.01), 1);
      if (t < 0.45)
        drawCardBack(ctx, -CARD_W / 2, 0);
      else
        drawCardFace(ctx, -CARD_W / 2, 0, d.card);
      ctx.restore();

      if (t >= 1)
        dealAnimCards.splice(i, 1);
    }

    updateAndDrawParticles();

    if (animatingCards.length > 0 || flippingCards.length > 0 || dealAnimCards.length > 0 || particles.length > 0)
      requestAnimationFrame(tickAnimations);
  }

  /* ================================================================
   *  CARD FLIP ANIMATION
   * ================================================================ */

  function startFlipAnim(card, x, y) {
    flippingCards.push({
      card,
      x,
      y,
      startTime: performance.now(),
      duration: 200
    });
    if (!winAnimRunning && animatingCards.length === 0 && flippingCards.length === 1 && dealAnimCards.length === 0)
      requestAnimationFrame(tickAnimations);
  }

  /* ================================================================
   *  STOCK DEAL ANIMATION (slide + flip from stock to waste)
   * ================================================================ */

  function startDealFromStockAnim(card, fromX, fromY, toX, toY, delay) {
    dealAnimCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now() + delay,
      duration: 250
    });
    if (!winAnimRunning && dealAnimCards.length === 1 && animatingCards.length === 0 && flippingCards.length === 0)
      requestAnimationFrame(tickAnimations);
  }

  /* ================================================================
   *  WIN ANIMATION: bouncing cards + fireworks + trails + rotation
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
        bounces: 0,
        angle: 0,
        angularVelocity: (Math.random() - 0.5) * 0.08,
        trail: []
      });
      ++launchIndex;
    }, 80);

    const animate = (timestamp) => {
      if (!winAnimRunning)
        return;

      ctx.fillStyle = GREEN;
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Spawn fireworks periodically
      if (timestamp - lastFireworkTime > 500) {
        spawnFirework(Math.random() * canvasW, Math.random() * canvasH * 0.6);
        lastFireworkTime = timestamp;
      }

      let anyAlive = false;

      for (const ac of winAnimCards) {
        ac.vy += ac.gravity;
        ac.x += ac.vx;
        ac.y += ac.vy;
        ac.angle += ac.angularVelocity;

        if (ac.y + CARD_H > canvasH) {
          ac.y = canvasH - CARD_H;
          ac.vy = -ac.vy * 0.7;
          ++ac.bounces;
        }

        if (ac.x + CARD_W < -50 || ac.x > canvasW + 50 || ac.bounces > 8)
          continue;

        anyAlive = true;

        // Draw trail
        ac.trail.push({ x: ac.x, y: ac.y, alpha: 0.4 });
        if (ac.trail.length > 6)
          ac.trail.shift();
        for (const t of ac.trail) {
          ctx.save();
          ctx.globalAlpha = t.alpha;
          ctx.translate(t.x + CARD_W / 2, t.y + CARD_H / 2);
          ctx.rotate(ac.angle);
          drawCardFace(ctx, -CARD_W / 2, -CARD_H / 2, ac.card);
          ctx.restore();
          t.alpha *= 0.6;
        }

        // Draw card with rotation
        ctx.save();
        ctx.translate(ac.x + CARD_W / 2, ac.y + CARD_H / 2);
        ctx.rotate(ac.angle);
        drawCardFace(ctx, -CARD_W / 2, -CARD_H / 2, ac.card);
        ctx.restore();
      }

      // Draw particles
      updateAndDrawParticles();

      if (anyAlive || launchIndex < allCards.length || particles.length > 0)
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
    particles = [];
    animatingCards = [];
    flippingCards = [];
    dealAnimCards = [];
  }

  /* ================================================================
   *  POINTER EVENTS
   * ================================================================ */

  let lastClickTime = 0;
  let lastClickHit = null;
  let pointerDown = false;
  let pointerStartX = 0;
  let pointerStartY = 0;

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0)
      return;

    if (gameWon) {
      stopWinAnimation();
      newGame();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;

    pointerDown = true;
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
      return;
    }

    if (isDoubleClick && hit.area === 'waste') {
      const card = waste[hit.index];
      if (card && card.faceUp)
        autoMoveToFoundation(card, 'waste', 0, hit.index);
      return;
    }

    if (isDoubleClick && hit.area === 'tableau') {
      const card = hit.card;
      if (card && card.faceUp && hit.index === tableau[hit.col].length - 1)
        autoMoveToFoundation(card, 'tableau', hit.col, hit.index);
      return;
    }

    if (hit.area === 'waste') {
      if (hit.index !== waste.length - 1)
        return;
      const card = waste[hit.index];
      if (!card || !card.faceUp)
        return;
      if (!gameStarted)
        startTimer();
      saveState();
      const wp = wasteCardPos(hit.index);
      dragging = {
        cards: [card],
        source: 'waste',
        sourceIndex: hit.index,
        offsetX: px - wp.x,
        offsetY: py - wp.y,
        currentX: px,
        currentY: py
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (hit.area === 'tableau') {
      const card = hit.card;
      if (!card || !card.faceUp)
        return;
      if (!gameStarted)
        startTimer();
      saveState();
      const pos = tableauCardPos(hit.col, hit.index);
      const cards = tableau[hit.col].slice(hit.index);
      dragging = {
        cards,
        source: 'tableau',
        sourceCol: hit.col,
        sourceIndex: hit.index,
        offsetX: px - pos.x,
        offsetY: py - pos.y,
        currentX: px,
        currentY: py
      };
      canvas.setPointerCapture(e.pointerId);
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!dragging)
      return;
    const rect = canvas.getBoundingClientRect();
    dragging.currentX = (e.clientX - rect.left) / scale;
    dragging.currentY = (e.clientY - rect.top) / scale;
    draw();
  });

  canvas.addEventListener('pointerup', e => {
    if (e.button !== 0)
      return;
    pointerDown = false;

    if (!dragging)
      return;

    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;

    const dx = px - pointerStartX;
    const dy = py - pointerStartY;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
      if (undoHistory.length > 0)
        undoHistory.pop();
      dragging = null;
      draw();
      return;
    }

    canvas.releasePointerCapture(e.pointerId);
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
      case 'undo':
        doUndo();
        break;
      case 'draw1':
        setDrawMode(1);
        break;
      case 'draw3':
        setDrawMode(3);
        break;
      case 'exit':
        User32.DestroyWindow();
        break;
      case 'about':
        showAbout();
        break;
    }
  }

  function setDrawMode(mode) {
    drawMode = mode;
    updateDrawModeChecks();
    newGame();
  }

  function updateDrawModeChecks() {
    const d1 = document.querySelector('[data-action="draw1"]');
    const d3 = document.querySelector('[data-action="draw3"]');
    if (d1)
      d1.classList.toggle('checked', drawMode === 1);
    if (d3)
      d3.classList.toggle('checked', drawMode === 3);
  }

  /* ================================================================
   *  ABOUT DIALOG
   * ================================================================ */

  function showAbout() {
    SZ.Dialog.show('dlg-about');
  }

  /* ================================================================
   *  KEYBOARD SHORTCUTS
   * ================================================================ */

  document.addEventListener('keydown', e => {
    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      doUndo();
    }
    if (e.key === 'Escape')
      SZ.Dialog.close('dlg-about');
  });

  /* ================================================================
   *  INIT
   * ================================================================ */

  User32.EnableVisualStyles();
  updateDrawModeChecks();
  newGame();
  requestAnimationFrame(() => resizeCanvas());

})();
