/* The fixed 60 Hz step: advances one cave by one step (power-up timers, the miner's move slot,
   dynamite, the gem magnet, the cave tick on its own slower cadence) and, at the top level,
   runs whatever the active screen needs - the run, the title demo cave, the cinematic, the
   screen curtain, the toast - plus the periodic autosave. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;

  /* intent: { dir: 0..3 or -1, grab: bool, bomb: bool } */
  function stepCave(cv, intent) {
    const p = cv.player;
    for (const key in p.pow) {
      p.pow[key] -= C.STEP;
      if (p.pow[key] <= 0) {
        delete p.pow[key];
        NS.physics.ev(cv, 'powEnd', -1, { key });
      }
    }
    cv.frozen = (p.pow.freeze || 0) > 0;
    const quick = cv.quick ? 2 : 0;
    cv.worldPeriod = p.pow.slow > 0 ? C.SLOW_PERIOD : C.WORLD_PERIOD - quick;
    cv.playerPeriod = p.pow.boots > 0 ? C.BOOTS_PERIOD : C.PLAYER_PERIOD - quick;
    if (p.alive && !cv.won) {
      if (p.moveT < cv.playerPeriod) ++p.moveT;
      if (intent.bomb) NS.player.dropBomb(cv);
      if (p.moveT >= cv.playerPeriod && intent.dir >= 0) {
        const moved = NS.player.tryMove(cv, intent.dir, intent.grab);
        if (moved || p.push > 0) p.moveT = 0;
        if (moved) NS.creatures.contact(cv);
      }
      if (p.pow.magnet > 0) {
        p.magT = (p.magT || 0) + C.STEP;
        if (p.magT >= 0.22) { p.magT = 0; NS.player.magnet(cv); }
      }
      p.idleT = intent.dir >= 0 ? 0 : (p.idleT || 0) + C.STEP;
    } else if (!p.alive) p.deadT += C.STEP;
    if (++cv.clock >= cv.worldPeriod) {
      cv.clock = 0;
      NS.physics.tick(cv);
    }
  }

  let saveT = 0;

  function update(dt) {
    G.time += dt;
    if (G.fade > 0) G.fade = Math.max(0, G.fade - dt * 2.6);
    if (G.toast.t > 0) G.toast.t -= dt;
    switch (G.screen) {
      case 'playing':
        if (NS.fx.state.hitstop > 0) break;
        NS.run.update(dt);
        saveT += dt;
        if (saveT >= C.AUTOSAVE_EVERY) { saveT = 0; NS.run.autosave(); }
        break;
      case 'title':
        NS.title.updateDemo(dt);
        break;
      case 'cinema':
        NS.cinema.update(dt);
        break;
    }
    NS.fx.update(dt);
  }

  Object.assign(NS.sim, { stepCave, update });
})();
