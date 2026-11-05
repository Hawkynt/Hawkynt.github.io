/* The ten enemy behaviours of the arcade field, run while a ship fights after its entry:
   Raiders sway in their slot and fire bursts, Hornets dive at the pilot and loop, Swarmers weave
   down a lane and home in, Hammerheads lob plasma at the convoy, Sentries ride the scrolling
   terrain or an outpost, Outposts hold the top and launch swarmers, Bulwarks swing a shield arc,
   Phantoms cloak to the pilot's flank, Leviathans open their bays, Lancers snipe after a warning
   line. Reads and steers G.enemies entries; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { turnToward, angleDiff } = NS.rng;
  const R = NS.rng.fx;
  const { sfxAt } = NS.audio;

  const DOWN = Math.PI / 2;

  /* how long a ship holds its slot before it leaves the field */
  function stayTime(type) {
    switch (type) {
      case 'fighter': return 8 + R() * 3;
      case 'bomber': return 11 + R() * 3;
      case 'frigate': return 16 + R() * 3;
      case 'cloaker': return 15;
      case 'lancer': return 13 + R() * 2;
      case 'carrier': return 28;
    }
    return Infinity;
  }

  /* steer toward a point, braking as it gets close */
  function seek(e, tx, ty, dt, mul) {
    const dx = tx - e.x, dy = ty - e.y;
    const sp = e.def.speed * 0.7 * (mul || 1);
    let vx = dx * 2.4, vy = dy * 2.4;
    const l = Math.sqrt(vx * vx + vy * vy);
    if (l > sp) { vx *= sp / l; vy *= sp / l; }
    const k = Math.min(1, 3 * dt);
    e.vx += (vx - e.vx) * k;
    e.vy += (vy - e.vy) * k;
  }

  /* Can this enemy see its target? Nebulae hide the player beyond close range */
  function canSee(e, t) {
    if (t === G.player && t.inNebula) {
      const dx = t.x - e.x, dy = t.y - e.y;
      return dx * dx + dy * dy < 260 * 260;
    }
    return true;
  }

  /* raiders and bombers squeeze off a burst while they swing into formation */
  function fireOnEntry(e, dt) {
    const ai = e.def.ai;
    if ((ai === 'strafe' || ai === 'bomber') && e.target && e.pathT > e.path.dur * 0.5)
      NS.enemies.tryFire(e, dt * 0.5, e.target);
  }

  function think(e, dt, spMul) {
    const t = e.target;
    const def = e.def;
    if (!t) {
      seek(e, e.homeX, e.homeY, dt);
      return;
    }
    const dx = t.x - e.x, dy = t.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const aim = Math.atan2(dy, dx);
    const ready = canSee(e, t) && e.onScreen;
    switch (def.ai) {
      case 'strafe':
        seek(e, e.homeX + Math.sin(e.t * 0.9 + e.wobble) * 70, e.homeY + Math.sin(e.t * 1.6 + e.wobble) * 16, dt);
        e.angle = turnToward(e.angle, aim, 4 * dt);
        if (ready) NS.enemies.tryFire(e, dt, t);
        break;
      case 'pursue':
        thinkDive(e, dt, t, d, aim, ready);
        break;
      case 'kamikaze':
        thinkSwarm(e, dt, t, dx, dy, d);
        break;
      case 'bomber':
        seek(e, e.homeX + Math.sin(e.t * 0.5 + e.wobble) * 50, e.homeY + Math.sin(e.t * 0.8) * 12, dt);
        e.angle = turnToward(e.angle, aim, 1.4 * dt);
        if (ready) NS.enemies.tryFire(e, dt, t);
        break;
      case 'turret':
        thinkTurret(e, dt, aim, ready);
        break;
      case 'station':
        e.angle += dt * 0.12;
        NS.enemies.spawnChildren(e, dt);
        break;
      case 'frigate':
        seek(e, e.homeX + Math.sin(e.t * 0.35 + e.wobble) * 60, e.homeY, dt);
        e.angle = turnToward(e.angle, aim, 0.75 * dt);
        /* the shield arc swings across the hull: shoot through the gap */
        e.shieldA = DOWN + Math.sin(e.t * 0.9 + e.wobble) * 1.3;
        if (ready && Math.abs(angleDiff(e.angle, aim)) < 0.6) NS.enemies.tryFire(e, dt, t);
        break;
      case 'cloak':
        thinkCloak(e, dt, t, aim);
        break;
      case 'carrier':
        seek(e, e.homeX + Math.sin(e.t * 0.25) * 40, e.homeY, dt);
        e.angle = turnToward(e.angle, DOWN, 0.5 * dt);
        NS.enemies.spawnChildren(e, dt);
        if (ready) NS.enemies.tryFire(e, dt, t);
        break;
      case 'lancer':
        thinkLancer(e, dt, aim, ready);
        break;
    }
  }

  /* Hornets: turn onto the pilot while above them, then commit and scream past */
  function thinkDive(e, dt, t, d, aim, ready) {
    if (e.y < t.y - 140) {
      const lead = d / 700;
      const want = Math.atan2(t.y + (t.vy || 0) * lead * 0.3 - e.y, t.x + (t.vx || 0) * lead * 0.5 - e.x);
      e.angle = turnToward(e.angle, want, 2.4 * dt);
      if (ready && Math.abs(angleDiff(e.angle, aim)) < 0.3) NS.enemies.tryFire(e, dt, t, true);
    }
    /* never climb: a dive always ends below */
    if (Math.sin(e.angle) < 0.4) e.angle = turnToward(e.angle, DOWN, 3 * dt);
    const a = e.def.accel;
    e.vx += Math.cos(e.angle) * a * dt;
    e.vy += Math.sin(e.angle) * a * dt;
  }

  /* Swarmers: weave down their lane, then break off and ram whatever is close */
  function thinkSwarm(e, dt, t, dx, dy, d) {
    if (e.mode === 0) {
      const sp = e.def.speed * 0.45;
      const tx = e.lane + Math.sin(e.t * 2.6) * e.amp;
      e.vx += ((tx - e.x) * 6 - e.vx) * Math.min(1, 6 * dt);
      e.vy += (sp - e.vy) * Math.min(1, 3 * dt);
      if (d < 230 && e.y > 30 && e.y < t.y) e.mode = 1;
    } else {
      e.vx += dx / d * e.def.accel * 1.3 * dt;
      e.vy += dy / d * e.def.accel * 1.3 * dt;
    }
    e.angle = Math.atan2(e.vy, e.vx);
    if (d < e.r + (t.r || 18) + 2) NS.combat.droneBlast(e);
  }

  /* Sentries: on an outpost they ride its hull, otherwise on a terrain pad down the scroll */
  function thinkTurret(e, dt, aim, ready) {
    if (e.parent) {
      if (!e.parent.alive) { NS.combat.kill(e, null); return; }
      e.angle = e.parent.angle;
      e.x = e.parent.x + Math.cos(e.mountA + e.parent.angle) * 92;
      e.y = e.parent.y + Math.sin(e.mountA + e.parent.angle) * 92;
    } else {
      e.y += G.scroll.speed * dt;
      e.angle = 0;
    }
    e.barrel = turnToward(e.barrel, aim, 2.4 * dt);
    if (ready && Math.abs(angleDiff(e.barrel, aim)) < 0.3) NS.enemies.tryFire(e, dt, e.target);
  }

  /* Phantoms: slip unseen to the pilot's flank, decloak, strike, vanish again */
  function thinkCloak(e, dt, t, aim) {
    e.modeT -= dt;
    if (e.mode === 0) {
      e.cloak = Math.max(0.05, e.cloak - dt * 2.5);
      e.untargetable = e.cloak < 0.3;
      const gx = Math.max(e.r, Math.min(G.world.w - e.r, t.x + e.orbitDir * 190));
      const gy = Math.max(60, Math.min(G.world.h * 0.55, t.y - 180));
      seek(e, gx, gy, dt, 1.2);
      e.angle = turnToward(e.angle, Math.atan2(e.vy, e.vx), 5 * dt);
      const close = (gx - e.x) * (gx - e.x) + (gy - e.y) * (gy - e.y) < 110 * 110;
      if ((e.modeT <= 0 && close) || e.modeT < -5) {
        e.mode = 1;
        e.modeT = 0.45;
        sfxAt('zap', e.x, e.y, { pitch: 0.7, volume: 0.5 });
      }
    } else if (e.mode === 1) {
      e.cloak = Math.min(1, e.cloak + dt * 2.4);
      e.untargetable = false;
      e.angle = turnToward(e.angle, aim, 6 * dt);
      e.vx *= 1 - 3 * dt;
      e.vy *= 1 - 3 * dt;
      if (e.modeT <= 0) { e.mode = 2; e.modeT = 1.6; e.cd = 0; }
    } else {
      e.cloak = 1;
      e.angle = turnToward(e.angle, aim, 5 * dt);
      seek(e, e.x - e.orbitDir * 60, e.y, dt, 0.4);
      if (e.onScreen) NS.enemies.tryFire(e, dt, t, true);
      if (e.modeT <= 0) { e.mode = 0; e.modeT = 2.5 + R() * 1.5; e.orbitDir = -e.orbitDir; }
    }
  }

  /* Lancers: hold high, track during the first half of the charge, then the line is locked */
  function thinkLancer(e, dt, aim, ready) {
    const def = e.def;
    if (e.charge > 0) {
      e.charge -= dt;
      if (e.charge > def.beam.charge * 0.5) e.beamA = turnToward(e.beamA, aim, 1.6 * dt);
      e.angle = e.beamA;
      e.vx *= 1 - 3 * dt;
      e.vy *= 1 - 3 * dt;
      if (e.charge <= 0) NS.enemies.fireLance(e);
      return;
    }
    seek(e, e.homeX + Math.sin(e.t * 0.6 + e.wobble) * 90, e.homeY, dt);
    e.angle = turnToward(e.angle, aim, 2.5 * dt);
    e.cd -= dt;
    if (e.cd <= 0 && ready) {
      e.cd = def.beam.every * (0.8 + R() * 0.4);
      e.charge = def.beam.charge;
      e.beamA = aim;
      sfxAt('laser', e.x, e.y, { pitch: 0.4, volume: 0.4 });
    }
  }

  Object.assign(NS.enemyAi, {
    think, fireOnEntry, stayTime, canSee, seek
  });
})();
