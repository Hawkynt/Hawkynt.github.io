;(function() {
  'use strict';

  // Cached surface art of the site (sky, ridges, ground, plants) and drawing the sky and ground.
  // Owns: NS.surfaceArt
  // Reads: constants, util, dom, sprites, fxArt, panels, rules, time, weather, biomes
  // Reads state of: dom, gameState, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI } = NS.constants;
  const { makeRng, makeCanvas, mixHex, parseHex, hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { SPRITE_OUTLINE } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { roundRectPath } = NS.panels;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { drawCelestials } = NS.time;
  const { currentSeason, windStrength } = NS.weather;
  const { currentBiome } = NS.biomes;

  function skyGradientCanvas(stops) {
    const c = makeCanvas(CANVAS_W, DOME_Y);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, DOME_Y);
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.42, stops[1]);
    grad.addColorStop(0.78, stops[2]);
    grad.addColorStop(1, stops[3]);
    g.fillStyle = grad;
    g.fillRect(0, 0, CANVAS_W, DOME_Y);
    return c;
  }

  // Ridge heights (0..1, 257 samples) for a mountain range in the biome's style
  function ridgeProfile(shape, rng, layer) {
    const n = 256;
    const hs = new Array(n + 1);
    hs[0] = rng();
    hs[n] = rng();
    const rough = { ridge: 0.56, mesa: 0.5, peaks: 0.66, hills: 0.42, volcano: 0.52, spires: 0.5 }[shape] || 0.56;
    for (let span = n, disp = 1; span > 1; span >>= 1, disp *= rough)
      for (let i = span >> 1; i < n; i += span)
        hs[i] = (hs[i - (span >> 1)] + hs[i + (span >> 1)]) / 2 + (rng() - 0.5) * disp;
    let lo = Infinity, hi = -Infinity;
    for (const v of hs) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    let out = hs.map(v => (v - lo) / (hi - lo || 1));
    const craters = [];
    if (shape === 'hills') {
      // Rounded rolling hills
      for (let pass = 0; pass < 3; ++pass)
        out = out.map((v, i) => (out[Math.max(0, i - 2)] + out[Math.max(0, i - 1)] + v + out[Math.min(n, i + 1)] + out[Math.min(n, i + 2)]) / 5);
    } else if (shape === 'mesa') {
      // Flat-topped buttes with steep sides
      out = out.map(v => {
        const q = Math.round(v * 3) / 3;
        return q + (v - q) * 0.15;
      });
    } else if (shape === 'peaks') {
      out = out.map(v => Math.pow(v, 1.5));
    } else if (shape === 'volcano' && layer === 1) {
      // One or two cones with a crater on the middle range
      const count = 1 + (rng() < 0.5 ? 1 : 0);
      for (let k = 0; k < count; ++k) {
        const cx = Math.floor(n * (0.15 + rng() * 0.7)), w = 26 + rng() * 14;
        for (let i = 0; i <= n; ++i) {
          const d = Math.abs(i - cx) / w;
          if (d < 1) {
            let h = 1.25 - d * 0.75;
            if (d < 0.12) h -= (0.12 - d) * 1.6; // crater
            out[i] = Math.max(out[i], h);
          }
        }
        craters.push(cx / n);
      }
    } else if (shape === 'spires') {
      // Crystal spikes
      for (let k = 0; k < 14; ++k) {
        const cx = Math.floor(rng() * n), w = 2 + rng() * 4, h = 0.6 + rng() * 0.6;
        for (let i = Math.max(0, cx - w); i <= Math.min(n, cx + w); ++i)
          out[i] = Math.max(out[i], h * (1 - Math.abs(i - cx) / (w + 1)));
      }
    }
    let top = 0;
    for (const v of out)
      top = Math.max(top, v);
    return { heights: out.map(v => v / (top || 1)), craters };
  }

  // Sky layers, mountains, ground and plants of the current site -- rebuilt when the site changes
  let previousSurfaceArt = null;
  function buildSurfaceArt() {
    if (G.surfaceArt && G.surfaceArt.seed === G.site.seed) return G.surfaceArt;
    if (previousSurfaceArt && previousSurfaceArt.seed === G.site.seed) {
      [G.surfaceArt, previousSurfaceArt] = [previousSurfaceArt, G.surfaceArt];
      return G.surfaceArt;
    }
    previousSurfaceArt = G.surfaceArt;
    const B = currentBiome();
    const rng = makeRng(G.site.seed ^ 0x1337);

    const skyDay = skyGradientCanvas(B.skyDay);
    const skyDusk = skyGradientCanvas(B.skyDusk);
    const skyNight = skyGradientCanvas(B.skyNight);
    const g = skyNight.getContext('2d');
    // Nebula clouds and faint star dust on the night sky
    const neb = [[300, 260, 340, B.nebula[0], 0.18], [980, 180, 300, B.nebula[1], 0.14], [700, 420, 420, B.nebula[2], 0.12]];
    for (const [x, y, r, col, a] of neb) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${col},${a})`);
      rg.addColorStop(0.6, `rgba(${col},${a * 0.4})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 420; ++i) {
      const x = rng() * CANVAS_W, y = rng() * DOME_Y * 0.92;
      g.fillStyle = `rgba(${200 + rng() * 55 | 0},${200 + rng() * 55 | 0},255,${0.08 + rng() * 0.35 * (1 - y / DOME_Y)})`;
      g.fillRect(x, y, rng() < 0.15 ? 1.6 : 1, rng() < 0.15 ? 1.6 : 1);
    }
    // Thin high clouds by day
    const dc = skyDay.getContext('2d');
    for (let i = 0; i < 9; ++i) {
      const x = rng() * CANVAS_W, y = 60 + rng() * DOME_Y * 0.45, w = 160 + rng() * 260;
      const cg = dc.createRadialGradient(x, y, 0, x, y, w / 2);
      cg.addColorStop(0, 'rgba(255,255,255,0.22)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      dc.save();
      dc.translate(x, y);
      dc.scale(1, 0.18);
      dc.translate(-x, -y);
      dc.fillStyle = cg;
      dc.fillRect(x - w / 2, y - w / 2, w, w);
      dc.restore();
    }

    // Decoration hanging in the sky (planet, shattered moon); fades by day
    const decor = makeCanvas(CANVAS_W, DOME_Y);
    const d = decor.getContext('2d');
    if (B.decor === 'ringed' || B.decor === 'giant' || B.decor === 'shattered') {
      const px = 280 + rng() * 300, py = 180 + rng() * 120, pr = B.decor === 'giant' ? 120 : 70;
      const cols = B.decor === 'giant' ? ['#d8fff0', '#60c0a0', '#1a5a50', '#0a2a28'] : (B.decor === 'shattered' ? ['#ffe8ff', '#b080e0', '#4a2a80', '#1a1038'] : ['#f0c8ff', '#a070d0', '#3a2470', '#1a1038']);
      if (B.decor === 'ringed') {
        d.save();
        d.translate(px, py);
        d.rotate(-0.35);
        d.strokeStyle = 'rgba(220,190,255,0.25)';
        d.lineWidth = 6;
        d.beginPath();
        d.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, TWO_PI);
        d.stroke();
        d.restore();
      }
      const pg = d.createRadialGradient(px - pr * 0.45, py - pr * 0.45, pr * 0.1, px, py, pr);
      pg.addColorStop(0, cols[0]);
      pg.addColorStop(0.35, cols[1]);
      pg.addColorStop(0.8, cols[2]);
      pg.addColorStop(1, cols[3]);
      d.fillStyle = pg;
      d.beginPath();
      d.arc(px, py, pr, 0, TWO_PI);
      d.fill();
      d.save();
      d.beginPath();
      d.arc(px, py, pr, 0, TWO_PI);
      d.clip();
      d.globalAlpha = 0.18;
      for (let i = -3; i <= 3; ++i) {
        d.fillStyle = i % 2 ? '#ffffff' : '#10202a';
        d.fillRect(px - pr, py + i * pr * 0.26 - 4, pr * 2, 8);
      }
      d.restore();
      if (B.decor === 'ringed') {
        d.save();
        d.translate(px, py);
        d.rotate(-0.35);
        d.strokeStyle = 'rgba(230,200,255,0.45)';
        d.lineWidth = 5;
        d.beginPath();
        d.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI);
        d.stroke();
        d.restore();
      } else if (B.decor === 'shattered') {
        // Fragments drifting away from the broken moon
        for (let i = 0; i < 18; ++i) {
          const a = rng() * TWO_PI, dist = pr * (1.15 + rng() * 0.9), s = 3 + rng() * 9;
          const fx = px + Math.cos(a) * dist, fy = py + Math.sin(a) * dist * 0.55;
          d.fillStyle = i % 3 ? '#b890f0' : '#f0d8ff';
          d.beginPath();
          d.moveTo(fx, fy - s);
          d.lineTo(fx + s * 0.6, fy);
          d.lineTo(fx, fy + s * 0.8);
          d.lineTo(fx - s * 0.5, fy);
          d.closePath();
          d.fill();
        }
      }
    }

    // Twinkling stars drawn live
    const stars = [];
    for (let i = 0; i < 90; ++i)
      stars.push({ x: rng() * CANVAS_W, y: rng() * DOME_Y * 0.8, s: 0.8 + rng() * 1.6, p: rng() * TWO_PI, f: 0.6 + rng() * 2.2, big: rng() < 0.12 });

    // Mountain ranges: far, mid, near (wider than the screen for parallax), by day and by night
    const ranges = [];
    const specs = [
      { base: 210, amp: 150, depth: 6 },
      { base: 130, amp: 100, depth: 14 },
      { base: 60, amp: 50, depth: 26 }
    ];
    if (B.shape === 'peaks') {
      specs[0].amp = 200;
      specs[1].amp = 130;
    }
    let craters = [];
    specs.forEach((sp, layer) => {
      const w = CANVAS_W + 120, h = sp.base + sp.amp + 70;
      const prof = ridgeProfile(B.shape, makeRng(G.site.seed + 11 + layer * 12), layer);
      const ridge = prof.heights.map((v, i) => [i * w / 256, h - Math.max(10, sp.base - sp.amp * 0.5 + v * sp.amp)]);
      if (layer === 1)
        craters = prof.craters.map(f => ({ x: f * w - 60, y: DOME_Y - h + 4 + ridge[Math.round(f * 256)][1] }));
      const paint = (cols, rim, haze) => {
        const c = makeCanvas(w, h);
        const m = c.getContext('2d');
        const mg = m.createLinearGradient(0, 0, 0, h);
        mg.addColorStop(0, cols[0]);
        mg.addColorStop(1, cols[1]);
        m.fillStyle = mg;
        m.beginPath();
        m.moveTo(0, h);
        for (const [x, y] of ridge)
          m.lineTo(x, y);
        m.lineTo(w, h);
        m.closePath();
        m.fill();
        if (B.shape === 'peaks') {
          // Snow caps on the higher slopes
          m.save();
          m.clip();
          m.fillStyle = cols === B.ranges[layer].day ? 'rgba(255,255,255,0.85)' : 'rgba(150,170,215,0.26)';
          m.beginPath();
          m.moveTo(0, 0);
          for (const [x, y] of ridge)
            m.lineTo(x, Math.min(h, y + 10 + Math.max(0, (h - y) - sp.base) * 0.6));
          m.lineTo(w, 0);
          m.closePath();
          m.fill();
          m.restore();
        }
        m.strokeStyle = rim;
        m.lineWidth = 2;
        m.beginPath();
        ridge.forEach(([x, y], i) => i ? m.lineTo(x, y + 1) : m.moveTo(x, y + 1));
        m.stroke();
        const hz = m.createLinearGradient(0, h * 0.4, 0, h);
        hz.addColorStop(0, haze + '0)');
        hz.addColorStop(1, haze + '0.28)');
        m.globalCompositeOperation = 'source-atop';
        m.fillStyle = hz;
        m.fillRect(0, 0, w, h);
        return c;
      };
      const hazeOf = (hex) => {
        const [r, gg, b] = parseHex(hex);
        return `rgba(${r},${gg},${b},`;
      };
      ranges.push({
        day: paint(B.ranges[layer].day, B.rim[0], hazeOf(B.skyDay[3])),
        night: paint(B.ranges[layer].night, B.rim[1], hazeOf(B.skyNight[3])),
        depth: sp.depth, h
      });
    });

    // Ground strip with strata, pebbles and gems, by day and by night
    const gh = CANVAS_H - DOME_Y;
    const paintGroundStrip = (stops, night) => {
      const ground = makeCanvas(CANVAS_W, gh);
      const gg = ground.getContext('2d');
      const r3 = makeRng(G.site.seed ^ 99);
      const sg = gg.createLinearGradient(0, 0, 0, gh);
      sg.addColorStop(0, stops[0]);
      sg.addColorStop(0.08, stops[1]);
      sg.addColorStop(0.5, stops[2]);
      sg.addColorStop(1, stops[3]);
      gg.fillStyle = sg;
      gg.fillRect(0, 0, CANVAS_W, gh);
      for (let band = 0; band < 4; ++band) {
        const by = 18 + band * 22;
        gg.strokeStyle = `rgba(0,0,0,${0.16 + band * 0.04})`;
        gg.lineWidth = 2;
        gg.beginPath();
        for (let x = 0; x <= CANVAS_W; x += 10)
          gg.lineTo(x, by + Math.sin(x * 0.01 + band) * 4 + Math.sin(x * 0.043 + band * 2) * 2);
        gg.stroke();
      }
      const [pr, pg, pb] = B.ground.pebble;
      const k = night ? 0.45 : 1;
      for (let i = 0; i < 140; ++i) {
        const x = r3() * CANVAS_W, y = 8 + r3() * (gh - 12), rr = 1.5 + r3() * 5;
        gg.fillStyle = `rgba(${(pr + r3() * 40) * k | 0},${(pg + r3() * 30) * k | 0},${(pb + r3() * 40) * k | 0},0.6)`;
        gg.beginPath();
        gg.ellipse(x, y, rr * 1.4, rr, 0, 0, TWO_PI);
        gg.fill();
        gg.fillStyle = `rgba(255,255,255,${night ? 0.08 : 0.18})`;
        gg.beginPath();
        gg.ellipse(x - rr * 0.3, y - rr * 0.4, rr * 0.6, rr * 0.35, 0, 0, TWO_PI);
        gg.fill();
      }
      for (let i = 0; i < 18; ++i) {
        const x = r3() * CANVAS_W, y = 30 + r3() * (gh - 40);
        gg.fillStyle = B.ground.gems[i % B.ground.gems.length];
        gg.globalAlpha = 0.55;
        gg.beginPath();
        gg.moveTo(x, y - 6);
        gg.lineTo(x + 3, y);
        gg.lineTo(x, y + 5);
        gg.lineTo(x - 3, y);
        gg.closePath();
        gg.fill();
        gg.globalAlpha = 1;
      }
      gg.fillStyle = hexToRgba(B.ground.edge, night ? 0.3 : 0.5);
      gg.fillRect(0, 0, CANVAS_W, 2);
      gg.fillStyle = 'rgba(0,0,0,0.3)';
      gg.fillRect(0, 2, CANVAS_W, 2);
      return ground;
    };
    const groundDay = paintGroundStrip(B.ground.day, false);
    const groundNight = paintGroundStrip(B.ground.night, true);

    // Plants along the ground line (drawn live so they sway)
    const plants = [];
    const rp = makeRng(G.site.seed ^ 0xbeef);
    for (let x = 8 + rp() * 10; x < CANVAS_W; x += (B.plant === 'grass' || B.plant === 'fern' ? 18 : 46) + rp() * (B.plant === 'grass' ? 12 : 60)) {
      if (Math.abs(x - DOME_X) < DOME_RADIUS + 30) continue;
      plants.push({ x, s: 0.6 + rp() * 0.8, v: rp(), p: rp() * TWO_PI });
    }

    G.surfaceArt = { seed: G.site.seed, skyDay, skyDusk, skyNight, decor, stars, ranges, groundDay, groundNight, plants, craters };
    return G.surfaceArt;
  }

  function drawSky() {
    const art = buildSurfaceArt();
    const B = currentBiome();
    const night = 1 - G.daylight;
    if (G.daylight < 0.995)
      ctx.drawImage(art.skyNight, 0, 0);
    if (G.daylight > 0.01) {
      ctx.globalAlpha = G.daylight;
      ctx.drawImage(art.skyDay, 0, 0);
    }
    if (G.duskGlow > 0.01) {
      ctx.globalAlpha = G.duskGlow;
      ctx.drawImage(art.skyDusk, 0, 0);
    }
    ctx.globalAlpha = 1;
    drawCelestials();
    ctx.globalAlpha = Math.max(0.12, 1 - G.daylight * 0.85);
    ctx.drawImage(art.decor, 0, 0);
    ctx.globalAlpha = 1;
    // Twinkling stars
    if (night > 0.05) {
      for (const s of art.stars) {
        const tw = 0.45 + 0.55 * Math.sin(G.animTime * s.f + s.p);
        if (tw <= 0.05) continue;
        ctx.globalAlpha = tw * 0.9 * night;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
        if (s.big) {
          ctx.globalAlpha = tw * 0.35 * night;
          ctx.fillRect(s.x - s.s * 2.5, s.y - 0.5, s.s * 5, 1);
          ctx.fillRect(s.x - 0.5, s.y - s.s * 2.5, 1, s.s * 5);
        }
      }
      ctx.globalAlpha = 1;
      // Occasional shooting star
      const cycle = 11;
      const t = (G.animTime % cycle) / 0.9;
      if (t < 1) {
        const k = Math.floor(G.animTime / cycle);
        const sx = 200 + ((k * 7919) % 900), sy = 60 + ((k * 3571) % 220);
        const hx = sx + t * 260, hy = sy + t * 90;
        const g = ctx.createLinearGradient(hx - 120, hy - 42, hx, hy);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(255,255,255,${0.8 * (1 - t) * night})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hx - 120, hy - 42);
        ctx.lineTo(hx, hy);
        ctx.stroke();
      }
    }
    // Aurora over the ice
    if (B.decor === 'aurora' && night > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; ++band) {
        const y0 = 120 + band * 50;
        const g = ctx.createLinearGradient(0, y0 - 140, 0, y0 + 40);
        const col = band === 1 ? '120,255,200' : (band === 2 ? '160,120,255' : '90,220,255');
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(0.7, `rgba(${col},${0.16 * night})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, y0 + 40);
        for (let x = 0; x <= CANVAS_W; x += 40)
          ctx.lineTo(x, y0 + Math.sin(x * 0.006 + G.animTime * 0.4 + band * 2) * 30 + Math.sin(x * 0.017 - G.animTime * 0.7) * 12);
        for (let x = CANVAS_W; x >= 0; x -= 40)
          ctx.lineTo(x, y0 - 140 + Math.sin(x * 0.006 + G.animTime * 0.4 + band * 2) * 30);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // Mountain ranges with mouse parallax, night and day versions blended
    const sway = G.mouseAimX >= 0 ? (G.mouseAimX / CANVAS_W - 0.5) : 0;
    for (const r of art.ranges) {
      const x = -60 - sway * r.depth * 2, y = DOME_Y - r.h + 4;
      if (G.daylight < 0.995)
        ctx.drawImage(r.night, x, y);
      if (G.daylight > 0.01) {
        ctx.globalAlpha = G.daylight;
        ctx.drawImage(r.day, x, y);
        ctx.globalAlpha = 1;
      }
    }
    // Volcano smoke and crater glow
    for (const c of art.craters) {
      const x = c.x - sway * 28;
      drawGlow('#ff5a1a', x, c.y + 6, 46, 0.35 + night * 0.4 + Math.sin(G.animTime * 3) * 0.08);
      for (let k = 0; k < 7; ++k) {
        const t = (G.animTime * 0.12 + k / 7) % 1;
        ctx.globalAlpha = (1 - t) * 0.32;
        ctx.fillStyle = mixHex('#5a4a48', '#1a1414', night);
        ctx.beginPath();
        ctx.arc(x + Math.sin(t * 3 + k) * 18 + t * 70, c.y - t * 190, 10 + t * 42, 0, TWO_PI);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Low drifting mist in the horizon colour
    const mist = mixHex(B.skyNight[3], B.skyDay[3], G.daylight);
    const mx = (G.animTime * 12) % CANVAS_W;
    ctx.globalAlpha = 0.5;
    for (const off of [-CANVAS_W, 0]) {
      const x = mx + off;
      const mg = ctx.createRadialGradient(x + 500, DOME_Y - 10, 10, x + 500, DOME_Y - 10, 420);
      mg.addColorStop(0, mist.replace('rgb', 'rgba').replace(')', ',0.22)'));
      mg.addColorStop(1, mist.replace('rgb', 'rgba').replace(')', ',0)'));
      ctx.fillStyle = mg;
      ctx.fillRect(x + 80, DOME_Y - 120, 840, 140);
    }
    ctx.globalAlpha = 1;
  }

  function drawGroundLayer() {
    const art = buildSurfaceArt();
    const B = currentBiome();
    if (G.daylight < 0.995)
      ctx.drawImage(art.groundNight, 0, DOME_Y);
    if (G.daylight > 0.01) {
      ctx.globalAlpha = G.daylight;
      ctx.drawImage(art.groundDay, 0, DOME_Y);
      ctx.globalAlpha = 1;
    }
    const shade = 0.55 + G.daylight * 0.45;
    const sk = currentSeason().key;
    const tint = sk === 'autumn' ? ['#d0701c', 0.55] : (sk === 'winter' ? ['#dfeeff', 0.45] : (sk === 'summer' ? ['#c8c040', 0.15] : null));
    const plantCols = B.plantColors.map(c => tint && B.plant !== 'ember' && B.plant !== 'shard' ? mixHex(c, tint[0], tint[1]) : c)
      .map(c => c.charAt(0) === '#' ? c : '#' + c.match(/\d+/g).map(n => (+n).toString(16).padStart(2, '0')).join(''));
    const col = (i) => mixHex('#000000', plantCols[i], shade);
    const Y = DOME_Y + 2;
    ctx.lineCap = 'round';
    for (const p of art.plants) {
      const tilt = Math.sin(p.x * 0.7 + G.animTime * 0.9 + p.p) * (1 + windStrength());
      if (B.plant === 'grass') {
        const h = (8 + Math.abs(Math.sin(p.x * 0.5)) * 14) * p.s;
        ctx.lineWidth = 3;
        ctx.strokeStyle = col(p.v < 0.66 ? 0 : 1);
        ctx.beginPath();
        ctx.moveTo(p.x, Y);
        ctx.quadraticCurveTo(p.x + tilt * 6, Y - h * 0.6, p.x + tilt * 4, Y - h);
        ctx.stroke();
      } else if (B.plant === 'fern') {
        const h = 16 + 18 * p.s;
        ctx.lineWidth = 2.5;
        for (const side of [-1, 1, 0]) {
          ctx.strokeStyle = col(side === 0 ? 1 : 0);
          ctx.beginPath();
          ctx.moveTo(p.x, Y);
          const ex = p.x + side * h * 0.6 + tilt * 5, ey = Y - h * (side === 0 ? 1 : 0.75);
          ctx.quadraticCurveTo(p.x + side * h * 0.1 + tilt * 3, Y - h * 0.7, ex, ey);
          ctx.stroke();
          ctx.lineWidth = 1.5;
          for (let k = 1; k < 4; ++k) {
            const t = k / 4, lx = p.x + (ex - p.x) * t, ly = Y + (ey - Y) * t;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx + (side || 1) * 5 + tilt, ly - 4);
            ctx.stroke();
          }
          ctx.lineWidth = 2.5;
        }
      } else if (B.plant === 'cactus') {
        const h = 22 + 22 * p.s, w = 7 + 3 * p.s;
        ctx.fillStyle = SPRITE_OUTLINE;
        roundRectPath(p.x - w / 2 - 1.5, Y - h - 1.5, w + 3, h + 3, w / 2);
        ctx.fill();
        ctx.fillStyle = col(0);
        roundRectPath(p.x - w / 2, Y - h, w, h, w / 2);
        ctx.fill();
        for (const side of p.v < 0.5 ? [-1] : [-1, 1]) {
          const ay = Y - h * (0.45 + 0.15 * side * p.v);
          ctx.strokeStyle = SPRITE_OUTLINE;
          ctx.lineWidth = w * 0.75 + 3;
          ctx.beginPath();
          ctx.moveTo(p.x, ay);
          ctx.lineTo(p.x + side * w * 1.3, ay);
          ctx.lineTo(p.x + side * w * 1.3, ay - h * 0.3);
          ctx.stroke();
          ctx.strokeStyle = col(0);
          ctx.lineWidth = w * 0.75;
          ctx.stroke();
        }
        ctx.fillStyle = col(1);
        ctx.fillRect(p.x - 1, Y - h + 3, 2, h - 6);
      } else if (B.plant === 'icicle') {
        for (let k = 0; k < 3; ++k) {
          const ox = (k - 1) * 6 * p.s, h = (10 + (k === 1 ? 14 : 6) + p.v * 8) * p.s * 1.4;
          ctx.fillStyle = SPRITE_OUTLINE;
          ctx.beginPath();
          ctx.moveTo(p.x + ox - 5, Y);
          ctx.lineTo(p.x + ox + tilt * 0.5, Y - h - 2);
          ctx.lineTo(p.x + ox + 5, Y);
          ctx.fill();
          ctx.fillStyle = col(k === 1 ? 1 : 0);
          ctx.beginPath();
          ctx.moveTo(p.x + ox - 3.5, Y);
          ctx.lineTo(p.x + ox + tilt * 0.5, Y - h);
          ctx.lineTo(p.x + ox + 3.5, Y);
          ctx.fill();
        }
        if (G.daylight > 0.3 && Math.sin(G.animTime * 2 + p.p * 5) > 0.97)
          drawGlow('#ffffff', p.x, Y - 14, 10, 0.8);
      } else if (B.plant === 'ember') {
        const w = 10 + 10 * p.s;
        ctx.fillStyle = mixHex('#000000', '#4a3634', shade);
        ctx.beginPath();
        ctx.ellipse(p.x, Y, w, 6 + 4 * p.s, 0, Math.PI, 0);
        ctx.fill();
        const glow = 0.55 + Math.sin(G.animTime * 3 + p.p) * 0.25;
        ctx.strokeStyle = `rgba(255,${120 + glow * 80 | 0},40,${glow})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.6, Y - 1);
        ctx.lineTo(p.x - w * 0.1, Y - 5 * p.s);
        ctx.lineTo(p.x + w * 0.5, Y - 2);
        ctx.stroke();
        drawGlow('#ff6a20', p.x, Y - 3, 16 + 8 * p.s, glow * (0.35 + (1 - G.daylight) * 0.4));
        if (Math.random() < 0.02)
          particles.trail(p.x, Y - 6, { vx: (Math.random() - 0.5) * 0.6, vy: -1 - Math.random(), color: '#ffa040', life: 0.8, size: 1.5, gravity: -0.01 });
      } else if (B.plant === 'shard') {
        for (let k = 0; k < 3; ++k) {
          const ang = (k - 1) * 0.35 + tilt * 0.02, h = (12 + (k === 1 ? 16 : 6) + p.v * 6) * p.s * 1.3, w = 4 + p.s * 2;
          ctx.save();
          ctx.translate(p.x + (k - 1) * 5, Y);
          ctx.rotate(ang);
          ctx.fillStyle = SPRITE_OUTLINE;
          ctx.beginPath();
          ctx.moveTo(-w - 1, 0); ctx.lineTo(-w - 1, -h * 0.75); ctx.lineTo(0, -h - 2); ctx.lineTo(w + 1, -h * 0.75); ctx.lineTo(w + 1, 0);
          ctx.fill();
          ctx.fillStyle = col(k % 3);
          ctx.beginPath();
          ctx.moveTo(-w, 0); ctx.lineTo(-w, -h * 0.75); ctx.lineTo(0, -h); ctx.lineTo(w, -h * 0.75); ctx.lineTo(w, 0);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(-w + 1, -h * 0.7, 1.5, h * 0.6);
          ctx.restore();
        }
        drawGlow(B.plantColors[(p.v * 3) | 0], p.x, Y - 12, 20, 0.25 + (1 - G.daylight) * 0.35);
      }
      // Spring blossoms
      if (sk === 'spring' && p.v < 0.6 && B.plant !== 'ember') {
        const fx = p.x + 6 + tilt * 3, fy = Y - 6 - p.s * 8;
        const petal = ['#ff7ab0', '#ffe060', '#ffffff', '#c890ff'][(p.v * 6 | 0) % 4];
        ctx.fillStyle = mixHex('#000000', petal, shade);
        for (let k = 0; k < 5; ++k) {
          const a = k * TWO_PI / 5 + p.p;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2.2, 0, TWO_PI);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd040';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.6, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
  }

  NS.surfaceArt = { buildSurfaceArt, drawSky, drawGroundLayer };
})();
