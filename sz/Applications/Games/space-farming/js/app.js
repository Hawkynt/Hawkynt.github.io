/* Space Farming - bootstrap: the game loop (with the frame-time monitor), menu actions, window
   resize and theme messages, and start-up.
   Owns: G.lastSeason, G.lastCredits
   Reads: G.canvasW, G.canvasH, G.tutorialSeen, G.state, G.credits, G.highScores, G.currentSeason,
     G.autosaveTimer, G.uiTime, G.frameDt, G.animT, G.lowQuality, G.creditsShown, G.creditsPulse,
     G.creditsDelta, G.creditsDeltaT, G.screenFade, G.dialog */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { MAX_DT, STATE_PLAYING, STATE_PAUSED, STORAGE_TUTORIAL, AUTOSAVE_INTERVAL, SEASONS, SEASON_SPRITES,
    ctx, User32, particles, screenShake, textFitCache, setupCanvas, loadHighScores, saveHighScores,
    renderHighScores, saveGame, checkSavedGame, requestNewGame, updateWeatherVisuals, updateGame,
    updatePenAnimals, updateAmbient, uiParticles, updateFlyers, SEASON_COLORS, announce, isNarrowHud,
    updatePops, openHelp, updateTooltipTimer, refreshHover, updateStatusBar, drawFrame, togglePause,
    clampPan, resetView, updateWindowTitle } = NS;

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;

  /* Frame-time monitor: when frames stay slow the lighter path kicks in
     (coarser night mask, fewer drops, flakes and particles, still trees),
     and it switches back once there is headroom again */
  const frameMon = { avg: 16.7, slow: 0, fast: 0 };

  function monitorFrame(ms) {
    if (!(ms > 0) || ms > 250) return;
    frameMon.avg += (ms - frameMon.avg) * 0.05;
    if (!G.lowQuality) {
      frameMon.slow = frameMon.avg > 30 ? frameMon.slow + ms : 0;
      if (frameMon.slow > 2000) {
        G.lowQuality = true;
        frameMon.fast = 0;
      }
    } else {
      frameMon.fast = frameMon.avg < 19 ? frameMon.fast + ms : 0;
      if (frameMon.fast > 4000) {
        G.lowQuality = false;
        frameMon.slow = 0;
      }
    }
  }

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    if (G.state === STATE_PLAYING && !document.hidden)
      monitorFrame(rawDt * 1000);
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    G.frameDt = Math.max(0.001, dt);
    G.uiTime += dt;

    if (!G.dialog)
      updateGame(dt);
    if (G.state === STATE_PLAYING && !G.dialog) {
      G.animT += dt;
      updatePenAnimals(dt);
    }
    if (G.state === STATE_PLAYING || G.state === STATE_PAUSED)
      updateAmbient(G.state === STATE_PLAYING && !G.dialog ? dt : 0);
    updatePops(dt);
    updateFlyers(dt);
    uiParticles.update();
    updateWeatherVisuals(G.state === STATE_PLAYING && !G.dialog ? dt : 0);

    if (G.state === STATE_PLAYING) {
      G.autosaveTimer += dt;
      if (G.autosaveTimer >= AUTOSAVE_INTERVAL)
        saveGame();
      if (G.lastSeason !== G.currentSeason) {
        if (G.lastSeason >= 0)
          announce(`${SEASONS[G.currentSeason]} has arrived`, ['Crops grow 10% faster', 'Crops grow 25% faster', 'Harvests are 15% bigger', 'Crops grow 40% slower, snow falls'][G.currentSeason], SEASON_COLORS[G.currentSeason], SEASON_SPRITES[G.currentSeason]);
        G.lastSeason = G.currentSeason;
      }
    }

    // Eased credit counter
    const diff = G.credits - G.creditsShown;
    if (Math.abs(diff) < 0.5)
      G.creditsShown = G.credits;
    else
      G.creditsShown += diff * Math.min(1, dt * 10);
    G.creditsPulse = Math.max(0, G.creditsPulse - dt * 3);
    G.creditsDeltaT = Math.max(0, G.creditsDeltaT - dt * 0.8);
    G.screenFade = Math.max(0, G.screenFade - dt * 2.5);

    if (G.state !== STATE_PAUSED && !G.dialog)
      particles.update();
    screenShake.update(dt * 1000);
    refreshHover();
    updateTooltipTimer(dt);

    ctx.clearRect(0, 0, G.canvasW, G.canvasH);
    drawFrame();

    updateStatusBar();
    updateWindowTitle();
    trackCredits();

    animFrameId = requestAnimationFrame(gameLoop);
  }
  function trackCredits() {
    if (G.lastCredits === null || G.state !== STATE_PLAYING) {
      G.lastCredits = G.credits;
      return;
    }
    const d = Math.round(G.credits - G.lastCredits);
    if (d) {
      G.creditsDelta = G.creditsDeltaT > 0 ? G.creditsDelta + d : d;
      G.creditsDeltaT = 1.6;
      if (d > 0)
        G.creditsPulse = 1;
    }
    G.lastCredits = G.credits;
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function showHighScores() {
    handleAction('high-scores');
  }

  function handleAction(action) {
    switch (action) {
      case 'new':
        requestNewGame();
        break;
      case 'pause':
        togglePause();
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
        openHelp(0);
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
    const wasNarrow = isNarrowHud(), wasPortrait = G.canvasH > G.canvasW;
    setupCanvas();
    textFitCache.clear();
    if (G.state === STATE_PLAYING || G.state === STATE_PAUSED) {
      // a turned phone gets the whole farm back in view
      if (isNarrowHud() !== wasNarrow || (G.canvasH > G.canvasW) !== wasPortrait)
        resetView();
      else
        clampPan();
    }
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

  NS.showHighScores = showHighScores;
  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  // the bottom-right corner holds the dock, so the sound switch sits in the menu bar
  const muteButton = SZ.GameAudio.attachMuteButton();
  Object.assign(muteButton.style, { top: '2px', bottom: 'auto', width: '20px', height: '20px', font: '11px/18px sans-serif' });
  loadHighScores();
  checkSavedGame();
  try { G.tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { G.tutorialSeen = false; }
  updateWindowTitle();

  if (!G.tutorialSeen)
    openHelp(0);

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
