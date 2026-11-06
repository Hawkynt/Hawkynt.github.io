/* The worlds' scenery, painted once into seamless horizontal strips: for each world a far
   layer (mountains, mesas, peaks, a skyline, floating isles), a middle layer (hills and a
   windmill, canyon walls, pine forest, neon towers, crystal spires) and a near layer (trees,
   cacti, ice spires, rooftops, broken pillars), each with rim light and haze; plus the star
   field, the aurora and the haze bands. Strips are 1024 wide and repeat without a seam. Paints
   only; the sprite cache owns the canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const K = NS.artKit;
  const { WORLDS } = NS.worlds;
  const { TAU } = NS.constants;

  const TW = 1024;
  const cache = Object.create(null);

  /* big strips are painted at 1x: they are soft scenery and would be huge at 2x */
  function strip(key, h, paint) {
    let s = cache[key];
    if (s) return s;
    const c = K.makeCanvas(TW, h);
    const g = c.getContext('2d');
    paint(g, TW, h);
    s = cache[key] = { canvas: c, w: TW, h: h };
    return s;
  }

  /* a periodic ridge line: sum of sines with whole-number frequencies over the strip width */
  function ridge(x, seed, amps) {
    let y = 0;
    for (let i = 0; i < amps.length; ++i) {
      const f = i + 1 + (i > 1 ? i : 0);
      y += Math.sin(x / TW * TAU * f + seed * (i + 1) * 1.7) * amps[i];
    }
    return y;
  }

  function silhouette(g, w, h, base, seed, amps, fill, rim, jag) {
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      let y = base + ridge(x, seed, amps);
      if (jag) y += Math.abs(((x * 0.37 + seed * 31) % 38) - 19) * jag;
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    if (rim) {
      g.strokeStyle = rim;
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= w; x += 4) {
        let y = base + ridge(x, seed, amps);
        if (jag) y += Math.abs(((x * 0.37 + seed * 31) % 38) - 19) * jag;
        if (x === 0) g.moveTo(x, y + 1); else g.lineTo(x, y + 1);
      }
      g.stroke();
    }
  }

  /* fade the bottom of a layer into haze so layers separate in depth */
  function haze(g, w, h, color, from) {
    const gr = g.createLinearGradient(0, h * from, 0, h);
    gr.addColorStop(0, K.rgba(color, 0));
    gr.addColorStop(1, K.rgba(color, 0.55));
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  /* draws f at x and its wrapped copies so features crossing the seam tile */
  function wrapDraw(x, span, f) {
    f(x);
    if (x - span < 0) f(x + TW);
    if (x + span > TW) f(x - TW);
  }

  function rng(seed) {
    return NS.rng.makeRng(seed);
  }

  /* ── features ── */
  function tree(g, x, y, s, dark, light) {
    g.fillStyle = K.shade(dark, -0.35);
    g.fillRect(x - 4 * s, y - 30 * s, 8 * s, 30 * s);
    const blobs = [[0, -62, 30], [-22, -46, 22], [22, -44, 22], [0, -38, 24]];
    for (let i = 0; i < blobs.length; ++i) {
      g.fillStyle = dark;
      g.beginPath(); g.arc(x + blobs[i][0] * s, y + blobs[i][1] * s, blobs[i][2] * s, 0, TAU); g.fill();
    }
    g.fillStyle = light;
    g.beginPath(); g.arc(x - 8 * s, y - 70 * s, 14 * s, 0, TAU); g.fill();
    g.beginPath(); g.arc(x - 26 * s, y - 50 * s, 8 * s, 0, TAU); g.fill();
  }

  function pine(g, x, y, s, dark, snow) {
    g.fillStyle = K.shade(dark, -0.4);
    g.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
    for (let i = 0; i < 4; ++i) {
      const ty = y - 10 * s - i * 20 * s, tw = (30 - i * 6) * s;
      g.fillStyle = dark;
      K.poly(g, [[x - tw, ty], [x + tw, ty], [x, ty - 30 * s]]);
      g.fill();
      if (snow) {
        g.fillStyle = snow;
        K.poly(g, [[x - tw * 0.55, ty - 12 * s], [x + tw * 0.2, ty - 14 * s], [x, ty - 30 * s]]);
        g.fill();
      }
    }
  }

  function cactus(g, x, y, s, c, hi) {
    g.fillStyle = c;
    K.roundRect(g, x - 8 * s, y - 80 * s, 16 * s, 80 * s, 8 * s); g.fill();
    K.roundRect(g, x - 26 * s, y - 56 * s, 10 * s, 30 * s, 5 * s); g.fill();
    K.roundRect(g, x - 26 * s, y - 32 * s, 20 * s, 9 * s, 4 * s); g.fill();
    K.roundRect(g, x + 16 * s, y - 66 * s, 10 * s, 28 * s, 5 * s); g.fill();
    K.roundRect(g, x + 6 * s, y - 44 * s, 20 * s, 9 * s, 4 * s); g.fill();
    g.fillStyle = hi;
    g.fillRect(x - 5 * s, y - 76 * s, 3 * s, 70 * s);
  }

  function building(g, x, y, w, h, body, lit, r, sign) {
    g.fillStyle = body;
    g.fillRect(x, y - h, w, h);
    g.fillStyle = K.shade(body, 0.12);
    g.fillRect(x, y - h, 3, h);
    for (let wy = y - h + 10; wy < y - 8; wy += 14)
      for (let wx = x + 6; wx < x + w - 8; wx += 12)
        if (r() < 0.38) {
          g.fillStyle = r() < 0.8 ? lit : K.shade(lit, -0.4);
          g.fillRect(wx, wy, 6, 8);
        }
    if (sign) {
      g.fillStyle = sign;
      g.fillRect(x + w * 0.2, y - h + 14, w * 0.6, 6);
      g.fillStyle = K.rgba(sign, 0.25);
      g.fillRect(x + w * 0.2 - 4, y - h + 10, w * 0.6 + 8, 14);
    }
    if (r() < 0.5) {
      g.fillStyle = body;
      g.fillRect(x + w / 2 - 1, y - h - 22, 2, 22);
      g.fillStyle = '#ff4a5a';
      g.fillRect(x + w / 2 - 2, y - h - 24, 4, 4);
    }
  }

  function crystal(g, x, y, s, c, hi) {
    g.fillStyle = c;
    K.poly(g, [[x - 12 * s, y], [x - 8 * s, y - 60 * s], [x, y - 90 * s], [x + 9 * s, y - 56 * s], [x + 13 * s, y]]);
    g.fill();
    g.fillStyle = hi;
    K.poly(g, [[x - 8 * s, y - 60 * s], [x, y - 90 * s], [x - 1 * s, y - 20 * s]]);
    g.fill();
  }

  /* ── layers per world ── */
  const FAR = [
    (g, w, h, W) => {
      silhouette(g, w, h, 150, 1, [40, 22, 10], W.far, W.farHi);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (let x = 0; x < w; x += 2) {
        const y = 150 + ridge(x, 1, [40, 22, 10]);
        if (y < 118) g.fillRect(x, y, 2, (118 - y) * 0.45 * (0.6 + 0.4 * Math.sin(x * 0.21)) + 1);
      }
      silhouette(g, w, h, 205, 4, [24, 14, 8], K.shade(W.far, -0.08), null);
      haze(g, w, h, W.sky[2], 0.3);
    },
    (g, w, h, W) => {
      const r = rng(11);
      g.fillStyle = W.far;
      for (let i = 0; i < 7; ++i) {
        const x = i * 150 + r() * 60, mw = 90 + r() * 90, mh = 70 + r() * 90;
        wrapDraw(x, mw, (xx) => {
          K.poly(g, [[xx - mw / 2 - 18, h], [xx - mw / 2, h - mh], [xx + mw / 2, h - mh], [xx + mw / 2 + 18, h]]);
          g.fillStyle = W.far; g.fill();
          g.fillStyle = W.farHi; g.fillRect(xx - mw / 2, h - mh, mw, 4);
          g.fillStyle = K.rgba(W.farHi, 0.35);
          for (let sy = h - mh + 14; sy < h; sy += 16) g.fillRect(xx - mw / 2 - (sy - h + mh) * 0.15, sy, mw + (sy - h + mh) * 0.3, 3);
        });
      }
      haze(g, w, h, W.sky[2], 0.2);
    },
    (g, w, h, W) => {
      silhouette(g, w, h, 130, 7, [36, 26, 12], W.far, null, 2.2);
      g.globalCompositeOperation = 'source-atop';
      const gr = g.createLinearGradient(0, 40, 0, 220);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.45, W.farHi);
      gr.addColorStop(1, W.far);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = K.rgba(W.mid, 0.35);
      for (let x = 0; x < w; x += 46) K.poly(g, [[x, h], [x + 23, 120 + (x % 70)], [x + 46, h]]), g.fill();
      g.globalCompositeOperation = 'source-over';
      haze(g, w, h, W.sky[2], 0.35);
    },
    (g, w, h, W) => {
      const r = rng(23);
      for (let x = 0; x < w; ) {
        const bw = 30 + r() * 50, bh = 80 + r() * 170;
        building(g, x, h, bw, bh, W.far, K.rgba(W.farHi, 0.8), r, null);
        x += bw + r() * 6;
      }
      haze(g, w, h, W.sky[2], 0.1);
    },
    (g, w, h, W) => {
      const r = rng(37);
      for (let i = 0; i < 6; ++i) {
        const x = i * 170 + r() * 70, y = 60 + r() * 140, iw = 70 + r() * 80;
        wrapDraw(x, iw, (xx) => {
          g.fillStyle = W.far;
          K.poly(g, [[xx - iw / 2, y], [xx + iw / 2, y], [xx + iw * 0.2, y + 50], [xx, y + 80], [xx - iw * 0.25, y + 46]]);
          g.fill();
          g.fillStyle = W.farHi;
          g.fillRect(xx - iw / 2, y - 3, iw, 4);
          g.strokeStyle = K.rgba(W.farHi, 0.4);
          g.lineWidth = 1;
          for (let k = 0; k < 4; ++k) { g.beginPath(); g.moveTo(xx - iw * 0.2 + k * 10, y + 40); g.lineTo(xx - iw * 0.2 + k * 10 + 4, y + 90 + k * 8); g.stroke(); }
        });
      }
      silhouette(g, w, h, 250, 3, [20, 12, 6], K.shade(W.far, -0.2), W.farHi);
      haze(g, w, h, W.sky[2], 0.4);
    },
  ];

  const MID = [
    (g, w, h, W) => {
      silhouette(g, w, h, 150, 2, [30, 16, 8], W.mid, W.midHi);
      const r = rng(5);
      for (let i = 0; i < 26; ++i) {
        const x = r() * w;
        const y = 150 + ridge(x, 2, [30, 16, 8]);
        wrapDraw(x, 30, (xx) => tree(g, xx, y + 6, 0.35 + r() * 0.15, K.shade(W.mid, -0.15), W.midHi));
      }
      /* a windmill */
      const mx = 700, my = 150 + ridge(700, 2, [30, 16, 8]);
      g.fillStyle = '#e8e0d0';
      K.poly(g, [[mx - 12, my + 4], [mx - 7, my - 70], [mx + 7, my - 70], [mx + 12, my + 4]]); g.fill();
      g.fillStyle = '#a04a3a';
      K.poly(g, [[mx - 10, my - 70], [mx, my - 84], [mx + 10, my - 70]]); g.fill();
      haze(g, w, h, W.sky[2], 0.5);
    },
    (g, w, h, W) => {
      silhouette(g, w, h, 110, 5, [34, 20, 14], W.mid, W.midHi, 0.6);
      g.globalCompositeOperation = 'source-atop';
      for (let y = 100; y < h; y += 18) {
        g.fillStyle = K.rgba(y % 36 ? W.midHi : '#000000', y % 36 ? 0.22 : 0.12);
        g.fillRect(0, y, w, 7);
      }
      g.globalCompositeOperation = 'source-over';
      /* a natural arch */
      g.fillStyle = W.mid;
      g.beginPath(); g.arc(380, 150, 70, Math.PI, 0); g.lineTo(450, h); g.lineTo(430, h); g.arc(380, 150, 50, 0, Math.PI, true); g.lineTo(310, h); g.closePath(); g.fill();
      haze(g, w, h, W.sky[2], 0.45);
    },
    (g, w, h, W) => {
      silhouette(g, w, h, 190, 6, [18, 10, 6], W.mid, null);
      const r = rng(9);
      for (let i = 0; i < 46; ++i) {
        const x = r() * w;
        const y = 190 + ridge(x, 6, [18, 10, 6]) + 10;
        wrapDraw(x, 30, (xx) => pine(g, xx, y, 0.6 + r() * 0.4, K.shade(W.mid, -0.1), '#f0f8ff'));
      }
      haze(g, w, h, W.sky[2], 0.5);
    },
    (g, w, h, W) => {
      const r = rng(41);
      const signs = ['#ff4ab8', '#38e0ff', '#ffd24a', '#7cff9a'];
      for (let x = 0; x < w; ) {
        const bw = 50 + r() * 70, bh = 100 + r() * 150;
        building(g, x, h, bw, bh, W.mid, '#ffe8a0', r, r() < 0.5 ? signs[(r() * signs.length) | 0] : null);
        x += bw + 4 + r() * 18;
      }
      haze(g, w, h, W.sky[1], 0.4);
    },
    (g, w, h, W) => {
      silhouette(g, w, h, 210, 8, [20, 12, 8], W.mid, W.midHi);
      const r = rng(17);
      for (let i = 0; i < 18; ++i) {
        const x = r() * w;
        const y = 210 + ridge(x, 8, [20, 12, 8]) + 8;
        wrapDraw(x, 30, (xx) => crystal(g, xx, y, 0.6 + r() * 0.9, K.shade(W.mid, 0.08), K.rgba(W.midHi, 0.7)));
      }
      haze(g, w, h, W.sky[2], 0.45);
    },
  ];

  const NEAR = [
    (g, w, h, W) => {
      silhouette(g, w, h, 230, 3, [14, 8, 4], W.near, W.nearHi);
      const r = rng(3);
      for (let i = 0; i < 9; ++i) {
        const x = i * 115 + r() * 50;
        wrapDraw(x, 70, (xx) => tree(g, xx, 236 + ridge(xx, 3, [14, 8, 4]), 1.1 + r() * 0.5, W.near, W.nearHi));
      }
    },
    (g, w, h, W) => {
      silhouette(g, w, h, 240, 9, [16, 8, 4], W.near, W.nearHi);
      const r = rng(13);
      for (let i = 0; i < 7; ++i) {
        const x = i * 150 + r() * 60;
        wrapDraw(x, 40, (xx) => cactus(g, xx, 246 + ridge(xx, 9, [16, 8, 4]), 1 + r() * 0.6, W.near, W.nearHi));
      }
    },
    (g, w, h, W) => {
      silhouette(g, w, h, 240, 4, [12, 8, 4], W.near, '#ffffff');
      const r = rng(19);
      for (let i = 0; i < 10; ++i) {
        const x = i * 104 + r() * 40;
        wrapDraw(x, 40, (xx) => {
          if (i % 3 === 0) crystal(g, xx, 250, 1.4, '#bfe0f8', 'rgba(255,255,255,0.8)');
          else pine(g, xx, 250 + ridge(xx, 4, [12, 8, 4]), 1.5 + r() * 0.4, W.near, '#ffffff');
        });
      }
    },
    (g, w, h, W) => {
      const r = rng(53);
      for (let x = 0; x < w; ) {
        const bw = 90 + r() * 120, bh = 30 + r() * 60;
        g.fillStyle = W.near;
        g.fillRect(x, h - bh, bw, bh);
        g.fillStyle = K.rgba(W.nearHi, 0.6);
        g.fillRect(x, h - bh, bw, 2);
        if (r() < 0.45) {
          g.fillStyle = W.near;
          g.fillRect(x + bw * 0.3, h - bh - 50, 26, 50);
          g.beginPath(); g.arc(x + bw * 0.3 + 13, h - bh - 50, 18, Math.PI, 0); g.fill();
        }
        if (r() < 0.5) {
          const c = r() < 0.5 ? '#ff4ab8' : '#38e0ff';
          g.fillStyle = W.near;
          g.fillRect(x + bw * 0.6, h - bh - 70, 4, 70);
          g.fillStyle = K.rgba(c, 0.25);
          g.fillRect(x + bw * 0.6 - 30, h - bh - 92, 70, 34);
          g.strokeStyle = c;
          g.lineWidth = 2;
          g.strokeRect(x + bw * 0.6 - 26, h - bh - 88, 62, 26);
        }
        x += bw + 10 + r() * 40;
      }
    },
    (g, w, h, W) => {
      const r = rng(29);
      silhouette(g, w, h, 250, 10, [10, 6, 3], W.near, null);
      for (let i = 0; i < 8; ++i) {
        const x = i * 130 + r() * 50, ph = 70 + r() * 110;
        wrapDraw(x, 40, (xx) => {
          g.fillStyle = W.near;
          g.fillRect(xx - 14, 256 - ph, 28, ph);
          g.fillRect(xx - 20, 256 - ph, 40, 10);
          g.fillStyle = K.rgba(W.nearHi, 0.75);
          g.fillRect(xx - 3, 256 - ph * 0.7, 6, 6);
          g.fillRect(xx - 3, 256 - ph * 0.45, 6, 6);
          if (i % 2) {
            g.strokeStyle = W.near;
            g.lineWidth = 10;
            g.beginPath(); g.arc(xx + 50, 256 - ph, 50, Math.PI, Math.PI * 1.6); g.stroke();
          }
        });
      }
    },
  ];

  const HEIGHTS = { far: 300, mid: 270, near: 300 };

  function layer(name, w) {
    const W = WORLDS[w];
    const list = name === 'far' ? FAR : name === 'mid' ? MID : NEAR;
    return strip(name + ':' + w, HEIGHTS[name], (g, sw, sh) => list[w](g, sw, sh, W));
  }

  /* a tiling star field for night skies */
  function stars(w) {
    return strip('stars:' + w, 400, (g, sw, sh) => {
      const r = rng(77 + w);
      for (let i = 0; i < 220; ++i) {
        const a = 0.3 + r() * 0.7, s = r() < 0.08 ? 2 : 1;
        g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
        g.fillRect(r() * sw, r() * sh, s, s);
      }
    });
  }

  /* the aurora ribbon of Frostpeak and the rift's tear: soft bands, drawn additively */
  function aurora(w) {
    return strip('aurora:' + w, 200, (g, sw, sh) => {
      const cols = w === 4 ? ['#c08cff', '#ff6ad5'] : ['#7cffc8', '#5ee0ff'];
      for (let b = 0; b < 2; ++b)
        for (let x = 0; x < sw; x += 3) {
          const y = 90 + ridge(x, 5 + b * 3, [30, 18, 8]);
          const gr = g.createLinearGradient(0, y - 60, 0, y + 20);
          gr.addColorStop(0, K.rgba(cols[b], 0));
          gr.addColorStop(0.7, K.rgba(cols[b], 0.22));
          gr.addColorStop(1, K.rgba(cols[b], 0));
          g.fillStyle = gr;
          g.fillRect(x, y - 60, 3, 80);
        }
    });
  }

  Object.assign(NS.backdropArt, {
    TW, HEIGHTS, layer, stars, aurora, ridge
  });
})();
