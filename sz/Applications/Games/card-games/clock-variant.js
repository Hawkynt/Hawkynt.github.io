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

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ================================================================
   *  CONSTANTS
   * ================================================================ */

  const PILE_COUNT = 13;              // 12 clock positions + 1 center
  const CARDS_PER_PILE = 4;
  const CENTER_PILE = 12;             // index for the King/center pile

  /* ── Scaled card size for clock layout ── */
  const SCALE = 0.72;
  const CW = Math.round(CARD_W * SCALE);
  const CH = Math.round(CARD_H * SCALE);
  const CR = Math.round(CARD_RADIUS * SCALE);

  /* ── Clock geometry ── */
  const CLOCK_CX = CANVAS_W / 2;
  const CLOCK_CY = CANVAS_H / 2 - 10;
  const CLOCK_RADIUS = 210;

  /* ── Fan offset for stacked cards in each pile ── */
  const FAN_OFFSET = 3;

  /* ── Rank → pile index mapping: A=0, 2=1, ... Q=11, K=12(center) ── */
  function rankToPile(rank) {
    const idx = RANKS.indexOf(rank);
    if (idx === 12) return CENTER_PILE;  // K → center
    return idx;                           // A=0, 2=1, ... Q=11
  }

  /* ── Pile position: 0-11 are clock face (1 o'clock through 12 o'clock), 12 is center ── */
  function pilePosition(pileIdx) {
    if (pileIdx === CENTER_PILE)
      return { x: CLOCK_CX, y: CLOCK_CY };
    // Clock face: pileIdx 0 = Ace = 1 o'clock position, ... pileIdx 11 = Queen = 12 o'clock
    // Angle: 12 o'clock is -PI/2, going clockwise
    const hourPosition = pileIdx + 1;  // 1-12
    const angle = -Math.PI / 2 + (hourPosition / 12) * 2 * Math.PI;
    return {
      x: CLOCK_CX + Math.cos(angle) * CLOCK_RADIUS,
      y: CLOCK_CY + Math.sin(angle) * CLOCK_RADIUS
    };
  }

  /* ── Rank labels for clock positions ── */
  const PILE_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /* ── Buttons ── */
  const BTN_W = 100;
  const BTN_H = 32;
  const BTN_GAP = 16;
  const AUTO_BTN = { x: CANVAS_W - BTN_W - 20, y: CANVAS_H - BTN_H - 16, w: BTN_W, h: BTN_H };
  const NEXT_BTN = { x: AUTO_BTN.x - BTN_W - BTN_GAP, y: AUTO_BTN.y, w: BTN_W, h: BTN_H };

  /* ── Animation ── */
  const MOVE_DURATION = 0.3;

  /* ================================================================
   *  GAME STATE
   * ================================================================ */

  let piles = [];           // 13 piles, each an array of cards
  let score = 0;
  let cardsPlaced = 0;      // number of cards successfully placed
  let roundOver = false;
  let gameOver = false;
  let resultMsg = '';

  let currentCard = null;   // the card just flipped, waiting to be placed
  let currentFromPile = -1; // pile the current card came from

  let autoPlaying = false;
  let autoTimer = 0;
  const AUTO_INTERVAL = 0.45;

  /* ── Move animation ── */
  let animating = false;
  let animCard = null;
  let animFromX = 0;
  let animFromY = 0;
  let animToX = 0;
  let animToY = 0;
  let animProgress = 0;
  let animCallback = null;

  let hoverPile = -1;

  let _ctx = null;
  let _host = null;
  let _canvas = null;

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

  function drawCardFace(cx, x, y, card, w, h) {
    if (CE && CE.drawCardFace)
      return CE.drawCardFace(cx, x, y, card, w || CARD_W, h || CARD_H);
    const cw = w || CARD_W;
    const ch = h || CARD_H;
    drawRoundedRect(cx, x, y, cw, ch, CR);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#aaa';
    cx.lineWidth = 1;
    cx.stroke();
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#c00' : '#222';
    cx.fillStyle = color;
    cx.font = 'bold ' + Math.round(14 * (cw / CARD_W)) + 'px serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, x + 4, y + 3);
  }

  function drawCardBack(cx, x, y, w, h) {
    if (CE && CE.drawCardBack)
      return CE.drawCardBack(cx, x, y, w || CARD_W, h || CARD_H);
    const cw = w || CARD_W;
    const ch = h || CARD_H;
    drawRoundedRect(cx, x, y, cw, ch, CR);
    cx.fillStyle = '#1a237e';
    cx.fill();
    cx.strokeStyle = '#fff';
    cx.lineWidth = 1;
    cx.stroke();
  }

  function drawEmptySlot(cx, x, y, label, w, h) {
    if (CE && CE.drawEmptySlot)
      return CE.drawEmptySlot(cx, x, y, label, w || CARD_W, h || CARD_H);
    const cw = w || CARD_W;
    const ch = h || CARD_H;
    drawRoundedRect(cx, x, y, cw, ch, CR);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();
    if (label) {
      cx.font = Math.round(18 * (cw / CARD_W)) + 'px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + cw / 2, y + ch / 2);
    }
  }

  function drawButton(cx, x, y, w, h, label, opts) {
    if (CE && CE.drawButton)
      return CE.drawButton(cx, x, y, w, h, label, opts);
    cx.save();
    drawRoundedRect(cx, x, y, w, h, 5);
    cx.fillStyle = (opts && opts.bg) || '#2a5a2a';
    cx.fill();
    cx.strokeStyle = (opts && opts.border) || '#6c6';
    cx.lineWidth = 1.5;
    cx.stroke();
    cx.fillStyle = '#fff';
    cx.font = 'bold 13px sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillText(label, x + w / 2, y + h / 2);
    cx.restore();
  }

  /* ================================================================
   *  DECK + SHUFFLE
   * ================================================================ */

  function createDeck() {
    if (CE && CE.createDeck)
      return CE.createDeck();
    const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
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
   *  GAME LOGIC
   * ================================================================ */

  function countFaceUp(pile) {
    let n = 0;
    for (const c of pile)
      if (c.faceUp) ++n;
    return n;
  }

  function isPileComplete(pileIdx) {
    return countFaceUp(piles[pileIdx]) === CARDS_PER_PILE;
  }

  function allComplete() {
    for (let i = 0; i < PILE_COUNT; ++i)
      if (!isPileComplete(i)) return false;
    return true;
  }

  function topFaceDownCard(pileIdx) {
    const pile = piles[pileIdx];
    for (let i = pile.length - 1; i >= 0; --i)
      if (!pile[i].faceUp) return pile[i];
    return null;
  }

  function flipFromPile(pileIdx) {
    const card = topFaceDownCard(pileIdx);
    if (!card) return null;
    card.faceUp = true;
    return card;
  }

  function placeCard(card, targetPile) {
    piles[targetPile].push(card);
    ++cardsPlaced;
    score = cardsPlaced;
    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
  }

  function startMove() {
    if (roundOver || gameOver || animating) return;

    // If no current card, flip from center pile to start
    if (!currentCard) {
      currentCard = flipFromPile(CENTER_PILE);
      currentFromPile = CENTER_PILE;
      if (!currentCard) {
        endGame(false);
        return;
      }
    }

    const targetPile = rankToPile(currentCard.rank);
    const card = currentCard;
    currentCard = null;

    // Animate the card moving from its source pile to the target pile
    const fromPos = pilePosition(currentFromPile);
    const toPos = pilePosition(targetPile);

    animCard = card;
    animFromX = fromPos.x - CW / 2;
    animFromY = fromPos.y - CH / 2;
    animToX = toPos.x - CW / 2;
    animToY = toPos.y - CH / 2;
    animProgress = 0;
    animating = true;

    animCallback = function() {
      placeCard(card, targetPile);

      if (_host && _host.floatingText) {
        const pos = pilePosition(targetPile);
        _host.floatingText.add(pos.x, pos.y - CH / 2 - 10, '+1', { color: '#4f4', size: 16 });
      }
      if (_host && _host.particles)
        _host.particles.sparkle(toPos.x, toPos.y, 3);

      // Check win
      if (allComplete()) {
        endGame(true);
        return;
      }

      // Check if target pile is now complete (all 4 face-up = 4 Kings placed, or pile done)
      // If 4th King is turned and other piles aren't done, game over
      if (targetPile === CENTER_PILE && isPileComplete(CENTER_PILE)) {
        if (!allComplete()) {
          endGame(false);
          return;
        }
      }

      // Flip next card from target pile
      const nextCard = topFaceDownCard(targetPile);
      if (nextCard) {
        nextCard.faceUp = true;
        currentCard = nextCard;
        currentFromPile = targetPile;
      } else {
        // Target pile fully face-up, no more face-down cards to flip
        // This shouldn't happen in a standard game unless we just completed everything
        if (!allComplete())
          endGame(false);
      }
    };
  }

  function endGame(won) {
    roundOver = true;
    gameOver = !won;
    autoPlaying = false;

    if (won) {
      score = 52;
      resultMsg = 'You win! All piles completed!';
      if (_host && _host.floatingText)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'YOU WIN!', { color: '#4f4', size: 36 });
      if (_host && _host.particles)
        _host.particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 60);
    } else {
      resultMsg = cardsPlaced + ' of 52 cards placed. Better luck next time!';
      if (_host && _host.floatingText)
        _host.floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Game Over', { color: '#f88', size: 28 });
    }

    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
    if (_host && _host.onRoundOver)
      _host.onRoundOver(gameOver);
  }

  /* ================================================================
   *  NEW GAME
   * ================================================================ */

  function newGame() {
    const deck = shuffle(createDeck());

    piles = [];
    for (let i = 0; i < PILE_COUNT; ++i)
      piles.push([]);

    // Deal 4 cards to each of the 13 piles
    // Standard deal: go round-robin
    let dealIdx = 0;
    for (let round = 0; round < CARDS_PER_PILE; ++round)
      for (let p = 0; p < PILE_COUNT; ++p) {
        const card = deck[dealIdx++];
        card.faceUp = false;
        piles[p].push(card);
      }

    score = 0;
    cardsPlaced = 0;
    roundOver = false;
    gameOver = false;
    resultMsg = '';
    currentCard = null;
    currentFromPile = -1;
    autoPlaying = false;
    autoTimer = 0;
    animating = false;
    animCard = null;
    animCallback = null;
    hoverPile = -1;

    // Animate deal
    if (_host && _host.dealCardAnim) {
      for (let p = 0; p < PILE_COUNT; ++p)
        for (let r = 0; r < CARDS_PER_PILE; ++r) {
          const card = piles[p][r];
          const pos = pilePosition(p);
          const tx = pos.x - CW / 2 + r * FAN_OFFSET;
          const ty = pos.y - CH / 2 + r * FAN_OFFSET;
          _host.dealCardAnim(card, CANVAS_W / 2, -CH, tx, ty, (p * CARDS_PER_PILE + r) * 0.02);
        }
    }

    if (_host && _host.onScoreChanged)
      _host.onScoreChanged(score);
  }

  /* ================================================================
   *  HIT TESTING
   * ================================================================ */

  function hitTestPile(mx, my) {
    for (let p = 0; p < PILE_COUNT; ++p) {
      const pos = pilePosition(p);
      const pile = piles[p];
      const stackOffset = (pile.length - 1) * FAN_OFFSET;
      const x = pos.x - CW / 2;
      const y = pos.y - CH / 2;
      if (mx >= x && mx < x + CW + stackOffset && my >= y && my < y + CH + stackOffset)
        return p;
    }
    return -1;
  }

  function isInRect(mx, my, r) {
    return mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h;
  }

  /* ================================================================
   *  DRAWING
   * ================================================================ */

  function drawClock(cx, W, H) {
    // Title
    cx.fillStyle = 'rgba(255,255,255,0.6)';
    cx.font = '12px sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText('Clock Solitaire (Clock Patience)', 10, 8);

    // Score (top-right)
    cx.fillStyle = '#fff';
    cx.font = 'bold 16px sans-serif';
    cx.textAlign = 'right';
    cx.textBaseline = 'top';
    cx.fillText('Cards placed: ' + cardsPlaced + ' / 52', W - 20, 8);

    // Draw clock face circle (decorative)
    cx.save();
    cx.beginPath();
    cx.arc(CLOCK_CX, CLOCK_CY, CLOCK_RADIUS + CW / 2 + 15, 0, Math.PI * 2);
    cx.strokeStyle = 'rgba(255,255,255,0.08)';
    cx.lineWidth = 2;
    cx.stroke();
    cx.restore();

    // Draw hour tick marks and labels
    for (let h = 1; h <= 12; ++h) {
      const angle = -Math.PI / 2 + (h / 12) * 2 * Math.PI;
      const labelR = CLOCK_RADIUS + CW / 2 + 22;
      const lx = CLOCK_CX + Math.cos(angle) * labelR;
      const ly = CLOCK_CY + Math.sin(angle) * labelR;
      cx.save();
      cx.fillStyle = 'rgba(255,255,255,0.25)';
      cx.font = 'bold 11px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(h.toString(), lx, ly);
      cx.restore();
    }

    // Draw each pile
    for (let p = 0; p < PILE_COUNT; ++p) {
      const pos = pilePosition(p);
      const pile = piles[p];
      const baseX = pos.x - CW / 2;
      const baseY = pos.y - CH / 2;

      if (pile.length === 0) {
        drawEmptySlot(cx, baseX, baseY, PILE_LABELS[p], CW, CH);
        continue;
      }

      // Draw stacked cards
      for (let i = 0; i < pile.length; ++i) {
        const card = pile[i];
        const cx_ = baseX + i * FAN_OFFSET;
        const cy = baseY + i * FAN_OFFSET;

        if (animCard === card && animating)
          continue; // skip card being animated

        if (card.faceUp)
          drawCardFace(cx, cx_, cy, card, CW, CH);
        else
          drawCardBack(cx, cx_, cy, CW, CH);
      }

      // Completion indicator
      if (isPileComplete(p)) {
        cx.save();
        cx.fillStyle = 'rgba(0,200,0,0.2)';
        drawRoundedRect(cx, baseX - 2, baseY - 2, CW + (pile.length - 1) * FAN_OFFSET + 4, CH + (pile.length - 1) * FAN_OFFSET + 4, CR + 2);
        cx.fill();
        cx.restore();
      }

      // Pile label below
      cx.save();
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.font = '10px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      const countUp = countFaceUp(pile);
      cx.fillText(PILE_LABELS[p] + ' (' + countUp + '/4)', pos.x, baseY + CH + (pile.length - 1) * FAN_OFFSET + 4);
      cx.restore();
    }

    // Draw animating card
    if (animating && animCard) {
      const t = Math.min(animProgress / MOVE_DURATION, 1);
      const ease = CE ? CE.easeOutCubic(t) : (1 - Math.pow(1 - t, 3));
      const ax = animFromX + (animToX - animFromX) * ease;
      const ay = animFromY + (animToY - animFromY) * ease;
      drawCardFace(cx, ax, ay, animCard, CW, CH);
    }

    // Current card indicator (highlight the card that needs to be placed)
    if (currentCard && !animating && !roundOver) {
      const targetPile = rankToPile(currentCard.rank);
      const targetPos = pilePosition(targetPile);
      cx.save();
      cx.strokeStyle = '#ff4';
      cx.lineWidth = 3;
      cx.shadowColor = '#ff4';
      cx.shadowBlur = 10;
      const tp = piles[targetPile];
      const tx = targetPos.x - CW / 2;
      const ty = targetPos.y - CH / 2;
      drawRoundedRect(cx, tx - 2, ty - 2, CW + (tp.length - 1) * FAN_OFFSET + 4, CH + (tp.length - 1) * FAN_OFFSET + 4, CR + 2);
      cx.stroke();
      cx.restore();

      // Show what card is being placed
      cx.save();
      cx.fillStyle = '#ff4';
      cx.font = 'bold 14px sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'bottom';
      cx.fillText('Place: ' + currentCard.rank + ' of ' + currentCard.suit, CANVAS_W / 2, CANVAS_H - 60);
      cx.restore();
    }

    // Buttons
    if (!roundOver) {
      const autoBg = autoPlaying ? { bg: '#8a2a2a', border: '#f66' } : { bg: '#2a5a2a', border: '#6c6' };
      const autoLabel = autoPlaying ? 'Stop' : 'Auto Play';
      drawButton(cx, AUTO_BTN.x, AUTO_BTN.y, AUTO_BTN.w, AUTO_BTN.h, autoLabel, autoBg);
      if (!autoPlaying)
        drawButton(cx, NEXT_BTN.x, NEXT_BTN.y, NEXT_BTN.w, NEXT_BTN.h, 'Next (N)', { bg: '#2a5a2a', border: '#6c6' });
    }

    // Instructions
    if (!roundOver && !autoPlaying) {
      cx.save();
      cx.font = '11px sans-serif';
      cx.fillStyle = 'rgba(255,255,255,0.4)';
      cx.textAlign = 'left';
      cx.textBaseline = 'bottom';
      cx.fillText('Press N or click Next to step  |  Auto Play for continuous play', 10, H - 8);
      cx.restore();
    }

    // Result message overlay
    if (roundOver && resultMsg) {
      cx.save();
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      const msgW = 440;
      const msgH = 80;
      const msgX = (W - msgW) / 2;
      const msgY = (H - msgH) / 2 + 60;
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
      drawClock(ctx, W, H);
    },

    handleClick(mx, my) {
      if (roundOver || gameOver) {
        if (_host)
          _host.onRoundOver(gameOver);
        return;
      }

      // Auto play button
      if (isInRect(mx, my, AUTO_BTN)) {
        autoPlaying = !autoPlaying;
        autoTimer = 0;
        return;
      }

      // Next button (manual step)
      if (!autoPlaying && isInRect(mx, my, NEXT_BTN)) {
        startMove();
        return;
      }

      // Clicking anywhere else also steps (convenient)
      if (!autoPlaying && !animating)
        startMove();
    },

    handlePointerMove(mx, my) {
      hoverPile = hitTestPile(mx, my);
    },

    handlePointerUp(mx, my) {},

    handleKey(e) {
      if (roundOver || gameOver) return;

      if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
        e.preventDefault();
        if (!autoPlaying && !animating)
          startMove();
        return;
      }

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        autoPlaying = !autoPlaying;
        autoTimer = 0;
        return;
      }
    },

    tick(dt) {
      // Animation update
      if (animating) {
        animProgress += dt;
        if (animProgress >= MOVE_DURATION) {
          animProgress = MOVE_DURATION;
          animating = false;
          const cb = animCallback;
          animCard = null;
          animCallback = null;
          if (cb) cb();
        }
      }

      // Auto play timer
      if (autoPlaying && !roundOver && !gameOver && !animating) {
        autoTimer += dt;
        if (autoTimer >= AUTO_INTERVAL) {
          autoTimer = 0;
          startMove();
        }
      }
    },

    cleanup() {
      piles = [];
      score = 0;
      cardsPlaced = 0;
      roundOver = false;
      gameOver = false;
      resultMsg = '';
      currentCard = null;
      currentFromPile = -1;
      autoPlaying = false;
      autoTimer = 0;
      animating = false;
      animCard = null;
      animCallback = null;
      hoverPile = -1;
      _ctx = null;
      _canvas = null;
      _host = null;
    },

    isRoundOver() { return roundOver; },
    isGameOver() { return gameOver; },
    getScore() { return score; },
    setScore(s) { score = s; }
  };

  SZ.CardGames.registerVariant('clock', module);

})();
