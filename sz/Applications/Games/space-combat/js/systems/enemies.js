/* Hostile ships in the arcade field: spawning on a formation path or straight in, the three
   phases (enter along the path, fight around a hover slot, leave the field), escaping off the
   edges, launched children, target choice (player, freighter or station), burst fire, the
   lancer beam, separation, stun and time warp. The ten behaviours live in enemy-ai.js.
   Owns G.enemies. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { MAX_ENEMIES, TAU } = NS.constants;
  const { ENEMIES } = NS.enemyData;
  const { turnToward, segPointDist2 } = NS.rng;
  const R = NS.rng.fx;
  const fx = NS.fx;
  const { sfxAt } = NS.audio;
  const F = NS.formations;

  const near = [];
  const pt = { x: 0, y: 0 };

  /* opts: path (a formation entry), lane/amp (swarmer lane), ground (rides the scroll),
     instant (no warp-in flash), parent, objective, hpMul, scoreMul */
  function spawn(type, x, y, opts) {
    if (G.enemies.length >= MAX_ENEMIES) return null;
    opts = opts || {};
    const def = ENEMIES[type];
    const st = G.stage;
    const hpMul = (st ? st.hpMul : 1) * (opts.hpMul || 1);
    const path = opts.path || null;
    const e = {
      alive: true, kind: type === 'station' ? 'station' : 'enemy', type: type, def: def, id: ++G.nextId,
      x: path ? path.x0 : x, y: path ? path.y0 : y, vx: 0, vy: 0, angle: Math.PI / 2, r: def.r,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul, flash: 0, t: 0,
      cd: 0.8 + R() * (def.fire ? def.fire.rate : 2), burst: 0, burstT: 0,
      stun: 0, cloak: 1, mode: 0, modeT: 2 + R() * 2, orbitDir: R() < 0.5 ? -1 : 1,
      target: null, focusAlly: R() < 0.35, spawnT: path || opts.instant || opts.ground ? 0 : 0.6,
      spawnCd: def.spawn ? def.spawn.every * (0.4 + R() * 0.4) : 0, spawnAlt: false,
      charge: 0, beamA: 0, shieldHit: 0, shieldA: Math.PI / 2, parent: opts.parent || null,
      objective: !!opts.objective, untargetable: false, inNebula: false, sepT: R() * 0.2,
      barrel: Math.PI / 2, wobble: R() * TAU, scoreMul: opts.scoreMul || 1,
      phase: path ? 'enter' : 'fight', path: path, pathT: 0,
      homeX: path ? path.x1 : x, homeY: path ? path.y1 : y, stay: NS.enemyAi.stayTime(type),
      lane: opts.lane !== undefined ? opts.lane : (path ? path.lane : x), amp: opts.amp || (path ? path.amp : 0),
      ground: !!opts.ground, loops: 0, escaped: false, onScreen: false,
    };
    G.enemies.push(e);
    if (e.spawnT > 0) {
      fx.glow(e.x, e.y, e.r * 3, '#ff6a8a', 0.5, 0, 0, -e.r * 3);
      fx.ring(e.x, e.y, e.r * 2.5, 4, 0.5, '#ff9ab0', 3);
    }
    if (type === 'station') {
      const n = def.turrets;
      for (let i = 0; i < n; ++i) {
        const a = i * TAU / n + 0.4;
        const tu = spawn('turret', e.x + Math.cos(a) * 92, e.y + Math.sin(a) * 92, { parent: e, instant: true, hpMul: opts.hpMul });
        if (tu) tu.mountA = a;
      }
    }
    return e;
  }

  /* A ship launched mid-fight (carrier bays, boss summons, ambushes): it flies a short path
     from (x, y) into a free hover slot, or straight into its run for swarmers and hornets */
  function launch(type, x, y, opts) {
    const W = G.world.w;
    const def = ENEMIES[type];
    opts = opts || {};
    if (type === 'drone' || type === 'interceptor') {
      const e = spawn(type, x, y, Object.assign({ instant: true, lane: x, amp: (40 + R() * 70) * (R() < 0.5 ? -1 : 1) }, opts));
      if (e) e.phase = 'fight';
      return e;
    }
    const sx = Math.max(def.r + 20, Math.min(W - def.r - 20, x + (R() - 0.5) * 260));
    const sy = F.SLOT_TOP + R() * (F.SLOT_BOTTOM - F.SLOT_TOP);
    const path = { x0: x, y0: y, cx: (x + sx) / 2, cy: Math.max(y, sy) + 80, x1: sx, y1: sy, dur: 1.3, hold: true, lane: sx, amp: 0 };
    return spawn(type, x, y, Object.assign({ path: path, instant: true }, opts));
  }

  /* Who this enemy is after: the convoy or station if it hunts allies, else the player */
  function chooseTarget(e) {
    const ally = G.allies.length ? G.allies[0] : null;
    const p = G.player;
    if (ally && ally.alive && (e.type === 'bomber' || e.focusAlly || !p || !p.alive)) return ally;
    if (p && p.alive) return p;
    return ally && ally.alive ? ally : null;
  }

  function update(dt) {
    const k = G.warp > 0 ? 0.3 : 1;
    const step = dt * k;
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    const spMul = mut && mut.speed ? mut.speed : 1;
    const W = G.world.w, H = G.world.h;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive) continue;
      e.t += step;
      if (e.flash > 0) e.flash -= dt;
      if (e.shieldHit > 0) e.shieldHit -= dt * 3;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      e.onScreen = e.y > 4 && e.y < H * 0.82 && e.x > 0 && e.x < W;
      e.target = chooseTarget(e);
      if (e.stun > 0) {
        e.stun -= dt;
        e.vx *= 1 - 1.5 * dt;
        e.vy *= 1 - 1.5 * dt;
        e.x += e.vx * dt;
        e.y += (e.vy + (e.ground ? G.scroll.speed : 0)) * dt;
        e.angle += dt * 2;
        if (R() < 0.15) fx.sparks(e.x, e.y, R() * TAU, 1, 1, '#8ad8ff', 160, 0.2);
        checkEscape(e, W, H);
        continue;
      }
      if (e.phase === 'enter') {
        enter(e, step);
        if (e.onScreen) NS.enemyAi.fireOnEntry(e, step);
      } else if (e.phase === 'leave') {
        leave(e, step, spMul);
      } else {
        NS.enemyAi.think(e, step, spMul);
        if (e.phase === 'fight' && e.t > e.stay && !e.objective && !e.parent && !e.ground) startLeave(e);
      }
      fireBurst(e, step);
      if (e.def.speed > 0 && e.phase !== 'enter') {
        const cap = e.def.speed * 0.7 * spMul * (e.inNebula ? 0.65 : 1) * (e.phase === 'leave' ? 1.3 : 1);
        const s2 = e.vx * e.vx + e.vy * e.vy;
        if (s2 > cap * cap) {
          const s = Math.sqrt(s2);
          e.vx *= cap / s;
          e.vy *= cap / s;
        }
        if (e.phase === 'fight') separate(e, step);
        e.x += e.vx * step;
        e.y += e.vy * step;
        if (e.phase === 'fight' && e.def.ai !== 'pursue' && e.def.ai !== 'kamikaze') {
          if (e.x < e.r) e.vx += 600 * step;
          if (e.x > W - e.r) e.vx -= 600 * step;
        }
      }
      checkEscape(e, W, H);
    }
  }

  /* follow the formation path; the ship faces where it flies */
  function enter(e, dt) {
    const en = e.path;
    e.pathT += dt;
    const k = Math.min(1, e.pathT / en.dur);
    const ox = e.x, oy = e.y;
    F.pathPoint(en, k, pt);
    e.x = pt.x;
    e.y = pt.y;
    if (dt > 0) {
      e.vx = (e.x - ox) / dt;
      e.vy = (e.y - oy) / dt;
      if (e.vx * e.vx + e.vy * e.vy > 25) e.angle = turnToward(e.angle, Math.atan2(e.vy, e.vx), 8 * dt);
    }
    if (k >= 1) {
      e.phase = 'fight';
      e.homeX = en.x1;
      e.homeY = en.y1;
      e.t = 0;
      if (!en.hold) {
        e.vx = 0;
        e.vy = e.def.speed * 0.4;
      }
    }
  }

  function startLeave(e) {
    e.phase = 'leave';
    const p = G.player;
    /* fighters peel off in a dive past the pilot, the rest drift out of the field */
    e.diveX = p && p.alive && e.def.ai === 'strafe' ? p.x : e.x + (e.x < G.world.w / 2 ? -80 : 80);
  }

  function leave(e, dt) {
    const dx = e.diveX - e.x;
    e.vx += Math.max(-1, Math.min(1, dx / 120)) * e.def.accel * 0.5 * dt;
    e.vy += e.def.accel * 0.6 * dt;
    e.angle = turnToward(e.angle, Math.atan2(e.vy, e.vx), 4 * dt);
    if (e.cloak < 1 && e.def.ai === 'cloak') e.cloak = Math.max(0.05, e.cloak - dt * 2);
  }

  /* ships that leave the field are gone (no score, no explosion) */
  function checkEscape(e, W, H) {
    if (e.phase === 'enter' || e.objective) return;
    const m = e.r + 60;
    if (e.y > H + m || e.x < -m - 60 || e.x > W + m + 60 || (e.phase === 'leave' && e.y < -m - 120)) {
      if (e.def.ai === 'pursue' && e.loops < 1 && e.y > H) {
        /* hornets loop round for one more pass */
        ++e.loops;
        e.y = -e.r - 30;
        e.x = W * (0.15 + R() * 0.7);
        e.vx = 0;
        e.vy = e.def.speed * 0.4;
        e.angle = Math.PI / 2;
        e.phase = 'fight';
        return;
      }
      despawn(e);
    }
  }

  function despawn(e) {
    e.alive = false;
    e.escaped = true;
  }

  function fireLance(e) {
    const def = e.def.beam;
    const len = 1400;
    const x0 = e.x + Math.cos(e.beamA) * e.r, y0 = e.y + Math.sin(e.beamA) * e.r;
    const x1 = x0 + Math.cos(e.beamA) * len, y1 = y0 + Math.sin(e.beamA) * len;
    G.beams.push({ alive: true, x0: x0, y0: y0, x1: x1, y1: y1, t: 0, life: 0.3, w: def.width, color: 'red', hostile: true });
    const p = G.player;
    if (p && p.alive && segPointDist2(x0, y0, x1, y1, p.x, p.y) < (p.hitR + def.width) * (p.hitR + def.width))
      NS.player.damage(def.dmg * (G.stage ? G.stage.dmgMul : 1), e.x, e.y);
    for (let i = 0; i < G.allies.length; ++i) {
      const a = G.allies[i];
      if (a.alive && segPointDist2(x0, y0, x1, y1, a.x, a.y) < (a.r + def.width) * (a.r + def.width))
        NS.combat.damageAlly(a, def.dmg * 0.6);
    }
    fx.glow(x0, y0, 40, '#ff6a6a', 0.2);
    sfxAt('laser', e.x, e.y, { pitch: 0.7, volume: 0.8 });
  }

  /* carriers and outposts open their bays: hunters fly to slots, swarmers weave straight down */
  function spawnChildren(e, dt) {
    const sp = e.def.spawn;
    e.spawnCd -= dt;
    if (e.spawnCd > 0 || !e.onScreen) return;
    e.spawnCd = sp.every;
    if (G.enemies.length >= (G.stage ? G.stage.maxAlive + 8 : 30)) return;
    const type = sp.alt && e.spawnAlt ? sp.alt : sp.type;
    e.spawnAlt = !e.spawnAlt;
    const n = type === 'drone' ? sp.count + 1 : sp.count;
    for (let i = 0; i < n; ++i) {
      const ox = (i - (n - 1) / 2) * 34;
      const c = launch(type, e.x + ox, e.y + e.r * 0.6, {});
      if (c && type === 'drone') {
        c.lane = e.x + ox;
        c.t = i * 0.3;
      }
    }
    fx.glow(e.x, e.y + e.r * 0.5, e.r * 1.2, '#ff8a6a', 0.3);
    sfxAt('drop', e.x, e.y, { pitch: 0.6, volume: 0.5 });
  }

  /* Starts a burst when the cooldown allows */
  function tryFire(e, dt, t, lead) {
    if (!e.def.fire || e.burst > 0) return;
    e.cd -= dt;
    if (e.cd > 0) return;
    const f = e.def.fire;
    e.cd = f.rate * (0.85 + R() * 0.3);
    e.burst = f.burst;
    e.burstT = 0;
    e.lead = !!lead;
  }

  function fireBurst(e, dt) {
    if (e.burst <= 0) return;
    e.burstT -= dt;
    if (e.burstT > 0) return;
    const f = e.def.fire;
    e.burstT = f.gap;
    --e.burst;
    const t = e.target;
    if (!t) { e.burst = 0; return; }
    let tx = t.x, ty = t.y;
    if (e.lead) {
      const d = Math.sqrt((tx - e.x) * (tx - e.x) + (ty - e.y) * (ty - e.y));
      const tt = d / f.speed;
      tx += (t.vx || 0) * tt * 0.8;
      ty += (t.vy || 0) * tt * 0.8;
    }
    const base = e.type === 'turret' ? e.barrel : Math.atan2(ty - e.y, tx - e.x);
    const n = f.count || 1;
    const muzzle = e.r * 0.9;
    const mx = e.x + Math.cos(base) * muzzle, my = e.y + Math.sin(base) * muzzle;
    for (let i = 0; i < n; ++i) {
      const a = n > 1 ? (f.arc >= 6 ? base + i * TAU / n : base + (i / (n - 1) - 0.5) * f.arc) : base + (R() - 0.5) * 0.06;
      NS.projectiles.enemyShot(f.kind, mx, my, a, f.speed, f.dmg, f.color);
    }
    fx.muzzle(mx, my, base, f.color === 'violet' ? '#e0b0ff' : '#ffb090');
    sfxAt(f.kind === 'orb' ? 'thud' : 'shoot', e.x, e.y, { volume: f.kind === 'orb' ? 0.4 : 0.18, pitch: f.kind === 'orb' ? 0.8 : 0.7 });
  }

  /* Ships nudge apart (checked a few times per second each, staggered) */
  function separate(e, dt) {
    e.sepT -= dt;
    if (e.sepT > 0) return;
    e.sepT = 0.12;
    const grid = NS.combat.grid;
    grid.query(e.x, e.y, e.r * 2, near);
    for (let i = 0; i < near.length; ++i) {
      const o = near[i];
      if (o === e || !o.alive || o.kind === 'mine') continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      const min = e.r + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) * 6;
        e.vx += dx / d * push;
        e.vy += dy / d * push;
      }
    }
  }

  function clear() {
    G.enemies.length = 0;
  }

  Object.assign(NS.enemies, {
    spawn, launch, update, clear, chooseTarget, startLeave, despawn, tryFire, fireLance, spawnChildren
  });
})();
