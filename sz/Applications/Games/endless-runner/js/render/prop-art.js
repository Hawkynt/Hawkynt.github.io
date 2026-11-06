/* Everything on the course, painted once per world: the ground tile with its grass, sand,
   snow, steel or crystal top and the cliff edges at pits, what lies down in the pits, ledges,
   the obstacles in each world's look (fences, crates, overhangs, walls, spikes, saws, drones,
   falling rocks, rollers, guardian projectiles), spring and boost pads, the finish gate, coins,
   gems, Spark Shards, festival tokens, power-up orbs and the thirteen power-up icons, and the
   small particle shapes. Paints only; the sprite cache owns the canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const K = NS.artKit;
  const { WORLDS } = NS.worlds;
  const { TAU } = NS.constants;
  const { POWER_BY_ID, BAR_DECK, BAR_GAP } = NS.items;

  const OUT = '#141224';

  function noiseDots(g, w, h, n, colors, seed, size) {
    const r = NS.rng.makeRng(seed);
    for (let i = 0; i < n; ++i) {
      g.fillStyle = colors[i % colors.length];
      const s = (size || 3) * (0.5 + r());
      g.fillRect(r() * w, r() * h, s, s * 0.7);
    }
  }

  /* ── ground ── */
  function groundTile(w) {
    return K.sprite('ground:' + w, 256, 240, (g, tw, th) => {
      const W = WORLDS[w], c = W.ground;
      const gr = g.createLinearGradient(0, 10, 0, th);
      gr.addColorStop(0, c[2]);
      gr.addColorStop(1, c[3]);
      g.fillStyle = gr;
      g.fillRect(0, 10, tw, th - 10);
      /* strata and stones */
      g.fillStyle = K.rgba(c[3], 0.5);
      for (let y = 44; y < th; y += 34) g.fillRect(0, y + Math.sin(y) * 4, tw, 5);
      noiseDots(g, tw, th - 30, 60, [K.shade(c[2], 0.15), K.shade(c[3], -0.2)], 7 + w, 5);
      if (w === 3) {
        g.strokeStyle = K.rgba('#38e0ff', 0.25);
        g.lineWidth = 2;
        for (let x = 0; x < tw; x += 64) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, th); g.stroke(); }
        g.strokeStyle = K.rgba('#ff4ab8', 0.5);
        g.beginPath(); g.moveTo(0, 30); g.lineTo(tw, 30); g.stroke();
      }
      /* the top surface */
      g.fillStyle = c[1];
      g.fillRect(0, 6, tw, 18);
      g.fillStyle = c[0];
      g.fillRect(0, 0, tw, 12);
      g.fillStyle = K.shade(c[0], 0.35);
      g.fillRect(0, 0, tw, 3);
      const r = NS.rng.makeRng(19 + w);
      if (w === 0) {
        for (let x = 0; x < tw; x += 6) {
          g.fillStyle = r() < 0.5 ? c[0] : K.shade(c[0], 0.2);
          K.poly(g, [[x, 12], [x + 3, -2 - r() * 6], [x + 6, 12]]); g.fill();
        }
        for (let i = 0; i < 5; ++i) {
          g.fillStyle = ['#ffe06a', '#ff8ab0', '#ffffff'][i % 3];
          g.beginPath(); g.arc(r() * tw, -2 + r() * 6, 2.5, 0, TAU); g.fill();
        }
      } else if (w === 1) {
        for (let x = 0; x < tw; x += 18) { g.fillStyle = K.shade(c[0], -0.1); g.fillRect(x + r() * 10, 4 + r() * 6, 8, 2); }
      } else if (w === 2) {
        g.fillStyle = '#ffffff';
        for (let x = 0; x < tw; x += 20) { g.beginPath(); g.arc(x + 10, 2, 11, Math.PI, 0); g.fill(); }
        g.fillStyle = K.rgba('#8ad0ff', 0.5);
        g.fillRect(0, 14, tw, 3);
      } else if (w === 3) {
        g.fillStyle = '#ffd24a';
        for (let x = 0; x < tw; x += 32) g.fillRect(x, 8, 16, 3);
      } else {
        g.fillStyle = K.rgba('#e0b0ff', 0.8);
        for (let x = 0; x < tw; x += 24) { K.poly(g, [[x, 10], [x + 6, -4 - r() * 6], [x + 12, 10]]); g.fill(); }
      }
    });
  }

  /* the rim where ground breaks off into a pit (side -1 left edge of a span, +1 right edge) */
  function groundEdge(w, side) {
    return K.sprite('edge:' + w + ':' + side, 28, 240, (g, ew, eh) => {
      const c = WORLDS[w].ground;
      const x0 = side > 0 ? 0 : ew;
      g.fillStyle = K.shade(c[3], -0.3);
      K.poly(g, [[x0, 0], [x0 + side * 16, 14], [x0 + side * 22, 80], [x0 + side * 12, eh], [x0, eh]]);
      g.fill();
      g.fillStyle = c[0];
      K.poly(g, [[x0, 0], [x0 + side * 18, 2], [x0 + side * 14, 12], [x0, 12]]);
      g.fill();
    });
  }

  function pitFill(w) {
    return K.sprite('pit:' + w, 32, 200, (g, pw, ph) => {
      const kind = WORLDS[w].pit;
      const cols = { water: ['#5ab8f0', '#0a2a5a'], lava: ['#ffd04a', '#5a0a04'], chasm: ['#3a4a6a', '#05080f'], neon: ['#3a1a78', '#05020e'], void: ['#6a3a9a', '#05020e'] }[kind];
      const gr = g.createLinearGradient(0, 0, 0, ph);
      gr.addColorStop(0, cols[0]);
      gr.addColorStop(kind === 'lava' ? 0.18 : 0.4, K.mix(cols[0], cols[1], 0.5));
      gr.addColorStop(1, cols[1]);
      g.fillStyle = gr;
      g.fillRect(0, 0, pw, ph);
      if (kind === 'lava') {
        g.fillStyle = 'rgba(255,250,200,0.9)'; g.fillRect(0, 0, pw, 4);
        g.fillStyle = 'rgba(90,20,6,0.55)';
        g.fillRect(3, 18, 10, 4); g.fillRect(18, 34, 9, 3); g.fillRect(6, 56, 12, 4);
      } else if (kind === 'water') {
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, pw, 3); g.fillRect(4, 16, 12, 2); g.fillRect(18, 30, 10, 2);
      } else {
        g.fillStyle = 'rgba(255,255,255,0.08)';
        for (let i = 0; i < 6; ++i) g.fillRect((i * 13) % pw, 20 + i * 28, 2, 2);
      }
    });
  }

  function platTile(w) {
    return K.sprite('plat:' + w, 64, 34, (g, pw, ph) => {
      const c = WORLDS[w].ground;
      g.fillStyle = OUT;
      K.roundRect(g, 0, 2, pw, ph - 4, 6); g.fill();
      g.fillStyle = c[2];
      K.roundRect(g, 1, 4, pw - 2, ph - 8, 5); g.fill();
      g.fillStyle = c[0];
      g.fillRect(1, 2, pw - 2, 9);
      g.fillStyle = K.shade(c[0], 0.35);
      g.fillRect(1, 2, pw - 2, 2);
      g.fillStyle = K.rgba(c[3], 0.6);
      g.fillRect(8, 18, 10, 4); g.fillRect(36, 22, 14, 3);
    });
  }

  /* ── obstacles ── */
  function hurdle(w) {
    return K.sprite('hurdle:' + w, 50, 60, (g) => {
      const W = WORLDS[w];
      g.translate(25, 58);
      if (w === 0) {
        for (const px of [-14, 12]) { g.fillStyle = OUT; g.fillRect(px - 4, -48, 9, 48); g.fillStyle = '#b07a44'; g.fillRect(px - 2, -46, 5, 46); }
        for (const py of [-38, -20]) { g.fillStyle = OUT; g.fillRect(-20, py - 4, 40, 10); g.fillStyle = '#d8a060'; g.fillRect(-18, py - 2, 36, 6); }
      } else if (w === 1) {
        g.fillStyle = OUT; g.beginPath(); g.ellipse(0, -16, 22, 18, 0, 0, TAU); g.fill();
        g.fillStyle = '#e8dcc0'; g.beginPath(); g.ellipse(0, -16, 19, 15, 0, 0, TAU); g.fill();
        g.fillStyle = OUT; g.beginPath(); g.arc(-6, -20, 4, 0, TAU); g.arc(6, -20, 4, 0, TAU); g.fill();
        g.fillRect(-5, -8, 10, 3);
      } else if (w === 2) {
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -10, 24, 22, 0, Math.PI, 0); g.fill();
        g.fillStyle = '#bfe0f8'; g.beginPath(); g.ellipse(4, -6, 16, 12, 0, Math.PI, 0); g.fill();
      } else if (w === 3) {
        g.fillStyle = OUT; K.poly(g, [[-14, 0], [-4, -46], [4, -46], [14, 0]]); g.fill();
        g.fillStyle = '#ff7a1a'; K.poly(g, [[-11, -2], [-3, -43], [3, -43], [11, -2]]); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(-7, -30, 14, 6); g.fillRect(-9, -14, 18, 5);
      } else {
        g.fillStyle = W.accent;
        for (let i = -2; i <= 2; ++i) { K.poly(g, [[i * 8 - 6, 0], [i * 8, -26 - (2 - Math.abs(i)) * 9], [i * 8 + 6, 0]]); g.fill(); }
        g.fillStyle = K.rgba('#ffffff', 0.6);
        K.poly(g, [[-2, -10], [0, -40], [2, -10]]); g.fill();
      }
    });
  }

  function block(w) {
    return K.sprite('block:' + w, 66, 66, (g) => {
      const W = WORLDS[w];
      g.translate(4, 4);
      if (w === 1) {
        g.translate(29, 58);
        g.scale(0.72, 0.72);
        g.fillStyle = OUT;
        K.roundRect(g, -10, -80, 20, 80, 10); g.fill();
        g.fillStyle = '#4a9a4a';
        K.roundRect(g, -8, -78, 16, 78, 8); g.fill();
        K.roundRect(g, -26, -56, 10, 28, 5); g.fill(); K.roundRect(g, -26, -32, 20, 9, 4); g.fill();
        K.roundRect(g, 16, -64, 10, 26, 5); g.fill(); K.roundRect(g, 6, -44, 20, 9, 4); g.fill();
        g.fillStyle = '#8ae08a'; g.fillRect(-5, -74, 3, 66);
        return;
      }
      const body = ['#c88a4a', '#c88a4a', '#bfe8ff', '#3a3a5a', '#4a2a7a'][w];
      g.fillStyle = OUT; K.roundRect(g, 0, 0, 58, 58, 5); g.fill();
      g.fillStyle = body; K.roundRect(g, 2, 2, 54, 54, 4); g.fill();
      if (w === 0) {
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 4;
        g.strokeRect(6, 6, 46, 46);
        g.beginPath(); g.moveTo(8, 8); g.lineTo(50, 50); g.moveTo(50, 8); g.lineTo(8, 50); g.stroke();
      } else if (w === 2) {
        g.fillStyle = 'rgba(255,255,255,0.7)';
        K.poly(g, [[6, 6], [30, 6], [6, 30]]); g.fill();
        g.strokeStyle = '#8ad0ff'; g.lineWidth = 2; g.strokeRect(4, 4, 50, 50);
      } else if (w === 3) {
        for (let i = 0; i < 4; ++i) { g.fillStyle = i % 2 ? '#ffd24a' : OUT; K.poly(g, [[i * 16, 56], [i * 16 + 14, 40], [i * 16 + 22, 40], [i * 16 + 8, 56]]); g.fill(); }
        g.fillStyle = W.accent; g.fillRect(8, 12, 42, 4);
        g.fillStyle = '#38e0ff'; g.fillRect(8, 22, 20, 3);
      } else {
        g.fillStyle = K.rgba(W.accent, 0.8);
        K.poly(g, [[29, 6], [50, 29], [29, 52], [8, 29]]); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        K.poly(g, [[29, 6], [36, 29], [29, 52]]); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(2, 2, 54, 4);
    });
  }

  /* an overhang beam, 8 px above its deck down to its dangerous lower edge, tiling sideways */
  function barTile(w) {
    const hgt = BAR_DECK - BAR_GAP + 8 + 14;
    return K.sprite('bar:' + w, 64, hgt, (g, bw, bh) => {
      const W = WORLDS[w];
      const body = ['#9a6a3a', '#8a4a2a', '#9ac8e8', '#2e3048', '#3a1c5e'][w];
      const top = W.ground[0];
      const by = 8, bb = bh - 14;
      g.fillStyle = OUT; g.fillRect(0, by - 2, bw, bb - by + 4);
      const gr = g.createLinearGradient(0, by, 0, bb);
      gr.addColorStop(0, K.shade(body, 0.15)); gr.addColorStop(1, K.shade(body, -0.3));
      g.fillStyle = gr; g.fillRect(0, by, bw, bb - by);
      g.fillStyle = top; g.fillRect(0, by, bw, 9);
      g.fillStyle = K.shade(top, 0.35); g.fillRect(0, by, bw, 2);
      g.fillStyle = K.rgba(OUT, 0.35);
      g.fillRect(0, by + 30, bw, 3); g.fillRect(30, by + 9, 3, bb - by - 9);
      if (w === 0) {
        g.fillStyle = K.shade(body, 0.25); g.fillRect(6, by + 16, 18, 3); g.fillRect(38, by + 46, 20, 3);
        g.fillStyle = '#5fbf5a';
        for (let x = 0; x < bw; x += 10) { g.beginPath(); g.arc(x + 5, bb, 6, 0, Math.PI); g.fill(); }
      } else if (w === 1) {
        g.fillStyle = '#6a3018';
        for (let x = 0; x < bw; x += 16) { K.poly(g, [[x, bb - 2], [x + 8, bb + 12], [x + 16, bb - 2]]); g.fill(); }
      } else if (w === 2) {
        g.fillStyle = '#e8f8ff';
        for (let x = 0; x < bw; x += 12) { K.poly(g, [[x, bb - 2], [x + 6, bb + 8 + (x % 24 ? 0 : 5)], [x + 12, bb - 2]]); g.fill(); }
      } else if (w === 3) {
        g.fillStyle = '#ffd24a';
        for (let x = 0; x < bw; x += 24) { K.poly(g, [[x, bb - 14], [x + 12, bb - 14], [x + 24, bb - 4], [x + 12, bb - 4]]); g.fill(); }
        g.fillStyle = '#ff3a6a'; g.fillRect(0, bb - 2, bw, 4);
        g.fillStyle = K.rgba('#ff3a6a', 0.35); g.fillRect(0, bb - 6, bw, 14);
      } else {
        g.fillStyle = K.rgba('#c08cff', 0.7);
        for (let x = 0; x < bw; x += 16) { g.beginPath(); g.arc(x + 8, bb, 7, 0, Math.PI); g.fill(); }
        g.fillStyle = '#ff6ad5'; g.fillRect(0, bb - 2, bw, 2);
      }
    });
  }

  function wall(w) {
    return K.sprite('wall:' + w, 62, 204, (g) => {
      const W = WORLDS[w];
      const body = ['#8a8478', '#b4583a', '#cfe8fa', '#3a4a6a', '#3a1a5a'][w];
      g.fillStyle = OUT; K.roundRect(g, 2, 4, 58, 200, 6); g.fill();
      g.fillStyle = body; K.roundRect(g, 4, 6, 54, 196, 5); g.fill();
      g.fillStyle = K.shade(body, 0.2); g.fillRect(4, 6, 54, 6);
      g.fillStyle = K.shade(body, -0.2);
      for (let y = 20; y < 196; y += 24) for (let x = (y / 24) % 2 ? 4 : 18; x < 56; x += 28) g.fillRect(x, y, 24, 2);
      if (w === 3) { g.fillStyle = W.accent; g.fillRect(10, 40, 42, 4); g.fillStyle = '#38e0ff'; g.fillRect(10, 120, 42, 4); }
      if (w === 4) { g.fillStyle = K.rgba(W.accent, 0.8); g.fillRect(27, 20, 8, 160); }
    });
  }

  function spikeTile(w) {
    return K.sprite('spike:' + w, 40, 30, (g) => {
      const W = WORLDS[w];
      const c = ['#7a5a3a', '#ff6a1a', '#e8f8ff', '#ffd24a', W.accent][w];
      if (w === 1) { g.fillStyle = '#5a1a0a'; g.fillRect(0, 20, 40, 10); }
      g.fillStyle = OUT;
      for (let i = 0; i < 3; ++i) { K.poly(g, [[i * 13 + 1, 30], [i * 13 + 7, 0], [i * 13 + 14, 30]]); g.fill(); }
      g.fillStyle = c;
      for (let i = 0; i < 3; ++i) { K.poly(g, [[i * 13 + 3, 29], [i * 13 + 7, 4], [i * 13 + 12, 29]]); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 3; ++i) g.fillRect(i * 13 + 6, 8, 2, 14);
    });
  }

  function saw(w) {
    return K.sprite('saw:' + w, 72, 72, (g) => {
      const W = WORLDS[w];
      g.translate(36, 36);
      g.fillStyle = OUT;
      g.beginPath();
      for (let i = 0; i < 24; ++i) { const a = i / 24 * TAU, r = i % 2 ? 26 : 35; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.fill();
      g.fillStyle = w === 2 ? '#bfe8ff' : w >= 3 ? W.accent : '#d0d4dc';
      g.beginPath();
      for (let i = 0; i < 24; ++i) { const a = i / 24 * TAU, r = i % 2 ? 24 : 32; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.fill();
      g.fillStyle = K.shade(g.fillStyle, -0.3);
      g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
      g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-20, -3, 14, 3);
    });
  }

  function drone(w, f) {
    return K.sprite('drone:' + w + ':' + f, 72, 52, (g) => {
      const W = WORLDS[w];
      g.translate(36, 28);
      const flap = f ? -1 : 1;
      if (w === 3) {
        g.fillStyle = OUT; K.roundRect(g, -20, -10, 40, 20, 8); g.fill();
        g.fillStyle = '#4a5468'; K.roundRect(g, -18, -8, 36, 16, 6); g.fill();
        g.fillStyle = '#ff3a4a'; g.beginPath(); g.arc(-10, 0, 4, 0, TAU); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 3;
        g.beginPath(); g.moveTo(-26, -14 + flap * 2); g.lineTo(-6, -14 - flap * 2); g.moveTo(6, -14 - flap * 2); g.lineTo(26, -14 + flap * 2); g.stroke();
        return;
      }
      if (w === 4) {
        g.fillStyle = K.rgba(W.accent, 0.5); g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill();
        g.fillStyle = '#e0b0ff'; g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
        g.fillStyle = OUT; g.beginPath(); g.arc(-4, -2, 2.5, 0, TAU); g.arc(-10, -2, 2.5, 0, TAU); g.fill();
        g.fillStyle = K.rgba('#e0b0ff', 0.6); K.poly(g, [[8, -6], [26, -4 + flap * 4], [8, 6]]); g.fill();
        return;
      }
      const body = ['#ffd24a', '#6a4a3a', '#f0f4ff'][w];
      g.fillStyle = K.rgba('#ffffff', 0.7);
      g.beginPath(); g.ellipse(2, -12 - flap * 3, 14, 8, -0.4 * flap, 0, TAU); g.fill();
      g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 0, 21, 14, 0, 0, TAU); g.fill();
      g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 18, 11, 0, 0, TAU); g.fill();
      if (w === 0) { g.fillStyle = OUT; g.fillRect(-4, -11, 5, 22); g.fillRect(6, -10, 4, 20); }
      g.fillStyle = OUT; g.beginPath(); g.arc(-12, -3, 3, 0, TAU); g.fill();
      g.fillStyle = w === 1 ? '#ffb04a' : '#ff8a3a'; K.poly(g, [[-18, 0], [-28, 3], [-18, 5]]); g.fill();
    });
  }

  function rock(w) {
    return K.sprite('rock:' + w, 60, 60, (g) => {
      const W = WORLDS[w];
      g.translate(30, 30);
      if (w === 2 || w === 4) {
        g.fillStyle = OUT; K.poly(g, [[-16, -26], [16, -26], [4, 28], [-4, 28]]); g.fill();
        g.fillStyle = w === 2 ? '#e8f8ff' : W.accent; K.poly(g, [[-13, -24], [13, -24], [3, 24], [-3, 24]]); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)'; K.poly(g, [[-10, -22], [-2, -22], [0, 16]]); g.fill();
        return;
      }
      if (w === 0) {
        g.fillStyle = OUT; g.beginPath(); g.ellipse(0, 4, 22, 24, 0, 0, TAU); g.fill();
        g.fillStyle = '#b06a2a'; g.beginPath(); g.ellipse(0, 4, 19, 21, 0, 0, TAU); g.fill();
        g.fillStyle = '#6a3a1a'; K.roundRect(g, -22, -24, 44, 16, 7); g.fill();
        g.fillStyle = OUT; g.fillRect(-2, -32, 4, 10);
        return;
      }
      const body = w === 1 ? '#9a5a3a' : '#5a5a6a';
      g.fillStyle = OUT; K.poly(g, [[-26, 8], [-18, -20], [6, -27], [26, -10], [24, 18], [-10, 26]]); g.fill();
      g.fillStyle = body; K.poly(g, [[-23, 7], [-16, -18], [5, -24], [23, -9], [21, 16], [-9, 23]]); g.fill();
      g.fillStyle = K.shade(body, 0.25); K.poly(g, [[-16, -18], [5, -24], [0, -8], [-14, -4]]); g.fill();
    });
  }

  function roller(w) {
    return K.sprite('roller:' + w, 62, 62, (g) => {
      const W = WORLDS[w];
      g.translate(31, 31);
      const body = ['#e0c050', '#c09a5a', '#ffffff', '#8a5a2a', W.accent][w];
      g.fillStyle = OUT; g.beginPath(); g.arc(0, 0, 29, 0, TAU); g.fill();
      g.fillStyle = body; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.fill();
      g.strokeStyle = K.shade(body, -0.3); g.lineWidth = 3;
      if (w === 1) {
        for (let i = 0; i < 7; ++i) { g.beginPath(); g.arc(Math.cos(i) * 6, Math.sin(i * 2) * 6, 10 + i * 2, i, i + 2.4); g.stroke(); }
      } else if (w === 3) {
        g.strokeRect(-26, -10, 52, 4); g.strokeRect(-26, 8, 52, 4);
      } else if (w === 4) {
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-6, -6, 7, 0, TAU); g.fill();
      } else {
        g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.stroke();
        g.beginPath(); g.arc(0, 0, 7, 0, TAU); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(-8, -10, 8, 0, TAU); g.fill();
    });
  }

  function proj(look) {
    return K.sprite('proj:' + look, 64, 40, (g) => {
      g.translate(32, 20);
      const c = { boar: '#9be08a', wyrm: '#ffb04a', avalanche: '#e8f4ff', warden: '#ff4ab8', king: '#c08cff' }[look] || '#ffffff';
      const gr = g.createLinearGradient(30, 0, -30, 0);
      gr.addColorStop(0, K.rgba(c, 0));
      gr.addColorStop(1, K.rgba(c, 0.6));
      g.fillStyle = gr;
      K.poly(g, [[-10, -12], [30, -4], [30, 4], [-10, 12]]); g.fill();
      if (look === 'warden') {
        g.fillStyle = OUT; K.roundRect(g, -24, -8, 34, 16, 6); g.fill();
        g.fillStyle = '#d0d4dc'; K.roundRect(g, -22, -6, 30, 12, 5); g.fill();
        g.fillStyle = c; K.poly(g, [[-30, 0], [-22, -6], [-22, 6]]); g.fill();
        g.fillStyle = '#ffb03a'; g.fillRect(8, -4, 8, 8);
        return;
      }
      g.fillStyle = OUT; g.beginPath(); g.arc(-12, 0, 14, 0, TAU); g.fill();
      g.fillStyle = c; g.beginPath(); g.arc(-12, 0, 11, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-15, -3, 5, 0, TAU); g.fill();
    });
  }

  function pad(kind, w) {
    return K.sprite('pad:' + kind, kind === 'spring' ? 76 : 96, 34, (g, pw) => {
      if (kind === 'spring') {
        g.fillStyle = OUT; K.roundRect(g, 2, 22, 72, 12, 4); g.fill();
        g.strokeStyle = '#d0d4dc'; g.lineWidth = 3;
        g.beginPath(); for (let i = 0; i < 6; ++i) { g.lineTo(14 + i * 9, i % 2 ? 22 : 12); } g.stroke();
        g.fillStyle = OUT; K.roundRect(g, 4, 4, 68, 10, 4); g.fill();
        g.fillStyle = '#7cff9a'; K.roundRect(g, 6, 5, 64, 7, 3); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(10, 6, 30, 2);
      } else {
        g.fillStyle = OUT; K.roundRect(g, 0, 20, pw, 12, 4); g.fill();
        g.fillStyle = '#3a2a10'; K.roundRect(g, 2, 22, pw - 4, 8, 3); g.fill();
        g.fillStyle = '#ffd24a';
        for (let i = 0; i < 3; ++i) { K.poly(g, [[14 + i * 24, 22], [26 + i * 24, 26], [14 + i * 24, 30], [18 + i * 24, 26]]); g.fill(); }
      }
    });
  }

  function gate() {
    return K.sprite('gate', 150, 290, (g) => {
      g.fillStyle = OUT; g.fillRect(8, 30, 16, 260); g.fillRect(126, 30, 16, 260);
      g.fillStyle = '#e8e8f0'; g.fillRect(11, 32, 10, 258); g.fillRect(129, 32, 10, 258);
      g.fillStyle = OUT; g.fillRect(4, 20, 142, 54);
      for (let y = 0; y < 3; ++y) for (let x = 0; x < 12; ++x) {
        g.fillStyle = (x + y) % 2 ? '#141224' : '#ffffff';
        g.fillRect(7 + x * 11.4, 23 + y * 16, 11.4, 16);
      }
      g.fillStyle = '#ffd24a';
      g.beginPath(); g.arc(75, 14, 12, 0, TAU); g.fill();
    });
  }

  /* ── pickups ── */
  function coin() {
    return K.sprite('coin', 30, 30, (g) => {
      g.fillStyle = '#7a4a0a'; g.beginPath(); g.arc(15, 15, 14, 0, TAU); g.fill();
      const gr = g.createLinearGradient(0, 0, 30, 30);
      gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.5, '#ffd24a'); gr.addColorStop(1, '#e09a1a');
      g.fillStyle = gr; g.beginPath(); g.arc(15, 15, 12, 0, TAU); g.fill();
      g.strokeStyle = '#b8760a'; g.lineWidth = 2; g.beginPath(); g.arc(15, 15, 8, 0, TAU); g.stroke();
      g.fillStyle = '#ffffff'; g.fillRect(9, 7, 4, 7);
    });
  }

  function gem() {
    return K.sprite('gem', 32, 34, (g) => {
      g.fillStyle = OUT; K.poly(g, [[16, 33], [1, 12], [8, 2], [24, 2], [31, 12]]); g.fill();
      g.fillStyle = '#ff6ad5'; K.poly(g, [[16, 30], [4, 12], [9, 4], [23, 4], [28, 12]]); g.fill();
      g.fillStyle = '#ffb0ea'; K.poly(g, [[4, 12], [9, 4], [16, 12]]); g.fill();
      g.fillStyle = '#c03a9a'; K.poly(g, [[16, 30], [16, 12], [28, 12]]); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(10, 6, 5, 3);
    });
  }

  function shard() {
    return K.sprite('shard', 40, 52, (g) => {
      g.fillStyle = OUT; K.poly(g, [[20, 1], [36, 22], [20, 51], [4, 22]]); g.fill();
      g.fillStyle = '#5ee0ff'; K.poly(g, [[20, 4], [33, 22], [20, 48], [7, 22]]); g.fill();
      g.fillStyle = '#d8f8ff'; K.poly(g, [[20, 4], [20, 48], [7, 22]]); g.fill();
      g.fillStyle = '#ffffff'; K.poly(g, [[20, 8], [24, 22], [20, 30], [16, 22]]); g.fill();
    });
  }

  function token(kind) {
    return K.sprite('token:' + kind, 36, 36, (g) => {
      g.translate(18, 18);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.fill();
      if (kind === 'snowflake') {
        g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.lineCap = 'round';
        for (let i = 0; i < 6; ++i) { const a = i * TAU / 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); g.stroke(); }
      } else if (kind === 'blossom') {
        g.fillStyle = '#ffb0d0';
        for (let i = 0; i < 5; ++i) { const a = i * TAU / 5; g.beginPath(); g.arc(Math.cos(a) * 7, Math.sin(a) * 7, 7, 0, TAU); g.fill(); }
        g.fillStyle = '#ffe07a'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
      } else if (kind === 'shell') {
        g.fillStyle = '#ffe0c0';
        g.beginPath(); g.moveTo(0, 12); for (let i = 0; i <= 8; ++i) { const a = Math.PI + i / 8 * Math.PI; g.lineTo(Math.cos(a) * 14, Math.sin(a) * 14 + 4); } g.fill();
        g.strokeStyle = '#c08a6a'; g.lineWidth = 1.5;
        for (let i = 1; i < 8; ++i) { const a = Math.PI + i / 8 * Math.PI; g.beginPath(); g.moveTo(0, 12); g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13 + 4); g.stroke(); }
      } else if (kind === 'acorn') {
        g.fillStyle = '#b06a2a'; g.beginPath(); g.ellipse(0, 3, 9, 11, 0, 0, TAU); g.fill();
        g.fillStyle = '#6a3a1a'; K.roundRect(g, -11, -10, 22, 8, 4); g.fill();
      } else if (kind === 'candy') {
        g.fillStyle = '#ff8a1a'; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
        K.poly(g, [[-9, 0], [-17, -7], [-17, 7]]); g.fill(); K.poly(g, [[9, 0], [17, -7], [17, 7]]); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(-3, -9, 3, 18);
      } else {
        g.fillStyle = '#ffd23a';
        for (let i = 0; i < 8; ++i) { const a = i * TAU / 8; g.fillRect(Math.cos(a) * 9 - 2, Math.sin(a) * 9 - 2, 4, 4); }
        g.fillStyle = '#ff5a8a'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill();
      }
    });
  }

  /* a power-up icon in a 40 x 40 box */
  function icon(id) {
    return K.sprite('picon:' + id, 40, 40, (g) => {
      const c = (POWER_BY_ID[id] || { color: '#ffffff' }).color;
      g.translate(20, 20);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.fillStyle = c; g.strokeStyle = c;
      switch (id) {
        case 'magnet':
          g.lineWidth = 7; g.beginPath(); g.arc(0, -2, 10, Math.PI, 0); g.lineTo(10, 10); g.moveTo(-10, -2); g.lineTo(-10, 10); g.stroke();
          g.fillStyle = '#ffffff'; g.fillRect(-14, 8, 8, 5); g.fillRect(6, 8, 8, 5);
          break;
        case 'shield':
          K.poly(g, [[0, -15], [13, -9], [11, 6], [0, 15], [-11, 6], [-13, -9]]); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)'; K.poly(g, [[0, -11], [0, 11], [-8, 4], [-9, -7]]); g.fill();
          break;
        case 'multi':
          g.font = 'bold 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x2', 0, 1);
          break;
        case 'jetpack':
          K.roundRect(g, -10, -12, 9, 20, 4); g.fill(); K.roundRect(g, 1, -12, 9, 20, 4); g.fill();
          g.fillStyle = '#ffe07a'; K.poly(g, [[-9, 9], [-5, 17], [-2, 9]]); g.fill(); K.poly(g, [[2, 9], [5, 17], [9, 9]]); g.fill();
          break;
        case 'giant':
          g.lineWidth = 4; g.beginPath(); g.moveTo(-12, 12); g.lineTo(12, -12); g.moveTo(2, -12); g.lineTo(12, -12); g.lineTo(12, -2);
          g.moveTo(-12, 2); g.lineTo(-12, 12); g.lineTo(-2, 12); g.stroke();
          break;
        case 'slowmo':
          g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.stroke();
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -9); g.moveTo(0, 0); g.lineTo(6, 4); g.stroke();
          break;
        case 'ghost':
          g.beginPath(); g.arc(0, -3, 11, Math.PI, 0); g.lineTo(11, 13); g.lineTo(5, 9); g.lineTo(0, 13); g.lineTo(-5, 9); g.lineTo(-11, 13); g.closePath(); g.fill();
          g.fillStyle = '#141224'; g.beginPath(); g.arc(-4, -3, 2.5, 0, TAU); g.arc(4, -3, 2.5, 0, TAU); g.fill();
          break;
        case 'rocket':
          K.poly(g, [[14, 0], [4, -7], [-10, -7], [-10, 7], [4, 7]]); g.fill();
          g.fillStyle = '#ffe07a'; K.poly(g, [[-10, -5], [-17, 0], [-10, 5]]); g.fill();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(2, 0, 3, 0, TAU); g.fill();
          break;
        case 'rain':
          for (let i = 0; i < 3; ++i) { g.beginPath(); g.arc(-9 + i * 9, -6 + (i % 2) * 10, 6, 0, TAU); g.fill(); }
          break;
        case 'revive':
          g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-16, 2, -8, -14, 0, -16); g.bezierCurveTo(8, -14, 16, 2, 0, 14); g.fill();
          g.fillStyle = '#ffe07a'; g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-6, 2, -3, -6, 0, -8); g.bezierCurveTo(3, -6, 6, 2, 0, 8); g.fill();
          break;
        case 'spring':
          g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 6; ++i) g.lineTo(i % 2 ? 9 : -9, 10 - i * 4); g.stroke();
          g.fillRect(-12, 10, 24, 4); g.fillRect(-12, -14, 24, 4);
          break;
        case 'lucky':
          K.poly(g, [[0, 14], [-12, 0], [-6, -10], [6, -10], [12, 0]]); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.6)'; K.poly(g, [[-12, 0], [-6, -10], [0, 0]]); g.fill();
          break;
        default:
          g.lineWidth = 3;
          for (let i = 0; i < 3; ++i) { g.beginPath(); g.arc(0, 0, 4 + i * 5, -0.8, 0.8); g.stroke(); g.beginPath(); g.arc(0, 0, 4 + i * 5, Math.PI - 0.8, Math.PI + 0.8); g.stroke(); }
      }
    });
  }

  function orb(id) {
    return K.sprite('orb:' + id, 56, 56, (g) => {
      const c = id === 'spark' ? '#5ee0ff' : (POWER_BY_ID[id] || { color: '#ffffff' }).color;
      const gr = g.createRadialGradient(22, 20, 4, 28, 28, 27);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(0.35, K.rgba(c, 0.55));
      gr.addColorStop(0.85, K.rgba(c, 0.85));
      gr.addColorStop(1, K.rgba(K.shade(c, -0.4), 1));
      g.fillStyle = gr; g.beginPath(); g.arc(28, 28, 26, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(28, 28, 25, 0, TAU); g.stroke();
      if (id !== 'spark') {
        g.fillStyle = 'rgba(20,18,36,0.55)'; g.beginPath(); g.arc(28, 28, 17, 0, TAU); g.fill();
        g.drawImage(icon(id).canvas, 10, 10, 36, 36);
      } else {
        g.strokeStyle = '#ffffff'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(30, 12); g.lineTo(22, 29); g.lineTo(32, 29); g.lineTo(25, 45); g.stroke();
      }
    });
  }

  /* particle shapes, white-on-colour */
  function shape(kind, color) {
    return K.sprite('shape:' + kind + ':' + color, 24, 24, (g) => {
      g.translate(12, 12);
      g.fillStyle = color;
      switch (kind) {
        case 2: g.beginPath(); g.ellipse(0, 0, 10, 5, 0.5, 0, TAU); g.fill(); g.strokeStyle = K.shade(color, -0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, -4); g.lineTo(8, 4); g.stroke(); break;
        case 3: g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, TAU); g.fill(); break;
        case 4: K.poly(g, [[0, -11], [3, -3], [11, 0], [3, 3], [0, 11], [-3, 3], [-11, 0], [-3, -3]]); g.fill(); break;
        case 5: g.strokeStyle = color; g.lineWidth = 2.5; g.lineCap = 'round'; for (let i = 0; i < 3; ++i) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(Math.cos(a) * -10, Math.sin(a) * -10); g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); g.stroke(); } break;
        case 6: g.fillRect(-7, -7, 14, 14); break;
        case 7: K.poly(g, [[0, -2], [-11, -6], [-7, 2], [0, 5], [7, 2], [11, -6]]); g.fill(); break;
        case 8: g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-5, -6, 3, 3); break;
        default: g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill();
      }
    });
  }

  Object.assign(NS.propArt, {
    groundTile, groundEdge, pitFill, platTile, hurdle, block, barTile, wall, spikeTile, saw, drone, rock, roller, proj, pad,
    gate, coin, gem, shard, token, icon, orb, shape
  });
})();
