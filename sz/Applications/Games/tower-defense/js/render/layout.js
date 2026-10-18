/* render/layout.js -- canvas sizing, UI units and the world and UI transforms.
   Owns state: G.canvasW, G.canvasH, G.dpr, G.uiS, G.UW, G.UH, G.shakeX, G.shakeY
   Reads: constants, env and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { WORLD_W, WORLD_H, TOP_H, BOT_H, clamp } = NS.constants;
  const { canvas, ctx } = NS.env;

  /* ══════════════════════════════════════════════════════════════════
     LAYOUT -- the canvas fills the window; the HUD lives on a virtual
     screen of UI units (uiS screen px each), the map is scaled into the
     space between the top bar and the build bar
     ══════════════════════════════════════════════════════════════════ */
  const view = { x: 0, y: 0, s: 1 };   // world -> screen px

  function setupCanvas() {
    canvas.style.width = '0';
    canvas.style.height = '0';
    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    G.canvasW = Math.max(240, Math.floor(rect.width) || 960);
    G.canvasH = Math.max(180, Math.floor(rect.height) || 640);
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(G.canvasW * G.dpr);
    canvas.height = Math.round(G.canvasH * G.dpr);
    canvas.style.width = G.canvasW + 'px';
    canvas.style.height = G.canvasH + 'px';
    G.uiS = clamp(Math.min(G.canvasW / 1000, G.canvasH / 660), 0.5, 1.8);
    G.UW = G.canvasW / G.uiS;
    G.UH = G.canvasH / G.uiS;
    layoutView();
  }

  function layoutView() {
    const top = (TOP_H + 2) * G.uiS;
    const bottom = G.canvasH - (BOT_H + 2) * G.uiS;
    const availW = G.canvasW - 8 * G.uiS;
    const availH = Math.max(40, bottom - top);
    view.s = Math.min(availW / WORLD_W, availH / WORLD_H);
    view.x = (G.canvasW - WORLD_W * view.s) / 2;
    view.y = top + (availH - WORLD_H * view.s) / 2;
  }

  function setUiTransform() {
    ctx.setTransform(G.dpr * G.uiS, 0, 0, G.dpr * G.uiS, G.dpr * G.shakeX, G.dpr * G.shakeY);
  }

  function setWorldTransform() {
    ctx.setTransform(G.dpr * view.s, 0, 0, G.dpr * view.s, G.dpr * (view.x + G.shakeX), G.dpr * (view.y + G.shakeY));
  }

  // World point -> UI units
  function worldToUi(wx, wy) {
    return { x: (view.x + wx * view.s) / G.uiS, y: (view.y + wy * view.s) / G.uiS };
  }

  NS.layout = { view, setupCanvas, setUiTransform, setWorldTransform, worldToUi };

})();
