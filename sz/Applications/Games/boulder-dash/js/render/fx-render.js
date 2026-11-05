/* Draws the effects of NS.fx: glowing motes added with cached glow sprites, debris chunks and
   smoke puffs, shock rings, outlined floating score text, and the full-screen flash. Draws
   only; owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const { ctx, visible } = NS.view;

  function drawWorld(ox, oy) {
    const P = NS.fx.P;
    const v = visible();
    /* chunks and smoke first, normal blending */
    for (let i = 0; i < P.count; ++i) {
      const k = P.kind[i];
      if (k === 0 || k === 2) continue;
      const x = ox + P.x[i], y = oy + P.y[i];
      if (x < v.x0 - 20 || x > v.x1 + 20 || y < v.y0 - 20 || y > v.y1 + 20) continue;
      const t = P.life[i] / P.max[i];
      const s = P.size[i];
      if (k === 3) {
        ctx.globalAlpha = t * 0.45;
        ctx.fillStyle = P.color[i];
        const r = s * (1.6 - t * 0.6);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, C.TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = P.color[i];
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.count; ++i) {
      const k = P.kind[i];
      if (k === 1 || k === 3) continue;
      const x = ox + P.x[i], y = oy + P.y[i];
      if (x < v.x0 - 20 || x > v.x1 + 20 || y < v.y0 - 20 || y > v.y1 + 20) continue;
      const t = P.life[i] / P.max[i];
      const s = P.size[i] * 4;
      ctx.globalAlpha = t;
      ctx.drawImage(K.glow(P.color[i]), x - s, y - s, s * 2, s * 2);
    }
    const rings = NS.fx.rings;
    for (let k = 0; k < rings.length; ++k) {
      const r = rings[k];
      const t = r.life / r.max;
      ctx.globalAlpha = t * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * t + 1;
      ctx.beginPath();
      ctx.arc(ox + r.x, oy + r.y, r.r * (1 - t * t) + 4, 0, C.TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTexts(ox, oy) {
    const texts = NS.fx.texts;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let k = 0; k < texts.length; ++k) {
      const t = texts[k];
      const a = Math.min(1, t.life / t.max * 2);
      const pop = 1 + Math.max(0, (t.life - t.max + 0.15)) * 3;
      ctx.globalAlpha = a;
      ctx.font = 'bold ' + Math.round(t.size * pop) + 'px ' + C.FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(t.str, ox + t.x, oy + t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, ox + t.x, oy + t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    const st = NS.fx.state;
    if (st.flash <= 0.01) return;
    const v = visible();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = st.flash;
    ctx.fillStyle = st.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  Object.assign(NS.fxRender, { drawWorld, drawTexts, drawFlash });
})();
