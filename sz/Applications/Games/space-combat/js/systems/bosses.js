/* The five multi-part bosses: warp-in intro, movement styles (hover, serpent, stalk), parts that
   follow the hull (turrets, shield emitters, beam emitters, launchers, orbiting shards, serpent
   segments), weak points and core shields, phase changes, the attack library and the death
   sequence with slow motion. Owns G.boss. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const { BOSSES } = NS.enemyData;
  const { turnToward, angleDiff, segPointDist2, clamp } = NS.rng;
  const R = NS.rng.fx;
  const fx = NS.fx;
  const { sfx, sfxAt } = NS.audio;

  function spawn(id, x, y) {
    const def = BOSSES[id];
    const st = G.stage;
    const hpMul = st && st.bossHpMul ? st.bossHpMul : 1;
    const b = {
      alive: true, kind: 'boss', id: id, def: def, x: x, y: y, vx: 0, vy: 0, angle: Math.PI / 2, spin: 0,
      r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul, flash: 0, t: 0, phase: 0, attackT: 3, attackIdx: 0,
      parts: [], introT: 2.6, deathT: 0, dying: false, shieldHit: 0, mouth: 0, mouthT: 0, gravity: def.move.gravity || 0,
      spiralT: 0, spiralA: 0, spiralArms: 2, spiralCd: 0, chargeT: 0, beamT: 0, beamCharge: 0, beamA: 0, beamDir: 1,
      trail: [], fadeT: 0, teleportT: 0, speedMul: 1, exposedShown: false, vulnerable: true,
    };
    for (let i = 0; i < def.parts.length; ++i) addPart(b, def.parts[i], hpMul);
    if (def.move.type === 'serpent') {
      for (let i = 0; i < def.move.segments; ++i)
        addPart(b, { type: 'segment', hp: 200, r: i === def.move.segments - 1 ? 22 : 28 - i * 0.6, idx: i + 1 }, hpMul);
      for (let i = 0; i < 400; ++i) b.trail.push({ x: x, y: y + i * 6 });
    }
    G.boss = b;
    updateParts(b, 0);
    G.banner = { title: def.name, sub: def.title, t: 0, life: 3.2, color: '#ff5c6c' };
    sfx('lose', { pitch: 0.5, volume: 0.6 });
    fx.shake(0.4);
    return b;
  }

  function addPart(b, d, hpMul) {
    b.parts.push({
      alive: true, kind: 'part', boss: b, def: d, type: d.type, x: b.x, y: b.y, r: d.r,
      hp: d.hp * hpMul, maxHp: d.hp * hpMul, flash: 0, angle: 0, barrel: 0, cd: 1 + R() * 2, burst: 0, burstT: 0,
      idx: d.idx || 0, orbitA: d.a || 0, vx: 0, vy: 0, beamA: 0,
    });
  }

  function aliveParts(b, type) {
    let n = 0;
    for (let i = 0; i < b.parts.length; ++i)
      if (b.parts[i].alive && b.parts[i].type === type) ++n;
    return n;
  }

  function coreShielded(b) {
    const d = b.def;
    if (!d.shieldBy) return false;
    return aliveParts(b, d.shieldBy) > d.shieldMin;
  }

  /* How much of `dmg` the core takes from a hit arriving along `ang` (the shot's direction back toward its source) */
  function coreDamageScale(b, ang) {
    if (b.introT > 0 || b.dying || b.fadeT > 0.5) return 0;
    if (coreShielded(b)) return 0;
    const d = b.def;
    if (d.weak === 'mouth') return b.mouth > 0.5 ? 1.6 : 0.15;
    if (d.weak === 'rear' && ang !== undefined) {
      const front = Math.abs(angleDiff(b.angle, ang)) < d.arc;
      return front ? 0.35 : 1.5;
    }
    return 1;
  }

  function update(dt) {
    const b = G.boss;
    if (!b || !b.alive) return;
    const k = G.warp > 0 ? 0.4 : 1;
    const step = dt * k;
    b.t += step;
    if (b.flash > 0) b.flash -= dt;
    if (b.shieldHit > 0) b.shieldHit -= dt * 3;
    if (b.dying) {
      updateDeath(b, dt);
      return;
    }
    if (b.introT > 0) {
      b.introT -= dt;
      if (R() < 0.5) fx.glow(b.x + (R() - 0.5) * b.r * 3, b.y + (R() - 0.5) * b.r * 3, 30, '#ff8aa0', 0.3);
    }
    checkPhase(b);
    move(b, step);
    updateParts(b, step);
    if (b.introT <= 0) {
      attacks(b, step);
      continuous(b, step);
    }
    b.vulnerable = !coreShielded(b);
    if (b.vulnerable && b.def.shieldBy && !b.exposedShown) {
      b.exposedShown = true;
      G.banner = { title: 'CORE EXPOSED', sub: 'Hit the core!', t: 0, life: 2, color: '#ffd25a' };
      fx.shockwave(b.x, b.y, 260, '#ffd25a');
      sfx('levelup', { pitch: 0.8 });
    }
  }

  function checkPhase(b) {
    const ph = b.def.phases;
    const frac = b.hp / b.maxHp;
    let want = 0;
    for (let i = 0; i < ph.length; ++i)
      if (frac <= ph[i].at) want = i;
    if (want > b.phase) {
      b.phase = want;
      const p = ph[want];
      b.attackIdx = 0;
      b.attackT = 1.2;
      if (p.gravity) b.gravity = p.gravity;
      b.speedMul = p.speed || 1;
      G.banner = { title: 'PHASE ' + (want + 1), sub: b.def.name + ' grows desperate', t: 0, life: 2, color: '#ff8a5c' };
      fx.shockwave(b.x, b.y, 320, '#ff8a5c');
      fx.flash('#ffb090', 0.25);
      fx.shake(0.5);
      NS.projectiles.clearEnemyBullets(b.x, b.y, 2000);
      sfx('explode', { pitch: 0.6 });
    }
  }

  function move(b, dt) {
    const p = G.player;
    const m = b.def.move;
    const ph = b.def.phases[b.phase];
    const tx = p && p.alive ? p.x : G.world.w / 2, ty = p && p.alive ? p.y : G.world.h / 2;
    const dx = tx - b.x, dy = ty - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (m.type === 'serpent') {
      const speed = m.speed * b.speedMul * (b.chargeT > 0 ? 2.4 : 1);
      if (b.chargeT > 0) b.chargeT -= dt;
      const wave = b.chargeT > 0 ? 0 : Math.sin(b.t * 1.5) * 0.9;
      const want = Math.atan2(dy, dx) + wave + (d < m.dist ? 1.3 : 0);
      b.angle = turnToward(b.angle, want, (b.chargeT > 0 ? 3 : 1.7) * dt);
      b.vx = Math.cos(b.angle) * speed;
      b.vy = Math.sin(b.angle) * speed;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const last = b.trail[0];
      if ((b.x - last.x) * (b.x - last.x) + (b.y - last.y) * (b.y - last.y) > 36) {
        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > 420) b.trail.pop();
      }
    } else {
      const spin = ph.spin !== undefined ? ph.spin : m.spin || 0;
      const radial = (d - m.dist) / 200;
      const tang = Math.sin(b.t * 0.4) * 0.6;
      b.vx += (dx / d * radial - dy / d * tang) * m.speed * 2 * dt;
      b.vy += (dy / d * radial + dx / d * tang) * m.speed * 2 * dt;
      b.vx *= 1 - 1.2 * dt;
      b.vy *= 1 - 1.2 * dt;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp > m.speed * 1.5) { b.vx *= m.speed * 1.5 / sp; b.vy *= m.speed * 1.5 / sp; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (m.type === 'stalk' || b.id === 'maw') b.angle = turnToward(b.angle, Math.atan2(dy, dx), (m.turn || 0.6) * dt);
      else b.spin += spin * dt;
    }
    b.x = clamp(b.x, 200, G.world.w - 200);
    b.y = clamp(b.y, 200, G.world.h - 200);
    /* the Maw drags the player in */
    if (b.gravity && p && p.alive && d < 1500 && b.introT <= 0) {
      const pull = b.gravity * (1 - d / 1500) * 2;
      p.vx -= dx / d * pull * dt;
      p.vy -= dy / d * pull * dt;
    }
  }

  function updateParts(b, dt) {
    const spacing = b.def.move.spacing || 46;
    for (let i = 0; i < b.parts.length; ++i) {
      const pt = b.parts[i];
      if (pt.flash > 0) pt.flash -= dt;
      const d = pt.def;
      if (pt.type === 'segment') {
        const idx = Math.min(b.trail.length - 1, Math.round(pt.idx * spacing / 6));
        const q = b.trail[idx];
        const q2 = b.trail[Math.min(b.trail.length - 1, idx + 2)];
        pt.vx = (q.x - pt.x) / Math.max(dt, 0.001);
        pt.vy = (q.y - pt.y) / Math.max(dt, 0.001);
        pt.x = q.x;
        pt.y = q.y;
        pt.angle = Math.atan2(q.y - q2.y, q.x - q2.x);
      } else if (pt.type === 'shard') {
        const a = pt.orbitA + b.spin;
        pt.x = b.x + Math.cos(a) * d.orbit;
        pt.y = b.y + Math.sin(a) * d.orbit;
        pt.angle = a;
      } else {
        const ang = b.angle + b.spin;
        const c = Math.cos(ang), s = Math.sin(ang);
        pt.x = b.x + d.x * c - d.y * s;
        pt.y = b.y + d.x * s + d.y * c;
        pt.angle = ang;
      }
      if (!pt.alive) continue;
      const p = G.player;
      if (p && p.alive) pt.barrel = turnToward(pt.barrel, Math.atan2(p.y - pt.y, p.x - pt.x), 3 * dt);
      if (pt.burst > 0) {
        pt.burstT -= dt;
        if (pt.burstT <= 0) {
          pt.burstT = 0.09;
          --pt.burst;
          shoot('bolt', pt.x, pt.y, pt.barrel + (R() - 0.5) * 0.08, 520, 8, 'red');
        }
      }
    }
  }

  /* ── attacks ── */
  function attacks(b, dt) {
    b.attackT -= dt;
    if (b.attackT > 0) return;
    const ph = b.def.phases[b.phase];
    b.attackT = ph.every * (0.85 + R() * 0.3);
    const a = ph.attacks[b.attackIdx % ph.attacks.length];
    ++b.attackIdx;
    run(b, a);
  }

  function aimAtPlayer(x, y) {
    const p = G.player;
    return p ? Math.atan2(p.y - y, p.x - x) : 0;
  }

  function shoot(kind, x, y, a, speed, dmg, color) {
    NS.projectiles.enemyShot(kind, x, y, a, speed, dmg, color);
  }

  function run(b, name) {
    const parts = name.split(':');
    switch (parts[0]) {
      case 'aimed': {
        let any = false;
        for (let i = 0; i < b.parts.length; ++i) {
          const pt = b.parts[i];
          if (pt.alive && (pt.type === 'turret' || pt.type === 'launcher')) { pt.burst = 5; any = true; }
        }
        if (!any) fan(b, 5, 0.3, 'bolt', 540, 10);
        break;
      }
      case 'ring': {
        const n = 26 + b.phase * 6;
        const off = R() * TAU;
        for (let i = 0; i < n; ++i) shoot('orb', b.x, b.y, off + i * TAU / n, 210 + b.phase * 25, 12, 'violet');
        fx.ring(b.x, b.y, b.r, b.r * 2.2, 0.3, '#e0b0ff', 6);
        sfxAt('thud', b.x, b.y, { pitch: 0.6 });
        break;
      }
      case 'spiral':
        b.spiralT = 2.4; b.spiralArms = 2; b.spiralCd = 0;
        break;
      case 'spiral2':
        b.spiralT = 2.8; b.spiralArms = 4; b.spiralCd = 0;
        break;
      case 'fan':
        fan(b, 9, 1.1, 'pellet', 420, 9);
        break;
      case 'summon': {
        const n = +parts[2] || 3;
        for (let i = 0; i < n; ++i) {
          const a = R() * TAU;
          NS.enemies.spawn(parts[1], b.x + Math.cos(a) * (b.r + 80), b.y + Math.sin(a) * (b.r + 80), {});
        }
        sfxAt('drop', b.x, b.y, { pitch: 0.5 });
        break;
      }
      case 'segments': {
        for (let i = 0; i < b.parts.length; ++i) {
          const pt = b.parts[i];
          if (pt.alive && pt.type === 'segment' && i % 2 === b.attackIdx % 2)
            shoot('pellet', pt.x, pt.y, aimAtPlayer(pt.x, pt.y) + (R() - 0.5) * 0.2, 380, 8, 'orange');
        }
        break;
      }
      case 'mines': {
        const tail = b.trail;
        for (let i = 0; i < 6; ++i) {
          const q = tail[Math.min(tail.length - 1, 40 + i * 30)];
          NS.hazards.spawnMine(q.x + (R() - 0.5) * 40, q.y + (R() - 0.5) * 40, true);
        }
        break;
      }
      case 'charge':
        b.chargeT = 1.4;
        fx.ring(b.x, b.y, b.r, b.r * 3, 0.4, '#ff8a5c', 6);
        sfxAt('whoosh', b.x, b.y, { pitch: 0.5 });
        break;
      case 'beam':
        b.beamCharge = 1.1;
        b.beamT = 0;
        b.beamA = aimAtPlayer(b.x, b.y) - 0.8;
        b.beamDir = R() < 0.5 ? 1 : -1;
        if (b.beamDir < 0) b.beamA += 1.6;
        sfxAt('laser', b.x, b.y, { pitch: 0.3 });
        break;
      case 'missiles': {
        for (let i = 0; i < 6; ++i) {
          const a = b.angle + Math.PI + (i - 2.5) * 0.4;
          shoot('rocket', b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, a, 160, 12, 'orange');
        }
        sfxAt('whoosh', b.x, b.y, { pitch: 0.8 });
        break;
      }
      case 'mouth':
        b.mouthT = 3.2;
        sfxAt('lose', b.x, b.y, { pitch: 0.4, volume: 0.6 });
        break;
      case 'teleport':
        b.teleportT = 1.2;
        b.fadeT = 0;
        sfxAt('zap', b.x, b.y, { pitch: 0.4 });
        break;
      case 'shards': {
        for (let i = 0; i < b.parts.length; ++i) {
          const pt = b.parts[i];
          if (pt.alive && pt.type === 'shard') shoot('bolt', pt.x, pt.y, aimAtPlayer(pt.x, pt.y), 480, 9, 'violet');
        }
        break;
      }
    }
  }

  function fan(b, n, arc, kind, speed, dmg) {
    const base = aimAtPlayer(b.x, b.y);
    const mx = b.x + Math.cos(base) * b.r * 0.8, my = b.y + Math.sin(base) * b.r * 0.8;
    for (let i = 0; i < n; ++i)
      shoot(kind, mx, my, base + (i / (n - 1) - 0.5) * arc, speed, dmg, 'orange');
    fx.muzzle(mx, my, base, '#ffb090');
    sfxAt('shoot', b.x, b.y, { pitch: 0.5, volume: 0.5 });
  }

  /* attacks that last a while: spirals, beams, the open mouth, teleports */
  function continuous(b, dt) {
    if (b.spiralT > 0) {
      b.spiralT -= dt;
      b.spiralCd -= dt;
      b.spiralA += dt * 2.3;
      if (b.spiralCd <= 0) {
        b.spiralCd = 0.07;
        for (let i = 0; i < b.spiralArms; ++i)
          shoot('orb', b.x, b.y, b.spiralA + i * TAU / b.spiralArms, 240, 10, 'violet');
      }
    }
    if (b.beamCharge > 0) {
      b.beamCharge -= dt;
      if (b.beamCharge <= 0) b.beamT = 2.2;
    } else if (b.beamT > 0) {
      b.beamT -= dt;
      b.beamA += b.beamDir * 0.75 * dt;
      beamDamage(b, dt);
    }
    if (b.mouthT > 0) {
      b.mouthT -= dt;
      b.mouth = Math.min(1, b.mouth + dt * 3);
      b.spiralCd -= dt;
      if (b.spiralCd <= 0 && b.mouth > 0.6) {
        b.spiralCd = 0.16;
        const a = b.angle + (R() - 0.5) * 0.7;
        shoot('orb', b.x + Math.cos(b.angle) * b.r * 0.7, b.y + Math.sin(b.angle) * b.r * 0.7, a, 300, 11, 'red');
      }
    } else
      b.mouth = Math.max(0, b.mouth - dt * 2);
    if (b.teleportT > 0) {
      b.teleportT -= dt;
      if (b.teleportT > 0.6) b.fadeT = Math.min(1, b.fadeT + dt * 2);
      else if (b.fadeT >= 1) {
        const p = G.player;
        const a = R() * TAU;
        b.x = clamp((p ? p.x : b.x) + Math.cos(a) * 560, 250, G.world.w - 250);
        b.y = clamp((p ? p.y : b.y) + Math.sin(a) * 560, 250, G.world.h - 250);
        b.fadeT = 0.99;
        fx.shockwave(b.x, b.y, 240, '#c070ff');
        run(b, 'ring');
      }
      if (b.teleportT <= 0.6 && b.fadeT < 1) b.fadeT = Math.max(0, b.fadeT - dt * 2);
    }
  }

  /* The emitters each sweep a beam; beams outlast nothing they touch */
  function beamSources(b) {
    const out = [];
    for (let i = 0; i < b.parts.length; ++i)
      if (b.parts[i].alive && b.parts[i].type === 'beam') out.push(b.parts[i]);
    if (!out.length) out.push(b);
    return out;
  }

  function beamDamage(b, dt) {
    const src = beamSources(b);
    const p = G.player;
    for (let i = 0; i < src.length; ++i) {
      const s = src[i];
      const a = b.beamA + (i === 0 ? 0 : (i % 2 ? 0.5 : -0.5));
      const x1 = s.x + Math.cos(a) * 1300, y1 = s.y + Math.sin(a) * 1300;
      if (p && p.alive && segPointDist2(s.x, s.y, x1, y1, p.x, p.y) < (p.r + 14) * (p.r + 14))
        NS.player.damage(45 * dt * 4, s.x, s.y);
      if (R() < 0.3) fx.sparks(s.x + Math.cos(a) * 30, s.y + Math.sin(a) * 30, a, 0.6, 1, '#ffd0a0', 400, 0.2);
    }
  }

  /* World segments of the boss beams, for rendering (charge = telegraph) */
  function beams(out) {
    out.length = 0;
    const b = G.boss;
    if (!b || !b.alive || b.dying) return out;
    if (b.beamCharge <= 0 && b.beamT <= 0) return out;
    const src = beamSources(b);
    let a0 = b.beamA;
    for (let i = 0; i < src.length; ++i) {
      const s = src[i];
      const a = a0 + (i === 0 ? 0 : (i % 2 ? 0.5 : -0.5));
      out.push({ x0: s.x, y0: s.y, x1: s.x + Math.cos(a) * 1300, y1: s.y + Math.sin(a) * 1300, charge: b.beamCharge > 0, k: b.beamCharge > 0 ? 1 - b.beamCharge / 1.1 : 1 });
    }
    return out;
  }

  /* ── damage ── */
  function hitCore(b, dmg, x, y, ang) {
    const k = coreDamageScale(b, ang);
    if (k <= 0) {
      b.shieldHit = 1;
      if (R() < 0.3) fx.sparks(x, y, ang, 1.2, 2, '#9ad8ff', 260, 0.2);
      return false;
    }
    b.hp -= dmg * k;
    b.flash = 0.06;
    if (k > 1.2 && R() < 0.25) fx.text(x, y - 10, 'WEAK POINT', '#ffd25a', 13, 0.5);
    if (b.hp <= 0) startDeath(b);
    return true;
  }

  function hitPart(pt, dmg) {
    if (!pt.alive || pt.boss.introT > 0 || pt.boss.dying) return false;
    pt.hp -= dmg;
    pt.flash = 0.06;
    if (pt.hp <= 0) {
      pt.alive = false;
      fx.explode(pt.x, pt.y, pt.r * 1.6, fx.FIRE);
      fx.hitStop(0.05);
      sfxAt('explode', pt.x, pt.y, { volume: 0.8 });
      NS.combat.addScore(600, pt.x, pt.y);
      NS.pickups.dropScrap(pt.x, pt.y, 18);
      if (R() < 0.5) NS.pickups.dropPowerup(pt.x, pt.y, true);
      /* the hull takes a share of a part's loss */
      pt.boss.hp -= pt.boss.maxHp * 0.04;
      if (pt.boss.hp <= 0) startDeath(pt.boss);
    }
    return true;
  }

  function startDeath(b) {
    if (b.dying) return;
    b.dying = true;
    b.hp = 0;
    b.deathT = 0;
    b.beamT = b.beamCharge = b.spiralT = b.mouthT = 0;
    NS.projectiles.clearEnemyBullets(b.x, b.y, 3000);
    fx.slowMo(2.2, 0.25);
    fx.flash('#ffffff', 0.5);
    G.banner = { title: b.def.name.toUpperCase() + ' DESTROYED', sub: '', t: 0, life: 3, color: '#ffd25a' };
    sfx('explode', { pitch: 0.5 });
  }

  function updateDeath(b, dt) {
    b.deathT += dt;
    b.vx *= 1 - dt;
    b.vy *= 1 - dt;
    if (R() < 0.2) {
      const a = R() * TAU, d = R() * b.r * 1.3;
      fx.explode(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 20 + R() * 30, R() < 0.3 ? fx.PLASMA : fx.FIRE, { noDebris: R() < 0.5 });
      sfxAt('smallExplode', b.x, b.y, { volume: 0.6 });
    }
    for (let i = 0; i < b.parts.length; ++i) {
      const pt = b.parts[i];
      if (pt.alive && R() < dt * 2) {
        pt.alive = false;
        fx.explode(pt.x, pt.y, pt.r * 1.5, fx.FIRE);
      }
    }
    if (b.deathT >= 2.4) {
      b.alive = false;
      for (let i = 0; i < b.parts.length; ++i) b.parts[i].alive = false;
      fx.explode(b.x, b.y, b.r * 2.2, fx.FIRE);
      fx.explode(b.x, b.y, b.r * 1.4, fx.PLASMA);
      fx.shockwave(b.x, b.y, b.r * 7, '#ffe0b0');
      fx.flash('#ffffff', 0.9);
      fx.shake(1);
      fx.hitStop(0.12);
      sfx('explode');
      sfx('win');
      NS.combat.addScore(b.def.score, b.x, b.y);
      NS.pickups.dropScrap(b.x, b.y, 60);
      for (let i = 0; i < 3; ++i) NS.pickups.dropPowerup(b.x + (R() - 0.5) * 120, b.y + (R() - 0.5) * 120, true);
      ++G.save.stats.bosses;
    }
  }

  Object.assign(NS.bosses, {
    spawn, update, hitCore, hitPart, coreShielded, coreDamageScale, beams, aliveParts
  });
})();
