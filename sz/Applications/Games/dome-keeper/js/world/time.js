;(function() {
  'use strict';

  // World time: day and night, sun and moon, sky light and the nightly attacks.
  // Owns: NS.time and these state fields:
  //   G.world, G.banners
  // Reads: constants, util, dom, sprites, fxArt, textLayout, panels, rules, persistence, weather, waves,
  //   artifacts
  // Reads state of: dom, gameState, weather, waves

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, TWO_PI, STATE_PLAYING, STATE_PAUSED } = NS.constants;
  const { hexToRgba } = NS.util;
  const { ctx, particles } = NS.dom;
  const { drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { fitText } = NS.textLayout;
  const { UI, roundRectPath, drawPanel, drawMeter, drawChip } = NS.panels;
  const { DOME_Y } = NS.rules;
  const { saveRun } = NS.persistence;

  /* ======================================================================
     WORLD TIME -- day and night, sun and moon, nightly attacks
     ====================================================================== */

  const DAY_LENGTH = 160;            // seconds for a full day and night
  const DUSK_WARNING = 15;           // seconds of warning before nightfall
  const MOON_PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  // t: 0 = sunrise .. dayFraction() = nightfall .. 1 = next sunrise
  G.world = { day: 1, t: 0.03, bursts: 0, warned: false };
  G.banners = [];                  // announcements: { title, sub, color, icon, age }

  function newWorld() {
    return { day: 1, t: 0.03, bursts: 0, warned: false };
  }

  // Share of the cycle that is daylight (long summer days, short winter days)
  function dayFraction() {
    return NS.weather.currentSeason().dayFraction;
  }

  function moonPhaseIndex(day) {
    return ((day - 1) % 8 + 8) % 8;
  }

  // Night strength from the moon: 0.8 at new moon .. 1.25 at full moon
  function moonStrength(day) {
    return 0.8 + 0.45 * (1 - Math.abs(moonPhaseIndex(day) - 4) / 4);
  }

  function isNight() {
    return G.world.t >= dayFraction();
  }

  function secondsToNight() {
    return Math.max(0, (dayFraction() - G.world.t) * DAY_LENGTH);
  }

  function secondsToDawn() {
    return Math.max(0, (1 - G.world.t) * DAY_LENGTH);
  }

  function smoothstep(a, b, x) {
    const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  }

  function computeSkyLight() {
    const f = dayFraction(), t = G.world.t, edge = 0.05;
    G.daylight = t < f ? smoothstep(0, edge, t) * (1 - smoothstep(f - edge, f, t)) : 0;
    // Glow straddles sunrise (t = 0, wrapping) and sunset (t = f)
    const dist = Math.min(Math.abs(t - (f - 0.01)), Math.abs(t - 0.015), Math.abs(t - 1.015));
    G.duskGlow = Math.max(0, 1 - dist / 0.07) * 0.85;
  }

  // Centre-top announcement panel (one at a time, queued)
  function announce(title, sub, color, icon) {
    if (G.banners.length > 4) G.banners.shift();
    G.banners.push({ title, sub: sub || '', color: color || UI.gold, icon: icon || null, age: 0 });
  }

  function startNight() {
    G.world.bursts = 1;
    G.lastStandUsed = false;
    const phase = MOON_PHASES[moonPhaseIndex(G.world.day)];
    const strength = moonStrength(G.world.day);
    NS.waves.spawnWave(false);
    const threat = Math.max(1, NS.waves.threatLevel());
    let sub = phase + (strength > 1.1 ? ' - the swarm is restless' : (strength < 0.9 ? ' - a quiet night' : ''));
    sub += ` · threat ${threat}` + (G.lastNightElites ? ` · ${G.lastNightElites} elite${G.lastNightElites > 1 ? 's' : ''}` : '');
    announce(`Night ${G.world.day}`, sub, '#9ab8ff', 'moon');
    SZ.GameAudio.tone(196, 0.5, 'triangle', 0.12);
    SZ.GameAudio.tone(147, 0.8, 'triangle', 0.12, 0.35);
  }

  function startDay() {
    NS.artifacts.artifactDawn();
    if ((G.world.day - 1) % NS.weather.SEASON_DAYS === 0)
      NS.weather.seasonBegins();
    else
      announce(`Day ${G.world.day}`, 'Sunrise - monsters left in the open burn away', '#ffd75a', 'sun');
    SZ.GameAudio.play('levelup', { pitch: 1.15, volume: 0.8 });
    saveRun();
  }

  function updateWorldTime(dt) {
    const f = dayFraction();
    const before = G.world.t;
    G.world.t += dt / DAY_LENGTH;
    if (!G.world.warned && before < f && (f - G.world.t) * DAY_LENGTH <= DUSK_WARNING) {
      G.world.warned = true;
      announce('Dusk is coming', `Night falls in ${DUSK_WARNING} s - get back to the dome!`, '#ff9a50', 'sun');
      SZ.GameAudio.tone(330, 0.25, 'square', 0.07);
      SZ.GameAudio.tone(262, 0.4, 'square', 0.07, 0.25);
    }
    if (before < f && G.world.t >= f)
      startNight();
    if (G.world.t >= f) {
      const nightPos = (G.world.t - f) / (1 - f);
      if (G.world.bursts === 1 && nightPos >= 0.4) {
        G.world.bursts = 2;
        NS.waves.spawnWave(true);
      } else if (G.world.bursts === 2 && nightPos >= 0.72) {
        G.world.bursts = 3;
        NS.waves.spawnWave(true);
      }
    }
    if (G.world.t >= 1) {
      G.world.t -= 1;
      ++G.world.day;
      G.world.bursts = 0;
      G.world.warned = false;
      startDay();
    }
    computeSkyLight();
    // Sunlight burns the monsters still out in the open (bosses resist)
    if (G.daylight > 0.3)
      for (const e of G.enemies) {
        if (e.boss) continue;
        e.hp -= e.maxHP * 0.07 * G.daylight * dt;
        if (Math.random() < dt * 6)
          particles.trail(e.x + (Math.random() - 0.5) * (e.size || 16), e.y - (e.size || 16) * 0.5, { vx: (Math.random() - 0.5) * 0.6, vy: -1.2, color: Math.random() < 0.5 ? '#ffb040' : '#706060', life: 0.5, size: 2, gravity: -0.02 });
      }
    // The current banner ages; a queue behind it shortens its stay
    if (G.banners.length) {
      const b = G.banners[0];
      b.age += dt;
      b.life = G.banners.length > 1 ? Math.min(b.life || 3.6, Math.max(1.6, b.age + 0.5)) : (b.life || 3.6);
      if (b.age > b.life)
        G.banners.shift();
    }
  }

  // Path of the lit part of the moon for a phase index (0 new .. 4 full .. 7)
  function moonLitPath(cx, cy, R, phaseIdx) {
    const p = phaseIdx / 8;
    const k = Math.cos(p * TWO_PI);
    ctx.beginPath();
    if (p < 0.5) {
      ctx.arc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false);
      ctx.ellipse(cx, cy, R * Math.abs(k), R, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    } else {
      ctx.arc(cx, cy, R, Math.PI / 2, Math.PI * 1.5, false);
      ctx.ellipse(cx, cy, R * Math.abs(k), R, 0, -Math.PI / 2, Math.PI / 2, k > 0);
    }
    ctx.closePath();
  }

  function drawMoonDisc(cx, cy, R, phaseIdx, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    // Earthshine on the dark side
    ctx.fillStyle = 'rgba(70,84,120,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.fill();
    if (phaseIdx !== 0) {
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#fbfcff');
      g.addColorStop(0.7, '#cfd8ee');
      g.addColorStop(1, '#8e9ac0');
      moonLitPath(cx, cy, R, phaseIdx);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(90,100,140,0.32)';
      for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.1, -0.35, 0.1], [-0.15, 0.4, 0.12], [0.4, -0.05, 0.09]]) {
        ctx.beginPath();
        ctx.arc(cx + dx * R, cy + dy * R, r * R, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(200,215,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  function drawSunDisc(x, y, R, low, alpha) {
    drawGlow(low > 0.5 ? '#ff9a50' : '#fff0b0', x, y, R * 5, 0.55 * alpha);
    drawGlow('#ffffff', x, y, R * 2.2, 0.5 * alpha);
    ctx.save();
    ctx.globalAlpha *= alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, low > 0.5 ? '#ffd080' : '#fff6c8');
    g.addColorStop(1, low > 0.5 ? '#ff9040' : '#ffe080');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // Position on the sky arc for progress u (0 rising at the left .. 1 setting at the right)
  function skyArc(u) {
    return { x: 70 + u * (CANVAS_W - 140), y: DOME_Y + 40 - Math.sin(Math.max(0, Math.min(1, u)) * Math.PI) * (DOME_Y - 170) };
  }

  function drawCelestials() {
    const f = dayFraction(), t = G.world.t;
    if (t < f + 0.02) {
      const u = t / f;
      const p = skyArc(u);
      drawSunDisc(p.x, p.y, 34, 1 - Math.sin(Math.max(0, Math.min(1, u)) * Math.PI), Math.min(1, G.daylight + G.duskGlow));
    }
    if (t > f - 0.03) {
      const u = (t - f) / (1 - f);
      const p = skyArc(u);
      const ph = moonPhaseIndex(G.world.day);
      const a = 1 - G.daylight;
      drawGlow('#c8d8ff', p.x, p.y, 120, (0.12 + 0.3 * (1 - Math.abs(ph - 4) / 4)) * a);
      drawMoonDisc(p.x, p.y, 30, ph, a);
    }
  }

  // Small sun or moon icon for HUD rows
  function drawTimeIcon(x, y, size, night) {
    if (night)
      drawMoonDisc(x, y, size / 2, Math.max(1, moonPhaseIndex(G.world.day)), 1);
    else {
      ctx.save();
      ctx.strokeStyle = '#ffd060';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; ++i) {
        const a = i * Math.PI / 4 + G.animTime * 0.3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * size * 0.42, y + Math.sin(a) * size * 0.42);
        ctx.lineTo(x + Math.cos(a) * size * 0.6, y + Math.sin(a) * size * 0.6);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, size * 0.34);
      g.addColorStop(0, '#fff8d0');
      g.addColorStop(1, '#ffb020');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.34, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBanner() {
    const b = G.banners[0];
    if (!b || (G.state !== STATE_PLAYING && G.state !== STATE_PAUSED)) return;
    const inA = Math.min(1, b.age / 0.35), outA = Math.min(1, ((b.life || 3.6) - b.age) / 0.5);
    const a = Math.max(0, Math.min(inA, outA));
    if (a <= 0) return;
    const w = 600, h = 76, x = CANVAS_W / 2 - w / 2, y = 108 - (1 - inA) * 20;
    ctx.save();
    ctx.globalAlpha = a;
    drawPanel(x, y, w, h, { accent: b.color, radius: 14, glow: true });
    if (b.icon === 'moon' || b.icon === 'sun')
      drawTimeIcon(x + 42, y + h / 2, 40, b.icon === 'moon');
    else if (b.icon)
      drawSprite(b.icon, x + 42, y + h / 2, 40);
    const tx = x + (b.icon ? 78 : 24), tw = w - (b.icon ? 78 : 24) - 20;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(b.title, tx, y + 26, tw, 26, { weight: 'bold', color: b.color });
    fitText(b.sub, tx, y + 54, tw, 17, { color: UI.text });
    ctx.restore();
  }

  // Day, time and moon (top left on the surface)
  function drawClockPanel() {
    const x = 16, y = 16, w = 330, h = 112;
    const night = isNight();
    const warn = !night && secondsToNight() <= DUSK_WARNING;
    drawPanel(x, y, w, h, { accent: night ? '#7a9aff' : (warn ? '#ff8a50' : '#ffc860') });
    // Dial: sky disc with the sun or moon
    const dx = x + 38, dy = y + 40;
    const sg = ctx.createLinearGradient(0, dy - 24, 0, dy + 24);
    sg.addColorStop(0, night ? '#0a1030' : '#3a7ad0');
    sg.addColorStop(1, night ? '#2a2050' : (G.duskGlow > 0.3 ? '#ff9a60' : '#a8d0f0'));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(dx, dy, 24, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawTimeIcon(dx, dy, 30, night);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(`Day ${G.world.day}`, x + 72, y + 28, 110, 24, { weight: 'bold', color: UI.text });
    const season = NS.weather.currentSeason();
    const dayInSeason = (G.world.day - 1) % NS.weather.SEASON_DAYS + 1;
    drawChip(`${season.name} ${dayInSeason}/${NS.weather.SEASON_DAYS}`, x + w - 12, y + 16, 24, { align: 'right', px: 14, maxW: 140, bg: hexToRgba(season.color, 0.16), border: hexToRgba(season.color, 0.55), color: season.color });
    ctx.textAlign = 'left';
    if (night) {
      const left = G.enemies.length;
      fitText(left ? `${left} ${left === 1 ? 'monster' : 'monsters'} attacking` : 'The night is quiet...', x + 72, y + 55, w - 86, 16, { weight: 'bold', color: left ? '#ff8a7a' : UI.textDim });
      ctx.textAlign = 'right';
      fitText(`dawn ${Math.ceil(secondsToDawn())}s`, x + w - 14, y + 55, 90, 14, { color: UI.textDim });
      drawMeter(x + 72, y + 72, w - 86, 10, (G.world.t - dayFraction()) / (1 - dayFraction()), '#7a9aff');
    } else {
      const sec = Math.ceil(secondsToNight());
      const pulse = warn ? 0.6 + Math.sin(G.animTime * 8) * 0.4 : 1;
      fitText(warn ? 'Get to the dome!' : 'Daytime: mine and build', x + 72, y + 55, w - 86 - 70, 16, { weight: 'bold', color: warn ? `rgba(255,140,80,${pulse})` : UI.textDim });
      ctx.textAlign = 'right';
      fitText(`${sec}s`, x + w - 14, y + 55, 64, 18, { weight: 'bold', color: warn ? '#ff9a50' : '#ffc870' });
      drawMeter(x + 72, y + 72, w - 86, 10, G.world.t / dayFraction(), warn ? '#ff7a40' : '#ffc040');
    }
    // Moon phase and weather
    const ph = moonPhaseIndex(G.world.day);
    drawMoonDisc(x + 22, y + 96, 7, Math.max(1, ph), ph === 0 ? 0.5 : 1);
    ctx.textAlign = 'left';
    fitText(MOON_PHASES[ph], x + 36, y + 97, 130, 14, { color: '#b8c8ff' });
    const wk = NS.weather.WEATHER[G.weather.kind];
    ctx.textAlign = 'right';
    const ww = fitText(wk.name.replace('!', ''), x + w - 14, y + 97, 130, 14, { weight: 'bold', color: wk.color });
    if (wk.icon)
      drawSprite(wk.icon, x + w - 26 - ww, y + 96, 16);
    else
      drawTimeIcon(x + w - 26 - ww, y + 96, 14, false);
  }

  // Time line inside the mine's cargo panel
  function drawMineClock(x, y, w) {
    const night = isNight();
    const warn = night || secondsToNight() <= DUSK_WARNING;
    const text = night
      ? `Night ${G.world.day}: ${G.enemies.length} at the dome`
      : `Day ${G.world.day}: night in ${Math.ceil(secondsToNight())}s`;
    if (warn) {
      roundRectPath(x - 4, y - 13, w + 8, 26, 8);
      ctx.fillStyle = `rgba(120,30,20,${0.45 + Math.sin(G.animTime * 6) * 0.2})`;
      ctx.fill();
    }
    drawTimeIcon(x + 9, y, 18, night);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(text, x + 24, y + 1, w - 24, 15, { weight: 'bold', color: warn ? '#ffb0a0' : UI.text });
  }

  NS.time = { newWorld, moonStrength, isNight, secondsToNight, smoothstep, computeSkyLight, announce,
    updateWorldTime, drawCelestials, drawBanner, drawClockPanel, drawMineClock };
})();
