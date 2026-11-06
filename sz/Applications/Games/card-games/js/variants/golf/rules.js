;(function() {
  'use strict';

  /* Golf: column layout, rank rules (+/-1 onto the waste), undo, playing and dealing,
     game end and hit testing. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.golf;
  const S = V.S;
  const {
    CE, CANVAS_W, CANVAS_H, CARD_W, CARD_H, COLUMN_COUNT, CARDS_PER_COLUMN, CARD_OVERLAP, RANKS,
    MAX_UNDO, COLUMN_GAP, COLUMNS_LEFT, COLUMNS_TOP, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y
  } = V;
  const { createDeck, shuffle } = SZ.CardGames.shared.solitaireFallback;

  function columnX(col) {
    return COLUMNS_LEFT + col * (CARD_W + COLUMN_GAP);
  }

  function columnCardY(row) {
    return COLUMNS_TOP + row * CARD_OVERLAP;
  }

  /* ================================================================
   *  RANK HELPERS
   * ================================================================ */

  function rankIndex(card) {
    return card.value !== undefined ? card.value : RANKS.indexOf(card.rank);
  }

  function canPlayOnWaste(card) {
    if (S.waste.length === 0)
      return false;
    const top = S.waste[S.waste.length - 1];
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
      columns: S.columns.map(col => col.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp }))),
      stock: S.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      waste: S.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp })),
      score: S.score,
      cardsCleared: S.cardsCleared,
      moveCount: S.moveCount
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
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
    S.columns = s.columns.map(col => col.map(restoreCard));
    S.stock = s.stock.map(restoreCard);
    S.waste = s.waste.map(restoreCard);
    S.score = s.score;
    S.cardsCleared = s.cardsCleared;
    S.moveCount = s.moveCount;
  }

  function doUndo() {
    if (S.undoHistory.length === 0 || S.roundOver || S.gameOver)
      return;
    restoreState(S.undoHistory.pop());
    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
  }

  /* ================================================================
   *  ANIMATIONS
   * ================================================================ */

  function startCardMoveAnim(card, fromX, fromY, toX, toY, onDone) {
    S.animatingCards.push({
      card, fromX, fromY, toX, toY,
      startTime: performance.now(),
      duration: 250,
      onDone
    });
  }

  /* ================================================================
   *  GAME LOGIC
   * ================================================================ */

  function checkGameEnd() {
    let totalColumnCards = 0;
    for (const col of S.columns)
      totalColumnCards += col.length;

    if (totalColumnCards === 0) {
      S.roundOver = true;
      S.gameOver = false;
      S.score += 50;
      S.resultMsg = 'All columns cleared! +50 bonus! Score: ' + S.score;
      if (S._host && S._host.floatingText)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'CLEARED! +50', { color: '#4f4', size: 28 });
      if (S._host && S._host.particles)
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 3, 40);
      if (S._host && S._host.onScoreChanged)
        S._host.onScoreChanged(S.score);
      if (S._host && S._host.onRoundOver)
        S._host.onRoundOver(false);
      return true;
    }

    let anyPlayable = false;
    for (const col of S.columns) {
      if (col.length > 0 && canPlayOnWaste(col[col.length - 1])) {
        anyPlayable = true;
        break;
      }
    }

    if (!anyPlayable && S.stock.length === 0) {
      S.roundOver = true;
      S.gameOver = totalColumnCards > 0;
      S.resultMsg = totalColumnCards + ' card' + (totalColumnCards !== 1 ? 's' : '') + ' remaining. Score: ' + S.score;
      if (S._host && S._host.floatingText)
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 3, 'No more moves!', { color: '#f88', size: 24 });
      if (S._host && S._host.onScoreChanged)
        S._host.onScoreChanged(S.score);
      if (S._host && S._host.onRoundOver)
        S._host.onRoundOver(S.gameOver);
      return true;
    }

    return false;
  }

  function playColumnCard(col) {
    if (col < 0 || col >= COLUMN_COUNT || S.columns[col].length === 0)
      return false;

    const card = S.columns[col][S.columns[col].length - 1];
    if (!canPlayOnWaste(card))
      return false;

    saveState();

    const fromX = columnX(col);
    const fromY = columnCardY(S.columns[col].length - 1);

    S.columns[col].pop();
    card.faceUp = true;
    S.waste.push(card);
    ++S.cardsCleared;
    ++S.moveCount;
    S.score += 5;

    startCardMoveAnim(card, fromX, fromY, WASTE_X, WASTE_Y, () => {
      checkGameEnd();
    });

    if (S._host && S._host.floatingText)
      S._host.floatingText.add(fromX + CARD_W / 2, fromY, '+5', { color: '#4f4', size: 18 });
    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);

    return true;
  }

  function dealFromStock() {
    if (S.stock.length === 0)
      return false;

    saveState();

    const card = S.stock.pop();
    card.faceUp = true;
    S.waste.push(card);
    ++S.moveCount;

    if (S._host && S._host.dealCardAnim)
      S._host.dealCardAnim(card, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y, 0);
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

    S.columns = [];
    for (let c = 0; c < COLUMN_COUNT; ++c) {
      S.columns.push([]);
      for (let r = 0; r < CARDS_PER_COLUMN; ++r) {
        const card = deck.pop();
        card.faceUp = true;
        S.columns[c].push(card);
      }
    }

    S.waste = [];
    const firstWaste = deck.pop();
    firstWaste.faceUp = true;
    S.waste.push(firstWaste);

    S.stock = [];
    while (deck.length > 0) {
      const card = deck.pop();
      card.faceUp = false;
      S.stock.push(card);
    }

    S.cardsCleared = 0;
    S.moveCount = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.resultMsg = '';
    S.undoHistory = [];
    S.animatingCards = [];
    S.particles = [];
    S.hoverCol = -1;

    if (S._host && S._host.dealCardAnim) {
      for (let c = 0; c < COLUMN_COUNT; ++c)
        for (let r = 0; r < CARDS_PER_COLUMN; ++r) {
          const card = S.columns[c][r];
          const tx = columnX(c);
          const ty = columnCardY(r);
          S._host.dealCardAnim(card, CANVAS_W / 2, -CARD_H, tx, ty, (c * CARDS_PER_COLUMN + r) * 0.04);
        }
    }

    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);
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
      const pile = S.columns[col];
      if (pile.length === 0)
        continue;
      const bottomIdx = pile.length - 1;
      const bx = columnX(col);
      const by = columnCardY(bottomIdx);
      if (mx >= bx && mx < bx + CARD_W && my >= by && my < by + CARD_H)
        return { area: 'column', col };
    }

    for (let col = 0; col < COLUMN_COUNT; ++col) {
      const pile = S.columns[col];
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
      const pile = S.columns[col];
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

  Object.assign(V, {
    columnX, columnCardY, canPlayOnWaste, doUndo, playColumnCard, dealFromStock, newGame, hitTest,
    hitTestColumn
  });

})();
