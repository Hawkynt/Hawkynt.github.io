/* The outpost's defences each step: turrets pick the nearest invader in reach (rogue ones fire at
   you) - lasers, flak, missiles, the Tesla Coil's chain lightning and the Stasis Beam that
   slows what it holds - the Sensor Array's range bonus, shield domes charging and repair bays
   mending buildings, units and the ship. Reads G.base; no state of its own. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const C = NS.colony;
  const R = NS.rng.fx;

  /* turrets: nearest invader in range (rogue turrets fire at you); lasers, flak, missiles */
  function turret(o, def, dt) {
    if (!o.rogue && !NS.base.powered(o)) return;
    const rangeMul = G.stats.turretRange * (radarNear(o) ? 1.1 : 1);
    const range = def.range * rangeMul * (1 + (o.lvl - 1) * 0.12);
    o._fireT -= dt * (o.rogue ? 1 : Math.max(0.25, o._eff));
    let t = o._target;
    if (o._side !== o.rogue) { t = null; o._side = o.rogue; }
    if (!t || !t.alive || (t.x - o.x) * (t.x - o.x) + (t.y - o.y) * (t.y - o.y) > range * range) {
      t = o.rogue ? NS.units.nearestHostileToBase(o.x, o.y, range) : NS.enemies.nearest(o.x, o.y, range, def.id === 'missile' || def.id === 'stasis' ? 'big' : def.id === 'flak' || def.id === 'tesla' ? 'swarm' : 'small');
      o._target = t;
    }
    if (!t) return;
    o._ang += NS.rng.clamp(NS.rng.angleDiff(o._ang, Math.atan2(t.y - o.y, t.x - o.x)), -6 * dt, 6 * dt);
    if (o._fireT > 0) return;
    o._fireT = def.rof;
    const dmg = def.dmg * C.levelMul(o.lvl) * (o.rogue ? 0.6 : G.stats.turretDmg);
    const side = o.rogue ? 'enemy' : 'player';
    const mx = o.x + Math.cos(o._ang) * o.r * 0.7, my = o.y + Math.sin(o._ang) * o.r * 0.7;
    if (def.id === 'laser') {
      NS.enemies.hitTarget(t, dmg, side, null, def.dtype);
      G.tbeams.push({ x0: mx, y0: my, x1: t.x, y1: t.y, t: 0.09, color: o.rogue ? '#3affd0' : '#ff6a3a' });
      NS.audio.sfxAt('laser', o.x, o.y, { volume: 0.12, pitch: 1.6 });
    } else if (def.id === 'flak') {
      NS.enemies.fire(side, 'flak', mx, my, t, dmg, 620, { splash: def.splash });
      NS.audio.sfxAt('shoot', o.x, o.y, { volume: 0.25, pitch: 0.6 });
    } else if (def.id === 'tesla') {
      chain(o, t, def, dmg, side, mx, my);
    } else if (def.id === 'stasis') {
      NS.enemies.hitTarget(t, dmg, side, null, def.dtype);
      if (!o.rogue) NS.enemies.slow(t, def.slow, def.hold);
      G.tbeams.push({ x0: mx, y0: my, x1: t.x, y1: t.y, t: def.rof + 0.02, color: o.rogue ? '#3affd0' : def.color, soft: true });
      if (R() < 0.2) NS.audio.sfxAt('zap', o.x, o.y, { volume: 0.1, pitch: 1.8 });
    } else {
      NS.enemies.fire(side, 'missile', mx, my, t, dmg, 420, { turn: 3.2 });
      NS.enemies.fire(side, 'missile', mx, my, t, dmg, 400, { turn: 3, delay: 0.2 });
      NS.audio.sfxAt('whoosh', o.x, o.y, { volume: 0.3, pitch: 1.4 });
    }
    NS.fx.muzzle(mx, my, o._ang, o.rogue ? '#3affd0' : '#ffb070');
  }

  /* the Tesla Coil: the bolt strikes its target and jumps on to the nearest invaders not yet hit,
     losing strength with every hop */
  const struck = [];
  function chain(o, t, def, dmg, side, mx, my) {
    struck.length = 0;
    let cur = t, x0 = mx, y0 = my, d = dmg;
    for (let k = 0; k <= def.chain && cur; ++k) {
      struck.push(cur);
      G.tbeams.push({ x0: x0, y0: y0, x1: cur.x, y1: cur.y, t: 0.14, color: o.rogue ? '#3affd0' : def.color, zig: true });
      NS.enemies.hitTarget(cur, d, side, null, def.dtype);
      x0 = cur.x; y0 = cur.y;
      d *= def.fall;
      cur = o.rogue ? null : NS.enemies.nearestExcept(x0, y0, def.hop, struck);
    }
    NS.audio.sfxAt('zap', o.x, o.y, { volume: 0.3, pitch: 1.5 });
  }

  function radarNear(o) {
    const list = G.base.data.buildings;
    for (let i = 0; i < list.length; ++i) {
      const r = list[i];
      if (r.type === 'radar' && r.prog >= 1 && !r.rogue && Math.abs(r.cx - o.cx) <= 6 && Math.abs(r.cy - o.cy) <= 6) return true;
    }
    return false;
  }

  function shieldGen(o, def, dt) {
    if (o._hit > 0) o._hit -= dt;
    if (o._down > 0) { o._down -= dt; return; }
    const cap = def.cap * C.levelMul(o.lvl) * G.stats.shieldMul;
    const regen = def.regen * C.levelMul(o.lvl) * (G.base.mods ? G.base.mods.shieldRegen : 1);
    if (NS.base.powered(o) && !o.rogue) o._shield = Math.min(cap, (o._shield || 0) + regen * o._eff * dt);
    else o._shield = Math.max(0, (o._shield || 0) - regen * dt);
  }

  function repairBay(o, def, dt) {
    if (!NS.base.powered(o) || o.rogue) return;
    const heal = def.heal * C.levelMul(o.lvl) * G.stats.repairMul * o._eff * dt;
    const rad = def.radius;
    let n = 0;
    const list = G.base.data.buildings;
    for (let i = 0; i < list.length && n < 3; ++i) {
      const t = list[i];
      if (t.hp >= t.maxHp || t.prog < 1 || (t.x - o.x) * (t.x - o.x) + (t.y - o.y) * (t.y - o.y) > rad * rad) continue;
      t.hp = Math.min(t.maxHp, t.hp + heal * 3);
      ++n;
      if (R() < dt * 6) G.tbeams.push({ x0: o.x, y0: o.y, x1: t.x, y1: t.y, t: 0.15, color: '#7cff9a', soft: true });
    }
    n += NS.units.healNear(o.x, o.y, rad, heal * 2, 3 - n);
    const s = G.ship;
    if (s && s.alive && s.hull < s.maxHull && (s.x - o.x) * (s.x - o.x) + (s.y - o.y) * (s.y - o.y) < rad * rad) {
      s.hull = Math.min(s.maxHull, s.hull + heal * 1.5);
      if (R() < dt * 6) G.tbeams.push({ x0: o.x, y0: o.y, x1: s.x, y1: s.y, t: 0.15, color: '#7cff9a', soft: true });
    }
  }

  Object.assign(NS.turrets, {
    turret, shieldGen, repairBay
  });
})();
