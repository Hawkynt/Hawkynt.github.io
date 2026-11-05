/* Pickups on the floor: spawning them from bricks and fallen enemies, fire burning exposed
   power-ups, the magnet pull (Gem Magnet and the Magnet Aura perk), collection and what each
   power-up, gem and seasonal token does - including curses. Mutates G.run.pickups and the
   player's power-up fields. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS } = C;
  const { POWERUP_BY_ID, CURSES } = NS.content;
  const fx = NS.fx;

  function spawn(type, i, fresh) {
    const run = G.run;
    if (run.pickups.length > 60) return null;
    const pk = { id: run.nextId++, type: type, i: i, x: i % COLS, y: (i / COLS) | 0, t: 0, fresh: fresh || 0, pop: 0.35 };
    run.pickups.push(pk);
    return pk;
  }

  /* Fire destroys exposed power-ups (not gems, tokens or lives) once they have settled */
  function burnAt(i) {
    const ps = G.run.pickups;
    for (let k = ps.length - 1; k >= 0; --k) {
      const pk = ps[k];
      if (pk.i !== i || pk.t < pk.fresh || pk.flying) continue;
      if (pk.type === 'gem' || pk.type === 'gem5' || pk.type === 'token' || pk.type === 'heart') continue;
      ps.splice(k, 1);
      fx.burst(fx.px(pk.x), fx.py(pk.y), 12, '#c8c0d0', 160, 0.5, 0, false);
      fx.text(pk.x, pk.y, 'poof', '#c8c0d0', 13);
    }
  }

  function update(dt) {
    const run = G.run, p = run.player;
    const ps = run.pickups;
    const pull = p.magnetT > 0 ? 99 : G.perks.magnet;
    for (let k = ps.length - 1; k >= 0; --k) {
      const pk = ps[k];
      pk.t += dt;
      if (pk.pop > 0) pk.pop = Math.max(0, pk.pop - dt);
      if (p.dead) continue;
      const dx = p.x - pk.x, dy = p.y - pk.y;
      const d2 = dx * dx + dy * dy;
      if (pull && d2 < pull * pull && pk.t > 0.3 && (pk.type === 'gem' || pk.type === 'gem5' || pk.type === 'token' || p.magnetT > 0)) {
        pk.flying = true;
        const d = Math.sqrt(d2) || 1;
        const sp = Math.min(d, (6 + pk.t * 4) * dt);
        pk.x += dx / d * sp;
        pk.y += dy / d * sp;
      }
      if (d2 < 0.36) {
        ps.splice(k, 1);
        collect(pk);
      }
    }
  }

  function collect(pk) {
    const run = G.run, p = run.player;
    const x = pk.x, y = pk.y;
    if (pk.type === 'gem' || pk.type === 'gem5') {
      const v = pk.type === 'gem5' ? 5 : 1;
      run.gemsRun += v;
      NS.tracker.stat('gemsPicked', v);
      NS.run.addScore(25 * v, x, y, false);
      fx.sparkle(x, y, '#7ff8ff', 6);
      fx.sfx('coin', { pitch: 1 + Math.min(0.6, run.gemStreak * 0.05), volume: 0.6 });
      run.gemStreak = Math.min(12, (run.gemStreak || 0) + 1);
      run.gemStreakT = 0.8;
      return;
    }
    if (pk.type === 'token') {
      NS.tracker.token(1);
      ++run.tokensRun;
      fx.sparkle(x, y, G.season.def.color, 14);
      fx.text(x, y, '+1 ' + G.season.def.token, G.season.def.color, 15);
      fx.sfx('pickup', { pitch: 1.5 });
      return;
    }
    apply(pk.type, x, y);
  }

  function dur(base) {
    return base * G.perks.duration;
  }

  function apply(type, x, y) {
    const run = G.run, p = run.player;
    const def = POWERUP_BY_ID[type];
    if (!def) return;
    NS.tracker.stat('powerups', 1);
    ++run.powerupsRun;
    NS.run.addScore(50, x, y, false);
    p.squash = 0.6;
    switch (type) {
      case 'bomb': p.bombs = Math.min(C.MAX_BOMBS, p.bombs + 1); break;
      case 'fire': p.fire = Math.min(C.MAX_FIRE, p.fire + 1); break;
      case 'speed': p.speed = Math.min(8, p.speed + 1); break;
      case 'kick': p.kick = true; break;
      case 'glove': p.glove = true; break;
      case 'remote': p.remote = true; break;
      case 'pierce': p.pierce = true; break;
      case 'shield': p.shield = 1; break;
      case 'wallpass': p.wallpass = true; break;
      case 'bombpass': p.bombpass = true; break;
      case 'maxfire': p.fire = C.MAX_FIRE; break;
      case 'freeze': run.freezeT = dur(C.FREEZE_TIME); fx.flash('#bff4ff', 0.35); break;
      case 'magnet': p.magnetT = dur(C.MAGNET_TIME); break;
      case 'heart':
        if (run.mode === 'zen') run.gemsRun += 10;
        else ++run.lives;
        break;
      case 'skull': {
        const curse = CURSES[Math.floor(NS.run.rand() * CURSES.length)];
        p.curse = curse.id;
        p.curseT = C.CURSE_TIME;
        fx.banner('CURSED!', curse.name + ' - blast an enemy to lift it', '#b4b4c8', 1.6);
        fx.sfx('hurt', { pitch: 0.6 });
        fx.burst(fx.px(x), fx.py(y), 18, '#9a8ab8', 180, 0.7, 3, false);
        return;
      }
    }
    fx.sparkle(x, y, def.color, 16);
    fx.ring(fx.px(x), fx.py(y), 6, 40, 0.35, def.color, 4);
    fx.text(x, y, def.name, def.color, 16);
    fx.sfx(def.kind === 'stat' ? 'pickup' : 'powerup', { pitch: def.kind === 'stat' ? 1.2 : 1 });
  }

  /* An enemy may leave a gem (and in arcade sometimes a power-up) where it fell */
  function enemyDrop(e) {
    const run = G.run;
    const i = NS.arena.idx(Math.round(e.x), Math.round(e.y));
    const r = NS.run.rand();
    if (run.mode === 'zen') { spawn('gem', i, 0.3); return; }
    if (r < 0.35) spawn(r < 0.06 ? 'gem5' : 'gem', i, 0.3);
    else if ((run.mode === 'arcade' || run.mode === 'daily') && r < 0.45)
      spawn(NS.levelgen.rollPowerup(NS.run.rand, { luck: G.perks.luck, heartRate: G.perks.heartRate, skulls: run.mods.indexOf('skulls') >= 0 }), i, 0.8);
  }

  Object.assign(NS.items, {
    spawn, burnAt, update, collect, apply, enemyDrop
  });
})();
