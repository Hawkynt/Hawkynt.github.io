/* Unit abilities in a trip: casting by hand (every selected craft of a kind with its ability
   ready) and auto-cast when it makes sense, cooldowns, and the effects - the Herder's tether
   pulling loose rocks into a clump, the Minelayer's contact mines, the Aegis bubble soaking
   damage for allied craft and the ship, the Phantom's cloak, the Lancer's overcharged rail
   that pierces a line, the Bulwark's barrage, the Sporecaster's spores and the Spike's hijack.
   Owns its effect lists (cleared per trip). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { ABILITIES } = NS.fleetData;
  const R = NS.rng.fx;
  const A = { herds: [], mines: [], bubbles: [], rails: [], barrages: [], think: 0 };
  const near = [];

  function clear() {
    A.herds.length = A.mines.length = A.bubbles.length = A.rails.length = A.barrages.length = 0;
    A.think = 0;
  }

  function state() {
    return A;
  }

  function abilityOf(u) {
    return u && u.def && u.def.ability ? ABILITIES[u.def.ability] : null;
  }

  function ready(u) {
    return !!abilityOf(u) && u.alive && !(u.abCd > 0) && u.side === 'player';
  }

  function autoOn(u) {
    return u.auto === undefined ? abilityOf(u).auto : u.auto;
  }

  function enemiesNear(x, y, r) {
    let n = 0;
    const list = NS.enemies.queryHostile(x, y, r, near);
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      if (e.alive && !e.dormant && e.side !== 'player' && (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y) < r * r) ++n;
    }
    return n;
  }

  /* ── casting ── */
  /* p: the target point (the herd's centre, the barrage's target); returns true when cast */
  function cast(u, p) {
    if (!ready(u)) return false;
    const ab = abilityOf(u), id = u.def.ability;
    if (id === 'herd') herd(u, p || { x: u.x + Math.cos(u.angle) * 260, y: u.y + Math.sin(u.angle) * 260 }, ab);
    else if (id === 'mines') mines(u, ab);
    else if (id === 'bubble') A.bubbles.push({ u: u, x: u.x, y: u.y, r: ab.radius, hp: ab.hp, maxHp: ab.hp, t: ab.dur, hit: 0 });
    else if (id === 'cloak') cloak(u, ab);
    else if (id === 'overcharge') u.charged = true;
    else if (id === 'spores') {
      /* a spore pod at the nearest Syndicate structure in reach (or the point given) */
      const t = p && NS.aiBase.nearestStructure(p.x, p.y, ab.radius) || NS.aiBase.nearestStructure(u.x, u.y, ab.reach);
      if (!t || Math.hypot(t.x - u.x, t.y - u.y) > ab.reach + t.r) return false;
      G.tbeams.push({ x0: u.x, y0: u.y, x1: t.x, y1: t.y, t: 0.4, color: '#9ae04a', soft: true });
      NS.aiBase.sporeAt(t.x, t.y);
    }
    else if (id === 'hijack') { if (!NS.aiBase.hijack(u)) return false; }
    else if (id === 'barrage') {
      const t = p || (u.target && u.target.alive ? u.target : null);
      if (!t) return false;
      for (let k = 0; k < ab.shells; ++k)
        A.barrages.push({ u: u, x: t.x + (R() - 0.5) * ab.spread * 2, y: t.y + (R() - 0.5) * ab.spread * 2, t: k * ab.every, cx: t.x, cy: t.y, left: ab.shells * ab.every + 1 });
    }
    u.abCd = ab.cd * (G.stats && G.stats.abilityCd || 1);
    NS.fx.ring(u.x, u.y, u.r, u.r * 3, 0.4, u.def.color, 3);
    NS.audio.sfxAt('powerup', u.x, u.y, { volume: 0.4, pitch: 1.2 });
    return true;
  }

  /* every selected craft of the kind (all kinds when none given) with its ability ready */
  function castSelected(sel, kind, p) {
    let n = 0;
    for (let i = 0; i < sel.length; ++i) if ((!kind || sel[i].type === kind) && cast(sel[i], p)) ++n;
    return n;
  }

  function herd(u, p, ab) {
    /* never into the outpost site: the point moves out past its edge */
    if (G.base && NS.base.blocks(p.x, p.y, 60)) {
      const s = G.base.site, cx = s.cx, cy = s.cy, d = Math.hypot(p.x - cx, p.y - cy) || 1;
      const out = Math.max(s.w, s.h) * 0.75 + 120;
      p = { x: cx + (p.x - cx) / d * out, y: cy + (p.y - cy) / d * out };
    }
    const rocks = [];
    const list = NS.asteroids.queryRocks(p.x, p.y, ab.radius, []);
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o.alive && o.kind === 'rock' && o.r < 80 && !o.towed) rocks.push(o);
    }
    A.herds.push({ u: u, x: p.x, y: p.y, t: ab.dur, rocks: rocks, pull: ab.pull });
  }

  function mines(u, ab) {
    /* the oldest of its own mines go when a new ring would pass the limit */
    const own = A.mines.filter(m => m.u === u && !m.dead);
    for (let k = 0; k < own.length + ab.n - ab.max; ++k) own[k].dead = true;
    for (let k = 0; k < ab.n; ++k) {
      const a = k / ab.n * TAU + R() * 0.3;
      A.mines.push({ u: u, x: u.x + Math.cos(a) * ab.ring, y: u.y + Math.sin(a) * ab.ring, arm: ab.arm, life: ab.life, dead: false, ab: ab });
    }
  }

  function cloak(u, ab) {
    for (let i = 0; i < G.units.length; ++i) {
      const o = G.units[i];
      if (o.alive && o.side === 'player' && Math.hypot(o.x - u.x, o.y - u.y) < ab.radius) o.cloakT = Math.max(o.cloakT || 0, ab.dur * (G.stats && G.stats.cloakDur || 1));
    }
    const s = G.ship;
    if (s && s.alive && Math.hypot(s.x - u.x, s.y - u.y) < ab.radius) s.cloak = Math.max(s.cloak || 0, ab.dur * (G.stats && G.stats.cloakDur || 1));
  }

  /* the Lancer's charged shot: everything within the line's width takes double damage */
  function rail(u, t, dmg, side) {
    const ab = ABILITIES.overcharge;
    const a = Math.atan2(t.y - u.y, t.x - u.x), ca = Math.cos(a), sa = Math.sin(a);
    const x1 = u.x + ca * ab.length, y1 = u.y + sa * ab.length;
    const list = NS.enemies.queryHostile((u.x + x1) / 2, (u.y + y1) / 2, ab.length / 2 + 40, near).slice();
    let hits = 0;
    for (let i = 0; i < list.length; ++i) {
      const e = list[i];
      if (!e.alive || e.dormant || e.side === 'player') continue;
      const along = (e.x - u.x) * ca + (e.y - u.y) * sa;
      const off = Math.abs((e.y - u.y) * ca - (e.x - u.x) * sa);
      if (along > 0 && along < ab.length && off < ab.width + (e.r || 0)) { NS.enemies.hitTarget(e, dmg * ab.mul, side, u, 'kinetic'); ++hits; }
    }
    A.rails.push({ x0: u.x, y0: u.y, x1: x1, y1: y1, t: 0.4 });
    u.charged = false;
    NS.fx.shake(0.15);
    NS.audio.sfxAt('laser', u.x, u.y, { volume: 0.5, pitch: 0.5 });
    return hits;
  }

  /* what reaches a craft or the ship after the bubbles over it soak their share */
  function absorb(t, amount) {
    for (let i = 0; i < A.bubbles.length && amount > 0; ++i) {
      const b = A.bubbles[i];
      if (b.hp <= 0 || (t.x - b.x) * (t.x - b.x) + (t.y - b.y) * (t.y - b.y) > b.r * b.r) continue;
      const k = Math.min(b.hp, amount);
      b.hp -= k;
      b.hit = 0.15;
      amount -= k;
    }
    return amount;
  }

  /* ── per step ── */
  function update(dt) {
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (u.abCd > 0) u.abCd -= dt;
      if (u.cloakT > 0) u.cloakT -= dt;
    }
    A.think -= dt;
    if (A.think <= 0) {
      A.think = 0.5;
      for (let i = 0; i < G.units.length; ++i) {
        const u = G.units[i];
        if (ready(u) && autoOn(u)) autoCast(u);
      }
    }
    herds(dt);
    minesStep(dt);
    for (let i = 0; i < A.bubbles.length; ++i) {
      const b = A.bubbles[i];
      b.t -= dt;
      if (b.hit > 0) b.hit -= dt;
      if (b.u.alive) { b.x = b.u.x; b.y = b.u.y; }
      if (b.t <= 0 || b.hp <= 0 || !b.u.alive) b.dead = true;
    }
    for (let i = 0; i < A.rails.length; ++i) if ((A.rails[i].t -= dt) <= 0) A.rails[i].dead = true;
    for (let i = 0; i < A.barrages.length; ++i) {
      const s = A.barrages[i];
      s.left -= dt;
      if ((s.t -= dt) > 0) continue;
      s.dead = true;
      if (!s.u.alive) continue;
      const def = s.u.def;
      NS.enemies.fire('player', 'artillery', s.u.x, s.u.y, { x: s.x, y: s.y, vx: 0, vy: 0, alive: true }, s.u.dmg, 380, { splash: def.splash, from: s.u });
      NS.audio.sfxAt('explode', s.u.x, s.u.y, { volume: 0.2, pitch: 1.6 });
    }
    keep(A.herds); keep(A.mines); keep(A.bubbles); keep(A.rails); keep(A.barrages);
  }

  function keep(list) {
    let j = 0;
    for (let i = 0; i < list.length; ++i) if (!list[i].dead) list[j++] = list[i];
    list.length = j;
  }

  /* when each combat ability pays off */
  function autoCast(u) {
    const id = u.def.ability, ab = ABILITIES[id];
    if (id === 'mines') { if (enemiesNear(u.x, u.y, 520)) cast(u); return; }
    if (id === 'bubble') {
      if (!enemiesNear(u.x, u.y, 600)) return;
      const s = G.ship;
      const hurt = G.units.some(o => o.alive && o.side === 'player' && o.flash > 0 && Math.hypot(o.x - u.x, o.y - u.y) < ab.radius) ||
        (s && s.alive && s.shieldT > 2.5 && Math.hypot(s.x - u.x, s.y - u.y) < ab.radius);
      if (hurt) cast(u);
      return;
    }
    if (id === 'cloak') {
      if (enemiesNear(u.x, u.y, 450) && G.units.some(o => o.alive && o.side === 'player' && o.hp < o.maxHp * 0.5 && Math.hypot(o.x - u.x, o.y - u.y) < ab.radius)) cast(u);
      return;
    }
    if (id === 'overcharge') {
      const t = u.target;
      if (!t || !t.alive) return;
      const a = Math.atan2(t.y - u.y, t.x - u.x), ca = Math.cos(a), sa = Math.sin(a);
      let n = 0;
      for (let i = 0; i < G.enemies.length; ++i) {
        const e = G.enemies[i];
        if (!e.alive || e.dormant) continue;
        const along = (e.x - u.x) * ca + (e.y - u.y) * sa, off = Math.abs((e.y - u.y) * ca - (e.x - u.x) * sa);
        if (along > 0 && along < ABILITIES.overcharge.length && off < ABILITIES.overcharge.width + e.r) ++n;
      }
      if (n >= 2) cast(u);
      return;
    }
    if (id === 'spores') { if (NS.aiBase.nearestStructure(u.x, u.y, ab.reach)) cast(u); return; }
    if (id === 'hijack') { if (G.enemies.some(e => e.alive && e.def.structure && e.def.dmg && !e.def.capital && e.type !== 'syn_core' && Math.hypot(e.x - u.x, e.y - u.y) < ab.reach)) cast(u); return; }
    if (id === 'barrage') {
      const t = u.target;
      if (t && t.alive && (t.r >= 28 || (t.def && t.def.boss)) && Math.hypot(t.x - u.x, t.y - u.y) < u.range) cast(u);
    }
  }

  function herds(dt) {
    for (let i = 0; i < A.herds.length; ++i) {
      const h = A.herds[i];
      h.t -= dt;
      if (h.t <= 0 || !h.u.alive) { h.dead = true; for (const o of h.rocks) if (o.alive) { o.vx *= 0.2; o.vy *= 0.2; } continue; }
      for (let k = 0; k < h.rocks.length; ++k) {
        const o = h.rocks[k];
        if (!o.alive) continue;
        const dx = h.x - o.x, dy = h.y - o.y, d = Math.hypot(dx, dy) || 1;
        /* a spring toward the clump's centre, damped so the rocks settle against each other */
        const want = Math.min(h.pull, d * 1.5);
        o.vx += (dx / d * want - o.vx) * Math.min(1, dt * 3);
        o.vy += (dy / d * want - o.vy) * Math.min(1, dt * 3);
      }
    }
  }

  function minesStep(dt) {
    for (let i = 0; i < A.mines.length; ++i) {
      const m = A.mines[i];
      m.life -= dt;
      if (m.life <= 0) { m.dead = true; continue; }
      if (m.arm > 0) { m.arm -= dt; continue; }
      if (!enemiesNear(m.x, m.y, m.ab.blast * 0.6)) continue;
      m.dead = true;
      const list = NS.enemies.queryHostile(m.x, m.y, m.ab.blast, near).slice();
      for (let k = 0; k < list.length; ++k) {
        const e = list[k];
        if (!e.alive || e.dormant || e.side === 'player') continue;
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d > m.ab.blast + (e.r || 0)) continue;
        NS.enemies.hitTarget(e, m.ab.dmg * (1 - 0.5 * d / m.ab.blast), 'player', m.u.alive ? m.u : null, 'explosive');
        if (e.alive && e.cx === undefined) e.stun = Math.max(e.stun || 0, m.ab.stun);
      }
      NS.fx.explode(m.x, m.y, m.ab.blast * 0.6, NS.fx.FIRE, { noDebris: true });
      NS.audio.sfxAt('explode', m.x, m.y, { volume: 0.5, pitch: 1.3 });
    }
  }

  Object.assign(NS.abilities, {
    clear, state, abilityOf, ready, autoOn, cast, castSelected, rail, absorb, update
  });
})();
