/* Tunables: field sizes, ship and bullet physics, asteroid sizes, effect radii
   and the fixed-step simulation clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  const FIELD_SIZES = {
    small:  { label: 'Small',  size: 520  },
    medium: { label: 'Medium', size: 800  },
    large:  { label: 'Large',  size: 1200 },
    huge:   { label: 'Huge',   size: 1600 }
  };
  const FIELD_SIZE_KEYS = Object.keys(FIELD_SIZES);

  const STORAGE_KEY = 'sz-asteroids-high-scores';
  const FIELD_STORAGE_KEY = 'sz-asteroids-field-size';
  const MAX_HIGH_SCORES = 5;
  const SHIP_SIZE = 12;
  const SHIP_ROTATION_SPEED = 0.07;
  const SHIP_THRUST = 0.12;
  const SHIP_FRICTION = 0.99;
  const BULLET_SPEED = 8;
  const BULLET_LIFETIME = 55;
  const INVULN_DURATION = 2000;
  const HYPERSPACE_COOLDOWN = 500;
  const UFO_SPEED = 2;
  const BASE_STAR_COUNT = 120;
  const SHOOT_COOLDOWN = 180;
  const SHOOT_COOLDOWN_RAPID = 70;
  const MAX_BULLETS_NORMAL = 4;
  const MAX_BULLETS_RAPID = 8;
  const COMBO_TIMEOUT = 1500;
  const POWERUP_LIFETIME = 10000;
  const POWERUP_COLLECT_RADIUS = 18;
  const WARP_DURATION = 1800;

  const ASTEROID_SIZES = {
    large:  { radius: 40, points: 20,  speed: 1.2, dropRate: 0.05, craters: [3, 5] },
    medium: { radius: 20, points: 50,  speed: 2,   dropRate: 0.12, craters: [2, 3] },
    small:  { radius: 10, points: 100, speed: 3,   dropRate: 0.18, craters: [1, 2] }
  };

  const EXPLOSION_RADIUS = 120;
  const ICE_ZONE_RADIUS = 80;
  const ICE_ZONE_DURATION = 5000;
  const FIRE_PATCH_RADIUS = 25;
  const FIRE_PATCH_DURATION = 3000;
  const LAVA_TRAIL_INTERVAL = 500;
  const EMP_DURATION = 3000;
  const MINE_RADIUS = 30;
  const MINE_DURATION = 15000;
  const MAX_ENEMIES = 3;
  const MAX_ALLIES = 2;
  const ALLY_SHOOT_INTERVAL = 800;
  const ALLY_FOLLOW_DIST = 100;
  const FIRE_DAMAGE_COOLDOWN = 500;
  const RESPAWN_DELAY = 1500;

  /* Simulation runs in fixed 60 Hz steps regardless of display refresh rate */
  const SIM_STEP = 1000 / 60;
  const SIM_MAX_STEPS = 3;
  const SIM_SNAP = 0.5;

  Object.assign(NS.constants, {
    FIELD_SIZES, FIELD_SIZE_KEYS, STORAGE_KEY, FIELD_STORAGE_KEY, MAX_HIGH_SCORES,
    SHIP_SIZE, SHIP_ROTATION_SPEED, SHIP_THRUST, SHIP_FRICTION, BULLET_SPEED,
    BULLET_LIFETIME, INVULN_DURATION, HYPERSPACE_COOLDOWN, UFO_SPEED, BASE_STAR_COUNT,
    SHOOT_COOLDOWN, SHOOT_COOLDOWN_RAPID, MAX_BULLETS_NORMAL, MAX_BULLETS_RAPID,
    COMBO_TIMEOUT, POWERUP_LIFETIME, POWERUP_COLLECT_RADIUS, WARP_DURATION,
    ASTEROID_SIZES, EXPLOSION_RADIUS, ICE_ZONE_RADIUS, ICE_ZONE_DURATION,
    FIRE_PATCH_RADIUS, FIRE_PATCH_DURATION, LAVA_TRAIL_INTERVAL, EMP_DURATION,
    MINE_RADIUS, MINE_DURATION, MAX_ENEMIES, MAX_ALLIES, ALLY_SHOOT_INTERVAL,
    ALLY_FOLLOW_DIST, FIRE_DAMAGE_COOLDOWN, RESPAWN_DELAY,
    SIM_STEP, SIM_MAX_STEPS, SIM_SNAP
  });
})();
