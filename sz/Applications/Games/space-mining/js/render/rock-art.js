/* Rock art, painted once per key: asteroid bodies per size, variant and belt palette (lit
   lumpy silhouettes with regolith texture, strata, craters with lit rims and a terminator),
   ore vein overlays and their glow layer per ore, volatile magma veins, crack overlays for
   damage stages, ore nuggets, debris chips, the crystal geode and the Crown Heart.
   Pure painting into cached canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const K = NS.artKit;
  const { ROCK_RADII } = NS.constants;
  const { ORE_BY_ID } = NS.ores;
  const TAU = Math.PI * 2;
  const shapes = {};

  /* unit-radius outline of a rock, shared by every layer of that size and variant */
  function shape(tier, variant) {
    const key = tier + ':' + variant;
    if (shapes[key]) return shapes[key];
    const n = K.valueNoise(tier * 131 + variant * 977 + 7);
    const N = 14 + tier * 6;
    const pts = [];
    const elong = 0.82 + n(variant, 9) * 0.3;
    for (let i = 0; i < N; ++i) {
      const a = i * TAU / N;
      const k = 0.74 + K.fbm(n, Math.cos(a) * 1.4 + variant * 3, Math.sin(a) * 1.4, 3) * 0.42;
      pts.push([Math.cos(a) * k, Math.sin(a) * k * elong]);
    }
    shapes[key] = pts;
    return pts;
  }

  function outline(g, pts, c, r) {
    g.beginPath();
    for (let i = 0; i < pts.length; ++i) {
      const x = c + pts[i][0] * r, y = c + pts[i][1] * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function dims(tier) {
    const r = ROCK_RADII[tier];
    return { r: r, w: r * 2 + 8, c: r + 4 };
  }

  /* The body: palette = [light, mid, dark] */
  function body(tier, variant, pal) {
    const d = dims(tier);
    return K.sprite('rock:' + tier + ':' + variant + ':' + pal[0], d.w, d.w, (g) => {
      const { r, c } = d;
      const pts = shape(tier, variant);
      const n = K.valueNoise(tier * 71 + variant * 13 + 3);
      outline(g, pts, c, r);
      const gr = g.createRadialGradient(c - r * 0.45, c - r * 0.5, r * 0.05, c, c, r * 1.15);
      gr.addColorStop(0, K.shade(pal[0], 0.28));
      gr.addColorStop(0.35, pal[0]);
      gr.addColorStop(0.75, pal[1]);
      gr.addColorStop(1, pal[2]);
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      /* regolith mottling */
      const blots = Math.round(r * r / 24);
      for (let i = 0; i < blots; ++i) {
        const x = c + (n(i * 0.37, 1.1) - 0.5) * r * 2.2, y = c + (n(2.3, i * 0.41) - 0.5) * r * 2.2;
        const s = 1 + n(i, 5.5) * r * 0.12;
        g.fillStyle = i % 3 ? K.rgba(pal[2], 0.16) : K.rgba(K.shade(pal[0], 0.3), 0.12);
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
      }
      /* strata on half the variants */
      if (variant % 2 === 1 && tier >= 2) {
        g.strokeStyle = K.rgba(pal[2], 0.28);
        g.lineWidth = Math.max(1, r * 0.035);
        for (let i = -3; i <= 3; ++i) {
          g.beginPath();
          for (let x = -r; x <= r; x += r / 8) {
            const y = c + i * r * 0.22 + x * 0.35 + (n(x * 0.05, i) - 0.5) * r * 0.16;
            if (x === -r) g.moveTo(c + x, y); else g.lineTo(c + x, y);
          }
          g.stroke();
        }
      }
      /* craters: dark bowls whose far (lower-right) rim catches the light */
      const craters = 1 + tier * 2 + (variant % 3);
      for (let i = 0; i < craters; ++i) {
        const a = n(i * 2.3, 9.1) * TAU, dd = Math.sqrt(n(i * 1.7, 4.4)) * r * 0.62;
        const x = c + Math.cos(a) * dd, y = c + Math.sin(a) * dd;
        const cr = r * (0.07 + n(i, 7) * 0.15);
        const bowl = g.createRadialGradient(x - cr * 0.3, y - cr * 0.3, 0, x, y, cr);
        bowl.addColorStop(0, K.rgba(pal[2], 0.85));
        bowl.addColorStop(0.75, K.rgba(pal[2], 0.55));
        bowl.addColorStop(1, K.rgba(pal[2], 0));
        g.fillStyle = bowl;
        g.beginPath();
        g.ellipse(x, y, cr, cr * 0.85, 0.4, 0, TAU);
        g.fill();
        g.strokeStyle = K.rgba(K.shade(pal[0], 0.45), 0.55);
        g.lineWidth = Math.max(0.8, cr * 0.16);
        g.beginPath();
        g.ellipse(x, y, cr * 0.9, cr * 0.76, 0.4, -0.2, 1.9);
        g.stroke();
        g.strokeStyle = K.rgba(pal[2], 0.6);
        g.lineWidth = Math.max(0.6, cr * 0.1);
        g.beginPath();
        g.ellipse(x, y, cr * 1.02, cr * 0.88, 0.4, 3.1, 4.8);
        g.stroke();
      }
      /* boulders on the big ones */
      for (let i = 0; i < tier * 3; ++i) {
        const x = c + (n(i, 3.7) - 0.5) * r * 1.4, y = c + (n(4.1, i) - 0.5) * r * 1.4;
        const s = r * (0.03 + n(i, 8.8) * 0.05);
        g.fillStyle = K.rgba(K.shade(pal[0], 0.2), 0.7);
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
        g.fillStyle = K.rgba(pal[2], 0.6);
        g.beginPath();
        g.arc(x + s * 0.5, y + s * 0.5, s * 0.8, 0, TAU);
        g.fill();
      }
      /* terminator: the far side sinks into shadow */
      const sh = g.createLinearGradient(c - r * 0.6, c - r * 0.6, c + r, c + r);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(0.55, 'rgba(0,0,6,0.15)');
      sh.addColorStop(1, 'rgba(0,0,6,0.7)');
      g.fillStyle = sh;
      g.fillRect(0, 0, d.w, d.w);
      g.restore();
      /* rim light on the lit edge, dark outline elsewhere */
      outline(g, pts, c, r);
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 1.2;
      g.stroke();
      g.save();
      outline(g, pts, c, r);
      g.clip();
      g.strokeStyle = K.rgba(K.shade(pal[0], 0.6), 0.5);
      g.lineWidth = 2.2;
      g.beginPath();
      for (let i = 0; i < pts.length; ++i) {
        const a = Math.atan2(pts[i][1], pts[i][0]);
        if (a < -Math.PI * 0.95 || a > -Math.PI * 0.2) continue;
        const x = c + pts[i][0] * (r - 1), y = c + pts[i][1] * (r - 1);
        g.lineTo(x, y);
      }
      g.stroke();
      g.restore();
    });
  }

  /* ore vein paths, deterministic per size, variant and ore */
  function veinPaths(tier, variant, seed) {
    const n = K.valueNoise(tier * 37 + variant * 101 + seed);
    const out = [];
    const veins = 1 + Math.ceil(tier * 0.75);
    for (let v = 0; v < veins; ++v) {
      const pts = [];
      let a = n(v, 1) * TAU, x = Math.cos(a) * 0.55, y = Math.sin(a) * 0.45;
      let dir = a + Math.PI + (n(v, 2) - 0.5) * 1.6;
      const steps = 5 + tier * 2;
      for (let i = 0; i < steps; ++i) {
        pts.push([x, y]);
        dir += (n(v * 9 + i, 3) - 0.5) * 1.3;
        x += Math.cos(dir) * 0.16;
        y += Math.sin(dir) * 0.16;
        if (x * x + y * y > 0.62) break;
      }
      out.push(pts);
    }
    const nodes = [];
    /* ore nodes sit along the veins, a few strays elsewhere */
    for (let v = 0; v < out.length; ++v)
      for (let i = 2; i < out[v].length; i += 3)
        nodes.push([out[v][i][0], out[v][i][1], 0.04 + n(v * 5 + i, 13) * 0.045]);
    for (let i = 0; i < tier - 1; ++i) {
      const a = n(i, 11) * TAU, d = Math.sqrt(n(i, 12)) * 0.6;
      nodes.push([Math.cos(a) * d, Math.sin(a) * d, 0.03 + n(i, 14) * 0.03]);
    }
    return { veins: out, nodes: nodes };
  }

  function crystal(g, x, y, s, a, colA, colB) {
    g.beginPath();
    g.moveTo(x + Math.cos(a) * s * 1.6, y + Math.sin(a) * s * 1.6);
    g.lineTo(x + Math.cos(a + 1.9) * s, y + Math.sin(a + 1.9) * s);
    g.lineTo(x + Math.cos(a + Math.PI) * s * 0.7, y + Math.sin(a + Math.PI) * s * 0.7);
    g.lineTo(x + Math.cos(a - 1.9) * s, y + Math.sin(a - 1.9) * s);
    g.closePath();
    const gr = g.createLinearGradient(x - s, y - s, x + s, y + s);
    gr.addColorStop(0, colA);
    gr.addColorStop(1, colB);
    g.fillStyle = gr;
    g.fill();
  }

  /* veins and ore nodes in the ore's colours; volatile rocks get magma ('volatile') */
  function veins(tier, variant, oreId) {
    const d = dims(tier);
    const ore = oreId === 'volatile' ? { color: '#ff5a1a', glow: '#ffd070', dark: '#5a0a00', crystal: false } : ORE_BY_ID[oreId];
    return K.sprite('vein:' + tier + ':' + variant + ':' + oreId, d.w, d.w, (g) => {
      const { r, c } = d;
      const vp = veinPaths(tier, variant, oreId.length * 17);
      g.save();
      outline(g, shape(tier, variant), c, r * 0.97);
      g.clip();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let pass = 0; pass < 2; ++pass) {
        g.strokeStyle = pass ? ore.color : K.rgba(ore.dark, 0.8);
        g.lineWidth = Math.max(1, r * (pass ? 0.035 : 0.075));
        for (let v = 0; v < vp.veins.length; ++v) {
          const pts = vp.veins[v];
          g.beginPath();
          for (let i = 0; i < pts.length; ++i) {
            if (i === 0) g.moveTo(c + pts[i][0] * r, c + pts[i][1] * r);
            else g.lineTo(c + pts[i][0] * r, c + pts[i][1] * r);
          }
          g.stroke();
        }
      }
      for (let i = 0; i < vp.nodes.length; ++i) {
        const nd = vp.nodes[i];
        const x = c + nd[0] * r, y = c + nd[1] * r, s = nd[2] * r + 1.2;
        g.fillStyle = K.rgba(ore.dark, 0.9);
        g.beginPath();
        g.arc(x + s * 0.15, y + s * 0.2, s * 1.3, 0, TAU);
        g.fill();
        const k = ore.crystal ? 3 : 2;
        for (let j = 0; j < k; ++j) crystal(g, x + (j - 0.5) * s * 0.55, y + (j % 2) * s * 0.35, s * (ore.crystal ? 0.95 : 0.75), -0.8 + j * 1.3, K.mix(ore.glow, ore.color, 0.35), K.shade(ore.color, -0.35));
        g.fillStyle = K.rgba(ore.glow, 0.9);
        g.fillRect(x - s * 0.3, y - s * 0.4, Math.max(0.7, s * 0.22), Math.max(0.7, s * 0.22));
      }
      g.restore();
    });
  }

  /* the bright parts of the veins only, blitted additively with a slow pulse */
  function veinGlow(tier, variant, oreId) {
    const d = dims(tier);
    const ore = oreId === 'volatile' ? { glow: '#ff7a2a' } : ORE_BY_ID[oreId];
    return K.sprite('vglow:' + tier + ':' + variant + ':' + oreId, d.w, d.w, (g) => {
      const { r, c } = d;
      const vp = veinPaths(tier, variant, oreId.length * 17);
      for (let i = 0; i < vp.nodes.length; ++i) {
        const nd = vp.nodes[i];
        const x = c + nd[0] * r, y = c + nd[1] * r, s = (nd[2] * r + 1.2) * 2.6;
        const gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, K.rgba(ore.glow, 0.5));
        gr.addColorStop(1, K.rgba(ore.glow, 0));
        g.fillStyle = gr;
        g.fillRect(x - s, y - s, s * 2, s * 2);
      }
    });
  }

  /* damage cracks: stage 1..3 */
  function cracks(tier, variant, stage) {
    const d = dims(tier);
    return K.sprite('crack:' + tier + ':' + variant + ':' + stage, d.w, d.w, (g) => {
      const { r, c } = d;
      const n = K.valueNoise(tier * 53 + variant * 7 + 99);
      g.save();
      outline(g, shape(tier, variant), c, r * 0.98);
      g.clip();
      g.lineCap = 'round';
      const count = stage * (1 + tier);
      for (let k = 0; k < count; ++k) {
        let a = n(k, 1) * TAU, x = c + Math.cos(a) * r * 0.1, y = c + Math.sin(a) * r * 0.1;
        let dir = a;
        const pts = [[x, y]];
        for (let i = 0; i < 6; ++i) {
          dir += (n(k * 7 + i, 2) - 0.5) * 1.1;
          x += Math.cos(dir) * r * 0.17;
          y += Math.sin(dir) * r * 0.17;
          pts.push([x, y]);
        }
        for (let pass = 0; pass < 2; ++pass) {
          g.strokeStyle = pass ? 'rgba(0,0,0,0.75)' : 'rgba(255,230,200,0.25)';
          g.lineWidth = Math.max(0.8, r * (pass ? 0.025 : 0.05)) * (1.2 - k / count * 0.5);
          g.beginPath();
          for (let i = 0; i < pts.length; ++i) {
            if (i === 0) g.moveTo(pts[i][0] + (pass ? 0 : 0.8), pts[i][1] + (pass ? 0 : 0.8));
            else g.lineTo(pts[i][0] + (pass ? 0 : 0.8), pts[i][1] + (pass ? 0 : 0.8));
          }
          g.stroke();
        }
      }
      g.restore();
    });
  }

  /* An ore nugget: a faceted shard cluster (bigger for 2-unit nuggets) */
  function nugget(oreId, variant) {
    const ore = ORE_BY_ID[oreId];
    return K.sprite('nug:' + oreId + ':' + variant, 18, 18, (g, w) => {
      const c = w / 2;
      const n = K.valueNoise(ore.index * 19 + variant * 5 + 1);
      const parts = ore.crystal ? 4 : 3;
      for (let i = 0; i < parts; ++i) {
        const a = -0.6 + i * 1.6 + n(i, 1);
        const s = 3 + n(i, 2) * 2.4;
        const x = c + Math.cos(a) * 2.2, y = c + Math.sin(a) * 2.2;
        g.fillStyle = ore.dark;
        g.beginPath();
        g.arc(x + 0.6, y + 0.8, s * 0.95, 0, TAU);
        g.fill();
        crystal(g, x, y, s * 0.85, a, ore.glow, ore.color);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 0.6;
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(c - 2, c - 3, 1.4, 1.4);
    });
  }

  /* salvage credits: a tumbling crate of parts */
  function salvage() {
    return K.sprite('salvage', 16, 16, (g) => {
      g.fillStyle = '#3a3020';
      g.fillRect(3, 4, 10, 9);
      const gr = g.createLinearGradient(3, 3, 13, 13);
      gr.addColorStop(0, '#ffe08a');
      gr.addColorStop(1, '#a8761a');
      g.fillStyle = gr;
      g.fillRect(3, 3, 10, 9);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 0.8;
      g.strokeRect(3, 3, 10, 9);
      g.beginPath();
      g.moveTo(3, 7.5);
      g.lineTo(13, 7.5);
      g.stroke();
    });
  }

  /* debris chips: 0..3 hull plating, 4..7 rock flakes */
  function chip(shapeIndex, color) {
    return K.sprite('chip:' + shapeIndex + ':' + color, 12, 12, (g) => {
      const n = K.valueNoise(shapeIndex * 31 + 5);
      const pts = [];
      const N = shapeIndex >= 4 ? 6 : 4;
      for (let i = 0; i < N; ++i) {
        const a = i * TAU / N + n(i, 1) * 0.8;
        const k = 0.55 + n(i, 2) * 0.45;
        pts.push([6 + Math.cos(a) * 5 * k, 6 + Math.sin(a) * 4 * k]);
      }
      K.poly(g, pts);
      const gr = g.createLinearGradient(1, 1, 11, 11);
      gr.addColorStop(0, K.shade(color, 0.35));
      gr.addColorStop(1, K.shade(color, -0.45));
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 0.6;
      g.stroke();
    });
  }

  /* The geode: a pale crust split open on a cavity of crystal */
  function geode(oreId) {
    const ore = ORE_BY_ID[oreId];
    const r = 74, w = r * 2 + 16, c = w / 2;
    return K.sprite('geode:' + oreId, w, w, (g) => {
      const pts = shape(4, 2);
      const n = K.valueNoise(4242);
      outline(g, pts, c, r);
      const gr = g.createRadialGradient(c - r * 0.4, c - r * 0.45, 4, c, c, r * 1.1);
      gr.addColorStop(0, '#d8d0e0');
      gr.addColorStop(0.5, '#8a8098');
      gr.addColorStop(1, '#2a2434');
      g.fillStyle = gr;
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = K.rgba(ore.dark, 0.95);
      g.beginPath();
      g.ellipse(c + 4, c + 2, r * 0.58, r * 0.42, -0.4, 0, TAU);
      g.fill();
      for (let i = 0; i < 26; ++i) {
        const a = n(i, 1) * TAU, d = Math.sqrt(n(i, 2)) * r * 0.45;
        crystal(g, c + 4 + Math.cos(a) * d, c + 2 + Math.sin(a) * d * 0.75, 3 + n(i, 3) * 7, a + Math.PI, ore.glow, ore.color);
      }
      const sh = g.createLinearGradient(c - r, c - r, c + r, c + r);
      sh.addColorStop(0.5, 'rgba(0,0,0,0)');
      sh.addColorStop(1, 'rgba(0,0,8,0.55)');
      g.fillStyle = sh;
      g.fillRect(0, 0, w, w);
      g.restore();
      outline(g, pts, c, r);
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 1.5;
      g.stroke();
    });
  }

  /* The Crown Heart: a great crown of void crystal prisms around a burning core */
  function crown() {
    const R = 190, w = R * 2 + 20, c = w / 2;
    return K.sprite('crown', w, w, (g) => {
      const n = K.valueNoise(7777);
      const core = g.createRadialGradient(c, c, 0, c, c, R * 0.7);
      core.addColorStop(0, 'rgba(255,240,255,0.9)');
      core.addColorStop(0.3, 'rgba(200,120,255,0.55)');
      core.addColorStop(1, 'rgba(80,20,160,0)');
      g.fillStyle = core;
      g.fillRect(0, 0, w, w);
      outline(g, shape(4, 0), c, R * 0.55);
      g.fillStyle = '#241634';
      g.fill();
      for (let i = 0; i < 34; ++i) {
        const a = i * TAU / 34 + n(i, 1) * 0.3;
        const L = R * (0.5 + n(i, 2) * 0.5);
        const wd = R * (0.06 + n(i, 3) * 0.07);
        g.save();
        g.translate(c, c);
        g.rotate(a);
        const gr = g.createLinearGradient(0, -wd, 0, wd);
        gr.addColorStop(0, '#f6e4ff');
        gr.addColorStop(0.45, '#b46aff');
        gr.addColorStop(1, '#3a1464');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(R * 0.25, -wd);
        g.lineTo(L, -wd * 0.7);
        g.lineTo(L + wd * 1.4, 0);
        g.lineTo(L, wd * 0.7);
        g.lineTo(R * 0.25, wd);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(20,0,40,0.6)';
        g.lineWidth = 1.2;
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.beginPath();
        g.moveTo(R * 0.3, -wd * 0.5);
        g.lineTo(L, -wd * 0.4);
        g.stroke();
        g.restore();
      }
      const hot = g.createRadialGradient(c, c, 0, c, c, R * 0.3);
      hot.addColorStop(0, '#ffffff');
      hot.addColorStop(0.4, 'rgba(240,200,255,0.8)');
      hot.addColorStop(1, 'rgba(180,106,255,0)');
      g.fillStyle = hot;
      g.beginPath();
      g.arc(c, c, R * 0.3, 0, TAU);
      g.fill();
    });
  }

  Object.assign(NS.rockArt, {
    shape, body, veins, veinGlow, cracks, nugget, salvage, chip, geode, crown
  });
})();
