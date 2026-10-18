/* Space Farming - DOM handles (canvas, 2D context, status bar cells), canvas sizing for the
   current window and device pixel ratio, and the OS window title.
   Owns: G.canvasW, G.canvasH, G.uiS, G.UW, G.UH
   Reads: G.state, G.credits, G.dayCount, G.currentSeason */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { HUD_MIN_UW, STATE_GAME_OVER, SEASONS } = NS;

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCredits = document.getElementById('statusCredits');
  const statusTool = document.getElementById('statusTool');
  const statusWeather = document.getElementById('statusWeather');
  const statusDay = document.getElementById('statusDay');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    // Reset canvas size so it doesn't inflate parent measurement
    canvas.style.width = '0';
    canvas.style.height = '0';

    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    G.canvasW = Math.floor(rect.width) || 700;
    G.canvasH = Math.floor(rect.height) || 500;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = G.canvasW * dpr;
    canvas.height = G.canvasH * dpr;
    canvas.style.width = G.canvasW + 'px';
    canvas.style.height = G.canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the HUD is laid out on a virtual screen about 690 units tall; a phone
    // still gets room for the side panels next to each other
    G.uiS = Math.min(Math.max(0.7, Math.min(1.6, G.canvasW / 1060, G.canvasH / 690)), G.canvasW / HUD_MIN_UW);
    G.UW = G.canvasW / G.uiS;
    G.UH = G.canvasH / G.uiS;
  }

  let shownTitle = '';

  function updateWindowTitle() {
    const title = G.state === STATE_GAME_OVER
      ? `Space Farming — Season Over — ${G.credits}cr`
      : `Space Farming — Day ${G.dayCount} — ${SEASONS[G.currentSeason]} — ${G.credits}cr`;
    // called every frame: only a changed title goes to the desktop
    if (title === shownTitle)
      return;
    shownTitle = title;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  Object.assign(NS, { canvas, ctx, statusCredits, statusTool, statusWeather, statusDay, highScoresBody,
    User32, setupCanvas, updateWindowTitle });

})();
