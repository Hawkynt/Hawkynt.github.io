/* Space Farming - banner, floating pop texts anchored to the farm, and toasts.
   Reads: G.uiS, G.UW, G.viewZoom, G.viewPanX, G.viewPanY, G.frameDt, G.banner */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { ctx, drawSprite, fitText, UI, hexToRgba, drawPanel, drawChip } = NS;

  /* ── Banner (season changes, weather, purchases) ── */

  function drawBanner(L) {
    if (!G.banner) return;
    G.banner.t += G.frameDt;
    const dur = 3.2;
    if (G.banner.t > dur) {
      G.banner = null;
      return;
    }
    const t = G.banner.t;
    const inA = Math.min(1, t / 0.35), outA = Math.min(1, (dur - t) / 0.5);
    const a = Math.min(inA, outA);
    const ease = 1 - Math.pow(1 - inA, 3);
    const w = Math.min(480, G.UW - 40), h = G.banner.sub ? 66 : 48;
    const x = G.UW / 2 - w / 2, y = L.clock.y + L.clock.h + 12 - (1 - ease) * 20;
    ctx.save();
    ctx.globalAlpha *= a;
    drawPanel(x, y, w, h, { accent: G.banner.color, glow: true, radius: 12 });
    let tx = x + 16;
    if (G.banner.icon) {
      drawSprite(G.banner.icon, x + 34, y + h / 2, 34);
      tx = x + 60;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(G.banner.title, tx, y + (G.banner.sub ? 24 : h / 2 + 1), x + w - 16 - tx, 20, { weight: 'bold', color: G.banner.color });
    if (G.banner.sub)
      fitText(G.banner.sub, tx, y + 46, x + w - 16 - tx, 13, { color: UI.textDim });
    ctx.restore();
  }


  /* ── Pop texts (anchored to the farm) and toasts ── */

  const pops = [];
  const toasts = [];

  function popText(wx, wy, text, opts) {
    opts = opts || {};
    const m = /(\d+)px/.exec(opts.font || '');
    const size = m ? Math.max(11, parseInt(m[1], 10) + 1) : 13;
    pops.push({ wx, wy, text: String(text), color: opts.color || '#fff', size, t: 0, life: 1.3, dx: (Math.random() - 0.5) * 10 });
    if (pops.length > 60)
      pops.shift();
  }

  function toast(text, color, icon) {
    toasts.push({ text, color: color || UI.text, icon, t: 0 });
    if (toasts.length > 4)
      toasts.shift();
  }

  function updatePops(dt) {
    for (let i = pops.length - 1; i >= 0; --i) {
      pops[i].t += dt;
      if (pops[i].t >= pops[i].life)
        pops.splice(i, 1);
    }
    for (let i = toasts.length - 1; i >= 0; --i) {
      toasts[i].t += dt;
      if (toasts[i].t >= 3)
        toasts.splice(i, 1);
    }
  }

  function drawPops() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of pops) {
      const k = p.t / p.life;
      const sx = (G.viewPanX + p.wx * G.viewZoom) / G.uiS + p.dx * k;
      const sy = (G.viewPanY + p.wy * G.viewZoom) / G.uiS - k * 34 - Math.sin(Math.min(1, k * 4) * Math.PI) * 6;
      const scale = k < 0.12 ? 0.6 + k / 0.12 * 0.5 : (k < 0.25 ? 1.1 - (k - 0.12) / 0.13 * 0.1 : 1);
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      fitText(p.text, 0, 0, 260, p.size, { weight: 'bold', color: p.color, outline: 'rgba(0,0,0,0.8)' });
      ctx.restore();
    }
    ctx.restore();
  }

  function drawToasts(L) {
    let y = L.clock.y + L.clock.h + 10 + (G.banner ? 78 : 0);
    for (const tst of toasts) {
      const a = Math.min(1, tst.t * 5, (3 - tst.t) * 2);
      ctx.save();
      ctx.globalAlpha *= a;
      const text = (tst.icon ? `[[${tst.icon}]] ` : '') + tst.text;
      drawChip(text, G.UW / 2, y - (1 - Math.min(1, tst.t * 5)) * 8, 24, { align: 'center', px: 12, bg: 'rgba(8,12,24,0.85)', border: hexToRgba(tst.color, 0.6), color: tst.color, maxW: G.UW - 40 });
      ctx.restore();
      y += 30;
    }
  }

  Object.assign(NS, { drawBanner, popText, toast, updatePops, drawPops, drawToasts });

})();
