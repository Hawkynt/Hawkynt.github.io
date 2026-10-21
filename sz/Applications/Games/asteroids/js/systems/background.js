/* The starfield: a pre-rendered nebula background canvas, the drifting twinkling
   star layer and its initialization for the current field size. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;

  function generateBackground() {
    const bg = document.createElement('canvas');
    bg.width = S.W;
    bg.height = S.H;
    const bgCtx = bg.getContext('2d');

    const grad = bgCtx.createRadialGradient(S.W / 2, S.H / 2, 0, S.W / 2, S.H / 2, S.W * 0.8);
    grad.addColorStop(0, '#0d0d1a');
    grad.addColorStop(1, '#050510');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, S.W, S.H);

    const cloudCount = Math.round(6 * (S.W / 520));
    for (let i = 0; i < cloudCount; ++i) {
      const x = Math.random() * S.W;
      const y = Math.random() * S.H;
      const r = (80 + Math.random() * 60) * S.uiS;
      const c = [
        Math.floor(10 + Math.random() * 40),
        Math.floor(10 + Math.random() * 25),
        Math.floor(30 + Math.random() * 35)
      ];
      const cg = bgCtx.createRadialGradient(x, y, 0, x, y, r);
      cg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.35)`);
      cg.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},0.12)`);
      cg.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      bgCtx.fillStyle = cg;
      bgCtx.fillRect(0, 0, S.W, S.H);
    }

    return bg;
  }

  function initStars() {
    S.stars.length = 0;
    const count = Math.round(C.BASE_STAR_COUNT * (S.W * S.H) / (520 * 520));
    for (let i = 0; i < count; ++i) {
      const driftAngle = Math.random() * Math.PI * 2;
      const driftSpeed = 0.01 + Math.random() * 0.04;
      S.stars.push({
        x: Math.random() * S.W,
        y: Math.random() * S.H,
        baseBrightness: 0.2 + Math.random() * 0.8,
        size: 0.4 + Math.random() * 1.6,
        twinkleSpeed: 0.5 + Math.random() * 3,
        twinklePhase: Math.random() * Math.PI * 2,
        color: T.STAR_COLORS[Math.floor(Math.random() * T.STAR_COLORS.length)],
        driftVx: Math.cos(driftAngle) * driftSpeed,
        driftVy: Math.sin(driftAngle) * driftSpeed
      });
    }
  }

  function updateStars() {
    if (S.warpState) {
      NS.warp.updateWarpStars();
      return;
    }
    for (const s of S.stars) {
      s.x += s.driftVx;
      s.y += s.driftVy;
      if (s.x < 0) s.x += S.W;
      if (s.x > S.W) s.x -= S.W;
      if (s.y < 0) s.y += S.H;
      if (s.y > S.H) s.y -= S.H;
    }
  }

  Object.assign(NS.background, { generateBackground, initStars, updateStars });
})();
