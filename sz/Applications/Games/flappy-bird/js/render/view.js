;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Canvas geometry and frame composition: backing-store size, letterboxing, the visible
     logical rect, pointer mapping, the per-biome scene-art cache, and draw(), which shows a
     menu screen or the run with its HUD and panels. Owns G.dpr, G.viewScale/OffX/OffY,
     G.mouseX/Y and G.sceneCache; resets G.hitAreas each frame. */

  const {
    CANVAS_W, CANVAS_H, STATE_TITLE, STATE_WORLDS, STATE_NEST, STATE_AVIARY, STATE_HELP, STATE_READY,
    STATE_PLAYING, STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR
  } = NS.C;
  const { canvas, ctx } = NS.services;
  const G = NS.state;
  const World = NS.world;
  const Hud = NS.hud;
  const Menu = NS.menu;
  const Title = NS.title;
  const Nest = NS.nest;
  const Aviary = NS.aviary;
  const Help = NS.help;
  const Results = NS.results;

  function setupCanvas() {
    // never render more than ~1.5 backing pixels per logical pixel; the browser upscales the rest
    const dprRaw = window.devicePixelRatio || 1;
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
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

  /* Fill the whole canvas (letterbox bars too), then return to logical coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    G.mouseX = ((e.clientX - rect.left) * G.dpr - G.viewOffX) / G.viewScale;
    G.mouseY = ((e.clientY - rect.top) * G.dpr - G.viewOffY) / G.viewScale;
  }

  function sceneFor(biome) {
    return G.sceneCache[biome] || (G.sceneCache[biome] = SZ.FlappySceneArt.create(biome));
  }

  function draw() {
    G.hitAreas.length = 0;

    // Menu screens replace the frozen run with a drifting biome backdrop
    if (G.state === STATE_TITLE || G.state === STATE_WORLDS || G.state === STATE_NEST ||
      G.state === STATE_AVIARY || G.state === STATE_HELP) {
      Menu.drawMenuBackground();
      if (G.state === STATE_TITLE)
        Title.drawTitleScreen();
      else if (G.state === STATE_WORLDS)
        Title.drawWorldsScreen();
      else if (G.state === STATE_NEST)
        Nest.drawNestScreen();
      else if (G.state === STATE_AVIARY)
        Aviary.drawAviaryScreen();
      else
        Help.drawHelpScreen();
      return;
    }

    ctx.save();
    World.drawRunScene();
    if (G.state === STATE_PLAYING || G.state === STATE_DYING || G.state === STATE_PAUSED)
      Hud.drawHud();
    if (G.biomeBanner > 0 && G.state !== STATE_READY)
      Hud.drawBiomeBanner();
    if (G.state === STATE_READY)
      Hud.drawReadyOverlay();
    if (G.state === STATE_PAUSED)
      Results.drawPausePanel();
    if (G.state === STATE_DEAD)
      Results.drawDeathPanel();
    if (G.state === STATE_CLEAR)
      Results.drawClearPanel();
    ctx.restore();
  }

  Object.assign(NS.view, { setupCanvas, beginFrame, visibleRect, pointerToLogical, sceneFor, draw });
})();
