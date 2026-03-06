;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const CARD_W = CE ? CE.CARD_W : 71;
  const CARD_H = CE ? CE.CARD_H : 96;
  const CARD_RADIUS = CE ? CE.CARD_RADIUS : 5;

  const COLUMN_COUNT = 7;
  const CARDS_PER_COLUMN = 5;
  const CARD_OVERLAP = 25;

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = CE ? CE.SUITS : ['spades', 'hearts', 'diamonds', 'clubs'];

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let columns = [];
  let stock = [];
  let waste = [];
  let score = 0;
  let cardsCleared = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let moveCount = 0;
  let undoHistory = [];
  const MAX_UNDO = 100;

  let hoverCol = -1;

  let animatingCards = [];
  let particles = [];

  let _ctx = null;
  let _host = null;
  let _canvas = null;

  /* ================================================================
   *  LAYOUT
   * ================================================================ */

  const COLUMN_GAP = 12;
  const TOTAL_COLUMNS_W = COLUMN_COUNT * CARD_W + (COLUMN_COUNT - 1) * COLUMN_GAP;
  const COLUMNS_LEFT = (CANVAS_W - TOTAL_COLUMNS_W) / 2;
  const COLUMNS_TOP = 30;

  const STOCK_X = 40;
  const STOCK_Y = CANVAS_H - CARD_H - 40;
  const WASTE_X = STOCK_X + CARD_W + 20;
  const WASTE_Y = STOCK_Y;

  function columnX(col) {
    return COLUMNS_LEFT + col * (CARD_W + COLUMN_GAP);
  }

  function columnCardY(row) {
    return COLUMNS_TOP + row * CARD_OVERLAP;
  }

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createDeck() {
    if (CE && CE.createDeck)
      return CE.createDeck();
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push({ suit, rank, value: RANKS.indexOf(rank), faceUp: false, color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black' });
    return deck;
  }

  function shuffle(arr) {
    if (CE && CE.shuffle)
      return CE.shuffle(arr);
    for (let i = arr.length - 1; i > 0; --i) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ================================================================
   *  RANK HELPERS
   * ================================================================ */

  function rankIndex(card) {
    return card.value !== undefined ? card.value : RANKS.indexOf(card.rank);
  }

  function canPlayOnWaste(card) {
    if (waste.length === 0)
      return false;
    const top = waste[waste.length - 1];
    const ci = rankIndex(card);
    const wi = rankIndex(top);
    const diff = Math.abs(ci - wi);
    return diff === 1 || diff === 12;
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      columns: columns.map(col => col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      stock: stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      waste: waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      score,
      cardsCleared,
      moveCount
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreCard(c) {
    if (CE && CE.makeCard) {
      const card = CE.makeCard(c.suit, c.rank);
      card.faceUp = c.faceUp;
      return card;
    }
    return { suit: c.suit, rank: c.rank, value: RANKS.indexOf(c.rank), faceUp: c.faceUp, color: (c.suit === 'hearts' || c.suit === 'diamonds') ? 'red' : 'black' };
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    columns = s.columns.map(col => col.map(restoreCard));
    stock = s.stock.map(restoreCard);
    waste = s.waste.map(restoreCard);
    score = s.score;
    cardsCleared = s.cardsCleared;
    moveCount = s.moveCount;
  }

  function doUndo() {
    if (undoHistory.length === 0 || roundOver || gameOver)
      return;
    restoreState(undoHistory.pop());
    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
  }

  /* ================================================================
   *  DRAWING HELPERS (fallback when CE unavailable)
   * ================================================================ */

  function drawRoundedRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r);
    cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r);
    cx.quadraticCurveTo(x, y, x + r, y);
    cx.closePath();
  }

  function drawCardFace(cx, x, y, card) {
    if (CE && CE.drawCardFace)
      return CE.drawCardFace(cx, x, y, card);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#aaa';
    cx.lineWidth = 1;
    cx.stroke();
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#c00' : '#222';
    cx.fillStyle = color;
    cx.font = 'bold 14px serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, x + 5, y + 4);
  }

  function drawCardBack(cx, x, y) {
    if (CE && CE.drawCardBack)
      return CE.drawCardBack(cx, x, y);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#1a237e';
    cx.fill();
    cx.strokeStyle = '#fff';
    cx.lineWidth = 1;
    cx.stroke();
  }

  function drawEmptySlot(cx, x, y, label) {
    if (CE && CE.drawEmptySlot)
      return CE.drawEmptySlot(cx, x, y, label);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();
    if (label) {
      cx.font = '24px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);
    }
  }

  /* ================================================================
   *  PLAYABLE HIGHLIGHT
   * ================================================================ */

  function drawPlayableHighlight(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#4c4';
    cx.lineWidth = 2.5;
    cx.shadowColor = '#4c4';
    cx.shadowBlur = 6;
    if (CE && CE.drawRoundedRect) {
      CE.drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    } else
      drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
  }

  function drawHoverHighlight(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#ff4';
    cx.lineWidth = 3;
    cx.shadowColor = '#ff4';
    cx.shadowBlur = 8;
    if (CE && CE.drawRoundedRect)
      CE.drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    else
      drawRoundedRect(cx, x - 1, y - 1, CARD_W + 2, CARD_H + 2, CARD_RADIUS + 1);
    cx.stroke();
    cx.restore();
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

  function drawAnimations(cx) {
    const now = performance.now();
    for (let i = animatingCards.length - 1; i >= 0; --i) {
      const a = animatingCards[i];
      const elapsed = now - a.startTime;
      const t = Math.min(elapsed / a.duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const x = a.fromX + (a.toX - a.fromX) * ease;
      const y = a.fromY + (a.toY - a.fromY) * ease;
      drawCardFace(cx, x, y, a.card);
      if (t >= 1) {
        animatingCards.splice(i, 1);
        if (CE && CE.spawnSparkle)
          CE.spawnSparkle(particles, a.toX + CARD_W / 2, a.toY + CARD_H / 2);
        if (a.onDone)
          a.onDone();
      }
    }
  }

  /* ================================================================
   *  GAME LOGIC
   * ================================================================ */

  function checkGameEnd() {
    let totalColumnCards = 0;
    for (const col of columns)
      totalColumnCards += col.length;

    if (totalColumnCards === 0) {
      roundOver = true;
      gameOver = false;
      score += 50;
      resultMsg = 'All columns cleared! +50 bonus! Score: ' + score;
      if (_host && _host.floatingText)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'CLEARED! +50', { color: '#4f4', size: 28 });
      if (_host && _host.particles)
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 3, 40);
      if (_host && _host.onScoreChanged)
        _host.onScoreChanged(score);
      if (_host && _host.onRoundOver)
        _host.onRoundOver(false);
      return true;
    }

    let anyPlayable = false;
    for (const col of columns) {
      if (col.length > 0 && canPlayOnWaste(col[col.length - 1])) {
        anyPlayable = true;
        break;
      }
    }

    if (!anyPlayable && stock.length === 0) {
      roundOver = true;
      gameOver = totalColumnCards > 0;
      resultMsg = totalColumnCards + ' card' + (totalColumnCards !== 1 ? 's' : '') + ' remaining. Score: ' + score;
      if (_host && _host.floatingText)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'No more moves!', { color: '#f88', size: 24 });
      if (_host && _host.onScoreChanged)
        _host.onScoreChanged(score);
      if (_host && _host.onRoundOver)
        _host.onRoundOver(gameOver);
      return true;
    }

    return false;
  }

  function playColumnCard(col) {
    if (col < 0 || col >= COLUMN_COUNT || columns[col].length === 0)
      return false;

    const card = columns[col][columns[col].length - 1];
    if (!canPlayOnWaste(card))
      return false;

    saveState();

    const fromX = columnX(col);
    const fromY = columnCardY(columns[col].length - 1);

    columns[col].pop();
    card.faceUp = true;
    waste.push(card);
    ++cardsCleared;
    ++moveCount;
    score += 5;

    startCardMoveAnim(card, fromX, fromY, WASTE_X, WASTE_Y, () => {
      checkGameEnd();
    });

    if (_host && _host.floatingText)
      _host.floatingText.add(fromX + CARD_W / 2, fromY, '+5', { color: '#4f4', size: 18 });
    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);

    return true;
  }

  function dealFromStock() {
    if (stock.length === 0)
      return false;

    saveState();

    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
    ++moveCount;

    if (_host && _host.dealCardAnim)
      _host.dealCardAnim(card, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y, 0);
    else
      startCardMoveAnim(card, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y, null);

    setTimeout(() => checkGameEnd(), 300);
    return true;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = shuffle(createDeck());

    columns = [];
    for (let c = 0; c < COLUMN_COUNT; ++c) {
      columns.push([]);
      for (let r = 0; r < CARDS_PER_COLUMN; ++r) {
        const card = deck.pop();
        card.faceUp = true;
        columns[c].push(card);
      }
    }

    waste = [];
    const firstWaste = deck.pop();
    firstWaste.faceUp = true;
    waste.push(firstWaste);

    stock = [];
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      stock.push(card);
    }

    cardsCleared = 0;
    moveCount = 0;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    undoHistory = [];
    animatingCards = [];
    particles = [];
    hoverCol = -1;

    if (_host && _host.dealCardAnim) {
      for (let c = 0; c < COLUMN_COUNT; ++c)
        for (let r = 0; r < CARDS_PER_COLUMN; ++r) {
          const card = columns[c][r];
          const tx = columnX(c);
          const ty = columnCardY(r);
          _host.dealCardAnim(card, CANVAS_W / 2, -CARD_H, tx, ty, (c * CARDS_PER_COLUMN + r) * 0.04);
        }
    }

    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(mx, my) {
    if (mx >= STOCK_X && mx < STOCK_X + CARD_W && my >= STOCK_Y && my < STOCK_Y + CARD_H)
      return { area: 'stock' };

    if (mx >= WASTE_X && mx < WASTE_X + CARD_W && my >= WASTE_Y && my < WASTE_Y + CARD_H)
      return { area: 'waste' };

    for (let col = 0; col < COLUMN_COUNT; ++col) {
      const pile = columns[col];
      if (pile.length === 0)
        continue;
      const bottomIdx = pile.length - 1;
      const bx = columnX(col);
      const by = columnCardY(bottomIdx);
      if (mx >= bx && mx < bx + CARD_W && my >= by && my < by + CARD_H)
        return { area: 'column', col };
    }

    for (let col = 0; col < COLUMN_COUNT; ++col) {
      const pile = columns[col];
      for (let i = pile.length - 2; i >= 0; --i) {
        const cx_ = columnX(col);
        const cy = columnCardY(i);
        const h = CARD_OVERLAP;
        if (mx >= cx_ && mx < cx_ + CARD_W && my >= cy && my < cy + h)
          return { area: 'column-locked', col, index: i };
      }
    }

    return null;
  }

  function hitTestColumn(mx, my) {
    for (let col = 0; col < COLUMN_COUNT; ++col) {
      const pile = columns[col];
      if (pile.length === 0)
        continue;
      const bx = columnX(col);
      const topY = COLUMNS_TOP;
      const botY = columnCardY(pile.length - 1) + CARD_H;
      if (mx >= bx && mx < bx + CARD_W && my >= topY && my < botY)
        return col;
    }
    return -1;
  }

  /* ================================================================
   *  DRAWING
   * ================================================================ */

  function drawGolf(cx, W, H) {
    const animSet = new Set();
    for (const a of animatingCards)
      animSet.add(a.card);

    // Title
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText('Golf Solitaire', 10, 8);

    // Score (top-right)
    cx.fillStyle = '#fff';
    cx.font = 'bold 16px sans-serif';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Score: ' + score, W - 20, 8);

    // Moves + cards remaining
    cx.font = '12px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.7)';
    cx.textAlign = 'right';
    let totalColumnCards = 0;
    for (const col of columns)
      totalColumnCards += col.length;
    cx.fillText('Moves: ' + moveCount + '  |  Remaining: ' + totalColumnCards + '  |  Stock: ' + stock.length, W - 20, 28);

    // Columns
    for (let c = 0; c < COLUMN_COUNT; ++c) {
      const pile = columns[c];
      const cx_ = columnX(c);

      if (pile.length === 0) {
        drawEmptySlot(cx, cx_, COLUMNS_TOP, null);
        continue;
      }

      for (let r = 0; r < pile.length; ++r) {
        const card = pile[r];
        if (animSet.has(card))
          continue;
        const cy = columnCardY(r);
        drawCardFace(cx, cx_, cy, card);

        // Highlight bottom card if playable
        if (r === pile.length - 1 && canPlayOnWaste(card) && !roundOver) {
          if (c === hoverCol)
            drawHoverHighlight(cx, cx_, cy);
          else
            drawPlayableHighlight(cx, cx_, cy);
          if (_host && _host.hintsEnabled && !animSet.has(card))
            CE.drawHintGlow(cx, cx_, cy, CARD_W, CARD_H, _host.hintTime);
        }
      }
    }

    // Stock pile
    if (stock.length > 0) {
      const stackCount = Math.min(Math.ceil(stock.length / 4), 4);
      for (let i = 0; i < stackCount; ++i)
        drawCardBack(cx, STOCK_X - i * 2, STOCK_Y - i * 2);

      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(stock.length + ' left', STOCK_X + CARD_W / 2, STOCK_Y + CARD_H + 4);
    } else
      drawEmptySlot(cx, STOCK_X, STOCK_Y, null);

    // Waste pile
    if (waste.length > 0) {
      const topWaste = waste[waste.length - 1];
      if (!animSet.has(topWaste))
        drawCardFace(cx, WASTE_X, WASTE_Y, topWaste);
    } else
      drawEmptySlot(cx, WASTE_X, WASTE_Y, null);

    // Animations
    drawAnimations(cx);

    // Particles
    if (CE && CE.updateAndDrawParticles)
      CE.updateAndDrawParticles(cx, particles);

    // Result message
    if (roundOver && resultMsg) {
      cx.save();

      cx.fillStyle = 'rgba(0,0,0,0.5)';
      const msgW = 420;
      const msgH = 80;
      const msgX = (W - msgW) / 2;
      const msgY = (H - msgH) / 2 + 40;
      drawRoundedRect(cx, msgX, msgY, msgW, msgH, 10);
      cx.fill();

      cx.fillStyle = '#fff';
      cx.font = 'bold 18px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(resultMsg, W / 2, msgY + 30);

      cx.font = '13px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.fillText('Click to continue', W / 2, msgY + 55);

      cx.restore();
    }

    // Instructions at bottom-right
    if (!roundOver) {
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'right';
      cx.textBaseline = 'bottom';
      cx.fillText('Click bottom card to play  |  Click stock to draw  |  Ctrl+Z to undo', W - 10, H - 8);
    }
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _canvas = canvas;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      newGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGolf(ctx, W, H);
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host)
          _host.onRoundOver(gameOver);
        return;
      }

      const hit = hitTest(mx, my);
      if (!hit)
        return;

      if (hit.area === 'stock') {
        dealFromStock();
        return;
      }

      if (hit.area === 'column') {
        playColumnCard(hit.col);
        return;
      }
    },

    handlePointerMove(mx, my) {
      const col = hitTestColumn(mx, my);
      if (col >= 0 && columns[col].length > 0 && canPlayOnWaste(columns[col][columns[col].length - 1]))
        hoverCol = col;
      else
        hoverCol = -1;
    },

    handlePointerUp(mx, my, e) {},

    handleKey(e) {
      if (roundOver || gameOver)
        return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
        return;
      }
      if (e.key === ' ' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        dealFromStock();
        return;
      }
      if (e.key >= '1' && e.key <= '7') {
        const col = parseInt(e.key, 10) - 1;
        playColumnCard(col);
        return;
      }
    },

    tick(dt) {
      if (CE && CE.updateParticles)
        CE.updateParticles(particles);
    },

    cleanup() {
      columns = [];
      stock = [];
      waste = [];
      cardsCleared = 0;
      moveCount = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      undoHistory = [];
      animatingCards = [];
      particles = [];
      hoverCol = -1;
      _ctx = null;
      _canvas = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('golf', module);

})();
