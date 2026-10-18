;(function() {
  'use strict';

  /* Boot and the frame: the game loop (timing, the day systems, juice
     updates), drawing one frame of a menu or of the play view, the menu
     bar actions, desktop window wiring and the initial state. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, MAX_DT, STATE_TITLE, STATE_CAREER, STATE_UPGRADES, STATE_RECIPES,
    STATE_PLAYING, STATE_PAUSED, STATE_DAY_OVER, CHEF_Y, WAITER_Y } = NS.C;
  const { canvas, ctx, User32, setupCanvas, visibleRect, beginFrame, fillVisibleRect } = NS.view;
  const { fx, screenShake } = NS.juice;
  const { loadSave } = NS.persist;
  const { isMenuState } = NS.rules;
  const { updateWindowTitle, updateStatus, showHighScores } = NS.status;
  const { updateFx } = NS.effects;
  const { updateCoins } = NS.serving;
  const { updatePlaying, updateDayOver } = NS.day;
  const { drawCustomers, drawCustomerOverlays, drawCarpet } = NS.guestsView;
  const { drawPass, drawBurnAlerts, drawStations, drawStationBars } = NS.kitchenView;
  const { drawCoins, drawFlying, drawArcs, drawRings, drawPops } = NS.flightsView;
  const { drawHUD, drawTicketRail } = NS.hud;
  const { drawCoach } = NS.coachMarks;
  const { drawIris, drawRushGlow, drawTension, drawComboBanner, drawDayIntro, drawEdgeGlow } = NS.overlays;
  const { setScreen } = NS.menu;
  const { drawTitleScreen } = NS.titleScreen;
  const { drawCareerScreen } = NS.careerScreen;
  const { drawUpgradesScreen } = NS.treeScreen;
  const { drawRecipeBook } = NS.recipeBook;
  const { drawHelp } = NS.helpScreen;
  const { drawPauseOverlay, drawDayOver } = NS.results;
  const { attachInput } = NS.input;

  let lastTimestamp = 0;

  function draw() {
    beginFrame();
    G.hitAreas.length = 0;
    if (isMenuState(G.state)) {
      if (G.state === STATE_TITLE) drawTitleScreen();
      else if (G.state === STATE_CAREER) drawCareerScreen();
      else if (G.state === STATE_UPGRADES) drawUpgradesScreen();
      else if (G.state === STATE_RECIPES) drawRecipeBook();
      else drawHelp();
      fx.draw(ctx);
      fx.drawTexts(ctx);
      if (G.menuFade > 0) {
        ctx.fillStyle = 'rgba(12,8,5,' + (0.5 * Math.min(1, G.menuFade / 0.5)).toFixed(3) + ')';
        fillVisibleRect();
      }
      if (G.fade > 0) drawIris(G.fade);
      return;
    }
    ctx.save();
    screenShake.apply(ctx);
    G.scene.draw(ctx, G.animT, visibleRect());
    drawCarpet();
    drawCustomers();
    G.scene.drawFront(ctx);
    drawPass();
    drawCustomerOverlays();
    if (G.waiter) {
      SZ.PeopleArt.drawCustomer(ctx, G.waiterLook, G.waiter.x, WAITER_Y, 'walk', G.animT, G.waiter.facing);
      if (G.waiter.state === 'toGuest')
        SZ.FoodArt.drawDish(ctx, G.waiter.dish.recipe, G.waiter.x + G.waiter.facing * 16, WAITER_Y - 76 + Math.abs(Math.sin(G.animT * 16)) * -3, 50, 1, G.waiter.dish.quality);
    }
    drawStations();
    const moving = Math.abs(G.chefTargetX - G.chefX) > 4;
    SZ.PeopleArt.drawChef(ctx, G.chefX, CHEF_Y, moving && G.chefPose === 'idle' ? 'run' : G.chefPose, G.animT, G.chefFacing);
    drawStationBars();
    drawArcs();
    drawFlying();
    if (G.sceneFade > 0) {
      ctx.fillStyle = 'rgba(12,8,5,' + Math.min(1, G.sceneFade / 0.6).toFixed(3) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    screenShake.restore(ctx);
    ctx.restore();
    drawRings();
    if (G.state !== STATE_DAY_OVER) fx.draw(ctx);
    drawCoins();
    drawPops();
    if (G.state !== STATE_DAY_OVER) fx.drawTexts(ctx);
    if (G.hitFlash) {
      ctx.fillStyle = 'rgba(' + G.hitFlash.color + ',' + (G.hitFlash.t * 0.6).toFixed(3) + ')';
      fillVisibleRect();
    }
    if (G.rushTimer > 0) drawRushGlow();
    if (G.tension > 0) drawTension();
    drawHUD();
    if (G.comboBanner) drawComboBanner();
    if (G.dayIntro > 0 && G.state === STATE_PLAYING) drawDayIntro();
    if (G.edgeGlow > 0) drawEdgeGlow();
    drawTicketRail();
    drawBurnAlerts();
    G.coachSkip = null;
    if (G.coach && G.state === STATE_PLAYING) drawCoach();
    if (G.state === STATE_PAUSED) drawPauseOverlay();
    if (G.state === STATE_DAY_OVER) {
      drawDayOver();
      fx.draw(ctx);
      fx.drawTexts(ctx);
    }
    if (G.fade > 0) drawIris(G.fade);
  }

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    G.animT += dt;

    if (G.state === STATE_PLAYING) updatePlaying(dt);

    if (G.state === STATE_DAY_OVER) updateDayOver(dt);

    if (G.state !== STATE_PLAYING && G.tension > 0) G.tension = Math.max(0, G.tension - dt * 2);
    if (G.menuFade > 0) G.menuFade = Math.max(0, G.menuFade - dt);
    if (G.fade > 0) G.fade = Math.max(0, G.fade - dt * 3.5);
    if (G.earnedShown < G.earned)
      G.earnedShown = Math.min(G.earned, G.earnedShown + Math.max(3, (G.earned - G.earnedShown) * dt * 6));
    else G.earnedShown = G.earned;
    updateCoins(dt);
    updateFx(dt);
    fx.update(dt);
    screenShake.update(dt * 1000);

    draw();
    requestAnimationFrame(gameLoop);
  }

  function handleAction(action) {
    switch (action) {
      case 'new':
        setScreen(STATE_TITLE);
        break;
      case 'pause':
        if (G.state === STATE_PLAYING)
          G.state = STATE_PAUSED;
        else if (G.state === STATE_PAUSED)
          G.state = STATE_PLAYING;
        updateWindowTitle();
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

  /* Desktop window messages and resizes re-fit the canvas. */
  function attachWindow() {
    if (User32?.RegisterWindowProc) {
      User32.RegisterWindowProc((msg) => {
        if (msg === 'WM_SIZE')
          setupCanvas();
        else if (msg === 'WM_THEMECHANGED')
          setupCanvas();
      });
    }

    window.addEventListener('resize', setupCanvas);

    /* Re-fit on maximize/restore/drag-resize of the desktop window */
    if (typeof ResizeObserver === 'function')
      new ResizeObserver(setupCanvas).observe(canvas);
  }

  function initGame() {
    G.state = STATE_TITLE;
    G.menuFade = 0.5;
    G.hitAreas.length = 0;
    G.menuCursor = 0;
    G.dayInfo = null;
    G.scene = null;
    G.customers = [];
    G.tickets = [];
    G.pass = [];
    G.flying = [];
    G.coins = [];
    G.earned = 0;
    G.served = 0;
    G.walkouts = 0;
    G.combo = 0;
    G.ruinedServed = 0;
    G.perfectServed = 0;
    G.rushTimer = 0;
    G.rushUsed = false;
    G.rescueUsed = false;
    G.endlessPhase = 0;
    G.sceneFade = 0;
    G.waiter = null;
    G.waiterLook = null;
    G.dayResult = null;
    G.arcs = [];
    G.pops = [];
    G.rings = [];
    G.earnedShown = 0;
    G.meterTick = 0;
    G.goalsHit = 0;
    G.comboBanner = null;
    G.edgeGlow = 0;
    G.tension = 0;
    G.dayOverT = 0;
    G.starPopped = 0;
    G.carpet = null;
    G.coach = null;
    G.coachSkip = null;
    G.fade = 1;
    G.save = loadSave();
    fx.clear();
    updateWindowTitle();
    updateStatus();
  }

  attachInput();
  attachWindow();
  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: handleAction
  });

  /* let the page accept keyboard focus on the body so clicks keep the keys alive */
  document.body.tabIndex = -1;
  setupCanvas();
  initGame();
  SZ.GameAudio.attachMuteButton();
  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
