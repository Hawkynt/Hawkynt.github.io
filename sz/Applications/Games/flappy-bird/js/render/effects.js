;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Drawing of feathers, biome and seasonal weather, coin rings, pipe debris and the
     full-screen flash and fade. Small shapes come from the cached particle sprites.
     Reads G.feathers, G.weather, G.rings, G.debris, G.flash, G.fade. */

  const { ctx, ui } = NS.services;
  const G = NS.state;
  const View = NS.view;
  const sprite = SZ.FlappyParticles.sprite;

  function drawFeathers() {
    for (let i = 0; i < G.feathers.length; ++i) {
      const f = G.feathers[i];
      const c = Math.cos(f.rot), s = Math.sin(f.rot);
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life / 0.4);
      ctx.transform(c, s, -s, c, f.x, f.y);
      ctx.drawImage(sprite('petal', f.color), -f.size, -f.size * 0.6, f.size * 2, f.size * 1.2);
      ctx.restore();
    }
  }

  /* Fireflies glow behind the gates, everything else drifts in front of the ground */
  function drawWeather(layer) {
    const base = ctx.globalAlpha;
    for (let i = 0; i < G.weather.length; ++i) {
      const p = G.weather[i];
      if ((p.kind === 'fireflies') !== (layer === 'back'))
        continue;
      if (p.kind === 'leaves' || p.kind === 'petal' || p.kind === 'aleaf') {
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        ctx.save();
        ctx.globalAlpha = base * p.alpha;
        ctx.transform(c, s, -s, c, p.x, p.y);
        const img = sprite(p.kind === 'petal' ? 'petal' : 'leaf', p.color);
        ctx.drawImage(img, -p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
        ctx.restore();
      } else if (p.kind === 'sand') {
        ctx.globalAlpha = base * p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 1);
      } else if (p.kind === 'snow') {
        ctx.globalAlpha = base * p.alpha;
        ctx.drawImage(sprite('circle', p.color), p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.kind === 'fireflies') {
        const pulse = 0.5 + 0.5 * Math.sin(G.globalTime * 4 + p.seed);
        ctx.globalAlpha = base * (0.35 + 0.55 * pulse);
        ctx.drawImage(sprite('glow', p.color), p.x - 8, p.y - 8, 16, 16);
      } else if (p.kind === 'rain') {
        ctx.globalAlpha = base * p.alpha;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        const inv = 14 / Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * inv, p.y - p.vy * inv);
        ctx.stroke();
      } else if (p.kind === 'embers') {
        ctx.globalAlpha = base * (0.5 + 0.5 * Math.sin(G.globalTime * 20 + p.seed));
        ctx.drawImage(sprite('glow', p.color), p.x - 4, p.y - 4, 8, 8);
      } else if (p.kind === 'glint') {
        ctx.globalAlpha = base * Math.sin(Math.PI * Math.max(0, p.life));
        ctx.drawImage(sprite('star', p.color), p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.kind === 'sbat') {
        const flap = Math.sin(G.globalTime * 18 + p.seed) * 0.6;
        ctx.globalAlpha = base * 0.85;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(p.x - p.size, p.y - p.size * flap, p.x - p.size * 1.8, p.y + p.size * 0.2);
        ctx.quadraticCurveTo(p.x - p.size * 0.8, p.y + p.size * 0.1, p.x, p.y + p.size * 0.4);
        ctx.quadraticCurveTo(p.x + p.size * 0.8, p.y + p.size * 0.1, p.x + p.size * 1.8, p.y + p.size * 0.2);
        ctx.quadraticCurveTo(p.x + p.size, p.y - p.size * flap, p.x, p.y);
        ctx.fill();
      }
    }
    ctx.globalAlpha = base;
  }

  function drawRings() {
    for (let i = 0; i < G.rings.length; ++i) {
      const r = G.rings[i];
      const u = r.t / 0.25;
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = ui.UI.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 8 + 18 * u, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawDebris() {
    for (let i = 0; i < G.debris.length; ++i) {
      const d = G.debris[i];
      const c = Math.cos(d.rot), s = Math.sin(d.rot);
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.life / 0.4);
      ctx.transform(c, s, -s, c, d.x, d.y);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-d.w / 2, d.h / 2 - 3, d.w, 3);
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

  Object.assign(NS.fxDraw, { drawFeathers, drawWeather, drawRings, drawDebris, drawScreenFx });
})();
