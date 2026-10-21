/* Entity factories: ship, asteroids with rock type and procedural shape,
   bullets, every enemy kind, allies, collectible powerups and zones. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;

  function createShip() {
    return {
      x: S.W / 2, y: S.H / 2,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      thrusting: false
    };
  }

  function getAsteroidTypeForLevel() {
    const lvl = NS.rules.getEffectiveLevel();
    const weights = { normal: 10, iron: 0, crystal: 0, exploding: 0, ice: 0, lava: 0, electric: 0 };
    if (lvl >= 3) weights.iron = Math.min(lvl - 2, 8);
    if (lvl >= 6) weights.crystal = Math.min(lvl - 5, 6);
    if (lvl >= 9) weights.exploding = Math.min(lvl - 8, 5);
    if (lvl >= 12) weights.ice = Math.min(lvl - 11, 5);
    if (lvl >= 15) weights.lava = Math.min(lvl - 14, 4);
    if (lvl >= 18) weights.electric = Math.min(lvl - 17, 4);
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const type in weights) {
      r -= weights[type];
      if (r <= 0) return type;
    }
    return 'normal';
  }

  function createAsteroid(x, y, size, forceRockType) {
    const info = C.ASTEROID_SIZES[size];
    const angle = NS.rules.randomAngle();
    const cfg = NS.rules.modeConfig();
    const levelSpeedMult = 1 + (S.level - 1) * 0.05;
    const speed = (0.5 + Math.random() * 0.5) * info.speed * cfg.asteroidSpeedMult * levelSpeedMult;

    const rockType = forceRockType || getAsteroidTypeForLevel();
    const rt = T.ROCK_TYPES[rockType];
    const palettes = T.ROCK_TYPE_PALETTES[rockType];
    const palette = palettes[Math.floor(Math.random() * palettes.length)];

    const [minC, maxC] = info.craters;
    const craterCount = minC + Math.floor(Math.random() * (maxC - minC + 1));

    return {
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: info.radius,
      size,
      points: Math.round(info.points * rt.pointsMult),
      shape: NS.rules.generateAsteroidShape(8 + Math.floor(Math.random() * 5)),
      craters: NS.rules.generateCraters(info.radius, craterCount),
      palette,
      rotation: NS.rules.randomAngle(),
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      rockType,
      hp: rt.hp,
      maxHp: rt.hp,
      hitFlash: 0,
      damageCracks: [],
      lavaTrailTimer: rockType === 'lava' ? C.LAVA_TRAIL_INTERVAL : 0,
      sparkleTimer: rockType === 'ice' ? Math.random() * 300 : 0
    };
  }

  function spawnAsteroidAwayFromShip(size) {
    let x, y;
    const minDist = Math.max(120, S.W * 0.15);
    do {
      x = Math.random() * S.W;
      y = Math.random() * S.H;
    } while (S.ship && NS.rules.dist({ x, y }, S.ship) < minDist);
    return createAsteroid(x, y, size || 'large');
  }

  function createBullet(x, y, angle) {
    return {
      x, y,
      vx: Math.cos(angle) * C.BULLET_SPEED + (S.ship ? S.ship.vx * 0.3 : 0),
      vy: Math.sin(angle) * C.BULLET_SPEED + (S.ship ? S.ship.vy * 0.3 : 0),
      life: C.BULLET_LIFETIME
    };
  }

  function createEnemy(type) {
    const goingRight = Math.random() < 0.5;
    const y = Math.random() * S.H;
    const base = {
      type,
      x: goingRight ? -20 : S.W + 20,
      y,
      vx: goingRight ? C.UFO_SPEED : -C.UFO_SPEED,
      vy: (Math.random() - 0.5) * 1.5,
      hp: T.ENEMY_TYPES[type].hp,
      maxHp: T.ENEMY_TYPES[type].hp,
      radius: T.ENEMY_TYPES[type].radius,
      points: T.ENEMY_TYPES[type].points,
      shootTimer: NS.rules.modeConfig().ufoShootInterval,
      pulsePhase: 0,
      lightPhase: 0,
      hitFlash: 0
    };

    switch (type) {
      case 'ufo':
        base.large = true;
        break;
      case 'ufoSmall':
        base.large = false;
        break;
      case 'drone':
        base.vx = 0;
        base.vy = 0;
        base.x = goingRight ? -20 : S.W + 20;
        break;
      case 'gunship':
        base.vx *= 0.6;
        base.burstCount = 0;
        base.burstTimer = 0;
        base.strafeDir = Math.random() < 0.5 ? 1 : -1;
        break;
      case 'minelayer':
        base.mineTimer = 3000;
        base.weavePhase = Math.random() * Math.PI * 2;
        break;
      case 'stealth':
        base.cloakTimer = 2000;
        base.visible = true;
        base.cloakCycle = 2000;
        break;
      case 'boss': {
        const lvl = NS.rules.getEffectiveLevel();
        base.hp = 8 + Math.floor((lvl - 10) / 5) * 4;
        base.maxHp = base.hp;
        base.x = S.W / 2;
        base.y = -40;
        base.vx = 0;
        base.vy = 1.5;
        base.attackPattern = 0;
        base.attackTimer = 2000;
        base.shieldFlash = 0;
        base.entered = false;
        break;
      }
    }
    return base;
  }

  function createAlly() {
    const side = Math.random() < 0.5;
    return {
      x: side ? -20 : S.W + 20,
      y: S.H / 2 + (Math.random() - 0.5) * 100,
      vx: side ? 2 : -2,
      vy: 0,
      angle: side ? 0 : Math.PI,
      hp: 3,
      maxHp: 3,
      shootTimer: C.ALLY_SHOOT_INTERVAL,
      target: null,
      entered: false
    };
  }

  function createCollectiblePowerup(x, y) {
    const type = NS.rules.randomPowerupType();
    const def = T.POWERUP_TYPES[type];
    const angle = NS.rules.randomAngle();
    return {
      x, y,
      vx: Math.cos(angle) * 0.5,
      vy: Math.sin(angle) * 0.5,
      type, icon: def.icon, color: def.color, label: def.label,
      phase: 0,
      lifetime: C.POWERUP_LIFETIME
    };
  }

  function createZone(type, x, y, opts = {}) {
    return {
      type,
      x, y,
      radius: opts.radius ?? 50,
      timer: opts.duration ?? 5000,
      duration: opts.duration ?? 5000,
      damage: opts.damage ?? 0
    };
  }

  Object.assign(NS.entities, {
    createShip, getAsteroidTypeForLevel, createAsteroid, spawnAsteroidAwayFromShip,
    createBullet, createEnemy, createAlly, createCollectiblePowerup, createZone
  });
})();
