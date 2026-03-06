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

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  const PYRAMID_ROWS = 7;
  const PYRAMID_CARDS = 28;

  const ROW_OFFSET_Y = 38;
  const CARD_OVERLAP_X = 40;
  const PYRAMID_TOP_Y = 55;

  const STOCK_X = 40;
  const STOCK_Y = CANVAS_H - CARD_H - 40;
  const WASTE_X = STOCK_X + CARD_W + 16;
  const WASTE_Y = STOCK_Y;

  const NEW_DEAL_BTN = { x: CANVAS_W / 2 - 55, y: CANVAS_H / 2 + 40, w: 110, h: 36 };
  const HINT_BTN = { x: CANVAS_W - 100, y: STOCK_Y + CARD_H / 2 - 14, w: 72, h: 28 };

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let pyramid = [];       // 2D array: pyramid[row][col] = { card, removed }
  let stock = [];
  let waste = [];
  let score = 0;
  let pairsRemoved = 0;
  let roundOver = false;
  let gameOver = false;
  let selectedCard = null; // { source, row, col } or { source: 'waste' }
  let statusMsg = '';
  let moveCount = 0;
  let hintPair = null;
  let hintTimer = 0;
  let particles = [];

  let _ctx = null;
  let _canvas = null;
  let _host = null;

  /* ================================================================
   *  CARD VALUES (Pyramid rules: A=1 .. K=13)
   * ================================================================ */

  function pyramidValue(card) {
    return card.value + 1; // CE value is 0-based (A=0 .. K=12)
  }

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createAndShuffle() {
    return CE.shuffle(CE.createDeck());
  }

  /* ================================================================
   *  PYRAMID LAYOUT: compute card positions
   * ================================================================ */

  function pyramidCardPos(row, col) {
    const totalWidth = (PYRAMID_ROWS - 1) * CARD_OVERLAP_X + CARD_W;
    const rowWidth = row * CARD_OVERLAP_X + CARD_W;
    const startX = (CANVAS_W - totalWidth) / 2 + (PYRAMID_ROWS - 1 - row) * CARD_OVERLAP_X / 2;
    const x = startX + col * CARD_OVERLAP_X;
    const y = PYRAMID_TOP_Y + row * ROW_OFFSET_Y;
    return { x, y };
  }

  /* ================================================================
   *  EXPOSURE CHECK: a card is exposed if no covering cards below
   * ================================================================ */

  function isExposed(row, col) {
    if (row === PYRAMID_ROWS - 1)
      return true;
    const nextRow = row + 1;
    const leftChild = pyramid[nextRow][col];
    const rightChild = pyramid[nextRow][col + 1];
    return leftChild.removed && rightChild.removed;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = createAndShuffle();
    let cardIndex = 0;

    pyramid = [];
    for (let row = 0; row < PYRAMID_ROWS; ++row) {
      pyramid[row] = [];
      for (let col = 0; col <= row; ++col) {
        const card = deck[cardIndex++];
        card.faceUp = true;
        pyramid[row][col] = { card, removed: false };
      }
    }

    stock = [];
    for (let i = cardIndex; i < deck.length; ++i) {
      deck[i].faceUp = false;
      stock.push(deck[i]);
    }

    waste = [];
    pairsRemoved = 0;
    roundOver = false;
    gameOver = false;
    selectedCard = null;
    statusMsg = '';
    moveCount = 0;
    hintPair = null;
    hintTimer = 0;
    particles = [];

    if (_host) {
      _host.onScoreChanged(score);

      // Animate the initial deal
      for (let row = 0; row < PYRAMID_ROWS; ++row)
        for (let col = 0; col <= row; ++col) {
          const pos = pyramidCardPos(row, col);
          const card = pyramid[row][col].card;
          const delay = (row * (row + 1) / 2 + col) * 0.06;
          _host.dealCardAnim(card, CANVAS_W / 2, -CARD_H, pos.x, pos.y, delay);
        }
    }
  }

  /* ================================================================
   *  DRAW FROM STOCK
   * ================================================================ */

  function drawFromStock() {
    if (stock.length === 0)
      return;

    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
    ++moveCount;
    selectedCard = null;
    hintPair = null;
    checkGameOver();
  }

  /* ================================================================
   *  REMOVE A PAIR (or a lone King)
   * ================================================================ */

  function removePair(a, b) {
    // a and b are { source, row, col } or { source: 'waste' }
    // For a King, b is null
    removeCardFromPlay(a);
    if (b)
      removeCardFromPlay(b);

    ++pairsRemoved;
    ++moveCount;
    score += 10;

    if (_host) {
      _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, 'Pair! +10', { color: '#4f4', size: 20 });
      _host.onScoreChanged(score);
    }

    selectedCard = null;
    hintPair = null;

    // Check for pyramid cleared
    if (isPyramidCleared()) {
      score += 50;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Pyramid Cleared! +50', { color: '#ff0', size: 28 });
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
        _host.onScoreChanged(score);
      }
      roundOver = true;
      if (_host)
        _host.onRoundOver(false);
      return;
    }

    checkGameOver();
  }

  function removeCardFromPlay(sel) {
    if (sel.source === 'pyramid') {
      pyramid[sel.row][sel.col].removed = true;
      CE.spawnSparkle(particles, pyramidCardPos(sel.row, sel.col).x + CARD_W / 2, pyramidCardPos(sel.row, sel.col).y + CARD_H / 2);
    } else if (sel.source === 'waste') {
      waste.pop();
      CE.spawnSparkle(particles, WASTE_X + CARD_W / 2, WASTE_Y + CARD_H / 2);
    }
  }

  /* ================================================================
   *  PYRAMID CLEARED?
   * ================================================================ */

  function isPyramidCleared() {
    for (let row = 0; row < PYRAMID_ROWS; ++row)
      for (let col = 0; col <= row; ++col)
        if (!pyramid[row][col].removed)
          return false;
    return true;
  }

  /* ================================================================
   *  GAME OVER CHECK
   * ================================================================ */

  function checkGameOver() {
    if (roundOver || gameOver)
      return;

    if (hasAnyMove())
      return;

    // No moves left
    if (stock.length === 0) {
      roundOver = true;
      gameOver = true;
      statusMsg = 'No more moves!';
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'No More Moves!', { color: '#f44', size: 24 });
        _host.onRoundOver(true);
      }
    }
  }

  function hasAnyMove() {
    // Can draw from stock?
    if (stock.length > 0)
      return true;

    // Collect all exposed pyramid cards
    const exposed = getExposedCards();

    // Any exposed King?
    for (const e of exposed)
      if (pyramidValue(e.card) === 13)
        return true;

    // Waste top card is a King?
    const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;
    if (wasteTop && pyramidValue(wasteTop) === 13)
      return true;

    // Any pair among exposed cards?
    for (let i = 0; i < exposed.length; ++i)
      for (let j = i + 1; j < exposed.length; ++j)
        if (pyramidValue(exposed[i].card) + pyramidValue(exposed[j].card) === 13)
          return true;

    // Any exposed card + waste top = 13?
    if (wasteTop) {
      for (const e of exposed)
        if (pyramidValue(e.card) + pyramidValue(wasteTop) === 13)
          return true;
    }

    return false;
  }

  function getExposedCards() {
    const result = [];
    for (let row = 0; row < PYRAMID_ROWS; ++row)
      for (let col = 0; col <= row; ++col)
        if (!pyramid[row][col].removed && isExposed(row, col))
          result.push({ card: pyramid[row][col].card, row, col });
    return result;
  }

  /* ================================================================
   *  HINT GLOW CHECK: does this exposed card have a valid pair?
   * ================================================================ */

  function hasValidPair(row, col) {
    const card = pyramid[row][col].card;
    const val = pyramidValue(card);
    if (val === 13)
      return true;
    const need = 13 - val;
    const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;
    if (wasteTop && pyramidValue(wasteTop) === need)
      return true;
    for (let r = 0; r < PYRAMID_ROWS; ++r)
      for (let c = 0; c <= r; ++c) {
        if (pyramid[r][c].removed)
          continue;
        if (r === row && c === col)
          continue;
        if (!isExposed(r, c))
          continue;
        if (pyramidValue(pyramid[r][c].card) === need)
          return true;
      }
    return false;
  }

  function wasteHasValidPair() {
    if (waste.length === 0)
      return false;
    const wasteTop = waste[waste.length - 1];
    const val = pyramidValue(wasteTop);
    if (val === 13)
      return true;
    const need = 13 - val;
    for (let r = 0; r < PYRAMID_ROWS; ++r)
      for (let c = 0; c <= r; ++c) {
        if (pyramid[r][c].removed)
          continue;
        if (!isExposed(r, c))
          continue;
        if (pyramidValue(pyramid[r][c].card) === need)
          return true;
      }
    return false;
  }

  /* ================================================================
   *  HINT SYSTEM
   * ================================================================ */

  function findHint() {
    const exposed = getExposedCards();
    const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;

    // Exposed Kings
    for (const e of exposed)
      if (pyramidValue(e.card) === 13)
        return [{ source: 'pyramid', row: e.row, col: e.col }, null];

    // Waste King
    if (wasteTop && pyramidValue(wasteTop) === 13)
      return [{ source: 'waste' }, null];

    // Pairs among exposed
    for (let i = 0; i < exposed.length; ++i)
      for (let j = i + 1; j < exposed.length; ++j)
        if (pyramidValue(exposed[i].card) + pyramidValue(exposed[j].card) === 13)
          return [
            { source: 'pyramid', row: exposed[i].row, col: exposed[i].col },
            { source: 'pyramid', row: exposed[j].row, col: exposed[j].col }
          ];

    // Exposed + waste
    if (wasteTop) {
      for (const e of exposed)
        if (pyramidValue(e.card) + pyramidValue(wasteTop) === 13)
          return [
            { source: 'pyramid', row: e.row, col: e.col },
            { source: 'waste' }
          ];
    }

    return null;
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTest(mx, my) {
    // Check pyramid cards (bottom rows first for overlap priority)
    for (let row = PYRAMID_ROWS - 1; row >= 0; --row)
      for (let col = row; col >= 0; --col) {
        if (pyramid[row][col].removed)
          continue;
        if (!isExposed(row, col))
          continue;
        const pos = pyramidCardPos(row, col);
        if (mx >= pos.x && mx < pos.x + CARD_W && my >= pos.y && my < pos.y + CARD_H)
          return { area: 'pyramid', row, col, card: pyramid[row][col].card };
      }

    // Check waste top
    if (waste.length > 0) {
      if (mx >= WASTE_X && mx < WASTE_X + CARD_W && my >= WASTE_Y && my < WASTE_Y + CARD_H)
        return { area: 'waste', card: waste[waste.length - 1] };
    }

    // Check stock
    if (stock.length > 0) {
      if (mx >= STOCK_X && mx < STOCK_X + CARD_W && my >= STOCK_Y && my < STOCK_Y + CARD_H)
        return { area: 'stock' };
    }

    // Check hint button
    if (mx >= HINT_BTN.x && mx < HINT_BTN.x + HINT_BTN.w && my >= HINT_BTN.y && my < HINT_BTN.y + HINT_BTN.h)
      return { area: 'hint' };

    // Check new deal button (only when game is over)
    if ((roundOver || gameOver) && mx >= NEW_DEAL_BTN.x && mx < NEW_DEAL_BTN.x + NEW_DEAL_BTN.w && my >= NEW_DEAL_BTN.y && my < NEW_DEAL_BTN.y + NEW_DEAL_BTN.h)
      return { area: 'newdeal' };

    return null;
  }

  /* ================================================================
   *  SELECTION LOGIC
   * ================================================================ */

  function handleSelection(hit) {
    if (hit.area === 'stock') {
      drawFromStock();
      return;
    }

    if (hit.area === 'hint') {
      const hint = findHint();
      if (hint) {
        hintPair = hint;
        hintTimer = 2.0;
      } else {
        if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'No moves available', { color: '#f88', size: 18 });
      }
      return;
    }

    if (hit.area === 'newdeal') {
      if (_host)
        _host.onRoundOver(gameOver);
      return;
    }

    const card = hit.card;
    const val = pyramidValue(card);

    // King removes itself immediately
    if (val === 13) {
      const sel = hit.area === 'pyramid'
        ? { source: 'pyramid', row: hit.row, col: hit.col }
        : { source: 'waste' };
      removePair(sel, null);
      return;
    }

    const newSel = hit.area === 'pyramid'
      ? { source: 'pyramid', row: hit.row, col: hit.col, card }
      : { source: 'waste', card };

    // If there is already a selected card
    if (selectedCard) {
      const selVal = pyramidValue(selectedCard.card);
      const hitVal = val;

      // Same card clicked again: deselect
      if (isSameSelection(selectedCard, newSel)) {
        selectedCard = null;
        return;
      }

      // Check if they sum to 13
      if (selVal + hitVal === 13) {
        const a = { source: selectedCard.source };
        if (selectedCard.source === 'pyramid') {
          a.row = selectedCard.row;
          a.col = selectedCard.col;
        }
        const b = { source: newSel.source };
        if (newSel.source === 'pyramid') {
          b.row = newSel.row;
          b.col = newSel.col;
        }
        removePair(a, b);
        return;
      }

      // Not a valid pair; select the new card instead
      if (_host)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H - 100, 'Must sum to 13!', { color: '#f88', size: 16 });
      selectedCard = newSel;
      return;
    }

    // No previous selection
    selectedCard = newSel;
  }

  function isSameSelection(a, b) {
    if (a.source !== b.source)
      return false;
    if (a.source === 'pyramid')
      return a.row === b.row && a.col === b.col;
    return true; // both waste
  }

  /* ================================================================
   *  DRAWING - Selection Highlight
   * ================================================================ */

  function drawSelectionGlow(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#ffff00';
    cx.lineWidth = 3;
    cx.shadowColor = '#ffff00';
    cx.shadowBlur = 10;
    CE.drawRoundedRect(cx, x - 2, y - 2, CARD_W + 4, CARD_H + 4, CE.CARD_RADIUS + 2);
    cx.stroke();
    cx.restore();
  }

  function drawHintGlow(cx, x, y) {
    cx.save();
    cx.strokeStyle = '#00ff88';
    cx.lineWidth = 2;
    cx.shadowColor = '#00ff88';
    cx.shadowBlur = 8;
    CE.drawRoundedRect(cx, x - 2, y - 2, CARD_W + 4, CARD_H + 4, CE.CARD_RADIUS + 2);
    cx.stroke();
    cx.restore();
  }

  /* ================================================================
   *  DRAWING - Button
   * ================================================================ */

  function drawButton(cx, x, y, w, h, label, opts) {
    const bg = (opts && opts.bg) || '#1a3a1a';
    const border = (opts && opts.border) || '#4a4';
    const textColor = (opts && opts.textColor) || '#fff';
    const fontSize = (opts && opts.fontSize) || 14;
    cx.fillStyle = bg;
    cx.strokeStyle = border;
    cx.lineWidth = 2;
    CE.drawRoundedRect(cx, x, y, w, h, 6);
    cx.fill();
    cx.stroke();
    cx.fillStyle = textColor;
    cx.font = 'bold ' + fontSize + 'px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(label, x + w / 2, y + h / 2);
  }

  /* ================================================================
   *  MAIN DRAW
   * ================================================================ */

  function drawScene(cx, W, H) {
    // Draw pyramid
    for (let row = 0; row < PYRAMID_ROWS; ++row)
      for (let col = 0; col <= row; ++col) {
        const entry = pyramid[row][col];
        if (entry.removed)
          continue;
        if (entry.card._dealing)
          continue;

        const pos = pyramidCardPos(row, col);
        const exposed = isExposed(row, col);

        // Draw card
        CE.drawCardFace(cx, pos.x, pos.y, entry.card);

        // Dim non-exposed cards
        if (!exposed) {
          cx.save();
          cx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          CE.drawRoundedRect(cx, pos.x, pos.y, CARD_W, CARD_H, CE.CARD_RADIUS);
          cx.fill();
          cx.restore();
        }

        // Selection highlight
        if (selectedCard && selectedCard.source === 'pyramid' && selectedCard.row === row && selectedCard.col === col)
          drawSelectionGlow(cx, pos.x, pos.y);

        // Hint highlight
        if (hintTimer > 0 && hintPair) {
          for (const h of hintPair) {
            if (h && h.source === 'pyramid' && h.row === row && h.col === col)
              drawHintGlow(cx, pos.x, pos.y);
          }
        }

        // Hint glow for cards with valid pairs
        if (_host && _host.hintsEnabled && exposed && !roundOver && !gameOver && hasValidPair(row, col))
          CE.drawHintGlow(cx, pos.x, pos.y, CARD_W, CARD_H, _host.hintTime);
      }

    // Draw stock pile
    if (stock.length > 0) {
      CE.drawCardBack(cx, STOCK_X, STOCK_Y);

      // Show count
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.7)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText(stock.length + ' left', STOCK_X + CARD_W / 2, STOCK_Y + CARD_H + 4);
    } else {
      CE.drawEmptySlot(cx, STOCK_X, STOCK_Y, null);
      cx.font = '10px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillText('Empty', STOCK_X + CARD_W / 2, STOCK_Y + CARD_H + 4);
    }

    // Draw waste pile
    if (waste.length > 0) {
      const top = waste[waste.length - 1];
      CE.drawCardFace(cx, WASTE_X, WASTE_Y, top);

      // Selection highlight on waste
      if (selectedCard && selectedCard.source === 'waste')
        drawSelectionGlow(cx, WASTE_X, WASTE_Y);

      // Hint highlight on waste
      if (hintTimer > 0 && hintPair) {
        for (const h of hintPair) {
          if (h && h.source === 'waste')
            drawHintGlow(cx, WASTE_X, WASTE_Y);
        }
      }

      // Hint glow for waste top card with valid pair
      if (_host && _host.hintsEnabled && !roundOver && !gameOver && wasteHasValidPair())
        CE.drawHintGlow(cx, WASTE_X, WASTE_Y, CARD_W, CARD_H, _host.hintTime);
    } else
      CE.drawEmptySlot(cx, WASTE_X, WASTE_Y, null);

    // Labels
    cx.font = '11px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.textAlign = 'center';
    cx.textBaseline = 'bottom';
    cx.fillText('Stock', STOCK_X + CARD_W / 2, STOCK_Y - 4);
    cx.fillText('Waste', WASTE_X + CARD_W / 2, WASTE_Y - 4);

    // Score display (top-right)
    cx.font = 'bold 16px sans-serif';
    cx.fillStyle = '#fa0';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Score: ' + score, CANVAS_W - 20, 12);

    cx.font = '12px sans-serif';
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.fillText('Pairs: ' + pairsRemoved, CANVAS_W - 20, 34);
    cx.fillText('Moves: ' + moveCount, CANVAS_W - 20, 50);

    // Hint button
    if (!roundOver && !gameOver)
      drawButton(cx, HINT_BTN.x, HINT_BTN.y, HINT_BTN.w, HINT_BTN.h, 'Hint (H)', { bg: '#2a4a5a', border: '#6ac', fontSize: 11 });

    // Help text
    if (selectedCard && !roundOver && !gameOver) {
      const val = pyramidValue(selectedCard.card);
      const need = 13 - val;
      cx.font = '13px sans-serif';
      cx.fillStyle = '#ff8';
      cx.textAlign = 'center';
      cx.textBaseline = 'bottom';
      cx.fillText('Selected ' + selectedCard.card.rank + ' (value ' + val + ') \u2014 find a ' + need + ' to pair', CANVAS_W / 2, CANVAS_H - 8);
    } else if (!roundOver && !gameOver) {
      cx.font = '12px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'center';
      cx.textBaseline = 'bottom';
      cx.fillText('Remove pairs that sum to 13. Kings remove alone. Click stock to draw.', CANVAS_W / 2, CANVAS_H - 8);
    }

    // Game over / round over overlay
    if (roundOver || gameOver) {
      cx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      cx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      cx.font = 'bold 28px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';

      if (isPyramidCleared()) {
        cx.fillStyle = '#4f4';
        cx.fillText('Pyramid Cleared!', CANVAS_W / 2, CANVAS_H / 2 - 20);
      } else {
        cx.fillStyle = '#f66';
        cx.fillText('No More Moves', CANVAS_W / 2, CANVAS_H / 2 - 20);
      }

      cx.font = '16px sans-serif';
      cx.fillStyle = '#fa0';
      cx.fillText('Score: ' + score, CANVAS_W / 2, CANVAS_H / 2 + 10);

      drawButton(cx, NEW_DEAL_BTN.x, NEW_DEAL_BTN.y, NEW_DEAL_BTN.w, NEW_DEAL_BTN.h, 'Continue', { bg: '#2a5a2a', border: '#6c6' });
    }

    // Particles
    CE.updateAndDrawParticles(cx, particles);
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
      drawScene(ctx, W, H);
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        const hit = hitTest(mx, my);
        if (hit && hit.area === 'newdeal') {
          if (_host)
            _host.onRoundOver(gameOver);
          return;
        }
        // Click anywhere else also continues
        if (_host)
          _host.onRoundOver(gameOver);
        return;
      }

      const hit = hitTest(mx, my);
      if (!hit) {
        selectedCard = null;
        return;
      }

      handleSelection(hit);
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (roundOver || gameOver)
        return;

      if (e.key === 'h' || e.key === 'H') {
        const hint = findHint();
        if (hint) {
          hintPair = hint;
          hintTimer = 2.0;
        } else if (_host)
          _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'No moves available', { color: '#f88', size: 18 });
        return;
      }

      if (e.key === 'Escape') {
        selectedCard = null;
        return;
      }

      // Space or Enter to draw from stock
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        drawFromStock();
      }
    },

    tick(dt) {
      if (hintTimer > 0) {
        hintTimer -= dt;
        if (hintTimer <= 0) {
          hintPair = null;
          hintTimer = 0;
        }
      }
    },

    cleanup() {
      pyramid = [];
      stock = [];
      waste = [];
      score = 0;
      pairsRemoved = 0;
      roundOver = false;
      gameOver = false;
      selectedCard = null;
      statusMsg = '';
      moveCount = 0;
      hintPair = null;
      hintTimer = 0;
      particles = [];
      _ctx = null;
      _canvas = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('pyramid', module);

})();
