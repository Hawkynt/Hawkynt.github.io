;(function() {
  'use strict';

  /* Forty Thieves: game rules - dealing, legal moves, undo, timer, auto-moves and
     win detection. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.fortythieves;
  const S = V.S;
  const {
    CE, TABLEAU_COUNT, FOUNDATION_COUNT, MAX_UNDO, stockPos, wastePos, foundationPos,
    tableauCardPos
  } = V;

  /* ================================================================
   *  DECK (2 standard decks = 104 cards)
   * ================================================================ */

  function createDoubleDeck() {
    const deck = [];
    for (let d = 0; d < 2; ++d)
      for (const suit of CE.SUITS)
        for (const rank of CE.RANKS)
          deck.push(CE.makeCard(suit, rank));
    return deck;
  }

  /* ================================================================
   *  TIMER
   * ================================================================ */

  function startTimer() {
    if (S.timerInterval)
      return;
    S.gameStarted = true;
    S.timerInterval = setInterval(() => { ++S.timerSeconds; }, 1000);
  }

  function stopTimer() {
    if (S.timerInterval) {
      clearInterval(S.timerInterval);
      S.timerInterval = null;
    }
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const snap = c => ({ suit: c.suit, rank: c.rank, faceUp: c.faceUp });
    const state = {
      stock: S.stock.map(snap),
      waste: S.waste.map(snap),
      foundations: S.foundations.map(f => f.map(snap)),
      tableau: S.tableau.map(t => t.map(snap)),
      moveCount: S.moveCount,
      score: S.score
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreCard(c) {
    const card = CE.makeCard(c.suit, c.rank);
    card.faceUp = c.faceUp;
    return card;
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    S.stock = s.stock.map(restoreCard);
    S.waste = s.waste.map(restoreCard);
    S.foundations = s.foundations.map(f => f.map(restoreCard));
    S.tableau = s.tableau.map(t => t.map(restoreCard));
    S.moveCount = s.moveCount;
    S.score = s.score;
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
    S.statusMsg = '';
  }

  /* ================================================================
   *  GAME RULES
   * ================================================================ */

  function canPlaceOnFoundation(card, fi) {
    const pile = S.foundations[fi];
    if (pile.length === 0)
      return card.value === 0; // Ace only
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.value === top.value + 1;
  }

  function canPlaceOnTableau(card, col) {
    const pile = S.tableau[col];
    if (pile.length === 0)
      return true; // any card fills empty column
    const top = pile[pile.length - 1];
    // Forty Thieves: build down by SAME suit
    return card.suit === top.suit && card.value === top.value - 1;
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
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    V.stopWinAnimation();
    stopTimer();
    S.dealAnimCards = [];
    S.dealAnimRunning = false;
    S.animatingCards = [];

    const deck = CE.shuffle(createDoubleDeck());

    S.stock = [];
    S.waste = [];
    S.foundations = [];
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      S.foundations.push([]);
    S.tableau = [];
    for (let i = 0; i < TABLEAU_COUNT; ++i)
      S.tableau.push([]);

    S.moveCount = 0;
    S.score = 0;
    S.timerSeconds = 0;
    S.gameStarted = false;
    S.gameWon = false;
    S.undoHistory = [];
    S.dragging = null;
    S.statusMsg = 'Forty Thieves  |  Build foundations up by suit, tableau down by suit';

    // Deal 4 face-up cards to each of 10 tableau columns (40 cards = "forty thieves")
    let cardIdx = 0;
    for (let row = 0; row < 4; ++row)
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const card = deck[cardIdx++];
        card.faceUp = true;
        S.tableau[col].push(card);
      }

    // Remaining 64 cards go to stock
    for (let i = cardIdx; i < deck.length; ++i) {
      deck[i].faceUp = false;
      S.stock.push(deck[i]);
    }

    V.startDealAnimation();
  }

  /* ================================================================
   *  STOCK DEALING (one card at a time, no recycle)
   * ================================================================ */

  function dealFromStock() {
    if (S.stock.length === 0)
      return;

    if (!S.gameStarted)
      startTimer();

    saveState();

    const card = S.stock.pop();
    card.faceUp = true;
    S.waste.push(card);
    ++S.moveCount;

    const sp = stockPos();
    const wp = wastePos();
    V.startCardMoveAnim(card, sp.x, sp.y, wp.x, wp.y, null);
  }

  /* ================================================================
   *  AUTO-MOVE TO FOUNDATION (double-click)
   * ================================================================ */

  function autoMoveToFoundation(card, sourceType, sourceCol, sourceIndex) {
    const fi = findFoundationTarget(card);
    if (fi < 0)
      return false;

    if (!S.gameStarted)
      startTimer();
    saveState();

    let fromX, fromY;
    if (sourceType === 'waste') {
      const wp = wastePos();
      fromX = wp.x;
      fromY = wp.y;
      S.waste.splice(sourceIndex, 1);
    } else if (sourceType === 'tableau') {
      const pos = tableauCardPos(sourceCol, sourceIndex);
      fromX = pos.x;
      fromY = pos.y;
      S.tableau[sourceCol].splice(sourceIndex, 1);
    }

    card.faceUp = true;
    S.foundations[fi].push(card);
    ++S.moveCount;
    S.score += 10;

    const fp = foundationPos(fi);
    V.startCardMoveAnim(card, fromX, fromY, fp.x, fp.y, () => {
      checkWin();
    });

    if (S._host && S._host.onScoreChanged)
      S._host.onScoreChanged(S.score);

    return true;
  }

  /* ================================================================
   *  isDragSource helper
   * ================================================================ */

  function isDragSource(type, index) {
    if (!S.dragging)
      return false;
    if (type === 'waste' && S.dragging.source === 'waste')
      return index === S.dragging.sourceIndex;
    if (type === 'tableau' && S.dragging.source === 'tableau' && S.dragging.sourceCol === index)
      return true;
    return false;
  }

  /* ================================================================
   *  WIN DETECTION + AUTO-COMPLETE
   * ================================================================ */

  function foundationTotal() {
    let total = 0;
    for (let i = 0; i < FOUNDATION_COUNT; ++i)
      total += S.foundations[i].length;
    return total;
  }

  function checkWin() {
    if (foundationTotal() === 104) {
      doWin();
      return;
    }

    if (canAutoComplete()) {
      S.statusMsg = 'Auto-completing...';
      autoComplete();
    }
  }

  function canAutoComplete() {
    if (S.stock.length > 0 || S.waste.length > 0)
      return false;
    // All tableau cards must be face-up and in descending same-suit order
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      for (let i = 0; i < pile.length - 1; ++i) {
        if (pile[i].suit !== pile[i + 1].suit || pile[i].value !== pile[i + 1].value + 1)
          return false;
      }
    }
    return true;
  }

  function autoComplete() {
    const step = () => {
      let moved = false;
      for (let col = 0; col < TABLEAU_COUNT; ++col) {
        const pile = S.tableau[col];
        if (pile.length === 0)
          continue;
        const card = pile[pile.length - 1];
        const fi = findFoundationTarget(card);
        if (fi >= 0) {
          const fromPos = tableauCardPos(col, pile.length - 1);
          pile.pop();
          S.foundations[fi].push(card);
          ++S.moveCount;
          S.score += 10;
          moved = true;

          const toPos = foundationPos(fi);
          V.startCardMoveAnim(card, fromPos.x, fromPos.y, toPos.x, toPos.y, () => {
            if (foundationTotal() === 104)
              doWin();
            else
              setTimeout(step, 30);
          });
          break;
        }
      }
      if (!moved) {
        // Try waste as well
        if (S.waste.length > 0) {
          const card = S.waste[S.waste.length - 1];
          const fi = findFoundationTarget(card);
          if (fi >= 0) {
            const wp = wastePos();
            S.waste.pop();
            S.foundations[fi].push(card);
            ++S.moveCount;
            S.score += 10;

            const toPos = foundationPos(fi);
            V.startCardMoveAnim(card, wp.x, wp.y, toPos.x, toPos.y, () => {
              if (foundationTotal() === 104)
                doWin();
              else
                setTimeout(step, 30);
            });
          }
        }
      }
    };
    setTimeout(step, 200);
  }

  function doWin() {
    S.gameWon = true;
    stopTimer();
    S.statusMsg = 'Congratulations! You won in ' + S.moveCount + ' moves! Score: ' + S.score;
    if (S._host && S._host.onRoundOver)
      S._host.onRoundOver(true);
    if (S._host && S._host.particles)
      S._host.particles.confetti(S.canvasW / S.scale / 2, S.canvasH / S.scale / 3, 80);
    V.startWinAnimation();
  }

  /* ================================================================
   *  HINT SYSTEM
   * ================================================================ */

  function findHints() {
    const hints = [];

    // Check waste top card
    if (S.waste.length > 0) {
      const card = S.waste[S.waste.length - 1];
      if (findFoundationTarget(card) >= 0)
        hints.push({ source: 'waste', card });
      for (let c = 0; c < TABLEAU_COUNT; ++c)
        if (canPlaceOnTableau(card, c))
          hints.push({ source: 'waste', card, target: 'tableau', col: c });
    }

    // Check tableau top cards
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      if (pile.length === 0)
        continue;
      const card = pile[pile.length - 1];
      if (findFoundationTarget(card) >= 0)
        hints.push({ source: 'tableau', col, card });
      for (let c = 0; c < TABLEAU_COUNT; ++c) {
        if (c === col)
          continue;
        if (canPlaceOnTableau(card, c))
          hints.push({ source: 'tableau', col, card, target: 'tableau', targetCol: c });
      }
    }

    return hints;
  }

  /* ================================================================
   *  DETECT STALEMATE
   * ================================================================ */

  function isStalemate() {
    // Can we deal from stock?
    if (S.stock.length > 0)
      return false;

    // Can waste card move anywhere?
    if (S.waste.length > 0) {
      const card = S.waste[S.waste.length - 1];
      if (findFoundationTarget(card) >= 0)
        return false;
      for (let c = 0; c < TABLEAU_COUNT; ++c)
        if (canPlaceOnTableau(card, c))
          return false;
    }

    // Can any tableau top card move?
    for (let col = 0; col < TABLEAU_COUNT; ++col) {
      const pile = S.tableau[col];
      if (pile.length === 0)
        continue;
      const card = pile[pile.length - 1];
      if (findFoundationTarget(card) >= 0)
        return false;
      for (let c = 0; c < TABLEAU_COUNT; ++c) {
        if (c === col)
          continue;
        if (canPlaceOnTableau(card, c))
          return false;
      }
    }

    return true;
  }

  Object.assign(V, {
    startTimer, stopTimer, saveState, doUndo, canPlaceOnFoundation, canPlaceOnTableau,
    hasAnyValidMove, newGame, dealFromStock, autoMoveToFoundation, isDragSource, checkWin,
    findHints, isStalemate
  });

})();
