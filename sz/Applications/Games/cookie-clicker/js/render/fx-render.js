/* Drawing the juice: particles blitted from small cached sprites per shape and colour (round
   ones without rotation, sprinkles, stars, hearts, petals, leaves and confetti rotated),
   additive sparks, expanding rings, floating texts with a pop, and the screen flash. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const FX = NS.fx;
  const { ctx } = NS.view;

  const ROUND = { 0: true, 4: true, 5: true, 9: true };

  function partSprite(kind, color) {
    return K.sprite('p:' + kind + ':' + color, 24, 24, (g) => {
      g.translate(12, 12);
      g.fillStyle = color;
      switch (kind) {
        case 0: K.circle(g, 0, 0, 7, color); K.circle(g, -2, -2, 2.5, 'rgba(255,255,255,0.35)'); break;
        case 1: K.roundRect(g, -8, -2.5, 16, 5, 2.5); g.fill(); break;
        case 2: K.star(g, 0, 0, 10, 0.4, 5); g.fill(); break;
        case 3: NS.treatArt.heart(g, 0, 0, 8, color); break;
        case 4: K.circle(g, 0, 0, 8, color); g.strokeStyle = 'rgba(120,70,0,0.6)'; g.lineWidth = 1.5; K.circle(g, 0, 0, 5); g.stroke(); break;
        case 5: g.strokeStyle = color; g.lineWidth = 2; for (let i = 0; i < 3; ++i) { const a = i / 3 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(-Math.cos(a) * 9, -Math.sin(a) * 9); g.stroke(); } break;
        case 6: K.ellipse(g, 0, 0, 9, 5, color); break;
        case 7: g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(0, -7, 9, 0); g.quadraticCurveTo(0, 7, -9, 0); g.fill(); break;
        case 8: g.fillRect(-6, -4, 12, 8); break;
        default: {
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 12);
          gr.addColorStop(0, '#ffffff');
          gr.addColorStop(0.3, color);
          gr.addColorStop(1, K.rgba(color, 0));
          g.fillStyle = gr;
          g.fillRect(-12, -12, 24, 24);
        }
      }
    });
  }

  function drawParticles() {
    const P = FX.parts;
    for (let i = 0; i < P.length; ++i) {
      const p = P[i];
      if (!p.on) continue;
      const a = Math.min(1, p.life / p.max * 2);
      const s = p.size / 8;
      const img = partSprite(p.kind, p.color);
      ctx.globalAlpha = a;
      if (p.kind === 9) ctx.globalCompositeOperation = 'lighter';
      if (ROUND[p.kind]) ctx.drawImage(img, p.x - 12 * s, p.y - 12 * s, 24 * s, 24 * s);
      else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.drawImage(img, -12 * s, -12 * s, 24 * s, 24 * s);
        ctx.restore();
      }
      if (p.kind === 9) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    const R = FX.rings;
    for (let i = 0; i < R.length; ++i) {
      const r = R[i];
      if (!r.on) continue;
      const f = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (1 - f * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - (1 - f) * (1 - f)), 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts() {
    const T = FX.texts;
    for (let i = 0; i < T.length; ++i) {
      const t = T[i];
      if (!t.on) continue;
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2.5);
      const px = t.size * (1 + t.pop * 0.35);
      kit.text(t.text, t.x, t.y, px, t.color, { align: 'center', weight: 'bold', shadow: 'rgba(40,16,0,0.75)' });
    }
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    if (G.flash <= 0) return;
    const v = NS.view.visible();
    ctx.globalAlpha = Math.min(1, G.flash) * 0.6;
    ctx.fillStyle = G.flashColor;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawRings();
    drawParticles();
    drawTexts();
  }

  Object.assign(NS.fxRender, { partSprite, drawParticles, drawRings, drawTexts, drawFlash, draw });
})();
