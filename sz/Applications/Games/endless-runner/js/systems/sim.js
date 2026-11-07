/* One simulation step for whatever is on screen: the clock, toasts and achievement checks,
   hit-stop and dramatic slow motion, the open run (or the title's demo runner, restarted in the
   next world when it has gone far enough), the effects, the camera (it leads the runner, zooms
   out as the speed climbs and in vertical views, looks up during flights, turns with the run's
   direction and keeps the scenery's scroll along the screen) and the ambience. Owns the demo
   run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const CO = NS.course;
  const { WORLDS } = NS.worlds;
  const OR = NS.orient;

  let demoWorld = -1;

  function newDemo() {
    if (demoWorld < 0) demoWorld = G.season ? G.season.world : 0;
    else demoWorld = (demoWorld + 1) % WORLDS.length;
    const prev = G.run;
    const run = NS.run.create('demo', { demo: true, world: demoWorld });
    G.demo = run;
    G.run = run;
    NS.run.begin(run);
    G.run = prev;
    run.phase = 'play';
    NS.autopilot.reset();
    G.cam.x = run.p.x - C.PLAYER_SCREEN_X;
    return run;
  }

  /* the run the world view follows right now */
  function viewRun() {
    if (G.run && !G.run.demo && (NS.screens.inRun() || G.screen === 'results')) return G.run;
    return G.demo || newDemo();
  }

  /* the view of the run at the runner (cam.o), recomputed whenever the scene needs it */
  function orient(run) {
    const cam = G.cam;
    cam.o = OR.at(run.course.dirs, run.p.x, NS.view.visible(), cam.o);
    return cam.o;
  }

  function camera(run, dt) {
    const p = run.p;
    const v = CO.speedAt(run.course.cfg, p.x);
    const f = Math.max(0, Math.min(1, (v - 480) / 620));
    const o = orient(run);
    const zoom = (1 - 0.14 * f - (p.fly ? 0.06 : 0)) * (1 + (OR.VERT_ZOOM - 1) * o.vert);
    const cam = G.cam;
    const x0 = cam.x;
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 2);
    const chased = run.bs && run.bs.chase && run.bs.phase !== 'gone';
    const tx = p.x - (C.PLAYER_SCREEN_X + (chased ? 230 : 0) + (run.demo ? 260 : 0)) / cam.zoom;
    cam.x += (tx - cam.x) * Math.min(1, dt * 12);
    if (Math.abs(tx - cam.x) > 900) cam.x = tx;
    const ty = Math.min(0, (p.y - 300) * 0.8);
    cam.y += (ty - cam.y) * Math.min(1, dt * 4);
    /* how far the scenery has scrolled along the screen (forward is turned with the view) */
    const d = cam.x - x0;
    if (Math.abs(d) < 900) {
      const c = Math.cos(o.a), s = Math.sin(o.a);
      cam.sx = (cam.sx || 0) + d * cam.zoom * c * o.m;
      cam.sy = (cam.sy || 0) + d * cam.zoom * s * o.m;
    }
  }

  function update(dt) {
    G.time += dt;
    G.screenT += dt;
    NS.progress.tick(dt);
    NS.statusBar.tick && NS.statusBar.tick(dt);
    if (G.screen === 'cine') { NS.cine.update(dt); return; }
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    let sdt = dt;
    if (G.slowmo > 0) {
      G.slowmo = Math.max(0, G.slowmo - dt);
      sdt = dt * 0.35;
    }
    const run = viewRun();
    if (G.screen === 'playing' && run === G.run) {
      NS.run.update(run, sdt);
      NS.fx.update(sdt);
      camera(run, sdt);
      const w = WORLDS[run.world];
      NS.audio.ambience(dt, w.root, run.mode === 'zen');
      return;
    }
    if (G.screen === 'paused') return;
    if (run.demo) {
      NS.run.update(run, sdt);
      if (run.p.x > 26000) newDemo();
    }
    NS.fx.update(sdt);
    camera(viewRun(), sdt);
  }

  Object.assign(NS.sim, {
    update, newDemo, viewRun, camera, orient
  });
})();
