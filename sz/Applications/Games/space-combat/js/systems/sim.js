/* One fixed simulation step: input intent, hit-stop and slow motion, then player, weapons,
   enemies, boss, hazards, shots, collisions, pickups, mission and effects in that order, and
   the camera. Menu screens only advance clocks and effects. Owns G.time and the feel timers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;

  /* the measured cost of the last steps, for the frame-time probe */
  const perf = { sim: 0, steps: 0 };

  function update(dt) {
    G.time += dt;
    G.screenT += dt;
    if (G.ui.treeFlash > 0) G.ui.treeFlash -= dt;
    if (G.ui.toast) {
      G.ui.toast.t += dt;
      if (G.ui.toast.t > 2.4) G.ui.toast = null;
    }
    if (G.screen !== 'playing') {
      if (G.screen !== 'paused' && G.screen !== 'tree' && G.screen !== 'help') NS.fx.update(dt);
      if (G.screen === 'results' && G.ui.results) G.ui.results.t += dt;
      return;
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    NS.input.sample();
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      NS.camera.update(dt);
      return;
    }
    let scale = 1;
    if (G.slowMo > 0) {
      G.slowMo -= dt;
      /* ease back to full speed over the last half second */
      scale = G.slowMo > 0.5 ? G.slowScale : G.slowScale + (1 - G.slowScale) * (1 - G.slowMo / 0.5);
    }
    const s = dt * scale;
    NS.combat.rebuildGrid();
    NS.player.update(s);
    NS.weapons.update(s);
    NS.enemies.update(s);
    NS.bosses.update(s);
    NS.hazards.update(s);
    NS.projectiles.update(s);
    NS.combat.rebuildGrid();
    NS.combat.collide(s);
    NS.pickups.update(s);
    NS.grid.compact(G.enemies);
    tickBeams(s);
    NS.missions.update(s);
    NS.fx.update(s);
    NS.camera.update(dt);
    if (t0) {
      perf.sim = performance.now() - t0;
      ++perf.steps;
    }
  }

  /* hostile beam flashes fade */
  function tickBeams(dt) {
    for (let i = 0; i < G.beams.length; ++i) {
      const b = G.beams[i];
      b.t += dt;
      if (b.t >= b.life) b.alive = false;
    }
    NS.grid.compact(G.beams);
  }

  Object.assign(NS.sim, {
    update, perf
  });
})();
