/* Guardians: a guardian stands over a bigger field. Its "health" is the field itself - every safe
   cell opened hurts it, clearing the field defeats it - and its fuse burns while the field is in
   play: if the fuse burns down first, the field blows. Every few seconds it winds up (a warning)
   and strikes with its move: the Burrowbeast reburies opened number cells, Rimewing freezes the
   flags, the Cinder Golem blows smoke that hides numbers, the Archivist knocks flags loose, and
   the Rustmonger's Engine takes turns with all four. With less than half the field left it rages:
   it strikes more often and harder. Warm Gloves shorten frost and smoke, Steady Hands slow the
   strikes, Long Fuse lengthens the fuse. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const E = NS.engine;
  const P = NS.progress;
  const { BOSSES } = NS.worldData;
  const ORDER = ['bury', 'frost', 'smoke', 'quake'];
  const WINDUP = 1.4;

  function create(w, profile, scale) {
    const b = BOSSES[w];
    const fuse = Math.round(b.fuse * (1 + P.stat(profile, 'fuse')) / (scale || 1));
    return { w: w, every: b.every * (1 + P.stat(profile, 'calm')), power: b.power, fuse: fuse, fuseMax: fuse, t: b.every * 0.8, windup: 0, rage: false,
      strikes: 0, next: b.special === 'all' ? ORDER[0] : b.special, thaw: Math.max(0.2, 1 - P.stat(profile, 'thaw')), hurtT: 0, lastOpened: 0 };
  }

  /* -> { have, need } cells opened of the field's safe cells */
  function health(run) {
    const g = run.game;
    return { left: E.safeCount(g) - g.opened, max: E.safeCount(g) };
  }

  function strike(run, kind) {
    const bs = run.bossState, g = run.game;
    let cells = [];
    if (kind === 'bury') cells = E.rebury(g, bs.power);
    else if (kind === 'frost') g.flagLockT = Math.max(g.flagLockT, 6 * bs.thaw);
    else if (kind === 'smoke') E.fog(g, Math.min(6, 3 + Math.floor(bs.power / 2)), 7 * bs.thaw);
    else if (kind === 'quake') cells = E.unflag(g, bs.power);
    ++bs.strikes;
    run.events.push({ type: 'strike', kind: kind, cells: cells });
  }

  function update(run, dt) {
    const bs = run.bossState, g = run.game;
    if (!bs || g.state !== 'play') return;
    const def = BOSSES[bs.w];
    bs.hurtT = Math.max(0, bs.hurtT - dt);
    if (g.opened > bs.lastOpened) { bs.hurtT = 0.35; bs.lastOpened = g.opened; }
    bs.fuse -= dt;
    if (bs.fuse <= 0) {
      bs.fuse = 0;
      run.events.push({ type: 'fuse' });
      return;
    }
    const h = health(run);
    if (!bs.rage && h.left <= h.max / 2) {
      bs.rage = true;
      bs.every *= 0.72;
      bs.power += 1;
      run.events.push({ type: 'rage' });
    }
    if (bs.windup > 0) {
      bs.windup -= dt;
      if (bs.windup <= 0) {
        strike(run, bs.next);
        if (def.special === 'all') bs.next = ORDER[(ORDER.indexOf(bs.next) + 1) % ORDER.length];
        bs.t = bs.every;
      }
      return;
    }
    bs.t -= dt;
    if (bs.t <= 0) {
      bs.windup = WINDUP;
      run.events.push({ type: 'windup', kind: bs.next });
    }
  }

  Object.assign(NS.boss, { ORDER, WINDUP, create, health, strike, update });
})();
