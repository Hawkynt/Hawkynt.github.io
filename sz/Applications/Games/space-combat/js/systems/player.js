/* The player ship: creation from the save and derived stats (re-applied live when the tree
   changes), responsive 8-way arcade flight inside the play field (keys, or following the
   pointer), focus mode, the sideways dash with i-frames, outside pushes (gravity, blasts), the
   five ship specials, shields and hull damage, Last Stand and death. The ship always faces up.
   Owns G.player; reads G.input, G.stats and G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const C = NS.constants;
  const { SHIPS, PRIMARIES, SECONDARIES, SKINS, TRAILS, ENGINES, byId } = NS.ships;
  const { clamp } = NS.rng;
  const R = NS.rng.fx;
  const { armorDamage } = NS.rules;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  const UP = -Math.PI / 2;

  function shipColors(save, ship) {
    const lv = NS.meta && NS.meta.livery();
    if (lv) return lv;
    const skin = SKINS[save.style.skin];
    return (skin && skin.colors) || ship.colors;
  }

  function create(x, y) {
    const st = G.stats;
    const ship = byId(SHIPS, st.ship) || SHIPS[0];
    const p = {
      alive: true, kind: 'player',
      x: x, y: y, vx: 0, vy: 0, ex: 0, ey: 0, r: C.PLAYER_RADIUS, hitR: C.PLAYER_HITBOX,
      angle: UP, aimX: x, aimY: y - 400, bank: 0,
      ship: ship,
      hull: st.hull, maxHull: st.hull, shield: st.shield, maxShield: st.shield,
      shieldT: 99, focus: false, thrusting: 0, lastDir: 1,
      dashT: 0, dashCd: 0, dashVx: 0, dashVy: 0, dashSpin: 0, dashDir: 1, dashTrailT: 0,
      iframes: 0, hitFlash: 0,
      abilityCd: 0, abilityT: 0,
      overdrive: 0, aegis: 0,
      overcharge: 0, magnet: 0,
      primary: byId(PRIMARIES, G.save.loadout.primary) || PRIMARIES[0],
      secondary: byId(SECONDARIES, G.save.loadout.secondary) || SECONDARIES[0],
      primaryCd: 0, secondaryCd: 0, ammo: 0, maxAmmo: 0, firing: false, beamOn: false,
      lastStand: st.lastStand, deadT: 0,
      shieldFlare: 0, shieldFlareA: 0,
      inNebula: false, trailT: 0, ramHit: null,
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
    p.skinKey = NS.meta && NS.meta.livery() ? 'livery-' + NS.meta.livery().key : G.save.style.skin;
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

    /* movement intent: keys or a stick give a direction, the pointer gives a place to go */
    let mx = inp.moveX, my = inp.moveY;
    const ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.focus = !!inp.focus;
    const speed = st.speed * (p.focus ? C.FOCUS_MUL : 1) * (p.inNebula ? 0.75 : 1) * (p.overdrive > 0 ? 1.12 : 1);
    let tvx = mx * speed, tvy = my * speed;
    if (ml < 0.1 && inp.follow) {
      const dx = clamp(inp.followX, 0, G.world.w) - p.x, dy = clamp(inp.followY, 0, G.world.h) - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 2) {
        const v = Math.min(speed, d * 9);
        tvx = dx / d * v;
        tvy = dy / d * v;
        mx = dx / d;
        my = dy / d;
      }
    }
    /* near-instant arcade response, smoothed over a couple of frames */
    const k = 1 - Math.exp(-C.PLAYER_RESPONSE * dt);
    p.vx += (tvx - p.vx) * k;
    p.vy += (tvy - p.vy) * k;
    if (Math.abs(mx) > 0.2) p.lastDir = mx > 0 ? 1 : -1;
    p.thrusting = clamp(0.55 - p.vy / Math.max(1, st.speed) * 0.45, 0.25, 1);

    /* dash */
    if (p.dashCd > 0) p.dashCd -= dt;
    if (inp.dashQ) {
      inp.dashQ = false;
      if (p.dashCd <= 0) startDash(p, mx, my);
      else sfx('error', { volume: 0.25 });
    }
    let dvx = 0, dvy = 0;
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.dashSpin += dt * 34 * p.dashDir;
      dvx = p.dashVx;
      dvy = p.dashVy;
      dashWake(p, dt);
      if (p.dashT <= 0) p.dashSpin = 0;
    }
    if (p.iframes > 0) p.iframes -= dt;

    p.x += (p.vx + p.ex + dvx) * dt;
    p.y += (p.vy + p.ey + dvy) * dt;
    const ke = Math.exp(-C.EXT_DECAY * dt);
    p.ex *= ke;
    p.ey *= ke;
    keepInside(p);
    p.aimX = p.x;
    p.aimY = p.y - 400;

    /* bank into sideways motion */
    const bankTarget = clamp(p.vx / Math.max(200, st.speed) * 1.3, -1, 1);
    p.bank += (bankTarget - p.bank) * Math.min(1, dt * 10);

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

    emitTrail(p, dt);
  }

  /* A short burst in the stick direction (sideways when there is none) with i-frames */
  function startDash(p, mx, my) {
    let dx = mx, dy = my;
    if (Math.abs(dx) + Math.abs(dy) < 0.1) { dx = p.lastDir; dy = 0; }
    const l = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= l; dy /= l;
    const v = C.DASH_DIST * G.stats.dashLen / C.DASH_TIME;
    p.dashVx = dx * v;
    p.dashVy = dy * v;
    p.dashT = C.DASH_TIME;
    p.dashDir = dx >= 0 ? 1 : -1;
    p.iframes = Math.max(p.iframes, C.DASH_IFRAMES);
    p.dashCd = G.stats.dashCd;
    p.ramHit = {};
    p.dashTrailT = 0;
    sfx('whoosh', { volume: 0.7, pitch: 1.3 });
    for (let i = 0; i < 6; ++i)
      fx.glow(p.x - dx * i * 10, p.y - dy * i * 10, 15 - i, p.engineColor, 0.22 + i * 0.02);
  }

  /* afterimages, and the Afterburner Wake upgrade's burning trail */
  function dashWake(p, dt) {
    p.dashTrailT -= dt;
    if (p.dashTrailT > 0) return;
    p.dashTrailT = 0.03;
    fx.glow(p.x, p.y, 20, p.colors.glow, 0.25);
    if (G.stats.burn) {
      G.zones.push({ alive: true, x: p.x, y: p.y, r: 30, t: 0, life: 1.4, dps: 60, team: 'player', kind: 'burn', vy: G.scroll.speed });
      fx.glow(p.x, p.y, 28, '#ff8a2a', 0.5);
    }
  }

  /* the ship never leaves the play field; the top band belongs to the bosses */
  function keepInside(p) {
    const m = p.r * 0.8;
    p.x = clamp(p.x, m, G.world.w - m);
    p.y = clamp(p.y, C.PLAYER_TOP, G.world.h - m - 4);
  }

  /* engine exhaust streams down-screen and the cosmetic trail */
  function emitTrail(p, dt) {
    p.trailT -= dt;
    if (p.trailT > 0) return;
    p.trailT = 1 / 60;
    const power = 0.35 + p.thrusting * 0.65;
    const bx = p.x, by = p.y + 20;
    const colors = p.trail;
    const c = colors ? colors[Math.floor(G.time * 12) % colors.length] : p.engineColor;
    fx.exhaust(bx + (R() - 0.5) * 6, by + (R() - 0.5) * 4, p.vx * 0.2 + (R() - 0.5) * 20, 160 + 200 * power, 5 + power * 6, c, null);
  }

  /* Pushes from outside (gravity, blasts, bumps); they fade on their own */
  function push(vx, vy) {
    const p = G.player;
    if (!p || !p.alive) return;
    p.ex += vx;
    p.ey += vy;
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
        /* straight up-screen; steered sideways when a direction is held */
        const ox = p.x, oy = p.y;
        const inp = G.input;
        p.x = clamp(p.x + (inp.moveX || 0) * 160, 30, G.world.w - 30);
        p.y = clamp(p.y - 220, C.PLAYER_TOP, G.world.h - 30);
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
        NS.combat.blast(p.x, p.y, 300, 150 * G.stats.dmgMul, 'player', { push: 400 });
        NS.projectiles.clearEnemyBullets(p.x, p.y, 320);
        fx.shockwave(p.x, p.y, 320, '#ff9ab8');
        fx.flash('#ffd0e0', 0.35);
        fx.hitStop(0.06);
        sfx('explode', { pitch: 1.4 });
        break;
      case 'warp':
        G.warp = ab.time;
        sfx('zap', { pitch: 0.5 });
        fx.ring(p.x, p.y, 20, 760, 0.9, '#8affe0', 5);
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
    p.iframes = Math.max(p.iframes, rest > 0 ? C.HIT_IFRAMES : 0.12);
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
    create, applyStats, applyLooks, update, damage, heal, useAbility, push, keepInside
  });
})();
