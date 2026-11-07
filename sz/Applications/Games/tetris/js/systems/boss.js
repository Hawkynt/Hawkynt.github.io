/* Guardian fights: a guardian has hit points, charges a garbage attack (telegraphed for three
   seconds, then rows arrive two seconds later unless line clears cancel them) and a special move
   of its own - Grumbleroot's roots seize the hold slot, Shardmaw drops crystals, Maelora's tide
   fogs the preview, Vulkar's heat doubles gravity, the Hollow Mason mirrors the stack. At half
   health it rages: faster attacks and one more row. Clears deal damage by lines, T-spins,
   back-to-back, combo and perfect clears; Aegis blocks one attack. Boss Rush chains all five. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const E = NS.engine;
  const P = NS.progress;
  const { BOSSES } = NS.worldData;
  const { COLS } = NS.constants;

  function create(w, profile, scale) {
    const b = BOSSES[w];
    const k = scale || 1;
    return { w: w, hp: Math.round(b.hp * k), max: Math.round(b.hp * k), atkT: b.every, every: b.every, rows: b.rows, incoming: 0, landT: 0,
      specialT: b.specialEvery * 0.7, rage: false, hits: 0, holdLockT: 0, fogT: 0, heatT: 0, hurtT: 0, attackT: 0, hole: 0 };
  }

  function damageFor(ev, profile) {
    if (!ev.lines) return 0;
    let d = [0, 1, 2, 4, 6][ev.lines];
    if (ev.tspin === 'full') d += ev.lines * 2;
    else if (ev.tspin === 'mini') d += 1;
    if (ev.b2b) d += 1;
    d += Math.floor((ev.combo || 0) / 2);
    if (ev.perfect) d += 8;
    return Math.round(d * (1 + P.stat(profile, 'damage')));
  }

  /* a clear hits back: cancels incoming rows first, the rest is damage; -> { cancelled, damage } */
  function onClear(run, ev, profile) {
    const bs = run.bossState;
    if (!bs || !ev.lines || ev.source !== 'piece') return null;
    let dmg = damageFor(ev, profile);
    let cancelled = 0;
    if (bs.incoming > 0) {
      const power = ev.lines * (P.stat(profile, 'cancel') > 0 ? 2 : 1);
      cancelled = Math.min(bs.incoming, power);
      bs.incoming -= cancelled;
      if (!bs.incoming) bs.landT = 0;
    }
    bs.hp = Math.max(0, bs.hp - dmg);
    bs.hurtT = 0.4;
    ++bs.hits;
    if (!bs.rage && bs.hp <= bs.max / 2) {
      bs.rage = true;
      bs.every *= 0.75;
      bs.rows += 1;
      run.events.push({ type: 'rage' });
    }
    return { cancelled: cancelled, damage: dmg };
  }

  function update(run, dt, profile) {
    const bs = run.bossState;
    const g = run.game;
    if (!bs || bs.hp <= 0 || g.over) return;
    const def = BOSSES[bs.w];
    bs.hurtT = Math.max(0, bs.hurtT - dt);
    bs.attackT = Math.max(0, bs.attackT - dt);
    bs.atkT -= dt;
    if (bs.atkT <= 0) {
      bs.atkT = bs.every;
      const rows = Math.max(1, bs.rows - Math.round(P.stat(profile, 'armor')));
      bs.incoming += rows;
      bs.landT = 2;
      bs.hole = E.rand(g) * COLS | 0;
      bs.attackT = 0.8;
      run.events.push({ type: 'attack', rows: rows });
    }
    if (bs.incoming > 0 && bs.landT > 0) {
      bs.landT -= dt;
      if (bs.landT <= 0) {
        if (run.shield) {
          run.shield = false;
          run.events.push({ type: 'blocked', rows: bs.incoming });
        } else {
          E.addGarbage(g, bs.incoming, bs.hole);
          ++run.hitsTaken;
        }
        bs.incoming = 0;
      }
    }
    bs.specialT -= dt;
    if (bs.specialT <= 0) {
      bs.specialT = def.specialEvery * (bs.rage ? 0.7 : 1);
      special(run, def.special);
    }
    if (bs.holdLockT > 0) {
      bs.holdLockT -= dt;
      g.canHold = bs.holdLockT <= 0 && run.holdAllowed;
    }
    if (bs.fogT > 0) bs.fogT = Math.max(0, bs.fogT - dt);
    if (bs.heatT > 0) {
      bs.heatT -= dt;
      if (bs.heatT <= 0) g.gravityMul = run.baseGravityMul;
    }
  }

  function special(run, kind) {
    const bs = run.bossState, g = run.game;
    if (kind === 'vines') {
      bs.holdLockT = 10;
      g.canHold = false;
    } else if (kind === 'crystals') {
      const cols = [];
      const n = bs.rage ? 4 : 3;
      while (cols.length < n) {
        const c = E.rand(g) * COLS | 0;
        if (cols.indexOf(c) < 0) cols.push(c);
      }
      E.dropCrystals(g, cols);
    } else if (kind === 'tide') bs.fogT = 8;
    else if (kind === 'heat') {
      bs.heatT = 8;
      g.gravityMul = run.baseGravityMul * 2.2;
    } else if (kind === 'mirror') E.mirror(g);
    bs.attackT = 0.8;
    run.events.push({ type: 'special', kind: kind });
  }

  Object.assign(NS.boss, { create, damageFor, onClear, update, special });
})();
