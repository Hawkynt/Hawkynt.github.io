/* The big treat, painted procedurally once per era, skin and decoration set into a cached
   420 x 460 sprite: plain cookie, chocolate-chip cookie, frosted sprinkle cookie, cupcake,
   layer cake, three-tier wedding cake, cosmic galaxy cake and the bakery planet. Decorations
   (icing, sprinkles, cherry, candles, gold leaf, starlight glaze) are fitted to each era's
   shape. Also the candle-flame and twinkle anchor points the live overlay animates. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const { SKINS } = NS.treatData;

  const W = 420, H = 460, OX = 210, OY = 250;
  const RAINBOW = ['#ff4a7a', '#4ab4ff', '#ffd23a', '#6ae07a', '#ffffff', '#c07aff', '#ff9a3a'];

  /* where decorations sit on each era's shape */
  const GEOM = [
    { type: 'disc', r: 118 }, { type: 'disc', r: 118 }, { type: 'disc', r: 118 },
    { type: 'cup', top: -128 },
    { type: 'side', topY: -48, rx: 122, ry: 32, bottom: 96 },
    { type: 'side', topY: -104, rx: 60, ry: 16, bottom: 122 },
    { type: 'side', topY: -48, rx: 122, ry: 32, bottom: 96 },
    { type: 'sphere', r: 124 },
  ];

  function skin(id) {
    for (let i = 0; i < SKINS.length; ++i) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }

  function palette(sk) {
    return { dough: sk.dough, dark: sk.dark, icing: sk.icing, accent: sk.accent,
      light: K.shade(sk.dough, 0.35), deep: K.shade(sk.dark, -0.35) };
  }

  const blobPath = K.blob;

  function groundShadow(g, y, rx) {
    const gr = g.createRadialGradient(0, y, 4, 0, y, rx);
    gr.addColorStop(0, 'rgba(0,0,0,0.42)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.save();
    g.scale(1, 0.22);
    g.beginPath();
    g.arc(0, y / 0.22, rx, 0, TAU);
    g.fill();
    g.restore();
  }

  /* ---- cookies ---- */
  function cookieBase(g, P, r, rng, toast) {
    groundShadow(g, r + 6, r * 1.1);
    blobPath(g, 0, 0, r, 0.025, 1.7, 56);
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.05);
    gr.addColorStop(0, K.shade(P.dough, 0.16));
    gr.addColorStop(0.5, toast ? K.shade(P.dough, -0.1) : K.shade(P.dough, -0.02));
    gr.addColorStop(0.85, K.mix(P.dough, P.dark, 0.55));
    gr.addColorStop(1, P.dark);
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = K.rgba(P.deep, 0.45);
    g.stroke();
    /* baked rim */
    g.lineWidth = 12;
    g.strokeStyle = K.rgba(P.dark, 0.25);
    blobPath(g, 0, 0, r - 8, 0.025, 1.7, 56);
    g.stroke();
    /* cracks */
    g.lineCap = 'round';
    for (let i = 0; i < 7; ++i) {
      const a = rng.range(0, TAU), d = rng.range(0.25, 0.75) * r, len = rng.range(16, 34);
      const x = Math.cos(a) * d, y = Math.sin(a) * d, b = a + rng.range(-1.2, 1.2);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(b) * len * 0.6 + rng.range(-6, 6), y + Math.sin(b) * len * 0.6, x + Math.cos(b) * len, y + Math.sin(b) * len);
      g.strokeStyle = K.rgba(P.deep, 0.4);
      g.lineWidth = 2.5;
      g.stroke();
      g.strokeStyle = K.rgba(P.light, 0.35);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x + 1.5, y + 1.5);
      g.lineTo(x + Math.cos(b) * len + 1.5, y + Math.sin(b) * len + 1.5);
      g.stroke();
    }
    /* pores and sugar */
    for (let i = 0; i < 70; ++i) {
      const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * r * 0.9;
      K.circle(g, Math.cos(a) * d, Math.sin(a) * d, rng.range(0.8, 2.4), i % 3 ? K.rgba(P.deep, 0.25) : K.rgba('#ffffff', 0.3));
    }
    /* sheen */
    g.save();
    g.globalAlpha = 0.22;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(0, 0, r * 0.78, Math.PI * 1.08, Math.PI * 1.45);
    g.stroke();
    g.restore();
  }

  function chips(g, P, r, rng, n) {
    for (let i = 0; i < n; ++i) {
      const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * r * 0.78;
      const x = Math.cos(a) * d, y = Math.sin(a) * d, s = rng.range(9, 15);
      g.beginPath();
      const k = 6;
      for (let j = 0; j < k; ++j) {
        const b = j / k * TAU + rng.range(-0.3, 0.3), rr = s * rng.range(0.7, 1.1);
        g[j ? 'lineTo' : 'moveTo'](x + Math.cos(b) * rr, y + Math.sin(b) * rr * 0.85);
      }
      g.closePath();
      const gr = g.createLinearGradient(x - s, y - s, x + s, y + s);
      gr.addColorStop(0, K.shade(P.accent, 0.25));
      gr.addColorStop(1, K.shade(P.accent, -0.4));
      g.fillStyle = gr;
      g.fill();
      K.circle(g, x - s * 0.3, y - s * 0.35, s * 0.22, K.rgba('#ffffff', 0.35));
    }
  }

  function plainCookie(g, P, rng) {
    cookieBase(g, P, 118, rng, false);
  }

  function chipCookie(g, P, rng) {
    cookieBase(g, P, 118, rng, true);
    chips(g, P, 118, rng, 13);
  }

  function frostedCookie(g, P, rng) {
    cookieBase(g, P, 118, rng, true);
    chips(g, P, 118, rng, 5);
    /* icing pool with a glossy edge */
    blobPath(g, 0, -4, 90, 0.06, 4.1, 48);
    g.fillStyle = K.shade(P.icing, -0.18);
    g.fill();
    blobPath(g, -2, -8, 86, 0.06, 4.1, 48);
    const gr = g.createRadialGradient(-30, -40, 10, 0, -8, 96);
    gr.addColorStop(0, K.shade(P.icing, 0.5));
    gr.addColorStop(0.6, P.icing);
    gr.addColorStop(1, K.shade(P.icing, -0.12));
    g.fillStyle = gr;
    g.fill();
    g.save();
    g.globalAlpha = 0.55;
    K.ellipse(g, -30, -44, 30, 12, '#ffffff');
    g.restore();
    sprinkleRods(g, rng, 46, (rr) => {
      const a = rr.range(0, TAU), d = Math.sqrt(rr.next()) * 74;
      return [Math.cos(a) * d - 2, Math.sin(a) * d - 8];
    }, 1);
  }

  function sprinkleRods(g, rng, n, place, scale) {
    g.lineCap = 'round';
    for (let i = 0; i < n; ++i) {
      const p = place(rng);
      const a = rng.range(0, TAU), l = 6 * (scale || 1);
      g.strokeStyle = RAINBOW[i % RAINBOW.length];
      g.lineWidth = 3.2 * (scale || 1);
      g.beginPath();
      g.moveTo(p[0] - Math.cos(a) * l / 2, p[1] - Math.sin(a) * l / 2);
      g.lineTo(p[0] + Math.cos(a) * l / 2, p[1] + Math.sin(a) * l / 2);
      g.stroke();
    }
  }

  /* ---- cupcake ---- */
  function cupcake(g, P, rng) {
    groundShadow(g, 128, 120);
    /* wrapper with pleats */
    const top = 18, bot = 126, tw = 112, bw = 84;
    g.beginPath();
    g.moveTo(-tw, top);
    g.lineTo(tw, top);
    g.lineTo(bw, bot);
    g.quadraticCurveTo(0, bot + 10, -bw, bot);
    g.closePath();
    const wr = g.createLinearGradient(-tw, 0, tw, 0);
    wr.addColorStop(0, K.shade(P.accent, -0.35));
    wr.addColorStop(0.35, K.shade(P.accent, 0.15));
    wr.addColorStop(1, K.shade(P.accent, -0.45));
    g.fillStyle = wr;
    g.fill();
    g.save();
    g.clip();
    for (let i = -10; i <= 10; ++i) {
      const x0 = i * tw / 9, x1 = i * bw / 9;
      g.strokeStyle = i % 2 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.18)';
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x0, top);
      g.lineTo(x1, bot + 8);
      g.stroke();
    }
    g.restore();
    /* muffin top */
    K.ellipse(g, 0, top - 2, tw + 12, 26, P.dark);
    K.ellipse(g, 0, top - 6, tw + 8, 22, P.dough);
    /* frosting swirl: three rings and a peak */
    const rings = [[0, -14, 118, 42], [0, -56, 92, 36], [0, -92, 62, 28]];
    for (let i = 0; i < rings.length; ++i) {
      const r = rings[i];
      K.ellipse(g, r[0], r[1] + 6, r[2], r[3], K.shade(P.icing, -0.22));
      K.ellipse(g, r[0], r[1], r[2], r[3]);
      const gr = g.createRadialGradient(r[0] - r[2] * 0.35, r[1] - r[3] * 0.6, 4, r[0], r[1], r[2]);
      gr.addColorStop(0, K.shade(P.icing, 0.55));
      gr.addColorStop(0.6, P.icing);
      gr.addColorStop(1, K.shade(P.icing, -0.15));
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = K.rgba(K.shade(P.icing, -0.3), 0.5);
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(r[0], r[1] + 4, r[2] * 0.82, r[3] * 0.55, 0, 0.15 * Math.PI, 0.95 * Math.PI);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-34, -104);
    g.quadraticCurveTo(-6, -112, 6, -136);
    g.quadraticCurveTo(14, -112, 34, -104);
    g.closePath();
    g.fillStyle = K.shade(P.icing, 0.2);
    g.fill();
    g.save();
    g.globalAlpha = 0.5;
    K.ellipse(g, -40, -30, 26, 9, '#ffffff');
    K.ellipse(g, -26, -70, 18, 7, '#ffffff');
    g.restore();
    if (rng) sprinkleRods(g, rng, 30, (rr) => [rr.range(-95, 95), rr.range(-100, 10)], 0.9);
  }

  /* ---- side-view cakes ---- */
  function cylinder(g, topY, bottom, rx, ry, side, topFill) {
    g.beginPath();
    g.moveTo(-rx, topY);
    g.lineTo(-rx, bottom);
    g.ellipse(0, bottom, rx, ry, 0, Math.PI, 0, true);
    g.lineTo(rx, topY);
    g.closePath();
    g.fillStyle = side;
    g.fill();
    K.ellipse(g, 0, topY, rx, ry, topFill);
  }

  function sideGradient(g, rx, c) {
    const gr = g.createLinearGradient(-rx, 0, rx, 0);
    gr.addColorStop(0, K.shade(c, -0.3));
    gr.addColorStop(0.3, K.shade(c, 0.12));
    gr.addColorStop(0.55, c);
    gr.addColorStop(1, K.shade(c, -0.42));
    return gr;
  }

  function plate(g, y, rx) {
    K.ellipse(g, 0, y + 8, rx, rx * 0.2, 'rgba(0,0,0,0.3)');
    K.ellipse(g, 0, y, rx, rx * 0.19, '#c8ccd8');
    K.ellipse(g, 0, y - 3, rx * 0.9, rx * 0.15, '#eef0f6');
  }

  function layerCake(g, P, rng) {
    const G = GEOM[4];
    plate(g, G.bottom + 14, 160);
    cylinder(g, G.topY, G.bottom, G.rx, G.ry, sideGradient(g, G.rx, P.dough), P.icing);
    /* naked-cake bands: sponge and cream */
    const bands = [[-12, 10], [34, 9], [76, 7]];
    for (let i = 0; i < bands.length; ++i) {
      const y = bands[i][0];
      g.beginPath();
      g.ellipse(0, y, G.rx, G.ry, 0, 0, Math.PI);
      g.lineWidth = bands[i][1];
      g.strokeStyle = sideGradient(g, G.rx, P.icing);
      g.stroke();
    }
    /* scraped texture */
    for (let i = 0; i < 40; ++i) {
      const x = rng.range(-G.rx + 6, G.rx - 6), y = rng.range(G.topY + 12, G.bottom);
      K.circle(g, x, y, rng.range(1, 2.4), K.rgba(P.light, 0.35));
    }
    /* top frosting with piped rosettes */
    const tg = g.createRadialGradient(-30, G.topY - 10, 6, 0, G.topY, G.rx);
    tg.addColorStop(0, K.shade(P.icing, 0.5));
    tg.addColorStop(1, K.shade(P.icing, -0.1));
    K.ellipse(g, 0, G.topY, G.rx, G.ry, tg);
    rosettes(g, P.icing, 0, G.topY, G.rx - 4, G.ry - 2, 18, 9);
    /* berries on top */
    for (let i = 0; i < 5; ++i) {
      const a = Math.PI * (0.15 + i * 0.17);
      berry(g, Math.cos(a + Math.PI) * 50, G.topY + Math.sin(a + Math.PI) * 10 - 2, 9, '#d8203a');
    }
  }

  function rosettes(g, c, cx, cy, rx, ry, n, s) {
    for (let i = 0; i < n; ++i) {
      const a = i / n * TAU;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      K.circle(g, x, y + 2, s, K.shade(c, -0.25));
      K.circle(g, x, y, s, c);
      K.circle(g, x - s * 0.3, y - s * 0.35, s * 0.35, K.rgba('#ffffff', 0.6));
    }
  }

  function berry(g, x, y, r, c) {
    K.circle(g, x, y + 1.5, r, K.shade(c, -0.4));
    K.circle(g, x, y, r, c);
    K.circle(g, x - r * 0.35, y - r * 0.35, r * 0.3, 'rgba(255,255,255,0.6)');
  }

  function weddingCake(g, P) {
    const white = K.mix(P.icing, '#ffffff', 0.25);
    plate(g, 136, 170);
    const tiers = [[40, 122, 128, 30], [-30, 40, 94, 23], [-104, -30, 60, 16]];
    for (let i = 0; i < tiers.length; ++i) {
      const t = tiers[i];
      cylinder(g, t[0], t[1], t[2], t[3], sideGradient(g, t[2], white), K.shade(white, 0.3));
      /* ribbon */
      g.beginPath();
      g.ellipse(0, t[1] - 14, t[2], t[3], 0, 0, Math.PI);
      g.lineWidth = 8;
      g.strokeStyle = sideGradient(g, t[2], P.accent === '#5a3018' ? '#e8a0b8' : P.accent);
      g.stroke();
      /* swags */
      g.lineWidth = 2.5;
      g.strokeStyle = K.rgba(K.shade(white, -0.3), 0.8);
      const n = 6;
      for (let k = 0; k < n; ++k) {
        const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n;
        const x0 = Math.cos(a0) * t[2], x1 = Math.cos(a1) * t[2];
        const y0 = t[0] + Math.sin(a0) * t[3] + 4, y1 = t[0] + Math.sin(a1) * t[3] + 4;
        g.beginPath();
        g.moveTo(x0, y0);
        g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 16, x1, y1);
        g.stroke();
      }
      /* pearl border */
      for (let k = 0; k <= 16; ++k) {
        const a = Math.PI * k / 16;
        K.circle(g, Math.cos(a) * t[2], t[1] + Math.sin(a) * t[3] - 1, 3.6, '#fffaf0');
        K.circle(g, Math.cos(a) * t[2] - 1, t[1] + Math.sin(a) * t[3] - 2, 1.4, '#ffffff');
      }
    }
    /* topper: two hearts on a wire */
    g.strokeStyle = '#c8a040';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -104);
    g.lineTo(0, -176);
    g.stroke();
    heart(g, -12, -186, 13, '#e83a5a');
    heart(g, 12, -182, 11, '#ffd25a');
  }

  function heart(g, x, y, s, c) {
    g.beginPath();
    g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
    g.fillStyle = c;
    g.fill();
    K.circle(g, x - s * 0.45, y - s * 0.35, s * 0.2, 'rgba(255,255,255,0.6)');
  }

  function cosmicCake(g, P, rng) {
    const G = GEOM[6];
    /* aura */
    const au = g.createRadialGradient(0, 20, 30, 0, 20, 205);
    au.addColorStop(0, 'rgba(160,110,255,0.45)');
    au.addColorStop(1, 'rgba(160,110,255,0)');
    g.fillStyle = au;
    g.fillRect(-210, -230, 420, 460);
    ringHalf(g, false, P);
    const space = K.mix(P.dark, '#160a3a', 0.75);
    cylinder(g, G.topY, G.bottom, G.rx, G.ry, sideGradient(g, G.rx, K.mix(space, '#3a2a8a', 0.4)), space);
    /* nebula and stars on the glaze */
    g.save();
    g.beginPath();
    g.moveTo(-G.rx, G.topY);
    g.lineTo(-G.rx, G.bottom);
    g.ellipse(0, G.bottom, G.rx, G.ry, 0, Math.PI, 0, true);
    g.lineTo(G.rx, G.topY);
    g.ellipse(0, G.topY, G.rx, G.ry, 0, 0, Math.PI, true);
    g.closePath();
    g.clip();
    const neb = ['#ff5ab4', '#5ad8ff', '#a05aff', '#ffd25a'];
    for (let i = 0; i < 9; ++i) {
      const x = rng.range(-110, 110), y = rng.range(G.topY - 30, G.bottom), r = rng.range(30, 70);
      const ng = g.createRadialGradient(x, y, 0, x, y, r);
      ng.addColorStop(0, K.rgba(neb[i % 4], 0.35));
      ng.addColorStop(1, K.rgba(neb[i % 4], 0));
      g.fillStyle = ng;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 90; ++i) K.circle(g, rng.range(-125, 125), rng.range(G.topY - 35, G.bottom + 30), rng.range(0.5, 1.8), K.rgba('#ffffff', rng.range(0.4, 1)));
    g.restore();
    /* a starry top under a thin glossy glaze */
    g.save();
    K.ellipse(g, 0, G.topY, G.rx, G.ry);
    g.clip();
    const tg = g.createRadialGradient(-30, G.topY - 6, 4, 0, G.topY, G.rx);
    tg.addColorStop(0, '#5a3aa8');
    tg.addColorStop(1, space);
    g.fillStyle = tg;
    g.fillRect(-G.rx, G.topY - G.ry, G.rx * 2, G.ry * 2);
    for (let i = 0; i < 40; ++i) K.circle(g, rng.range(-G.rx, G.rx), G.topY + rng.range(-G.ry, G.ry), rng.range(0.5, 1.6), K.rgba('#ffffff', rng.range(0.5, 1)));
    g.restore();
    glazeDrips(g, '#b08aff', G, rng, 0.22);
    ringHalf(g, true, P);
  }

  function glazeDrips(g, c, G, rng, topAlpha) {
    g.beginPath();
    g.ellipse(0, G.topY, G.rx, G.ry, 0, 0, TAU);
    g.fillStyle = K.rgba(c, topAlpha == null ? 0.55 : topAlpha);
    g.fill();
    g.fillStyle = K.rgba(c, 0.75);
    for (let i = 0; i < 14; ++i) {
      const a = Math.PI * (i + 0.5) / 14;
      const x = Math.cos(a) * G.rx, y = G.topY + Math.sin(a) * G.ry;
      const len = rng.range(12, 46), w = rng.range(5, 9);
      g.beginPath();
      g.moveTo(x - w, y - 2);
      g.lineTo(x - w * 0.8, y + len);
      g.arc(x, y + len, w * 0.8, Math.PI, 0, true);
      g.lineTo(x + w, y - 2);
      g.closePath();
      g.fill();
    }
    g.save();
    g.globalAlpha = 0.45;
    K.ellipse(g, -G.rx * 0.33, G.topY - G.ry * 0.25, G.rx * 0.33, G.ry * 0.25, '#ffffff');
    g.restore();
  }

  /* the cosmic cake's tilted ring, back half or front half */
  function ringHalf(g, front, P) {
    g.save();
    g.rotate(-0.18);
    g.lineWidth = 9;
    g.strokeStyle = K.rgba(front ? '#ffe0a0' : '#c8a060', front ? 0.85 : 0.5);
    g.beginPath();
    g.ellipse(0, 26, 190, 40, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = K.rgba(P.icing, front ? 0.7 : 0.35);
    g.beginPath();
    g.ellipse(0, 26, 172, 34, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    g.stroke();
    g.restore();
  }

  /* the bakery planet lives in planet-art.js */
  function planet(g, P, rng) {
    NS.planetArt.paint(g, P, rng, GEOM[7].r);
  }

  const PAINTERS = [plainCookie, chipCookie, frostedCookie, cupcake, layerCake, weddingCake, cosmicCake, planet];

  /* ---- decorations ---- */
  function surfacePoint(geo, rng) {
    if (geo.type === 'disc' || geo.type === 'sphere') {
      const a = rng.range(0, TAU), d = Math.sqrt(rng.next()) * geo.r * 0.8;
      return [Math.cos(a) * d, Math.sin(a) * d];
    }
    if (geo.type === 'cup') return [rng.range(-90, 90), rng.range(-95, 5)];
    const a = rng.range(0, TAU), d = Math.sqrt(rng.next());
    return [Math.cos(a) * geo.rx * 0.85 * d, geo.topY + Math.sin(a) * geo.ry * 0.85 * d];
  }

  function topPoint(geo) {
    if (geo.type === 'disc') return [0, -6];
    if (geo.type === 'cup') return [6, -140];
    if (geo.type === 'sphere') return [0, -geo.r - 66];
    return [0, geo.topY - 6];
  }

  /* candle bases: three on cakes and cookies, one on the cupcake */
  function candleSpots(stage) {
    const geo = GEOM[stage];
    if (geo.type === 'disc') return [[-48, 8], [0, -26], [48, 8]];
    if (geo.type === 'cup') return [[-34, -96]];
    if (geo.type === 'sphere') return [[-40, -geo.r - 6], [40, -geo.r - 6]];
    return [[-geo.rx * 0.55, geo.topY - 2], [geo.rx * 0.05, geo.topY - geo.ry * 0.4], [geo.rx * 0.55, geo.topY + 2]];
  }

  function icing(g, stage, P, rng) {
    const geo = GEOM[stage];
    const c = stage === 3 ? K.shade(P.accent === '#5a3018' ? '#5a3018' : P.dark, -0.1) : K.mix(P.icing, '#ffffff', 0.3);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (stage === 3) {
      /* chocolate drizzle following each frosting ring */
      const rings = [[0, -14, 118, 42], [0, -56, 92, 36], [0, -92, 62, 28]];
      for (let i = 0; i < rings.length; ++i) {
        const r = rings[i];
        g.beginPath();
        for (let k = 0; k <= 24; ++k) {
          const a = Math.PI * (0.08 + 0.84 * k / 24);
          const wob = Math.sin(k * 1.7 + i) * 5;
          g[k ? 'lineTo' : 'moveTo'](r[0] + Math.cos(a) * r[2] * 0.92, r[1] + Math.sin(a) * r[3] * 0.7 + wob);
        }
        g.strokeStyle = K.shade(c, -0.25);
        g.lineWidth = 7;
        g.stroke();
        g.strokeStyle = c;
        g.lineWidth = 5;
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.4)';
        g.lineWidth = 1.4;
        g.stroke();
      }
      return;
    }
    if (geo.type === 'disc') {
      const r = 100, y0 = -70;
      g.beginPath();
      for (let i = 0; i < 9; ++i) {
        const y = y0 + i * 18;
        const w = Math.sqrt(Math.max(0, r * r - y * y)) * 0.9;
        g[i ? 'lineTo' : 'moveTo'](i % 2 ? w : -w, y);
      }
      g.strokeStyle = K.shade(c, -0.2);
      g.lineWidth = 8;
      g.stroke();
      g.strokeStyle = c;
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1.6;
      g.stroke();
      return;
    }
    if (geo.type === 'sphere') {
      /* a whipped-cream storm band around the equator */
      g.save();
      K.circle(g, 0, 0, geo.r);
      g.clip();
      g.fillStyle = K.rgba(K.mix(P.icing, '#ffffff', 0.6), 0.4);
      for (let i = 0; i < 9; ++i) {
        g.beginPath();
        g.ellipse(-geo.r + i * geo.r / 4, 8 + Math.sin(i * 1.3) * 10, geo.r / 4, 6, 0.12, 0, TAU);
        g.fill();
      }
      g.restore();
      return;
    }
    glazeDrips(g, c, geo, rng);
  }

  function sprinkles(g, stage, rng) {
    const geo = GEOM[stage];
    if (geo.type === 'sphere') {
      /* on the planet: a sprinkle-coloured aurora over the pole */
      for (let i = 0; i < 5; ++i) {
        g.strokeStyle = K.rgba(RAINBOW[i], 0.35);
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(0, -geo.r * 0.62 + i * 4, geo.r * (0.62 - i * 0.04), 12, 0, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
      return;
    }
    sprinkleRods(g, rng, 42, rr => surfacePoint(geo, rr), 1);
    for (let i = 0; i < 24; ++i) {
      const p = surfacePoint(geo, rng);
      K.circle(g, p[0], p[1], 2.6, RAINBOW[(i + 3) % RAINBOW.length]);
    }
  }

  function cherry(g, stage) {
    const p = topPoint(GEOM[stage]);
    g.strokeStyle = '#4a7a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(p[0], p[1] - 10);
    g.quadraticCurveTo(p[0] + 4, p[1] - 30, p[0] + 16, p[1] - 34);
    g.stroke();
    K.ellipse(g, p[0] + 18, p[1] - 34, 7, 3.5, '#6aa03a');
    berry(g, p[0], p[1], 15, '#d8102a');
  }

  function candles(g, stage) {
    const spots = candleSpots(stage);
    const cols = ['#ff7aa8', '#7ac8ff', '#ffe07a'];
    for (let i = 0; i < spots.length; ++i) {
      const x = spots[i][0], y = spots[i][1];
      g.fillStyle = cols[i % 3];
      g.fillRect(x - 5, y - 46, 10, 46);
      g.save();
      g.beginPath();
      g.rect(x - 5, y - 46, 10, 46);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 3;
      for (let k = -2; k < 6; ++k) {
        g.beginPath();
        g.moveTo(x - 6, y - k * 10);
        g.lineTo(x + 6, y - k * 10 - 8);
        g.stroke();
      }
      g.restore();
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(x + 2, y - 46, 3, 46);
      g.strokeStyle = '#3a2a1a';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y - 46);
      g.lineTo(x, y - 52);
      g.stroke();
    }
  }

  function goldLeaf(g, stage, rng) {
    const geo = GEOM[stage];
    if (geo.type === 'sphere') {
      /* gilded cookie ring: gold glints along its front */
      g.save();
      g.rotate(-0.22);
      for (let i = 0; i < 14; ++i) {
        const a = 0.15 + i / 14 * (Math.PI - 0.3);
        K.star(g, Math.cos(a) * 188, Math.sin(a) * 40 + 4, 5, 0.3, 4);
        g.fillStyle = '#ffe9a0';
        g.fill();
      }
      g.restore();
      return;
    }
    for (let i = 0; i < 11; ++i) {
      const p = surfacePoint(geo, rng);
      const s = rng.range(6, 12);
      g.beginPath();
      for (let k = 0; k < 6; ++k) {
        const a = k / 6 * TAU + rng.range(-0.4, 0.4), rr = s * rng.range(0.5, 1.2);
        g[k ? 'lineTo' : 'moveTo'](p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr);
      }
      g.closePath();
      const gr = g.createLinearGradient(p[0] - s, p[1] - s, p[0] + s, p[1] + s);
      gr.addColorStop(0, '#fff6b0');
      gr.addColorStop(0.5, '#f0c040');
      gr.addColorStop(1, '#a87818');
      g.fillStyle = gr;
      g.fill();
    }
  }

  function starGlaze(g, stage) {
    const geo = GEOM[stage];
    const r = geo.r || geo.rx || 110;
    const y = geo.type === 'side' ? geo.topY + 40 : geo.type === 'cup' ? -50 : 0;
    const gr = g.createLinearGradient(-r, y - r, r, y + r);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.42, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    gr.addColorStop(0.58, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = gr;
    g.fillRect(-210, -250, 420, 460);
    g.fillStyle = 'rgba(180,140,255,0.12)';
    g.fillRect(-210, -250, 420, 460);
    g.restore();
  }

  /* points the live overlay twinkles on (starlight glaze) */
  function twinkles(stage) {
    const rng = NS.rng.create('twinkle' + stage);
    const out = [];
    for (let i = 0; i < 9; ++i) out.push(surfacePoint(GEOM[stage], rng));
    return out;
  }

  function flames(stage) {
    return candleSpots(stage).map(p => [p[0], p[1] - 58]);
  }

  function sprite(stage, skinId, decoMask) {
    stage = Math.max(0, Math.min(PAINTERS.length - 1, stage | 0));
    const sk = skin(skinId);
    return K.sprite('treat:' + stage + ':' + sk.id + ':' + decoMask, W, H, (g) => {
      const P = palette(sk);
      const rng = NS.rng.create('treat-' + stage);
      g.translate(OX, OY);
      g.lineCap = 'round';
      PAINTERS[stage](g, P, rng);
      const drng = NS.rng.create('deco-' + stage);
      if (decoMask & 1) icing(g, stage, P, drng);
      if (decoMask & 2) sprinkles(g, stage, drng);
      if (decoMask & 16) goldLeaf(g, stage, drng);
      if (decoMask & 8) candles(g, stage);
      if (decoMask & 4) cherry(g, stage);
      if (decoMask & 32) starGlaze(g, stage);
    });
  }

  function glowColor(stage) {
    return ['#ffb45a', '#ffa040', '#ff9ac8', '#ffc0e0', '#ffe0a0', '#fff4e0', '#b48aff', '#8ad0ff'][stage] || '#ffb45a';
  }

  Object.assign(NS.treatArt, { W, H, OX, OY, GEOM, skin, sprite, flames, twinkles, glowColor, heart, PAINTERS });
})();
