;(function() {
  'use strict';

  /* Drawing what flies: dishes to guests, dishes to the pass, tip coins,
     rings and the step-finish words. Reads G only. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { SEAT_Y, FLY_TIME, ARC_TIME, COIN_TIME, COIN_TX, COIN_TY } = NS.C;
  const { ctx, ui } = NS.view;
  const { fx } = NS.juice;

  function drawFlying() {
    for (const f of G.flying) {
      const k = Math.min(1, f.t / FLY_TIME);
      const x = f.x !== undefined ? f.x : f.x0 + (f.customer.x - f.x0) * k;
      const y = f.y !== undefined ? f.y : f.y0 + (SEAT_Y - 60 - f.y0) * k - Math.sin(k * Math.PI) * 90;
      const s = 1 + Math.sin(k * Math.PI) * 0.25;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(k * Math.PI * 2) * 0.25);
      ctx.scale(s, s);
      SZ.FoodArt.drawDish(ctx, f.recipe, 0, 0, 60, 1, f.quality);
      ctx.restore();
    }
  }

  /* finished dishes arcing from their station to the pass */
  function drawArcs() {
    for (const a of G.arcs) {
      const k = Math.min(1, a.t / ARC_TIME);
      const x = a.x0 + (a.x1 - a.x0) * k;
      const y = a.y0 + (a.y1 - a.y0) * k - Math.sin(k * Math.PI) * 110;
      const s = 0.8 + Math.sin(k * Math.PI) * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((1 - k) * Math.PI * 2 * (a.x1 > a.x0 ? 1 : -1) * 0.5);
      ctx.scale(s, s);
      SZ.FoodArt.drawDish(ctx, a.recipe, 0, 0, 64, 1, a.quality);
      ctx.restore();
    }
  }

  function drawCoins() {
    for (const c of G.coins) {
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / COIN_TIME);
      const e = k * k * (3 - 2 * k);
      const u = 1 - e;
      const x = u * u * c.x0 + 2 * u * e * c.cx + e * e * COIN_TX;
      const y = u * u * c.y0 + 2 * u * e * c.cy + e * e * COIN_TY;
      const sz = 26 - 6 * k + Math.sin(k * Math.PI) * 10;
      const img = fx.coinFrame(Math.floor(c.t * 20 + c.x0));
      if (img) ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
      if (Math.random() < 0.5) fx.emit('spark', x, y, 1, { color: '#ffd23f', speed: 20, gravity: 0, life: 0.3, size: 12 });
    }
  }

  /* expanding rings: goal stars, VIP arrival, anger puffs, combo pops */
  function drawRings() {
    for (const r of G.rings) {
      const k = r.t / 0.5;
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + e * 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* step-finish words: chunky headline popping in, then rising and fading */
  function drawPops() {
    for (const p of G.pops) {
      const k = p.t / 0.7;
      const s = k < 0.15 ? 0.3 + 1.2 * (k / 0.15) : k < 0.3 ? 1.5 - 0.5 * ((k - 0.15) / 0.15) : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
      ctx.translate(p.x, p.y - Math.max(0, k - 0.3) * 40);
      ctx.rotate(Math.sin(k * 8) * 0.04);
      ctx.scale(s, s);
      ui.drawHeadline(p.text, 0, 0, 400, Math.round(p.size * 1.25), p.color, p.color === '#ffd23f' ? '#ff7a1a' : undefined);
      ctx.restore();
    }
  }

  NS.flightsView = { drawCoins, drawFlying, drawArcs, drawRings, drawPops };

})();
