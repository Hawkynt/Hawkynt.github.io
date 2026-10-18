;(function() {
  'use strict';

  // Site-independent effect art: dome glass, cracks and the glow sprite with its tinted copies.
  // Owns: NS.fxArt
  // Reads: constants, util, dom, rules

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const { TWO_PI } = NS.constants;
  const { makeRng, makeCanvas } = NS.util;
  const { ctx } = NS.dom;

  // Effects that do not depend on the site: dome glass, cracks, glow sprite
  let fxArt = null;
  function buildFxArt() {
    if (fxArt) return fxArt;
    // Dome glass (interior tint, hex lattice, highlights) at 2x for crisp scaling
    const R = NS.rules.DOME_RADIUS, S = 2;
    const glass = makeCanvas((R * 2 + 8) * S, (R + 8) * S);
    const dg = glass.getContext('2d');
    dg.scale(S, S);
    dg.translate(R + 4, R + 4);
    dg.save();
    dg.beginPath();
    dg.arc(0, 0, R - 1, Math.PI, 0);
    dg.closePath();
    dg.clip();
    const ig = dg.createRadialGradient(-R * 0.3, -R * 0.5, 4, 0, 0, R);
    ig.addColorStop(0, 'rgba(120,200,255,0.22)');
    ig.addColorStop(0.6, 'rgba(50,110,200,0.12)');
    ig.addColorStop(1, 'rgba(20,60,140,0.28)');
    dg.fillStyle = ig;
    dg.fillRect(-R, -R, R * 2, R);
    dg.strokeStyle = 'rgba(140,210,255,0.35)';
    dg.lineWidth = 1.2;
    const hs = 16, hh = hs * Math.sqrt(3);
    for (let row = 0, hy = -R - hh; hy < 10; hy += hh / 2, ++row)
      for (let hx = -R - hs * 3 + (row % 2) * hs * 1.5; hx < R + hs * 3; hx += hs * 3) {
        dg.beginPath();
        for (let i = 0; i < 6; ++i) {
          const a = (TWO_PI / 6) * i;
          const x = hx + Math.cos(a) * hs, y = hy + Math.sin(a) * hs;
          if (i === 0) dg.moveTo(x, y);
          else dg.lineTo(x, y);
        }
        dg.closePath();
        dg.stroke();
      }
    const bg2 = dg.createLinearGradient(0, -R * 0.35, 0, 0);
    bg2.addColorStop(0, 'rgba(10,20,50,0)');
    bg2.addColorStop(1, 'rgba(10,20,50,0.45)');
    dg.fillStyle = bg2;
    dg.fillRect(-R, -R * 0.35, R * 2, R * 0.35);
    dg.restore();
    dg.save();
    dg.beginPath();
    dg.arc(0, 0, R - 8, Math.PI * 1.08, Math.PI * 1.5);
    dg.lineWidth = 7;
    dg.lineCap = 'round';
    dg.strokeStyle = 'rgba(255,255,255,0.35)';
    dg.stroke();
    dg.beginPath();
    dg.arc(0, 0, R - 18, Math.PI * 1.15, Math.PI * 1.32);
    dg.lineWidth = 3;
    dg.strokeStyle = 'rgba(255,255,255,0.25)';
    dg.stroke();
    dg.beginPath();
    dg.ellipse(R * 0.42, -R * 0.62, 7, 4, -0.6, 0, TWO_PI);
    dg.fillStyle = 'rgba(255,255,255,0.3)';
    dg.fill();
    dg.restore();

    // Crack paths from impact points on the shell
    const cracks = [];
    const r4 = makeRng(4242);
    for (let i = 0; i < 14; ++i) {
      const a = Math.PI + 0.25 + r4() * (Math.PI - 0.5);
      let x = Math.cos(a) * (R - 2), y = Math.sin(a) * (R - 2);
      const pts = [[x, y]];
      let dir = a + Math.PI + (r4() - 0.5) * 0.9;
      const len = 3 + (r4() * 4 | 0);
      for (let k = 0; k < len; ++k) {
        const step = 8 + r4() * 10;
        dir += (r4() - 0.5) * 1.1;
        x += Math.cos(dir) * step;
        y += Math.sin(dir) * step;
        if (y > -4 || x * x + y * y > (R - 2) * (R - 2)) break;
        pts.push([x, y]);
      }
      cracks.push(pts);
    }

    // Soft additive glow sprite for beams, impacts and lights
    const glow = makeCanvas(64, 64);
    const gl = glow.getContext('2d');
    const glg = gl.createRadialGradient(32, 32, 0, 32, 32, 32);
    glg.addColorStop(0, 'rgba(255,255,255,1)');
    glg.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    glg.addColorStop(1, 'rgba(255,255,255,0)');
    gl.fillStyle = glg;
    gl.fillRect(0, 0, 64, 64);

    fxArt = { glass, glassScale: S, cracks, glow, tinted: {} };
    return fxArt;
  }

  // Coloured copy of the glow sprite (cached per colour)
  function getGlow(color) {
    const art = buildFxArt();
    let c = art.tinted[color];
    if (!c) {
      c = makeCanvas(64, 64);
      const g = c.getContext('2d');
      g.drawImage(art.glow, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color;
      g.fillRect(0, 0, 64, 64);
      art.tinted[color] = c;
    }
    return c;
  }

  function drawGlow(color, x, y, r, alpha) {
    const prev = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * alpha;
    ctx.drawImage(getGlow(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prev;
  }

  NS.fxArt = { buildFxArt, drawGlow };
})();
