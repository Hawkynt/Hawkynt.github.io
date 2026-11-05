/* The player ship: classic rotate-and-thrust flight on the wrapping field (or turning toward a
   pointer aim), braking, engine trails in the equipped style, hyperspace jumps (safe landing
   with the tech node), the overdrive blast, getting hit (shield, last stand, Zen knock-back,
   losing a ship) and respawning when the centre is clear. Owns G.ship. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, FIELD_W, FIELD_H } = C;
  const { wrap, wrapD, turnToward, fx: R } = NS.rng;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function create(x, y) {
    G.ship = {
      x: x, y: y, vx: 0, vy: 0, a: -Math.PI / 2, r: C.SHIP_R,
      dead: false, respawnT: 0, invuln: G.stats.invuln, hyperT: 0, hyperCd: 0,
      shield: G.stats.startShield > 0, lastStand: G.stats.lastStand > 0,
      fireT: 0, thrusting: false, hitT: 0, squash: 0, bank: 0, trailT: 0,
      power: {}, beamOn: false, odT: 0,
    };
    return G.ship;
  }

  function update(dt, intent) {
    const s = G.ship;
    if (!s) return;
    if (s.dead) {
      s.respawnT -= dt;
      if (s.respawnT <= 0 && G.run && G.run.lives > 0 && (centreClear() || s.respawnT < -2.5)) respawn();
      return;
    }
    const st = G.stats;
    s.hitT = Math.max(0, s.hitT - dt);
    s.invuln = Math.max(0, s.invuln - dt);
    s.hyperCd = Math.max(0, s.hyperCd - dt);
    s.squash = Math.max(0, s.squash - dt * 4);
    s.odT = Math.max(0, s.odT - dt);
    for (const k in s.power) {
      s.power[k] -= dt;
      if (s.power[k] <= 0) {
        delete s.power[k];
        if (k === 'shield') s.shield = false;
        NS.powerups.expired(k);
      }
    }

    if (s.hyperT > 0) {
      s.hyperT -= dt;
      if (s.hyperT <= 0) land();
      return;
    }

    /* steering: keys turn, a pointer or stick aim turns toward the aim */
    const turnRate = C.TURN * st.turn;
    let turning = 0;
    if (intent.aimAngle !== null && intent.aimAngle !== undefined) {
      const before = s.a;
      s.a = turnToward(s.a, intent.aimAngle, turnRate * 1.25 * dt);
      turning = Math.sign(s.a - before);
    } else if (intent.turn) {
      s.a += intent.turn * turnRate * dt;
      turning = intent.turn;
    }
    s.a = (s.a + TAU) % TAU;
    s.bank += (turning * 0.6 - s.bank) * Math.min(1, dt * 8);

    s.thrusting = !!intent.thrust;
    if (s.thrusting) {
      const t = C.THRUST * st.thrust;
      s.vx += Math.cos(s.a) * t * dt;
      s.vy += Math.sin(s.a) * t * dt;
      trail(dt);
    }
    const drift = G.run && G.run.mods && G.run.mods.indexOf('drift') >= 0;
    let drag = drift ? 0.04 : C.DRAG;
    if (intent.brake) drag += 2.6 * st.brake;
    if (NS.hazards.slowAt(s.x, s.y)) drag += 2.2;
    const k = Math.max(0, 1 - drag * dt);
    s.vx *= k;
    s.vy *= k;
    const max = C.MAX_SPEED * st.speed;
    const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (sp > max) {
      s.vx *= max / sp;
      s.vy *= max / sp;
    }
    s.x = wrap(s.x + s.vx * dt, FIELD_W);
    s.y = wrap(s.y + s.vy * dt, FIELD_H);
    if (G.run) G.save.stats.distance += sp * dt / 1000;

    if (intent.hyperQ) hyper();
    if (intent.overQ) overdrive();
  }

  function trail(dt) {
    const s = G.ship;
    const look = NS.cosmetics.find('trail', G.save.look.trail) || NS.cosmetics.TRAILS[0];
    const cols = look.cols;
    const bx = s.x - Math.cos(s.a) * 14, by = s.y - Math.sin(s.a) * 14;
    const back = s.a + Math.PI;
    s.trailT -= dt;
    const jx = (R() - 0.5) * 4, jy = (R() - 0.5) * 4;
    const ev = 160 + R() * 80;
    const evx = Math.cos(back + (R() - 0.5) * 0.4) * ev + s.vx * 0.3, evy = Math.sin(back + (R() - 0.5) * 0.4) * ev + s.vy * 0.3;
    fx.exhaust(bx + jx, by + jy, evx, evy, 9, cols[1], cols.length >= 3 ? [cols[0], cols[1], cols[2]] : null);
    if (s.trailT > 0) return;
    s.trailT = 0.04;
    switch (look.style) {
      case 'ember': fx.embers(bx, by, 1, 90, [cols[0], cols[1], cols[1], cols[2], cols[2]]); break;
      case 'prism': {
        const p = fx.exhaust(bx, by, evx * 0.5, evy * 0.5, 7, cols[Math.floor(G.time * 12) % cols.length]);
        if (p) p.life = p.max = 0.6;
        break;
      }
      case 'spark': fx.sparks(bx, by, back, 0.9, 2, cols[1 + Math.floor(R() * 2)], 260, 0.4); break;
      case 'snow': fx.shapes(bx, by, 1, 50, 0, cols[1]); break;
      case 'petal': fx.shapes(bx, by, 1, 50, 1, cols[Math.floor(R() * 2)]); break;
      case 'leaf': fx.shapes(bx, by, 1, 50, 2, cols[Math.floor(R() * 3)]); break;
      case 'ghost': {
        const p = fx.glow(bx, by, 10, cols[1], 0.8, evx * 0.2, evy * 0.2 - 20, 6);
        if (p) p.drag = 1;
        break;
      }
    }
  }

  /* ── hyperspace ── */
  function hyper() {
    const s = G.ship;
    if (s.hyperCd > 0 || s.hyperT > 0) return;
    s.hyperT = C.HYPER_TIME;
    s.hyperCd = G.stats.hyperCd;
    fx.ring(s.x, s.y, 30, 4, 0.3, '#bff4ff', 4);
    fx.sparks(s.x, s.y, 0, TAU, 18, '#bff4ff', 340, 0.3);
    fx.glow(s.x, s.y, 50, '#bff4ff', 0.2);
    sfx('whoosh', { pitch: 1.4 });
    NS.progress.count('hypers', 1);
  }

  function land() {
    const s = G.ship;
    let best = { x: FIELD_W / 2, y: FIELD_H / 2 }, bestD = -1e9;
    const tries = G.stats.safeHyper ? 24 : 1;
    for (let i = 0; i < tries; ++i) {
      const x = 60 + NS.sim.rng() * (FIELD_W - 120), y = 60 + NS.sim.rng() * (FIELD_H - 120);
      const d = dangerDistance(x, y);
      if (d > bestD) { bestD = d; best = { x: x, y: y }; }
      if (d > 220) break;
    }
    s.x = best.x;
    s.y = best.y;
    s.vx *= 0.2;
    s.vy *= 0.2;
    s.invuln = Math.max(s.invuln, 0.35);
    s.squash = 1;
    fx.ring(s.x, s.y, 4, 46, 0.35, '#bff4ff', 5);
    fx.glow(s.x, s.y, 60, '#bff4ff', 0.25);
    sfx('zap', { pitch: 1.3, volume: 0.6 });
  }

  /* how far the nearest threat is from a point */
  function dangerDistance(x, y) {
    let d = 1e9;
    const lists = [G.rocks, G.enemies];
    for (let l = 0; l < lists.length; ++l)
      for (let i = 0; i < lists[l].length; ++i) {
        const o = lists[l][i];
        const dx = wrapD(o.x - x, FIELD_W), dy = wrapD(o.y - y, FIELD_H);
        d = Math.min(d, Math.sqrt(dx * dx + dy * dy) - (o.r || 0));
      }
    if (G.boss) {
      const dx = wrapD(G.boss.x - x, FIELD_W), dy = wrapD(G.boss.y - y, FIELD_H);
      d = Math.min(d, Math.sqrt(dx * dx + dy * dy) - G.boss.r * 1.6);
    }
    return d;
  }

  function centreClear() {
    return dangerDistance(FIELD_W / 2, FIELD_H / 2) > 140;
  }

  function respawn() {
    const s = G.ship;
    s.dead = false;
    s.x = FIELD_W / 2;
    s.y = FIELD_H / 2;
    s.vx = s.vy = 0;
    s.a = -Math.PI / 2;
    s.invuln = G.stats.invuln;
    s.shield = G.stats.startShield > 0;
    s.power = {};
    s.squash = 1;
    fx.ring(s.x, s.y, 80, 6, 0.5, '#5ad8ff', 4);
    fx.glow(s.x, s.y, 80, '#5ad8ff', 0.4);
    sfx('powerup', { pitch: 0.8, volume: 0.6 });
  }

  /* ── overdrive ── */
  function overdrive() {
    const s = G.ship;
    if (G.overdrive < 1) {
      if (G.overdrive > 0.05) sfx('error', { volume: 0.3 });
      return;
    }
    G.overdrive = 0;
    s.odT = 0.6;
    const st = G.stats;
    NS.collision.blast(s.x, s.y, st.odRadius, st.odDmg, true, 520);
    fx.shockwave(s.x, s.y, st.odRadius, '#d08aff');
    fx.ring(s.x, s.y, 20, st.odRadius * 1.15, 0.7, '#ffffff', 3);
    fx.sparks(s.x, s.y, 0, TAU, 40, '#e8c8ff', 600, 0.5);
    fx.flash('#d08aff', 0.35);
    fx.hitStop(0.06);
    fx.shake(0.5);
    fx.punch(0.04);
    if (st.odSlow) fx.slowMo(2, 0.35);
    s.invuln = Math.max(s.invuln, 0.8);
    sfx('explode', { pitch: 0.7 });
    sfx('zap', { pitch: 0.6 });
    NS.progress.count('overdrives', 1);
  }

  /* ── getting hit ── */
  function hit(srcX, srcY) {
    const s = G.ship;
    if (!s || s.dead || s.hyperT > 0 || s.invuln > 0) return false;
    const dx = wrapD(s.x - srcX, FIELD_W), dy = wrapD(s.y - srcY, FIELD_H);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (s.shield) {
      s.shield = false;
      delete s.power.shield;
      s.invuln = 1;
      s.vx += dx / d * 240;
      s.vy += dy / d * 240;
      fx.ring(s.x, s.y, 20, 70, 0.4, '#4ab8ff', 6);
      fx.sparks(s.x, s.y, 0, TAU, 20, '#9ad8ff', 360, 0.35);
      fx.shake(0.3);
      sfx('hit', { pitch: 1.3 });
      return false;
    }
    if (G.run && G.run.mode === 'zen') {
      s.invuln = 1.4;
      s.vx += dx / d * 300;
      s.vy += dy / d * 300;
      s.hitT = 0.3;
      G.combo = 0;
      fx.ring(s.x, s.y, 10, 60, 0.4, '#6dff9a', 4);
      fx.shake(0.2);
      sfx('bounce', { pitch: 0.7 });
      return false;
    }
    if (s.lastStand) {
      s.lastStand = false;
      s.invuln = 2;
      s.hitT = 0.5;
      fx.banner('LAST STAND', 'The hull holds - barely', '#ff5a6a', 1.6);
      fx.flash('#ff5a6a', 0.4);
      fx.slowMo(0.8, 0.3);
      fx.shake(0.5);
      sfx('hurt');
      return false;
    }
    die();
    return true;
  }

  function die() {
    const s = G.ship;
    s.dead = true;
    s.respawnT = 1.6;
    s.power = {};
    s.shield = false;
    fx.explode(s.x, s.y, 46, fx.PLASMA, { pal: ['#ffffff', '#c8d8f0', '#3a4a6a', '#5ad8ff'] });
    fx.flash('#ffffff', 0.5);
    fx.hitStop(0.12);
    fx.slowMo(0.9, 0.3);
    fx.shake(0.8);
    sfx('explode');
    sfx('lose', { volume: 0.5 });
    G.combo = 0;
    NS.progress.shipLost();
  }

  Object.assign(NS.ship, {
    create, update, hit, die, hyper, overdrive, dangerDistance, respawn
  });
})();
