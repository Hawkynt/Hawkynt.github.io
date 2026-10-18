;(function() {
  'use strict';

  // Drawing precipitation, lightning, meteors, meteor ore and snow cover.
  // Owns: NS.weatherArt
  // Reads: constants, dom, sprites, fxArt, rules, weather, artifacts
  // Reads state of: dom, gameState, weather

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI } = NS.constants;
  const { ctx, particles } = NS.dom;
  const { SPRITE_OUTLINE, drawSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { currentSeason, windStrength } = NS.weather;

  // Precipitation, lightning, meteors and fog over the surface scene
  function drawWeather() {
    const k = G.weather.kind, I = G.weather.intensity;
    const wind = windStrength();
    // Clouds darken the scene while it rains, snows or storms
    const gloom = ({ rain: 0.22, storm: 0.38, blizzard: 0.2, snow: 0.1 }[k] || 0) * I;
    if (gloom > 0) {
      ctx.fillStyle = k === 'blizzard' || k === 'snow' ? `rgba(200,215,235,${gloom * 0.6})` : `rgba(10,16,30,${gloom})`;
      ctx.fillRect(0, 0, CANVAS_W, DOME_Y);
    }
    if (G.rainDrops.length) {
      ctx.strokeStyle = 'rgba(180,205,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of G.rainDrops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - wind * 0.18 * d.len, d.y - d.len);
      }
      ctx.stroke();
    }
    if (G.snowFlakes.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of G.snowFlakes)
        ctx.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s);
    }
    for (const l of G.leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.r);
      ctx.scale(1, Math.abs(Math.sin(l.p)) * 0.7 + 0.3);
      ctx.fillStyle = l.c;
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3, 0, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
    for (const m of G.meteors) {
      const x = m.x + (m.tx - m.x) * m.t, y = m.y + (m.ty - m.y) * m.t;
      const dx = (m.tx - m.x), dy = (m.ty - m.y), len = Math.hypot(dx, dy);
      const tx = x - dx / len * 140, ty = y - dy / len * 140;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(255,160,80,0)');
      g.addColorStop(1, 'rgba(255,220,160,0.9)');
      ctx.strokeStyle = g;
      ctx.lineWidth = m.size * 0.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.lineCap = 'butt';
      drawGlow('#ffa040', x, y, m.size * 5, 0.9);
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(x, y, m.size * 0.6, 0, TWO_PI);
      ctx.fill();
    }
    for (const b of G.bolts) {
      // Wide glow along the jagged path, then the crackling core
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (const [wdt, col] of [[16, `rgba(140,170,255,${Math.min(0.35, b.life)})`], [6, `rgba(220,230,255,${Math.min(0.8, b.life * 2)})`]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = wdt;
        ctx.beginPath();
        b.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
        ctx.stroke();
      }
      ctx.restore();
      const end = b.pts[b.pts.length - 1];
      drawGlow('#d8e0ff', end[0], end[1], 60, Math.min(1, b.life * 2));
      SZ.GameEffects.drawElectricArc(ctx, b.pts[0][0], b.pts[0][1], b.pts[b.pts.length - 1][0], b.pts[b.pts.length - 1][1], {
        segments: 10, jitter: 18, color: `rgba(255,255,230,${Math.min(1, b.life * 4)})`, glowColor: `rgba(160,190,255,${Math.min(1, b.life * 3)})`, width: 3, glowWidth: 12
      });
    }
    if (G.lightningFlash > 0) {
      ctx.fillStyle = `rgba(230,235,255,${G.lightningFlash * 0.35})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    // Blizzard fog: the far field disappears in white
    if (k === 'blizzard') {
      const fog = I * (NS.artifacts.hasArtifact('owlSight') ? 0.35 : 1);
      const g = ctx.createLinearGradient(0, 0, 0, DOME_Y);
      g.addColorStop(0, `rgba(225,235,248,${0.55 * fog})`);
      g.addColorStop(1, `rgba(225,235,248,${0.3 * fog})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    // Summer heat haze over the ground
    if (currentSeason().key === 'summer' && G.daylight > 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.08 * G.daylight;
      ctx.fillStyle = '#fff0c0';
      for (let i = 0; i < 6; ++i) {
        const y = DOME_Y - 70 + i * 12;
        ctx.fillRect(Math.sin(G.animTime * 2 + i) * 20 - 20, y, CANVAS_W + 40, 3);
      }
      ctx.restore();
    }
  }

  // Meteor ore lying on the ground (click to collect)
  function drawMeteorOre() {
    for (const o of G.meteorOre) {
      const pulse = 0.6 + Math.sin(G.animTime * 4 + o.x) * 0.3;
      drawGlow('#ffae60', o.x, o.y - 6, 40, pulse * 0.75);
      ctx.fillStyle = SPRITE_OUTLINE;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y - 4, 19, 13, 0, 0, TWO_PI);
      ctx.fill();
      const rg = ctx.createRadialGradient(o.x - 5, o.y - 10, 2, o.x, o.y - 4, 18);
      rg.addColorStop(0, '#8a6a5a');
      rg.addColorStop(1, '#3a2a24');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y - 5, 17, 11, 0, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,150,60,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(o.x - 12, o.y - 2);
      ctx.lineTo(o.x - 4, o.y - 7);
      ctx.lineTo(o.x + 3, o.y - 3);
      ctx.lineTo(o.x + 12, o.y - 8);
      ctx.stroke();
      drawSprite(o.type, o.x, o.y - 8, 20);
      if (Math.random() < 0.03)
        particles.sparkle(o.x + (Math.random() - 0.5) * 24, o.y - 8, 1, { color: '#ffd080', speed: 0.6 });
    }
  }

  function hitMeteorOre(mx, my) {
    for (const o of G.meteorOre)
      if (Math.abs(mx - o.x) < 22 && Math.abs(my - o.y) < 22)
        return o;
    return null;
  }

  // Snow lying on the ground line and on top of the dome
  function drawSnowCover() {
    if (G.snowCover <= 0.02) return;
    const a = Math.min(1, G.snowCover * 1.2);
    ctx.fillStyle = `rgba(244,250,255,${0.85 * a})`;
    ctx.beginPath();
    ctx.moveTo(0, DOME_Y + 4);
    for (let x = 0; x <= CANVAS_W; x += 20)
      ctx.lineTo(x, DOME_Y - G.snowCover * 6 - Math.abs(Math.sin(x * 0.05)) * 3 * G.snowCover);
    ctx.lineTo(CANVAS_W, DOME_Y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(230,240,255,${0.3 * a})`;
    ctx.fillRect(0, DOME_Y + 4, CANVAS_W, 30 * G.snowCover);
    // Cap on the dome
    ctx.save();
    ctx.beginPath();
    ctx.arc(DOME_X, DOME_Y, DOME_RADIUS + 3, Math.PI * 1.22, Math.PI * 1.78);
    ctx.lineWidth = 3 + G.snowCover * 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(248,252,255,${0.9 * a})`;
    ctx.stroke();
    ctx.restore();
  }

  NS.weatherArt = { drawWeather, drawMeteorOre, hitMeteorOre, drawSnowCover };
})();
