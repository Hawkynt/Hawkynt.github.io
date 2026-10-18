/* Bootstrap: the game loop, the menu-screen dispatcher and screen fade, resize / OS integration,
   the public API and start-up. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, MAX_DT, FADE_RATE, ELEMENTS, STATE_PLAYING, STATE_PAUSED, isMenuState, REALM_DUST,
    REALM_ROCK, ROBES, TREE_BRANCHES, TREE } = NS.consts;
  const { canvas, ctx, User32, particles, screenShake, floatingText, Fx, fxScreen } = NS.context;
  const { setupCanvas, visibleRect, beginFrame } = NS.view;
  const { loadSave, loadHighScores, loadTutorialSeen } = NS.store;
  const { treeLevel, nodeState, buyNode, selectRobe } = NS.grimoire;
  const { dailyIndex, campaignUnlocked, trialUnlocked, loadDailyPuzzle, loadPuzzle, restartLevel } = NS.session;
  const { updateCelebration } = NS.win;
  const { updateGame } = NS.update;
  const { drawGame } = NS.board;
  const { drawOverlays } = NS.overlays;
  const { setScreen, updateStatusBar } = NS.screens;
  const { drawTitleScreen } = NS.title;
  const { drawRealmsScreen, drawTrialsScreen } = NS.campaign;
  const { drawGrimoire } = NS.grimoireScreen;
  const { drawWardrobe } = NS.wardrobe;
  const { drawHelp } = NS.help;
  const { handleAction } = NS.input;

  function drawMenuScreen() {
    if (G.state === 'title')
      drawTitleScreen();
    else if (G.state === 'realms')
      drawRealmsScreen();
    else if (G.state === 'trials')
      drawTrialsScreen();
    else if (G.state === 'grimoire')
      drawGrimoire();
    else if (G.state === 'wardrobe')
      drawWardrobe();
    else
      drawHelp();
  }

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.max(0, Math.min(rawDt, MAX_DT));
    lastTimestamp = timestamp;
    G.frameDt = dt;

    if (isMenuState(G.state)) {
      G.time += dt;
      particles.update();
      floatingText.update();
      fxScreen.update(dt);
      beginFrame();
      G.hitAreas.length = 0;
      drawMenuScreen();
      particles.draw(ctx);
      fxScreen.draw(ctx);
      floatingText.draw(ctx);
      drawFade(dt);
      updateStatusBar();
      animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    if (G.state !== STATE_PAUSED)
      updateGame(dt);

    particles.update();
    fxScreen.update(dt);
    updateCelebration(dt);
    screenShake.update(dt * 1000);
    floatingText.update();

    beginFrame();
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    drawOverlays();
    fxScreen.draw(ctx);
    drawFade(dt);
    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* the black wash over the visible rect while a screen change settles in */
  function drawFade(dt) {
    if (G.fade <= 0)
      return;
    /* an iris opening from the centre with a soft violet edge */
    const v = visibleRect();
    const k = 1 - G.fade;
    const r = 30 + k * k * 900;
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, r * 0.55, VIEW_W / 2, VIEW_H / 2, r);
    g.addColorStop(0, 'rgba(8,4,18,0)');
    g.addColorStop(0.7, 'rgba(30,14,50,' + (0.6 * G.fade).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(4,2,10,' + Math.min(1, G.fade * 1.4).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    G.fade = Math.max(0, G.fade - dt * FADE_RATE * 0.8);
  }

  function handleResize() {
    setupCanvas();
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
  if (window.ResizeObserver)
    new ResizeObserver(handleResize).observe(canvas);

  /* the public API on the game namespace */
  Object.assign(NS, {
    loadPuzzle, loadDailyPuzzle, restartLevel,
    dailyIndex, campaignUnlocked, trialUnlocked,
    treeLevel, nodeState, buyNode, selectRobe,
    TREE, TREE_BRANCHES, ROBES
  });

  SZ.Dialog.wireAll();

  new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  /* paint the particle sprites now rather than in the middle of the first spell */
  {
    const warm = Fx.create(2000);
    Fx.fire(warm, 0, 0); Fx.melt(warm, 0, 0); Fx.splash(warm, 0, 0); Fx.rune(warm, 0, 0, '#d080ff');
    Fx.gust(warm, 0, 0, 1, 0, '#8ac050'); Fx.gust(warm, 0, 0, 1, 0, '#c8b088'); Fx.starBurst(warm, 0, 0); Fx.confetti(warm, 0, 0, 12);
    for (let r = 0; r < 5; ++r) {
      Fx.quake(warm, 0, 0, REALM_ROCK[r], REALM_DUST[r]);
      Fx.step(warm, 0, 0, REALM_DUST[r], false);
      Fx.portal(warm, 0, 0, SZ.PuzzleLevels.REALMS[r].color);
      for (let k = 0; k < 40; ++k)
        Fx.ambient(warm, r, 100, 100, 1);
    }
    for (const el of ELEMENTS) {
      Fx.sprite('glow', el.color);
      Fx.sprite('spark', el.color);
    }
    for (let k = 0; k < 20; ++k)
      warm.update(0.1);
    warm.clear();
  }
  loadSave();
  loadHighScores();
  loadTutorialSeen();
  loadPuzzle('campaign', 0);
  SZ.GameAudio.attachMuteButton();

  /* let the page accept keyboard focus so clicks keep the keys alive */
  document.body.tabIndex = -1;

  setScreen('title');

  // Walk first-time players through the Help screen before anything else
  if (!G.tutorialSeen) {
    G.helpFrom = 'title';
    G.helpPage = 0;
    G.state = 'help';
  }

  // Auto-pause when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.state === STATE_PLAYING)
      G.state = STATE_PAUSED;
  });

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);
})();
