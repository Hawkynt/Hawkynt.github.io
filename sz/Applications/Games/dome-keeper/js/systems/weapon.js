;(function() {
  'use strict';

  // The dome weapon: aimed shots, weak points, charged shots, combos and parrying.
  // Owns: NS.weapon and these state fields:
  //   G.combo, G.comboTimer, G.bestCombo, G.charge, G.parryT, G.parryCd, G.hitstop, G.screenFlash,
  //   G.screenFlashColor, G.reflected, G.lastShotAt
  // Reads: constants, dom, rules, upgrades, gameState, animation, artifacts, tooltip
  // Reads state of: gameState, weather

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { VIEW_SURFACE, STATE_PLAYING } = NS.constants;
  const { particles, screenShake, floatingText } = NS.dom;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { TURRET_BARREL_LENGTH, TURRET_KEYBOARD_SPEED, tooltip, keys } = NS.gameState;
  const { spawnShieldImpact, applyDamageToEnemy } = NS.animation;

  /* ======================================================================
     WEAPON SYSTEM -- aimed shots, weak points, charged shots, combos, parry
     ====================================================================== */

  // Weak point of each monster: offset (towards the dome, down) and radius, in body sizes
  const WEAK_POINTS = {
    walker: [0.35, -0.35, 0.34], swarmer: [0.3, -0.1, 0.42], flyer: [0, -0.2, 0.32], crawler: [0.6, -0.1, 0.26],
    diver: [0.2, -0.1, 0.34], burrower: [0.3, -0.45, 0.3], spitter: [-0.3, -0.55, 0.3], splitter: [0, 0, 0.32],
    mender: [0, -0.5, 0.3], behemoth: [0.45, -0.55, 0.22], queen: [0, -0.35, 0.26]
  };
  const COMBO_TIMEOUT = 3;           // seconds without a hit before the combo ends
  const CHARGE_TIME = 1.0;           // seconds to a full charge
  const PERFECT_FROM = 0.82;         // share of the charge where the perfect window opens
  const CHARGE_OVERHEAT = 1.2;       // held past this the charge fizzles and restarts
  const PARRY_WINDOW = 0.3;          // seconds the parry shield stays up
  const PARRY_COOLDOWN = 0.9;
  G.combo = 0; G.comboTimer = 0; G.bestCombo = 0;
  G.charge = null;                 // { t } while the fire button is held
  G.parryT = 0; G.parryCd = 0;       // parry shield time left and cooldown
  G.hitstop = 0;                   // brief freeze of the battle after a big hit
  G.screenFlash = 0; G.screenFlashColor = '255,255,255';
  G.reflected = [];                // parried globs and lances flying back: { x0, y0, target, tx, ty, t, dur, dmg, kind }
  G.lastShotAt = -10;              // animTime of the last turret shot (monster tooltips wait while shooting)

  function weakPoint(e) {
    const [fx, fy, fr] = WEAK_POINTS[e.type] || [0, -0.3, 0.3];
    const face = e.x > DOME_X ? -1 : 1;
    const sz = e.size || 16;
    const bob = e.type === 'flyer' ? Math.sin(e.wobblePhase || 0) * 8 : 0;
    return { x: e.x + fx * face * sz, y: e.y + fy * sz + bob, r: Math.max(7, fr * sz) };
  }

  function comboMult() {
    return 1 + Math.min(G.combo, 20) * 0.03;
  }

  function comboHit(x, y) {
    ++G.combo;
    G.comboTimer = COMBO_TIMEOUT;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    if (G.combo >= 5 && G.combo % 5 === 0) {
      floatingText.add(x, y - 70, `COMBO x${G.combo}!`, { color: '#ffb0ff', font: 'bold 26px sans-serif' });
      SZ.GameAudio.play('powerup', { pitch: 1 + Math.min(G.combo, 30) * 0.02, volume: 0.5 });
    }
  }

  function comboBreak(x, y) {
    if (G.combo >= 3)
      floatingText.add(x, y, 'Combo lost', { color: '#9aa2b8', font: 'bold 18px sans-serif' });
    G.combo = 0;
  }

  function flashScreen(alpha, rgb) {
    G.screenFlash = Math.max(G.screenFlash, alpha);
    G.screenFlashColor = rgb || '255,255,255';
  }

  // How well a shot was aimed at its target: weak point, body or a graze
  function classifyHit(target, bx, by) {
    const wp = weakPoint(target);
    let ax, ay;
    if (G.mouseAimX >= 0 && G.mouseAimY >= 0 && G.mouseAimY < DOME_Y + 45) {
      ax = G.mouseAimX;
      ay = G.mouseAimY;
    } else {
      // Keyboard aiming: the point of the aim ray closest to the weak point
      const vx = Math.cos(G.turretAngle), vy = Math.sin(G.turretAngle);
      const proj = (wp.x - bx) * vx + (wp.y - by) * vy;
      ax = bx + vx * proj;
      ay = by + vy * proj;
    }
    if (Math.hypot(ax - wp.x, ay - wp.y) <= wp.r + 5) return 'weak';
    if (Math.hypot(ax - target.x, ay - target.y) <= (target.size || 16) + 8) return 'body';
    return 'graze';
  }

  // One turret shot; charged = null or { mult, perfect }
  function fireTurret(charged) {
    G.lastShotAt = G.animTime;
    if (tooltip.enemy)
      NS.tooltip.clearTooltip();
    const nozzleR = DOME_RADIUS + 16;
    const turretBaseX = DOME_X + Math.cos(G.turretAngle) * nozzleR;
    const turretBaseY = DOME_Y + Math.sin(G.turretAngle) * nozzleR;
    // Project a far-off aim point along the turret angle
    const aimDist = 400;
    const farX = turretBaseX + Math.cos(G.turretAngle) * aimDist;
    const farY = turretBaseY + Math.sin(G.turretAngle) * aimDist;

    // Find enemy closest to the projected aim line
    let target = null;
    const homing = !!G.unlockedTools.homingShots;
    let bestDist = homing ? 220 * 220 : 80 * 80; // hit radius of 80px (220 with homing shots)
    // A click right on a monster always aims at that monster
    if (G.mouseAimX >= 0 && G.mouseAimY >= 0)
      for (const e of G.enemies) {
        if (e.hidden) continue;
        const d = (e.x - G.mouseAimX) * (e.x - G.mouseAimX) + (e.y - G.mouseAimY) * (e.y - G.mouseAimY);
        const r = (e.size || 16) + 10;
        if (d < r * r && d < bestDist) {
          bestDist = d;
          target = e;
        }
      }
    if (!target)
      for (const e of G.enemies) {
        if (e.hidden) continue;
        const dx = e.x - farX;
        const dy = e.y - farY;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          target = e;
        }
      }

    // Also check enemies near the aim line (not just the far point)
    if (!target) {
      let bestLineDist = homing ? 140 : 60;
      for (const e of G.enemies) {
        if (e.hidden) continue;
        // Distance from enemy to the aim ray
        const ex = e.x - turretBaseX;
        const ey = e.y - turretBaseY;
        const projLen = ex * Math.cos(G.turretAngle) + ey * Math.sin(G.turretAngle);
        if (projLen < -nozzleR) continue; // skip only enemies truly behind dome center
        const perpDist = Math.abs(-ex * Math.sin(G.turretAngle) + ey * Math.cos(G.turretAngle));
        if (perpDist < bestLineDist) {
          bestLineDist = perpDist;
          target = e;
        }
      }
    }

    const muzzleX = turretBaseX + Math.cos(G.turretAngle) * TURRET_BARREL_LENGTH;
    const muzzleY = turretBaseY + Math.sin(G.turretAngle) * TURRET_BARREL_LENGTH;
    const perfect = !!(charged && charged.perfect);
    const kind = target ? classifyHit(target, turretBaseX, turretBaseY) : 'miss';
    const wp = target && kind === 'weak' ? weakPoint(target) : null;
    let tx = wp ? wp.x : (target ? target.x : farX);
    let ty = wp ? wp.y : (target ? target.y : farY);
    // A perfect shot pierces: its beam runs on through the target
    if (perfect) {
      const len = Math.hypot(tx - muzzleX, ty - muzzleY) || 1;
      tx = muzzleX + (tx - muzzleX) / len * 1600;
      ty = muzzleY + (ty - muzzleY) / len * 1600;
    }
    G.projectiles.push({ x: muzzleX, y: muzzleY, tx, ty, target, life: charged ? 0.4 : 0.3, maxLife: charged ? 0.4 : 0.3, charged: !!charged, perfect });

    if (target) {
      const ty0 = target.y - (target.size || 20) - 30;
      if (kind === 'graze')
        comboBreak(target.x, ty0 + 24);
      else
        comboHit(target.x, ty0);
      const power = G.weaponDamage * comboMult();
      let shot = power * (kind === 'weak' ? 2 : (kind === 'graze' ? 0.7 : 1)) * (charged ? charged.mult : 1);
      // Lucky critical hits (Critical Hit node, Hunter's Eye)
      const critChance = (G.unlockedTools.criticalHit ? 0.15 + 0.05 * (getEffectiveLevel('criticalHit') - 1) : 0) + (NS.artifacts.hasArtifact('hunterEye') ? 0.2 : 0);
      const lucky = Math.random() < critChance;
      if (lucky) shot *= 2.5;
      shot = Math.round(shot);
      applyDamageToEnemy(target, shot);
      // Feedback
      if (perfect) {
        floatingText.add(target.x, ty0 - 26, `PERFECT! ${shot}`, { color: '#ffe060', font: 'bold 30px sans-serif' });
        G.hitstop = 0.09;
        flashScreen(0.35, '255,240,190');
        screenShake.trigger(7, 180);
        SZ.GameAudio.play('levelup', { pitch: 1.5, volume: 0.6 });
        SZ.GameAudio.play('explode', { pitch: 1.6, volume: 0.4 });
      } else if (charged) {
        floatingText.add(target.x, ty0 - 26, `Charged ${shot}`, { color: '#ffc070', font: 'bold 22px sans-serif' });
        SZ.GameAudio.play('shoot', { pitch: 0.7, volume: 0.6 });
      }
      if (kind === 'weak' || lucky) {
        floatingText.add(target.x, ty0, kind === 'weak' && lucky ? 'DOUBLE CRIT!' : 'CRIT!', { color: kind === 'weak' ? '#ffd040' : '#ffa040', font: 'bold 26px sans-serif' });
        particles.burst(wp ? wp.x : target.x, wp ? wp.y : target.y, 10, { color: '#ffe080', speed: 3, life: 0.3 });
        SZ.GameAudio.play('hit', { pitch: 1.6, volume: 0.6 });
        if (!perfect) {
          G.hitstop = Math.max(G.hitstop, 0.04);
          flashScreen(0.12);
        }
      } else if (kind === 'graze')
        floatingText.add(target.x, ty0, 'graze', { color: '#9aa2b8', font: 'bold 16px sans-serif' });

      // Perfect shots pierce: everything else on the line takes most of the damage
      if (perfect) {
        const lx = tx - muzzleX, ly = ty - muzzleY, ll = Math.hypot(lx, ly) || 1;
        let n = 0;
        for (const e of G.enemies) {
          if (e === target || e.hidden || n >= 4) continue;
          const ex = e.x - muzzleX, ey = e.y - muzzleY;
          const along = (ex * lx + ey * ly) / ll;
          const across = Math.abs(ex * ly - ey * lx) / ll;
          if (along > 0 && across < (e.size || 16) + 14) {
            applyDamageToEnemy(e, Math.round(shot * 0.8));
            particles.burst(e.x, e.y, 8, { color: '#ffe080', speed: 2.5, life: 0.3 });
            ++n;
          }
        }
      }

      // Multi-Shot: more beams at the monsters nearest to the target
      if (G.unlockedTools.multiShot) {
        const extra = G.enemies.filter(o => o !== target && !o.hidden)
          .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
          .slice(0, getEffectiveLevel('multiShot'));
        for (const o of extra) {
          applyDamageToEnemy(o, Math.ceil(power * 0.6));
          G.projectiles.push({ x: muzzleX, y: muzzleY, tx: o.x, ty: o.y, target: o, life: 0.25, maxLife: 0.25 });
        }
      }

      // Explosive Rounds: every hit bursts
      if (G.unlockedTools.explosiveRounds) {
        for (const ce of G.enemies)
          if (ce !== target && !ce.hidden && Math.hypot(ce.x - target.x, ce.y - target.y) < 110)
            applyDamageToEnemy(ce, Math.ceil(power * 0.4));
        particles.burst(target.x, target.y, 12, { color: '#ffb040', speed: 3, life: 0.35 });
      }

      // Chain Lightning: arc damage to 2 nearby enemies (+1 per extra level)
      if (G.unlockedTools.chainLightning) {
        let chainCount = 0;
        const arcs = 1 + getEffectiveLevel('chainLightning');
        const chainDamage = Math.ceil(power * 0.4);
        for (const ce of G.enemies) {
          if (ce.hidden || ce === target) continue;
          if (chainCount >= arcs) break;
          const cdx = ce.x - target.x;
          const cdy = ce.y - target.y;
          if (cdx * cdx + cdy * cdy < 160 * 160) {
            applyDamageToEnemy(ce, chainDamage);
            particles.burst(ce.x, ce.y, 4, { color: '#4af', speed: 2, life: 0.2 });
            // Arc visual
            G.projectiles.push({ x: target.x, y: target.y, tx: ce.x, ty: ce.y, life: 0.15, maxLife: 0.15 });
            ++chainCount;
          }
        }
      }

      // Freeze Ray: slow enemies near target
      if (G.unlockedTools.freezeRay) {
        for (const ce of G.enemies) {
          if (ce.hidden) continue;
          const cdx = ce.x - target.x;
          const cdy = ce.y - target.y;
          if (cdx * cdx + cdy * cdy < 120 * 120)
            ce.stunTimer = Math.max(ce.stunTimer || 0, 0.8 + 0.3 * (getEffectiveLevel('freezeRay') - 1));
        }
      }

      // Plasma Cannon: AoE damage around target
      if (G.unlockedTools.plasmaCannon) {
        const aoeDamage = Math.ceil(power * 0.6);
        for (const ce of G.enemies) {
          if (ce.hidden) continue;
          if (ce === target) continue;
          const cdx = ce.x - target.x;
          const cdy = ce.y - target.y;
          if (cdx * cdx + cdy * cdy < 140 * 140) {
            applyDamageToEnemy(ce, aoeDamage);
            particles.burst(ce.x, ce.y, 6, { color: '#f80', speed: 2, life: 0.3 });
          }
        }
        particles.burst(target.x, target.y, 15, { color: '#f80', speed: 3, life: 0.4 });
      }
    } else
      comboBreak(farX, farY);

    particles.burst(muzzleX, muzzleY, charged ? 10 : 4, { color: charged ? '#ffe0a0' : '#faa', speed: charged ? 2.5 : 1.5, life: 0.15, size: 2 });
    SZ.GameAudio.play('laser', { pitch: (charged ? 0.7 : 0.95) + Math.random() * 0.1, volume: 0.7 });
  }

  // Hold the fire button to charge; let go in the gold window for a perfect shot
  function startCharge() {
    if (G.state !== STATE_PLAYING || G.currentView !== VIEW_SURFACE) return;
    G.charge = { t: 0 };
  }

  function releaseCharge() {
    const c = G.charge;
    G.charge = null;
    if (!c || G.state !== STATE_PLAYING || G.currentView !== VIEW_SURFACE) return;
    const k = c.t / CHARGE_TIME;
    if (k < 0.35) return;           // a tap: the normal shot already went off
    const perfect = k >= PERFECT_FROM && k <= 1;
    G.fireCooldown = 1 / G.fireRate;
    fireTurret({ mult: perfect ? 3 : (k >= 0.5 ? 1.8 : 1.25), perfect });
  }

  // Raise the parry shield for a moment: acid, lances, dives and shockwaves bounce off
  function tryParry() {
    if (G.state !== STATE_PLAYING || G.currentView !== VIEW_SURFACE || G.parryCd > 0) return;
    G.parryT = PARRY_WINDOW;
    G.parryCd = PARRY_COOLDOWN;
    SZ.GameAudio.play('whoosh', { pitch: 1.8, volume: 0.5 });
  }

  // Did the shield catch this hit? Returns 0 (no), 1 (parry) or 2 (perfect: pressed just in time)
  function parryCheck() {
    if (G.parryT <= 0) return 0;
    return G.parryT > PARRY_WINDOW - 0.12 ? 2 : 1;
  }

  function parryFeedback(x, y, perfect) {
    floatingText.add(x, y - 40, perfect ? 'PERFECT PARRY!' : 'PARRY!', { color: perfect ? '#ffe060' : '#8ae8ff', font: 'bold 28px sans-serif' });
    particles.burst(x, y, perfect ? 22 : 14, { color: perfect ? '#ffe080' : '#9ae8ff', speed: 3.5, life: 0.4 });
    SZ.GameAudio.play('zap', { pitch: 1.7 });
    SZ.GameAudio.play('select', { pitch: perfect ? 1.6 : 1.2, volume: 0.7 });
    spawnShieldImpact(x, y);
    G.hitstop = Math.max(G.hitstop, perfect ? 0.08 : 0.05);
    flashScreen(perfect ? 0.25 : 0.12, perfect ? '255,240,190' : '180,230,255');
    comboHit(x, y - 40);
  }

  // Send a parried shot back at whoever fired it (or the nearest monster)
  function reflectShot(x, y, src, dmg, kind) {
    let target = src && G.enemies.includes(src) && !src.hidden ? src : null;
    if (!target) {
      let best = 1e12;
      for (const e of G.enemies) {
        if (e.hidden) continue;
        const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
        if (d < best) {
          best = d;
          target = e;
        }
      }
    }
    if (target)
      G.reflected.push({ x0: x, y0: y, target, tx: target.x, ty: target.y, t: 0, dur: kind === 'lance' ? 0.3 : 0.5, dmg, kind });
  }

  function updateReflected(dt) {
    for (let i = G.reflected.length - 1; i >= 0; --i) {
      const r = G.reflected[i];
      if (G.enemies.includes(r.target)) {
        r.tx = r.target.x;
        r.ty = r.target.y;
      }
      r.t += dt / r.dur;
      if (r.t < 1) continue;
      G.reflected.splice(i, 1);
      if (G.enemies.includes(r.target)) {
        applyDamageToEnemy(r.target, r.dmg);
        r.target.stunTimer = Math.max(r.target.stunTimer || 0, r.kind === 'lance' ? 1.5 : 0.8);
        floatingText.add(r.tx, r.ty - (r.target.size || 20) - 30, `-${Math.round(r.dmg)}`, { color: '#9ae8ff', font: 'bold 24px sans-serif' });
      }
      if (G.currentView === VIEW_SURFACE)
        particles.burst(r.tx, r.ty, 14, { color: r.kind === 'lance' ? '#ff80e0' : '#b8ff70', speed: 3, life: 0.4 });
    }
  }

  function updateWeapon(dt) {
    if (G.currentView !== VIEW_SURFACE) {
      G.charge = null;
      return;
    }

    // Turret aiming: track mouse position continuously
    // Nozzle moves along dome arc — compute aim angle from dome center
    // Upper semicircle only, clamped above ground so nozzle never dips into terrain
    const TURRET_MIN_ANGLE = -Math.PI;
    const TURRET_MAX_ANGLE = 0;
    if (G.mouseAimX >= 0 && G.mouseAimY >= 0) {
      const adx = G.mouseAimX - DOME_X;
      const ady = G.mouseAimY - DOME_Y;
      if (adx * adx + ady * ady > 4) {
        if (ady < 0)
          // Mouse is above ground — atan2 with negative ady always yields [-PI, 0]
          G.turretAngle = Math.atan2(ady, adx);
        else if (ady < 45)
          // Just below the ground line (monster feet): aim flat along the ground
          G.turretAngle = adx < 0 ? -Math.PI : 0;
        // Further below ground the angle stays put, so the HUD does not swing the turret
      }
    }

    // Keyboard aiming: Left/Right or A/D rotate barrel
    const turnSpeed = TURRET_KEYBOARD_SPEED * (1 + 0.3 * getEffectiveLevel('turretSpeed')) * (G.weather.kind === 'blizzard' ? 1 - 0.4 * G.weather.intensity : 1);
    if (keys['ArrowLeft'] || keys['KeyA'])
      G.turretAngle -= turnSpeed * dt;
    if (keys['ArrowRight'] || keys['KeyD'])
      G.turretAngle += turnSpeed * dt;

    // Clamp turret to upper dome arc, above ground on both sides
    if (G.turretAngle > TURRET_MAX_ANGLE) G.turretAngle = TURRET_MAX_ANGLE;
    if (G.turretAngle < TURRET_MIN_ANGLE) G.turretAngle = TURRET_MIN_ANGLE;

    G.fireCooldown -= dt;

    // Holding too long overheats the charge: it fizzles and starts over
    if (G.charge) {
      G.charge.t += dt;
      if (G.charge.t > CHARGE_TIME * CHARGE_OVERHEAT) {
        G.charge.t = 0;
        SZ.GameAudio.play('error', { pitch: 1.8, volume: 0.35 });
        floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 80, 'Overheated - release in the gold window', { color: '#ff9a7a', font: 'bold 18px sans-serif' });
      }
    }

    // Fire toward current turret aim direction on click
    if (G.fireRequested && G.fireCooldown <= 0) {
      G.fireRequested = false;
      G.fireCooldown = 1.0 / (G.fireRate * (G.weather.kind === 'blizzard' ? 1 - 0.25 * G.weather.intensity : 1));
      fireTurret(null);
    }

    G.fireRequested = false;

    // The combo fades without hits
    if (G.combo > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0)
        G.combo = 0;
    }

    for (let i = G.projectiles.length - 1; i >= 0; --i) {
      G.projectiles[i].life -= dt;
      if (G.projectiles[i].life <= 0)
        G.projectiles.splice(i, 1);
    }
  }

  NS.weapon = { COMBO_TIMEOUT, CHARGE_TIME, PERFECT_FROM, PARRY_WINDOW, PARRY_COOLDOWN, weakPoint, comboMult,
    startCharge, releaseCharge, tryParry, parryCheck, parryFeedback, reflectShot, updateReflected,
    updateWeapon };
})();
