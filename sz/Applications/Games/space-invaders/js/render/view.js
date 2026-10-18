/* The canvas, its 2D context and the UI kit; fits the 1280 x 720 game plane into the window
   and maps pointer positions into it. Owns the canvas size and scale. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const { GAME_W, GAME_H } = NS.constants;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  let canvasW = GAME_W;
  let canvasH = GAME_H;
  let dpr = 1;
  let gameScale = 1;
  let gameOffsetX = 0;
  let gameOffsetY = 0;

  function resizeCanvas() {
    // the frame's content box: its padding and border stay around the canvas
    const parent = canvas.parentElement;
    const cs = getComputedStyle(parent);
    canvasW = Math.max(1, parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    canvasH = Math.max(1, parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    // never render more than ~1.5 backing pixels per logical pixel
    const fit = Math.min(canvasW / GAME_W, canvasH / GAME_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(canvasW * dpr);
    canvas.height = Math.round(canvasH * dpr);
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    gameScale = fit;
    gameOffsetX = (canvasW - GAME_W * gameScale) / 2;
    gameOffsetY = (canvasH - GAME_H * gameScale) / 2;
  }

  window.addEventListener('resize', resizeCanvas);

  /* Clear the whole canvas and switch to game coordinates */
  function beginViewFrame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.translate(gameOffsetX, gameOffsetY);
    ctx.scale(gameScale, gameScale);
  }

  /* The part of the game plane the canvas actually shows. The play field stays
     1280x720 and is centred, so on any other aspect ratio the visible plane
     reaches past it - only the backdrop and the full-screen overlays follow. */
  function visibleRect() {
    return {
      x0: -gameOffsetX / gameScale,
      y0: -gameOffsetY / gameScale,
      x1: (canvasW - gameOffsetX) / gameScale,
      y1: (canvasH - gameOffsetY) / gameScale,
    };
  }

  /* Paint over every visible pixel, in game coordinates. */
  function fillVisible() {
    const v = visibleRect();
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function canvasToGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - gameOffsetX) / gameScale,
      y: (clientY - rect.top - gameOffsetY) / gameScale,
    };
  }

  const ui = SZ.InvadersUI.create(ctx);

  Object.assign(NS.view, {
    canvas, ctx, visibleRect, resizeCanvas, beginViewFrame, fillVisible, canvasToGame, ui
  });
})();
