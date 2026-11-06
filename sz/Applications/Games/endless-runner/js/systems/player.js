/* The runner during a run: turns queued presses (jump with a short buffer, slide, dash, the
   jump cut on release, steering a flight) into input bits for the physics step, then answers the
   step's events with sound, dust, squash-and-stretch and statistics; the trail; and every way a
   hit can end - a shield or the Guardian Angel taking it, Zen's gentle bump, a stumble while
   being chased, or a crash with slow motion, a revive offer and the end of the run. Owns
   nothing; all state lives in the run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const PH = NS.physics;
  const { A, E } = PH;
  const PW = NS.powers;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { TRAIL_BY_ID } = NS.cosmetics;
  const R = NS.rng.fx;

  /* drain the input queue into this step's bits */
  function input(run) {
    const p = run.p;
    const inp = G.input;
    let bits = 0;
    const m = run.mods;
    for (let i = 0; i < inp.queue.length; ++i) {
      const a = inp.queue[i];
      if (p.fly) {
        if (a === 'jump') PW.steerFlight(run, 1);
        else if (a === 'slide') PW.steerFlight(run, -1);
        continue;
      }
      if (a === 'jump') {
        if (p.ground || p.coyote > 0 || p.jumps < (m.maxJumps || 2)) bits |= A.JUMP;
        else run.jumpBuf = C.BUFFER;
      } else if (a === 'slide') bits |= A.SLIDE;
      else if (a === 'dash') {
        if (p.dashCd <= 0) bits |= A.DASH;
        else run.dashBuf = 0.15;
      } else if (a === 'cut') bits |= A.CUT;
    }
    inp.queue.length = 0;
    if (run.jumpBuf > 0 && p.ground) { bits |= A.JUMP; run.jumpBuf = 0; }
    if (run.dashBuf > 0 && p.dashCd <= 0) { bits |= A.DASH; run.dashBuf = 0; }
    if (inp.downHeld) bits |= A.HOLD_DOWN;
    return bits;
  }

  function tick(run, dt) {
    if (run.jumpBuf > 0) run.jumpBuf -= dt;
    if (run.dashBuf > 0) run.dashBuf -= dt;
    run.sq += (0 - run.sq) * Math.min(1, dt * 10);
  }

  /* sound, dust and numbers for what the step reported */
  function events(run) {
    const p = run.p;
    const ev = p.ev;
    if (!ev) return;
    const loud = !run.demo;
    const w = NS.worlds.WORLDS[run.world];
    if (ev & E.JUMP) {
      run.sq = 0.28;
      fx.spray(p.x, p.y, -Math.PI / 2 - 0.4, 1.4, 6, w.ground[0], 160, 0.35, 9, fx.DOT, 400);
      if (loud) { sfx('jump', { volume: 0.55 }); ++run.jumps; NS.progress.count('jumps', 1); }
    }
    if (ev & E.DJUMP) {
      run.sq = 0.32;
      run.flip = 1;
      fx.ring(p.x, p.y - 10, 6, 46, 0.3, '#ffffff', 3);
      fx.burst(p.x, p.y - 4, 8, ['#ffffff', w.accent], 200, 0.35, 10);
      if (loud) { sfx('jump', { pitch: 1.35, volume: 0.5 }); ++run.jumps; NS.progress.count('jumps', 1); }
    }
    if (ev & E.LAND) {
      run.sq = -0.3;
      fx.spray(p.x - 10, p.y, Math.PI + 0.3, 0.8, 5, w.ground[0], 180, 0.4, 10, fx.DOT, 300);
      fx.spray(p.x + 10, p.y, -0.3, 0.8, 4, w.ground[0], 140, 0.35, 8, fx.DOT, 300);
      if (loud) sfx('thud', { volume: 0.35, pitch: 1.3 });
    }
    if (ev & E.SLIDE) {
      if (loud) { sfx('whoosh', { volume: 0.4, pitch: 0.8 }); ++run.slides; NS.progress.count('slides', 1); }
    }
    if (ev & E.DASH) {
      fx.ring(p.x, p.y - 36, 10, 70, 0.25, '#ffffff', 4);
      fx.spray(p.x - 20, p.y - 36, Math.PI, 0.5, 10, ['#ffffff', w.accent], 600, 0.3, 30, fx.STREAK);
      fx.shake(2);
      if (loud) { sfx('whoosh', { pitch: 1.5 }); ++run.dashes; NS.progress.count('dashes', 1); }
    }
    if (ev & E.DROP) {
      if (loud) sfx('drop', { volume: 0.4 });
    }
    if (ev & E.SPRING) {
      run.sq = 0.45;
      fx.burst(p.x, p.y, 16, ['#7cff9a', '#ffffff'], 380, 0.5, 12);
      fx.ring(p.x, p.y, 10, 120, 0.4, '#7cff9a', 6);
      if (loud) sfx('bounce', { pitch: 0.8 });
    }
    if (ev & E.BOOST) {
      fx.flash('#ffd24a', 0.12);
      fx.shake(4);
      if (loud) sfx('powerup', { pitch: 1.5, volume: 0.6 });
      if (run.boss) NS.bosses.boost(run);
    }
  }

  /* dust while running, sparks while dashing, the equipped trail */
  function trail(run, dt) {
    const p = run.p;
    run.trailT -= dt;
    if (run.trailT > 0) return;
    run.trailT = 0.035;
    const t = TRAIL_BY_ID[(G.save && G.save.equip.trail) || 'dust'] || TRAIL_BY_ID.dust;
    const col = t.colors[(R() * t.colors.length) | 0];
    const kind = NS.fx.SHAPES[t.shape];
    const y = p.y - (p.slideT > 0 ? 14 : 34) * p.scale;
    if (t.id === 'dust') {
      if (p.ground && R() < 0.5) fx.spawn(fx.DOT, p.x - 14, p.y - 4, -120 - R() * 80, -40 - R() * 60, 0.5, 6 + R() * 6, col, 120, 0);
      return;
    }
    if (kind === fx.RIBBON) {
      fx.spawn(fx.RIBBON, p.x - 10, y, -40, 0, 0.45, 10, col, 0, 0);
      return;
    }
    fx.spawn(kind, p.x - 14, y + (R() - 0.5) * 30, -80 - R() * 120, (R() - 0.5) * 60, 0.7, 8 + R() * 8, col, kind === fx.SNOW || kind === fx.LEAF || kind === fx.PETAL ? 60 : 0, 0);
  }

  /* someone or something takes the hit instead: smash it and carry on */
  function absorb(run, h, color, label) {
    const p = run.p;
    if (h !== 'fall') NS.hazards.smash(run, h, 'shield');
    p.invT = Math.max(p.invT, 1.0);
    fx.ring(p.x, p.y - 40, 20, 160, 0.4, color, 8);
    fx.burst(p.x, p.y - 40, 24, [color, '#ffffff'], 380, 0.6, 14);
    fx.shake(10);
    fx.hitstop(0.08);
    if (label) fx.text(p.x + 20, p.y - 130, label, color, 26, 1.2);
    sfx('hit');
    run.combo = 0;
  }

  /* move a runner who fell into a pit to the next ground, gliding in */
  function rescue(run) {
    const p = run.p;
    p.x = NS.stream.nextGround(run, p.x + 80);
    p.y = C.GROUND_Y - 260;
    p.vy = 0;
    p.glide = 1;
    p.ground = 0;
    p.invT = Math.max(p.invT, 1.6);
    p.slideT = 0;
    fx.burst(p.x, p.y - 30, 20, ['#ffffff', '#5ee0ff'], 300, 0.6, 14);
  }

  function hit(run, h) {
    const p = run.p;
    if (run.demo) {
      if (h === 'fall') rescue(run); else NS.hazards.smash(run, h, 'demo');
      return;
    }
    if (h === 'fall') {
      if (run.mode === 'zen') { rescue(run); run.combo = 0; sfx('drop'); return; }
      if (run.bs && run.bs.chase) { rescue(run); NS.bosses.stumble(run, 320); return; }
      die(run, 'fall');
      return;
    }
    if (h.kind === 'proj') h.dead = 1;
    if (run.shieldHits > 0) {
      --run.shieldHits;
      if (run.shieldHits <= 0) run.pw.shield = 0;
      absorb(run, h, '#5ee0ff', 'Shield!');
      return;
    }
    if (G.stats.guardian && !run.guardianUsed && run.mode !== 'zen' && !run.mut.glass) {
      run.guardianUsed = 1;
      absorb(run, h, '#ffd24a', 'Guardian Angel!');
      return;
    }
    if (run.mode === 'zen') {
      absorb(run, h, '#b48cff', null);
      return;
    }
    ++run.hits;
    if (run.bs && run.bs.chase) {
      absorb(run, h, '#ff6a7a', 'Stumble!');
      NS.bosses.stumble(run, 240);
      return;
    }
    die(run, h.kind);
  }

  function die(run, why) {
    const p = run.p;
    run.phase = 'dying';
    run.phaseT = 1.1;
    run.why = why;
    p.dead = 1;
    p.deadVy = why === 'fall' ? 0 : -700;
    p.deadSpin = 0;
    G.slowmo = Math.max(G.slowmo, 0.9);
    fx.shake(16);
    fx.flash('#ff3a4a', 0.4);
    fx.hitstop(0.12);
    fx.burst(p.x, p.y - 36, 30, ['#ff5a6a', '#ffffff', '#ffd24a'], 520, 0.7, 16);
    fx.ring(p.x, p.y - 36, 10, 180, 0.5, '#ff5a6a', 8);
    sfx('hurt');
    NS.progress.count('deaths', 1);
  }

  /* death animation; then the revive offer or the end */
  function updateDying(run, dt) {
    const p = run.p;
    if (run.why !== 'fall') {
      p.deadVy += 2200 * dt;
      p.y = Math.min(C.GROUND_Y, p.y + p.deadVy * dt);
      p.x += 120 * dt;
      p.deadSpin += dt * 9;
    } else p.y += 500 * dt;
    run.phaseT -= dt;
    if (run.phaseT > 0) return;
    if (run.revives > 0 && !run.mut.glass) {
      run.phase = 'revive';
      run.phaseT = 4;
      sfx('blip', { pitch: 0.8 });
    } else NS.run.over(run);
  }

  function revive(run) {
    if (run.phase !== 'revive' || run.revives <= 0) return;
    --run.revives;
    ++run.revived;
    const p = run.p;
    p.dead = 0;
    if (run.why === 'fall' || !NS.stream.groundAt(run, p.x)) p.x = NS.stream.nextGround(run, p.x);
    p.y = C.GROUND_Y;
    p.vy = 0; p.ground = 1; p.jumps = 0; p.slideT = 0; p.dashT = 0; p.glide = 0;
    p.invT = G.stats.reviveInv;
    /* clear the way ahead */
    const hz = run.course.hz;
    for (let i = PH.lowerBound(hz, p.x - 300); i < hz.length && hz[i].x < p.x + 1100; ++i) hz[i].dead = 1;
    for (let i = 0; i < run.projs.length; ++i) run.projs[i].dead = 1;
    if (run.bs && run.bs.chase) run.bs.lead = Math.max(run.bs.lead, 520);
    run.phase = 'ready';
    run.phaseT = 0.9;
    fx.ring(p.x, p.y - 40, 20, 260, 0.7, '#ff8a2a', 10);
    fx.burst(p.x, p.y - 40, 40, ['#ff8a2a', '#ffd24a', '#ffffff'], 520, 0.9, 18);
    fx.flash('#ffb03a', 0.4);
    sfx('levelup');
    NS.progress.count('revives', 1);
  }

  Object.assign(NS.player, {
    input, tick, events, trail, hit, die, updateDying, revive, rescue
  });
})();
