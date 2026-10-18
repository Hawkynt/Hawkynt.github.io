/* Space Farming - weather drawing: craters, scorch marks, rain rings, meteors, aurora, dust and
   the screen-space rain, snow and flashes.
   Reads: G.canvasW, G.canvasH, G.viewZoom, G.viewPanY, G.meteors, G.bolts, G.decals, G.splashes, G.flashA,
     G.wxShown, G.wxK, G.wxDrops, G.animT */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER, WEATHER_RAIN, WEATHER_THUNDERSTORM,
    WEATHER_SNOW, WEATHER_DUST, ctx, METEOR_FLIGHT, horizonWorldY, drawTwinkle, lightAt } = NS;

  /* World-space weather marks: craters, scorch marks, rain rings, incoming meteors */
  function drawWeatherWorld() {
    for (const d of G.decals) {
      const a = Math.min(1, (d.life - d.t) / 4) * (d.kind === 'crater' ? 0.75 : 0.55);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = d.kind === 'crater' ? '#2a1a12' : '#1a1418';
      ctx.beginPath();
      ctx.ellipse(d.wx, d.wy + 4, d.kind === 'crater' ? 14 : 10, d.kind === 'crater' ? 6 : 4, 0, 0, TWO_PI);
      ctx.fill();
      if (d.kind === 'crater' && d.t < 3) {
        ctx.globalAlpha = (1 - d.t / 3) * 0.8;
        ctx.fillStyle = '#ff8a3a';
        ctx.beginPath();
        ctx.ellipse(d.wx, d.wy + 4, 6, 2.5, 0, 0, TWO_PI);
        ctx.fill();
        lightAt(d.wx, d.wy, 50, '#ff8a3a', 1 - d.t / 3);
      }
      ctx.restore();
    }
    for (const s of G.splashes) {
      const k = s.t / 0.45;
      ctx.strokeStyle = `rgba(200,230,255,${0.6 * (1 - k)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(s.wx, s.wy, 2 + k * 7, 1 + k * 3, 0, 0, TWO_PI);
      ctx.stroke();
    }
  }

  function drawMeteorsWorld() {
    for (const m of G.meteors) {
      if (m.delay > 0) continue;
      const k = m.t / METEOR_FLIGHT;
      const sx = m.wx + 420 * (1 - k), sy = m.wy - 640 * (1 - k);
      const tx = sx + 420 * 0.16, ty = sy - 640 * 0.16;
      const g = ctx.createLinearGradient(sx, sy, tx, ty);
      g.addColorStop(0, 'rgba(255,240,180,0.95)');
      g.addColorStop(0.3, 'rgba(255,140,60,0.7)');
      g.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, TWO_PI);
      ctx.fill();
      lightAt(sx, sy, 70, '#ffa050', 1);
      // shadow of the incoming rock
      ctx.fillStyle = `rgba(0,0,0,${0.3 * k})`;
      ctx.beginPath();
      ctx.ellipse(m.wx, m.wy + 4, 4 + k * 8, 2 + k * 3, 0, 0, TWO_PI);
      ctx.fill();
    }
  }

  /* Aurora ribbons in the sky during a solar flare */
  function drawAurora() {
    if (G.wxShown !== WEATHER_SOLAR_FLARE || G.wxK < 0.02) return;
    const hy = G.viewPanY + horizonWorldY() * G.viewZoom;
    if (hy <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cols = ['80,255,170', '120,200,255', '255,160,240'];
    for (let k = 0; k < 3; ++k) {
      ctx.beginPath();
      const base = hy * (0.25 + k * 0.15);
      for (let x = 0; x <= G.canvasW; x += 16) {
        const y = base + Math.sin(x * 0.006 + G.animT * 0.6 + k * 2) * 26 + Math.sin(x * 0.017 - G.animT * 0.9 + k) * 10;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let x = G.canvasW; x >= 0; x -= 16) {
        const y = base + 50 + Math.sin(x * 0.006 + G.animT * 0.6 + k * 2 + 0.4) * 26;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - 30, 0, base + 80);
      g.addColorStop(0, `rgba(${cols[k]},0)`);
      g.addColorStop(0.5, `rgba(${cols[k]},${0.22 * G.wxK})`);
      g.addColorStop(1, `rgba(${cols[k]},0)`);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  let dustBandCanvas = null;
  function dustBand() {
    if (!dustBandCanvas) {
      dustBandCanvas = document.createElement('canvas');
      dustBandCanvas.width = 4;
      dustBandCanvas.height = 120;
      const g = dustBandCanvas.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 120);
      gr.addColorStop(0, 'rgba(210,160,90,0)');
      gr.addColorStop(0.5, 'rgba(210,160,90,0.18)');
      gr.addColorStop(1, 'rgba(210,160,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, 120);
    }
    return dustBandCanvas;
  }


  /* Screen-space weather on top of the farm */
  function drawWeatherOverlay() {
    const k = G.wxK;
    if (k > 0.01) {
      ctx.save();
      switch (G.wxShown) {
        case WEATHER_SOLAR_FLARE: {
          ctx.fillStyle = `rgba(255,200,60,${0.10 * k})`;
          ctx.fillRect(0, 0, G.canvasW, G.canvasH);
          const g = ctx.createRadialGradient(G.canvasW * 0.5, -60, 20, G.canvasW * 0.5, -60, G.canvasH);
          g.addColorStop(0, `rgba(255,240,140,${0.35 * k})`);
          g.addColorStop(1, 'rgba(255,220,100,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, G.canvasW, G.canvasH);
          for (const d of G.wxDrops) {
            const a = Math.min(1, d.t, d.life - d.t) * 0.7 * k;
            ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(d.t * 4 + d.ph));
            drawTwinkle(d.x, d.y, d.size * 1.6, 1);
          }
          break;
        }
        case WEATHER_RAIN:
        case WEATHER_THUNDERSTORM: {
          ctx.fillStyle = G.wxShown === WEATHER_RAIN ? `rgba(30,50,110,${0.16 * k})` : `rgba(15,15,40,${0.28 * k})`;
          ctx.fillRect(0, 0, G.canvasW, G.canvasH);
          ctx.strokeStyle = G.wxShown === WEATHER_RAIN ? `rgba(170,210,255,${0.55 * k})` : `rgba(190,200,255,${0.6 * k})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (const d of G.wxDrops) {
            const f = d.len / Math.hypot(d.vx, d.vy);
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - d.vx * f, d.y - d.vy * f);
          }
          ctx.stroke();
          break;
        }
        case WEATHER_SNOW: {
          ctx.fillStyle = `rgba(220,235,255,${0.12 * k})`;
          ctx.fillRect(0, 0, G.canvasW, G.canvasH);
          ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
          for (const d of G.wxDrops) {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size, 0, TWO_PI);
            ctx.fill();
          }
          break;
        }
        case WEATHER_DUST: {
          ctx.fillStyle = `rgba(190,140,80,${0.28 * k})`;
          ctx.fillRect(0, 0, G.canvasW, G.canvasH);
          const band = dustBand();
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = k;
          for (let i = 0; i < 3; ++i) {
            const y = G.canvasH * (0.2 + i * 0.3) + Math.sin(G.animT * 0.7 + i) * 40;
            ctx.drawImage(band, 0, y - 60, G.canvasW, 120);
          }
          ctx.imageSmoothingEnabled = true;
          ctx.globalAlpha = 1;
          ctx.fillStyle = `rgba(230,190,130,${0.6 * k})`;
          for (const d of G.wxDrops)
            ctx.fillRect(d.x, d.y, d.size * 4, d.size * 0.8);
          break;
        }
        case WEATHER_METEOR_SHOWER:
          ctx.fillStyle = `rgba(120,30,20,${0.12 * k})`;
          ctx.fillRect(0, 0, G.canvasW, G.canvasH);
          break;
      }
      ctx.restore();
    }
    // lightning bolts and flash
    for (const b of G.bolts) {
      const a = 1 - b.t / 0.35;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(b.pts[0][0], b.pts[0][1]);
      for (const p of b.pts) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = `rgba(160,200,255,${0.25 * a})`;
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.strokeStyle = `rgba(200,220,255,${a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    if (G.flashA > 0) {
      ctx.fillStyle = `rgba(230,240,255,${G.flashA * 0.5})`;
      ctx.fillRect(0, 0, G.canvasW, G.canvasH);
    }
  }

  Object.assign(NS, { drawWeatherWorld, drawMeteorsWorld, drawAurora, drawWeatherOverlay });

})();
