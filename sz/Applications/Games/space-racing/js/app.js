/*
 * Bootstrap: per-frame update and draw order, status bar, the game loop with
 * adaptive render scale, menu-bar actions, OS window integration and startup.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { MAX_DT, STATE_TITLE, STATE_CAREER, STATE_CUP_INTRO, STATE_TRACKS, STATE_GARAGE, STATE_TREE,
    STATE_PLAYING, STATE_PAUSED, STATE_RESULTS, STATE_STANDINGS, STORAGE_TUTORIAL } = NS.constants;
  const { SHIP_DEFS, TRACKS, trackVariant } = NS.defs;
  const { formatTime, getOrdinal } = NS.util;
  const { ctx, statusPosition, statusLap, statusSpeed, statusTime, statusCredits, User32, particles,
    screenShake, floatingText } = NS.runtime;
  const { loadHighScores, saveHighScores, loadSave, renderHighScores } = NS.save;
  const { getPlayerShipDef } = NS.progress;
  const { prepareTrack } = NS.raceSetup;
  const { updateShip, updateSlipstream, updateRaceStart, isThrottleHeld } = NS.player;
  const { updateAI } = NS.ai;
  const { checkBoostPads, checkHazards, applyGravity, checkWormholes } = NS.features;
  const { updateItems } = NS.items;
  const { updateRace } = NS.race;
  const { updateRaceAudio } = NS.raceAudio;
  const { emitThrustParticles, updateSpeedLines, updateTrails, updateSkids, updateAmbient,
    updateFlashes, updateConfetti } = NS.effects;
  const { setupCanvas, beginFrame, updateCamera, applyWorldTransform } = NS.view;
  const { drawTrails, drawSkids, drawAmbient, drawFlashes, drawBackground, drawTrack, drawBoostPads,
    drawHazards, drawGravityBodies, drawWormholes, drawItemBoxes, drawMissiles, drawMines,
    drawShockwaves, drawShip, drawSpeedLines, drawNameChips } = NS.world;
  const { drawHUD } = NS.hud;
  const { enterTitle, enterGarage, pauseRacing, enterTree, isMenuState, updateWindowTitle } = NS.flow;
  const { initTitleShips, drawTitleScreen, drawCareerScreen, drawCupIntroScreen, drawTracksScreen,
    drawGarageScreen } = NS.screens;
  const { drawResultsScreen, drawStandingsScreen, drawPausePanel, drawTutorialOverlay } = NS.results;
  const { drawTreeScreen } = NS.treeScreen;
  const Input = NS.module('input');

  let frameMsAvg = 16;       // smoothed real frame time
  let slowFrameTime = 0;     // seconds the frame time has stayed too high

  /* ── Tutorial ── */
  let tutorialSeen = false;

  function updateGame(dt) {
    G.globalTime += dt;
    if (G.state === STATE_RESULTS) {
      G.resultsTime += dt;
      updateConfetti(dt);
      const tick = Math.floor(G.resultsTime / 0.1);
      if (G.resultsTime < 1.2 && tick > G.coinTick) {
        G.coinTick = tick;
        SZ.GameAudio.play('coin', { volume: 0.3 });
      }
    } else if (G.state === STATE_STANDINGS) {
      G.standingsTime += dt;
    }
    if (G.state === STATE_PAUSED || G.state === STATE_TREE || isMenuState(G.state)) return;

    updateRaceStart(dt);
    updateShip(dt);
    updateSlipstream(dt);
    updateAI(dt);
    applyGravity(dt);
    checkBoostPads();
    checkHazards();
    checkWormholes(dt);
    updateItems(dt);
    emitThrustParticles(dt);
    updateRace(dt);
    updateRaceAudio(dt);
    updateCamera(dt);
    updateSpeedLines(dt);
    updateSkids(dt);
    updateTrails();
    updateAmbient(dt);
    updateFlashes(dt);
  }

  function drawGame() {
    G.hitAreas.length = 0;

    if (G.state === STATE_TREE) {
      drawTreeScreen();
      return;
    }

    if (isMenuState(G.state)) {
      if (G.state === STATE_TITLE)
        drawTitleScreen();
      else if (G.state === STATE_CAREER)
        drawCareerScreen();
      else if (G.state === STATE_CUP_INTRO)
        drawCupIntroScreen();
      else if (G.state === STATE_TRACKS)
        drawTracksScreen();
      else if (G.state === STATE_GARAGE)
        drawGarageScreen();
      else if (G.state === STATE_RESULTS)
        drawResultsScreen();
      else
        drawStandingsScreen();
      if (G.showTutorial)
        drawTutorialOverlay();
      return;
    }

    drawBackground();
    drawAmbient();
    ctx.save();
    applyWorldTransform();
    drawTrack();
    drawSkids();
    drawGravityBodies();
    drawWormholes();
    drawBoostPads();
    drawHazards();
    drawItemBoxes();
    drawMines();
    drawMissiles();
    drawTrails();

    // Draw AI opponents
    for (let i = 0; i < G.opponents.length; ++i) {
      const ai = G.opponents[i];
      drawShip(ai.x, ai.y, ai.angle, ai.color, ai.accentColor, ai.exhaustColor, ai.shape, false, ai.speed > 50, ai.bank, ai.shieldTime > 0);
    }

    // Draw player ship
    const pd = getPlayerShipDef();
    drawShip(G.ship.x, G.ship.y, G.ship.angle, pd.color, pd.accentColor, pd.exhaustColor, pd.shape, true, isThrottleHeld(), G.ship.bank, G.ship.shieldTime > 0);
    drawShockwaves();
    particles.draw(ctx);
    floatingText.draw(ctx);
    ctx.restore();

    drawSpeedLines();
    drawNameChips();
    drawHUD();
    drawFlashes();

    if (G.state === STATE_PAUSED)
      drawPausePanel();

    if (G.showTutorial)
      drawTutorialOverlay();
  }

  function setStatus(el, text) {
    if (el && el.textContent !== text)
      el.textContent = text;
  }

  function updateStatusBar() {
    setStatus(statusPosition, `Pos: ${getOrdinal(G.playerPlace)}`);
    setStatus(statusLap, `Lap: ${Math.min(G.playerLap + 1, G.raceLaps)}/${G.raceLaps}`);
    setStatus(statusSpeed, `Speed: ${Math.round(G.ship.speed)}`);
    setStatus(statusTime, `Time: ${formatTime(G.raceTime)}`);
    setStatus(statusCredits, `Credits: ${G.credits}`);
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    // adaptive quality: when racing stays below ~40 fps for 2 s, render fewer pixels
    if (rawDt > 0 && rawDt < 0.25) {
      frameMsAvg += (rawDt * 1000 - frameMsAvg) * 0.05;
      if (G.state === STATE_PLAYING && frameMsAvg > 25 && G.renderScale > 0.6) {
        slowFrameTime += rawDt;
        if (slowFrameTime > 2) {
          G.renderScale = Math.max(0.6, G.renderScale - 0.15);
          slowFrameTime = 0;
          frameMsAvg = 16;
          setupCanvas();
        }
      } else
        slowFrameTime = 0;
    }

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    beginFrame();
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    screenShake.restore(ctx);
    ctx.restore();

    updateStatusBar();

    // Clear just-pressed flags at end of frame
    G.keyJustPressed = {};

    animFrameId = requestAnimationFrame(gameLoop);
  }

  function handleAction(action) {
    switch (action) {
      case 'new':
        enterTitle();
        break;
      case 'pause':
        if (G.state === STATE_PLAYING)
          pauseRacing();
        else if (G.state === STATE_PAUSED)
          G.state = STATE_PLAYING;
        break;
      case 'ship-select':
        if (isMenuState(G.state))
          enterGarage();
        break;
      case 'upgrades':
        if (isMenuState(G.state))
          enterTree();
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            G.highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'tutorial':
        G.showTutorial = true;
        G.tutorialPage = 0;
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
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

  Input.attach();

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

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  SZ.GameAudio.attachMuteButton();
  setupCanvas();
  loadHighScores();
  loadSave();
  G.credits = G.save.credits;
  const savedShipIndex = SHIP_DEFS.findIndex(d => d.id === G.save.selectedShip);
  if (savedShipIndex >= 0)
    G.selectedShipIndex = savedShipIndex;
  try { tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { tutorialSeen = false; }

  // a random track serves as the menu background until a race picks one
  G.currentTrackIndex = Math.floor(Math.random() * TRACKS.length);
  G.currentVariant = trackVariant(G.currentTrackIndex, false);
  initTitleShips();
  prepareTrack();
  updateWindowTitle();

  if (!tutorialSeen) {
    G.showTutorial = true;
    G.tutorialPage = 0;
    tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
