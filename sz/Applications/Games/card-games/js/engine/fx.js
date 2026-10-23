;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;

  /* ================================================================
   *  FIREWORK PARTICLES
   * ================================================================ */

  function spawnFirework(particles, x, y) {
    const count = 30 + Math.floor(Math.random() * 31);
    const color = CE.FIREWORK_COLORS[Math.floor(Math.random() * CE.FIREWORK_COLORS.length)];
    for (let i = 0; i < count; ++i) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.04,
        alpha: 1,
        size: 2 + Math.random() * 3,
        color,
        glow: 8 + Math.random() * 8
      });
    }
  }

  function spawnSparkle(particles, x, y) {
    const count = 8;
    for (let i = 0; i < count; ++i) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 2;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.02,
        alpha: 1,
        size: 1 + Math.random() * 2,
        color: '#ffff88',
        glow: 6
      });
    }
  }

  function updateAndDrawParticles(cx, particles) {
    for (let i = particles.length - 1; i >= 0; --i) {
      const p = particles[i];
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.012;
      p.size *= 0.995;
      if (p.alpha <= 0 || p.size < 0.3) {
        particles.splice(i, 1);
        continue;
      }
      cx.save();
      cx.globalAlpha = p.alpha;
      cx.shadowColor = p.color;
      cx.shadowBlur = p.glow * p.alpha;
      cx.fillStyle = p.color;
      cx.beginPath();
      cx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    }
  }

  function updateParticles(particles) {
    for (let i = particles.length - 1; i >= 0; --i) {
      const p = particles[i];
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.012;
      p.size *= 0.995;
      if (p.alpha <= 0 || p.size < 0.3)
        particles.splice(i, 1);
    }
  }

  function drawParticles(cx, particles) {
    for (let i = particles.length - 1; i >= 0; --i) {
      const p = particles[i];
      if (p.alpha <= 0 || p.size < 0.3) {
        particles.splice(i, 1);
        continue;
      }
      cx.save();
      cx.globalAlpha = p.alpha;
      cx.shadowColor = p.color;
      cx.shadowBlur = p.glow * p.alpha;
      cx.fillStyle = p.color;
      cx.beginPath();
      cx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    }
  }

  /* ================================================================
   *  WIN ANIMATION HELPERS
   * ================================================================ */

  function launchWinCards(allCards, winAnimCards, winAnimRunning, interval) {
    let launchIndex = 0;
    const id = setInterval(() => {
      if (launchIndex >= allCards.length || !winAnimRunning.value) {
        clearInterval(id);
        return;
      }
      const c = allCards[launchIndex];
      winAnimCards.push({
        card: c.card,
        x: c.startX,
        y: c.startY,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 6 + 2),
        gravity: 0.2,
        bounces: 0,
        angle: 0,
        angularVelocity: (Math.random() - 0.5) * 0.08,
        trail: []
      });
      ++launchIndex;
    }, interval || 80);
    return id;
  }

  function drawWinCards(cx, winAnimCards, canvasW, canvasH) {
    let anyAlive = false;

    for (const ac of winAnimCards) {
      ac.vy += ac.gravity;
      ac.x += ac.vx;
      ac.y += ac.vy;
      ac.angle += ac.angularVelocity;

      if (ac.y + CE.CARD_H > canvasH) {
        ac.y = canvasH - CE.CARD_H;
        ac.vy = -ac.vy * 0.7;
        ++ac.bounces;
      }

      if (ac.x + CE.CARD_W < -50 || ac.x > canvasW + 50 || ac.bounces > 8)
        continue;

      anyAlive = true;

      ac.trail.push({ x: ac.x, y: ac.y, alpha: 0.4 });
      if (ac.trail.length > 6)
        ac.trail.shift();
      for (const t of ac.trail) {
        cx.save();
        cx.globalAlpha = t.alpha;
        cx.translate(t.x + CE.CARD_W / 2, t.y + CE.CARD_H / 2);
        cx.rotate(ac.angle);
        CE.drawCardFace(cx, -CE.CARD_W / 2, -CE.CARD_H / 2, ac.card);
        cx.restore();
        t.alpha *= 0.6;
      }

      cx.save();
      cx.translate(ac.x + CE.CARD_W / 2, ac.y + CE.CARD_H / 2);
      cx.rotate(ac.angle);
      CE.drawCardFace(cx, -CE.CARD_W / 2, -CE.CARD_H / 2, ac.card);
      cx.restore();
    }

    return anyAlive;
  }

  Object.assign(CE, {
    // Particles
    spawnFirework,
    spawnSparkle,
    updateAndDrawParticles,
    updateParticles,
    drawParticles,

    // Win animation
    launchWinCards,
    drawWinCards
  });

})();
