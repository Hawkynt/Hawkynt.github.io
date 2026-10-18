;(function() {
  'use strict';

  // Game loop, menu actions, OS integration and start-up.
  // Owns: NS.app
  // Reads: constants, dom, gameState, persistence, relocation, chests, update, scene, tooltip
  // Reads state of: hudFading, gameState, persistence, time

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, MAX_DT, STATE_PLAYING, STATE_PAUSED, STATE_GAME_OVER, STATE_CINEMATIC,
    STATE_MINIGAME, STORAGE_TUTORIAL } = NS.constants;
  const { canvas, ctx, User32, particles, screenShake, floatingText } = NS.dom;
  const { setupCanvas } = NS.gameState;
  const { loadHighScores, saveHighScores, renderHighScores, saveRun, readSavedRun, requestNewGame } = NS.persistence;
  const { updateCinematic } = NS.relocation;
  const { updateMinigame } = NS.chests;
  const { updateGame } = NS.update;
  const { drawGame } = NS.scene;
  const { updateTooltipHover, drawTooltip, updateStatusBar } = NS.tooltip;

  /* ======================================================================
     GAME LOOP
     ====================================================================== */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    G.frameDt = dt;
    ++G.hudFrame;

    // Always update animations (even on title/pause/game-over for visual polish)
    G.animTime += G.state !== STATE_PLAYING ? dt : 0;
    updateGame(dt);
    if (G.state === STATE_CINEMATIC)
      updateCinematic(dt);
    if (G.state === STATE_MINIGAME)
      updateMinigame(dt);
    updateTooltipHover(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.setTransform(G.renderScale, 0, 0, G.renderScale, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    // Draw tooltip outside screen shake so it stays stable
    drawTooltip();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ======================================================================
     MENU ACTIONS
     ====================================================================== */

  function handleAction(action) {
    switch (action) {
      case 'new':
        requestNewGame();
        break;
      case 'pause':
        if (G.state === STATE_PLAYING) {
          G.state = STATE_PAUSED;
          saveRun();
        } else if (G.state === STATE_PAUSED)
          G.state = STATE_PLAYING;
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

  /* ======================================================================
     OS INTEGRATION
     ====================================================================== */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = G.state === STATE_GAME_OVER
      ? `Dome Keeper -- Game Over -- Wave ${G.waveNumber}`
      : `Dome Keeper -- Day ${G.world.day} -- Score ${G.score}`;
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
  if (typeof ResizeObserver === 'function' && canvas.parentElement)
    new ResizeObserver(handleResize).observe(canvas.parentElement);

  /* ======================================================================
     INIT
     ====================================================================== */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  {
    const muteBtn = SZ.GameAudio.attachMuteButton(document.querySelector('.status-bar'));
    muteBtn.style.position = 'static';
    muteBtn.style.margin = '0 0 0 auto';
    muteBtn.style.width = muteBtn.style.height = '18px';
    muteBtn.style.font = '11px/16px sans-serif';
  }

  setupCanvas();
  loadHighScores();
  G.saveAvailable = !!readSavedRun();
  try { G.tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL) === '1'; } catch (_) { G.tutorialSeen = false; }
  updateWindowTitle();

  if (!G.tutorialSeen) {
    G.showTutorial = true;
    G.tutorialPage = 0;
    G.tutorialSeen = true;
    try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

  NS.app = { updateWindowTitle };
})();
