/* Power-ups in a run: switching one on (timed ones get the tree-boosted duration; Phoenix
   Feather and Shockwave act at once), counting them down, what they do each frame (jetpack and
   rocket flight with coin trails in the sky, the giant's growth, coin rain, gem rush), the soft
   landing when a flight ends, the time scale of Slow-Mo, and the move modifiers the physics step
   reads (jump strength, air jumps, dash timing, ghost and giant). Owns nothing; all state lives
   in the run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const { POWER_BY_ID } = NS.items;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const R = NS.rng.fx;

  const GY = C.GROUND_Y;
  const FLY_LANES = [GY - 300, GY - 430];

  function on(run, id) {
    return (run.pw[id] || 0) > 0;
  }

  function activate(run, id, quiet) {
    const def = POWER_BY_ID[id];
    if (!def) return;
    const p = run.p;
    const st = G.stats;
    if (!quiet) {
      fx.burst(p.x, p.y - 40, 26, [def.color, '#ffffff'], 420, 0.7, 16);
      fx.ring(p.x, p.y - 40, 20, 140, 0.45, def.color, 6);
      fx.text(p.x + 30, p.y - 120, def.name + '!', def.color, 30, 1.3);
      fx.flash(def.color, 0.18);
      sfx('powerup');
      ++run.powersUsed;
      NS.progress.count('powers', 1);
    }
    switch (id) {
      case 'revive':
        ++run.revives;
        return;
      case 'quake':
        quake(run);
        return;
      case 'shield':
        run.shieldHits = st.shieldHits;
        break;
      case 'jetpack':
      case 'rocket':
        p.fly = id === 'rocket' ? 2 : 1;
        p.flyY = FLY_LANES[0];
        run.flyLane = 0;
        run.skyNext = p.x + 200;
        p.slideT = 0;
        p.dashT = 0;
        if (id === 'rocket') { fx.shake(10); sfx('explode', { volume: 0.5, pitch: 1.4 }); }
        break;
      case 'rain':
        run.rainNext = 0;
        break;
    }
    run.pw[id] = (st.dur[id] || def.dur) * (run.durMul || 1);
  }

  /* smash every obstacle in view */
  function quake(run) {
    const p = run.p;
    const hz = run.course.hz;
    let n = 0;
    for (let i = NS.physics.lowerBound(hz, p.x - 400); i < hz.length && hz[i].x < p.x + 1300; ++i)
      if (!hz[i].dead && hz[i].x + hz[i].w > p.x - 60) { NS.hazards.smash(run, hz[i], 'quake'); ++n; }
    for (let i = 0; i < run.projs.length; ++i) run.projs[i].dead = 1;
    fx.ring(p.x, p.y - 40, 40, 1100, 0.7, '#ffffff', 10);
    fx.shake(18);
    fx.flash('#ffffff', 0.5);
    fx.hitstop(0.08);
    sfx('explode');
    return n;
  }

  function endFlight(run) {
    const p = run.p;
    p.fly = 0;
    p.vy = 0;
    p.glide = 1;
    p.invT = Math.max(p.invT, 1.4);
    sfx('whoosh', { pitch: 0.7 });
    fx.burst(p.x, p.y - 30, 14, '#ffffff', 260, 0.5, 12, fx.DOT);
  }

  /* the jetpack lane (jump: up, slide: down) */
  function steerFlight(run, dir) {
    const p = run.p;
    if (!p.fly) return;
    run.flyLane = Math.max(0, Math.min(1, run.flyLane + dir));
    p.flyY = FLY_LANES[run.flyLane];
    sfx('whoosh', { volume: 0.4, pitch: 1.4 });
  }

  function update(run, dt) {
    const p = run.p;
    for (const id in run.pw) {
      if (run.pw[id] <= 0) continue;
      run.pw[id] -= dt;
      if (run.pw[id] <= 0) {
        run.pw[id] = 0;
        if ((id === 'jetpack' || id === 'rocket') && p.fly) endFlight(run);
        if (id === 'shield') run.shieldHits = 0;
        if (!run.demo) sfx('drop', { volume: 0.4 });
      }
    }
    /* sky coins ahead of a flight, alternating lanes into waves */
    if (p.fly) {
      while (run.skyNext < p.x + 1300) {
        const lane = Math.floor(run.skyNext / 900) % 2;
        const wave = Math.sin(run.skyNext * 0.004) * 40;
        run.sky.push({ x: run.skyNext, y: FLY_LANES[lane] - 30 + wave, gem: on(run, 'lucky') ? 1 : 0 });
        run.skyNext += 58;
      }
      const flame = p.fly === 2 ? '#ff5a2a' : '#ffb03a';
      fx.spawn(fx.GLOW, p.x - 22, p.y - 26, -260 - R() * 160, 60 + R() * 60, 0.35, 22, flame, 0, 0);
      if (p.fly === 2) fx.spawn(fx.STREAK, p.x - 40, p.y - 40 + (R() - 0.5) * 60, -1400, 0, 0.25, 60, '#ffffff', 0, 0);
    }
    /* coin rain: coins falling in ahead */
    if (on(run, 'rain')) {
      run.rainNext -= dt;
      while (run.rainNext <= 0) {
        run.rainNext += 0.07;
        run.rain.push({ x: p.x + 250 + R() * 1000, y: -40 - R() * 200, vy: 200 + R() * 200, gem: on(run, 'lucky') ? 1 : 0 });
      }
    }
    for (let i = run.rain.length - 1; i >= 0; --i) {
      const c = run.rain[i];
      if (c.y < GY - 40) {
        c.vy += 900 * dt;
        c.y = Math.min(GY - 40, c.y + c.vy * dt);
      }
      if (c.x < p.x - 600) run.rain.splice(i, 1);
    }
    for (let i = run.sky.length - 1; i >= 0; --i) if (run.sky[i].x < p.x - 600) run.sky.splice(i, 1);
    /* the giant grows and shrinks smoothly */
    const target = on(run, 'giant') ? 1.7 : 1;
    p.scale += (target - p.scale) * Math.min(1, dt * 6);
    if (Math.abs(p.scale - target) < 0.01) p.scale = target;
  }

  /* world time scale */
  function timeScale(run) {
    return on(run, 'slowmo') ? 0.6 : 1;
  }

  function mods(run, out) {
    const st = G.stats;
    const spring = on(run, 'spring');
    out.jumpV = C.JUMP_V * st.jumpMul * (spring ? 1.12 : 1);
    out.jump2V = C.JUMP2_V * st.jumpMul * (spring ? 1.1 : 1);
    out.maxJumps = st.maxJumps + (spring ? 1 : 0);
    out.dashCd = st.dashCd;
    out.dashT = st.dashT;
    out.slideT = st.slideT;
    out.ghost = on(run, 'ghost');
    out.giant = on(run, 'giant') || run.p.scale > 1.2;
    out.grav = run.mut.grav || 1;
    out.speedMul = 1;
    return out;
  }

  /* active timed powers for the HUD, longest first */
  function active(run) {
    const out = [];
    for (const id in run.pw) if (run.pw[id] > 0) out.push(id);
    return out;
  }

  Object.assign(NS.powers, {
    FLY_LANES, on, activate, quake, endFlight, steerFlight, update, timeScale, mods, active
  });
})();
