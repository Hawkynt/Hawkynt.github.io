/* The player ship: creation from the save and derived stats (re-applied live when the tree
   changes), twin-stick flight with inertia, drift and banking, boost heat, dodge roll with
   i-frames, the five ship specials, shields and hull damage, Last Stand and death.
   Owns G.player; reads G.input, G.stats and G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const C = NS.constants;
  const { SHIPS, PRIMARIES, SECONDARIES, SKINS, TRAILS, ENGINES, byId } = NS.ships;
  const { clamp, turnToward, angleDiff } = NS.rng;
  const R = NS.rng.fx;
  const { armorDamage } = NS.rules;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function shipColors(save, ship) {
    const skin = SKINS[save.style.skin];
    return (skin && skin.colors) || ship.colors;
  }

  function create(x, y) {
    const st = G.stats;
    const ship = byId(SHIPS, st.ship) || SHIPS[0];
    const p = {
      alive: true, kind: 'player',
      x: x, y: y, vx: 0, vy: 0, r: C.PLAYER_RADIUS,
      angle: -Math.PI / 2, aimX: x, aimY: y - 200, bank: 0, turnRate: 0,
      ship: ship,
      hull: st.hull, maxHull: st.hull, shield: st.shield, maxShield: st.shield,
      shieldT: 99, heat: 0, overheated: false, boosting: false, thrusting: 0,
      rollT: 0, rollCd: 0, rollDir: 0, rollSpin: 0,
      iframes: 0, hitFlash: 0,
      abilityCd: 0, abilityT: 0,
      overdrive: 0, aegis: 0,
      overcharge: 0, magnet: 0,
      primary: byId(PRIMARIES, G.save.loadout.primary) || PRIMARIES[0],
      secondary: byId(SECONDARIES, G.save.loadout.secondary) || SECONDARIES[0],
      primaryCd: 0, secondaryCd: 0, ammo: 0, maxAmmo: 0, firing: false, beamOn: false,
      lastStand: st.lastStand, deadT: 0,
      shieldFlare: 0, shieldFlareA: 0,
      inNebula: false, trailT: 0, burnT: 0, ramHit: null,
      shots: 0, hits: 0, damageTaken: 0,
    };
    p.maxAmmo = Math.round(p.secondary.ammo * st.ammoMul);
    p.ammo = p.maxAmmo;
    applyLooks(p);
    G.player = p;
    return p;
  }

  function applyLooks(p) {
    p.colors = shipColors(G.save, p.ship);
    const eng = ENGINES[G.save.style.engine];
    p.engineColor = (eng && eng.color) || p.colors.glow;
    const tr = TRAILS[G.save.style.trail];
    p.trail = (tr && tr.colors) || null;
    p.skinKey = G.save.style.skin;
  }

  /* The tree or hangar changed mid-run: new maxima apply at once, the gain is granted now */
  function applyStats() {
    const p = G.player;
    if (!p) return;
    const st = G.stats;
    const dh = st.hull - p.maxHull;
    const ds = st.shield - p.maxShield;
    p.maxHull = st.hull;
    p.maxShield = st.shield;
    if (dh > 0) p.hull += dh;
    if (ds > 0) p.shield += ds;
    p.hull = Math.min(p.hull, p.maxHull);
    p.shield = Math.min(p.shield, p.maxShield);
    const maxAmmo = Math.round(p.secondary.ammo * st.ammoMul);
    if (maxAmmo > p.maxAmmo) p.ammo += maxAmmo - p.maxAmmo;
    p.maxAmmo = maxAmmo;
    if (st.lastStand && !p.lastStandUsed) p.lastStand = true;
    applyLooks(p);
  }

  /* ── per step ── */
  function update(dt) {
    const p = G.player;
    if (!p) return;
    if (!p.alive) {
      p.deadT += dt;
      return;
    }
    const st = G.stats;
    const inp = G.input;

    /* movement intent */
    let mx = inp.moveX, my = inp.moveY;
    const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }

    /* boost and heat */
    const wantBoost = inp.boost && ml > 0.1 && !p.overheated;
    p.boosting = wantBoost;
    if (p.boosting) {
      p.heat += C.BOOST_HEAT_RATE / st.boostCap * dt;
      if (p.heat >= 1) {
        p.heat = 1;
        p.overheated = true;
        p.boosting = false;
        sfx('error', { volume: 0.5 });
      }
    } else {
      p.heat = Math.max(0, p.heat - C.BOOST_COOL_RATE * dt);
      if (p.overheated && p.heat <= C.OVERHEAT_RECOVER) p.overheated = false;
    }

    const nebula = p.inNebula ? 0.7 : 1;
    const thrust = st.thrust * (p.boosting ? C.BOOST_MUL : 1) * nebula;
    const maxSpeed = st.speed * (p.boosting ? C.BOOST_MUL : 1) * nebula;
    p.vx += mx * thrust * dt;
    p.vy += my * thrust * dt;
    p.thrusting = Math.min(1, ml) * (p.boosting ? 1.6 : 1);

    /* drift: light drag when thrusting, firmer when coasting; grip from the tree */
    const drag = C.PLAYER_DRAG * st.grip * (ml > 0.1 ? 0.6 : 1);
    const k = Math.max(0, 1 - drag * dt);
    p.vx *= k;
    p.vy *= k;
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const cap = p.rollT > 0 ? maxSpeed * 1.9 : maxSpeed;
    if (sp > cap) {
      const s = cap + (sp - cap) * Math.max(0, 1 - 6 * dt);
      p.vx *= s / sp;
      p.vy *= s / sp;
    }

    /* dodge roll */
    if (p.rollCd > 0) p.rollCd -= dt;
    if (inp.rollQ) {
      inp.rollQ = false;
      if (p.rollCd <= 0) startRoll(p, mx, my);
    }
    if (p.rollT > 0) {
      p.rollT -= dt;
      p.rollSpin += dt * 15 * p.rollDir;
      if (p.rollT <= 0) p.rollSpin = 0;
    }
    if (p.iframes > 0) p.iframes -= dt;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    keepInside(p, dt);

    /* aim and facing */
    p.aimX = inp.aimWX;
    p.aimY = inp.aimWY;
    const want = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    const before = p.angle;
    p.angle = turnToward(p.angle, want, 15 * dt);
    p.turnRate = angleDiff(before, p.angle) / dt;
    /* bank into lateral motion and turns */
    const lat = (-Math.sin(p.angle) * p.vx + Math.cos(p.angle) * p.vy) / Math.max(200, st.speed);
    const bankTarget = clamp(lat * 1.4 + p.turnRate * 0.06, -1, 1);
    p.bank += (bankTarget - p.bank) * Math.min(1, dt * 8);

    /* shields */
    p.shieldT += dt;
    if (p.shieldT > st.shieldDelay && p.shield < p.maxShield)
      p.shield = Math.min(p.maxShield, p.shield + st.regen * dt);
    if (st.repair > 0 && p.hull < p.maxHull)
      p.hull = Math.min(p.maxHull, p.hull + st.repair * dt);
    if (p.shieldFlare > 0) p.shieldFlare -= dt * 2.5;
    if (p.hitFlash > 0) p.hitFlash -= dt;

    /* power-up and special timers */
    if (p.overcharge > 0) p.overcharge -= dt;
    if (p.magnet > 0) p.magnet -= dt;
    if (p.overdrive > 0) p.overdrive -= dt;
    if (p.aegis > 0) p.aegis -= dt;
    if (p.abilityCd > 0) p.abilityCd -= dt;
    if (inp.abilityQ) {
      inp.abilityQ = false;
      if (p.abilityCd <= 0) useAbility(p);
      else sfx('error', { volume: 0.4 });
    }

    emitTrail(p, mx, my, dt);
  }

  function startRoll(p, mx, my) {
    let dx = mx, dy = my;
    if (Math.abs(dx) + Math.abs(dy) < 0.1) {
      /* no stick input: roll sideways relative to the nose */
      dx = -Math.sin(p.angle);
      dy = Math.cos(p.angle);
    }
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    p.vx += dx * C.ROLL_IMPULSE;
    p.vy += dy * C.ROLL_IMPULSE;
    p.rollT = C.ROLL_TIME;
    p.iframes = Math.max(p.iframes, C.ROLL_IFRAMES);
    p.rollCd = G.stats.rollCd;
    p.rollDir = (-Math.sin(p.angle) * dx + Math.cos(p.angle) * dy) >= 0 ? 1 : -1;
    p.ramHit = {};
    sfx('whoosh', { volume: 0.7 });
    for (let i = 0; i < 8; ++i)
      fx.glow(p.x - dx * i * 8, p.y - dy * i * 8, 16 - i, p.engineColor, 0.25 + i * 0.02);
  }

  function keepInside(p, dt) {
    const W = G.world.w, H = G.world.h, m = 40;
    p.outside = false;
    if (p.x < m) { p.vx += C.BOUNDARY_PUSH * dt; p.outside = true; }
    if (p.x > W - m) { p.vx -= C.BOUNDARY_PUSH * dt; p.outside = true; }
    if (p.y < m) { p.vy += C.BOUNDARY_PUSH * dt; p.outside = true; }
    if (p.y > H - m) { p.vy -= C.BOUNDARY_PUSH * dt; p.outside = true; }
    p.x = clamp(p.x, -60, W + 60);
    p.y = clamp(p.y, -60, H + 60);
  }

  /* engine exhaust and the cosmetic trail */
  function emitTrail(p, mx, my, dt) {
    p.trailT -= dt;
    if (p.trailT > 0) return;
    p.trailT = 1 / 60;
    const ca = Math.cos(p.angle), sa = Math.sin(p.angle);
    const power = 0.35 + p.thrusting * 0.65;
    const back = 20;
    const bx = p.x - ca * back, by = p.y - sa * back;
    const ev = -260 * power;
    const colors = p.trail;
    const c = colors ? colors[Math.floor(G.time * 12) % colors.length] : p.engineColor;
    fx.exhaust(bx + (R() - 0.5) * 6, by + (R() - 0.5) * 6, p.vx * 0.3 + ca * ev, p.vy * 0.3 + sa * ev, 5 + power * 6, c, null);
    if (p.boosting && R() < 0.7)
      fx.exhaust(bx, by, p.vx * 0.2 + ca * ev * 1.5, p.vy * 0.2 + sa * ev * 1.5, 9, '#ffffff', null);
    if (p.boosting && G.stats.burn) {
      p.burnT -= 1 / 60;
      if (p.burnT <= 0) {
        p.burnT = 0.08;
        G.zones.push({ alive: true, x: bx, y: by, r: 34, t: 0, life: 1.4, dps: 40, team: 'player', kind: 'burn' });
        fx.glow(bx, by, 30, '#ff8a2a', 0.6);
      }
    }
  }

  /* ── specials ── */
  function useAbility(p) {
    const ab = p.ship.ability;
    p.abilityCd = ab.cd * G.stats.abilityCd;
    p.abilityT = ab.time;
    switch (ab.id) {
      case 'overdrive':
        p.overdrive = ab.time;
        sfx('powerup');
        fx.ring(p.x, p.y, 20, 120, 0.4, p.colors.trim, 6);
        break;
      case 'blink': {
        const ang = p.angle;
        const ox = p.x, oy = p.y;
        const d = 280;
        p.x = clamp(p.x + Math.cos(ang) * d, 60, G.world.w - 60);
        p.y = clamp(p.y + Math.sin(ang) * d, 60, G.world.h - 60);
        p.iframes = Math.max(p.iframes, 0.6);
        for (let i = 0; i <= 10; ++i)
          fx.glow(ox + (p.x - ox) * i / 10, oy + (p.y - oy) * i / 10, 22, p.colors.glow, 0.4 + i * 0.02);
        G.zones.push({ alive: true, x: ox, y: oy, r: 110, t: 0, life: 0.5, dps: 260, team: 'player', kind: 'rift' });
        fx.shockwave(ox, oy, 120, p.colors.glow);
        sfx('zap');
        break;
      }
      case 'aegis':
        p.aegis = ab.time;
        sfx('powerup', { pitch: 0.7 });
        fx.ring(p.x, p.y, 30, 70, 0.4, '#ffd27a', 8);
        break;
      case 'nova':
        NS.combat.blast(p.x, p.y, 360, 150 * G.stats.dmgMul, 'player', { push: 600 });
        NS.projectiles.clearEnemyBullets(p.x, p.y, 380);
        fx.shockwave(p.x, p.y, 380, '#ff9ab8');
        fx.flash('#ffd0e0', 0.35);
        fx.hitStop(0.06);
        sfx('explode', { pitch: 1.4 });
        break;
      case 'warp':
        G.warp = ab.time;
        sfx('zap', { pitch: 0.5 });
        fx.ring(p.x, p.y, 20, 900, 0.9, '#8affe0', 5);
        break;
    }
  }

  /* ── damage ── */
  function damage(amount, sx, sy) {
    const p = G.player;
    if (!p || !p.alive) return false;
    if (p.iframes > 0 || p.aegis > 0) return false;
    const mut = G.stage && G.stage.mutator && NS.waves.MUTATORS[G.stage.mutator];
    if (mut && mut.dmgIn) amount *= mut.dmgIn;
    p.shieldT = 0;
    p.damageTaken += amount;
    let rest = amount;
    if (p.shield > 0) {
      const a = Math.min(p.shield, rest);
      p.shield -= a;
      rest -= a;
      p.shieldFlare = 1;
      p.shieldFlareA = Math.atan2(sy - p.y, sx - p.x);
      sfx('hit', { pitch: 1.5, volume: 0.6 });
      if (p.shield <= 0) {
        fx.ring(p.x, p.y, 24, 60, 0.3, '#58c8ff', 4);
        sfx('zap', { pitch: 0.6 });
      }
    }
    if (rest > 0) {
      rest = armorDamage(rest, G.stats);
      p.hull -= rest;
      p.hitFlash = 0.12;
      G.vignette = Math.min(1, G.vignette + 0.35 + rest / 40);
      fx.shake(0.25 + rest / 60);
      fx.hitStop(0.035);
      fx.sparks(p.x, p.y, Math.atan2(p.y - sy, p.x - sx), 1.5, 10, '#ffb070', 340, 0.35);
      sfx('hurt');
    }
    p.iframes = Math.max(p.iframes, C.HIT_IFRAMES);
    if (p.hull <= 0) {
      if (p.lastStand) {
        p.lastStand = false;
        p.lastStandUsed = true;
        p.hull = Math.round(p.maxHull * 0.4);
        p.iframes = 2;
        fx.shockwave(p.x, p.y, 300, '#ffd27a');
        NS.projectiles.clearEnemyBullets(p.x, p.y, 500);
        fx.text(p.x, p.y - 40, 'LAST STAND', '#ffd27a', 26, 1.6);
        sfx('levelup');
      } else
        kill(p);
    }
    return true;
  }

  function kill(p) {
    p.alive = false;
    p.hull = 0;
    p.deadT = 0;
    fx.explode(p.x, p.y, 70, fx.FIRE);
    fx.explode(p.x + 20, p.y - 10, 40, fx.PLASMA);
    fx.flash('#ffffff', 0.6);
    fx.slowMo(1.2, 0.3);
    sfx('explode');
    sfx('lose');
  }

  function heal(kind) {
    const p = G.player;
    if (kind === 'shield') p.shield = p.maxShield;
    else if (kind === 'repair') p.hull = Math.min(p.maxHull, p.hull + p.maxHull * 0.35);
    else if (kind === 'ammo') p.ammo = p.maxAmmo;
  }

  Object.assign(NS.player, {
    create, applyStats, applyLooks, update, damage, heal, useAbility
  });
})();
