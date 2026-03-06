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
  const CARD_GAP = 14;
  const FACE_DOWN_OFFSET = 15;
  const FACE_UP_OFFSET = 25;
  const MARGIN_X = 12;
  const MARGIN_Y = 12;
  const PILE_GAP = CARD_W + CARD_GAP;

  const FOUNDATION_COUNT = 4;
  const TABLEAU_COUNT = 7;

  const BASE_W = MARGIN_X * 2 + (TABLEAU_COUNT - 1) * PILE_GAP + CARD_W;
  const BASE_H = 500;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let foundations = [[], [], [], []];
  let tableau = [[], [], [], [], [], [], []];
  let moveCount = 0;
  let score = 0;
  let timerSeconds = 0;
  let timerInterval = null;
  let gameStarted = false;
  let gameWon = false;
  let roundOver = false;
  let gameOver = false;
  let undoHistory = [];
  const MAX_UNDO = 100;

  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;
  let particles = [];
  let lastFireworkTime = 0;

  let animatingCards = [];
  let flippingCards = [];

  let dragging = null;

  let lastClickTime = 0;
  let lastClickHit = null;
  let pointerStartX = 0;
  let pointerStartY = 0;

  let _ctx = null;
  let _canvas = null;
  let _host = null;
  let _W = CANVAS_W;
  let _H = CANVAS_H;
  let scale = 1;
  let canvasW = BASE_W;
  let canvasH = BASE_H;

  let statusMsg = '';

  let winLaunchInterval = null;

  /* ================================================================
   *  LAYOUT: compute positions
   * ================================================================ */

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

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(col) {
    return dragging && dragging.source === 'tableau' && dragging.sourceCol === col;
  }

  /* ================================================================
   *  STATUS BAR
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
    cx.fillText('Score: ' + score + '  |  Moves: ' + moveCount, canvasW / 2, barY + 11);

    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    cx.textAlign = 'right';
    cx.fillText('Time: ' + mins + ':' + String(secs).padStart(2, '0'), canvasW - 8, barY + 11);
  }

  /* ================================================================
   *  TITLE HEADER
   * ================================================================ */

  function drawTitle(cx) {
    cx.font = 'bold 16px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillText('Yukon', MARGIN_X, MARGIN_Y + CARD_H / 2);
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
    for (const a of animatingCards)
      animSet.add(a.card);

    if (winAnimRunning) {
      drawWinFrame(cx);
      drawStatusBar(cx);
      cx.restore();
      return;
    }

    // Title
    drawTitle(cx);

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
        if (isDragSource(col) && i >= dragging.sourceIndex)
          continue;
        if (animSet.has(tableau[col][i]))
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCard(cx, pos.x, pos.y, tableau[col][i]);
        if (_host && _host.hintsEnabled && !dragging && tableau[col][i].faceUp && i === tableau[col].length - 1 && hasAnyValidMove(tableau[col][i], col))
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
    // Foundation piles
    for (let i = 0; i < FOUNDATION_COUNT; ++i) {
      const fp = foundationPos(i);
      if (px >= fp.x && px < fp.x + CARD_W && py >= fp.y && py < fp.y + CARD_H)
        return { area: 'foundation', index: i };
    }

    // Tableau columns
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
      return card.value === 12; // only Kings on empty columns
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
      foundations: foundations.map(f => f.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      tableau: tableau.map(t => t.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      moveCount,
      score
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    foundations = s.foundations.map(f => f.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    tableau = s.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    moveCount = s.moveCount;
    score = s.score;
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

    foundations = [[], [], [], []];
    tableau = [[], [], [], [], [], [], []];
    moveCount = 0;
    score = 0;
    timerSeconds = 0;
    gameStarted = false;
    gameWon = false;
    roundOver = false;
    gameOver = false;
    undoHistory = [];
    dragging = null;
    animatingCards = [];
    flippingCards = [];
    particles = [];
    statusMsg = 'Yukon Solitaire';

    // Standard Yukon deal:
    // Column 1: 1 card (face-up)
    // Column 2: 2 cards (1 face-down, 1 face-up)
    // ...
    // Column 7: 7 cards (6 face-down, 1 face-up)
    let cardIndex = 0;
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      for (let row = 0; row <= col; ++row) {
        const card = deck[cardIndex++];
        card.faceUp = (row === col);
        tableau[col].push(card);
      }
    }

    // Deal 4 extra face-up cards to columns 2-7 (indices 1-6)
    for (let col = 1; col < TABLEAU_COUNT; ++col) {
      for (let i = 0; i < 4; ++i) {
        const card = deck[cardIndex++];
        card.faceUp = true;
        tableau[col].push(card);
      }
    }
    // Total: 1 + (2+4) + (3+4) + (4+4) + (5+4) + (6+4) + (7+4)
    //      = 1 + 6 + 7 + 8 + 9 + 10 + 11 = 52
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceCol, sourceIndex) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    // Only the top card of a tableau column may go to foundation
    if (sourceIndex !== tableau[sourceCol].length - 1)
      return false;

    if (!gameStarted)
      startTimer();
    saveState();

    const fromPos = tableauCardPos(sourceCol, sourceIndex);
    tableau[sourceCol].splice(sourceIndex, 1);
    flipTopCard(sourceCol);

    card.faceUp = true;
    foundations[fi].push(card);
    ++moveCount;
    score += 10;

    const fp = foundationPos(fi);
    startCardMoveAnim(card, fromPos.x, fromPos.y, fp.x, fp.y, () => {
      checkWin();
    });
    return true;
  }

  /* ================================================================
   *  FLIP TOP CARD HELPER
   * ================================================================ */

  function flipTopCard(col) {
    const pile = tableau[col];
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      const flippedCard = pile[pile.length - 1];
      flippedCard.faceUp = true;
      score += 5;
      const fpos = tableauCardPos(col, pile.length - 1);
      startFlipAnim(flippedCard, fpos.x, fpos.y);
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
      // Foundation drop (single card only)
      if (hit.area === 'foundation' && dragging.cards.length === 1) {
        if (canPlaceOnFoundation(dragging.cards[0], hit.index)) {
          removeFromSource();
          dragging.cards[0].faceUp = true;
          foundations[hit.index].push(dragging.cards[0]);
          ++moveCount;
          score += 10;
          dropped = true;
        }
      }
      // Tableau drop
      else if (hit.area === 'tableau' || hit.area === 'tableau-empty') {
        const col = hit.col;
        if (canPlaceOnTableau(dragging.cards[0], col)) {
          removeFromSource();
          for (const card of dragging.cards) {
            card.faceUp = true;
            tableau[col].push(card);
          }
          ++moveCount;
          score += 5;
          dropped = true;
        }
      }
    }

    // Proximity snapping to foundation
    if (!dropped && dragging.cards.length === 1) {
      for (let i = 0; i < FOUNDATION_COUNT; ++i) {
        const fp = foundationPos(i);
        const dx = px - fp.x - CARD_W / 2;
        const dy = py - fp.y - CARD_H / 2;
        if (Math.abs(dx) < CARD_W && Math.abs(dy) < CARD_H && canPlaceOnFoundation(dragging.cards[0], i)) {
          removeFromSource();
          dragging.cards[0].faceUp = true;
          foundations[i].push(dragging.cards[0]);
          ++moveCount;
          score += 10;
          dropped = true;
          break;
        }
      }
    }

    // Proximity snapping to tableau
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
          score += 5;
          dropped = true;
          break;
        }
      }
    }

    if (!dropped) {
      if (undoHistory.length > 0)
        undoHistory.pop();
    } else
      statusMsg = '';

    dragging = null;

    if (dropped)
      checkWin();
  }

  function removeFromSource() {
    if (!dragging)
      return;
    if (dragging.source === 'tableau') {
      tableau[dragging.sourceCol].splice(dragging.sourceIndex);
      flipTopCard(dragging.sourceCol);
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
          score += 10;
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
    roundOver = true;
    gameOver = true;
    stopTimer();
    statusMsg = 'Congratulations! You won in ' + moveCount + ' moves! Score: ' + score;
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

      // Double-click on top card of tableau to auto-move to foundation
      if (isDoubleClick && hit.area === 'tableau') {
        const card = hit.card;
        if (card && card.faceUp && hit.index === tableau[hit.col].length - 1) {
          autoMoveToFoundation(card, hit.col, hit.index);
          return;
        }
      }

      // Start dragging a face-up card (and all cards on top of it)
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
        if (_canvas && _canvas.setPointerCapture)
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

      if (_canvas && e && e.pointerId !== undefined && _canvas.releasePointerCapture)
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
    },

    tick(dt) {
      CE.updateParticles(particles);
    },

    cleanup() {
      stopWinAnimation();
      stopTimer();
      foundations = [[], [], [], []];
      tableau = [[], [], [], [], [], [], []];
      dragging = null;
      undoHistory = [];
      animatingCards = [];
      flippingCards = [];
      particles = [];
      winAnimCards = [];
      gameStarted = false;
      gameWon = false;
      roundOver = false;
      gameOver = false;
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

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('yukon', module);

})();
