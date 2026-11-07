/* Drawing the juice: particles blitted from small cached sprites per shape and colour (round
   ones without rotation, squares, stars, hearts, petals, leaves, confetti and bats rotated),
   additive sparks, expanding rings, floating texts with a pop, and the screen flash. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const FX = NS.fx;
  const { ctx } = NS.view;

  const ROUND = { 4: true, 5: true, 9: true, 10: true };

  function partSprite(kind, color) {
    return K.sprite('p:' + kind + ':' + color, 24, 24, (g) => {
      g.translate(12, 12);
      g.fillStyle = color;
      switch (kind) {
        case 0: g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 2); g.lineTo(-2, 8); g.lineTo(-7, -2); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(0, -9); g.lineTo(-7, -2); g.lineTo(0, 0); g.closePath(); g.fill(); break;
        case 1: g.fillRect(-6, -6, 12, 12); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(-6, -6, 12, 3); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-6, 3, 12, 3); break;
        case 2: K.star(g, 0, 0, 10, 0.4, 5); g.fill(); break;
        case 3: g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-12, -1, -6, -10, 0, -4); g.bezierCurveTo(6, -10, 12, -1, 0, 8); g.fill(); break;
        case 4: g.strokeStyle = color; g.lineWidth = 1.6; K.circle(g, 0, 0, 8); g.stroke(); K.circle(g, -3, -3, 2.2, 'rgba(255,255,255,0.8)'); break;
        case 5: g.strokeStyle = color; g.lineWidth = 2; for (let i = 0; i < 3; ++i) { const a = i / 3 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(-Math.cos(a) * 9, -Math.sin(a) * 9); g.stroke(); } break;
        case 6: K.ellipse(g, 0, 0, 9, 5, color); break;
        case 7: g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(0, -7, 9, 0); g.quadraticCurveTo(0, 7, -9, 0); g.fill(); break;
        case 8: g.fillRect(-6, -4, 12, 8); break;
        case 10: { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 10); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.4, color); gr.addColorStop(1, K.rgba(color, 0)); g.fillStyle = gr; g.fillRect(-12, -12, 24, 24); break; }
        case 11: g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(-5, -8, -11, -4); g.quadraticCurveTo(-7, -2, -8, 3); g.quadraticCurveTo(-3, 0, 0, 4); g.quadraticCurveTo(3, 0, 8, 3); g.quadraticCurveTo(7, -2, 11, -4); g.quadraticCurveTo(5, -8, 0, -2); g.fill(); break;
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

  /* rotated shapes come pre-turned in eight steps, so a particle is one blit */
  function turned(kind, color, rot) {
    const step = ((Math.round(rot / (TAU / 8)) % 8) + 8) % 8;
    return K.sprite('pt:' + kind + ':' + color + ':' + step, 30, 30, (g) => {
      g.translate(15, 15);
      g.rotate(step * TAU / 8);
      g.drawImage(partSprite(kind, color), -12, -12);
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
      if (p.kind === 9 || p.kind === 10) ctx.globalCompositeOperation = 'lighter';
      if (ROUND[p.kind]) ctx.drawImage(img, p.x - 12 * s, p.y - 12 * s, 24 * s, 24 * s);
      else ctx.drawImage(turned(p.kind, p.color, p.rot), p.x - 15 * s, p.y - 15 * s, 30 * s, 30 * s);
      if (p.kind === 9 || p.kind === 10) ctx.globalCompositeOperation = 'source-over';
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
      kit.text(t.text, t.x, t.y, px, t.color, { align: 'center', weight: 'bold', shadow: 'rgba(0,4,20,0.8)' });
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

  Object.assign(NS.fxRender, { partSprite, turned, drawParticles, drawRings, drawTexts, drawFlash, draw });
})();
