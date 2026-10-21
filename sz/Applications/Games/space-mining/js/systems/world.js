/* The world dressing: parallax star layers, nebula patches, decorative background
   asteroids, shooting stars and the camera that follows the ship. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const S = NS.state;
  const W = NS.world;

  /* ── Stars -- 3 parallax layers ── */
  W.initStars = function initStars() {
    S.starLayers = [[], [], []];
    const counts = [80, 60, 40];
    for (let layer = 0; layer < 3; ++layer) {
      for (let i = 0; i < counts[layer]; ++i)
        S.starLayers[layer].push({
          x: Math.random() * C.WORLD_W * 1.5,
          y: Math.random() * C.WORLD_H * 1.5,
          size: layer === 0 ? 0.5 + Math.random() * 0.8 : layer === 1 ? 0.8 + Math.random() * 1.2 : 1.2 + Math.random() * 2.0,
          alpha: 0.15 + Math.random() * 0.4 + layer * 0.1,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 1 + Math.random() * 3,
          hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? '#aaccff' : '#ffccaa') : '#fff'
        });
    }
  };

  /* ── Nebulae ── */
  W.initNebulae = function initNebulae() {
    S.nebulae = [];
    const colors = [
      'rgba(80,40,120,0.04)', 'rgba(40,80,120,0.035)', 'rgba(120,40,60,0.03)',
      'rgba(40,120,80,0.035)', 'rgba(100,60,140,0.03)', 'rgba(60,100,120,0.025)'
    ];
    for (let i = 0; i < 8; ++i)
      S.nebulae.push({
        x: Math.random() * C.WORLD_W,
        y: Math.random() * C.WORLD_H,
        radius: 150 + Math.random() * 250,
        color: colors[i % colors.length],
        driftX: (Math.random() - 0.5) * 2,
        driftY: (Math.random() - 0.5) * 2
      });
  };

  /* ── Background Asteroids (decorative, slow drift) ── */
  W.initBgAsteroids = function initBgAsteroids() {
    S.bgAsteroids = [];
    for (let i = 0; i < C.BG_ASTEROID_COUNT; ++i) {
      const r = 3 + Math.random() * 8;
      S.bgAsteroids.push({
        x: Math.random() * C.WORLD_W * 1.5,
        y: Math.random() * C.WORLD_H * 1.5,
        radius: r,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.5,
        driftX: (Math.random() - 0.5) * 8,
        driftY: (Math.random() - 0.5) * 8,
        alpha: 0.15 + Math.random() * 0.2,
        vertices: (() => {
          const v = [];
          const n = 5 + Math.floor(Math.random() * 4);
          for (let j = 0; j < n; ++j)
            v.push({ a: (j / n) * Math.PI * 2, d: r * (0.6 + Math.random() * 0.4) });
          return v;
        })()
      });
    }
  };

  W.updateBgAsteroids = function updateBgAsteroids(dt) {
    for (const bg of S.bgAsteroids) {
      bg.x += bg.driftX * dt;
      bg.y += bg.driftY * dt;
      bg.angle += bg.rotSpeed * dt;
      if (bg.x < -50) bg.x = C.WORLD_W * 1.5 + 50;
      if (bg.x > C.WORLD_W * 1.5 + 50) bg.x = -50;
      if (bg.y < -50) bg.y = C.WORLD_H * 1.5 + 50;
      if (bg.y > C.WORLD_H * 1.5 + 50) bg.y = -50;
    }
  };

  W.updateShootingStars = function updateShootingStars(dt) {
    S.shootingStarTimer += dt;
    if (S.shootingStarTimer > 2 + Math.random() * 4) {
      S.shootingStarTimer = 0;
      if (S.shootingStars.length < 3) {
        const angle = 0.3 + Math.random() * 0.8;
        const speed = 200 + Math.random() * 300;
        S.shootingStars.push({
          x: S.camera.x + Math.random() * C.CANVAS_W,
          y: S.camera.y - 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.6 + Math.random() * 0.8,
          maxLife: 0.6 + Math.random() * 0.8,
          length: 20 + Math.random() * 40
        });
      }
    }

    for (let i = S.shootingStars.length - 1; i >= 0; --i) {
      const ss = S.shootingStars[i];
      ss.x += ss.vx * dt;
      ss.y += ss.vy * dt;
      ss.life -= dt;
      if (ss.life <= 0)
        S.shootingStars.splice(i, 1);
    }
  };

  W.updateNebulae = function updateNebulae(dt) {
    for (const n of S.nebulae) {
      n.x += n.driftX * dt;
      n.y += n.driftY * dt;
    }
  };

  W.updateCamera = function updateCamera() {
    S.camera.x = S.ship.x - C.CANVAS_W / 2;
    S.camera.y = S.ship.y - C.CANVAS_H / 2;
    S.camera.x = Math.max(0, Math.min(C.WORLD_W - C.CANVAS_W, S.camera.x));
    S.camera.y = Math.max(0, Math.min(C.WORLD_H - C.CANVAS_H, S.camera.y));
  };
})();
