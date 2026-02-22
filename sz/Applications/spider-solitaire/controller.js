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
  const FACE_DOWN_OFFSET = 5;
  const FACE_UP_OFFSET = 20;
  const MARGIN_X = 8;
  const MARGIN_Y = 8;

  const TABLEAU_COUNT = 10;
  const FOUNDATION_TOTAL = 8;
  const STOCK_DEALS = 5;

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
  let tableau = [];
  let completedSuits = 0;
  let suitCount = 1;
  let moveCount = 0;
  let score = 500;
  let timerSeconds = 0;
  let timerInterval = null;
  let gameStarted = false;
  let gameWon = false;
  let undoHistory = [];

  // Animation
  let completionAnim = null;
  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;

  // Drag state
  let dragging = null;

  /* ================================================================
   *  CANVAS
   * ================================================================ */

  const canvasArea = document.getElementById('canvasArea');
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let canvasW = 800;
  let canvasH = 600;
  let dpr = 1;

  function resizeCanvas() {
    const rect = canvasArea.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
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
   *  LAYOUT: compute dynamic card gap based on canvas width
   * ================================================================ */

  function cardGap() {
    return Math.max(4, Math.floor((canvasW - MARGIN_X * 2 - TABLEAU_COUNT * CARD_W) / (TABLEAU_COUNT - 1)));
  }

  function pileGap() {
    return CARD_W + cardGap();
  }

  function tableauPos(col) {
    return { x: MARGIN_X + col * pileGap(), y: MARGIN_Y };
  }

  function tableauCardPos(col, index) {
    const base = tableauPos(col);
    let y = base.y;
    for (let i = 0; i < index; ++i)
      y += tableau[col][i].faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
    return { x: base.x, y };
  }

  function stockPos() {
    const gap = pileGap();
    const x = MARGIN_X + (TABLEAU_COUNT - 1) * gap;
    return { x, y: canvasH - CARD_H - MARGIN_Y };
  }

  function foundationPos(index) {
    const gap = Math.min(pileGap(), 30);
    return { x: MARGIN_X + index * gap, y: canvasH - CARD_H - MARGIN_Y };
  }

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createSpiderDeck(numSuits) {
    const deck = [];
    const suitsUsed = SUITS.slice(0, numSuits);
    const decksPerSuit = Math.floor(8 / numSuits);
    for (let d = 0; d < decksPerSuit; ++d)
      for (const suit of suitsUsed)
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
    stopCompletionAnim();

    const deck = shuffle(createSpiderDeck(suitCount));

    stock = [];
    tableau = [];
    for (let i = 0; i < TABLEAU_COUNT; ++i)
      tableau.push([]);
    completedSuits = 0;
    moveCount = 0;
    score = 500;
    timerSeconds = 0;
    gameStarted = false;
    gameWon = false;
    undoHistory = [];
    dragging = null;

    let cardIndex = 0;
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const total = col < 4 ? 6 : 5;
      for (let row = 0; row < total; ++row) {
        const card = deck[cardIndex++];
        card.faceUp = (row === total - 1);
        tableau[col].push(card);
      }
    }

    for (let i = cardIndex; i < deck.length; ++i) {
      deck[i].faceUp = false;
      stock.push(deck[i]);
    }

    updateStatusMsg('Spider Solitaire - ' + suitCount + ' Suit' + (suitCount > 1 ? 's' : ''));
    updateScore();
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
      tableau: tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      completedSuits,
      moveCount,
      score
    };
    undoHistory.push(JSON.stringify(state));
  }

  function restoreState(json) {
    const state = JSON.parse(json);
    stock = state.stock.map(c => { const card = makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    tableau = state.tableau.map(t => t.map(c => { const card = makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    completedSuits = state.completedSuits;
    moveCount = state.moveCount;
    score = state.score;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
    updateScore();
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

  function updateScore() {
    document.getElementById('statusScore').textContent = 'Score: ' + score;
  }

  function updateStatusMsg(msg) {
    document.getElementById('statusMsg').textContent = msg;
  }

  function updateTitle() {
    const title = 'Spider Solitaire';
    document.title = title;
    User32.SetWindowText(title);
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

  function drawCardBack(cx, x, y) {
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#333';
    cx.lineWidth = 1;
    cx.stroke();

    const m = 3;
    drawRoundedRect(cx, x + m, y + m, CARD_W - m * 2, CARD_H - m * 2, CARD_RADIUS - 1);
    cx.fillStyle = '#1a237e';
    cx.fill();

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
    if (card.faceUp)
      drawCardFace(cx, x, y, card);
    else
      drawCardBack(cx, x, y);
  }

  function drawEmptySlot(cx, x, y) {
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function draw() {
    ctx.fillStyle = GREEN;
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = DARK_GREEN;
    ctx.fillRect(0, 0, canvasW, 2);
    ctx.fillRect(0, 0, 2, canvasH);

    // Tableau columns
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      if (tableau[col].length === 0) {
        drawEmptySlot(ctx, tp.x, tp.y);
        continue;
      }
      for (let i = 0; i < tableau[col].length; ++i) {
        if (isDragSource(col) && i >= dragging.sourceIndex)
          continue;
        const pos = tableauCardPos(col, i);
        drawCard(ctx, pos.x, pos.y, tableau[col][i]);
      }
    }

    // Stock pile indicator
    if (stock.length > 0) {
      const sp = stockPos();
      const dealsLeft = Math.ceil(stock.length / TABLEAU_COUNT);
      for (let i = 0; i < Math.min(dealsLeft, 5); ++i)
        drawCardBack(ctx, sp.x - i * 3, sp.y);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(dealsLeft + ' deal' + (dealsLeft > 1 ? 's' : ''), sp.x + CARD_W / 2 - (Math.min(dealsLeft, 5) - 1) * 1.5, sp.y + CARD_H + 3);
    }

    // Completed foundations
    for (let i = 0; i < completedSuits; ++i) {
      const fp = foundationPos(i);
      drawRoundedRect(ctx, fp.x, fp.y, CARD_W, CARD_H, CARD_RADIUS);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = 'bold 13px serif';
      ctx.fillStyle = '#000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2660', fp.x + CARD_W / 2, fp.y + CARD_H / 2);
      ctx.font = '10px sans-serif';
      ctx.fillText('K\u2192A', fp.x + CARD_W / 2, fp.y + CARD_H / 2 + 14);
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

  function isDragSource(col) {
    return dragging && dragging.source === 'tableau' && dragging.sourceCol === col;
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(px, py) {
    if (stock.length > 0) {
      const sp = stockPos();
      const dealsLeft = Math.min(Math.ceil(stock.length / TABLEAU_COUNT), 5);
      const leftMost = sp.x - (dealsLeft - 1) * 3;
      if (px >= leftMost && px < sp.x + CARD_W && py >= sp.y && py < sp.y + CARD_H)
        return { area: 'stock' };
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

  function isValidRun(col, startIndex) {
    const pile = tableau[col];
    if (startIndex >= pile.length)
      return false;
    if (!pile[startIndex].faceUp)
      return false;
    for (let i = startIndex; i < pile.length - 1; ++i) {
      if (!pile[i + 1].faceUp)
        return false;
      if (pile[i].suit !== pile[i + 1].suit)
        return false;
      if (pile[i].value !== pile[i + 1].value + 1)
        return false;
    }
    return true;
  }

  function canPlaceOnTableau(card, col) {
    const pile = tableau[col];
    if (pile.length === 0)
      return true;
    const top = pile[pile.length - 1];
    return top.faceUp && card.value === top.value - 1;
  }

  function checkForCompletedSequence(col) {
    const pile = tableau[col];
    if (pile.length < 13)
      return false;

    const start = pile.length - 13;
    const topCard = pile[start];
    if (topCard.value !== 12)
      return false;

    for (let i = start; i < pile.length; ++i) {
      if (!pile[i].faceUp)
        return false;
      if (pile[i].suit !== topCard.suit)
        return false;
      if (pile[i].value !== 12 - (i - start))
        return false;
    }

    return true;
  }

  function removeCompletedSequence(col) {
    const pile = tableau[col];
    const start = pile.length - 13;

    const positions = [];
    for (let i = start; i < pile.length; ++i) {
      const pos = tableauCardPos(col, i);
      positions.push({ x: pos.x, y: pos.y });
    }

    const removedCards = pile.splice(start, 13);
    ++completedSuits;

    if (pile.length > 0 && !pile[pile.length - 1].faceUp)
      pile[pile.length - 1].faceUp = true;

    const target = foundationPos(completedSuits - 1);
    startCompletionAnim(removedCards, positions, target.x, target.y, () => {
      updateScore();
      draw();
      if (completedSuits >= FOUNDATION_TOTAL)
        doWin();
    });
  }

  /* ================================================================
   *  STOCK DEALING
   * ================================================================ */

  function dealFromStock() {
    if (stock.length === 0)
      return;

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      if (tableau[col].length === 0) {
        updateStatusMsg('Cannot deal: fill all empty columns first!');
        return;
      }
    }

    if (!gameStarted)
      startTimer();

    saveState();

    const count = Math.min(TABLEAU_COUNT, stock.length);
    for (let i = 0; i < count; ++i) {
      const card = stock.pop();
      card.faceUp = true;
      tableau[i].push(card);
    }

    ++moveCount;
    ++score;
    updateMoves();
    updateScore();
    draw();

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      if (checkForCompletedSequence(col)) {
        removeCompletedSequence(col);
        break;
      }
    }
  }

  /* ================================================================
   *  COMPLETION ANIMATION
   * ================================================================ */

  function startCompletionAnim(cards, startPositions, targetX, targetY, onDone) {
    completionAnim = {
      cards,
      startPositions,
      targetX,
      targetY,
      progress: 0,
      onDone
    };
    animateCompletion();
  }

  function animateCompletion() {
    if (!completionAnim)
      return;

    completionAnim.progress += 0.05;
    if (completionAnim.progress >= 1) {
      stopCompletionAnim();
      return;
    }

    draw();

    const t = completionAnim.progress;
    const ease = t * t * (3 - 2 * t);
    for (let i = 0; i < completionAnim.cards.length; ++i) {
      const sp = completionAnim.startPositions[i];
      const x = sp.x + (completionAnim.targetX - sp.x) * ease;
      const y = sp.y + (completionAnim.targetY - sp.y) * ease;
      drawCardFace(ctx, x, y, completionAnim.cards[i]);
    }

    requestAnimationFrame(animateCompletion);
  }

  function stopCompletionAnim() {
    if (completionAnim) {
      const cb = completionAnim.onDone;
      completionAnim = null;
      if (cb)
        cb();
    }
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
      if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const col = hit.col;
        if (dragging.source === 'tableau' && dragging.sourceCol === col) {
          // Dropping on same column - do nothing
        } else if (canPlaceOnTableau(dragging.cards[0], col)) {
          removeFromSource();
          for (const card of dragging.cards) {
            card.faceUp = true;
            tableau[col].push(card);
          }
          ++moveCount;
          ++score;
          dropped = true;
        }
      }
    }

    if (!dropped) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        if (dragging.source === 'tableau' && dragging.sourceCol === col)
          continue;
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
          removeFromSource();
          for (const card of dragging.cards) {
            card.faceUp = true;
            tableau[col].push(card);
          }
          ++moveCount;
          ++score;
          dropped = true;
          break;
        }
      }
    }

    if (dropped)
      updateMoves();

    let droppedCol = -1;
    if (dropped) {
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = tableau[col];
        if (pile.length > 0 && pile[pile.length - 1] === dragging.cards[dragging.cards.length - 1]) {
          droppedCol = col;
          break;
        }
      }
    }

    if (!dropped) {
      if (undoHistory.length > 0)
        undoHistory.pop();
    }

    dragging = null;
    updateScore();
    draw();

    if (dropped && droppedCol >= 0) {
      if (checkForCompletedSequence(droppedCol))
        removeCompletedSequence(droppedCol);
    }
  }

  function removeFromSource() {
    if (!dragging)
      return;
    if (dragging.source === 'tableau') {
      tableau[dragging.sourceCol].splice(dragging.sourceIndex);
      const pile = tableau[dragging.sourceCol];
      if (pile.length > 0 && !pile[pile.length - 1].faceUp)
        pile[pile.length - 1].faceUp = true;
    }
  }

  /* ================================================================
   *  WIN DETECTION + ANIMATION
   * ================================================================ */

  function doWin() {
    gameWon = true;
    stopTimer();
    updateStatusMsg('Congratulations! You won! Score: ' + score + ' in ' + moveCount + ' moves!');
    startWinAnimation();
  }

  function startWinAnimation() {
    winAnimCards = [];
    winAnimRunning = true;

    const allCards = [];
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      for (const card of tableau[col]) {
        card.faceUp = true;
        allCards.push({ card, startX: tp.x, startY: tp.y });
      }
    }
    for (let i = 0; i < completedSuits; ++i) {
      const fp = foundationPos(i);
      for (const rank of RANKS) {
        const card = makeCard('spades', rank);
        card.faceUp = true;
        allCards.push({ card, startX: fp.x, startY: fp.y });
      }
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
    }, 40);

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
  let pointerStartX = 0;
  let pointerStartY = 0;

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0)
      return;

    if (gameWon) {
      stopWinAnimation();
      showDifficultyDialog();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

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

    if (hit.area === 'tableau') {
      const card = hit.card;
      if (!card || !card.faceUp)
        return;

      if (!isValidRun(hit.col, hit.index))
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
    dragging.currentX = e.clientX - rect.left;
    dragging.currentY = e.clientY - rect.top;
    draw();
  });

  canvas.addEventListener('pointerup', e => {
    if (e.button !== 0)
      return;

    if (!dragging)
      return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

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
        showDifficultyDialog();
        break;
      case 'diff1':
        setDifficulty(1);
        break;
      case 'diff2':
        setDifficulty(2);
        break;
      case 'diff4':
        setDifficulty(4);
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

  function setDifficulty(numSuits) {
    suitCount = numSuits;
    updateDifficultyChecks();
    newGame();
  }

  function updateDifficultyChecks() {
    const d1 = document.querySelector('[data-action="diff1"]');
    const d2 = document.querySelector('[data-action="diff2"]');
    const d4 = document.querySelector('[data-action="diff4"]');
    if (d1) d1.classList.toggle('checked', suitCount === 1);
    if (d2) d2.classList.toggle('checked', suitCount === 2);
    if (d4) d4.classList.toggle('checked', suitCount === 4);
  }

  /* ================================================================
   *  DIFFICULTY DIALOG
   * ================================================================ */

  function showDifficultyDialog() {
    const radio = document.getElementById('diff' + suitCount);
    if (radio)
      radio.checked = true;
    SZ.Dialog.show('difficultyBackdrop').then(result => {
      if (result === 'ok') {
        const selected = document.querySelector('input[name="difficulty"]:checked');
        if (selected) {
          suitCount = parseInt(selected.value, 10);
          updateDifficultyChecks();
        }
        newGame();
      }
    });
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
      showDifficultyDialog();
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      doUndo();
    }
    if (e.key === 'Escape') {
      SZ.Dialog.close('dlg-about');
      SZ.Dialog.close('difficultyBackdrop');
    }
  });

  /* ================================================================
   *  INIT
   * ================================================================ */

  User32.EnableVisualStyles();
  updateDifficultyChecks();
  newGame();
  requestAnimationFrame(() => resizeCanvas());

})();
