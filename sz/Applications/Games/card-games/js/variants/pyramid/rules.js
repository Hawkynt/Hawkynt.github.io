;(function() {
  'use strict';

  /* Pyramid: card values, pyramid layout and exposure, dealing, pair removal, game end
     and hint search. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.pyramid;
  const S = V.S;
  const {
    CE, CARD_W, CARD_H, CANVAS_W, CANVAS_H, PYRAMID_ROWS, ROW_OFFSET_Y, CARD_OVERLAP_X,
    PYRAMID_TOP_Y, WASTE_X, WASTE_Y
  } = V;

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
    const leftChild = S.pyramid[nextRow][col];
    const rightChild = S.pyramid[nextRow][col + 1];
    return leftChild.removed && rightChild.removed;
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = createAndShuffle();
    let cardIndex = 0;

    S.pyramid = [];
    for (let row = 0; row < PYRAMID_ROWS; ++row) {
      S.pyramid[row] = [];
      for (let col = 0; col <= row; ++col) {
        const card = deck[cardIndex++];
        card.faceUp = true;
        S.pyramid[row][col] = { card, removed: false };
      }
    }

    S.stock = [];
    for (let i = cardIndex; i < deck.length; ++i) {
      deck[i].faceUp = false;
      S.stock.push(deck[i]);
    }

    S.waste = [];
    S.pairsRemoved = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.selectedCard = null;
    S.statusMsg = '';
    S.moveCount = 0;
    S.hintPair = null;
    S.hintTimer = 0;
    S.particles = [];

    if (S._host) {
      S._host.onScoreChanged(S.score);

      // Animate the initial deal
      for (let row = 0; row < PYRAMID_ROWS; ++row)
        for (let col = 0; col <= row; ++col) {
          const pos = pyramidCardPos(row, col);
          const card = S.pyramid[row][col].card;
          const delay = (row * (row + 1) / 2 + col) * 0.06;
          S._host.dealCardAnim(card, CANVAS_W / 2, -CARD_H, pos.x, pos.y, delay);
        }
    }
  }

  /* ================================================================
   *  DRAW FROM STOCK
   * ================================================================ */

  function drawFromStock() {
    if (S.stock.length === 0)
      return;

    const card = S.stock.pop();
    card.faceUp = true;
    S.waste.push(card);
    ++S.moveCount;
    S.selectedCard = null;
    S.hintPair = null;
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

    ++S.pairsRemoved;
    ++S.moveCount;
    S.score += 10;

    if (S._host) {
      S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, 'Pair! +10', { color: '#4f4', size: 20 });
      S._host.onScoreChanged(S.score);
    }

    S.selectedCard = null;
    S.hintPair = null;

    // Check for pyramid cleared
    if (isPyramidCleared()) {
      S.score += 50;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Pyramid Cleared! +50', { color: '#ff0', size: 28 });
        S._host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 40);
        S._host.onScoreChanged(S.score);
      }
      S.roundOver = true;
      if (S._host)
        S._host.onRoundOver(false);
      return;
    }

    checkGameOver();
  }

  function removeCardFromPlay(sel) {
    if (sel.source === 'pyramid') {
      S.pyramid[sel.row][sel.col].removed = true;
      CE.spawnSparkle(S.particles, pyramidCardPos(sel.row, sel.col).x + CARD_W / 2, pyramidCardPos(sel.row, sel.col).y + CARD_H / 2);
    } else if (sel.source === 'waste') {
      S.waste.pop();
      CE.spawnSparkle(S.particles, WASTE_X + CARD_W / 2, WASTE_Y + CARD_H / 2);
    }
  }

  /* ================================================================
   *  PYRAMID CLEARED?
   * ================================================================ */

  function isPyramidCleared() {
    for (let row = 0; row < PYRAMID_ROWS; ++row)
      for (let col = 0; col <= row; ++col)
        if (!S.pyramid[row][col].removed)
          return false;
    return true;
  }

  /* ================================================================
   *  GAME OVER CHECK
   * ================================================================ */

  function checkGameOver() {
    if (S.roundOver || S.gameOver)
      return;

    if (hasAnyMove())
      return;

    // No moves left
    if (S.stock.length === 0) {
      S.roundOver = true;
      S.gameOver = true;
      S.statusMsg = 'No more moves!';
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'No More Moves!', { color: '#f44', size: 24 });
        S._host.onRoundOver(true);
      }
    }
  }

  function hasAnyMove() {
    // Can draw from stock?
    if (S.stock.length > 0)
      return true;

    // Collect all exposed pyramid cards
    const exposed = getExposedCards();

    // Any exposed King?
    for (const e of exposed)
      if (pyramidValue(e.card) === 13)
        return true;

    // Waste top card is a King?
    const wasteTop = S.waste.length > 0 ? S.waste[S.waste.length - 1] : null;
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
        if (!S.pyramid[row][col].removed && isExposed(row, col))
          result.push({ card: S.pyramid[row][col].card, row, col });
    return result;
  }

  /* ================================================================
   *  HINT GLOW CHECK: does this exposed card have a valid pair?
   * ================================================================ */

  function hasValidPair(row, col) {
    const card = S.pyramid[row][col].card;
    const val = pyramidValue(card);
    if (val === 13)
      return true;
    const need = 13 - val;
    const wasteTop = S.waste.length > 0 ? S.waste[S.waste.length - 1] : null;
    if (wasteTop && pyramidValue(wasteTop) === need)
      return true;
    for (let r = 0; r < PYRAMID_ROWS; ++r)
      for (let c = 0; c <= r; ++c) {
        if (S.pyramid[r][c].removed)
          continue;
        if (r === row && c === col)
          continue;
        if (!isExposed(r, c))
          continue;
        if (pyramidValue(S.pyramid[r][c].card) === need)
          return true;
      }
    return false;
  }

  function wasteHasValidPair() {
    if (S.waste.length === 0)
      return false;
    const wasteTop = S.waste[S.waste.length - 1];
    const val = pyramidValue(wasteTop);
    if (val === 13)
      return true;
    const need = 13 - val;
    for (let r = 0; r < PYRAMID_ROWS; ++r)
      for (let c = 0; c <= r; ++c) {
        if (S.pyramid[r][c].removed)
          continue;
        if (!isExposed(r, c))
          continue;
        if (pyramidValue(S.pyramid[r][c].card) === need)
          return true;
      }
    return false;
  }

  /* ================================================================
   *  HINT SYSTEM
   * ================================================================ */

  function findHint() {
    const exposed = getExposedCards();
    const wasteTop = S.waste.length > 0 ? S.waste[S.waste.length - 1] : null;

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

  Object.assign(V, {
    pyramidValue, pyramidCardPos, isExposed, newGame, drawFromStock, removePair, isPyramidCleared,
    hasValidPair, wasteHasValidPair, findHint
  });

})();
