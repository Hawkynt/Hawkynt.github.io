/* One fixed simulation step: clocks and UI timers, the running cinematic, then in flight the
   input intent and the command camera (pause-and-plan stops here), hit-stop and slow motion,
   ship, rocks, mining, drones, pirates, life and gas, the outpost, units, invaders, waves and
   belt events, hazards, belt respawn, the trip rules, effects and the camera, in that order.
   Menu screens only advance clocks and effects. Owns G.time and the step measurement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;

  const perf = { sim: 0, steps: 0 };

  function update(dt) {
    G.time += dt;
    G.screenT += dt;
    const ui = G.ui;
    if (ui.treeFlash > 0) ui.treeFlash -= dt;
    if (ui.toast) {
      ui.toast.t += dt;
      if (ui.toast.t > 2.6) ui.toast = null;
    }
    for (let i = ui.popups.length - 1; i >= 0; --i) {
      ui.popups[i].t += dt;
      if (ui.popups[i].t > 4) ui.popups.splice(i, 1);
    }
    if (G.cine && G.cine.full) {
      NS.cinematics.update(dt);
      NS.fx.update(dt);
      return;
    }
    if (G.screen !== 'playing') {
      if (G.screen === 'results' && ui.results) ui.results.t += dt;
      if (!G.run) NS.fx.update(dt);
      return;
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    NS.input.sample();
    NS.command.update(dt);
    if (G.cmd.plan && !G.cine) {
      /* pause-and-plan: only the command camera moves */
      NS.camera.update(dt);
      return;
    }
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      NS.camera.update(dt);
      return;
    }
    let scale = 1;
    if (G.slowMo > 0) {
      G.slowMo -= dt;
      scale = G.slowMo > 0.5 ? G.slowScale : G.slowScale + (1 - G.slowScale) * (1 - G.slowMo / 0.5);
    }
    const s = dt * scale;
    if (G.cine) NS.cinematics.update(dt);
    if (!G.run) return;
    NS.ship.update(s);
    NS.asteroids.update(s);
    NS.mining.update(s);
    NS.drones.update(s);
    NS.pirates.update(s);
    NS.life.update(s);
    NS.base.update(s);
    NS.units.update(s);
    NS.enemies.update(s);
    if (G.base) {
      NS.waves.update(s);
      NS.events.update(s);
    }
    NS.hazards.update(s);
    if (G.run.mode === 'career') NS.asteroids.respawn(s, G.stats);
    else NS.asteroids.respawn(s * 1.5, G.stats);
    NS.trip.update(s);
    NS.fx.update(s);
    NS.camera.update(dt);
    if (t0) {
      perf.sim = performance.now() - t0;
      ++perf.steps;
    }
  }

  Object.assign(NS.sim, {
    update, perf
  });
})();
