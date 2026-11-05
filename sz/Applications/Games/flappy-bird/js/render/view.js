;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Canvas geometry and frame composition: backing-store size, letterboxing, the visible
     logical rect, pointer mapping, the per-biome scene-art cache, and draw(), which shows a
     menu screen, a cinematic or the run with its HUD and panels, then the toasts. Owns G.dpr,
     G.viewScale/OffX/OffY, G.mouseX/Y and G.sceneCache; resets G.hitAreas each frame. */

  const {
    CANVAS_W, CANVAS_H, STATE_TITLE, STATE_WORLDS, STATE_MODES, STATE_NEST, STATE_AVIARY, STATE_GOALS, STATE_HELP,
    STATE_CINE, STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR, MENU_STATES
  } = NS.C;
  const { canvas, ctx } = NS.services;
  const G = NS.state;

  let lastCssW = 0, lastCssH = 0, lastDpr = 0;

  function setupCanvas() {
    // never render more than ~1.5 backing pixels per logical pixel; the browser upscales the rest
    const dprRaw = window.devicePixelRatio || 1;
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    lastCssW = cssW;
    lastCssH = cssH;
    lastDpr = dprRaw;
    const fit = Math.min(cssW / CANVAS_W, cssH / CANVAS_H);
    G.dpr = Math.max(0.5, Math.min(dprRaw, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * G.dpr);
    canvas.height = Math.round(cssH * G.dpr);
    G.viewScale = Math.min(canvas.width / CANVAS_W, canvas.height / CANVAS_H);
    G.viewOffX = Math.round((canvas.width - CANVAS_W * G.viewScale) / 2);
    G.viewOffY = Math.round((canvas.height - CANVAS_H * G.viewScale) / 2);
    ctx.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
    ctx.imageSmoothingEnabled = true;
  }

  /* the iframe can change size without a window resize event (maximize, restore):
     check the element size every frame and refit when it moved */
  function checkResize() {
    if (canvas.clientWidth !== lastCssW || canvas.clientHeight !== lastCssH || (window.devicePixelRatio || 1) !== lastDpr)
      setupCanvas();
  }

  /* Fill the whole canvas (letterbox bars too), then return to logical coordinates */
  function beginFrame() {
    checkResize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#10202a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(G.viewScale, 0, 0, G.viewScale, G.viewOffX, G.viewOffY);
  }

  /* The logical rectangle the canvas really shows: the 1280 x 720 game area
     plus the letterbox bars whenever the window aspect ratio is not 16:9.
     Game logic stays inside the game area, scenery and overlays use this. */
  function visibleRect() {
    return {
      x0: -G.viewOffX / G.viewScale,
      y0: -G.viewOffY / G.viewScale,
      x1: (canvas.width - G.viewOffX) / G.viewScale,
      y1: (canvas.height - G.viewOffY) / G.viewScale
    };
  }

  /* Pointer event -> logical coordinates */
  function pointerToLogical(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width), sy = canvas.height / Math.max(1, rect.height);
    G.mouseX = ((e.clientX - rect.left) * sx - G.viewOffX) / G.viewScale;
    G.mouseY = ((e.clientY - rect.top) * sy - G.viewOffY) / G.viewScale;
  }

  function sceneFor(biome) {
    return G.sceneCache[biome] || (G.sceneCache[biome] = SZ.FlappySceneArt.create(biome));
  }

  function draw() {
    G.hitAreas.length = 0;

    if (G.state === STATE_CINE) {
      NS.cineDraw.draw();
      NS.hud.drawToasts();
      return;
    }

    // Menu screens replace the frozen run with a drifting biome backdrop
    if (MENU_STATES.indexOf(G.state) >= 0) {
      NS.menu.drawMenuBackground();
      if (G.state === STATE_TITLE)
        NS.title.drawTitleScreen();
      else if (G.state === STATE_WORLDS)
        NS.map.drawMapScreen();
      else if (G.state === STATE_MODES)
        NS.modes.drawModesScreen();
      else if (G.state === STATE_NEST)
        NS.nest.drawNestScreen();
      else if (G.state === STATE_AVIARY)
        NS.aviary.drawAviaryScreen();
      else if (G.state === STATE_GOALS)
        NS.goalsUi.drawGoalsScreen();
      else if (G.state === STATE_HELP)
        NS.help.drawHelpScreen();
      NS.hud.drawToasts();
      return;
    }

    ctx.save();
    NS.world.drawRunScene();
    if (G.state === STATE_PLAYING || G.state === STATE_DYING || G.state === STATE_PAUSED)
      NS.hud.drawHud();
    if (G.biomeBanner > 0 && !(G.bossIntro > 0) && (G.state === STATE_PLAYING || G.state === STATE_PAUSED))
      NS.hud.drawBiomeBanner();
    if (G.bossIntro > 0 && G.boss)
      NS.hud.drawBossIntro();
    if (G.state === STATE_READY)
      NS.hud.drawReadyOverlay();
    if (G.state === STATE_PAUSED)
      NS.results.drawPausePanel();
    if (G.state === STATE_DEAD)
      NS.results.drawDeathPanel();
    if (G.state === STATE_CLEAR)
      NS.results.drawClearPanel();
    ctx.restore();
    NS.hud.drawToasts();
  }

  Object.assign(NS.view, { setupCanvas, checkResize, beginFrame, visibleRect, pointerToLogical, sceneFor, draw });
})();
