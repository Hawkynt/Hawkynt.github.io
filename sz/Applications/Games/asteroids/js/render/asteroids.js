/* Asteroid rendering: the jittered polygon path plus per-rock-type surface
   treatment (iron shimmer, crystal facets, exploding glow, ice frost, lava
   cracks, electric crackling), craters, damage cracks, hit flash and HP pips. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const S = NS.state;
  const ctx = NS.dom.ctx;

  function buildAsteroidPath(a) {
    ctx.beginPath();
    for (let i = 0; i < a.shape.length; ++i) {
      const v = a.shape[i];
      const r = a.radius * v.jitter;
      const px = Math.cos(v.angle) * r;
      const py = Math.sin(v.angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawAsteroid(a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rotation);

    buildAsteroidPath(a);

    /* Gradient fill */
    const grad = ctx.createRadialGradient(
      -a.radius * 0.25, -a.radius * 0.25, a.radius * 0.1,
      0, 0, a.radius
    );
    grad.addColorStop(0, a.palette.light);
    grad.addColorStop(1, a.palette.dark);
    ctx.fillStyle = grad;
    ctx.fill();

    /* Edge */
    ctx.strokeStyle = a.palette.edge;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    /* Iron shimmer */
    if (a.rockType === 'iron') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const shimmerAngle = S.gameTime / 1000 * 0.5 + a.rotation;
      const sx = Math.cos(shimmerAngle) * a.radius * 0.3;
      const sy = Math.sin(shimmerAngle) * a.radius * 0.3;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, a.radius * 0.5);
      sg.addColorStop(0, 'rgba(200,200,220,0.25)');
      sg.addColorStop(1, 'rgba(200,200,220,0)');
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.restore();
    }

    /* Crystal glow + facets */
    if (a.rockType === 'crystal') {
      ctx.save();
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 6;
      buildAsteroidPath(a);
      ctx.strokeStyle = 'rgba(68,170,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      ctx.strokeStyle = 'rgba(100,180,255,0.12)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; ++i) {
        const fa = a.rotation * 0.5 + i * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(fa) * a.radius * 0.9, Math.sin(fa) * a.radius * 0.9);
        ctx.lineTo(Math.cos(fa + Math.PI) * a.radius * 0.9, Math.sin(fa + Math.PI) * a.radius * 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Exploding: pulsing inner glow + ember cracks */
    if (a.rockType === 'exploding') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const pulse = 0.3 + Math.sin(S.gameTime / 1000 * 4) * 0.2;
      const eg = ctx.createRadialGradient(0, 0, 0, 0, 0, a.radius * 0.8);
      eg.addColorStop(0, `rgba(255,100,0,${pulse})`);
      eg.addColorStop(0.5, `rgba(255,60,0,${pulse * 0.5})`);
      eg.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,150,50,${0.3 + pulse * 0.3})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; ++i) {
        const ca = a.rotation * 1.5 + i * Math.PI * 2 / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ca) * a.radius * 0.7, Math.sin(ca) * a.radius * 0.7);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Ice: frosted surface + specular highlight */
    if (a.rockType === 'ice') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const ig = ctx.createRadialGradient(-a.radius * 0.3, -a.radius * 0.3, 0, 0, 0, a.radius);
      ig.addColorStop(0, 'rgba(220,240,255,0.3)');
      ig.addColorStop(0.4, 'rgba(180,220,255,0.1)');
      ig.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = ig;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.shadowColor = '#88ddff';
      ctx.shadowBlur = 4;
      buildAsteroidPath(a);
      ctx.strokeStyle = 'rgba(150,220,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* Lava: glowing magma cracks */
    if (a.rockType === 'lava') {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const lavaGlow = 0.4 + Math.sin(S.gameTime / 1000 * 3 + a.rotation) * 0.2;
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = `rgba(255,100,0,${lavaGlow})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; ++i) {
        const ca = a.rotation * 0.8 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ca) * a.radius * 0.1, Math.sin(ca) * a.radius * 0.1);
        const segs = 3 + Math.floor(i * 1.3);
        let r = a.radius * 0.1, ang = ca;
        for (let j = 0; j < segs; ++j) {
          r += a.radius * 0.2;
          ang += (Math.sin(i + j) * 0.5);
          ctx.lineTo(Math.cos(ang) * Math.min(r, a.radius * 0.8), Math.sin(ang) * Math.min(r, a.radius * 0.8));
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* Electric: surface crackling */
    if (a.rockType === 'electric') {
      ctx.save();
      ctx.shadowColor = '#ffff66';
      ctx.shadowBlur = 6;
      buildAsteroidPath(a);
      ctx.strokeStyle = 'rgba(255,255,100,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,200,0.5)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 2; ++i) {
        const sa = NS.rules.randomAngle();
        ctx.beginPath();
        let px = Math.cos(sa) * a.radius * 0.2;
        let py = Math.sin(sa) * a.radius * 0.2;
        ctx.moveTo(px, py);
        for (let j = 0; j < 4; ++j) {
          px += (Math.random() - 0.5) * a.radius * 0.4;
          py += (Math.random() - 0.5) * a.radius * 0.4;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Craters */
    ctx.save();
    buildAsteroidPath(a);
    ctx.clip();
    for (const c of a.craters) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.9, -1, 0.5);
      ctx.stroke();
    }
    ctx.restore();

    /* Damage cracks */
    if (a.damageCracks.length > 0 && a.hp < a.maxHp) {
      ctx.save();
      buildAsteroidPath(a);
      ctx.clip();
      const dmgRatio = 1 - a.hp / a.maxHp;
      const isCrystal = a.rockType === 'crystal';
      ctx.strokeStyle = isCrystal
        ? `rgba(100,200,255,${0.4 + dmgRatio * 0.4})`
        : `rgba(255,200,100,${0.3 + dmgRatio * 0.5})`;
      ctx.lineWidth = 1 + dmgRatio;
      if (isCrystal) {
        ctx.shadowColor = '#44aaff';
        ctx.shadowBlur = 5 * dmgRatio;
      }
      for (const crack of a.damageCracks) {
        ctx.beginPath();
        for (let i = 0; i < crack.length; ++i) {
          const px = Math.cos(crack[i].a) * crack[i].r;
          const py = Math.sin(crack[i].a) * crack[i].r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Hit flash */
    if (a.hitFlash > 0) {
      buildAsteroidPath(a);
      ctx.globalAlpha = 0.4 * (a.hitFlash / 150);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    /* HP pips (world space) */
    if (a.maxHp > 1) {
      const pipY = a.y + a.radius + 6;
      const pipR = 2;
      const pipGap = 6;
      const totalW = (a.maxHp - 1) * pipGap;
      const startX = a.x - totalW / 2;
      for (let i = 0; i < a.maxHp; ++i) {
        ctx.fillStyle = i < a.hp ? a.palette.edge : 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(startX + i * pipGap, pipY, pipR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  Object.assign(NS.asteroidView, { buildAsteroidPath, drawAsteroid });
})();
