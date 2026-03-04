;(function() {
  'use strict';

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;
  const CARD_W = 70;
  const CARD_H = 100;
  const CARD_RADIUS = 6;

  /* ── Game states ── */
  const STATE_MENU = 'MENU';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_ROUND_OVER = 'ROUND_OVER';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-card-games';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── Variant definitions (all 10 games) ── */
  const VARIANTS = [
    { id: 'poker',      name: 'Poker',       desc: 'Five-card draw with betting rounds',  module: 'poker-variant.js' },
    { id: 'blackjack',  name: 'Blackjack',   desc: 'Get as close to 21 as you can',       module: 'blackjack-variant.js' },
    { id: 'uno',        name: 'Uno',         desc: 'Match cards by color or number',       module: 'uno-variant.js' },
    { id: 'skipbo',     name: 'Skip-Bo',     desc: 'Build sequential piles 1 to 12',      module: 'skipbo-variant.js' },
    { id: 'skat',       name: 'Skat',        desc: 'German trick-taking card game',        module: 'skat-variant.js' },
    { id: 'canasta',    name: 'Canasta',     desc: 'Form melds of seven cards',            module: 'canasta-variant.js' },
    { id: 'doppelkopf', name: 'Doppelkopf',  desc: 'Hidden teams trick-taking game',      module: 'doppelkopf-variant.js' },
    { id: 'solitaire',  name: 'Solitaire',   desc: 'Classic Klondike solitaire',           module: 'solitaire-variant.js' },
    { id: 'freecell',   name: 'FreeCell',    desc: 'All cards face-up strategy',           module: 'freecell-variant.js' },
    { id: 'spider',     name: 'Spider',      desc: 'Build runs of same-suit cards',        module: 'spider-variant.js' }
  ];

  /* ── Menu button region ── */
  const MENU_BTN = { x: CANVAS_W - 82, y: 8, w: 72, h: 28 };

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     VISUAL EFFECTS (shared by all inline-rendered variants)
     ══════════════════════════════════════════════════════════════════ */

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_MENU;
  let currentVariant = null;
  let score = 0;
  let roundNumber = 0;
  let lastTimestamp = 0;

  /* ── Card animation state (for host-rendered variants) ── */
  let dealAnimations = [];
  let flipAnimations = [];
  let glowCards = [];
  let chipSparkleTimer = 0;

  /* ── Variant module system ── */
  let variantModules = {};
  let activeVariantModule = null;

  /* ══════════════════════════════════════════════════════════════════
     VARIANT MODULE SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  SZ.CardGames.registerVariant = function(id, mod) {
    variantModules[id] = mod;
  };

  function loadVariantModule(variant, onReady) {
    if (variantModules[variant.id]) {
      onReady(variantModules[variant.id]);
      return;
    }
    const script = document.createElement('script');
    script.src = variant.module;
    script.onload = function() {
      const mod = variantModules[variant.id];
      if (mod)
        onReady(mod);
    };
    document.head.appendChild(script);
  }

  /* ══════════════════════════════════════════════════════════════════
     HOST OBJECT (passed to inline-rendered variants)
     ══════════════════════════════════════════════════════════════════ */

  const host = {
    particles,
    floatingText,
    screenShake,
    getScore() { return score; },
    onScoreChanged(newScore) {
      score = newScore;
      updateStatus();
      saveHighScores();
    },
    onRoundOver(isGameOver) {
      if (isGameOver) {
        state = STATE_GAME_OVER;
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'GAME OVER', { color: '#f44', size: 36 });
      } else {
        state = STATE_ROUND_OVER;
      }
      updateStatus();
      saveHighScores();
    },
    dealCardAnim(card, fromX, fromY, toX, toY, delay) {
      card._dealing = true;
      dealAnimations.push({
        card, fromX, fromY, toX, toY,
        t: -delay, duration: 0.3, done: false
      });
    },
    flipCard(cardRef, faceUp) {
      flipAnimations.push({
        cardRef, t: 0, duration: 0.25, faceUp, scaleX: 1
      });
    },
    addGlow(x, y, w, h, duration) {
      glowCards.push({ x, y, w, h, t: 0, duration: duration || 1.5 });
    },
    triggerChipSparkle(x, y) {
      particles.sparkle(x, y, 20, { color: '#fa0', speed: 80, life: 0.8 });
      chipSparkleTimer = 1.0;
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     DRAWING HELPERS (for host-rendered UI: menu, buttons, overlays)
     ══════════════════════════════════════════════════════════════════ */

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawButton(x, y, w, h, label, opts) {
    const bg = (opts && opts.bg) || '#1a3a1a';
    const border = (opts && opts.border) || '#4a4';
    const textColor = (opts && opts.textColor) || '#fff';
    const fontSize = (opts && opts.fontSize) || 14;
    ctx.fillStyle = bg;
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  function isInRect(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  function drawCardBack(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#246';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, CARD_RADIUS);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#135';
    roundRect(x + 4, y + 4, w - 8, h - 8, 3);
    ctx.fill();
    ctx.strokeStyle = '#369';
    ctx.lineWidth = 0.5;
    for (let dy = 8; dy < h - 8; dy += 8) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + dy);
      ctx.lineTo(x + w - 4, y + dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     CARD ANIMATIONS (shared host-side animation system)
     ══════════════════════════════════════════════════════════════════ */

  function updateAnimations(dt) {
    for (const a of dealAnimations) {
      a.t += dt;
      if (a.t >= a.duration) {
        a.done = true;
        a.card._dealing = false;
      }
    }
    dealAnimations = dealAnimations.filter(a => !a.done);

    for (const f of flipAnimations) {
      f.t += dt;
      const half = f.duration / 2;
      if (f.t < half)
        f.scaleX = 1 - (f.t / half);
      else {
        f.scaleX = (f.t - half) / half;
        f.cardRef.faceUp = f.faceUp;
      }
    }
    flipAnimations = flipAnimations.filter(f => f.t < f.duration);

    for (const g of glowCards) g.t += dt;
    glowCards = glowCards.filter(g => g.t < g.duration);

    if (chipSparkleTimer > 0) chipSparkleTimer -= dt;
  }

  function drawDealAnimations() {
    for (const a of dealAnimations) {
      if (a.t < 0) continue;
      const p = Math.min(a.t / a.duration, 1);
      const ease = 1 - (1 - p) * (1 - p);
      const x = a.fromX + (a.toX - a.fromX) * ease;
      const y = a.fromY + (a.toY - a.fromY) * ease;
      drawCardBack(x, y, CARD_W, CARD_H);
    }
  }

  function drawGlowEffects() {
    for (const g of glowCards) {
      const alpha = 0.5 * (1 - g.t / g.duration);
      ctx.save();
      ctx.shadowColor = '#fc0';
      ctx.shadowBlur = 20 + 10 * Math.sin(g.t * 6);
      ctx.fillStyle = 'rgba(255, 200, 0, ' + alpha + ')';
      roundRect(g.x - 3, g.y - 3, g.w + 6, g.h + 6, CARD_RADIUS + 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     VARIANT SELECTION & SETUP
     ══════════════════════════════════════════════════════════════════ */

  function selectGame(variantId) {
    currentVariant = VARIANTS.find(v => v.id === variantId) || VARIANTS[0];
    state = STATE_PLAYING;
    roundNumber = 1;
    dealAnimations = [];
    flipAnimations = [];
    glowCards = [];

    // Clean up previous variant module
    if (activeVariantModule) {
      if (activeVariantModule.cleanup) activeVariantModule.cleanup();
      activeVariantModule = null;
    }

    // All variants are now module-based
    loadVariantModule(currentVariant, function(mod) {
      activeVariantModule = mod;
      mod.setup(ctx, canvas, CANVAS_W, CANVAS_H, host);
      updateWindowTitle();
      updateStatus();
    });
    updateWindowTitle();
    updateStatus();
  }

  function initGame() {
    score = 100;
    if (activeVariantModule) {
      if (activeVariantModule.cleanup) activeVariantModule.cleanup();
      activeVariantModule = null;
    }
    state = STATE_MENU;
    currentVariant = null;
    updateWindowTitle();
    updateStatus();
  }

  /* ══════════════════════════════════════════════════════════════════
     AI TICK
     ══════════════════════════════════════════════════════════════════ */

  function tickAi(dt) {
    if (state !== STATE_PLAYING) return;
    if (activeVariantModule) {
      if (activeVariantModule.tick) activeVariantModule.tick(dt);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleCanvasClick(mx, my) {
    if (state === STATE_MENU) {
      for (let i = 0; i < VARIANTS.length; ++i) {
        const col = i < 5 ? 0 : 1;
        const row = i < 5 ? i : i - 5;
        const bx = 234 + col * 222;
        const by = 115 + row * 58;
        if (isInRect(mx, my, bx, by, 210, 48)) {
          selectGame(VARIANTS[i].id);
          return;
        }
      }
      return;
    }

    if (state === STATE_ROUND_OVER || state === STATE_GAME_OVER) {
      if (state === STATE_GAME_OVER)
        initGame();
      else {
        ++roundNumber;
        selectGame(currentVariant.id);
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    // Menu button hit test
    if (isInRect(mx, my, MENU_BTN.x, MENU_BTN.y, MENU_BTN.w, MENU_BTN.h)) {
      initGame();
      return;
    }

    // Forward to active variant module
    if (activeVariantModule) {
      if (activeVariantModule.handleClick) activeVariantModule.handleClick(mx, my);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleCanvasClick(mx, my);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!activeVariantModule || !activeVariantModule.handlePointerMove) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    activeVariantModule.handlePointerMove(mx, my);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!activeVariantModule || !activeVariantModule.handlePointerUp) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    activeVariantModule.handlePointerUp(mx, my, e);
  });

  /* ══════════════════════════════════════════════════════════════════
     KEYBOARD HANDLING
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      if (currentVariant)
        selectGame(currentVariant.id);
      else
        initGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING) {
        state = STATE_PAUSED;
        updateWindowTitle();
      } else if (state === STATE_PAUSED) {
        state = STATE_PLAYING;
        updateWindowTitle();
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    // Forward to active variant module
    if (activeVariantModule) {
      if (activeVariantModule.handleKey) activeVariantModule.handleKey(e);
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawMenu() {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Card Games Suite', CANVAS_W / 2, 55);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Choose a game to play', CANVAS_W / 2, 82);

    for (let i = 0; i < VARIANTS.length; ++i) {
      const col = i < 5 ? 0 : 1;
      const row = i < 5 ? i : i - 5;
      const bx = 234 + col * 222;
      const by = 115 + row * 58;
      ctx.fillStyle = '#1a3a1a';
      ctx.strokeStyle = '#4a4';
      ctx.lineWidth = 2;
      roundRect(bx, by, 210, 48, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(VARIANTS[i].name, bx + 105, by + 19);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#8a8';
      ctx.fillText(VARIANTS[i].desc, bx + 105, by + 37);
    }
  }

  function drawMenuButton() {
    drawButton(MENU_BTN.x, MENU_BTN.y, MENU_BTN.w, MENU_BTN.h, '\u2630 Menu', { bg: '#333', border: '#666', fontSize: 11 });
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press Escape to resume', CANVAS_W / 2, CANVAS_H / 2 + 20);
  }

  function drawGameOverOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    const msg = state === STATE_GAME_OVER ? 'GAME OVER' : 'ROUND COMPLETE';
    ctx.fillText(msg, CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#fa0';
    ctx.fillText('Score: ' + score, CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }

  function drawTable() {
    const diag = Math.sqrt(CANVAS_W * CANVAS_W + CANVAS_H * CANVAS_H) / 2;
    const grad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 50, CANVAS_W / 2, CANVAS_H / 2, diag);
    grad.addColorStop(0, '#1a4a1a');
    grad.addColorStop(0.85, '#0e350e');
    grad.addColorStop(1, '#0a2a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_MENU) {
      drawTable();
      drawMenu();
    } else {
      screenShake.apply(ctx);
      drawTable();

      // Variant rendering
      if (activeVariantModule)
        activeVariantModule.draw(ctx, CANVAS_W, CANVAS_H);

      drawDealAnimations();
      drawGlowEffects();
      particles.draw(ctx);
      floatingText.draw(ctx);

      if (state === STATE_PLAYING) drawMenuButton();
      if (state === STATE_PAUSED) drawPauseOverlay();
      if (state === STATE_ROUND_OVER || state === STATE_GAME_OVER) drawGameOverOverlay();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    if (state === STATE_PLAYING || state === STATE_ROUND_OVER) {
      updateAnimations(dt);
      tickAi(dt);
    }

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS & PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function updateStatus() {
    const variantEl = document.getElementById('statusVariant');
    const scoreEl = document.getElementById('statusScore');
    const roundEl = document.getElementById('statusRound');
    if (variantEl) variantEl.textContent = 'Game: ' + (currentVariant?.name || '--');
    if (scoreEl) scoreEl.textContent = 'Score: ' + score;
    if (roundEl) roundEl.textContent = 'Round: ' + (roundNumber || '--');
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHighScores() {
    try {
      const scores = loadHighScores();
      scores.push({
        variant: currentVariant?.name || 'Unknown',
        score,
        date: Date.now()
      });
      scores.sort((a, b) => b.score - a.score);
      while (scores.length > MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        '<tr><td>' + (i + 1) + '</td><td>' + s.variant + '</td><td>' + s.score + '</td></tr>'
      ).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        if (currentVariant)
          selectGame(currentVariant.id);
        else
          initGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        updateWindowTitle();
        break;
      case 'back-to-menu':
        initGame();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const variant = currentVariant?.name || 'Card Games Suite';
    const suffix = state === STATE_PAUSED ? ' \u2014 Paused'
      : state === STATE_GAME_OVER ? ' \u2014 Game Over'
      : state === STATE_ROUND_OVER ? ' \u2014 Round Over'
      : '';
    const title = variant + suffix;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  initGame();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
