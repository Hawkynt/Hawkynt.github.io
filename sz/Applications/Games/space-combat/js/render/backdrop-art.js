/* Sector backdrop painting, once per sector: the deep nebula layer (domain-warped fbm in the
   sector's colours with dust lanes, light sources, a distant starfield and the citadel skyline),
   lit planets with bands, atmosphere and rings, moons, the sun with its corona, the distant
   black hole, and three tiling star layers. Pure painting into cached canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  const NEB_W = 640, NEB_H = 360;

  function nebulaLayer(idx, theme) {
    return K.sprite('bgneb:' + idx, NEB_W, NEB_H, (g, w, h) => {
      g.fillStyle = theme.base;
      g.fillRect(0, 0, w, h);
      const lw = 240, lh = 135;
      const low = K.makeCanvas(lw, lh);
      const lg = low.getContext('2d');
      const img = lg.createImageData(lw, lh);
      const n1 = K.valueNoise(idx * 977 + 11), n2 = K.valueNoise(idx * 577 + 3), n3 = K.valueNoise(idx * 313 + 5);
      const ramp = theme.neb.map(K.parse), ramp2 = theme.neb2.map(K.parse), base = K.parse(theme.base);
      for (let y = 0; y < lh; ++y)
        for (let x = 0; x < lw; ++x) {
          const u = x / lw * 3.2, v = y / lh * 1.8;
          const wx = K.fbm(n2, u * 0.8 + 3, v * 0.8, 3), wy = K.fbm(n2, u * 0.8, v * 0.8 + 7, 3);
          const f = K.fbm(n1, u + wx * 1.6, v + wy * 1.6, 5);
          const f2 = K.fbm(n3, u * 1.3 + 9, v * 1.3 + wx, 4);
          const dens = K.smooth(0.42, 0.82, f);
          const dens2 = K.smooth(0.5, 0.85, f2) * 0.7;
          const lane = 1 - 0.65 * K.smooth(0.55, 0.75, K.fbm(n3, u * 2.4, v * 2.4, 3));
          let r = base[0], gg = base[1], b = base[2];
          /* main cloud: walk the four-colour ramp by density */
          const t = dens * 3, i0 = Math.min(2, Math.floor(t)), fr = t - i0;
          const cr = ramp[i0][0] + (ramp[i0 + 1][0] - ramp[i0][0]) * fr;
          const cg = ramp[i0][1] + (ramp[i0 + 1][1] - ramp[i0][1]) * fr;
          const cb = ramp[i0][2] + (ramp[i0 + 1][2] - ramp[i0][2]) * fr;
          const a = Math.min(1, dens * 1.15) * lane;
          r += (cr - r) * a; gg += (cg - gg) * a; b += (cb - b) * a;
          const a2 = dens2 * lane * (1 - dens * 0.6);
          r += (ramp2[1][0] - r) * a2 * 0.8; gg += (ramp2[1][1] - gg) * a2 * 0.8; b += (ramp2[1][2] - b) * a2 * 0.8;
          const k = (y * lw + x) * 4;
          img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
        }
      lg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(low, 0, 0, w, h);
      /* glowing light sources inside the clouds */
      g.globalCompositeOperation = 'lighter';
      const rng = NS.rng.makeRng(idx * 31 + 1);
      for (let i = 0; i < 5; ++i) {
        const x = rng() * w, y = rng() * h, r = 60 + rng() * 120;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, K.rgba(theme.neb[3], 0.16));
        gr.addColorStop(1, K.rgba(theme.neb[2], 0));
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      /* faint distant stars baked in */
      for (let i = 0; i < 900; ++i) {
        const x = rng() * w, y = rng() * h;
        const a = 0.15 + rng() * 0.5;
        g.fillStyle = K.rgba(i % 7 === 0 ? theme.neb[3] : theme.star, a);
        g.fillRect(x, y, rng() < 0.9 ? 0.5 : 1, rng() < 0.9 ? 0.5 : 1);
      }
      if (theme.citadel) paintSkyline(g, w, h, rng);
      /* vignette */
      const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
    });
  }

  /* The citadel: dark spires along the bottom with lit windows */
  function paintSkyline(g, w, h, rng) {
    for (let layer = 0; layer < 2; ++layer) {
      g.fillStyle = layer ? 'rgba(5,2,12,0.85)' : 'rgba(18,8,40,0.7)';
      let x = 0;
      g.beginPath();
      g.moveTo(0, h);
      while (x < w) {
        const sw = 6 + rng() * 16, sh = (layer ? 14 : 26) + rng() * (layer ? 34 : 56);
        g.lineTo(x, h - sh * 0.3);
        g.lineTo(x + sw * 0.5, h - sh);
        g.lineTo(x + sw, h - sh * 0.3);
        x += sw + rng() * 10;
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    }
    for (let i = 0; i < 160; ++i) {
      g.fillStyle = rng() < 0.7 ? 'rgba(176,74,255,0.8)' : 'rgba(122,255,192,0.8)';
      g.fillRect(rng() * w, h - rng() * 40, 0.8, 0.8);
    }
  }

  /* Planets are painted at half resolution - blit with scale 2 */
  function planet(key, p) {
    const R = p.r / 2;
    const size = p.ring ? R * 4.1 : R * 2.8;
    return K.sprite('planet:' + key, size, size, (g, w) => {
      const c = w / 2;
      const n = K.valueNoise(NS.rng.hashString(key));
      /* rings behind */
      if (p.ring) ring(g, c, R, p, true);
      /* atmosphere glow */
      const at = g.createRadialGradient(c, c, R * 0.9, c, c, R * 1.25);
      at.addColorStop(0, K.rgba(p.atmo || p.c, 0.5));
      at.addColorStop(1, K.rgba(p.atmo || p.c, 0));
      g.fillStyle = at;
      g.beginPath();
      g.arc(c, c, R * 1.25, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.clip();
      const body = g.createRadialGradient(c - R * 0.35, c - R * 0.35, R * 0.1, c, c, R * 1.05);
      body.addColorStop(0, K.shade(p.a, 0.25));
      body.addColorStop(0.6, p.a);
      body.addColorStop(1, p.b);
      g.fillStyle = body;
      g.fillRect(c - R, c - R, R * 2, R * 2);
      /* bands */
      for (let i = 0; i < 26; ++i) {
        const y = c - R + (i + 0.5) * R * 2 / 26;
        const v = n(i * 0.7, 3.3);
        g.fillStyle = v > 0.5 ? K.rgba(p.c, 0.1 * p.bands + 0.04) : K.rgba(p.b, 0.18 * p.bands + 0.05);
        g.beginPath();
        g.ellipse(c, y + Math.sin(i) * 2, R * 1.2, R * 2 / 26 * (0.6 + v), 0.12, 0, TAU);
        g.fill();
      }
      /* storms and clouds */
      for (let i = 0; i < 14; ++i) {
        const a = n(i, 1) * TAU, d = n(i, 2) * R * 0.85;
        g.fillStyle = K.rgba(p.c, 0.08 + n(i, 3) * 0.08);
        g.beginPath();
        g.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.7, R * (0.08 + n(i, 4) * 0.15), R * 0.04, 0.12, 0, TAU);
        g.fill();
      }
      /* terminator: the night side */
      const night = g.createLinearGradient(c - R * 0.2, c - R * 0.2, c + R, c + R);
      night.addColorStop(0, 'rgba(0,0,8,0)');
      night.addColorStop(0.55, 'rgba(0,0,8,0.55)');
      night.addColorStop(1, 'rgba(0,0,8,0.92)');
      g.fillStyle = night;
      g.fillRect(c - R, c - R, R * 2, R * 2);
      g.restore();
      /* lit limb */
      g.strokeStyle = K.rgba(p.atmo || p.c, 0.65);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(c, c, R - 1, Math.PI * 0.95, Math.PI * 1.75);
      g.stroke();
      if (p.ring) ring(g, c, R, p, false);
    });
  }

  function ring(g, c, R, p, back) {
    g.save();
    g.translate(c, c);
    g.rotate(-0.35);
    g.scale(1, 0.26);
    g.beginPath();
    if (back) g.rect(-R * 2, -R * 2, R * 4, R * 2);
    else g.rect(-R * 2, 0, R * 4, R * 2);
    g.clip();
    for (let i = 0; i < 9; ++i) {
      g.strokeStyle = K.rgba(i % 3 === 1 ? p.c : K.mix(p.c, p.a, 0.5), back ? 0.22 : 0.42);
      g.lineWidth = 2.5 + (i % 3);
      g.beginPath();
      g.arc(0, 0, R * (1.35 + i * 0.07), 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  function moon(key, m) {
    const R = m.r;
    return K.sprite('moon:' + key, R * 2 + 8, R * 2 + 8, (g, w) => {
      const c = w / 2;
      const n = K.valueNoise(NS.rng.hashString('moon' + key));
      g.save();
      g.beginPath();
      g.arc(c, c, R, 0, TAU);
      g.clip();
      const gr = g.createRadialGradient(c - R * 0.4, c - R * 0.4, 1, c, c, R);
      gr.addColorStop(0, K.shade(m.a, 0.3));
      gr.addColorStop(1, m.b);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
      for (let i = 0; i < 16; ++i) {
        const a = n(i, 1) * TAU, d = n(i, 2) * R * 0.9, cr = R * (0.05 + n(i, 3) * 0.14);
        g.fillStyle = K.rgba(m.b, 0.45);
        g.beginPath();
        g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, cr, 0, TAU);
        g.fill();
      }
      const night = g.createLinearGradient(c - R * 0.2, c - R * 0.2, c + R, c + R);
      night.addColorStop(0, 'rgba(0,0,8,0)');
      night.addColorStop(1, 'rgba(0,0,8,0.85)');
      g.fillStyle = night;
      g.fillRect(0, 0, w, w);
      g.restore();
    });
  }

  /* The star: a white disc in layered glows with long corona rays (half resolution) */
  function sun(s) {
    const R = s.r / 2;
    const size = R * 3.2;
    return K.sprite('sun', size, size, (g, w) => {
      const c = w / 2;
      const gr = g.createRadialGradient(c, c, 0, c, c, w / 2);
      gr.addColorStop(0, s.a);
      gr.addColorStop(0.18, s.a);
      gr.addColorStop(0.28, K.rgba(s.b, 0.85));
      gr.addColorStop(0.55, K.rgba(s.c, 0.25));
      gr.addColorStop(1, K.rgba(s.c, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
      g.globalCompositeOperation = 'lighter';
      /* a soft corona: many faint tapered streamers that blend into a haze */
      const rng = NS.rng.makeRng(77);
      for (let i = 0; i < 64; ++i) {
        const a = rng() * TAU;
        const L = w * (0.2 + rng() * 0.3);
        const wid = 0.04 + rng() * 0.08;
        const gr = g.createRadialGradient(c, c, R * 0.4, c, c, L);
        gr.addColorStop(0, K.rgba(s.b, 0.06));
        gr.addColorStop(1, K.rgba(s.c, 0));
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(c + Math.cos(a - wid) * R * 0.5, c + Math.sin(a - wid) * R * 0.5);
        g.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L);
        g.lineTo(c + Math.cos(a + wid) * R * 0.5, c + Math.sin(a + wid) * R * 0.5);
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    });
  }

  /* One tile of a parallax star layer: density and size grow toward the front layer */
  function starTile(layer, color, tint) {
    const T = 256;
    return K.sprite('stars:' + layer + ':' + color, T, T, (g) => {
      const rng = NS.rng.makeRng(1000 + layer * 77);
      const n = [140, 60, 22][layer];
      for (let i = 0; i < n; ++i) {
        const x = rng() * T, y = rng() * T;
        const s = [0.6, 0.9, 1.3][layer] * (0.6 + rng() * 0.8);
        const c = rng() < 0.15 ? tint : color;
        g.fillStyle = K.rgba(c, 0.35 + rng() * 0.5);
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
        if (layer === 2 && rng() < 0.18) {
          const gr = g.createRadialGradient(x, y, 0, x, y, s * 6);
          gr.addColorStop(0, K.rgba(c, 0.25));
          gr.addColorStop(1, K.rgba(c, 0));
          g.fillStyle = gr;
          g.fillRect(x - s * 6, y - s * 6, s * 12, s * 12);
          g.fillStyle = K.rgba(c, 0.3);
          g.fillRect(x - s * 4, y - 0.25, s * 8, 0.5);
          g.fillRect(x - 0.25, y - s * 4, 0.5, s * 8);
        }
      }
    });
  }

  Object.assign(NS.backdropArt, {
    NEB_W, NEB_H, nebulaLayer, planet, moon, sun, starTile
  });
})();
