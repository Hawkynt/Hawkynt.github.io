/* The fixed-step simulation: the run's seeded generator (resumable through autosave), the
   chrono-field world clock, hit-stop and slow motion, the system order of one flight step, the
   title screen's attract scene flown by the autopilot, cinematics, toasts and periodic autosave.
   Owns the generator. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { FIELD_W, FIELD_H } = NS.constants;

  let gen = NS.rng.makeRng(1);
  let demoT = 0;

  function seed(s) {
    gen = NS.rng.makeRng(s);
  }

  function rng() {
    return gen();
  }

  function rngState() {
    return gen.getState();
  }

  function setRngState(s) {
    gen.setState(s >>> 0);
  }

  /* everything but the ship runs slower inside the Chrono Field */
  function worldScale() {
    const s = G.ship;
    return s && s.power && s.power.chrono ? 0.35 : 1;
  }

  function update(dt) {
    G.time += dt;
    G.screenT += dt;
    tickUi(dt);
    switch (G.screen) {
      case 'playing':
        flight(dt, NS.input.sample());
        break;
      case 'cine':
        NS.cinematics.update(dt);
        NS.fx.update(dt);
        break;
      case 'story':
        NS.story.update(dt);
        NS.fx.update(dt);
        break;
      case 'title':
        demo(dt);
        break;
      case 'paused':
        break;
      default:
        NS.fx.update(dt);
        break;
    }
  }

  function tickUi(dt) {
    const ts = G.ui.toasts;
    for (let i = 0; i < ts.length; ++i) ts[i].t += dt;
    while (ts.length && ts[0].t > ts[0].life) ts.shift();
    if (G.ui.treeFlash > 0) G.ui.treeFlash = Math.max(0, G.ui.treeFlash - dt);
    if (G.fade > 0) G.fade = Math.max(0, G.fade - dt);
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t > G.banner.life) G.banner = null;
    }
  }

  /* one step of flight with feel: hit-stop freezes the world, slow motion stretches it */
  function flight(dt, intent) {
    NS.fx.update(dt);
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      return;
    }
    let k = dt;
    if (G.slowMo > 0) {
      G.slowMo -= dt;
      k = dt * G.slowScale;
    }
    step(k, intent);
    NS.snapshot.autosave(false);
  }

  function step(dt, intent) {
    NS.ship.update(dt, intent);
    NS.weapons.update(dt, intent);
    NS.rocks.update(dt);
    NS.enemies.update(dt);
    NS.bosses.update(dt);
    NS.hazards.update(dt);
    NS.powerups.update(dt);
    NS.collision.update(dt);
    if (G.run) {
      NS.waves.update(dt);
      NS.progress.tick(dt);
    }
  }

  /* ── the attract scene behind the menus ── */
  function startDemo() {
    G.run = null;
    G.level = null;
    NS.waves.clearWorld();
    seed((Date.now() & 0xffff) + 7);
    NS.ship.create(FIELD_W / 2, FIELD_H / 2);
    G.ship.invuln = 1e9;
    const types = ['normal', 'iron', 'crystal', 'gold', 'ice', G.cal.seasonDef.token];
    for (let i = 0; i < 6; ++i) NS.rocks.spawnEdge(types[i % types.length], 3, 0.8);
    demoT = 0;
  }

  function demo(dt) {
    if (!G.ship || G.run) startDemo();
    demoT += dt;
    const s = G.ship;
    s.invuln = 1e9;
    if (NS.rocks.count() < 5 && G.rocks.length < 12) {
      const types = ['normal', 'normal', 'iron', 'crystal', 'gold', 'ice', 'lava', 'electric', G.cal.seasonDef.token];
      NS.rocks.spawnEdge(types[Math.floor(gen() * types.length)], 3, 0.8);
    }
    const intent = NS.bot.think();
    intent.hyperQ = false;
    intent.overQ = false;
    NS.fx.update(dt);
    step(dt, intent);
  }

  Object.assign(NS.sim, {
    seed, rng, rngState, setRngState, worldScale, update, step, flight, startDemo
  });
})();
