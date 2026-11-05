/* One fixed simulation step: clocks and UI timers, the running cinematic, then in play the
   input (or the autopilot for the attract demo), hit-stop and slow motion, the run's clocks and
   the maze; menus only advance clocks, effects and the title demo. Owns G.time and the step
   measurement. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;

  const perf = { sim: 0, avg: 0, steps: 0 };

  function uiClocks(dt) {
    const ui = G.ui;
    if (ui.treeFlash > 0) ui.treeFlash -= dt;
    if (ui.wipe > 0) ui.wipe = Math.max(0, ui.wipe - dt * 1.6);
    if (ui.toast) {
      ui.toast.t += dt;
      if (ui.toast.t > 3) ui.toast = ui.toastQueue && ui.toastQueue.length ? ui.toastQueue.shift() : null;
    }
    for (let i = ui.popups.length - 1; i >= 0; --i) {
      ui.popups[i].t += dt;
      if (ui.popups[i].t > 4) ui.popups.splice(i, 1);
    }
    for (let i = ui.banners.length - 1; i >= 0; --i) {
      ui.banners[i].t += dt;
      if (ui.banners[i].t > 2.2) ui.banners.splice(i, 1);
    }
  }

  function update(dt) {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    G.time += dt;
    G.screenT += dt;
    uiClocks(dt);
    NS.backdrop.update && NS.backdrop.update(dt);
    if (G.screen === 'cine') {
      NS.cinematics.update(dt);
      NS.fx.update(dt);
      return;
    }
    const run = G.run;
    const demo = run && run.demo && (G.screen === 'title' || G.screen === 'map');
    if (G.screen !== 'playing' && !demo) {
      if (G.screen === 'results' && G.ui.results) G.ui.results.t += dt;
      NS.fx.update(dt);
      return;
    }
    if (!run || !run.lvl) return;
    if (demo) NS.autopilot.drive(run.lvl, dt);
    else NS.input.sample(run.lvl);
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      NS.fx.update(dt * 0.25);
      return;
    }
    let scale = 1;
    if (G.slowMo > 0) {
      G.slowMo -= dt;
      scale = G.slowMo > 0.5 ? G.slowScale : G.slowScale + (1 - G.slowScale) * (1 - G.slowMo / 0.5);
    }
    const s = dt * scale;
    NS.run.update(run, s);
    NS.level.update(run, s);
    NS.fx.update(s);
    if (t0) {
      perf.sim = performance.now() - t0;
      perf.avg = perf.avg * 0.95 + perf.sim * 0.05;
      ++perf.steps;
    }
  }

  Object.assign(NS.sim, {
    update, perf
  });
})();
