/* Things to pick up: scrap (the currency), the five combat power-ups (shield, repair,
   overcharge, magnet, munitions) and the data cores of salvage missions. Drops, drift, the
   tractor magnet, lifetimes and collection. Owns G.pickups. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { TAU, PICKUP_LIFE, OVERCHARGE_TIME, MAGNET_TIME } = NS.constants;
  const { POWERUPS } = NS.ships;
  const R = NS.rng.fx;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { compact } = NS.grid;

  const PU_KEYS = Object.keys(POWERUPS);
  const CORE_RANGE = 120, CORE_TIME = 2.6;

  function add(type, x, y, value) {
    const a = R() * TAU, s = 60 + R() * 140;
    const p = {
      alive: true, type: type, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      value: value || 1, t: 0, life: type === 'core' ? Infinity : PICKUP_LIFE * (type === 'scrap' ? 0.8 : 1),
      r: type === 'scrap' ? 8 : type === 'core' ? 20 : 16, spin: R() * TAU,
    };
    if (type === 'core') { p.vx = 0; p.vy = 0; }
    G.pickups.push(p);
    return p;
  }

  /* `n` scrap units as a handful of pieces */
  function dropScrap(x, y, n) {
    if (n <= 0) return;
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    const total = Math.round(n * (mut && mut.scrap ? mut.scrap : 1));
    const pieces = Math.min(8, Math.max(1, Math.ceil(total / 4)));
    let left = total;
    for (let i = 0; i < pieces; ++i) {
      const v = i === pieces - 1 ? left : Math.ceil(total / pieces);
      left -= v;
      if (v > 0) add('scrap', x, y, v);
    }
  }

  function pickPowerup() {
    let total = 0;
    for (let i = 0; i < PU_KEYS.length; ++i) total += POWERUPS[PU_KEYS[i]].weight;
    let r = R() * total;
    for (let i = 0; i < PU_KEYS.length; ++i) {
      r -= POWERUPS[PU_KEYS[i]].weight;
      if (r <= 0) return PU_KEYS[i];
    }
    return PU_KEYS[0];
  }

  /* chance scales with the Lucky Charms node and the mutator; `force` always drops */
  function dropPowerup(x, y, force, chance) {
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    const luck = G.stats.luck * (mut && mut.luck ? mut.luck : 1);
    if (!force && R() > (chance || 0.08) * luck) return null;
    let type = pickPowerup();
    const p = G.player;
    /* a hurt pilot is more likely to find what they need */
    if (p && p.hull < p.maxHull * 0.4 && R() < 0.4) type = 'repair';
    return add(type, x, y, 1);
  }

  function update(dt) {
    const p = G.player;
    const live = p && p.alive;
    const magR = 120 * G.stats.magnet;
    const bigMag = live && p.magnet > 0;
    for (let i = 0; i < G.pickups.length; ++i) {
      const q = G.pickups[i];
      q.t += dt;
      q.life -= dt;
      q.spin += dt * 2;
      if (q.life <= 0) { q.alive = false; continue; }
      q.vx *= 1 - 2.2 * dt;
      q.vy *= 1 - 2.2 * dt;
      if (q.type === 'core') {
        /* data cores download while the ship holds station next to them */
        const near = live && (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y) < CORE_RANGE * CORE_RANGE;
        q.progress = Math.max(0, Math.min(1, (q.progress || 0) + (near ? dt / CORE_TIME : -dt / CORE_TIME * 0.5)));
        q.linked = near;
        if (near && Math.floor(q.t * 8) !== Math.floor((q.t - dt) * 8)) fx.glow(q.x, q.y, 18, '#7affd0', 0.25);
        if (q.progress >= 1) collect(q, p);
        continue;
      }
      if (live) {
        const dx = p.x - q.x, dy = p.y - q.y;
        const d2 = dx * dx + dy * dy;
        const reach = bigMag ? 1000 : q.type === 'scrap' ? magR : magR * 0.6;
        if (d2 < reach * reach) {
          const d = Math.sqrt(d2) || 1;
          const pullK = (1 - d / reach) * 2400 + 300;
          q.vx += dx / d * pullK * dt;
          q.vy += dy / d * pullK * dt;
        }
        const cr = p.r + q.r;
        if (d2 < cr * cr) {
          collect(q, p);
          continue;
        }
      }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    compact(G.pickups);
  }

  function collect(q, p) {
    q.alive = false;
    const st = G.stats;
    switch (q.type) {
      case 'scrap': {
        const v = Math.max(1, Math.round(q.value * st.salvage));
        G.runScrap += v;
        fx.glow(q.x, q.y, 14, '#ffd25a', 0.15);
        sfx('coin', { volume: 0.35, pitch: 1 + Math.min(0.5, G.combo * 0.01) });
        break;
      }
      case 'core':
        NS.missions.coreCollected(q);
        fx.shockwave(q.x, q.y, 140, '#7affd0');
        fx.text(q.x, q.y - 30, 'DATA CORE', '#7affd0', 18);
        sfx('powerup');
        break;
      case 'shield':
      case 'repair':
      case 'ammo':
        NS.player.heal(q.type);
        puFx(q, p);
        break;
      case 'overcharge':
        p.overcharge = OVERCHARGE_TIME + st.overTime;
        puFx(q, p);
        break;
      case 'magnet':
        p.magnet = MAGNET_TIME;
        puFx(q, p);
        break;
    }
  }

  function puFx(q, p) {
    const d = POWERUPS[q.type];
    fx.ring(p.x, p.y, 20, 90, 0.35, d.color, 5);
    fx.text(p.x, p.y - 34, d.name.toUpperCase(), d.color, 17, 1.1);
    sfx('powerup');
  }

  Object.assign(NS.pickups, {
    CORE_RANGE, add, dropScrap, dropPowerup, update
  });
})();
