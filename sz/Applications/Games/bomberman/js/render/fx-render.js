/* Draws the effect pools in plane coordinates: alpha-blended particles (debris, smoke,
   confetti, leaves) first, then additive ones (sparks, embers, stars) with cached glows,
   shockwave rings and the floating score texts. Culls everything outside the visible plane.
   Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const K = NS.artKit;

  function isHex(c) {
    return c.charCodeAt(0) === 35;
  }

  function draw() {
    const ctx = NS.view.ctx;
    const v = NS.view.visible();
    const parts = G.fx.parts;
    const x0 = v.x0 - 20, x1 = v.x1 + 20, y0 = v.y0 - 20, y1 = v.y1 + 20;
    /* pass 1: normal blending */
    for (let i = 0; i < parts.length; ++i) {
      const p = parts[i];
      if (!p.on || p.add || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const u = p.life / p.max;
      switch (p.kind) {
        case 2:
          ctx.globalAlpha = Math.min(1, u * 2);
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
          ctx.restore();
          break;
        case 3: {
          ctx.globalAlpha = u * 0.8;
          ctx.fillStyle = p.color;
          const r = p.size * (1.6 - u * 0.6);
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 4:
          ctx.globalAlpha = Math.min(1, u * 3);
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size * 0.3 * Math.abs(Math.cos(p.rot * 1.7)), p.size, p.size * 0.6 * Math.abs(Math.cos(p.rot * 1.7)) + 0.5);
          ctx.restore();
          break;
        case 5:
          ctx.globalAlpha = Math.min(1, u * 3);
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        default:
          ctx.globalAlpha = Math.min(1, u * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    /* pass 2: additive */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; ++i) {
      const p = parts[i];
      if (!p.on || !p.add || p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const u = p.life / p.max;
      ctx.globalAlpha = Math.min(1, u * 1.6);
      if (p.kind === 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * 0.6);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.kind === 6) {
        ctx.fillStyle = p.color;
        const s = p.size * (0.6 + u * 0.6);
        ctx.fillRect(p.x - s * 1.6, p.y - s * 0.25, s * 3.2, s * 0.5);
        ctx.fillRect(p.x - s * 0.25, p.y - s * 1.6, s * 0.5, s * 3.2);
      } else if (isHex(p.color)) {
        const s = p.size * 4;
        ctx.drawImage(K.glow(p.color), p.x - s / 2, p.y - s / 2, s, s);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    /* rings */
    const rings = G.fx.rings;
    for (let i = 0; i < rings.length; ++i) {
      const r = rings[i];
      const u = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (1 - u) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - u, 3)), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* Floating score texts with a pop-in */
  function drawTexts() {
    const ctx = NS.view.ctx;
    const texts = G.fx.texts;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < texts.length; ++i) {
      const t = texts[i];
      const u = t.life / t.max;
      const pop = u > 0.85 ? 1 + (u - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, u * 2.5);
      ctx.font = 'bold ' + Math.round(t.size * pop) + 'px ' + C.FONT;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,10,20,0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.fxRender, {
    draw, drawTexts
  });
})();
