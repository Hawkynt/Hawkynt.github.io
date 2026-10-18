/* render/weather.js -- ambient weather and drifting cloud shadows per biome.
   Reads: constants, maps, env, pixelArt, artKit and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { makeRng, TWO_PI, WORLD_W, WORLD_H } = NS.constants;
  const { MAPS } = NS.maps;
  const { ctx } = NS.env;
  const { makeCanvas } = NS.pixelArt;
  const { drawGlow } = NS.artKit;

  /* ══════════════════════════════════════════════════════════════════
     AMBIENT WEATHER -- pollen and butterflies, desert dust, snowfall,
     embers and ash, plus drifting cloud shadows
     ══════════════════════════════════════════════════════════════════ */

  let ambient = null;
  function initAmbient(biome) {
    const rng = makeRng(biome.length * 77);
    const n = biome === 'tundra' ? 90 : biome === 'volcano' || biome === 'cavern' ? 60 : biome === 'swamp' ? 46 : 36;
    ambient = { biome, parts: [], clouds: [] };
    for (let i = 0; i < n; ++i)
      ambient.parts.push({ x: rng() * WORLD_W, y: rng() * WORLD_H, z: 0.4 + rng() * 0.6, ph: rng() * TWO_PI, kind: rng() < (biome === 'swamp' ? 0.45 : 0.15) ? 1 : 0 });
    for (let i = 0; i < 3; ++i)
      ambient.clouds.push({ x: rng() * WORLD_W, y: rng() * WORLD_H, s: 0.7 + rng() * 0.6 });
  }

  let cloudShadow = null, mistBank = null;
  function drawAmbient() {
    const biome = MAPS[G.currentMap].biome;
    if (!ambient || ambient.biome !== biome) initAmbient(biome);
    const dt = Math.min(0.05, G.frameDt);
    // Cloud shadows drift slowly over meadow and desert (parallax above the ground)
    if (biome === 'meadow' || biome === 'desert') {
      if (!cloudShadow) {
        cloudShadow = makeCanvas(96, 48);
        const g = cloudShadow.getContext('2d');
        for (const [x, y, r] of [[30, 26, 18], [50, 20, 20], [68, 28, 16], [44, 32, 14]]) {
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, 'rgba(10,20,30,0.22)');
          grad.addColorStop(1, 'rgba(10,20,30,0)');
          g.fillStyle = grad;
          g.fillRect(0, 0, 96, 48);
        }
      }
      ctx.imageSmoothingEnabled = true;
      for (const c of ambient.clouds) {
        c.x += dt * 9 * c.s;
        c.y += dt * 2;
        if (c.x > WORLD_W + 150) { c.x = -260; c.y = Math.random() * WORLD_H; }
        if (c.y > WORLD_H + 80) c.y = -100;
        ctx.drawImage(cloudShadow, c.x, c.y, 260 * c.s, 130 * c.s);
      }
      ctx.imageSmoothingEnabled = false;
    } else if (biome === 'swamp') {
      // Low banks of mist creeping over the fens
      if (!mistBank) {
        mistBank = makeCanvas(96, 48);
        const g = mistBank.getContext('2d');
        for (const [x, y, r] of [[26, 26, 20], [48, 22, 22], [70, 27, 18], [40, 32, 16], [60, 32, 15]]) {
          const grad = g.createRadialGradient(x, y, 0, x, y, r);
          grad.addColorStop(0, 'rgba(210,230,200,0.13)');
          grad.addColorStop(1, 'rgba(210,230,200,0)');
          g.fillStyle = grad;
          g.fillRect(0, 0, 96, 48);
        }
      }
      ctx.imageSmoothingEnabled = true;
      for (const c of ambient.clouds) {
        c.x += dt * 5 * c.s;
        if (c.x > WORLD_W + 150) { c.x = -320; c.y = Math.random() * WORLD_H; }
        ctx.drawImage(mistBank, c.x, c.y, 320 * c.s, 120 * c.s);
      }
      ctx.imageSmoothingEnabled = false;
    }
    for (const p of ambient.parts) {
      p.ph += dt;
      if (biome === 'tundra') {
        p.y += dt * 22 * p.z;
        p.x += dt * (8 + Math.sin(p.ph) * 10) * p.z;
        ctx.fillStyle = `rgba(255,255,255,${0.5 + p.z * 0.5})`;
        const s = p.z > 0.8 ? 2 : 1;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s * 1.5, s * 1.5);
      } else if (biome === 'volcano') {
        if (p.kind) {
          p.y += dt * 10 * p.z;
          p.x += dt * 4;
          ctx.fillStyle = 'rgba(120,110,110,0.55)';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        } else {
          p.y -= dt * 18 * p.z;
          p.x += Math.sin(p.ph * 2) * dt * 8;
          const fl = 0.5 + 0.5 * Math.sin(p.ph * 6);
          ctx.fillStyle = fl > 0.5 ? '#ffd06a' : '#ff6a1a';
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        }
      } else if (biome === 'swamp') {
        p.x += Math.sin(p.ph * 0.6) * dt * 10;
        p.y += Math.cos(p.ph * 0.45) * dt * 7;
        if (p.kind) {
          // Fireflies blinking on and off
          const on = Math.max(0, Math.sin(p.ph * 1.7 + p.z * 9));
          if (on > 0.2) {
            drawGlow('#d8ff6a', p.x, p.y, 7 * p.z + 3, 0.35 * on);
            ctx.fillStyle = '#f0ffb0';
            ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
          }
        } else {
          ctx.fillStyle = `rgba(200,220,160,${0.12 + 0.18 * (0.5 + 0.5 * Math.sin(p.ph * 2))})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1.5, 1.5);
        }
      } else if (biome === 'cavern') {
        if (p.kind) {
          // Crystal glitter twinkling in place
          const tw = Math.pow(Math.max(0, Math.sin(p.ph * 2.3 + p.z * 11)), 8);
          if (tw > 0.05) {
            const col = p.z > 0.7 ? '#a8f4ff' : '#d2b8ff';
            drawGlow(col, p.x, p.y, 6, 0.5 * tw);
            ctx.fillStyle = col;
            ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1);
            ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3);
          }
        } else {
          // Dust sifting down from the ceiling
          p.y += dt * 9 * p.z;
          p.x += Math.sin(p.ph * 0.8) * dt * 3;
          ctx.fillStyle = `rgba(190,180,230,${0.2 + p.z * 0.25})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1.5, 1.5);
        }
      } else if (biome === 'desert') {
        p.x += dt * 26 * p.z;
        p.y += Math.sin(p.ph * 1.3) * dt * 6;
        ctx.fillStyle = 'rgba(255,240,200,0.35)';
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1);
      } else {
        // Meadow: pollen motes and the odd butterfly
        p.x += Math.sin(p.ph * 0.7) * dt * 12;
        p.y += Math.cos(p.ph * 0.5) * dt * 8;
        if (p.kind) {
          const flap = Math.sin(p.ph * 18) > 0;
          ctx.fillStyle = p.z > 0.7 ? '#ffe14a' : '#f4f4f4';
          ctx.fillRect(Math.round(p.x - (flap ? 3 : 2)), Math.round(p.y), flap ? 2 : 1, 2);
          ctx.fillRect(Math.round(p.x + 1), Math.round(p.y), flap ? 2 : 1, 2);
        } else {
          ctx.fillStyle = `rgba(255,250,200,${0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.ph * 3))})`;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1.5, 1.5);
        }
      }
      if (p.x > WORLD_W + 4) p.x = -4;
      if (p.x < -4) p.x = WORLD_W + 4;
      if (p.y > WORLD_H + 4) p.y = -4;
      if (p.y < -4) p.y = WORLD_H + 4;
    }
  }

  NS.weather = { drawAmbient };

})();
