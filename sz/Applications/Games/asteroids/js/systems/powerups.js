/* Pickups and power-ups: weighted drops, floating capsules, story shards and seasonal tokens,
   stardust motes that stream to the ship inside the tractor reach, collecting, the effect of
   each of the twelve power-ups (timed ones run on the ship, instant ones fire at once) and their
   expiry. Owns G.pickups and G.motes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const C = NS.constants;
  const { TAU, FIELD_W, FIELD_H } = C;
  const { POWERUPS, POWER_ORDER } = NS.powerData;
  const { wrap, wrapD, fx: R } = NS.rng;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { compact } = NS.grid;

  function rng() {
    return NS.sim.rng();
  }

  /* a weighted random power-up, honouring the run's rules */
  function pick() {
    const mods = (G.run && G.run.mods) || [];
    let total = 0;
    const pool = [];
    for (let i = 0; i < POWER_ORDER.length; ++i) {
      const k = POWER_ORDER[i];
      if (k === 'shield' && mods.indexOf('glass') >= 0) continue;
      if (k === 'life' && G.run && G.run.mode === 'zen') continue;
      pool.push(k);
      total += POWERUPS[k].w;
    }
    let r = rng() * total;
    for (let i = 0; i < pool.length; ++i) {
      r -= POWERUPS[pool[i]].w;
      if (r <= 0) return pool[i];
    }
    return pool[0];
  }

  function drop(x, y, kind) {
    return spawnPickup('power', x, y, 1, kind || pick());
  }

  /* kind: power, shard, token, pod-less loot; n copies scatter a little */
  function spawnPickup(kind, x, y, n, pk) {
    let last = null;
    for (let i = 0; i < (n || 1); ++i) {
      const a = rng() * TAU, s = 30 + rng() * 50;
      last = { alive: true, kind: kind, pk: pk || null, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: kind === 'power' ? 12 : 14, t: 0 };
      G.pickups.push(last);
    }
    return last;
  }

  /* stardust: amount split into a few motes */
  function motes(x, y, amount, col) {
    let left = Math.max(1, Math.round(amount));
    let n = Math.min(8, left);
    while (left > 0 && G.motes.length < C.MAX_MOTES) {
      const v = Math.ceil(left / n);
      left -= v;
      --n;
      const a = R() * TAU, s = 60 + R() * 160;
      G.motes.push({ alive: true, x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, v: v, life: 9, col: col || '#bfe8ff', t: 0 });
      if (n <= 0) n = 1;
    }
  }

  function reach() {
    const s = G.ship;
    return G.stats.magnet * (s && s.power.magnet ? 8 : 1);
  }

  function update(dt) {
    const s = G.ship;
    const alive = s && !s.dead && s.hyperT <= 0;
    const rr = reach();
    /* stardust */
    for (let i = 0; i < G.motes.length; ++i) {
      const m = G.motes[i];
      m.t += dt;
      m.life -= dt;
      if (m.life <= 0) { m.alive = false; continue; }
      const k = Math.max(0, 1 - 2.2 * dt);
      m.vx *= k;
      m.vy *= k;
      if (alive && m.t > 0.35) {
        const dx = wrapD(s.x - m.x, FIELD_W), dy = wrapD(s.y - m.y, FIELD_H);
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 20) {
          m.alive = false;
          NS.progress.dust(m.v);
          if (R() < 0.5) sfx('coin', { volume: 0.18, pitch: 1.5 + R() * 0.4 });
          fx.glow(s.x, s.y, 14, m.col, 0.15);
          continue;
        }
        if (d < rr || (G.run && G.run.cleared)) {
          const pull = 900 * (1 - Math.min(1, d / Math.max(rr, 1)) * 0.6);
          m.vx += dx / d * pull * dt;
          m.vy += dy / d * pull * dt;
        }
      }
      m.x = wrap(m.x + m.vx * dt, FIELD_W);
      m.y = wrap(m.y + m.vy * dt, FIELD_H);
    }
    compact(G.motes);

    /* capsules, shards, tokens */
    for (let i = 0; i < G.pickups.length; ++i) {
      const p = G.pickups[i];
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const k = Math.max(0, 1 - 0.8 * dt);
      p.vx *= k;
      p.vy *= k;
      if (alive) {
        const dx = wrapD(s.x - p.x, FIELD_W), dy = wrapD(s.y - p.y, FIELD_H);
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < s.r + 16) {
          p.alive = false;
          collect(p);
          continue;
        }
        if (d < rr * 0.8 && p.t > 0.4) {
          p.vx += dx / d * 500 * dt;
          p.vy += dy / d * 500 * dt;
        }
      }
      p.x = wrap(p.x + p.vx * dt, FIELD_W);
      p.y = wrap(p.y + p.vy * dt, FIELD_H);
    }
    compact(G.pickups);
  }

  function collect(p) {
    const s = G.ship;
    if (p.kind === 'shard') {
      NS.progress.objective(1);
      fx.text(p.x, p.y - 14, '+1 SHARD', '#ffd25a', 15);
      fx.sparks(p.x, p.y, 0, TAU, 10, '#ffd25a', 220, 0.3);
      sfx('coin', { pitch: 1.2 });
      return;
    }
    if (p.kind === 'token') {
      NS.progress.token(1);
      fx.text(p.x, p.y - 14, '+1 ' + G.cal.seasonDef.tokenName.toUpperCase().replace(/S$/, ''), G.cal.seasonDef.tokenCol, 15);
      fx.shapes(p.x, p.y, 6, 140, NS.rocks.decorShape(G.cal.season), G.cal.seasonDef.tokenCol);
      sfx('pickup', { pitch: 1.3 });
      return;
    }
    const k = p.pk;
    const D = POWERUPS[k];
    NS.progress.count('powerups', 1);
    fx.text(s.x, s.y - 30, D.name.toUpperCase(), D.col, 18, 1.2);
    fx.ring(s.x, s.y, 10, 60, 0.35, D.col, 5);
    fx.sparks(s.x, s.y, 0, TAU, 14, D.col, 260, 0.3);
    s.squash = 0.8;
    sfx('powerup');
    apply(k);
  }

  function apply(k) {
    const s = G.ship;
    const D = POWERUPS[k];
    const mods = (G.run && G.run.mods) || [];
    if (D.dur > 0) {
      const dur = D.dur * G.stats.puDur * (mods.indexOf('frenzy') >= 0 ? 0.5 : 1);
      s.power[k] = Math.max(s.power[k] || 0, dur);
      if (k === 'shield') s.shield = true;
      return;
    }
    switch (k) {
      case 'nova': nova(); break;
      case 'gravity': NS.hazards.hole(wrap(s.x + Math.cos(s.a) * 160, FIELD_W), wrap(s.y + Math.sin(s.a) * 160, FIELD_H), true); break;
      case 'life':
        if (G.run) G.run.lives = Math.min(9, G.run.lives + 1);
        fx.text(s.x, s.y - 50, '1UP', '#6dff9a', 22);
        sfx('levelup');
        break;
    }
  }

  function nova() {
    const s = G.ship;
    fx.flash('#ffffff', 0.8);
    fx.shockwave(s.x, s.y, 900, '#ffffff');
    fx.shake(0.9);
    fx.hitStop(0.1);
    sfx('explode', { pitch: 0.5 });
    NS.progress.count('novas', 1);
    const rocks = G.rocks.slice();
    for (let i = 0; i < rocks.length; ++i) if (rocks[i].alive) NS.rocks.shatter(rocks[i], undefined, 'nova');
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive) NS.enemies.destroy(G.enemies[i]);
    if (G.boss) NS.bosses.damageCore(G.boss, 10, G.boss.x, G.boss.y);
    G.eBullets.length = 0;
  }

  function expired(k) {
    const s = G.ship;
    if (!s || s.dead) return;
    const D = POWERUPS[k];
    if (D) fx.text(s.x, s.y + 30, D.name + ' faded', '#9fb0d0', 12, 0.9);
    sfx('drop', { volume: 0.3 });
  }

  Object.assign(NS.powerups, {
    pick, drop, spawnPickup, motes, update, collect, apply, expired, reach
  });
})();
