;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  const CE = SZ.CardEngine;

  const CANVAS_W = 900;
  const CANVAS_H = 600;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let peaks = [];           // array of { card, row, col, peak, faceUp, x, y, removed }
  let stock = [];           // face-down draw pile
  let waste = [];           // waste pile (top card is the match target)
  let streak = 0;           // current consecutive plays from peaks
  let score = 0;
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';
  let peaksCleared = false;
  let undoHistory = [];
  const MAX_UNDO = 100;

  /* -- Host references -- */
  let _ctx = null;
  let _host = null;

  /* -- Animation state -- */
  let animatingCards = [];
  let particles = [];

  /* ================================================================
   *  DRAWING HELPERS
   * ================================================================ */

  function drawCardHighlight(x, y) {
    _ctx.save();
    _ctx.strokeStyle = '#ff0';
    _ctx.lineWidth = 3;
    _ctx.shadowColor = '#ff0';
    _ctx.shadowBlur = 8;
    CE.drawRoundedRect(_ctx, x, y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
    _ctx.stroke();
    _ctx.restore();
  }

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

  /* ================================================================
   *  PEAK LAYOUT DEFINITION
   *
   *  Three peaks, each a triangle. Standard TriPeaks layout:
   *
   *  Row 0 (3 cards):   peaks 0,1,2 each have 1 card at top
   *  Row 1 (6 cards):   peaks 0,1,2 each have 2 cards
   *  Row 2 (9 cards):   peaks 0,1,2 each have 3 cards
   *  Row 3 (10 cards):  shared bottom row, all face-up
   *
   *  Total: 28 cards in peaks, 24 in stock (1 goes to waste)
   *
   *  Covering rule: A card in row r at position c covers
   *  cards at row r+1 positions c and c+1 (within its peak).
   *  Row 3 is the bottom row shared across peaks.
   * ================================================================ */

  // Layout positions per peak (relative col indices within each peak)
  // Each peak occupies cols 0..3 at row 3
  //
  // Peak layout (cols are 0-indexed within peak area):
  //   Row 0:       col 1.5 (centered)
  //   Row 1:       col 1, col 2
  //   Row 2:       col 0.5, col 1.5, col 2.5
  //   Row 3:       col 0, col 1, col 2, col 3 (partially shared with adjacent peaks)

  // We define 28 card positions with absolute indices.
  // Card layout uses a fixed coordinate system.

  const PEAK_OFFSET_X = 30;                           // left margin
  const PEAK_OVERLAP_X = CE.CARD_W * 0.55;            // horizontal spacing between cards in same row
  const ROW_OVERLAP_Y = CE.CARD_H * 0.40;             // vertical spacing between rows

  const ROW0_Y = 20;
  const ROW1_Y = ROW0_Y + ROW_OVERLAP_Y;
  const ROW2_Y = ROW1_Y + ROW_OVERLAP_Y;
  const ROW3_Y = ROW2_Y + ROW_OVERLAP_Y;

  // Each peak's leftmost x origin at row 3 (the widest row)
  const PEAK_WIDTH = 4 * PEAK_OVERLAP_X;              // 4 cards at row 3
  const TOTAL_WIDTH = 3 * PEAK_WIDTH - 2 * PEAK_OVERLAP_X; // peaks overlap by 1 card at row 3
  const START_X = (CANVAS_W - TOTAL_WIDTH - CE.CARD_W) / 2;

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
    const slot = peaks[index];
    if (!slot || slot.removed)
      return false;

    // A card is exposed if no un-removed card covers it
    // (i.e., no parent card has this index in its children and is still present)
    for (let i = 0; i < peaks.length; ++i) {
      if (peaks[i].removed)
        continue;
      if (peaks[i].children.indexOf(index) >= 0)
        return false;
    }
    return true;
  }

  /* ================================================================
   *  FLIP NEWLY EXPOSED FACE-DOWN CARDS
   * ================================================================ */

  function flipExposedCards() {
    for (let i = 0; i < peaks.length; ++i) {
      if (peaks[i].removed || peaks[i].faceUp)
        continue;
      if (isExposed(i))
        peaks[i].faceUp = true;
    }
  }

  /* ================================================================
   *  UNDO
   * ================================================================ */

  function saveState() {
    const state = {
      peaks: peaks.map(p => ({
        suit: p.card ? p.card.suit : null,
        rank: p.card ? p.card.rank : null,
        faceUp: p.faceUp,
        removed: p.removed
      })),
      stock: stock.map(c => ({ suit: c.suit, rank: c.rank })),
      waste: waste.map(c => ({ suit: c.suit, rank: c.rank })),
      streak,
      score
    };
    undoHistory.push(JSON.stringify(state));
    if (undoHistory.length > MAX_UNDO)
      undoHistory.shift();
  }

  function restoreState(json) {
    const s = JSON.parse(json);
    for (let i = 0; i < peaks.length; ++i) {
      const ps = s.peaks[i];
      peaks[i].card = ps.suit ? { suit: ps.suit, rank: ps.rank, faceUp: ps.faceUp } : null;
      peaks[i].faceUp = ps.faceUp;
      peaks[i].removed = ps.removed;
    }
    stock = s.stock.map(c => ({ suit: c.suit, rank: c.rank, faceUp: false }));
    waste = s.waste.map(c => ({ suit: c.suit, rank: c.rank, faceUp: true }));
    streak = s.streak;
    score = s.score;
    roundOver = false;
    resultMsg = '';
  }

  function doUndo() {
    if (undoHistory.length === 0)
      return;
    restoreState(undoHistory.pop());
    if (_host)
      _host.onScoreChanged(score);
  }

  /* ================================================================
   *  NEW GAME / SETUP
   * ================================================================ */

  function newGame() {
    const layout = buildLayout();
    const deck = CE.shuffle(CE.createDeck());
    let di = 0;

    peaks = layout.map(slot => {
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
    stock = [];
    for (let i = di; i < deck.length; ++i) {
      deck[i].faceUp = false;
      stock.push(deck[i]);
    }

    // Deal first card from stock to waste
    waste = [];
    if (stock.length > 0) {
      const first = stock.pop();
      first.faceUp = true;
      waste.push(first);
    }

    streak = 0;
    roundOver = false;
    gameOver = false;
    peaksCleared = false;
    resultMsg = '';
    undoHistory = [];
    animatingCards = [];
    particles = [];

    // Flip any initially exposed cards
    flipExposedCards();
  }

  /* ================================================================
   *  STOCK / WASTE POSITIONS
   * ================================================================ */

  const STOCK_X = 60;
  const STOCK_Y = CANVAS_H - CE.CARD_H - 40;
  const WASTE_X = STOCK_X + CE.CARD_W + 20;
  const WASTE_Y = STOCK_Y;

  /* ================================================================
   *  DEAL FROM STOCK
   * ================================================================ */

  function dealFromStock() {
    if (stock.length === 0)
      return;

    saveState();
    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
    streak = 0;   // dealing from stock resets streak

    if (_host)
      _host.dealCardAnim(card, STOCK_X, STOCK_Y, WASTE_X, WASTE_Y, 0);

    checkGameEnd();
  }

  /* ================================================================
   *  PLAY A PEAK CARD ONTO WASTE
   * ================================================================ */

  function playCard(peakIndex) {
    const slot = peaks[peakIndex];
    if (!slot || slot.removed || !slot.faceUp)
      return false;

    const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;
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
    waste.push(card);
    slot.removed = true;

    // Update streak
    ++streak;

    // Calculate points: streak bonus is 5 * streak
    const points = 5 * streak;
    score += points;

    if (_host) {
      _host.dealCardAnim(card, slot.x, slot.y, WASTE_X, WASTE_Y, 0);
      if (streak > 1)
        _host.floatingText.add(slot.x + CE.CARD_W / 2, slot.y, 'x' + streak + ' (+' + points + ')', { color: '#ff0', size: 18 });
      else
        _host.floatingText.add(slot.x + CE.CARD_W / 2, slot.y, '+' + points, { color: '#4f4', size: 16 });
      _host.onScoreChanged(score);
    }

    // Spawn sparkle particle
    spawnSparkle(slot.x + CE.CARD_W / 2, slot.y + CE.CARD_H / 2);

    // Flip newly exposed cards
    flipExposedCards();

    // Check if all peaks cleared
    if (allPeaksCleared()) {
      peaksCleared = true;
      score += 100;
      resultMsg = 'All peaks cleared! +100 bonus!';
      roundOver = true;
      if (_host) {
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, 'ALL CLEAR! +100', { color: '#ff0', size: 32 });
        _host.onScoreChanged(score);
        _host.onRoundOver(false);
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
    for (let i = 0; i < peaks.length; ++i)
      if (!peaks[i].removed)
        return false;
    return true;
  }

  function hasValidMoves() {
    if (stock.length > 0)
      return true;

    const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;
    if (!wasteTop)
      return false;

    for (let i = 0; i < peaks.length; ++i) {
      if (peaks[i].removed || !peaks[i].faceUp)
        continue;
      if (!isExposed(i))
        continue;
      if (isAdjacentRank(peaks[i].card.rank, wasteTop.rank))
        return true;
    }
    return false;
  }

  function checkGameEnd() {
    if (allPeaksCleared())
      return;

    if (!hasValidMoves()) {
      roundOver = true;
      const remaining = peaks.filter(p => !p.removed).length;
      resultMsg = 'No moves left! ' + remaining + ' card' + (remaining !== 1 ? 's' : '') + ' remaining.';
      if (_host)
        _host.onRoundOver(true);
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
      particles.push({
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
    for (let i = particles.length - 1; i >= 0; --i) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      --p.life;
      p.alpha = p.life / 40;
      if (p.life <= 0)
        particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (const p of particles) {
      _ctx.save();
      _ctx.globalAlpha = Math.max(0, p.alpha);
      _ctx.fillStyle = p.color;
      _ctx.shadowColor = p.color;
      _ctx.shadowBlur = 6;
      _ctx.beginPath();
      _ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      _ctx.fill();
      _ctx.restore();
    }
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTestPeaks(mx, my) {
    // Test from bottom row to top (front-to-back)
    for (let row = 3; row >= 0; --row) {
      for (let i = peaks.length - 1; i >= 0; --i) {
        const slot = peaks[i];
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

  /* ================================================================
   *  DRAWING - MAIN
   * ================================================================ */

  function drawGame() {
    // Green felt background
    _ctx.fillStyle = '#1a7a2e';
    _ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    _ctx.fillStyle = '#126622';
    _ctx.fillRect(0, 0, CANVAS_W, 2);
    _ctx.fillRect(0, 0, 2, CANVAS_H);

    // Draw peak cards (back-to-front: row 0 first, then row 1, etc.)
    const wasteTop = waste.length > 0 ? waste[waste.length - 1] : null;

    for (let row = 0; row <= 3; ++row) {
      for (let i = 0; i < peaks.length; ++i) {
        const slot = peaks[i];
        if (slot.row !== row || slot.removed)
          continue;

        if (slot.faceUp) {
          CE.drawCardFace(_ctx, slot.x, slot.y, slot.card);
          // Highlight playable cards
          if (wasteTop && isExposed(i) && isAdjacentRank(slot.card.rank, wasteTop.rank)) {
            drawCardHighlight(slot.x, slot.y);
            if (_host && _host.hintsEnabled && !roundOver)
              CE.drawHintGlow(_ctx, slot.x, slot.y, CE.CARD_W, CE.CARD_H, _host.hintTime);
          }
        } else
          CE.drawCardBack(_ctx, slot.x, slot.y);
      }
    }

    // Draw stock pile
    if (stock.length > 0) {
      // Draw stacked backs to show depth
      const depth = Math.min(stock.length, 4);
      for (let i = 0; i < depth; ++i)
        CE.drawCardBack(_ctx, STOCK_X - i * 2, STOCK_Y - i * 2);

      // Show remaining count
      _ctx.fillStyle = '#fff';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'top';
      _ctx.fillText(stock.length + ' left', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H + 4);
    } else {
      // Empty stock
      _ctx.save();
      _ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, STOCK_X, STOCK_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.restore();

      _ctx.fillStyle = 'rgba(255,255,255,0.3)';
      _ctx.font = '12px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText('Empty', STOCK_X + CE.CARD_W / 2, STOCK_Y + CE.CARD_H / 2);
    }

    // Draw waste pile
    if (waste.length > 0) {
      const top = waste[waste.length - 1];
      CE.drawCardFace(_ctx, WASTE_X, WASTE_Y, top);
    } else {
      _ctx.save();
      _ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      _ctx.lineWidth = 2;
      CE.drawRoundedRect(_ctx, WASTE_X, WASTE_Y, CE.CARD_W, CE.CARD_H, CE.CARD_RADIUS);
      _ctx.stroke();
      _ctx.restore();
    }

    // Draw particles
    drawParticles();

    // Draw streak counter
    if (streak > 1) {
      _ctx.save();
      _ctx.fillStyle = '#ff0';
      _ctx.font = 'bold 28px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.shadowColor = '#ff0';
      _ctx.shadowBlur = 12;
      _ctx.fillText('STREAK x' + streak, CANVAS_W / 2, ROW3_Y + CE.CARD_H + 50);
      _ctx.restore();
    }

    // Draw score
    _ctx.fillStyle = '#fff';
    _ctx.font = 'bold 18px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Score: ' + score, CANVAS_W - 30, 15);

    // Draw remaining peak cards count
    const remaining = peaks.filter(p => !p.removed).length;
    _ctx.fillStyle = 'rgba(255,255,255,0.7)';
    _ctx.font = '14px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'top';
    _ctx.fillText('Cards in peaks: ' + remaining, CANVAS_W - 30, 40);

    // Draw result message
    if (resultMsg) {
      _ctx.save();
      _ctx.fillStyle = 'rgba(0,0,0,0.5)';
      _ctx.fillRect(0, CANVAS_H / 2 - 50, CANVAS_W, 100);

      _ctx.fillStyle = peaksCleared ? '#4f4' : '#fa0';
      _ctx.font = 'bold 24px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.textBaseline = 'middle';
      _ctx.fillText(resultMsg, CANVAS_W / 2, CANVAS_H / 2 - 15);

      _ctx.fillStyle = '#fff';
      _ctx.font = '16px sans-serif';
      _ctx.fillText('Click to start a new round', CANVAS_W / 2, CANVAS_H / 2 + 20);
      _ctx.restore();
    }

    // Draw undo hint
    if (!roundOver && undoHistory.length > 0) {
      _ctx.fillStyle = 'rgba(255,255,255,0.4)';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'left';
      _ctx.textBaseline = 'bottom';
      _ctx.fillText('Ctrl+Z to undo', 10, CANVAS_H - 8);
    }

    // New game hint
    _ctx.fillStyle = 'rgba(255,255,255,0.4)';
    _ctx.font = '11px sans-serif';
    _ctx.textAlign = 'right';
    _ctx.textBaseline = 'bottom';
    _ctx.fillText('F2 - New Game', CANVAS_W - 10, CANVAS_H - 8);
  }

  /* ================================================================
   *  MODULE INTERFACE
   * ================================================================ */

  const module = {

    setup(ctx, canvas, W, H, host) {
      _ctx = ctx;
      _host = host || null;
      score = (_host && _host.getScore) ? _host.getScore() : 0;
      newGame();
    },

    draw(ctx, W, H) {
      _ctx = ctx;
      drawGame();
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host)
          _host.onRoundOver(gameOver);
        return;
      }

      // Check stock click
      if (hitTestStock(mx, my)) {
        dealFromStock();
        return;
      }

      // Check peak card click
      const peakIdx = hitTestPeaks(mx, my);
      if (peakIdx >= 0)
        playCard(peakIdx);
    },

    handlePointerMove() {},
    handlePointerUp() {},

    handleKey(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        newGame();
        if (_host)
          _host.onScoreChanged(score);
        return;
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        doUndo();
      }
    },

    tick(dt) {
      updateParticles();
    },

    cleanup() {
      peaks = [];
      stock = [];
      waste = [];
      streak = 0;
      score = 0;
      roundOver = false;
      gameOver = false;
      peaksCleared = false;
      resultMsg = '';
      undoHistory = [];
      animatingCards = [];
      particles = [];
      _ctx = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('tripeaks', module);

})();
