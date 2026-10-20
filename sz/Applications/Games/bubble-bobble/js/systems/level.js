/* The level lifecycle: procedural level generation (platforms, patrolling enemies,
   a chance power-up, level-dependent wind and float speed), the level-clear check and
   the level-complete celebration that advances to the next level. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const S = NS.state;
  const V = NS.view;

  /* ── Level generation ── */
  function generateLevel(level) {
    S.platforms = [];
    S.enemies = [];
    S.bubbles = [];
    S.items = [];
    S.powerUps = [];

    // Level-dependent flow: wind and float speed increase with level
    const windStrength = Math.min((level - 1) * 8, 60);
    S.levelFlow = {
      windX: level <= 2 ? 0 : (level % 2 === 0 ? windStrength : -windStrength),
      floatSpeed: Math.min(1.0 + (level - 1) * 0.1, 2.0)
    };

    // Floor
    S.platforms.push({ x: 0, y: C.CANVAS_H - C.WALL_THICKNESS, w: C.CANVAS_W, h: C.WALL_THICKNESS });
    // Walls
    S.platforms.push({ x: 0, y: 0, w: C.WALL_THICKNESS, h: C.CANVAS_H });
    S.platforms.push({ x: C.CANVAS_W - C.WALL_THICKNESS, y: 0, w: C.WALL_THICKNESS, h: C.CANVAS_H });

    // Platforms — layout varies by level
    const rows = 5;
    for (let r = 0; r < rows; ++r) {
      const py = 80 + r * 72;
      const offset = (r % 2 === 0) ? 40 : 100;
      const pw = C.CANVAS_W - 80 - offset;
      S.platforms.push({ x: offset, y: py, w: pw, h: 12 });
    }

    // Enemies — count increases with level
    const numEnemies = Math.min(3 + level, 10);
    for (let i = 0; i < numEnemies; ++i) {
      const ex = 60 + Math.random() * (C.CANVAS_W - 120);
      const ey = 60 + Math.random() * (C.CANVAS_H - 160);
      S.enemies.push({
        x: ex, y: ey, vx: (40 + level * 5) * (Math.random() < 0.5 ? 1 : -1), vy: 0,
        w: 20, h: 20,
        alive: true,
        trapped: false,
        trapTimer: 0,
        animFrame: 0
      });
    }

    // Power-up spawn (random chance per level)
    if (Math.random() < 0.5) {
      const types = ['speed', 'range', 'fire'];
      S.powerUps.push({
        x: 60 + Math.random() * (C.CANVAS_W - 120),
        y: 100 + Math.random() * (C.CANVAS_H - 200),
        type: types[Math.floor(Math.random() * types.length)],
        w: 16, h: 16,
        active: true
      });
    }
  }

  /* ── Level clear ── */
  function checkLevelClear() {
    const remaining = S.enemies.filter(e => e.alive).length;
    if (remaining === 0 && S.state === C.STATE_PLAYING) {
      levelComplete();
    }
  }

  function levelComplete() {
    // Level-clear confetti burst
    for (let i = 0; i < 5; ++i) {
      const cx = 60 + Math.random() * (C.CANVAS_W - 120);
      const cy = 60 + Math.random() * (C.CANVAS_H - 120);
      V.particles.burst(cx, cy, 15, {
        color: ['#ff0', '#f0f', '#0ff', '#0f0', '#fa0'][i],
        life: 1.2,
        speed: 60
      });
    }

    SZ.GameAudio.play('levelup');
    ++S.currentLevel;
    generateLevel(S.currentLevel);
    NS.player.resetPlayerPosition();
    NS.app.updateTitle();
  }

  Object.assign(NS.level, { generateLevel, checkLevelClear, levelComplete });
})();
