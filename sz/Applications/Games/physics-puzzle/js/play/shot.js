;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Shots: firing, the fixed-step simulation of the live attempt with slow
   * motion, Bullet Time and fast-forward, ball trails, and the end of a shot
   * (win, miss or a Sandbox celebration). Owns the step accumulator; reads
   * and writes G.run (phase, trails, recoil), reads G.stats, G.held and
   * G.touchSlow, and counts shots in G.save.
   */

  const G = NS.G;
  const Ph = G.Ph, Sim = G.Sim, Fx = G.Fx;
  const MAX_DT = NS.C.MAX_DT, MAX_STEPS = NS.C.MAX_STEPS, FAST_RATE = NS.C.FAST_RATE;
  const DEAD_SPEED = NS.C.DEAD_SPEED, WIN_TIME = NS.C.WIN_TIME;

  function launchSpeed(power) {
    return Sim.MIN_SPEED + power * (Sim.BASE_MAX_SPEED * G.stats.powerMul - Sim.MIN_SPEED);
  }

  function fire() {
    const run = G.run;
    if (!run || run.phase !== 'aim')
      return;
    const extra = run.mode === 'trick' ? 0 : G.stats.extraBalls;
    const shot = Sim.fire(run.att, run.aimAngle, launchSpeed(run.aimPower), extra, 4);
    run.phase = 'flight';
    run.selected = -1;
    run.recoil = 1;
    run.bulletLeft = G.stats.bulletTime;
    run.nearMiss = {};
    run.trails = shot.balls.map(() => []);
    run.shotsTotal = run.att.shots;
    ++G.save.stats.shots;
    const d = Sim.launcherDir(run.aimAngle);
    const L = run.level.launcher;
    Fx.muzzle(G.fxWorld, L[0] + d[0] * 40, L[1] + d[1] * 40, d[0], d[1], run.aimPower);
    G.shake.add(0.12 + run.aimPower * 0.15);
    G.sfx('shoot', { pitch: 0.7 + run.aimPower * 0.5 });
  }

  /* ── stepping the live attempt ── */

  let stepAcc = 0;

  function updatePlay(dt) {
    const run = G.run;
    if (run.phase === 'intro') {
      run.introT += dt;
      if (run.introT > 2.2)
        run.phase = 'aim';
      return;
    }
    run.recoil = Math.max(0, run.recoil - dt * 4);
    if (run.phase === 'won') {
      run.wonT += dt;
      stepWorld(dt * G.timeScale.update(dt));
      if (run.wonT > WIN_TIME)
        NS.run.finishLevel();
      return;
    }
    if (run.phase !== 'flight')
      return;
    let rate = G.timeScale.update(dt);
    if (G.stats.bulletTime && run.bulletLeft > 0 && (G.held.has('Space') || G.held.has('KeyS') || G.touchSlow)) {
      run.bulletLeft = Math.max(0, run.bulletLeft - dt);
      rate = Math.min(rate, 0.3);
    }
    run.fastForward = shotIsDead() || G.held.has('KeyF');
    stepWorld(dt * rate, run.fastForward);
    resolveShot();
  }

  function resolveShot() {
    const run = G.run;
    const shot = run.att.shot;
    if (run.phase === 'flight' && shot && shot.done) {
      run.fastForward = false;
      if (shot.done === 'win' && run.mode === 'sandbox') {
        /* the Sandbox never ends: celebrate and keep building */
        NS.events.winBurst();
        G.sfx('win');
        G.texts.add(run.att.targets[0].x, run.att.targets[0].y - 50, 'NICE SHOT!', { color: '#ffe066', size: 30, life: 1.4 });
        for (const t of run.att.targets)
          t.lit = false;
        run.att.won = false;
        run.phase = 'aim';
        run.lastPaths = run.trails.map(t => t.slice());
      } else if (shot.done === 'win') {
        run.phase = 'won';
        run.wonT = 0;
        G.timeScale.slow(0.25, 0.6);
        G.sfx('win');
        NS.events.winBurst();
      } else {
        run.phase = 'aim';
        run.lastPaths = run.trails.map(t => t.slice());
        if (run.mode === 'sandbox')
          return;
        const lit = run.att.targets.filter(t => t.lit).length;
        if (run.oneShot && lit)
          G.showToast('Not all in one shot - try again', '#ffb0a0');
        else if (lit)
          G.showToast(lit + ' of ' + run.att.targets.length + ' targets lit - keep going', '#ffe9a0');
        else
          G.showToast(run.att.shots === 1 ? 'Missed - adjust and try again' : 'Missed - shot ' + run.att.shots, '#ffb0a0');
        G.sfx('drop', { volume: 0.6 });
      }
    }
  }

  /* the shot is only rolling out: its balls are gone, resting or crawling */
  function shotIsDead() {
    const shot = G.run && G.run.att.shot;
    if (!shot || shot.done)
      return false;
    if (shot.phase === 'settle')
      return true;
    if (shot.time < 0.6)
      return false;
    for (const b of shot.balls)
      if (b.alive && !b.sleeping && b.vx * b.vx + b.vy * b.vy > DEAD_SPEED * DEAD_SPEED)
        return false;
    return true;
  }

  /* run the rest of a rolling-out shot at once so the next shot can be fired */
  function finishShotNow() {
    const shot = G.run.att.shot;
    let guard = 0;
    while (shot && !shot.done && guard++ < 40000) {
      Sim.stepAttempt(G.run.att);
      for (const ev of shot.events)
        if (ev.type === 'target' || ev.type === 'star')
          NS.events.handleEvents([ev]);
      shot.events.length = 0;
    }
    stepAcc = 0;
    resolveShot();
  }

  function stepWorld(dt, fast) {
    const run = G.run;
    stepAcc += Math.min(dt, MAX_DT) * (fast ? FAST_RATE : 1);
    let n = 0;
    const cap = fast ? MAX_STEPS * FAST_RATE : MAX_STEPS;
    while (stepAcc >= Ph.STEP && n < cap) {
      stepAcc -= Ph.STEP;
      ++n;
      if (run.att.shot && !run.att.shot.done) {
        Sim.stepAttempt(run.att);
        NS.events.handleEvents(run.att.shot.events);
        run.att.shot.events.length = 0;
        recordTrails();
      } else {
        /* after the win the world keeps moving for the celebration */
        Ph.step(run.att.world);
        Ph.takeEvents(run.att.world);
      }
    }
    if (n >= cap)
      stepAcc = 0;
  }

  function recordTrails() {
    const run = G.run;
    const shot = run.att.shot;
    if (run.att.world.steps % 4)
      return;
    shot.balls.forEach((b, i) => {
      if (!b.alive || shot.phase !== 'fly')
        return;
      const tr = run.trails[i];
      tr.push(b.x, b.y);
      if (tr.length > 1200)
        tr.splice(0, 2);
    });
  }

  NS.shot = {
    launchSpeed: launchSpeed, fire: fire, updatePlay: updatePlay, resolveShot: resolveShot,
    shotIsDead: shotIsDead, finishShotNow: finishShotNow, stepWorld: stepWorld
  };
})();
