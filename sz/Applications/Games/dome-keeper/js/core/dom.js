;(function() {
  'use strict';

  // Canvas and status-bar elements, the OS window API and the shared particle, shake and floating-text effects.
  // Owns: NS.dom and these state fields:
  //   G.surfaceArt, G.daylight, G.duskGlow
  // Reads: constants, textLayout

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H } = NS.constants;

  /* ======================================================================
     DOM
     ====================================================================== */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusView = document.getElementById('statusView');
  const statusWave = document.getElementById('statusWave');
  const statusDome = document.getElementById('statusDome');
  const statusResources = document.getElementById('statusResources');
  const highScoresBody = document.getElementById('highScoresBody');

  /* -- API: Windows integration -- */
  const { User32 } = SZ?.Dlls ?? {};

  /* -- Effects -- */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();
  {
    // Floating messages use the UI font and are kept fully on screen
    const addFloating = floatingText.add.bind(floatingText);
    const recentFloats = [];
    floatingText.add = (x, y, text, opts) => {
      opts = Object.assign({}, opts);
      opts.font = (opts.font || 'bold 14px sans-serif').replace(/sans-serif$/, NS.textLayout.UI_FONT);
      ctx.save();
      ctx.font = opts.font;
      const half = ctx.measureText(String(text)).width / 2 + 8;
      ctx.restore();
      x = half * 2 >= CANVAS_W ? CANVAS_W / 2 : Math.max(half, Math.min(CANVAS_W - half, x));
      y = Math.max(96, Math.min(CANVAS_H - 24, y));
      // Stack messages that pop up at the same spot instead of overlapping them
      const now = performance.now();
      while (recentFloats.length && now - recentFloats[0].t > 700)
        recentFloats.shift();
      const lineH = (parseFloat((/(\d+(?:\.\d+)?)px/.exec(opts.font) || [0, 14])[1]) || 14) * 1.2;
      for (let tries = 0; tries < 5 && recentFloats.some(r => Math.abs(r.x - x) < r.half + half && Math.abs(r.y - (now - r.t) * 0.09 - y) < lineH); ++tries)
        y -= lineH;
      recentFloats.push({ x, y, half, t: now }); // y drifts up ~0.09 px/ms
      addFloating(x, y, text, opts);
    };
  }
  G.surfaceArt = null;                 // cached sky, mountains, ground and plants of the site
  G.daylight = 0;                      // 0 = night .. 1 = full day (sky and land colours)
  G.duskGlow = 0;                      // warm sunrise / sunset tint
  const enemyHitFlash = new WeakMap();   // enemy -> white flash strength after a hit

  NS.dom = { canvas, ctx, statusView, statusWave, statusDome, statusResources, highScoresBody, User32,
    particles, screenShake, floatingText, enemyHitFlash };
})();
