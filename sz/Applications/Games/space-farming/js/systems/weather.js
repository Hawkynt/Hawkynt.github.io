/* Space Farming - weather events by season, forecasts and the rain maker, meteors and lightning
   striking the farm, and the eased visual weather state.
   Owns: G.weatherType, G.weatherTimer, G.weatherInterval, G.meteors, G.bolts, G.decals, G.splashes,
     G.flashA, G.wxShown, G.wxK, G.wxDrops, G.rainMakerDay, G.nextWeather
   Reads: G.canvasW, G.canvasH, G.state, G.credits, G.dayCount, G.gridRows, G.farmGrid, G.buildings,
     G.livestockPens, G.currentSeason, G.gridCols, G.viewZoom, G.viewPanX, G.viewPanY, G.lowQuality,
     G.penVersion */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, STATE_PLAYING, CROPS, LIVESTOCK,
    WEATHER_NONE, WEATHER_SOLAR_FLARE, WEATHER_METEOR_SHOWER, WEATHER_RAIN, WEATHER_THUNDERSTORM,
    WEATHER_SNOW, WEATHER_DUST, WEATHER_DURATION, WEATHER_MIN_INTERVAL, WEATHER_MAX_INTERVAL, particles,
    screenShake, UI, getWeatherResistance, tileCenter, penCenter, horizonWorldY, getField, worldToUI,
    flyCoins, techOwned, announce, popText } = NS;

  /* ══════════════════════════════════════════════════════════════════
     WEATHER EVENTS
     ══════════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════════
     WEATHER EVENTS — chosen per season; meteors and lightning strike
     real tiles, rain wets the soil, snow and dust slow the crops
     ══════════════════════════════════════════════════════════════════ */

  const WEATHER_TABLE = [
    [[WEATHER_RAIN, 45], [WEATHER_SOLAR_FLARE, 20], [WEATHER_METEOR_SHOWER, 15], [WEATHER_THUNDERSTORM, 15], [WEATHER_DUST, 5]],
    [[WEATHER_SOLAR_FLARE, 40], [WEATHER_THUNDERSTORM, 20], [WEATHER_DUST, 20], [WEATHER_METEOR_SHOWER, 10], [WEATHER_RAIN, 10]],
    [[WEATHER_RAIN, 30], [WEATHER_THUNDERSTORM, 20], [WEATHER_DUST, 20], [WEATHER_METEOR_SHOWER, 20], [WEATHER_SOLAR_FLARE, 10]],
    [[WEATHER_SNOW, 70], [WEATHER_METEOR_SHOWER, 15], [WEATHER_SOLAR_FLARE, 15]]
  ];
  let strikeTimer = 0;

  function canCallRain() {
    return techOwned('sci_rain') && G.weatherType === WEATHER_NONE && G.dayCount >= G.rainMakerDay && G.state === STATE_PLAYING;
  }

  function callRain() {
    if (!canCallRain()) {
      SZ.GameAudio.play('error');
      return;
    }
    G.rainMakerDay = G.dayCount + 1;
    triggerWeather(G.currentSeason === 3 ? WEATHER_SNOW : WEATHER_RAIN);
  }

  function updateWeather(dt) {
    if (G.state !== STATE_PLAYING) return;
    if (G.weatherType === WEATHER_NONE) {
      G.weatherInterval -= dt;
      if (G.weatherInterval <= 0)
        triggerWeather();
    } else {
      G.weatherTimer -= dt;
      if (G.weatherType === WEATHER_THUNDERSTORM) {
        strikeTimer -= dt;
        if (strikeTimer <= 0) {
          strikeTimer = 1.1 + Math.random() * 1.3;
          strikeLightning();
        }
      }
      if (G.weatherTimer <= 0) {
        G.weatherType = WEATHER_NONE;
        scheduleWeather();
      }
    }
    updateMeteors(dt);
  }

  function pickWeather() {
    const table = WEATHER_TABLE[G.currentSeason] || WEATHER_TABLE[0];
    let total = 0;
    for (const [, w] of table) total += w;
    let roll = Math.random() * total;
    for (const [kind, w] of table) {
      roll -= w;
      if (roll < 0) return kind;
    }
    return table[0][0];
  }

  function isSheltered(r, c) {
    return !!getField().shelter[r * G.gridCols + c];
  }

  function scheduleWeather() {
    G.weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
    G.nextWeather = null;
  }

  /* The forecast keeps the weather it promised unless the season changed meanwhile */
  function forecastWeather() {
    if (!G.nextWeather || !(WEATHER_TABLE[G.currentSeason] || []).some(([k]) => k === G.nextWeather))
      G.nextWeather = pickWeather();
    return G.nextWeather;
  }

  function triggerWeather(kind) {
    G.weatherType = kind || forecastWeather();
    G.nextWeather = null;
    G.weatherTimer = G.weatherType === WEATHER_SNOW || G.weatherType === WEATHER_DUST ? 12 : WEATHER_DURATION;
    switch (G.weatherType) {
      case WEATHER_SOLAR_FLARE:
        announce('Solar flare!', 'Crops grow twice as fast, sun-lovers three times', '#ffd23f', 'flare');
        SZ.GameAudio.play('powerup', { pitch: 0.8 });
        break;
      case WEATHER_RAIN:
        announce('Rain', 'Crops grow 50% faster', '#7ab8ff', 'rain');
        SZ.GameAudio.play('whoosh', { pitch: 0.6 });
        break;
      case WEATHER_SNOW:
        announce('Snowfall', 'Crops grow 20% slower while it snows', '#cfe8ff', 'snow');
        SZ.GameAudio.tone(1320, 0.4, 'sine', 0.04);
        SZ.GameAudio.tone(1760, 0.5, 'sine', 0.03, 0.15);
        break;
      case WEATHER_DUST:
        announce('Dust storm', 'Crops grow 25% slower, solar panels are blinded', '#e0b878', 'dust');
        SZ.GameAudio.noise(1.2, 0.08, 'bandpass', 300, 900);
        break;
      case WEATHER_THUNDERSTORM:
        announce('Thunderstorm!', 'Double growth, but lightning may strike', '#c8b0ff', 'storm');
        strikeTimer = 0.8;
        SZ.GameAudio.play('thud', { pitch: 0.7 });
        break;
      case WEATHER_METEOR_SHOWER: {
        announce('Meteor shower!', 'Unprotected crops may be smashed', '#ff7a4a', 'meteor');
        SZ.GameAudio.play('whoosh', { pitch: 0.5 });
        // the same odds as before, but each hit is a visible meteor
        const resist = getWeatherResistance();
        const span = WEATHER_DURATION - 1.5;
        for (let r = 0; r < G.gridRows; ++r)
          for (let c = 0; c < G.gridCols; ++c) {
            const cell = G.farmGrid[r][c];
            if (!cell) continue;
            const crop = CROPS[cell.cropIndex];
            if (crop.weatherAffinity === 'any' || isSheltered(r, c)) continue;
            const chance = (crop.weatherAffinity === 'cold-vulnerable' ? 0.4 : 0.2) * (1 - resist);
            if (Math.random() < chance) {
              const p = tileCenter(c, r);
              G.meteors.push({ wx: p.x, wy: p.y, r, c, delay: Math.random() * span, t: 0, smash: true });
            }
          }
        const strays = 6 + Math.floor(Math.random() * 6);
        for (let i = 0; i < strays; ++i) {
          const wx = GRID_OFFSET_X + (Math.random() * (G.gridCols + 6) - 3) * BASE_TILE_SIZE;
          const wy = GRID_OFFSET_Y + (Math.random() * (G.gridRows + 4) - 1) * BASE_TILE_SIZE;
          G.meteors.push({ wx, wy, r: -1, c: -1, delay: Math.random() * span, t: 0, smash: false });
        }
        break;
      }
    }
  }

  const METEOR_FLIGHT = 0.9;

  function updateMeteors(dt) {
    for (let i = G.meteors.length - 1; i >= 0; --i) {
      const m = G.meteors[i];
      if (m.delay > 0) {
        m.delay -= dt;
        continue;
      }
      m.t += dt;
      if (m.t >= METEOR_FLIGHT) {
        G.meteors.splice(i, 1);
        meteorImpact(m);
      }
    }
  }

  function meteorImpact(m) {
    particles.burst(m.wx, m.wy, 14, { color: '#ffb048', speed: 4, life: 0.6, gravity: 0.08 });
    particles.burst(m.wx, m.wy, 8, { color: '#6a5040', speed: 2.5, life: 0.8, gravity: 0.12 });
    G.decals.push({ wx: m.wx, wy: m.wy, t: 0, life: 22, kind: 'crater' });
    screenShake.trigger(m.smash ? 5 : 2.5, 200);
    SZ.GameAudio.play('smallExplode', { volume: m.smash ? 0.9 : 0.5, pitch: 0.8 + Math.random() * 0.4 });
    if (techOwned('sci_meteor')) {
      const gain = 8 + Math.floor(Math.random() * 10);
      G.credits += gain;
      popText(m.wx, m.wy - 32, `+${gain} stardust`, { color: '#d8c0ff', font: 'bold 12px' });
      const u = worldToUI(m.wx, m.wy);
      flyCoins(1, u.x, u.y, { size: 16 });
    }
    if (m.smash && G.farmGrid[m.r]?.[m.c] && !isSheltered(m.r, m.c)) {
      G.farmGrid[m.r][m.c] = null;
      popText(m.wx, m.wy - 16, 'Smashed!', { color: '#ff8a5a', font: 'bold 12px' });
      particles.burst(m.wx, m.wy, 10, { color: '#7ad04a', speed: 3, life: 0.5 });
    }
  }

  /* Picks a strike point: mostly the field, sometimes the meadow or a pen */
  function strikeLightning() {
    const resist = getWeatherResistance();
    let wx, wy;
    const roll = Math.random();
    if (roll < 0.08 && G.livestockPens.length) {
      const i = Math.floor(Math.random() * G.livestockPens.length);
      const pen = G.livestockPens[i];
      ({ x: wx, y: wy } = penCenter(pen));
      if (Math.random() < 0.5 * (1 - resist)) {
        popText(wx, wy - 18, `${LIVESTOCK[pen.typeIndex].name} ran off!`, { color: UI.bad, font: 'bold 12px' });
        G.livestockPens.splice(i, 1);
        ++G.penVersion;
      }
    } else if (roll < 0.55) {
      const r = Math.floor(Math.random() * G.gridRows), c = Math.floor(Math.random() * G.gridCols);
      ({ x: wx, y: wy } = tileCenter(c, r));
      wx += (Math.random() - 0.5) * 20;
      const cell = G.farmGrid[r][c];
      if (cell && CROPS[cell.cropIndex].weatherAffinity !== 'any' && !isSheltered(r, c) && !G.buildings[r][c] && Math.random() < 0.5 * (1 - resist)) {
        G.farmGrid[r][c] = null;
        popText(wx, wy - 16, 'Scorched!', { color: '#ffd75a', font: 'bold 12px' });
        particles.burst(wx, wy, 10, { color: '#ffd23f', speed: 3, life: 0.4 });
      }
    } else {
      wx = GRID_OFFSET_X + (Math.random() * (G.gridCols + 6) - 3) * BASE_TILE_SIZE;
      wy = GRID_OFFSET_Y + (Math.random() * (G.gridRows + 3) - 1) * BASE_TILE_SIZE;
    }
    // jagged bolt from the clouds (screen top) to the strike point
    const sx = G.viewPanX + wx * G.viewZoom, sy = G.viewPanY + wy * G.viewZoom;
    const pts = [[sx + (Math.random() - 0.5) * 120, -10]];
    const n = 9;
    for (let i = 1; i < n; ++i) {
      const k = i / n;
      pts.push([pts[0][0] + (sx - pts[0][0]) * k + (Math.random() - 0.5) * 40, -10 + (sy + 10) * k]);
    }
    pts.push([sx, sy]);
    G.bolts.push({ pts, t: 0, wx, wy });
    G.flashA = 0.55;
    G.decals.push({ wx, wy, t: 0, life: 12, kind: 'scorch' });
    particles.burst(wx, wy, 12, { color: '#e0f0ff', speed: 3.5, life: 0.35 });
    screenShake.trigger(4, 250);
    SZ.GameAudio.play('zap', { pitch: 0.7 });
    SZ.GameAudio.noise(1.1, 0.16, 'lowpass', 420, 60, 0.18);
  }

  /* Visual weather state eases in and out instead of switching hard */
  function updateWeatherVisuals(dt) {
    if (G.weatherType !== WEATHER_NONE && G.wxShown !== G.weatherType) {
      if (G.wxK < 0.05 || G.wxShown === WEATHER_NONE) {
        G.wxShown = G.weatherType;
        G.wxDrops = [];
      } else
        G.wxK = Math.max(0, G.wxK - dt * 1.5);
    }
    const target = G.weatherType !== WEATHER_NONE && G.wxShown === G.weatherType ? 1 : 0;
    G.wxK += (target - G.wxK) * Math.min(1, dt * 1.2);
    if (G.wxK < 0.01 && G.weatherType === WEATHER_NONE)
      G.wxShown = WEATHER_NONE;
    G.flashA = Math.max(0, G.flashA - dt * 2.2);
    for (let i = G.bolts.length - 1; i >= 0; --i) {
      G.bolts[i].t += dt;
      if (G.bolts[i].t > 0.35) G.bolts.splice(i, 1);
    }
    for (let i = G.decals.length - 1; i >= 0; --i) {
      G.decals[i].t += dt;
      if (G.decals[i].t > G.decals[i].life) G.decals.splice(i, 1);
    }
    for (let i = G.splashes.length - 1; i >= 0; --i) {
      G.splashes[i].t += dt;
      if (G.splashes[i].t > 0.45) G.splashes.splice(i, 1);
    }
    // falling drops, flakes and dust in screen space
    const area = G.canvasW * G.canvasH / (1000 * 700);
    const want = {
      [WEATHER_RAIN]: 160, [WEATHER_THUNDERSTORM]: 260, [WEATHER_SNOW]: 180, [WEATHER_DUST]: 140, [WEATHER_SOLAR_FLARE]: 40, [WEATHER_METEOR_SHOWER]: 0
    }[G.wxShown] || 0;
    const count = Math.round(want * area * G.wxK * (G.lowQuality ? 0.55 : 1));
    while (G.wxDrops.length < count)
      G.wxDrops.push(newDrop(G.wxShown, true));
    if (G.wxDrops.length > count)
      G.wxDrops.length = count;
    const wind = windStrength();
    for (let i = 0; i < G.wxDrops.length; ++i) {
      const d = G.wxDrops[i];
      d.x += d.vx * dt * (G.wxShown === WEATHER_DUST ? 1 : 0.6 + wind * 0.2);
      d.y += d.vy * dt;
      d.t += dt;
      if (G.wxShown === WEATHER_SNOW)
        d.x += Math.sin(d.t * 1.5 + d.ph) * 18 * dt;
      if (d.y > d.floor || d.x < -40 || d.x > G.canvasW + 40 || d.t > d.life) {
        if ((G.wxShown === WEATHER_RAIN || G.wxShown === WEATHER_THUNDERSTORM) && d.y > d.floor && Math.random() < 0.35) {
          const wx = (d.x - G.viewPanX) / G.viewZoom, wy = (d.y - G.viewPanY) / G.viewZoom;
          if (wy > horizonWorldY())
            G.splashes.push({ wx, wy, t: 0 });
        }
        G.wxDrops[i] = newDrop(G.wxShown, false);
      }
    }
  }

  function newDrop(kind, anywhere) {
    const d = { x: Math.random() * (G.canvasW + 80) - 40, y: anywhere ? Math.random() * G.canvasH : -10 - Math.random() * 40, t: 0, ph: Math.random() * TWO_PI, life: 20 };
    d.floor = G.canvasH * (0.35 + Math.random() * 0.7);
    switch (kind) {
      case WEATHER_RAIN:
      case WEATHER_THUNDERSTORM:
        d.vx = -60 - Math.random() * 40 - (kind === WEATHER_THUNDERSTORM ? 80 : 0);
        d.vy = 520 + Math.random() * 220;
        d.len = 10 + Math.random() * 10;
        break;
      case WEATHER_SNOW:
        d.vx = -10 - Math.random() * 20;
        d.vy = 40 + Math.random() * 50;
        d.size = 1.5 + Math.random() * 2.5;
        d.floor = G.canvasH + 10;
        break;
      case WEATHER_DUST:
        d.x = anywhere ? d.x : -30;
        d.y = Math.random() * G.canvasH;
        d.vx = 260 + Math.random() * 260;
        d.vy = (Math.random() - 0.5) * 40;
        d.size = 1 + Math.random() * 3;
        d.floor = G.canvasH + 10;
        break;
      default:
        d.vx = (Math.random() - 0.5) * 20;
        d.vy = -20 - Math.random() * 20;
        d.y = anywhere ? Math.random() * G.canvasH : G.canvasH + 10;
        d.floor = G.canvasH + 40;
        d.life = 4 + Math.random() * 4;
        d.size = 2 + Math.random() * 3;
    }
    return d;
  }

  /* Screen-space weather on top of the farm */

  function resetWeatherVisuals() {
    G.meteors = [];
    G.bolts = [];
    G.decals = [];
    G.splashes = [];
    G.wxDrops = [];
    G.wxK = 0;
    G.flashA = 0;
    G.wxShown = WEATHER_NONE;
  }

  function windStrength() {
    switch (G.weatherType) {
      case WEATHER_THUNDERSTORM: return 3;
      case WEATHER_RAIN: return 1.8;
      case WEATHER_METEOR_SHOWER: return 1.4;
      case WEATHER_DUST: return 2.6;
      case WEATHER_SNOW: return 1.3;
      default: return G.currentSeason === 2 ? 1.5 : 1;
    }
  }

  Object.assign(NS, { canCallRain, callRain, updateWeather, forecastWeather, METEOR_FLIGHT,
    updateWeatherVisuals, resetWeatherVisuals, windStrength });

})();
