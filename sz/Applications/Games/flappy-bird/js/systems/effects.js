;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Simulation of the juice: loose feathers, biome weather particles, coin rings and the
     Stage Clear star reveal. Owns G.feathers, G.weather, G.rings, G.weatherCarry, G.clearStarFx. */

  const { CANVAS_W, CANVAS_H, CLEAR_PH, CLEAR_STAR_CY, STATE_PLAYING } = NS.C;
  const { particles, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const View = NS.view;

  function addFeather(x, y, vx, vy, color) {
    if (G.feathers.length >= 60)
      G.feathers.shift();
    G.feathers.push({
      x: x, y: y, vx: vx, vy: vy,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      life: 0.7 + Math.random() * 0.7,
      color: color,
      size: 5 + Math.random() * 3
    });
  }

  function burstFeathers(x, y, count) {
    const art = Prog.birdArt();
    for (let i = 0; i < count; ++i) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      addFeather(x, y, Math.cos(a) * sp, Math.sin(a) * sp, i % 2 === 0 ? art.wing : art.body);
    }
  }

  function updateFeathers(dt) {
    const step = dt * 60;
    const scroll = G.state === STATE_PLAYING ? Rules.runSpeed() * step * 0.6 : 0;
    for (let i = G.feathers.length - 1; i >= 0; --i) {
      const f = G.feathers[i];
      f.vy += 0.06 * step;
      f.vx *= Math.pow(0.99, step);
      f.x += f.vx * step - scroll + Math.sin(f.life * 6 + f.rot) * 0.3 * step;
      f.y += f.vy * step;
      f.rot += f.vrot * step;
      f.life -= dt;
      if (f.life <= 0 || f.x < -40 || f.y > CANVAS_H + 40)
        G.feathers.splice(i, 1);
    }
  }

  /* particles enter at the edges of the visible rect, so they keep filling the
     picture even in the bars beside the game area; the ground-hugging kinds
     (sand, embers) stay at their distance from the ground line */
  function spawnWeather(sc, v) {
    const w = sc.theme.weather;
    const p = {
      kind: w.kind, color: w.color,
      x: 0, y: 0, vx: 0, vy: 0,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
      size: 2, alpha: 1,
      seed: Math.random() * Math.PI * 2
    };
    if (w.kind === 'leaves') {
      if (Math.random() < 0.5) {
        p.x = v.x1 + 10;
        p.y = v.y0 + Math.random() * (420 - v.y0);
      } else {
        p.x = v.x0 + Math.random() * (v.x1 - v.x0);
        p.y = v.y0 - 10;
      }
      p.vx = -1 - Math.random() - 0.3 * Rules.runSpeed();
      p.vy = 0.4 + Math.random() * 0.6;
      p.alpha = 0.6 + Math.random() * 0.4;
    } else if (w.kind === 'sand') {
      p.x = v.x1 + 10;
      p.y = 300 + Math.random() * 340;
      p.vx = -6 - Math.random() * 3;
      p.alpha = 0.5;
    } else if (w.kind === 'snow') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0 + 40) - 20;
      p.y = v.y0 - 10;
      p.vy = 0.6 + Math.random() * 0.8;
      p.size = 1.5 + Math.random() * 2;
      p.alpha = 0.7 + Math.random() * 0.3;
    } else if (w.kind === 'fireflies') {
      p.x = v.x1 + 10;
      p.y = 200 + Math.random() * 400;
      p.vx = -0.4 - Math.random() * 0.3;
      p.size = 2;
    } else if (w.kind === 'rain') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0 + 120) - 60;
      p.y = v.y0 - 16;
      p.vx = -3;
      p.vy = 11 + Math.random() * 3;
      p.size = 14;
      p.alpha = 0.45;
    } else if (w.kind === 'embers') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0);
      p.y = 640;
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = -1 - Math.random() * 1.2;
      p.size = 2;
    }
    G.weather.push(p);
  }

  function updateWeather(dt, sc, canSpawn, rateScale) {
    const step = dt * 60;
    const v = View.visibleRect();
    if (canSpawn) {
      G.weatherCarry += sc.theme.weather.rate * 40 * dt * (rateScale || 1);
      while (G.weatherCarry >= 1) {
        G.weatherCarry -= 1;
        if (G.weather.length < 90)
          spawnWeather(sc, v);
      }
    }
    for (let i = G.weather.length - 1; i >= 0; --i) {
      const p = G.weather[i];
      if (p.kind === 'leaves') {
        p.rot += p.vrot * step;
        p.y += Math.sin(G.globalTime * 2 + p.seed) * 0.3 * step;
      } else if (p.kind === 'snow') {
        p.x += Math.sin(G.globalTime * 2 + p.seed) * 0.6 * step;
      } else if (p.kind === 'fireflies') {
        p.x += Math.sin(G.globalTime * 0.8 + p.seed) * 0.5 * step;
        p.y += Math.cos(G.globalTime * 0.6 + p.seed * 2) * 0.5 * step;
      } else if (p.kind === 'embers') {
        p.x += Math.sin(G.globalTime * 3 + p.seed) * 0.2 * step;
      }
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.x < v.x0 - 40 || p.x > v.x1 + 60 || p.y < v.y0 - 40 || p.y > v.y1 + 40)
        G.weather.splice(i, 1);
    }
  }

  function addRing(x, y) {
    if (G.rings.length >= 20)
      G.rings.shift();
    G.rings.push({ x: x, y: y, t: 0 });
  }

  function updateRings(dt) {
    for (let i = G.rings.length - 1; i >= 0; --i) {
      G.rings[i].t += dt;
      if (G.rings[i].t > 0.25)
        G.rings.splice(i, 1);
    }
  }

  /* The CLEAR panel reveals its stars one by one, each with its own chime */
  function updateClearStars() {
    const t = G.globalTime - G.panelAt;
    const starY = (CANVAS_H - CLEAR_PH) / 2 + CLEAR_STAR_CY;
    for (let i = 0; i < 3; ++i) {
      if (t < 0.4 + i * 0.35 || (G.clearStarFx & (1 << i)) !== 0)
        continue;
      G.clearStarFx |= 1 << i;
      if (i < G.lastStars) {
        sfx('coin', { pitch: 1 + 0.25 * i });
        particles.sparkle(CANVAS_W / 2 + (i - 1) * 92, starY, 14, { color: '#ffd700' });
      } else {
        sfx('thud', { volume: 0.3 });
      }
    }
  }

  Object.assign(NS.fx, {
    addFeather, burstFeathers, updateFeathers, spawnWeather, updateWeather, addRing, updateRings,
    updateClearStars
  });
})();
