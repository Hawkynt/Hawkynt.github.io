;(function() {
  'use strict';

  // Seasons and weather simulation: rain, snow, storms, lightning, meteors and meteor ore.
  // Owns: NS.weather and these state fields:
  //   G.weather, G.snowCover, G.rainDrops, G.snowFlakes, G.leaves, G.meteors, G.bolts, G.meteorOre,
  //   G.lightningFlash
  // Reads: constants, dom, rules, animation, time, waves, weapon, biomes
  // Reads state of: gameState, time, drones

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, TWO_PI, VIEW_SURFACE } = NS.constants;
  const { particles, screenShake, floatingText } = NS.dom;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { applyDamageToEnemy } = NS.animation;
  const { announce } = NS.time;

  /* ======================================================================
     SEASONS AND WEATHER
     ====================================================================== */

  const SEASON_DAYS = 4;             // days per season, four seasons per year
  // dayFraction: share of daylight; count / hp / size / damage / speed scale the night's monsters
  const SEASONS = [
    { key: 'spring', name: 'Spring', color: '#8affa0', dayFraction: 0.6, count: 1.3, hp: 0.7, size: 0.85, damage: 0.85, speed: 1,
      desc: 'Blossoms lure more monsters - smaller and weaker ones', weather: { rain: 1.6, snow: 0.05, blizzard: 0, storm: 0.7, meteor: 1 } },
    { key: 'summer', name: 'Summer', color: '#ffd060', dayFraction: 0.7, count: 1, hp: 1, size: 1, damage: 1, speed: 1.15,
      desc: 'Long days - the heat makes monsters quicker', weather: { rain: 0.6, snow: 0, blizzard: 0, storm: 1.4, meteor: 1.3 } },
    { key: 'autumn', name: 'Autumn', color: '#ff9a40', dayFraction: 0.55, count: 1.1, hp: 1.1, size: 1, damage: 1, speed: 1,
      desc: 'Falling leaves and storms', weather: { rain: 1.6, snow: 0.3, blizzard: 0.1, storm: 1.7, meteor: 1 } },
    { key: 'winter', name: 'Winter', color: '#bfe4ff', dayFraction: 0.45, count: 0.6, hp: 1.75, size: 1.15, damage: 1.3, speed: 0.95,
      desc: 'Short days - few monsters, but much tougher', weather: { rain: 0.1, snow: 2.6, blizzard: 1.6, storm: 0.1, meteor: 1 } }
  ];
  const WEATHER = {
    clear: { name: 'Clear skies', sub: 'Calm weather', icon: null, color: '#ffe080' },
    rain: { name: 'Rain', sub: 'Mud slows the monsters a little', icon: 'water', color: '#7ab8ff' },
    snow: { name: 'Snowfall', sub: 'Snow piles up and slows the monsters', icon: 'snowflake', color: '#d8f0ff' },
    blizzard: { name: 'Blizzard!', sub: 'Poor sight, slow monsters - and a stiff turret', icon: 'snowflake', color: '#e8f8ff' },
    storm: { name: 'Thunderstorm!', sub: 'Lightning strikes monsters - and sometimes the dome', icon: 'bolt', color: '#ffe060' },
    meteor: { name: 'Meteor shower!', sub: 'Impacts hurt monsters and leave ore - click it to collect', icon: 'meteor', color: '#ffae60' }
  };
  G.weather = { kind: 'clear', intensity: 0, timeLeft: 40 };
  G.snowCover = 0;                 // 0..1 snow lying on the ground and dome
  G.rainDrops = []; G.snowFlakes = []; G.leaves = []; G.meteors = []; G.bolts = []; G.meteorOre = [];
  G.lightningFlash = 0; let lightningTimer = 4, meteorTimer = 2;

  function seasonOf(day) {
    return SEASONS[Math.floor((day - 1) / SEASON_DAYS) % SEASONS.length];
  }

  function currentSeason() {
    return seasonOf(G.world.day);
  }

  function windStrength() {
    const w = { clear: 0.15, rain: 0.5, snow: 0.35, blizzard: 2.2, storm: 1.4, meteor: 0.2 }[G.weather.kind] || 0;
    return w * G.weather.intensity + (currentSeason().key === 'autumn' ? 0.4 : 0);
  }

  // Movement factor for monsters from the weather and the snow on the ground
  function weatherSlow() {
    let k = 1;
    if (G.weather.kind === 'rain' || G.weather.kind === 'storm') k -= 0.1 * G.weather.intensity;
    if (G.weather.kind === 'blizzard') k -= 0.3 * G.weather.intensity;
    k -= 0.15 * G.snowCover;
    return Math.max(0.5, k);
  }

  function rollWeather() {
    const s = currentSeason(), b = NS.biomes.currentBiome();
    const weights = { clear: 3.2 };
    for (const k of ['rain', 'snow', 'blizzard', 'storm', 'meteor'])
      weights[k] = (s.weather[k] || 0) * (b.weather[k] === undefined ? 1 : b.weather[k]) * (k === 'meteor' ? 0.5 : 0.75);
    // No blizzard without a cold season or biome
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    let kind = 'clear';
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    return kind;
  }

  function setWeather(kind, duration) {
    const changed = kind !== G.weather.kind;
    G.weather.kind = kind;
    G.weather.timeLeft = duration || (kind === 'clear' ? 35 + Math.random() * 40 : 28 + Math.random() * 36);
    if (changed) {
      G.weather.intensity = 0;
      const w = WEATHER[kind];
      announce(w.name, w.sub, w.color, w.icon || 'sun');
      if (kind === 'storm')
        SZ.GameAudio.noise(1.2, 0.15, 'lowpass', 300, 80);
    }
  }

  function seasonBegins() {
    const s = currentSeason();
    announce(`${s.name} begins`, s.desc, s.color, s.key === 'winter' ? 'snowflake' : (s.key === 'spring' ? 'flower' : (s.key === 'autumn' ? 'leaf' : 'sun')));
  }

  function strikeLightning() {
    // Most bolts seek a monster; some hit open ground or the dome
    let x, target = null, domeHit = false;
    const r = Math.random();
    const visible = G.enemies.filter(e => !e.hidden);
    if (visible.length && r < 0.65) {
      target = visible[Math.floor(Math.random() * visible.length)];
      x = target.x;
    } else if (r < 0.7) {
      x = DOME_X + (Math.random() - 0.5) * 60;
      domeHit = true;
    } else
      x = 80 + Math.random() * (CANVAS_W - 160);
    const y = target ? target.y : (domeHit ? DOME_Y - Math.sqrt(Math.max(0, DOME_RADIUS * DOME_RADIUS - (x - DOME_X) * (x - DOME_X))) : DOME_Y);
    const pts = [[x + (Math.random() - 0.5) * 200, -10]];
    for (let i = 1; i <= 9; ++i)
      pts.push([pts[0][0] + (x - pts[0][0]) * i / 9 + (Math.random() - 0.5) * 40 * (i < 9 ? 1 : 0), -10 + (y + 10) * i / 9]);
    G.bolts.push({ pts, life: 0.55 });
    G.lightningFlash = 1;
    const dmg = 22 + G.waveNumber * 2;
    for (const e of G.enemies)
      if (Math.hypot(e.x - x, e.y - y) < 80 && !e.hidden) {
        applyDamageToEnemy(e, dmg);
        e.stunTimer = Math.max(e.stunTimer || 0, 0.6);
      }
    if (domeHit)
      NS.waves.damageDome(3, x, y, 'Lightning hit the dome!');
    if (G.currentView === VIEW_SURFACE) {
      particles.burst(x, y, 14, { color: '#fff6b0', speed: 3.5, life: 0.4 });
      screenShake.trigger(5, 200);
    }
    SZ.GameAudio.noise(0.9, 0.22, 'lowpass', 900, 60, 0.05);
    SZ.GameAudio.sweep(90, 40, 0.6, 'sine', 0.2, 0.05);
  }

  function spawnMeteor() {
    let tx = 60 + Math.random() * (CANVAS_W - 120);
    // Most meteors heading for the dome miss it
    if (Math.abs(tx - DOME_X) < DOME_RADIUS + 10 && Math.random() < 0.7)
      tx += (tx < DOME_X ? -1 : 1) * (DOME_RADIUS + 40 + Math.random() * 120);
    const fromLeft = Math.random() < 0.5;
    G.meteors.push({ x: tx + (fromLeft ? -1 : 1) * (300 + Math.random() * 200), y: -40, tx, ty: DOME_Y + 6, t: 0, dur: 1.1 + Math.random() * 0.5, size: 6 + Math.random() * 6 });
  }

  // Where a meteor is now along its streak
  function meteorPos(m) {
    return { x: m.x + (m.tx - m.x) * m.t, y: m.y + (m.ty - m.y) * m.t };
  }

  // Share of the streak at which the meteor's rock first touches the dome's glass
  // shell (the upper half circle), or 2 when it misses the dome
  function meteorHitT(m) {
    if (m.hitT !== undefined) return m.hitT;
    const R = DOME_RADIUS + m.size * 0.6;
    const dx = m.tx - m.x, dy = m.ty - m.y, fx = m.x - DOME_X, fy = m.y - DOME_Y;
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - R * R;
    const disc = b * b - 4 * a * c;
    m.hitT = 2;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= 1 && m.y + dy * t <= DOME_Y)
        m.hitT = t;
    }
    return m.hitT;
  }

  // A meteor lands at (x, y): on the dome shell (domeHit) or on the ground
  function meteorImpact(m, x, y, domeHit) {
    const dmg = 26 + G.waveNumber * 2;
    for (const e of G.enemies)
      if (!e.hidden && Math.hypot(e.x - x, e.y - y) < 95)
        applyDamageToEnemy(e, dmg);
    if (domeHit)
      NS.waves.damageDome(4, x, y, 'Meteor hit the dome!');
    else if (G.meteorOre.length < 14) {
      // A chunk of space rock with ore in it
      const pool = ['iron', 'iron', 'cobalt', 'copper', 'silver', 'gold', 'quartz', 'titanium', 'sapphire'];
      G.meteorOre.push({ x, y: DOME_Y + 10, type: pool[Math.floor(Math.random() * pool.length)], amount: 6 + Math.floor(Math.random() * 10), age: 0 });
    }
    if (G.currentView === VIEW_SURFACE) {
      particles.burst(x, y, 24, { color: '#ffb060', speed: 4, life: 0.6, gravity: 0.08 });
      particles.burst(x, y, 10, { color: '#6a5a50', speed: 2.5, life: 0.8, gravity: 0.1 });
      screenShake.trigger(6, 220);
      SZ.GameAudio.play('explode', { pitch: 1.3, volume: 0.6 });
    }
  }

  // A parried meteor shatters on the raised shield and harmlessly sprays sparks
  function meteorParried(m, x, y, perfect) {
    NS.weapon.parryFeedback(x, y, perfect);
    if (G.currentView !== VIEW_SURFACE) return;
    const nx = (x - DOME_X) / DOME_RADIUS, ny = (y - DOME_Y) / DOME_RADIUS;
    for (let k = 0; k < 16; ++k) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.6, v = 2 + Math.random() * 4;
      particles.trail(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: k % 3 ? '#ffb060' : '#fff4d0', life: 0.5 + Math.random() * 0.3, size: 2 + Math.random() * 2, gravity: 0.12 });
    }
    particles.burst(x, y, 10, { color: '#6a5a50', speed: 3, life: 0.6, gravity: 0.12 });
    screenShake.trigger(3, 120);
    SZ.GameAudio.play('explode', { pitch: 1.9, volume: 0.35 });
  }

  function collectMeteorOre(o, byDrone) {
    G.resources[o.type] = (G.resources[o.type] || 0) + o.amount;
    G.meteorOre.splice(G.meteorOre.indexOf(o), 1);
    if (G.currentView === VIEW_SURFACE) {
      floatingText.add(o.x, o.y - 30, `${byDrone ? 'Drone: ' : ''}+${o.amount} ${o.type}`, { color: '#ffd080', font: 'bold 20px sans-serif' });
      particles.sparkle(o.x, o.y, 8, { color: '#ffd080', speed: 2 });
      SZ.GameAudio.play('pickup', { pitch: 1.1 });
    }
  }

  function updateWeather(dt) {
    G.weather.timeLeft -= dt;
    if (G.weather.timeLeft <= 0)
      setWeather(rollWeather());
    G.weather.intensity = Math.min(1, G.weather.intensity + dt / 4);
    const k = G.weather.kind, I = G.weather.intensity;
    const season = currentSeason().key;
    // Snow builds up while it snows and melts otherwise (slowly in winter)
    if (k === 'snow' || k === 'blizzard')
      G.snowCover = Math.min(1, G.snowCover + dt * (k === 'blizzard' ? 0.03 : 0.015) * I);
    else
      G.snowCover = Math.max(season === 'winter' ? 0.35 * (k === 'clear' ? 1 : 0.6) : 0, G.snowCover - dt * (season === 'summer' ? 0.03 : 0.008));
    if (season === 'winter' && G.snowCover < 0.35)
      G.snowCover = Math.min(0.35, G.snowCover + dt * 0.01);

    if (k === 'storm') {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 2.5 + Math.random() * 5;
        strikeLightning();
      }
    }
    if (k === 'meteor') {
      meteorTimer -= dt;
      if (meteorTimer <= 0) {
        meteorTimer = 0.7 + Math.random() * 1.6;
        spawnMeteor();
      }
    }
    for (let i = G.meteors.length - 1; i >= 0; --i) {
      const m = G.meteors[i];
      m.t = Math.min(1, m.t + dt / m.dur);
      if (m.t >= meteorHitT(m)) {
        // Hits the glass where the rock touches it - unless the parry shield is up
        m.t = m.hitT;
        const p = meteorPos(m);
        const d = Math.hypot(p.x - DOME_X, p.y - DOME_Y) || 1;
        const x = DOME_X + (p.x - DOME_X) / d * DOME_RADIUS, y = DOME_Y + (p.y - DOME_Y) / d * DOME_RADIUS;
        G.meteors.splice(i, 1);
        const pc = NS.weapon.parryCheck();
        if (pc)
          meteorParried(m, x, y, pc === 2);
        else
          meteorImpact(m, x, y, true);
      } else if (m.t >= 1) {
        meteorImpact(m, m.tx, m.ty, false);
        G.meteors.splice(i, 1);
      }
    }
    for (let i = G.bolts.length - 1; i >= 0; --i) {
      G.bolts[i].life -= dt;
      if (G.bolts[i].life <= 0) G.bolts.splice(i, 1);
    }
    G.lightningFlash = Math.max(0, G.lightningFlash - dt * 3);
    // Docked couriers fetch meteor ore lying near the dome
    for (const o of G.meteorOre) {
      o.age += dt;
      if (o.age > 6 && G.drones.some(d => d.state === 'dock')) {
        collectMeteorOre(o, true);
        break;
      }
    }

    // Visual particles only while the surface is on screen
    if (G.currentView !== VIEW_SURFACE) return;
    const wind = windStrength();
    const rainRate = (k === 'rain' ? 260 : (k === 'storm' ? 420 : 0)) * I;
    const snowRate = (k === 'snow' ? 70 : (k === 'blizzard' ? 260 : 0)) * I;
    for (let n = rainRate * dt + Math.random(); n >= 1 && G.rainDrops.length < 500; --n)
      G.rainDrops.push({ x: Math.random() * (CANVAS_W + 300) - 150, y: -20 - Math.random() * 60, vy: 900 + Math.random() * 300, len: 14 + Math.random() * 10 });
    for (let n = snowRate * dt + Math.random(); n >= 1 && G.snowFlakes.length < 600; --n)
      G.snowFlakes.push({ x: Math.random() * (CANVAS_W + 400) - 200, y: -10, vy: 40 + Math.random() * 50, s: 1.5 + Math.random() * 2.5, p: Math.random() * TWO_PI });
    if (season === 'autumn' && G.leaves.length < 26 && Math.random() < dt * 3)
      G.leaves.push({ x: Math.random() * CANVAS_W, y: -10, vy: 30 + Math.random() * 30, p: Math.random() * TWO_PI, r: Math.random() * TWO_PI, c: ['#e07a20', '#c04a18', '#e8b030', '#a83a10'][Math.floor(Math.random() * 4)] });
    for (let i = G.rainDrops.length - 1; i >= 0; --i) {
      const d = G.rainDrops[i];
      d.y += d.vy * dt;
      d.x += wind * 160 * dt;
      if (d.y > DOME_Y + 4 + (i % 7) * 4 || (Math.hypot(d.x - DOME_X, d.y - DOME_Y) < DOME_RADIUS + 2 && d.y < DOME_Y)) {
        if (Math.random() < 0.25)
          particles.trail(d.x, d.y, { vx: (Math.random() - 0.5) * 1.2, vy: -0.8 - Math.random(), color: 'rgba(170,200,255,0.8)', life: 0.18, size: 1 });
        G.rainDrops.splice(i, 1);
      }
    }
    for (let i = G.snowFlakes.length - 1; i >= 0; --i) {
      const f = G.snowFlakes[i];
      f.p += dt * 2;
      f.y += f.vy * dt * (k === 'blizzard' ? 1.8 : 1);
      f.x += (Math.sin(f.p) * 20 + wind * 120) * dt;
      if (f.y > DOME_Y + 6 + (i % 5) * 6) G.snowFlakes.splice(i, 1);
    }
    for (let i = G.leaves.length - 1; i >= 0; --i) {
      const l = G.leaves[i];
      l.p += dt * 2.5;
      l.r += dt * 3;
      l.y += l.vy * dt;
      l.x += (Math.sin(l.p) * 40 + wind * 60) * dt;
      if (l.y > DOME_Y + 10) G.leaves.splice(i, 1);
    }
  }

  NS.weather = { SEASON_DAYS, WEATHER, currentSeason, windStrength, weatherSlow, seasonBegins,
    collectMeteorOre, updateWeather };
})();
