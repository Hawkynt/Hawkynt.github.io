;(function() {
  'use strict';

  const SZ = window.SZ;
  const CE = SZ.CardEngine;

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const CARD_W = CE.CARD_W;
  const CARD_H = CE.CARD_H;
  const FACE_DOWN_OFFSET = 5;
  const FACE_UP_OFFSET = 20;
  const MARGIN_X = 8;
  const MARGIN_Y = 8;

  const TABLEAU_COUNT = 10;
  const FOUNDATION_TOTAL = 8;

  const BASE_W = MARGIN_X * 2 + TABLEAU_COUNT * CARD_W + (TABLEAU_COUNT - 1) * 10;
  const BASE_H = 500;

  /* ================================================================
   *  MODULE STATE
   * ================================================================ */

  let _ctx = null;
  let _canvas = null;
  let _host = null;
  let canvasW = 900;
  let canvasH = 600;
  let scale = 1;

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

  let completionAnim = null;
  let winAnimCards = [];
  let winAnimRunning = false;
  let winAnimId = null;
  let particles = [];
  let lastFireworkTime = 0;

  let flippingCards = [];
  let dealAnimCards = [];

  let dragging = null;
  let lastClickTime = 0;
  let lastClickHit = null;
  let pointerStartX = 0;
  let pointerStartY = 0;

  let statusMsg = '';

  let winLaunchInterval = null;

  /* ================================================================
   *  LAYOUT HELPERS
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
    const suitsUsed = CE.SUITS.slice(0, numSuits);
    const decksPerSuit = Math.floor(8 / numSuits);
    for (let d = 0; d < decksPerSuit; ++d)
      for (const suit of suitsUsed)
        for (const rank of CE.RANKS)
          deck.push(CE.makeCard(suit, rank));
    return deck;
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
    stock = state.stock.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; });
    tableau = state.tableau.map(t => t.map(c => { const card = CE.makeCard(c.suit, c.rank); card.faceUp = c.faceUp; return card; }));
    completedSuits = state.completedSuits;
    moveCount = state.moveCount;
    score = state.score;
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
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
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
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

  function findMoveableRunStart(col) {
    const pile = tableau[col];
    if (pile.length === 0)
      return -1;
    let start = pile.length - 1;
    while (start > 0 && pile[start - 1].faceUp && pile[start - 1].suit === pile[start].suit && pile[start - 1].value === pile[start].value + 1)
      --start;
    return start;
  }

  function spiderHasValidMove(col) {
    const start = findMoveableRunStart(col);
    if (start < 0)
      return false;
    const card = tableau[col][start];
    for (let c = 0; c < TABLEAU_COUNT; ++c) {
      if (c === col)
        continue;
      if (canPlaceOnTableau(card, c))
        return true;
    }
    return false;
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

    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      const flippedCard = pile[pile.length - 1];
      flippedCard.faceUp = true;
      const fpos = tableauCardPos(col, pile.length - 1);
      startFlipAnim(flippedCard, fpos.x, fpos.y);
    }

    const target = foundationPos(completedSuits - 1);
    startCompletionAnim(removedCards, positions, target.x, target.y, () => {
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
        statusMsg = 'Cannot deal: fill all empty columns first!';
        return;
      }
    }

    if (!gameStarted)
      startTimer();

    saveState();

    const count = Math.min(TABLEAU_COUNT, stock.length);
    const sp = stockPos();
    for (let i = 0; i < count; ++i) {
      const card = stock.pop();
      card.faceUp = true;
      tableau[i].push(card);
      const destPos = tableauCardPos(i, tableau[i].length - 1);
      startDealCardAnim(card, sp.x, sp.y, destPos.x, destPos.y, i * 60);
    }

    ++moveCount;
    ++score;

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      if (checkForCompletedSequence(col)) {
        removeCompletedSequence(col);
        break;
      }
    }
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
          // same column
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
      if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
        const flippedCard = pile[pile.length - 1];
        flippedCard.faceUp = true;
        const fpos = tableauCardPos(dragging.sourceCol, pile.length - 1);
        startFlipAnim(flippedCard, fpos.x, fpos.y);
      }
    }
  }

  function isDragSource(col) {
    return dragging && dragging.source === 'tableau' && dragging.sourceCol === col;
  }

  /* ================================================================
   *  CARD FLIP ANIMATION
   * ================================================================ */

  function startDealCardAnim(card, fromX, fromY, toX, toY, delay) {
    dealAnimCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now() + delay,
      duration: 300
    });
    if (!winAnimRunning && dealAnimCards.length === 1 && flippingCards.length === 0)
      requestAnimationFrame(tickFlipAnimations);
  }

  function startFlipAnim(card, x, y) {
    flippingCards.push({
      card, x, y,
      startTime: performance.now(),
      duration: 200
    });
    if (!winAnimRunning && flippingCards.length === 1 && dealAnimCards.length === 0)
      requestAnimationFrame(tickFlipAnimations);
  }

  function tickFlipAnimations() {
    if (flippingCards.length === 0 && dealAnimCards.length === 0)
      return;
    const now = performance.now();
    const cx = _ctx;
    drawScene(cx);

    for (let i = dealAnimCards.length - 1; i >= 0; --i) {
      const d = dealAnimCards[i];
      if (now < d.startTime) {
        CE.drawCardBack(cx, d.fromX, d.fromY);
        continue;
      }
      const elapsed = now - d.startTime;
      const t = Math.min(elapsed / d.duration, 1);
      const e = CE.easeOutCubic(t);
      const x = d.fromX + (d.toX - d.fromX) * e;
      const y = d.fromY + (d.toY - d.fromY) * e;

      let scaleX;
      if (t < 0.4)
        scaleX = 1;
      else if (t < 0.6)
        scaleX = 1 - (t - 0.4) / 0.2;
      else
        scaleX = (t - 0.6) / 0.4;

      cx.save();
      cx.translate(x + CARD_W / 2, y);
      cx.scale(Math.max(scaleX, 0.01), 1);
      if (t < 0.5)
        CE.drawCardBack(cx, -CARD_W / 2, 0);
      else
        CE.drawCardFace(cx, -CARD_W / 2, 0, d.card);
      cx.restore();

      if (t >= 1)
        dealAnimCards.splice(i, 1);
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

    if (flippingCards.length > 0 || dealAnimCards.length > 0)
      requestAnimationFrame(tickFlipAnimations);
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

    const cx = _ctx;
    drawScene(cx);

    const t = completionAnim.progress;
    const ease = t * t * (3 - 2 * t);
    for (let i = 0; i < completionAnim.cards.length; ++i) {
      const sp = completionAnim.startPositions[i];
      const x = sp.x + (completionAnim.targetX - sp.x) * ease;
      const y = sp.y + (completionAnim.targetY - sp.y) * ease;
      CE.drawCardFace(cx, x, y, completionAnim.cards[i]);
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
   *  WIN DETECTION + ANIMATION
   * ================================================================ */

  function doWin() {
    gameWon = true;
    stopTimer();
    statusMsg = 'You won! Score: ' + score + ' in ' + moveCount + ' moves!';
    startWinAnimation();
  }

  function startWinAnimation() {
    winAnimCards = [];
    particles = [];
    winAnimRunning = true;
    lastFireworkTime = 0;

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
      for (const rank of CE.RANKS) {
        const card = CE.makeCard('spades', rank);
        card.faceUp = true;
        allCards.push({ card, startX: fp.x, startY: fp.y });
      }
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

    const animate = (timestamp) => {
      if (!winAnimRunning)
        return;

      const cx = _ctx;
      cx.fillStyle = CE.GREEN;
      cx.fillRect(0, 0, canvasW, canvasH);

      if (timestamp - lastFireworkTime > 500) {
        CE.spawnFirework(particles, Math.random() * canvasW, Math.random() * canvasH * 0.6);
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

        ac.trail.push({ x: ac.x, y: ac.y, alpha: 0.4 });
        if (ac.trail.length > 6)
          ac.trail.shift();
        for (const t of ac.trail) {
          cx.save();
          cx.globalAlpha = t.alpha;
          cx.translate(t.x + CARD_W / 2, t.y + CARD_H / 2);
          cx.rotate(ac.angle);
          CE.drawCardFace(cx, -CARD_W / 2, -CARD_H / 2, ac.card);
          cx.restore();
          t.alpha *= 0.6;
        }

        cx.save();
        cx.translate(ac.x + CARD_W / 2, ac.y + CARD_H / 2);
        cx.rotate(ac.angle);
        CE.drawCardFace(cx, -CARD_W / 2, -CARD_H / 2, ac.card);
        cx.restore();
      }

      CE.updateAndDrawParticles(cx, particles);

      // Draw status overlay during win
      drawStatusBar(cx);

      if (anyAlive || particles.length > 0)
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
    if (winLaunchInterval) {
      clearInterval(winLaunchInterval);
      winLaunchInterval = null;
    }
    winAnimCards = [];
    particles = [];
    flippingCards = [];
    dealAnimCards = [];
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    stopWinAnimation();
    stopTimer();
    stopCompletionAnim();

    const deck = CE.shuffle(createSpiderDeck(suitCount));

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

    statusMsg = 'Spider - ' + suitCount + ' Suit' + (suitCount > 1 ? 's' : '') + " | Press 'd' to change difficulty";
  }

  /* ================================================================
   *  STATUS BAR
   * ================================================================ */

  function drawStatusBar(cx) {
    const barY = canvasH - 16;
    cx.font = '11px sans-serif';
    cx.textBaseline = 'bottom';
    cx.textAlign = 'left';
    cx.fillStyle = 'rgba(255,255,255,0.8)';

    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    const timerStr = 'Time: ' + mins + ':' + String(secs).padStart(2, '0');
    const movesStr = 'Moves: ' + moveCount;
    const scoreStr = 'Score: ' + score;

    const infoText = statusMsg + '  |  ' + scoreStr + '  |  ' + movesStr + '  |  ' + timerStr;
    cx.fillText(infoText, MARGIN_X, barY);
  }

  /* ================================================================
   *  MAIN DRAW (scene without animations)
   * ================================================================ */

  function drawScene(cx) {
    const dealAnimSet = new Set();
    for (const d of dealAnimCards)
      dealAnimSet.add(d.card);

    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const tp = tableauPos(col);
      if (tableau[col].length === 0) {
        CE.drawEmptySlot(cx, tp.x, tp.y, null);
        continue;
      }
      const hintRunStart = (_host && _host.hintsEnabled && !dragging && spiderHasValidMove(col)) ? findMoveableRunStart(col) : -1;
      for (let i = 0; i < tableau[col].length; ++i) {
        if (isDragSource(col) && i >= dragging.sourceIndex)
          continue;
        if (dealAnimSet.has(tableau[col][i]))
          continue;
        const pos = tableauCardPos(col, i);
        CE.drawCard(cx, pos.x, pos.y, tableau[col][i]);
        if (i === hintRunStart)
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
      }
    }

    if (stock.length > 0) {
      const sp = stockPos();
      const dealsLeft = Math.ceil(stock.length / TABLEAU_COUNT);
      for (let i = 0; i < Math.min(dealsLeft, 5); ++i)
        CE.drawCardBack(cx, sp.x - i * 3, sp.y);

      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(dealsLeft + ' deal' + (dealsLeft > 1 ? 's' : ''), sp.x + CARD_W / 2 - (Math.min(dealsLeft, 5) - 1) * 1.5, sp.y + CARD_H + 3);
    }

    for (let i = 0; i < completedSuits; ++i) {
      const fp = foundationPos(i);
      CE.drawRoundedRect(cx, fp.x, fp.y, CARD_W, CARD_H, CE.CARD_RADIUS);
      cx.fillStyle = '#fff';
      cx.fill();
      cx.strokeStyle = '#333';
      cx.lineWidth = 1;
      cx.stroke();
      cx.font = 'bold 13px serif';
      cx.fillStyle = '#000';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText('\u2660', fp.x + CARD_W / 2, fp.y + CARD_H / 2);
      cx.font = '10px sans-serif';
      cx.fillText('K\u2192A', fp.x + CARD_W / 2, fp.y + CARD_H / 2 + 14);
    }

    if (dragging) {
      for (let i = 0; i < dragging.cards.length; ++i) {
        const dx = dragging.currentX - dragging.offsetX;
        const dy = dragging.currentY - dragging.offsetY + i * FACE_UP_OFFSET;
        CE.drawCard(cx, dx, dy, dragging.cards[i]);
      }
    }

    drawStatusBar(cx);
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
      canvasW = W;
      canvasH = H;
      scale = Math.min(W / BASE_W, H / BASE_H);
      _ctx = ctx;

      if (winAnimRunning)
        return; // win animation drives its own rAF loop

      drawScene(ctx);
    },

    handleClick(mx, my) {
      if (gameWon) {
        stopWinAnimation();
        newGame();
        return;
      }

      pointerStartX = mx;
      pointerStartY = my;

      const hit = hitTest(mx, my);
      if (!hit)
        return;

      const now = Date.now();
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
          offsetX: mx - pos.x,
          offsetY: my - pos.y,
          currentX: mx,
          currentY: my
        };
        if (_canvas)
          _canvas.setPointerCapture && _canvas.setPointerCapture(0);
      }
    },

    handlePointerMove(mx, my) {
      if (!dragging)
        return;
      dragging.currentX = mx;
      dragging.currentY = my;
    },

    handlePointerUp(mx, my, e) {
      if (!dragging)
        return;

      const dx = mx - pointerStartX;
      const dy = my - pointerStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        if (undoHistory.length > 0)
          undoHistory.pop();
        dragging = null;
        return;
      }

      if (_canvas && e && e.pointerId !== undefined)
        _canvas.releasePointerCapture && _canvas.releasePointerCapture(e.pointerId);

      tryDrop(mx, my);
    },

    handleKey(e) {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (suitCount === 1)
          suitCount = 2;
        else if (suitCount === 2)
          suitCount = 4;
        else
          suitCount = 1;
        newGame();
      }
    },

    tick(dt) {
      // Animations are rAF-driven; nothing extra needed per host tick
    },

    cleanup() {
      stopWinAnimation();
      stopTimer();
      stopCompletionAnim();

      stock = [];
      tableau = [];
      completedSuits = 0;
      moveCount = 0;
      score = 500;
      timerSeconds = 0;
      gameStarted = false;
      gameWon = false;
      undoHistory = [];
      dragging = null;
      flippingCards = [];
      dealAnimCards = [];
      particles = [];
      winAnimCards = [];
      completionAnim = null;
      statusMsg = '';
      _ctx = null;
      _canvas = null;
      _host = null;
    }
  };

  SZ.CardGames.registerVariant('spider', module);

})();
