;(function() {
  'use strict';

  /* TriPeaks: peak layout, exposure and wrap-around rank rules, undo, dealing, playing,
     game end, sparkle particles and hit testing. */

  const SZ = window.SZ;
  const V = SZ.CardGames.v.tripeaks;
  const S = V.S;
  const {
    CE, CANVAS_W, CANVAS_H, MAX_UNDO, PEAK_OVERLAP_X, ROW0_Y, ROW1_Y, ROW2_Y, ROW3_Y, PEAK_WIDTH,
    START_X, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y
  } = V;

  /* ================================================================
   *  RANK HELPERS
   * ================================================================ */

  function rankIndex(rank) {
    return CE.RANKS.indexOf(rank);
  }

  /* ================================================================
   *  RANK ADJACENCY (wrapping K<->A)
   * ================================================================ */

  function isAdjacentRank(r1, r2) {
    const v1 = rankIndex(r1);
    const v2 = rankIndex(r2);
    const diff = Math.abs(v1 - v2);
    return diff === 1 || diff === 12;
  }

  function peakBaseX(peakIdx) {
    return START_X + peakIdx * (PEAK_WIDTH - PEAK_OVERLAP_X);
  }

  // Build the 28-card layout positions
  function buildLayout() {
    const layout = [];

    for (let p = 0; p < 3; ++p) {
      const bx = peakBaseX(p);

      // Row 0: 1 card (centered above row 1)
      layout.push({
        peak: p, row: 0, col: 0,
        x: bx + 1.5 * PEAK_OVERLAP_X,
        y: ROW0_Y,
        faceUp: false,
        children: []    // indices of cards this one covers
      });

      // Row 1: 2 cards
      for (let c = 0; c < 2; ++c) {
        layout.push({
          peak: p, row: 1, col: c,
          x: bx + (1 + c) * PEAK_OVERLAP_X,
          y: ROW1_Y,
          faceUp: false,
          children: []
        });
      }

      // Row 2: 3 cards
      for (let c = 0; c < 3; ++c) {
        layout.push({
          peak: p, row: 2, col: c,
          x: bx + (0.5 + c) * PEAK_OVERLAP_X,
          y: ROW2_Y,
          faceUp: false,
          children: []
        });
      }
    }

    // Row 3: 10 cards spanning across all peaks
    // Peaks share edge cards: peak0 has cols 0-3, peak1 has cols 3-6, peak2 has cols 6-9
    // So 10 unique positions (0 through 9)
    for (let c = 0; c < 10; ++c) {
      layout.push({
        peak: -1, row: 3, col: c,
        x: START_X + c * PEAK_OVERLAP_X,
        y: ROW3_Y,
        faceUp: true,       // bottom row is always face-up
        children: []
      });
    }

    // Now wire up covering relationships (children array = indices this card covers)
    // Row 0 covers row 1
    for (let p = 0; p < 3; ++p) {
      const r0 = findIdx(layout, p, 0, 0);
      const r1a = findIdx(layout, p, 1, 0);
      const r1b = findIdx(layout, p, 1, 1);
      layout[r0].children = [r1a, r1b];
    }

    // Row 1 covers row 2
    for (let p = 0; p < 3; ++p) {
      for (let c = 0; c < 2; ++c) {
        const parent = findIdx(layout, p, 1, c);
        const childA = findIdx(layout, p, 2, c);
        const childB = findIdx(layout, p, 2, c + 1);
        layout[parent].children = [childA, childB];
      }
    }

    // Row 2 covers row 3
    // Peak p's row 2 col c covers row 3 global cols (p*3 + c) and (p*3 + c + 1)
    for (let p = 0; p < 3; ++p) {
      for (let c = 0; c < 3; ++c) {
        const parent = findIdx(layout, p, 2, c);
        const globalCol1 = p * 3 + c;
        const globalCol2 = p * 3 + c + 1;
        const childA = findRow3Idx(layout, globalCol1);
        const childB = findRow3Idx(layout, globalCol2);
        layout[parent].children = [childA, childB];
      }
    }

    return layout;
  }

  function findIdx(layout, peak, row, col) {
    for (let i = 0; i < layout.length; ++i)
      if (layout[i].peak === peak && layout[i].row === row && layout[i].col === col)
        return i;
    return -1;
  }

  function findRow3Idx(layout, globalCol) {
    for (let i = 0; i < layout.length; ++i)
      if (layout[i].row === 3 && layout[i].col === globalCol)
        return i;
    return -1;
  }

  /* ================================================================
   *  CHECK IF A PEAK CARD IS EXPOSED (not covered by any parent)
   * ================================================================ */

  function isExposed(index) {
    const slot = S.peaks[index];
    if (!slot || slot.removed)
      return false;

    // A card is exposed if no un-removed card covers it
    // (i.e., no parent card has this index in its children and is still present)
    for (let i = 0; i < S.peaks.length; ++i) {
      if (S.peaks[i].removed)
        continue;
      if (S.peaks[i].children.indexOf(index) >= 0)
        return false;
    }
    return true;
  }

  /* ================================================================
   *  FLIP NEWLY EXPOSED FACE-DOWN CARDS
   * ================================================================ */

  function flipExposedCards() {
    for (let i = 0; i < S.peaks.length; ++i) {
      if (S.peaks[i].removed || S.peaks[i].faceUp)
        continue;
      if (isExposed(i))
        S.peaks[i].faceUp = true;
    }
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      peaks: S.peaks.map(p => ({
        suit: p.card ? p.card.suit : null,
        rank: p.card ? p.card.rank : null,
        faceUp: p.faceUp,
        removed: p.removed
      })),
      stock: S.stock.map(c => ({ suit: c.suit, rank: c.rank })),
      waste: S.waste.map(c => ({ suit: c.suit, rank: c.rank })),
      streak: S.streak,
      score: S.score
    };
    S.undoHistory.push(JSON.stringify(state));
    if (S.undoHistory.length > MAX_UNDO)
      S.undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    for (let i = 0; i < S.peaks.length; ++i) {
      const ps = s.peaks[i];
      S.peaks[i].card = ps.suit ? { suit: ps.suit, rank: ps.rank, faceUp: ps.faceUp } : null;
      S.peaks[i].faceUp = ps.faceUp;
      S.peaks[i].removed = ps.removed;
    }
    S.stock = s.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: false }));
    S.waste = s.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: true }));
    S.streak = s.streak;
    S.score = s.score;
    S.roundOver = false;
    S.resultMsg = '';
  }

  function doUndo() {
    if (S.undoHistory.length === 0)
      return;
    restoreState(S.undoHistory.pop());
    if (S._host)
      S._host.onScoreChanged(S.score);
  }

  /* ================================================================
   *  NEW GAME / SETUP
   * ================================================================ */

  function newGame() {
    const layout = buildLayout();
    const deck = CE.shuffle(CE.createDeck());
    let di = 0;

    S.peaks = layout.map(slot => {
      const card = deck[di++];
      card.faceUp = slot.faceUp;
      return {
        card,
        row: slot.row,
        col: slot.col,
        peak: slot.peak,
        x: slot.x,
        y: slot.y,
        faceUp: slot.faceUp,
        removed: false,
        children: slot.children
      };
    });

    // Remaining cards go to stock
    S.stock = [];
    for (let i = di; i < deck.length; ++i) {
      deck[i].faceUp = false;
      S.stock.push(deck[i]);
    }

    // Deal first card from stock to waste
    S.waste = [];
    if (S.stock.length > 0) {
      const first = S.stock.pop();
      first.faceUp = true;
      S.waste.push(first);
    }

    S.streak = 0;
    S.roundOver = false;
    S.gameOver = false;
    S.peaksCleared = false;
    S.resultMsg = '';
    S.undoHistory = [];
    S.animatingCards = [];
    S.particles = [];

    // Flip any initially exposed cards
    flipExposedCards();
  }

  /* ================================================================
   *  DEAL FROM STOCK
   * ================================================================ */

  function dealFromStock() {
    if (S.stock.length === 0)
      return;

    saveState();
    const card = S.stock.pop();
    card.faceUp = true;
    S.waste.push(card);
    S.streak = 0;   // dealing from stock resets streak

    if (S._host)
      S._host.dealCardAnim(card, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y, 0);

    checkGameEnd();
  }

  /* ================================================================
   *  PLAY A PEAK CARD ONTO WASTE
   * ================================================================ */

  function playCard(peakIndex) {
    const slot = S.peaks[peakIndex];
    if (!slot || slot.removed || !slot.faceUp)
      return false;

    const wasteTop = S.waste.length > 0 ? S.waste[S.waste.length - 1] : null;
    if (!wasteTop)
      return false;

    if (!isAdjacentRank(slot.card.rank, wasteTop.rank))
      return false;

    if (!isExposed(peakIndex))
      return false;

    saveState();

    // Move card to waste
    const card = slot.card;
    card.faceUp = true;
    S.waste.push(card);
    slot.removed = true;

    // Update streak
    ++S.streak;

    // Calculate points: streak bonus is 5 * streak
    const points = 5 * S.streak;
    S.score += points;

    if (S._host) {
      S._host.dealCardAnim(card, slot.x, slot.y, WASTE_X, WASTE_Y, 0);
      if (S.streak > 1)
        S._host.floatingText.add(slot.x + CE.CARD_W / 2, slot.y, 'x' + S.streak + ' (+' + points + ')', { color: '#ff0', size: 18 });
      else
        S._host.floatingText.add(slot.x + CE.CARD_W / 2, slot.y, '+' + points, { color: '#4f4', size: 16 });
      S._host.onScoreChanged(S.score);
    }

    // Spawn sparkle particle
    spawnSparkle(slot.x + CE.CARD_W / 2, slot.y + CE.CARD_H / 2);

    // Flip newly exposed cards
    flipExposedCards();

    // Check if all peaks cleared
    if (allPeaksCleared()) {
      S.peaksCleared = true;
      S.score += 100;
      S.resultMsg = 'All peaks cleared! +100 bonus!';
      S.roundOver = true;
      if (S._host) {
        S._host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'ALL CLEAR! +100', { color: '#ff0', size: 32 });
        S._host.onScoreChanged(S.score);
        S._host.onRoundOver(false);
      }
      return true;
    }

    checkGameEnd();
    return true;
  }

  /* ================================================================
   *  CHECK GAME END CONDITIONS
   * ================================================================ */

  function allPeaksCleared() {
    for (let i = 0; i < S.peaks.length; ++i)
      if (!S.peaks[i].removed)
        return false;
    return true;
  }

  function hasValidMoves() {
    if (S.stock.length > 0)
      return true;

    const wasteTop = S.waste.length > 0 ? S.waste[S.waste.length - 1] : null;
    if (!wasteTop)
      return false;

    for (let i = 0; i < S.peaks.length; ++i) {
      if (S.peaks[i].removed || !S.peaks[i].faceUp)
        continue;
      if (!isExposed(i))
        continue;
      if (isAdjacentRank(S.peaks[i].card.rank, wasteTop.rank))
        return true;
    }
    return false;
  }

  function checkGameEnd() {
    if (allPeaksCleared())
      return;

    if (!hasValidMoves()) {
      S.roundOver = true;
      const remaining = S.peaks.filter(p => !p.removed).length;
      S.resultMsg = 'No moves left! ' + remaining + ' card' + (remaining !== 1 ? 's' : '') + ' remaining.';
      if (S._host)
        S._host.onRoundOver(true);
    }
  }

  /* ================================================================
   *  PARTICLES (simple sparkle effect)
   * ================================================================ */

  function spawnSparkle(x, y) {
    const count = 10;
    for (let i = 0; i < count; ++i) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      S.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        size: 2 + Math.random() * 3,
        color: '#ffff44',
        life: 40
      });
    }
  }

  function updateParticles() {
    for (let i = S.particles.length - 1; i >= 0; --i) {
      const p = S.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      --p.life;
      p.alpha = p.life / 40;
      if (p.life <= 0)
        S.particles.splice(i, 1);
    }
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTestPeaks(mx, my) {
    // Test from bottom row to top (front-to-back)
    for (let row = 3; row >= 0; --row) {
      for (let i = S.peaks.length - 1; i >= 0; --i) {
        const slot = S.peaks[i];
        if (slot.row !== row || slot.removed)
          continue;
        if (mx >= slot.x && mx <= slot.x + CE.CARD_W && my >= slot.y && my <= slot.y + CE.CARD_H)
          return i;
      }
    }
    return -1;
  }

  function hitTestStock(mx, my) {
    return CE.isInRect(mx, my, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H);
  }

  Object.assign(V, {
    isAdjacentRank, isExposed, doUndo, newGame, dealFromStock, playCard, updateParticles,
    hitTestPeaks, hitTestStock
  });

})();
