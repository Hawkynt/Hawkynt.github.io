/* Space Farming - night lighting (darkness with light holes from lamps and glowing things) and
   seasonal ambience particles (petals, fireflies, leaves, snow).
   Owns: G.lowQuality
   Reads: G.canvasW, G.canvasH, G.weatherType, G.currentSeason, G.viewZoom, G.viewPanX, G.viewPanY */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, WEATHER_RAIN, WEATHER_THUNDERSTORM, ctx, nightAmount, glowSprite, drawGlow, horizonWorldY,
    windStrength } = NS;

  /* ── Lighting: the night darkens the world, lamps and glowing things cut holes ── */

  let lightCanvas = null, lightCtx = null;
  let lights = [];

  function lightAt(wx, wy, radius, color, strength) {
    lights.push({ wx, wy, radius, color, strength });
  }

  function drawLighting() {
    const n = nightAmount();
    const storm = G.weatherType === WEATHER_THUNDERSTORM ? 0.25 : (G.weatherType === WEATHER_RAIN ? 0.12 : 0);
    const dark = Math.min(0.62, n * 0.55 + storm);
    if (dark <= 0.01) {
      lights = [];
      return;
    }
    // the mask is smooth, so a quarter-size canvas is plenty
    const div = G.lowQuality ? 3 : 2;
    const W = Math.ceil(G.canvasW / div), H = Math.ceil(G.canvasH / div);
    if (!lightCanvas) {
      lightCanvas = document.createElement('canvas');
      lightCtx = lightCanvas.getContext('2d');
    }
    if (lightCanvas.width !== W || lightCanvas.height !== H) {
      lightCanvas.width = W;
      lightCanvas.height = H;
    }
    const L = lightCtx;
    const white = glowSprite('#ffffff');
    L.globalCompositeOperation = 'source-over';
    L.globalAlpha = 1;
    L.clearRect(0, 0, W, H);
    L.fillStyle = `rgba(8,12,40,${dark})`;
    L.fillRect(0, 0, W, H);
    L.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const sx = (G.viewPanX + l.wx * G.viewZoom) / div, sy = (G.viewPanY + l.wy * G.viewZoom) / div;
      const rr = l.radius * G.viewZoom / div;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > W || sy - rr > H) continue;
      L.globalAlpha = Math.min(1, l.strength);
      L.drawImage(white, sx - rr, sy - rr, rr * 2, rr * 2);
    }
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'source-over';
    // the horizon sky is lit by its own colours
    const hy = (G.viewPanY + horizonWorldY() * G.viewZoom) / div;
    if (hy > 0)
      L.clearRect(0, 0, W, hy);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lightCanvas, 0, 0, G.canvasW, G.canvasH);
    ctx.imageSmoothingEnabled = true;
    // warm colour glow on top
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const sx = G.viewPanX + l.wx * G.viewZoom, sy = G.viewPanY + l.wy * G.viewZoom;
      const rr = l.radius * G.viewZoom * 0.8;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > G.canvasW || sy - rr > G.canvasH) continue;
      drawGlow(sx, sy, rr, l.color, 0.22 * dark * l.strength);
    }
    ctx.restore();
    lights = [];
  }

  /* ── Seasonal ambience: petals, fireflies, leaves, snow ── */

  const ambient = [];

  function updateAmbient(dt) {
    const season = G.currentSeason;
    const night = nightAmount();
    const want = Math.round((season === 1 ? Math.round(18 * night) + 6 : (season === 3 ? 70 : 26)) * (G.lowQuality ? 0.5 : 1));
    while (ambient.length < want)
      ambient.push(spawnAmbient(season, true));
    if (ambient.length > want)
      ambient.length = want;
    const wind = windStrength();
    for (let i = 0; i < ambient.length; ++i) {
      const a = ambient[i];
      if (a.season !== season) {
        ambient[i] = spawnAmbient(season, false);
        continue;
      }
      a.t += dt;
      a.x += (a.vx + Math.sin(a.t * a.wob + a.ph) * a.sway) * dt * (0.6 + wind * 0.4);
      a.y += a.vy * dt;
      if (a.kind === 'firefly') {
        a.x += Math.sin(a.t * 1.3 + a.ph) * 8 * dt;
        a.y += Math.cos(a.t * 1.7 + a.ph) * 8 * dt;
      }
      if (a.y > G.canvasH + 10 || a.x < -20 || a.x > G.canvasW + 20 || a.t > a.life)
        ambient[i] = spawnAmbient(season, false);
    }
  }

  function spawnAmbient(season, anywhere) {
    const kinds = ['petal', 'firefly', 'leaf', 'snow'];
    const kind = season === 1 ? (Math.random() < 0.7 ? 'firefly' : 'mote') : kinds[season];
    const a = {
      kind, season, t: 0, ph: Math.random() * TWO_PI, wob: 1 + Math.random() * 2,
      x: Math.random() * G.canvasW, y: anywhere ? Math.random() * G.canvasH : -10,
      vx: 10 + Math.random() * 20, vy: 14 + Math.random() * 18, sway: 20 + Math.random() * 20,
      life: 30, size: 2 + Math.random() * 2, spin: Math.random() * TWO_PI
    };
    if (kind === 'firefly' || kind === 'mote') {
      a.vx = (Math.random() - 0.5) * 6;
      a.vy = (Math.random() - 0.5) * 4;
      a.y = Math.random() * G.canvasH;
      a.life = 6 + Math.random() * 6;
      a.sway = 4;
    } else if (kind === 'snow') {
      a.vx = -8 + Math.random() * 10;
      a.vy = 18 + Math.random() * 26;
      a.size = 1.5 + Math.random() * 2;
    } else if (kind === 'leaf') {
      a.colour = ['#ff7a2a', '#e23b3b', '#ffb648', '#c87a2a'][Math.floor(Math.random() * 4)];
    } else
      a.colour = ['#ffb0d8', '#ffffff', '#e0b0ff'][Math.floor(Math.random() * 3)];
    return a;
  }

  function drawAmbient() {
    const night = nightAmount();
    ctx.save();
    for (const a of ambient) {
      const fade = Math.min(1, a.t * 2, (a.life - a.t) * 2);
      if (a.kind === 'firefly') {
        const blink = 0.5 + 0.5 * Math.sin(a.t * 3 + a.ph);
        ctx.globalAlpha = night * fade * blink * 0.9;
        ctx.drawImage(glowSprite('#e6ff78'), a.x - 7, a.y - 7, 14, 14);
      } else if (a.kind === 'mote') {
        ctx.globalAlpha = (1 - night) * fade * 0.5;
        ctx.fillStyle = '#fff4c0';
        ctx.fillRect(a.x, a.y, 2, 2);
      } else if (a.kind === 'snow') {
        ctx.globalAlpha = 0.85 * fade;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.size, 0, TWO_PI);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillStyle = a.colour;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.spin + a.t * 2);
        ctx.scale(1, Math.abs(Math.sin(a.t * 3 + a.ph)) * 0.7 + 0.3);
        ctx.fillRect(-a.size, -a.size * 0.6, a.size * 2, a.size * 1.2);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  Object.assign(NS, { lightAt, drawLighting, updateAmbient, drawAmbient });

})();
