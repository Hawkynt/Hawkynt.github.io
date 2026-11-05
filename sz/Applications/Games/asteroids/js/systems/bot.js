/* The autopilot: flies the title screen's attract scene and plays levels in the completability
   tests. Each step it dodges the most urgent threat, fetches pods, shards and power-ups when the
   objective needs them, otherwise leads its aim on the nearest target and fires when lined up;
   unleashes overdrive into crowds and jumps when a crash is unavoidable. Returns flight intents in
   the same shape as player input; owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const { FIELD_W, FIELD_H } = C;
  const { wrapD, angleDiff } = NS.rng;

  const intent = { turn: 0, thrust: false, brake: false, fire: false, aimAngle: null, hyperQ: false, overQ: false };

  function rel(s, o) {
    const dx = wrapD(o.x - s.x, FIELD_W), dy = wrapD(o.y - s.y, FIELD_H);
    return { dx: dx, dy: dy, d: Math.sqrt(dx * dx + dy * dy) || 1 };
  }

  /* the most urgent thing about to hit the ship, by time to closest approach */
  function threat(s) {
    let best = null, bestT = 1e9;
    const consider = (o, r, vx, vy) => {
      const p = rel(s, o);
      const rvx = (vx || 0) - s.vx, rvy = (vy || 0) - s.vy;
      const v2 = rvx * rvx + rvy * rvy || 1;
      let t = -(p.dx * rvx + p.dy * rvy) / v2;
      if (t < 0) t = 0;
      if (t > 1.4) return;
      const cx = p.dx + rvx * t, cy = p.dy + rvy * t;
      const miss = Math.sqrt(cx * cx + cy * cy);
      const danger = r + s.r + 26;
      if (miss < danger && t < bestT) {
        bestT = t;
        best = { o: o, t: t, dx: p.dx, dy: p.dy, d: p.d, miss: miss };
      }
    };
    for (let i = 0; i < G.rocks.length; ++i) {
      const r = G.rocks[i];
      if (r.alive && !(G.stats.ram >= r.size)) consider(r, r.r * 0.85, r.vx, r.vy);
    }
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive) consider(G.enemies[i], G.enemies[i].r, G.enemies[i].vx, G.enemies[i].vy);
    for (let i = 0; i < G.eBullets.length; ++i) consider(G.eBullets[i], G.eBullets[i].r, G.eBullets[i].vx, G.eBullets[i].vy);
    if (G.boss && G.boss.dying <= 0) {
      consider(G.boss, G.boss.r * 0.85, G.boss.vx, G.boss.vy);
      for (let i = 0; i < G.boss.parts.length; ++i) if (G.boss.parts[i].alive) consider(G.boss.parts[i], G.boss.parts[i].r, 0, 0);
    }
    for (let i = 0; i < G.mines.length; ++i) consider(G.mines[i], 50, 0, 0);
    return best;
  }

  /* something to collect for the objective (or a nearby power-up) */
  function errand(s) {
    const L = G.level;
    let best = null, bd = 1e9;
    if (L && L.obj === 'rescue')
      for (let i = 0; i < G.pods.length; ++i) {
        const p = rel(s, G.pods[i]);
        if (p.d < bd) { bd = p.d; best = G.pods[i]; }
      }
    for (let i = 0; i < G.pickups.length; ++i) {
      const pk = G.pickups[i];
      const p = rel(s, pk);
      const want = pk.kind === 'shard' || pk.kind === 'token' || p.d < 260;
      if (want && p.d < bd) { bd = p.d; best = pk; }
    }
    return best;
  }

  function target(s) {
    let best = null, bd = 1e9;
    const pick = (o, w) => {
      const p = rel(s, o);
      const d = p.d * (w || 1);
      if (d < bd) { bd = d; best = o; }
    };
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive && NS.enemies.hittable(G.enemies[i])) pick(G.enemies[i], 0.7);
    for (let i = 0; i < G.rocks.length; ++i) if (G.rocks[i].alive) pick(G.rocks[i], 1);
    for (let i = 0; i < G.mines.length; ++i) pick(G.mines[i], 1.2);
    const b = G.boss;
    if (b && b.intro <= 0 && b.dying <= 0) {
      for (let i = 0; i < b.parts.length; ++i) if (b.parts[i].alive) pick(b.parts[i], 0.8);
      if (NS.bosses.coreOpen(b)) pick(b, 0.3);
    }
    return best;
  }

  function lead(s, o) {
    const p = rel(s, o);
    const sp = C.BULLET_SPEED * G.stats.shotSpeed;
    const t = p.d / sp;
    return Math.atan2(p.dy + ((o.vy || 0) - s.vy * 0.35) * t, p.dx + ((o.vx || 0) - s.vx * 0.35) * t);
  }

  /* the nearest beam or lightning link about to sweep over the ship: a push direction away from it */
  function beamDanger(s) {
    const b = G.boss;
    if (!b || b.dying > 0) return null;
    const segs = [];
    for (let i = 0; i < b.beams.length; ++i) {
      const bm = b.beams[i];
      if (bm.on > 0) segs.push([b.x, b.y, b.x + Math.cos(bm.a) * 1500, b.y + Math.sin(bm.a) * 1500, bm.warn > 0 ? 70 : 90]);
    }
    const links = NS.bosses.tempestLinks(b);
    for (let i = 0; i < links.length; ++i) segs.push([links[i].x0, links[i].y0, links[i].x1, links[i].y1, 60]);
    let best = null;
    for (let i = 0; i < segs.length; ++i) {
      const g = segs[i];
      const dx = g[2] - g[0], dy = g[3] - g[1];
      const len2 = dx * dx + dy * dy || 1;
      let t = ((s.x - g[0]) * dx + (s.y - g[1]) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = s.x - (g[0] + dx * t), py = s.y - (g[1] + dy * t);
      const d = Math.sqrt(px * px + py * py) || 1;
      if (d < g[4] && (!best || d < best.d)) best = { d: d, a: Math.atan2(py, px) };
    }
    return best;
  }

  function think() {
    const s = G.ship;
    intent.turn = 0;
    intent.thrust = false;
    intent.brake = false;
    intent.fire = false;
    intent.aimAngle = null;
    intent.hyperQ = false;
    intent.overQ = false;
    if (!s || s.dead || s.hyperT > 0) return intent;
    const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    const th = threat(s);
    const tgt = target(s);
    const job = errand(s);

    const beam = beamDanger(s);
    if (beam) {
      intent.aimAngle = beam.a;
      intent.thrust = Math.abs(angleDiff(s.a, beam.a)) < 1.3;
    } else if (th && th.t < 0.7) {
      /* sidestep: thrust perpendicular to the line of approach, on the side we already lean to */
      const away = Math.atan2(-th.dy, -th.dx);
      const side = (th.dx * s.vy - th.dy * s.vx) > 0 ? 1 : -1;
      intent.aimAngle = away + side * 0.9;
      intent.thrust = Math.abs(angleDiff(s.a, intent.aimAngle)) < 1.2;
      if (th.t < 0.12 && th.miss < s.r + 8 && s.hyperCd <= 0 && s.invuln <= 0 && !s.shield) intent.hyperQ = true;
    } else if (job) {
      const p = rel(s, job);
      intent.aimAngle = Math.atan2(p.dy, p.dx);
      const facing = Math.abs(angleDiff(s.a, intent.aimAngle)) < 0.5;
      intent.thrust = facing && speed < 260;
      intent.brake = !facing && speed > 160;
    } else if (tgt) {
      const p = rel(s, tgt);
      intent.aimAngle = lead(s, tgt);
      if (p.d > 380 && speed < 140) intent.thrust = Math.abs(angleDiff(s.a, intent.aimAngle)) < 0.4;
      if (speed > 220) intent.brake = true;
    }
    /* fire whenever something sits on the gun line */
    if (tgt) {
      const a = lead(s, tgt);
      const p = rel(s, tgt);
      const tol = Math.atan2((tgt.r || 12) + 6, p.d);
      if (Math.abs(angleDiff(s.a, a)) < tol + 0.04 && p.d < 640) intent.fire = true;
    }
    if (s.power.laser && tgt) intent.fire = true;
    if (G.overdrive >= 1) {
      let crowd = 0;
      for (let i = 0; i < G.rocks.length; ++i) if (G.rocks[i].alive && rel(s, G.rocks[i]).d < G.stats.odRadius * 0.8) ++crowd;
      if (crowd >= 4 || (th && th.t < 0.3) || (G.boss && rel(s, G.boss).d < G.stats.odRadius)) intent.overQ = true;
    }
    return intent;
  }

  Object.assign(NS.bot, {
    think
  });
})();
