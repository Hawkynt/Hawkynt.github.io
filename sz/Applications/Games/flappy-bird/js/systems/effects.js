;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Simulation of the juice: loose feathers, biome and seasonal weather, coin rings, pipe
     debris from Rocket Beak, the cosmetic trail behind the bird and the Stage Clear star
     reveal. Owns G.feathers, G.weather, G.rings, G.debris, G.weatherCarry, G.trailTick,
     G.clearStarFx. Lists shrink by swapping with the last item, never by splicing. */

  const { CANVAS_W, CANVAS_H, CLEAR_PH, CLEAR_STAR_CY, STATE_PLAYING } = NS.C;
  const { particles, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const View = NS.view;

  function removeAt(list, i) {
    list[i] = list[list.length - 1];
    list.pop();
  }

  function addFeather(x, y, vx, vy, color) {
    if (G.feathers.length >= 60)
      removeAt(G.feathers, 0);
    G.feathers.push({
      x: x, y: y, vx: vx, vy: vy,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.3,
      life: 0.7 + Math.random() * 0.7,
      color: color,
      size: 5 + Math.random() * 3
    });
  }

  function burstFeathers(x, y, count, birdId) {
    const art = birdId ? (SZ.FlappyBirdArt.BIRDS.find(b => b.id === birdId) || Prog.birdArt()) : Prog.birdArt();
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
        removeAt(G.feathers, i);
    }
  }

  /* particles enter at the edges of the visible rect, so they keep filling the
     picture even in the bars beside the game area; the ground-hugging kinds
     (sand, embers) stay at their distance from the ground line */
  function spawnWeather(kind, color, v) {
    const p = {
      kind: kind, color: color,
      x: 0, y: 0, vx: 0, vy: 0,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
      size: 2, alpha: 1,
      seed: Math.random() * Math.PI * 2
    };
    const speed = G.state === STATE_PLAYING ? Rules.runSpeed() : 1;
    if (kind === 'leaves' || kind === 'petal' || kind === 'aleaf') {
      if (Math.random() < 0.5) {
        p.x = v.x1 + 10;
        p.y = v.y0 + Math.random() * (420 - v.y0);
      } else {
        p.x = v.x0 + Math.random() * (v.x1 - v.x0);
        p.y = v.y0 - 10;
      }
      p.vx = -1 - Math.random() - 0.3 * speed;
      p.vy = 0.4 + Math.random() * 0.6;
      p.alpha = 0.6 + Math.random() * 0.4;
      p.size = kind === 'leaves' ? 6 : 5 + Math.random() * 3;
    } else if (kind === 'sand') {
      p.x = v.x1 + 10;
      p.y = 300 + Math.random() * 340;
      p.vx = -6 - Math.random() * 3;
      p.alpha = 0.5;
    } else if (kind === 'snow') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0 + 40) - 20;
      p.y = v.y0 - 10;
      p.vy = 0.6 + Math.random() * 0.8;
      p.size = 1.5 + Math.random() * 2;
      p.alpha = 0.7 + Math.random() * 0.3;
    } else if (kind === 'fireflies') {
      p.x = v.x1 + 10;
      p.y = 200 + Math.random() * 400;
      p.vx = -0.4 - Math.random() * 0.3;
      p.size = 2;
    } else if (kind === 'rain') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0 + 120) - 60;
      p.y = v.y0 - 16;
      p.vx = -3;
      p.vy = 11 + Math.random() * 3;
      p.size = 14;
      p.alpha = 0.45;
    } else if (kind === 'embers') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0);
      p.y = 640;
      p.vx = (Math.random() - 0.5) * 0.4;
      p.vy = -1 - Math.random() * 1.2;
      p.size = 2;
    } else if (kind === 'glint') {
      p.x = v.x0 + Math.random() * (v.x1 - v.x0);
      p.y = v.y0 + Math.random() * 380;
      p.vx = -0.3 * speed;
      p.life = 1;
      p.size = 2 + Math.random() * 3;
    } else if (kind === 'sbat') {
      p.x = v.x1 + 20;
      p.y = 60 + Math.random() * 260;
      p.vx = -2.5 - Math.random() * 1.5;
      p.size = 6 + Math.random() * 5;
    }
    G.weather.push(p);
  }

  const SEASON_WEATHER = {
    frost: { kind: 'snow', color: '#ffffff', rate: 0.8 },
    newyear: { kind: 'snow', color: '#fff3c0', rate: 0.4 },
    bloom: { kind: 'petal', color: '#ffb0d8', rate: 0.6 },
    sun: { kind: 'glint', color: '#fff6c0', rate: 0.5 },
    harvest: { kind: 'aleaf', color: '#e87a2a', rate: 0.6 },
    spooky: { kind: 'sbat', color: '#1a1026', rate: 0.15 }
  };
  let seasonCarry = 0;
  let fireworkT = 0;

  function updateWeather(dt, sc, canSpawn, rateScale) {
    const step = dt * 60;
    const v = View.visibleRect();
    if (canSpawn) {
      const w = sc.theme.weather;
      G.weatherCarry += w.rate * 40 * dt * (rateScale || 1);
      while (G.weatherCarry >= 1) {
        G.weatherCarry -= 1;
        if (G.weather.length < 110)
          spawnWeather(w.kind, w.color, v);
      }
      const ev = Prog.visualEvent();
      const sw = ev ? SEASON_WEATHER[ev.id] : null;
      if (sw) {
        seasonCarry += sw.rate * 40 * dt * (rateScale || 1);
        while (seasonCarry >= 1) {
          seasonCarry -= 1;
          if (G.weather.length < 130)
            spawnWeather(sw.kind, ev.id === 'harvest' && Math.random() < 0.5 ? '#c8442a' : sw.color, v);
        }
        if (ev.id === 'newyear') {
          fireworkT -= dt;
          if (fireworkT <= 0) {
            fireworkT = 0.8 + Math.random() * 1.4;
            const x = v.x0 + 100 + Math.random() * (v.x1 - v.x0 - 200), y = 60 + Math.random() * 200;
            const colors = ['#ffd84a', '#ff4ad8', '#4ad8ff', '#7aff8a', '#ff6a4a'];
            const col = colors[Math.floor(Math.random() * colors.length)];
            particles.burst(x, y, 34, { color: col, speed: 4.5, size: 2.5, gravity: 0.04, friction: 0.97, life: 1, decay: 0.018, shape: 'glow' });
            particles.ring(x, y, col, 3, 0.4);
          }
        }
      }
    }
    for (let i = G.weather.length - 1; i >= 0; --i) {
      const p = G.weather[i];
      if (p.kind === 'leaves' || p.kind === 'petal' || p.kind === 'aleaf') {
        p.rot += p.vrot * step;
        p.y += Math.sin(G.globalTime * 2 + p.seed) * 0.3 * step;
      } else if (p.kind === 'snow') {
        p.x += Math.sin(G.globalTime * 2 + p.seed) * 0.6 * step;
      } else if (p.kind === 'fireflies') {
        p.x += Math.sin(G.globalTime * 0.8 + p.seed) * 0.5 * step;
        p.y += Math.cos(G.globalTime * 0.6 + p.seed * 2) * 0.5 * step;
      } else if (p.kind === 'embers') {
        p.x += Math.sin(G.globalTime * 3 + p.seed) * 0.2 * step;
      } else if (p.kind === 'glint') {
        p.life -= dt * 0.8;
        if (p.life <= 0) {
          removeAt(G.weather, i);
          continue;
        }
      } else if (p.kind === 'sbat') {
        p.y += Math.sin(G.globalTime * 3 + p.seed) * 0.8 * step;
      }
      p.x += p.vx * step;
      p.y += p.vy * step;
      if (p.x < v.x0 - 40 || p.x > v.x1 + 60 || p.y < v.y0 - 40 || p.y > v.y1 + 40)
        removeAt(G.weather, i);
    }
  }

  function addRing(x, y) {
    if (G.rings.length >= 20)
      removeAt(G.rings, 0);
    G.rings.push({ x: x, y: y, t: 0 });
  }

  function updateRings(dt) {
    for (let i = G.rings.length - 1; i >= 0; --i) {
      G.rings[i].t += dt;
      if (G.rings[i].t > 0.25)
        removeAt(G.rings, i);
    }
  }

  /* Rocket Beak: the pipe breaks into tumbling chunks in its own colours */
  function shatterGate(sx, topY, botY, style) {
    const colors = [style.body, style.light, style.dark, style.cap];
    for (let i = 0; i < 18; ++i) {
      const top = i % 2 === 0;
      G.debris.push({
        x: sx + 10 + Math.random() * 52, y: top ? topY - 20 - Math.random() * 140 : botY + 20 + Math.random() * 140,
        vx: 3 + Math.random() * 5, vy: (top ? -1 : 1) * (1 + Math.random() * 3) - 2,
        w: 10 + Math.random() * 18, h: 8 + Math.random() * 14, rot: Math.random() * 6, vrot: (Math.random() - 0.5) * 0.4,
        color: colors[i % colors.length], life: 1.4
      });
    }
    particles.burst(sx + 36, (topY + botY) / 2, 30, { color: '#ffb03a', speed: 8, size: 4, life: 0.6, shape: 'glow' });
    particles.ring(sx + 36, (topY + botY) / 2, '#ffd84a', 8, 0.35);
  }

  function updateDebris(dt) {
    const step = dt * 60;
    const scroll = G.state === STATE_PLAYING ? Rules.runSpeed() * step : 0;
    for (let i = G.debris.length - 1; i >= 0; --i) {
      const d = G.debris[i];
      d.vy += 0.35 * step;
      d.x += d.vx * step - scroll;
      d.y += d.vy * step;
      d.rot += d.vrot * step;
      d.life -= dt;
      if (d.life <= 0 || d.y > CANVAS_H + 60)
        removeAt(G.debris, i);
    }
  }

  /* the cosmetic trail behind the bird */
  const RAINBOW = ['#ff4a4a', '#ff9a3a', '#ffe14a', '#5ad06a', '#4aa3ff', '#7a5aff', '#d04aff'];
  function emitTrail(dt, x, y, speed, trailId) {
    const id = trailId || (G.feverT > 0 ? 'rainbow' : Prog.currentTrail());
    if (id === 'none')
      return;
    G.trailTick += dt * 60;
    if (G.trailTick < 2)
      return;
    G.trailTick = 0;
    const back = -(speed || 3) * 0.6;
    const o = { vx: back, life: 0.8, decay: 0.03, size: 3, shrink: 0.97 };
    if (id === 'sparkle') {
      Object.assign(o, { color: Math.random() < 0.5 ? '#fff6c0' : '#ffd84a', shape: 'star', size: 3 });
    } else if (id === 'rainbow') {
      Object.assign(o, { color: RAINBOW[Math.floor(G.globalTime * 14) % RAINBOW.length], shape: 'glow', size: 7, shrink: 0.95 });
      particles.trail(x - 14, y + 4, Object.assign({}, o, { color: RAINBOW[(Math.floor(G.globalTime * 14) + 3) % RAINBOW.length] }));
    } else if (id === 'hearts') {
      Object.assign(o, { color: '#ff5a8a', shape: 'heart', size: 5, vy: -0.4 });
    } else if (id === 'stars') {
      Object.assign(o, { color: '#ffe14a', shape: 'star', size: 5, life: 1, decay: 0.02 });
    } else if (id === 'embers') {
      Object.assign(o, { color: Math.random() < 0.5 ? '#ff7a2a' : '#ffd84a', shape: 'glow', size: 4, vy: -0.8 });
    } else if (id === 'notes') {
      Object.assign(o, { color: RAINBOW[Math.floor(Math.random() * 7)], shape: 'note', size: 6, vy: -0.6, decay: 0.02 });
    } else if (id === 'fireworks') {
      if (Math.random() < 0.25)
        particles.burst(x - 20, y, 8, { color: RAINBOW[Math.floor(Math.random() * 7)], speed: 3, size: 2, shape: 'glow', life: 0.6 });
      return;
    } else if (id === 'snow') {
      Object.assign(o, { color: '#ffffff', shape: 'flake', size: 4, vy: 0.4 });
    } else if (id === 'petals') {
      Object.assign(o, { color: '#ffb0d8', shape: 'petal', size: 5, vy: 0.5 });
    } else if (id === 'bubbles') {
      Object.assign(o, { color: '#9ae8ff', shape: 'bubble', size: 5, vy: -0.7, shrink: 1.0 });
    } else if (id === 'leaves') {
      Object.assign(o, { color: Math.random() < 0.5 ? '#e87a2a' : '#c8442a', shape: 'leaf', size: 5, vy: 0.6 });
    } else if (id === 'ghosts') {
      Object.assign(o, { color: 'rgba(240,240,255,0.85)', shape: 'ghost', size: 6, vy: -0.7, decay: 0.022 });
    }
    particles.trail(x - 16, y + 2, o);
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
        particles.ring(CANVAS_W / 2 + (i - 1) * 92, starY, '#ffd700', 4, 0.3);
      } else {
        sfx('thud', { volume: 0.3 });
      }
    }
  }

  Object.assign(NS.fx, {
    SEASON_WEATHER, addFeather, burstFeathers, updateFeathers, spawnWeather, updateWeather, addRing, updateRings,
    shatterGate, updateDebris, emitTrail, updateClearStars
  });
})();
