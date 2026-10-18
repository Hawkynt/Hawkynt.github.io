;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Drawing of feathers, weather, coin rings and the full-screen flash and fade.
     Reads G.feathers, G.weather, G.rings, G.flash, G.fade. */

  const { ctx, ui } = NS.services;
  const G = NS.state;
  const View = NS.view;

  function drawFeathers() {
    for (let i = 0; i < G.feathers.length; ++i) {
      const f = G.feathers[i];
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.size, f.size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-f.size, 0);
      ctx.lineTo(f.size, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* Fireflies glow behind the gates, everything else drifts in front of the ground */
  function drawWeather(layer) {
    for (let i = 0; i < G.weather.length; ++i) {
      const p = G.weather[i];
      if ((p.kind === 'fireflies') !== (layer === 'back'))
        continue;
      ctx.save();
      if (p.kind === 'leaves') {
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sand') {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 1);
      } else if (p.kind === 'snow') {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'fireflies') {
        const pulse = 0.5 + 0.5 * Math.sin(G.globalTime * 4 + p.seed);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.18 * (0.4 + 0.6 * pulse);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'rain') {
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        const inv = 14 / Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * inv, p.y - p.vy * inv);
        ctx.stroke();
      } else if (p.kind === 'embers') {
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.globalTime * 20 + p.seed);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawRings() {
    for (let i = 0; i < G.rings.length; ++i) {
      const r = G.rings[i];
      const u = r.t / 0.25;
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = ui.UI.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + 18 * u, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* Full-screen flash and fade overlays, drawn only while they are visible */
  function drawScreenFx() {
    if (G.flash > 0) {
      const v = View.visibleRect();
      ctx.save();
      ctx.globalAlpha = Math.min(1, G.flash * 0.5);
      ctx.fillStyle = G.flashColor;
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      ctx.restore();
    }
    if (G.fade > 0) {
      const v = View.visibleRect();
      ctx.save();
      ctx.globalAlpha = Math.min(1, G.fade);
      ctx.fillStyle = '#000';
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
      ctx.restore();
    }
  }

  Object.assign(NS.fxDraw, { drawFeathers, drawWeather, drawRings, drawScreenFx });
})();
