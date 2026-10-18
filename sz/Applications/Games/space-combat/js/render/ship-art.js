/* Ship painting: a layered hull painter (mirrored plates with lit gradients, outlines, rim light,
   panel lines, glass canopies, nozzles, gloss and occlusion) that also bakes five bank frames,
   and the five player ship designs. Sprites are cached per ship, paint scheme and bank frame. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const K = NS.artKit;

  const BANKS = [-1, -0.5, 0, 0.5, 1];

  /* y-squash per side for a bank b in [-1, 1]: the dipping wing foreshortens */
  function bankY(y, b, ridge) {
    const s = y < 0 ? -1 : 1;
    const f = 1 - 0.26 * Math.max(0, b * s) + 0.05 * Math.max(0, -b * s);
    return y * f + (ridge ? b * 2.6 : 0);
  }

  function fillFor(g, kind, colors, top, bottom, b) {
    let base;
    switch (kind) {
      case 'dark': base = colors.dark; break;
      case 'trim': base = colors.trim; break;
      case 'metal': base = '#8c96aa'; break;
      case 'glow': return colors.glow;
      default: base = colors.hull;
    }
    /* light from the rising wing */
    const gr = g.createLinearGradient(0, top, 0, bottom);
    const lightTop = 0.42 + b * 0.18, darkBottom = 0.5 - b * 0.12;
    gr.addColorStop(0, K.shade(base, Math.min(0.75, lightTop)));
    gr.addColorStop(0.45, base);
    gr.addColorStop(1, K.shade(base, -Math.min(0.8, darkBottom)));
    return gr;
  }

  function mirrored(pts, b, ridge, flip) {
    const out = [];
    for (let i = 0; i < pts.length; ++i) out.push([pts[i][0], bankY(pts[i][1] * (flip ? -1 : 1), b, ridge)]);
    return out;
  }

  /* A plate: the top-half outline plus its mirror, as one closed path when it touches y = 0 */
  function platePaths(layer, b) {
    const pts = layer.pts;
    const touches = Math.abs(pts[0][1]) < 0.01 && Math.abs(pts[pts.length - 1][1]) < 0.01;
    if (touches) {
      const top = mirrored(pts, b, layer.ridge, false);
      const bot = mirrored(pts.slice().reverse(), b, layer.ridge, true);
      return [top.concat(bot.slice(1, bot.length - 1))];
    }
    return [mirrored(pts, b, layer.ridge, false), mirrored(pts, b, layer.ridge, true)];
  }

  /* Paint a ship spec centred in g at (cx, cy) */
  function paintSpec(g, spec, colors, b, cx, cy) {
    g.save();
    g.translate(cx, cy);
    const H = spec.span || 26;
    g.lineJoin = 'round';
    for (let i = 0; i < spec.layers.length; ++i) {
      const L = spec.layers[i];
      if (L.pts) {
        const paths = platePaths(L, b);
        for (let p = 0; p < paths.length; ++p) {
          K.poly(g, paths[p]);
          g.fillStyle = fillFor(g, L.fill, colors, -H, H, b);
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.6)';
          g.lineWidth = 1.1;
          g.stroke();
          /* rim light on the upper edges */
          g.save();
          g.clip();
          g.strokeStyle = 'rgba(255,255,255,' + (L.fill === 'dark' ? 0.16 : 0.34) + ')';
          g.lineWidth = 1.6;
          g.translate(0.6, 0.9);
          g.stroke();
          g.restore();
        }
      } else if (L.glass) {
        const e = L.glass;
        const y = bankY(e[1], b, true);
        const gr = g.createLinearGradient(e[0] - e[2], y - e[3], e[0] + e[2], y + e[3]);
        gr.addColorStop(0, '#9fe6ff');
        gr.addColorStop(0.35, '#2a6ab0');
        gr.addColorStop(1, '#06101e');
        g.fillStyle = gr;
        g.beginPath();
        g.ellipse(e[0], y, e[2], e[3] * (1 - Math.abs(b) * 0.12), 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.7)';
        g.lineWidth = 1;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.beginPath();
        g.ellipse(e[0] + e[2] * 0.25, y - e[3] * 0.35, e[2] * 0.35, e[3] * 0.22, -0.2, 0, Math.PI * 2);
        g.fill();
      } else if (L.light) {
        const e = L.light;
        for (let s = -1; s <= 1; s += 2) {
          if (!L.mirror && s < 0) continue;
          const y = bankY(e[1] * s, b, L.ridge);
          const gr = g.createRadialGradient(e[0], y, 0, e[0], y, e[2] * 2.2);
          gr.addColorStop(0, '#ffffff');
          gr.addColorStop(0.35, colors.glow);
          gr.addColorStop(1, K.rgba(colors.glow, 0));
          g.fillStyle = gr;
          g.fillRect(e[0] - e[2] * 2.2, y - e[2] * 2.2, e[2] * 4.4, e[2] * 4.4);
        }
      } else if (L.lines) {
        g.strokeStyle = K.rgba(K.shade(colors.hull, -0.6), 0.75);
        g.lineWidth = 0.8;
        g.beginPath();
        for (let k = 0; k < L.lines.length; ++k) {
          const l = L.lines[k];
          for (let s = -1; s <= 1; s += 2) {
            g.moveTo(l[0], bankY(l[1] * s, b, L.ridge));
            g.lineTo(l[2], bankY(l[3] * s, b, L.ridge));
          }
        }
        g.stroke();
      }
    }
    /* engine nozzles */
    const eng = spec.engines || [];
    for (let i = 0; i < eng.length; ++i) {
      const e = eng[i];
      const y = bankY(e[1], b, false);
      g.fillStyle = '#14161c';
      g.beginPath();
      g.ellipse(e[0], y, e[2] * 0.7, e[2], 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#7a8296';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = K.rgba(colors.glow, 0.85);
      g.beginPath();
      g.ellipse(e[0] - 0.6, y, e[2] * 0.35, e[2] * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    /* wingtip navigation lights */
    const lights = spec.lights || [];
    for (let i = 0; i < lights.length; ++i) {
      const l = lights[i];
      const y = bankY(l[1], b, false);
      g.fillStyle = l[1] < 0 ? '#ff4a4a' : '#4aff7a';
      g.beginPath();
      g.arc(l[0], y, 1.3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    /* gloss from the nose and occlusion toward the tail, only on painted pixels */
    g.save();
    g.globalCompositeOperation = 'source-atop';
    const gl = g.createRadialGradient(cx + 8, cy - 8 + b * 6, 2, cx + 8, cy - 8 + b * 6, H * 1.3);
    gl.addColorStop(0, 'rgba(255,255,255,0.28)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl;
    g.fillRect(cx - H * 2, cy - H * 2, H * 4, H * 4);
    const ao = g.createLinearGradient(cx - H, 0, cx + H * 0.4, 0);
    ao.addColorStop(0, 'rgba(0,0,10,0.32)');
    ao.addColorStop(1, 'rgba(0,0,10,0)');
    g.fillStyle = ao;
    g.fillRect(cx - H * 2, cy - H * 2, H * 4, H * 4);
    g.restore();
  }

  /* ── player ship designs (logical px, facing +x) ── */
  const DESIGNS = {
    falcon: {
      size: 64, span: 26,
      layers: [
        { pts: [[-12, -5], [-20, -11], [-23, -10], [-20, -3]], fill: 'dark' },
        { pts: [[6, -5], [-7, -21], [-14, -25], [-18, -23], [-16, -14], [-12, -6]], fill: 'hull' },
        { pts: [[-6, -16], [-12, -22], [-14, -21], [-9, -14]], fill: 'trim' },
        { pts: [[14, -9], [24, -9], [24, -10.6], [14, -10.6]], fill: 'metal' },
        { pts: [[27, 0], [20, -3], [8, -6], [-8, -7], [-18, -6], [-22, -3], [-22, 0]], fill: 'hull' },
        { pts: [[16, 0], [4, -2.6], [-14, -2.6], [-18, 0]], fill: 'dark', ridge: true },
        { pts: [[27, 0], [22, -2], [19, -2.6], [19, 0]], fill: 'trim', ridge: true },
        { lines: [[-2, -6.5, -4, -12], [12, -4.5, -8, -6.5], [-10, -10, -15, -20]] },
        { glass: [6, 0, 7, 3.2] },
      ],
      engines: [[-22, -4, 3.2], [-22, 4, 3.2]], lights: [[-15, -24.5], [-15, 24.5]],
    },
    wraith: {
      size: 64, span: 24,
      layers: [
        { pts: [[2, -4], [11, -20], [6, -23.5], [-6, -18], [-16, -8]], fill: 'dark' },
        { pts: [[11, -20], [6, -23.5], [4.5, -21.5], [8.5, -19]], fill: 'trim' },
        { pts: [[-12, -6], [-22, -14], [-24.5, -13], [-18, -4.5]], fill: 'trim' },
        { pts: [[30, 0], [18, -3], [0, -5.2], [-14, -7], [-22, -5], [-24, 0]], fill: 'hull' },
        { pts: [[20, 0], [6, -2], [-16, -2], [-20, 0]], fill: 'dark', ridge: true },
        { lines: [[16, -2.8, -12, -5.6], [0, -5, 4, -14]] },
        { glass: [10, 0, 8, 2.6] },
        { light: [-20, -2.2, 1.3], mirror: true },
      ],
      engines: [[-24, -3, 2.6], [-24, 3, 2.6]], lights: [[6, -23], [6, 23]],
    },
    bastion: {
      size: 72, span: 28,
      layers: [
        { pts: [[14, -14], [6, -25], [-18, -25], [-25, -18], [-20, -12]], fill: 'dark' },
        { pts: [[12, -15], [4, -23], [-16, -23], [-21, -17.5], [-16, -13]], fill: 'hull' },
        { pts: [[2, -23], [-10, -23], [-10, -20.5], [2, -20.5]], fill: 'trim' },
        { pts: [[27, -16], [12, -16], [12, -20], [27, -20]], fill: 'metal' },
        { pts: [[26, 0], [22, -6], [10, -11], [-14, -12], [-24, -8], [-26, 0]], fill: 'hull' },
        { pts: [[18, 0], [12, -4], [-16, -5], [-20, 0]], fill: 'dark', ridge: true },
        { pts: [[24, 0], [21, -3], [17, -3], [17, 0]], fill: 'trim', ridge: true },
        { lines: [[6, -10.5, -10, -11.5], [-4, -11.8, -4, -6], [0, -16, -14, -16]] },
        { glass: [8, 0, 6, 3.6] },
      ],
      engines: [[-26, -5, 3.8], [-26, 5, 3.8], [-24, -19, 3], [-24, 19, 3]], lights: [[-14, -25], [-14, 25]],
    },
    tempest: {
      size: 68, span: 26,
      layers: [
        { pts: [[-2, -8], [-14, -24], [-20, -24], [-18, -8]], fill: 'dark' },
        { pts: [[-10, -18], [-16, -23], [-18, -22], [-13, -16]], fill: 'trim' },
        { pts: [[31, -11], [26, -8.5], [8, -7.5], [-6, -6], [-10, -13], [0, -15], [22, -14]], fill: 'hull' },
        { pts: [[31, -11], [24, -10], [24, -12.6], [30, -12.6]], fill: 'trim' },
        { pts: [[17, 0], [10, -5], [-12, -6], [-22, -4], [-22, 0]], fill: 'hull' },
        { pts: [[10, 0], [4, -2.2], [-16, -2.2], [-19, 0]], fill: 'dark', ridge: true },
        { lines: [[20, -11, -4, -10], [-6, -7, -12, -18]] },
        { light: [21, 0, 2.6], mirror: false },
        { glass: [2, 0, 6, 3] },
      ],
      engines: [[-22, -3, 3], [-22, 3, 3]], lights: [[-17, -24], [-17, 24]],
    },
    specter: {
      size: 66, span: 27,
      layers: [
        { pts: [[-10, -20], [-20, -28], [-22.5, -26], [-14, -17]], fill: 'trim' },
        { pts: [[18, -4], [8, -14], [-6, -24], [-14, -24], [-16, -14], [-18, -6]], fill: 'hull' },
        { pts: [[4, -12], [-6, -20], [-12, -20], [-12, -10]], fill: 'dark' },
        { pts: [[14, -5], [6, -12], [4, -11], [11, -4]], fill: 'trim' },
        { pts: [[26, 0], [18, -5], [0, -7], [-16, -7], [-20, 0]], fill: 'hull' },
        { pts: [[18, 0], [6, -2.4], [-12, -2.4], [-16, 0]], fill: 'dark', ridge: true },
        { lines: [[-2, -9, -10, -19], [8, -6, -14, -6.6]] },
        { light: [-6, 0, 2.2], mirror: false },
        { glass: [10, 0, 7, 3.4] },
      ],
      engines: [[-20, -4, 3], [-20, 4, 3]], lights: [[-12, -24], [-12, 24]],
    },
  };

  /* bank in [-1, 1] picks the nearest of five baked frames */
  function bankFrame(b) {
    const i = Math.round((b + 1) * 2);
    return i < 0 ? 0 : i > 4 ? 4 : i;
  }

  function shipSprite(shipId, skinKey, colors, bank) {
    const f = bankFrame(bank);
    const spec = DESIGNS[shipId] || DESIGNS.falcon;
    const key = 'ship:' + shipId + ':' + skinKey + ':' + f;
    return K.sprite(key, spec.size, spec.size, (g, w, h) => paintSpec(g, spec, colors, BANKS[f], w / 2, h / 2));
  }

  function shipFlash(shipId, skinKey, colors, bank) {
    const base = shipSprite(shipId, skinKey, colors, bank);
    return K.silhouette('ship:' + shipId + ':' + skinKey + ':' + bankFrame(bank), base);
  }

  /* World-space nozzle positions for engine glows, facing angle a */
  function enginePoints(shipId) {
    return (DESIGNS[shipId] || DESIGNS.falcon).engines;
  }

  Object.assign(NS.shipArt, {
    DESIGNS, BANKS, bankY, paintSpec, shipSprite, shipFlash, enginePoints, bankFrame
  });
})();
