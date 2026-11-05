/* Procedural rock art, painted once per type, size and shape variant: a lumpy silhouette lit
   from the upper left with mottling, craters with lit rims, a terminator shadow and each type's
   character (ore streaks, crystal facets, molten fissures, frost, storm veins, void swirls, gold
   nuggets and the seasonal looks - snow caps, blossoms, sun glow, leaves, carved gourds, ribbons);
   crack overlays per damage stage; glow colours for the rocks that shine. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const { TAU, ROCK_R } = NS.constants;
  const { ROCK_TYPES } = NS.rockData;
  const K = NS.artKit;
  const { makeRng, hashString } = NS.rng;

  const SHINE = { crystal: '#b0f0ff', explosive: '#ff8a30', lava: '#ff7a20', electric: '#e0f8ff', void: '#ff4ad0', gold: '#ffd25a', sun: '#ffb030', pumpkin: '#ff9a20', ice: '#bfe8ff' };

  /* the silhouette: radius per vertex, shared by the body and the crack overlay */
  function outline(size, variant, type) {
    const rng = makeRng(hashString('rock:' + size + ':' + variant));
    const n = 9 + size * 3;
    const pts = [];
    const sharp = type === 'crystal' ? 0.5 : 1;
    for (let i = 0; i < n; ++i) {
      const a = i / n * TAU + (rng() - 0.5) * 0.25;
      const k = type === 'crystal' ? (i % 2 ? 0.84 : 1) * (0.88 + rng() * 0.12) : 0.76 + rng() * 0.26 * sharp;
      pts.push([Math.cos(a) * k, Math.sin(a) * k]);
    }
    return pts;
  }

  function trace(g, pts, cx, cy, r, smooth) {
    g.beginPath();
    if (!smooth) {
      for (let i = 0; i < pts.length; ++i) {
        const x = cx + pts[i][0] * r, y = cy + pts[i][1] * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    } else {
      const n = pts.length;
      const mid = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
      const m0 = mid(0);
      g.moveTo(cx + m0[0] * r, cy + m0[1] * r);
      for (let i = 1; i <= n; ++i) {
        const p = pts[i % n], m = mid(i);
        g.quadraticCurveTo(cx + p[0] * r, cy + p[1] * r, cx + m[0] * r, cy + m[1] * r);
      }
    }
    g.closePath();
  }

  function rock(type, size, variant) {
    const r = ROCK_R[size];
    const dim = Math.ceil(r * 2 + 10);
    return K.sprite('rock:' + type + ':' + size + ':' + variant, dim, dim, (g, w, h) => paint(g, w / 2, h / 2, r, type, size, variant));
  }

  function paint(g, cx, cy, r, type, size, variant) {
    const T = ROCK_TYPES[type];
    const pal = T.pal;
    const rng = makeRng(hashString('rockpaint:' + type + ':' + size + ':' + variant));
    const pts = outline(size, variant, type);
    const smooth = type !== 'crystal';
    /* body */
    trace(g, pts, cx, cy, r, smooth);
    const body = g.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.05, cx, cy, r * 1.05);
    body.addColorStop(0, pal[0]);
    body.addColorStop(0.42, pal[1]);
    body.addColorStop(1, pal[2]);
    g.fillStyle = body;
    g.fill();
    g.save();
    trace(g, pts, cx, cy, r, smooth);
    g.clip();
    /* mottling */
    const blots = 10 + size * 8;
    for (let i = 0; i < blots; ++i) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * r;
      const br = r * (0.06 + rng() * 0.16);
      g.fillStyle = K.rgba(rng() < 0.5 ? pal[2] : pal[0], 0.08 + rng() * 0.1);
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, br, 0, TAU);
      g.fill();
    }
    decorate(g, cx, cy, r, type, size, rng, pal);
    /* terminator: the lower right falls into shadow */
    const sh = g.createRadialGradient(cx - r * 0.5, cy - r * 0.5, r * 0.4, cx - r * 0.2, cy - r * 0.2, r * 1.7);
    sh.addColorStop(0, 'rgba(0,0,0,0)');
    sh.addColorStop(0.55, 'rgba(0,0,0,0.12)');
    sh.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = sh;
    g.fillRect(cx - r - 2, cy - r - 2, r * 2 + 4, r * 2 + 4);
    glowInside(g, cx, cy, r, type, rng);
    g.restore();
    /* rim light on the lit side and a dark outline */
    const rim = g.createLinearGradient(cx - r, cy - r, cx + r * 0.4, cy + r * 0.4);
    rim.addColorStop(0, K.rgba(pal[0], 0.85));
    rim.addColorStop(0.5, K.rgba(pal[0], 0.15));
    rim.addColorStop(1, 'rgba(0,0,0,0)');
    trace(g, pts, cx, cy, r, smooth);
    g.lineWidth = Math.max(1.2, r * 0.06);
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.stroke();
    g.lineWidth = Math.max(1, r * 0.035);
    g.strokeStyle = rim;
    g.stroke();
    if (type === 'crystal' || type === 'ice') {
      g.strokeStyle = K.rgba(pal[3], 0.7);
      g.lineWidth = 1;
      g.stroke();
    }
    seasonalTop(g, cx, cy, r, type, size, rng, pts);
  }

  function craters(g, cx, cy, r, n, rng, pal) {
    for (let i = 0; i < n; ++i) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.62;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const cr = r * (0.09 + rng() * 0.15);
      g.fillStyle = K.rgba(pal[2], 0.55);
      g.beginPath();
      g.ellipse(x, y, cr, cr * 0.85, a, 0, TAU);
      g.fill();
      g.strokeStyle = K.rgba(pal[0], 0.45);
      g.lineWidth = Math.max(0.8, cr * 0.22);
      g.beginPath();
      g.arc(x, y, cr * 0.9, 0.1 * Math.PI, 0.9 * Math.PI);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.arc(x, y, cr * 0.9, 1.1 * Math.PI, 1.9 * Math.PI);
      g.stroke();
    }
  }

  function veins(g, cx, cy, r, n, rng, color, width) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    for (let i = 0; i < n; ++i) {
      let x = cx + (rng() - 0.5) * r * 0.6, y = cy + (rng() - 0.5) * r * 0.6;
      let a = rng() * TAU;
      g.lineWidth = width * (0.6 + rng() * 0.8);
      g.beginPath();
      g.moveTo(x, y);
      const segs = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < segs; ++k) {
        a += (rng() - 0.5) * 1.4;
        x += Math.cos(a) * r * 0.28;
        y += Math.sin(a) * r * 0.28;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }

  function decorate(g, cx, cy, r, type, size, rng, pal) {
    switch (type) {
      case 'normal':
      case 'snow':
      case 'leaf':
        craters(g, cx, cy, r, 2 + size, rng, pal);
        break;
      case 'iron':
        for (let i = 0; i < 4 + size; ++i) {
          const y = cy - r + rng() * r * 2;
          g.fillStyle = K.rgba(i % 2 ? pal[0] : pal[2], 0.18);
          g.fillRect(cx - r, y, r * 2, r * (0.05 + rng() * 0.08));
        }
        craters(g, cx, cy, r, 1 + size, rng, pal);
        for (let i = 0; i < 3 + size * 2; ++i) {
          g.fillStyle = K.rgba(pal[3], 0.75);
          g.fillRect(cx + (rng() - 0.5) * r * 1.4, cy + (rng() - 0.5) * r * 1.4, 1.6, 1.6);
        }
        break;
      case 'crystal': {
        for (let i = 0; i < 5 + size * 2; ++i) {
          const a = rng() * TAU;
          g.fillStyle = K.rgba(i % 3 === 0 ? pal[3] : pal[0], 0.16 + rng() * 0.18);
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
          g.lineTo(cx + Math.cos(a + 0.5) * r * 1.2, cy + Math.sin(a + 0.5) * r * 1.2);
          g.closePath();
          g.fill();
        }
        g.strokeStyle = K.rgba(pal[3], 0.5);
        g.lineWidth = 1;
        for (let i = 0; i < 4 + size; ++i) {
          const a = rng() * TAU;
          g.beginPath();
          g.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2);
          g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          g.stroke();
        }
        break;
      }
      case 'explosive':
        craters(g, cx, cy, r, 1 + size, rng, pal);
        veins(g, cx, cy, r, 3 + size, rng, K.rgba('#ff6a20', 0.9), r * 0.09);
        veins(g, cx, cy, r, 2 + size, rng, K.rgba('#ffe080', 0.9), r * 0.035);
        break;
      case 'ice':
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = 1;
        for (let i = 0; i < 6 + size * 2; ++i) {
          const x = cx + (rng() - 0.5) * r * 1.6, y = cy + (rng() - 0.5) * r * 1.6, l = r * (0.15 + rng() * 0.3);
          g.beginPath();
          g.moveTo(x - l, y - l * 0.4);
          g.lineTo(x + l, y + l * 0.4);
          g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.14, -0.6, 0, TAU);
        g.fill();
        break;
      case 'lava':
        veins(g, cx, cy, r, 4 + size * 2, rng, K.rgba('#ff5010', 0.95), r * 0.1);
        veins(g, cx, cy, r, 3 + size, rng, K.rgba('#ffd060', 0.95), r * 0.04);
        craters(g, cx, cy, r, size, rng, pal);
        break;
      case 'electric':
        craters(g, cx, cy, r, 1 + size, rng, pal);
        veins(g, cx, cy, r, 3 + size, rng, K.rgba('#a0f0ff', 0.85), r * 0.05);
        break;
      case 'void': {
        for (let i = 0; i < 3; ++i) {
          g.strokeStyle = K.rgba(i === 1 ? '#ff4ad0' : '#a060ff', 0.45);
          g.lineWidth = r * 0.05;
          g.beginPath();
          for (let t = 0; t < 40; ++t) {
            const a = t * 0.3 + i * 2.1, d = r * (0.1 + t / 40 * 0.8);
            const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
            if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
        break;
      }
      case 'gold':
        craters(g, cx, cy, r, 1 + size, rng, ['#e8d0a0', '#7a6040', '#3a2a18']);
        for (let i = 0; i < 4 + size * 3; ++i) {
          const a = rng() * TAU, d = Math.sqrt(rng()) * r * 0.75;
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, nr = r * (0.06 + rng() * 0.1);
          const gr = g.createRadialGradient(x - nr * 0.3, y - nr * 0.3, 0, x, y, nr);
          gr.addColorStop(0, '#fffbe0');
          gr.addColorStop(0.5, '#ffd25a');
          gr.addColorStop(1, '#a06a10');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(x, y, nr, 0, TAU);
          g.fill();
        }
        break;
      case 'bloom':
        craters(g, cx, cy, r, size, rng, pal);
        for (let i = 0; i < 3 + size * 2; ++i) flower(g, cx + (rng() - 0.5) * r * 1.3, cy + (rng() - 0.5) * r * 1.3, r * (0.1 + rng() * 0.07), rng() < 0.5 ? '#ffffff' : '#ffd0e8');
        break;
      case 'sun':
        veins(g, cx, cy, r, 5 + size, rng, K.rgba('#ffffff', 0.6), r * 0.05);
        break;
      case 'pumpkin': {
        g.strokeStyle = K.rgba(pal[2], 0.6);
        g.lineWidth = r * 0.07;
        for (let i = -2; i <= 2; ++i) {
          g.beginPath();
          g.ellipse(cx + i * r * 0.28, cy, r * (0.3 - Math.abs(i) * 0.04), r * 0.95, 0, 0, TAU);
          g.stroke();
        }
        break;
      }
      case 'gift':
        g.fillStyle = '#ffd040';
        g.fillRect(cx - r * 0.12, cy - r, r * 0.24, r * 2);
        g.fillRect(cx - r, cy - r * 0.12, r * 2, r * 0.24);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(cx - r * 0.12, cy - r, r * 0.07, r * 2);
        break;
    }
  }

  function flower(g, x, y, s, col) {
    g.fillStyle = col;
    for (let k = 0; k < 5; ++k) {
      const a = k * TAU / 5;
      g.beginPath();
      g.arc(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.5, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#ffd040';
    g.beginPath();
    g.arc(x, y, s * 0.35, 0, TAU);
    g.fill();
  }

  /* lights inside the rock (drawn under the clip, after the shadow so they stay bright) */
  function glowInside(g, cx, cy, r, type, rng) {
    if (type === 'pumpkin') {
      /* a carved, glowing face */
      g.fillStyle = '#ffe060';
      g.beginPath();
      g.moveTo(cx - r * 0.45, cy - r * 0.15); g.lineTo(cx - r * 0.2, cy - r * 0.4); g.lineTo(cx - r * 0.1, cy - r * 0.1); g.closePath();
      g.moveTo(cx + r * 0.45, cy - r * 0.15); g.lineTo(cx + r * 0.2, cy - r * 0.4); g.lineTo(cx + r * 0.1, cy - r * 0.1); g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx - r * 0.5, cy + r * 0.15);
      for (let i = 0; i <= 6; ++i) g.lineTo(cx - r * 0.5 + i * r / 6, cy + r * (i % 2 ? 0.28 : 0.42));
      g.lineTo(cx + r * 0.5, cy + r * 0.15);
      g.quadraticCurveTo(cx, cy + r * 0.75, cx - r * 0.5, cy + r * 0.15);
      g.fill();
    }
    if (type === 'sun' || type === 'explosive' || type === 'lava') {
      const c = type === 'sun' ? '#fff0a0' : '#ff8a30';
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 0.7);
      gr.addColorStop(0, K.rgba(c, type === 'sun' ? 0.75 : 0.35));
      gr.addColorStop(1, K.rgba(c, 0));
      g.fillStyle = gr;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }

  /* toppings that sit over the silhouette: snow caps, a leaf, a bow */
  function seasonalTop(g, cx, cy, r, type, size, rng, pts) {
    if (type === 'snow') {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath();
      const n = pts.length;
      let first = true;
      for (let i = 0; i < n; ++i) {
        const p = pts[i];
        if (p[1] > -0.15) continue;
        const x = cx + p[0] * r * 1.02, y = cy + p[1] * r * 1.02;
        if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y);
      }
      for (let i = 6; i >= 0; --i) g.lineTo(cx - r * 0.8 + i * r * 0.27, cy - r * 0.18 + (i % 2) * r * 0.12);
      g.closePath();
      g.fill();
    } else if (type === 'leaf') {
      for (let i = 0; i < 2 + size; ++i) leaf(g, cx + (rng() - 0.5) * r, cy + (rng() - 0.5) * r, r * 0.3, rng() * TAU, rng() < 0.5 ? '#ffb040' : '#e05a20');
    } else if (type === 'pumpkin') {
      g.fillStyle = '#4a8a20';
      g.fillRect(cx - r * 0.07, cy - r * 1.05, r * 0.14, r * 0.3);
    } else if (type === 'gift') {
      g.fillStyle = '#ffd040';
      g.beginPath();
      g.ellipse(cx - r * 0.2, cy - r * 0.86, r * 0.22, r * 0.12, -0.5, 0, TAU);
      g.ellipse(cx + r * 0.2, cy - r * 0.86, r * 0.22, r * 0.12, 0.5, 0, TAU);
      g.fill();
    }
  }

  function leaf(g, x, y, s, a, col) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-s, 0);
    g.quadraticCurveTo(0, -s * 0.6, s, 0);
    g.quadraticCurveTo(0, s * 0.6, -s, 0);
    g.fill();
    g.strokeStyle = 'rgba(80,20,0,0.6)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(-s, 0);
    g.lineTo(s, 0);
    g.stroke();
    g.restore();
  }

  /* hairline cracks for a damaged rock, by stage 1..2 */
  function cracks(size, variant, stage) {
    const r = ROCK_R[size];
    const dim = Math.ceil(r * 2 + 10);
    return K.sprite('crack:' + size + ':' + variant + ':' + stage, dim, dim, (g, w, h) => {
      const rng = makeRng(hashString('crack:' + size + ':' + variant));
      const cx = w / 2, cy = h / 2;
      g.lineCap = 'round';
      const n = stage * 2 + size;
      for (let i = 0; i < n; ++i) {
        let x = cx + (rng() - 0.5) * r * 0.3, y = cy + (rng() - 0.5) * r * 0.3;
        let a = rng() * TAU;
        g.strokeStyle = 'rgba(0,0,0,0.75)';
        g.lineWidth = Math.max(1, r * 0.05);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; ++k) {
          a += (rng() - 0.5) * 1.1;
          x += Math.cos(a) * r * 0.22;
          y += Math.sin(a) * r * 0.22;
          g.lineTo(x, y);
        }
        g.stroke();
        g.strokeStyle = 'rgba(255,240,200,0.35)';
        g.lineWidth = Math.max(0.5, r * 0.015);
        g.stroke();
      }
    });
  }

  function shine(type) {
    return SHINE[type] || null;
  }

  /* ── pre-painting: every shape of a type is painted a few per frame before it is needed ── */
  const queue = [];
  const queued = {};

  function want(type) {
    if (queued[type] || !ROCK_TYPES[type]) return;
    queued[type] = true;
    for (let size = 3; size >= 1; --size)
      for (let v = 0; v < 6; ++v) queue.push([type, size, v]);
    if (!queued['#cracks']) {
      queued['#cracks'] = true;
      for (let size = 3; size >= 1; --size)
        for (let v = 0; v < 6; ++v) queue.push(['#cracks', size, v]);
    }
  }

  /* paints up to n queued sprites; returns how many are still waiting */
  function warmStep(n) {
    while (n > 0 && queue.length) {
      const q = queue.shift();
      if (q[0] === '#cracks') {
        if (!K.has('crack:' + q[1] + ':' + q[2] + ':1')) { cracks(q[1], q[2], 1); --n; }
        if (!K.has('crack:' + q[1] + ':' + q[2] + ':2')) { cracks(q[1], q[2], 2); --n; }
      } else if (!K.has('rock:' + q[0] + ':' + q[1] + ':' + q[2])) {
        rock(q[0], q[1], q[2]);
        --n;
      }
    }
    return queue.length;
  }

  Object.assign(NS.rockArt, {
    rock, cracks, shine, outline, flower, leaf, want, warmStep
  });
})();
