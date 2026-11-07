/* Powers: a power orb rides on some pieces; clearing its row puts a random unlocked power into a
   free slot (one slot, two or three with the tech tree). E uses the first slot: Sweep, Slow
   Time, I-Storm, Quake, Laser, Bomb, Score Rush or Aegis, each with its own effect burst. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const E = NS.engine;
  const P = NS.progress;
  const { POWERS } = NS.metaData;

  function available(profile) {
    return POWERS.filter(p => P.powerUnlocked(profile, p.id));
  }

  /* an orb was cleared: -> the power gained, or null when the slots are full */
  function gainOrb(run, profile) {
    if (run.powers.length >= run.slots) return null;
    const list = available(profile);
    const pick = list[E.rand(run.game) * list.length | 0];
    run.powers.push(pick.id);
    run.events.push({ type: 'power', id: pick.id });
    return pick;
  }

  function use(run, index) {
    const g = run.game;
    if (!run.powers.length || g.over || g.clearing) return false;
    const id = run.powers.splice(index || 0, 1)[0];
    switch (id) {
      case 'sweep': E.sweep(g, 2); break;
      case 'slow': g.slowT = 15; break;
      case 'storm':
        E.fillQueue(g);
        for (let i = 0; i < 3; ++i) g.queue[i] = 'I';
        break;
      case 'quake': E.cascade(g); break;
      case 'laser': E.laser(g); break;
      case 'bomb': E.bomb(g); break;
      case 'rush': run.rushT = 20; break;
      case 'shield': run.shield = true; break;
    }
    ++run.powersUsed;
    run.events.push({ type: 'usepower', id: id });
    return id;
  }

  function update(run, dt) {
    if (run.rushT > 0) {
      run.rushT = Math.max(0, run.rushT - dt);
      run.game.scoreMul = run.baseScoreMul * (run.rushT > 0 ? 2 : 1);
    }
  }

  Object.assign(NS.powers, { available, gainOrb, use, update });
})();
