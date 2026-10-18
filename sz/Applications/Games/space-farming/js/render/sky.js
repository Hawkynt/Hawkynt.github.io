/* Space Farming - the sky: gradient by time and season, stars, planets, sun, moon and mountains.
   Reads: G.canvasW, G.canvasH, G.currentSeason, G.dayPhase, G.viewZoom, G.viewPanX, G.viewPanY, G.animT */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, ctx, mulberry32, mixHex, nightAmount, duskAmount, SEASON_PAL, drawGlow, horizonWorldY } = NS;

  /* ── Sky: gradient by time of day and season, stars, planets, sun, moon ── */

  const skyStars = [];
  for (let i = 0; i < 220; ++i)
    skyStars.push({ x: Math.random(), y: Math.random(), s: Math.random(), p: Math.random() * TWO_PI });

  const MOUNTAINS = [0, 1, 2].map(k => {
    const pts = [];
    const rnd = mulberry32(99 + k * 31);
    const f = [rnd() * 3, rnd() * 3, rnd() * 3];
    for (let i = 0; i <= 256; ++i) {
      const x = i / 256 * TWO_PI;
      pts.push(Math.sin(x * 2 + f[0]) * 0.45 + Math.sin(x * 5 + f[1]) * 0.3 + Math.sin(x * 11 + f[2]) * 0.15 + (k === 0 ? Math.max(0, Math.sin(x * 3 + f[0])) * 0.5 : 0));
    }
    return pts;
  });

  function skyColors(n, d) {
    if (n === undefined) {
      n = nightAmount();
      d = duskAmount();
    }
    const season = G.currentSeason;
    let top = mixHex(['#3a7ae0', '#3a86e8', '#4a6ab8', '#7a9ad0'][season], '#070a1e', n);
    let mid = mixHex(['#8ad8e8', '#a8dcf0', '#e0a87a', '#c8dcef'][season], '#1a1840', n);
    let low = mixHex(['#c8f0d8', '#fff0b0', '#ffc890', '#f0f4ff'][season], '#2a2050', n);
    if (d > 0) {
      top = mixHex(top, '#4a3a8a', d * 0.6);
      mid = mixHex(mid, '#ff8a6a', d * 0.7);
      low = mixHex(low, '#ffc86a', d * 0.8);
    }
    return { top, mid, low, n, d };
  }

  /* The sky gradient, nebula, planets and mountains only change slowly, so
     they are baked into two screen-wide bitmaps (behind and in front of the
     sun and moon) and repainted when the light or the view changes */
  const skyLayers = { back: null, front: null, key: '' };

  function skyLayerCanvas(name, W, H) {
    let cv = skyLayers[name];
    if (!cv)
      cv = skyLayers[name] = document.createElement('canvas');
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    return cv;
  }

  function drawSky() {
    // the light is stepped in small increments so the layers are reused between steps
    const qn = Math.round(nightAmount() * 48) / 48, qd = Math.round(duskAmount() * 48) / 48;
    const sc = skyColors(qn, qd);
    const hy = G.viewPanY + horizonWorldY() * G.viewZoom;
    const R = Math.min(G.canvasW, G.canvasH) * 0.12;
    if (hy <= 0) {
      const g = ctx.createLinearGradient(0, Math.min(0, hy - G.canvasH), 0, Math.max(hy, 10));
      g.addColorStop(0, sc.top);
      g.addColorStop(0.65, sc.mid);
      g.addColorStop(1, sc.low);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, G.canvasW, Math.max(0, Math.min(G.canvasH, hy + 4)));
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    const skyH = Math.max(1, Math.min(G.canvasH, Math.ceil(hy + 4)));
    const W = Math.round(G.canvasW * dpr), H = Math.round(skyH * dpr);
    const key = [W, H, dpr, qn, qd, G.currentSeason, G.viewZoom.toFixed(4), G.viewPanX.toFixed(1), G.viewPanY.toFixed(1)].join('|');
    const back = skyLayerCanvas('back', W, H), front = skyLayerCanvas('front', W, H);
    const gx = G.canvasW * 0.8 + G.viewPanX * 0.04, gy = Math.max(R * 0.75, hy - R * 1.6) + G.viewPanY * 0.02;
    if (key !== skyLayers.key) {
      skyLayers.key = key;
      let g = back.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, G.canvasW, skyH);
      const gr = g.createLinearGradient(0, Math.min(0, hy - G.canvasH), 0, Math.max(hy, 10));
      gr.addColorStop(0, sc.top);
      gr.addColorStop(0.65, sc.mid);
      gr.addColorStop(1, sc.low);
      g.fillStyle = gr;
      g.fillRect(0, 0, G.canvasW, Math.max(0, Math.min(G.canvasH, hy + 4)));
      if (sc.n > 0.05) {
        g.save();
        g.globalAlpha = sc.n * 0.25;
        const ng = g.createRadialGradient(G.canvasW * 0.3, hy * 0.35, 10, G.canvasW * 0.3, hy * 0.35, G.canvasW * 0.35);
        ng.addColorStop(0, '#a060d0');
        ng.addColorStop(1, 'rgba(160,96,208,0)');
        g.fillStyle = ng;
        g.fillRect(0, 0, G.canvasW, hy);
        g.restore();
      }
      // Ringed gas giant and a small moon, drifting with a hint of parallax
      g.save();
      g.globalAlpha = 0.55 + sc.n * 0.4;
      const pg = g.createRadialGradient(gx - R * 0.4, gy - R * 0.4, R * 0.1, gx, gy, R);
      pg.addColorStop(0, '#ffe0b0');
      pg.addColorStop(0.55, '#e08a6a');
      pg.addColorStop(1, '#6a3060');
      g.fillStyle = pg;
      g.beginPath();
      g.arc(gx, gy, R, 0, TWO_PI);
      g.fill();
      g.translate(gx, gy);
      g.rotate(-0.3);
      g.scale(1, 0.26);
      g.lineWidth = R * 0.22;
      g.strokeStyle = 'rgba(255,225,180,0.5)';
      g.beginPath();
      g.arc(0, 0, R * 1.6, Math.PI * 0.02, Math.PI * 0.98);
      g.stroke();
      g.restore();
      const mx = G.canvasW * 0.18 + G.viewPanX * 0.06, my = hy - R * 2.2 + G.viewPanY * 0.03;
      g.save();
      g.globalAlpha = 0.5 + sc.n * 0.5;
      g.fillStyle = '#c8d0e8';
      g.beginPath();
      g.arc(mx, my, R * 0.28, 0, TWO_PI);
      g.fill();
      g.fillStyle = 'rgba(120,130,170,0.6)';
      g.beginPath();
      g.arc(mx - R * 0.08, my - R * 0.06, R * 0.07, 0, TWO_PI);
      g.arc(mx + R * 0.1, my + R * 0.08, R * 0.05, 0, TWO_PI);
      g.fill();
      g.restore();

      g = front.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, G.canvasW, skyH);
      // Mountain layers with atmospheric perspective
      const layerCols = [
        mixHex(sc.mid, '#3a4a7a', 0.45 + sc.n * 0.2),
        mixHex(sc.mid, '#24405a', 0.65 + sc.n * 0.15),
        mixHex(SEASON_PAL[G.currentSeason].turf[0], '#0a1424', 0.25 + sc.n * 0.5)
      ];
      const heights = [1, 0.62, 0.3];
      const para = [0.15, 0.3, 0.55];
      for (let k = 0; k < 3; ++k) {
        const pts = MOUNTAINS[k];
        const period = 1600 * Math.max(0.5, G.viewZoom) * (1 + k * 0.3);
        const amp = Math.min(hy * 0.75, 160 * Math.max(0.5, Math.min(1.4, G.viewZoom))) * heights[k];
        const base = hy + 2 - k * 2;
        const off = ((G.viewPanX * para[k]) % period + period) % period;
        g.fillStyle = layerCols[k];
        g.beginPath();
        g.moveTo(0, base);
        for (let x = 0; x <= G.canvasW + 8; x += 8) {
          const u = ((x - off) / period % 1 + 1) % 1;
          const i = u * 256, i0 = Math.floor(i), fr = i - i0;
          const v = pts[i0] * (1 - fr) + pts[Math.min(256, i0 + 1)] * fr;
          g.lineTo(x, base - amp * (0.55 + v * 0.45));
        }
        g.lineTo(G.canvasW, base);
        g.closePath();
        g.fill();
        if (G.currentSeason === 3 && k < 2) {
          g.save();
          g.clip();
          g.fillStyle = 'rgba(240,246,255,0.55)';
          g.fillRect(0, base - amp * 1.1, G.canvasW, amp * 0.35);
          g.restore();
        }
      }
      // Summer haze / horizon glow
      const hz = g.createLinearGradient(0, hy - 60, 0, hy + 4);
      hz.addColorStop(0, 'rgba(255,255,255,0)');
      hz.addColorStop(1, G.currentSeason === 1 ? `rgba(255,236,180,${0.35 * (1 - sc.n)})` : `rgba(220,240,255,${0.18 * (1 - sc.n)})`);
      g.fillStyle = hz;
      g.fillRect(0, hy - 60, G.canvasW, 64);
    }
    ctx.drawImage(back, 0, 0, G.canvasW, skyH);

    // Stars at night (not in front of the planet)
    if (sc.n > 0.05) {
      ctx.save();
      for (const s of skyStars) {
        const sy = s.y * hy;
        if (sy > hy - 10) continue;
        const sx = ((s.x * G.canvasW + G.viewPanX * 0.03) % G.canvasW + G.canvasW) % G.canvasW;
        if ((sx - gx) * (sx - gx) + (sy - gy) * (sy - gy) < R * R * 1.1) continue;
        ctx.globalAlpha = sc.n * (0.3 + 0.7 * Math.abs(Math.sin(G.animT * (0.4 + s.s) + s.p)));
        ctx.fillStyle = s.s > 0.88 ? '#ffe8b0' : '#cfe0ff';
        const sz = s.s > 0.92 ? 2 : 1;
        ctx.fillRect(sx, sy, sz, sz);
      }
      ctx.restore();
    }

    // Sun by day, moon by night, travelling over the sky
    const arcX = (u) => G.canvasW * (0.1 + 0.8 * u);
    const arcY = (u) => hy - Math.sin(u * Math.PI) * Math.min(hy * 0.8, G.canvasH * 0.5) + 30;
    if (G.dayPhase < 0.55) {
      const u = G.dayPhase / 0.55;
      const sx = arcX(u), sy = arcY(u);
      const sr = Math.max(10, R * 0.32);
      drawGlow(sx, sy, sr * 4, '#fff0b4', 0.55 * (1 - sc.n));
      ctx.fillStyle = sc.d > 0.3 ? '#ffb070' : '#fff4c8';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TWO_PI);
      ctx.fill();
    } else {
      const u = (G.dayPhase - 0.5) / 0.5;
      const sx = arcX(u), sy = arcY(u);
      const sr = Math.max(8, R * 0.24);
      ctx.save();
      ctx.globalAlpha = Math.min(1, sc.n * 1.4);
      drawGlow(sx, sy, sr * 3.5, '#c8dcff', 0.35);
      ctx.fillStyle = '#eef2ff';
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = sc.top;
      ctx.beginPath();
      ctx.arc(sx + sr * 0.45, sy - sr * 0.2, sr * 0.85, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(front, 0, 0, G.canvasW, skyH);
  }

  Object.assign(NS, { drawSky });

})();
