/* The final era's art: the bakery planet, painted once into the treat sprite - a chocolate
   ocean world with cake continents, crumb mountains under frosting caps, caramel rivers,
   cupcake forests and little towns, whipped-cream weather, city lights on the night side, an
   atmosphere rim, the cake-tower capital at the pole, a cookie ring and a sugar-dust ring. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { TAU } = NS.constants;
  const K = NS.artKit;

  /* ---- bakery planet ---- */
  /* a chocolate ocean world: cake continents with crumb mountains, frosting snowcaps and
     caramel rivers, cupcake forests, towns of tiny bakeries, glowing city lights on the night
     side, whipped-cream weather, a cake-tower capital at the pole, a cookie ring and a ring of
     sugar dust */
  function paint(g, P, rng, r) {
    /* deep halo */
    const au = g.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.75);
    au.addColorStop(0, 'rgba(255,190,240,0.55)');
    au.addColorStop(0.35, 'rgba(150,170,255,0.25)');
    au.addColorStop(1, 'rgba(120,140,255,0)');
    g.fillStyle = au;
    g.fillRect(-210, -250, 420, 460);
    dustRing(g, false, rng);
    cookieRing(g, false, P);
    /* ocean */
    /* deep chocolate sea with a hint of berry, tinted by the skin */
    const sea = K.mix(P.accent, '#3a1430', 0.45);
    const ocean = g.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, 0, 0, r);
    ocean.addColorStop(0, K.shade(sea, 0.45));
    ocean.addColorStop(0.55, K.shade(sea, 0.05));
    ocean.addColorStop(1, K.shade(sea, -0.6));
    K.circle(g, 0, 0, r, ocean);
    g.save();
    K.circle(g, 0, 0, r);
    g.clip();
    /* ocean swirl highlights */
    g.strokeStyle = 'rgba(255,220,180,0.12)';
    g.lineWidth = 3;
    for (let i = 0; i < 6; ++i) {
      g.beginPath();
      g.ellipse(rng.range(-60, 60), rng.range(-70, 70), rng.range(20, 50), rng.range(6, 12), rng.range(-0.4, 0.4), 0, Math.PI * 1.3);
      g.stroke();
    }
    /* continents: shore, cake land, crumb mountains, frosting caps, caramel rivers */
    const lands = [[-50, -14, 34], [50, 34, 32], [-6, 76, 22], [58, -54, 18], [-76, 58, 14], [8, -46, 15]];
    for (let i = 0; i < lands.length; ++i) {
      const L = lands[i];
      /* frosting beach */
      K.blob(g, L[0], L[1], L[2] + 10, 0.24, i * 1.9, 30);
      g.strokeStyle = 'rgba(160,230,255,0.25)';
      g.lineWidth = 3;
      g.stroke();
      K.blob(g, L[0], L[1], L[2] + 5, 0.24, i * 1.9, 30);
      g.fillStyle = K.mix(P.icing, '#ffffff', 0.2);
      g.fill();
      K.blob(g, L[0], L[1], L[2], 0.24, i * 1.9, 30);
      const lg = g.createRadialGradient(L[0] - L[2] * 0.4, L[1] - L[2] * 0.4, 2, L[0], L[1], L[2] * 1.2);
      lg.addColorStop(0, K.shade(P.dough, 0.3));
      lg.addColorStop(1, K.shade(P.dough, -0.2));
      g.fillStyle = lg;
      g.fill();
      /* crumb mountains with frosting caps */
      for (let k = 0; k < 3; ++k) {
        const mx = L[0] + rng.range(-L[2] * 0.45, L[2] * 0.45), my = L[1] + rng.range(-L[2] * 0.4, L[2] * 0.3), ms = rng.range(7, 12);
        g.beginPath();
        g.moveTo(mx - ms, my + ms * 0.5);
        g.lineTo(mx, my - ms);
        g.lineTo(mx + ms, my + ms * 0.5);
        g.closePath();
        g.fillStyle = K.shade(P.dark, -0.1);
        g.fill();
        g.beginPath();
        g.moveTo(mx - ms * 0.4, my - ms * 0.4);
        g.lineTo(mx, my - ms);
        g.lineTo(mx + ms * 0.4, my - ms * 0.4);
        g.quadraticCurveTo(mx, my - ms * 0.2, mx - ms * 0.4, my - ms * 0.4);
        g.fillStyle = '#fffaf4';
        g.fill();
      }
      /* caramel river */
      g.strokeStyle = 'rgba(232,160,60,0.85)';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(L[0] - L[2] * 0.2, L[1] - L[2] * 0.1);
      g.quadraticCurveTo(L[0] + rng.range(-10, 10), L[1] + L[2] * 0.3, L[0] + L[2] * 0.6, L[1] + L[2] * 0.55);
      g.stroke();
      /* cupcake forest */
      for (let k = 0; k < 4; ++k) {
        const tx = L[0] + rng.range(-L[2] * 0.5, L[2] * 0.5), ty = L[1] + rng.range(-L[2] * 0.2, L[2] * 0.5);
        g.fillStyle = K.shade(P.accent, -0.2);
        g.fillRect(tx - 2.2, ty, 4.4, 4);
        K.circle(g, tx, ty - 1, 3.4, ['#ff9ac8', '#9affea', '#fff0a0'][k % 3]);
      }
      /* a little town */
      for (let k = 0; k < 2; ++k) {
        const hx = L[0] + rng.range(-L[2] * 0.4, L[2] * 0.4), hy = L[1] + rng.range(0, L[2] * 0.4);
        g.fillStyle = '#f4e4cc';
        g.fillRect(hx - 3.5, hy - 4, 7, 5);
        g.fillStyle = '#c84a3a';
        g.beginPath(); g.moveTo(hx - 5, hy - 4); g.lineTo(hx, hy - 8); g.lineTo(hx + 5, hy - 4); g.closePath(); g.fill();
      }
    }
    /* whipped-cream weather bands */
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let i = 0; i < 5; ++i) {
      g.beginPath();
      g.ellipse(rng.range(-90, 90), rng.range(-90, 90), rng.range(26, 50), rng.range(4, 8), rng.range(-0.3, 0.3), 0, TAU);
      g.fill();
    }
    /* night side with city lights */
    const sh = g.createRadialGradient(-r * 0.55, -r * 0.55, r * 0.3, -r * 0.2, -r * 0.2, r * 1.7);
    sh.addColorStop(0, 'rgba(10,0,30,0)');
    sh.addColorStop(0.55, 'rgba(10,0,30,0.15)');
    sh.addColorStop(1, 'rgba(10,0,40,0.85)');
    g.fillStyle = sh;
    g.fillRect(-r, -r, r * 2, r * 2);
    for (let i = 0; i < 70; ++i) {
      const a = rng.range(-0.2, 1.7), d = rng.range(r * 0.55, r * 0.97);
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const lgt = g.createRadialGradient(x, y, 0, x, y, 3.5);
      lgt.addColorStop(0, 'rgba(255,230,140,0.95)');
      lgt.addColorStop(1, 'rgba(255,200,90,0)');
      g.fillStyle = lgt;
      g.fillRect(x - 3.5, y - 3.5, 7, 7);
    }
    /* specular sheen on the ocean */
    const sp = g.createRadialGradient(-r * 0.45, -r * 0.5, 2, -r * 0.45, -r * 0.5, r * 0.5);
    sp.addColorStop(0, 'rgba(255,255,255,0.4)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sp;
    g.fillRect(-r, -r, r, r);
    g.restore();
    /* atmosphere rim */
    const rim = g.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.12);
    rim.addColorStop(0, 'rgba(170,220,255,0)');
    rim.addColorStop(0.45, 'rgba(190,225,255,0.7)');
    rim.addColorStop(1, 'rgba(190,225,255,0)');
    g.fillStyle = rim;
    g.beginPath();
    g.arc(0, 0, r * 1.12, 0, TAU);
    g.arc(0, 0, r * 0.9, 0, TAU, true);
    g.fill();
    capital(g, r, P);
    cookieRing(g, true, P);
    dustRing(g, true, rng);
  }

  /* the cake-tower capital standing on the north pole */
  function capital(g, r, P) {
    const towers = [[-40, 20, 0.8], [-22, 34, 0.9], [0, 56, 1], [22, 34, 0.9], [40, 20, 0.8]];
    for (let i = 0; i < towers.length; ++i) {
      const x = towers[i][0], h = towers[i][1], w = 14 * towers[i][2];
      const base = -Math.sqrt(r * r - x * x) + 8;
      const tiers = Math.max(2, Math.round(h / 14));
      for (let k = 0; k < tiers; ++k) {
        const tw = w * (1 - k * 0.18), ty = base - (k + 1) * h / tiers;
        const sg = g.createLinearGradient(x - tw, 0, x + tw, 0);
        sg.addColorStop(0, K.shade(P.icing, -0.25));
        sg.addColorStop(0.4, K.mix(P.icing, '#ffffff', 0.5));
        sg.addColorStop(1, K.shade(P.icing, -0.35));
        g.fillStyle = sg;
        g.fillRect(x - tw, ty, tw * 2, h / tiers + 0.5);
        g.fillStyle = K.shade(P.accent === '#5a3018' ? '#e8a0b8' : P.accent, 0.1);
        g.fillRect(x - tw, ty + h / tiers - 3, tw * 2, 2);
        for (let wnd = -1; wnd <= 1; wnd += 2) {
          g.fillStyle = '#ffd25a';
          g.fillRect(x + wnd * tw * 0.45 - 1.5, ty + 3, 3, 4);
        }
      }
      if (i === 2) {
        g.fillStyle = '#ffd25a';
        g.beginPath(); g.moveTo(x - 5, base - h); g.lineTo(x, base - h - 10); g.lineTo(x + 5, base - h); g.closePath(); g.fill();
      }
    }
  }

  function cookieRing(g, front, P) {
    const n = 34;
    g.save();
    g.rotate(-0.22);
    for (let i = 0; i < n; ++i) {
      const a = i / n * TAU;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const x = Math.cos(a) * 188, y = Math.sin(a) * 40 + 10;
      const s = 9 + Math.sin(a) * 3;
      const cg = g.createRadialGradient(x - s * 0.3, y - s * 0.3, 1, x, y, s);
      cg.addColorStop(0, K.shade(P.dough, isFront ? 0.25 : -0.15));
      cg.addColorStop(1, K.shade(P.dough, isFront ? -0.25 : -0.5));
      K.circle(g, x, y, s, cg);
      for (let k = 0; k < 3; ++k) K.circle(g, x + Math.cos(k * 2.1 + i) * s * 0.45, y + Math.sin(k * 2.1 + i) * s * 0.45, s * 0.16, K.rgba(P.accent, isFront ? 0.9 : 0.5));
    }
    g.restore();
  }

  /* a glittering ring of sugar dust, wider and thinner than the cookie ring */
  function dustRing(g, front, rng) {
    g.save();
    g.rotate(-0.22);
    g.lineWidth = 5;
    g.strokeStyle = front ? 'rgba(255,230,255,0.35)' : 'rgba(255,230,255,0.18)';
    g.beginPath();
    g.ellipse(0, 10, 205, 46, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    g.stroke();
    for (let i = 0; i < 70; ++i) {
      const a = rng.range(0, TAU);
      if ((Math.sin(a) > 0) !== front) continue;
      const rr = rng.range(196, 214);
      K.circle(g, Math.cos(a) * rr, Math.sin(a) * rr * 0.225 + 10, rng.range(0.6, 1.6), front ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)');
    }
    g.restore();
  }

  Object.assign(NS.planetArt, { paint, capital, cookieRing, dustRing });
})();
