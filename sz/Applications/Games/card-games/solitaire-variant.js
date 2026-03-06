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
  const FACE_DOWN_OFFSET = 14;
  const FACE_UP_OFFSET = 25;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 7;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 450;

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

  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;
  let particles = [];
  let lastFireworkTime = 0;

  let animatingCards = [];
  let flippingCards = [];
  let dealAnimCards = [];

  let dragging = null;

  let lastClickTime = 0;
  let lastClickHit = null;
  let pointerDown = false;
  let pointerStartX = 0;
  let pointerStartY = 0;

  let _ctx = null;
  let _canvas = null;
  let _host = null;
  let _W = 900;
  let _H = 600;
  let scale = 1;
  let canvasW = BASE_W;
  let canvasH = BASE_H;

  let statusMsg = '';

  let winLaunchInterval = null;

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
    const visibleStart = Math.max(0, waste.length - 3);
    const visibleIndex = i - visibleStart;
    if (visibleIndex < 0)
      return { x: base.x, y: base.y };
    return { x: base.x + visibleIndex * 16, y: base.y };
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
   *  STATUS BAR (drawn on canvas)
   * ================================================================ */

  function drawStatusBar(cx) {
    const barY = canvasH - 22;
    cx.fillStyle = 'rgba(0,0,0,0.35)';
    cx.fillRect(0, barY, canvasW, 22);

    cx.font = '12px sans-serif';
    cx.textBaseline = 'middle';
    cx.textAlign = 'left';

    cx.fillStyle = '#fff';
    cx.fillText(statusMsg, 8, barY + 11);

    cx.textAlign = 'center';
    cx.fillText('Moves: ' + moveCount, canvasW / 2, barY + 11);

    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    cx.textAlign = 'right';
    cx.fillText('Time: ' + mins + ':' + String(secs).padStart(2, '0'), canvasW - 8, barY + 11);
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawAll(cx, W, H) {
    scale = Math.min(W / BASE_W, H / BASE_H);
    canvasW = W / scale;
    canvasH = H / scale;

    cx.save();
    cx.scale(scale, scale);

    const animSet = new Set();
    for (const d of dealAnimCards)
      animSet.add(d.card);
    for (const a of animatingCards)
      animSet.add(a.card);

    if (winAnimRunning) {
      drawWinFrame(cx);
      drawStatusBar(cx);
      cx.restore();
      return;
    }

    // Stock pile
    const sp = stockPos();
    if (stock.length > 0)
      CE.drawCardBack(cx, sp.x, sp.y);
    else
      CE.drawRecycleSymbol(cx, sp.x, sp.y);

    // Waste pile
    const wp = wastePos();
    if (waste.length === 0) {
      CE.drawEmptySlot(cx, wp.x, wp.y, null);
    } else {
      if (drawMode === 1) {
        const top = waste[waste.length - 1];
        if (!isDragSource('waste', waste.length - 1) && !animSet.has(top)) {
          CE.drawCard(cx, wp.x, wp.y, top);
          if (_host && _host.hintsEnabled && !dragging && hasAnyValidMove(top, -1))
            CE.drawHintGlow(cx, wp.x, wp.y, CARD_W, CARD_H, _host.hintTime);
        }
      } else {
        const visibleStart = Math.max(0, waste.length - 3);
        for (let i = visibleStart; i < waste.length; ++i) {
          if (isDragSource('waste', i))
            continue;
          if (animSet.has(waste[i]))
            continue;
          const pos = wasteCardPos(i);
          CE.drawCard(cx, pos.x, pos.y, waste[i]);
          if (i === waste.length - 1 && _host && _host.hintsEnabled && !dragging && hasAnyValidMove(waste[i], -1))
            CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
        }
      }
    }

    // Foundation piles
    const foundSuits = ['spades', 'hearts', 'diamonds', 'clubs'];
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (foundations[i].length === 0) {
        CE.drawEmptySlot(cx, fp.x, fp.y, null);
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        CE.drawSuitSymbol(cx, foundSuits[i], fp.x + CARD_W / 2, fp.y + CARD_H / 2, 28);
      } else {
        const top = foundations[i][foundations[i].length - 1];
        if (!animSet.has(top))
          CE.drawCard(cx, fp.x, fp.y, top);
        else if (foundations[i].length > 1)
          CE.drawCard(cx, fp.x, fp.y, foundations[i][foundations[i].length - 2]);
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
        CE.drawCard(cx, pos.x, pos.y, tableau[col][i]);
        if (_host && _host.hintsEnabled && !dragging && !animSet.has(tableau[col][i]) && tableau[col][i].faceUp && i === tableau[col].length - 1 && hasAnyValidMove(tableau[col][i], col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
      }
    }

    drawAnimations(cx);

    // Draw dragged cards on top
    if (dragging) {
      for (let i = 0; i < dragging.cards.length; ++i) {
        const dx = dragging.currentX - dragging.offsetX;
        const dy = dragging.currentY - dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCard(cx, dx, dy, dragging.cards[i]);
      }
    }

    CE.drawParticles(cx, particles);
    drawStatusBar(cx);

    cx.restore();
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
    const s = JSON.parse(json);
    stock = s.stock.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    waste = s.waste.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    foundations = s.foundations.map(f => f.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    tableau = s.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    moveCount = s.moveCount;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    stopWinAnimation();
    stopTimer();

    const deck = CE.shuffle(CE.createDeck());

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
    statusMsg = 'Click stock pile to deal cards';

    for (let col = 0; col < TABLEAU_COUNT; ++col)
      for (let row = col; row < TABLEAU_COUNT; ++row) {
        const card = deck.pop();
        card.faceUp = (row === col);
        tableau[row].push(card);
      }

    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      stock.push(card);
    }
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

    const fp = foundationPos(fi);
    startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });
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
        const col = hit.col;
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

    if (dropped)
      statusMsg = '';

    dragging = null;

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
   *  WIN DETECTION + AUTO-COMPLETE
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
      statusMsg = 'Auto-completing...';
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
    };
    setTimeout(step, 200);
  }

  function doWin() {
    gameWon = true;
    stopTimer();
    statusMsg = 'Congratulations! You won in ' + moveCount + ' moves!';
    startWinAnimation();
  }

  /* ================================================================
   *  ANIMATIONS
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
  }

  function startFlipAnim(card, x, y) {
    flippingCards.push({
      card, x, y,
      startTime: performance.now(),
      duration: 200
    });
  }

  function startDealFromStockAnim(card, fromX, fromY, toX, toY, delay) {
    dealAnimCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now() + delay,
      duration: 250
    });
  }

  function drawAnimations(cx) {
    const now = performance.now();

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

    for (let i = flippingCards.length - 1; i >= 0; --i) {
      const f = flippingCards[i];
      const elapsed = now - f.startTime;
      const t = Math.min(elapsed / f.duration, 1);
      let scaleX;
      if (t < 0.5)
        scaleX = 1 - t * 2;
      else
        scaleX = (t - 0.5) * 2;
      cx.save();
      cx.translate(f.x + CARD_W / 2, f.y);
      cx.scale(scaleX, 1);
      if (t < 0.5)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, f.card);
      cx.restore();
      if (t >= 1)
        flippingCards.splice(i, 1);
    }

    for (let i = dealAnimCards.length - 1; i >= 0; --i) {
      const d = dealAnimCards[i];
      const now2 = performance.now();
      if (now2 < d.startTime)
        continue;
      const elapsed = now2 - d.startTime;
      const t = Math.min(elapsed / d.duration, 1);
      const e = CE.easeOutCubic(t);
      const x = d.fromX + (d.toX - d.fromX) * e;
      const y = d.fromY + (d.toY - d.fromY) * e;

      let flipScale;
      if (t < 0.35)
        flipScale = 1;
      else if (t < 0.55)
        flipScale = 1 - (t - 0.35) / 0.2;
      else
        flipScale = (t - 0.55) / 0.45;

      cx.save();
      cx.translate(x + CARD_W / 2, y);
      cx.scale(Math.max(flipScale, 0.01), 1);
      if (t < 0.45)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, d.card);
      cx.restore();

      if (t >= 1)
        dealAnimCards.splice(i, 1);
    }
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
    }, 80);
  }

  function drawWinFrame(cx) {
    const now = performance.now();

    if (now - lastFireworkTime > 500) {
      CE.spawnFirework(particles, Math.random() * canvasW, Math.random() * canvasH * 0.6);
      lastFireworkTime = now;
    }

    CE.drawWinCards(cx, winAnimCards, canvasW, canvasH);
    CE.updateParticles(particles);
    CE.drawParticles(cx, particles);
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
    flippingCards = [];
    dealAnimCards = [];
  }

  /* ================================================================
   *  COORDINATE CONVERSION
   * ================================================================ */

  function toInternal(mx, my) {
    return { x: mx / scale, y: my / scale };
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _canvas = canvas;
      _host = host || null;
      _W = W;
      _H = H;
      scale = Math.min(W / BASE_W, H / BASE_H);
      canvasW = W / scale;
      canvasH = H / scale;
      newGame();
    },

    draw(ctx, W, H) {
      drawAll(ctx, W, H);
    },

    handleClick(mx, my) {
      const pt = toInternal(mx, my);
      const px = pt.x;
      const py = pt.y;

      if (gameWon) {
        stopWinAnimation();
        newGame();
        return;
      }

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
        _canvas.setPointerCapture(0);
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
        _canvas.setPointerCapture(0);
      }
    },

    handlePointerMove(mx, my) {
      if (!dragging)
        return;
      const pt = toInternal(mx, my);
      dragging.currentX = pt.x;
      dragging.currentY = pt.y;
    },

    handlePointerUp(mx, my, e) {
      pointerDown = false;

      if (!dragging)
        return;

      const pt = toInternal(mx, my);
      const px = pt.x;
      const py = pt.y;

      const dx = px - pointerStartX;
      const dy = py - pointerStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        if (undoHistory.length > 0)
          undoHistory.pop();
        dragging = null;
        return;
      }

      if (e && e.pointerId !== undefined)
        _canvas.releasePointerCapture(e.pointerId);
      tryDrop(px, py);
    },

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
      }
      if (e.key === 'd' || e.key === 'D') {
        drawMode = drawMode === 1 ? 3 : 1;
        newGame();
      }
    },

    tick(dt) {
      CE.updateParticles(particles);
    },

    cleanup() {
      stopWinAnimation();
      stopTimer();
      stock = [];
      waste = [];
      foundations = [[], [], [], []];
      tableau = [[], [], [], [], [], [], []];
      dragging = null;
      undoHistory = [];
      animatingCards = [];
      flippingCards = [];
      dealAnimCards = [];
      particles = [];
      winAnimCards = [];
      gameStarted = false;
      gameWon = false;
      moveCount = 0;
      timerSeconds = 0;
      statusMsg = '';
      lastClickTime = 0;
      lastClickHit = null;
      _ctx = null;
      _canvas = null;
      _host = null;
    }
  };

  SZ.CardGames.registerVariant('solitaire', module);

})();
